import { useEffect, useRef } from 'react';
import { Quote, Activity } from 'lucide-react';
import { Badge, cx } from './ui';
import { STATUS_CLS } from '../utils/review';
import { fmtTime } from '../utils/score';
import { catName } from '../data/rubric';

const CONF = {
  High: ['text-success-fg', 'bg-success'],
  Med: ['text-warning-fg', 'bg-warning'],
  Low: ['text-danger-fg', 'bg-danger'],
};

export function ConfBadge({ value }) {
  if (value == null) return <span className="text-xs text-fg-subtle">—</span>;
  const lvl = value >= 0.8 ? 'High' : value >= 0.6 ? 'Med' : 'Low';
  const [text, dot] = CONF[lvl];
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs font-medium', text)} title={`AI confidence ${Math.round(value * 100)}%${lvl === 'Low' ? ': needs human review' : ''}`}>
      <i className={cx('size-1.5 rounded-full', dot)} aria-hidden="true" />{lvl}
      <span className="sr-only"> confidence, {Math.round(value * 100)}%</span>
    </span>
  );
}

export const StatusChip = ({ status }) => <Badge cls={STATUS_CLS[status] || 'gray'}>{status}</Badge>;

export const Speaker = ({ who }) => (
  <span className={cx(
    'mr-1.5 inline-block rounded px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase',
    who === 'Agent' ? 'bg-primary-soft text-primary-soft-fg' : 'bg-warning-soft text-warning-fg',
  )}>{who}</span>
);

// Evidence behind an AI score: transcript quotes (click to jump) and acoustic / absence signals
export function EvidenceList({ detail, onJump, override }) {
  if (!detail) return <p className="text-ui text-fg-subtle">No AI evidence. This criterion was added after the call was scored.</p>;
  return (
    <div className="text-ui">
      <p><b>Why {detail.score}:</b> {detail.reason} <span className="text-fg-subtle">· AI confidence {Math.round(detail.confidence * 100)}%</span></p>
      <ul className="mt-2.5 flex flex-col gap-2">
        {detail.evidence.map((e, i) => (
          <li key={i} className="flex items-baseline gap-2.5">
            <button
              className="shrink-0 rounded-md bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary-soft-fg tabular-nums transition-colors hover:bg-primary hover:text-primary-fg"
              onClick={() => onJump(e.t)} title="Play from here" aria-label={`Play from ${fmtTime(e.t)}`}
            >
              {fmtTime(e.t)}
            </button>
            {e.quote
              ? <span className="text-fg-muted italic"><Quote size={11} className="mr-1 inline text-fg-subtle" aria-hidden="true" /><Speaker who={e.who} />{e.quote}</span>
              : <span className="text-fg-muted"><Activity size={11} className="mr-1 inline text-fg-subtle" aria-hidden="true" />{e.signal}</span>}
          </li>
        ))}
      </ul>
      {override && (
        <p className="mt-2.5 rounded-lg bg-warning-soft px-3 py-2 text-warning-fg">
          Reviewer changed {override.from} → {override.to}{override.reason ? `: "${override.reason}"` : ' (no reason given)'}
        </p>
      )}
    </div>
  );
}

// Transcript that highlights the line at the current audio position
export function TranscriptList({ lines, audio, onJump, tall }) {
  const ref = useRef();
  let active = -1;
  if (audio.pos > 0) lines.forEach((l, i) => { if (l.t <= audio.pos) active = i; });
  useEffect(() => {
    const box = ref.current;
    const el = box && box.children[active];
    if (el) box.scrollTop = el.offsetTop - 30;
  }, [active]);
  return (
    <ul className={cx('relative flex flex-col gap-0.5 overflow-y-auto pr-1 text-ui', tall ? 'max-h-80' : 'max-h-44')} ref={ref} aria-label="Transcript">
      {lines.map((l, i) => (
        <li key={i} className={cx('rounded-md', i === active && 'bg-primary-soft shadow-[inset_3px_0_0_var(--primary)]')} aria-current={i === active ? 'true' : undefined}>
          <button onClick={() => onJump(l.t)} className="w-full rounded-md px-2 py-1 text-left leading-relaxed hover:bg-surface-hover">
            <time className="mr-2 text-xs text-fg-subtle tabular-nums">{fmtTime(l.t).padStart(5, '0')}</time><Speaker who={l.who} />{l.text}
          </button>
        </li>
      ))}
    </ul>
  );
}

// Key moments derived from the AI evidence: every opportunity plus the main highlights
export function keyMoments(conv, call, criteria) {
  const out = [{ t: conv.problemT, type: 'neutral', label: `Customer intent: ${call.intent[1]}` }];
  const ids = criteria.map((c) => c.id);
  const good = [];
  for (const [cid, d] of Object.entries(conv.detail)) {
    if (!ids.includes(cid)) continue;
    const e = d.evidence[0];
    if (!e) continue;
    const m = { t: e.t, type: d.score === 3 ? 'good' : 'opp', label: `${catName(cid, criteria)}: ${d.reason}` };
    if (d.score === 3) good.push(m); else out.push(m);
  }
  return [...out, ...good.slice(0, 3)].sort((a, b) => a.t - b.t);
}
