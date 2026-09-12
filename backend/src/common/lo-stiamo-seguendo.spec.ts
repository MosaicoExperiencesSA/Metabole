import { aGiorno, giornoLocale, inizioDelGiorno } from './date-only';
import { PrismaService } from '../prisma/prisma.service';
import { TIMER_VERI } from '../../test/orologio-fermo';
import { loStiamoSeguendo } from './lo-stiamo-seguendo';

/**
 * ⛔ **LA DOMANDA CHE SPEGNE TUTTO IL RESTO** (Simone, 12/9: «se un cliente non ha piani attivi va
 * staccato tutto»). La chiedono tre organi — il giro notturno delle notifiche, il gate delle misure
 * e la coda della coach — e le loro prove non possono coprire il **giorno di confine** senza
 * ripetersi tre volte: quello si prova qui, una volta sola.
 */
describe('Lo stiamo ancora seguendo?', () => {
  const giorno = (n: number) => new Date(aGiorno(new Date()).getTime() + n * 86_400_000);

  const prismaFinto = (piani: unknown[], monitoraggio: unknown = null) => ({
    subscription: { findMany: jest.fn().mockResolvedValue(piani) },
    monitoringPeriod: { findFirst: jest.fn().mockResolvedValue(monitoraggio) },
  }) as unknown as PrismaService;

  afterEach(() => { jest.useRealTimers(); });

  /** Ferma l'orologio a un'ora precisa del giorno in corso, restando nel fuso di Roma. */
  const alle = (ora: number) => {
    const istante = new Date(inizioDelGiorno(giornoLocale(new Date())).getTime() + ora * 3_600_000);
    jest.useFakeTimers({ doNotFake: TIMER_VERI as never, now: istante });
  };

  /**
   * ⛔ **L'ULTIMO GIORNO DEL PERCORSO È ANCORA UN GIORNO DI PERCORSO** — ed è l'unico giorno su cui
   * `>=` e `>` danno risposte diverse. Nessuna fixture dei tre organi ce l'aveva: mettendo `>` al
   * posto di `>=` restava tutto verde, e una cliente si sarebbe vista staccare notifiche, gate e
   * coda della coach nel giorno in cui sta ancora usando l'app.
   */
  it('⛔ il piano finisce OGGI: la stiamo ancora seguendo', async () => {
    const prisma = prismaFinto([{ status: 'active', startDate: giorno(-30), endDate: giorno(0) }]);
    expect(await loStiamoSeguendo(prisma, 'u1')).toBe(true);
  });

  it('il piano è finito IERI: non più', async () => {
    const prisma = prismaFinto([{ status: 'active', startDate: giorno(-30), endDate: giorno(-1) }]);
    expect(await loStiamoSeguendo(prisma, 'u1')).toBe(false);
  });

  /**
   * ⛔ **E la risposta non deve dipendere dall'ORA.** `endDate` è una colonna DATE, cioè mezzanotte:
   * confrontarla con l'istante invece che con `aGiorno(oggi)` staccherebbe alle 00:01 chi il
   * percorso ce l'ha fino a stasera. È il difetto «mezzanotte contro istante» che questo
   * sottosistema ha già pagato quattro volte.
   */
  it('⛔ e la risposta è la stessa alle 00:30 e alle 23:30', async () => {
    const conFineOggi = () => prismaFinto([{ status: 'active', startDate: giorno(-30), endDate: giorno(0) }]);
    alle(0.5);
    expect(await loStiamoSeguendo(conFineOggi(), 'u1')).toBe(true);
    alle(23.5);
    expect(await loStiamoSeguendo(conFineOggi(), 'u1')).toBe(true);
  });

  /** ⚠️ Un piano senza scadenza non finisce mai. */
  it('un piano senza scadenza vale sempre', async () => {
    const prisma = prismaFinto([{ status: 'active', startDate: giorno(-300), endDate: null }]);
    expect(await loStiamoSeguendo(prisma, 'u1')).toBe(true);
  });

  /**
   * ⚠️ `attivoInCorso` restituisce una riga anche a fine passata (per non far sparire il piano
   * dalla scheda di chi la guarda): un cancello scritto `if (!attivoInCorso(...))` sarebbe verde
   * proprio per chi deve fermare.
   */
  it('⚠️ un solo piano, scaduto: `attivoInCorso` lo restituisce, la risposta è no', async () => {
    const prisma = prismaFinto([{ status: 'active', startDate: giorno(-90), endDate: giorno(-30) }]);
    expect(await loStiamoSeguendo(prisma, 'u1')).toBe(false);
  });

  /** ⚠️ Il piano che comincia lunedì conta (voce 258): i menu di anteprima si compongono già. */
  it('⚠️ il piano comincia lunedì: conta', async () => {
    const prisma = prismaFinto([{ status: 'queued', startDate: giorno(2), endDate: giorno(32) }]);
    expect(await loStiamoSeguendo(prisma, 'u1')).toBe(true);
  });

  /**
   * ⛔ **IL MONITORAGGIO OMAGGIO NON È UN ABBONAMENTO** — `monitoring.service.start()` lo concede
   * solo a chi **non ha** nessuna riga in ballo. Guardando i soli abbonamenti, quella persona
   * risultava «senza piano» mentre `monitoring.service` le eroga i menu di rientro se il peso
   * risale: si sarebbe ricreato lo stato chiuso l'11/8 — i menu arrivano e nessuno chiede il peso.
   */
  it('⛔ monitoraggio omaggio: nessun abbonamento, ma la stiamo seguendo', async () => {
    const prisma = prismaFinto([], { id: 'mon-1' });
    expect(await loStiamoSeguendo(prisma, 'u1')).toBe(true);
  });

  it('un monitoraggio già scaduto non la tiene dentro', async () => {
    const prisma = prismaFinto([], null); // il `where` chiede status active e endsAt nel futuro
    expect(await loStiamoSeguendo(prisma, 'u1')).toBe(false);
  });

  /**
   * ⚠️ **Il monitoraggio si chiede solo se serve.** Con un piano in corso la seconda lettura è
   * lavoro buttato, e questa funzione la chiamano tre organi su ogni cliente ogni notte.
   */
  it('⚠️ con un piano in corso non si legge nemmeno il monitoraggio', async () => {
    const prisma = prismaFinto([{ status: 'active', startDate: giorno(-1), endDate: giorno(30) }]);
    await loStiamoSeguendo(prisma, 'u1');
    expect((prisma as unknown as { monitoringPeriod: { findFirst: jest.Mock } }).monitoringPeriod.findFirst)
      .not.toHaveBeenCalled();
  });

  /**
   * ⚠️ Chi ha già letto gli abbonamenti glieli passa: senza, `measurementGate` — che l'app chiama a
   * ogni apertura — farebbe due volte la stessa lettura.
   */
  it('⚠️ se i piani arrivano da fuori, il database non si tocca due volte', async () => {
    const prisma = prismaFinto([]);
    await loStiamoSeguendo(prisma, 'u1', [{ status: 'active', startDate: giorno(-1), endDate: giorno(30) }]);
    expect((prisma as unknown as { subscription: { findMany: jest.Mock } }).subscription.findMany)
      .not.toHaveBeenCalled();
  });
});
