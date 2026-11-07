import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORAGE_KEY, parseBackup } from '../web/storage.js';
import { addAccount, balance } from '../web/core.js';
class MemoryStorage { data = new Map(); fail = false; getItem(key) { return this.data.get(key) ?? null; } setItem(key, value) { if (this.fail) throw new Error('용량 부족'); this.data.set(key, value); } }

test('전체 상태를 저장하고 다시 열면 계좌와 잔액이 보존된다', () => {
  const storage = new MemoryStorage(); const first = createStore(storage); first.load(); first.update(state => addAccount(state, { name: '통장', openingBalance: 12_345 })); const next = createStore(storage); next.load();
  assert.deepEqual(next.state, first.state); assert.equal(balance(next.state, next.state.accounts[0].id), 12_345);
});
test('저장 실패는 메모리 상태와 저장 원본을 변경하지 않는다', () => {
  const storage = new MemoryStorage(); const store = createStore(storage); store.load(); store.update(state => addAccount(state, { name: '통장', openingBalance: 1 })); const before = structuredClone(store.state); const raw = storage.getItem(STORAGE_KEY); storage.fail = true;
  assert.throws(() => store.update(state => { state.accounts[0].name = '변경'; }), /저장하지 못/); assert.deepEqual(store.state, before); assert.equal(storage.getItem(STORAGE_KEY), raw);
});
test('다른 탭의 변경을 감지하고 덮어쓰지 않는다', () => {
  const storage = new MemoryStorage(); const first = createStore(storage), second = createStore(storage); first.load(); second.load(); first.update(state => addAccount(state, { name: '첫 탭', openingBalance: 1 }));
  assert.throws(() => second.update(state => addAccount(state, { name: '둘째 탭', openingBalance: 2 })), /다른 탭/); assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).accounts[0].name, '첫 탭');
});
test('JSON 백업 왕복은 거래와 계좌 데이터를 보존한다', () => {
  const store = createStore(new MemoryStorage()); store.load(); store.update(state => addAccount(state, { name: '내 통장', openingBalance: 100 })); const parsed = parseBackup(store.export()); assert.deepEqual(parsed, store.state);
  const next = createStore(new MemoryStorage()); next.load(); next.replace(parsed); assert.deepEqual(next.state.accounts, store.state.accounts);
});
test('손상 원본은 초기화하지 않고 정상 백업으로 명시적으로 복원할 수 있다', () => {
  const storage = new MemoryStorage(); storage.setItem(STORAGE_KEY, '{손상'); const store = createStore(storage); assert.throws(() => store.load()); assert.equal(storage.getItem(STORAGE_KEY), '{손상');
  const clean = createStore(new MemoryStorage()); clean.load(); const data = parseBackup(clean.export()); store.replace(data); assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).schemaVersion, 1);
});
test('지원하지 않는 백업과 유효하지 않은 복원 데이터는 거부한다', () => {
  assert.throws(() => parseBackup('{}'), /백업 파일이 아닙니다/); assert.throws(() => parseBackup('{broken'), /JSON 파일/);
  const store = createStore(new MemoryStorage()); store.load(); const raw = JSON.parse(store.export()); raw.data.schemaVersion = 99; assert.throws(() => parseBackup(JSON.stringify(raw)), /지원하지 않는/);
});
test('유효성 검증 실패는 저장 원본을 변경하지 않는다', () => {
  const storage = new MemoryStorage(); const store = createStore(storage); store.load(); store.update(state => addAccount(state, { name: '계좌', openingBalance: 100 })); const before = storage.getItem(STORAGE_KEY);
  assert.throws(() => store.update(state => { state.accounts[0].openingBalance = NaN; })); assert.equal(storage.getItem(STORAGE_KEY), before);
});
