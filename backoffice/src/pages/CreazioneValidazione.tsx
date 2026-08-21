import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';
import { useTaxonomy } from '../lib/taxonomy';
import { useAuth } from '../auth/AuthContext';

type Preset = {
  id: string; style: string; label: string; description?: string | null;
  regime?: string | null; objective?: string | null; meals?: string | null; rules?: Record<string, unknown> | null;
  clinicalNotes?: string | null; suggested?: boolean;
};
type Family = { key: string; label: string; style: string; suggested: boolean; variants: Preset[] };
type ReviewStatus = {
  dietId: string; name: string; status: string; mealsPerDay: number;
  recipes: { total: number; active: number; allergensReviewed: number };
  days: { total: number; complete: number };
  groups: { total: number; approved: number };
};

const LS_DIET = 'metabole_bo_wizard_diet';
/**
 * La VARIANTE su cui si stava lavorando, ricordata fra una sessione e l'altra.
 *
 * Senza, cliccando sulla famiglia si ripartiva da `variants[0]` — la prima che tornava dal
 * server, cioè una a caso. Il nutrizionista che aveva finito le dodici settimane di
 * «onnivora · dimagrimento · 5 pasti», usciva e rientrava, si ritrovava davanti le settimane
 * 1-4 di «vegana · mantenimento · 3 pasti» tutte in giallo e pensava di aver perso il lavoro.
 * Non aveva perso niente: stava guardando un'altra dieta con lo stesso nome.
 */
const LS_PRESET = 'metabole_bo_wizard_preset';
const OBIETTIVI = [{ v: 'dimagrimento', l: 'Dimagrimento' }, { v: 'mantenimento', l: 'Mantenimento' }];
// Terza dimensione delle varianti: struttura pasti (3/5 o digiuno intermittente 16:8).
const PASTI = [{ v: '3', l: '3 pasti' }, { v: '5', l: '5 pasti' }, { v: 'fasting', l: 'Digiuno intermittente' }];
const SLOT_LABEL: Record<string, string> = { breakfast: 'Colazione', morning_snack: 'Spuntino', lunch: 'Pranzo', afternoon_snack: 'Merenda', dinner: 'Cena' };

/**
 * Pagina guidata Creazione e validazione: dal preset suggerito → generazione bozza →
 * validazione passo-passo (avanzamento automatico) → invio in revisione. A fine lavori
 * la pagina si azzera. Le altre pagine (catalogo, regole, ecc.) restano.
 */
export function CreazioneValidazione() {
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const { regimes } = useTaxonomy();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ label: '', style: '', regimes: ['omnivore'], objectives: ['dimagrimento'], meals: ['5'], clinicalNotes: '', kcalTarget: 1500, proteinMin: 20, proteinMax: 35, kcalTol: 15 });
  const [sourceRules, setSourceRules] = useState<Record<string, unknown>>({});
  const [activePresetId, setActivePresetIdRaw] = useState<string | null>(() => { try { return localStorage.getItem(LS_PRESET); } catch { return null; } });
  // Ogni cambio di variante si ricorda: è l'unico modo perché «riapro la pagina domani» torni
  // sulla stessa dieta invece che su una sorella scelta dall'ordine del database.
  const setActivePresetId = (id: string | null) => {
    setActivePresetIdRaw(id);
    try { if (id) localStorage.setItem(LS_PRESET, id); else localStorage.removeItem(LS_PRESET); } catch { /* no-op */ }
  };
  const [activeFamilyKey, setActiveFamilyKey] = useState<string | null>(null);
  const [genAll, setGenAll] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [famBusy, setFamBusy] = useState(false);
  const [famMsg, setFamMsg] = useState<string | null>(null);
  // Barra di avanzamento per le lavorazioni lunghe (genera tutte / valida e pubblica tutte).
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  // `busy` è condiviso da sette operazioni della pagina (archivia, elimina, salva, valida,
  // pubblica, anteprima…). Legare a `busy` la barra del passo 2 significava scrivere «Sto
  // generando ricette…» mentre il nutrizionista sta archiviando una variante: si aspetta
  // per niente, o peggio crede sia partita una generazione. Qui serve uno stato suo.
  const [generando, setGenerando] = useState(false);
  /**
   * L'ESITO DELLA GENERAZIONE, MOSTRATO DOVE STA IL PULSANTE.
   *
   * Difetto trovato il 12/8, e la segnalazione è stata «ho cliccato ma non ha generato nulla»: i due
   * riquadri di esito (`notice` ed `error`) stanno in cima alla pagina, il pulsante Genera trecento
   * righe più sotto. Chi lancia una lavorazione da quattro minuti vede la barra partire, vede la barra
   * finire, e la risposta gli arriva **fuori dallo schermo** — quindi legge «non è successo niente» su
   * un'operazione che invece ha detto una cosa precisa.
   *
   * Un esito serve dove è stata presa la decisione. Questo stato è solo della generazione, così sotto
   * il pulsante non compaiono i messaggi di «dieta salvata» o «variante archiviata».
   */
  const [esitoGen, setEsitoGen] = useState<{ tipo: 'ok' | 'err'; testo: string } | null>(null);

  /**
   * SETTIMANA da generare. Prima qui c'era «giorni da generare» con default 28, e sembrava
   * dire «fammi 28 giornate diverse». Non era così: il generatore produceva 5 ricette per
   * pasto e le ricombinava, quindi la stessa colazione tornava cinque o sei volte nel mese.
   * Ora si genera una settimana per volta — 7 giorni con 7 ricette nuove per ogni pasto — e
   * la pagina propone sempre la prossima.
   */
  const [week, setWeek] = useState(1);
  /** Settimane già in catalogo per la variante scelta (per proporre la prossima). */
  const [weeksDone, setWeeksDone] = useState<number | null>(null);
  /**
   * Numeri delle settimane MAGRE: hanno le giornate ma non i piatti. Il conteggio è per
   * settimana e non globale — misurare «piatti totali diviso sette» dava il risultato
   * rovesciato, marcando piene le prime (fatte ricombinando 5 ricette) e magre proprio quelle
   * appena generate con 7 piatti nuovi.
   */
  const [weeksThin, setWeeksThin] = useState<number[]>([]);
  const [ricettePerPasto, setRicettePerPasto] = useState<number | null>(null);
  /**
   * Su una settimana che esiste già, il comportamento normale è COMPLETARLA: le ricette che ci
   * sono restano (comprese quelle corrette a mano dal nutrizionista) e si genera solo quel che
   * manca. Buttare e rifare cancella quel lavoro, quindi si sceglie apposta con questa spunta.
   */
  const [rifaiDaCapo, setRifaiDaCapo] = useState(false);
  const [dietId, setDietId] = useState<string | null>(() => { try { return localStorage.getItem(LS_DIET); } catch { return null; } });
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const isResponsabile = user?.role === 'head_nutritionist'; // il capo pubblica direttamente
  const [preview, setPreview] = useState<{ dayIndex: number; meals: { slot: string; recipe: string; kcal: number }[] }[] | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    api<Preset[]>('/engine-rules/presets').then(setPresets).catch((e) => { setPresets([]); setError(e instanceof Error ? e.message : 'Caricamento diete non riuscito.'); });
  }, []);
  // Quante settimane ha già la variante scelta: la pagina propone la prossima da generare,
  // così il nutrizionista non deve ricordarselo a mente variante per variante.
  useEffect(() => {
    if (!activePresetId) { setWeeksDone(null); setWeek(1); return; }
    let vivo = true;
    // Con la spunta «genera tutte le 18 varianti» la striscia deve rispondere per TUTTO il
    // gruppo: se una settimana è verde sulla variante attiva ma magra su una sorella, le
    // clienti di quella sorella ricevono un menu che si ripete — e nessuno lo vede.
    api<{ settimane: number; settimaneMagre?: number[]; ricettePerPasto?: number }>(
      `/engine-rules/presets/${activePresetId}/weeks${genAll ? '?famiglia=1' : ''}`,
    )
      .then((r) => {
        if (!vivo) return;
        const magre = r.settimaneMagre ?? [];
        setWeeksDone(r.settimane);
        setWeeksThin(magre);
        setRicettePerPasto(r.ricettePerPasto ?? null);
        // Si riparte dalla prima settimana MAGRA: è il menu che le clienti stanno ricevendo
        // adesso. Solo se non ce ne sono si passa alla prima settimana nuova.
        setWeek(Math.min(12, magre.length ? magre[0] : r.settimane + 1));
        setRifaiDaCapo(false);
      })
      .catch(() => { if (vivo) { setWeeksDone(null); setWeeksThin([]); setRicettePerPasto(null); setWeek(1); } });
    return () => { vivo = false; };
  }, [activePresetId, genAll]);

  useEffect(() => {
    setShowPreview(false); setPreview(null);
    if (!dietId) { setStatus(null); return; }
    api<ReviewStatus>(`/engine-rules/diets/${dietId}/review-status`).then(setStatus).catch(() => setStatus(null));
  }, [dietId]);

  // Una "famiglia" = diete con stesso nome+stile: le varianti (regime × obiettivo × pasti) stanno insieme.
  const familyKeyOf = (label: string, style: string) => `${label}\u0000${style}`;
  const comboKeyOf = (regime: string, objective: string, meals: string) => `${regime}\u0000${objective}\u0000${meals}`;
  const objLabel = (code: string) => OBIETTIVI.find((o) => o.v === code)?.l ?? code;
  const mealLabel = (code: string) => PASTI.find((m) => m.v === code)?.l ?? `${code} pasti`;
  /**
   * ⛔ **UNA FAMIGLIA DI DIGIUNO HA DUE STRUTTURE, NON UNA** (Simone, 21/8).
   *
   * Qui c'era scritto che «le varianti 3/5 pasti non hanno senso» su una famiglia di digiuno, e i
   * tre pulsanti erano tutti bloccati tranne `fasting`. Era vero finché il digiuno voleva dire una
   * finestra sola. **Da quando la cliente sposta il suo orologio non lo è più**: la 14:10 le promette
   * quattro pasti, colazione compresa, e il catalogo `fasting` (pranzo, merenda, cena) la colazione
   * non ce l'ha. Il motore, in quel caso, chiede la struttura da **5 pasti** — è
   * `strutturaPerFinestra` nel backend a chiederla, non una preferenza di chi crea.
   *
   * ⚠️ Risultato prima di oggi: il rimedio esisteva, era scritto nella diagnostica, e **non era
   * raggiungibile da nessuna schermata**. Una cliente vera riceveva una dieta senza colazione e
   * l'unica strada era uno script.
   *
   * ## ⛔ I 3 pasti restano bloccati, e non è una dimenticanza
   *
   * Il motore per una famiglia di digiuno chiede **solo** due strutture: `fasting` e 5 pasti. La
   * struttura a 3 non la chiede mai — generarla vorrebbe dire varianti che nessuno servirà, e che
   * intanto si possono agganciare a una cliente uscita dal digiuno che si porta dietro il nome della
   * famiglia. Si sblocca quello che serve, non tutto.
   *
   * ⚠️ Il riconoscimento resta **sul nome**, che è fragile e lo era già: una dieta chiamata
   * «Mediterranea 16:8» finisce qui dentro senza essere niente del genere. Non lo cambio oggi perché
   * è un'altra decisione — ma sta scritto, invece che lasciato credere solido.
   */
  const isFastingFamily = /digiuno|intermittent|16\s*:?\s*8/i.test(form.label);
  /** Le strutture che una famiglia di digiuno può avere: la sua, e i 5 pasti per la 14:10. */
  const STRUTTURE_DIGIUNO = ['fasting', '5'];
  const strutturaAmmessa = (v: string) => !isFastingFamily || STRUTTURE_DIGIUNO.includes(v);
  const families: Family[] = (() => {
    const map = new Map<string, Family>();
    for (const p of presets ?? []) {
      const key = familyKeyOf(p.label, p.style);
      let fam = map.get(key);
      if (!fam) { fam = { key, label: p.label, style: p.style, suggested: !!p.suggested, variants: [] }; map.set(key, fam); }
      fam.variants.push(p);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'it'));
  })();
  const targetFamily = families.find((f) => f.key === familyKeyOf(form.label.trim(), form.style || 'custom')) ?? null;
  const activeFamily = families.find((f) => f.key === activeFamilyKey) ?? null;
  const existingCombos = new Set((targetFamily?.variants ?? []).map((v) => comboKeyOf((v.regime as string) || 'omnivore', (v.objective as string) || 'dimagrimento', (v.meals as string) || '5')));
  const regLabelOf = (code: string) => regimes.find((r) => r.code === code)?.label ?? code;

  /**
   * SINCRONIZZA le spunte del passo 1 con la variante su cui si genera.
   *
   * Erano due stati indipendenti che sullo schermo sembravano lo stesso: le spunte
   * (regime × obiettivo × pasti) servono a CREARE varianti nuove, mentre la generazione lavora
   * sulla variante SELEZIONATA. Si poteva quindi avere «Vegetariana · Dimagrimento · 5 pasti»
   * spuntato e generare su «Vegana · Mantenimento · 3 pasti» — che è esattamente quello che è
   * successo l'8/8: cinque settimane di lavoro finite sulla variante sbagliata, senza un errore.
   *
   * Regola: se le spunte individuano UNA sola combinazione e quella combinazione esiste già,
   * diventa quella attiva. Se le combinazioni spuntate sono più d'una siamo in modalità
   * "creazione/genera tutte" e non si tocca niente — ma il riquadro del passo 2 lo dice.
   */
  useEffect(() => {
    if (!targetFamily) return;
    const selMeals = form.meals.filter(strutturaAmmessa);
    const combos: { r: string; o: string; m: string }[] = [];
    for (const r of form.regimes) for (const o of form.objectives) for (const m of selMeals) combos.push({ r, o, m });
    if (combos.length !== 1) return;
    const c = combos[0];
    const trovata = targetFamily.variants.find(
      (v) => ((v.regime as string) || 'omnivore') === c.r
        && ((v.objective as string) || 'dimagrimento') === c.o
        && ((v.meals as string) || '5') === c.m,
    );
    if (trovata && trovata.id !== activePresetId) {
      setActivePresetId(trovata.id);
      setActiveFamilyKey(targetFamily.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.regimes, form.objectives, form.meals, targetFamily?.key, presets]);

  /**
   * RIPRENDE il lavoro dove l'aveva lasciato: al caricamento della pagina, se c'è una variante
   * ricordata, riapre la sua famiglia. Senza, la variante restava in memoria ma sullo schermo
   * non c'era niente di selezionato, e il primo clic sulla famiglia ripartiva da capo.
   */
  useEffect(() => {
    if (!presets || presets.length === 0) return;
    if (activeFamilyKey) return;
    let ricordata: string | null = null;
    try { ricordata = localStorage.getItem(LS_PRESET); } catch { /* no-op */ }
    if (!ricordata) return;
    const p = presets.find((x) => x.id === ricordata);
    if (!p) return;
    const fam = families.find((f) => f.key === familyKeyOf(p.label, p.style));
    if (fam) pickFamily(fam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets]);

  // Stato di TUTTE le varianti generate della famiglia attiva (per il passo 3):
  // una riga per dieta generata con "pronta" (tutti i passi ok) e "pubblicata".
  type FamVariant = { dietId: string; regime: string; objective: string; meals: string; status: string; ready: boolean };
  const [famVariants, setFamVariants] = useState<FamVariant[]>([]);

  async function loadFamilyStatuses(fam?: Family | null) {
    const f = fam ?? activeFamily;
    if (!f) { setFamVariants([]); return; }
    try {
      const all = await api<{ id: string; name: string; regime: string; style: string; objective?: string | null; mealsPerDay?: number; fasting?: boolean; status: string }[]>('/diets');
      const diets = (all ?? []).filter((d) => d.name === f.label && d.style === f.style);
      const out: FamVariant[] = [];
      for (const d of diets) {
        let ready = false;
        try {
          const s = await api<ReviewStatus>(`/engine-rules/diets/${d.id}/review-status`);
          ready = s.recipes.total > 0 && s.recipes.active === s.recipes.total
            && s.recipes.allergensReviewed === s.recipes.total
            && s.days.total > 0 && s.days.complete === s.days.total
            && (s.groups.total === 0 || s.groups.approved === s.groups.total);
        } catch { /* resta false */ }
        out.push({ dietId: d.id, regime: d.regime, objective: (d.objective as string) || 'dimagrimento', meals: d.fasting ? 'fasting' : String(d.mealsPerDay ?? 5), status: d.status, ready });
      }
      out.sort((a, b) => regLabelOf(a.regime).localeCompare(regLabelOf(b.regime), 'it') || a.objective.localeCompare(b.objective) || a.meals.localeCompare(b.meals));
      setFamVariants(out);
    } catch { setFamVariants([]); }
  }

  /**
   * SCEGLIE DA SOLA una variante su cui aprire il passo 3.
   *
   * Il passo 3 lavora sulla variante selezionata (`dietId`). Dopo una pubblicazione — o
   * semplicemente rientrando in pagina — `dietId` è nullo, e il passo 3 spariva dietro
   * «Genera un catalogo per iniziare la validazione guidata» anche con diciotto varianti
   * elencate lì sopra: sullo schermo sembrava che la validazione fosse sparita.
   * Se la famiglia ha varianti, se ne apre una: la prima con dei passi ancora da fare
   * (è quella che ha bisogno di attenzione), altrimenti la prima non archiviata.
   */
  useEffect(() => {
    if (famVariants.length === 0) return;
    if (dietId && famVariants.some((v) => v.dietId === dietId)) return;
    const vive = famVariants.filter((v) => v.status !== 'rejected');
    const scelta = vive.find((v) => !v.ready) ?? vive[0] ?? famVariants[0];
    if (!scelta) return;
    try { localStorage.setItem(LS_DIET, scelta.dietId); } catch { /* no-op */ }
    setDietId(scelta.dietId);
  }, [famVariants, dietId]);

  // Archivia una variante GENERATA (es. il 3-pasti creato per errore in una famiglia
  // digiuno): esce dai menu e dallo schermo 16 senza cancellarla (recuperabile). Così il
  // catalogo resta allineato a ciò che c'è nel generatore.
  async function archiveVariant(v: FamVariant) {
    const tag = `${regLabelOf(v.regime)} · ${objLabel(v.objective)} · ${mealLabel(v.meals)}`;
    // eslint-disable-next-line no-alert
    if (!confirm(`Archiviare la variante ${tag}?\nUscirà dai menu e dallo schermo 16 (recuperabile ripubblicandola dal Catalogo diete).`)) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await api(`/diets/${v.dietId}/archive`, { method: 'POST', body: JSON.stringify({}) });
      if (dietId === v.dietId) { try { localStorage.removeItem(LS_DIET); } catch { /* no-op */ } setDietId(null); }
      await loadFamilyStatuses();
      setNotice(`Variante archiviata: ${tag}.`);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Archiviazione non riuscita.'); }
    finally { setBusy(false); }
  }

  useEffect(() => { void loadFamilyStatuses(); }, [activeFamilyKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Quale variante aprire quando si clicca su una famiglia.
   *
   * Non `variants[0]`: quello è l'ordine con cui il database le restituisce, cioè il caso.
   * Prima quella su cui si stava lavorando (se è di questa famiglia), poi la "maestra"
   * — onnivora · dimagrimento · 5 pasti — che è quella da cui le altre riusano i piatti e
   * quindi quella da cui ha senso partire. Solo in ultima istanza la prima dell'elenco.
   */
  function variantePreferita(fam: Family): Preset {
    let ricordata: string | null = null;
    try { ricordata = localStorage.getItem(LS_PRESET); } catch { /* no-op */ }
    return (
      fam.variants.find((v) => v.id === ricordata)
      ?? fam.variants.find((v) =>
        ((v.regime as string) || 'omnivore') === 'omnivore'
        && ((v.objective as string) || 'dimagrimento') === 'dimagrimento'
        && ((v.meals as string) || '5') === '5')
      ?? fam.variants[0]
    );
  }

  function pickFamily(fam: Family) {
    const p = variantePreferita(fam);
    const r = (p.rules as Record<string, unknown>) || {};
    setForm({
      label: fam.label, style: fam.style,
      regimes: [...new Set(fam.variants.map((v) => (v.regime as string) || 'omnivore'))],
      objectives: [...new Set(fam.variants.map((v) => (v.objective as string) || 'dimagrimento'))],
      meals: [...new Set(fam.variants.map((v) => (v.meals as string) || '5'))],
      clinicalNotes: p.clinicalNotes || '',
      kcalTarget: Math.round(Number(r.menu_daycombo_kcal_target ?? 1500)) || 1500,
      proteinMin: Math.round(Number(r.menu_daycombo_protein_min ?? 0.2) * 100),
      proteinMax: Math.round(Number(r.menu_daycombo_protein_max ?? 0.35) * 100),
      kcalTol: Math.round(Number(r.menu_kcal_balance_tolerance_pct ?? 15)),
    });
    setSourceRules(r);
    setActivePresetId(p.id); setActiveFamilyKey(fam.key); setGenAll(false);
    setDirty(false); setNotice(null); setError(null);
  }

  async function deleteFamily(fam: Family) {
    // Controlla se esistono diete GIÀ GENERATE da queste varianti (match per nome + regime).
    let generated = 0;
    try {
      const diets = await api<{ id: string; name: string; regime: string }[]>('/diets');
      const regs = new Set(fam.variants.map((v) => (v.regime as string) || 'omnivore'));
      generated = (diets ?? []).filter((d) => d.name === fam.label && regs.has(d.regime)).length;
    } catch { /* soft: se non riesco a controllare, avviso generico sotto */ }
    const warn = generated > 0
      ? `\n\n⚠️ ATTENZIONE: risultano ${generated} dieta/e GIÀ GENERATA/E da queste varianti. Le definizioni e le diete generate sono separate: dopo aver eliminato qui, elimina quelle diete anche da "Catalogo diete".`
      : '\nSe avevi già generato il catalogo, la dieta generata va eliminata a parte da Catalogo diete.';
    // eslint-disable-next-line no-alert
    if (!confirm(`Eliminare la dieta "${fam.label}" e le sue ${fam.variants.length} variante/i?${warn}`)) return;
    setBusy(true); setError(null);
    try {
      for (const v of fam.variants) await api(`/engine-rules/presets/${v.id}`, { method: 'DELETE' });
      const ids = new Set(fam.variants.map((v) => v.id));
      setPresets((ps) => (ps ?? []).filter((p) => !ids.has(p.id)));
      if (activeFamilyKey === fam.key) { setActiveFamilyKey(null); setActivePresetId(null); setDirty(false); setForm((f) => ({ ...f, label: '', regimes: ['omnivore'], objectives: ['dimagrimento'], meals: ['5'] })); }
      setNotice(`Eliminata "${fam.label}".`);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Eliminazione non riuscita.'); }
    finally { setBusy(false); }
  }

  function newPreset() {
    setForm({ label: '', style: 'custom', regimes: ['omnivore'], objectives: ['dimagrimento'], meals: ['5'], clinicalNotes: '', kcalTarget: 1500, proteinMin: 20, proteinMax: 35, kcalTol: 15 });
    setSourceRules({}); setActivePresetId(null); setActiveFamilyKey(null); setGenAll(false); setDirty(true); setNotice(null); setError(null);
  }
  function edit(k: 'label' | 'style' | 'clinicalNotes', v: string) { setForm((f) => ({ ...f, [k]: v })); setDirty(true); }
  function editNum(k: 'kcalTarget' | 'proteinMin' | 'proteinMax' | 'kcalTol', v: number) { setForm((f) => ({ ...f, [k]: v })); setDirty(true); }
  function toggleRegime(code: string) {
    setForm((f) => ({ ...f, regimes: f.regimes.includes(code) ? f.regimes.filter((c) => c !== code) : [...f.regimes, code] }));
    setDirty(true);
  }
  function toggleObjective(code: string) {
    setForm((f) => ({ ...f, objectives: f.objectives.includes(code) ? f.objectives.filter((c) => c !== code) : [...f.objectives, code] }));
    setDirty(true);
  }
  function toggleMeal(code: string) {
    // ⚠️ Su una famiglia di digiuno si può scegliere `fasting` e `5` (la 14:10 promette la
    // colazione): i 3 pasti no, il motore non li chiede mai. Vedi la nota su `STRUTTURE_DIGIUNO`.
    if (!strutturaAmmessa(code)) return;
    setForm((f) => ({ ...f, meals: f.meals.includes(code) ? f.meals.filter((c) => c !== code) : [...f.meals, code] }));
    setDirty(true);
  }

  async function saveAsNew() {
    if (!form.label.trim()) { setError('Dai un nome alla dieta.'); return; }
    if (form.regimes.length === 0) { setError('Seleziona almeno un regime.'); return; }
    if (form.objectives.length === 0) { setError('Seleziona almeno un obiettivo.'); return; }
    if (form.meals.length === 0) { setError('Seleziona almeno una struttura pasti (3, 5 o digiuno).'); return; }
    const regLabel = (code: string) => regimes.find((r) => r.code === code)?.label ?? code;
    // ⚠️ Difesa: si genera solo quello che è ammesso, anche se lo stato contenesse altro.
    const effMeals = form.meals.filter(strutturaAmmessa);
    if (effMeals.length === 0) { setError('Su una dieta a digiuno intermittente si generano solo la struttura digiuno e i 5 pasti.'); return; }
    // Prodotto cartesiano regime × obiettivo × pasti, saltando le combinazioni già presenti
    // (INTEGRA: le varianti esistenti non si toccano, si aggiungono solo le mancanti).
    const combos: { regime: string; objective: string; meals: string }[] = [];
    for (const rc of form.regimes) for (const oc of form.objectives) for (const mc of effMeals) {
      if (!existingCombos.has(comboKeyOf(rc, oc, mc))) combos.push({ regime: rc, objective: oc, meals: mc });
    }
    if (combos.length === 0) { setNotice('Tutte le combinazioni regime × obiettivo × pasti selezionate esistono già in questa dieta.'); setDirty(false); return; }
    setBusy(true); setError(null);
    try {
      const rules = { ...sourceRules, menu_daycombo_kcal_target: form.kcalTarget, menu_daycombo_protein_min: form.proteinMin / 100, menu_daycombo_protein_max: form.proteinMax / 100, menu_kcal_balance_tolerance_pct: form.kcalTol };
      const createdList: Preset[] = [];
      // Stesso nome e stile per tutte le varianti: le distinguono regime, obiettivo e pasti (niente suffisso).
      for (const c of combos) {
        const created = await api<Preset>('/engine-rules/presets', { method: 'POST', body: JSON.stringify({
          label: form.label.trim(), style: form.style || 'custom', regime: c.regime, objective: c.objective, meals: c.meals,
          clinicalNotes: form.clinicalNotes || undefined, suggested: false, rules,
        }) });
        createdList.push(created);
      }
      setPresets((ps) => (ps ? [...createdList, ...ps] : createdList));
      setActiveFamilyKey(familyKeyOf(form.label.trim(), form.style || 'custom'));
      setActivePresetId(createdList[0].id); setDirty(false);
      setNotice(`Aggiunte ${createdList.length} variante/i (${combos.map((c) => `${regLabel(c.regime)} · ${objLabel(c.objective)} · ${mealLabel(c.meals)}`).join(', ')}). Ora puoi generare i cataloghi.`);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.'); }
    finally { setBusy(false); }
  }

  async function generate() {
    // Ordine dei target: prima quella con PIÙ pasti. Le ricette sono della dieta, non della
    // struttura pasti (la Keto Mediterranea onnivora a 3, a 5 e a digiuno mangia gli stessi
    // piatti), quindi chi viene dopo riusa quelle già generate: generando prima i 5 pasti si
    // coprono tutti i pasti che servono agli altri e si fa una sola chiamata all'AI.
    const pesoStruttura = (p: Preset) => ((p.meals as string) === '5' ? 0 : (p.meals as string) === '3' ? 1 : 2);
    const targets: Preset[] = (genAll && activeFamily)
      ? [...activeFamily.variants].sort((a, b) => pesoStruttura(a) - pesoStruttura(b))
      : ((presets ?? []).filter((p) => p.id === activePresetId));
    if (targets.length === 0) { setError('Scegli o salva una dieta prima di generare.'); return; }
    setBusy(true); setGenerando(true); setError(null); setNotice(null); setEsitoGen(null);
    const variantTag = (t: Preset) => `${regLabelOf((t.regime as string) || 'omnivore')} · ${objLabel((t.objective as string) || 'dimagrimento')} · ${mealLabel((t.meals as string) || '5')}`;
    try {
      let firstDietId: string | null = null;
      let generated = 0; let kept = 0;
      let idx = 0;
      // Pasti per cui l'AI non ha prodotto niente: vanno detti, non nascosti dietro un "fatto".
      const incompleti: string[] = [];
      // Ricette prese da una variante sorella invece di rigenerarle.
      let riusateTot = 0;
      // Settimane completate (ricette esistenti tenute + generata solo la differenza).
      let completate = 0;
      /**
       * Varianti su cui la generazione è ANDATA MALE, e varianti che erano RIMASTE INDIETRO.
       *
       * Il difetto dell'11/8 («fino alla settimana 9 le genera, la 10 no»): il giro sulle diciotto
       * varianti non aveva un `try` per variante, quindi il primo errore saltava fuori dal ciclo e
       * lasciava senza generazione tutte quelle dopo — diciassette sane fermate da una, e dal messaggio
       * non si capiva quale. Ora ogni variante risponde per sé e alla fine si dice chi ha fallito.
       */
      const falliti: string[] = [];
      const recuperate: string[] = [];
      for (const t of targets) {
        if (targets.length > 1) setProgress({ done: idx, total: targets.length, label: `Genero ${idx + 1} di ${targets.length}: ${variantTag(t)}…` });
        idx += 1;
        // INTEGRA, non sovrascrive: una settimana già generata viene lasciata intatta.
        // Solo sul singolo (non "genera tutte") si può scegliere di rifarla.
        type GenRes = { dietId: string; alreadyExists?: boolean; week?: number; settimanaChiesta?: number; recipes?: number; riusate?: number; pastiIncompleti?: string[] };
        try {
        let r = await api<GenRes>(`/engine-rules/presets/${t.id}/generate-catalog`, { method: 'POST', body: JSON.stringify({ week }) });
        if (r.alreadyExists) {
          // La settimana c'è già. Di default si COMPLETA: le ricette esistenti restano (comprese
          // quelle corrette a mano) e si genera solo quel che manca per arrivare a sette per
          // pasto. Buttare e rifare è l'eccezione, e la si sceglie con la spunta qui sotto.
          if (rifaiDaCapo && targets.length === 1) {
            // eslint-disable-next-line no-alert
            const ok = confirm(
              `Rifare da capo la settimana ${week} CANCELLA le ricette bozza di quella settimana, comprese eventuali correzioni fatte a mano.\n\n` +
              'Se volevi solo aggiungere i piatti che mancano, annulla e togli la spunta "Rifai da capo".\n\nProcedo?',
            );
            if (ok) r = await api<GenRes>(`/engine-rules/presets/${t.id}/generate-catalog`, { method: 'POST', body: JSON.stringify({ week, modalita: 'rifai' }) });
          } else {
            r = await api<GenRes>(`/engine-rules/presets/${t.id}/generate-catalog`, { method: 'POST', body: JSON.stringify({ week, modalita: 'completa' }) });
            completate += 1;
          }
        }
        if ((r.pastiIncompleti ?? []).length) incompleti.push(`${variantTag(t)}: ${(r.pastiIncompleti ?? []).join(', ')}`);
        // Variante rimasta indietro: il server ha generato la SUA prossima settimana invece di
        // rifiutare. Va detto, altrimenti sembra che la settimana chiesta sia stata fatta.
        if (r.week && r.week !== week) recuperate.push(`${variantTag(t)}: fatta la ${r.week}`);
        riusateTot += r.riusate ?? 0;
        if (r.alreadyExists) kept += 1; else generated += 1;
        if (!firstDietId) firstDietId = r.dietId;
        } catch (e) {
          // Una variante che salta non porta giù le altre: si annota e si va avanti.
          falliti.push(`${variantTag(t)} (${e instanceof Error ? e.message : 'errore'})`);
          // 503 = l'AI è fuori uso per un motivo definitivo (credito esaurito, chiave non valida).
          // Qui NON si va avanti: ripetere su diciassette varianti la stessa richiesta impossibile
          // è tempo perso e una barra che avanza mentendo. Il 12/8 è finito il credito a metà
          // generazione, e il primo errore già conteneva tutta la risposta.
          if (e instanceof ApiError && e.status === 503) {
            setEsitoGen({ tipo: 'err', testo: `${e.message} Le altre varianti non sono state provate: prima va risolto questo.` });
            setError(e.message);
            break;
          }
        }
        if (targets.length > 1) setProgress({ done: idx, total: targets.length, label: `Fatte ${idx} di ${targets.length}` });
      }
      if (firstDietId) { try { localStorage.setItem(LS_DIET, firstDietId); } catch { /* no-op */ } setDietId(firstDietId); }
      void loadFamilyStatuses();
      // Avanza da sola alla settimana successiva: è il gesto che il nutrizionista farebbe comunque.
      if (generated > 0 || completate > 0) {
        setWeeksDone((w) => Math.max(w ?? 0, week));
        const restanti = weeksThin.filter((n) => n !== week);
        setWeeksThin(restanti);
        // Prima si finiscono le magre, poi si va avanti: sono i menu già in mano alle clienti.
        setWeek(restanti.length ? restanti[0] : Math.min(12, week + 1));
      }
      const coda = (riusateTot ? ` ${riusateTot} ricette tenute da quelle che c'erano già (comprese le tue correzioni) o riprese dalle varianti sorelle: si è generato solo quello che mancava.` : '')
        + (recuperate.length ? ` ↩️ Erano rimaste indietro e hanno recuperato un passo: ${recuperate.join(' · ')}. Ripremi «Genera» per portarle alla ${week}.` : '')
        + (incompleti.length ? ` ⚠️ L'AI non ha prodotto ricette per: ${incompleti.join(' · ')} — rigenera questa settimana.` : '')
        + (falliti.length ? ` ❌ Non riuscite: ${falliti.join(' · ')}. Le altre sono state fatte.` : '');
      // «fatta su 0 variante/i» si legge come un successo e non lo è: se niente è stato toccato va
      // detto in chiaro, altrimenti si guarda il database convinti che qualcosa sia cambiato.
      const nienteFatto = generated === 0 && completate === 0;
      setNotice((targets.length > 1
        ? (nienteFatto && !falliti.length
          ? `Nessuna variante è stata toccata: la settimana ${week} c'era già su tutte e ${targets.length} e non mancava nessun piatto.`
          : `Settimana ${week} fatta su ${generated} variante/i${kept ? `, ${kept} l'avevano già` : ''}. Quando hai le settimane che vuoi, valida e pubblica al passo 3.`)
        : completate > 0
          ? `Settimana ${week} completata: le ricette che c'erano restano, sono stati aggiunti i piatti mancanti per arrivare a 7 per pasto.`
          : generated > 0
            ? `Settimana ${week} generata: 7 giornate con ricette nuove per ogni pasto. Genera la settimana successiva, oppure valida qui sotto.`
            : `La settimana ${week} è rimasta com'era.`) + coda);
      setEsitoGen({ tipo: falliti.length ? 'err' : 'ok', testo: (targets.length > 1
        ? (nienteFatto && !falliti.length
          ? `Nessuna variante è stata toccata: la settimana ${week} c'era già su tutte e ${targets.length} e non mancava nessun piatto.`
          : `Settimana ${week} fatta su ${generated} variante/i${kept ? `, ${kept} l'avevano già` : ''}.`)
        : (generated > 0
          ? (completate > 0 ? `Settimana ${week} completata.` : `Settimana ${week} generata.`)
          : `La settimana ${week} è rimasta com'era.`)) + coda });
    } catch (e) {
      const testo = e instanceof ApiError ? e.message : 'Generazione non riuscita (verifica AI_API_KEY su Render).';
      setError(testo);
      setEsitoGen({ tipo: 'err', testo });
    }
    finally { setBusy(false); setGenerando(false); setProgress(null); }
  }

  /**
   * Valida e pubblica/invia TUTTE le varianti generate della famiglia in un colpo
   * (gemello di "Genera tutte le varianti"). Per ogni dieta della famiglia (match nome+stile):
   * attiva ricette → conferma allergeni → approva gruppi, poi pubblica (capo) o invia in revisione.
   *
   * ⚠️ La validazione passa anche sulle varianti GIÀ PUBBLICATE, ed è il punto importante.
   * Ogni settimana nuova aggiunge ricette in **bozza** (inattive) a una dieta che è già
   * approvata: finché non le si attiva, le clienti continuano a ricevere solo i piatti
   * vecchi. Prima le già-pubblicate venivano saltate del tutto, quindi il pulsante non
   * faceva assolutamente niente su una famiglia interamente pubblicata — che è esattamente
   * il caso di chi genera le settimane 5-10 dopo aver pubblicato. Si salta invece la
   * *pubblicazione* di chi è già approved (darebbe «stato approved: non pubblicabile»).
   */
  async function publishAllFamily() {
    if (!activeFamily) return;
    setFamBusy(true); setFamMsg(null); setError(null); setNotice(null);
    type FamDiet = { id: string; name: string; regime: string; style: string; objective?: string | null; mealsPerDay?: number; fasting?: boolean; status: string };
    let fam: FamDiet[] = [];
    try {
      const all = await api<FamDiet[]>('/diets');
      fam = (all ?? []).filter((d) => d.name === activeFamily.label && d.style === activeFamily.style);
    } catch { setFamBusy(false); setError('Impossibile leggere le diete della famiglia.'); return; }
    if (!fam.length) { setFamBusy(false); setFamMsg('Nessuna dieta generata per questa famiglia: genera prima le varianti (passo 2).'); return; }

    const verb = isResponsabile ? 'pubblicate' : 'inviate in revisione';
    const famLabel = activeFamily.label;

    // Da validare: TUTTE le varianti vive (anche le già pubblicate — è lì che stanno le
    // ricette nuove ancora in bozza). Da pubblicare: solo quelle non ancora approvate.
    const daValidare = fam.filter((d) => d.status !== 'rejected');
    const daPubblicare = daValidare.filter((d) => d.status !== 'approved');
    const archiviate = fam.length - daValidare.length;
    if (daValidare.length === 0) {
      setFamBusy(false);
      setFamMsg(`Tutte le varianti di "${famLabel}" sono archiviate: non c'è niente da validare.`);
      return;
    }

    const errs: string[] = [];
    const tag = (v: { regime: string; objective?: string | null; mealsPerDay?: number; fasting?: boolean }) => `${v.regime}${v.objective ? ' · ' + v.objective : ''}${v.fasting ? ' · digiuno' : v.mealsPerDay ? ` · ${v.mealsPerDay} pasti` : ''}`;
    const total = daValidare.length + daPubblicare.length; // due passate
    let step = 0;
    // Pass 1 — contenuti (ricette, allergeni, gruppi) su OGNI variante viva.
    let validate = 0;
    for (const v of daValidare) {
      setProgress({ done: step, total, label: `Valido ${tag(v)}…` });
      try {
        await api(`/engine-rules/diets/${v.id}/activate-recipes`, { method: 'POST', body: JSON.stringify({}) });
        await api(`/engine-rules/diets/${v.id}/review-allergens`, { method: 'POST', body: JSON.stringify({}) });
        await api(`/engine-rules/diets/${v.id}/approve-groups`, { method: 'POST', body: JSON.stringify({}) });
        validate += 1;
      } catch (e) { errs.push(`${tag(v)} (validazione): ${e instanceof ApiError ? e.message : 'errore'}`); }
      step += 1;
    }
    // Pass 2 — pubblica (capo) o invia in revisione, dopo che i gruppi sono approvati.
    let done = 0;
    for (const v of daPubblicare) {
      setProgress({ done: step, total, label: `${isResponsabile ? 'Pubblico' : 'Invio'} ${tag(v)}…` });
      try {
        await api(`/diets/${v.id}/${isResponsabile ? 'publish' : 'submit'}`, { method: 'POST', body: JSON.stringify({}) });
        done += 1;
      } catch (e) { errs.push(`${tag(v)} (${isResponsabile ? 'pubblica' : 'invio'}): ${e instanceof ApiError ? e.message : 'errore'}`); }
      step += 1;
    }
    setProgress(null);
    setFamBusy(false);

    // La pagina RESTA aperta sulla famiglia: dopo l'ultima settimana si ripassa di qui
    // ogni volta, e azzerare tutto costringeva a ricercare la dieta da capo.
    void loadFamilyStatuses();
    if (dietId) { try { setStatus(await api<ReviewStatus>(`/engine-rules/diets/${dietId}/review-status`)); } catch { /* no-op */ } }
    const coda = archiviate ? ` (${archiviate} archiviate, saltate)` : '';
    setFamMsg(
      errs.length
        ? `Validate ${validate}/${daValidare.length} varianti, ${done} ${verb}${coda}. Da rivedere: ${errs.join(' · ')}`
        : `Famiglia "${famLabel}" a posto ✓ ${validate} varianti validate (ricette attivate, allergeni confermati, gruppi approvati)` +
          `${done ? `, ${done} ${verb}` : daPubblicare.length === 0 ? ' — erano già tutte pubblicate' : ''}${coda}.` +
          ' Le ricette delle settimane nuove sono ora attive: le clienti le ricevono.',
    );
  }

  async function act(path: string) {
    if (!dietId) return;
    setBusy(true); setError(null);
    try { setStatus(await api<ReviewStatus>(`/engine-rules/diets/${dietId}/${path}`, { method: 'POST', body: JSON.stringify({}) })); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Operazione non riuscita.'); }
    finally { setBusy(false); }
  }

  /**
   * Su una dieta GIÀ PUBBLICATA non si ripubblica: si validano le ricette nuove.
   *
   * Dopo il 9/8 la pagina apre da sola una variante, e quasi sempre è una variante già
   * approvata su cui il nutrizionista ha appena generato una settimana in più. Lì il pulsante
   * «Approva e pubblica» chiamava `publish` e tornava indietro con «La dieta è in stato
   * approved: non pubblicabile» — un errore rosso in cima alla pagina che sembrava dire «non
   * puoi più approvare niente», mentre il lavoro da fare c'era ed era un altro: attivare le
   * ricette della settimana appena generata, che nascono in bozza.
   */
  async function validaSolaQuesta() {
    if (!dietId) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await api(`/engine-rules/diets/${dietId}/activate-recipes`, { method: 'POST', body: JSON.stringify({}) });
      await api(`/engine-rules/diets/${dietId}/review-allergens`, { method: 'POST', body: JSON.stringify({}) });
      setStatus(await api<ReviewStatus>(`/engine-rules/diets/${dietId}/approve-groups`, { method: 'POST', body: JSON.stringify({}) }));
      void loadFamilyStatuses();
      setNotice('Fatto ✓ Le ricette di questa variante sono attive e gli allergeni confermati: le clienti le ricevono. La dieta era già pubblicata, quindi non c\'è niente da ripubblicare.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally { setBusy(false); }
  }

  async function publish() {
    if (!dietId) return;
    setBusy(true); setError(null);
    try {
      // Il responsabile (capo nutrizionista) approva e pubblica direttamente; i coach
      // sotto inviano in revisione al capo.
      await api(`/diets/${dietId}/${isResponsabile ? 'publish' : 'submit'}`, { method: 'POST', body: JSON.stringify({}) });
      try { localStorage.removeItem(LS_DIET); } catch { /* no-op */ }
      if (isResponsabile) {
        // Approvata e pubblicata dal responsabile → porta alla Gestione dieta.
        navigate('/gestione-dieta');
        return;
      }
      // `setFamVariants([])` serve: senza, la scelta automatica della variante (vedi sopra)
      // riaprirebbe subito il passo 3 sulla famiglia appena chiusa.
      setDietId(null); setStatus(null); setActivePresetId(null); setActiveFamilyKey(null); setGenAll(false); setDirty(false); setFamVariants([]);
      setForm({ label: '', style: '', regimes: ['omnivore'], objectives: ['dimagrimento'], meals: ['5'], clinicalNotes: '', kcalTarget: 1500, proteinMin: 20, proteinMax: 35, kcalTol: 15 });
      setNotice('Dieta inviata in revisione ✓ La pagina è pronta per un nuovo lavoro.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : isResponsabile ? 'Pubblicazione non riuscita.' : 'Invio non riuscito.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    finally { setBusy(false); }
  }

  function reset() {
    try { localStorage.removeItem(LS_DIET); } catch { /* no-op */ }
    // Anche l'elenco delle varianti, altrimenti la scelta automatica riapre subito la bozza.
    setDietId(null); setStatus(null); setNotice(null); setFamVariants([]);
  }

  async function loadPreview() {
    if (!dietId) return;
    setBusy(true);
    try { setPreview(await api<{ dayIndex: number; meals: { slot: string; recipe: string; kcal: number }[] }[]>(`/engine-rules/diets/${dietId}/preview`)); setShowPreview(true); }
    catch { setPreview([]); setShowPreview(true); }
    finally { setBusy(false); }
  }

  if (presets === null) return <Spinner />;

  const canGenerate = !!activePresetId && !dirty;
  /** La variante scelta, per mostrarla accanto al pulsante che genera (vedi passo 2). */
  const activePreset = (presets ?? []).find((p) => p.id === activePresetId) ?? null;
  // Riepilogo combinazioni selezionate (regime × obiettivo): quante nuove, quante già presenti.
  const selectedCombos: string[] = [];
  const selMeals = form.meals.filter(strutturaAmmessa);
  for (const rc of form.regimes) for (const oc of form.objectives) for (const mc of selMeals) selectedCombos.push(comboKeyOf(rc, oc, mc));
  const newCombosCount = selectedCombos.filter((k) => !existingCombos.has(k)).length;
  const alreadyCombosCount = selectedCombos.length - newCombosCount;
  const s = status;
  const done = s ? {
    recipes: s.recipes.total > 0 && s.recipes.active === s.recipes.total,
    allergens: s.recipes.total > 0 && s.recipes.allergensReviewed === s.recipes.total,
    days: s.days.total > 0 && s.days.complete === s.days.total,
    groups: s.groups.total === 0 || s.groups.approved === s.groups.total,
  } : null;
  const allReady = !!done && done.recipes && done.allergens && done.days && done.groups;

  return (
    <>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ background: 'linear-gradient(120deg,var(--deep),var(--teal))', color: '#fff', border: 'none' }}>
        <h2 style={{ color: '#fff', marginTop: 0 }}>Creazione e validazione</h2>
        <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>
          Una guida passo-passo: parti da una dieta suggerita, genera il catalogo bozza e validalo fino all'invio in revisione. A fine lavori questa pagina si azzera.
        </p>
      </div>

      {/* PASSO 1 — Dieta */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}><span className="chip" style={{ marginRight: 8 }}>1</span> Scegli la dieta</h2>
        <p className="hint" style={{ marginTop: 0 }}>Richiama una dieta suggerita e modificala, salvala col suo nome, oppure creane una nuova.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {families.map((fam) => {
            const active = activeFamilyKey === fam.key;
            return (
              <span key={fam.key} className="chip"
                style={{ cursor: 'pointer', gap: 6, display: 'inline-flex', alignItems: 'center', borderColor: active ? 'var(--teal)' : undefined, background: active ? 'var(--chip)' : undefined }}>
                <span onClick={() => pickFamily(fam)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <i className="ti ti-bulb" /> {fam.label}{fam.suggested ? ' · suggerita' : ''}
                  {fam.variants.length > 1 && <span style={{ fontSize: 10, opacity: 0.7 }}>· {fam.variants.length} varianti</span>}
                </span>
                <i className="ti ti-trash" title="Elimina questa dieta (tutte le varianti)"
                  onClick={(e) => { e.stopPropagation(); void deleteFamily(fam); }}
                  style={{ marginLeft: 4, fontSize: 13, color: 'var(--danger)', cursor: 'pointer' }} />
              </span>
            );
          })}
          <button className="btn" onClick={newPreset} style={{ cursor: 'pointer', gap: 6, fontWeight: 700 }}><i className="ti ti-plus" /> Nuova dieta</button>
        </div>

        {(activePresetId !== null || dirty) && (
          <div style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
            <label style={{ display: 'block' }}>
              <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Nome della dieta</span>
              <input className="input" value={form.label} onChange={(e) => edit('label', e.target.value)} placeholder="es. Mediterranea ipocalorica" />
            </label>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <label style={{ flex: 1, minWidth: 160 }}>
                <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Regime <span style={{ opacity: 0.65 }}>· uno o più</span></span>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {regimes.map((r) => {
                    const on = form.regimes.includes(r.code);
                    return (
                      <button key={r.code} type="button" className={`btn ${on ? '' : 'ghost'} sm`}
                        onClick={() => toggleRegime(r.code)}
                        title={on ? 'Rimuovi dalla selezione' : 'Aggiungi questo regime'}>
                        {on && <i className="ti ti-check" />} {r.label}
                      </button>
                    );
                  })}
                </div>
              </label>
              <label style={{ flex: 1, minWidth: 160 }}>
                <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Obiettivo <span style={{ opacity: 0.65 }}>· uno o più</span></span>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {OBIETTIVI.map((o) => {
                    const on = form.objectives.includes(o.v);
                    return (
                      <button key={o.v} type="button" className={`btn ${on ? '' : 'ghost'} sm`}
                        onClick={() => toggleObjective(o.v)}
                        title={on ? 'Rimuovi dalla selezione' : 'Aggiungi questo obiettivo'}>
                        {on && <i className="ti ti-check" />} {o.l}
                      </button>
                    );
                  })}
                </div>
              </label>
              <label style={{ flex: 1, minWidth: 200 }}>
                <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Pasti <span style={{ opacity: 0.65 }}>· uno o più</span></span>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {PASTI.map((m) => {
                    // ⚠️ Su una famiglia di digiuno restano scegliibili «digiuno» e «5 pasti»; i 3
                    //    no. E `on` legge la selezione vera invece di forzarla: prima `fasting`
                    //    risultava acceso anche quando nessuno l'aveva toccato.
                    const locked = !strutturaAmmessa(m.v);
                    const on = !locked && form.meals.includes(m.v);
                    return (
                      <button key={m.v} type="button" className={`btn ${on ? '' : 'ghost'} sm`} disabled={locked}
                        style={locked ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                        onClick={() => toggleMeal(m.v)}
                        title={locked
                          ? 'I 3 pasti non servono a una dieta a digiuno: il motore non li chiede mai'
                          : on ? 'Rimuovi dalla selezione'
                            : m.v === 'fasting' ? 'La struttura digiuno: pranzo, merenda, cena'
                              : isFastingFamily ? 'Serve alla finestra 14:10, che promette anche la colazione'
                                : 'Aggiungi questa struttura pasti'}>
                        {on && <i className="ti ti-check" />} {m.l}
                      </button>
                    );
                  })}
                </div>
                {isFastingFamily && (
                  <div className="muted" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.45 }}>
                    <i className="ti ti-info-circle" style={{ marginRight: 4 }} />
                    Dieta a digiuno: servono <b>due</b> strutture. Quella <b>digiuno</b> copre 16:8, 18:6,
                    20:4 e 23:1; i <b>5 pasti</b> servono alla <b>14:10</b>, che promette anche la colazione —
                    senza, chi la sceglie riceve una giornata senza colazione. I 3 pasti restano spenti: il
                    motore non li chiede mai.
                  </div>
                )}
              </label>
            </div>
            {selectedCombos.length > 0 && (
              <div className="muted" style={{ fontSize: 12 }}>
                <i className="ti ti-layers-intersect" style={{ marginRight: 4 }} />
                {selectedCombos.length} combinazione/i regime × obiettivo × pasti: <b>{newCombosCount} da creare</b>
                {alreadyCombosCount > 0 ? `, ${alreadyCombosCount} già presente/i (saltate)` : ''}.
              </div>
            )}
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <label style={{ flex: 1, minWidth: 110 }}>
                <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Kcal / giorno</span>
                <input className="input" type="number" min={600} max={4000} step={50} value={form.kcalTarget} onChange={(e) => editNum('kcalTarget', Number(e.target.value) || 0)} />
              </label>
              <label style={{ flex: 1, minWidth: 110 }}>
                <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Proteine min %</span>
                <input className="input" type="number" min={5} max={60} value={form.proteinMin} onChange={(e) => editNum('proteinMin', Number(e.target.value) || 0)} />
              </label>
              <label style={{ flex: 1, minWidth: 110 }}>
                <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Proteine max %</span>
                <input className="input" type="number" min={5} max={60} value={form.proteinMax} onChange={(e) => editNum('proteinMax', Number(e.target.value) || 0)} />
              </label>
              <label style={{ flex: 1, minWidth: 110 }}>
                <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Tolleranza kcal %</span>
                <input className="input" type="number" min={0} max={40} value={form.kcalTol} onChange={(e) => editNum('kcalTol', Number(e.target.value) || 0)} />
              </label>
            </div>
            <label style={{ display: 'block' }}>
              <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Note cliniche (opzionale)</span>
              <textarea className="input" rows={2} value={form.clinicalNotes} onChange={(e) => edit('clinicalNotes', e.target.value)} placeholder="Vincoli o indicazioni da rispettare nella generazione" />
            </label>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn ghost" onClick={saveAsNew} disabled={busy}><i className="ti ti-device-floppy" /> Salva dieta</button>
              {dirty && <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>Modifiche non salvate: salva per poter generare.</span>}
            </div>
          </div>
        )}
      </div>

      {/* PASSO 2 — Genera */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}><span className="chip" style={{ marginRight: 8 }}>2</span> Genera il catalogo</h2>
        <p className="hint" style={{ marginTop: 0 }}>Crea una bozza (ricette, giornate, alternative, allergeni) dalla dieta scelta, <b>una settimana per volta</b>. Può richiedere fino a un minuto per settimana.</p>
        {activeFamily && activeFamily.variants.length > 1 && (
          <label className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <input type="checkbox" checked={genAll} onChange={(e) => setGenAll(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Genera <b>tutte le {activeFamily.variants.length} varianti</b> del gruppo (ricette, allergeni, giornate e gruppi di equivalenza per ogni combinazione regime × obiettivo)</span>
          </label>
        )}
        {/* SU CHE COSA STAI LAVORANDO. Sembra ridondante — la variante si sceglie al passo 1 —
            e invece è la riga più importante della pagina: le varianti di una famiglia si
            chiamano tutte allo stesso modo, e l'8/8 cinque settimane di lavoro sono finite su
            «vegana · mantenimento · 3 pasti» mentre chi le generava era convinta di stare su
            «onnivora · dimagrimento · 5 pasti». Nessun messaggio d'errore: il nome era giusto. */}
        {activePreset && (
          <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--chip)', border: '1px solid var(--teal)' }}>
            <div className="muted" style={{ fontSize: 11.5, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              {genAll && activeFamily ? 'Stai generando' : 'Stai lavorando su'}
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#10403a', marginTop: 2 }}>
              {activePreset.label}
            </div>
            {/* Con "genera tutte" spuntato la variante singola non c'entra più niente: mostrarla
                lo stesso faceva credere che si stesse lavorando solo su quella. */}
            {genAll && activeFamily ? (
              <>
                <div style={{ fontSize: 13, color: '#2E3E3B', marginTop: 1 }}>
                  <b>tutte le {activeFamily.variants.length} varianti</b> del gruppo (regime × obiettivo × pasti)
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: '#5F6E6B', marginTop: 5 }}>
                  Le varianti a 3 pasti e a digiuno riusano i piatti di quella a 5 pasti dello stesso regime e
                  obiettivo: le chiamate vere all'AI sono {new Set(activeFamily.variants.map((v) => `${(v.regime as string) || 'omnivore'}|${(v.objective as string) || 'dimagrimento'}`)).size}, non {activeFamily.variants.length}.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#2E3E3B', marginTop: 1 }}>
                  {regLabelOf((activePreset.regime as string) || 'omnivore')} · {objLabel((activePreset.objective as string) || 'dimagrimento')} · <b>{mealLabel((activePreset.meals as string) || '5')}</b>
                </div>
                {/* Se al passo 1 sono spuntate più combinazioni, le spunte e la variante attiva NON
                    coincidono: va detto, altrimenti si legge una cosa e se ne genera un'altra. */}
                {selectedCombos.length > 1 && (
                  <div style={{ marginTop: 7, fontSize: 12, lineHeight: 1.5, color: '#6B4E12' }}>
                    Al passo 1 hai spuntato <b>{selectedCombos.length} combinazioni</b>, ma la generazione lavora su
                    questa sola. Per farle tutte, metti la spunta <b>«Genera tutte le varianti»</b> qui sopra.
                  </div>
                )}
                {/* CAMBIA VARIANTE, qui, con un clic. Le settimane gialle qui sotto sono di
                    QUESTA variante: senza un modo evidente di spostarsi, chi rientrava in
                    pagina e si ritrovava le prime settimane in giallo pensava di aver perso
                    dodici settimane di lavoro — invece stava guardando una sorella. */}
                {activeFamily && activeFamily.variants.length > 1 && (
                  <div style={{ marginTop: 9 }}>
                    <div className="muted" style={{ fontSize: 11.5, marginBottom: 4 }}>Cambia variante — le settimane qui sotto sono di quella scelta:</div>
                    <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                      {[...activeFamily.variants]
                        .sort((a, b) =>
                          regLabelOf((a.regime as string) || 'omnivore').localeCompare(regLabelOf((b.regime as string) || 'omnivore'), 'it')
                          || String(a.objective ?? '').localeCompare(String(b.objective ?? ''))
                          || String(a.meals ?? '').localeCompare(String(b.meals ?? '')))
                        .map((v) => {
                          const sel = v.id === activePresetId;
                          return (
                            <button key={v.id} type="button" className={`chip ${sel ? '' : 'gray'}`}
                              onClick={() => setActivePresetId(v.id)}
                              style={{ cursor: 'pointer', borderColor: sel ? 'var(--teal)' : undefined, fontWeight: sel ? 700 : 400 }}>
                              {regLabelOf((v.regime as string) || 'omnivore')} · {objLabel((v.objective as string) || 'dimagrimento')} · {mealLabel((v.meals as string) || '5')}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Una settimana per volta. Il numero grande («28 giorni») prometteva 28 giornate
            diverse e non era vero: il generatore faceva 5 ricette per pasto e le ricombinava.
            Qui si vede quante settimane ci sono e qual è la prossima. */}
        <div style={{ marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
            Settimana da generare
            {weeksDone !== null && weeksDone > 0 && (
              <>
                {' '}— in catalogo: <b>{weeksDone * 7} giorni</b>
                {weeksThin.length === 0
                  ? <>, tutte complete</>
                  : <>, <b>da completare: {weeksThin.join(', ')}</b></>}
                {ricettePerPasto !== null && <> · {ricettePerPasto} piatti diversi nel pasto messo peggio</>}
              </>
            )}
          </div>
          {weeksThin.length > 0 && (
            <div style={{ margin: '0 0 8px', padding: '9px 11px', borderRadius: 9, background: '#FDF6E8', border: '1px solid #F0DFBA', fontSize: 12.5, lineHeight: 1.55, color: '#5C4A22' }}>
              Le settimane in <b>giallo</b> hanno le giornate ma non abbastanza piatti <i>loro</i>: o sono state
              generate col metodo vecchio (5 ricette per pasto ricombinate), o usano piatti che compaiono anche
              in un'altra settimana — che per la cliente è la stessa cosa, li rivede. <b>Vanno completate</b>,
              e si parte da lì: sono i menu che sta ricevendo adesso.
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {/* Quanti pulsanti disegnare: almeno 8, ma sempre uno IN PIÙ di quelle già fatte —
                altrimenti chi arriva alla nona settimana legge «Genera la settimana 10» su un
                pulsante che non c'è, perché la fila si fermava a otto. Il tetto è 12, che è
                anche il massimo che accetta il backend (SETTIMANE_MAX). */}
            {Array.from({ length: Math.min(12, Math.max(8, (weeksDone ?? 0) + 1)) }, (_, i) => i + 1).map((n) => {
              const esiste = weeksDone !== null && n <= weeksDone;
              const magra = weeksThin.includes(n);
              const piena = esiste && !magra;
              const prossima = weeksDone !== null && n === weeksDone + 1;
              const scelta = n === week;
              // Oltre la prossima non si può andare: un buco fra la 1 e la 3 lascerebbe il
              // ciclo con giornate mancanti in mezzo, e il motore non sa colmarle.
              const bloccata = weeksDone !== null && n > weeksDone + 1;
              return (
                <button key={n} type="button" disabled={bloccata || busy}
                  onClick={() => { setWeek(n); setRifaiDaCapo(false); }}
                  title={piena ? 'Completa: 7 piatti diversi per pasto' : magra ? 'Le giornate ci sono ma i piatti sono pochi: va completata' : prossima ? 'La prossima da fare' : bloccata ? 'Genera prima le settimane precedenti' : ''}
                  style={{
                    minWidth: 92, padding: '7px 10px', borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                    cursor: bloccata ? 'not-allowed' : 'pointer', opacity: bloccata ? 0.4 : 1,
                    border: `1.5px solid ${scelta ? 'var(--teal)' : 'var(--line)'}`,
                    background: scelta ? 'var(--teal)' : piena ? '#EEF3F1' : magra ? '#FDF6E8' : '#fff',
                    color: scelta ? '#fff' : piena ? '#5F6E6B' : magra ? '#6B4E12' : '#2E3E3B',
                  }}>
                  {!scelta && piena ? '\u2713 ' : ''}{!scelta && magra ? '! ' : ''}Settimana {n}
                </button>
              );
            })}
          </div>
          <p className="muted" style={{ fontSize: 12, margin: '7px 0 0' }}>
            Ogni settimana sono <b>7 giornate</b> con <b>7 ricette diverse per ogni pasto</b> (nessun piatto ripetuto
            dentro la settimana, e nemmeno rispetto alle settimane già fatte). Quattro settimane = un mese.
          </p>
          {/* Il riquadro compariva su QUALSIASI settimana già esistente, anche su una completa:
              si leggeva la spunta verde e sotto «verrà completata», che si contraddicono. Ora
              parla solo quando c'è davvero qualcosa da fare. */}
          {weeksDone !== null && week <= weeksDone && !weeksThin.includes(week) && (
            <div style={{ marginTop: 9, padding: '10px 12px', borderRadius: 10, background: '#EEF3F1', border: '1px solid #DCE5E2' }}>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#42615A' }}>
                La settimana {week} è già <b>completa</b>: ha 7 piatti diversi per ogni pasto, e nessuno di
                quei piatti compare in un'altra settimana. Generarla di nuovo non aggiungerebbe niente.
                {(weeksThin.length > 0 || weeksDone < 12) && (
                  <> {weeksThin.length > 0
                    ? <>Vai piuttosto sulla <b>settimana {weeksThin[0]}</b>, che è da completare.</>
                    : <>Se vuoi allungare il ciclo, scegli la <b>settimana {weeksDone + 1}</b>.</>}</>
                )}
              </div>
            </div>
          )}
          {weeksDone !== null && weeksThin.includes(week) && (
            <div style={{ marginTop: 9, padding: '10px 12px', borderRadius: 10, background: '#FDF6E8', border: '1px solid #F0DFBA' }}>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#5C4A22' }}>
                La settimana {week} ha le giornate ma non abbastanza piatti suoi. Verrà <b>completata</b>: le
                ricette che usa solo lei restano — comprese quelle che hai corretto a mano — e si generano i
                piatti mancanti per arrivare a 7 per pasto senza ripetere nulla del resto del ciclo.
              </div>
              <label className="row" style={{ gap: 7, alignItems: 'flex-start', marginTop: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={rifaiDaCapo} onChange={(e) => setRifaiDaCapo(e.target.checked)} style={{ marginTop: 2 }} />
                <span style={{ fontSize: 12, lineHeight: 1.5, color: '#6B4E12' }}>
                  <b>Rifai da capo</b> invece di completare — cancella le ricette bozza di questa settimana,
                  <b> comprese le correzioni fatte a mano</b>. Serve solo se i piatti non vanno proprio bene.
                </span>
              </label>
            </div>
          )}
        </div>
        <button className="btn" onClick={generate} disabled={busy || !canGenerate}>
          {generando ? (
            <>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.45)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginRight: 6, verticalAlign: '-2px' }} />
              Genero…
            </>
          ) : (
            <>
              <i className="ti ti-sparkles" /> Genera la settimana {week}
            </>
          )}
        </button>
        {/* La barra si mostra SEMPRE durante la generazione: prima era legata a `!status`,
            cioè spariva appena in pagina c'era una bozza già caricata — che è esattamente il
            caso di chi genera la seconda variante e resta a guardare un pulsante fermo. */}
        {generando && progress && <ProgressBar done={progress.done} total={progress.total} label={progress.label} />}
        {/* L'ESITO, QUI. In cima alla pagina c'è già, ma da qui non si vede: chi ha appena premuto
            resta a guardare la barra che spariesce e conclude «non è successo niente» (12/8). */}
        {!generando && esitoGen && (
          <div
            style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.55,
              background: esitoGen.tipo === 'err' ? '#FDECEC' : '#EAF6F1',
              border: `1px solid ${esitoGen.tipo === 'err' ? '#F3C9C9' : '#BFE3D6'}`,
              color: esitoGen.tipo === 'err' ? '#8A2B2B' : '#0E5C4A',
            }}
          >
            {esitoGen.testo}
          </div>
        )}
        {generando && !progress && (
          <p className="muted" style={{ fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--line)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flex: 'none' }} />
            Sto generando le ricette della settimana {week}, un pasto per volta… può richiedere fino a un minuto.
          </p>
        )}
        {!canGenerate && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Scegli una dieta (o salvala se l'hai modificata) per abilitare la generazione.</p>}
      </div>

      {/* PASSO 3 — Valida */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}><span className="chip" style={{ marginRight: 8 }}>3</span> Valida e pubblica</h2>
        {famVariants.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Varianti generate della famiglia: <b>{famVariants.filter((v) => v.ready).length}/{famVariants.length} pronte</b> · {famVariants.filter((v) => v.status === 'approved').length} pubblicate.
              Clicca una variante per vederne i passi qui sotto.
            </div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {famVariants.map((v) => {
                const sel = v.dietId === dietId;
                const archived = v.status === 'rejected';
                return (
                  <div key={v.dietId} className="row" style={{ gap: 2, alignItems: 'center' }}>
                    <button type="button" className={`chip ${sel ? '' : 'gray'}`}
                      onClick={() => { try { localStorage.setItem(LS_DIET, v.dietId); } catch { /* no-op */ } setDietId(v.dietId); }}
                      style={{ cursor: 'pointer', borderColor: sel ? 'var(--teal)' : undefined, opacity: archived ? 0.5 : undefined }}
                      title={archived ? 'Archiviata (fuori dai menu)' : v.status === 'approved' ? 'Pubblicata' : v.ready ? 'Pronta da pubblicare' : 'Passi da completare'}>
                      <i className={`ti ${archived ? 'ti-archive' : v.status === 'approved' ? 'ti-rosette-discount-check' : v.ready ? 'ti-circle-check' : 'ti-progress'}`}
                        style={{ marginRight: 4, color: !archived && (v.status === 'approved' || v.ready) ? 'var(--ok-ink)' : undefined }} />
                      {regLabelOf(v.regime)} · {objLabel(v.objective)} · {mealLabel(v.meals)}{archived ? ' · archiviata' : v.status === 'approved' ? ' · pubblicata' : v.ready ? ' · pronta' : ''}
                    </button>
                    {!archived && (
                      <button type="button" className="btn ghost sm" title="Archivia questa variante (fuori dai menu)" disabled={busy}
                        style={{ padding: '2px 6px', color: 'var(--danger)' }} onClick={() => archiveVariant(v)}>
                        <i className="ti ti-archive" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Il riquadro "tutta la famiglia" sta FUORI dal blocco della singola bozza: prima era
            dentro, e quindi spariva insieme al resto ogni volta che non c'era una variante
            selezionata — proprio quando serve, cioè dopo aver generato altre settimane. */}
        {activeFamily && activeFamily.variants.length > 1 && (
          <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, border: '1px solid var(--teal)', background: 'var(--chip)' }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Tutta la famiglia in un colpo</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Valida (ricette, allergeni, gruppi) e {isResponsabile ? 'pubblica' : 'invia in revisione'} <b>tutte le {activeFamily.variants.length} varianti</b> (regime × obiettivo) della famiglia, senza farlo una per una. Le clienti scelgono lo stile e il motore pesca la variante giusta per regime e obiettivo.
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Vale <b>anche sulle varianti già pubblicate</b>: ogni settimana nuova nasce in bozza, e finché non si attivano le sue ricette le clienti ricevono solo i piatti vecchi. Dopo l'ultima settimana, premi qui.
            </div>
            <button className="btn" onClick={publishAllFamily} disabled={busy || famBusy} style={{ marginTop: 8 }}>
              {famBusy ? (
                <>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.45)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginRight: 6, verticalAlign: '-2px' }} />
                  Lavoro…
                </>
              ) : (
                <><i className="ti ti-stack-2" /> {isResponsabile ? `Valida e pubblica tutte le ${activeFamily.variants.length} varianti` : `Valida e invia tutte le ${activeFamily.variants.length} varianti`}</>
              )}
            </button>
            {famBusy && progress && <ProgressBar done={progress.done} total={progress.total} label={progress.label} />}
            {famMsg && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{famMsg}</div>}
          </div>
        )}
        {!s ? (
          <p className="muted" style={{ marginTop: 0 }}>Genera un catalogo per iniziare la validazione guidata.</p>
        ) : (
          <>
            {/* «Bozza: … stato approved» era una contraddizione in due parole. Su una variante
                già pubblicata la frase dice cosa c'è ancora da fare, che è un'altra cosa. */}
            <p className="hint" style={{ marginTop: 0 }}>
              {s.status === 'approved' ? (
                <>Variante <b>{s.name}</b> · <b>già pubblicata</b>. Se hai generato altre settimane, le loro ricette nascono in bozza: attivale qui sotto e le clienti le ricevono.</>
              ) : (
                <>Bozza: <b>{s.name}</b> · stato {s.status}. Completa i passi (le spunte si aggiornano da sole).</>
              )}
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              <StepRow ok={!!done?.recipes} title="Ricette" detail={`${s.recipes.active}/${s.recipes.total} attive`}
                action={<button className="btn ghost sm" onClick={() => act('activate-recipes')} disabled={busy}>Attiva tutte</button>}
                link={<Link className="btn ghost sm" to="/ricette">Rivedi</Link>} />
              <StepRow ok={!!done?.allergens} title="Allergeni" detail={`${s.recipes.allergensReviewed}/${s.recipes.total} approvati`}
                action={<button className="btn ghost sm" onClick={() => act('review-allergens')} disabled={busy}>Approva tutti</button>}
                link={<Link className="btn ghost sm" to="/tag-allergeni">Rivedi</Link>} />
              <StepRow ok={!!done?.days} title="Giornate" detail={`${s.days.complete}/${s.days.total} complete`}
                link={<Link className="btn ghost sm" to="/diete">Componi</Link>} />
              <StepRow ok={!!done?.groups} title="Gruppi di equivalenza" detail={s.groups.total === 0 ? 'nessuno' : `${s.groups.approved}/${s.groups.total} confermati`}
                action={s.groups.total > 0 ? <button className="btn ghost sm" onClick={() => act('approve-groups')} disabled={busy}>Conferma tutti</button> : undefined}
                link={<Link className="btn ghost sm" to="/gruppi-equivalenza">Rivedi</Link>} />
            </div>
            <div className="row" style={{ gap: 8, marginTop: 16 }}>
              {/* Già pubblicata → non si ripubblica, si validano le ricette nuove. Prima il
                  pulsante chiamava comunque `publish` e rispondeva «stato approved: non
                  pubblicabile»: un errore rosso al posto del lavoro che c'era davvero da fare. */}
              {s.status === 'approved' ? (
                <button className="btn" onClick={validaSolaQuesta} disabled={busy} title="Attiva le ricette generate dopo la pubblicazione">
                  <i className="ti ti-checks" /> Attiva le ricette nuove (solo questa)
                </button>
              ) : (
                <button className="btn" onClick={publish} disabled={busy || !allReady} title={allReady ? '' : 'Completa tutti i passi'}>
                  <i className={`ti ${isResponsabile ? 'ti-rosette-discount-check' : 'ti-send'}`} /> {isResponsabile ? 'Approva e pubblica (solo questa)' : 'Invia in revisione (solo questa)'}
                </button>
              )}
              <button className="btn ghost" onClick={showPreview ? () => setShowPreview(false) : loadPreview} disabled={busy}>
                <i className="ti ti-eye" /> {showPreview ? 'Nascondi anteprima' : 'Anteprima giornate'}
              </button>
              <button className="btn ghost" onClick={reset} disabled={busy}>Annulla questa bozza</button>
            </div>
            {showPreview && preview !== null && (
              <div style={{ marginTop: 14 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Anteprima delle {preview.length} giornate generate</div>
                <div style={{ maxHeight: 360, overflowY: 'auto', display: 'grid', gap: 6 }}>
                  {preview.map((d) => (
                    <div key={d.dayIndex} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}>
                      <b style={{ fontSize: 13 }}>Giorno {d.dayIndex}</b>
                      <div style={{ display: 'grid', gap: 2, marginTop: 4 }}>
                        {d.meals.map((m, i) => (
                          <div key={i} className="row" style={{ gap: 8, fontSize: 12.5 }}>
                            <span className="muted" style={{ width: 84, flex: 'none' }}>{SLOT_LABEL[m.slot] ?? m.slot}</span>
                            <span style={{ flex: 1 }}>{m.recipe}</span>
                            <span className="muted">{m.kcal} kcal</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** Barra di avanzamento delle lavorazioni lunghe (X di N + percentuale). */
function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ marginTop: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 12, marginBottom: 4 }}>
        <span className="muted" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <b style={{ flex: 'none' }}>{pct}%</b>
      </div>
      <div style={{ height: 8, borderRadius: 6, background: 'var(--line)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--teal)', transition: 'width .3s ease' }} />
      </div>
    </div>
  );
}

function StepRow({ ok, title, detail, action, link }: { ok: boolean; title: string; detail: string; action?: React.ReactNode; link?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: ok ? 'var(--chip)' : 'var(--card)' }}>
      <i className={`ti ${ok ? 'ti-circle-check' : 'ti-circle'}`} style={{ fontSize: 22, color: ok ? 'var(--ok-ink)' : 'var(--muted)', flex: 'none' }} />
      <span style={{ flex: 1 }}>
        <b style={{ display: 'block', fontSize: 14 }}>{title}</b>
        <span className="muted" style={{ fontSize: 12 }}>{detail}</span>
      </span>
      {!ok && action}
      {link}
    </div>
  );
}
