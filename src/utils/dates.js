// Demo calendar: data runs Jan 2 – May 15 2025, and "today" is Thursday 05/15/2025.
export const TODAY_ISO = '2025-05-15';
export const TODAY = '05/15/2025';
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];
export const MAY = 4;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const asDate = (iso) => new Date(`${iso}T00:00:00Z`);

export const toUS = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
export const toISO = (us) => `${us.slice(6, 10)}-${us.slice(0, 2)}-${us.slice(3, 5)}`;
export const monthOf = (iso) => Number(iso.slice(5, 7)) - 1;
export const weekday = (iso) => asDate(iso).getUTCDay();
export const shortDate = (iso) => `${MONTH_NAMES[monthOf(iso)]} ${Number(iso.slice(8, 10))}`;

export function addDays(iso, n) {
  const d = asDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const weekStart = (iso) => addDays(iso, -((weekday(iso) + 6) % 7));

export function workingDays(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const w = weekday(d);
    if (w !== 0 && w !== 6) out.push(d);
  }
  return out;
}

export const longToday = 'Thursday, May 15, 2025';
