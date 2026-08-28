import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Banner, Modal } from './ui';
// ⚠️ Un giorno di calendario si scrive senza passare da `new Date().toLocaleDateString`, che lo
// riformatta attraverso il fuso: a ovest di Greenwich «fino al 04/09» diventerebbe il 03/09.
import { giornoItaliano } from '../lib/giorno';

/**
 * ⛔ **LA CODA «DA VALIDARE» — spostata dalla dashboard alla pagina delle Attività (22/8).**
 *
 * Richiesta di Simone: *«togliamo il "da validare" in dashboard che non mi piace ed unifichiamolo
 * con questo»*, dove «questo» è **Attività da fare** — la pagina che dal 22/8 la nutrizionista può
 * finalmente aprire.
 *
 * ⚠️ **Ha senso, e la ragione è più forte del gusto**: fino a ieri il suo lavoro stava in due posti
 * che non si guardavano — tre code in dashboard e quattro tipi di attività in una pagina a cui non
 * aveva accesso. Due elenchi di «cosa devo fare» sono due elenchi che si leggono a metà.
 *
 * ## ⛔ NON diventano attività finte, e non è pigrizia
 *
 * La strada ovvia sarebbe stata generare una riga di `coach_task` per ogni voce delle tre code. Non
 * si fa, per tre ragioni misurabili:
 *
 *  - ⛔ **le code sono già la verità**: una dieta in revisione *è* una riga con quello stato. Una
 *    copia in `coach_task` è un secondo elenco che diverge dal primo il giorno che qualcuno approva
 *    la dieta da un'altra parte — e resterebbe in pagina a chiedere un lavoro già fatto;
 *  - ⛔ **si chiudono da sole**: quando la decisione viene rivista, la riga sparisce dalla coda
 *    perché la coda la ricalcola. Con le attività servirebbe qualcuno che le chiuda, e quel
 *    qualcuno prima o poi si dimentica;
 *  - ⚠️ **le azioni sono diverse**. «Presa visione» e «Correggi…» non sono «Fatto» e «Salta»: la
 *    prima registra una lettura, la seconda apre le azioni ammesse **per quella causa**, che decide
 *    il backend. Schiacciarle su Fatto/Salta sarebbe dare a un pulsante un nome che non descrive
 *    quello che fa — il difetto che il 19/8 è costato la rinomina di «Conferma».
 *
 * Quindi: **stesse righe, stessi pulsanti, altra pagina**. Lette dal vivo a ogni apertura.
 *
 * ## ⚠️ E niente scadenza, niente escalation
 *
 * Deciso da Simone il 22/8. Le attività vere hanno una scadenza e, se restano aperte, dopo 24 ore
 * vanno al responsabile; queste no — è il comportamento che avevano in dashboard, e non c'è ragione
 * di cambiarlo spostandole. ⚠️ Discende anche dal fatto che non sono `coach_task`: non hanno una
 * `dueDate` da nessuna parte, quindi il silenzio qui è una **conseguenza**, non una dimenticanza.
 *
 * ## ⚠️ Un componente solo, non due copie
 *
 * Il riquadro viveva dentro `NutritionistHome.tsx`, con i suoi stati e la sua finestra. È stato
 * **estratto**, non ricopiato: *se due punti rispondono alla stessa domanda, uno dei due deve
 * chiamare l'altro*. La dashboard adesso non lo disegna più; se un giorno lo si volesse anche lì,
 * si mette questo.
 */

interface Decision {
  id: string;
  clientId: string;
  patientName: string | null;
  date: string;
  flagReason: string | null;
  /** La causa (`calo_rapido_energia`, `energia_bassa_cronica`, …) e la sua etichetta breve. */
  causa: string | null;
  causaEtichetta: string | null;
  rule: { id: string; name: string } | null;
  action: unknown;
}

/**
 * Cosa si può fare su una riga della coda: arriva dal backend, perché **quali azioni siano ammesse
 * dipende dalla causa** ed è una regola clinica, non una scelta di interfaccia. Se la tabella
 * vivesse qui, una POST fatta a mano la scavalcherebbe.
 */
interface AzioniDecisione {
  decisionId: string;
  clientId: string;
  causa: string | null;
  causaEtichetta: string | null;
  flagReason: string | null;
  pianoGiaFermo: boolean;
  calcoloGiaAzzeratoIl: string | null;
  azioni: { azione: string; etichetta: string; cosaFa: string; eseguitaDalServer: boolean; chiedeUnNumero: boolean }[];
  /**
   * ⛔ Il motore proponeva **proprio** di alzare le calorie (`menu: 'increase_calories'`). Fino al
   * 28/8 quel campo finiva soltanto nel payload della notifica quotidiana: viaggiava e non cambiava
   * niente per chi doveva decidere.
   */
  motoreProponeAumento: boolean;
  /** Quello che c'è già scritto sulle calorie di questa cliente, per non sovrascriverlo alla cieca. */
  correzioneAttualePct: number | null;
  correzioneFinoAl: string | null;
}

export interface Queue {
  engineDecisions: Decision[];
  dietsInReview: { id: string; name: string; regime: string; style: string }[];
  protocolsPending: { id: string; name: string; type: string }[];
  /** Quante ce ne sono nel database (da `count()`), non quante righe sono nell'elenco. */
  counts: { engineDecisions: number; dietsInReview: number; protocolsPending: number };
  /** Quante righe sono arrivate: se è meno di `counts`, l'elenco è troncato e va detto. */
  mostrati?: { engineDecisions: number; dietsInReview: number; protocolsPending: number };
}

/**
 * Il numero fra parentesi nei titoli della coda.
 *
 * Prima era `elenco.length`, cioè la lunghezza di un array troncato a 100: nel giorno in cui il
 * motore segnala più di cento clienti — quello in cui il numero serve — diceva «100» qualunque
 * fosse la verità. Adesso `totale` viene dal database e, quando l'elenco è più corto, si dice
 * entrambi.
 */
const conteggio = (totale: number, mostrati: number): string =>
  mostrati < totale ? `${mostrati} di ${totale}` : String(totale);

/**
 * ⛔ **QUANTE RIGHE SI DISEGNANO PER SEZIONE** (aggiunto in revisione, 22/8).
 *
 * In dashboard le decisioni erano tagliate a 8 e le altre due sezioni **non avevano tetto**: fino a
 * cento righe l'una. Lì era un riquadro fra tanti; qui sta **in cima a un elenco di cose da fare**,
 * e il capo nutrizionista con quaranta protocolli in attesa si trovava la prima attività vera a due
 * schermate di scroll.
 *
 * ⚠️ Il numero completo resta scritto nel titolo (`counts` viene dal database, non dalla lunghezza
 * dell'elenco): *niente tagli silenziosi* — si taglia e si dice quanto.
 */
const IN_VISTA = 5;

/** Quanti elementi ha in tutto la coda: serve a decidere se disegnare il riquadro. */
export const quantiInCoda = (q: Queue | null): number =>
  !q ? 0 : q.counts.engineDecisions + q.counts.dietsInReview + q.counts.protocolsPending;

export function CodaDaValidare({ onCambiata, perTutte }: {
  onCambiata?: () => void;
  /**
   * Chi guarda vede la coda di **tutte** le clienti (il capo nutrizionista) invece delle sue.
   * ⚠️ Lo sa il chiamante dal ruolo: qui non si rifà il conto — sarebbe una seconda risposta alla
   * stessa domanda, e per giunta indovinata da un componente che il perimetro non lo applica.
   */
  perTutte?: boolean;
}) {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [caricata, setCaricata] = useState(false);
  /**
   * ⛔ **DUE ERRORI, NON UNO** (trovato in revisione, 22/8). La prima stesura ne aveva uno solo, e
   * lo usava sia per «non riesco a leggere la coda» sia per «questa azione non è riuscita» — con un
   * `return` anticipato sul banner. Bastava un 500 su «Correggi…» per far **sparire tutto il
   * riquadro** — decisioni, diete, protocolli — lasciando una riga rossa e nessun modo di
   * riaverlo indietro senza ricaricare il browser. In dashboard il banner stava in cima e il
   * riquadro restava sotto: il trasloco aveva peggiorato la cosa.
   */
  const [erroreCoda, setErroreCoda] = useState<string | null>(null);
  const [erroreAzione, setErroreAzione] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [azioni, setAzioni] = useState<AzioniDecisione | null>(null);
  const [azioneInCorso, setAzioneInCorso] = useState(false);
  const [notaAzione, setNotaAzione] = useState('');
  /** I numeri di «Alza le calorie»: di quanto, e per quanti giorni. */
  const [pctAumento, setPctAumento] = useState('');
  const [giorniAumento, setGiorniAumento] = useState('');
  /**
   * ⛔ **«7 giorni» scritto nel campo giorni non è 7** (28/8, in revisione). `Number('7 giorni')` è
   * `NaN`, `JSON.stringify` lo manda come `null`, e `@IsOptional()` sul DTO lascia passare `null`
   * come «non l'ho scritto»: risultato, un aumento **permanente** al posto di uno di sette giorni,
   * senza nessun errore e sotto una riga che dice «se lasci vuoti i giorni vale finché non lo
   * togli». Il backend non può distinguere i due casi — arrivano identici — quindi il controllo va
   * fatto qui, prima di spedire.
   */
  const giorniScritti = giorniAumento.trim();
  const giorniValidi = giorniScritti === '' || /^[1-9]\d{0,2}$/.test(giorniScritti);
  /**
   * ⚠️ Compare **solo dopo** che il backend ha rifiutato per la soglia minima: chiedere una conferma
   * prima, a una che sta alzando le calorie, vorrebbe dire mettere in pagina un avviso che nel 99%
   * dei casi non riguarda nessuno — e gli avvisi che non riguardano nessuno si imparano a ignorare.
   */
  const [confermaSottoSoglia, setConfermaSottoSoglia] = useState(false);
  /** Il backend ha rifiutato per la soglia: da qui in poi la casella di conferma esiste. */
  const [serveConferma, setServeConferma] = useState(false);

  /**
   * ⚠️ **Un errore qui NON è «coda vuota».** Se la chiamata non riesce si dice, invece di disegnare
   * un riquadro vuoto che si legge come «non hai niente da validare»: *«non lo so» deve costare
   * meno di «ho indovinato»*, e qui indovinare vuol dire nascondere del lavoro clinico.
   */
  const carica = useCallback(async () => {
    try {
      setQueue(await api<Queue>('/nutritionist/validation-queue'));
      // ⚠️ Azzera SOLO il proprio errore: quello dell'azione appena fallita deve restare a schermo.
      setErroreCoda(null);
    } catch (err) {
      setQueue(null);
      setErroreCoda(
        err instanceof Error
          ? `Non riesco a leggere la coda «Da validare»: ${err.message}`
          : 'Non riesco a leggere la coda «Da validare».',
      );
    } finally {
      setCaricata(true);
    }
  }, []);

  useEffect(() => { void carica(); }, [carica]);

  async function reviewDecision(id: string, outcome: 'confirm' | 'correct') {
    setErroreAzione(null);
    setNotice(null);
    setQueue((q) => (q ? { ...q, engineDecisions: q.engineDecisions.filter((x) => x.id !== id) } : q));
    try {
      await api(`/nutritionist/decisions/${id}/${outcome}`, { method: 'POST', body: JSON.stringify({}) });
      setNotice(outcome === 'confirm' ? 'Decisione confermata.' : 'Decisione segnata da correggere.');
    } catch (err) {
      /**
       * ⛔ **E l'errore deve sopravvivere al ricaricamento** (revisione del 22/8). Prima l'errore lo
       * scriveva questo `catch` e mezzo secondo dopo `carica()` lo cancellava, perché azzerava
       * l'unico stato che c'era: la riga spariva (ottimismo), **ricompariva** al ricaricamento, e
       * nessuno diceva perché. Sembrava un difetto grafico ed era una POST fallita.
       */
      setErroreAzione(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      // ⚠️ Si ricarica sempre, anche dopo un errore: quello che si legge dev'essere quello che c'è.
      await carica();
      onCambiata?.();
    }
  }

  /**
   * «CORREGGI» apre le azioni della causa, non un modulo generico (§15.2 punto 2).
   *
   * La domanda di Nocanty era «cosa fanno questi due pulsanti?», e la risposta onesta era «niente»:
   * scrivevano l'esito e nessun altro pezzo di codice leggeva quel campo. Ora «Correggi» chiede al
   * backend cosa si può fare **per quella causa** e lo mostra con scritto cosa succede: un pulsante
   * che cambia il piano di una persona deve dirlo prima di essere premuto, non dopo.
   */
  async function apriAzioni(id: string) {
    setErroreAzione(null);
    try {
      setAzioni(await api<AzioniDecisione>(`/nutritionist/decisions/${id}/azioni`));
      setNotaAzione('');
      setPctAumento('');
      setGiorniAumento('');
      setConfermaSottoSoglia(false);
      setServeConferma(false);
    } catch (err) {
      setErroreAzione(err instanceof Error ? err.message : 'Non riesco a leggere le azioni disponibili.');
    }
  }

  async function eseguiAzione(azione: string) {
    if (!azioni) return;
    setAzioneInCorso(true);
    setErroreAzione(null);
    setNotice(null);
    try {
      /**
       * ⛔ **LA RISPOSTA SI LEGGE** (trovato in revisione, 22/8, ed era così anche prima del
       * trasloco). Il backend degrada di proposito: se l'azione sul piano riesce ma la riga **non
       * esce dalla coda**, torna `codaChiusa: false` e un `avviso` che dice cosa fare
       * (`nutritionist.service.ts`). La UI lo buttava via e scriveva comunque il messaggio fisso di
       * riuscita — cioè il backend diceva «è andata a metà» e la pagina rispondeva «tutto bene».
       * *Se degradi, dillo* vale anche per chi ascolta.
       */
      const esito = await api<{ codaChiusa?: boolean; avviso?: string }>(
        `/nutritionist/decisions/${azioni.decisionId}/azione`,
        {
          method: 'POST',
          body: JSON.stringify({
            azione,
            note: notaAzione.trim() || undefined,
            // ⚠️ I numeri partono **solo** per l'azione che li chiede: mandarli sempre vorrebbe dire
            // spedire una percentuale insieme a «blocca il piano», e il giorno che qualcuno li
            // leggesse per sbaglio sarebbe un cambio di calorie non voluto.
            ...(azione === 'alza_calorie'
              ? {
                  correzionePct: Number(pctAumento.replace(',', '.')),
                  perGiorni: giorniScritti ? Number(giorniScritti) : undefined,
                  confermaSottoSoglia: confermaSottoSoglia || undefined,
                }
              : {}),
          }),
        },
      );
      const fatto =
        azione === 'blocca_piano'
          ? 'Piano messo in pausa: i giorni nuovi non partono, quelli già ricevuti restano alla cliente.'
          : azione === 'alza_calorie'
            // ⚠️ **La frase cambia se c'è un avviso.** Il backend dice quando i menu NON sono stati
            // rigenerati o la nota non è stata scritta: scrivere lo stesso «i giorni futuri si
            // rigenerano e resta scritto in scheda» e poi appiccicarci l'avviso vorrebbe dire dire
            // una cosa e la sua smentita nella stessa riga.
            ? esito?.avviso
              ? `Calorie alzate del ${pctAumento}%.`
              : `Calorie alzate del ${pctAumento}%: i giorni futuri si rigenerano, e resta scritto in scheda con chi l'ha decisa e la data.`
            : 'Autorizzazione registrata: il calcolo del calo riparte da adesso.';
      setNotice(esito?.avviso ? `${fatto} ⚠️ ${esito.avviso}` : fatto);
      setAzioni(null);
    } catch (err) {
      /**
       * ⚠️ **La soglia minima si conferma, non si subisce.** Il backend rifiuta il primo tentativo
       * che lascerebbe il target sotto la soglia di sicurezza, **col numero dentro il messaggio**.
       * Senza questa riga il nutrizionista leggeva «puoi farlo, ma la conferma va data in modo
       * esplicito» e non aveva **nessun modo** di darla: un vicolo cieco con l'aria di un divieto.
       */
      if (err instanceof Error && /soglia minima/i.test(err.message)) setServeConferma(true);
      /**
       * ⚠️ E l'errore tipico è «Questa decisione è già stata lavorata: **ricarica la coda**»: prima
       * il `catch` non ricaricava, cioè la pagina chiedeva a una persona di fare a mano una cosa che
       * poteva fare da sé. Adesso il ricaricamento è nel `finally`.
       */
      setErroreAzione(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setAzioneInCorso(false);
      await carica();
      onCambiata?.();
    }
  }

  /**
   * ⚠️ **Coda vuota = niente riquadro.** In dashboard il riquadro c'era sempre, con dentro «Nessuna
   * decisione da rivedere»: aveva senso lì, era una casella fissa. In una pagina che è un **elenco
   * di cose da fare**, un riquadro che dice «niente da fare» è rumore in cima a tutto il resto.
   * ⛔ L'errore invece si mostra sempre: vedi la nota su `carica`.
   */
  if (!caricata) return null;
  // ⛔ Solo l'errore della CODA nasconde il riquadro: un'azione fallita lascia tutto al suo posto.
  if (erroreCoda) return <Banner kind="err">{erroreCoda}</Banner>;
  if (quantiInCoda(queue) === 0) {
    return (
      <>
        {erroreAzione && <Banner kind="err">{erroreAzione}</Banner>}
        {notice && <Banner kind="ok">{notice}</Banner>}
      </>
    );
  }

  return (
    <>
      {erroreAzione && <Banner kind="err">{erroreAzione}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}
      <div className="card" style={{ marginTop: 0, marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>Da validare</h2>
        {/*
          ⛔ **DUE PERIMETRI NELLA STESSA PAGINA, e finché non si dice sembrano uno.** Per il **capo**
          nutrizionista `validationQueue` è **globale** (`nutritionist.service.ts`: `supervisor` →
          `clientFilter = {}`), mentre l'elenco delle attività qui sotto resta filtrato sulle sue
          clienti (`filtroNutrizionista`). Sopra «tutta l'azienda», sotto «le mie», senza nessuna
          etichetta: due numeri sulla stessa schermata che rispondono a domande diverse è il modo in
          cui qualcuno conta male senza accorgersene.

          ⚠️ **Per la nutrizionista semplice invece combaciano** (`clientId: { in: ids }`, le sue
          assegnate): scrivere «questa coda è di tutte» anche a lei sarebbe stato falso — la prima
          stesura di questa riga lo faceva. La frase quindi si mostra **solo al capo**.
        */}
        {perTutte && (
          <div className="muted" style={{ fontSize: 11.5, margin: '0 0 8px', lineHeight: 1.4 }}>
            Questa coda è di <b>tutte</b> le clienti; le attività qui sotto sono solo le tue.
          </div>
        )}

        {queue && queue.counts.engineDecisions > 0 && (
          <>
            <h3 style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0' }}>
              Decisioni del motore ({conteggio(queue.counts.engineDecisions, queue.mostrati?.engineDecisions ?? queue.engineDecisions.length)})
            </h3>
            {/*
              ⚠️ COSA FANNO DAVVERO QUESTI DUE PULSANTI — la domanda di Nocanty, risposta il 19/8.
              «Presa visione» registra una lettura: `reviewOutcome`, chi e quando. ⚠️ **La proposta
              del motore non viene applicata da sola**, nemmeno confermando: `reviewDecision` non
              azzera `flaggedForReview`, e il menu legge solo le decisioni non segnalate. Il pulsante
              si chiamava «Conferma», che è la parola con cui si dice «fallo»: chi lo premeva credeva
              di aver applicato qualcosa.

              ⛔ **CAMBIATO IL 28/8, e il cartello è cambiato con lui.** Fino a ieri la frase diceva
              che «in nessuno dei due casi» il piano veniva toccato, ed era vera. Adesso dentro
              «Correggi…» c'è **«Alza le calorie»**, che il piano lo cambia davvero — passando dalla
              stessa porta della scheda cliente. Lasciare la frase vecchia avrebbe voluto dire far
              premere un pulsante a chi ha appena letto che non fa niente: *una ragione falsa è
              peggio di un ordine sbagliato*, e qui sarebbe stata falsa nel verso più pericoloso.
            */}
            <div className="muted" style={{ fontSize: 11, margin: '0 0 6px', lineHeight: 1.4 }}>
              <b>Presa visione</b> registra che l'hai letta: la proposta del motore non viene
              applicata al piano. <b>Correggi…</b> apre le azioni ammesse per quella causa — e una di
              quelle, <b>Alza le calorie</b>, il piano lo cambia davvero.
            </div>
            {queue.engineDecisions.slice(0, IN_VISTA).map((d) => (
              <div key={d.id} className="spread" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <b style={{ fontSize: 14 }}>
                    {d.patientName ? <Link to={`/clienti/${d.clientId}`} className="link">{d.patientName}</Link> : 'Paziente'}
                  </b>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {d.date}
                    {d.causaEtichetta && ` · ${d.causaEtichetta}`}
                    {d.rule?.name && ` · ${d.rule.name}`}
                    {d.flagReason && ` · ${d.flagReason}`}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={() => void reviewDecision(d.id, 'confirm')}>Presa visione</button>
                  <button className="btn ghost sm" onClick={() => void apriAzioni(d.id)}>Correggi…</button>
                </div>
              </div>
            ))}
          </>
        )}

        {queue && queue.dietsInReview.length > 0 && (
          <>
            <h3 style={{ fontSize: 13, color: 'var(--muted)', margin: '14px 0 4px' }}>
              Diete in revisione ({conteggio(queue.counts.dietsInReview, queue.mostrati?.dietsInReview ?? queue.dietsInReview.length)})
            </h3>
            {queue.dietsInReview.slice(0, IN_VISTA).map((d) => (
              <div key={d.id} className="spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                {/* Lo stile è stato tolto l'11/8: accanto al nome non aggiungeva niente
                    («Pescetariana · mediterranean») e ripeteva un dato che non identifica la dieta.
                    Il regime invece sì: dice se è onnivora, vegetariana o vegana. */}
                <span><b>{d.name}</b> <span className="muted" style={{ fontSize: 12 }}>({d.regime})</span></span>
                <Link className="btn ghost sm" to="/diete">Apri</Link>
              </div>
            ))}
          </>
        )}

        {queue && queue.protocolsPending.length > 0 && (
          <>
            <h3 style={{ fontSize: 13, color: 'var(--muted)', margin: '14px 0 4px' }}>
              Protocolli in attesa ({conteggio(queue.counts.protocolsPending, queue.mostrati?.protocolsPending ?? queue.protocolsPending.length)})
            </h3>
            {queue.protocolsPending.slice(0, IN_VISTA).map((p) => (
              <div key={p.id} className="spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span><b>{p.name}</b> <span className="muted" style={{ fontSize: 12 }}>({p.type})</span></span>
                <Link className="btn ghost sm" to="/protocolli">Apri</Link>
              </div>
            ))}
          </>
        )}
      </div>

      {/*
        LA FINESTRA DI «CORREGGI». Le azioni arrivano dal backend perché dipendono dalla causa.
        «Apri la scheda» e «Scrivi in chat» sono rimandi: portano dove quelle cose vivono già, coi
        loro permessi. Non si reimplementano qui — una seconda strada per cambiare la dieta, con
        controlli diversi, è il modo in cui nascono i buchi.
      */}
      {azioni && (
        <Modal title={azioni.causaEtichetta ?? 'Cosa vuoi fare'} onClose={() => setAzioni(null)}>
          {azioni.flagReason && (
            <p style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 0, color: 'var(--ink)' }}>{azioni.flagReason}</p>
          )}
          {azioni.pianoGiaFermo && (
            <Banner kind="info">
              Il piano di questa cliente è <b>già fermo</b>: i giorni nuovi non partono. Si riattiva dalla
              sua scheda.
            </Banner>
          )}
          {azioni.calcoloGiaAzzeratoIl && (
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
              Il calcolo del calo è già stato azzerato il{' '}
              {new Date(azioni.calcoloGiaAzzeratoIl).toLocaleDateString('it-IT')}.
            </div>
          )}
          {/*
            ⛔ La proposta del motore, **detta**: `menu: 'increase_calories'` esisteva da sempre e
            arrivava soltanto dentro il payload di una notifica, cioè da nessuna parte utile a chi
            decide. ⚠️ Si dice e basta — non si preseleziona niente: la decisione resta di chi guarda,
            e un modulo che parte già compilato è un modulo che si conferma senza leggere.
          */}
          {azioni.motoreProponeAumento && (
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
              <i className="ti ti-arrow-up-right" /> Il motore proponeva di <b>alzare le calorie</b>.
            </div>
          )}
          {azioni.correzioneAttualePct != null && (
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
              ⚠️ Su questa cliente c'è già una correzione del <b>{azioni.correzioneAttualePct > 0 ? '+' : ''}
              {azioni.correzioneAttualePct}%</b>
              {azioni.correzioneFinoAl ? ` fino al ${giornoItaliano(azioni.correzioneFinoAl)}` : ' senza scadenza'}
              : quello che scrivi qui la <b>sostituisce</b>.
            </div>
          )}

          {/*
            ⛔ **LA NOTA STA DAVVERO SOPRA I PULSANTI** (rimessa a posto il 28/8).

            Il commento che stava qui prometteva esattamente questo — «se fosse dopo, si scriverebbe
            dopo aver già premuto» — ma i pulsanti «Fai questo» sono **dentro le card delle azioni**,
            quindi il campo, che veniva dopo l'elenco, stava sotto tutti quanti. Il difetto che il
            commento dichiarava di evitare era proprio quello che c'era.

            ⚠️ E non è più «facoltativa» per tutti: per «Alza le calorie» il motivo è **obbligatorio**
            — lo rifiuta il server, e finisce nello storico delle calorie e nella nota in scheda.
            Per il blocco è il motivo che resta scritto sul piano, cioè quello che leggerà chi
            troverà quel piano fermo fra tre giorni.
          */}
          <label style={{ display: 'block', marginTop: 12, fontSize: 13 }}>
            {azioni.azioni.some((a) => a.chiedeUnNumero)
              ? 'Motivo (obbligatorio per «Alza le calorie», resta nello storico e in scheda)'
              : 'Nota (facoltativa, resta nello storico)'}
            <textarea
              className="input"
              rows={2}
              value={notaAzione}
              maxLength={1000}
              onChange={(e) => setNotaAzione(e.target.value)}
              placeholder="Es. la sento domani in televisita"
              style={{ marginTop: 4 }}
            />
          </label>

          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {azioni.azioni.map((a) => (
              <div key={a.azione} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 11 }}>
                <div className="spread" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 14 }}>{a.etichetta}</b>
                    <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 3 }}>{a.cosaFa}</div>
                    {/*
                      ⚠️ I campi stanno **dentro la card dell'azione**, non in fondo alla finestra:
                      un numero scritto lontano dal pulsante che lo usa è un numero che si compila
                      per un'azione e si spedisce con un'altra. ⚠️ E `chiedeUnNumero` viene dal
                      backend: la pagina non tiene un elenco suo di quali azioni hanno un modulo,
                      altrimenti la prossima nascerebbe senza campi e nessuno se ne accorgerebbe.
                    */}
                    {a.chiedeUnNumero && (
                      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <label style={{ fontSize: 12 }}>
                          Di quanto (%)
                          <input
                            className="input sm"
                            inputMode="decimal"
                            value={pctAumento}
                            onChange={(e) => setPctAumento(e.target.value)}
                            placeholder="10"
                            style={{ marginTop: 3, width: 80 }}
                          />
                        </label>
                        <label style={{ fontSize: 12 }}>
                          Per quanti giorni
                          <input
                            className="input sm"
                            inputMode="numeric"
                            value={giorniAumento}
                            onChange={(e) => setGiorniAumento(e.target.value)}
                            placeholder="7"
                            style={{ marginTop: 3, width: 90 }}
                          />
                        </label>
                        {/*
                          ⚠️ Detto qui e non solo nel testo dell'azione: «vuoto = per sempre» è la
                          differenza fra una settimana di scarico e un cambio di piano, e il silenzio
                          le fa sembrare uguali.
                        */}
                        <span className="muted" style={{ fontSize: 11.5, flexBasis: '100%' }}>
                          Se lasci vuoti i giorni, l'aumento vale finché non lo togli.
                        </span>
                        {!giorniValidi && (
                          <span style={{ fontSize: 11.5, flexBasis: '100%', color: '#b3261e' }}>
                            I giorni vanno scritti come numero: <b>7</b>, non «7 giorni».
                          </span>
                        )}
                        {notaAzione.trim().length < 3 && (
                          <span style={{ fontSize: 11.5, flexBasis: '100%', color: '#9a6a00' }}>
                            Per questa azione il <b>motivo qui sopra è obbligatorio</b>: finisce nello storico
                            delle calorie e nella nota in scheda.
                          </span>
                        )}
                        {serveConferma && (
                          <label style={{ fontSize: 11.5, flexBasis: '100%', color: '#b3261e' }}>
                            <input
                              type="checkbox"
                              checked={confermaSottoSoglia}
                              onChange={(e) => setConfermaSottoSoglia(e.target.checked)}
                            />{' '}
                            Confermo anche se il target resta <b>sotto la soglia minima di sicurezza</b>.
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                  {a.eseguitaDalServer ? (
                    <button
                      className={a.azione === 'blocca_piano' ? 'btn ghost sm' : 'btn sm'}
                      disabled={
                        azioneInCorso ||
                        (a.azione === 'blocca_piano' && azioni.pianoGiaFermo) ||
                        // ⚠️ Spento finché **tutte e tre** le condizioni del server non sono
                        // soddisfatte: premerlo a vuoto significherebbe farsi dire dal server una
                        // cosa che la pagina sapeva già. ⛔ Il motivo è obbligatorio per questa
                        // azione (lo rifiuta `eseguiAzione`), e prima la guardia guardava solo il
                        // numero: la pagina lasciava premere e il server rispondeva picche.
                        (a.chiedeUnNumero &&
                          (!(Number(pctAumento.replace(',', '.')) > 0) ||
                            !giorniValidi ||
                            notaAzione.trim().length < 3))
                      }
                      onClick={() => void eseguiAzione(a.azione)}
                    >
                      {a.azione === 'blocca_piano' && azioni.pianoGiaFermo ? 'Già fermo' : 'Fai questo'}
                    </button>
                  ) : (
                    <Link
                      className="btn ghost sm"
                      to={a.azione === 'apri_scheda' ? `/clienti/${azioni.clientId}` : `/chat?cliente=${azioni.clientId}`}
                      onClick={() => setAzioni(null)}
                    >
                      Vai
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn ghost" onClick={() => setAzioni(null)}>Chiudi</button>
          </div>
        </Modal>
      )}
    </>
  );
}
