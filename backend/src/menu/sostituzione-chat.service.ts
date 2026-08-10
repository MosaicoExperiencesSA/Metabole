import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { avvisaNutrizionistaDellaCliente } from '../common/avvisa-nutrizionista';
import { toDateOnly } from '../common/date-only';
import { ConfigParamsService } from '../config-params/config-params.service';
import { apriSegnalazione } from '../escalations/apri-segnalazione';
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
  type CandidatoPiatto,
} from './cambio-piatto';
import { exclusionKeys } from './exclusions';
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
  etichettaSlot,
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
  fromQty?: number;
  toQty?: number;
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

/**
 * Gli ingredienti come stanno NEL PIATTO oggi: quelli della ricetta di catalogo, con sopra le
 * sostituzioni già concordate.
 *
 * Senza questo, Gaia negava l'esistenza di un alimento che aveva scritto lei: concordato ieri
 * «carote → biete», oggi la cliente apre il menu, legge «biete 100 g», preme Sostituisci e
 * scrive «le biete» — e si sentiva rispondere che le biete non ci sono, perché nessuna ricetta
 * di catalogo le contiene. Due tentativi così e il dialogo passava alla coach.
 */
export function ingredientiEffettivi(
  ingredientiRicetta: IngredienteRicetta[],
  pasto: { substitutions?: Substitution[] },
): IngredienteRicetta[] {
  let out = ingredientiRicetta.map((i) => ({ ...i }));
  for (const s of pasto.substitutions ?? []) {
    let sostituito = false;
    out = out.map((i) => {
      if (sostituito || !i?.name || !combaciaAlimento(i.name, s.from)) return i;
      sostituito = true;
      return { name: s.to, qty: s.toQty ?? i.qty, unit: s.unitA ?? s.unit ?? i.unit };
    });
    // Sostituzione che non trova la sua origine (piatto cambiato, catena di cambi): il
    // sostituto va comunque considerato presente, altrimenti resta invisibile.
    if (!sostituito && !out.some((i) => !!i?.name && combaciaAlimento(i.name, s.to))) {
      out.push({ name: s.to, qty: s.toQty, unit: s.unitA ?? s.unit });
    }
  }
  return out;
}

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
   * Apertura dal pulsante «Sostituisci un ingrediente» dell'app: Gaia elenca i piatti di
   * oggi e chiede quale alimento cambiare.
   */
  async apri(clientId: string): Promise<EsitoSostituzione> {
    const [pasti, nome] = await Promise.all([this.pastiDiOggi(clientId), this.nomeDi(clientId)]);
    const elenco = pasti.map((p) => ({ slot: p.pasto.slot, piatto: p.nome }));
    if (!elenco.length) {
      return { testo: testoChiediCibo([], nome), esito: 'rifiutata' };
    }
    return { testo: testoChiediCibo(elenco, nome), stato: { passo: 'cibo', tentativi: 0 }, esito: 'aperto' };
  }

  /**
   * Apertura da testo libero («vorrei sostituire le carote»): se l'alimento è già riconoscibile
   * nel menu di oggi si salta la domanda e si passa direttamente al motivo.
   */
  async apriDaTesto(clientId: string, testoCliente: string): Promise<EsitoSostituzione> {
    const [pasti, nome] = await Promise.all([this.pastiDiOggi(clientId), this.nomeDi(clientId)]);
    if (!pasti.length) return { testo: testoChiediCibo([], nome), esito: 'rifiutata' };
    const trovato = this.trovaIngrediente(pasti, testoCliente);
    if (!trovato) {
      return {
        testo: testoChiediCibo(pasti.map((p) => ({ slot: p.pasto.slot, piatto: p.nome })), nome),
        stato: { passo: 'cibo', tentativi: 0 },
        esito: 'aperto',
      };
    }
    return this.proponi(clientId, trovato);
  }

  /** Passo successivo del dialogo, a partire dallo stato appeso all'ultimo messaggio di Gaia. */
  async avanza(
    clientId: string,
    stato: StatoSostituzione,
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
    if (secco && stato.passo !== 'conferma' && stato.passo !== 'rifiuto') {
      return { testo: testoAnnullato(await this.nomeDi(clientId)), esito: 'annullata' };
    }
    if (stato.passo === 'cibo') return this.passoCibo(clientId, stato, testoCliente);
    if (stato.passo === 'motivo') return this.passoMotivo(clientId, stato, testoCliente);
    if (stato.passo === 'scelta_piatto') return this.passoSceltaPiatto(clientId, stato, testoCliente);
    if (stato.passo === 'scelta_pasto') return this.passoSceltaPasto(clientId, stato, testoCliente);
    if (stato.passo === 'rifiuto') return this.passoRifiuto(clientId, stato, testoCliente);
    return this.passoConferma(clientId, stato, testoCliente);
  }

  // ---------- Passi ----------

  private async passoCibo(
    clientId: string,
    stato: StatoSostituzione,
    testoCliente: string,
  ): Promise<EsitoSostituzione> {
    const pasti = await this.pastiDiOggi(clientId);
    if (!pasti.length) return { testo: testoChiediCibo([], await this.nomeDi(clientId)), esito: 'rifiutata' };

    const trovato = this.trovaIngrediente(pasti, testoCliente);
    if (trovato) return this.proponi(clientId, trovato);

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
      return { testo: testoCiboNonTrovato(cibo, true), inoltraA: 'coach', esito: 'arresa' };
    }
    return {
      testo: testoCiboNonTrovato(cibo, false),
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
      return { testo: testoMotivoNonCapito(false), stato: { ...stato, tentativi }, esito: 'in_corso' };
    }
    if (!stato.proposta) {
      // Non dovrebbe capitare (il motivo si chiede solo dopo la proposta): si riparte pulito.
      return this.apri(clientId);
    }
    return {
      testo: testoConferma(stato.proposta, motivo, await this.nomeDi(clientId)),
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
    const pasti = await this.pastiDiOggi(clientId);
    const pasto = pasti.find((p) => p.pasto.slot === proposta.slot);
    // Il menu è cambiato sotto i piedi: meglio ricominciare che decidere su una giornata che non è
    // più quella (stessa scelta di `altroSostituto`).
    if (!pasto) return this.apri(clientId);

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
    if ([...allergeni].some((k) => k && testo.includes(k))) return 'allergene';
    const altre = exclusionKeys([
      ...((profilo?.intolerances ?? []) as string[]),
      ...((profilo?.dislikedFoods ?? []) as string[]),
    ]);
    if ([...altre].some((k) => k && testo.includes(k))) return 'escluso';
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

    const pasti = await this.pastiDiOggi(clientId);
    const pasto = pasti.find((p) => p.pasto.slot === proposta.slot);
    const ingrediente = pasto?.ingredienti.find((i) => i?.name && combaciaAlimento(i.name, proposta.da));
    // Il menu è cambiato sotto i piedi (rigenerato, o un altro cambio applicato nel frattempo):
    // meglio ricominciare da capo che scrivere su una giornata che non è più quella.
    if (!pasto || !ingrediente) return this.apri(clientId);

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
      data: toDateOnly().toISOString().slice(0, 10),
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
    };
    return {
      testo: testoChiediMotivo(proposta),
      stato: { passo: 'motivo', cibo: nomeIngrediente, proposta, tentativi: 0 },
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
      if ([...allergeni].some((k) => k && testo.includes(k))) {
        scartatoPerAllergene = true;
        continue;
      }
      if ([...altreEsclusioni].some((k) => k && testo.includes(k))) continue;
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
    const giorni = await this.prisma.menuDay.findMany({
      where: { clientId, date: motivo.durata === 'oggi' ? oggi : { gte: oggi } },
      orderBy: { date: 'asc' },
      take: motivo.durata === 'oggi' ? 1 : 30,
    });

    const oggiIso = oggi.toISOString().slice(0, 10);
    let pastiToccati = 0;
    let giorniToccati = 0;
    let giaPresenti = 0;

    for (const giorno of giorni) {
      const pasti = ((giorno.meals as unknown as MealSnapshot[]) ?? []).map((m) => ({ ...m }));
      const ricette = await this.ricetteDi(pasti);
      const eOggi = giorno.date.toISOString().slice(0, 10) === oggiIso;
      let toccato = false;

      const aggiornati = pasti.map((pasto) => {
        // OGGI si tocca SOLO il pasto su cui la cliente ha detto sì: la conferma che ha letto
        // nominava un pasto, uno solo. Prima il ciclo scriveva su ogni pasto della giornata che
        // contenesse quell'ingrediente, quindi un cambio concordato sulla pasta del pranzo
        // riscriveva anche la pasta sfoglia della cena — un piatto di cui non si era parlato.
        if (eOggi && (pasto.slot !== proposta.slot || pasto.recipeId !== proposta.recipeId)) return pasto;
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
        testo: `Nel frattempo il menu di oggi è cambiato e «${proposta.da}» non c'è più: non ho toccato niente. Se lo vedi ancora, riprova. 💚`,
        esito: 'rifiutata',
      };
    }

    await this.avvisaDellaVerifica(
      clientId,
      `ha cambiato «${proposta.da}» con «${proposta.a}» (${etichettaSlot(proposta.slot)}: ${proposta.piatto})`,
      { da: proposta.da, a: proposta.a, slot: proposta.slot, motivo: motivo.key, giorni: giorniToccati },
    );

    return {
      testo: testoFatto(proposta, motivo, await this.nomeDi(clientId)),
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
      await apriSegnalazione(this.prisma as never, {
        clientId,
        category: categoria,
        source: 'coach',
        reason: motivo,
        dedupe: true,
      });
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

  /** I pasti di OGGI con la ricetta risolta. Vuoto se la cliente non ha un menu per oggi. */
  private async pastiDiOggi(clientId: string): Promise<PastoConRicetta[]> {
    const giorno = await this.prisma.menuDay.findFirst({
      where: { clientId, date: toDateOnly() },
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
      select: { id: true, name: true, kcal: true, macros: true, difficulty: true },
    })) as { id: string; name: string; kcal: number; macros: unknown; difficulty: string | null }[];

    return ricette.map((r) => {
      const macro = (r.macros ?? {}) as { protein_g?: unknown };
      const prot = typeof macro.protein_g === 'number' ? macro.protein_g : null;
      return { recipeId: r.id, nome: r.name, kcal: r.kcal, proteineG: prot, difficolta: r.difficulty };
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
  ): Promise<EsitoSostituzione> {
    const [pasti, nome] = await Promise.all([this.pastiDiOggi(clientId), this.nomeDi(clientId)]);
    if (!pasti.length) return { testo: testoChiediCibo([], nome), esito: 'rifiutata' };

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
        testo: testoChiediQualePasto(elenco, preferenza, nome),
        stato: { passo: 'scelta_pasto', tentativi: 0, preferenzaPiatto: preferenza, pastiPerScelta: elenco },
        esito: 'aperto',
      };
    }

    const attuale = bersaglio.pasto;
    const candidati = await this.candidatiPerSlot(clientId, attuale.slot);
    const proteineAttuali = candidati.find((c) => c.recipeId === attuale.recipeId)?.proteineG ?? null;
    const tolleranza = await this.configParams
      .getNumber('menu_kcal_balance_tolerance_pct', 15)
      .catch(() => 15);
    const alternative = ordinaAlternative(candidati, {
      kcalAttuali: attuale.kcal,
      proteineAttualiG: proteineAttuali,
      preferenza,
      // Il piatto attuale e tutti gli altri di oggi: proporle a colazione quello che ha a pranzo
      // non è un'alternativa.
      escludiRecipeIds: pasti.map((p) => p.pasto.recipeId),
      tolleranzaKcalPct: tolleranza,
    });

    if (!alternative.length) {
      await this.passaAllaNutrizionista(
        clientId,
        `Nessuna alternativa ${preferenza ?? 'diversa'} dentro le calorie per ${etichettaSlot(attuale.slot)} ` +
        `(${attuale.name}, ${attuale.kcal} kcal): il catalogo approvato non ne ha.`,
      ).catch(() => undefined);
      return {
        testo: testoNessunaAlternativa(etichettaSlot(attuale.slot), preferenza, nome),
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
      ),
      stato: {
        passo: 'scelta_piatto',
        tentativi: 0,
        slotPiatto: attuale.slot,
        piattoAttuale: { recipeId: attuale.recipeId, nome: bersaglio.nome, kcal: attuale.kcal },
        preferenzaPiatto: preferenza,
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
      if (tentativi >= 2) return { testo: testoAnnullato(await this.nomeDi(clientId)), esito: 'annullata' };
      return {
        testo: testoSceltaNonValida(elenco.length),
        stato: { ...stato, tentativi },
        esito: 'in_corso',
      };
    }
    // Il testo che si passa è quello del PRIMO messaggio (la preferenza), non la risposta «2»:
    // altrimenti `preferenzaDaTesto` leggerebbe un numero e la richiesta «più proteico» andrebbe
    // persa proprio nel passo in cui si va a cercare l'alternativa.
    const preferenzaScritta = stato.preferenzaPiatto ? `voglio qualcosa di più ${stato.preferenzaPiatto}` : '';
    return this.proponiAltroPiatto(clientId, preferenzaScritta, slot);
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
      if (tentativi >= 2) return { testo: testoAnnullato(await this.nomeDi(clientId)), esito: 'annullata' };
      return { testo: testoSceltaNonValida(alternative.length), stato: { ...stato, tentativi }, esito: 'in_corso' };
    }
    return this.applicaCambioPiatto(clientId, stato, scelta);
  }

  /**
   * Scrive il piatto nuovo sulla giornata di OGGI, e **registra il cambio**.
   *
   * Solo oggi: cambiare il piatto per sempre vuol dire riscrivere il piano, e quello non è un
   * mestiere della chat. Il record (`cambioPiatto`) è ciò che lo rende visibile in scheda cliente e
   * contabile nel report di fine mese: senza, avremmo sovrascritto un `recipeId` e nessuno saprebbe
   * mai che c'è stato un cambio.
   */
  private async applicaCambioPiatto(
    clientId: string,
    stato: StatoSostituzione,
    scelta: { recipeId: string; nome: string; kcal: number },
  ): Promise<EsitoSostituzione> {
    const oggi = toDateOnly();
    const giorno = await this.prisma.menuDay.findFirst({ where: { clientId, date: oggi } });
    if (!giorno) return { testo: testoChiediCibo([], await this.nomeDi(clientId)), esito: 'rifiutata' };

    const pasti = ((giorno.meals as unknown as MealSnapshot[]) ?? []).filter(Boolean);
    const slot = stato.slotPiatto;
    const indice = pasti.findIndex((m) => m.slot === slot);
    if (indice < 0) return { testo: testoAnnullato(await this.nomeDi(clientId)), esito: 'annullata' };

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
    // Anche il cambio di PIATTO nasce «da verificare», quindi merita lo stesso avviso del cambio di
    // ingrediente: è un piatto intero diverso da quello che il motore aveva composto.
    await this.avvisaDellaVerifica(
      clientId,
      `ha cambiato il piatto di ${etichettaSlot(prima.slot)}: «${prima.name}» → «${scelta.nome}»`,
      { slot: prima.slot, daNome: prima.name, aNome: scelta.nome, tipo: 'piatto' },
    );

    return {
      testo: testoCambioPiattoFatto(etichettaSlot(prima.slot), scelta, await this.nomeDi(clientId)),
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
