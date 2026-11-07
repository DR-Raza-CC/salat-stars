// Salat Stars — front end (vanilla JS, no build step).
import * as PT from './core/praytimes.js';
import * as HJ from './core/hijri.js';
import * as C from './core/content.js';
import * as S from './core/scoring.js';

// ---------- storage & state ----------
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem('ss.' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('ss.' + k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem('ss.' + k); } catch { } }
};
const ss = {
  get(k) { try { return JSON.parse(sessionStorage.getItem('ss.' + k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem('ss.' + k, JSON.stringify(v)); } catch { } }
};
const state = {
  token: ls.get('token'), fam: ls.get('fam'), me: ls.get('me'), pin: ss.get('pin'),
  tab: 'today', leaguePeriod: 'week', reportPeriod: 'week', reportMember: null, offset: 0, view: null
};
const $app = document.getElementById('app');
const $sheet = document.getElementById('sheet-root');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => new Date(Date.now() + state.offset);
const fam = () => state.fam;
const tz = () => fam()?.loc?.tz || 'Europe/London';
const todayKey = () => PT.ymdKey(PT.localYMD(now(), tz()));
const adj = () => fam()?.hijriAdj ?? -2;
const me = () => fam()?.members.find(m => m.id === state.me);
const isParent = () => me()?.role === 'parent';
const firstName = m => esc((m?.name || '').split(' ')[0]);
const t = d => PT.fmtTime(d, tz());
const ICON = { fajr: '🌅', dhuhr: '☀️', asr: '🌤️', maghrib: '🌇', isha: '🌙' };
const AVATARS = ['👦', '👧', '🧒', '👨', '👩', '🧔', '🧕', '👳', '👵', '👴', '🦁', '🐯', '🐼', '🦊', '🐱', '🦄', '🐢', '🦅', '⭐', '🌙'];
const avatarOf = m => m.avatar || (m.role === 'parent' ? (m.sex === 'f' ? '🧕' : '🧔') : (m.sex === 'f' ? '👧' : '👦'));
const fmtDate = (key, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => {
  const { y, m, d } = PT.parseKey(key);
  return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
};
const fmtLong = key => fmtDate(key, { day: 'numeric', month: 'long', year: 'numeric' });
const hLabel = key => HJ.hijriLabel(HJ.toHijri(key, adj()));
const theme = () => me() ? S.themeFor(me(), todayKey()) : 'adult';

// Words that change with age group
const COPY = {
  kids: { pray: 'I prayed! 🙌', hello: n => `Salaam, ${n}! 🌟`, done: 'Mashallah! ⭐', next: 'Next salat', league: 'Family Stars' },
  tween: { pray: 'I prayed ✓', hello: n => `Salaam, ${n} 👋`, done: 'Nice one!', next: 'Up next', league: 'Leaderboard' },
  teen: { pray: 'Mark as prayed', hello: n => `Salaam, ${n}`, done: 'Recorded', next: 'Next', league: 'League' },
  adult: { pray: 'Mark as prayed', hello: n => `Assalamu alaykum, ${n}`, done: 'Recorded — may Allah accept', next: 'Next prayer', league: 'Family league' }
};
const copy = () => COPY[theme()] || COPY.adult;

// ---------- API ----------
async function api(path, body) {
  const res = await fetch('/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(state.token ? { authorization: 'Bearer ' + state.token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({ error: 'Network problem' }));
  if (res.status === 401 && state.token && path !== 'login') { signOut(); throw new Error(data.error || 'Signed out'); }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}
function setFam(f) { state.fam = f; ls.set('fam', f); }
async function refresh() {
  if (!state.token) return;
  try {
    const d = await api('family');
    setFam(d.fam);
    state.offset = new Date(d.now).getTime() - Date.now();
    if (state.me && !me()) { state.me = null; ls.del('me'); }
  } catch (e) { /* offline: keep cached copy */ }
}
async function act(type, extra = {}) {
  const body = { type, actor: state.me, pin: state.pin, ...extra };
  const d = await api('action', body);
  if (d.fam) setFam(d.fam);
  return d;
}
function signOut() {
  state.token = null; state.fam = null; state.me = null; state.pin = null;
  ls.del('token'); ls.del('fam'); ls.del('me'); ss.set('pin', null);
  render();
}

// ---------- UI helpers ----------
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}
function openSheet(html, { middle = false, locked = false } = {}) {
  $sheet.innerHTML = `<div class="overlay ${middle ? 'middle' : ''}" ${locked ? 'data-locked="1"' : ''}><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
}
function closeSheet() { $sheet.innerHTML = ''; }
$sheet.addEventListener('click', e => { if (e.target.classList.contains('overlay') && !e.target.dataset.locked) closeSheet(); });
const sheetOpen = () => !!$sheet.firstChild;

function confetti() {
  if (document.body.dataset.mode === 'mourning') return;
  const cv = document.getElementById('confetti'), cx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  const colors = ['#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#22d3ee', '#facc15'];
  const ps = Array.from({ length: 120 }, () => ({ x: innerWidth / 2, y: innerHeight / 2.5, vx: (Math.random() - .5) * 12, vy: Math.random() * -12 - 4, s: Math.random() * 6 + 4, c: colors[Math.random() * colors.length | 0], r: Math.random() * 6 }));
  let f = 0;
  (function loop() {
    cx.clearRect(0, 0, cv.width, cv.height);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .35; p.r += .1; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); cx.restore(); });
    if (++f < 110) requestAnimationFrame(loop); else cx.clearRect(0, 0, cv.width, cv.height);
  })();
}

function applyTheme() {
  document.body.dataset.theme = theme();
  if (!fam()) { delete document.body.dataset.mode; return; }
  const h = HJ.toHijri(todayKey(), adj());
  document.body.dataset.mode = C.isMourning(h) ? 'mourning' : C.isRamadhan(h) ? 'ramadhan' : '';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.body).getPropertyValue('--brand').trim() || '#0f766e';
}

// ---------- screens: welcome / create / join / picker ----------
function welcome() {
  return `<div class="wrap welcome">
    <img src="/icons/icon-192.png" alt="">
    <h1>Salat Stars</h1>
    <p class="muted">Pray together, shine together ⭐<br>A Shia family salat tracker</p>
    <div class="stack" style="margin-top:28px">
      <button class="btn block" data-act="go" data-view="join">Join my family</button>
      <button class="btn block ghost" data-act="go" data-view="create">Set up a new family</button>
    </div>
    <p class="hint" style="margin-top:24px">Prayer times use the Jafari method, set to match Hujjat (Stanmore). Rulings follow Ayatollah Sistani.</p>
  </div>`;
}
function joinView() {
  return `<div class="wrap"><button class="linkbtn" data-act="go" data-view="">← Back</button>
  <div class="card"><h2>Join your family</h2>
  <form data-form="login">
    <label>Family code</label><input name="code" autocapitalize="characters" autocomplete="username" required>
    <label>Family password</label><input name="password" type="password" autocomplete="current-password" required>
    <div class="err" id="err"></div>
    <button class="btn block" style="margin-top:18px">Join</button>
  </form></div></div>`;
}
function createView() {
  return `<div class="wrap"><button class="linkbtn" data-act="go" data-view="">← Back</button>
  <div class="card"><h2>Set up your family</h2><p class="hint">You'll be the first parent. You can add everyone else next.</p>
  <form data-form="create">
    <label>Family name</label><input name="name" placeholder="The Husain family" required>
    <label>Family joining code</label><input name="code" placeholder="e.g. HUSAINSTARS" autocapitalize="characters" required minlength="4">
    <p class="hint">Letters and numbers only. Everyone in the family uses this to join.</p>
    <label>Family password</label><input name="password" type="password" required minlength="6" autocomplete="new-password">
    <hr class="sep">
    <label>Your name</label><input name="pname" required>
    <div class="row"><div class="grow"><label>Date of birth</label><input name="dob" type="date" required></div>
    <div style="width:130px"><label>Sex</label><select name="sex"><option value="m">Male</option><option value="f">Female</option></select></div></div>
    <label>Parent PIN (4+ digits)</label><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,8}" required>
    <p class="hint">Stops children from opening parent controls or changing scores.</p>
    <label>Email for weekly report (optional)</label><input name="email" type="email">
    <label>Prayer times location</label>
    <select name="loc"><option value="harrow">Harrow, London</option><option value="stanmore">Stanmore (Hujjat)</option><option value="gps">Use my current location</option></select>
    <div class="err" id="err"></div>
    <button class="btn block" style="margin-top:18px">Create family</button>
  </form></div></div>`;
}
const LOCS = {
  harrow: { lat: 51.5806, lng: -0.3420, tz: 'Europe/London', label: 'Harrow, London' },
  stanmore: { lat: 51.6066, lng: -0.3105, tz: 'Europe/London', label: 'Stanmore (Hujjat)' }
};
function getGPS() {
  return new Promise((res, rej) => navigator.geolocation
    ? navigator.geolocation.getCurrentPosition(p => res({ lat: +p.coords.latitude.toFixed(4), lng: +p.coords.longitude.toFixed(4), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, label: 'My location' }), () => rej(new Error('Location permission was refused.')), { timeout: 10000 })
    : rej(new Error('Location not available on this device.')));
}

function pickerView() {
  const f = fam();
  return `<div class="wrap center"><h2 style="margin-top:20px">Who's praying? 🤲</h2><p class="muted">${esc(f.name)}</p>
  <div class="picker">${f.members.map(m => `<button data-act="pick" data-id="${m.id}"><span class="avatar lg">${avatarOf(m)}</span>${esc(m.name)}<span class="small muted">${m.role === 'parent' ? 'Parent' : ''}</span></button>`).join('')}</div>
  <p class="hint" style="margin-top:24px">Each phone can belong to one person — pick yourself.</p>
  <button class="linkbtn" data-act="signout">Sign out of this family</button></div>`;
}

// ---------- Today ----------
function nextInfo() {
  const f = fam(), d = todayKey(), n = now();
  const { times } = S.windowsFor(f, d);
  const starts = [['Fajr', times.fajr, times.sunrise], ['Dhuhr & Asr', times.dhuhr, times.sunset], ['Maghrib & Isha', times.maghrib, times.midnight]];
  for (const [name, s, e] of starts) if (n >= s && n < e) return { now: true, name, end: e };
  // after midnight but before fajr: yesterday's Maghrib & Isha may still be open
  const y = S.windowsFor(f, PT.addDays(d, -1)).times;
  if (n < y.midnight) return { now: true, name: 'Maghrib & Isha', end: y.midnight };
  for (const [name, s] of starts) if (n < s) return { now: false, name, start: s };
  const tm = S.windowsFor(f, PT.addDays(d, 1)).times;
  return { now: false, name: 'Fajr', start: tm.fajr };
}
const dur = ms => { const m = Math.max(0, Math.round(ms / 60000)); const h = Math.floor(m / 60); return h ? `${h}h ${m % 60}m` : `${m}m`; };

function prayerDateFor(prayer) {
  // Before Fajr, Maghrib/Isha belong to yesterday
  const d = todayKey(), f = fam();
  if ((prayer === 'maghrib' || prayer === 'isha')) {
    const y = PT.addDays(d, -1);
    const yw = S.windowsFor(f, y).windows[prayer];
    if (now() < yw.end) return y;
  }
  return d;
}

function todayView() {
  const f = fam(), m = me(), d = todayKey(), c = copy();
  const { times, windows } = S.windowsFor(f, d);
  const h = HJ.toHijri(d, adj());
  const events = C.eventsOn(h);
  const ni = nextInfo();
  const mourning = C.isMourning(h), ram = C.isRamadhan(h);
  const stats = S.memberStats(f, m, d, now());
  const banners = [];
  for (const e of events) banners.push(`<div class="banner">${e.t === 'martyrdom' ? '🖤' : e.t === 'eid' ? '🎉' : e.t === 'birth' ? '🌸' : '📅'} ${esc(e.name)}</div>`);
  if (ram) banners.push(`<div class="banner">🌙 Ramadhan · Suhoor ends (imsak) <b>${t(S.windowsFor(f, PT.addDays(d, 1)).times.imsak)}</b> tomorrow · Iftar <b>${t(times.maghrib)}</b></div>`);
  else if (mourning && !events.length) banners.push(`<div class="banner">🖤 Days of mourning for Imam Husain (as)</div>`);

  const rows = PT.PRAYERS.map(p => {
    const date = prayerDateFor(p);
    const st = S.prayerStatus(f, m, date, p, now());
    const w = S.windowsFor(f, date).windows[p];
    let right = '';
    if (st.status === 'open') {
      const blocked = (p === 'asr' && !f.log?.[date]?.dhuhr?.[m.id]) || (p === 'isha' && !f.log?.[date]?.maghrib?.[m.id]);
      right = blocked ? `<span class="chip">After ${p === 'asr' ? 'Dhuhr' : 'Maghrib'}</span>` : `<button class="btn small" data-act="pray" data-p="${p}" data-d="${date}">${c.pray}</button>`;
    } else if (st.status === 'prayed') {
      const medal = ['🥇', '🥈', '🥉'][st.rank.place - 1] || '✅';
      right = `<span class="chip good">${medal} +${st.points}</span>`;
    } else if (st.status === 'upcoming') right = `<span class="chip">${t(w.start)}</span>`;
    else if (st.status === 'excused') right = `<span class="chip info">Excused</span>`;
    else if (st.status === 'missed') right = `<span class="chip bad">${st.points < 0 ? '−1' : 'Missed'}</span>`;
    else if (st.status === 'qadha') right = `<span class="chip warn">Qadha ✓</span>`;
    else if (st.status === 'late') right = `<span class="chip warn">Late</span>`;
    else if (st.status === 'forgiven') right = `<span class="chip warn">Forgiven</span>`;
    const canMenu = ['open', 'upcoming', 'excused', 'prayed'].includes(st.status);
    const extras = st.status === 'prayed' ? ' · ' + [st.extras ? `+${st.extras} extras` : '', st.jamaat ? '🤝 jamaat' : ''].filter(Boolean).join(' ') : '';
    return `<div class="prayer"><div class="picon">${ICON[p]}</div>
      <div class="grow"><div class="pname">${PT.PRAYER_NAMES[p]}</div><div class="ptime">${t(w.start)} – ${t(w.end)}${extras.length > 3 ? esc(extras) : ''}</div></div>
      ${right}${canMenu ? `<button class="more" aria-label="More" data-act="pmenu" data-p="${p}" data-d="${date}">⋯</button>` : ''}</div>`;
  }).join('');

  const saying = dailyWisdom();
  return `<div class="wrap">
    <div class="hero"><div class="stars">⭐</div>
      <div class="greet">${c.hello(firstName(m))}</div>
      <div class="dates">${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })} · ${hLabel(d)}</div>
      <div class="next">${ni.now ? `<span>It's time for</span><b>${ni.name}</b><span class="small">Ends at ${t(ni.end)} · ${dur(ni.end - now())} left</span>`
      : `<span>${c.next}</span><b>${ni.name} at ${t(ni.start)}</b><span class="small">in ${dur(ni.start - now())}</span>`}</div>
      ${banners.join('')}
    </div>
    <div class="row" style="margin-top:12px;gap:8px">
      <div class="stat"><b>${stats.all.points}</b><span>points</span></div>
      <div class="stat"><b>🔥 ${stats.current}</b><span>day streak</span></div>
      <div class="stat"><b>${stats.badges.length}</b><span>badges</span></div>
    </div>
    <div class="card">${rows}<p class="hint">Sunrise ${t(times.sunrise)} · Midnight (Jafari) ${t(times.midnight)} · ${esc(f.loc.label)}</p></div>
    ${familyTodayCard()}
    <div class="card"><h3>✨ Wisdom of the Ahlulbayt (as)</h3>
      <p style="margin:0 0 6px;font-size:16px;line-height:1.5">${esc(theme() === 'kids' ? saying.kid : saying.full)}</p>
      <p class="small muted" style="margin:0">— ${esc(saying.who)} · <i>${esc(saying.src)}</i></p></div>
    <div class="card row"><div class="grow"><b>💚 Give sadaqa</b><div class="small muted">After salat, give a little to The Zahra Trust</div></div><a class="btn small gold" href="${C.ZAHRA_TRUST_URL}" target="_blank" rel="noopener">Donate</a></div>
  </div>`;
}
function dailyWisdom() {
  const n = Math.floor(Date.UTC(...Object.values(PT.parseKey(todayKey())).map((v, i) => i === 1 ? v - 1 : v)) / 86400000);
  return C.WISDOM[n % C.WISDOM.length];
}
function familyTodayCard() {
  const f = fam(), d = todayKey(), parent = isParent();
  const rank = S.league(f, d, 'today', now());
  const rows = rank.map(r => {
    const dots = PT.PRAYERS.map(p => {
      const st = S.prayerStatus(f, r.member, prayerDateFor(p), p, now());
      let cls = st.status, label = '';
      if (st.status === 'prayed') label = st.rank.place;
      if (st.status === 'excused' && !parent && r.member.id !== state.me) { cls = ''; }
      if (st.status === 'excused' && (parent || r.member.id === state.me)) label = 'E';
      if (st.status === 'missed') label = '✕';
      return `<td><span class="dot ${cls}">${label}</span></td>`;
    }).join('');
    return `<tr><td><span style="font-size:18px">${avatarOf(r.member)}</span> ${firstName(r.member)}</td>${dots}<td><b>${r.points}</b></td></tr>`;
  }).join('');
  return `<div class="card"><div class="row between"><h3>👨‍👩‍👧‍👦 Today's family stars</h3><button class="linkbtn" data-act="tab" data-tab="league">League →</button></div>
    <table class="fgrid"><tr><th></th>${PT.PRAYERS.map(p => `<th>${ICON[p]}</th>`).join('')}<th>Pts</th></tr>${rows}</table>
    <p class="hint">Numbers show who prayed 1st, 2nd, 3rd…</p></div>`;
}

// ---------- League ----------
function leagueView() {
  const f = fam(), d = todayKey(), p = state.leaguePeriod;
  const rows = S.league(f, d, p, now());
  const parent = isParent();
  const list = rows.map((r, i) => {
    const st = S.streak(f, r.member, d, now());
    return `<div class="lrow ${r.member.id === state.me ? 'me' : ''}"><div class="pos">${['🥇', '🥈', '🥉'][i] || i + 1}</div><span class="avatar">${avatarOf(r.member)}</span>
      <div class="grow"><b>${esc(r.member.name)}</b><div class="small muted">${r.prayed} prayed · ${r.firsts} firsts · 🔥${st}${r.jamaat ? ` · 🤝${r.jamaat}` : ''}${parent && r.excused ? ` · ${r.excused} excused` : ''}${r.missed ? ` · ${r.missed} missed` : ''}</div></div>
      <div class="pts">${r.points}</div></div>`;
  }).join('');
  return `<div class="wrap"><h1 style="margin:12px 0">${copy().league} 🏆</h1>
    <div class="seg">${[['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['all', 'All time']].map(([k, l]) => `<button class="${p === k ? 'on' : ''}" data-act="lp" data-p="${k}">${l}</button>`).join('')}</div>
    <div class="card">${list}</div>
    <div class="card small muted"><b>How points work</b><br>1st to pray each salat gets ${f.members.length} points, 2nd gets ${f.members.length - 1}, and so on.
    Azaan, iqamah, Tasbih of Sayyida Fatima (sa) and a Quran verse are +1 each. Jamaat with family +${C.JAMAAT_BONUS}.
    A missed salat is −1 (only once salat is wajib, unless a parent changes this). Making it up as qadha gives the point back. Totals never go below zero.</div>
  </div>`;
}

// ---------- Reports & qadha ----------
function reportView() {
  const f = fam(), d = todayKey(), parent = isParent();
  const target = (parent && f.members.find(x => x.id === state.reportMember)) || me();
  const per = state.reportPeriod;
  const start = per === 'today' ? d : per === 'week' ? PT.addDays(d, -6) : PT.addDays(d, -29);
  const dates = S.dateRange(start, d).reverse();
  const s = S.summary(f, target, dates, now());
  const grid = dates.map(day => {
    const cells = PT.PRAYERS.map(p => {
      const st = S.prayerStatus(f, target, day, p, now());
      const label = st.status === 'prayed' ? st.points : st.status === 'missed' ? (st.points < 0 ? '−1' : '✕') : st.status === 'excused' ? 'E' : st.status === 'late' ? 'L' : st.status === 'qadha' ? 'Q' : st.status === 'forgiven' ? 'F' : '';
      const tappable = ['missed', 'late', 'forgiven', 'qadha'].includes(st.status) && (parent || (target.id === state.me && st.status === 'missed'));
      return `<div class="c">${tappable ? `<button class="dot ${st.status}" data-act="fix" data-d="${day}" data-p="${p}" data-m="${target.id}">${label}</button>` : `<span class="dot ${st.status === 'notJoined' ? '' : st.status}">${label}</span>`}</div>`;
    }).join('');
    return `<div class="d">${fmtDate(day, { weekday: 'short', day: 'numeric' })}</div>${cells}`;
  }).join('');
  const qList = S.qadhaList(f, target, d, now()).slice(-30).reverse();
  const manual = f.qadhaManual?.[target.id] || {};
  const canQadha = parent || target.id === state.me;
  return `<div class="wrap"><h1 style="margin:12px 0">Reports 📊</h1>
    ${parent ? `<div class="seg" style="margin-bottom:10px">${f.members.map(x => `<button class="${x.id === target.id ? 'on' : ''}" data-act="rm" data-id="${x.id}">${avatarOf(x)} ${firstName(x)}</button>`).join('')}</div>` : ''}
    <div class="seg">${[['today', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']].map(([k, l]) => `<button class="${per === k ? 'on' : ''}" data-act="rp" data-p="${k}">${l}</button>`).join('')}</div>
    <div class="card"><h3>${esc(target.name)} · ${per === 'today' ? 'today' : per === 'week' ? 'last 7 days' : 'last 30 days'}</h3>
      <div class="row" style="gap:8px"><div class="stat"><b>${s.points}</b><span>points</span></div><div class="stat"><b>${s.onTimePct ?? '–'}${s.onTimePct != null ? '%' : ''}</b><span>on time</span></div><div class="stat"><b>${s.firsts}</b><span>firsts</span></div></div>
      <div class="row" style="gap:8px;margin-top:8px"><div class="stat"><b>${s.prayed}</b><span>prayed</span></div><div class="stat"><b>${s.missed}</b><span>missed</span></div><div class="stat"><b>${s.jamaat}</b><span>jamaat</span></div><div class="stat"><b>${s.extras}</b><span>extras</span></div></div>
      ${s.onTimePct != null ? `<div class="bar" style="margin-top:12px"><i style="width:${s.onTimePct}%"></i></div>` : ''}
    </div>
    <div class="card"><div class="rgrid"><div></div>${PT.PRAYERS.map(p => `<div class="h">${ICON[p]}<br>${PT.PRAYER_NAMES[p]}</div>`).join('')}${grid}</div>
      <p class="hint">Numbers = points. E excused · L prayed late · Q made up · F forgiven by a parent. ${parent ? 'Tap a red or orange dot to change it.' : 'Tap a red dot when you have made it up.'}</p></div>
    <div class="card"><h3>🔁 Qadha (missed prayers)</h3>
      ${qList.length ? qList.map(q => `<div class="row between" style="padding:8px 0;border-top:1px solid var(--line)"><span>${ICON[q.prayer]} ${PT.PRAYER_NAMES[q.prayer]} · ${fmtDate(q.date)}</span>${canQadha ? `<button class="btn small ghost" data-act="qadha" data-d="${q.date}" data-p="${q.prayer}" data-m="${target.id}">Made up ✓</button>` : ''}</div>`).join('') : `<p class="muted">Nothing to make up. Mashallah! 🌟</p>`}
      <hr class="sep"><b class="small">Older qadha to make up</b><p class="hint" style="margin-top:2px">Keep count of qadha from before Salat Stars.</p>
      ${PT.PRAYERS.map(p => `<div class="row between" style="padding:6px 0"><span>${ICON[p]} ${PT.PRAYER_NAMES[p]}</span><span class="row">${canQadha ? `<button class="btn small ghost" data-act="qm" data-p="${p}" data-m="${target.id}" data-delta="-1">−</button>` : ''}<b style="min-width:34px;text-align:center">${manual[p] || 0}</b>${canQadha ? `<button class="btn small ghost" data-act="qm" data-p="${p}" data-m="${target.id}" data-delta="1">+</button>` : ''}</span></div>`).join('')}
    </div></div>`;
}

// ---------- Rewards ----------
function rewardsView() {
  const f = fam(), d = todayKey(), m = me(), parent = isParent();
  const stats = S.memberStats(f, m, d, now());
  const mine = (f.rewards || []).filter(r => !r.memberId || r.memberId === m.id);
  const rewardCard = r => {
    const who = r.memberId ? f.members.filter(x => x.id === r.memberId) : f.members.filter(x => x.role === 'child');
    const rowsFor = parent ? who : [m];
    return `<div style="padding:10px 0;border-top:1px solid var(--line)"><div class="row between"><b>🎁 ${esc(r.title)}</b><span class="chip">${r.points} pts</span></div>
      ${rowsFor.map(x => {
        const pts = S.memberStats(f, x, d, now()).all.points;
        const pct = Math.min(100, Math.round(pts / r.points * 100));
        const given = r.given?.[x.id];
        return `<div class="row" style="margin-top:8px"><span>${avatarOf(x)}</span><div class="grow"><div class="bar"><i style="width:${pct}%"></i></div><div class="small muted">${firstName(x)}: ${pts}/${r.points}${given ? ' · given ✓' : pct >= 100 ? ' · unlocked! 🎉' : ''}</div></div>
          ${parent && pct >= 100 && !given ? `<button class="btn small gold" data-act="give" data-id="${r.id}" data-m="${x.id}">Mark given</button>` : ''}</div>`;
      }).join('')}
      ${parent ? `<button class="linkbtn small" data-act="delreward" data-id="${r.id}">Remove</button>` : ''}</div>`;
  };
  return `<div class="wrap"><h1 style="margin:12px 0">Rewards 🎁</h1>
    <div class="row" style="gap:8px"><div class="stat"><b>${stats.all.points}</b><span>total points</span></div><div class="stat"><b>🔥 ${stats.current}</b><span>streak</span></div><div class="stat"><b>${stats.best}</b><span>best streak</span></div></div>
    <div class="card"><h3>${parent ? 'Family rewards' : 'Your rewards'}</h3>${(parent ? f.rewards : mine).map(rewardCard).join('') || '<p class="muted">No rewards set yet.' + (parent ? ' Add one below.' : ' Ask a parent to add one!') + '</p>'}
      ${parent ? `<button class="btn block ghost" style="margin-top:10px" data-act="addreward">＋ Add a reward</button>` : ''}</div>
    <div class="card"><h3>Badges</h3><div class="badges">${S.BADGES.map(b => `<div class="badge ${stats.badges.includes(b.id) ? '' : 'off'}"><div class="bi">${b.icon}</div><div class="bn">${b.name}</div><div class="bd">${b.desc}</div></div>`).join('')}</div></div>
  </div>`;
}

// ---------- Calendar ----------
function calendarView() {
  const d = todayKey(), a = adj();
  const h = HJ.toHijri(d, a);
  const items = [];
  for (const e of C.CALENDAR) {
    for (const hy of [h.hy, h.hy + 1]) {
      const key = HJ.fromHijri(hy, e.hm, e.hd, a, d);
      if (key >= d) { items.push({ ...e, key, hy }); break; }
    }
  }
  items.sort((x, y) => x.key < y.key ? -1 : 1);
  const icon = { martyrdom: '🖤', eid: '🎉', birth: '🌸', event: '📅' };
  return `<div class="wrap"><h1 style="margin:12px 0">Shia calendar 🌙</h1>
    <div class="card"><h2 class="center">${h.hd} ${HJ.HIJRI_MONTHS[h.hm - 1]} ${h.hy}</h2>
      <p class="center muted" style="margin:4px 0 0">${fmtLong(d)}</p>
      <p class="hint center">Hijri dates are calculated and may differ by a day from moon sighting. A parent can adjust this in Family → Settings.</p></div>
    <div class="card">${items.slice(0, 24).map(e => {
      const days = HJ.daysBetween(d, e.key);
      return `<div class="ev"><div class="when"><b>${PT.parseKey(e.key).d}</b><span>${fmtDate(e.key, { month: 'short' })}</span></div>
      <div class="grow"><b>${icon[e.t]} ${esc(e.name)}</b><div class="small muted">${e.hd} ${HJ.HIJRI_MONTHS[e.hm - 1]} ${e.hy} · ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}</div></div></div>`;
    }).join('')}</div></div>`;
}

// ---------- Family ----------
function bulughHTML(m) {
  if (!m.dob) return '<span class="muted small">Add a date of birth to see when salat becomes wajib.</span>';
  const d = todayKey(), a = adj();
  const b = HJ.bulugh(m.dob, m.sex, a, !!m.afterMaghrib);
  const nb = HJ.nextIslamicBirthday(m.dob, d, a, !!m.afterMaghrib);
  const days = HJ.daysBetween(d, b.dateKey);
  const lunar = HJ.lunarAge(m.dob, d, a, !!m.afterMaghrib), solar = HJ.solarAge(m.dob, d);
  let ob;
  if (days <= 0) ob = `<div class="chip good" style="margin-top:6px">✓ Salat wajib since ${fmtLong(b.dateKey)} · ${HJ.hijriLabel(b.dateHijri)}</div>`;
  else {
    const mo = Math.floor(days / 30.44), yr = Math.floor(mo / 12);
    ob = `<div style="margin-top:8px;padding:10px;border-radius:var(--radius-sm);background:var(--chip)"><b>⏳ Salat becomes wajib in ${days} days</b><br><span class="small">${yr ? `${yr} yr ${mo % 12} mo` : `${mo} months`} · on ${fmtLong(b.dateKey)} (${HJ.hijriLabel(b.dateHijri)})</span></div>`;
  }
  return `<div class="small" style="line-height:1.6">🎂 Born ${fmtLong(m.dob)} · <b>${HJ.hijriLabel(b.birthHijri)}</b><br>
    Age ${solar} (lunar age ${lunar}) · next Islamic birthday ${fmtDate(nb.key)} (${nb.age} lunar years)</div>${ob}
    <p class="hint">${m.sex === 'f' ? 'Girls: on completing 9 lunar years.' : 'Boys: on completing 15 lunar years, or earlier if another sign of bulugh appears.'}
    <a href="${C.SISTANI_RULING_URL}" target="_blank" rel="noopener">Sayyid Sistani, Islamic Laws, Ruling 2270</a> · <a href="${C.SISTANI_QA_URL}" target="_blank" rel="noopener">Q&amp;A</a></p>`;
}
function familyView() {
  const f = fam(), parent = isParent();
  const members = f.members.map(m => `<div class="card"><div class="row"><span class="avatar lg" style="width:56px;height:56px;font-size:30px">${avatarOf(m)}</span>
      <div class="grow"><h3 style="margin:0">${esc(m.name)}${m.id === state.me ? ' <span class="chip">you</span>' : ''}</h3><div class="small muted">${m.role === 'parent' ? 'Parent' : 'Child'} · ${S.themeFor(m, todayKey())} look</div></div>
      ${parent ? `<button class="btn small ghost" data-act="editm" data-id="${m.id}">Edit</button>` : ''}</div>
      <div style="margin-top:10px">${bulughHTML(m)}</div></div>`).join('');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const notif = ('Notification' in self) ? Notification.permission : 'unsupported';
  return `<div class="wrap"><h1 style="margin:12px 0">${esc(f.name)}</h1>
    <div class="card"><h3>🔔 Prayer notifications on this phone</h3>
      ${ios && !standalone ? `<p class="small">On iPhone, first add Salat Stars to your Home Screen: tap <b>Share</b> → <b>Add to Home Screen</b>, then open it from there and come back here.</p>`
      : notif === 'granted' && ls.get('pushOn') ? `<p class="small">✅ On. You'll get a notification at Fajr, Dhuhr &amp; Asr, and Maghrib &amp; Isha, plus a reminder 20 minutes before a prayer ends.</p><button class="btn small ghost" data-act="testpush">Send a test</button> <button class="btn small ghost" data-act="pushoff">Turn off</button>`
      : notif === 'unsupported' ? `<p class="small">This browser can't show notifications.</p>`
      : `<p class="small">Get told when salat time is here.</p><button class="btn block" data-act="pushon">Turn on notifications</button>`}
    </div>
    ${members}
    ${parent ? `<button class="btn block" data-act="addm">＋ Add a family member</button>` : ''}
    <div class="card"><h3>👪 Invite family</h3><p class="small">Family code <span class="kbd">${esc(f.code)}</span> and the family password. Each person opens the app on their own phone, taps <b>Join my family</b>, then picks themselves.</p></div>
    ${parent ? settingsCard() : ''}
    <div class="card"><button class="btn block ghost" data-act="switch">Switch person</button>
      <button class="btn block ghost" style="margin-top:8px" data-act="signout">Sign out of this phone</button></div>
    <p class="hint center">Prayer times: ${esc(S.windowsFor(f, todayKey()) && (PT.PROFILES[f.loc.profile || 'hujjat'].label))} · Bulugh: Sayyid Sistani · Sayings: Nahj al-Balagha</p>
  </div>`;
}
function settingsCard() {
  const f = fam();
  return `<div class="card"><h3>⚙️ Settings (parents)</h3><form data-form="settings">
    <label>Family name</label><input name="name" value="${esc(f.name)}">
    <label>Prayer times location</label><select name="loc"><option value="">Keep: ${esc(f.loc.label)}</option><option value="harrow">Harrow, London</option><option value="stanmore">Stanmore (Hujjat)</option><option value="gps">Use my current location</option></select>
    <label>Calculation</label><select name="profile">${Object.entries(PT.PROFILES).map(([k, p]) => `<option value="${k}" ${f.loc.profile === k ? 'selected' : ''}>${p.label}</option>`).join('')}</select>
    <p class="hint">"Hujjat style" was matched to hujjat.org's timetable.</p>
    <label>Hijri date adjustment</label><select name="hijriAdj">${[-3, -2, -1, 0, 1, 2, 3].map(v => `<option value="${v}" ${(f.hijriAdj ?? -2) === v ? 'selected' : ''}>${v > 0 ? '+' : ''}${v} day${Math.abs(v) === 1 ? '' : 's'} → ${HJ.hijriLabel(HJ.toHijri(todayKey(), v))}</option>`).join('')}</select>
    <p class="hint">Pick the option that matches today's date at your mosque.</p>
    <label>New family password (optional)</label><input name="password" type="password" minlength="6" autocomplete="new-password">
    <button class="btn block" style="margin-top:14px">Save settings</button></form>
    <hr class="sep"><b class="small">Weekly email report</b><p class="hint">Sent on Sundays at 7pm to parents with an email address (add it under Edit). Needs the email key set up on the server.</p>
    <button class="btn small ghost" data-act="testemail">Send a test email now</button></div>`;
}
function memberForm(m = {}) {
  const editing = !!m.id;
  return `<h2>${editing ? 'Edit ' + esc(m.name) : 'Add a family member'}</h2><form data-form="member">
    <input type="hidden" name="id" value="${esc(m.id || '')}">
    <label>Name</label><input name="name" value="${esc(m.name || '')}" required>
    <div class="row"><div class="grow"><label>Date of birth</label><input name="dob" type="date" value="${esc(m.dob || '')}"></div>
    <div style="width:130px"><label>Sex</label><select name="sex"><option value="m" ${m.sex === 'm' ? 'selected' : ''}>Male</option><option value="f" ${m.sex === 'f' ? 'selected' : ''}>Female</option></select></div></div>
    <label class="check"><input type="checkbox" name="afterMaghrib" ${m.afterMaghrib ? 'checked' : ''}> Born after Maghrib (Islamic date is the next day)</label>
    <label>Role</label><select name="role"><option value="child" ${m.role !== 'parent' ? 'selected' : ''}>Child</option><option value="parent" ${m.role === 'parent' ? 'selected' : ''}>Parent</option></select>
    <label>Parent PIN ${editing ? '(leave blank to keep)' : '(parents only)'}</label><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,8}">
    <label>Email (parents, for weekly report)</label><input name="email" type="email" value="${esc(m.email || '')}">
    <label>Look</label><select name="theme">${[['auto', 'Automatic by age'], ['kids', 'Kids (8–11)'], ['tween', 'Tween (12–15)'], ['teen', 'Teen (16+)'], ['adult', 'Adult']].map(([k, l]) => `<option value="${k}" ${(m.theme || 'auto') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <label>Minus point for a missed salat</label><select name="penalties">${[['auto', 'Automatic — only once salat is wajib'], ['on', 'Always'], ['off', 'Never']].map(([k, l]) => `<option value="${k}" ${(m.penalties || 'auto') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <label>Avatar</label><div class="row" style="flex-wrap:wrap;gap:6px">${AVATARS.map(a => `<label style="margin:0"><input type="radio" name="avatar" value="${a}" ${avatarOf(m) === a && m.avatar ? 'checked' : ''} style="display:none"><span class="avatar" data-av>${a}</span></label>`).join('')}</div>
    <div class="err" id="err"></div>
    <button class="btn block" style="margin-top:16px">${editing ? 'Save' : 'Add'}</button>
    ${editing && m.id !== state.me ? `<button type="button" class="btn block danger" style="margin-top:8px" data-act="delm" data-id="${m.id}">Remove from family</button>` : ''}
  </form>`;
}

// ---------- Daily saying (must tap OK) ----------
function sayingOfDay() {
  const { y, m, d } = PT.parseKey(todayKey());
  const n = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return C.SAYINGS[n % C.SAYINGS.length];
}
function showSaying() {
  const s = sayingOfDay(), kid = theme() === 'kids';
  openSheet(`<div class="saying"><div style="font-size:40px">🌟</div><h2>Imam Ali (as) says…</h2>
    <p class="q">“${esc(kid ? s.kid : s.full)}”</p>
    ${kid ? `<p class="small muted">${esc(s.full)}</p>` : ''}
    <p class="src">Nahj al-Balagha, Saying ${s.n} · <a href="${C.sayingLink(s.n)}" target="_blank" rel="noopener">read it</a></p>
    <button class="btn block" style="margin-top:14px" data-act="ack">OK, inshallah I'll remember 🤲</button></div>`, { middle: true, locked: true });
}

// ---------- main render ----------
function nav() {
  const tabs = [['today', '🕌', 'Today'], ['league', '🏆', 'League'], ['report', '📊', 'Reports'], ['rewards', '🎁', 'Rewards'], ['calendar', '🌙', 'Calendar'], ['family', '👪', 'Family']];
  return `<nav class="tabs"><div class="in">${tabs.map(([k, i, l]) => `<button class="${state.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}"><span class="ti">${i}</span>${l}</button>`).join('')}</div></nav>`;
}
function render() {
  applyTheme();
  if (!state.token || !fam()) {
    $app.innerHTML = state.view === 'join' ? joinView() : state.view === 'create' ? createView() : welcome();
    return;
  }
  if (!me()) { $app.innerHTML = pickerView(); return; }
  const views = { today: todayView, league: leagueView, report: reportView, rewards: rewardsView, calendar: calendarView, family: familyView };
  $app.innerHTML = (views[state.tab] || todayView)() + nav();
  syncMeta();
  if ((fam().ack?.[state.me] !== todayKey()) && !sheetOpen()) showSaying();
}
function syncMeta() {
  navigator.serviceWorker?.controller?.postMessage({ type: 'meta', meta: { c: fam().code, m: state.me } });
}

// ---------- actions ----------
const handlers = {
  go: el => { state.view = el.dataset.view || null; render(); },
  tab: el => { state.tab = el.dataset.tab; render(); scrollTo(0, 0); },
  lp: el => { state.leaguePeriod = el.dataset.p; render(); },
  rp: el => { state.reportPeriod = el.dataset.p; render(); },
  rm: el => { state.reportMember = el.dataset.id; render(); },
  signout: () => { if (confirmBox('Sign out of Salat Stars on this phone?')) signOut(); },
  switch: () => { state.me = null; ls.del('me'); state.pin = null; ss.set('pin', null); render(); },
  pick: el => {
    const m = fam().members.find(x => x.id === el.dataset.id);
    if (m.role === 'parent' && m.hasPin) {
      openSheet(`<h2>${avatarOf(m)} ${esc(m.name)}</h2><p class="muted">Enter your parent PIN</p><form data-form="pin"><input type="hidden" name="id" value="${m.id}">
        <input name="pin" type="password" inputmode="numeric" autofocus required><div class="err" id="err"></div><button class="btn block" style="margin-top:14px">Continue</button></form>`);
      return;
    }
    choose(m.id);
  },
  ack: async () => {
    closeSheet();
    try { await act('ack'); } catch (e) { const f = fam(); f.ack ||= {}; f.ack[state.me] = todayKey(); }
    render();
  },
  pray: el => {
    const p = el.dataset.p, date = el.dataset.d, kid = theme() === 'kids';
    openSheet(`<h2>${ICON[p]} ${PT.PRAYER_NAMES[p]}</h2><p class="muted">${kid ? 'Did you do any of these too? Each one is +1 ⭐' : 'Extras (+1 each)'}</p>
      <form data-form="pray"><input type="hidden" name="p" value="${p}"><input type="hidden" name="d" value="${date}">
      ${C.EXTRAS.map(x => `<label class="check"><input type="checkbox" name="${x.id}"> ${x.icon} ${x.label}</label>`).join('')}
      <label class="check"><input type="checkbox" name="jamaat"> 🤝 Prayed in jamaat with family (+${C.JAMAAT_BONUS})</label>
      <div class="err" id="err"></div><button class="btn block" style="margin-top:16px">${copy().pray}</button></form>`);
  },
  pmenu: el => {
    const p = el.dataset.p, date = el.dataset.d, f = fam();
    const st = S.prayerStatus(f, me(), date, p, now());
    const ex = st.status === 'excused';
    openSheet(`<h2>${ICON[p]} ${PT.PRAYER_NAMES[p]}</h2>
      ${st.status === 'prayed' ? `<button class="btn block ghost" data-act="editextras" data-p="${p}" data-d="${date}">Change extras</button>
         <button class="btn block ghost" style="margin-top:8px" data-act="unlog" data-p="${p}" data-d="${date}">Undo (tapped by mistake)</button>` : `
      <p class="small muted">Excused prayers don't lose points or break your streak. Only parents can see this.</p>
      <button class="btn block ghost" data-act="excuse" data-p="${p}" data-d="${date}" data-on="${ex ? '0' : '1'}">${ex ? 'Remove excused' : 'Mark this salat excused'}</button>
      ${!ex ? `<button class="btn block ghost" style="margin-top:8px" data-act="excuse" data-p="all" data-d="${date}" data-on="1">Excused for the whole day</button>` : ''}`}
      <button class="btn block" style="margin-top:8px" data-act="close">Cancel</button>`);
  },
  editextras: el => {
    const p = el.dataset.p, date = el.dataset.d;
    const e = fam().log?.[date]?.[p]?.[state.me] || {};
    openSheet(`<h2>${ICON[p]} ${PT.PRAYER_NAMES[p]} extras</h2><form data-form="extras"><input type="hidden" name="p" value="${p}"><input type="hidden" name="d" value="${date}">
      ${C.EXTRAS.map(x => `<label class="check"><input type="checkbox" name="${x.id}" ${e.extras?.[x.id] ? 'checked' : ''}> ${x.icon} ${x.label}</label>`).join('')}
      <label class="check"><input type="checkbox" name="jamaat" ${e.jamaat ? 'checked' : ''}> 🤝 Jamaat with family</label>
      <button class="btn block" style="margin-top:16px">Save</button></form>`);
  },
  unlog: async el => run(async () => { await act('unlog', { prayer: el.dataset.p, date: el.dataset.d }); closeSheet(); toast('Undone'); }),
  excuse: async el => run(async () => {
    const prayers = el.dataset.p === 'all' ? PT.PRAYERS : [el.dataset.p];
    await act('excuse', { prayers, date: el.dataset.d, on: el.dataset.on === '1' });
    closeSheet(); toast(el.dataset.on === '1' ? 'Marked excused — no points lost' : 'Excused removed');
  }),
  close: () => { closeSheet(); render(); },
  fix: el => {
    const { d, p, m } = el.dataset, f = fam(), target = f.members.find(x => x.id === m);
    const st = S.prayerStatus(f, target, d, p, now());
    if (!isParent()) { // child: only make up qadha
      openSheet(`<h2>${ICON[p]} ${PT.PRAYER_NAMES[p]} · ${fmtDate(d)}</h2><p class="muted">Have you prayed this as qadha? You'll get your point back.</p>
        <button class="btn block" data-act="qadha" data-d="${d}" data-p="${p}" data-m="${m}">Yes, I made it up ✓</button><button class="btn block ghost" style="margin-top:8px" data-act="close">Not yet</button>`);
      return;
    }
    openSheet(`<h2>${firstName(target)} · ${PT.PRAYER_NAMES[p]} · ${fmtDate(d)}</h2><p class="muted">Now: <b>${st.status}</b>. Parent options:</p>
      <button class="btn block ghost" data-act="ovr" data-v="cancel" data-d="${d}" data-p="${p}" data-m="${m}">Cancel the −1 (forgive)</button>
      <button class="btn block ghost" style="margin-top:8px" data-act="ovr" data-v="late" data-d="${d}" data-p="${p}" data-m="${m}">Prayed late (no points, no −1)</button>
      <button class="btn block ghost" style="margin-top:8px" data-act="qadha" data-d="${d}" data-p="${p}" data-m="${m}">Made up as qadha</button>
      <button class="btn block ghost" style="margin-top:8px" data-act="ovr" data-v="" data-d="${d}" data-p="${p}" data-m="${m}">Clear (back to missed)</button>
      <button class="btn block" style="margin-top:8px" data-act="close">Cancel</button>`);
  },
  ovr: el => run(async () => {
    const { d, p, m, v } = el.dataset;
    if (v === '') { await act('qadhaFor', { date: d, prayer: p, memberId: m, undo: true }); }
    await act('override', { date: d, prayer: p, memberId: m, value: v || null });
    closeSheet(); toast('Updated');
  }),
  qadha: el => run(async () => {
    const { d, p, m } = el.dataset;
    if (m === state.me) await act('qadha', { date: d, prayer: p }); else await act('qadhaFor', { date: d, prayer: p, memberId: m });
    closeSheet(); toast('Qadha recorded — point given back 🌟');
  }),
  qm: el => run(() => act('qadhaManual', { memberId: el.dataset.m, prayer: el.dataset.p, delta: +el.dataset.delta })),
  addreward: () => {
    const f = fam();
    openSheet(`<h2>🎁 Add a reward</h2><form data-form="reward"><label>Reward</label><input name="title" placeholder="e.g. Trip to the park" required>
      <label>Points needed</label><input name="points" type="number" min="1" value="500" required>
      <label>For</label><select name="memberId"><option value="">All children</option>${f.members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
      <button class="btn block" style="margin-top:16px">Add reward</button></form>`);
  },
  delreward: el => run(() => act('removeReward', { id: el.dataset.id })),
  give: el => run(async () => { await act('giveReward', { id: el.dataset.id, memberId: el.dataset.m }); toast('Reward given 🎉'); confetti(); }),
  addm: () => openSheet(memberForm()),
  editm: el => openSheet(memberForm(fam().members.find(m => m.id === el.dataset.id))),
  delm: el => { if (confirmBox('Remove this person and their scores from the family?')) run(async () => { await act('removeMember', { memberId: el.dataset.id }); closeSheet(); }); },
  pushon: () => run(enablePush),
  pushoff: () => run(async () => {
    const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
    if (sub) { await act('pushSubscribe', { sub: sub.toJSON(), off: true }); await sub.unsubscribe(); }
    ls.set('pushOn', false); toast('Notifications off');
  }),
  testpush: () => run(async () => { const r = await act('testPush'); toast(r.results?.length ? 'Test sent — check your notifications' : 'No subscription on this phone yet'); }),
  testemail: () => run(async () => { const r = await act('testEmail'); toast(r.result === 'no-key' ? 'Email isn\'t set up on the server yet' : r.result === 'no-recipients' ? 'Add a parent email first (Edit)' : r.result === 200 ? 'Email sent ✓' : 'Email service replied ' + r.result); })
};
const confirmBox = msg => window.confirm(msg);
async function run(fn) {
  try { await fn(); render(); } catch (e) {
    const err = document.getElementById('err');
    if (err && sheetOpen()) err.textContent = e.message; else toast(e.message);
  }
}
function choose(id) {
  state.me = id; ls.set('me', id); closeSheet(); state.tab = 'today'; render();
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  e.preventDefault();
  handlers[el.dataset.act]?.(el, e);
});
document.addEventListener('change', e => {
  if (e.target.name === 'avatar') document.querySelectorAll('[data-av]').forEach(a => a.style.outline = a.previousElementSibling.checked ? '3px solid var(--brand)' : '');
});

const forms = {
  async login(fd) {
    const d = await api('login', { code: fd.get('code'), password: fd.get('password') });
    state.token = d.token; ls.set('token', d.token); setFam(d.fam); state.view = null;
  },
  async create(fd) {
    let loc = LOCS[fd.get('loc')];
    if (fd.get('loc') === 'gps') loc = await getGPS();
    const d = await api('create', {
      name: fd.get('name'), code: fd.get('code'), password: fd.get('password'), loc: { ...loc, profile: 'hujjat' },
      parent: { name: fd.get('pname'), dob: fd.get('dob'), sex: fd.get('sex'), pin: fd.get('pin'), email: fd.get('email') }
    });
    state.token = d.token; ls.set('token', d.token); setFam(d.fam); state.view = null;
    state.pin = fd.get('pin'); ss.set('pin', state.pin);
    choose(d.me); state.tab = 'family';
    toast('Family created! Now add everyone 👪');
  },
  async pin(fd) {
    const id = fd.get('id'), pin = fd.get('pin');
    await api('checkPin', { actor: id, pin });
    state.pin = pin; ss.set('pin', pin); choose(id);
  },
  async pray(fd) {
    const p = fd.get('p'), date = fd.get('d');
    const extras = Object.fromEntries(C.EXTRAS.map(x => [x.id, fd.get(x.id) === 'on']));
    await act('log', { prayer: p, date, extras, jamaat: fd.get('jamaat') === 'on' });
    const st = S.prayerStatus(fam(), me(), date, p, now());
    const place = st.rank?.place || 1;
    const kid = theme() === 'kids';
    openSheet(`<div class="celebrate"><div class="big">${['🥇', '🥈', '🥉'][place - 1] || '🌟'}</div>
      <h2>${copy().done}</h2><div class="pts">+${st.points}</div>
      <p class="muted">${place === 1 ? (kid ? 'You were FIRST! Amazing! 🎉' : 'First in the family') : `${['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][place] || place + 'th'} in the family`} · ${PT.PRAYER_NAMES[p]}</p>
      <a class="btn block gold" style="margin-top:12px" href="${C.ZAHRA_TRUST_URL}" target="_blank" rel="noopener">💚 Give sadaqa · The Zahra Trust</a>
      <button class="btn block ghost" style="margin-top:8px" data-act="close">Done</button></div>`);
    confetti();
  },
  async extras(fd) {
    const extras = Object.fromEntries(C.EXTRAS.map(x => [x.id, fd.get(x.id) === 'on']));
    await act('updateExtras', { prayer: fd.get('p'), date: fd.get('d'), extras, jamaat: fd.get('jamaat') === 'on' });
    closeSheet(); toast('Saved');
  },
  async member(fd) {
    const member = { name: fd.get('name'), dob: fd.get('dob'), sex: fd.get('sex'), role: fd.get('role'), email: fd.get('email'), theme: fd.get('theme'), penalties: fd.get('penalties'), afterMaghrib: fd.get('afterMaghrib') === 'on' };
    if (fd.get('avatar')) member.avatar = fd.get('avatar');
    if (fd.get('pin')) member.pin = fd.get('pin');
    if (member.role === 'parent' && !fd.get('id') && !member.pin) throw new Error('Parents need a PIN.');
    if (fd.get('id')) { member.id = fd.get('id'); await act('updateMember', { member }); }
    else await act('addMember', { member });
    closeSheet(); toast(fd.get('id') ? 'Saved' : `${member.name} added 🎉`);
  },
  async reward(fd) {
    await act('addReward', { title: fd.get('title'), points: +fd.get('points'), memberId: fd.get('memberId') || null });
    closeSheet(); toast('Reward added 🎁');
  },
  async settings(fd) {
    const s = { name: fd.get('name'), hijriAdj: +fd.get('hijriAdj') };
    const l = fd.get('loc');
    if (l === 'gps') s.loc = await getGPS(); else if (LOCS[l]) s.loc = { ...LOCS[l] };
    s.loc = { ...(s.loc || {}), profile: fd.get('profile') };
    if (fd.get('password')) s.password = fd.get('password');
    await act('settings', { settings: s });
    toast('Settings saved');
  }
};
document.addEventListener('submit', async e => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const btn = form.querySelector('button:not([type=button])');
  if (btn) btn.disabled = true;
  try { await forms[form.dataset.form](new FormData(form)); if (form.dataset.form !== 'pray') render(); }
  catch (err) { const el = form.querySelector('#err') || document.getElementById('err'); if (el) el.textContent = err.message; else toast(err.message); }
  finally { if (btn) btn.disabled = false; }
});

// ---------- push ----------
function b64ToU8(s) { const p = '='.repeat((4 - s.length % 4) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); }
async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('This browser does not support notifications. On iPhone, add the app to your Home Screen first.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications were not allowed. You can allow them in your phone settings.');
  const reg = await navigator.serviceWorker.ready;
  const { key } = await api('vapid');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(key) });
  await act('pushSubscribe', { sub: sub.toJSON() });
  syncMeta();
  ls.set('pushOn', true);
  toast('Notifications on 🔔');
}

// ---------- boot ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').then(() => fam() && state.me && syncMeta()).catch(() => { });
render();
refresh().then(render);
setInterval(() => { if (!sheetOpen() && !document.querySelector('form:focus-within')) render(); }, 30000);
setInterval(() => { if (!sheetOpen()) refresh().then(() => !sheetOpen() && !document.querySelector('form:focus-within') && render()); }, 90000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh().then(() => !sheetOpen() && render()); });
