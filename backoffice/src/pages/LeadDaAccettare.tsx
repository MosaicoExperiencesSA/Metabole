import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner } from '../components/ui';

interface Pending {
  id: string;
  name: string;
  email: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  hoursLeft: number | null;
  // Vista coordinatrice: su quale coach del team è in attesa, e se è "mio".
  coachName?: string | null;
  mine?: boolean;
}
interface Coach { id: string; displayName: string }

export function LeadDaAccettare() {
  const { can } = useAuth();
  // Coordinatrice (o responsabile): può riassegnare in massa alle coach del suo team.
  const canAssign = can('assign_coach', 'manage');
  const [rows, setRows] = useState<Pending[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetCoach, setTargetCoach] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await api<Pending[]>('/crm/my-assignments'));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    if (canAssign) { api<Coach[]>('/crm/coaches').then(setCoaches).catch(() => setCoaches([])); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  /** Riassegnazione massiva (coordinatrice): i selezionati vanno a UNA coach del team. */
  async function bulkAssign() {
    const ids = [...selected];
    if (!targetCoach || ids.length === 0) return;
    setBulkBusy(true); setError(null); setNotice(null);
    try {
      const r = await api<{ assigned: number }>('/crm/leads/assign-coach-bulk', {
        method: 'POST',
        body: JSON.stringify({ coachStaffId: targetCoach, recordIds: ids }),
      });
      const coach = coaches.find((c) => c.id === targetCoach);
      setNotice(`${r.assigned} lead assegnati a ${coach?.displayName ?? 'coach'}: hanno 2 giorni per accettarli.`);
      setTargetCoach('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assegnazione non riuscita.');
    } finally {
      setBulkBusy(false);
    }
  }

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
        {canAssign
          ? 'I lead in attesa di accettazione nel tuo perimetro: accetta i tuoi, oppure selezionane uno o più e assegnali in massa a una delle tue coach.'
          : 'Lead che ti sono stati assegnati: accettali entro 2 giorni, altrimenti tornano alla responsabile.'}
      </p>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {/* Barra di riassegnazione massiva (coordinatrice/responsabile) */}
      {canAssign && rows.length > 0 && (
        <div className="card" style={{ padding: '10px 14px', marginBottom: 12 }}>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="row" style={{ gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} />
              <span style={{ fontSize: 13 }}>Seleziona tutti ({selected.size}/{rows.length})</span>
            </label>
            <select className="select" style={{ width: 220 }} value={targetCoach} onChange={(e) => setTargetCoach(e.target.value)}>
              <option value="">— assegna a una coach —</option>
              {coaches.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
            </select>
            <button className="btn" disabled={bulkBusy || !targetCoach || selected.size === 0} onClick={bulkAssign}>
              <i className="ti ti-users" /> {bulkBusy ? 'Assegno…' : `Assegna ${selected.size || ''} selezionat${selected.size === 1 ? 'o' : 'i'}`}
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card"><div className="empty">Nessun lead in attesa di accettazione. 👍</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((p) => (
            <div className="card" key={p.id} style={selected.has(p.id) ? { outline: '2px solid var(--teal)' } : undefined}>
              <div className="spread">
                <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                  {canAssign && (
                    <input type="checkbox" style={{ marginTop: 5 }} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  )}
                  <div>
                    <b style={{ fontSize: 16 }}>{p.name}</b>
                    {p.email && <div className="muted" style={{ fontSize: 13 }}>{p.email}</div>}
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {p.assignedBy ? `Assegnato da ${p.assignedBy}` : 'Assegnato'}
                      {canAssign && p.coachName && (
                        <span className="chip" style={{ marginLeft: 8, fontSize: 10 }}>
                          in attesa da: {p.mine ? 'te' : p.coachName}
                        </span>
                      )}
                      {p.hoursLeft != null && (
                        <span className={`chip ${p.hoursLeft <= 12 ? 'red' : 'amber'}`} style={{ marginLeft: 8, fontSize: 10 }}>
                          {p.hoursLeft > 0 ? `~${p.hoursLeft}h rimaste` : 'in scadenza'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Accetta/Rifiuta solo sui lead in attesa su di ME (per quelli del team si riassegna). */}
                {(p.mine ?? true) && (
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn" disabled={busy === p.id} onClick={() => accept(p)}>
                      <i className="ti ti-check" /> Accetta
                    </button>
                    <button className="btn danger" disabled={busy === p.id} onClick={() => reject(p)}>Rifiuta</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
