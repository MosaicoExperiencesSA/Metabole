import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Pager, Spinner } from '../components/ui';
import { ContatoreRighe, useTabella, type Colonna } from '../components/tabella';

interface Withdrawal {
  id: string; staffName: string; staffEmail: string | null;
  amountCents: number; iban: string; status: string;
  requestedAt: string; paidAt: string | null; note: string | null;
  hasReceipt: boolean; withdrawableCents: number; congruent: boolean;
}

const euro = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €';
const giorno = (s: string | null) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');
const TABS: { key: string; label: string }[] = [
  { key: 'requested', label: 'In attesa' },
  { key: 'paid', label: 'Pagate' },
  { key: 'rejected', label: 'Rifiutate' },
  { key: '', label: 'Tutte' },
];
const STATO_LABEL: Record<string, string> = { requested: 'In attesa', paid: 'Pagato', rejected: 'Rifiutato' };
const STATO_CHIP: Record<string, string> = { requested: 'amber', paid: '', rejected: 'red' };

/** Quante righe manda al massimo `GET /admin/withdrawals`: oltre questo tetto i filtri non arrivano. */
const TETTO_SERVER = 300;

export function Prelievi() {
  const [tab, setTab] = useState('requested');
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      setRows(await api<Withdrawal[]>(`/admin/withdrawals${tab ? `?status=${tab}` : ''}`));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può gestire i prelievi.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [tab]);

  async function confirmPay(w: Withdrawal) {
    if (!confirm(`Confermi di aver pagato ${euro(w.amountCents)} a ${w.staffName} (IBAN ${w.iban})?\n\nVerrà registrato nel prelevato e inviata l'email di conferma.`)) return;
    setBusyId(w.id); setError(null); setNotice(null);
    try {
      await api(`/admin/withdrawals/${w.id}/confirm`, { method: 'POST' });
      setNotice('Pagamento confermato ed email inviata.');
      await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Operazione non riuscita.'); }
    finally { setBusyId(null); }
  }

  async function reject(w: Withdrawal) {
    const reason = prompt('Motivo del rifiuto:');
    if (!reason) return;
    setBusyId(w.id); setError(null); setNotice(null);
    try {
      await api(`/admin/withdrawals/${w.id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
      setNotice('Richiesta rifiutata.');
      await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Operazione non riuscita.'); }
    finally { setBusyId(null); }
  }

  async function downloadReceipt(w: Withdrawal) {
    try {
      const r = await api<{ fileName: string; mimeType: string; contentBase64: string }>(`/admin/withdrawals/${w.id}/receipt`);
      const bytes = Uint8Array.from(atob(r.contentBase64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: r.mimeType }));
      const a = document.createElement('a'); a.href = url; a.download = r.fileName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Download non riuscito.'); }
  }

  const COLONNE: Colonna<Withdrawal>[] = [
    // Nome ed email nello stesso valore: la cella li mostra entrambi e chi cerca una richiesta parte
    // da uno dei due. L'ordinamento resta di fatto sul nome, che è la parte davanti.
    { chiave: 'staff', titolo: 'Staff', valore: (w) => `${w.staffName} ${w.staffEmail ?? ''}`.trim(), filtro: 'testo' },
    { chiave: 'iban', titolo: 'IBAN', valore: (w) => w.iban, filtro: 'testo' },
    // I centesimi, non «100,00 €»: come testo «100,00 €» finirebbe prima di «20,00 €».
    { chiave: 'importo', titolo: 'Importo', valore: (w) => w.amountCents, stile: { textAlign: 'right' } },
    // Il filtro serve nel tab «Tutte»: negli altri i tab hanno già scelto lo stato.
    // Il filtro serve nel tab «Tutte»; ordine del ciclo di vita, non alfabetico.
    { chiave: 'stato', titolo: 'Stato', valore: (w) => STATO_LABEL[w.status] ?? w.status, filtro: 'scelta', etichettaTutti: 'Tutti', ordineScelte: ['In attesa', 'Pagato', 'Rifiutato'] },
    // Le date ISO grezze: si ordinano bene alfabeticamente, quelle formattate in italiano no.
    { chiave: 'richiesto', titolo: 'Richiesto il', valore: (w) => w.requestedAt },
    { chiave: 'pagato', titolo: 'Pagato il', valore: (w) => w.paidAt },
    { chiave: 'nota', titolo: 'Nota', valore: (w) => w.note, filtro: 'testo' },
    { chiave: 'azioni', titolo: '', stile: { textAlign: 'right' } },
  ];

  // Una coda si smaltisce dalla richiesta più vecchia: è l'ordine del server dentro ogni tab.
  const t = useTabella(rows, COLONNE, { ordineIniziale: { chiave: 'richiesto', direzione: 'asc' } });

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>Verifica gli importi (non oltre il saldo prelevabile), scarica la ricevuta e conferma dopo aver fatto il bonifico.</p>
      <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map((x) => (
          <button key={x.key} className={`chip ${x.key === tab ? '' : 'ghost'}`} style={{ cursor: 'pointer', border: x.key === tab ? '2px solid var(--teal)' : undefined }} onClick={() => setTab(x.key)}>{x.label}</button>
        ))}
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {/* Il tetto si dichiara: filtrare e non trovare niente non vuol dire che la richiesta non c'è. */}
      {rows.length >= TETTO_SERVER && (
        <Banner kind="info">
          Sono caricate <b>{TETTO_SERVER} richieste</b> al massimo: ordinamento e filtri lavorano solo su queste.
        </Banner>
      )}

      <div className="spread" style={{ marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="richieste" />
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Cerca in tutte le colonne…"
          value={t.ricerca}
          onChange={(e) => t.setRicerca(e.target.value)}
        />
      </div>

      {loading ? <Spinner /> : (
        <div className="card" style={{ padding: 0 }}>
          {t.conteggio.mostrate === 0 ? (
            <div className="empty">{rows.length === 0 ? 'Nessuna richiesta.' : 'Nessuna richiesta con questi filtri.'}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="grid">
                <thead>
                  {t.intestazione()}
                  {t.rigaFiltri()}
                </thead>
                <tbody>
                  {t.pagina.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <b>{w.staffName}</b>
                        {w.staffEmail && <div className="muted" style={{ fontSize: 12 }}>{w.staffEmail}</div>}
                      </td>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{w.iban}</td>
                      {/* La congruità sta sotto l'importo perché parla dell'importo: è la domanda
                          «questi soldi ci sono?», non uno stato della richiesta. */}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <b>{euro(w.amountCents)}</b>
                        {w.status === 'requested' && (
                          <div className={`chip ${w.congruent ? '' : 'red'}`} style={{ marginTop: 4, fontSize: 11 }}>
                            {w.congruent ? `OK · prelevabile ${euro(w.withdrawableCents)}` : `⚠ supera il prelevabile (${euro(w.withdrawableCents)})`}
                          </div>
                        )}
                      </td>
                      <td><span className={`chip ${STATO_CHIP[w.status] ?? 'gray'}`}>{STATO_LABEL[w.status] ?? w.status}</span></td>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{giorno(w.requestedAt)}</td>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{giorno(w.paidAt)}</td>
                      <td className="muted" style={{ fontSize: 12, maxWidth: 220 }}>{w.note || '—'}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {w.hasReceipt && <button className="btn ghost sm" onClick={() => downloadReceipt(w)} title="Scarica la ricevuta"><i className="ti ti-download" /></button>}
                        {/* Confermare un pagamento sposta dei soldi: questi due pulsanti restano
                            scritti, non a sola icona come il download della ricevuta. */}
                        {w.status === 'requested' && (
                          <>
                            <button className="btn sm" style={{ marginLeft: 6 }} disabled={busyId === w.id} onClick={() => confirmPay(w)} title="Conferma il pagamento (bonifico già fatto)"><i className="ti ti-check" /> Conferma</button>
                            <button className="btn ghost sm" style={{ marginLeft: 6, color: 'var(--danger)' }} disabled={busyId === w.id} onClick={() => reject(w)} title="Rifiuta la richiesta"><i className="ti ti-x" /> Rifiuta</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager {...t.pager} />
        </div>
      )}
    </>
  );
}
