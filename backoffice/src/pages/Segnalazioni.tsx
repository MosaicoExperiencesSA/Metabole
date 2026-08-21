import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Banner, Pager, Spinner } from '../components/ui';
import { BottoneExcel, ContatoreRighe, useTabella, type Colonna } from '../components/tabella';

interface EscalationRow {
  id: string;
  reason: string;
  source: string;
  status: string;
  category: string | null;
  createdAt: string;
  client: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  assignedTo: { displayName: string } | null;
}

const date = (s: string) => new Date(s).toLocaleDateString('it-IT');
const SOURCE: Record<string, string> = { screening: 'Screening sanitario', coach: 'Coach', engine: 'Motore' };
// Allineato a backend/src/escalations/escalation-routing.ts (R12).
/** Le stesse tre voci della tendina nella cella: nel file va l'etichetta, non `open`. */
const STATO_ETICHETTA: Record<string, string> = { open: 'Aperta', in_progress: 'In corso', resolved: 'Risolta' };

const CATEGORY_LABEL: Record<string, string> = {
  diet_blocked: 'Piano bloccato',
  no_progress: 'Nessun progresso',
  low_adherence: 'Scarsa aderenza',
  mood_risk: 'Rischio umore/abbandono',
  clinical: 'Clinico',
  other: 'Altro',
};
const CATEGORY_CHIP: Record<string, string> = {
  diet_blocked: 'red',
  no_progress: 'amber',
  low_adherence: 'gray',
  mood_risk: 'amber',
  clinical: 'violet',
  other: 'gray',
};

export function Segnalazioni() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<EscalationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const qs = new URLSearchParams();
        if (status) qs.set('status', status);
        if (category) qs.set('category', category);
        const q = qs.toString();
        setRows(await api<EscalationRow[]>(`/admin/escalations${q ? `?${q}` : ''}`));
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) setError('Sezione riservata.');
        else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      } finally {
        setLoading(false);
      }
    })();
  }, [status, category]);

  async function changeStatus(id: string, next: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: next } : r)));
    try {
      await api(`/admin/escalations/${id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aggiornamento non riuscito.');
    }
  }

  const name = (c: EscalationRow['client']) => (c ? [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email : '—');

  // Categoria e stato hanno già la loro tendina in cima: sono filtri del server (rifanno la
  // chiamata), quindi qui restano solo ordinabili — due filtri per la stessa colonna, uno che
  // ricarica e uno che no, sarebbero solo un modo di litigare con sé stessi.
  const COLONNE: Colonna<EscalationRow>[] = [
    // `name` restituisce il trattino per la cella; per ordinare serve il vuoto vero, altrimenti le
    // righe senza cliente si ordinano come se si chiamassero «—».
    { chiave: 'cliente', titolo: 'Cliente', valore: (r) => (r.client ? name(r.client) : null), filtro: 'testo' },
    { chiave: 'categoria', titolo: 'Categoria', valore: (r) => (r.category ? CATEGORY_LABEL[r.category] ?? r.category : null) },
    { chiave: 'motivo', titolo: 'Motivo', valore: (r) => r.reason, filtro: 'testo' },
    { chiave: 'origine', titolo: 'Origine', valore: (r) => r.source, filtro: 'scelta', etichettaTutti: 'Tutte', etichetta: (v) => SOURCE[v] ?? v },
    { chiave: 'incarico', titolo: 'Presa in carico', valore: (r) => r.assignedTo?.displayName, filtro: 'scelta', etichettaTutti: 'Tutti' },
    { chiave: 'data', titolo: 'Data', valore: (r) => r.createdAt },
    { chiave: 'stato', titolo: 'Stato', valore: (r) => r.status, esporta: (r) => STATO_ETICHETTA[r.status] ?? r.status },
  ];

  const t = useTabella(rows, COLONNE, { testaFissa: true, ordineIniziale: { chiave: 'data', direzione: 'desc' }, nomeExcel: 'Segnalazioni'});

  if (loading) return <Spinner />;

  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>Segnalazioni da screening, coach o motore. Presa in carico dal nutrizionista.</p>

      <div className="spread" style={{ marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="segnalazioni" />
          <BottoneExcel tabella={t} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ maxWidth: 240 }}
            placeholder="Cerca in tutte le colonne…"
            value={t.ricerca}
            onChange={(e) => t.setRicerca(e.target.value)}
          />
          <select className="select" style={{ width: 200 }} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Tutte le categorie</option>
            {Object.entries(CATEGORY_LABEL).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
          <select className="select" style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tutti gli stati</option>
            <option value="open">Aperte</option>
            <option value="in_progress">In corso</option>
            <option value="resolved">Risolte</option>
          </select>
        </div>
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        <Pager {...t.pager} sopra />
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">{rows.length === 0 ? 'Nessuna segnalazione.' : 'Nessuna segnalazione con questi filtri.'}</div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.client ? (
                      <span className="link" style={{ cursor: 'pointer' }} onClick={() => navigate(`/clienti/${r.client!.id}`)}>{name(r.client)}</span>
                    ) : '—'}
                  </td>
                  <td>
                    {r.category ? (
                      <span className={`chip ${CATEGORY_CHIP[r.category] ?? 'gray'}`}>{CATEGORY_LABEL[r.category] ?? r.category}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ maxWidth: 320 }}>{r.reason}</td>
                  <td className="muted">{SOURCE[r.source] ?? r.source}</td>
                  <td className="muted">{r.assignedTo?.displayName ?? '—'}</td>
                  <td className="muted">{date(r.createdAt)}</td>
                  <td>
                    <select className="select" value={r.status} onChange={(e) => changeStatus(r.id, e.target.value)} style={{ width: 130 }}>
                      <option value="open">Aperta</option>
                      <option value="in_progress">In corso</option>
                      <option value="resolved">Risolta</option>
                    </select>
                  </td>
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
