import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { toDateOnly } from '../common/date-only';
import { apriSegnalazione } from '../escalations/apri-segnalazione';
import { PrismaService } from '../prisma/prisma.service';
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
  riconosciConferma,
  riconosciMotivo,
  terminiCandidati,
  testoAllergene,
  testoAnnullato,
  testoChiediCibo,
  testoChiediMotivo,
  testoCiboNonTrovato,
  testoConferma,
  testoFatto,
  testoGiaFatto,
  testoMotivoNonCapito,
  testoNessunSostituto,
} from './sostituzione-chat';
import { sostitutoSicuro } from './sostituzioni-sicure';
import { classificaSpezia } from './spezie';

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
  data: string;
  slot: string;
  slotLabel: string;
  piatto: string;
  from: string;
  to: string;
  fromQty?: number;
  toQty?: number;
  unit?: string;
  motivo?: string;
  reason: string;
  stato: string;
  concordataIl?: string;
  grammaturaCorretta?: boolean;
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
      return { name: s.to, qty: s.toQty ?? i.qty, unit: s.unit ?? i.unit };
    });
    // Sostituzione che non trova la sua origine (piatto cambiato, catena di cambi): il
    // sostituto va comunque considerato presente, altrimenti resta invisibile.
    if (!sostituito && !out.some((i) => !!i?.name && combaciaAlimento(i.name, s.to))) {
      out.push({ name: s.to, qty: s.toQty, unit: s.unit });
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
    if (ANNULLA_SECCO.test(normalizza(testoCliente))) {
      return { testo: testoAnnullato(await this.nomeDi(clientId)), esito: 'annullata' };
    }
    if (stato.passo === 'cibo') return this.passoCibo(clientId, stato, testoCliente);
    if (stato.passo === 'motivo') return this.passoMotivo(clientId, stato, testoCliente);
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
    if (risposta === 'no') return { testo: testoAnnullato(await this.nomeDi(clientId)), esito: 'annullata' };
    if (risposta !== 'si') {
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

    const profilo = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { allergies: true, intolerances: true, dislikedFoods: true },
    });
    const allergeni = exclusionKeys((profilo?.allergies ?? []) as string[]);
    const altreEsclusioni = exclusionKeys([
      ...((profilo?.intolerances ?? []) as string[]),
      ...((profilo?.dislikedFoods ?? []) as string[]),
    ]);

    const candidati = await this.candidati(nomeIngrediente, trovato.termine, trovato.pasto.dietId);
    if (!candidati.length) {
      await this.passaAllaNutrizionista(
        clientId,
        `Cambio piatto in chat: nessun sostituto sicuro per «${nomeIngrediente}» (${etichettaSlot(trovato.pasto.pasto.slot)}: ${trovato.pasto.nome}).`,
      );
      return { testo: testoNessunSostituto(nomeIngrediente), inoltraA: 'nutritionist', esito: 'rifiutata' };
    }

    // Allergeni: se il sostituto contiene un allergene dichiarato, il cambio si rifiuta e
    // basta. Su questo non si media, e non è una questione di grammi.
    const ammessi: string[] = [];
    let scartatoPerAllergene = false;
    for (const c of candidati) {
      const testo = normalizza(c);
      if ([...allergeni].some((k) => k && testo.includes(k))) {
        scartatoPerAllergene = true;
        continue;
      }
      if ([...altreEsclusioni].some((k) => k && testo.includes(k))) continue;
      // Un sostituto che è una VARIANTE dello stesso cibo non è un sostituto: «yogurt greco» →
      // «yogurt senza lattosio» risolve un'intolleranza, non risolve niente a chi lo yogurt non
      // piace o non ce l'ha in casa. Vedi `condividonoAlimento`.
      if (condividonoAlimento(nomeIngrediente, c)) continue;
      ammessi.push(c);
    }
    if (!ammessi.length) {
      const motivoTesto = scartatoPerAllergene
        ? `Cambio piatto in chat: gli unici sostituti per «${nomeIngrediente}» toccano un allergene dichiarato. Serve una decisione clinica.`
        : `Cambio piatto in chat: nessun sostituto compatibile con le esclusioni della cliente per «${nomeIngrediente}».`;
      await this.passaAllaNutrizionista(clientId, motivoTesto);
      return {
        testo: scartatoPerAllergene ? testoAllergene(nomeIngrediente) : testoNessunSostituto(nomeIngrediente),
        inoltraA: 'nutritionist',
        esito: 'rifiutata',
      };
    }

    // Deterministico: a parità di idoneità vince l'ordine alfabetico, così due clienti con lo
    // stesso profilo ricevono la stessa proposta e il risultato è riproducibile nei test.
    ammessi.sort((a, b) => a.localeCompare(b));
    const sostituto = ammessi[0];

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
      unita: trovato.ingrediente.unit,
      grammaturaCorretta: corretta,
    };
    return {
      testo: testoChiediMotivo(proposta),
      stato: { passo: 'motivo', cibo: nomeIngrediente, proposta, tentativi: 0 },
      esito: 'in_corso',
    };
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
  ): Promise<string[]> {
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
    if (dalGruppo.length) return [...new Set(dalGruppo)];

    const sicuro = sostitutoSicuro(nomeIngrediente, termine);
    return sicuro ? [sicuro] : [];
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

    return {
      testo: testoFatto(proposta, motivo, await this.nomeDi(clientId)),
      esito: 'applicata',
      applicata: { giorni: giorniToccati, da: proposta.da, a: proposta.a, motivo: motivo.key, pasti: pastiToccati },
    };
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
        for (const s of pasto.substitutions ?? []) {
          if (s.origine !== 'chat') continue;
          out.push({
            data,
            slot: pasto.slot,
            slotLabel: etichettaSlot(pasto.slot),
            piatto: pasto.name,
            from: s.from,
            to: s.to,
            fromQty: s.fromQty,
            toQty: s.toQty,
            unit: s.unit,
            motivo: s.motivo,
            reason: s.reason,
            stato: s.stato ?? 'da_verificare',
            concordataIl: s.concordataIl,
            grammaturaCorretta: s.grammaturaCorretta,
          });
        }
      }
    }
    return out;
  }
}
