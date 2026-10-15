// confirm.js / order.js 가 함께 쓰는 값과 도우미. shop.js 의 CONFIG 와 같아야 합니다.
const ALLOW_ORIGIN = 'https://badabogil.com';
const PRICE = 35000, SHIP = 3000, FREE_KG = 4, MAX_QTY = 10;

const amountFor = (q) => PRICE * q + (q >= FREE_KG ? 0 : SHIP);
function allowedAmounts() {
  const set = new Set();
  for (let q = 1; q <= MAX_QTY; q++) set.add(amountFor(q));
  return set;
}

const headers = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};
const reply = (code, body) => ({ statusCode: code, headers, body: JSON.stringify(body) });

// 구글 앱스스크립트(주문 시트)로 보냅니다. URL·토큰은 Netlify 환경변수에만 둡니다.
async function callHook(payload, ms = 15000) {
  const url = process.env.ORDER_HOOK_URL, token = process.env.ORDER_HOOK_TOKEN;
  if (!url || !token) throw new Error('ORDER_HOOK_URL / ORDER_HOOK_TOKEN 이 설정되지 않았습니다.');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, token }),
      signal: ctl.signal,
      redirect: 'follow'
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || j.ok !== true) throw new Error('주문 시트 응답 오류: ' + (j && j.error ? j.error : r.status));
    return j;
  } finally { clearTimeout(t); }
}

module.exports = { ALLOW_ORIGIN, PRICE, SHIP, FREE_KG, MAX_QTY, amountFor, allowedAmounts, headers, reply, callHook };
