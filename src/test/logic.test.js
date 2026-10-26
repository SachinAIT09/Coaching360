// Regression guard for the business logic. Written against the pre-redesign code:
// the UI work must not change any of these numbers or transitions.
import { describe, it, expect } from 'vitest';
import { weightedTotal, band, callTag, fmtPct, points } from '../utils/score';
import { buildMetrics, buildQueue } from '../utils/metrics';
import { callStatus, getReview, biggestGap, gradingStatus, reviewId, sessionCalls, reviewNotes } from '../utils/review';
import { askAi } from '../utils/askAi';
import { reducer } from '../state/AppContext';
import { checkLogin } from '../state/accounts';
import { defaultRubric } from '../data/rubric';
import { callById, CALLS } from '../data/calls';
import { SEED_SESSIONS, SEED_GOALS, SEED_ALERTS, seedReviews } from '../data/seeds';

const seed = () => ({
  role: 'supervisor', agentId: 'a1', callId: '2857391', reviews: seedReviews(), sessions: SEED_SESSIONS,
  goals: SEED_GOALS, alerts: SEED_ALERTS, disputes: {}, rubric: defaultRubric(),
});
const criteriaOf = (s) => s.rubric.criteria.filter((c) => c.on);

describe('score', () => {
  const crit = defaultRubric().criteria;
  it('weights scores out of 3', () => {
    expect(points({ weight: 30 }, 3)).toBe(30);
    expect(points({ weight: 30 }, 1)).toBe(10);
    expect(points({ weight: 30 }, undefined)).toBe(0);
  });
  it('all 3s give 100%, nothing scored gives null', () => {
    expect(weightedTotal(Object.fromEntries(crit.map((c) => [c.id, 3])), crit)).toBeCloseTo(100);
    expect(weightedTotal({}, crit)).toBeNull();
    expect(weightedTotal(null, crit)).toBeNull();
  });
  it('bands and tags', () => {
    expect([95, 85, 75, 50, null].map(band)).toEqual(['green', 'blue', 'amber', 'red', 'none']);
    expect(callTag(92).label).toBe('Great Example');
    expect(callTag(86).label).toBe('On Track');
    expect(callTag(70).label).toBe('Coaching Opportunity');
    expect(fmtPct(81.6)).toBe('82%');
    expect(fmtPct(null)).toBe('—');
  });
  it('sample call 2857391 scores 82% (documented in README)', () => {
    expect(Math.round(weightedTotal(callById('2857391').ai, crit))).toBe(82);
  });
});

describe('metrics on seed data', () => {
  const s = seed();
  const m = buildMetrics(s.reviews, criteriaOf(s));
  const q = buildQueue(s, m);
  it('fingerprint is stable', () => {
    const fp = {
      calls: CALLS.length,
      teamTrend: m.trend('team').map((v) => Math.round(v * 10) / 10),
      a1: Math.round(m.stats('a1').qa * 10) / 10,
      todayN: m.today.n,
      queue: q.length,
      queueHead: q.slice(0, 5).map((x) => x.call.id),
      goals: s.goals.map((g) => { const r = m.goal(g); return [g.id, r.met, r.miss, r.na, r.status]; }),
      calibration: Math.round(m.calibration.overall * 10) / 10,
    };
    expect(fp).toMatchSnapshot();
  });
  it('Ask answers are computed from the data', () => {
    const a = askAi('How is my team performing today?', { metrics: m, state: s, criteria: criteriaOf(s) });
    expect(a.title).toBeTruthy();
    expect(a).toMatchSnapshot();
  });
});

describe('reducer', () => {
  const crit = criteriaOf(seed());
  it('score toggles a value and tracks overrides against the AI', () => {
    let s = seed();
    const call = callById('2857391');
    const cat = 'opening';
    const other = call.ai[cat] === 3 ? 1 : 3;
    s = reducer(s, { type: 'score', callId: call.id, cat, value: other });
    expect(s.reviews[call.id].coach[cat]).toBe(other);
    expect(s.reviews[call.id].overrides[cat]).toEqual({ from: call.ai[cat], to: other, reason: '' });
    expect(s.reviews[call.id].status).toBe('draft');
    s = reducer(s, { type: 'overrideReason', callId: call.id, cat, text: 'why' });
    expect(s.reviews[call.id].overrides[cat].reason).toBe('why');
    s = reducer(s, { type: 'score', callId: call.id, cat, value: other });
    expect(s.reviews[call.id].coach[cat]).toBeUndefined();
    expect(callStatus(s, call)).toBe('In Review');
  });
  it('save, accept, clear', () => {
    let s = seed();
    const id = '2857391';
    s = reducer(s, { type: 'saveReview', callId: id, reviewer: 'Diego Herrera' });
    expect(s.reviews[id]).toMatchObject({ status: 'saved', reviewer: 'Diego Herrera', reviewed: '05/15/2025' });
    s = reducer(s, { type: 'clearReview', callId: id });
    expect(getReview(s, callById(id)).coach).toEqual({});
    s = reducer(s, { type: 'acceptAi', callId: id });
    expect(s.reviews[id]).toMatchObject({ status: 'saved', accepted: true });
  });
  it('dispute lifecycle', () => {
    let s = seed();
    const id = '2857391';
    s = reducer(s, { type: 'dispute', callId: id, cat: 'opening', reason: 'Email on file' });
    expect(callStatus(s, callById(id))).toBe('Disputed');
    s = reducer(s, { type: 'resolveDispute', callId: id, text: 'ok' });
    expect(s.disputes[id]).toMatchObject({ status: 'Resolved', resolution: 'ok' });
  });
  it('sessions, goals, alerts, rubric', () => {
    let s = seed();
    const session = { id: 'sX', agentId: 'a1', date: '05/15/2025', topic: 'T', cat: 'opening', callId: null, status: 'Scheduled', notes: '', actionItems: [{ text: 'x', done: false }] };
    s = reducer(s, { type: 'addSession', session });
    expect(s.sessions[0].id).toBe('sX');
    s = reducer(s, { type: 'toggleAction', id: 'sX', index: 0 });
    expect(s.sessions[0].actionItems[0].done).toBe(true);
    s = reducer(s, { type: 'updateSession', id: 'sX', patch: { status: 'Delivered' } });
    expect(s.sessions[0].status).toBe('Delivered');
    s = reducer(s, { type: 'addGoal', sessionId: 'sX', goal: { id: 'gX' } });
    expect(s.goals[0].id).toBe('gX');
    expect(s.sessions[0].followUpGoalId).toBe('gX');
    s = reducer(s, { type: 'updateAlert', id: s.alerts[0].id, patch: { status: 'Reviewed' } });
    expect(s.alerts[0].status).toBe('Reviewed');
    const v = s.rubric.version;
    s = reducer(s, { type: 'publishRubric', criteria: crit });
    expect(s.rubric.version).toBe(v + 1);
    expect(reducer(s, { type: 'reset' }).rubric.version).toBe(v);
  });
  it('agent / call selection', () => {
    let s = seed();
    s = reducer(s, { type: 'call', callId: '2857391' });
    expect(s.agentId).toBe(callById('2857391').agentId);
    s = reducer(s, { type: 'agent', agentId: 'a2' });
    expect(callById(s.callId).agentId).toBe('a2');
    expect(reducer(s, { type: 'call', callId: 'nope' })).toBe(s);
  });
  it('sign-in sets the role from the account; sign-out and reset keep the demo data', () => {
    let s = seed();
    expect(reducer(s, { type: 'login', email: 'nobody@example.com' })).toBe(s);
    s = reducer(s, { type: 'login', email: 'Agent@gmail.com ' });
    expect(s).toMatchObject({ user: 'agent@gmail.com', role: 'agent' });
    expect(reducer(s, { type: 'reset' })).toMatchObject({ user: 'agent@gmail.com', role: 'agent' });
    s = reducer(s, { type: 'updateSession', id: 's1', patch: { status: 'Acknowledged' } });
    const out = reducer(s, { type: 'logout' });
    expect(out.user).toBeNull();
    expect(out.sessions).toBe(s.sessions);
    expect(reducer(out, { type: 'login', email: 'steve@powerconnect.ai' }).role).toBe('supervisor');
  });
  it('demo accounts accept only the shared password', () => {
    expect(checkLogin('admin@gmail.com', 'admin')?.role).toBe('supervisor');
    expect(checkLogin('admin@gmail.com', 'Admin')).toBeNull();
    expect(checkLogin('someone@gmail.com', 'admin')).toBeNull();
  });
  it('biggest gap picks the largest weighted loss', () => {
    const g = biggestGap(callById('2857391').ai, crit);
    expect(g && g.id).toBeTruthy();
  });
  it('manual grading: no AI pre-fill, no overrides, finalized as Coach Graded with history', () => {
    let s = seed();
    const call = callById('2857391');
    s = reducer(s, { type: 'startManual', callId: call.id });
    expect(getReview(s, call)).toMatchObject({ method: 'manual', coach: {} });
    for (const c of crit) s = reducer(s, { type: 'score', callId: call.id, cat: c.id, value: 3 });
    expect(s.reviews[call.id].overrides).toEqual({});
    expect(gradingStatus(s, call)).toBe('In Review');
    s = reducer(s, { type: 'saveReview', callId: call.id, reviewer: 'Diego Herrera' });
    expect(gradingStatus(s, call)).toBe('Coach Graded');
    const h = s.reviews[call.id].history.at(-1);
    expect(h).toMatchObject({ by: 'Diego Herrera', action: 'Finalized (coach graded)' });
    expect(h.changes).toHaveLength(crit.length);
  });
  it('AI-assisted finalize records the original AI score, the change and the reason', () => {
    let s = seed();
    const call = callById('2857391');
    s = reducer(s, { type: 'saveDraft', callId: call.id, reviewer: 'Anna Kowalski' });
    expect(s.reviews[call.id].history[0].action).toBe('Draft saved');
    s = reducer(s, { type: 'score', callId: call.id, cat: 'opening', value: 3 });
    s = reducer(s, { type: 'overrideReason', callId: call.id, cat: 'opening', text: 'Email on file' });
    s = reducer(s, { type: 'saveReview', callId: call.id, reviewer: 'Anna Kowalski' });
    expect(gradingStatus(s, call)).toBe('Coach Validated');
    expect(s.reviews[call.id].history.at(-1).changes).toEqual([{ cat: 'opening', from: 1, to: 3, reason: 'Email on file' }]);
    expect(call.ai.opening).toBe(1); // original AI assessment preserved
    expect(reviewId(s, call)).toBe('QA-2857391');
  });
  it('editable highlights, opportunities, tags and moments are kept on the review', () => {
    let s = seed();
    const call = callById('2857391');
    expect(reviewNotes(getReview(s, call), crit).opps.map((o) => o.cat)).toContain('opening');
    s = reducer(s, { type: 'reviewField', callId: call.id, patch: { highlights: ['Calm'], tags: ['Good Example'], moments: [{ t: 12, type: 'opp', label: 'x' }] } });
    const r = getReview(s, call);
    expect(reviewNotes(r, crit).highlights).toEqual(['Calm']);
    expect(r.tags).toEqual(['Good Example']);
    expect(r.moments).toHaveLength(1);
  });
  it('developmental reviews are excluded from the QA average', () => {
    let s = seed();
    const call = callById('2857391');
    s = reducer(s, { type: 'markDev', callIds: [call.id], sessionId: 'sX' });
    expect(gradingStatus(s, call)).toBe('Developmental');
    expect(reviewId(s, call)).toBe('DV-2857391');
    const withDev = buildMetrics(s.reviews, crit, s.dev).range('a1', '2025-05-14', '2025-05-14');
    const without = buildMetrics(s.reviews, crit).range('a1', '2025-05-14', '2025-05-14');
    expect(withDev.aiGraded).toBe(without.aiGraded - 1);
    expect(withDev.analyzed).toBe(without.analyzed);
    expect(withDev.dev).toBe(1);
    s = reducer(s, { type: 'unmarkDev', callIds: [call.id] });
    expect(gradingStatus(s, call)).toBe('AI Graded');
    s = reducer(s, { type: 'submitDev', callId: call.id, note: 'help' });
    s = reducer(s, { type: 'unmarkDev', callIds: [call.id] });
    expect(s.dev[call.id].requested).toBe(true); // employee requests are not removed
  });
  it('sessions link several calls; goals have baselines, history and achieved-state monitoring', () => {
    let s = seed();
    const session = { id: 'sW', agentId: 'a1', type: 'performance', callIds: ['2857391', '2857274'], status: 'Draft', actionItems: [], date: '05/15/2025', topic: 'T' };
    s = reducer(s, { type: 'saveSession', session });
    expect(sessionCalls(s.sessions[0])).toEqual(['2857391', '2857274']);
    expect(callStatus(s, callById('2857274'))).toBe('AI Graded'); // drafts do not assign coaching
    s = reducer(s, { type: 'saveSession', session: { ...session, status: 'Delivered' } });
    expect(s.sessions.filter((x) => x.id === 'sW')).toHaveLength(1);
    expect(callStatus(s, callById('2857274'))).toBe('Coaching assigned');
    const m = buildMetrics(s.reviews, crit);
    const g1 = m.goal(s.goals.find((g) => g.id === 'g1'));
    expect(g1.baseline).toBeGreaterThanOrEqual(0);
    expect(g1.improvement).toBeCloseTo(g1.pct - g1.baseline);
    expect(['Improving', 'Steady', 'Declining']).toContain(g1.direction);
    s = reducer(s, { type: 'updateGoal', id: 'g1', patch: { target: 85, state: 'Achieved' }, change: 'Raised target' });
    const g = s.goals.find((x) => x.id === 'g1');
    expect(g).toMatchObject({ target: 85, state: 'Achieved' });
    expect(g.history.at(-1).change).toBe('Raised target');
    expect(typeof m.goal(g).slipping).toBe('boolean');
  });
  it('weekly and monthly series cover the requested periods', () => {
    const m = buildMetrics(seed().reviews, crit);
    expect(m.series('a1', 'week', 8)).toHaveLength(8);
    expect(m.series('a1', 'month').map((p) => p.label)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May*']);
  });
});
