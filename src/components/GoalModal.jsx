import { useState } from 'react';
import { Modal, Field } from './ui';
import { AGENTS, agentById } from '../data/agents';
import { BEHAVIORS, behaviorById, goalBehavior } from '../data/rubric';
import { useApp, TODAY } from '../state/AppContext';
import { fmtPct } from '../utils/score';
import { shiftUS } from '../utils/dates';

export const GOAL_STATES = ['Active', 'Achieved', 'Closed'];

// Create a goal, or edit one (`goal`). `defaults` pre-fills a new goal (e.g. from a coaching session).
// Goals target an observable behavior; the AI checks every applicable call for it from the assigned date.
export default function GoalModal({ goal, defaults = {}, sessionId, onClose, onCreated }) {
  const { dispatch, notify, metrics } = useApp();
  const editing = !!goal;
  const start = goal || { title: '', agentId: 'a1', behavior: 'emailRequest', target: 80, due: shiftUS('06/30/2025'), ...defaults };
  const [f, setF] = useState({ ...start, behavior: goalBehavior(start)?.id || 'emailRequest', state: start.state || 'Active', change: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const b = behaviorById(f.behavior);
  const measured = { cat: b.cat, metric: b.metric || 'cat' };
  const valid = f.title.trim().length > 3;
  // Baseline preview: compliance over the 30 days before the goal starts
  const preview = metrics.goal({ id: `preview-${f.agentId}`, agentId: f.agentId, team: 'Customer Service', ...measured, behavior: f.behavior, target: Number(f.target), assigned: editing ? goal.assigned : TODAY, baseline: editing ? goal.baseline : undefined });

  const save = () => {
    if (editing) {
      const { change, ...rest } = f;
      dispatch({ type: 'updateGoal', id: goal.id, patch: { ...rest, ...measured, target: Number(f.target) }, change: change.trim() || describe(goal, f) });
      notify('Goal updated');
    } else {
      const team = f.agentId === 'team' ? 'Customer Service' : undefined;
      const g = {
        id: `g${Date.now()}`, title: f.title.trim(), agentId: f.agentId, behavior: f.behavior, due: f.due, team, ...measured, target: Number(f.target), assigned: TODAY, state: 'Active',
        baseline: preview.baseline != null ? Math.round(preview.baseline) : null,
        note: sessionId ? 'Set during a coaching session.' : 'Created by supervisor.', history: [{ at: TODAY, by: 'Sophie Laurent', change: 'Goal created' }],
      };
      dispatch({ type: 'addGoal', sessionId, goal: g });
      notify(`Goal created${f.agentId === 'team' ? ' for the team' : ` for ${agentById(f.agentId).name}`}`);
      onCreated?.(g);
    }
    onClose();
  };

  return (
    <Modal
      title={editing ? 'Update goal' : sessionId ? 'Create goal from this session' : 'Create goal'} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!valid} onClick={save}>{editing ? 'Save changes' : 'Create goal'}</button>
      </>}
    >
      <Field label="Goal"><input autoFocus placeholder="e.g. Request customer email during opening" value={f.title} onChange={set('title')} /></Field>
      <Field label="Observable behavior (checked by AI on every applicable call)" className="mt-4">
        <select value={f.behavior} onChange={set('behavior')}>{BEHAVIORS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
      </Field>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Assign to">
          <select value={f.agentId} onChange={set('agentId')} disabled={editing}><option value="team">Whole team (Customer Service)</option>{AGENTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </Field>
        <Field label="Due date"><input value={f.due} onChange={set('due')} /></Field>
        <Field label={`Target: ${f.target}% of applicable calls`}><input className="mt-2" type="range" min="50" max="100" step="5" value={f.target} onChange={set('target')} /></Field>
        {editing && (
          <Field label="Status">
            <select value={f.state} onChange={set('state')}>{GOAL_STATES.map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
        )}
      </div>
      {editing && <Field label="What changed and why (saved to the goal history)" className="mt-4"><input value={f.change} onChange={set('change')} placeholder="e.g. Raised target after coaching follow-up" /></Field>}
      <p className="mt-4 rounded-lg bg-surface-muted px-3 py-2 text-ui text-fg-muted">
        Baseline: <b className="text-fg">{fmtPct(preview.baseline)}</b> of applicable calls in the 30 days before {editing ? `${goal.assigned}` : 'today'}.
        {b.naOutbound && ' Outbound callbacks are not applicable.'} {editing ? `Currently ${fmtPct(preview.pct)}.` : 'Progress is measured automatically on every call from today.'}
      </p>
    </Modal>
  );
}

function describe(before, after) {
  const out = [];
  if (Number(before.target) !== Number(after.target)) out.push(`target ${before.target}% → ${after.target}%`);
  if ((before.state || 'Active') !== after.state) out.push(`status ${before.state || 'Active'} → ${after.state}`);
  if (before.due !== after.due) out.push(`due ${before.due} → ${after.due}`);
  if (goalBehavior(before)?.id !== after.behavior) out.push('behavior changed');
  if (before.title !== after.title) out.push('title changed');
  return out.length ? `Updated ${out.join(', ')}` : 'Reviewed, no changes';
}
