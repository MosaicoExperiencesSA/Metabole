import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Pager, Spinner, usePagination } from '../components/ui';

interface Discount {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  maxTotalUses: number | null;
  maxPerClient: number;
  usedCount: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  clientId?: string | null; // valorizzato = codice PERSONALE di una cliente (giorno 6 prova)
}

const euro = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');
const valueLabel = (d: Discount) => (d.type === 'percent' ? `${d.value}%` : euro(d.value));

export function BuoniSconto() {
  const [rows, setRows] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await api<Discount[]>('/admin/discounts'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata agli amministratori.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function toggle(d: Discount) {
    try {
      await api(`/admin/discounts/${d.id}`, { method: 'PATCH', body: JSON.stringify({ active: !d.active }) });
      setRows((rs) => rs.map((x) => (x.id === d.id ? { ...x, active: !x.active } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modifica non riuscita.');
    }
  }

  async function remove(d: Discount) {
    if (!confirm(`Eliminare il buono ${d.code}?`)) return;
    setError(null);
    try {
      await api(`/admin/discounts/${d.id}`, { method: 'DELETE' });
      setRows((rs) => rs.filter((x) => x.id !== d.id));
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  const pg = usePagination(rows, 100);

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>Codici sconto in percentuale o importo fisso, con tetto di utilizzi.</p>
        <button className="btn" onClick={() => setShowCreate(true)}>
          <i className="ti ti-plus" /> Nuovo buono
        </button>
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty">Nessun buono sconto. Creane uno con "Nuovo buono".</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Codice</th>
                <th>Sconto</th>
                <th>Utilizzi</th>
                <th>Max per cliente</th>
                <th>Scadenza</th>
                <th>Stato</th>
                <th style={{ textAlign: 'right' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {pg.pageItems.map((d) => (
                <tr key={d.id}>
                  <td><b>{d.code}</b>{d.clientId && <span className="chip amber" style={{ marginLeft: 6, fontSize: 10 }} title="Codice personale di una cliente (inviato al giorno 6 della prova)">personale</span>}</td>
                  <td>{valueLabel(d)}</td>
                  <td className="muted">{d.usedCount}{d.maxTotalUses != null ? ` / ${d.maxTotalUses}` : ' / ∞'}</td>
                  <td className="muted">{d.maxPerClient}</td>
                  <td className="muted">{date(d.expiresAt)}</td>
                  <td>
                    <span className={`chip ${d.active ? '' : 'gray'}`}>{d.active ? 'Attivo' : 'Disattivo'}</span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" onClick={() => toggle(d)}>{d.active ? 'Disattiva' : 'Attiva'}</button>
                    <button className="btn danger sm" style={{ marginLeft: 6 }} onClick={() => remove(d)}>Elimina</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager page={pg.page} totalPages={pg.totalPages} total={pg.total} from={pg.from} to={pg.to} onPage={pg.setPage} />
      </div>

      {showCreate && (
        <CreateDiscountModal
          onClose={() => setShowCreate(false)}
          onCreated={(code) => { setShowCreate(false); setNotice(`Buono ${code} creato.`); void load(); }}
        />
      )}
    </>
  );
}

function CreateDiscountModal({ onClose, onCreated }: { onClose: () => void; onCreated: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [percent, setPercent] = useState('10');
  const [amount, setAmount] = useState('10'); // euro, per fixed
  const [maxTotalUses, setMaxTotalUses] = useState('');
  const [maxPerClient, setMaxPerClient] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const value = type === 'percent' ? parseInt(percent, 10) : Math.round((parseFloat(amount) || 0) * 100);
    if (!code.trim()) { setError('Inserisci un codice.'); return; }
    if (type === 'percent' && (value < 1 || value > 100)) { setError('La percentuale deve essere tra 1 e 100.'); return; }
    if (type === 'fixed' && value < 1) { setError("Inserisci un importo dello sconto valido."); return; }
    setBusy(true);
    try {
      await api('/admin/discounts', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          type,
          value,
          maxTotalUses: maxTotalUses ? parseInt(maxTotalUses, 10) : undefined,
          maxPerClient: maxPerClient ? parseInt(maxPerClient, 10) : 1,
          expiresAt: expiresAt || undefined,
        }),
      });
      onCreated(code.trim().toUpperCase());
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Creazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nuovo buono sconto" onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      <div className="field">
        <label>Codice</label>
        <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Es. ESTATE25" style={{ textTransform: 'uppercase' }} />
      </div>
      <div className="field">
        <label>Tipo di sconto</label>
        <select className="select" value={type} onChange={(e) => setType(e.target.value as 'percent' | 'fixed')}>
          <option value="percent">Percentuale (%)</option>
          <option value="fixed">Importo fisso (€)</option>
        </select>
      </div>
      {type === 'percent' ? (
        <div className="field">
          <label>Percentuale di sconto</label>
          <input className="input" type="number" min="1" max="100" value={percent} onChange={(e) => setPercent(e.target.value)} style={{ width: 140 }} />
        </div>
      ) : (
        <div className="field">
          <label>Importo dello sconto (€)</label>
          <input className="input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 140 }} />
        </div>
      )}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label>Utilizzi totali (vuoto = illimitati)</label>
          <input className="input" type="number" min="1" value={maxTotalUses} onChange={(e) => setMaxTotalUses(e.target.value)} placeholder="∞" />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 160 }}>
          <label>Max utilizzi per cliente</label>
          <input className="input" type="number" min="1" value={maxPerClient} onChange={(e) => setMaxPerClient(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Scadenza (facoltativa)</label>
        <input className="input" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={{ width: 200 }} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={submit} disabled={busy || !code.trim()}>{busy ? 'Creo…' : 'Crea buono'}</button>
      </div>
    </Modal>
  );
}
