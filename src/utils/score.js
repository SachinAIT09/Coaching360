// Weighted points for one criterion: weight * score / 3
export const points = (c, s) => (s ? (c.weight * s) / 3 : 0);

// Weighted total (0-100) over the active criteria.
// Unscored base criteria count as 0 (partially graded form); criteria added in a newer
// template version (custom) are skipped until someone scores them.
export function weightedTotal(scores, criteria) {
  if (!scores) return null;
  let pts = 0;
  let w = 0;
  let any = false;
  for (const c of criteria) {
    const s = scores[c.id];
    if (s) { pts += points(c, s); w += Number(c.weight); any = true; }
    else if (!c.custom) w += Number(c.weight);
  }
  return any && w ? (pts / w) * 100 : null;
}

export const band = (pct) => (pct == null ? 'none' : pct >= 90 ? 'green' : pct >= 80 ? 'blue' : pct >= 70 ? 'amber' : 'red');

export const callTag = (pct) =>
  pct >= 90 ? { label: 'Great Example', cls: 'green' } : pct < 85 ? { label: 'Coaching Opportunity', cls: 'red' } : { label: 'On Track', cls: 'blue' };

export const fmtPct = (n) => (n == null || Number.isNaN(n) ? '—' : `${Math.round(n)}%`);
export const fmt1 = (n) => (n == null ? '—' : n.toFixed(1));
export const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
export const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

// Deterministic pseudo-random so demo data is stable between reloads
export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
