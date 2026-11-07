import { MODE, send } from './_lib/blaaiz.js';
export default function handler(req, res) { send(res, 200, { mode: MODE }); }
