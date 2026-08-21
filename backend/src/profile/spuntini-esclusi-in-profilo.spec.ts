/**
 * GLI SPUNTINI TOLTI DALLA NUTRIZIONISTA, VISTI DALLA CLIENTE — voce 235.
 *
 * «Togli lo spuntino» (azione 3) scrive `ClientProfile.pastiEsclusi` e il motore lo rispetta: la
 * cliente riceve giornate senza quel pasto e le kcal ridistribuite sugli altri. Il backoffice lo
 * mostra dall'11/8; **l'app no**, e questo è lo stesso buco che avevano le allergie (§4
 * dell'handoff): un dato che agisce e non si vede è un dato che prima o poi qualcuno contraddice
 * senza saperlo — qui la cliente stessa, che scrive alla coach «mi manca la merenda».
 */
import { ProfileService } from './profile.service';
import type { PrismaService } from '../prisma/prisma.service';

const DIETA = { name: 'Mediterranea', clientName: null, clientDescription: null, style: 'mediterranean' };

function creaServizio(pastiEsclusi: string[] | null) {
  const prisma: any = {
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        regime: 'omnivore', dietStyle: 'mediterranean', dietFamily: 'Mediterranea',
        mealsPerDay: 5, pathType: 'five', fastingWindow: null, objective: 'dimagrimento',
        assignedCoach: null, pastiEsclusi,
      }),
    },
    menuDay: {
      findFirst: jest.fn().mockResolvedValue({ diet: DIETA }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    diet: { findFirst: jest.fn().mockResolvedValue(DIETA), findMany: jest.fn().mockResolvedValue([DIETA]) },
  };
  return new ProfileService(prisma as unknown as PrismaService, {} as never, {} as never, {} as never, {} as never);
}

type Nutrizione = { pastiEsclusi: string[] };

describe('nutrition: gli spuntini esclusi arrivano alla cliente', () => {
  it('li manda, così l\'app può dirle perché quel pasto non c\'è', async () => {
    const n = (await creaServizio(['afternoon_snack']).nutrition('u1')) as unknown as Nutrizione;
    expect(n.pastiEsclusi).toEqual(['afternoon_snack']);
  });

  it('tutti e due, se sono due', async () => {
    const n = (await creaServizio(['morning_snack', 'afternoon_snack']).nutrition('u1')) as unknown as Nutrizione;
    expect(n.pastiEsclusi).toEqual(['morning_snack', 'afternoon_snack']);
  });

  it('⚠️ mai `null`: un elenco vuoto è un elenco, e l\'app non deve difendersi da un buco', async () => {
    const n = (await creaServizio(null).nutrition('u1')) as unknown as Nutrizione;
    expect(n.pastiEsclusi).toEqual([]);
  });

  it('nessuno escluso: elenco vuoto, e in profilo non compare nessuna riga', async () => {
    const n = (await creaServizio([]).nutrition('u1')) as unknown as Nutrizione;
    expect(n.pastiEsclusi).toEqual([]);
  });
});

/**
 * ALLERGIE E INTOLLERANZE IN CIMA AL PROFILO — richiesta di Simone (16/8).
 *
 * In app c'erano già, ma nel secondo riquadro insieme alla spiegazione lunga: qui salgono in sintesi
 * nel primo, accanto alla dieta e al regime. ⚠️ Con loro viaggia `allergieDichiarateIl`, che è
 * l'unico modo per distinguere «nessuna allergia» da «non gliel'abbiamo mai chiesto».
 */
function conVincoli(over: Record<string, unknown>) {
  const prisma: any = {
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        regime: 'omnivore', dietStyle: 'mediterranean', dietFamily: 'Mediterranea',
        mealsPerDay: 5, pathType: 'five', fastingWindow: null, objective: 'dimagrimento',
        assignedCoach: null, pastiEsclusi: [], allergies: [], intolerances: [], allergieDichiarateIl: null,
        ...over,
      }),
    },
    menuDay: { findFirst: jest.fn().mockResolvedValue({ diet: DIETA }), findMany: jest.fn().mockResolvedValue([]) },
    diet: { findFirst: jest.fn().mockResolvedValue(DIETA), findMany: jest.fn().mockResolvedValue([DIETA]) },
  };
  return new ProfileService(prisma as unknown as PrismaService, {} as never, {} as never, {} as never, {} as never);
}

type Vincoli = { allergies: string[]; intolerances: string[]; allergieDichiarateIl: string | null };

describe('nutrition: allergie e intolleranze arrivano alla cliente', () => {
  it('le manda tutte e due', async () => {
    const n = (await conVincoli({ allergies: ['nocciole'], intolerances: ['lattosio'] }).nutrition('u1')) as unknown as Vincoli;
    expect(n.allergies).toEqual(['nocciole']);
    expect(n.intolerances).toEqual(['lattosio']);
  });

  it('⚠️ mai elenchi `null`: l\'app non deve difendersi da un buco', async () => {
    const n = (await conVincoli({ allergies: null, intolerances: null }).nutrition('u1')) as unknown as Vincoli;
    expect(n.allergies).toEqual([]);
    expect(n.intolerances).toEqual([]);
  });

  it('⚠️ manda la DATA della dichiarazione: è quella che distingue «nessuna» da «mai chieste»', async () => {
    const quando = new Date('2026-08-01T10:00:00.000Z');
    const n = (await conVincoli({ allergieDichiarateIl: quando }).nutrition('u1')) as unknown as Vincoli;
    expect(n.allergieDichiarateIl).toBe(quando.toISOString());
  });

  it('⚠️ mai dichiarate: la data resta `null`, e l\'app scriverà «non risultano», non «nessuna»', async () => {
    const n = (await conVincoli({}).nutrition('u1')) as unknown as Vincoli;
    expect(n.allergieDichiarateIl).toBeNull();
    expect(n.allergies).toEqual([]);
  });
});
