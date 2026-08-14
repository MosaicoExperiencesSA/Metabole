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
import { chiaveAlimento, combaciaAlimento, normalizza } from '../common/nomi-alimento';
import { filtroPerimetroSuCliente, perimetroClienti } from '../common/perimetro-clienti';
import { etichettaSlot } from '../common/slot-pasto';
import { registraSostituzione } from '../food-swaps/registra-sostituzione';
import { expandExclusion } from '../menu/exclusions';
import { ValoriNutrizionaliService } from '../nutrient-facts/valori-nutrizionali.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { capisci, Intento, IntentoCambioDieta, IntentoCorrezioneKcal, IntentoProteine, IntentoFamiglia, IntentoPasti, IntentoRestrizione, IntentoRicetta, IntentoSostituzione, separaCitazione } from './capisci';
import { Spuntino, etichettaSpuntino, giorniDaRifarePerPasti, leggiQualeSpuntino, pastiDopo } from './togli-spuntino';
import { DizionarioService } from './dizionario.service';
import { conflittiDiPromozione, raccontaConflitti } from './conflitti-dizionario';
import { minimoDaPiuProteine, quotaProteicaMinima } from '../menu/correzione-kcal';
import { calcolaMacro, raccontaMacro, ValorePer100 } from './macro-da-ingredienti';
import { PoolDisponibileService } from './pool-disponibile.service';
import { RegistroVeraService } from './registro.service';
import { cosaManca, leggiRicetta, RicettaDettata } from './ricetta-dettata';
import { RichiesteVeraService } from './richieste.service';
import { RicettaDaScrivere, SCRITTURA_RICETTA, ScritturaRicetta } from './scrittura-ricetta';
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
} from './vera-chat';

interface ClienteTrovata {
  id: string;
  nome: string;
  email: string;
}

/** Quanti alimenti si propongono quando si chiede «quali sono?». Oltre, l'elenco non si legge. */
const MAX_PROPOSTI = 20;

const logger = new Logger('VeraChat');

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

  private async nuovoGiro(nutrizionistaId: string, fraseIntera: string): Promise<EsitoVera> {
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
      // «annulla» con niente in corso: dirlo — «non ci arrivo» sarebbe vero e fuorviante.
      if (/\b(annulla|lascia stare|lascia perdere|ferma tutto)\b/i.test(frase)) {
        return { testo: testi.nienteDaAnnullare(), esito: 'in_corso' };
      }
      // Il capo che scrive «cosa c'è da vedere?» non sta dettando una regola: sta chiedendo la coda.
      // Si prova quella PRIMA di rispondere «non ho capito», che sarebbe vero e inutile.
      const prossima = await this.cosaTiPorto(nutrizionistaId);
      if (prossima) return prossima;
      return { testo: testi.nonCapito(1), esito: 'non_capito', stato: { passo: 'conferma', frase, tentativi: 1 } };
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
    if (intento.tipo === 'segnalazioni') return this.guidaGiornata(nutrizionistaId);
    if (intento.tipo === 'famiglia') return this.famigliaASecco(nutrizionistaId, intento, frase);
    if (intento.tipo === 'ricetta') return this.avviaRicetta(nutrizionistaId, intento, frase);
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
      case 'ricetta_conferma':
        return this.scriviLaRicetta(nutrizionistaId, stato, frase);
      case 'quanti_giorni':
        return this.leggiQuantiGiorni(nutrizionistaId, stato, frase);
      case 'risposta_cliente':
        return this.rispondiAllaGirata(nutrizionistaId, stato, frase);
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
    const nome = esito.tipo === 'scegli_tu' ? 'Vera' : esito.nome;
    await this.prisma.staff.updateMany({
      where: { userId: nutrizionistaId } as never,
      data: { nomeAgente: nome } as never,
    });
    return { testo: testi.nomePreso(nome), esito: 'in_corso' };
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

    return {
      testo: testi.anteprimaRicetta(
        ricetta.nome!,
        etichettaSlot(ricetta.slot!),
        ETICHETTA_REGIME[ricetta.regime!] ?? ricetta.regime!,
        ricetta.ingredienti.map((i) => `${i.name}${i.qty ? ` ${i.qty} ${i.unit ?? 'g'}` : ''}`),
        raccontaMacro(macro),
        stato.modoRicetta ?? 'nuova',
      ),
      esito: 'in_corso',
      stato: { ...dopo, passo: 'ricetta_conferma' },
    };
  }

  /** I valori veri, uno per ingrediente. La ricerca per nome e sinonimi è quella di Gaia. */
  private async macroDiRicetta(ricetta: RicettaDettata) {
    const valori = new Map<string, ValorePer100 | null>();
    for (const i of ricetta.ingredienti) {
      if (valori.has(i.name)) continue;
      const v = (await this.valori.cerca(i.name).catch(() => null)) as ValorePer100 | null;
      valori.set(i.name, v);
    }
    return calcolaMacro(ricetta.ingredienti, valori);
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

    const campi: RicettaDaScrivere = {
      name: ricetta.nome!,
      regime: ricetta.regime!,
      mealSlot: ricetta.slot!,
      kcal: macro.kcal,
      ingredients: ricetta.ingredienti.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit })),
      macros: macro.macros,
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

    const nuova = (await this.ricette.createRecipe(nutrizionistaId, campi)) as { id: string };
    const riga = (await this.registro.scrivi({
      nutrizionistaId,
      frase: stato.testoRicetta ?? stato.frase,
      azione: 'ricetta_nuova',
      ambito: 'catalogo',
      soggettoTipo: 'recipe',
      soggettoId: nuova.id,
      soggettoNome: campi.name,
      dettaglio: { campi },
      inApprovazione: true,
    })) as { id: string };
    return { testo: testi.ricettaScritta(campi.name), esito: 'in_approvazione', azioneId: riga.id };
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

    // LE PROTEINE (14/8, decisione A): la quota minima di questa cliente, mostrata in percentuale.
    if (intento.tipo === 'proteine') {
      return this.anteprimaProteine(stato, intento as IntentoProteine);
    }

    // LE CALORIE (14/8, Nocanty via Vera): anteprima col numero VERO, poi conferma, poi la porta.
    if (intento.tipo === 'correzione_kcal') {
      return this.avviaCorrezioneKcal(nutrizionistaId, stato, intento as IntentoCorrezioneKcal);
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
      const i = intento as IntentoSostituzione;
      return `Per **${cliente}**: al posto di «${i.from}» metto «${i.to}».`;
    }
    const i = intento as IntentoRestrizione;
    const tenuti = i.tenuti.length ? ` Tengo: ${i.tenuti.join(', ')}.` : '';
    return `Per **${cliente}** vieto ${termini.length} aliment${termini.length === 1 ? 'o' : 'i'}: ${termini.join(', ')}.${tenuti}`;
  }

  // ──────────────────────────────────────────────── i pasti (azione 3, Decisioni §14) ──

  /** I giorni futuri MAI aperti toccati dalla decisione sugli spuntini (regola dell'annulla, §6.2). */
  private async giorniPastiDaRifare(clientId: string, slots: Spuntino[], azione: 'togli' | 'rimetti') {
    const oggi = new Date();
    const giorni = (await this.prisma.menuDay.findMany({
      where: { clientId, viewedAt: null, date: { gt: oggi } } as never,
      select: { id: true, clientId: true, date: true, viewedAt: true, meals: true },
    })) as { id: string; clientId: string; date: Date; viewedAt: Date | null; meals: unknown }[];
    return giorniDaRifarePerPasti(giorni, slots, oggi, azione);
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

    const giorni = await this.giorniPastiDaRifare(stato.clienteId!, intento.slots, intento.azione);
    const righe = [
      intento.azione === 'togli'
        ? `Per **${cliente}** tolgo ${quali}: il motore non ${intento.slots.length === 1 ? 'lo' : 'li'} eroga più.`
        : `Per **${cliente}** rimetto ${quali}.`,
      // ⚠️ La frase sulle kcal è una promessa del motore, non un auspicio: gli slot esclusi escono
      // PRIMA della composizione (stessa strada del digiuno), quindi il target del giorno si
      // ridistribuisce sui pasti rimasti.
      'Le kcal della giornata non si perdono: si ridistribuiscono sui pasti rimasti.',
      giorni.length
        ? `Le giornate future non ancora aperte da rifare sono ${giorni.length}; quelle già lette restano come sono.`
        : 'Nessuna giornata già preparata da rifare.',
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

    // La regola dell'annulla (§6.2): si rifanno solo i giorni futuri MAI aperti toccati davvero.
    const giorni = await this.giorniPastiDaRifare(clienteId, slots, intento.azione);
    if (giorni.length) {
      await this.prisma.menuDay.deleteMany({ where: { id: { in: giorni.map((g) => g.id) } } });
    }

    const riga = (await this.registro.scrivi({
      nutrizionistaId,
      frase: stato.frase,
      azione: 'pasti_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: clienteId,
      soggettoNome: stato.clienteNome ?? null,
      dettaglio: { azione: intento.azione, slots, giorniRifatti: giorni.length },
    })) as { id: string };

    const riepilogo =
      (intento.azione === 'togli'
        ? `per ${cliente} ho tolto ${quali} — le kcal si ridistribuiscono sui pasti rimasti`
        : `per ${cliente} ho rimesso ${quali}`) +
      (giorni.length
        ? `. Ho rifatto ${giorni.length} ${giorni.length === 1 ? 'giornata' : 'giornate'} non ancora aperte.`
        : '. Nessuna giornata già preparata era da rifare.');
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
      testo: testi.anteprimaProteine(stato.clienteNome ?? 'lei', prima, dopo),
      esito: 'in_corso',
      stato: { ...stato, passo: 'conferma', proteinePrima: prima, proteineDopo: dopo },
    };
  }

  private async applicaProteine(nutrizionistaId: string, stato: StatoVera): Promise<EsitoVera> {
    const valore = stato.proteineDopo!;
    await this.prisma.clientProfile.update({
      where: { userId: stato.clienteId! },
      data: { proteinMinPct: valore } as never,
    });
    // La regola dell'annulla: si rifanno SOLO i giorni futuri che non ha ancora aperto.
    const daRifare = await this.registro.menuDaRifare(stato.clienteId!);
    if (daRifare.length) {
      await this.prisma.menuDay
        .deleteMany({ where: { clientId: stato.clienteId!, viewedAt: null, date: { gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) } } as never })
        .catch(() => undefined);
    }
    const riga = (await this.registro.scrivi({
      nutrizionistaId,
      frase: stato.frase,
      azione: 'variante_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: stato.clienteId ?? null,
      soggettoNome: stato.clienteNome ?? null,
      dettaglio: { proteine: { prima: stato.proteinePrima ?? null, dopo: valore, giorniRifatti: daRifare.length } },
    })) as { id: string };
    return {
      testo: testi.proteineFatte(stato.clienteNome ?? 'lei', valore, daRifare.length),
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
    const sim = await this.kcal
      .simulaKcal({ sub: nutrizionistaId, role: await this.ruolo(nutrizionistaId) }, stato.clienteId!, null, pct)
      .catch(() => ({ prima: null, dopo: null }));
    const prima = sim?.prima?.target ?? null;
    const dopo = sim?.dopo?.target ?? null;
    return {
      testo: testi.anteprimaKcal(stato.clienteNome ?? 'lei', pct, prima, dopo, giorni),
      esito: 'in_corso',
      stato: { ...stato, passo: 'conferma', giorniCorrezione: giorni, kcalPrima: prima, kcalDopo: dopo, tentativi: 0 },
    };
  }

  private async applicaCorrezioneKcal(nutrizionistaId: string, stato: StatoVera): Promise<EsitoVera> {
    const intento = stato.intento as IntentoCorrezioneKcal;
    const giorni = stato.giorniCorrezione ?? null;
    try {
      await this.kcal.impostaKcal(
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
        correzioneKcal: { pct: intento.pct, giorni, prima: stato.kcalPrima ?? null, dopo: stato.kcalDopo ?? null },
      },
    })) as { id: string };
    return {
      testo: testi.correzioneKcalFatta(stato.clienteNome ?? 'lei', intento.pct, stato.kcalDopo ?? null, giorni),
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

    const oggi = new Date();
    oggi.setUTCHours(0, 0, 0, 0);
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

  private async confermaOAnnulla(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    // Il ramo «non avevo capito»: qui `conferma` è solo il contenitore del contatore tentativi.
    if (!stato.intento) {
      const tentativi = (stato.tentativi ?? 1) + 1;
      const riprova = capisci(frase);
      if (riprova) return this.nuovoGiro(nutrizionistaId, frase);
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
    // Il cambio di dieta è per UNA cliente per costruzione: niente ambito «per tutte».
    if ((stato.intento as Intento).tipo === 'cambio_dieta') {
      return this.applicaCambioDieta(nutrizionistaId, stato);
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
    // Idempotente: ridettare la stessa regola non deve raddoppiare le righe nel profilo.
    const nuovi = termini.filter((t) => !attuali.some((a) => combaciaAlimento(a, t)));
    if (nuovi.length) {
      await this.prisma.clientProfile.update({
        where: { userId: clientId },
        data: { dislikedFoods: [...attuali, ...nuovi] } as never,
      });
    }
    return nuovi.length
      ? `Ho tolto dai suoi menu: ${nuovi.join(', ')}.`
      : 'Erano già tutti esclusi: non ho cambiato niente.';
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
    await registraSostituzione(this.prisma, {
      clientId: stato.clienteId!,
      tipo: 'ingrediente',
      from: intento.from,
      to: intento.to,
      recipeId: null,
      origine: 'manuale',
      stato: 'verificata',
      nota: `Dettata all'assistente: «${stato.frase}»`,
      creataDaId: nutrizionistaId,
    });
    return `Al posto di «${intento.from}» userò «${intento.to}».`;
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
