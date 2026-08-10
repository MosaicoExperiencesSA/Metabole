import type { PrismaService } from '../prisma/prisma.service';
import { inizioFinestraPuntoA, mancaMisuraDiPartenza } from './misura-di-partenza';

/**
 * IL PUNTO A DEVE ESSERE UNA MISURA DI QUESTO PIANO (11/8).
 *
 * Il caso vero che questi test bloccano per sempre: una cliente con pesate dal **20 luglio** ha
 * iniziato il piano il **6 agosto** e i menu sono partiti senza che nessuno le chiedesse niente,
 * perché il controllo era `count({ clientId })` — «una misura qualsiasi, in tutta la storia».
 *
 * Regola di Simone: «ci serve sempre una misura per erogare il menu, anche a costo di registrare due
 * misure consecutive».
 */
const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Finto Prisma: risponde con una misura se la data richiesta rientra fra quelle che ha. */
const conMisure = (date: string[], cattura?: { gte?: Date }) => (({
  measurement: {
    findFirst: (args: { where: { date: { gte: Date } } }) => {
      const gte = args.where.date.gte;
      if (cattura) cattura.gte = gte;
      const trovata = date.find((d) => D(d).getTime() >= gte.getTime());
      return Promise.resolve(trovata ? { id: trovata } : null);
    },
  },
}) as unknown as PrismaService);

describe('inizioFinestraPuntoA', () => {
  it('parte da quando il menu è visibile, non da un numero inventato', () => {
    expect(inizioFinestraPuntoA(D('2026-08-06'), 2)).toEqual(D('2026-08-04'));
  });

  it('senza giorni di anticipo la finestra parte dal giorno di inizio', () => {
    expect(inizioFinestraPuntoA(D('2026-08-06'), 0)).toEqual(D('2026-08-06'));
    expect(inizioFinestraPuntoA(D('2026-08-06'), -5)).toEqual(D('2026-08-06'));
  });

  it('azzera l\'ora: una misura è un giorno, non un istante', () => {
    // Senza questo, un piano salvato alle 22:00 spostava il confine di un giorno a seconda
    // dell'ora in cui girava il cron.
    expect(inizioFinestraPuntoA(new Date('2026-08-06T22:30:00.000Z'), 2)).toEqual(D('2026-08-04'));
  });
});

describe('mancaMisuraDiPartenza', () => {
  it('IL CASO GIOIA: pesate del 20 luglio, piano dal 6 agosto → manca', async () => {
    const manca = await mancaMisuraDiPartenza(
      conMisure(['2026-07-20', '2026-07-28', '2026-08-01']),
      'c1',
      D('2026-08-06'),
      2,
    );
    // Prima tornava «c'è» e i menu partivano: 82,4 kg del 20 luglio non sono la partenza di un
    // percorso cominciato il 6 agosto.
    expect(manca).toBe(true);
  });

  it('una pesata del primo giorno vale', async () => {
    expect(await mancaMisuraDiPartenza(conMisure(['2026-08-06']), 'c1', D('2026-08-06'), 2)).toBe(false);
  });

  it('una pesata dentro la finestra di visibilità vale: si è pesata guardando QUESTO piano', async () => {
    expect(await mancaMisuraDiPartenza(conMisure(['2026-08-04']), 'c1', D('2026-08-06'), 2)).toBe(false);
  });

  it('un giorno prima della finestra NON vale, anche se è di ieri rispetto a quella', async () => {
    // È il punto della decisione: meglio due pesate consecutive che un punto A ereditato.
    expect(await mancaMisuraDiPartenza(conMisure(['2026-08-03']), 'c1', D('2026-08-06'), 2)).toBe(true);
  });

  it('una pesata dei giorni dopo vale: chi si pesa al terzo giorno ha comunque una partenza', async () => {
    expect(await mancaMisuraDiPartenza(conMisure(['2026-08-09']), 'c1', D('2026-08-06'), 2)).toBe(false);
  });

  it('interroga il database dalla data giusta', async () => {
    const cattura: { gte?: Date } = {};
    await mancaMisuraDiPartenza(conMisure([], cattura), 'c1', D('2026-08-06'), 2);
    expect(cattura.gte).toEqual(D('2026-08-04'));
  });

  it('senza data di inizio non si trattiene niente: un piano non partito non si blocca', async () => {
    expect(await mancaMisuraDiPartenza(conMisure([]), 'c1', null, 2)).toBe(false);
    expect(await mancaMisuraDiPartenza(conMisure([]), 'c1', undefined, 2)).toBe(false);
  });
});
