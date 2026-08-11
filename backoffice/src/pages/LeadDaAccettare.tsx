import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Pager, Spinner, Toggle } from '../components/ui';
import { BottoneExcel, ContatoreRighe, useTabella, type Colonna } from '../components/tabella';

/** Un lead in attesa di accettazione (endpoint operativo: è su questi che si accetta/rifiuta). */
interface Pending {
  id: string;
  name: string;
  email: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  hoursLeft: number | null;
  coachName?: string | null;
  mine?: boolean;
}

/** Una riga di storico (tabella `lead_assignment`): comprende le chiuse, con l'esito. */
interface Storico {
  id: string;
  recordId: string;
  name: string;
  email: string | null;
  clientId: string | null;
  coachName: string;
  assignedBy: string | null;
  status: string;
  origin: string;
  assignedAt: string;
  resolvedAt: string | null;
  reason: string | null;
  mine: boolean;
  hoursLeft: number | null;
}

interface Coach { id: string; displayName: string }

/** La forma unica con cui la tabella disegna sia le pendenti sia lo storico. */
interface Riga {
  /** Chiave React: id dell'assegnazione per lo storico, id del lead per le pendenti. */
  key: string;
  recordId: string;
  name: string;
  email: string | null;
  clientId: string | null;
  coachName: string | null;
  assignedBy: string | null;
  status: string;
  origin: string | null;
  assignedAt: string | null;
  resolvedAt: string | null;
  reason: string | null;
  hoursLeft: number | null;
  mine: boolean;
  /** true solo per le righe su cui si può ancora agire (accettare o rifiutare). */
  daFare: boolean;
}

const STATO_LABEL: Record<string, string> = {
  pending: 'In attesa',
  accepted: 'Accettato',
  rejected: 'Rifiutato',
  expired: 'Scaduto',
  reassigned: 'Riassegnato',
};

const ORIGINE_LABEL: Record<string, string> = {
  manual: 'assegnato a mano',
  bulk: 'assegnazione in massa',
  ref_code: 'ref code della coach',
};

const CHIP_STATO: Record<string, string> = {
  pending: 'amber',
  accepted: '',
  rejected: 'red',
  expired: 'red',
  reassigned: 'gray',
};

const data = (s: string | null) =>
  s ? new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export function LeadDaAccettare() {
  const { can } = useAuth();
  // Coordinatrice (o responsabile): può riassegnare in massa alle coach del suo team.
  const canAssign = can('assign_coach', 'manage');
  const [pendenti, setPendenti] = useState<Pending[]>([]);
  const [storico, setStorico] = useState<Storico[]>([]);
  const [mostraStorico, setMostraStorico] = useState(false);
  const [caricoStorico, setCaricoStorico] = useState(false);
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
      setPendenti(await api<Pending[]>('/crm/my-assignments'));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Lo storico si carica solo quando serve. Sono le assegnazioni chiuse di tutto il perimetro:
   * per la responsabile sono migliaia di righe, e caricarle a ogni apertura della pagina per una
   * spunta che nella maggior parte dei casi resta chiusa sarebbe un peso senza motivo.
   */
  async function loadStorico() {
    setCaricoStorico(true);
    try {
      setStorico(await api<Storico[]>('/crm/my-assignments/storico'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Storico non disponibile.');
    } finally {
      setCaricoStorico(false);
    }
  }

  useEffect(() => {
    void load();
    if (canAssign) { api<Coach[]>('/crm/coaches').then(setCoaches).catch(() => setCoaches([])); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mostraStorico && storico.length === 0 && !caricoStorico) void loadStorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostraStorico]);

  /**
   * Le righe della tabella: le pendenti vengono SEMPRE dall'endpoint operativo, non dallo storico.
   * È una scelta di sicurezza: se una scrittura sull'archivio fallisse, un lead in attesa
   * spariterebbe dalla lista delle cose da fare, e nessuno se ne accorgerebbe. L'archivio aggiunge
   * le righe già chiuse, che sono l'unica cosa che non si può sapere da `crm_record`.
   */
  const righe: Riga[] = useMemo(() => {
    const attesa: Riga[] = pendenti.map((p) => ({
      key: p.id,
      recordId: p.id,
      name: p.name,
      email: p.email,
      clientId: null,
      coachName: p.coachName ?? null,
      assignedBy: p.assignedBy,
      status: 'pending',
      origin: null,
      assignedAt: p.assignedAt,
      resolvedAt: null,
      reason: null,
      hoursLeft: p.hoursLeft,
      mine: p.mine ?? true,
      daFare: p.mine ?? true,
    }));
    if (!mostraStorico) return attesa;
    const chiuse: Riga[] = storico
      .filter((s) => s.status !== 'pending')
      .map((s) => ({
        key: s.id,
        recordId: s.recordId,
        name: s.name,
        email: s.email,
        clientId: s.clientId,
        coachName: s.coachName,
        assignedBy: s.assignedBy,
        status: s.status,
        origin: s.origin,
        assignedAt: s.assignedAt,
        resolvedAt: s.resolvedAt,
        reason: s.reason,
        hoursLeft: null,
        mine: s.mine,
        daFare: false,
      }));
    return [...attesa, ...chiuse];
  }, [pendenti, storico, mostraStorico]);

  const COLONNE: Colonna<Riga>[] = [
    ...(canAssign ? [{ chiave: 'sel', titolo: '' } as Colonna<Riga>] : []),
    { chiave: 'nome', titolo: 'Lead', valore: (r) => r.name, filtro: 'testo' },
    { chiave: 'email', titolo: 'Email', valore: (r) => r.email, filtro: 'testo' },
    { chiave: 'coach', titolo: 'Coach', valore: (r) => r.coachName, filtro: 'scelta', etichettaTutti: 'Tutte' },
    { chiave: 'da', titolo: 'Assegnato da', valore: (r) => r.assignedBy, filtro: 'scelta', etichettaTutti: 'Tutti' },
    { chiave: 'quando', titolo: 'Assegnato il', valore: (r) => r.assignedAt },
    {
      chiave: 'stato',
      titolo: 'Stato',
      valore: (r) => STATO_LABEL[r.status] ?? r.status,
      filtro: 'scelta',
      etichettaTutti: 'Tutti',
      // «In attesa» in cima: è l'unico stato su cui c'è ancora qualcosa da fare.
      ordineScelte: ['In attesa', 'Accettato', 'Rifiutato', 'Scaduto', 'Riassegnato'],
    },
    { chiave: 'azioni', titolo: '' },
  ];

  const t = useTabella(righe, COLONNE, { testaFissa: true, ordineIniziale: { chiave: 'quando', direzione: 'asc' }, nomeExcel: 'Lead da accettare'});

  // La selezione multipla vale solo sulle righe in attesa e visibili: selezionare «tutti» e
  // ritrovarsi ad assegnare anche righe filtrate via sarebbe una sorpresa spiacevole.
  const selezionabili = useMemo(() => t.tutte.filter((r) => r.status === 'pending').map((r) => r.recordId), [t.tutte]);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === selezionabili.length ? new Set() : new Set(selezionabili)));
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
      if (mostraStorico) await loadStorico();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assegnazione non riuscita.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function accept(r: Riga) {
    setBusy(r.recordId);
    setError(null);
    try {
      await api(`/crm/leads/${r.recordId}/accept`, { method: 'POST' });
      setPendenti((rs) => rs.filter((x) => x.id !== r.recordId));
      setNotice(`Hai accettato ${r.name}.`);
      if (mostraStorico) await loadStorico();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setBusy(null);
    }
  }

  async function reject(r: Riga) {
    const reason = prompt(`Rifiuti il lead ${r.name}? Motivo (facoltativo):`);
    if (reason === null) return; // annullato
    setBusy(r.recordId);
    setError(null);
    try {
      await api(`/crm/leads/${r.recordId}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason || undefined }) });
      setPendenti((rs) => rs.filter((x) => x.id !== r.recordId));
      setNotice(`Hai rifiutato ${r.name}: torna alla responsabile.`);
      if (mostraStorico) await loadStorico();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Spinner />;

  const inAttesa = pendenti.length;

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        {canAssign
          ? 'I lead in attesa di accettazione nel tuo perimetro: accetta i tuoi, oppure selezionane uno o più e assegnali in massa a una delle tue coach.'
          : 'Lead che ti sono stati assegnati: accettali entro 2 giorni, altrimenti tornano alla responsabile.'}
      </p>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="spread" style={{ marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="assegnazioni" />
          <BottoneExcel tabella={t} />
        </div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            style={{ maxWidth: 240 }}
            placeholder="Cerca nome o email…"
            value={t.ricerca}
            onChange={(e) => t.setRicerca(e.target.value)}
          />
          {/*
            «Mostra accettati» (richiesta dell'11/8): non solo gli accettati, anche i rifiutati, gli
            scaduti e i riassegnati — la domanda a cui serve rispondere è «cosa è successo a questo
            lead», e un rifiuto è la risposta più interessante di un'accettazione.
          */}
          <label className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer' }} title="Mostra anche le assegnazioni già chiuse: accettate, rifiutate, scadute">
            <Toggle on={mostraStorico} onChange={setMostraStorico} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Mostra accettati e storico</span>
          </label>
        </div>
      </div>

      {mostraStorico && caricoStorico && <Banner kind="info">Carico lo storico…</Banner>}

      {/* Barra di riassegnazione massiva (coordinatrice/responsabile) */}
      {canAssign && selezionabili.length > 0 && (
        <div className="card" style={{ padding: '10px 14px', marginBottom: 12 }}>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="row" style={{ gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.size === selezionabili.length && selezionabili.length > 0} onChange={toggleAll} />
              <span style={{ fontSize: 13 }}>Seleziona tutti in attesa ({selected.size}/{selezionabili.length})</span>
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

      <div className="card" style={{ padding: 0 }}>
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">
            {inAttesa === 0 && !mostraStorico
              ? 'Nessun lead in attesa di accettazione. 👍'
              : 'Nessuna assegnazione con questi filtri.'}
          </div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((r) => (
                <tr key={r.key} style={selected.has(r.recordId) && r.status === 'pending' ? { outline: '2px solid var(--teal)' } : undefined}>
                  {canAssign && (
                    <td style={{ width: 32 }}>
                      {r.status === 'pending' && (
                        <input type="checkbox" checked={selected.has(r.recordId)} onChange={() => toggle(r.recordId)} />
                      )}
                    </td>
                  )}
                  <td>
                    <b>{r.clientId ? <Link to={`/clienti/${r.clientId}`}>{r.name}</Link> : r.name}</b>
                    {r.origin && <div className="muted" style={{ fontSize: 11 }}>{ORIGINE_LABEL[r.origin] ?? r.origin}</div>}
                    {r.reason && <div className="muted" style={{ fontSize: 11 }}>Motivo: {r.reason}</div>}
                  </td>
                  <td className="muted" style={{ fontSize: 13 }}>{r.email ?? '—'}</td>
                  <td>
                    {r.coachName ?? '—'}
                    {r.mine && <span className="chip" style={{ marginLeft: 6, fontSize: 10 }}>tu</span>}
                  </td>
                  <td className="muted" style={{ fontSize: 13 }}>{r.assignedBy ?? '—'}</td>
                  <td className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    {data(r.assignedAt)}
                    {r.resolvedAt && <div style={{ fontSize: 11 }}>chiuso il {data(r.resolvedAt)}</div>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className={`chip ${CHIP_STATO[r.status] ?? 'gray'}`}>{STATO_LABEL[r.status] ?? r.status}</span>
                    {r.status === 'pending' && r.hoursLeft != null && (
                      <span className={`chip ${r.hoursLeft <= 12 ? 'red' : 'amber'}`} style={{ marginLeft: 6, fontSize: 10 }}>
                        {r.hoursLeft > 0 ? `~${r.hoursLeft}h` : 'in scadenza'}
                      </span>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {/* Accetta/Rifiuta solo sui lead in attesa su di ME (per quelli del team si riassegna). */}
                    {r.daFare && r.status === 'pending' && (
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn sm" disabled={busy === r.recordId} onClick={() => accept(r)}>
                          <i className="ti ti-check" /> Accetta
                        </button>
                        <button className="btn danger sm" disabled={busy === r.recordId} onClick={() => reject(r)}>Rifiuta</button>
                      </div>
                    )}
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
