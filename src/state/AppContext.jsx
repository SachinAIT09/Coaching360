import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { callById, callsFor } from '../data/calls';
import { defaultRubric } from '../data/rubric';
import { SEED_SESSIONS, SEED_GOALS, SEED_ALERTS, seedReviews, seedDev } from '../data/seeds';
import { buildMetrics, buildQueue } from '../utils/metrics';
import { TODAY, TODAY_ISO, BASE_TODAY, dayGap, moveUS } from '../utils/dates';
import { agentById } from '../data/agents';
import { accountFor } from './accounts';

export { TODAY };
export const ME = 'a1'; // the agent shown in Agent view
export const SUPERVISOR = 'Sophie Laurent';
export const HOME = { supervisor: '/home', agent: '/me' };
const KEY = 'coaching360-demo-v3';

const initial = () => ({
  anchor: TODAY_ISO, // the day the dates below belong to; saved data moves forward with the calendar
  user: null, // signed-in account email
  role: 'supervisor',
  agentId: 'a1',
  callId: '2857391',
  reviews: seedReviews(),
  sessions: SEED_SESSIONS,
  goals: SEED_GOALS,
  alerts: SEED_ALERTS,
  disputes: {},
  dev: seedDev(), // callId -> developmental (non-graded) review: { requested, note, date, sessionId }
  rubric: defaultRubric(),
});

// Move every MM/DD/YYYY value (optionally with a time) in saved data by n days
const DATE_VALUE = /^\d\d\/\d\d\/\d{4}( \d\d:\d\d)?$/;
function moveDates(v, n) {
  if (typeof v === 'string') return DATE_VALUE.test(v) ? moveUS(v, n) : v;
  if (Array.isArray(v)) return v.map((x) => moveDates(x, n));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, moveDates(x, n)]));
  return v;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial();
    const saved = JSON.parse(raw);
    // Data saved on an earlier day (or before dates followed the calendar) moves forward with it
    const gap = dayGap(saved.anchor || BASE_TODAY);
    const moved = gap ? { ...moveDates(saved, gap), user: saved.user, role: saved.role } : saved;
    return { ...initial(), ...moved, anchor: TODAY_ISO };
  } catch {
    return initial();
  }
}

const now = () => `${TODAY} ${new Date().toTimeString().slice(0, 5)}`;

// A review is either AI-assisted (pre-filled with the AI scores) or manual (the coach scores from scratch)
const blankReview = (call, method = 'ai') => ({
  coach: method === 'ai' ? { ...call.ai } : {}, notes: call.note, status: 'draft', method, overrides: {}, history: [],
});

// Keep one override entry (with its reason) for every category where the reviewer differs from the AI.
// Manual evaluations are graded without the AI, so they have no overrides.
function syncOverrides(review, call, prev = {}) {
  const out = {};
  if (review.method === 'manual') return out;
  for (const [cid, to] of Object.entries(review.coach)) {
    const from = call.ai[cid];
    if (from != null && to != null && to !== from) out[cid] = { from, to, reason: prev[cid]?.reason || '' };
  }
  return out;
}

const patchReview = (state, callId, fn) => {
  const call = callById(callId);
  const prev = state.reviews[callId] || blankReview(call);
  const next = fn(prev);
  return {
    ...state,
    reviews: { ...state.reviews, [callId]: { ...next, status: 'draft', accepted: false, overrides: syncOverrides(next, call, prev.overrides) } },
  };
};

// Category changes since the last finalized version (or since the AI score, for AI-assisted reviews)
function changesOf(r, call) {
  const base = r.savedCoach || (r.method === 'manual' ? {} : call.ai);
  return Object.keys({ ...base, ...r.coach })
    .filter((cid) => base[cid] !== r.coach[cid] && r.coach[cid] != null)
    .map((cid) => ({ cat: cid, from: base[cid] ?? null, to: r.coach[cid], reason: r.overrides?.[cid]?.reason || '' }));
}

const upsert = (list, item) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list]);

export function reducer(state, a) {
  switch (a.type) {
    case 'login': {
      const acc = accountFor(a.email);
      return acc ? { ...state, user: acc.email, role: acc.role } : state;
    }
    case 'logout':
      return { ...state, user: null };
    case 'agent': {
      const first = callsFor(a.agentId)[0];
      return { ...state, agentId: a.agentId, callId: first ? first.id : state.callId };
    }
    case 'call': {
      const c = callById(a.callId);
      return c ? { ...state, callId: c.id, agentId: c.agentId } : state;
    }
    case 'score':
      return patchReview(state, a.callId, (r) => {
        const coach = { ...r.coach };
        if (a.value == null || coach[a.cat] === a.value) delete coach[a.cat];
        else coach[a.cat] = a.value;
        return { ...r, coach };
      });
    case 'applyAi':
      return patchReview(state, a.callId, (r) => ({ ...r, method: 'ai', coach: { ...callById(a.callId).ai } }));
    case 'startManual':
      return patchReview(state, a.callId, (r) => ({ ...r, method: 'manual', coach: {} }));
    case 'reviewField': // highlights, opps, tags, moments, summary, team
      return patchReview(state, a.callId, (r) => ({ ...r, ...a.patch }));
    case 'clearReview':
      return patchReview(state, a.callId, (r) => ({ ...r, coach: {}, notes: '' }));
    case 'notes':
      return patchReview(state, a.callId, (r) => ({ ...r, notes: a.text }));
    case 'overrideReason': {
      const r = state.reviews[a.callId];
      if (!r || !r.overrides[a.cat]) return state;
      const overrides = { ...r.overrides, [a.cat]: { ...r.overrides[a.cat], reason: a.text } };
      return { ...state, reviews: { ...state.reviews, [a.callId]: { ...r, overrides } } };
    }
    case 'saveDraft': {
      const prev = state.reviews[a.callId] || blankReview(callById(a.callId));
      const history = [...(prev.history || []), { at: now(), by: a.reviewer || SUPERVISOR, action: 'Draft saved' }];
      return { ...state, reviews: { ...state.reviews, [a.callId]: { ...prev, status: 'draft', reviewer: a.reviewer || SUPERVISOR, history } } };
    }
    case 'saveReview': { // finalize
      const call = callById(a.callId);
      const prev = state.reviews[a.callId] || blankReview(call);
      const by = a.reviewer || SUPERVISOR;
      const entry = { at: now(), by, action: prev.method === 'manual' ? 'Finalized (coach graded)' : 'Finalized (coach validated)', changes: changesOf(prev, call) };
      return {
        ...state,
        reviews: { ...state.reviews, [a.callId]: { ...prev, status: 'saved', reviewer: by, reviewed: TODAY, savedCoach: { ...prev.coach }, history: [...(prev.history || []), entry] } },
      };
    }
    case 'acceptAi': {
      const call = callById(a.callId);
      const history = [{ at: now(), by: SUPERVISOR, action: 'AI scores accepted', changes: [] }];
      return { ...state, reviews: { ...state.reviews, [a.callId]: { ...blankReview(call), status: 'saved', accepted: true, reviewer: SUPERVISOR, reviewed: TODAY, savedCoach: { ...call.ai }, history } } };
    }
    case 'saveSession':
      return { ...state, sessions: upsert(state.sessions, a.session) };
    case 'submitDev': // the employee asks for feedback on a call
      return { ...state, dev: { ...state.dev, [a.callId]: { requested: true, note: a.note || '', date: TODAY } } };
    case 'markDev': {
      const dev = { ...state.dev };
      for (const id of a.callIds) dev[id] = { requested: false, date: TODAY, ...dev[id], sessionId: a.sessionId };
      return { ...state, dev };
    }
    case 'unmarkDev': {
      const dev = { ...state.dev };
      for (const id of a.callIds) if (dev[id] && !dev[id].requested) delete dev[id];
      return { ...state, dev };
    }
    case 'updateGoal':
      return {
        ...state,
        goals: state.goals.map((g) => (g.id === a.id ? { ...g, ...a.patch, history: [...(g.history || []), { at: now(), by: a.by || SUPERVISOR, change: a.change || 'Updated' }] } : g)),
      };
    case 'addSession':
      return { ...state, sessions: [a.session, ...state.sessions] };
    case 'updateSession':
      return { ...state, sessions: state.sessions.map((s) => (s.id === a.id ? { ...s, ...a.patch } : s)) };
    case 'toggleAction':
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === a.id ? { ...s, actionItems: s.actionItems.map((x, i) => (i === a.index ? { ...x, done: !x.done } : x)) } : s),
      };
    case 'addGoal':
      return {
        ...state,
        goals: [a.goal, ...state.goals],
        sessions: a.sessionId
          ? state.sessions.map((s) => (s.id === a.sessionId ? { ...s, followUpGoalId: a.goal.id, goalIds: [...(s.goalIds || []), a.goal.id] } : s))
          : state.sessions,
      };
    case 'updateAlert':
      return { ...state, alerts: state.alerts.map((x) => (x.id === a.id ? { ...x, ...a.patch } : x)) };
    case 'dispute':
      return { ...state, disputes: { ...state.disputes, [a.callId]: { cat: a.cat, reason: a.reason, date: TODAY, status: 'Open' } } };
    case 'resolveDispute':
      return { ...state, disputes: { ...state.disputes, [a.callId]: { ...state.disputes[a.callId], status: 'Resolved', resolution: a.text } } };
    case 'publishRubric':
      return { ...state, rubric: { version: state.rubric.version + 1, published: TODAY, criteria: a.criteria } };
    case 'reset':
      return { ...initial(), user: state.user, role: state.role };
    default:
      return state;
  }
}

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [toast, setToastState] = useState(null);
  const timer = useRef();

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }, [state]);

  const notify = useCallback((message, kind = 'ok') => {
    setToastState({ message, kind, id: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastState(null), 3200);
  }, []);

  const criteria = useMemo(() => state.rubric.criteria.filter((c) => c.on), [state.rubric]);
  const metrics = useMemo(() => buildMetrics(state.reviews, criteria, state.dev), [state.reviews, criteria, state.dev]);
  const queue = useMemo(() => buildQueue(state, metrics), [state, metrics]);

  const value = useMemo(() => ({ state, dispatch, toast, notify, criteria, metrics, queue }), [state, toast, notify, criteria, metrics, queue]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);
// The signed-in account, with the agent account named after its agent profile
export const useAccount = () => {
  const { state } = useApp();
  const acc = accountFor(state.user);
  return acc && { ...acc, name: acc.name || agentById(ME).name };
};
// The agent a page is about: the signed-in agent in Agent view, otherwise the one picked in search
export const useViewAgent = (mine) => {
  const { state } = useApp();
  return mine ? ME : state.agentId;
};
