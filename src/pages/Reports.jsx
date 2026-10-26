import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Download, ExternalLink, FileText, Gauge, Smile, ShieldAlert, Trophy, ClipboardList } from 'lucide-react';
import { Card, Badge, ProgressBar, Page, PageHeader, rowLink, cx } from '../components/ui';
import { AGENTS, agentById, TEAMS } from '../data/agents';
import { CAT_IDS } from '../data/rubric';
import { useApp } from '../state/AppContext';
import { fmtPct } from '../utils/score';
import { agentPath, gradingPath } from '../utils/roster';
import { CUR, MONTHS, MONTHS_LONG } from '../utils/dates';

const REPORTS = [
  { id: 'qa', title: 'QA Summary', desc: 'Average score and trend per agent', icon: Gauge },
  { id: 'sentiment', title: 'Sentiment', desc: 'Customer sentiment by agent', icon: Smile },
  { id: 'coverage', title: 'Call Coverage', desc: 'AI-scored vs manually reviewed', icon: FileText },
  { id: 'top', title: 'Top Performers', desc: 'Ranked by QA score', icon: Trophy },
  { id: 'alerts', title: 'Policy Alerts', desc: 'Guardrail and policy violations', icon: ShieldAlert },
  { id: 'notes', title: 'Contact Notes', desc: 'Template completeness (CIS)', icon: ClipboardList },
];
const RANGES = {
  [`${MONTHS_LONG[CUR]} (to date)`]: [CUR], [MONTHS_LONG[CUR - 1]]: [CUR - 1], [MONTHS_LONG[CUR - 2]]: [CUR - 2],
  [`${MONTHS[0]} – ${MONTHS[CUR]} (5 months)`]: [0, 1, 2, 3, 4],
};

function build(id, agents, m, metrics, criteria, reviews) {
  const s = (a) => metrics.stats(a.id, m);
  const byQa = agents.slice().sort((a, b) => s(b).qa - s(a).qa);
  switch (id) {
    case 'qa':
      return {
        cols: ['Agent', 'Team', 'Calls scored', 'Avg QA', `Δ vs ${MONTHS[0]}`, 'Coverage'],
        rows: agents.map((a) => [a.name, a.team, s(a).n.toLocaleString(), fmtPct(s(a).qa), `${s(a).qa - metrics.stats(a.id, 0).qa >= 0 ? '+' : ''}${(s(a).qa - metrics.stats(a.id, 0).qa).toFixed(1)} pts`, '100%']),
        bars: agents.map((a) => ({ name: a.name, v: s(a).qa })), metric: 'Avg QA score',
      };
    case 'sentiment':
      return {
        cols: ['Agent', 'Positive', 'Neutral', 'Negative'],
        rows: agents.map((a) => [a.name, fmtPct(s(a).pos), fmtPct(s(a).neu), fmtPct(s(a).neg)]),
        bars: agents.map((a) => ({ name: a.name, v: s(a).pos })), metric: '% positive calls',
      };
    case 'coverage': {
      const manual = Object.values(reviews).filter((r) => r.status === 'saved' && !r.accepted).length;
      const total = agents.reduce((sum, a) => sum + s(a).n, 0);
      return {
        cols: ['Method', 'Calls evaluated', 'Coverage'],
        rows: [['Manual QA baseline (2 calls / agent / month)', agents.length * 2 * m.length, fmtPct(((agents.length * 2 * m.length) / total) * 100)], ['Human-reviewed in Coaching360 (all time)', manual, '—'], ['AI-scored in Coaching360', total.toLocaleString(), '100%']],
        bars: [{ name: 'Manual QA', v: ((agents.length * 2 * m.length) / total) * 100 }, { name: 'Coaching360 AI QA', v: 100 }],
        metric: '% of calls evaluated',
      };
    }
    case 'top':
      return {
        cols: ['Rank', 'Agent', 'QA score', 'Best category', 'Positive sentiment'],
        rows: byQa.map((a, i) => {
          const best = CAT_IDS.slice().sort((x, y) => s(a).cat[y] - s(a).cat[x])[0];
          return [`#${i + 1}`, a.name, fmtPct(s(a).qa), `${criteria.find((c) => c.id === best)?.name || best} ${fmtPct(s(a).cat[best])}`, fmtPct(s(a).pos)];
        }),
        bars: byQa.map((a) => ({ name: a.name, v: s(a).qa })), metric: 'Avg QA score',
      };
    case 'notes':
      return {
        cols: ['Agent', 'Notes complete', 'Calls'],
        rows: agents.map((a) => [a.name, fmtPct(s(a).notes), s(a).n.toLocaleString()]),
        bars: agents.map((a) => ({ name: a.name, v: s(a).notes })), metric: '% notes with all required fields',
      };
    default:
      return null;
  }
}

const toCsv = (cols, rows) => [cols, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');


export default function Reports() {
  const { state, dispatch, notify, metrics, criteria } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const rid = REPORTS.some((r) => r.id === params.get('r')) ? params.get('r') : 'qa';
  const [team, setTeam] = useState('All teams');
  const [range, setRange] = useState(Object.keys(RANGES)[0]);
  const agents = AGENTS.filter((a) => team === 'All teams' || a.team === team);
  const report = REPORTS.find((r) => r.id === rid);
  const data = build(rid, agents, RANGES[range], metrics, criteria, state.reviews);

  const exportCsv = () => {
    const cols = data ? data.cols : ['Date', 'Agent', 'Type', 'Severity', 'Channel', 'Status'];
    const rows = data ? data.rows : state.alerts.map((a) => [a.date, agentById(a.agentId).name, a.type, a.severity, a.channel, a.status]);
    try {
      const url = URL.createObjectURL(new Blob([toCsv(cols, rows)], { type: 'text/csv' }));
      const link = Object.assign(document.createElement('a'), { href: url, download: `${rid}-report.csv` });
      link.click(); URL.revokeObjectURL(url);
      notify('CSV exported');
    } catch { notify('Export failed', 'warn'); }
  };
  // Numeric columns (everything except names, teams, categories and methods) align right
  const isNum = (v) => /^[#+\-−]?[\d,.]+( ?%| pts)?$|^—$/.test(String(v));

  return (
    <Page>
      <PageHeader
        title="Reports" description="Operational and quality reporting across 100% of interactions."
        actions={<a className="btn btn-secondary" href="https://demo.powerconnect.ai/dashboard360" target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true" /> Open in Dashboard360<span className="sr-only"> (opens in a new tab)</span></a>}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6" role="group" aria-label="Report type">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const on = rid === r.id;
          return (
            <button
              key={r.id} aria-pressed={on} onClick={() => setParams({ r: r.id })}
              className={cx('card flex flex-col gap-1 p-4 text-left transition-colors', on ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary-border hover:bg-surface-hover')}
            >
              <span className={cx('mb-1 inline-flex size-8 items-center justify-center rounded-lg', on ? 'bg-primary text-primary-fg' : 'bg-primary-soft text-primary-soft-fg')}><Icon size={16} aria-hidden="true" /></span>
              <b className="text-sm">{r.title}</b>
              <small className="leading-snug">{r.desc}</small>
            </button>
          );
        })}
      </div>
      <Card
        title={report.title} pad={false}
        right={<div className="flex flex-wrap items-center gap-2">
          {data && <select className="h-8 w-auto text-ui" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range">{Object.keys(RANGES).map((k) => <option key={k}>{k}</option>)}</select>}
          {data && <select className="h-8 w-auto text-ui" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team"><option>All teams</option>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select>}
          <button className="btn btn-secondary btn-sm" onClick={exportCsv}><Download size={13} aria-hidden="true" /> CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={() => notify('PDF export queued (mock)')}><Download size={13} aria-hidden="true" /> PDF</button>
        </div>}
      >
        {data ? (
          <div className="mt-4 grid items-start gap-6 border-t border-border lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-0">
            <div className="flex flex-col gap-3 p-4 sm:px-5 lg:border-r lg:border-border">
              <span className="eyebrow">{data.metric}</span>
              {data.bars.map((b) => (
                <div key={b.name} className="grid grid-cols-[minmax(0,8rem)_1fr_2.75rem] items-center gap-3 text-ui">
                  <span className="truncate" title={b.name}>{b.name}</span>
                  <ProgressBar value={b.v} color={b.v >= 85 ? 'green' : 'blue'} label={b.name} />
                  <b className="text-right tabular-nums">{fmtPct(b.v)}</b>
                </div>
              ))}
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr>{data.cols.map((c, j) => <th key={c} className={data.rows[0] && isNum(data.rows[0][j]) ? 'num' : ''}>{c}</th>)}</tr></thead>
                <tbody>
                  {data.rows.map((r, i) => {
                    const a = AGENTS.find((x) => x.name === r[0] || x.name === r[1]);
                    const props = a ? rowLink(() => navigate(agentPath(a.id))) : {};
                    return (
                      <tr key={i} {...props}>
                        {r.map((c, j) => <td key={j} className={cx(isNum(c) && 'num', j === 0 && !isNum(c) && 'font-medium', 'whitespace-nowrap')}>{c}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="table-wrap mt-4 border-t border-border">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Agent</th><th>Violation</th><th>Severity</th><th>Submitted content</th><th>Notified via</th><th>Status</th></tr></thead>
              <tbody>
                {state.alerts.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap tabular-nums">{a.date}</td><td className="whitespace-nowrap">{agentById(a.agentId).name}</td>
                    <td className="min-w-44"><b className="block">{a.type}</b>{a.callId && <button className="link-btn" onClick={() => { navigate(gradingPath(a.callId)); }}>Call {a.callId}</button>}</td>
                    <td><Badge cls={a.severity === 'High' ? 'red' : a.severity === 'Medium' ? 'amber' : 'gray'}>{a.severity}</Badge></td>
                    <td className="max-w-80 min-w-56 text-fg-muted">{a.content}</td><td className="whitespace-nowrap">{a.channel}</td>
                    <td>{a.status === 'Open'
                      ? <button className="btn btn-secondary btn-sm" onClick={() => { dispatch({ type: 'updateAlert', id: a.id, patch: { status: 'Reviewed' } }); notify('Alert marked reviewed'); }}>Mark reviewed</button>
                      : <Badge cls="green">Reviewed</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}
