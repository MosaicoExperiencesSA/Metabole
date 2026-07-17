import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';

/**
 * "Bonifico da completare" — mostrato in dashboard quando la cliente ha uno o più
 * pagamenti via BONIFICO ancora da saldare (pending) o con contabile già caricata in
 * attesa di verifica (receipt_uploaded). Mostra i dati per pagare (IBAN + causale +
 * importo) e permette di caricare/sostituire la contabile SENZA passare dal profilo.
 * I dati bancari e la causale arrivano da GET /me/payments (li allega il backend solo
 * per i bonifici in sospeso).
 */
interface Payment {
  id: string;
  description: string;
  amountCents: number;
  method: string;
  status: string;
  bankDetails?: string | null;
  transferReference?: string | null;
}

const euro = (c: number) => `€ ${(c / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PendingBankTransfers() {
  const [items, setItems] = useState<Payment[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    const p = await api<Payment[]>('/me/payments').catch(() => [] as Payment[]);
    setItems((Array.isArray(p) ? p : []).filter((x) => x.method === 'bank_transfer' && (x.status === 'pending' || x.status === 'receipt_uploaded')));
  }
  useEffect(() => { void load(); }, []);

  async function upload(id: string, file: File) {
    setBusyId(id); setErr(null); setOk(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('File troppo grande (max 5 MB).');
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
        r.onerror = () => reject(new Error('File non leggibile.'));
        r.readAsDataURL(file);
      });
      await api(`/me/payments/${id}/receipt`, { method: 'POST', body: JSON.stringify({ fileName: file.name, mimeType: file.type, contentBase64 }) });
      setOk('Contabile caricata: verrà verificata dallo staff.');
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Caricamento non riuscito.');
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(id: string) {
    // eslint-disable-next-line no-alert
    if (!confirm('Vuoi annullare questo ordine? Resterà nello storico come annullato.')) return;
    setBusyId(id); setErr(null); setOk(null);
    try {
      await api(`/me/payments/${id}/cancel`, { method: 'POST' });
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      {items.map((p) => {
        const uploaded = p.status === 'receipt_uploaded';
        return (
          <div key={p.id} className="card" style={{ background: '#FBF4E6', border: '1px solid #EAD9AE', marginBottom: 10 }}>
            <div className="row" style={{ alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <span className="event-ic" style={{ background: '#E0A419', color: '#fff', flex: 'none' }}><i className="ti ti-file-invoice" /></span>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 14, color: '#5C4611' }}>Bonifico da completare</b>
                <div className="muted" style={{ fontSize: 12 }}>{p.description} · <b>{euro(p.amountCents)}</b></div>
              </div>
              <span className="chip" style={{ background: uploaded ? '#E4EEF9' : '#F5E6C4', color: uploaded ? '#2B5A93' : '#8A6D1B', fontSize: 11 }}>
                {uploaded ? 'Contabile inviata' : 'In attesa'}
              </span>
            </div>

            <div className="card" style={{ margin: 0, background: '#fff', padding: 10 }}>
              <div className="muted" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.3px', marginBottom: 4 }}>DATI PER IL BONIFICO</div>
              {p.bankDetails && <div style={{ fontSize: 13, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{p.bankDetails}</div>}
              <div style={{ fontSize: 13, marginTop: 6 }}><span className="muted">Importo:</span> <b>{euro(p.amountCents)}</b></div>
              {p.transferReference && (
                <div style={{ fontSize: 13, marginTop: 2 }}><span className="muted">Causale:</span> <b>{p.transferReference}</b></div>
              )}
            </div>

            <div className="muted" style={{ fontSize: 11, margin: '8px 0 6px' }}>
              Fatto il bonifico? Carica qui la contabile: l'acquisto si attiva dopo la verifica.
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <label className="btn-recipe" style={{ padding: '5px 12px', fontSize: 12, cursor: busyId === p.id ? 'default' : 'pointer' }}>
                <i className="ti ti-upload" style={{ fontSize: 13 }} /> {busyId === p.id ? 'Attendi…' : uploaded ? 'Sostituisci contabile' : 'Carica contabile'}
                <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }} disabled={busyId === p.id}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(p.id, f); }} />
              </label>
              <button className="btn-recipe" style={{ padding: '5px 12px', fontSize: 12 }} disabled={busyId === p.id} onClick={() => cancel(p.id)}>
                <i className="ti ti-x" style={{ fontSize: 13 }} /> Annulla ordine
              </button>
            </div>
            {err && <div style={{ color: '#993C1D', fontSize: 12, marginTop: 6 }}>{err}</div>}
            {ok && <div style={{ color: '#0E7C66', fontSize: 12, marginTop: 6 }}>{ok}</div>}
          </div>
        );
      })}
    </div>
  );
}
