import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Banner, Spinner } from '../components/ui';

interface Pending {
  id: string;
  name: string;
  email: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  hoursLeft: number | null;
}

export function LeadDaAccettare() {
  const [rows, setRows] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await api<Pending[]>('/crm/my-assignments'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function accept(p: Pending) {
    setBusy(p.id);
    setError(null);
    try {
      await api(`/crm/leads/${p.id}/accept`, { method: 'POST' });
      setRows((rs) => rs.filter((x) => x.id !== p.id));
      setNotice(`Hai accettato ${p.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setBusy(null);
    }
  }

  async function reject(p: Pending) {
    const reason = prompt(`Rifiuti il lead ${p.name}? Motivo (facoltativo):`);
    if (reason === null) return; // annullato
    setBusy(p.id);
    setError(null);
    try {
      await api(`/crm/leads/${p.id}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason || undefined }) });
      setRows((rs) => rs.filter((x) => x.id !== p.id));
      setNotice(`Hai rifiutato ${p.name}: torna alla responsabile.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        Lead che ti sono stati assegnati: accettali entro 2 giorni, altrimenti tornano alla responsabile.
      </p>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {rows.length === 0 ? (
        <div className="card"><div className="empty">Nessun lead in attesa di accettazione. 👍</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((p) => (
            <div className="card" key={p.id}>
              <div className="spread">
                <div>
                  <b style={{ fontSize: 16 }}>{p.name}</b>
                  {p.email && <div className="muted" style={{ fontSize: 13 }}>{p.email}</div>}
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    {p.assignedBy ? `Assegnato da ${p.assignedBy}` : 'Assegnato'}
                    {p.hoursLeft != null && (
                      <span className={`chip ${p.hoursLeft <= 12 ? 'red' : 'amber'}`} style={{ marginLeft: 8, fontSize: 10 }}>
                        {p.hoursLeft > 0 ? `~${p.hoursLeft}h rimaste` : 'in scadenza'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" disabled={busy === p.id} onClick={() => accept(p)}>
                    <i className="ti ti-check" /> Accetta
                  </button>
                  <button className="btn danger" disabled={busy === p.id} onClick={() => reject(p)}>Rifiuta</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
