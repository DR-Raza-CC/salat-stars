// Hijri calendar helpers. Uses the browser/Worker Intl Umm al-Qura calendar, shifted by a
// family "adjustment" in days so it matches local moon sighting (Hujjat showed 25 Jumada al-Oula
// on 7 Nov 2026 when Umm al-Qura showed 27, so the default is -2).
import { addDays, parseKey, ymdKey } from './praytimes.js';

export const HIJRI_MONTHS = ['Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Oula',
  'Jumada al-Thaniya', 'Rajab', "Sha'ban", 'Ramadhan', 'Shawwal', "Dhul Qa'dah", 'Dhul Hijjah'];

const fmt = new Intl.DateTimeFormat('en-GB-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
const cache = new Map();

/** Hijri {hy, hm, hd} for a Gregorian date key 'YYYY-MM-DD'. */
export function toHijri(key, adj = 0) {
  const k = adj ? addDays(key, adj) : key;
  if (cache.has(k)) return cache.get(k);
  const { y, m, d } = parseKey(k);
  const parts = fmt.formatToParts(new Date(Date.UTC(y, m - 1, d, 12))).reduce((o, p) => (o[p.type] = p.value, o), {});
  const r = { hy: parseInt(parts.year, 10), hm: parseInt(parts.month, 10), hd: parseInt(parts.day, 10) };
  cache.set(k, r);
  return r;
}

export const hijriLabel = h => `${h.hd} ${HIJRI_MONTHS[h.hm - 1]} ${h.hy}`;
const cmp = (a, b) => (a.hy - b.hy) || (a.hm - b.hm) || (a.hd - b.hd);

/** First Gregorian date key on/after `fromKey` whose Hijri date is >= target. */
export function firstOnOrAfter(target, fromKey, adj = 0) {
  // Jump close using the average lunar year, then walk.
  const from = toHijri(fromKey, adj);
  const lunarDays = ((target.hy - from.hy) * 12 + (target.hm - from.hm)) * 29.530589 + (target.hd - from.hd);
  let key = addDays(fromKey, Math.max(0, Math.floor(lunarDays) - 3));
  while (cmp(toHijri(key, adj), target) > 0) key = addDays(key, -1);
  while (cmp(toHijri(key, adj), target) < 0) key = addDays(key, 1);
  return key;
}

/** Gregorian key for a Hijri date (first day it applies). */
export function fromHijri(hy, hm, hd, adj = 0, nearKey = '2026-01-01') {
  const start = toHijri(nearKey, adj);
  // pick a starting point roughly a year before the target
  const approxDays = ((hy - start.hy) * 12 + (hm - start.hm)) * 29.530589 + (hd - start.hd);
  const fromKey = addDays(nearKey, Math.floor(approxDays) - 40);
  return firstOnOrAfter({ hy, hm, hd }, fromKey, adj);
}

/**
 * Bulugh (age of religious obligation) per Ayatollah Sistani, Islamic Laws Ruling 2270:
 * girls on completing 9 lunar years; boys on completing 15 lunar years (or earlier if one of the
 * other natural signs appears). Sources: sistani.org/english/book/48/2355/ and sistani.org/english/qa/15596/
 *
 * @param dobKey 'YYYY-MM-DD' Gregorian date of birth
 * @param sex 'f' | 'm'
 * @param afterMaghrib born after sunset → Islamic date is the next day
 */
export function bulugh(dobKey, sex, adj = 0, afterMaghrib = false) {
  const birthKey = afterMaghrib ? addDays(dobKey, 1) : dobKey;
  const h = toHijri(birthKey, adj);
  const years = sex === 'f' ? 9 : 15;
  const dateKey = firstOnOrAfter({ hy: h.hy + years, hm: h.hm, hd: h.hd }, birthKey, adj);
  return { birthHijri: h, years, dateKey, dateHijri: toHijri(dateKey, adj) };
}

/** Next Islamic birthday (Gregorian key) on/after todayKey. */
export function nextIslamicBirthday(dobKey, todayKey, adj = 0, afterMaghrib = false) {
  const birthKey = afterMaghrib ? addDays(dobKey, 1) : dobKey;
  const h = toHijri(birthKey, adj);
  const now = toHijri(todayKey, adj);
  let hy = now.hy;
  if (now.hm > h.hm || (now.hm === h.hm && now.hd > h.hd)) hy += 1;
  const key = firstOnOrAfter({ hy, hm: h.hm, hd: h.hd }, todayKey, adj);
  return { key, age: hy - h.hy };
}

/** Lunar (Hijri) age in completed years on a given date. */
export function lunarAge(dobKey, todayKey, adj = 0, afterMaghrib = false) {
  const b = toHijri(afterMaghrib ? addDays(dobKey, 1) : dobKey, adj);
  const n = toHijri(todayKey, adj);
  let age = n.hy - b.hy;
  if (n.hm < b.hm || (n.hm === b.hm && n.hd < b.hd)) age -= 1;
  return age;
}

/** Whole solar age in years on todayKey. */
export function solarAge(dobKey, todayKey) {
  const b = parseKey(dobKey), t = parseKey(todayKey);
  let a = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) a -= 1;
  return a;
}

export function daysBetween(aKey, bKey) {
  const a = parseKey(aKey), b = parseKey(bKey);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

export { ymdKey };
