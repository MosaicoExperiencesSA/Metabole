/**
 * DOVE UNA RICETTA È USATA: da quali diete, e in che settimane del ciclo.
 *
 * Serve alle colonne «Dieta» e «Settimana n.» del catalogo ricette (richiesta di Simone dell'11/8:
 * «togli la colonna TAG, inserisci la colonna dieta e la colonna settimana n.»). Le due colonne
 * hanno preso il posto dei tag `dieta:<nome>` e `sett:N`, e non è un cambio di vestito: quei tag
 * rispondono a un'altra domanda.
 *
 * ## Perché non i tag
 *
 * `dieta:<nome>` lo scrive il generatore **alla nascita** della ricetta e registra per quale famiglia
 * è stata generata. Quando un'altra dieta riusa quel piatto — cosa che il generatore fa apposta,
 * perché sono piatti già pagati e spesso già corretti a mano — il tag non cambia. Quindi dice dov'è
 * *nata*, non dov'è *usata*, e su un catalogo che riusa molto sono due elenchi diversi.
 *
 * `sett:N` aveva lo stesso difetto, ed è già costato una diagnosi sbagliata («le mette tutte nella
 * prima settimana» su una dieta distribuita su due). Dall'11/8 lo si riallinea alle giornate, ma
 * resta un dato **copiato**: si disallinea a ogni modifica delle giornate fatta fuori dal generatore,
 * e sui dati esistenti la correzione va ancora lanciata (`npm run fix:tag-settimane`).
 *
 * Qui la domanda si fa direttamente a chi conosce la risposta — le giornate — a ogni richiesta.
 *
 * ## Perché in SQL
 *
 * `Recipe` non ha un `dietId`: il legame vive in `DietDayTemplate.meals`, un JSON che Prisma non sa
 * interrogare. Leggerle tutte in memoria vorrebbe dire portarsi a Node decine di migliaia di righe
 * di JSON a ogni ricerca — e tenerle in una cache, cioè introdurre un dato vecchio proprio nella
 * colonna nata per non mostrarne uno falso (per giunta inservibile: il backend gira su **due**
 * istanze, e due cache indipendenti non ritardano, oscillano).
 *
 * `CROSS JOIN LATERAL jsonb_array_elements` apre l'array dei pasti e restituisce **solo** le righe
 * delle ricette che la pagina sta mostrando. È lo stesso schema già usato in
 * `engine-rules/copertura-catalogo.ts`.
 */

import { Prisma } from '@prisma/client';

/** Giorni per settimana. Nella query il 7 è scritto a mano: vedi il commento accanto al `SELECT`. */
export const GIORNI_SETTIMANA = 7;

/** Una dieta che usa la ricetta, e in quali settimane del suo ciclo. */
export interface UsoInDieta {
  dieta: string;
  settimane: number[];
}

/** Il minimo di Prisma che serve qui: la query cruda. Così è mockabile nei test. */
export interface PrismaQuery {
  $queryRaw(strings: TemplateStringsArray, ...valori: unknown[]): Promise<unknown>;
}

/**
 * Per ognuna delle ricette richieste, le diete che la usano e le settimane in cui compare.
 *
 * Una ricetta assente dalla mappa è **orfana**: nessuna giornata la usa. È lavoro generato, pagato e
 * riletto che nessuna cliente vedrà mai, ed è la cosa che più conviene poter cercare.
 *
 * ⚠️ Le diete **archiviate** non contano. `archiveDiet` mette la dieta a `rejected` e le toglie dalla
 * vista di clienti e sito, ma **non cancella le sue giornate**: contandole, una ricetta usata solo da
 * una dieta ritirata risulterebbe «in uso» e non comparirebbe mai fra le orfane — cioè la colonna
 * mancherebbe proprio la classe di ricette che l'archiviazione produce.
 */
export async function utilizzoDelleRicette(
  prisma: PrismaQuery,
  recipeIds: string[],
): Promise<Map<string, UsoInDieta[]>> {
  const out = new Map<string, UsoInDieta[]>();
  if (recipeIds.length === 0) return out;

  /**
   * ⚠️ IL `7` È SCRITTO NELLA QUERY, NON INTERPOLATO.
   *
   * Scritto come `${GIORNI_SETTIMANA}` diventava un **parametro**, e Prisma manda i numeri
   * JavaScript come `double precision`: la divisione fra interi — quella che fa dare 1 ai giorni
   * 1-7 e 2 agli 8-14 — diventava una divisione con la virgola, e il giorno 3 finiva nella
   * settimana 1,2857. Un parametro al posto di una costante cambia il **tipo**, e col tipo cambia
   * il significato dell'operatore.
   *
   * `jsonb_typeof(...) = 'array'`: senza, una giornata con `meals` guasto (null, o un oggetto)
   * farebbe fallire `jsonb_array_elements` e con lei l'intero elenco ricette. Il caso non dovrebbe
   * esistere, e proprio per questo non deve poter buttare giù una pagina.
   *
   * `IN (${'${Prisma.join(...)}'})` e non `= ANY($1::text[])`: è la forma documentata da Prisma per
   * un elenco di valori, e manda ogni id come parametro suo invece di affidarsi a come il driver
   * decide di serializzare un array.
   */
  const righe = (await prisma.$queryRaw`
    SELECT (m->>'recipeId') AS "recipeId",
           d.name AS dieta,
           ARRAY_AGG(DISTINCT (((t.day_index - 1) / 7) + 1)
                     ORDER BY (((t.day_index - 1) / 7) + 1)) AS settimane
    FROM diet_day_template t
    JOIN diet d ON d.id = t.diet_id
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(t.meals) = 'array' THEN t.meals ELSE '[]'::jsonb END
    ) AS m
    WHERE d.status::text <> 'rejected'
      AND (m->>'recipeId') IN (${Prisma.join(recipeIds)})
    GROUP BY 1, 2
    ORDER BY 2
  `) as { recipeId: string | null; dieta: string; settimane: unknown }[];

  for (const r of righe) {
    if (!r.recipeId) continue;
    const usi = out.get(r.recipeId) ?? [];
    // `Math.round` come rete: se un giorno la settimana tornasse con la virgola (è già successo,
    // vedi sopra), meglio una settimana intera sbagliata di poco che «1.2857» in colonna.
    const settimane = (Array.isArray(r.settimane) ? r.settimane : [])
      .map((n) => Math.round(Number(n)))
      .filter((n) => Number.isFinite(n));
    usi.push({ dieta: r.dieta, settimane });
    out.set(r.recipeId, usi);
  }
  return out;
}

/** Le settimane in cui la ricetta compare, unendo tutte le diete che la usano. */
export const settimaneDiTutte = (usi: UsoInDieta[]): number[] =>
  [...new Set(usi.flatMap((u) => u.settimane))].sort((a, b) => a - b);
