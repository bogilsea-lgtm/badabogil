# 바다보길 결제 승인 함수 (Netlify)
1. Netlify에서 이 저장소로 새 사이트를 만들고 Base directory 를 `netlify-api` 로 지정합니다.
2. Site settings > Environment variables 에 `TOSS_SECRET_KEY` = 토스 개발자센터의 **테스트 시크릿 키(test_sk_...)** 를 넣습니다.
3. 배포 후 주소(예: https://xxxx.netlify.app/.netlify/functions/confirm)를 `shop.js` 의 `CONFIRM_URL` 에 넣습니다.
4. 실제 판매 시작 때 시크릿 키를 live_sk_ 로, `shop.js` 클라이언트 키를 live_ck_ 로 바꿉니다.

## 주문 저장·알림 (order.js + 구글 시트)

흐름: 주문서 → `order.js`(결제대기로 시트에 저장) → 토스 결제창 → `confirm.js`(결제 승인 후 시트를 결제완료로, 대표 메일 발송).

1. 구글 시트를 새로 만들고 **확장 프로그램 > Apps Script** 를 엽니다.
2. `apps-script/Code.gs` 내용을 붙여 넣고 저장한 뒤, 함수 `setup` 을 한 번 실행합니다(권한 허용).
3. **프로젝트 설정 > 스크립트 속성**에 `TOKEN`(임의의 긴 문자열), `OWNER_EMAIL`(알림 받을 메일)을 넣습니다.
4. **배포 > 새 배포 > 웹 앱**: 실행 사용자 "나", 액세스 "모든 사용자". 나오는 웹 앱 URL을 복사합니다.
5. Netlify 환경변수에 추가 후 재배포: `ORDER_HOOK_URL`(웹 앱 URL), `ORDER_HOOK_TOKEN`(위 TOKEN과 같은 값, Contains secret values 체크, Functions 포함).
6. Apps Script에서 `selfTest` 를 실행해 시트에 시험 줄과 메일이 오는지 확인합니다.

코드를 고쳐 Apps Script를 다시 배포할 때는 **새 버전**으로 배포해야 반영됩니다.
