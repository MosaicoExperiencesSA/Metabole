/**
 * CHI COMPIE GLI ANNI OGGI — chiesto al database, non filtrato dopo.
 *
 * ## Il difetto da cui nasce questo file (11/8)
 *
 * Gli auguri si mandavano così: prendi **500 clienti a caso** (`take: 500`, senza nemmeno un
 * `orderBy`), poi guarda in JavaScript chi di questi è nato oggi. Con più di 500 clienti con la data di
 * nascita in archivio, chi restava fuori da quei 500 non riceveva gli auguri **mai** — non «un anno
 * sì e uno no»: mai, per sempre, e sempre le stesse persone.
 *
 * Nessun errore, nessun log, niente di rotto: il codice fa quello che dice, manda gli auguri a tutti
 * quelli che ha guardato. Ed è invisibile per costruzione, perché nessuno si accorge di un'email che
 * non arriva e chi la riceve non sa che ad altri non è arrivata. È lo stesso schema del troncamento
 * della pipeline (86.000 schede, la board ne mostrava 500) e di quello dei Progressi: un limite messo
 * per prudenza che diventa una perdita di dati.
 *
 * Ora il giorno lo filtra il database. Il limite resta come freno sul numero di email per giro, ma
 * adesso si applica a chi compie gli anni **davvero** — e se scattasse lo dice.
 *
 * ## Il 29 febbraio
 *
 * Con la regola letterale, chi è nato il 29 febbraio riceve gli auguri una volta ogni quattro anni.
 * Negli anni non bisestili glieli mandiamo il **1° marzo**: è la convenzione dei registri civili, e in
 * ogni caso è meglio del silenzio. Sono poche persone, ed è esattamente il tipo di dettaglio che chi
 * lo vive nota.
 */

/** Il minimo del client Prisma che serve: così è testabile con un oggetto finto. */
export interface PrismaPerCompleanni {
  $queryRaw(strings: TemplateStringsArray, ...valori: unknown[]): Promise<unknown>;
}

export interface Festeggiato {
  id: string;
  email: string;
  firstName: string | null;
}

export interface ParametriCompleanno {
  /** Mese in convenzione SQL: 1 = gennaio. */
  mese: number;
  giorno: number;
  anno: number;
  /** Oggi è il 1° marzo di un anno non bisestile: tocca anche ai nati il 29 febbraio. */
  recuperaVentinove: boolean;
}

const bisestile = (anno: number): boolean => (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0;

/** Parte pura: da una data, cosa cercare. Separata perché è la regola, e le regole si provano. */
export function parametriCompleanno(oggi: Date): ParametriCompleanno {
  const mese = oggi.getUTCMonth() + 1;
  const giorno = oggi.getUTCDate();
  const anno = oggi.getUTCFullYear();
  return { mese, giorno, anno, recuperaVentinove: mese === 3 && giorno === 1 && !bisestile(anno) };
}

/**
 * Chi festeggia oggi. Ritorna **fino a `limite + 1`** righe di proposito: la riga in più è il modo di
 * sapere che il freno è scattato, senza fare un `count` a parte. Chi chiama serve le prime `limite` e
 * scrive un avviso se ne ha ricevute di più — un troncamento muto è il difetto che stiamo togliendo,
 * e reintrodurlo qui sarebbe ridicolo.
 */
export async function compleanniDiOggi(
  prisma: PrismaPerCompleanni,
  oggi: Date,
  limite: number,
): Promise<Festeggiato[]> {
  const { mese, giorno, recuperaVentinove } = parametriCompleanno(oggi);
  const righe = (await prisma.$queryRaw`
    SELECT id, email, first_name AS "firstName"
    FROM "user"
    WHERE role::text = 'client'
      AND deleted_at IS NULL
      AND birth_date IS NOT NULL
      AND (
        (EXTRACT(MONTH FROM birth_date)::int = ${mese} AND EXTRACT(DAY FROM birth_date)::int = ${giorno})
        OR (${recuperaVentinove}::boolean AND EXTRACT(MONTH FROM birth_date)::int = 2 AND EXTRACT(DAY FROM birth_date)::int = 29)
      )
    ORDER BY id
    LIMIT ${limite + 1}
  `) as Festeggiato[];
  return righe ?? [];
}
