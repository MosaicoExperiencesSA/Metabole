import { Injectable } from '@nestjs/common';
import { SOLO_STELLE_DATE } from '../menu/stelle-che-contano';
import { etichettaMetodo } from '../common/metodi-cottura';
import { cottureDelCiclo, esitoPrecedenteInItaliano } from './ciclo-per-la-cliente';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';

// Stati contestuali del ciclo (R11). Qui vive lo stato (D4); E5 lo modula sui segnali.
export const CYCLE_STATES = ['normale', 'conforto', 'rientro', 'pre_evento', 'post_evento', 'plateau'] as const;
export type CycleState = (typeof CYCLE_STATES)[number];

// Metodi di cottura (R5/R6): a parità di kcal, due preparazioni diverse nel ciclo.
// L'elenco NON sta più qui: vedi `common/metodi-cottura.ts`, che è l'unico posto che decide.

export interface MealSnapshot {
  slot: string;
  recipeId: string;
  name?: string;
  kcal?: number;
}

/**
 * R10 — Ciclo bigiornaliero attivo. Il socio già EROGA il menu 2 giorni alla volta
 * (`MenuService` → `MenuDay`) e CHIUDE il ciclo al 2° giorno (`DietLearningService` →
 * `CycleFeedback` + learning). Qui manca il pezzo "cosa sta mangiando ORA": questo
 * servizio materializza il **ciclo attivo** (`ClientCycle`) dalle giornate erogate —
 * finestra di 2 giorni, le **2 cotture** (stessa kcal, preparazioni diverse) e lo
 * **stato contestuale** (ancora per R11) — e calcola il **gradimento del ciclo**
 * (regola R10: il menu vale il MASSIMO delle stelle delle sue ricette, default 5★).
 * Additivo: legge i `MenuDay` esistenti, non tocca l'erogazione né la chiusura.
 */
@Injectable()
export class CycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
  ) {}

  /**
   * Ciclo attivo del cliente (le ultime N giornate erogate = finestra corrente), **e lo materializza**
   * in `ClientCycle`.
   *
   * ⚠️ **È un GET che scrive**, e questa riga esiste per dirlo. Fino al 19/8 era l'unica versione, e
   * non lo chiamava nessuno: la scrittura aveva frequenza zero. Collegandoci l'app sarebbe diventata
   * **una scrittura a ogni apertura della schermata** — idempotente, quindi non sporca i dati, ma una
   * schermata che scrive quando la guardi è una cosa che si scopre sempre nel momento sbagliato.
   *
   * Quindi la lettura si è separata (`leggiCicloAttivo`) e la cliente passa da lì. Qui resta chi ha
   * bisogno che la riga **esista**: lo staff, che sul ciclo ci lavora.
   */
  async getActiveCycle(clientId: string) {
    return this.cicloAttivo(clientId, true);
  }

  /**
   * LA STESSA LETTURA, SENZA SCRIVERE NIENTE — la strada della cliente (19/8).
   *
   * ⚠️ Non è una copia: è **la stessa funzione** con la scrittura spenta. Due letture che ricostruiscono
   * il ciclo in due modi sarebbero due risposte alla stessa domanda, ed è il difetto che questo
   * progetto ha smesso di fare.
   */
  async leggiCicloAttivo(clientId: string) {
    return this.cicloAttivo(clientId, false);
  }

  private async cicloAttivo(clientId: string, materializza: boolean) {
    const daysPerCycle = await this.configParams.getNumber('menu_days_delivered', 2);
    const days = (await this.prisma.menuDay.findMany({
      where: { clientId },
      orderBy: { date: 'desc' },
      take: daysPerCycle,
      select: { date: true, dietId: true, level: true, meals: true },
    })) as unknown as { date: Date; dietId: string; level: number; meals: unknown }[];

    if (!days.length) {
      return { active: false as const, message: 'Nessun ciclo attivo: il menu non è ancora stato erogato.' };
    }

    const cycleEnd = days[0].date;
    const cycleStart = days[days.length - 1].date;
    const dietId = days[0].dietId;

    // Ricette del ciclo (dedup) per cotture e gradimento.
    const recipeIds = new Set<string>();
    for (const d of days) for (const m of (d.meals as MealSnapshot[]) ?? []) if (m?.recipeId) recipeIds.add(m.recipeId);
    const ids = [...recipeIds];

    const [cooking, gradimento, existing, lastOutcome] = await Promise.all([
      this.pickTwoCookings(ids),
      // ⚠️ Il gradimento serve al motore e allo staff, non alla cliente — e `cicloPerLaCliente` lo
      // scarta. Calcolarlo lo stesso vorrebbe dire due query (un parametro e le valutazioni) a ogni
      // apertura del Menu, per un numero che nessuno legge.
      materializza ? this.menuGradimento(clientId, ids) : Promise.resolve(null),
      this.prisma.clientCycle.findFirst({ where: { clientId, cycleEnd } as never }) as Promise<{ id: string; state: string } | null>,
      this.prisma.cycleFeedback.findFirst({
        where: { clientId },
        orderBy: { cycleEnd: 'desc' },
        select: { esitoPeso: true, esitoCm: true, followed: true, cycleEnd: true },
      }) as Promise<{ esitoPeso: string; esitoCm: string; followed: boolean; cycleEnd: Date } | null>,
    ]);

    // Lo stato si conserva tra le riletture dello stesso ciclo (default 'normale').
    const state = (existing?.state as CycleState) ?? 'normale';
    if (materializza) {
      const data = {
        clientId, dietId, cycleStart, cycleEnd,
        cookingG1: cooking.g1, cookingG2: cooking.g2, state, status: 'active',
      };
      if (existing) {
        await this.prisma.clientCycle.update({ where: { id: existing.id }, data: { ...data } as never });
      } else {
        await this.prisma.clientCycle.create({ data: data as never });
      }
    }

    return {
      active: true as const,
      cycleStart,
      cycleEnd,
      state,
      cooking: {
        g1: cooking.g1, g2: cooking.g2,
        g1Label: etichettaMetodo(cooking.g1),
        g2Label: etichettaMetodo(cooking.g2),
        // ⚠️ Quelle dichiarate davvero dalle ricette del ciclo: vedi `pickTwoCookings`.
        vere: cooking.vere,
      },
      gradimento, // max stelle del ciclo (default 5)
      // ⚠️ `cycleEnd` viaggia con l'esito: senza, chi lo mostra non può sapere **di quale ciclo**
      // parla — e il feedback più recente può essere quello dei giorni che sta guardando adesso.
      lastOutcome: lastOutcome
        ? { esitoPeso: lastOutcome.esitoPeso, esitoCm: lastOutcome.esitoCm, followed: lastOutcome.followed, cycleEnd: lastOutcome.cycleEnd }
        : null,
      days: days.map((d) => ({ date: d.date, meals: (d.meals as MealSnapshot[]) ?? [] })),
    };
  }

  /**
   * QUELLO CHE VEDE LA CLIENTE DEL SUO CICLO — e nient'altro (19/8).
   *
   * ⚠️ Non è `getActiveCycle` con qualche campo in meno: **non scrive** (vedi `leggiCicloAttivo`) e
   * ⚠️ **non manda il `gradimento`**, che non è il gradimento — è il minimo del massimo delle stelle
   * con default 5 per le ricette mai valutate. Mostrarlo a chi non ha votato niente sarebbe il
   * difetto delle stelle inventate (voce 270) rifatto in una schermata.
   *
   * Restano le due cose che a lei servono davvero: **le cotture di questi giorni**, che è quello che
   * cambia cosa fa in cucina e che oggi non le dice nessuno, e **com'è andato il ciclo appena
   * chiuso**, in una riga di italiano.
   */
  async cicloPerLaCliente(clientId: string): Promise<{
    attivo: boolean;
    dal: string | null;
    al: string | null;
    cotture: { tipo: string; etichetta: string }[];
    esitoPrecedente: { riga: string; seguito: boolean } | null;
  }> {
    const [ciclo, giorniDelCiclo] = await Promise.all([
      this.leggiCicloAttivo(clientId),
      // ⚠️ «Nei due giorni precedenti» non si scrive a mano: la finestra è `menu_days_delivered`, e
      // sta nei Parametri perché un giorno potrebbe non essere due.
      this.configParams.getNumber('menu_days_delivered', 2),
    ]);
    if (!ciclo.active) return { attivo: false, dal: null, al: null, cotture: [], esitoPrecedente: null };
    return {
      attivo: true,
      dal: ciclo.cycleStart.toISOString().slice(0, 10),
      al: ciclo.cycleEnd.toISOString().slice(0, 10),
      // ⚠️ Solo le cotture VERE: un ripiego diventerebbe una frase inventata sotto gli occhi di chi
      // sta per cucinare (vedi `pickTwoCookings`).
      cotture: cottureDelCiclo(ciclo.cooking.vere[0], ciclo.cooking.vere[1]),
      // ⚠️ E l'esito solo se è davvero **precedente**: vedi `esitoPrecedenteInItaliano`.
      esitoPrecedente: esitoPrecedenteInItaliano(ciclo.lastOutcome, ciclo.cycleStart, giorniDelCiclo),
    };
  }

  /**
   * Regola gradimento R10: il gradimento di un menu è il MASSIMO delle stelle date
   * alle sue ricette (non la media); se una ricetta non è ancora stata valutata vale
   * il default (5★, ottimista). Il gradimento del ciclo è il minimo tra i menu — cioè
   * il "pasto peggiore" traina, per non ripetere ciò che non piace.
   */
  async menuGradimento(clientId: string, recipeIds: string[]): Promise<number> {
    const def = await this.configParams.getNumber('cycle_default_rating', 5);
    if (!recipeIds.length) return def;
    /**
     * ⚠️ Solo le stelle DATE (decisione della notte del 18/8). Il 3 che l'app scrive quando la
     * cliente tocca solo «Seguita / Non seguita» è un valore di scorta, non un giudizio: qui
     * abbassava il gradimento del ciclo — o lo teneva alto — al posto suo. Vedi
     * `menu/stelle-che-contano.ts`.
     */
    const ratings = (await this.prisma.recipeRating.findMany({
      where: { clientId, recipeId: { in: recipeIds }, ...SOLO_STELLE_DATE },
      select: { recipeId: true, stars: true },
    })) as { recipeId: string; stars: number }[];
    const maxByRecipe = new Map<string, number>();
    for (const r of ratings) maxByRecipe.set(r.recipeId, Math.max(maxByRecipe.get(r.recipeId) ?? 0, r.stars));
    // Ogni ricetta = max delle sue stelle (default se mai valutata); il ciclo = il minimo tra queste.
    let cycleMin = def;
    for (const id of recipeIds) {
      const v = maxByRecipe.get(id) ?? def;
      if (v < cycleMin) cycleMin = v;
    }
    return cycleMin;
  }

  /** Due cotture diverse (a parità di kcal) tra quelle disponibili sulle ricette del ciclo. */
  /**
   * Le due cotture del ciclo. ⚠️ `g1`/`g2` hanno un **ripiego** («veloce» e «al forno») quando le
   * ricette non dichiarano nessun metodo: serve alla riga di `ClientCycle`, che vuole due valori.
   *
   * ⚠️ **`vere` dice se sono cotture o un ripiego**, e non è un dettaglio: da quando la scheda del
   * Menu le mostra alla cliente, un ripiego diventerebbe la frase «in questi giorni si cucina veloce
   * e al forno» costruita **da un default** — esattamente il difetto delle stelle inventate (voce
   * 270), rifatto in una schermata. Chi parla a lei mostra le cotture solo se `vere`.
   */
  private async pickTwoCookings(recipeIds: string[]): Promise<{ g1: string; g2: string; vere: string[] }> {
    if (!recipeIds.length) return { g1: 'veloce', g2: 'forno', vere: [] };
    const recipes = (await this.prisma.recipe.findMany({
      where: { id: { in: recipeIds } },
      select: { cookingMethods: true },
    })) as unknown as { cookingMethods: unknown }[];
    const types: string[] = [];
    for (const r of recipes) {
      for (const cm of (r.cookingMethods as { type?: string }[]) ?? []) {
        if (cm?.type && !types.includes(cm.type)) types.push(cm.type);
      }
    }
    const g1 = types[0] ?? 'veloce';
    const g2 = types[1] ?? (g1 === 'veloce' ? 'forno' : 'veloce');
    // Al massimo due: sono «le due cotture del ciclo», non l'elenco di tutti i metodi del catalogo.
    return { g1, g2, vere: types.slice(0, 2) };
  }
}
