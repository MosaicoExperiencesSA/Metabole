/**
 * ⛔ **IL GIRO NOTTURNO CHE NON LASCIA NESSUNO SUL TAVOLO DI NESSUNO.**
 *
 * Chiude due domande aperte dal 23/8 — `mai-valutata-eroga-lo-stesso` e `motore-dopo-il-via-libera` —
 * e le chiude **senza fermare nessuno**. Simone, 25/8: *«Se il cliente è supervisionato va mandata
 * notifica a Lucia di controllarlo ogni 7 giorni attraverso Vera»*.
 */
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { RichiesteVeraService } from './richieste.service';

type Profilo = {
  userId: string;
  name: string | null;
  createdAt: Date | null;
  screeningFlag: boolean;
  idoneita: string | null;
  idoneitaVisitaEntro: Date | null;
};

const IERI_UN_MESE = new Date('2026-07-25T00:00:00Z');

const crea = (profili: Profilo[], ogniGiorni = 7) => {
  const richieste: { id: string; chiave: string; testo: string; tipo: string; stato: string; clienteId: string }[] = [];
  const prisma = {
    clientProfile: {
      // ⚠️ Il finto conta come conta l'originale: un `count` che rende sempre 0 nasconderebbe
      // proprio il caso in cui il tetto morde.
      count: jest.fn().mockResolvedValue(profili.length),
      findMany: jest.fn().mockResolvedValue(profili),
      findUnique: jest.fn().mockResolvedValue({ name: 'Giulia', assignedNutritionist: { userId: 'u-n' } }),
    },
    richiestaVera: {
      findUnique: jest.fn().mockImplementation(async ({ where }: any) =>
        richieste.find((r) => r.chiave === where.chiave) ?? null),
      /**
       * ⚠️ Il finto segue l'originale: filtra per cliente, tipo e stato. Un doppio che rende tutto
       * non verifica la chiusura del promemoria vecchio — «un finto che manca non fa fallire
       * niente, fa passare tutto», e qui varrebbe anche per un finto approssimativo.
       */
      findMany: jest.fn().mockImplementation(async ({ where }: any) =>
        richieste.filter(
          (r) => r.clienteId === where.clienteId && r.tipo === where.tipo && r.stato === where.stato,
        )),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const riga = richieste.find((r) => r.id === where.id)!;
        Object.assign(riga, data);
        return riga;
      }),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const riga = {
          id: `rv-${richieste.length + 1}`,
          chiave: data.chiave,
          testo: data.testo,
          tipo: data.tipo,
          clienteId: data.clienteId,
          stato: 'aperta',
        };
        richieste.push(riga);
        return riga;
      }),
    },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };
  const service = new RichiesteVeraService(
    prisma as unknown as PrismaService,
    { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
    { aggiungiEsclusione: jest.fn() } as never,
    { getNumber: jest.fn().mockResolvedValue(ogniGiorni) } as unknown as ConfigParamsService,
  );
  return { service, prisma, richieste };
};

const profilo = (p: Partial<Profilo> = {}): Profilo => ({
  userId: 'c1',
  name: 'Giulia',
  createdAt: IERI_UN_MESE,
  screeningFlag: true,
  idoneita: null,
  idoneitaVisitaEntro: null,
  ...p,
});

const OGGI = new Date('2026-08-25T02:00:00Z');

describe('⛔ la sorveglianza sui percorsi supervisionati', () => {
  it('⛔ una cliente in screening mai valutata riceve la sua domanda su Vera', async () => {
    const { service, richieste } = crea([profilo()]);
    const esito = await service.promemoriaSupervisione(OGGI);
    expect(esito).toEqual({ inScreening: 1, guardati: 1, aperti: 1, giaAperti: 0, falliti: 0 });
    expect(richieste[0].tipo).toBe('supervisione_da_guardare');
    expect(richieste[0].testo).toContain('Giulia');
    // ⛔ E dice la cosa che nessuno sapeva: che nel frattempo mangia.
    expect(richieste[0].testo).toMatch(/RICEVE I MENU/);
  });

  /**
   * ⛔ **Il cron può girare due volte la stessa notte** — riavvio, ripresa dopo un guasto, doppio
   * colpo dello scheduler — e la domanda deve restare una.
   */
  it('⛔ girando due volte la stessa notte, la domanda resta una', async () => {
    const { service, richieste } = crea([profilo()]);
    await service.promemoriaSupervisione(OGGI);
    const secondo = await service.promemoriaSupervisione(OGGI);
    expect(richieste).toHaveLength(1);
    expect(secondo).toEqual({ inScreening: 1, guardati: 1, aperti: 0, giaAperti: 1, falliti: 0 });
  });

  /** ⛔ Ma la settimana dopo TORNA: una domanda senza risposta non deve spegnersi. */
  /**
   * ⛔ La settimana dopo torna — e **quello vecchio si chiude**. Il promemoria non lo chiude nessuno
   * per mestiere, e la coda di Vera è FIFO con un tetto di 100: lasciandoli aperti, nel giro di
   * qualche mese le cento righe più vecchie sono tutte promemoria, e una domanda vera su
   * un'allergia non compare più né in chat né nella card. La coda deve portare **lo stato di
   * adesso**, non la storia di chi non ha risposto.
   */
  it('⛔ la settimana dopo il promemoria si ripresenta, e quello vecchio si chiude', async () => {
    const { service, richieste } = crea([profilo()]);
    await service.promemoriaSupervisione(OGGI);
    await service.promemoriaSupervisione(new Date('2026-09-02T02:00:00Z'));
    expect(richieste).toHaveLength(2);
    expect(richieste[0].stato).toBe('chiusa');
    expect(richieste[1].stato).toBe('aperta');
    // ⚠️ E quello nuovo porta il conteggio aggiornato: «da 39 giorni», non «da 31».
    expect(richieste[1].testo).toContain('da 39 giorni');
  });

  /** ⚠️ Ma NON chiude quello di un'altra cliente: si guarda per persona. */
  it('⚠️ il promemoria di un’altra cliente non viene toccato', async () => {
    const { service, richieste } = crea([profilo({ userId: 'c1' }), profilo({ userId: 'c2', name: 'Anna' })]);
    await service.promemoriaSupervisione(OGGI);
    await service.promemoriaSupervisione(new Date('2026-09-02T02:00:00Z'));
    const aperte = richieste.filter((r) => r.stato === 'aperta');
    expect(aperte).toHaveLength(2);
    expect(new Set(aperte.map((r) => r.clienteId))).toEqual(new Set(['c1', 'c2']));
  });

  it('⛔ chi ha il via libera non riceve niente: la decisione c’è già', async () => {
    const { service, richieste } = crea([profilo({ idoneita: 'idonea' })]);
    const esito = await service.promemoriaSupervisione(OGGI);
    expect(richieste).toHaveLength(0);
    expect(esito.aperti).toBe(0);
  });

  it('⚠️ chi aspetta una visita sì, e il testo porta la data', async () => {
    const { service, richieste } = crea([
      profilo({ idoneita: 'serve_visita', idoneitaVisitaEntro: new Date('2026-09-30T00:00:00Z') }),
    ]);
    await service.promemoriaSupervisione(OGGI);
    expect(richieste[0].testo).toContain('30/09/2026');
  });

  /**
   * ⛔ **Un promemoria che esplode non porta giù la notte, e non porta giù gli altri pazienti.**
   * È un passo del cron: se la seconda cliente fa fallire la terza, la sorveglianza smette in
   * silenzio proprio su chi sta più indietro nell'elenco.
   */
  it('⛔ se una domanda fallisce, le altre si aprono lo stesso e il fallimento si conta', async () => {
    const { service, prisma, richieste } = crea([
      profilo({ userId: 'c1' }),
      profilo({ userId: 'c2', name: 'Anna' }),
      profilo({ userId: 'c3', name: 'Sara' }),
    ]);
    prisma.richiestaVera.findUnique.mockImplementationOnce(async () => {
      throw new Error('database giù');
    });
    const esito = await service.promemoriaSupervisione(OGGI);
    expect(esito.falliti).toBe(1);
    expect(esito.aperti).toBe(2);
    expect(richieste.map((r) => r.testo.includes('Anna') || r.testo.includes('Sara'))).toEqual([true, true]);
  });

  it('⚠️ e senza nessuna cliente supervisionata il giro non fa niente e non esplode', async () => {
    const { service } = crea([]);
    expect(await service.promemoriaSupervisione(OGGI)).toEqual({ inScreening: 0, guardati: 0, aperti: 0, giaAperti: 0, falliti: 0 });
  });

  /**
   * ⚠️ **La soglia viene da `config_param`**, non dal codice: è la regola di casa sulle soglie del
   * motore, e qui vuol dire che Lucia può chiedere «ogni 3 giorni» senza un rilascio.
   */
  it('⚠️ il passo lo decide `supervision_reminder_days`', async () => {
    const { service, richieste } = crea([profilo()], 3);
    await service.promemoriaSupervisione(OGGI);
    await service.promemoriaSupervisione(new Date('2026-08-28T02:00:00Z'));
    expect(richieste).toHaveLength(2);
  });
});

/**
 * ⛔ **UNA CLIENTE SENZA NUTRIZIONISTA È ESATTAMENTE QUELLA CHE NON DEVE SPARIRE.**
 *
 * `apriRichiestaVera` avvisava con `if (!userId) return;`: la riga nasceva con
 * `nutrizionistaId: null` — quindi **visibile** al capo nell'elenco — ma **nessuna notifica
 * partiva**. Esisteva solo per chi apriva Vera di propria iniziativa e scorreva la card. E tre
 * commenti, in due file, promettevano già il contrario («o al capo se non ce n'è una»).
 *
 * ⚠️ Non è teorico: al 21/8 c'erano 39 clienti senza nutrizionista assegnata, **di cui 6 con lo
 * screening acceso** — cioè proprio la popolazione di questa sorveglianza.
 */
describe('⛔ il promemoria di una cliente senza nutrizionista non resta muto', () => {
  const creaSenzaAssegnazione = () => {
    const notifiche: { userId: string; type: string }[] = [];
    const richieste: { id: string; chiave: string; testo: string; tipo: string; stato: string; clienteId: string }[] = [];
    const prisma = {
      clientProfile: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([profilo()]),
        // ⛔ Nessuna nutrizionista assegnata: è il caso.
        findUnique: jest.fn().mockResolvedValue({ name: 'Giulia', assignedNutritionist: null }),
      },
      richiestaVera: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const riga = { id: 'rv-1', chiave: data.chiave, testo: data.testo, tipo: data.tipo, clienteId: data.clienteId, stato: 'aperta' };
          richieste.push(riga);
          return riga;
        }),
      },
      // I capi nutrizioniste, che è a loro che deve arrivare.
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'capo-1' }, { id: 'capo-2' }]) },
      notification: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          notifiche.push({ userId: data.userId, type: data.type });
          return {};
        }),
      },
    };
    const service = new RichiesteVeraService(
      prisma as unknown as PrismaService,
      { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      { aggiungiEsclusione: jest.fn() } as never,
      { getNumber: jest.fn().mockResolvedValue(7) } as unknown as ConfigParamsService,
    );
    return { service, notifiche, richieste };
  };

  it('⛔ la domanda nasce E i capi vengono avvisati', async () => {
    const { service, notifiche, richieste } = creaSenzaAssegnazione();
    await service.promemoriaSupervisione(OGGI);
    expect(richieste).toHaveLength(1);
    expect(notifiche.map((n) => n.userId).sort()).toEqual(['capo-1', 'capo-2']);
  });
});
