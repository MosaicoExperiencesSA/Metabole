import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { avvisaCoachDellaCliente, avvisaNutrizionistaDellaCliente } from '../common/avvisa-nutrizionista';
import { toDateOnly } from '../common/date-only';
import { ConfigParamsService } from '../config-params/config-params.service';
import { apriSegnalazione } from '../escalations/apri-segnalazione';
import { apriRichiestaVera } from '../vera/apri-richiesta';
import { CHIAVE_GAIA } from '../vera/risposta-alla-cliente';
import { nonHoCapito, pastoNominato, proponeUnPastoIntero } from './ascolto';
import { distanzaGiorni, etichettaGiorno, giornoDellaConversazione } from './giorno-conversazione';
import {
  FINESTRA_GIORNI,
  PAUSA_FRA_INVITI_GIORNI,
  SOGLIA_GIORNI_DEFAULT,
  giorniConCambioDellaCliente,
  testoAvvisoCoach,
  testoInvitoARiflettere,
} from './insistenza-cambi';
// §16.9: una funzione, non un servizio iniettato. Il percorso del pasto non deve dipendere da un
// modulo di backoffice — vedi il commento in `food-swaps.module.ts`.
import { registraSostituzione } from '../food-swaps/registra-sostituzione';
// ⚠️ Vive fuori da qui, e apposta: la chiamano anche la lista della spesa e la scheda ricetta,
// che di questo servizio non hanno bisogno. Vedi `menu/ingredienti-effettivi.ts`.
import { fattoreDaDire } from './porzione-del-giorno';
import { quantitaScalata } from './porzione-scalata';
import { ingredientiEffettivi } from './ingredienti-effettivi';
import { PrismaService } from '../prisma/prisma.service';
import {
  ordinaAlternative,
  preferenzaDaTesto,
  rilevaIntentoAltroPiatto,
  slotDaRisposta,
  testoCambioPiattoFatto,
  testoChiediQualePasto,
  testoNessunaAlternativa,
  testoProponiAlternative,
  testoSceltaNonValida,
  filtraPerGusto,
  gustoDaTesto,
  testoChiediGustoColazione,
  type CandidatoPiatto,
  type GustoColazione,
} from './cambio-piatto';
import { exclusionKeys, hitsExclusion } from './exclusions';
import { IngredienteRicetta, MealSnapshot, Substitution } from './pasto-giornata';
import {
  MOTIVI,
  Motivo,
  MotivoKey,
  PropostaSostituzione,
  StatoSostituzione,
  combaciaAlimento,
  condividonoAlimento,
  correggiGrammatura,
  apreFrase,
  etichettaSlot,
  nelloSlot,
  contropropostaDaTesto,
  riconosciConferma,
  riconosciMotivo,
  sceltaDopoIlNo,
  sensoDelNo,
  terminiCandidati,
  testoAllergene,
  testoAltroSostituto,
  testoAnnullato,
  testoChiediCibo,
  testoChiediMotivo,
  testoChiediPercheNo,
  testoCiboNonTrovato,
  testoConferma,
  testoContropropostaAllergene,
  testoContropropostaEsclusa,
  testoContropropostaNonPrevista,
  testoContropropostaOk,
  testoContropropostaStessoAlimento,
  testoFatto,
  testoGiaFatto,
  testoMotivoNonCapito,
  testoNessunSostituto,
  testoNienteAltroSostituto,
  testoRifiutoNonCapito,
  unitaPerSostituto,
} from './sostituzione-chat';
import { sostitutoSicuro } from './sostituzioni-sicure';
import { classificaSpezia } from './spezie';

/**
 * Un possibile sostituto, con la sua provenienza.
 *
 * La `fonte` non è decorativa: decide quali filtri si applicano. Un candidato che viene da un gruppo
 * di equivalenza **approvato** porta con sé il giudizio della nutrizionista, e non va passato al
 * setaccio delle euristiche pensate per la mappa automatica. Vedi `scegliSostituto`.
 */
interface Candidato {
  nome: string;
  fonte: 'gruppo' | 'mappa';
}

/** Cosa deve fare la chat con la risposta del flusso. */
export interface EsitoSostituzione {
  /** Il testo che Gaia scrive alla cliente. */
  testo: string;
  /**
   * Stato del dialogo da appendere al `meta` del messaggio di Gaia. Assente = flusso chiuso
   * (concluso, annullato o arreso): il messaggio successivo della cliente torna al filtro
   * normale.
   */
  stato?: StatoSostituzione;
  /** Il flusso si è arreso: il messaggio va inoltrato a una persona. */
  inoltraA?: 'coach' | 'nutritionist';
  esito: 'aperto' | 'in_corso' | 'applicata' | 'annullata' | 'arresa' | 'rifiutata';
  /** Riepilogo di ciò che è stato scritto sul menu (per il `meta` e per l'audit). */
  applicata?: { giorni: number; da: string; a: string; motivo: MotivoKey; pasti: number };
}

interface PastoConRicetta {
  pasto: MealSnapshot;
  nome: string;
  /** Ingredienti come stanno nel piatto oggi: catalogo + sostituzioni già concordate. */
  ingredienti: IngredienteRicetta[];
  /** `Diet.id` della giornata: serve a filtrare i gruppi di equivalenza per prodotto. */
  dietId: string | null;
}

/** Una sostituzione nata in chat, come la legge la scheda cliente in backoffice. */
export interface SostituzioneInChat {
  /**
   * `ingrediente` = scambio di un alimento dentro il piatto · `piatto` = il piatto è stato cambiato
   * tutto. In scheda vanno nella stessa tabella ma la nutrizionista deve poterli distinguere: «ha
   * cambiato l'olio» e «ha cambiato la colazione» non si guardano con lo stesso occhio.
   */
  tipo: 'ingrediente' | 'piatto';
  data: string;
  slot: string;
  slotLabel: string;
  piatto: string;
  from: string;
  to: string;
  /** ⚠️ Grammature di CATALOGO: sono quelle scritte sul menu. Per quelle del piatto vedi sotto. */
  fromQty?: number;
  toQty?: number;
  /**
   * LE GRAMMATURE **DEL PIATTO SUO** — quelle che la cliente ha davvero davanti (19/8, decisione di
   * Simone: «il numero del piatto»).
   *
   * ⚠️ Le porzioni si scalano sul fabbisogno dal 18/8: «120 g di biete al posto di 100 g di carote»
   * è il rapporto di catalogo, mentre nel piatto di quella cliente ce ne sono 216. La nutrizionista
   * che approva o corregge la grammatura ragionava sul numero di catalogo, e da quando l'app quel
   * numero non lo mostra più il suo era rimasto l'unico «ufficiale» accanto a quello della ricetta.
   *
   * ⚠️ Li calcola il **server**, con la stessa `quantitaScalata` della scheda ricetta e della lista
   * della spesa: rifare l'arrotondamento nel backoffice darebbe «216 g» di là e «215 g» di qua, che
   * si legge come un errore di misura invece che come una regola. Assenti quando il piatto non è
   * scalato — allora i due numeri coincidono e non c'è niente da distinguere.
   */
  fromQtyPiatto?: number;
  toQtyPiatto?: number;
  unit?: string;
  /** Unità del sostituto, se diversa da quella di partenza (es. panna in ml → burro in g). */
  unitA?: string;
  motivo?: string;
  reason: string;
  stato: string;
  concordataIl?: string;
  grammaturaCorretta?: boolean;
  /** Quando la nutrizionista l'ha guardato, e la sua nota: è ciò che rende visibile la verifica. */
  verificataIl?: string;
  nota?: string;
}

/**
 * Quello che la nutrizionista decide su un cambio nato in chat. Il cambio si individua per
 * **giornata + pasto + alimento** e non per un id, perché non ne ha uno: vive dentro il JSON dei
 * pasti di quel giorno (nessuna migrazione, per scelta — vedi la testa di questa classe).
 */
export interface CorrezioneCambio {
  /** `YYYY-MM-DD` della giornata. */
  data: string;
  slot: string;
  tipo: 'ingrediente' | 'piatto';
  /** L'alimento sostituito: identifica la sostituzione dentro il pasto. Solo per `ingrediente`. */
  from?: string;
  stato: 'verificata' | 'corretta' | 'annullata';
  /** Il sostituto giusto, se quello concordato in chat non va (solo con `stato: 'corretta'`). */
  to?: string;
  toQty?: number;
  unitA?: string;
  /** Perché. La legge anche la cliente: vedi `Substitution.nota`. */
  nota?: string;
}

/** Annullamento esplicito: solo una risposta secca, per non confonderla con «non mi piace». */
const ANNULLA_SECCO = /^(no|annulla|lascia stare|lascia perdere|niente|nulla)[.!]?$/;


/** Maiuscola sulla prima lettera: le etichette dei pasti nascono minuscole per stare in frase. */
const maiuscolaIniziale = (t: string): string => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

const normalizza = (testo: string): string =>
  (testo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/**
 * Il ponte fra la conversazione con Gaia e il menu della giornata (punto 1 di
 * `progetto/PROGETTO_gaia-cambio-menu.md`).
 *
 * Prima di questo, la cliente si accordava con Gaia, chiudeva la chat, apriva il menu e
 * trovava ancora le carote: doveva ricordarselo lei, e quello che aveva detto non lo sapeva
 * nessuno. Qui la sostituzione concordata viene SCRITTA sulla giornata — solo per lei, solo
 * per il periodo che il motivo comporta — e resta leggibile in scheda cliente.
 *
 * Tre cose che non fa, per scelta:
 * - **non tocca mai la ricetta di catalogo**: è di tutte, non di una. Il cambio vive dentro
 *   `MenuDay.meals` della singola cliente (nessuna migrazione: il campo è già JSON);
 * - **non decide i grammi**: per ora propone pari grammatura. Il controllo di plausibilità
 *   c'è già (`correggiGrammatura`) ma è inerte finché è il codice a proporre la quantità;
 *   servirà quando i grammi li dirà Gaia (punto 3 del progetto);
 * - **non chiude niente da sola quando è insicura**: se non ha un sostituto che regge, o se
 *   c'è di mezzo un allergene, passa la mano a una persona.
 */
@Injectable()
export class SostituzioneChatService {
  private readonly logger = new Logger(SostituzioneChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    // La tolleranza sulle kcal del cambio di piatto è una SOGLIA: sta in `config_param`, non nel
    // codice (regola di progetto). Riusa `menu_kcal_balance_tolerance_pct`, la stessa con cui il
    // motore bilancia le giornate: due tolleranze diverse per la stessa cosa sarebbero due verità.
    private readonly configParams: ConfigParamsService,
  ) {}

  // ---------- Ingressi ----------

  /**
   * Come si chiama, per i testi di Gaia (richiesta di Simone, 8/8).
   *
   * L'ordine conta: prima `clientProfile.name` — il nome con cui la cliente **vuole** essere
   * chiamata — e poi `user.firstName`. Il ripiego non è teorico: `sistema:nomi` **svuota** l'alias
   * quando è identico al nome completo, quindi da oggi quel campo è null per parecchie clienti, e
   * senza il ripiego Gaia le chiamerebbe tutte per «niente». Un errore non si vede in nessun test:
   * si vede in chat, e lo vedrebbe la cliente.
   */
  private async nomeDi(clientId: string): Promise<string | null> {
    try {
      const [profilo, utente] = await Promise.all([
        this.prisma.clientProfile.findUnique({ where: { userId: clientId }, select: { name: true } }),
        this.prisma.user.findUnique({ where: { id: clientId }, select: { firstName: true } }),
      ]);
      return (profilo?.name ?? null) || ((utente as { firstName?: string | null } | null)?.firstName ?? null);
    } catch {
      // Il nome è una gentilezza, non un requisito: se non si legge, Gaia parla senza.
      return null;
    }
  }


  /**
   * Ogni risposta che apre o continua il dialogo si porta dietro la DOMANDA che ha appena fatto.
   *
   * Serve al «perdonami, non ho capito, la mia domanda è…»: la domanda si ripete parola per parola,
   * e l'unico modo di garantirlo è tenerne una copia invece di ricostruirla. Si applica qui, agli
   * ingressi pubblici, così nessun passo può dimenticarsene.
   */
  private ricorda(esito: EsitoSostituzione): EsitoSostituzione {
    if (!esito.stato) return esito;
    return { ...esito, stato: { ...esito.stato, ultimaDomanda: esito.testo } };
  }

  /**
   * Apertura dal pulsante «Sostituisci un ingrediente» dell'app: Gaia elenca i piatti della
   * giornata e chiede quale alimento cambiare.
   *
   * `data` arriva dall'app quando la cliente sta guardando il menu di un giorno diverso da oggi
   * (§16.2): il pulsante sa quale giornata ha aperto, e finora quell'informazione si perdeva.
   */
  async apri(clientId: string, data?: string | null): Promise<EsitoSostituzione> {
    const oggi = this.oggiIso();
    // ⚠️ Un giorno PASSATO non si ripiega su oggi in silenzio: rispondere di una giornata diversa
    // da quella che ha chiesto è esattamente il difetto che stiamo togliendo. Si dice, e basta.
    if (data && distanzaGiorni(data, oggi) < 0) {
      return {
        testo: apreFrase(
          await this.nomeDi(clientId),
          'Quel menu è già passato, e su una giornata finita non posso più cambiare niente. Se vuoi sistemiamo quella di oggi o dei prossimi giorni. 💚',
        ),
        esito: 'rifiutata',
      };
    }
    const giorno = giornoDellaConversazione({ statoData: data, oggiIso: oggi });
    const quando = etichettaGiorno(giorno, oggi);
    const [pasti, nome] = await Promise.all([this.pastiDelGiorno(clientId, giorno), this.nomeDi(clientId)]);
    const elenco = pasti.map((p) => ({ slot: p.pasto.slot, piatto: p.nome }));
    if (!elenco.length) {
      return { testo: testoChiediCibo([], nome, quando), esito: 'rifiutata' };
    }
    return this.ricorda({
      testo: testoChiediCibo(elenco, nome, quando),
      stato: { passo: 'cibo', tentativi: 0, data: giorno },
      esito: 'aperto',
    });
  }

  /**
   * Apertura da testo libero («vorrei sostituire le carote»): se l'alimento è già riconoscibile
   * nel menu di oggi si salta la domanda e si passa direttamente al motivo.
   */
  async apriDaTesto(clientId: string, testoCliente: string): Promise<EsitoSostituzione> {
    const oggi = this.oggiIso();
    const giorno = giornoDellaConversazione({ testo: testoCliente, oggiIso: oggi });
    const quando = etichettaGiorno(giorno, oggi);
    const [tutti, nome] = await Promise.all([this.pastiDelGiorno(clientId, giorno), this.nomeDi(clientId)]);
    if (!tutti.length) return { testo: testoChiediCibo([], nome, quando), esito: 'rifiutata' };

    // «Sostituisco tutto il pasto con X, Y e Z»: non è una sostituzione di ingrediente, e provare a
    // estrarne uno è il modo di rispondere a caso. Si chiede cosa preferisce (12/8).
    if (proponeUnPastoIntero(testoCliente)) {
      return this.ricorda(this.chiediPastoIntero(tutti, testoCliente, nome, giorno, quando));
    }

    const pasti = this.soloIlPastoNominato(tutti, testoCliente);
    const trovato = this.trovaIngrediente(pasti, testoCliente);
    if (!trovato) {
      return this.ricorda({
        testo: testoChiediCibo(pasti.map((p) => ({ slot: p.pasto.slot, piatto: p.nome })), nome, quando),
        stato: { passo: 'cibo', tentativi: 0, data: giorno },
        esito: 'aperto',
      });
    }
    return this.ricorda(await this.proponi(clientId, trovato, giorno));
  }

  /** Passo successivo del dialogo, a partire dallo stato appeso all'ultimo messaggio di Gaia. */
  async avanza(
    clientId: string,
    statoIn: StatoSostituzione,
    testoCliente: string,
  ): Promise<EsitoSostituzione> {
    // Uscita sempre disponibile, in qualunque passo. Deve essere una risposta SECCA: «no, non
    // mi piace» al passo del motivo è un motivo, non un annullamento, e trattarlo come tale
    // butterebbe via la conversazione proprio quando sta arrivando al punto.
    //
    // ⚠️ NON vale alla conferma né dopo un rifiuto: là il «no» è la risposta a una domanda che
    // abbiamo fatto noi, e chiuderla come annullamento è esattamente il difetto che Simone ha
    // visto l'8/8 («quando la cliente dice no non si deve fermare, deve indagare sul perché»).
    const secco = ANNULLA_SECCO.test(normalizza(testoCliente));
    const oggi = this.oggiIso();
    // La giornata di cui si sta parlando si decide QUI, una volta, e poi viaggia nello stato: se
    // ogni passo la ricalcolasse, un «sì» al passo della conferma riporterebbe la conversazione a
    // oggi proprio mentre si sta per scrivere sul menu di domani (§16.2).
    const stato = { ...statoIn, data: giornoDellaConversazione({ testo: testoCliente, statoData: statoIn.data, oggiIso: oggi }) };
    if (secco && stato.passo !== 'conferma' && stato.passo !== 'rifiuto') {
      return { testo: testoAnnullato(await this.nomeDi(clientId), etichettaGiorno(stato.data, oggi)), esito: 'annullata' };
    }
    if (stato.passo === 'pasto_intero') return this.ricorda(await this.passoPastoIntero(clientId, stato, testoCliente));
    if (stato.passo === 'cibo') return this.ricorda(await this.passoCibo(clientId, stato, testoCliente));
    if (stato.passo === 'motivo') return this.ricorda(await this.passoMotivo(clientId, stato, testoCliente));
    if (stato.passo === 'scelta_piatto') return this.ricorda(await this.passoSceltaPiatto(clientId, stato, testoCliente));
    if (stato.passo === 'scelta_pasto') return this.ricorda(await this.passoSceltaPasto(clientId, stato, testoCliente));
    if (stato.passo === 'colazione_gusto') return this.ricorda(await this.passoColazioneGusto(clientId, stato, testoCliente));
    if (stato.passo === 'rifiuto') return this.ricorda(await this.passoRifiuto(clientId, stato, testoCliente));
    return this.ricorda(await this.passoConferma(clientId, stato, testoCliente));
  }

  // ---------- Passi ----------

  /**
   * Se la cliente ha NOMINATO un pasto, si guarda solo quello.
   *
   * È metà del difetto del 12/8: aveva scritto «a pranzo» e la ricerca ha trovato «cruda» nella
   * quinoa della CENA. Il pasto nominato è un'informazione che restringe, e ignorarla vuol dire
   * rispondere di un piatto di cui non si stava parlando. Se quel pasto non c'è in quella giornata
   * si torna a guardarli tutti: meglio cercare largo che non cercare.
   */
  private soloIlPastoNominato(pasti: PastoConRicetta[], testoCliente: string): PastoConRicetta[] {
    const slot = pastoNominato(testoCliente);
    if (!slot) return pasti;
    const soloQuello = pasti.filter((p) => p.pasto.slot === slot);
    return soloQuello.length ? soloQuello : pasti;
  }

  /**
   * Il BIVIO sul pasto intero (richiesta di Simone del 12/8).
   *
   * «Voglio cambiare il pranzo con verdura cruda e tonno» non è una sostituzione di ingrediente:
   * è un pasto riscritto, e rifare i conti di calorie e macro è mestiere della nutrizionista.
   * Ma passarglielo e basta è arrendersi troppo presto — spesso quello che la cliente vuole è
   * semplicemente *un altro piatto*, e quello Gaia lo sa fare, a pari calorie e dentro il
   * ricettario approvato per lei. Quindi si chiede quale delle due cose vuole.
   *
   * Due opzioni numerate e non una domanda aperta: la risposta è una parola sola, e non c'è un
   * terzo modo di fraintendersi in un dialogo che ha appena dimostrato di fraintendere.
   */
  private chiediPastoIntero(
    pasti: PastoConRicetta[],
    testoCliente: string,
    nome: string | null,
    giorno: string,
    quando: string,
  ): EsitoSostituzione {
    const slot = pastoNominato(testoCliente);
    const pasto = (slot ? pasti.find((p) => p.pasto.slot === slot) : undefined) ?? pasti[0];
    const dove = pasto ? ` ${nelloSlot(pasto.pasto.slot)}` : '';
    const chi = nome ? ` ${nome}` : '';
    return {
      testo:
        `Aspetta${chi}: quello che mi stai chiedendo è di cambiare **tutto il pasto**${dove}` +
        `${quando === 'oggi' ? '' : ` di ${quando}`}, non un ingrediente. Per riscriverlo con quello che hai scelto tu ` +
        'devo passare dalla tua nutrizionista, perché le calorie e i valori del pasto vanno rifatti — e quello lo decide lei.\n\n' +
        'Come preferisci?\n\n' +
        '1) Passa la richiesta alla nutrizionista\n' +
        '2) Proponimi tu un\'alternativa dal mio ricettario, a pari calorie\n\n' +
        'Rispondi con 1 o 2.',
      stato: {
        passo: 'pasto_intero',
        tentativi: 0,
        data: giorno,
        slotPiatto: pasto?.pasto.slot,
        cibo: testoCliente.trim().slice(0, 300),
      },
      esito: 'aperto',
    };
  }

  /** La risposta al bivio: la nutrizionista, oppure un'alternativa scelta da Gaia. */
  private async passoPastoIntero(
    clientId: string,
    stato: StatoSostituzione,
    testoCliente: string,
  ): Promise<EsitoSostituzione> {
    const t = normalizza(testoCliente);
    const nutrizionista = /^\s*1\b|nutrizion|passa|gira|manda|chied(i|ile)|si\b|sicur/.test(t);
    const alternativa = /^\s*2\b|alternativ|propon|scegli tu|vedi tu|fai tu|tu\b/.test(t);

    // L'alternativa si guarda per PRIMA: «2, proponimi tu» contiene «propon» e non deve finire
    // nel ramo della nutrizionista solo perché la frase comincia con un numero ambiguo.
    if (alternativa && !/^\s*1\b/.test(t)) {
      const preferenza = stato.cibo ?? '';
      return this.proponiAltroPiatto(clientId, preferenza, stato.slotPiatto, stato.data);
    }
    if (nutrizionista) {
      await this.passaAllaNutrizionista(
        clientId,
        `Sostituzione dell'intero pasto chiesta in chat${stato.slotPiatto ? ` (${etichettaSlot(stato.slotPiatto)})` : ''}: ` +
          `«${stato.cibo ?? ''}». Va rifatto il conto di calorie e macro: decide la nutrizionista.`,
      );
      return {
        testo:
          'Fatto: ho girato la richiesta alla tua nutrizionista con quello che hai scritto. ' +
          'Ti risponde lei nel vostro thread. 🩺',
        inoltraA: 'nutritionist',
        esito: 'rifiutata',
      };
    }

    // Non ha risposto né 1 né 2. Si ripete la domanda, identica; al secondo tentativo si sceglie
    // la strada sicura — la nutrizionista — invece di continuare a chiedere.
    const tentativi = (stato.tentativi ?? 0) + 1;
    if (tentativi >= 2) {
      await this.passaAllaNutrizionista(
        clientId,
        `Sostituzione dell'intero pasto chiesta in chat${stato.slotPiatto ? ` (${etichettaSlot(stato.slotPiatto)})` : ''}: ` +
          `«${stato.cibo ?? ''}». La cliente non ha scelto fra le due opzioni: girata a te.`,
      );
      return {
        testo: 'Preferisco non indovinare: ho girato la richiesta alla tua nutrizionista, ti risponde lei. 🩺',
        inoltraA: 'nutritionist',
        esito: 'arresa',
      };
    }
    return {
      testo: nonHoCapito(stato.ultimaDomanda, await this.nomeDi(clientId)),
      stato: { ...stato, tentativi },
      esito: 'in_corso',
    };
  }

  private async passoCibo(
    clientId: string,
    stato: StatoSostituzione,
    testoCliente: string,
  ): Promise<EsitoSostituzione> {
    const oggi = this.oggiIso();
    const giorno = stato.data ?? oggi;
    const quando = etichettaGiorno(giorno, oggi);
    const nome = await this.nomeDi(clientId);
    const tutti = await this.pastiDelGiorno(clientId, giorno);
    if (!tutti.length) return { testo: testoChiediCibo([], nome, quando), esito: 'rifiutata' };

    // Il pasto intero prima di tutto: è la richiesta che, provando a cavarne un ingrediente,
    // produceva la risposta a caso.
    if (proponeUnPastoIntero(testoCliente)) {
      return this.chiediPastoIntero(tutti, testoCliente, nome, giorno, quando);
    }

    const pasti = this.soloIlPastoNominato(tutti, testoCliente);
    const trovato = this.trovaIngrediente(pasti, testoCliente);
    if (trovato) return this.proponi(clientId, trovato, giorno);

    // Ha scritto il nome del PIATTO invece dell'alimento: è l'equivoco più comune, e dirglielo
    // costa una riga in meno che farle ripetere tutto.
    const piatto = this.trovaPiatto(pasti, testoCliente);
    const tentativi = (stato.tentativi ?? 0) + 1;
    if (piatto && tentativi < 2) {
      return {
        testo: `«${piatto.nome}» è il nome del piatto. Dimmi quale alimento al suo interno non va: ci sono ${piatto.ingredienti
          .map((i) => i?.name)
          .filter(Boolean)
          .slice(0, 6)
          .join(', ')}.`,
        stato: { ...stato, passo: 'cibo', tentativi },
        esito: 'in_corso',
      };
    }

    const cibo = testoCliente.trim().slice(0, 60);
    if (tentativi >= 2) {
      return { testo: testoCiboNonTrovato(cibo, true, quando), inoltraA: 'coach', esito: 'arresa' };
    }
    /**
     * Non ho capito → lo dico e RIPETO LA DOMANDA (richiesta di Simone, 12/8).
     *
     * Se aveva nominato un pasto, la domanda che si ripete è quella mirata su quel pasto: elencarle
     * di nuovo tutta la giornata quando lei ha già detto «a pranzo» è ripetere la domanda sbagliata.
     */
    const slotDetto = pastoNominato(testoCliente);
    const soloQuello = slotDetto ? tutti.find((p) => p.pasto.slot === slotDetto) : undefined;
    const domanda = soloQuello
      ? `${maiuscolaIniziale(nelloSlot(soloQuello.pasto.slot))} hai «${soloQuello.nome}». Quale di questi vuoi cambiare? ` +
        soloQuello.ingredienti.map((i) => i?.name).filter(Boolean).slice(0, 8).join(', ') + '.'
      : (stato.ultimaDomanda ?? testoChiediCibo(tutti.map((p) => ({ slot: p.pasto.slot, piatto: p.nome })), nome, quando));
    return {
      testo: nonHoCapito(domanda, nome),
      stato: { ...stato, passo: 'cibo', tentativi },
      esito: 'in_corso',
    };
  }

  private async passoMotivo(
    clientId: string,
    stato: StatoSostituzione,
    testoCliente: string,
  ): Promise<EsitoSostituzione> {
    const motivo = riconosciMotivo(testoCliente);
    if (!motivo) {
      const tentativi = (stato.tentativi ?? 0) + 1;
      if (tentativi >= 2) {
        return { testo: testoMotivoNonCapito(true), inoltraA: 'coach', esito: 'arresa' };
      }
      // «Perdonami, non ho capito. La mia domanda è: …» con la domanda ripetuta parola per parola
      // (Simone, 12/8). `testoMotivoNonCapito` resta come coda: rielenca i quattro motivi, che è
      // l'informazione che serve a rispondere.
      return {
        testo: `${nonHoCapito(stato.ultimaDomanda, await this.nomeDi(clientId))}\n\n${testoMotivoNonCapito(false)}`,
        stato: { ...stato, tentativi },
        esito: 'in_corso',
      };
    }
    if (!stato.proposta) {
      // Non dovrebbe capitare (il motivo si chiede solo dopo la proposta): si riparte pulito.
      return this.apri(clientId);
    }
    return {
      testo: testoConferma(
        stato.proposta,
        motivo,
        await this.nomeDi(clientId),
        // `sempre` vale da oggi anche se si parlava di domani: lo dice `testoDurata`, e qui si
        // passa la giornata di cui si parla — è quella che finisce nella frase «solo per …».
        etichettaGiorno(stato.proposta.data || this.oggiIso(), this.oggiIso()),
      ),
      stato: { ...stato, passo: 'conferma', motivo: motivo.key, tentativi: 0 },
      esito: 'in_corso',
    };
  }

  private async passoConferma(
    clientId: string,
    stato: StatoSostituzione,
    testoCliente: string,
  ): Promise<EsitoSostituzione> {
    const risposta = riconosciConferma(testoCliente);
    if (risposta === 'no') {
      // IL PUNTO DELLA CONVERSAZIONE DELL'8/8. Qui la cliente aveva scritto «no, voglio una
      // colazione proteica»: un «no» alla sostituzione **e** una richiesta nuova. Rispondere solo
      // «va bene, non cambio niente» era corretto e inutile — la richiesta era già arrivata.
      if (rilevaIntentoAltroPiatto(testoCliente)) {
        return this.proponiAltroPiatto(clientId, testoCliente, stato.proposta?.slot);
      }
      if (!stato.proposta) return { testo: testoAnnullato(await this.nomeDi(clientId)), esito: 'annullata' };
      // SECONDA CORREZIONE DELL'8/8, la sera. «no perché non voglio 70 gr di burro» è un no a
      // QUEL sostituto, non al cambio: la cliente la panna la vuole ancora fuori dal piatto.
      // Chiudere con «va bene, non cambio niente» la lasciava col problema di partenza.
      const senso = sensoDelNo(testoCliente, stato.proposta.a);
      if (senso === 'ripensata') return { testo: testoAnnullato(await this.nomeDi(clientId)), esito: 'annullata' };
      // TERZA CORREZIONE, dal collaudo dell'OTA del 9/8: dentro il «no» può esserci **la sua**
      // proposta («no, posso usare il burro vegetale?»). Va guardata prima di `senso`, perché una
      // frase che nomina il sostituto rifiutato *e* un'alternativa vale più della prima metà.
      const daLei = await this.passoControproposta(clientId, stato, testoCliente);
      if (daLei) return daLei;
      if (senso === 'sostituto') return this.altroSostituto(clientId, stato);
      // «No» secco: non sappiamo quale delle due cose sia, e indovinare è peggio che chiedere.
      return {
        testo: testoChiediPercheNo(stato.proposta, await this.nomeDi(clientId)),
        stato: { ...stato, passo: 'rifiuto', tentativi: 0 },
        esito: 'in_corso',
      };
    }
    if (risposta !== 'si') {
      // IL DIFETTO DEL COLLAUDO DEL 9/8, nella sua forma pura: «l'olio mi fa peso posso usare il
      // burro vegetale?» non è né sì né no, ed è una richiesta precisa. Prima di dire «non ho
      // capito» si guarda se dentro c'è un alimento che sta proponendo lei.
      const daLei = await this.passoControproposta(clientId, stato, testoCliente);
      if (daLei) return daLei;
      const tentativi = (stato.tentativi ?? 0) + 1;
      if (tentativi >= 2) {
        return { testo: testoAnnullato(await this.nomeDi(clientId)), esito: 'annullata' };
      }
      return {
        testo: 'Non ho capito: confermi il cambio? Rispondi «sì» oppure «no».',
        stato: { ...stato, tentativi },
        esito: 'in_corso',
      };
    }
    const motivo = MOTIVI.find((m) => m.key === stato.motivo);
    if (!motivo || !stato.proposta) return this.apri(clientId);
    return this.applica(clientId, stato.proposta, motivo);
  }

  /**
   * Dopo un «no» secco: la cliente ha detto quale delle tre strade prendere. Nessuna di queste
   * chiude la conversazione a mani vuote, tranne quella che chiede lei.
   */
  private async passoRifiuto(
    clientId: string,
    stato: StatoSostituzione,
    testoCliente: string,
  ): Promise<EsitoSostituzione> {
    if (rilevaIntentoAltroPiatto(testoCliente)) {
      return this.proponiAltroPiatto(clientId, testoCliente, stato.proposta?.slot);
    }
    const scelta = sceltaDopoIlNo(testoCliente);
    if (scelta === 'annulla') return { testo: testoAnnullato(await this.nomeDi(clientId)), esito: 'annullata' };
    if (scelta === 'altro_piatto') return this.proponiAltroPiatto(clientId, testoCliente, stato.proposta?.slot);
    // Anche qui la cliente può rispondere con un nome invece che con un numero («il burro
    // vegetale»): è una quarta strada che non abbiamo elencato, e va capita.
    const daLei = await this.passoControproposta(clientId, stato, testoCliente);
    if (daLei) return daLei;
    // Un motivo scritto a parole («non mi piace», «non ce l'ho in casa») vale come «questo
    // sostituto no»: è la stessa cosa detta in un altro modo.
    if (scelta === 'altro_sostituto' || riconosciMotivo(testoCliente)) return this.altroSostituto(clientId, stato);

    const tentativi = (stato.tentativi ?? 0) + 1;
    if (tentativi >= 2) {
      return { testo: testoRifiutoNonCapito(true), inoltraA: 'coach', esito: 'arresa' };
    }
    return { testo: testoRifiutoNonCapito(false), stato: { ...stato, tentativi }, esito: 'in_corso' };
  }

  /**
   * LA CONTROPROPOSTA: quando è la cliente a dire quale sostituto vuole.
   *
   * Difetto visto nel collaudo dell'OTA 2.1.3 (9/8): alla conferma ha scritto «l'olio mi fa peso
   * posso usare il burro vegetale?» e si è sentita rispondere «Non ho capito: confermi il cambio?».
   * C'erano dentro due informazioni — un motivo e un sostituto scelto da lei — e chiedere di nuovo
   * la stessa cosa è il modo più rapido di sprecare la fiducia appena costruita.
   *
   * Le regole di sicurezza NON si allentano perché la proposta arriva da lei: si accetta solo un
   * alimento che sta fra gli **equivalenti approvati** per quell'ingrediente, e che passa allergeni
   * ed esclusioni. Tutto il resto passa dalla nutrizionista — che è l'unica che può dire sì a una
   * cosa che il ricettario non prevede.
   *
   * Torna `null` quando nel messaggio non c'è nessuna proposta: il chiamante continua per la sua
   * strada (il «non ho capito», o le tre strade dopo il no).
   */
  private async passoControproposta(
    clientId: string,
    stato: StatoSostituzione,
    testoCliente: string,
  ): Promise<EsitoSostituzione | null> {
    const proposta = stato.proposta;
    if (!proposta) return null;
    const letto = contropropostaDaTesto(testoCliente, [proposta.da, proposta.a, ...(stato.scartati ?? [])]);
    if (!letto?.termini.length) return null;
    const { termini, esplicita } = letto;

    const nome = await this.nomeDi(clientId);
    // La giornata è quella della PROPOSTA: se la conversazione è partita da «domani», la
    // controproposta riguarda domani, non oggi (§16.2).
    const pasti = await this.pastiDelGiorno(clientId, proposta.data);
    const pasto = pasti.find((p) => p.pasto.slot === proposta.slot);
    // Il menu è cambiato sotto i piedi: meglio ricominciare che decidere su una giornata che non è
    // più quella (stessa scelta di `altroSostituto`).
    if (!pasto) return this.apri(clientId, proposta.data);

    // Solo fra gli equivalenti approvati per QUESTO alimento: è il confine fra «la cliente scrive
    // un nome» e «la cliente sceglie un sostituto». Il nome che si usa poi è quello del catalogo,
    // non quello che ha scritto lei: è quello che finisce nel piatto e nella scheda.
    const ammissibili = await this.candidati(proposta.da, proposta.da, pasto.dietId);
    // Qui interessa solo il nome: la provenienza serve ai filtri di `scegliSostituto`, non a
    // riconoscere quello che la cliente ha scritto.
    const scelto = ammissibili.map((c) => c.nome).find((c) => termini.some((t) => combaciaAlimento(c, t)));
    if (!scelto) {
      // Nessuna corrispondenza e nessun verbo di proposta: quello che ha scritto non è un alimento,
      // è un'esitazione («boh», «mah»). Si torna indietro e ci pensa il «non ho capito» — mandare
      // alla nutrizionista una richiesta che non è mai stata fatta è peggio che non capire.
      if (!esplicita) return null;
      await this.passaAllaNutrizionista(
        clientId,
        `Cambio in chat: la cliente propone lei un sostituto per «${proposta.da}» ` +
          `(${etichettaSlot(proposta.slot)}: ${proposta.piatto}) che non è fra gli equivalenti approvati. ` +
          `Ha scritto: «${testoCliente.trim().slice(0, 200)}». Serve una valutazione.`,
      );
      await this.audit.log({
        action: 'menu.sostituzione.controproposta_non_prevista',
        actorId: clientId,
        entityType: 'client_profile',
        entityId: clientId,
        metadata: { da: proposta.da, termini, slot: proposta.slot },
      });
      return {
        testo: testoContropropostaNonPrevista(proposta.da, nome),
        inoltraA: 'nutritionist',
        esito: 'arresa',
      };
    }

    const esito = await this.verificaCandidato(clientId, proposta.da, scelto);
    if (esito !== 'ok') {
      // Rifiutata, ma non a mani vuote: si dice **perché** e si propone subito un'alternativa, con
      // il suo alimento aggiunto agli scartati perché non lo riproponga il giro dopo.
      const spiegazione =
        esito === 'allergene'
          ? testoContropropostaAllergene(scelto, nome)
          : esito === 'stesso_alimento'
            ? testoContropropostaStessoAlimento(proposta.da, scelto, nome)
            : testoContropropostaEsclusa(scelto, nome);
      const dopo = await this.altroSostituto(clientId, {
        ...stato,
        scartati: [...(stato.scartati ?? []), scelto],
      });
      return { ...dopo, testo: `${spiegazione}\n\n${dopo.testo}` };
    }

    const motivo = MOTIVI.find((m) => m.key === stato.motivo) ?? MOTIVI.find((m) => m.key === 'non_piace')!;
    const nuova: PropostaSostituzione = {
      ...proposta,
      a: scelto,
      // L'unità va ricalcolata sul suo alimento: «70 ml di burro» non esiste (vedi `unitaPerSostituto`).
      unitaA: unitaPerSostituto(proposta.unita, scelto),
    };
    await this.audit.log({
      action: 'menu.sostituzione.controproposta',
      actorId: clientId,
      entityType: 'client_profile',
      entityId: clientId,
      metadata: { da: proposta.da, nostro: proposta.a, suo: scelto, slot: proposta.slot },
    });
    return {
      testo: testoContropropostaOk(nuova, motivo, nome),
      stato: {
        ...stato,
        passo: 'conferma',
        proposta: nuova,
        // Il nostro suggerimento risulta scartato: se poi dice no a questo, non deve tornare quello.
        scartati: [...(stato.scartati ?? []), proposta.a],
        tentativi: 0,
      },
      esito: 'in_corso',
    };
  }

  /**
   * Un sostituto **specifico** è ammissibile per questa cliente? Serve alla controproposta, dove
   * l'alimento lo sceglie lei e non c'è niente da ordinare: `scegliSostituto` sceglie il migliore
   * fra tanti, questo dice sì o no su uno — e dice anche **perché** no, che è la parte che la
   * cliente legge.
   */
  private async verificaCandidato(
    clientId: string,
    nomeIngrediente: string,
    candidato: string,
  ): Promise<'ok' | 'allergene' | 'escluso' | 'stesso_alimento'> {
    const profilo = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { allergies: true, intolerances: true, dislikedFoods: true },
    });
    const testo = normalizza(candidato);
    const allergeni = exclusionKeys((profilo?.allergies ?? []) as string[]);
    if (hitsExclusion(testo, allergeni)) return 'allergene';
    const altre = exclusionKeys([
      ...((profilo?.intolerances ?? []) as string[]),
      ...((profilo?.dislikedFoods ?? []) as string[]),
    ]);
    if (hitsExclusion(testo, altre)) return 'escluso';
    // Una variante dello stesso cibo non è un sostituto: vedi `condividonoAlimento`.
    if (condividonoAlimento(nomeIngrediente, candidato)) return 'stesso_alimento';
    return 'ok';
  }

  /**
   * Secondo giro: il sostituto proposto è stato rifiutato, se ne cerca un altro con le stesse
   * regole di sicurezza. Il motivo del cambio resta quello di prima — non è cambiato il perché,
   * è cambiata solo l'alternativa — quindi si torna direttamente alla conferma.
   */
  private async altroSostituto(clientId: string, stato: StatoSostituzione): Promise<EsitoSostituzione> {
    const proposta = stato.proposta;
    if (!proposta) return this.apri(clientId);
    const nome = await this.nomeDi(clientId);
    const scartati = [...(stato.scartati ?? []), proposta.a];

    const pasti = await this.pastiDelGiorno(clientId, proposta.data);
    const pasto = pasti.find((p) => p.pasto.slot === proposta.slot);
    const ingrediente = pasto?.ingredienti.find((i) => i?.name && combaciaAlimento(i.name, proposta.da));
    // Il menu è cambiato sotto i piedi (rigenerato, o un altro cambio applicato nel frattempo):
    // meglio ricominciare da capo che scrivere su una giornata che non è più quella.
    if (!pasto || !ingrediente) return this.apri(clientId, proposta.data);

    const scelta = await this.scegliSostituto(proposta.da, proposta.da, pasto.dietId, clientId, scartati);
    if (!scelta.ok) {
      await this.passaAllaNutrizionista(
        clientId,
        `Cambio in chat: la cliente ha rifiutato ${scartati.map((s) => `«${s}»`).join(', ')} come sostituto di «${proposta.da}» ` +
          `(${etichettaSlot(proposta.slot)}: ${proposta.piatto}) e non restano alternative sicure. Serve una scelta della nutrizionista.`,
      );
      return {
        testo:
          scelta.perche === 'allergene'
            ? testoAllergene(proposta.da)
            : testoNienteAltroSostituto(proposta.da, scartati, nome),
        inoltraA: 'nutritionist',
        esito: 'rifiutata',
      };
    }

    const motivo = MOTIVI.find((m) => m.key === stato.motivo) ?? MOTIVI.find((m) => m.key === 'non_piace')!;
    const nuova: PropostaSostituzione = { ...proposta, a: scelta.sostituto };
    await this.audit.log({
      action: 'menu.sostituzione.altro_sostituto',
      actorId: clientId,
      entityType: 'client_profile',
      entityId: clientId,
      metadata: { da: proposta.da, rifiutati: scartati, nuovo: scelta.sostituto, slot: proposta.slot },
    });
    return {
      testo: testoAltroSostituto(nuova, motivo, proposta.a, nome),
      stato: { ...stato, passo: 'conferma', proposta: nuova, scartati, tentativi: 0 },
      esito: 'in_corso',
    };
  }

  // ---------- Proposta ----------

  /** Dal cibo riconosciuto alla proposta concreta (sostituto + grammi), con le due protezioni. */
  private async proponi(
    clientId: string,
    trovato: { pasto: PastoConRicetta; ingrediente: IngredienteRicetta; termine: string },
    giorno?: string,
  ): Promise<EsitoSostituzione> {
    const nomeIngrediente = (trovato.ingrediente.name ?? trovato.termine).trim();

    // Cancello delle spezie: una spezia esclusa cancella dal ricettario ogni piatto che la
    // contiene, ed è così che una cliente si è ritrovata lo stesso pranzo per quattro giorni.
    // La regola della nutrizionista è di non registrarle e di spiegare perché.
    //
    // Si interroga su ENTRAMBI i nomi — quello scritto dalla cliente e quello dell'ingrediente
    // trovato — e non solo sul secondo: se l'abbinamento sbaglia, chiedendo solo del nome
    // trovato il cancello non scatta. È così che «il pepe» finiva per far sostituire i
    // peperoni. L'abbinamento ora è per parola e non dovrebbe più sbagliare, ma su questo si
    // fanno due controlli, non uno.
    for (const candidato of [trovato.termine, nomeIngrediente]) {
      const spezia = classificaSpezia(candidato);
      if (spezia.tipo === 'nessuna') continue;
      await this.audit.log({
        action: 'menu.spezia.rifiutata',
        actorId: clientId,
        entityType: 'client_profile',
        entityId: clientId,
        metadata: { termine: candidato, tipo: spezia.tipo, origine: 'chat' },
      });
      return { testo: spezia.testo, esito: 'rifiutata' };
    }

    const scelta = await this.scegliSostituto(nomeIngrediente, trovato.termine, trovato.pasto.dietId, clientId);
    if (!scelta.ok) {
      const motivoTesto =
        scelta.perche === 'nessun_candidato'
          ? `Cambio piatto in chat: nessun sostituto sicuro per «${nomeIngrediente}» (${etichettaSlot(trovato.pasto.pasto.slot)}: ${trovato.pasto.nome}).`
          : scelta.perche === 'allergene'
            ? `Cambio piatto in chat: gli unici sostituti per «${nomeIngrediente}» toccano un allergene dichiarato. Serve una decisione clinica.`
            : `Cambio piatto in chat: nessun sostituto compatibile con le esclusioni della cliente per «${nomeIngrediente}».`;
      await this.passaAllaNutrizionista(clientId, motivoTesto);
      return {
        testo: scelta.perche === 'allergene' ? testoAllergene(nomeIngrediente) : testoNessunSostituto(nomeIngrediente),
        inoltraA: 'nutritionist',
        esito: 'rifiutata',
      };
    }
    const sostituto = scelta.sostituto;

    const qtaDa = typeof trovato.ingrediente.qty === 'number' ? trovato.ingrediente.qty : undefined;
    // `correggiGrammatura` è già qui, e per ora è inerte: proponiamo pari grammatura, quindi
    // non c'è niente da correggere. Ci sarà quando i grammi li dirà Gaia (punto 3): meglio il
    // controllo in posizione e senza effetto che da aggiungere il giorno in cui serve.
    const { qta: qtaA, corretta } = correggiGrammatura(qtaDa, undefined);

    const proposta: PropostaSostituzione = {
      // La giornata di cui si sta parlando, non «oggi» per definizione (§16.2). Da qui in poi è
      // questa la data autorevole: `applica` la rilegge invece di ricalcolarsi il giorno.
      data: giorno ?? this.oggiIso(),
      slot: trovato.pasto.pasto.slot,
      recipeId: trovato.pasto.pasto.recipeId,
      piatto: trovato.pasto.nome,
      da: nomeIngrediente,
      a: sostituto,
      qtaDa,
      qtaA,
      // Non l'unità dell'ingrediente di partenza: «70 ml di burro» non esiste. Vedi
      // `unitaPerSostituto`.
      unita: trovato.ingrediente.unit,
      unitaA: unitaPerSostituto(trovato.ingrediente.unit, sostituto),
      grammaturaCorretta: corretta,
      /**
       * ⚠️ IL FATTORE DEL PIATTO SUO — perché Gaia dica la grammatura che deve mettere nel piatto e
       * non quella di catalogo (19/8, decisione di Simone). ⚠️ `qtaDa`/`qtaA` restano di catalogo:
       * sono i numeri che finiscono nella sostituzione scritta sul menu, e il piatto viene scalato
       * al momento di mostrarlo — salvarli già scalati vorrebbe dire scalarli due volte.
       */
      fattore: fattoreDaDire(trovato.pasto.pasto.porzione),
    };
    return {
      testo: testoChiediMotivo(proposta),
      // ⚠️ `data` va ricopiata nello stato, non solo dentro la proposta: `avanza` ricalcola la
      // giornata a ogni messaggio partendo da `stato.data`, e senza questa riga un «1» al passo
      // del motivo riporterebbe a oggi una conversazione che parlava di domani.
      stato: { passo: 'motivo', cibo: nomeIngrediente, proposta, tentativi: 0, data: proposta.data },
      esito: 'in_corso',
    };
  }

  /**
   * Il sostituto da proporre, con tutti i filtri di sicurezza. Estratta da `proponi` perché la usa
   * anche il secondo giro, quando la cliente ha detto «no, non voglio il burro»: le regole devono
   * essere le stesse — un allergene non diventa accettabile perché è la seconda proposta.
   *
   * `escludi` sono i sostituti già rifiutati in questa conversazione.
   */
  private async scegliSostituto(
    nomeIngrediente: string,
    termine: string,
    dietId: string | null,
    clientId: string,
    escludi: string[] = [],
  ): Promise<{ ok: true; sostituto: string } | { ok: false; perche: 'nessun_candidato' | 'allergene' | 'incompatibile' }> {
    const profilo = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { allergies: true, intolerances: true, dislikedFoods: true },
    });
    const allergeni = exclusionKeys((profilo?.allergies ?? []) as string[]);
    const altreEsclusioni = exclusionKeys([
      ...((profilo?.intolerances ?? []) as string[]),
      ...((profilo?.dislikedFoods ?? []) as string[]),
    ]);

    const candidati = await this.candidati(nomeIngrediente, termine, dietId);
    if (!candidati.length) return { ok: false, perche: 'nessun_candidato' };

    // Allergeni: se il sostituto contiene un allergene dichiarato, il cambio si rifiuta e
    // basta. Su questo non si media, e non è una questione di grammi.
    const ammessi: string[] = [];
    let scartatoPerAllergene = false;
    for (const { nome: c, fonte } of candidati) {
      const testo = normalizza(c);
      if (hitsExclusion(testo, allergeni)) {
        scartatoPerAllergene = true;
        continue;
      }
      if (hitsExclusion(testo, altreEsclusioni)) continue;
      /**
       * IL FILTRO «È LA STESSA COSA» VALE SOLO PER LA MAPPA, NON PER I GRUPPI.
       *
       * Segnalazione di Simone dell'11/8: «se nella tabella alternative ho la pasta integrale, perché
       * Gaia alla cliente dice che non la ha?». La nutrizionista aveva scritto il gruppo «Pasta
       * integrale» con dentro pasta di ceci, di farro, di legumi, d'orzo — e Gaia rispondeva «non ho
       * un'alternativa che mi convinca» girando la richiesta a lei.
       *
       * La causa: `condividonoAlimento` scarta i candidati che condividono una parola con il cibo di
       * partenza. Nasce per la MAPPA delle sostituzioni sicure, dove «yogurt» → «yogurt senza
       * lattosio» è una variante e non un sostituto. Ma un gruppo di equivalenza è costruito, per sua
       * natura, intorno a una parola comune: **ogni** membro di «Pasta integrale» contiene «pasta»,
       * quindi il filtro azzerava l'intero gruppo. Il commento di `condividonoAlimento` diceva che la
       * soluzione era «un gruppo di equivalenza che il nutrizionista deve ancora scrivere»: lo ha
       * scritto, e il codice lo buttava via.
       *
       * Un gruppo approvato è il **giudizio di una professionista** su cosa equivale a cosa. Vale più
       * di un'euristica sulle parole condivise, e la variante identica è già stata scartata in
       * `candidati` (`combaciaAlimento(i, nomeIngrediente)` toglie «pasta integrale di grano» quando si
       * chiede di cambiare «pasta integrale»).
       */
      if (fonte === 'mappa' && condividonoAlimento(nomeIngrediente, c)) continue;
      /**
       * ⚠️ E IL CIBO CHE HA NOMINATO LEI NON TORNA MAI INDIETRO — caso Jolanda, 17/8.
       *
       * Ha scritto «sostituisci a pranzo i ceci» e si è sentita proporre «200 g di ceci secchi al
       * posto di 200 g di ceci cotti in scatola». Le due reti sopra non l'hanno fermata: quella di
       * `candidati` chiede che **ogni** parola combaci, e «secchi» non sta in «cotti in scatola»,
       * quindi «ceci secchi» non era «sé stesso»; e il filtro delle parole condivise ormai vale
       * solo per la mappa, perché sui gruppi azzerava l'intero gruppo (il tuo «Pasta integrale»
       * dell'11/8).
       *
       * Il confronto giusto non è col nome dell'ingrediente in ricetta, che porta con sé la
       * preparazione: è con **la parola che ha scritto lei**. Ha detto «ceci» → il sostituto non
       * può essere un cece. E la correzione dell'11/8 resta intatta, perché lì aveva scritto
       * «pasta integrale» e «pasta di ceci» non la combacia — «integrale» non c'è dentro.
       *
       * Vale per i gruppi come per la mappa: qui non stiamo dubitando del giudizio della
       * nutrizionista su cosa equivale a cosa, stiamo solo evitando di restituirle in tavola la
       * stessa cosa che ha chiesto di togliere. Se dopo questo non resta niente, Gaia dice che non
       * ha un'alternativa e passa alla coach — che fra i due errori possibili è quello giusto.
       */
      if (termine && combaciaAlimento(c, termine)) continue;
      // Già rifiutato a voce dalla cliente: riproporlo è il modo più rapido di perderne la
      // fiducia. Il confronto è per parola, come tutto il resto: «burro» esclude «burro salato».
      if (escludi.some((x) => x && (combaciaAlimento(c, x) || combaciaAlimento(x, c)))) continue;
      ammessi.push(c);
    }
    if (!ammessi.length) {
      return { ok: false, perche: scartatoPerAllergene ? 'allergene' : 'incompatibile' };
    }

    // Deterministico: a parità di idoneità vince l'ordine alfabetico, così due clienti con lo
    // stesso profilo ricevono la stessa proposta e il risultato è riproducibile nei test.
    ammessi.sort((a, b) => a.localeCompare(b));
    return { ok: true, sostituto: ammessi[0] };
  }

  /**
   * Sostituti possibili, in ordine di autorevolezza:
   * 1. i **gruppi di equivalenza approvati** dal nutrizionista (è la sua materia prima, e
   *    finora il motore non li leggeva: qui cominciano a servire a qualcosa);
   * 2. la mappa delle sostituzioni sicure, condivisa col motore.
   *
   * I gruppi si filtrano per PRODOTTO: `EquivalenceGroup.productId` è il `Diet.id` e `null`
   * vuol dire globale. Senza quel filtro un gruppo scritto per la dieta vegana — «tofu, tempeh,
   * seitan» — finirebbe addosso a una cliente onnivora, che chiederebbe di cambiare il tofu e
   * si vedrebbe proporre il seitan: glutine, per una scelta che nessuno aveva fatto per lei.
   */
  private async candidati(
    nomeIngrediente: string,
    termine: string,
    dietId: string | null,
  ): Promise<Candidato[]> {
    const gruppi = (await this.prisma.equivalenceGroup.findMany({
      where: { status: 'approved', OR: [{ productId: null }, ...(dietId ? [{ productId: dietId }] : [])] },
      orderBy: { name: 'asc' },
      take: 200,
    })) as { members: unknown; productId: string | null }[];

    const dalGruppo: string[] = [];
    for (const g of gruppi) {
      const items = (((g.members as { items?: string[] })?.items ?? []) as string[]).filter(Boolean);
      // Il gruppo riguarda questo alimento? Confronto per parola, come tutto il resto.
      if (!items.some((i) => combaciaAlimento(i, nomeIngrediente) || combaciaAlimento(i, termine))) continue;
      for (const i of items) {
        if (combaciaAlimento(i, nomeIngrediente)) continue; // sé stesso
        dalGruppo.push(i.trim());
      }
    }
    if (dalGruppo.length) return [...new Set(dalGruppo)].map((nome) => ({ nome, fonte: 'gruppo' as const }));

    const sicuro = sostitutoSicuro(nomeIngrediente, termine);
    return sicuro ? [{ nome: sicuro, fonte: 'mappa' as const }] : [];
  }

  // ---------- Applicazione ----------

  /**
   * Scrive la sostituzione sulla giornata. `oggi` tocca solo il menu di oggi; `sempre` tocca
   * anche i giorni futuri già erogati e aggiunge l'alimento ai cibi non graditi del profilo —
   * l'unico caso in cui è giusto restringere il pool di tutti i menu futuri, perché è il solo
   * in cui la cliente ha detto qualcosa sui suoi gusti.
   */
  private async applica(
    clientId: string,
    proposta: PropostaSostituzione,
    motivo: Motivo,
  ): Promise<EsitoSostituzione> {
    const oggi = toDateOnly();
    const oggiIso = this.oggiIso();
    /**
     * §16.2 — su quali giornate si scrive.
     *
     * `oggi` (non ce l'ho in casa, mi resta sullo stomaco, non ho tempo) vale su **la giornata di
     * cui si sta parlando**: se la conversazione è partita da domani, è domani che va corretto.
     *
     * ⚠️ `sempre` («non mi piace») parte invece **da oggi**, anche se si stava parlando di giovedì:
     * un cibo che non piace non piace nemmeno stasera, e lasciarglielo nel piatto perché la frase
     * era partita da un altro giorno sarebbe assurdo. Vale per il pool dei menu futuri, non per
     * quella giornata.
     */
    const giornoIso = motivo.durata === 'oggi' ? proposta.data || oggiIso : oggiIso;
    const daQuando = toDateOnly(giornoIso);
    const giorni = await this.prisma.menuDay.findMany({
      where: { clientId, date: motivo.durata === 'oggi' ? daQuando : { gte: daQuando } },
      orderBy: { date: 'asc' },
      take: motivo.durata === 'oggi' ? 1 : 30,
    });
    const quando = etichettaGiorno(giornoIso, oggiIso);
    let pastiToccati = 0;
    let giorniToccati = 0;
    let giaPresenti = 0;
    // La PRIMA sostituzione scritta davvero, per la tabella §16.9: porta il nome dell'ingrediente
    // com'è nella RICETTA e la grammatura vera, che la proposta non sempre ha.
    // Un oggetto e non un `let … | null`: viene valorizzato dentro una callback, e TypeScript non
    // segue quel percorso — con una variabile la restringerebbe a `null` e leggerla darebbe `never`.
    const scritta: { sost?: Substitution; dietId?: string | null } = {};

    for (const giorno of giorni) {
      const pasti = ((giorno.meals as unknown as MealSnapshot[]) ?? []).map((m) => ({ ...m }));
      const ricette = await this.ricetteDi(pasti);
      // «È la giornata di cui stiamo parlando», che con `sempre` non coincide più con oggi.
      const eIlGiornoDetto = giorno.date.toISOString().slice(0, 10) === (proposta.data || oggiIso);
      let toccato = false;

      const aggiornati = pasti.map((pasto) => {
        // OGGI si tocca SOLO il pasto su cui la cliente ha detto sì: la conferma che ha letto
        // nominava un pasto, uno solo. Prima il ciclo scriveva su ogni pasto della giornata che
        // contenesse quell'ingrediente, quindi un cambio concordato sulla pasta del pranzo
        // riscriveva anche la pasta sfoglia della cena — un piatto di cui non si era parlato.
        if (eIlGiornoDetto && (pasto.slot !== proposta.slot || pasto.recipeId !== proposta.recipeId)) return pasto;
        const ricetta = ricette.get(pasto.recipeId);
        if (!ricetta) return pasto;

        // Già scritta: la cliente ha riconfermato lo stesso cambio. Si guarda PRIMA di cercare
        // l'ingrediente, perché dopo il primo passaggio l'ingrediente effettivo è già il
        // sostituto — «carote» non c'è più, ci sono le «biete» — e cercandolo si concluderebbe
        // che il menu è cambiato sotto i piedi. Che è vero, ma è cambiato per opera nostra.
        const esistenti = pasto.substitutions ?? [];
        if (
          esistenti.some(
            (s) => s.origine === 'chat' && combaciaAlimento(s.from, proposta.da) && normalizza(s.to) === normalizza(proposta.a),
          )
        ) {
          giaPresenti += 1;
          return pasto;
        }

        const ingrediente = ingredientiEffettivi(ricetta.ingredienti, pasto).find(
          (i) => !!i?.name && combaciaAlimento(i.name, proposta.da),
        );
        if (!ingrediente) return pasto;

        const qtaDa = typeof ingrediente.qty === 'number' ? ingrediente.qty : undefined;
        const { qta: qtaA, corretta } = correggiGrammatura(qtaDa, undefined);
        const sostituzione: Substitution = {
          from: (ingrediente.name ?? proposta.da).trim(),
          to: proposta.a,
          reason: motivo.label,
          fromQty: qtaDa,
          toQty: qtaA,
          unit: ingrediente.unit,
          // L'unità del sostituto può non essere quella di partenza: vedi `unitaPerSostituto`.
          unitA: unitaPerSostituto(ingrediente.unit, proposta.a),
          origine: 'chat',
          motivo: motivo.key,
          // Ogni cambio nasce «da verificare» finché il nutrizionista non lo guarda: è quello
          // che rende la verifica una cosa che si può fare davvero.
          stato: 'da_verificare',
          concordataIl: new Date().toISOString(),
          grammaturaCorretta: corretta || undefined,
        };
        toccato = true;
        pastiToccati += 1;
        if (!scritta.sost) {
          scritta.sost = sostituzione;
          scritta.dietId = giorno.dietId ?? null;
        }
        return { ...pasto, substitutions: [...esistenti, sostituzione] };
      });

      if (toccato) {
        await this.prisma.menuDay.update({
          where: { id: giorno.id },
          data: { meals: aggiornati as never },
        });
        giorniToccati += 1;
      }
    }

    if (motivo.gusto) await this.aggiungiAiNonGraditi(clientId, proposta.da);
    if (motivo.clinico) {
      await this.passaAllaNutrizionista(
        clientId,
        `Cambio piatto in chat: la cliente dice che «${proposta.da}» le resta sullo stomaco (${etichettaSlot(proposta.slot)}: ${proposta.piatto}). Non è un gusto: va valutato.`,
        'clinical',
      );
    }

    await this.audit.log({
      action: 'menu.sostituzione_chat',
      actorId: clientId,
      entityType: 'menu_day',
      metadata: {
        da: proposta.da,
        a: proposta.a,
        motivo: motivo.key,
        durata: motivo.durata,
        slot: proposta.slot,
        piatto: proposta.piatto,
        qtaDa: proposta.qtaDa,
        qtaA: proposta.qtaA,
        unita: proposta.unita,
        giorni: giorniToccati,
        pasti: pastiToccati,
        giaPresenti,
      },
    });

    if (!pastiToccati) {
      // Due «non ho scritto niente» molto diversi, e dirle quello sbagliato è peggio che tacere.
      if (giaPresenti) return { testo: testoGiaFatto(proposta), esito: 'applicata' };
      // Il menu è cambiato sotto i piedi fra la proposta e la conferma (rigenerazione,
      // cambio dieta): meglio dirlo che dichiarare un successo che non c'è stato.
      return {
        testo: `Nel frattempo il menu di ${quando} è cambiato e «${proposta.da}» non c'è più: non ho toccato niente. Se lo vedi ancora, riprova. 💚`,
        esito: 'rifiutata',
      };
    }

    // §16.9 — la memoria. Il cambio è già scritto sul menu: questa riga serve a farlo IMPARARE
    // (quante volte, a quante clienti, su quali piatti), e non deve poter rompere niente — vedi il
    // riquadro in `registra-sostituzione.ts`, che non lancia mai.
    await registraSostituzione(this.prisma, {
      clientId,
      tipo: 'ingrediente',
      // Il nome dell'ingrediente com'è nella RICETTA, non come l'ha scritto la cliente: «pollo»
      // digitato in chat qui diventa «petto di pollo», che è la cosa che serve a un nutrizionista.
      from: scritta.sost?.from ?? proposta.da,
      to: proposta.a,
      recipeId: proposta.recipeId,
      dishName: proposta.piatto,
      mealSlot: proposta.slot,
      fromQty: scritta.sost?.fromQty ?? proposta.qtaDa ?? null,
      toQty: scritta.sost?.toQty ?? proposta.qtaA ?? null,
      unit: scritta.sost?.unit ?? proposta.unita ?? null,
      motivo: motivo.key,
      dietId: scritta.dietId ?? null,
      origine: 'chat',
    });

    await this.avvisaDellaVerifica(
      clientId,
      `ha cambiato «${proposta.da}» con «${proposta.a}» (${etichettaSlot(proposta.slot)}: ${proposta.piatto})`,
      { da: proposta.da, a: proposta.a, slot: proposta.slot, motivo: motivo.key, giorni: giorniToccati },
    );

    return {
      // L'invito a riflettere va IN CODA alla conferma, mai al posto: il cambio glielo abbiamo
      // fatto, e un invito che sostituisce la risposta è un ricatto gentile.
      testo: testoFatto(proposta, motivo, await this.nomeDi(clientId), quando) + (await this.invitoARiflettere(clientId)),
      esito: 'applicata',
      applicata: { giorni: giorniToccati, da: proposta.da, a: proposta.a, motivo: motivo.key, pasti: pastiToccati },
    };
  }

  /**
   * L'AVVISO ALLA NUTRIZIONISTA di un cambio nuovo da verificare (richiesta di Simone dell'11/8:
   * «quando si creano sostituzioni nuove o equivalenze nuove mandiamo una notifica al nutrizionista»).
   *
   * Ogni cambio nasce `da_verificare`, e fino a oggi quella coda si riempiva **in silenzio**: si
   * scopriva aprendo la scheda della cliente di propria iniziativa. Un cambio concordato con Gaia e
   * mai verificato non è in attesa: è già nel piatto, approvato da nessuno.
   *
   * Non fa mai fallire il cambio: il menu di domani è già scritto quando si arriva qui, e un avviso
   * che non parte non deve annullare il lavoro. Se alla cliente non è assegnata una nutrizionista
   * l'avviso va al capo — vedi `common/avvisa-nutrizionista.ts`.
   */
  /**
   * L'invito a riflettere, quando i cambi diventano quotidiani (§ richiesta di Simone del 12/8).
   *
   * Ritorna il testo da APPENDERE alla conferma, o stringa vuota. Non blocca niente e non lancia
   * mai: il cambio è già scritto sul menu, e un invito che non parte non deve poter togliere alla
   * cliente la risposta che aspettava.
   *
   * ⚠️ La finestra si ferma a OGGI, e non è pigrizia. Un cambio con motivo «non mi piace» scrive su
   * trenta giornate future in un colpo solo: contando anche il futuro, UNA richiesta farebbe
   * risultare trenta giorni diversi con un cambio, e l'invito partirebbe alla prima cliente che
   * dice «questo non mi piace». Le giornate future si conteranno da sé quando saranno passate.
   */
  private async invitoARiflettere(clientId: string): Promise<string> {
    try {
      const oggi = toDateOnly();
      const dal = new Date(oggi);
      dal.setDate(dal.getDate() - (FINESTRA_GIORNI - 1));
      const giornate = (await this.prisma.menuDay.findMany({
        where: { clientId, date: { gte: dal, lte: oggi } },
        select: { date: true, meals: true },
      })) as { date: Date; meals: unknown }[];

      const giorni = giorniConCambioDellaCliente(giornate);
      const soglia = await this.configParams
        .getNumber('cambi_soglia_giorni', SOGLIA_GIORNI_DEFAULT)
        .catch(() => SOGLIA_GIORNI_DEFAULT);
      if (giorni < (soglia || SOGLIA_GIORNI_DEFAULT)) return '';

      /**
       * Non più di uno ogni due settimane, e il marcatore è **l'avviso alla coach**: le due cose
       * partono insieme di proposito, così la cliente sente «parlane con la tua coach» esattamente
       * quando la coach lo sa. Un contatore separato sarebbe una terza verità da tenere allineata.
       */
      const dalloUltimo = new Date();
      dalloUltimo.setDate(dalloUltimo.getDate() - PAUSA_FRA_INVITI_GIORNI);
      const gia = await this.prisma.notification.findFirst({
        where: {
          type: 'cambi_frequenti',
          scheduledFor: { gte: dalloUltimo },
          payload: { path: ['clientId'], equals: clientId },
        } as never,
        select: { id: true },
      });
      if (gia) return '';

      const nome = await this.nomeDi(clientId);
      await avvisaCoachDellaCliente(this.prisma, null, clientId, {
        type: 'cambi_frequenti',
        title: 'Cambia il menu quasi ogni giorno',
        body: testoAvvisoCoach(nome ?? 'Una cliente', giorni),
        payload: { kind: 'cambi_frequenti', giorniConCambio: giorni },
      });
      return testoInvitoARiflettere(nome, giorni);
    } catch (err) {
      this.logger.warn(`Invito a riflettere non valutato per ${clientId}: ${err instanceof Error ? err.message : String(err)}`);
      return '';
    }
  }

  private async avvisaDellaVerifica(
    clientId: string,
    cosa: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const nome = (await this.nomeDi(clientId)) ?? 'Una cliente';
    // `null` come notificatore: qui `NotificationsService` non è raggiungibile (anello di moduli
    // Notifications → Menu → Notifications), quindi la notifica si scrive in tabella. Vedi il
    // commento in testa a `avvisa-nutrizionista.ts`.
    await avvisaNutrizionistaDellaCliente(this.prisma, null, clientId, {
      type: 'menu_cambio_da_verificare',
      title: 'Cambio in chat da verificare',
      body: `${nome} ${cosa}. Da verificare nella sua scheda.`,
      payload: { kind: 'menu_cambio_da_verificare', ...payload },
    });
  }

  private async aggiungiAiNonGraditi(clientId: string, alimento: string): Promise<void> {
    const profilo = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { dislikedFoods: true },
    });
    const attuali = ((profilo?.dislikedFoods ?? []) as string[]);
    if (attuali.some((s) => normalizza(s) === normalizza(alimento))) return;
    await this.prisma.clientProfile.update({
      where: { userId: clientId },
      data: { dislikedFoods: [...attuali, alimento] },
    });
  }

  private async passaAllaNutrizionista(
    clientId: string,
    motivo: string,
    categoria: 'clinical' | 'other' = 'other',
  ): Promise<void> {
    try {
      // `apriSegnalazione` e non una create diretta: se sulla cliente non c'è nessuna
      // nutrizionista, la manda al capo nutrizionista invece di lasciarla lì.
      const segnalazione = await apriSegnalazione(this.prisma as never, {
        clientId,
        category: categoria,
        source: 'coach',
        reason: motivo,
        dedupe: true,
      });

      /**
       * ⚠️ E LA STESSA COSA ARRIVA ANCHE ALL'ASSISTENTE (Simone, 14/8): «anche queste notifiche
       * devono arrivare attraverso l'assistente, poi le lasciamo anche lì, ma da una parte o
       * dall'altra il nutrizionista risponde».
       *
       * La segnalazione resta dov'è: qui si AGGIUNGE una porta. La chiave `gaia:<escalationId>` è
       * l'idempotenza e insieme il legame con la segnalazione — così rispondere da Vera la chiude,
       * e chiuderla dalla pagina toglie la domanda da Vera, senza una colonna nuova.
       *
       * Non lancia mai (la cliente ha già avuto la sua risposta da Gaia) ma l'errore si scrive:
       * una coda che smette di riempirsi in silenzio è peggio di una coda vuota.
       */
      if (segnalazione?.id) {
        await apriRichiestaVera(this.prisma, {
          tipo: 'girata_da_gaia',
          clienteId: clientId,
          testo: motivo,
          origine: 'chat-gaia',
          chiave: `${CHIAVE_GAIA}${segnalazione.id}`,
        });
      }
    } catch (err) {
      this.logger.error('Segnalazione da cambio piatto in chat non aperta', err instanceof Error ? err.stack : String(err));
    }
  }

  // ---------- Lettura del giorno ----------

  private async ricetteDi(
    pasti: MealSnapshot[],
  ): Promise<Map<string, { nome: string; ingredienti: IngredienteRicetta[] }>> {
    const ids = [...new Set(pasti.map((m) => m.recipeId).filter(Boolean))];
    if (!ids.length) return new Map();
    const ricette = (await this.prisma.recipe.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, ingredients: true },
    })) as { id: string; name: string; ingredients: unknown }[];
    return new Map(
      ricette.map((r) => [
        r.id,
        { nome: r.name, ingredienti: ((r.ingredients as IngredienteRicetta[]) ?? []).filter(Boolean) },
      ]),
    );
  }

  /** La data di oggi come `YYYY-MM-DD`, nel fuso dell'app. Un posto solo, per non sbagliarla. */
  private oggiIso(): string {
    return toDateOnly().toISOString().slice(0, 10);
  }

  /**
   * I pasti di UNA giornata con la ricetta risolta (§16.2). Vuoto se quel giorno non c'è, o se la
   * cliente non lo può vedere.
   *
   * ⚠️ Due filtri, e non sono decorativi. `date >= oggi`: un menu di ieri è già stato mangiato, e
   * correggerlo non vuol dire niente. `visibleFrom <= oggi`: è la stessa regola con cui l'app
   * decide cosa mostrarle (`menu.service.getMenu`) — Simone l'ha detta esattamente così, «anche il
   * menu di domani o dopodomani **se lo vedo**». Senza questo filtro Gaia correggerebbe una
   * giornata che per la cliente ancora non esiste.
   */
  private async pastiDelGiorno(clientId: string, dataIso?: string | null): Promise<PastoConRicetta[]> {
    const oggi = toDateOnly();
    const data = dataIso ? toDateOnly(dataIso) : oggi;
    if (data.getTime() < oggi.getTime()) return [];
    const giorno = await this.prisma.menuDay.findFirst({
      where: { clientId, date: data, visibleFrom: { lte: oggi } } as never,
    });
    if (!giorno) return [];
    const pasti = ((giorno.meals as unknown as MealSnapshot[]) ?? []).filter(Boolean);
    const ricette = await this.ricetteDi(pasti);
    return pasti.map((pasto) => {
      const r = ricette.get(pasto.recipeId);
      return {
        pasto,
        nome: r?.nome ?? pasto.name ?? '?',
        // Gli ingredienti che ha DAVANTI, non quelli del catalogo: le sostituzioni già
        // concordate sono parte del piatto di oggi.
        ingredienti: ingredientiEffettivi(r?.ingredienti ?? [], pasto),
        dietId: giorno.dietId ?? null,
      };
    });
  }

  /**
   * L'alimento indicato dalla cliente, cercato fra gli ingredienti VERI del menu di oggi.
   * L'abbinamento su dati reali, e non su una regex, è quello che garantisce che il cambio
   * riguardi qualcosa che ha davvero nel piatto.
   */
  private trovaIngrediente(
    pasti: PastoConRicetta[],
    testoCliente: string,
  ): { pasto: PastoConRicetta; ingrediente: IngredienteRicetta; termine: string } | null {
    const termini = terminiCandidati(testoCliente);
    for (const termine of termini) {
      for (const p of pasti) {
        for (const ing of p.ingredienti) {
          // `combaciaAlimento` e non `includes`: vedi il commento su quella funzione — è la
          // differenza fra riconoscere «le carote» e sostituire i peperoni a chi ha scritto «pepe».
          if (ing?.name && combaciaAlimento(ing.name, termine)) {
            return { pasto: p, ingrediente: ing, termine };
          }
        }
      }
    }
    return null;
  }

  /** Vero se ha scritto il nome del piatto invece dell'alimento. */
  private trovaPiatto(pasti: PastoConRicetta[], testoCliente: string): PastoConRicetta | null {
    const termini = terminiCandidati(testoCliente);
    for (const termine of termini) {
      for (const p of pasti) {
        if (normalizza(p.nome).includes(termine)) return p;
      }
    }
    return null;
  }

  // ---------- Lettura per il backoffice ----------

  /**
   * I cambi nati in chat sulle giornate recenti e future: è l'elenco «da verificare» della
   * scheda cliente. Senza questo, verificare vorrebbe dire rileggere tutte le conversazioni.
   */

  // ---------- Cambiare il PIATTO (non l'ingrediente) ----------

  /**
   * Le alternative possibili per uno slot: **solo** dalla base personale certificata della cliente
   * (`client_menu_pool`), che è il catalogo già passato dai filtri di sicurezza — allergeni
   * revisionati, regime compatibile, esclusioni applicate.
   *
   * Se quel pool non c'è si torna a mani vuote **di proposito**: significa che il piano di quella
   * cliente non è certificato (e ha già una segnalazione «piano bloccato» aperta). Pescare dai
   * template salterebbe i controlli di sicurezza per proporre una colazione: nessuna colazione vale
   * quel rischio.
   */
  private async candidatiPerSlot(clientId: string, slot: string): Promise<CandidatoPiatto[]> {
    const pool = (await this.prisma.clientMenuPool.findFirst({
      where: { clientId },
      orderBy: { version: 'desc' },
      select: { recipeIds: true },
    })) as { recipeIds: string[] } | null;
    const ids = (pool?.recipeIds ?? []).filter(Boolean);
    if (!ids.length) return [];

    const ricette = (await this.prisma.recipe.findMany({
      where: { id: { in: ids }, mealSlot: slot as never, active: true },
      select: { id: true, name: true, kcal: true, macros: true, difficulty: true, tags: true },
    })) as { id: string; name: string; kcal: number; macros: unknown; difficulty: string | null; tags?: string[] }[];

    return ricette.map((r) => {
      const macro = (r.macros ?? {}) as { protein_g?: unknown };
      const prot = typeof macro.protein_g === 'number' ? macro.protein_g : null;
      return { recipeId: r.id, nome: r.name, kcal: r.kcal, proteineG: prot, difficolta: r.difficulty, tags: r.tags ?? [] };
    });
  }

  /**
   * «Voglio una colazione proteica». Cerca due alternative e le propone.
   *
   * `slotVoluto` arriva dal ramo in cui la cliente stava già parlando di un piatto (il «no» alla
   * sostituzione): in quel caso non le si richiede quale pasto, lo sappiamo già.
   */
  async proponiAltroPiatto(
    clientId: string,
    testoCliente: string,
    slotVoluto?: string,
    data?: string | null,
    /**
     * Il gusto della colazione: `undefined` = non ancora chiesto (se serve, si chiede);
     * `null` = chiesto e «fa lo stesso» (si cerca senza filtro); altrimenti filtra per tag.
     */
    gusto?: GustoColazione | null,
  ): Promise<EsitoSostituzione> {
    const oggi = this.oggiIso();
    const giorno = giornoDellaConversazione({ testo: testoCliente, statoData: data, oggiIso: oggi });
    const quando = etichettaGiorno(giorno, oggi);
    const [pasti, nome] = await Promise.all([this.pastiDelGiorno(clientId, giorno), this.nomeDi(clientId)]);
    if (!pasti.length) return { testo: testoChiediCibo([], nome, quando), esito: 'rifiutata' };

    // Su quale pasto: quello di cui si stava parlando, o quello nominato nel testo, o — se non è
    // chiaro — non si indovina: si torna alla domanda, che è meglio di cambiare il pasto sbagliato.
    const preferenza = preferenzaDaTesto(testoCliente);
    const daTesto = this.trovaPiatto(pasti, testoCliente);
    const bersaglio = slotVoluto
      ? pasti.find((p) => p.pasto.slot === slotVoluto)
      : daTesto ?? this.pastoDalloSlotNominato(pasti, testoCliente);
    if (!bersaglio) {
      // «Lo voglio diverso» senza dire di cosa. Prima qui si tornava alla domanda
      // dell'INGREDIENTE — una domanda diversa da quella che serviva, in risposta a una richiesta
      // capita benissimo. Adesso si chiede quale pasto, con l'elenco di oggi: chiedere costa un
      // messaggio, scegliere per lei costa il pasto sbagliato.
      const elenco = pasti.map((p) => ({ slot: p.pasto.slot, piatto: p.nome }));
      return {
        testo: testoChiediQualePasto(elenco, preferenza, nome, quando),
        stato: { passo: 'scelta_pasto', tentativi: 0, preferenzaPiatto: preferenza, pastiPerScelta: elenco, data: giorno },
        esito: 'aperto',
      };
    }

    const attuale = bersaglio.pasto;

    /**
     * «DOLCE O SALATA?» (Simone, 14/8): sul cambio della COLAZIONE, se non ha detto cosa vuole,
     * si chiede il gusto prima di proporre. ⚠️ Solo la colazione — è l'unico slot con i tag di
     * Lucia — e solo senza preferenza: «una colazione proteica» ha già risposto a una domanda
     * più precisa, e richiederle il gusto sarebbe ignorare quello che ha appena scritto.
     */
    if (attuale.slot === 'breakfast' && !preferenza && gusto === undefined) {
      const domanda = testoChiediGustoColazione(nome);
      return {
        testo: domanda,
        stato: { passo: 'colazione_gusto', tentativi: 0, slotPiatto: attuale.slot, data: giorno, ultimaDomanda: domanda },
        esito: 'aperto',
      };
    }

    const tutti_i_candidati = await this.candidatiPerSlot(clientId, attuale.slot);
    // Il filtro del gusto passa dai TAG (le conferme di Lucia): una colazione senza tag non
    // partecipa alla ricerca filtrata. Le proteine del piatto attuale si leggono PRIMA del filtro:
    // il piatto di adesso può essere dolce anche quando lei chiede una salata.
    const candidati = gusto ? filtraPerGusto(tutti_i_candidati, gusto) : tutti_i_candidati;
    const proteineAttuali = tutti_i_candidati.find((c) => c.recipeId === attuale.recipeId)?.proteineG ?? null;
    const tolleranza = await this.configParams
      .getNumber('menu_kcal_balance_tolerance_pct', 15)
      .catch(() => 15);
    const alternative = ordinaAlternative(candidati, {
      kcalAttuali: attuale.kcal,
      proteineAttualiG: proteineAttuali,
      preferenza,
      // Il piatto attuale e tutti gli altri della giornata: proporle a colazione quello che ha a
      // pranzo non è un'alternativa.
      escludiRecipeIds: pasti.map((p) => p.pasto.recipeId),
      tolleranzaKcalPct: tolleranza,
      // «Ovviamente con altri ingredienti» (Simone, 12/8): un piatto che si chiama quasi come
      // quello rifiutato — «Insalata Tiepida Tacchino e Farro» al posto di «…e Quinoa» — non è
      // un'alternativa. Va in fondo, non fuori: se il ricettario ha solo quelli, meglio proporre
      // qualcosa che niente.
      nomeAttuale: bersaglio.nome,
    });

    if (!alternative.length) {
      const cosaChiesto = gusto ? `colazione ${gusto === 'dolce' ? 'dolce' : 'salata'}` : preferenza ?? 'diversa';
      await this.passaAllaNutrizionista(
        clientId,
        `Nessuna alternativa ${cosaChiesto} dentro le calorie per ${etichettaSlot(attuale.slot)} ` +
        `(${attuale.name}, ${attuale.kcal} kcal): il catalogo approvato non ne ha.`,
      ).catch(() => undefined);
      return {
        testo: testoNessunaAlternativa(etichettaSlot(attuale.slot), preferenza, nome, gusto),
        inoltraA: 'nutritionist',
        esito: 'arresa',
      };
    }

    return {
      testo: testoProponiAlternative(
        etichettaSlot(attuale.slot),
        { nome: bersaglio.nome, kcal: attuale.kcal },
        alternative,
        preferenza,
        nome,
        quando,
      ),
      stato: {
        passo: 'scelta_piatto',
        tentativi: 0,
        data: giorno,
        slotPiatto: attuale.slot,
        piattoAttuale: { recipeId: attuale.recipeId, nome: bersaglio.nome, kcal: attuale.kcal },
        // Il gusto chiesto finisce nella preferenza registrata: in scheda e nel report il cambio
        // deve dire cosa aveva chiesto lei, non solo cosa le è stato dato.
        preferenzaPiatto: preferenza ?? (gusto ? `colazione ${gusto === 'dolce' ? 'dolce' : 'salata'}` : null),
        gustoColazione: gusto ?? null,
        alternativePiatto: alternative.map((a) => ({ recipeId: a.recipeId, nome: a.nome, kcal: a.kcal })),
      },
      esito: 'in_corso',
    };
  }

  /** Il pasto nominato a parole («la colazione»), quando non stiamo già parlando di un piatto. */
  private pastoDalloSlotNominato(pasti: PastoConRicetta[], testoCliente: string): PastoConRicetta | null {
    const t = normalizza(testoCliente);
    const perSlot: Record<string, RegExp> = {
      breakfast: /\bcolazione\b/,
      lunch: /\bpranzo\b/,
      dinner: /\bcena\b/,
      snack: /\b(spuntino|merenda)\b/,
    };
    for (const p of pasti) {
      const r = perSlot[p.pasto.slot];
      if (r && r.test(t)) return p;
    }
    return null;
  }

  /**
   * La cliente ha detto QUALE pasto vuole cambiare («2», «il pranzo», o il nome del piatto). Da qui
   * si riprende la strada normale, con la preferenza che aveva espresso all'inizio: «più proteico»
   * detto due messaggi fa vale ancora, e farglielo ripetere sarebbe non aver ascoltato.
   */
  private async passoSceltaPasto(
    clientId: string,
    stato: StatoSostituzione,
    testoCliente: string,
  ): Promise<EsitoSostituzione> {
    const elenco = stato.pastiPerScelta ?? [];
    const slot = slotDaRisposta(testoCliente, elenco);
    if (!slot) {
      const tentativi = (stato.tentativi ?? 0) + 1;
      const nome = await this.nomeDi(clientId);
      const oggiIso = this.oggiIso();
      if (tentativi >= 2) {
        return { testo: testoAnnullato(nome, etichettaGiorno(stato.data ?? oggiIso, oggiIso)), esito: 'annullata' };
      }
      return {
        testo: `${nonHoCapito(stato.ultimaDomanda, nome)}\n\n${testoSceltaNonValida(elenco.length)}`,
        stato: { ...stato, tentativi },
        esito: 'in_corso',
      };
    }
    // Il testo che si passa è quello del PRIMO messaggio (la preferenza), non la risposta «2»:
    // altrimenti `preferenzaDaTesto` leggerebbe un numero e la richiesta «più proteico» andrebbe
    // persa proprio nel passo in cui si va a cercare l'alternativa.
    const preferenzaScritta = stato.preferenzaPiatto ? `voglio qualcosa di più ${stato.preferenzaPiatto}` : '';
    return this.proponiAltroPiatto(clientId, preferenzaScritta, slot, stato.data);
  }

  /**
   * La risposta a «dolce o salata?» (Simone, 14/8).
   *
   * «Fa lo stesso» è una risposta piena: si cerca senza filtro. Una risposta non capita si
   * ripete UNA volta (con la stessa domanda, parola per parola — regola del 12/8); alla seconda
   * si cerca senza filtro: meglio due proposte qualsiasi che un dialogo che insiste sul gusto.
   */
  private async passoColazioneGusto(
    clientId: string,
    stato: StatoSostituzione,
    testoCliente: string,
  ): Promise<EsitoSostituzione> {
    const slot = stato.slotPiatto ?? 'breakfast';
    const gusto = gustoDaTesto(testoCliente);
    if (!gusto) {
      const tentativi = (stato.tentativi ?? 0) + 1;
      if (tentativi >= 2) {
        return this.proponiAltroPiatto(clientId, '', slot, stato.data, null);
      }
      const nome = await this.nomeDi(clientId);
      return {
        testo: nonHoCapito(stato.ultimaDomanda, nome),
        stato: { ...stato, tentativi },
        esito: 'in_corso',
      };
    }
    return this.proponiAltroPiatto(clientId, '', slot, stato.data, gusto === 'indifferente' ? null : gusto);
  }

  /** La cliente ha risposto con il numero dell'alternativa. */
  private async passoSceltaPiatto(
    clientId: string,
    stato: StatoSostituzione,
    testoCliente: string,
  ): Promise<EsitoSostituzione> {
    const alternative = stato.alternativePiatto ?? [];
    const numero = Number((testoCliente.match(/\d+/) ?? [])[0]);
    const scelta = Number.isFinite(numero) ? alternative[numero - 1] : undefined;
    if (!scelta) {
      const tentativi = (stato.tentativi ?? 0) + 1;
      const nome = await this.nomeDi(clientId);
      if (tentativi >= 2) {
        return { testo: testoAnnullato(nome, etichettaGiorno(stato.data ?? this.oggiIso(), this.oggiIso())), esito: 'annullata' };
      }
      return {
        testo: `${nonHoCapito(stato.ultimaDomanda, nome)}\n\n${testoSceltaNonValida(alternative.length)}`,
        stato: { ...stato, tentativi },
        esito: 'in_corso',
      };
    }
    return this.applicaCambioPiatto(clientId, stato, scelta);
  }

  /**
   * Scrive il piatto nuovo sulla giornata **di cui si sta parlando**, e registra il cambio.
   *
   * §16.2: fino al 12/8 era sempre e solo oggi, e una cliente che guardava il menu di domani
   * chiedeva una cosa che non le potevamo dare. Adesso è la giornata della conversazione — che
   * resta UNA sola: cambiare il piatto per sempre vuol dire riscrivere il piano, e quello non è
   * mestiere della chat.
   * Il record (`cambioPiatto`) è ciò che lo rende visibile in scheda cliente e contabile nel report
   * di fine mese: senza, avremmo sovrascritto un `recipeId` e nessuno saprebbe mai del cambio.
   */
  private async applicaCambioPiatto(
    clientId: string,
    stato: StatoSostituzione,
    scelta: { recipeId: string; nome: string; kcal: number },
  ): Promise<EsitoSostituzione> {
    const oggi = toDateOnly();
    const oggiIso = this.oggiIso();
    const giornoIso = stato.data || oggiIso;
    const quando = etichettaGiorno(giornoIso, oggiIso);
    const giorno = await this.prisma.menuDay.findFirst({
      // Lo stesso perimetro di `pastiDelGiorno`: mai una giornata che la cliente non vede.
      where: { clientId, date: toDateOnly(giornoIso), visibleFrom: { lte: oggi } } as never,
    });
    if (!giorno) return { testo: testoChiediCibo([], await this.nomeDi(clientId), quando), esito: 'rifiutata' };

    const pasti = ((giorno.meals as unknown as MealSnapshot[]) ?? []).filter(Boolean);
    const slot = stato.slotPiatto;
    const indice = pasti.findIndex((m) => m.slot === slot);
    if (indice < 0) return { testo: testoAnnullato(await this.nomeDi(clientId), quando), esito: 'annullata' };

    const prima = pasti[indice];
    const nuovi = [...pasti];
    nuovi[indice] = {
      slot: prima.slot,
      recipeId: scelta.recipeId,
      name: scelta.nome,
      kcal: scelta.kcal,
      // Le sostituzioni di ingrediente del piatto VECCHIO non si portano dietro: erano sue, e su un
      // piatto nuovo non vogliono dire niente.
      cambioPiatto: {
        daRecipeId: prima.recipeId,
        daNome: prima.name,
        daKcal: prima.kcal,
        preferenza: stato.preferenzaPiatto ?? 'diverso',
        origine: 'chat',
        stato: 'da_verificare',
        concordataIl: new Date().toISOString(),
      },
    };
    await this.prisma.menuDay.update({ where: { id: giorno.id }, data: { meals: nuovi as never } });
    await this.audit.log({
      action: 'menu.cambio_piatto_chat',
      actorId: clientId,
      entityType: 'menu_day',
      entityId: giorno.id,
      metadata: {
        slot: prima.slot,
        da: { recipeId: prima.recipeId, nome: prima.name, kcal: prima.kcal },
        a: { recipeId: scelta.recipeId, nome: scelta.nome, kcal: scelta.kcal },
        preferenza: stato.preferenzaPiatto ?? null,
      },
    });
    // §16.9 — anche il cambio di PIATTO entra in tabella: «questa cliente il minestrone non lo
    // vuole e prende sempre l'insalata di farro» è esattamente il genere di cosa che oggi si
    // perdeva dopo trenta giorni.
    await registraSostituzione(this.prisma, {
      clientId,
      tipo: 'piatto',
      from: prima.name,
      to: scelta.nome,
      recipeId: prima.recipeId,
      dishName: prima.name,
      mealSlot: prima.slot,
      motivo: stato.preferenzaPiatto ?? null,
      dietId: giorno.dietId ?? null,
      origine: 'chat',
    });

    // Anche il cambio di PIATTO nasce «da verificare», quindi merita lo stesso avviso del cambio di
    // ingrediente: è un piatto intero diverso da quello che il motore aveva composto.
    await this.avvisaDellaVerifica(
      clientId,
      `ha cambiato il piatto di ${etichettaSlot(prima.slot)}: «${prima.name}» → «${scelta.nome}»`,
      { slot: prima.slot, daNome: prima.name, aNome: scelta.nome, tipo: 'piatto' },
    );

    return {
      testo:
        testoCambioPiattoFatto(etichettaSlot(prima.slot), scelta, await this.nomeDi(clientId), quando) +
        (await this.invitoARiflettere(clientId)),
      esito: 'applicata',
    };
  }

  // ---------- La verifica della nutrizionista ----------

  /**
   * Chiude il cerchio dei cambi nati da Gaia: fino a oggi la nutrizionista li **vedeva** in scheda e
   * non li poteva toccare — lo stato `corretta` esisteva nel dato e non c'era nessun modo di
   * scriverlo. Una verifica che non si può registrare non è una verifica: è una lettura.
   *
   * Le tre cose che può fare, e perché servono tutte e tre:
   * - `verificata` — va bene così. È il caso più frequente, e senza un modo di dirlo l'elenco «da
   *   verificare» cresce per sempre e nessuno sa più cosa ha già guardato;
   * - `corretta` — va bene il cambio, non i dettagli: cambia il sostituto o i grammi. È il caso che
   *   serve sul gruppo dei grassi, dove la pari grammatura non regge (70 ml di panna ≈ 200 kcal,
   *   70 g di olio ≈ 630);
   * - `annullata` — non va: il piatto torna esattamente come era.
   *
   * Si scrive sulla giornata e **non** si tocca la ricetta di catalogo, come per tutto il resto di
   * questo file: il cambio vive dentro `MenuDay.meals` di quella cliente.
   */
  async correggiCambioInChat(
    clientId: string,
    actorId: string,
    input: CorrezioneCambio,
  ): Promise<{ stato: string; descrizione: string }> {
    const data = toDateOnly(input.data);
    const giorno = await this.prisma.menuDay.findFirst({ where: { clientId, date: data } });
    if (!giorno) throw new NotFoundException('Nessun menu per quella data.');

    const pasti = ((giorno.meals as unknown as MealSnapshot[]) ?? []).filter(Boolean);
    const indice = pasti.findIndex((m) => m.slot === input.slot);
    if (indice < 0) throw new NotFoundException('Quel pasto non c\'è in quella giornata.');
    const pasto = { ...pasti[indice] };

    let descrizione = '';
    const adesso = new Date().toISOString();

    if (input.tipo === 'piatto') {
      const cambio = pasto.cambioPiatto;
      if (!cambio || cambio.origine !== 'chat') throw new NotFoundException('Nessun cambio di piatto da verificare qui.');
      if (input.stato === 'annullata') {
        // Il piatto torna quello di prima. Si toglie anche il record del cambio: resta l'audit, che
        // è il posto giusto per la storia — la giornata deve dire com'è il menu, non com'è stato.
        pasti[indice] = {
          slot: pasto.slot,
          recipeId: cambio.daRecipeId,
          name: cambio.daNome,
          kcal: cambio.daKcal,
        };
        descrizione = `Cambio di piatto annullato: torna «${cambio.daNome}».`;
      } else {
        pasti[indice] = {
          ...pasto,
          cambioPiatto: { ...cambio, stato: input.stato, verificataIl: adesso, verificataDa: actorId, nota: input.nota },
        };
        descrizione =
          input.stato === 'verificata'
            ? `Cambio di piatto confermato: «${pasto.name}» va bene.`
            : `Cambio di piatto rivisto dalla nutrizionista${input.nota ? `: ${input.nota}` : '.'}`;
      }
    } else {
      const esistenti = pasto.substitutions ?? [];
      // Si individua per `from` **e** origine chat: una giornata può avere più sostituzioni, e
      // quelle messe dal motore per un'intolleranza non sono materia di questa verifica.
      const i = esistenti.findIndex((s) => s.origine === 'chat' && combaciaAlimento(s.from, input.from ?? ''));
      if (i < 0) throw new NotFoundException('Nessuna sostituzione da chat su quell\'alimento.');
      const s = esistenti[i];

      if (input.stato === 'annullata') {
        pasti[indice] = { ...pasto, substitutions: esistenti.filter((_, k) => k !== i) };
        descrizione = `Sostituzione annullata: nel piatto torna «${s.from}».`;
      } else {
        const nuovo: Substitution = {
          ...s,
          ...(input.to ? { to: input.to } : {}),
          ...(input.toQty !== undefined ? { toQty: input.toQty } : {}),
          // L'unità si ricalcola sul sostituto nuovo: «70 ml di burro» non esiste (vedi
          // `unitaPerSostituto`). Se la nutrizionista la scrive a mano, vince la sua.
          ...(input.unitA ? { unitA: input.unitA } : input.to ? { unitA: unitaPerSostituto(s.unit, input.to) } : {}),
          stato: input.stato,
          verificataIl: adesso,
          verificataDa: actorId,
          ...(input.nota ? { nota: input.nota } : {}),
        };
        const cambiato = [...esistenti];
        cambiato[i] = nuovo;
        pasti[indice] = { ...pasto, substitutions: cambiato };
        descrizione =
          input.stato === 'verificata'
            ? `Sostituzione confermata: «${s.from}» → «${s.to}» va bene.`
            : `Sostituzione corretta dalla nutrizionista: «${s.from}» → «${nuovo.to}»` +
              `${nuovo.toQty ? ` ${nuovo.toQty} ${nuovo.unitA ?? nuovo.unit ?? ''}`.trimEnd() : ''}.`;
      }
    }

    await this.prisma.menuDay.update({ where: { id: giorno.id }, data: { meals: pasti as never } });
    await this.audit.log({
      action: 'menu.cambio_chat.verifica',
      actorId,
      entityType: 'menu_day',
      entityId: giorno.id,
      metadata: {
        clientId,
        data: input.data,
        slot: input.slot,
        tipo: input.tipo,
        stato: input.stato,
        from: input.from ?? null,
        to: input.to ?? null,
        toQty: input.toQty ?? null,
        nota: input.nota ?? null,
      },
    });
    return { stato: input.stato, descrizione };
  }

  async sostituzioniDiChat(clientId: string, giorniIndietro = 30): Promise<SostituzioneInChat[]> {
    const oggi = toDateOnly();
    const giorno = 24 * 60 * 60 * 1000;
    const da = new Date(oggi.getTime() - giorniIndietro * giorno);
    // Finestra chiusa da entrambi i lati: con solo `gte` e `orderBy desc` il `take` teneva i
    // giorni più FUTURI, e i cambi appena concordati — quelli da verificare — potevano restare
    // fuori dall'elenco proprio perché recenti.
    const a = new Date(oggi.getTime() + 30 * giorno);
    const giorni = await this.prisma.menuDay.findMany({
      where: {
        clientId,
        date: {
          gte: toDateOnly(da.toISOString().slice(0, 10)),
          lte: toDateOnly(a.toISOString().slice(0, 10)),
        },
      },
      orderBy: { date: 'desc' },
      take: 90,
    });
    const out: SostituzioneInChat[] = [];
    for (const giorno of giorni) {
      const data = giorno.date.toISOString().slice(0, 10);
      for (const pasto of ((giorno.meals as unknown as MealSnapshot[]) ?? [])) {
        // Il piatto cambiato: `from` è il piatto vecchio, `to` quello nuovo. Senza questo blocco il
        // cambio esisteva nella giornata e in scheda non compariva — cioè, per la nutrizionista, non
        // esisteva (requisito di Simone dell'8/8).
        const cp = pasto.cambioPiatto;
        if (cp && cp.origine === 'chat') {
          out.push({
            tipo: 'piatto',
            data,
            slot: pasto.slot,
            slotLabel: etichettaSlot(pasto.slot),
            piatto: pasto.name,
            from: cp.daNome,
            to: pasto.name,
            motivo: cp.preferenza,
            reason: `Piatto cambiato in chat${cp.preferenza ? ` (${cp.preferenza})` : ''}: ${cp.daKcal} → ${pasto.kcal} kcal`,
            stato: cp.stato ?? 'da_verificare',
            concordataIl: cp.concordataIl,
            verificataIl: cp.verificataIl,
            nota: cp.nota,
          });
        }
        for (const s of pasto.substitutions ?? []) {
          if (s.origine !== 'chat') continue;
          out.push({
            tipo: 'ingrediente',
            data,
            slot: pasto.slot,
            slotLabel: etichettaSlot(pasto.slot),
            piatto: pasto.name,
            from: s.from,
            to: s.to,
            fromQty: s.fromQty,
            toQty: s.toQty,
            // ⚠️ `fattoreDaDire` e non `pasto.porzione`: sotto il 5% il menu non segnala niente e la
            // scheda ricetta resta di catalogo, quindi qui scalare direbbe un numero che da nessuna
            // altra parte compare.
            ...(() => {
              const f = fattoreDaDire(pasto.porzione);
              if (f === 1) return {};
              const da = quantitaScalata(s.fromQty, f, s.unit);
              const a = quantitaScalata(s.toQty, f, s.unitA ?? s.unit);
              return { ...(da !== null ? { fromQtyPiatto: da } : {}), ...(a !== null ? { toQtyPiatto: a } : {}) };
            })(),
            unit: s.unit,
            unitA: s.unitA,
            motivo: s.motivo,
            reason: s.reason,
            stato: s.stato ?? 'da_verificare',
            concordataIl: s.concordataIl,
            grammaturaCorretta: s.grammaturaCorretta,
            verificataIl: s.verificataIl,
            nota: s.nota,
          });
        }
      }
    }
    return out;
  }
}
