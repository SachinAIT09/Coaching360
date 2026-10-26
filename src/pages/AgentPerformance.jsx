import { Fragment, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, ArrowUpRight, Play,
  ClipboardCheck, MessageSquarePlus, Info, HelpCircle,
} from 'lucide-react';
import { Card, Badge, ProgressBar, LineChart, Tabs, AudioPlayer, useAudio, Modal, Field, Page, PageHeader, EmptyState, StatGrid, toneText, cx } from '../components/ui';
import { AgentStrip } from '../components/Layout';
import { AgentNav } from '../components/AgentNav';
import { ConfBadge, StatusChip, EvidenceList, TranscriptList, keyMoments } from '../components/CallParts';
import { CallsModal, SourceBadge, workspaceLink } from '../components/CallList';
import { CAT_ORDER, goalBehavior, insight } from '../data/rubric';
import { agentById } from '../data/agents';
import { callById, callsFor, sentimentSeries } from '../data/calls';
import { getConversation } from '../data/transcripts';
import { useApp, useViewAgent } from '../state/AppContext';
import { getReview, callStatus, gradingStatus, isDev, reviewId, SESSION_CLS, SESSION_LABEL } from '../utils/review';
import { weightedTotal, band, fmtPct, fmtTime } from '../utils/score';
import { TODAY_ISO, addDays, toISO, CUR, MONTHS } from '../utils/dates';
import { PERIODS, windowOf, isAgentId, rosterParams, gradingPath } from '../utils/roster';

const TABS = ['AI Evaluation', 'Transcript', 'Key Moments', 'Sentiment', 'Notes'];
const viewAll = (to, label = 'View all') => <Link className="link-btn" to={to}>{label}</Link>;
const DIR = { Improving: [TrendingUp, 'text-success-fg'], Declining: [TrendingDown, 'text-danger-fg'], Steady: [Minus, 'text-fg-subtle'] };

const agentGoals = (state, agent) => state.goals.filter((g) => g.agentId === agent.id || (g.agentId === 'team' && g.team === agent.team));

function Delta({ cur, prev, unit = ' pts', invert }) {
  if (cur == null || prev == null) return <span className="text-xs text-fg-subtle">no prior period</span>;
  const d = cur - prev;
  const good = invert ? d < 0 : d > 0;
  const Icon = Math.abs(d) < 0.5 ? Minus : d > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cx('inline-flex items-center gap-1 text-xs font-medium', Math.abs(d) < 0.5 ? 'text-fg-subtle' : good ? 'text-success-fg' : 'text-danger-fg')}>
      <Icon size={12} aria-hidden="true" />{d > 0 ? '+' : ''}{unit === '%' ? Math.round(d) : Math.round(d * 10) / 10}{unit} <span className="font-normal text-fg-subtle">vs prior</span>
    </span>
  );
}

function MetricButton({ label, value, valueClass = '', sub, onClick, children }) {
  return (
    <button onClick={onClick} className="card card-action group flex flex-col gap-1 rounded-panel p-5 text-left text-fg">
      <span className="label-caps flex items-center justify-between gap-2">{label}<ArrowUpRight size={14} className="text-fg-muted group-hover:text-fg" aria-hidden="true" /></span>
      <b className={cx('num-display mt-1 text-[22px] leading-7', valueClass)}>{value}</b>
      {(sub || children) && <span className="mt-2 flex flex-col gap-1 border-t border-border pt-2">{sub}{children}</span>}
    </button>
  );
}

function FeedbackModal({ call, onClose }) {
  const { dispatch, notify } = useApp();
  const [note, setNote] = useState('');
  return (
    <Modal
      title={`Request feedback on call ${call.id}`} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={note.trim().length < 5} onClick={() => {
          dispatch({ type: 'submitDev', callId: call.id, note: note.trim() });
          notify('Sent to your QA coach for a developmental review'); onClose();
        }}>Send request</button>
      </>}
    >
      <Field label="What would you like feedback on?">
        <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The customer was upset about a disconnect notice. How could I have calmed them down sooner?" />
      </Field>
      <p className="mt-3 text-ui text-fg-subtle">Developmental reviews are not graded and do not affect your QA average.</p>
    </Modal>
  );
}

function DisputeModal({ call, onClose }) {
  const { dispatch, notify, criteria } = useApp();
  const options = criteria.filter((c) => call.ai[c.id] != null).sort((a, b) => call.ai[a.id] - call.ai[b.id]);
  const [cat, setCat] = useState(options[0]?.id);
  const [reason, setReason] = useState('');
  return (
    <Modal
      title={`Dispute score on call ${call.id}`} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={reason.trim().length < 5} onClick={() => {
          dispatch({ type: 'dispute', callId: call.id, cat, reason: reason.trim() });
          notify('Dispute sent to your supervisor'); onClose();
        }}>Send dispute</button>
      </>}
    >
      <Field label="Category">
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          {options.map((c) => <option key={c.id} value={c.id}>{c.name} (AI scored {call.ai[c.id]})</option>)}
        </select>
      </Field>
      <Field label="Why do you disagree?" className="mt-4">
        <textarea rows={4} placeholder="e.g. The customer's email was already on file and I confirmed it." value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby="dispute-hint" />
      </Field>
      <p id="dispute-hint" className="mt-3 text-ui text-fg-subtle">At least 5 characters. Your supervisor sees this in their Review Queue and can re-score the call.</p>
    </Modal>
  );
}

function ReviewPanel({ call, mine }) {
  const { state, criteria } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('AI Evaluation');
  const [open, setOpen] = useState(null);
  const [disputing, setDisputing] = useState(false);
  const [asking, setAsking] = useState(false);
  const audio = useAudio(call.durSec);
  const conv = getConversation(call);
  const rev = getReview(state, call);
  const reviewed = rev.status === 'saved' && !rev.accepted;
  const aiTotal = weightedTotal(call.ai, criteria);
  const revTotal = reviewed ? weightedTotal({ ...call.ai, ...rev.coach }, criteria) : null;
  const dispute = state.disputes[call.id];
  const sent = sentimentSeries(call);
  const jump = (t) => { audio.seek(t); if (!audio.playing) audio.toggle(); setTab('Transcript'); };

  return (
    <Card
      title="Call Review & AI Grading"
      right={<span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle"><span>Call date: <b className="text-fg-muted tabular-nums">{call.date}</b></span><span>Call ID: <b className="text-fg-muted tabular-nums">{call.id}</b></span><span className="tabular-nums">{reviewId(state, call)}</span><StatusChip status={callStatus(state, call)} /></span>}
    >
      <AudioPlayer audio={audio} duration={call.durSec} seed={Number(call.id)} />
      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mt-4 mb-3" label="Call review" />

      {tab === 'AI Evaluation' && (
        <>
          <p className="mb-2 text-xs text-fg-subtle">Select a category to see the evidence behind the AI score.</p>
          <div className="table-wrap -mx-4 sm:-mx-5">
            <table className="tbl">
              <thead><tr><th>Category</th><th className="num">Weight</th><th className="num">AI</th><th>Confidence</th><th className="num">{reviewed ? 'Reviewer' : 'Coach'}</th><th>Comments / insights</th><th><span className="sr-only">Expand</span></th></tr></thead>
              <tbody>
                {criteria.map((c) => {
                  const d = conv.detail[c.id];
                  const ai = call.ai[c.id];
                  const rv = reviewed ? rev.coach[c.id] : null;
                  const isOpen = open === c.id;
                  const toggle = () => setOpen(isOpen ? null : c.id);
                  return (
                    <Fragment key={c.id}>
                      <tr className={cx('cursor-pointer transition-colors hover:bg-surface-hover', ai != null && ai < 3 && '[&>td]:bg-danger-soft')} onClick={toggle}>
                        <td className="font-medium whitespace-nowrap">{c.name}</td>
                        <td className="num">{c.weight}%</td>
                        <td className="num font-semibold">{ai ?? '—'}</td>
                        <td><ConfBadge value={d?.confidence} /></td>
                        <td className="num">{rv != null ? <b className={rv !== ai ? 'text-warning-fg' : ''}>{rv}</b> : <span className="text-fg-subtle">–</span>}</td>
                        <td className="min-w-48 text-fg-muted">{d ? d.reason : 'Added in template v' + state.rubric.version + '. No AI score for this call.'}</td>
                        <td className="w-10">
                          <button className="icon-btn" aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} evidence for ${c.name}`} onClick={(e) => { e.stopPropagation(); toggle(); }}>
                            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </button>
                        </td>
                      </tr>
                      {isOpen && <tr><td colSpan={7} className="bg-surface-muted py-3.5"><EvidenceList detail={d} onJump={jump} override={reviewed ? rev.overrides[c.id] : null} /></td></tr>}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'Transcript' && <TranscriptList lines={conv.lines} audio={audio} onJump={jump} tall />}

      {tab === 'Key Moments' && (
        <ul className="flex flex-col gap-0.5">
          {keyMoments(conv, call, criteria).map((m, i) => (
            <li key={i}><button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-ui hover:bg-surface-hover" onClick={() => jump(m.t)}>
              <time className="w-9 shrink-0 text-xs text-fg-subtle tabular-nums">{fmtTime(m.t)}</time>
              <Badge cls={m.type === 'good' ? 'green' : m.type === 'opp' ? 'red' : 'gray'}>{m.type === 'good' ? 'Highlight' : m.type === 'opp' ? 'Opportunity' : 'Context'}</Badge>
              <span className="min-w-0">{m.label}</span>
            </button></li>
          ))}
        </ul>
      )}

      {tab === 'Sentiment' && (
        <div>
          <div className="inset flex h-28 items-center gap-1 px-3 py-2" role="img" aria-label={`Customer sentiment over the call: overall ${call.sentiment}`}>
            {sent.map((v, i) => (
              <span
                key={i} title={v.toFixed(2)}
                className={cx('max-h-12 flex-1 rounded-sm', v >= 0.2 ? 'bg-success' : v <= -0.2 ? 'bg-danger' : 'bg-border-strong')}
                style={{ height: `${20 + Math.abs(v) * 40}px`, alignSelf: v >= 0 ? 'flex-end' : 'flex-start' }}
              />
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-5">
            {[
              ['Sentiment', call.sentiment],
              ['Customer emotion', call.emotion],
              ['Customer intent', call.intent[1]],
              ['Direction', call.direction],
              ['Contact note', <span key="n" className={call.notesOk ? 'text-success-fg' : 'text-danger-fg'}>{call.notesOk ? 'Complete' : `Missing: ${call.notesMissing}`}</span>],
            ].map(([k, v]) => (
              <div key={k} className="inset px-3 py-2.5"><dt className="text-xs text-fg-subtle">{k}</dt><dd className="text-ui font-semibold">{v}</dd></div>
            ))}
          </dl>
        </div>
      )}

      {tab === 'Notes' && (
        <div className="flex flex-col gap-2">
          <p className="text-ui text-fg-subtle">{reviewed ? `Reviewed by ${rev.reviewer} on ${rev.reviewed}` : 'Not reviewed by a person yet. The note below is the AI summary.'}</p>
          <pre className="inset px-3.5 py-3 font-sans text-ui leading-relaxed whitespace-pre-wrap">{rev.notes || 'No notes.'}</pre>
          {dispute && <p className="rounded-lg bg-danger-soft px-3 py-2 text-ui text-danger-fg"><b>Agent dispute ({dispute.status}):</b> {dispute.reason}{dispute.resolution ? ` — Supervisor: ${dispute.resolution}` : ''}</p>}
        </div>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-ui text-fg-subtle">
          <span>Weighted score (AI) <b className="ml-1 text-xl text-link tabular-nums">{fmtPct(aiTotal)}</b></span>
          {revTotal != null && <span>Reviewer <b className="ml-1 text-xl text-link tabular-nums">{fmtPct(revTotal)}</b></span>}
        </div>
        {mine ? (
          <div className="flex flex-wrap items-center gap-2">
            {state.dev[call.id]?.requested
              ? <Badge cls="amber">Feedback requested</Badge>
              : <button className="btn btn-secondary" onClick={() => setAsking(true)}>Request feedback</button>}
            {dispute
              ? <Badge cls={dispute.status === 'Open' ? 'amber' : 'green'}>Dispute {dispute.status.toLowerCase()}</Badge>
              : <button className="btn btn-secondary" onClick={() => setDisputing(true)}>Dispute score</button>}
          </div>
        ) : (
          <button className="btn btn-inverse" onClick={() => { navigate(gradingPath(call.id)); }}>Review in Call Grading</button>
        )}
      </footer>
      {disputing && <DisputeModal call={call} onClose={() => setDisputing(false)} />}
      {asking && <FeedbackModal call={call} onClose={() => setAsking(false)} />}
    </Card>
  );
}

function ImpactPanel({ cur, goals, open }) {
  const { metrics, criteria } = useApp();
  const [view, setView] = useState('Overall');
  const [cat, setCat] = useState(criteria[0].id);
  const [goalId, setGoalId] = useState(goals[0]?.id);
  const calls = cur.calls;
  const n = calls.length || 1;
  const avg = cur.qa || 0;
  const fmtImpact = (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} pts`;
  let body;
  if (view === 'Overall') {
    const rows = calls.map((c) => ({ call: c, v: (metrics.total(c) - avg) / n })).sort((a, b) => a.v - b.v);
    const list = (xs, title) => (
      <div className="min-w-0">
        <h3 className="mb-1.5 text-ui font-semibold">{title}</h3>
        <ul className="divide-y divide-border">
          {xs.map(({ call: c, v }) => (
            <li key={c.id} className="flex items-center gap-3 py-1.5 text-ui">
              <span className="w-20 shrink-0 text-xs text-fg-subtle tabular-nums">{c.date}</span>
              <span className="min-w-0 flex-1 truncate text-fg-muted">{c.focus}</span>
              <b className={cx('shrink-0 tabular-nums', toneText(band(metrics.total(c))))}>{fmtPct(metrics.total(c))}</b>
              <span className={cx('w-20 shrink-0 text-right text-xs tabular-nums', v < 0 ? 'text-danger-fg' : 'text-success-fg')}>{fmtImpact(v)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
    body = (
      <>
        <p className="mb-3 text-xs text-fg-subtle">Impact = how far a call moves the {fmtPct(avg)} average: (call score − average) ÷ {calls.length} calls.</p>
        <div className="grid gap-4 lg:grid-cols-2">{list(rows.slice(0, 5), 'Pulling the score down')}{list(rows.slice(-5).reverse(), 'Lifting the score')}</div>
        <button className="link-btn mt-3" onClick={() => open('Score breakdown', calls.map((c) => ({ call: c, value: fmtImpact((metrics.total(c) - avg) / n) })).sort((a, b) => metrics.total(a.call) - metrics.total(b.call)), 'Impact')}>View all {calls.length} calls in the calculation</button>
      </>
    );
  } else if (view === 'By category') {
    const c0 = criteria.find((c) => c.id === cat);
    const missed = calls.filter((c) => (metrics.scores(c)[cat] || 3) < 3);
    const lost = missed.reduce((s, c) => s + (c0.weight * (3 - metrics.scores(c)[cat])) / 3, 0) / n;
    body = (
      <>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <select className="w-48" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">{criteria.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.weight}%)</option>)}</select>
          <span className="text-ui">{missed.length} of {calls.length} calls missed {c0.name}, costing <b>{lost.toFixed(1)} pts</b> of the overall score.</span>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={!missed.length} onClick={() => open(`${c0.name}: calls below expectation`, missed.map((c) => ({ call: c, note: insight(cat, metrics.scores(c)[cat]), value: `−${((c0.weight * (3 - metrics.scores(c)[cat])) / 3).toFixed(1)}` })), 'Pts lost')}>Show the {missed.length} calls</button>
      </>
    );
  } else if (view === 'By goal') {
    const g = goals.find((x) => x.id === goalId);
    const missed = g ? calls.filter((c) => c.iso >= toISO(g.assigned) && !(g.metric === 'notes' ? c.notesOk : metrics.scores(c)[g.cat] === 3) && !(goalBehavior(g)?.naOutbound && c.direction === 'Outbound')) : [];
    body = !g ? <EmptyState>No goals for this agent.</EmptyState> : (
      <>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <select className="w-72 max-w-full" value={goalId} onChange={(e) => setGoalId(e.target.value)} aria-label="Goal">{goals.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select>
          <span className="text-ui">{missed.length} calls in this period did not show the behavior.</span>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={!missed.length} onClick={() => open(`${g.title}: behavior not observed`, missed.map((c) => ({ call: c, note: goalBehavior(g)?.label })))}>Show the {missed.length} calls</button>
      </>
    );
  } else {
    const groups = {};
    for (const c of calls) (groups[c.intent[1]] = groups[c.intent[1]] || []).push(c);
    const rows = Object.entries(groups).map(([k, xs]) => ({ k, xs, avg: xs.reduce((s, c) => s + metrics.total(c), 0) / xs.length })).sort((a, b) => a.avg - b.avg);
    body = (
      <div className="table-wrap -mx-4 sm:-mx-5">
        <table className="tbl">
          <thead><tr><th>Call type</th><th className="num">Calls</th><th className="num">Avg score</th><th className="num">vs overall</th><th><span className="sr-only">Calls</span></th></tr></thead>
          <tbody>{rows.map(({ k, xs, avg: a }) => (
            <tr key={k}>
              <td className="font-medium">{k}</td><td className="num">{xs.length}</td><td className="num"><b className={toneText(band(a))}>{fmtPct(a)}</b></td>
              <td className={cx('num', a - avg < 0 ? 'text-danger-fg' : 'text-success-fg')}>{a - avg > 0 ? '+' : ''}{Math.round(a - avg)} pts</td>
              <td><button className="link-btn" onClick={() => open(`${k} calls`, xs.map((c) => ({ call: c })))}>View</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }
  return (
    <Card className="min-w-0" title="Calls impacting the overall QA score" right={<small>Uses coach-validated scores where they exist</small>}>
      <Tabs tabs={['Overall', 'By category', 'By goal', 'By call type']} value={view} onChange={setView} className="mb-3" label="Score impact views" />
      {body}
    </Card>
  );
}

// Supervisors reach an agent through /performance/:agentId; agents always see themselves
export default function AgentPerformance({ mine }) {
  const { state, dispatch } = useApp();
  const { agentId: param } = useParams();
  const me = useViewAgent(true);
  const valid = mine || isAgentId(param);
  useEffect(() => {
    if (!mine && valid && state.agentId !== param) dispatch({ type: 'agent', agentId: param });
  }, [mine, valid, param, state.agentId, dispatch]);
  if (!valid) return <Navigate to="/performance" replace />;
  return <PerformanceView key={mine ? me : param} agentId={mine ? me : param} mine={mine} />;
}

function PerformanceView({ agentId, mine }) {
  const { state, dispatch, metrics, criteria } = useApp();
  const navigate = useNavigate();
  const { search } = useLocation();
  const agent = agentById(agentId);
  const calls = callsFor(agent.id);
  const [period, setPeriod] = useState(() => (mine ? '30' : rosterParams(search).period));
  const [gran, setGran] = useState('Weekly');
  const [drill, setDrill] = useState(null);
  const sel = callById(state.callId);
  const call = sel && sel.agentId === agent.id ? sel : calls[0];
  const w = windowOf(period);
  const cur = metrics.range(agent.id, w.from);
  const prev = w.prev ? metrics.range(agent.id, w.prev.from, w.prev.to) : null;
  const goals = agentGoals(state, agent);
  const active = goals.filter((g) => (g.state || 'Active') === 'Active');
  const achieved = goals.filter((g) => g.state === 'Achieved');
  const goalPct = active.length ? active.reduce((s, g) => s + metrics.goal(g).pct, 0) / active.length : null;
  const sessions = state.sessions.filter((s) => s.agentId === agent.id && s.status !== 'Draft');
  const completed = sessions.filter((s) => s.status !== 'Scheduled').length;
  const base = mine ? '/me' : '';
  const open = (title, rows, valueLabel, description) => setDrill({ title, rows, valueLabel, description });
  const reviewedCalls = cur.calls.filter((c) => state.reviews[c.id]?.status === 'saved');
  const analyzedCalls = calls.filter((c) => c.iso >= w.from);

  const trend = metrics.series(agent.id, gran === 'Weekly' ? 'week' : 'month', 10);
  const marks = sessions.map((s) => {
    const iso = toISO(s.date);
    const i = trend.findIndex((p) => iso >= p.from && iso <= p.to);
    return i >= 0 ? { index: i, label: `Coached: ${s.topic.split(/[—-]/)[0].trim()}` } : null;
  }).filter(Boolean);
  const cats = CAT_ORDER.map((id) => criteria.find((c) => c.id === id)).filter(Boolean);

  // Sentiment & experience
  const neg = cur.calls.filter((c) => c.sentiment === 'Negative');
  const situational = neg.filter((c) => metrics.total(c) >= 85);
  const service = neg.filter((c) => metrics.total(c) < 75);
  const rating = cur.n ? (cur.pos * 5 + cur.neu * 3 + cur.neg * 1) / 100 : null;
  const prevRating = prev && prev.n ? (prev.pos * 5 + prev.neu * 3 + prev.neg * 1) / 100 : null;
  const themes = (xs) => Object.entries(xs.reduce((m, c) => ({ ...m, [c.intent[1]]: (m[c.intent[1]] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Trend & risk indicators
  const risks = [];
  if (prev && cur.qa != null && prev.qa != null && Math.abs(cur.qa - prev.qa) >= 2) {
    risks.push({ tone: cur.qa > prev.qa ? 'good' : 'bad', text: `Overall QA ${cur.qa > prev.qa ? 'improved' : 'declined'} ${Math.abs(Math.round(cur.qa - prev.qa))} pts vs the prior period (${fmtPct(prev.qa)} → ${fmtPct(cur.qa)}).`, rows: cur.calls.map((c) => ({ call: c })) });
  }
  if (prev) {
    for (const c of criteria) {
      const a = cur.cat[c.id], b = prev.cat[c.id];
      if (a == null || b == null || cur.n < 10) continue;
      if (a - b <= -8) risks.push({ tone: 'bad', text: `${c.name} is declining: ${fmtPct(b)} → ${fmtPct(a)} of calls meet expectations.`, rows: cur.calls.filter((x) => metrics.scores(x)[c.id] < 3).map((x) => ({ call: x, note: insight(c.id, metrics.scores(x)[c.id]) })) });
      else if (a - b >= 8) risks.push({ tone: 'good', text: `${c.name} is improving: ${fmtPct(b)} → ${fmtPct(a)}.`, rows: cur.calls.filter((x) => metrics.scores(x)[c.id] === 3).map((x) => ({ call: x })) });
    }
    if (cur.neg != null && prev.neg != null && cur.neg - prev.neg >= 5) risks.push({ tone: 'bad', text: `Customer frustration is rising: negative sentiment ${fmtPct(prev.neg)} → ${fmtPct(cur.neg)} of calls.`, rows: neg.map((c) => ({ call: c })) });
  }
  for (const g of active) {
    const gc = metrics.goal(g);
    if (gc.direction !== 'Steady') risks.push({ tone: gc.direction === 'Improving' ? 'good' : 'bad', text: `Goal "${g.title}" is ${gc.direction.toLowerCase()} (${fmtPct(gc.prior.pct)} → ${fmtPct(gc.last.pct)} over the last two weeks).`, to: `${base}/goals` });
  }
  for (const g of achieved) {
    const gc = metrics.goal(g);
    if (gc.slipping) risks.push({ tone: 'bad', text: `Previously achieved goal "${g.title}" is slipping: ${fmtPct(gc.last.pct)} in the last 14 days (target ${g.target}%).`, to: `${base}/goals` });
  }
  // Behaviors coached before that are resurfacing: compliance in the last 14 days vs the 14 days after the session
  for (const s of sessions.filter((x) => x.cat && (x.status === 'Acknowledged' || x.status === 'Resolved'))) {
    const iso = toISO(s.date);
    if (iso > addDays(TODAY_ISO, -28)) continue;
    const after = metrics.range(agent.id, iso, addDays(iso, 13)).cat[s.cat];
    const lastR = metrics.range(agent.id, addDays(TODAY_ISO, -13));
    const now = lastR.cat[s.cat];
    if (after != null && now != null && after - now >= 10) {
      risks.push({ tone: 'bad', text: `${s.topic} (coached ${s.date}) may be resurfacing: ${fmtPct(after)} after coaching → ${fmtPct(now)} in the last 14 days.`, rows: lastR.calls.filter((x) => metrics.scores(x)[s.cat] < 3).map((x) => ({ call: x })) });
    }
  }

  return (
    <Page>
      {mine && <PageHeader title="My Performance" description="Your QA scores, with the evidence behind every AI score." />}
      {!mine && <AgentNav agentId={agent.id} base="/performance" label="Agent Performance" />}
      <AgentStrip
        agentId={agent.id} heading={mine ? 'h2' : 'h1'}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge stats={cur} />
            <select className="h-9 w-40" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Reporting period">{Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricButton label="Overall QA score" value={fmtPct(cur.qa)} valueClass={toneText(band(cur.qa))} sub={<Delta cur={cur.qa} prev={prev?.qa} />}
          onClick={() => open('Score breakdown', cur.calls.map((c) => ({ call: c })).sort((a, b) => metrics.total(a.call) - metrics.total(b.call)), null, `${cur.aiGraded} calls in the calculation. Coach-validated scores replace AI scores where they exist.`)} />
        <MetricButton label="AI-graded calls" value={cur.aiGraded} sub={<Delta cur={cur.aiGraded} prev={prev?.aiGraded} unit="" />}
          onClick={() => open('AI-graded calls', cur.calls.map((c) => ({ call: c })))} />
        <MetricButton label="Total calls analyzed" value={cur.analyzed} sub={<span className="text-xs text-fg-subtle">{cur.dev} developmental (non-graded)</span>}
          onClick={() => open('All analyzed calls', analyzedCalls.map((c) => ({ call: c, note: isDev(state, c) ? 'Developmental review, excluded from QA' : undefined })))} />
        <MetricButton label="Coach reviewed" value={cur.coachReviewed} sub={<span className="text-xs text-fg-subtle">{cur.validated} validated · {cur.manual} manual · {cur.accepted} accepted</span>}
          onClick={() => open('Coach-reviewed calls', reviewedCalls.map((c) => ({ call: c, note: `${gradingStatus(state, c)} by ${state.reviews[c.id].reviewer}` })))} />
        <MetricButton label="Goal compliance" value={fmtPct(goalPct)} sub={<span className="text-xs text-fg-subtle">{active.length} active goal{active.length === 1 ? '' : 's'}</span>} onClick={() => navigate(`${base}/goals`)} />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card title="QA score trend" right={<Tabs tabs={['Weekly', 'Monthly']} value={gran} onChange={setGran} label="Trend granularity" />}>
          <LineChart data={trend} marks={marks} onSelect={(i) => {
            const p = trend[i];
            open(`Calls for ${p.label} (${p.from === p.to ? p.from : `${p.from} – ${p.to}`})`, metrics.range(agent.id, p.from, p.to).calls.map((c) => ({ call: c })));
          }} />
          <p className="mt-1 text-xs text-fg-subtle">Select a point to see its calls. Dashed lines mark coaching sessions.{gran === 'Monthly' && ` *${MONTHS[CUR]} to date.`}</p>
        </Card>
        <Card title="Category performance" right={<span className="text-xs text-fg-subtle">% meeting expectations · {PERIODS[period]}</span>}>
          <ul className="flex flex-col gap-1">
            {cats.map((c) => {
              const v = cur.cat[c.id];
              const p = prev?.cat[c.id];
              const d = v != null && p != null ? v - p : null;
              const Icon = d == null || Math.abs(d) < 3 ? Minus : d > 0 ? TrendingUp : TrendingDown;
              return (
                <li key={c.id}>
                  <button className="grid w-full grid-cols-[minmax(0,8.5rem)_1fr_2.5rem_1.25rem] items-center gap-2.5 rounded-md px-1 py-1 text-left text-ui hover:bg-surface-hover"
                    aria-label={`${c.name} ${fmtPct(v)}. Show calls below expectation`}
                    onClick={() => open(`${c.name}: calls below expectation`, cur.calls.filter((x) => metrics.scores(x)[c.id] < 3).map((x) => ({ call: x, note: insight(c.id, metrics.scores(x)[c.id]) })))}>
                    <span className="leading-tight">{c.name} <small>({c.weight}%)</small></span>
                    <ProgressBar value={v || 0} color={v >= 84 ? 'green' : v >= 70 ? 'blue' : 'amber'} label={c.name} />
                    <b className="text-right tabular-nums">{fmtPct(v)}</b>
                    <Icon size={14} className={d == null || Math.abs(d) < 3 ? 'text-fg-subtle' : d > 0 ? 'text-success-fg' : 'text-danger-fg'} aria-label={d == null ? 'no prior period' : `${d > 0 ? 'up' : 'down'} ${Math.abs(Math.round(d))} points`} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="Goal progress" right={viewAll(`${base}/goals`, 'Open Goals & Progress')} className="md:col-span-2 xl:col-span-1">
          <ul className="flex flex-col gap-3">
            {active.length === 0 && <li className="text-ui text-fg-subtle">No active goals.</li>}
            {active.map((g) => {
              const gc = metrics.goal(g);
              const color = gc.status === 'Met' ? 'green' : gc.status === 'At Risk' ? 'red' : 'amber';
              const [Icon, cls] = DIR[gc.direction];
              return (
                <li key={g.id} className="text-ui">
                  <div className="mb-1 flex items-start justify-between gap-2"><b className="leading-tight">{g.title}</b><Badge cls={color}>{gc.status}</Badge></div>
                  <ProgressBar value={gc.pct} target={g.target} color={color} label={`${g.title} progress`} />
                  <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-xs text-fg-subtle">
                    <span>{gc.met} of {gc.applicable} applicable calls · {fmtPct(gc.baseline)} → <b className="text-fg">{fmtPct(gc.pct)}</b> (target {g.target}%)</span>
                    <span className={cx('inline-flex items-center gap-1', cls)}><Icon size={12} aria-hidden="true" />{gc.direction}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          {achieved.length > 0 && (
            <>
              <h3 className="mt-4 mb-1.5 text-ui font-semibold">Previously achieved</h3>
              <ul className="flex flex-col gap-1.5">
                {achieved.map((g) => {
                  const gc = metrics.goal(g);
                  return (
                    <li key={g.id} className="flex items-center gap-2 text-ui">
                      {gc.slipping ? <AlertTriangle size={14} className="shrink-0 text-danger-fg" aria-hidden="true" /> : <CheckCircle2 size={14} className="shrink-0 text-success-fg" aria-hidden="true" />}
                      <span className="min-w-0 flex-1">{g.title}</span>
                      <small className={gc.slipping ? 'text-danger-fg' : ''}>{gc.slipping ? `Slipping · ${fmtPct(gc.last.pct)} last 14 days` : `Holding · ${fmtPct(gc.last.pct)}`}</small>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card title="Call analysis & review activity" right={<small>{PERIODS[period]}</small>}>
        <StatGrid
          className="grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
          items={[
            ['Calls analyzed', cur.analyzed], ['AI-graded', cur.aiGraded], ['Coach reviewed', cur.coachReviewed],
            ['Overall QA', fmtPct(cur.qa), toneText(band(cur.qa))], ['Active goals', active.length], ['Sessions completed', completed],
          ]}
        />
        <p className="mt-3 text-ui text-fg-muted">
          This score is based on <b>{cur.aiGraded}</b> AI-graded interaction{cur.aiGraded === 1 ? '' : 's'}, {cur.coachReviewed} of them reviewed or validated by a coach{cur.dev ? `; ${cur.dev} developmental review${cur.dev === 1 ? ' is' : 's are'} excluded` : ''}.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <button className="link-btn" onClick={() => open('AI-graded calls', cur.calls.map((c) => ({ call: c })))}>View AI-graded calls</button>
          <button className="link-btn" onClick={() => open('Coach-reviewed calls', reviewedCalls.map((c) => ({ call: c, note: `${gradingStatus(state, c)} by ${state.reviews[c.id].reviewer}` })))}>View coach reviews</button>
          <button className="link-btn" onClick={() => open('Score breakdown', cur.calls.map((c) => ({ call: c })).sort((a, b) => metrics.total(a.call) - metrics.total(b.call)))}>View score breakdown</button>
          <Link className="link-btn" to={mine ? '/me/coaching' : '/coaching?tab=Sessions'}>View coaching history</Link>
        </div>
      </Card>

      <Card title="Recent calls & AI insights" right={viewAll(mine ? '/me/calls' : '/library', 'Call Library')} pad={false}>
        <div className="table-wrap mt-3">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Type</th><th className="num">AI score</th><th className="num">Final</th><th>Key observation</th><th>Review</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {analyzedCalls.slice(0, 8).map((c) => {
                const st = gradingStatus(state, c);
                const ai = weightedTotal(c.ai, criteria);
                const fin = metrics.total(c);
                return (
                  <tr key={c.id} aria-selected={c.id === call.id}>
                    <td className="whitespace-nowrap tabular-nums">{c.date} <small>{c.time}</small></td>
                    <td className="min-w-28">{c.intent[1]}</td>
                    <td className="num">{fmtPct(ai)}</td>
                    <td className="num"><b className={toneText(band(fin))}>{st === 'Developmental' ? '—' : fmtPct(fin)}</b></td>
                    <td className="min-w-48 text-fg-muted">{c.focus}</td>
                    <td><Badge cls={st === 'AI Graded' ? 'gray' : st === 'In Review' ? 'amber' : 'blue'}>{st === 'AI Graded' ? 'Not reviewed' : st}</Badge></td>
                    <td className="whitespace-nowrap">
                      <button className="icon-btn" aria-label={`Play call ${c.id}`} onClick={() => dispatch({ type: 'call', callId: c.id })}><Play size={14} aria-hidden="true" /></button>
                      {!mine && <button className="icon-btn" aria-label={`Open evaluation for call ${c.id}`} onClick={() => { navigate(gradingPath(c.id)); }}><ClipboardCheck size={14} aria-hidden="true" /></button>}
                      {!mine && <button className="icon-btn" aria-label={`Add call ${c.id} to a coaching session`} onClick={() => navigate(workspaceLink(agent.id, [c.id]))}><MessageSquarePlus size={14} aria-hidden="true" /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <ReviewPanel key={call.id} call={call} mine={mine} />
        <div className="card-stack">
          <Card title="Coaching history" right={viewAll(mine ? '/me/coaching' : '/coaching?tab=Sessions')}>
            <ul className="divide-y divide-border">
              {sessions.length === 0 && <li className="text-ui text-fg-subtle">No coaching sessions yet.</li>}
              {sessions.slice(0, 4).map((s) => (
                <li key={s.id} className="grid grid-cols-[5rem_1fr] gap-3 py-2.5 first:pt-0 last:pb-0">
                  <time className="text-xs text-fg-subtle tabular-nums">{s.date}</time>
                  <div className="min-w-0 text-ui"><b className="block">{s.topic}</b><span className="block text-fg-subtle">{(s.takeaways || s.notes || '').split('\n')[0]}</span><Badge cls={SESSION_CLS[s.status]} className="mt-1.5">{SESSION_LABEL[s.status]}</Badge></div>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Customer sentiment & experience">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <b className="text-3xl font-semibold tabular-nums">{rating == null ? '—' : rating.toFixed(1)}</b><span className="text-fg-subtle"> / 5</span>
                <small className="block">AI-estimated experience rating</small>
                <Delta cur={rating} prev={prevRating} unit="" />
              </div>
              <ul className="flex min-w-40 flex-1 flex-col gap-1.5">
                {[['Positive', cur.pos, 'bg-success'], ['Neutral', cur.neu, 'bg-warning'], ['Negative', cur.neg, 'bg-danger']].map(([k, v, fill]) => (
                  <li key={k} className="grid grid-cols-[1fr_2.5rem_4rem] items-center gap-2 text-xs">
                    <span className="h-2 rounded-full bg-track"><span className={cx('block h-full rounded-full', fill)} style={{ width: `${v || 0}%` }} /></span>
                    <b className="text-right tabular-nums">{fmtPct(v)}</b><span className="text-fg-subtle">{k}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-2 flex gap-1.5 text-xs text-fg-subtle"><Info size={12} className="mt-px shrink-0" aria-hidden="true" />Estimated from call audio and transcripts. Not a customer survey result.</p>
            <h3 className="mt-4 mb-1.5 text-ui font-semibold">Negative calls: situation or service?</h3>
            <div className="grid grid-cols-2 gap-2 text-ui">
              <button className="inset px-3 py-2 text-left hover:bg-surface-hover" onClick={() => open('Frustrated with the situation (call handled well)', situational.map((c) => ({ call: c })))}>
                <b className="block text-lg tabular-nums">{situational.length}</b><small>Situation-driven: QA 85%+ (bill, policy, outage)</small>
              </button>
              <button className="inset px-3 py-2 text-left hover:bg-surface-hover" onClick={() => open('Frustration linked to service quality', service.map((c) => ({ call: c })))}>
                <b className="block text-lg tabular-nums">{service.length}</b><small>Possibly service-related: QA below 75%</small>
              </button>
            </div>
            <h3 className="mt-4 mb-1.5 text-ui font-semibold">Recurring themes</h3>
            <ul className="flex flex-col gap-1 text-ui">
              {themes(neg).map(([k, v]) => <li key={k} className="flex justify-between gap-2"><span><Badge cls="red">Negative</Badge> {k}</span><b className="tabular-nums">{v}</b></li>)}
              {themes(cur.calls.filter((c) => c.sentiment === 'Positive')).slice(0, 2).map(([k, v]) => <li key={k} className="flex justify-between gap-2"><span><Badge cls="green">Positive</Badge> {k}</span><b className="tabular-nums">{v}</b></li>)}
            </ul>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <ImpactPanel cur={cur} goals={goals} open={open} />
        <Card title="Trend & risk indicators" className="min-w-0">
          <p className="mb-3 flex gap-1.5 text-xs text-fg-subtle"><HelpCircle size={12} className="mt-px shrink-0" aria-hidden="true" />Patterns worth a look. They support your judgment; they do not label performance.</p>
          <ul className="flex flex-col gap-2">
            {risks.length === 0 && <li className="text-ui text-fg-subtle">No notable changes in this period.</li>}
            {risks.slice(0, 8).map((r, i) => (
              <li key={i} className={cx('flex items-start gap-2.5 rounded-lg px-3 py-2 text-ui', r.tone === 'good' ? 'bg-success-soft' : 'bg-danger-soft')}>
                {r.tone === 'good' ? <TrendingUp size={15} className="mt-0.5 shrink-0 text-success-fg" aria-hidden="true" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger-fg" aria-hidden="true" />}
                <span className="min-w-0 flex-1">{r.text}</span>
                {r.rows ? <button className="link-btn shrink-0" onClick={() => open(r.text, r.rows)}>Calls</button> : r.to && <Link className="link-btn shrink-0" to={r.to}>Goal</Link>}
              </li>
            ))}
          </ul>
        </Card>
      </div>


      {drill && <CallsModal {...drill} mine={mine} onClose={() => setDrill(null)} />}
    </Page>
  );
}
