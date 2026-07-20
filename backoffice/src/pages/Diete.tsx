import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Spinner } from '../components/ui';
import { useTaxonomy } from '../lib/taxonomy';

const SLOT_LABEL: Record<string, string> = { breakfast: 'Colazione', morning_snack: 'Spuntino', lunch: 'Pranzo', afternoon_snack: 'Merenda', dinner: 'Cena' };
function slotsFor(mealsPerDay: number, fasting = false): string[] {
  if (fasting) return ['lunch', 'afternoon_snack', 'dinner']; // digiuno 16:8, finestra 12-20
  if (mealsPerDay <= 3) return ['breakfast', 'lunch', 'dinner'];
  if (mealsPerDay === 4) return ['breakfast', 'lunch', 'afternoon_snack', 'dinner'];
  return ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
}

interface RecipeLite { id: string; name: string; mealSlot: string; active?: boolean }
interface DietDetail {
  id: string; regime: string; mealsPerDay: number; fasting?: boolean; status: string;
  dayTemplates: { level: number; dayIndex: number; meals: { slot: string; recipeId: string }[] }[];
}

const OBIETTIVO_LABEL: Record<string, string> = { dimagrimento: 'Dimagrimento', mantenimento: 'Mantenimento' };

interface DietRow {
  id: string;
  name: string;
  regime: string;
  style: string;
  objective?: string | null;
  mealsPerDay: number;
  fasting?: boolean;
  status: string;
  author: { displayName: string } | null;
  approvedBy: { displayName: string } | null;
  _count: { dayTemplates: number };
  updatedAt: string;
}

const STATUS: Record<string, { label: string; chip: string }> = {
  draft: { label: 'Bozza', chip: 'gray' },
  in_review: { label: 'In revisione', chip: 'amber' },
  approved: { label: 'Approvata', chip: '' },
  rejected: { label: 'Rifiutata', chip: 'red' },
};
// Ordine "di lavorazione" per l'ordinamento della colonna Stato.
const STATUS_ORDER: Record<string, number> = { draft: 0, in_review: 1, approved: 2, rejected: 3 };

export function Diete() {
  const { regimeLabel, styleLabel, regimes } = useTaxonomy();
  const { permissions } = useAuth();
  const role = permissions?.role;
  const isHead = role === 'head_nutritionist';
  const isNutri = role === 'nutritionist' || role === 'head_nutritionist';
  const [rows, setRows] = useState<DietRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [regimeF, setRegimeF] = useState(''); // filtro per regime (il catalogo è lungo)
  const [busy, setBusy] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [daysId, setDaysId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  async function load() {
    try {
      setRows(await api<DietRow[]>(`/diets${status ? `?status=${status}` : ''}`));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata a nutrizionisti e amministratori.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  async function del(id: string, name: string) {
    if (!confirm(`Eliminare la dieta "${name}"?\nVengono rimossi anche i suoi giorni e le regole. Non è reversibile.`)) return;
    setBusy(id + 'del'); setError(null);
    try {
      await api(`/diets/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    } finally {
      setBusy(null);
    }
  }

  async function act(id: string, action: 'submit' | 'approve' | 'reject') {
    let body: string | undefined;
    if (action === 'reject') {
      const reason = prompt('Motivazione del rifiuto (facoltativa):') ?? '';
      body = JSON.stringify({ reason });
    }
    setBusy(id + action); setError(null);
    try {
      await api(`/diets/${id}/${action}`, { method: 'POST', ...(body ? { body } : {}) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setBusy(null);
    }
  }

  const showActions = isNutri; // nutrizionisti/capo vedono la colonna azioni

  // Ordinamento client-side (la lista arriva intera): si ordina su ciò che si VEDE (etichette tradotte).
  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const val = (r: DietRow): string | number => {
      switch (sortKey) {
        case 'name': return r.name.toLowerCase();
        case 'regime': return regimeLabel(r.regime).toLowerCase();
        case 'style': return styleLabel(r.style).toLowerCase();
        case 'objective': return (OBIETTIVO_LABEL[r.objective ?? 'dimagrimento'] ?? r.objective ?? '').toLowerCase();
        case 'meals': return r.mealsPerDay + (r.fasting ? 0.5 : 0); // a parità di pasti, il digiuno dopo
        case 'days': return r._count?.dayTemplates ?? 0;
        case 'author': return (r.author?.displayName ?? '').toLowerCase();
        case 'status': return STATUS_ORDER[r.status] ?? 99;
        default: return 0;
      }
    };
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = val(a); const vb = val(b);
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return a.name.localeCompare(b.name); // spareggio stabile sul nome
    });
  }, [rows, sortKey, sortDir, regimeLabel, styleLabel]);

  // Filtro per regime: il catalogo è lungo, mostrarne uno alla volta lo rende leggibile
  // (in combinazione con l'ordinamento per colonna: clicca "Regime" o "Pasti").
  const shown = regimeF ? sorted.filter((r) => r.regime === regimeF) : sorted;

  if (loading) return <Spinner />;

  const th = (label: string, key: string) => (
    <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => toggleSort(key)} title="Clicca per ordinare">
      {label}{sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <>
      <div className="spread" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <p className="muted" style={{ margin: 0 }}>Diete del catalogo (create dai nutrizionisti, approvate dal capo).</p>
        <div className="row" style={{ gap: 8 }}>
          <select className="select" style={{ width: 160 }} value={regimeF} onChange={(e) => setRegimeF(e.target.value)}>
            <option value="">Tutti i regimi</option>
            {regimes.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
          <select className="select" style={{ width: 170 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tutti gli stati</option>
            <option value="draft">Bozze</option>
            <option value="in_review">In revisione</option>
            <option value="approved">Approvate</option>
            <option value="rejected">Rifiutate</option>
          </select>
          {isNutri && <button className="btn" onClick={() => setCreateOpen(true)}><i className="ti ti-plus" /> Nuova dieta</button>}
        </div>
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty">Nessuna dieta.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                {th('Nome', 'name')}
                {th('Regime', 'regime')}
                {th('Stile', 'style')}
                {th('Obiettivo', 'objective')}
                {th('Pasti', 'meals')}
                {th('Giorni', 'days')}
                {th('Autore', 'author')}
                {th('Stato', 'status')}
                {showActions && <th>Azioni</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="muted">{regimeLabel(r.regime)}</td>
                  <td className="muted">{styleLabel(r.style)}</td>
                  <td className="muted">{OBIETTIVO_LABEL[r.objective ?? 'dimagrimento'] ?? r.objective}</td>
                  <td className="muted">{r.fasting ? `${r.mealsPerDay} · digiuno` : r.mealsPerDay}</td>
                  <td className="muted">{r._count?.dayTemplates ?? 0}</td>
                  <td className="muted">{r.author?.displayName ?? '—'}</td>
                  <td><span className={`chip ${STATUS[r.status]?.chip ?? 'gray'}`}>{STATUS[r.status]?.label ?? r.status}</span></td>
                  {showActions && (
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {r.status !== 'approved' && isNutri && (
                          <button className="btn ghost sm" disabled={!!busy} onClick={() => setDaysId(r.id)}><i className="ti ti-calendar" /> Componi giorni</button>
                        )}
                        {isNutri && (
                          <button className="btn ghost sm" disabled={!!busy} onClick={() => setProductId(r.id)}><i className="ti ti-tag" /> Scheda cliente</button>
                        )}
                        {r.status === 'draft' && isNutri && (
                          <button className="btn ghost sm" disabled={!!busy} onClick={() => act(r.id, 'submit')}><i className="ti ti-send" /> Invia in revisione</button>
                        )}
                        {r.status === 'in_review' && isHead && (
                          <>
                            <button className="btn sm" disabled={!!busy} onClick={() => act(r.id, 'approve')}><i className="ti ti-check" /> Approva</button>
                            <button className="btn ghost sm" disabled={!!busy} style={{ color: 'var(--danger)' }} onClick={() => act(r.id, 'reject')}><i className="ti ti-x" /> Rifiuta</button>
                          </>
                        )}
                        {isNutri && (
                          <button className="btn ghost sm" disabled={!!busy} title="Elimina dieta" style={{ color: 'var(--danger)' }} onClick={() => del(r.id, r.name)}><i className="ti ti-trash" /></button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {createOpen && <CreateDietModal onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); void load(); }} />}
      {daysId && <DayEditorModal dietId={daysId} onClose={() => setDaysId(null)} onSaved={() => { setDaysId(null); void load(); }} />}
      {productId && <ProductCardModal dietId={productId} onClose={() => setProductId(null)} onSaved={() => { setProductId(null); void load(); }} />}
    </>
  );
}

/** Modifica la "scheda cliente" (schermo 16) di una dieta esistente, anche approvata. */
function ProductCardModal({ dietId, onClose, onSaved }: { dietId: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ clientName: '', clientDescription: '', highlights: '', objective: 'dimagrimento', seasonalTag: '', clientVisible: false, recommended: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ clientName?: string | null; clientDescription?: string | null; highlights?: string[] | null; objective?: string | null; seasonalTag?: string | null; clientVisible?: boolean; recommended?: boolean }>(`/diets/${dietId}`)
      .then((d) => setF({
        clientName: d.clientName ?? '',
        clientDescription: d.clientDescription ?? '',
        highlights: Array.isArray(d.highlights) ? d.highlights.join('\n') : '',
        objective: d.objective ?? 'dimagrimento',
        seasonalTag: d.seasonalTag ?? '',
        clientVisible: !!d.clientVisible,
        recommended: !!d.recommended,
      }))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Caricamento non riuscito.'))
      .finally(() => setLoading(false));
  }, [dietId]);

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      const highlights = f.highlights.split('\n').map((h) => h.trim()).filter(Boolean).slice(0, 6);
      await api(`/diets/${dietId}/product`, { method: 'PATCH', body: JSON.stringify({
        clientName: f.clientName.trim() || null,
        clientDescription: f.clientDescription.trim() || null,
        highlights,
        objective: f.objective,
        seasonalTag: f.seasonalTag || null,
        clientVisible: f.clientVisible,
        recommended: f.recommended,
      }) });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Scheda cliente (schermo 16)" onClose={onClose}>
      {err && <Banner kind="err">{err}</Banner>}
      {loading ? <p className="muted">Carico…</p> : (
        <div style={{ display: 'grid', gap: 10 }}>
          <label><span className="muted" style={{ fontSize: 12 }}>Nome mostrato al cliente</span>
            <input className="input" value={f.clientName} onChange={(e) => setF({ ...f, clientName: e.target.value })} placeholder="Es. Mediterranea" /></label>
          <label><span className="muted" style={{ fontSize: 12 }}>Descrizione breve</span>
            <textarea className="input" rows={2} value={f.clientDescription} onChange={(e) => setF({ ...f, clientDescription: e.target.value })} /></label>
          <label><span className="muted" style={{ fontSize: 12 }}>Caratteristiche principali (una per riga, max 6)</span>
            <textarea className="input" rows={3} value={f.highlights} onChange={(e) => setF({ ...f, highlights: e.target.value })} /></label>
          <label><span className="muted" style={{ fontSize: 12 }}>Obiettivo</span>
            <select className="select" value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })}>
              <option value="dimagrimento">Dimagrimento</option>
              <option value="mantenimento">Mantenimento</option>
            </select></label>
          <label className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={f.clientVisible} onChange={(e) => setF({ ...f, clientVisible: e.target.checked })} />
            <span style={{ fontSize: 13 }}>Visibile alle clienti nello schermo 16</span></label>
          <label className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={f.recommended} onChange={(e) => setF({ ...f, recommended: e.target.checked })} />
            <span style={{ fontSize: 13 }}>Consigliato <span className="muted" style={{ fontSize: 11 }}>(in evidenza nella sezione "Consigliati")</span></span></label>
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={save} disabled={busy || loading}>{busy ? 'Salvo…' : 'Salva'}</button>
      </div>
    </Modal>
  );
}

function CreateDietModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { regimes, styles } = useTaxonomy();
  const [f, setF] = useState({ name: '', regime: 'omnivore', style: 'mediterranean', mealsPerDay: 5, fasting: false, clientName: '', clientDescription: '', highlights: '', objective: 'dimagrimento', seasonalTag: '', clientVisible: false, recommended: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    if (f.name.trim().length < 2) { setErr('Dai un nome alla dieta.'); return; }
    setBusy(true);
    try {
      const highlights = f.highlights.split('\n').map((h) => h.trim()).filter(Boolean).slice(0, 6);
      await api('/diets', { method: 'POST', body: JSON.stringify({
        name: f.name.trim(), regime: f.regime, style: f.style, mealsPerDay: f.mealsPerDay, fasting: f.fasting,
        clientName: f.clientName.trim() || undefined,
        clientDescription: f.clientDescription.trim() || undefined,
        highlights: highlights.length ? highlights : undefined,
        objective: f.objective,
        seasonalTag: f.seasonalTag || undefined,
        clientVisible: f.clientVisible,
        recommended: f.recommended,
      }) });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Creazione non riuscita.');
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Nuova dieta" onClose={onClose}>
      {err && <Banner kind="err">{err}</Banner>}
      <div style={{ display: 'grid', gap: 10 }}>
        <label><span className="muted" style={{ fontSize: 12 }}>Nome</span>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Es. Equilibrio Mediterraneo" /></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Regime</span>
          <select className="select" value={f.regime} onChange={(e) => setF({ ...f, regime: e.target.value })}>{regimes.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}</select></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Stile</span>
          <input className="input" list="diet-styles-list" value={f.style} onChange={(e) => setF({ ...f, style: e.target.value })} placeholder="Scegli o digita uno stile" /><datalist id="diet-styles-list">{styles.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}</datalist></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Pasti al giorno</span>
          <select className="select" value={f.mealsPerDay} onChange={(e) => setF({ ...f, mealsPerDay: Number(e.target.value) })}>{[3, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={f.fasting} onChange={(e) => setF({ ...f, fasting: e.target.checked, mealsPerDay: e.target.checked ? 3 : f.mealsPerDay })} />
          <span style={{ fontSize: 13 }}>Digiuno intermittente 16:8 <span className="muted" style={{ fontSize: 11 }}>(pasti nella finestra 12-20, niente colazione)</span></span>
        </label>

        <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0 0', paddingTop: 10 }}>
          <b style={{ fontSize: 13 }}>Scheda cliente (schermo 16)</b>
          <p className="muted" style={{ fontSize: 11, margin: '2px 0 8px' }}>Cosa vede la cliente quando sceglie il piano.</p>
        </div>
        <label><span className="muted" style={{ fontSize: 12 }}>Nome mostrato al cliente</span>
          <input className="input" value={f.clientName} onChange={(e) => setF({ ...f, clientName: e.target.value })} placeholder="Es. Mediterranea" /></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Descrizione breve</span>
          <textarea className="input" rows={2} value={f.clientDescription} onChange={(e) => setF({ ...f, clientDescription: e.target.value })} placeholder="Una riga che spiega il piano." /></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Caratteristiche principali (una per riga, max 6)</span>
          <textarea className="input" rows={3} value={f.highlights} onChange={(e) => setF({ ...f, highlights: e.target.value })} placeholder={'Alta sazietà\nSostiene la massa muscolare'} /></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Obiettivo</span>
          <select className="select" value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })}>
            <option value="dimagrimento">Dimagrimento</option>
            <option value="mantenimento">Mantenimento</option>
          </select></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Stagione (per i protocolli stagionali)</span>
          <select className="select" value={f.seasonalTag} onChange={(e) => setF({ ...f, seasonalTag: e.target.value })}>
            <option value="">Nessuna (tutto l'anno)</option>
            <option value="estate">Estate</option>
            <option value="inverno">Inverno</option>
            <option value="primavera">Primavera</option>
            <option value="autunno">Autunno</option>
          </select></label>
        <label className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={f.clientVisible} onChange={(e) => setF({ ...f, clientVisible: e.target.checked })} />
          <span style={{ fontSize: 13 }}>Visibile alle clienti nello schermo 16</span></label>
        <label className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={f.recommended} onChange={(e) => setF({ ...f, recommended: e.target.checked })} />
          <span style={{ fontSize: 13 }}>Consigliato <span className="muted" style={{ fontSize: 11 }}>(in evidenza nella sezione "Consigliati")</span></span></label>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Creo…' : 'Crea e componi'}</button>
      </div>
      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Dopo la creazione potrai comporre i giorni con “Componi giorni”.</p>
    </Modal>
  );
}

function DayEditorModal({ dietId, onClose, onSaved }: { dietId: string; onClose: () => void; onSaved: () => void }) {
  const { regimeLabel } = useTaxonomy();
  const [diet, setDiet] = useState<DietDetail | null>(null);
  const [recipes, setRecipes] = useState<RecipeLite[]>([]);
  // days[dayIdx][slot] = recipeId
  const [days, setDays] = useState<Record<string, string>[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await api<DietDetail>(`/diets/${dietId}`);
        setDiet(d);
        const lvl1 = d.dayTemplates.filter((t) => t.level === 1).sort((a, b) => a.dayIndex - b.dayIndex);
        const initial = lvl1.length
          ? lvl1.map((t) => Object.fromEntries(t.meals.map((m) => [m.slot, m.recipeId])))
          : [Object.create(null) as Record<string, string>];
        setDays(initial);
        setRecipes(await api<RecipeLite[]>(`/recipes?regime=${d.regime}&includeInactive=true`));
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Caricamento non riuscito.');
      }
    })();
  }, [dietId]);

  if (err && !diet) return <Modal title="Componi giorni" onClose={onClose}><Banner kind="err">{err}</Banner></Modal>;
  if (!diet) return <Modal title="Componi giorni" onClose={onClose}><Spinner /></Modal>;

  const slots = slotsFor(diet.mealsPerDay, diet.fasting ?? false);
  const bySlot = (slot: string) => recipes.filter((r) => r.mealSlot === slot);

  function setMeal(dayI: number, slot: string, recipeId: string) {
    setDays((ds) => ds.map((d, i) => (i === dayI ? { ...d, [slot]: recipeId } : d)));
  }

  async function save() {
    setErr(null);
    // Ogni giorno deve avere tutti gli slot compilati.
    for (let i = 0; i < days.length; i++) {
      for (const s of slots) {
        if (!days[i][s]) { setErr(`Giorno ${i + 1}: manca ${SLOT_LABEL[s]}.`); return; }
      }
    }
    const payload = {
      days: days.map((d, i) => ({ level: 1, dayIndex: i + 1, meals: slots.map((s) => ({ slot: s, recipeId: d[s] })) })),
    };
    setBusy(true);
    try {
      await api(`/diets/${dietId}/days`, { method: 'PUT', body: JSON.stringify(payload) });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Componi i giorni della dieta" onClose={onClose}>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        {regimeLabel(diet.regime)} · {diet.mealsPerDay} pasti · assegna una ricetta a ogni pasto di ogni giorno. Salvando, la dieta torna in bozza da inviare in revisione.
      </p>
      {err && <Banner kind="err">{err}</Banner>}

      <div style={{ display: 'grid', gap: 10 }}>
        {days.map((day, i) => (
          <div key={i} className="card" style={{ margin: 0, padding: 12 }}>
            <div className="spread" style={{ marginBottom: 6 }}>
              <b style={{ fontSize: 13 }}>Giorno {i + 1}</b>
              {days.length > 1 && <button className="btn ghost sm" title="Rimuovi giorno" onClick={() => setDays((ds) => ds.filter((_, j) => j !== i))}><i className="ti ti-trash" /></button>}
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {slots.map((s) => (
                <label key={s} className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span className="muted" style={{ fontSize: 12, width: 84, flex: 'none' }}>{SLOT_LABEL[s]}</span>
                  <select className="select" style={{ flex: 1 }} value={day[s] ?? ''} onChange={(e) => setMeal(i, s, e.target.value)}>
                    <option value="">— scegli —</option>
                    {bySlot(s).map((r) => <option key={r.id} value={r.id}>{r.active === false ? `${r.name} (bozza)` : r.name}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setDays((ds) => [...ds, Object.create(null)])}><i className="ti ti-plus" /> Aggiungi giorno</button>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={save} disabled={busy}><i className="ti ti-device-floppy" /> {busy ? 'Salvo…' : 'Salva giorni'}</button>
      </div>
      {recipes.length === 0 && <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Nessuna ricetta {regimeLabel(diet.regime).toLowerCase()} disponibile: creane prima nel Catalogo ricette.</p>}
    </Modal>
  );
}
