import { quote, send, readBody } from './_lib/blaaiz.js';
export default async function handler(req, res) {
  try { send(res, 200, await quote(await readBody(req))); }
  catch (e) { send(res, 502, { error: e.message }); }
}
