/**
 * ⛔ **LA FINESTRA DEGLI ALLERGENI — in un file suo dal 4/9, e non per ordine.**
 *
 * Viveva dentro `TagAllergeni.tsx`. Il 4/9 serve anche a `RecipeModal`: una ricetta appena creata
 * nasce con gli allergeni **non confermati**, e finché lo sono non può entrare in nessun paniere —
 * cioè non arriva a nessuna cliente. Chiamarla da lì importando `TagAllergeni.tsx` avrebbe chiuso
 * un **cerchio** (`TagAllergeni` importa già `RecipeModal` da `Ricette`), e un ciclo di import è la
 * specie di guasto che non si vede in sviluppo e si vede in produzione, su un modulo a caso.
 *
 * ⚠️ **E il tipo della ricetta qui è STRUTTURALE, non importato**: a questa finestra servono tre
 * campi. Importare `Recipe` da `Ricette.tsx` — anche solo come tipo — rimetterebbe in piedi la
 * dipendenza che questo file esiste per rompere.
 */
import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Spinner } from './ui';

/** I 14 allergeni UE, allineati al backend (`src/catalog/allergens.ts`). */
export const EU_ALLERGENS: { code: string; label: string }[] = [
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

interface Suggestion { allergen: string; matched: string[] }
interface SuggestResp { recipeId: string; name: string; current: string[]; reviewed: boolean; suggestions: Suggestion[] }

/** ⚠️ Solo i campi che questa finestra usa davvero: vedi il cappello sul perché non è `Recipe`. */
export interface RicettaDaTaggare { id: string; name: string; active?: boolean }

export function AllergeniModal({ recipe, onClose, onSaved }: {
  recipe: RicettaDaTaggare;
  onClose: () => void;
  onSaved: (id: string, allergens: string[]) => void;
}) {
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
            <button className="btn" onClick={confirm} disabled={busy}>{busy ? 'Salvo…' : recipe.active === false ? 'Conferma e metti in catalogo' : 'Conferma allergeni'}</button>
          </div>
        </>
      )}
    </Modal>
  );
}
