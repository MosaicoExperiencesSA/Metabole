import { randomUUID } from 'crypto';
import { puoStareNelloSlot, slotDaChiedere, slotDaCuiPescare } from '../common/slot-pasto';
import { poolDalPassato, type GiornataDelPassato } from '../catalog/pool-dal-passato';
import { GIORNI_DELLA_FINESTRA, carneRestante } from './carne-quante-volte';
import { verdettoPescetariano } from '../catalog/paniere-pescetariano';
import { coppiaDellaGiornata } from './coppia-pranzo-cena';
import { slotDaComporre } from './struttura-della-giornata';
import { leggiSorgente, poolPerSlot, ricetteDelPool, righeDalPaniere, righeDalleGiornate } from '../catalog/pool-del-paniere';
import { FAMIGLIA_RITORNO_IN_EQUILIBRIO, paniereDellaVariante } from '../catalog/appartenenza-panieri';
import { apriSegnalazione } from '../escalations/apri-segnalazione';
import { giornateComplete, NOME_PASTO, slotPieni } from '../catalog/giornate-complete';
import { apriAttivitaCoach } from '../coach-tasks/porta-delle-attivita';
import {
  TIPO_KCAL_CORTE,
  decisioneKcalCorte,
  laPiuCorta,
  riferimentoKcalCorte,
  scadenzaKcalCorte,
  testoKcalCorte,
} from '../coach-tasks/kcal-restano-corte';
import {
  TIPO_PASTI_NON_SERVITI,
  riferimentoPastiNonServiti,
  scadenzaPastiNonServiti,
  testoPastiNonServiti,
} from '../coach-tasks/pasti-non-serviti';
import { attendeIlViaLiberaClinico, statoSupervisione, type ProfiloDaSupervisionare } from '../clients/via-libera-clinico';
import { riparaGiornate } from './ripara-giornata';
import { cercaUnAlternativa } from './cerca-un-alternativa';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../calendar/events.service';
import { DietMatchProfile, pickDietFor } from '../catalog/pick-diet';
import { pastiPromessiCheMancano } from '../catalog/struttura-per-digiuno';
import { attivoInCorso } from '../commerce/abbonamento-in-corso';
import { STATI_CON_UN_PIANO } from '../commerce/stati-abbonamento';
import { statoViaggioAttivo } from '../common/stato-viaggio';
import { giornoDiRientro, periodoLeggibile, rientroInArrivo } from '../pause/giorno-di-rientro';
import { TIPO_PESATA_DEL_RIENTRO, mancaLaPesataDelRientro, testoPesataDelRientro } from './pesata-del-rientro';
import { ConfigParamsService } from '../config-params/config-params.service';
import { AgentState, DietAgentService } from '../diet-agent/diet-agent.service';
import { eGiornoDiConforto } from './plateau';
import { RULE_CODE_ESCLUSIONI, ricetteVietate, terminiVietati } from '../vera/regola-dieta';
// §16.9: una funzione, non un servizio iniettato — vedi il commento in `food-swaps.module.ts`.
import { registraSostituzione } from '../food-swaps/registra-sostituzione';
import { PushService } from '../notifications/push.service';
import { provaAttivata } from '../commerce/prova-attivata';
import { PrismaService } from '../prisma/prisma.service';
import { giornoDelDato, toDateOnly } from '../common/date-only';
import { quotaProteicaMinima } from './correzione-kcal';
// La tabella unica delle finestre del digiuno: slot saltati, etichette e pasto principale.
import { finestraCheAgisce, slotEsclusiTotali, spuntiniTolti } from './finestre-digiuno';
// Il controllo che mancava: una giornata sotto il fabbisogno oggi esce identica a una giusta.
import { TETTI_PREDEFINITI, porzioniScalate } from './porzione-scalata';
import { aggregaSpesa, conservaSpuntati, stessaLista } from './lista-della-spesa';
import { SOLO_STELLE_DATE } from './stelle-che-contano';
import { giornateSottoTarget, laPeggiore } from './giornata-sotto-target';
import { DayComboService, RecipeInfo } from './day-combo.service';
import { fraseAiutoEsclusioni, problemiEsclusioni } from '../common/esclusioni-scritte-bene';
/**
 * L'inizio del motivo delle segnalazioni «Piano bloccato» che nascono **dalla composizione del
 * menu**. È una costante e non una stringa scritta due volte perché tre punti la usano per
 * riconoscere la stessa riga: chi la apre, chi ne aggiorna il motivo e chi la chiude quando il
 * blocco rientra. Quelle della **base personalizzata** cominciano diversamente, ed è voluto: sono
 * un'altra causa e le chiude un'altra funzione.
 */
export const MOTIVO_BLOCCO_MENU =
  'Piano bloccato: i menu contengono ingredienti incompatibili con le esclusioni della cliente';

import { expandExclusion, hitsExclusion } from './exclusions';
import {
  EsclusioniCliente,
  ProfiloConEsclusioni,
  esclusioniDi,
  ricetteNonSicure,
  valutaRicetta,
} from './esclusioni-della-cliente';
import { KcalNeedService } from './kcal-need.service';
import { mancaMisuraDiPartenza } from './misura-di-partenza';
import { combaciaAlimento } from '../common/nomi-alimento';
import { corsaDiGiornate, dateDaComporre } from './buchi-nel-calendario';
import {
  GRUPPO_GRASSI,
  comeConvertire,
  leggiFattori,
  quantitaEquivalente,
  type FattoriGrassi,
} from './grassi-equivalenti';
import { IngredienteRicetta, MealSnapshot, SOSTITUTO_ASSENTE, Substitution } from './pasto-giornata';
import { EsitoSpezia, classificaSpezia } from './spezie';
import { punteggioRicetta, type PesiPunteggio } from './punteggio';

/**
 * Erogazione del menu (spec sez. 8):
 * - il menu diventa visibile menu_visible_days_before_start giorni prima dell'inizio piano;
 * - erogazione menu_days_delivered giorni alla volta;
 * - i giorni successivi si sbloccano DOPO il check-in del giorno.
 * La scelta dieta+livello qui è deterministica (match sul profilo);
 * dal M5 sarà il motore a decidere (source_rule_id).
 */
/**
 * Quanti giorni di menu tornano al client in una sola richiesta. È un tetto al peso della
 * risposta (ogni giorno porta con sé lo snapshot dei pasti), non un limite del percorso: la
 * finestra scorre e prende i giorni PIÙ RECENTI, così oggi e i giorni già erogati in avanti
 * ci sono sempre, quanto lungo sia il piano. Per lo storico completo servono `from`/`to`.
 */
const MENU_WINDOW_DAYS = 30;

/**
 * La dieta come la usa l'EROGAZIONE: i campi che servono a scegliere le giornate e a servirle.
 *
 * Dichiarata a mano e non dedotta da Prisma perché nel sandbox il client è uno stub: senza, la
 * variabile arriva come `unknown` e il compilatore smette di controllare i campi proprio nella
 * funzione che li usa tutti. `levels` resta `unknown` perché qui si passa a chi lo interpreta
 * (il target calorico), non si legge.
 */
interface DietaPerErogazione {
  id: string;
  name?: string | null;
  regime?: string | null;
  style?: string | null;
  mealsPerDay?: number | null;
  fasting?: boolean | null;
  objective?: string | null;
  levels?: unknown;
}

/**
 * Una giornata del catalogo, per l'erogazione.
 *
 * Dichiarata a mano per la stessa ragione di `DietaPerErogazione`, ma qui c'è un motivo in più:
 * `soloGiornateComplete` può restituire le giornate di **un'altra dieta** (la gemella), quindi la
 * variabile deve avere un tipo che vale per entrambe. Lasciandola inferire da Prisma, il tipo
 * diventava quello esatto della prima query e il riassegno non compilava — in sandbox non si vedeva
 * perché il client è uno stub, in produzione ha fatto fallire il build (11/8).
 */
interface TemplateGiornata {
  id?: string;
  dayIndex?: number;
  dietId?: string;
  level?: number;
  meals?: unknown;
}

/** Override numerico per dieta: usa il valore per-dieta se numerico, altrimenti il globale. */
function pickNumOverride(overrides: Map<string, number | boolean>, code: string, global: number): number {
  const v = overrides.get(code);
  return typeof v === 'number' ? v : global;
}
/** Override booleano per dieta: usa il valore per-dieta se booleano, altrimenti il globale. */
function pickBoolOverride(overrides: Map<string, number | boolean>, code: string, global: boolean): boolean {
  const v = overrides.get(code);
  return typeof v === 'boolean' ? v : global;
}

/** Quello che l'app legge in cima alla schermata del menu. */
export interface StatoMenu {
  state: string;
  availableFrom: string | null;
  planStartDate: string | null;
  /** Solo a visita **scaduta**: il giorno entro cui andava fatta, `AAAA-MM-GG`. Dice da quando si è fermato. */
  visitaEntro?: string;
  /** Visita ancora da fare, ma **non** scaduta: la cliente riceve i menu, e questo è il promemoria. */
  visitaDaFareEntro?: string;
  /** Il primo giorno di dieta dopo una sospensione (modalità viaggio). Solo negli stati di sospensione. */
  returnDate?: string | null;
}

/**
 * ⛔ **QUANTE GIORNATE DAVANTI BASTANO PERCHÉ NON SE NE COMPONGANO ALTRE.**
 *
 * Due: oggi e domani. ⚠️ Non è un numero scelto a occhio — è **esattamente** la vecchia regola
 * `if (ultima.date > oggi) return []` riscritta in modo che non si possa più imbrogliare con una
 * data sparsa in fondo al calendario: «ha almeno un giorno oltre oggi» e «ha due giornate di
 * seguito da oggi» sono la stessa frase, finché il calendario non ha buchi.
 *
 * ⚠️ **E NON si lega a `menu_days_delivered`** — la revisione avversariale del 25/8 ha misurato
 * cosa succede se lo si fa: con quel parametro a 1 (sta in `config_param`, si cambia dal backoffice
 * senza deploy) «ha una giornata di seguito» sarebbe vera già col solo menu di **oggi**, e la
 * cliente non avrebbe mai il menu del giorno dopo — niente spesa la sera prima. La regola vecchia
 * non guardava quel parametro, e cambiarne il significato di nascosto non è quello che è stato
 * chiesto: qui si riempiono i buchi, il resto della cadenza resta com'era.
 */
export const GIORNATE_DAVANTI_CHE_BASTANO = 2;


@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
    private readonly events: EventsService,
    private readonly dietAgent: DietAgentService,
    private readonly dayCombo: DayComboService,
    private readonly kcalNeed: KcalNeedService,
    private readonly push: PushService,
  ) {}

  /**
   * Menu visibile della cliente; prova a erogare i giorni successivi se ha diritto.
   *
   * FINESTRA: si restituiscono gli ULTIMI `MENU_WINDOW_DAYS` giorni visibili — cioè
   * oggi, i giorni già erogati in avanti e lo storico recente — non i primi.
   * Prima la query era `orderBy: date asc` con `take: 30` e nessun limite inferiore:
   * appena una cliente superava i 30 giorni erogati riceveva i 30 giorni PIÙ VECCHI e
   * il giorno di oggi restava fuori dalla pagina. La Home cerca esattamente la data di
   * oggi (`days.find(d => d.date === iso)`) e non trovandola mostrava "menu in
   * preparazione", la pagina Menu non aveva nessun giorno "in arrivo" da selezionare, e
   * `menuStatus` — che riceve `hasVisibleMenu` calcolato su questi stessi giorni —
   * confermava lo stato sbagliato. Da fuori sembrava che i menu non venissero generati:
   * erano in tabella, ma fuori finestra. Ordinando al contrario i giorni futuri sono
   * sempre dentro, perché sono i più recenti.
   */
  async getMenu(clientId: string, from?: string, to?: string) {
    const delivered = await this.deliverIfEligible(clientId);
    const today = toDateOnly();

    // Un solo oggetto `date`: con due spread separati il secondo sovrascriveva il primo
    // e passando sia `from` sia `to` il limite inferiore veniva perso senza errori.
    const dateRange = {
      ...(from ? { gte: toDateOnly(from) } : {}),
      ...(to ? { lte: toDateOnly(to) } : {}),
    };
    const menuDays = await this.prisma.menuDay.findMany({
      where: {
        clientId,
        visibleFrom: { lte: today }, // rispetta visible_from
        ...(from || to ? { date: dateRange } : {}),
      },
      orderBy: { date: 'desc' }, // i più recenti: oggi e il futuro non escono mai dalla finestra
      take: MENU_WINDOW_DAYS,
    });
    menuDays.reverse(); // l'app si aspetta i giorni in ordine crescente
    await this.segnaVisti(menuDays as { id: string; viewedAt: Date | null }[]);
    const blocked = await this.dietBlock(clientId);
    const status = await this.menuStatus(clientId, menuDays.some((d) => d.date.getTime() >= today.getTime()));
    // NB: restituiamo sempre tutti i giorni della finestra (lo STORICO recente resta
    // leggibile anche a piano scaduto). Il "menu di oggi" in dashboard viene nascosto
    // lato app quando `status.state === 'expired'`, ma la cronologia resta consultabile.
    return { delivered, days: menuDays, blocked, status };
  }

  /**
   * ⛔ **LA CLIENTE HA APERTO QUESTO GIORNO** — il segnale vero (26/8, voce
   * `visto-non-vuol-dire-aperto`).
   *
   * ⚠️ **Fa due cose, e la seconda è quella che rende sicura tutta la correzione.** Scrive
   * `apertoDallaClienteIl` sul giorno, e la **prima volta in assoluto** scrive `apertureDal` sul
   * profilo: da quell'istante sappiamo che il suo telefono ce lo dice. Prima di quell'istante un
   * giorno «non aperto» vuol dire «non lo so», e non si tocca — è il motivo per cui chi ha una
   * versione vecchia dell'app non rischia di vedersi cambiare un menu che ha già letto.
   *
   * ⚠️ **Si scrive solo la PRIMA volta** (`apertoDallaClienteIl: null` nel filtro): serve sapere
   * quando l'ha aperto, non quante volte. E l'app questa rotta la chiama a ogni cambio di giorno.
   *
   * ⚠️ **Non lancia mai.** Se questa scrittura fallisce, la cliente non deve accorgersene: al
   * massimo un giorno resterà «non lo so» e nessuno lo rifarà — il degrado dalla parte giusta.
   * L'errore però si scrive nei log: una colonna che smette di popolarsi in silenzio farebbe
   * tornare il difetto senza che nessuno capisca perché. ⛔ E `PrismaClientValidationError` si
   * scrive a livello **error**, non warn: vuol dire che la colonna non esiste — migrazione non
   * applicata, o client generato vecchio — cioè che **nessuna** apertura si sta registrando e la
   * correzione dei menu è ferma per tutte. Un warn ogni tanto passa inosservato; questo no.
   *
   * ## ⚠️ E se una cliente la chiamasse su tutti i suoi giorni?
   *
   * Si prenderebbe tutti i suoi menu futuri come «già aperti» e nessuno glieli rifarebbe più da
   * solo. **Non è un buco di sicurezza ed è la parte innocua del rischio**: sta dichiarando una cosa
   * sui **suoi** menu, e l'unico effetto è conservativo — «non cambiarmeli». La coach e la
   * nutrizionista continuano a rifarglieli a mano da «Rigenera menu», che non guarda questo campo.
   * ⚠️ Il limite vero è `visibleFrom`: si segna solo quello che l'app aveva il permesso di
   * mostrarle, la stessa condizione di `getMenu`. Un giorno che non ha mai potuto vedere non lo può
   * dichiarare aperto.
   */
  async segnaGiornoAperto(clientId: string, giornoIso: string): Promise<void> {
    return this.segnaGiorniAperti(clientId, [toDateOnly(giornoIso)], giornoIso);
  }

  /**
   * Gli stessi due passi per **più giorni insieme**: due sole andate al database invece di due per
   * giorno. ⚠️ È la strada della lista della spesa, che di giorni ne consegna sette.
   */
  async segnaGiorniAperti(clientId: string, giorni: Date[], perILog = ''): Promise<void> {
    if (!giorni.length) return;
    try {
      await this.prisma.menuDay.updateMany({
        where: {
          clientId,
          date: { in: giorni },
          apertoDallaClienteIl: null,
          visibleFrom: { lte: toDateOnly() },
        } as never,
        data: { apertoDallaClienteIl: new Date() } as never,
      });
      /**
       * ⚠️ `apertureDal` si scrive **solo se non c'è già**: è la data da cui sappiamo, e una data che
       * si riscrive a ogni apertura non è una data — sposterebbe in avanti il confine e i giorni
       * composti ieri tornerebbero «non lo so» per sempre.
       */
      await this.prisma.clientProfile.updateMany({
        where: { userId: clientId, apertureDal: null } as never,
        data: { apertureDal: new Date() } as never,
      });
    } catch (err) {
      const testo = err instanceof Error ? err.message : String(err);
      const colonnaMancante = err instanceof Error && err.name === 'PrismaClientValidationError';
      const quali = perILog || giorni.map((g) => g.toISOString().slice(0, 10)).join(', ');
      const riga = `Apertura del giorno ${quali} non registrata per ${clientId}: ${testo}`;
      if (colonnaMancante) {
        this.logger.error(
          `${riga} — sembra che le colonne \`aperto_dalla_cliente_il\`/\`aperture_dal\` non ci siano: ` +
            'migrazione non applicata o client Prisma vecchio. Finché è così NESSUNA apertura viene ' +
            'registrata e i menu già preparati non si rifanno per nessuna cliente.',
        );
      } else {
        this.logger.warn(riga);
      }
    }
  }

  /**
   * SEGNA I GIORNI COME **MOSTRATI** (`viewedAt`) — e da qui in poi vuol dire solo quello.
   *
   * Sta QUI perché `getMenu` è l'unico punto in cui i giorni escono verso l'app: un solo posto da
   * ricordare, invece di un evento da emettere da ogni schermata.
   *
   * ⛔ **NON dice «l'ha aperto», e per un anno è stato letto così** (corretto il 26/8, voce
   * `visto-non-vuol-dire-aperto`): questa funzione segna **tutti** i giorni della finestra — trenta,
   * futuri compresi — quindi bastava che la cliente aprisse l'app una volta perché tutto il suo
   * futuro risultasse «visto». Chi deve sapere se un menu si può ancora rifare guarda
   * `apertoDallaClienteIl`, che lo scrive `segnaGiornoAperto` qui sotto su un giorno solo. Due
   * domande, due campi: questo resta perché «gliel'abbiamo mostrato» è vero e qualcuno lo legge.
   *
   * ⚠️ Tre precauzioni, tutte per lo stesso motivo — questa funzione gira a OGNI apertura dell'app:
   *  - si scrive solo la PRIMA volta (`viewedAt: null` nel filtro): serve sapere quando gliel'abbiamo
   *    mostrato, non quante volte;
   *  - se non c'è niente da segnare non si tocca il database, e nel caso normale non c'è niente;
   *  - un errore qui non deve MAI impedire a una cliente di leggere il suo menu. Il menu è il
   *    lavoro vero, questa è la cronaca.
   */
  private async segnaVisti(giorni: { id: string; viewedAt: Date | null }[]): Promise<void> {
    const daSegnare = giorni.filter((g) => !g.viewedAt).map((g) => g.id);
    if (!daSegnare.length) return;
    try {
      await this.prisma.menuDay.updateMany({
        where: { id: { in: daSegnare }, viewedAt: null } as never,
        data: { viewedAt: new Date() } as never,
      });
    } catch (err) {
      this.logger.warn(
        `Giorni non segnati come visti (${daSegnare.length}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Stato del menu per la dashboard cliente: serve a spiegare — quando il menu non è
   * ancora visibile — PERCHÉ e QUANDO arriverà, così la cliente non pensa che l'app sia
   * rotta. Non ha effetti collaterali (non eroga nulla).
   *
   * Stati:
   * - `expired`         → nessun abbonamento attivo (prova/piano scaduto o annullato):
   *                       "nessun piano attivo", il menu non si mostra;
   * - `available`       → ci sono giorni di menu visibili (nessun messaggio da mostrare);
   * - `awaiting_visit`  → percorso supervisionato (screening): il menu dipende dalla
   *                       visita col nutrizionista → messaggio dedicato;
   * - `scheduled`       → idoneo ma non ancora nella finestra: `availableFrom` = data in
   *                       cui il menu diventa visibile → "Il tuo menu arriverà il …";
   * - `awaiting_measures` → prova gratuita senza misure iniziali (punto A mancante);
   * - `paused`          → periodo senza dieta attivo;
   * - `blocked`         → piano in sistemazione col nutrizionista (esclusioni);
   * - `preparing`       → idoneo ora / data non ancora impostata: menu in preparazione.
   */
  async menuStatus(clientId: string, hasVisibleMenu?: boolean): Promise<StatoMenu> {
    const stato = await this.componiStatoMenu(clientId, hasVisibleMenu);

    /**
     * ⛔ **LA VISITA DA FARE SI DICE ANCHE PRIMA CHE SCADA** (23/8, richiesta di Simone).
     *
     * In quella finestra la cliente riceve i menu normalmente — quindi legge «il tuo menu è pronto»,
     * o niente — e non sa che c'è una data oltre la quale si ferma tutto. Il blocco le arriverebbe
     * addosso come un guasto.
     *
     * ⚠️ **Non è uno stato: è un campo accanto.** Farne uno stato vorrebbe dire togliere di mezzo la
     * frase che la cliente sta già leggendo — «il tuo piano parte il 3», «serve la tua pesata» — per
     * sostituirla con un promemoria. Sono due cose vere insieme, e chi disegna l'app decide come
     * metterle vicine.
     *
     * ⚠️ E si aggiunge **dopo**, in un posto solo: `componiStatoMenu` ha otto uscite, e appendere il
     * campo su ognuna sarebbe stato il modo di dimenticarlo su una — quella che poi capita.
     */
    const supervisione = statoSupervisione(await this.profiloSupervisione(clientId));
    /**
     * ⚠️ **Solo dove i menu scorrono.** La prima stesura appendeva il campo a qualunque stato, e su
     * un piano scaduto l'app mostrava — una sopra l'altra — «fino a quel giorno i menu arrivano
     * normalmente» e «il tuo piano è terminato». Il promemoria dice una cosa vera solo per chi i
     * menu li sta ricevendo o li sta per ricevere: sugli altri stati è una frase falsa con una data
     * dentro.
     */
    const MENU_SCORRONO = ['available', 'scheduled', 'preparing', 'awaiting_measures', 'awaiting_cycle_measure'];
    if (supervisione.motivo === 'visita_da_fare' && MENU_SCORRONO.includes(stato.state)) {
      return { ...stato, visitaDaFareEntro: supervisione.visitaEntro };
    }
    return stato;
  }

  /**
   * Il profilo che serve a `via-libera-clinico`.
   *
   * ⚠️ È la **seconda** lettura del profilo in questa richiesta (`componiStatoMenu` fa la sua): due
   * query piccole sulla stessa riga, per non far viaggiare il profilo attraverso le otto uscite di
   * `componiStatoMenu`. Possono divergere solo se la decisione cambia **durante** la richiesta, e il
   * danno massimo è una card e un avviso in disaccordo per il tempo di un refresh.
   */
  private async profiloSupervisione(clientId: string) {
    return (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      /**
       * ⚠️ `as never` su `select`, come in mezzo file: il client Prisma si rigenera nella pipeline
       * (`npx prisma generate` prima di `npm run build`), quindi in sandbox la colonna nuova non
       * esiste ancora nei tipi. È la CI a fare il controllo vero su questa riga.
       */
      select: { screeningFlag: true, idoneita: true, idoneitaVisitaEntro: true } as never,
    })) as { screeningFlag: boolean | null; idoneita: string | null; idoneitaVisitaEntro: Date | null } | null;
  }

  private async componiStatoMenu(
    clientId: string,
    hasVisibleMenu?: boolean,
  ): Promise<StatoMenu> {
    const today = toDateOnly();
    const profile = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { planStartDate: true, screeningFlag: true, idoneita: true, idoneitaVisitaEntro: true, planHeldAt: true } as never,
    })) as {
      planStartDate: Date | null; screeningFlag: boolean | null; idoneita: string | null;
      idoneitaVisitaEntro: Date | null; planHeldAt: Date | null;
    } | null;
    const planStartDate = profile?.planStartDate ? profile.planStartDate.toISOString().slice(0, 10) : null;

    /**
     * 0) ACCESSO AL MENU: serve un piano comprato ed entro il periodo. Se la cliente ha avuto un
     * piano ma ora è scaduto/annullato — e non è in pausa/viaggio — il menu NON si mostra: stato
     * `expired` («nessun piano attivo» / percorso concluso).
     *
     * Il controllo su `endDate` serve perché il cron di scadenza può girare in ritardo: un piano
     * con la fine già passata è concluso anche se lo stato dice ancora `active`.
     *
     * ⚠️ **`STATI_CON_UN_PIANO` e non `'active'`** (19/8, voce 258): da quando un piano che comincia
     * più avanti nasce `queued`, una cliente che compra oggi con partenza lunedì ha **una riga
     * sola**, in coda. Con il confronto vecchio non era né attiva né in attesa, quindi qui usciva
     * `expired` — e l'app le scriveva «il tuo piano è terminato, riattiva un piano dal Negozio» il
     * giorno stesso in cui aveva pagato. Chi ha comprato ha un piano: quando comincia lo dice il
     * passo 5, con la data.
     */
    const subs = (await this.prisma.subscription.findMany({
      where: { clientId },
      // ⚠️ `startDate` serve al passo 5 (la finestra si misura sul piano che eroga davvero) e `id`
      // al passo 4-bis, per rileggere il piano SCELTO invece di uno qualsiasi.
      // ⚠️ `plan.period` sta qui e non in una query a parte: il ramo del Monitoraggio (passo 4-bis)
      // deve parlare del piano SCELTO, e sceglierlo due volte con due query è il modo in cui le due
      // risposte divergono.
      select: { id: true, status: true, startDate: true, endDate: true, plan: { select: { period: true } } },
    })) as { id: string; status: string; startDate: Date | null; endDate: Date | null; plan: { period: string | null } | null }[];
    const hasActivePlan = subs.some(
      (s) =>
        (STATI_CON_UN_PIANO as readonly string[]).includes(s.status) &&
        (!s.endDate || s.endDate.getTime() >= today.getTime()),
    );
    const hasPendingPlan = subs.some((s) => s.status === 'pending');
    if (subs.length > 0 && !hasActivePlan && !hasPendingPlan) {
      const pauseNow = await this.events.activePausePeriod(clientId);
      if (!pauseNow) return { state: 'expired', availableFrom: null, planStartDate };
    }

    // 1) Menu già visibile (oggi o nei prossimi giorni): nessun messaggio.
    const visible =
      hasVisibleMenu ??
      Boolean(
        await this.prisma.menuDay.findFirst({
          where: { clientId, visibleFrom: { lte: today }, date: { gte: today } },
          select: { id: true },
        }),
      );
    if (visible) return { state: 'available', availableFrom: null, planStartDate };

    /**
     * 2) Percorso supervisionato: il menu dipende dalla visita col nutrizionista.
     *
     * ⛔ **E lo dice `attendeIlViaLiberaClinico`, non `screeningFlag` da solo** (23/8). Questa riga
     * guardava lo screening della registrazione e basta: una cliente con «Può proseguire» scritto
     * sulla scheda continuava a leggere «il menu sarà pronto dopo la visita», **per sempre**, perché
     * `screeningFlag` non lo riazzera nessuno. Trovato su Gianluca, con le due schermate aperte
     * nello stesso momento che dicevano due cose diverse.
     */
    const supervisione = statoSupervisione(profile);
    /**
     * ⚠️ **E la card dice DA QUANDO e PERCHÉ.** Un blocco che non si spiega sembra un guasto, e la
     * cliente che telefona si sente rispondere «non lo so» anche da chi le risponde. `visitaEntro`
     * porta il giorno: sotto è il termine da rispettare, sopra è il giorno da cui il percorso si è
     * fermato. È la stessa data, e le due frasi la usano in due modi diversi.
     */
    if (supervisione.bloccata) {
      return {
        state: 'awaiting_visit',
        availableFrom: null,
        planStartDate,
        ...(supervisione.motivo === 'visita_scaduta' ? { visitaEntro: supervisione.visitaEntro } : {}),
      };
    }

    // 3) Senza data di inizio piano non c'è ancora una data da mostrare.
    if (!profile?.planStartDate) return { state: 'preparing', availableFrom: null, planStartDate: null };

    /**
     * 4) PERIODO SENZA DIETA ATTIVO — e da oggi il banner dice **quando si riprende** (23/8).
     *
     * Prima qui usciva `paused` e basta, e l'app scriveva «il menu riprende automaticamente al tuo
     * rientro»: vero, e inutile. La cliente in vacanza la domanda che si fa è *quando*, e la
     * risposta ce l'avevamo in mano — è la data che l'operatrice ha scritto nella casella.
     *
     * `availableFrom` qui è **il giorno in cui il menu compare**, non il giorno di rientro: con
     * l'anticipo di un giorno sono due date diverse (il menu arriva il 23, la dieta riprende il
     * 24), ed è la stessa distinzione che il passo 5 fa alla partenza di un piano. `returnDate` è
     * il rientro vero.
     *
     * ⚠️ E se la finestra è già aperta ma manca la pesata, lo stato **non** è `paused`: sarebbe la
     * stessa bugia gentile del 13/8 su Giusy («in preparazione» a chi è trattenuta da un cancello).
     * Il menu non arriva finché non si pesa, e va detto con le sue parole.
     */
    const pause = await this.events.activePausePeriod(clientId);
    if (pause) {
      // Stesso ripiego dell'erogazione: se le date non si leggono lo stato resta «in pausa», senza
      // le due date, invece di far fallire la schermata.
      if (!periodoLeggibile(pause)) return { state: 'paused', availableFrom: null, planStartDate };
      const anticipoRientro = await this.configParams.getNumber('menu_visible_days_before_return', 1);
      const rientro = giornoDiRientro(pause);
      // ⚠️ `Math.floor` come in `rientroInArrivo`: il parametro è modificabile dal pannello, e con
      // un 1,5 il banner annuncerebbe un giorno di sblocco diverso da quello in cui il menu arriva.
      const siSblocca = new Date(rientro.getTime() - Math.max(0, Math.floor(anticipoRientro)) * 86_400_000);
      const inFinestra = Boolean(rientroInArrivo(pause, new Date(), anticipoRientro));
      const base = {
        availableFrom: siSblocca.toISOString().slice(0, 10),
        planStartDate,
        returnDate: rientro.toISOString().slice(0, 10),
      };
      /**
       * ⛔ **`awaiting_cycle_measure` E NON UNO STATO NUOVO** (23/8, corretto in revisione).
       *
       * Uno stato che l'app non conosce cade nel suo `default: return null`, cioè **nessun
       * banner**: la cliente avrebbe aperto una schermata vuota, senza il motivo e senza il
       * pulsante per inserire la pesata. E le modifiche all'app arrivano solo con una
       * pubblicazione o una OTA, quindi ci sarebbe stato un ordine di rilascio obbligato — cioè
       * un difetto che aspetta il primo che pubblica al contrario.
       *
       * Questo stato invece l'app lo conosce già («Serve la tua pesata», col pulsante). Il testo
       * specifico del rientro lo fa `returnDate`: chi ha l'app nuova legge la data, chi ha la
       * vecchia legge la frase generica — che è vera lo stesso.
       */
      if (inFinestra && (await mancaLaPesataDelRientro(this.prisma, clientId, rientro, anticipoRientro))) {
        return { state: 'awaiting_cycle_measure', ...base };
      }
      return { state: 'paused', ...base };
    }
    /**
     * ⛔ **IL GIORNO DEL RIENTRO, SENZA PESATA** (seconda revisione, 23/8). La sospensione non è
     * più attiva, quindi il ramo qui sopra non si attraversa — ma il cancello della pesata del
     * rientro in `deliverIfEligible` sì, e senza questo ramo la cliente cadeva su «Menu in
     * preparazione»: la stessa bugia gentile del caso Giusy, mentre le push le dicono «pesati e
     * trovi subito il menu». Stesso stato del ramo sopra, con la data.
     */
    {
      const giorniPerCicloRientro = await this.configParams.getNumber('menu_days_delivered', 2);
      const appenaFinita = await this.events.pausaAppenaFinita(clientId, giorniPerCicloRientro);
      if (appenaFinita && periodoLeggibile(appenaFinita)) {
        const anticipoRientro = await this.configParams.getNumber('menu_visible_days_before_return', 1);
        const rientro = giornoDiRientro(appenaFinita);
        if (await mancaLaPesataDelRientro(this.prisma, clientId, rientro, anticipoRientro)) {
          return {
            state: 'awaiting_cycle_measure',
            availableFrom: null,
            planStartDate,
            returnDate: rientro.toISOString().slice(0, 10),
          };
        }
      }
    }

    // 4-bis) MONITORAGGIO: qui i menu non arrivano, e va detto — non lasciato intendere.
    // Senza questo ramo la cliente restava su «Menu in preparazione», che è una bugia gentile:
    // aspetta qualcosa che non arriverà, e prima o poi scrive alla coach per un guasto che non
    // c'è. Meglio una frase che spiega cosa sta pagando, e che i menu tornano al rientro.
    /**
     * ⚠️ **`attivoInCorso` e non un `findFirst` senza `orderBy`** (19/8, seconda revisione). Due
     * righe sulla stessa cliente sono legittime — un Monitoraggio che eroga e un piano alimentare in
     * coda — e senza ordinamento il database ne restituiva **una a caso**: metà delle volte questa
     * schermata diceva «Menu in preparazione» a chi è in Monitoraggio (dove i menu non arriveranno
     * mai), e metà «monitoring» a chi aspetta il piano alimentare. Chi decide qual è il piano di
     * adesso è una funzione sola, la stessa dell'erogazione.
     */
    const pianoDiAdesso = attivoInCorso(subs);
    if (pianoDiAdesso?.plan?.period === 'monitoring') {
      return { state: 'monitoring', availableFrom: null, planStartDate };
    }

    // 5) Idoneo ma troppo presto: mostro la data in cui il menu comparirà.
    const visibleDaysBefore = await this.configParams.getNumber('menu_visible_days_before_start', 2);
    /**
     * ⚠️ La finestra è quella del **piano che eroga**, non della data scritta nel profilo: su una
     * cliente con un piano in corso e uno comprato in coda `planStartDate` è la partenza della coda
     * (la riallinea `finalizeApproval` dal 10/8), e questa schermata le diceva «il menu comparirà
     * fra due mesi» mentre il piano che sta pagando è ancora suo. Stessa correzione e stessa
     * ragione di `deliverIfEligible`: le due devono rispondere uguale.
     */
    const inizioDelPiano = pianoDiAdesso?.startDate ?? profile.planStartDate;
    const start = toDateOnly(inizioDelPiano.toISOString());
    const visibleFrom = new Date(start.getTime() - visibleDaysBefore * 86_400_000);
    const availableFrom = visibleFrom.toISOString().slice(0, 10);
    if (today.getTime() < visibleFrom.getTime()) {
      return { state: 'scheduled', availableFrom, planStartDate };
    }

    // 6) MISURE INIZIALI (punto A): per QUALSIASI piano attivo, se manca la misura di partenza
    // DI QUESTO PIANO il menu resta trattenuto e l'app mostra il popup misure (bloccante).
    // Prima qui si contavano le misure di sempre (`count({ clientId })`): una cliente con
    // pesate di tre settimane prima passava il gate senza che nessuno le chiedesse niente, e i
    // menu partivano. Vedi `misura-di-partenza.ts`.
    const activeSubscription = await this.prisma.subscription.findFirst({
      // ⚠️ Anche in coda: la misura di partenza si chiede dentro la finestra di visibilità, cioè
      // PRIMA che il piano cominci. Chiedendola solo a piano partito si perde il primo giorno.
      where: { clientId, status: { in: STATI_CON_UN_PIANO as never } },
      select: { id: true },
    });
    if (activeSubscription) {
      // La finestra del punto A è la stessa della visibilità: una pesata fatta dentro quella
      // finestra è di questo piano, una fatta prima è di un'altra storia.
      if (await mancaMisuraDiPartenza(this.prisma, clientId, inizioDelPiano, visibleDaysBefore)) {
        return { state: 'awaiting_measures', availableFrom: null, planStartDate };
      }
    }

    /**
     * 6-bis) PIANO FERMATO DAL NUTRIZIONISTA. Sta **prima** di `blocked` di proposito: se sono
     * accesi tutti e due, quello che descrive la situazione vera è questo — una persona ha deciso
     * di fermare i giorni nuovi — mentre l'altro parla di esclusioni alimentari.
     *
     * E soprattutto ha un testo **onesto**. Il vecchio `blocked` dice alla cliente «la nutrizionista
     * sta sistemando il tuo menu per rispettare le tue esclusioni», che quando il piano è fermo per
     * un calo troppo rapido è semplicemente falso: le fa credere a un problema di ingredienti e la
     * lascia ad aspettare un menu che non arriverà finché non la si sente.
     */
    if (profile?.planHeldAt) return { state: 'plan_held', availableFrom: null, planStartDate };

    // 7) Piano in sistemazione col nutrizionista (esclusioni non sostituibili).
    const block = await this.dietBlock(clientId);
    if (block.active) return { state: 'blocked', availableFrom: null, planStartDate };

    /**
     * 7-bis) LA PESATA DEL CICLO — lo stato che mancava, e la bugia che ne usciva.
     *
     * Fin qui esisteva un solo controllo sulle misure in questa funzione: quello sulla misura di
     * PARTENZA (punto 6). Il cancello che trattiene i giorni nuovi a metà percorso è un altro —
     * `cycleNeedsMeasure`, dentro `deliverIfEligible` — e nessuno lo raccontava. Chi ci finiva
     * dentro cadeva nel punto 8 e leggeva **«Menu in preparazione — arriverà a breve»**: una frase
     * falsa, perché non arriva niente finché non si pesa. E siccome è falsa, la cliente aspetta,
     * poi scrive alla coach per un guasto che non c'è.
     *
     * Trovato il 13/8 su Giusy, che dopo lo sblocco è rimasta ferma su quel messaggio per un giorno
     * intero. Vale la pena notare che lo stesso buco c'era anche in `diag:cliente`, cioè nello
     * strumento che serve proprio a rispondere alla domanda «perché non riceve il menu?».
     */
    const giorniPerCiclo = await this.configParams.getNumber('menu_days_delivered', 2);
    const ultimoGiorno = (await this.prisma.menuDay.findFirst({
      where: { clientId },
      orderBy: { date: 'desc' },
      select: { date: true },
    })) as { date: Date } | null;
    if (ultimoGiorno && (await this.cycleNeedsMeasure(clientId, ultimoGiorno, giorniPerCiclo))) {
      return { state: 'awaiting_cycle_measure', availableFrom: null, planStartDate };
    }

    // 8) Idoneo ora ma nessun giorno ancora: si sta preparando, comparirà a breve.
    return { state: 'preparing', availableFrom: null, planStartDate };
  }

  /**
   * Eroga i prossimi N giorni se le condizioni sono soddisfatte.
   * Ritorna i giorni creati (vuoto se non c'era nulla da erogare).
   */
  async deliverIfEligible(clientId: string): Promise<string[]> {
    const [daysPerDelivery, visibleDaysBefore] = await Promise.all([
      this.configParams.getNumber('menu_days_delivered', 2),
      this.configParams.getNumber('menu_visible_days_before_start', 2),
    ]);
    const profile = await this.prisma.clientProfile.findUnique({ where: { userId: clientId } });
    if (!profile?.planStartDate) return []; // senza data di inizio niente menu

    /**
     * ⛔ **LA SCADENZA DELLA VISITA FERMA L'EROGAZIONE, NON SOLO LA CARD** (23/8, seconda revisione).
     *
     * La prima stesura aveva messo il controllo solo in `menuStatus`: la card diceva «i menu sono in
     * pausa» ma QUI nessuno lo sapeva, e i giorni continuavano a generarsi — quindi il menu restava
     * visibile, lo stato restava `available`, e **nemmeno la card compariva mai**. La frase scritta
     * nella nota clinica, nella scheda, nell'attività e nell'app era falsa da cima a fondo.
     *
     * ⚠️ **Solo `visita_scaduta`, e non `mai_valutata` — di proposito.** Questo cancello non c'è mai
     * stato: le clienti in screening senza decisione hanno sempre ricevuto i menu da qui (il blocco
     * viveva solo nella card). Chiuderlo anche per loro fermerebbe **oggi, in silenzio**, persone che
     * stanno mangiando — un blocco nuovo deciso di rimbalzo. Se va chiuso, lo decide Simone con
     * Lucia: voce `mai-valutata-eroga-lo-stesso`.
     *
     * ⚠️ I giorni **già consegnati non si ritirano**: può averci fatto la spesa. Si smette di
     * generarne di nuovi — al massimo due giorni di coda, poi la card con la data.
     */
    if (statoSupervisione(profile as ProfiloDaSupervisionare).motivo === 'visita_scaduta') {
      this.logger.warn(`Erogazione ferma per ${clientId}: la visita col nutrizionista è scaduta senza rivalutazione.`);
      return [];
    }

    /**
     * Il piano alimentare si genera SOLO con abbonamento attivo (approvazione bonifico).
     *
     * ⚠️ `findMany` + `attivoInCorso`, e non `findFirst`: qui c'era `findFirst({status:'active'})`
     * **senza `orderBy`**. Due righe `active` sulla stessa cliente sono legittime — una eroga,
     * l'altra è in coda con l'inizio nel futuro — e senza ordinamento il database ne restituisce
     * una **a caso**. Da questa riga escono «piano concluso?» e `planEnd`, cioè **fino a che giorno
     * arrivano i menu**: quanti giorni riceveva una cliente con due piani dipendeva dall'ordine
     * delle righe nella tabella. Adesso la scelta è per date, la stessa che fa la scheda.
     */
    const attivi = (await this.prisma.subscription.findMany({
      /**
       * ⚠️ **Si leggono anche i piani in coda** (19/8, voce 258), e la scelta la fa `attivoInCorso`
       * come prima. Fino a ieri la coda era scritta `active` con la partenza nel futuro, quindi
       * entrava qui da sola: è così che i menu si compongono nei giorni di **anteprima**
       * (`menu_visible_days_before_start`) prima che il piano cominci. Leggendo solo `active`, una
       * cliente il cui unico piano è in coda non riceveva più niente fino al giorno d'inizio — e
       * siccome il gate delle misure sta dopo la finestra, avrebbe perso anche il primo giorno.
       *
       * ⚠️ Un piano in coda **non anticipa niente**: la finestra di visibilità qui sotto
       * (`today < visibleFrom`) resta il solo cancello, e un piano che parte fra un mese non compone
       * un bel niente.
       */
      where: { clientId, status: { in: STATI_CON_UN_PIANO as never } },
      include: { plan: { select: { priceCents: true, period: true } } },
    })) as ({ startDate: Date | null; endDate: Date | null; status: string; plan: { priceCents: number; period: string | null } | null } & Record<string, unknown>)[];
    const activeSubscription = attivoInCorso(attivi);
    if (!activeSubscription) return [];

    // MONITORAGGIO (€19/mese): **non è un piano alimentare**, e fin qui riceveva gli stessi
    // identici menu del Mantenimento a €49 — perché questo controllo guardava solo che ci fosse
    // un abbonamento attivo, mai QUALE. Due prezzi molto diversi per la stessa cosa: chi se ne
    // accorgeva aveva ragione a sentirsi preso in giro.
    // Il Monitoraggio promette altro, ed è scritto sul piano stesso: il peso sotto controllo, la
    // coach raggiungibile, il rientro quando serve. I menu di rientro continuano ad arrivare —
    // li eroga `monitoring.service.ts` per conto suo quando il peso risale oltre la soglia, e
    // non passano di qui. (Decisione Simone, 9/8.)
    if (activeSubscription.plan?.period === 'monitoring') return [];

    // Piano già CONCLUSO (fine passata) anche se lo stato è ancora 'active' (cron in ritardo):
    // niente erogazione. Coerente con menuStatus, così non compaiono menu di un percorso finito.
    if (activeSubscription.endDate && activeSubscription.endDate.getTime() < toDateOnly().getTime()) return [];

    /**
     * ⚠️ **IL PIANO FERMATO SI GUARDA PRIMA DELLA SOSPENSIONE** (23/8, in revisione).
     *
     * Erano nell'ordine opposto, e il difetto che ne usciva era tutto nel rientro: a una cliente
     * col piano fermato dalla nutrizionista partiva comunque la push «pesati e trovi subito il menu
     * del primo giorno». Si pesava, riapriva l'app, e il menu non c'era — trattenuto due righe più
     * sotto da un cancello che nessuno le aveva nominato. Una promessa che il codice non poteva
     * mantenere.
     */
    /**
     * PIANO FERMATO DAL NUTRIZIONISTA (§15.2 punto 4, decisione dell'11/8).
     *
     * Questo è il controllo che al «piano bloccato» di prima **mancava**: `dietBlock` — quello che
     * nasce dagli allergeni — è letto da `getMenu` e da `menuStatus`, cioè decide solo cosa la
     * cliente *legge*, e non è mai stato letto qui. Risultato: il piano risultava bloccato sullo
     * schermo e i giorni continuavano ad arrivare.
     *
     * Si fermano solo i giorni **nuovi**: quelli già erogati, incluso oggi, restano suoi e non si
     * toccano. Toglierle di mano un menu che ha già in mano — magari dopo aver fatto la spesa — è
     * un danno che nessuna ragione clinica giustifica: il blocco serve a non mandarle *altro*
     * finché una persona non ha guardato.
     */
    if ((profile as { planHeldAt?: Date | null }).planHeldAt) return [];

    /**
     * ⛔ **PERIODO SENZA DIETA ATTIVO — E LA FINESTRA DI RIENTRO** (23/8, richiesta di Simone).
     *
     * Qui c'era `if (pause) return []`, punto: l'erogazione restava ferma **fino all'ultimo minuto**
     * della sospensione, e il primo menu dopo la vacanza arrivava il giorno stesso del rientro —
     * cioè la cliente si svegliava il 24 senza sapere cosa mangiare, e senza aver fatto la spesa.
     * All'inizio di un piano non succede: lì il menu si sblocca `menu_visible_days_before_start`
     * giorni prima, e nessuno si è mai chiesto perché il rientro dovesse essere trattato peggio.
     *
     * Adesso, l'ultimo giorno di sospensione (anticipo = 1) si fa quello che si fa alla partenza:
     * **si chiede la pesata e si eroga il menu del giorno di rientro.**
     *
     * ⚠️ Il giorno da erogare è il **rientro**, non oggi: `rientroInArrivo` torna quella data e non
     * un `boolean` proprio per questo. Erogare «oggi» il 23 vorrebbe dire mandarle un menu per un
     * giorno che è ancora vacanza — e quel menu poi conta come giorno del piano.
     *
     * ⚠️ E la pesata è una **pesata del rientro**, non una qualsiasi: durante la pausa la
     * sorveglianza ne chiede una ogni due giorni, quindi il cancello di ciclo risulterebbe già
     * soddisfatto da un peso di metà vacanza. Il perché sta in `pesata-del-rientro.ts` — è il caso
     * Gioia spostato di qualche giorno.
     */
    const anticipoRientro = await this.configParams.getNumber('menu_visible_days_before_return', 1);
    const pause = await this.events.activePausePeriod(clientId);
    let giornoDelRientro: Date | null = null;
    if (pause) {
      /**
       * ⚠️ Sospensione con date illeggibili: si resta fermi **e lo si scrive**. Tacere qui
       * vorrebbe dire o far ripartire i menu durante una vacanza, o lasciare una cliente sospesa
       * per sempre senza che il motivo compaia da nessuna parte.
       */
      if (!periodoLeggibile(pause)) {
        this.logger.error(
          `Sospensione ${(pause as { id?: string }).id ?? '?'} di ${clientId} senza date leggibili: erogazione tenuta ferma.`,
        );
        return [];
      }
      giornoDelRientro = rientroInArrivo(pause, new Date(), anticipoRientro);
      if (!giornoDelRientro) return []; // sospensione piena: non si eroga niente
    } else {
      /**
       * ⛔ **IL CANCELLO NON SCADE COL GIORNO DEL RIENTRO** (23/8, in revisione).
       *
       * Il giorno del rientro la sospensione non è più attiva, quindi il ramo qui sopra non veniva
       * nemmeno attraversato: chi ieri aveva ignorato la richiesta trovava il menu comunque, e
       * tarato sulla pesata di metà vacanza — cioè esattamente il caso Gioia, con un giorno di
       * ritardo. La pesata del rientro resta obbligatoria finché non arriva, per un ciclo; dopo,
       * la chiede `cycleNeedsMeasure` con le sue parole.
       */
      const appenaFinita = await this.events.pausaAppenaFinita(clientId, daysPerDelivery);
      if (appenaFinita && periodoLeggibile(appenaFinita)) giornoDelRientro = giornoDiRientro(appenaFinita);
    }
    if (giornoDelRientro && (await mancaLaPesataDelRientro(this.prisma, clientId, giornoDelRientro, anticipoRientro))) {
      await this.chiediLaPesataDelRientro(clientId, giornoDelRientro).catch(() => undefined);
      return [];
    }

    const today = toDateOnly();
    /**
     * ⚠️ **LA FINESTRA È QUELLA DEL PIANO CHE EROGA, NON QUELLA SCRITTA NEL PROFILO** (19/8).
     *
     * Qui c'era `profile.planStartDate`, e su una cliente con un piano in corso **e uno comprato in
     * coda** era la data della COIDA: dal 10/8 l'acquisto in coda riallinea `planStartDate` alla
     * partenza del piano nuovo (`finalizeApproval`), perché scheda e scadenza dicessero la stessa
     * cosa. Conseguenza mai vista da nessuno: chi comprava il rinnovo con due mesi di anticipo
     * smetteva di ricevere menu **da quel momento**, perché per questa riga era «troppo presto» —
     * cioè il piano che stava pagando spariva il giorno in cui ne comprava un altro.
     *
     * Il piano che eroga l'ha già scelto `attivoInCorso` due passi più su: la finestra si misura
     * sulla **sua** partenza. `planStartDate` resta il ripiego per le righe vecchie senza data.
     */
    const inizioDelPiano = (activeSubscription as { startDate: Date | null }).startDate ?? profile.planStartDate;
    const start = toDateOnly(inizioDelPiano.toISOString());
    const visibleFrom = new Date(start.getTime() - visibleDaysBefore * 86_400_000);
    if (today.getTime() < visibleFrom.getTime()) return []; // troppo presto

    // MISURE INIZIALI (punto A) obbligatorie per QUALSIASI piano: senza la misura di partenza di
    // QUESTO piano non esiste il report A→B e non si eroga il primo menu.
    //
    // Due correzioni dell'11/8, dalla segnalazione «non mi sono state richieste le misure ma i menu
    // li ho ricevuti» (vedi `misura-di-partenza.ts`):
    //  - il controllo era `count({ clientId })`, cioè «una misura qualsiasi, in tutta la storia»:
    //    pesate di tre settimane prima soddisfacevano il gate di un piano appena partito;
    //  - e non si CHIEDEVA niente. Il popup lo vede chi apre l'app, e l'unica notifica che chiedeva
    //    le misure partiva solo dopo lo sblocco della coach: la richiesta esisteva come punizione,
    //    non come richiesta. Adesso, finché il menu è trattenuto, si chiede.
    //
    // Il controllo sta DOPO la finestra di visibilità di proposito: a un piano che parte fra una
    // settimana non si chiede niente, perché non c'è ancora niente da sbloccare.
    // ⚠️ E la misura di partenza è quella di QUESTO piano: stessa data della finestra, o le due
    // domande divergono e il gate chiede una pesata per un piano che non è quello che sta erogando.
    if (await mancaMisuraDiPartenza(this.prisma, clientId, inizioDelPiano, visibleDaysBefore)) {
      await this.chiediMisureDiPartenza(clientId).catch(() => undefined);
      return [];
    }

    const last = await this.prisma.menuDay.findFirst({
      where: { clientId },
      orderBy: { date: 'desc' },
    });

    /**
     * ⛔ **I BUCHI SI RIEMPIONO CON LE NUOVE** — richiesta di Simone, 25/8, che chiude la voce
     * `buchi-gia-aperti-nei-menu`.
     *
     * Fino a oggi l'erogazione appendeva dopo l'**ultimo** giorno, e il buffer in avanti guardava la
     * **data più alta**. Due conseguenze, tutte e due sulla stessa persona:
     *  · un buco in mezzo **non si richiudeva mai** — quel giorno la cliente leggeva «menu in
     *    preparazione», per sempre;
     *  · e se dopo il buco restava un giorno oltre oggi, **l'erogazione si fermava del tutto**
     *    finché quella data non passava: una riga con la sua data sopra, in fondo al calendario,
     *    valeva come «ha già il menu».
     *
     * ✅ Adesso si guardano le **giornate vere davanti a lei**, e le nuove vanno **nei buchi** prima
     * di accodarsi. ⚠️ Non si cancella e non si rimescola niente — la voce diceva *«la riparazione
     * non è automatica di proposito»* perché rigenerare vuol dire rifare giornate che qualcuna può
     * aver già letto, magari dopo la spesa. Qui non si tocca nessun giorno esistente: si scrive solo
     * dove non c'è niente.
     */
    // Fine piano: non si erogano MAI giorni oltre la data di fine dell'abbonamento. Il piano
    // include fino a `endDate` compresa; i giorni successivi (domani/dopodomani a piano finito)
    // non vanno consegnati (bug: la cliente vedeva menu oltre la fine del percorso).
    /**
     * ⚠️ **Sta qui e non più in fondo** (25/8): il limite del piano è una delle cose che decidono
     * **quali date** comporre, e `dateDaComporre` lo vuole in mano. Prima era una guardia sola
     * (`firstNewDate > planEnd`), e la revisione avversariale ha misurato che con un buco
     * nell'ultimo giorno di piano quella guardia usciva **prima** di riempirlo: la cliente
     * all'ultimo giorno del percorso, col menu di oggi cancellato, non riceveva più niente.
     */
    const planEnd = activeSubscription.endDate ? toDateOnly(activeSubscription.endDate.toISOString()) : null;
    const daOggi = Math.max(today.getTime(), start.getTime());
    /**
     * ⚠️ **Un giorno in sospensione non è un buco**: durante una vacanza l'erogazione si ferma di
     * proposito. Serve in tutti e due i punti — quante giornate ha davvero davanti, e quali date
     * comporre — e una sola definizione evita che i due si contraddicano.
     */
    const sospesoOggi = (t: number): boolean =>
      !!pause &&
      periodoLeggibile(pause) &&
      t >= giornoDelDato(pause.startDate).getTime() &&
      t <= giornoDelDato(pause.endDate).getTime();
    const inCalendario = (
      (await this.prisma.menuDay.findMany({
        where: { clientId, date: { gte: new Date(daOggi) } },
        select: { date: true },
      })) as { date: Date }[]
    ).map((g) => g.date.getTime());

    /**
     * ⛔ **IL MENU DEL RIENTRO PARTE DAL GIORNO DI RIENTRO.**
     *
     * Senza questa riga si farebbe la cosa di sempre — «riparti da domani, o da oggi se sei rimasta
     * indietro» — e il 23 si comporrebbe il menu **del 23**, che è ancora vacanza: un giorno di
     * piano bruciato per una giornata che la cliente non seguirà, e il 24 di nuovo senza niente in
     * mano. Il giorno da servire l'ha già deciso `rientroInArrivo`.
     *
     * ⚠️ **Solo in avanti**: se la cliente si pesa il giorno del rientro o dopo, quel giorno è già
     * passato e forzarlo qui vorrebbe dire comporle un menu per ieri.
     */
    const daPartire =
      giornoDelRientro && giornoDelRientro.getTime() > today.getTime()
        ? Math.max(daOggi, giornoDelRientro.getTime())
        : daOggi;

    /**
     * ⛔ **LE DATE SI DECIDONO QUI, PRIMA DI TUTTO IL RESTO** — spostato dalla revisione
     * avversariale del 25/8, che ha misurato due difetti nati proprio dall'averle decise dopo.
     *
     * `firstNewDate` era ancora «l'ultima data + 1», mentre le giornate composte erano altre: due
     * risposte diverse alla stessa domanda, a quattrocento righe di distanza. Le conseguenze,
     * misurate:
     *  · **il buco dell'ultimo giorno di piano non si riempiva mai** — la guardia `firstNewDate >
     *    planEnd` usciva prima ancora di guardare le date da comporre;
     *  · lo **stato della dieta** e la **finestra della varietà** si chiedevano per un giorno che
     *    non era quello che si stava componendo: per la giornata-buco la varietà guardava i giorni
     *    **dopo** invece di quelli prima, e il piatto di ieri poteva tornare oggi.
     *
     * Adesso `firstNewDate` **è** la prima data che si compone, per costruzione.
     */
    const daComporre = dateDaComporre({
      presenti: inCalendario,
      /**
       * ⛔ **Si guarda da OGGI, non da «dopo l'ultimo»** — è la riga che riempie i buchi.
       *
       * ⚠️ E nei casi normali non cambia niente, misurato caso per caso: se le giornate in
       * calendario sono `oggi … oggi+k`, `dateDaComporre` le salta tutte e comincia da `oggi+k+1`,
       * cioè esattamente il «dopo l'ultimo» di prima. Se è rimasta indietro, si parte da oggi. Se
       * il piano comincia fra due giorni, si parte dall'inizio del piano. E dentro una sospensione
       * i giorni sospesi li salta `sospeso`, quindi la prima data buona è il giorno di rientro.
       */
      da: daPartire,
      quante: daysPerDelivery,
      finePiano: planEnd ? planEnd.getTime() : null,
      sospeso: sospesoOggi,
    });
    /** Niente da comporre: o il piano è finito, o le giornate che servivano ci sono già tutte. */
    if (daComporre.length === 0) return [];
    const firstNewDate = new Date(daComporre[0]);

    /**
     * ⚠️ **La corsa si conta da OGGI, non dal giorno di rientro.** La domanda è «fino a quando può
     * aprire l'app e trovare il menu», e la risposta parte da dove lei è, non da dove si ricomincia
     * a comporre. Misurato: contandola dal rientro, la cliente che ha già il menu del rientro ne
     * riceveva altri due lo stesso giorno — un ciclo bruciato a ogni apertura dell'app.
     * ⚠️ I giorni sospesi li scavalca `sospesoOggi`, quindi durante la vacanza la corsa arriva
     * comunque al giorno di rientro.
     */
    const corsa = corsaDiGiornate(inCalendario, daOggi, sospesoOggi);

    if (last) {
      /**
       * Buffer in avanti: se ha già abbastanza giornate **di seguito** non se ne compongono altre.
       * ⚠️ Di seguito, non sparse, e non «l'ultima data»: vedi `corsaDiGiornate`.
       */
      if (corsa.quante >= GIORNATE_DAVANTI_CHE_BASTANO) {
        return [];
      }
      // Siamo all'ULTIMO giorno del ciclo corrente (last.date === oggi) oppure la cliente
      // è rimasta indietro (last.date < oggi). Il ciclo successivo si sblocca con le MISURE
      // del ciclo: scelta prodotto (Simone) → l'invio delle misure deve far arrivare SUBITO
      // i prossimi giorni, senza attendere il check-in del giorno dopo.
      // Gate misure (Tracciamento_Dati §5): al 2° giorno di ogni ciclo le misure sono
      // obbligatorie; finché non arrivano il ciclo successivo resta "held" (l'avviso alla
      // coach lo genera l'Alert engine: missing_measurements).
      /**
       * ⛔ **IL CICLO FINISCE ALL'ULTIMA GIORNATA DI SEGUITO, NON ALL'ULTIMA DEL CALENDARIO** —
       * difetto trovato e misurato dalla revisione avversariale del 25/8, ed era il più grave.
       *
       * `cycleNeedsMeasure` esce subito con `if (oggi < fineCiclo) return false`. Finché il buffer
       * guardava la data più alta, i due erano d'accordo: con una data futura in calendario si
       * usciva **prima**, a `return []`. Aprendo il buffer sui buchi, quella porta è rimasta aperta
       * e il cancello delle misure è diventato un no-op **esattamente nel caso nuovo**: cliente con
       * un buco oggi e una riga domani, nessuna pesata di ciclo → riceveva due giornate senza
       * pesarsi. È il caso Gioia da un'altra porta.
       *
       * ⚠️ E si prende **la più indietro fra le due**: per chi è rimasta indietro il ciclo vero è
       * ancora quello della sua ultima giornata, e ancorarlo a ieri gli stringerebbe la finestra
       * della pesata senza che nessuno l'abbia chiesto.
       */
      const fineDellaCorsa = new Date(corsa.ultima ?? daOggi - 86_400_000);
      const fineDelCiclo = last.date.getTime() < fineDellaCorsa.getTime() ? last.date : fineDellaCorsa;
      if (await this.cycleNeedsMeasure(clientId, { date: fineDelCiclo }, daysPerDelivery)) {
        return [];
      }
    }

    // `let`: se le giornate di questa variante sono monche si scende sulla gemella completa
    // della stessa famiglia (§15.4), e da lì in poi la dieta servita è quella.
    let diet = await this.pickDiet(profile);
    if (!diet) return [];

    // La dieta scelta dalla cliente va APPLICATA (voce #5: «intanto me la devi applicare»).
    // `pickDiet` ha una catena di ripieghi che, se per lo stile richiesto non esiste una dieta
    // approvata, finisce per servirne una di un altro stile: meglio un menu che nessun menu, ma
    // finora succedeva in silenzio — la cliente sceglieva Keto e riceveva Mediterranea senza che
    // nessuno lo sapesse. Ora resta traccia, così il buco di catalogo si vede e si colma.
    const stileRichiesto = (profile as { dietStyle?: string | null }).dietStyle ?? null;
    const stileServito = (diet as { style?: string | null }).style ?? null;
    if (stileRichiesto && stileServito && stileRichiesto !== stileServito) {
      this.logger.warn(
        `Stile dieta non disponibile per ${clientId}: richiesto "${stileRichiesto}", servito "${stileServito}".`,
      );
      await this.prisma.analyticsEvent
        .create({
          data: {
            eventId: randomUUID(),
            name: 'diet_style_fallback',
            userId: clientId,
            phase: 'app',
            data: { richiesto: stileRichiesto, servito: stileServito, dietId: diet.id } as never,
          } as never,
        })
        .catch(() => undefined);
    }

    // Il motore (M5) può aver deciso una variazione di livello per questa cliente.
    //
    // `reasonKey: null` oltre al flag (13/8): da quando la coda tiene una riga sola per causa, le
    // decisioni successive di una causa già aperta nascono **senza** il flag — servono al tono del
    // messaggio quotidiano e allo storico, non a essere applicate. Senza questo secondo controllo
    // diventerebbero, qui, decisioni ordinarie da eseguire: cioè il contrario esatto di un
    // guardrail, che esiste per fermare l'automatismo finché non ci passa una persona.
    const decision = await this.prisma.engineDecision.findFirst({
      where: {
        clientId,
        flaggedForReview: false,
        reasonKey: null,
        date: { gte: new Date(today.getTime() - 2 * 86_400_000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    const levelDelta = (decision?.action as { levelDelta?: number } | null)?.levelDelta ?? 0;
    const desiredLevel = Math.max(1, 1 + levelDelta);
    const sourceRuleId = decision?.ruleId ?? null;

    let templates: TemplateGiornata[] = await this.prisma.dietDayTemplate.findMany({
      where: { dietId: diet.id, level: desiredLevel },
      orderBy: { dayIndex: 'asc' },
    });
    let level = desiredLevel;
    if (templates.length === 0 && desiredLevel !== 1) {
      // La dieta non ha quel livello: si resta sul livello base.
      templates = await this.prisma.dietDayTemplate.findMany({
        where: { dietId: diet.id, level: 1 },
        orderBy: { dayIndex: 'asc' },
      });
      level = 1;
    }
    if (templates.length === 0) return [];

    /**
     * SI SERVONO SOLO LE GIORNATE COMPLETE (§15.4, decisione dell'11/8).
     *
     * Fin qui l'erogazione si fermava solo alle giornate **zero**: una giornata con la sola
     * colazione veniva servita e salvata così com'è, senza log e senza avviso. Chi apriva l'app
     * all'ora di pranzo non trovava niente, e da nessuna parte risultava un problema.
     *
     * Il gate del catalogo controlla la completezza **una volta sola**, quando qualcuno rende la
     * dieta visibile. Ma il generatore scrive le giornate direttamente e rompe solo se *tutti* gli
     * slot sono vuoti, e due script pubblicano scavalcando il gate: una dieta può diventare
     * incompleta dopo essere stata dichiarata a posto. Per questo il controllo va rifatto qui, dove
     * la giornata arriva davvero nel piatto di qualcuno.
     */
    const esitoCompletezza = await this.soloGiornateComplete(clientId, diet, templates, level);
    if (!esitoCompletezza) return []; // niente da servire: la segnalazione è già stata aperta
    ({ diet, templates, level } = esitoCompletezza);

    /**
     * ⚠️ LA FINESTRA DEL DIGIUNO PROMETTE PASTI CHE QUESTA DIETA NON HA — e va DETTO.
     *
     * `pickDietFor` ora chiede il catalogo che ha i pasti della finestra (`struttura-per-digiuno.ts`),
     * ma la sua catena di ripieghi finisce, all'ultimo passo, per lasciare cadere anche il filtro sui
     * pasti: meglio una dieta vicina che nessun menu. Quindi se la variante a 5 pasti di quella
     * famiglia in catalogo non c'è ancora, chi salta la cena può tornare a ricevere il solo pranzo.
     *
     * Fino a oggi succedeva **in silenzio**, ed è il difetto di famiglia di questo progetto: un dato
     * che agisce e non si vede. Una cliente ha mangiato una volta al giorno per settimane e da nessuna
     * parte risultava un problema. Il conto si fa qui, dove la dieta servita è quella definitiva.
     *
     * ⚠️ Non si blocca l'erogazione: tre pasti su cinque sono meglio di nessun menu, e il rimedio —
     * generare la variante mancante — non è nelle mani di chi apre l'app. Si lascia una traccia
     * cercabile, e `npm run diag:digiuni` lo dice cliente per cliente, con nome ed email.
     */
    const pastiMancanti = pastiPromessiCheMancano(
      (profile as { pathType?: string | null }).pathType,
      (profile as { fastingWindow?: string | null }).fastingWindow,
      diet,
    );
    if (pastiMancanti.length) {
      this.logger.warn(
        `Digiuno: la finestra di ${clientId} promette pasti che la dieta servita non ha in catalogo ` +
          `(mancano: ${pastiMancanti.join(', ')}; dieta "${diet.name}", ${diet.fasting ? 'digiuno' : `${diet.mealsPerDay} pasti`}).`,
      );
      await this.prisma.analyticsEvent
        .create({
          data: {
            eventId: randomUUID(),
            name: 'fasting_meals_missing',
            userId: clientId,
            phase: 'app',
            data: {
              finestra: (profile as { fastingWindow?: string | null }).fastingWindow ?? null,
              mancano: pastiMancanti,
              dietId: diet.id,
            } as never,
          } as never,
        })
        /**
         * ⚠️ SE L'EVENTO NON SI SCRIVE, SI DICE — 18/8.
         *
         * Degradare va bene: l'erogazione non deve fermarsi perché una riga di analytics non passa.
         * Ingoiarlo no: questo evento e `npm run diag:digiuni` sono il solo modo di sapere che una
         * cliente riceve meno pasti di quelli che la sua finestra promette.
         */
        .catch((e: unknown) =>
          this.logger.warn(
            `Digiuno: evento fasting_meals_missing NON scritto per ${clientId}: ${e instanceof Error ? e.message : e}`,
          ),
        );

      /**
       * ⛔ **E ADESSO QUALCUNO LO SA** (decisione di Simone, 21/8).
       *
       * Il log e l'evento qui sopra esistono dal 18/8, e **nessuna schermata li legge**: il difetto
       * era misurato, registrato, e invisibile. Una cliente riceveva meno pasti di quelli che l'app
       * le aveva scritto, e l'unico modo di scoprirlo era lanciare una diagnostica a mano.
       *
       * ⚠️ **Alla nutrizionista**, perché il rimedio è generare la variante mancante a catalogo: non
       * lo può fare la cliente (lei ha solo l'orologio) e non lo può fare la coach.
       *
       * ⚠️ **Una per cliente, non una per giornata**: il riferimento sono i pasti che mancano, quindi
       * questo punto — che passa a ogni erogazione — apre l'attività la prima volta e poi trova che
       * c'è già. Se un giorno le manca qualcos'altro, quella è un'altra situazione e nasce un'altra
       * attività.
       *
       * ⚠️ **Non lancia e non blocca**: `apriAttivitaCoach` non lancia mai, e l'erogazione non deve
       * fermarsi perché un avviso non parte. Tre pasti su quattro sono meglio di nessun menu.
       */
      await apriAttivitaCoach(this.prisma, this.push, {
        clientId,
        kind: TIPO_PASTI_NON_SERVITI,
        refId: riferimentoPastiNonServiti(pastiMancanti),
        ...testoPastiNonServiti(
          (profile as { name?: string | null }).name,
          pastiMancanti.map((slot) => NOME_PASTO[slot] ?? slot),
          diet.name,
        ),
        dueDate: scadenzaPastiNonServiti(new Date()),
      });
    }

    // Stato dell'agente (Metabole_Agente_AI_Dieta): modula la selezione (conforto →
    // gradimento, plateau → efficacia, pre-evento → proteine). Sicurezza e bilanciamento
    // restano prioritari.
    /**
     * ⚠️ **Lo stato si chiede per il giorno CHE SI COMPONE, non per oggi** (23/8, in revisione).
     *
     * Il 23 si compone il menu del 24, e il 23 è ancora vacanza: chiedendolo per «oggi» usciva
     * `vacanza`, e il motore componeva la giornata della ripartenza col peso del **gradimento**
     * invece che dell'efficacia — «tieni il peso» proprio nel giorno in cui ricomincia a cercare
     * il calo.
     */
    const agentState = await this.dietAgent.stateFor(clientId, firstNewDate);
    // Override PER DIETA (ProductRule): il capo nutrizionista può sovrascrivere i valori
    // globali per una singola dieta dalla pagina "Regole motore". Caricati una volta e
    // applicati ai parametri del motore, con il globale come fallback.
    const overrides = await this.dietRuleOverrides(diet.id);
    /**
     * ⚠️ IL DIVIETO SULLA DIETA (Vera §6.2, 13/8): «nella mediterranea niente tonno».
     *
     * Si legge **a parte** e non da `dietRuleOverrides`, che tiene una mappa di numeri e booleani e
     * scarterebbe una lista di parole. Vive in `ProductRule`, senza migrazione.
     */
    const vietatiDieta = terminiVietati(
      ((await this.prisma.productRule.findMany?.({
        where: { dietId: diet.id, ruleCode: RULE_CODE_ESCLUSIONI },
        select: { ruleCode: true, enabled: true, params: true },
      })) ?? []) as { ruleCode: string; enabled: boolean; params: unknown }[],
    );
    /**
     * LE ESCLUSIONI DELLA CLIENTE, lette una volta e passate al pool (21/8).
     *
     * ⚠️ Si costruiscono dal `profile` già caricato in cima a questa funzione: nessuna lettura in
     * più, e soprattutto **la stessa fonte** che userà la guardia. Non si passano i `vietatiDieta`
     * perché quelli hanno già il loro filtro qui sotto, e perché non bloccano: mescolarli
     * cambierebbe la causa scritta sul piatto.
     */
    const esclusioniCliente = esclusioniDi(profile as ProfiloConEsclusioni);

    // Contesto di scoring condiviso (pool ricette per slot + punteggio efficacia/gradimento).
    const ctx = await this.buildScoringContext(clientId, profile.regime, templates as never, agentState, diet.objective ?? undefined, overrides, vietatiDieta, esclusioniCliente, famigliaDelPaniere(diet));
    /**
     * ⚠️ IL GIORNO DI CONFORTO DENTRO IL PLATEAU — decisione di Simone (13/8).
     *
     * Quando il peso è fermo **e** l'umore è basso comanda l'efficacia, ma un giorno a settimana
     * (la domenica) vincono le stelle. Serve un secondo contesto di punteggio, perché i pesi si
     * fissano quando il contesto nasce e la generazione fa più giorni in un colpo solo.
     *
     * ⚠️ Si costruisce **solo** in quello stato: un secondo giro di query per tutte sarebbe un costo
     * pagato da chiunque per una regola che riguarda poche persone.
     */
    const ctxConforto =
      agentState === 'plateau_conforto'
        ? await this.buildScoringContext(clientId, profile.regime, templates as never, 'conforto', diet.objective ?? undefined, overrides, vietatiDieta, esclusioniCliente, famigliaDelPaniere(diet))
        : null;
    const [kcalTolG, daycomboG, pMinG, pMaxG, kcalNeedG, allargPassoG, allargTettoG, coppiaGiorniG, carneMaxG] = await Promise.all([
      this.configParams.getNumber('menu_kcal_balance_tolerance_pct', 15),
      this.configParams.getBool('menu_daycombo_enabled', false),
      this.configParams.getNumber('menu_daycombo_protein_min', 0.2),
      this.configParams.getNumber('menu_daycombo_protein_max', 0.45),
      // Menu "a necessità": il target kcal viene dal FABBISOGNO calcolato sul profilo
      // (Mifflin + attività − deficit dell'obiettivo, con soglie di sicurezza), non dai
      // livelli della dieta. Attivo di default; disattivabile globalmente o per dieta.
      this.configParams.getBool('menu_kcal_need_enabled', true),
      /**
       * ⚠️ **SE DEGRADI, DILLO** (decisione di Simone, 1/9, Fase 3). Quando nessuna giornata entra
       * nella banda kcal, la banda si allarga di `passo` punti alla volta fino a `tetto` punti in
       * più, e ogni allargamento si scrive sulla giornata (`allargamentoBandaPct`).
       *
       * ⛔ **Il tetto è la metà che rende onesta l'altra**: senza, la banda si allargherebbe finché
       * qualcosa entra, e comporrebbe una giornata che col target non c'entra più niente dicendo di
       * aver rispettato la regola. Oltre il tetto si ripiega sulla giornata pre-costruita, che è
       * quello che si faceva prima di questa consegna — quindi il caso peggiore è il comportamento
       * di ieri, mai qualcosa di nuovo.
       *
       * ⚠️ Il passo a **zero** spegne tutto e riporta al comportamento di ieri anche nei casi buoni:
       * è la via d'uscita se questo meccanismo si rivelasse sbagliato, e non richiede un rilascio.
       */
      this.configParams.getNumber('menu_daycombo_allargamento_passo_pct', 5),
      this.configParams.getNumber('menu_daycombo_allargamento_tetto_pct', 20),
      /**
       * ⚠️ **LA COPPIA PRANZO/CENA NON SI RIPETE** entro tanti giorni (richiesta testuale di Simone
       * del 26/8: *«se oggi a pranzo spaghetti e a cena branzino, la prossima volta che a pranzo
       * avrò spaghetti mi devi cambiare la cena»*).
       *
       * ⚠️ I quattro meccanismi anti-ripetizione che c'erano guardano **un pasto alla volta**: con
       * gli spaghetti concessi ogni due giorni e il branzino pure, la stessa coppia può tornare
       * senza che nessuno se ne accorga, perché nessuno dei due piatti si sta ripetendo troppo.
       *
       * ⛔ **Zero spegne la regola** e riporta al comportamento di prima, senza un rilascio.
       */
      this.configParams.getNumber('menu_coppia_pranzo_cena_giorni', 30),
      /**
       * ⚠️ **LA REGOLA FLEXITARIANA** (decisione di Simone, 1/9: due volte a settimana). È quello
       * che distingue «Flessibile» da «onnivoro»: pescano dallo stesso paniere, e senza questo
       * numero le due famiglie sono la stessa cosa.
       *
       * ⛔ **Zero è il default, e vuol dire NESSUN LIMITE** — non «mai carne». La regola si accende
       * per dieta dalla pagina «Regole motore», dove il capo la mette sulle Flessibili: metterla
       * globale a 2 la applicherebbe anche alle onnivore, che è il contrario di quello che serve.
       */
      this.configParams.getNumber('menu_carne_max_a_settimana', 0),
    ]);
    /**
     * ⛔ **«RICETTE SEMPLICI» È SPENTA — decisione di Simone, 31/8, caso Patrizia.**
     *
     * La preferenza pescava i piatti «semplice» con questa query (`buildSimpleSlotPool`):
     *
     *     where: { regime, active: true, difficulty: 'semplice', mealSlot: { in: slots } }
     *     select: { id, name, kcal, mealSlot, ingredients }
     *
     * Due buchi, tutti e due nella stessa riga. **Nessun filtro sulla dieta**: pesca da tutto il
     * catalogo del regime, quindi a una cliente sulla «Mediterranea senza glutine» arrivavano
     * biscotti della «Flexitariana». E **`allergens` non è nel `select`**: il filtro di sicurezza di
     * quel pool guarda solo le PAROLE di nome e ingredienti, quindi un piatto col tag Glutine che il
     * glutine non lo nomina passa, entra nella giornata, e due righe dopo `evaluateMeals` lo vede e
     * **ferma tutta l'erogazione**.
     *
     * ⚠️ È esattamente quello che è successo a Patrizia il 31/8: sette allergie, il menu del rientro
     * fermo, e i piatti incriminati non erano nemmeno della sua dieta. Il difetto non era il suo
     * catalogo — era questo pool.
     *
     * ⛔ **Spenta di default, non tolta.** La preferenza resta un'idea giusta: si riaccende dai
     * Parametri il giorno che quel pool filtra per dieta e legge i tag. Cancellare il codice
     * vorrebbe dire rifarlo da zero; lasciarlo acceso vorrebbe dire lasciare il difetto.
     *
     * ⚠️ **E l'interruttore nell'app resta visibile**, perché toglierlo richiede un rilascio
     * dell'app. Finché non si fa, una cliente può accenderlo e non succede niente: è un interruttore
     * che non accende nulla, e va detto invece di lasciarlo scoprire. Il log qui sotto conta quante
     * volte capita.
     */
    const simpliciAbilitate = pickBoolOverride(
      overrides,
      'menu_simple_recipes_enabled',
      await this.configParams.getBool('menu_simple_recipes_enabled', false),
    );
    // VARIETÀ (garanzia percepita dalla cliente): distanza minima, in giorni, prima che lo
    // stesso piatto possa tornare nello STESSO slot. Se esiste un'alternativa nel pool entro
    // la tolleranza kcal, si usa quella. 0 = guard disattivato.
    const varietyGapG = await this.configParams.getNumber('menu_variety_min_gap_days', 2);
    const varietyGap = pickNumOverride(overrides, 'menu_variety_min_gap_days', varietyGapG);
    const kcalTolPct = pickNumOverride(overrides, 'menu_kcal_balance_tolerance_pct', kcalTolG);
    const daycomboEnabled = pickBoolOverride(overrides, 'menu_daycombo_enabled', daycomboG);
    const kcalNeedEnabled = pickBoolOverride(overrides, 'menu_kcal_need_enabled', kcalNeedG);
    const allargamento = {
      passoPct: pickNumOverride(overrides, 'menu_daycombo_allargamento_passo_pct', allargPassoG),
      tettoPct: pickNumOverride(overrides, 'menu_daycombo_allargamento_tetto_pct', allargTettoG),
    };
    const coppiaGiorni = Math.max(0, pickNumOverride(overrides, 'menu_coppia_pranzo_cena_giorni', coppiaGiorniG));
    const carneMax = Math.max(0, pickNumOverride(overrides, 'menu_carne_max_a_settimana', carneMaxG));

    /**
     * ⚠️ LA QUOTA PROTEICA DI QUESTA CLIENTE vince su quella della dieta (14/8, terza frase
     * dell'azione 3: «rifai con più proteine»). Solo il MINIMO: il massimo resta della dieta —
     * alzare il pavimento non deve spostare il soffitto.
     */
    const pMin = quotaProteicaMinima(
      (profile as { proteinMinPct?: number | null }).proteinMinPct ?? null,
      pickNumOverride(overrides, 'menu_daycombo_protein_min', pMinG),
    );
    const pMax = pickNumOverride(overrides, 'menu_daycombo_protein_max', pMaxG);
    // Selettore per-slot (comportamento base, sempre disponibile come fallback).
    const selector = this.selectorFromContext(ctx, kcalTolPct / 100);
    // Il selettore del giorno di stelle: esiste solo quando lo stato è `plateau_conforto`.
    const selectorConforto = ctxConforto ? this.selectorFromContext(ctxConforto, kcalTolPct / 100) : null;

    // TARGET KCAL DELLA GIORNATA. Se il "menu a necessità" è attivo e il fabbisogno è
    // calcolabile dal profilo, il target è il fabbisogno; altrimenti si usano le kcal del
    // livello dichiarate nella dieta (comportamento storico).
    const levelKcal = this.levelTargetKcal(diet.levels, level);
    let targetKcal = levelKcal;
    let targetSource: 'need' | 'level' = 'level';
    if (kcalNeedEnabled) {
      const need = await this.kcalNeed.computeTargetKcal(clientId);
      if (need && need > 0) { targetKcal = need; targetSource = 'need'; }
    }

    // DayCombo compone la giornata dal pool della dieta puntando al target kcal. Si attiva
    // se DayCombo è abilitato per la dieta OPPURE se il menu a necessità sta guidando il
    // target (in automatico). Se non trova una giornata nella banda → fallback al selettore.
    const useDayCombo = (daycomboEnabled || targetSource === 'need') && !!ctx && targetKcal > 0;

    // Storico recente per slot (giorni già erogati): serve al guard di varietà per non
    // riproporre lo stesso piatto a ridosso di quando è già stato servito.
    const slotHistory = varietyGap > 0 ? await this.recentSlotHistory(clientId, firstNewDate, varietyGap) : new Map<string, string[]>();
    /**
     * ⚠️ Le coppie pranzo/cena già servite. Si legge **prima** del ciclo e si aggiorna man mano: le
     * giornate che sto componendo adesso non sono ancora in `menu_day`, e senza aggiungerle il
     * ciclo di sette giorni potrebbe ripetere una coppia contro se stesso.
     */
    const coppieGiaViste = coppiaGiorni > 0
      ? await this.coppieRecenti(clientId, firstNewDate, coppiaGiorni)
      : new Set<string>();
    let coppieRipetute = 0;
    /**
     * ⚠️ Le giornate in cui la carne è già arrivata, come **numero di giorni dall'epoca**: così le
     * giornate già servite e quelle che sto componendo adesso stanno sulla stessa scala e la
     * finestra scorrevole le confronta senza conversioni.
     */
    const giornateConCarne: number[] = carneMax > 0
      ? await this.giornateConCarneRecenti(clientId, firstNewDate)
      : [];
    let giornateOltreIlTetto = 0;

    // Prepara gli snapshot dei giorni del ciclo.
    // Gli slot che questa cliente non riceve: la finestra del digiuno (voce #7) PIÙ gli spuntini
    // tolti da Vera (azione 3, Decisioni 13/8 §14). Escono PRIMA della composizione, quindi il
    // target kcal del giorno si ridistribuisce sui pasti rimasti — per tutte e due le strade.
    const slotSaltati = slotEsclusiTotali(
      (profile as { pathType?: string | null }).pathType,
      (profile as { fastingWindow?: string | null }).fastingWindow,
      (profile as { pastiEsclusi?: string[] }).pastiEsclusi,
    );

    /**
     * ⛔ **QUANTI PASTI HA LA GIORNATA LO DICE LA SUA DIETA, NON IL PANIERE — corretto l'1/9.**
     *
     * `dayComboPools` prendeva gli slot dalle **chiavi del pool**. Finché il pool si costruiva
     * dalle giornate della dieta di questa cliente era la stessa cosa, e ha funzionato per mesi.
     * Dalla Fase 1 il pool arriva dal **paniere**, che è famiglia × regime e raccoglie tutte le
     * varianti che ci versano dentro — comprese quelle con una struttura diversa.
     *
     * ⛔ Il costo, e non è teorico: una cliente a **3 pasti** il cui paniere contiene anche varianti
     * a 5 si sarebbe vista comporre una giornata da **5 pasti**, cioè kcal in più di quelle che le
     * spettano, senza che niente lo dicesse. Il difetto è nato con l'interruttore su `paniere` e
     * questa riga è la sua correzione: la struttura la dettano le SUE giornate, il paniere dice
     * soltanto **quali piatti** possono entrarci.
     *
     * ⚠️ Si legge dai template invece che da `pastiAttesi(diet)` di proposito: `pastiAttesi` non
     * conosce la giornata da **quattro** pasti e la tratta come un tre (vedi il commento in
     * `giornate-complete.ts`), quindi userebbe la dichiarazione per togliere un pasto che la
     * cliente riceve davvero. I template sono quello che le arriva.
     */
    const slotDellaStruttura = new Set<string>();
    for (const t of templates) for (const sl of slotPieni(t as { meals?: unknown })) slotDellaStruttura.add(sl);

    /**
     * ⛔ **LE DATE, non un inizio più un contatore** (25/8). Il ciclo faceva `firstNewDate + i
     * giorni`: date consecutive per costruzione, quindi i buchi restavano. L'elenco lo decide
     * `dateDaComporre` (calcolato in cima, insieme a `firstNewDate`), che salta quelle che ci sono
     * già e quelle in sospensione.
     *
     * ⚠️ `daysSinceStart` continua a calcolarsi **dalla data**, non dall'indice del ciclo: è quello
     * che sceglie il template del giorno, e con le date non consecutive l'indice direbbe un'altra
     * cosa. Era già così, ed è la riga che rende questo cambio possibile senza toccare il resto.
     */
    const daySnapshots: { date: Date; meals: MealSnapshot[]; allargataDi?: number }[] = [];
    /** Quante giornate di questo giro hanno avuto bisogno di allargare la banda, e di quanto al massimo. */
    let giornateAllargate = 0;
    let allargamentoMassimo = 0;
    for (const istante of daComporre) {
      const date = new Date(istante);
      const daysSinceStart = Math.round((date.getTime() - start.getTime()) / 86_400_000);
      const template = templates[((daysSinceStart % templates.length) + templates.length) % templates.length];
      /**
       * ⚠️ IL GIORNO DI STELLE (decisione di Simone, 13/8): dentro `plateau_conforto`, la domenica
       * si compone con i pesi del conforto. Negli altri giorni comanda l'efficacia.
       *
       * Si cambia il **contesto**, non i pesi: i pesi sono già dentro il punteggio quando il
       * contesto nasce, e ricalcolarli qui vorrebbe dire tenere la stessa formula in due posti.
       */
      const ctxGiorno = ctxConforto && eGiornoDiConforto(date) ? ctxConforto : ctx;
      const selectorGiorno = ctxGiorno === ctxConforto && selectorConforto ? selectorConforto : selector;
      let chosen: { slot: string; recipeId: string }[] | null = null;
      // I punteggi vanno ricalcolati AD OGNI GIORNO: i piatti scelti per il giorno precedente
      // sono nel frattempo diventati "serviti di recente" (bump) e vanno sfavoriti.
      const combo = useDayCombo && ctxGiorno ? this.dayComboPools(ctxGiorno, slotSaltati, slotDellaStruttura) : null;
      let allargataDi = 0;
      if (combo) {
        const esito = this.dayCombo.componi({
          slots: combo.slots,
          poolBySlot: combo.poolBySlot,
          targetKcal,
          tolerancePct: kcalTolPct,
          dayIndex: daysSinceStart,
          proteinBand: { min: pMin, max: pMax },
          allargamento,
          coppieGiaViste,
          carneRestante: carneMax > 0
            ? carneRestante(giornateConCarne, Math.floor(date.getTime() / 86_400_000), carneMax)
            : undefined,
        });
        chosen = esito?.giornata ?? null;
        allargataDi = esito?.allargataDi ?? 0;
        if (esito?.coppiaRipetuta) coppieRipetute += 1;
        if (esito?.carneOltreIlTetto) giornateOltreIlTetto += 1;
        if (allargataDi > 0) {
          giornateAllargate += 1;
          allargamentoMassimo = Math.max(allargamentoMassimo, allargataDi);
        }
      }
      // Fallback: se DayCombo è spento o non trova una giornata nella banda, si usa
      // il template composto a mano con il selettore per-slot.
      if (!chosen) {
        // Stesso filtro anche sul percorso di riserva: se DayCombo è spento o non trova una
        // giornata nella banda, il template va comunque ripulito dei pasti saltati.
        const pasti = (template.meals as { slot: string; recipeId: string }[]) ?? [];
        const pastiFiltrati = pasti.filter((m) => !slotSaltati.has(m.slot));
        chosen = selectorGiorno(pastiFiltrati.length > 0 ? pastiFiltrati : pasti);
      }
      // VARIETÀ: niente stesso piatto nello stesso slot a meno di `varietyGap` giorni, se il
      // pool della dieta offre un'alternativa entro la tolleranza kcal (bilanciamento salvo).
      chosen = this.applyVarietyGuard(chosen, slotHistory, ctxGiorno, kcalTolPct / 100, varietyGap);
      this.pushSlotHistory(slotHistory, chosen, varietyGap);
      /**
       * ⚠️ **Dopo** la guardia di varietà, non prima: quella può cambiare il pranzo o la cena, e la
       * coppia da ricordare è quella che la cliente riceve davvero, non quella che avevamo scelto.
       */
      if (coppiaGiorni > 0) {
        const coppia = coppiaDellaGiornata(chosen);
        if (coppia) coppieGiaViste.add(coppia);
      }
      /**
       * ⚠️ **Dopo la guardia di varietà**, come la coppia: quella può cambiare un piatto, e la
       * carne da contare è quella che la cliente riceve davvero. E si accumula durante il giro,
       * altrimenti sette giornate composte insieme non si vedrebbero fra loro.
       */
      if (carneMax > 0 && ctxGiorno && chosen.some((m) => ctxGiorno.carne.get(m.recipeId) !== false)) {
        giornateConCarne.push(Math.floor(date.getTime() / 86_400_000));
      }
      // I piatti di oggi contano come "serviti di recente" per i giorni successivi del ciclo.
      // ⚠️ Il «servito di recente» si segna su TUTTI E DUE i contesti: se lo si segnasse solo su
      // quello del giorno, la domenica riproporrebbe i piatti di sabato senza saperlo.
      for (const m of chosen) { ctx?.bump(m.recipeId); ctxConforto?.bump(m.recipeId); }
      const meals = await this.snapshotMeals(chosen as never);
      daySnapshots.push({ date, meals, allargataDi: allargataDi > 0 ? allargataDi : undefined });
    }
    if (daySnapshots.length === 0) return []; // tutti i giorni erano oltre la fine piano

    // RIPETIZIONE BIGIORNALIERA (ProductRule `menu_repeat_two_days`, per dieta, off di
    // default). Se attiva per questa dieta: il giorno 2+ ripropone GLI STESSI ALIMENTI del
    // giorno 1 (stesso gruppo di equivalenza) ma con una ricetta/preparazione DIVERSA scelta
    // dal motore. Se per un pasto non c'è una gemella, resta il pasto già composto (nuovo).
    if (ctx && daySnapshots.length >= 2 && (await this.isRepeatTwoDaysActive(diet.id))) {
      const poolIds = new Set<string>();
      for (const set of ctx.slotPool.values()) for (const id of set) poolIds.add(id);
      const twinTolPct = await this.configParams.getNumber('repeat_twin_kcal_tolerance_pct', 15);
      const twin = await this.buildTwinFinder(diet.id, [...poolIds], ctx, twinTolPct / 100);
      const day0 = daySnapshots[0].meals;
      for (let i = 1; i < daySnapshots.length; i++) {
        const used = new Set<string>(); // niente due gemelle uguali nello stesso giorno
        const chosen = day0.map((m0) => {
          const t = twin(m0.recipeId, m0.slot, used);
          if (t) { used.add(t); return { slot: m0.slot, recipeId: t }; }
          // Fallback (decisione socio): pasto nuovo = quello già composto per questo slot.
          const orig = daySnapshots[i].meals.find((x) => x.slot === m0.slot);
          return { slot: m0.slot, recipeId: orig?.recipeId ?? m0.recipeId };
        });
        daySnapshots[i] = { date: daySnapshots[i].date, meals: await this.snapshotMeals(chosen as never) };
      }
    }

    // PREFERENZA "RICETTE SEMPLICI" (scelta della cliente in app): se attiva, per ogni pasto
    // si preferisce — quando disponibile — un'alternativa marcata `difficulty="semplice"`
    // (cucina italiana), entro la tolleranza kcal e rispettando le esclusioni. La rotazione
    // per giorno fa alternare i piatti semplici tra loro e con quelli esistenti quando il pool
    // è limitato. La sicurezza resta garantita da evaluateMeals subito sotto.
    if ((profile as { prefersSimpleRecipes?: boolean }).prefersSimpleRecipes && !simpliciAbilitate) {
      this.logger.log(
        `Ricette semplici: ${clientId} ha la preferenza ACCESA ma la funzione è spenta `
        + '(`menu_simple_recipes_enabled`). Il menu si compone dalle giornate della sua dieta.',
      );
    }
    if ((profile as { prefersSimpleRecipes?: boolean }).prefersSimpleRecipes && simpliciAbilitate) {
      const slots = [...new Set(templates.flatMap((t) => ((t.meals as { slot: string }[]) ?? []).map((m) => m.slot)))];
      const excludeTerms = [
        ...(((profile as { allergies?: string[] }).allergies) ?? []),
        ...((profile.intolerances as string[]) ?? []),
        ...((profile.dislikedFoods as string[]) ?? []),
      ];
      const simpleBySlot = await this.buildSimpleSlotPool(profile.regime, slots, excludeTerms);
      if ([...simpleBySlot.values()].some((l) => l.length)) {
        // Questo passaggio RISCRIVE i pasti già composti: senza storico annullerebbe il guard
        // di varietà applicato sopra (il pool "semplice" è piccolo e la rotazione per giorno
        // degenera a piatto fisso quando in banda kcal ne resta uno solo). Lo storico riparte
        // dai giorni GIÀ erogati e si aggiorna man mano, come nel ciclo di composizione.
        const simpleHistory = varietyGap > 0
          ? await this.recentSlotHistory(clientId, firstNewDate, varietyGap)
          : new Map<string, string[]>();
        for (const day of daySnapshots) {
          const dayIndex = Math.round((day.date.getTime() - start.getTime()) / 86_400_000);
          day.meals = this.applySimplePreference(day.meals, simpleBySlot, kcalTolPct / 100, dayIndex, simpleHistory);
          this.pushSlotHistory(simpleHistory, day.meals, varietyGap);
        }
      }
    }

    // SICUREZZA + SOSTITUZIONE (motore §2/§7): controllo i piatti contro le esclusioni
    // della cliente. Se un ingrediente escluso ha una sostituzione sicura → la annoto sul
    // pasto (il piatto si eroga). Se un'INTOLLERANZA non è sostituibile → NON si eroga:
    // blocco + escalation al nutrizionista (la coach la vede via Alert engine).
    const primaGuardia = await this.evaluateMeals(clientId, daySnapshots.flatMap((d) => d.meals), vietatiDieta);
    let violations = primaGuardia.violations;
    let subsByRecipe = primaGuardia.subsByRecipe;
    const nonSicure = primaGuardia.nonSicure;

    /**
     * ⛔ **PRIMA DI BLOCCARE, SI CERCA UN'ALTERNATIVA** (Simone, 31/8: *«il sistema deve cercare
     * un'alternativa ed erogare il menu, altrimenti non è un sistema pensante»*).
     *
     * Il caso Patrizia: giornata a catalogo con dentro tre piatti che lei non può mangiare, e nel
     * pool — già ripulito — un'alternativa sicura per **ogni** pasto. Il motore si fermava lo
     * stesso, e la cliente restava senza menu per un piatto su cinque.
     *
     * ⚠️ **Questo ramo entra SOLO dove prima si usciva con `return []`.** Il confronto non è «piatto
     * vecchio contro piatto nuovo»: è **un piatto contro nessun menu**. Per una cliente la cui
     * giornata è già sicura non viene nemmeno eseguito.
     *
     * ⛔ E la guardia **si rifà** sui pasti sostituiti: la sostituzione non è una scorciatoia intorno
     * al controllo, è un tentativo che deve superare lo stesso controllo di prima. Se dopo il
     * tentativo resta anche una sola violazione, si blocca come sempre — con i motivi di **adesso**,
     * non con quelli di prima.
     */
    if (violations.length && ctx) {
      const esito = cercaUnAlternativa(daySnapshots, nonSicure, ctx, kcalTolPct / 100);
      if (esito.sostituzioni.length) {
        for (const day of daySnapshots) {
          day.meals = await this.snapshotMeals(day.meals.map((m) => ({ slot: m.slot, recipeId: m.recipeId })) as never);
        }
        const fuoriBanda = esito.sostituzioni.filter((x) => x.fuoriBanda).length;
        this.logger.warn(
          `Alternativa trovata: ${esito.sostituzioni.length} pasti di ${clientId} avevano a catalogo una `
          + `ricetta che lei non può mangiare e sono stati sostituiti dal pool`
          + (fuoriBanda ? `; ${fuoriBanda} fuori dalla banda calorica (la sicurezza viene prima)` : '')
          + '. ⚠️ Il catalogo di questa dieta va guardato: `npm run diag:esclusioni`.',
        );
        ({ violations, subsByRecipe } = await this.evaluateMeals(clientId, daySnapshots.flatMap((d) => d.meals), vietatiDieta));
      }
      if (esito.senzaAlternativa.length) {
        this.logger.warn(
          `Alternativa NON trovata per ${esito.senzaAlternativa.length} pasti di ${clientId} `
          + `(slot: ${[...new Set(esito.senzaAlternativa.map((x) => x.slot))].join(', ')}): per quel pasto `
          + 'il pool non ha NIENTE di sicuro. Qui il blocco è l\'unica risposta onesta.',
        );
      }
    }

    if (violations.length) {
      await this.ensureDietBlockedEscalation(clientId, violations);
      return [];
    }
    for (const day of daySnapshots) {
      for (const m of day.meals) {
        const subs = subsByRecipe[m.recipeId];
        if (subs && subs.length) m.substitutions = subs;
      }
    }
    // Cibi NON graditi come ingrediente PRINCIPALE (nel nome del piatto): il piatto
    // si cambia già in erogazione con un'alternativa equivalente.
    const dislikedNow = ((profile.dislikedFoods ?? []) as string[]);
    if (dislikedNow.length) {
      // Lo storico riparte dai giorni GIÀ erogati e si aggiorna giorno per giorno, come nel
      // ciclo di composizione: senza, ogni giorno riceverebbe lo stesso identico sostituto.
      const swapHistory = varietyGap > 0
        ? await this.recentSlotHistory(clientId, firstNewDate, varietyGap)
        : new Map<string, string[]>();
      /**
       * ⚠️ Il piatto di partenza di ogni pasto, per sapere dopo **quali** sono cambiati davvero.
       * ⛔ Non si riconoscono dalla `reason` della sostituzione: `'non gradito'` è la stessa che
       * `esclusioniDi` mette su ogni esclusione non bloccante, quindi anche sui cambi di
       * INGREDIENTE — e la cliente si vedrebbe la stessa riga due volte nella stessa giornata.
       */
      const primaDelloSwap = new Map<MealSnapshot, string>();
      for (const day of daySnapshots) for (const m of day.meals) primaDelloSwap.set(m, m.recipeId);
      let cambiati = 0;
      for (const day of daySnapshots) {
        cambiati += (await this.swapDislikedDishes(clientId, day.meals, dislikedNow, ctx?.slotPool, swapHistory)).length;
        this.pushSlotHistory(swapHistory, day.meals, varietyGap);
      }
      /**
       * ⛔ **IL PIATTO SCAMBIATO RIPASSA DALLA SICUREZZA** (31/8). Lo swap sceglie un piatto che non
       * viola niente — quello lo sa fare — ma un piatto **ammissibile con una sostituzione** entra
       * senza che la sostituzione venga scritta: è la merenda del 30/8 di Sonia, arrivata con le
       * albicocche secche e senza la riga che dice cosa non mettere. Il piatto andava bene; quello
       * che mancava era dirglielo.
       *
       * ⚠️ Si ripassa da `evaluateMeals` invece di scrivere le sostituzioni dentro lo swap perché è
       * lì che vivono le regole per ingrediente **e** la conversione delle grammature dei grassi:
       * due punti che scrivono sostituzioni sarebbero due punti che un giorno le scrivono diverse.
       *
       * ⚠️ Solo i pasti **cambiati**: sugli altri le righe sono già state scritte sopra, e
       * riscriverle qui vorrebbe dire farle leggere doppie in app, in scheda e nel PDF.
       */
      if (cambiati) {
        const dopo = await this.evaluateMeals(clientId, daySnapshots.flatMap((d) => d.meals), vietatiDieta);
        if (dopo.violations.length) {
          await this.ensureDietBlockedEscalation(clientId, dopo.violations);
          return [];
        }
        for (const day of daySnapshots) {
          for (const m of day.meals) {
            if (primaDelloSwap.get(m) === m.recipeId) continue;
            const subs = dopo.subsByRecipe[m.recipeId] ?? [];
            if (subs.length) m.substitutions = [...(m.substitutions ?? []), ...subs];
          }
        }
      }
    }

    /**
     * ⚠️ LA GIORNATA CHE ESCE SOTTO IL FABBISOGNO, E CHE FINO A OGGI NON LO DICEVA A NESSUNO.
     *
     * `menu_kcal_balance_tolerance_pct` c'era già, ma come **filtro**: `DayCombo` scarta le
     * combinazioni fuori banda e, quando non ne resta nessuna, torna `null` — e il ripiego qui
     * sopra compone col selettore per-slot ed **eroga comunque**. Una giornata al 65% del
     * fabbisogno (Sonia, finestra «salto la cena») usciva identica a una giusta.
     *
     * Il controllo va **qui e non dentro `DayCombo`**: la giornata la riscrivono anche la
     * ripetizione bigiornaliera, la preferenza «ricette semplici» e il cambio dei piatti non
     * graditi. Questo è il primo punto in cui i pasti sono quelli che la cliente riceverà.
     *
     * ⚠️ **Non blocca niente** — è la stessa scelta di `fasting_meals_missing` venti righe sopra:
     * una giornata scarsa è meglio di nessun menu, e il rimedio (porzioni scalate, strada C —
     * `progetto/DECISIONE_Porzioni_Scalate_Strada_C.md`) non è nelle mani di chi apre l'app.
     * ⚠️ **Un evento per erogazione, non uno per giorno**: `deliverIfEligible` gira a ogni apertura
     * dell'app, e un evento per giornata renderebbe il conteggio degli eventi un conteggio delle
     * aperture. La peggiore giornata va nel log, tutte nell'evento.
     */
    /**
     * ⚠️ LE PORZIONI SI SCALANO SUL FABBISOGNO — voce 255, strada C, decisa da Simone il 18/8:
     * «va riproporzionato il pasto correggendo le quantità in base al fabbisogno».
     *
     * ⚠️ **Va QUI, ed è la cosa più importante di questo blocco.** La giornata la riscrivono, dopo
     * `snapshotMeals`, almeno tre passaggi: la ripetizione bigiornaliera, la preferenza «ricette
     * semplici» e il cambio dei piatti non graditi — e tutti e tre ricostruiscono i pasti campo per
     * campo, quindi un `porzione` scritto prima verrebbe buttato via da loro senza un errore.
     * Scalando come ULTIMO passo prima della misura non c'è nessun campo da ricordarsi di
     * riportare, e la regola vale per forza su tutti i percorsi di composizione.
     *
     * ⚠️ E va **prima** di `giornateSottoTarget`, non dopo: da oggi «sotto il fabbisogno» vuol dire
     * «resta corta **anche col moltiplicatore**», cioè una cosa più rara e più grave. Misurare prima
     * di scalare terrebbe acceso un allarme che è appena stato spento.
     */
    const tetti = {
      principale: await this.configParams.getNumber('porzione_tetto_pasto_principale', TETTI_PREDEFINITI.principale),
      colazione: await this.configParams.getNumber('porzione_tetto_colazione', TETTI_PREDEFINITI.colazione),
      spuntino: await this.configParams.getNumber('porzione_tetto_spuntino', TETTI_PREDEFINITI.spuntino),
    };
    const restateCorte: { data: string; quota: number; alTetto: string[] }[] = [];
    for (const giorno of daySnapshots) {
      const esito = porzioniScalate(giorno.meals, targetKcal, tetti);
      if (esito.restaCorta) {
        restateCorte.push({
          data: giorno.date.toISOString().slice(0, 10),
          /**
           * ⛔ **NON arrotondata** (corretto in revisione, 22/8). Qui c'era
           * `Math.round(esito.quota * 100) / 100`, e su quel numero decideva `meritaUnAvviso`: con
           * tolleranza al 15%, una quota reale di **0,8451** — fuori tolleranza, l'attività andava
           * aperta — diventava `0,85` e il log diceva «dentro la tolleranza, è l'arrotondamento».
           * Falso, e per tutta la banda [0,845 ; 0,850). L'arrotondamento serve al testo e al log,
           * non alla decisione: si fa dove si scrive, non dove si sceglie.
           */
          quota: esito.quota,
          alTetto: esito.alTetto,
        });
      }
      if (!esito.scalata) continue;
      giorno.meals = giorno.meals.map((m, i) => {
        const f = esito.fattori[i];
        if (!(f > 1.0001)) return m;
        // ⚠️ `kcal` già scalato (vedi il docstring di `MealSnapshot`), `kcalBase` per non perdere
        // l'origine, `porzione` per poterlo dire alla cliente e alla nutrizionista.
        return { ...m, kcal: Math.round(m.kcal * f), kcalBase: m.kcal, porzione: Math.round(f * 100) / 100 };
      });
    }
    if (restateCorte.length) {
      // ⚠️ Un log a parte da quello sotto: «non ci arriva nemmeno al tetto» è la riga che il foglio
      // §5 chiama «il minimo che va fatto comunque», e sparirebbe dentro l'altro messaggio.
      this.logger.warn(
        `Porzioni: ${restateCorte.length} giornat${restateCorte.length === 1 ? 'a' : 'e'} restano sotto il fabbisogno ` +
          `per ${clientId} ANCHE col moltiplicatore al tetto (target ${Math.round(targetKcal)} kcal). ` +
          restateCorte.map((r) => `${r.data}: ${Math.round(r.quota * 100)}% (al tetto: ${r.alTetto.join(', ') || 'nessuno'})`).join(' · '),
      );
      /**
       * ⛔ **LA TERZA CONDIZIONE DEL §3, che per tre giorni nessuno ha calcolato** (22/8).
       *
       * Il foglio decisioni la chiama **la migliore delle tre**: le altre due guardano il *nome* del
       * protocollo (20:4, 23:1) e quanti pasti restano; questa guarda le **calorie che quella cliente
       * riceve davvero**. Il codice lo diceva in tre punti — `cambio-finestra.ts`,
       * `verifica-digiuno.ts`, l'elenco lavori — dichiarando che mancava invece di lasciarla credere
       * coperta. Da qui in poi non manca più.
       *
       * ⚠️ **Nasce qui e non alla scelta della finestra**, ed è la ragione per cui prima non c'era:
       * `impostaDigiuno` non ha in mano né la dieta né il fabbisogno, e per dirlo dovrebbe rifare il
       * conto del motore. Due conti sulla stessa domanda divergono — è già successo due volte fra il
       * motore e `diag:digiuni`. Qui il conto è già fatto, sui pasti veri, dopo la scalatura.
       *
       * ⚠️ **Non blocca niente**, come `fasting_meals_missing`: una giornata leggera è meglio di
       * nessun menu, e il rimedio non è nelle mani di chi apre l'app.
       *
       * ⚠️ `apriAttivitaCoach` non lancia mai e dedupla su `clientId+kind+refId`: il riferimento è la
       * **situazione**, non la data — `deliverIfEligible` gira a ogni apertura dell'app, e una data lì
       * dentro farebbe nascere un'attività al giorno per la stessa identica cosa.
       */
      const peggioreCorta = laPiuCorta(restateCorte);
      /**
       * ⚠️ **«Lo dice già l'altra» vale solo finché l'altra è aperta.** Anche
       * `digiuno_pasti_non_serviti` si deduplica senza guardare lo stato: chiusa quella, il rinvio
       * diventerebbe un silenzio definitivo su una cliente che riceve meno calorie di quante le
       * servono. Una riga in più solo quando i pasti mancano davvero.
       */
      const altraAttivitaAperta = pastiMancanti.length > 0 && !!(await this.prisma.coachTask.findFirst({
        where: {
          clientId,
          kind: TIPO_PASTI_NON_SERVITI,
          refId: riferimentoPastiNonServiti(pastiMancanti),
          status: 'todo',
        } as never,
        select: { id: true },
      }).catch(() => null));
      const decisione = decisioneKcalCorte({
        peggiore: peggioreCorta,
        tolleranzaPct: kcalTolPct,
        pastiMancanti,
        altraAttivitaAperta,
      });
      if (!decisione.apri) {
        /**
         * ⚠️ *Se degradi, dillo* — ma **al livello giusto** (corretto in revisione, 22/8).
         *
         * Il 12,4% delle giornate risulta `restaCorta` per il solo arrotondamento dei pasti: un
         * `warn` su quel ramo sarebbe comparso a ogni erogazione di quasi ogni cliente scalata,
         * cioè lo stesso difetto che questa consegna combatte, spostato dal cruscotto ai log — e
         * avrebbe affogato l'unico caso che vale la pena leggere. «L'arrotondamento non merita
         * un'attività» non è una degradazione: è il funzionamento normale, e va in `debug`.
         *
         * ⛔ Il ramo dei **pasti mancanti** invece è un avviso vero: lì taciamo di proposito su una
         * cliente che riceve meno calorie, perché lo dice un'altra attività. Se un giorno quell'altra
         * smettesse di nascere, questo `warn` è l'unico posto in cui il silenzio si vede.
         */
        /**
         * ⚠️ *Se degradi, dillo* — ma **solo dove è una degradazione**. Il ramo della tolleranza non
         * è degradare: il 12,4% delle giornate risulta «corta» per il solo arrotondamento dei pasti,
         * e scriverne una riga a ogni erogazione di quasi ogni cliente scalata sarebbe lo stesso
         * difetto che questa consegna combatte, spostato dal cruscotto ai log — dove per giunta
         * affogherebbe l'unico caso da leggere. ⛔ E `debug` non basterebbe a evitarlo: in questo
         * progetto non c'è nessun `setLogLevels`, quindi `debug` **si stampa come `warn`**.
         *
         * ⛔ Il ramo dei pasti mancanti invece è un rinvio vero: lì taciamo di proposito su una
         * cliente che riceve meno calorie. Se un giorno l'altra attività smettesse di nascere,
         * questa riga è l'unico posto in cui quel silenzio si vede.
         */
        if (altraAttivitaAperta) {
          this.logger.warn(`Porzioni: attività «${TIPO_KCAL_CORTE}» NON aperta per ${clientId} — ${decisione.perche}.`);
        }
      } else if (peggioreCorta) {
        /**
         * ⛔ **LA SITUAZIONE È QUELLA CHE IL MOTORE HA APPLICATO, non quella scritta in colonna**
         * (revisione del 22/8). Prima qui passavano `profile.fastingWindow` e `profile.pastiEsclusi`
         * grezzi, e sono due cose diverse da quello che è successo nel piatto:
         *
         *  - la finestra vale **solo se `pathType` è digiuno** — `slotSaltati` lo sa e torna vuoto,
         *    ma il testo avrebbe detto «è la sua finestra di digiuno» a una cliente che digiuna solo
         *    in banca dati (le colonne dell'orologio possono restare scritte: `uscita-dal-digiuno.ts`);
         *  - da `pastiEsclusi` il motore ascolta **solo i due spuntini**: una riga con «cena» dentro
         *    non toglie niente a nessuno, e raccontarla come causa è mandare la nutrizionista a
         *    rimettere un pasto che non è mai stato tolto.
         *
         * ⚠️ E la situazione è anche **il riferimento**: dirla sbagliata non sbaglia solo il testo,
         * sbaglia l'unicità — due clienti identiche con una riga di colonna diversa avrebbero avuto
         * due attività, e la stessa cliente ne avrebbe avuta una nuova a ogni pulizia della colonna.
         */
        const situazione = {
          finestra: finestraCheAgisce(
            (profile as { pathType?: string | null }).pathType,
            (profile as { fastingWindow?: string | null }).fastingWindow,
          ),
          pastiEsclusi: spuntiniTolti((profile as { pastiEsclusi?: string[] }).pastiEsclusi),
        };
        const t = testoKcalCorte(
          (profile as { name?: string | null }).name ?? null,
          peggioreCorta,
          restateCorte.length,
          situazione,
          // ⚠️ `targetSource`, non solo il numero: «il 68% del suo fabbisogno» è falso quando il
          // target sono le kcal del livello della dieta. Vedi `TargetDellaGiornata`.
          { kcal: targetKcal, fonte: targetSource },
        );
        await apriAttivitaCoach(this.prisma, this.push, {
          clientId,
          kind: TIPO_KCAL_CORTE,
          refId: riferimentoKcalCorte(situazione),
          title: t.title,
          description: t.description,
          dueDate: scadenzaKcalCorte(new Date()),
        });
      }
    }

    const sottoTarget = giornateSottoTarget(daySnapshots, targetKcal, kcalTolPct);
    if (sottoTarget.length) {
      const peggiore = laPeggiore(sottoTarget)!;
      this.logger.warn(
        `Kcal: ${sottoTarget.length} giornat${sottoTarget.length === 1 ? 'a' : 'e'} sotto il target per ${clientId} ` +
          `(target ${Math.round(targetKcal)} kcal da ${targetSource === 'need' ? 'fabbisogno' : 'livello dieta'}, ` +
          `tolleranza ${kcalTolPct}%). Peggiore: ${peggiore.data}, ${peggiore.kcal} kcal ` +
          `(${peggiore.scostamentoPct}%, il ${Math.round(peggiore.quotaDelTarget * 100)}% del target)` +
          `${slotSaltati.size ? `; pasti non erogati: ${[...slotSaltati].join(', ')}` : ''}.`,
      );
      await this.prisma.analyticsEvent
        .create({
          data: {
            eventId: randomUUID(),
            name: 'daily_kcal_below_target',
            userId: clientId,
            phase: 'app',
            data: {
              targetKcal: Math.round(targetKcal),
              targetSource,
              tolleranzaPct: kcalTolPct,
              giorni: sottoTarget,
              slotSaltati: [...slotSaltati],
              finestra: (profile as { fastingWindow?: string | null }).fastingWindow ?? null,
              pastiEsclusi: (profile as { pastiEsclusi?: string[] }).pastiEsclusi ?? [],
              dietId: diet.id,
            } as never,
          } as never,
        })
        /**
         * ⚠️ SE L'EVENTO NON SI SCRIVE, SI DICE — corretto il 18/8, un giorno dopo averlo scritto.
         *
         * Degradare va bene: l'erogazione non deve fermarsi perché una riga di analytics non passa.
         * Ingoiare l'errore no: `npm run diag:kcal` legge **solo** questi eventi, e una scrittura
         * che fallisce in silenzio è indistinguibile da «nessuna giornata sotto il fabbisogno» —
         * cioè da un ✓. È la regola di `feedback-errori-nei-log`: se degradi, scrivilo.
         */
        .catch((e: unknown) =>
          this.logger.warn(
            `Kcal: evento daily_kcal_below_target NON scritto per ${clientId}: ${e instanceof Error ? e.message : e}`,
          ),
        );
    }

    /**
     * ⚠️ **SE DEGRADI, DILLO — anche a voce alta** (1/9). Il numero sulla riga serve a contare dopo;
     * questa riga serve a chi guarda i log la mattina. Si scrive **una volta per giro** e non una
     * per giornata: un ciclo di sette giorni con la banda stretta riempirebbe il log di sette righe
     * identiche, e un log che si ripete è un log che si smette di leggere.
     */
    if (giornateOltreIlTetto > 0) {
      this.logger.warn(
        `Flexitariana: per ${clientId} ${giornateOltreIlTetto} giornata/e composte CON CARNE oltre il tetto `
        + `di ${carneMax} a settimana — dentro la banda kcal non restava nessuna giornata senza. `
        + 'Il paniere di questa dieta ha poche giornate senza carne: si guarda con `npm run diag:carne`.',
      );
    }
    if (coppieRipetute > 0) {
      this.logger.warn(
        `Varietà: per ${clientId} ${coppieRipetute} giornata/e composte con una coppia pranzo/cena già servita `
        + `negli ultimi ${coppiaGiorni} giorni — dentro la banda kcal non ne restavano di nuove. `
        + 'Il pool di questa dieta è stretto: si guarda con `npm run diag:coppie`.',
      );
    }
    if (giornateAllargate > 0) {
      this.logger.warn(
        `Kcal: per ${clientId} ${giornateAllargate} giornata/e su ${daySnapshots.length} composte allargando la banda `
        + `(massimo +${allargamentoMassimo} punti sopra ±${kcalTolPct}%). Il pool di questa dieta non copre il target: `
        + 'si guarda con `npm run diag:allargamenti`.',
      );
    }

    const created: string[] = [];
    for (const day of daySnapshots) {
      await this.prisma.menuDay.upsert({
        where: { clientId_date: { clientId, date: day.date } },
        create: {
          clientId,
          date: day.date,
          dietId: diet.id,
          level,
          meals: day.meals as never,
          visibleFrom: last ? today : visibleFrom,
          sourceRuleId,
          /**
           * ⛔ **DI QUESTO GIORNO POTREMO SAPERE SE L'HA APERTO?** (26/8, voce
           * `visto-non-vuol-dire-aperto`.)
           *
           * Si copia dal profilo, e si copia **adesso**: `apertureDal` dice da quando il telefono di
           * questa cliente manda il segnale. Un giorno composto prima di quell'istante non potrà mai
           * dire «non l'ha aperto» — potrebbe averlo aperto con l'app vecchia, che non lo diceva a
           * nessuno — e allora resta fuori da tutti i rifacimenti automatici.
           *
           * ⚠️ **Sta sulla giornata e non si ricalcola dal profilo al momento della domanda**: le
           * query che cercano i giorni da rifare girano anche **per dieta**, su molte clienti
           * insieme, e un `where` diventerebbe un giro di letture. È uno scatto, come lo snapshot
           * dei pasti nella riga accanto.
           */
          apertureTracciate: !!(profile as { apertureDal?: Date | null }).apertureDal,
          /**
           * ⚠️ Di quanto si è allargata la banda kcal per comporre QUESTA giornata (1/9). Nullo nel
           * caso normale — si scrive solo quando si è degradato, così la domanda «quali giornate
           * abbiamo servito fuori target» è un `where … IS NOT NULL` e non un conto da rifare.
           */
          allargamentoBandaPct: day.allargataDi ?? null,
        } as never,
        update: {}, // mai sovrascrivere un giorno già erogato
      });
      created.push(day.date.toISOString().slice(0, 10));
    }
    await this.audit.log({
      action: 'menu.delivered',
      actorId: clientId,
      entityType: 'menu_day',
      metadata: { days: created, dietId: diet.id },
    });

    /**
     * IL PRIMO MENU IN ASSOLUTO: è QUI che la prova comincia davvero (§16.1, 11/8).
     *
     * `!last` è esattamente «questa cliente non aveva nemmeno un giorno erogato», e non serve una
     * query in più per saperlo: la variabile è già stata calcolata sopra per decidere da che data
     * partire.
     *
     * Da questo momento — non dall'attivazione — scattano `trial_started`, il CRM a «Prova» e
     * l'avviso alla coach. Con «Conosciamoci» che si attiva a fine questionario e la data scelta
     * dalla cliente, l'attivazione può stare settimane prima: dire «Prova» a chi non ha ancora
     * visto un piatto riempie la board della manager di gente che non ha cominciato, e manda alla
     * coach l'avviso settimane prima del momento in cui una telefonata serve.
     *
     * `provaAttivata` è idempotente (guarda l'evento `trial_started`) — necessario, perché questa
     * funzione gira a ogni apertura dell'app — e non deve mai far fallire l'erogazione: il menu è
     * il lavoro vero, il funnel è la cronaca.
     */
    if (!last && created.length > 0) {
      await provaAttivata(this.prisma, this.push, {
        clientId,
        subscriptionId: (activeSubscription as { id?: string }).id ?? null,
      }).catch(() => undefined);
    }

    /**
     * ⚠️ **SE LA GIORNATA È USCITA, IL BLOCCO NON C'È PIÙ: e va detto** (21/8).
     *
     * `ensureDietBlockedEscalation` apre, e fin qui non chiudeva **nessuno**: la riga «Piano
     * bloccato» nata dal menu restava aperta per sempre, anche dopo che il motore aveva ricominciato
     * a comporre. Nell'elenco della nutrizionista si accumulavano blocchi già passati, e il modo per
     * sapere se uno era ancora vero era… nessuno.
     *
     * ⚠️ Si chiude **solo** quella di origine menu (`MOTIVO_BLOCCO_MENU`), non quella della base
     * personalizzata: sono due cause diverse e la seconda la chiude `personal-base` quando la sua
     * condizione è risolta. Chiuderle tutte e due da qui vorrebbe dire spegnere un allarme che non
     * abbiamo verificato.
     */
    if (created.length > 0) {
      try {
        const chiuse = (await this.prisma.escalation.updateMany({
          where: {
            clientId,
            source: 'engine' as never,
            status: { in: ['open', 'in_progress'] as never },
            reason: { startsWith: MOTIVO_BLOCCO_MENU },
          },
          // `resolvedAt`: una chiusura automatica è una chiusura, quindi vale la stessa tregua.
          data: { status: 'resolved' as never, resolvedAt: new Date() } as never,
        })) as { count: number } | undefined;
        if (chiuse?.count) {
          this.logger.log(
            `Blocco piano rientrato per ${clientId}: ${chiuse.count} segnalazione/i chiusa/e, la giornata si compone.`,
          );
        }
      } catch (e: unknown) {
        // Degrada, ma non in silenzio: se questa riga non si chiude, la cliente riceve il menu e
        // nell'elenco della nutrizionista resta un blocco che non esiste più.
        this.logger.warn(
          `Blocco piano: chiusura automatica fallita per ${clientId}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    return created;
  }

  // ---------- Gate misure (misure obbligatorie al 2° giorno del ciclo) ----------

  /**
   * Stato del gate misure per l'app: se `blocking` è true, il client mostra il
   * popup bloccante finché non arriva la misura del ciclo corrente.
   */
  async measurementGate(clientId: string): Promise<{
    required: boolean;
    blocking: boolean;
    cycleDate: string | null;
    /**
     * 'none' · 'popup' (primo giorno, richiudibile) · 'locked' (dal giorno dopo: serve la coach) ·
     * 'promemoria' (la coach ha riaperto l'app: si chiede, non si blocca).
     */
    level: 'none' | 'popup' | 'locked' | 'promemoria';
    /** Da quando la richiesta è aperta: serve a capire se siamo passati al giorno dopo. */
    since: string | null;
    lockedMessage: string | null;
  }> {
    // RECENSORI degli store: mai bloccati (voce #6f). Se Apple o Google si trovassero davanti a
    // un muro rifiuterebbero la pubblicazione, e non avremmo modo di spiegarglielo.
    const prof = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { isStoreReviewer: true, measuresUnlockedUntil: true },
    })) as { isStoreReviewer: boolean | null; measuresUnlockedUntil: Date | null } | null;
    if (prof?.isStoreReviewer) {
      return { required: false, blocking: false, cycleDate: null, level: 'none', since: null, lockedMessage: null };
    }
    /**
     * SBLOCCO DELLA COACH: toglie il MURO, non la RICHIESTA.
     *
     * Il caso vero (13/8, Giusy). Simone le riapre l'app perché le misure non arrivavano, e la
     * mattina dopo: «nonostante l'hai sbloccata ieri non ha generato il menù». Guardando il codice
     * era inevitabile: questo ramo restituiva `required: false`, quindi **spariva il popup** — la
     * sola cosa che le chiedeva di pesarsi — mentre `cycleNeedsMeasure`, che decide l'erogazione,
     * non guarda `measuresUnlockedUntil` e continuava a trattenere i menu. La cliente si ritrovava
     * senza istruzioni e senza menu, con scritto «arriverà a breve».
     *
     * Nella sostanza lo sblocco resta com'era: la pesata serve comunque, perché senza misura non si
     * eroga (decisione Simone dell'11/8, «ci serve sempre una misura per erogare il menu»). Ma da
     * qui in poi lo DICE, invece di tacere: `required: true`, `blocking: false`, livello
     * `promemoria`. Cade il muro, resta la richiesta.
     */
    const sbloccata = !!prof?.measuresUnlockedUntil && prof.measuresUnlockedUntil.getTime() > Date.now();
    // MONITORAGGIO: il peso **si chiede, non si impone** (decisione Simone 9/8). Gaia lo domanda
    // ogni tanto con una notifica; nessun popup bloccante e nessun blocco dell'app.
    // Senza questo controllo il monitoraggio era la trappola perfetta: nessun menu in arrivo —
    // è un piano che i menu non li prevede — quindi il gate restava «misure iniziali mancanti»
    // per sempre, e chi paga €19 al mese si trovava l'app bloccata da un popup che chiede le
    // misure per un menu che non arriverà. E dopo una settimana di menu di rientro sarebbe
    // scattato anche il blocco di ciclo, con tanto di «contatta la tua coach».
    /**
     * ⚠️ `attivoInCorso` e non un `findFirst` senza `orderBy`: su una cliente con un Monitoraggio che
     * eroga e un piano alimentare in coda, la riga tornava a caso — e metà delle volte il popup
     * bloccante delle misure si riaccendeva su chi è in Monitoraggio, cioè la trappola che il
     * commento qui sopra racconta di aver chiuso.
     */
    const attiviQui = (await this.prisma.subscription.findMany({
      where: { clientId, status: { in: STATI_CON_UN_PIANO as never } },
      select: { id: true, status: true, startDate: true, endDate: true, plan: { select: { period: true } } },
    })) as ({ plan: { period: string | null } | null } & { status: string; startDate: Date | null; endDate: Date | null })[];
    const inMonitoraggio = attivoInCorso(attiviQui);
    if (inMonitoraggio?.plan?.period === 'monitoring') {
      return { required: false, blocking: false, cycleDate: null, level: 'none', since: null, lockedMessage: null };
    }

    const daysPerDelivery = await this.configParams.getNumber('menu_days_delivered', 2);
    const last = await this.prisma.menuDay.findFirst({
      where: { clientId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (!last) {
      // Nessun menu ancora erogato: se il piano è attivo, la finestra è iniziata e mancano le
      // MISURE INIZIALI (punto A), blocca comunque col popup — le misure sbloccano il 1° menu.
      const needsInitial = await this.needsInitialMeasures(clientId);
      return {
        required: needsInitial,
        blocking: needsInitial && !sbloccata,
        cycleDate: null,
        level: needsInitial ? (sbloccata ? 'promemoria' : 'popup') : 'none',
        since: null,
        lockedMessage: null,
      };
    }
    const needs = await this.cycleNeedsMeasure(clientId, last, daysPerDelivery);
    if (!needs) {
      return { required: false, blocking: false, cycleDate: last.date.toISOString().slice(0, 10), level: 'none', since: null, lockedMessage: null };
    }
    // Da quando la misura è dovuta: il ciclo scade `daysPerDelivery` giorni dopo l'ultimo menu.
    const dovutaDa = new Date(last.date.getTime() + daysPerDelivery * 86_400_000);
    const oreDaAllora = (Date.now() - dovutaDa.getTime()) / 3_600_000;
    const oreDiGrazia = await this.configParams.getNumber('measures_lock_after_hours', 24);
    const locked = oreDaAllora >= oreDiGrazia && !sbloccata;
    return {
      required: true,
      // Sbloccata: si chiede, non si impone. Il menu però non arriva finché la pesata non c'è, e
      // questo lo racconta il banner della schermata Menu (`awaiting_cycle_measure`).
      blocking: !sbloccata,
      cycleDate: last.date.toISOString().slice(0, 10),
      level: sbloccata ? 'promemoria' : locked ? 'locked' : 'popup',
      since: dovutaDa.toISOString(),
      lockedMessage: locked
        ? 'Contatta la tua coach per sbloccare la app.'
        : null,
    };
  }

  /**
   * Sblocco concesso dalla coach (voce #6e): riapre l'app per un numero di ore configurabile.
   * È una finestra e non un interruttore: uno sblocco senza scadenza equivarrebbe a spegnere la
   * regola per sempre, e nessuno si ricorderebbe di riaccenderla.
   *
   * ⚠️ **QUATTRO ore, non più quarantotto** (Simone, 11/8: «se diamo il riapri devi dare un timer di
   * 4 ore per poterle reinserire, e ovviamente vanno chieste»). Quarantotto ore erano il peggio dei
   * due mondi: troppo poche perché la cosa si risolvesse da sé, troppe perché qualcuno se ne
   * accorgesse. La finestra serve a fare **una** cosa — pesarsi — e quattro ore bastano; se scadono
   * senza che sia successo, il muro che torna è l'informazione che serve alla coach.
   *
   * L'altra metà della richiesta («vanno chieste») stava già qui — `measurementGate` risponde
   * `required: true, blocking: false` — ma l'app guardava solo `blocking` e faceva **sparire il
   * modulo**: vedi il commento in testa a `app/src/components/MeasuresGate.tsx`.
   */
  async unlockMeasures(clientId: string, staffUserId: string): Promise<{ until: string }> {
    const ore = await this.configParams.getNumber('measures_unlock_hours', 4);
    const until = new Date(Date.now() + ore * 3_600_000);
    await this.prisma.clientProfile.update({
      where: { userId: clientId },
      data: { measuresUnlockedUntil: until } as never,
    });
    await this.audit.log({
      action: 'measures.unlock',
      actorId: staffUserId,
      entityType: 'client_profile',
      entityId: clientId,
      metadata: { until: until.toISOString(), hours: ore },
    });
    // Il messaggio CHIEDE le misure, non annuncia lo sblocco: è il punto della richiesta di Simone
    // dell'8/8 («quando sblocca dobbiamo subito chiedere alla cliente le misure»). Lo sblocco da
    // solo non fa arrivare nessun menu — quello lo sbloccano le misure — quindi dire «app
    // sbloccata» e fermarsi lasciava la cliente a girare in un'app che ancora non le dava il menu,
    // convinta che il problema fosse altrove.
    const titolo = 'Le tue misure 📏';
    const corpo =
      'La tua coach ha riaperto l\'app: inserisci le misure adesso e il menu dei prossimi giorni ' +
      'arriva subito.';
    await this.prisma.notification
      .create({
        data: {
          userId: clientId,
          type: 'measures_unlocked',
          payload: { title: titolo, body: corpo } as never,
          channel: 'inapp',
          scheduledFor: new Date(),
          sentAt: new Date(),
        },
      })
      .catch(() => undefined);
    // E soprattutto sul TELEFONO. La notifica in-app la vede solo chi apre l'app, cioè non chi si è
    // fermata perché l'app era bloccata: la richiesta le arriverebbe solo dopo che ha già fatto da
    // sé la cosa che le stiamo chiedendo. `sendToUser` è silenzioso se le push non sono configurate
    // o se non ha dispositivi registrati, e un errore qui non deve far fallire lo sblocco: la
    // finestra di grazia è già concessa e la coach ha avuto la sua conferma.
    await this.push
      .sendToUser(clientId, titolo, corpo, { type: 'measures_unlocked' })
      .catch(() => undefined);
    return { until: until.toISOString() };
  }

  /**
   * True se il piano è attivo e idoneo a partire (finestra iniziata, non in pausa/vacanza,
   * non supervisionato) ma manca ancora QUALSIASI misura: allora il popup misure blocca
   * l'app finché non arriva il punto A (primo menu trattenuto in deliverIfEligible).
   */
  private async needsInitialMeasures(clientId: string): Promise<boolean> {
    const profile = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { planStartDate: true, screeningFlag: true, idoneita: true, idoneitaVisitaEntro: true, travelState: true, travelStart: true, travelEnd: true } as never,
    })) as {
      planStartDate: Date | null; screeningFlag: boolean | null; idoneita: string | null; idoneitaVisitaEntro: Date | null;
      travelState: string | null; travelStart: Date | null; travelEnd: Date | null;
    } | null;
    if (!profile?.planStartDate) return false;
    // ⚠️ Percorso supervisionato: dipende dalla visita — ma il via libera clinico lo scioglie. Stessa
    // porta di `menuStatus`: se le due divergessero, il popup misure comparirebbe a chi non ha menu
    // (o non comparirebbe a chi li ha).
    if (attendeIlViaLiberaClinico(profile)) return false;
    /**
     * LA VACANZA NON ESENTA PIÙ DALLE MISURE (decisione di Simone, 11/8).
     *
     * Qui c'era `if (statoViaggioAttivo(...) === 'in_vacanza') return false`: chi era in modalità
     * viaggio non si vedeva chiedere niente **e continuava a ricevere i menu**. Su Gioia ha
     * prodotto otto giornate consecutive con una sola pesata: le ultime quattro tarate su un peso
     * di quattro giorni prima, e il fabbisogno si calcola sul peso attuale.
     *
     * La regola nuova, in una riga: **o ricevi menu, e allora le misure valgono come per tutte;
     * oppure sei in pausa, e allora non ricevi menu ma entri nel protocollo di monitoraggio** —
     * che esiste già (`pause.service.surveillanceTick`: peso di riferimento, promemoria, avviso
     * alla coach se risale). Non c'è una terza strada in cui arrivano i menu e nessuno chiede il
     * peso.
     *
     * Vale anche per la dieta «Vacanze in Serenità»: è una dieta come le altre, con i suoi menu,
     * quindi le misure si chiedono con la stessa logica. La modalità viaggio continua a fare
     * l'altra cosa per cui serve — `DietAgentService` la usa per scegliere menu che la cliente
     * mangerà davvero invece di menu che la farebbero calare — e quella non c'entra col peso.
     */
    /**
     * ⚠️ Anche in coda — le misure di partenza si chiedono nella finestra di anteprima, cioè prima
     * che il piano cominci — e ⚠️ la data è quella del **piano scelto**, non quella scritta nel
     * profilo: erano tre punti a rispondere alla stessa domanda («da quando comincia?») e due
     * usavano date diverse. Su una cliente di ritorno la differenza faceva trattenere il menu
     * senza che il popup le chiedesse niente.
     */
    const attiviQui = (await this.prisma.subscription.findMany({
      where: { clientId, status: { in: STATI_CON_UN_PIANO as never } },
      select: { id: true, status: true, startDate: true, endDate: true },
    })) as { id: string; status: string; startDate: Date | null; endDate: Date | null }[];
    const pianoDiAdesso = attivoInCorso(attiviQui);
    if (!pianoDiAdesso) return false;
    const pause = await this.events.activePausePeriod(clientId);
    if (pause) return false;
    const visibleDaysBefore = await this.configParams.getNumber('menu_visible_days_before_start', 2);
    const today = toDateOnly();
    const inizioDelPiano = pianoDiAdesso.startDate ?? profile.planStartDate;
    const start = toDateOnly(inizioDelPiano.toISOString());
    const visibleFrom = new Date(start.getTime() - visibleDaysBefore * 86_400_000);
    if (today.getTime() < visibleFrom.getTime()) return false; // troppo presto
    // La misura di partenza di QUESTO piano, non una qualsiasi mai fatta: `misura-di-partenza.ts`.
    return mancaMisuraDiPartenza(this.prisma, clientId, inizioDelPiano, visibleDaysBefore);
  }

  /**
   * Per quanti giorni vale un «in vacanza» senza data di fine, dai Parametri.
   *
   * Esiste per non lasciare il default del helper (30) come secondo valore nascosto: la scadenza
   * della vacanza è una sola, e la legge anche `DietAgentService` da questa stessa chiave.
   */
  private giorniMassimiViaggio(): Promise<number> {
    return this.configParams.getNumber('travel_max_days', 30);
  }

  /**
   * CHIEDE le misure di partenza, in app e sul telefono, finché il menu resta trattenuto.
   *
   * Il difetto che chiude: il gate sapeva bloccare e non chiedere. Una cliente restava senza menu
   * senza sapere perché — e se non apriva l'app non vedeva nemmeno il popup. La richiesta esisteva
   * solo dopo lo sblocco della coach, cioè solo per chi era già rimasta fuori.
   *
   * Si ripete a distanza (`measures_ask_repeat_days`, 2 giorni) perché una push sola si perde: arriva
   * mentre si guida, si scarta senza leggere, il telefono era spento. Ma non ogni giorno, perché un
   * sollecito quotidiano su una cosa che richiede una bilancia diventa rumore e si impara a
   * ignorarlo. E si spegne da sé: appena la misura arriva il menu non è più trattenuto e questa
   * funzione non viene più chiamata.
   */
  private async chiediMisureDiPartenza(clientId: string): Promise<void> {
    const giorni = await this.configParams.getNumber('measures_ask_repeat_days', 2);
    const da = new Date(Date.now() - Math.max(1, giorni) * 86_400_000);
    const giaChiesto = await this.prisma.notification.findFirst({
      where: { userId: clientId, type: 'measures_required', createdAt: { gte: da } } as never,
      select: { id: true },
    });
    if (giaChiesto) return;

    const titolo = 'Le tue misure di partenza 📏';
    const corpo =
      'Per farti partire mi serve il punto A: inserisci peso e misure in app e il menu dei primi '
      + 'giorni arriva subito.';
    await this.prisma.notification
      .create({
        data: {
          userId: clientId,
          type: 'measures_required',
          payload: { title: titolo, body: corpo } as never,
          channel: 'inapp',
          scheduledFor: new Date(),
          sentAt: new Date(),
        },
      })
      .catch(() => undefined);
    // Sul telefono soprattutto: la notifica in app la vede solo chi l'app la apre, cioè non chi si è
    // fermata proprio perché non le arrivava niente. Silenziosa se le push non sono configurate.
    await this.push
      .sendToUser(clientId, titolo, corpo, { type: 'measures_required' })
      .catch(() => undefined);
  }

  /**
   * CHIEDE la pesata del rientro, in app e sul telefono, finché il menu del rientro resta
   * trattenuto. È la gemella di `chiediMisureDiPartenza`, e per la stessa ragione: un cancello che
   * sa solo bloccare produce una cliente ferma che non sa perché.
   *
   * ⚠️ Il testo dice **la data**. Al rientro da una vacanza «inserisci la pesata» da solo non
   * spiega niente: quello che la fa alzare e prendere la bilancia è sapere che domani ricomincia e
   * che il menu è già pronto dall'altra parte del gesto.
   *
   * Si ripete a distanza come l'altra (`measures_ask_repeat_days`) e si spegne da sé: appena la
   * misura arriva il menu non è più trattenuto e questa funzione non viene più chiamata.
   */
  private async chiediLaPesataDelRientro(clientId: string, rientro: Date): Promise<void> {
    const giorni = await this.configParams.getNumber('measures_ask_repeat_days', 2);
    const da = new Date(Date.now() - Math.max(1, giorni) * 86_400_000);
    const giaChiesto = await this.prisma.notification.findFirst({
      where: { userId: clientId, type: TIPO_PESATA_DEL_RIENTRO, createdAt: { gte: da } } as never,
      select: { id: true },
    });
    if (giaChiesto) return;

    const { titolo, corpo } = testoPesataDelRientro(rientro);
    await this.prisma.notification
      .create({
        data: {
          userId: clientId,
          type: TIPO_PESATA_DEL_RIENTRO,
          payload: { title: titolo, body: corpo } as never,
          channel: 'inapp',
          scheduledFor: new Date(),
          sentAt: new Date(),
        },
      })
      .catch(() => undefined);
    await this.push
      .sendToUser(clientId, titolo, corpo, { type: TIPO_PESATA_DEL_RIENTRO })
      .catch(() => undefined);
  }

  /**
   * True se siamo al 2° giorno (o oltre) del ciclo corrente e manca ancora la
   * misura di quel ciclo. Il 2° giorno = la data più alta erogata (cycleEnd).
   */
  private async cycleNeedsMeasure(
    clientId: string,
    last: { date: Date },
    daysPerDelivery: number,
  ): Promise<boolean> {
    /**
     * QUI C'ERA L'ESENZIONE DELLA VACANZA, ed è la ragione del caso Gioia (11/8).
     *
     * `if (statoViaggioAttivo(...) === 'in_vacanza') return false`: in modalità viaggio il ciclo
     * successivo partiva **senza chiedere niente**. Sul suo piano ha prodotto otto giornate di fila
     * con una sola pesata, erogate puntualmente ogni due giorni — nessun errore da nessuna parte,
     * il codice faceva quello per cui era stato scritto. Il difetto era la regola.
     *
     * La regola nuova (Simone, 11/8): **o ricevi menu e le misure valgono come per tutte, oppure
     * sei in pausa e allora non ricevi menu ma entri nel protocollo di monitoraggio**. Niente terza
     * strada in cui i menu arrivano e nessuno chiede il peso — che è poi la domanda da cui è
     * partito tutto: «come tariamo le kcal se non abbiamo il peso?». Il fabbisogno si calcola sul
     * peso attuale, quindi una settimana di menu su una pesata vecchia è una settimana tarata male.
     *
     * L'erogazione durante una **pausa** è già ferma poco sopra (`activePausePeriod`), e il peso
     * durante la pausa lo chiede `pause.service.surveillanceTick`. Le due strade coprono tutto.
     */
    const today = toDateOnly();
    const cycleEnd = toDateOnly(last.date.toISOString());
    if (today.getTime() < cycleEnd.getTime()) return false; // non ancora al 2° giorno
    const cycleStart = new Date(cycleEnd.getTime() - (daysPerDelivery - 1) * 86_400_000);
    const measure = await this.prisma.measurement.findFirst({
      where: { clientId, date: { gte: cycleStart } },
      select: { id: true },
    });
    return !measure;
  }

  // ---------- Selezione ricette per efficacia + gradimento ----------

  /**
   * Contesto di scoring condiviso: pool ricette per slot (dalla dieta approvata),
   * kcal/quota proteica per ricetta e la funzione punteggio
   * `w_eff·efficacia(MenuWeight) + w_grad·gradimento(stelle)` modulata dallo stato
   * dell'agente. Usato sia dal selettore per-slot sia dalla composizione DayCombo.
   * ⚠️ Un piatto mai votato vale **zero** stelle (12/8): vedi il riquadro sopra `score`.
   */
  /**
   * Override PER DIETA dalle ProductRule: mappa ruleCode → valore. Per le regole numeriche
   * il valore sta in `params.value`; per gli interruttori si usa `enabled`. Robusta anche
   * dove `findMany` non è disponibile (stub sandbox) → nessun override.
   */
  private async dietRuleOverrides(dietId: string): Promise<Map<string, number | boolean>> {
    const rows = (await this.prisma.productRule.findMany?.({
      where: { dietId },
      select: { ruleCode: true, enabled: true, params: true },
    })) ?? [];
    const m = new Map<string, number | boolean>();
    for (const r of rows as { ruleCode: string; enabled: boolean; params: unknown }[]) {
      const v = (r.params as { value?: unknown } | null)?.value;
      if (typeof v === 'number') m.set(r.ruleCode, v);
      else if (typeof v === 'boolean') m.set(r.ruleCode, v);
      else m.set(r.ruleCode, r.enabled);
    }
    return m;
  }

  /** True se la dieta ha la ProductRule `menu_repeat_two_days` attiva (o il default globale). */
  private async isRepeatTwoDaysActive(dietId: string): Promise<boolean> {
    const rule = (await this.prisma.productRule.findUnique({
      where: { dietId_ruleCode: { dietId, ruleCode: 'menu_repeat_two_days' } },
      select: { enabled: true },
    })) as { enabled: boolean } | null;
    if (rule) return rule.enabled;
    return this.configParams.getBool('menu_repeat_two_days_default', false);
  }

  /**
   * "Trova-gemella": data una ricetta del giorno 1, cerca nel pool dello slot una ricetta
   * DIVERSA il cui alimento principale è nello STESSO gruppo di equivalenza (approvato,
   * per questa dieta o globale) e con kcal in banda. Ritorna null se non c'è (→ fallback).
   */
  private async buildTwinFinder(
    dietId: string,
    poolIds: string[],
    ctx: { slotPool: Map<string, Set<string>>; kcalOf: Map<string, number>; score: (id: string) => number },
    tolerance: number,
  ): Promise<(recipeId: string, slot: string, exclude: Set<string>) => string | null> {
    // Alimento principale di ogni ricetta del pool (primo ingrediente).
    const recipes = (await this.prisma.recipe.findMany({
      where: { id: { in: poolIds } },
      select: { id: true, ingredients: true },
    })) as unknown as { id: string; ingredients: unknown }[];
    const primaryFood = new Map<string, string>();
    for (const r of recipes) {
      const items = Array.isArray(r.ingredients) ? (r.ingredients as { name?: string }[]) : [];
      const first = items.find((x) => x?.name)?.name;
      if (first) primaryFood.set(r.id, String(first).trim().toLowerCase());
    }
    // Gruppi di equivalenza APPROVATI (della dieta o globali). Finché il nutrizionista non
    // ne approva, il trova-gemella non trova nulla → la regola resta di fatto inerte (sicuro).
    const groups = (await this.prisma.equivalenceGroup.findMany({
      where: { status: 'approved', OR: [{ productId: dietId }, { productId: null }] } as never,
      select: { id: true, members: true },
    })) as unknown as { id: string; members: unknown }[];
    const foodGroup = (food: string): string | null => {
      for (const g of groups) {
        const items = (((g.members as { items?: string[] })?.items) ?? []).map((s) => String(s).trim().toLowerCase());
        if (items.some((it) => it === food || (it.length > 2 && (it.includes(food) || food.includes(it))))) return g.id;
      }
      return null;
    };
    const groupOfRecipe = (id: string): string | null => {
      const f = primaryFood.get(id);
      return f ? foodGroup(f) : null;
    };
    return (recipeId, slot, exclude) => {
      const g0 = groupOfRecipe(recipeId);
      if (!g0) return null;
      const k0 = ctx.kcalOf.get(recipeId) ?? 0;
      const lo = k0 * (1 - tolerance), hi = k0 * (1 + tolerance);
      const pool = ctx.slotPool.get(slot);
      if (!pool) return null;
      let best: string | null = null, bestScore = -Infinity;
      for (const cand of pool) {
        if (cand === recipeId || exclude.has(cand)) continue;
        if (groupOfRecipe(cand) !== g0) continue;
        const k = ctx.kcalOf.get(cand) ?? 0;
        if (k0 > 0 && (k < lo || k > hi)) continue;
        const s = ctx.score(cand);
        if (s > bestScore) { bestScore = s; best = cand; }
      }
      return best;
    };
  }

  private async buildScoringContext(
    clientId: string,
    regime: string | null,
    templates: { meals: { slot: string; recipeId: string }[] }[],
    state: AgentState = 'normale',
    objective: string = 'dimagrimento',
    overrides: Map<string, number | boolean> = new Map(),
    /** I termini vietati SULLA DIETA (Vera §6.2): il pool non li propone proprio. */
    vietatiDieta: string[] = [],
    /**
     * Le esclusioni **della cliente** (21/8): stessa idea del filtro qui sopra, altra causa. I
     * divieti di dieta li decide la nutrizionista sul catalogo, questi li ha dichiarati lei nel
     * questionario — e fino a oggi non toglievano niente dal pool.
     */
    esclusioniCliente: EsclusioniCliente | null = null,
    /**
     * La FAMIGLIA della variante, per il giorno che il pool arriva dal paniere: il paniere è
     * famiglia × regime, e molte varianti versano nello stesso (strada B). `null` con
     * l'interruttore su `paniere` dà pool vuoto, ed è giusto che si veda invece di ripiegare.
     *
     * ⚠️ **Sta in FONDO apposta**: metterlo in mezzo agli altri sposta tutti i parametri
     * posizionali, e le prove che chiamano questo metodo direttamente cominciano a passare lo stato
     * dell'agente dove ora c'è la famiglia. Un parametro nuovo in mezzo a una firma lunga è un
     * cambio silenzioso su ogni chiamante.
     */
    famigliaPaniere: string | null = null,
  ): Promise<{
    slotPool: Map<string, Set<string>>;
    kcalOf: Map<string, number>;
    proteinOf: Map<string, number>;
    /**
     * ⚠️ **Il piatto ha carne?** `false` = sappiamo che non ne ha; assente = **non lo sappiamo**, e
     * per la regola flexitariana quel dubbio conta come carne. Il verso opposto renderebbe il tetto
     * aggirabile da qualunque ricetta con gli ingredienti scritti male.
     */
    carne: Map<string, boolean>;
    score: (id: string) => number;
    bump: (id: string) => void;
  } | null> {
    if (!regime) return null;

    const [wEffBaseG, wGradBaseG, boostG, proteinBonusG, penaltyRepeatG, repeatWindowDaysG, maintWEffG, penaltyStagioneG] = await Promise.all([
      this.configParams.getNumber('menu_select_w_eff', 1),
      this.configParams.getNumber('menu_select_w_grad', 1),
      this.configParams.getNumber('menu_state_boost', 1.8),
      this.configParams.getNumber('menu_pre_event_protein_bonus', 0.6),
      // R11: penalità di ripetizione (varietà). ATTIVA di default: una ricetta servita di
      // recente viene sfavorita, così la rotazione tende al "meno servito di recente"
      // invece di riproporre sempre il piatto col punteggio più alto.
      this.configParams.getNumber('menu_penalty_repeat', 1),
      this.configParams.getNumber('menu_repeat_window_days', 14),
      // R12: peso efficacia in MANTENIMENTO (default 0 = efficacia neutra).
      this.configParams.getNumber('menu_maintenance_w_eff', 0),
      // Stagionalità (voce #11): quanto pesa proporre un piatto fuori stagione. Alto abbastanza
      // da spostare la scelta quando esiste un'alternativa, non tanto da svuotare il menu quando
      // non esiste. A 0 la regola è spenta.
      this.configParams.getNumber('menu_penalty_season', 0.5),
    ]);
    // Applica gli override PER DIETA (fallback al globale).
    const wEffBase = pickNumOverride(overrides, 'menu_select_w_eff', wEffBaseG);
    const wGradBase = pickNumOverride(overrides, 'menu_select_w_grad', wGradBaseG);
    const boost = pickNumOverride(overrides, 'menu_state_boost', boostG);
    const proteinBonus = pickNumOverride(overrides, 'menu_pre_event_protein_bonus', proteinBonusG);
    const penaltyRepeat = pickNumOverride(overrides, 'menu_penalty_repeat', penaltyRepeatG);
    const repeatWindowDays = pickNumOverride(overrides, 'menu_repeat_window_days', repeatWindowDaysG);
    const maintWEff = pickNumOverride(overrides, 'menu_maintenance_w_eff', maintWEffG);
    const penaltyStagione = pickNumOverride(overrides, 'menu_penalty_season', penaltyStagioneG);
    // Modulazione dei pesi in base allo stato dell'agente.
    let wEff = wEffBase;
    let wGrad = wGradBase;
    // `vacanza` si comporta come il conforto — menu più amati — ma per una ragione diversa:
    // non è umore basso, è che la cliente è via e mangerà quello che le va. Stato separato
    // perché nei log e nelle diagnosi «in vacanza» e «giornata storta» non vanno confusi.
    if (state === 'conforto' || state === 'vacanza') wGrad = wGradBase * boost; // menu più amati
    // plateau / post-evento / rientro → si spinge sull'efficacia (calo/recupero).
    // ⚠️ `plateau_conforto` sta QUI e non sopra: peso fermo e umore basso insieme → comanda
    // l'efficacia (decisione di Simone, 13/8). Il giorno di stelle che le resta lo mette la
    // composizione della giornata, non i pesi: vedi `giornoDiConforto` più sotto.
    else if (state === 'plateau' || state === 'plateau_conforto' || state === 'post_evento' || state === 'rientro') wEff = wEffBase * boost;
    // R12 — modulazione da obiettivo della dieta: in MANTENIMENTO l'efficacia (appresa
    // sul calo peso) diventa neutra — niente spinta al deficit, nemmeno dagli stati che
    // la boosterebbero (plateau/post-evento/rientro); resta il gradimento (+ varietà).
    if (objective === 'mantenimento') wEff = maintWEff;
    const usePreEvent = state === 'pre_evento';

    /**
     * ⛔ **IL POOL PASSA DA UNA PORTA SOLA** (`catalog/pool-del-paniere.ts`, Fase 1 dei panieri).
     *
     * Qui c'erano otto righe che appiattivano `DietDayTemplate.meals`: erano una delle tre copie
     * della stessa domanda — «quali ricette può ricevere questa cliente, per ogni pasto» — e finché
     * sono tre, il giorno che l'appartenenza si sposta sul paniere se ne sposta una e le altre due
     * restano indietro senza che niente lo dica.
     *
     * ⚠️ La sorgente la decide `panieri_sorgente_pool`, e **il default è `giornate`**: con
     * l'interruttore fermo il pool è identico a prima, riga per riga. Si sposta quando il confronto
     * prima/dopo di `npm run panieri:riempi` torna, non prima.
     */
    const sorgente = leggiSorgente(await this.configParams.getString('panieri_sorgente_pool', 'giornate'));
    const righe = sorgente === 'paniere'
      ? await righeDalPaniere(this.prisma as never, famigliaPaniere ?? '', regime)
      : righeDalleGiornate(templates);
    let slotPool = poolPerSlot(righe);

    /**
     * ⛔ **«RITORNO IN EQUILIBRIO»: IL POOL VIENE DAL SUO PASSATO, NON DAL PANIERE** (§6.1, 1/9).
     *
     * Richiesta di Simone del 27/8: *«per chi ha già fatto un percorso con noi, un mese coi menu
     * scelti tra quelli che hanno dato migliori risultati e al cliente più graditi»*.
     *
     * ⚠️ **Si sostituisce solo il POOL**, e la giornata la compone il motore di sempre: così la
     * banda kcal che si allarga dicendolo, la coppia pranzo/cena, la carne a settimana, gli
     * allergeni e le esclusioni continuano a valere. Copiare le giornate intere del passato le
     * salterebbe tutte in un colpo, e una cliente riceverebbe una giornata di tre mesi fa con le
     * esclusioni di allora.
     *
     * ⛔ **E la sostituzione sta QUI**, prima dei filtri sulle esclusioni qui sotto: un pool che
     * arriva dal passato deve passare dagli stessi cancelli di quello che arriva dal paniere. Se
     * si sostituisse dopo, i piatti del suo passato entrerebbero senza controllo — ed è il tipo di
     * scorciatoia che su un'allergia costa cara.
     *
     * ⚠️ Sotto la soglia di storico `poolDalPassatoDi` torna `null` e resta il paniere: un mese
     * costruito su quattro giornate sono quattro giornate girate sette volte.
     */
    if (famigliaPaniere === FAMIGLIA_RITORNO_IN_EQUILIBRIO) {
      /**
       * ⚠️ I due parametri si leggono **qui dentro e solo per questa famiglia**: chiederli a ogni
       * composizione di ogni cliente sarebbe due letture in più per una funzione che riguarda una
       * famiglia sola. E la firma di questo metodo è già lunga: un parametro in più in fondo è la
       * strada che il 31/8 ha rotto le prove posizionali.
       */
      const [acceso, minime] = await Promise.all([
        /**
         * ⚠️ **Spento di default**, come l'interruttore dei panieri: una funzione che cambia da
         * dove arrivano i piatti si accende quando qualcuno ha guardato i numeri, non alla nascita.
         */
        this.configParams.getBool('ritorno_in_equilibrio_acceso', false),
        /**
         * ⚠️ **28: un mese di storico per comporre un mese** (decisione di Simone, 1/9). Sotto
         * questa soglia la funzione non si attiva e la cliente resta sul paniere, che è pieno.
         */
        this.configParams.getNumber('ritorno_in_equilibrio_giornate_minime', 28),
      ]);
      if (acceso) {
        const quante = Math.max(1, minime);
        const dalPassato = await this.poolDalPassatoDi(clientId, quante, quante);
        if (dalPassato) slotPool = dalPassato;
      }
    }

    const poolIds = ricetteDelPool(slotPool);
    if (poolIds.size === 0) return null;

    const [recipes, weights, ratings] = await Promise.all([
      // ⚠️ `name` e `ingredients` servono al divieto di dieta: il termine si cerca nel nome E negli
      // ingredienti, come per le esclusioni delle clienti. Senza, «insalata di riso» col tonno dentro
      // passerebbe, e il divieto sarebbe una decorazione.
      this.prisma.recipe.findMany({ where: { id: { in: [...poolIds] } }, select: { id: true, kcal: true, macros: true, seasons: true, name: true, ingredients: true, allergens: true } }) as Promise<{ id: string; kcal: number; macros: unknown; seasons: string[]; name: string; ingredients: unknown; allergens: string[] }[]>,
      this.prisma.menuWeight.findMany({ where: { clientId }, select: { recipeId: true, score: true, samples: true } }) as Promise<{ recipeId: string; score: number; samples: number }[]>,
      // ⚠️ Solo le stelle DATE: il 3 che l'app scrive quando la cliente tocca solo «Seguita / Non
      // seguita» non è un'opinione, e qui deciderebbe cosa riproporle. Vedi `stelle-che-contano.ts`.
      this.prisma.recipeRating.findMany({
        where: { clientId, ...SOLO_STELLE_DATE },
        select: { recipeId: true, stars: true },
      }) as Promise<{ recipeId: string; stars: number }[]>,
    ]);

    /**
     * ⚠️ IL FILTRO A MONTE: le ricette vietate dalla dieta escono dal pool, quindi non vengono
     * nemmeno prese in considerazione. La guardia su `evaluateMeals` resta comunque, perché è il
     * punto obbligato di ogni erogazione: qui si evita di proporle, lì si evita di servirle.
     */
    if (vietatiDieta.length) {
      const fuori = ricetteVietate(recipes, vietatiDieta);
      if (fuori.size) {
        for (const [slot, ids] of slotPool) {
          const restano = new Set([...ids].filter((id) => !fuori.has(id)));
          // ⚠️ Uno slot che resterebbe VUOTO non si svuota: quella cliente resta com'era e finisce
          // nell'elenco di chi va guardata (decisione di Simone, 13/8). Svuotarlo qui vorrebbe dire
          // una giornata senza un pasto, che è peggio del piatto che si voleva togliere.
          if (restano.size > 0) slotPool.set(slot, restano);
          else
            /**
             * ⛔ **E LO SI DICE** (23/8, trovato in revisione). Questo ramo taceva: lo slot si
             * teneva il pool intero — ricette vietate comprese — e la cliente si vedeva servito
             * esattamente il piatto che la regola doveva toglierle, senza una riga da nessuna
             * parte. ⚠️ La guardia non rimedia: i termini di dieta arrivano come «non graditi»,
             * quindi non bloccano, e la sostituzione salta in silenzio se non trova un tier.
             * L'elenco delle scoperte esiste ma si calcola **solo** quando il capo approva: da lì
             * in poi, se il catalogo si assottiglia, nessuno lo sa più.
             * ⚠️ Il ramo gemello venti righe sotto (le esclusioni della cliente) questo avviso ce
             * l'ha da sempre: due rami che fanno la stessa cosa e solo uno che la racconta è il
             * modo in cui una regola smette di valere senza che nessuno se ne accorga.
             */
            this.logger.warn(
              `Divieto di dieta: per lo slot "${slot}" di ${clientId} resterebbero ZERO ricette ` +
                `(${fuori.size} vietate su ${ids.size}): il divieto NON si applica a questo pasto e ` +
                'la cliente riceve il piatto vietato. Va guardata (`npm run diag:esclusioni`).',
            );
        }
      }
    }

    /**
     * ⚠️ **LO STESSO FILTRO, PER LE ESCLUSIONI DELLA CLIENTE** — 21/8, il caso Sonia.
     *
     * Sei allergie dichiarate (fra cui molluschi e solfiti) e **zero menu**: il motore pescava
     * «Polpo grigliato» dal pool, e `evaluateMeals` fermava tutta l'erogazione. Il blocco era
     * giusto; sbagliata era la scelta, perché nel pool c'erano altri piatti e nessuno stava
     * togliendo quelli che poi avremmo vietato.
     *
     * ⚠️ Escono solo le ricette con una **violazione**, cioè quelle che non si potrebbero servire
     * comunque. Quelle solo **sostituibili** restano: il piatto si eroga con la sostituzione
     * annotata, ed è quello che la cliente si aspetta di ricevere.
     *
     * ⚠️ Uno slot che resterebbe VUOTO non si svuota, identico alla regola qui sopra (Simone,
     * 13/8): se per un pasto non esiste niente di sicuro la giornata non si compone lo stesso, ma
     * a fermarla dev'essere la guardia — che sa dire cosa e perché — non un pool azzerato in
     * silenzio.
     */
    if (esclusioniCliente && !esclusioniCliente.vuoto) {
      const fuori = ricetteNonSicure(recipes, esclusioniCliente);
      if (fuori.size) {
        for (const [slot, ids] of slotPool) {
          const restano = new Set([...ids].filter((id) => !fuori.has(id)));
          if (restano.size > 0) slotPool.set(slot, restano);
          else
            this.logger.warn(
              `Esclusioni: per lo slot "${slot}" di ${clientId} nessuna ricetta del pool è sicura ` +
                `(${fuori.size} scartate su ${ids.size}). La giornata la fermerà la guardia.`,
            );
        }
        this.logger.log(
          `Esclusioni: ${fuori.size} ricette tolte dal pool di ${clientId} prima della composizione ` +
            `(la prima: ${[...fuori.values()][0]}).`,
        );
      }
    }
    const kcalOf = new Map(recipes.map((r) => [r.id, r.kcal]));
    const effOf = new Map(weights.map((w) => [w.recipeId, w.samples > 0 ? w.score / w.samples : 0]));
    const starOf = new Map<string, number>();
    for (const r of ratings) starOf.set(r.recipeId, Math.max(starOf.get(r.recipeId) ?? 0, r.stars));

    // R11 — penalità di ripetizione: quante volte ogni ricetta è stata servita di recente
    // (finestra `menu_repeat_window_days`). Interroga solo se la penalità è attiva (>0).
    const recentCount = new Map<string, number>();
    if (penaltyRepeat > 0) {
      const since = new Date(Date.now() - repeatWindowDays * 86_400_000);
      const recentDays = (await this.prisma.menuDay.findMany({
        where: { clientId, date: { gte: since } },
        select: { meals: true },
      })) as { meals: unknown }[];
      for (const d of recentDays) {
        for (const m of (d.meals as { recipeId?: string }[]) ?? []) {
          if (m?.recipeId) recentCount.set(m.recipeId, (recentCount.get(m.recipeId) ?? 0) + 1);
        }
      }
    }
    // Quota proteica (0..1) dai macro, per lo stato pre-evento e per DayCombo.
    const proteinOf = new Map<string, number>();
    for (const r of recipes) {
      const m = r.macros as { protein_g?: number; carbs_g?: number; fat_g?: number } | null;
      const tot = (m?.protein_g ?? 0) + (m?.carbs_g ?? 0) + (m?.fat_g ?? 0);
      proteinOf.set(r.id, tot > 0 ? (m?.protein_g ?? 0) / tot : 0);
    }

    // STAGIONALITÀ (voce #11): una cliente si è vista proporre lo spezzatino a luglio.
    // Regola MORBIDA per decisione di Simone: fuori stagione il piatto è PENALIZZATO, non escluso.
    // Con un catalogo ancora da classificare, escludere lascerebbe buchi nei menu — e un piatto
    // fuori stagione è meno grave di una cena mancante. Ricetta senza stagioni = buona sempre,
    // quindi finché nessuno classifica nulla il comportamento non cambia di una virgola.
    const stagioneOggi = stagioneCorrente();
    const fuoriStagione = new Set<string>();
    for (const r of recipes) {
      const st = r.seasons ?? [];
      if (st.length > 0 && !st.includes(stagioneOggi)) fuoriStagione.add(r.id);
    }

    /**
     * La formula sta in `punteggio.ts` dal 12/8, fuori da questa closure: è la riga che decide cosa
     * una persona si trova nel piatto domani mattina, e qui dentro non la guardava nessun test —
     * infatti ci è rimasto per mesi un difetto che invertiva proprio il caso a cui serviva di più
     * (un piatto mai votato valeva CINQUE stelle, vedi `STELLE_SE_MAI_VOTATA`).
     */
    const pesi: PesiPunteggio = { wEff, wGrad, proteinBonus, penaltyRepeat, penaltyStagione, usePreEvent };
    const score = (id: string) =>
      punteggioRicetta(
        {
          efficacia: effOf.get(id),
          // `undefined` = mai votato, ed è diverso da «votato zero»: lo decide `punteggio.ts`.
          stelle: starOf.get(id),
          proteina: proteinOf.get(id),
          volteDiRecente: recentCount.get(id),
          fuoriStagione: fuoriStagione.has(id),
        },
        pesi,
      );

    // Conta come "servita di recente" anche una ricetta appena scelta in QUESTO ciclo: senza
    // questo, i 2 giorni erogati insieme venivano composti con lo stesso identico punteggio e
    // finivano per ripetere gli stessi piatti.
    const bump = (id: string) => recentCount.set(id, (recentCount.get(id) ?? 0) + 1);

    /**
     * ⚠️ Il verdetto sulla carne si calcola **una volta per pool**, non a ogni giornata: gli stessi
     * nomi e gli stessi ingredienti riletti sette volte sono lavoro sprecato. E si usa la stessa
     * porta della derivazione pescetariana — un secondo elenco di carni è un elenco che diverge.
     */
    const carne = new Map<string, boolean>();
    for (const r of recipes) {
      const nomi = Array.isArray(r.ingredients)
        ? (r.ingredients as { name?: unknown }[]).map((i) => String(i?.name ?? '')).filter(Boolean)
        : [];
      carne.set(r.id, verdettoPescetariano(r.name, nomi) === 'carne');
    }

    return { slotPool, kcalOf, proteinOf, carne, score, bump };
  }

  /**
   * Selettore per-slot: per ogni slot sceglie, TRA le ricette che la dieta approvata
   * usa per quello slot, quella col punteggio migliore, con vincolo kcal (±tol attorno
   * alla ricetta del template). A parità di punteggio resta la ricetta del template.
   */
  private selectorFromContext(
    ctx: { slotPool: Map<string, Set<string>>; kcalOf: Map<string, number>; score: (id: string) => number } | null,
    tol: number,
  ): (meals: { slot: string; recipeId: string }[]) => { slot: string; recipeId: string }[] {
    if (!ctx) return (meals) => meals;
    const { slotPool, kcalOf, score } = ctx;
    return (meals) =>
      meals.map((m) => {
        const pool = slotPool.get(m.slot);
        const baseKcal = kcalOf.get(m.recipeId);
        if (!pool || baseKcal == null) return m;
        const lo = baseKcal * (1 - tol);
        const hi = baseKcal * (1 + tol);
        let bestId = m.recipeId;
        let bestScore = score(m.recipeId);
        for (const cand of pool) {
          if (cand === m.recipeId) continue;
          const ck = kcalOf.get(cand);
          if (ck == null || ck < lo || ck > hi) continue; // vincolo bilanciamento
          const s = score(cand);
          if (s > bestScore + 1e-9) {
            bestScore = s;
            bestId = cand;
          }
        }
        return { slot: m.slot, recipeId: bestId };
      });
  }

  // ---------- Varietà: nessun piatto ripetuto a ridosso nello stesso slot ----------

  /**
   * Ultimi `gapDays` giorni già erogati, riletti per slot (dal più recente): serve a sapere
   * cosa la cliente ha appena mangiato a colazione/pranzo/cena prima di comporre i nuovi giorni.
   */
  private async recentSlotHistory(clientId: string, before: Date, gapDays: number): Promise<Map<string, string[]>> {
    const rows = (await this.prisma.menuDay.findMany({
      where: { clientId, date: { lt: before } },
      select: { meals: true },
      orderBy: { date: 'desc' },
      take: gapDays,
    })) as { meals: unknown }[];
    const hist = new Map<string, string[]>();
    for (const r of rows) {
      for (const m of ((r.meals as { slot?: string; recipeId?: string }[]) ?? [])) {
        if (!m?.slot || !m.recipeId) continue;
        const list = hist.get(m.slot) ?? [];
        if (list.length < gapDays) list.push(m.recipeId);
        hist.set(m.slot, list);
      }
    }
    return hist;
  }

  /**
   * IL POOL DI «RITORNO IN EQUILIBRIO», COSTRUITO DAL PASSATO DI QUESTA CLIENTE — §6.1.
   *
   * ⚠️ Richiesta di Simone del 27/8: *«per chi ha già fatto un percorso con noi, un mese coi menu
   * scelti tra quelli che hanno dato migliori risultati e al cliente più graditi»*.
   *
   * ⛔ **Torna `null` quando non si può fare**, e chi chiama tiene il paniere: sotto la soglia di
   * storico, senza segnali, o se il pool uscisse monco. «Un mese dei tuoi piatti migliori»
   * costruito su quattro giornate sono quattro giornate girate sette volte — meglio il paniere
   * normale, che è pieno.
   *
   * ⚠️ **I due segnali sono quelli che il progetto ha già**: il calo di peso attorno a quella
   * giornata e le stelle date ai suoi piatti. Nessun dato nuovo, nessuna migrazione — è la
   * differenza fra una funzione che si può accendere domani e una che chiede sei mesi di raccolta.
   */
  private async poolDalPassatoDi(clientId: string, quante: number, soglia: number): Promise<Map<string, Set<string>> | null> {
    const [giornate, misure, stelle] = await Promise.all([
      this.prisma.menuDay.findMany({
        where: { clientId, date: { lt: toDateOnly() } },
        select: { date: true, meals: true },
        orderBy: { date: 'desc' },
        take: 400,
      }) as unknown as Promise<{ date: Date; meals: unknown }[]>,
      this.prisma.measurement.findMany({
        where: { clientId },
        select: { date: true, weightKg: true },
        orderBy: { date: 'asc' },
      }) as unknown as Promise<{ date: Date; weightKg: number }[]>,
      this.prisma.recipeRating.findMany({
        where: { clientId, ...SOLO_STELLE_DATE },
        select: { recipeId: true, stars: true },
      }) as unknown as Promise<{ recipeId: string; stars: number }[]>,
    ]);
    if (giornate.length < soglia) return null;

    const stelleDi = new Map<string, number[]>();
    for (const r of stelle) stelleDi.set(r.recipeId, [...(stelleDi.get(r.recipeId) ?? []), r.stars]);

    const candidate: GiornataDelPassato[] = giornate.map((g) => {
      const pasti = ((g.meals as { slot?: string; recipeId?: string }[]) ?? [])
        .filter((m) => m?.slot && m?.recipeId)
        .map((m) => ({ slot: m.slot as string, recipeId: m.recipeId as string }));

      /**
       * ⚠️ Il calo **attorno** a quella giornata: la pesata più vicina prima e la prima entro tre
       * giorni dopo. `null` quando mancano — e `null` non è zero, lo dice la porta che ordina.
       */
      const quando = g.date.getTime();
      let prima: number | null = null;
      let dopo: number | null = null;
      for (const m of misure) {
        const t = m.date.getTime();
        if (t <= quando) prima = m.weightKg;
        else if (dopo === null && t <= quando + 3 * 86_400_000) dopo = m.weightKg;
      }

      const voti = pasti.flatMap((m) => stelleDi.get(m.recipeId) ?? []);
      return {
        chiave: g.date.toISOString().slice(0, 10),
        caloKg: prima !== null && dopo !== null ? dopo - prima : null,
        gradimento: voti.length ? voti.reduce((a, v) => a + v, 0) / voti.length : null,
        recenza: quando,
        pasti,
      };
    });

    const esito = poolDalPassato(candidate, quante, soglia);
    if (!esito) return null;
    if (esito.avviso) {
      this.logger.warn(`Ritorno in Equilibrio: per ${clientId} il mese è più povero del previsto — ${esito.avviso}`);
    }
    return esito.pool;
  }

  /**
   * LE GIORNATE IN CUI LA CARNE È GIÀ ARRIVATA, nell'ultima settimana (regola flexitariana, 1/9).
   *
   * ⚠️ Si torna il **numero di giorni dall'epoca**, non le date: le giornate già servite e quelle
   * che si stanno componendo finiscono così sulla stessa scala, e la finestra scorrevole le
   * confronta senza conversioni — che è il punto in cui questo genere di conti sbaglia.
   *
   * ⛔ **Una ricetta che non conosciamo conta come carne.** Se un piatto è stato cancellato dal
   * catalogo non possiamo sapere cosa conteneva, e dire «allora era senza» regalerebbe una volta
   * di carne in più a ogni buco dello storico.
   */
  private async giornateConCarneRecenti(clientId: string, before: Date): Promise<number[]> {
    const rows = (await this.prisma.menuDay.findMany({
      where: { clientId, date: { lt: before } },
      select: { date: true, meals: true },
      orderBy: { date: 'desc' },
      take: GIORNI_DELLA_FINESTRA,
    })) as { date: Date; meals: unknown }[];
    if (!rows.length) return [];

    /**
     * ⚠️ **Scritto come una raccolta di id, non come un pool** — e la forma conta, perché
     * `una-porta-per-il-pool.spec.ts` ha gridato sulla prima stesura di queste righe e aveva
     * ragione a chiedere spiegazioni: leggere `.meals` e accumulare `recipeId` è *esattamente* la
     * forma di chi si costruisce un pool per conto suo, cioè il difetto che quella sentinella
     * esiste per impedire.
     *
     * ⛔ Qui la domanda è un'altra — «in quali giorni è arrivata la carne» — e non produce nessuna
     * mappa `slot → ricette`: serve solo a chiedere al database cosa contenevano quei piatti. La
     * forma è cambiata perché la sostanza è diversa, non per zittire il guardiano.
     */
    const ids = new Set(
      rows.flatMap((r) => ((r.meals as { recipeId?: string }[]) ?? []).map((m) => m?.recipeId).filter(Boolean) as string[]),
    );
    if (!ids.size) return [];

    const ricette = (await this.prisma.recipe.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, name: true, ingredients: true },
    })) as { id: string; name: string; ingredients: unknown }[];
    const eCarneQuesta = new Map<string, boolean>();
    for (const r of ricette) {
      const nomi = Array.isArray(r.ingredients)
        ? (r.ingredients as { name?: unknown }[]).map((i) => String(i?.name ?? '')).filter(Boolean)
        : [];
      eCarneQuesta.set(r.id, verdettoPescetariano(r.name, nomi) === 'carne');
    }

    const out: number[] = [];
    for (const r of rows) {
      const pasti = ((r.meals as { recipeId?: string }[]) ?? []).filter((m) => m?.recipeId);
      // ⚠️ `!== false`: una ricetta sparita dal catalogo non è «senza carne», è ignota.
      if (pasti.some((m) => eCarneQuesta.get(m.recipeId as string) !== false)) {
        out.push(Math.floor(r.date.getTime() / 86_400_000));
      }
    }
    return out;
  }

  /**
   * LE COPPIE PRANZO/CENA GIÀ SERVITE negli ultimi `giorni` (richiesta di Simone, 26/8).
   *
   * ⚠️ Si legge dagli snapshot di `menu_day`, che è dove la coppia esiste davvero — la giornata
   * servita, non quella progettata. Non c'è un indice sulle coppie e non serve: la finestra è di
   * qualche decina di giorni **per una cliente**, cioè qualche decina di righe.
   *
   * ⚠️ `take` è la finestra in giorni e non un numero fisso: una cliente ha al massimo una giornata
   * per data (`@@unique([clientId, date])`), quindi le due cose coincidono.
   */
  private async coppieRecenti(clientId: string, before: Date, giorni: number): Promise<Set<string>> {
    const out = new Set<string>();
    if (giorni <= 0) return out;
    const rows = (await this.prisma.menuDay.findMany({
      where: { clientId, date: { lt: before } },
      select: { meals: true },
      orderBy: { date: 'desc' },
      take: giorni,
    })) as { meals: unknown }[];
    for (const r of rows) {
      const coppia = coppiaDellaGiornata((r.meals as { slot?: string; recipeId?: string }[]) ?? []);
      if (coppia) out.add(coppia);
    }
    return out;
  }

  /** Aggiunge il giorno appena composto in testa allo storico (finestra `gapDays`). */
  private pushSlotHistory(history: Map<string, string[]>, meals: { slot: string; recipeId: string }[], gapDays: number): void {
    if (gapDays <= 0) return;
    for (const m of meals) {
      const list = history.get(m.slot) ?? [];
      list.unshift(m.recipeId);
      if (list.length > gapDays) list.length = gapDays;
      history.set(m.slot, list);
    }
  }

  /**
   * Guard di varietà: se il piatto scelto per uno slot è già stato servito in quello slot
   * negli ultimi `gapDays` giorni, lo sostituisce con la migliore alternativa DEL POOL della
   * dieta approvata, entro ±tol kcal (così il bilanciamento della giornata non cambia) e non
   * usata di recente. Se un'alternativa valida non esiste, il piatto resta com'è.
   */
  private applyVarietyGuard(
    chosen: { slot: string; recipeId: string }[],
    history: Map<string, string[]>,
    ctx: { slotPool: Map<string, Set<string>>; kcalOf: Map<string, number>; score: (id: string) => number } | null,
    tol: number,
    gapDays: number,
  ): { slot: string; recipeId: string }[] {
    if (!ctx || gapDays <= 0) return chosen;
    const usedToday = new Set<string>(); // nessun piatto due volte nella stessa giornata
    return chosen.map((m) => {
      const recent = history.get(m.slot) ?? [];
      const pool = ctx.slotPool.get(m.slot);
      const baseKcal = ctx.kcalOf.get(m.recipeId);
      const keep = () => { usedToday.add(m.recipeId); return m; };
      if (!recent.includes(m.recipeId) && !usedToday.has(m.recipeId)) return keep();
      if (!pool || baseKcal == null) return keep();
      const lo = baseKcal * (1 - tol);
      const hi = baseKcal * (1 + tol);
      let bestId: string | null = null;
      let bestScore = -Infinity;
      for (const cand of pool) {
        if (cand === m.recipeId || usedToday.has(cand) || recent.includes(cand)) continue;
        const ck = ctx.kcalOf.get(cand);
        if (ck == null || ck < lo || ck > hi) continue; // vincolo bilanciamento
        const s = ctx.score(cand);
        if (s > bestScore) { bestScore = s; bestId = cand; }
      }
      if (!bestId) return keep();
      usedToday.add(bestId);
      return { slot: m.slot, recipeId: bestId };
    });
  }

  /** kcal obiettivo del livello dalla configurazione `Diet.levels` ([{level,kcal}]). */
  private levelTargetKcal(levels: unknown, level: number): number {
    const arr = (levels as { level?: number; kcal?: number }[] | null) ?? [];
    const hit = Array.isArray(arr) ? arr.find((l) => l?.level === level) : undefined;
    return hit?.kcal ?? 0;
  }


  /** Pool DayCombo (RecipeInfo per slot) dal contesto di scoring. */
  private dayComboPools(ctx: {
    slotPool: Map<string, Set<string>>;
    kcalOf: Map<string, number>;
    proteinOf: Map<string, number>;
    score: (id: string) => number;
    carne?: Map<string, boolean>;
  }, salta: Set<string> = new Set(), strutturaDellaDieta?: ReadonlySet<string>): { slots: string[]; poolBySlot: Map<string, RecipeInfo[]> } {
    // Gli slot saltati escono PRIMA della composizione, non dopo: così il target kcal della
    // giornata viene ridistribuito sui pasti rimasti invece di lasciare un buco.
    // ⛔ Quanti pasti ci sono lo dice la SUA dieta, non il paniere: vedi `struttura-della-giornata.ts`.
    const slots = slotDaComporre({ strutturaDellaDieta, chiaviDelPool: ctx.slotPool.keys(), salta });
    const poolBySlot = new Map<string, RecipeInfo[]>();
    /**
     * ⚠️ Si gira sugli **slot scelti**, non sulle chiavi del pool: uno slot della sua struttura che
     * nel paniere non ha nemmeno un piatto deve arrivare a `compose` **vuoto**, così la
     * composizione torna `null` e si ripiega sulla giornata pre-costruita. Se sparisse e basta, la
     * giornata uscirebbe con un pasto in meno e con le kcal ridistribuite come se fosse voluto.
     */
    for (const slot of slots) {
      const ids = ctx.slotPool.get(slot) ?? new Set<string>();
      poolBySlot.set(
        slot,
        [...ids].map((id) => ({
          id,
          kcal: ctx.kcalOf.get(id) ?? 0,
          proteinShare: ctx.proteinOf.get(id) ?? 0,
          // ⚠️ `undefined` quando non lo sappiamo: la regola lo tratta come carne, di proposito.
          conCarne: ctx.carne?.get(id),
          score: ctx.score(id),
        })),
      );
    }
    return { slots, poolBySlot };
  }

  /**
   * Se un cibo NON gradito è l'ingrediente PRINCIPALE (compare nel NOME del piatto),
   * sostituire l'ingrediente non basta: si cambia PIATTO con un'alternativa equivalente
   * (stesso slot, stesso regime, kcal più vicine, senza cibi esclusi/intolleranze).
   * Muta i MealSnapshot passati e ritorna gli scambi fatti (from→to).
   */
  /**
   * Pool di ricette SEMPLICI (difficulty="semplice", attive) per gli slot richiesti, filtrate
   * sulle esclusioni della cliente (allergie + intolleranze + cibi non graditi, espanse per
   * categoria: es. "legumi" → ceci, lenticchie…). Usato quando la cliente ha attivato
   * "preferisco ricette semplici". Ritorna solo ricette dello stesso regime del piano.
   */
  private async buildSimpleSlotPool(
    regime: string | null,
    slots: string[],
    excludeTerms: string[],
  ): Promise<Map<string, { id: string; name: string; kcal: number }[]>> {
    const out = new Map<string, { id: string; name: string; kcal: number }[]>();
    if (!regime || slots.length === 0) return out;
    const excluded = new Set<string>();
    for (const t of excludeTerms) for (const kw of expandExclusion(t)) excluded.add(kw);
    const recipes = (await this.prisma.recipe.findMany({
      // ⚠️ Fase 2 (1/9): per lo spuntino si chiede al catalogo anche la merenda, e viceversa.
      where: { regime, active: true, difficulty: 'semplice', mealSlot: { in: slotDaChiedere(slots) as never } },
      select: { id: true, name: true, kcal: true, mealSlot: true, ingredients: true },
    })) as { id: string; name: string; kcal: number; mealSlot: string; ingredients: unknown }[];
    for (const r of recipes) {
      const txt = (r.name + ' ' + (((r.ingredients as { name?: string }[]) ?? []).map((i) => i?.name ?? '').join(' '))).toLowerCase();
      if (hitsExclusion(txt, excluded)) continue;
      /**
       * ⚠️ Si indicizza sugli slot **chiesti**, non su quello scritto in catalogo: una merenda
       * pescata per servire lo spuntino deve finire sotto `morning_snack`, altrimenti chi legge
       * `out.get('morning_snack')` non la trova e l'allargamento non serve a niente. Un piatto
       * scambiabile compare sotto tutti e due, ed è la stessa ricetta: la sceglie una volta sola.
       */
      for (const s of slots) {
        if (!puoStareNelloSlot(r.mealSlot, s)) continue;
        if (!out.has(s)) out.set(s, []);
        out.get(s)!.push({ id: r.id, name: r.name, kcal: r.kcal });
      }
    }
    // Ordine deterministico (per kcal, poi id) così la rotazione per giorno è stabile.
    for (const list of out.values()) list.sort((a, b) => a.kcal - b.kcal || a.id.localeCompare(b.id));
    return out;
  }

  /**
   * Applica la preferenza "ricette semplici": per ogni pasto, se esistono alternative semplici
   * entro ±tol kcal (bilanciamento), ne sceglie una ruotando per giorno (dayIndex) — così i
   * piatti semplici si alternano tra loro e, quando il pool è limitato, con quelli esistenti.
   *
   * VARIETÀ: la rotazione `dayIndex % fits.length` degenera a piatto FISSO quando in banda
   * kcal resta una sola ricetta semplice — ed è il caso più comune, perché il pool semplice è
   * piccolo. Con lo storico si preferisce sempre un'alternativa non servita di recente; se non
   * ce n'è, si tiene il piatto del piano (che il guard di varietà ha già reso diverso da ieri)
   * anziché ripetere. Solo se anche quello è recente si ricade sulla rotazione storica.
   */
  private applySimplePreference(
    meals: MealSnapshot[],
    simpleBySlot: Map<string, { id: string; name: string; kcal: number }[]>,
    tol: number,
    dayIndex: number,
    history?: Map<string, string[]>,
  ): MealSnapshot[] {
    const rotate = (list: { id: string; name: string; kcal: number }[]) =>
      list[((dayIndex % list.length) + list.length) % list.length];
    return meals.map((m) => {
      const pool = simpleBySlot.get(m.slot);
      if (!pool || pool.length === 0) return m;
      const lo = m.kcal * (1 - tol);
      const hi = m.kcal * (1 + tol);
      const fits = pool.filter((c) => c.id !== m.recipeId && c.kcal >= lo && c.kcal <= hi);
      if (fits.length === 0) return m;
      const recent = new Set(history?.get(m.slot) ?? []);
      const fresh = fits.filter((c) => !recent.has(c.id));
      // 1) un piatto semplice mai servito di recente: è la scelta migliore, soddisfa
      //    la preferenza della cliente senza ripetere.
      if (fresh.length) {
        const pick = rotate(fresh);
        return { slot: m.slot, recipeId: pick.id, name: pick.name, kcal: pick.kcal, substitutions: m.substitutions };
      }
      // 2) tutte le semplici sono già state servite di recente: se il piatto del piano non lo
      //    è, si tiene quello. La varietà percepita conta più della preferenza di stile.
      if (!recent.has(m.recipeId)) return m;
      // 3) anche il piatto del piano è recente: nessuna opzione fresca, rotazione storica.
      const pick = rotate(fits);
      return { slot: m.slot, recipeId: pick.id, name: pick.name, kcal: pick.kcal, substitutions: m.substitutions };
    });
  }

  /**
   * Sostituisce i piatti che contengono un cibo non gradito. È l'ULTIMO passaggio prima del
   * salvataggio, quindi riscrive quanto composto a monte: due accortezze lo rendono innocuo.
   *
   * `dietPool` (id delle ricette dei template, per pasto) fa cercare l'alternativa PRIMA
   * dentro la dieta: senza, si pescava dall'intero catalogo filtrato per `regime` della
   * cliente, e un piano di pesce registrato onnivoro finiva per servire carne.
   *
   * `history` (piatti già serviti in quel pasto negli ultimi `varietyGap` giorni) evita che
   * la scelta — deterministica, la più vicina in kcal — riproponga sempre lo stesso
   * sostituto, annullando la garanzia di varietà applicata in composizione.
   */
  private async swapDislikedDishes(
    clientId: string,
    meals: MealSnapshot[],
    dislikes: string[],
    dietPool?: Map<string, Set<string>>,
    history?: Map<string, string[]>,
  ): Promise<{ from: string; to: string }[]> {
    const dl = dislikes.map((s) => s.toLowerCase().trim()).filter((s) => s.length >= 2);
    if (!dl.length) return [];
    /**
     * ⛔ **`allergies` MANCAVA QUI, e questo pezzo gira DOPO la guardia.** Trovato il 31/8 con
     * `diag:allergeni-piatto`: **Sonia** — allergica a crostacei, pesce, solfiti, lupini, molluschi
     * e soia, e **senza intolleranze** — aveva in menu «Gamberoni al cartoccio», con la parola
     * *crostacei* e il tag confermato.
     *
     * Il come è tutto in tre righe. Questo `select` non chiedeva `allergies`, quindi l'insieme
     * `excluded` qui sotto non le conteneva; il candidato si giudicava sul **testo** e i tag
     * allergene non si leggevano affatto; e `swapDislikedDishes` viene chiamato **dopo**
     * `evaluateMeals`, senza nessun secondo controllo. Risultato: la guardia approvava la giornata,
     * poi questo pezzo ci infilava dentro un piatto col suo allergene, e nessuno lo fermava più.
     *
     * ⚠️ **È il verso pericoloso.** Il caso Patrizia, lo stesso giorno, sbaglia per eccesso: non
     * eroga. Questo eroga, e mette un allergene nel piatto di una persona.
     *
     * ✅ Adesso il giudizio su un candidato è **la stessa `valutaRicetta` della guardia**, con le
     * stesse esclusioni: *se due punti rispondono alla stessa domanda, uno deve chiamare l'altro*.
     * Il filtro per testo resta sopra — è più largo sui non graditi — ma non è più l'unico.
     */
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { regime: true, allergies: true, intolerances: true, dislikedFoods: true },
    });
    /** Le esclusioni vere della cliente, allergie comprese: le stesse che legge `evaluateMeals`. */
    const esclusioni = esclusioniDi(profile as ProfiloConEsclusioni | null);
    // Un piatto alternativo non deve contenere NIENTE di escluso (né il cibo indicato,
    // né gli altri non graditi, né le parole chiave delle intolleranze).
    const excluded = new Set<string>();
    for (const term of dl) for (const kw of expandExclusion(term)) excluded.add(kw);
    for (const intol of ((profile?.intolerances ?? []) as string[])) {
      for (const kw of expandExclusion(intol)) excluded.add(kw);
    }
    // Cibi non graditi: espansi per CATEGORIA (es. "frutta secca"/"legumi" → noci, ceci…).
    for (const d of ((profile?.dislikedFoods ?? []) as string[])) {
      for (const kw of expandExclusion(d)) excluded.add(kw);
    }

    // Trigger dello swap = SOLO i cibi non graditi (dl + dislikedFoods), espansi per categoria.
    // Le intolleranze NON triggerano lo swap qui: sono gestite (ed eventualmente bloccanti) da
    // evaluateMeals a monte. Il piatto va cambiato se il cibo compare nel NOME o tra gli INGREDIENTI.
    const triggerKeys = new Set<string>();
    for (const term of dl) for (const kw of expandExclusion(term)) triggerKeys.add(kw);
    for (const d of ((profile?.dislikedFoods ?? []) as string[])) for (const kw of expandExclusion(d)) triggerKeys.add(kw);
    const mealRecipeIds = [...new Set(meals.map((m) => m.recipeId))];
    const mealRecipes = mealRecipeIds.length
      ? ((await this.prisma.recipe.findMany({ where: { id: { in: mealRecipeIds } }, select: { id: true, ingredients: true } })) as { id: string; ingredients: unknown }[])
      : [];
    const ingTextById = new Map<string, string>(
      mealRecipes.map((r) => [r.id, (((r.ingredients as { name?: string }[]) ?? []).map((i) => i?.name ?? '').join(' ')).toLowerCase()]),
    );

    type Cand = { id: string; name: string; kcal: number; ingredients: unknown; allergens?: string[] };
    /** Le chiavi che BLOCCANO (allergie e intolleranze): i non graditi hanno già il loro filtro. */
    const chiaviBloccanti = esclusioni.excluded.filter((x) => x.blocking).map((x) => x.keyword);
    /** Una ricetta di cui non sappiamo gli ingredienti: sul suo contenuto l'unico segnale è il nome. */
    const senzaIngredienti = (c: Cand) => !((c.ingredients as { name?: string }[]) ?? []).some((i) => i?.name);
    const valutate = new Map<string, ReturnType<typeof valutaRicetta>>();
    const sicurezza = (c: Cand) => {
      const gia = valutate.get(c.id);
      if (gia) return gia;
      const esito = valutaRicetta(
        {
          id: c.id,
          name: c.name,
          /**
           * ⛔ **IL NOME ENTRA COME INGREDIENTE, e non come secondo confronto.** `valutaRicetta`
           * cicla sugli **ingredienti**: su una ricetta con l'elenco vuoto, povero o scritto male
           * non vede niente e la dichiara sicura — «Insalata di gamberi e avocado» andrebbe a
           * un'allergica ai crostacei.
           *
           * ⚠️ La prima stesura metteva qui un `hitsExclusion` sul titolo, e la revisione l'ha
           * bocciata con la misura in mano: rifiutava anche «Ricotta con albicocche secche», cioè
           * **proprio il piatto** che il ripasso qui sotto serve a erogare in sicurezza (le
           * albicocche hanno un sostituto, i gamberi no). Un secondo giudice, più severo del primo,
           * dava due risposte diverse alla stessa domanda. Così invece il titolo passa dalle regole
           * di casa: dove c'è un sostituto si sostituisce, dove non c'è si vieta.
           */
          ingredients: [...(((c.ingredients as { name?: string }[]) ?? []).filter((i) => i?.name)), { name: c.name }],
          allergens: c.allergens ?? [],
        } as never,
        esclusioni,
      );
      valutate.set(c.id, esito);
      return esito;
    };
    const acceptable = (c: Cand) => {
      const txt = (c.name + ' ' + (((c.ingredients as { name?: string }[]) ?? []).map((i) => i?.name ?? '').join(' '))).toLowerCase();
      if (hitsExclusion(txt, excluded)) return false;
      /**
       * ⛔ **E il giudizio di sicurezza è quello della guardia, non un secondo elenco.** Legge il
       * nome, gli ingredienti **e i tag allergene confermati** — che il filtro per testo qui sopra
       * non può vedere: un piatto col tag Glutine che il glutine non lo nomina passerebbe.
       */
      return sicurezza(c).violations.length === 0;
    };
    // Due livelli, interrogati solo quando servono: prima la dieta, poi il catalogo.
    const fromDietBySlot = new Map<string, Cand[]>();
    const fromCatalogBySlot = new Map<string, Cand[]>();
    const swapped: { from: string; to: string }[] = [];
    for (const m of meals) {
      const hay = ((m.name ?? '') + ' ' + (ingTextById.get(m.recipeId) ?? '')).toLowerCase();
      if (!hitsExclusion(hay, triggerKeys)) continue;
      // 1) Alternativa DENTRO il pool della dieta. Niente filtro per regime: il pool è già
      //    la volontà del nutrizionista, e filtrarlo per il regime registrato sulla cliente
      //    è proprio ciò che escludeva i piatti di pesce da un piano di pesce.
      if (!fromDietBySlot.has(m.slot)) {
        const ids = [...(dietPool?.get(m.slot) ?? [])];
        const rows = ids.length
          ? ((await this.prisma.recipe.findMany({
              where: { id: { in: ids }, active: true },
              // ⚠️ `allergens` va CHIESTO: senza, `valutaRicetta` guarda un elenco vuoto e il
              // controllo qui sopra diventa una decorazione.
              select: { id: true, name: true, kcal: true, ingredients: true, allergens: true },
              orderBy: { id: 'asc' },
            })) as Cand[])
          : [];
        fromDietBySlot.set(m.slot, rows.filter(acceptable));
      }
      let tier = (fromDietBySlot.get(m.slot) ?? []).filter((c) => c.id !== m.recipeId);
      // 2) Solo se la dieta non offre nulla di accettabile si allarga al catalogo per regime.
      if (!tier.length) {
        if (!fromCatalogBySlot.has(m.slot)) {
          const rows = (await this.prisma.recipe.findMany({
            // ⚠️ Fase 2 (1/9): il ricambio di uno spuntino può essere una merenda, e viceversa.
            where: { mealSlot: { in: slotDaCuiPescare(m.slot) } as never, active: true, ...(profile?.regime ? { regime: profile.regime } : {}) },
            select: { id: true, name: true, kcal: true, ingredients: true, allergens: true },
            orderBy: { id: 'asc' },
          })) as Cand[];
          fromCatalogBySlot.set(m.slot, rows.filter(acceptable));
        }
        tier = (fromCatalogBySlot.get(m.slot) ?? []).filter((c) => c.id !== m.recipeId);
      }
      if (!tier.length) continue;
      // 3) A parità di idoneità si scarta ciò che è già stato servito di recente in questo
      //    pasto; se è recente tutto quanto, si ripiega sull'intero livello.
      const recent = new Set(history?.get(m.slot) ?? []);
      const fresh = tier.filter((c) => !recent.has(c.id));
      const candidates = fresh.length ? fresh : tier;
      /**
       * ⚠️ Fra i servibili si preferiscono i **puliti**: nessuna sostituzione da fare e ingredienti
       * scritti. ⛔ «Ingredienti scritti» sembra pedante e non lo è: senza quella condizione il
       * filtro premierebbe proprio le ricette di cui non sappiamo niente, perché una ricetta vuota
       * non ha mai sostituzioni da fare.
       */
      /**
       * ⚠️ `senzaIngredienti` conta **solo se c'è qualcosa di bloccante da cercare**: per una
       * cliente con i soli cibi non graditi quella condizione non protegge da niente e cambierebbe
       * la scelta per un motivo che non la riguarda — misurato in revisione: +60 kcal sul pasto,
       * e le porzioni a valle si scalano solo all'insù.
       */
      const puliti = candidates.filter(
        (c) => !sicurezza(c).subs.length && (!chiaviBloccanti.length || !senzaIngredienti(c)),
      );
      const scelti = puliti.length ? puliti : candidates;
      // Il tie-break sull'id serve: due candidati con le stesse kcal si alternavano a seconda
      // dell'ordine — non garantito — restituito dal database.
      scelti.sort((a, b) => Math.abs(a.kcal - m.kcal) - Math.abs(b.kcal - m.kcal) || a.id.localeCompare(b.id));
      const best = scelti[0];
      swapped.push({ from: m.name, to: best.name });
      /**
       * ⛔ **LE SOSTITUZIONI DEL PIATTO VECCHIO NON SI PORTANO DIETRO.** `m.substitutions` qui
       * contiene quelle che `evaluateMeals` ha scritto per il piatto che stiamo **buttando** —
       * «uvetta → frutta essiccata in casa» su un piatto che l'uvetta non ce l'ha più. Non è solo
       * rumore: `ingredienti-effettivi.ts` quell'ingrediente lo **aggiunge** al piatto nuovo. È la
       * decisione già scritta per il cambio di piatto della chat (`sostituzione-chat.service.ts`),
       * e i due punti ora dicono la stessa cosa.
       *
       * ⚠️ E le sostituzioni del piatto NUOVO non si scrivono qui: le calcola chi sa farlo —
       * `evaluateMeals`, che converte anche le grammature dei grassi. Chi chiama ripassa di lì.
       */
      m.substitutions = [{ from: m.name, to: best.name, reason: 'non gradito' }];
      m.recipeId = best.id;
      m.name = best.name;
      m.kcal = best.kcal;
    }
    return swapped;
  }

  /**
   * "Sostituisci un ingrediente": la cliente indica un cibo da togliere dai menu già
   * erogati, e sceglie PER QUANTO deve valere.
   *
   * La portata gliela chiediamo prima di applicare, non dopo, perché le tre situazioni
   * sono davvero diverse e solo lei le sa distinguere: «oggi non ce l'ho in casa» (`today`),
   * «in questi giorni non lo voglio» (`days`), «questo cibo non mi piace» (`forever`).
   * Solo l'ultima entra nei `dislikedFoods`, che restringono il pool di TUTTI i menu
   * futuri — ed è un effetto pesante: su una cliente reale 13 esclusioni accumulate
   * avevano ridotto a 1 su 5 i pranzi utilizzabili della sua dieta.
   *
   * I cibi non graditi non bloccano mai il piano: al massimo cambiano il piatto.
   *
   * Unica eccezione: le **spezie**. Vedi `spezie.ts` — una spezia esclusa cancella dal ricettario
   * ogni piatto che la contiene, ed è così che una cliente si è ritrovata lo stesso pranzo per
   * quattro giorni. La regola della nutrizionista è di non registrarle e di rispondere con un
   * pop-up. Il testo viaggia anche in `message`, così le app già installate — dove gli
   * aggiornamenti OTA sono spenti — lo mostrano lo stesso al posto della conferma.
   */
  async substituteDisliked(
    clientId: string,
    rawIngredient: string,
    scope: 'today' | 'days' | 'forever' = 'days',
  ): Promise<{
    applied: { day: string; from: string; to: string }[];
    disliked: string;
    scope: 'today' | 'days' | 'forever';
    forever: boolean;
    message: string;
    /** Falso quando la richiesta è stata fermata (per ora: solo le spezie). */
    applicato: boolean;
    /** Presente solo se c'è un pop-up da mostrare. */
    avvisoSpezia?: EsitoSpezia;
    /**
     * ⚠️ Presente quando quello che ha scritto NON è un nome di alimento (Simone, 18/8: «le
     * esclusioni devono essere un elenco, ogni parola seguita da una virgola, aiutiamo le clienti a
     * scrivere in modo corretto»). Il controllo sta QUI e non nell'app di proposito: sarebbe la
     * seconda copia di una regola, e il giorno che divergono l'app direbbe una cosa e il motore ne
     * farebbe un'altra.
     */
    avvisoEsclusione?: string;
  }> {
    const ingredient = (rawIngredient ?? '').trim();
    if (ingredient.length < 2) throw new BadRequestException("Scrivi l'ingrediente che non gradisci.");
    const forever = scope === 'forever';

    /**
     * ⚠️ PRIMA DI TUTTO IL RESTO: non è un alimento, è una frase.
     *
     * Si ferma **prima** di toccare i menu, perché il danno è già fatto al momento del salvataggio:
     * «pesce tranne salmone» salvato non toglie niente, e lei crede di aver escluso il pesce. Il
     * cancello delle spezie sta venti righe sotto e risponde a un'altra domanda — lì il termine è
     * un alimento vero, solo che escluderlo svuoterebbe il ricettario.
     */
    const problemi = problemiEsclusioni([ingredient]);
    if (problemi.length) {
      return {
        applied: [],
        disliked: ingredient,
        scope,
        forever,
        message: fraseAiutoEsclusioni(problemi) ?? '',
        applicato: false,
        avvisoEsclusione: fraseAiutoEsclusioni(problemi) ?? undefined,
      };
    }

    // Il cancello delle spezie vale per TUTTE le portate, non solo per "per sempre": anche una
    // sostituzione di tre giorni farebbe scartare i piatti speziati, che è il danno da evitare.
    const spezia = classificaSpezia(ingredient);
    if (spezia.tipo !== 'nessuna') {
      try {
        await this.audit.log({
          action: 'menu.spezia.rifiutata',
          actorId: clientId,
          entityType: 'client_profile',
          entityId: clientId,
          metadata: { termine: ingredient, tipo: spezia.tipo, scope },
        });
      } catch {
        /* l'audit non deve impedire la risposta alla cliente */
      }
      return {
        applied: [],
        disliked: ingredient,
        scope,
        forever,
        message: spezia.testo,
        applicato: false,
        avvisoSpezia: spezia,
      };
    }

    // 1) Solo se la cliente ha CONFERMATO l'esclusione permanente → dislikedFoods.
    if (forever) {
      const profile = await this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: { dislikedFoods: true },
      });
      const current = ((profile?.dislikedFoods ?? []) as string[]);
      const already = current.some((s) => s.toLowerCase().trim() === ingredient.toLowerCase());
      if (!already) {
        await this.prisma.clientProfile.update({
          where: { userId: clientId },
          data: { dislikedFoods: [...current, ingredient] },
        });
      }
    }

    // 2) Correggi i menu GIÀ EROGATI, da oggi in avanti per quanto ha chiesto la cliente
    //    (anche i giorni non ancora visibili): l'ingrediente indicato conta anche se non
    //    è nei dislikedFoods.
    const today = toDateOnly();
    const daysAffected = scope === 'today' ? 1 : 3;
    const days = await this.prisma.menuDay.findMany({
      where: { clientId, date: { gte: today } },
      orderBy: { date: 'asc' },
      take: daysAffected,
    });
    const applied: { day: string; from: string; to: string }[] = [];
    /**
     * §16.9 — quello che finisce nella tabella delle sostituzioni.
     *
     * Si raccoglie qui e si scrive DOPO il ciclo: la stessa sostituzione compare in più giornate
     * (`days` ne tocca tre) ed è UNA richiesta, non tre. Scrivendola dentro il ciclo il conteggio
     * «volte» direbbe che la cliente l'ha chiesta tre volte in un secondo — e il numero che serve a
     * decidere quali sostituzioni diventano una regola sarebbe il primo a mentire.
     */
    const daRegistrare = new Map<
      string,
      {
        from: string; to: string; recipeId: string; dishName: string; mealSlot: string;
        fromQty: number | null; toQty: number | null; unit: string | null; dietId: string | null;
      }
    >();
    for (const day of days) {
      const meals = ((day.meals as unknown as MealSnapshot[]) ?? []).map((m) => ({ ...m }));
      const dayKey = day.date.toISOString().slice(0, 10);
      // 1) Piatti che hanno il cibo nel NOME (ingrediente principale) → si cambia PIATTO.
      const swaps = await this.swapDislikedDishes(clientId, meals, [ingredient]);
      for (const s of swaps) applied.push({ day: dayKey, from: s.from, to: s.to });
      // 2) Piatti dove compare solo tra gli ingredienti → sostituzione sicura annotata.
      const { subsByRecipe } = await this.evaluateMeals(clientId, meals, [ingredient]);
      let touched = swaps.length > 0;
      const updated = meals.map((m) => {
        const subs = subsByRecipe[m.recipeId];
        if (subs && subs.length) {
          touched = true;
          /**
           * ⚠️ `origine: 'app'` sulla riga scritta nel menu, non solo nella tabella §16.9.
           *
           * Senza, una sostituzione chiesta dalla cliente col pulsante era indistinguibile da una
           * decisa dal MOTORE per sicurezza (allergeni, esclusioni): nel JSON della giornata non
           * hanno origine né l'una né l'altra. È l'informazione che serve a `insistenza-cambi.ts`
           * per contare i giorni in cui ha chiesto lei un cambio — e contare al suo posto quelle
           * di sicurezza vorrebbe dire invitare a riflettere una cliente allergica sulle
           * sostituzioni che la tengono al sicuro.
           */
          /**
           * ⛔ **LE «ASSENZE» NON SONO CAMBI DELLA CLIENTE** — rilievo della revisione del 24/8.
           * `evaluateMeals` torna **tutte** le sostituzioni della ricetta, non solo quella chiesta:
           * su una cliente allergica ai solfiti, dentro c'è anche «vino bianco → si toglie», che è
           * una sostituzione di **sicurezza**. Marcandola `origine: 'app'` diventava un cambio
           * chiesto da lei — e finiva in `FoodSwap` come sostituzione riutilizzabile, nella coda di
           * Vera, e perfino promuovibile a gruppo di equivalenza «vino rosso ↔ si toglie (niente al
           * suo posto)». Un'assenza non si concorda e non si impara: si applica e basta.
           */
          const chiestiDaLei = subs.filter((s) => s.to !== SOSTITUTO_ASSENTE);
          for (const s of chiestiDaLei) s.origine = 'app';
          for (const s of chiestiDaLei) applied.push({ day: dayKey, from: s.from, to: s.to });
          // Anche quello che la cliente chiede dal PULSANTE del menu, non solo quello che concorda
          // con Gaia: è la stessa richiesta fatta con due dita invece che con una frase, e la
          // memoria non deve dipendere da quale schermata ha aperto.
          for (const s of chiestiDaLei) {
            daRegistrare.set(`${m.recipeId}|${s.from}|${s.to}`, {
              from: s.from,
              to: s.to,
              recipeId: m.recipeId,
              dishName: m.name,
              mealSlot: m.slot,
              fromQty: s.fromQty ?? null,
              toQty: s.toQty ?? null,
              unit: s.unit ?? null,
              dietId: day.dietId ?? null,
            });
          }
          return { ...m, substitutions: [...(m.substitutions ?? []), ...subs] };
        }
        return m;
      });
      if (touched) {
        await this.prisma.menuDay.update({ where: { id: day.id }, data: { meals: updated as never } });
      }
    }

    // §16.9 — la memoria, una riga per richiesta e non una per giornata toccata. Il motivo si
    // deduce dalla portata che la cliente ha scelto, che è l'unica cosa che ce lo dice: «per
    // sempre» è un gusto, il resto è contingente.
    for (const r of daRegistrare.values()) {
      await registraSostituzione(this.prisma, {
        clientId,
        tipo: 'ingrediente',
        origine: 'app',
        motivo: forever ? 'gusto' : 'scorta',
        ...r,
      });
    }

    // Il messaggio dice esattamente per quanto vale: una cliente che ha chiesto "solo oggi"
    // non deve leggere "nei prossimi menu" e restare col dubbio di aver escluso troppo.
    const uniquePairs = [...new Set(applied.map((s) => `«${s.from}» → «${s.to}»`))];
    const where = scope === 'today' ? 'nel menu di oggi' : 'nei menu di oggi e dei prossimi due giorni';
    let message: string;
    if (applied.length) {
      message = `Fatto, ${where}: ${uniquePairs.join(', ')}.`;
      if (forever) message += ` E d'ora in poi «${ingredient}» non comparirà più nei tuoi menu.`;
      else if (scope === 'today') message += ' Da domani torna disponibile.';
    } else if (forever) {
      message = `Preferenza salvata: «${ingredient}» non c'è ${where} e non comparirà nei menu successivi.`;
    } else {
      message = `${where.charAt(0).toUpperCase()}${where.slice(1)} quell'ingrediente non compare` +
        (scope === 'today' ? '.' : ' (se invece lo vedi ancora, scrivilo alla tua coach: sistemiamo noi).');
    }
    return { applied, disliked: ingredient, scope, forever, message, applicato: true };
  }

  /**
   * Cambio TIPO di dieta (regime/stile): i giorni già consumati restano com'erano,
   * i giorni FUTURI già erogati vengono cancellati e rierogati con la nuova dieta —
   * si eroga solo la differenza, il conteggio dei giorni già ricevuti non cambia.
   *
   * ⚠️ **CANCELLA PRIMA E RIEROGA DOPO, e le due cose possono non pareggiare.** `deliverIfEligible`
   * ha i suoi cancelli — misure mancanti, finestra, fine piano — e quando uno di questi è chiuso
   * restituisce zero giorni. Fin qui il risultato era che la cliente perdeva i giorni futuri e non
   * ne riceveva di nuovi: apriva l'app e non trovava niente, per una modifica fatta da altri con
   * tutt'altra intenzione (11/8).
   *
   * Ora si tiene una copia delle righe cancellate e, **se la rierogazione non produce niente, si
   * rimettono com'erano**. Un menu vecchio è meglio di nessun menu: il vecchio è sbagliato di
   * qualche caloria, il nulla è sbagliato e basta. `ripristinati` dice a chi chiama che la modifica
   * non è arrivata nel piatto, così può dirlo a chi l'ha fatta invece di lasciarglielo credere.
   */
  async redeliverFutureDays(clientId: string): Promise<{ removed: number; delivered: string[]; ripristinati: number }> {
    // Come `regenerateFromToday`: col piano fermo si cancellerebbe senza poter rierogare.
    if (await this.pianoFermato(clientId)) return { removed: 0, delivered: [], ripristinati: 0 };
    const today = toDateOnly();
    const where = { clientId, date: { gt: today } };
    const copia = (await this.prisma.menuDay.findMany({ where })) as {
      id: string; clientId: string; date: Date; dietId: string; level: number;
      meals: unknown; status: string; visibleFrom: Date; sourceRuleId: string | null;
      apertoDallaClienteIl?: Date | null; apertureTracciate?: boolean;
    }[];
    const del = await this.prisma.menuDay.deleteMany({ where });
    const delivered = await this.deliverIfEligible(clientId);
    if (delivered.length === 0 && copia.length > 0) {
      // `createMany` e non `create` in ciclo: se qualcosa va storto qui la cliente resta senza
      // giorni, quindi meno andate al database ci sono, meno finestre ci sono per restare a metà.
      await this.prisma.menuDay
        .createMany({
          /**
           * ⛔ **RIMETTERE UN GIORNO COM'ERA VUOL DIRE ANCHE COM'ERA APERTO** (26/8, voce
           * `visto-non-vuol-dire-aperto`). Senza queste due colonne il ripristino riscriveva
           * `apertoDallaClienteIl` a `null` e `apertureTracciate` a `false`: una giornata che la
           * cliente aveva **aperto davvero** tornava indietro come «non lo so», e la volta dopo un
           * rifacimento automatico gliel'avrebbe cambiata sotto — il danno esatto che tutto questo
           * lavoro esiste per impedire. ⚠️ Un ripristino che perde una colonna non è un ripristino:
           * è una scrittura nuova travestita.
           */
          data: copia.map((d) => ({
            id: d.id, clientId: d.clientId, date: d.date, dietId: d.dietId, level: d.level,
            meals: d.meals as never, status: d.status, visibleFrom: d.visibleFrom, sourceRuleId: d.sourceRuleId,
            apertoDallaClienteIl: d.apertoDallaClienteIl ?? null, apertureTracciate: !!d.apertureTracciate,
          })) as never,
          skipDuplicates: true,
        })
        .catch(() => undefined);
      this.logger.warn(
        `Rierogazione a vuoto per ${clientId}: ${copia.length} giorni futuri rimessi com'erano ` +
          '(la cliente non è idonea a ricevere menu adesso).',
      );
      return { removed: 0, delivered: [], ripristinati: copia.length };
    }
    return { removed: del.count, delivered, ripristinati: 0 };
  }

  /**
   * RIGENERA i menu da OGGI in poi (incluso oggi), senza toccare lo storico passato.
   * Serve a correggere i menu GIÀ EROGATI ma sbagliati da una vecchia generazione
   * (es. un giorno con la sola colazione): li cancella e li rieroga con la logica
   * attuale (corretta). Rispetta gate misure/finestre come l'erogazione normale
   * (quindi può restituire 0 giorni se la cliente non è idonea: es. misure mancanti).
   */
  async regenerateFromToday(clientId: string): Promise<{ removed: number; delivered: string[] }> {
    // Piano fermato dal nutrizionista: NON si cancella niente. `deliverIfEligible` non rieroga
    // finché il blocco è attivo, quindi una rigenerazione qui toglierebbe alla cliente i giorni
    // che il blocco le lascia di proposito — «i giorni già ricevuti, incluso oggi, restano suoi» —
    // e le lascerebbe lo schermo vuoto. Chi vuole davvero rigenerare, prima riattiva il piano.
    if (await this.pianoFermato(clientId)) return { removed: 0, delivered: [] };
    const today = toDateOnly();
    const del = await this.prisma.menuDay.deleteMany({ where: { clientId, date: { gte: today } } });
    const delivered = await this.deliverIfEligible(clientId);
    return { removed: del.count, delivered };
  }

  /**
   * TIENE SOLO LE GIORNATE COMPLETE, e se non ce ne sono cerca la gemella (§15.4, 11/8).
   *
   * Le tre decisioni di Simone, nell'ordine in cui si applicano:
   *
   * 1. **qualche giornata completa c'è** → si servono quelle e le monche si saltano. Il ciclo può
   *    accorciarsi, ma un giorno in meno è meglio di un giorno con la sola colazione;
   * 2. **nessuna giornata completa in questa variante** → si scende sulla **gemella completa della
   *    stessa famiglia**: rispetta la dieta scelta ma non i pasti al giorno richiesti, quindi la
   *    cosa **va tracciata** come il già esistente `diet_style_fallback`, non fatta in silenzio.
   *    Stesso principio del caso Cristina: il ripiego è voluto, il silenzio no;
   * 3. **nemmeno le gemelle** → **non si eroga** e si apre una segnalazione. Meglio «menu in
   *    preparazione» che una giornata monca: la cliente aspetta invece di trovarsi davanti un
   *    pranzo che non c'è, e qualcuno riceve la notizia che il catalogo ha un buco.
   *
   * Restituisce `null` quando non c'è niente da servire: chi chiama esce senza erogare.
   */
  /**
   * Le giornate monche riparate coi piatti delle altre giornate del ciclo (Simone, 14/8).
   *
   * ⚠️ Il ripiego si DICE: log con quale giorno, quale slot e da dove arriva il piatto, più
   * l'evento `diet_day_repaired`. Un ripiego dichiarato è un dato, uno nascosto è un errore — e il
   * nutrizionista deve comunque completare il catalogo: questa regola toglie il danno alla cliente,
   * non il lavoro dal tavolo.
   *
   * ⚠️ Non lancia mai e in caso di guaio restituisce le giornate COM'ERANO: la riparazione è un
   * miglioramento, e un miglioramento che rompe l'erogazione è un peggioramento.
   */
  private async riparaLeMonche(
    clientId: string,
    diet: DietaPerErogazione,
    templates: TemplateGiornata[],
    level: number,
  ): Promise<TemplateGiornata[]> {
    try {
      // Le kcal servono solo a scegliere FRA i candidati: se non si riescono a leggere, la
      // riparazione si fa lo stesso prendendo il primo in avanti (e non finge una scelta calorica).
      let kcalDi: Map<string, number> | undefined;
      try {
        const ids = [...new Set(
          templates.flatMap((t) => (Array.isArray(t.meals) ? (t.meals as { recipeId?: string }[]) : []))
            .map((m) => m?.recipeId)
            .filter((x): x is string => !!x),
        )];
        if (ids.length) {
          const ricette = (await this.prisma.recipe.findMany({
            where: { id: { in: ids } },
            select: { id: true, kcal: true },
          })) as { id: string; kcal: number }[];
          kcalDi = new Map(ricette.map((r) => [r.id, r.kcal]));
        }
      } catch {
        kcalDi = undefined;
      }

      const esito = riparaGiornate(templates, diet, {
        kcalDi,
        targetKcal: this.levelTargetKcal(diet.levels, level),
      });
      if (!esito.riparate) return templates;

      const righe = esito.dettaglio
        .map((d) => `giorno ${d.dayIndex} ${d.slot} ← giorno ${d.daGiorno}`)
        .join('; ');
      this.logger.warn(
        `Dieta ${diet.id}: ${esito.riparate} giornate riparate coi piatti del ciclo (${righe}). ` +
          'Il catalogo va comunque completato.',
      );
      await this.prisma.analyticsEvent
        .create({
          data: {
            eventId: randomUUID(),
            name: 'diet_day_repaired',
            userId: clientId,
            phase: 'app',
            data: { dietId: diet.id, level, riparate: esito.riparate, dettaglio: esito.dettaglio.slice(0, 20) } as never,
          } as never,
        })
        .catch(() => undefined);
      return esito.giornate;
    } catch (err) {
      this.logger.warn(
        `Riparazione delle giornate non riuscita per la dieta ${diet.id}: ` +
          `${err instanceof Error ? err.message : String(err)}. Si prosegue con le giornate come sono.`,
      );
      return templates;
    }
  }

  private async soloGiornateComplete(
    clientId: string,
    diet: DietaPerErogazione,
    templatesInArrivo: TemplateGiornata[],
    level: number,
  ): Promise<{ diet: DietaPerErogazione; templates: TemplateGiornata[]; level: number } | null> {
    /**
     * 0) PRIMA DI SCARTARE, SI RIPARA (Simone, 14/8): «se settimana 2 giorno 2 mi manca la cena
     * vado a cercare la cena nelle settimane successive con le giuste caratteristiche».
     *
     * Il piatto arriva dalle altre giornate della STESSA dieta e dello stesso livello, per lo
     * stesso slot: è già del catalogo di questa dieta, quindi esclusioni, allergeni e stagionalità
     * della cliente restano dove sono sempre stati — a valle. Se dopo la riparazione una giornata
     * è ancora monca, la scala qui sotto vale identica.
     * Decisione: `progetto/NOTA_Pasto_Mancante_Dalle_Settimane_Successive.md`.
     */
    const templates = await this.riparaLeMonche(clientId, diet, templatesInArrivo, level);
    const { complete, monche } = giornateComplete(templates, diet);
    if (complete.length > 0) {
      if (monche > 0) {
        // Si va avanti con quelle buone, ma resta scritto: è il numero che dice al nutrizionista
        // quante giornate deve completare, e senza questa riga non lo saprebbe nessuno.
        this.logger.warn(
          `Dieta ${diet.id}: ${monche} giornate su ${templates.length} sono incomplete e non verranno servite.`,
        );
      }
      return { diet, templates: complete, level };
    }

    // 2) La gemella: stessa famiglia e stesso regime, un'altra struttura di pasti.
    const gemelle = (await this.prisma.diet.findMany({
      where: {
        status: 'approved',
        regime: diet.regime ?? undefined,
        name: diet.name ?? undefined,
        NOT: { id: diet.id },
      },
      // `levels` e `objective` NON sono decorativi: il target calorico del giorno esce da
      // `levelTargetKcal(diet.levels, level)`. Senza, la gemella arriverebbe con `levels` vuoto e il
      // target sarebbe ZERO — cioè il ripiego servirebbe le giornate giuste con le calorie sbagliate.
      select: { id: true, name: true, regime: true, mealsPerDay: true, fasting: true, style: true, levels: true, objective: true },
    })) as DietaPerErogazione[];

    for (const gemella of gemelle) {
      const suoi = (await this.prisma.dietDayTemplate.findMany({
        where: { dietId: gemella.id, level: 1 },
        orderBy: { dayIndex: 'asc' },
      })) as TemplateGiornata[];
      const esito = giornateComplete(suoi, gemella);
      if (esito.complete.length === 0) continue;

      await this.prisma.analyticsEvent
        .create({
          data: {
            eventId: randomUUID(),
            // Stessa famiglia di nome dell'evento che esiste già per lo stile: chi guarda i ripieghi
            // li trova insieme, invece di dover sapere che ce n'è un secondo tipo con un altro nome.
            name: 'diet_meals_fallback',
            userId: clientId,
            phase: 'app',
            data: {
              richiesta: { dietId: diet.id, mealsPerDay: diet.mealsPerDay ?? null },
              servita: { dietId: gemella.id, mealsPerDay: gemella.mealsPerDay ?? null },
              motivo: 'nessuna giornata completa nella variante richiesta',
            } as never,
          } as never,
        })
        .catch(() => undefined);
      this.logger.warn(
        `Dieta ${diet.id} senza giornate complete: servita la gemella ${gemella.id} ` +
          `(${gemella.mealsPerDay ?? '—'} pasti invece di ${diet.mealsPerDay ?? '—'}).`,
      );
      return { diet: gemella, templates: esito.complete, level: 1 };
    }

    // 3) Nemmeno le gemelle: non si eroga, e la cosa arriva a una persona.
    await apriSegnalazione(this.prisma as never, {
      clientId,
      category: 'other',
      reason:
        `Nessuna giornata completa per «${diet.name ?? diet.id}»` +
        `${diet.mealsPerDay ? ` · ${diet.mealsPerDay} pasti` : ''}: menu NON erogato. ` +
        'Nessuna variante della famiglia ha giornate complete: vanno completate a catalogo.',
      source: 'engine',
      dedupe: true,
    }).catch(() => undefined);
    this.logger.error(`Nessuna giornata completa per la dieta ${diet.id} né per le sue gemelle: erogazione ferma.`);
    return null;
  }

  /** Vero se il piano è fermato dal nutrizionista (`planHeldAt`). Vedi §15.2 punto 4. */
  private async pianoFermato(clientId: string): Promise<boolean> {
    const p = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { planHeldAt: true },
    })) as { planHeldAt: Date | null } | null;
    return !!p?.planHeldAt;
  }

  /**
   * Cambio DATA DI INIZIO piano: si cancellano TUTTI i menu erogati e si riparte
   * dalla nuova data impostata (il piano ricomincia da lì).
   */
  async restartFromPlanStart(clientId: string): Promise<{ removed: number; delivered: string[] }> {
    // Come sopra, e qui il danno sarebbe massimo: cancella TUTTI i menu.
    if (await this.pianoFermato(clientId)) return { removed: 0, delivered: [] };
    const del = await this.prisma.menuDay.deleteMany({ where: { clientId } });
    const delivered = await this.deliverIfEligible(clientId);
    return { removed: del.count, delivered };
  }

  // ---------- Sicurezza: esclusioni (intolleranze/allergie) → blocco + escalation ----------

  /**
   * Valuta i piatti contro le esclusioni della cliente:
   * - `violations`: intolleranze NON sostituibili → il piano va bloccato;
   * - `subsByRecipe`: sostituzioni sicure da annotare sui pasti (per recipeId).
   * I cibi "non graditi" (dislikedFoods) si sostituiscono se possibile, ma non bloccano mai.
   */
  /**
   * ⛔ **I PESI DEI GRASSI, per il motore.** Stessa domanda che si fa la chat, stesso gruppo, stesse
   * tre correzioni (ordinamento, nome normalizzato, solo approvato) — vedi `fattoriDeiGrassi` in
   * `sostituzione-chat.service.ts`.
   *
   * ⚠️ **Non lancia mai**: se questa lettura fallisce il menu di domani non deve fermarsi. Senza i
   * pesi si torna alla pari grammatura di prima, che è quello che il prodotto faceva fino al 25/8 —
   * peggiorativo, ma non un cancello chiuso in faccia a una cliente.
   */
  private async pesiDeiGrassi(): Promise<{ fattori: FattoriGrassi | null }> {
    try {
      const gruppi = (await this.prisma.equivalenceGroup.findMany({
        where: { status: 'approved' } as never,
        orderBy: { createdAt: 'asc' },
        select: { name: true, members: true },
        take: 500,
      })) as { name: string; members: unknown }[];
      const cercato = GRUPPO_GRASSI.trim().toLowerCase();
      const g = gruppi.find((x) => (x.name ?? '').trim().toLowerCase() === cercato);
      return { fattori: g ? leggiFattori(g.members) : null };
    } catch (err) {
      this.logger.warn(`Pesi dei grassi non letti: ${err instanceof Error ? err.message : String(err)}`);
      return { fattori: null };
    }
  }

  private async evaluateMeals(
    clientId: string,
    meals: MealSnapshot[],
    extraDisliked: string[] = [],
  ): Promise<{ violations: string[]; subsByRecipe: Record<string, Substitution[]>; nonSicure: Set<string> }> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { intolerances: true, dislikedFoods: true, allergies: true },
    });
    /**
     * ⚠️ **LE ALLERGIE ENTRANO QUI, e fino al 20/8 non c'erano.**
     *
     * Questa funzione è quella che i commenti del motore chiamano «la sicurezza» (§2/§7), e
     * costruiva l'elenco delle esclusioni da **intolleranze** e **cibi non graditi**. Le allergie si
     * leggevano solo per la regola del delattosato: una cliente che aveva dichiarato **soltanto
     * allergie** usciva di qui senza che si fosse guardato niente, e in produzione, il 20/8, erano
     * **otto clienti su nove**.
     *
     * ⚠️ **Sono trattate come le intolleranze**: se l'ingrediente ha una sostituzione sicura il
     * piatto si eroga con la sostituzione annotata, altrimenti si blocca. La variante più severa —
     * «un allergene non si sostituisce mai» — è una decisione di prodotto che non è stata presa.
     *
     * ⚠️ **E dal 21/8 la stessa domanda si fa PRIMA, sul pool** (`buildScoringContext`): questa
     * guardia resta il punto obbligato — il pool non è l'unica strada da cui un piatto entra in una
     * giornata — ma non deve più essere il posto in cui si scopre che la giornata è da buttare.
     * ⚠️ La logica è **una sola**, in `esclusioni-della-cliente.ts`: due copie vorrebbero dire un
     * filtro che toglie un insieme di piatti e una guardia che ne vieta un altro, e la differenza
     * fra i due sarebbe una cliente ferma senza che nessuno capisca perché.
     */
    const esclusioni = esclusioniDi(profile as ProfiloConEsclusioni | null, extraDisliked);
    if (esclusioni.vuoto) return { violations: [], subsByRecipe: {}, nonSicure: new Set<string>() };

    const recipeIds = [...new Set(meals.map((m) => m.recipeId))];
    if (!recipeIds.length) return { violations: [], subsByRecipe: {}, nonSicure: new Set<string>() };
    const recipes = (await this.prisma.recipe.findMany({
      where: { id: { in: recipeIds } },
      select: { id: true, name: true, ingredients: true, allergens: true },
    })) as { id: string; name: string; ingredients: unknown; allergens: string[] }[];

    /**
     * ⛔ **ANCHE LE SOSTITUZIONI DI SICUREZZA SONO A PARI GRAMMATURA, E SUI GRASSI NON REGGE.**
     *
     * Trovato al secondo giro di revisione del lavoro sui grassi, 25/8. `SUBSTITUTION_MAP` contiene
     * `burro → olio evo`: `valutaRicetta` scrive la sostituzione **senza quantità**, e
     * `ingredienti-effettivi.ts` fa `qty: s.toQty ?? i.qty`, cioè pari grammatura piena. Trenta
     * grammi di burro diventavano trenta di olio: il numero giusto è **venticinque** (120 e 100 nella
     * tabella di Nocanty), quindi **+20% di lipidi** su quell'ingrediente, ogni giorno, su ogni
     * cliente intollerante al lattosio a cui il motore applica la sostituzione — e senza che nessuno
     * l'abbia chiesto, perché questa è la strada automatica.
     *
     * ⚠️ Due porte rispondevano in modo diverso alla stessa domanda («quanti grammi del sostituto?»):
     * la chat convertiva, il motore no. E quella che rispondeva male è quella che tocca più persone.
     * Regola di casa: *se due punti rispondono alla stessa domanda, uno deve chiamare l'altro*.
     *
     * ⛔ **Ma qui NON si passa la mano.** In chat, un grasso senza numero fa fermare la proposta; qui
     * la sostituzione esiste per **rendere sicuro** un piatto che contiene un'intolleranza. Toglierla
     * perché non sappiamo convertire vorrebbe dire servire il lattosio a chi non lo tollera — *un
     * cancello chiuso costa a una cliente tutto il servizio*, e questo sarebbe anche peggio: un
     * cancello aperto. Quindi: si converte dove il numero c'è, e dove non c'è resta la pari
     * grammatura di prima, **contata e scritta nel log** invece che taciuta.
     */
    const { fattori } = await this.pesiDeiGrassi();
    let grassiSenzaNumero = 0;

    const violations = new Set<string>();
    /**
     * ⚠️ **Gli id, non solo i messaggi** (31/8). Prima di qui usciva solo l'elenco delle frasi da
     * scrivere nella segnalazione: chi voleva **sostituire** il piatto invece di bloccarlo doveva
     * rifare la stessa valutazione da capo — cioè una seconda risposta alla stessa domanda. Adesso
     * chi ha giudicato dice anche **su chi**.
     */
    const nonSicure = new Set<string>();
    const subsByRecipe: Record<string, Substitution[]> = {};
    for (const r of recipes) {
      const esito = valutaRicetta(r, esclusioni);
      if (esito.violations.length) nonSicure.add(r.id);
      for (const v of esito.violations) violations.add(v);
      if (!esito.subs.length) continue;
      const ingredienti = ((r.ingredients as IngredienteRicetta[]) ?? []).filter(Boolean);
      for (const sub of esito.subs) {
        // ⚠️ «Si toglie» è un'assenza, non un sostituto: non c'è niente da convertire.
        if (sub.to === SOSTITUTO_ASSENTE) continue;
        const modo = comeConvertire(fattori, sub.from, sub.to);
        if (modo.modo === 'pari') continue;
        const ing = ingredienti.find((i) => !!i?.name && combaciaAlimento(i.name, sub.from));
        const qtaDa = typeof ing?.qty === 'number' ? ing.qty : undefined;
        if (modo.modo === 'passa_la_mano' || qtaDa === undefined) {
          grassiSenzaNumero += 1;
          continue;
        }
        const convertita = quantitaEquivalente(qtaDa, modo.pesoDa, modo.pesoA);
        if (convertita === null) {
          grassiSenzaNumero += 1;
          continue;
        }
        sub.fromQty = qtaDa;
        sub.toQty = convertita;
        sub.unit = ing?.unit ?? sub.unit;
        // La tabella è in grammi: dopo una conversione coi pesi l'unità è il grammo, anche per un
        // liquido. Vedi `unitaDopoLaConversione` in `sostituzione-chat.ts`.
        sub.unitA = 'g';
      }
      subsByRecipe[r.id] = esito.subs;
    }
    if (grassiSenzaNumero) {
      this.logger.warn(
        `Grassi: ${grassiSenzaNumero} sostituzioni di sicurezza scritte a pari grammatura perché ` +
          `manca il peso di uno dei due alimenti (gruppo «${GRUPPO_GRASSI}»). ` +
          'Le calorie del piatto possono scostarsi: `npm run diag:grassi` dice quali nomi mancano.',
      );
    }
    return { violations: [...violations], subsByRecipe, nonSicure };
  }

  /** Apre (una sola volta) un'escalation "piano bloccato" al nutrizionista. */
  private async ensureDietBlockedEscalation(clientId: string, reasons: string[]): Promise<void> {
    const motivo = `${MOTIVO_BLOCCO_MENU} (${reasons.slice(0, 4).join('; ')}). Serve una dieta personalizzata.`;
    const already = (await this.prisma.escalation.findFirst({
      where: { clientId, source: 'engine' as never, status: { in: ['open', 'in_progress'] as never }, reason: { contains: 'Piano bloccato' } },
      select: { id: true, reason: true },
    })) as { id: string; reason: string } | null;
    /**
     * ⚠️ **UNA RIGA GIÀ APERTA SI AGGIORNA, non si lascia fossilizzata** (21/8).
     *
     * Fin qui c'era `if (already) return`, e la conseguenza si è vista lo stesso giorno: la
     * segnalazione di Sonia continuava a elencare i piatti della **prima** composizione fallita, e
     * avrebbe continuato a elencarli identici anche se il motore avesse ricominciato a comporre.
     * Cioè la riga che dovrebbe dire *cosa non va adesso* diceva *cosa non andava allora*, e non
     * c'era modo di distinguere le due cose guardandola.
     *
     * È la stessa scelta già fatta in `sbloccaPiano`: quando il blocco resta, torna il motivo
     * **nuovo**, non quello vecchio.
     */
    if (already) {
      if (already.reason !== motivo) {
        // ⚠️ `try/catch` e non `.catch()`: se il client non ha `update` (i finti dei test) la
        // chiamata esplode PRIMA che esista una promessa, e un `.catch` non la vedrebbe.
        try {
          await this.prisma.escalation.update({ where: { id: already.id }, data: { reason: motivo } });
        } catch (e: unknown) {
          this.logger.warn(
            `Blocco piano: motivo non aggiornato per ${clientId}: ${e instanceof Error ? e.message : e}`,
          );
        }
      }
      return;
    }
    // `apriSegnalazione` invece della `create` diretta: assegna, avvisa, e se non c'è nessuna
    // nutrizionista sulla cliente la manda al capo nutrizionista invece di lasciarla lì.
    await apriSegnalazione(this.prisma as never, {
      clientId,
      category: 'diet_blocked',
      source: 'engine',
      reason: motivo,
      // ⚠️ Questa riga non è un avviso, è lo STATO che l'app mostra alla cliente: dentro la tregua
      // si riapre invece di tacere. Vedi `statoNonAvviso` in `apri-segnalazione.ts`.
      statoNonAvviso: true,
    });
    await this.audit.log({
      action: 'menu.diet_blocked',
      actorId: clientId,
      entityType: 'escalation',
      metadata: { reasons },
    });
  }

  /** Stato "piano bloccato" per l'app cliente (messaggio rassicurante). */
  async dietBlock(clientId: string): Promise<{ active: boolean; reason: string | null }> {
    const esc = (await this.prisma.escalation.findFirst({
      where: { clientId, source: 'engine' as never, status: { in: ['open', 'in_progress'] as never }, reason: { contains: 'Piano bloccato' } },
      select: { reason: true },
    })) as { reason: string } | null;
    return {
      active: !!esc,
      reason: esc ? 'Stiamo sistemando il tuo piano con la nutrizionista.' : null,
    };
  }

  /**
   * Dieta approvata più adatta al profilo. La scala dei ripieghi vive in `pick-diet.ts`, una
   * sola volta: qui e in `personal-base.service.ts` era copiata identica riga per riga, e due
   * copie della stessa logica prima o poi divergono — il menu del giorno e la base
   * personalizzata sicura si costruirebbero su due diete diverse, in silenzio.
   */
  /**
   * Il tipo di ritorno è **esplicito** e non inferito: nel sandbox il client Prisma è uno stub, e
   * senza questa dichiarazione `diet` arriva qui come `unknown` — cioè il compilatore non può più
   * dire niente sui campi che il resto della funzione usa. Sono i campi che servono davvero
   * all'erogazione: struttura dei pasti, famiglia, regime e livelli calorici.
   */
  private async pickDiet(profile: DietMatchProfile): Promise<DietaPerErogazione | null> {
    return pickDietFor<DietaPerErogazione>(
      (where) =>
        this.prisma.diet.findFirst({ where: where as never, orderBy: { approvedAt: 'desc' } }) as Promise<DietaPerErogazione | null>,
      profile,
    );
  }

  private async snapshotMeals(
    templateMeals: { slot: string; recipeId: string }[],
  ): Promise<MealSnapshot[]> {
    const ids = templateMeals.map((m) => m.recipeId);
    const recipes = await this.prisma.recipe.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, kcal: true },
    });
    const byId = new Map<string, { id: string; name: string; kcal: number }>(
      recipes.map((r: { id: string; name: string; kcal: number }) => [r.id, r]),
    );
    return templateMeals.map((m) => {
      const r = byId.get(m.recipeId);
      return { slot: m.slot, recipeId: m.recipeId, name: r?.name ?? '?', kcal: r?.kcal ?? 0 };
    });
  }

  // ---------- Valutazioni (segnale Gusto) ----------

  async rateRecipe(
    clientId: string,
    input: { recipeId: string; stars: number; tags?: string[]; date?: string },
  ) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id: input.recipeId } });
    if (!recipe) throw new NotFoundException('Ricetta non trovata');
    const date = toDateOnly(input.date);
    if (date.getTime() > toDateOnly().getTime()) {
      throw new BadRequestException('Non puoi valutare un pasto futuro');
    }
    return this.prisma.recipeRating.upsert({
      where: { clientId_recipeId_date: { clientId, recipeId: input.recipeId, date } },
      create: { clientId, recipeId: input.recipeId, date, stars: input.stars, tags: input.tags ?? [] },
      update: { stars: input.stars, tags: input.tags ?? [] },
    });
  }

  /**
   * Pasti consumati (giorni di menu fino a oggi) non ancora valutati:
   * la spec chiede di riproporre la valutazione all'apertura dell'app.
   */
  async pendingRatings(clientId: string) {
    const today = toDateOnly();
    const since = new Date(today.getTime() - 3 * 86_400_000); // ultimi 3 giorni
    const [days, ratings] = await Promise.all([
      this.prisma.menuDay.findMany({
        where: { clientId, date: { gte: since, lte: today } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.recipeRating.findMany({
        where: { clientId, date: { gte: since, lte: today } },
        select: { recipeId: true, date: true },
      }),
    ]);
    const rated = new Set(
      ratings.map((r: { recipeId: string; date: Date }) => `${r.recipeId}:${r.date.toISOString().slice(0, 10)}`),
    );
    const pending: { date: string; slot: string; recipeId: string; name: string }[] = [];
    for (const day of days) {
      const dateStr = day.date.toISOString().slice(0, 10);
      for (const meal of day.meals as unknown as MealSnapshot[]) {
        if (!rated.has(`${meal.recipeId}:${dateStr}`)) {
          pending.push({ date: dateStr, slot: meal.slot, recipeId: meal.recipeId, name: meal.name });
        }
      }
    }
    return pending;
  }

  // ---------- Lista spesa ----------

  /**
   * Lista spesa dei giorni erogati nell'intervallo (default: da oggi in avanti).
   *
   * ⚠️ **Si RICALCOLA a ogni lettura**, e la riga in tabella serve solo a conservare le spunte. Il
   * perché sta in `lista-della-spesa.ts`: prima, se la riga esisteva, si tornava quella — quindi
   * porzioni scalate, piatti cambiati in chat e grammature corrette dalla nutrizionista non
   * arrivavano mai nel carrello, e la lista *sembrava* la lista di quei giorni. ⚠️ Si **scrive solo
   * se è cambiato qualcosa** (`stessaLista`): una scrittura per ogni lettura muoverebbe `updatedAt`
   * senza che sia successo niente.
   */
  async shoppingList(clientId: string, from?: string, to?: string) {
    const today = toDateOnly();
    const days = await this.prisma.menuDay.findMany({
      where: {
        clientId,
        visibleFrom: { lte: today },
        date: { gte: from ? toDateOnly(from) : today, ...(to ? { lte: toDateOnly(to) } : {}) },
      },
      orderBy: { date: 'asc' },
      take: 7,
    });
    if (days.length === 0) {
      return { dateFrom: null, dateTo: null, items: [] };
    }
    const dateFrom = days[0].date;
    const dateTo = days[days.length - 1].date;

    /**
     * ⛔ **CHI HA LA LISTA DELLA SPESA IN MANO HA APERTO QUEI GIORNI** (26/8, trovato in revisione
     * della voce `visto-non-vuol-dire-aperto`).
     *
     * ⚠️ È il caso che la regola cita per giustificarsi — *«magari ci ha già fatto la spesa»* — e
     * senza questa riga sarebbe stato **l'unico scoperto**. Il segnale «aperto» lo manda l'app da due
     * schermate: la Home (il giorno di oggi) e il Menu (il giorno selezionato). La lista della spesa
     * mette in mano alla cliente il contenuto di **sette giorni futuri** e non ne toccava nessuno:
     * Giulia apriva la Home, toccava «Lista della spesa», comprava per la settimana e non entrava mai
     * nella scheda Menu — poi la nutrizionista dettava «niente pesce» e il motore le rifaceva tutti i
     * giorni comprati.
     *
     * ⛔ **È una regressione che prima non c'era**, e va detto: `viewedAt` veniva scritto su tutti i
     * trenta giorni della finestra a ogni `getMenu`, quindi questo caso era coperto — per sbaglio, ma
     * coperto. Restringere il segnale al giorno guardato lo scopriva.
     *
     * ⚠️ Non blocca la risposta e non fallisce mai in faccia a nessuno: la lista è il lavoro, questa
     * è la cronaca.
     */
    await this.segnaGiorniAperti(clientId, days.map((g: { date: Date }) => g.date));

    const recipeIds = [
      ...new Set(days.flatMap((d: { meals: unknown }) => (d.meals as MealSnapshot[]).map((m) => m.recipeId))),
    ];
    const recipes = await this.prisma.recipe.findMany({
      where: { id: { in: recipeIds as string[] } },
      select: { id: true, ingredients: true },
    });
    const byId = new Map(
      recipes.map((r: { id: string; ingredients: unknown }) => [r.id, (r.ingredients ?? []) as IngredienteRicetta[]]),
    );
    const calcolate = aggregaSpesa(days as { meals: unknown }[], byId);

    const existing = await this.prisma.shoppingList.findUnique({
      where: { clientId_dateFrom_dateTo: { clientId, dateFrom, dateTo } },
    });
    if (!existing) {
      return this.prisma.shoppingList.create({
        data: { clientId, dateFrom, dateTo, items: calcolate as never },
      });
    }
    const unite = conservaSpuntati(calcolate, existing.items);
    if (stessaLista(unite, existing.items)) return existing;
    return this.prisma.shoppingList.update({ where: { id: existing.id }, data: { items: unite as never } });
  }

  /** Spunta/despunta un elemento della lista. */
  async checkItem(clientId: string, listId: string, itemName: string, checked: boolean) {
    const list = await this.prisma.shoppingList.findFirst({ where: { id: listId, clientId } });
    if (!list) throw new NotFoundException('Lista spesa non trovata');
    const items = (list.items as { name: string; checked: boolean }[]).map((item) =>
      item.name.toLowerCase() === itemName.toLowerCase() ? { ...item, checked } : item,
    );
    return this.prisma.shoppingList.update({ where: { id: listId }, data: { items: items as never } });
  }
}

/**
 * Stagione METEOROLOGICA dell'emisfero nord, che è dove stanno le clienti.
 * Si usano i confini meteorologici (mar-mag, giu-ago, set-nov, dic-feb) e non quelli astronomici:
 * a fine giugno il calendario dice ancora primavera per qualche giorno, ma nessuno cucina lo
 * spezzatino — ed è proprio quel caso che ha fatto nascere questa regola.
 */
export function stagioneCorrente(d: Date = new Date()): string {
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}


/**
 * La famiglia del paniere di una variante, o `null` se quella variante non versa in nessun paniere
 * (le famiglie che il §2.1 del piano dichiara assi travestiti da famiglia).
 *
 * ⚠️ Serve solo quando l'interruttore è su `paniere`. Con `giornate` — il default — non viene
 * nemmeno guardata.
 */
export function famigliaDelPaniere(
  d: { name?: string | null; regime?: string | null } | null | undefined,
): string | null {
  if (!d?.name || !d?.regime) return null;
  const esito = paniereDellaVariante({ id: '', name: d.name, regime: d.regime });
  return esito.tipo === 'paniere' ? esito.famiglia : null;
}
