/**
 * IL POOL DI UNA CLIENTE, LETTO E BASTA.
 *
 * Costruisce il pool vero — le ricette che la SUA dieta prevede per ogni pasto — e ci applica le
 * esclusioni che ha già più quelle che la nutrizionista sta per aggiungere. Ritorna «prima» e
 * «dopo», nella stessa forma di `NutritionistService.simulaKcal`: è il modello di casa per «cosa
 * succederebbe se scrivessi questo», e vale la pena che le due anteprime si assomiglino.
 *
 * ⚠️ QUI DENTRO NON SI SCRIVE NIENTE, e non è una raccomandazione: è l'unica cosa che rende
 * l'anteprima affidabile. Ogni metodo di questa classe usa solo `findMany`/`findUnique`. Il test
 * `pool-disponibile.service.spec.ts` verifica che nessun metodo di scrittura di Prisma venga
 * chiamato — sul modello di «la simulazione non salva niente» di `nutritionist.service.spec.ts`.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { DietMatchProfile, pickDietFor } from '../catalog/pick-diet';
import { ConfigParamsService } from '../config-params/config-params.service';
import { exclusionKeys } from '../menu/exclusions';
import { PrismaService } from '../prisma/prisma.service';
import { calcolaPool, EsitoPool, raccontaPool, RicettaDelPool } from './pool-disponibile';
import { type ClienteDaContare, type EsitoConteggioPool, contaClientiSottoSoglia } from './clienti-pool-scoperto';
import { STATI_CON_UN_PIANO } from '../commerce/stati-abbonamento';
import { allargaAiGemelli } from '../common/slot-pasto';

/**
 * ⚠️ Un tetto dichiarato, non silenzioso. Serve a non far diventare pesante una lettura che sta
 * dentro l'apertura di una pagina: `esaminate` dice sempre quante ne ha davvero guardate, quindi
 * se un giorno il tetto viene toccato si vede dal numero invece che da una lentezza.
 */
const MASSIMO_CLIENTI_CONTATE = 500;

/** Il profilo, ridotto a ciò che serve per scegliere la dieta e costruire le esclusioni. */
interface ProfiloPool extends DietMatchProfile {
  allergies: string[];
  intolerances: string[];
  dislikedFoods: string[];
}

export interface AnteprimaPool {
  cliente: { id: string; nome: string | null };
  dieta: { id: string; nome: string } | null;
  prima: EsitoPool;
  dopo: EsitoPool;
  /** I termini davvero applicati in più, dopo l'espansione del dizionario. */
  aggiunti: string[];
  racconto: string;
}

@Injectable()
export class PoolDisponibileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
  ) {}

  /**
   * Cosa resterebbe alla cliente se si escludessero anche questi termini.
   *
   * `terminiInPiu` sono già risolti in alimenti veri da chi chiama (il dizionario traduce
   * «formaggi molli» nei nove nomi che la nutrizionista ha spuntato). Qui non si indovina niente:
   * arrivano nomi di alimento, si espandono con le stesse regole del motore, si contano i piatti.
   */
  async anteprima(clientId: string, terminiInPiu: string[] = []): Promise<AnteprimaPool> {
    const profilo = await this.profilo(clientId);
    const soglia = await this.configParams.getNumber('personal_base_min_recipes_per_slot', 3);

    const dieta = await this.dieta(profilo);
    const poolPerSlot = dieta ? await this.poolPerSlot(dieta.id) : new Map<string, RicettaDelPool[]>();

    const base = [...profilo.allergies, ...profilo.intolerances, ...profilo.dislikedFoods];
    const aggiunti = terminiInPiu.map((t) => (t ?? '').trim()).filter(Boolean);

    const prima = calcolaPool(poolPerSlot, exclusionKeys(base), soglia);
    const dopo = aggiunti.length
      ? calcolaPool(poolPerSlot, exclusionKeys([...base, ...aggiunti]), soglia)
      : prima;

    return {
      cliente: { id: clientId, nome: profilo.nome },
      dieta: dieta ? { id: dieta.id, nome: dieta.name } : null,
      prima,
      dopo,
      aggiunti,
      racconto: raccontaPool(prima, dopo),
    };
  }

  /**
   * Le stesse alternative che il messaggio propone come via d'uscita, cercate NEL CATALOGO.
   *
   * ⚠️ È il paletto che tiene in piedi la fiducia: se Vera propone «mozzarella senza lattosio» e in
   * catalogo non c'è, le ha offerto una porta che non si apre — e dopo due volte così la
   * nutrizionista smette di credere a quello che le dice. Quindi si cerca fra ciò che esiste, e se
   * non si trova niente si risponde con un elenco vuoto: sarà chi chiama a proporre «te ne creo di
   * nuove», che è un'azione, non un'invenzione.
   */
  async alternativeInCatalogo(clientId: string, slot: string, limite = 5): Promise<{ id: string; name: string }[]> {
    const profilo = await this.profilo(clientId);
    const dieta = await this.dieta(profilo);
    if (!dieta) return [];
    const pool = await this.poolPerSlot(dieta.id);
    const chiavi = exclusionKeys([...profilo.allergies, ...profilo.intolerances, ...profilo.dislikedFoods]);
    const esito = calcolaPool(new Map([[slot, pool.get(slot) ?? []]]), chiavi, 0);
    const tolti = new Set(esito.slots[0]?.tolti ?? []);
    return (pool.get(slot) ?? []).filter((r) => !tolti.has(r.name)).slice(0, limite).map((r) => ({ id: r.id, name: r.name }));
  }

  // ---------- lettura ----------

  /**
   * QUANTE CLIENTI HANNO IL POOL SOTTO SOGLIA — il modulo che mancava a «quello che aspetta me».
   *
   * ⚠️ **Il pool non è della cliente: è della DIETA.** Le esclusioni sono sue, il pool no — e le
   * diete sono poche. Si leggono i pool **una volta per dieta**, poi il conto per ogni cliente è
   * aritmetica in memoria (`clienti-pool-scoperto.ts`). È questo che rende la domanda «quante sono
   * scoperte?» una domanda che si può fare a ogni apertura della pagina, invece di un lavoro
   * notturno con un numero vecchio di ore.
   *
   * ⚠️ Solo le clienti con un abbonamento **attivo**: contare chi ha finito il percorso mesi fa
   * gonfierebbe il numero con persone a cui non stiamo erogando niente, e un numero gonfio è un
   * numero che si smette di guardare.
   */
  async quanteSottoSoglia(staffId: string | null, capo: boolean): Promise<EsitoConteggioPool> {
    const soglia = await this.configParams.getNumber('personal_base_min_recipes_per_slot', 3);
    const profili = (await this.prisma.clientProfile.findMany({
      where: {
        ...(capo || !staffId ? {} : { assignedNutritionistId: staffId }),
        // ⚠️ Anche la coda (voce 258): un pool sotto soglia va visto PRIMA che la cliente cominci,
      // che è l'unico momento in cui c'è ancora tempo per rimediare.
      user: { subscriptions: { some: { status: { in: [...STATI_CON_UN_PIANO] } } } as never },
      } as never,
      select: {
        userId: true, name: true, regime: true, dietStyle: true, dietFamily: true, mealsPerDay: true,
        objective: true, pathType: true, fastingWindow: true,
        allergies: true, intolerances: true, dislikedFoods: true,
      },
      take: MASSIMO_CLIENTI_CONTATE,
    })) as (ProfiloPool & { userId: string; name: string | null })[];

    /**
     * ⚠️ La dieta si sceglie con la stessa funzione dell'erogazione (`pickDietFor`), e il risultato
     * si tiene in cache per **profilo identico**: 315 clienti stanno su una manciata di diete, e
     * senza cache questa riga sarebbe 315 interrogazioni per un numero in un riquadro.
     */
    const cacheDiete = new Map<string, { id: string; name: string } | null>();
    const dietaDi = async (p: ProfiloPool): Promise<string | null> => {
      const chiave = JSON.stringify([p.regime, p.dietStyle, p.dietFamily, p.mealsPerDay, p.objective, p.pathType, p.fastingWindow]);
      if (!cacheDiete.has(chiave)) cacheDiete.set(chiave, await this.dieta(p));
      return cacheDiete.get(chiave)?.id ?? null;
    };

    const clienti: ClienteDaContare[] = [];
    for (const p of profili) {
      clienti.push({
        id: p.userId,
        nome: p.name,
        dietId: await dietaDi(p),
        chiaviEscluse: [...exclusionKeys([...p.allergies, ...p.intolerances, ...p.dislikedFoods])],
      });
    }

    const poolPerDieta = new Map<string, Map<string, RicettaDelPool[]>>();
    for (const dietId of new Set(clienti.map((c) => c.dietId).filter((d): d is string => !!d))) {
      poolPerDieta.set(dietId, await this.poolPerSlot(dietId));
    }

    return contaClientiSottoSoglia(clienti, poolPerDieta, soglia);
  }

  private async profilo(clientId: string): Promise<ProfiloPool & { nome: string | null }> {
    const p = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: {
        name: true,
        regime: true,
        dietStyle: true,
        dietFamily: true,
        mealsPerDay: true,
        objective: true,
        pathType: true,
        // Serve a `pickDietFor`: in digiuno il catalogo lo decide la finestra
        // (`struttura-per-digiuno.ts`). Senza, Vera guarderebbe il pool di una dieta che
        // all'erogazione non viene servita.
        fastingWindow: true,
        allergies: true,
        intolerances: true,
        dislikedFoods: true,
      },
    })) as (Record<string, unknown> & { name: string | null }) | null;
    if (!p) throw new NotFoundException('Profilo non trovato.');
    return {
      nome: p.name ?? null,
      regime: (p.regime as string | null) ?? null,
      dietStyle: (p.dietStyle as string | null) ?? null,
      dietFamily: (p.dietFamily as string | null) ?? null,
      mealsPerDay: (p.mealsPerDay as number | null) ?? null,
      objective: (p.objective as string | null) ?? null,
      pathType: (p.pathType as string | null) ?? null,
      fastingWindow: (p.fastingWindow as string | null) ?? null,
      allergies: ((p.allergies as string[]) ?? []),
      intolerances: ((p.intolerances as string[]) ?? []),
      dislikedFoods: ((p.dislikedFoods as string[]) ?? []),
    };
  }

  /** La stessa scelta che farebbe l'erogazione: `pickDietFor`, non una query scritta a mano. */
  private async dieta(profilo: DietMatchProfile): Promise<{ id: string; name: string } | null> {
    return pickDietFor<{ id: string; name: string }>(
      (where) =>
        this.prisma.diet.findFirst({
          where: where as never,
          orderBy: { approvedAt: 'desc' },
          select: { id: true, name: true },
        }) as Promise<{ id: string; name: string } | null>,
      profilo,
    );
  }

  /**
   * Le ricette che la dieta prevede, pasto per pasto.
   *
   * Si legge dai `DietDayTemplate` come fa `buildScoringContext`, e non dall'elenco delle ricette
   * per `mealSlot`: il pool della cliente è quello che la SUA dieta usa davvero, non tutto ciò che
   * in catalogo potrebbe stare a cena. Contare il secondo darebbe un numero più grande e più
   * rassicurante — e sbagliato.
   *
   * ⚠️ Livello 1 e basta. Il livello 2 non esiste (315 diete sono tutte a livello 1), e cercarlo
   * qui restituirebbe zero ricette facendo sembrare vuoto un pool pieno.
   */
  private async poolPerSlot(dietId: string): Promise<Map<string, RicettaDelPool[]>> {
    const templates = (await this.prisma.dietDayTemplate.findMany({
      where: { dietId, level: 1 },
      orderBy: { dayIndex: 'asc' },
      select: { meals: true },
    })) as { meals: unknown }[];

    const idsPerSlot = new Map<string, Set<string>>();
    for (const t of templates) {
      for (const m of ((t.meals as { slot: string; recipeId: string }[]) ?? [])) {
        if (!m?.slot || !m?.recipeId) continue;
        if (!idsPerSlot.has(m.slot)) idsPerSlot.set(m.slot, new Set());
        idsPerSlot.get(m.slot)!.add(m.recipeId);
      }
    }
    /**
     * ⚠️ **Fase 2 (1/9): spuntino e merenda pescano dallo stesso paniere**, e la soglia si misura
     * sul pool vero. Se qui restassero divisi, il controllo di Vera direbbe «restano 2 ricette per
     * la merenda» mentre la composizione ne ha 168 a disposizione — due verità sullo stesso dato,
     * che è esattamente quello che questo file esiste per non fare.
     */
    const perSlot = allargaAiGemelli(idsPerSlot);
    const tuttiGliId = [...new Set([...perSlot.values()].flatMap((s) => [...s]))];
    if (!tuttiGliId.length) return new Map();

    const ricette = (await this.prisma.recipe.findMany({
      where: { id: { in: tuttiGliId } },
      select: { id: true, name: true, ingredients: true },
    })) as RicettaDelPool[];
    const perId = new Map(ricette.map((r) => [r.id, r]));

    const out = new Map<string, RicettaDelPool[]>();
    for (const [slot, ids] of perSlot) {
      // Una ricetta cancellata dal catalogo sparisce dal pool invece di contare come disponibile:
      // il numero deve dire quanti piatti si possono servire, non quante righe c'erano nel modello.
      out.set(slot, [...ids].map((id) => perId.get(id)).filter((r): r is RicettaDelPool => !!r));
    }
    return out;
  }
}
