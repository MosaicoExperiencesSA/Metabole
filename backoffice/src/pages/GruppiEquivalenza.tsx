import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Pager, Spinner } from '../components/ui';
import { BottoneExcel, ContatoreRighe, useTabella, type Colonna } from '../components/tabella';

interface EqGroup {
  id: string;
  name: string;
  productId: string | null;
  members: {
    items?: string[];
    note?: string;
    /**
     * ⛔ I PESI DEI GRASSI (25/8): nome → grammi equivalenti a 100 g del riferimento. Servono a Gaia
     * per non proporre più i cambi di grasso a pari grammatura — 70 ml di panna e 70 g di olio non
     * sono la stessa cosa, e sul piatto ballano il 77% delle calorie.
     */
    fattori?: { riferimento: string; pesi?: Record<string, number>; fonte?: string };
  } | null;
  status: string; // draft | approved
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * ⛔ **«QUESTI CIBI STANNO GIÀ IN UN ALTRO GRUPPO: LI ACCORPO?»** — richiesta di Simone, 4/9.
 *
 * Unire i doppioni di oggi è un lavoro che si fa una volta; se poi ogni gruppo nuovo può nascere
 * accanto a uno che dice quasi la stessa cosa, fra sei mesi la pagina è di nuovo com'era. La
 * risposta la calcola il server (`catalog/gia-in-un-altro-gruppo.ts`, con le sue prove): qui si
 * mostra e si aspetta la scelta, che è di chi sta scrivendo.
 */
interface Accorpabile {
  id: string;
  nome: string;
  status: string;
  perche: 'stesso nome' | 'alimenti in comune';
  inComune: string[];
  daAggiungere: string[];
  quantiHa: number;
}

const itemsOf = (g: EqGroup) => (Array.isArray(g.members?.items) ? g.members!.items! : []);
const pesiOf = (g: EqGroup) => g.members?.fattori?.pesi ?? {};

/**
 * ⛔ **UNA RIGA PER ALIMENTO, col peso dopo l'uguale.** `burro = 120` vuol dire «per avere gli stessi
 * grassi di 100 g del riferimento ce ne vogliono 120».
 *
 * ⚠️ La casella è la stessa degli alimenti e non una tabella accanto: due elenchi da tenere
 * allineati a mano sono due elenchi che divergono, e qui divergere vuol dire un alimento senza peso
 * — cioè un cambio che Gaia smette di poter fare.
 */
/**
 * ⛔ **STO PER PERDERE DEI PESI SENZA VOLERLO?**
 *
 * Vera quando si sta **modificando** un gruppo e i pesi sono **diminuiti** rispetto a quelli che
 * aveva, e non è ancora stato confermato.
 *
 * ⛔ **«Diminuiti», non «spariti tutti»** — corretto al secondo giro di revisione, 25/8. La prima
 * stesura scattava solo su `!conPesi`: con tredici righe e tredici numeri, togliendone dodici il
 * salvataggio passava senza dire niente. Ma il danno non è il numero di righe perse, è che **una**
 * coppia smetta di convertirsi: da lì in poi Gaia passa la mano su un cambio che sapeva fare, e
 * nessuno saprà quando è cominciato.
 *
 * ⚠️ Pura e a parte apposta: è la condizione che decide se il lavoro del capo nutrizionista
 * sopravvive a un incolla, e una condizione del genere va scritta dove si può provare.
 */
/**
 * ⛔ **STO PER RINOMINARE IL GRUPPO CHE PORTA I PESI?**
 *
 * Il codice cerca la tabella dei grassi **per nome** (`GRUPPO_GRASSI`, «Oli e grassi da
 * condimento»): è l'unica cosa che i due lati condividono. Rinominarlo ha lo stesso identico
 * effetto sul prodotto che cancellarne i pesi — Gaia smette di convertire e passa la mano su
 * **tutti** i cambi di grasso, di tutte le clienti — ma passava senza una parola, mentre
 * cancellare i numeri chiedeva conferma. Due strade per lo stesso danno, e una sola aveva la porta.
 *
 * ⚠️ Il confronto è **normalizzato**: «Oli e Grassi da Condimento» è un rename per il codice, che
 * cerca per nome esatto (normalizzato), anche se a occhio sembra lo stesso gruppo.
 */
export const NOME_GRUPPO_GRASSI = 'Oli e grassi da condimento';

const stessoNome = (a: string, b: string) =>
  a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ');

export function stoPerRinominareIGrassi(x: {
  isEdit: boolean;
  nomePrima: string;
  nomeDopo: string;
  giaConfermato: boolean;
}): boolean {
  return (
    x.isEdit &&
    stessoNome(x.nomePrima, NOME_GRUPPO_GRASSI) &&
    !stessoNome(x.nomeDopo, NOME_GRUPPO_GRASSI) &&
    !x.giaConfermato
  );
}

export function stoPerCancellareIPesi(x: {
  isEdit: boolean;
  aveva: number;
  adesso: number;
  giaConfermato: boolean;
}): boolean {
  return x.isEdit && x.aveva > x.adesso && !x.giaConfermato;
}

export function leggiRighe(testo: string): { items: string[]; pesi: Record<string, number> } {
  const items: string[] = [];
  const pesi: Record<string, number> = {};
  for (const riga of testo.split('\n')) {
    const pulita = riga.trim();
    if (!pulita) continue;
    const taglio = pulita.indexOf('=');
    if (taglio < 0) { items.push(pulita); continue; }
    const nome = pulita.slice(0, taglio).trim();
    // La virgola decimale si accetta: è quella che si batte su una tastiera italiana.
    const peso = Number(pulita.slice(taglio + 1).trim().replace(',', '.'));
    if (!nome) continue;
    items.push(nome);
    if (Number.isFinite(peso) && peso > 0) pesi[nome] = peso;
  }
  return { items, pesi };
}

/**
 * Il verso opposto: dalle due liste al testo della casella.
 *
 * ⛔ **I PESI ORFANI NON SPARISCONO** — corretto al secondo giro di revisione, 25/8. Il confronto è
 * `pesi[i]`, cioè per **stringa esatta** contro gli `items`. Un peso la cui chiave non compare
 * identica fra gli alimenti — «Olio EVO» fra gli items e `olio evo` fra i pesi, o un alimento tolto
 * dall'elenco lasciando il suo numero — non veniva mostrato nella casella; e siccome `leggiRighe`
 * ricostruisce i pesi **solo** da quello che c'è scritto, la prima matita sul gruppo lo cancellava.
 * Non è teorico: `equivalence.service` accetta un aggiornamento di soli `items`, e la promozione di
 * una sostituzione ne aggiunge senza toccare i pesi.
 *
 * ✅ Adesso i pesi che non hanno trovato la loro riga si scrivono **in coda**, con il loro nome:
 * si vedono, si possono correggere, e soprattutto non si perdono in silenzio.
 */
export function scriviRighe(items: string[], pesi: Record<string, number>): string {
  const usati = new Set<string>();
  const righe = items.map((i) => {
    const chiave = Object.keys(pesi).find((k) => k.trim().toLowerCase() === i.trim().toLowerCase());
    if (chiave === undefined) return i;
    usati.add(chiave);
    return `${i} = ${pesi[chiave]}`;
  });
  for (const [nome, peso] of Object.entries(pesi)) {
    if (!usati.has(nome)) righe.push(`${nome} = ${peso}`);
  }
  return righe.join('\n');
}

/**
 * Gruppi di equivalenza (R4/R8): il nutrizionista rivede e approva i sostituti.
 *
 * ⛔ **DAL 4/9 UN GRUPPO NON È DI UNA DIETA** — decisione di Simone: *«i gruppi non devono essere
 * legati alle diete, sono gruppi e stop»*. Con `scopeProductId` è sparita anche la scheda dentro
 * Gestione dieta, che era una delle due porte da cui i doppioni nascevano: quella creava un gruppo
 * per ogni dieta, l'altra (il generatore) cinque-otto per ogni dieta nuova.
 */
export function GruppiEquivalenza() {
  const [rows, setRows] = useState<EqGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<EqGroup | 'new' | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await api<EqGroup[]>('/equivalence-groups'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata a nutrizionisti e amministratori.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function toggleApprove(g: EqGroup) {
    const to = g.status === 'approved' ? 'unapprove' : 'approve';
    try {
      await api(`/equivalence-groups/${g.id}/${to}`, { method: 'POST' });
      setNotice(to === 'approve' ? `"${g.name}" approvato.` : `"${g.name}" rimesso in bozza.`);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    }
  }

  async function remove(g: EqGroup) {
    if (!confirm(`Eliminare il gruppo "${g.name}"?`)) return;
    setError(null);
    try {
      await api(`/equivalence-groups/${g.id}`, { method: 'DELETE' });
      setRows((rs) => rs.filter((x) => x.id !== g.id));
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  const COLONNE: Colonna<EqGroup>[] = [
    // Nel file va anche la nota di sicurezza, che a schermo sta sotto il nome (es. «controllare le
    // etichette per allergeni»): è l'unico campo di questa tabella non ricostruibile dal foglio, ed
    // è quello con implicazioni sanitarie. Chi rivede i sostituti su Excel deve vedere l'avvertenza
    // che vedrebbe qui.
    { chiave: 'gruppo', titolo: 'Gruppo', valore: (g) => g.name, filtro: 'testo', esporta: (g) => (g.members?.note ? `${g.name} — ${g.members.note}` : g.name) },
    { chiave: 'alimenti', titolo: 'Alimenti intercambiabili', valore: (g) => itemsOf(g).join(', '), filtro: 'testo' },
    /**
     * ⚠️ La colonna dice **se** i pesi ci sono e quanti, non i numeri: in una tabella di elenco
     * nove numeri accanto a nove nomi diventano una riga illeggibile. Si aprono con la matita.
     */
    {
      chiave: 'pesi',
      titolo: 'Pesi',
      valore: (g) => {
        const n = Object.keys(pesiOf(g)).length;
        return n ? `${n} su ${itemsOf(g).length} · rif. ${g.members?.fattori?.riferimento ?? '—'}` : '—';
      },
      filtro: 'testo',
    },
    { chiave: 'stato', titolo: 'Stato', valore: (g) => g.status, filtro: 'scelta', etichettaTutti: 'Tutti', etichetta: (v) => (v === 'approved' ? 'Approvato' : 'Bozza'), stile: { width: 100 } },
    { chiave: 'azioni', titolo: 'Azioni', stile: { textAlign: 'right' } },
  ];

  // Nessun ordine iniziale: il server manda le bozze e gli approvati raggruppati per stato e poi
  // per nome, ed è l'ordine con cui si rivedono i gruppi.
  const t = useTabella(rows, COLONNE, { testaFissa: true, nomeExcel: 'Gruppi di equivalenza' });

  if (loading) return <Spinner />;

  const draftCount = rows.filter((g) => g.status !== 'approved').length;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          Gruppi di alimenti intercambiabili per le sostituzioni. Il motore userà solo i gruppi <b>approvati</b>.
          {draftCount > 0 && <> {draftCount} in bozza da rivedere.</>}
        </p>
        <button className="btn" onClick={() => setEditing('new')}>
          <i className="ti ti-plus" /> Nuovo gruppo
        </button>
      </div>

      <div className="spread" style={{ marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="gruppi" />
          <BottoneExcel tabella={t} />
        </div>
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

      <div className="card" style={{ padding: 0 }}>

        {/* Selettore di pagina anche sopra: stessa richiesta dell'11/8 sul catalogo ricette —

            su una tabella lunga cambiare pagina non deve costare due scorrimenti interi. */}

        <Pager {...t.pager} sopra />
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">{rows.length === 0 ? 'Nessun gruppo di equivalenza. Creane uno con "Nuovo gruppo".' : 'Nessun gruppo con questi filtri.'}</div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((g) => (
                <tr key={g.id} onClick={() => setEditing(g)} style={{ cursor: 'pointer' }} title="Apri il gruppo">
                  <td><b>{g.name}</b>{g.members?.note && <div className="muted" style={{ fontSize: 12 }}>{g.members.note}</div>}</td>
                  <td className="muted" style={{ maxWidth: 460 }}>{itemsOf(g).join(', ')}</td>
                  {/* ⚠️ Quanti pesi su quanti alimenti, e il riferimento: i numeri si aprono con la
                      matita, qui servono a vedere a colpo d'occhio se la tabella è completa. */}
                  <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {Object.keys(pesiOf(g)).length
                      ? `${Object.keys(pesiOf(g)).length} su ${itemsOf(g).length} · rif. ${g.members?.fattori?.riferimento ?? '—'}`
                      : '—'}
                  </td>
                  <td>
                    <span className={`chip ${g.status === 'approved' ? '' : 'gray'}`}>{g.status === 'approved' ? 'Approvato' : 'Bozza'}</span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); toggleApprove(g); }}>{g.status === 'approved' ? 'Rimetti in bozza' : 'Approva'}</button>
                    <button className="btn ghost sm" style={{ marginLeft: 6 }} onClick={(e) => { e.stopPropagation(); setEditing(g); }}>Modifica</button>
                    <button className="btn danger sm" style={{ marginLeft: 6 }} onClick={(e) => { e.stopPropagation(); remove(g); }}>Elimina</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager {...t.pager} />
      </div>

      {editing && (
        <GroupModal
          value={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setNotice(msg); void load(); }}
        />
      )}
    </>
  );
}

function GroupModal({
  value,
  onClose,
  onSaved,
}: {
  value: EqGroup | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = value != null;
  const [name, setName] = useState(value?.name ?? '');
  const [itemsText, setItemsText] = useState(
    scriviRighe(Array.isArray(value?.members?.items) ? value!.members!.items! : [], value?.members?.fattori?.pesi ?? {}),
  );
  const [note, setNote] = useState(value?.members?.note ?? '');
  const [riferimento, setRiferimento] = useState(value?.members?.fattori?.riferimento ?? '');
  const [fonte, setFonte] = useState(value?.members?.fattori?.fonte ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Il secondo Salva dopo l'avviso «stai cancellando i pesi». Vedi il riquadro in `submit`. */
  const [confermaSenzaPesi, setConfermaSenzaPesi] = useState(false);
  /**
   * I gruppi che somigliano a questo. `null` = non ho ancora chiesto; `[]` = ho chiesto e non c'è
   * niente. ⚠️ Sono due cose diverse, e confonderle vorrebbe dire chiedere due volte o non chiedere
   * mai — dipende da quale delle due si sceglie come «vuoto».
   */
  const [simili, setSimili] = useState<Accorpabile[] | null>(null);

  async function submit() {
    setError(null);
    const { items, pesi } = leggiRighe(itemsText);
    if (!name.trim()) { setError('Inserisci il nome del gruppo.'); return; }
    if (items.length === 0) { setError('Inserisci almeno un alimento (uno per riga).'); return; }
    /**
     * ⛔ **I pesi senza riferimento non vogliono dire niente.** «burro = 120» è una risposta alla
     * domanda «quanti grammi per avere i grassi di 100 g di CHE COSA?»: senza quel nome il numero
     * non si può usare, e salvarlo lo stesso vorrebbe dire scrivere una tabella che non si applica.
     */
    const conPesi = Object.keys(pesi).length > 0;
    if (conPesi && !riferimento.trim()) {
      setError('Hai scritto dei pesi: indica anche a quale alimento sono riferiti (100 g di quello).');
      return;
    }
    /**
     * ⛔ **CANCELLARE UNA TABELLA DI PESI SI FA APPOSTA, NON PER DISTRAZIONE** — corretto in
     * revisione, 25/8.
     *
     * Gli alimenti e i pesi stanno nello stesso riquadro di testo, e va bene così (due elenchi da
     * allineare a mano divergono). Ma vuol dire che **incollare** l'elenco degli alimenti da
     * un'altra parte, o togliere gli uguali per riordinare, faceva sparire l'intera tabella dei
     * grammi firmata dal capo nutrizionista — con un salvataggio che diceva «Gruppo aggiornato» e
     * niente altro. Da lì in poi Gaia sarebbe tornata alla pari grammatura, e nessuno avrebbe
     * saputo quando è successo.
     *
     * ⚠️ Si può ancora fare — è una cosa legittima — ma va **detta**: il primo salvataggio si ferma
     * e spiega, il secondo passa. Chi voleva davvero toglierli preme due volte; chi non se n'era
     * accorto ha appena scoperto cosa stava per perdere.
     */
    if (stoPerRinominareIGrassi({
      isEdit,
      nomePrima: value?.name ?? '',
      nomeDopo: name,
      giaConfermato: confermaSenzaPesi,
    })) {
      setConfermaSenzaPesi(true);
      setError(
        `Attenzione: «${NOME_GRUPPO_GRASSI}» è il gruppo da cui il sistema legge i grammi ` +
          'equivalenti dei grassi, e lo cerca per nome. Rinominandolo, da subito Gaia smette di ' +
          'convertire le quantità e passa la mano alla nutrizionista su TUTTI i cambi di grasso, ' +
          'per tutte le clienti. Se è quello che vuoi, premi di nuovo Salva.',
      );
      return;
    }
    const aveva = Object.keys(value?.members?.fattori?.pesi ?? {}).length;
    const adesso = Object.keys(pesi).length;
    if (stoPerCancellareIPesi({ isEdit, aveva, adesso, giaConfermato: confermaSenzaPesi })) {
      setConfermaSenzaPesi(true);
      setError(
        `Attenzione: questo gruppo aveva ${aveva} pesi e adesso nel testo ne restano ${adesso}. ` +
          `${adesso === 0 ? 'Salvando adesso la tabella dei grammi viene cancellata' : 'I pesi che mancano vengono persi'} ` +
          'e su quegli alimenti Gaia torna a passare la mano invece di convertire la quantità. ' +
          'Se è quello che vuoi, premi di nuovo Salva.',
      );
      return;
    }
    /**
     * ⛔ **PRIMA DI SCRIVERNE UN ALTRO, SI GUARDA SE C'È GIÀ.** Solo alla creazione: modificando un
     * gruppo che esiste la domanda non ha senso, e chiederla lì vorrebbe dire farla comparire ogni
     * volta che si corregge una riga.
     *
     * ⚠️ Se la lettura non riesce **non si blocca il salvataggio**: una domanda in più è un
     * miglioramento, un gruppo che non si riesce più a scrivere è una regressione.
     */
    if (!isEdit && simili === null) {
      setBusy(true);
      try {
        const trovati = await api<Accorpabile[]>('/equivalence-groups/accorpabili', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), items }),
        });
        setSimili(trovati);
        if (trovati.length) { setBusy(false); return; }
      } catch {
        setSimili([]);
      } finally {
        setBusy(false);
      }
    }
    const payload = {
      name: name.trim(),
      items,
      note: note.trim() || undefined,
      // ⚠️ `null` toglie i pesi, `undefined` li lascia com'erano: sono due cose diverse.
      fattori: conPesi
        ? { riferimento: riferimento.trim(), pesi, ...(fonte.trim() ? { fonte: fonte.trim() } : {}) }
        : value?.members?.fattori ? null : undefined,
    };
    setBusy(true);
    try {
      if (isEdit) {
        await api(`/equivalence-groups/${value!.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        onSaved(`Gruppo "${payload.name}" aggiornato.`);
      } else {
        await api('/equivalence-groups', { method: 'POST', body: JSON.stringify(payload) });
        onSaved(`Gruppo "${payload.name}" creato.`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  async function accorpaIn(t: Accorpabile) {
    setError(null);
    setBusy(true);
    try {
      const { items } = leggiRighe(itemsText);
      const esito = await api<{ aggiunti: string[]; giaPresenti?: { proposto: string; comeSta: string }[] }>(
        `/equivalence-groups/${t.id}/accorpa`,
        { method: 'POST', body: JSON.stringify({ items }) },
      );
      /*
        ⛔ **Quello che NON e' entrato si dice.** Il confronto e' per parola: un gruppo che ha
        «latte» fa scartare «latte di mandorla». Scrivere solo quello che e' entrato lascia chi ha
        premuto convinto di aver salvato anche il resto -- ed e' la stessa perdita silenziosa che
        questa pagina ha gia' pagato il 25/8 sui pesi.
      */
      const scartati = (esito.giaPresenti ?? []).map((x) => `${x.proposto} (c'era già come "${x.comeSta}")`);
      const coda = scartati.length ? ` Non aggiunti: ${scartati.join(', ')}.` : '';
      onSaved(
        (esito.aggiunti.length
          ? `${esito.aggiunti.join(', ')} ${esito.aggiunti.length === 1 ? 'aggiunto' : 'aggiunti'} a "${t.nome}".`
          : `"${t.nome}" li conteneva già tutti: non ho scritto niente.`) + coda,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accorpamento non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={isEdit ? 'Modifica gruppo' : 'Nuovo gruppo di equivalenza'} onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      {simili !== null && simili.length > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 12, borderLeft: '3px solid var(--warn, #d19a00)' }}>
          <p style={{ margin: '0 0 8px' }}>
            <b>Questi alimenti stanno già in {simili.length === 1 ? 'un gruppo' : 'altri gruppi'}.</b>{' '}
            Accorparli lì tiene la pagina leggibile; crearne un altro va bene solo se sono davvero
            due gruppi diversi.
          </p>
          {simili.map((t) => (
            <div key={t.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid var(--line, #eee)' }}>
              <div style={{ minWidth: 0 }}>
                <b>{t.nome}</b>{' '}
                <span className={`chip ${t.status === 'approved' ? '' : 'gray'}`} style={{ fontSize: 11 }}>
                  {t.status === 'approved' ? 'Approvato' : 'Bozza'}
                </span>
                <div className="muted" style={{ fontSize: 12 }}>
                  {t.quantiHa} aliment{t.quantiHa === 1 ? 'o' : 'i'} ·{' '}
                  {t.perche === 'stesso nome' ? 'stesso nome' : `ha già ${t.inComune.join(', ')}`}
                  {t.daAggiungere.length ? ` · ci aggiungerei ${t.daAggiungere.join(', ')}` : ' · non ci aggiungerei niente'}
                </div>
              </div>
              <button className="btn sm" disabled={busy} onClick={() => accorpaIn(t)} style={{ whiteSpace: 'nowrap' }}>
                Accorpa qui
              </button>
            </div>
          ))}
          {/*
            ⛔ **Le due cose che chi preme deve sapere PRIMA.** Accorpare dentro un approvato manda
            quegli alimenti nel motore dal prossimo menu; e i pesi e la nota scritti qui dentro
            **non** entrano nell'accorpamento, perché la porta aggiunge alimenti e non riscrive il
            gruppo. Dirlo dopo sarebbe una perdita silenziosa, che è il difetto che questa pagina ha
            già pagato il 25/8.
          */}
          {simili.some((t) => t.status === 'approved') && (
            <p className="hint" style={{ margin: '8px 0 0' }}>
              ⚠️ Il gruppo approvato il motore <b>lo usa già</b>: quello che aggiungi ci entra dal
              prossimo menu, senza che nessun altro lo rilegga.
            </p>
          )}
          {(itemsText.includes('=') || note.trim()) && (
            <p className="hint" style={{ margin: '6px 0 0' }}>
              ⚠️ Accorpando, i <b>pesi</b> e la <b>nota</b> che hai scritto qui non vengono copiati:
              passano solo gli alimenti. Se ti servono, crea il gruppo a parte.
            </p>
          )}
        </div>
      )}
      <div className="field">
        <label>Nome del gruppo</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Pesci grassi" />
      </div>
      <div className="field">
        <label>Alimenti intercambiabili (uno per riga)</label>
        <textarea className="input" rows={6} value={itemsText} onChange={(e) => setItemsText(e.target.value)} placeholder={'salmone\naringa\nsgombro'} />
        {/*
          ⛔ **I PESI DEI GRASSI** (Nocanty, 24/8: «approvata l'integrazione della colonna nell'editor
          dei gruppi per la gestione autonoma futura»). Si scrivono sulla stessa riga dell'alimento,
          dopo l'uguale: due elenchi da tenere allineati a mano divergono, e qui divergere vuol dire
          un alimento senza peso — cioè un cambio che Gaia smette di poter fare.
        */}
        <p className="hint" style={{ marginTop: 6, marginBottom: 0 }}>
          Serve un <b>peso</b>? Scrivilo dopo l'uguale: <code>burro = 120</code> vuol dire che per
          avere gli stessi grassi di 100 g del riferimento ce ne vogliono 120. Gli alimenti senza
          numero restano intercambiabili <b>a pari grammatura</b>, che va bene ovunque tranne che sui
          grassi.
        </p>
      </div>
      {/* ⚠️ I due campi compaiono solo quando servono: un modulo che chiede sempre tutto è un modulo
          in cui si smette di leggere le domande. */}
      {itemsText.includes('=') && (
        <>
          <div className="field">
            <label>Riferimento dei pesi</label>
            <input
              className="input"
              value={riferimento}
              onChange={(e) => setRiferimento(e.target.value)}
              placeholder="Es. olio extravergine di oliva"
            />
            <p className="hint" style={{ marginTop: 4, marginBottom: 0 }}>
              L'alimento a cui i numeri sono riferiti: i pesi dicono quanti grammi equivalgono a
              <b> 100 g di questo</b>.
            </p>
          </div>
          <div className="field">
            <label>Fonte dei numeri (facoltativa)</label>
            <input className="input" value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="Es. CREA / USDA" />
          </div>
        </>
      )}
      <div className="field">
        <label>Nota di sicurezza (facoltativa)</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. controllare le etichette per allergeni" />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        {/* ⚠️ Con la domanda sullo schermo il pulsante dice cosa fa davvero: crea un gruppo A PARTE.
            «Crea» sopra un elenco di gruppi somiglianti è la parola che fa premere senza leggere. */}
        <button className="btn" onClick={submit} disabled={busy || !name.trim()}>
          {busy ? 'Salvo…' : isEdit ? 'Salva' : simili && simili.length > 0 ? 'Crea comunque un gruppo nuovo' : 'Crea'}
        </button>
      </div>
    </Modal>
  );
}
