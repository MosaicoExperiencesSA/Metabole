/**
 * IL TAG `sett:N` DICE DOVE LA RICETTA È USATA. Punto.
 *
 * Simone, 11/8: «quel tag per me è dove viene utilizzato, non mi interessa quando è stato creato».
 * Ha ragione, e prima non era così: il tag veniva scritto **alla nascita** della ricetta e registrava
 * in quale generazione era stata prodotta. Quindi un piatto creato generando la settimana 1 e poi
 * usato nella settimana 2 continuava a portare `sett:1` per sempre — e chi guardava il catalogo
 * leggeva «tutte nella prima settimana» su una dieta che invece era distribuita su due.
 *
 * Un'etichetta che dice una cosa diversa da quella che sembra dire è peggio di un'etichetta assente:
 * ci si costruiscono sopra dei ragionamenti, e infatti è successo.
 *
 * ## La verità sta nelle giornate
 *
 * Chi decide in che settimana sta un piatto è la **giornata** che lo usa: `dayIndex` 1-7 = settimana
 * 1, 8-14 = settimana 2, e così via. Questo file legge quelle e riscrive i tag di conseguenza.
 *
 * Una ricetta può stare in **più settimane** — succede quando il ciclo la ripropone — e allora porta
 * più tag (`sett:1`, `sett:3`). Non è un caso da nascondere: è il modo più rapido di vedere se il
 * ciclo si ripete invece di allungarsi.
 *
 * E può stare in **nessuna**: sono le ricette orfane, generate e fuori dal ciclo. Quelle perdono ogni
 * `sett:*` invece di tenere quello vecchio, perché «settimana 1» su un piatto che nessuna giornata
 * usa è esattamente l'informazione falsa da cui è nato tutto questo.
 *
 * ## L'unione fra le varianti sorelle
 *
 * Le varianti di una famiglia (3 pasti, 5 pasti, digiuno) **condividono** le ricette. La stessa
 * ricetta può quindi stare nella settimana 1 di una variante e nella 2 di un'altra: il tag è uno solo
 * per ricetta, quindi porta l'unione. Contarle per una dieta sola darebbe un tag che cambia a seconda
 * di chi lo guarda.
 */
import type { PrismaService } from '../prisma/prisma.service';

const GIORNI_SETTIMANA = 7;
const PREFISSO = 'sett:';

export const tagSettimana = (settimana: number): string => `${PREFISSO}${settimana}`;

/** Vero se questo tag è uno di quelli che questo file gestisce. */
export const eTagSettimana = (tag: string): boolean => tag.startsWith(PREFISSO);

/**
 * In quali settimane è usata ogni ricetta, letto dalle giornate di **tutto** il catalogo.
 *
 * Si legge tutto perché le varianti sorelle condividono le ricette (vedi il commento in testa): la
 * risposta per una singola dieta sarebbe una mezza verità.
 */
export async function settimaneDiUtilizzo(prisma: PrismaService): Promise<Map<string, number[]>> {
  const giorni = (await prisma.dietDayTemplate.findMany({
    select: { dayIndex: true, meals: true },
  })) as { dayIndex: number; meals: unknown }[];

  const per = new Map<string, Set<number>>();
  for (const g of giorni) {
    const settimana = Math.max(1, Math.ceil((g.dayIndex ?? 1) / GIORNI_SETTIMANA));
    for (const m of (Array.isArray(g.meals) ? g.meals : []) as { recipeId?: unknown }[]) {
      if (typeof m?.recipeId !== 'string' || !m.recipeId) continue;
      const viste = per.get(m.recipeId) ?? new Set<number>();
      viste.add(settimana);
      per.set(m.recipeId, viste);
    }
  }
  return new Map([...per].map(([id, viste]) => [id, [...viste].sort((a, b) => a - b)]));
}

export interface EsitoSincronizzazione {
  /** Ricette il cui elenco di tag `sett:*` è stato corretto. */
  corrette: number;
  /** Ricette che erano già a posto. */
  giaGiuste: number;
  /** Ricette che nessuna giornata usa e che avevano un `sett:*` da togliere. */
  orfaneRipulite: number;
}

/**
 * Riscrive i tag `sett:*` di tutte le ricette in base alle giornate. Non tocca gli altri tag.
 *
 * `soloRicette` limita il lavoro (usato dal generatore, che sa quali ha appena toccato); senza, passa
 * su tutto il catalogo — è il caso della correzione una-tantum.
 */
export async function sincronizzaTagSettimane(
  prisma: PrismaService,
  soloRicette?: string[],
): Promise<EsitoSincronizzazione> {
  const usi = await settimaneDiUtilizzo(prisma);
  const ricette = (await prisma.recipe.findMany({
    where: soloRicette?.length ? { id: { in: soloRicette } } : {},
    select: { id: true, tags: true },
  })) as { id: string; tags: string[] }[];

  let corrette = 0;
  let giaGiuste = 0;
  let orfaneRipulite = 0;

  for (const r of ricette) {
    const attuali = r.tags ?? [];
    const altri = attuali.filter((t) => !eTagSettimana(t));
    const settimane = usi.get(r.id) ?? [];
    const nuovi = [...altri, ...settimane.map(tagSettimana)];

    // Confronto sull'insieme, non sull'ordine: riordinare i tag non è una correzione.
    const prima = [...attuali].sort().join('|');
    const dopo = [...nuovi].sort().join('|');
    if (prima === dopo) { giaGiuste += 1; continue; }

    await prisma.recipe.update({ where: { id: r.id }, data: { tags: nuovi } });
    corrette += 1;
    if (settimane.length === 0 && attuali.some(eTagSettimana)) orfaneRipulite += 1;
  }

  return { corrette, giaGiuste, orfaneRipulite };
}
