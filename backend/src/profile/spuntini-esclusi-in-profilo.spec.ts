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
  return new ProfileService(prisma as unknown as PrismaService, {} as never, {} as never, {} as never);
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
