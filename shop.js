/* 바다보길 상품·주문 공통 설정과 계산. 상품·가격·배송비는 이 파일 한 곳에서만 바꾼다. */
(function (w) {
  'use strict';

  var CONFIG = {
    // 토스페이먼츠 클라이언트 키(결제창 연동용 test_ck_ 키). 개발자센터의 본인 테스트 키로 교체하세요.
    // 아래 값은 토스 공개 문서 예제 키로 기억해 둔 것이며 직접 확인하지 못했습니다.
    // 실제 판매 전에는 라이브 키(live_ck_)로 바꾸고, 결제 승인 서버를 연결해야 합니다.
    TOSS_CLIENT_KEY: 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq',
    // 결제 승인 서버 함수 주소(netlify-api/README.md 참고). 비어 있으면 승인 호출을 하지 않습니다.
    CONFIRM_URL: '',
    TEST_MODE: true, // true면 주문서에 "결제 테스트 단계" 안내를 보여 줍니다. 실제 판매 시작 때 false.
    PRODUCT: {
      id: 'live-9-10',
      name: '활전복 9~10미(대) 1kg',
      unit: '1kg',
      kgPerUnit: 1,
      price: 35000, // 원. 가격표(badabogil_price_table.html)의 9~10미 1kg 값
      image: '/img/product-live-9-10.jpg',
      maxQty: 10
    },
    SHIPPING_FEE: 3000,
    FREE_SHIPPING_KG: 4
  };

  function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }

  function clampQty(q) {
    q = parseInt(q, 10);
    if (!isFinite(q) || q < 1) q = 1;
    if (q > CONFIG.PRODUCT.maxQty) q = CONFIG.PRODUCT.maxQty;
    return q;
  }

  // 배송비: 기본 3,000원, 4kg 이상은 무료
  function calc(qty) {
    qty = clampQty(qty);
    var kg = qty * CONFIG.PRODUCT.kgPerUnit;
    var items = qty * CONFIG.PRODUCT.price;
    var ship = kg >= CONFIG.FREE_SHIPPING_KG ? 0 : CONFIG.SHIPPING_FEE;
    return { qty: qty, kg: kg, items: items, ship: ship, total: items + ship };
  }

  function qtyFromUrl() {
    var m = /[?&]qty=(\d+)/.exec(w.location.search);
    return clampQty(m ? m[1] : 1);
  }

  w.BDBG = { CONFIG: CONFIG, won: won, clampQty: clampQty, calc: calc, qtyFromUrl: qtyFromUrl };
})(window);
