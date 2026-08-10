import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Pager, Spinner } from '../components/ui';
import { ContatoreRighe, useTabella, type Colonna } from '../components/tabella';

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
  planTargets?: Record<string, number> | null; // Opzione B: prezzo target per piano
}

const euro = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');
const valueLabel = (d: Discount) => (d.planTargets && Object.keys(d.planTargets).length ? Object.values(d.planTargets).map((c) => '→ ' + euro(c)).join(' · ') : d.type === 'percent' ? `${d.value}%` : euro(d.value));

// Tetto del server (`discounts.service.ts`: `take: 500`).
const TETTO = 500;

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

  const COLONNE: Colonna<Discount>[] = [
    { chiave: 'codice', titolo: 'Codice', valore: (d) => d.code, filtro: 'testo' },
    // Ordinabile ma senza filtro: il valore grezzo è una percentuale per i codici `percent` e
    // centesimi per i `fixed`, quindi si ordina bene fra codici dello stesso tipo e cercare
    // «20» qui vorrebbe dire due cose diverse a seconda della riga.
    /**
     * In questa colonna convivono TRE cose che non si confrontano fra loro: una percentuale, un
     * importo fisso in centesimi e uno o più prezzi target per piano. Ordinare su `d.value` metteva
     * «10%» accanto a «15,00 €» perché 10 < 1500, e i buoni con i prezzi target — che nella cella si
     * leggono e in `value` non ci sono — finivano tutti insieme in un punto qualsiasi.
     * Si ordina per TIPO e, dentro il tipo, per valore: prima le percentuali dalla più bassa, poi gli
     * importi fissi, poi i prezzi target. È l'unico ordine che si può spiegare a chi guarda.
     */
    {
      chiave: 'sconto',
      titolo: 'Sconto',
      valore: (d) => {
        const target = d.planTargets && Object.keys(d.planTargets).length;
        const tipo = target ? '3' : d.type === 'percent' ? '1' : '2';
        const numero = target ? Math.min(...Object.values(d.planTargets!)) : d.value;
        return `${tipo}${String(numero).padStart(9, '0')}`;
      },
    },
    { chiave: 'utilizzi', titolo: 'Utilizzi', valore: (d) => d.usedCount },
    { chiave: 'maxCliente', titolo: 'Max per cliente', valore: (d) => d.maxPerClient },
    { chiave: 'scadenza', titolo: 'Scadenza', valore: (d) => d.expiresAt },
    { chiave: 'stato', titolo: 'Stato', valore: (d) => (d.active ? 'Attivo' : 'Disattivo'), filtro: 'scelta', etichettaTutti: 'Tutti' },
    { chiave: 'azioni', titolo: 'Azioni', stile: { textAlign: 'right' } },
  ];

  // Il server ordina per data di creazione, che qui non è una colonna: l'elenco si legge per
  // codice, ed è quello che si cerca quando una cliente ne detta uno al telefono.
  const t = useTabella(rows, COLONNE, { ordineIniziale: { chiave: 'codice' } });

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>Codici sconto in percentuale o importo fisso, con tetto di utilizzi.</p>
        <button className="btn" onClick={() => setShowCreate(true)}>
          <i className="ti ti-plus" /> Nuovo buono
        </button>
      </div>

      <div className="spread" style={{ marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="buoni" />
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Cerca in tutte le colonne…"
          value={t.ricerca}
          onChange={(e) => t.setRicerca(e.target.value)}
        />
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {rows.length >= TETTO && (
        <Banner kind="info">
          Stai guardando i <b>{TETTO}</b> buoni più recenti: i filtri cercano solo fra questi, quindi un
          codice più vecchio non compare nemmeno filtrando.
        </Banner>
      )}

      <div className="card" style={{ padding: 0 }}>
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">{rows.length === 0 ? 'Nessun buono sconto. Creane uno con "Nuovo buono".' : 'Nessun buono con questi filtri.'}</div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((d) => (
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
        <Pager {...t.pager} />
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
