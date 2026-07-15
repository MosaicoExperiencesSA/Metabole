import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useTaxonomy } from '../lib/taxonomy';
import { Banner, Modal, Spinner, Toggle } from '../components/ui';
import { useAuth } from '../auth/AuthContext';

/**
 * Regole del motore — pagina del CAPO NUTRIZIONISTA.
 * 1) Regole GLOBALI (valgono per tutte le diete, attive subito).
 * 2) Regole SUGGERITE per tipo di nutrizione (letteratura, flag "suggerita"): modifica/aggiungi/applica a una dieta.
 * 3) Proposte di regole nuove (le implementiamo noi).
 */
interface Rule {
  code: string; label: string; description: string; category: string;
  kind: 'boolean' | 'number'; default: number | boolean;
  min?: number; max?: number; step?: number; unit?: string; perDiet?: boolean;
  global: number | boolean; isSet: boolean;
}
interface BaseRule { code: string; phase: 'A' | 'B'; title: string; description: string }
interface Catalog { categories: { key: string; label: string }[]; rules: Rule[]; baseRules: BaseRule[] }
interface Preset {
  id: string; style: string; label: string; description: string | null;
  regime: string | null; objective: string | null; rules: Record<string, number | boolean>;
  clinicalNotes: string | null; source: string | null; suggested: boolean; sortOrder: number;
}
interface Proposal { id: string; title: string | null; text: string; status: string; createdAt: string }
interface DietRow { id: string; name: string; style: string }

const STYLE_LABEL: Record<string, string> = { mediterranean: 'Mediterranea', protein: 'Proteica', low_carb: 'Low carb', flexible: 'Flessibile', keto: 'Keto', dash: 'DASH' };

export function RegoleMotore() {
  const { can } = useAuth();
  const canManage = can('engine_rules', 'manage');
  const [tab, setTab] = useState<'globali' | 'suggerite' | 'proposte'>('globali');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [diets, setDiets] = useState<DietRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editPreset, setEditPreset] = useState<Preset | 'new' | null>(null);
  const [applyPreset, setApplyPreset] = useState<Preset | null>(null);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  async function generateCatalog(p: Preset) {
    if (!confirm(`Generare con l'AI una BOZZA di catalogo per "${p.label}"?\nCrea ricette, giornate, alternative e pre-tag allergeni in bozza: dovrai rivederli e approvarli. Può richiedere fino a un minuto.`)) return;
    setGenerating(p.id); setError(null); setNotice(null);
    try {
      const r = await api<{ dietName: string; recipes: number; days: number; groups: number }>(`/engine-rules/presets/${p.id}/generate-catalog`, { method: 'POST', body: JSON.stringify({}) });
      setNotice(`Bozza creata: "${r.dietName}" con ${r.recipes} ricette, ${r.days} giornate e ${r.groups} gruppi di equivalenza. Rivedila in Catalogo diete e conferma gli allergeni.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generazione non riuscita.');
    } finally { setGenerating(null); }
  }

  async function load() {
    setLoading(true); setError(null);
    try {
      const [c, p, pr, d] = await Promise.all([
        api<Catalog>('/engine-rules/catalog'),
        api<Preset[]>('/engine-rules/presets'),
        api<Proposal[]>('/engine-rules/proposals'),
        api<DietRow[]>('/diets').catch(() => [] as DietRow[]),
      ]);
      setCatalog(c); setPresets(p); setProposals(pr); setDiets(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  if (loading) return <Spinner />;

  return (
    <>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <TabBtn active={tab === 'globali'} onClick={() => setTab('globali')} icon="ti-adjustments">Regole globali</TabBtn>
        <TabBtn active={tab === 'suggerite'} onClick={() => setTab('suggerite')} icon="ti-bulb">Regole suggerite per nutrizione</TabBtn>
        <TabBtn active={tab === 'proposte'} onClick={() => setTab('proposte')} icon="ti-message-plus">Proposte</TabBtn>
      </div>

      {tab === 'globali' && catalog && (
        <GlobalRules catalog={catalog} canManage={canManage}
          onSaved={(msg) => { setNotice(msg); void load(); }} onError={setError} />
      )}

      {tab === 'suggerite' && (
        <div>
          <div className="spread" style={{ marginBottom: 12 }}>
            <p className="muted" style={{ margin: 0 }}>Regole base per tipo di nutrizione, fondate sulla letteratura. Il badge <b>Suggerita</b> indica quelle proposte da noi: puoi modificarle, aggiungerne e applicarle a una dieta.</p>
            {canManage && <button className="btn" onClick={() => setEditPreset('new')}><i className="ti ti-plus" /> Nuova regola</button>}
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {presets.map((p) => (
              <PresetCard key={p.id} preset={p} catalog={catalog} canManage={canManage}
                generating={generating === p.id}
                onGenerate={() => generateCatalog(p)}
                onEdit={() => setEditPreset(p)} onApply={() => setApplyPreset(p)}
                onDelete={async () => {
                  if (!confirm(`Eliminare "${p.label}"?`)) return;
                  try { await api(`/engine-rules/presets/${p.id}`, { method: 'DELETE' }); setNotice('Regola eliminata.'); void load(); }
                  catch (e) { setError(e instanceof Error ? e.message : 'Eliminazione non riuscita.'); }
                }} />
            ))}
            {presets.length === 0 && <div className="empty">Nessuna regola suggerita.</div>}
          </div>
        </div>
      )}

      {tab === 'proposte' && (
        <div>
          <div className="spread" style={{ marginBottom: 12 }}>
            <p className="muted" style={{ margin: 0 }}>Una regola nuova (con un comportamento nuovo) richiede sviluppo: descrivila qui, la implementiamo noi.</p>
            {canManage && <button className="btn" onClick={() => setProposeOpen(true)}><i className="ti ti-message-plus" /> Proponi una regola</button>}
          </div>
          <div className="card" style={{ padding: 0 }}>
            {proposals.length === 0 ? <div className="empty">Nessuna proposta.</div> : (
              <table className="grid">
                <thead><tr><th>Titolo</th><th>Descrizione</th><th style={{ width: 110 }}>Stato</th></tr></thead>
                <tbody>
                  {proposals.map((p) => (
                    <tr key={p.id}>
                      <td>{p.title || '—'}</td>
                      <td className="muted" style={{ whiteSpace: 'pre-wrap' }}>{p.text}</td>
                      <td><span className={`chip ${p.status === 'approved' ? 'ok' : p.status === 'rejected' ? 'err' : ''}`}>{p.status === 'pending' ? 'In attesa' : p.status === 'approved' ? 'Approvata' : 'Rifiutata'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {editPreset && catalog && (
        <PresetModal preset={editPreset === 'new' ? null : editPreset} catalog={catalog}
          onClose={() => setEditPreset(null)}
          onSaved={() => { setEditPreset(null); setNotice('Regola salvata.'); void load(); }}
          onError={setError} />
      )}
      {applyPreset && (
        <ApplyModal preset={applyPreset} diets={diets} onClose={() => setApplyPreset(null)}
          onApplied={(n) => { setApplyPreset(null); setNotice(`Applicata alla dieta: ${n} parametri impostati.`); }}
          onError={setError} />
      )}
      {proposeOpen && (
        <ProposeModal onClose={() => setProposeOpen(false)}
          onSaved={() => { setProposeOpen(false); setNotice('Proposta inviata.'); void load(); }} onError={setError} />
      )}
    </>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: string; children: React.ReactNode }) {
  return <button className={`btn ${active ? '' : 'ghost'} sm`} onClick={onClick}><i className={`ti ${icon}`} /> {children}</button>;
}

function fmtVal(r: Rule, v: number | boolean) {
  if (r.kind === 'boolean') return v ? 'Attiva' : 'Spenta';
  return `${v}${r.unit && r.unit !== 'frazione' ? ' ' + r.unit : ''}`;
}

function GlobalRules({ catalog, canManage, onSaved, onError }: { catalog: Catalog; canManage: boolean; onSaved: (m: string) => void; onError: (m: string) => void }) {
  const [draft, setDraft] = useState<Record<string, number | boolean>>(() => Object.fromEntries(catalog.rules.map((r) => [r.code, r.global])));
  const [savingCode, setSavingCode] = useState<string | null>(null);

  async function save(r: Rule) {
    setSavingCode(r.code);
    try {
      await api(`/engine-rules/global/${r.code}`, { method: 'PATCH', body: JSON.stringify({ value: draft[r.code] }) });
      onSaved(`"${r.label}" aggiornata.`);
    } catch (e) { onError(e instanceof Error ? e.message : 'Salvataggio non riuscito.'); }
    finally { setSavingCode(null); }
  }

  const baseRules = catalog.baseRules ?? [];
  const phaseLabel: Record<string, string> = { A: 'Fase A — Costruzione della base (nutrizionista)', B: 'Fase B — Motore intelligente (agente AI)' };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {baseRules.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: 2 }}>Regole base del motore <span className="muted" style={{ fontWeight: 400 }}>(le 12 del Metodo del Motore Intelligente)</span></h3>
          <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>I pilastri del motore, sempre validi per ogni percorso. Sono di riferimento: i valori fini che le regolano stanno nelle regole globali qui sotto.</p>
          {(['A', 'B'] as const).map((ph) => (
            <div key={ph} style={{ marginTop: 10 }}>
              <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <span className={`chip ${ph === 'B' ? 'ok' : ''}`} style={{ fontSize: 11 }}>{phaseLabel[ph]}</span>
              </div>
              <div style={{ display: 'grid', gap: 0 }}>
                {baseRules.filter((r) => r.phase === ph).map((r) => (
                  <div key={r.code} style={{ padding: '8px 0', borderTop: '1px solid var(--line,#eee)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}><span style={{ color: 'var(--deep)' }}>{r.code}</span> · {r.title}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{r.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {catalog.categories.map((cat) => {
        const rules = catalog.rules.filter((r) => r.category === cat.key);
        if (!rules.length) return null;
        return (
          <div key={cat.key} className="card">
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>{cat.label}</h3>
            <div style={{ display: 'grid', gap: 0 }}>
              {rules.map((r) => {
                const changed = draft[r.code] !== r.global;
                return (
                  <div key={r.code} className="spread" style={{ gap: 14, padding: '12px 0', borderTop: '1px solid var(--line,#eee)', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{r.label} {r.perDiet && <span className="chip" style={{ fontSize: 11 }}>per dieta</span>}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{r.description}</div>
                    </div>
                    <div className="row" style={{ gap: 8, alignItems: 'center', flex: '0 0 auto' }}>
                      {r.kind === 'boolean' ? (
                        <Toggle on={Boolean(draft[r.code])} disabled={!canManage} onChange={(v) => setDraft((d) => ({ ...d, [r.code]: v }))} />
                      ) : (
                        <input className="input" type="number" style={{ width: 100 }} disabled={!canManage}
                          value={String(draft[r.code])} min={r.min} max={r.max} step={r.step}
                          onChange={(e) => setDraft((d) => ({ ...d, [r.code]: e.target.value === '' ? 0 : Number(e.target.value) }))} />
                      )}
                      {r.unit && r.unit !== 'frazione' && <span className="muted" style={{ fontSize: 12 }}>{r.unit}</span>}
                      {canManage && changed && <button className="btn sm" disabled={savingCode === r.code} onClick={() => save(r)}>{savingCode === r.code ? '…' : 'Salva'}</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PresetCard({ preset, catalog, canManage, generating, onGenerate, onEdit, onApply, onDelete }: { preset: Preset; catalog: Catalog | null; canManage: boolean; generating?: boolean; onGenerate?: () => void; onEdit: () => void; onApply: () => void; onDelete: () => void }) {
  const ruleLabels = catalog ? Object.fromEntries(catalog.rules.map((r) => [r.code, r])) : {};
  return (
    <div className="card">
      <div className="spread" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 15.5 }}>{preset.label}</b>
            <span className="chip">{STYLE_LABEL[preset.style] ?? preset.style}</span>
            {preset.regime && <span className="chip">{preset.regime}</span>}
            {preset.objective && <span className="chip">{preset.objective}</span>}
            {preset.suggested && <span className="chip ok" title="Regola base proposta da noi, fondata sulla letteratura">Suggerita</span>}
          </div>
          {preset.description && <p className="muted" style={{ fontSize: 13.5, margin: '6px 0' }}>{preset.description}</p>}
        </div>
        {canManage && (
          <div className="row" style={{ gap: 6, flex: '0 0 auto' }}>
            <button className="btn sm" onClick={onGenerate} disabled={generating} title="Genera con l'AI una bozza di catalogo (ricette, menù, alternative, allergeni)">
              <i className="ti ti-sparkles" /> {generating ? 'Genero…' : 'Genera catalogo'}
            </button>
            <button className="btn ghost sm" onClick={onApply} title="Applica i parametri a una dieta"><i className="ti ti-arrow-bar-to-down" /> Applica</button>
            <button className="btn ghost sm" onClick={onEdit}><i className="ti ti-pencil" /></button>
            <button className="btn ghost sm" onClick={onDelete} title="Elimina"><i className="ti ti-trash" /></button>
          </div>
        )}
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        {Object.entries(preset.rules).map(([code, v]) => {
          const r = (ruleLabels as Record<string, Rule>)[code];
          return <span key={code} className="chip" style={{ fontSize: 11.5 }}>{r?.label ?? code}: <b>{r ? fmtVal(r, v) : String(v)}</b></span>;
        })}
      </div>
      {preset.clinicalNotes && <p className="hint" style={{ marginTop: 8 }}><i className="ti ti-stethoscope" /> {preset.clinicalNotes}</p>}
      {preset.source && <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Fonte: {preset.source}</p>}
    </div>
  );
}

function PresetModal({ preset, catalog, onClose, onSaved, onError }: { preset: Preset | null; catalog: Catalog; onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [label, setLabel] = useState(preset?.label ?? '');
  const { regimes } = useTaxonomy();
  const [style, setStyle] = useState(preset?.style ?? 'mediterranean');
  const [description, setDescription] = useState(preset?.description ?? '');
  const [regime, setRegime] = useState(preset?.regime ?? '');
  const [objective, setObjective] = useState(preset?.objective ?? '');
  const [clinicalNotes, setClinicalNotes] = useState(preset?.clinicalNotes ?? '');
  const [source, setSource] = useState(preset?.source ?? '');
  const [rules, setRules] = useState<Record<string, number | boolean>>(preset?.rules ?? {});
  const [busy, setBusy] = useState(false);
  const editable = catalog.rules.filter((r) => r.perDiet); // solo le regole sovrascrivibili per dieta

  async function submit() {
    if (!label.trim()) { onError('Inserisci un nome.'); return; }
    setBusy(true);
    const body = { style, label, description, regime: regime || null, objective: objective || null, rules, clinicalNotes, source };
    try {
      if (preset) await api(`/engine-rules/presets/${preset.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/engine-rules/presets', { method: 'POST', body: JSON.stringify(body) });
      onSaved();
    } catch (e) { onError(e instanceof Error ? e.message : 'Salvataggio non riuscito.'); }
    finally { setBusy(false); }
  }

  return (
    <Modal title={preset ? `Modifica: ${preset.label}` : 'Nuova regola per nutrizione'} onClose={onClose} wide>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Nome</label><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Es. Mediterranea ipocalorica" /></div>
        <div className="field" style={{ minWidth: 150 }}><label>Stile</label>
          <select className="input" value={style} onChange={(e) => setStyle(e.target.value)}>
            {['mediterranean', 'protein', 'low_carb', 'flexible', 'keto', 'dash'].map((s) => <option key={s} value={s}>{STYLE_LABEL[s] ?? s}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label>Descrizione</label><textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <div className="field" style={{ minWidth: 150 }}><label>Regime</label>
          <select className="input" value={regime} onChange={(e) => setRegime(e.target.value)}>
            <option value="">Qualsiasi</option>{regimes.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ minWidth: 150 }}><label>Obiettivo</label>
          <select className="input" value={objective} onChange={(e) => setObjective(e.target.value)}>
            <option value="">Qualsiasi</option><option value="dimagrimento">Dimagrimento</option><option value="mantenimento">Mantenimento</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Parametri del motore</label>
        <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
          {editable.map((r) => {
            const has = r.code in rules;
            return (
              <div key={r.code} className="row" style={{ gap: 8, alignItems: 'center' }}>
                <Toggle on={has} onChange={(v) => setRules((s) => { const n = { ...s }; if (v) n[r.code] = r.kind === 'boolean' ? true : (r.default as number); else delete n[r.code]; return n; })} title="Includi nel preset" />
                <span style={{ flex: 1, fontSize: 13.5 }}>{r.label}</span>
                {has && (r.kind === 'boolean'
                  ? <Toggle on={Boolean(rules[r.code])} onChange={(v) => setRules((s) => ({ ...s, [r.code]: v }))} />
                  : <input className="input" type="number" style={{ width: 90 }} value={String(rules[r.code])} min={r.min} max={r.max} step={r.step} onChange={(e) => setRules((s) => ({ ...s, [r.code]: Number(e.target.value) }))} />)}
              </div>
            );
          })}
        </div>
      </div>
      <div className="field"><label>Note cliniche (regole non ancora parametri)</label><textarea className="input" rows={2} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} placeholder="Es. carboidrati < 50 g/die; pesce ≥ 2/sett" /></div>
      <div className="field"><label>Fonte</label><input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Linea guida / studio" /></div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={submit} disabled={busy || !label.trim()}>{busy ? 'Salvataggio…' : 'Salva'}</button>
      </div>
    </Modal>
  );
}

function ApplyModal({ preset, diets, onClose, onApplied, onError }: { preset: Preset; diets: DietRow[]; onClose: () => void; onApplied: (n: number) => void; onError: (m: string) => void }) {
  const [dietId, setDietId] = useState('');
  const [busy, setBusy] = useState(false);
  async function apply() {
    if (!dietId) return;
    setBusy(true);
    try { const r = await api<{ applied: number }>(`/engine-rules/presets/${preset.id}/apply/${dietId}`, { method: 'POST' }); onApplied(r.applied); }
    catch (e) { onError(e instanceof Error ? e.message : 'Applicazione non riuscita.'); }
    finally { setBusy(false); }
  }
  return (
    <Modal title={`Applica "${preset.label}" a una dieta`} onClose={onClose}>
      <p className="muted" style={{ fontSize: 13.5 }}>I parametri del preset diventano override della dieta scelta (ProductRule), senza toccare le altre.</p>
      <div className="field"><label>Dieta</label>
        <select className="input" value={dietId} onChange={(e) => setDietId(e.target.value)}>
          <option value="">Scegli una dieta…</option>
          {diets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={apply} disabled={busy || !dietId}>{busy ? 'Applico…' : 'Applica'}</button>
      </div>
    </Modal>
  );
}

function ProposeModal({ onClose, onSaved, onError }: { onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!text.trim()) { onError('Descrivi la regola.'); return; }
    setBusy(true);
    try { await api('/engine-rules/proposals', { method: 'POST', body: JSON.stringify({ title: title.trim() || undefined, text }) }); onSaved(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Invio non riuscito.'); }
    finally { setBusy(false); }
  }
  return (
    <Modal title="Proponi una regola nuova" onClose={onClose}>
      <p className="muted" style={{ fontSize: 13.5 }}>Descrivi cosa dovrebbe fare la regola e con quali parametri. Se serve un comportamento nuovo del motore, la implementiamo noi.</p>
      <div className="field"><label>Titolo</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Tetto carboidrati in grammi" /></div>
      <div className="field"><label>Descrizione</label><textarea className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Es. Per Keto: imporre carboidrati < 50 g/die a livello di giornata." /></div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={submit} disabled={busy || !text.trim()}>{busy ? 'Invio…' : 'Invia proposta'}</button>
      </div>
    </Modal>
  );
}
