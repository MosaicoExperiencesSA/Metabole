import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal } from './ui';

interface Withdrawal { id: string; amountCents: number; iban: string; status: string; requestedAt: string; paidAt: string | null; note: string | null; hasReceipt: boolean }
interface Wallet {
  isStaff: boolean;
  inMaturazioneCents: number;
  prelevabileCents: number;
  prelevatoCents: number;
  pendingRequestedCents: number;
  availableToRequestCents: number;
  iban: string | null;
  windowOpen: boolean;
  canRequest: boolean;
  pendingRequest: Withdrawal | null;
  recent: Withdrawal[];
}

const euro = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €';
const STATUS: Record<string, { label: string; kind: string }> = {
  requested: { label: 'In attesa', kind: 'amber' },
  paid: { label: 'Pagato', kind: '' },
  rejected: { label: 'Rifiutato', kind: 'red' },
};

export function WalletWidget() {
  const [w, setW] = useState<Wallet | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    try { setW(await api<Wallet>('/me/wallet')); } catch { /* silenzioso */ }
  }
  useEffect(() => { void load(); }, []);

  if (!w || !w.isStaff) return null;

  return (
    <div className="card">
      <div className="spread" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Il mio portafoglio</h2>
        <button className="btn" disabled={!w.canRequest} onClick={() => setOpen(true)} title={w.windowOpen ? '' : 'Le richieste sono possibili dal 1° al 7 del mese'}>
          <i className="ti ti-wallet" /> Richiedi pagamento
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        <WalletStat label="In maturazione" hint="Provvigioni del mese in corso" value={euro(w.inMaturazioneCents)} icon="ti-hourglass" color="var(--coral-dark)" />
        <WalletStat label="Saldo prelevabile" hint="Mesi precedenti, al netto del prelevato" value={euro(w.prelevabileCents)} icon="ti-cash" color="var(--teal-dark)" />
        <WalletStat label="Prelevato" hint="Totale bonificato finora" value={euro(w.prelevatoCents)} icon="ti-circle-check" color="var(--muted)" />
      </div>

      {w.pendingRequest && (
        <Banner kind="info">
          Richiesta in attesa: <b>{euro(w.pendingRequest.amountCents)}</b> su IBAN {w.pendingRequest.iban}. Verrà pagata dopo la verifica.
        </Banner>
      )}
      {!w.windowOpen && !w.pendingRequest && (
        <p className="hint" style={{ marginBottom: 0 }}>Le richieste di prelievo si possono inviare dal 1° al 7 di ogni mese.</p>
      )}

      {w.recent.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Storico richieste</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {w.recent.map((r) => {
              const st = STATUS[r.status] ?? { label: r.status, kind: 'gray' };
              return (
                <div key={r.id} className="spread" style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <span>{new Date(r.requestedAt).toLocaleDateString('it-IT')} · <b>{euro(r.amountCents)}</b></span>
                  <span className={`chip ${st.kind}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {open && <RequestModal wallet={w} onClose={() => setOpen(false)} onDone={() => { setOpen(false); void load(); }} />}
    </div>
  );
}

function WalletStat({ label, hint, value, icon, color }: { label: string; hint: string; value: string; icon: string; color: string }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <i className={`ti ${icon}`} style={{ color, fontSize: 20 }} />
        <b style={{ fontSize: 13 }}>{label}</b>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{hint}</div>
    </div>
  );
}

function RequestModal({ wallet, onClose, onDone }: { wallet: Wallet; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState((wallet.availableToRequestCents / 100).toFixed(2));
  const [iban, setIban] = useState(wallet.iban ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const maxEuro = wallet.availableToRequestCents / 100;

  async function submit() {
    setErr(null);
    const cents = Math.round(parseFloat(amount.replace(',', '.')) * 100);
    if (!cents || cents <= 0) { setErr('Importo non valido.'); return; }
    if (cents > wallet.availableToRequestCents) { setErr(`Massimo richiedibile: ${maxEuro.toFixed(2)} €.`); return; }
    if (iban.replace(/\s+/g, '').length < 15) { setErr('IBAN non valido.'); return; }
    setBusy(true);
    try {
      let receipt: { fileName: string; mimeType: string; contentBase64: string } | undefined;
      if (file) {
        const b64 = await fileToBase64(file);
        receipt = { fileName: file.name, mimeType: file.type, contentBase64: b64 };
      }
      await api('/me/wallet/withdrawals', { method: 'POST', body: JSON.stringify({ amountCents: cents, iban: iban.replace(/\s+/g, '').toUpperCase(), receipt }) });
      onDone();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Richiesta non riuscita.');
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Richiedi pagamento provvigioni" onClose={onClose}>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Disponibile: <b>{euro(wallet.availableToRequestCents)}</b>. Indica l'importo, l'IBAN e (facoltativo) allega la ricevuta o fattura.</p>
      {err && <Banner kind="err">{err}</Banner>}
      <label style={{ display: 'block', marginBottom: 10 }}>
        <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Importo (€)</span>
        <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label style={{ display: 'block', marginBottom: 10 }}>
        <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>IBAN (lo salviamo per le prossime volte)</span>
        <input className="input" style={{ textTransform: 'uppercase' }} value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IT60 X054 2811 1010 0000 0123 456" />
      </label>
      <label style={{ display: 'block', marginBottom: 14 }}>
        <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Ricevuta / fattura (PDF o immagine)</span>
        <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={submit} disabled={busy}>{busy ? 'Invio…' : 'Invia richiesta'}</button>
      </div>
    </Modal>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      resolve(res.includes(',') ? res.split(',')[1] : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
