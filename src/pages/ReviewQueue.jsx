import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, ExternalLink, Sparkles } from 'lucide-react';
import { Badge, EmptyState, Page, PageHeader, Callout, Pagination, rowLink, toneText, usePages } from '../components/ui';
import { StatusChip } from '../components/CallParts';
import { agentById } from '../data/agents';
import { CALLS } from '../data/calls';
import { useApp } from '../state/AppContext';
import { REASONS, LAST7 } from '../utils/metrics';
import { callStatus } from '../utils/review';
import { band, fmtPct } from '../utils/score';
import { gradingPath } from '../utils/roster';

const PAGE_SIZE = 10;

export default function ReviewQueue() {
  const { state, dispatch, notify, queue } = useApp();
  const navigate = useNavigate();
  const [only, setOnly] = useState(null);
  const counts = Object.fromEntries(Object.keys(REASONS).map((k) => [k, queue.filter((x) => x.reasons.includes(k)).length]));
  const rows = only ? queue.filter((x) => x.reasons.includes(only)) : queue;
  const pager = usePages(rows, PAGE_SIZE);
  const filter = (k) => { setOnly(k); pager.setPage(1); };
  const scored = CALLS.filter((c) => c.iso >= LAST7).length;
  const open = (id) => { navigate(gradingPath(id)); };

  return (
    <Page>
      <PageHeader
        title="Review Queue"
        description={`The AI scored all ${scored} calls from the last 7 days. These ${queue.length} need a person; the rest are left to the AI score.`}
        aside={<Callout value={fmtPct(((scored - queue.length) / scored) * 100)} sub={`${queue.length} flagged for review`}>handled by AI alone</Callout>}
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by reason">
        <button className="chip" aria-pressed={!only} onClick={() => filter(null)}>All <b className="tabular-nums">{queue.length}</b></button>
        {Object.entries(REASONS).map(([k, r]) => (
          <button key={k} className="chip" aria-pressed={only === k} onClick={() => filter(only === k ? null : k)} disabled={!counts[k]}>
            {r.label} <b className="tabular-nums">{counts[k]}</b>
          </button>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Call</th><th>Agent</th><th>Intent</th><th className="num">AI score</th><th>Why it's here</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8}><EmptyState icon={Sparkles}>Queue clear. Nothing needs review.</EmptyState></td></tr>}
              {pager.slice.map(({ call: c, total, reasons }) => (
                <tr key={c.id} {...rowLink(() => open(c.id))}>
                  <td className="whitespace-nowrap">{c.date}<small className="block tabular-nums">{c.time}</small></td>
                  <td className="tabular-nums">{c.id}</td>
                  <td className="whitespace-nowrap">{agentById(c.agentId).name}</td>
                  <td className="min-w-32">{c.intent[1]}</td>
                  <td className="num"><b className={toneText(band(total))}>{fmtPct(total)}</b></td>
                  <td><div className="flex min-w-40 flex-wrap gap-1">{reasons.map((k) => <Badge key={k} cls={REASONS[k].cls}>{REASONS[k].label}</Badge>)}</div></td>
                  <td><StatusChip status={callStatus(state, c)} /></td>
                  <td onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1.5">
                      <button className="btn btn-secondary btn-sm" onClick={() => open(c.id)}><ExternalLink size={12} aria-hidden="true" /> Review</button>
                      {!reasons.includes('dispute') && !reasons.includes('policy') && (
                        <button className="btn btn-ghost btn-sm" title="Agree with the AI and remove from the queue" onClick={() => { dispatch({ type: 'acceptAi', callId: c.id }); notify(`AI score accepted for call ${c.id}`); }}>
                          <CheckCheck size={12} aria-hidden="true" /> Accept AI score
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...pager} label="flagged calls" />
      </div>
      <p className="text-xs text-fg-subtle">Flag rules: score below 65%, negative sentiment with a score below 75%, AI confidence below 60% on any category, policy violations, agent disputes, plus a small random sample for AI calibration.</p>
    </Page>
  );
}
