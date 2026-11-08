/* 시작 코드 자체는 구형 WebView에서도 읽을 수 있는 문법을 사용한다. */
(function () {
  'use strict';
  var started = false;
  var problem = null;
  function showProblem(message) {
    problem = message;
    var notice = document.getElementById('notice-bar');
    if (!notice) return;
    notice.hidden = false;
    notice.innerHTML = '<strong>화면을 시작하지 못했습니다.</strong> <span id="startup-detail"></span> <button type="button" data-boot-action="reload">다시 시작</button>';
    document.getElementById('startup-detail').textContent = message;
    var welcome = document.getElementById('startup-message');
    if (welcome) welcome.textContent = '상단의 오류 내용을 확인하고 다시 시작해 주세요. 기존 기록은 변경하지 않았습니다.';
  }
  window.ChagokStartup = { ready: function () { started = true; }, fail: showProblem };
  window.addEventListener('error', function (event) {
    if (started) return;
    var target = event.target;
    var file = target && target.getAttribute ? target.getAttribute('src') : '';
    showProblem(event.message || (file ? '실행 파일을 읽지 못했습니다: ' + file : '실행 코드를 처리하지 못했습니다.'));
  }, true);
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (target && target.getAttribute && target.getAttribute('data-boot-action') === 'reload') window.location.reload();
  });
  document.addEventListener('DOMContentLoaded', function () { if (problem) showProblem(problem); });
  window.setTimeout(function () {
    if (!started && !problem) showProblem('실행 파일이 시작되지 않았습니다. 앱 버전 1.0.4 이상의 APK를 설치해 주세요.');
  }, 8000);
}());
