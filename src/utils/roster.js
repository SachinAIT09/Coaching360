import { AGENTS, TEAMS } from '../data/agents';
import { callById } from '../data/calls';
import { TODAY_ISO, addDays } from './dates';

export const PERIODS = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days', ytd: 'Year to date' };
export const SORTS = { name: 'Name', qa: 'QA score (lowest first)', attention: 'Needs attention' };

export function windowOf(period) {
  if (period === 'ytd') return { from: '2025-01-01', prev: null };
  const n = Number(period);
  const from = addDays(TODAY_ISO, -(n - 1));
  return { from, prev: { from: addDays(from, -n), to: addDays(from, -1) } };
}

export const isAgentId = (id) => AGENTS.some((a) => a.id === id);

// Roster view settings live in the query string so the detail page can step through the same order
export function rosterParams(search) {
  const p = new URLSearchParams(search);
  const period = PERIODS[p.get('period')] ? p.get('period') : '30';
  const sort = SORTS[p.get('sort')] ? p.get('sort') : 'name';
  return { period, sort, team: p.get('team') || 'All', q: p.get('q') || '' };
}

export function rosterSearch({ period, sort, team, q }) {
  const p = new URLSearchParams();
  if (period !== '30') p.set('period', period);
  if (sort !== 'name') p.set('sort', sort);
  if (team !== 'All') p.set('team', team);
  if (q) p.set('q', q);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const agentPath = (id, search = '', base = '/performance') => `${base}/${id}${search}`;

// Call Grading opens on the call's agent, with the call in the query string next to any roster settings
export function gradingPath(callId, search = '') {
  const p = new URLSearchParams(rosterSearch(rosterParams(search)));
  p.set('call', callId);
  return `/grading/${callById(callId).agentId}?${p}`;
}

// One row per agent with the numbers the roster shows, filtered and sorted by the view settings
export function rosterRows(state, metrics, queue, { period, sort, team, q }) {
  const w = windowOf(period);
  const needle = q.trim().toLowerCase();
  const rows = AGENTS
    .filter((a) => (team === 'All' || a.team === team) && (!needle || a.name.toLowerCase().includes(needle)))
    .map((a) => {
      const cur = metrics.range(a.id, w.from);
      const prev = w.prev ? metrics.range(a.id, w.prev.from, w.prev.to) : null;
      const goals = state.goals.filter((g) => (g.agentId === a.id || (g.agentId === 'team' && g.team === a.team)) && (g.state || 'Active') === 'Active');
      const gcs = goals.map((g) => metrics.goal(g));
      const goalPct = gcs.length ? gcs.reduce((s, x) => s + x.pct, 0) / gcs.length : null;
      const atRisk = gcs.filter((x) => x.status === 'At Risk').length;
      const alerts = state.alerts.filter((x) => x.agentId === a.id && x.status === 'Open').length;
      const flagged = queue.filter((x) => x.call.agentId === a.id).length;
      const session = state.sessions.find((s) => s.agentId === a.id && ['Scheduled', 'Delivered', 'Disputed'].includes(s.status));
      return { a, cur, prev, goalPct, goals: goals.length, atRisk, alerts, flagged, session, attention: alerts + atRisk + flagged };
    });
  const qa = (r) => r.cur.qa ?? Infinity;
  const by = {
    name: (x, y) => x.a.name.localeCompare(y.a.name),
    qa: (x, y) => qa(x) - qa(y),
    attention: (x, y) => y.attention - x.attention || qa(x) - qa(y),
  };
  // Grouped by team, then sorted within each team; this is also the order the detail page steps through
  return rows.sort((x, y) => TEAMS.indexOf(x.a.team) - TEAMS.indexOf(y.a.team) || by[sort](x, y));
}
