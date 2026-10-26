import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUp, ArrowDown, ArrowUpDown, SearchX } from 'lucide-react';
import { Badge, Page, PageHeader, Callout, EmptyState, Pagination, rowLink, toneText, usePages } from '../components/ui';
import { StatusChip } from '../components/CallParts';
import { AGENTS, agentById } from '../data/agents';
import { CALLS, callsFor } from '../data/calls';
import { useApp, useViewAgent } from '../state/AppContext';
import { callStatus, gradingStatus, reviewId } from '../utils/review';
import { band, callTag, fmtPct } from '../utils/score';
import { LAST7 } from '../utils/metrics';
import { TODAY_ISO, addDays, CUR, DATA_START, MONTHS, monthRange, shortDate } from '../utils/dates';
import { gradingPath } from '../utils/roster';

const RANGES = { '7d': ['Last 7 days', LAST7], mtd: [`${MONTHS[CUR]} to date`, monthRange(CUR)[0]], '30d': ['Last 30 days', addDays(TODAY_ISO, -29)], all: [`All calls (since ${shortDate(DATA_START)})`, DATA_START] };
const PAGE = 25;
const REVIEW_TYPES = ['AI Graded', 'In Review', 'Coach Validated', 'Coach Graded', 'Developmental'];

export default function CallLibrary({ mine }) {
  const { state, dispatch, metrics } = useApp();
  const navigate = useNavigate();
  const me = useViewAgent(mine);
  const [q, setQ] = useState('');
  const [range, setRange] = useState('7d');
  const [agent, setAgent] = useState('all');
  const [sent, setSent] = useState('all');
  const [score, setScore] = useState('all');
  const [flagged, setFlagged] = useState(false);
  const [rtype, setRtype] = useState('all');
  const [tag, setTag] = useState('all');
  const [sort, setSort] = useState({ key: 'date', dir: -1 });

  const source = mine ? callsFor(me) : CALLS;
  const tagOf = (c) => state.reviews[c.id]?.tags || [];
  const allTags = useMemo(() => [...new Set(Object.values(state.reviews).flatMap((r) => r.tags || []))].sort(), [state.reviews]);
  const rows = useMemo(() => {
    const from = RANGES[range][1];
    const needle = q.toLowerCase();
    const list = source.filter((c) => {
      if (c.iso < from) return false;
      if (!mine && agent !== 'all' && c.agentId !== agent) return false;
      if (sent !== 'all' && c.sentiment !== sent) return false;
      const pct = metrics.total(c);
      if (score !== 'all' && !(score === 'high' ? pct >= 90 : score === 'mid' ? pct >= 80 && pct < 90 : pct < 80)) return false;
      if (flagged && !(pct < 80 || c.violation || c.sentiment === 'Negative')) return false;
      if (rtype === 'requested' ? !state.dev[c.id]?.requested : rtype !== 'all' && gradingStatus(state, c) !== rtype) return false;
      if (tag !== 'all' && !tagOf(c).includes(tag)) return false;
      if (needle && !`${c.id} ${reviewId(state, c)} ${c.account} ${c.customer} ${agentById(c.agentId).name} ${c.intent.join(' ')} ${c.focus} ${tagOf(c).join(' ')}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const val = (c) => (sort.key === 'score' ? metrics.total(c) : sort.key === 'agent' ? agentById(c.agentId).name : sort.key === 'duration' ? c.durSec : c.iso + c.time);
    return list.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, mine, metrics, q, range, agent, sent, score, flagged, sort, rtype, tag, state]);
  const pager = usePages(rows, PAGE);

  const mtd = source.filter((c) => c.month === CUR).length;
  const th = (key, label, num) => {
    const on = sort.key === key;
    const Icon = !on ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <th className={num ? 'num' : ''} aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button className="inline-flex items-center gap-1 uppercase hover:text-fg" onClick={() => { setSort({ key, dir: on ? -sort.dir : -1 }); pager.setPage(1); }}>
          {label} <Icon size={11} className={on ? 'text-link' : 'opacity-60'} aria-hidden="true" />
        </button>
      </th>
    );
  };
  const open = (c) => { dispatch({ type: 'call', callId: c.id }); navigate(mine ? '/me' : gradingPath(c.id)); };
  const reset = (fn) => (e) => { fn(e.target.value); pager.setPage(1); };

  return (
    <Page>
      <PageHeader
        title={mine ? 'My Calls' : 'Call Library'}
        description={mine ? 'Every one of your calls is scored. Open one to see the evidence, or dispute a score.' : 'Every call, automatically scored. Not just the two per agent per month that supervisors could review by hand.'}
        aside={<Callout value={mtd.toLocaleString()} sub={!mine && `vs ~${AGENTS.length * 2} a month with manual QA`}>{`calls AI-scored in ${MONTHS[CUR]}`}</Callout>}
      />
      <div className="card flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:flex-wrap lg:items-center">
        <label className="relative min-w-0 flex-1 lg:min-w-72">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <span className="sr-only">Search calls</span>
          <input type="search" className="pl-9" placeholder="Search Review ID, call ID, account, customer, agent, topic, tag…" value={q} onChange={reset(setQ)} />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <select className="sm:w-auto" value={range} onChange={reset(setRange)} aria-label="Date range">{Object.entries(RANGES).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
          {!mine && <select className="sm:w-auto" value={agent} onChange={reset(setAgent)} aria-label="Agent"><option value="all">All agents</option>{AGENTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
          <select className="sm:w-auto" value={sent} onChange={reset(setSent)} aria-label="Sentiment"><option value="all">Any sentiment</option><option>Positive</option><option>Neutral</option><option>Negative</option></select>
          <select className="sm:w-auto" value={rtype} onChange={reset(setRtype)} aria-label="Review type"><option value="all">Any review type</option>{REVIEW_TYPES.map((t) => <option key={t}>{t}</option>)}<option value="requested">Employee-submitted</option></select>
          {allTags.length > 0 && <select className="sm:w-auto" value={tag} onChange={reset(setTag)} aria-label="Tag"><option value="all">Any tag</option>{allTags.map((t) => <option key={t}>{t}</option>)}</select>}
          <select className="sm:w-auto" value={score} onChange={reset(setScore)} aria-label="Score band"><option value="all">Any score</option><option value="high">90%+</option><option value="mid">80–89%</option><option value="low">Below 80%</option></select>
          <label className="col-span-2 inline-flex h-9 items-center gap-2 px-1 text-ui font-medium whitespace-nowrap text-fg-muted">
            <input type="checkbox" checked={flagged} onChange={(e) => { setFlagged(e.target.checked); pager.setPage(1); }} /> Needs attention
          </label>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="tbl">
            <caption className="sr-only">Calls, sortable by date, agent, duration and score</caption>
            <thead><tr>{th('date', 'Date')}<th>Review ID</th>{!mine && th('agent', 'Agent')}<th>Intent</th>{th('duration', 'Duration', true)}<th>Sentiment</th>{th('score', 'Score', true)}<th>Status</th><th>Flags & tags</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={9}><EmptyState icon={SearchX}>No calls match these filters.</EmptyState></td></tr>}
              {pager.slice.map((c) => {
                const pct = metrics.total(c);
                const ctag = callTag(pct);
                return (
                  <tr key={c.id} {...rowLink(() => open(c))}>
                    <td className="whitespace-nowrap">{c.date} <small className="tabular-nums">{c.time}</small></td>
                    <td className="whitespace-nowrap tabular-nums">{reviewId(state, c)}</td>
                    {!mine && <td className="whitespace-nowrap">{agentById(c.agentId).name}</td>}
                    <td className="min-w-32">{c.intent[1]}</td>
                    <td className="num">{c.duration}</td>
                    <td><Badge cls={c.sentiment === 'Positive' ? 'green' : c.sentiment === 'Negative' ? 'red' : 'gray'}>{c.sentiment}</Badge></td>
                    <td className="num"><b className={toneText(band(pct))}>{fmtPct(pct)}</b></td>
                    <td><StatusChip status={callStatus(state, c)} /></td>
                    <td className="whitespace-nowrap">
                      {c.violation ? <Badge cls="red">Policy</Badge> : ctag.cls !== 'blue' ? <Badge cls={ctag.cls}>{ctag.label}</Badge> : null}
                      {state.dev[c.id]?.requested && <Badge cls="amber" className="ml-1">Employee request</Badge>}
                      {tagOf(c).map((t) => <Badge key={t} cls="blue" className="ml-1">{t}</Badge>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination {...pager} label="calls" />
      </div>
    </Page>
  );
}
