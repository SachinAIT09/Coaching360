import { useNavigate } from 'react-router-dom';
import { Card, Badge, LineChart, ProgressBar, Avatar, Kpi, Page, PageHeader, cx } from '../components/ui';
import { AGENTS } from '../data/agents';
import { CAT_IDS } from '../data/rubric';
import { useApp } from '../state/AppContext';
import { avg, fmtPct } from '../utils/score';
import { MONTHS, MAY } from '../utils/dates';
import { agentPath } from '../utils/roster';

// Full class names so Tailwind can detect them
const HEAT = { 1: 'bg-heat-1 text-heat-1-fg', 2: 'bg-heat-2 text-heat-2-fg', 3: 'bg-heat-3 text-heat-3-fg', 4: 'bg-heat-4 text-heat-4-fg' };
const heat = (v) => HEAT[v >= 90 ? 4 : v >= 80 ? 3 : v >= 70 ? 2 : 1];

const bar = (label, value, color, right) => (
  <div key={label} className="grid grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-3 text-ui">
    <span className="leading-tight">{label}</span><ProgressBar value={value} color={color} label={label} /><b className="min-w-10 text-right tabular-nums">{right}</b>
  </div>
);

export default function TeamAnalytics() {
  const { dispatch, metrics, criteria } = useApp();
  const navigate = useNavigate();
  const open = (id, to) => { dispatch({ type: 'agent', agentId: id }); navigate(to || agentPath(id)); };
  const qa = (a) => metrics.stats(a.id).qa;
  const ranked = AGENTS.slice().sort((a, b) => qa(b) - qa(a));
  const team = metrics.stats('team');
  const prev = metrics.stats('team', MAY - 1);
  const trend = metrics.trend('team').map((v, i) => ({ label: i === 4 ? 'May*' : MONTHS[i], value: Math.round(v) }));
  const cats = criteria.filter((c) => CAT_IDS.includes(c.id));
  const cal = metrics.calibration;
  const groups = [
    { name: 'New (< 1 yr)', list: AGENTS.filter((a) => a.tenureMonths < 12) },
    { name: 'Mid (1–3 yrs)', list: AGENTS.filter((a) => a.tenureMonths >= 12 && a.tenureMonths < 36) },
    { name: 'Tenured (3+ yrs)', list: AGENTS.filter((a) => a.tenureMonths >= 36) },
  ];

  return (
    <Page>
      <PageHeader title="Team Analytics" description="Supervisor view across all agents in Customer Service and Billing Support. May is month to date." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Team QA score" value={fmtPct(team.qa)} hint={`▲ ${(team.qa - trend[0].value).toFixed(1)} pts since Jan`} hintClass="text-success-fg" />
        <Kpi label="Calls AI-scored (May)" value={team.n.toLocaleString()} hint="100% coverage" />
        <Kpi label="Positive sentiment" value={fmtPct(team.pos)} hint={`${fmtPct(team.neg)} negative`} />
        <Kpi
          label="Avg handle time" value={`${team.aht.toFixed(1)} min`}
          hint={`${team.aht <= prev.aht ? '▼' : '▲'} ${Math.abs(prev.aht - team.aht).toFixed(1)} min vs April`} hintClass={team.aht <= prev.aht ? 'text-success-fg' : ''}
        />
        <Kpi label="Contact notes complete" value={fmtPct(team.notes)} hint="CIS templates" />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1.1fr_1fr_1fr]">
        <Card title="Team QA trend"><LineChart data={trend} height={250} /></Card>
        <Card title="Top performers (May)">
          <ol className="-mx-2 flex flex-col">
            {ranked.slice(0, 5).map((a, i) => (
              <li key={a.id}><button className="grid w-full grid-cols-[1.5rem_auto_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-hover" onClick={() => open(a.id)}>
                <span className={cx('grid size-6 place-items-center rounded-full text-xs font-semibold', i === 0 ? 'bg-inverse text-inverse-fg' : 'bg-neutral-soft text-neutral-fg')}>{i + 1}</span>
                <Avatar name={a.name} size={28} />
                <span className="min-w-0 text-ui"><b className="block truncate">{a.name}</b><small className="block">{a.team}</small></span>
                <b className="text-ui tabular-nums">{fmtPct(qa(a))}</b>
              </button></li>
            ))}
          </ol>
        </Card>
        <Card title="AI calibration" right={<Badge cls={cal.overall >= 90 ? 'green' : 'amber'}>{fmtPct(cal.overall)} agreement</Badge>} className="md:col-span-2 xl:col-span-1">
          <p className="text-xs text-fg-subtle">How often human reviewers kept the AI score, across {cal.reviewed} human-reviewed calls.</p>
          <div className="mt-3 flex flex-col gap-2">
            {cats.map((c) => bar(c.name, cal.per[c.id] || 0, cal.per[c.id] >= 90 ? 'green' : 'amber', fmtPct(cal.per[c.id])))}
          </div>
          {cal.worst && <p className="mt-3 text-xs text-fg-subtle">Most overridden: <b className="text-fg-muted">{criteria.find((c) => c.id === cal.worst)?.name}</b>. Consider clarifying its definition in the QA template.</p>}
        </Card>
      </div>

      <Card title="Category heatmap · % of calls meeting expectations (May)" right={<span className="text-xs text-fg-subtle">Select a name for the agent, a cell for coaching</span>}>
        <div className="table-wrap -mx-4 px-4 sm:-mx-5 sm:px-5">
          <div className="grid min-w-[40rem] items-center gap-1" style={{ gridTemplateColumns: `minmax(8rem,10rem) repeat(${cats.length}, minmax(3.5rem,1fr))` }}>
            <span />{cats.map((c) => <small key={c.id} className="px-0.5 pb-1 text-center text-2xs leading-tight font-medium">{c.name}</small>)}
            {ranked.map((a) => {
              const s = metrics.stats(a.id);
              return (
                <div key={a.id} className="contents">
                  <button className="truncate rounded pr-2 text-left text-ui font-medium hover:text-link" onClick={() => open(a.id)}>{a.name}</button>
                  {cats.map((c) => (
                    <button
                      key={c.id} className={cx('h-8 rounded-md text-xs font-semibold tabular-nums transition-shadow hover:ring-2 hover:ring-fg/40', heat(s.cat[c.id]))}
                      title={`${a.name} · ${c.name}: ${fmtPct(s.cat[c.id])}`} aria-label={`${a.name}, ${c.name}: ${fmtPct(s.cat[c.id])}. Open coaching`}
                      onClick={() => open(a.id, '/coaching')}
                    >
                      {Math.round(s.cat[c.id])}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-subtle" aria-label="Legend">
          {[[1, 'Below 70'], [2, '70–79'], [3, '80–89'], [4, '90+']].map(([k, l]) => (
            <li key={k} className="inline-flex items-center gap-1.5"><span className={cx('h-3.5 w-5 rounded', HEAT[k])} aria-hidden="true" />{l}</li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Evaluation coverage" bodyClassName="flex flex-col">
          <div className="mb-4 flex flex-col gap-3.5">
            {bar('Manual QA (before)', Math.max(1, ((AGENTS.length * 2) / team.n) * 100), 'amber', `~${AGENTS.length * 2} / month`)}
            {bar('Coaching360 AI QA', 100, 'green', `${team.n.toLocaleString()} so far`)}
          </div>
          <p className="mt-auto border-t border-border pt-3 text-xs text-fg-subtle">Supervisors previously reviewed about 2 calls per agent per month in spreadsheets.</p>
        </Card>
        <Card title="Agent Assist usage by tenure" right={<Badge cls="blue">Pilot measurement</Badge>}>
          <div className="table-wrap -mx-4 sm:-mx-5" tabIndex={0} role="region" aria-label="Agent Assist usage by tenure">
            <table className="tbl">
              <thead><tr><th>Group</th><th className="num">Agents</th><th className="num">Prompts / agent / mo</th><th className="num">Avg QA</th><th className="num">AHT</th></tr></thead>
              <tbody>{groups.map((g) => (
                <tr key={g.name}><td className="font-medium whitespace-nowrap">{g.name}</td><td className="num">{g.list.length}</td><td className="num">{g.list.length ? Math.round(avg(g.list.map((a) => a.prompts))) : '—'}</td>
                  <td className="num">{g.list.length ? fmtPct(avg(g.list.map(qa))) : '—'}</td><td className="num whitespace-nowrap">{g.list.length ? `${avg(g.list.map((a) => metrics.stats(a.id).aht)).toFixed(1)} min` : '—'}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-fg-subtle">Prompt counts are illustrative. Measure 2–3 months of usage to decide which CSR groups get expanded agentic AI access.</p>
        </Card>
      </div>
    </Page>
  );
}
