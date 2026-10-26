import { Fragment, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Download, Wand2, ChevronDown, ChevronRight, AlertTriangle, Save, BookOpenCheck, Search, Plus, Trash2, RefreshCw, History, Sparkles, PenLine, Info } from 'lucide-react';
import { Card, Badge, Modal, Field, AudioPlayer, useAudio, Page, PageHeader, toneText, cx } from '../components/ui';
import { ConfBadge, StatusChip, EvidenceList, TranscriptList, keyMoments } from '../components/CallParts';
import { EditableList, TagEditor, parseTime } from '../components/Editors';
import { workspaceLink } from '../components/CallList';
import { AgentNav } from '../components/AgentNav';
import { agentById, firstName, LEADS, REVIEWERS, TEAMS } from '../data/agents';
import { callById, callsFor, sentimentSeries } from '../data/calls';
import { getConversation } from '../data/transcripts';
import { draftNote } from '../data/contactTypes';
import { catName, SCALE } from '../data/rubric';
import { ORG } from '../data/org';
import { useApp, TODAY } from '../state/AppContext';
import { getReview, gradingStatus, reviewId, reviewNotes, aiSummary, isDev } from '../utils/review';
import { weightedTotal, points, band, fmtPct, fmt1, fmtTime } from '../utils/score';
import { gradingPath, isAgentId } from '../utils/roster';

const BOX_SEL = {
  green: 'border-success bg-success',
  amber: 'border-warning bg-warning',
  red: 'border-danger bg-danger',
};
const MOMENT = { good: ['green', 'Highlight'], opp: ['red', 'Opportunity'], neutral: ['gray', 'Context'] };

function Levels({ c }) {
  return (
    <dl className="grid gap-1.5 text-ui sm:grid-cols-[auto_1fr]">
      {[3, 2, 1].filter((v) => c.levels?.[v] || (v !== 2 || !c.binary)).map((v) => (
        <Fragment key={v}>
          <dt className="font-semibold whitespace-nowrap">{v} — {SCALE.find((x) => x.v === v).title.split('—')[1].replace(':', '').trim()}</dt>
          <dd className="text-fg-muted">{c.levels?.[v] || (v === 2 && c.binary ? 'Not used: binary category.' : c.def)}</dd>
        </Fragment>
      ))}
      {c.example && <><dt className="font-semibold">Example</dt><dd className="text-fg-muted italic">{c.example}</dd></>}
    </dl>
  );
}

function Matrix({ call, rev, conv, onJump, onGuide }) {
  const { dispatch, criteria } = useApp();
  const [open, setOpen] = useState(null);
  const manual = rev.method === 'manual';
  const total = weightedTotal(rev.coach, criteria);
  const aiTotal = weightedTotal(call.ai, criteria);
  const cols = manual ? 8 : 10;
  return (
    <Card
      title="Grading matrix"
      right={
        <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-ui text-fg-subtle">
          {!manual && <span>AI <b className="tabular-nums text-fg-muted">{fmtPct(aiTotal)}</b></span>}
          <span className="flex items-baseline gap-2">Total score <b className={cx('text-2xl font-semibold tracking-tight tabular-nums', toneText(band(total)))} aria-live="polite">{fmtPct(total)}</b></span>
        </span>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {!manual && <button className="link-btn" onClick={() => dispatch({ type: 'applyAi', callId: call.id })}><Wand2 size={13} aria-hidden="true" /> Reset to AI scores</button>}
        <button className="link-btn" onClick={onGuide}><BookOpenCheck size={13} aria-hidden="true" /> Scoring guidelines</button>
        <span className="text-xs text-fg-subtle">
          {manual ? 'Manual grading: AI scores are hidden so you can grade independently.' : 'Pre-filled with AI scores. Change any you disagree with and give a reason.'} Accuracy, Opening and Closing accept 1 or 3 only.
        </span>
      </div>
      <div className="table-wrap -mx-4 sm:-mx-5">
        <table className="tbl">
          <thead>
            <tr>
              <th>Category</th><th className="num">Weight</th><th className="text-center!">1</th><th className="text-center!">2</th><th className="text-center!">3</th>
              {!manual && <><th>AI score</th><th className="num">Coach</th></>}
              <th className="num">Final</th><th className="num">Weighted</th><th><span className="sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => {
              const s = rev.coach[c.id];
              const ai = call.ai[c.id];
              const d = conv.detail[c.id];
              const ov = !manual && rev.overrides[c.id];
              const isOpen = open === c.id || (ov && open !== `x${c.id}`);
              return (
                <Fragment key={c.id}>
                  <tr className={ov ? '[&>td]:bg-warning-soft' : ''}>
                    <td className="font-medium whitespace-nowrap">{c.label || c.name}{c.custom && <> <Badge cls="blue">New</Badge></>}</td>
                    <td className="num">{c.weight}%</td>
                    {[1, 2, 3].map((v) => {
                      const disabled = c.binary && v === 2;
                      const tone = v === 3 ? 'green' : v === 2 ? 'amber' : 'red';
                      const sel = s === v;
                      return (
                        <td key={v} className="text-center">
                          <button
                            disabled={disabled} aria-label={`${c.name}: ${v}`} aria-pressed={sel}
                            title={disabled ? 'Binary category: 1 or 3 only' : c.levels?.[v] || undefined}
                            className={cx(
                              'inline-block size-6 rounded-md border-2 align-middle transition-all',
                              sel ? cx(BOX_SEL[tone], 'shadow-[inset_0_0_0_3px_var(--surface)]') : 'border-border-strong bg-surface hover:border-fg-subtle',
                              'disabled:border-dashed disabled:opacity-35 disabled:hover:border-border-strong',
                            )}
                            onClick={() => dispatch({ type: 'score', callId: call.id, cat: c.id, value: v })}
                          />
                        </td>
                      );
                    })}
                    {!manual && (
                      <>
                        <td className="whitespace-nowrap"><span className={cx('mr-1.5 font-semibold tabular-nums', ai != null && ai < 3 && 'text-danger-fg')}>{ai ?? '—'}</span><ConfBadge value={d?.confidence} /></td>
                        <td className="num">{ov ? <b className="text-warning-fg">{s}</b> : s != null && ai != null ? <span className="text-fg-subtle" title="Coach accepted the AI score">✓<span className="sr-only">accepted</span></span> : s ?? '—'}</td>
                      </>
                    )}
                    <td className="num font-semibold">{s ?? '—'}</td>
                    <td className="num text-fg-muted">{s ? fmt1(points(c, s)) : '—'}</td>
                    <td className="w-10">
                      <button className="icon-btn" aria-label={`${isOpen ? 'Hide' : 'Show'} ${manual ? 'scoring guide' : 'AI evidence'} for ${c.name}`} aria-expanded={!!isOpen}
                        onClick={() => setOpen(isOpen ? (ov ? `x${c.id}` : null) : c.id)}>
                        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={cols} className="bg-surface-muted py-3.5">
                        {manual ? <Levels c={c} /> : <EvidenceList detail={d} onJump={onJump} />}
                        {ov && (
                          <label className="mt-3 flex flex-col gap-1.5 text-ui font-medium text-warning-fg">
                            <span>You changed the AI score {ov.from} → {ov.to}. Why? <small className="font-normal">(required to finalize; helps calibrate the AI)</small></span>
                            <input value={ov.reason} placeholder="e.g. The email was already on file and confirmed." onChange={(e) => dispatch({ type: 'overrideReason', callId: call.id, cat: c.id, text: e.target.value })} />
                          </label>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function KeyMoments({ call, rev, conv, audio, onJump }) {
  const { dispatch, criteria } = useApp();
  const manual = rev.method === 'manual';
  const [form, setForm] = useState(null);
  const ai = manual ? [] : keyMoments(conv, call, criteria).map((m) => ({ ...m, source: 'AI' }));
  const mine = rev.moments.map((m, i) => ({ ...m, source: 'Coach', i }));
  const all = [...ai, ...mine].sort((a, b) => a.t - b.t);
  const save = () => {
    const t = parseTime(form.time);
    if (t == null || !form.label.trim()) return;
    dispatch({ type: 'reviewField', callId: call.id, patch: { moments: [...rev.moments, { t: Math.min(t, call.durSec), type: form.type, cat: form.cat || null, label: form.label.trim() }] } });
    setForm(null);
  };
  return (
    <Card
      title="Key moments"
      right={!form && <button className="btn btn-secondary btn-sm" onClick={() => setForm({ time: fmtTime(audio.pos), type: 'opp', cat: '', label: '' })}><Plus size={13} aria-hidden="true" /> Add moment</button>}
    >
      <p className="mb-2 text-xs text-fg-subtle">{manual ? 'Document the moments that support your grading. They are saved with recording timestamps.' : 'AI-identified moments plus any you add. Select one to play from there.'}</p>
      {form && (
        <div className="inset mb-3 grid gap-2 p-3 sm:grid-cols-[5rem_8rem_1fr]">
          <Field label="Time"><input value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} aria-invalid={parseTime(form.time) == null} /></Field>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="opp">Opportunity</option><option value="good">Highlight</option><option value="neutral">Context</option>
            </select>
          </Field>
          <Field label="Category">
            <select value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
              <option value="">None</option>{criteria.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="What happened" className="sm:col-span-3"><input autoFocus value={form.label} placeholder="e.g. Customer raised voice about the disconnect notice" onChange={(e) => setForm({ ...form, label: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} /></Field>
          <div className="flex justify-end gap-2 sm:col-span-3">
            <button className="btn btn-secondary btn-sm" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={parseTime(form.time) == null || !form.label.trim()}>Save moment</button>
          </div>
        </div>
      )}
      <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
        {all.length === 0 && <li className="text-ui text-fg-subtle">No moments yet.</li>}
        {all.map((m, k) => (
          <li key={k} className="flex items-center gap-1">
            <button className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left text-ui hover:bg-surface-hover" onClick={() => onJump(m.t)}>
              <time className="w-9 shrink-0 text-xs text-fg-subtle tabular-nums">{fmtTime(m.t)}</time>
              <Badge cls={MOMENT[m.type][0]}>{MOMENT[m.type][1]}</Badge>
              <span className="min-w-0">{m.label}{m.cat && <small className="ml-1">· {catName(m.cat, criteria)}</small>}</span>
              <small className="ml-auto shrink-0">{m.source}</small>
            </button>
            {m.source === 'Coach' && (
              <button className="icon-btn shrink-0" aria-label={`Remove moment at ${fmtTime(m.t)}`} onClick={() => dispatch({ type: 'reviewField', callId: call.id, patch: { moments: rev.moments.filter((_, j) => j !== m.i) } })}>
                <Trash2 size={13} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SummaryCard({ call, rev }) {
  const { dispatch } = useApp();
  const manual = rev.method === 'manual';
  const value = rev.summary ?? (manual ? '' : aiSummary(call));
  const series = sentimentSeries(call);
  const share = (fn) => Math.round((series.filter(fn).length / series.length) * 100);
  const dist = [['Positive', share((v) => v >= 0.2), 'bg-success'], ['Neutral', share((v) => v > -0.2 && v < 0.2), 'bg-warning'], ['Negative', share((v) => v <= -0.2), 'bg-danger']];
  return (
    <Card
      title={<>Call summary <small className="font-normal">{manual ? '(coach)' : rev.summary != null ? '(AI, edited by coach)' : '(AI-generated)'}</small></>}
      right={!manual && <button className="link-btn" onClick={() => dispatch({ type: 'reviewField', callId: call.id, patch: { summary: null } })}><RefreshCw size={12} aria-hidden="true" /> Regenerate</button>}
    >
      <label className="sr-only" htmlFor="call-summary">Call summary</label>
      <textarea id="call-summary" rows={4} value={value} placeholder="Reason for calling, what the agent did and the outcome."
        onChange={(e) => dispatch({ type: 'reviewField', callId: call.id, patch: { summary: e.target.value } })} />
      <h3 className="mt-4 mb-2 text-ui font-semibold">Customer sentiment</h3>
      <div className="flex flex-wrap items-center gap-4">
        <div className="inset px-3 py-2"><b className="block text-sm">{call.sentiment}</b><small>{call.emotion} · overall</small></div>
        <ul className="flex min-w-48 flex-1 flex-col gap-1.5">
          {dist.map(([k, v, fill]) => (
            <li key={k} className="grid grid-cols-[1fr_3rem_4rem] items-center gap-2 text-xs">
              <span className="h-2 rounded-full bg-track"><span className={cx('block h-full rounded-full', fill)} style={{ width: `${v}%` }} /></span>
              <b className="text-right tabular-nums">{v}%</b><span className="text-fg-subtle">{k}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 flex gap-1.5 text-xs text-fg-subtle"><Info size={13} className="mt-px shrink-0" aria-hidden="true" />Sentiment is context only and does not set the QA score. A customer can be unhappy with a bill or policy even when the call was handled well.</p>
    </Card>
  );
}

function HistoryCard({ call, rev }) {
  const { criteria } = useApp();
  const items = [...rev.history].reverse();
  return (
    <Card title={<><History size={14} aria-hidden="true" /> Evaluation history</>}>
      <p className="mb-2 text-xs text-fg-subtle">The original AI assessment ({fmtPct(weightedTotal(call.ai, criteria))}) is always kept for comparison.</p>
      <ol className="flex flex-col gap-2.5 text-ui">
        {items.length === 0 && <li className="text-fg-subtle">AI graded. No coach activity yet.</li>}
        {items.map((h, i) => (
          <li key={i} className="border-l-2 border-border pl-3">
            <b className="block">{h.action}</b>
            <small>{h.at} · {h.by}</small>
            {h.changes?.length > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-fg-muted">
                {h.changes.map((x) => <li key={x.cat}>{catName(x.cat, criteria)}: {x.from ?? '—'} → {x.to}{x.reason ? ` · "${x.reason}"` : ''}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function ContactNote({ call }) {
  const { notify } = useApp();
  const draft = draftNote(call);
  const [vals, setVals] = useState(() => Object.fromEntries(draft.fields.map((f) => [f.label, f.value])));
  const missing = draft.fields.filter((f) => !vals[f.label]);
  return (
    <Card title="Contact note" right={<Badge cls={missing.length ? 'red' : 'green'}>{missing.length ? `${missing.length} required missing` : 'Complete'}</Badge>}>
      <p className="text-xs text-fg-subtle">{ORG.cis} contact type: <b className="text-fg-muted">{draft.type}</b> · drafted by AI from the transcript</p>
      <div className="mt-3 flex flex-col gap-3">
        {draft.fields.map((f) => {
          const empty = !vals[f.label];
          return (
            <label key={f.label} className="field">
              <span className="field-label">{f.label}{empty && <em className="ml-1 font-semibold text-danger-fg not-italic">Required</em>}</span>
              <input
                value={vals[f.label]} aria-invalid={empty} aria-required="true"
                className={empty ? 'border-danger! bg-danger-soft!' : ''}
                onChange={(e) => setVals({ ...vals, [f.label]: e.target.value })}
              />
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end">
        <button className="btn btn-secondary btn-sm" disabled={missing.length > 0} onClick={() => notify(`Contact note saved to ${ORG.cis} (mock)`)}><Save size={13} aria-hidden="true" /> Save to {ORG.cis}</button>
      </div>
    </Card>
  );
}

// /grading/:agentId?call=<id>: the URL picks the agent and call; without a valid call the agent's latest opens
export default function CallGrading() {
  const { state, dispatch } = useApp();
  const { agentId } = useParams();
  const [params] = useSearchParams();
  const valid = isAgentId(agentId);
  const calls = valid ? callsFor(agentId) : [];
  const asked = callById(params.get('call'));
  const call = asked?.agentId === agentId ? asked : calls[0];
  useEffect(() => {
    if (call && state.callId !== call.id) dispatch({ type: 'call', callId: call.id });
  }, [call, state.callId, dispatch]);
  if (!valid) return <Navigate to="/grading" replace />;
  return <GradingBody key={call.id} agent={agentById(agentId)} calls={calls} call={call} />;
}

function GradingBody({ agent, calls, call }) {
  const { state, dispatch, notify, criteria } = useApp();
  const navigate = useNavigate();
  const { search } = useLocation();
  const rev = getReview(state, call);
  const conv = getConversation(call);
  const audio = useAudio(call.durSec);
  const [meta, setMeta] = useState({ reviewer: rev.reviewer || 'Sophie Laurent', reviewed: TODAY });
  const [confirm, setConfirm] = useState(null); // 'clear' | 'manual'
  const [guide, setGuide] = useState(false);
  const [q, setQ] = useState('');
  const dispute = state.disputes[call.id];
  const status = gradingStatus(state, call);
  const manual = rev.method === 'manual';
  const dev = isDev(state, call);
  const notes = reviewNotes(rev, criteria);
  const jump = (t) => { audio.seek(t); if (!audio.playing) audio.toggle(); };
  const pickList = calls.slice(0, 40).some((c) => c.id === call.id) ? calls.slice(0, 40) : [call, ...calls.slice(0, 40)];
  const lines = q ? conv.lines.filter((l) => l.text.toLowerCase().includes(q.toLowerCase())) : conv.lines;
  const field = (patch) => dispatch({ type: 'reviewField', callId: call.id, patch });

  const validate = () => {
    const missing = criteria.filter((c) => !rev.coach[c.id]);
    if (!meta.reviewer) { notify('Select a reviewer first', 'warn'); return false; }
    if (missing.length) { notify(`Score all categories first (${missing.length} missing)`, 'warn'); return false; }
    const noReason = Object.values(rev.overrides).filter((o) => !o.reason.trim()).length;
    if (noReason) { notify(`Give a reason for each changed AI score (${noReason} missing)`, 'warn'); return false; }
    return true;
  };
  const finalize = () => {
    if (!validate()) return;
    dispatch({ type: 'saveReview', callId: call.id, reviewer: meta.reviewer });
    notify(`Evaluation ${reviewId(state, call)} finalized · total ${fmtPct(weightedTotal(rev.coach, criteria))}`);
  };
  const draft = () => {
    if (!meta.reviewer) { notify('Select a reviewer first', 'warn'); return; }
    dispatch({ type: 'saveDraft', callId: call.id, reviewer: meta.reviewer });
    notify('Draft saved. It does not count in QA reporting until finalized.');
  };
  const toCoaching = () => {
    if (rev.status === 'draft') notify('Opened in Coaching. The evaluation is still a draft.', 'warn');
    navigate(workspaceLink(agent.id, [call.id]));
  };
  const setMethod = (m) => {
    if (m === rev.method) return;
    if (m === 'manual') {
      if (rev.edited) setConfirm('manual');
      else { dispatch({ type: 'startManual', callId: call.id }); notify('Manual grading: AI scores hidden'); }
    } else {
      dispatch({ type: 'applyAi', callId: call.id });
      notify('AI scores applied');
    }
  };

  return (
    <Page>
      <AgentNav agentId={agent.id} base="/grading" label="Call Grading" />
      <PageHeader
        title="Customer Interaction Grading"
        description="Evaluate and document the call using the established quality criteria."
        actions={<>
          <StatusChip status={status} />
          <button className="btn btn-ghost" onClick={() => setConfirm('clear')}>Clear form</button>
          <button className="btn btn-secondary" onClick={toCoaching}>Open in Coaching</button>
          <button className="btn btn-secondary" onClick={draft}>Save as draft</button>
          <button className="btn btn-primary" onClick={finalize}>Finalize evaluation</button>
        </>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="segmented w-full sm:w-auto" role="group" aria-label="Evaluation method">
          {[['ai', 'AI-assisted', Sparkles], ['manual', 'Manual coach grading', PenLine]].map(([m, label, Icon]) => (
            <button key={m} aria-pressed={rev.method === m} onClick={() => setMethod(m)} className="segment">
              <Icon size={13} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        <p className="text-ui text-fg-subtle">
          {manual ? 'You are grading this call independently. It will be saved as Coach Graded.' : 'Review the AI evaluation, then accept or correct each category. It will be saved as Coach Validated.'}
        </p>
      </div>

      {dev && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-muted px-4 py-3 text-ui" role="note">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>This call is under a <b>developmental (non-graded) review</b>{state.dev[call.id].requested ? ', requested by the employee' : ''}. It is excluded from the QA average.</span>
        </div>
      )}

      {dispute && dispute.status === 'Open' && (
        <div className="flex flex-col gap-3 rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-danger-fg sm:flex-row sm:items-center" role="alert">
          <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
          <span className="flex-1 text-ui"><b>{firstName(agent)} disputed {criteria.find((c) => c.id === dispute.cat)?.name || 'this score'}</b> on {dispute.date}: "{dispute.reason}"</span>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            dispatch({ type: 'saveReview', callId: call.id, reviewer: meta.reviewer });
            dispatch({ type: 'resolveDispute', callId: call.id, text: 'Re-scored after review' });
            notify('Dispute resolved; the agent can see the outcome');
          }}>Resolve with current scores</button>
        </div>
      )}

      <Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Agent">
            <input readOnly value={agent.name} />
          </Field>
          <Field label="Lead"><select defaultValue={agent.lead} key={agent.id}>{LEADS.map((l) => <option key={l}>{l}</option>)}</select></Field>
          <Field label="Reviewer">
            <select value={meta.reviewer} onChange={(e) => setMeta({ ...meta, reviewer: e.target.value })}>
              <option value="">Select reviewer</option>{REVIEWERS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Interaction type"><input readOnly value={`${call.direction} Call`} /></Field>
          <Field label="Review ID"><input readOnly value={reviewId(state, call)} /></Field>
          <Field label="Team (at time of call)">
            <select value={rev.team || agent.team} onChange={(e) => field({ team: e.target.value })}>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select>
          </Field>
          <Field label="Date of interaction"><input readOnly value={`${call.date} ${call.time}`} /></Field>
          <Field label="Date reviewed"><input value={rev.reviewed || meta.reviewed} onChange={(e) => setMeta({ ...meta, reviewed: e.target.value })} /></Field>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-[1fr_1fr_1.15fr]">
        <Card title="Call recording">
          <AudioPlayer audio={audio} duration={call.durSec} seed={Number(call.id)} compact />
          <button className="link-btn mt-3" onClick={() => notify(`Recording download started (mock, stays in ${ORG.telephony})`)}><Download size={13} aria-hidden="true" /> Download recording</button>
        </Card>
        <Card title="Call information">
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-ui">
            <dt className="text-fg-subtle"><label htmlFor="call-pick">Call ID</label></dt>
            <dd className="flex justify-end">
              <select id="call-pick" className="h-8 w-auto max-w-full text-ui" value={call.id} onChange={(e) => navigate(gradingPath(e.target.value, search), { replace: true })}>
                {pickList.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.date}</option>)}
              </select>
            </dd>
            <dt className="text-fg-subtle">Account ID</dt><dd className="text-right font-medium tabular-nums">{call.account}</dd>
            <dt className="text-fg-subtle">Duration</dt><dd className="text-right font-medium tabular-nums">{call.duration}</dd>
            <dt className="text-fg-subtle">Disposition</dt><dd className="text-right font-medium">{call.intent[0]}</dd>
            <dt className="text-fg-subtle">Customer</dt><dd className="text-right font-medium">{call.customer} · {call.customerType}</dd>
            <dt className="text-fg-subtle">Source</dt><dd className="text-right font-medium">{ORG.telephony} recording</dd>
          </dl>
        </Card>
        <Card title="Transcript" className="lg:col-span-2 2xl:col-span-1">
          <label className="relative mb-2 block">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <span className="sr-only">Search transcript</span>
            <input type="search" className="h-8 pl-8 text-ui" placeholder="Search transcript…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {lines.length ? <TranscriptList lines={lines} audio={audio} onJump={jump} /> : <p className="text-ui text-fg-subtle">No lines match "{q}".</p>}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <KeyMoments call={call} rev={rev} conv={conv} audio={audio} onJump={jump} />
        <SummaryCard call={call} rev={rev} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.75fr_1fr]">
        <div className="card-stack">
          <Matrix call={call} rev={rev} conv={conv} onJump={jump} onGuide={() => setGuide(true)} />
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title={<label htmlFor="grading-notes">Additional notes</label>} bodyClassName="flex flex-col">
              <textarea id="grading-notes" rows={4} className="flex-1" value={rev.notes} onChange={(e) => dispatch({ type: 'notes', callId: call.id, text: e.target.value })} />
            </Card>
            <Card title="Interaction tags">
              <TagEditor tags={rev.tags} onChange={(tags) => field({ tags })} />
            </Card>
          </div>
        </div>
        <div className="card-stack">
          <Card title="Highlights & strengths" tone="green" right={!manual && !rev.highlights && <small>AI-suggested</small>}>
            <EditableList label="Highlight" items={notes.highlights} onChange={(highlights) => field({ highlights })} placeholder="Add a strength" marker="marker:text-success" />
          </Card>
          <Card title="Areas of opportunity" tone="red" right={!manual && !rev.opps && <small>AI-suggested</small>}>
            <EditableList label="Opportunity" items={notes.opps} criteria={criteria} onChange={(opps) => field({ opps })} placeholder="Add an opportunity" marker="marker:text-danger" />
          </Card>
          <HistoryCard call={call} rev={rev} />
          <ContactNote call={call} />
        </div>
      </div>

      {confirm === 'clear' && (
        <Modal
          title="Clear this review?" onClose={() => setConfirm(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => { dispatch({ type: 'clearReview', callId: call.id }); setConfirm(null); notify('Form cleared'); }}>Clear form</button>
          </>}
        >
          <p className="text-sm text-fg-muted">All reviewer scores and notes for call <b className="text-fg">{call.id}</b> will be removed. AI scores are kept and can be re-applied.</p>
        </Modal>
      )}
      {confirm === 'manual' && (
        <Modal
          title="Switch to manual grading?" onClose={() => setConfirm(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => { dispatch({ type: 'startManual', callId: call.id }); setConfirm(null); notify('Manual grading: AI scores hidden'); }}>Grade manually</button>
          </>}
        >
          <p className="text-sm text-fg-muted">Your current scores are cleared and the AI scores are hidden so you can grade independently. Notes, tags and moments are kept. The original AI assessment stays on record.</p>
        </Modal>
      )}
      {guide && (
        <Modal title={`QA Scoring Guidelines · template v${state.rubric.version}`} wide onClose={() => setGuide(false)} footer={<button className="btn btn-secondary" onClick={() => setGuide(false)}>Close</button>}>
          <p className="mb-3 text-ui text-fg-subtle">AI and coaches grade against the same expectations. Maintain them in QA Template Settings.</p>
          <ul className="mb-4 flex flex-wrap gap-2">
            {SCALE.map((s) => <li key={s.v}><Badge cls={s.cls}>{s.title}</Badge> <span className="text-xs text-fg-muted">{s.text}</span></li>)}
          </ul>
          <div className="flex flex-col divide-y divide-border">
            {criteria.map((c) => (
              <section key={c.id} className="py-3">
                <h3 className="mb-1.5 text-sm font-semibold">{c.name} <small className="font-normal">· {c.weight}% · {c.binary ? '1 or 3' : '1 – 3'}</small></h3>
                <p className="mb-2 text-ui text-fg-muted">{c.def}</p>
                <Levels c={c} />
              </section>
            ))}
          </div>
        </Modal>
      )}
    </Page>
  );
}
