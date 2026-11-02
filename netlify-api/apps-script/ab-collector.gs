/**
 * 바다보길 A/B 수집기 (Google Apps Script) — 주문 시트와 별개의 새 구글 시트에 붙입니다.
 * 방문자가 보낸 view / cta / pick 이벤트를 '이벤트' 시트에 쌓고, 요약() 이 변형별 전환율을 계산합니다.
 *
 * 설치: 새 구글 시트 > 확장 프로그램 > Apps Script > 이 코드 붙여넣기 > setup 한 번 실행
 *   > 배포 > 새 배포 > 웹 앱 (실행: 나 / 액세스: 모든 사용자) > 웹 앱 URL 을 /new/index.html 의 AB.endpoint 에 넣기.
 * 이 주소는 페이지 소스에 공개됩니다. 그래서 비밀이 아니고, 아래에서 형식·길이만 걸러 저장합니다.
 */
var EV = '이벤트', HEAD = ['받은시각', '시각(브라우저)', '이벤트', '변형', '세션', '유입(src)', '위치', '경로'];

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(EV) || ss.insertSheet(EV);
  sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
  sh.setFrozenRows(1);
}

function clip(v, n) { v = v == null ? '' : String(v).slice(0, n); return /^[=+\-@]/.test(v) ? "'" + v : v; }

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (['view', 'cta', 'pick'].indexOf(d.e) < 0 || ['A', 'B'].indexOf(d.v) < 0) return ContentService.createTextOutput('ignored');
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EV);
    sh.appendRow([new Date(), clip(d.t, 30), d.e, d.v, clip(d.sid, 12), clip(d.src, 24), clip(d.loc, 40), clip(d.p, 60)]);
  } catch (err) {}
  return ContentService.createTextOutput('ok');
}

/** 변형별 방문(세션)·주문서 클릭(세션)·전환율을 '요약' 시트에 씁니다. 직접 실행하세요. */
function 요약() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), rows = ss.getSheetByName(EV).getDataRange().getValues().slice(1);
  var t = { A: { view: {}, cta: {}, pick: {} }, B: { view: {}, cta: {}, pick: {} } };
  rows.forEach(function (r) { if (t[r[3]] && t[r[3]][r[2]]) t[r[3]][r[2]][r[4]] = 1; });
  var out = [['변형', '방문 세션', '주문서 클릭 세션', '클릭률', '크기 도우미 사용 세션']];
  ['A', 'B'].forEach(function (k) {
    var v = Object.keys(t[k].view).length, c = Object.keys(t[k].cta).length, p = Object.keys(t[k].pick).length;
    out.push([k, v, c, v ? c / v : 0, p]);
  });
  var sh = ss.getSheetByName('요약') || ss.insertSheet('요약');
  sh.clear(); sh.getRange(1, 1, out.length, 5).setValues(out);
  sh.getRange(2, 4, 2, 1).setNumberFormat('0.0%');
}
