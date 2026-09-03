import { Injectable, Logger } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { calcolaTargetKcal, spiegaTargetKcal, correzioneAttiva } from './correzione-kcal';
import { FINESTRA_MASSIMA, pesoDiAdesso } from '../signals/percentuale-obiettivo';
import {
  FINESTRA_GIORNI,
  SALTO_KG_DEFAULT,
  SALTO_RITMO_DEFAULT,
  SaltoImpossibile,
  saltoPeggiore,
  spiegaSalto,
} from '../signals/peso-incoerente';
import { pesateDaContare, pesoCheValeAlRientro } from '../signals/peso-al-rientro';
import { inizioDelPeriodoDi } from '../signals/quando-comincia-il-periodo';

/**
 * Fabbisogno calorico giornaliero della cliente (kcal/giorno), stimato dal profilo.
 *
 * Metodo: BMR con Mifflin-St Jeor (sesso, età, altezza, peso attuale) × fattore di attività,
 * poi — solo per l'obiettivo "dimagrimento" — si applica un deficit derivato dal RITMO di calo
 * dell'obiettivo (kg/settimana ≈ 7700 kcal/kg), con tetto massimo e SOGLIA MINIMA di sicurezza
 * (non si scende mai sotto una certa soglia in kcal). In "mantenimento" il target è il fabbisogno.
 *
 * Le costanti di sicurezza (soglie, tetti) sono configurabili via config_param. I fattori di
 * attività sono costanti standard (indicati sotto) e all'occorrenza spostabili in config.
 *
 * ⚠️ **Il tratto finale non sta più qui.** Dal §15.5 (11/8) il nutrizionista può scrivere a mano il
 * deficit e una correzione percentuale sul totale, e l'ordine in cui queste entrano — e quali soglie
 * valgono ancora quando ci sono — è una regola clinica che vive in `correzione-kcal.ts`, provata per
 * tabella. Qui si raccolgono i dati (fabbisogno, deficit dedotto, soglie, valori scritti a mano) e
 * si passano di là. Questo servizio parla al database; quel modulo decide.
 */

// Fattori di attività (PAL) per la domanda dedicata sull'attività fisica.
const ACTIVITY_FACTOR: Record<string, number> = {
  sedentary: 1.2, // poco/nessun movimento
  light: 1.375, // attività leggera 1-3 gg/sett
  moderate: 1.55, // moderata 3-5 gg/sett
  active: 1.725, // intensa 6-7 gg/sett
  very_active: 1.9, // molto intensa / lavoro fisico + sport
};
// Fallback dal campo "lavoro" (lifestyle.work) quando l'attività dedicata non è impostata.
const WORK_FACTOR: Record<string, number> = {
  sedentary: 1.3,
  standing: 1.5,
  shifts: 1.5,
  travel: 1.55,
};
const DEFAULT_FACTOR = 1.4;

export interface KcalEstimate {
  bmr: number;
  activityFactor: number;
  activitySource: 'activity' | 'work' | 'default';
  tdee: number; // fabbisogno di mantenimento
  target: number; // kcal/giorno consigliate (dopo deficit, correzioni e soglie)
  deficit: number; // kcal sottratte (0 in mantenimento)
  floored: boolean; // true se ha agito la soglia minima di sicurezza
  objective: string;
  /**
   * ⚠️ **La media mobile, non l'ultima pesata** (27/8). Chi lo mostra deve chiamarlo «peso di
   * adesso» e non «ultima pesata»: sono due numeri diversi sulla stessa persona, ed è la confusione
   * che il progetto ha già pagato in quattro punti.
   */
  weightKg: number;
  /**
   * ⛔ **DUE PESATE CHE NON POSSONO ESSERE DELLA STESSA PERSONA** (28/8, richiesta di Simone: *«se
   * succede una cosa simile arriva il blocco e deve intervenire la coach o il nutrizionista»*).
   *
   * Quando è valorizzato, `computeTargetKcal` risponde **`null`** e la cliente mangia il livello
   * della sua dieta: il fabbisogno personalizzato è sospeso finché una persona non guarda. ⚠️ Qui
   * dentro invece `target`, `deficit` e `tdee` restano **calcolati**, perché la scheda deve poter
   * mostrare *cosa uscirebbe* accanto al motivo per cui non lo stiamo usando — una card vuota è
   * indistinguibile da un guasto, e un guardrail che non si vede è un guardrail spento.
   */
  pesoIncoerente: (SaltoImpossibile & { frase: string }) | null;
  // --- §15.5: cosa ha scritto il nutrizionista, e cosa ne è uscito ---
  /** Da dove viene il deficit: scritto a mano, dedotto dal motore, o nessuno. */
  fonteDeficit: 'imposto' | 'calcolato' | 'nessuno';
  /** Il deficit che il motore avrebbe usato da solo: serve a mostrare il «prima» accanto al «dopo». */
  deficitCalcolato: number;
  /**
   * ⛔ **DUE COSE DIVERSE CHE `fonteDeficit: 'calcolato'` CHIAMAVA CON LO STESSO NOME** (28/8).
   *
   * Il deficit dedotto nasce in due modi che **hanno derivata di segno opposto** rispetto al peso:
   *  - `'ritmo'`   → viene dall'obiettivo: `(P − obiettivo)·7700/settimane`, quindi ∂/∂P **negativa**
   *                  e dominante (vedi il docblock qui sotto): più pesante ⇒ **meno** calorie;
   *  - `'default'` → è una percentuale del TDEE, che dal peso dipende **solo** via il TDEE: ∂/∂P
   *                  **positiva**. Più pesante ⇒ più calorie.
   *
   * ⚠️ Fino al 28/8 `diag:fabbisogno-media` stampava «calcolato» per entrambi, e la tabella mostrava
   * righe con la stessa etichetta di regime e lo scarto con segni opposti: chi la leggeva non poteva
   * che concludere che il conto fosse sbagliato. Non lo era — era l'etichetta a mettere insieme due
   * regimi. *Una ragione falsa è peggio di un ordine sbagliato.*
   */
  calcoloDeficit: 'ritmo' | 'default' | 'nessuno';
  /** La correzione percentuale sul totale, 0 se non impostata. */
  correzionePct: number;
  /** Il target sta SOTTO la soglia minima, per scelta esplicita del nutrizionista. */
  sottoSoglia: boolean;
  /** Il tetto ha tagliato il deficit dedotto (succede solo su quello dedotto). */
  tettoApplicato: boolean;
  /** Fino a quando vale la correzione (`null` = finché non la tolgono). */
  correzioneFinoAl: string | null;
  /** La correzione è scritta ma SCADUTA: il target è già tornato normale, e va detto. */
  correzioneScaduta: boolean;
  /** La frase che spiega il numero, già pronta per la scheda e per lo storico. */
  spiegazione: string;
}

@Injectable()
export class KcalNeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
  ) {}

  private readonly logger = new Logger(KcalNeedService.name);

  /**
   * Solo il target in kcal/giorno (o null se mancano i dati minimi). Usato dal generatore menu.
   *
   * ⛔ **E «NULL» ANCHE QUANDO LE PESATE NON STANNO IN PIEDI FRA LORO** (28/8).
   *
   * ⚠️ **Che cos'è «il blocco», per essere precisi.** Non è un cancello: la cliente non resta senza
   * menu, non le compare un popup, non deve fare niente. `null` qui dentro vuol dire che
   * `menu.service` non trova un fabbisogno e **tiene il livello della sua dieta** (`levelKcal`) —
   * lo stesso numero che mangia chi non si è mai pesata. Quello che si blocca è **la
   * personalizzazione**, cioè l'unico pezzo che dipende dal dato di cui non ci fidiamo.
   *
   * ⚠️ **Due precisazioni che i testi non possono contenere ma che qui vanno scritte** (secondo giro
   * di revisione): 1) con `menu_kcal_need_enabled` spento per quella dieta la cliente **mangiava
   * già** il livello, quindi lì non cambia niente e la segnalazione dice solo «guardate quei
   * numeri»; 2) `menu.service` accende DayCombo quando `targetSource === 'need'`, quindi con `null`
   * cambia anche **come** si compone la giornata, non solo quante kcal — a meno che DayCombo non sia
   * già acceso per conto suo. Per questo i testi dicono «i menu usano il livello della sua dieta» e
   * non «cambia quello che mangia»: la prima è vera sempre, la seconda no.
   *
   * ⛔ La regola di casa dice *un cancello chiuso costa a una cliente tutto il servizio*, e vale
   * anche qui: fermarle il menu perché **noi** abbiamo un numero sbagliato in banca dati sarebbe
   * farle pagare un nostro problema. E l'alternativa opposta — tirare avanti con la media di due
   * pesate che si contraddicono — è quella che mette in tavola cento o duecento kcal sbagliate al
   * giorno **senza che nessuno lo sappia**. Il livello della dieta è l'unica delle tre strade che
   * non inventa niente.
   *
   * ⚠️ Chi deve accorgersene lo sa da altre due parti, non da qui: la coach dalla sua coda
   * (`alerts.service`, avviso «Pesate incoerenti») e il nutrizionista da una segnalazione clinica
   * aperta alla pesata (`signals.service`). Questo metodo **non apre niente**: lo chiama anche il
   * dimensionamento del catalogo, su decine di clienti in fila, e un guardrail che scrive dentro un
   * conto di sola lettura è un guardrail che prima o poi qualcuno spegne.
   */
  async computeTargetKcal(
    clientId: string,
    opzioni?: { sullUltimaPesata?: boolean },
  ): Promise<number | null> {
    const est = await this.estimate(clientId, opzioni?.sullUltimaPesata ? { sullUltimaPesata: true } : undefined);
    if (!est) {
      /**
       * ⛔ **ANCHE QUESTO RAMO SCRIVE IL MOTIVO** (aggiunto in revisione, 28/8). Prima loggava solo
       * il ramo delle pesate incoerenti, e il kit di rientro — che diceva «il motivo è nella riga
       * sopra» — mandava a cercare una riga che nel caso più comune non esisteva.
       *
       * ⚠️ **`debug` e non `warn`, e la differenza è la quantità**: un profilo incompleto è lo stato
       * normale di ogni lead, e questo metodo gira su **fino a trecento clienti per taglia** a ogni
       * generazione del catalogo. A livello `warn` sarebbero trecento righe di allarme per una cosa
       * che non è un allarme — e il rumore spegne i log esattamente come una segnalazione di troppo
       * spegne una scrivania. L'altro ramo resta `warn`, perché lì una cliente **sta mangiando
       * diversamente da come dovrebbe**.
       */
      this.logger.debug(
        `Fabbisogno non calcolabile per ${clientId}: mancano sesso, età, altezza o un peso da cui partire.`,
      );
      return null;
    }
    if (est.pesoIncoerente) {
      this.logger.warn(
        `Fabbisogno NON personalizzato per ${clientId}: pesate incoerenti — ${spiegaSalto(est.pesoIncoerente)}. ` +
          'La cliente mangia il livello della sua dieta finché qualcuno non verifica le misure.',
      );
      return null;
    }
    return est.target;
  }

  /**
   * Stima completa (per backoffice/diagnostica). Null se mancano sesso/età/altezza/peso.
   *
   * `simulazione` serve al backoffice PRIMA di salvare: «se scrivo 450 di deficit, che numero le
   * arriva nel piatto?». Senza, l'unico modo di saperlo sarebbe salvare e guardare — cioè scoprire
   * di aver messo una cliente a 980 kcal dopo averla messa a 980 kcal.
   *
   * ⛔ **`sullUltimaPesata` NON è una simulazione, ed è per questo che sta fuori da quell'oggetto.**
   * Regola di Simone del 3/9, seconda metà: *«Sì esatto»* alla domanda se anche le porzioni del kit
   * di rientro debbano partire dall'ultima pesata invece che dalla tendenza. Il kit parte **perché**
   * l'ultima pesata è un salto, cioè proprio il dato che la media diluisce: riferimento 68, pesate
   * 68,2 / 68,0 / 71,0 → il kit partiva perché era salita di 3 chili e riporzionava come se ne
   * avesse ripresi 1,07.
   *
   * ⚠️ **È una scrittura, non un'anteprima**, e infatti `simulazione.pesoKg` resta quello che era —
   * un valore che solo la diagnostica passa. Mescolare le due cose in un campo solo vorrebbe dire
   * che «chi simula» e «chi decide» entrano dalla stessa porta, e la prima riga di quel docstring
   * smetterebbe di essere vera senza che nessuno se ne accorga.
   */
  async estimate(
    clientId: string,
    simulazione?: {
      deficitImposto?: number | null; correzionePct?: number | null; pesoKg?: number | null;
      sullUltimaPesata?: boolean;
    },
  ): Promise<KcalEstimate | null> {
    const profile = await this.prisma.clientProfile.findUnique({ where: { userId: clientId } });
    if (!profile) return null;
    const sex = profile.sex as 'female' | 'male' | null;
    const age = profile.age ?? null;
    const heightCm = profile.heightCm ?? null;
    if (!sex || !age || !heightCm) return null;

    /**
     * ⛔ **IL PESO DI ADESSO È LA MEDIA MOBILE, NON L'ULTIMA PESATA** (Simone, 27/8: «il fabbisogno
     * deve utilizzare la media mobile»).
     *
     * Era l'ultimo dei quattro punti che rispondevano in modo diverso alla domanda «quanto pesa
     * adesso»: gli altri tre sono passati alla tendenza il 19/8, e questo era rimasto indietro —
     * proprio quello dove il numero pesa di più, perché da qui escono **le calorie che una cliente
     * si trova nel piatto**. ⚠️ È la regola scritta del progetto: *si ragiona sempre sulla tendenza,
     * mai sul singolo dato* (spec 7.2).
     *
     * ⛔ **COSA CAMBIA DAVVERO, COI NUMERI — e non è quello che avevo scritto io** (corretto in
     * revisione, 27/8). La prima stesura di questo commento diceva «due etti di ritenzione le
     * spostavano il fabbisogno di un paio di kcal»: contava **solo il BMR**, nella stessa frase in
     * cui diceva che il peso entra due volte. Sbagliato per un fattore dieci, e **con il segno
     * sbagliato**.
     *
     * Il peso entra due volte, e le due entrate **tirano in direzioni opposte**:
     *
     *   TDEE      = (10·P + 6,25·H − 5·E ± c) · PAL        →  ∂/∂P = **+10·PAL**   (+12 … +19 kcal/kg)
     *   deficit   = (P − obiettivo) · kcalPerKg / settimane →  ∂/∂P = **−1100/settimane**
     *
     * cioè `∂target/∂P = 10·PAL − 1100/settimane`, che è **positiva solo oltre ~78 settimane** di
     * orizzonte. Su un piano vero (2–6 mesi) domina il secondo termine: **vederla più pesante vuol
     * dire darle MENO calorie.**
     *
     * ⚠️ **Conseguenza clinica, da guardare in faccia**: nel regime più comune — dimagrimento con un
     * obiettivo e una data, deficit non tagliato dal tetto — la media mobile è **prociclica**. Chi
     * cala in fretta ha la media *sopra* l'ultima pesata, e si vede tagliare ancora. Chi risale ha la
     * media *sotto*, e si vede aumentare il target proprio mentre riprende peso. ⛔ Negli altri
     * regimi (mantenimento, deficit di default, deficit imposto a mano, tetto che morde) il segno si
     * ribalta e la derivata torna positiva. **Non è un dettaglio di implementazione: è una scelta
     * clinica**, e il numero per giudicarla lo dà `npm run diag:fabbisogno-media` cliente per cliente.
     *
     * ⚠️ **I ripieghi restano quelli di prima, nell'ordine**: senza pesate recenti si usa il peso di
     * partenza del profilo; senza nemmeno quello non si stima niente (meglio «non lo so» che un
     * fabbisogno costruito su un peso inventato).
     */
    /**
     * ⛔ **SOLO LE PESATE RECENTI: una media di dati vecchi non è il peso di adesso** (27/8, in
     * revisione, ed era il caso che faceva il danno più grosso).
     *
     * `pesoDiAdesso` media le ultime N **righe**, non gli ultimi N **giorni**. Per una barra di
     * avanzamento va bene; qui decide il cibo. ⛔ Il caso: una cliente in monitoraggio si pesa a
     * 70,2 / 69,8 tre mesi fa, sospende, torna oggi a **76**. Con la finestra a tre la media dice
     * **72,0** — quattro chili sotto il vero — e le mette in tavola **cento kcal al giorno in più**
     * di quelle che le servono. È esattamente la cliente per cui esiste il kit di rientro.
     *
     * ⚠️ Novanta giorni non è un numero tondo scelto a caso: è la durata di un piano (dodici
     * settimane). Una pesata più vecchia del piano che stai facendo non racconta il corpo di adesso.
     *
     * ⚠️ **E se non ce n'è nessuna recente si prende l'ULTIMA, non la media delle vecchie**: di due
     * cose sbagliate, un dato vecchio è meno sbagliato della media di più dati vecchi — e resta il
     * ripiego del peso di partenza sotto.
     */
    const daQuando = new Date(Date.now() - FINESTRA_GIORNI * 86_400_000);
    const pesate = (await this.prisma.measurement.findMany({
      where: { clientId, date: { gte: daQuando } },
      orderBy: { date: 'desc' },
      take: FINESTRA_MASSIMA,
      // ⚠️ Anche `date`: dal 28/8 le stesse righe servono a controllare che **stiano in piedi fra
      // loro** (`peso-incoerente.ts`), e senza la data due pesate sono due numeri senza distanza.
      select: { date: true, weightKg: true },
    })) as { date: Date; weightKg: number }[];
    const ultimaPesata = pesate.length
      ? null
      : ((await this.prisma.measurement.findFirst({
          where: { clientId },
          orderBy: { date: 'desc' },
          select: { weightKg: true },
        })) as { weightKg: number } | null);
    const finestraMedia = await this.configParams.getNumber('moving_average_window', 3);

    /**
     * ⛔ **AL RIENTRO NON SI MEDIA COI PIANI PRECEDENTI** — regola di Simone, 3/9: *«quando uno
     * rientra noi consideriamo sempre il peso del giorno prima dell'inizio di quel momento e non
     * dei piani precedenti»*.
     *
     * La finestra sopra è di novanta giorni, cioè la durata di un piano. Chi sospende un mese e
     * torna, e si è ripesata **una o due volte**, si porta dentro la media una o due pesate del
     * piano di prima — il corpo di due mesi fa — e le calorie escono da una miscela di due periodi
     * che non si somigliano.
     *
     * ⚠️ **La media resta una media**: si fa sulle pesate del periodo nuovo, quante che siano.
     * ⛔ Una prima stesura ci aveva messo dentro anche una **soglia**: «sotto tre pesate dal
     * rientro si usa l'ultima invece della tendenza». Una revisione avversariale l'ha smontata, e
     * aveva ragione: **quella regola Simone non l'ha mai detta**, cambiava le calorie a chi non era
     * rientrato da niente, e legava un comportamento clinico alla casella
     * `moving_average_window` — cioè una taratura di smoothing che si muove per ragioni sue.
     * *Se una regola non è stata detta, non si scrive.*
     *
     * ⚠️ **La pesata di riferimento si tiene**, ed è quello che si usa finché non se ne fa una
     * nuova: è *«il peso del giorno prima dell'inizio di quel momento»*, alla lettera.
     *
     * ⛔ E se non si sa quando comincia il periodo (`null`) **non si taglia niente**: chi non ha mai
     * sospeso si comporta esattamente come prima. La regola sta in `signals/peso-al-rientro.ts`, la
     * data in `signals/quando-comincia-il-periodo.ts`.
     */
    const inizioPeriodo = await inizioDelPeriodoDi(
      this.prisma, clientId, new Date(), (m) => this.logger.warn(m),
    );
    // ⚠️ Il modulo le vuole dalla più vecchia alla più recente; la query le dà al contrario.
    const inOrdine = pesate.slice().reverse();
    let delPeriodo = pesateDaContare(inOrdine, inizioPeriodo);
    /**
     * ⛔ **IL RIFERIMENTO PUÒ STARE FUORI DALLA FINESTRA, ed è proprio il caso della regola.**
     *
     * Le righe caricate sopra sono di novanta giorni. Per una sospensione **più lunga di novanta
     * giorni** — cioè la cliente per cui questa regola è nata — l'ultima pesata prima del rientro
     * non è fra quelle, e `pesateDaContare` renderebbe `riferimento: null`. Il modulo promette il
     * contrario («è la sola cosa che si porta dietro»), e senza questa riga la promessa era falsa
     * proprio dove serviva. L'ha trovato una revisione avversariale.
     *
     * ⚠️ **Una query in più solo quando serve davvero**: c'è un rientro, e nella finestra non c'è
     * niente di prima.
     */
    if (inizioPeriodo && !delPeriodo.riferimento) {
      const prima = (await this.prisma.measurement.findFirst({
        where: { clientId, date: { lt: inizioPeriodo } },
        orderBy: { date: 'desc' },
        select: { date: true, weightKg: true },
      })) as { date: Date; weightKg: number } | null;
      if (prima) delPeriodo = { ...delPeriodo, riferimento: prima };
    }
    if (inizioPeriodo && delPeriodo.scartate > 0) {
      /**
       * ⚠️ *Niente tagli silenziosi.* Un fabbisogno calcolato su due pesate invece che su otto ha
       * un motivo, e chi legge i log dev'essere in grado di trovarlo. La prima stesura contava le
       * scartate e non le diceva a nessuno: il campo esisteva e non lo leggeva niente.
       */
      this.logger.debug(
        `Fabbisogno di ${clientId}: ${delPeriodo.scartate} pesate dei piani precedenti non contate ` +
        `(rientro del ${inizioPeriodo.toISOString().slice(0, 10)}).`,
      );
    }
    /**
     * ⛔ **`sullUltimaPesata` è la porta del kit di rientro, ed è l'unica cosa che salta la media.**
     * Regola di Simone, seconda metà: *«Sì esatto»* — anche le porzioni del kit partono dall'ultima
     * pesata. Il kit parte **perché** l'ultima pesata è un salto, cioè proprio il dato che la media
     * diluisce: trigger e porzioni guardavano due numeri diversi nella stessa esecuzione.
     */
    const media = simulazione?.sullUltimaPesata
      ? pesoCheValeAlRientro({ riferimento: null, delPeriodo: inOrdine, scartate: 0 })
      : (delPeriodo.delPeriodo.length
        ? pesoDiAdesso(delPeriodo.delPeriodo.map((m) => m.weightKg), finestraMedia)
        : pesoCheValeAlRientro(delPeriodo));
    /**
     * ⛔ **PRIMA DI MEDIARLE, CONTROLLA CHE STIANO IN PIEDI FRA LORO** (28/8).
     *
     * La media di due pesate che si contraddicono non è una tendenza: è la metà di due numeri di cui
     * uno è sbagliato, e ha l'aria di un numero buono. La regola e i suoi perché stanno in
     * `signals/peso-incoerente.ts`; qui c'è solo la conseguenza.
     *
     * ⚠️ **Su TUTTE le righe caricate — novanta giorni — non solo su quelle che entrano nella
     * media.** L'alternativa (guardare solo la fetta che `pesoDiAdesso` usa davvero) è più stretta e
     * sembra più giusta, ma sposta **quali clienti si bloccano** al variare di
     * `moving_average_window`: una casella dei Parametri che si muove per un altro motivo
     * accenderebbe e spegnerebbe un guardrail clinico. E soprattutto darebbe una risposta diversa da
     * quella che vede la coach nella sua coda, che quella fetta non la conosce. *Se due punti
     * rispondono alla stessa domanda, uno deve chiamare l'altro* — qui: una regola sola, una
     * finestra sola.
     *
     * ⚠️ **«Novanta giorni» è il tetto, non la finestra vera**: `take: FINESTRA_MASSIMA` prende al
     * massimo **trenta righe**, quindi per chi si pesa tutti i giorni si guardano trenta giorni e
     * per chi si pesa una volta a settimana tutti e novanta. Vale identico nei tre punti che fanno
     * questa domanda (qui, la coda della coach e la pesata salvata), che è la cosa che conta.
     *
     * ⚠️ Il prezzo, detto e non taciuto: un errore di battitura vecchio ma ancora dentro la finestra
     * tiene la cliente sul livello della sua dieta finché qualcuno non lo corregge. È il verso
     * giusto in cui sbagliare — si ripara una volta e non torna — ma è un costo vero, e chi legge i
     * log lo vede.
     */
    const [sogliaSalto, sogliaRitmo] = await Promise.all([
      this.configParams.getNumber('weight_jump_impossible_kg', SALTO_KG_DEFAULT),
      this.configParams.getNumber('weight_jump_impossible_kg_week', SALTO_RITMO_DEFAULT),
    ]);
    /**
     * ⚠️ **IL SALTO ATTRAVERSO IL RIENTRO NON SI GUARDA QUI, ed è una scelta.**
     *
     * La voce `pesate-lontane-buco-del-ritmo` chiede un secondo ramo: venti chili sbagliati dopo
     * venticinque giorni fanno 5,6 kg/settimana e con la regola normale **non scattano**. Una prima
     * stesura lo aveva aggiunto, giudicando il solo salto in chili e dicendo «nessuna soglia nuova:
     * riuso quella dei Parametri».
     *
     * ⛔ **Non era vero, ed è stato tolto.** Togliere la condizione sul ritmo *è* cambiare la
     * regola: `peso-incoerente.ts` scrive per esteso che la versione senza quella condizione era
     * già stata provata e buttata — «dieci chili in due mesi suonerebbero, ed è un percorso
     * riuscito, non un errore» — e che un guardrail che suona sul terzo delle clienti «non è
     * severo: è spento». La voce dice *«la soglia è clinica e non la scegliamo noi»*, e la risposta
     * di Simone del 3/9 dà il **riferimento** al rientro, non una soglia d'allarme.
     *
     * ⚠️ E c'era un secondo difetto, più concreto: il fabbisogno sarebbe diventato `null` **senza
     * che nessuno lo sapesse**. La coda della coach e la segnalazione al nutrizionista leggono
     * `saltoPeggiore`, non questo ramo — quindi la cliente sarebbe passata al livello della dieta
     * in silenzio, che è il contrario di quello che questo file promette due paragrafi più su.
     *
     * ▶️ La voce resta **aperta**, con la domanda stretta: *sopra quanti chili, attraverso una
     * sospensione, si smette di fidarsi del numero?*
     */
    const pesoIncoerente = saltoPeggiore(pesate, sogliaSalto, sogliaRitmo);
    /**
     * ⚠️ `simulazione.pesoKg` esiste per **mostrare il prima accanto al dopo**, come `deficitCalcolato`:
     * lo usa la diagnostica `diag:fabbisogno-media` per stampare, cliente per cliente, il target di
     * ieri e quello di oggi. ⛔ Nessun percorso che **scrive** lo passa, ed è la ragione per cui sta
     * dentro `simulazione` e non è un parametro a sé: chi simula lo vede, chi decide no.
     */
    const weightKg = simulazione?.pesoKg ?? media ?? ultimaPesata?.weightKg ?? profile.startWeightKg ?? null;
    if (!weightKg) return null;

    // Costanti di sicurezza (configurabili).
    const [floorF, floorM, deficitMaxPct, deficitMaxKcal, kcalPerKg, defaultDeficitPct] = await Promise.all([
      this.configParams.getNumber('kcal_need_floor_female', 1200),
      this.configParams.getNumber('kcal_need_floor_male', 1500),
      this.configParams.getNumber('kcal_need_deficit_max_pct', 0.3),
      this.configParams.getNumber('kcal_need_deficit_max_kcal', 1000),
      this.configParams.getNumber('kcal_need_kcal_per_kg', 7700),
      this.configParams.getNumber('kcal_need_default_deficit_pct', 0.15),
    ]);

    // BMR — Mifflin-St Jeor.
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);

    // Fattore di attività: prima l'attività dedicata, poi il lavoro, poi default.
    let activityFactor = DEFAULT_FACTOR;
    let activitySource: KcalEstimate['activitySource'] = 'default';
    const activityLevel = (profile as { activityLevel?: string | null }).activityLevel ?? null;
    const work = (profile.lifestyle as { work?: string } | null)?.work ?? null;
    if (activityLevel && ACTIVITY_FACTOR[activityLevel]) {
      activityFactor = ACTIVITY_FACTOR[activityLevel];
      activitySource = 'activity';
    } else if (work && WORK_FACTOR[work]) {
      activityFactor = WORK_FACTOR[work];
      activitySource = 'work';
    }

    const tdee = bmr * activityFactor;
    const objective = profile.objective ?? 'dimagrimento';

    // Deficit dedotto, SENZA tetti: i tetti li mette `calcolaTargetKcal`, perché è lì che si sa se
    // il deficit è dedotto o prescritto — e su quello prescritto non vanno messi.
    let deficitCalcolato = 0;
    // ⚠️ **Quale dei due**, e non solo «calcolato»: le due strade hanno derivata di segno opposto
    // rispetto al peso (il perché sta su `calcoloDeficit`, nell'interfaccia qui sopra).
    let calcoloDeficit: KcalEstimate['calcoloDeficit'] = 'nessuno';
    if (objective !== 'mantenimento') {
      const rateDeficit = await this.deficitFromObjectiveRate(clientId, weightKg, kcalPerKg);
      // Se non ho un ritmo valido dall'obiettivo, uso un deficit di default (percentuale del TDEE).
      deficitCalcolato = Math.max(0, rateDeficit != null ? rateDeficit : tdee * defaultDeficitPct);
      calcoloDeficit = rateDeficit != null ? 'ritmo' : 'default';
    }

    const p = profile as {
      kcalDeficitOverride?: number | null;
      kcalAdjustPct?: number | null;
      kcalAdjustUntil?: Date | null;
    };
    /**
     * ⚠️ LA CORREZIONE SCADE (14/8, risposta di Nocanty: «del 10% per 7 giorni e poi riprendi col
     * normale ritmo»). La scadenza si guarda QUI, al momento del calcolo: nessun cron azzera il
     * campo, e il valore resta scritto — spento — per chi apre la scheda dopo.
     * ⚠️ La simulazione del backoffice non passa da qui: sta chiedendo «se scrivessi questo», e
     * quello che scriverebbe parte oggi.
     */
    const correzioneDelProfilo = correzioneAttiva(p.kcalAdjustPct ?? null, p.kcalAdjustUntil ?? null);
    /**
     * ⛔ **«STO SIMULANDO IL DEFICIT» NON È «MI È ARRIVATO UN OGGETTO»** (27/8, in revisione).
     *
     * Qui c'era `simulazione ? … : …`, cioè il **puntatore** all'oggetto: bastava passare
     * `estimate(id, { pesoKg })` — che del deficit non dice niente — perché il deficit scritto a mano
     * dal nutrizionista (§15.5) e la correzione percentuale **sparissero in silenzio**. ⛔ E non era
     * ipotetico: ci è inciampata la diagnostica di questa stessa consegna, che stampava «il target
     * di ieri» calcolato **senza la prescrizione clinica** — proprio sulle clienti che qualcuno sta
     * seguendo di persona, e sbagliando per eccesso, e mettendole in cima all'elenco perché ordina
     * per scarto. Lo strumento nato per misurare prima di decidere avrebbe raccontato una bugia
     * grossa dieci volte, esattamente dove la decisione conta.
     *
     * Adesso «sto simulando» vuol dire che chi chiama ha nominato **quei** campi.
     */
    const simulaDeficit = !!simulazione && ('deficitImposto' in simulazione || 'correzionePct' in simulazione);
    const esito = calcolaTargetKcal({
      tdee,
      deficitCalcolato,
      deficitImposto: simulaDeficit ? simulazione!.deficitImposto ?? null : p.kcalDeficitOverride ?? null,
      correzionePct: simulaDeficit ? simulazione!.correzionePct ?? null : correzioneDelProfilo,
      soglia: sex === 'male' ? floorM : floorF,
      tettoDeficitPct: deficitMaxPct,
      tettoDeficitKcal: deficitMaxKcal,
    });

    const frase = spiegaTargetKcal(esito, tdee, {
      finoAl: p.kcalAdjustUntil ?? null,
      scaduta: !!p.kcalAdjustPct && !!p.kcalAdjustUntil && correzioneDelProfilo === 0,
      pctScritta: p.kcalAdjustPct ?? null,
    });

    return {
      bmr: Math.round(bmr),
      activityFactor,
      activitySource,
      tdee: Math.round(tdee),
      target: esito.target,
      deficit: esito.deficit,
      floored: esito.sogliaApplicata,
      objective,
      weightKg,
      /**
       * ⚠️ **La frase viaggia col dato**, invece di lasciare che ogni schermata se la ricomponga:
       * il riquadro del backoffice l'aveva riscritta a mano e le date gli uscivano in ISO, cioè
       * proprio il formato che questa consegna ha appena tolto dai testi per le persone. *Se due
       * punti rispondono alla stessa domanda, uno deve chiamare l'altro.*
       */
      pesoIncoerente: pesoIncoerente ? { ...pesoIncoerente, frase: spiegaSalto(pesoIncoerente) } : null,
      fonteDeficit: esito.fonteDeficit,
      deficitCalcolato: Math.round(deficitCalcolato),
      calcoloDeficit,
      correzionePct: esito.correzionePct,
      sottoSoglia: esito.sottoSoglia,
      tettoApplicato: esito.tettoApplicato,
      correzioneFinoAl: p.kcalAdjustUntil ? p.kcalAdjustUntil.toISOString().slice(0, 10) : null,
      // Scritta ma non più attiva: il numero è già tornato normale da solo, e chi guarda la scheda
      // deve poterlo capire senza rifare i conti a mente.
      correzioneScaduta: !!p.kcalAdjustPct && !!p.kcalAdjustUntil && correzioneDelProfilo === 0,
      /**
       * ⚠️ **Quando le pesate non stanno in piedi, la frase lo dice PRIMA di tutto il resto** — e
       * dice anche che questo numero *non è quello che la cliente sta mangiando*. Senza, la scheda
       * mostrerebbe un target preciso al kcal che nessuno le sta servendo: il modo più elegante di
       * far prendere una decisione clinica su un numero che non esiste.
       */
      spiegazione: pesoIncoerente
        ? `⚠️ Pesate incoerenti (${spiegaSalto(pesoIncoerente)}): o una delle due è sbagliata, oppure è ` +
          'successo qualcosa da guardare. Finché non sono verificate questo target NON viene usato: i menu ' +
          'usano il livello della sua dieta. ' +
          frase
        : frase,
    };
  }

  /**
   * Deficit giornaliero (kcal) dal ritmo di calo dell'obiettivo: (kg da perdere / settimane
   * rimaste) × 7700 / 7. Ritorna null se non c'è un obiettivo con peso target e data futura.
   */
  private async deficitFromObjectiveRate(clientId: string, weightKg: number, kcalPerKg: number): Promise<number | null> {
    const obj = await this.prisma.objective.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: { targetWeightKg: true, targetDate: true },
    });
    if (!obj?.targetWeightKg || !obj.targetDate) return null;
    const kgToLose = weightKg - obj.targetWeightKg;
    if (kgToLose <= 0) return null; // già a target o sotto: nessun deficit
    const msLeft = obj.targetDate.getTime() - Date.now();
    const weeksLeft = msLeft / (7 * 86_400_000);
    if (weeksLeft < 1) return null; // scadenza passata/troppo vicina: non forzo un deficit dal ritmo
    const ratePerWeek = kgToLose / weeksLeft; // kg/settimana
    return (ratePerWeek * kcalPerKg) / 7; // kcal/giorno
  }
}
