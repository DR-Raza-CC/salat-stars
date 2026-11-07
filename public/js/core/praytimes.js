// Salat Stars — Jafari (Shia Ithna Ashari, Leva Institute, Qum) prayer time calculation.
// Based on the standard astronomical method used by PrayTimes.org.
// Jafari parameters: Fajr 16°, Maghrib 4° below horizon, Isha 14°, midnight = halfway sunset→Fajr.
// Shared by the browser app and the server Worker.

const DEG = Math.PI / 180;
const dsin = d => Math.sin(d * DEG);
const dcos = d => Math.cos(d * DEG);
const dtan = d => Math.tan(d * DEG);
const darcsin = x => Math.asin(x) / DEG;
const darccos = x => Math.acos(x) / DEG;
const darctan2 = (y, x) => Math.atan2(y, x) / DEG;
const darccot = x => Math.atan(1 / x) / DEG;
const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
const fixHour = h => fix(h, 24);
const fixAngle = a => fix(a, 360);

// Calculation profiles. 'hujjat' is calibrated to the timetable published by Hujjat, Stanmore
// (hujjat.org, checked 7–8 Nov 2026: Fajr 05:38/05:40, Sunrise 07:05/07:07, Zohr 11:50, Maghrib 16:37).
export const PROFILES = {
  hujjat: { label: 'Hujjat (Stanmore) style', fajr: 13.75, maghrib: 2.8, isha: 14, dhuhrMin: 5 },
  jafari: { label: 'Standard Jafari (Leva, Qum)', fajr: 16, maghrib: 4, isha: 14, dhuhrMin: 1 }
};

function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = darctan2(dcos(e) * dsin(L), dcos(L)) / 15;
  const eqt = q / 15 - fixHour(RA);
  const decl = darcsin(dsin(e) * dsin(L));
  return { declination: decl, equation: eqt };
}

// Offset in minutes of a time zone (e.g. Europe/London) on a given date.
export function tzOffsetMinutes(tz, y, m, d) {
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).formatToParts(probe).reduce((o, p) => (o[p.type] = p.value, o), {});
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asUTC - probe.getTime()) / 60000);
}

/**
 * Compute Jafari prayer times for a local calendar date.
 * @returns object of Date instants: imsak, fajr, sunrise, dhuhr, asr, sunset, maghrib, isha, midnight
 */
export function computeTimes(y, m, d, lat, lng, tz, profile = 'hujjat') {
  const P = PROFILES[profile] || PROFILES.hujjat;
  const jDate = julian(y, m, d) - lng / (15 * 24);
  const offsetMin = tzOffsetMinutes(tz, y, m, d);

  const midDay = t => fixHour(12 - sunPosition(jDate + t).equation);
  const sunAngleTime = (angle, t, ccw) => {
    const decl = sunPosition(jDate + t).declination;
    const noon = midDay(t);
    const v = (-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat));
    if (v > 1 || v < -1) return NaN; // sun never reaches this angle (UK summer)
    const T = darccos(v) / 15;
    return noon + (ccw ? -T : T);
  };
  const asrTime = (factor, t) => {
    const decl = sunPosition(jDate + t).declination;
    const angle = -darccot(factor + dtan(Math.abs(lat - decl)));
    return sunAngleTime(angle, t);
  };

  // Two refinement passes (PrayTimes approach). Times in hours, local solar.
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, maghrib: 18, isha: 18 };
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v / 24]));
    t = {
      fajr: sunAngleTime(P.fajr, p.fajr, true),
      sunrise: sunAngleTime(0.833, p.sunrise, true),
      dhuhr: midDay(p.dhuhr),
      asr: asrTime(1, p.asr),
      sunset: sunAngleTime(0.833, p.sunset),
      maghrib: sunAngleTime(P.maghrib, p.maghrib),
      isha: sunAngleTime(P.isha, p.isha)
    };
  }

  // High-latitude adjustment (angle-based) so UK summer nights still get Fajr/Isha.
  const night = 24 - t.sunset + t.sunrise; // hours between sunset and sunrise
  const adjust = (time, base, angle, ccw) => {
    const portion = (angle / 60) * night;
    const diff = ccw ? (base - time) : (time - base);
    if (isNaN(time) || diff > portion) return ccw ? base - portion : base + portion;
    return time;
  };
  t.fajr = adjust(t.fajr, t.sunrise, P.fajr, true);
  t.isha = adjust(t.isha, t.sunset, P.isha, false);
  t.maghrib = adjust(t.maghrib, t.sunset, P.maghrib, false);

  // Convert from solar (UTC-based with longitude) to local clock time.
  const tzHours = offsetMin / 60;
  const toLocal = h => h + tzHours - lng / 15;
  const local = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, toLocal(v)]));
  local.dhuhr += P.dhuhrMin / 60; // safety margin after zawal

  // Jafari midnight: halfway between sunset and next day's Fajr.
  const nextFajr = local.fajr + 24; // approximation: next day's Fajr ≈ same clock time
  local.midnight = local.sunset + (nextFajr - local.sunset) / 2;
  local.imsak = local.fajr - 10 / 60;

  const base = Date.UTC(y, m - 1, d) - offsetMin * 60000;
  const out = {};
  for (const [k, h] of Object.entries(local)) {
    // round to nearest minute
    out[k] = new Date(base + Math.round(h * 60) * 60000);
  }
  return out;
}

export function fmtTime(date, tz) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

/** Local calendar date parts {y,m,d} for an instant in a time zone. */
export function localYMD(date, tz) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date).reduce((o, x) => (o[x.type] = x.value, o), {});
  return { y: +p.year, m: +p.month, d: +p.day };
}

export const ymdKey = ({ y, m, d }) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return { y, m, d }; };
export function addDays(key, n) {
  const { y, m, d } = parseKey(key);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return ymdKey({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
}

/**
 * The five prayers with their scoring windows (Shia practice: Asr opens with Dhuhr, Isha with Maghrib).
 * Window ends: Fajr→sunrise, Dhuhr & Asr→sunset, Maghrib & Isha→Jafari midnight.
 */
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const PRAYER_NAMES = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

export function prayerWindows(key, loc) {
  const { y, m, d } = parseKey(key);
  const t = computeTimes(y, m, d, loc.lat, loc.lng, loc.tz, loc.profile);
  return {
    times: t,
    windows: {
      fajr: { start: t.fajr, end: t.sunrise },
      dhuhr: { start: t.dhuhr, end: t.sunset },
      asr: { start: t.dhuhr, end: t.sunset },
      maghrib: { start: t.maghrib, end: t.midnight },
      isha: { start: t.maghrib, end: t.midnight }
    }
  };
}
