import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Pager, Spinner } from '../components/ui';
import { BottoneExcel, ContatoreRighe, useTabella, type Colonna } from '../components/tabella';

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
export function TagAllergeni({ scopeRegime }: { scopeRegime?: string } = {}) {
  const [rows, setRows] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [totale, setTotale] = useState(0);
  const [troncato, setTroncato] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const qs = scopeRegime ? `/recipes?includeInactive=false&regime=${encodeURIComponent(scopeRegime)}` : '/recipes?includeInactive=false';
      // `GET /recipes` risponde `{ items, total, troncato }` da quando i filtri girano sul
      // database (7/8): prima era un array nudo.
      const r = await api<{ items: Recipe[]; total: number; troncato?: boolean }>(qs);
      setRows(r.items);
      setTotale(r.total ?? r.items.length);
      setTroncato(!!r.troncato);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata ai nutrizionisti.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [scopeRegime]);

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

  const todo = rows.filter((r) => !r.allergensReviewed).length;

  const COLONNE: Colonna<Recipe>[] = [
    { chiave: 'ricetta', titolo: 'Ricetta', valore: (r) => r.name, filtro: 'testo' },
    { chiave: 'pasto', titolo: 'Pasto', valore: (r) => MEAL[r.mealSlot] ?? r.mealSlot, filtro: 'scelta', etichettaTutti: 'Tutti', stile: { width: 110 } },
    { chiave: 'allergeni', titolo: 'Allergeni', valore: (r) => (r.allergens ?? []).map((a) => LABEL.get(a) ?? a).join(', '), filtro: 'testo' },
    // «Da rivedere» prima di «Confermata»: è l'ordine del lavoro, non dell'alfabeto.
    { chiave: 'stato', titolo: 'Stato', valore: (r) => (r.allergensReviewed ? 'Confermata' : 'Da rivedere'), filtro: 'scelta', etichettaTutti: 'Tutti', ordineScelte: ['Da rivedere', 'Confermata'], stile: { width: 120 } },
    { chiave: 'azioni', titolo: 'Azioni', stile: { textAlign: 'right' } },
  ];

  /**
   * La pagina si apre su «Da rivedere», che è il lavoro da fare, ma il filtro è **uno**: la colonna
   * Stato. Prima c'era anche una spunta «Solo da rivedere» sopra la tabella, cioè due controlli
   * sullo stesso dato: con la spunta attiva la tendina della colonna offriva una voce sola, e chi
   * la usava non capiva perché non cambiasse niente. «Azzera filtri» apre a tutte le ricette.
   */
  const t = useTabella(rows, COLONNE, { testaFissa: true,
    ordineIniziale: { chiave: 'ricetta' },
    filtriIniziali: { stato: 'Da rivedere' },
    nomeExcel: 'Allergeni ricette',
  });

  // Come nel catalogo ricette: se il server ha mandato solo le prime righe, il file lo dice prima
  // di scaricarsi, invece di sembrare l'elenco completo una volta aperto. Il numero da dire è
  // quello che esce davvero: questa scheda si apre già filtrata su «Da rivedere», quindi le righe
  // esportate sono quasi sempre molte meno di quelle ricevute.
  const avvisoExport = troncato
    ? `Il catalogo ha ${totale} ricette e questa pagina ne ha ricevute solo le prime ${rows.length}.\n\nIl file conterrà le ${t.conteggio.mostrate} righe che vedi, scelte fra quelle ${rows.length} — non fra tutte e ${totale}.\n\nScarico lo stesso?`
    : undefined;

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          Conferma gli allergeni di ogni ricetta. Il motore usa <b>solo</b> ricette con allergeni confermati; un prodotto non è attivabile finché tutte le sue ricette non sono confermate. <b>{todo}</b> da rivedere.
        </p>
      </div>

      <div className="spread" style={{ marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="ricette" />
          <BottoneExcel tabella={t} avviso={avvisoExport} />
        </div>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Cerca in tutte le colonne…"
          value={t.ricerca}
          onChange={(e) => t.setRicerca(e.target.value)}
        />
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {troncato && (
        <Banner kind="info">
          Il catalogo ha <b>{totale}</b> ricette e il server ne manda le prime <b>{rows.length}</b> in ordine
          alfabetico: i filtri di questa tabella cercano solo fra queste. Una ricetta oltre l'elenco non
          compare nemmeno filtrando — non vuol dire che non ci sia.
        </Banner>
      )}

      <div className="card" style={{ padding: 0 }}>

        {/* Selettore di pagina anche sopra: stessa richiesta dell'11/8 sul catalogo ricette —

            su una tabella lunga cambiare pagina non deve costare due scorrimenti interi. */}

        <Pager {...t.pager} sopra />
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">
            {rows.length === 0
              ? 'Nessuna ricetta.'
              : todo === 0 && t.filtri.stato === 'Da rivedere'
                ? 'Tutte le ricette hanno gli allergeni confermati 🎉'
                : 'Nessuna ricetta con questi filtri.'}
          </div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((r) => (
                <tr key={r.id} onClick={() => setEditing(r)} style={{ cursor: 'pointer' }} title="Apri la revisione allergeni">
                  <td><b>{r.name}</b></td>
                  <td className="muted">{MEAL[r.mealSlot] ?? r.mealSlot}</td>
                  <td className="muted">{(r.allergens ?? []).map((a) => LABEL.get(a) ?? a).join(', ') || '—'}</td>
                  <td>
                    <span className={`chip ${r.allergensReviewed ? '' : 'gray'}`}>{r.allergensReviewed ? 'Confermata' : 'Da rivedere'}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>{r.allergensReviewed ? 'Modifica' : 'Rivedi'}</button>
                      <button className="btn ghost sm" title="Elimina ricetta" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); del(r); }}><i className="ti ti-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager {...t.pager} />
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
