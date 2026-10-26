import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, CheckCircle2 } from 'lucide-react';
import { Card, Badge, Avatar, Sparkline, Kpi, Page, PageHeader, EmptyState, rowLink, toneText, cx } from '../components/ui';
import AskAi from '../components/AskAi';
import { AGENTS, agentById } from '../data/agents';
import { CALLS } from '../data/calls';
import { useApp, useAccount } from '../state/AppContext';
import { REASONS } from '../utils/metrics';
import { SESSION_CLS, SESSION_LABEL } from '../utils/review';
import { band, fmtPct } from '../utils/score';
import { TODAY_ISO, longToday, toISO, addDays, MAY } from '../utils/dates';
import { agentPath, gradingPath } from '../utils/roster';

const listBtn = 'grid w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-surface-hover';

export default function Home() {
  const { state, dispatch, metrics, queue } = useApp();
  const navigate = useNavigate();
  const account = useAccount();
  const t = metrics.today;
  const team = metrics.stats('team');
  const openAlerts = state.alerts.filter((a) => a.status === 'Open');
  const weekEnd = addDays(TODAY_ISO, 7);
  const due = state.sessions.filter((s) => (s.status === 'Scheduled' && toISO(s.date) <= weekEnd) || s.status === 'Delivered' || s.status === 'Disputed');
  const openAgent = (id, to) => { dispatch({ type: 'agent', agentId: id }); navigate(to || agentPath(id)); };

  const rows = AGENTS.map((a) => {
    const today = CALLS.filter((c) => c.iso === TODAY_ISO && c.agentId === a.id);
    const s = metrics.stats(a.id);
    const prev = metrics.stats(a.id, MAY - 1).qa;
    return {
      a, s, prev, trend: metrics.trend(a.id),
      today: today.length, neg: today.filter((c) => c.sentiment === 'Negative').length,
      flagged: queue.filter((x) => x.call.agentId === a.id).length,
    };
  }).sort((x, y) => x.s.qa - y.s.qa);

  return (
    <Page>
      <PageHeader title={`Good morning, ${account.name.split(' ')[0]}`} description={`${longToday} · Customer Service & Billing Support · data as of 12:00`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <Kpi label="Calls today" value={t.n} hint="all AI-scored" />
        <Kpi label="Team QA today" value={fmtPct(t.qa)} valueClass={toneText(band(t.qa))} hint={`${fmtPct(team.qa)} month to date`} />
        <Kpi label="Negative sentiment" value={fmtPct(t.neg)} hint="of today's calls" />
        <Kpi label="Needs review" value={queue.length} hint="last 7 days" to="/queue" />
        <Kpi label="Open alerts" value={openAlerts.length} valueClass={openAlerts.length ? 'text-danger-fg' : ''} hint="policy & security" to="/reports?r=alerts" />
        <Kpi label="Coaching due" value={due.length} hint="this week" to="/coaching?tab=Sessions" />
      </div>

      <AskAi />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Team at a glance" right={<span className="text-xs text-fg-subtle">Lowest QA first · select a row to drill in</span>} pad={false} bodyClassName="flex flex-col">
          <div className="table-wrap mt-3">
            <table className="tbl">
              <thead><tr><th>Agent</th><th className="num">QA (May)</th><th>Trend</th><th className="num">vs Apr</th><th className="num">Calls today</th><th className="num">Negative</th><th className="num">Flagged</th></tr></thead>
              <tbody>
                {rows.map(({ a, s, prev, trend, today, neg, flagged }) => {
                  const up = s.qa >= prev;
                  return (
                    <tr key={a.id} {...rowLink(() => openAgent(a.id))}>
                      <td><span className="inline-flex items-center gap-2.5 font-medium whitespace-nowrap"><Avatar name={a.name} size={26} />{a.name}</span></td>
                      <td className="num"><b className={toneText(band(s.qa))}>{fmtPct(s.qa)}</b></td>
                      <td><Sparkline values={trend} /></td>
                      <td className={cx('num whitespace-nowrap', up ? 'text-success-fg' : 'text-danger-fg')}>
                        <span aria-hidden="true">{up ? '▲' : '▼'}</span><span className="sr-only">{up ? 'up' : 'down'}</span> {Math.abs(s.qa - prev).toFixed(1)}
                      </td>
                      <td className="num">{today}</td>
                      <td className="num">{neg ? <Badge cls="red">{neg}</Badge> : <span className="text-fg-subtle">0</span>}</td>
                      <td className="num">{flagged ? <Badge cls="amber">{flagged}</Badge> : <span className="text-fg-subtle">0</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-auto border-t border-border px-5 py-3.5 sm:px-6">
            <Link className="link-btn" to="/performance">Open Agent Performance <ChevronRight size={13} aria-hidden="true" /></Link>
          </div>
        </Card>
        <div className="flex min-w-0 flex-col gap-5">
          <Card title="Needs attention" right={<Link className="link-btn" to="/queue">Open queue</Link>} bodyClassName="pt-1.5! pb-2!">
            <ul className="divide-y divide-border">
              {queue.length === 0 && <li><EmptyState icon={CheckCircle2}>Queue clear.</EmptyState></li>}
              {queue.slice(0, 5).map(({ call: c, total, reasons }) => (
                <li key={c.id}><button className={cx(listBtn, 'grid-cols-[1fr_auto_auto_auto]')} onClick={() => { navigate(gradingPath(c.id)); }}>
                  <span className="min-w-0"><b className="block truncate text-ui">{agentById(c.agentId).name}</b><small className="block truncate">{c.date} · {c.intent[1]}</small></span>
                  <Badge cls={REASONS[reasons[0]].cls}>{REASONS[reasons[0]].label}</Badge>
                  <b className={cx('w-10 text-right text-ui tabular-nums', toneText(band(total)))}>{fmtPct(total)}</b>
                  <ChevronRight size={14} className="text-fg-subtle" aria-hidden="true" />
                </button></li>
              ))}
            </ul>
          </Card>
          <Card title="Coaching this week" right={<Link className="link-btn" to="/coaching?tab=Sessions">All sessions</Link>} bodyClassName="pt-1.5! pb-2!">
            <ul className="divide-y divide-border">
              {due.length === 0 && <li className="py-3 text-ui text-fg-subtle">Nothing due.</li>}
              {due.map((s) => (
                <li key={s.id}><button className={cx(listBtn, 'grid-cols-[1fr_auto_auto]')} onClick={() => openAgent(s.agentId, '/coaching?tab=Sessions')}>
                  <span className="min-w-0"><b className="block truncate text-ui">{agentById(s.agentId).name}</b><small className="block truncate">{s.date} · {s.topic}</small></span>
                  <Badge cls={SESSION_CLS[s.status]}>{SESSION_LABEL[s.status]}</Badge>
                  <ChevronRight size={14} className="text-fg-subtle" aria-hidden="true" />
                </button></li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </Page>
  );
}
