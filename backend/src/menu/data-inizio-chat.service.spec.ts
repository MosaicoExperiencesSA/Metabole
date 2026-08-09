/**
 * GAIA SPOSTA LA DATA DI INIZIO (richiesta di Simone del 10/8).
 *
 * Qui non si verifica che le frasi siano gentili: si verifica **quando** Gaia scrive sul database e
 * quando non ci prova nemmeno. Le tre cose che si possono sbagliare in silenzio:
 *
 *  1. il confine — a piano **già partito** non si tocca niente e si passa alla coach. Sbagliarlo
 *     vuol dire cancellare menu già consegnati per una frase detta in chat;
 *  2. le tre scritture insieme — `planStartDate`, `subscription.startDate` e `endDate`. Se una
 *     manca, dashboard, gate del menu e scadenza raccontano tre date diverse;
 *  3. il ricontrollo alla conferma — fra la proposta e il «sì» può passare la mezzanotte, o il
 *     piano può essere partito. Lo stato appeso al messaggio è vecchio per definizione.
 *
 * ⚠️ «Oggi» si costruisce con `toDateOnly()`, non con `new Date().toISOString()`: il giorno del
 * prodotto è quello di **Europe/Rome**, e fra le 22:00 e le 24:00 UTC i due non coincidono. È il
 * difetto che ha fatto diventare rossa la CI il 9/8, in tre suite diverse.
 */

import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { subscriptionEnd } from '../commerce/commerce.service';
import { toDateOnly } from '../common/date-only';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { DataInizioChatService } from './data-inizio-chat.service';
import { MenuService } from './menu.service';

const GIORNO = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Mezzanotte del giorno di oggi + n, nello stesso «oggi» che usa il servizio. */
const fra = (n: number) => new Date(toDateOnly().getTime() + n * GIORNO);
const traIso = (n: number) => iso(fra(n));

interface Opzioni {
  /** Abbonamenti finti. Di default: uno attivo che parte fra 10 giorni. */
  subs?: unknown[];
  planStartDate?: Date | null;
}

async function crea(opzioni: Opzioni = {}) {
  const subs =
    opzioni.subs ??
    [
      { id: 'sub-1', status: 'active', startDate: fra(10), endDate: fra(100), plan: { period: '3m' }, createdAt: new Date() },
    ];
  const prisma: any = {
    subscription: {
      findMany: jest.fn().mockResolvedValue(subs),
      update: jest.fn().mockResolvedValue({}),
    },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        planStartDate: opzioni.planStartDate === undefined ? fra(10) : opzioni.planStartDate,
        name: 'Giulia',
      }),
      upsert: jest.fn().mockResolvedValue({}),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Giulia' }) },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const menu = { regenerateFromToday: jest.fn().mockResolvedValue({ removed: 0, delivered: [] }) };
  const moduleRef = await Test.createTestingModule({
    providers: [
      DataInizioChatService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuditService, useValue: audit },
      { provide: MenuService, useValue: menu },
      { provide: ConfigParamsService, useValue: { getNumber: jest.fn().mockResolvedValue(2) } },
    ],
  }).compile();
  return { service: moduleRef.get(DataInizioChatService), prisma, audit, menu };
}

/** La data scritta sul profilo, `YYYY-MM-DD`. */
const scritta = (prisma: any) => {
  const chiamata = prisma.clientProfile.upsert.mock.calls.at(-1)?.[0] as any;
  const d = chiamata?.update?.planStartDate as Date | undefined;
  return d ? iso(d) : null;
};

describe('Gaia sposta la data di inizio', () => {
  it('dal testo con la data dentro va diritta alla conferma, senza richiederla', async () => {
    const { service, prisma } = await crea();
    const esito = await service.apriDaTesto('cli-1', "posso spostare l'inizio a fra 20 giorni?");
    expect(esito.esito).toBe('in_corso');
    expect(esito.stato).toEqual(expect.objectContaining({ passo: 'conferma', data: traIso(20) }));
    // Ancora nessuna scrittura: la conferma è la conferma.
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });

  it('senza data nel testo chiede da quando, chiamandola per nome', async () => {
    const { service } = await crea();
    const esito = await service.apriDaTesto('cli-1', 'posso cambiare la data di inizio?');
    expect(esito.esito).toBe('aperto');
    expect(esito.stato?.passo).toBe('data');
    expect(esito.testo).toContain('Giulia');
  });

  it('sul «sì» scrive profilo, abbonamento e fine ricalcolata, e rigenera i menu', async () => {
    const { service, prisma, audit, menu } = await crea();
    const esito = await service.avanza('cli-1', { passo: 'conferma', data: traIso(20) }, 'sì');

    expect(esito.esito).toBe('applicata');
    expect(scritta(prisma)).toBe(traIso(20));
    const sub = prisma.subscription.update.mock.calls.at(-1)?.[0] as any;
    expect(sub.where).toEqual({ id: 'sub-1' });
    expect(iso(sub.data.startDate)).toBe(traIso(20));
    // La fine si RICALCOLA dalla durata del piano ('3m'), con la stessa funzione della scheda
    // cliente: lasciarla ferma vorrebbe dire regalare (o rubare) i giorni dello spostamento.
    expect(iso(sub.data.endDate)).toBe(iso(subscriptionEnd(toDateOnly(traIso(20)), '3m')));
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'chat.data_inizio.spostata',
        metadata: expect.objectContaining({ dopo: traIso(20), origine: 'chat' }),
      }),
    );
    // `regenerateFromToday`, MAI `restartFromPlanStart`: la seconda cancella anche lo storico.
    expect(menu.regenerateFromToday).toHaveBeenCalledWith('cli-1');
  });

  it('sul «no» non scrive niente', async () => {
    const { service, prisma } = await crea();
    const esito = await service.avanza('cli-1', { passo: 'conferma', data: traIso(20) }, 'no');
    expect(esito.esito).toBe('annullata');
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  /**
   * «No, fra 15 giorni» è un cambio di proposta, non un'incomprensione: trattarlo come «non ho
   * capito» farebbe ripetere alla cliente una cosa che ha già detto — e due volte chiude il flusso.
   */
  it("un'altra data al posto di sì/no diventa la nuova proposta", async () => {
    const { service, prisma } = await crea();
    const esito = await service.avanza('cli-1', { passo: 'conferma', data: traIso(20) }, 'no, fra 15 giorni');
    expect(esito.stato).toEqual(expect.objectContaining({ passo: 'conferma', data: traIso(15) }));
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });

  /**
   * IL CONFINE. Piano attivo e già cominciato: Gaia non tocca niente e passa alla coach — i menu di
   * questi giorni sono lavoro fatto, e la domanda vera non è più «che giorno metto».
   */
  it('a piano già partito non scrive niente e passa alla coach', async () => {
    const { service, prisma, menu } = await crea({
      subs: [
        { id: 'sub-1', status: 'active', startDate: fra(-5), endDate: fra(60), plan: { period: '3m' }, createdAt: new Date() },
      ],
      planStartDate: fra(-5),
    });
    const esito = await service.apriDaTesto('cli-1', "posso spostare l'inizio a lunedì?");
    expect(esito.esito).toBe('arresa');
    expect(esito.inoltraA).toBe('coach');
    expect(esito.stato).toBeUndefined();
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(menu.regenerateFromToday).not.toHaveBeenCalled();
  });

  /**
   * PIANO IN CODA: ha un piano in corso e ne ha comprato un secondo, che parte alla scadenza del
   * primo. `planStartDate` è nel futuro, ma quella data non è una sua scelta — è la scadenza di
   * quello che sta usando — e spostarla di qui sovrapporrebbe due piani. Lo stesso confine copre il
   * caso senza un ramo in più: un piano *è* partito.
   */
  it('col piano in coda non si sposta niente: uno è in corso', async () => {
    const { service, prisma } = await crea({
      subs: [
        { id: 'sub-2', status: 'active', startDate: fra(20), endDate: fra(110), plan: { period: '3m' }, createdAt: new Date() },
        { id: 'sub-1', status: 'active', startDate: fra(-40), endDate: fra(20), plan: { period: '3m' }, createdAt: new Date() },
      ],
      planStartDate: fra(20),
    });
    const esito = await service.apriDaTesto('cli-1', 'vorrei spostare la data di inizio');
    expect(esito.esito).toBe('arresa');
    expect(esito.inoltraA).toBe('coach');
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('senza nessun abbonamento vivo lo dice, e non gira niente alla coach', async () => {
    const { service } = await crea({
      subs: [
        { id: 'sub-1', status: 'expired', startDate: fra(-100), endDate: fra(-10), plan: { period: '3m' }, createdAt: new Date() },
      ],
      planStartDate: null,
    });
    const esito = await service.apriDaTesto('cli-1', 'posso cambiare la data di inizio?');
    expect(esito.esito).toBe('rifiutata');
    expect(esito.inoltraA).toBeUndefined();
  });

  /**
   * Un `pending` è un pagamento non ancora approvato: le date dell'abbonamento sono nulle di
   * proposito, le mette `finalizeApproval` leggendo proprio `planStartDate`. Scriverle qui
   * vorrebbe dire attivare un piano non pagato.
   */
  it("su un piano in attesa scrive il profilo e NON tocca l'abbonamento", async () => {
    const { service, prisma } = await crea({
      subs: [{ id: 'sub-1', status: 'pending', startDate: null, endDate: null, plan: { period: '3m' }, createdAt: new Date() }],
      planStartDate: fra(10),
    });
    const esito = await service.avanza('cli-1', { passo: 'conferma', data: traIso(20) }, 'confermo');
    expect(esito.esito).toBe('applicata');
    expect(scritta(prisma)).toBe(traIso(20));
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('una data passata non si applica, e il flusso resta aperto', async () => {
    const { service, prisma } = await crea();
    const esito = await service.avanza('cli-1', { passo: 'data', tentativi: 0 }, 'il 3/1/2020');
    expect(esito.esito).toBe('in_corso');
    expect(esito.stato?.passo).toBe('data');
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });

  it('oltre i 60 giorni propone la pausa alla coach, ma resta in ascolto', async () => {
    const { service, prisma } = await crea();
    const esito = await service.avanza('cli-1', { passo: 'data', tentativi: 0 }, 'fra tre mesi');
    expect(esito.esito).toBe('in_corso');
    expect(esito.stato?.passo).toBe('data');
    expect(esito.testo).toContain('60 giorni');
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });

  it('due date non capite di fila e passa alla coach invece di insistere', async () => {
    const { service } = await crea();
    const primo = await service.avanza('cli-1', { passo: 'data', tentativi: 0 }, 'boh non lo so');
    expect(primo.esito).toBe('in_corso');
    expect(primo.stato?.tentativi).toBe(1);
    const secondo = await service.avanza('cli-1', { passo: 'data', tentativi: 1 }, 'quando vuoi tu');
    expect(secondo.esito).toBe('arresa');
    expect(secondo.inoltraA).toBe('coach');
  });

  /**
   * IL RICONTROLLO. Fra la proposta e il «sì» può essere passata la mezzanotte, o l'attivazione può
   * aver fatto partire il piano: lo stato appeso al messaggio è vecchio per definizione.
   */
  it('alla conferma ricontrolla la data: quella scaduta nel frattempo non si applica', async () => {
    const { service, prisma } = await crea();
    const esito = await service.avanza('cli-1', { passo: 'conferma', data: traIso(-1) }, 'sì');
    expect(esito.esito).toBe('in_corso');
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });

  it('alla conferma ricontrolla anche il piano: se è partito non si applica', async () => {
    const { service, prisma } = await crea({
      subs: [{ id: 'sub-1', status: 'active', startDate: fra(0), endDate: fra(90), plan: { period: '3m' }, createdAt: new Date() }],
    });
    const esito = await service.avanza('cli-1', { passo: 'conferma', data: traIso(20) }, 'sì');
    expect(esito.esito).toBe('arresa');
    expect(esito.inoltraA).toBe('coach');
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });

  it('un errore di rigenerazione non fa fallire lo spostamento', async () => {
    const { service, prisma, menu } = await crea();
    menu.regenerateFromToday.mockRejectedValueOnce(new Error('motore giù'));
    const esito = await service.avanza('cli-1', { passo: 'conferma', data: traIso(20) }, 'sì');
    expect(esito.esito).toBe('applicata');
    expect(scritta(prisma)).toBe(traIso(20));
  });

  /** La conferma dice inizio E sblocco: la spesa si fa prima, e va detto quando comparirà il menu. */
  it('la conferma nomina anche il giorno in cui il menu si sblocca', async () => {
    const { service } = await crea();
    const esito = await service.avanza('cli-1', { passo: 'data', tentativi: 0 }, 'fra 20 giorni');
    expect(esito.stato?.passo).toBe('conferma');
    expect(esito.testo).toContain('due giorni prima');
  });

  it('«domani» è una data come le altre', async () => {
    const { service } = await crea();
    const esito = await service.avanza('cli-1', { passo: 'data', tentativi: 0 }, 'domani');
    expect(esito.stato?.data).toBe(traIso(1));
  });
});
