import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';
import { Ricette } from './Ricette';
import { TagAllergeni } from './TagAllergeni';
import { GruppiEquivalenza } from './GruppiEquivalenza';
import { useTaxonomy } from '../lib/taxonomy';
import { useAuth } from '../auth/AuthContext';

interface DietRow { id: string; name: string; regime: string; style: string; objective?: string | null; mealsPerDay?: number; fasting?: boolean; status?: string; clientVisible?: boolean; siteVisible?: boolean }

type Section = 'ricette' | 'allergeni' | 'gruppi';

// Etichetta dell'obiettivo/fase: distingue le varianti dimagrimento vs mantenimento
// che altrimenti avrebbero nome+regime identici nella tendina.
const OBIETTIVO_LABEL: Record<string, string> = { dimagrimento: 'Dimagrimento', mantenimento: 'Mantenimento' };
const objSuffix = (o?: string | null) => (o ? ` · ${OBIETTIVO_LABEL[o] ?? o}` : '');
// Etichetta pasti: distingue le varianti 3/5 pasti e digiuno intermittente della stessa famiglia.
const mealSuffix = (d: { mealsPerDay?: number; fasting?: boolean }) => (d.fasting ? ' · Digiuno' : d.mealsPerDay ? ` · ${d.mealsPerDay} pasti` : '');

/**
 * Gestione dieta: il nutrizionista sceglie una dieta dalla tendina e gestisce, in
 * un unico posto, i contenuti di QUELLA dieta — catalogo ricette (per regime),
 * allergeni (sulle ricette del regime) e gruppi di equivalenza (per id dieta).
 * Riusa gli editor completi esistenti montandoli con lo scope della dieta scelta.
 */
export function GestioneDieta() {
  const { regimeLabel } = useTaxonomy();
  const { user } = useAuth();
  const canManageVisibility = user?.role === 'head_nutritionist';
  const [diets, setDiets] = useState<DietRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dietId, setDietId] = useState('');
  const [section, setSection] = useState<Section>('ricette');
  const [renameVal, setRenameVal] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [famBusy, setFamBusy] = useState(false);
  const [famMsg, setFamMsg] = useState<string | null>(null);
  const [famProgress, setFamProgress] = useState('');

  useEffect(() => {
    api<DietRow[]>('/diets')
      .then((d) => setDiets(d))
      .catch((e) => { setDiets([]); setError(e instanceof ApiError ? e.message : 'Caricamento diete non riuscito.'); });
  }, []);

  // Precompila il campo rinomina col nome della dieta selezionata.
  useEffect(() => {
    const d = diets?.find((x) => x.id === dietId) ?? null;
    setRenameVal(d?.name ?? '');
  }, [dietId, diets]);

  // Azzera i messaggi della famiglia quando cambia la dieta selezionata.
  useEffect(() => { setFamMsg(null); setFamProgress(''); }, [dietId]);

  // Le varianti (regime × obiettivo) della stessa famiglia = stesso nome + stile.
  function familyOf(sel: DietRow): DietRow[] {
    return (diets ?? []).filter((d) => d.name === sel.name && d.style === sel.style);
  }

  /**
   * Valida, pubblica e rende visibile TUTTA la famiglia in un colpo. Per ogni variante:
   * attiva ricette → conferma allergeni → approva gruppi (pass 1), poi pubblica e accende
   * clienti+sito (pass 2, così quando controlla il gate R8 i gruppi sono già approvati).
   */
  async function runFamily() {
    const sel = (diets ?? []).find((d) => d.id === dietId);
    if (!sel) return;
    const fam = familyOf(sel);
    if (!fam.length) return;
    // eslint-disable-next-line no-alert
    if (!confirm(`Validare, pubblicare e rendere visibili TUTTE le ${fam.length} varianti della famiglia "${sel.name}"?\n\nPer ogni variante: attiva le ricette, conferma gli allergeni, approva i gruppi, pubblica e accende la visibilità (clienti + sito).`)) return;
    setFamBusy(true); setFamMsg(null); setFamProgress('');
    const errs: string[] = [];
    // Pass 1 — contenuti (ricette, allergeni, gruppi) su ogni variante.
    for (const v of fam) {
      try {
        await api(`/engine-rules/diets/${v.id}/activate-recipes`, { method: 'POST', body: JSON.stringify({}) });
        await api(`/engine-rules/diets/${v.id}/review-allergens`, { method: 'POST', body: JSON.stringify({}) });
        await api(`/engine-rules/diets/${v.id}/approve-groups`, { method: 'POST', body: JSON.stringify({}) });
      } catch (e) {
        errs.push(`${regimeLabel(v.regime)}${objSuffix(v.objective)} (validazione): ${e instanceof ApiError ? e.message : 'errore'}`);
      }
    }
    // Pass 2 — pubblica + visibilità (gruppi già approvati → gate R8 soddisfatto).
    let done = 0;
    for (const v of fam) {
      try {
        if ((v.status ?? '') !== 'approved') await api(`/diets/${v.id}/publish`, { method: 'POST', body: JSON.stringify({}) });
        await api(`/diets/${v.id}/product`, { method: 'PATCH', body: JSON.stringify({ siteVisible: true }) });
        await api(`/diets/${v.id}/product`, { method: 'PATCH', body: JSON.stringify({ clientVisible: true }) });
        done += 1;
        setFamProgress(`${done}/${fam.length}`);
      } catch (e) {
        errs.push(`${regimeLabel(v.regime)}${objSuffix(v.objective)} (pubblica/visibilità): ${e instanceof ApiError ? e.message : 'errore'}`);
      }
    }
    try { setDiets(await api<DietRow[]>('/diets')); } catch { /* no-op */ }
    setFamBusy(false);
    setFamMsg(errs.length
      ? `Completate ${done}/${fam.length} varianti. Da rivedere: ${errs.join(' · ')}`
      : `Fatto: tutte le ${fam.length} varianti sono pubblicate e visibili (clienti + sito).`);
  }

  async function rename() {
    const name = renameVal.trim();
    const d = diets?.find((x) => x.id === dietId) ?? null;
    if (!d || name.length < 2 || name === d.name) return;
    setRenaming(true); setError(null);
    try {
      await api(`/diets/${d.id}/name`, { method: 'PATCH', body: JSON.stringify({ name }) });
      setDiets((ds) => (ds ?? []).map((x) => (x.id === d.id ? { ...x, name } : x)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Rinomina non riuscita.');
    } finally {
      setRenaming(false);
    }
  }

  if (diets === null) return <Spinner />;

  const diet = diets.find((d) => d.id === dietId) ?? null;
  const TABS: { key: Section; label: string; icon: string }[] = [
    { key: 'ricette', label: 'Catalogo ricette', icon: 'ti-tools-kitchen-2' },
    { key: 'allergeni', label: 'Allergeni', icon: 'ti-alert-triangle' },
    { key: 'gruppi', label: 'Gruppi di equivalenza', icon: 'ti-arrows-shuffle' },
  ];

  return (
    <>
      {error && <Banner kind="err">{error}</Banner>}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Gestione dieta</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Scegli una dieta e gestisci qui, in un unico posto, i suoi contenuti: catalogo ricette, allergeni e gruppi di equivalenza.
        </p>
        <label className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 13 }}>Dieta</span>
          <select className="select" style={{ minWidth: 300 }} value={dietId} onChange={(e) => setDietId(e.target.value)}>
            <option value="">— scegli una dieta —</option>
            {[...diets].sort((a, b) => a.name.localeCompare(b.name, 'it') || regimeLabel(a.regime).localeCompare(regimeLabel(b.regime), 'it') || (a.objective ?? '').localeCompare(b.objective ?? '') || (a.mealsPerDay ?? 0) - (b.mealsPerDay ?? 0)).map((d) => <option key={d.id} value={d.id}>{d.name} · {regimeLabel(d.regime)}{objSuffix(d.objective)}{mealSuffix(d)}</option>)}
          </select>
          {diets.length === 0 && <span className="muted" style={{ fontSize: 12 }}>Nessuna dieta: creane una dal Catalogo diete o dal wizard Creazione e validazione.</span>}
        </label>
        {diet && (
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <span className="muted" style={{ fontSize: 13 }}>Nome</span>
            <input className="input" style={{ minWidth: 300 }} value={renameVal} onChange={(e) => setRenameVal(e.target.value)} placeholder="Nome della dieta" />
            <button className="btn ghost sm" onClick={rename} disabled={renaming || renameVal.trim().length < 2 || renameVal.trim() === diet.name}>
              <i className="ti ti-edit" /> Rinomina
            </button>
          </div>
        )}
        {diet && (() => {
          const fam = familyOf(diet);
          const approved = fam.filter((d) => (d.status ?? '') === 'approved').length;
          const clientOn = fam.filter((d) => d.clientVisible).length;
          const siteOn = fam.filter((d) => d.siteVisible).length;
          return (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Pubblicazione e visibilità — tutta la famiglia</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Famiglia <b>{diet.name}</b> · {fam.length} variante/i (regime × obiettivo) — {approved} approvate, {clientOn} visibili ai clienti, {siteOn} sul sito.
                Le clienti scelgono lo stile e il motore pesca la variante giusta per il loro regime e obiettivo, quindi conviene pubblicare tutte le varianti insieme.
              </div>
              {!canManageVisibility ? (
                <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                  <i className="ti ti-lock" style={{ marginRight: 4 }} />
                  Solo il <b>capo nutrizionista</b> può pubblicare e gestire la visibilità delle diete.
                </div>
              ) : (
                <button className="btn" onClick={runFamily} disabled={famBusy || fam.length === 0} style={{ marginTop: 10 }}>
                  {famBusy ? (
                    <>
                      <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.45)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginRight: 6, verticalAlign: '-2px' }} />
                      Lavoro… {famProgress}
                    </>
                  ) : (
                    <><i className="ti ti-rosette-discount-check" /> Valida, pubblica e mostra tutta la famiglia</>
                  )}
                </button>
              )}
              {famMsg && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{famMsg}</div>}
            </div>
          );
        })()}
      </div>

      {!diet ? (
        <div className="card"><div className="empty">Seleziona una dieta per vederne e modificarne i contenuti.</div></div>
      ) : (
        <>
          <div className="row" style={{ gap: 8, margin: '2px 0 12px', flexWrap: 'wrap' }}>
            {TABS.map((t) => (
              <button key={t.key} className={`btn ${section === t.key ? '' : 'ghost'} sm`} onClick={() => setSection(t.key)}>
                <i className={`ti ${t.icon}`} /> {t.label}
              </button>
            ))}
          </div>
          {/* Editor montati e tenuti in vita (display:none) per non perdere lo stato al cambio sezione. */}
          <div style={{ display: section === 'ricette' ? 'block' : 'none' }}>
            <Ricette key={diet.id} scopeRegime={diet.regime} />
          </div>
          <div style={{ display: section === 'allergeni' ? 'block' : 'none' }}>
            <TagAllergeni key={diet.id} scopeRegime={diet.regime} />
          </div>
          <div style={{ display: section === 'gruppi' ? 'block' : 'none' }}>
            <GruppiEquivalenza key={diet.id} scopeProductId={diet.id} />
          </div>
        </>
      )}
    </>
  );
}
