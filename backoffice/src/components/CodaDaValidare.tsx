import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Banner, Modal } from './ui';

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
  azioni: { azione: string; etichetta: string; cosaFa: string; eseguitaDalServer: boolean }[];
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
        { method: 'POST', body: JSON.stringify({ azione, note: notaAzione.trim() || undefined }) },
      );
      const fatto = azione === 'blocca_piano'
        ? 'Piano messo in pausa: i giorni nuovi non partono, quelli già ricevuti restano alla cliente.'
        : 'Autorizzazione registrata: il calcolo del calo riparte da adesso.';
      setNotice(esito?.avviso ? `${fatto} ⚠️ ${esito.avviso}` : fatto);
      setAzioni(null);
    } catch (err) {
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
              «Presa visione» e «Correggi…» scrivono la stessa cosa: `reviewOutcome`, chi e quando, e
              una riga di registro. ⚠️ **La proposta del motore non viene applicata**, nemmeno
              confermata: `reviewDecision` non azzera `flaggedForReview`, e il menu legge solo le
              decisioni non segnalate. Il pulsante si chiamava «Conferma», che è la parola con cui si
              dice «fallo»: chi lo premeva credeva di aver applicato qualcosa. ⛔ Farlo applicare
              davvero è bloccato sul numero di Nocanty — di quanto si alzano le calorie — e non è una
              decisione di software.
            */}
            <div className="muted" style={{ fontSize: 11, margin: '0 0 6px', lineHeight: 1.4 }}>
              Questi due pulsanti <b>registrano che l'hai letta</b>: la proposta del motore non viene
              applicata al piano in nessuno dei due casi. Per cambiare davvero il piano si passa dalla
              scheda della cliente.
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

          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {azioni.azioni.map((a) => (
              <div key={a.azione} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 11 }}>
                <div className="spread" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 14 }}>{a.etichetta}</b>
                    <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 3 }}>{a.cosaFa}</div>
                  </div>
                  {a.eseguitaDalServer ? (
                    <button
                      className={a.azione === 'blocca_piano' ? 'btn ghost sm' : 'btn sm'}
                      disabled={azioneInCorso || (a.azione === 'blocca_piano' && azioni.pianoGiaFermo)}
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

          {/*
            La nota è facoltativa ma sta SOPRA i pulsanti: se fosse dopo, si scriverebbe dopo aver
            già premuto. Finisce nell'audit e, per il blocco, è il motivo che resta scritto sul
            piano — cioè quello che leggerà chi troverà quel piano fermo fra tre giorni.
          */}
          <label style={{ display: 'block', marginTop: 12, fontSize: 13 }}>
            Nota (facoltativa, resta nello storico)
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

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn ghost" onClick={() => setAzioni(null)}>Chiudi</button>
          </div>
        </Modal>
      )}
    </>
  );
}
