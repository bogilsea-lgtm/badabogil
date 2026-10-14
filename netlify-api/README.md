# 바다보길 결제 승인 함수 (Netlify)
1. Netlify에서 이 저장소로 새 사이트를 만들고 Base directory 를 `netlify-api` 로 지정합니다.
2. Site settings > Environment variables 에 `TOSS_SECRET_KEY` = 토스 개발자센터의 **테스트 시크릿 키(test_sk_...)** 를 넣습니다.
3. 배포 후 주소(예: https://xxxx.netlify.app/.netlify/functions/confirm)를 `shop.js` 의 `CONFIRM_URL` 에 넣습니다.
4. 실제 판매 시작 때 시크릿 키를 live_sk_ 로, `shop.js` 클라이언트 키를 live_ck_ 로 바꿉니다.
