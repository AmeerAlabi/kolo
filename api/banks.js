import { listBanks, send } from './_lib/blaaiz.js';
export default async function handler(req, res) {
  const currency = new URL(req.url, 'http://x').searchParams.get('currency') || 'NGN';
  try { send(res, 200, await listBanks(currency)); }
  catch (e) { send(res, 502, { error: e.message }); }
}
