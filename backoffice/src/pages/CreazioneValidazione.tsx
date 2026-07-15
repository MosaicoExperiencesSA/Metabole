import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';
import { useTaxonomy } from '../lib/taxonomy';
import { useAuth } from '../auth/AuthContext';

type Preset = {
  id: string; style: string; label: string; description?: string | null;
  regime?: string | null; objective?: string | null; rules?: Record<string, unknown> | null;
  clinicalNotes?: string | null; suggested?: boolean;
};
type ReviewStatus = {
  dietId: string; name: string; status: string; mealsPerDay: number;
  recipes: { total: number; active: number; allergensReviewed: number };
  days: { total: number; complete: number };
  groups: { total: number; approved: number };
};

const LS_DIET = 'metabole_bo_wizard_diet';
const OBIETTIVI = [{ v: 'dimagrimento', l: 'Dimagrimento' }, { v: 'mantenimento', l: 'Mantenimento' }];
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

  const [form, setForm] = useState({ label: '', style: '', regime: 'omnivore', objective: 'dimagrimento', clinicalNotes: '', kcalTarget: 1500, proteinMin: 20, proteinMax: 35, kcalTol: 15 });
  const [sourceRules, setSourceRules] = useState<Record<string, unknown>>({});
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [days, setDays] = useState(28);
  const [dietId, setDietId] = useState<string | null>(() => { try { return localStorage.getItem(LS_DIET); } catch { return null; } });
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const { user } = useAuth();
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

  function pickPreset(p: Preset) {
    const r = (p.rules as Record<string, unknown>) || {};
    setForm({
      label: p.label, style: p.style, regime: (p.regime as string) || 'omnivore', objective: (p.objective as string) || 'dimagrimento', clinicalNotes: p.clinicalNotes || '',
      kcalTarget: Math.round(Number(r.menu_daycombo_kcal_target ?? 1500)) || 1500,
      proteinMin: Math.round(Number(r.menu_daycombo_protein_min ?? 0.2) * 100),
      proteinMax: Math.round(Number(r.menu_daycombo_protein_max ?? 0.35) * 100),
      kcalTol: Math.round(Number(r.menu_kcal_balance_tolerance_pct ?? 15)),
    });
    setSourceRules(r);
    setActivePresetId(p.id); setDirty(false); setNotice(null); setError(null);
  }
  function newPreset() {
    setForm({ label: '', style: 'custom', regime: 'omnivore', objective: 'dimagrimento', clinicalNotes: '', kcalTarget: 1500, proteinMin: 20, proteinMax: 35, kcalTol: 15 });
    setSourceRules({}); setActivePresetId(null); setDirty(true); setNotice(null); setError(null);
  }
  function edit(k: 'label' | 'style' | 'regime' | 'objective' | 'clinicalNotes', v: string) { setForm((f) => ({ ...f, [k]: v })); setDirty(true); }
  function editNum(k: 'kcalTarget' | 'proteinMin' | 'proteinMax' | 'kcalTol', v: number) { setForm((f) => ({ ...f, [k]: v })); setDirty(true); }

  async function saveAsNew() {
    if (!form.label.trim()) { setError('Dai un nome alla dieta.'); return; }
    setBusy(true); setError(null);
    try {
      const created = await api<Preset>('/engine-rules/presets', { method: 'POST', body: JSON.stringify({
        label: form.label.trim(), style: form.style || 'custom', regime: form.regime, objective: form.objective,
        clinicalNotes: form.clinicalNotes || undefined, suggested: false,
        rules: { ...sourceRules, menu_daycombo_kcal_target: form.kcalTarget, menu_daycombo_protein_min: form.proteinMin / 100, menu_daycombo_protein_max: form.proteinMax / 100, menu_kcal_balance_tolerance_pct: form.kcalTol },
      }) });
      setActivePresetId(created.id); setDirty(false);
      setPresets((ps) => (ps ? [created, ...ps] : [created]));
      setNotice('Dieta salvata. Ora puoi generare il catalogo.');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.'); }
    finally { setBusy(false); }
  }

  async function generate() {
    if (!activePresetId) { setError('Scegli o salva una dieta prima di generare.'); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      const r = await api<{ dietId: string }>(`/engine-rules/presets/${activePresetId}/generate-catalog`, { method: 'POST', body: JSON.stringify({ days }) });
      try { localStorage.setItem(LS_DIET, r.dietId); } catch { /* no-op */ }
      setDietId(r.dietId);
      setNotice('Catalogo bozza generato. Procedi con la validazione qui sotto.');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Generazione non riuscita (verifica AI_API_KEY su Render).'); }
    finally { setBusy(false); }
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
      setDietId(null); setStatus(null); setActivePresetId(null); setDirty(false);
      setForm({ label: '', style: '', regime: 'omnivore', objective: 'dimagrimento', clinicalNotes: '', kcalTarget: 1500, proteinMin: 20, proteinMax: 35, kcalTol: 15 });
      setNotice(isResponsabile ? 'Dieta approvata e pubblicata ✓ La pagina è pronta per un nuovo lavoro.' : 'Dieta inviata in revisione ✓ La pagina è pronta per un nuovo lavoro.');
    } catch (e) { setError(e instanceof ApiError ? e.message : isResponsabile ? 'Pubblicazione non riuscita.' : 'Invio non riuscito.'); }
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
          {presets.map((p) => (
            <button key={p.id} className="chip" onClick={() => pickPreset(p)}
              style={{ cursor: 'pointer', gap: 6, borderColor: activePresetId === p.id ? 'var(--teal)' : undefined, background: activePresetId === p.id ? 'var(--chip)' : undefined }}>
              <i className="ti ti-bulb" /> {p.label}{p.suggested ? ' · suggerita' : ''}
            </button>
          ))}
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
                <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Regime</span>
                <select className="select" value={form.regime} onChange={(e) => edit('regime', e.target.value)}>
                  {regimes.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
              </label>
              <label style={{ flex: 1, minWidth: 160 }}>
                <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Obiettivo</span>
                <select className="select" value={form.objective} onChange={(e) => edit('objective', e.target.value)}>
                  {OBIETTIVI.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </label>
            </div>
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
              <button className="btn ghost" onClick={saveAsNew} disabled={busy}><i className="ti ti-device-floppy" /> Salva come nuova dieta</button>
              {dirty && <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>Modifiche non salvate: salva per poter generare.</span>}
            </div>
          </div>
        )}
      </div>

      {/* PASSO 2 — Genera */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}><span className="chip" style={{ marginRight: 8 }}>2</span> Genera il catalogo</h2>
        <p className="hint" style={{ marginTop: 0 }}>Crea una bozza (ricette, giornate, alternative, allergeni) dalla dieta scelta. Può richiedere fino a un minuto.</p>
        <label className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <span className="muted" style={{ fontSize: 13 }}>Giorni da generare</span>
          <input className="input" type="number" min={1} max={60} value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
            style={{ width: 90 }} />
          <span className="muted" style={{ fontSize: 12 }}>(consigliato 28 = un mese)</span>
        </label>
        <button className="btn" onClick={generate} disabled={busy || !canGenerate}>
          <i className="ti ti-sparkles" /> {busy && !status ? 'Genero…' : 'Genera catalogo bozza'}
        </button>
        {!canGenerate && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Scegli una dieta (o salvala se l'hai modificata) per abilitare la generazione.</p>}
      </div>

      {/* PASSO 3 — Valida */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}><span className="chip" style={{ marginRight: 8 }}>3</span> Valida e pubblica</h2>
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
            <div className="row" style={{ gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={publish} disabled={busy || !allReady} title={allReady ? '' : 'Completa tutti i passi'}>
                <i className={`ti ${isResponsabile ? 'ti-rosette-discount-check' : 'ti-send'}`} /> {isResponsabile ? 'Approva e pubblica' : 'Invia in revisione'}
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
