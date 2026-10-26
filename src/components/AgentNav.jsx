import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { agentById } from '../data/agents';
import { useApp } from '../state/AppContext';
import { agentPath, rosterParams, rosterRows, rosterSearch } from '../utils/roster';

// Breadcrumb back to an agent roster, plus previous/next agent in the roster's current order
export function AgentNav({ agentId, base, label }) {
  const { state, metrics, queue } = useApp();
  const { search } = useLocation();
  const view = rosterParams(search);
  const rosterSearchStr = rosterSearch(view);
  let order = rosterRows(state, metrics, queue, view).map((r) => r.a.id);
  if (!order.includes(agentId)) order = rosterRows(state, metrics, queue, rosterParams('')).map((r) => r.a.id);
  const i = order.indexOf(agentId);
  const step = (d) => agentById(order[(i + d + order.length) % order.length]);
  const prevA = step(-1), nextA = step(1);
  const a = agentById(agentId);
  const arrow = 'icon-btn size-8 border border-border';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-ui text-fg-subtle">
          <li><Link className="link-btn" to={`${base}${rosterSearchStr}`}>{label}</Link></li>
          <li aria-hidden="true"><ChevronRight size={13} /></li>
          <li><Link className="link-btn" to={`${base}${rosterSearch({ ...view, team: a.team })}`}>{a.team}</Link></li>
          <li aria-hidden="true"><ChevronRight size={13} /></li>
          <li aria-current="page" className="font-medium text-fg">{a.name}</li>
        </ol>
      </nav>
      {order.length > 1 && (
        <div className="flex items-center gap-2 text-ui text-fg-subtle">
          <Link className={arrow} to={agentPath(prevA.id, rosterSearchStr, base)} aria-label={`Previous agent: ${prevA.name}`} title={prevA.name}><ChevronLeft size={16} aria-hidden="true" /></Link>
          <span className="tabular-nums">{i + 1} of {order.length}</span>
          <Link className={arrow} to={agentPath(nextA.id, rosterSearchStr, base)} aria-label={`Next agent: ${nextA.name}`} title={nextA.name}><ChevronRight size={16} aria-hidden="true" /></Link>
        </div>
      )}
    </div>
  );
}
