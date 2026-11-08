import { CATEGORIES, MOODS, MAX_MONEY, todayString, monthOf, daysInMonth, shiftMonth, createState, balance, goalFor, fixedFor, summarize, addAccount, adjustAccount, archiveAccount, saveTransaction, addFixedExpense, stopFixedExpense, payFixedExpense, ensureMonth, isMonth } from './core.js';
import { STORAGE_KEY, createStore, parseBackup } from './storage.js';
import { owns } from './compat.js';

const $ = selector => document.querySelector(selector);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = value => new Intl.NumberFormat('ko-KR').format(value);
const won = value => `${number(value)}원`;
const percent = value => `${(value * 100).toFixed(1)}%`;
const shortDate = date => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`;
const monthLabel = month => `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;
const categorySymbol = category => ({ '식비': '🍚', '카페·간식': '☕', '생활·쇼핑': '🛍', '교통': '🚋', '주거·통신': '⌂', '건강': '🌿', '문화·여가': '♫', '교육': '✎', '기타': '◈', '급여': '₩', '잔액 조정': '↔' }[category] || '◈');
const routes = {
  dashboard: ['메인', '나의 하루, 나의 예산', '작은 기록부터 시작하는 나만의 자산 관리'],
  entry: ['돈 쓰기 / 벌기', '차곡차곡 쌓이는 기록', '오늘의 수입과 지출을 가볍게 남겨 보세요.'],
  history: ['내역 보기', '한눈에 돌아보는 나의 소비', '기록을 살펴보고 나에게 맞는 소비 습관을 찾아보세요.'],
  analytics: ['지출 분석', '숫자로 알아보는 나의 습관', '지난달과 비교하고, 자주 쓰는 곳을 확인해 보세요.'],
  accounts: ['내 계좌 모음', '흩어진 자산을 한곳에', '금융 연동 없이 내가 직접 관리하는 계좌'],
  fixed: ['고정비 스케줄러', '미리 준비하는 여유', '매달 나가는 돈을 기억하고 남은 예산을 관리하세요.'],
  settings: ['설정 및 데이터 관리', '나에게 맞는 가계부', '목표를 정하고 이 기기에 기록을 쌓아 보세요.'],
};
let store;
let selectedMonth = monthOf(todayString());
let route = routes[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard';
let filters = { search: '', type: '', category: '', mood: '' };
let historyPage = 1;
let toastTimer;
let modalHandler;
let fatal = false;
let lastDate = todayString();
let modalReturnFocus = null;

function activeAccounts(includeId = null) { return store.state.accounts.filter(item => !item.archived || item.id === includeId); }
function accountName(id) { return store.state.accounts.find(item => item.id === id)?.name || '알 수 없는 계좌'; }
function options(values, selected) { return values.map(value => `<option value="${escape(value)}" ${value === selected ? 'selected' : ''}>${escape(value)}</option>`).join(''); }
function accountOptions(selected, includeId) { return activeAccounts(includeId).map(item => `<option value="${escape(item.id)}" ${item.id === selected ? 'selected' : ''}>${escape(item.name)}${item.archived ? ' (보관)' : ''}</option>`).join(''); }
function button(action, text, style = 'primary', id = '', extra = '') { return `<button class="button ${style}" data-action="${action}" ${id ? `data-id="${escape(id)}"` : ''} ${extra}>${text}</button>`; }
function empty(title, message, action = '', actionText = '') { return `<div class="empty"><div class="icon-bubble">${icon('leaf')}</div><h3>${title}</h3><p>${message}</p>${action ? button(action, actionText, 'ghost') : ''}</div>`; }
function progress(value, red = false) { const pct = Number.isFinite(value) ? Math.min(100, Math.max(0, value * 100)) : 0; return `<div class="progress ${red ? 'red' : ''}" aria-hidden="true"><span style="--progress:${pct}%"></span></div>`; }
function stat(label, value, caption, symbol, className = '') { return `<article class="card stat-card"><div class="stat-top"><span class="card-label">${label}</span><div class="icon-bubble">${icon(symbol)}</div></div><div class="stat-value ${className}">${value}</div><p class="stat-caption">${caption}</p></article>`; }
function notify(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200); }
function mutate(callback, message, redraw = true) {
  store.update(callback);
  fatal = false;
  if (!store.error) $('#notice-bar').hidden = true;
  if (redraw) render();
  if (message) notify(message);
}
function setRoute(next) {
  if (!owns(routes, next)) return;
  route = next;
  closeSidebar();
  // WebView의 주소 조각 이동 이벤트에 의존하지 않고 선택한 화면을 즉시 표시한다.
  render();
  try { history.replaceState(null, '', `#${next}`); } catch { /* 주소 변경 실패가 화면 이동을 막지 않는다. */ }
  $('#main').focus();
  window.scrollTo(0, 0);
}
function closeSidebar() { document.body.classList.remove('sidebar-open'); $('#menu-toggle').setAttribute('aria-expanded', 'false'); $('#menu-toggle').setAttribute('aria-label', '메뉴 열기'); if (window.innerWidth < 1024) $('#sidebar').inert = true; }
function showModal(title, body, handler, submitText = '저장하기', danger = false) {
  if ($('#modal').hasAttribute('open')) closeModal();
  modalReturnFocus = document.activeElement;
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = body;
  $('#modal-error').hidden = true;
  $('#modal-submit').textContent = submitText;
  $('#modal-submit').className = `button ${danger ? 'danger' : 'primary'}`;
  modalHandler = handler;
  if (typeof $('#modal').showModal === 'function') $('#modal').showModal();
  else {
    $('#modal').classList.add('modal-fallback');
    $('#modal').setAttribute('open', '');
    $('#modal-backdrop').hidden = false;
    document.body.classList.add('modal-fallback-open');
  }
  const firstInput = $('#modal-body').querySelector('input:not([type=radio]),select');
  if (firstInput) firstInput.focus(); else $('#modal-cancel').focus();
}
function closeModal() {
  if (typeof $('#modal').close === 'function') $('#modal').close();
  else $('#modal').removeAttribute('open');
  $('#modal').classList.remove('modal-fallback');
  $('#modal-backdrop').hidden = true;
  document.body.classList.remove('modal-fallback-open');
  if (modalReturnFocus && document.contains(modalReturnFocus)) modalReturnFocus.focus();
}
function confirmAction(title, body, callback, text = '확인', danger = false) { showModal(title, `<p class="modal-copy">${body}</p>`, callback, text, danger); }
function inputField(name, title, value = '', type = 'text', extra = '', hint = '') { return `<label class="field"><span>${title}</span><input name="${name}" type="${type}" value="${escape(value)}" ${extra} required>${hint ? `<small>${hint}</small>` : ''}</label>`; }
const moneyAttrs = `min="0" max="${MAX_MONEY}" step="1" inputmode="numeric"`;

function render() {
  const [title, eyebrow, description] = routes[route];
  $('#page-title').textContent = title;
  $('#page-eyebrow').textContent = eyebrow;
  $('#page-description').textContent = description;
  $('#breadcrumb-page').textContent = title;
  $('#book-name').innerHTML = `${escape(store.state.settings.bookName)} <span aria-hidden="true">✎</span>`;
  document.title = `${title} · ${store.state.settings.bookName} · 차곡`;
  $('#month-picker').value = selectedMonth;
  $('#month-picker').max = monthOf(todayString());
  $('#month-picker').closest('label').hidden = route === 'accounts';
  document.querySelectorAll('#navigation a').forEach(link => { const active = link.dataset.route === route; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  const renderers = { dashboard: renderDashboard, entry: renderEntry, history: renderHistory, analytics: renderAnalytics, accounts: renderAccounts, fixed: renderFixed, settings: renderSettings };
  const renderScreen = renderers[route];
  if (typeof renderScreen !== 'function') throw new Error('선택한 메뉴에 연결된 화면이 없습니다.');
  $('#view').innerHTML = renderScreen();
  $('#save-status').textContent = store.state.revision ? `마지막 저장 ${new Date(store.state.updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '아직 저장된 기록이 없습니다';
  if (route === 'entry') bindEntryForm();
  if (route === 'history') bindHistoryFilters();
  if (route === 'settings') bindSettings();
  if (store.error) showStorageIssue();
}
function renderDashboard() {
  const state = store.state, data = summarize(state, selectedMonth);
  const current = selectedMonth === monthOf(todayString());
  const primary = state.accounts.find(item => item.id === state.settings.primaryAccountId && !item.archived);
  const recent = [...data.expenses].sort((a, b) => b.date.localeCompare(a.date) || state.transactions.indexOf(b) - state.transactions.indexOf(a)).slice(0, 3);
  const budgetSet = data.goal.income > 0;
  let guide = '';
  if (!activeAccounts().length) guide = `<div class="setup-strip"><div><strong>첫 계좌를 등록하고 가볍게 시작하세요.</strong><p>통장 이름과 지금 잔액만 있으면 준비가 끝나요.</p></div>${button('add-account', `${icon('plus')} 계좌 등록`, 'secondary')}</div>`;
  else if (!budgetSet) guide = `<div class="setup-strip"><div><strong>오늘 쓸 수 있는 예산이 궁금하다면?</strong><p>월 수입과 저축 목표를 설정해 주세요.</p></div>${button('settings', '목표 설정', 'secondary')}</div>`;
  const dailyTitle = current ? '오늘 남은 예산' : '이번 달 남은 변동비';
  const dailyValue = current ? data.todayRemaining : data.variableBudget - data.variableSpent;
  const budgetMessage = !budgetSet ? '월 수입과 저축 목표를 설정하면 예산을 안내해 드려요.' : dailyValue < 0 ? `계획한 예산보다 ${won(Math.abs(dailyValue))} 초과했어요.` : current ? `오늘 권장 예산 ${won(data.daily)} · 오늘 쓴 변동비 ${won(data.todaySpent)}` : `${monthLabel(selectedMonth)}의 예산과 소비 기록입니다.`;
  return `${guide}<section class="grid hero-grid"><article class="hero"><div class="hero-orbit"></div><div class="hero-sprout">${icon('leaf')}</div><div class="hero-content"><div class="hero-overline">${icon('leaf')} ${dailyTitle}</div><h2>${current ? '오늘도, 나에게 맞는 소비를.' : '한 달의 기록을 돌아보세요.'}</h2><div class="big-money ${budgetSet && dailyValue < 0 ? 'negative' : ''}">${budgetSet ? number(Math.max(0, dailyValue)) : '—'}<small>원</small></div><p>${budgetMessage}</p><a href="#entry" class="hero-link">오늘의 기록 남기기 ${icon('arrow')}</a></div></article><article class="card account-spotlight"><div class="stat-top"><span class="card-label">차곡차곡 모인 총 자산</span><div class="icon-bubble">${icon('wallet')}</div></div><div class="asset-total">${number(data.assets)}<small> 원</small></div><div class="asset-bottom"><span>${primary ? `${escape(primary.name)} · ${won(balance(state, primary.id))}` : '나의 첫 계좌를 등록해 보세요'}</span><a href="#accounts" aria-label="내 계좌 모음 보기">${icon('arrow')}</a></div></article></section>
  <section class="grid stats-grid" aria-label="이번 달 요약">${stat('이번 달 쓴 돈', `${number(data.spent)}<small>원</small>`, '기록한 지출을 모두 합산했어요', 'chart')}${stat('이번 달 번 돈', `${number(data.earned)}<small>원</small>`, '잔액 조정은 포함하지 않아요', 'plus', 'positive')}${stat('목표 저축액', `${number(data.goal.savings)}<small>원</small>`, budgetSet ? '매달 나를 위해 남겨둘 돈' : '월별 목표를 설정해 보세요', 'leaf')}${stat('남은 고정비', `${number(data.unpaidTotal)}<small>원</small>`, `${data.unpaid.length}건의 납부가 남아 있어요`, 'calendar')}</section>
  <section class="grid dashboard-bottom"><article class="card"><div class="card-header"><div><h2>최근 지출</h2><p class="subtitle">나의 일상을 채운 작은 기록</p></div><a href="#history" class="text-button">전체 보기 ${icon('arrow')}</a></div>${recent.length ? `<ul class="transaction-list">${recent.map(tx => `<li class="transaction-row"><div class="transaction-info"><span class="category-symbol" aria-hidden="true">${categorySymbol(tx.category)}</span><div><p class="transaction-name">${escape(tx.name)}</p><p class="transaction-meta">${shortDate(tx.date)} · ${escape(tx.category)} · ${escape(accountName(tx.accountId))}</p></div></div><span class="transaction-amount">−${won(tx.amount)}</span></li>`).join('')}</ul>` : empty('아직 지출 기록이 없어요', '작은 지출 하나부터 기록해 보세요.', 'entry', '첫 기록 남기기')}</article><article class="card"><div class="card-header"><div><h2>이번 달 예산 살펴보기</h2><p class="subtitle">고정비를 제외한 변동비 기준</p></div><span class="tag">${Number(selectedMonth.slice(5))}월</span></div><div class="budget-detail"><span>변동비 사용</span><strong>${won(data.variableSpent)} / ${won(data.variableBudget)}</strong></div>${progress(data.spentRatio, data.spentRatio > 1)}<div class="budget-detail"><span>이번 달 진행률</span><span>${percent(data.elapsedRatio)}</span></div><div class="budget-detail"><span>예산 소진율</span><strong>${data.spentRatio === null ? '예산 설정 필요' : percent(data.spentRatio)}</strong></div><div class="budget-note ${data.spentRatio > data.elapsedRatio || data.variableBudget < 0 ? 'warning' : ''}">${budgetDiagnosis(data)}</div><a href="#analytics" class="text-button">내 소비 자세히 보기 ${icon('arrow')}</a></article></section>`;
}
function budgetDiagnosis(data) {
  if (!data.goal.income) return '월 수입과 목표 저축액을 설정하면 소비 속도를 확인할 수 있어요.';
  if (data.variableBudget <= 0) return `고정비와 저축 목표를 반영하면 변동비 예산이 ${won(data.variableBudget)}입니다. 목표나 고정비를 조정해 주세요.`;
  if (data.spentRatio > 1) return `이번 달 변동비 예산을 ${won(data.variableSpent - data.variableBudget)} 초과했어요. 남은 지출을 점검해 보세요.`;
  if (data.spentRatio > data.elapsedRatio) return '달이 지난 속도보다 예산을 쓰는 속도가 빨라요. 남은 지출을 조금 조절해 보세요.';
  return '예산 안에서 차분하게 소비하고 있어요. 지금의 좋은 흐름을 이어가세요.';
}

function transactionFields(tx = null) {
  const isAdjustment = tx?.type === 'adjustment';
  const defaultDate = selectedMonth === monthOf(todayString()) ? todayString() : `${selectedMonth}-${daysInMonth(selectedMonth)}`;
  const type = tx?.type || 'expense';
  const categories = type === 'income' ? ['급여', '용돈', '부수입', '기타'] : type === 'adjustment' ? ['잔액 조정'] : CATEGORIES;
  return `<div class="type-switch" ${tx ? 'hidden' : ''}><label><input type="radio" name="type" value="expense" ${type === 'expense' ? 'checked' : ''}><span>− 돈 쓰기</span></label><label><input type="radio" name="type" value="income" ${type === 'income' ? 'checked' : ''}><span>＋ 돈 벌기</span></label></div>${tx ? `<input type="hidden" name="type" value="${type}">` : ''}<div class="form-grid"><label class="field full"><span>${isAdjustment ? '조정 금액' : '금액'}</span><div class="amount-input"><input name="amount" type="number" value="${tx ? tx.amount : ''}" min="${isAdjustment ? -MAX_MONEY : 1}" max="${MAX_MONEY}" step="1" inputmode="${isAdjustment ? 'decimal' : 'numeric'}" placeholder="0" required aria-label="금액"><span>원</span></div></label><label class="field"><span>계좌</span><select name="accountId" required>${accountOptions(tx?.accountId || store.state.settings.primaryAccountId, tx?.accountId)}</select></label>${inputField('date', '날짜', tx?.date || defaultDate, 'date', `min="${tx?.fixedOccurrenceId ? `${monthOf(tx.date)}-01` : '2000-01-01'}" max="${tx?.fixedOccurrenceId ? (monthOf(tx.date) === monthOf(todayString()) ? todayString() : `${monthOf(tx.date)}-${daysInMonth(monthOf(tx.date))}`) : todayString()}"`)}<label class="field"><span>카테고리</span><select name="category" required>${options([...new Set([...(tx ? [tx.category] : []), ...categories])], tx?.category)}</select></label>${inputField('name', '내역', tx?.name || '', 'text', 'maxlength="60" placeholder="어디에 사용했나요?"')}<fieldset class="field full mood-field" ${type !== 'expense' ? 'hidden' : ''} style="border:0;padding:0;margin:0"><legend class="sr-only">소비 감정</legend><span>어떤 소비였나요?</span><div class="mood-options">${MOODS.map((mood, i) => `<label><input type="radio" name="mood" value="${mood}" ${(tx?.mood || MOODS[0]) === mood ? 'checked' : ''}><span>${['☺', '○', '☁'][i]} ${mood}</span></label>`).join('')}</div></fieldset></div>${tx?.fixedOccurrenceId ? '<p class="data-note">고정비 납부 내역입니다. 금액을 수정하면 이번 달 고정비 예산도 함께 변경됩니다.</p>' : ''}`;
}
function renderEntry() {
  if (!activeAccounts().length) return `<article class="card">${empty('기록을 연결할 계좌가 필요해요', '첫 계좌를 등록하면 수입과 지출을 기록할 수 있어요.', 'add-account', '계좌 등록하기')}</article>`;
  return `<div class="grid entry-layout"><article class="card entry-card"><form id="entry-form">${transactionFields()}<p class="form-error" id="entry-error" role="alert" hidden></p><div class="form-footer"><p>${icon('shield')} 기록은 이 기기에만 저장됩니다.</p><button type="submit" class="button primary">${icon('check')} 기록 저장하기</button></div></form></article><aside class="side-stack"><article class="card"><div class="card-header"><h2>선택한 계좌</h2><span class="tag">수동 관리</span></div><div class="account-preview" id="entry-account-preview"></div><p class="data-note">지출은 잔액에서 빠지고,<br>수입은 잔액에 더해져요.</p></article><article class="card tip-card">${icon('leaf')}<h3>소비에도 마음이 있어요.</h3><p>나에게 가치 있었던 소비와 조금 아쉬웠던 소비를 구분해 보세요. 작은 기록이 다음 선택에 도움이 돼요.</p></article></aside></div>`;
}
function bindTransactionType(form) {
  form.addEventListener('change', event => {
    if (event.target.name !== 'type') return;
    const income = event.target.value === 'income';
    form.querySelector('.mood-field').hidden = income;
    form.elements.category.innerHTML = options(income ? ['급여', '용돈', '부수입', '기타'] : CATEGORIES);
  });
}
function bindEntryForm() {
  const form = $('#entry-form'); if (!form) return;
  bindTransactionType(form);
  function updatePreview() { const id = form.elements.accountId.value; $('#entry-account-preview').innerHTML = `<p>${escape(accountName(id))}</p><strong>${won(balance(store.state, id))}</strong>`; }
  updatePreview(); form.elements.accountId.addEventListener('change', updatePreview);
  form.addEventListener('submit', event => {
    event.preventDefault();
    try { const values = Object.fromEntries(new FormData(form)); mutate(state => saveTransaction(state, values), '오늘의 기록을 차곡차곡 저장했어요.'); $('#entry-form').elements.amount.focus(); }
    catch (error) { $('#entry-error').textContent = error.message; $('#entry-error').hidden = false; }
  });
}

function renderHistory() {
  const categories = [...new Set(store.state.transactions.map(tx => tx.category))].sort((a, b) => a.localeCompare(b, 'ko'));
  return `<article class="card"><div class="filter-bar"><label class="filter-control">내역 검색<input id="history-search" type="search" placeholder="내역 또는 계좌 이름" value="${escape(filters.search)}"></label><label class="filter-control">구분<select id="filter-type"><option value="">전체 거래</option>${options(['expense', 'income', 'adjustment'], filters.type).replace('>expense<', '>지출<').replace('>income<', '>수입<').replace('>adjustment<', '>잔액 조정<')}</select></label><label class="filter-control">카테고리<select id="filter-category"><option value="">모든 카테고리</option>${options(categories, filters.category)}</select></label><label class="filter-control">소비 감정<select id="filter-mood"><option value="">모든 소비</option>${options(MOODS, filters.mood)}</select></label></div><div id="history-results">${renderHistoryResults()}</div></article>`;
}
function filteredTransactions() { return store.state.transactions.filter(tx => monthOf(tx.date) === selectedMonth && (!filters.type || tx.type === filters.type) && (!filters.category || tx.category === filters.category) && (!filters.mood || tx.mood === filters.mood) && (!filters.search || `${tx.name} ${accountName(tx.accountId)}`.toLocaleLowerCase('ko').includes(filters.search.toLocaleLowerCase('ko')))).sort((a, b) => b.date.localeCompare(a.date) || store.state.transactions.indexOf(b) - store.state.transactions.indexOf(a)); }
function renderHistoryResults() {
  const rows = filteredTransactions(); const pageCount = Math.max(1, Math.ceil(rows.length / 20)); historyPage = Math.min(historyPage, pageCount);
  const sumType = type => rows.filter(tx => tx.type === type).reduce((sum, tx) => sum + tx.amount, 0);
  return `<div class="history-summary"><span>검색 결과 <b>${rows.length}건</b></span><span>지출 <b>${won(sumType('expense'))}</b></span><span>수입 <b class="positive">${won(sumType('income'))}</b></span></div>${rows.length ? `<div class="table-scroll" tabindex="0" role="region" aria-label="거래 내역 표"><table><thead><tr><th scope="col">날짜</th><th scope="col">내역 / 계좌</th><th scope="col">카테고리</th><th scope="col">소비 감정</th><th scope="col" class="amount-cell">금액</th><th scope="col">관리</th></tr></thead><tbody>${rows.slice((historyPage - 1) * 20, historyPage * 20).map(tx => `<tr><td>${shortDate(tx.date)}</td><td class="detail-cell"><strong>${escape(tx.name)}</strong><div class="transaction-meta">${escape(accountName(tx.accountId))}${tx.fixedOccurrenceId ? ' · 고정비' : ''}</div></td><td>${escape(tx.category)}</td><td>${tx.mood ? `<span class="tag ${tx.mood === '낭비·후회' ? 'warning' : tx.mood === '어쩔 수 없음' ? 'muted' : ''}">${escape(tx.mood)}</span>` : '<span class="neutral">—</span>'}</td><td class="amount-cell ${tx.type === 'income' ? 'positive' : tx.type === 'adjustment' ? 'neutral' : ''}">${tx.type === 'expense' ? '−' : tx.amount > 0 ? '+' : ''}${won(tx.amount)}</td><td><div class="row-actions"><button data-action="edit-transaction" data-id="${escape(tx.id)}" aria-label="${escape(tx.name)} 수정">수정</button><button class="delete" data-action="delete-transaction" data-id="${escape(tx.id)}" aria-label="${escape(tx.name)} 삭제">삭제</button></div></td></tr>`).join('')}</tbody></table></div>${pageCount > 1 ? `<div class="pagination">${button('previous-page', '이전', 'secondary small', '', historyPage <= 1 ? 'disabled' : '')}<span>${historyPage} / ${pageCount}</span>${button('next-page', '다음', 'secondary small', '', historyPage >= pageCount ? 'disabled' : '')}</div>` : ''}` : empty('조건에 맞는 기록이 없어요', '조회 월이나 검색 조건을 바꾸거나 새로운 기록을 남겨 보세요.', 'entry', '기록 남기기')}`;
}
function bindHistoryFilters() {
  $('#history-search').addEventListener('input', event => { filters.search = event.target.value; historyPage = 1; $('#history-results').innerHTML = renderHistoryResults(); });
  for (const name of ['type', 'category', 'mood']) $(`#filter-${name}`).addEventListener('change', event => { filters[name] = event.target.value; historyPage = 1; $('#history-results').innerHTML = renderHistoryResults(); });
}

function renderAnalytics() {
  const data = summarize(store.state, selectedMonth);
  const maximum = Math.max(data.spent, data.previous, 1);
  const compareText = data.change === null ? (data.spent ? '지난달 비교 기간의 지출이 없어 증감률을 계산하지 않았어요.' : '비교할 지출 기록이 아직 없어요.') : `지난달 같은 기간보다 <strong class="${data.difference > 0 ? 'negative' : 'positive'}">${won(Math.abs(data.difference))} (${percent(Math.abs(data.change))}) ${data.difference > 0 ? '더' : data.difference < 0 ? '덜' : '같게'}</strong> 썼어요.`;
  const moodTotals = MOODS.map(mood => data.expenses.filter(tx => tx.mood === mood).reduce((sum, tx) => sum + tx.amount, 0));
  return `<section class="grid analytics-grid"><article class="card"><div class="card-header"><div><h2>지난달과 얼마나 달라졌을까요?</h2><p class="subtitle">${selectedMonth === monthOf(todayString()) ? `매월 1일~${Number(todayString().slice(8))}일, 전월은 ${Number(data.previousEnd.slice(8))}일까지 비교` : '선택한 달과 지난달 전체 기간 비교'}</p></div><span class="tag">동기간 비교</span></div><div class="comparison-values"><div><small>이번 달 지출</small><strong>${won(data.spent)}</strong></div><div><small>지난달 동기간</small><strong class="neutral">${won(data.previous)}</strong></div></div><div class="compare-bars" role="img" aria-label="이번 달 지출 ${won(data.spent)}, 지난달 동기간 지출 ${won(data.previous)}"><div class="compare-bar" style="--bar:${Math.max(4, data.previous / maximum * 110)}px"><span>${won(data.previous)}</span></div><div class="compare-bar current" style="--bar:${Math.max(4, data.spent / maximum * 110)}px"><span>${won(data.spent)}</span></div></div><div class="compare-labels"><span>지난달</span><span>이번 달</span></div><div class="change-note">${compareText}</div></article><article class="card"><div class="card-header"><div><h2>주요 지출처 TOP 5</h2><p class="subtitle">전체 지출에서 차지하는 비중</p></div><span class="tag muted">카테고리별</span></div>${data.categories.length ? `<ol class="rank-list">${data.categories.slice(0, 5).map((item, i) => `<li><div class="rank-line"><span class="rank-number">${i + 1}</span><span>${escape(item.name)}</span><strong>${won(item.amount)}</strong><small>${percent(item.ratio)}</small></div>${progress(item.ratio)}</li>`).join('')}</ol>` : empty('어디에 가장 많이 썼을까요?', '지출을 기록하면 순위를 확인할 수 있어요.')}</article><article class="card analysis-wide"><div class="card-header"><h2>이번 달 소비 속도 진단</h2>${icon('leaf')}</div><div class="diagnosis-grid"><div><h3 class="diagnosis-title">${data.variableBudget <= 0 ? '예산을 먼저 확인해 주세요.' : data.spentRatio > data.elapsedRatio ? '남은 예산을 조금 더 살펴볼까요?' : '나에게 맞는 속도로, 차곡차곡.'}</h3><p class="diagnosis-copy">${budgetDiagnosis(data)}</p></div><div><div class="budget-detail"><span>월 진행률</span><strong>${percent(data.elapsedRatio)}</strong></div>${progress(data.elapsedRatio)}<div class="budget-detail"><span>변동비 소진율</span><strong>${data.spentRatio === null ? '계산할 예산이 없어요' : percent(data.spentRatio)}</strong></div>${progress(data.spentRatio, data.spentRatio > data.elapsedRatio)}</div></div></article><article class="card analysis-wide"><div class="card-header"><div><h2>소비에 담긴 마음</h2><p class="subtitle">어떤 소비가 나에게 남았나요?</p></div>${button('waste-history', '낭비 지출 모아보기', 'secondary small')}</div><div class="mood-summary">${MOODS.map((mood, i) => `<div><small>${mood}</small><strong class="${i === 2 && moodTotals[i] ? 'negative' : ''}">${won(moodTotals[i])}</strong></div>`).join('')}</div></article></section>`;
}

function renderAccounts() {
  const state = store.state;
  const assets = state.accounts.reduce((sum, account) => sum + balance(state, account.id), 0);
  function accountCard(account) {
    const primary = account.id === state.settings.primaryAccountId;
    return `<article class="card account-card ${primary ? 'primary-account' : ''} ${account.archived ? 'archived' : ''}"><div class="account-card-top"><div class="icon-bubble">${icon('wallet')}</div>${primary ? '<span class="tag">대표 계좌</span>' : account.archived ? '<span class="tag muted">보관 중</span>' : ''}</div><h2>${escape(account.name)}</h2><div class="account-balance">${number(balance(state, account.id))}<small>원</small></div><p class="account-hint">${account.archived ? '보관한 계좌도 총 자산에 포함됩니다.' : '기록한 거래를 반영한 잔액'}</p><div class="account-card-actions">${account.archived ? button('restore-account', '계좌 복원', 'secondary small', account.id) : `<button class="text-button" data-action="edit-account" data-id="${escape(account.id)}">잔액·이름 수정</button>${!primary ? `<button class="text-button" data-action="primary-account" data-id="${escape(account.id)}">대표 지정</button>` : ''}<button class="text-button" data-action="archive-account" data-id="${escape(account.id)}">보관</button>`}</div></article>`;
  }
  return `<article class="card account-summary"><div><span class="card-label">내가 가진 총 자산</span><p>사용 중 ${state.accounts.filter(item => !item.archived).length}개 · 보관 ${state.accounts.filter(item => item.archived).length}개 계좌</p></div><strong>${won(assets)}</strong></article><div class="grid accounts-grid">${state.accounts.filter(item => !item.archived).map(accountCard).join('')}<button class="add-account-card" data-action="add-account">${icon('plus')}<strong>새로운 계좌 등록</strong><small>통장 이름과 잔액만 입력하세요.</small></button></div>${state.accounts.some(item => item.archived) ? `<h2 class="archived-heading">보관한 계좌 <span class="tag muted">기록 유지</span></h2><div class="grid accounts-grid">${state.accounts.filter(item => item.archived).map(accountCard).join('')}</div>` : ''}<p class="data-note">계좌 잔액을 직접 수정하면 조정 기록을 남깁니다. 조정 금액은 수입·지출 통계에 포함하지 않습니다.</p>`;
}

function renderFixed() {
  const data = summarize(store.state, selectedMonth);
  const paidCount = data.fixed.length - data.unpaid.length;
  const current = selectedMonth === monthOf(todayString());
  return `<div class="grid fixed-summary">${stat('이번 달 고정비', `${number(data.fixedTotal)}<small>원</small>`, `총 ${data.fixed.length}건의 예정 내역`, 'calendar')}${stat('아직 남은 고정비', `${number(data.unpaidTotal)}<small>원</small>`, `${paidCount}건 납부 완료`, 'history')}${stat('실제 가용 자산', `${number(data.availableAssets)}<small>원</small>`, '현재 총 자산 − 조회 월 미납 고정비', 'wallet')}</div><article class="card"><div class="section-toolbar"><div><h2 style="font-size:15px">매달 나가는 돈</h2><p>예정일에는 자동 출금하지 않아요. 납부한 뒤 기록해 주세요.</p></div>${current ? button('add-fixed', `${icon('plus')} 고정비 등록`, 'primary small') : ''}</div>${data.fixed.length ? `<div class="fixed-list">${[...data.fixed].sort((a, b) => a.day - b.day).map(item => {
    const tx = store.state.transactions.find(tx => tx.fixedOccurrenceId === item.id);
    const day = Math.min(item.day, daysInMonth(selectedMonth));
    const overdue = !tx && `${selectedMonth}-${String(day).padStart(2, '0')}` < todayString();
    const template = store.state.fixedExpenses.find(row => row.id === item.fixedId);
    return `<div class="fixed-item"><div class="fixed-info"><div class="due-day">${day}<small>출금 예정일</small></div><div><h3>${escape(item.name)}</h3><p>${escape(accountName(item.accountId))} · ${tx ? `${shortDate(tx.date)} 납부 완료` : overdue ? '예정일이 지났어요' : '납부 대기 중'}</p></div></div><div class="fixed-actions"><strong>${won(item.amount)}</strong>${tx ? '<span class="tag">납부 완료</span>' : button('pay-fixed', '납부 기록', 'secondary small', item.id)}${current && template?.active ? `<button class="stop-fixed" data-action="stop-fixed" data-id="${escape(item.fixedId)}">반복 중단</button>` : ''}${current && !template?.active && !tx ? `<button class="stop-fixed" data-action="cancel-fixed" data-id="${escape(item.id)}">예정 취소</button>` : ''}</div></div>`;
  }).join('')}</div>` : empty('고정비를 미리 챙겨 보세요', current ? '월세, 통신비, 구독료를 등록하고 남은 예산을 확인하세요.' : '이 달에 등록된 고정비가 없습니다.', current ? 'add-fixed' : '', '고정비 등록하기')}</article>`;
}

function renderSettings() {
  const goal = goalFor(store.state, selectedMonth);
  return `<div class="grid settings-grid"><article class="card"><div class="card-header"><div><h2>나의 목표 설정</h2><p class="subtitle">${monthLabel(selectedMonth)} 기준으로 저장합니다.</p></div>${icon('leaf')}</div><form id="settings-form"><div class="form-grid">${inputField('bookName', '가계부 이름', store.state.settings.bookName, 'text', 'maxlength="24"')}${inputField('income', '월 수입', goal.income, 'number', moneyAttrs)}${inputField('savings', '목표 저축액', goal.savings, 'number', moneyAttrs)}</div><p class="data-note">월 수입은 예산 계산의 기준입니다. 실제 수입 거래와는 별도로 관리합니다. 새 달에는 최근 월의 목표를 이어받습니다.</p><p id="settings-error" class="form-error" role="alert" hidden></p><div class="form-footer"><p>고정비는 스케줄러에서 관리합니다.</p><button class="button primary" type="submit">목표 저장하기</button></div></form></article><article class="card"><div class="card-header"><div><h2>내 기록, 안전하게 보관하기</h2><p class="subtitle">웹과 앱 사이에서도 백업 파일로 이동할 수 있어요.</p></div>${icon('shield')}</div><p class="data-note">모든 금융 기록은 현재 기기의 앱 또는 브라우저에 저장됩니다. 다른 기기나 브라우저와 자동으로 동기화되지 않습니다.</p><div class="settings-actions">${button('export', `${icon('download')} JSON 백업 내보내기`, 'secondary')}${button('import', 'JSON 백업 불러오기', 'secondary')}</div><div class="backup-warning">브라우저의 사이트 데이터나 앱 데이터를 지우면 기록을 잃을 수 있습니다. 백업 파일에는 금융 기록이 포함되므로 안전한 위치에 보관해 주세요.</div><div class="settings-section"><h3>오프라인 사용</h3><p class="data-note" id="offline-status">${location.hostname === 'appassets.androidplatform.net' ? '앱에 포함된 화면으로 인터넷 없이 사용할 수 있습니다.' : '웹은 오프라인 준비 완료 후 인터넷 없이 다시 열 수 있습니다.'}</p></div></article></div>`;
}
function bindSettings() {
  $('#settings-form').addEventListener('submit', event => {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
    try { mutate(state => { state.settings.bookName = values.bookName.trim(); ensureMonth(state, selectedMonth); state.goals[selectedMonth] = { income: Number(values.income), savings: Number(values.savings) }; }, '월별 목표를 저장했어요.'); }
    catch (error) { $('#settings-error').textContent = error.message; $('#settings-error').hidden = false; }
  });
  updateOfflineStatus();
}

function editAccount(id = null) {
  const account = store.state.accounts.find(item => item.id === id);
  showModal(account ? '계좌 이름·잔액 수정' : '새로운 계좌 등록', `<div class="form-grid">${inputField('name', '계좌 이름', account?.name || '', 'text', 'maxlength="24" placeholder="예: 생활비 통장"')}${inputField('amount', account ? '현재 잔액' : '시작 잔액', account ? balance(store.state, id) : '', 'number', `min="-${MAX_MONEY}" max="${MAX_MONEY}" step="1" inputmode="decimal"`)}</div><p class="data-note">${account ? '차액은 잔액 조정 기록으로 남기며 수입·지출에 포함하지 않습니다.' : '실제 계좌번호나 비밀번호는 입력하지 마세요.'}</p>`, form => {
    const values = Object.fromEntries(new FormData(form));
    mutate(state => account ? adjustAccount(state, id, values.name, Number(values.amount)) : addAccount(state, { name: values.name, openingBalance: Number(values.amount) }), account ? '계좌 정보를 수정했어요.' : '새 계좌를 등록했어요.');
  });
}
function editTransaction(id) {
  const tx = store.state.transactions.find(item => item.id === id); if (!tx) return;
  showModal('기록 수정', transactionFields(tx), form => { mutate(state => saveTransaction(state, Object.fromEntries(new FormData(form)), id), '기록과 계좌 잔액을 수정했어요.'); });
}
function addFixed() {
  if (!activeAccounts().length) { notify('고정비를 연결할 계좌를 먼저 등록해 주세요.'); editAccount(); return; }
  showModal('매달 나가는 고정비 등록', `<div class="form-grid">${inputField('name', '내역 이름', '', 'text', 'maxlength="60" placeholder="예: 월세, 음악 구독"')}${inputField('amount', '월 금액', '', 'number', `${moneyAttrs.replace('min="0"', 'min="1"')}`)}${inputField('day', '매월 출금 예정일', 1, 'number', 'min="1" max="31" step="1" inputmode="numeric"', '해당 날짜가 없는 달은 말일로 계산합니다.')}<label class="field"><span>출금 계좌</span><select name="accountId" required>${accountOptions(store.state.settings.primaryAccountId)}</select></label></div><p class="data-note">이번 달부터 반복됩니다. 납부 기록을 저장할 때만 계좌 잔액에 반영합니다.</p>`, form => { mutate(state => addFixedExpense(state, Object.fromEntries(new FormData(form))), '반복 고정비를 등록했어요.'); });
}
function payFixed(id) {
  const item = fixedFor(store.state, selectedMonth).find(row => row.id === id); if (!item) return;
  const max = selectedMonth === monthOf(todayString()) ? todayString() : `${selectedMonth}-${daysInMonth(selectedMonth)}`;
  showModal('고정비 납부 기록', `<p class="modal-copy"><strong>${escape(item.name)} · ${won(item.amount)}</strong><br>${escape(accountName(item.accountId))}에서 지출한 내역으로 저장합니다.</p><div style="margin-top:20px">${inputField('date', '실제 납부일', max, 'date', `min="${selectedMonth}-01" max="${max}"`)}</div>`, form => { mutate(state => payFixedExpense(state, id, selectedMonth, form.elements.date.value), '납부 내역을 기록했어요.'); }, '납부 기록하기');
}
function downloadText(text, filename) {
  if (window.AndroidFiles?.saveJson) { window.AndroidFiles.saveJson(text, filename); return; }
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 15_000);
}
function exportBackup() { downloadText(store.export(), `차곡-백업-${todayString()}.json`); notify('백업 파일 저장을 요청했어요. 저장된 파일을 확인해 주세요.'); }

const actions = {
  'entry': () => setRoute('entry'),
  'settings': () => setRoute('settings'),
  'add-account': () => editAccount(),
  'edit-account': id => editAccount(id),
  'edit-transaction': id => editTransaction(id),
  'add-fixed': () => addFixed(),
  'pay-fixed': id => payFixed(id),
  'primary-account': id => mutate(state => { if (!state.accounts.some(item => item.id === id && !item.archived)) throw new Error('사용 중인 계좌를 선택해 주세요.'); state.settings.primaryAccountId = id; }, '대표 계좌를 변경했어요.'),
  'archive-account': id => confirmAction('계좌를 보관할까요?', '거래 기록과 잔액은 유지합니다. 보관한 계좌는 새 거래 입력 목록에서 제외되며 언제든 복원할 수 있습니다.', () => mutate(state => archiveAccount(state, id), '계좌를 보관했어요.'), '보관하기'),
  'restore-account': id => mutate(state => { const account = state.accounts.find(item => item.id === id); account.archived = false; if (!state.settings.primaryAccountId) state.settings.primaryAccountId = id; }, '계좌를 복원했어요.'),
  'delete-transaction': id => { const tx = store.state.transactions.find(item => item.id === id); if (tx) confirmAction('기록을 삭제할까요?', `<strong>${escape(tx.name)} · ${won(tx.amount)}</strong><br>삭제하면 계좌 잔액과 통계를 다시 계산합니다.${tx.fixedOccurrenceId ? ' 연결된 고정비는 미납 상태로 돌아갑니다.' : ''}`, () => mutate(state => { state.transactions = state.transactions.filter(item => item.id !== id); }, '기록을 삭제했어요.'), '삭제하기', true); },
  'stop-fixed': id => confirmAction('고정비 반복을 중단할까요?', '이번 달 이후의 미납 예정 내역과 반복 등록을 중단합니다. 이미 납부한 기록과 지난달 내역은 유지합니다.', () => mutate(state => stopFixedExpense(state, id), '고정비 반복을 중단했어요.'), '반복 중단'),
  'cancel-fixed': id => confirmAction('이번 달 예정 내역을 취소할까요?', '납부하지 않은 고정비를 이번 달 예산에서 제외합니다.', () => mutate(state => { state.fixedMonths[selectedMonth] = state.fixedMonths[selectedMonth].filter(item => item.id !== id); }, '예정 내역을 취소했어요.'), '취소하기'),
  'waste-history': () => { filters = { search: '', type: 'expense', category: '', mood: '낭비·후회' }; historyPage = 1; setRoute('history'); },
  'previous-page': () => { historyPage--; $('#history-results').innerHTML = renderHistoryResults(); },
  'next-page': () => { historyPage++; $('#history-results').innerHTML = renderHistoryResults(); },
  'export': () => exportBackup(),
  'import': () => { $('#import-file').value = ''; $('#import-file').click(); },
  'reload': () => location.reload(),
};

document.addEventListener('click', event => { const target = event.target.closest('[data-action]'); if (!target || target.disabled) return; const action = actions[target.dataset.action]; if (!action) return; try { action(target.dataset.id); } catch (error) { notify(error.message); } });
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const next = link.getAttribute('href').slice(1);
  if (!owns(routes, next)) return;
  event.preventDefault();
  try { setRoute(next); } catch (error) { showFatal(error); }
});
$('#book-name').addEventListener('click', () => setRoute('settings'));
$('#modal-form').addEventListener('submit', event => { event.preventDefault(); try { modalHandler?.(event.currentTarget); closeModal(); } catch (error) { $('#modal-error').textContent = error.message; $('#modal-error').hidden = false; } });
$('#modal-close').addEventListener('click', closeModal);
$('#modal-cancel').addEventListener('click', closeModal);
$('#modal-backdrop').addEventListener('click', closeModal);
$('#modal').addEventListener('click', event => { if (event.target !== $('#modal')) return; const rect = $('#modal').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeModal(); });
$('#month-picker').addEventListener('change', event => { const month = event.target.value; if (!isMonth(month) || month > monthOf(todayString())) { event.target.value = selectedMonth; return; } selectedMonth = month; historyPage = 1; render(); });
$('#menu-toggle').addEventListener('click', () => { const open = document.body.classList.toggle('sidebar-open'); $('#sidebar').inert = !open; $('#menu-toggle').setAttribute('aria-expanded', String(open)); $('#menu-toggle').setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기'); if (open) $('#navigation a.active')?.focus(); });
$('#sidebar-scrim').addEventListener('click', () => { closeSidebar(); $('#menu-toggle').focus(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.body.classList.contains('sidebar-open')) { closeSidebar(); $('#menu-toggle').focus(); } });
document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); $('#main').focus(); });
window.addEventListener('resize', () => { if (window.innerWidth >= 1024) { document.body.classList.remove('sidebar-open'); $('#sidebar').inert = false; $('#menu-toggle').setAttribute('aria-expanded', 'false'); } else if (!document.body.classList.contains('sidebar-open')) $('#sidebar').inert = true; });
window.addEventListener('hashchange', () => { route = routes[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard'; closeSidebar(); try { render(); } catch (error) { showFatal(error); } $('#main').focus(); window.scrollTo(0, 0); });
window.addEventListener('storage', event => { if (event.key !== STORAGE_KEY && event.key !== null) return; $('#notice-bar').innerHTML = '다른 탭에서 기록이 변경되었습니다. 입력 중인 내용을 확인한 뒤 새로고침해 주세요. <button id="reload-data">새로고침</button>'; $('#notice-bar').hidden = false; $('#reload-data').addEventListener('click', () => location.reload()); });
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('10MB 이하의 백업 파일을 선택해 주세요.');
    const data = parseBackup(await file.text());
    confirmAction('백업으로 기록을 교체할까요?', `<strong>${escape(data.settings.bookName)}</strong><br>계좌 ${data.accounts.length}개 · 거래 ${data.transactions.length}건<br>현재 기록을 백업 내용으로 교체합니다. 필요한 경우 취소하고 현재 기록을 먼저 내보내세요.`, () => { store.replace(data); fatal = false; route = 'dashboard'; selectedMonth = monthOf(todayString()); render(); $('#notice-bar').hidden = true; notify('백업 기록을 불러왔어요.'); }, '교체하기', true);
  } catch (error) { notify(error.message); }
});

function showFatal(error) {
  fatal = true;
  $('#view').innerHTML = `<article class="card fatal-card"><div class="icon-bubble">${icon('shield')}</div><h2>선택한 화면을 표시하지 못했어요.</h2><p>다른 메뉴를 선택하거나 앱을 다시 시작해 주세요. 시작할 때 백업 파일은 필요하지 않습니다.</p><p class="negative">${escape(error.message)}</p>${button('reload', '다시 시작', 'secondary')}</article>`;
}
function showStorageIssue() {
  $('#notice-bar').hidden = false;
  $('#notice-bar').innerHTML = `<strong>기기 저장소를 확인해 주세요.</strong> ${escape(store.error.message)} ${button('reload', '다시 시작', 'secondary small')}`;
}
async function updateOfflineStatus() {
  if (!$('#offline-status') || !('serviceWorker' in navigator) || location.hostname === 'appassets.androidplatform.net') return;
  try { const registration = await navigator.serviceWorker.getRegistration(); if ($('#offline-status')) $('#offline-status').textContent = registration?.active ? '오프라인 준비가 완료되었습니다. 같은 주소로 다시 열 수 있습니다.' : '오프라인 사용을 준비하고 있습니다. 첫 접속에는 인터넷이 필요합니다.'; } catch { /* 저장 기능에는 영향을 주지 않는다. */ }
}
async function registerOffline() {
  if (!('serviceWorker' in navigator) || location.hostname === 'appassets.androidplatform.net') return;
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    updateOfflineStatus();
    if (!sessionStorage.getItem('chagok-offline-ready')) { sessionStorage.setItem('chagok-offline-ready', '1'); notify('오프라인 준비가 완료되었어요.'); }
    registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) notify('새 버전이 준비되었어요. 입력을 저장한 뒤 창을 모두 닫고 다시 열어 주세요.'); }); });
  } catch { if ($('#offline-status')) $('#offline-status').textContent = '오프라인 준비에 실패했습니다. 인터넷 연결 상태에서 다시 열어 주세요.'; }
}
function initialize() {
  try {
    store = createStore();
    // 이전 테스트 기록과 분리한 현재 가계부만 연다. 첫 사용은 계좌 등록 화면이다.
    store.load();
    ensureMonth(store.state, monthOf(todayString()));
    if (!store.hasSavedData) route = 'accounts';
    setRoute(route);
    window.ChagokStartup?.ready();
    registerOffline();
  } catch (error) { showFatal(error); }
}
document.addEventListener('keydown', event => {
  if (!$('#modal').classList.contains('modal-fallback') || !$('#modal').hasAttribute('open')) return;
  if (event.key === 'Escape') { event.preventDefault(); closeModal(); }
  if (event.key !== 'Tab') return;
  const focusable = Array.from($('#modal').querySelectorAll('button:not([disabled]),input:not([type=hidden]),select,a[href]')).filter(element => element.getClientRects().length);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || fatal || lastDate === todayString()) return;
  const previous = lastDate; lastDate = todayString();
  if (selectedMonth === monthOf(previous)) selectedMonth = monthOf(lastDate);
  try { mutate(() => {}, '날짜가 변경되어 오늘 예산을 갱신했어요.'); } catch (error) { notify(error.message); }
});
initialize();
