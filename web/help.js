const go = (route, title) => `<a class="button secondary" href="#${route}">${title}<svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></a>`;

export function renderUsageGuide() {
  return `<section class="guide-intro card">
    <div><p class="eyebrow">처음 사용하는 분을 위한 안내</p><h2>은행 이름부터, 차근차근.</h2><p>차곡은 내가 직접 수입과 지출을 적는 가계부입니다. 로그인이나 금융 연동 없이 은행 이름과 잔액을 등록하면 시작할 수 있어요.</p></div>
    <div class="guide-actions">${go('accounts', '첫 은행 등록하기')}${go('entry', '수입·지출 기록하기')}</div>
  </section>
  <section class="guide-grid" aria-label="처음 시작하는 순서">
    <article class="card guide-step"><span class="guide-number" aria-label="첫 번째 단계">01</span><h2>어떤 은행인가요?</h2><p><strong>내 계좌 모음</strong>에서 은행 이름과 현재 잔액을 입력하세요.</p><div class="guide-example"><span>은행 이름 입력 예시</span><strong>국민은행 · 농협은행 · 카카오뱅크</strong><p>‘생활비 통장’ 같은 사용 목적 대신 은행 이름을 적습니다. 계좌번호와 비밀번호는 필요하지 않습니다.</p></div><p>같은 은행의 계좌도 여러 개 등록할 수 있습니다. 같은 이름은 ‘국민은행 · 1번’, ‘국민은행 · 2번’처럼 구분합니다.</p>${go('accounts', '내 계좌 모음 열기')}</article>
    <article class="card guide-step"><span class="guide-number" aria-label="두 번째 단계">02</span><h2>이번 달 목표를 정하세요.</h2><p><strong>설정 및 데이터 관리</strong>에서 월 수입과 목표 저축액을 입력하세요. 메인의 오늘 예산을 계산할 때 사용하는 기준입니다.</p><p>실제로 들어온 돈은 ‘돈 쓰기 / 벌기’에 수입으로 따로 기록합니다. 목표에 적은 월 수입이 계좌 잔액에 자동으로 더해지지는 않습니다.</p><div class="guide-example"><span>기준 구분</span><p><strong>월 수입 설정</strong>은 예산 계획이고, <strong>수입 기록</strong>은 실제 입금 내역입니다.</p></div>${go('settings', '월 목표 설정하기')}</article>
    <article class="card guide-step"><span class="guide-number" aria-label="세 번째 단계">03</span><h2>매달 나가는 돈을 등록하세요.</h2><p><strong>고정비 스케줄러</strong>에 월세, 통신비, 구독료와 출금 예정일, 연결할 은행을 입력하세요.</p><p>예정일만으로 잔액을 차감하지 않습니다. 실제로 납부한 뒤 <strong>납부 기록</strong>을 누르면 지출과 계좌 잔액에 반영합니다.</p><div class="guide-example"><span>고정비와 예산</span><p>고정비는 월 예산에서 미리 확보합니다. 납부할 때 오늘의 변동비 예산에서 다시 차감하지 않습니다.</p></div>${go('fixed', '고정비 등록하기')}</article>
    <article class="card guide-step"><span class="guide-number" aria-label="네 번째 단계">04</span><h2>오늘의 수입과 지출을 적으세요.</h2><p><strong>돈 쓰기 / 벌기</strong>에서 구분, 금액, 은행, 날짜, 카테고리와 내역을 입력한 뒤 기록을 저장하세요.</p><p>지출은 선택한 계좌 잔액에서 빠지고 수입은 더해집니다. 지출에는 ‘가치소비’, ‘어쩔 수 없음’, ‘낭비·후회’ 중 하나를 선택합니다.</p><div class="guide-example"><span>입력 예시이며 실제 기록으로 저장되지 않습니다</span><p>지출 8,000원 · 국민은행 · 식비 · 점심 · 가치소비</p></div>${go('entry', '기록 입력하기')}</article>
    <article class="card guide-step"><span class="guide-number" aria-label="다섯 번째 단계">05</span><h2>기록을 살펴보고 고치세요.</h2><p><strong>내역 보기</strong>에서 조회 월을 선택하고 내역이나 은행 이름을 검색하세요. 카테고리와 감정 태그로도 걸러볼 수 있습니다.</p><p>잘못 입력한 거래는 수정하거나 삭제할 수 있습니다. 연결된 계좌 잔액과 통계도 함께 다시 계산합니다.</p><p>은행의 현재 잔액을 직접 수정하면 ‘잔액 조정’ 기록으로 남기고, 수입·지출 통계에는 포함하지 않습니다.</p>${go('history', '내역 확인하기')}</article>
    <article class="card guide-step"><span class="guide-number" aria-label="여섯 번째 단계">06</span><h2>소비 습관을 돌아보세요.</h2><p><strong>메인</strong>에서 총 자산과 오늘 남은 예산을 확인하세요. 오늘의 권장 예산에서 오늘 쓴 변동비를 뺀 금액을 안내합니다.</p><p><strong>지출 분석</strong>에서는 전월 같은 기간과 비교하고, 카테고리별 상위 지출 5개와 소비 속도를 확인할 수 있습니다.</p><p>기록이 없거나 지난달 지출이 0원이면 비교할 수 있는 자료가 없다고 표시합니다. 오류가 아닙니다.</p>${go('analytics', '지출 분석 열기')}</article>
  </section>
  <section class="card guide-faq"><div class="card-header"><h2>자주 묻는 질문</h2></div>
    <details><summary>처음부터 백업 파일이 필요한가요?</summary><p>필요하지 않습니다. 은행을 등록하고 새 가계부로 바로 시작하세요. 백업 파일 불러오기는 설정에서 사용자가 선택할 때만 동작합니다.</p></details>
    <details><summary>은행 잔액이 자동으로 연동되나요?</summary><p>연동되지 않습니다. 최초 잔액은 직접 입력하고, 이후 차곡에 기록한 거래를 반영합니다. 실제 잔액과 다르면 내 계좌 모음에서 현재 잔액을 수정하세요.</p></details>
    <details><summary>같은 은행의 계좌를 여러 개 등록해도 되나요?</summary><p>가능합니다. 같은 은행 이름과 각 계좌의 잔액을 등록하면 순서 번호로 구분합니다. 보관한 계좌도 번호와 총 자산 계산에 포함됩니다.</p></details>
    <details><summary>앱을 다시 열면 기록이 없어지나요?</summary><p>저장에 성공한 기록은 다음 실행에도 유지합니다. 앱을 삭제하거나 앱 데이터를 지우면 기록도 삭제됩니다. 기존 앱 위에 업데이트하는 것과 삭제 후 재설치는 다릅니다.</p></details>
    <details><summary>PC와 태블릿의 기록이 자동으로 같아지나요?</summary><p>자동 동기화하지 않습니다. 각 기기와 브라우저에 따로 저장합니다. 필요할 때 설정의 JSON 파일 기능으로 기록을 옮길 수 있습니다.</p></details>
    <details><summary>인터넷이 없어도 사용할 수 있나요?</summary><p>Android 앱은 화면 파일을 포함하므로 인터넷 없이 사용합니다. 웹은 첫 접속 후 오프라인 준비가 완료되어야 같은 주소로 다시 열 수 있습니다.</p></details>
  </section>`;
}
