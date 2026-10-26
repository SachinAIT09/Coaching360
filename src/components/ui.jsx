import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, X, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { fmtTime, rng } from '../utils/score';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

// Semantic tones used by data (band(), STATUS_CLS, REASONS...): green | blue | amber | red | gray | none
const BADGE_TONE = {
  green: 'bg-success-soft text-success-fg ring-success-border',
  red: 'bg-danger-soft text-danger-fg ring-danger-border',
  amber: 'bg-warning-soft text-warning-fg ring-warning-border',
  blue: 'bg-primary-soft text-primary-soft-fg ring-primary-border',
  gray: 'bg-neutral-soft text-neutral-fg ring-border',
};
const TEXT_TONE = { green: 'text-success-fg', blue: 'text-link', amber: 'text-warning-fg', red: 'text-danger-fg', none: 'text-fg-subtle', gray: 'text-fg-subtle' };
const FILL_TONE = { blue: 'bg-primary', green: 'bg-success', amber: 'bg-warning', red: 'bg-danger' };
const CARD_TONE = { green: 'border-success-border bg-success-soft', red: 'border-danger-border bg-danger-soft', blue: 'border-primary-border bg-primary-soft' };

export const toneText = (tone) => TEXT_TONE[tone] || '';
export const toneFill = (tone) => FILL_TONE[tone] || FILL_TONE.blue;

export function Card({ title, right, children, className = '', bodyClassName = '', pad = true, tone }) {
  return (
    <section className={cx('card flex flex-col', tone && CARD_TONE[tone], className)}>
      {(title || right) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pt-5 sm:px-6">
          {title && <h2 className="flex items-center gap-1.5 text-lg leading-6 font-bold">{title}</h2>}
          {right}
        </header>
      )}
      <div className={cx('min-w-0 flex-1', pad && 'p-5 sm:px-6', pad && (title || right) && 'pt-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export const Page = ({ children, className = '' }) => (
  <div className={cx('mx-auto flex w-full max-w-page flex-col gap-5', className)}>{children}</div>
);

export function PageHeader({ title, description, actions, aside }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-9 font-bold tracking-[-0.3px] sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-pretty text-fg-muted">{description}</p>}
      </div>
      {aside}
      {/* Actions sit beside the title on wide screens; on phones buttons share rows instead of stacking */}
      {actions && <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end max-sm:[&>.btn]:flex-1">{actions}</div>}
    </div>
  );
}

// Highlighted metric used in page headers (coverage callouts)
export const Callout = ({ value, children, sub }) => (
  <div className="shrink-0 rounded-tile bg-surface px-4 py-3 text-fg shadow-card">
    <p className="text-sm"><b className="num-display mr-1 text-[22px]">{value}</b>{children}</p>
    {sub && <p className="text-xs">{sub}</p>}
  </div>
);

export function Kpi({ label, value, valueClass = '', hint, hintClass = '', to }) {
  const body = (
    <>
      <span className="label-caps flex items-center justify-between gap-2">
        {label}
        {to && <ArrowUpRight size={14} className="text-fg-muted transition-colors group-hover:text-fg" aria-hidden="true" />}
      </span>
      <b className={cx('num-display mt-1 text-[22px] leading-7', valueClass)}>{value}</b>
      {hint && <span className={cx('text-xs text-fg-subtle', hintClass)}>{hint}</span>}
    </>
  );
  const cls = 'card flex flex-col gap-1 p-5';
  return to
    ? <Link to={to} className={cx(cls, 'card-action group text-fg no-underline')}>{body}</Link>
    : <div className={cls}>{body}</div>;
}

export const Badge = ({ cls = 'gray', children, title, className = '' }) => (
  <span className={cx('badge', BADGE_TONE[cls] || BADGE_TONE.gray, className)} title={title}>{children}</span>
);

export const Avatar = ({ name, size = 28 }) => (
  <span
    className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--avatar)] text-[var(--avatar-fg)] font-heading font-bold"
    style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    aria-hidden="true"
  >
    {name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
  </span>
);

// Row of small inset stat tiles: items = [label, value, valueClass?, subline?]
export function StatGrid({ items, className = 'grid-cols-2 sm:grid-cols-4' }) {
  return (
    <dl className={cx('grid gap-2', className)}>
      {items.map(([label, value, cls, sub]) => (
        <div key={label} className="inset flex min-w-0 flex-col px-3 py-2.5">
          <dt className="label-caps">{label}</dt>
          <dd className={cx('num-display mt-1 text-lg leading-6', cls)}>{value}</dd>
          {sub && <dd className="text-xs text-fg-muted">{sub}</dd>}
        </div>
      ))}
    </dl>
  );
}

// 64px square tile with initials (agent header, profile menu)
export const InitialTile = ({ name, letters = 2 }) => (
  <span className="grid size-16 shrink-0 place-items-center rounded-tile bg-[var(--avatar)] text-[var(--avatar-fg)] font-heading text-2xl font-bold" aria-hidden="true">
    {name.split(' ').map((p) => p[0]).slice(0, letters).join('')}
  </span>
);

export function ProgressBar({ value, color = 'blue', target, height = 8, label }) {
  return (
    <div
      className="relative w-full rounded-full bg-track" style={{ height }}
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value || 0)} aria-label={label}
    >
      <div className={cx('h-full rounded-full transition-[width] duration-300', toneFill(color))} style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }} />
      {target != null && <div className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-fg" style={{ left: `${target}%` }} title={`Target ${target}%`} />}
    </div>
  );
}

export function RingGauge({ value, size = 96, stroke = 10, color = 'var(--success)', label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={`${Math.round(value)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${(c * value) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-fg font-heading text-xl font-bold tabular-nums">{label ?? `${Math.round(value)}%`}</text>
    </svg>
  );
}

// `onSelect(i)` makes each point a button; `marks` = [{ index, label }] draws dashed event markers (e.g. coaching sessions)
export function LineChart({ data, height = 150, width = 320, min = 0, max = 100, ticks = [0, 25, 50, 75, 100], unit = '%', onSelect, selected, marks = [] }) {
  const w = width, padL = 30, padR = 22, padT = marks.length ? 20 : 10, padB = 22;
  const iw = w - padL - padR, ih = height - padT - padB;
  const x = (i) => padL + (data.length === 1 ? iw / 2 : (iw * i) / (data.length - 1));
  const y = (v) => padT + ih - ((v - min) / (max - min)) * ih;
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ');
  const area = `${path} L${x(data.length - 1)},${padT + ih} L${x(0)},${padT + ih} Z`;
  const gid = `lc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const summary = data.map((d) => `${d.label} ${d.value}${unit}`).join(', ');
  // Event markers are numbered (sessions in the same period share one marker) and named in a legend,
  // so labels never overlap however close together they are
  const numbered = marks.slice().sort((a, b) => a.index - b.index).map((m, i) => ({ ...m, n: i + 1 }));
  const groups = [...numbered.reduce((g, m) => g.set(m.index, [...(g.get(m.index) || []), m]), new Map())];
  const chart = (
    <svg viewBox={`0 0 ${w} ${height}`} className="block h-auto w-full" role={onSelect ? 'group' : 'img'} aria-label={`Trend: ${summary}`}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity=".2" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" />
          <text x={padL - 5} y={y(t)} textAnchor="end" dominantBaseline="central" className="fill-fg-subtle text-[9px]">{t}{unit}</text>
        </g>
      ))}
      {groups.map(([index, ms]) => {
        const tag = ms.map((m) => m.n).join(',');
        const bw = Math.max(12, tag.length * 5 + 7);
        return (
          <g key={index}>
            <title>{ms.map((m) => m.label).join('; ')}</title>
            <line x1={x(index)} x2={x(index)} y1={padT} y2={padT + ih} stroke="var(--warning)" strokeDasharray="3 3" strokeWidth="1.5" />
            <g aria-hidden="true">
              <rect x={x(index) - bw / 2} y={2} width={bw} height={12} rx={6} fill="var(--surface)" stroke="var(--warning)" strokeWidth="1.25" />
              <text x={x(index)} y={8.5} textAnchor="middle" dominantBaseline="central" className="fill-warning-fg text-[8px] font-bold">{tag}</text>
            </g>
          </g>
        );
      })}
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => {
        const on = selected != null ? selected === i : i === data.length - 1;
        const dot = (
          <circle cx={x(i)} cy={y(d.value)} r={on ? 4.5 : 3.25} fill={on ? 'var(--primary)' : 'var(--surface)'} stroke="var(--primary)" strokeWidth="2">
            <title>{`${d.label}: ${d.value}${unit}`}</title>
          </circle>
        );
        return (
          <g key={d.label}>
            {onSelect ? (
              <g
                role="button" tabIndex={0} aria-label={`${d.label}: ${d.value}${unit}. Show calls`} className="cursor-pointer outline-none focus-visible:[&>circle]:stroke-fg"
                onClick={() => onSelect(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(i); } }}
              >
                <circle cx={x(i)} cy={y(d.value)} r="11" fill="transparent" />
                {dot}
              </g>
            ) : dot}
            <text x={x(i)} y={height - 6} textAnchor="middle" className="fill-fg-subtle text-[9px]">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
  if (!numbered.length) return chart;
  return (
    <div>
      {chart}
      <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Chart events">
        {numbered.map((m) => (
          <li key={m.n} className="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
            <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full border border-warning px-1 text-[10px] leading-none font-bold text-warning-fg" aria-hidden="true">{m.n}</span>
            {m.label}
          </li>
        ))}
      </ol>
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children, footer, wide }) {
  const ref = useRef();
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();

  useEffect(() => {
    const node = ref.current;
    const prev = document.activeElement;
    if (!node.contains(document.activeElement)) {
      const body = node.querySelector('[data-modal-body]');
      (body.querySelector(FOCUSABLE) || node).focus();
    }
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      if (prev && document.contains(prev)) prev.focus();
    };
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close.current(); return; }
    if (e.key !== 'Tab') return;
    const items = [...ref.current.querySelectorAll(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div
      className="fixed inset-0 z-60 flex animate-fade items-end justify-center bg-overlay backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}
        className={cx(
          'flex max-h-[92dvh] w-full min-w-0 animate-pop flex-col rounded-t-card border border-border bg-surface shadow-modal outline-none sm:max-h-[88vh] sm:rounded-card',
          wide ? 'sm:max-w-5xl' : 'sm:max-w-lg',
        )}
      >
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button className="icon-btn -mr-2" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </header>
        <div className="min-w-0 overflow-y-auto px-5 py-5" data-modal-body>{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className = '', label }) {
  const refs = useRef([]);
  const onKeyDown = (e) => {
    const i = tabs.indexOf(value);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    const j = (next + tabs.length) % tabs.length;
    onChange(tabs[j]);
    refs.current[j]?.focus();
  };
  return (
    <div className={cx('tabs', className)} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((t, i) => (
        <button
          key={t} ref={(el) => (refs.current[i] = el)} role="tab" type="button"
          aria-selected={value === t} tabIndex={value === t ? 0 : -1} className="tab" onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function useAudio(duration) {
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => {
      setPos((p) => {
        if (p + 0.25 * speed >= duration) { setPlaying(false); return duration; }
        return p + 0.25 * speed;
      });
    }, 250);
    return () => clearInterval(id);
  }, [playing, speed, duration]);
  return {
    pos, playing, speed,
    toggle: () => { if (pos >= duration) setPos(0); setPlaying((p) => !p); },
    seek: (t) => { setPos(Math.max(0, Math.min(duration, t))); },
    cycleSpeed: () => setSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1)),
  };
}

export function AudioPlayer({ audio, duration, seed = 1, compact }) {
  const bars = useMemo(() => { const r = rng(seed); return Array.from({ length: compact ? 36 : 64 }, () => 6 + Math.round(r() * 22)); }, [seed, compact]);
  const ref = useRef();
  const click = (e) => {
    const box = ref.current.getBoundingClientRect();
    audio.seek(((e.clientX - box.left) / box.width) * duration);
  };
  const onKeyDown = (e) => {
    const t = { ArrowRight: audio.pos + 5, ArrowUp: audio.pos + 5, ArrowLeft: audio.pos - 5, ArrowDown: audio.pos - 5, PageUp: audio.pos + 30, PageDown: audio.pos - 30, Home: 0, End: duration }[e.key];
    if (t == null) return;
    e.preventDefault();
    audio.seek(t);
  };
  return (
    <div className="inset flex items-center gap-3 px-3 py-2.5">
      <button
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-inverse text-inverse-fg transition-transform hover:scale-105 active:scale-95"
        onClick={audio.toggle} aria-label={audio.playing ? 'Pause recording' : 'Play recording'}
      >
        {audio.playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="translate-x-px" />}
      </button>
      <div
        ref={ref} onClick={click} onKeyDown={onKeyDown} tabIndex={0} role="slider" aria-label="Seek recording"
        aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.round(audio.pos)} aria-valuetext={`${fmtTime(audio.pos)} of ${fmtTime(duration)}`}
        className="flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-[2px] rounded"
      >
        {bars.map((h, i) => (
          <span key={i} style={{ height: h }} className={cx('min-w-[2px] flex-1 rounded-sm transition-colors', i / bars.length <= audio.pos / duration ? 'bg-primary' : 'bg-border-strong')} />
        ))}
      </div>
      <span className="text-xs whitespace-nowrap text-fg-subtle tabular-nums">{fmtTime(audio.pos)} / {fmtTime(duration)}</span>
      <button className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-fg-muted tabular-nums hover:bg-surface-hover" onClick={audio.cycleSpeed} aria-label={`Playback speed ${audio.speed}x`} title="Playback speed">{audio.speed}x</button>
    </div>
  );
}

export const Field = ({ label, children, className = '' }) => (
  <label className={cx('field', className)}>
    <span className="field-label">{label}</span>
    {children}
  </label>
);

export const EmptyState = ({ children, icon: Icon }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-fg-subtle">
    {Icon && <span className="inline-flex size-10 items-center justify-center rounded-full bg-surface-muted text-fg-subtle"><Icon size={18} aria-hidden="true" /></span>}
    <div className="flex items-center gap-2">{children}</div>
  </div>
);

export function Sparkline({ values, width = 84, height = 24 }) {
  const vs = values.filter((v) => v != null);
  if (vs.length < 2) return null;
  const min = Math.min(...vs) - 2;
  const max = Math.max(...vs) + 2;
  const x = (i) => (width * i) / (vs.length - 1);
  const y = (v) => height - ((v - min) / (max - min)) * height;
  const d = vs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const up = vs[vs.length - 1] >= vs[0];
  const color = up ? 'var(--success)' : 'var(--danger)';
  return (
    <svg width={width} height={height} viewBox={`-3 -3 ${width + 6} ${height + 6}`} className="block overflow-visible" role="img" aria-label={`Trend ${Math.round(vs[0])} to ${Math.round(vs[vs.length - 1])}`}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(vs.length - 1)} cy={y(vs[vs.length - 1])} r="2.5" fill={color} />
    </svg>
  );
}

// Page numbers to show: always the first and last, the current one and its neighbours, with gaps as null
function pageList(page, pages) {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const out = [];
  [...keep].sort((a, b) => a - b).forEach((p, i, arr) => {
    if (i && p - arr[i - 1] === 2) out.push(p - 1); // a gap of one page shows that page, not "…"
    else if (i && p - arr[i - 1] > 2) out.push(null);
    out.push(p);
  });
  return out;
}

// Slice of `rows` for the current page; the page is clamped when rows shrink (e.g. an item leaves the list)
export function usePages(rows, size) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const cur = Math.min(page, pages);
  return { page: cur, pages, setPage, slice: rows.slice((cur - 1) * size, cur * size), from: rows.length ? (cur - 1) * size + 1 : 0, to: Math.min(cur * size, rows.length), total: rows.length };
}

export function Pagination({ page, pages, setPage, from, to, total, label = 'items' }) {
  if (total === 0) return null;
  const btn = 'inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-control px-2.5 text-[13px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40';
  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-3 sm:flex-row">
      <p className="text-[13px] text-fg-muted" aria-live="polite">Showing <b className="text-fg">{from === to ? from.toLocaleString() : `${from.toLocaleString()}–${to.toLocaleString()}`}</b> of <b className="text-fg">{total.toLocaleString()}</b> {label}</p>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button className={cx(btn, 'hover:bg-surface-hover')} onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Previous page"><ChevronLeft size={16} aria-hidden="true" /></button>
          {pageList(page, pages).map((p, i) => (p == null
            ? <span key={`gap${i}`} className="px-1 text-fg-muted" aria-hidden="true">…</span>
            : (
              <button
                key={p} className={cx(btn, p === page ? 'bg-inverse text-inverse-fg' : 'text-fg-muted hover:bg-surface-hover hover:text-fg')}
                onClick={() => setPage(p)} aria-label={`Page ${p}`} aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            )))}
          <button className={cx(btn, 'hover:bg-surface-hover')} onClick={() => setPage(page + 1)} disabled={page === pages} aria-label="Next page"><ChevronRight size={16} aria-hidden="true" /></button>
        </div>
      )}
    </nav>
  );
}

// Props that make a table row behave like a link: click, Enter or Space opens it
export const rowLink = (fn, selected) => ({
  className: 'row-link',
  tabIndex: 0,
  'aria-selected': selected,
  onClick: fn,
  onKeyDown: (e) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fn(); }
  },
});

// Close a popover on outside pointer-down or Escape (focus returns to the trigger)
export function useDismiss(open, setOpen, rootRef, triggerRef) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); triggerRef?.current?.focus(); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, setOpen, rootRef, triggerRef]);
}
