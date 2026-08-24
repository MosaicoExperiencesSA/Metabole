/**
 * ⛔ **IL MOTIVO DI UNA SOSPENSIONE** — richiesta di Simone, 24/8:
 * «quando la coach o la nutrizionista inseriscono una pausa facciamo mettere anche una motivazione
 * così ci resta salvata».
 *
 * Fino a oggi una sospensione diceva **da quando a quando** e **da quale porta era nata**, e non
 * **perché**. Chi apre la scheda tre mesi dopo — o chi deve decidere se concedere la seconda vacanza
 * in un mese, che è la domanda della «tregua» — leggeva venti giorni di menu fermi senza sapere se
 * era un viaggio di lavoro, un ricovero o un esame.
 *
 * ⚠️ La regola non è «un campo in più»: è **si chiede quando si sospende davvero**. Pretendere una
 * motivazione per *togliere* una sospensione, o per registrare il rientro, sarebbe attrito senza
 * contenuto — e l'attrito senza contenuto è quello che insegna a scrivere «x» per superare il modulo.
 */
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { MenuService } from '../menu/menu.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CoachTasksService } from '../coach-tasks/coach-tasks.service';
import { PrenotazioniService } from '../agenda/prenotazioni.service';
import { PauseService } from '../pause/pause.service';
import { aGiorno } from '../common/date-only';
import { ClientsService } from './clients.service';

/** Le date si contano da adesso: una data scritta a mano scade da sola (voce del 24/8). */
const fra = (n: number) => new Date(aGiorno(new Date()).getTime() + n * 86_400_000).toISOString().slice(0, 10);

async function crea() {
  const prisma: any = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'cli-1', role: 'client', deletedAt: null }),
      findUnique: jest.fn().mockResolvedValue({ id: 'cli-1', role: 'client' }),
    },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-c' }) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({ assignedCoachId: 'staff-c', assignedNutritionistId: 'staff-n' }),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
    rolePagePermission: { findUnique: jest.fn().mockResolvedValue({ canView: true, canManage: true }) },
    coachTeam: { findMany: jest.fn().mockResolvedValue([]) },
    staffMember: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const pause = {
    sospendiPerViaggio: jest.fn().mockResolvedValue({ giorni: 7, giorniCongelati: 7, nuovaScadenza: null, avviso: null }),
    togliSospensioneDaViaggio: jest.fn().mockResolvedValue({ tolta: false, avviso: null }),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      ClientsService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuthService, useValue: {} },
      { provide: AuditService, useValue: audit },
      { provide: NotificationsService, useValue: { notify: jest.fn() } },
      { provide: MenuService, useValue: {} },
      { provide: CoachTasksService, useValue: { apriAttivita: jest.fn() } },
      { provide: PrenotazioniService, useValue: {} },
      { provide: PauseService, useValue: pause },
    ],
  }).compile();
  return { service: moduleRef.get(ClientsService) as ClientsService, prisma, audit, pause };
}

/**
 * ⚠️ **Niente `state`**: dal 24/8 la tendina non c'è più (Simone: «va tolto il campo stato che crea
 * confusione») e lo stato sul profilo lo ricava il servizio dalle due date. Quello che rende una
 * sospensione una sospensione sono le date, ed è quello che questi test mandano.
 */
const vacanza = (motivo?: string) => ({
  start: fra(3),
  rientro: fra(10),
  ...(motivo !== undefined ? { motivo } : {}),
});

describe('il motivo della sospensione', () => {
  it('⛔ senza motivo non si sospende NIENTE, e l\'errore dice a cosa serve', async () => {
    const { service, pause, prisma } = await crea();
    await expect(service.setTravel('cli-1', 'coach-user', vacanza())).rejects.toThrow(BadRequestException);
    // La parte che conta: non è stato scritto niente. Un errore che lascia mezza scrittura è il
    // difetto che l'ordine «prima si sospende, poi si scrive il profilo» esiste per chiudere.
    expect(pause.sospendiPerViaggio).not.toHaveBeenCalled();
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });

  it('⛔ e nemmeno con uno spazio o una lettera: è la casella riempita per passare oltre', async () => {
    const { service } = await crea();
    for (const scritto of ['', '   ', 'x', 'ok']) {
      await expect(service.setTravel('cli-1', 'coach-user', vacanza(scritto))).rejects.toThrow(BadRequestException);
    }
  });

  it('col motivo la sospensione si crea, e il motivo ARRIVA a chi la scrive', async () => {
    const { service, pause } = await crea();
    await service.setTravel('cli-1', 'coach-user', vacanza('viaggio di lavoro in Germania'));
    expect(pause.sospendiPerViaggio).toHaveBeenCalledWith(
      'cli-1', 'coach-user', expect.objectContaining({ motivo: 'viaggio di lavoro in Germania' }),
    );
  });

  it('⚠️ e finisce nel REGISTRO: è la riga che risponde a «perché» fra tre mesi', async () => {
    const { service, audit } = await crea();
    await service.setTravel('cli-1', 'coach-user', vacanza('ricovero programmato'));
    const riga = audit.log.mock.calls.find((c: any[]) => c[0].action === 'client.travel.update');
    expect(riga[0].metadata.motivo).toBe('ricovero programmato');
  });

  /**
   * ⛔ **NON si chiede per TOGLIERE una sospensione, né per il rientro.** Il motivo esiste per
   * spiegare perché i menu si sono fermati; chiederlo a chi li fa ripartire è attrito senza
   * contenuto, e l'attrito senza contenuto insegna a scrivere «x» per superare il modulo.
   */
  it('⚠️ TOGLIERE la sospensione (date svuotate) non chiede nessun motivo', async () => {
    const { service, prisma, pause } = await crea();
    await expect(service.setTravel('cli-1', 'coach-user', {})).resolves.toBeDefined();
    expect(pause.togliSospensioneDaViaggio).toHaveBeenCalled();
    expect(prisma.clientProfile.upsert).toHaveBeenCalled();
  });

  /**
   * ⚠️ **UNA SOLA DATA non sospende niente**, quindi non si pretende nemmeno il motivo: si finisce
   * nel ramo che toglie la sospensione, e chiedere una motivazione per non fare niente sarebbe
   * attrito senza contenuto.
   */
  it('⚠️ con una sola data non si chiede il motivo: lì non si sospende niente', async () => {
    const { service, prisma } = await crea();
    await expect(service.setTravel('cli-1', 'coach-user', { start: fra(3) })).resolves.toBeDefined();
    expect(prisma.clientProfile.upsert).toHaveBeenCalled();
  });

  /**
   * ⛔ **LO STATO LO DICONO LE DATE** (24/8). Prima lo sceglieva chi salvava, e le due metà potevano
   * contraddirsi: una vacanza di luglio salvata «in partenza» ad agosto scriveva sul profilo uno
   * stato falso, e uno stato senza date non fermava niente pur sembrando di sì.
   */
  it('⛔ una vacanza che comincia fra tre giorni scrive «in partenza»: lo stato lo dicono le date', async () => {
    const { service, prisma } = await crea();
    await service.setTravel('cli-1', 'coach-user', vacanza('viaggio di lavoro'));
    expect(prisma.clientProfile.upsert.mock.calls[0][0].update).toMatchObject({ travelState: 'in_partenza' });
  });

  /**
   * ⛔ **IL BUNDLE VECCHIO SI FERMA, NON FA L'OPPOSTO** — rilievo della revisione del 24/8, ed era
   * il difetto più grave della consegna. Il back office è un sito a parte: una scheda aperta
   * stamattina manda ancora `state`, e nella card vecchia scegliere «Rientrato/a» **lasciando le due
   * date piene** era il modo documentato di chiudere una vacanza. Ignorando il campo, quella stessa
   * mossa confermava la sospensione: menu fermi, scadenza allungata, e nessuno che sapesse perché.
   */
  it('⛔ un back office col bundle vecchio che manda ancora `state` si becca un errore parlante, e NON si sospende niente', async () => {
    const { service, pause, prisma } = await crea();
    await expect(
      service.setTravel('cli-1', 'coach-user', { ...vacanza('viaggio di lavoro'), state: 'rientrato' } as never),
    ).rejects.toThrow(/Ricarica la pagina/);
    expect(pause.sospendiPerViaggio).not.toHaveBeenCalled();
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });

  it('⛔ e vale anche per lo stato VUOTO: nella card vecchia «— nessuna —» con le date piene toglieva la sospensione', async () => {
    const { service, pause } = await crea();
    await expect(
      service.setTravel('cli-1', 'coach-user', { ...vacanza('viaggio'), state: '' } as never),
    ).rejects.toThrow(/Ricarica la pagina/);
    expect(pause.sospendiPerViaggio).not.toHaveBeenCalled();
  });

  it('⛔ e una già cominciata scrive «in vacanza»', async () => {
    const { service, prisma } = await crea();
    await service.setTravel('cli-1', 'coach-user', { start: fra(-2), rientro: fra(5), motivo: 'ricovero' });
    expect(prisma.clientProfile.upsert.mock.calls[0][0].update).toMatchObject({ travelState: 'in_vacanza' });
  });

  /**
   * ⛔ **IL RIENTRO NON SI SCRIVE PIÙ DA QUI.** L'evento `travel_return` accende la campagna di
   * rientro del marketing e il tono «bentornata» di Gaia: nasceva solo se qualcuno tornava sulla
   * scheda a cambiare la tendina — e per le sospensioni nate dall'app o dal Calendario non nasceva
   * mai. Adesso lo segna il giro notturno il giorno del rientro (`PauseService.surveillanceTick`).
   */
  it('⛔ salvare NON emette più il `travel_return`: quello è del giro notturno', async () => {
    const { service, prisma } = await crea();
    await service.setTravel('cli-1', 'coach-user', vacanza('viaggio di lavoro'));
    expect(prisma.analyticsEvent.create).not.toHaveBeenCalled();
  });
});

