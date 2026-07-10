import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { Banner, Spinner } from '../components/ui';

interface Commission {
  id: string;
  date: string;
  amountCents: number;
  recipientId: string | null;
  recipient: string;
  clientId: string | null;
  client: string;
  product: string;
}

const euro = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');
const date = (s: string) => new Date(s).toLocaleDateString('it-IT');

export function Provvigioni() {
  const [rows, setRows] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [client, setClient] = useState('');
  const [product, setProduct] = useState('');
  const [recipient, setRecipient] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setRows(await api<Commission[]>('/admin/commissions'));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function deleteRow(r: Commission) {
    if (!confirm(`Eliminare questa provvigione di ${euro(r.amountCents)} a ${r.recipient}?\nVerrà scalata anche dai compensi dello staff.`)) return;
    setError(null);
    try {
      await api(`/admin/commissions/${r.id}`, { method: 'DELETE' });
      setRows((rs) => rs.filter((x) => x.id !== r.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  const recipients = useMemo(() => Array.from(new Set(rows.map((r) => r.recipient))).sort(), [rows]);

  const filtered = useMemo(() => {
    const minC = min ? parseFloat(min) * 100 : null;
    const maxC = max ? parseFloat(max) * 100 : null;
    return rows.filter((r) => {
      if (client.trim() && !r.client.toLowerCase().includes(client.trim().toLowerCase())) return false;
      if (product.trim() && !r.product.toLowerCase().includes(product.trim().toLowerCase())) return false;
      if (recipient && r.recipient !== recipient) return false;
      if (minC != null && r.amountCents < minC) return false;
      if (maxC != null && r.amountCents > maxC) return false;
      return true;
    });
  }, [rows, client, product, recipient, min, max]);

  const total = filtered.reduce((a, r) => a + r.amountCents, 0);

  if (loading) return <Spinner />;

  return (
    <>
      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Cliente"><input className="input" style={{ width: 180 }} value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nome o email" /></Field>
          <Field label="Prodotto"><input className="input" style={{ width: 180 }} value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Es. Percorso" /></Field>
          <Field label="Ricevente">
            <select className="select" style={{ width: 180 }} value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              <option value="">Tutti</option>
              {recipients.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Importo min (€)"><input className="input" type="number" step="0.01" style={{ width: 110 }} value={min} onChange={(e) => setMin(e.target.value)} /></Field>
          <Field label="Importo max (€)"><input className="input" type="number" step="0.01" style={{ width: 110 }} value={max} onChange={(e) => setMax(e.target.value)} /></Field>
          {(client || product || recipient || min || max) && (
            <button className="btn ghost sm" onClick={() => { setClient(''); setProduct(''); setRecipient(''); setMin(''); setMax(''); }}>Azzera filtri</button>
          )}
        </div>
      </div>

      <div className="spread" style={{ marginBottom: 10 }}>
        <span className="muted" style={{ fontSize: 13 }}>{filtered.length} provvigioni</span>
        <span><b>Totale: {euro(total)}</b></span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty">Nessuna provvigione con questi filtri.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Prodotto</th>
                <th>Ricevente</th>
                <th style={{ textAlign: 'right' }}>Importo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{date(r.date)}</td>
                  <td>{r.client}</td>
                  <td className="muted">{r.product}</td>
                  <td>{r.recipient}</td>
                  <td style={{ textAlign: 'right' }}><b>{euro(r.amountCents)}</b></td>
                  <td style={{ textAlign: 'right', width: 36 }}>
                    <button
                      onClick={() => deleteRow(r)}
                      title="Elimina provvigione"
                      style={{ border: 'none', background: 'transparent', color: '#e5484d', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}
                    >
                      <i className="ti ti-x" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
