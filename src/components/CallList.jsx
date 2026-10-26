import { useNavigate } from 'react-router-dom';
import { ExternalLink, MessageSquarePlus } from 'lucide-react';
import { Modal, Badge, EmptyState, Pagination, toneText, usePages } from './ui';
import { StatusChip } from './CallParts';
import { agentById } from '../data/agents';
import { useApp } from '../state/AppContext';
import { callStatus, reviewId } from '../utils/review';
import { band, fmtPct } from '../utils/score';
import { gradingPath } from '../utils/roster';

const PAGE = 10;

// Coaching Workspace link for one or more calls of an agent
export const workspaceLink = (agentId, callIds = [], extra = '') =>
  `/coaching/workspace?agent=${agentId}${callIds.length ? `&calls=${callIds.join(',')}` : ''}${extra}`;

// Table of calls behind a metric, with links to the evaluation and the Coaching Workspace.
// `rows` = [{ call, note?, value? }]; `valueLabel` titles the optional value column.
export function CallsTable({ rows, valueLabel, mine, onOpen }) {
  const { state, dispatch, metrics } = useApp();
  const navigate = useNavigate();
  const pager = usePages(rows, PAGE);
  if (!rows.length) return <EmptyState>No calls in this selection.</EmptyState>;
  const open = (c) => { dispatch({ type: 'call', callId: c.id }); onOpen?.(); navigate(mine ? '/me' : gradingPath(c.id)); };
  return (
    <>
      <div className="table-wrap -mx-5" tabIndex={0} role="region" aria-label="Calls">
        <table className="tbl">
          <thead><tr><th>Date</th><th>Review ID</th><th>Type</th><th className="num">Score</th>{valueLabel && <th className="num">{valueLabel}</th>}<th>Status</th><th>Observation</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {pager.slice.map(({ call: c, note, value }) => {
              const pct = metrics.total(c);
              return (
                <tr key={c.id}>
                  <td className="whitespace-nowrap tabular-nums">{c.date} <small>{c.time}</small></td>
                  <td className="whitespace-nowrap tabular-nums">{reviewId(state, c)}</td>
                  <td className="min-w-28">{c.intent[1]}<small className="block">{c.direction}</small></td>
                  <td className="num"><b className={toneText(band(pct))}>{fmtPct(pct)}</b></td>
                  {valueLabel && <td className="num font-medium">{value}</td>}
                  <td><StatusChip status={callStatus(state, c)} /></td>
                  <td className="min-w-48 text-fg-muted">{note || c.focus}</td>
                  <td className="whitespace-nowrap">
                    <button className="link-btn" onClick={() => open(c)} aria-label={`Open call ${c.id}`}>Open <ExternalLink size={11} aria-hidden="true" /></button>
                    {!mine && (
                      <button className="link-btn ml-3" onClick={() => { onOpen?.(); navigate(workspaceLink(c.agentId, [c.id])); }} aria-label={`Coach on call ${c.id}`}>
                        <MessageSquarePlus size={12} aria-hidden="true" /> Coach
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="-mx-5 -mb-5">
        <Pagination {...pager} label={`calls · ${agentById(rows[0].call.agentId).name}`} />
      </div>
    </>
  );
}

export function CallsModal({ title, description, rows, valueLabel, mine, onClose }) {
  return (
    <Modal title={title} wide onClose={onClose} footer={<button className="btn btn-secondary" onClick={onClose}>Close</button>}>
      {description && <p className="mb-3 text-ui text-fg-subtle">{description}</p>}
      <CallsTable rows={rows} valueLabel={valueLabel} mine={mine} onOpen={onClose} />
    </Modal>
  );
}

export const SourceBadge = ({ stats }) => {
  // How the QA score is made up: AI only, coach validated, or a mix
  const share = stats.aiGraded ? (stats.coachReviewed / stats.aiGraded) * 100 : 0;
  const label = stats.coachReviewed === 0 ? 'AI-generated' : share >= 99 ? 'Coach-validated' : 'AI + coach-validated';
  return <Badge cls="blue" title="Coach-validated and coach-graded scores replace the AI score for those calls">{label}{stats.coachReviewed > 0 && share < 99 ? ` · ${fmtPct(share)} reviewed` : ''}</Badge>;
};
