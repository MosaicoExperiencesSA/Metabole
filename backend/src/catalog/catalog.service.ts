import { campiDaScrivere, cosaSuccedeAllaVerifica } from './verifica-della-ricetta';
import { laConfermaDecade } from './conferma-allergeni-decade';
import { puoStareNelloSlot } from '../common/slot-pasto';
import { famigliaInChiusura } from './appartenenza-panieri';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EU_ALLERGEN_CODES, suggestAllergens } from './allergens';
import { classificaColazione, nomiIngredienti, tagsDopoScelta, tipoConfermato, type TipoColazione } from '../vera/colazioni';
import { METODI_COTTURA } from '../common/metodi-cottura';
import { ingredientiScalati, pastoDelGiorno, porzioneDelGiorno } from '../menu/porzione-del-giorno';
import { sostituzioniDaSapere } from '../menu/sostituzioni-nei-passi';
import { giornateComplete, pastiAttesi } from './giornate-complete';
import { settimaneDiTutte, utilizzoDelleRicette, type UsoInDieta } from './utilizzo-ricette';
import { STAGE_DA_CLIENTE } from '../commerce/sospensione-in-pipeline';
import {
  GIORNI_PER_SETTIMANA, conRicettaNelloSlot, giorniDi, giornoNellaSettimana, pastiDi, senzaRicetta,
  settimanaDi,
} from './collega-ricetta';
import {
  CreateDietDto,
  CreateRecipeDto,
  SetDayTemplatesDto,
  UpdateDietDto,
  CAMPI_NON_TESTO,
  UpdateDietProductDto,
  UpdateFamilyProductDto,
  UpdateRecipeDto,
} from './dto/catalog.dto';

/**
 * Il client DENTRO una transazione: `Prisma.TransactionClient`, non `PrismaService`.
 * `PrismaService` estende `PrismaClient` e ha in più `$transaction`, `$connect`, gli hook di Nest:
 * annotare così il parametro fa fallire la scelta dell'overload, TypeScript ripiega su quello ad
 * array e il risultato diventa `any[]` — ogni campo letto dopo è un errore.
 *
 * ⚠️ Vale per TUTTE le transazioni del file. L'11/8 la correzione era stata applicata a una sola
 * delle due, e la seconda ha rimesso la CI rossa da sola.
 */
type PrismaTx = Prisma.TransactionClient;

/**
 * Da dove si sta guardando la scheda della ricetta: il giorno e il pasto, non il fattore.
 *
 * ⚠️ `clientId` lo mette il controller da `user.sub`, **mai** il chiamante: la porzione che si legge
 * è quella della giornata di chi guarda.
 */
export interface ContestoScheda {
  clientId?: string;
  /** `YYYY-MM-DD`. Formato sbagliato = si tace e si mostra il catalogo, non un errore. */
  giorno?: string;
  slot?: string;
}

const SOLO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Catalogo diete e ricette (spec sez. 4/5/6):
 * - il nutrizionista propone (draft → in_review);
 * - SOLO il capo approva o rifiuta, e MAI una dieta di cui è autore;
 * - il motore eroga solo diete approved.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigParamsService,
    private readonly notifications: NotificationsService,
  ) {}

  private readonly logger = new Logger(CatalogService.name);

  /** Scheda Staff dell'utente corrente (richiesta per operare sul catalogo). */
  async staffOf(userId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { userId } });
    if (!staff) throw new ForbiddenException('Nessuna scheda staff associata all\'utente');
    return staff;
  }

  // ---------- Diete ----------

  async listDiets(filter: { status?: string }) {
    return this.prisma.diet.findMany({
      where: filter.status ? { status: filter.status as never } : {},
      orderBy: { updatedAt: 'desc' },
      include: {
        author: { select: { id: true, displayName: true } },
        approvedBy: { select: { id: true, displayName: true } },
        _count: { select: { dayTemplates: true } },
      },
    });
  }

  /**
   * ⛔ **LE RIGHE DELLA PAGINA «DESCRIZIONI DIETE», e solo quelle.**
   *
   * La pagina chiamava `listDiets`, cioè si scaricava **tutto il catalogo** — giornate, regole,
   * autore, stato — per mostrarne cinque campi di testo. ⚠️ Non è (solo) una questione di byte: una
   * rotta che rende tutto **dà** tutto, e allora tanto valeva lasciarle la chiave del catalogo. La
   * chiave propria e questa `select` sono la stessa decisione vista da due parti.
   *
   * ⚠️ **`status` serve e resta**: `raggruppaFamiglie` non conta le varianti archiviate, che
   * `archiveDiet` marca `rejected` senza uno stato suo — toglierlo qui farebbe tornare rosse per
   * sempre le famiglie con varianti archiviate. E `clientVisible` serve a distinguere «accesa» da
   * «bozza spuntata».
   */
  async listDescrizioniDiete() {
    return this.prisma.diet.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, name: true, style: true, regime: true, objective: true,
        mealsPerDay: true, fasting: true, status: true,
        clientName: true, clientDescription: true, highlights: true,
        seasonalTag: true, clientVisible: true,
      },
    });
  }

  /** Catalogo pubblicato: solo diete approvate. */
  async catalog() {
    return this.listDiets({ status: 'approved' });
  }

  /**
   * Percorsi per il SITO pubblico (data-paths-endpoint). Nessuna autenticazione.
   * Ritorna le diete del CATALOGO (status=approved, validate dal nutrizionista),
   * una card per dieta, nel formato che il sito si aspetta: name (preferisce
   * clientName), description (+ alias `desc` usato dal carosello), highlights, tag.
   * Il contatore "percorsi gestiti" della home (publicStats.methods) conta queste.
   * Data-driven: aggiungere/approvare una dieta NON richiede deploy del sito.
   */
  async publicPaths() {
    const [diets, presets] = await Promise.all([
      this.prisma.diet.findMany({
        where: { status: 'approved', siteVisible: true } as never,
        orderBy: { createdAt: 'asc' },
      }),
      // Note cliniche per stile dai preset regole (adottati prima dei suggeriti).
      this.prisma.rulePreset.findMany({
        orderBy: [{ suggested: 'asc' }, { sortOrder: 'asc' }] as never,
        select: { style: true, clinicalNotes: true } as never,
      }),
    ]);
    const notesByStyle = new Map<string, string>();
    for (const p of presets as unknown as Array<Record<string, unknown>>) {
      const st = String(p.style);
      const notes = (p.clinicalNotes as string) ?? null;
      if (notes && !notesByStyle.has(st)) notesByStyle.set(st, notes);
    }
    type SitePath = {
      style: string; name: string; clientName: string | null;
      description: string | null; desc: string | null; clinicalNotes: string | null;
      highlights: string[]; objective: string; seasonalTag: string | null;
    };
    // UNA card per FAMIGLIA (stesso nome+stile): le varianti regime × obiettivo sono
    // dettagli interni del motore, sul sito il percorso è uno. Tra le varianti si
    // tengono i campi compilati migliori (clientName/descrizione/highlights).
    const byFamily = new Map<string, SitePath>();
    for (const d of diets as unknown as Array<Record<string, unknown>>) {
      const style = String(d.style);
      const famKey = `${String(d.name)}\u0000${style}`;
      const clientName = (d.clientName as string) ?? null;
      const description = (d.clientDescription as string) ?? null;
      const clinicalNotes = notesByStyle.get(style) ?? null;
      const highlights = Array.isArray(d.highlights) ? (d.highlights as string[]) : [];
      const existing = byFamily.get(famKey);
      if (!existing) {
        byFamily.set(famKey, {
          style,
          name: clientName ?? String(d.name),
          clientName,
          description,
          // alias letto dal carosello del sito: sotto il nome, in piccolo, mostra
          // la descrizione cliente se compilata, altrimenti le note cliniche del preset.
          desc: description ?? clinicalNotes,
          clinicalNotes,
          highlights,
          objective: (d.objective as string) ?? 'dimagrimento',
          seasonalTag: (d.seasonalTag as string) ?? null,
        });
      } else {
        // Completa i buchi con i dati delle altre varianti della stessa famiglia.
        if (!existing.clientName && clientName) { existing.clientName = clientName; existing.name = clientName; }
        if (!existing.description && description) { existing.description = description; existing.desc = description; }
        if (!existing.highlights.length && highlights.length) existing.highlights = highlights;
        if (!existing.seasonalTag && d.seasonalTag) existing.seasonalTag = d.seasonalTag as string;
      }
    }
    return [...byFamily.values()];
  }

  /**
   * Numeri per il SITO pubblico (data-stats-endpoint): { years, clients, reached, methods }.
   * I contatori partono dalla BASE STORICA di Mosaico Experiences SA (config_param, mai
   * hardcodata: `stats_clients_base`, `stats_reached_base`, modificabili dal backoffice)
   * e crescono con l'attività reale — +1 cliente per abbonamento attivato, +1 raggiunto
   * per lead nel CRM. Rif: Metabole_Handoff_Contatori_Stats.md.
   *  - years   → anni di attività (config `site_stats_years`; omesso se 0/non impostato)
   *  - clients → `stats_clients_base` + n° abbonamenti attivati (startDate valorizzata)
   *  - reached → `stats_reached_base` + n° lead nel CRM
   *  - methods → n° diete APPROVATE nel catalogo Diete, coerente con /public/paths
   */
  async publicStats() {
    // Persone RAGGIUNTE = tutte le schede CRM (lead + clienti + clienti storici).
    // Clienti SEGUITI = clienti (acquisto con Metabole) + clienti storici (pagamento pregresso,
    //   historicalPaidCents > 0). L'OR deduplica in automatico.
    // ⚠️ «Cliente» non è più la sola chiave `paid`: dal 25/8 c'è anche «In sospensione», dove le
    //   schede sostano mentre i menu sono fermi. Con il confronto vecchio, il numero pubblico delle
    //   clienti seguite CALAVA a ogni vacanza (`commerce/sospensione-in-pipeline.ts`).
    const [paths, realReached, realClients] = await Promise.all([
      this.publicPaths(),
      this.prisma.crmRecord.count(),
      this.prisma.crmRecord.count({
        where: { OR: [{ stage: { in: STAGE_DA_CLIENTE } }, { historicalPaidCents: { gt: 0 } }] },
      }),
    ]);

    const [years, clientsBase, reachedBase] = await Promise.all([
      this.config.getNumber('site_stats_years', 0),
      this.config.getNumber('stats_clients_base', 0),
      this.config.getNumber('stats_reached_base', 0),
    ]);
    const stats: Record<string, number> = {
      clients: clientsBase + realClients,
      reached: reachedBase + realReached,
      methods: paths.length,
    };
    if (years > 0) stats.years = years; // mostrato solo se configurato
    return stats;
  }

  async getDiet(id: string) {
    const diet = await this.prisma.diet.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, displayName: true } },
        approvedBy: { select: { id: true, displayName: true } },
        dayTemplates: { orderBy: [{ level: 'asc' }, { dayIndex: 'asc' }] },
      },
    });
    if (!diet) throw new NotFoundException('Dieta non trovata');
    return diet;
  }

  async createDiet(userId: string, dto: CreateDietDto) {
    const staff = await this.staffOf(userId);
    const diet = await this.prisma.diet.create({
      data: {
        name: dto.name,
        regime: dto.regime as never,
        style: dto.style as never,
        mealsPerDay: dto.mealsPerDay,
        fasting: dto.fasting ?? false,
        levels: (dto.levels ?? [{ level: 1 }]) as never,
        options: (dto.options ?? {}) as never,
        authorId: staff.id,
        status: 'draft',
        clientName: dto.clientName ?? null,
        clientDescription: dto.clientDescription ?? null,
        highlights: (dto.highlights ?? []) as never,
        seasonalTag: dto.seasonalTag ?? null,
        objective: dto.objective ?? 'dimagrimento',
        clientVisible: dto.clientVisible ?? false,
      } as never,
    });
    await this.audit.log({
      action: 'catalog.diet.create',
      actorId: userId,
      entityType: 'diet',
      entityId: diet.id,
    });
    return diet;
  }

  /** Elimina una dieta e i suoi giorni/regole. Bloccata se già usata in menu erogati. */
  async deleteDiet(userId: string, id: string) {
    const diet = await this.prisma.diet.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!diet) throw new NotFoundException('Dieta non trovata');
    const usedInMenus = await this.prisma.menuDay.count({ where: { dietId: id } });
    if (usedInMenus > 0) {
      throw new BadRequestException(`Impossibile eliminare "${diet.name}": è usata in ${usedInMenus} menu già erogati.`);
    }
    await this.prisma.$transaction([
      this.prisma.dietDayTemplate.deleteMany({ where: { dietId: id } }),
      this.prisma.productRule.deleteMany({ where: { dietId: id } }),
      this.prisma.diet.delete({ where: { id } }),
    ]);
    await this.audit.log({ action: 'catalog.diet.delete', actorId: userId, entityType: 'diet', entityId: id, metadata: { name: diet.name } });
    return { ok: true };
  }

  /** Rinomina la dieta (solo il nome). Consentito anche su diete approvate:
   *  non tocca i menu né lo stato, cambia solo l'etichetta. */
  async renameDiet(userId: string, id: string, name: string) {
    const clean = name.trim().slice(0, 120);
    if (clean.length < 2) throw new BadRequestException('Nome troppo corto.');
    await this.getDiet(id); // 404 se non esiste
    const updated = await this.prisma.diet.update({ where: { id }, data: { name: clean } });
    await this.audit.log({ action: 'catalog.diet.rename', actorId: userId, entityType: 'diet', entityId: id, metadata: { name: clean } });
    return updated;
  }

  async updateDiet(userId: string, id: string, dto: UpdateDietDto) {
    const diet = await this.getDiet(id);
    if (diet.status === 'approved') {
      throw new BadRequestException(
        'Una dieta approvata non si modifica: crea una nuova versione (bozza).',
      );
    }
    const updated = await this.prisma.diet.update({
      where: { id },
      data: {
        ...(dto as Record<string, unknown>),
        status: 'draft', // ogni modifica riporta in bozza
        approvedById: null,
        approvedAt: null,
      } as never,
    });
    await this.audit.log({
      action: 'catalog.diet.update',
      actorId: userId,
      entityType: 'diet',
      entityId: id,
    });
    return updated;
  }

  /** Aggiorna SOLO la scheda cliente (schermo 16). Consentito anche su diete approvate:
   *  non tocca i menu, solo come il prodotto viene mostrato/scelto dalla cliente. */
  async updateDietProduct(userId: string, id: string, dto: UpdateDietProductDto, ruolo?: string | null) {
    await this.getDiet(id); // 404 se non esiste
    /**
     * ⛔ **COSA C'ERA PRIMA, o il testo vecchio non torna più** (22/8).
     *
     * `catalog.diet.product.update` si registrava **senza metadata**: sapevamo che qualcuno aveva
     * toccato la scheda cliente di una dieta, non **cosa** aveva toccato né cosa c'era scritto
     * prima. Su un campo che legge la cliente — e che si sovrascrive con una `textarea` — vuol dire
     * che una descrizione cancellata per sbaglio è persa: nessuno la può rimettere perché nessuno
     * sa più com'era.
     *
     * ⚠️ Si salvano **solo i campi che questo PATCH tocca**, col valore precedente: un `metadata`
     * che porta l'intera riga sarebbe un doppione della tabella dentro il registro.
     */
    const prima = (await this.prisma.diet.findUnique({
      where: { id },
      select: { clientName: true, clientDescription: true, highlights: true, seasonalTag: true, objective: true, clientVisible: true, siteVisible: true, recommended: true },
    })) as Record<string, unknown> | null;
    /**
     * ⛔ **LA GUARDIA GUARDA COSA CAMBIA, non cosa è stato mandato** (corretto in revisione, 22/8, e
     * la prima stesura non correggeva il difetto: lo spostava).
     *
     * La modale «Scheda cliente» manda **sempre** tutti i suoi campi, compresi `clientVisible` e
     * `recommended`, anche quando la nutrizionista ha toccato solo la descrizione. Una guardia su
     * «il campo è presente» li vedeva e rifiutava: lei correggeva un refuso e leggeva *«la
     * visibilità la decide il capo… il testo lo puoi scrivere tu»* — un messaggio che le dice che
     * può fare esattamente la cosa che le è appena stata negata. Peggio del 403 generico di prima,
     * perché quello almeno non mentiva.
     */
    this.soloIlCapoAccendeLaVetrina(ruolo, dto as Record<string, unknown>, prima ?? {});
    // Gate R8: si può rendere visibile ai clienti solo un prodotto "sicuro".
    if ((dto as { clientVisible?: boolean }).clientVisible === true && prima?.clientVisible !== true) {
      await this.assertActivatable(id);
    }
    const campi = Object.keys(dto as Record<string, unknown>);
    const updated = await this.prisma.diet.update({
      where: { id },
      data: { ...(dto as Record<string, unknown>) } as never,
    });
    await this.audit.log({
      action: 'catalog.diet.product.update',
      actorId: userId,
      entityType: 'diet',
      entityId: id,
      metadata: { campi, prima: Object.fromEntries(campi.map((k) => [k, prima?.[k] ?? null])) },
    });
    return updated;
  }

  /**
   * ⛔ **CHI SCRIVE COSA: il testo è della nutrizionista, la vetrina del capo** (deciso da Simone il
   * 22/8).
   *
   * Fino a oggi questa rotta era `@Roles('head_nutritionist')` intera, e il pulsante «Scheda
   * cliente» in pagina Diete si mostrava **anche alla nutrizionista semplice**: lei apriva, scriveva
   * la descrizione, premeva Salva e prendeva **403**. Un pulsante che si vede e non funziona è
   * peggio di un pulsante che non c'è — chi lo preme non impara che non può, impara che il sistema
   * si rompe.
   *
   * ⚠️ La guardia sta **qui e non nel decoratore** perché non è per ruolo, è per **campo**: la
   * stessa rotta accetta il testo da tutte e due e la vetrina solo dal capo. Un secondo endpoint
   * avrebbe voluto dire due strade per scrivere la stessa riga, con due controlli da tenere allineati.
   *
   * ⚠️ E si dice **quale** campo ha fermato la richiesta: «non hai il permesso» su una form con sei
   * campi manda a indovinare.
   */
  private soloIlCapoAccendeLaVetrina(
    ruolo: string | null | undefined,
    dto: Record<string, unknown>,
    prima: Record<string, unknown>,
  ) {
    if (ruolo === 'head_nutritionist') return;
    /**
     * ⚠️ **Solo i campi che CAMBIANO davvero.** Rimandare indietro lo stesso valore che c'era non è
     * «accendere la vetrina»: è una form che si salva intera. Vedi la nota in `updateDietProduct`.
     */
    const chiesti = CAMPI_NON_TESTO.filter((c) => dto[c] !== undefined && dto[c] !== prima[c]);
    if (!chiesti.length) return;
    throw new ForbiddenException(
      `Questi campi li decide il capo nutrizionista: ${chiesti.join(', ')}. `
      + 'Il testo della scheda cliente — nome, descrizione, punti chiave, tag — lo puoi scrivere tu.',
    );
  }

  /**
   * ⛔ **LA SCHEDA CLIENTE SU TUTTA LA FAMIGLIA, in una transazione.**
   *
   * Vedi `UpdateFamilyProductDto` per il perché: una famiglia è fino a 18 varianti, il profilo della
   * cliente legge **la sua** — e quando manca ripiega sulla descrizione dell'ultimo menu
   * consegnato, cioè le mostra la spiegazione di un'altra dieta. Una tabella per variante produce
   * diciassette righe vuote e una persona convinta di aver finito.
   *
   * ⚠️ **Transazione, non un giro di `PATCH` dal browser.** Diciotto chiamate separate falliscono a
   * metà e lasciano la famiglia con due testi diversi — ed è esattamente quello che succedeva a
   * «pubblica la famiglia» in `GestioneDieta.tsx`. Qui o si scrivono tutte o non si scrive niente.
   *
   * ⚠️ **Anche sulle diete approvate**, come la rotta per id: il testo della scheda non tocca i menu,
   * e una dieta pubblicata deve poter correggere un refuso senza tornare in bozza.
   *
   * ⛔ Se la famiglia non esiste si dice, invece di rispondere «fatto» avendo scritto su zero righe:
   * *«non lo so» deve costare meno di «ho indovinato»*.
   */
  async updateFamilyProduct(userId: string, dto: UpdateFamilyProductDto) {
    const { famiglia, stile } = dto;
    /**
     * ⛔ **I campi si PRENDONO, non si prendono «tutto il resto»** (trovato dal test, 22/8). La
     * prima stesura faceva `const { famiglia, stile, ...testo } = dto` e scriveva `testo`: con quel
     * codice un `siteVisible` arrivato nel corpo finiva **dritto nella `update`**.
     *
     * ⚠️ In produzione lo fermerebbe la `whitelist` della `ValidationPipe` — ma appoggiare una
     * regola di permessi a un pezzo che sta in un altro file è la definizione di regola che si
     * rompe da sola: basta che qualcuno chiami questa funzione da un cron, da uno script o da un
     * altro service e la porta non c'è più. L'elenco dei campi che questa rotta scrive è qui.
     */
    const testo: Record<string, unknown> = {};
    for (const c of ['clientName', 'clientDescription', 'seasonalTag'] as const) {
      if (dto[c] !== undefined) testo[c] = dto[c];
    }
    const campi = Object.keys(testo);
    if (!campi.length) throw new BadRequestException('Non hai cambiato niente.');

    /**
     * ⛔ **Le varianti RIFIUTATE/archiviate non si toccano** (revisione, 22/8). `archiveDiet` non ha
     * uno stato suo: archivia mettendo `status: 'rejected'`. Scriverci sopra vorrebbe dire spendere
     * il lavoro di una persona su righe che nessuna cliente raggiunge — e, dall'altra parte, farle
     * contare come «scoperte» nella tabella, con un rosso che non si spegne mai. *Un avviso che
     * compare sempre non è un avviso.*
     *
     * ⚠️ `orderBy` non è estetica: senza, la riga di registro sotto si aggancerebbe a una variante
     * scelta da Postgres a caso, e non sarebbe la stessa fra due esecuzioni.
     */
    const varianti = (await this.prisma.diet.findMany({
      where: { name: famiglia, style: stile, status: { not: 'rejected' } } as never,
      orderBy: { createdAt: 'asc' },
      select: { id: true, clientName: true, clientDescription: true, highlights: true, seasonalTag: true },
    })) as { id: string }[];
    if (!varianti.length) {
      throw new NotFoundException(
        `Nessuna dieta «${famiglia}» con stile «${stile}» da scrivere: o è stata rinominata, o sono tutte archiviate.`,
      );
    }

    await this.prisma.$transaction(
      varianti.map((v) => this.prisma.diet.update({ where: { id: v.id }, data: testo as never })),
    );
    /**
     * ⛔ **UNA RIGA DI REGISTRO PER VARIANTE, non una per famiglia** (revisione, 22/8).
     *
     * La prima stesura ne scriveva **una sola**, agganciata a `varianti[0].id`: chi apre il log
     * filtrando sulla dieta #7 — quella su cui è arrivata la segnalazione — non trovava niente, e
     * diciotto diete risultavano cambiate da nessuno. *Un dato che agisce e non si vede.*
     *
     * ⚠️ **L'audit sta FUORI dalla transazione, ed è un ripiego dichiarato**: `AuditService.log`
     * assorbe i propri errori di proposito (una riga di registro che non passa non deve far fallire
     * un salvataggio clinico). Quindi le scritture possono riuscire e il «prima» perdersi. È il
     * verso giusto in cui sbagliare, ma è un best-effort e va detto invece che promesso.
     *
     * ✅ **DICIOTTO ANDATE AL DATABASE SONO DIVENTATE UNA** (3/9). Erano un `await` in ciclo: su una
     * famiglia larga, diciotto round-trip in fila **dopo** che la transazione ha già chiuso —
     * diciotto finestre in cui il processo può morire e lasciare il registro a metà, invece di una.
     * `logMany` fa una `createMany` sola, e il suo ripiego riga-per-riga scatta **solo** se quella
     * fallisce: la voce `descrizioni-diete-cosa-resta` diceva *«è il verso in cui guardare»*, ed era
     * giusto.
     *
     * ⛔ **Resta best-effort, e la frase sopra resta vera**: `logMany` assorbe i propri errori come
     * `log`. Quello che cambia è la **finestra**, non la garanzia — e prometterla sarebbe peggio
     * che non averla.
     */
    await this.audit.logMany(varianti.map((v) => ({
      action: 'catalog.diet.product.famiglia',
      actorId: userId,
      entityType: 'diet',
      entityId: v.id,
      metadata: { famiglia, stile, campi, varianti: varianti.length, prima: v },
    })));
    return { famiglia, stile, aggiornate: varianti.length, campi };
  }

  /**
   * Gate di sicurezza R8: un prodotto è attivabile ai clienti (clientVisible=true) solo se
   * TUTTE le ricette dei suoi menu hanno gli allergeni CONFERMATI dal nutrizionista e c'è
   * almeno un gruppo di equivalenza approvato (materia prima delle sostituzioni).
   */
  private async assertActivatable(dietId: string) {
    const templates = await this.prisma.dietDayTemplate.findMany({ where: { dietId } });
    const recipeIds = [
      ...new Set(
        templates.flatMap((t: { meals?: unknown }) =>
          Array.isArray(t.meals)
            ? (t.meals as Array<{ recipeId?: string }>).map((m) => m.recipeId).filter((x): x is string => !!x)
            : [],
        ),
      ),
    ];
    if (recipeIds.length > 0) {
      const notReviewed = await this.prisma.recipe.count({
        where: { id: { in: recipeIds }, allergensReviewed: false } as never,
      });
      if (notReviewed > 0) {
        throw new BadRequestException(
          `Prodotto non attivabile: ${notReviewed} ricette non hanno ancora gli allergeni confermati dal nutrizionista.`,
        );
      }
    }
    const approvedGroups = await this.prisma.equivalenceGroup.count({ where: { status: 'approved' } as never });
    if (approvedGroups === 0) {
      throw new BadRequestException('Prodotto non attivabile: nessun gruppo di equivalenza approvato.');
    }

    /**
     * NEL MENU CI DEV'ESSERE DA MANGIARE. Sembra ovvio e non lo era.
     *
     * Il gate controllava gli allergeni e i gruppi di equivalenza — cose serie — e non
     * controllava che le giornate avessero tutti i pasti. Il 9/8 è saltata fuori una dieta
     * pubblicata e **visibile alle clienti** con ventotto giornate, cinque colazioni, **zero
     * pranzi e zero cene**: una persona che apre l'app all'ora di pranzo e non trova niente.
     * Nessun errore da nessuna parte, perché nessuno guardava.
     */
    const diet = (await this.prisma.diet.findUnique({
      where: { id: dietId },
      select: { mealsPerDay: true, fasting: true },
    })) as { mealsPerDay: number; fasting: boolean | null } | null;
    if (diet) {
      // La regola sta in `giornate-complete.ts` (11/8), perché la usa anche l'EROGAZIONE — che
      // finora non se l'era mai chiesta. Qui si controlla una volta sola, quando qualcuno rende la
      // dieta visibile; ma una dieta può diventare incompleta DOPO, per mano del generatore o di
      // uno script, e un controllo che si fa una volta sola non se ne accorge per costruzione.
      const { monche } = giornateComplete(templates as { meals?: unknown }[], diet);
      if (monche > 0) {
        throw new BadRequestException(
          `Prodotto non attivabile: ${monche} giornate su ${templates.length} non hanno tutti i pasti previsti. ` +
          'Completa le settimane prima di renderla visibile alle clienti.',
        );
      }
    }
  }

  /**
   * Alla pubblicazione/approvazione rende la dieta visibile alle clienti (schermo 16),
   * ma SOLO se supera il gate di sicurezza R8. Non solleva: se il gate fallisce lascia
   * la dieta nascosta e restituisce il motivo, così l'approvazione non viene bloccata.
   */
  private async tryMakeClientVisible(id: string): Promise<{ clientVisible: boolean; visibilityWarning?: string }> {
    try {
      await this.assertActivatable(id);
    } catch (e) {
      return {
        clientVisible: false,
        visibilityWarning: e instanceof Error ? e.message : 'Dieta non ancora attivabile ai clienti.',
      };
    }
    await this.prisma.diet.update({ where: { id }, data: { clientVisible: true } as never });
    return { clientVisible: true };
  }

  /** Elimina una ricetta e le sue valutazioni/pesi appresi. */
  async deleteRecipe(userId: string, id: string) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!recipe) throw new NotFoundException('Ricetta non trovata');
    await this.prisma.$transaction([
      this.prisma.recipeRating.deleteMany({ where: { recipeId: id } }),
      this.prisma.menuWeight.deleteMany({ where: { recipeId: id } }),
      this.prisma.recipe.delete({ where: { id } }),
    ]);
    await this.audit.log({ action: 'catalog.recipe.delete', actorId: userId, entityType: 'recipe', entityId: id, metadata: { name: recipe.name } });
    return { ok: true };
  }

  // ---------- Allergeni ricette (R8) ----------

  /**
   * LA RICETTA COM'È, BOZZA COMPRESA — per chi ne rivede gli allergeni.
   *
   * ⚠️ `getRecipe` risponde **404 su una ricetta non attiva**, ed è giusto: la usa anche la cliente
   * che apre una scheda dall'app, e una ricetta archiviata non deve comparirle. Ma la revisione
   * degli allergeni lavora **esattamente** sulle bozze — nascono `active: false` e ci restano
   * finché non sono confermate — quindi passando di lì il riquadro «Rivedi» rispondeva 404 sia in
   * lettura sia in scrittura. Terzo strato dello stesso difetto del 19/8: la pagina non le
   * elencava, il server non le mandava, e comunque non si sarebbero potute confermare.
   */
  private async ricettaDaRivedere(id: string) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id } });
    if (!recipe) throw new NotFoundException('Ricetta non trovata');
    return recipe as unknown as { id: string; name: string; ingredients: unknown; allergens?: string[]; allergensReviewed?: boolean; active?: boolean };
  }

  /** Pre-tag assistito: suggerisce gli allergeni dagli ingredienti + stato attuale. */
  async recipeAllergenSuggestions(id: string) {
    const recipe = await this.ricettaDaRivedere(id);
    return {
      recipeId: recipe.id,
      name: recipe.name,
      current: (recipe as { allergens?: string[] }).allergens ?? [],
      reviewed: (recipe as { allergensReviewed?: boolean }).allergensReviewed ?? false,
      suggestions: suggestAllergens(recipe.ingredients),
    };
  }

  /**
   * Il nutrizionista CONFERMA gli allergeni della ricetta (→ reviewed=true) **e la fa entrare in
   * catalogo** (19/8, decisione di Simone).
   *
   * ⚠️ Prima la conferma non attivava niente: le ricette generate nascono `active: false`
   * («BOZZA: non entra nel motore finché non approvata»), quindi anche confermandole tutte
   * restavano ferme, e nessuna schermata diceva quante fossero in quello stato intermedio. Un
   * secondo cancello che non ha una porta non è un cancello, è un magazzino.
   *
   * ⚠️ **Attiva solo la ricetta MAI confermata prima.** Una ricetta archiviata a mano è archiviata
   * di proposito, e correggerle gli allergeni non deve resuscitarla: la conferma passata è quello
   * che distingue «bozza appena nata» da «tolta dal catalogo da qualcuno».
   */
  async setRecipeAllergens(userId: string, id: string, allergens: string[]) {
    const prima = await this.ricettaDaRivedere(id);
    const clean = [...new Set(allergens)].filter((a) => EU_ALLERGEN_CODES.includes(a));
    const attiva = prima.allergensReviewed !== true && prima.active !== true;
    const updated = await this.prisma.recipe.update({
      where: { id },
      data: { allergens: clean, allergensReviewed: true, ...(attiva ? { active: true } : {}) } as never,
    });
    await this.audit.log({
      action: 'catalog.recipe.allergens.set',
      actorId: userId,
      entityType: 'recipe',
      entityId: id,
      // ⚠️ `attivata` si scrive: «la ricetta è entrata in catalogo» è una notizia diversa da
      // «qualcuno ha spuntato il glutine», e in un registro devono restare distinte.
      metadata: { count: clean.length, attivata: attiva },
    });
    return updated;
  }

  /**
   * CONFERMA IN BLOCCO — la decisione di Simone del 19/8, e la ragione per cui non è un lusso.
   *
   * Il generatore scrive ~4600 ricette a settimana. Confermarle una per una, aprendo e chiudendo un
   * riquadro, è una diciannovina d'ore di lavoro per svuotare un mucchio che nel frattempo si è
   * riempito di nuovo: non è una pagina lenta, è una pagina che non si può usare.
   *
   * ⚠️ **Si confermano gli allergeni SUGGERITI dagli ingredienti**, non un elenco vuoto: qui il
   * nutrizionista sta dicendo «di queste mi fido del riconoscitore», e scrivere `[]` vorrebbe dire
   * dichiarare che quelle ricette non contengono allergeni — cioè il contrario, sulla cosa dove
   * sbagliare fa più male.
   *
   * ⚠️ E si ricalcolano **adesso** dagli ingredienti veri, non si copiano quelli scritti alla
   * nascita: se il riconoscitore è migliorato da allora, la conferma deve valere sulla versione di
   * oggi. Un blocco che conferma una fotografia vecchia conferma il vecchio errore.
   */
  async confermaAllergeniInBlocco(userId: string, ids: string[]): Promise<{ confermate: number; attivate: number; saltate: number }> {
    const unici = [...new Set((ids ?? []).filter((i) => typeof i === 'string' && i))];
    if (!unici.length) return { confermate: 0, attivate: 0, saltate: 0 };
    const ricette = (await this.prisma.recipe.findMany({
      where: { id: { in: unici } } as never,
      select: { id: true, name: true, ingredients: true, allergensReviewed: true, active: true } as never,
    })) as { id: string; name: string; ingredients: unknown; allergensReviewed: boolean; active: boolean }[];

    let confermate = 0;
    let attivate = 0;
    for (const r of ricette) {
      const allergeni = suggestAllergens(r.ingredients).map((x) => x.allergen).filter((a) => EU_ALLERGEN_CODES.includes(a));
      const attiva = r.allergensReviewed !== true && r.active !== true;
      await this.prisma.recipe.update({
        where: { id: r.id },
        data: { allergens: allergeni, allergensReviewed: true, ...(attiva ? { active: true } : {}) } as never,
      });
      confermate += 1;
      if (attiva) attivate += 1;
    }
    /**
     * ⚠️ **Una riga sola per il blocco, non una per ricetta.** Quattromila righe di registro per un
     * clic renderebbero illeggibile il registro proprio nel giorno in cui serve rileggerlo — e la
     * cosa da sapere è «chi ha confermato quante, e quando», non l'elenco.
     */
    await this.audit.log({
      action: 'catalog.recipe.allergens.bulk',
      actorId: userId,
      entityType: 'recipe',
      entityId: ricette[0]?.id ?? 'nessuna',
      metadata: { chieste: unici.length, confermate, attivate, saltate: unici.length - confermate },
    });
    return { confermate, attivate, saltate: unici.length - confermate };
  }

  // ---------- Colazioni dolci e salate (Decisioni 13/8 §12) ----------

  /**
   * L'elenco per chi conferma: ogni colazione ATTIVA con lo stato confermato (il tag) e la
   * proposta del sistema, calcolata al volo. ⚠️ Non passa da `getRecipe`, che i tag li toglie
   * apposta dalle risposte: qui i tag non escono comunque — escono `confermato` e `proposta`.
   */
  async elencoColazioni() {
    const ricette = await this.prisma.recipe.findMany({
      where: { mealSlot: 'breakfast', active: true },
      select: { id: true, name: true, kcal: true, tags: true, ingredients: true },
      orderBy: { name: 'asc' },
    });
    const items = ricette.map((r) => {
      const tags = (r as { tags?: string[] }).tags ?? [];
      const { proposta, indizi } = classificaColazione(r.name, nomiIngredienti(r.ingredients));
      return { id: r.id, name: r.name, kcal: r.kcal, confermato: tipoConfermato(tags), proposta, indizi };
    });
    return {
      items,
      conta: {
        totale: items.length,
        confermateSalato: items.filter((i) => i.confermato === 'salato').length,
        confermateDolce: items.filter((i) => i.confermato === 'dolce').length,
        // Le già confermate non sono più proposte: la proposta esiste solo dove manca la persona.
        proposteSalato: items.filter((i) => !i.confermato && i.proposta === 'salato').length,
        proposteDolce: items.filter((i) => !i.confermato && i.proposta === 'dolce').length,
        senzaProposta: items.filter((i) => !i.confermato && !i.proposta).length,
      },
    };
  }

  /** Una persona decide: scrive `piatto:dolce`/`piatto:salato`, o toglie la classificazione (`null`). */
  async setColazione(userId: string, id: string, tipo: TipoColazione | null) {
    if (tipo !== 'dolce' && tipo !== 'salato' && tipo !== null) {
      throw new BadRequestException('Tipo colazione non valido: dolce, salato, o null per togliere');
    }
    const recipe = await this.prisma.recipe.findUnique({ where: { id }, select: { id: true, tags: true } });
    if (!recipe) throw new NotFoundException('Ricetta non trovata');
    const updated = await this.prisma.recipe.update({
      where: { id },
      data: { tags: tagsDopoScelta((recipe as { tags?: string[] }).tags, tipo) },
    });
    await this.audit.log({
      action: 'catalog.recipe.colazione.set',
      actorId: userId,
      entityType: 'recipe',
      entityId: id,
      metadata: { tipo },
    });
    return { id: updated.id, confermato: tipo };
  }

  /**
   * La conferma in blocco: le proposte che Lucia approva insieme. Chi non esiste più si salta e si
   * conta — un id sparito non deve far fallire le altre duecento. Un audit solo per il blocco.
   */
  async confermaColazioni(userId: string, scelte: { id: string; tipo: TipoColazione }[]) {
    if (!Array.isArray(scelte) || scelte.length === 0) throw new BadRequestException('Nessuna scelta');
    if (scelte.length > 500) throw new BadRequestException('Massimo 500 conferme per blocco');
    if (scelte.some((c) => c.tipo !== 'dolce' && c.tipo !== 'salato')) {
      throw new BadRequestException('In blocco si conferma solo dolce o salato');
    }
    const trovate = await this.prisma.recipe.findMany({
      where: { id: { in: scelte.map((c) => c.id) } },
      select: { id: true, tags: true },
    });
    const perId = new Map(trovate.map((r) => [r.id, (r as { tags?: string[] }).tags ?? []]));
    let scritte = 0;
    for (const scelta of scelte) {
      const tags = perId.get(scelta.id);
      if (tags === undefined) continue;
      await this.prisma.recipe.update({ where: { id: scelta.id }, data: { tags: tagsDopoScelta(tags, scelta.tipo) } });
      scritte += 1;
    }
    await this.audit.log({
      action: 'catalog.recipe.colazione.blocco',
      actorId: userId,
      entityType: 'recipe',
      entityId: 'blocco',
      metadata: { scritte, saltate: scelte.length - scritte },
    });
    return { scritte, saltate: scelte.length - scritte };
  }

  // ---------- Regole del prodotto (Fase F) ----------

  async getRules(dietId: string) {
    await this.getDiet(dietId);
    return this.prisma.productRule.findMany({ where: { dietId }, orderBy: { ruleCode: 'asc' } });
  }

  /** Attiva/parametrizza le regole opzionali del prodotto (upsert per ruleCode). */
  async setRules(userId: string, dietId: string, rules: { ruleCode: string; enabled?: boolean; params?: Record<string, unknown> }[]) {
    await this.getDiet(dietId);
    for (const r of rules) {
      await this.prisma.productRule.upsert({
        where: { dietId_ruleCode: { dietId, ruleCode: r.ruleCode } },
        create: { dietId, ruleCode: r.ruleCode, enabled: r.enabled ?? true, params: (r.params ?? {}) as never },
        update: { enabled: r.enabled ?? true, params: (r.params ?? {}) as never },
      });
    }
    await this.audit.log({ action: 'catalog.diet.rules.set', actorId: userId, entityType: 'diet', entityId: dietId, metadata: { count: rules.length } });
    return this.getRules(dietId);
  }

  /** Coda "c'è un'altra regola?": proposta di una regola nuova. */
  async proposeRule(userId: string, dietId: string, text: string) {
    await this.getDiet(dietId);
    const proposal = await this.prisma.ruleProposal.create({
      data: { dietId, text, proposedBy: userId, status: 'pending' },
    });
    await this.audit.log({ action: 'catalog.diet.rule_proposal', actorId: userId, entityType: 'diet', entityId: dietId });
    return proposal;
  }

  /** Sostituisce i template giornata (dieta+livello+giorno). Verifica che le ricette esistano. */
  async setDayTemplates(userId: string, dietId: string, dto: SetDayTemplatesDto) {
    const diet = await this.getDiet(dietId);
    if (diet.status === 'approved') {
      throw new BadRequestException('Una dieta approvata non si modifica.');
    }
    const recipeIds = [...new Set(dto.days.flatMap((d) => d.meals.map((m) => m.recipeId)))];
    const found = await this.prisma.recipe.count({ where: { id: { in: recipeIds }, active: true } });
    if (found !== recipeIds.length) {
      throw new BadRequestException('Una o più ricette non esistono o non sono attive');
    }

    await this.prisma.$transaction([
      this.prisma.dietDayTemplate.deleteMany({ where: { dietId } }),
      this.prisma.dietDayTemplate.createMany({
        data: dto.days.map((d) => ({
          dietId,
          level: d.level,
          dayIndex: d.dayIndex,
          meals: d.meals as never,
        })),
      }),
      this.prisma.diet.update({
        where: { id: dietId },
        data: { status: 'draft', approvedById: null, approvedAt: null },
      }),
    ]);
    await this.audit.log({
      action: 'catalog.diet.templates_set',
      actorId: userId,
      entityType: 'diet',
      entityId: dietId,
      metadata: { days: dto.days.length },
    });
    return this.getDiet(dietId);
  }

  async submitForReview(userId: string, id: string) {
    const diet = await this.getDiet(id);
    if (diet.status !== 'draft' && diet.status !== 'rejected') {
      throw new BadRequestException(`La dieta è in stato ${diet.status}: non inviabile in revisione`);
    }
    if (diet.dayTemplates.length === 0) {
      throw new BadRequestException('Aggiungi almeno un template giornata prima della revisione');
    }
    const updated = await this.prisma.diet.update({ where: { id }, data: { status: 'in_review' } });
    await this.audit.log({
      action: 'catalog.diet.submit',
      actorId: userId,
      entityType: 'diet',
      entityId: id,
    });
    await this.notifyHeadOfReview(diet.authorId, updated.name);
    return updated;
  }

  /** Avvisa il capo nutrizionista che una dieta è in attesa di approvazione. */
  private async notifyHeadOfReview(authorStaffId: string | null, dietName: string): Promise<void> {
    let targets: string[] = [];
    if (authorStaffId) {
      const author = await this.prisma.staff.findUnique({
        where: { id: authorStaffId },
        select: { headNutritionist: { select: { userId: true } } },
      });
      if (author?.headNutritionist?.userId) targets = [author.headNutritionist.userId];
    }
    if (targets.length === 0) {
      // Nessun capo diretto impostato: avvisa tutti i capi nutrizionisti.
      const heads = await this.prisma.user.findMany({
        where: { role: 'head_nutritionist', deletedAt: null } as never,
        select: { id: true },
      });
      targets = heads.map((h: { id: string }) => h.id);
    }
    for (const uid of targets) {
      await this.notifications
        .notify({
          userId: uid,
          type: 'diet_review_requested',
          title: 'Dieta da approvare',
          body: `La dieta "${dietName}" è in attesa di approvazione.`,
          payload: {},
        })
        .catch(() => undefined);
    }
  }

  /** Approvazione: solo capo (guard sul controller) e MAI la propria dieta. */
  async approveDiet(userId: string, id: string) {
    const staff = await this.staffOf(userId);
    const diet = await this.getDiet(id);
    if (diet.status !== 'in_review') {
      throw new BadRequestException('Si approvano solo diete in revisione');
    }
    if (diet.authorId === staff.id) {
      throw new ForbiddenException('Non puoi approvare una dieta di cui sei autore');
    }
    const updated = await this.prisma.diet.update({
      where: { id },
      data: { status: 'approved', approvedById: staff.id, approvedAt: new Date() },
    });
    await this.audit.log({
      action: 'catalog.diet.approve',
      actorId: userId,
      entityType: 'diet',
      entityId: id,
    });
    await this.notifyDietApproved(diet.authorId, staff.id, updated.name);
    const vis = await this.tryMakeClientVisible(id);
    return { ...updated, clientVisible: vis.clientVisible, visibilityWarning: vis.visibilityWarning };
  }

  /**
   * Pubblicazione diretta del CAPO: quando è il responsabile stesso a generare e
   * validare la dieta non serve la revisione di un terzo → draft/rejected/in_review
   * → approved in un colpo solo. Consapevolmente SENZA il blocco "autore" di
   * approveDiet (per i coach sotto resta il flusso submit → approve del capo).
   */
  async publishDiet(userId: string, id: string) {
    const staff = await this.staffOf(userId);
    const diet = await this.getDiet(id);
    if (!['draft', 'rejected', 'in_review'].includes(diet.status)) {
      throw new BadRequestException(`La dieta è in stato ${diet.status}: non pubblicabile`);
    }
    if (diet.dayTemplates.length === 0) {
      throw new BadRequestException('Aggiungi almeno un template giornata prima di pubblicare');
    }
    const updated = await this.prisma.diet.update({
      where: { id },
      data: { status: 'approved', approvedById: staff.id, approvedAt: new Date() },
    });
    await this.audit.log({
      action: 'catalog.diet.publish',
      actorId: userId,
      entityType: 'diet',
      entityId: id,
    });
    await this.notifyDietApproved(diet.authorId, staff.id, updated.name);
    const vis = await this.tryMakeClientVisible(id);
    return { ...updated, clientVisible: vis.clientVisible, visibilityWarning: vis.visibilityWarning };
  }

  async rejectDiet(userId: string, id: string, reason?: string) {
    const staff = await this.staffOf(userId);
    const diet = await this.getDiet(id);
    if (diet.status !== 'in_review') {
      throw new BadRequestException('Si rifiutano solo diete in revisione');
    }
    if (diet.authorId === staff.id) {
      throw new ForbiddenException('Non puoi giudicare una dieta di cui sei autore');
    }
    const updated = await this.prisma.diet.update({ where: { id }, data: { status: 'rejected' } });
    await this.audit.log({
      action: 'catalog.diet.reject',
      actorId: userId,
      entityType: 'diet',
      entityId: id,
      metadata: { reason },
    });
    return updated;
  }

  /**
   * Archivia una dieta del catalogo (anche approvata/pubblicata): la porta in stato
   * 'rejected' — usato qui come "archivio", così NON serve una migrazione — e ne azzera
   * la visibilità. Effetto: esce dai menu (pickDiet richiede 'approved'), dallo schermo 16
   * e dal sito. Serve ad ALLINEARE il catalogo quando si toglie un'opzione dal generatore
   * (es. le varianti 3/5 pasti create per errore sotto "Digiuno intermittente").
   */
  async archiveDiet(userId: string, id: string) {
    await this.staffOf(userId); // solo staff
    const diet = await this.getDiet(id);
    const updated = await this.prisma.diet.update({
      where: { id },
      data: { status: 'rejected', clientVisible: false, siteVisible: false, approvedById: null, approvedAt: null },
    });
    await this.audit.log({
      action: 'catalog.diet.archive',
      actorId: userId,
      entityType: 'diet',
      entityId: id,
      metadata: { from: diet.status },
    });
    return updated;
  }

  // ---------- Collegare una ricetta alle giornate ----------

  /**
   * ⚠️ QUESTE OPERAZIONI LAVORANO SUL LIVELLO 1.
   *
   * `DietDayTemplate` ha un `level` e il motore sa leggere livelli diversi, ma nei dati esiste solo
   * il livello 1 e tutto ciò che scrive giornate (generatore e «Componi giorni») scrive lì. Senza
   * questo filtro, `findFirst` su `{dietId, dayIndex}` può pescare la riga di un altro livello: si
   * scriverebbe il piatto in un ciclo che nessuno eroga, e l'elenco «Dove è usata» lo mostrerebbe
   * come se fosse servito. Meglio un perimetro dichiarato che una scelta a caso del database.
   */
  private static readonly LIVELLO = 1;

  /**
   * DOVE È USATA QUESTA RICETTA, per la scheda della ricetta.
   *
   * In SQL, non leggendo tutte le giornate in memoria: la domanda riguarda **una** ricetta, e
   * `diet_day_template` sono decine di migliaia di righe con dentro un JSON. Filtrare in JavaScript
   * vorrebbe dire trasferirle tutte a ogni apertura di una scheda.
   */
  async usiDellaRicetta(recipeId: string) {
    /**
     * ⚠️ `meals_per_day` e `objective` vengono da qui e non da una seconda chiamata.
     *
     * Richiesta di Simone (12/8): nella riga piccola, accanto al giorno, devono comparire i pasti e
     * se è dimagrimento o mantenimento. Servono a distinguere righe che altrimenti sono identiche:
     * la stessa dieta esiste in più varianti — 3 e 5 pasti, dimagrimento e mantenimento — e con
     * scritto solo il nome, «Digiuno intermittente (16:8)» ripetuto quattro volte non dice a quale
     * delle quattro appartiene ogni riga. Erano già nel `JOIN`: costano zero.
     */
    const righe = (await this.prisma.$queryRaw`
      SELECT t.diet_id AS "dietId", d.name AS dieta, d.status::text AS stato,
             d.meals_per_day AS "pasti", d.objective AS "obiettivo", t.day_index AS "dayIndex"
      FROM diet_day_template t
      JOIN diet d ON d.id = t.diet_id
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(t.meals) = 'array' THEN t.meals ELSE '[]'::jsonb END
      ) AS m
      WHERE t.level = ${CatalogService.LIVELLO}
        AND (m->>'recipeId') = ${recipeId}
      GROUP BY 1, 2, 3, 4, 5, 6
      ORDER BY 2, 6
    `) as { dietId: string; dieta: string; stato: string; pasti: number | null; obiettivo: string | null; dayIndex: number }[];

    return righe.map((r) => ({
      dietId: r.dietId,
      dieta: r.dieta,
      // Una dieta ritirata tiene le sue giornate scritte: la ricetta sembra usata e non lo è più.
      ritirata: r.stato === 'rejected',
      bozza: r.stato === 'draft' || r.stato === 'in_review',
      pasti: r.pasti === null ? null : Number(r.pasti),
      obiettivo: r.obiettivo ?? null,
      dayIndex: Number(r.dayIndex),
      settimana: settimanaDi(Number(r.dayIndex)),
      giorno: giornoNellaSettimana(Number(r.dayIndex)),
    }));
  }

  /**
   * Le giornate di una dieta viste **da uno slot solo**: chi c'è adesso in quella cena, giorno per
   * giorno. È quello che serve per scegliere dove mettere il piatto senza scoprire dopo di averne
   * cancellato un altro.
   */
  async giornateDiDietaPerSlot(dietId: string, slot: string) {
    const [giorni, diet] = await Promise.all([
      this.prisma.dietDayTemplate.findMany({
        where: { dietId, level: CatalogService.LIVELLO },
        select: { dayIndex: true, meals: true },
        orderBy: { dayIndex: 'asc' },
      }) as Promise<{ dayIndex: number; meals: unknown }[]>,
      this.prisma.diet.findUnique({ where: { id: dietId }, select: { mealsPerDay: true, fasting: true, status: true } }),
    ]);
    if (!diet) throw new NotFoundException('Dieta non trovata');

    const occupanti = [...new Set(giorni.flatMap((g) => pastiDi(g.meals).filter((m) => m.slot === slot).map((m) => m.recipeId)))];
    const nomi = new Map(
      ((await this.prisma.recipe.findMany({ where: { id: { in: occupanti } }, select: { id: true, name: true } })) as { id: string; name: string }[])
        .map((r) => [r.id, r.name]),
    );

    const attesi = pastiAttesi(diet);
    const giornate = giorni.map((g) => {
      const pasti = pastiDi(g.meals);
      const occupante = pasti.find((m) => m.slot === slot) ?? null;
      return {
        dayIndex: g.dayIndex,
        settimana: settimanaDi(g.dayIndex),
        giorno: giornoNellaSettimana(g.dayIndex),
        occupatoDa: occupante ? { id: occupante.recipeId, name: nomi.get(occupante.recipeId) ?? '(ricetta cancellata)' } : null,
        /** Giornata già monca di suo: il motore la scarta comunque, prima e dopo. */
        completa: attesi.every((a) => pasti.some((m) => m.slot === a)),
      };
    });

    /**
     * DOVE PROPORRE DI METTERLA: la prima settimana INCOMPLETA per questo pasto.
     *
     * Richiesta di Simone dell'11/8: «se collego la ricetta a una nuova dieta proponimi tu la prima
     * settimana incompleta». «Incompleta» qui vuol dire una cosa precisa e utile: la prima settimana
     * che ha ancora un giorno **libero in questo pasto**. È il posto dove il piatto entra senza
     * cacciarne un altro — e sono i buchi del ciclo la cosa che si vuole chiudere.
     *
     * Se non c'è nessun buco, il ciclo per questo pasto è pieno: allora si propone una settimana
     * **nuova**, che è l'altro modo di far entrare il piatto. Resta un suggerimento: il giorno lo
     * conferma chi collega, perché è lui a sapere se vuole sostituire.
     */
    const libera = giornate.find((g) => !g.occupatoDa) ?? null;
    const ultimaSettimana = giornate.reduce((m, g) => Math.max(m, g.settimana), 0);
    const suggerimento = libera
      ? { settimana: libera.settimana, dayIndex: libera.dayIndex, giorno: libera.giorno, nuova: false }
      : { settimana: ultimaSettimana + 1, dayIndex: ultimaSettimana * GIORNI_PER_SETTIMANA + 1, giorno: 1, nuova: true };

    return {
      // Se lo slot non è previsto dalla dieta, il posto dove mettere il piatto non esiste: meglio
      // dirlo qui che lasciar scegliere un giorno e rifiutare al salvataggio.
      slotPrevisto: attesi.includes(slot),
      pastiPrevisti: attesi.length,
      stato: diet.status as string,
      settimane: ultimaSettimana,
      /** Quante giornate il motore eroga davvero oggi: le monche le scarta. */
      giornateComplete: giornate.filter((g) => g.completa).length,
      suggerimento,
      giornate,
    };
  }

  /** I controlli comuni a collega/scollega, in un posto solo. */
  private async ricettaEDieta(recipeId: string, dietId: string) {
    const [recipe, diet] = await Promise.all([
      this.prisma.recipe.findUnique({ where: { id: recipeId } }) as Promise<{ id: string; name: string; regime: string; mealSlot: string; active: boolean; allergensReviewed: boolean } | null>,
      this.prisma.diet.findUnique({ where: { id: dietId } }) as Promise<{ id: string; name: string; regime: string; mealsPerDay: number | null; fasting: boolean | null; status: string } | null>,
    ]);
    if (!recipe) throw new NotFoundException('Ricetta non trovata');
    if (!diet) throw new NotFoundException('Dieta non trovata');
    return { recipe, diet };
  }

  /**
   * COLLEGA la ricetta a una giornata di una dieta.
   *
   * ⚠️ **Non rimanda la dieta in bozza.** `setDayTemplates` lo fa, ed è giusto lì: quella riscrive
   * il ciclo intero. Qui si cambia un piatto in una giornata, e declassare la dieta vorrebbe dire
   * toglierla alle clienti che la stanno seguendo per una correzione di catalogo. Decisione di
   * Simone dell'11/8.
   *
   * ⚠️ **Proprio perché non torna in bozza, i cancelli si controllano QUI.** `assertActivatable` gira
   * solo quando una dieta viene pubblicata o resa visibile: su una dieta già approvata non passerà
   * mai più. Quindi il regime e gli allergeni confermati (R8) vanno verificati adesso, o questa
   * strada diventa il modo di far entrare nel piatto di una cliente una ricetta che il cancello
   * avrebbe fermato.
   *
   * ⚠️ **La settimana si crea solo se non esiste per niente.** Riempire i buchi di una settimana
   * parziale allungherebbe il ciclo di una dieta viva senza che nessuno l'abbia chiesto: un ciclo di
   * 10 giornate diventerebbe di 14, con quattro giornate vuote.
   */
  async collegaRicetta(userId: string, recipeId: string, dietId: string, dayIndex: number) {
    await this.staffOf(userId);
    const { recipe, diet } = await this.ricettaEDieta(recipeId, dietId);

    if (!recipe.active) throw new BadRequestException('La ricetta è archiviata: riattivala prima di collegarla.');
    if (recipe.regime !== diet.regime) {
      throw new BadRequestException(
        `La ricetta è ${recipe.regime} e la dieta «${diet.name}» è ${diet.regime}. Un piatto di un altro regime dentro una dieta è un errore che nessuno vede finché non arriva nel piatto di una cliente.`,
      );
    }
    if (!recipe.allergensReviewed) {
      throw new BadRequestException(
        'Gli allergeni di questa ricetta non sono ancora confermati (R8). Confermali in «Allergeni ricette»: da qui la dieta non ripassa dal controllo di pubblicazione, quindi il piatto entrerebbe nei menu con gli allergeni solo suggeriti.',
      );
    }
    const attesi = pastiAttesi(diet);
    /**
     * ⚠️ Fase 2 (1/9): una ricetta da spuntino può essere collegata a una merenda e viceversa, ed è
     * la stessa decisione che allarga il paniere. Il controllo resta: uno spuntino in una dieta che
     * non ha né spuntino né merenda continua a essere rifiutato.
     */
    if (!attesi.some((a) => puoStareNelloSlot(recipe.mealSlot, a))) {
      throw new BadRequestException(
        `La dieta «${diet.name}» non prevede questo pasto: le sue giornate hanno ${attesi.length} pasti (${attesi.join(', ')}).`,
      );
    }

    const settimana = settimanaDi(dayIndex);
    const giorniSettimana = giorniDi(settimana);

    /**
     * Lettura e scrittura nella STESSA transazione. Fuori, due nutrizionisti sulla stessa giornata
     * leggono lo stesso `meals` e il secondo salvataggio cancella il pasto del primo — senza errore,
     * senza log, con l'audit di tutti e due che dice «fatto».
     */
    const esito = await this.prisma.$transaction(async (tx: PrismaTx) => {
      const esistenti = (await tx.dietDayTemplate.findMany({
        where: { dietId, level: CatalogService.LIVELLO, dayIndex: { in: giorniSettimana } },
        select: { id: true, dayIndex: true, meals: true },
        orderBy: { dayIndex: 'asc' },
      })) as { id: string; dayIndex: number; meals: unknown }[];

      // La settimana si crea INTERA solo se non esiste nessuna delle sue giornate. Se ne esiste
      // anche una sola, il ciclo arriva fin lì di proposito e non lo si allunga di nascosto.
      const settimanaNuova = esistenti.length === 0;
      const giorno = esistenti.find((e) => e.dayIndex === dayIndex) ?? null;
      if (!settimanaNuova && !giorno) {
        throw new BadRequestException(
          `La dieta «${diet.name}» non ha il giorno ${giornoNellaSettimana(dayIndex)} della settimana ${settimana}: il suo ciclo si ferma prima. Scegli un giorno che esiste, oppure una settimana nuova.`,
        );
      }

      const messa = conRicettaNelloSlot(giorno?.meals, recipe.mealSlot, recipeId);
      const sostituito = messa.sostituito
        ? ((await tx.recipe.findUnique({ where: { id: messa.sostituito }, select: { name: true } })) as { name: string } | null)?.name ?? null
        : null;

      if (settimanaNuova) {
        await tx.dietDayTemplate.createMany({
          data: giorniSettimana.map((g) => ({
            dietId, level: CatalogService.LIVELLO, dayIndex: g,
            meals: (g === dayIndex ? messa.meals : []) as never,
          })),
        });
      } else {
        await tx.dietDayTemplate.update({
          where: { id: (giorno as { id: string }).id }, data: { meals: messa.meals as never },
        });
      }
      return { messa, sostituito, settimanaNuova };
    });

    await this.audit.log({
      action: 'catalog.recipe.collegata',
      actorId: userId,
      entityType: 'recipe',
      entityId: recipeId,
      metadata: {
        dietId, dieta: diet.name, dayIndex, settimana,
        sostituito: esito.sostituito,
        settimanaNuova: esito.settimanaNuova,
        giornateVuoteCreate: esito.settimanaNuova ? GIORNI_PER_SETTIMANA - 1 : 0,
      },
    });

    return {
      ok: true,
      settimana,
      giorno: giornoNellaSettimana(dayIndex),
      giaCosi: esito.messa.giaCosi,
      sostituito: esito.sostituito,
      settimanaNuova: esito.settimanaNuova,
      /** Le giornate nate VUOTE: sono da riempire, e finché lo sono il motore le salta. */
      giornateVuoteCreate: esito.settimanaNuova ? GIORNI_PER_SETTIMANA - 1 : 0,
      /**
       * Se la giornata è ancora monca, il piatto è scritto ma NON arriva a nessuna cliente: il
       * motore serve solo le giornate con tutti i pasti. Va detto, o «collegata» si legge come
       * «in produzione».
       */
      giornataCompleta: attesi.every((a) => esito.messa.meals.some((m: { slot: string }) => m.slot === a)),
      pastiMancanti: attesi.filter((a) => !esito.messa.meals.some((m: { slot: string }) => m.slot === a)).length,
    };
  }

  /**
   * TOGLIE la ricetta da una giornata.
   *
   * ⚠️ La giornata resta, **monca**: e una giornata monca il motore la scarta. Quindi togliere un
   * piatto da una dieta viva accorcia il ciclo servito alle clienti — la rotazione gira su
   * `giornateComplete`, non sulle giornate scritte. Qui si restituisce quanto resta, perché chi
   * toglie possa vederlo; e si rifiuta di togliere l'**ultima** giornata completa, che lascerebbe la
   * dieta senza niente da erogare.
   */
  async scollegaRicetta(userId: string, recipeId: string, dietId: string, dayIndex: number) {
    await this.staffOf(userId);
    const { diet } = await this.ricettaEDieta(recipeId, dietId);
    const attesi = pastiAttesi(diet);

    const esito = await this.prisma.$transaction(async (tx: PrismaTx) => {
      const giornate = (await tx.dietDayTemplate.findMany({
        where: { dietId, level: CatalogService.LIVELLO },
        select: { id: true, dayIndex: true, meals: true },
      })) as { id: string; dayIndex: number; meals: unknown }[];
      const giorno = giornate.find((g) => g.dayIndex === dayIndex) ?? null;
      if (!giorno) throw new NotFoundException('Questa giornata non esiste in questa dieta.');

      const senza = senzaRicetta(giorno.meals, recipeId);
      if (!senza.tolta) return { tolta: false, complete: 0 };

      const completa = (meals: { slot: string }[]) => attesi.every((a) => meals.some((m: { slot: string }) => m.slot === a));
      const primaComplete = giornate.filter((g) => completa(pastiDi(g.meals))).length;
      const dopoComplete = primaComplete - (completa(pastiDi(giorno.meals)) && !completa(senza.meals) ? 1 : 0);

      if (dopoComplete === 0 && primaComplete > 0) {
        throw new BadRequestException(
          `Questa è l'ultima giornata completa di «${diet.name}»: togliendo il piatto la dieta resterebbe senza niente da erogare, e le clienti che la seguono non riceverebbero il menu. Completa un'altra giornata prima.`,
        );
      }

      await tx.dietDayTemplate.update({ where: { id: giorno.id }, data: { meals: senza.meals as never } });
      return { tolta: true, complete: dopoComplete };
    });

    if (!esito.tolta) return { ok: true, tolta: false };

    await this.audit.log({
      action: 'catalog.recipe.scollegata',
      actorId: userId,
      entityType: 'recipe',
      entityId: recipeId,
      metadata: { dietId, dieta: diet.name, dayIndex, settimana: settimanaDi(dayIndex), giornateComplete: esito.complete },
    });
    return { ok: true, tolta: true, giornateComplete: esito.complete };
  }

  // ---------- Ricette ----------

  /**
   * Le ricette usate dalle giornate di una dieta. Il legame vive SOLO qui: `Recipe` non ha un
   * `dietId` — la stessa ricetta serve a più famiglie, ed è voluto — è la giornata a puntare
   * alla ricetta (`DietDayTemplate.meals` = `[{slot, recipeId}]`, un JSON che il database non sa
   * interrogare). Quindi si leggono le giornate e si estraggono gli id qui.
   */
  private async recipeIdsDiDieta(dietId: string): Promise<string[]> {
    return [...(await this.settimanePerRicetta(dietId)).keys()];
  }

  /**
   * IN QUALI SETTIMANE è usata ogni ricetta di questa dieta.
   *
   * Richiesta di Simone dell'11/8: «mettimi il filtro anche per settimana, perché forse ho capito dove
   * sta l'anomalia: il generatore le mette tutte nella prima settimana». L'osservazione nasceva dal tag
   * `sett:1` che compare su tutte le ricette di una dieta — e quel tag **non dice quello che sembra
   * dire**: viene scritto alla nascita della ricetta e registra in quale *generazione* è stata creata,
   * non in quale settimana del ciclo è finita. Se la settimana 2 riusa un piatto avanzato dalla
   * generazione della settimana 1 (cosa voluta: sono piatti già pagati e già riletti), quel piatto
   * porta `sett:1` per sempre pur stando nella settimana 2.
   *
   * Quindi la settimana vera si legge da un posto solo, quello che decide davvero: la **giornata** che
   * usa la ricetta. `dayIndex` 1-7 = settimana 1, 8-14 = settimana 2, e così via. Una ricetta può
   * comparire in più settimane, ed è un'informazione che conta — è il modo di vedere a occhio se il
   * ciclo si ripete invece di allungarsi.
   */
  private async settimanePerRicetta(dietId: string): Promise<Map<string, number[]>> {
    const giorni = (await this.prisma.dietDayTemplate.findMany({
      where: { dietId },
      select: { dayIndex: true, meals: true },
      orderBy: { dayIndex: 'asc' },
    })) as { dayIndex: number; meals: unknown }[];
    const out = new Map<string, Set<number>>();
    for (const g of giorni) {
      const settimana = Math.max(1, Math.ceil((g.dayIndex ?? 1) / 7));
      const pasti = (Array.isArray(g.meals) ? g.meals : []) as { recipeId?: unknown }[];
      for (const m of pasti) {
        if (typeof m?.recipeId !== 'string' || !m.recipeId) continue;
        const viste = out.get(m.recipeId) ?? new Set<number>();
        viste.add(settimana);
        out.set(m.recipeId, viste);
      }
    }
    return new Map([...out].map(([id, viste]) => [id, [...viste].sort((a, b) => a - b)]));
  }

  /**
   * Elenco ricette per il backoffice. **I filtri girano sul DATABASE, non sulle righe caricate.**
   *
   * Prima la pagina scaricava le prime 1000 righe del regime e filtrava lì: con le sole ricette
   * vegetariane già oltre quel tetto (verificato il 6/8), filtrare voleva dire cercare dentro una
   * fetta arbitraria del catalogo — e una ricetta che c'è ma non compare è peggio di un errore,
   * perché chi cerca conclude che non esiste e la ricrea.
   *
   * Ritorna `{ items, total, troncato }`: `total` è il conteggio VERO di quante ricette
   * corrispondono ai filtri, anche quando `items` è tagliato dal tetto. Così la pagina può dire
   * "50 su 1.240" invece di far credere che il catalogo sia grande quanto quello che si vede.
   *
   * ⚠️ Due filtri restano fuori dal database: **dieta** e **settimana**. Non sono colonne di
   * `Recipe` — si calcolano dalle giornate — quindi li applica la pagina sulle righe ricevute, e
   * quando il risultato è troncato lo dice a chiare lettere. (Fino all'11/8 il filtro fuori dal
   * database era quello sui **tag**, che aveva lo stesso limite e in più cercava dentro etichette
   * che dicono dov'è *nata* la ricetta, non dov'è usata.)
   */
  async listRecipes(filter: {
    regime?: string; mealSlot?: string; q?: string; includeInactive?: boolean; dietId?: string;
    difficulty?: string; season?: string; stato?: string; kcalMin?: number; kcalMax?: number;
    /**
     * ⚠️ «Solo quelle che aspettano gli allergeni» — e gira sul DATABASE, non sulle righe
     * ricevute (19/8, segnalazione del nutrizionista).
     *
     * La pagina Allergeni filtrava in memoria le mille righe che il tetto le aveva già scelto in
     * ordine alfabetico: con 4612 ricette da rivedere sparse su 19347, il filtro pescava dentro una
     * fetta arbitraria del catalogo. È lo stesso difetto che il riquadro qui sopra racconta di aver
     * chiuso l'11/8 per la pagina Ricette — chiuso lì e non qui.
     */
    daRivedere?: boolean;
  }): Promise<{ items: unknown[]; total: number; troncato: boolean; filtroDaRivedere?: boolean }> {
    // Con `dietId` l'elenco è quello della SINGOLA dieta: il tetto non lo tocca mai, perché una
    // dieta ha decine di ricette, non migliaia.
    // Con `dietId` si sa anche IN QUALI SETTIMANE ogni ricetta è usata: serve al filtro per settimana
    // (11/8), e si legge dalle giornate perché il tag `sett:N` dice un'altra cosa (vedi
    // `settimanePerRicetta`).
    const settimane = filter.dietId ? await this.settimanePerRicetta(filter.dietId) : null;
    const soloDieta = settimane ? [...settimane.keys()] : null;
    if (soloDieta && soloDieta.length === 0) return { items: [], total: 0, troncato: false };

    const kcal: Record<string, number> = {};
    if (Number.isFinite(filter.kcalMin as number)) kcal.gte = filter.kcalMin as number;
    if (Number.isFinite(filter.kcalMax as number)) kcal.lte = filter.kcalMax as number;

    // `stato` vince su `includeInactive`: è la scelta esplicita fatta nella colonna Stato.
    const attivo =
      filter.stato === 'active' ? { active: true }
      : filter.stato === 'archived' ? { active: false }
      : filter.includeInactive ? {}
      : { active: true };

    // Stagioni: 'none' = buona tutto l'anno (array vuoto), altrimenti deve contenere quella stagione.
    const stagione =
      filter.season === 'none' ? { seasons: { isEmpty: true } }
      : filter.season ? { seasons: { has: filter.season } }
      : {};

    const where = {
      ...(soloDieta ? { id: { in: soloDieta } } : {}),
      ...attivo,
      ...stagione,
      ...(filter.regime ? { regime: filter.regime as never } : {}),
      ...(filter.mealSlot ? { mealSlot: filter.mealSlot as never } : {}),
      ...(filter.difficulty ? { difficulty: filter.difficulty } : {}),
      ...(Object.keys(kcal).length ? { kcal } : {}),
      ...(filter.q ? { name: { contains: filter.q, mode: 'insensitive' } } : {}),
      ...(filter.daRivedere ? { allergensReviewed: false } : {}),
    };

    const TETTO = 1000;
    const [items, total] = await Promise.all([
      this.prisma.recipe.findMany({ where: where as never, orderBy: { name: 'asc' }, take: TETTO }),
      this.prisma.recipe.count({ where: where as never }),
    ]);
    /**
     * `utilizzo` e `settimane` sulla riga: dove quella ricetta è davvero usata, letto dalle giornate
     * (vedi `utilizzo-ricette.ts` per il perché non dai tag `dieta:`/`sett:`).
     *
     * Si chiede **solo per le righe che escono** — al massimo mille — invece di scandire il catalogo
     * intero: così la risposta è fresca a ogni ricerca e non serve tenerla in una cache, che su due
     * istanze non ritarderebbe ma oscillerebbe.
     *
     * Dentro una dieta `settimane` resta quello DI QUELLA dieta (`settimanePerRicetta`), perché lì la
     * domanda è «dov'è nel ciclo che sto guardando»; fuori è l'unione, perché la stessa ricetta serve
     * più famiglie e restringerla a una sarebbe una mezza verità.
     *
     * ⚠️ Se la lettura delle giornate fallisce, le due colonne valgono `null` — «non lo so» — e NON
     * un elenco vuoto: un elenco vuoto qui significa «ricetta orfana», cioè un'affermazione precisa
     * e falsa su lavoro pagato. Il resto dell'elenco ricette continua a funzionare.
     */
    let usi: Map<string, UsoInDieta[]> | null = null;
    try {
      usi = await utilizzoDelleRicette(this.prisma, (items as { id: string }[]).map((r) => r.id));
    } catch (e) {
      // ⚠️ L'errore si SCRIVE. La prima versione lo ingoiava, e il risultato è stato mezz'ora a
      // indovinare perché le colonne mostrassero «—»: un errore inghiottito trasforma un guasto
      // preciso in un mistero. La pagina continua a funzionare, ma nei log di Render c'è scritto
      // cosa è successo.
      this.logger.error(`Lettura utilizzo ricette non riuscita: ${e instanceof Error ? e.message : String(e)}`);
      usi = null;
    }
    /**
     * ⛔ **IL NOME DI CHI HA VERIFICATO, non il suo id** (Simone, 4/9). Una spunta che dice
     * «verificata da 3f7a-…» non la legge nessuno, e il senso della richiesta era proprio che
     * *«resta tutto registrato»*: registrato per essere letto.
     *
     * ⚠️ **Una query sola per tutta la pagina**, sugli id distinti: una per riga vorrebbe dire mille
     * andate al database per una colonna che si guarda di sfuggita. E se la lettura fallisce si va
     * avanti senza il nome — la data e la spunta ci sono lo stesso, e un catalogo che non si apre
     * per un nome mancante sarebbe un pessimo affare.
     */
    const daVerifica = [...new Set(
      (items as { verifiedById?: string | null }[]).map((r) => r.verifiedById).filter((x): x is string => !!x),
    )];
    let nomiVerifica = new Map<string, string>();
    if (daVerifica.length) {
      try {
        const utenti = (await this.prisma.user.findMany({
          where: { id: { in: daVerifica } },
          select: { id: true, firstName: true, lastName: true },
        })) as { id: string; firstName: string | null; lastName: string | null }[];
        nomiVerifica = new Map(utenti.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ').trim()]));
      } catch (e) {
        this.logger.warn(`Nomi di chi ha verificato non letti: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const conUtilizzo = (items as { id: string; verifiedById?: string | null }[]).map((r) => {
      const u = usi?.get(r.id) ?? (usi ? [] : null);
      return {
        ...r,
        utilizzo: u,
        settimane: settimane ? (settimane.get(r.id) ?? []) : (u ? settimaneDiTutte(u) : null),
        verifiedByName: r.verifiedById ? (nomiVerifica.get(r.verifiedById) || null) : null,
      };
    });
    return {
      items: conUtilizzo,
      total,
      troncato: total > items.length,
      /**
       * ⚠️ **L'ECO DEL FILTRO** — «l'ho applicato davvero» (19/8, dal rilascio di oggi).
       *
       * Il backoffice si pubblica in un minuto e il backend ci mette di più: in quella finestra la
       * pagina nuova manda `daRivedere=true` a un server che non lo conosce, riceve tutto il
       * catalogo e scrive «aspettano gli allergeni 19347 ricette». È **falso**, e non è un dettaglio
       * di transizione: è un numero sbagliato scritto con la faccia di un numero giusto, che è il
       * difetto che questo rilascio serviva a togliere.
       *
       * Con l'eco la pagina non deve indovinare: se il campo non torna, sta parlando con un server
       * che il filtro non ce l'ha, e lo dice invece di raccontare una cosa diversa.
       */
      ...(filter.daRivedere ? { filtroDaRivedere: true } : {}),
    };
  }

  /** Modifica ricetta (nutrizionista). Aggiorna solo i campi inviati. */
  async updateRecipe(userId: string, id: string, dto: UpdateRecipeDto) {
    const existing = await this.prisma.recipe.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ricetta non trovata');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.regime !== undefined) data.regime = dto.regime as never;
    if (dto.mealSlot !== undefined) data.mealSlot = dto.mealSlot as never;
    if (dto.kcal !== undefined) data.kcal = dto.kcal;
    if (dto.ingredients !== undefined) data.ingredients = dto.ingredients as never;
    if (dto.cookingMethods !== undefined) data.cookingMethods = dto.cookingMethods as never;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.macros !== undefined) data.macros = dto.macros as never;
    if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
    // Stagionalità (voce #11): array vuoto = buona tutto l'anno.
    if (dto.seasons !== undefined) data.seasons = dto.seasons;
    if (dto.active !== undefined) data.active = dto.active;

    /**
     * ⚠️ GLI ALLERGENI VINCONO SEMPRE SULLE MODIFICHE (Simone, 18/8 — voce 252).
     *
     * Prima questa funzione scriveva `ingredients` senza toccare `allergensReviewed`: una ricetta
     * con gli allergeni confermati a cui qualcuno cambiava gli ingredienti restava «confermata»
     * con la firma di un piatto diverso. Nessun errore, nessuna riga rossa — e `collegaRicetta` la
     * lasciava entrare nelle diete perché il campo diceva di sì.
     *
     * La regola sta in `conferma-allergeni-decade.ts`, dove è anche scritto perché decade sui NOMI
     * degli ingredienti e non su qualunque salvataggio: una quantità non può introdurre né togliere
     * un allergene, e azzerare per un peso corretto toglierebbe il piatto dai menu senza aggiungere
     * un grammo di sicurezza.
     */
    const eraConfermata = (existing as { allergensReviewed?: boolean }).allergensReviewed === true;
    const confermaDecaduta = laConfermaDecade(
      eraConfermata,
      (existing as { ingredients?: unknown }).ingredients,
      dto.ingredients as unknown,
    );
    if (confermaDecaduta) data.allergensReviewed = false;

    /**
     * ⛔ **LA SPUNTA «RICETTA VERIFICATA»** (Simone, 4/9). La regola — quando si mette, quando si
     * toglie e quando **cade da sola** — sta in `verifica-della-ricetta.ts` con le sue prove: qui
     * si scrive quello che quella decide.
     * ⚠️ Non è `allergensReviewed`: sono due firme diverse su due cose diverse, e questo
     * salvataggio può farle cadere **tutte e due**, ciascuna per la sua ragione.
     */
    const esitoVerifica = cosaSuccedeAllaVerifica(
      {
        verificata: !!(existing as { verifiedAt?: Date | null }).verifiedAt,
        ingredienti: (existing as { ingredients?: unknown }).ingredients,
        regime: (existing as { regime?: unknown }).regime,
      },
      { verified: dto.verified, ingredienti: dto.ingredients as unknown, regime: dto.regime },
      userId,
    );
    const campiVerifica = campiDaScrivere(esitoVerifica);
    if (campiVerifica) {
      data.verifiedAt = campiVerifica.verifiedAt;
      data.verifiedById = campiVerifica.verifiedById;
    }

    const recipe = await this.prisma.recipe.update({ where: { id }, data });
    await this.audit.log({
      action: 'catalog.recipe.update',
      actorId: userId,
      entityType: 'recipe',
      entityId: id,
      // ⚠️ Nell'audit, perché è un cambio di STATO DI SICUREZZA che nessuno ha chiesto
      // esplicitamente: chi un domani si chiede «perché questa ricetta è sparita dai menu?» deve
      // trovare la risposta qui, con la data e il nome di chi ha salvato.
      /**
       * ⚠️ Nell'audit finiscono **tutti e due** i cambi di firma, e separati: chi legge il registro
       * deve poter distinguere «gli allergeni non sono più confermati» da «la ricetta non è più
       * verificata», che sono due cose diverse e si riparano in due posti diversi.
       */
      ...(confermaDecaduta || esitoVerifica.tipo !== 'invariata'
        ? {
          metadata: {
            ...(confermaDecaduta ? { allergensReviewed: false, motivo: 'ingredienti_cambiati' } : {}),
            ...(esitoVerifica.tipo !== 'invariata' ? { verifica: esitoVerifica.tipo } : {}),
            ...(esitoVerifica.tipo === 'decaduta' ? { verificaDecadutaPerche: esitoVerifica.perche } : {}),
          },
        }
        : {}),
    });
    /**
     * ⚠️ `confermaDecaduta` torna INSIEME alla ricetta, e non solo nel log: una conseguenza che
     * chi la provoca non vede è la stessa famiglia di difetti che stiamo togliendo da settimane.
     * Il backoffice la scrive con `fraseConfermaDecaduta`.
     */
    /**
     * ⚠️ **Due conseguenze, due campi.** Chi ha appena salvato deve sapere quale delle due firme è
     * caduta: gli allergeni si ricontrollano in «Allergeni ricette», la verifica si rimette qui.
     * Un campo solo costringerebbe la schermata a indovinare quale messaggio scrivere.
     */
    return {
      ...(recipe as Record<string, unknown>),
      confermaAllergeniDecaduta: confermaDecaduta,
      verificaDecaduta: esitoVerifica.tipo === 'decaduta' ? esitoVerifica.perche : null,
    };
  }

  /**
   * La scheda di una ricetta. È l'unica rotta del catalogo aperta anche alle **clienti**.
   *
   * ⚠️ I `tags` NON escono da qui. Sono nomenclatura interna — `gen:low_carb`, `dieta:Pescetariana`,
   * `sett:1` — e l'app li disegnava come pastiglie sotto il nome del piatto: la cliente leggeva la
   * sigla del preset con cui era stata generata la sua cena. Toglierli in app non basta: finché
   * escono dal server, il prossimo pezzo di interfaccia che stampa quello che riceve li rimette a
   * schermo. Si tolgono dove nascono.
   */
  async getRecipe(id: string, contesto?: ContestoScheda) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id } });
    if (!recipe || !recipe.active) throw new NotFoundException('Ricetta non trovata');
    const { tags: _interni, ...senzaTag } = recipe as unknown as Record<string, unknown>;
    return this.conLaPorzioneDelGiorno(senzaTag, id, contesto);
  }

  /**
   * LA SCHEDA CON LE GRAMMATURE DI QUESTA CLIENTE, IN QUESTO GIORNO — voce 255, coda della strada C.
   *
   * Il perché e i tre ⚠️ che governano la scelta stanno in `menu/porzione-del-giorno.ts`: in breve,
   * la scalatura la fa il **server** (la regola di arrotondamento è quella della lista della spesa,
   * e due copie sarebbero due risposte alla stessa domanda) e **solo se la chiede il chiamante**
   * (l'app vecchia dice ancora «pesa gli ingredienti per 1,8 volte», e riceverle già scalate le
   * farebbe pesare ×3,24).
   *
   * ⚠️ **Il giorno si legge SEMPRE come proprio.** `clientId` è `user.sub`: chi guarda vede la
   * porzione della sua giornata, e nessuna richiesta può chiedere quella di un'altra persona. Uno
   * membro dello staff che passasse `giorno` non ha `MenuDay`, quindi riceve la scheda di catalogo.
   *
   * ⚠️ **Sotto `catch`, e con l'errore scritto.** La porzione è un di più: se la lettura del giorno
   * fallisce, la ricetta deve aprirsi lo stesso — ma un `catch` muto qui vorrebbe dire che la scheda
   * torna alle grammature di catalogo *in silenzio*, che è esattamente il difetto che questa
   * consegna chiude.
   */
  private async conLaPorzioneDelGiorno(
    scheda: Record<string, unknown>,
    recipeId: string,
    contesto?: ContestoScheda,
  ): Promise<Record<string, unknown>> {
    const giorno = contesto?.giorno?.trim();
    if (!contesto?.clientId || !giorno || !SOLO_DATA.test(giorno)) return scheda;
    try {
      const day = await this.prisma.menuDay.findUnique({
        where: { clientId_date: { clientId: contesto.clientId, date: new Date(`${giorno}T00:00:00.000Z`) } },
        select: { meals: true },
      });
      if (!day) return scheda;
      /**
       * ⚠️ DUE COSE DIVERSE, E LA SECONDA VALE ANCHE SENZA LA PRIMA: la **porzione** (che scala le
       * grammature) e le **sostituzioni** concordate in chat (che cambiano di cosa si parla). Un
       * piatto non scalato può avere lo stesso una sostituzione: chiedendo solo la porzione, la
       * scheda mostrava le carote a chi aveva concordato le biete (revisione del 18/8 sera).
       */
      const pasto = pastoDelGiorno(day.meals, recipeId, contesto.slot);
      if (!pasto) return scheda;
      const porzione = porzioneDelGiorno(day.meals, recipeId, contesto.slot);
      const scalati = ingredientiScalati(scheda.ingredients, porzione?.fattore ?? 1, pasto.substitutions);
      /**
       * ⚠️ NEGLI INGREDIENTI C'È SCRITTO «BIETE», NEI PASSI ANCORA «CAROTE» (19/8).
       *
       * Le sostituzioni si applicano agli ingredienti; i passi di cottura escono dal catalogo
       * intatti, e chi cucina legge due cose diverse sulla stessa ricetta. ⚠️ **Non si riscrivono**:
       * cambiare una parola dentro una frase produce «la porro» e «biete tagliate a rondelle» —
       * italiano sbagliato e istruzioni sbagliate. Si dice, sopra i passi, dove serve.
       */
      const passi = (Array.isArray(scheda.cookingMethods) ? scheda.cookingMethods : [])
        .flatMap((m) => (Array.isArray((m as { steps?: unknown }).steps) ? ((m as { steps: unknown[] }).steps as string[]) : []));
      const daSapere = sostituzioniDaSapere(pasto.substitutions, passi);
      // ⚠️ Il campo si scrive solo se c'è qualcosa da dire: un array vuoto in risposta è una
      // sezione che l'app disegna sempre, e una nota che c'è sempre non è una nota.
      const nota = daSapere.length ? { sostituzioniNeiPassi: daSapere } : {};
      if (!porzione) {
        // Niente porzione da dire: restano le kcal e il nome di catalogo, ma gli ingredienti sono
        // quelli del piatto. `porzione` non si scrive: non c'è nessun moltiplicatore da annunciare.
        return scalati ? { ...scheda, ingredients: scalati, ...nota } : { ...scheda, ...nota };
      }
      return {
        ...scheda,
        ...nota,
        // ⚠️ Le kcal sono quelle dello SNAPSHOT, non `kcal × fattore`: sono il numero che la
        // cliente ha già letto nel menu, ed è dalla differenza fra i due che nasceva il dubbio.
        ...(porzione.kcal !== undefined ? { kcal: porzione.kcal } : {}),
        ...(porzione.kcalBase !== undefined ? { kcalBase: porzione.kcalBase } : {}),
        ...(scalati ? { ingredients: scalati } : {}),
        // La bandierina che l'app aspetta: «queste grammature sono già le tue». Senza, non avrebbe
        // modo di sapere se la scalatura è avvenuta, e ridirebbe di moltiplicare a mano.
        porzione: porzione.fattore,
      };
    } catch (e) {
      this.logger.error(
        `Scheda ricetta ${recipeId}: la porzione del giorno ${giorno} non si è potuta leggere, ` +
          `si mostrano le grammature di catalogo — ${(e as Error).message}`,
      );
      return scheda;
    }
  }

  async createRecipe(userId: string, dto: CreateRecipeDto) {
    const recipe = await this.prisma.recipe.create({
      data: {
        name: dto.name,
        regime: dto.regime as never,
        mealSlot: dto.mealSlot as never,
        kcal: dto.kcal,
        ingredients: dto.ingredients as never,
        cookingMethods: (dto.cookingMethods ?? []) as never,
        tags: dto.tags ?? [],
        macros: (dto.macros ?? undefined) as never,
        difficulty: dto.difficulty ?? 'media',
        seasons: dto.seasons ?? [],
        active: dto.active ?? true,
      },
    });
    await this.audit.log({
      action: 'catalog.recipe.create',
      actorId: userId,
      entityType: 'recipe',
      entityId: recipe.id,
    });
    return recipe;
  }

  // ---------- Tassonomia: regimi (configurabili) + stili (dalle diete) ----------

  private static readonly DEFAULT_REGIMES = [
    { code: 'omnivore', label: 'Onnivora' },
    { code: 'vegetarian', label: 'Vegetariana' },
    { code: 'vegan', label: 'Vegana' },
  ];
  private static readonly STYLE_LABELS: Record<string, string> = {
    mediterranean: 'Mediterranea', protein: 'Proteica', low_carb: 'Low carb', flexible: 'Flessibile', keto: 'Keto', keto_mediterranean: 'Keto-Mediterranea', dash: 'DASH',
  };

  private titleCase(v: string): string {
    return v.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Regimi alimentari: lista configurabile (config_param diet_regimes), con fallback ai 3 di default. */
  async regimes(): Promise<{ code: string; label: string }[]> {
    const raw = await this.config.getString('diet_regimes', '');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { code?: unknown; label?: unknown }[];
        const list = (Array.isArray(parsed) ? parsed : [])
          .filter((r) => r && typeof r.code === 'string' && (r.code as string).trim())
          .map((r) => ({ code: String(r.code).trim(), label: String(r.label ?? r.code).trim() }));
        if (list.length) return list;
      } catch {
        /* valore non valido → default */
      }
    }
    return CatalogService.DEFAULT_REGIMES;
  }

  /** Stili disponibili: SOLO quelli di diete APPROVATE (uno stile senza dieta approvata non è
   *  assegnabile). L'etichetta è il NOME della dieta (nome cliente se impostato, altrimenti
   *  nome interno) così le tendine "Stile" combaciano con i nomi che si vedono in Diete —
   *  niente più codici grezzi tipo "Summer Holiday". */
  async styles(): Promise<{ code: string; label: string }[]> {
    const rows = (await this.prisma.diet.findMany({
      where: { status: 'approved' },
      select: { style: true, clientName: true, name: true },
      orderBy: { createdAt: 'asc' },
    })) as { style: string | null; clientName: string | null; name: string | null }[];
    const seen = new Set<string>();
    const out: { code: string; label: string }[] = [];
    for (const r of rows) {
      const code = r.style?.trim();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const label =
        r.clientName?.trim() ||
        r.name?.trim() ||
        CatalogService.STYLE_LABELS[code] ||
        this.titleCase(code);
      out.push({ code, label });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Le DIETE assegnabili: nome + stile, dalle diete approvate.
   *
   * ⚠️ Perché serve, accanto a `styles()`. Lo **stile non identifica una dieta**: `Mediterranea`,
   * `Mediterranea ipocalorica` e `Pescetariana` hanno tutte `style = 'mediterranean'`, e `Vegana`,
   * `Vegetariana`, `Flexitariana` e `Flessibile` sono tutte `flexible`. La tendina «Stile» della
   * scheda cliente mostrava l'etichetta della PRIMA dieta approvata con quel codice — così si
   * sceglieva «Mediterranea» e si poteva ricevere «Pescetariana», cioè menu senza carne (§16.10).
   *
   * Qui l'unità è la dieta, che è la cosa che il nutrizionista ha in mente. Lo `style` viaggia
   * insieme perché va scritto sul profilo nello stesso momento: `pickDietFor` cerca **famiglia +
   * stile** insieme, e una famiglia con lo stile di un'altra non trova niente e ripiega — proprio
   * sul difetto che questa tendina serve a chiudere.
   */
  /**
   * ⛔ **LE FAMIGLIE IN CHIUSURA NON SPARISCONO DALLA TENDINA: SI MARCANO** — 2/9, da una
   * segnalazione di Simone («dalla scheda lead vedo ancora le vecchie diete»).
   *
   * Sei famiglie del piano panieri si stanno chiudendo, e qui comparivano identiche alle altre:
   * chi assegna un lead poteva metterlo su «Mediterranea senza glutine» oggi, e domani era
   * un'altra persona da migrare a mano.
   *
   * ⚠️ **Ma toglierle sarebbe peggio.** Chi le ha già sopra deve continuare a vederle — è la
   * stessa ragione per cui `ClientDetail.tsx` tiene in tendina la dieta «(non più in catalogo)»:
   * una scelta che sparisce si cancella al primo salvataggio di un altro campo. E una tendina che
   * nasconde senza dire nulla fa cercare un guasto dove c'è una decisione.
   *
   * Quindi la famiglia resta, con `inChiusura: true`, e chi disegna la tendina decide come dirlo.
   * ⛔ La lista canonica è **una sola** (`FAMIGLIE_CHE_SPARISCONO` in `appartenenza-panieri.ts`):
   * un secondo elenco qui sarebbe la prossima cosa che diverge.
   */
  async famiglie(): Promise<{ name: string; style: string | null; label: string; inChiusura: boolean }[]> {
    const rows = (await this.prisma.diet.findMany({
      where: { status: 'approved' },
      select: { name: true, style: true, clientName: true },
      orderBy: { createdAt: 'asc' },
    })) as { name: string | null; style: string | null; clientName: string | null }[];
    const viste = new Set<string>();
    const out: { name: string; style: string | null; label: string; inChiusura: boolean }[] = [];
    for (const r of rows) {
      const name = r.name?.trim();
      if (!name || viste.has(name)) continue;
      viste.add(name);
      out.push({
        name,
        style: r.style ?? null,
        label: r.clientName?.trim() || name,
        inChiusura: famigliaInChiusura(name),
      });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }

  async taxonomy() {
    const [regimes, styles, families] = await Promise.all([this.regimes(), this.styles(), this.famiglie()]);
    // I metodi di cottura vengono da `common/metodi-cottura.ts`: il backoffice li CHIEDE invece di
    // riscriverli, così un metodo aggiunto lì compare nella tendina senza toccare il frontend.
    return { regimes, styles, families, cookingMethods: METODI_COTTURA };
  }

  /** Salva la lista dei regimi (solo admin). Normalizza i codici (minuscolo, underscore). */
  async setRegimes(list: { code: string; label: string }[], actorId: string) {
    const clean = (list ?? [])
      .filter((r) => r && typeof r.code === 'string' && r.code.trim())
      .map((r) => ({ code: r.code.trim().toLowerCase().replace(/\s+/g, '_'), label: (r.label ?? r.code).trim() || r.code.trim() }));
    if (clean.length === 0) throw new BadRequestException('Serve almeno un regime.');
    const seen = new Set<string>();
    const dedup = clean.filter((r) => (seen.has(r.code) ? false : (seen.add(r.code), true)));
    const value = JSON.stringify(dedup);
    await this.prisma.configParam.upsert({
      where: { key: 'diet_regimes' },
      create: { key: 'diet_regimes', value, type: 'json' as never, description: 'Regimi alimentari (configurabili dalle impostazioni)', updatedById: actorId },
      update: { value, updatedById: actorId },
    });
    await this.audit.log({ action: 'admin.config.update', actorId, entityType: 'config_param', entityId: 'diet_regimes', metadata: { count: dedup.length } });
    return dedup;
  }

  /** Avvisa l'autore della dieta quando qualcun altro la approva/pubblica. */
  private async notifyDietApproved(authorStaffId: string | null, approverStaffId: string, dietName: string): Promise<void> {
    if (!authorStaffId || authorStaffId === approverStaffId) return;
    const author = await this.prisma.staff.findUnique({
      where: { id: authorStaffId },
      select: { userId: true },
    });
    if (!author) return;
    await this.notifications
      .notify({
        userId: author.userId,
        type: 'diet_approved',
        title: 'Dieta approvata',
        body: `La dieta "${dietName}" è stata approvata e pubblicata.`,
        payload: {},
      })
      .catch(() => undefined);
  }
}
