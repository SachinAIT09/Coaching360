import { useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { cx } from './ui';
import { TAG_SUGGESTIONS } from '../data/rubric';

// Editable bullet list. Items are strings, or { cat, text } when `criteria` is given (category per item).
export function EditableList({ items, onChange, criteria, placeholder, addLabel = 'Add', label, marker = 'marker:text-fg-subtle' }) {
  const [draft, setDraft] = useState('');
  const [cat, setCat] = useState(criteria?.[0]?.id || '');
  const withCat = !!criteria;
  const textOf = (x) => (withCat ? x.text : x);
  const set = (i, text) => onChange(items.map((x, j) => (j === i ? (withCat ? { ...x, text } : text) : x)));
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, withCat ? { cat, text: draft.trim() } : draft.trim()]);
    setDraft('');
  };
  return (
    <div className="flex flex-col gap-2">
      <ul className={cx('flex list-disc flex-col gap-1.5 pl-4 text-ui', marker)}>
        {items.length === 0 && <li className="list-none -ml-4 text-fg-subtle">Nothing recorded yet.</li>}
        {items.map((x, i) => (
          <li key={i}>
            <div className="flex items-start gap-1.5">
              {withCat && (
                <select className="h-8 w-32 shrink-0 text-xs" value={x.cat} aria-label={`Category for item ${i + 1}`} onChange={(e) => onChange(items.map((y, j) => (j === i ? { ...y, cat: e.target.value } : y)))}>
                  {criteria.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <textarea
                rows={1} value={textOf(x)} aria-label={`${label} ${i + 1}`}
                className="min-h-8 flex-1 resize-y py-1 text-ui"
                onChange={(e) => set(i, e.target.value)}
              />
              <button className="icon-btn shrink-0" aria-label={`Remove ${label} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 size={14} aria-hidden="true" /></button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex gap-1.5">
        {withCat && (
          <select className="h-9 w-32 shrink-0 text-xs" value={cat} onChange={(e) => setCat(e.target.value)} aria-label={`Category for new ${label}`}>
            {criteria.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <input aria-label={`New ${label}`} placeholder={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button type="button" className="btn btn-secondary shrink-0" onClick={add}><Plus size={14} aria-hidden="true" /> {addLabel}</button>
      </div>
    </div>
  );
}

// Interaction tags: removable chips plus suggestions and free text
export function TagEditor({ tags, onChange }) {
  const [draft, setDraft] = useState('');
  const add = (t) => {
    const v = t.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft('');
  };
  const suggestions = TAG_SUGGESTIONS.filter((t) => !tags.includes(t));
  return (
    <div className="flex flex-col gap-2.5">
      <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
        {tags.length === 0 && <li className="text-ui text-fg-subtle">No tags yet.</li>}
        {tags.map((t) => (
          <li key={t} className="badge bg-primary-soft text-primary-soft-fg ring-primary-border">
            {t}
            <button className="-mr-1 ml-0.5 rounded hover:bg-primary hover:text-primary-fg" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}><X size={12} aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1.5">
        <input aria-label="New tag" placeholder="Add a tag" value={draft} list="tag-suggestions" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add(draft)} />
        <datalist id="tag-suggestions">{suggestions.map((t) => <option key={t} value={t} />)}</datalist>
        <button type="button" className="btn btn-secondary shrink-0" onClick={() => add(draft)}><Plus size={14} aria-hidden="true" /> Add tag</button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 5).map((t) => <button key={t} className="chip" onClick={() => add(t)}>+ {t}</button>)}
        </div>
      )}
    </div>
  );
}

// "m:ss" ⇄ seconds
export const parseTime = (s) => {
  const m = /^(\d+):([0-5]\d)$/.exec(String(s).trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
