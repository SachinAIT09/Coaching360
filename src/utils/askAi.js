import { AGENTS, agentById } from '../data/agents';
import { CALLS } from '../data/calls';
import { fmtPct } from './score';
import { LAST7 } from './metrics';
import { MAY, TODAY_ISO } from './dates';

// Canned "Ask about your team" answers, computed from the same metrics as the screens.
export const SUGGESTIONS = [
  'How is my team performing today?',
  'How many calls did we receive today, and what were they about?',
  'Who needs coaching on Opening?',
  'Who are my top performers this month?',
  'Show negative-sentiment calls this week',
  'Any open policy alerts?',
];

const CAT_WORDS = {
  opening: ['opening', 'greeting', 'email'],
  closing: ['closing', 'recap', 'close'],
  expectation: ['expectation', 'timeframe', 'next step'],
  accuracy: ['accuracy', 'accurate', 'verification'],
  wordChoice: ['word choice', 'jargon', 'clarity'],
  politeness: ['politeness', 'polite', 'empathy'],
  tone: ['tone', 'monotone'],
  pace: ['pace', 'speed', 'fast'],
};

const has = (q, ...words) => words.some((w) => q.includes(w));

export function askAi(question, { metrics, state, criteria }) {
  const q = question.toLowerCase();
  const team = metrics.stats('team');
  const qa = (a) => metrics.stats(a.id).qa;

  if (has(q, 'alert', 'violation', 'policy', 'injection', 'security')) {
    const open = state.alerts.filter((x) => x.status === 'Open');
    return {
      title: `${open.length} open policy alert${open.length === 1 ? '' : 's'}`,
      text: open.length ? 'These were sent to supervisors by email or voice call and still need review.' : 'All alerts have been reviewed.',
      rows: open.map((x) => ({ label: `${x.type} · ${agentById(x.agentId).name}`, value: x.severity, to: '/reports?r=alerts' })),
    };
  }

  if (has(q, 'how many calls', 'calls today', 'what were they about', 'volume', 'received')) {
    const t = metrics.today;
    const [topIntent, topN] = t.intents[0] || ['—', 0];
    return {
      title: `${t.n} calls so far today`,
      text: `As of 12:00, ${t.n} calls have been handled and AI-scored. The most common reason was ${topIntent.toLowerCase()} (${fmtPct((topN / t.n) * 100)}). Average QA today is ${fmtPct(t.qa)}.`,
      rows: t.intents.map(([label, n]) => ({ label, value: `${n} calls` })),
    };
  }

  if (has(q, 'negative', 'sentiment', 'upset', 'frustrat', 'angry', 'unhappy')) {
    const neg = CALLS.filter((c) => c.iso >= LAST7 && c.sentiment === 'Negative').sort((a, b) => metrics.total(a) - metrics.total(b));
    return {
      title: `${neg.length} negative-sentiment calls in the last 7 days`,
      text: `That is ${fmtPct((neg.length / CALLS.filter((c) => c.iso >= LAST7).length) * 100)} of calls. The lowest-scoring ones are below.`,
      rows: neg.slice(0, 5).map((c) => ({ label: `${c.date} · ${agentById(c.agentId).name} · ${c.intent[1]}`, value: fmtPct(metrics.total(c)), callId: c.id })),
    };
  }

  if (has(q, 'aht', 'handle time', 'handling time', 'long calls')) {
    const prev = metrics.stats('team', MAY - 1).aht;
    return {
      title: `Average handle time ${team.aht.toFixed(1)} min this month`,
      text: `Down ${(prev - team.aht).toFixed(1)} min from April. Newer agents have the longest calls.`,
      rows: AGENTS.map((a) => ({ a, v: metrics.stats(a.id).aht })).sort((x, y) => y.v - x.v)
        .map(({ a, v }) => ({ label: a.name, value: `${v.toFixed(1)} min`, agentId: a.id })),
    };
  }

  if (has(q, 'top', 'best', 'performer', 'leader')) {
    const ranked = AGENTS.slice().sort((a, b) => qa(b) - qa(a));
    return {
      title: `${ranked[0].name} leads the team this month`,
      text: `Top three by QA score, May to date. Team average is ${fmtPct(team.qa)}.`,
      rows: ranked.slice(0, 3).map((a, i) => ({ label: `#${i + 1} ${a.name}`, value: fmtPct(qa(a)), agentId: a.id })),
    };
  }

  const cat = Object.keys(CAT_WORDS).find((id) => CAT_WORDS[id].some((w) => q.includes(w)));
  const catLabel = cat && (criteria.find((c) => c.id === cat)?.name || cat);
  if (cat && has(q, 'coach', 'who', 'need', 'struggl', 'below', 'help')) {
    const below = AGENTS.map((a) => ({ a, v: metrics.stats(a.id).cat[cat] })).filter((x) => x.v < 85).sort((x, y) => x.v - y.v);
    return {
      title: below.length ? `${below.length} agents are below 85% on ${catLabel}` : `Everyone is above 85% on ${catLabel}`,
      text: below.length ? `${below[0].a.name} has the biggest gap. Percentages are calls meeting expectations, May to date.` : 'No coaching needed on this category right now.',
      rows: below.map(({ a, v }) => ({ label: a.name, value: fmtPct(v), agentId: a.id })),
    };
  }
  if (cat) {
    const t = metrics.trend('team');
    return {
      title: `${catLabel}: ${fmtPct(team.cat[cat])} of calls meet expectations`,
      text: `Team-wide, May to date. In January it was ${fmtPct(metrics.stats('team', 0).cat[cat])}. Team QA moved from ${fmtPct(t[0])} to ${fmtPct(t[4])}.`,
      rows: AGENTS.map((a) => ({ label: a.name, value: fmtPct(metrics.stats(a.id).cat[cat]), agentId: a.id })),
    };
  }

  if (has(q, 'perform', 'doing', 'how is', "how's", 'team', 'today', 'overview', 'summary')) {
    const t = metrics.today;
    const byAgent = AGENTS.map((a) => {
      const cs = CALLS.filter((c) => c.iso === TODAY_ISO && c.agentId === a.id);
      return { a, n: cs.length, v: cs.length ? cs.reduce((s, c) => s + metrics.total(c), 0) / cs.length : null };
    }).sort((x, y) => y.v - x.v);
    const best = byAgent[0];
    const worst = byAgent[byAgent.length - 1];
    return {
      title: `Team QA is ${fmtPct(t.qa)} today (${fmtPct(team.qa)} month to date)`,
      text: `${t.n} calls scored so far. ${best.a.name} is strongest today at ${fmtPct(best.v)}; ${worst.a.name} is lowest at ${fmtPct(worst.v)}. ${fmtPct(t.neg)} of today's calls had negative sentiment, and ${state.alerts.filter((x) => x.status === 'Open').length} alerts are open.`,
      rows: byAgent.map(({ a, n, v }) => ({ label: `${a.name} · ${n} calls`, value: fmtPct(v), agentId: a.id })),
    };
  }

  return { title: "I can't answer that one yet", text: 'This demo answers questions about team performance, call volume, coaching needs, sentiment, handle time and alerts. Try one of the suggestions above.' };
}
