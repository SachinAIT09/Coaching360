import { weightedTotal, points } from './score';
import { insight } from '../data/rubric';
import { INTENTS } from '../data/intents';
import { agentById, firstName } from '../data/agents';

export { insight };

// Reviewer scores for a call: a saved/draft review if any, otherwise the AI pre-grade.
export function getReview(state, call) {
  const r = state.reviews[call.id];
  return {
    coach: r ? r.coach : { ...call.ai },
    edited: !!r,
    notes: r ? r.notes : call.note,
    status: r ? r.status : 'ai',
    method: (r && r.method) || 'ai',
    overrides: (r && r.overrides) || {},
    reviewer: r && r.reviewer,
    reviewed: r && r.reviewed,
    accepted: r && r.accepted,
    history: (r && r.history) || [],
    highlights: r && r.highlights,
    opps: r && r.opps,
    tags: (r && r.tags) || [],
    moments: (r && r.moments) || [],
    summary: r && r.summary,
    team: r && r.team,
  };
}

// Score used everywhere outside the grading form: saved reviewer scores win over AI
export const effectiveScores = (state, call) => {
  const r = state.reviews[call.id];
  return r && r.status === 'saved' ? { ...call.ai, ...r.coach } : call.ai;
};

// Criterion with the largest weighted points lost
export function biggestGap(scores, criteria) {
  const lost = criteria
    .filter((c) => scores[c.id])
    .map((c) => ({ c, lost: c.weight - points(c, scores[c.id]) }))
    .sort((a, b) => b.lost - a.lost);
  return lost.length && lost[0].lost > 0 ? lost[0].c : null;
}

export function talkingPoints(scores, criteria) {
  const lines = criteria.filter((c) => scores[c.id] && scores[c.id] < 3).map((c) => `• ${c.name} (scored ${scores[c.id]}): ${c.def}`);
  return lines.length ? lines.join('\n') : '• All categories met expectations. Recognise the agent and share this call as a model example.';
}

export const reviewTotal = (state, call, criteria) => weightedTotal(effectiveScores(state, call), criteria);

// AI-suggested highlights and opportunities for a set of scores (the coach can edit them)
export function suggestions(scores, criteria) {
  return {
    highlights: criteria.filter((c) => scores[c.id] === 3).slice(0, 4).map((c) => `${c.name}: ${insight(c.id, 3)}`),
    opps: criteria.filter((c) => scores[c.id] && scores[c.id] < 3).map((c) => ({ cat: c.id, text: insight(c.id, scores[c.id]) })),
  };
}
// Highlights / opportunities shown for a review: the coach's edited lists, else the suggestions
export function reviewNotes(rev, criteria) {
  const s = suggestions(rev.coach, criteria);
  return { highlights: rev.highlights || s.highlights, opps: rev.opps || s.opps, edited: !!(rev.highlights || rev.opps) };
}

// AI-generated call summary, built from the call's intent and scores
export function aiSummary(call) {
  const I = INTENTS[call.intentKey];
  const a = firstName(agentById(call.agentId));
  const s = call.ai;
  const parts = [
    `The customer ${call.direction === 'Outbound' ? 'was called back about' : 'called about'} ${I.label.toLowerCase()}.`,
    s.wordChoice === 3 ? `${a} explained the situation clearly` : `${a} explained the situation, but the customer needed it rephrased`,
    s.expectation === 3 ? 'and gave specific next steps with a timeframe.' : s.expectation === 2 ? 'and outlined next steps without a firm timeframe.' : 'but did not give next steps.',
    call.sentiment === 'Negative' ? `The customer remained ${call.emotion.toLowerCase()} at the end of the call.` : call.sentiment === 'Positive' ? 'The customer was satisfied with the outcome.' : 'The customer accepted the explanation.',
  ];
  if (call.violation) parts.push(`Policy concern: ${call.violation.toLowerCase()}.`);
  return parts.join(' ');
}

// Developmental (non-graded) reviews are excluded from the QA average
export const isDev = (state, call) => !!(state.dev && state.dev[call.id]);
export const reviewId = (state, call) => `${isDev(state, call) ? 'DV' : 'QA'}-${call.id}`;

// How the evaluation was completed
export function gradingStatus(state, call) {
  if (isDev(state, call)) return 'Developmental';
  const r = state.reviews[call.id];
  if (!r) return 'AI Graded';
  if (r.status !== 'saved') return 'In Review';
  return r.method === 'manual' ? 'Coach Graded' : 'Coach Validated';
}

export const sessionCalls = (s) => s.callIds || (s.callId ? [s.callId] : []);

// Call lifecycle: AI Graded → In Review → Coach Validated / Coach Graded → Coaching assigned → Acknowledged | Disputed → Closed
export function callStatus(state, call) {
  const d = state.disputes[call.id];
  if (d && d.status === 'Open') return 'Disputed';
  const s = state.sessions.find((x) => x.status !== 'Draft' && sessionCalls(x).includes(call.id));
  if (s) {
    if (s.status === 'Disputed') return 'Disputed';
    if (s.status === 'Acknowledged' || s.status === 'Resolved') return s.actionItems.every((a) => a.done) ? 'Closed' : 'Acknowledged';
    return 'Coaching assigned';
  }
  return gradingStatus(state, call);
}

export const STATUS_CLS = {
  'AI Graded': 'gray', 'In Review': 'amber', 'Coach Validated': 'blue', 'Coach Graded': 'blue', Developmental: 'gray',
  'Coaching assigned': 'blue', Acknowledged: 'green', Closed: 'green', Disputed: 'red',
};

export const SESSION_TYPES = {
  developmental: { label: 'Developmental Call Review', short: 'Developmental', desc: 'A non-graded interaction reviewed for learning, including calls the employee submits for feedback. Does not affect the QA average.' },
  performance: { label: 'Performance Coaching', short: 'Performance', desc: 'Discuss graded interactions, performance expectations and opportunities for improvement.' },
  general: { label: 'General Coaching', short: 'General', desc: 'A development conversation that is not tied to a specific call.' },
};

export const SESSION_CLS = { Draft: 'gray', Scheduled: 'blue', Delivered: 'amber', Acknowledged: 'green', Resolved: 'green', Disputed: 'red' };
export const SESSION_LABEL = { Draft: 'Draft', Scheduled: 'Scheduled', Delivered: 'Awaiting acknowledgement', Acknowledged: 'Acknowledged', Resolved: 'Resolved', Disputed: 'Disputed' };
