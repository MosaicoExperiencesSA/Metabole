import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Pager, Spinner } from '../components/ui';
import { BottoneExcel, ContatoreRighe, useTabella, type Colonna } from '../components/tabella';

interface Swap {
  id: string;
  clientId: string;
  client: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
  recipeId: string | null;
  dishName: string | null;
  mealSlot: string | null;
  tipo: string;
  fromFood: string;
  toFood: string;
  fromQty: number | null;
  toQty: number | null;
  unit: string | null;
  motivo: string | null;
  origine: string;
  stato: string;
  nota: string | null;
  volte: number;
  primaVoltaIl: string;
  ultimaVoltaIl: string;
  validataDa: { displayName: string } | null;
  creataDa: { displayName: string } | null;
  promossaGruppo: { id: string; name: string; status: string } | null;
  promossaIl: string | null;
}

interface ClienteMinimo {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  clientProfile?: { name?: string | null } | null;
}

const STATO: Record<string, string> = {
  da_verificare: 'Da verificare',
  verificata: 'Confermata',
  corretta: 'Corretta',
  annullata: 'Annullata',
};
// ⚠️ Le chiavi sono quelle di `SLOT_LABEL` nel backend: `morning_snack`, non `snack_morning`.
// Sbagliarle non dà nessun errore — dà la chiave grezza a schermo, che è il modo in cui una
// svista del genere sopravvive per mesi.
const SLOT: Record<string, string> = {
  breakfast: 'Colazione',
  morning_snack: 'Spuntino del mattino',
  lunch: 'Pranzo',
  afternoon_snack: 'Spuntino del pomeriggio',
  dinner: 'Cena',
  snack: 'Spuntino',
};
// Da dove nasce la riga. «App» è il pulsante «sostituisci» dentro il menu: è la stessa richiesta
// della chat, fatta con due dita invece che con una frase.
const ORIGINE: Record<string, string> = {
  chat: 'Chat',
  app: 'App',
  manuale: 'A mano',
  // §16.9 (12/8): letta da una frase che il nutrizionista ha scritto alla cliente in chat. Va
  // distinta dalle altre perché la domanda che pone è diversa: non «va bene concederlo?», ma
  // «ho capito bene quello che hai scritto?». La frase esatta è nella nota della riga.
  nutrizionista: 'Detta in chat',
};
const MOTIVO: Record<string, string> = {
  gusto: 'Non le piace',
  scorta: 'Non ce l\'ha in casa',
  intolleranza: 'Le resta sullo stomaco',
  stagione: 'Fuori stagione',
};

const nomeCliente = (c: Swap['client']) =>
  [c?.firstName, c?.lastName].filter(Boolean).join(' ') || c?.email || '—';
const nomeMinimo = (c: ClienteMinimo) =>
  [c.firstName, c.lastName].filter(Boolean).join(' ') || c.clientProfile?.name || c.email;
const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('it-IT') : '—');
const conQta = (nome: string, qta: number | null, unita: string | null) =>
  qta ? `${nome} (${qta}${unita ? ` ${unita}` : ''})` : nome;

/**
 * LE SOSTITUZIONI CONCORDATE CON LE CLIENTI (§16.9).
 *
 * «Se non salviamo la sua risposta lei non impara.» Prima di questa pagina un cambio concordato in
 * chat si vedeva solo nella scheda della singola cliente, e solo per trenta giorni: cosa chiedono
 * TUTTE, e quante volte, non era una domanda che si potesse fare.
 *
 * La colonna «Volte» è il motivo per cui la tabella esiste e non è un log: una richiesta ripetuta
 * non apre una riga nuova, incrementa quella che c'è. Ed è il numero che dice quali sostituzioni
 * meritano di diventare una regola.
 */
export function Sostituzioni() {
  const { can } = useAuth();
  const puoDecidere = can('food_swaps', 'manage');
  const [rows, setRows] = useState<Swap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [soloDaVedere, setSoloDaVedere] = useState(false);
  const [aperta, setAperta] = useState<Swap | null>(null);
  const [nuova, setNuova] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await api<Swap[]>(`/food-swaps${soloDaVedere ? '?stato=da_verificare' : ''}`));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata a chi segue le clienti.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [soloDaVedere]);

  async function promuovi(s: Swap) {
    if (!confirm(
      `Portare «${s.fromFood}» → «${s.toFood}» nei gruppi di equivalenza?\n\n` +
      'Il gruppo nasce IN BOZZA: il motore non lo userà per le altre clienti finché qualcuno non lo approva.',
    )) return;
    setError(null);
    try {
      const r = await api<{ messaggio: string }>(`/food-swaps/${s.id}/promuovi`, { method: 'POST' });
      setNotice(r.messaggio);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Promozione non riuscita.');
    }
  }

  const COLONNE: Colonna<Swap>[] = [
    { chiave: 'cliente', titolo: 'Cliente', valore: (s) => nomeCliente(s.client), filtro: 'testo' },
    { chiave: 'piatto', titolo: 'Piatto', valore: (s) => s.dishName ?? '', filtro: 'testo' },
    { chiave: 'da', titolo: 'Toglie', valore: (s) => s.fromFood, filtro: 'testo' },
    { chiave: 'a', titolo: 'Mette', valore: (s) => s.toFood, filtro: 'testo' },
    { chiave: 'motivo', titolo: 'Motivo', valore: (s) => s.motivo ?? '', filtro: 'scelta', etichetta: (v) => MOTIVO[v] ?? v, etichettaTutti: 'Tutti' },
    { chiave: 'origine', titolo: 'Da', valore: (s) => s.origine, filtro: 'scelta', etichetta: (v) => ORIGINE[v] ?? v, etichettaTutti: 'Tutte', stile: { width: 110 } },
    // Il numero, non «8 volte»: come testo «10» finirebbe prima di «2».
    { chiave: 'volte', titolo: 'Volte', valore: (s) => s.volte, stile: { textAlign: 'right', width: 70 } },
    { chiave: 'ultima', titolo: 'Ultima', valore: (s) => s.ultimaVoltaIl, esporta: (s) => data(s.ultimaVoltaIl), stile: { width: 100 } },
    { chiave: 'stato', titolo: 'Stato', valore: (s) => s.stato, filtro: 'scelta', etichetta: (v) => STATO[v] ?? v, etichettaTutti: 'Tutti', ordineScelte: ['da_verificare', 'verificata', 'corretta', 'annullata'], stile: { width: 130 } },
    { chiave: 'regola', titolo: 'Regola', valore: (s) => s.promossaGruppo?.name ?? '', stile: { width: 150 } },
    { chiave: 'azioni', titolo: '', stile: { textAlign: 'right' } },
  ];

  // Le più chieste in cima: è l'ordine con cui si decide cosa vale la pena promuovere.
  const t = useTabella(rows, COLONNE, { testaFissa: true, ordineIniziale: { chiave: 'volte', direzione: 'desc' }, nomeExcel: 'Sostituzioni' });

  if (loading) return <Spinner />;

  const daVedere = rows.filter((s) => s.stato === 'da_verificare').length;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <p className="muted" style={{ margin: 0, maxWidth: 640 }}>
          Cosa le clienti hanno chiesto di cambiare, e quante volte. Una riga <b>confermata</b> può diventare un
          gruppo di equivalenza con «Promuovi a regola» — che nasce sempre <b>in bozza</b>: il motore non la usa
          per le altre finché qualcuno non la approva.
          {daVedere > 0 && !soloDaVedere && <> {daVedere} da guardare.</>}
        </p>
        {puoDecidere && (
          <button className="btn" onClick={() => setNuova(true)}><i className="ti ti-plus" /> Nuova sostituzione</button>
        )}
      </div>

      <div className="spread" style={{ marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="sostituzioni" />
          <BottoneExcel tabella={t} />
          {/* Il filtro sullo stato c'è già in colonna: questo interruttore fa una cosa diversa —
              chiede al SERVER solo la coda, perché su una tabella che cresce per sempre «cosa devo
              guardare» non deve dipendere dall'aver scaricato tutto. */}
          <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={soloDaVedere} onChange={(e) => setSoloDaVedere(e.target.checked)} />
            Solo da verificare
          </label>
        </div>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Cerca in tutte le colonne…" value={t.ricerca} onChange={(e) => t.setRicerca(e.target.value)} />
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        <Pager {...t.pager} sopra />
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">
            {rows.length === 0
              ? 'Nessuna sostituzione registrata. Si riempie da sé man mano che le clienti concordano cambi in chat.'
              : 'Nessuna sostituzione con questi filtri.'}
          </div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((s) => (
                <tr key={s.id} onClick={() => setAperta(s)} style={{ cursor: 'pointer' }} title="Apri la sostituzione">
                  <td>{nomeCliente(s.client)}</td>
                  <td className="muted">
                    {s.dishName ?? '—'}
                    {s.mealSlot && <div style={{ fontSize: 12 }}>{SLOT[s.mealSlot] ?? s.mealSlot}</div>}
                  </td>
                  <td><b>{conQta(s.fromFood, s.fromQty, s.unit)}</b></td>
                  <td>{conQta(s.toFood, s.toQty, s.unit)}</td>
                  <td className="muted">{s.motivo ? MOTIVO[s.motivo] ?? s.motivo : '—'}</td>
                  <td className="muted">{ORIGINE[s.origine] ?? s.origine}</td>
                  <td style={{ textAlign: 'right', fontWeight: s.volte > 1 ? 700 : 400 }}>{s.volte}</td>
                  <td className="muted">{data(s.ultimaVoltaIl)}</td>
                  <td>
                    <span className={`chip ${s.stato === 'da_verificare' ? 'amber' : s.stato === 'annullata' ? 'gray' : ''}`}>
                      {STATO[s.stato] ?? s.stato}
                    </span>
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {s.promossaGruppo ? `${s.promossaGruppo.name}${s.promossaGruppo.status === 'approved' ? '' : ' (bozza)'}` : '—'}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {puoDecidere && !s.promossaGruppo && (s.stato === 'verificata' || s.stato === 'corretta') && (
                      <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); void promuovi(s); }}>
                        <i className="ti ti-arrows-shuffle" /> Promuovi a regola
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

      {aperta && (
        <SchedaSostituzione
          riga={aperta}
          puoDecidere={puoDecidere}
          onClose={() => setAperta(null)}
          onSalvata={(msg) => { setAperta(null); setNotice(msg); void load(); }}
        />
      )}
      {nuova && (
        <NuovaSostituzione
          onClose={() => setNuova(false)}
          onCreata={(msg) => { setNuova(false); setNotice(msg); void load(); }}
        />
      )}
    </>
  );
}

/** Guardare una riga e decidere: confermare, correggere il sostituto, annullare. */
function SchedaSostituzione({
  riga,
  puoDecidere,
  onClose,
  onSalvata,
}: {
  riga: Swap;
  puoDecidere: boolean;
  onClose: () => void;
  onSalvata: (msg: string) => void;
}) {
  const [to, setTo] = useState(riga.toFood);
  const [toQty, setToQty] = useState(riga.toQty ? String(riga.toQty) : '');
  const [nota, setNota] = useState(riga.nota ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decidi(stato: string) {
    setError(null);
    setBusy(true);
    try {
      const corpo: Record<string, unknown> = { stato, nota: nota.trim() || undefined };
      // Il sostituto si manda solo se è stato davvero cambiato: `corretta` e `verificata` sono due
      // esiti diversi, e riscrivere lo stesso valore non deve farne comparire uno per l'altro.
      if (to.trim() && to.trim() !== riga.toFood) corpo.to = to.trim();
      const q = Number(toQty.replace(',', '.'));
      if (toQty.trim() && Number.isFinite(q) && q !== riga.toQty) corpo.toQty = q;
      await api(`/food-swaps/${riga.id}`, { method: 'PATCH', body: JSON.stringify(corpo) });
      onSalvata(stato === 'annullata' ? 'Sostituzione annullata.' : 'Sostituzione aggiornata.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`${nomeCliente(riga.client)} — ${riga.fromFood} → ${riga.toFood}`} onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="sf-kv" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="muted">Piatto</span>
          <span>{riga.dishName ?? '—'}{riga.mealSlot ? ` · ${SLOT[riga.mealSlot] ?? riga.mealSlot}` : ''}</span>
        </div>
        <div className="sf-kv" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="muted">Motivo</span>
          <span>{riga.motivo ? MOTIVO[riga.motivo] ?? riga.motivo : '—'}</span>
        </div>
        <div className="sf-kv" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="muted">Chiesta</span>
          <span>{riga.volte} volt{riga.volte === 1 ? 'a' : 'e'} · dal {data(riga.primaVoltaIl)} al {data(riga.ultimaVoltaIl)}</span>
        </div>
        {riga.validataDa && (
          <div className="sf-kv" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Guardata da</span>
            <span>{riga.validataDa.displayName}</span>
          </div>
        )}
        {riga.promossaGruppo && (
          <div className="sf-kv" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Promossa a regola</span>
            <span>{riga.promossaGruppo.name} {riga.promossaGruppo.status === 'approved' ? '' : '(bozza)'}</span>
          </div>
        )}
      </div>

      {puoDecidere ? (
        <>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="field" style={{ minWidth: 200, flex: 2 }}>
              <label>Sostituto</label>
              <input className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="field" style={{ minWidth: 110, flex: 1 }}>
              <label>Quantità{riga.unit ? ` (${riga.unit})` : ''}</label>
              <input className="input" inputMode="decimal" value={toQty} onChange={(e) => setToQty(e.target.value)} placeholder="—" />
            </div>
          </div>
          <div className="field">
            <label>Nota</label>
            <input className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="La legge anche la cliente, se il cambio è ancora sul suo menu." />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn ghost" onClick={onClose} disabled={busy}>Chiudi</button>
            <button className="btn danger" onClick={() => decidi('annullata')} disabled={busy}>Annulla la sostituzione</button>
            <button className="btn ghost" onClick={() => decidi('corretta')} disabled={busy}>Salva come corretta</button>
            <button className="btn" onClick={() => decidi('verificata')} disabled={busy}>Va bene così</button>
          </div>
        </>
      ) : (
        // La coach legge: sapere cosa ha chiesto la sua cliente è il suo lavoro. Decidere cosa
        // finisce nel piatto — e cosa diventa una regola per tutte — è un altro mestiere.
        <p className="muted" style={{ margin: 0 }}>
          {riga.nota || 'Nessuna nota.'} — per confermare o correggere serve il permesso di gestione.
        </p>
      )}
    </Modal>
  );
}

/** La riga che nessuna conversazione ha prodotto: la scrive il nutrizionista. */
function NuovaSostituzione({ onClose, onCreata }: { onClose: () => void; onCreata: (msg: string) => void }) {
  const [clienti, setClienti] = useState<ClienteMinimo[]>([]);
  const [clientId, setClientId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dishName, setDishName] = useState('');
  const [nota, setNota] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Le clienti che questa persona può già vedere: il perimetro lo applica il server.
        const r = await api<{ items?: ClienteMinimo[] } | ClienteMinimo[]>('/admin/clients');
        setClienti(Array.isArray(r) ? r : r.items ?? []);
      } catch {
        // Nessun elenco: si dice, invece di mostrare una tendina vuota che sembra rotta.
        setError('Non riesco a caricare l\'elenco delle clienti: riprova fra poco.');
      }
    })();
  }, []);

  async function submit() {
    setError(null);
    if (!clientId) { setError('Scegli la cliente.'); return; }
    if (from.trim().length < 2 || to.trim().length < 2) { setError('Scrivi che cosa si toglie e che cosa si mette.'); return; }
    setBusy(true);
    try {
      await api('/food-swaps', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          from: from.trim(),
          to: to.trim(),
          dishName: dishName.trim() || undefined,
          nota: nota.trim() || undefined,
        }),
      });
      onCreata('Sostituzione aggiunta.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nuova sostituzione" onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Una regola che vale per questa cliente. Nasce già <b>confermata</b>: l'hai scritta tu.
      </p>
      <div className="field">
        <label>Cliente</label>
        <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">— scegli —</option>
          {clienti.map((c) => <option key={c.id} value={c.id}>{nomeMinimo(c)}</option>)}
        </select>
      </div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ minWidth: 180, flex: 1 }}>
          <label>Toglie</label>
          <input className="input" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Es. pomodoro crudo" />
        </div>
        <div className="field" style={{ minWidth: 180, flex: 1 }}>
          <label>Mette</label>
          <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Es. pomodorini cotti" />
        </div>
      </div>
      <div className="field">
        <label>Piatto (facoltativo)</label>
        <input className="input" value={dishName} onChange={(e) => setDishName(e.target.value)} placeholder="Vuoto = vale in tutti i piatti" />
      </div>
      <div className="field">
        <label>Nota (facoltativa)</label>
        <input className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Perché" />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={submit} disabled={busy}>{busy ? 'Salvo…' : 'Aggiungi'}</button>
      </div>
    </Modal>
  );
}
