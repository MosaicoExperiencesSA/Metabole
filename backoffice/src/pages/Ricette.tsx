import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Pager, Spinner, Toggle, usePagination } from '../components/ui';
import { useTaxonomy } from '../lib/taxonomy';

interface Ingredient { name: string; qty?: number | null; unit?: string | null }
interface CookingMethod { type: string; steps: string[] }
interface Recipe {
  id: string;
  name: string;
  regime: string;
  mealSlot: string;
  kcal: number;
  ingredients: Ingredient[];
  cookingMethods?: CookingMethod[] | null;
  tags: string[];
  active: boolean;
}

const SLOT: Record<string, string> = { breakfast: 'Colazione', morning_snack: 'Spuntino', lunch: 'Pranzo', afternoon_snack: 'Merenda', dinner: 'Cena' };
const METHOD: Record<string, string> = { veloce: 'Veloce', forno: 'Al forno', meal_prep: 'Meal prep' };
const SLOTS = Object.keys(SLOT);
const METHODS = Object.keys(METHOD);

interface FormMethod { type: string; stepsText: string }
interface Form {
  name: string;
  regime: string;
  mealSlot: string;
  kcal: string;
  tags: string;
  ingredients: Ingredient[];
  methods: FormMethod[];
  active: boolean;
}

const emptyForm = (regime = 'omnivore'): Form => ({
  name: '', regime, mealSlot: 'lunch', kcal: '', tags: '',
  ingredients: [{ name: '', qty: null, unit: '' }],
  methods: [{ type: 'veloce', stepsText: '' }],
  active: true,
});

function toForm(r: Recipe): Form {
  return {
    name: r.name, regime: r.regime, mealSlot: r.mealSlot, kcal: String(r.kcal),
    tags: (r.tags ?? []).join(', '),
    ingredients: r.ingredients?.length ? r.ingredients : [{ name: '', qty: null, unit: '' }],
    methods: (r.cookingMethods ?? []).length
      ? (r.cookingMethods ?? []).map((m) => ({ type: m.type, stepsText: (m.steps ?? []).join('\n') }))
      : [{ type: 'veloce', stepsText: '' }],
    active: r.active,
  };
}

export function Ricette({ scopeRegime }: { scopeRegime?: string } = {}) {
  const { permissions } = useAuth();
  const { regimes, regimeLabel } = useTaxonomy();
  const canEdit = permissions?.role === 'nutritionist' || permissions?.role === 'head_nutritionist' || permissions?.role === 'admin';
  const [rows, setRows] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regime, setRegime] = useState(scopeRegime ?? '');
  const [slot, setSlot] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null);

  async function load() {
    setError(null);
    try {
      const params = new URLSearchParams({ includeInactive: 'true' });
      if (regime) params.set('regime', regime);
      if (slot) params.set('mealSlot', slot);
      if (q.trim()) params.set('q', q.trim());
      setRows(await api<Recipe[]>(`/recipes?${params.toString()}`));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata a nutrizionisti e amministratori.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [regime, slot]);

  async function del(r: Recipe) {
    if (!confirm(`Eliminare la ricetta "${r.name}"?\nL'operazione non è reversibile.`)) return;
    setError(null);
    try {
      await api(`/recipes/${r.id}`, { method: 'DELETE' });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  const pg = usePagination(rows, 100);

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ width: 200 }} placeholder="Cerca per nome…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void load(); }} />
          {!scopeRegime && (
            <select className="select" style={{ width: 150 }} value={regime} onChange={(e) => setRegime(e.target.value)}>
              <option value="">Ogni regime</option>
              {regimes.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
          )}
          <select className="select" style={{ width: 150 }} value={slot} onChange={(e) => setSlot(e.target.value)}>
            <option value="">Ogni pasto</option>
            {SLOTS.map((s) => <option key={s} value={s}>{SLOT[s]}</option>)}
          </select>
        </div>
        {canEdit && <button className="btn" onClick={() => setEditing('new')}><i className="ti ti-plus" /> Nuova ricetta</button>}
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty">Nessuna ricetta.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Nome</th><th>Regime</th><th>Pasto</th><th>Kcal</th><th>Tag</th><th>Stato</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {pg.pageItems.map((r) => (
                <tr key={r.id} onClick={() => setEditing(r)} style={{ cursor: 'pointer' }} title="Apri la ricetta">
                  <td>{r.name}</td>
                  <td className="muted">{regimeLabel(r.regime)}</td>
                  <td className="muted">{SLOT[r.mealSlot] ?? r.mealSlot}</td>
                  <td className="muted">{r.kcal}</td>
                  <td className="muted">{(r.tags ?? []).join(', ') || '—'}</td>
                  <td><span className={`chip ${r.active ? '' : 'gray'}`}>{r.active ? 'Attiva' : 'Archiviata'}</span></td>
                  {canEdit && (
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setEditing(r); }}><i className="ti ti-edit" /> Modifica</button>
                        {canEdit && <button className="btn ghost sm" title="Elimina ricetta" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); del(r); }}><i className="ti ti-trash" /></button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager page={pg.page} totalPages={pg.totalPages} total={pg.total} from={pg.from} to={pg.to} onPage={pg.setPage} />
      </div>

      {editing && (
        <RecipeModal
          recipe={editing === 'new' ? null : editing}
          defaultRegime={scopeRegime}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </>
  );
}

function RecipeModal({ recipe, defaultRegime, onClose, onSaved }: { recipe: Recipe | null; defaultRegime?: string; onClose: () => void; onSaved: () => void }) {
  const { regimes } = useTaxonomy();
  const [f, setF] = useState<Form>(recipe ? toForm(recipe) : emptyForm(defaultRegime));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setIng(i: number, patch: Partial<Ingredient>) {
    setF((s) => ({ ...s, ingredients: s.ingredients.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  }
  function setMet(i: number, patch: Partial<FormMethod>) {
    setF((s) => ({ ...s, methods: s.methods.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  }

  async function save() {
    setErr(null);
    const kcal = Number(f.kcal);
    if (f.name.trim().length < 2) { setErr('Dai un nome alla ricetta.'); return; }
    if (!Number.isFinite(kcal) || kcal < 30 || kcal > 2000) { setErr('Le kcal devono essere tra 30 e 2000.'); return; }
    const ingredients = f.ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({ name: i.name.trim(), ...(i.qty != null && String(i.qty) !== '' ? { qty: Number(i.qty) } : {}), ...(i.unit?.trim() ? { unit: i.unit.trim() } : {}) }));
    if (ingredients.length === 0) { setErr('Aggiungi almeno un ingrediente.'); return; }
    const cookingMethods = f.methods
      .map((m) => ({ type: m.type, steps: m.stepsText.split('\n').map((s) => s.trim()).filter(Boolean) }))
      .filter((m) => m.steps.length > 0);
    const tags = f.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const body = { name: f.name.trim(), regime: f.regime, mealSlot: f.mealSlot, kcal, ingredients, cookingMethods, tags, active: f.active };

    setBusy(true);
    try {
      if (recipe) await api(`/recipes/${recipe.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/recipes', { method: 'POST', body: JSON.stringify(body) });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={recipe ? 'Modifica ricetta' : 'Nuova ricetta'} onClose={onClose}>
      {err && <Banner kind="err">{err}</Banner>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <label style={{ gridColumn: '1 / -1' }}><span className="muted" style={{ fontSize: 12 }}>Nome</span>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Es. Farro, pollo e verdure" /></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Regime</span>
          <select className="select" value={f.regime} onChange={(e) => setF({ ...f, regime: e.target.value })}>{regimes.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}</select></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Pasto</span>
          <select className="select" value={f.mealSlot} onChange={(e) => setF({ ...f, mealSlot: e.target.value })}>{SLOTS.map((s) => <option key={s} value={s}>{SLOT[s]}</option>)}</select></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Kcal</span>
          <input className="input" inputMode="numeric" value={f.kcal} onChange={(e) => setF({ ...f, kcal: e.target.value })} placeholder="480" /></label>
        <label style={{ gridColumn: '1 / -1' }}><span className="muted" style={{ fontSize: 12 }}>Tag (separati da virgola)</span>
          <input className="input" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="Da portare, Leggera" /></label>
      </div>

      {/* Ingredienti */}
      <div style={{ marginTop: 14 }}>
        <b style={{ fontSize: 13 }}>Ingredienti</b>
        {f.ingredients.map((ing, i) => (
          <div key={i} className="row" style={{ gap: 6, marginTop: 6 }}>
            <input className="input" style={{ flex: 2 }} placeholder="Nome" value={ing.name} onChange={(e) => setIng(i, { name: e.target.value })} />
            <input className="input" style={{ flex: 1, minWidth: 0 }} inputMode="decimal" placeholder="Qtà" value={ing.qty ?? ''} onChange={(e) => setIng(i, { qty: e.target.value === '' ? null : Number(e.target.value) })} />
            <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Unità" value={ing.unit ?? ''} onChange={(e) => setIng(i, { unit: e.target.value })} />
            <button className="btn ghost sm" title="Rimuovi" onClick={() => setF((s) => ({ ...s, ingredients: s.ingredients.filter((_, j) => j !== i) }))}><i className="ti ti-x" /></button>
          </div>
        ))}
        <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => setF((s) => ({ ...s, ingredients: [...s.ingredients, { name: '', qty: null, unit: '' }] }))}><i className="ti ti-plus" /> Ingrediente</button>
      </div>

      {/* Metodi di cottura */}
      <div style={{ marginTop: 14 }}>
        <b style={{ fontSize: 13 }}>Metodi di cottura</b>
        <p className="muted" style={{ fontSize: 11, margin: '2px 0 0' }}>Un passaggio per riga.</p>
        {f.methods.map((m, i) => (
          <div key={i} className="card" style={{ margin: '8px 0 0', padding: 10 }}>
            <div className="row" style={{ gap: 6, marginBottom: 6 }}>
              <select className="select" style={{ width: 150 }} value={m.type} onChange={(e) => setMet(i, { type: e.target.value })}>{METHODS.map((t) => <option key={t} value={t}>{METHOD[t]}</option>)}</select>
              <button className="btn ghost sm" title="Rimuovi metodo" onClick={() => setF((s) => ({ ...s, methods: s.methods.filter((_, j) => j !== i) }))}><i className="ti ti-x" /></button>
            </div>
            <textarea className="input" rows={3} placeholder={'Lessa il farro.\nSalta il pollo.\nAggiungi le verdure.'} value={m.stepsText} onChange={(e) => setMet(i, { stepsText: e.target.value })} style={{ resize: 'vertical' }} />
          </div>
        ))}
        <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => setF((s) => ({ ...s, methods: [...s.methods, { type: 'veloce', stepsText: '' }] }))}><i className="ti ti-plus" /> Metodo</button>
      </div>

      <div className="row" style={{ alignItems: 'center', gap: 8, marginTop: 14 }}>
        <Toggle on={f.active} onChange={(v) => setF({ ...f, active: v })} />
        <span style={{ fontSize: 13 }}>{f.active ? 'Attiva (disponibile nei menu)' : 'Archiviata'}</span>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={save} disabled={busy}><i className="ti ti-device-floppy" /> {busy ? 'Salvo…' : 'Salva'}</button>
      </div>
    </Modal>
  );
}
