// JSON으로 저장하는 데이터에 필요한 호환 기능만 제공한다.
export const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
export const cloneData = value => JSON.parse(JSON.stringify(value));
export function makeId() {
  const secure = typeof crypto !== 'undefined' ? crypto : null;
  if (secure && typeof secure.randomUUID === 'function') return secure.randomUUID();
  if (secure && typeof secure.getRandomValues === 'function') {
    const bytes = secure.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    return Array.from(bytes, byte => (`0${byte.toString(16)}`).slice(-2)).join('');
  }
  return `record-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
if (!Object.fromEntries) {
  Object.fromEntries = function (entries) {
    const result = {};
    for (const [key, value] of entries) Object.defineProperty(result, key, { value, enumerable: true, configurable: true, writable: true });
    return result;
  };
}
