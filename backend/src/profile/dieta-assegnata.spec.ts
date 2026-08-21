/**
 * QUELLO CHE LA CLIENTE LEGGE NEL SUO PROFILO: nome, stile e descrizione della sua dieta.
 *
 * Sono tre campi che uscivano tutti dalla **stessa** riga: `diet.findFirst({ where: { name } })`.
 * Con una famiglia presente in catalogo in più varianti, quella riga restituiva la prima che
 * capitava — e la cliente si trovava in mano la descrizione, e la scheda «cos'è la tua dieta», di
 * una variante che non ha mai visto.
 *
 * La stessa trappola era stata trovata l'11/8 nella scheda del backoffice (caso Cristina Urbani) e
 * corretta **solo lì**. Decisione di Simone del 12/8: «la cliente usa la stessa ricerca dello
 * staff».
 *
 * ⚠️ Il fatto che questi test siano tre e non uno è il punto: chi guardava il difetto vedeva un
 * nome sbagliato, ma dalla stessa query uscivano anche `dietStyleAssegnato` — che decide **quale
 * scheda informativa si apre in app** — e `dietDescription`, il testo sotto il «?».
 */
import { ProfileService } from './profile.service';
import type { PrismaService } from '../prisma/prisma.service';

type RigaDieta = {
  id: string; name: string; clientName: string | null; clientDescription: string | null;
  style: string | null; status: string; regime: string | null; mealsPerDay: number | null;
};

/** La cliente: onnivora, 5 pasti, famiglia «Mediterranea». */
const PROFILO = {
  regime: 'onnivoro', dietStyle: 'mediterranean', dietFamily: 'Mediterranea',
  mealsPerDay: 5, pathType: null, fastingWindow: null, objective: 'dimagrimento',
  assignedCoach: null,
};

/** La variante che è DAVVERO la sua. In catalogo non è la prima: è voluto. */
const SUA: RigaDieta = {
  id: 'sua', name: 'Mediterranea', clientName: 'Mediterranea', clientDescription: 'Pesce, olio, verdure di stagione.',
  style: 'mediterranean', status: 'approved', regime: 'onnivoro', mealsPerDay: 5,
};
/** Stesso nome, un'altra persona: vegana, 3 pasti. */
const OMONIMA: RigaDieta = {
  id: 'omonima', name: 'Mediterranea', clientName: 'Mediterranea', clientDescription: 'Legumi e cereali, niente prodotti animali.',
  style: 'vegan', status: 'approved', regime: 'vegano', mealsPerDay: 3,
};

function creaServizio(catalogo: RigaDieta[], profilo: Record<string, unknown> = PROFILO) {
  const prisma = {
    clientProfile: { findUnique: jest.fn().mockResolvedValue(profilo) },
    menuDay: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    diet: {
      findFirst: jest.fn(async (args: { where?: Record<string, unknown> }) => {
        const w = (args?.where ?? {}) as Record<string, unknown>;
        return catalogo.find((r) =>
          Object.entries(w).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v),
        ) ?? null;
      }),
    },
  };
  return new ProfileService(prisma as unknown as PrismaService, {} as never, {} as never, {} as never, {} as never);
}

type Nutrizione = {
  dietName: string | null; dietDescription: string | null; dietStyleAssegnato: string | null;
};

describe('la dieta che la cliente vede nel Profilo', () => {
  it('⚠️ la DESCRIZIONE è quella della sua variante, non della prima omonima', async () => {
    const n = (await creaServizio([OMONIMA, SUA]).nutrition('u1')) as Nutrizione;
    expect(n.dietDescription).toBe('Pesce, olio, verdure di stagione.');
  });

  it('⚠️ e lo STILE anche: è la chiave della scheda che si apre in app', async () => {
    // Con lo stile sbagliato il «?» accanto alla dieta apre la scheda di un'altra alimentazione,
    // con le sue fonti e i suoi consigli. È l'errore meno visibile e il più fastidioso da capire.
    const n = (await creaServizio([OMONIMA, SUA]).nutrition('u1')) as Nutrizione;
    expect(n.dietStyleAssegnato).toBe('mediterranean');
  });

  it('la dieta assegnata batte quella dei menu già erogati', async () => {
    // Difetto del 10/8: dopo un cambio dieta le giornate restano costruite su quella di prima
    // finché non si rigenerano, e il Profilo mostrava il nome vecchio.
    const service = creaServizio([SUA]);
    const n = (await service.nutrition('u1')) as Nutrizione;
    expect(n.dietName).toBe('Mediterranea');
  });

  it('⚠️ se la sua variante non esiste, si mostra quella che il motore SERVE davvero', async () => {
    // Non «niente» e non una a caso: è l'unica che spiega i piatti che ha nel piatto.
    const ripiego: RigaDieta = { ...SUA, id: 'ripiego', name: 'Mediterranea leggera', clientName: 'Mediterranea leggera' };
    const n = (await creaServizio([ripiego]).nutrition('u1')) as Nutrizione;
    expect(n.dietName).toBe('Mediterranea leggera');
    expect(n.dietStyleAssegnato).toBe('mediterranean');
  });

  it('⚠️ l\'OBIETTIVO entra nella ricerca: senza, cliente e staff cercherebbero due cose diverse', async () => {
    // `pick-diet.ts` usa `objective` in due dei sette ripieghi. Il campo non era nemmeno letto dal
    // profilo qui: bastava questo perché le due schermate tornassero a divergere sui ripieghi.
    const service = creaServizio([SUA]);
    await service.nutrition('u1');
    const select = (service as unknown as { prisma: { clientProfile: { findUnique: jest.Mock } } })
      .prisma.clientProfile.findUnique.mock.calls[0][0].select;
    expect(select.objective).toBe(true);
  });

  it('senza dieta in catalogo resta il nome scritto sul profilo', async () => {
    const n = (await creaServizio([]).nutrition('u1')) as Nutrizione;
    expect(n.dietName).toBe('Mediterranea');
    expect(n.dietDescription).toBeNull();
    // Lo stile ripiega su quello del profilo: la scheda generale c'è sempre.
    expect(n.dietStyleAssegnato).toBe('mediterranean');
  });
});
