import React, { useEffect, useState } from 'react';

const POT_CCY = 'USD';
const SHARE = 200; // each member puts in $200-worth per round

const SYM = { USD: '$', GBP: '£', CAD: 'C$', NGN: '₦', EUR: '€' };
const fmt = (n, c) =>
  `${SYM[c] || ''}${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: c === 'NGN' ? 0 : 2, minimumFractionDigits: c === 'NGN' ? 0 : 2 })}`;

const MEMBERS = [
  { id: 'tolu', name: 'Tolu Adeyemi', city: 'London', flag: '🇬🇧', ccy: 'GBP', bank: 'Monzo ••4821' },
  { id: 'chidi', name: 'Chidi Okafor', city: 'Toronto', flag: '🇨🇦', ccy: 'CAD', bank: 'Interac · chidi@mail.ca' },
  { id: 'ada', name: 'Ada Okafor', city: 'Lagos', flag: '🇳🇬', ccy: 'NGN', bank: 'GTBank ••0193', bank_id: 'gtb', account_number: '0123450193' },
  { id: 'amaka', name: 'Amaka Bello', city: 'Houston', flag: '🇺🇸', ccy: 'USD', bank: 'Chase ••7730' },
];

// Rotation: who collects the pot each month
const ROUNDS = [
  { month: 'Aug 2026', to: 'tolu', state: 'done', got: '£608.15' },
  { month: 'Sep 2026', to: 'chidi', state: 'done', got: 'C$1,092.40' },
  { month: 'Oct 2026', to: 'ada', state: 'current' },
  { month: 'Nov 2026', to: 'amaka', state: 'next' },
];

const initial = () => ({ paid: {}, payout: null, log: [] });
const load = () => {
  try { return JSON.parse(localStorage.getItem('kolo-state')) || initial(); } catch { return initial(); }
};

async function api(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}

const initials = (n) => n.split(' ').map((p) => p[0]).join('');
const byId = (id) => MEMBERS.find((m) => m.id === id);

export default function App() {
  const [s, setS] = useState(load);
  const [mode, setMode] = useState('mock');
  const [sheet, setSheet] = useState(null); // {type:'pay', member} | {type:'release'}
  const [showDev, setShowDev] = useState(false);

  useEffect(() => { try { localStorage.setItem('kolo-state', JSON.stringify(s)); } catch {} }, [s]);
  useEffect(() => { api('/api/mode').then((j) => setMode(j.mode)).catch(() => {}); }, []);

  const log = (entry) => setS((p) => ({ ...p, log: [{ at: new Date().toLocaleTimeString(), ...entry }, ...p.log].slice(0, 30) }));

  const recipient = byId(ROUNDS.find((r) => r.state === 'current').to);
  const paidCount = MEMBERS.filter((m) => s.paid[m.id]).length;
  const potTotal = MEMBERS.reduce((a, m) => a + (s.paid[m.id]?.potGets || 0), 0);
  const allPaid = paidCount === MEMBERS.length;

  // Poll payout status
  useEffect(() => {
    const p = s.payout;
    if (!p || ['SUCCESSFUL', 'COMPLETED', 'FAILED'].includes(p.status)) return;
    const t = setInterval(async () => {
      try {
        const j = await api(`/api/status?id=${encodeURIComponent(p.id)}`);
        if (j.status !== p.status) {
          log({ endpoint: j.endpoint, note: `Status → ${j.status}`, mode: j.mode });
          setS((prev) => ({ ...prev, payout: { ...prev.payout, status: j.status, history: [...prev.payout.history, { status: j.status, at: new Date().toLocaleTimeString() }] } }));
        }
      } catch {}
    }, 2500);
    return () => clearInterval(t);
  }, [s.payout?.id, s.payout?.status]);

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <img src="/kolo.svg" alt="" width="32" height="32" />
          <span>kolo</span>
        </div>
        <button className={`mode ${mode}`} onClick={() => setShowDev(true)} title="See the Blaaiz API calls">
          <i /> {mode === 'mock' ? 'Mock mode · Blaaiz API simulated' : 'Blaaiz sandbox · live'}
        </button>
      </header>

      <section className="hero">
        <div className="hero-l">
          <p className="eyebrow">Okafor Family Kolo · 4 members · 3 countries</p>
          <h1>Ajo, without borders.</h1>
          <p className="sub">Everyone saves in their own currency. Each month the whole pot lands in one person's account, in theirs. Blaaiz handles the FX and the payout.</p>
        </div>
        <div className="pot">
          <p className="pot-label">October pot</p>
          <p className="pot-amt">{fmt(potTotal, POT_CCY)}</p>
          <div className="bar"><span style={{ width: `${(paidCount / MEMBERS.length) * 100}%` }} /></div>
          <p className="pot-meta">{paidCount} of {MEMBERS.length} paid in · goes to <b>{recipient.name.split(' ')[0]} {recipient.flag}</b></p>
          {s.payout ? (
            <button className="btn kiwi" onClick={() => setSheet({ type: 'track' })}>Track payout →</button>
          ) : (
            <button className="btn kiwi" disabled={!allPaid} onClick={() => setSheet({ type: 'release' })}>
              {allPaid ? `Release pot to ${recipient.name.split(' ')[0]}` : 'Waiting on contributions'}
            </button>
          )}
        </div>
      </section>

      <div className="grid">
        <section className="card">
          <div className="card-h"><h2>This round</h2><span className="muted">{fmt(SHARE, POT_CCY)} each</span></div>
          <ul className="members">
            {MEMBERS.map((m) => {
              const p = s.paid[m.id];
              return (
                <li key={m.id}>
                  <div className="av">{initials(m.name)}<span>{m.flag}</span></div>
                  <div className="who">
                    <b>{m.name}{m.id === recipient.id && <em className="tag">collects</em>}</b>
                    <small>{m.city} · pays in {m.ccy}</small>
                  </div>
                  {p ? (
                    <div className="paid"><b>{fmt(p.youSend, m.ccy)}</b><small>✓ in the pot</small></div>
                  ) : (
                    <button className="btn ghost sm" onClick={() => setSheet({ type: 'pay', member: m })}>Pay in {m.ccy}</button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <div className="card-h"><h2>Rotation</h2><span className="muted">who collects when</span></div>
          <ol className="rounds">
            {ROUNDS.map((r) => {
              const m = byId(r.to);
              const st = r.state === 'current' && s.payout ? (['SUCCESSFUL', 'COMPLETED'].includes(s.payout.status) ? 'done' : 'live') : r.state;
              return (
                <li key={r.month} className={st}>
                  <span className="dot" />
                  <div>
                    <b>{m.name.split(' ')[0]} {m.flag}</b>
                    <small>{r.month}</small>
                  </div>
                  <span className="r-right">
                    {st === 'done' ? (r.got || fmt(s.payout?.recipient_gets, m.ccy)) : st === 'live' ? s.payout.status.toLowerCase() : st === 'current' ? 'this month' : 'up next'}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="why">No one fronts the money, and no one pays a hidden spread to a cousin who "knows a guy". Every naira, pound and dollar can be traced.</p>
        </section>
      </div>

      <footer className="foot">
        <button className="link" onClick={() => setShowDev(true)}>Under the hood: {s.log.length} Blaaiz calls</button>
        <button className="link" onClick={() => { setS(initial()); }}>Reset demo</button>
      </footer>

      {sheet?.type === 'pay' && (
        <PaySheet member={sheet.member} onClose={() => setSheet(null)} log={log}
          onPaid={(rec) => { setS((p) => ({ ...p, paid: { ...p.paid, [sheet.member.id]: rec } })); setSheet(null); }} />
      )}
      {sheet?.type === 'release' && (
        <ReleaseSheet total={potTotal} recipient={recipient} onClose={() => setSheet(null)} log={log}
          onCreated={(payout) => { setS((p) => ({ ...p, payout })); setSheet({ type: 'track' }); }} />
      )}
      {sheet?.type === 'track' && s.payout && <TrackSheet payout={s.payout} recipient={recipient} onClose={() => setSheet(null)} />}
      {showDev && <DevSheet mode={mode} log={s.log} onClose={() => setShowDev(false)} />}
    </div>
  );
}

function Sheet({ title, onClose, children }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-h"><h3>{title}</h3><button className="x" onClick={onClose} aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}

function Row({ k, v, strong }) {
  return <div className={`row ${strong ? 'strong' : ''}`}><span>{k}</span><span>{v}</span></div>;
}

function PaySheet({ member, onClose, onPaid, log }) {
  const [q, setQ] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // 1) probe the rate, 2) quote the exact local amount that buys a $200 share
        const probe = await api('/api/quote', { from: member.ccy, to: POT_CCY, amount: 100 });
        const local = Math.ceil((SHARE / probe.rate) * 100) / 100;
        const j = await api('/api/quote', { from: member.ccy, to: POT_CCY, amount: local });
        log({ endpoint: j.endpoint, note: `Quote ${member.ccy}→${POT_CCY} for ${member.name.split(' ')[0]}`, mode: j.mode });
        setQ(j);
      } catch (e) { setErr(e.message); }
    })();
  }, []);

  const pay = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900));
    log({ endpoint: 'Collection (virtual account / card)', note: `${member.name.split(' ')[0]} paid ${fmt(q.you_send, member.ccy)}`, mode: q.mode });
    onPaid({ youSend: q.you_send, potGets: q.recipient_gets, at: Date.now() });
  };

  return (
    <Sheet title={`${member.flag} ${member.name.split(' ')[0]}'s contribution`} onClose={onClose}>
      {err && <p className="err">{err}</p>}
      {!q && !err && <div className="skeleton">Getting live rate from Blaaiz…</div>}
      {q && (
        <>
          <div className="big"><small>You pay</small>{fmt(q.you_send, member.ccy)}</div>
          <Row k="Your share" v={fmt(q.amount, member.ccy)} />
          <Row k="Blaaiz fee" v={fmt(q.fee, member.ccy)} />
          <Row k="Rate" v={`1 ${member.ccy} = ${q.rate < 0.01 ? q.rate.toFixed(6) : q.rate.toFixed(4)} ${POT_CCY}`} />
          <Row k="Lands in pot" v={fmt(q.recipient_gets, POT_CCY)} strong />
          <p className="fine">From {member.bank}. Rate locked for this payment.</p>
          <button className="btn dark full" disabled={busy} onClick={pay}>{busy ? 'Paying…' : `Pay ${fmt(q.you_send, member.ccy)}`}</button>
        </>
      )}
    </Sheet>
  );
}

function ReleaseSheet({ total, recipient, onClose, onCreated, log }) {
  const [q, setQ] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [acct, setAcct] = useState({ account_name: recipient.name, account_number: recipient.account_number || '', bank_id: recipient.bank_id || '' });

  useEffect(() => {
    api('/api/quote', { from: POT_CCY, to: recipient.ccy, amount: +total.toFixed(2) })
      .then((j) => { log({ endpoint: j.endpoint, note: `Quote pot ${POT_CCY}→${recipient.ccy}`, mode: j.mode }); setQ(j); })
      .catch((e) => setErr(e.message));
  }, []);

  const send = async () => {
    setBusy(true); setErr('');
    try {
      const reference = `kolo-okafor-oct26-${Date.now().toString(36)}`;
      const j = await api('/api/payout', { from: POT_CCY, to: recipient.ccy, amount: +total.toFixed(2), recipient: acct, reference });
      log({ endpoint: j.endpoint, note: `Payout created · ${j.id}`, mode: j.mode });
      onCreated({ ...j, recipient_gets: j.recipient_gets ?? q.recipient_gets, fee: j.fee ?? q.fee, history: [{ status: 'CREATED', at: new Date().toLocaleTimeString() }, { status: j.status, at: new Date().toLocaleTimeString() }] });
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <Sheet title={`Release October pot to ${recipient.name.split(' ')[0]} ${recipient.flag}`} onClose={onClose}>
      {err && <p className="err">{err}</p>}
      {!q && !err && <div className="skeleton">Quoting {POT_CCY} → {recipient.ccy}…</div>}
      {q && (
        <>
          <div className="big"><small>{recipient.name.split(' ')[0]} receives</small>{fmt(q.recipient_gets, recipient.ccy)}</div>
          <Row k="Pot" v={fmt(total, POT_CCY)} />
          <Row k="Rate" v={`1 ${POT_CCY} = ${q.rate.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${recipient.ccy}`} />
          <Row k="Payout fee" v={fmt(q.fee, POT_CCY)} />
          <div className="fields">
            <label>Account name<input value={acct.account_name} onChange={(e) => setAcct({ ...acct, account_name: e.target.value })} /></label>
            <label>Account number<input inputMode="numeric" value={acct.account_number} onChange={(e) => setAcct({ ...acct, account_number: e.target.value })} /></label>
            <label>Bank<input value={recipient.bank.split(' ')[0]} readOnly /></label>
          </div>
          <p className="fine">All 4 members approved this release. The payout goes from the Kolo wallet to the bank through Blaaiz.</p>
          <button className="btn dark full" disabled={busy || acct.account_number.length < 10} onClick={send}>{busy ? 'Creating payout…' : 'Send payout'}</button>
        </>
      )}
    </Sheet>
  );
}

const STEPS = ['CREATED', 'PENDING', 'PROCESSING', 'SUCCESSFUL'];
function TrackSheet({ payout, recipient, onClose }) {
  const idx = Math.max(STEPS.indexOf(payout.status === 'COMPLETED' ? 'SUCCESSFUL' : payout.status), 1);
  const at = (st) => payout.history.find((h) => h.status === st)?.at;
  const done = idx === 3;
  return (
    <Sheet title="Payout status" onClose={onClose}>
      <div className={`big ${done ? 'ok' : ''}`}><small>{done ? 'Delivered to' : 'On its way to'} {recipient.name.split(' ')[0]}</small>{fmt(payout.recipient_gets, recipient.ccy)}</div>
      <ol className="track">
        {STEPS.map((st, i) => (
          <li key={st} className={i < idx ? 'done' : i === idx ? (done ? 'done' : 'now') : ''}>
            <span className="dot" />
            <div><b>{{ CREATED: 'Payout created', PENDING: 'Queued at Blaaiz', PROCESSING: 'Sending to bank', SUCCESSFUL: `In ${recipient.name.split(' ')[0]}'s account` }[st]}</b>
              <small>{at(st) || (i > idx ? 'waiting' : '…')}</small></div>
          </li>
        ))}
      </ol>
      <Row k="Transaction ID" v={<code>{payout.id}</code>} />
      <Row k="Reference" v={<code>{payout.reference}</code>} />
      {done && <p className="fine celebrate">🎉 Round 3 complete. Amaka collects in November.</p>}
    </Sheet>
  );
}

function DevSheet({ mode, log, onClose }) {
  return (
    <Sheet title="Under the hood · Blaaiz API" onClose={onClose}>
      <p className="fine">
        {mode === 'mock'
          ? 'MOCK MODE: no sandbox keys are configured, so the server simulates Blaaiz responses with the same request shapes. Add keys to .env and the same code calls the real API.'
          : 'LIVE: requests go from Kolo\'s server to the Blaaiz sandbox using OAuth client credentials. Keys never reach the browser.'}
      </p>
      <div className="flow">
        <code>POST /oauth/token</code><code>POST /api/external/fees/breakdown</code><code>POST /api/external/payout</code><code>GET /api/external/transaction/:id</code>
      </div>
      <ul className="log">
        {log.length === 0 && <li className="muted">No calls yet. Pay a contribution to see one.</li>}
        {log.map((l, i) => (
          <li key={i}><small>{l.at} · {l.mode}</small><code>{l.endpoint}</code><span>{l.note}</span></li>
        ))}
      </ul>
    </Sheet>
  );
}
