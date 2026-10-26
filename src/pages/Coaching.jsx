import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, ExternalLink, Send, CheckCircle2, Target, MessageSquareWarning, CalendarClock, Inbox, PenSquare } from 'lucide-react';
import { Card, Badge, Tabs, Avatar, EmptyState, Page, PageHeader, rowLink } from '../components/ui';
import { workspaceLink } from '../components/CallList';
import GoalModal from '../components/GoalModal';
import { AGENTS, agentById, TEAMS } from '../data/agents';
import { CAT_IDS, catName } from '../data/rubric';
import { callById, callsFor } from '../data/calls';
import { useApp, ME } from '../state/AppContext';
import { SESSION_CLS, SESSION_LABEL, SESSION_TYPES, sessionCalls, reviewId } from '../utils/review';
import { fmtPct } from '../utils/score';
import { LAST7 } from '../utils/metrics';
import { gradingPath } from '../utils/roster';

function Opportunities({ onStart }) {
  const { state, metrics, criteria } = useApp();
  const navigate = useNavigate();
  const [team, setTeam] = useState('All');
  const ids = criteria.map((c) => c.id).filter((id) => CAT_IDS.includes(id));
  const rows = AGENTS.filter((a) => team === 'All' || a.team === team)
    .map((a) => {
      const s = metrics.stats(a.id);
      const worst = callsFor(a.id).filter((c) => c.iso >= LAST7).sort((x, y) => metrics.total(x) - metrics.total(y))[0];
      const gaps = ids.slice().sort((x, y) => s.cat[x] - s.cat[y]).slice(0, 2);
      const open = state.sessions.find((x) => x.agentId === a.id && (x.status === 'Scheduled' || x.status === 'Delivered'));
      return { a, s, worst, gaps, open };
    })
    .sort((x, y) => x.s.qa - y.s.qa);
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-ui text-fg-subtle">Agents ranked by QA score (May). Gaps are the categories with the lowest share of calls meeting expectations.</p>
        <select className="sm:w-48" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team filter">
          <option value="All">All teams</option>{TEAMS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4">
        {rows.map(({ a, s, worst, gaps, open }) => (
          <Card key={a.id} bodyClassName="flex h-full flex-col">
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={a.name} size={38} />
              <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{a.name}</h2><small className="block">{a.team} · {a.tenure}</small></div>
              <Badge cls={s.qa >= 88 ? 'green' : s.qa >= 80 ? 'blue' : 'red'} className="px-2.5 text-xs font-semibold tabular-nums" title="QA score (May)">{fmtPct(s.qa)}</Badge>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {gaps.map((g) => <Badge key={g} cls="amber">{criteria.find((c) => c.id === g).name} {fmtPct(s.cat[g])}</Badge>)}
            </div>
            {worst && (
              <div className="mb-4 text-ui"><small className="block">Lowest-scoring call, last 7 days</small>
                <button className="link-btn text-left" onClick={() => { navigate(gradingPath(worst.id)); }}>
                  {worst.id} · {fmtPct(metrics.total(worst))} · {worst.focus.split(' — ')[0]} <ExternalLink size={12} className="shrink-0" aria-hidden="true" />
                </button>
              </div>
            )}
            <div className="mt-auto">
              {open
                ? <p className="flex flex-wrap items-center gap-2 text-ui text-fg-subtle"><Badge cls={SESSION_CLS[open.status]}>{SESSION_LABEL[open.status]}</Badge> {open.topic} · {open.date}</p>
                : <button className="btn btn-inverse btn-sm" onClick={() => onStart(a.id, worst?.id)}><Plus size={13} aria-hidden="true" /> Start coaching</button>}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function SessionActions({ s, mine, onFollowUp }) {
  const { dispatch, notify } = useApp();
  const [comment, setComment] = useState('');
  const [disputing, setDisputing] = useState(false);
  if (mine) {
    if (s.status === 'Scheduled') return <p className="flex items-center gap-2 text-ui text-fg-subtle"><CalendarClock size={14} aria-hidden="true" /> Session scheduled with your lead for {s.date}.</p>;
    if (s.status === 'Delivered') {
      return disputing ? (
        <div className="flex flex-col gap-2">
          <label className="field"><span className="field-label">What do you disagree with?</span>
            <textarea rows={3} autoFocus placeholder="At least 5 characters" value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" onClick={() => setDisputing(false)}>Cancel</button>
            <button className="btn btn-danger btn-sm" disabled={comment.trim().length < 5} onClick={() => {
              dispatch({ type: 'updateSession', id: s.id, patch: { status: 'Disputed', agentComment: comment.trim() } });
              notify('Dispute sent to your supervisor');
            }}>Send dispute</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => { dispatch({ type: 'updateSession', id: s.id, patch: { status: 'Acknowledged' } }); notify('Coaching acknowledged'); }}>
            <CheckCircle2 size={13} aria-hidden="true" /> Acknowledge
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setDisputing(true)}><MessageSquareWarning size={13} aria-hidden="true" /> Dispute</button>
        </div>
      );
    }
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {s.status === 'Scheduled' && (
        <button className="btn btn-primary btn-sm" onClick={() => { dispatch({ type: 'updateSession', id: s.id, patch: { status: 'Delivered' } }); notify(`Sent to ${agentById(s.agentId).name} to acknowledge`); }}>
          <Send size={13} aria-hidden="true" /> Mark delivered
        </button>
      )}
      {s.status === 'Delivered' && <span className="text-ui text-fg-subtle">Waiting for {agentById(s.agentId).name.split(' ')[0]} to acknowledge.</span>}
      {s.status === 'Disputed' && (
        <button className="btn btn-secondary btn-sm" onClick={() => { dispatch({ type: 'updateSession', id: s.id, patch: { status: 'Resolved' } }); notify('Dispute resolved'); }}>
          <CheckCircle2 size={13} aria-hidden="true" /> Mark resolved
        </button>
      )}
      {(s.status === 'Acknowledged' || s.status === 'Resolved') && !s.followUpGoalId && s.cat && (
        <button className="btn btn-secondary btn-sm" onClick={onFollowUp}><Target size={13} aria-hidden="true" /> Create follow-up goal</button>
      )}
      {s.followUpGoalId && <Link className="link-btn" to="/goals">Follow-up goal set →</Link>}
    </div>
  );
}

function Notes({ title, text, cls }) {
  if (!text) return null;
  return (
    <div className={cls}>
      <h3 className="mb-1 text-ui font-semibold">{title}</h3>
      <pre className="font-sans text-ui leading-relaxed whitespace-pre-wrap">{text}</pre>
    </div>
  );
}

function Sessions({ mine, onNew, onFollowUp }) {
  const { state, dispatch, criteria } = useApp();
  const navigate = useNavigate();
  const [who, setWho] = useState(mine ? ME : 'all');
  const [status, setStatus] = useState('All');
  const [sel, setSel] = useState(null);
  const list = state.sessions.filter((s) => (who === 'all' || s.agentId === who) && (status === 'All' || s.status === status) && !(mine && s.status === 'Draft'));
  const cur = list.find((s) => s.id === sel) || list[0];
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[1.5fr_1fr]">
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
          {!mine && (
            <select className="w-auto min-w-40 flex-1 sm:flex-none" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Agent filter">
              <option value="all">All agents</option>{AGENTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <select className="w-auto min-w-40 flex-1 sm:flex-none" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
            <option value="All">All statuses</option>{Object.keys(SESSION_CLS).map((k) => <option key={k} value={k}>{SESSION_LABEL[k]}</option>)}
          </select>
          {!mine && <button className="btn btn-primary btn-sm ml-auto" onClick={onNew}><Plus size={13} aria-hidden="true" /> New session</button>}
        </div>
        <div className="table-wrap border-t border-border">
          <table className="tbl">
            <thead><tr><th>Date</th>{!mine && <th>Agent</th>}<th>Topic</th><th>Type</th><th>Status</th><th className="num">Actions done</th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={6}><EmptyState icon={Inbox}>No sessions match these filters.</EmptyState></td></tr>}
              {list.map((s) => (
                <tr key={s.id} {...rowLink(() => setSel(s.id), cur && cur.id === s.id)}>
                  <td className="whitespace-nowrap tabular-nums">{s.date}</td>{!mine && <td className="whitespace-nowrap">{agentById(s.agentId).name}</td>}<td className="min-w-40 font-medium">{s.topic}{s.requested && <Badge cls="amber" className="ml-1.5">Employee request</Badge>}</td>
                  <td className="whitespace-nowrap">{SESSION_TYPES[s.type || 'performance'].short}</td>
                  <td><Badge cls={SESSION_CLS[s.status]}>{SESSION_LABEL[s.status]}</Badge></td>
                  <td className="num">{s.actionItems.filter((x) => x.done).length}/{s.actionItems.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title={cur ? cur.topic : 'Session detail'} right={cur && <Badge cls={SESSION_CLS[cur.status]}>{SESSION_LABEL[cur.status]}</Badge>} className="detail-panel">
        {!cur ? <EmptyState>Select a session to see details.</EmptyState> : (
          <div aria-live="polite">
            <p className="text-ui text-fg-subtle">{agentById(cur.agentId).name} · {cur.date} · {SESSION_TYPES[cur.type || 'performance'].label} · coach {cur.reviewer || agentById(cur.agentId).lead}</p>
            {cur.reason && <p className="mt-3 text-ui"><b>Reason:</b> {cur.reason}</p>}
            <div className="mt-3 flex flex-col gap-3">
              <Notes title="Highlights" text={cur.highlights} cls="rounded-lg border border-success-border bg-success-soft px-3.5 py-2.5" />
              <Notes title="Areas of opportunity" text={cur.opps} cls="rounded-lg border border-danger-border bg-danger-soft px-3.5 py-2.5" />
              <Notes title={cur.takeaways ? 'Key takeaways / next steps' : 'Notes'} text={cur.takeaways || cur.notes} cls="inset px-3.5 py-2.5" />
            </div>
            {cur.agentComment && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-ui text-danger-fg"><b>Agent comment:</b> {cur.agentComment}</p>}
            {(cur.goalIds || []).length > 0 && (
              <p className="mt-3 text-ui"><b>Goals discussed:</b> {cur.goalIds.map((id) => state.goals.find((g) => g.id === id)?.title).filter(Boolean).join('; ')}</p>
            )}
            {cur.cat && <p className="mt-3 text-xs text-fg-subtle">Focus category: {catName(cur.cat, criteria)}</p>}
            <h3 className="mt-4 mb-2 text-ui font-semibold">Action items</h3>
            <ul className="flex flex-col gap-1">
              {cur.actionItems.length === 0 && <li className="text-ui text-fg-subtle">None recorded.</li>}
              {cur.actionItems.map((x, i) => (
                <li key={i}><label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 text-ui hover:bg-surface-hover">
                  <input type="checkbox" checked={x.done} onChange={() => dispatch({ type: 'toggleAction', id: cur.id, index: i })} />
                  <span className={x.done ? 'text-fg-subtle line-through' : ''}>{x.text}</span>
                </label></li>
              ))}
            </ul>
            <div className="mt-4 border-t border-border pt-4"><SessionActions key={cur.id} s={cur} mine={mine} onFollowUp={() => onFollowUp(cur)} /></div>
            {sessionCalls(cur).length > 0 && (
              <div className="mt-3 flex flex-col gap-1">
                <span className="text-ui font-semibold">Linked calls</span>
                {sessionCalls(cur).map((id) => (
                  <button key={id} className="link-btn" onClick={() => { dispatch({ type: 'call', callId: id }); navigate(mine ? '/me' : gradingPath(id)); }}>
                    <ExternalLink size={13} aria-hidden="true" /> {callById(id) ? reviewId(state, callById(id)) : id} · {callById(id)?.date}
                  </button>
                ))}
              </div>
            )}
            {!mine && (
              <button className="btn btn-secondary btn-sm mt-4" onClick={() => navigate(`/coaching/workspace?id=${cur.id}`)}>
                <PenSquare size={13} aria-hidden="true" /> {cur.status === 'Draft' ? 'Continue in workspace' : 'Open in workspace'}
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function Coaching({ mine }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = mine || params.get('tab') === 'Sessions' ? 'Sessions' : 'Opportunities';
  const { state, metrics } = useApp();
  const [goalFor, setGoalFor] = useState(null);
  const followUp = (s) => {
    const cur = metrics.stats(s.agentId).cat[s.cat] || 70;
    setGoalFor({ sessionId: s.id, defaults: { agentId: s.agentId, cat: s.cat, title: `Improve ${s.topic.split(' — ')[0].replace(' - ', ': ')}`, target: Math.min(100, Math.ceil((cur + 10) / 5) * 5) } });
  };
  const start = (agentId, callIds = []) => navigate(workspaceLink(agentId, callIds));
  return (
    <Page>
      <PageHeader
        title={mine ? 'My Coaching' : 'Coaching'}
        description={mine ? 'Review coaching from your lead. Acknowledge it or tell them what you disagree with.' : 'Find coaching opportunities, run sessions in the Coaching Workspace and track follow-through.'}
        actions={!mine && <button className="btn btn-inverse" onClick={() => start(state.agentId)}><Plus size={14} aria-hidden="true" /> New coaching session</button>}
      />
      {!mine && <Tabs tabs={['Opportunities', 'Sessions']} value={tab} onChange={(t) => setParams({ tab: t })} label="Coaching views" />}
      {tab === 'Opportunities'
        ? <Opportunities onStart={(agentId, callId) => start(agentId, callId ? [callId] : [])} />
        : <Sessions mine={mine} onNew={() => start(state.agentId)} onFollowUp={followUp} />}
      {goalFor && <GoalModal {...goalFor} onClose={() => setGoalFor(null)} />}
    </Page>
  );
}
