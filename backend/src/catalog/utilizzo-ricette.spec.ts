import { settimaneDiTutte, utilizzoDelleRicette, type PrismaQuery } from './utilizzo-ricette';

/**
 * DOVE UNA RICETTA È USATA si legge dalle GIORNATE, mai dai tag.
 *
 * È la stessa lezione già pagata con `sett:N`: quel tag lo scriveva il generatore alla nascita della
 * ricetta, quindi diceva in quale *generazione* era stata prodotta, e chi guardava il catalogo
 * leggeva «tutte nella prima settimana» su una dieta distribuita su due. Il tag `dieta:<nome>` ha
 * esattamente lo stesso difetto.
 *
 * La query vera l'ha provata Postgres (varianti sorelle unite per nome, diete archiviate escluse,
 * confini di settimana 7→1 / 8→2, giornate con `meals` guasto che non fanno cadere l'elenco). Qui si
 * fissa quello che il codice TypeScript decide da solo: cosa chiede al database e come rimonta la
 * risposta — in particolare che una ricetta assente resti **assente**, perché chi legge la tratta
 * come orfana e quella è un'affermazione che pesa.
 */

/** Prisma finto: registra la query e risponde con le righe date. */
function prismaFinto(righe: unknown[]) {
  const chiamate: { sql: string; valori: unknown[] }[] = [];
  const prisma: PrismaQuery = {
    $queryRaw: async (strings: TemplateStringsArray, ...valori: unknown[]) => {
      chiamate.push({ sql: strings.join('?'), valori });
      return righe;
    },
  };
  return { prisma, chiamate };
}

describe('utilizzoDelleRicette — cosa chiede al database', () => {
  it('con nessuna ricetta non interroga affatto il database', async () => {
    const { prisma, chiamate } = prismaFinto([]);
    const u = await utilizzoDelleRicette(prisma, []);
    expect(u.size).toBe(0);
    // Una pagina vuota di risultati non deve costare una scansione delle giornate.
    expect(chiamate).toHaveLength(0);
  });

  it('passa gli id come parametro e non li incolla nella query', async () => {
    const { prisma, chiamate } = prismaFinto([]);
    await utilizzoDelleRicette(prisma, ["r-1", "r'2"]);
    expect(chiamate).toHaveLength(1);
    expect(chiamate[0].valori).toContainEqual(["r-1", "r'2"]);
    // L'apostrofo nell'id non deve comparire nel testo della query.
    expect(chiamate[0].sql).not.toContain("r'2");
  });

  it('esclude le diete archiviate e regge le giornate con `meals` guasto', async () => {
    const { prisma, chiamate } = prismaFinto([]);
    await utilizzoDelleRicette(prisma, ['r']);
    // Due difese che non si vedono nei dati e che, tolte, danno un errore silenzioso: una ricetta
    // usata solo da una dieta ritirata risulterebbe «in uso», e una giornata guasta farebbe cadere
    // l'intero elenco ricette.
    expect(chiamate[0].sql).toContain("d.status::text <> 'rejected'");
    expect(chiamate[0].sql).toContain("jsonb_typeof(t.meals) = 'array'");
  });
});

describe('utilizzoDelleRicette — come rimonta la risposta', () => {
  it('raccoglie sotto la stessa ricetta le diete diverse che la usano', async () => {
    const { prisma } = prismaFinto([
      { recipeId: 'condivisa', dieta: 'Keto-Mediterranea', settimane: [3] },
      { recipeId: 'condivisa', dieta: 'Mediterranea', settimane: [1, 2] },
      { recipeId: 'sola', dieta: 'Mediterranea', settimane: [1] },
    ]);
    const u = await utilizzoDelleRicette(prisma, ['condivisa', 'sola']);
    expect(u.get('condivisa')).toEqual([
      { dieta: 'Keto-Mediterranea', settimane: [3] },
      { dieta: 'Mediterranea', settimane: [1, 2] },
    ]);
    expect(u.get('sola')).toEqual([{ dieta: 'Mediterranea', settimane: [1] }]);
  });

  it('una ricetta che nessuna giornata usa resta FUORI dalla mappa', async () => {
    const { prisma } = prismaFinto([{ recipeId: 'usata', dieta: 'Mediterranea', settimane: [1] }]);
    const u = await utilizzoDelleRicette(prisma, ['usata', 'orfana']);
    // Chi legge tratta l'assenza come «nessuna dieta, fuori dal ciclo»: è lavoro generato, pagato e
    // riletto che nessuna cliente vedrà mai, ed è la cosa che più conviene poter cercare.
    expect(u.has('orfana')).toBe(false);
    expect(u.has('usata')).toBe(true);
  });

  it('una riga senza `recipeId` non diventa una voce fantasma', async () => {
    const { prisma } = prismaFinto([
      { recipeId: null, dieta: 'Mediterranea', settimane: [1] },
      { recipeId: 'buona', dieta: 'Mediterranea', settimane: [1] },
    ]);
    const u = await utilizzoDelleRicette(prisma, ['buona']);
    expect(u.size).toBe(1);
    expect(u.has('buona')).toBe(true);
  });

  it('le settimane restano numeri anche se il driver le porta come stringhe', async () => {
    const { prisma } = prismaFinto([{ recipeId: 'r', dieta: 'Mediterranea', settimane: ['1', '3'] }]);
    const u = await utilizzoDelleRicette(prisma, ['r']);
    // La colonna Excel scrive le settimane come celle numeriche: una stringa qui darebbe il
    // «numero memorizzato come testo» e l'ordinamento alfabetico (1, 10, 2).
    expect(u.get('r')?.[0].settimane).toEqual([1, 3]);
  });
});

describe('settimaneDiTutte — l\'unione fra le diete', () => {
  it('unisce, toglie i doppioni e ordina', () => {
    expect(settimaneDiTutte([
      { dieta: 'Mediterranea', settimane: [3, 1] },
      { dieta: 'Keto-Mediterranea', settimane: [1, 2] },
    ])).toEqual([1, 2, 3]);
  });

  it('nessuna dieta = nessuna settimana', () => {
    expect(settimaneDiTutte([])).toEqual([]);
  });
});
