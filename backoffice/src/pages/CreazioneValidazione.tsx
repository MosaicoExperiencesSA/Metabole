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
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [activeFamilyKey, setActiveFamilyKey] = useState<string | null>(null);
  const [genAll, setGenAll] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [famBusy, setFamBusy] = useState(false);
  const [famMsg, setFamMsg] = useState<string | null>(null);

  const [days, setDays] = useState(28);
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

  useEffect(() => { void loadFamilyStatuses(); }, [activeFamilyKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickFamily(fam: Family) {
    const p = fam.variants[0];
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
    setForm((f) => ({ ...f, meals: f.meals.includes(code) ? f.meals.filter((c) => c !== code) : [...f.meals, code] }));
    setDirty(true);
  }

  async function saveAsNew() {
    if (!form.label.trim()) { setError('Dai un nome alla dieta.'); return; }
    if (form.regimes.length === 0) { setError('Seleziona almeno un regime.'); return; }
    if (form.objectives.length === 0) { setError('Seleziona almeno un obiettivo.'); return; }
    if (form.meals.length === 0) { setError('Seleziona almeno una struttura pasti (3, 5 o digiuno).'); return; }
    const regLabel = (code: string) => regimes.find((r) => r.code === code)?.label ?? code;
    // Prodotto cartesiano regime × obiettivo × pasti, saltando le combinazioni già presenti
    // (INTEGRA: le varianti esistenti non si toccano, si aggiungono solo le mancanti).
    const combos: { regime: string; objective: string; meals: string }[] = [];
    for (const rc of form.regimes) for (const oc of form.objectives) for (const mc of form.meals) {
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
    const targets: Preset[] = (genAll && activeFamily)
      ? activeFamily.variants
      : ((presets ?? []).filter((p) => p.id === activePresetId));
    if (targets.length === 0) { setError('Scegli o salva una dieta prima di generare.'); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      let firstDietId: string | null = null;
      let generated = 0; let kept = 0;
      for (const t of targets) {
        // INTEGRA, non sovrascrive: una variante già generata viene lasciata intatta.
        // Solo sul singolo (non "genera tutte") si può scegliere di sostituirla.
        let r = await api<{ dietId: string; alreadyExists?: boolean }>(`/engine-rules/presets/${t.id}/generate-catalog`, { method: 'POST', body: JSON.stringify({ days }) });
        if (r.alreadyExists && targets.length === 1) {
          // eslint-disable-next-line no-alert
          if (confirm('Questa variante ha già un catalogo generato. Vuoi SOSTITUIRLO con una nuova generazione? (Annulla = tienilo così)')) {
            r = await api<{ dietId: string; alreadyExists?: boolean }>(`/engine-rules/presets/${t.id}/generate-catalog`, { method: 'POST', body: JSON.stringify({ days, replace: true }) });
          }
        }
        if (r.alreadyExists) kept += 1; else generated += 1;
        if (!firstDietId) firstDietId = r.dietId;
      }
      if (firstDietId) { try { localStorage.setItem(LS_DIET, firstDietId); } catch { /* no-op */ } setDietId(firstDietId); }
      void loadFamilyStatuses();
      setNotice(targets.length > 1
        ? `Fatto: ${generated} catalogo/i generato/i${kept ? `, ${kept} già esistenti lasciati intatti` : ''} (una variante per combinazione regime × obiettivo × pasti). Validali e pubblicali tutti insieme al passo 3.`
        : generated > 0
          ? 'Catalogo bozza generato. Procedi con la validazione qui sotto.'
          : 'La variante aveva già il suo catalogo: lasciato intatto.');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Generazione non riuscita (verifica AI_API_KEY su Render).'); }
    finally { setBusy(false); }
  }

  /**
   * Valida e pubblica/invia TUTTE le varianti generate della famiglia in un colpo
   * (gemello di "Genera tutte le varianti"). Per ogni dieta della famiglia (match nome+stile):
   * attiva ricette → conferma allergeni → approva gruppi, poi pubblica (capo) o invia in revisione.
   */
  async function publishAllFamily() {
    if (!activeFamily) return;
    setFamBusy(true); setFamMsg(null); setError(null); setNotice(null);
    let fam: { id: string; name: string; regime: string; style: string; objective?: string | null; mealsPerDay?: number; fasting?: boolean }[] = [];
    try {
      const all = await api<{ id: string; name: string; regime: string; style: string; objective?: string | null; mealsPerDay?: number; fasting?: boolean }[]>('/diets');
      fam = (all ?? []).filter((d) => d.name === activeFamily.label && d.style === activeFamily.style);
    } catch { setFamBusy(false); setError('Impossibile leggere le diete della famiglia.'); return; }
    if (!fam.length) { setFamBusy(false); setFamMsg('Nessuna dieta generata per questa famiglia: genera prima le varianti (passo 2).'); return; }
    const errs: string[] = [];
    const tag = (v: { regime: string; objective?: string | null; mealsPerDay?: number; fasting?: boolean }) => `${v.regime}${v.objective ? ' · ' + v.objective : ''}${v.fasting ? ' · digiuno' : v.mealsPerDay ? ` · ${v.mealsPerDay} pasti` : ''}`;
    // Pass 1 — contenuti (ricette, allergeni, gruppi) su ogni variante.
    for (const v of fam) {
      try {
        await api(`/engine-rules/diets/${v.id}/activate-recipes`, { method: 'POST', body: JSON.stringify({}) });
        await api(`/engine-rules/diets/${v.id}/review-allergens`, { method: 'POST', body: JSON.stringify({}) });
        await api(`/engine-rules/diets/${v.id}/approve-groups`, { method: 'POST', body: JSON.stringify({}) });
      } catch (e) { errs.push(`${tag(v)} (validazione): ${e instanceof ApiError ? e.message : 'errore'}`); }
    }
    // Pass 2 — pubblica (capo) o invia in revisione, dopo che i gruppi sono approvati.
    let done = 0;
    for (const v of fam) {
      try {
        await api(`/diets/${v.id}/${isResponsabile ? 'publish' : 'submit'}`, { method: 'POST', body: JSON.stringify({}) });
        done += 1;
      } catch (e) { errs.push(`${tag(v)} (${isResponsabile ? 'pubblica' : 'invio'}): ${e instanceof ApiError ? e.message : 'errore'}`); }
    }
    setFamBusy(false);
    const verb = isResponsabile ? 'pubblicate' : 'inviate in revisione';
    if (errs.length) {
      // Qualcosa da rivedere: la pagina resta aperta con gli stati aggiornati.
      setFamMsg(`Completate ${done}/${fam.length} varianti (${verb}). Da rivedere: ${errs.join(' · ')}`);
      void loadFamilyStatuses();
      if (dietId) { try { setStatus(await api<ReviewStatus>(`/engine-rules/diets/${dietId}/review-status`)); } catch { /* no-op */ } }
      return;
    }
    // Tutto ok → la pagina si AZZERA, pronta per la prossima famiglia (come la pubblicazione singola).
    const famLabel = activeFamily?.label ?? '';
    try { localStorage.removeItem(LS_DIET); } catch { /* no-op */ }
    setDietId(null); setStatus(null); setActivePresetId(null); setActiveFamilyKey(null);
    setGenAll(false); setDirty(false); setFamVariants([]); setFamMsg(null);
    setForm({ label: '', style: '', regimes: ['omnivore'], objectives: ['dimagrimento'], meals: ['5'], clinicalNotes: '', kcalTarget: 1500, proteinMin: 20, proteinMax: 35, kcalTol: 15 });
    setNotice(`Famiglia "${famLabel}" completata ✓ tutte le ${fam.length} varianti ${verb}. La pagina è pronta per un nuovo lavoro.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function act(path: string) {
    if (!dietId) return;
    setBusy(true); setError(null);
    try { setStatus(await api<ReviewStatus>(`/engine-rules/diets/${dietId}/${path}`, { method: 'POST', body: JSON.stringify({}) })); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Operazione non riuscita.'); }
    finally { setBusy(false); }
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
      setDietId(null); setStatus(null); setActivePresetId(null); setActiveFamilyKey(null); setGenAll(false); setDirty(false);
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
    setDietId(null); setStatus(null); setNotice(null);
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
  // Riepilogo combinazioni selezionate (regime × obiettivo): quante nuove, quante già presenti.
  const selectedCombos: string[] = [];
  for (const rc of form.regimes) for (const oc of form.objectives) for (const mc of form.meals) selectedCombos.push(comboKeyOf(rc, oc, mc));
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
                    const on = form.meals.includes(m.v);
                    return (
                      <button key={m.v} type="button" className={`btn ${on ? '' : 'ghost'} sm`}
                        onClick={() => toggleMeal(m.v)}
                        title={on ? 'Rimuovi dalla selezione' : m.v === 'fasting' ? 'Digiuno intermittente 16:8 (pasti nella finestra 12-20)' : 'Aggiungi questa struttura pasti'}>
                        {on && <i className="ti ti-check" />} {m.l}
                      </button>
                    );
                  })}
                </div>
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
        <p className="hint" style={{ marginTop: 0 }}>Crea una bozza (ricette, giornate, alternative, allergeni) dalla dieta scelta. Può richiedere fino a un minuto.</p>
        {activeFamily && activeFamily.variants.length > 1 && (
          <label className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <input type="checkbox" checked={genAll} onChange={(e) => setGenAll(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Genera <b>tutte le {activeFamily.variants.length} varianti</b> del gruppo (ricette, allergeni, giornate e gruppi di equivalenza per ogni combinazione regime × obiettivo)</span>
          </label>
        )}
        <label className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <span className="muted" style={{ fontSize: 13 }}>Giorni da generare</span>
          <input className="input" type="number" min={1} max={60} value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
            style={{ width: 90 }} />
          <span className="muted" style={{ fontSize: 12 }}>(consigliato 28 = un mese)</span>
        </label>
        <button className="btn" onClick={generate} disabled={busy || !canGenerate}>
          {busy && !status ? (
            <>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.45)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginRight: 6, verticalAlign: '-2px' }} />
              Genero…
            </>
          ) : (
            <>
              <i className="ti ti-sparkles" /> Genera catalogo bozza
            </>
          )}
        </button>
        {busy && !status && (
          <p className="muted" style={{ fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--line)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flex: 'none' }} />
            Sto generando ricette, giornate, alternative e allergeni… può richiedere fino a un minuto.
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
                return (
                  <button key={v.dietId} type="button" className={`chip ${sel ? '' : 'gray'}`}
                    onClick={() => { try { localStorage.setItem(LS_DIET, v.dietId); } catch { /* no-op */ } setDietId(v.dietId); }}
                    style={{ cursor: 'pointer', borderColor: sel ? 'var(--teal)' : undefined }}
                    title={v.status === 'approved' ? 'Pubblicata' : v.ready ? 'Pronta da pubblicare' : 'Passi da completare'}>
                    <i className={`ti ${v.status === 'approved' ? 'ti-rosette-discount-check' : v.ready ? 'ti-circle-check' : 'ti-progress'}`}
                      style={{ marginRight: 4, color: v.status === 'approved' || v.ready ? 'var(--ok-ink)' : undefined }} />
                    {regLabelOf(v.regime)} · {objLabel(v.objective)} · {mealLabel(v.meals)}{v.status === 'approved' ? ' · pubblicata' : v.ready ? ' · pronta' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {!s ? (
          <p className="muted" style={{ marginTop: 0 }}>Genera un catalogo per iniziare la validazione guidata.</p>
        ) : (
          <>
            <p className="hint" style={{ marginTop: 0 }}>Bozza: <b>{s.name}</b> · stato {s.status}. Completa i passi (le spunte si aggiornano da sole).</p>
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
            {activeFamily && activeFamily.variants.length > 1 && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: '1px solid var(--teal)', background: 'var(--chip)' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Tutta la famiglia in un colpo</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  Valida (ricette, allergeni, gruppi) e {isResponsabile ? 'pubblica' : 'invia in revisione'} <b>tutte le {activeFamily.variants.length} varianti</b> (regime × obiettivo) della famiglia, senza farlo una per una. Le clienti scelgono lo stile e il motore pesca la variante giusta per regime e obiettivo.
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
                {famMsg && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{famMsg}</div>}
              </div>
            )}
            <div className="row" style={{ gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={publish} disabled={busy || !allReady} title={allReady ? '' : 'Completa tutti i passi'}>
                <i className={`ti ${isResponsabile ? 'ti-rosette-discount-check' : 'ti-send'}`} /> {isResponsabile ? 'Approva e pubblica (solo questa)' : 'Invia in revisione (solo questa)'}
              </button>
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
