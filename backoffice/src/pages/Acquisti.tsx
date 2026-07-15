import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Pager, Spinner, usePagination } from '../components/ui';

interface Purchase {
  id: string;
  clientId: string;
  amountCents: number;
  description: string;
  method: string;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  refundCents: number | null;
  refundedAt: string | null;
  client: { email: string; clientProfile: { name: string | null } | null } | null;
}
interface Plan { id: string; name: string; priceCents: number; period: string }
interface ClientUser { id: string; email: string }

const euro = (c: number | null | undefined) => (c == null ? '—' : '€ ' + (c / 100).toFixed(2).replace('.', ','));
const date = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');
const clientName = (p: Purchase) => p.client?.clientProfile?.name ?? p.client?.email ?? 'Cliente';
const methodLabel = (m: string) => (m === 'card' ? 'Carta' : m === 'manual' ? 'Manuale' : 'Bonifico');
/** Stile compatto dei campi filtro nella riga sotto le intestazioni. */
const F: CSSProperties = { fontSize: 12, padding: '4px 8px', fontWeight: 400, width: '100%' };
const STATUS: Record<string, { label: string; chip: string }> = {
  approved: { label: 'Pagato', chip: '' },
  receipt_uploaded: { label: 'Da approvare', chip: 'amber' },
  pending: { label: 'In attesa', chip: 'gray' },
  rejected: { label: 'Rifiutato', chip: 'red' },
  cancelled: { label: 'Annullato', chip: 'gray' },
};

export function Acquisti() {
  const { can } = useAuth();
  const isAdmin = can('accounting', 'manage');
  const [rows, setRows] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  // Filtri per colonna (tutti combinabili tra loro e con la ricerca globale).
  const [fCliente, setFCliente] = useState('');
  const [fProdotto, setFProdotto] = useState('');
  const [fImporto, setFImporto] = useState('');
  const [fMetodo, setFMetodo] = useState('');
  const [fStato, setFStato] = useState('');
  const [fDataDa, setFDataDa] = useState('');
  const [fDataA, setFDataA] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [refundTarget, setRefundTarget] = useState<Purchase | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await api<Purchase[]>('/admin/purchases'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const qCli = fCliente.trim().toLowerCase();
    const qProd = fProdotto.trim().toLowerCase();
    const qImp = fImporto.trim().replace(',', '.');
    const list = rows.filter((r) => {
      if (q && !(clientName(r).toLowerCase().includes(q) || (r.client?.email ?? '').toLowerCase().includes(q) || r.description.toLowerCase().includes(q))) return false;
      if (qCli && !(clientName(r).toLowerCase().includes(qCli) || (r.client?.email ?? '').toLowerCase().includes(qCli))) return false;
      if (qProd && !r.description.toLowerCase().includes(qProd)) return false;
      if (qImp && !(r.amountCents / 100).toFixed(2).includes(qImp)) return false;
      if (fMetodo && r.method !== fMetodo) return false;
      if (fStato === 'refunded') {
        if (!r.refundedAt) return false;
      } else if (fStato && r.status !== fStato) return false;
      const day = r.createdAt.slice(0, 10);
      if (fDataDa && day < fDataDa) return false;
      if (fDataA && day > fDataA) return false;
      return true;
    });
    // Più recenti in alto (il backend ora ordina già così; qui è la garanzia lato UI).
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [rows, filter, fCliente, fProdotto, fImporto, fMetodo, fStato, fDataDa, fDataA]);

  async function downloadReceipt(p: Purchase) {
    setError(null);
    setBusyId(p.id);
    try {
      const r = await api<{ fileName: string; mimeType: string; contentBase64: string }>(`/admin/purchases/${p.id}/receipt-pdf`);
      const bytes = Uint8Array.from(atob(r.contentBase64), (ch) => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: r.mimeType }));
      const a = document.createElement('a');
      a.href = url;
      a.download = r.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ricevuta non disponibile.');
    } finally {
      setBusyId(null);
    }
  }

  async function downloadRefundReceipt(p: Purchase) {
    setError(null);
    setBusyId(p.id);
    try {
      const r = await api<{ fileName: string; mimeType: string; contentBase64: string }>(`/admin/purchases/${p.id}/refund-receipt-pdf`);
      const bytes = Uint8Array.from(atob(r.contentBase64), (ch) => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: r.mimeType }));
      const a = document.createElement('a');
      a.href = url;
      a.download = r.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ricevuta di rimborso non disponibile.');
    } finally {
      setBusyId(null);
    }
  }

  async function deletePurchase(p: Purchase) {
    if (!confirm(`Eliminare l'acquisto di ${clientName(p)} da ${euro(p.amountCents)}?\nVerranno annullati provvigioni, incasso, buono sconto e l'abbonamento collegato.`)) return;
    setError(null);
    setNotice(null);
    setBusyId(p.id);
    try {
      await api(`/admin/purchases/${p.id}`, { method: 'DELETE' });
      setRows((rs) => rs.filter((x) => x.id !== p.id));
      setNotice('Acquisto eliminato.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può eliminare gli acquisti.');
      else setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    } finally {
      setBusyId(null);
    }
  }

  const pg = usePagination(filtered, 100);

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <input className="input" style={{ maxWidth: 300 }} placeholder="Cerca per cliente o prodotto…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {isAdmin && (
          <button className="btn" onClick={() => setShowCreate(true)}>
            <i className="ti ti-plus" /> Nuovo acquisto
          </button>
        )}
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty">Nessun acquisto.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Prodotto</th>
                <th>Importo</th>
                <th>Metodo</th>
                <th>Stato</th>
                <th>Data</th>
                <th style={{ textAlign: 'right' }}>Ricevuta</th>
              </tr>
              <tr className="filters">
                <th><input className="input" style={F} placeholder="Filtra…" value={fCliente} onChange={(e) => setFCliente(e.target.value)} /></th>
                <th><input className="input" style={F} placeholder="Filtra…" value={fProdotto} onChange={(e) => setFProdotto(e.target.value)} /></th>
                <th><input className="input" style={F} placeholder="es. 297" value={fImporto} onChange={(e) => setFImporto(e.target.value)} /></th>
                <th>
                  <select className="input" style={F} value={fMetodo} onChange={(e) => setFMetodo(e.target.value)}>
                    <option value="">Tutti</option>
                    <option value="card">Carta</option>
                    <option value="bank_transfer">Bonifico</option>
                    <option value="manual">Manuale</option>
                  </select>
                </th>
                <th>
                  <select className="input" style={F} value={fStato} onChange={(e) => setFStato(e.target.value)}>
                    <option value="">Tutti</option>
                    <option value="approved">Pagato</option>
                    <option value="receipt_uploaded">Da approvare</option>
                    <option value="pending">In attesa</option>
                    <option value="rejected">Rifiutato</option>
                    <option value="cancelled">Annullato</option>
                    <option value="refunded">Stornato</option>
                  </select>
                </th>
                <th style={{ whiteSpace: 'nowrap' }}>
                  <input className="input" style={{ ...F, width: 118, display: 'inline-block' }} type="date" title="Dal giorno" value={fDataDa} onChange={(e) => setFDataDa(e.target.value)} />{' '}
                  <input className="input" style={{ ...F, width: 118, display: 'inline-block' }} type="date" title="Al giorno" value={fDataA} onChange={(e) => setFDataA(e.target.value)} />
                </th>
                <th style={{ textAlign: 'right' }}>
                  {(fCliente || fProdotto || fImporto || fMetodo || fStato || fDataDa || fDataA) && (
                    <button className="btn ghost sm" title="Pulisci i filtri" onClick={() => { setFCliente(''); setFProdotto(''); setFImporto(''); setFMetodo(''); setFStato(''); setFDataDa(''); setFDataA(''); }}>
                      <i className="ti ti-filter-off" /> Pulisci
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {pg.pageItems.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{clientName(p)}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{p.client?.email ?? '—'}</div>
                  </td>
                  <td>{p.description}</td>
                  <td><b>{euro(p.amountCents)}</b></td>
                  <td className="muted">{methodLabel(p.method)}</td>
                  <td>
                    <span className={`chip ${STATUS[p.status]?.chip ?? 'gray'}`}>{STATUS[p.status]?.label ?? p.status}</span>
                    {p.refundedAt && (
                      <div><span className="chip red" title={`Stornato il ${date(p.refundedAt)}`}>Stornato −{euro(p.refundCents).replace('€ ', '€')}</span></div>
                    )}
                  </td>
                  <td className="muted">{date(p.createdAt)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" disabled={busyId === p.id} onClick={() => downloadReceipt(p)} title="Scarica la ricevuta PDF">
                      <i className="ti ti-download" /> Ricevuta
                    </button>
                    {p.refundedAt && (
                      <button className="btn ghost sm" disabled={busyId === p.id} onClick={() => downloadRefundReceipt(p)} title="Scarica la ricevuta di rimborso" style={{ marginLeft: 6 }}>
                        <i className="ti ti-receipt-refund" /> Rimborso
                      </button>
                    )}
                    {isAdmin && p.status === 'approved' && !p.refundedAt && (
                      <button className="btn ghost sm" disabled={busyId === p.id} onClick={() => setRefundTarget(p)} title="Storna l'acquisto (rimborso)" style={{ marginLeft: 6 }}>
                        <i className="ti ti-arrow-back-up" /> Storno
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => deletePurchase(p)}
                        disabled={busyId === p.id}
                        title="Elimina acquisto"
                        style={{ border: 'none', background: 'transparent', color: '#e5484d', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4, marginLeft: 6, verticalAlign: 'middle' }}
                      >
                        <i className="ti ti-x" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager page={pg.page} totalPages={pg.totalPages} total={pg.total} from={pg.from} to={pg.to} onPage={pg.setPage} />
      </div>

      {showCreate && (
        <CreatePurchaseModal
          onClose={() => setShowCreate(false)}
          onCreated={(msg) => { setShowCreate(false); setNotice(msg); void load(); }}
        />
      )}

      {refundTarget && (
        <RefundModal
          purchase={refundTarget}
          onClose={() => setRefundTarget(null)}
          onDone={(msg) => { setRefundTarget(null); setNotice(msg); void load(); }}
        />
      )}
    </>
  );
}

/**
 * Storno di un acquisto pagato: l'operatore decide QUANTO rimborsare (anche
 * parziale). Registra il rimborso, blocca i menu (abbonamento annullato), storna
 * le provvigioni in proporzione e invia alla cliente la ricevuta di rimborso.
 * Il rimborso EFFETTIVO (Stripe o bonifico) resta a carico dell'operatore.
 */
function RefundModal({ purchase, onClose, onDone }: { purchase: Purchase; onClose: () => void; onDone: (msg: string) => void }) {
  const [amount, setAmount] = useState((purchase.amountCents / 100).toFixed(2).replace('.', ','));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedCents = Math.round(Number(amount.replace(/\./g, '').replace(',', '.')) * 100);
  const valid = Number.isFinite(parsedCents) && parsedCents > 0 && parsedCents <= purchase.amountCents;

  async function submit() {
    if (!valid) { setError(`Importo non valido: deve essere tra 0,01 e ${euro(purchase.amountCents)}.`); return; }
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/purchases/${purchase.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({ amountCents: parsedCents, note: note.trim() || undefined }),
      });
      onDone(`Storno registrato: ${euro(parsedCents)} a ${clientName(purchase)}. Ricordati di eseguire il rimborso su Stripe o via bonifico.`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Storno acquisto" onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        <b>{clientName(purchase)}</b> · {purchase.description} · pagato <b>{euro(purchase.amountCents)}</b> il {date(purchase.approvedAt ?? purchase.createdAt)}
      </p>
      <div className="field">
        <label>Quanto rimborsiamo?</label>
        <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 140 }} placeholder="es. 297,00" />
      </div>
      <div className="field">
        <label>Nota (facoltativa, finisce sulla ricevuta)</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Es. recesso entro 14 giorni" />
      </div>
      <Banner kind="info">
        Lo storno: <b>blocca l'erogazione dei menu</b> (l'abbonamento collegato viene annullato), invia alla cliente la
        <b> ricevuta di rimborso</b> via email e <b>storna le provvigioni in proporzione</b> all'importo. Il rimborso
        effettivo su Stripe/bonifico lo esegui tu dal pannello.
      </Banner>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={submit} disabled={busy || !valid}>
          {busy ? 'Storno in corso…' : `Storna ${valid ? euro(parsedCents) : ''}`}
        </button>
      </div>
    </Modal>
  );
}

function CreatePurchaseModal({ onClose, onCreated }: { onClose: () => void; onCreated: (msg: string) => void }) {
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [clientId, setClientId] = useState('');
  const [planId, setPlanId] = useState('');
  const [generateCommissions, setGenerateCommissions] = useState(true);
  const [discountCode, setDiscountCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, pl] = await Promise.all([
          api<{ items: ClientUser[] }>('/admin/users?role=client'),
          api<Plan[]>('/plans'),
        ]);
        setClients(c.items);
        setPlans(pl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      }
    })();
  }, []);

  const plan = plans.find((p) => p.id === planId);

  async function submit() {
    if (!clientId || !planId) { setError('Scegli cliente e piano.'); return; }
    setBusy(true);
    setError(null);
    try {
      await api('/admin/purchases', { method: 'POST', body: JSON.stringify({ clientId, planId, generateCommissions, discountCode: discountCode.trim() || undefined }) });
      onCreated(`Acquisto registrato${generateCommissions ? ' (con provvigioni)' : ' (senza provvigioni)'}.`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nuovo acquisto manuale" onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      <div className="field">
        <label>Cliente</label>
        <select className="select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Scegli la cliente…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.email}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Piano</label>
        <select className="select" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">Scegli il piano…</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {euro(p.priceCents)}</option>)}
        </select>
      </div>
      {plan && (
        <p className="muted" style={{ fontSize: 13 }}>
          Verrà attivato l'abbonamento <b>{plan.name}</b> ({plan.period}) per <b>{euro(plan.priceCents)}</b>.
        </p>
      )}
      <div className="field">
        <label>Buono sconto (facoltativo)</label>
        <input className="input" value={discountCode} onChange={(e) => setDiscountCode(e.target.value.toUpperCase())} placeholder="Es. ESTATE25" style={{ width: 200, textTransform: 'uppercase' }} />
      </div>
      <label className="row" style={{ gap: 10, alignItems: 'center', cursor: 'pointer', marginTop: 6 }}>
        <input type="checkbox" checked={generateCommissions} onChange={(e) => setGenerateCommissions(e.target.checked)} />
        <span>Genera le provvigioni (coach, nutrizionista e responsabili)</span>
      </label>
      <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
        Se disattivato, il piano viene attivato ma non viene pagata nessuna provvigione.
      </p>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={submit} disabled={busy || !clientId || !planId}>
          {busy ? 'Registro…' : 'Registra acquisto'}
        </button>
      </div>
    </Modal>
  );
}
