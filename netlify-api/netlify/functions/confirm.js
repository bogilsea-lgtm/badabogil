// 토스페이먼츠 결제 승인(confirm) 서버 함수.
// 시크릿 키는 Netlify 환경변수 TOSS_SECRET_KEY 에만 둡니다. 코드·저장소에 넣지 마세요.
const { allowedAmounts, headers, reply, callHook } = require('../../lib/shared');

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

  // 결제가 승인됐으니 주문 시트를 '결제완료'로 바꾸고 대표에게 메일을 보냅니다.
  // 여기서 실패해도 고객에게는 결제 완료를 알립니다. 시트에는 '결제대기'로 남으므로 토스 대시보드와 대조해 확인합니다.
  const paid = { action: 'paid', orderId: data.orderId, paymentKey, amount: data.totalAmount, method: data.method, approvedAt: data.approvedAt };
  for (let i = 0; i < 2; i++) {
    try { await callHook(paid); break; } catch (e) { console.error('paid hook failed (' + (i + 1) + '):', e.message); }
  }
  return reply(200, { orderId: data.orderId, totalAmount: data.totalAmount, method: data.method, approvedAt: data.approvedAt, status: data.status });
};
