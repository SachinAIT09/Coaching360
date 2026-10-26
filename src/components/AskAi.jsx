import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Send, ChevronRight, X, History } from 'lucide-react';
import { Card, cx } from './ui';
import { useApp } from '../state/AppContext';
import { askAi, SUGGESTIONS } from '../utils/askAi';
import { agentPath, gradingPath } from '../utils/roster';

export default function AskAi() {
  const ctx = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  // Only one answer is shown at a time; earlier questions stay as chips to bring them back
  const [history, setHistory] = useState([]);
  const [current, setCurrent] = useState(null);
  const timer = useRef();

  const ask = (text) => {
    const question = text.trim();
    if (!question || busy) return;
    setQ('');
    setBusy(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setHistory((h) => [question, ...h.filter((x) => x.question !== question).map((x) => x.question)].slice(0, 5).map((qq) => (qq === question ? { question, answer: askAi(question, ctx) } : h.find((x) => x.question === qq))));
      setCurrent(question);
      setBusy(false);
    }, 450);
  };
  const follow = (row) => {
    if (row.callId) { navigate(gradingPath(row.callId)); }
    else if (row.agentId) { navigate(agentPath(row.agentId)); }
    else if (row.to) navigate(row.to);
  };
  const shown = history.find((x) => x.question === current);
  const recent = history.filter((x) => x.question !== current);
  const chip = (s) => <button key={s} type="button" className="chip min-h-7 py-0.5 text-left text-xs" onClick={() => ask(s)}>{s}</button>;

  return (
    <Card title={<><Sparkles size={15} className="text-link" aria-hidden="true" /> Ask about your team</>}>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input className="h-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder='e.g. "How is my team performing today?"' aria-label="Ask a question" />
        <button className="btn btn-primary h-10" disabled={!q.trim() || busy}><Send size={14} aria-hidden="true" /> <span className="hidden sm:inline">Ask</span><span className="sr-only sm:hidden">Ask</span></button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">{SUGGESTIONS.map(chip)}</div>
      <div aria-live="polite">
        {busy && <p className="mt-3 animate-pulse-soft text-ui text-fg-subtle">Analysing today's calls…</p>}
        {shown && !busy && (
          <div className="mt-3 rounded-r-xl border-l-[3px] border-primary bg-primary-soft/60 px-4 py-3">
            <div className="flex items-start gap-2">
              <p className="mb-1 min-w-0 flex-1 text-xs text-fg-subtle italic">{shown.question}</p>
              <button type="button" className="icon-btn -mt-1.5 -mr-2 size-7" aria-label="Clear answer" onClick={() => setCurrent(null)}><X size={14} aria-hidden="true" /></button>
            </div>
            <h3 className="text-sm font-semibold">{shown.answer.title}</h3>
            <p className="mt-0.5 text-sm text-fg-muted">{shown.answer.text}</p>
            {shown.answer.rows && shown.answer.rows.length > 0 && (
              <ul className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-1.5">
                {shown.answer.rows.slice(0, 7).map((r) => {
                  const inner = <><span className="min-w-0 flex-1 truncate">{r.label}</span><b className="tabular-nums">{r.value}</b></>;
                  const cls = 'flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-ui';
                  return (
                    <li key={r.label}>
                      {r.agentId || r.callId || r.to
                        ? <button className={cx(cls, 'transition-colors hover:border-primary')} onClick={() => follow(r)}>{inner}<ChevronRight size={13} className="text-fg-subtle" aria-hidden="true" /></button>
                        : <div className={cls}>{inner}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        {recent.length > 0 && !busy && (
          <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-border pt-3">
            <span className="eyebrow mr-1">Recent</span>
            {recent.slice(0, 3).map((x) => (
              <button
                key={x.question} type="button" onClick={() => setCurrent(x.question)} aria-label={`Show answer: ${x.question}`} title={x.question}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-link transition-colors hover:bg-surface-hover sm:max-w-72"
              >
                <History size={12} className="shrink-0 text-fg-subtle" aria-hidden="true" /><span className="truncate">{x.question}</span>
              </button>
            ))}
            <button type="button" className="ml-auto rounded-md px-2 py-1 text-xs text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg" onClick={() => { setHistory([]); setCurrent(null); }}>
              Clear history
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
