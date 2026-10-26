import { Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { Card, Badge, Avatar, Page, PageHeader, EmptyState, toneText, rowLink, cx } from '../components/ui';
import { TEAMS } from '../data/agents';
import { useApp } from '../state/AppContext';
import { SESSION_CLS, SESSION_LABEL } from '../utils/review';
import { band, fmtPct } from '../utils/score';
import { PERIODS, SORTS, agentPath, rosterParams, rosterRows, rosterSearch } from '../utils/roster';

function Delta({ cur, prev }) {
  if (cur == null || prev == null) return <span className="text-fg-subtle">–</span>;
  const d = cur - prev;
  if (Math.abs(d) < 0.5) return <span className="text-fg-subtle">0.0</span>;
  return (
    <span className={d > 0 ? 'text-success-fg' : 'text-danger-fg'}>
      <span aria-hidden="true">{d > 0 ? '▲' : '▼'}</span><span className="sr-only">{d > 0 ? 'up' : 'down'}</span> {Math.abs(d).toFixed(1)}
    </span>
  );
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const DEFAULT_DESCRIPTION = "Every agent's QA results for the period. Select an agent to see their scores, trends, goals and calls.";

export default function AgentRoster({ base = '/performance', title = 'Agent Performance', description = DEFAULT_DESCRIPTION }) {
  const { state, metrics, queue } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = rosterParams(params.toString());
  const set = (patch) => setParams(rosterSearch({ ...view, ...patch }), { replace: true });
  const rows = rosterRows(state, metrics, queue, view);
  const search = rosterSearch(view);
  const teams = TEAMS.filter((t) => rows.some((r) => r.a.team === t));

  return (
    <Page>
      <PageHeader title={title} description={description} />
      <Card pad={false}>
        <div className="grid grid-cols-2 gap-2 p-4 sm:flex sm:flex-wrap sm:items-center">
          <div className="relative col-span-2 sm:w-64">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input className="pl-9" placeholder="Filter by name" value={view.q} onChange={(e) => set({ q: e.target.value })} aria-label="Filter agents by name" />
          </div>
          <select className="sm:w-44" value={view.team} onChange={(e) => set({ team: e.target.value })} aria-label="Team filter">
            <option value="All">All teams</option>{TEAMS.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select className="sm:w-52" value={view.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort agents">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="col-span-2 sm:col-span-1 sm:ml-auto sm:w-40" value={view.period} onChange={(e) => set({ period: e.target.value })} aria-label="Reporting period">
            {Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {rows.length === 0 ? <EmptyState icon={Users}>No agents match these filters.</EmptyState> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>Agent</th><th className="num">QA score</th><th className="num">vs prior</th><th className="num">Calls</th>
                <th className="num">Goal compliance</th><th>Coaching</th><th>Needs attention</th>
              </tr></thead>
              <tbody>
                {teams.map((t) => (
                  <Fragment key={t}>
                    <tr><th colSpan={7} scope="colgroup" className="bg-surface-muted text-xs font-semibold text-fg-muted">{t}</th></tr>
                    {rows.filter((r) => r.a.team === t).map(({ a, cur, prev, goalPct, goals, atRisk, alerts, flagged, session }) => (
                      <tr key={a.id} {...rowLink(() => navigate(agentPath(a.id, search, base)))} aria-label={`Open ${a.name}`}>
                        <td><span className="inline-flex items-center gap-2.5 whitespace-nowrap"><Avatar name={a.name} size={28} /><span><b className="block text-ui font-medium">{a.name}</b><small className="block">{a.tenure}</small></span></span></td>
                        <td className="num"><b className={toneText(band(cur.qa))}>{fmtPct(cur.qa)}</b></td>
                        <td className="num whitespace-nowrap"><Delta cur={cur.qa} prev={prev?.qa} /></td>
                        <td className="num">{cur.analyzed}</td>
                        <td className="num">{goals ? <>{fmtPct(goalPct)} <small>· {plural(goals, 'goal')}</small></> : <span className="text-fg-subtle">–</span>}</td>
                        <td>{session ? <span className="inline-flex items-center gap-2 whitespace-nowrap"><Badge cls={SESSION_CLS[session.status]}>{SESSION_LABEL[session.status]}</Badge><small>{session.date}</small></span> : <span className="text-fg-subtle">–</span>}</td>
                        <td>
                          <span className={cx('flex flex-wrap gap-1.5', !(alerts || atRisk || flagged) && 'text-fg-subtle')}>
                            {alerts > 0 && <Badge cls="red">{plural(alerts, 'alert')}</Badge>}
                            {atRisk > 0 && <Badge cls="amber">{atRisk} goal{atRisk === 1 ? '' : 's'} at risk</Badge>}
                            {flagged > 0 && <Badge cls="blue">{flagged} flagged</Badge>}
                            {!(alerts || atRisk || flagged) && '–'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}
