// 토스페이먼츠 결제 승인(confirm) 서버 함수.
// 시크릿 키는 Netlify 환경변수 TOSS_SECRET_KEY 에만 둡니다. 코드·저장소에 넣지 마세요.
const ALLOW_ORIGIN = 'https://badabogil.com';
const PRICE = 35000, SHIP = 3000, FREE_KG = 4, MAX_QTY = 10; // shop.js 의 CONFIG 와 같아야 합니다

// 서버가 허용하는 결제금액 목록(수량 1~10). 화면에서 받은 금액을 그대로 믿지 않습니다.
function allowedAmounts() {
  const set = new Set();
  for (let q = 1; q <= MAX_QTY; q++) set.add(PRICE * q + (q >= FREE_KG ? 0 : SHIP));
  return set;
}

const headers = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};
const reply = (code, body) => ({ statusCode: code, headers, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { message: 'POST only' });

  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) return reply(500, { message: '서버에 시크릿 키가 설정되지 않았습니다.' });

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { message: 'bad json' }); }
  const { paymentKey, orderId } = b;
  const amount = Number(b.amount);

  if (!paymentKey || !/^BDBG-[a-z0-9-]+$/i.test(orderId || '')) return reply(400, { message: '주문 정보가 올바르지 않습니다.' });
  if (!allowedAmounts().has(amount)) return reply(400, { message: '결제금액이 올바르지 않습니다.' });

  const auth = 'Basic ' + Buffer.from(secret + ':').toString('base64');
  const r = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentKey, orderId, amount })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return reply(r.status, { code: data.code, message: data.message || '결제 승인에 실패했습니다.' });

  // TODO(실제 판매 전 필수): 주문자·배송 정보를 저장/알림하는 단계가 아직 없습니다.
  return reply(200, { orderId: data.orderId, totalAmount: data.totalAmount, method: data.method, approvedAt: data.approvedAt, status: data.status });
};
