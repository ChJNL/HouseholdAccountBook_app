import { createState, validateState, ensureMonth, monthOf, todayString } from './core.js';
export const STORAGE_KEY = 'household-book:v1';
export const BACKUP_FORMAT = 'household-account-book';
export function createStore(storage = localStorage) {
  let state;
  let persisted = null;
  function load() {
    const raw = storage.getItem(STORAGE_KEY);
    persisted = raw;
    const parsed = raw === null ? createState() : validateState(JSON.parse(raw));
    state = parsed; persisted = raw;
    return state;
  }
  function commit(next) {
    if (storage.getItem(STORAGE_KEY) !== persisted) throw new Error('다른 탭에서 데이터가 변경되었습니다. 새로고침 후 다시 시도해 주세요.');
    next.revision = (state?.revision || 0) + 1;
    next.updatedAt = new Date().toISOString();
    validateState(next);
    const raw = JSON.stringify(next);
    try { storage.setItem(STORAGE_KEY, raw); }
    catch { throw new Error('기기에 저장하지 못했습니다. 저장 공간과 브라우저 저장 허용 설정을 확인해 주세요. 입력 내용은 화면에 유지됩니다.'); }
    state = next; persisted = raw;
    return state;
  }
  return {
    load,
    get state() { if (!state) throw new Error('데이터를 먼저 불러와 주세요.'); return state; },
    update(callback) { const next = structuredClone(state); ensureMonth(next, monthOf(todayString())); callback(next); return commit(next); },
    replace(data) { validateState(data); return commit(structuredClone(data)); },
    export() { return JSON.stringify({ format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), data: state }, null, 2); },
  };
}
export function parseBackup(raw) {
  if (typeof raw !== 'string' || raw.length > 10 * 1024 * 1024) throw new Error('10MB 이하의 JSON 백업 파일을 선택해 주세요.');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('JSON 파일을 읽을 수 없습니다. 원본 백업 파일을 선택해 주세요.'); }
  if (parsed?.format !== BACKUP_FORMAT) throw new Error('이 가계부에서 내보낸 백업 파일이 아닙니다.');
  return validateState(parsed.data);
}
