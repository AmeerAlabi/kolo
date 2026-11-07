// Kolo ↔ Blaaiz integration layer (server-side only — keys never reach the browser).
// Real mode: set BLAAIZ_CLIENT_ID/SECRET (or BLAAIZ_API_KEY) + wallet/customer ids.
// Mock mode: no keys → deterministic, clearly-labelled simulation of the same API.

const BASE = process.env.BLAAIZ_BASE_URL || 'https://api-dev.blaaiz.com';
const CLIENT_ID = process.env.BLAAIZ_CLIENT_ID;
const CLIENT_SECRET = process.env.BLAAIZ_CLIENT_SECRET;
const API_KEY = process.env.BLAAIZ_API_KEY;

export const MODE = (CLIENT_ID && CLIENT_SECRET) || API_KEY ? 'live-sandbox' : 'mock';

let cachedToken = null;
let tokenExpiry = 0;

async function getAuthHeader() {
  if (CLIENT_ID && CLIENT_SECRET) {
    if (cachedToken && Date.now() < tokenExpiry) return { Authorization: `Bearer ${cachedToken}` };
    // POST /oauth/token — OAuth 2.0 client credentials
    const r = await fetch(`${BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: process.env.BLAAIZ_OAUTH_SCOPE || undefined,
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || 'Blaaiz OAuth failed');
    cachedToken = j.access_token;
    tokenExpiry = Date.now() + ((j.expires_in || 3600) - 60) * 1000;
    return { Authorization: `Bearer ${cachedToken}` };
  }
  return { 'x-blaaiz-api-key': API_KEY };
}

async function blaaiz(path, { method = 'GET', body } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(await getAuthHeader()) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j;
  try { j = JSON.parse(text); } catch { j = { raw: text }; }
  if (!r.ok) throw new Error(j.message || `Blaaiz ${method} ${path} → ${r.status}`);
  return j.data ?? j;
}

// ---------- Mock data (indicative rates, labelled as such in the UI) ----------
const USD_PER = { USD: 1, GBP: 1.29, CAD: 0.72, EUR: 1.08, NGN: 1 / 1535 };
const mockRate = (from, to) => USD_PER[from] / USD_PER[to];
const FEE_PCT = 0.015; // mirrors the 1.5% `our_fee` in Blaaiz's breakdown example
const FLAT = { USD: 1, GBP: 0.8, CAD: 1.4, EUR: 0.9, NGN: 500 };

// ---------- Public functions ----------

/** POST /api/external/fees/breakdown */
export async function quote({ from, to, amount, method = 'BANK_TRANSFER' }) {
  amount = Number(amount);
  if (MODE === 'mock') {
    const rate = mockRate(from, to);
    const fee = +(amount * FEE_PCT + (from === to ? 0 : FLAT[from] || 0)).toFixed(2);
    return {
      mode: MODE,
      from, to, amount, rate,
      fee,
      you_send: +(amount + fee).toFixed(2),
      recipient_gets: +(amount * rate).toFixed(2),
      method,
      endpoint: 'POST /api/external/fees/breakdown',
    };
  }
  const d = await blaaiz('/api/external/fees/breakdown', {
    method: 'POST',
    body: { from_currency_id: from, to_currency_id: to, from_amount: amount, customer_id: process.env.BLAAIZ_CUSTOMER_ID || undefined },
  });
  const list = [...(d.payout_fees || []), ...(d.collection_fees || [])];
  const pick = list.find((x) => x.method === method) || list[0] || {};
  return {
    mode: MODE,
    from, to, amount,
    rate: Number(pick.rate),
    fee: Number(pick.total_fees ?? pick.fee ?? d.our_fee ?? 0),
    you_send: Number(pick.total_amount_to_send ?? pick.you_send ?? amount),
    recipient_gets: Number(pick.recipient_gets),
    method: pick.method || method,
    endpoint: 'POST /api/external/fees/breakdown',
  };
}

/** POST /api/external/payout */
export async function createPayout({ from, to, amount, recipient, reference }) {
  if (MODE === 'mock') {
    const q = await quote({ from, to, amount });
    return {
      mode: MODE,
      id: `mock_${Date.now().toString(36)}`,
      status: 'PENDING',
      reference,
      ...q,
      recipient,
      endpoint: 'POST /api/external/payout',
    };
  }
  const body = {
    wallet_id: process.env.BLAAIZ_WALLET_ID,
    customer_id: process.env.BLAAIZ_CUSTOMER_ID,
    method: 'bank_transfer',
    from_currency_id: from,
    to_currency_id: to,
    from_amount: Number(amount),
    bank_id: recipient.bank_id,
    account_number: recipient.account_number,
    account_name: recipient.account_name,
    merchant_reference: reference,
  };
  const d = await blaaiz('/api/external/payout', { method: 'POST', body });
  const t = d.transaction || d;
  return { mode: MODE, id: t.id, status: (t.status || 'PENDING').toUpperCase(), reference, raw: d, endpoint: 'POST /api/external/payout' };
}

/** GET /api/external/transaction/{id} */
export async function getStatus(id) {
  if (MODE === 'mock' || id.startsWith('mock_')) {
    // Stateless simulation: status advances with time since creation.
    const created = parseInt(id.replace('mock_', ''), 36);
    const s = (Date.now() - created) / 1000;
    const status = s < 5 ? 'PENDING' : s < 12 ? 'PROCESSING' : 'SUCCESSFUL';
    return { mode: 'mock', id, status, endpoint: `GET /api/external/transaction/${id}` };
  }
  const d = await blaaiz(`/api/external/transaction/${id}`);
  const t = d.transaction || d;
  return { mode: MODE, id, status: (t.status || 'PENDING').toUpperCase(), raw: d, endpoint: `GET /api/external/transaction/${id}` };
}

// Tiny helpers shared by Vercel functions and the Vite dev server.
export function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
}
