import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';
import { Ricette } from './Ricette';
import { TagAllergeni } from './TagAllergeni';
import { GruppiEquivalenza } from './GruppiEquivalenza';

interface DietRow { id: string; name: string; regime: string; status?: string }

const REGIME: Record<string, string> = { omnivore: 'Onnivoro', vegetarian: 'Vegetariano', vegan: 'Vegano' };
type Section = 'ricette' | 'allergeni' | 'gruppi';

/**
 * Gestione dieta: il nutrizionista sceglie una dieta dalla tendina e gestisce, in
 * un unico posto, i contenuti di QUELLA dieta — catalogo ricette (per regime),
 * allergeni (sulle ricette del regime) e gruppi di equivalenza (per id dieta).
 * Riusa gli editor completi esistenti montandoli con lo scope della dieta scelta.
 */
export function GestioneDieta() {
  const [diets, setDiets] = useState<DietRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dietId, setDietId] = useState('');
  const [section, setSection] = useState<Section>('ricette');

  useEffect(() => {
    api<DietRow[]>('/diets')
      .then((d) => setDiets(d))
      .catch((e) => { setDiets([]); setError(e instanceof ApiError ? e.message : 'Caricamento diete non riuscito.'); });
  }, []);

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
            {diets.map((d) => <option key={d.id} value={d.id}>{d.name} · {REGIME[d.regime] ?? d.regime}</option>)}
          </select>
          {diets.length === 0 && <span className="muted" style={{ fontSize: 12 }}>Nessuna dieta: creane una dal Catalogo diete o dal wizard Creazione e validazione.</span>}
        </label>
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
