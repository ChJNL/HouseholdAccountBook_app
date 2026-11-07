export const SCHEMA_VERSION = 1;
export const CATEGORIES = ['식비', '카페·간식', '생활·쇼핑', '교통', '주거·통신', '건강', '문화·여가', '교육', '기타'];
export const MOODS = ['가치소비', '어쩔 수 없음', '낭비·후회'];
export const MAX_MONEY = 1_000_000_000_000;
export const uid = () => crypto.randomUUID();
export function todayString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export const monthOf = date => date.slice(0, 7);
export function daysInMonth(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m, 0).getDate();
}
export function shiftMonth(month, offset) {
  const [year, m] = month.split('-').map(Number);
  return monthOf(todayString(new Date(year, m - 1 + offset, 1)));
}
export function isMonth(value) { return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 2000 && Number(value.slice(0, 4)) <= 2199; }
export function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && isMonth(monthOf(value)) && Number(value.slice(8)) >= 1 && Number(value.slice(8)) <= daysInMonth(monthOf(value));
}
function requireValue(condition, message) { if (!condition) throw new Error(message); }
export function money(value, label = '금액', signed = false) {
  requireValue(Number.isSafeInteger(value) && Math.abs(value) <= MAX_MONEY && (signed || value >= 0), `${label}은 ${signed ? '' : '0 이상의 '}정수로 입력해 주세요. 최대 금액은 1조 원입니다.`);
  return value;
}
function label(value, title, max = 60) { requireValue(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${title}은 1~${max}자로 입력해 주세요.`); }
function identifier(value) { label(value, '식별자', 100); }
function unique(items, title) {
  const seen = new Set();
  for (const item of items) { identifier(item.id); requireValue(!seen.has(item.id), `${title}에 중복 식별자가 있습니다.`); seen.add(item.id); }
}
export function createState(date = todayString()) {
  return { schemaVersion: SCHEMA_VERSION, revision: 0, updatedAt: new Date().toISOString(), settings: { bookName: '나의 가계부', primaryAccountId: null }, goals: { [monthOf(date)]: { income: 0, savings: 0 } }, accounts: [], transactions: [], fixedExpenses: [], fixedMonths: { [monthOf(date)]: [] } };
}
export function goalFor(state, month) {
  const key = Object.keys(state.goals).filter(key => key <= month).sort().at(-1);
  return key ? state.goals[key] : { income: 0, savings: 0 };
}
export function fixedFor(state, month) {
  if (Object.hasOwn(state.fixedMonths, month)) return state.fixedMonths[month];
  return state.fixedExpenses.filter(item => item.startMonth <= month && (item.active || (item.endMonth && month <= item.endMonth))).map(item => ({ id: `${item.id}:${month}`, fixedId: item.id, name: item.name, amount: item.amount, day: item.day, accountId: item.accountId }));
}
export function ensureMonth(state, month) {
  if (!Object.hasOwn(state.goals, month)) state.goals[month] = { ...goalFor(state, month) };
  if (!Object.hasOwn(state.fixedMonths, month)) state.fixedMonths[month] = fixedFor(state, month).map(item => ({ ...item }));
}
export function validateState(state) {
  requireValue(state && typeof state === 'object' && state.schemaVersion === SCHEMA_VERSION, '지원하지 않는 백업 형식입니다.');
  requireValue(Number.isSafeInteger(state.revision) && state.revision >= 0, '저장 버전이 올바르지 않습니다.');
  requireValue(typeof state.updatedAt === 'string' && Number.isFinite(Date.parse(state.updatedAt)), '저장 시간이 올바르지 않습니다.');
  requireValue(state.settings && typeof state.settings === 'object', '설정 정보가 없습니다.');
  label(state.settings.bookName, '가계부 이름', 24);
  for (const key of ['accounts', 'transactions', 'fixedExpenses']) requireValue(Array.isArray(state[key]) && state[key].length <= 100_000, `${key} 목록이 올바르지 않습니다.`);
  requireValue(state.goals && typeof state.goals === 'object' && !Array.isArray(state.goals), '월별 예산이 올바르지 않습니다.');
  requireValue(state.fixedMonths && typeof state.fixedMonths === 'object' && !Array.isArray(state.fixedMonths), '월별 고정비가 올바르지 않습니다.');
  unique(state.accounts, '계좌'); unique(state.transactions, '거래'); unique(state.fixedExpenses, '고정비');
  const accounts = new Set(state.accounts.map(item => item.id));
  requireValue(state.settings.primaryAccountId === null || accounts.has(state.settings.primaryAccountId), '대표 계좌를 찾을 수 없습니다.');
  for (const item of state.accounts) { label(item.name, '계좌 이름', 24); money(item.openingBalance, '시작 잔액', true); requireValue(typeof item.archived === 'boolean', '계좌 보관 상태가 올바르지 않습니다.'); }
  for (const [month, goal] of Object.entries(state.goals)) { requireValue(isMonth(month), '예산 월이 올바르지 않습니다.'); money(goal.income, '월 수입'); money(goal.savings, '목표 저축액'); }
  const occurrenceIds = new Map();
  const fixedIds = new Set(state.fixedExpenses.map(item => item.id));
  for (const [month, items] of Object.entries(state.fixedMonths)) {
    requireValue(isMonth(month) && Array.isArray(items), '고정비 월이 올바르지 않습니다.');
    unique(items, '월별 고정비');
    for (const item of items) {
      requireValue(fixedIds.has(item.fixedId) && item.id === `${item.fixedId}:${month}` && accounts.has(item.accountId), '고정비 연결 정보가 올바르지 않습니다.');
      label(item.name, '고정비 이름'); money(item.amount); requireValue(item.amount > 0 && Number.isInteger(item.day) && item.day >= 1 && item.day <= 31, '고정비 금액 또는 출금일이 올바르지 않습니다.');
      occurrenceIds.set(item.id, { ...item, month });
    }
  }
  for (const item of state.fixedExpenses) {
    label(item.name, '고정비 이름'); money(item.amount); requireValue(item.amount > 0 && accounts.has(item.accountId) && isMonth(item.startMonth) && (item.endMonth === null || isMonth(item.endMonth)) && typeof item.active === 'boolean' && Number.isInteger(item.day) && item.day >= 1 && item.day <= 31, '반복 고정비 정보가 올바르지 않습니다.');
  }
  const paid = new Set();
  for (const item of state.transactions) {
    requireValue(accounts.has(item.accountId), '거래에 연결된 계좌가 없습니다.');
    requireValue(['income', 'expense', 'adjustment'].includes(item.type) && isDate(item.date) && item.date <= todayString(), '거래 유형 또는 날짜가 올바르지 않습니다.');
    label(item.name, '거래 내역'); label(item.category, '카테고리', 30); money(item.amount, '거래 금액', item.type === 'adjustment'); requireValue(item.amount !== 0, '거래 금액은 0원일 수 없습니다.');
    requireValue(item.type === 'expense' ? MOODS.includes(item.mood) : item.mood === '', '감정 태그가 올바르지 않습니다.');
    requireValue(item.fixedOccurrenceId === null || typeof item.fixedOccurrenceId === 'string', '고정비 연결 형식이 올바르지 않습니다.');
    if (item.fixedOccurrenceId) {
      const occurrence = occurrenceIds.get(item.fixedOccurrenceId);
      requireValue(occurrence && item.type === 'expense' && monthOf(item.date) === occurrence.month && occurrence.accountId === item.accountId && occurrence.amount === item.amount && !paid.has(item.fixedOccurrenceId), '고정비 납부 정보가 중복되었거나 일치하지 않습니다.');
      paid.add(item.fixedOccurrenceId);
    }
  }
  for (const account of state.accounts) money(balance(state, account.id), '계좌 잔액', true);
  money(state.accounts.reduce((sum, account) => sum + balance(state, account.id), 0), '총 자산', true);
  return state;
}
export function balance(state, accountId) {
  const account = state.accounts.find(item => item.id === accountId);
  return (account?.openingBalance || 0) + state.transactions.filter(item => item.accountId === accountId).reduce((sum, item) => sum + (item.type === 'expense' ? -item.amount : item.amount), 0);
}
export function addAccount(state, { name, openingBalance }) {
  const account = { id: uid(), name: name.trim(), openingBalance: money(openingBalance, '잔액', true), archived: false };
  state.accounts.push(account);
  if (!state.settings.primaryAccountId) state.settings.primaryAccountId = account.id;
  return account;
}
export function adjustAccount(state, id, name, targetBalance, date = todayString()) {
  const account = state.accounts.find(item => item.id === id);
  requireValue(account, '계좌를 찾을 수 없습니다.');
  const difference = money(targetBalance, '잔액', true) - balance(state, id);
  account.name = name.trim();
  if (difference) state.transactions.push({ id: uid(), type: 'adjustment', accountId: id, date, amount: difference, name: '잔액 직접 조정', category: '잔액 조정', mood: '', fixedOccurrenceId: null });
}
export function archiveAccount(state, id) {
  requireValue(!state.fixedExpenses.some(item => item.active && item.accountId === id), '이 계좌에 반복 고정비가 연결되어 있습니다. 먼저 반복을 중단해 주세요.');
  requireValue(!Object.entries(state.fixedMonths).some(([month, items]) => month >= monthOf(todayString()) && items.some(item => item.accountId === id && !state.transactions.some(tx => tx.fixedOccurrenceId === item.id))), '이 계좌에 미납 고정비가 있습니다. 납부하거나 예정 내역을 취소해 주세요.');
  const account = state.accounts.find(item => item.id === id);
  requireValue(account, '계좌를 찾을 수 없습니다.'); account.archived = true;
  if (state.settings.primaryAccountId === id) state.settings.primaryAccountId = state.accounts.find(item => !item.archived)?.id ?? null;
}
export function saveTransaction(state, values, id = null) {
  const previous = id ? state.transactions.find(item => item.id === id) : null;
  requireValue(!id || previous, '수정할 거래를 찾을 수 없습니다.');
  requireValue(state.accounts.some(item => item.id === values.accountId && (!item.archived || item.id === previous?.accountId)), '사용 가능한 계좌를 선택해 주세요.');
  const item = { id: id || uid(), type: values.type, accountId: values.accountId, date: values.date, amount: Number(values.amount), name: values.name.trim(), category: values.category, mood: values.type === 'expense' ? values.mood : '', fixedOccurrenceId: previous?.fixedOccurrenceId ?? null };
  requireValue(item.type !== 'adjustment' || previous?.type === 'adjustment', '잔액 조정은 계좌 화면에서 처리해 주세요.');
  if (previous?.fixedOccurrenceId) {
    requireValue(item.type === 'expense' && monthOf(item.date) === monthOf(previous.date), '고정비 납부는 같은 달의 지출로만 수정할 수 있습니다.');
    const occurrence = state.fixedMonths[monthOf(previous.date)].find(row => row.id === previous.fixedOccurrenceId);
    occurrence.amount = item.amount; occurrence.accountId = item.accountId; occurrence.name = item.name;
  }
  if (previous) state.transactions[state.transactions.indexOf(previous)] = item;
  else state.transactions.push(item);
  return item;
}
export function addFixedExpense(state, values, month = monthOf(todayString())) {
  ensureMonth(state, month);
  requireValue(state.accounts.some(item => item.id === values.accountId && !item.archived), '사용 가능한 계좌를 선택해 주세요.');
  const item = { id: uid(), name: values.name.trim(), amount: Number(values.amount), day: Number(values.day), accountId: values.accountId, startMonth: month, endMonth: null, active: true };
  state.fixedExpenses.push(item);
  for (const [key, items] of Object.entries(state.fixedMonths)) if (key >= month) items.push({ id: `${item.id}:${key}`, fixedId: item.id, name: item.name, amount: item.amount, day: item.day, accountId: item.accountId });
  return item;
}
export function stopFixedExpense(state, id, month = monthOf(todayString())) {
  const item = state.fixedExpenses.find(row => row.id === id);
  requireValue(item, '고정비를 찾을 수 없습니다.'); item.active = false; item.endMonth = shiftMonth(month, -1);
  for (const [key, rows] of Object.entries(state.fixedMonths)) if (key >= month) state.fixedMonths[key] = rows.filter(row => row.fixedId !== id || state.transactions.some(tx => tx.fixedOccurrenceId === row.id));
}
export function payFixedExpense(state, occurrenceId, month, date = todayString()) {
  ensureMonth(state, month);
  requireValue(monthOf(date) === month, '조회한 달의 날짜로 납부를 기록해 주세요.');
  const item = state.fixedMonths[month].find(row => row.id === occurrenceId);
  requireValue(item && !state.transactions.some(tx => tx.fixedOccurrenceId === occurrenceId), '이미 납부했거나 취소된 고정비입니다.');
  requireValue(state.accounts.some(account => account.id === item.accountId && !account.archived), '계좌를 복원한 뒤 납부해 주세요.');
  state.transactions.push({ id: uid(), type: 'expense', accountId: item.accountId, date, amount: item.amount, name: item.name, category: '주거·통신', mood: '어쩔 수 없음', fixedOccurrenceId: item.id });
}
export function summarize(state, month = monthOf(todayString()), date = todayString()) {
  const current = month === monthOf(date);
  const day = current ? Number(date.slice(8)) : daysInMonth(month);
  const end = `${month}-${String(day).padStart(2, '0')}`;
  const previousMonth = shiftMonth(month, -1);
  const previousEnd = `${previousMonth}-${String(Math.min(day, daysInMonth(previousMonth))).padStart(2, '0')}`;
  const transactions = state.transactions.filter(tx => monthOf(tx.date) === month && tx.date <= end);
  const expenses = transactions.filter(tx => tx.type === 'expense');
  const sum = list => list.reduce((amount, tx) => amount + tx.amount, 0);
  const spent = sum(expenses);
  const previous = sum(state.transactions.filter(tx => tx.type === 'expense' && monthOf(tx.date) === previousMonth && tx.date <= previousEnd));
  const fixed = fixedFor(state, month);
  const fixedTotal = sum(fixed);
  const unpaid = fixed.filter(row => !state.transactions.some(tx => tx.fixedOccurrenceId === row.id));
  const goal = goalFor(state, month);
  const variableBudget = goal.income - goal.savings - fixedTotal;
  const variable = expenses.filter(tx => !tx.fixedOccurrenceId);
  const variableSpent = sum(variable);
  const todaySpent = sum(variable.filter(tx => tx.date === date));
  const remainingDays = current ? daysInMonth(month) - day + 1 : 0;
  const daily = remainingDays ? Math.floor((variableBudget - (variableSpent - todaySpent)) / remainingDays) : 0;
  const categories = Object.entries(expenses.reduce((acc, tx) => { acc[tx.category] = (acc[tx.category] || 0) + tx.amount; return acc; }, Object.create(null))).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).map(([name, amount]) => ({ name, amount, ratio: spent ? amount / spent : 0 }));
  const assets = state.accounts.reduce((sum, account) => sum + balance(state, account.id), 0);
  return { month, end, previousEnd, expenses, spent, earned: sum(transactions.filter(tx => tx.type === 'income')), previous, difference: spent - previous, change: previous ? (spent - previous) / previous : null, fixed, fixedTotal, unpaid, unpaidTotal: sum(unpaid), goal, variableBudget, variableSpent, todaySpent, daily, todayRemaining: daily - todaySpent, remainingDays, categories, assets, availableAssets: assets - sum(unpaid), waste: sum(expenses.filter(tx => tx.mood === '낭비·후회')), elapsedRatio: day / daysInMonth(month), spentRatio: variableBudget > 0 ? variableSpent / variableBudget : null };
}
