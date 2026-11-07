// Salat Stars — Cloudflare Worker: API + static app + scheduled push notifications + weekly email.
import { PRAYERS, PRAYER_NAMES, localYMD, ymdKey, addDays, fmtTime } from '../public/js/core/praytimes.js';
import { windowsFor, prayerStatus, league, summary, dateRange } from '../public/js/core/scoring.js';
import { toHijri, hijriLabel } from '../public/js/core/hijri.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
const bad = (msg, status = 400) => json({ error: msg }, status);
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uDecode = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const rid = () => crypto.randomUUID().slice(0, 8);
const normCode = c => String(c || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

// ---------- secrets kept in KV (generated on first use, nothing to configure) ----------
async function serverSecret(env) {
  let s = await env.STARS.get('cfg:secret');
  if (!s) { s = b64u(crypto.getRandomValues(new Uint8Array(32))); await env.STARS.put('cfg:secret', s); }
  return s;
}
async function hmac(env, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(await serverSecret(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}
async function hashSecret(secret, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, key, 256);
  return b64u(bits);
}
async function makeToken(env, code) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 365;
  return `${code}.${exp}.${await hmac(env, code + '.' + exp)}`;
}
async function checkToken(env, req) {
  const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [code, exp, sig] = t.split('.');
  if (!code || !exp || !sig || Date.now() > +exp) return null;
  if (sig !== await hmac(env, code + '.' + exp)) return null;
  return code;
}
const famKey = code => `fam:${code}`;
const getFam = async (env, code) => JSON.parse(await env.STARS.get(famKey(code)) || 'null');
const putFam = (env, fam) => env.STARS.put(famKey(fam.code), JSON.stringify(fam));

function publicFam(fam) {
  const f = structuredClone(fam);
  delete f.passHash; delete f.salt; delete f.push;
  f.members = f.members.map(m => { const { pinHash, ...rest } = m; return { ...rest, hasPin: !!pinHash }; });
  return f;
}

// ---------- Web Push (VAPID, payload-less: the service worker fetches the text) ----------
async function vapidKeys(env) {
  const stored = await env.STARS.get('cfg:vapid', 'json');
  if (stored) return stored;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
  const priv = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const v = { pub, priv };
  await env.STARS.put('cfg:vapid', JSON.stringify(v));
  return v;
}
async function sendPush(env, sub, origin) {
  const v = await vapidKeys(env);
  const aud = new URL(sub.endpoint).origin;
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: origin })));
  const key = await crypto.subtle.importKey('jwk', v.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = b64u(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: `vapid t=${header}.${claims}.${sig}, k=${v.pub}`, TTL: '3600', Urgency: 'high', 'Content-Length': '0' }
  });
  return res.status;
}

// What a notification should say right now for this member.
function notificationText(fam, mid, now = new Date()) {
  const m = fam.members.find(x => x.id === mid);
  const tz = fam.loc.tz;
  const today = ymdKey(localYMD(now, tz));
  const yesterday = addDays(today, -1);
  const name = m ? m.name.split(' ')[0] : '';
  // Reminder if a window closes within 25 minutes and this member hasn't prayed
  for (const d of [yesterday, today]) {
    const { windows } = windowsFor(fam, d);
    for (const p of PRAYERS) {
      const w = windows[p];
      const left = (w.end - now) / 60000;
      if (left > 0 && left <= 25 && m) {
        const st = prayerStatus(fam, m, d, p, now);
        if (st.status === 'open') return { title: `⏳ ${PRAYER_NAMES[p]} ends in ${Math.round(left)} min`, body: `${name}, there's still time to pray ${PRAYER_NAMES[p]}.`, tag: `end-${d}-${p}` };
      }
    }
  }
  const { times } = windowsFor(fam, today);
  const starts = [['fajr', 'Fajr', times.fajr], ['dhuhr', 'Dhuhr & Asr', times.dhuhr], ['maghrib', 'Maghrib & Isha', times.maghrib]];
  let cur = null;
  for (const s of starts) if (now >= s[2]) cur = s;
  if (!cur) return { title: '🌙 Salat Stars', body: `Fajr is at ${fmtTime(times.fajr, tz)}.`, tag: 'info' };
  return { title: `🕌 It's ${cur[1]} time`, body: `${cur[1]} began at ${fmtTime(cur[2], tz)}. Who will pray first? ⭐`, tag: `start-${today}-${cur[0]}` };
}

// ---------- Weekly email via Resend (optional: set RESEND_API_KEY secret) ----------
async function weeklyEmail(env, fam, origin) {
  if (!env.RESEND_API_KEY) return 'no-key';
  const to = fam.members.filter(m => m.role === 'parent' && m.email).map(m => m.email);
  if (!to.length) return 'no-recipients';
  const tz = fam.loc.tz;
  const today = ymdKey(localYMD(new Date(), tz));
  const rows = league(fam, today, 'week');
  const tr = rows.map((r, i) => `<tr><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${r.member.name}</td><td><b>${r.points}</b></td><td>${r.prayed}/${r.possible - r.excused}</td><td>${r.onTimePct ?? '–'}%</td><td>${r.missed}</td><td>${r.jamaat}</td></tr>`).join('');
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">
    <h2 style="color:#0f766e">⭐ Salat Stars — ${fam.name} weekly report</h2>
    <p>${hijriLabel(toHijri(today, fam.hijriAdj || 0))} · week ending ${today}</p>
    <table cellpadding="6" style="border-collapse:collapse;width:100%;font-size:14px">
    <tr style="background:#ecfdf5"><th></th><th align="left">Name</th><th>Points</th><th>Prayed</th><th>On time</th><th>Missed</th><th>Jamaat</th></tr>${tr}</table>
    <p><a href="${origin}">Open Salat Stars</a></p></div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM || 'Salat Stars <onboarding@resend.dev>', to, subject: `⭐ ${fam.name}: Salat Stars weekly report`, html })
  });
  return r.status;
}

// ---------- Scheduled: every 5 minutes ----------
async function scheduled(env) {
  const origin = env.APP_ORIGIN || 'https://salat-stars.workers.dev';
  const now = new Date();
  let cursor;
  do {
    const list = await env.STARS.list({ prefix: 'fam:', cursor });
    cursor = list.list_complete ? null : list.cursor;
    for (const k of list.keys) {
      const fam = JSON.parse(await env.STARS.get(k.name) || 'null');
      if (!fam) continue;
      const tz = fam.loc.tz;
      const today = ymdKey(localYMD(now, tz));
      const { times, windows } = windowsFor(fam, today);
      const events = [];
      for (const [id, t] of [['fajr', times.fajr], ['dhuhr', times.dhuhr], ['maghrib', times.maghrib]]) {
        const mins = (now - t) / 60000;
        if (mins >= 0 && mins < 6) events.push({ id: `start-${today}-${id}`, who: 'all' });
      }
      for (const d of [addDays(today, -1), today]) {
        const w = d === today ? windows : windowsFor(fam, d).windows;
        for (const p of PRAYERS) {
          const left = (w[p].end - now) / 60000;
          if (left > 15 && left <= 21) events.push({ id: `end-${d}-${p}`, who: 'open', date: d, prayer: p });
        }
      }
      for (const ev of events) {
        const sentKey = `sent:${fam.code}:${ev.id}`;
        if (await env.STARS.get(sentKey)) continue;
        await env.STARS.put(sentKey, '1', { expirationTtl: 60 * 60 * 30 });
        const subs = (await env.STARS.get(`push:${fam.code}`, 'json')) || [];
        const keep = [];
        for (const s of subs) {
          if (s.off) { keep.push(s); continue; }
          const m = fam.members.find(x => x.id === s.mid);
          if (ev.who === 'open' && (!m || prayerStatus(fam, m, ev.date, ev.prayer, now).status !== 'open')) { keep.push(s); continue; }
          try {
            const st = await sendPush(env, s.sub, origin);
            if (st !== 404 && st !== 410) keep.push(s);
          } catch { keep.push(s); }
        }
        if (keep.length !== subs.length) await env.STARS.put(`push:${fam.code}`, JSON.stringify(keep));
      }
      // Weekly email: Sundays between 19:00 and 19:05 local time
      const local = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).reduce((o, p) => (o[p.type] = p.value, o), {});
      if (local.weekday === 'Sun' && local.hour === '19' && +local.minute < 5) {
        const ek = `sent:${fam.code}:email-${today}`;
        if (!(await env.STARS.get(ek))) { await env.STARS.put(ek, '1', { expirationTtl: 86400 * 2 }); await weeklyEmail(env, fam, origin); }
      }
    }
  } while (cursor);
}

// ---------- API ----------
async function requireParent(fam, body) {
  const p = fam.members.find(m => m.id === body.actor && m.role === 'parent');
  if (!p) return 'Only a parent can do that.';
  if (p.pinHash && p.pinHash !== await hashSecret(String(body.pin || ''), fam.code + p.id)) return 'Wrong parent PIN.';
  return null;
}

const PARENT_ACTIONS = new Set(['addMember', 'updateMember', 'removeMember', 'override', 'addReward', 'removeReward', 'giveReward', 'settings', 'logFor', 'qadhaFor']);

async function action(env, fam, body, origin) {
  const t = body.type;
  if (PARENT_ACTIONS.has(t)) { const err = await requireParent(fam, body); if (err) return bad(err, 403); }
  const now = new Date();
  const today = ymdKey(localYMD(now, fam.loc.tz));
  const member = id => fam.members.find(m => m.id === id);
  fam.log ||= {}; fam.excused ||= {}; fam.overrides ||= {}; fam.qadhaDone ||= {}; fam.qadhaManual ||= {}; fam.rewards ||= []; fam.ack ||= {};

  switch (t) {
    case 'log': case 'logFor': {
      const m = member(t === 'logFor' ? body.memberId : body.actor);
      if (!m || !PRAYERS.includes(body.prayer)) return bad('Unknown member or prayer');
      const date = body.date || today;
      const w = windowsFor(fam, date).windows[body.prayer];
      if (t === 'log') {
        if (fam.log?.[date]?.[body.prayer]?.[m.id]) return bad('Already recorded.');
        if (now < w.start) return bad(`${PRAYER_NAMES[body.prayer]} hasn't started yet.`);
        if (now >= w.end) return bad(`The time for ${PRAYER_NAMES[body.prayer]} has ended.`);
        if (fam.excused?.[date]?.[m.id]?.[body.prayer]) delete fam.excused[date][m.id][body.prayer];
        if (body.prayer === 'asr' && !fam.log?.[date]?.dhuhr?.[m.id]) return bad('Pray Dhuhr before Asr.');
        if (body.prayer === 'isha' && !fam.log?.[date]?.maghrib?.[m.id]) return bad('Pray Maghrib before Isha.');
      }
      fam.log[date] ||= {}; fam.log[date][body.prayer] ||= {};
      const prev = fam.log[date][body.prayer][m.id];
      fam.log[date][body.prayer][m.id] = {
        t: prev?.t || now.toISOString(), // server time decides who was first
        extras: body.extras || {}, jamaat: !!body.jamaat,
        ...(t === 'logFor' && body.late ? { late: true } : {})
      };
      break;
    }
    case 'updateExtras': {
      const e = fam.log?.[body.date]?.[body.prayer]?.[body.actor];
      if (!e) return bad('Nothing to update');
      e.extras = body.extras || {}; e.jamaat = !!body.jamaat;
      break;
    }
    case 'unlog': {
      const e = fam.log?.[body.date]?.[body.prayer];
      if (e && e[body.actor] && (now - new Date(e[body.actor].t)) < 10 * 60000) delete e[body.actor];
      else return bad('You can only undo within 10 minutes.');
      break;
    }
    case 'excuse': {
      const m = member(body.memberId || body.actor); if (!m) return bad('Unknown member');
      const date = body.date || today;
      fam.excused[date] ||= {}; fam.excused[date][m.id] ||= {};
      for (const p of (body.prayers || PRAYERS)) {
        if (body.on === false) delete fam.excused[date][m.id][p]; else fam.excused[date][m.id][p] = true;
      }
      break;
    }
    case 'override': {
      const k = `${body.date}|${body.prayer}|${body.memberId}`;
      if (body.value) fam.overrides[k] = body.value; else delete fam.overrides[k];
      break;
    }
    case 'qadha': case 'qadhaFor': {
      const mid = t === 'qadhaFor' ? body.memberId : body.actor;
      const k = `${body.date}|${body.prayer}|${mid}`;
      if (body.undo) delete fam.qadhaDone[k]; else fam.qadhaDone[k] = now.toISOString();
      break;
    }
    case 'qadhaManual': {
      const mid = body.memberId || body.actor;
      fam.qadhaManual[mid] ||= { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
      fam.qadhaManual[mid][body.prayer] = Math.max(0, (fam.qadhaManual[mid][body.prayer] || 0) + (body.delta || 0));
      break;
    }
    case 'ack': fam.ack[body.actor] = today; break;
    case 'addMember': {
      const m = body.member || {};
      if (!m.name) return bad('Name required');
      const nm = { id: rid(), name: m.name.trim(), dob: m.dob || '', sex: m.sex === 'f' ? 'f' : 'm', role: m.role === 'parent' ? 'parent' : 'child', joined: today, joinedAt: now.toISOString(), penalties: m.penalties || 'auto', theme: m.theme || 'auto', afterMaghrib: !!m.afterMaghrib, avatar: m.avatar || '', email: m.email || '' };
      if (nm.role === 'parent' && m.pin) nm.pinHash = await hashSecret(String(m.pin), fam.code + nm.id);
      fam.members.push(nm);
      break;
    }
    case 'updateMember': {
      const m = member(body.member?.id); if (!m) return bad('Unknown member');
      for (const f of ['name', 'dob', 'sex', 'role', 'penalties', 'theme', 'afterMaghrib', 'avatar', 'email']) if (f in body.member) m[f] = body.member[f];
      if (body.member.pin) m.pinHash = await hashSecret(String(body.member.pin), fam.code + m.id);
      break;
    }
    case 'removeMember': {
      if (fam.members.filter(m => m.role === 'parent').length === 1 && member(body.memberId)?.role === 'parent') return bad('Keep at least one parent.');
      fam.members = fam.members.filter(m => m.id !== body.memberId);
      break;
    }
    case 'addReward': fam.rewards.push({ id: rid(), title: String(body.title || '').slice(0, 80), points: Math.max(1, +body.points || 100), memberId: body.memberId || null, given: {} }); break;
    case 'removeReward': fam.rewards = fam.rewards.filter(r => r.id !== body.id); break;
    case 'giveReward': { const r = fam.rewards.find(x => x.id === body.id); if (r) { r.given ||= {}; r.given[body.memberId] = now.toISOString(); } break; }
    case 'settings': {
      const s = body.settings || {};
      if (s.name) fam.name = String(s.name).slice(0, 60);
      if (s.loc) fam.loc = { ...fam.loc, ...s.loc };
      if ('hijriAdj' in s) fam.hijriAdj = Math.max(-3, Math.min(3, +s.hijriAdj || 0));
      if (s.password) { fam.salt = rid() + rid(); fam.passHash = await hashSecret(s.password, fam.salt); }
      break;
    }
    case 'pushSubscribe': {
      const subs = (await env.STARS.get(`push:${fam.code}`, 'json')) || [];
      const rest = subs.filter(s => s.sub.endpoint !== body.sub?.endpoint);
      if (body.sub && !body.off) rest.push({ mid: body.actor, sub: body.sub });
      await env.STARS.put(`push:${fam.code}`, JSON.stringify(rest));
      return json({ ok: true });
    }
    case 'testPush': {
      const subs = (await env.STARS.get(`push:${fam.code}`, 'json')) || [];
      const mine = subs.filter(s => s.mid === body.actor);
      const results = [];
      for (const s of mine) results.push(await sendPush(env, s.sub, origin).catch(e => String(e)));
      return json({ ok: true, results });
    }
    case 'testEmail': return json({ ok: true, result: await weeklyEmail(env, fam, origin) });
    default: return bad('Unknown action');
  }
  await putFam(env, fam);
  return json({ ok: true, fam: publicFam(fam) });
}

async function api(req, env, url) {
  const path = url.pathname.replace(/^\/api/, '');
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

  if (path === '/vapid') return json({ key: (await vapidKeys(env)).pub });

  if (path === '/push-text') {
    const fam = await getFam(env, normCode(url.searchParams.get('c')));
    if (!fam) return json({ title: '🕌 Salat Stars', body: 'It\'s salat time.' });
    return json(notificationText(fam, url.searchParams.get('m')));
  }

  if (path === '/create') {
    const code = normCode(body.code);
    if (code.length < 4) return bad('Family code needs at least 4 letters or numbers.');
    if (!body.password || String(body.password).length < 6) return bad('Password needs at least 6 characters.');
    if (await env.STARS.get(famKey(code))) return bad('That family code is taken — try another.');
    const p = body.parent || {};
    if (!p.name) return bad('Parent name required');
    const salt = rid() + rid();
    const today = ymdKey(localYMD(new Date(), body.loc?.tz || 'Europe/London'));
    const parent = { id: rid(), name: p.name.trim(), dob: p.dob || '', sex: p.sex === 'f' ? 'f' : 'm', role: 'parent', joined: today, joinedAt: new Date().toISOString(), penalties: 'auto', theme: 'auto', email: p.email || '' };
    if (p.pin) parent.pinHash = await hashSecret(String(p.pin), code + parent.id);
    const fam = {
      code, name: String(body.name || 'Our family').slice(0, 60), salt, passHash: await hashSecret(String(body.password), salt),
      loc: { lat: 51.5806, lng: -0.3420, tz: 'Europe/London', label: 'Harrow, London', profile: 'hujjat', ...(body.loc || {}) },
      hijriAdj: body.hijriAdj ?? -2, createdAt: new Date().toISOString(), members: [parent],
      log: {}, excused: {}, overrides: {}, qadhaDone: {}, qadhaManual: {}, rewards: [], ack: {}
    };
    await putFam(env, fam);
    return json({ token: await makeToken(env, code), fam: publicFam(fam), me: parent.id });
  }

  if (path === '/login') {
    const code = normCode(body.code);
    const fam = await getFam(env, code);
    // simple brute-force brake
    const tries = +(await env.STARS.get(`tries:${code}`) || 0);
    if (tries > 20) return bad('Too many attempts. Try again in an hour.', 429);
    if (!fam || fam.passHash !== await hashSecret(String(body.password || ''), fam.salt)) {
      await env.STARS.put(`tries:${code}`, String(tries + 1), { expirationTtl: 3600 });
      return bad('Family code or password is wrong.', 401);
    }
    return json({ token: await makeToken(env, code), fam: publicFam(fam) });
  }

  const code = await checkToken(env, req);
  if (!code) return bad('Please sign in again.', 401);
  const fam = await getFam(env, code);
  if (!fam) return bad('Family not found', 404);

  if (path === '/family') return json({ fam: publicFam(fam), now: new Date().toISOString() });
  if (path === '/checkPin') {
    const err = await requireParent(fam, body);
    return err ? bad(err, 403) : json({ ok: true });
  }
  if (path === '/action') return action(env, fam, body, url.origin);
  return bad('Not found', 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await api(req, env, url); } catch (e) { return bad('Server error: ' + e.message, 500); }
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(scheduled(env)); }
};
