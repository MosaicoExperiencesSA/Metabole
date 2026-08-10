/**
 * COPERTURA DEL CATALOGO — quante colazioni, quanti pranzi, quante cene ha ogni variante.
 *
 * Richiesta di Simone dell'11/8: «crea una tabella con tutti i tipi, con le colonne n pranzi, n cene,
 * n merende, n spuntini, così a colpo d'occhio capiamo dove siamo». Nasce da un problema più grosso —
 * «dice settimana creata e validata, poi ci torno sopra ed è vuota» — e la prima cosa che serve non è
 * una correzione: è **guardare il database** e sapere se i piatti ci sono o no. Le due ipotesi (si
 * scrive male, oppure si legge male) portano a correzioni opposte, e finché non si distinguono si
 * lavora a caso.
 *
 * ## Le tre colonne che rispondono alla domanda
 *
 * Per ogni pasto di ogni variante si contano **tre** numeri diversi, e la differenza fra loro è la
 * diagnosi:
 *
 *  - **piatti** — i piatti distinti che le giornate di quella variante nominano;
 *  - **attivi** — quanti di quei piatti sono `active: true`, cioè quanti il motore userebbe davvero.
 *    Un piatto generato nasce in bozza e diventa attivo solo con la validazione: `piatti` alto e
 *    `attivi` a zero vuol dire «generata ma non validata», e da fuori si vede come una settimana
 *    vuota;
 *  - **rotti** — riferimenti a ricette che **non esistono più**. Le giornate tengono i piatti in un
 *    campo JSON, quindi non c'è nessun vincolo del database che impedisca di cancellare una ricetta
 *    ancora nominata da una giornata: quando succede, la giornata resta ma il pasto è un buco. È il
 *    candidato numero uno per «l'ho creata e poi era vuota», e prima di questa query non c'era modo
 *    di vederlo.
 *
 * ## GUARDARE DENTRO UNA SETTIMANA (11/8)
 *
 * Simone: «devo poter filtrare la settimana 1, poi la 2, ecc.». La prima versione aveva capito male e
 * aveva messo un filtro sul **numero** di settimane presenti («mostrami le varianti che ne hanno 2»),
 * che risponde a un'altra domanda: quella dice chi è rimasto indietro, non com'è fatta la settimana 3.
 *
 * Con `settimana = N` i conteggi si fanno **solo sulle giornate di quella settimana** (`day_index` da
 * `(N-1)*7+1` a `N*7`). Cambia anche il metro: l'atteso per pasto non è più 7 × le settimane presenti
 * ma **7**, cioè una settimana senza ripetizioni. È il modo di vedere una cosa che il totale nasconde:
 * una variante con 84 piatti per pasto sembra perfetta, ma se 20 stanno nella settimana 1 e 2 nella
 * settimana 6 il ciclo è sbilanciato — ed è esattamente il sospetto da cui è partita la richiesta.
 *
 * Le settimane si contano **sempre** su tutto (la colonna «Settimane» resta il totale della variante):
 * dentro un filtro sulla settimana 3, sapere che la variante arriva alla 4 è il contesto che serve per
 * capire se il buco è un buco o è la fine del catalogo.
 *
 * ## Perché conta il database e non il codice
 *
 * I piatti di una giornata stanno in `diet_day_template.meals`, un array JSON. Leggere tutte le
 * giornate di tutte le varianti per contarli in memoria vorrebbe dire migliaia di righe a ogni
 * apertura della pagina — ed è lo stesso errore per cui il funnel del lancio sottostimava. Qui
 * `jsonb_array_elements` apre l'array dentro Postgres e i conteggi li fa lui.
 */

/** Il minimo del client Prisma che serve: così è testabile con un oggetto finto. */
export interface PrismaPerCopertura {
  $queryRaw(strings: TemplateStringsArray, ...valori: unknown[]): Promise<unknown>;
}

/** I cinque pasti possibili, nell'ordine della giornata. */
export const SLOT_ORDINE = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'] as const;
export type Slot = (typeof SLOT_ORDINE)[number];

export interface ConteggioPasto {
  piatti: number;
  attivi: number;
  rotti: number;
}

export interface CoperturaVariante {
  dietId: string;
  giorni: number;
  ultimoGiorno: number;
  /** Settimane coperte = giorno più alto diviso sette, arrotondato per eccesso. Sempre sul totale. */
  settimane: number;
  /**
   * Giornate dentro la finestra guardata. Senza filtro è uguale a `giorni`; con `settimana = N` dice
   * quante giornate ha quella settimana — ed è quello che distingue «settimana mai generata» da
   * «settimana generata e vuota di piatti».
   */
  giorniSettimana: number;
  /** Conteggi per pasto, sulla finestra guardata (tutto il catalogo, o una sola settimana). */
  perSlot: Record<string, ConteggioPasto>;
}

const GIORNI_SETTIMANA = 7;
/** Estremo superiore quando non si filtra: più alto di qualunque `day_index` reale. */
const SENZA_LIMITE = 1_000_000;

/** Il primo e l'ultimo `day_index` della settimana chiesta; tutto il catalogo se non è chiesta. */
export function finestraGiorni(settimana?: number | null): { da: number; a: number } {
  if (!settimana || !Number.isFinite(settimana) || settimana < 1) return { da: 1, a: SENZA_LIMITE };
  const n = Math.floor(settimana);
  return { da: (n - 1) * GIORNI_SETTIMANA + 1, a: n * GIORNI_SETTIMANA };
}

export async function coperturaCatalogo(
  prisma: PrismaPerCopertura,
  settimana?: number | null,
): Promise<Map<string, CoperturaVariante>> {
  const { da, a } = finestraGiorni(settimana);

  const [giornate, pasti] = (await Promise.all([
    /**
     * Due conteggi in una query: le giornate **totali** (da cui le settimane della variante) e quelle
     * dentro la finestra. Servono insieme: senza il totale, filtrando la settimana 3 non si saprebbe
     * se la variante finisce alla 2 o se la 3 è generata e vuota.
     */
    prisma.$queryRaw`
      SELECT diet_id AS "dietId",
             COUNT(*)::int AS giorni,
             MAX(day_index)::int AS "ultimoGiorno",
             COUNT(*) FILTER (WHERE day_index BETWEEN ${da} AND ${a})::int AS "giorniSettimana"
      FROM diet_day_template
      GROUP BY diet_id
    `,
    /**
     * `CROSS JOIN LATERAL jsonb_array_elements(t.meals)` apre l'array dei pasti di ogni giornata e
     * produce una riga per pasto: da lì i conteggi sono un normale `GROUP BY`.
     *
     * `LEFT JOIN recipe`: il join deve essere ESTERNO, altrimenti i riferimenti rotti — quelli che
     * stiamo cercando — sparirebbero dal conteggio invece di comparire. È il tipo di dettaglio che
     * trasforma una diagnosi in un «tutto a posto» falso.
     *
     * Il `BETWEEN` sui giorni è la finestra della settimana: senza filtro gli estremi sono 1 e un
     * numero più alto di qualunque giornata, quindi la query è la stessa di prima.
     */
    prisma.$queryRaw`
      WITH pasti AS (
        SELECT t.diet_id AS diet_id, (m->>'slot') AS slot, (m->>'recipeId') AS recipe_id
        FROM diet_day_template t
        CROSS JOIN LATERAL jsonb_array_elements(t.meals) AS m
        WHERE t.day_index BETWEEN ${da} AND ${a}
      )
      SELECT p.diet_id AS "dietId", p.slot,
             COUNT(DISTINCT p.recipe_id)::int AS piatti,
             COUNT(DISTINCT CASE WHEN r.active THEN p.recipe_id END)::int AS attivi,
             COUNT(DISTINCT CASE WHEN r.id IS NULL THEN p.recipe_id END)::int AS rotti
      FROM pasti p
      LEFT JOIN recipe r ON r.id = p.recipe_id
      GROUP BY p.diet_id, p.slot
    `,
  ])) as [
    { dietId: string; giorni: number; ultimoGiorno: number; giorniSettimana: number }[],
    { dietId: string; slot: string; piatti: number; attivi: number; rotti: number }[],
  ];

  const out = new Map<string, CoperturaVariante>();
  for (const g of giornate ?? []) {
    out.set(g.dietId, {
      dietId: g.dietId,
      giorni: Number(g.giorni),
      ultimoGiorno: Number(g.ultimoGiorno),
      settimane: Math.ceil(Number(g.ultimoGiorno) / GIORNI_SETTIMANA),
      giorniSettimana: Number(g.giorniSettimana ?? g.giorni),
      perSlot: {},
    });
  }
  for (const p of pasti ?? []) {
    // Una variante può avere pasti senza avere giornate contate? No — ma se il database fosse in uno
    // stato strano, meglio mostrarla che perderla: una riga inattesa si nota, una mancante no.
    const riga = out.get(p.dietId)
      ?? { dietId: p.dietId, giorni: 0, ultimoGiorno: 0, settimane: 0, giorniSettimana: 0, perSlot: {} };
    riga.perSlot[p.slot] = { piatti: Number(p.piatti), attivi: Number(p.attivi), rotti: Number(p.rotti) };
    out.set(p.dietId, riga);
  }
  return out;
}

/** I pasti che una variante DOVREBBE avere, dalla sua struttura: gli altri non sono buchi. */
export function slotAttesi(mealsPerDay: number, fasting: boolean): Slot[] {
  if (fasting) return ['lunch', 'afternoon_snack', 'dinner'];
  if (mealsPerDay >= 5) return [...SLOT_ORDINE];
  return ['breakfast', 'lunch', 'dinner'];
}

export type StatoCopertura = 'vuota' | 'rotta' | 'da_validare' | 'magra' | 'completa';

/**
 * Il giudizio su una variante, in una parola. Serve al colore della riga, e l'ordine dei controlli è
 * l'ordine della gravità: un riferimento rotto è peggio di una settimana da validare, che è peggio di
 * una magra.
 *
 * Con `settimana` il giudizio è su **quella** settimana: l'atteso per pasto diventa 7 (una settimana
 * senza ripetizioni) e «vuota» vuol dire che quella settimana non è mai stata generata, non che la
 * variante è vuota.
 */
export function statoCopertura(
  c: CoperturaVariante | undefined,
  attesi: Slot[],
  settimana?: number | null,
): { stato: StatoCopertura; dettaglio: string } {
  const unaSola = !!settimana && settimana >= 1;

  if (!c || c.giorni === 0) return { stato: 'vuota', dettaglio: 'nessuna giornata generata' };
  if (unaSola && (c.giorniSettimana ?? 0) === 0) {
    return {
      stato: 'vuota',
      dettaglio: c.settimane > 0
        ? `la settimana ${settimana} non esiste: questa variante arriva alla ${c.settimane}`
        : `la settimana ${settimana} non è mai stata generata`,
    };
  }

  const rotti = attesi.reduce((s, sl) => s + (c.perSlot[sl]?.rotti ?? 0), 0);
  if (rotti > 0) {
    return {
      stato: 'rotta',
      dettaglio: `${rotti} piatti nominati dalle giornate non esistono più: quei pasti si vedono vuoti`,
    };
  }

  const attesoPerSlot = unaSola ? GIORNI_SETTIMANA : c.settimane * GIORNI_SETTIMANA;
  const magri = attesi.filter((sl) => (c.perSlot[sl]?.piatti ?? 0) < attesoPerSlot);
  const nonAttivi = attesi.filter((sl) => (c.perSlot[sl]?.piatti ?? 0) > 0 && (c.perSlot[sl]?.attivi ?? 0) === 0);

  if (nonAttivi.length === attesi.length) {
    return { stato: 'da_validare', dettaglio: 'i piatti ci sono ma nessuno è attivo: manca la validazione' };
  }
  if (magri.length) {
    return {
      stato: 'magra',
      dettaglio: `meno di ${attesoPerSlot} piatti diversi su: ${magri.join(', ')}`,
    };
  }
  return unaSola
    ? { stato: 'completa', dettaglio: `settimana ${settimana} piena: 7 piatti diversi per pasto` }
    : { stato: 'completa', dettaglio: `${c.settimane} settimane piene` };
}
