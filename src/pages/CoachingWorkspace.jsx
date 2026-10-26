import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Link2, X, ExternalLink, Plus, Trash2, Target, Sparkles, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, Badge, Avatar, Field, AudioPlayer, useAudio, Tabs, Page, PageHeader, ProgressBar, EmptyState, StatGrid, toneText, cx } from '../components/ui';
import { StatusChip, TranscriptList, keyMoments } from '../components/CallParts';
import GoalModal from '../components/GoalModal';
import { AGENTS, agentById, REVIEWERS } from '../data/agents';
import { callById, callsFor } from '../data/calls';
import { getConversation } from '../data/transcripts';
import { catName, goalBehavior } from '../data/rubric';
import { useApp, TODAY, SUPERVISOR } from '../state/AppContext';
import { getReview, gradingStatus, reviewId, reviewNotes, sessionCalls, biggestGap, SESSION_TYPES, SESSION_CLS, SESSION_LABEL } from '../utils/review';
import { weightedTotal, band, fmtPct, fmtTime } from '../utils/score';
import { TODAY_ISO, addDays, DATA_START, shortDate } from '../utils/dates';
import { gradingPath } from '../utils/roster';

const FILTERS = { all: 'All interactions', graded: 'Coach reviewed (graded)', ai: 'AI graded only', dev: 'Developmental (non-graded)', requested: 'Submitted by employee' };
const RANGES = { 30: 'Last 30 days', 90: 'Last 90 days', all: `All calls (since ${shortDate(DATA_START)})` };
const PAGE = 12;
const DIR_ICON = { Improving: [TrendingUp, 'text-success-fg'], Declining: [TrendingDown, 'text-danger-fg'], Steady: [Minus, 'text-fg-subtle'] };

const agentGoals = (state, agentId) => {
  const team = agentById(agentId).team;
  return state.goals.filter((g) => (g.agentId === agentId || (g.agentId === 'team' && g.team === team)) && (g.state || 'Active') !== 'Closed');
};

function newDraft(state, params) {
  const callIds = (params.get('calls') || '').split(',').filter((id) => callById(id));
  const agentId = params.get('agent') || (callIds[0] && callById(callIds[0]).agentId) || state.agentId;
  const requested = callIds.some((id) => state.dev[id]?.requested);
  const type = params.get('type') || (requested ? 'developmental' : callIds.length ? 'performance' : 'general');
  const first = callIds[0] && callById(callIds[0]);
  const gap = first && biggestGap(getReview(state, first).coach, state.rubric.criteria.filter((c) => c.on));
  return {
    id: `s${Date.now()}`, agentId, type, date: TODAY, reviewer: SUPERVISOR, reason: requested ? state.dev[callIds.find((id) => state.dev[id]?.requested)].note : '',
    requested, cat: gap ? gap.id : null, callIds, highlights: '', opps: '', takeaways: '', actionItems: [], goalIds: [], status: 'Draft',
  };
}

function Snapshot({ agentId, locked, onAgent }) {
  const { state, metrics } = useApp();
  const a = agentById(agentId);
  const r = metrics.range(agentId, addDays(TODAY_ISO, -29));
  const goals = agentGoals(state, agentId).filter((g) => (g.state || 'Active') === 'Active');
  const comp = goals.length ? goals.reduce((s, g) => s + metrics.goal(g).pct, 0) / goals.length : null;
  const sessions = state.sessions.filter((s) => s.agentId === agentId && s.status !== 'Draft').length;
  const kpis = [
    ['QA score · 30d', fmtPct(r.qa), toneText(band(r.qa))],
    ['Calls analyzed', r.analyzed, ''],
    ['Coach reviewed', r.coachReviewed, ''],
    ['Active goals', goals.length, ''],
    ['Goal compliance', fmtPct(comp), ''],
    ['Coaching sessions', sessions, ''],
  ];
  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={a.name} size={44} />
          <div className="min-w-0">
            {locked ? <h2 className="text-lg font-semibold tracking-tight">{a.name}</h2> : (
              <label className="sr-only" htmlFor="ws-agent">Employee</label>
            )}
            {!locked && (
              <select id="ws-agent" className="h-9 text-sm font-semibold" value={agentId} onChange={(e) => onAgent(e.target.value)}>
                {AGENTS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            )}
            <p className="text-ui text-fg-subtle">{a.team} · Lead: {a.lead} · {a.tenure}</p>
          </div>
        </div>
        <StatGrid items={kpis} className="flex-1 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6" />
      </div>
    </Card>
  );
}

function CallFinder({ agentId, linked, onLink }) {
  const { state, metrics } = useApp();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [range, setRange] = useState('30');
  const [sel, setSel] = useState([]);
  const [shown, setShown] = useState(PAGE);
  const rows = useMemo(() => {
    const from = range === 'all' ? DATA_START : addDays(TODAY_ISO, -(Number(range) - 1));
    const needle = q.trim().toLowerCase();
    return callsFor(agentId).filter((c) => {
      if (c.iso < from) return false;
      const st = gradingStatus(state, c);
      const r = state.reviews[c.id];
      if (filter === 'graded' && !(r && r.status === 'saved')) return false;
      if (filter === 'ai' && st !== 'AI Graded') return false;
      if (filter === 'dev' && st !== 'Developmental') return false;
      if (filter === 'requested' && !state.dev[c.id]?.requested) return false;
      if (!needle) return true;
      const hay = `${c.id} ${reviewId(state, c)} ${c.date} ${c.intent.join(' ')} ${c.focus} ${(r?.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [agentId, state, q, filter, range]);
  const toggle = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const reset = (fn) => (e) => { fn(e.target.value); setShown(PAGE); };
  return (
    <Card title="Find & link previously reviewed calls" right={<button className="btn btn-primary btn-sm" disabled={!sel.length} onClick={() => { onLink(sel); setSel([]); }}><Link2 size={13} aria-hidden="true" /> Link {sel.length || ''} selected</button>}>
      <div className="mb-3 flex flex-col gap-2 lg:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <span className="sr-only">Search calls</span>
          <input type="search" className="pl-8" placeholder={`Review ID, call ID, date (${addDays(TODAY_ISO, -1).slice(5, 7)}/${addDays(TODAY_ISO, -1).slice(8, 10)}/${TODAY_ISO.slice(0, 4)}), topic or tag…`} value={q} onChange={reset(setQ)} />
        </label>
        <select className="lg:w-56" value={filter} onChange={reset(setFilter)} aria-label="Review type">{Object.entries(FILTERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="lg:w-40" value={range} onChange={reset(setRange)} aria-label="Date range">{Object.entries(RANGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <div className="table-wrap -mx-4 sm:-mx-5">
        <table className="tbl">
          <thead><tr><th><span className="sr-only">Select</span></th><th>Review ID</th><th>Date</th><th>Review type</th><th className="num">Score</th><th>Focus area</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6}><EmptyState>No interactions match.</EmptyState></td></tr>}
            {rows.slice(0, shown).map((c) => {
              const st = gradingStatus(state, c);
              const isLinked = linked.includes(c.id);
              const pct = metrics.total(c);
              return (
                <tr key={c.id} className={isLinked ? '[&>td]:bg-primary-soft' : ''}>
                  <td className="w-10"><input type="checkbox" disabled={isLinked} checked={isLinked || sel.includes(c.id)} onChange={() => toggle(c.id)} aria-label={`Select call ${c.id}`} /></td>
                  <td className="whitespace-nowrap tabular-nums">{reviewId(state, c)}{state.dev[c.id]?.requested && <Badge cls="amber" className="ml-1.5">Employee request</Badge>}</td>
                  <td className="whitespace-nowrap tabular-nums">{c.date}</td>
                  <td><StatusChip status={st} /></td>
                  <td className="num">{st === 'Developmental' ? <span className="text-fg-subtle">Non-graded</span> : <b className={toneText(band(pct))}>{fmtPct(pct)}</b>}</td>
                  <td className="min-w-48 text-fg-muted">{c.focus}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-ui text-fg-subtle">
        <span aria-live="polite">{rows.length} interactions</span>
        {shown < rows.length && <button className="btn btn-secondary btn-sm" onClick={() => setShown(shown + PAGE)}>Show more</button>}
      </div>
    </Card>
  );
}

function LinkedCall({ call }) {
  const { state, criteria } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('Evaluation');
  const audio = useAudio(call.durSec);
  const conv = getConversation(call);
  const rev = getReview(state, call);
  const st = gradingStatus(state, call);
  const notes = reviewNotes(rev, criteria);
  const moments = [...(rev.method === 'manual' ? [] : keyMoments(conv, call, criteria)), ...rev.moments].sort((a, b) => a.t - b.t);
  const jump = (t) => { audio.seek(t); if (!audio.playing) audio.toggle(); };
  const final = weightedTotal(rev.status === 'saved' ? rev.coach : call.ai, criteria);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ui">
        <b className="tabular-nums">{reviewId(state, call)}</b><span className="text-fg-subtle">{call.date} {call.time} · {call.intent[1]} · {call.duration}</span>
        <StatusChip status={st} />
        <button className="link-btn ml-auto" onClick={() => { navigate(gradingPath(call.id)); }}><ExternalLink size={12} aria-hidden="true" /> Open full evaluation</button>
      </div>
      <AudioPlayer audio={audio} duration={call.durSec} seed={Number(call.id)} />
      <Tabs tabs={['Evaluation', 'Key moments', 'Transcript']} value={tab} onChange={setTab} label={`Call ${call.id}`} />
      {tab === 'Transcript' && <TranscriptList lines={conv.lines} audio={audio} onJump={jump} tall />}
      {tab === 'Key moments' && (
        <ul className="flex flex-col gap-0.5">
          {moments.map((m, i) => (
            <li key={i}><button className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-ui hover:bg-surface-hover" onClick={() => jump(m.t)}>
              <time className="w-9 shrink-0 text-xs text-fg-subtle tabular-nums">{fmtTime(m.t)}</time>
              <Badge cls={m.type === 'good' ? 'green' : m.type === 'opp' ? 'red' : 'gray'}>{m.type === 'good' ? 'Highlight' : m.type === 'opp' ? 'Opportunity' : 'Context'}</Badge>
              <span className="min-w-0">{m.label}</span>
            </button></li>
          ))}
        </ul>
      )}
      {tab === 'Evaluation' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-fg-subtle">
            {st === 'Developmental' ? 'Developmental review: not graded and excluded from the QA average.' : rev.status === 'saved' ? `${st} by ${rev.reviewer} on ${rev.reviewed}.` : rev.status === 'draft' ? 'Coach evaluation in progress (draft). Showing AI scores.' : 'AI graded. Not reviewed by a coach yet.'}
            {' '}The original evaluation is preserved; linking it here does not change it.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {criteria.map((c) => {
              const s = (rev.status === 'saved' ? rev.coach : call.ai)[c.id];
              return <Badge key={c.id} cls={s === 3 ? 'green' : s === 2 ? 'amber' : s === 1 ? 'red' : 'gray'}>{c.name} {s ?? '—'}</Badge>;
            })}
            {st !== 'Developmental' && <b className={cx('ml-auto text-lg tabular-nums', toneText(band(final)))}>{fmtPct(final)}</b>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-success-border bg-success-soft px-3 py-2">
              <h4 className="mb-1 text-ui font-semibold text-success-fg">Highlights</h4>
              <ul className="list-disc pl-4 text-ui">{notes.highlights.length ? notes.highlights.map((h, i) => <li key={i}>{h}</li>) : <li className="list-none -ml-4 text-fg-subtle">None recorded.</li>}</ul>
            </div>
            <div className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2">
              <h4 className="mb-1 text-ui font-semibold text-danger-fg">Areas of opportunity</h4>
              <ul className="list-disc pl-4 text-ui">{notes.opps.length ? notes.opps.map((o, i) => <li key={i}>{catName(o.cat, criteria)}: {o.text}</li>) : <li className="list-none -ml-4 text-fg-subtle">None recorded.</li>}</ul>
            </div>
          </div>
          {rev.notes && <p className="inset px-3 py-2 text-ui"><b>Reviewer notes:</b> {rev.notes}</p>}
          {state.dev[call.id]?.note && <p className="rounded-lg bg-warning-soft px-3 py-2 text-ui text-warning-fg"><b>Employee's question:</b> {state.dev[call.id].note}</p>}
          {rev.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{rev.tags.map((t) => <Badge key={t} cls="blue">{t}</Badge>)}</div>}
        </div>
      )}
    </div>
  );
}

function GoalRow({ g, linked, onToggle, onEdit }) {
  const { metrics } = useApp();
  const gc = metrics.goal(g);
  const [Icon, cls] = DIR_ICON[gc.direction];
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <b className="block text-ui">{g.title}</b>
          <small className="block">{goalBehavior(g)?.label} · {g.agentId === 'team' ? 'Team goal' : 'Individual'} · Due {g.due}</small>
        </div>
        <Badge cls={(g.state || 'Active') === 'Achieved' ? 'green' : gc.status === 'Met' ? 'green' : gc.status === 'At Risk' ? 'red' : 'blue'}>{(g.state || 'Active') === 'Achieved' ? 'Achieved' : gc.status}</Badge>
      </div>
      <StatGrid
        className="mt-3 mb-3 grid-cols-2 sm:grid-cols-4"
        items={[
          ['Baseline', fmtPct(gc.baseline)],
          ['Current', fmtPct(gc.pct), '', `${gc.met}/${gc.applicable} calls`],
          ['Target', `${g.target}%`],
          ['Change', gc.improvement == null ? '—' : `${gc.improvement >= 0 ? '+' : ''}${Math.round(gc.improvement)} pts`, gc.improvement >= 0 ? 'text-success-fg' : 'text-danger-fg'],
        ]}
      />
      <ProgressBar value={gc.pct} target={g.target} label={`${g.title} progress`} height={6} />
      <div className="mt-2 flex flex-wrap items-center gap-3 text-ui">
        <span className={cx('inline-flex items-center gap-1 text-xs', cls)}><Icon size={13} aria-hidden="true" /> {gc.direction} (last 14 days)</span>
        <label className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium"><input type="checkbox" checked={linked} onChange={onToggle} /> Discussed in this session</label>
        <button className="link-btn" onClick={onEdit}>Review / update</button>
      </div>
    </li>
  );
}

export default function CoachingWorkspace() {
  const { state, dispatch, notify, criteria } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const existing = params.get('id') && state.sessions.find((s) => s.id === params.get('id'));
  const [d, setD] = useState(() => (existing
    ? { highlights: '', opps: '', takeaways: '', reason: '', requested: false, goalIds: [], reviewer: SUPERVISOR, type: existing.cat ? 'performance' : 'general', ...existing, callIds: sessionCalls(existing) }
    : newDraft(state, params)));
  const [active, setActive] = useState(d.callIds[0] || null);
  const [goalModal, setGoalModal] = useState(null); // { goal } | { create: true }
  const [item, setItem] = useState('');
  const set = (patch) => setD((x) => ({ ...x, ...patch }));
  const goals = agentGoals(state, d.agentId);
  const activeCall = active && d.callIds.includes(active) ? callById(active) : d.callIds[0] && callById(d.callIds[0]);

  const link = (ids) => {
    const callIds = [...d.callIds, ...ids.filter((id) => !d.callIds.includes(id))];
    const requested = d.requested || ids.some((id) => state.dev[id]?.requested);
    set({ callIds, requested });
    setActive(ids[0]);
    notify(`${ids.length} call${ids.length > 1 ? 's' : ''} linked`);
  };
  const unlink = (id) => set({ callIds: d.callIds.filter((x) => x !== id) });

  const fillFromCalls = () => {
    const hs = [], os = [];
    for (const id of d.callIds) {
      const c = callById(id);
      const n = reviewNotes(getReview(state, c), criteria);
      n.highlights.forEach((h) => hs.push(`• ${h} (${reviewId(state, c)})`));
      n.opps.forEach((o) => os.push(`• ${catName(o.cat, criteria)}: ${o.text} (${reviewId(state, c)})`));
    }
    const join = (cur, add) => [cur.trim(), ...new Set(add)].filter(Boolean).join('\n');
    set({ highlights: join(d.highlights, hs.slice(0, 6)), opps: join(d.opps, os.slice(0, 6)) });
    notify('Observations from the linked calls added. Edit them to reflect your conversation.');
  };

  const save = (complete) => {
    if (complete) {
      if (d.type !== 'general' && !d.callIds.length) { notify('Link at least one call for this session type', 'warn'); return; }
      if (d.reason.trim().length < 3) { notify('Add the reason for coaching', 'warn'); return; }
    }
    const topic = d.cat ? catName(d.cat, criteria) : d.reason.trim() ? d.reason.trim().split(/[.\n]/)[0].slice(0, 60) : SESSION_TYPES[d.type].label;
    const status = complete ? (d.status === 'Draft' ? 'Delivered' : d.status) : 'Draft';
    const session = {
      ...d, topic, status, callId: d.callIds[0] || null,
      notes: d.takeaways || d.notes || '',
    };
    dispatch({ type: 'saveSession', session });
    // Developmental sessions keep their calls out of the QA average
    const mine = d.callIds;
    if (d.type === 'developmental') dispatch({ type: 'markDev', callIds: mine, sessionId: d.id });
    const released = Object.entries(state.dev).filter(([id, x]) => x.sessionId === d.id && (d.type !== 'developmental' || !mine.includes(id))).map(([id]) => id);
    if (released.length) dispatch({ type: 'unmarkDev', callIds: released });
    if (complete) {
      notify(`Coaching session completed and sent to ${agentById(d.agentId).name} to acknowledge`);
      navigate('/coaching?tab=Sessions');
    } else {
      set({ status: 'Draft' });
      notify('Coaching session saved as draft');
    }
  };

  return (
    <Page>
      <PageHeader
        title="Coaching Workspace"
        description="Recall calls, review them together, document the conversation and set measurable goals."
        actions={<>
          {existing && <Badge cls={SESSION_CLS[d.status]}>{SESSION_LABEL[d.status]}</Badge>}
          <button className="btn btn-ghost" onClick={() => navigate('/coaching?tab=Sessions')}>Cancel</button>
          <button className="btn btn-secondary" onClick={() => save(false)}>Save draft</button>
          <button className="btn btn-inverse" onClick={() => save(true)}>{d.status === 'Draft' ? 'Complete session' : 'Save changes'}</button>
        </>}
      />

      <Snapshot agentId={d.agentId} locked={!!existing || d.callIds.length > 0} onAgent={(agentId) => set({ agentId, callIds: [], goalIds: [] })} />

      <section aria-labelledby="ws-type">
        <h2 id="ws-type" className="mb-2 text-sm font-semibold">Session type</h2>
        <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-labelledby="ws-type">
          {Object.entries(SESSION_TYPES).map(([k, t]) => (
            <label key={k} className={cx('card flex cursor-pointer gap-3 p-4 transition-colors', d.type === k ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary-border')}>
              <input type="radio" name="session-type" className="mt-1" checked={d.type === k} onChange={() => set({ type: k })} />
              <span><b className="block text-sm">{t.label}</b><span className="text-ui text-fg-muted">{t.desc}</span></span>
            </label>
          ))}
        </div>
      </section>

      <Card title="Session details">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Session date"><input value={d.date} onChange={(e) => set({ date: e.target.value })} /></Field>
          <Field label="Coach / reviewer"><select value={d.reviewer} onChange={(e) => set({ reviewer: e.target.value })}>{REVIEWERS.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Focus category (optional)">
            <select value={d.cat || ''} onChange={(e) => set({ cat: e.target.value || null })}>
              <option value="">None / general</option>{criteria.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-ui font-medium">
            <input type="checkbox" checked={d.requested} onChange={(e) => set({ requested: e.target.checked })} /> Employee requested this review
          </label>
        </div>
        <Field label="Reason for coaching" className="mt-4">
          <textarea rows={2} value={d.reason} placeholder="The performance topic, or the employee's concern in their own words." onChange={(e) => set({ reason: e.target.value })} />
        </Field>
      </Card>

      {d.type !== 'general' || d.callIds.length > 0 ? (
        <>
          <CallFinder agentId={d.agentId} linked={d.callIds} onLink={link} />
          <Card title={`Linked calls (${d.callIds.length})`}>
            {d.callIds.length === 0 ? <EmptyState icon={Link2}>Select calls above and link them to this session.</EmptyState> : (
              <div className="grid items-start gap-4 lg:grid-cols-[14rem_1fr]">
                <ul className="flex min-w-0 flex-row flex-wrap gap-2 lg:flex-col" aria-label="Linked calls">
                  {d.callIds.map((id) => {
                    const c = callById(id);
                    const on = activeCall && activeCall.id === id;
                    return (
                      <li key={id} className={cx('flex items-center gap-1 rounded-lg border', on ? 'border-primary bg-primary-soft' : 'border-border')}>
                        <button className="min-w-0 flex-1 px-3 py-2 text-left text-ui" aria-pressed={on} onClick={() => setActive(id)}>
                          <b className="block tabular-nums">{reviewId(state, c)}</b><small>{c.date} · {c.intent[1]}</small>
                        </button>
                        <button className="icon-btn mr-1 shrink-0" aria-label={`Unlink call ${id}`} onClick={() => unlink(id)}><X size={14} aria-hidden="true" /></button>
                      </li>
                    );
                  })}
                </ul>
                {activeCall && <LinkedCall key={activeCall.id} call={activeCall} />}
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card><p className="text-ui text-fg-subtle">General coaching does not need a call. <button className="link-btn" onClick={() => set({ type: 'performance' })}>Link calls anyway</button></p></Card>
      )}

      <Card
        title="Coaching discussion notes"
        right={d.callIds.length > 0 && <button className="link-btn" onClick={fillFromCalls}><Sparkles size={13} aria-hidden="true" /> Use observations from linked calls</button>}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Highlights: what did the employee do well?"><textarea rows={6} value={d.highlights} onChange={(e) => set({ highlights: e.target.value })} /></Field>
          <Field label="Areas of opportunity: what could improve?"><textarea rows={6} value={d.opps} onChange={(e) => set({ opps: e.target.value })} /></Field>
          <Field label="Key takeaways / next steps: what did you agree on?"><textarea rows={6} value={d.takeaways} onChange={(e) => set({ takeaways: e.target.value })} /></Field>
        </div>
        {existing?.notes && !existing.takeaways && <p className="mt-3 inset px-3 py-2 text-ui"><b>Earlier notes:</b> {existing.notes}</p>}
        <div className="mt-4">
          <span className="field-label">Action items</span>
          <ul className="my-2 flex flex-col gap-1.5">
            {d.actionItems.map((x, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted py-1 pr-1 pl-3 text-ui">{x.text}<button className="icon-btn" aria-label={`Remove action item: ${x.text}`} onClick={() => set({ actionItems: d.actionItems.filter((_, j) => j !== i) })}><Trash2 size={14} aria-hidden="true" /></button></li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input aria-label="New action item" placeholder="Add an action item" value={item} onChange={(e) => setItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && item.trim()) { set({ actionItems: [...d.actionItems, { text: item.trim(), done: false }] }); setItem(''); } }} />
            <button type="button" className="btn btn-secondary" onClick={() => { if (item.trim()) { set({ actionItems: [...d.actionItems, { text: item.trim(), done: false }] }); setItem(''); } }}><Plus size={14} aria-hidden="true" /> Add</button>
          </div>
        </div>
      </Card>

      <Card title={<><Target size={14} aria-hidden="true" /> Active goals</>} right={<button className="btn btn-primary btn-sm" onClick={() => setGoalModal({ create: true })}><Plus size={13} aria-hidden="true" /> Create goal</button>}>
        <p className="mb-3 text-xs text-fg-subtle">Goals target an observable behavior. AI checks every applicable call after the goal is set, so progress is measured without reviewing each call by hand.</p>
        {goals.length === 0 ? <EmptyState icon={Target}>No active goals yet.</EmptyState> : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {goals.map((g) => (
              <GoalRow key={g.id} g={g} linked={d.goalIds.includes(g.id)} onEdit={() => setGoalModal({ goal: g })}
                onToggle={() => set({ goalIds: d.goalIds.includes(g.id) ? d.goalIds.filter((x) => x !== g.id) : [...d.goalIds, g.id] })} />
            ))}
          </ul>
        )}
        <button className="link-btn mt-3" onClick={() => navigate('/goals')}>Open Goals & Progress <ArrowRight size={12} aria-hidden="true" /></button>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn btn-secondary" onClick={() => save(false)}>Save draft</button>
        <button className="btn btn-inverse" onClick={() => save(true)}>{d.status === 'Draft' ? 'Complete session' : 'Save changes'}</button>
      </div>

      {goalModal && (
        <GoalModal
          goal={goalModal.goal} sessionId={goalModal.create ? d.id : undefined}
          defaults={{ agentId: d.agentId, behavior: undefined, cat: d.cat || 'opening', title: '' }}
          onCreated={(g) => set({ goalIds: [...d.goalIds, g.id] })}
          onClose={() => setGoalModal(null)}
        />
      )}
    </Page>
  );
}

