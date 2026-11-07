// Salat Stars scoring — pure functions shared by app and server.
//
// Family doc shape (stored in KV):
// { code, name, loc:{lat,lng,tz,label,profile}, hijriAdj, createdAt,
//   members:[{id,name,dob,sex,role,joined,penalties,theme,afterMaghrib,avatar,email}],
//   log:{ [date]: { [prayer]: { [memberId]: {t, extras:{azaan,iqamah,tasbih,quran}, jamaat} } } },
//   excused:{ [date]: { [memberId]: { [prayer]: true } } },
//   overrides:{ [`${date}|${prayer}|${mid}`]: 'cancel' | 'late' },
//   qadhaDone:{ [`${date}|${prayer}|${mid}`]: isoTime },
//   qadhaManual:{ [mid]: { fajr:0, dhuhr:0, asr:0, maghrib:0, isha:0 } },
//   rewards:[{id, title, points, memberId|null, given:{[mid]:iso}}],
//   ack:{ [mid]: date } }
import { PRAYERS, prayerWindows, addDays } from './praytimes.js';
import { bulugh } from './hijri.js';
import { EXTRAS, JAMAAT_BONUS } from './content.js';

const winCache = new Map();
export function windowsFor(fam, date) {
  const k = `${date}|${fam.loc.lat}|${fam.loc.lng}|${fam.loc.tz}|${fam.loc.profile}`;
  if (!winCache.has(k)) winCache.set(k, prayerWindows(date, fam.loc));
  return winCache.get(k);
}

/** Should missed prayers cost -1 for this member on this date? */
export function penaltiesApply(fam, member, date) {
  const mode = member.penalties || 'auto';
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  // auto: only once salat is wajib (bulugh, Sistani Ruling 2270)
  if (!member.dob) return true;
  const b = bulugh(member.dob, member.sex, fam.hijriAdj || 0, !!member.afterMaghrib);
  return date >= b.dateKey;
}

/**
 * Ranking points for one prayer on one date. Earliest tap gets N points (N = family size),
 * next N-1 … minimum 1. Taps in the same minute share the higher score.
 */
export function rankPoints(fam, date, prayer) {
  const entries = Object.entries(fam.log?.[date]?.[prayer] || {})
    .filter(([mid, e]) => !e.late)
    .map(([mid, e]) => ({ mid, minute: Math.floor(new Date(e.t).getTime() / 60000) }))
    .sort((a, b) => a.minute - b.minute);
  const N = Math.max(fam.members.length, 1);
  const out = {};
  let place = 0;
  entries.forEach((e, i) => {
    if (i === 0 || e.minute !== entries[i - 1].minute) place = i;
    out[e.mid] = { place: place + 1, points: Math.max(N - place, 1) };
  });
  return out;
}

/**
 * Status of one prayer for a member.
 * returns { status, points, rank?, extras?, jamaat? }
 * status: upcoming | open | prayed | late | excused | missed | forgiven | qadha | notJoined
 */
export function prayerStatus(fam, member, date, prayer, now = new Date()) {
  if (member.joined && date < member.joined) return { status: 'notJoined', points: 0 };
  const { windows } = windowsFor(fam, date);
  const w = windows[prayer];
  const entry = fam.log?.[date]?.[prayer]?.[member.id];
  const key = `${date}|${prayer}|${member.id}`;
  if (entry && !entry.late) {
    const rank = rankPoints(fam, date, prayer)[member.id] || { place: 0, points: 1 };
    const extras = EXTRAS.filter(x => entry.extras?.[x.id]).length;
    const jam = entry.jamaat ? JAMAAT_BONUS : 0;
    return { status: 'prayed', points: rank.points + extras + jam, rank, extras, jamaat: !!entry.jamaat, t: entry.t };
  }
  if (entry && entry.late) return { status: 'late', points: 0, t: entry.t };
  if (fam.excused?.[date]?.[member.id]?.[prayer]) return { status: 'excused', points: 0 };
  if (now < w.start) return { status: 'upcoming', points: 0, start: w.start, end: w.end };
  // Prayers that had already ended before this person joined don't count against them
  if (member.joinedAt && w.end <= new Date(member.joinedAt)) return { status: 'notJoined', points: 0 };
  if (now < w.end) return { status: 'open', points: 0, start: w.start, end: w.end };
  // Window has ended without the prayer being recorded
  if (fam.overrides?.[key] === 'late') return { status: 'late', points: 0 };
  if (fam.overrides?.[key] === 'cancel') return { status: 'forgiven', points: 0 };
  if (fam.qadhaDone?.[key]) return { status: 'qadha', points: 0 }; // made up: the -1 is given back
  const pen = penaltiesApply(fam, member, date) ? -1 : 0;
  return { status: 'missed', points: pen };
}

export function dayScore(fam, member, date, now = new Date()) {
  const per = {};
  let points = 0;
  for (const p of PRAYERS) { per[p] = prayerStatus(fam, member, date, p, now); points += per[p].points; }
  return { per, points };
}

/** All date keys from a to b inclusive. */
export function dateRange(a, b) {
  const out = [];
  for (let k = a; k <= b; k = addDays(k, 1)) out.push(k);
  return out;
}

export function earliestDate(fam) {
  return (fam.createdAt || '').slice(0, 10) || Object.keys(fam.log || {}).sort()[0];
}

/** Summary for a member across dates. Total never goes below zero. */
export function summary(fam, member, dates, now = new Date()) {
  const s = { points: 0, prayed: 0, firsts: 0, missed: 0, late: 0, excused: 0, qadha: 0, extras: 0, jamaat: 0, possible: 0, forgiven: 0 };
  for (const d of dates) {
    const { per, points } = dayScore(fam, member, d, now);
    s.points += points;
    for (const p of PRAYERS) {
      const st = per[p];
      if (st.status === 'notJoined' || st.status === 'upcoming') continue;
      if (st.status === 'open') continue;
      s.possible++;
      if (st.status === 'prayed') { s.prayed++; s.extras += st.extras; if (st.jamaat) s.jamaat++; if (st.rank?.place === 1) s.firsts++; }
      if (st.status === 'missed') s.missed++;
      if (st.status === 'late') s.late++;
      if (st.status === 'excused') s.excused++;
      if (st.status === 'qadha') s.qadha++;
      if (st.status === 'forgiven') s.forgiven++;
    }
  }
  s.points = Math.max(0, s.points);
  const counted = s.possible - s.excused;
  s.onTimePct = counted > 0 ? Math.round((s.prayed / counted) * 100) : null;
  return s;
}

/** Streak of full days (all 5 prayed on time or excused), counting back from today. */
export function streak(fam, member, todayKey, now = new Date()) {
  const ok = st => st.status === 'prayed' || st.status === 'excused';
  let n = 0;
  const today = dayScore(fam, member, todayKey, now).per;
  const todayDone = PRAYERS.every(p => ok(today[p]));
  if (todayDone) n++;
  const first = member.joined || earliestDate(fam);
  for (let d = addDays(todayKey, -1); d >= first; d = addDays(d, -1)) {
    const per = dayScore(fam, member, d, now).per;
    if (PRAYERS.every(p => ok(per[p]))) n++; else break;
    if (n > 2000) break;
  }
  return n;
}

export function bestStreak(fam, member, todayKey, now = new Date()) {
  const ok = st => st.status === 'prayed' || st.status === 'excused';
  let best = 0, cur = 0;
  const first = member.joined || earliestDate(fam);
  for (const d of dateRange(first, todayKey)) {
    const per = dayScore(fam, member, d, now).per;
    if (PRAYERS.every(p => ok(per[p]))) { cur++; best = Math.max(best, cur); } else if (d !== todayKey) cur = 0;
  }
  return best;
}

/** Missed prayers that can still be made up (qadha list). */
export function qadhaList(fam, member, todayKey, now = new Date()) {
  const out = [];
  const first = member.joined || earliestDate(fam);
  for (const d of dateRange(first, todayKey)) {
    for (const p of PRAYERS) {
      const st = prayerStatus(fam, member, d, p, now);
      if (st.status === 'missed') out.push({ date: d, prayer: p });
    }
  }
  return out;
}

export const BADGES = [
  { id: 'first', icon: '🌱', name: 'First Step', desc: 'Record your first salat', test: s => s.all.prayed >= 1 },
  { id: 'fajr', icon: '🌅', name: 'Dawn Star', desc: 'Pray Fajr on time 10 times', test: s => s.fajrCount >= 10 },
  { id: 's3', icon: '🔥', name: '3-Day Streak', desc: 'All 5 prayers for 3 days in a row', test: s => s.best >= 3 },
  { id: 's7', icon: '⭐', name: 'Week of Light', desc: '7-day streak', test: s => s.best >= 7 },
  { id: 's30', icon: '🌙', name: 'Full Moon', desc: '30-day streak', test: s => s.best >= 30 },
  { id: 's100', icon: '👑', name: 'Century', desc: '100-day streak', test: s => s.best >= 100 },
  { id: 'j1', icon: '🤝', name: 'Together', desc: 'Pray in jamaat with family', test: s => s.all.jamaat >= 1 },
  { id: 'j25', icon: '🕌', name: 'Jamaat Hero', desc: '25 prayers in jamaat', test: s => s.all.jamaat >= 25 },
  { id: 't50', icon: '📿', name: 'Tasbih Keeper', desc: '50 extras (azaan, iqamah, tasbih, Quran)', test: s => s.all.extras >= 50 },
  { id: 'first10', icon: '🥇', name: 'Early Bird', desc: 'Be first in the family 10 times', test: s => s.all.firsts >= 10 },
  { id: 'p100', icon: '💯', name: '100 Points', desc: 'Reach 100 points', test: s => s.all.points >= 100 },
  { id: 'p500', icon: '🏅', name: '500 Points', desc: 'Reach 500 points', test: s => s.all.points >= 500 },
  { id: 'p1000', icon: '🏆', name: '1,000 Points', desc: 'Reach 1,000 points', test: s => s.all.points >= 1000 },
  { id: 'q1', icon: '🔁', name: 'Comeback', desc: 'Make up a qadha prayer', test: s => s.all.qadha >= 1 }
];

export function memberStats(fam, member, todayKey, now = new Date()) {
  const first = member.joined || earliestDate(fam) || todayKey;
  const dates = dateRange(first, todayKey);
  const all = summary(fam, member, dates, now);
  let fajrCount = 0;
  for (const d of dates) if (prayerStatus(fam, member, d, 'fajr', now).status === 'prayed') fajrCount++;
  const best = bestStreak(fam, member, todayKey, now);
  const s = { all, fajrCount, best, current: streak(fam, member, todayKey, now) };
  s.badges = BADGES.filter(b => b.test(s)).map(b => b.id);
  return s;
}

/** League rows for a period. period: today | week | month | all */
export function league(fam, todayKey, period, now = new Date()) {
  const start = period === 'today' ? todayKey
    : period === 'week' ? addDays(todayKey, -6)
    : period === 'month' ? addDays(todayKey, -29)
    : (earliestDate(fam) || todayKey);
  const dates = dateRange(start, todayKey);
  return fam.members.map(m => ({ member: m, ...summary(fam, m, dates, now) }))
    .sort((a, b) => b.points - a.points || b.prayed - a.prayed);
}

/** Theme by solar age: kids 8–11 (and younger), tween 12–15, teen 16–17, adult 18+. */
export function themeFor(member, todayKey) {
  if (member.theme && member.theme !== 'auto') return member.theme;
  if (!member.dob) return member.role === 'parent' ? 'adult' : 'kids';
  const [by, bm, bd] = member.dob.split('-').map(Number);
  const [ty, tm, td] = todayKey.split('-').map(Number);
  let age = ty - by; if (tm < bm || (tm === bm && td < bd)) age--;
  if (age < 12) return 'kids';
  if (age < 16) return 'tween';
  if (age < 18) return 'teen';
  return 'adult';
}
