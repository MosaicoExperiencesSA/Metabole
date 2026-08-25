/**
 * ⛔ **LA TERZA CONDIZIONE DEL §3 — quella che guarda le calorie vere, e che finora non calcolava
 * nessuno.**
 *
 * Il foglio decisioni dà tre condizioni per aprire una verifica alla nutrizionista su una cliente in
 * digiuno, e dice che la terza è **la migliore**: `restaCorta`, cioè *«anche coi moltiplicatori delle
 * porzioni al tetto, le calorie della giornata non arrivano al target»*.
 *
 * Le altre due guardano **il nome del protocollo** (20:4, 23:1) e **quanti pasti restano**. Questa
 * guarda quello che quella cliente **riceve davvero nel piatto**. Per tre giorni il codice ha detto
 * in tre punti diversi che mancava — `cambio-finestra.ts`, `verifica-digiuno.ts`, l'elenco lavori —
 * dichiarandolo invece di lasciarlo credere coperto. Questo file è il pezzo che mancava.
 *
 * ## ⛔ Perché nasce alla COMPOSIZIONE e non alla scelta
 *
 * La scelta della finestra (`impostaDigiuno`) non ha in mano né la dieta né il target: per dire
 * «con questa finestra resterai corta» dovrebbe **rifare il conto del motore**, e due conti sulla
 * stessa domanda divergono — è già successo due volte in questo progetto, fra il motore e
 * `diag:digiuni`. Alla composizione invece il conto è **già fatto**, sui pasti veri di quella
 * giornata, dopo la scalatura delle porzioni: `porzione-scalata.ts` torna `restaCorta`.
 *
 * ⚠️ Costa un giorno di ritardo — si sa quando il menu si compone, non quando lei tocca l'orologio —
 * e vale la pena: *una previsione che sbaglia è peggio di una misura che arriva domani*.
 *
 * ## ⚠️ NON riguarda solo il digiuno
 *
 * Il §3 parla di digiuno perché è lì che è nato, ma una giornata che resta corta col moltiplicatore
 * al tetto è corta anche per chi non digiuna: succede a chi ha degli spuntini tolti dalla
 * nutrizionista, o quando il catalogo non ha giornate nella banda. Restringere al digiuno vorrebbe
 * dire tacere sulle altre — e la cliente che riceve l'80% del suo target non sa di quale ramo del
 * codice sia figlia. ⚠️ Il **motivo** però si dice, perché la strada per chiuderlo è diversa.
 *
 * ## ⛔ Una per situazione, non una al giorno
 *
 * `deliverIfEligible` gira **a ogni apertura dell'app**. Un riferimento che cambia — la data, il
 * numero di giornate, la quota — farebbe nascere un'attività al giorno per la stessa identica cosa,
 * e *un avviso che compare sempre non è un avviso*. Il riferimento è la **situazione clinica**:
 * finestra + spuntini tolti. E basta. Vedi `riferimentoKcalCorte`.
 *
 * ## ⛔ E arriva a chi può chiuderla
 *
 * `TIPO_KCAL_CORTE` è dentro `TIPI_DELLA_NUTRIZIONISTA` (`avvisi-attivita.ts`), e da oggi la
 * nutrizionista l'elenco delle attività **lo può anche aprire** — prima le arrivava la push e la
 * pagina le rispondeva 403. Vedi la nota in `coach-tasks.controller.ts`.
 */

/**
 * ⛔ **LO SCOSTAMENTO LO CALCOLA IL MOTORE, non questo file** — vedi `meritaUnAvviso`.
 */
import { scostamentoPct } from '../menu/giornata-sotto-target';
import { oggiPiu } from '../common/date-only';

export const TIPO_KCAL_CORTE = 'kcal_restano_corte';

/**
 * ⛔ **`restaCorta` DA SOLO NON BASTA PER SVEGLIARE UNA PERSONA** (trovato in revisione, 22/8, e
 * misurato: **12,4%** delle giornate in cui nessun tetto morde).
 *
 * `porzione-scalata.ts` dichiara corta una giornata con `kcalDopo < target - 0.5`, e `kcalDopo` è la
 * **somma dei valori arrotondati per pasto**: quando il fattore uniforme centra il target in teoria,
 * la somma degli arrotondamenti ci cade sotto di un'inezia. Su 46.415 combinazioni provate, una su
 * otto risultava «corta» — con quote come **0,99946**.
 *
 * ⚠️ Finché era una riga di `logger.warn` non faceva danno. Come attività avrebbe prodotto
 * *«Maria: riceve il 100% del suo fabbisogno — 1 giornata resta sotto il fabbisogno»*: tre frasi che
 * si contraddicono nello stesso paragrafo, su quasi ogni cliente scalata, ogni settimana. *Un avviso
 * che compare sempre non è un avviso.*
 *
 * ⛔ **La soglia è quella che il motore usa già** (`menu_kcal_balance_tolerance_pct`, 15%), passata da
 * chi chiama. Non una costante nuova: due soglie sulla stessa domanda divergono in un pomeriggio — è
 * già scritto nell'elenco lavori come una cosa successa, non come un rischio.
 *
 * ⛔ **E nemmeno un CONTO nuovo** (corretto in revisione, 22/8). La prima stesura scriveva
 * `quota < 1 - tol/100`: stessa soglia, ma **seconda implementazione** della stessa domanda, a
 * cinquanta righe da `giornateSottoTarget` — che usa `scostamentoPct` (arrotondato al decimo di
 * punto) e protegge il caso non finito.
 *
 * ⚠️ **La divergenza, contata** (e la prima versione di questa nota l'aveva scritta al contrario,
 * con un numero inventato: corretta nella seconda revisione). Le due soglie non coincidono nella
 * banda **[0,8495 ; 0,85)**: a quota 0,8496 il motore calcola −15,0 e dice «dentro la tolleranza»,
 * la vecchia formula diceva «apri». Cioè questo file avrebbe aperto attività su giornate che il
 * motore, dieci righe sotto, considerava a posto — e su una domanda sola due risposte sono sempre
 * una di troppo, in qualunque verso. Adesso il conto è **quello del motore**, chiamato e non
 * ricopiato.
 */
export function meritaUnAvviso(quota: number, tolleranzaPct: number): boolean {
  if (!Number.isFinite(quota)) return false; // «non lo so» non è «è corta»
  const tolleranza = Number.isFinite(tolleranzaPct) ? Math.abs(tolleranzaPct) : 0;
  // ⛔ `scostamentoPct(quota, 1)` è **la stessa funzione** che decide `daily_kcal_below_target`
  // trenta righe più sotto in `menu.service.ts`: stessa aritmetica, stesso arrotondamento, stesso
  // verso del confronto. Vedi la nota qui sopra.
  return scostamentoPct(quota, 1) < -tolleranza;
}

export interface GiornataCorta {
  /** `2026-08-22`. */
  data: string;
  /** Quanto della giornata arriva a target: `0.82` = 82%. */
  quota: number;
  /** Gli slot già al tetto del moltiplicatore: oltre non si scala. */
  alTetto: string[];
}

export interface SituazioneCorta {
  /**
   * La finestra del digiuno, **come la legge il motore**: se `pathType` non è digiuno, la finestra
   * scritta in colonna non toglie niente a nessuno e qui non deve arrivare. Vedi la nota sul
   * chiamante in `menu.service.ts`.
   */
  finestra?: string | null;
  /**
   * Gli spuntini tolti dalla nutrizionista, **già filtrati a quelli che il motore toglie davvero**:
   * `slotEsclusiTotali` accetta solo `morning_snack` e `afternoon_snack`, e una riga scritta in
   * colonna che il motore ignora non è una causa — è un campo.
   */
  pastiEsclusi?: string[] | null;
}

/**
 * La peggiore delle giornate corte: è quella che si racconta.
 *
 * ⚠️ Si dice **la peggiore**, non la media: una media fra una giornata all'85% e una al 50% nasconde
 * la seconda dietro un numero che sembra accettabile, e la cliente quella giornata al 50% la mangia
 * per intero.
 */
export function laPiuCorta(giornate: GiornataCorta[]): GiornataCorta | null {
  if (!giornate.length) return null;
  return giornate.reduce((peggiore, g) => (g.quota < peggiore.quota ? g : peggiore));
}

/**
 * ⛔ **SI APRE O NO — e se no, si dice perché.**
 *
 * Tre motivi per non aprirla, e sono tutti e tre casi in cui aprirla farebbe **danno**, non solo
 * rumore. Stanno qui e non nel chiamante perché sono la stessa domanda («questa cliente ha un
 * problema di calorie?») e una domanda sparsa in due punti diventa due risposte.
 *
 *  1. **Nessuna giornata corta**: niente da dire.
 *  2. ⛔ **Le mancano dei pasti, e l'attività che lo dice è ancora aperta** (trovato in revisione,
 *     22/8). `digiuno_pasti_non_serviti` nasce
 *     nello stesso identico giro di `deliverIfEligible`, sullo stesso fatto visto da un'altra parte:
 *     se il catalogo non ha la colazione che la sua finestra promette, ovvio che le calorie non
 *     tornano. Aprirle tutte e due vuol dire mandare alla nutrizionista **due attività con due
 *     rimedi che si contraddicono** — «genera la variante mancante» e «dalle una dieta più
 *     sostanziosa» — sulla stessa cliente, nello stesso minuto. *Un fatto, un'attività.* Quella dei
 *     pasti vince perché dice **la causa**; questa direbbe solo l'effetto.
 *  3. ⛔ **È dentro la tolleranza**: vedi `meritaUnAvviso`. Il 12,4% delle giornate «corte» lo è per
 *     l'arrotondamento dei pasti, e un avviso che compare sempre non è un avviso.
 *
 * ⚠️ Il `perche` non è decorazione: chi chiama lo **scrive nel log**. *Se degradi, dillo* — senza,
 * fra sei mesi qualcuno guarda una cliente al 70% senza attività e non ha modo di sapere se il
 * codice ha deciso di tacere o si è rotto.
 */
export type EsitoApertura = { apri: true } | { apri: false; perche: string };

export function decisioneKcalCorte(dati: {
  peggiore: GiornataCorta | null;
  tolleranzaPct: number;
  pastiMancanti: readonly string[];
  /**
   * ⛔ **L'altra attività è ancora APERTA?** (aggiunto nella seconda revisione del 22/8.)
   *
   * Rimandare a `digiuno_pasti_non_serviti` ha senso finché quella è lì da leggere. Ma anche lei si
   * deduplica su `clientId+kind+refId` **senza guardare lo stato**: se la nutrizionista la segna
   * «fatta» senza generare la variante a catalogo, non rinasce mai più — e questa resterebbe muta
   * per sempre. Risultato: una cliente al 70% del target, zero attività, e due silenzi che si
   * tengono a vicenda.
   *
   * ⚠️ Quando quella è chiusa, questa torna a parlare: la nutrizionista ha deciso sui **pasti**,
   * non sulle **calorie**, e sono due domande.
   */
  altraAttivitaAperta: boolean;
}): EsitoApertura {
  if (!dati.peggiore) return { apri: false, perche: 'nessuna giornata resta corta' };
  if (dati.pastiMancanti.length && dati.altraAttivitaAperta) {
    return {
      apri: false,
      perche:
        `le manca ${dati.pastiMancanti.join(', ')} a catalogo: lo dice già l'attività `
        + `«pasti non serviti», che è la causa — questa sarebbe l'effetto, con un rimedio opposto`,
    };
  }
  if (!meritaUnAvviso(dati.peggiore.quota, dati.tolleranzaPct)) {
    return {
      apri: false,
      perche:
        `la peggiore è al ${Math.round(dati.peggiore.quota * 100)}%, dentro la tolleranza del `
        + `${dati.tolleranzaPct}%: «corta» qui è l'arrotondamento dei pasti, non un buco`,
    };
  }
  return { apri: true };
}

/**
 * ⛔ **IL RIFERIMENTO È LA SITUAZIONE CLINICA: finestra + spuntini tolti. E BASTA.**
 *
 * La prima stesura ci metteva dentro anche la **dieta servita** e la **quota arrotondata al 5%**.
 * Tutte e due sbagliate, e la revisione del 22/8 ha misurato quanto:
 *
 *  - ⛔ **la dieta servita no**: non è la dieta della cliente, è quella che esce dalla catena dei
 *    ripieghi. Cambia quando una gemella completa una giornata a catalogo — cioè per un motivo che
 *    alla cliente non cambia niente. `pasti-non-serviti.ts` l'aveva già escluso **con questa stessa
 *    motivazione scritta**, e io ho fatto il contrario nel file accanto;
 *  - ⛔ **la quota no**: oscilla a ogni erogazione **per costruzione**, perché la giornata è composta
 *    con ricette diverse. Una cliente stabile intorno all'82,5% avrebbe generato 80/85/80/85… cioè
 *    fino a **una decina di attività al mese** per lo stesso identico problema clinico.
 *
 * ⚠️ Cosa si perde: se la situazione peggiora senza cambiare finestra né spuntini, l'attività resta
 * quella di prima **col numero vecchio nel testo** (`apriAttivitaCoach` non riscrive la descrizione).
 * È il prezzo di non fare rumore, ed è il verso giusto in cui sbagliare: chi apre l'attività trova
 * una cliente da guardare, e i numeri di oggi si rileggono con `npm run diag:kcal` (⚠️ shell di
 * Render: è per noi, non è una cosa che si scrive nel testo dell'attività — vedi `testoKcalCorte`).
 *
 * ## ⛔ E UNA VOLTA CHIUSA NON TORNA — dichiarato, non nascosto
 *
 * `apriDavvero` cerca `clientId+kind+refId` **senza guardare lo stato**: chiusa quella coppia, non
 * rinasce mai più finché la finestra e gli spuntini restano quelli. Quindi se la nutrizionista fa
 * quello che il testo le consiglia — le alza il livello della dieta — e la giornata resta al 71%,
 * **nessuno riapre niente**. Lo stesso vale per il rinvio dei pasti mancanti: finché la variante a
 * catalogo manca, questa tace.
 *
 * ⛔ **Non si chiude mettendo il livello nella chiave**: `level` in `menu.service.ts` non è una
 * decisione clinica, è il `levelDelta` dell'agente dieta, che si muove da solo — metterlo lì
 * rifarebbe esattamente il difetto della quota (una manciata di attività al mese per lo stesso
 * problema). ⚠️ Perciò il verso giusto è **dirlo**: il testo dell'attività promette «non te la
 * ripropongo finché la situazione non cambia», che è vero alla lettera, e manda a
 * chiedere a noi i numeri aggiornati (`npm run diag:kcal`, shell di Render). La revisione periodica
 * di quell'elenco è a carico di chi guarda, e sta scritto qui invece di essere lasciato credere
 * automatico.
 */
export function riferimentoKcalCorte(situazione: SituazioneCorta): string {
  const finestra = situazione.finestra?.trim() || 'nessuna';
  const esclusi = [...(situazione.pastiEsclusi ?? [])].sort().join('+') || 'nessuno';
  return `${finestra}|${esclusi}`;
}

/**
 * ⛔ **PERCHÉ questa cliente resta corta** — e non è una sfumatura: le cause si chiudono in modi
 * diversi, e dire quella sbagliata manda la nutrizionista a lavorare dove non serve.
 *
 * ⚠️ Il caso «le mancano dei pasti a catalogo» **non è qui**: lì l'attività non si apre affatto, la
 * dice `digiuno_pasti_non_serviti`. Vedi `decisioneKcalCorte`.
 */
export type MotivoCorta = 'finestra' | 'spuntini_tolti' | 'finestra_e_spuntini' | 'catalogo';

export function motivoCorta(situazione: SituazioneCorta): MotivoCorta {
  const conFinestra = !!(situazione.finestra && situazione.finestra.trim());
  const conEsclusi = (situazione.pastiEsclusi ?? []).length > 0;
  if (conFinestra && conEsclusi) return 'finestra_e_spuntini';
  if (conFinestra) return 'finestra';
  if (conEsclusi) return 'spuntini_tolti';
  return 'catalogo';
}

const SPIEGAZIONE: Record<MotivoCorta, string> = {
  finestra:
    'La sua finestra di digiuno le toglie dei pasti, e quelli che restano — anche ingranditi fino al '
    + 'tetto — non ci arrivano.',
  spuntini_tolti:
    'Le sono stati tolti degli spuntini, e quelli che restano — anche ingranditi fino al tetto — non '
    + 'ci arrivano.',
  finestra_e_spuntini:
    'Fra la finestra di digiuno e gli spuntini che le sono stati tolti, quello che resta — anche '
    + 'ingrandito fino al tetto — non ci arriva.',
  catalogo:
    '⚠️ E NON dipende dalla finestra né dagli spuntini: non ne ha. È il catalogo che per lei non ha '
    + 'giornate abbastanza sostanziose: la strada è generare giornate più sostanziose per la sua '
    + 'famiglia di diete, non toccare le porzioni.',
};

/**
 * ⛔ **DA DOVE VIENE IL NUMERO — e chiamarlo «fabbisogno» quando non lo è era una bugia** (trovato
 * in revisione, 22/8).
 *
 * Il motore punta al **fabbisogno calcolato** solo quando il «menu a necessità» è acceso e il
 * profilo basta per calcolarlo (`targetSource === 'need'`). Negli altri casi punta alle **kcal del
 * livello dichiarate nella dieta** — un numero deciso a catalogo, che col fabbisogno di quella
 * persona può non c'entrare niente.
 *
 * ⚠️ Dirle «riceve il 68% del suo fabbisogno» quando il conto è sul livello manda la nutrizionista
 * a cercare un problema clinico dove c'è una dieta tarata bassa. *Una ragione falsa è peggio di un
 * ordine sbagliato.*
 */
export interface TargetDellaGiornata {
  kcal: number;
  fonte: 'need' | 'level';
}

const COME_SI_CHIAMA: Record<TargetDellaGiornata['fonte'], { corto: string; lungo: string }> = {
  need: { corto: 'del suo fabbisogno', lungo: 'il suo fabbisogno calcolato' },
  level: { corto: 'delle kcal previste dalla sua dieta', lungo: 'le kcal del livello della sua dieta' },
};

export interface TestoAttivita { title: string; description: string }

/**
 * Il testo che legge la nutrizionista.
 *
 * ⚠️ Dice **il numero**, non «è sotto target»: «il 68% del suo fabbisogno» è una cosa su cui si può
 * decidere, «sotto target» no. E dice **da quando è misurato**, perché è la differenza fra questa
 * condizione e le altre due del §3: quelle guardano il nome del protocollo, questa il piatto.
 *
 * ⛔ E dice cosa NON si può fare. Due cose, e tutte e due imparate sbagliando:
 *
 *  - **la finestra la sposta la cliente**, dall'app. Mandare la nutrizionista a cambiargliela è
 *    mandarla a cercare un comando che non esiste (stessa correzione del 21/8 sugli altri due testi);
 *  - ⛔ **i tetti delle porzioni NON sono roba sua** (revisione del 22/8). La prima stesura le
 *    diceva «alza i parametri porzione_tetto_*»: quei parametri non compaiono in **nessuna**
 *    schermata del backoffice, non stanno nelle Regole del motore, si cambiano solo da
 *    `PATCH /admin/config/:key` — che è admin — e sono **globali**, cioè toccarli per una cliente
 *    cambia il piatto a tutte. Era un consiglio che sembrava azionabile e non lo era: il modo più
 *    rapido di insegnare a chiudere le attività senza leggerle.
 */
export function testoKcalCorte(
  nome: string | null | undefined,
  peggiore: GiornataCorta,
  quante: number,
  situazione: SituazioneCorta,
  target: TargetDellaGiornata,
): TestoAttivita {
  const chi = (nome ?? '').trim() || 'la cliente';
  const pct = Math.round(peggiore.quota * 100);
  const motivo = motivoCorta(situazione);
  const nome_target = COME_SI_CHIAMA[target.fonte];
  const alTetto = peggiore.alTetto.length
    ? `Nella giornata peggiore (${peggiore.data}) ${peggiore.alTetto.length === 1 ? 'un pasto è' : `${peggiore.alTetto.length} pasti sono`} `
      + `già al tetto del moltiplicatore: oltre non si ingrandiscono.`
    : 'Nella giornata peggiore nessun pasto è al tetto: il buco viene da quanti pasti riceve, non da quanto sono grandi.';
  return {
    title: `${chi}: riceve il ${pct}% ${nome_target.corto}`,
    description:
      `⚠️ Misurato sul suo menu vero, non sul nome del protocollo: `
      + `${quante} giornat${quante === 1 ? 'a' : 'e'} rest${quante === 1 ? 'a' : 'ano'} sotto `
      + `${nome_target.lungo} (${Math.round(target.kcal)} kcal) anche dopo aver ingrandito le `
      + `porzioni fino al tetto. La peggiore è al ${pct}%. `
      + `${SPIEGAZIONE[motivo]} ${alTetto} `
      + `⚠️ Non è ferma e non è bloccata: i menu le arrivano, sono solo più leggeri di quanto le serve. `
      + `⛔ Non si chiude cambiandole la finestra — la sposta lei, dall'app — e nemmeno alzando i `
      + `tetti delle porzioni: quelli sono globali e li tocca solo l'amministratore, quindi per lei `
      + `non sono una strada. Quello che puoi fare tu: darle una dieta di livello più alto, generare `
      + `per la sua famiglia una giornata più sostanziosa a catalogo, o decidere che per lei va bene `
      + `così — in quel caso segna l'attività fatta e non te la ripropongo finché la situazione non `
      + `cambia. ⚠️ Se ti accorgi che non è solo lei ma tante clienti insieme, allora il discorso è `
      + `sui tetti delle porzioni e va fatto con Simone: l'elenco completo te lo tira fuori lui.`,
  };
}

/** Fra quanti giorni scade. ⚠️ Non è un'urgenza clinica: è una decisione da prendere, non da correre. */
export function scadenzaKcalCorte(adesso: Date, giorni = 7): Date {
  // ⚠️ È una **scadenza vista da oggi**, quindi il giorno è quello di Roma e la somma è in
  // millisecondi: `setDate` la faceva nel fuso del processo (25/8). Le altre scadenze delle attività
  // passano già da `oggiPiu` (`coach-tasks.service`): questa era rimasta fuori perché sta in un file
  // suo.
  return oggiPiu(giorni, adesso);
}
