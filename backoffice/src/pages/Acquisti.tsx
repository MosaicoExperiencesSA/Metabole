import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Pager, Spinner } from '../components/ui';
import { ContatoreRighe, useTabella, type Colonna } from '../components/tabella';

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
/** Pulsante d'azione a sola icona (l'etichetta sta nel tooltip). */
const ICON: CSSProperties = { padding: '4px 7px', lineHeight: 1 };
const STATUS: Record<string, { label: string; chip: string }> = {
  approved: { label: 'Pagato', chip: '' },
  receipt_uploaded: { label: 'Da approvare', chip: 'amber' },
  pending: { label: 'In attesa', chip: 'gray' },
  rejected: { label: 'Rifiutato', chip: 'red' },
  cancelled: { label: 'Annullato', chip: 'gray' },
  // Non è uno stato del database: è la voce che serve nella tendina dello stato (vedi COLONNE).
  refunded: { label: 'Stornato', chip: 'red' },
};

/** Quante righe manda al massimo `GET /admin/purchases`: oltre questo tetto i filtri non arrivano. */
const TETTO_SERVER = 200;

export function Acquisti() {
  const { can } = useAuth();
  const isAdmin = can('accounting', 'manage');
  const [rows, setRows] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Importo e intervallo di date stanno sopra la tabella e non fra i filtri di colonna: l'helper
  // filtra per testo o per scelta, e «297» sull'importo o «dal 1° al 15» non sono né l'uno né l'altro.
  const [fImporto, setFImporto] = useState('');
  const [fDal, setFDal] = useState('');
  const [fAl, setFAl] = useState('');
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

  const preFiltrate = useMemo(() => {
    const qImp = fImporto.trim().replace(',', '.');
    if (!qImp && !fDal && !fAl) return rows;
    return rows.filter((r) => {
      if (qImp && !(r.amountCents / 100).toFixed(2).includes(qImp)) return false;
      const giorno = r.createdAt.slice(0, 10);
      if (fDal && giorno < fDal) return false;
      if (fAl && giorno > fAl) return false;
      return true;
    });
  }, [rows, fImporto, fDal, fAl]);

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

  /**
   * RICALCOLA LE PROVVIGIONI di un acquisto già pagato.
   *
   * Le percentuali del piano sono SOGLIE CUMULATIVE e si paga a differenza: per dare 25% alla
   * coach, 10% alla coordinatrice e 10% al manager si scrive 25 / 35 / 45. Scritte come quote
   * separate (25 / 10 / 10) il secondo livello calcola 10 − 25 = −15, negativo, e la catena si
   * ferma: incassa solo la coach. Corretto il piano, gli acquisti già fatti non si sistemano da
   * soli — questo bottone li rilegge con le percentuali di oggi e accredita quel che manca.
   * Non toglie niente a nessuno e rilanciarlo non raddoppia.
   */
  async function ricalcolaProvvigioni(p: Purchase) {
    // eslint-disable-next-line no-alert
    if (!confirm(
      `Ricalcolare le provvigioni di ${clientName(p)} (${p.description}, ${euro(p.amountCents)})?\n\n`
      + 'Vengono AGGIUNTE solo le quote mancanti, con le percentuali del piano di oggi.\n'
      + 'Non viene tolto niente a nessuno e si può rilanciare senza raddoppiare.',
    )) return;
    setError(null);
    setNotice(null);
    setBusyId(p.id);
    try {
      const r = await api<{
        aggiunte: { staff: string; ruolo: string; importoCents: number }[];
        eccessi: { staff: string; ruolo: string; dovutoCents: number; presoCents: number }[];
        totaleAggiuntoCents: number;
        messaggio: string;
      }>(`/admin/purchases/${p.id}/ricalcola-provvigioni`, { method: 'POST', body: JSON.stringify({}) });
      const dettaglio = r.aggiunte.map((a) => `${a.staff} (${a.ruolo}) +${euro(a.importoCents)}`).join(' · ');
      const troppo = r.eccessi.map((e) => `${e.staff} ha ${euro(e.presoCents)} invece di ${euro(e.dovutoCents)}`).join(' · ');
      setNotice(`${r.messaggio}${dettaglio ? ` — ${dettaglio}` : ''}${troppo ? ` · Da guardare a mano: ${troppo}` : ''}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può ricalcolare le provvigioni.');
      else setError(err instanceof Error ? err.message : 'Ricalcolo non riuscito.');
    } finally {
      setBusyId(null);
    }
  }

  const COLONNE: Colonna<Purchase>[] = [
    // Nome ed email nello stesso valore: il filtro cliente cercava in entrambi e la cella li mostra
    // entrambi. L'ordinamento resta di fatto sul nome, che è la parte davanti.
    { chiave: 'cliente', titolo: 'Cliente', valore: (p) => `${clientName(p)} ${p.client?.email ?? ''}`.trim(), filtro: 'testo' },
    { chiave: 'prodotto', titolo: 'Prodotto', valore: (p) => p.description, filtro: 'testo' },
    // I centesimi, non «€ 297,00»: come testo «€ 100,00» finirebbe prima di «€ 20,00».
    { chiave: 'importo', titolo: 'Importo', valore: (p) => p.amountCents },
    { chiave: 'metodo', titolo: 'Metodo', valore: (p) => p.method, filtro: 'scelta', etichetta: methodLabel, etichettaTutti: 'Tutti' },
    // Uno stornato ha `status = approved` e la data di rimborso: «Stornato» deve restare una voce a
    // sé nella tendina, come nel filtro scritto a mano che c'era prima.
    {
      chiave: 'stato',
      titolo: 'Stato',
      valore: (p) => STATUS[p.refundedAt ? 'refunded' : p.status]?.label ?? p.status,
      filtro: 'scelta',
      etichettaTutti: 'Tutti',
      // L'ordine di un pagamento nella sua vita, non l'alfabeto: la tendina si legge come il flusso.
      ordineScelte: ['In attesa', 'Da approvare', 'Pagato', 'Stornato', 'Rifiutato', 'Annullato'],
    },
    // La data ISO grezza: si ordina bene alfabeticamente, la formattata in italiano no.
    { chiave: 'data', titolo: 'Data', valore: (p) => p.createdAt },
    { chiave: 'azioni', titolo: 'Azioni', stile: { textAlign: 'right' } },
  ];

  const t = useTabella(preFiltrate, COLONNE, { perPagina: 50, ordineIniziale: { chiave: 'data', direzione: 'desc' } });
  const filtriSopra = fImporto !== '' || fDal !== '' || fAl !== '';
  function azzeraTutto() {
    t.azzera();
    setFImporto('');
    setFDal('');
    setFAl('');
  }

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        {/* «di quanti»: il totale è quello caricato dal server, non quello già scremato qui sopra. */}
        <ContatoreRighe
          conteggio={{ mostrate: t.conteggio.mostrate, totali: rows.length }}
          filtriAttivi={t.filtriAttivi || filtriSopra}
          azzera={azzeraTutto}
          nome="acquisti"
        />
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" style={{ maxWidth: 240 }} placeholder="Cerca in tutte le colonne…" value={t.ricerca} onChange={(e) => t.setRicerca(e.target.value)} />
          <input className="input sm" style={{ width: 120 }} placeholder="Importo es. 297" title="Importo (anche parziale)" value={fImporto} onChange={(e) => setFImporto(e.target.value)} />
          <input className="input sm" type="date" style={{ width: 150 }} title="Dal giorno" value={fDal} onChange={(e) => setFDal(e.target.value)} />
          <input className="input sm" type="date" style={{ width: 150 }} title="Al giorno" value={fAl} onChange={(e) => setFAl(e.target.value)} />
          {isAdmin && (
            <button className="btn" onClick={() => setShowCreate(true)}>
              <i className="ti ti-plus" /> Nuovo acquisto
            </button>
          )}
        </div>
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {/* Il tetto si dichiara: filtrare e non trovare niente non vuol dire che l'acquisto non c'è. */}
      {rows.length >= TETTO_SERVER && (
        <Banner kind="info">
          Sono caricati gli <b>ultimi {TETTO_SERVER} acquisti</b>: ordinamento e filtri lavorano solo su questi.
        </Banner>
      )}

      <div className="card" style={{ padding: 0 }}>
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">{rows.length === 0 ? 'Nessun acquisto.' : 'Nessun acquisto con questi filtri.'}</div>
        ) : (
          // Larghezze fisse: senza, il nome del prodotto si prendeva tre righe e la colonna
          // delle azioni finiva fuori dallo schermo, tagliata.
          <table className="grid" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((p) => (
                <tr key={p.id}>
                  <td style={{ overflow: 'hidden' }}>
                    <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={clientName(p)}>{clientName(p)}</b>
                    <div className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.client?.email ?? ''}>{p.client?.email ?? '—'}</div>
                  </td>
                  {/* Il nome del prodotto su una riga sola con i puntini: prima ne prendeva tre
                      e spingeva la tabella fuori dallo schermo. Per intero resta nel tooltip. */}
                  <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.description}>{p.description}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><b>{euro(p.amountCents)}</b></td>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{methodLabel(p.method)}</td>
                  <td>
                    <span className={`chip ${STATUS[p.status]?.chip ?? 'gray'}`}>{STATUS[p.status]?.label ?? p.status}</span>
                    {p.refundedAt && (
                      <div><span className="chip red" title={`Stornato il ${date(p.refundedAt)}`}>Stornato −{euro(p.refundCents).replace('€ ', '€')}</span></div>
                    )}
                  </td>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{date(p.createdAt)}</td>
                  {/* Azioni a icone: cinque pulsanti con l'etichetta scritta non ci stavano.
                      Il titolo (tooltip) dice cosa fa ciascuna. */}
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" disabled={busyId === p.id} onClick={() => downloadReceipt(p)} title="Scarica la ricevuta PDF" style={ICON}>
                      <i className="ti ti-download" />
                    </button>
                    {p.refundedAt && (
                      <button className="btn ghost sm" disabled={busyId === p.id} onClick={() => downloadRefundReceipt(p)} title="Scarica la ricevuta di rimborso" style={{ ...ICON, marginLeft: 4 }}>
                        <i className="ti ti-receipt-refund" />
                      </button>
                    )}
                    {isAdmin && p.status === 'approved' && (
                      <button className="btn ghost sm" disabled={busyId === p.id} onClick={() => ricalcolaProvvigioni(p)}
                        title="Ricalcola provvigioni — aggiunge le quote mancanti dopo aver corretto le percentuali del piano (non toglie niente)"
                        style={{ ...ICON, marginLeft: 4 }}>
                        <i className="ti ti-refresh-dot" />
                      </button>
                    )}
                    {isAdmin && p.status === 'approved' && !p.refundedAt && (
                      <button className="btn ghost sm" disabled={busyId === p.id} onClick={() => setRefundTarget(p)} title="Storna l'acquisto (rimborso)" style={{ ...ICON, marginLeft: 4 }}>
                        <i className="ti ti-arrow-back-up" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => deletePurchase(p)}
                        disabled={busyId === p.id}
                        title="Elimina acquisto"
                        style={{ border: 'none', background: 'transparent', color: '#e5484d', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4, marginLeft: 4, verticalAlign: 'middle' }}
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
        <Pager {...t.pager} />
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
          // Catalogo completo per l'operatrice: '/plans' e' la vetrina pubblica e non
          // contiene piu' il Mantenimento, che qui deve restare vendibile a mano.
          api<Plan[]>('/admin/purchases/plans'),
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
