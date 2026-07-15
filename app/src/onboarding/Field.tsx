import { useState } from 'react';
import type { DateRange, Field } from './types';

interface Props {
  field: Field;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}

export default function FieldInput({ field, value, onChange }: Props) {
  const label = field.label;

  if (field.type === 'text') {
    return (
      <div className="field">
        {label && <label>{label}</label>}
        <input
          className="input"
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div className="field">
        {label && <label>{label}</label>}
        <input
          className="input"
          type="number"
          inputMode="decimal"
          min={field.min}
          max={field.max}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(field.key, e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </div>
    );
  }

  if (field.type === 'choice') {
    const opts = field.options ?? [];
    return (
      <div className="field">
        {label && <label>{label}</label>}
        <div className="opt-list">
          {opts.map((opt, i) => {
            const active = value === opt;
            return (
              <button
                type="button"
                key={String(opt)}
                className={`opt${active ? ' on' : ''}`}
                onClick={() => onChange(field.key, opt)}
              >
                <span className="opt-ind">{active && <i className="ti ti-check" />}</span>
                <span>{field.labels?.[i] ?? String(opt)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === 'multi_choice') {
    const opts = field.options ?? [];
    const arr = Array.isArray(value) ? (value as string[]) : [];
    function toggle(opt: string) {
      let next: string[];
      if (opt === 'none') {
        next = arr.includes('none') ? [] : ['none'];
      } else {
        next = arr.filter((v) => v !== 'none');
        next = next.includes(opt) ? next.filter((v) => v !== opt) : [...next, opt];
      }
      onChange(field.key, next);
    }
    return (
      <div className="field">
        {label && <label>{label}</label>}
        <div className="opt-list multi">
          {opts.map((opt, i) => {
            const active = arr.includes(String(opt));
            return (
              <button
                type="button"
                key={String(opt)}
                className={`opt${active ? ' on' : ''}`}
                onClick={() => toggle(String(opt))}
              >
                <span className="opt-ind">{active && <i className="ti ti-check" />}</span>
                <span>{field.labels?.[i] ?? String(opt)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === 'tags') {
    return <TagsInput field={field} value={value} onChange={onChange} />;
  }

  if (field.type === 'color') {
    const opts = (field.options as string[]) ?? [];
    return (
      <div className="field">
        {label && <label>{label}</label>}
        <div className="color-grid">
          {opts.map((hex) => {
            const active = value === hex;
            return (
              <button
                type="button"
                key={hex}
                className={`swatch${active ? ' active' : ''}`}
                style={{ background: hex }}
                aria-label={hex}
                onClick={() => onChange(field.key, hex)}
              >
                {active && <i className="ti ti-check" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === 'date_ranges') {
    return <DateRangesInput field={field} value={value} onChange={onChange} />;
  }

  return null;
}

function TagsInput({ field, value, onChange }: Props) {
  const [draft, setDraft] = useState('');
  const tags = Array.isArray(value) ? (value as string[]) : [];

  function add() {
    const t = draft.trim();
    if (t && !tags.includes(t)) onChange(field.key, [...tags, t]);
    setDraft('');
  }

  return (
    <div className="field">
      {field.label && <label>{field.label}</label>}
      <div className="tags-row">
        <input
          className="input"
          type="text"
          value={draft}
          placeholder="Scrivi e premi +"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="tags-add" onClick={add} aria-label="Aggiungi">
          <i className="ti ti-plus" />
        </button>
      </div>
      {tags.length > 0 && (
        <div className="tags-list">
          {tags.map((t) => (
            <span className="tag" key={t}>
              {t}
              <button type="button" onClick={() => onChange(field.key, tags.filter((x) => x !== t))} aria-label={`Togli ${t}`}>
                <i className="ti ti-x" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DateRangesInput({ field, value, onChange }: Props) {
  const ranges = Array.isArray(value) ? (value as DateRange[]) : [];

  function update(i: number, patch: Partial<DateRange>) {
    const next = ranges.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(field.key, next);
  }
  function addRange() {
    onChange(field.key, [...ranges, { start: '', end: '', label: '' }]);
  }
  function removeRange(i: number) {
    onChange(field.key, ranges.filter((_, idx) => idx !== i));
  }

  return (
    <div className="field">
      {ranges.map((r, i) => (
        <div className="card" style={{ padding: 12, marginBottom: 10 }} key={i}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input
              className="input"
              placeholder="Motivo (es. Natale, matrimonio…)"
              value={r.label ?? ''}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <button type="button" className="range-del" onClick={() => removeRange(i)} aria-label="Rimuovi periodo">
              <i className="ti ti-trash" />
            </button>
          </div>
          <div className="range-row" style={{ marginBottom: 0 }}>
            <input className="input" type="date" value={r.start} onChange={(e) => update(i, { start: e.target.value })} />
            <span className="range-sep">→</span>
            <input className="input" type="date" value={r.end} onChange={(e) => update(i, { end: e.target.value })} />
          </div>
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={addRange}>
        <i className="ti ti-plus" /> {field.label ?? 'Aggiungi periodo'}
      </button>
    </div>
  );
}
