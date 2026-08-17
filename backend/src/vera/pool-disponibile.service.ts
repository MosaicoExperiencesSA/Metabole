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
    const tuttiGliId = [...new Set([...idsPerSlot.values()].flatMap((s) => [...s]))];
    if (!tuttiGliId.length) return new Map();

    const ricette = (await this.prisma.recipe.findMany({
      where: { id: { in: tuttiGliId } },
      select: { id: true, name: true, ingredients: true },
    })) as RicettaDelPool[];
    const perId = new Map(ricette.map((r) => [r.id, r]));

    const out = new Map<string, RicettaDelPool[]>();
    for (const [slot, ids] of idsPerSlot) {
      // Una ricetta cancellata dal catalogo sparisce dal pool invece di contare come disponibile:
      // il numero deve dire quanti piatti si possono servire, non quante righe c'erano nel modello.
      out.set(slot, [...ids].map((id) => perId.get(id)).filter((r): r is RicettaDelPool => !!r));
    }
    return out;
  }
}
