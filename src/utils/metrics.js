import { CALLS, callById, callsFor, minConfidence } from '../data/calls';
import { AGENTS, agentById } from '../data/agents';
import { CAT_IDS, goalBehavior } from '../data/rubric';
import { INTENTS } from '../data/intents';
import { weightedTotal } from './score';
import { TODAY_ISO, addDays, toISO, weekStart, shortDate, MAY, MONTHS } from './dates';

// All metrics are derived from the calls, using saved reviewer scores where they exist.
const blank = () => ({ n: 0, sum: 0, met: Object.fromEntries(CAT_IDS.map((c) => [c, 0])), pos: 0, neu: 0, neg: 0, dur: 0, notes: 0 });

function addTo(g, c, total, sc) {
  g.n++;
  g.sum += total;
  for (const id of CAT_IDS) if (sc[id] === 3) g.met[id]++;
  g[c.sentiment === 'Positive' ? 'pos' : c.sentiment === 'Negative' ? 'neg' : 'neu']++;
  g.dur += c.durSec;
  if (c.notesOk) g.notes++;
}

export const LAST7 = addDays(TODAY_ISO, -6);

// `dev`: calls under a developmental (non-graded) review. They are analyzed but left out of QA averages.
export function buildMetrics(reviews, criteria, dev = {}) {
  const scoresMap = new Map();
  const totals = new Map();
  const A = {};
  const bucket = (k) => (A[k] = A[k] || Array.from({ length: 5 }, blank));
  const today = blank();
  const todayIntents = {};

  for (const c of CALLS) {
    const r = reviews[c.id];
    const sc = r && r.status === 'saved' ? { ...c.ai, ...r.coach } : c.ai;
    const total = weightedTotal(sc, criteria);
    scoresMap.set(c.id, sc);
    totals.set(c.id, total);
    if (dev[c.id]) continue;
    const team = agentById(c.agentId).team;
    for (const k of [c.agentId, 'team', `team:${team}`]) addTo(bucket(k)[c.month], c, total, sc);
    if (c.iso === TODAY_ISO) {
      addTo(today, c, total, sc);
      todayIntents[c.intent[1]] = (todayIntents[c.intent[1]] || 0) + 1;
    }
  }

  const agg = (key, m = MAY) => (A[key] ? A[key][m] : blank());
  const months = (key, ms) => ms.reduce((g, m) => {
    const x = agg(key, m);
    g.n += x.n; g.sum += x.sum; g.pos += x.pos; g.neu += x.neu; g.neg += x.neg; g.dur += x.dur; g.notes += x.notes;
    for (const id of CAT_IDS) g.met[id] += x.met[id];
    return g;
  }, blank());
  const of = (g) => ({
    n: g.n,
    qa: g.n ? g.sum / g.n : null,
    cat: Object.fromEntries(CAT_IDS.map((id) => [id, g.n ? (g.met[id] / g.n) * 100 : null])),
    pos: g.n ? (g.pos / g.n) * 100 : null,
    neu: g.n ? (g.neu / g.n) * 100 : null,
    neg: g.n ? (g.neg / g.n) * 100 : null,
    aht: g.n ? g.dur / g.n / 60 : null,
    notes: g.n ? (g.notes / g.n) * 100 : null,
  });

  // key: agent id, 'team' or 'team:<name>'; m: month index or array of month indexes
  const stats = (key, m = MAY) => of(Array.isArray(m) ? months(key, m) : agg(key, m));
  const trend = (key) => [0, 1, 2, 3, 4].map((m) => stats(key, m).qa);

  // Whether a call met a goal's behavior: 'met' | 'miss' | 'na'
  const goalState = (g, c) => {
    const b = goalBehavior(g);
    if (g.metric === 'notes') return c.notesOk ? 'met' : 'miss';
    if ((b ? b.naOutbound : g.cat === 'opening') && c.direction === 'Outbound') return 'na';
    return scoresMap.get(c.id)[g.cat] === 3 ? 'met' : 'miss';
  };
  const goalPool = (g) => (g.agentId === 'team' ? CALLS.filter((c) => agentById(c.agentId).team === g.team) : callsFor(g.agentId));
  // Compliance on applicable calls between two ISO dates (inclusive)
  const compliance = (g, pool, from, to) => {
    let met = 0, n = 0;
    for (const c of pool) {
      if (c.iso > to) continue;
      if (c.iso < from) break;
      if (g.intent && c.intentKey !== g.intent) continue;
      const st = goalState(g, c);
      if (st === 'na') continue;
      n++; if (st === 'met') met++;
    }
    return { met, n, pct: n ? (met / n) * 100 : null };
  };

  const goalCache = new Map();
  function goal(g) {
    const k = `${g.id}|${g.assigned}|${g.target}|${g.cat}|${g.behavior}|${g.baseline}`;
    if (goalCache.has(k)) return goalCache.get(k);
    const from = toISO(g.assigned);
    const pool = goalPool(g);
    let met = 0, miss = 0, na = 0;
    const recent = [];
    const weeks = new Map();
    for (const c of pool) {
      if (c.iso < from) break; // pool is sorted newest first
      if (g.intent && c.intentKey !== g.intent) continue;
      const st = goalState(g, c);
      if (st === 'met') met++; else if (st === 'miss') miss++; else na++;
      if (recent.length < 6) recent.push({ call: c, st });
      if (st !== 'na') {
        const w = weekStart(c.iso);
        const x = weeks.get(w) || { met: 0, n: 0 };
        x.n++; if (st === 'met') x.met++;
        weeks.set(w, x);
      }
    }
    const applicable = met + miss;
    const pct = applicable ? (met / applicable) * 100 : 0;
    const status = pct >= g.target ? 'Met' : pct < g.target - 10 ? 'At Risk' : 'In Progress';
    const weekly = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([w, x]) => ({ label: shortDate(w), value: Math.round((x.met / x.n) * 100) }));
    // Baseline: compliance on the 30 days before the goal was set (or the value stored when it was created)
    const base = compliance(g, pool, addDays(from, -30), addDays(from, -1));
    const baseline = g.baseline != null ? g.baseline : base.pct;
    // Direction: last 14 days vs the 14 days before
    const last = compliance(g, pool, addDays(TODAY_ISO, -13), TODAY_ISO);
    const prior = compliance(g, pool, addDays(TODAY_ISO, -27), addDays(TODAY_ISO, -14));
    const delta = last.pct != null && prior.pct != null ? last.pct - prior.pct : null;
    const direction = delta == null || last.n < 5 ? 'Steady' : delta >= 5 ? 'Improving' : delta <= -5 ? 'Declining' : 'Steady';
    // A goal that was achieved but whose last two weeks fall well below target is slipping
    const slipping = g.state === 'Achieved' && last.n >= 8 && last.pct < g.target - 10;
    const res = { met, miss, na, applicable, pct, status, recent, weekly, baseline, improvement: baseline != null ? pct - baseline : null, last, prior, direction, slipping };
    goalCache.set(k, res);
    return res;
  }

  // AI vs human agreement on human-scored calls (accepted AI scores are not counted)
  const per = Object.fromEntries(CAT_IDS.map((id) => [id, { agree: 0, n: 0 }]));
  let reviewed = 0;
  for (const [id, r] of Object.entries(reviews)) {
    if (r.status !== 'saved' || r.accepted) continue;
    const c = callById(id);
    if (!c) continue;
    reviewed++;
    for (const cid of CAT_IDS) {
      if (r.coach[cid] == null) continue;
      per[cid].n++;
      if (r.coach[cid] === c.ai[cid]) per[cid].agree++;
    }
  }
  const tot = Object.values(per).reduce((s, x) => ({ agree: s.agree + x.agree, n: s.n + x.n }), { agree: 0, n: 0 });
  const perPct = Object.fromEntries(CAT_IDS.map((id) => [id, per[id].n ? (per[id].agree / per[id].n) * 100 : null]));
  const worst = CAT_IDS.filter((id) => perPct[id] != null).sort((a, b) => perPct[a] - perPct[b])[0];
  const calibration = { reviewed, overall: tot.n ? (tot.agree / tot.n) * 100 : null, per: perPct, worst };

  // Stats for one agent between two ISO dates (inclusive). Developmental calls are counted as analyzed
  // but are not AI-graded for QA purposes.
  const rangeCache = new Map();
  function range(agentId, from, to = TODAY_ISO) {
    const k = `${agentId}|${from}|${to}`;
    if (rangeCache.has(k)) return rangeCache.get(k);
    const g = blank();
    const calls = [];
    let analyzed = 0, devN = 0, validated = 0, manual = 0, accepted = 0;
    for (const c of callsFor(agentId)) {
      if (c.iso > to) continue;
      if (c.iso < from) break;
      analyzed++;
      if (dev[c.id]) { devN++; continue; }
      const r = reviews[c.id];
      if (r && r.status === 'saved') {
        if (r.method === 'manual') manual++;
        else if (r.accepted) accepted++;
        else validated++;
      }
      calls.push(c);
      addTo(g, c, totals.get(c.id), scoresMap.get(c.id));
    }
    const res = { ...of(g), analyzed, dev: devN, aiGraded: calls.length, validated, manual, accepted, coachReviewed: validated + manual + accepted, calls };
    rangeCache.set(k, res);
    return res;
  }
  // QA series for an agent: weekly (last `n` weeks) or monthly (Jan–May)
  function series(agentId, gran, n = 8) {
    if (gran === 'month') {
      return MONTHS.map((label, m) => {
        const from = `2025-${String(m + 1).padStart(2, '0')}-01`;
        const to = m === MAY ? TODAY_ISO : addDays(`2025-${String(m + 2).padStart(2, '0')}-01`, -1);
        return { label: m === MAY ? `${label}*` : label, from, to, value: Math.round(range(agentId, from, to).qa || 0) };
      });
    }
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const from = addDays(weekStart(TODAY_ISO), -7 * i);
      const to = i === 0 ? TODAY_ISO : addDays(from, 6);
      out.push({ label: shortDate(from), from, to, value: Math.round(range(agentId, from, to).qa || 0) });
    }
    return out;
  }

  return {
    total: (call) => totals.get(call.id),
    scores: (call) => scoresMap.get(call.id),
    stats,
    trend,
    goal,
    range,
    series,
    calibration,
    today: { ...of(today), intents: Object.entries(todayIntents).sort((a, b) => b[1] - a[1]) },
    agentsBy: (fn) => AGENTS.map((a) => ({ a, v: fn(a) })),
  };
}

export const REASONS = {
  policy: { label: 'Policy violation', cls: 'red', rank: 0 },
  dispute: { label: 'Agent dispute', cls: 'red', rank: 1 },
  low: { label: 'Low score', cls: 'amber', rank: 2 },
  negative: { label: 'Negative sentiment', cls: 'amber', rank: 3 },
  confidence: { label: 'Low AI confidence', cls: 'blue', rank: 4 },
  sample: { label: 'Calibration sample', cls: 'gray', rank: 5 },
};

// Calls from the last 7 days that need a human: everything else is left to the AI score
export function buildQueue(state, m) {
  const linked = new Set(state.sessions.flatMap((s) => s.callIds || (s.callId ? [s.callId] : [])));
  const out = [];
  for (const c of CALLS) {
    if (c.iso < LAST7) break;
    const r = state.reviews[c.id];
    const d = state.disputes[c.id];
    const openDispute = d && d.status === 'Open';
    if (((r && r.status === 'saved') || linked.has(c.id)) && !openDispute) continue;
    const total = m.total(c);
    const reasons = [];
    if (c.violation) reasons.push('policy');
    if (openDispute) reasons.push('dispute');
    if (total < 65) reasons.push('low');
    if (c.sentiment === 'Negative' && total < 75) reasons.push('negative');
    if (minConfidence(c) < 0.6) reasons.push('confidence');
    if (!reasons.length && Number(c.id) % 53 === 0) reasons.push('sample');
    if (reasons.length) out.push({ call: c, total, reasons, draft: !!r });
  }
  const rank = (x) => Math.min(...x.reasons.map((k) => REASONS[k].rank));
  return out.sort((a, b) => rank(a) - rank(b) || (b.call.iso + b.call.time).localeCompare(a.call.iso + a.call.time));
}

export const intentLabel = (key) => INTENTS[key].label;
