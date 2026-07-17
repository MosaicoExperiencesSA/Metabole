import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Pager, Spinner, usePagination } from '../components/ui';

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

  const totals = rows.reduce(
    (acc, r) => ({ commission: acc.commission + r.commissionCents, compensation: acc.compensation + r.compensationCents, total: acc.total + r.totalCents }),
    { commission: 0, compensation: 0, total: 0 },
  );

  const pg = usePagination(rows, 100);

  return (
    <>
      <div className="spread" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ margin: 0 }}>Quanto spetta a ciascuno (provvigioni vendita + compensi visite).</p>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input className="input" type="month" value={period || currentMonth()} onChange={(e) => setPeriod(e.target.value)} style={{ width: 160 }} />
          <button className="btn ghost sm" onClick={() => setPeriod('')}>Tutto</button>
        </div>
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      {loading ? (
        <Spinner />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {rows.length === 0 ? (
            <div className="empty">Nessun compenso nel periodo.</div>
          ) : (
            <table className="grid">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Ruolo</th>
                  <th style={{ textAlign: 'right' }}>Provvigioni</th>
                  <th style={{ textAlign: 'right' }}>Compensi visite</th>
                  <th style={{ textAlign: 'right' }}>Totale</th>
                </tr>
              </thead>
              <tbody>
                {pg.pageItems.map((r) => (
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
        <Pager page={pg.page} totalPages={pg.totalPages} total={pg.total} from={pg.from} to={pg.to} onPage={pg.setPage} />
        </div>
      )}
    </>
  );
}
