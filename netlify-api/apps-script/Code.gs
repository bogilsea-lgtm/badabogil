/**
 * 바다보길 주문 시트 (Google Apps Script)
 * - Netlify 의 order.js / confirm.js 가 이 웹앱으로 주문을 보냅니다.
 * - create : 결제창을 열기 전, 주문자·배송 정보를 '결제대기'로 저장
 * - paid   : 토스 결제 승인 후, '결제완료'로 바꾸고 대표에게 메일 발송
 *
 * 설정은 [프로젝트 설정 > 스크립트 속성]에 넣습니다. 코드에 직접 쓰지 마세요.
 *   TOKEN        : 임의의 긴 문자열 (Netlify 의 ORDER_HOOK_TOKEN 과 같은 값)
 *   OWNER_EMAIL  : 주문 알림을 받을 메일 주소
 */

var SHEET_NAME = '주문';
var HEAD = ['접수시각', '주문번호', '상태', '주문자', '주문자 휴대폰', '이메일', '받는 분', '받는 분 휴대폰',
  '우편번호', '주소', '상세주소', '요청사항', '수량', '결제금액', '승인시각', '결제키',
  '택배사', '운송장번호', '처리메모', '발송 안내 문자(복사용)'];
var STATUS = ['결제대기', '결제완료', '발송준비', '발송완료', '취소·환불'];
var COL = {}; HEAD.forEach(function (h, i) { COL[h] = i + 1; });

/** 처음 한 번만 직접 실행합니다. 시트 머리글·상태 선택 목록·서식을 만듭니다. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold').setBackground('#e1ebe8');
  sh.setFrozenRows(1);
  sh.setFrozenColumns(3);
  var n = sh.getMaxRows() - 1;
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUS, true).setAllowInvalid(false).build();
  sh.getRange(2, COL['상태'], n, 1).setDataValidation(rule);
  // 전화번호·우편번호·결제키·운송장은 숫자로 바뀌어 앞의 0이 사라지지 않게 글자로 둡니다.
  ['주문자 휴대폰', '받는 분 휴대폰', '우편번호', '결제키', '운송장번호', '주문번호'].forEach(function (h) {
    sh.getRange(2, COL[h], n, 1).setNumberFormat('@');
  });
  var cf = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$C2="결제완료"').setBackground('#fff3cd').setRanges([sh.getRange(2, 1, n, HEAD.length)]).build();
  var cf2 = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$C2="결제대기"').setFontColor('#9aa5a3').setRanges([sh.getRange(2, 1, n, HEAD.length)]).build();
  sh.setConditionalFormatRules([cf, cf2]);
  sh.setColumnWidth(COL['주소'], 280);
  sh.setColumnWidth(COL['처리메모'], 220);
  sh.setColumnWidth(COL['발송 안내 문자(복사용)'], 360);
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// 시트 수식으로 해석되지 않게 =,+,-,@ 로 시작하는 입력 앞에 ' 를 붙입니다.
function safe(v) {
  v = v == null ? '' : String(v);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function findRow(sh, orderId) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, COL['주문번호'], last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === orderId) return i + 2;
  return 0;
}

function nextRow(sh) {
  var vals = sh.getRange(1, COL['주문번호'], sh.getMaxRows(), 1).getValues();
  var n = 0;
  for (var i = 0; i < vals.length; i++) if (vals[i][0] !== '') n = i + 1;
  if (n + 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 200);
  return n + 1;
}

function textFormula(row) {
  var c = function (h) { return columnLetter(COL[h]) + row; };
  return '=IF(OR(' + c('택배사') + '="",' + c('운송장번호') + '=""),"",' +
    c('받는 분') + '&"님, 바다보길입니다. 주문하신 활전복을 보냈습니다. ' +
    '"&' + c('택배사') + '&" 운송장 "&' + c('운송장번호') + '&" 입니다. 받으시면 바로 확인해 주세요.")';
}

function columnLetter(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  var token = props.getProperty('TOKEN');
  if (!token || b.token !== token) return out({ ok: false, error: 'forbidden' });

  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sh) return out({ ok: false, error: '주문 시트가 없습니다. setup()을 먼저 실행하세요.' });
    if (!/^BDBG-[a-z0-9-]+$/i.test(String(b.orderId || ''))) return out({ ok: false, error: 'bad orderId' });

    if (b.action === 'create') return out(create_(sh, b));
    if (b.action === 'paid') return out(paid_(sh, b, props));
    return out({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function create_(sh, b) {
  var row = findRow(sh, b.orderId);
  if (row) return { ok: true, duplicate: true }; // 같은 주문번호를 두 번 받아도 한 줄만
  row = nextRow(sh);
  var v = [
    new Date(), b.orderId, '결제대기', safe(b.bName), safe(b.bTel), safe(b.bMail), safe(b.rName), safe(b.rTel),
    safe(b.rZip), safe(b.rAddr), safe(b.rAddr2), safe(b.rMemo), Number(b.qty) || '', Number(b.amount) || '',
    '', '', '', '', '', ''
  ];
  sh.getRange(row, 1, 1, v.length).setValues([v]);
  sh.getRange(row, COL['접수시각']).setNumberFormat('yyyy-mm-dd hh:mm');
  sh.getRange(row, COL['발송 안내 문자(복사용)']).setFormula(textFormula(row));
  return { ok: true, row: row };
}

function paid_(sh, b, props) {
  var row = findRow(sh, b.orderId);
  var memo = '';
  if (!row) { // 주문 저장이 빠졌지만 결제는 된 경우: 최소한 줄은 남깁니다.
    row = nextRow(sh);
    sh.getRange(row, COL['접수시각']).setValue(new Date()).setNumberFormat('yyyy-mm-dd hh:mm');
    sh.getRange(row, COL['주문번호']).setValue(b.orderId);
    sh.getRange(row, COL['발송 안내 문자(복사용)']).setFormula(textFormula(row));
    memo = '주문 정보가 저장되지 않았습니다. 토스 결제내역에서 구매자 정보를 확인하세요. ';
  }
  var expected = Number(sh.getRange(row, COL['결제금액']).getValue());
  var paidAmt = Number(b.amount);
  if (expected && expected !== paidAmt) memo += '결제금액 불일치: 주문 ' + expected + ' / 결제 ' + paidAmt + '. ';

  var statusCell = sh.getRange(row, COL['상태']);
  var already = statusCell.getValue() === '결제완료' || statusCell.getValue() === '발송준비' || statusCell.getValue() === '발송완료';
  statusCell.setValue('결제완료');
  sh.getRange(row, COL['결제금액']).setValue(paidAmt);
  sh.getRange(row, COL['승인시각']).setValue(safe(b.approvedAt));
  sh.getRange(row, COL['결제키']).setValue(safe(b.paymentKey));
  if (memo) sh.getRange(row, COL['처리메모']).setValue(memo.trim());

  if (!already) notify_(sh, row, props.getProperty('OWNER_EMAIL'));
  return { ok: true, row: row };
}

function notify_(sh, row, to) {
  if (!to) return;
  var g = function (h) { return sh.getRange(row, COL[h]).getDisplayValue(); };
  var subject = '[바다보길 주문] ' + g('받는 분') + ' · ' + g('수량') + '개 · ' + g('결제금액') + '원';
  var body = [
    '새 주문이 결제되었습니다. 발송 준비 후 시트의 상태를 바꿔 주세요.', '',
    '주문번호: ' + g('주문번호'),
    '결제금액: ' + g('결제금액') + '원 (수량 ' + g('수량') + ')',
    '',
    '[주문자] ' + g('주문자') + ' / ' + g('주문자 휴대폰') + ' / ' + g('이메일'),
    '[받는 분] ' + g('받는 분') + ' / ' + g('받는 분 휴대폰'),
    '[주소] (' + g('우편번호') + ') ' + g('주소') + ' ' + g('상세주소'),
    '[요청사항] ' + (g('요청사항') || '없음'),
    '',
    '주문 시트: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
  ].join('\n');
  MailApp.sendEmail({ to: to, subject: subject, body: body, name: '바다보길 주문 알림' });
}

/** 설정 확인용: 스크립트에서 직접 실행하면 시트 맨 아래에 시험 주문이 들어가고 메일이 옵니다. */
function selfTest() {
  var id = 'BDBG-test-' + Date.now().toString(36);
  var props = PropertiesService.getScriptProperties();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  create_(sh, { orderId: id, qty: 1, amount: 38000, bName: '시험', bTel: '01000000000', bMail: 'test@example.com',
    rName: '시험', rTel: '01000000000', rZip: '12345', rAddr: '시험 주소', rAddr2: '', rMemo: '시험 주문입니다' });
  paid_(sh, { orderId: id, amount: 38000, approvedAt: new Date().toISOString(), paymentKey: 'test' }, props);
}
