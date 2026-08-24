import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CrmService } from './crm.service';
import {
  parcheggiaInSospensione,
  riportaDallaSospensione,
  STAGE_DA_CLIENTE,
  STAGE_IN_SOSPENSIONE,
} from './sospensione-in-pipeline';

/**
 * ⛔ **LA COLONNA «IN SOSPENSIONE»** — Simone, 24/8: «un nuovo stato dove sostiamo i clienti durante
 * la sospensione e li riportiamo in Acquisto una volta che riprendono il percorso».
 *
 * Prima una cliente in vacanza per venti giorni restava in «Acquisito», in mezzo a chi sta seguendo:
 * chi apre la pipeline non vedeva la differenza fra chi è ferma di sua volontà e chi è sparita — e
 * sono due telefonate diverse.
 */
/** ⚠️ L'ordine della colonna è la sua posizione in questo elenco: serve al confronto «da Acquisito in poi». */
function prismaFinto(record: Record<string, unknown> | null, colonne = ['paid', STAGE_IN_SOSPENSIONE, 'first_visit']) {
  const update = jest.fn().mockResolvedValue({});
  const prisma = {
    pipelineStage: {
      findUnique: jest.fn(async ({ where }: { where: { key: string } }) =>
        (colonne.includes(where.key) ? { order: colonne.indexOf(where.key) } : null)),
    },
    crmRecord: { findUnique: jest.fn().mockResolvedValue(record), update },
  };
  return { prisma: prisma as never, update };
}

const scheda = (stage: string, prima: string | null = null) => ({
  stage,
  stageDates: { [stage]: { at: '2026-08-01T10:00:00.000Z', byUserId: 'u1' } },
  stagePrimaSospensione: prima,
});

describe('parcheggiare una scheda in «In sospensione»', () => {
  it('la scheda si sposta, e si ricorda da dove veniva', async () => {
    const { prisma, update } = prismaFinto(scheda('paid'));
    expect(await parcheggiaInSospensione(prisma, 'cli-1', 'sistema')).toBe(true);
    expect(update.mock.calls[0][0].data).toMatchObject({
      stage: STAGE_IN_SOSPENSIONE,
      stagePrimaSospensione: 'paid',
    });
  });

  /**
   * ⛔ **Chi era avanti non retrocede.** Una cliente in «Prima visita» che va in ferie non deve
   * tornare a «Acquisito» al rientro: il funnel racconterebbe una storia che non è successa. È anche
   * il motivo per cui questo parcheggio NON passa da `avanzaStatoSeIndietro` — quella funzione, per
   * costruzione, non muove mai una scheda all'indietro, e qui non l'avrebbe mossa affatto.
   */
  it('⛔ una scheda avanti nel funnel si ricorda la SUA colonna, non «Acquisito»', async () => {
    const { prisma, update } = prismaFinto(scheda('first_visit'));
    await parcheggiaInSospensione(prisma, 'cli-1', 'sistema');
    expect(update.mock.calls[0][0].data.stagePrimaSospensione).toBe('first_visit');
  });

  it('⚠️ una scheda già parcheggiata non si tocca (il giro notturno passa ogni notte)', async () => {
    const { prisma, update } = prismaFinto(scheda(STAGE_IN_SOSPENSIONE, 'paid'));
    expect(await parcheggiaInSospensione(prisma, 'cli-1', 'sistema')).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  /**
   * ⛔ **Chi ha finito non si parcheggia**: «Percorso concluso» e «Non ha seguito» sono colonne
   * terminali, e una sospensione tecnica su una scheda chiusa la farebbe **riaprire** — cioè
   * rimetterebbe in mezzo alle clienti attive una persona che non lo è più.
   */
  it.each(['path_ended', 'non_seguita'])('⛔ una scheda in «%s» resta dov\'è', async (stage) => {
    const { prisma, update } = prismaFinto(scheda(stage), ['paid', STAGE_IN_SOSPENSIONE, stage]);
    expect(await parcheggiaInSospensione(prisma, 'cli-1', 'sistema')).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('⚠️ senza la colonna sulla board non si inventa niente', async () => {
    const { prisma, update } = prismaFinto(scheda('paid'), ['paid']);
    expect(await parcheggiaInSospensione(prisma, 'cli-1', 'sistema')).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('e senza scheda CRM non si crea una scheda dal nulla', async () => {
    const { prisma, update } = prismaFinto(null);
    expect(await parcheggiaInSospensione(prisma, 'cli-1', 'sistema')).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  /**
   * ⛔ **LA MEMORIA VECCHIA NON VINCE SU DOVE STA ADESSO** — corretto in revisione il 25/8. La prima
   * stesura scriveva `record.stagePrimaSospensione ?? record.stage`: quel ripiego proteggeva un caso
   * impossibile (qui la scheda non può già essere in sospensione) e in cambio conservava valori
   * rimasti da una parentesi **già chiusa** — per esempio da un rinnovo, che riporta la scheda in
   * «Acquisito» senza cancellare la memoria. Alla vacanza dell'anno dopo la cliente sarebbe tornata
   * in «Prima visita»: una visita che in quel percorso non è mai avvenuta.
   */
  it('⛔ una memoria vecchia rimasta lì non vince su dove sta adesso', async () => {
    const { prisma, update } = prismaFinto({ ...scheda('paid'), stagePrimaSospensione: 'first_visit' });
    await parcheggiaInSospensione(prisma, 'cli-1', 'sistema');
    expect(update.mock.calls[0][0].data.stagePrimaSospensione).toBe('paid');
  });

  /**
   * ⛔ **SI PARCHEGGIA SOLO CHI È GIÀ CLIENTE.** Un periodo senza menu lo può creare chiunque dal
   * Calendario in app, prova gratuita compresa: parcheggiata, quella scheda diventerebbe una
   * «cliente» — contatore pubblico, conversione del cruscotto, campagne di chi ha comprato. Una
   * settimana di ferie non è un acquisto.
   */
  it.each(['trial', 'questionnaire_done', 'lead_in'])('⛔ una scheda in «%s» non si parcheggia', async (stage) => {
    const { prisma, update } = prismaFinto(scheda(stage), [stage, 'paid', STAGE_IN_SOSPENSIONE, 'first_visit']);
    expect(await parcheggiaInSospensione(prisma, 'cli-1', 'sistema')).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('⚠️ ma chi è più avanti nel funnel sì: «Prima visita» è una cliente a tutti gli effetti', async () => {
    const { prisma, update } = prismaFinto(scheda('first_visit'));
    expect(await parcheggiaInSospensione(prisma, 'cli-1', 'sistema')).toBe(true);
    expect(update.mock.calls[0][0].data.stagePrimaSospensione).toBe('first_visit');
  });
});

describe('riportare la scheda dopo la sospensione', () => {
  it('torna ESATTAMENTE dove stava, e la memoria si cancella', async () => {
    const { prisma, update } = prismaFinto(scheda(STAGE_IN_SOSPENSIONE, 'first_visit'));
    expect(await riportaDallaSospensione(prisma, 'cli-1', 'sistema')).toBe('first_visit');
    expect(update.mock.calls[0][0].data).toMatchObject({ stage: 'first_visit', stagePrimaSospensione: null });
  });

  it('se la colonna di prima non esiste più, torna in «Acquisito»', async () => {
    const { prisma, update } = prismaFinto(scheda(STAGE_IN_SOSPENSIONE, 'colonna_cancellata'));
    expect(await riportaDallaSospensione(prisma, 'cli-1', 'sistema')).toBe('paid');
    expect(update.mock.calls[0][0].data.stage).toBe('paid');
  });

  it('e senza memoria (sospensioni nate prima del 25/8) pure', async () => {
    const { prisma } = prismaFinto(scheda(STAGE_IN_SOSPENSIONE, null));
    expect(await riportaDallaSospensione(prisma, 'cli-1', 'sistema')).toBe('paid');
  });

  /**
   * ⛔ **UNA MANO VINCE SULL'AUTOMATISMO.** Se durante la vacanza una coach ha trascinato la scheda
   * da un'altra parte — «Senza possibilità economiche», per dire — al rientro non si riporta
   * indietro: quella è una decisione presa da una persona guardando il caso, e il cron non ne sa
   * niente.
   */
  it('⛔ chi è stata spostata a mano non si tocca', async () => {
    const { prisma, update } = prismaFinto(scheda('first_visit', 'paid'));
    expect(await riportaDallaSospensione(prisma, 'cli-1', 'sistema')).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});

/**
 * ⛔ **E QUESTA È LA PARTE CHE SI ROMPEVA IN SILENZIO.** In quattro punti «cliente» voleva dire
 * `stage === 'paid'`: il contatore pubblico delle clienti seguite, il badge cliente/lead nel CRM,
 * i filtri delle campagne. Parcheggiando una scheda altrove, una cliente che paga sarebbe diventata
 * **un lead** per il marketing — e in vacanza avrebbe ricevuto le email di chi non ha ancora comprato.
 */
describe('chi è «cliente» per il prodotto', () => {
  it('sono due colonne, e la sospensione è una di quelle', () => {
    expect(STAGE_DA_CLIENTE).toEqual(['paid', STAGE_IN_SOSPENSIONE]);
  });
});

describe('la colonna esiste nel seed, ed è di sistema', () => {
  const seed = readFileSync(join(__dirname, '..', '..', 'prisma', 'seed.ts'), 'utf8');
  const riga = () => {
    const m = seed.match(new RegExp(`\\{ key: '${STAGE_IN_SOSPENSIONE}'[^}]*\\}`));
    if (!m) throw new Error('la colonna «In sospensione» non è nel seed');
    return m[0];
  };

  it('così un\'installazione nuova nasce con la board completa', () => {
    expect(riga()).toContain("label: 'In sospensione'");
  });

  /**
   * ⛔ **`isSystem: true` non è un dettaglio**: su un'installazione già avviata il seed crea SOLO le
   * colonne di sistema. Senza, in produzione la colonna non esisterebbe, il parcheggio non
   * troverebbe dove mettere le schede, e non lo direbbe nessuno.
   */
  it('⛔ è di SISTEMA: altrimenti in produzione non nascerebbe affatto', () => {
    expect(riga()).toContain('isSystem: true');
  });

  /**
   * ⚠️ **Dopo «Acquisito»**: il cruscotto vendite conta come convertite le schede con
   * `order >= order('paid')`. Una colonna prima dell'acquisto avrebbe fatto CALARE la percentuale di
   * conversione a ogni vacanza — un numero che si guarda per decidere, sbagliato in silenzio.
   */
  it('⚠️ e sta DOPO «Acquisito», o la conversione calerebbe a ogni vacanza', () => {
    const ordineDi = (key: string) => {
      const m = seed.match(new RegExp(`key: '${key}'[^}]*order: (\\d+)`));
      if (!m) throw new Error(`stato «${key}» non trovato nel seed`);
      return Number(m[1]);
    };
    expect(ordineDi(STAGE_IN_SOSPENSIONE)).toBeGreaterThan(ordineDi('paid'));
    expect(riga()).toContain("dopoDi: 'paid'");
  });
});

/**
 * ⛔ **LA MEMORIA DURA QUANTO LA PARENTESI, e la chiude anche una mano.** Il trascinamento sulla
 * board passa da `CrmService.advance`, ed è il modo in cui una colonna chiesta come colonna verrà
 * usata davvero. Due difetti opposti, trovati in revisione il 25/8: parcheggiando **a mano** non si
 * scriveva da dove veniva (al rientro la cliente retrocedeva di quattro colonne), e spostandola
 * fuori a mano la memoria restava scritta (alla vacanza successiva la mandava in una colonna scelta
 * per un'altra storia).
 *
 * ⚠️ Questi test chiamano la funzione vera con un Prisma finto: la prima stesura leggeva il
 * **sorgente** con `readFileSync`, e un test così passa anche se quella riga finisce in un ramo che
 * non viene mai eseguito.
 */
describe('lo spostamento a mano e la memoria della sospensione', () => {
  function servizioCon(record: Record<string, unknown>) {
    const update = jest.fn().mockImplementation((args: { data: Record<string, unknown> }) => Promise.resolve({ ...record, ...args.data }));
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'admin' }) },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 's-io' }), findMany: jest.fn().mockResolvedValue([]) },
      crmRecord: { findUnique: jest.fn().mockResolvedValue(record), update },
    } as never;
    const pipeline = { stageKeys: jest.fn().mockResolvedValue(new Set(['paid', STAGE_IN_SOSPENSIONE, 'first_visit'])) };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new CrmService(prisma, audit as never, pipeline as never, {} as never, {} as never, {} as never);
    return { service, update };
  }

  it('⛔ parcheggiando A MANO si scrive da dove viene', async () => {
    const { service, update } = servizioCon({ id: 'r1', stage: 'first_visit', stageDates: {}, stagePrimaSospensione: null });
    await service.advance('u-admin', 'r1', { stage: STAGE_IN_SOSPENSIONE });
    expect(update.mock.calls[0][0].data.stagePrimaSospensione).toBe('first_visit');
  });

  it('⛔ e spostandola FUORI a mano la memoria si cancella', async () => {
    const { service, update } = servizioCon({ id: 'r1', stage: STAGE_IN_SOSPENSIONE, stageDates: {}, stagePrimaSospensione: 'first_visit' });
    await service.advance('u-admin', 'r1', { stage: 'paid' });
    expect(update.mock.calls[0][0].data.stagePrimaSospensione).toBeNull();
  });

  it('⚠️ e riparcheggiando una già parcheggiata non si perde la colonna vera', async () => {
    const { service, update } = servizioCon({ id: 'r1', stage: STAGE_IN_SOSPENSIONE, stageDates: {}, stagePrimaSospensione: 'first_visit' });
    await service.advance('u-admin', 'r1', { stage: STAGE_IN_SOSPENSIONE });
    expect(update.mock.calls[0][0].data.stagePrimaSospensione).toBe('first_visit');
  });

  /**
   * ⚠️ **E il rinnovo chiude la parentesi**: `autoAdvance` la chiama il pagamento. Una cliente che
   * rinnova mentre è in ferie torna in «Acquisito», e la memoria non deve restare lì ad aspettare la
   * vacanza dell'anno prossimo.
   */
  it('⚠️ anche il rinnovo (autoAdvance) cancella la memoria', async () => {
    const { service, update } = servizioCon({ id: 'r1', stage: STAGE_IN_SOSPENSIONE, stageDates: {}, stagePrimaSospensione: 'first_visit' });
    await service.autoAdvance('cli-1', 'paid', 'sistema');
    expect(update.mock.calls[0][0].data.stagePrimaSospensione).toBeNull();
  });
});
