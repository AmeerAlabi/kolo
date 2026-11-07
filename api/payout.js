import { createPayout, send, readBody } from './_lib/blaaiz.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try { send(res, 200, await createPayout(await readBody(req))); }
  catch (e) { send(res, 502, { error: e.message }); }
}
