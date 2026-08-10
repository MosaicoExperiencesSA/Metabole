import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Pager, Spinner } from '../components/ui';
import { ContatoreRighe, useTabella, type Colonna } from '../components/tabella';

interface CompRow {
  staffId: string;
  displayName: string;
  role: string;
  commissionCents: number;
  compensationCents: number;
  totalCents: number;
}

const euro = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');
const ROLE: Record<string, string> = {
  coach: 'Coach',
  manager_coach: 'Manager coach',
  nutritionist: 'Nutrizionista',
  head_nutritionist: 'Capo nutrizionista',
  sales: 'Resp. Coach Team',
  admin: 'Admin',
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function Compensi() {
  const [rows, setRows] = useState<CompRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('');

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        setRows(await api<CompRow[]>(`/admin/compensation${period ? `?period=${period}` : ''}`));
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) setError('Sezione riservata agli amministratori.');
        else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      } finally {
        setLoading(false);
      }
    })();
  }, [period]);

  const COLONNE: Colonna<CompRow>[] = [
    { chiave: 'persona', titolo: 'Persona', valore: (r) => r.displayName, filtro: 'testo' },
    { chiave: 'ruolo', titolo: 'Ruolo', valore: (r) => r.role, filtro: 'scelta', etichetta: (v) => ROLE[v] ?? v, etichettaTutti: 'Tutti' },
    // I centesimi, non «€ 297,00»: come testo «€ 100,00» finirebbe prima di «€ 20,00».
    { chiave: 'provvigioni', titolo: 'Provvigioni', valore: (r) => r.commissionCents, stile: { textAlign: 'right' } },
    { chiave: 'compensi', titolo: 'Compensi visite', valore: (r) => r.compensationCents, stile: { textAlign: 'right' } },
    { chiave: 'totale', titolo: 'Totale', valore: (r) => r.totalCents, stile: { textAlign: 'right' } },
  ];

  // Il server manda chi prende più in cima: lo stesso ordine resta quello di partenza.
  const t = useTabella(rows, COLONNE, { ordineIniziale: { chiave: 'totale', direzione: 'desc' } });

  // I totali seguono i filtri: sono la somma di quello che si sta guardando, non di tutto.
  const totals = t.tutte.reduce(
    (acc, r) => ({ commission: acc.commission + r.commissionCents, compensation: acc.compensation + r.compensationCents, total: acc.total + r.totalCents }),
    { commission: 0, compensation: 0, total: 0 },
  );

  return (
    <>
      <div className="spread" style={{ marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <p className="muted" style={{ margin: 0 }}>Quanto spetta a ciascuno (provvigioni vendita + compensi visite).</p>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input" style={{ maxWidth: 220 }} placeholder="Cerca in tutte le colonne…" value={t.ricerca} onChange={(e) => t.setRicerca(e.target.value)} />
          {/* Il mese lo filtra il server (`?period=`): cambia le righe, non le riordina. */}
          <input className="input" type="month" value={period || currentMonth()} onChange={(e) => setPeriod(e.target.value)} style={{ width: 160 }} />
          <button className="btn ghost sm" onClick={() => setPeriod('')}>Tutto</button>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="persone" />
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      {loading ? (
        <Spinner />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {t.conteggio.mostrate === 0 ? (
            <div className="empty">{rows.length === 0 ? 'Nessun compenso nel periodo.' : 'Nessuna persona con questi filtri.'}</div>
          ) : (
            <table className="grid">
              <thead>
                {t.intestazione()}
                {t.rigaFiltri()}
              </thead>
              <tbody>
                {t.pagina.map((r) => (
                  <tr key={r.staffId}>
                    <td>{r.displayName}</td>
                    <td className="muted">{ROLE[r.role] ?? r.role}</td>
                    <td style={{ textAlign: 'right' }} className="muted">{euro(r.commissionCents)}</td>
                    <td style={{ textAlign: 'right' }} className="muted">{euro(r.compensationCents)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{euro(r.totalCents)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ fontWeight: 700 }}>Totale</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{euro(totals.commission)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{euro(totals.compensation)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{euro(totals.total)}</td>
                </tr>
              </tbody>
            </table>
          )}
        <Pager {...t.pager} />
        </div>
      )}
    </>
  );
}
