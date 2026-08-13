import { Injectable, Logger } from '@nestjs/common';
import { apriServeVisita } from '../clients/serve-visita';
import { AuditService } from '../audit/audit.service';
import { EU_ALLERGEN_CODES } from '../catalog/allergens';
import { NON_ALIMENTI, allergieDaCodificare, allergieDichiarate, intolleranzeDichiarate, INTOLLERANZA_IGNOTA } from '../common/allergie';
import { ProfiloDaValutare, motivoRicontatto } from '../common/da-ricontattare';
import { exclusionKeys } from '../menu/exclusions';
import { PrismaService } from '../prisma/prisma.service';
import {
  LetturaAllergie,
  MotivoDialogo,
  StatoAllergie,
  leggiAllergie,
  leggiConferma,
  testoConferma,
  testoDomanda,
  testoFatto,
  testoGiaAPosto,
  testoNonCapito,
  testoRiprova,
  testoToglieQualcosa,
} from './allergie-chat';

/** Cosa deve fare la chat con la risposta del flusso. Stessa forma di `EsitoDataInizio`. */
export interface EsitoAllergie {
  testo: string;
  /** Stato da appendere al `meta` del messaggio di Gaia. Assente = flusso chiuso. */
  stato?: StatoAllergie;
  /** Il flusso passa la mano a una persona. */
  inoltraA?: 'coach' | 'nutritionist';
  esito: 'aperto' | 'in_corso' | 'applicata' | 'arresa' | 'non_serve';
  /** Riepilogo di ciò che è stato scritto (per il `meta` e per l'audit). */
  applicata?: { motivo: MotivoDialogo; codici: string[]; libere: string[]; nessuna: boolean };
}

type Profilo = ProfiloDaValutare & { name?: string | null };

/**
 * I campi che questo dialogo scrive, e nessun altro. Tipizzati e non `Record<string, unknown>`
 * perché sono gli stessi su cui si verifica che non si stia togliendo niente: un campo scritto e
 * non verificato sarebbe esattamente il buco che questo controllo esiste per chiudere.
 */
interface DatiScritti {
  allergies?: string[];
  allergiesOther?: string[];
  allergieDichiarateIl?: Date;
  intolerances?: string[];
  intolerancesOther?: string[];
}

const CAMPI = {
  name: true,
  allergies: true,
  allergiesOther: true,
  allergieDichiarateIl: true,
  intolerances: true,
  intolerancesOther: true,
  onboardingCompletedAt: true,
} as const;

/**
 * LA RI-DOMANDA SULLE ALLERGIE (§7 dell'handoff `progetto/HANDOFF_Allergie_Intolleranze.md`).
 *
 * Il 13/8 la conta (`npm run conta:allergie`) ha detto **24 clienti su 48**. A metà di loro manca
 * un pezzo del dato con cui si decide cosa mettere nel piatto: o hanno un'intolleranza che non
 * sappiamo, o un'allergia scritta a mano che nessuno ha mai tradotto, o non hanno mai risposto
 * alla domanda. Questo servizio è la conversazione che chiude quel buco, una cliente per volta.
 *
 * ## Chi decide chi va chiamata: non questo file
 *
 * `common/da-ricontattare.ts`, la **stessa funzione** che le ha contate. Qui non c'è nessun
 * criterio, solo la sua risposta: uno script che si riscrive il criterio conta una popolazione e
 * poi la campagna ne contatta un'altra, e quella su cui si è deciso è la prima.
 *
 * ## Le tre cose che questo servizio non fa mai
 *
 * 1. **Non salva quello che ha scritto lei così com'è.** Si propone quello che si è capito, si fa
 *    confermare, e solo il confermato entra. Quello che non si riconosce va nel testo libero, dove
 *    lo vede la nutrizionista: `impara-dalla-chat.ts`, *nel dubbio non si impara*.
 * 2. ⚠️ **Non toglie niente.** Se la risposta di adesso lascerebbe scoperto qualcosa che prima
 *    veniva escluso, il dialogo si ferma e passa alla nutrizionista. Aggiungere un'allergia toglie
 *    un piatto; toglierne una lo rimette nel piatto di chi aveva detto di non poterlo mangiare. Le
 *    due cose non pesano uguale e non possono avere la stessa strada.
 * 3. **Non si fida dello stato appeso al messaggio.** Fra la proposta e il «sì» possono essere
 *    passate delle ore, e nel frattempo la nutrizionista può aver già codificato tutto dalla
 *    scheda. Si rilegge il profilo al momento di scrivere: lo stato appeso al messaggio è vecchio
 *    per definizione (`data-inizio-chat.service.ts:236-239`).
 *
 * ## Perché passa alla NUTRIZIONISTA e non alla coach
 *
 * L'handoff dice «due tentativi poi passa alla coach», che è il modo in cui è scritta la regola nel
 * dialogo della data di inizio. Qui il destinatario cambia, e non è un dettaglio di cortesia: il §5
 * dello stesso handoff stabilisce che le allergie le scrivono **solo** nutrizionista e capo
 * nutrizionista. Girare alla coach una richiesta che la coach non ha il permesso di soddisfare
 * vuol dire spostare il silenzio di una casella, non toglierlo.
 */
@Injectable()
export class AllergieChatService {
  private readonly logger = new Logger(AllergieChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Ingressi ----------

  /**
   * Apertura proattiva: è quella che parte quando la cliente tocca la notifica. Il motivo si
   * **rilegge dal profilo**, non si passa dalla notifica: fra l'invio e il tocco possono passare
   * giorni, e nel frattempo la nutrizionista può aver già sistemato tutto dalla scheda. Chiederle
   * una cosa che non serve più è il modo di insegnarle a ignorare le notifiche.
   */
  async apri(clientId: string): Promise<EsitoAllergie> {
    const profilo = await this.profiloDi(clientId);
    const motivo = profilo ? motivoRicontatto(profilo, EU_ALLERGEN_CODES) : null;
    if (!profilo || !motivo) {
      return { testo: testoGiaAPosto(profilo?.name ?? null), esito: 'non_serve' };
    }
    return {
      testo: testoDomanda(motivo, this.scritteAllora(motivo, profilo), profilo.name ?? null),
      stato: { passo: 'risposta', motivo, tentativi: 0 },
      esito: 'aperto',
    };
  }

  /** Passo successivo, a partire dallo stato appeso all'ultimo messaggio di Gaia. */
  async avanza(clientId: string, stato: StatoAllergie, testoCliente: string): Promise<EsitoAllergie> {
    const profilo = await this.profiloDi(clientId);
    const nome = profilo?.name ?? null;
    if (stato.passo === 'conferma') return this.passoConferma(clientId, stato, testoCliente, nome);
    return this.passoRisposta(clientId, stato, testoCliente, nome);
  }

  // ---------- Passi ----------

  private async passoRisposta(
    clientId: string,
    stato: StatoAllergie,
    testoCliente: string,
    nome: string | null,
  ): Promise<EsitoAllergie> {
    const lettura = leggiAllergie(testoCliente);
    if (lettura.vuota) {
      const tentativi = (stato.tentativi ?? 0) + 1;
      // Due tentativi e poi passa a una persona: insistere una terza volta su una risposta che non
      // si capisce è il modo di far scrivere alla nutrizionista *dopo* aver perso cinque minuti.
      if (tentativi >= 2) {
        return { testo: testoNonCapito(true), inoltraA: 'nutritionist', esito: 'arresa' };
      }
      return { testo: testoNonCapito(false), stato: { ...stato, tentativi }, esito: 'in_corso' };
    }
    return this.proponi(clientId, stato.motivo, lettura, nome, stato.tentativi ?? 0);
  }

  /**
   * La proposta. Prima di scriverla si guarda già se quella risposta **toglierebbe** qualcosa: è
   * meglio fermarsi adesso che far confermare una cosa che poi non si fa.
   */
  private async proponi(
    clientId: string,
    motivo: MotivoDialogo,
    lettura: LetturaAllergie,
    nome: string | null,
    tentativi: number,
  ): Promise<EsitoAllergie> {
    const profilo = await this.profiloDi(clientId);
    const perse = profilo ? this.cosaSiPerde(motivo, profilo, this.dati(motivo, profilo, lettura)) : [];
    if (perse.length) {
      return { testo: testoToglieQualcosa(perse, nome), inoltraA: 'nutritionist', esito: 'arresa' };
    }
    return {
      testo: testoConferma(motivo, lettura, nome),
      stato: {
        passo: 'conferma',
        motivo,
        codici: lettura.codici,
        libere: lettura.libere,
        nessuna: lettura.nessuna,
        tentativi,
      },
      esito: 'in_corso',
    };
  }

  private async passoConferma(
    clientId: string,
    stato: StatoAllergie,
    testoCliente: string,
    nome: string | null,
  ): Promise<EsitoAllergie> {
    const risposta = leggiConferma(testoCliente);
    if (risposta === true) return this.applica(clientId, stato, nome);

    if (risposta === false) {
      const tentativi = (stato.tentativi ?? 0) + 1;
      if (tentativi >= 2) {
        return { testo: testoNonCapito(true), inoltraA: 'nutritionist', esito: 'arresa' };
      }
      // Si torna alla domanda, non si insiste sulla stessa proposta: ha appena detto che quella
      // proposta è sbagliata, e ripeterla è l'unico modo sicuro di non ottenere niente.
      return {
        testo: testoRiprova(),
        stato: { passo: 'risposta', motivo: stato.motivo, tentativi },
        esito: 'in_corso',
      };
    }

    // Né sì né no: ha risposto con un ALTRO elenco («anche le noci»). È una correzione, non
    // un'incomprensione — trattarla come «non ho capito» la farebbe ripetere una cosa già detta.
    const altra = leggiAllergie(testoCliente);
    if (!altra.vuota) {
      return this.proponi(clientId, stato.motivo, altra, nome, stato.tentativi ?? 0);
    }

    const tentativi = (stato.tentativi ?? 0) + 1;
    if (tentativi >= 2) {
      return { testo: testoNonCapito(true), inoltraA: 'nutritionist', esito: 'arresa' };
    }
    return {
      testo: 'Non ho capito: è giusto così? Rispondi «sì» oppure «no», o rimettimi in fila quali sono.',
      stato: { ...stato, tentativi },
      esito: 'in_corso',
    };
  }

  // ---------- Scrittura ----------

  /**
   * ⚠️ Si rilegge TUTTO adesso. Fra la proposta e il «sì» può essere passata un'ora — o un giorno,
   * se il flusso è stato riaperto — e la nutrizionista può aver già codificato l'allergia dalla
   * scheda. Scrivere sopra quello che ha fatto lei, con quello che avevamo capito noi ieri, è
   * esattamente il modo in cui un dato sanitario torna indietro senza che nessuno lo veda.
   */
  private async applica(clientId: string, stato: StatoAllergie, nome: string | null): Promise<EsitoAllergie> {
    const profilo = await this.profiloDi(clientId);
    if (!profilo) return { testo: testoGiaAPosto(nome), esito: 'non_serve' };
    if (!motivoRicontatto(profilo, EU_ALLERGEN_CODES)) {
      return { testo: testoGiaAPosto(profilo.name ?? nome), esito: 'non_serve' };
    }

    const lettura: LetturaAllergie = {
      nessuna: stato.nessuna === true,
      codici: stato.codici ?? [],
      libere: stato.libere ?? [],
      vuota: false,
    };
    const dati = this.dati(stato.motivo, profilo, lettura);
    const perse = this.cosaSiPerde(stato.motivo, profilo, dati);
    if (perse.length) {
      return { testo: testoToglieQualcosa(perse, nome), inoltraA: 'nutritionist', esito: 'arresa' };
    }

    try {
      await this.scrivi(clientId, profilo, dati, stato.motivo, lettura);
      // «Serve la visita» (criteri Nocanty, Decisioni §15): la traduzione appena scritta è una
      // dichiarazione a tutti gli effetti. Se una valutazione clinica esiste già, non parte niente.
      await apriServeVisita(this.prisma, clientId, 'campagna-allergie');
    } catch (err) {
      /**
       * ⚠️ Un catch muto qui sarebbe un mistero: la cliente leggerebbe «fatto» e nel profilo non ci
       * sarebbe niente. Si scrive l'errore, e si passa alla nutrizionista dicendoglielo — perché su
       * un'allergia «non l'ho segnata» deve arrivare a una persona, non a un file di log.
       */
      this.logger.error(
        `Scrittura delle allergie dichiarate in chat non riuscita per ${clientId}`,
        err instanceof Error ? err.stack : String(err),
      );
      return { testo: testoNonCapito(true), inoltraA: 'nutritionist', esito: 'arresa' };
    }

    return {
      testo: testoFatto(stato.motivo, lettura, profilo.name ?? nome),
      esito: 'applicata',
      applicata: { motivo: stato.motivo, codici: lettura.codici, libere: lettura.libere, nessuna: lettura.nessuna },
    };
  }

  /**
   * LA SCRITTURA E LA SUA TRACCIA, INSIEME O NIENTE.
   *
   * È un dato sanitario: la riga di audit non è un di più che si può perdere per strada, è la sola
   * cosa che dice chi ha scritto quell'allergia e da dove. Quindi sta **dentro** la stessa
   * transazione del profilo, e non dopo come fa il resto del prodotto.
   *
   * ⚠️ È una deviazione voluta da `AuditService.log`, che gli errori se li ingoia di proposito
   * («la scrittura non deve MAI far fallire l'operazione principale»). Vale qui e non altrove
   * perché qui l'operazione principale può essere rifatta senza danno — Gaia richiede — mentre un
   * profilo sanitario cambiato senza traccia non si ricostruisce più.
   */
  private async scrivi(
    clientId: string,
    profilo: Profilo,
    dati: DatiScritti,
    motivo: MotivoDialogo,
    lettura: LetturaAllergie,
  ): Promise<void> {
    await this.prisma.$transaction([
      // `updateMany` e non `update`: se il profilo non ci fosse più, questa resta una conversazione
      // in chat e non deve esplodere addosso alla cliente.
      this.prisma.clientProfile.updateMany({ where: { userId: clientId }, data: dati as never }),
      this.prisma.auditLog.create({
        data: {
          action: 'chat.allergie.dichiarate',
          actorId: clientId,
          entityType: 'client_profile',
          entityId: clientId,
          metadata: {
            motivo,
            origine: 'chat',
            prima: {
              allergies: profilo.allergies ?? [],
              allergiesOther: profilo.allergiesOther ?? [],
              intolerances: profilo.intolerances ?? [],
              intolerancesOther: profilo.intolerancesOther ?? [],
            },
            dopo: dati,
            capito: { codici: lettura.codici, libere: lettura.libere, nessuna: lettura.nessuna },
          } as never,
        },
      }),
    ] as never);
  }

  /** Quello che finirà in banca dati. Si calcola PRIMA di proporre, perché è su questo che si
   * verifica che non si stia togliendo niente. */
  private dati(motivo: MotivoDialogo, profilo: Profilo, lettura: LetturaAllergie): DatiScritti {
    return motivo === 'intolleranza_ignota'
      ? this.datiIntolleranze(profilo, lettura)
      : this.datiAllergie(profilo, lettura);
  }

  /**
   * Le allergie dopo la risposta.
   *
   * I codici UE che aveva già **non si toccano**: su quelli non c'era nessuna domanda aperta, e
   * rimetterli in discussione perché stiamo parlando d'altro è il modo di perderli. Quello che la
   * risposta sostituisce è il **testo libero mai codificato** — che è precisamente la domanda che
   * le abbiamo fatto.
   */
  private datiAllergie(profilo: Profilo, lettura: LetturaAllergie): DatiScritti {
    const gia = (profilo.allergies ?? []).filter((a) => EU_ALLERGEN_CODES.includes(a));
    const scelte = [...gia, ...lettura.codici];
    const d = allergieDichiarate(scelte, lettura.libere, new Date());
    return {
      allergies: d.allergies,
      allergiesOther: d.allergiesOther,
      // ⚠️ Sempre valorizzata, anche quando l'elenco resta vuoto: è il senso stesso della colonna —
      // la domanda è stata fatta e ha avuto una risposta. `allergieDichiarate` la lascia `null` per
      // un invio vuoto del questionario, dove «vuoto» vuol dire «pagina saltata»; qui vuol dire
      // «me l'ha detto lei».
      allergieDichiarateIl: new Date(),
    };
  }

  /**
   * Le intolleranze dopo la risposta.
   *
   * ⚠️ Il caso che sembra una cancellazione e non lo è: se dice «nessuna», il flag `'other'` va
   * tolto. Non è togliere un'intolleranza — `'other'` non esclude niente e non ha mai escluso
   * niente: è un punto di domanda, ed è quello a cui ha appena risposto. Lasciarlo lì vorrebbe dire
   * tenere aperta per sempre una domanda a cui ha risposto, e ricontattarla tutti i mesi.
   */
  private datiIntolleranze(profilo: Profilo, lettura: LetturaAllergie): DatiScritti {
    const scelte = profilo.intolerances ?? [];
    if (lettura.nessuna) {
      return {
        intolerances: scelte.filter((v) => (v ?? '').toLowerCase() !== INTOLLERANZA_IGNOTA),
        intolerancesOther: profilo.intolerancesOther ?? [],
      };
    }
    // I codici riconosciuti entrano come parole del prodotto (`latte`, `frutta_a_guscio`): sono
    // tutte chiavi che `expandExclusion` sa aprire, quindi escludono davvero. Il testo libero entra
    // come l'ha detto lei, ed è quello che la nutrizionista poi guarda.
    const d = intolleranzeDichiarate(scelte, [...lettura.codici, ...lettura.libere]);
    return { intolerances: d.intolerances, intolerancesOther: d.intolerancesOther };
  }

  /**
   * ⚠️ COSA RESTEREBBE SCOPERTO. Il freno di questo dialogo.
   *
   * Non si confrontano gli elenchi — «fragole» contro «le fragole» sarebbe una perdita, e non lo
   * è — ma le **parole chiave con cui il motore esclude davvero** (`exclusionKeys`, la stessa
   * funzione del motore e della diagnostica). Una parola di prima è ancora coperta se una parola di
   * adesso ci sta dentro: chi esclude «fragole» esclude anche tutti i piatti che prima toglieva
   * «le fragole», e in più qualcuno.
   *
   * Quello che resta fuori è una cosa che la cliente aveva dichiarato e che da domani le
   * arriverebbe nel piatto. Lì Gaia si ferma.
   */
  private cosaSiPerde(motivo: MotivoDialogo, profilo: Profilo, dati: DatiScritti): string[] {
    const intolleranze = motivo === 'intolleranza_ignota';
    const prima = (intolleranze ? profilo.intolerances : profilo.allergies) ?? [];
    /**
     * ⚠️ Si confronta con quello che verrà SCRITTO, non con quello che ha detto adesso.
     *
     * Le due cose non coincidono, e la differenza è tutta a favore della cliente: i codici UE che
     * aveva già restano comunque (`datiAllergie` non li tocca). Confrontando con la sola frase di
     * adesso, chi ha «latte» dal questionario e ha scritto a mano «le fragole» si sentirebbe
     * rispondere «mi fermo, toglieresti il latte» per aver risposto **esattamente** alla domanda
     * che le abbiamo fatto.
     */
    const dopo = (intolleranze ? dati.intolerances : dati.allergies) ?? [];
    // I non-alimenti non sono una perdita: `'altro'`, `'other'`, `'nessuna'` sono flag
    // d'interfaccia finiti in banca dati, e mandarli via è il lavoro, non il danno.
    const vere = prima.filter((v) => v && !NON_ALIMENTI.has(v.toLowerCase()));
    if (!vere.length) return [];

    const chiaviDopo = [...exclusionKeys(dopo)];
    return vere.filter((v) => {
      const chiavi = [...exclusionKeys([v])];
      return !chiavi.every((k) => chiaviDopo.some((n) => k.includes(n)));
    });
  }

  // ---------- Lettura ----------

  /** Le parole che aveva scritto allora: si rileggono a lei, così sa cosa deve ridirmi. */
  private scritteAllora(motivo: MotivoDialogo, profilo: Profilo): string[] {
    if (motivo !== 'allergie_da_codificare') return [];
    return allergieDaCodificare(profilo.allergies, profilo.allergiesOther, EU_ALLERGEN_CODES);
  }

  private async profiloDi(clientId: string): Promise<Profilo | null> {
    try {
      return (await this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: CAMPI as never,
      })) as Profilo | null;
    } catch (err) {
      // Degradare in silenzio qui vorrebbe dire «non ha allergie» per un errore di rete.
      this.logger.error(
        `Profilo non letto per il dialogo allergie di ${clientId}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }
}
