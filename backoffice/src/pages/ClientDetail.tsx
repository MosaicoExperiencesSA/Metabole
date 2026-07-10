import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner } from '../components/ui';

interface Detail {
  user: { id: string; email: string; status: string; locale: string; emailVerifiedAt: string | null; createdAt: string };
  profile: any | null;
  objective: any | null;
  measurements: { id: string; date: string; weightKg: number; waistCm: number | null; hipsCm: number | null }[];
  subscription: any | null;
  payments: { id: string; amountCents: number; description: string; method: string; status: string; createdAt: string; approvedAt: string | null }[];
  crm: { stage: string; valueCents: number | null } | null;
}

const L: Record<string, Record<string, string>> = {
  sex: { female: 'Donna', male: 'Uomo' },
  regime: { omnivore: 'Onnivora', vegetarian: 'Vegetariana', vegan: 'Vegana' },
  dietStyle: { mediterranean: 'Mediterranea', protein: 'Proteica', low_carb: 'Low carb', flexible: 'Flessibile' },
  pathType: { classic3: '3 pasti', five: '5 pasti', supplements: 'Con integratori', intermittent_fasting: 'Digiuno intermittente' },
  coachStyle: { daily: 'Contatto quotidiano', when_needed: 'Quando serve', on_request: 'Su richiesta' },
  character: { follows: 'Segue bene', needs_push: 'Va spronata', perseveres: 'Persevera', quits: 'Molla facilmente' },
  payStatus: { pending: 'In attesa', receipt_uploaded: 'Contabile caricata', approved: 'Approvato', rejected: 'Rifiutato' },
  subStatus: { pending: 'In attesa', active: 'Attivo', paused: 'In pausa', expired: 'Scaduto', cancelled: 'Annullato' },
  method: { bank_transfer: 'Bonifico', card: 'Carta' },
};
const lab = (group: string, v: string | null | undefined) => (v ? L[group]?.[v] ?? v : '—');
const euro = (c: number | null | undefined) => (c == null ? '—' : '€ ' + (c / 100).toFixed(2).replace('.', ','));
const date = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ width: 190, flex: 'none', color: 'var(--muted)', fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}

export function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const isAdmin = can('permissions'); // il reset password è azione admin
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setD(await api<Detail>(`/admin/clients/${id}`));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function resetPassword() {
    if (!confirm('Inviare alla cliente l\'email per reimpostare la password?')) return;
    setResetting(true);
    setNotice(null);
    try {
      await api(`/admin/clients/${id}/reset-password`, { method: 'POST' });
      setNotice('Email di reset inviata alla cliente.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può inviare il reset password.');
      else setError(err instanceof Error ? err.message : 'Invio non riuscito.');
    } finally {
      setResetting(false);
    }
  }

  if (loading) return <Spinner />;
  if (!d) return <Banner kind="err">{error ?? 'Errore'}</Banner>;

  const p = d.profile;
  const first = d.measurements[d.measurements.length - 1];
  const last = d.measurements[0];
  const lost = first && last ? Math.round((first.weightKg - last.weightKg) * 10) / 10 : null;

  return (
    <>
      <button className="btn ghost sm" onClick={() => navigate(-1)} style={{ marginBottom: 14 }}>
        <i className="ti ti-arrow-left" /> Indietro
      </button>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {/* Intestazione */}
      <div className="card" style={{ background: 'linear-gradient(120deg,#10403a,#12a386)', color: '#fff', border: 'none' }}>
        <div className="spread">
          <div>
            <h2 style={{ color: '#fff', fontSize: 22, margin: 0 }}>{p?.name ?? d.user.email}</h2>
            <p style={{ margin: '4px 0 0', opacity: 0.9 }}>{d.user.email}</p>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>
                {d.user.status === 'active' ? 'Attivo' : 'Sospeso'}
              </span>
              {p?.screeningFlag && <span className="chip red">Percorso supervisionato</span>}
              {d.crm && <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>CRM: {d.crm.stage}</span>}
            </div>
          </div>
          {isAdmin && (
            <button className="btn ghost" onClick={resetPassword} disabled={resetting} style={{ background: 'rgba(255,255,255,.9)' }}>
              <i className="ti ti-key" /> {resetting ? 'Invio…' : 'Reset password'}
            </button>
          )}
        </div>
      </div>

      {/* Questionario / profilo */}
      <div className="card">
        <h2>Questionario</h2>
        {!p ? (
          <p className="muted">La cliente non ha ancora completato il questionario.</p>
        ) : (
          <>
            <Row label="Età" value={p.age ?? '—'} />
            <Row label="Sesso" value={lab('sex', p.sex)} />
            <Row label="Altezza" value={p.heightCm ? `${p.heightCm} cm` : '—'} />
            <Row label="Peso di partenza" value={p.startWeightKg ? `${p.startWeightKg} kg` : '—'} />
            <Row label="Regime" value={lab('regime', p.regime)} />
            <Row label="Stile alimentare" value={lab('dietStyle', p.dietStyle)} />
            <Row label="Pasti al giorno" value={p.mealsPerDay ?? '—'} />
            <Row label="Percorso" value={lab('pathType', p.pathType)} />
            <Row label="Stile coach" value={lab('coachStyle', p.coachStyle)} />
            <Row label="Carattere" value={lab('character', p.character)} />
            <Row label="Intolleranze" value={p.intolerances?.length ? p.intolerances.join(', ') : 'Nessuna'} />
            <Row label="Cibi non graditi" value={p.dislikedFoods?.length ? p.dislikedFoods.join(', ') : 'Nessuno'} />
            <Row label="Data inizio piano" value={date(p.planStartDate)} />
            <Row label="Coach assegnata" value={p.assignedCoach?.displayName ?? '—'} />
            <Row label="Nutrizionista" value={p.assignedNutritionist?.displayName ?? '—'} />
          </>
        )}
      </div>

      {/* Obiettivo */}
      {d.objective && (
        <div className="card">
          <h2>Obiettivo</h2>
          <Row label="Peso obiettivo" value={d.objective.targetWeightKg ? `${d.objective.targetWeightKg} kg` : '—'} />
          <Row label="Entro il" value={date(d.objective.targetDate)} />
          <Row label="Stato" value={d.objective.status === 'confirmed' ? 'Confermato' : d.objective.status === 'proposed' ? 'Da confermare' : d.objective.status} />
        </div>
      )}

      {/* Pesate */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '18px 20px 4px' }} className="spread">
          <h2 style={{ margin: 0 }}>Pesate</h2>
          {lost != null && <span className={`chip ${lost > 0 ? '' : 'gray'}`}>{lost > 0 ? `−${lost} kg` : `${Math.abs(lost)} kg`} dal via</span>}
        </div>
        {d.measurements.length === 0 ? (
          <div className="empty">Nessuna pesata registrata.</div>
        ) : (
          <table className="grid">
            <thead><tr><th>Data</th><th>Peso</th><th>Vita</th><th>Fianchi</th></tr></thead>
            <tbody>
              {d.measurements.map((m) => (
                <tr key={m.id}>
                  <td>{date(m.date)}</td>
                  <td><b>{m.weightKg} kg</b></td>
                  <td className="muted">{m.waistCm ? `${m.waistCm} cm` : '—'}</td>
                  <td className="muted">{m.hipsCm ? `${m.hipsCm} cm` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Acquisti */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '18px 20px 4px' }} className="spread">
          <h2 style={{ margin: 0 }}>Acquisti</h2>
          {d.subscription && (
            <span className="chip">{d.subscription.plan?.name} · {lab('subStatus', d.subscription.status)}</span>
          )}
        </div>
        {d.payments.length === 0 ? (
          <div className="empty">Nessun pagamento.</div>
        ) : (
          <table className="grid">
            <thead><tr><th>Descrizione</th><th>Importo</th><th>Metodo</th><th>Stato</th><th>Data</th></tr></thead>
            <tbody>
              {d.payments.map((pay) => (
                <tr key={pay.id}>
                  <td>{pay.description}</td>
                  <td>{euro(pay.amountCents)}</td>
                  <td className="muted">{lab('method', pay.method)}</td>
                  <td>
                    <span className={`chip ${pay.status === 'approved' ? '' : pay.status === 'rejected' ? 'red' : 'amber'}`}>
                      {lab('payStatus', pay.status)}
                    </span>
                  </td>
                  <td className="muted">{date(pay.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
