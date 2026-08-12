/**
 * «QUAL È LA DIETA ASSEGNATA A QUESTA CLIENTE?» — una domanda, una risposta.
 *
 * Decisione di Simone (12/8): «la cliente usa la stessa ricerca dello staff».
 *
 * ## Il difetto da cui nasce
 *
 * L'11/8, dal caso Cristina Urbani, la scheda del backoffice è stata corretta: cercava la dieta
 * `findFirst({ where: { name: dietFamily } })` — **per nome e basta** — e una famiglia ha fino a
 * diciotto varianti che condividono il nome e si distinguono per regime, stile, obiettivo e pasti.
 * Quella query pescava la prima che capitava.
 *
 * ⚠️ La correzione è stata applicata **solo al lato staff**. In `profile.service.nutrition` — la
 * risposta che legge la **cliente**, nel suo Profilo — la riga sbagliata è rimasta:
 *
 * ```ts
 * diet.findFirst({ where: { name: profile.dietFamily, status: 'approved' } })
 * ```
 *
 * Stessa trappola, schermata diversa. E dalla stessa riga non esce solo il nome: escono anche lo
 * **stile** (`dietStyleAssegnato`, che apre la scheda «cos'è la tua dieta» in app) e la
 * **descrizione** (`dietDescription`, il «?» accanto al nome). Una cliente onnivora a 5 pasti
 * poteva quindi leggere la descrizione — e aprire la scheda — della variante **vegana a 3 pasti**
 * della stessa famiglia, che è una dieta che non ha mai visto.
 *
 * ## Le due diete, e perché sono due
 *
 * - **variante esatta**: la dieta che il profilo descrive (nome + stile + regime + pasti);
 * - **dieta servita**: quella che l'erogazione sceglierebbe adesso, con la stessa `pickDietFor` del
 *   motore dei menu.
 *
 * Se la variante esatta esiste le due coincidono. Se non esiste, il motore ripiega — e la
 * differenza fra le due è precisamente l'informazione che serve al nutrizionista (`scostamentoDieta`).
 * Alla cliente si mostra `varianteEsatta ?? dietaServita`: mai `null` quando in catalogo c'è
 * qualcosa di servibile, mai una variante a caso.
 */
import { pickDietFor, type DietMatchProfile } from './pick-diet';
import type { PrismaService } from '../prisma/prisma.service';

/** I campi della dieta che servono a entrambe le schermate. */
export const SELECT_DIETA_MOSTRATA = {
  id: true,
  name: true,
  clientName: true,
  clientDescription: true,
  style: true,
  status: true,
  regime: true,
  mealsPerDay: true,
} as const;

export interface DietaMostrata {
  id: string;
  name: string;
  clientName: string | null;
  clientDescription: string | null;
  style: string | null;
  status: string;
  regime: string | null;
  mealsPerDay: number | null;
}

/**
 * Prisma si passa come argomento invece di iniettarlo: `ClientsService` e `ProfileService` stanno
 * in due moduli diversi, e una funzione libera li serve entrambi senza creare un ciclo fra moduli.
 * Nei test si passa un finto di tre righe con `as unknown as PrismaService`.
 */
export type CatalogoDiete = Pick<PrismaService, 'diet'>;

export interface EsitoDietaMostrata {
  /** La variante che il profilo descrive per intero. `null` se in catalogo non esiste. */
  varianteEsatta: DietaMostrata | null;
  /** Quella che il motore servirebbe adesso, ripieghi compresi. */
  dietaServita: DietaMostrata | null;
  /** Quella da far vedere: la variante esatta se c'è, altrimenti quella davvero servita. */
  dietaMostrata: DietaMostrata | null;
  /**
   * Come si chiama, per la cliente. Il `clientName` vince sul nome interno; se in catalogo non
   * c'è niente resta il nome scritto sul profilo (dieta rinominata o cancellata: va detto, non
   * nascosto — il motore cercherà quel nome e non lo troverà).
   */
  nome: string | null;
}

/** Il nome che si mostra: quello scritto per la cliente, se c'è. */
export function nomePerLaCliente(d: { name: string; clientName: string | null } | null): string | null {
  return d ? d.clientName || d.name : null;
}

export async function dietaMostrataPer(
  prisma: CatalogoDiete,
  profilo: DietMatchProfile,
): Promise<EsitoDietaMostrata> {
  const famiglia = profilo.dietFamily ?? null;

  const [varianteEsatta, dietaServita] = await Promise.all([
    famiglia && profilo.regime && profilo.mealsPerDay
      ? (prisma.diet.findFirst({
          where: {
            name: famiglia,
            regime: profilo.regime,
            mealsPerDay: profilo.mealsPerDay,
            ...(profilo.dietStyle ? { style: profilo.dietStyle } : {}),
          } as never,
          // Approvata per prima: se esiste anche una bozza con lo stesso nome, è quella approvata
          // a raccontare la dieta vera. ('approved' < 'draft' in ordine alfabetico.)
          orderBy: { status: 'asc' },
          select: SELECT_DIETA_MOSTRATA,
        }) as Promise<DietaMostrata | null>)
      : Promise.resolve(null),
    pickDietFor<DietaMostrata>(
      (where) =>
        prisma.diet.findFirst({
          where: where as never,
          orderBy: { approvedAt: 'desc' },
          select: SELECT_DIETA_MOSTRATA,
        }) as Promise<DietaMostrata | null>,
      profilo,
    ),
  ]);

  const dietaMostrata = varianteEsatta ?? dietaServita;
  return {
    varianteEsatta,
    dietaServita,
    dietaMostrata,
    nome: nomePerLaCliente(dietaMostrata) ?? famiglia,
  };
}
