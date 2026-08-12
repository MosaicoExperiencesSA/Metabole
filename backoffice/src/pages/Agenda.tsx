import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Banner, Pager, Spinner } from '../components/ui';
import { SettimanaTipo } from '../components/SettimanaTipo';
import { BottoneExcel, ContatoreRighe, useTabella, type Colonna } from '../components/tabella';

interface VisitRow {
  id: string;
  type: string;
  datetime: string;
  status: string;
  client: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  nutritionist: { displayName: string } | null;
}

const dateTime = (s: string) => new Date(s).toLocaleString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const TYPE: Record<string, string> = { in_person: 'In presenza', televisit: 'Televisita' };
const STATUS: Record<string, { label: string; chip: string }> = {
  scheduled: { label: 'In programma', chip: 'amber' },
  done: { label: 'Effettuata', chip: '' },
  cancelled: { label: 'Annullata', chip: 'red' },
};

export function Agenda() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('scheduled');

  useEffect(() => {
    (async () => {
      try {
        setRows(await api<VisitRow[]>(`/admin/visits${status ? `?status=${status}` : ''}`));
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) setError('Sezione riservata.');
        else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  const name = (c: VisitRow['client']) => (c ? [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email : '—');

  // Lo stato ha già la tendina in cima, che è un filtro del server (rifà la chiamata): qui la
  // colonna resta solo ordinabile, per non avere due filtri sulla stessa cosa.
  const COLONNE: Colonna<VisitRow>[] = [
    { chiave: 'quando', titolo: 'Quando', valore: (r) => r.datetime },
    // `name` restituisce il trattino per la cella; per ordinare serve il vuoto vero, altrimenti le
    // visite senza cliente si ordinano come se si chiamassero «—».
    { chiave: 'cliente', titolo: 'Cliente', valore: (r) => (r.client ? name(r.client) : null), filtro: 'testo' },
    { chiave: 'nutrizionista', titolo: 'Nutrizionista', valore: (r) => r.nutritionist?.displayName, filtro: 'scelta', etichettaTutti: 'Tutti' },
    { chiave: 'tipo', titolo: 'Tipo', valore: (r) => r.type, filtro: 'scelta', etichettaTutti: 'Tutti', etichetta: (v) => TYPE[v] ?? v },
    { chiave: 'stato', titolo: 'Stato', valore: (r) => r.status, esporta: (r) => STATUS[r.status]?.label ?? r.status },
  ];

  // L'agenda si legge dalla prima visita in poi: è l'ordine del server (`datetime asc`).
  const t = useTabella(rows, COLONNE, { testaFissa: true, ordineIniziale: { chiave: 'quando', direzione: 'asc' }, nomeExcel: 'Agenda'});

  if (loading) return <Spinner />;

  return (
    <>
      {/* §16.7 — gli orari che il nutrizionista offre, sopra gli appuntamenti che ne nascono: sono
          la stessa cosa guardata a due giorni di distanza, e in due pagine diverse costringerebbero
          ad aprirle tutte e due per capire una giornata. Non compare a chi non ha una scheda staff. */}
      <SettimanaTipo />

      <p className="muted" style={{ marginTop: 0 }}>Visite col nutrizionista (le note cliniche restano nella scheda).</p>

      <div className="spread" style={{ marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="visite" />
          <BottoneExcel tabella={t} />
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ maxWidth: 240 }}
            placeholder="Cerca in tutte le colonne…"
            value={t.ricerca}
            onChange={(e) => t.setRicerca(e.target.value)}
          />
          <select className="select" style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="scheduled">In programma</option>
            <option value="done">Effettuate</option>
            <option value="cancelled">Annullate</option>
            <option value="">Tutte</option>
          </select>
        </div>
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">{rows.length === 0 ? 'Nessuna visita.' : 'Nessuna visita con questi filtri.'}</div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((r) => (
                <tr key={r.id}>
                  <td>{dateTime(r.datetime)}</td>
                  <td>
                    {r.client ? (
                      <span className="link" style={{ cursor: 'pointer' }} onClick={() => navigate(`/clienti/${r.client!.id}`)}>{name(r.client)}</span>
                    ) : '—'}
                  </td>
                  <td className="muted">{r.nutritionist?.displayName ?? '—'}</td>
                  <td className="muted">{TYPE[r.type] ?? r.type}</td>
                  <td><span className={`chip ${STATUS[r.status]?.chip ?? 'gray'}`}>{STATUS[r.status]?.label ?? r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager {...t.pager} />
      </div>
    </>
  );
}
