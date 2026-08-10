import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Pager, Spinner, Toggle } from '../components/ui';
import { useTabella, type Colonna } from '../components/tabella';
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
  difficulty?: string;
  seasons?: string[];
  active: boolean;
  /**
   * In quali settimane del ciclo è usata questa ricetta. Arriva solo quando si guarda UNA dieta,
   * perché fuori da una dieta la domanda non ha senso: la stessa ricetta serve più famiglie.
   *
   * Si legge dalle GIORNATE, non dal tag: il tag `sett:N` diceva in quale generazione la ricetta era
   * nata, e dall'11/8 lo allineiamo alle giornate proprio perché quella differenza aveva fatto
   * sembrare «tutte nella prima settimana» un catalogo distribuito su due.
   */
  settimane?: number[];
}

const SLOT: Record<string, string> = { breakfast: 'Colazione', morning_snack: 'Spuntino', lunch: 'Pranzo', afternoon_snack: 'Merenda', dinner: 'Cena' };
const METHOD: Record<string, string> = { veloce: 'Veloce', forno: 'Al forno', meal_prep: 'Meal prep' };
const DIFFICULTY: Record<string, string> = { semplice: 'Semplice', media: 'Media', elaborata: 'Elaborata' };
const SLOTS = Object.keys(SLOT);
const METHODS = Object.keys(METHOD);
const DIFFICULTIES = Object.keys(DIFFICULTY);
const SEASONS: [string, string][] = [['spring', 'Primavera'], ['summer', 'Estate'], ['autumn', 'Autunno'], ['winter', 'Inverno']];
const SEASON_LABEL: Record<string, string> = Object.fromEntries(SEASONS);
const ITALIAN_TAG = 'cucina italiana';

/** Stagioni in chiaro. Vuoto = il piatto va bene tutto l'anno (vedi modale). */
const seasonsText = (s?: string[]): string =>
  s && s.length ? SEASONS.filter(([v]) => s.includes(v)).map(([, l]) => l).join(' · ') : 'Tutto l\'anno';

interface FormMethod { type: string; stepsText: string }
interface Form {
  name: string;
  regime: string;
  mealSlot: string;
  kcal: string;
  tags: string;
  difficulty: string;
  seasons: string[];
  italian: boolean;
  ingredients: Ingredient[];
  methods: FormMethod[];
  active: boolean;
}

const emptyForm = (regime = 'omnivore'): Form => ({
  name: '', regime, mealSlot: 'lunch', kcal: '', tags: '', difficulty: 'media', seasons: [], italian: false,
  ingredients: [{ name: '', qty: null, unit: '' }],
  methods: [{ type: 'veloce', stepsText: '' }],
  active: true,
});

function toForm(r: Recipe): Form {
  const tags = r.tags ?? [];
  return {
    name: r.name, regime: r.regime, mealSlot: r.mealSlot, kcal: String(r.kcal),
    // Il tag "cucina italiana" è gestito con la checkbox dedicata: lo tolgo dal campo Tag libero.
    tags: tags.filter((t) => t.toLowerCase().trim() !== ITALIAN_TAG).join(', '),
    difficulty: r.difficulty ?? 'media',
    seasons: r.seasons ?? [],
    italian: tags.some((t) => t.toLowerCase().trim() === ITALIAN_TAG),
    ingredients: r.ingredients?.length ? r.ingredients : [{ name: '', qty: null, unit: '' }],
    methods: (r.cookingMethods ?? []).length
      ? (r.cookingMethods ?? []).map((m) => ({ type: m.type, stepsText: (m.steps ?? []).join('\n') }))
      : [{ type: 'veloce', stepsText: '' }],
    active: r.active,
  };
}

/**
 * Ogni intestazione ordina, e sotto ogni intestazione c'è il suo filtro (richiesta Simone 6/8:
 * col catalogo che cresce — la Keto-Mediterranea da sola porta centinaia di piatti — scorrere
 * l'elenco a occhio non è più un modo di lavorare).
 *
 * I FILTRI girano sul DATABASE (dal 7/8): prima si scaricavano le prime 1000 righe del regime e
 * si filtrava qui, e con le sole ricette vegetariane già oltre quel tetto significava cercare
 * dentro una fetta arbitraria del catalogo — senza dirlo. L'ordinamento resta sulle righe
 * ricevute, e ha senso perché ormai sono il risultato dei filtri, non una fetta a caso.
 * Unico filtro rimasto in memoria: il TAG (sottostringa dentro un array Postgres, che Prisma
 * non sa esprimere).
 *
 * Per questo la riga dei filtri qui è scritta a mano e non è quella di `useTabella`: i filtri di
 * colonna dell'helper lavorano sulle righe caricate, e qui devono arrivare al database. Dall'helper
 * vengono l'ordinamento, le intestazioni e la paginazione.
 */
const LIMITE_SERVER = 1000;

const emptyFilters = (regime = '') => ({
  name: '', regime, slot: '', kcalMin: '', kcalMax: '', difficulty: '', season: '', tag: '', stato: '',
  // Settimana del ciclo (11/8): ha senso solo dentro una dieta, e si filtra sulle righe ricevute
  // perché il dato arriva dalle giornate e non è una colonna del database.
  settimana: '',
});

export function Ricette({ scopeRegime, scopeDietId, scopeDietName }: { scopeRegime?: string; scopeDietId?: string; scopeDietName?: string } = {}) {
  const { permissions } = useAuth();
  const { regimes, regimeLabel } = useTaxonomy();
  const canEdit = permissions?.role === 'nutritionist' || permissions?.role === 'head_nutritionist' || permissions?.role === 'admin';
  const [rows, setRows] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null);
  const [f, setF] = useState(emptyFilters(scopeRegime ?? ''));
  // Dentro Gestione dieta si parte dalle ricette DELLA dieta aperta. Prima l'elenco era tutto il
  // regime: si vedevano i piatti di altre famiglie sotto il nome di questa dieta (segnalazione
  // Simone 6/8). L'interruttore serve quando devi pescare una ricetta nuova da aggiungere.
  const [soloDieta, setSoloDieta] = useState(true);
  const dietScope = !!scopeDietId && soloDieta;

  // Quante ricette corrispondono ai filtri IN TUTTO il catalogo (non quante ne abbiamo in mano).
  const [totale, setTotale] = useState(0);
  const [troncato, setTroncato] = useState(false);

  async function load() {
    setError(null);
    try {
      // I FILTRI VANNO SUL SERVER. Prima si scaricavano le prime 1000 righe del regime e si
      // filtrava qui: con le sole vegetariane già oltre quel tetto, filtrare voleva dire cercare
      // dentro una fetta arbitraria del catalogo. Una ricetta che c'è ma non compare è peggio di
      // un errore: chi cerca conclude che non esiste e la ricrea.
      const params = new URLSearchParams({ includeInactive: 'true' });
      if (scopeRegime) params.set('regime', scopeRegime);
      else if (f.regime) params.set('regime', f.regime);
      if (dietScope) params.set('dietId', scopeDietId as string);
      if (f.name.trim()) params.set('q', f.name.trim());
      if (f.slot) params.set('mealSlot', f.slot);
      if (f.difficulty) params.set('difficulty', f.difficulty);
      if (f.season) params.set('season', f.season);
      if (f.stato) params.set('stato', f.stato);
      if (f.kcalMin.trim()) params.set('kcalMin', f.kcalMin.trim());
      if (f.kcalMax.trim()) params.set('kcalMax', f.kcalMax.trim());
      const r = await api<{ items: Recipe[]; total: number; troncato: boolean }>(`/recipes?${params.toString()}`);
      setRows(r.items);
      setTotale(r.total);
      setTroncato(r.troncato);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata a nutrizionisti e amministratori.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  // Si ricarica a ogni cambio di filtro, con una pausa: chi scrive nel campo nome non deve
  // generare una richiesta per lettera.
  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 300);
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [scopeRegime, scopeDietId, soloDieta, f.name, f.regime, f.slot, f.difficulty, f.season, f.stato, f.kcalMin, f.kcalMax]);

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

  // Tutti gli altri filtri li ha già applicati il database. Qui resta il solo TAG: è una ricerca
  // per sottostringa dentro un array Postgres, che Prisma non sa esprimere. Sulle righe ricevute
  // va bene — e se il risultato è troncato la pagina lo dice, invece di lasciarlo credere.
  const filtrate = useMemo(() => {
    const tag = f.tag.trim().toLowerCase();
    const settimana = f.settimana.trim();
    let out = rows;
    if (tag) out = out.filter((r) => (r.tags ?? []).join(', ').toLowerCase().includes(tag));
    if (settimana) {
      const n = Number(settimana);
      out = settimana === 'nessuna'
        // Le orfane: generate e fuori dal ciclo. Vederle è il modo di sapere quanto lavoro pagato
        // sta lì senza servire a nessuna cliente.
        ? out.filter((r) => (r.settimane ?? []).length === 0)
        : out.filter((r) => (r.settimane ?? []).includes(n));
    }
    return out;
  }, [rows, f.tag, f.settimana]);

  /** Le settimane che esistono davvero in questa dieta: la tendina non offre scelte vuote. */
  const settimanePresenti = useMemo(
    () => [...new Set(rows.flatMap((r) => r.settimane ?? []))].sort((a, b) => a - b),
    [rows],
  );

  const COLONNE: Colonna<Recipe>[] = [
    { chiave: 'name', titolo: 'Nome', valore: (r) => r.name },
    { chiave: 'regime', titolo: 'Regime', valore: (r) => regimeLabel(r.regime) },
    // Il posto nella giornata, non l'etichetta: in alfabetico verrebbe «Cena, Colazione, Merenda»,
    // corretto e inutile.
    { chiave: 'mealSlot', titolo: 'Pasto', valore: (r) => SLOTS.indexOf(r.mealSlot) },
    { chiave: 'kcal', titolo: 'Kcal', valore: (r) => r.kcal },
    // Il posto nella scala (semplice → media → elaborata): in alfabetico «Elaborata» sarebbe la prima.
    { chiave: 'difficulty', titolo: 'Difficoltà', valore: (r) => DIFFICULTIES.indexOf(r.difficulty ?? 'media') },
    { chiave: 'seasons', titolo: 'Stagioni', valore: (r) => seasonsText(r.seasons) },
    { chiave: 'tags', titolo: 'Tag', valore: (r) => (r.tags ?? []).join(', ') },
    // La settimana del ciclo: solo dentro una dieta (fuori non è definita). Si ordina sulla PRIMA
    // settimana in cui compare, che è quella che conta per capire dov'è finita.
    ...(dietScope ? [{ chiave: 'settimana', titolo: 'Settimana', valore: (r: Recipe) => (r.settimane ?? [])[0] ?? null } as Colonna<Recipe>] : []),
    // Le attive prima: come etichetta «Archiviata» starebbe davanti ad «Attiva».
    { chiave: 'active', titolo: 'Stato', valore: (r) => (r.active ? 0 : 1) },
    // La colonna dei pulsanti c'è solo per chi può modificare: come la cella, sotto.
    ...(canEdit ? [{ chiave: 'azioni', titolo: '' } as Colonna<Recipe>] : []),
  ];

  // Il server manda le ricette in ordine alfabetico, ed è l'ordine con cui la pagina si apre.
  const t = useTabella(filtrate, COLONNE, { testaFissa: true, ordineIniziale: { chiave: 'name', direzione: 'asc' } });
  const filtriAttivi = JSON.stringify(f) !== JSON.stringify(emptyFilters(scopeRegime ?? ''));

  const filterCell = (node: React.ReactNode) => <th style={{ padding: '6px 8px', fontWeight: 400 }}>{node}</th>;
  const sel = { padding: '4px 6px', fontSize: 12, width: '100%' } as const;
  const inp = { padding: '4px 6px', fontSize: 12, width: '100%' } as const;

  if (loading) return <Spinner />;

  return (
    <>
      {scopeDietId && (
        <div className="spread" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`btn ${soloDieta ? '' : 'ghost'} sm`} onClick={() => setSoloDieta(true)}>
              <i className="ti ti-tools-kitchen-2" /> Solo questa dieta
            </button>
            <button className={`btn ${soloDieta ? 'ghost' : ''} sm`} onClick={() => setSoloDieta(false)}>
              <i className="ti ti-list" /> Tutto il regime{scopeRegime ? ` · ${regimeLabel(scopeRegime)}` : ''}
            </button>
          </div>
        </div>
      )}

      <div className="spread" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <span className="muted" style={{ fontSize: 13 }}>
          {/* `totale` è il conteggio VERO sul database, non quante righe abbiamo in mano. */}
          {filtriAttivi ? <><b>{t.conteggio.mostrate}</b> ricette trovate </> : <><b>{totale}</b> ricette </>}
          {filtriAttivi && (
            <button className="btn ghost sm" style={{ marginLeft: 6 }} onClick={() => { setF(emptyFilters(scopeRegime ?? '')); t.azzera(); }}>
              <i className="ti ti-filter-off" /> Azzera filtri
            </button>
          )}
        </span>
        {canEdit && <button className="btn" onClick={() => setEditing('new')}><i className="ti ti-plus" /> Nuova ricetta</button>}
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {scopeDietId && !soloDieta && (
        <Banner kind="info">
          Stai vedendo <b>tutte</b> le ricette del regime, non solo quelle di
          {scopeDietName ? <> <b>{scopeDietName}</b></> : ' questa dieta'}: le ricette non appartengono a una
          dieta, sono le giornate a richiamarle, e la stessa ricetta può stare in più famiglie.
          <b> Se ne modifichi o cancelli una, cambia ovunque venga usata.</b>
        </Banner>
      )}
      {troncato && (
        <Banner kind="info">
          I filtri girano sul catalogo intero e trovano <b>{totale}</b> ricette: qui ne vedi le prime{' '}
          {LIMITE_SERVER} in ordine alfabetico. Restringi con un filtro per arrivare a quella che cerchi
          — nessuna ricetta è nascosta, è solo un elenco lungo.
          {f.tag.trim() && <> ⚠️ Il filtro <b>Tag</b> però lavora solo su queste {LIMITE_SERVER}: per usarlo
          con sicurezza restringi prima con un altro filtro.</>}
        </Banner>
      )}

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty">
            {dietScope
              ? 'Questa dieta non ha ancora ricette nelle sue giornate. Con “Tutto il regime” vedi il catalogo da cui pescarle.'
              : 'Nessuna ricetta.'}
          </div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {/* Riga dei filtri scritta a mano: questi filtri vanno al database, non all'helper. */}
              <tr>
                {filterCell(
                  <input className="input" style={inp} placeholder="Cerca…" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />,
                )}
                {filterCell(
                  <select className="select" style={sel} value={f.regime} onChange={(e) => setF({ ...f, regime: e.target.value })} disabled={!!scopeRegime}>
                    <option value="">Tutti</option>
                    {regimes.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                  </select>,
                )}
                {filterCell(
                  <select className="select" style={sel} value={f.slot} onChange={(e) => setF({ ...f, slot: e.target.value })}>
                    <option value="">Tutti</option>
                    {SLOTS.map((s) => <option key={s} value={s}>{SLOT[s]}</option>)}
                  </select>,
                )}
                {filterCell(
                  <div className="row" style={{ gap: 4 }}>
                    <input className="input" style={{ ...inp, width: 54 }} inputMode="numeric" placeholder="min" value={f.kcalMin} onChange={(e) => setF({ ...f, kcalMin: e.target.value })} />
                    <input className="input" style={{ ...inp, width: 54 }} inputMode="numeric" placeholder="max" value={f.kcalMax} onChange={(e) => setF({ ...f, kcalMax: e.target.value })} />
                  </div>,
                )}
                {filterCell(
                  <select className="select" style={sel} value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}>
                    <option value="">Tutte</option>
                    {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY[d]}</option>)}
                  </select>,
                )}
                {filterCell(
                  <select className="select" style={sel} value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })}>
                    <option value="">Tutte</option>
                    {SEASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    <option value="none">Tutto l'anno</option>
                  </select>,
                )}
                {filterCell(
                  <input className="input" style={inp} placeholder="Cerca…" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} />,
                )}
                {dietScope && filterCell(
                  <select className="select" style={sel} value={f.settimana} onChange={(e) => setF({ ...f, settimana: e.target.value })} title="In quale settimana del ciclo è usata">
                    <option value="">Tutte</option>
                    {settimanePresenti.map((n) => <option key={n} value={String(n)}>Settimana {n}</option>)}
                    <option value="nessuna">— fuori dal ciclo —</option>
                  </select>,
                )}
                {filterCell(
                  <select className="select" style={sel} value={f.stato} onChange={(e) => setF({ ...f, stato: e.target.value })}>
                    <option value="">Tutti</option>
                    <option value="active">Attiva</option>
                    <option value="archived">Archiviata</option>
                  </select>,
                )}
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {t.conteggio.mostrate === 0 ? (
                <tr><td colSpan={(canEdit ? 9 : 8) + (dietScope ? 1 : 0)}><div className="empty" style={{ padding: '18px 0' }}>Nessuna ricetta con questi filtri.</div></td></tr>
              ) : t.pagina.map((r) => (
                <tr key={r.id} onClick={() => setEditing(r)} style={{ cursor: 'pointer' }} title="Apri la ricetta">
                  <td>{r.name}</td>
                  <td className="muted">{regimeLabel(r.regime)}</td>
                  <td className="muted">{SLOT[r.mealSlot] ?? r.mealSlot}</td>
                  <td className="muted">{r.kcal}</td>
                  <td><span className={`chip ${r.difficulty === 'semplice' ? 'green' : 'gray'}`}>{DIFFICULTY[r.difficulty ?? 'media'] ?? 'Media'}</span></td>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                    {(r.seasons ?? []).length === 0
                      ? <span style={{ opacity: 0.6 }}>Tutto l'anno</span>
                      : (r.seasons ?? []).map((s) => <span key={s} className="chip gray" style={{ marginRight: 4 }}>{SEASON_LABEL[s] ?? s}</span>)}
                  </td>
                  <td className="muted">{(r.tags ?? []).join(', ') || '—'}</td>
                  {dietScope && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {(r.settimane ?? []).length === 0
                        ? <span className="chip gray" title="Nessuna giornata la usa: è fuori dal ciclo">fuori dal ciclo</span>
                        : (r.settimane ?? []).map((n) => <span key={n} className="chip" style={{ marginRight: 4 }}>{n}</span>)}
                    </td>
                  )}
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
        <Pager {...t.pager} />
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
    const tags = f.tags.split(',').map((t) => t.trim()).filter(Boolean).filter((t) => t.toLowerCase() !== ITALIAN_TAG);
    if (f.italian) tags.push(ITALIAN_TAG);
    const body = { name: f.name.trim(), regime: f.regime, mealSlot: f.mealSlot, kcal, ingredients, cookingMethods, tags, difficulty: f.difficulty, seasons: f.seasons, active: f.active };

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
        <label><span className="muted" style={{ fontSize: 12 }}>Difficoltà</span>
          <select className="select" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}>{DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY[d]}</option>)}</select></label>
        {/* Stagionalità (voce #11): nessuna spunta = il piatto va bene tutto l'anno.
            Fuori stagione la ricetta viene penalizzata nella scelta, non esclusa. */}
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>Stagioni <span className="muted" style={{ fontWeight: 400 }}>— nessuna spunta = tutto l'anno. Fuori stagione il piatto viene proposto meno, non escluso.</span></span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
            {SEASONS.map(([val, lbl]) => {
              const on = f.seasons.includes(val);
              return (
                <button
                  type="button"
                  key={val}
                  className={on ? 'btn sm' : 'btn ghost sm'}
                  onClick={() => setF({ ...f, seasons: on ? f.seasons.filter((x) => x !== val) : [...f.seasons, val] })}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </label>
        <label style={{ gridColumn: '1 / -1' }}><span className="muted" style={{ fontSize: 12 }}>Tag (separati da virgola)</span>
          <input className="input" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="Da portare, Leggera" /></label>
        <label className="row" style={{ gridColumn: '1 / -1', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.italian} onChange={(e) => setF({ ...f, italian: e.target.checked })} />
          <span style={{ fontSize: 13 }}>Cucina italiana <span className="muted" style={{ fontSize: 11 }}>(piatto della tradizione, adatto alle clienti che vogliono ricette semplici)</span></span>
        </label>
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
