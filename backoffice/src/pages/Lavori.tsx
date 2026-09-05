import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner } from '../components/ui';
import { TestoConGrassetto } from '../components/TestoConGrassetto';

/**
 * LA PAGINA «LAVORI» — cosa manca, cosa è fatto, e cosa tiene ferme le altre cose.
 *
 * Richiesta di Simone (13/8): «una pagina con modifiche e implementazioni, con l'elenco dei lavori
 * da fare, e una volta fatto mettiamo la spunta — così è tutto registrato ed evidente».
 *
 * ⚠️ **Non è un doppione del REGISTRO.** Il registro racconta cosa è stato scritto, riga per riga e
 * per sempre; questa pagina risponde a «cosa manca» e ne è l'indice. Lo storico che vedi in fondo è
 * un ESTRATTO del registro — titolo e prime righe — e chi vuole il dettaglio vero apre il registro.
 *
 * ## I tre colori, e la regola che li sceglie
 *
 * - 🟢 **verde**: fatto. Non sparisce: «così è tutto registrato» è metà della richiesta.
 * - 🟡 **giallo**: aspetta qualcuno — una decisione clinica, un deploy, un numero di telefono. Non è
 *   lavoro fermo per pigrizia, e in un elenco tutto uguale lo sembrerebbe.
 * - 🔴 **rosso**: **blocca altro lavoro**. ⚠️ Non vuol dire «importante»: vuol dire che dietro c'è
 *   una fila ferma. Se diventasse un modo per dire «urgente», in un mese sarebbe tutto rosso e il
 *   colore smetterebbe di dire qualcosa.
 *
 * La regola sta in `tonoDi()`, in un posto solo: se un domani cambia, cambia per la pastiglia, per
 * il bordo e per i contatori insieme.
 */

interface Lavoro {
  id: string;
  titolo: string;
  dettaglio: string | null;
  categoria: string;
  ordine: number;
  blocca: boolean;
  /** 'alta' | 'neutra' | 'bassa' — la dà Simone. ⚠️ Non è `blocca`: vedi PRIORITA sotto. */
  priorita: string;
  /** Quando è NATO il punto, se lo sappiamo. ⚠️ Diverso da `createdAt`: vedi `quandoNata`. */
  nataIl: string | null;
  fatto: boolean;
  risposta: string | null;
  rispostaIl: string | null;
  rispostaDa: { displayName: string } | null;
  fattoIl: string | null;
  fattoDa: { displayName: string } | null;
  createdAt: string;
}

/**
 * LA PRIORITÀ — la dà Simone (19/8), e sta in una riga di pulsanti su ogni voce.
 *
 * ⚠️ **Non è il rosso.** Il rosso (`blocca`) è un fatto verificabile — dietro questa voce c'è una
 * fila ferma —; la priorità è un giudizio, e lo dà una persona sola. Sono due colonne separate
 * proprio perché si possa dire «lo so che ferma la coda, aspetta lo stesso»: con un campo solo
 * quella frase non si potrebbe più dire, e in un mese sarebbe tutto rosso.
 *
 * ⚠️ Si salva **al clic**, senza aprire la modifica: se per dare una priorità servisse aprire,
 * cambiare e salvare, dopo tre voci si smetterebbe di darla — e una leva che non si usa non è una
 * leva.
 */
const PRIORITA = [
  { v: 'alta',   etichetta: 'Alta',   icona: 'ti-arrow-up',    colore: 'var(--danger)' },
  { v: 'neutra', etichetta: 'Neutra', icona: 'ti-minus',       colore: 'var(--muted)' },
  { v: 'bassa',  etichetta: 'Bassa',  icona: 'ti-arrow-down',  colore: 'var(--muted)' },
] as const;

const PESO_PRIORITA: Record<string, number> = { alta: 0, neutra: 1, bassa: 2 };
const peso = (l: Lavoro) => PESO_PRIORITA[l.priorita ?? 'neutra'] ?? 1;

type Tono = 'fatto' | 'blocca' | 'attesa' | 'aperto';

/** Il colore di una voce, deciso una volta sola. */
function tonoDi(l: Lavoro): Tono {
  if (l.fatto) return 'fatto';
  if (l.blocca) return 'blocca';
  // «Aspetta Nocanty», «Aspetta Simone»: la categoria dice già che non è lavoro nostro fermo.
  if (/^aspetta/i.test(l.categoria)) return 'attesa';
  return 'aperto';
}

/**
 * I colori vengono dalle variabili del tema e non sono scritti a mano: il backoffice ha quattro
 * temi, e un verde fisso su fondo scuro diventa illeggibile in uno di quelli.
 */
const COLORE: Record<Tono, { bordo: string; sfondo: string; testo: string; etichetta: string; icona: string }> = {
  fatto:  { bordo: 'var(--ok-ink)',  sfondo: 'var(--ok)',                                  testo: 'var(--ok-ink)',  etichetta: 'fatto',    icona: 'ti-check' },
  blocca: { bordo: 'var(--danger)',  sfondo: 'var(--danger-bg)',                           testo: 'var(--danger)',  etichetta: 'blocca',   icona: 'ti-hand-stop' },
  attesa: { bordo: 'var(--gold)',    sfondo: 'color-mix(in srgb, var(--gold) 14%, var(--card))', testo: 'var(--gold)', etichetta: 'in attesa', icona: 'ti-hourglass' },
  aperto: { bordo: 'var(--line)',    sfondo: 'var(--card)',                                testo: 'var(--muted)',   etichetta: 'da fare',  icona: 'ti-point' },
};

function dataIt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * «QUANDO È NATO QUESTO PUNTO» — e perché a volte la pagina lo dice con parole diverse.
 *
 * Richiesta di Simone (19/8): «voglio che mi segni nell'elenco lavori la data e ora di creazione di
 * quel punto altrimenti non capisco nulla».
 *
 * ⚠️ `createdAt` **non** risponde a quella domanda per le voci che arrivano dal rilascio: entrano
 * tutte insieme al clic su «Aggiorna dal rilascio», quindi cento voci nate in due settimane
 * risulterebbero create nello stesso minuto. Mostrarla come data di nascita sarebbe una **data
 * falsa** — e una data falsa è peggio di una assente, perché si legge come un fatto e non si può
 * controllare. Quindi: «Aperta il …» quando la sappiamo, «In elenco dal …» quando abbiamo solo la
 * data del caricamento. Due fatti diversi, due frasi diverse.
 */
function quandoNata(l: Lavoro): { testo: string; spiega: string } | null {
  const iso = l.nataIl ?? l.createdAt ?? null;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  /**
   * ⚠️ **L'ora si scrive solo se la sappiamo.** Di molte voci si conosce il giorno (dal registro,
   * dal commit, dal testo della voce stessa) e non il minuto: stampare «18/08/2026, 00:00» darebbe
   * a un'ora inventata l'aspetto di un'ora misurata. Mezzanotte esatta vuol dire «giorno noto, ora
   * no» — e una voce nata davvero a mezzanotte perde il minuto, che è il prezzo giusto da pagare.
   */
  const soloGiorno = d.getHours() === 0 && d.getMinutes() === 0;
  const quando = soloGiorno
    ? d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return l.nataIl
    ? { testo: `Aperta il ${quando}`, spiega: 'Data e ora in cui questo punto è nato.' }
    : {
        testo: `In elenco dal ${dataIt(iso)}`,
        spiega: 'Non sappiamo quando è nato il punto: questa è la data in cui la riga è entrata in elenco (le voci del rilascio entrano tutte insieme).',
      };
}

export function Lavori() {
  const { can } = useAuth();
  const puoScrivere = can('dev_backlog', 'manage');
  const [righe, setRighe] = useState<Lavoro[]>([]);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [cerca, setCerca] = useState('');
  const [mostraFatte, setMostraFatte] = useState(false);

  const [nuovoTitolo, setNuovoTitolo] = useState('');
  const [nuovoDettaglio, setNuovoDettaglio] = useState('');
  const [nuovaCategoria, setNuovaCategoria] = useState('Da fare');
  const [nuovoBlocca, setNuovoBlocca] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [inModifica, setInModifica] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);
  /**
   * ⚠️ `spuntate`/`chiuse` non sono un di più: il rilascio porta DUE notizie, «ci sono voci nuove» e
   * «queste le abbiamo finite». Il server le ha sempre mandate tutte e due — questa pagina leggeva
   * solo la prima, e la sera del 14/8 con 0 nuove e 3 da spuntare non mostrava nemmeno il pulsante
   * Conferma: le spunte si sono dovute fare dalla shell di Render.
   */
  const [caricamento, setCaricamento] = useState<{
    aggiunte: number;
    spuntate: number;
    saltate: number;
    titoli: { titolo: string; categoria: string; fatta?: boolean }[];
    chiuse: { titolo: string; categoria: string }[];
    /** Voci il cui testo viene **riscritto** dal rilascio (nessuno le aveva corrette a mano). */
    riscritte: { titolo: string; categoria: string }[];
    /** ⚠️ Voci corrette A MANO dalla pagina: il rilascio ha un testo diverso e NON le tocca. */
    testiCambiati: { titolo: string; categoria: string }[];
    /** ⚠️ Voci che il FILE crede aperte e la pagina ha già chiuso: il file è indietro. */
    fileIndietro?: { chiave: string; titolo: string }[];
    /** ⚠️ Quante voci vivono solo qui, scritte a mano: il file non le vedrà mai. */
    soloInPagina?: number;
  } | null>(null);
  // ⚠️ `caricandoVoci` e non `caricando`: quello esiste già ed è il caricamento della PAGINA.
  const [caricandoVoci, setCaricandoVoci] = useState(false);

  async function carica() {
    try {
      const r = await api<{ righe: Lavoro[] }>('/admin/lavori');
      setRighe(r.righe ?? []);
      setErrore(null);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Caricamento non riuscito.');
    } finally {
      setCaricando(false);
    }
  }

  useEffect(() => { void carica(); }, []);

  const categorie = useMemo(
    () => Array.from(new Set(righe.filter((r) => !r.fatto).map((r) => r.categoria))),
    [righe],
  );

  const filtrate = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (!q) return righe;
    return righe.filter((r) => `${r.titolo} ${r.dettaglio ?? ''} ${r.categoria}`.toLowerCase().includes(q));
  }, [righe, cerca]);

  const aperte = filtrate.filter((r) => !r.fatto);
  const fatte = filtrate.filter((r) => r.fatto);
  const bloccanti = aperte.filter((r) => r.blocca).length;
  const inAttesa = aperte.filter((r) => tonoDi(r) === 'attesa').length;
  const alte = aperte.filter((r) => r.priorita === 'alta').length;

  /** Le aperte raggruppate per categoria, nell'ordine in cui il server le ha mandate. */
  const gruppi = useMemo(() => {
    const m = new Map<string, Lavoro[]>();
    for (const r of aperte) m.set(r.categoria, [...(m.get(r.categoria) ?? []), r]);
    /**
     * Dentro ogni gruppo: **priorità prima**, poi quello che blocca. ⚠️ È l'ordine che ha chiesto
     * Simone il 19/8, ed è il motivo per cui le due colonne restano separate: una voce può bloccare
     * altro lavoro ed essere comunque rimandata.
     */
    for (const [c, voci] of m) {
      m.set(c, voci.map((r, i) => ({ r, i })).sort((a, b) => peso(a.r) - peso(b.r) || Number(b.r.blocca) - Number(a.r.blocca) || a.i - b.i).map((x) => x.r));
    }
    // In cima il gruppo che contiene una priorità alta; poi quelli con un blocco dentro.
    return Array.from(m.entries()).sort((a, b) => {
      const pa = a[1].some((x) => x.priorita === 'alta') ? 0 : 1;
      const pb = b[1].some((x) => x.priorita === 'alta') ? 0 : 1;
      const ba = a[1].some((x) => x.blocca) ? 0 : 1;
      const bb = b[1].some((x) => x.blocca) ? 0 : 1;
      return pa - pb || ba - bb || a[0].localeCompare(b[0], 'it');
    });
  }, [aperte]);

  async function aggiungi() {
    if (nuovoTitolo.trim().length < 3) { setErrore('Scrivi cosa c\'è da fare: bastano poche parole, ma devono dirlo.'); return; }
    setSalvando(true);
    try {
      await api('/admin/lavori', {
        method: 'POST',
        body: JSON.stringify({ titolo: nuovoTitolo, dettaglio: nuovoDettaglio, categoria: nuovaCategoria, blocca: nuovoBlocca }),
      });
      setNuovoTitolo(''); setNuovoDettaglio(''); setNuovoBlocca(false);
      await carica();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non sono riuscito a salvare.');
    } finally {
      setSalvando(false);
    }
  }

  async function spunta(l: Lavoro) {
    // Ottimistico: la spunta deve sembrare istantanea. Se il server rifiuta, `carica()` rimette a
    // posto e il messaggio lo dice — meglio di una casella che resta ferma mezzo secondo.
    setRighe((rs) => rs.map((r) => (r.id === l.id ? { ...r, fatto: !r.fatto } : r)));
    try {
      await api(`/admin/lavori/${l.id}/fatto`, { method: 'POST', body: JSON.stringify({ fatto: !l.fatto }) });
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Spunta non riuscita.');
    }
    await carica();
  }

  async function salvaModifica(l: Lavoro, campi: Partial<Lavoro>) {
    try {
      await api(`/admin/lavori/${l.id}`, { method: 'PATCH', body: JSON.stringify(campi) });
      setInModifica(null);
      await carica();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Modifica non riuscita.');
    }
  }

  /**
   * «Copia per Claude»: il testo lo fa il SERVER, non questa pagina.
   *
   * ⚠️ Se se lo costruisse qui, fra un mese il testo incollato in chat e quello che la pagina mostra
   * direbbero due cose diverse — e chi legge in chat non ha modo di accorgersene.
   */
  async function copiaPerClaude() {
    try {
      const r = await api<{ testo: string }>('/admin/lavori/testo');
      await navigator.clipboard.writeText(r.testo);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 4000);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non sono riuscito a copiare.');
    }
  }

  /**
   * «Carica le voci nuove»: due gesti, come sulla shell.
   *
   * ⚠️ Il primo clic **non scrive**: chiede al server cosa aggiungerebbe e lo mostra. È il
   * `CONFERMA=1` dello script portato dentro la pagina — un pulsante che scrive al primo clic
   * butterebbe via quella sicurezza proprio dove è più facile premere per sbaglio.
   */
  async function caricaVoci(conferma: boolean) {
    setCaricandoVoci(true);
    try {
      const r = await api<{
        aggiunte: number;
        spuntate: number;
        saltate: number;
        titoli: { titolo: string; categoria: string; fatta?: boolean }[];
        chiuse: { titolo: string; categoria: string }[];
        riscritte: { titolo: string; categoria: string }[];
        testiCambiati: { titolo: string; categoria: string }[];
        fileIndietro?: { chiave: string; titolo: string }[];
        soloInPagina?: number;
      }>(
        '/admin/lavori/carica',
        { method: 'POST', body: JSON.stringify({ conferma }) },
      );
      if (conferma) { setCaricamento(null); await carica(); }
      else setCaricamento(r);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Caricamento non riuscito.');
    } finally {
      setCaricandoVoci(false);
    }
  }

  async function rispondi(l: Lavoro, testo: string) {
    try {
      await api(`/admin/lavori/${l.id}/risposta`, { method: 'POST', body: JSON.stringify({ risposta: testo }) });
      await carica();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Risposta non salvata.');
    }
  }

  async function elimina(l: Lavoro) {
    // ⚠️ Chiudere un lavoro è SPUNTARLO. Qui si cancella solo quello che è stato scritto per sbaglio.
    if (!confirm(`Eliminare «${l.titolo}»?\n\nSe invece è stato fatto, mettici la spunta: resta scritto con la data.`)) return;
    try {
      await api(`/admin/lavori/${l.id}`, { method: 'DELETE' });
      await carica();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Eliminazione non riuscita.');
    }
  }

  /** Le stesse proprietà per le due liste: scritte una volta, non due. */
  const propsRiga = (l: Lavoro) => ({
    puoScrivere,
    modifica: inModifica === l.id,
    apriModifica: () => setInModifica(l.id),
    chiudiModifica: () => setInModifica(null),
    spunta: (x: Lavoro) => void spunta(x),
    salvaModifica: (x: Lavoro, campi: Partial<Lavoro>) => void salvaModifica(x, campi),
    elimina: (x: Lavoro) => void elimina(x),
    rispondi: (x: Lavoro, testo: string) => void rispondi(x, testo),
  });

  if (caricando) return <div className="card">Carico…</div>;

  return (
    <>
      {errore && <Banner kind="err">{errore}</Banner>}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="chip" style={{ fontWeight: 800 }}>{aperte.length} da fare</span>
          {/* ⚠️ La priorità alta è la prima cosa che si legge: è la leva di Simone, e sta accanto al totale. */}
          {alte > 0 && (
            <span className="chip" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)', fontWeight: 800 }}
              title="Priorità alta: l'hai messa tu. È un giudizio, non un blocco.">
              <i className="ti ti-arrow-up" /> {alte} in priorità alta
            </span>
          )}
          {bloccanti > 0 && (
            <span className="chip" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)', fontWeight: 800 }}>
              <i className="ti ti-hand-stop" /> {bloccanti} blocca{bloccanti === 1 ? '' : 'no'} altro lavoro
            </span>
          )}
          {inAttesa > 0 && (
            <span className="chip" style={{ background: 'transparent', color: 'var(--gold)', border: '1px solid var(--gold)', fontWeight: 700 }}>
              <i className="ti ti-hourglass" /> {inAttesa} in attesa
            </span>
          )}
          <span className="chip" style={{ background: 'var(--ok)', color: 'var(--ok-ink)', fontWeight: 700 }}>
            <i className="ti ti-check" /> {righe.filter((r) => r.fatto).length} fatte
          </span>
          <input className="input" style={{ maxWidth: 260, marginLeft: 'auto' }} placeholder="Cerca fra i lavori…" value={cerca} onChange={(e) => setCerca(e.target.value)} />
        </div>
        {puoScrivere && (
          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn ghost" onClick={() => void copiaPerClaude()} title="Copia negli appunti le voci aperte e le risposte date, pronte da incollare in chat">
              <i className={`ti ${copiato ? 'ti-check' : 'ti-clipboard-text'}`} /> {copiato ? 'Copiato' : 'Copia per Claude'}
            </button>
            {/*
              ⚠️ Non più «Carica le voci nuove»: il nome diceva metà di quello che fa, ed è la metà
              che il 14/8 sera ha fatto finire in shell. Questo pulsante allinea la pagina al
              rilascio in tutti e due i sensi — aggiunge le voci nuove E spunta quelle che il
              rilascio dichiara finite.
            */}
            <button className="btn ghost" disabled={caricandoVoci} onClick={() => void caricaVoci(false)}
              title="Allinea la pagina all'ultimo rilascio: aggiunge le voci nuove e spunta quelle finite. Non scrive niente: prima ti mostra cosa farebbe.">
              <i className="ti ti-download" /> Aggiorna dal rilascio
            </button>
          </div>
        )}
        {caricamento && (
          <div className="card" style={{ marginTop: 10, background: 'var(--chip)' }}>
            {caricamento.aggiunte === 0 && caricamento.spuntate === 0 && !(caricamento.riscritte?.length) && !(caricamento.testiCambiati?.length) && !(caricamento.fileIndietro?.length) ? (
              <div>Non c'è niente da allineare: le {caricamento.saltate} voci del rilascio sono già in elenco, e nessuna è da spuntare.</div>
            ) : (
              <>
                {caricamento.aggiunte > 0 && (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Aggiungerei {caricamento.aggiunte} voci:</div>
                    {/*
                      ⛔ **LA CATEGORIA NON È LO STATO** (5/9). Qui si leggeva «Da fare — codice» anche
                      sulle voci che il rilascio dà per GIÀ FATTE, che nascono spuntate: da fuori
                      sembrava che una consegna appena finita aggiungesse lavoro da fare. Simone:
                      «perché mi aggiungi da fare due cose che dieci minuti fa hai detto fatte?».
                      La categoria dice DOVE va la voce, la spunta dice SE è da fare: due domande.
                    */}
                    <ul style={{ margin: '0 0 10px 18px' }}>
                      {caricamento.titoli.map((t) => (
                        <li key={t.titolo}>
                          <span className="muted">{t.categoria} — </span>{t.titolo}
                          {t.fatta && <span className="chip" style={{ marginLeft: 6 }} title="Il rilascio la dà per finita: nasce già spuntata, non è lavoro da fare.">nasce spuntata</span>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {caricamento.spuntate > 0 && (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      Spunterei {caricamento.spuntate} {caricamento.spuntate === 1 ? 'voce' : 'voci'} già in elenco, che il rilascio dà per finite:
                    </div>
                    <ul style={{ margin: '0 0 10px 18px' }}>
                      {caricamento.chiuse.map((t) => <li key={t.titolo}><span className="muted">{t.categoria} — </span>{t.titolo}</li>)}
                    </ul>
                  </>
                )}
                {/* ⚠️ DAL 18/8 IL TESTO SI RISCRIVE (voce 275). Una voce si riscrive ogni volta che
                    si scopre la causa vera di un difetto, e finora in pagina restava la versione del
                    primo caricamento: chi leggeva credeva di leggere l'ultima parola. */}
                {caricamento.riscritte?.length > 0 && (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      Aggiorno il testo di {caricamento.riscritte.length}{' '}
                      {caricamento.riscritte.length === 1 ? 'voce' : 'voci'} (categoria e posizione restano dove sono):
                    </div>
                    <ul style={{ margin: '0 0 10px 18px' }}>
                      {caricamento.riscritte.map((t) => (
                        <li key={t.titolo}><span className="muted">{t.categoria} — </span>{t.titolo}</li>
                      ))}
                    </ul>
                  </>
                )}
                {/* ⚠️ Ma NON quelle corrette a mano da qui: una correzione che sparisce al rilascio
                    dopo, in silenzio, sarebbe lo stesso difetto spostato di un metro — e questa è la
                    pagina che serve a non farlo succedere altrove. Si dicono, così sai che le due
                    versioni sono diverse. */}
                {caricamento.testiCambiati?.length > 0 && (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      ⚠️ {caricamento.testiCambiati.length}{' '}
                      {caricamento.testiCambiati.length === 1 ? 'voce è stata corretta' : 'voci sono state corrette'} a mano da qui:
                      il rilascio ha un testo diverso e NON lo riscrivo.
                    </div>
                    <ul style={{ margin: '0 0 10px 18px' }}>
                      {caricamento.testiCambiati.map((t) => (
                        <li key={t.titolo}><span className="muted">{t.categoria} — </span>{t.titolo}</li>
                      ))}
                    </ul>
                  </>
                )}
                {/*
                  ⚠️ LA DIVERGENZA FRA IL FILE E QUESTA PAGINA (19/8).

                  Il file può solo *chiudere* una voce, mai riaprirla: quando qualcosa si chiude
                  fuori da una consegna — uno script lanciato sulla shell, una decisione presa in
                  chat — questa pagina lo sa e il file no. E chi legge il file crede di leggere
                  l'elenco vero: il 19/8 sono state ripresentate come da fare la tabella IG e la
                  conta allergie, già lanciate. ⚠️ Qui non si corregge niente — quale delle due
                  versioni vinca è una decisione, non un automatismo — si dice.
                */}
                {(caricamento.fileIndietro?.length ?? 0) > 0 && (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--danger)' }}>
                      ⚠️ Il rilascio è indietro su {caricamento.fileIndietro!.length}{' '}
                      {caricamento.fileIndietro!.length === 1 ? 'voce' : 'voci'}: qui {caricamento.fileIndietro!.length === 1 ? 'è' : 'sono'} già{' '}
                      {caricamento.fileIndietro!.length === 1 ? 'spuntata' : 'spuntate'}, nel file {caricamento.fileIndietro!.length === 1 ? 'risulta' : 'risultano'} da fare.
                    </div>
                    <ul style={{ margin: '0 0 10px 18px' }}>
                      {caricamento.fileIndietro!.map((t) => <li key={t.chiave}>{t.titolo}</li>)}
                    </ul>
                    <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
                      Non tocco niente: la spunta che hai messo qui vale. Serve a saperlo — chi legge il
                      file senza aprire questa pagina le riproporrebbe come da fare.
                    </div>
                  </>
                )}
                {(caricamento.soloInPagina ?? 0) > 0 && (
                  <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
                    ⚠️ {caricamento.soloInPagina} voci aperte vivono <b>solo qui</b>, scritte a mano: nel
                    rilascio non esistono, quindi non ricevono la data di nascita né le riscritture del
                    testo. Se ne vuoi una nel repository, dimmelo e la scrivo nel file.
                  </div>
                )}
                {/* ⚠️ Va detto sempre, anche quando non c'è niente da aggiungere: è la promessa che
                    questo pulsante non tocca il lavoro fatto a mano in pagina. */}
                <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
                  Le altre {caricamento.saltate} le lascio come sono. Una voce già spuntata <b>non</b> viene mai riaperta.
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" disabled={caricandoVoci} onClick={() => void caricaVoci(true)}><i className="ti ti-check" /> Conferma</button>
                  <button className="btn ghost" onClick={() => setCaricamento(null)}>Annulla</button>
                </div>
              </>
            )}
          </div>
        )}
        <div className="hint" style={{ marginTop: 8 }}>
          🔴 blocca altro lavoro · 🟡 aspetta una persona o una decisione · 🟢 fatto, e resta scritto.
          {' '}⚠️ La <b>priorità</b> (Alta / Neutra / Bassa) è una cosa diversa dal rosso: il rosso dice che dietro
          c'è una fila ferma, la priorità dice cosa vuoi fare prima. Una voce può bloccare altro lavoro ed essere
          comunque rimandata.
          Lo storico in fondo è un <b>estratto</b> di <code>progetto/REGISTRO.md</code>, che resta la fonte del dettaglio.
        </div>
      </div>

      {puoScrivere && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0 }}>Aggiungi un lavoro</h2>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: '1 1 320px' }} placeholder="Cosa c'è da fare" value={nuovoTitolo} onChange={(e) => setNuovoTitolo(e.target.value)} />
            <input className="input" style={{ maxWidth: 220 }} list="categorie-lavori" value={nuovaCategoria} onChange={(e) => setNuovaCategoria(e.target.value)} placeholder="Categoria" />
            <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 13 }} title="Segna rosso: finché non si chiude, dietro c'è una fila ferma. Non vuol dire «urgente».">
              <input type="checkbox" checked={nuovoBlocca} onChange={(e) => setNuovoBlocca(e.target.checked)} style={{ accentColor: 'var(--danger)' }} />
              blocca altro lavoro
            </label>
            <button className="btn" disabled={salvando} onClick={() => void aggiungi()}><i className="ti ti-plus" /> Aggiungi</button>
          </div>
          <textarea className="input" rows={2} style={{ marginTop: 8 }} placeholder="Dettaglio: il perché, o cosa non va fatto (facoltativo)" value={nuovoDettaglio} onChange={(e) => setNuovoDettaglio(e.target.value)} />
        </div>
      )}

      <datalist id="categorie-lavori">
        {categorie.map((c) => <option key={c} value={c} />)}
      </datalist>

      {gruppi.map(([categoria, voci]) => (
        <div className="card" key={categoria} style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            {categoria}
            <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>{voci.length}</span>
          </h2>
          {voci.map((l) => <Riga key={l.id} l={l} {...propsRiga(l)} />)}
        </div>
      ))}

      {aperte.length === 0 && (
        <div className="card empty" style={{ padding: 24, textAlign: 'center' }}>
          {cerca ? 'Nessun lavoro con questa ricerca.' : 'Niente da fare in elenco. (Se sembra strano, probabilmente manca una voce.)'}
        </div>
      )}

      <div className="card">
        <button className="btn ghost" onClick={() => setMostraFatte((v) => !v)}>
          <i className={`ti ${mostraFatte ? 'ti-chevron-down' : 'ti-chevron-right'}`} /> Storico — {fatte.length} voci fatte
        </button>
        {mostraFatte && (
          <div style={{ marginTop: 12 }}>
            {fatte.length === 0 ? <div className="muted">Niente qui.</div> : fatte.map((l) => <Riga key={l.id} l={l} {...propsRiga(l)} />)}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Una riga dell'elenco. ⚠️ Sta FUORI dal componente della pagina di proposito: definita dentro,
 * verrebbe ricreata a ogni render e si rimonterebbe a ogni lettera digitata nella ricerca —
 * portandosi via il testo di una modifica aperta.
 */
function Riga({ l, puoScrivere, modifica, apriModifica, chiudiModifica, spunta, salvaModifica, elimina, rispondi }: {
l: Lavoro;
puoScrivere: boolean;
modifica: boolean;
apriModifica: () => void;
chiudiModifica: () => void;
spunta: (l: Lavoro) => void;
salvaModifica: (l: Lavoro, campi: Partial<Lavoro>) => void;
elimina: (l: Lavoro) => void;
rispondi: (l: Lavoro, testo: string) => void;
}) {
  const t = tonoDi(l);
  const c = COLORE[t];
  const [titolo, setTitolo] = useState(l.titolo);
  const [dettaglio, setDettaglio] = useState(l.dettaglio ?? '');
  const [categoria, setCategoria] = useState(l.categoria);
  const [blocca, setBlocca] = useState(l.blocca);
  const [risposta, setRisposta] = useState(l.risposta ?? '');
  const [apriRisposta, setApriRisposta] = useState(false);

  return (
    <div
      style={{
        display: 'flex', gap: 12, alignItems: 'flex-start',
        padding: '12px 14px', marginBottom: 8,
        background: c.sfondo,
        borderRadius: 12,
        border: '1px solid var(--line)',
        // Il colore sta nella barretta a sinistra: si legge in un colpo d'occhio scorrendo, e non
        // fa a botte col tema quando la pagina è scura.
        borderLeftWidth: 4,
        borderLeftStyle: 'solid',
        borderLeftColor: c.bordo,
        opacity: l.fatto ? 0.75 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={l.fatto}
        disabled={!puoScrivere}
        onChange={() => spunta(l)}
        style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--ok-ink)', cursor: puoScrivere ? 'pointer' : 'default' }}
        title={l.fatto ? 'Togli la spunta (si azzerano anche chi e quando)' : 'Segna come fatto'}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {modifica ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input className="input" value={titolo} onChange={(e) => setTitolo(e.target.value)} />
            <textarea className="input" rows={3} value={dettaglio} onChange={(e) => setDettaglio(e.target.value)} placeholder="Dettaglio (facoltativo)" />
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <input className="input" style={{ maxWidth: 220 }} value={categoria} onChange={(e) => setCategoria(e.target.value)} list="categorie-lavori" />
              <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={blocca} onChange={(e) => setBlocca(e.target.checked)} style={{ accentColor: 'var(--danger)' }} />
                blocca altro lavoro
              </label>
              <button className="btn sm" onClick={() => salvaModifica(l, { titolo, dettaglio, categoria, blocca })}>Salva</button>
              <button className="btn ghost sm" onClick={chiudiModifica}>Annulla</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 700, textDecoration: l.fatto ? 'line-through' : 'none', lineHeight: 1.35 }}>{l.titolo}</div>
            {l.dettaglio && (
              /*
               * ⚠️ `TestoConGrassetto` (22/8): le voci sono scritte in markdown da mesi — 103 su 155
               * usano il grassetto — e questa riga le disegnava come testo semplice, quindi gli
               * asterischi si leggevano. ⛔ Non è un renderer markdown e non è HTML: costruisce
               * elementi React, perché questo campo si scrive dalla pagina ed è testo di una persona.
               */
              <div className="muted" style={{ fontSize: 12.5, marginTop: 3, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}><TestoConGrassetto testo={l.dettaglio} /></div>
            )}
            {/*
              LA RISPOSTA — quello che si è saputo, scritto man mano (richiesta di Simone, 13/8).
              ⚠️ Non spunta la voce: «l'ho saputo» e «l'ho fatto» sono due stati diversi, e farli
              coincidere farebbe sparire dall'elenco proprio le voci pronte da lavorare.
            */}
            {l.risposta && !apriRisposta && (
              <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--chip)', fontSize: 12.5, whiteSpace: 'pre-wrap' }}>
                <b>Risposta</b>
                {(l.rispostaIl || l.rispostaDa) && (
                  <span className="muted"> · {dataIt(l.rispostaIl)}{l.rispostaDa ? ` · ${l.rispostaDa.displayName}` : ''}</span>
                )}
                <div style={{ marginTop: 3 }}>{l.risposta}</div>
              </div>
            )}
            {puoScrivere && apriRisposta && (
              <div style={{ marginTop: 8 }}>
                <textarea className="input" rows={3} value={risposta} onChange={(e) => setRisposta(e.target.value)}
                  placeholder="Cosa hai saputo? (svuotando il campo la risposta si cancella, con chi e quando)" />
                <div className="row" style={{ gap: 8, marginTop: 6 }}>
                  <button className="btn sm" onClick={() => { rispondi(l, risposta); setApriRisposta(false); }}>Salva la risposta</button>
                  <button className="btn ghost sm" onClick={() => { setRisposta(l.risposta ?? ''); setApriRisposta(false); }}>Annulla</button>
                </div>
              </div>
            )}
            <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="chip" style={{ fontSize: 10.5, background: 'transparent', border: `1px solid ${c.bordo}`, color: c.testo }}>
                <i className={`ti ${c.icona}`} /> {c.etichetta}
              </span>
              {/*
                LA PRIORITÀ — tre pulsanti, e si salva al clic (19/8, richiesta di Simone).
                ⚠️ Senza salvataggio immediato servirebbero apri → cambia → salva per ogni voce, e
                dopo tre voci si smetterebbe di darla: una leva che non si usa non è una leva.
                ⚠️ Chi non può scrivere vede comunque QUALE priorità ha la voce: nasconderla a chi
                legge farebbe sembrare l'elenco senza priorità proprio a chi lo deve solo leggere.
              */}
              {puoScrivere ? (
                <span className="row" style={{ gap: 0, border: '1px solid var(--line)', borderRadius: 999, overflow: 'hidden' }}>
                  {PRIORITA.map((p) => {
                    const attiva = (l.priorita ?? 'neutra') === p.v;
                    return (
                      <button
                        key={p.v}
                        className="btn ghost"
                        title={`Priorità ${p.etichetta.toLowerCase()} — è un tuo giudizio, non è «blocca altro lavoro»`}
                        onClick={() => { if (!attiva) salvaModifica(l, { priorita: p.v }); }}
                        style={{
                          fontSize: 10.5, padding: '2px 8px', border: 'none', borderRadius: 0,
                          fontWeight: attiva ? 800 : 500,
                          background: attiva ? (p.v === 'alta' ? 'var(--danger-bg)' : 'var(--chip)') : 'transparent',
                          color: attiva ? p.colore : 'var(--muted)',
                        }}
                      >
                        <i className={`ti ${p.icona}`} /> {p.etichetta}
                      </button>
                    );
                  })}
                </span>
              ) : (l.priorita ?? 'neutra') !== 'neutra' ? (
                <span className="chip" style={{ fontSize: 10.5 }}>priorità {l.priorita}</span>
              ) : null}
              {/*
                ⚠️ QUANDO È NATO IL PUNTO (19/8): «altrimenti non capisco nulla». Le parole cambiano
                se la data è quella vera o solo quella del caricamento — vedi `quandoNata`.
              */}
              {(() => {
                const n = quandoNata(l);
                return n ? (
                  <span className="muted" style={{ fontSize: 11.5, fontStyle: l.nataIl ? 'normal' : 'italic' }} title={n.spiega}>
                    <i className="ti ti-calendar-plus" /> {n.testo}
                  </span>
                ) : null;
              })()}
              {l.fatto && l.fattoIl && (
                <span className="muted" style={{ fontSize: 11.5 }}>
                  <i className="ti ti-check" /> fatta il {dataIt(l.fattoIl)}{l.fattoDa ? ` · ${l.fattoDa.displayName}` : ''}
                </span>
              )}
            </div>
          </>
        )}
      </div>
      {puoScrivere && !modifica && (
        <div className="row" style={{ gap: 4 }}>
          <button className="btn ghost sm" title={l.risposta ? 'Modifica la risposta' : 'Scrivi cosa hai saputo'} onClick={() => setApriRisposta((v) => !v)}>
          <i className={`ti ${l.risposta ? 'ti-message-2-check' : 'ti-message-2-plus'}`} />
        </button>
        <button className="btn ghost sm" title="Modifica" onClick={apriModifica}><i className="ti ti-pencil" /></button>
          <button className="btn ghost sm" title="Elimina (solo se scritta per sbaglio)" onClick={() => elimina(l)}><i className="ti ti-trash" /></button>
        </div>
      )}
    </div>
  );
}
