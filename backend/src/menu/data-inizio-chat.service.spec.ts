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
import { conOrologioFermo } from '../../test/orologio-fermo';
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
  /** `plan_start_change_lock_hours`: le ore entro cui la data non si sposta più. Default 24. */
  oreBlocco?: number;
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
      {
        provide: ConfigParamsService,
        // Due parametri diversi: le ore di blocco e i giorni di sblocco del menu. Rispondere lo
        // stesso numero a entrambi confonderebbe i due limiti, che ora sono davvero diversi (24h
        // contro 2 giorni).
        useValue: {
          getString: jest.fn(async (_k: string, d?: string) => d),
          getNumber: jest.fn().mockImplementation((chiave: string, def: number) =>
            Promise.resolve(chiave === 'plan_start_change_lock_hours' ? (opzioni.oreBlocco ?? 24) : def),
          ),
        },
      },
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
    /**
     * ⚠️ **E LO STATO** (19/8, voce 258). Questo era il quinto punto che scrive la data d'inizio di
     * un piano, e l'unico rimasto a non toccare `status`: da qui passano la chat con Gaia e il
     * pulsante nel profilo, cioè le due strade della cliente. Una data spostata fra venti giorni
     * lasciava un piano `active` con la partenza nel futuro — la forma ambigua che questa voce
     * toglie di mezzo — e quella riga non sarebbe mai entrata nella promozione notturna, che cerca
     * i `queued`.
     */
    expect(sub.data.status).toBe('queued');
  });

  /** ⚠️ E una data di OGGI fa partire il piano adesso, non alla passata notturna. */
  it('⚠️ spostata a oggi, il piano risulta ATTIVO subito', async () => {
    const { service, prisma } = await crea();
    await service.avanza('cli-1', { passo: 'conferma', data: traIso(0) }, 'sì');
    expect(prisma.subscription.update.mock.calls.at(-1)?.[0].data.status).toBe('active');
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

/**
 * IL CONFINE STRETTO ALLA FINESTRA DI SBLOCCO (11/8).
 *
 * Il 10/8 la regola era «finché il piano non parte». Poi lo stesso limite è comparso sul pulsante nel
 * profilo dell'app — «fino a 48 ore prima» — e due regole diverse per la stessa azione (Gaia più
 * permissiva dell'app) è come si ottiene «Gaia me la sposta e dall'app non si può».
 *
 * Le 48 ore non sono un numero a caso: sono la finestra con cui il menu si sblocca. Prima, spostare
 * la data non costa niente; dopo, la cliente ha già i menu davanti e magari ha fatto la spesa.
 */
describe('Gaia dentro la finestra di blocco prima dell\'inizio', () => {
  /**
   * Il blocco è in ORE e si conta dall'istante, non dal giorno: «manca meno di un giorno» alle 23:00
   * e a mezzanotte non è la stessa cosa, e arrotondare regalerebbe o ruberebbe mezza giornata a
   * seconda di quando la cliente apre l'app.
   */
  /**
   * ⛔ **IL BLOCCO SI DICHIARA, NON SI DEDUCE DA «DOMANI»** — 24/8.
   *
   * Queste fixture usavano `fra(1)` come sinonimo di «dentro il blocco di 24 ore», e per 364 giorni
   * l'anno è vero: alle 00:30 la mezzanotte di domani è a 23 ore e mezza. ⛔ Ma la notte del **25
   * ottobre 2026** le lancette tornano indietro, il giorno dura **25 ore**, e domani è a **24 ore e
   * mezza**: fuori dal blocco. Il servizio rispondeva «si può ancora spostare», ed era **letteralmente
   * vero** — il blocco è in ORE e si conta dall'istante, come dice il commento qui sopra. Era la
   * fixture a dire 24 e a prepararne 24 e mezza.
   *
   * `oreBlocco: 25` dichiara quello che il caso vuole dire — «siamo dentro la finestra» — invece di
   * dedurlo da una distanza che due volte l'anno cambia. È lo stesso modo del caso a due giorni, che
   * scrive `oreBlocco: 72` accanto a `fra(2)`.
   *
   * ⚠️ Una cosa vera e voluta, scritta perché non sembri un difetto: quella notte, fra le 00:00 e
   * l'01:00 di Roma, **nessun giorno d'inizio è dentro le 24 ore** — la mezzanotte di oggi è passata,
   * quella di domani è a 24:30. Per un'ora il blocco è aperto. Alla cliente non succede niente di
   * male: ha davvero ventiquattr'ore e mezza davanti, e a due giorni il prodotto lascia spostare
   * comunque. Se un giorno la regola dovesse voler dire «dalla mezzanotte del giorno prima» invece
   * che «24 ore», è una riga che cambia — e non la decide un test.
   */
  it('a poche ore dall\'inizio non sposta più niente e passa alla coach', async () => {
    const { service, prisma, menu } = await crea({
      subs: [{ id: 'sub-1', status: 'active', startDate: fra(1), endDate: fra(91), plan: { period: '3m' }, createdAt: new Date() }],
      planStartDate: fra(1),
      oreBlocco: 25,
    });
    const esito = await service.apriDaTesto('cli-1', 'posso spostare la data di inizio?');
    expect(esito.esito).toBe('arresa');
    expect(esito.inoltraA).toBe('coach');
    // La frase dice che manca poco E che la coach può farlo: «non si può» da solo sembrerebbe una
    // porta chiusa.
    expect(esito.testo).toMatch(/Ci siamo quasi/i);
    expect(esito.testo).toMatch(/coach/i);
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
    expect(menu.regenerateFromToday).not.toHaveBeenCalled();
  });

  /**
   * A due giorni si sposta ancora, ed è la differenza col confine di ieri: il menu è già sbloccato
   * (2 giorni prima) ma la data si muove ancora. Scelta di Simone — quei menu vengono rifatti.
   */
  it('a due giorni si sposta ancora, anche se il menu è già visibile', async () => {
    const { service } = await crea({
      subs: [{ id: 'sub-1', status: 'active', startDate: fra(2), endDate: fra(92), plan: { period: '3m' }, createdAt: new Date() }],
      planStartDate: fra(2),
    });
    const esito = await service.apriDaTesto('cli-1', 'posso spostare la data di inizio?');
    expect(esito.esito).toBe('aperto');
    expect(esito.stato?.passo).toBe('data');
  });

  /** Il limite segue il PARAMETRO: portandolo a 72 ore, a due giorni dall'inizio è già chiuso. */
  it('con un blocco più lungo il limite si allarga con lui', async () => {
    const { service } = await crea({
      subs: [{ id: 'sub-1', status: 'active', startDate: fra(2), endDate: fra(92), plan: { period: '3m' }, createdAt: new Date() }],
      planStartDate: fra(2),
      oreBlocco: 72,
    });
    const esito = await service.apriDaTesto('cli-1', 'posso spostare la data di inizio?');
    expect(esito.esito).toBe('arresa');
    expect(esito.inoltraA).toBe('coach');
  });

  /** E il ricontrollo alla conferma vale anche per questo: il tempo passa fra la proposta e il «sì». */
  it('alla conferma, se siamo dentro il blocco, non si applica', async () => {
    const { service, prisma } = await crea({
      subs: [{ id: 'sub-1', status: 'active', startDate: fra(1), endDate: fra(91), plan: { period: '3m' }, createdAt: new Date() }],
      planStartDate: fra(1),
      oreBlocco: 25,
    });
    const esito = await service.avanza('cli-1', { passo: 'conferma', data: traIso(20) }, 'sì');
    expect(esito.esito).toBe('arresa');
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });
});

/**
 * LO STESSO SPOSTAMENTO, DAL PROFILO DELL'APP (richiesta dell'11/8).
 *
 * Il rischio di avere due strade per la stessa azione è che divergano: una accetta e l'altra nega,
 * o una scrive due cose su tre. Questi test fissano che la regola sia **una**, letta dal solito
 * parametro, e che le scritture passino per lo stesso codice della chat.
 */
describe('data di inizio dal profilo dell\'app', () => {
  it('dice che si può, e con quali limiti, senza scrivere niente', async () => {
    const { service, prisma } = await crea();
    const stato = await service.statoPerApp('cli-1');

    expect(stato.puo).toBe(true);
    expect(stato.inizio).toBe(traIso(10));
    expect(stato.oreDiBlocco).toBe(24);
    expect(stato.massimoGiorniAvanti).toBe(60);
    // Il primo giorno scegliibile è OGGI, non «oggi + 24h»: il blocco riguarda quanto manca
    // all'inizio attuale, non quanto è vicina la data nuova.
    expect(stato.minimoSelezionabile).toBe(traIso(0));
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });

  it('a piano già partito lo dice PRIMA, così l\'app non mostra un pulsante che non funziona', async () => {
    const { service } = await crea({
      subs: [{ id: 'sub-1', status: 'active', startDate: fra(-5), endDate: fra(85), plan: { period: '3m' }, createdAt: new Date() }],
      planStartDate: fra(-5),
    });
    const stato = await service.statoPerApp('cli-1');
    expect(stato.puo).toBe(false);
    expect(stato.perche).toBe('gia_partito');
  });

  it('dentro la finestra dice «troppo tardi» e quante ore mancano davvero', async () => {
    const { service } = await crea({
      subs: [{ id: 'sub-1', status: 'active', startDate: fra(1), endDate: fra(91), plan: { period: '3m' }, createdAt: new Date() }],
      planStartDate: fra(1),
      oreBlocco: 25,
    });
    const stato = await service.statoPerApp('cli-1');
    expect(stato.puo).toBe(false);
    expect(stato.perche).toBe('troppo_tardi');
    /**
     * ⚠️ 25 e non 24: la mezzanotte di domani dista **da 0 a 25 ore**, e non dipende dalla stagione —
     * dipende dall'**ora** in cui gira la suite. A mezzogiorno sono 12, alle 23:45 sono 15 minuti; le
     * 25 sono il caso alto, la notte in cui le lancette tornano indietro.
     *
     * ⛔ **E per questo non c'è nessun limite INFERIORE da mettere qui.** La prima stesura di questa
     * correzione ci aveva aggiunto `toBeGreaterThan(0)`, e l'ha bocciata la revisione misurandolo:
     * dopo le **23:30** di Roma quella distanza scende sotto la mezz'ora, `Math.round` fa **0**, e il
     * file diventava rosso — **mezz'ora al giorno, tutti i giorni**. Cioè la consegna che chiude i
     * test che dipendono dall'ora ne creava uno nuovo, in un file che nella sua stessa intestazione
     * racconta quel difetto. Il numero esatto lo difende il caso a orologio fermo qui sotto
     * (`oreMancanti conta fino alla mezzanotte italiana: 24, non 26`), che è il posto giusto: senza
     * orologio fermo, un'asserzione su un numero che cambia ogni minuto non è una rete.
     */
    expect(stato.oreMancanti).toBeLessThanOrEqual(25);
  });

  it('spostando dall\'app scrive le STESSE tre cose della chat', async () => {
    const { service, prisma, audit, menu } = await crea();
    const r = await service.spostaDaApp('cli-1', traIso(20));

    expect(r.inizio).toBe(traIso(20));
    expect(scritta(prisma)).toBe(traIso(20));
    const sub = prisma.subscription.update.mock.calls[0][0];
    expect(iso(sub.data.startDate)).toBe(traIso(20));
    expect(iso(sub.data.endDate)).toBe(iso(subscriptionEnd(toDateOnly(traIso(20)), '3m')));
    expect(menu.regenerateFromToday).toHaveBeenCalledWith('cli-1');
    // L'audit distingue la strada: serve per rispondere a «l'ha spostata lei o Gaia?».
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ origine: 'app' }) }));
  });

  it('rifiuta con un errore parlante, non con una frase di Gaia', async () => {
    const { service, prisma } = await crea({
      subs: [{ id: 'sub-1', status: 'active', startDate: fra(1), endDate: fra(91), plan: { period: '3m' }, createdAt: new Date() }],
      planStartDate: fra(1),
      oreBlocco: 25,
    });
    await expect(service.spostaDaApp('cli-1', traIso(20))).rejects.toMatchObject({ status: 409 });
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });

  it('una data passata o troppo lontana si ferma a 400, non arriva al database', async () => {
    const { service, prisma } = await crea();
    await expect(service.spostaDaApp('cli-1', traIso(-1))).rejects.toMatchObject({ status: 400 });
    await expect(service.spostaDaApp('cli-1', traIso(90))).rejects.toMatchObject({ status: 400 });
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });

  it('spostare a domani è permesso: è la data NUOVA, non il ritardo', async () => {
    // La cliente ha l'inizio fra 10 giorni (fuori dal blocco) e vuole partire domani: legittimo.
    const { service } = await crea();
    const r = await service.spostaDaApp('cli-1', traIso(1));
    expect(r.inizio).toBe(traIso(1));
  });
});

/**
 * ⛔ **LE 24 ORE DI BLOCCO SONO 24, ANCHE ALLE 00:30** — difetto trovato il 23/8 con `test:notte`.
 *
 * Il piano parte alla mezzanotte che intende la cliente, cioè quella di **Roma**. Il conto delle ore
 * che mancavano partiva invece da `toDateOnly(inizio)`, che di quel giorno dà le `00:00Z` — **le
 * 02:00 italiane**. Il blocco dichiarato di 24 ore ne durava **22** (23 d'inverno), tutti i giorni.
 *
 * ⚠️ Sbagliava nel verso che costa: nelle ultime due ore utili l'app mostrava il pulsante acceso e
 * Gaia si offriva di spostare, e la data si muoveva **dentro** la finestra che il blocco esiste per
 * proteggere — con i menu già sbloccati e magari la spesa già fatta. E lo stesso conto risponde a
 * `oreMancanti`, il numero che la cliente **legge**: le diceva due ore in più di quelle che aveva.
 *
 * ⚠️ Perché non si vedeva: per 22 ore su 24 le due mezzanotti cadono dalla stessa parte di «adesso»
 * e lo scarto non attraversa mai la soglia. Questi test **scrivono l'ora**, invece di prendere quella
 * in cui capita di girare la suite: un test che dipende dall'ora è verde 22 volte su 24, ed è così
 * che questo difetto è vissuto per due settimane.
 */
describe('⛔ il blocco si conta dalla mezzanotte di ROMA', () => {
  /** 00:30 del 23 agosto a Roma. Per UTC è ancora il 22: è la fascia in cui i due giorni divergono. */
  const NOTTE = new Date('2026-08-22T22:30:00.000Z');

  conOrologioFermo(NOTTE);

  /** Il piano comincia domani: alle 00:30 mancano 23 ore e mezza, cioè meno di 24. Si è dentro. */
  const domani = () => ({
    subs: [{ id: 'sub-1', status: 'active', startDate: fra(1), endDate: fra(91), plan: { period: '3m' }, createdAt: new Date() }],
    planStartDate: fra(1),
  });

  it('⛔ alle 00:30 del giorno prima si è GIÀ dentro il blocco (mancano 23:30, non 25:30)', async () => {
    const { service } = await crea(domani());
    const stato = await service.statoPerApp('cli-1');
    expect(stato.puo).toBe(false);
    expect(stato.perche).toBe('troppo_tardi');
  });

  /**
   * ⛔ **E il numero che la cliente legge è quello vero.** 23.5 arrotondate fanno 24; contando dalla
   * mezzanotte UTC ne uscivano 26 — due ore che non esistono, dette a chi sta decidendo se fare la
   * spesa.
   */
  it('⛔ `oreMancanti` conta fino alla mezzanotte italiana: 24, non 26', async () => {
    const { service } = await crea({ ...domani(), oreBlocco: 30 });
    const stato = await service.statoPerApp('cli-1');
    expect(stato.perche).toBe('troppo_tardi');
    expect(stato.oreMancanti).toBe(24);
  });

  /**
   * ⛔ **UNA CODA PORTA UN ISTANTE VERO, E IL CONTO LO RISPETTA.**
   *
   * `Subscription.startDate` di un piano in coda è la **scadenza** di quello di prima. E
   * `subscriptionEnd`, partendo da un giorno, quella scadenza la produce a mezzanotte UTC **esatta**:
   * indistinguibile, guardando solo il valore, da un giorno scritto da `toDateOnly`.
   *
   * ⛔ Una versione di stamattina li distingueva così — «mezzanotte UTC esatta = un giorno» — e per
   * le code faceva scattare il blocco **un'ora prima** (due d'estate) di quando doveva, togliendo
   * tempo alla cliente e mostrandole un `oreMancanti` più basso del vero. L'ha trovato la revisione.
   * Adesso la provenienza si **sa** invece di indovinarla: la dice `status`.
   *
   * Qui la coda parte a mezzanotte UTC del 24, cioè fra 25 ore e mezza: si può ancora spostare.
   */
  it('⛔ una CODA che parte a mezzanotte UTC esatta si conta sull\'istante, non sul giorno di Roma', async () => {
    const { service } = await crea({
      subs: [{
        id: 'sub-coda', status: 'queued',
        startDate: new Date('2026-08-24T00:00:00.000Z'), // ereditata da `endDate` del piano di prima
        endDate: new Date('2026-11-24T00:00:00.000Z'),
        plan: { period: '3m' }, createdAt: new Date(),
      }],
      planStartDate: new Date('2026-08-24T00:00:00.000Z'),
    });
    const stato = await service.statoPerApp('cli-1');
    expect(stato.puo).toBe(true);
  });

  /** ⚠️ Il confine si sposta, non sparisce: a due giorni si può ancora, anche a quell'ora. */
  it('⚠️ a due giorni dall\'inizio, alle 00:30, si può ancora spostare', async () => {
    const { service } = await crea({
      subs: [{ id: 'sub-1', status: 'active', startDate: fra(2), endDate: fra(92), plan: { period: '3m' }, createdAt: new Date() }],
      planStartDate: fra(2),
    });
    expect((await service.statoPerApp('cli-1')).puo).toBe(true);
  });

  /**
   * ⛔ **E LO STATO SCRITTO, che è l'altra metà della correzione** (aggiunto in revisione: il quinto
   * punto che scrive la data d'inizio era l'unico rimasto senza una prova che dicesse **che ora è**).
   *
   * `d` qui è `toDateOnly(data)`, cioè un **giorno**: mezzanotte UTC del giorno di Roma, che sono le
   * 02:00 italiane. Confrontata con «adesso» come un istante, alle 00:30 una data spostata a **oggi**
   * lasciava il piano `queued` — e i menu arrivavano alla passata notturna dopo, cioè un giorno più
   * tardi di quello che Gaia aveva appena confermato in chat.
   */
  it('⛔ spostata a OGGI alle 00:30, il piano risulta ATTIVO — non alla passata notturna', async () => {
    const { service, prisma } = await crea();
    await service.avanza('cli-1', { passo: 'conferma', data: traIso(0) }, 'sì');
    expect(prisma.subscription.update.mock.calls.at(-1)?.[0].data.status).toBe('active');
  });

  it('⚠️ mentre spostata a DOMANI, alla stessa ora, va in coda', async () => {
    const { service, prisma } = await crea();
    await service.avanza('cli-1', { passo: 'conferma', data: traIso(1) }, 'sì');
    expect(prisma.subscription.update.mock.calls.at(-1)?.[0].data.status).toBe('queued');
  });

  /**
   * ⛔ **E la stessa risposta dalle due strade.** Il difetto stava in un punto solo, ma quel punto lo
   * leggono sia il pulsante dell'app sia Gaia: se una delle due avesse risposto diverso, sarebbe
   * ricomparso «Gaia me la sposta e dall'app non si può».
   */
  it('⛔ Gaia dice la stessa cosa del pulsante, alla stessa ora', async () => {
    const { service, prisma } = await crea(domani());
    const esito = await service.apriDaTesto('cli-1', 'posso spostare la data di inizio?');
    expect(esito.esito).toBe('arresa');
    expect(esito.inoltraA).toBe('coach');
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });
});
