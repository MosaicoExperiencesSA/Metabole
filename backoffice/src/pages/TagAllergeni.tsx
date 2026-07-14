import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Spinner } from '../components/ui';

// I 14 allergeni UE (allineati al backend src/catalog/allergens.ts).
const EU_ALLERGENS: { code: string; label: string }[] = [
  { code: 'glutine', label: 'Glutine' },
  { code: 'crostacei', label: 'Crostacei' },
  { code: 'uova', label: 'Uova' },
  { code: 'pesce', label: 'Pesce' },
  { code: 'arachidi', label: 'Arachidi' },
  { code: 'soia', label: 'Soia' },
  { code: 'latte', label: 'Latte e derivati' },
  { code: 'frutta_a_guscio', label: 'Frutta a guscio' },
  { code: 'sedano', label: 'Sedano' },
  { code: 'senape', label: 'Senape' },
  { code: 'sesamo', label: 'Sesamo' },
  { code: 'solfiti', label: 'Solfiti' },
  { code: 'lupini', label: 'Lupini' },
  { code: 'molluschi', label: 'Molluschi' },
];
const LABEL = new Map(EU_ALLERGENS.map((a) => [a.code, a.label]));

const MEAL: Record<string, string> = {
  breakfast: 'Colazione', morning_snack: 'Spuntino', lunch: 'Pranzo', afternoon_snack: 'Merenda', dinner: 'Cena',
};

interface Recipe {
  id: string;
  name: string;
  mealSlot: string;
  allergens?: string[];
  allergensReviewed?: boolean;
}
interface Suggestion { allergen: string; label: string; matched: string[] }
interface SuggestResp { recipeId: string; name: string; current: string[]; reviewed: boolean; suggestions: Suggestion[] }

/** Taggaggio allergeni delle ricette (R8): il nutrizionista conferma i tag (con pre-tag assistito). */
export function TagAllergeni() {
  const [rows, setRows] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [onlyTodo, setOnlyTodo] = useState(true);
  const [editing, setEditing] = useState<Recipe | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await api<Recipe[]>('/recipes?includeInactive=false'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata ai nutrizionisti.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function del(r: Recipe) {
    if (!confirm(`Eliminare la ricetta "${r.name}"?\nL'operazione non è reversibile.`)) return;
    setError(null); setNotice(null);
    try {
      await api(`/recipes/${r.id}`, { method: 'DELETE' });
      setNotice('Ricetta eliminata.');
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  const shown = useMemo(() => rows.filter((r) => (onlyTodo ? !r.allergensReviewed : true)), [rows, onlyTodo]);
  const todo = rows.filter((r) => !r.allergensReviewed).length;

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          Conferma gli allergeni di ogni ricetta. Il motore usa <b>solo</b> ricette con allergeni confermati; un prodotto non è attivabile finché tutte le sue ricette non sono confermate. <b>{todo}</b> da rivedere.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={onlyTodo} onChange={(e) => setOnlyTodo(e.target.checked)} /> Solo da rivedere
        </label>
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {shown.length === 0 ? (
          <div className="empty">{onlyTodo ? 'Tutte le ricette hanno gli allergeni confermati 🎉' : 'Nessuna ricetta.'}</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Ricetta</th>
                <th style={{ width: 110 }}>Pasto</th>
                <th>Allergeni</th>
                <th style={{ width: 120 }}>Stato</th>
                <th style={{ textAlign: 'right' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.name}</b></td>
                  <td className="muted">{MEAL[r.mealSlot] ?? r.mealSlot}</td>
                  <td className="muted">{(r.allergens ?? []).map((a) => LABEL.get(a) ?? a).join(', ') || '—'}</td>
                  <td>
                    <span className={`chip ${r.allergensReviewed ? '' : 'gray'}`}>{r.allergensReviewed ? 'Confermata' : 'Da rivedere'}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn ghost sm" onClick={() => setEditing(r)}>{r.allergensReviewed ? 'Modifica' : 'Rivedi'}</button>
                      <button className="btn ghost sm" title="Elimina ricetta" style={{ color: 'var(--danger)' }} onClick={() => del(r)}><i className="ti ti-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <TagModal
          recipe={editing}
          onClose={() => setEditing(null)}
          onSaved={(id, allergens) => {
            setRows((rs) => rs.map((x) => (x.id === id ? { ...x, allergens, allergensReviewed: true } : x)));
            setEditing(null);
            setNotice(`Allergeni di "${editing.name}" confermati.`);
          }}
        />
      )}
    </>
  );
}

function TagModal({ recipe, onClose, onSaved }: { recipe: Recipe; onClose: () => void; onSaved: (id: string, allergens: string[]) => void }) {
  const [loading, setLoading] = useState(true);
  const [suggested, setSuggested] = useState<Set<string>>(new Set());
  const [matches, setMatches] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api<SuggestResp>(`/recipes/${recipe.id}/allergen-suggestions`);
        if (!alive) return;
        const sug = new Set(r.suggestions.map((s) => s.allergen));
        setSuggested(sug);
        setMatches(Object.fromEntries(r.suggestions.map((s) => [s.allergen, s.matched])));
        // pre-selezione: allergeni già presenti ∪ suggeriti (il nutrizionista conferma/corregge)
        setSelected(new Set([...(r.current ?? []), ...sug]));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Impossibile calcolare i suggerimenti.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [recipe.id]);

  function toggle(code: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code); else n.add(code);
      return n;
    });
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const allergens = EU_ALLERGENS.map((a) => a.code).filter((c) => selected.has(c));
      await api(`/recipes/${recipe.id}/allergens`, { method: 'PATCH', body: JSON.stringify({ allergens }) });
      onSaved(recipe.id, allergens);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Allergeni — ${recipe.name}`} onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      {loading ? (
        <Spinner />
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Spunta gli allergeni presenti. Quelli con ✨ sono <b>suggeriti automaticamente</b> dagli ingredienti: controllali e conferma.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {EU_ALLERGENS.map((a) => {
              const isSug = suggested.has(a.code);
              return (
                <label key={a.code} title={matches[a.code]?.length ? `Rilevato da: ${matches[a.code].join(', ')}` : ''}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', background: isSug ? 'var(--soft,#fdf3ef)' : 'transparent' }}>
                  <input type="checkbox" checked={selected.has(a.code)} onChange={() => toggle(a.code)} />
                  <span>{a.label}{isSug && ' ✨'}</span>
                </label>
              );
            })}
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
            <button className="btn" onClick={confirm} disabled={busy}>{busy ? 'Salvo…' : 'Conferma allergeni'}</button>
          </div>
        </>
      )}
    </Modal>
  );
}
