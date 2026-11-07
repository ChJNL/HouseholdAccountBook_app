import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, addAccount, balance, saveTransaction, adjustAccount, archiveAccount, addFixedExpense, payFixedExpense, stopFixedExpense, ensureMonth, fixedFor, summarize, validateState, daysInMonth, shiftMonth, goalFor } from '../web/core.js';
const DATE = '2024-02-15';
function fixture() {
  const state = createState(DATE);
  const account = addAccount(state, { name: '생활비 통장', openingBalance: 1_000_000 });
  state.goals['2024-02'] = { income: 3_000_000, savings: 1_000_000 };
  return { state, account };
}
function expense(state, account, amount = 10_000, date = DATE, extra = {}) { return saveTransaction(state, { type: 'expense', accountId: account.id, amount, date, name: '점심', category: '식비', mood: '가치소비', ...extra }); }

test('지출과 수입은 잔액에 한 번씩 반영된다', () => {
  const { state, account } = fixture(); expense(state, account);
  saveTransaction(state, { type: 'income', accountId: account.id, amount: 50_000, date: DATE, name: '용돈', category: '용돈' });
  assert.equal(balance(state, account.id), 1_040_000); validateState(state);
});
test('거래 수정으로 계좌와 금액을 바꾸고 삭제해도 잔액이 일치한다', () => {
  const { state, account } = fixture(); const second = addAccount(state, { name: '비상금', openingBalance: 20_000 }); const tx = expense(state, account);
  saveTransaction(state, { ...tx, accountId: second.id, amount: 5_000, type: 'income', mood: '' }, tx.id);
  assert.equal(balance(state, account.id), 1_000_000); assert.equal(balance(state, second.id), 25_000);
  state.transactions = state.transactions.filter(row => row.id !== tx.id); assert.equal(balance(state, second.id), 20_000);
});
test('잔액 직접 조정은 수입과 지출에서 제외된다', () => {
  const { state, account } = fixture(); expense(state, account); adjustAccount(state, account.id, '주 통장', 800_000, DATE);
  const result = summarize(state, '2024-02', DATE);
  assert.equal(balance(state, account.id), 800_000); assert.equal(result.spent, 10_000); assert.equal(result.earned, 0); validateState(state);
});
test('월말과 윤년은 현지 날짜 기준으로 계산된다', () => {
  assert.equal(daysInMonth('2024-02'), 29); assert.equal(daysInMonth('2025-02'), 28);
  assert.equal(shiftMonth('2024-01', -1), '2023-12'); assert.equal(shiftMonth('2024-12', 1), '2025-01');
});
test('권장 예산은 어제까지의 지출을 빼고 오늘 지출은 그대로 차감한다', () => {
  const { state, account } = fixture(); expense(state, account, 500_000, '2024-02-14'); expense(state, account, 20_000);
  const result = summarize(state, '2024-02', DATE);
  assert.equal(result.remainingDays, 15); assert.equal(result.daily, 100_000); assert.equal(result.todayRemaining, 80_000);
});
test('고정비 납부는 계좌와 지출에 반영되고 변동비에서는 중복 차감되지 않는다', () => {
  const { state, account } = fixture(); const fixed = addFixedExpense(state, { name: '월세', amount: 500_000, day: 31, accountId: account.id }, '2024-02');
  const before = summarize(state, '2024-02', DATE); payFixedExpense(state, `${fixed.id}:2024-02`, '2024-02', DATE);
  const after = summarize(state, '2024-02', DATE);
  assert.equal(after.daily, before.daily); assert.equal(after.variableSpent, 0); assert.equal(after.spent, 500_000); assert.equal(after.unpaidTotal, 0); assert.equal(balance(state, account.id), 500_000); assert.equal(before.availableAssets, after.availableAssets); validateState(state);
});
test('고정비 중복 납부를 막고 납부 삭제 후 다시 납부할 수 있다', () => {
  const { state, account } = fixture(); const fixed = addFixedExpense(state, { name: '구독', amount: 10_000, day: 1, accountId: account.id }, '2024-02'); const id = `${fixed.id}:2024-02`;
  payFixedExpense(state, id, '2024-02', DATE); assert.throws(() => payFixedExpense(state, id, '2024-02', DATE), /이미 납부/);
  state.transactions = []; assert.equal(summarize(state, '2024-02', DATE).unpaidTotal, 10_000); payFixedExpense(state, id, '2024-02', DATE); assert.equal(state.transactions.length, 1);
});
test('고정비 금액 수정은 월별 예산에 반영되고 다른 달 이동은 막는다', () => {
  const { state, account } = fixture(); const fixed = addFixedExpense(state, { name: '통신비', amount: 50_000, day: 10, accountId: account.id }, '2024-02'); payFixedExpense(state, `${fixed.id}:2024-02`, '2024-02', DATE); const tx = state.transactions[0];
  saveTransaction(state, { ...tx, amount: 45_000 }, tx.id); assert.equal(fixedFor(state, '2024-02')[0].amount, 45_000); validateState(state);
  assert.throws(() => saveTransaction(state, { ...tx, date: '2024-01-15' }, tx.id), /같은 달/);
});
test('반복 중단은 과거와 납부 기록을 보존하고 미납 예정만 제거한다', () => {
  const { state, account } = fixture(); const fixed = addFixedExpense(state, { name: '월세', amount: 50_000, day: 1, accountId: account.id }, '2024-02'); ensureMonth(state, '2024-03'); payFixedExpense(state, `${fixed.id}:2024-02`, '2024-02', DATE);
  stopFixedExpense(state, fixed.id, '2024-02'); assert.equal(fixedFor(state, '2024-02').length, 1); assert.equal(fixedFor(state, '2024-03').length, 0); assert.equal(fixedFor(state, '2024-04').length, 0); validateState(state);
});
test('새 월은 최근 목표를 이어받으며 기존 월별 목표는 유지한다', () => {
  const { state } = fixture(); ensureMonth(state, '2024-03'); state.goals['2024-03'].savings = 2_000_000;
  assert.equal(goalFor(state, '2024-02').savings, 1_000_000); assert.equal(goalFor(state, '2024-04').savings, 2_000_000);
});
test('반복을 중단해도 실행하지 않았던 과거 달의 예정 내역은 계산할 수 있다', () => {
  const { state, account } = fixture(); const fixed = addFixedExpense(state, { name: '구독', amount: 5_000, day: 1, accountId: account.id }, '2024-02');
  stopFixedExpense(state, fixed.id, '2024-05'); assert.equal(fixedFor(state, '2024-03').length, 1); assert.equal(fixedFor(state, '2024-06').length, 0);
});
test('전월 동기간 비교는 말일과 연도 경계를 보정한다', () => {
  const { state, account } = fixture(); expense(state, account, 10_000, '2024-02-29'); expense(state, account, 20_000, '2024-03-30'); expense(state, account, 30_000, '2024-03-31');
  const result = summarize(state, '2024-03', '2024-03-31'); assert.equal(result.previousEnd, '2024-02-29'); assert.equal(result.previous, 10_000); assert.equal(result.spent, 50_000); assert.equal(result.change, 4);
  assert.equal(summarize(state, '2024-01', '2024-01-03').previousEnd, '2023-12-03');
});
test('전월 동기간 이후 지출은 비교에서 제외한다', () => {
  const { state, account } = fixture(); expense(state, account, 8_000, '2024-01-15'); expense(state, account, 90_000, '2024-01-16'); expense(state, account, 10_000);
  assert.equal(summarize(state, '2024-02', DATE).previous, 8_000);
});
test('분류별 집계, 동점 순위, 낭비 집계가 정확하다', () => {
  const { state, account } = fixture(); expense(state, account, 5_000, DATE, { mood: '낭비·후회' }); expense(state, account, 5_000); expense(state, account, 10_000, DATE, { category: '교통' });
  const data = summarize(state, '2024-02', DATE); assert.equal(data.categories.length, 2); assert.deepEqual(data.categories.map(row => row.amount), [10_000, 10_000]); assert.equal(data.categories[0].ratio, .5); assert.equal(data.waste, 5_000);
});
test('비교 지출 0원과 부족한 예산은 NaN이나 Infinity를 만들지 않는다', () => {
  const { state, account } = fixture(); state.goals['2024-02'] = { income: 0, savings: 10_000 }; expense(state, account, 5_000);
  const data = summarize(state, '2024-02', DATE); assert.equal(data.change, null); assert.equal(data.spentRatio, null); assert.ok(data.todayRemaining < 0); assert.ok(Number.isFinite(data.daily));
});
test('보관한 계좌의 잔액과 거래는 유지된다', () => {
  const { state, account } = fixture(); expense(state, account); archiveAccount(state, account.id); assert.equal(balance(state, account.id), 990_000); assert.equal(state.settings.primaryAccountId, null);
  assert.throws(() => expense(state, account), /사용 가능한 계좌/); assert.equal(summarize(state, '2024-02', DATE).assets, 990_000);
});
test('없는 계좌, 소수 금액, 잘못된 날짜, 중복 ID는 거부한다', () => {
  for (const edit of [state => { state.transactions[0].accountId = '없음'; }, state => { state.transactions[0].amount = 1.5; }, state => { state.transactions[0].date = '2024-02-30'; }, state => { state.transactions.push({ ...state.transactions[0] }); }]) {
    const { state, account } = fixture(); expense(state, account); edit(state); assert.throws(() => validateState(state));
  }
});
