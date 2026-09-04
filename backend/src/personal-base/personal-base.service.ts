import { createHmac } from 'crypto';
import { leggiSorgente, poolPerSlot, ricetteDelPool, righeDalPaniere, righeDalleGiornate } from '../catalog/pool-del-paniere';
import { REGIME_PIU_STRETTO, regimeConosciuto, regimiCompatibili } from '../common/regimi';
import { famigliaDelPaniere } from '../menu/menu.service';
import { apriSegnalazione } from '../escalations/apri-segnalazione';
import { Injectable, NotFoundException, Logger, Optional } from '@nestjs/common';
import { PushService } from '../notifications/push.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { EU_ALLERGEN_CODES } from '../catalog/allergens';
import { allergieDaCodificare } from '../common/allergie';
import { ConfigParamsService } from '../config-params/config-params.service';
import { DietMatchProfile, pickDietFor } from '../catalog/pick-diet';
import { PrismaService } from '../prisma/prisma.service';
import { MAIN_SLOTS, SLOT_LABEL } from '../common/slot-pasto';

// R9 — Chiave server per firmare la personalizzazione (seme + certificato). Non è un
// segreto d'utente: serve a rendere la firma deterministica e verificabile lato server.
const engineSigningKey = () =>
  process.env.ENGINE_SIGNING_KEY || process.env.FILE_ENCRYPTION_KEY || 'dev-only-engine-key';
const hmac = (data: string): string => createHmac('sha256', engineSigningKey()).update(data).digest('hex');

/** Seme deterministico e riproducibile derivato dal client_id (R9: partenza differenziata). */
const seedFor = (clientId: string): string => hmac(`seed:${clientId}`);

/** Rango deterministico di una ricetta per un dato seme: ordina la base in modo unico per cliente. */
const rankOf = (seed: string, recipeId: string): string => hmac(`${seed}:${recipeId}`);

/** Firma del menu personalizzato: hash(seme, versione, ricette ordinate). */
const signMenu = (seed: string, version: number, orderedRecipeIds: string[]): string =>
  hmac(`${seed}|v${version}|${orderedRecipeIds.join(',')}`);


// Messaggio mostrato al cliente quando la base non è pronta (testo fornito dal socio).
const BLOCK_MESSAGE =
  'Stiamo perfezionando il tuo menu insieme al tuo nutrizionista per renderlo sicuro e su misura per te. Ti avvisiamo appena è pronto.';

export interface PersonalBaseResult {
  status: 'ready' | 'blocked';
  version?: number;
  dietId?: string;
  totalSafe?: number;
  perSlot?: Record<string, number>;
  reasons?: string[];
  certificate?: { version: number; signature: string };
  message: string;
}

/**
 * R8 — Agente esclusioni: costruisce la BASE PERSONALIZZATA del cliente, cioè una copia
 * del pool di ricette del prodotto scelto, filtrata in sicurezza sugli allergeni CODIFICATI
 * del cliente (i 14 codici UE, gli stessi taggati sulle ricette).
 *
 * La base è certificabile in automatico solo se, per ogni pasto principale, restano almeno
 * `personal_base_min_recipes_per_slot` ricette sicure (attive + allergeni confermati dal
 * nutrizionista + regime compatibile + senza allergeni del cliente). Se una qualsiasi
 * condizione manca — o se il cliente ha dichiarato un'allergia FUORI dai 14 codici (testo
 * libero, che il motore non può abbinare ai tag) — la base NON è sicura in automatico: si
 * apre una segnalazione "Piano bloccato" al nutrizionista e la app mostra il messaggio di
 * attesa. La sicurezza viene prima della continuità del servizio.
 */
@Injectable()
export class PersonalBaseService {
  private readonly logger = new Logger(PersonalBaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
    /**
     * ⛔ **Il postino di «Piano bloccato»** (Simone, 4/9). La base non certificabile **ferma
     * l'erogazione**: la cliente legge «Menu in preparazione» e l'unica che può sbloccare è la
     * nutrizionista — che finché non apriva il backoffice non lo sapeva. Push a lei e alla coach.
     *
     * ⚠️ `@Optional` perché le prove costruiscono questo servizio a mano, ed è un **di più**:
     * senza, la segnalazione nasce e la riga in app si scrive lo stesso.
     * ⛔ **E SENZA `| null`.** Un tipo unione fa scrivere a TypeScript `Object` in
     * `design:paramtypes`, Nest non sa cosa iniettare, `@Optional()` inghiotte il fallimento e
     * resta il default: la dipendenza è `undefined` per sempre, in silenzio. È successo davvero —
     * `RegistroVeraService` ce l'aveva dal 13/8 e la sua email al capo non è mai partita.
     * `permessi-iniettati.spec.ts` adesso lo guarda.
     */
    @Optional() private readonly push?: PushService,
    @Optional() private readonly mail?: MailService,
  ) {}

  /** Stato della base personalizzata (per la app cliente). */
  async getStatus(clientId: string): Promise<PersonalBaseResult> {
    const blocked = await this.openBlock(clientId);
    const pool = (await this.prisma.clientMenuPool.findFirst({
      where: { clientId },
      orderBy: { version: 'desc' },
    })) as unknown as { version: number; dietId: string; recipeIds: string[] } | null;

    if (blocked) {
      return {
        status: 'blocked',
        message: BLOCK_MESSAGE,
        ...(pool ? { version: pool.version, dietId: pool.dietId } : {}),
      };
    }
    if (!pool) return { status: 'blocked', message: BLOCK_MESSAGE };
    const cert = (await this.prisma.personalizationCertificate.findFirst({
      where: { clientId, version: pool.version },
      select: { version: true, signature: true },
    })) as unknown as { version: number; signature: string } | null;
    return {
      status: 'ready',
      version: pool.version,
      dietId: pool.dietId,
      totalSafe: pool.recipeIds.length,
      ...(cert ? { certificate: { version: cert.version, signature: cert.signature } } : {}),
      message: 'La tua base personalizzata è pronta.',
    };
  }

  /**
   * Certificato di personalizzazione corrente (R9), per verifica esterna: seme, firma,
   * versione. Ricalcola la firma e conferma che corrisponde a quella registrata (integrità).
   */
  async getCertificate(clientId: string) {
    const cert = (await this.prisma.personalizationCertificate.findFirst({
      where: { clientId },
      orderBy: { version: 'desc' },
    })) as unknown as
      | { clientId: string; dietId: string | null; seed: string; signature: string; version: number; createdAt: Date }
      | null;
    if (!cert) throw new NotFoundException('Nessun certificato di personalizzazione per questa cliente.');
    const pool = (await this.prisma.clientMenuPool.findFirst({
      where: { clientId, version: cert.version },
      select: { recipeIds: true },
    })) as unknown as { recipeIds: string[] } | null;
    const recomputed = pool ? signMenu(cert.seed, cert.version, pool.recipeIds) : null;
    return {
      clientId: cert.clientId,
      dietId: cert.dietId,
      version: cert.version,
      seed: cert.seed,
      signature: cert.signature,
      createdAt: cert.createdAt,
      valid: recomputed !== null && recomputed === cert.signature,
    };
  }

  /** Costruisce/aggiorna la base personalizzata del cliente. Idempotente (crea una nuova versione). */
  async buildPersonalBase(clientId: string): Promise<PersonalBaseResult> {
    const profile = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: {
        regime: true,
        dietStyle: true,
        dietFamily: true,
        mealsPerDay: true,
        pathType: true,
        // La finestra del digiuno decide QUALE catalogo sa servire questa cliente
        // (`struttura-per-digiuno.ts`). Senza, `pickDietFor` ricadrebbe sul catalogo digiuno e la
        // base personalizzata si costruirebbe su una dieta diversa da quella del menu del giorno.
        fastingWindow: true,
        objective: true,
        allergies: true,
        allergiesOther: true,
        assignedNutritionistId: true,
      },
    })) as unknown as {
      regime: string | null;
      dietStyle: string | null;
      dietFamily: string | null;
      mealsPerDay: number | null;
      pathType: string | null;
      fastingWindow: string | null;
      objective: string | null;
      allergies: string[];
      allergiesOther: string[];
      assignedNutritionistId: string | null;
    } | null;
    if (!profile) throw new NotFoundException('Profilo non trovato: completa prima il questionario.');

    const minPerSlot = await this.configParams.getNumber('personal_base_min_recipes_per_slot', 3);
    const reasons: string[] = [];

    /**
     * 1. Allergie: quali vanno codificate a mano dal nutrizionista.
     *
     * ⚠️ La risposta viene da `allergiesOther` quando c'è — è un **fatto**, scritto al momento del
     * questionario — e ricade sulla vecchia deduzione per differenza col catalogo UE solo per le
     * clienti iscritte prima di quella colonna. La deduzione è un'**ipotesi**: basta che un codice
     * UE cambi nome e un'allergia codificata diventa «da codificare», o viceversa, senza che nulla
     * lo segnali. La regola sta in `common/allergie.ts`, che è anche il posto dove si vede che le
     * due risposte possono non coincidere, e perché va bene così.
     */
    const allergies = profile.allergies ?? [];
    const coded = allergies.filter((a) => EU_ALLERGEN_CODES.includes(a));
    const uncoded = allergieDaCodificare(allergies, profile.allergiesOther, EU_ALLERGEN_CODES);
    if (uncoded.length) reasons.push(`allergie da codificare a mano: ${uncoded.join(', ')}`);

    // 2. Prodotto (dieta) del cliente.
    const diet = await this.pickDiet(profile);
    if (!diet) {
      reasons.push('nessun prodotto attivo compatibile con regime/stile scelti');
      return this.block(clientId, profile.assignedNutritionistId, reasons);
    }

    /**
     * 3. Pool ricette della dieta → filtro di sicurezza.
     *
     * ⛔ **Passa dalla porta unica** (`catalog/pool-del-paniere.ts`, Fase 1 dei panieri): questa era
     * la seconda delle tre copie della domanda «quali ricette può ricevere questa cliente». Finché
     * sono tre, il giorno che l'appartenenza si sposta sul paniere se ne sposta una sola.
     * ⚠️ Con `panieri_sorgente_pool` sul suo default (`giornate`) il pool è identico a prima.
     */
    const sorgente = leggiSorgente(await this.configParams.getString('panieri_sorgente_pool', 'giornate'));
    const templates = (await this.prisma.dietDayTemplate.findMany({
      where: { dietId: diet.id },
      select: { meals: true },
    })) as unknown as { meals: { slot: string; recipeId: string }[] }[];
    const righe = sorgente === 'paniere'
      ? await righeDalPaniere(this.prisma as never, famigliaDelPaniere(diet) ?? '', diet.regime ?? '')
      : righeDalleGiornate(templates);
    const poolIds = ricetteDelPool(poolPerSlot(righe));

    const recipes = (await this.prisma.recipe.findMany({
      where: { id: { in: [...poolIds] }, active: true },
      select: { id: true, mealSlot: true, regime: true, allergens: true, allergensReviewed: true },
    })) as unknown as {
      id: string;
      mealSlot: string;
      regime: string;
      allergens: string[];
      allergensReviewed: boolean;
    }[];

    /**
     * ⛔ **IL RIPIEGO ERA ROVESCIATO** (corretto l'1/9, Fase 5). La tabella stava qui e non
     * conosceva `pescetarian`, e il ripiego per un regime sconosciuto era `['omnivore']`: il giorno
     * che il pescetariano entra fra i regimi attivi, a quella cliente la base personale avrebbe
     * dichiarato sicuri **i piatti di carne**. Ora la tabella è in `common/regimi.ts`, conosce
     * tutti e quattro i regimi, e per uno sconosciuto ripiega sul **più stretto**.
     *
     * ⚠️ E lo scrive: un regime che non conosciamo su una cliente vera è una cosa che qualcuno deve
     * poter vedere, non un menu più povero senza spiegazione.
     */
    if (profile.regime && !regimeConosciuto(profile.regime)) {
      this.logger.warn(
        `Base personale: regime sconosciuto «${profile.regime}» sul profilo di ${clientId}. `
        + `Si considera sicuro solo il ${REGIME_PIU_STRETTO}: la base sarà più povera del dovuto.`,
      );
    }
    const regimeOk = regimiCompatibili(profile.regime);
    const codedSet = new Set(coded);
    const safe: { id: string; mealSlot: string }[] = [];
    let unreviewed = 0;
    for (const r of recipes) {
      if (!r.allergensReviewed) {
        unreviewed++; // ricetta non certificata → non è considerata sicura
        continue;
      }
      if (!(regimeOk as readonly string[]).includes(r.regime)) continue; // incompatibile col regime del cliente
      if ((r.allergens ?? []).some((a) => codedSet.has(a))) continue; // contiene un allergene del cliente
      safe.push({ id: r.id, mealSlot: r.mealSlot });
    }

    // 4. Conteggio per pasto principale + soglia minima.
    const perSlot: Record<string, number> = {};
    for (const slot of MAIN_SLOTS) perSlot[slot] = safe.filter((r) => r.mealSlot === slot).length;
    const shortSlots = MAIN_SLOTS.filter((s) => perSlot[s] < minPerSlot);
    if (shortSlots.length) {
      reasons.push(
        `pasti senza abbastanza ricette sicure (min ${minPerSlot}): ` +
          shortSlots.map((s) => `${SLOT_LABEL[s]} ${perSlot[s]}`).join(', '),
      );
    }

    // 5. Blocco o certificazione.
    if (reasons.length) return this.block(clientId, profile.assignedNutritionistId, reasons);

    /**
     * ⛔ **LA VERSIONE È DELLA CLIENTE, NON DELLA COPPIA (CLIENTE, DIETA)** — corretto il 2/9, e
     * fino a quel giorno era il difetto che rendeva inutile ogni ricostruzione dopo un cambio di
     * famiglia.
     *
     * Qui si contava `where: { clientId, dietId }`, mentre **tutti e quattro** i lettori cercano
     * per sola cliente e prendono la versione più alta:
     *
     * · `getStatus` — lo stato che vede la cliente nell'app;
     * · `sostituzione-chat.candidatiPerSlot` — il cambio di piatto in chat;
     * · `vera-chat.poolDellaCliente` — la giornata dettata dalla nutrizionista;
     * · e la verifica del certificato, che cerca `{ clientId, version }`.
     *
     * ⛔ Conseguenza: una cliente con quattro ricostruzioni sulla dieta vecchia (v1…v4) che viene
     * spostata su una famiglia nuova otteneva un pool **v1**, e i tre lettori continuavano a
     * pescare il **v4 della dieta vecchia**. La base si rifaceva e non la leggeva nessuno. Con una
     * sola versione vecchia si finiva in pareggio (v1 contro v1) e vinceva l'ordine del database:
     * cioè a caso, cioè a intermittenza — che è il modo peggiore.
     *
     * ⚠️ E il certificato è chiavato su `(clientId, version)`: due pool di diete diverse con la
     * stessa versione si sovrascrivevano il certificato a vicenda.
     *
     * ✅ Contando per sola cliente il numero è monotono: l'ultimo pool costruito è sempre quello
     * con la versione più alta, che è ciò che i lettori danno per scontato. ⚠️ Nessuna migrazione:
     * le righe vecchie restano, e la prima ricostruzione di una cliente disallineata prende
     * `max + 1` su tutte le sue diete e torna davanti.
     */
    const last = (await this.prisma.clientMenuPool.findFirst({
      where: { clientId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })) as unknown as { version: number } | null;
    const version = (last?.version ?? 0) + 1;

    // R9 — Partenza differenziata + unicità certificata.
    // (a) seme deterministico dal client_id → ordinamento unico e riproducibile della base;
    // (b) collision check: se la firma coincide con quella di un'altra cliente, si perturba
    //     il seme e si riordina (fino a garantire una personalizzazione distinta);
    // (c) certificato firmato salvato per verifica esterna.
    const baseSeed = seedFor(clientId);
    let seed = baseSeed;
    let recipeIds = this.orderBySeed(safe, seed);
    let signature = signMenu(seed, version, recipeIds);
    for (let attempt = 1; attempt <= 5 && (await this.collides(clientId, signature)); attempt++) {
      seed = hmac(`${baseSeed}#${attempt}`);
      recipeIds = this.orderBySeed(safe, seed);
      signature = signMenu(seed, version, recipeIds);
    }

    await this.prisma.clientMenuPool.create({
      data: {
        clientId,
        dietId: diet.id,
        version,
        recipeIds,
        excluded: { codedAllergies: coded, unreviewedSkipped: unreviewed, perSlot } as never,
      },
    });
    await this.prisma.personalizationCertificate.upsert({
      where: { clientId_version: { clientId, version } } as never,
      create: { clientId, dietId: diet.id, seed, signature, version } as never,
      update: { dietId: diet.id, seed, signature } as never,
    });
    await this.resolveBlocks(clientId);
    await this.audit.log({
      action: 'personal_base.built',
      actorId: clientId,
      entityType: 'client_menu_pool',
      metadata: { dietId: diet.id, version, total: recipeIds.length, perSlot, signature },
    });
    return {
      status: 'ready',
      version,
      dietId: diet.id,
      totalSafe: recipeIds.length,
      perSlot,
      certificate: { version, signature },
      message: 'La tua base personalizzata è pronta.',
    };
  }

  /** Ordina la base in modo deterministico e unico per cliente (R9), tramite il seme. */
  private orderBySeed(recipes: { id: string }[], seed: string): string[] {
    return [...recipes]
      .map((r) => ({ id: r.id, rank: rankOf(seed, r.id) }))
      .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0))
      .map((r) => r.id);
  }

  /** Vero se un'ALTRA cliente ha già un certificato con questa firma (collisione da evitare). */
  private async collides(clientId: string, signature: string): Promise<boolean> {
    const other = (await this.prisma.personalizationCertificate.findFirst({
      where: { signature, NOT: { clientId } } as never,
      select: { id: true },
    })) as unknown as { id: string } | null;
    return Boolean(other);
  }

  // ---------- interni ----------

  /**
   * Dieta del cliente. La scala dei ripieghi vive in `pick-diet.ts`, una sola volta: qui e in
   * `menu.service.ts` era copiata identica riga per riga, e due copie della stessa logica prima
   * o poi divergono — la base personalizzata sicura e il menu del giorno si costruirebbero su
   * due diete diverse, in silenzio.
   */
  private async pickDiet(profile: DietMatchProfile) {
    return pickDietFor(
      (where) => this.prisma.diet.findFirst({ where: where as never, orderBy: { approvedAt: 'desc' } }),
      profile,
    );
  }

  private async openBlock(clientId: string): Promise<{ id: string } | null> {
    return (await this.prisma.escalation.findFirst({
      where: {
        clientId,
        source: 'engine' as never,
        status: { in: ['open', 'in_progress'] as never },
        reason: { contains: 'Piano bloccato' },
      },
      select: { id: true },
    })) as unknown as { id: string } | null;
  }

  private async block(
    clientId: string,
    nutritionistId: string | null | undefined,
    reasons: string[],
  ): Promise<PersonalBaseResult> {
    const already = await this.openBlock(clientId);
    if (!already) {
      // Passa da `apriSegnalazione` e non più da una `create` diretta: quella scriveva la riga
      // e basta, e se la cliente non aveva ancora una nutrizionista la segnalazione restava
      // senza destinatario — nessuna notifica, nessuno che la vedesse. Vedi il commento in
      // `apri-segnalazione.ts`: è costato venti giorni di silenzio a una persona.
      await apriSegnalazione(this.prisma as never, {
        clientId,
        category: 'diet_blocked',
        source: 'engine',
        reason: `Piano bloccato: base personalizzata non certificabile in automatico (${reasons
          .slice(0, 4)
          .join('; ')}). Serve la revisione del nutrizionista.`,
        // ⚠️ Come in `menu.service`: questa riga è lo STATO che la cliente legge al posto del menu,
        // non un avviso che si ripete. Dentro la tregua si riapre quella risolta, col motivo di
        // adesso, invece di lasciare la cliente ferma davanti a «Menu in preparazione».
        statoNonAvviso: true,
        // ⛔ E adesso esce anche dall'app: push e posta a chi può sbloccare. Vedi il costruttore.
        canali: { push: this.push, mail: this.mail },
      });
      await this.audit.log({
        action: 'personal_base.blocked',
        actorId: clientId,
        entityType: 'escalation',
        metadata: { reasons },
      });
    }
    return { status: 'blocked', reasons, message: BLOCK_MESSAGE };
  }

  private async resolveBlocks(clientId: string): Promise<void> {
    await this.prisma.escalation.updateMany({
      where: {
        clientId,
        source: 'engine' as never,
        status: { in: ['open', 'in_progress'] as never },
        reason: { contains: 'Piano bloccato' },
      },
      // `resolvedAt`: la chiusura automatica conta come chiusura, quindi vale la stessa tregua.
      data: { status: 'resolved' as never, resolvedAt: new Date() } as never,
    });
  }
}
