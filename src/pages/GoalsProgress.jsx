import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Target, ExternalLink, TrendingUp, TrendingDown, Minus, AlertTriangle, PenSquare } from 'lucide-react';
import { Card, Badge, ProgressBar, Tabs, LineChart, Kpi, Page, PageHeader, EmptyState, StatGrid, cx } from '../components/ui';
import GoalModal from '../components/GoalModal';
import { agentById } from '../data/agents';
import { goalBehavior } from '../data/rubric';
import { useApp, useViewAgent } from '../state/AppContext';
import { fmtPct } from '../utils/score';
import { gradingPath } from '../utils/roster';

const statusCls = { Met: 'green', 'In Progress': 'blue', 'At Risk': 'red' };
const ownerName = (g) => (g.agentId === 'team' ? `Team goal · ${g.team}` : agentById(g.agentId).name);
const ST_LABEL = { met: 'Met', miss: 'Not met', na: 'N/A' };
const ST_CLS = { met: 'green', miss: 'red', na: 'gray' };
const DIR = { Improving: [TrendingUp, 'text-success-fg'], Declining: [TrendingDown, 'text-danger-fg'], Steady: [Minus, 'text-fg-subtle'] };
const lifecycle = (g) => g.state || 'Active';
const pts = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${Math.round(v)} pts`);

function StatusBadge({ g, gc }) {
  if (lifecycle(g) === 'Achieved') return <Badge cls={gc.slipping ? 'red' : 'green'}>{gc.slipping ? 'Achieved · slipping' : 'Achieved'}</Badge>;
  if (lifecycle(g) === 'Closed') return <Badge cls="gray">Closed</Badge>;
  return <Badge cls={statusCls[gc.status]}>{gc.status}</Badge>;
}

function GoalDetail({ goal, mine, onEdit }) {
  const { dispatch, metrics, notify } = useApp();
  const navigate = useNavigate();
  const gc = metrics.goal(goal);
  const [Icon, cls] = DIR[gc.direction];
  return (
    <Card title="Goal detail" right={<StatusBadge g={goal} gc={gc} />} className="detail-panel">
      <h3 className="text-base font-semibold">{goal.title}</h3>
      <p className="mt-1 text-ui text-fg-subtle">{ownerName(goal)} · Assigned {goal.assigned} · Due {goal.due}</p>
      <p className="mt-2 rounded-lg bg-primary-soft px-3 py-2 text-ui text-primary-soft-fg"><b>Behavior AI checks for:</b> {goalBehavior(goal)?.label}</p>
      {gc.slipping && (
        <p className="mt-3 flex gap-2 rounded-lg bg-danger-soft px-3 py-2 text-ui text-danger-fg" role="alert">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          This goal was achieved, but the behavior dropped to {fmtPct(gc.last.pct)} over the last 14 days ({gc.last.n} calls). Consider a follow-up conversation.
        </p>
      )}
      <StatGrid
        className="mt-4 grid-cols-2 sm:grid-cols-4"
        items={[['Baseline', fmtPct(gc.baseline)], ['Current', fmtPct(gc.pct)], ['Target', `${goal.target}%`], ['Change', pts(gc.improvement), gc.improvement >= 0 ? 'text-success-fg' : 'text-danger-fg']]}
      />
      <div className="mt-3 mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <small>{gc.met} of {gc.applicable} applicable calls{gc.na ? ` · ${gc.na} not applicable` : ''}</small>
        <span className={cx('inline-flex items-center gap-1 text-xs font-medium', cls)}><Icon size={13} aria-hidden="true" /> {gc.direction}: {fmtPct(gc.prior.pct)} → {fmtPct(gc.last.pct)} (last 2 weeks)</span>
      </div>
      <ProgressBar value={gc.pct} target={goal.target} height={10} label="Goal progress" />
      <p className="mt-3 text-ui text-fg-muted">
        Baseline is compliance in the 30 days before the goal was set. {gc.improvement != null && gc.pct < goal.target && gc.improvement > 0 && `Not at target yet, but up ${Math.round(gc.improvement)} points since coaching.`}
      </p>
      {goal.note && <p className="mt-2 text-ui text-fg-subtle">{goal.note}</p>}
      {!mine && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-secondary btn-sm" onClick={onEdit}><PenSquare size={13} aria-hidden="true" /> Update goal</button>
          {lifecycle(goal) === 'Active' && gc.status === 'Met' && (
            <button className="btn btn-primary btn-sm" onClick={() => { dispatch({ type: 'updateGoal', id: goal.id, patch: { state: 'Achieved' }, change: `Marked achieved at ${fmtPct(gc.pct)}` }); notify('Goal marked achieved. AI keeps monitoring for regression.'); }}>Mark achieved</button>
          )}
        </div>
      )}
      {gc.weekly.length > 1 ? (
        <>
          <h4 className="mt-5 mb-2 text-ui font-semibold">Weekly compliance</h4>
          <LineChart data={gc.weekly} height={150} width={520} ticks={[0, 50, 100]} />
        </>
      ) : <p className="mt-4 text-xs text-fg-subtle">Weekly trend appears once there is more than a week of calls.</p>}
      {gc.recent.length > 0 && (
        <>
          <h4 className="mt-5 mb-1 text-ui font-semibold">Most recent calls</h4>
          <ul className="divide-y divide-border">
            {gc.recent.map(({ call: c, st }) => (
              <li key={c.id} className="flex items-center gap-3 py-2 text-ui">
                <Badge cls={ST_CLS[st]} className="w-16 justify-center">{ST_LABEL[st]}</Badge>
                <span className="min-w-0 flex-1 truncate tabular-nums">{c.date} · {c.id} · {agentById(c.agentId).name.split(' ')[0]}</span>
                <button className="link-btn" onClick={() => { dispatch({ type: 'call', callId: c.id }); navigate(mine ? '/me' : gradingPath(c.id)); }} aria-label={`Open call ${c.id}`}>Open <ExternalLink size={11} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        </>
      )}
      {(goal.history || []).length > 0 && (
        <>
          <h4 className="mt-5 mb-1 text-ui font-semibold">Goal history</h4>
          <ol className="flex flex-col gap-1.5 text-ui">
            {[...goal.history].reverse().map((h, i) => <li key={i} className="border-l-2 border-border pl-3">{h.change}<small className="block">{h.at} · {h.by}</small></li>)}
          </ol>
        </>
      )}
    </Card>
  );
}

export default function GoalsProgress({ mine }) {
  const { state, metrics } = useApp();
  const agentId = useViewAgent(mine);
  const agent = agentById(agentId);
  const [scope, setScope] = useState(mine ? 'My goals' : 'Selected agent');
  const [show, setShow] = useState('Active');
  const [sel, setSel] = useState(null);
  const [modal, setModal] = useState(null); // { goal } | {}
  const mineOrTeam = (g) => g.agentId === agentId || (g.agentId === 'team' && g.team === agent.team);
  const inScope = state.goals.filter((g) => (scope === 'All goals' ? true : scope === 'Team goals' ? g.agentId === 'team' : mineOrTeam(g)));
  const goals = inScope.filter((g) => (show === 'All' ? true : show === 'Active' ? lifecycle(g) === 'Active' : lifecycle(g) !== 'Active'));
  const cur = goals.find((g) => g.id === sel) || goals[0];
  const active = inScope.filter((g) => lifecycle(g) === 'Active');
  const statuses = active.map((g) => metrics.goal(g).status);
  const count = (s) => statuses.filter((x) => x === s).length;
  const slipping = inScope.filter((g) => metrics.goal(g).slipping).length;
  const tabs = mine ? ['My goals'] : ['Selected agent', 'Team goals', 'All goals'];
  return (
    <Page>
      <PageHeader
        title={mine ? 'My Goals' : 'Goals & Progress'}
        description="Goals target observable behaviors. AI measures every applicable call since the goal was set and compares it with the baseline."
        actions={!mine && <button className="btn btn-inverse" onClick={() => setModal({})}><Plus size={14} aria-hidden="true" /> Create goal</button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Active goals" value={active.length} />
        <Kpi label="Met target" value={count('Met')} valueClass="text-success-fg" />
        <Kpi label="In progress" value={count('In Progress')} valueClass="text-link" />
        <Kpi label="At risk" value={count('At Risk')} valueClass="text-danger-fg" />
        <Kpi label="Achieved, slipping" value={slipping} valueClass={slipping ? 'text-danger-fg' : ''} hint="previously achieved" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {tabs.length > 1 ? <Tabs tabs={tabs} value={scope} onChange={(s) => { setScope(s); setSel(null); }} label="Goal scope" /> : <span />}
        <select className="sm:w-48" value={show} onChange={(e) => { setShow(e.target.value); setSel(null); }} aria-label="Goal status filter">
          <option value="Active">Active goals</option><option value="Done">Achieved & closed</option><option value="All">All goals</option>
        </select>
      </div>
      {!mine && scope === 'Selected agent' && <p className="-mt-2 text-ui text-fg-subtle">{agent.name} and the {agent.team} team. Change agent with the search box.</p>}
      <div className="grid items-start gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="flex min-w-0 flex-col gap-3">
          {goals.length === 0 && <Card><EmptyState icon={Target}>No goals in this view.</EmptyState></Card>}
          {goals.map((g) => {
            const gc = metrics.goal(g);
            const on = cur && cur.id === g.id;
            return (
              <button
                key={g.id} aria-pressed={on} onClick={() => setSel(g.id)}
                className={cx(
                  'card grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 p-4 text-left transition-colors sm:gap-4',
                  on ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary-border',
                )}
              >
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary-soft-fg"><Target size={15} aria-hidden="true" /></span>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <b className="text-sm">{g.title}</b>
                  <small className="block">{ownerName(g)} · {goalBehavior(g)?.label} · Due {g.due}</small>
                  <ProgressBar value={gc.pct} target={g.target} label={`${g.title} progress`} />
                  <small className="block">Baseline {fmtPct(gc.baseline)} → {fmtPct(gc.pct)} · <span className={gc.improvement >= 0 ? 'text-success-fg' : 'text-danger-fg'}>{pts(gc.improvement)}</span></small>
                </div>
                <div className="flex w-24 flex-col items-end gap-1.5 sm:w-28"><b className="text-xl font-semibold tabular-nums">{fmtPct(gc.pct)}</b><StatusBadge g={g} gc={gc} /></div>
              </button>
            );
          })}
        </div>
        {cur && <GoalDetail key={cur.id} goal={cur} mine={mine} onEdit={() => setModal({ goal: cur })} />}
      </div>
      {modal && <GoalModal goal={modal.goal} defaults={{ agentId }} onClose={() => setModal(null)} />}
    </Page>
  );
}
