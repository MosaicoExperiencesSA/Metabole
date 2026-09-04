/**
 * VERA CHE PARLA — il giro completo, dalla frase alla riga scritta.
 *
 * L'ordine non è negoziabile, ed è tutto il progetto in cinque righe:
 *
 *   1. **capisco** (deterministico, `capisci.ts`) — se non capisco lo dico;
 *   2. **chiedo** quello che non so: quale cliente, cosa vuol dire quella famiglia;
 *   3. **mostro** la regola tradotta e cosa comporta sul pool;
 *   4. **aspetto il sì**;
 *   5. **scrivo**, e lascio la riga nel registro con l'annulla.
 *
 * ⚠️ Non esiste una scorciatoia che salti il 3 e il 4. Nemmeno per le frasi facili, nemmeno per la
 * ventesima volta: il giorno in cui una scrittura passa senza anteprima è il giorno in cui il
 * registro smette di raccontare cosa è successo davvero.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { diceDiFermarsi, leggiCortesia, rispostaCortesia } from './cortesie';
import { TIPO_PROMEMORIA } from '../clients/promemoria-supervisione';
import { leggiDigiunoDettato } from './digiuno-dettato';
import { aGiorno, giornoItaliano } from '../common/date-only';
import { chiaveAlimento, combaciaAlimento, normalizza } from '../common/nomi-alimento';
import { spezzaTagAlimenti } from '../common/tag-alimenti';
import { filtroPerimetroSuCliente, perimetroClienti } from '../common/perimetro-clienti';
import { etichettaSlot } from '../common/slot-pasto';
import { registraSostituzione } from '../food-swaps/registra-sostituzione';
import { expandExclusion } from '../menu/exclusions';
/**
 * ⛔ **IL GIUDIZIO DI SICUREZZA È QUELLO DELLA GUARDIA** — 2/9, voce 953. La giornata dettata dalla
 * nutrizionista pescava dal pool e scriveva, senza chiamarlo: il pool filtra tre cose su cinque.
 */
import { esclusioniDi, valutaRicetta, type ProfiloConEsclusioni } from '../menu/esclusioni-della-cliente';
import { ValoriNutrizionaliService } from '../nutrient-facts/valori-nutrizionali.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { daScartare, capisci, esempioCorrezioneKcal, Intento, IntentoCambioDieta, IntentoDigiuno, IntentoCorrezioneKcal, IntentoGiornata, IntentoProteine, IntentoFamiglia, IntentoPasti, IntentoRestrizione, IntentoRicetta, IntentoSostituzione, separaCitazione,
  IntentoEquivalenza,
} from './capisci';
import { CAMPI_DEL_GIORNO, type CodaDaRifare, type GiornoDaValutare, codaDaRifare, daQuandoSiPuoRifare, giorniColpitiDaiVietati, laClienteLHaAperto, nonSappiamoSeLHaAperto, quanteDaRifare, ricetteDelGiorno } from './menu-da-rifare';
import { ricetteVietate } from './regola-dieta';
import { Spuntino, etichettaSpuntino, giorniColpitiDaiPasti, leggiQualeSpuntino, pastiDopo } from './togli-spuntino';
import { DizionarioService } from './dizionario.service';
import { conflittiDiPromozione, raccontaConflitti } from './conflitti-dizionario';
import {
  abbinaRighe,
  contaGiornata,
  leggiGiornataDettata,
  RicettaCandidata,
  RigaAbbinata,
  SceltaGiornata,
} from './giornata-dettata';
import { minimoDaPiuProteine, quotaProteicaMinima } from '../menu/correzione-kcal';
import { calcolaMacro, raccontaMacro, ValorePer100 } from './macro-da-ingredienti';
import { fraseSoloCotto, scegliPerRicetta } from '../nutrient-facts/stato-alimento';
import { PoolDisponibileService } from './pool-disponibile.service';
import { RegistroVeraService } from './registro.service';
import { cosaManca, leggiRicetta, RicettaDettata } from './ricetta-dettata';
import { RichiesteVeraService } from './richieste.service';
import { RicettaDaScrivere, SCRITTURA_RICETTA, ScritturaRicetta } from './scrittura-ricetta';
import { suggestAllergens } from '../catalog/allergens';
import { EsitoAllergeni, leggiAllergeni, raccontaScelti, raccontaSuggerimenti, Suggerimento } from './allergeni-ricetta';
import { etichettaDelMetodo, leggiMetodo, MODI_DA_DIRE } from './metodo-dettato';
import { SCRITTURA_SOSTITUZIONI, ScritturaSostituzioni } from './scrittura-sostituzioni';
import { leggiVerdetto, motivoDetto, raccontaSostituzione } from './verifica-sostituzioni';
import {
  contaCoda,
  costruisciCoda,
  chiaveVoce,
  fraseApertura,
  fraseApprovataCombinazione,
  fraseApprovataRicetta,
  fraseCodaFinita,
  fraseCodaVuotaApprovazioni,
  fraseInterrotta,
  fraseInvitoCoda,
  fraseLasciata,
  fraseNonScritta,
  fraseSaltata,
  fraseSparita,
  leggiRispostaApprovazione,
  testoVoce,
  type ContoCoda,
  type DietaInRevisione,
  type VoceDaApprovare,
} from './coda-approvazioni';
import { AZIONI as AZIONI_MOTORE, ETICHETTA_CAUSA, isCausa } from '../engine/causa-decisione';
import {
  azioniDi,
  descriviAzione,
  leggiIlNumero,
  numera,
  testoDellaLista,
  testoDepennata,
  tronca,
  type TipoVoce,
  type VoceDaFare,
} from './lista-della-mattina';
import { SCRITTURA_DECISIONE, ScritturaDecisione } from './scrittura-decisione';
import { pastiDellaFinestra, protocolloDigiuno } from '../menu/orologio-digiuno';
import { SCRITTURA_DIGIUNO, ScritturaDigiuno } from './scrittura-digiuno';
import { SCRITTURA_COMBINAZIONE, ScritturaCombinazione } from './scrittura-combinazione';
import {
  bastaPerScrivere,
  leggiEquivalenza,
  testoAnteprima,
  testoChiediAltri,
  testoChiediNome,
  testoFatto,
} from './equivalenza-dettata';
import { secondaLettura, secondaLetturaMetodo } from './seconda-lettura';
import { SCRITTURA_CLIENTE, SCRITTURA_KCAL, ScritturaCliente, ScritturaKcal } from './richieste.service';
import { chiudiSegnalazione, escalationIdDallaChiave, scriviAllaCliente, segnalazioneAncoraAperta } from './risposta-alla-cliente';
import {
  EsitoVera,
  etichettaAvviso,
  leggiAmbito,
  leggiConferma,
  leggiElenco,
  MAX_TENTATIVI,
  SCADENZA_VERA_MS,
  StatoVera,
  testi,
  estraiNome,
  nomeDettoEsplicitamente,
} from './vera-chat';

interface ClienteTrovata {
  id: string;
  nome: string;
  email: string;
}

/** Quanti alimenti si propongono quando si chiede «quali sono?». Oltre, l'elenco non si legge. */
const MAX_PROPOSTI = 20;

const logger = new Logger('VeraChat');

/** Da quante voci in su una categoria si spiega, e quante se ne mostrano. Pinnate da un test. */
const SPIEGA_DA = 3;
const SPIEGA_QUANTE = 6;

/** I tipi di notifica che il quadro della giornata conta già dalle tabelle di origine. */
const AVVISI_GIA_CONTATI = new Set(['vera_richiesta', 'vera_proposta_in_coda']);

/** Come si dicono i regimi in italiano: nell'anteprima si rilegge una frase, non un codice. */
const ETICHETTA_REGIME: Record<string, string> = {
  omnivore: 'onnivora',
  vegetarian: 'vegetariana',
  vegan: 'vegana',
};

@Injectable()
export class VeraChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dizionario: DizionarioService,
    private readonly pool: PoolDisponibileService,
    private readonly registro: RegistroVeraService,
    private readonly richieste: RichiesteVeraService,
    private readonly valori: ValoriNutrizionaliService,
    /**
     * Serve a UNA cosa: leggere il minimo proteico della dieta per mostrarlo in anteprima
     * («passa dal 20% al 30%»). Lo usa già `PoolDisponibileService` nello stesso modulo, quindi
     * non porta con sé niente di nuovo.
     */
    private readonly configParams: ConfigParamsService,
    @Inject(SCRITTURA_RICETTA) private readonly ricette: ScritturaRicetta,
    /**
     * La porta della SCHEDA per il cambio di dieta (azione 3, 14/8): stesso token delle risposte
     * alle richieste, per la stessa ragione — un punto di scrittura solo, coi suoi permessi
     * (`change_diet_type`) e la rierogazione dei giorni futuri già dentro.
     */
    @Inject(SCRITTURA_CLIENTE) private readonly clienti: ScritturaCliente,
    /**
     * La porta delle CALORIE scritte a mano (14/8): permesso, storico in `kcal_override`, rifiuto
     * sotto soglia e avviso ai capi stanno già lì. Rifarli qui sarebbe la seconda strada per lo
     * stesso dato clinico.
     */
    @Inject(SCRITTURA_KCAL) private readonly kcal: ScritturaKcal,
    /**
     * La porta delle SOSTITUZIONI (voce 245, 14/8): `FoodSwapsService.aggiorna`, cioè lo stesso
     * metodo del pulsante in scheda. A voce cambia **chi** lo chiama, non cosa succede.
     */
    @Inject(SCRITTURA_SOSTITUZIONI) private readonly sostituzioni: ScritturaSostituzioni,
    /**
     * LA SECONDA LETTURA (17/8): l'unico uso del modello dentro Vera, e traduce — non decide.
     * ⚠️ `generateJson` torna `null` su qualunque errore e non lancia, quindi qui non serve nessun
     * `try`: se il modello non c'è, si ricade sul «non ci arrivo» di prima.
     */
    private readonly ai: AiService,
    /**
     * La porta delle COMBINAZIONI (18/8): `EquivalenceService.approve`, lo stesso metodo del
     * pulsante in Equivalenze, con lo stesso audit e lo stesso bump di versione.
     */
    @Inject(SCRITTURA_COMBINAZIONE) private readonly combinazioni: ScritturaCombinazione,
    @Inject(SCRITTURA_DECISIONE) private readonly decisioni: ScritturaDecisione,
    /** ⛔ Le ore del digiuno (25/8): la porta che la regola della cliente promette. */
    @Inject(SCRITTURA_DIGIUNO) private readonly digiuno: ScritturaDigiuno,
  ) {}

  // ─────────────────────────────────────────────────────────────── ingressi ──

  /** Lo storico della conversazione. Il più vecchio per primo, come lo legge una persona. */
  async storico(nutrizionistaId: string, limite = 60) {
    const righe = await this.prisma.messaggioVera.findMany({
      where: { nutrizionistaId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limite, 200),
    });
    return (righe as { createdAt: Date }[]).slice().reverse();
  }

  /**
   * Apre la conversazione. Se non le ha mai chiesto come si chiama, glielo chiede adesso.
   *
   * ⚠️ È la prima cosa che l'agente impara da lei, e non è un vezzo: mette in chiaro fin dal primo
   * messaggio chi decide. Idempotente — riaprire la pagina non fa ripetere la presentazione.
   */
  async apri(nutrizionistaId: string) {
    const esistenti = await this.prisma.messaggioVera.count({ where: { nutrizionistaId } });
    if (esistenti === 0) {
      await this.scriviAgente(nutrizionistaId, testi.presentazione(), { passo: 'nome', frase: '' });
      return { messaggi: await this.storico(nutrizionistaId) };
    }
    /**
     * Al capo nutrizionista l'agente **porta la coda** quando apre la pagina, invece di aspettare
     * che se la vada a cercare. È il mestiere opposto: non scrive niente, sottopone.
     *
     * ⚠️ Solo se non c'è già un dialogo aperto: interrompere una conferma a metà per infilare una
     * proposta è il modo di far confermare la cosa sbagliata.
     */
    if (!(await this.statoAperto(nutrizionistaId))) {
      const prossima = await this.cosaTiPorto(nutrizionistaId);
      if (prossima) await this.scriviAgente(nutrizionistaId, prossima.testo, prossima.stato, { esito: prossima.esito });
    }
    return { messaggi: await this.storico(nutrizionistaId) };
  }

  /** Un messaggio della nutrizionista. Ritorna la risposta dell'agente. */
  async parla(nutrizionistaId: string, testo: string) {
    const frase = (testo ?? '').trim();
    if (!frase) return { messaggi: await this.storico(nutrizionistaId) };

    await this.prisma.messaggioVera.create({
      data: { nutrizionistaId, ruolo: 'nutrizionista', testo: frase } as never,
    });

    const aperto = await this.statoAperto(nutrizionistaId);
    const esito = aperto
      ? await this.avanza(nutrizionistaId, aperto, frase)
      : await this.nuovoGiro(nutrizionistaId, frase);

    await this.scriviAgente(nutrizionistaId, esito.testo, esito.stato, {
      esito: esito.esito,
      ...(esito.azioneId ? { azioneId: esito.azioneId } : {}),
    });
    return { messaggi: await this.storico(nutrizionistaId) };
  }

  // ───────────────────────────────────────────────────────────── il dialogo ──

  /**
   * ⚠️ `giaRiletta`: la seconda lettura si prova UNA volta per giro. Quando riesce si rientra qui con
   * la frase riscritta, e da lì il modello non si chiama più — altrimenti una riscrittura che
   * `capisci` capisce a metà potrebbe rimbalzare fra i due per sempre, spendendo a ogni rimbalzo.
   */
  private async nuovoGiro(nutrizionistaId: string, fraseIntera: string, giaRiletta = false): Promise<EsitoVera> {
    /**
     * ⚠️ PRIMA si separa quello che ha incollato, POI si capisce.
     *
     * Le azioni si eseguono solo da ciò che scrive lei di suo pugno. Se dentro il testo incollato
     * c'è qualcosa di azionabile lo si **dice** e ci si ferma: chi ha il potere di scrivere regole
     * su persone vere non deve poter essere comandato da un messaggio scritto da qualcun altro.
     */
    const { suo, citato } = separaCitazione(fraseIntera);
    const frase = suo || fraseIntera;
    if (citato && !capisci(suo) && capisci(citato)) {
      return { testo: testi.dallaCitazione(), esito: 'arresa' };
    }

    const intento = capisci(frase);
    if (!intento) {
      /**
       * ⚠️ IL BATTESIMO PRIMA DEL «NON CI ARRIVO» (13/8, screenshot di Simone). Lo stato «nome»
       * scade con la conversazione (`SCADENZA_VERA_MS`), quindi chi risponde alla domanda del nome
       * sei ore dopo cadeva qui — «Ciao ti chiamerò Vera» → «non ci arrivo» — e il battesimo
       * diventava irraggiungibile per sempre. La condizione giusta non è lo stato appeso al
       * messaggio: è il dato (`nomeAgente` vuoto). `estraiNome` non indovina, quindi una frase
       * qualunque non diventa un nome per sbaglio.
       */
      if ((await this.senzaNome(nutrizionistaId)) && estraiNome(frase)) {
        return this.impostaNome(nutrizionistaId, frase);
      }
      /**
       * ⛔ **LE CORTESIE — «ok», «ok ciao», «grazie», «Quale?», «annulla tutto» con niente in corso.**
       *
       * Quattro delle venticinque frasi non capite in novanta giorni erano queste. ⚠️ Sembrano le
       * meno importanti e sono quelle che fanno sembrare l'agente stupido: *«ok» che riceve «non ci
       * arrivo» è la risposta che una persona racconta agli altri.*
       *
       * ⚠️ **Sta qui, in questo ramo, e non in `capisci`**: questo è il punto in cui si sa che
       * **non c'è niente in sospeso**. Durante una conferma «ok» vuol dire **sì** e lo legge
       * `leggiConferma` — leggerlo come cortesia là vorrebbe dire buttare via una conferma in
       * silenzio, cioè una regola che la nutrizionista crede scritta e non lo è.
       *
       * ⚠️ E sta **prima** della coda del capo e della seconda lettura, come già faceva «annulla»,
       * per la ragione scritta lì sotto: sono risposte **certe** a frasi che `capisci` non
       * riconosce, e niente di incerto deve passargli davanti.
       *
       * ⛔ **«Annulla» resta una regola A PARTE, e più larga.** Vale **ovunque** nella frase, perché
       * chi lo scrive vuole che ci si fermi qualunque cosa venga dopo — la frase vera che l'ha
       * insegnato è «lascia stare, ti chiamo Lucia», che whole-phrase sarebbe scivolata fino a far
       * proporre a Vera di ribattezzarsi. Le cortesie invece si riconoscono **solo da sole**: «ok»
       * dentro «ok togli il tonno» è un intercalare, e prenderlo vorrebbe dire mangiarsi
       * l'istruzione. Le due regole stanno **nello stesso modulo**, vicine, coi loro perché.
       */
      if (diceDiFermarsi(frase)) return { testo: testi.nienteDaAnnullare(), esito: 'in_corso' };
      const cortesia = leggiCortesia(frase);
      if (cortesia) return { testo: rispostaCortesia(cortesia), esito: 'in_corso' };
      // Il capo che scrive «cosa c'è da vedere?» non sta dettando una regola: sta chiedendo la coda.
      // Si prova quella PRIMA di rispondere «non ho capito», che sarebbe vero e inutile.
      const prossima = await this.cosaTiPorto(nutrizionistaId);
      if (prossima) return prossima;
      /**
       * ⛔ **E SE IL NOME CE L'HO GIÀ, lo dico** (31/8). La condizione del battesimo è sui dati,
       * quindi a nome fatto le stesse frasi — «ti voglio chiamare Vera», «da oggi sei Vera» —
       * scivolavano fino a «non ci arrivo»: una risposta che dà della stupida a chi ha scritto una
       * frase chiarissima, e nel punto in cui si decide se fidarsi.
       *
       * ⚠️ Sta **qui**, dopo «annulla» e dopo la coda del capo, per la stessa ragione per cui la
       * seconda lettura sta in fondo: quelle sono risposte **certe** a frasi che `capisci` non
       * riconosce, e un riconoscimento di nome — che resta un indovinello su una parola — non deve
       * passare davanti a niente di certo. La prima stesura lo metteva davanti a tutte e tre, e in
       * revisione «lascia stare, ti chiamo dopo» finiva a proporre di chiamarsi «dopo».
       *
       * ⚠️ E vale **solo la forma esplicita con un nome proprio**: col nome secco una cortesia come
       * «grazie» diventerebbe la proposta di ribattezzarsi «grazie».
       */
      const proposto = nomeDettoEsplicitamente(frase, true);
      const attuale = proposto ? await this.nomeAttuale(nutrizionistaId) : null;
      if (proposto && attuale) {
        if (proposto.toLowerCase() === attuale.toLowerCase()) {
          return { testo: testi.restoCosi(attuale), esito: 'in_corso' };
        }
        return {
          testo: testi.giaMiChiamo(attuale, proposto),
          esito: 'in_corso',
          stato: { passo: 'cambio_nome', frase, nomeProposto: proposto },
        };
      }
      /**
       * ⚠️ LA SECONDA LETTURA — l'ULTIMA cosa che si prova, e per costruzione.
       *
       * Sta qui in fondo, dopo il battesimo, dopo «annulla» e dopo la coda del capo, perché tutte
       * quelle sono risposte **certe** a frasi che `capisci` non riconosce: una traduzione non deve
       * poter passare davanti a qualcosa che sappiamo già leggere. E sta prima del «non ci arrivo»
       * perché è esattamente il giro che oggi va perso — quindi il modello si paga solo là.
       *
       * Il modello **traduce**: a decidere resta `capisci`, che rilegge la frase riscritta con le
       * sue forme e i suoi test. Se non passa da lì, qui sotto si dice «non ci arrivo» come sempre.
       */
      const riletta = giaRiletta ? null : await this.provaSecondaLettura(frase);
      if (riletta) {
        const esito = await this.nuovoGiro(nutrizionistaId, riletta, true);
        /**
         * ⚠️ SI MOSTRA LA FRASE, non solo l'intento. «ceci → fagioli» non fa vedere che il modello
         * ha aggiunto qualcosa; la frase sì. Va davanti all'anteprima, che è il punto in cui una
         * traduzione sbagliata si legge e si ferma — e niente è ancora stato scritto.
         */
        return { ...esito, testo: `${testi.hoLettoCosi(riletta)}\n\n${esito.testo}` };
      }
      return { testo: testi.nonCapito(1), esito: 'non_capito', stato: { passo: 'conferma', frase, tentativi: 1 } };
    }
    if (intento.tipo === 'fuori_portata' && intento.cosa === 'chiudi_segnalazione') {
      // ⚠️ Non si scrive niente e non si apre nessuna pratica: una segnalazione chiusa senza il
      // motivo di chi l'ha chiusa vale meno di una lasciata aperta. Si dice cosa si è capito e dove
      // si fa — un clic nella coda che lei ha già.
      return { testo: testi.chiusuraSegnalazione(intento.dettaglio), esito: 'non_capito' };
    }
    if (intento.tipo === 'fuori_portata' && intento.cosa === 'voce_di_lista') {
      // ⚠️ Stessa ragione del piatto: non si apre una pratica per una cosa che si fa parlando con
      // Vera stessa. Qui la strada esiste già ed è la frase che Vera suggerisce quando mostra una
      // lista — ripeterla è la risposta, non un ripiego.
      return { testo: testi.voceDiLista(intento.dettaglio), esito: 'non_capito' };
    }
    if (intento.tipo === 'fuori_portata' && intento.cosa === 'ricetta_nel_menu') {
      /**
       * ⛔ **UN PIATTO NON SI METTE IN CODA AL CAPO: si dice dove si fa.**
       *
       * La regola su un tipo di dieta nasce come proposta perché cambia il menu di **centinaia** di
       * clienti. Cambiare un piatto nel menu di una persona è il contrario: è un gesto piccolo, su
       * una schermata che **esiste già** — «Menu a mano», nella scheda della cliente — e che chi ha
       * scritto la frase sa usare.
       *
       * ⚠️ Aprire una pratica per una cosa che si fa in trenta secondi non è prudenza: è una riga in
       * più in una coda che qualcuno deve svuotare, e una risposta che sposta il lavoro invece di
       * indicarlo. ⛔ E soprattutto **non si scrive niente**: fino a ieri questa frase diventava una
       * regola su un alimento chiamato «ricetta Pasta al pomodoro», che non esiste.
       */
      return {
        testo: testi.piattoNonAlimento(intento.dettaglio),
        esito: 'non_capito',
      };
    }
    if (intento.tipo === 'fuori_portata') {
      /**
       * ⚠️ Non si ripiega su «allora lo faccio sulla cliente»: fare la cosa sbagliata con sicurezza
       * è peggio che non farla. Ma nemmeno si butta via: quello che ha detto **va in coda al capo**
       * come proposta, con la sua frase originale.
       *
       * È il modo onesto di dire «non lo so ancora fare»: la richiesta non si perde, e chi ha il
       * potere di eseguirla la vede. Una regola su un tipo di dieta cambia il menu di centinaia di
       * clienti — che nasca come proposta e non come azione è la stessa scelta di tutto il resto.
       */
      const riga = (await this.registro.scrivi({
        nutrizionistaId,
        frase,
        azione: 'regola_dieta',
        ambito: 'dieta',
        soggettoTipo: 'diet',
        soggettoNome: intento.dettaglio,
        dettaglio: { daFareAMano: true, cosa: intento.cosa, testo: intento.dettaglio },
        inApprovazione: true,
      })) as { id: string };
      return {
        testo: `${testi.fuoriPortata(intento.dettaglio)}\n\n${testi.messaInCoda()}`,
        esito: 'in_approvazione',
        azioneId: riga.id,
      };
    }
    if (intento.tipo === 'lista') return this.mostraLista(nutrizionistaId);
    if (intento.tipo === 'segnalazioni') return this.guidaGiornata(nutrizionistaId);
    if (intento.tipo === 'approvazioni') return this.avviaApprovazioni();
    if (intento.tipo === 'sostituzioni') {
      return (await this.prossimaSostituzione(nutrizionistaId)) ?? { testo: testi.nessunCambioDaVerificare(), esito: 'in_corso' };
    }
    if (intento.tipo === 'famiglia') return this.famigliaASecco(nutrizionistaId, intento, frase);
    if (intento.tipo === 'ricetta') return this.avviaRicetta(nutrizionistaId, intento, frase);
    /**
     * ⚠️ L'EQUIVALENZA NON HA UNA CLIENTE, e va intercettata **prima** della riga qui sotto che
     * chiede «di chi stiamo parlando?»: un gruppo di equivalenza vale per tutte, e mandarlo a
     * `risolviCliente` chiederebbe un nome che non esiste. ⚠️ Questo ordine conta davvero — quello
     * rispetto a `daScartare`, in `capisci.ts`, credevo contasse e non contava: vedi il commento lì.
     */
    if (intento.tipo === 'equivalenza') return this.avviaEquivalenza(intento);
    return this.risolviCliente(nutrizionistaId, { passo: 'quale_cliente', frase, intento }, intento.cliente ?? '');
  }

  private async avanza(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    switch (stato.passo) {
      case 'nome':
        return this.impostaNome(nutrizionistaId, frase);
      case 'quale_cliente':
        return this.risolviCliente(nutrizionistaId, stato, frase);
      case 'quale_famiglia':
        return this.imparaFamiglia(nutrizionistaId, stato, frase);
      case 'equivalenza_alimenti':
        return this.equivalenzaAlimenti(stato, frase);
      case 'equivalenza_nome':
        return this.equivalenzaNome(stato, frase);
      case 'equivalenza_conferma':
        return this.equivalenzaScrivi(nutrizionistaId, stato, frase);
      case 'lista_aperta':
        return this.listaScegli(nutrizionistaId, stato, frase);
      case 'lista_voce':
        return this.listaAzione(nutrizionistaId, stato, frase);
      case 'quale_spuntino':
        return this.scegliSpuntino(nutrizionistaId, stato, frase);
      case 'ambito':
        return this.chiudiConAmbito(nutrizionistaId, stato, frase);
      case 'revisione':
        return this.decidiProposta(nutrizionistaId, stato, frase);
      case 'motivo_rifiuto':
        return this.respingiConMotivo(nutrizionistaId, stato, frase);
      case 'richiesta':
        return this.rispondiARichiesta(nutrizionistaId, stato, frase);
      case 'richiesta_generale':
        return this.valePerTutte(nutrizionistaId, stato, frase);
      case 'aggiorna_famiglia':
        return this.allargaFamiglia(nutrizionistaId, stato, frase);
      case 'ricetta_quale':
        return this.scegliRicetta(nutrizionistaId, stato, frase);
      case 'ricetta_testo':
        return this.leggiLaRicetta(nutrizionistaId, stato, frase);
      case 'ricetta_metodo':
        return this.leggiIlMetodo(nutrizionistaId, stato, frase);
      case 'ricetta_allergeni':
        return this.leggiGliAllergeniDellaNuova(nutrizionistaId, stato, frase);
      case 'ricetta_conferma':
        return this.scriviLaRicetta(nutrizionistaId, stato, frase);
      case 'giornata_scelte':
        return this.scegliPiattoGiornata(nutrizionistaId, stato, frase);
      case 'quanti_giorni':
        return this.leggiQuantiGiorni(nutrizionistaId, stato, frase);
      case 'cambio_nome':
        return this.confermaCambioNome(nutrizionistaId, stato, frase);
      case 'risposta_o_regola':
        return this.scegliRispostaORegola(nutrizionistaId, stato, frase);
      case 'risposta_cliente':
        return this.rispondiAllaGirata(nutrizionistaId, stato, frase);
      case 'promemoria_supervisione':
        return this.promemoriaVisto(nutrizionistaId, stato);
      case 'quale_digiuno':
        return this.scegliDigiuno(nutrizionistaId, stato, frase);
      case 'approvazione':
        return this.rispostaApprovazione(nutrizionistaId, stato, frase);
      case 'verifica_cambio':
        return this.verdettoSostituzione(nutrizionistaId, stato, frase);
      case 'allergeni_ricetta':
        return this.rispondiAllergeni(nutrizionistaId, stato, frase);
      case 'allergeni_conferma':
        return this.confermaAllergeni(nutrizionistaId, stato, frase);
      case 'quale_dieta':
        return this.scegliDieta(nutrizionistaId, stato, frase);
      case 'da_quando':
        return this.leggiDaQuando(nutrizionistaId, stato, frase);
      case 'conferma':
      default:
        return this.confermaOAnnulla(nutrizionistaId, stato, frase);
    }
  }

  // ──────────────────────────────────────────────────────────────── il nome ──

  private async impostaNome(nutrizionistaId: string, frase: string): Promise<EsitoVera> {
    /**
     * ⚠️ Non più la prima parola (13/8: «Ciao ti chiamerò Vera» sarebbe diventato «Ciao»).
     * `estraiNome` accetta solo forme esplicite, il nome secco, o «scegli tu» — e su tutto il
     * resto NON indovina.
     */
    const esito = estraiNome(frase);
    if (!esito) {
      // Se invece è una frase di lavoro, il battesimo non la tiene in ostaggio: si lavora.
      if (capisci(frase)) return this.nuovoGiro(nutrizionistaId, frase);
      return { testo: testi.nomeNonCapito(), esito: 'in_corso', stato: { passo: 'nome', frase: '' } };
    }
    return this.salvaNome(nutrizionistaId, esito.tipo === 'scegli_tu' ? 'Vera' : esito.nome);
  }

  /**
   * «Mi chiamo già X: lo cambio in Y?».
   *
   * ⚠️ Un «no» qui non è un fallimento: è una risposta. E se non si capisce nemmeno questa, si
   * lascia perdere il nome e si prova a lavorare sulla frase — dal passo si esce.
   */
  private async confermaCambioNome(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const attuale = (await this.nomeAttuale(nutrizionistaId)) ?? 'come prima';
    /**
     * ⛔ Senza il nome proposto non c'è niente da confermare, e **non si torna al battesimo**: la
     * prima stesura passava da `impostaNome` con una frase finta («ti chiamo ») che nessuno sapeva
     * leggere, e da lì si finiva al passo `nome` — dove vale il nome secco, cioè dove «grazie»
     * riscrive `nomeAgente`. Due turni per riaprire la porta che questo ramo esiste per chiudere.
     */
    if (!stato.nomeProposto) return { testo: testi.restoCosi(attuale), esito: 'in_corso' };
    const scelta = leggiConferma(frase);
    // ⚠️ Si salva il nome che abbiamo in mano: niente frase finta da rileggere.
    if (scelta === true) return this.salvaNome(nutrizionistaId, stato.nomeProposto);
    if (scelta === false) return { testo: testi.restoCosi(attuale), esito: 'in_corso' };
    if (capisci(frase)) return this.nuovoGiro(nutrizionistaId, frase);
    /**
     * ⚠️ **E dal passo si esce anche non capendo**: come ogni altro giro, al secondo tentativo si
     * smette di chiedere. Un nome non vale una chat bloccata.
     */
    const tentativi = (stato.tentativi ?? 1) + 1;
    if (tentativi > MAX_TENTATIVI) return { testo: testi.restoCosi(attuale), esito: 'in_corso' };
    return { testo: testi.giaMiChiamo(attuale, stato.nomeProposto), esito: 'in_corso', stato: { ...stato, tentativi } };
  }

  /** Scrive il nome dell'agente. È l'unico punto che tocca `nomeAgente`. */
  private async salvaNome(nutrizionistaId: string, nome: string): Promise<EsitoVera> {
    await this.prisma.staff.updateMany({
      where: { userId: nutrizionistaId } as never,
      data: { nomeAgente: nome } as never,
    });
    return { testo: testi.nomePreso(nome), esito: 'in_corso' };
  }

  /** Come mi chiamo adesso, o `null` se il battesimo non è ancora avvenuto. */
  private async nomeAttuale(nutrizionistaId: string): Promise<string | null> {
    const s = (await this.prisma.staff.findFirst({
      where: { userId: nutrizionistaId } as never,
      select: { nomeAgente: true } as never,
    })) as { nomeAgente: string | null } | null;
    return s?.nomeAgente ?? null;
  }

  /** Il battesimo è una CONDIZIONE SUI DATI, non uno stato: finché il nome non c'è, resta aperto. */
  private async senzaNome(nutrizionistaId: string): Promise<boolean> {
    const s = (await this.prisma.staff.findFirst({
      where: { userId: nutrizionistaId } as never,
      select: { nomeAgente: true } as never,
    })) as { nomeAgente: string | null } | null;
    return !s?.nomeAgente;
  }

  // ────────────────────────────────────────────────────────────── la cliente ─

  /**
   * Chi è la persona di cui sta parlando.
   *
   * ⚠️ Non si indovina MAI. Zero risultati → lo dico; più d'uno → chiedo cognome o email. Attribuire
   * una regola alla persona sbagliata è l'errore che questo strumento può fare più facilmente, ed è
   * anche quello che nessuno rileggerebbe.
   */
  private async risolviCliente(nutrizionistaId: string, stato: StatoVera, ricerca: string): Promise<EsitoVera> {
    const q = (ricerca ?? '').trim();
    if (!q) return { testo: testi.chiediCliente(), esito: 'in_corso', stato: { ...stato, passo: 'quale_cliente' } };

    const trovate = await this.cercaClienti(nutrizionistaId, q);
    if (trovate.length === 0) {
      /**
       * ⚠️ LA VIA D'USCITA DAL PASSO — screenshot di Simone, 17/8.
       *
       * Alle 11:02 Vera chiede «su quale cliente?». Da lì in poi **ogni** messaggio finiva qui
       * dentro come se fosse un nome: l'istruzione riscritta per intero («a Jolanda Todde non darle
       * più i ceci» → «non trovo nessuna cliente che si chiami "a Jolanda Todde non darle più i
       * ceci"») e, quarantacinque minuti dopo, perfino una domanda su un'altra cosa.
       *
       * Il difetto non è il riconoscimento del nome: è che **dal passo non si esce**. Una domanda
       * chiusa che non ammette nessun'altra risposta trasforma un fraintendimento di un minuto in
       * una chat inutilizzabile, e chi ci sta dentro non ha modo di capire cosa fare.
       *
       * ⚠️ La ricerca fra le clienti resta PRIMA: una cliente vera vince sempre su una rilettura.
       * Si rilegge solo quando non c'è nessuna, cioè quando la risposta di adesso sarebbe comunque
       * «non trovo nessuno» — e allora provare a capire la frase non toglie niente a nessuno.
       *
       * ⚠️ E se la rilettura non capisce, si dice «non trovo» come prima: non si indovina, e il
       * passo resta aperto. Un giro solo, quindi nessun rimbalzo: `nuovoGiro` che ritorna qui lo fa
       * con il NOME estratto, e su un nome `capisci` non riconosce nessun intento.
       */
      const riletta = capisci(q);
      if (riletta) return this.nuovoGiro(nutrizionistaId, q);
      return { testo: testi.nessunCliente(q), esito: 'in_corso', stato: { ...stato, passo: 'quale_cliente' } };
    }
    if (trovate.length > 1) {
      return {
        testo: testi.omonimie(q, trovate.length),
        esito: 'in_corso',
        stato: { ...stato, passo: 'quale_cliente', candidati: trovate },
      };
    }
    const cliente = trovate[0];
    return this.preparaAnteprima(nutrizionistaId, {
      ...stato,
      clienteId: cliente.id,
      clienteNome: cliente.nome,
    });
  }

  private async cercaClienti(nutrizionistaId: string, q: string): Promise<ClienteTrovata[]> {
    const perimetro = await perimetroClienti(this.prisma, nutrizionistaId);
    const parole = q.split(/\s+/).filter((p) => p.length >= 2);
    if (!parole.length) return [];

    // Ogni parola deve combaciare da qualche parte: «Rossi Giulia» e «Giulia Rossi» devono trovare
    // la stessa persona, e l'ordine in cui si scrive un nome non è un'informazione.
    const where = {
      role: 'client',
      deletedAt: null,
      ...(perimetro ? { clientProfile: { [perimetro.field]: { in: perimetro.staffIds } } } : {}),
      AND: parole.map((p) => ({
        OR: [
          { firstName: { contains: p, mode: 'insensitive' } },
          { lastName: { contains: p, mode: 'insensitive' } },
          { email: { contains: p, mode: 'insensitive' } },
          { clientProfile: { name: { contains: p, mode: 'insensitive' } } },
        ],
      })),
    };

    const righe = (await this.prisma.user.findMany({
      where: where as never,
      select: { id: true, email: true, firstName: true, lastName: true, clientProfile: { select: { name: true } } },
      take: 20,
    })) as { id: string; email: string; firstName: string | null; lastName: string | null; clientProfile: { name: string | null } | null }[];

    return righe.map((r) => ({
      id: r.id,
      nome: [r.firstName, r.lastName].filter(Boolean).join(' ') || r.clientProfile?.name || r.email,
      email: r.email,
    }));
  }

  // ─────────────────────────────────────────────────────────── il dizionario ─

  /**
   * Le famiglie nominate che il catalogo non conosce, in ordine.
   * La prima che non so la chiedo; le altre restano in coda, una alla volta.
   */
  private async famiglieSconosciute(nutrizionistaId: string, termini: string[]): Promise<string[]> {
    const fuori: string[] = [];
    for (const t of termini) {
      const espanso = expandExclusion(t);
      // `expandExclusion` restituisce più del termine solo se la mappa lo conosce: è la stessa
      // verità che usa il motore, quindi ciò che passa di lì non va chiesto a lei.
      if (espanso.length > 1) continue;
      if (await this.dizionario.risolvi(nutrizionistaId, t)) continue;
      // Un alimento singolo che esiste in catalogo non è una famiglia: non si chiede niente.
      if (await this.esisteInCatalogo(t)) continue;
      fuori.push(t);
    }
    return fuori;
  }

  private async esisteInCatalogo(alimento: string): Promise<boolean> {
    const chiave = chiaveAlimento(alimento);
    if (!chiave) return false;
    const n = await this.prisma.recipe.count({
      where: { name: { contains: alimento, mode: 'insensitive' } } as never,
    });
    return n > 0;
  }

  /** Gli alimenti da proporre per una famiglia sconosciuta. Presi dal catalogo, mai inventati. */
  private async alimentiProposti(famiglia: string): Promise<string[]> {
    const ricette = (await this.prisma.recipe.findMany({
      where: { active: true } as never,
      select: { ingredients: true },
      take: 400,
    })) as { ingredients: unknown }[];

    const visti = new Map<string, string>();
    for (const r of ricette) {
      for (const ing of ((r.ingredients as { name?: string }[]) ?? [])) {
        const nome = (ing?.name ?? '').trim();
        if (!nome) continue;
        // Si propongono gli ingredienti che condividono una parola con la famiglia: «formaggi
        // molli» pesca «formaggio spalmabile». Non pesca la mozzarella — e va bene così: proporre
        // troppo insegna a rispondere di no senza leggere, che è peggio che proporre poco.
        if (!combaciaAlimento(nome, famiglia) && !famiglia.split(/\s+/).some((p) => combaciaAlimento(nome, p))) continue;
        const k = chiaveAlimento(nome);
        if (k && !visti.has(k)) visti.set(k, nome);
      }
    }
    return [...visti.values()].slice(0, MAX_PROPOSTI);
  }

  /**
   * LA FAMIGLIA CHIESTA A SECCO (Nocanty, 13/8 17:47): «hai la lista dei formaggi molli?»,
   * «crea la lista». Riusa il flusso d'apprendimento delle regole (`quale_famiglia`), ma quando
   * l'elenco arriva si chiude lì: nessuna anteprima, nessuna cliente — era una voce di dizionario.
   */
  private async famigliaASecco(nutrizionistaId: string, intento: IntentoFamiglia, frase: string): Promise<EsitoVera> {
    const nome = intento.nome;
    const voce = await this.dizionario.risolvi(nutrizionistaId, nome);
    if (voce && intento.azione === 'mostra') {
      return {
        testo:
          `«${nome}» per me ${voce.membri.length === 1 ? 'è' : 'sono'}: ${voce.membri.join(', ')}.\n\n` +
          `Se va corretta, dimmi «rifai la lista dei ${nome}» e me la ridetti.`,
        esito: 'in_corso',
      };
    }
    const proposti = await this.alimentiProposti(nome);
    const testa = voce
      ? `«${nome}» oggi per me sono: ${voce.membri.join(', ')}. Dimmi l'elenco NUOVO, separato da virgola — sostituisce quello vecchio.`
      : intento.azione === 'mostra'
        ? `«${nome}» non la conosco ancora. Se me la insegni adesso, la uso da subito.\n\n${testi.chiediFamiglia(nome, proposti)}`
        : testi.chiediFamiglia(nome, proposti);
    return {
      testo: testa,
      esito: 'in_corso',
      stato: { passo: 'quale_famiglia', frase, intento, famiglia: nome, proposti, famiglieDaChiedere: [nome] },
    };
  }

  private async imparaFamiglia(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const membri = leggiElenco(frase);
    const famiglia = stato.famiglia ?? '';
    if (!membri.length) {
      return {
        testo: testi.chiediFamiglia(famiglia, stato.proposti ?? []),
        esito: 'in_corso',
        stato,
      };
    }
    await this.dizionario.insegna(nutrizionistaId, { nome: famiglia, membri });
    // La famiglia imparata A SECCO si chiude qui: non c'era nessuna regola in corso.
    if ((stato.intento as Intento | undefined)?.tipo === 'famiglia') {
      return {
        testo: `${testi.famigliaImparata(famiglia, membri)}\n\nDa adesso, quando la nomini in una regola, uso questo elenco.`,
        esito: 'in_corso',
      };
    }
    const restanti = (stato.famiglieDaChiedere ?? []).filter((f) => f !== famiglia);
    const prossima = await this.preparaAnteprima(nutrizionistaId, { ...stato, famiglieDaChiedere: restanti });
    return { ...prossima, testo: `${testi.famigliaImparata(famiglia, membri)}\n\n${prossima.testo}` };
  }


  // ─────────────────────────────────────────────────────────────── le ricette ─

  /**
   * AZIONI 4 e 5 — la ricetta nuova e la ricetta cambiata.
   *
   * Le due strade non finiscono allo stesso posto, e la differenza è il punto di tutto:
   *
   * | | cosa succede al sì | perché |
   * |---|---|---|
   * | **nuova** | si scrive in catalogo **spenta** (`active: false`) + proposta in coda | una ricetta spenta non tocca nessuno: esiste, si legge, si corregge |
   * | **cambiata** | **non si tocca niente**: va tutto nella proposta | quella ricetta è già nei piatti di oggi, e una modifica applicata subito li cambia stanotte |
   *
   * ⚠️ Questa asimmetria è voluta e va tenuta: la tentazione è «facciamo uguale», cioè scrivere
   * anche la modifica come bozza. Ma una bozza-copia di una ricetta viva vuol dire due ricette con
   * lo stesso nome, di cui una sbagliata, e nessuno che sappia quale sta andando nei piatti.
   */
  /**
   * «AGGIUNGI UN'EQUIVALENZA» — il gruppo che dice al motore quali alimenti può scambiare (19/8).
   *
   * ⚠️ Tre passi e non uno, per la stessa ragione delle ricette: **il nome non si inventa** e la
   * conferma si chiede. «Equivalenza 1» non dice niente a chi la rilegge fra un mese, e un gruppo
   * scritto senza rileggerlo è una regola del motore nata da una frase battuta di fretta.
   */
  private async avviaEquivalenza(intento: IntentoEquivalenza): Promise<EsitoVera> {
    const letta = { alimenti: intento.alimenti, nome: intento.nome };
    if (!bastaPerScrivere(letta)) {
      return {
        testo: testoChiediAltri(letta),
        esito: 'in_corso',
        stato: { passo: 'equivalenza_alimenti', frase: '', equivalenzaAlimenti: letta.alimenti },
      };
    }
    return {
      testo: testoChiediNome(letta),
      esito: 'in_corso',
      stato: { passo: 'equivalenza_nome', frase: '', equivalenzaAlimenti: letta.alimenti },
    };
  }

  /** Gli alimenti arrivati al secondo giro: si aggiungono a quelli già detti, non li sostituiscono. */
  private async equivalenzaAlimenti(stato: StatoVera, frase: string): Promise<EsitoVera> {
    /**
     * ⚠️ **SI DEVE POTER USCIRE, E «ANNULLA» NON È UN ALIMENTO.** Trovato dalla revisione del 19/8
     * sera: la sequenza «aggiungi equivalenza» → «annulla» → «lascia stare» → «non lo so» → «sì»
     * creava un gruppo di equivalenza in bozza chiamato **«non lo so»** con dentro **«annulla»** e
     * **«lascia stare»**, con tanto di notifica ai capi nutrizionisti. Le parole con cui si cerca di
     * uscire non possono diventare dati.
     */
    if (VeraChatService.USCITE.test((frase ?? '').trim())) return { testo: testi.annullato(), esito: 'annullata' };
    const letta = leggiEquivalenza(`aggiungi equivalenza: ${frase}`) ?? { alimenti: [], nome: null };
    // ⚠️ Si UNISCE a quello che aveva già detto: chi ha scritto «pollo» e poi «tacchino, coniglio»
    // si aspetta un gruppo di tre, non di due.
    const visti = new Set<string>();
    const alimenti = [...(stato.equivalenzaAlimenti ?? []), ...letta.alimenti].filter((a) => {
      const k = a.toLowerCase();
      if (visti.has(k)) return false;
      visti.add(k);
      return true;
    });
    const insieme = { alimenti, nome: null };
    if (!bastaPerScrivere(insieme)) {
      return { testo: testoChiediAltri(insieme), esito: 'in_corso', stato: { ...stato, equivalenzaAlimenti: alimenti } };
    }
    return {
      testo: testoChiediNome(insieme),
      esito: 'in_corso',
      stato: { ...stato, passo: 'equivalenza_nome', equivalenzaAlimenti: alimenti },
    };
  }

  private async equivalenzaNome(stato: StatoVera, frase: string): Promise<EsitoVera> {
    // ⚠️ Anche qui si esce: «non lo so» non è il nome di un gruppo di equivalenza.
    if (VeraChatService.USCITE.test((frase ?? '').trim())) return { testo: testi.annullato(), esito: 'annullata' };
    const nome = (frase ?? '').trim().replace(/[.!?]+$/, '');
    // ⚠️ Un nome di due lettere non è un nome: si richiede invece di scrivere «ok» in banca dati.
    if (nome.length < 3) {
      return { testo: testoChiediNome({ alimenti: stato.equivalenzaAlimenti ?? [], nome: null }), esito: 'in_corso', stato };
    }
    return {
      testo: testoAnteprima({ alimenti: stato.equivalenzaAlimenti ?? [], nome: null }, nome),
      esito: 'in_corso',
      stato: { ...stato, passo: 'equivalenza_conferma', equivalenzaNome: nome },
    };
  }

  /**
   * Il sì. ⚠️ Da qui si scrive — e nasce **bozza**: `EquivalenceService.create` mette
   * `status: 'draft'` e avvisa i capi nutrizionisti. Il motore non la usa finché non è approvata, ed
   * è la stessa regola delle proposte di Vera: una frase in chat non cambia cosa mangiano le clienti.
   */
  private async equivalenzaScrivi(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const risposta = leggiConferma(frase);
    if (risposta === null) return { testo: 'Non ho capito se confermi. Rispondi «sì» o «no».', esito: 'in_corso', stato };
    if (risposta === false) return { testo: testi.annullato(), esito: 'annullata' };

    const alimenti = stato.equivalenzaAlimenti ?? [];
    const nome = stato.equivalenzaNome ?? '';
    try {
      await this.combinazioni.create(nutrizionistaId, { name: nome, items: alimenti });
    } catch (err) {
      /**
       * ⚠️ Senza questo, un rifiuto del servizio (nome duplicato, permesso) faceva saltare tutta la
       * risposta: 500, nessun messaggio salvato, e lo stato rimasto a `equivalenza_conferma` — così
       * riscrivendo «sì» si riotteneva 500. Trovato dalla revisione del 19/8 sera. L'errore si
       * **riporta**: la sua frase dice cosa fare, la mia direbbe solo che non è riuscito.
       */
      return {
        testo: `Non l'ho scritto: ${err instanceof Error ? err.message : 'errore'}. Riprova, o cambia nome al gruppo.`,
        esito: 'in_corso',
        stato,
      };
    }
    return { testo: testoFatto(nome, alimenti.length), esito: 'scritta' };
  }

  private async avviaRicetta(nutrizionistaId: string, intento: IntentoRicetta, frase: string): Promise<EsitoVera> {
    const tags = intento.stile ? [intento.stile] : [];
    if (intento.modo === 'nuova') {
      return {
        testo: testi.chiediRicetta('nuova'),
        esito: 'in_corso',
        stato: { passo: 'ricetta_testo', frase, modoRicetta: 'nuova', tagsRicetta: tags },
      };
    }
    if (!intento.nome) {
      return {
        testo: 'Quale ricetta vuoi cambiare? Dimmi il nome come compare nel catalogo.',
        esito: 'in_corso',
        stato: { passo: 'ricetta_quale', frase },
      };
    }
    return this.cercaRicetta(nutrizionistaId, { passo: 'ricetta_quale', frase }, intento.nome);
  }

  /**
   * Quale ricetta. ⚠️ Non si indovina mai, esattamente come per le clienti: zero risultati lo dico,
   * più d'uno li elenco. Modificare la ricetta sbagliata cambia il piatto di chi non c'entra.
   */
  private async cercaRicetta(nutrizionistaId: string, stato: StatoVera, nome: string): Promise<EsitoVera> {
    const cercato = (nome ?? '').trim();
    if (cercato.length < 3) {
      return { testo: 'Dimmi almeno tre lettere del nome, o non so cosa cercare.', esito: 'in_corso', stato };
    }
    const trovate = (await this.prisma.recipe.findMany({
      where: { name: { contains: cercato, mode: 'insensitive' }, active: true } as never,
      select: { id: true, name: true },
      take: 6,
    })) as { id: string; name: string }[];

    if (!trovate.length) return { testo: testi.ricettaNonTrovata(cercato), esito: 'arresa' };
    if (trovate.length > 1) {
      return {
        testo: testi.ricetteOmonime(cercato, trovate.map((r) => r.name)),
        esito: 'in_corso',
        stato: { ...stato, passo: 'ricetta_quale', candidati: trovate.map((r) => ({ id: r.id, nome: r.name, email: '' })) },
      };
    }
    return {
      testo: testi.chiediRicetta('modifica', trovate[0].name),
      esito: 'in_corso',
      stato: { ...stato, passo: 'ricetta_testo', modoRicetta: 'modifica', ricettaId: trovate[0].id },
    };
  }

  /** La risposta all'elenco: un numero, o il nome per intero. */
  private async scegliRicetta(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const candidati = stato.candidati ?? [];
    const numero = /^\s*(\d+)\s*$/.exec(frase.trim());
    if (numero && candidati.length) {
      const scelta = candidati[Number(numero[1]) - 1];
      if (!scelta) return { testo: testi.ricetteOmonime('', candidati.map((c) => c.nome)), esito: 'in_corso', stato };
      return {
        testo: testi.chiediRicetta('modifica', scelta.nome),
        esito: 'in_corso',
        stato: { ...stato, passo: 'ricetta_testo', modoRicetta: 'modifica', ricettaId: scelta.id, candidati: undefined },
      };
    }
    return this.cercaRicetta(nutrizionistaId, stato, frase);
  }

  /**
   * La ricetta come l'ha scritta, letta e messa davanti agli occhi coi valori veri.
   *
   * ⚠️ Il testo si **accumula**: quando manca il pasto lei risponde «pranzo» e basta, e quella
   * parola da sola non è una ricetta. Si tiene tutto quello che ha scritto in questo giro e si
   * rilegge dall'inizio — è anche il motivo per cui nello stato c'è il testo e non l'oggetto già
   * costruito.
   */
  private async leggiLaRicetta(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const testo = [stato.testoRicetta, frase].filter(Boolean).join('\n');
    const dopo = { ...stato, testoRicetta: testo };
    const ricetta = leggiRicetta(testo);

    const manca = cosaManca(ricetta);
    if (manca.length) return { testo: testi.mancaNellaRicetta(manca), esito: 'in_corso', stato: dopo };

    const macro = await this.macroDiRicetta(ricetta);
    if (macro.mancanti.length) {
      /**
       * ⚠️ Gli alimenti fuori tabella si **segnano** prima di rispondere: `NutrientLookupMiss` è la
       * tabella che dice quali alimenti aggiungere per primi, ordinati per quante volte sono stati
       * chiesti. Senza questa riga il buco resta un episodio, e la volta dopo si ricomincia.
       */
      for (const m of macro.mancanti) await this.valori.registraMancante(m).catch(() => undefined);
      return { testo: testi.alimentiFuoriTabella(macro.mancanti), esito: 'in_corso', stato: dopo };
    }

    /**
     * ⛔ **Da qui NON si va più diritti all'anteprima** (Simone, 4/9: *«guidando passo passo:
     * ingredienti, metodo ecc»* e *«Vera chiede anche gli allergeni»*). Prima c'era un salto:
     * ingredienti → anteprima → scritto. Adesso in mezzo ci sono due domande, e sono due domande
     * che una persona deve poter rispondere «non ora».
     */
    return this.dopoGliIngredienti(dopo, ricetta);
  }

  /**
   * Il passo successivo agli ingredienti: **il metodo**, poi **gli allergeni**, poi l'anteprima.
   *
   * ⚠️ È una funzione sola perché ci si torna da tre punti diversi (finito il testo, finito il
   * metodo, finiti gli allergeni) e ognuno deve sapere **dove si è arrivati**, non dove pensava di
   * essere. Tre copie di questa scaletta divergerebbero al primo passo aggiunto.
   */
  private async dopoGliIngredienti(stato: StatoVera, ricetta: RicettaDettata): Promise<EsitoVera> {
    if (stato.metodoRicetta === undefined) {
      /**
       * ⚠️ I macro si calcolano e si **mostrano** già qui: sono la prova che ogni ingrediente è
       * stato trovato in tabella, e un abbinamento sbagliato deve saltare fuori adesso — non sotto
       * il pulsante che conferma. Il perché per esteso sta su `testi.chiediMetodo`.
       */
      const macro = await this.macroDiRicetta(ricetta);
      return {
        testo: testi.chiediMetodo(ricetta.nome!, MODI_DA_DIRE, raccontaMacro(macro)),
        esito: 'in_corso',
        stato: { ...stato, passo: 'ricetta_metodo', tentativi: 0 },
      };
    }
    /**
     * ⚠️ Gli allergeni si chiedono **solo sulla ricetta NUOVA**, e il motivo non è che quella
     * esistente li abbia di sicuro — le migliaia di ricette generate nascono con
     * `allergensReviewed: false`, quindi spesso non li ha. È che **una modifica non si applica qui**:
     * va in coda al capo, e la ricetta di oggi non cambia. Chiedere gli allergeni di un piatto che
     * fra un'ora potrebbe essere diverso vorrebbe dire farli confermare su un contenuto che non è
     * ancora quello. Se gli ingredienti cambiano, la conferma decade da sola —
     * `conferma-allergeni-decade.ts` — ed è la strada giusta.
     */
    if ((stato.modoRicetta ?? 'nuova') === 'nuova' && stato.allergeniDaScrivere === undefined) {
      const suggeriti = suggestAllergens(
        ricetta.ingredienti.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit })) as never,
      ) as Suggerimento[];
      return {
        testo: testi.chiediAllergeni(ricetta.nome!, raccontaSuggerimenti(suggeriti)),
        esito: 'in_corso',
        stato: { ...stato, passo: 'ricetta_allergeni', tentativi: 0 },
      };
    }
    return this.anteprimaDellaRicetta(stato, ricetta);
  }

  /** L'ultima schermata prima che il piatto esista: ci sta **tutto** quello che sto per scrivere. */
  private async anteprimaDellaRicetta(stato: StatoVera, ricetta: RicettaDettata): Promise<EsitoVera> {
    const macro = await this.macroDiRicetta(ricetta);
    const m = stato.metodoRicetta;
    return {
      testo: testi.anteprimaRicetta(
        ricetta.nome!,
        etichettaSlot(ricetta.slot!),
        ETICHETTA_REGIME[ricetta.regime!] ?? ricetta.regime!,
        ricetta.ingredienti.map((i) => `${i.name}${i.qty ? ` ${i.qty} ${i.unit ?? 'g'}` : ''}`),
        raccontaMacro(macro),
        stato.modoRicetta ?? 'nuova',
        m ? `${etichettaDelMetodo(m.type)} — ${m.steps.join(' · ')}` : null,
        stato.allergeniDaScrivere === undefined ? undefined : raccontaScelti(stato.allergeniDaScrivere),
      ),
      esito: 'in_corso',
      stato: { ...stato, passo: 'ricetta_conferma' },
    };
  }

  /**
   * ⛔ **COME SI PREPARA.** Il parser sta in `metodo-dettato.ts`, e ha il suo cappello sul perché
   * non legge dentro il testo della ricetta.
   *
   * ⚠️ Le tre risposte incomplete — modo senza passaggi, passaggi senza modo, non capito — tornano
   * indietro con una domanda **diversa** l'una dall'altra. Una sola frase per tre casi («non ho
   * capito») farebbe rispondere di nuovo la stessa cosa.
   */
  private async leggiIlMetodo(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const ricetta = leggiRicetta(stato.testoRicetta ?? '');

    /**
     * ⛔ **La risposta al «confermi?» sul metodo che ha proposto il modello.** Un «sì» lo accetta;
     * qualunque altra cosa **non** è un rifiuto silenzioso: la proposta si butta e la frase si legge
     * come un metodo nuovo, perché chi non conferma di solito sta già riscrivendo la risposta.
     */
    if (stato.metodoProposto) {
      const risposta = leggiConferma(frase);
      if (risposta === true) {
        return this.dopoGliIngredienti(
          { ...stato, metodoRicetta: stato.metodoProposto, metodoProposto: undefined, tentativi: 0 },
          ricetta,
        );
      }
      const senzaProposta = { ...stato, metodoProposto: undefined };
      if (risposta === false) {
        return {
          testo: testi.metodoSenzaModo(MODI_DA_DIRE),
          esito: 'in_corso',
          stato: { ...senzaProposta, passiInAttesa: stato.metodoProposto.steps, tentativi: 0 },
        };
      }
      return this.leggiIlMetodo(nutrizionistaId, senzaProposta, frase);
    }

    const esito = leggiMetodo(frase);

    /**
     * ⛔ **SI DEVE POTER USCIRE, e l'ordine fra «salta» e «annulla» conta.**
     *
     * Trovato da una revisione avversariale il 4/9: questi due passi erano gli unici del file a non
     * guardare né `USCITE` né `MAX_TENTATIVI`. Chi non veniva capito restava dentro fino alla
     * scadenza di due ore — e nel frattempo non poteva fare **niente altro** con Vera. È lo stesso
     * vicolo cieco trovato il 19/8 sulla lista dei lavori, rifatto uguale.
     *
     * ⚠️ **`SALTA` si guarda PRIMA di `USCITE`**, e le due liste hanno delle parole in comune
     * («lascia stare», «niente»): qui quelle parole vogliono dire *salta il metodo*, non *butta via
     * la ricetta* — è la risposta che la domanda stessa suggerisce. Per uscire davvero restano
     * «annulla», «basta», «stop», che non sono parole da rinuncia parziale.
     */
    if (esito.tipo !== 'salta' && VeraChatService.USCITE.test((frase ?? '').trim())) {
      return { testo: testi.annullato(), esito: 'annullata' };
    }

    if (esito.tipo === 'metodo') {
      return this.dopoGliIngredienti({ ...stato, metodoRicetta: esito.metodo, tentativi: 0 }, ricetta);
    }
    if (esito.tipo === 'salta') {
      /** ⚠️ `null` e non `undefined`: «chiesto e saltato» non si richiede al giro dopo. */
      const dopo = await this.dopoGliIngredienti({ ...stato, metodoRicetta: null, tentativi: 0 }, ricetta);
      return { ...dopo, testo: `${testi.metodoSaltato()}\n\n${dopo.testo}` };
    }
    /**
     * ⛔ **LA SECONDA LETTURA, PRIMA DI RICHIEDERE** — Simone, 4/9.
     *
     * Il parser è deterministico e stretto: «lo butto in forno finché non è dorato» nomina il forno
     * dentro una frase e non risponde «al forno», quindi si tornava a chiedere. ⚠️ Chiedere due
     * volte la stessa cosa è il modo più sicuro di farsi rispondere «lascia stare», e il metodo si
     * perde per come è stata scritta la frase, non per quello che diceva.
     *
     * ⚠️ **Il giro è quello di sempre**: il modello riscrive, a decidere resta `leggiMetodo`, e la
     * riscrittura **si mostra** — vedi `seconda-lettura.ts`. E si prova **una volta sola per giro**:
     * `giaRiletto` impedisce che una riscrittura capita a metà rimbalzi fra i due, spendendo a ogni
     * rimbalzo.
     */
    if (!stato.giaRiletto && (esito.tipo === 'senza_modo' || esito.tipo === 'non_capito')) {
      const riletto = await secondaLetturaMetodo(frase, {
        chiediAlModello: (system, prompt) => this.ai.generateJson<{ frase?: unknown }>(system, prompt, 300),
        leggi: (f) => leggiMetodo(f),
        completo: (e) => e.tipo === 'metodo',
        avvisa: (m) => logger.warn(m),
      });
      /**
       * ⛔ **La riscrittura del modello NON passa da sola: si fa confermare.**
       *
       * ⚠️ Trovato da una revisione avversariale il 4/9, e vale la pena scriverlo per esteso perché
       * è la differenza fra questo passo e quello dell'intento. Là `capisci` ha forme sue e il
       * modello può solo riordinare; qui **il modo di cottura è la decisione**, e la guardia non
       * può accorgersi se il modello sposta in prima riga una parola che stava in fondo: «lo lesso
       * in acqua e poi lo servo freddo» → «piatto freddo». La parola c'era, quindi non è «nuova» —
       * ma il piatto è lessato, e in scheda diventerebbe un piatto crudo.
       *
       * ⛔ È esattamente quello che `metodo-dettato.ts` dichiara di evitare («la parola del modo si
       * cerca SOLO nella prima riga»). Non si può chiedere alla guardia di vederlo; si chiede a una
       * persona, che è la regola di sempre — il modello propone, decide qualcuno.
       *
       * ⚠️ E `giaRiletto` si scrive **anche quando fallisce**: senza, ogni giro rifaceva la
       * chiamata, e su una frase che il modello non sa riscrivere erano tre chiamate invece di una.
       */
      if (riletto && riletto.esito.tipo === 'metodo') {
        return {
          testo: testi.hoCapitoCosi(etichettaDelMetodo(riletto.esito.metodo.type), riletto.esito.metodo.steps),
          esito: 'in_corso',
          stato: { ...stato, metodoProposto: riletto.esito.metodo, giaRiletto: true, tentativi: 0 },
        };
      }
      return {
        testo: testi.metodoSenzaModo(MODI_DA_DIRE),
        esito: 'in_corso',
        stato: {
          ...stato,
          giaRiletto: true,
          passiInAttesa: [...(stato.passiInAttesa ?? []), ...(esito.tipo === 'senza_modo' ? esito.steps : [])],
          tentativi: (stato.tentativi ?? 0) + 1,
        },
      };
    }

    /**
     * ⚠️ **E dopo due giri a vuoto si va avanti SENZA**, invece di insistere. Il metodo è la parte
     * che si può saltare — gli allergeni no — quindi arrendersi qui non costa una ricetta: costa i
     * passaggi, e si dice.
     */
    if ((stato.tentativi ?? 0) >= MAX_TENTATIVI) {
      const dopo = await this.dopoGliIngredienti({ ...stato, metodoRicetta: null, tentativi: 0 }, ricetta);
      return { ...dopo, testo: `${testi.metodoSaltato()}\n\n${dopo.testo}` };
    }

    if (esito.tipo === 'senza_passi') {
      /**
       * ⚠️ **I passaggi che aveva già scritto NON si perdono.** È il caso di chi risponde prima con
       * l'elenco e poi, alla domanda su come si cuoce, con una parola sola: le due metà arrivano in
       * due messaggi ed è questa riga a rimetterle insieme. Senza, si sentirebbe chiedere di
       * riscrivere quello che ha appena scritto — che è il modo più sicuro di farsi rispondere
       * «lascia stare».
       */
      if (stato.passiInAttesa?.length) {
        return this.dopoGliIngredienti(
          { ...stato, metodoRicetta: { type: esito.type, steps: stato.passiInAttesa }, passiInAttesa: undefined, tentativi: 0 },
          ricetta,
        );
      }
      return {
        testo: testi.metodoSenzaPassi(etichettaDelMetodo(esito.type)),
        esito: 'in_corso',
        stato: { ...stato, tentativi: (stato.tentativi ?? 0) + 1 },
      };
    }
    /**
     * ⚠️ Passaggi senza il modo: i passaggi **si tengono**, e si chiede solo quello che manca. Farli
     * riscrivere è il modo più sicuro di far rispondere «lascia stare».
     */
    if (esito.tipo === 'senza_modo') {
      return {
        testo: testi.metodoSenzaModo(MODI_DA_DIRE),
        esito: 'in_corso',
        stato: {
          ...stato,
          passiInAttesa: [...(stato.passiInAttesa ?? []), ...esito.steps],
          tentativi: (stato.tentativi ?? 0) + 1,
        },
      };
    }
    return {
      testo: testi.chiediMetodo(ricetta.nome ?? 'la ricetta', MODI_DA_DIRE),
      esito: 'in_corso',
      stato: { ...stato, tentativi: (stato.tentativi ?? 0) + 1 },
    };
  }

  /**
   * ⛔ **GLI ALLERGENI, PRIMA DI SCRIVERE** (Simone, 4/9). Il lettore è quello del flusso già
   * esistente (`allergeni-ricetta.ts`), con le stesse quattro risposte: «sì», un elenco che
   * sostituisce, «nessuno», oppure un «sì **e anche** X» che si somma.
   *
   * ⚠️ E `null` resta una risposta: una frase che non nomina niente **non diventa «nessuno»**.
   * «Non lo so» e «non ne ha» sono due cose diverse, e la seconda apre il piatto a tutte.
   */
  private async leggiGliAllergeniDellaNuova(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const ricetta = leggiRicetta(stato.testoRicetta ?? '');
    const suggeriti = suggestAllergens(
      ricetta.ingredienti.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit })) as never,
    ) as Suggerimento[];
    const codiciSuggeriti = suggeriti.map((x) => x.allergen);
    const esito = leggiAllergeni(frase);

    /**
     * ⛔ **Da qui si esce annullando, e non si «salta».** Gli allergeni sono il cancello: senza, la
     * ricetta non si accende. Un modo di andare avanti senza rispondere sarebbe un modo di scrivere
     * «nessun allergene» senza dirlo.
     *
     * ⚠️ La ricetta non è ancora scritta, quindi annullare non perde niente in catalogo: perde
     * quello che ha digitato, e va detto — lo dice `testi.annullato()`.
     */
    if (VeraChatService.USCITE.test((frase ?? '').trim())) {
      return { testo: testi.annullato(), esito: 'annullata' };
    }
    /**
     * ⛔ **E dopo due giri a vuoto ci si arrende, invece di ripetere la stessa domanda per due ore.**
     * Ci si arrende **senza scrivere**: la ricetta resta non scritta e si dice come farla — è
     * l'unico esito onesto, perché il contrario sarebbe accenderla senza sapere cosa contiene.
     */
    if ((stato.tentativi ?? 0) >= MAX_TENTATIVI) {
      return { testo: testi.allergeniNonCapitiBasta(ricetta.nome ?? 'la ricetta'), esito: 'arresa' };
    }

    if (esito === null) {
      return {
        testo: testi.allergeniNonCapiti(raccontaSuggerimenti(suggeriti)),
        esito: 'in_corso',
        stato: { ...stato, tentativi: (stato.tentativi ?? 0) + 1 },
      };
    }
    const scelti =
      esito.tipo === 'tutti' ? codiciSuggeriti
      : esito.tipo === 'nessuno' ? []
      : esito.tipo === 'elenco' ? esito.codici
      : [...new Set([...codiciSuggeriti, ...esito.codici])];

    return this.dopoGliIngredienti({ ...stato, allergeniDaScrivere: scelti, tentativi: 0 }, ricetta);
  }

  /** I valori veri, uno per ingrediente. La ricerca per nome e sinonimi è quella di Gaia. */
  private async macroDiRicetta(ricetta: RicettaDettata) {
    const valori = new Map<string, ValorePer100 | null>();
    /**
     * ⚠️ CRUDO O COTTO (voce 228). Un ingrediente che la tabella ha in più stati e la ricetta non
     * distingue non si conta e **si chiede**: prendere il primo che passa sbaglia fino a tre volte
     * (farro: 353 kcal da crudo, 127 da bollito), e sbaglia sempre in eccesso.
     */
    const ambigui: string[] = [];
    const soloCotto: string[] = [];
    const statoIgnoto: string[] = [];
    for (const i of ricetta.ingredienti) {
      if (valori.has(i.name)) continue;
      const scelta = await this.valori.cercaConStato(i.name).catch(() => ({ tipo: 'niente' as const }));
      if (scelta.tipo === 'ambiguo') ambigui.push(i.name);
      /**
       * ⚠️ **UNA SOLA PORTA**, e ci passa la convenzione «a crudo» (correzione del 19/8 sera, dalla
       * revisione avversariale). Prima c'erano due strade: il nome esatto passava da qui e applicava
       * `scegliPerRicetta`, il nome abbinato («lenticchie bio») passava da `cercaPerIngrediente` che
       * lo stato non lo guardava affatto. ⚠️ Risultato: «lenticchie» bloccata giustamente,
       * «lenticchie bio» contata con la riga **bollita** su una grammatura a crudo — 93 kcal dove ce
       * ne sono 282, scritte in `Recipe.kcal`. Il controllo saltava esattamente nei casi per cui
       * l'abbinamento esiste.
       *
       * ⚠️ `cercaPerIngrediente` e non `cerca`: qui l'ingresso è un **nome**, non una domanda, e su
       * un nome vale la regola «la ricetta è più specifica della tabella». Su una frase intera quella
       * stessa regola si abbinerebbe a caso.
       */
      const perLaRicetta = await this.valori
        .cercaPerIngrediente(i.name)
        .catch(() => ({ tipo: 'niente' as const }));
      if (perLaRicetta.tipo === 'solo_cotto') {
        soloCotto.push(i.name);
        valori.set(i.name, null);
        continue;
      }
      if (perLaRicetta.tipo === 'stato_ignoto') statoIgnoto.push(i.name);
      if (perLaRicetta.tipo === 'niente') {
        valori.set(i.name, null);
        continue;
      }
      // ⚠️ Se una riga a crudo c'è, l'ambiguità non c'è più: la convenzione l'ha sciolta.
      const k = ambigui.indexOf(i.name);
      if (k >= 0) ambigui.splice(k, 1);
      valori.set(i.name, perLaRicetta.riga as unknown as ValorePer100);
    }
    return calcolaMacro(ricetta.ingredienti, valori, ambigui, soloCotto, statoIgnoto);
  }

  /** Il sì. Da qui in poi si scrive — e solo da qui. */
  private async scriviLaRicetta(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const risposta = leggiConferma(frase);
    if (risposta === null) {
      return { testo: 'Non ho capito se confermi. Rispondi «sì» o «no».', esito: 'in_corso', stato };
    }
    if (risposta === false) return { testo: testi.annullato(), esito: 'annullata' };

    const ricetta = leggiRicetta(stato.testoRicetta ?? '');
    const macro = await this.macroDiRicetta(ricetta);
    // ⚠️ Si ricontrolla dopo il sì e non ci si fida dell'anteprima: fra le due c'è passato del tempo,
    // e nel frattempo qualcuno potrebbe aver corretto la tabella nutrienti. Costa una lettura.
    if (cosaManca(ricetta).length || macro.mancanti.length) {
      return { testo: testi.alimentiFuoriTabella(macro.mancanti), esito: 'in_corso', stato };
    }
    /**
     * ⚠️ LA RICETTA NON SI SCRIVE SE UN INGREDIENTE L'ABBIAMO SOLO DA COTTO (19/8).
     *
     * Stessa regola dei mancanti, e per la stessa ragione: `Recipe.kcal` è obbligatorio, e l'unico
     * modo di riempirlo qui sarebbe contare la riga bollita su una grammatura a crudo — cioè
     * scrivere un numero fino a tre volte più basso del vero dentro un campo su cui il motore
     * calcola le giornate. Un totale più basso del vero è il tipo di errore che nessuno nota
     * guardando il numero.
     */
    if (macro.soloCotto.length) {
      return { testo: fraseSoloCotto(macro.soloCotto), esito: 'in_corso', stato };
    }

    /**
     * ⛔ **«NON LO SO» NON È «NESSUNO», nemmeno come ripiego di un campo mancante.**
     *
     * La prima stesura scriveva `stato.allergeniDaScrivere ?? []`: uno stato senza quel campo —
     * per esempio un dialogo aperto **prima** di questo rilascio, che vive due ore nel `meta`
     * dell'ultimo messaggio — sarebbe diventato «questa ricetta non contiene allergeni», scritto,
     * confermato e **acceso**. La nutrizionista avrebbe davanti la vecchia anteprima, che dice
     * un'altra cosa ancora. È la regola dei tre stati di `allergeni-ricetta.ts`, violata dal ripiego
     * di una riga sola. Trovato da una revisione avversariale prima della consegna.
     *
     * ⚠️ Qui non si indovina e non si scrive: si torna a **chiedere**.
     */
    if ((stato.modoRicetta ?? 'nuova') === 'nuova' && stato.allergeniDaScrivere === undefined) {
      return this.dopoGliIngredienti({ ...stato, tentativi: 0 }, ricetta);
    }

    const campi: RicettaDaScrivere = {
      name: ricetta.nome!,
      regime: ricetta.regime!,
      mealSlot: ricetta.slot!,
      kcal: macro.kcal,
      ingredients: ricetta.ingredienti.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit })),
      macros: macro.macros,
      /**
       * ⚠️ **Assente e vuoto sono due cose diverse** (vedi `RicettaDaScrivere`): sulla ricetta NUOVA
       * il campo si scrive comunque — `[]` se ha detto «lascia stare», e non c'è niente da perdere.
       * Sulla MODIFICA, se non l'ha dettato, il campo **non si manda**: `updateRecipe` non lo tocca,
       * e i passaggi che ci sono già restano di chi li ha scritti.
       */
      ...(stato.metodoRicetta
        ? { cookingMethods: [stato.metodoRicetta] }
        : (stato.modoRicetta ?? 'nuova') === 'nuova' ? { cookingMethods: [] } : {}),
      tags: [...new Set([...(stato.tagsRicetta ?? []), ...ricetta.tags])],
      active: false,
    };

    if (stato.modoRicetta === 'modifica') {
      // ⚠️ NON si scrive in catalogo: la ricetta è già nei piatti di oggi. La modifica vive nella
      // proposta e diventa vera quando il capo approva.
      const riga = (await this.registro.scrivi({
        nutrizionistaId,
        frase: stato.testoRicetta ?? stato.frase,
        azione: 'ricetta_modificata',
        ambito: 'catalogo',
        soggettoTipo: 'recipe',
        soggettoId: stato.ricettaId ?? null,
        soggettoNome: campi.name,
        dettaglio: { campi },
        inApprovazione: true,
      })) as { id: string };
      return { testo: testi.modificaInCoda(campi.name), esito: 'in_approvazione', azioneId: riga.id };
    }

    /**
     * ⛔ **`createRecipe` PUÒ RIFIUTARE, e senza questo `catch` l'eccezione volava via nuda.**
     *
     * Dal 4/9 ha due cancelli: l'elenco ingredienti vuoto **ferma**, il regime che il contenuto
     * smentisce **chiede una conferma**. ⚠️ Da Vera quella conferma non si può dare, quindi il
     * rifiuto è definitivo e va **raccontato**: `parla()` non ha un try/catch, e il messaggio della
     * nutrizionista è già stato scritto in chat. Lasciandola volare: la sua frase in chat, **nessuna
     * risposta**, lo stato del dialogo fermo, e il «sì» ripetuto che rifà lo stesso errore.
     *
     * ⚠️ È lo stesso ragionamento del `catch` più sotto, che questa riga aveva lasciato scoperto:
     * *un errore raccontato è un lavoro che si può riprendere; un errore inghiottito è un piatto che
     * nessuno sa di avere*.
     */
    let nuova: { id: string };
    try {
      nuova = (await this.ricette.createRecipe(nutrizionistaId, campi)) as { id: string };
    } catch (e) {
      const motivo = e instanceof Error ? e.message : 'la scrittura non è riuscita.';
      logger.warn(`Vera: ricetta «${campi.name}» rifiutata alla scrittura — ${motivo}`);
      /** ⚠️ `arresa`: il dialogo si chiude qui, e non è stato fatto niente. È com'è rimasta. */
      return { testo: testi.ricettaRifiutata(campi.name, motivo), esito: 'arresa' };
    }

    /**
     * ⛔ **QUI LA RICETTA SI ACCENDE, E SI ACCENDE DA UNA PORTA SOLA** — Simone, 4/9: *«Vera chiede
     * anche gli allergeni e la ricetta nasce attiva»*.
     *
     * ⚠️ **L'ordine è la sicurezza di questo pezzo.** `createRecipe` la scrive **spenta** (vedi
     * `RicettaDaScrivere.active`), e `setRecipeAllergens` fa **tutte e due** le cose: conferma gli
     * allergeni e accende la ricetta che era spenta e non revisionata. Così non esiste un istante in
     * cui il piatto è acceso e gli allergeni non sono confermati — e dentro quell'istante il motore
     * compone. Scrivere `active: true` alla creazione avrebbe aperto esattamente quella finestra.
     *
     * ⚠️ E si passa dalla **stessa funzione del pulsante in scheda**: filtra sui 14 codici UE e
     * lascia la sua traccia in audit. Una seconda strada per un dato sanitario è il difetto che
     * questo progetto ha già pagato due volte.
     */
    const allergeni = stato.allergeniDaScrivere!;
    try {
      await this.ricette.setRecipeAllergens(nutrizionistaId, nuova.id, allergeni);
    } catch (e) {
      /**
       * ⛔ **SE LA SECONDA SCRITTURA NON RIESCE, LA PRIMA È GIÀ AVVENUTA** — e non c'è transazione
       * che le tenga insieme: sono due chiamate a due funzioni di servizio, non due query.
       *
       * Trovato da una revisione avversariale il 4/9. Lasciando volare l'eccezione succedevano tre
       * cose, tutte silenziose: la ricetta restava in catalogo **spenta e fuori dal registro**
       * (`registro.scrivi` non veniva mai eseguito); la nutrizionista vedeva un 500; e siccome lo
       * stato del dialogo non veniva riscritto, il «sì» ripetuto — il gesto naturale dopo un errore
       * — ne creava un **doppione**.
       *
       * ⚠️ Perciò: la riga di registro si scrive **lo stesso** (è la sola traccia di chi ha messo
       * quel piatto lì), il dialogo si chiude, e si dice esattamente com'è rimasta — spenta, senza
       * allergeni, e dove si finisce il lavoro. Un errore raccontato è un lavoro che si può
       * riprendere; un errore inghiottito è un piatto che nessuno sa di avere.
       */
      logger.error(
        `Allergeni non scritti sulla ricetta ${nuova.id} appena creata da ${nutrizionistaId}: `
        + `${e instanceof Error ? e.message : String(e)}`,
      );
      const rigaRotta = (await this.registro.scrivi({
        nutrizionistaId,
        frase: stato.testoRicetta ?? stato.frase,
        azione: 'ricetta_nuova',
        ambito: 'catalogo',
        soggettoTipo: 'recipe',
        soggettoId: nuova.id,
        soggettoNome: campi.name,
        dettaglio: { campi, allergeni, allergeniNonScritti: true },
        inApprovazione: false,
      }).catch(() => ({ id: undefined }))) as { id?: string };
      return { testo: testi.ricettaSenzaAllergeni(campi.name), esito: 'scritta', azioneId: rigaRotta.id };
    }

    const riga = (await this.registro.scrivi({
      nutrizionistaId,
      frase: stato.testoRicetta ?? stato.frase,
      azione: 'ricetta_nuova',
      ambito: 'catalogo',
      soggettoTipo: 'recipe',
      soggettoId: nuova.id,
      soggettoNome: campi.name,
      dettaglio: { campi, allergeni },
      /**
       * ⚠️ **`inApprovazione: false`, e la riga resta.** La ricetta è già attiva: dire «in coda»
       * sarebbe falso, e il capo aprirebbe una coda per approvare una cosa già fatta. Ma il registro
       * serve lo stesso — è quello che permette di **annullare**, ed è la sola traccia leggibile di
       * chi ha messo quel piatto in catalogo.
       */
      inApprovazione: false,
    })) as { id: string };
    return { testo: testi.ricettaScritta(campi.name), esito: 'scritta', azioneId: riga.id };
  }

  // ────────────────────────────────────────────────────────────── l'anteprima ─

  /**
   * La regola tradotta + cosa comporta. È il freno, e non si salta.
   *
   * Prima però si chiudono i buchi: se una famiglia non si sa cosa vuol dire, si chiede — perché
   * un'anteprima costruita su una parola non capita mostrerebbe numeri veri di una regola sbagliata,
   * che è il modo più efficace di far confermare la cosa sbagliata.
   */
  private async preparaAnteprima(nutrizionistaId: string, stato: StatoVera): Promise<EsitoVera> {
    const intento = stato.intento as Intento;
    const clienteId = stato.clienteId!;

    // I PASTI hanno la loro anteprima: niente pool di ricette, niente ambito «per tutte».
    if (intento.tipo === 'pasti') return this.anteprimaPasti(stato, intento as IntentoPasti);

    // LA GIORNATA DETTATA (voce 241, decisione B): si legge, si abbinano le righe, si chiede
    // quello che è ambiguo, si mostra il totale e solo allora si scrive.
    if (intento.tipo === 'giornata') {
      return this.avviaGiornataDettata(nutrizionistaId, stato, intento as IntentoGiornata);
    }

    // LE PROTEINE (14/8, decisione A): la quota minima di questa cliente, mostrata in percentuale.
    if (intento.tipo === 'proteine') {
      return this.anteprimaProteine(stato, intento as IntentoProteine);
    }

    // LE CALORIE (14/8, Nocanty via Vera): anteprima col numero VERO, poi conferma, poi la porta.
    if (intento.tipo === 'correzione_kcal') {
      return this.avviaCorrezioneKcal(nutrizionistaId, stato, intento as IntentoCorrezioneKcal);
    }

    /**
     * ⛔ **LE ORE DEL DIGIUNO** (25/8): la porta che la regola della cliente promette. Vedi il
     * riquadro in testa a `digiuno-dettato.ts` — senza di questa, la frase «scrivilo alla tua
     * nutrizionista» manderebbe la cliente da una persona che non può farci niente.
     */
    if (intento.tipo === 'digiuno') {
      return this.anteprimaDigiuno(stato, intento as IntentoDigiuno);
    }

    // IL CAMBIO DI DIETA (azione 3, 14/8) ha il suo giro: dieta dal catalogo, «da quando?», conferma.
    if (intento.tipo === 'cambio_dieta') {
      return this.avviaCambioDieta(nutrizionistaId, stato, (intento as IntentoCambioDieta).dieta);
    }

    if (intento.tipo === 'restrizione') {
      const daChiedere = stato.famiglieDaChiedere ?? (await this.famiglieSconosciute(nutrizionistaId, intento.vietati));
      if (daChiedere.length) {
        const famiglia = daChiedere[0];
        const proposti = await this.alimentiProposti(famiglia);
        return {
          testo: testi.chiediFamiglia(famiglia, proposti),
          esito: 'in_corso',
          stato: { ...stato, passo: 'quale_famiglia', famiglia, proposti, famiglieDaChiedere: daChiedere },
        };
      }
    }

    const termini = await this.terminiFinali(nutrizionistaId, intento);
    const anteprima = await this.pool.anteprima(clienteId, termini);
    const conflitto = await this.conflittoSanitario(clienteId, intento);

    const righe = [
      this.riepilogo(intento, termini, stato.clienteNome ?? ''),
      anteprima.racconto,
    ];
    if (anteprima.dopo.pastiScoperti.length) {
      righe.push(
        `Cosa vuoi fare? Posso **cercarti alternative in catalogo** per ${anteprima.dopo.pastiScoperti.join(' e ')}, ` +
          'oppure procediamo lo stesso.',
      );
    }
    if (conflitto) righe.push(`⚠️ ${conflitto} Procedo lo stesso?`);
    else righe.push('Confermi?');

    return {
      testo: righe.join('\n\n'),
      esito: 'in_corso',
      stato: { ...stato, passo: 'conferma', famiglieDaChiedere: [] },
    };
  }

  /** I nomi di alimento veri, dopo aver sciolto le famiglie e tolto le eccezioni. */
  private async terminiFinali(nutrizionistaId: string, intento: Intento): Promise<string[]> {
    if (intento.tipo !== 'restrizione') return [];
    const fuori: string[] = [];
    for (const v of intento.vietati) {
      const voce = await this.dizionario.risolvi(nutrizionistaId, v);
      if (voce) fuori.push(...voce.membri);
      else fuori.push(v);
    }
    // ⚠️ «…ma solo il grana» toglie il grana dai vietati. Se restasse dentro, la regola direbbe
    // l'esatto contrario di quello che ha dettato — e sarebbe perfettamente formata.
    const tenuti = intento.tenuti ?? [];
    return fuori.filter((f) => !tenuti.some((t) => combaciaAlimento(f, t) || combaciaAlimento(t, f)));
  }

  /**
   * La regola tocca un vincolo sanitario di questa cliente?
   *
   * ⚠️ Non blocca: **ricorda**. La regola della nutrizionista vince su tutto, allergie comprese — è
   * un medico. Ma mai in silenzio: se se n'è dimenticata, o se sono io ad aver allargato l'elenco
   * traducendo, questa riga è l'unica occasione in cui qualcuno se ne accorge prima del piatto.
   */
  private async conflittoSanitario(clientId: string, intento: Intento): Promise<string | null> {
    if (intento.tipo !== 'restrizione' || !intento.tenuti.length) return null;
    const p = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { allergies: true, intolerances: true, name: true },
    })) as { allergies: string[]; intolerances: string[]; name: string | null } | null;
    if (!p) return null;

    const sanitari = [...(p.allergies ?? []), ...(p.intolerances ?? [])];
    if (!sanitari.length) return null;

    for (const tenuto of intento.tenuti) {
      const parole = expandExclusion(tenuto);
      for (const s of sanitari) {
        const chiavi = expandExclusion(s);
        if (parole.some((a) => chiavi.some((b) => combaciaAlimento(a, b) || combaciaAlimento(b, a)))) {
          return `${p.name ?? 'Questa cliente'} risulta con «${s}» fra allergie e intolleranze, e questa regola le lascerebbe proprio «${tenuto}».`;
        }
      }
    }
    return null;
  }

  private riepilogo(intento: Intento, termini: string[], cliente: string): string {
    if (intento.tipo === 'sostituzione') {
      const i = elenchiDellIntento(intento as IntentoSostituzione);
      /**
       * ⚠️ **L'anteprima elenca TUTTO** (31/8). Qui c'era `«${i.from}» → «${i.to}»` su due stringhe,
       * e con un elenco di undici verdure mostrava le prime quattro: la nutrizionista leggeva una
       * frase sensata, diceva «confermo», e nasceva una regola che ne copriva tre su undici.
       * L'anteprima è il punto in cui una lettura sbagliata si ferma — se mente lì, non si ferma più.
       */
      const da = i.da.map((x) => `«${x}»`).join(', ');
      const a = i.a.map((x) => `«${x}»`).join(', ');
      const quante = i.da.length * i.a.length;
      const conteggio = quante > 1 ? ` (${quante} regole)` : '';
      return i.a.length > 1
        ? `Per **${cliente}**: al posto di ${da} metto uno fra ${a}.${conteggio}`
        : `Per **${cliente}**: al posto di ${da} metto ${a}.${conteggio}`;
    }
    const i = intento as IntentoRestrizione;
    const tenuti = i.tenuti.length ? ` Tengo: ${i.tenuti.join(', ')}.` : '';
    return `Per **${cliente}** vieto ${termini.length} aliment${termini.length === 1 ? 'o' : 'i'}: ${termini.join(', ')}.${tenuti}`;
  }

  // ──────────────────────────────────────────────── i pasti (azione 3, Decisioni §14) ──

  /**
   * I giorni futuri toccati dalla decisione sugli spuntini (regola dell'annulla, §6.2) — e insieme a
   * loro **tutti** i giorni futuri, che servono per calcolare la coda.
   *
   * ⚠️ **La query non filtra più «mai aperto»** (24/8). Filtrandolo, questo punto non poteva nemmeno
   * *vedere* un giorno già aperto più avanti: cancellava i giorni toccati, quello letto restava
   * l'ultimo in calendario, e l'erogazione si fermava lì — buco permanente sui giorni cancellati e
   * nessun menu nuovo finché quella data non passava.
   *
   * ⚠️ E dal 26/8 non lo filtra **nemmeno il predicato** (`giorniColpitiDaiPasti`): «è colpito?» e
   * «lo posso cancellare?» sono due domande, e la seconda la risponde `codaDaRifare` — che sa dire
   * anche «non lo so» invece di far sparire i colpiti e lasciar raccontare «non ce n'era».
   */
  private async giorniPastiDaRifare(clientId: string, slots: Spuntino[], azione: 'togli' | 'rimetti') {
    const oggi = new Date();
    const tutti = await this.giorniFuturi(clientId, oggi);
    const colpiti = new Set(giorniColpitiDaiPasti(tutti, slots, oggi, azione).map((g) => g.id));
    return { tutti, colpito: (g: GiornoDaValutare) => colpiti.has(g.id) };
  }

  /**
   * **Tutti** i giorni della cliente da oggi in avanti — quelli già aperti compresi.
   *
   * ⚠️ `gte` dalla mezzanotte di oggi, non `gt: adesso`: `MenuDay.date` è una data senza ora, e
   * confrontarla con l'istante corrente fa sparire la giornata di oggi appena passa mezzanotte. Il
   * confine è scritto una volta sola — `daQuandoSiPuoRifare`.
   *
   * ⚠️ E **non** filtra `viewedAt: null`, di proposito: chi deve calcolare una coda ha bisogno di
   * vedere anche i giorni letti, altrimenti calcola una coda che coda non è. Il filtro «mai aperto»
   * resta dov'è una decisione (`siPuoRifare`), non dove nasconde metà del calendario.
   */
  private async giorniFuturi(clientId: string, oggi: Date): Promise<GiornoDaValutare[]> {
    return ((await this.prisma.menuDay.findMany({
      where: { clientId, date: { gte: daQuandoSiPuoRifare(oggi) } } as never,
      select: CAMPI_DEL_GIORNO as never,
    })) ?? []) as GiornoDaValutare[];
  }

  /**
   * La stessa frase in anteprima e dopo la conferma — perché siano **la stessa frase**.
   *
   * ⚠️ Scritte in due punti diverse divergono, e chi conferma legge una promessa che poi non trova
   * nel messaggio di riepilogo: è successo con «le giornate da rifare sono N», che l'anteprima
   * contava sui giorni toccati e l'esecuzione su una coda intera.
   */
  private raccontaCoda(coda: CodaDaRifare, quando: 'prima' | 'dopo' = 'prima'): string {
    const fatto = quando === 'dopo';
    if (coda.esito === 'niente') {
      return fatto ? 'Nessuna giornata già preparata era da rifare.' : 'Nessuna giornata già preparata da rifare.';
    }
    if (coda.esito === 'bloccata') {
      return (
        `⚠️ Le giornate già preparate ${fatto ? 'non le ho toccate' : 'NON le rifaccio'}: il menu ` +
        `del ${giornoItaliano(coda.apertoIl)} l'ha già aperto in app e quello resta suo. Per rifarle c'è ` +
        '«Rigenera menu» dalla sua scheda, che però rifà anche il giorno che ha già aperto.'
      );
    }
    /**
     * ⛔ **«NON LO SO» SI DICE, e questa frase è il motivo per cui il quarto esito esiste** (26/8).
     * Prima qui ci finiva «nessuna giornata da rifare» — cioè un'affermazione sui menu, falsa
     * esattamente nel caso che conta: la nutrizionista detta «niente pesce», il branzino è nel menu
     * di domani, e la risposta era «non ce n'era». Adesso quello che non sappiamo si chiama così.
     */
    if (coda.esito === 'non_lo_so') {
      return (
        `⚠️ Le giornate già preparate ${fatto ? 'non le ho toccate' : 'NON le rifaccio'}: dal ` +
        `${giornoItaliano(coda.dalGiorno)} non so dirti se le ha già aperte (la sua app non me lo dice ` +
        'ancora), e nel dubbio non le tolgo un menu di mano. Per rifarle c\'è «Rigenera menu» dalla sua scheda.'
      );
    }
    const n = coda.giorni.length;
    /**
     * ⚠️ **I colpiti rimasti indietro si nominano.** Sono le giornate che contengono davvero la cosa
     * decisa e che stanno **prima** della coda: già aperte, o di cui non sappiamo. Tacerle vuol dire
     * far leggere «fatto» a chi ha ancora il piatto vietato nel piatto di stasera.
     */
    const indietro = coda.lasciatiIndietro
      ? ` ⚠️ ${coda.lasciatiIndietro} giornat${coda.lasciatiIndietro === 1 ? 'a più vicina resta' : 'e più vicine restano'} ` +
        'come sono: quelle o le ha già aperte o non so dirlo.'
      : '';
    return (
      `${fatto ? 'Ho rifatto' : 'Rifaccio'} ${n} giornat${n === 1 ? 'a' : 'e'} dal ${giornoItaliano(coda.daQuando)} ` +
      'in poi; quelle prima restano come sono.' + indietro
    );
  }

  private async anteprimaPasti(stato: StatoVera, intento: IntentoPasti): Promise<EsitoVera> {
    const cliente = stato.clienteNome ?? 'lei';
    // «Lo spuntino» secco: si chiede quale, non si indovina.
    if (!intento.slots || !intento.slots.length) {
      return {
        testo: testi.chiediQualeSpuntino(cliente),
        esito: 'in_corso',
        stato: { ...stato, passo: 'quale_spuntino' },
      };
    }

    const p = (await this.prisma.clientProfile.findUnique({
      where: { userId: stato.clienteId! },
      select: { pastiEsclusi: true } as never,
    })) as { pastiEsclusi?: string[] } | null;
    const attuali = p?.pastiEsclusi ?? [];
    const dopo = pastiDopo(attuali, { azione: intento.azione, slots: intento.slots });
    const quali = intento.slots.map(etichettaSpuntino).join(' e ');
    if (dopo.join('|') === attuali.join('|')) {
      // Niente da fare: dirlo vale più di un'anteprima che promette il nulla.
      return { testo: `Era già così: per **${cliente}** non cambia niente (${quali}). Non tocco nulla.`, esito: 'annullata' };
    }

    const { tutti, colpito } = await this.giorniPastiDaRifare(stato.clienteId!, intento.slots, intento.azione)
      .catch(() => ({ tutti: [] as GiornoDaValutare[], colpito: () => false }));
    /**
     * ⚠️ **L'anteprima dice quello che succederà davvero** (24/8). Diceva «le giornate da rifare sono
     * N» contando i giorni *toccati*, mentre la cancellazione ne prende una coda intera — e nel caso
     * bloccato non ne prende nessuna. Un'anteprima che conta diversamente da quello che poi fa è il
     * modo in cui una conferma diventa una firma su una cosa non letta.
     */
    const coda = codaDaRifare(tutti, colpito);
    const righe = [
      intento.azione === 'togli'
        ? `Per **${cliente}** tolgo ${quali}: il motore non ${intento.slots.length === 1 ? 'lo' : 'li'} eroga più.`
        : `Per **${cliente}** rimetto ${quali}.`,
      // ⚠️ La frase sulle kcal è una promessa del motore, non un auspicio: gli slot esclusi escono
      // PRIMA della composizione (stessa strada del digiuno), quindi il target del giorno si
      // ridistribuisce sui pasti rimasti.
      'Le kcal della giornata non si perdono: si ridistribuiscono sui pasti rimasti.',
      this.raccontaCoda(coda),
      'Confermi?',
    ];
    return { testo: righe.join('\n\n'), esito: 'in_corso', stato: { ...stato, passo: 'conferma' } };
  }

  /** La risposta a «quale spuntino?»: si aggiorna l'intento e si torna all'anteprima. */
  private async scegliSpuntino(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const slots = leggiQualeSpuntino(frase);
    if (!slots) {
      const tentativi = (stato.tentativi ?? 0) + 1;
      if (tentativi > MAX_TENTATIVI) return { testo: testi.nonCapito(MAX_TENTATIVI), esito: 'arresa' };
      return {
        testo: testi.chiediQualeSpuntino(stato.clienteNome ?? 'lei'),
        esito: 'in_corso',
        stato: { ...stato, tentativi },
      };
    }
    const intento = { ...(stato.intento as IntentoPasti), slots };
    return this.anteprimaPasti({ ...stato, intento, tentativi: undefined }, intento);
  }

  private async applicaPasti(nutrizionistaId: string, stato: StatoVera, intento: IntentoPasti): Promise<EsitoVera> {
    const clienteId = stato.clienteId!;
    const slots = intento.slots as Spuntino[];
    const cliente = stato.clienteNome ?? 'lei';
    const quali = slots.map(etichettaSpuntino).join(' e ');

    // Si rilegge al momento della scrittura: lo stato appeso al messaggio è vecchio per definizione.
    const p = (await this.prisma.clientProfile.findUnique({
      where: { userId: clienteId },
      select: { pastiEsclusi: true } as never,
    })) as { pastiEsclusi?: string[] } | null;
    const attuali = p?.pastiEsclusi ?? [];
    const dopo = pastiDopo(attuali, { azione: intento.azione, slots });
    if (dopo.join('|') === attuali.join('|')) {
      return { testo: `Era già così: per **${cliente}** non cambia niente (${quali}). Non tocco nulla.`, esito: 'annullata' };
    }

    await this.prisma.clientProfile.update({
      where: { userId: clienteId },
      data: { pastiEsclusi: dopo } as never,
    });

    /**
     * La regola dell'annulla (§6.2): si rifanno solo i giorni futuri MAI aperti toccati davvero.
     *
     * ⛔ **E si cancella una CODA** (24/8): qui si cancellavano i giorni che contengono lo spuntino,
     * sparsi. Chi aveva già una giornata senza quello spuntino più avanti in calendario si ritrovava
     * quel giorno come ultimo, e i giorni cancellati prima di lui **non tornavano mai**. Il perché,
     * col meccanismo del motore misurato, sta in `codaDaRifare`.
     */
    /**
     * ⛔ **E se qui va storto qualcosa, non si sparisce** (24/8, seconda revisione). `pastiEsclusi` è
     * **già scritto** sul profilo tre righe sopra, e la riga di registro si scrive dopo: un'eccezione
     * qui risaliva fino a `parla()`, che non ha `try/catch`. Risultato: 500, la nutrizionista vede il
     * suo messaggio senza risposta, lo spuntino è tolto dal profilo, i giorni sono rimasti col
     * vecchio, e nel registro **non c'è la riga** — cioè non c'è nemmeno l'annulla. Degli altri due
     * percorsi di Vera uno degradava bene da sempre e l'altro l'avevo appena sistemato: questo era
     * rimasto indietro, sulla stessa identica decisione.
     */
    const { tutti, colpito } = await this.giorniPastiDaRifare(clienteId, slots, intento.azione).catch(() => null)
      ?? { tutti: [] as GiornoDaValutare[], colpito: () => false };
    let coda: CodaDaRifare = { esito: 'niente' };
    let riuscita = true;
    try {
      coda = codaDaRifare(tutti, colpito);
      if (coda.esito === 'coda') {
        await this.prisma.menuDay.deleteMany({ where: { id: { in: coda.giorni.map((g) => g.id) } } });
      }
    } catch (err) {
      riuscita = false;
      logger.warn(
        `Pasti scritti ma giorni non rifatti (cliente=${clienteId}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const rifatte = coda.esito === 'coda' && riuscita ? coda.giorni.length : 0;

    const riga = (await this.registro.scrivi({
      nutrizionistaId,
      frase: stato.frase,
      azione: 'pasti_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: clienteId,
      soggettoNome: stato.clienteNome ?? null,
      // ⚠️ `bloccata` finisce nel registro: è il caso in cui la decisione vale sui menu nuovi ma i
      // giorni già in calendario restano com'erano — chi rilegge la riga fra un mese deve saperlo.
      dettaglio: { azione: intento.azione, slots, giorniRifatti: rifatte, esitoGiorni: riuscita ? coda.esito : 'non_riuscita' },
    })) as { id: string };

    const riepilogo =
      (intento.azione === 'togli'
        ? `per ${cliente} ho tolto ${quali} — le kcal si ridistribuiscono sui pasti rimasti`
        : `per ${cliente} ho rimesso ${quali}`) +
      `. ${riuscita
        ? this.raccontaCoda(coda, 'dopo')
        : '⚠️ Sui giorni già preparati non sono riuscita a intervenire: restano con lo spuntino di prima, '
          + 'dai un\'occhiata al suo calendario.'}`;
    return { testo: testi.scritta(riepilogo), esito: 'scritta', azioneId: riga.id };
  }

  // ───────────────────────────────────────────────────────── conferma e scrittura ─

  /**
   * LA RISPOSTA A UNA DOMANDA GIRATA DA GAIA (Simone, 14/8): «da una parte o dall'altra il
   * nutrizionista risponde».
   *
   * Tre uscite: si detta la risposta e **parte davvero** alla cliente (e la segnalazione si
   * chiude); «la vedo io» chiude la domanda qui senza scrivere a nessuno (la segnalazione resta
   * aperta: se la vede lei, la chiude lei); «lascia stare» è l'annulla di sempre.
   *
   * ⚠️ Se la scrittura nella chat non riesce, la segnalazione NON si chiude e si dice: chiudere
   * una segnalazione per una risposta che non è partita è il modo di far sparire il problema
   * dalla pagina lasciandolo nel piatto della cliente.
   */
  private async rispondiAllaGirata(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const testo = (frase ?? '').trim();
    const cliente = stato.clienteNome ?? null;

    if (/^\s*(la vedo io|ci penso io|me ne occupo io|la gestisco io|rispondo io)\b/i.test(normalizza(testo))) {
      if (stato.richiestaId) {
        await this.richieste.chiudiSenzaRisposta(stato.richiestaId, nutrizionistaId, 'La nutrizionista risponde direttamente.');
      }
      const dopo = await this.cosaTiPorto(nutrizionistaId);
      return {
        testo: `${testi.laVedoIo()}${dopo ? `\n\n${dopo.testo}` : ''}`,
        esito: 'in_corso',
        stato: dopo?.stato,
      };
    }
    if (leggiConferma(testo) === false || /^\s*(lascia stare|lascia perdere|annulla)\b/i.test(normalizza(testo))) {
      return { testo: testi.annullato(), esito: 'annullata' };
    }
    if (testo.length < 3) {
      return { testo: testi.girataDaGaia(1, cliente, stato.frase), esito: 'in_corso', stato };
    }

    /**
     * ⛔ **PRIMA DI INOLTRARE, SI PROVA A CAPIRE** (31/8).
     *
     * Con una segnalazione aperta questo ramo riceveva **qualunque** frase e la trattava come il
     * corpo della risposta alla cliente: `parla` non chiama `capisci` quando c'è uno stato aperto
     * (`nuovoGiro` non viene proprio eseguito), e qui dentro nessuna riga guardava cosa ci fosse
     * scritto. Così «il merluzzo può essere sostituito con orata, salmone o spigola, estendi la
     * regola a tutti» è stata **inoltrata testualmente alla cliente**, la segnalazione è stata
     * chiusa, e Vera ha risposto «Fatto: l'ho scritta a Dany… e ho chiuso la segnalazione».
     * Nessuna regola era stata creata. ⛔ *Fare la cosa sbagliata con sicurezza è peggio che non
     * farla*: un «fatto» nessuno lo ricontrolla.
     *
     * ⚠️ **Non si dirotta in automatico**, come fa `confermaOAnnulla` col suo `capisci` di riserva:
     * lì la frase precedente non era stata capita, qui invece «puoi sostituire il merluzzo con
     * l'orata» può essere benissimo la risposta vera a una cliente che l'ha chiesto. Le due cose si
     * distinguono solo sapendo cosa aveva in mente chi scrive: quindi si chiede, una riga sola, e
     * la frase si tiene da parte.
     */
    if (capisci(testo)) {
      return {
        testo: testi.rispostaORegola(cliente),
        esito: 'in_corso',
        stato: { ...stato, passo: 'risposta_o_regola', bozzaRisposta: testo },
      };
    }

    return this.mandaLaRisposta(nutrizionistaId, stato, testo, cliente);
  }

  /** L'invio vero e proprio: usato dalla risposta diretta e da chi, al bivio, sceglie «mandala». */
  private async mandaLaRisposta(
    nutrizionistaId: string,
    stato: StatoVera,
    testo: string,
    cliente: string | null,
  ): Promise<EsitoVera> {
    const ruolo = await this.ruolo(nutrizionistaId);
    const mandata = await scriviAllaCliente(this.prisma, {
      clienteId: stato.clienteId!,
      autoreId: nutrizionistaId,
      ruoloAutore: ruolo,
      testo,
    });
    if (!mandata) {
      return { testo: testi.rispostaNonMandata(cliente), esito: 'arresa', stato };
    }
    if (stato.richiestaId) {
      await this.richieste.chiudiSenzaRisposta(stato.richiestaId, nutrizionistaId, testo);
    }
    await chiudiSegnalazione(this.prisma, stato.escalationId ?? null, nutrizionistaId);

    const dopo = await this.cosaTiPorto(nutrizionistaId);
    return {
      testo: `${testi.rispostaMandata(cliente)}${dopo ? `\n\n${dopo.testo}` : ''}`,
      esito: 'scritta',
      stato: dopo?.stato,
    };
  }

  // ──────────── gli allergeni della ricetta appena approvata (voce 227) ──

  /**
   * LA DOMANDA, subito dopo l'approvazione (voce 227; foglio
   * `progetto/NOTA_Vera_Allergeni_Ricetta_Nuova.md`).
   *
   * ⚠️ I suggerimenti si calcolano con `suggestAllergens`, **la stessa funzione della scheda**: due
   * dizionari sarebbero due risposte diverse alla stessa domanda, date nella stessa applicazione.
   * E si mostra il **perché** di ognuno — la parola dell'ingrediente — perché un elenco di allergeni
   * senza il perché si conferma senza guardarlo.
   *
   * `null` = non sono riuscita a leggere la ricetta: allora non si chiede niente e si va avanti,
   * invece di aprire un dialogo su un piatto che non so nominare.
   */
  private async chiediAllergeniRicetta(recipeId: string): Promise<EsitoVera | null> {
    let ricetta: { name: string; ingredients: unknown } | null = null;
    try {
      ricetta = (await this.prisma.recipe.findUnique({
        where: { id: recipeId },
        select: { name: true, ingredients: true },
      })) as { name: string; ingredients: unknown } | null;
    } catch (err) {
      logger.warn(`Allergeni: non leggo la ricetta ${recipeId}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
    if (!ricetta) return null;

    const suggeriti = suggestAllergens(ricetta.ingredients) as Suggerimento[];
    return {
      testo: testi.chiediAllergeni(ricetta.name, raccontaSuggerimenti(suggeriti)),
      esito: 'in_corso',
      stato: {
        passo: 'allergeni_ricetta',
        frase: '',
        ricettaAllergeniId: recipeId,
        ricettaAllergeniNome: ricetta.name,
        allergeniSuggeriti: suggeriti.map((x) => x.allergen),
      },
    };
  }

  /**
   * La risposta alla domanda.
   *
   * ⚠️ Il «sì» scrive SUBITO, l'elenco dettato no. Non è un'asimmetria distratta: il sì conferma una
   * lista che ha appena **letto**, mentre un elenco dettato è contenuto nuovo — e questa lista
   * decide se una cliente allergica riceve quel piatto. Vale la regola di casa, i numeri e le liste
   * si mostrano prima di scriverli, e qui vale doppio.
   *
   * ⚠️ `aggiungi` fa l'UNIONE con i suggeriti. «Sì, aggiungi anche il sesamo» letto come elenco
   * perderebbe pesce e glutine: dimenticare un allergene è l'errore che qui non si può fare.
   */
  private async rispondiAllergeni(attoreId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const nome = stato.ricettaAllergeniNome ?? 'la ricetta';
    const suggeriti = stato.allergeniSuggeriti ?? [];

    /**
     * ⚠️ DENTRO LA CODA, «salta» e «basta» valgono anche qui (18/8). Sono le parole che la coda
     * insegna a usare a ogni riga: se sull'unico passo che non è suo cadessero nel «non ho capito»,
     * la nutrizionista imparerebbe che i comandi valgono a volte — che è come non averli.
     * ⚠️ Si intercettano SOLO questi due: «sì» e un elenco dettato restano di `leggiAllergeni`,
     * che è la funzione che sa leggere gli allergeni.
     */
    if (stato.daCoda) {
      const comando = leggiRispostaApprovazione(frase);
      if (comando === 'salta') {
        const chiave = chiaveVoce({ tipo: 'allergeni', id: stato.ricettaAllergeniId! });
        const dopo = await this.apriCodaApprovazioni([...(stato.saltate ?? []), chiave], stato.approvate ?? 0);
        return { ...dopo, testo: `${fraseSaltata(nome)}\n\n${dopo.testo}` };
      }
      if (comando === 'basta') {
        let restano = 0;
        try {
          restano = contaCoda(await this.dieteInRevisione()).totale;
        } catch {
          restano = 0;
        }
        return { testo: fraseInterrotta(restano), esito: 'annullata' };
      }
    }

    if (/^\s*(lascia stare|lascia perdere|annulla|dopo|non adesso|piu tardi|più tardi)\b/i.test(normalizza(frase))) {
      return { testo: testi.allergeniLasciati(nome), esito: 'annullata' };
    }

    const letto: EsitoAllergeni | null = leggiAllergeni(frase);
    if (!letto) {
      const tentativi = (stato.tentativi ?? 0) + 1;
      if (tentativi >= MAX_TENTATIVI) return { testo: testi.allergeniLasciati(nome), esito: 'arresa' };
      return {
        testo: testi.allergeniNonCapiti(raccontaSuggerimenti(await this.suggeritiDi(stato))),
        esito: 'non_capito',
        stato: { ...stato, tentativi },
      };
    }

    // Il sì: quelli mostrati, già letti. Si scrive.
    if (letto.tipo === 'tutti') return this.scriviAllergeni(attoreId, stato, suggeriti);

    const scelti =
      letto.tipo === 'nessuno' ? []
        : letto.tipo === 'aggiungi' ? [...new Set([...suggeriti, ...letto.codici])]
          : letto.codici;

    return {
      testo: testi.anteprimaAllergeni(nome, raccontaScelti(scelti)),
      esito: 'in_corso',
      stato: { ...stato, passo: 'allergeni_conferma', allergeniScelti: scelti, tentativi: 0 },
    };
  }

  /** I suggerimenti col loro perché, ricalcolati per poter rifare la domanda uguale. */
  private async suggeritiDi(stato: StatoVera): Promise<Suggerimento[]> {
    const ricetta = (await this.prisma.recipe
      .findUnique({ where: { id: stato.ricettaAllergeniId! }, select: { ingredients: true } })
      .catch(() => null)) as { ingredients: unknown } | null;
    return ricetta ? (suggestAllergens(ricetta.ingredients) as Suggerimento[]) : [];
  }

  /** Il sì sull'elenco dettato. Un no riporta alla domanda, non chiude il giro. */
  private async confermaAllergeni(attoreId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const nome = stato.ricettaAllergeniNome ?? 'la ricetta';
    const risposta = leggiConferma(frase);
    if (risposta === true) return this.scriviAllergeni(attoreId, stato, stato.allergeniScelti ?? []);
    if (risposta === false) {
      return {
        testo: testi.chiediAllergeni(nome, raccontaSuggerimenti(await this.suggeritiDi(stato))),
        esito: 'in_corso',
        stato: { ...stato, passo: 'allergeni_ricetta', allergeniScelti: undefined, tentativi: 0 },
      };
    }
    return {
      testo: testi.anteprimaAllergeni(nome, raccontaScelti(stato.allergeniScelti ?? [])),
      esito: 'in_corso',
      stato,
    };
  }

  /**
   * La scrittura, dalla **porta della scheda**: `setRecipeAllergens` filtra sui 14 codici UE, mette
   * `allergensReviewed: true` e lascia la traccia in audit. Nessuna seconda strada per un dato
   * sanitario.
   */
  private async scriviAllergeni(attoreId: string, stato: StatoVera, codici: readonly string[]): Promise<EsitoVera> {
    const nome = stato.ricettaAllergeniNome ?? 'la ricetta';
    try {
      await this.ricette.setRecipeAllergens(attoreId, stato.ricettaAllergeniId!, [...codici]);
    } catch (err) {
      logger.warn(`Allergeni non scritti (ricetta=${stato.ricettaAllergeniId}): ${err instanceof Error ? err.message : String(err)}`);
      return { testo: testi.allergeniLasciati(nome), esito: 'arresa' };
    }
    /**
     * ⚠️ SE IL GIRO È NATO DALLA CODA, ALLA CODA SI TORNA (18/8). Senza questo, confermare gli
     * allergeni di una ricetta faceva ripartire `cosaTiPorto` — cioè un'altra coda — e le altre
     * cinquanta ricette da approvare sparivano dalla conversazione senza che nessuno lo dicesse.
     * `approvate + 1`: confermare gli allergeni È una delle cose che aspettavano una firma.
     */
    if (stato.daCoda) {
      /**
       * ⚠️ LA CHIAVE VA IN `saltate` ANCHE QUANDO LA SCRITTURA È RIUSCITA. Sembra ridondante — la
       * riga scritta non ricompare nella coda — ma è la sola cosa che garantisce che la coda
       * AVANZI: se un giorno la scrittura tornasse senza aver cambiato il campo, avanzare
       * «perché ho scritto» farebbe rifare la stessa domanda all'infinito. Si avanza perché
       * questa riga l'abbiamo guardata, non perché il database ci ha creduto.
       * ⚠️ E non nasconde l'accensione della stessa ricetta: quella ha una chiave diversa
       * (`ricetta:` invece di `allergeni:`), e infatti è la domanda giusta da fare subito dopo.
       */
      const chiaveFatta = chiaveVoce({ tipo: 'allergeni', id: stato.ricettaAllergeniId! });
      const inCoda = await this.apriCodaApprovazioni([...(stato.saltate ?? []), chiaveFatta], (stato.approvate ?? 0) + 1);
      return {
        testo: `${testi.allergeniScritti(nome, raccontaScelti(codici))}\n\n${inCoda.testo}`,
        esito: 'scritta',
        stato: inCoda.stato,
      };
    }
    const dopo = await this.cosaTiPorto(attoreId);
    return {
      testo: `${testi.allergeniScritti(nome, raccontaScelti(codici))}${dopo ? `\n\n${dopo.testo}` : ''}`,
      esito: 'scritta',
      stato: dopo?.stato,
    };
  }

  // ───────────── i cambi concordati in chat, verificati a voce (voce 245) ──

  /**
   * LA PROSSIMA SOSTITUZIONE DA VERIFICARE, portata in chat (voce 245, lettura **A** di Simone del
   * 14/8; foglio `progetto/DECISIONE_Verificare_Cambi_A_Voce.md`).
   *
   * Il quadro della giornata le **conta** già («3 sostituzioni da verificare»); qui si porta la
   * prima dentro la conversazione, con quanto serve per decidere. `null` = non c'è niente, e allora
   * non si dice niente: chi chiama sa se deve rispondere «nessuna» o tacere.
   *
   * ⚠️ Sotto `try`: sta dentro `cosaTiPorto`, che gira a ogni apertura di pagina e dopo ogni
   * decisione. Se questa lettura si rompe la cosa giusta è che non si veda — non che la
   * nutrizionista non riesca più a parlare con l'assistente.
   */
  private async prossimaSostituzione(userId: string): Promise<EsitoVera | null> {
    let riga: Awaited<ReturnType<RegistroVeraService['prossimaDaVerificare']>> = null;
    let quante = 0;
    try {
      [riga, quante] = await Promise.all([
        this.registro.prossimaDaVerificare(userId),
        this.registro.sostituzioniDaVerificare(userId),
      ]);
    } catch (err) {
      logger.warn(`Cambi da verificare: non li leggo (utente=${userId}): ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
    if (!riga) return null;
    const racconto = raccontaSostituzione(riga);
    return {
      testo: testi.cambioDaVerificare(racconto, Math.max(quante, 1)),
      esito: 'in_corso',
      stato: {
        passo: 'verifica_cambio',
        frase: '',
        sostituzioneId: riga.id,
        sostituzioneCliente: riga.cliente,
        clienteId: riga.clientId,
        clienteNome: riga.cliente,
      },
    };
  }

  /**
   * ✓ o ✗ — e **il numero blocca il giro**.
   *
   * Tre uscite, e la terza è quella che rende sicura tutta la lettura A:
   *  - «va bene» → `verificata`, per la stessa porta del pulsante in scheda;
   *  - «no» → `annullata`, col motivo **solo se lo dice lei** (Vera non lo chiede: in scheda oggi il
   *    rifiuto non chiede niente, e un motivo obbligatorio su una coda veloce diventa «boh»);
   *  - un numero dettato → **non si scrive niente** e si manda in scheda. 70 ml di panna sono ~200
   *    kcal, 70 g di olio ~630: è il numero che decide il pasto, e va scritto guardando il campo.
   *
   * ⚠️ La riga si **rilegge** prima di scrivere. Lo stato è appeso a un messaggio, e fra la domanda
   * e la risposta può esserci passata una collega dalla scheda: scrivere `annullata` su una riga già
   * validata da qualcun altro, senza dirlo, è il modo silenzioso di disfare il lavoro di un'altra.
   */
  private async verdettoSostituzione(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const cliente = stato.sostituzioneCliente ?? 'questa cliente';
    const verdetto = leggiVerdetto(frase);

    if (verdetto === 'grammi') {
      // ⚠️ Si LASCIA da verificare e si resta sulla stessa riga: la coda non deve avanzare per un
      // giro che non ha deciso niente, altrimenti quella sostituzione sparisce dalla conversazione
      // senza che nessuno l'abbia guardata.
      return { testo: testi.cambioGrammiInScheda(cliente), esito: 'arresa' };
    }
    if (verdetto === null) {
      if (/^\s*(lascia stare|lascia perdere|dopo|non adesso|piu tardi|più tardi)\b/i.test(normalizza(frase))) {
        return { testo: testi.annullato(), esito: 'annullata' };
      }
      const tentativi = (stato.tentativi ?? 0) + 1;
      if (tentativi >= MAX_TENTATIVI) return { testo: testi.annullato(), esito: 'annullata' };
      const riga = await this.registro.prossimaDaVerificare(nutrizionistaId).catch(() => null);
      return {
        testo: testi.cambioNonCapito(riga ? raccontaSostituzione(riga) : ''),
        esito: 'non_capito',
        stato: { ...stato, tentativi },
      };
    }

    const ancora = (await this.prisma.foodSwap.findUnique({
      where: { id: stato.sostituzioneId! },
      select: { stato: true },
    })) as { stato: string } | null;
    if (!ancora || ancora.stato !== 'da_verificare') {
      const dopo = await this.prossimaSostituzione(nutrizionistaId);
      return {
        testo: `${testi.cambioSparito()}${dopo ? `\n\n${dopo.testo}` : ''}`,
        esito: 'annullata',
        stato: dopo?.stato,
      };
    }

    const motivo = verdetto === 'no' ? motivoDetto(frase) : null;
    await this.sostituzioni.aggiorna(nutrizionistaId, stato.sostituzioneId!, {
      stato: verdetto === 'ok' ? 'verificata' : 'annullata',
      ...(motivo ? { nota: motivo } : {}),
    });

    // Finita una, si porta la prossima: è una coda, e farsela richiedere una per volta sarebbe
    // esattamente il lavoro ripetitivo che questo giro esiste per togliere.
    const dopo = await this.prossimaSostituzione(nutrizionistaId);
    const detto = verdetto === 'ok' ? testi.cambioConfermato(cliente) : testi.cambioAnnullato(cliente, motivo);
    return {
      testo: `${detto}${dopo ? `\n\n${dopo.testo}` : ''}`,
      esito: 'scritta',
      stato: dopo?.stato,
    };
  }

  // ──────────── le tre code di approvazione del catalogo, una per volta (18/8) ──

  /**
   * QUELLO CHE ASPETTA UNA FIRMA IN CATALOGO, letto dalle sorgenti.
   *
   * Si guardano le diete in **bozza o in revisione**: sono quelle che il generatore riempie e che
   * nessuno ha ancora validato. Le ricette si prendono dalle GIORNATE di quelle diete (è la stessa
   * strada di `dietReviewStatus`, che è quella che scrive i tre contatori sulla pagina), e i gruppi
   * di equivalenza dal loro `productId`.
   *
   * ⚠️ Torna `[]` solo quando non c'è niente. Se la lettura si rompe **lancia**: chi chiama lo
   * trasforma in «non lo so», che è diverso da «non c'è niente da approvare». Su una coda di
   * verifica un finto zero è la bugia più comoda che ci sia.
   */
  private async dieteInRevisione(): Promise<DietaInRevisione[]> {
    const diete = (await this.prisma.diet.findMany({
      where: { status: { in: ['draft', 'in_review'] } } as never,
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, dayTemplates: { select: { meals: true } } },
      take: 60,
    })) as { id: string; name: string; dayTemplates: { meals: unknown }[] }[];
    if (!diete.length) return [];

    const perDieta = new Map<string, string[]>();
    const tutte = new Set<string>();
    for (const d of diete) {
      const ids = new Set<string>();
      for (const t of d.dayTemplates) {
        for (const m of (Array.isArray(t.meals) ? t.meals : []) as { recipeId?: string }[]) {
          if (m.recipeId) {
            ids.add(m.recipeId);
            tutte.add(m.recipeId);
          }
        }
      }
      perDieta.set(d.id, [...ids]);
    }

    const ricette = tutte.size
      ? ((await this.prisma.recipe.findMany({
          where: { id: { in: [...tutte] } },
          select: { id: true, name: true, active: true, allergensReviewed: true, mealSlot: true, kcal: true, ingredients: true },
        })) as { id: string; name: string; active: boolean; allergensReviewed: boolean; mealSlot: string; kcal: number; ingredients: unknown }[])
      : [];
    const perId = new Map(ricette.map((r) => [r.id, r]));

    const gruppi = (await this.prisma.equivalenceGroup.findMany({
      where: { productId: { in: diete.map((d) => d.id) } } as never,
      select: { id: true, name: true, status: true, productId: true, members: true },
    })) as { id: string; name: string; status: string; productId: string | null; members: unknown }[];

    return diete.map((d) => ({
      dietaId: d.id,
      dietaNome: d.name,
      ricette: (perDieta.get(d.id) ?? []).flatMap((id) => {
        const r = perId.get(id);
        if (!r) return [];
        return [{
          id: r.id,
          nome: r.name,
          attiva: r.active,
          allergeniVerificati: r.allergensReviewed,
          slot: r.mealSlot,
          kcal: r.kcal,
          ingredienti: (Array.isArray(r.ingredients) ? r.ingredients : []).map((i) => String((i as { name?: unknown })?.name ?? '')).filter(Boolean),
        }];
      }),
      combinazioni: gruppi
        .filter((g) => g.productId === d.id)
        .map((g) => ({
          id: g.id,
          nome: g.name,
          stato: g.status,
          alimenti: (((g.members as { items?: unknown })?.items ?? []) as unknown[]).map((x) => String(x)).filter(Boolean),
        })),
    }));
  }

  /**
   * In quante diete compare una ricetta. Serve a una frase sola, ed è una frase che conta:
   * accendere un piatto lo accende per tutte, e chi risponde deve saperlo prima di dire sì.
   */
  private quanteDiete(diete: readonly DietaInRevisione[], recipeId: string): number {
    return diete.filter((d) => d.ricette.some((r) => r.id === recipeId)).length;
  }

  /**
   * LA PROSSIMA COSA DA APPROVARE, portata in chat.
   *
   * ⚠️ La coda si **ricostruisce ogni volta** dalla banca dati, e non si porta dentro lo stato:
   * fra una risposta e l'altra può essere passata una collega dalla scheda, e continuare a chiedere
   * di una ricetta già accesa da un'altra è il modo di far disfare il lavoro fatto.
   *
   * ⚠️ Le ricette con gli allergeni ancora aperti non passano di qui: si consegnano al giro che
   * esiste già (`chiediAllergeniRicetta`), marcato `daCoda` perché alla fine torni in coda. Due
   * dialoghi diversi per la stessa domanda sarebbero due elenchi di allergeni diversi, scritti
   * dalla stessa persona nella stessa applicazione.
   */
  private async apriCodaApprovazioni(saltate: string[], approvate: number): Promise<EsitoVera> {
    let diete: DietaInRevisione[];
    try {
      diete = await this.dieteInRevisione();
    } catch (err) {
      logger.warn(`Coda approvazioni: non la leggo: ${err instanceof Error ? err.message : String(err)}`);
      return { testo: testi.guidaFonteRotta('le code di approvazione'), esito: 'arresa' };
    }

    const fila = costruisciCoda(diete, saltate);
    if (!fila.length) {
      return {
        testo: approvate > 0 || saltate.length ? fraseCodaFinita(approvate) : fraseCodaVuotaApprovazioni(),
        esito: approvate > 0 ? 'scritta' : 'in_corso',
      };
    }

    const voce = fila[0];
    if (voce.tipo === 'allergeni') {
      const domanda = await this.chiediAllergeniRicetta(voce.id);
      if (domanda?.stato) {
        return { ...domanda, stato: { ...domanda.stato, daCoda: true, saltate, approvate } };
      }
      // Non riesco a leggere quella ricetta: la salto e vado avanti, invece di piantarmi.
      return this.apriCodaApprovazioni([...saltate, chiaveVoce(voce)], approvate);
    }

    return {
      testo: testoVoce(voce, fila.length, this.quanteDiete(diete, voce.id)),
      esito: 'in_corso',
      stato: {
        passo: 'approvazione',
        frase: '',
        approvazioneTipo: voce.tipo,
        approvazioneId: voce.id,
        approvazioneNome: voce.nome,
        approvazioneDieta: voce.dietaNome,
        saltate,
        approvate,
      },
    };
  }

  /** L'apertura della coda: prima cosa c'è, poi la prima riga. */
  private async avviaApprovazioni(): Promise<EsitoVera> {
    let conto: ContoCoda;
    try {
      conto = contaCoda(await this.dieteInRevisione());
    } catch (err) {
      logger.warn(`Coda approvazioni: non conto: ${err instanceof Error ? err.message : String(err)}`);
      return { testo: testi.guidaFonteRotta('le code di approvazione'), esito: 'arresa' };
    }
    if (conto.totale === 0) return { testo: fraseCodaVuotaApprovazioni(), esito: 'in_corso' };
    const prima = await this.apriCodaApprovazioni([], 0);
    return { ...prima, testo: `${fraseApertura(conto)}\n\n${prima.testo}` };
  }

  /**
   * SÌ / NO / SALTA / BASTA — e il no non scrive niente.
   *
   * ⚠️ La riga si **rilegge** prima di scrivere, come per i cambi concordati: fra la domanda e la
   * risposta può esserci passata una collega. Se nel frattempo è già a posto lo si dice e si va
   * avanti, invece di riscrivere sopra il lavoro di un'altra senza dirlo.
   *
   * ⚠️ E se la scrittura fallisce **non si avanza dicendo che è fatta**: si dice che non è fatta e
   * si manda in scheda. Una coda che dice «✓» su una riga non scritta è peggio della coda.
   */
  private async rispostaApprovazione(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const saltate = stato.saltate ?? [];
    const approvate = stato.approvate ?? 0;
    const nome = stato.approvazioneNome ?? 'questa voce';
    const tipo = stato.approvazioneTipo!;
    const chiave = chiaveVoce({ tipo, id: stato.approvazioneId! });
    const risposta = leggiRispostaApprovazione(frase);

    if (risposta === 'basta') {
      let restano = 0;
      try {
        restano = contaCoda(await this.dieteInRevisione()).totale;
      } catch {
        restano = 0;
      }
      return { testo: fraseInterrotta(restano), esito: approvate > 0 ? 'scritta' : 'annullata' };
    }

    if (risposta === 'salta') {
      const dopo = await this.apriCodaApprovazioni([...saltate, chiave], approvate);
      return { ...dopo, testo: `${fraseSaltata(nome)}\n\n${dopo.testo}` };
    }

    if (risposta === 'no') {
      /**
       * ⚠️ Il no NON scrive. Una ricetta non approvata è già spenta, un gruppo non approvato è già
       * in bozza: il no È lo stato di adesso. Inventare qui una cancellazione o un «rifiutata»
       * darebbe a questa chat un potere che il pulsante equivalente non ha — e su una riga di
       * catalogo che sta in tre diete. Si lascia com'è, si dice dove si cambia davvero, e si toglie
       * dalla fila per questo giro.
       */
      const dopo = await this.apriCodaApprovazioni([...saltate, chiave], approvate);
      const voce: VoceDaApprovare = { tipo, id: stato.approvazioneId!, nome, dietaId: '', dietaNome: stato.approvazioneDieta ?? '' };
      return { ...dopo, testo: `${fraseLasciata(voce)}\n\n${dopo.testo}` };
    }

    if (risposta === null) {
      const tentativi = (stato.tentativi ?? 0) + 1;
      if (tentativi >= MAX_TENTATIVI) {
        return { testo: fraseInterrotta(0), esito: 'annullata' };
      }
      return {
        testo: `Non ho capito. Su **${nome}**: «sì» per approvarla, «no» per lasciarla com'è, «salta» per rivederla dopo, «basta» per fermarci.`,
        esito: 'non_capito',
        stato: { ...stato, tentativi },
      };
    }

    // ─── il sì: si rilegge, si scrive dalla porta di sempre, e solo dopo si avanza ───
    if (tipo === 'ricetta') {
      const ancora = (await this.prisma.recipe
        .findUnique({ where: { id: stato.approvazioneId! }, select: { active: true, allergensReviewed: true } })
        .catch(() => null)) as { active: boolean; allergensReviewed: boolean } | null;
      if (!ancora || ancora.active) {
        const dopo = await this.apriCodaApprovazioni([...saltate, chiave], approvate);
        return { ...dopo, testo: `${fraseSparita(nome)}\n\n${dopo.testo}` };
      }
      /**
       * ⚠️ IL CONTROLLO CHE VALE LA PENA AVERE DUE VOLTE. `costruisciCoda` non propone mai
       * l'accensione di una ricetta con gli allergeni aperti; qui si ricontrolla comunque, perché
       * fra la domanda e il «sì» qualcuno potrebbe averli riaperti dalla scheda — e accendere un
       * piatto non verificato è l'unico errore di questa coda che arriva nel piatto di una cliente.
       */
      if (!ancora.allergensReviewed) {
        const dopo = await this.apriCodaApprovazioni(saltate, approvate);
        return { ...dopo, testo: `Non la accendo: gli allergeni di **${nome}** sono tornati da confermare.\n\n${dopo.testo}` };
      }
      try {
        await this.ricette.updateRecipe(nutrizionistaId, stato.approvazioneId!, { active: true });
      } catch (err) {
        logger.warn(`Approvazione ricetta ${stato.approvazioneId} non scritta: ${err instanceof Error ? err.message : String(err)}`);
        const dopo = await this.apriCodaApprovazioni([...saltate, chiave], approvate);
        return { ...dopo, testo: `${fraseNonScritta(nome)}\n\n${dopo.testo}` };
      }
      // ⚠️ La chiave in `saltate` anche dopo un sì riuscito: si avanza perché la riga è stata
      // guardata, non perché la scrittura ha detto di sì. Vedi il commento in `scriviAllergeni`.
      const dopo = await this.apriCodaApprovazioni([...saltate, chiave], approvate + 1);
      return { ...dopo, testo: `${fraseApprovataRicetta(nome)}\n\n${dopo.testo}`, esito: 'scritta' };
    }

    const gruppo = (await this.prisma.equivalenceGroup
      .findUnique({ where: { id: stato.approvazioneId! }, select: { status: true } })
      .catch(() => null)) as { status: string } | null;
    if (!gruppo || gruppo.status === 'approved') {
      const dopo = await this.apriCodaApprovazioni([...saltate, chiave], approvate);
      return { ...dopo, testo: `${fraseSparita(nome)}\n\n${dopo.testo}` };
    }
    try {
      await this.combinazioni.approve(nutrizionistaId, stato.approvazioneId!);
    } catch (err) {
      logger.warn(`Approvazione gruppo ${stato.approvazioneId} non scritta: ${err instanceof Error ? err.message : String(err)}`);
      const dopo = await this.apriCodaApprovazioni([...saltate, chiave], approvate);
      return { ...dopo, testo: `${fraseNonScritta(nome)}\n\n${dopo.testo}` };
    }
    const dopo = await this.apriCodaApprovazioni([...saltate, chiave], approvate + 1);
    return { ...dopo, testo: `${fraseApprovataCombinazione(nome)}\n\n${dopo.testo}`, esito: 'scritta' };
  }

  /**
   * Il conto per il riquadro «quello che aspetta me». `null` = non lo so — che è diverso da zero, e
   * la pagina lo scrive diverso (stessa regola del pool sotto soglia).
   */
  async quanteApprovazioni(): Promise<ContoCoda | null> {
    try {
      return contaCoda(await this.dieteInRevisione());
    } catch (err) {
      logger.warn(`Coda approvazioni: non la conto per il riquadro: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /**
   * L'invito alle approvazioni dentro il quadro della giornata.
   *
   * ⚠️ `null` quando non c'è niente **e** quando non riesco a contare: qui il «non lo so» non si
   * scrive, perché il quadro ha già la sua riga per le fonti rotte (`guidaFonteRotta`) e due modi
   * di dire la stessa cosa nello stesso riquadro non aiutano nessuno.
   */
  private async invitoApprovazioni(): Promise<string | null> {
    try {
      return fraseInvitoCoda(contaCoda(await this.dieteInRevisione()));
    } catch (err) {
      logger.warn(`Coda approvazioni: non la conto per il quadro: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  // ──────────────────── la giornata dettata a parole (voce 241, lettura B) ──

  /**
   * «PER GIULIA DOMANI: COLAZIONE… PRANZO… CENA…» (decisione B di Simone, 14/8; foglio in
   * `progetto/DECISIONE_Menu_Dettati.md`).
   *
   * ⚠️ Il rischio della B è che «pasta al pomodoro» sia cinque ricette con calorie diverse.
   * Qui si chiude come ovunque: una sola → si propone; più d'una → si CHIEDE, con le calorie
   * accanto; nessuna → si dice. Non si sceglie mai al posto suo.
   */
  private async avviaGiornataDettata(
    nutrizionistaId: string,
    stato: StatoVera,
    intento: IntentoGiornata,
  ): Promise<EsitoVera> {
    const righe = leggiGiornataDettata(intento.testo);
    if (!righe.length) return { testo: testi.giornataNienteDaScrivere(), esito: 'in_corso' };

    const pool = await this.poolDellaCliente(stato.clienteId!);
    const abbinate = abbinaRighe(righe, pool);
    return this.prossimaDomandaGiornata(nutrizionistaId, { ...stato, righeGiornata: abbinate, scelteGiornata: [] });
  }

  /**
   * Le ricette approvate per QUELLA cliente: la sua base personale certificata.
   *
   * ⚠️ Si pesca solo da lì, come fa il cambio piatto di Gaia: fuori ci sono allergeni non
   * revisionati e regimi che non sono i suoi. Se il pool non c'è si torna a mani vuote — e la
   * giornata non si scrive — invece di ripiegare sul catalogo intero.
   */
  private async poolDellaCliente(clientId: string): Promise<RicettaCandidata[]> {
    const [pool, profilo] = await Promise.all([
      this.prisma.clientMenuPool.findFirst({
        where: { clientId } as never,
        orderBy: { version: 'desc' },
        select: { recipeIds: true },
      }) as unknown as Promise<{ recipeIds: string[] } | null>,
      /**
       * ⛔ **LE ESCLUSIONI DELLA CLIENTE, che qui non si leggevano** — 2/9, voce 953.
       *
       * Il commento qui sopra dice che fuori dal pool «ci sono allergeni non revisionati e regimi
       * che non sono i suoi». Vero, e incompleto: `clientMenuPool` filtra gli allergeni
       * **revisionati**, il regime e i **tag**, e **non** applica le regole per ingrediente di
       * `solfiti.ts` e `lattosio.ts`. Una ricetta revisionata senza tag `solfiti` ma con le
       * albicocche secche dentro passava, e la nutrizionista la scriveva sulla giornata di una
       * cliente che non tollera i solfiti **senza la riga che le dice cosa non mettere**.
       */
      this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: { allergies: true, intolerances: true, dislikedFoods: true },
      }) as unknown as Promise<ProfiloConEsclusioni | null>,
    ]);
    const ids = (pool?.recipeIds ?? []).filter(Boolean);
    if (!ids.length) return [];
    const ricette = (await this.prisma.recipe.findMany({
      where: { id: { in: ids }, active: true } as never,
      /** ⚠️ `ingredients` e `allergens` servono a `valutaRicetta`: senza, giudica a mani vuote. */
      select: { id: true, name: true, kcal: true, mealSlot: true, ingredients: true, allergens: true },
    })) as { id: string; name: string; kcal: number; mealSlot: string; ingredients: unknown; allergens?: string[] }[];

    const esclusioni = esclusioniDi(profilo);
    const out: RicettaCandidata[] = [];
    for (const r of ricette) {
      /**
       * ⛔ **Il nome entra come ingrediente**, come in `menu.service` e nel cambio piatto di Gaia:
       * su una ricetta con l'elenco vuoto o povero `valutaRicetta` non vedrebbe niente, e
       * «Insalata di gamberi e avocado» finirebbe nella giornata di un'allergica ai crostacei.
       */
      const { violations, subs } = valutaRicetta(
        {
          id: r.id,
          name: r.name,
          ingredients: [...(((r.ingredients as { name?: string }[]) ?? []).filter((i) => i?.name)), { name: r.name }],
          allergens: r.allergens ?? [],
        } as never,
        esclusioni,
      );
      /** ⛔ Un piatto che viola non si propone alla nutrizionista: non deve poterlo scegliere. */
      if (violations.length) continue;
      /**
       * ⚠️ **La sostituzione sul nome finto si butta**: le regole per ingrediente non sanno che il
       * nome è finto, e produrrebbero «al posto di *Ricotta con albicocche secche* metti
       * *albicocche essiccate in casa*». Il divieto lo si tiene, la riga assurda no.
       */
      out.push({
        recipeId: r.id, nome: r.name, kcal: r.kcal, slot: r.mealSlot,
        sostituzioni: subs.filter((x) => String((x as { from?: unknown })?.from ?? '') !== r.name),
      });
    }
    return out;
  }

  /**
   * Il giro: si prende la prima riga non ancora risolta. Se è ambigua si chiede; se non ha
   * candidate si dice e ci si ferma (una giornata a cui manca un pasto non si scrive); se è
   * risolta si passa avanti. Finite le righe, si mostra il totale.
   */
  private async prossimaDomandaGiornata(nutrizionistaId: string, stato: StatoVera): Promise<EsitoVera> {
    const righe = (stato.righeGiornata ?? []) as RigaAbbinata[];
    const scelte = (stato.scelteGiornata ?? []) as SceltaGiornata[];
    const fatti = new Set(scelte.map((s) => s.slot));

    for (const riga of righe) {
      if (fatti.has(riga.slot)) continue;
      const pasto = etichettaSlot(riga.slot);
      if (riga.esito === 'nessuna') {
        return { testo: testi.giornataPiattoAssente(pasto, riga.testo), esito: 'arresa' };
      }
      if (riga.esito === 'molte') {
        return {
          testo: testi.chiediQualePiatto(pasto, riga.testo, riga.candidate),
          esito: 'in_corso',
          stato: { ...stato, passo: 'giornata_scelte' },
        };
      }
      // Una sola: si prende, e si continua senza disturbare.
      const c = riga.candidate[0];
      return this.prossimaDomandaGiornata(nutrizionistaId, {
        ...stato,
        /** ⚠️ `sostituzioni` viaggia con la scelta fino alla scrittura: vedi `poolDellaCliente`. */
        scelteGiornata: [...scelte, { slot: riga.slot, recipeId: c.recipeId, nome: c.nome, kcal: c.kcal, sostituzioni: c.sostituzioni }],
      });
    }
    return this.anteprimaGiornata(nutrizionistaId, stato);
  }

  /** La risposta col numero, per una riga ambigua. */
  private async scegliPiattoGiornata(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const righe = (stato.righeGiornata ?? []) as RigaAbbinata[];
    const scelte = (stato.scelteGiornata ?? []) as SceltaGiornata[];
    const fatti = new Set(scelte.map((s) => s.slot));
    const daRisolvere = righe.find((r) => !fatti.has(r.slot) && r.esito === 'molte');
    if (!daRisolvere) return this.anteprimaGiornata(nutrizionistaId, stato);

    const n = Number((frase ?? '').trim().replace(/[^\d]/g, ''));
    const scelta = Number.isFinite(n) && n >= 1 && n <= daRisolvere.candidate.length ? daRisolvere.candidate[n - 1] : null;
    if (!scelta) {
      const tentativi = (stato.tentativi ?? 0) + 1;
      if (tentativi >= MAX_TENTATIVI) return { testo: testi.annullato(), esito: 'annullata' };
      return {
        testo: testi.chiediQualePiatto(etichettaSlot(daRisolvere.slot), daRisolvere.testo, daRisolvere.candidate),
        esito: 'in_corso',
        stato: { ...stato, tentativi },
      };
    }
    return this.prossimaDomandaGiornata(nutrizionistaId, {
      ...stato,
      tentativi: 0,
      scelteGiornata: [...scelte, { slot: daRisolvere.slot, recipeId: scelta.recipeId, nome: scelta.nome, kcal: scelta.kcal, sostituzioni: scelta.sostituzioni }],
    });
  }

  /**
   * Il totale contro l'obiettivo, PRIMA di scrivere.
   *
   * ⚠️ Fuori dal ±15% non si scrive (decisione di Simone): si dice di quanto sfora. ⚠️ E senza
   * obiettivo non si scrive lo stesso: «non lo so» non è «va bene», e una giornata approvata da un
   * controllo che non è stato fatto è peggio di una giornata non scritta.
   */
  private async anteprimaGiornata(nutrizionistaId: string, stato: StatoVera): Promise<EsitoVera> {
    const scelte = (stato.scelteGiornata ?? []) as SceltaGiornata[];
    if (!scelte.length) return { testo: testi.giornataNienteDaScrivere(), esito: 'in_corso' };

    /**
     * ⛔ **NON SOLO IL NUMERO: anche se quel numero è quello che la cliente sta mangiando** (28/8).
     *
     * Qui si prendeva `prima.target` e basta. Da quando il fabbisogno può essere **sospeso** —
     * pesate che non stanno in piedi fra loro — quel numero esce lo stesso dal calcolo ma i menu
     * usano il livello della dieta: giudicare una giornata dettata contro di lui vorrebbe dire
     * misurarla con un metro che non è quello nel piatto, e rispondere «ci sta dentro» a una domanda
     * a cui non si sa rispondere.
     */
    const stima = await this.kcal
      .simulaKcal({ sub: nutrizionistaId, role: await this.ruolo(nutrizionistaId) }, stato.clienteId!)
      .then((r) => r?.prima ?? null)
      .catch(() => null);
    const sospeso = stima?.pesoIncoerente ?? null;
    if (sospeso) return { testo: testi.giornataFabbisognoSospeso(sospeso.frase), esito: 'arresa' };
    const target = stima?.target ?? null;
    const conto = contaGiornata(scelte, target);
    if (conto.dentroTolleranza === null) return { testo: testi.giornataSenzaTarget(), esito: 'arresa' };
    if (!conto.dentroTolleranza) {
      return {
        testo: testi.giornataFuoriTolleranza(conto.kcal, target!, conto.scostamentoPct!),
        esito: 'arresa',
      };
    }
    const quando = stato.dataGiornata ?? 'domani';
    return {
      testo: testi.anteprimaGiornata(
        quando,
        scelte.map((s) => ({ pasto: etichettaSlot(s.slot), nome: s.nome, kcal: s.kcal })),
        conto.kcal,
        target,
        conto.scostamentoPct,
      ),
      esito: 'in_corso',
      stato: { ...stato, passo: 'conferma' },
    };
  }

  /**
   * La scrittura: un solo giorno, e solo se **non è ancora stato aperto**.
   *
   * ⚠️ Si scrive nel `meals` con lo stesso snapshot che usa il motore ({slot, recipeId, name,
   * kcal}): una giornata dettata dev'essere indistinguibile da una generata per tutto il resto
   * dell'applicazione — sostituzioni, allergeni, report.
   */
  private async scriviGiornataDettata(nutrizionistaId: string, stato: StatoVera): Promise<EsitoVera> {
    const scelte = (stato.scelteGiornata ?? []) as SceltaGiornata[];
    // ⚠️ «Domani» è domani **a Roma**. Con la mezzanotte UTC, una giornata dettata all'una di notte
    // finiva su OGGI: la nutrizionista dice «domani» e la cliente se la trova nel piatto stamattina.
    const domani = new Date(aGiorno(new Date()).getTime() + 86_400_000);

    /**
     * ⛔ **TRE MOTIVI PER NON SCRIVERE, E VANNO DETTI SEPARATI** (26/8, trovato in revisione).
     *
     * Prima il `where` conteneva `CHE_SI_POSSONO_RIFARE` e i tre motivi collassavano in un `null`
     * solo, raccontato con un «potrebbe averla già vista, o non essere ancora stata preparata» che
     * nel terzo caso è **falso due volte**. ⛔ E il terzo caso, il giorno del rilascio, è **tutti**:
     * `apertureTracciate` è falso su ogni riga, quindi la nutrizionista che ha appena composto la
     * giornata pasto per pasto e ha letto l'anteprima con le kcal si sentiva rispondere una ragione
     * inventata. Adesso il giorno si cerca e basta, e a dire perché non si scrive è la riga che si è
     * trovata.
     */
    const giorno = (await this.prisma.menuDay.findFirst({
      where: { clientId: stato.clienteId!, date: domani } as never,
      select: { id: true, apertoDallaClienteIl: true, apertureTracciate: true } as never,
    })) as { id: string; apertoDallaClienteIl?: Date | null; apertureTracciate?: boolean } | null;
    if (!giorno) {
      return {
        testo: 'La giornata di domani non è ancora stata preparata: non c\'è niente su cui scrivere. Non scrivo niente.',
        esito: 'arresa',
      };
    }
    if (laClienteLHaAperto(giorno)) {
      return {
        testo:
          'Il menu di domani lo ha già aperto in app: quello resta suo — magari ci ha già fatto la spesa. ' +
          'Non scrivo niente.',
        esito: 'arresa',
      };
    }
    if (nonSappiamoSeLHaAperto(giorno)) {
      return {
        testo:
          'Non so dirti se ha già aperto il menu di domani: la sua app non me lo dice ancora, e nel dubbio ' +
          'non le riscrivo una giornata che potrebbe avere in mano. Se vuoi cambiargliela lo stesso c\'è ' +
          '«Rigenera menu» dalla sua scheda. Non scrivo niente.',
        esito: 'arresa',
      };
    }

    await this.prisma.menuDay.update({
      where: { id: giorno.id },
      data: {
        /**
         * ⛔ **Le sostituzioni di ingrediente si scrivono sul pasto** — 2/9, voce 953. Prima questa
         * riga teneva quattro campi, e la giornata dettata dalla nutrizionista nasceva con
         * `substitutions` vuoto: se il piatto si poteva servire solo cambiando un ingrediente, la
         * cliente lo riceveva **senza la riga che glielo dice**.
         *
         * ⚠️ Il campo si scrive solo quando ce n'è almeno una: un `[]` scritto apposta è
         * indistinguibile da «nessuno l'ha guardato».
         */
        meals: scelte.map((s) => ({
          slot: s.slot, recipeId: s.recipeId, name: s.nome, kcal: s.kcal,
          ...((s.sostituzioni ?? []).length ? { substitutions: s.sostituzioni } : {}),
        })) as never,
      },
    });

    const kcal = scelte.reduce((n, s) => n + s.kcal, 0);
    const riga = (await this.registro.scrivi({
      nutrizionistaId,
      frase: stato.frase,
      azione: 'variante_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: stato.clienteId ?? null,
      soggettoNome: stato.clienteNome ?? null,
      dettaglio: { giornataDettata: { data: domani.toISOString().slice(0, 10), kcal, pasti: scelte } },
    })) as { id: string };
    return { testo: testi.giornataScritta('domani', kcal), esito: 'scritta', azioneId: riga.id };
  }

  // ──────────────────────── le proteine: la quota minima di questa cliente ──

  /**
   * «RIFAI CON PIÙ PROTEINE» (decisione A di Simone, 14/8; foglio in
   * `progetto/DECISIONE_Piu_Proteine.md`).
   *
   * La banda proteica esisteva già ma solo per DIETA: qui si scrive la quota minima **di questa
   * cliente**, che vince sulla sua. ⚠️ Si mostra la PERCENTUALE, non «più proteine»: un aggettivo
   * non si può né confermare né controllare il mese dopo.
   */
  private async anteprimaProteine(stato: StatoVera, intento: IntentoProteine): Promise<EsitoVera> {
    const profilo = (await this.prisma.clientProfile.findUnique({
      where: { userId: stato.clienteId! },
      select: { proteinMinPct: true },
    })) as { proteinMinPct: number | null } | null;
    // Il minimo di adesso: il suo se ce l'ha, altrimenti quello della dieta (il default del motore
    // se il parametro non è impostato — qui basta come punto di partenza da mostrare).
    const minimoDietaG = await this.configParams.getNumber('menu_daycombo_protein_min', 0.2).catch(() => 0.2);
    const prima = quotaProteicaMinima(profilo?.proteinMinPct ?? null, minimoDietaG);
    const dopo = intento.pct ?? minimoDaPiuProteine(prima);

    if (Math.abs(dopo - prima) < 0.005) {
      return { testo: testi.proteineGiaCosi(stato.clienteNome ?? 'lei', prima), esito: 'annullata' };
    }
    return {
      // ⚠️ L'anteprima promette quello che poi succede davvero: prometteva «i giorni futuri che non
      // ha ancora aperto si rifanno», e poteva finire col non rifarne nessuno (vedi `applicaProteine`).
      testo: testi.anteprimaProteine(
        stato.clienteNome ?? 'lei',
        prima,
        dopo,
        this.raccontaCoda(await this.codaProteine(stato.clienteId!)),
      ),
      esito: 'in_corso',
      stato: { ...stato, passo: 'conferma', proteinePrima: prima, proteineDopo: dopo },
    };
  }

  /**
   * ⛔ **CAMBIARE LE PROTEINE TOCCA OGNI GIORNATA**, quindi «i colpiti» sono tutti i giorni che si
   * possono ancora rifare — e da lì in poi vale la regola della coda come per tutti gli altri.
   *
   * ⛔ Prima qui c'era `deleteMany({ viewedAt: null, date: { gte: oggi } })`: cancellava i giorni non
   * aperti e **lasciava in piedi quelli letti**. Se lei aveva già aperto un menu più avanti — basta
   * un tocco sul calendario — quel giorno restava l'ultimo, i giorni cancellati prima di lui non
   * tornavano **mai**, e l'erogazione restava ferma **del tutto** finché quella data non passava.
   * Era il peggiore dei tre punti, ed era quello con la frase più sicura di sé in anteprima.
   */
  private async codaProteine(clientId: string): Promise<CodaDaRifare> {
    const tutti = await this.giorniFuturi(clientId, new Date());
    /**
     * ⚠️ **Colpite sono TUTTE**, e il predicato lo dice in chiaro: `giorniFuturi` già rende solo i
     * giorni da `daQuandoSiPuoRifare` in poi, e cambiare le proteine tocca ognuno di loro. Fino al
     * 26/8 qui c'era `siPuoRifare`, che mescolava dentro il predicato la domanda «lo posso
     * cancellare?»: su una cliente di cui non sappiamo niente i colpiti diventavano zero e
     * l'anteprima prometteva «nessuna giornata da rifare» invece di dire «non lo so».
     */
    return codaDaRifare(tutti, () => true);
  }

  /**
   * Quanti pasti tiene la finestra di quel protocollo. ⚠️ Non è un conto: è la **tabella** del
   * manuale (`pastiDellaFinestra`), la stessa che compone i menu. Un secondo conto qui direbbe alla
   * nutrizionista un numero e alla cliente ne metterebbe un altro nel piatto.
   */
  private pastiDelProtocollo(protocollo: string): number {
    const p = protocolloDigiuno(protocollo);
    return p ? pastiDellaFinestra(p.oreFinestra).length : 0;
  }

  /**
   * ⛔ **LA RISPOSTA ALLA DOMANDA «A QUALE?»** (25/8).
   *
   * ⚠️ Si rilegge con lo **stesso lettore** della frase di partenza, non con un confronto scritto a
   * mano: «18:6», «avanzato», «il 18:6» devono valere qui come valevano lì. Un secondo modo di
   * leggere un protocollo è un secondo modo di sbagliarlo.
   *
   * ⚠️ E se non si capisce non si insiste all'infinito: si dice cosa scrivere e si lascia la
   * domanda aperta, come fanno tutti gli altri passi.
   */
  private async scegliDigiuno(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    /**
     * ⚠️ Alla risposta secca — «18:6» — manca il verbo, quindi `leggiDigiunoDettato` da sola non
     * accetterebbe le forme corte. Qui il contesto **è** la domanda appena fatta: siamo dentro
     * «quali ore?», e non c'è nient'altro che quella risposta possa essere.
     */
    const letto = leggiDigiunoDettato(frase) ?? leggiDigiunoDettato(`digiuno ${frase}`);
    if (!letto) {
      return { testo: testi.qualeDigiunoNonCapito(), esito: 'in_corso', stato };
    }
    const intento = { ...(stato.intento as IntentoDigiuno), protocollo: letto.protocollo };
    return this.anteprimaDigiuno({ ...stato, intento }, intento);
  }

  /**
   * ⛔ **LE ORE DEL DIGIUNO, VISTE PRIMA DI SCRIVERLE** (25/8).
   *
   * ⚠️ **Si mostra cosa cambia davvero**, non «ok fatto»: il protocollo di adesso, quello nuovo, e
   * **quanti pasti** avrà la sua giornata — perché è quello che una cliente vede la mattina dopo, ed
   * è la parte che una nutrizionista deve poter fermare prima che succeda. Passare da 16:8 a 23:1
   * vuol dire un pasto solo al giorno: dirlo in cifre è diverso da farlo leggere in un codice.
   *
   * ⚠️ **Se il protocollo non l'ha detto, si chiede.** «Cambia il digiuno di Giulia» non dice a
   * cosa, e indovinare vorrebbe dire scrivere nel piano di una persona un numero che nessuno ha
   * scelto.
   */
  private async anteprimaDigiuno(stato: StatoVera, intento: IntentoDigiuno): Promise<EsitoVera> {
    if (!intento.protocollo) {
      /**
       * ⛔ **E la domanda si può RISPONDERE** — corretto al secondo giro di revisione, 25/8. Qui si
       * rendeva lo stato **invariato**, che al passo del cambio dieta ci si ricorda di cambiare
       * (`passo: 'quale_dieta'`) e qui no: lo stato restava `quale_cliente`, quindi la risposta
       * «18:6» finiva in `risolviCliente` e Vera diceva *«non trovo nessuna cliente che si chiami
       * 18:6»*. Una domanda a cui non si può rispondere è peggio di una domanda non fatta.
       */
      return {
        testo: testi.qualeDigiuno(stato.clienteNome ?? 'lei'),
        esito: 'in_corso',
        stato: { ...stato, passo: 'quale_digiuno' },
      };
    }
    const profilo = (await this.prisma.clientProfile.findUnique({
      where: { userId: stato.clienteId! },
      select: { pathType: true, fastingProtocol: true, fastingStartMin: true, fastingTargetStartMin: true } as never,
    })) as {
      pathType: string | null; fastingProtocol: string | null;
      fastingStartMin: number | null; fastingTargetStartMin: number | null;
    } | null;

    /**
     * ⛔ **Chi non è in digiuno non ci si mette da qui.** Passare una cliente al digiuno intermittente
     * è un cambio di **percorso** — tocca la dieta, i pasti, il catalogo — e ha la sua strada
     * (`cambio_dieta`). Farlo di rimbalzo scrivendo un protocollo su un profilo che non ha
     * l'orologio le lascerebbe uno schermo che dice una cosa e un piatto che ne dice un'altra.
     */
    if (profilo?.pathType !== 'intermittent_fasting') {
      return { testo: testi.nonEInDigiuno(stato.clienteNome ?? 'lei'), esito: 'annullata' };
    }
    if (profilo.fastingProtocol === intento.protocollo) {
      return { testo: testi.digiunoGiaCosi(stato.clienteNome ?? 'lei', intento.protocollo), esito: 'annullata' };
    }

    return {
      testo: testi.anteprimaDigiuno(
        stato.clienteNome ?? 'lei',
        profilo.fastingProtocol ?? null,
        intento.protocollo,
        this.pastiDelProtocollo(intento.protocollo),
        /**
         * ⛔ **Le giornate già preparate vanno rifatte, e l'anteprima lo dice.** La struttura dei
         * pasti la usa il compositore al momento di comporre: senza rifare la coda, la cliente
         * continuerebbe a vedere tre pasti nei giorni già in calendario mentre l'orologio ne dice
         * uno. È il caso Lorena, e il progetto ha già la sua sentinella
         * (`menu/una-porta-per-i-giorni.spec.ts`): ogni percorso che cambia i menu passa da
         * `codaDaRifare`. Questo, nella prima stesura, non ci passava — e **dichiarava di averlo
         * fatto**.
         */
        // ⚠️ Una lettura sola: chiamandola due volte si rischierebbe di mostrarne una e rifarne
        // un'altra — la coda si muove, e sono i menu di una persona.
        // ⛔ E si passa la **frase**, non il numero: `quanteDaRifare` vale 0 sia per «non ce n'erano»
        // sia per «non lo so», e quei due zeri raccontati uguale sono il difetto di questa voce.
        this.raccontaCoda(await this.codaProteine(stato.clienteId!)),
        // Il piano graduale in corso: cambiando le ore si chiude, e chi conferma deve saperlo.
        typeof profilo.fastingTargetStartMin === 'number'
          && profilo.fastingTargetStartMin !== profilo.fastingStartMin,
      ),
      esito: 'in_corso',
      stato: { ...stato, passo: 'conferma', digiunoPrima: profilo.fastingProtocol ?? null, digiunoDopo: intento.protocollo },
    };
  }

  /**
   * ⛔ **LA SCRITTURA PASSA DA `decidiCambio`, come quella della cliente.**
   *
   * ⚠️ È la regola di casa: *se due punti rispondono alla stessa domanda, uno deve chiamare l'altro*.
   * Qui la domanda è «che finestra ha, da quando, e quanti pasti» — e ha già una risposta sola, che
   * sa dei piani graduali, delle finestre già aperte e dei pasti da derivare. Scrivere il protocollo
   * a mano avrebbe prodotto una cliente con le ore nuove e i pasti di prima.
   *
   * ⚠️ `perStaff: true` toglie i limiti — quello settimanale sulle ore e quello giornaliero sulla
   * lancetta — ed è esattamente il punto: la regola della cliente dice «chiedilo alla tua
   * nutrizionista», e questa è lei.
   */
  private async applicaDigiuno(nutrizionistaId: string, stato: StatoVera): Promise<EsitoVera> {
    const protocollo = stato.digiunoDopo!;
    const esito = await this.digiuno.impostaPerStaff(stato.clienteId!, { protocollo }, nutrizionistaId);
    if (!esito.ok) return { testo: testi.digiunoNonScritto(stato.clienteNome ?? 'lei', esito.perche), esito: 'annullata' };

    /**
     * ⛔ **E I GIORNI GIÀ PREPARATI SI RIFANNO** — la stessa regola delle proteine e del cambio di
     * dieta: si rifà una **coda**, non i giorni sparsi, e solo quelli che non ha ancora aperto.
     * ⚠️ Se la cancellazione non riesce **non si dice «ho rifatto»**: è la lezione del 24/8, dove un
     * `catch` silenzioso faceva leggere alla nutrizionista un successo che non c'era, e il registro
     * lo scriveva pure.
     */
    const coda = await this.codaProteine(stato.clienteId!);
    let rifatti = 0;
    let riuscita = true;
    if (coda.esito === 'coda') {
      const fatta = await this.prisma.menuDay
        .deleteMany({ where: { id: { in: coda.giorni.map((g) => g.id) } } })
        .then(() => true)
        .catch((err: unknown) => {
          logger.warn(
            `Ore del digiuno scritte ma giorni non rifatti (cliente=${stato.clienteId}): ` +
              `${err instanceof Error ? err.message : String(err)}`,
          );
          return false;
        });
      riuscita = fatta;
      if (fatta) rifatti = quanteDaRifare(coda);
    }

    const riga = (await this.registro.scrivi({
      nutrizionistaId,
      frase: stato.frase,
      azione: 'variante_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: stato.clienteId ?? null,
      soggettoNome: stato.clienteNome ?? null,
      // ⚠️ `esitoGiorni` accanto al numero, come negli altri due percorsi: `0` non dice **perché**,
      // e chi rilegge la riga fra un mese deve poter distinguere «non ce n'erano» da «non lo so».
      dettaglio: {
        digiuno: {
          prima: stato.digiunoPrima ?? null, dopo: protocollo, daQuando: esito.daQuando,
          giorniRifatti: rifatti, esitoGiorni: riuscita ? coda.esito : 'non_riuscita',
        },
      },
    })) as { id: string };

    const dopo = await this.cosaTiPorto(nutrizionistaId);
    return {
      testo:
        `${testi.digiunoScritto(
          stato.clienteNome ?? 'lei',
          protocollo,
          esito.daQuando,
          riuscita
            ? this.raccontaCoda(coda, 'dopo')
            : '⚠️ Sui giorni già preparati non sono riuscita a intervenire: restano con i pasti di prima, '
              + 'dai un\'occhiata al suo calendario.',
        )}${dopo ? `\n\n${dopo.testo}` : ''}`,
      esito: 'scritta',
      azioneId: riga.id,
      stato: dopo?.stato,
    };
  }

  private async applicaProteine(nutrizionistaId: string, stato: StatoVera): Promise<EsitoVera> {
    const valore = stato.proteineDopo!;
    await this.prisma.clientProfile.update({
      where: { userId: stato.clienteId! },
      data: { proteinMinPct: valore } as never,
    });
    // La regola dell'annulla: si rifanno SOLO i giorni futuri che non ha ancora aperto — e si
    // cancella una CODA, non i giorni sparsi (`codaProteine` qui sopra per il perché).
    const coda = await this.codaProteine(stato.clienteId!);
    /**
     * ⛔ **E se la cancellazione non riesce, NON si dice «ho rifatto»** (24/8, in revisione). Qui
     * c'era un `.catch(() => undefined)` e poi il conteggio si prendeva dalla **coda**, non
     * dall'esito: con il database in difficoltà la nutrizionista leggeva «Ho rifatto 3 giornate», il
     * registro scriveva `giorniRifatti: 3`, e i menu col valore vecchio restavano tutti lì. Il
     * silenzio è ancora peggio del solito quando finisce scritto in un registro che qualcuno
     * rileggerà per capire cosa è successo.
     */
    let riuscita = coda.esito !== 'coda';
    if (coda.esito === 'coda') {
      riuscita = await this.prisma.menuDay
        .deleteMany({ where: { id: { in: coda.giorni.map((g) => g.id) } } })
        .then(() => true)
        .catch((err: unknown) => {
          logger.warn(
            `Proteine scritte ma giorni non rifatti (cliente=${stato.clienteId}): ` +
              `${err instanceof Error ? err.message : String(err)}`,
          );
          return false;
        });
    }
    const rifatte = coda.esito === 'coda' && riuscita ? coda.giorni.length : 0;
    const riga = (await this.registro.scrivi({
      nutrizionistaId,
      frase: stato.frase,
      azione: 'variante_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: stato.clienteId ?? null,
      soggettoNome: stato.clienteNome ?? null,
      dettaglio: {
        proteine: {
          prima: stato.proteinePrima ?? null, dopo: valore, giorniRifatti: rifatte,
          esitoGiorni: riuscita ? coda.esito : 'non_riuscita',
        },
      },
    })) as { id: string };
    return {
      testo: testi.proteineFatte(
        stato.clienteNome ?? 'lei',
        valore,
        riuscita
          ? this.raccontaCoda(coda, 'dopo')
          : '⚠️ Sui giorni già preparati non sono riuscita a intervenire: restano con la quota vecchia, ' +
            'dai un\'occhiata al suo calendario.',
      ),
      esito: 'scritta',
      azioneId: riga.id,
    };
  }

  // ─────────────────────────────── le calorie scritte a mano, dettate (14/8) ──

  /**
   * «RIDUCI LE KCAL DEL 10% A GIULIA PER 7 GIORNI» (Nocanty; decisione in
   * `progetto/NOTA_Vera_Detta_La_Correzione_Kcal.md`).
   *
   * L'anteprima mostra il **numero vero** (target di adesso → target dopo), non la percentuale:
   * è la regola del pool applicata ai numeri. Se la durata non l'ha detta, si chiede — «per 7
   * giorni» e «finché non te lo dico io» sono due prescrizioni diverse.
   */
  private async avviaCorrezioneKcal(
    nutrizionistaId: string,
    stato: StatoVera,
    intento: IntentoCorrezioneKcal,
  ): Promise<EsitoVera> {
    if (intento.giorni === null) {
      return {
        testo: testi.chiediQuantiGiorni(stato.clienteNome ?? 'lei', intento.pct),
        esito: 'in_corso',
        stato: { ...stato, passo: 'quanti_giorni' },
      };
    }
    return this.anteprimaCorrezioneKcal(nutrizionistaId, stato, intento.pct, intento.giorni);
  }

  /** «Per 7 giorni» / «per sempre». ⚠️ Due risposte non capite chiudono: una durata non si indovina. */
  private async leggiQuantiGiorni(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const intento = stato.intento as IntentoCorrezioneKcal;
    const t = normalizza(frase);
    let giorni: number | null | undefined;
    if (/\bper sempre\b|\bsempre\b|\bfinche non\b|\ba tempo indeterminato\b/.test(t)) giorni = null;
    else {
      const settimane = /\b(una|due|tre|quattro|\d{1,2})\s+settiman/.exec(t);
      const g = /\b(\d{1,3})\s*(giorn|gg)/.exec(t) ?? /^\s*(\d{1,3})\s*$/.exec(t);
      if (settimane) {
        const parole: Record<string, number> = { una: 1, due: 2, tre: 3, quattro: 4 };
        const n = parole[settimane[1]] ?? Number(settimane[1]);
        giorni = Number.isFinite(n) && n > 0 ? n * 7 : undefined;
      } else if (g) {
        const n = Number(g[1]);
        giorni = Number.isFinite(n) && n > 0 ? n : undefined;
      }
    }
    if (giorni === undefined) {
      const tentativi = (stato.tentativi ?? 0) + 1;
      if (tentativi >= MAX_TENTATIVI) return { testo: testi.annullato(), esito: 'annullata' };
      return {
        testo: testi.chiediQuantiGiorni(stato.clienteNome ?? 'lei', intento.pct),
        esito: 'in_corso',
        stato: { ...stato, tentativi },
      };
    }
    return this.anteprimaCorrezioneKcal(nutrizionistaId, stato, intento.pct, giorni);
  }

  private async anteprimaCorrezioneKcal(
    nutrizionistaId: string,
    stato: StatoVera,
    pct: number,
    giorni: number | null,
  ): Promise<EsitoVera> {
    // Stessa simulazione del backoffice: un secondo calcolo qui darebbe due numeri per la stessa
    // domanda, e quello mostrato sarebbe quello sbagliato proprio quando serve.
    /**
     * ⛔ **`undefined` E NON `null` PER IL DEFICIT** (corretto il 28/8). `null` vuol dire «toglilo»,
     * e con quel `null` l'anteprima calcolava il «dopo» **senza il deficit imposto dal
     * nutrizionista** — cioè mostrava un numero più alto del vero, proprio per farlo confermare, e
     * proprio sulle clienti che un deficit scritto a mano ce l'hanno. Quello che si sta simulando è
     * la sola percentuale: il deficit non lo si sta nominando, quindi resta com'è.
     */
    const sim = await this.kcal
      .simulaKcal({ sub: nutrizionistaId, role: await this.ruolo(nutrizionistaId) }, stato.clienteId!, undefined, pct)
      .catch(() => ({ prima: null, dopo: null }));
    const prima = sim?.prima?.target ?? null;
    const dopo = sim?.dopo?.target ?? null;
    const sospeso = sim?.dopo?.pesoIncoerente ?? sim?.prima?.pesoIncoerente ?? null;
    return {
      testo: testi.anteprimaKcal(stato.clienteNome ?? 'lei', pct, prima, dopo, giorni, sospeso?.frase ?? null),
      esito: 'in_corso',
      stato: { ...stato, passo: 'conferma', giorniCorrezione: giorni, kcalPrima: prima, kcalDopo: dopo, tentativi: 0 },
    };
  }

  private async applicaCorrezioneKcal(nutrizionistaId: string, stato: StatoVera): Promise<EsitoVera> {
    const intento = stato.intento as IntentoCorrezioneKcal;
    const giorni = stato.giorniCorrezione ?? null;
    let sospeso: string | null = null;
    try {
      const esito = await this.kcal.impostaKcal(
        { sub: nutrizionistaId, role: await this.ruolo(nutrizionistaId) },
        stato.clienteId!,
        {
          correzionePct: intento.pct,
          // ⚠️ Il motivo è la FRASE ORIGINALE, per intero: è la stessa regola del registro, e chi
          // rilegge lo storico fra tre mesi trova quello che ha detto lei, non un mio riassunto.
          motivo: stato.frase,
          ...(giorni ? { perGiorni: giorni } : {}),
        },
      );
      // ⚠️ **La risposta si legge**: se il fabbisogno era sospeso, la frase di chiusura e il registro
      // lo devono dire — altrimenti l'ultima cosa che la nutrizionista legge smentisce l'avviso che
      // le è stato dato prima di confermare.
      sospeso = esito?.fabbisognoSospeso ?? null;
    } catch (err) {
      const messaggio = err instanceof Error ? err.message : 'Non sono riuscita a scriverla.';
      logger.warn(`Correzione kcal non scritta (cliente=${stato.clienteId}): ${messaggio}`);
      return { testo: testi.correzioneKcalSottoSoglia(messaggio), esito: 'arresa' };
    }

    const riga = (await this.registro.scrivi({
      nutrizionistaId,
      frase: stato.frase,
      azione: 'variante_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: stato.clienteId ?? null,
      soggettoNome: stato.clienteNome ?? null,
      // ⚠️ Il prima e il dopo si conservano: il fabbisogno cambia col peso, quindi fra un mese
      // quella percentuale darà un altro numero e senza questi due non si saprebbe cos'era.
      dettaglio: {
        // ⚠️ `sospeso` sta nel registro accanto ai due numeri, come nello storico `kcal_override`:
        // due archivi della stessa decisione di cui uno dice la verità e l'altro no sarebbero peggio
        // di uno solo.
        correzioneKcal: { pct: intento.pct, giorni, prima: stato.kcalPrima ?? null, dopo: stato.kcalDopo ?? null, sospeso },
      },
    })) as { id: string };
    return {
      testo: testi.correzioneKcalFatta(stato.clienteNome ?? 'lei', intento.pct, stato.kcalDopo ?? null, giorni, sospeso),
      esito: 'scritta',
      azioneId: riga.id,
    };
  }

  // ──────────────────────────────────────────── il cambio di dieta (azione 3) ──

  /**
   * «SPOSTA GIULIA SULLA KETO» (decisione in `progetto/NOTA_Vera_Variante_Piano.md`).
   *
   * La dieta si cerca nel CATALOGO (solo `approved`), per nome: zero → lo dico coi nomi
   * disponibili; più d'una → chiedo. Poi la domanda di Simone — «da quando?» — e solo dopo la
   * conferma. La scrittura passa dalla porta della scheda (`updateClient`, permesso
   * `change_diet_type`), che rifà da sé i giorni futuri: qui non si tocca nessun menu a mano.
   */
  private async avviaCambioDieta(nutrizionistaId: string, stato: StatoVera, nomeDieta: string | null): Promise<EsitoVera> {
    if (!nomeDieta) {
      const nomi = await this.nomiDieteApprovate();
      return { testo: testi.chiediQualeDieta([]) + (nomi.length ? `\n(${nomi.join(', ')})` : ''), esito: 'in_corso', stato: { ...stato, passo: 'quale_dieta' } };
    }
    const diete = await this.dieteCheCombaciano(nomeDieta);
    if (diete.length === 0) {
      return {
        testo: testi.dietaNonTrovata(nomeDieta, await this.nomiDieteApprovate()),
        esito: 'in_corso',
        stato: { ...stato, passo: 'quale_dieta' },
      };
    }
    if (diete.length > 1) {
      return {
        testo: testi.chiediQualeDieta(diete.map((d) => d.name)),
        esito: 'in_corso',
        stato: { ...stato, passo: 'quale_dieta', dieteCandidate: diete.map((d) => d.name) },
      };
    }
    return this.chiediDaQuandoCambioDieta(nutrizionistaId, stato, diete[0]);
  }

  private async scegliDieta(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    return this.avviaCambioDieta(nutrizionistaId, stato, (frase ?? '').trim() || null);
  }

  private async chiediDaQuandoCambioDieta(
    nutrizionistaId: string,
    stato: StatoVera,
    dieta: { name: string; style: string; regime: string },
  ): Promise<EsitoVera> {
    const profilo = (await this.prisma.clientProfile.findUnique({
      where: { userId: stato.clienteId! },
      select: { dietFamily: true, dietStyle: true, regime: true },
    })) as { dietFamily: string | null; dietStyle: string | null; regime: string | null } | null;

    // È già su quella dieta: dirlo, non riscrivere (e non rifare nessun giorno per niente).
    if (profilo?.dietFamily && profilo.dietFamily.toLowerCase() === dieta.name.toLowerCase()) {
      return { testo: testi.dietaGiaQuella(stato.clienteNome ?? 'lei', dieta.name), esito: 'annullata' };
    }

    const oggi = aGiorno(new Date());
    const giorniPreparati = await this.prisma.menuDay.count({
      where: { clientId: stato.clienteId!, date: { gt: oggi } } as never,
    });
    return {
      testo: testi.chiediDaQuando(stato.clienteNome ?? 'lei', profilo?.dietFamily ?? null, dieta.name, giorniPreparati),
      esito: 'in_corso',
      stato: { ...stato, passo: 'da_quando', dietaTrovata: dieta, dietaPrima: profilo?.dietFamily ?? null },
    };
  }

  /**
   * «Da subito» o «lascia i giorni già preparati». ⚠️ Una data puntuale oggi NON si legge: una
   * data indovinata scrive menu sbagliati. Due risposte non capite → si annulla senza scrivere.
   */
  private async leggiDaQuando(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const t = normalizza(frase);
    let daSubito: boolean | null = null;
    if (/\bsubito\b|\bda domani\b|\brifai\b|\brifalli\b/.test(t)) daSubito = true;
    else if (/\blascia\b|\bpreparat\b|\bnon toccare\b|\bprossimi\b|\bquando finiscono\b/.test(t)) daSubito = false;
    if (daSubito === null) {
      const tentativi = (stato.tentativi ?? 0) + 1;
      if (tentativi >= MAX_TENTATIVI) return { testo: testi.annullato(), esito: 'annullata' };
      return { testo: testi.daQuandoNonCapito(), esito: 'in_corso', stato: { ...stato, tentativi } };
    }
    return {
      testo: testi.confermaCambioDieta(stato.clienteNome ?? 'lei', stato.dietaTrovata!.name, daSubito),
      esito: 'in_corso',
      stato: { ...stato, passo: 'conferma', daSubito, tentativi: 0 },
    };
  }

  private async applicaCambioDieta(nutrizionistaId: string, stato: StatoVera): Promise<EsitoVera> {
    const dieta = stato.dietaTrovata;
    if (!dieta) return { testo: testi.annullato(), esito: 'annullata' };
    const daSubito = stato.daSubito !== false;
    try {
      /**
       * ⚠️ TUTTI E TRE i campi, dalla dieta trovata: `pickDietFor` abbina famiglia+stile (+regime
       * a monte), e scriverne uno solo lascerebbe l'abbinamento a metà — la famiglia nuova con lo
       * stile vecchio non trova niente e il motore ripiegherebbe su un'altra dieta in silenzio.
       */
      await this.clienti.updateClient(stato.clienteId!, nutrizionistaId, {
        regime: dieta.regime,
        dietStyle: dieta.style,
        dietFamily: dieta.name,
        ...(daSubito ? {} : { dietChangeKeepDeliveredDays: true }),
      });
    } catch (err) {
      const motivo = err instanceof Error ? err.message : 'un errore inatteso.';
      logger.warn(`Cambio dieta non riuscito (cliente=${stato.clienteId}): ${motivo}`);
      return { testo: testi.cambioDietaNonRiuscito(motivo.endsWith('.') ? motivo : `${motivo}.`), esito: 'arresa' };
    }

    const riga = (await this.registro.scrivi({
      nutrizionistaId,
      frase: stato.frase,
      azione: 'variante_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: stato.clienteId ?? null,
      soggettoNome: stato.clienteNome ?? null,
      dettaglio: { cambioDieta: { prima: stato.dietaPrima ?? null, dopo: dieta.name, daSubito } },
    })) as { id: string };
    return {
      testo: testi.cambioDietaFatto(stato.clienteNome ?? 'lei', dieta.name, daSubito),
      esito: 'scritta',
      azioneId: riga.id,
    };
  }

  /** I nomi (distinti) delle diete approvate, per dirli quando il nome dettato non trova niente. */
  private async nomiDieteApprovate(): Promise<string[]> {
    const righe = (await this.prisma.diet.findMany({
      where: { status: 'approved' } as never,
      select: { name: true },
      take: 200,
    })) as { name: string }[];
    return [...new Set(righe.map((r) => r.name))].slice(0, 15);
  }

  /** Le diete approvate il cui nome combacia con quello dettato — per NOME DISTINTO, non per riga. */
  private async dieteCheCombaciano(nome: string): Promise<{ name: string; style: string; regime: string }[]> {
    const cercato = normalizza(nome);
    if (!cercato) return [];
    const righe = (await this.prisma.diet.findMany({
      where: { status: 'approved' } as never,
      select: { name: true, style: true, regime: true, approvedAt: true },
      orderBy: { approvedAt: 'desc' },
      take: 500,
    })) as { name: string; style: string; regime: string }[];
    const perNome = new Map<string, { name: string; style: string; regime: string }>();
    for (const r of righe) {
      if (!perNome.has(r.name.toLowerCase())) perNome.set(r.name.toLowerCase(), r);
    }
    return [...perNome.values()].filter((d) => {
      const n = normalizza(d.name);
      return n === cercato || n.includes(cercato) || cercato.includes(n) || combaciaAlimento(d.name, nome);
    });
  }

  /**
   * La seconda lettura, con le sue dipendenze legate: il modello, `capisci`, e `daScartare` che gira
   * PRIMA della chiamata (una domanda col punto interrogativo non arriva nemmeno al modello).
   *
   * ⚠️ Si può spegnere senza un rilascio: `vera_seconda_lettura` in `config_param`. Spenta, il
   * comportamento è **identico** a quello di prima — ed è la ragione per cui l'interruttore esiste:
   * è una funzione che spende, e che tocca il piatto di 315 persone attraverso una traduzione.
   */
  private async provaSecondaLettura(frase: string): Promise<string | null> {
    if (!(await this.configParams.getBool('vera_seconda_lettura', true))) return null;
    const esito = await secondaLettura<Intento>(frase, {
      chiediAlModello: (system, prompt) => this.ai.generateJson<{ frase?: unknown }>(system, prompt, 300),
      capisci,
      daScartare,
      avvisa: (m) => logger.warn(m),
    });
    return esito?.riscritta ?? null;
  }

  /**
   * La scelta al bivio «è una regola o una risposta?».
   *
   * ⚠️ Se non si capisce nemmeno la scelta, **non si decide al posto suo**: si ripete la domanda.
   * Il caso che questo ramo esiste per chiudere nasce proprio da un automatismo che aveva scelto da
   * solo, e sbagliato.
   */
  private async scegliRispostaORegola(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const t = normalizza(frase ?? '');
    const bozza = stato.bozzaRisposta ?? '';
    const cliente = stato.clienteNome ?? null;
    if (/\b(regola|scrivila|scrivi|come regola|la prima)\b/.test(t)) {
      // La segnalazione resta APERTA: la regola è un'altra cosa, e la cliente aspetta ancora.
      const esito = await this.nuovoGiro(nutrizionistaId, bozza);
      /**
       * ⚠️ **La cliente la sappiamo già**: la regola nasce dalla segnalazione **sua**. Senza questa
       * riga la nutrizionista si sente chiedere «su quale cliente?» due righe dopo aver risposto a
       * una domanda di quella cliente — una domanda a cui abbiamo già la risposta sotto gli occhi.
       * ⚠️ Si passa dal giro normale (`avanza`) e non da una scorciatoia: se la ricerca trova
       * un'omonimia, o non trova nessuno, valgono le regole di sempre.
       */
      /**
       * ⛔ **Solo se la frase non nominava nessuno.** Al passo `quale_cliente` si arriva per tre
       * motivi — nessun nome, nome non trovato, omonimia — e nei due casi in cui un nome lei
       * l'aveva scritto, rispondere «Giulia Rossi» vorrebbe dire **scartare il nome che ha
       * scritto** e preparare la regola su un'altra persona, buttando via anche il «non trovo
       * nessuna cliente che si chiami Marta» che avrebbe dovuto leggere. Misurato in revisione:
       * scriveva «a Marta…» e l'anteprima diceva Giulia.
       */
      const nominata = (esito.stato?.intento as { cliente?: string | null } | undefined)?.cliente;
      if (esito.stato?.passo === 'quale_cliente' && !nominata && stato.clienteNome) {
        return this.avanza(nutrizionistaId, esito.stato, stato.clienteNome);
      }
      return esito;
    }
    if (/\b(mandala|manda|mandagliela|invia|inviala|cos[iì] com['’]?[eè]|risposta|la seconda)\b/.test(t)) {
      return this.mandaLaRisposta(nutrizionistaId, stato, bozza, cliente);
    }
    if (leggiConferma(frase) === false || /^\s*(lascia stare|lascia perdere|annulla)\b/.test(t)) {
      return { testo: testi.annullato(), esito: 'annullata' };
    }
    /**
     * ⛔ **DAL PASSO SI ESCE**, ed è la lezione dello screenshot del 17/8: una domanda chiusa che non
     * ammette nessun'altra risposta trasforma un fraintendimento di un minuto in una chat
     * inutilizzabile. Qui restano aperte le due strade di sempre — «la vedo io» chiude la
     * segnalazione senza scrivere, e al secondo «non ho capito» si smette di chiedere e si fa la
     * cosa che lei stava facendo: mandare la risposta.
     */
    if (/^\s*(la vedo io|ci penso io|me ne occupo io|la gestisco io|rispondo io)\b/.test(t)) {
      return this.rispondiAllaGirata(nutrizionistaId, { ...stato, passo: 'risposta_cliente' }, frase);
    }
    const tentativi = (stato.tentativi ?? 1) + 1;
    if (tentativi > MAX_TENTATIVI) return this.mandaLaRisposta(nutrizionistaId, stato, bozza, cliente);
    return { testo: testi.rispostaORegola(cliente), esito: 'in_corso', stato: { ...stato, tentativi } };
  }

  private async confermaOAnnulla(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    // Il ramo «non avevo capito»: qui `conferma` è solo il contenitore del contatore tentativi.
    if (!stato.intento) {
      const tentativi = (stato.tentativi ?? 1) + 1;
      const riprova = capisci(frase);
      if (riprova) return this.nuovoGiro(nutrizionistaId, frase);
      // ⚠️ La seconda lettura vale anche al RITENTATIVO: è il momento in cui lei ha già riscritto la
      // frase una volta e sta per sentirsi dire «non ci arrivo» la seconda. Se qui si arrende, si
      // arrende per sempre — dopo due «non ci arrivo» una persona smette di provare.
      const tradotta = await this.provaSecondaLettura(frase);
      if (tradotta) {
        const esito = await this.nuovoGiro(nutrizionistaId, tradotta, true);
        return { ...esito, testo: `${testi.hoLettoCosi(tradotta)}\n\n${esito.testo}` };
      }
      if (tentativi > MAX_TENTATIVI) return { testo: testi.nonCapito(MAX_TENTATIVI), esito: 'arresa' };
      return { testo: testi.nonCapito(tentativi), esito: 'non_capito', stato: { ...stato, tentativi } };
    }

    const risposta = leggiConferma(frase);
    if (risposta === false) return { testo: testi.annullato(), esito: 'annullata' };
    if (risposta === null) {
      return {
        testo: 'Non ho capito se posso procedere. Rispondi «sì» o «no» — nel dubbio non scrivo niente.',
        esito: 'in_corso',
        stato,
      };
    }
    /**
     * ⚠️ I PASTI NON HANNO L'AMBITO «PER TUTTE» (Decisioni 13/8 §14): togliere uno spuntino a
     * tutte le clienti è una regola di dieta — l'azione 6, che nel motore non esiste ancora.
     * Al sì si scrive e basta.
     */
    if ((stato.intento as Intento).tipo === 'pasti') {
      return this.applicaPasti(nutrizionistaId, stato, stato.intento as IntentoPasti);
    }
    if ((stato.intento as Intento).tipo === 'correzione_kcal') {
      return this.applicaCorrezioneKcal(nutrizionistaId, stato);
    }
    if ((stato.intento as Intento).tipo === 'proteine') {
      return this.applicaProteine(nutrizionistaId, stato);
    }
    if ((stato.intento as Intento).tipo === 'giornata') {
      return this.scriviGiornataDettata(nutrizionistaId, stato);
    }
    // Il cambio di dieta è per UNA cliente per costruzione: niente ambito «per tutte».
    if ((stato.intento as Intento).tipo === 'cambio_dieta') {
      return this.applicaCambioDieta(nutrizionistaId, stato);
    }
    // ⚠️ E il digiuno lo stesso: le ore di una persona non sono una regola per tutte.
    if ((stato.intento as Intento).tipo === 'digiuno') {
      return this.applicaDigiuno(nutrizionistaId, stato);
    }
    return {
      testo: testi.chiediAmbito(stato.clienteNome ?? 'lei'),
      esito: 'in_corso',
      stato: { ...stato, passo: 'ambito' },
    };
  }

  /**
   * L'ultimo passo: solo per questa cliente (predefinito) o per tutte.
   *
   * «A tutte» **non scrive**: apre una proposta in approvazione. È il «promuovi a regola» del §16.9
   * spostato nel momento in cui lei sa ancora perché lo sta dicendo.
   */
  private async chiudiConAmbito(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const intento = stato.intento as Intento;
    const termini = await this.terminiFinali(nutrizionistaId, intento);
    const conflitto = await this.conflittoSanitario(stato.clienteId!, intento);

    if (leggiAmbito(frase) === 'tutte') {
      const riga = await this.registro.scrivi({
        nutrizionistaId,
        frase: stato.frase,
        azione: intento.tipo === 'sostituzione' ? 'sostituzione_cliente' : 'restrizione_cliente',
        ambito: 'catalogo',
        soggettoTipo: 'user',
        soggettoId: stato.clienteId ?? null,
        soggettoNome: stato.clienteNome ?? null,
        dettaglio: { intento, termini, estesaATutte: true },
        inApprovazione: true,
        conflittoSanitario: !!conflitto,
      });
      return { testo: testi.ambitoEsteso(), esito: 'in_approvazione', azioneId: (riga as { id: string }).id };
    }

    const riepilogo = intento.tipo === 'sostituzione'
      ? await this.scriviSostituzione(nutrizionistaId, stato, intento as IntentoSostituzione)
      : await this.scriviRestrizione(stato.clienteId!, termini);

    const riga = await this.registro.scrivi({
      nutrizionistaId,
      frase: stato.frase,
      azione: intento.tipo === 'sostituzione' ? 'sostituzione_cliente' : 'restrizione_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: stato.clienteId ?? null,
      soggettoNome: stato.clienteNome ?? null,
      dettaglio: { intento, termini },
      conflittoSanitario: !!conflitto,
    });
    return { testo: testi.scritta(riepilogo), esito: 'scritta', azioneId: (riga as { id: string }).id };
  }

  /**
   * La restrizione finisce fra i **cibi non graditi**, non fra le intolleranze.
   *
   * ⚠️ È una scelta, e va detta. Un'intolleranza in quel campo **blocca il piano** quando il motore
   * non trova un sostituto sicuro (regola R8: blocca ed escala). Una decisione dettata a voce non
   * deve poter fermare l'erogazione di una cliente: i non graditi tolgono il piatto e basta. Se
   * quella parola è davvero un'intolleranza clinica, si scrive dalla scheda — dove chi lo fa sa che
   * sta muovendo un dato sanitario.
   */
  private async scriviRestrizione(clientId: string, termini: string[]): Promise<string> {
    const p = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { dislikedFoods: true },
    })) as { dislikedFoods: string[] } | null;
    const attuali = p?.dislikedFoods ?? [];
    /**
     * ⚠️ **VERA VINCE SEMPRE SU GAIA** — decisione di Simone, 18/8, alla domanda «se la
     * nutrizionista detta una spezia, cosa si fa?».
     *
     * Quindi qui **non** passa `filtraSpezie`: chi detta è la professionista che firma le diete, e
     * una sua parola non viene scartata. Passa però `spezzaTagAlimenti`, che è l'altra metà di
     * quella funzione e non c'entra col permesso: una voce come «pepe, ceci» va scritta come DUE
     * righe, o da quel momento non esclude più niente — è il caso del 17/8, dove `"Carne .ceci"`
     * salvata intera non compariva in nessun piatto e smetteva di escludere.
     *
     * ⚠️ Le due metà sono diverse e vanno tenute diverse: **scartare** è una decisione di prodotto
     * (e Vera la vince), **spezzare** è correggere la forma di un dato perché continui a funzionare.
     * Confonderle vorrebbe dire dare a Vera il potere di scrivere un tag rotto.
     *
     * ⚠️ E il pool che si svuota resta detto: la chat mostra l'anteprima (`raccontaPool`) prima di
     * scrivere, quindi la nutrizionista sceglie sapendo cosa resta — che è la differenza fra
     * accettare una conseguenza e non vederla.
     */
    const spezzati = spezzaTagAlimenti(termini);
    // Idempotente: ridettare la stessa regola non deve raddoppiare le righe nel profilo.
    const nuovi = spezzati.filter((t) => !attuali.some((a) => combaciaAlimento(a, t)));
    if (nuovi.length) {
      await this.prisma.clientProfile.update({
        where: { userId: clientId },
        data: { dislikedFoods: [...attuali, ...nuovi] } as never,
      });
    }

    /**
     * ⛔ **I GIORNI SI GUARDANO SEMPRE, anche se la parola c'era già** — trovato in revisione, 23/8.
     *
     * La prima stesura usciva subito su «erano già tutti esclusi». Ma è **esattamente** il caso
     * Lorena: la regola era stata messa a mano sul profilo, il branzino era già in calendario, e
     * ridettare «niente pesce» — la cosa più naturale da fare per rimediare — sarebbe stata l'unica
     * strada che non ripuliva niente. Si guarda su TUTTO quello che ha appena detto (`spezzati`),
     * non solo sulle parole nuove: lei ha chiesto che quella regola sia vera adesso.
     */
    const esito = await this.rifaiGiorniConVietati(clientId, spezzati);

    /**
     * ⚠️ **COSA VUOL DIRE la parola che ha appena vietato** — richiesta di Simone del 23/8, nata
     * proprio da «niente pesce»: la nutrizionista deve sapere che per il motore «pesce» non è una
     * parola ma un elenco di **67 voci** (tonno, salmone, branzino, orata, merluzzo, sgombro… più i
     * derivati che pesce non si chiamano: stoccafisso, bottarga, surimi, tonnato). Senza questa
     * riga, l'unico modo di scoprire quanto è largo il divieto è vedere cosa sparisce dai piatti.
     */
    const spiegazioni = spezzati
      .map((t) => {
        const membri = expandExclusion(t).filter((k) => k !== t.toLowerCase());
        if (membri.length < SPIEGA_DA) return null;
        const mostrati = membri.slice(0, SPIEGA_QUANTE).join(', ');
        const resto = membri.length - SPIEGA_QUANTE;
        // ⚠️ «e altre 1 voci» era il testo di ieri: il singolare c'è perché lo legge una persona.
        const coda = resto <= 0 ? '' : resto === 1 ? ' e un\'altra voce' : ` e altre ${resto} voci`;
        return `«${t}» per il motore vuol dire ${mostrati}${coda}`;
      })
      .filter(Boolean);
    const codaSpiegazione = spiegazioni.length ? ` ${spiegazioni.join('; ')}.` : '';

    const testa = nuovi.length
      ? `Ho tolto dai suoi menu: ${nuovi.join(', ')}.`
      : 'Erano già tutti esclusi: sul profilo non ho cambiato niente.';
    return `${testa}${codaSpiegazione}${esito}`;
  }

  /**
   * ⛔ **LA REGOLA VALE ANCHE SUI GIORNI GIÀ PREPARATI — il caso Lorena Polidoro, 23/8.**
   *
   * «Niente pesce» scriveva sul profilo e basta: valeva per i menu che sarebbero nati DOPO, mentre i
   * giorni futuri già composti restavano lì col branzino dentro. La nutrizionista leggeva «ho tolto
   * dai suoi menu» — vero solo a metà — e la cliente continuava a vedere il pesce nel calendario.
   *
   * ## ⛔ Perché si cancella una CODA e non i singoli giorni
   *
   * La regola sta scritta una volta sola, in `codaDaRifare` (`menu-da-rifare.ts`): si cancella dal
   * primo giorno colpito **in avanti**, tutto, e se dentro quella coda c'è un giorno **già aperto**
   * non si tocca niente e lo si dice. Il perché è là.
   *
   * ⚠️ **UNA RAGIONE FALSA, MIA, DEL 23/8.** Qui c'era scritto «come già fanno gli altri due percorsi
   * di Vera che toccano i menu (le proteine e i pasti)». **Non era vero**, e l'ho verificato solo il
   * giorno dopo: «togli lo spuntino» cancellava i giorni che contengono lo spuntino, sparsi, e
   * «cambia le proteine» cancellava quelli non ancora aperti — lasciando in piedi un giorno letto più
   * avanti, che oltre al buco fermava l'erogazione finché quella data non passava. Il codice
   * consegnato era giusto, la ragione scritta accanto no: e una ragione falsa è peggio di un ordine
   * sbagliato, perché chi legge ci costruisce sopra invece di andare a guardare. Adesso quei due
   * punti passano di qui davvero, ed è la sentinella `una-porta-per-i-giorni.spec.ts` a tenerli.
   */
  private async rifaiGiorniConVietati(clientId: string, termini: string[]): Promise<string> {
    if (!termini.length) return '';
    try {
      const oggi = new Date();
      const giorni = ((await this.prisma.menuDay.findMany({
        where: { clientId, date: { gte: daQuandoSiPuoRifare(oggi) } } as never,
        select: CAMPI_DEL_GIORNO as never,
      })) ?? []) as GiornoDaValutare[];
      if (!giorni.length) return '';

      /**
       * ⚠️ **Solo le ricette che stanno DAVVERO in quei giorni.** La prima stesura leggeva l'intero
       * catalogo (id + nome + ingredienti) a ogni frase detta in chat: qui i candidati sono al
       * massimo una manciata di giornate, e le loro ricette si contano sulle dita.
       */
      const idRicette = [...new Set(giorni.flatMap((g) => ricetteDelGiorno(g.meals)))];
      if (!idRicette.length) return '';
      const ricette = ((await this.prisma.recipe.findMany({
        where: { id: { in: idRicette } } as never,
        select: { id: true, name: true, ingredients: true },
      })) ?? []) as { id: string; name: string | null; ingredients: unknown }[];

      const fuori = ricetteVietate(ricette, termini);
      // ⚠️ Il predicato si costruisce dagli STESSI `giorni`: i colpiti sono un sottoinsieme per
      // costruzione, e la coda non può essere calcolata su un universo diverso da quello guardato.
      const colpiti = new Set(giorniColpitiDaiVietati(giorni, fuori, oggi).map((g) => g.id));
      const coda = codaDaRifare(giorni, (g) => colpiti.has(g.id));
      /**
       * ⛔ **«NON CE N'ERA» ADESSO È VERO** (26/8). Fino a ieri i colpiti erano già filtrati su «si
       * può rifare?», quindi questa frase scattava anche quando il piatto vietato c'era eccome — era
       * solo in un giorno che non potevamo toccare. Era **la** frase del difetto. Adesso i colpiti
       * sono i giorni che contengono il piatto, punto: se sono zero, il piatto non c'è.
       */
      if (coda.esito === 'niente') return ' Nei giorni già preparati non ce n’era: non ho toccato niente.';
      if (coda.esito === 'bloccata') {
        return (
          ` ⚠️ Nei giorni già preparati c’è, ma non li ho toccati: il menu del ${giornoItaliano(coda.apertoIl)} ` +
          'l\'ha già aperto in app e quello resta suo. Per rifarli c\'è «Rigenera menu» dalla sua scheda, ' +
          'che però rifà anche il giorno che ha già aperto.'
        );
      }
      /** ⚠️ Il terzo esito: c'è, e non so se l'ha aperto. Si dice così — non «non ce n'era». */
      if (coda.esito === 'non_lo_so') {
        return (
          ` ⚠️ Nei giorni già preparati c’è, ma non li ho toccati: dal ${giornoItaliano(coda.dalGiorno)} in poi ` +
          'non so dirti se li ha già aperti (la sua app non me lo dice ancora) e nel dubbio non le tolgo un ' +
          'menu di mano. Per rifarli c\'è «Rigenera menu» dalla sua scheda.'
        );
      }

      await this.prisma.menuDay.deleteMany({ where: { id: { in: coda.giorni.map((g) => g.id) } } });
      const quante = coda.giorni.length;
      const indietro = coda.lasciatiIndietro
        ? ` ⚠️ ${coda.lasciatiIndietro} ${coda.lasciatiIndietro === 1 ? 'giornata più vicina ce l’ha' : 'giornate più vicine ce le ha'} ` +
          'già in mano (o non so dirlo): quell\'alimento lì dentro resta.'
        : '';
      return ` Ho rifatto anche ${quante} ${quante === 1 ? 'giornata già preparata' : 'giornate già preparate'}: le ricompone il motore al prossimo giro.${indietro}`;
    } catch (err) {
      logger.warn(`Restrizione scritta ma giorni non rifatti (cliente=${clientId}): ${err instanceof Error ? err.message : String(err)}`);
      return ' ⚠️ La regola vale da adesso, ma sui giorni già preparati non sono riuscita a intervenire: dai un’occhiata al suo calendario.';
    }
  }

  /**
   * La sostituzione va nella tabella che esiste già (§16.9), come riga **verificata**.
   *
   * ⚠️ `origine: 'manuale'` e non `'nutrizionista'`: quest'ultima vuol dire «letta da una sua frase
   * in chat con la cliente», dove a poter aver sbagliato è il programma. Qui la traduzione gliel'ho
   * mostrata e lei ha detto sì — è una riga scritta a mano, con un'interfaccia più comoda.
   */
  private async scriviSostituzione(
    nutrizionistaId: string,
    stato: StatoVera,
    intento: IntentoSostituzione,
  ): Promise<string> {
    /**
     * ⛔ **UNA RIGA PER COPPIA, e sono tutte** (31/8). La chiave di `FoodSwap` è
     * `cliente|ricetta|da|a`, quindi due alternative per lo stesso alimento sono due righe
     * legittime — «indivia → zucchine» e «indivia → melanzane» — e il motore può pescare l'una o
     * l'altra. Scriverne una sola e buttare le altre sarebbe il troncamento di prima, un piano più
     * in basso: invisibile, perché a quel punto l'anteprima l'ha già superata.
     */
    const { da: listaDa, a: listaA } = elenchiDellIntento(intento);
    for (const da of listaDa) {
      for (const a of listaA) {
        await registraSostituzione(this.prisma, {
          clientId: stato.clienteId!,
          tipo: 'ingrediente',
          from: da,
          to: a,
          recipeId: null,
          origine: 'manuale',
          stato: 'verificata',
          nota: `Dettata all'assistente: «${stato.frase}»`,
          creataDaId: nutrizionistaId,
        });
      }
    }
    const quante = listaDa.length * listaA.length;
    const elencoDa = listaDa.map((x) => `«${x}»`).join(', ');
    const elencoA = listaA.map((x) => `«${x}»`).join(', ');
    return quante > 1
      ? `Al posto di ${elencoDa} userò ${elencoA}. Ho scritto ${quante} regole.`
      : `Al posto di ${elencoDa} userò ${elencoA}.`;
  }

  // ────────────────────────────────────────────── la coda del capo ──────────

  /**
   * Prende la prossima proposta in coda e la sottopone, **già istruita**.
   *
   * «Già istruita» vuol dire: chi l'ha dettata, quando, **la frase originale**, e cosa comporta. Chi
   * decide non deve aprire altre cinque schermate per sapere cosa sta approvando — se le deve
   * aprire, non le apre, e approva a scatola chiusa.
   */
  private async sottoponiProssima(attoreId: string): Promise<EsitoVera | null> {
    const coda = (await this.registro.daApprovare()) as unknown as {
      id: string;
      frase: string;
      nutrizionistaId: string;
      soggettoNome: string | null;
      dettaglio: unknown;
      conflittoSanitario: boolean;
      createdAt: Date;
    }[];
    /**
     * ⚠️ Coda vuota → `null`, **non** un messaggio «non c'è niente».
     *
     * Chi chiama decide cosa farne: all'apertura della pagina non si scrive nulla (un agente che
     * saluta con «non c'è niente da fare» ogni volta insegna a non leggerlo), e dopo una decisione
     * si dice che è finita. Se questa funzione rispondesse sempre qualcosa, il capo che detta una
     * frase non capita si sentirebbe dire «non c'è niente in coda» invece di «non ho capito».
     */
    if (!coda.length) return null;

    const p = coda[0];
    const chi = await this.nomeStaff(p.nutrizionistaId);
    const quando = p.createdAt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    const termini = ((p.dettaglio ?? {}) as { termini?: string[] }).termini ?? [];
    const d = (p.dettaglio ?? {}) as { famiglia?: string; membri?: string[] };
    /**
     * ⚠️ UNA PAROLA CHE DIVENTA DI TUTTE: prima del sì, il capo deve sapere **chi ne ha già una
     * sua diversa** (Simone, 13/8: «chiedi conferma al nutrizionista capo attraverso Vera»).
     * Prima approvava alla cieca una parola che altre usano già in un altro senso.
     * Sotto `try`: è un'informazione in più su una coda che deve continuare a funzionare.
     */
    let conflitti = '';
    if (d.famiglia) {
      try {
        const altre = await this.dizionario.altreVersioniPersonali(d.famiglia);
        conflitti = raccontaConflitti(
          conflittiDiPromozione(
            { nutrizionistaId: p.nutrizionistaId, nome: d.famiglia, membri: d.membri ?? [] },
            await this.conNomiStaff(altre),
          ),
        );
      } catch (err) {
        logger.warn(`Conflitti di dizionario non letti (proposta=${p.id}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const riepilogo =
      (termini.length
        ? `Vuole vietare a tutte le sue clienti: ${termini.join(', ')}.` +
          (p.soggettoNome ? ` (Nata guardando ${p.soggettoNome}.)` : '')
        : d.famiglia
          ? `Vuole che «${d.famiglia}» voglia dire ${(d.membri ?? []).join(', ') || '—'} per tutte.`
          : 'Vuole estendere a tutte le sue clienti quello che aveva deciso per una.') +
      (conflitti ? `\n\n${conflitti}` : '');

    return {
      testo: testi.sottoponi(coda.length, chi, quando, p.frase, riepilogo, p.conflittoSanitario),
      esito: 'in_corso',
      stato: { passo: 'revisione', frase: p.frase, azioneId: p.id },
    };
  }

  /** I nomi delle staff che hanno una loro versione: «Anna» dice più di un id accorciato. */
  private async conNomiStaff<T extends { nutrizionistaId: string }>(voci: T[]): Promise<(T & { nutrizionistaNome: string | null })[]> {
    const ids = [...new Set(voci.map((v) => v.nutrizionistaId))];
    if (!ids.length) return [];
    const righe = (await this.prisma.staff.findMany({
      where: { userId: { in: ids } } as never,
      select: { userId: true, displayName: true },
    })) as { userId: string; displayName: string | null }[];
    const nomi = new Map(righe.map((r) => [r.userId, r.displayName]));
    return voci.map((v) => ({ ...v, nutrizionistaNome: nomi.get(v.nutrizionistaId) ?? null }));
  }

  /** Sì = approva e applica; no = chiedi il motivo. Nel dubbio non si fa niente. */
  private async decidiProposta(attoreId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const risposta = leggiConferma(frase);
    if (risposta === null) {
      return {
        testo: 'Non ho capito se approvi. Rispondi «sì» o «no» — nel dubbio la lascio in coda.',
        esito: 'in_corso',
        stato,
      };
    }
    if (risposta === false) {
      return { testo: testi.chiediMotivo(), esito: 'in_corso', stato: { ...stato, passo: 'motivo_rifiuto' } };
    }

    const attore = { id: attoreId, role: await this.ruolo(attoreId) };
    const esito = await this.registro.approva(attore, stato.azioneId!);

    /**
     * ⚠️ LA DOMANDA SUGLI ALLERGENI PRIMA DELLA PROSSIMA COSA (voce 227). Approvare accende la
     * ricetta ma non conferma gli allergeni, e `collegaRicetta` si rifiuta di metterla in una
     * giornata finché restano da confermare: passare oltre vorrebbe dire lasciargli una ricetta
     * accesa e invisibile, che è esattamente il difetto che questa voce chiude. La coda non si
     * perde — riparte da sola appena questa risposta è data.
     */
    const allergeni = (esito as { allergeniDaConfermare?: string }).allergeniDaConfermare;
    if (allergeni) {
      const domanda = await this.chiediAllergeniRicetta(allergeni);
      if (domanda) {
        return {
          testo: `${testi.approvata((esito as { riepilogo: string }).riepilogo)}\n\n${domanda.testo}`,
          esito: 'scritta',
          stato: domanda.stato,
          azioneId: stato.azioneId,
        };
      }
    }

    const prossima = await this.cosaTiPorto(attoreId);
    return {
      testo: `${testi.approvata((esito as { riepilogo: string }).riepilogo)}\n\n${prossima?.testo ?? testi.codaVuota()}`.trim(),
      esito: 'scritta',
      stato: prossima?.stato,
      azioneId: stato.azioneId,
    };
  }

  private async respingiConMotivo(attoreId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const motivo = (frase ?? '').trim();
    if (motivo.length < 3) return { testo: testi.chiediMotivo(), esito: 'in_corso', stato };

    const attore = { id: attoreId, role: await this.ruolo(attoreId) };
    await this.registro.respingi(attore, stato.azioneId!, motivo);
    const prossima = await this.cosaTiPorto(attoreId);
    return {
      testo: `${testi.respinta()}\n\n${prossima?.testo ?? testi.codaVuota()}`.trim(),
      esito: 'annullata',
      stato: prossima?.stato,
    };
  }

  /**
   * «HAI SEGNALAZIONI PER ME?» — la guida della giornata (Simone, 14/8; decisione in
   * `progetto/NOTA_Vera_Guida_Giornata.md`).
   *
   * Il quadro si compone dalle TABELLE di origine (le stesse di `aspetta-me`), non dalle notifiche:
   * la campanella si aggiunge in fondo, per i soli tipi che le code sopra non raccontano già. E
   * dopo il quadro l'agente porta subito la prima cosa da fare (`cosaTiPorto`): guida, non elenca.
   *
   * ⚠️ Risponde SEMPRE, anche a vuoto. Prima la domanda esplicita cadeva nel «non ci arrivo»
   * (screenshot del 14/8, 08:35): vero e fuorviante, perché la risposta giusta esisteva già
   * (`codaVuota`). ⚠️ E qui non si scrive niente: è l'unico giro che è SOLO lettura.
   */
  private async guidaGiornata(userId: string): Promise<EsitoVera> {
    const capo = (await this.ruolo(userId)) !== 'nutritionist';
    const rotte: string[] = [];
    const leggi = async <T>(cosa: string, lettura: () => Promise<T>): Promise<T | null> => {
      try {
        return await lettura();
      } catch (err) {
        // ⚠️ «Non lo so» ≠ «nessuno»: la fonte rotta si scrive nei log E si dice in chat. Fingere
        // uno zero insegnerebbe a fidarsi di un quadro cieco su una colonna.
        logger.warn(`Guida della giornata: non leggo ${cosa} (utente=${userId}): ${err instanceof Error ? err.message : String(err)}`);
        rotte.push(cosa);
        return null;
      }
    };

    const seg = await leggi('le segnalazioni', () => this.contaSegnalazioni(userId));
    const daApprovare = capo ? await leggi('la coda delle proposte', async () => (await this.registro.daApprovare()).length) : 0;
    const domande = await leggi('le domande aperte', () => this.richieste.quante(userId, capo));
    const daVerificare = await leggi('le sostituzioni da verificare', () => this.registro.sostituzioniDaVerificare(userId));
    const avvisi = await leggi('la campanella', () => this.avvisiNonLetti(userId));

    // L'ordine è una decisione, non un caso: le segnalazioni CLINICHE in testa (Simone, 14/8,
    // pagina Lavori: se ci sono problemi clinici «vanno in testa a tutte le richieste»).
    const righe: string[] = [];
    if (seg?.cliniche) {
      righe.push(
        `${seg.cliniche} ${seg.cliniche === 1 ? 'segnalazione clinica' : 'segnalazioni cliniche'} sulle tue clienti — ` +
        'vengono prima di tutto (le trovi nella pagina Segnalazioni)',
      );
    }
    if (seg?.altre) righe.push(`${seg.altre} ${seg.altre === 1 ? 'segnalazione aperta' : 'segnalazioni aperte'} sulle tue clienti`);
    if (daApprovare) righe.push(`${daApprovare} ${daApprovare === 1 ? 'proposta del tuo team' : 'proposte del tuo team'} da approvare`);
    if (domande) righe.push(`${domande} ${domande === 1 ? 'domanda aperta che aspetta' : 'domande aperte che aspettano'} una risposta`);
    if (daVerificare) righe.push(`${daVerificare} ${daVerificare === 1 ? 'sostituzione da verificare' : 'sostituzioni da verificare'}`);
    /**
     * LE APPROVAZIONI DEL CATALOGO (18/8). Vanno **dopo** le clienti e prima della campanella: qui
     * dietro non c'è nessuno che aspetta oggi — c'è un catalogo che non cresce. Ma senza questa riga
     * la coda esisterebbe solo per chi sa chiedergliela, e una coda che si apre solo a parole magiche
     * è una coda che nessuno svuota.
     */
    const invito = await this.invitoApprovazioni();
    if (invito) righe.push(invito);
    if (avvisi?.length) {
      const totale = avvisi.reduce((somma, a) => somma + a.quanti, 0);
      const dettaglio = avvisi.slice(0, 4).map((a) => `${a.quanti} su ${etichettaAvviso(a.tipo)}`).join(', ');
      righe.push(`${totale} ${totale === 1 ? 'avviso non letto' : 'avvisi non letti'} sulla campanella (${dettaglio}${avvisi.length > 4 ? ', …' : ''})`);
    }
    for (const cosa of rotte) righe.push(testi.guidaFonteRotta(cosa));

    const prossima = await this.cosaTiPorto(userId);
    if (!righe.length) return prossima ?? { testo: testi.codaVuota(), esito: 'in_corso' };
    return {
      testo: `${testi.guida(righe)}${prossima ? `\n\n${prossima.testo}` : ''}`,
      esito: prossima?.esito ?? 'in_corso',
      stato: prossima?.stato,
    };
  }

  /** Le segnalazioni aperte sulle clienti nel perimetro: le CLINICHE contate a parte, perché vanno in testa. */
  /**
   * LA LISTA DELLA MATTINA — le voci vere, non i conteggi (Simone, 19/8: «Vera gli sottopone tutte
   * le cose che deve fare, numerate»).
   *
   * ⚠️ **Ogni fonte in un `try` suo.** «Non lo so» ≠ «nessuno»: se una lettura si rompe, la lista non
   * finge uno zero — dice quale colonna è cieca. Una lista che si presenta come «tutto quello che
   * devi fare» e ne salta una categoria in silenzio è peggio di nessuna lista, perché chi la legge
   * smette di guardare altrove. È la stessa regola di `guidaGiornata`.
   *
   * ⚠️ **Un tetto per fonte, e si dice quando taglia.** Cinquanta segnalazioni non si numerano: si
   * portano le prime e si scrive quante restano. Un elenco troncato in silenzio si legge come «è
   * tutto qui».
   */
  private async listaDellaMattina(userId: string): Promise<{ voci: VoceDaFare[]; rotte: string[]; tagliate: number }> {
    const rotte: string[] = [];
    let tagliate = 0;
    const TETTO = 10;
    /**
     * ⚠️ Se il ruolo non si legge si assume **nutrizionista**, che è il perimetro più stretto: nel
     * dubbio si vede di meno, non di più. Prima un errore qui faceva saltare l'intera risposta.
     */
    const capo = await this.ruolo(userId).then((r) => r !== 'nutritionist').catch(() => false);
    const leggi = async <T>(cosa: string, lettura: () => Promise<T[]>): Promise<T[]> => {
      try {
        const righe = await lettura();
        if (righe.length > TETTO) tagliate += righe.length - TETTO;
        return righe.slice(0, TETTO);
      } catch (err) {
        logger.warn(`Lista della mattina: non leggo ${cosa} (utente=${userId}): ${err instanceof Error ? err.message : String(err)}`);
        rotte.push(cosa);
        return [];
      }
    };

    /**
     * ⚠️ **IL PERIMETRO NON PUÒ FALLIRE APERTO** — trovato dalla revisione avversariale del 19/8
     * sera, ed è il difetto più grave dei nove.
     *
     * `perimetroClienti` che torna `null` vuol dire «nessun filtro»: è giusto per il capo, che vede
     * tutte. Ma un `.catch(() => null)` trasformava un **errore di lettura** nella stessa risposta —
     * e la lista mostrava, numerate e azionabili, le clienti di un'altra nutrizionista. Dati
     * sanitari, per giunta senza dirlo: era l'unica fonte che, rompendosi, **allargava** invece di
     * restringere.
     *
     * Se non si sa qual è il perimetro, la lista non si fa: si dice. «Non lo so» non è «tutte».
     */
    let perimetro: Awaited<ReturnType<typeof perimetroClienti>> | null = null;
    try {
      perimetro = await perimetroClienti(this.prisma, userId);
    } catch (err) {
      logger.warn(`Lista della mattina: perimetro non leggibile (utente=${userId}): ${err instanceof Error ? err.message : String(err)}`);
      return { voci: [], rotte: ['di quali clienti ti occupi'], tagliate: 0 };
    }
    const nomeDi = (c: unknown): string =>
      ((c as { clientProfile?: { name?: string | null } } | null)?.clientProfile?.name ?? '').trim() || 'una cliente';

    const segnalazioni = await leggi('le segnalazioni', async () => {
      const righe = (await this.prisma.escalation.findMany({
        where: { status: { in: ['open', 'in_progress'] }, ...filtroPerimetroSuCliente(perimetro) } as never,
        orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
        take: 40,
        select: { id: true, category: true, reason: true, client: { select: { clientProfile: { select: { name: true } } } } },
      })) as { id: string; category: string | null; reason: string | null; client: unknown }[];
      return righe.map((r) => ({
        tipo: (r.category === 'clinical' ? 'segnalazione_clinica' : 'segnalazione') as TipoVoce,
        id: r.id,
        titolo: `${nomeDi(r.client)}: ${(r.reason ?? 'segnalazione aperta').slice(0, 90)}`,
      }));
    });

    /**
     * ⚠️ LA CODA «DA VALIDARE», che nel quadro dei conteggi **non c'era affatto**: viveva solo nel
     * riquadro della home. Un elenco che dice «queste sono tutte le cose che devi fare» e ne salta
     * una categoria intera insegna a non fidarsi del resto.
     */
    const daValidare = await leggi('la coda «Da validare»', async () => {
      const clienti = (await this.prisma.clientProfile.findMany({
        where: (perimetro ? { [perimetro.field]: { in: perimetro.staffIds } } : {}) as never,
        select: { userId: true },
        take: 1000,
      })) as { userId: string }[];
      if (!clienti.length) return [];
      const righe = (await this.prisma.engineDecision.findMany({
        where: { clientId: { in: clienti.map((c) => c.userId) }, flaggedForReview: true, reviewedAt: null } as never,
        orderBy: { createdAt: 'asc' },
        take: 40,
        select: { id: true, reasonKey: true, client: { select: { clientProfile: { select: { name: true } } } } },
      })) as { id: string; reasonKey: string | null; client: unknown }[];
      return righe.map((r) => ({
        tipo: 'da_validare' as TipoVoce,
        id: r.id,
        causa: r.reasonKey,
        cliente: nomeDi(r.client),
        titolo: `${nomeDi(r.client)}: ${isCausa(r.reasonKey) ? ETICHETTA_CAUSA[r.reasonKey] : 'decisione del motore da guardare'}`,
      }));
    });

    const proposte = capo
      ? await leggi('le proposte da approvare', async () => {
          const righe = (await this.registro.daApprovare(40)) as unknown as {
            id: string; frase: string; soggettoNome: string | null;
          }[];
          return righe.map((r) => ({
            tipo: 'proposta_da_approvare' as TipoVoce,
            id: r.id,
            titolo: `${r.soggettoNome ? `${r.soggettoNome}: ` : ''}${(r.frase ?? '').slice(0, 90)}`,
          }));
        })
      : [];

    const domande = await leggi('le domande aperte', async () => {
      const righe = await this.richieste.aperte(userId, capo);
      return righe.slice(0, 40).map((r) => ({
        tipo: 'domanda_aperta' as TipoVoce,
        id: r.id,
        titolo: `${r.clienteNome ?? 'una cliente'}: ${tronca(r.testo ?? '', 90)}`,
      }));
    });

    /**
     * ⚠️ Le sostituzioni e il catalogo restano **conteggi**, e la lista lo dice: sono code che si
     * aprono a parte, una voce per volta, e numerarle qui vorrebbe dire prometterne l'apertura da
     * questa lista. Meglio una riga onesta che dieci righe che non si possono depennare.
     */
    const daVerificare = await this.registro.sostituzioniDaVerificare(userId).catch(() => {
      rotte.push('le sostituzioni da verificare');
      return 0;
    });
    const sostituzioni: VoceDaFare[] = daVerificare
      ? [{
          tipo: 'sostituzione_da_verificare',
          id: 'coda',
          titolo: `${daVerificare} ${daVerificare === 1 ? 'cambio concordato in chat da verificare' : 'cambi concordati in chat da verificare'}`,
        }]
      : [];

    const voci = numera([...segnalazioni, ...daValidare, ...proposte, ...domande, ...sostituzioni]);
    return { voci, rotte, tagliate };
  }

  /**
   * La lista, scritta. ⚠️ Le fonti rotte e il taglio si **dicono**: un elenco che si presenta come
   * «tutto quello che devi fare» e tace su una colonna cieca o su venti righe tagliate insegna a
   * fidarsi di un elenco incompleto.
   */
  private async mostraLista(userId: string): Promise<EsitoVera> {
    const { voci, rotte, tagliate } = await this.listaDellaMattina(userId);
    const nome = await this.nomeStaff(userId).catch(() => null);
    const pezzi = [testoDellaLista(voci, nome)];
    if (tagliate > 0) {
      pezzi.push(`(Ce ne sono altre ${tagliate}: te le porto quando queste sono chiuse.)`);
    }
    /**
     * ⚠️ LA LISTA NON PUÒ DIRE MENO DEL QUADRO CHE SOSTITUISCE.
     *
     * Fino al 19/8 «cosa devo fare oggi?» portava il quadro in conteggi, e lì dentro c'erano due
     * cose che qui **non si numerano**: le approvazioni del catalogo e la campanella. Le prime
     * perché si aprono da una coda a parte, una voce per volta; la seconda perché un avviso non
     * letto non è un lavoro da depennare. ⚠️ Ma toglierle dalla risposta vorrebbe dire che passando
     * alla lista qualcuno smette di vedere una coda che prima vedeva — un miglioramento che perde
     * pezzi non è un miglioramento. Restano in fondo, come righe.
     */
    const coda: string[] = [];
    const invito = await this.invitoApprovazioni().catch(() => null);
    if (invito) coda.push(`· ${invito}`);
    const avvisi = await this.avvisiNonLetti(userId).catch(() => {
      rotte.push('la campanella');
      return [] as { tipo: string; quanti: number }[];
    });
    if (avvisi.length) {
      const totale = avvisi.reduce((somma, a) => somma + a.quanti, 0);
      const dettaglio = avvisi.slice(0, 4).map((a) => `${a.quanti} su ${etichettaAvviso(a.tipo)}`).join(', ');
      coda.push(`· ${totale} ${totale === 1 ? 'avviso non letto' : 'avvisi non letti'} sulla campanella (${dettaglio}${avvisi.length > 4 ? ', …' : ''})`);
    }
    if (coda.length) pezzi.push(`Non numerate, perché si aprono da un'altra parte:\n${coda.join('\n')}`);

    if (rotte.length) {
      pezzi.push(`⚠️ Non sono riuscita a leggere ${rotte.join(' e ')}: su quello questa lista è cieca, non vuota.`);
    }
    /**
     * ⚠️ **Le voci si conservano nello stato**, e non si rileggono a «la 3».
     *
     * Fra la lista e la scelta passano dei secondi, ma in quei secondi una collega può chiudere una
     * segnalazione: rileggendo, la terza riga diventerebbe **un'altra cosa** — e si aprirebbe
     * qualcosa di diverso da quello che ha letto sullo schermo. Il numero deve valere su ciò che ha
     * visto, non su ciò che c'è adesso.
     */
    return {
      testo: pezzi.join('\n\n'),
      esito: 'in_corso',
      stato: voci.length ? { passo: 'lista_aperta', frase: '', listaVoci: voci } : undefined,
    };
  }

  /**
   * «LA 3» — si apre la terza voce della lista che ha davanti.
   *
   * ⚠️ Se il numero non si legge **non si indovina**: si ripresenta l'elenco. Aprire «la prima» a
   * chi ha scritto «la 12» su una lista di sei sarebbe la cosa peggiore — un'azione su una riga che
   * non ha scelto.
   */
  /** Le parole con cui si esce da un giro. ⚠️ Non sono dati: vedi `equivalenzaAlimenti`. */
  private static readonly USCITE = /^(?:basta|lascia stare|lasciamo stare|niente|annulla|annullo|esci|chiudi|stop|fine|non lo so|boh|va bene cosi)$/i;

  private async listaScegli(userId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const voci = (stato.listaVoci ?? []) as VoceDaFare[];
    // «elenco» rimostra la lista: è la via d'uscita quando il numero non si ricorda più.
    if (/^(?:elenco|lista|rivedi|rifammi la lista|ripeti)$/i.test((frase ?? '').trim())) {
      return this.mostraLista(userId);
    }
    /**
     * ⚠️ **SI DEVE POTER USCIRE.** La revisione del 19/8 sera ha trovato che questo passo era un
     * vicolo cieco lungo due ore: qualunque cosa non fosse un numero riceveva «non ho capito quale»,
     * e nemmeno «annulla» ne usciva. Chi chiedeva la lista al mattino non poteva più fare **niente
     * altro** con Vera fino alla scadenza della conversazione — compreso scrivere un divieto, che è
     * il mestiere.
     */
    if (/^(?:basta|lascia stare|niente|annulla|esci|chiudi|stop|fine|va bene cosi)$/i.test((frase ?? '').trim())) {
      return { testo: 'Va bene, chiudo la lista. Dimmi pure altro. 💚', esito: 'annullata' };
    }
    const n = leggiIlNumero(frase, voci.length);
    if (n === null) {
      /**
       * ⚠️ E se quello che ha scritto è **un comando vero** — «a Giulia niente pollo» — non si
       * ingoia: si esce dalla lista e lo si esegue. Un assistente che tiene in ostaggio la
       * conversazione perché sta aspettando un numero è peggio di uno che non ha la lista.
       */
      if (capisci(frase)) return this.nuovoGiro(userId, frase);
      return {
        testo: `Non ho capito quale. Dimmi il numero, da 1 a ${voci.length}, «elenco» per rivederle, o «basta» per chiudere la lista.`,
        esito: 'in_corso',
        stato,
      };
    }
    const voce = voci.find((v) => v.n === n)!;
    const azioni = azioniDi(voce);
    const righe = azioni.map((a, i) => {
      const d = descriviAzione(a);
      return `${i + 1}) **${d.etichetta}** — ${d.cosaFa}`;
    });
    return {
      testo: [`**${voce.titolo}**`, '', 'Cosa faccio?', ...righe, '', 'Dimmi il numero, o «lascia stare».'].join('\n'),
      esito: 'in_corso',
      stato: { ...stato, passo: 'lista_voce', listaVoceScelta: voce },
    };
  }

  /**
   * L'azione scelta su una voce della lista.
   *
   * ⚠️ **Quello che si può eseguire da qui si esegue passando dalla stessa porta dei pulsanti**
   * (`SCRITTURA_DECISIONE` → `NutritionistService.eseguiAzione`): le regole su quali azioni sono
   * ammesse per quale causa, sul perimetro e su «una decisione si lavora una volta sola» stanno là e
   * non si duplicano. ⚠️ Quello che **non** si esegue da qui — aprire una scheda, scrivere in chat —
   * si dice dove si fa, invece di far finta di averlo fatto.
   */
  private async listaAzione(userId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const voce = stato.listaVoceScelta as VoceDaFare | undefined;
    if (!voce) return this.mostraLista(userId);
    if (/^(?:lascia stare|niente|annulla|no|indietro)$/i.test((frase ?? '').trim())) {
      return { testo: 'Va bene, non tocco niente. Dimmi un altro numero, o «elenco».', esito: 'in_corso', stato: { ...stato, passo: 'lista_aperta' } };
    }
    const azioni = azioniDi(voce);
    const n = leggiIlNumero(frase, azioni.length);
    if (n === null) {
      return { testo: `Dimmi il numero dell'azione, da 1 a ${azioni.length} — oppure «lascia stare».`, esito: 'in_corso', stato };
    }
    const azione = azioni[n - 1];
    const d = descriviAzione(azione);

    if (voce.tipo === 'da_validare' && (azione === AZIONI_MOTORE.AUTORIZZA_PROSEGUIRE || azione === AZIONI_MOTORE.BLOCCA_PIANO)) {
      const ruolo = await this.ruolo(userId);
      try {
        await this.decisioni.eseguiAzione({ sub: userId, email: '', role: ruolo as never }, voce.id, azione);
      } catch (err) {
        /**
         * ⚠️ L'errore del servizio si **riporta**, non si riscrive: «questa decisione è già stata
         * lavorata» è una frase che dice cosa fare (ricaricare), e sostituirla con un generico
         * «non è riuscito» toglierebbe l'unica informazione utile.
         */
        return { testo: `Non l'ho fatto: ${err instanceof Error ? err.message : 'errore'}`, esito: 'in_corso', stato: { ...stato, passo: 'lista_aperta' } };
      }
      return this.dopoIlDepennamento(stato, voce, `${d.etichetta}: fatto su ${voce.titolo}.`, 'scritta');
    }

    /**
     * ⛔ **«ALZA LE CALORIE» CHIEDE UN NUMERO, e la risposta giusta non è «non posso»** (28/8).
     *
     * Questa azione è nata insieme alla nota in scheda, ed è eseguibile dal server come le altre
     * due — ma solo con la percentuale e i giorni, che un numero scelto da una lista non contiene.
     * ⚠️ Dire qui «non la faccio io da qui» sarebbe **falso**: la correzione delle calorie Vera la
     * sa dettare da settimane (`avviaCorrezioneKcal`), con anteprima e conferma. Quello che manca è
     * il numero, e la cosa utile è chiederlo.
     *
     * ⚠️ E si dice che la riga **resta in elenco**: applicare la correzione non chiude la decisione,
     * e far sparire la voce lasciando la coda piena è il difetto già trovato il 19/8.
     */
    if (voce.tipo === 'da_validare' && azione === AZIONI_MOTORE.ALZA_CALORIE) {
      return {
        testo: [
          `**${d.etichetta}** — ${d.cosaFa}`,
          '',
          `⚠️ Mi serve **di quanto**: dimmelo a parole, per esempio «${esempioCorrezioneKcal(voce.cliente)}».`,
          'Ti faccio vedere il prima e il dopo, e applico solo se confermi.',
          '',
          'La riga resta in elenco finché non la chiudi: la correzione e la presa in carico sono due cose.',
        ].join('\n'),
        esito: 'in_corso',
        stato: { ...stato, passo: 'lista_aperta' },
      };
    }

    /**
     * ⚠️ Le altre azioni **non si eseguono da qui**, e si dice dove si fanno. Fingere di averle fatte
     * — o aprire una scorciatoia che salta i permessi della pagina vera — è il modo in cui nascono
     * due strade per la stessa modifica, con controlli diversi.
     */
    /**
     * ⚠️ QUESTA NON SI ESEGUE DA QUI, E **NON SI DEPENNA**. Prima la voce spariva dalla lista e il
     * testo chiudeva con «Fatto», dopo aver detto nella riga sopra che non era stato fatto niente:
     * la segnalazione restava aperta e usciva dall'elenco con la parola «fatto» accanto. Trovato
     * dalla revisione del 19/8 sera. Adesso resta in lista, dove deve stare finché non è chiusa
     * davvero.
     */
    return {
      testo: [
        `**${d.etichetta}** — ${d.cosaFa}`,
        '',
        '⚠️ Questa non la faccio io da qui: si fa dalla pagina, coi suoi permessi — e resta in elenco',
        'finché non è chiusa davvero. Dimmi un altro numero, o «elenco» per rivederle.',
      ].join('\n'),
      esito: 'in_corso',
      stato: { ...stato, passo: 'lista_aperta' },
    };
  }

  /**
   * Dopo un depennamento: **si ristampa la lista**, non si rinumera in silenzio.
   *
   * ⚠️ È il difetto peggiore trovato dalla revisione del 19/8 sera. Rinumerando lo stato senza
   * ristampare, sullo schermo restavano i numeri vecchi e in memoria c'erano quelli nuovi: dopo aver
   * chiuso la 1, «la 3» apriva la **quarta** — e su una coda «Da validare» quella è una scrittura
   * clinica sul piano di un'altra cliente. Il commento in `mostraLista` prometteva esattamente di
   * evitarlo, e questo lo aggirava.
   */
  private dopoIlDepennamento(stato: StatoVera, voce: VoceDaFare, capo: string, esito: EsitoVera['esito']): EsitoVera {
    const restanti = numera(
      ((stato.listaVoci ?? []) as VoceDaFare[]).filter((v) => v.id !== voce.id).map((v) => ({ ...v, n: undefined })),
    );
    if (!restanti.length) return { testo: `${capo}\n\n${testoDepennata(0)}`, esito };
    return {
      // ⚠️ L'elenco si riscrive intero: i numeri che legge devono essere quelli che valgono.
      testo: `${capo}\n\n${testoDellaLista(restanti)}`,
      esito,
      stato: { ...stato, passo: 'lista_aperta', listaVoci: restanti, listaVoceScelta: undefined },
    };
  }

  private async contaSegnalazioni(userId: string): Promise<{ cliniche: number; altre: number }> {
    const perimetro = await perimetroClienti(this.prisma, userId);
    const base = { status: { in: ['open', 'in_progress'] }, ...filtroPerimetroSuCliente(perimetro) };
    const [cliniche, tutte] = await Promise.all([
      this.prisma.escalation.count({ where: { ...base, category: 'clinical' } as never }),
      this.prisma.escalation.count({ where: base as never }),
    ]);
    return { cliniche, altre: Math.max(0, tutte - cliniche) };
  }

  /**
   * La campanella: gli avvisi in-app non letti, raggruppati per tipo.
   *
   * ⚠️ `vera_richiesta` e `vera_proposta_in_coda` si SALTANO: quelle code il quadro le conta già
   * dalle tabelle di origine, e due contatori sulla stessa cosa prima o poi ne dicono due.
   * ⚠️ E si contano, NON si marcano lette: leggerne il conto in chat non è averle gestite.
   */
  private async avvisiNonLetti(userId: string): Promise<{ tipo: string; quanti: number }[]> {
    const righe = (await this.prisma.notification.findMany({
      where: { userId, channel: 'inapp', readAt: null, archivedAt: null, sentAt: { not: null } } as never,
      select: { type: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })) as { type: string }[];
    const conta = new Map<string, number>();
    for (const r of righe) {
      if (AVVISI_GIA_CONTATI.has(r.type)) continue;
      conta.set(r.type, (conta.get(r.type) ?? 0) + 1);
    }
    return [...conta.entries()].map(([tipo, quanti]) => ({ tipo, quanti }));
  }

  /**
   * COSA TI PORTO quando apro bocca senza che tu me l'abbia chiesto.
   *
   * Due code, e l'ordine conta: **prima le proposte da approvare** (dietro c'è una nutrizionista che
   * aspetta), poi le domande aperte (dietro c'è una cliente il cui piatto oggi non è filtrato).
   * `null` = non ho niente da dirti, e allora **non dico niente**: un agente che saluta con «non c'è
   * nulla da fare» ogni volta insegna a non leggerlo.
   */
  private async cosaTiPorto(userId: string): Promise<EsitoVera | null> {
    const capo = (await this.ruolo(userId)) !== 'nutritionist';
    if (capo) {
      const proposta = await this.sottoponiProssima(userId);
      if (proposta) return proposta;
    }
    const richiesta = await this.prossimaRichiesta(userId, capo);
    if (richiesta) return richiesta;
    /**
     * I cambi concordati in chat (voce 245) vengono **dopo** le due code di sopra e **prima** della
     * manutenzione: dietro una sostituzione da verificare c'è una cliente che ha già mangiato
     * qualcos'altro — non aspetta una risposta, ma aspetta che qualcuno guardi.
     */
    const cambio = await this.prossimaSostituzione(userId);
    if (cambio) return cambio;
    /**
     * ⚠️ La manutenzione del dizionario è **ultima**, e non per gentilezza: dietro le altre due
     * code c'è qualcuno che aspetta — una nutrizionista ferma, una cliente il cui piatto oggi non è
     * filtrato. Qui dietro non c'è nessuno che aspetta: c'è una regola che copre un po' meno di
     * quello che lei crede. Metterla davanti vorrebbe dire far scendere le cose urgenti sotto una
     * domanda di ordinaria amministrazione.
     */
    return this.manutenzioneDizionario(userId);
  }

  /**
   * IL DIZIONARIO CHE INVECCHIA — la domanda che nessuno farebbe mai spontaneamente.
   *
   * «Formaggi molli» sono nove nomi spuntati un martedì. Entra la burrata, la lista non la contiene,
   * e la regola continua a girare **su un elenco vecchio**: nessun errore, nessuna riga rossa. È
   * l'ultimo guasto silenzioso rimasto, e si chiude solo chiedendo — a lei, nella sua chat, quando
   * non c'è niente di più urgente.
   *
   * ⚠️ **Una famiglia per volta.** Portarne tre insieme trasforma la domanda in un modulo da
   * compilare, e a un modulo si risponde «va bene tutto» senza leggerlo — cioè si fa entrare nel
   * dizionario proprio quello che non c'entra.
   */
  private async manutenzioneDizionario(userId: string): Promise<EsitoVera | null> {
    // ⚠️ Sotto `try`: è manutenzione, e sta in fondo a `cosaTiPorto`, che gira **a ogni apertura di
    // pagina e dopo ogni decisione**. Se questa lettura si rompe, la cosa giusta è che non si veda
    // — non che la nutrizionista non riesca più a parlare con l'assistente.
    let invecchiate: Awaited<ReturnType<DizionarioService['famiglieDaAggiornare']>> = [];
    try {
      invecchiate = await this.dizionario.famiglieDaAggiornare(userId);
    } catch {
      return null;
    }
    if (!invecchiate.length) return null;
    const f = invecchiate[0];
    return {
      testo: testi.dizionarioInvecchiato(f.nome, f.candidati),
      esito: 'in_corso',
      stato: { passo: 'aggiorna_famiglia', frase: '', famigliaId: f.famigliaId, famiglia: f.nome, proposti: f.candidati },
    };
  }

  /**
   * La risposta: quali di quelli entrano davvero.
   *
   * ⚠️ Un «no» **scrive lo stesso** (`lasciaComEra`), e sembra una scrittura inutile: sposta la data
   * della voce, che è la linea fra il vecchio e il nuovo. Senza, la stessa domanda tornerebbe
   * identica alla prossima apertura di pagina, per sempre — e una domanda che torna dopo che le hai
   * risposto è il modo più rapido per insegnare a non leggerla.
   *
   * ⚠️ Si tengono solo i nomi che erano fra i proposti. Non per diffidenza: qui lei sta spuntando da
   * un elenco, non dettando, e un nome scritto a mano in questo passo finirebbe nella famiglia senza
   * passare dal catalogo — cioè un membro che non corrisponde a nessun alimento vero, che non toglie
   * niente e che nessuno saprà mai perché è lì.
   */
  private async allargaFamiglia(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const famiglia = stato.famiglia ?? '';
    const proposti = stato.proposti ?? [];
    const risposta = leggiConferma(frase);
    const nessuno = risposta === false || /^\s*(nessun[oa]|niente|nulla)\b/i.test(normalizza(frase));

    if (nessuno) {
      if (stato.famigliaId) await this.dizionario.lasciaComEra(nutrizionistaId, stato.famigliaId).catch(() => undefined);
      const dopo = await this.cosaTiPorto(nutrizionistaId);
      return {
        testo: `${testi.dizionarioLasciatoComEra(famiglia)}${dopo ? `\n\n${dopo.testo}` : ''}`,
        esito: 'in_corso',
        stato: dopo?.stato,
      };
    }

    const detti = leggiElenco(frase);
    const scelti = proposti.filter((p) => detti.some((d) => combaciaAlimento(p, d) || combaciaAlimento(d, p)));
    // «tutti» / «sì» senza elenco: prende quello che ha appena letto, che è corto per costruzione.
    const membri = scelti.length ? scelti : risposta === true || /^\s*tutt[ie]\b/i.test(normalizza(frase)) ? proposti : [];
    if (!membri.length) {
      return { testo: testi.dizionarioInvecchiato(famiglia, proposti), esito: 'in_corso', stato };
    }

    const voce = await this.dizionario.risolvi(nutrizionistaId, famiglia);
    await this.dizionario.insegna(nutrizionistaId, {
      nome: famiglia,
      membri: [...(voce?.membri ?? []), ...membri],
    });
    const dopo = await this.cosaTiPorto(nutrizionistaId);
    return {
      testo: `${testi.famigliaAllargata(famiglia, membri)}${dopo ? `\n\n${dopo.testo}` : ''}`,
      esito: 'scritta',
      stato: dopo?.stato,
    };
  }

  /**
   * ⛔ **IL PROMEMORIA SI METTE DA PARTE, NON SI «RISPONDE».**
   *
   * Qualunque cosa scriva, non si tocca niente: la richiesta si chiude **senza risposta** e la
   * conversazione va avanti. La decisione clinica ha un posto solo — la scheda della cliente — e
   * questo passo esiste apposta perché non ne nasca un secondo.
   *
   * ⚠️ Chiuderla non vuol dire archiviare la persona: il giro notturno la riapre alla finestra dopo
   * finché `idoneita` resta vuota. È il motivo per cui qui si può chiudere senza sensi di colpa —
   * e il motivo per cui la coda di Vera non si riempie di promemoria vecchi.
   */
  private async promemoriaVisto(nutrizionistaId: string, stato: StatoVera): Promise<EsitoVera> {
    if (stato.richiestaId) {
      await this.richieste
        .chiudiSenzaRisposta(stato.richiestaId, nutrizionistaId, 'Promemoria di sorveglianza messo da parte.')
        .catch(() => undefined);
    }
    const dopo = await this.cosaTiPorto(nutrizionistaId);
    return {
      testo: `${testi.promemoriaMessoDaParte(stato.clienteNome ?? null)}${dopo ? `\n\n${dopo.testo}` : ''}`,
      esito: 'in_corso',
      stato: dopo?.stato,
    };
  }

  /** La prossima domanda aperta, scritta com'era: chi sa cosa manca l'ha già formulata. */
  private async prossimaRichiesta(userId: string, capo: boolean, giro = 0): Promise<EsitoVera | null> {
    const aperte = await this.richieste.aperte(userId, capo);
    if (!aperte.length) return null;
    const r = aperte[0];

    /**
     * LE DOMANDE GIRATE DA GAIA (Simone, 14/8) hanno una loro strada: si risponde a testo libero e
     * la risposta va DAVVERO alla cliente.
     *
     * ⚠️ Prima di farla si guarda se la segnalazione è ancora aperta: se qualcuno l'ha già gestita
     * dalla pagina, la domanda si chiude da sola e si passa alla prossima. Una domanda che torna
     * dopo che l'hai già gestita altrove è il modo più rapido per insegnare a non leggere l'agente.
     */
    if ((r as { tipo?: string }).tipo === 'girata_da_gaia') {
      const escalationId = escalationIdDallaChiave((r as { chiave?: string }).chiave);
      if (escalationId && !(await segnalazioneAncoraAperta(this.prisma, escalationId))) {
        await this.richieste.chiudiSenzaRisposta(r.id, userId, 'Già gestita dalla pagina Segnalazioni.');
        // ⚠️ Il `giro` è il freno: se una chiusura non andasse a buon fine, la stessa richiesta
        // tornerebbe in testa e questo giro non finirebbe mai. Dopo qualche tentativo si smette.
        return giro < 5 ? this.prossimaRichiesta(userId, capo, giro + 1) : null;
      }
      return {
        testo: testi.girataDaGaia(aperte.length, r.clienteNome, r.testo),
        esito: 'in_corso',
        stato: {
          passo: 'risposta_cliente',
          frase: r.testo,
          richiestaId: r.id,
          clienteId: r.clienteId,
          clienteNome: r.clienteNome ?? undefined,
          escalationId: escalationId ?? undefined,
        },
      };
    }
    /**
     * ⛔ **IL PROMEMORIA SUI PERCORSI SUPERVISIONATI HA LA SUA STRADA** — trovato in revisione, 25/8.
     *
     * Senza questo ramo cadeva nel generico qui sotto, che chiede *«quali alimenti tolgo dal
     * piatto?»*: la risposta di Lucia finiva **fra le intolleranze della cliente** e poteva
     * diventare una proposta di voce del dizionario per tutte. Vedi il riquadro su
     * `testi.promemoriaSupervisione`.
     *
     * ⚠️ È lo stesso difetto di forma che questo file ha già avuto: un tipo nuovo aggiunto
     * all'unione `TipoRichiesta` **non rende rosso niente**, perché qui non c'è uno `switch`
     * esaustivo ma un `if` e un ramo generico. Chi aggiunge un tipo deve aggiungere anche il suo
     * ramo — e il test `ogni-tipo-ha-la-sua-strada.spec.ts` adesso lo pretende.
     */
    if ((r as { tipo?: string }).tipo === TIPO_PROMEMORIA) {
      return {
        testo: testi.promemoriaSupervisione(aperte.length, r.clienteNome, r.testo),
        esito: 'in_corso',
        stato: {
          passo: 'promemoria_supervisione',
          frase: r.testo,
          richiestaId: r.id,
          clienteId: r.clienteId,
          clienteNome: r.clienteNome ?? undefined,
        },
      };
    }

    return {
      testo: testi.richiesta(aperte.length, r.testo),
      esito: 'in_corso',
      stato: {
        passo: 'richiesta',
        frase: r.testo,
        richiestaId: r.id,
        clienteId: r.clienteId,
        clienteNome: r.clienteNome ?? undefined,
        termine: (r as unknown as { termine?: string | null }).termine ?? undefined,
      },
    };
  }

  /**
   * La PRIMA delle due scritture: gli alimenti finiscono fra le esclusioni di quella cliente.
   *
   * ⚠️ Passa da `RichiesteVeraService`, che a sua volta passa da `ClientsService.updateClient`: è il
   * punto unico che controlla il permesso e lascia la traccia. Scrivere il profilo da qui sarebbe la
   * seconda strada per lo stesso dato sanitario — il difetto che questo campo ha già avuto due volte.
   */
  private async rispondiARichiesta(userId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const lasciaStare = /\b(lascia stare|niente|non so|salta|dopo)\b/i.test(frase.trim());
    const alimenti = lasciaStare ? [] : leggiElenco(frase);
    if (!lasciaStare && !alimenti.length) {
      return { testo: testi.richiesta(1, stato.frase), esito: 'in_corso', stato };
    }

    const esito = await this.richieste.rispondi(userId, stato.richiestaId!, { alimenti, risposta: frase.trim() });
    const scritta = testi.rispostaScritta(esito.clienteNome, esito.aggiunti);

    // La seconda scrittura si chiede a parte, e solo se c'è una parola da imparare.
    if (alimenti.length && stato.termine) {
      return {
        testo: `${scritta}\n\n${testi.chiediGenerale(stato.termine, alimenti)}`,
        esito: 'in_corso',
        stato: { ...stato, passo: 'richiesta_generale', alimenti },
      };
    }
    const prossima = await this.cosaTiPorto(userId);
    return { testo: `${scritta}\n\n${prossima?.testo ?? ''}`.trim(), esito: 'scritta', stato: prossima?.stato };
  }

  /**
   * La SECONDA scrittura: la parola entra nel dizionario di tutte — ma solo come **proposta**.
   *
   * ⚠️ Mai scrittura diretta, nemmeno se a rispondere è il capo. Il vocabolario di tutte le clienti
   * non si allarga con una risposta data fra due visite: passa dalla coda, come tutto ciò che ha
   * quel raggio.
   */
  private async valePerTutte(userId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const risposta = leggiConferma(frase);
    if (risposta === null) {
      return {
        testo: 'Non ho capito se vale per tutte. Rispondi «sì» o «no» — nel dubbio resta solo sulla cliente.',
        esito: 'in_corso',
        stato,
      };
    }

    let coda = '';
    if (risposta === true && stato.termine) {
      const riga = (await this.registro.scrivi({
        nutrizionistaId: userId,
        frase: stato.frase,
        azione: 'voce_dizionario',
        ambito: 'catalogo',
        soggettoTipo: 'user',
        soggettoId: stato.clienteId ?? null,
        soggettoNome: stato.clienteNome ?? null,
        dettaglio: { famiglia: stato.termine, membri: stato.alimenti ?? [] },
        inApprovazione: true,
      })) as { id: string };
      if (stato.richiestaId) await this.richieste.collega(stato.richiestaId, riga.id);
      coda = testi.propostaDizionario(stato.termine);
    }

    const prossima = await this.cosaTiPorto(userId);
    return {
      testo: [coda, prossima?.testo].filter(Boolean).join('\n\n') || 'Va bene, resta solo sulla cliente.',
      esito: risposta ? 'in_approvazione' : 'scritta',
      stato: prossima?.stato,
    };
  }

  private async ruolo(userId: string): Promise<string> {
    const u = (await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } })) as { role: string } | null;
    return u?.role ?? 'nutritionist';
  }

  private async nomeStaff(userId: string): Promise<string> {
    const s = (await this.prisma.staff.findUnique({
      where: { userId } as never,
      select: { displayName: true },
    })) as { displayName: string } | null;
    return s?.displayName ?? 'Una nutrizionista';
  }

  // ──────────────────────────────────────────────────────────────── utilità ──

  private async statoAperto(nutrizionistaId: string): Promise<StatoVera | null> {
    const ultimo = (await this.prisma.messaggioVera.findFirst({
      where: { nutrizionistaId, ruolo: 'agente' },
      orderBy: { createdAt: 'desc' },
      select: { meta: true, createdAt: true },
    })) as { meta: unknown; createdAt: Date } | null;
    if (!ultimo) return null;
    // Un dialogo lasciato a metà stamattina non è un dialogo in corso.
    if (Date.now() - ultimo.createdAt.getTime() > SCADENZA_VERA_MS) return null;
    const meta = (ultimo.meta ?? {}) as { stato?: StatoVera };
    return meta.stato?.passo ? meta.stato : null;
  }

  private async scriviAgente(
    nutrizionistaId: string,
    testo: string,
    stato?: StatoVera,
    extra: Record<string, unknown> = {},
  ) {
    await this.prisma.messaggioVera.create({
      data: {
        nutrizionistaId,
        ruolo: 'agente',
        testo,
        meta: { ...(stato ? { stato } : {}), ...extra } as never,
      } as never,
    });
  }
}

/**
 * ⛔ **LA FORMA VECCHIA CONTINUA A VALERE — 31/8.**
 *
 * Dal 31/8 `IntentoSostituzione` porta due **liste** (`da`/`a`); fino al giorno prima portava due
 * **stringhe** (`from`/`to`). E l'intento non vive solo nell'istante in cui si legge la frase:
 * resta scritto nello **stato della conversazione** e nelle **proposte in coda**, che possono
 * aspettare giorni.
 *
 * ⚠️ Quindi al primo rilascio esistono per davvero conversazioni aperte con dentro la forma
 * vecchia: leggere solo `da`/`a` vorrebbe dire che una nutrizionista scrive «confermo» a
 * un'anteprima che ha appena letto e si becca un errore — o, peggio, un silenzio. Qui si leggono
 * tutte e due, e il caso singolo è l'elenco di uno.
 */
export function elenchiDellIntento(
  i: { from?: string; to?: string; da?: string[]; a?: string[] },
): { da: string[]; a: string[] } {
  return {
    da: Array.isArray(i.da) && i.da.length ? i.da : i.from ? [i.from] : [],
    a: Array.isArray(i.a) && i.a.length ? i.a : i.to ? [i.to] : [],
  };
}
