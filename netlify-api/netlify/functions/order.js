// 결제창을 열기 전에 주문자·배송 정보를 주문 시트에 '결제대기'로 저장합니다.
// 결제가 끝나면 confirm.js 가 같은 주문번호의 상태를 '결제완료'로 바꾸고 대표에게 메일을 보냅니다.
const { amountFor, MAX_QTY, headers, reply, callHook } = require('../../lib/shared');

const digits = (s) => String(s || '').replace(/\D/g, '');
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { message: 'POST only' });

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { message: 'bad json' }); }

  const qty = Number(b.qty);
  const o = {
    orderId: clean(b.orderId, 40),
    qty,
    amount: Number.isInteger(qty) && qty >= 1 && qty <= MAX_QTY ? amountFor(qty) : 0,
    bName: clean(b.bName, 40), bTel: digits(b.bTel), bMail: clean(b.bMail, 100),
    rName: clean(b.rName, 40), rTel: digits(b.rTel), rZip: digits(b.rZip),
    rAddr: clean(b.rAddr, 200), rAddr2: clean(b.rAddr2, 100), rMemo: clean(b.rMemo, 200)
  };

  const phone = /^01[016789]\d{7,8}$/;
  const bad =
    !/^BDBG-[a-z0-9-]+$/i.test(o.orderId) || !o.amount ||
    o.bName.length < 2 || !phone.test(o.bTel) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.bMail) ||
    o.rName.length < 2 || !phone.test(o.rTel) || o.rZip.length !== 5 || o.rAddr.length < 5;
  if (bad) return reply(400, { message: '주문 정보가 올바르지 않습니다.' });

  try {
    await callHook({ action: 'create', ...o });
  } catch (e) {
    console.error('order hook failed:', e.message);
    return reply(502, { message: '주문 정보를 저장하지 못했습니다.' });
  }
  return reply(200, { ok: true, orderId: o.orderId, amount: o.amount });
};
