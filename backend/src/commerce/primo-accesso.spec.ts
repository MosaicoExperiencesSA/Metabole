/**
 * «PRIMO ACCESSO EFFETTUATO» — la scheda si muove quando la cliente entra, e non si muove quando
 * non deve.
 */
import { segnaPrimoAccesso, dimenticaAvviso, STATO_PRIMO_ACCESSO } from './primo-accesso';

/** Una pipeline finta con gli ordini veri: «primo accesso» sta fra «Lavorato» e «Questionario». */
const ORDINI: Record<string, number> = {
  lead_in: 0, worked: 1, primo_accesso_effettuato: 2, questionnaire_done: 3, paid: 4, path_ended: 10,
};

function finto(statoAttuale: string | null, colonne = ORDINI) {
  const scritture: { dove: string; stage: string }[] = [];
  return {
    scritture,
    prisma: {
      pipelineStage: {
        findUnique: async ({ where }: never) => {
          const k = (where as { key: string }).key;
          return k in colonne ? { order: colonne[k] } : null;
        },
      },
      crmRecord: {
        findUnique: async () => (statoAttuale ? { stage: statoAttuale, stageDates: {} } : null),
        update: async ({ data }: never) => { scritture.push({ dove: 'update', stage: (data as { stage: string }).stage }); return {}; },
        create: async ({ data }: never) => { scritture.push({ dove: 'create', stage: (data as { stage: string }).stage }); return {}; },
      },
    },
  };
}

beforeEach(() => dimenticaAvviso());

describe('quando la scheda si muove', () => {
  it('da «Nuovo contatto» va a «Primo accesso effettuato»', async () => {
    const f = finto('lead_in');
    expect(await segnaPrimoAccesso(f.prisma as never, 'c1')).toBe(true);
    expect(f.scritture).toEqual([{ dove: 'update', stage: STATO_PRIMO_ACCESSO }]);
  });

  it('se la scheda non c\'è ancora, la crea', async () => {
    const f = finto(null);
    expect(await segnaPrimoAccesso(f.prisma as never, 'c1')).toBe(true);
    expect(f.scritture).toEqual([{ dove: 'create', stage: STATO_PRIMO_ACCESSO }]);
  });
});

describe('quando NON si muove', () => {
  it('⛔ una cliente che ha già comprato non torna indietro sulla board', async () => {
    const f = finto('paid');
    expect(await segnaPrimoAccesso(f.prisma as never, 'c1')).toBe(false);
    expect(f.scritture).toEqual([]);
  });

  it('⛔ e nemmeno una col percorso concluso', async () => {
    const f = finto('path_ended');
    expect(await segnaPrimoAccesso(f.prisma as never, 'c1')).toBe(false);
    expect(f.scritture).toEqual([]);
  });

  it('dal secondo accesso in poi non fa niente: è per questo che non serve sapere se è il primo', async () => {
    const f = finto(STATO_PRIMO_ACCESSO);
    expect(await segnaPrimoAccesso(f.prisma as never, 'c1')).toBe(false);
    expect(f.scritture).toEqual([]);
  });

  it('⛔ e il questionario, che viene dopo, non viene annullato dall\'accesso successivo', async () => {
    const f = finto('questionnaire_done');
    expect(await segnaPrimoAccesso(f.prisma as never, 'c1')).toBe(false);
    expect(f.scritture).toEqual([]);
  });
});

describe('quando la colonna non c\'è (l\'etichetta scritta a mano non combacia)', () => {
  const SENZA = { lead_in: 0, questionnaire_done: 3 };

  it('non scrive niente e lo DICE: altrimenti non funzionerebbe per sempre, in silenzio', async () => {
    const f = finto('lead_in', SENZA);
    const detti: string[] = [];
    expect(await segnaPrimoAccesso(f.prisma as never, 'c1', { warn: (m) => detti.push(m) })).toBe(false);
    expect(f.scritture).toEqual([]);
    expect(detti).toHaveLength(1);
    expect(detti[0]).toContain(STATO_PRIMO_ACCESSO);
    expect(detti[0]).toContain('diag:pipeline-stati');
  });

  it('⚠️ ma lo dice UNA volta sola: un avviso a ogni accesso non è un avviso, è rumore', async () => {
    const detti: string[] = [];
    const log = { warn: (m: string) => detti.push(m) };
    for (let i = 0; i < 5; i++) await segnaPrimoAccesso(finto('lead_in', SENZA).prisma as never, `c${i}`, log);
    expect(detti).toHaveLength(1);
  });

  it('⛔ e NON parla quando la colonna c\'è e la scheda è solo già avanti: quello è il caso normale', async () => {
    const detti: string[] = [];
    await segnaPrimoAccesso(finto('paid').prisma as never, 'c1', { warn: (m) => detti.push(m) });
    expect(detti).toEqual([]);
  });
});
