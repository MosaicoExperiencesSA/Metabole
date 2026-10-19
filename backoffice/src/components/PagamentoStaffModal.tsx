import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { centesimiDaTesto } from '../lib/importo';
import { Banner, Modal } from './ui';

/**
 * «REGISTRA PAGAMENTO» — un bonifico già fatto a una persona dello staff (19/10/2026).
 *
 * Prima l'unico modo di segnare un pagamento era la richiesta di prelievo della persona (giorni
 * 1–7, solo i mesi chiusi) confermata dall'admin. Questa finestra registra il pagamento dalla parte
 * di chi paga, con la contabile allegata.
 *
 * ⚠️ I numeri «maturato / già pagato / resta» arrivano dal server (`/admin/withdrawals/payees`) e
 * sono gli stessi che il server usa per decidere se accettare l'importo: qui non si ricalcola
 * niente, così il tetto mostrato e quello applicato non possono divergere.
 */
export interface Payee {
  staffId: string;
  displayName: string;
  email: string | null;
  role: string | null;
  iban: string | null;
  maturatoCents: number;
  pagatoCents: number;
  residuoCents: number;
  richiestaInAttesaCents: number;
}

const euro = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €';
const romano = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
const oggi = () => romano.format(new Date());
const MAX_BYTES = 5 * 1024 * 1024;

export function fileInBase64(file: File): Promise<string> {
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

/** Il file come lo vuole il server, o il motivo per cui non va bene (stessi limiti del server). */
export async function allegatoDaFile(file: File): Promise<{ fileName: string; mimeType: string; contentBase64: string }> {
  const ammessi = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'];
  if (!ammessi.includes(file.type)) throw new Error('La contabile deve essere un PDF o un\'immagine (JPG, PNG, HEIC).');
  if (file.size === 0 || file.size > MAX_BYTES) throw new Error('La contabile deve pesare al massimo 5 MB.');
  return { fileName: file.name, mimeType: file.type, contentBase64: await fileInBase64(file) };
}

export function PagamentoStaffModal({ staffIdIniziale, onClose, onSaved }: {
  staffIdIniziale?: string | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [payees, setPayees] = useState<Payee[] | null>(null);
  const [metodi, setMetodi] = useState<string[]>([]);
  const [staffId, setStaffId] = useState(staffIdIniziale ?? '');
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(oggi());
  const [paidWith, setPaidWith] = useState('');
  const [iban, setIban] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Payee[]>('/admin/withdrawals/payees').then(setPayees).catch((e) => { setPayees([]); setError(e instanceof Error ? e.message : 'Elenco non caricato.'); });
    // Un errore sulle voci non blocca la registrazione: la tendina resta su «non indicato».
    api<string[]>('/admin/withdrawals/payment-methods').then(setMetodi).catch(() => setMetodi([]));
  }, []);

  const scelta = useMemo(() => payees?.find((p) => p.staffId === staffId) ?? null, [payees, staffId]);

  // Scelta la persona, l'importo parte da quanto le resta e l'IBAN da quello che ha salvato.
  useEffect(() => {
    if (!scelta) return;
    setAmount(scelta.residuoCents > 0 ? (scelta.residuoCents / 100).toFixed(2).replace('.', ',') : '');
    setIban(scelta.iban ?? '');
  }, [scelta]);

  async function submit() {
    setError(null);
    if (!scelta) { setError('Scegli a chi hai pagato.'); return; }
    const amountCents = centesimiDaTesto(amount);
    if (amountCents === null || amountCents <= 0) { setError('Importo non valido.'); return; }
    if (amountCents > scelta.residuoCents) { setError(`Resta da pagare al massimo ${euro(scelta.residuoCents)}.`); return; }
    if (!paidOn) { setError('Indica la data del pagamento.'); return; }
    setBusy(true);
    try {
      const proof = file ? await allegatoDaFile(file) : undefined;
      await api('/admin/withdrawals/manual', {
        method: 'POST',
        body: JSON.stringify({
          staffId: scelta.staffId,
          amountCents,
          paidOn,
          paidWith: paidWith || undefined,
          iban: iban.replace(/\s+/g, '').toUpperCase() || undefined,
          note: note.trim() || undefined,
          proof,
        }),
      });
      onSaved(`Pagamento di ${euro(amountCents)} a ${scelta.displayName} registrato${proof ? ' con la contabile' : ''}. Le abbiamo mandato la mail di conferma.`);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Registrazione non riuscita.');
      setBusy(false);
    }
  }

  return (
    <Modal title="Registra pagamento" onClose={onClose}>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Per un bonifico già fatto. Finisce fra i pagati, nel portafoglio della persona e nelle provvigioni pagate di Contabilità.</p>
      {error && <Banner kind="err">{error}</Banner>}
      <div className="field">
        <label>A chi</label>
        <select className="select" value={staffId} onChange={(e) => setStaffId(e.target.value)} disabled={!payees}>
          <option value="">{payees ? '— scegli —' : 'Carico…'}</option>
          {(payees ?? []).map((p) => (
            <option key={p.staffId} value={p.staffId}>{p.displayName} — resta {euro(p.residuoCents)}</option>
          ))}
        </select>
        {scelta && (
          <p className="muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
            Maturato <b>{euro(scelta.maturatoCents)}</b> · già pagato <b>{euro(scelta.pagatoCents)}</b> · resta <b>{euro(scelta.residuoCents)}</b>
          </p>
        )}
      </div>
      {scelta && scelta.richiestaInAttesaCents > 0 && (
        <Banner kind="warn">
          Ha una richiesta di prelievo in attesa ({euro(scelta.richiestaInAttesaCents)}). Se è lo stesso pagamento, usa <b>Conferma</b> sulla richiesta invece di registrarlo qui, o la troverai ancora aperta.
        </Banner>
      )}
      <div className="card-row">
        <div className="field" style={{ flex: 1 }}>
          <label>Importo (€)</label>
          <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Pagato il</label>
          <input className="input" type="date" value={paidOn} max={oggi()} onChange={(e) => setPaidOn(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Con cosa hai pagato</label>
        <select className="select" value={paidWith} onChange={(e) => setPaidWith(e.target.value)}>
          <option value="">— non indicato —</option>
          {metodi.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        {metodi.length === 0 && (
          <p className="muted" style={{ fontSize: 11.5, margin: '6px 0 0' }}>Nessuna voce configurata: si scrivono in <b>Parametri → «Con cosa si paga»</b>, una per riga.</p>
        )}
      </div>
      <div className="field">
        <label>IBAN (facoltativo)</label>
        <input className="input" style={{ textTransform: 'uppercase' }} value={iban} onChange={(e) => setIban(e.target.value)} placeholder="Vuoto se hai pagato in altro modo" />
      </div>
      <div className="field">
        <label>Contabile del bonifico (PDF o immagine, facoltativa)</label>
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/heic" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <div className="field">
        <label>Nota (facoltativa)</label>
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. provvigioni di ottobre" style={{ resize: 'vertical' }} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={submit} disabled={busy || !scelta}>{busy ? 'Registro…' : 'Registra pagamento'}</button>
      </div>
    </Modal>
  );
}
