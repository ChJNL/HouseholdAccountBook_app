import { createState, validateState, ensureMonth, monthOf, todayString } from './core.js';
import { cloneData } from './compat.js';
export const STORAGE_KEY = 'household-book:v1';
export const BACKUP_FORMAT = 'household-account-book';
export function createStore(providedStorage) {
  // 저장소를 읽기 전에도 빈 가계부 화면을 표시할 수 있다.
  let state = createState();
  let persisted = null;
  let loaded = false;
  let loadError = null;
  let hasSavedData = false;
  const storage = () => providedStorage || window.localStorage;
  function load() {
    loadError = null;
    try {
      const raw = storage().getItem(STORAGE_KEY);
      persisted = raw;
      hasSavedData = raw !== null;
      // 첫 실행에서는 기존 데이터 파싱과 복원을 시도하지 않는다.
      state = raw === null ? createState() : validateState(JSON.parse(raw));
    } catch (error) {
      state = createState();
      loadError = new Error(`저장된 기록을 읽지 못했습니다. 원본을 보존하고 빈 화면을 표시합니다. ${error.message}`);
    }
    loaded = true;
    return state;
  }
  function commit(next, restoring = false) {
    if (!loaded) throw new Error('기기 저장소를 준비하고 있습니다. 잠시 후 다시 눌러 주세요.');
    if (loadError && !restoring) throw new Error('기존 기록을 보호하기 위해 저장을 중단했습니다. 상단의 데이터 복구를 선택해 주세요.');
    let current;
    try { current = storage().getItem(STORAGE_KEY); }
    catch { throw new Error('기기 저장소에 접근할 수 없습니다. 브라우저 또는 앱의 저장 설정을 확인해 주세요.'); }
    if (current !== persisted) throw new Error('다른 탭에서 데이터가 변경되었습니다. 새로고침 후 다시 시도해 주세요.');
    next.revision = state.revision + 1;
    next.updatedAt = new Date().toISOString();
    validateState(next);
    const raw = JSON.stringify(next);
    try { storage().setItem(STORAGE_KEY, raw); }
    catch { throw new Error('기기에 저장하지 못했습니다. 저장 공간과 브라우저 저장 허용 설정을 확인해 주세요. 입력 내용은 화면에 유지됩니다.'); }
    state = next; persisted = raw; loadError = null; hasSavedData = true;
    return state;
  }
  return {
    load,
    get state() { return state; },
    get error() { return loadError; },
    get hasSavedData() { return hasSavedData; },
    update(callback) { const next = cloneData(state); ensureMonth(next, monthOf(todayString())); callback(next); return commit(next); },
    replace(data) { validateState(data); return commit(cloneData(data), true); },
    exportRaw() { return storage().getItem(STORAGE_KEY); },
    export() {
      if (loadError) throw new Error('정상 백업으로 내보낼 수 없습니다. 데이터 복구에서 원본 데이터를 내보내 주세요.');
      return JSON.stringify({ format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), data: state }, null, 2);
    },
  };
}
export function parseBackup(raw) {
  if (typeof raw !== 'string' || raw.length > 10 * 1024 * 1024) throw new Error('10MB 이하의 JSON 백업 파일을 선택해 주세요.');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('JSON 파일을 읽을 수 없습니다. 원본 백업 파일을 선택해 주세요.'); }
  if (parsed?.format !== BACKUP_FORMAT) throw new Error('이 가계부에서 내보낸 백업 파일이 아닙니다.');
  return validateState(parsed.data);
}
