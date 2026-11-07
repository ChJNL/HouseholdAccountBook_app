(() => {
  window.__smokeResult = 'pending';
  (async () => {
    const { createState, addAccount, saveTransaction, addFixedExpense, payFixedExpense, todayString, monthOf, validateState } = await import('/assets/core.js');
    const key = 'household-book:v1';
    const original = localStorage.getItem(key);
    let frame;
    let checks = 0;
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const assert = (value, message) => { if (!value) throw new Error(message); checks++; };
    const until = async (predicate, message) => { for (let i = 0; i < 100; i++) { if (predicate()) return; await wait(50); } throw new Error(message); };
    try {
      const date = todayString(), month = monthOf(date);
      const state = createState();
      state.goals[month] = { income: 3_000_000, savings: 1_000_000 };
      const account = addAccount(state, { name: '생활비 통장', openingBalance: 1_000_000 });
      addAccount(state, { name: '비상금', openingBalance: 200_000 });
      for (const [i, category] of ['식비', '교통', '생활·쇼핑', '카페·간식', '문화·여가', '건강'].entries()) saveTransaction(state, { type: 'expense', accountId: account.id, amount: (i + 1) * 1000, date, name: `검증 ${category}`, category, mood: i % 2 ? '낭비·후회' : '가치소비' });
      saveTransaction(state, { type: 'income', accountId: account.id, amount: 100_000, date, name: '추가 수입', category: '부수입' });
      const fixed = addFixedExpense(state, { name: '통신비', amount: 50_000, day: 1, accountId: account.id });
      payFixedExpense(state, `${fixed.id}:${month}`, month);
      validateState(state); localStorage.setItem(key, JSON.stringify(state));
      frame = document.createElement('iframe'); frame.src = '/assets/index.html#dashboard'; frame.style.cssText = 'position:absolute;left:0;top:0;width:1440px;height:1000px;border:0;background:white;z-index:9999'; document.body.append(frame);
      await until(() => frame.contentDocument?.querySelector('.hero'), '메인 화면 초기화 실패');
      const win = frame.contentWindow, doc = frame.contentDocument;
      const runtimeErrors = [];
      win.addEventListener('error', event => runtimeErrors.push(event.message));
      win.addEventListener('unhandledrejection', event => runtimeErrors.push(String(event.reason)));
      assert(doc.querySelector('.asset-total').textContent.includes('1,229,000'), '총 자산 표시 오류');
      assert(win.getComputedStyle(doc.querySelector('.account-spotlight')).backgroundColor === 'rgb(23, 62, 53)', '대표 자산 카드 배경 오류');
      for (const width of [1440, 1280, 1024, 820, 768, 600, 375]) {
        frame.style.width = `${width}px`; await wait(100);
        for (const route of ['dashboard', 'entry', 'history', 'analytics', 'accounts', 'fixed', 'settings']) {
          win.location.hash = route;
          await until(() => doc.querySelector('#breadcrumb-page').textContent === ({ dashboard: '메인', entry: '돈 쓰기 / 벌기', history: '내역 보기', analytics: '지출 분석', accounts: '내 계좌 모음', fixed: '고정비 스케줄러', settings: '설정 및 데이터 관리' })[route], `${width}px ${route} 화면 전환 실패`);
          await wait(35);
          assert(doc.documentElement.scrollWidth <= win.innerWidth + 1, `${width}px ${route} 본문 가로 넘침: ${doc.documentElement.scrollWidth}/${win.innerWidth}`);
          assert(doc.querySelector('#view').textContent.length > 20, `${route} 화면 내용 누락`);
        }
      }
      frame.style.width = '820px'; win.location.hash = 'accounts';
      await until(() => doc.querySelector('.add-account-card'), '계좌 화면 실패');
      doc.querySelector('.add-account-card').click();
      assert(doc.querySelector('#modal').open, '계좌 등록 창 열기 실패');
      doc.querySelector('#modal-form').elements.name.value = '검증 계좌';
      doc.querySelector('#modal-form').elements.amount.value = '30000';
      doc.querySelector('#modal-form').requestSubmit();
      assert(!doc.querySelector('#modal').open, '계좌 등록 실패');
      assert(JSON.parse(localStorage.getItem(key)).accounts.length === 3, '계좌 저장 실패');
      win.location.hash = 'entry'; await until(() => doc.querySelector('#entry-form'), '거래 입력 화면 실패');
      const form = doc.querySelector('#entry-form'); form.elements.amount.value = '1234'; form.elements.name.value = '실제 입력 검증'; form.requestSubmit();
      assert(JSON.parse(localStorage.getItem(key)).transactions.some(tx => tx.name === '실제 입력 검증' && tx.amount === 1234), '입력 폼 저장 실패');
      win.location.hash = 'history'; await until(() => doc.querySelector('#history-search'), '거래 내역 화면 실패');
      const search = doc.querySelector('#history-search'); search.value = '실제 입력 검증'; search.dispatchEvent(new win.Event('input', { bubbles: true }));
      assert(doc.querySelectorAll('tbody tr').length === 1, '검색 결과 오류');
      doc.querySelector('[data-action="edit-transaction"]').click(); doc.querySelector('#modal-form').elements.amount.value = '2000'; doc.querySelector('#modal-form').requestSubmit();
      assert(JSON.parse(localStorage.getItem(key)).transactions.some(tx => tx.name === '실제 입력 검증' && tx.amount === 2000), '거래 수정 저장 실패');
      doc.querySelector('[data-action="delete-transaction"]').click(); doc.querySelector('#modal-form').requestSubmit();
      assert(!JSON.parse(localStorage.getItem(key)).transactions.some(tx => tx.name === '실제 입력 검증'), '거래 삭제 실패');
      const saved = localStorage.getItem(key);
      frame.src = '/assets/index.html#accounts'; await wait(200); await until(() => frame.contentDocument?.querySelector('.account-card'), '앱 화면 재실행 실패');
      assert(localStorage.getItem(key) === saved, '재실행 후 저장 내용 변경');
      assert(frame.contentDocument.body.textContent.includes('검증 계좌'), '재실행 후 계좌 누락');
      assert(runtimeErrors.length === 0, `실행 오류: ${runtimeErrors.join(', ')}`);
      window.__smokeResult = `통과: 실제 WebView ${checks}개 검증, 7개 너비 × 7개 화면, 계좌 등록·거래 입력·수정·삭제·검색·재실행 보존`;
    } finally {
      frame?.remove();
      if (original === null) localStorage.removeItem(key); else localStorage.setItem(key, original);
    }
  })().catch(error => { window.__smokeResult = `실패: ${error.stack || error.message}`; });
})();
