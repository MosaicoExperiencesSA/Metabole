import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Spinner } from '../components/ui';

interface Purchase {
  id: string;
  clientId: string;
  amountCents: number;
  description: string;
  method: string;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  client: { email: string; clientProfile: { name: string | null } | null } | null;
}
interface Plan { id: string; name: string; priceCents: number; period: string }
interface ClientUser { id: string; email: string }

const euro = (c: number | null | undefined) => (c == null ? '—' : '€ ' + (c / 100).toFixed(2).replace('.', ','));
const date = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');
const clientName = (p: Purchase) => p.client?.clientProfile?.name ?? p.client?.email ?? 'Cliente';
const methodLabel = (m: string) => (m === 'card' ? 'Carta' : m === 'manual' ? 'Manuale' : 'Bonifico');
const STATUS: Record<string, { label: string; chip: string }> = {
  approved: { label: 'Pagato', chip: '' },
  receipt_uploaded: { label: 'Da approvare', chip: 'amber' },
  pending: { label: 'In attesa', chip: 'gray' },
  rejected: { label: 'Rifiutato', chip: 'red' },
};

export function Acquisti() {
  const { can } = useAuth();
  const isAdmin = can('accounting', 'manage');
  const [rows, setRows] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

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
    if (!q) return rows;
    return rows.filter((r) => clientName(r).toLowerCase().includes(q) || (r.client?.email ?? '').toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }, [rows, filter]);

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
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{clientName(p)}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{p.client?.email ?? '—'}</div>
                  </td>
                  <td>{p.description}</td>
                  <td><b>{euro(p.amountCents)}</b></td>
                  <td className="muted">{methodLabel(p.method)}</td>
                  <td><span className={`chip ${STATUS[p.status]?.chip ?? 'gray'}`}>{STATUS[p.status]?.label ?? p.status}</span></td>
                  <td className="muted">{date(p.createdAt)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" disabled={busyId === p.id} onClick={() => downloadReceipt(p)} title="Scarica la ricevuta PDF">
                      <i className="ti ti-download" /> Ricevuta
                    </button>
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
      </div>

      {showCreate && (
        <CreatePurchaseModal
          onClose={() => setShowCreate(false)}
          onCreated={(msg) => { setShowCreate(false); setNotice(msg); void load(); }}
        />
      )}
    </>
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
