import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner } from '../components/ui';
import { MiniTrend } from '../components/MiniTrend';
import { SerieGiornaliera } from '../components/SerieGiornaliera';

interface NamedLoss { name: string; lossKg: number }
interface NamedAmount { name: string; amountCents: number }
interface MonthPoint {
  label: string; kgLost: number; cmWaistLost: number; avgLossKg: number;
  newClients: number; activeSubscriptions: number; revenueCents: number; cumulativeRevenueCents: number;
}
interface Charts {
  scope: 'all' | 'own';
  clientsCount: number;
  monthly: MonthPoint[];
  /** Le classifiche per perdita, un elenco per periodo: «tutto» e gli ultimi dodici mesi. */
  classificaPerdita?: {
    periodi: { chiave: string; etichetta: string }[];
    perPeriodo: Record<string, { top: NamedLoss[]; bottom: NamedLoss[] }>;
  };
  topCoachByRevenue: NamedAmount | null;
  topSpender: NamedAmount | null;
  longestTenured: { name: string; since: string } | null;
}

const euro = (c: number) => '€ ' + (c / 100).toFixed(0);

function Stat({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: string; color: string }) {
  return (
    <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', margin: 0 }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--chip)', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <i className={`ti ${icon}`} style={{ fontSize: 22 }} />
      </span>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
        <div className="muted" style={{ fontSize: 12 }}>{label}{sub ? ` · ${sub}` : ''}</div>
      </div>
    </div>
  );
}

/**
 * LE DUE CLASSIFICHE, CON IL PERIODO SCEGLIBILE (richiesta di Simone dell'11/8: «mi mostri il mese
 * corrente, poi da una casellina a discesa posso selezionare quale mese vedere oppure tutto»).
 *
 * I periodi arrivano tutti insieme dal server, calcolati sulle misure che lui ha già in memoria:
 * cambiare mese non chiama la rete. Una tendina sola per le due classifiche, perché sono la stessa
 * domanda letta dai due capi — con due tendine si finisce a confrontare agosto con luglio senza
 * accorgersene.
 */
function ClassifichePerdita({ classifica }: { classifica?: Charts['classificaPerdita'] }) {
  // Il mese corrente, che è la chiave con cui il server manda i periodi: `AAAA-MM`.
  const meseCorrente = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [periodo, setPeriodo] = useState(meseCorrente);
  if (!classifica) return null;
  const scelto = classifica.perPeriodo[periodo] ?? classifica.perPeriodo[meseCorrente] ?? { top: [], bottom: [] };
  const etichetta = classifica.periodi.find((p) => p.chiave === periodo)?.etichetta ?? '';

  return (
    <>
      <div className="spread" style={{ margin: '4px 0 10px', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 13 }}>
          Chi ha perso più peso {periodo === 'tutto' ? 'da quando ha iniziato' : `in ${etichetta.toLowerCase()}`}.
          Contano solo le clienti con <b>almeno due misure</b> nel periodo: con una sola la differenza
          sarebbe zero e direbbe «si è pesata una volta», non «non ha perso».
        </span>
        <select className="select" style={{ width: 'auto' }} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          {classifica.periodi.map((p) => <option key={p.chiave} value={p.chiave}>{p.etichetta}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
        <BarList title="Migliori 5 per perdita" items={scelto.top} unit="kg" />
        <BarList title="Ultimi 5 per perdita" items={scelto.bottom} unit="kg" />
      </div>
    </>
  );
}

function BarList({ title, items, unit }: { title: string; items: NamedLoss[]; unit: string }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.lossKg)));
  return (
    <div className="card">
      <h2 style={{ marginTop: 0, fontSize: 16 }}>{title}</h2>
      {items.length === 0 ? (
        <div className="empty">Dati non disponibili.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((i, idx) => (
            <div key={idx}>
              <div className="spread" style={{ fontSize: 13, marginBottom: 3 }}>
                <span>{i.name}</span>
                <b>{i.lossKg.toFixed(1)} {unit}</b>
              </div>
              <div style={{ height: 8, borderRadius: 6, background: 'var(--line)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(Math.abs(i.lossKg) / max) * 100}%`, background: i.lossKg >= 0 ? 'var(--teal)' : 'var(--coral)', borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Grafici() {
  const { can } = useAuth();
  const isAdmin = can('charts', 'manage');
  const [data, setData] = useState<Charts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      setData(await api<Charts>('/admin/charts'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Non hai accesso ai grafici.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function demo(action: 'seed' | 'clear') {
    if (action === 'clear' && !confirm('Rimuovere tutti i dati demo?')) return;
    setDemoBusy(true); setError(null);
    try {
      await api('/admin/charts/demo', { method: action === 'seed' ? 'POST' : 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Operazione non riuscita.');
    } finally { setDemoBusy(false); }
  }

  if (loading) return <Spinner />;
  if (error && !data) return <Banner kind="err">{error}</Banner>;
  if (!data) return null;

  return (
    <>
      {error && <Banner kind="err">{error}</Banner>}
      <div className="spread" style={{ marginTop: 0, marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
        <p className="hint" style={{ margin: 0 }}>
          {data.scope === 'all' ? 'Dati di tutti i clienti.' : 'Dati dei tuoi clienti.'} · {data.clientsCount} clienti
        </p>
        {isAdmin && (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost sm" disabled={demoBusy} onClick={() => demo('seed')}><i className="ti ti-sparkles" /> Genera dati demo</button>
            <button className="btn ghost sm" disabled={demoBusy} onClick={() => demo('clear')} style={{ color: 'var(--danger)' }}><i className="ti ti-trash" /> Rimuovi demo</button>
          </div>
        )}
      </div>

      {/*
        La serie GIORNALIERA sta in cima, prima dei sei mesi: è la domanda che si fa più spesso
        («come stiamo andando questo mese?»), e la risposta a sei mesi non la dava. I mesi restano
        sotto — servono per la tendenza lunga, che a giorni non si vede.
      */}
      <div style={{ marginBottom: 16 }}>
        <SerieGiornaliera />
      </div>

      {(() => {
        const m = data.monthly ?? [];
        const L = m.map((x) => x.label);
        const kgF = (v: number) => `${v.toFixed(1)} kg`;
        const cmF = (v: number) => `${v.toFixed(1)} cm`;
        const intF = (v: number) => String(Math.round(v));
        const eurF = (v: number) => '€ ' + Math.round(v / 100).toLocaleString('it-IT');
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12, marginBottom: 16 }}>
            <MiniTrend label="Kg persi / mese" values={m.map((x) => x.kgLost)} labels={L} format={kgF} />
            <MiniTrend label="Cm vita persi / mese" values={m.map((x) => x.cmWaistLost)} labels={L} format={cmF} color="#3A6EA5" />
            <MiniTrend label="Perdita media / cliente" values={m.map((x) => x.avgLossKg)} labels={L} format={kgF} />
            <MiniTrend label="Nuovi clienti / mese" values={m.map((x) => x.newClients)} labels={L} format={intF} color="var(--violet)" />
            <MiniTrend label="Abbonamenti attivi" values={m.map((x) => x.activeSubscriptions)} labels={L} format={intF} />
            <MiniTrend label="Fatturato / mese" values={m.map((x) => x.revenueCents)} labels={L} format={eurF} color="var(--gold)" />
            <MiniTrend label="Fatturato cumulato" values={m.map((x) => x.cumulativeRevenueCents)} labels={L} format={eurF} color="var(--gold)" />
          </div>
        );
      })()}

      {(data.topSpender || data.topCoachByRevenue || data.longestTenured) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12, marginBottom: 16 }}>
          {data.topSpender && <Stat label="Maggior spendente" value={data.topSpender.name} sub={euro(data.topSpender.amountCents)} icon="ti-crown" color="var(--gold)" />}
          {data.topCoachByRevenue && <Stat label="Coach con più fatturato" value={data.topCoachByRevenue.name} sub={euro(data.topCoachByRevenue.amountCents)} icon="ti-medal" color="var(--teal-dark)" />}
          {data.longestTenured && <Stat label="Cliente da più tempo" value={data.longestTenured.name} sub={new Date(data.longestTenured.since).toLocaleDateString('it-IT')} icon="ti-hourglass" color="var(--coral-dark)" />}
        </div>
      )}

      <ClassifichePerdita classifica={data.classificaPerdita} />
    </>
  );
}
