// Demo calendar. The data is authored around a base "today" of Thursday 05/15/2025 (calls from
// 01/02/2025), then every date is moved forward by OFFSET days so the data always ends on the
// real current date. Use shift / shiftUS / shiftStamp for any authored date.
export const BASE_TODAY = '2025-05-15';
export const BASE_START = '2025-01-02';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const asDate = (iso) => new Date(`${iso}T00:00:00Z`);
const pad = (n) => String(n).padStart(2, '0');

export const toUS = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
export const toISO = (us) => `${us.slice(6, 10)}-${us.slice(0, 2)}-${us.slice(3, 5)}`;
export const monthOf = (iso) => Number(iso.slice(5, 7)) - 1; // calendar month, 0 = January
export const weekday = (iso) => asDate(iso).getUTCDay();
export const shortDate = (iso) => `${MONTH_NAMES[monthOf(iso)]} ${Number(iso.slice(8, 10))}`;

export function addDays(iso, n) {
  const d = asDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const daysBetween = (a, b) => Math.round((asDate(b) - asDate(a)) / 86400000);

export const weekStart = (iso) => addDays(iso, -((weekday(iso) + 6) % 7));

export function workingDays(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const w = weekday(d);
    if (w !== 0 && w !== 6) out.push(d);
  }
  return out;
}

// Real current date in the viewer's time zone
const now = new Date();
export const TODAY_ISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
export const TODAY = toUS(TODAY_ISO);
export const OFFSET = daysBetween(BASE_TODAY, TODAY_ISO);

export const shift = (iso) => addDays(iso, OFFSET);
export const shiftUS = (us) => toUS(shift(toISO(us)));
export const shiftStamp = (stamp) => `${shiftUS(stamp.slice(0, 10))}${stamp.slice(10)}`; // 'MM/DD/YYYY HH:MM'
export const DATA_START = shift(BASE_START);

// Spoken date for transcripts and notes, e.g. spoken('2025-05-22') -> 'May 22' on the base day
export const spoken = (baseIso) => {
  const iso = shift(baseIso);
  return `${MONTH_LONG[monthOf(iso)]} ${Number(iso.slice(8, 10))}`;
};

export const longToday = `${DAY_LONG[weekday(TODAY_ISO)]}, ${MONTH_LONG[monthOf(TODAY_ISO)]} ${Number(TODAY_ISO.slice(8, 10))}, ${TODAY_ISO.slice(0, 4)}`;

// Reporting months: the current month and the four before it. Index CUR (4) is month to date.
export const CUR = 4;
const absMonth = (iso) => Number(iso.slice(0, 4)) * 12 + monthOf(iso);
const firstAbs = absMonth(TODAY_ISO) - CUR;
const monthStartISO = (abs) => `${Math.floor(abs / 12)}-${pad((abs % 12) + 1)}-01`;
export const MONTHS = Array.from({ length: CUR + 1 }, (_, i) => MONTH_NAMES[(firstAbs + i) % 12]);
export const MONTHS_LONG = Array.from({ length: CUR + 1 }, (_, i) => `${MONTH_LONG[(firstAbs + i) % 12]} ${Math.floor((firstAbs + i) / 12)}`);
// Window month index of a date (0..CUR), or -1 when it falls before the window
export const monthIndex = (iso) => {
  const i = absMonth(iso) - firstAbs;
  return i >= 0 && i <= CUR ? i : -1;
};
// First and last day of window month m; the current month ends today
export const monthRange = (m) => {
  const from = monthStartISO(firstAbs + m);
  return [from, m === CUR ? TODAY_ISO : addDays(monthStartISO(firstAbs + m + 1), -1)];
};
export const YEAR_START = `${TODAY_ISO.slice(0, 4)}-01-01`;

// Move dates saved on an earlier day (anchor) forward with the data
export const dayGap = (anchor) => daysBetween(anchor, TODAY_ISO);
export const moveUS = (us, n) => (us && /^\d\d\/\d\d\/\d{4}/.test(us) ? `${toUS(addDays(toISO(us.slice(0, 10)), n))}${us.slice(10)}` : us);
