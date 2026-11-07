import { getStatus, send } from './_lib/blaaiz.js';
export default async function handler(req, res) {
  const id = new URL(req.url, 'http://x').searchParams.get('id');
  if (!id) return send(res, 400, { error: 'id required' });
  try { send(res, 200, await getStatus(id)); }
  catch (e) { send(res, 502, { error: e.message }); }
}
