import { AuditService } from '../audit/audit.service';
import { ConfigService } from '@nestjs/config';
import { ConfigParamsService } from '../config-params/config-params.service';
import { DiscountsService } from '../commerce/discounts.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { LifecycleService } from './lifecycle.service';
import { TETTO_MASSIMO, chiaveRichiamo, giorniIndietro, giriDelRichiamo } from './richiamo-ricorrente';

/**
 * ⛔ **IL RICHIAMO OGNI DUE MESI** (Simone, 12/9: «anche alla coach, una notifica di marketing ogni
 * 2 mesi basta — se un cliente non ha piani attivi va staccato tutto»).
 *
 * È l'altra metà della decisione: da un lato il giro notturno smette di scrivere a chi non ha più
 * un piano, dall'altro resta questo, e solo questo.
 */
describe('Richiamo ricorrente — i giri', () => {
  it('con 60 giorni e 6 volte: sei giri, a due mesi di distanza l\'uno dall\'altro', () => {
    expect(giriDelRichiamo(60, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(giriDelRichiamo(60, 6).map((n) => giorniIndietro(n, 60)))
      .toEqual([-60, -120, -180, -240, -300, -360]);
  });

  /**
   * ⛔ Con cadenza `0` il primo giro sarebbe `dayRange(0)`: il richiamo partirebbe **il giorno
   * stesso** in cui il percorso finisce, mentre la cliente ha ancora l'app aperta. Zero spegne.
   */
  it('⛔ cadenza o tetto a zero spengono il richiamo, non lo fanno impazzire', () => {
    expect(giriDelRichiamo(0, 6)).toEqual([]);
    expect(giriDelRichiamo(60, 0)).toEqual([]);
    expect(giriDelRichiamo(-60, 6)).toEqual([]);
    expect(giriDelRichiamo(Number.NaN, 6)).toEqual([]);
  });

  /**
   * ⛔ **I DUE NUMERI SI DIGITANO DAL BACKOFFICE**, quindi qui arriva quello che qualcuno ha
   * battuto. Il caso che fa male non è il tetto sbagliato: è `Infinity`, che passa il `< 1` e fa
   * **lanciare** `Array.from` — cioè lo scan del ciclo di vita che muore in mezzo, portandosi
   * dietro gli altri inneschi del giro. La prova sui valori assurdi copriva solo la cadenza.
   */
  it('⛔ e un tetto assurdo non fa cadere lo scan', () => {
    expect(giriDelRichiamo(60, Number.NaN)).toEqual([]);
    expect(giriDelRichiamo(60, Number.POSITIVE_INFINITY)).toEqual([]);
    expect(giriDelRichiamo(Number.POSITIVE_INFINITY, 6)).toEqual([]);
    expect(giriDelRichiamo(60, 1000000)).toHaveLength(TETTO_MASSIMO);
  });

  /**
   * ⚠️ **Un numero frazionario non si arrotonda in silenzio.** Una cadenza `1.5` passerebbe il
   * `< 1` e `dayRange(-1.5)` guarda una finestra da mezzogiorno a mezzogiorno (`oggiPiu` non
   * arrotonda): certe coorti lette due volte, altre mai. E un tetto `6.7` arrotondato per eccesso
   * o per difetto è un'email di marketing in più o in meno a ogni ex cliente.
   */
  it('⚠️ mezzo giorno di cadenza, o mezzo giro, spengono invece di arrotondare', () => {
    expect(giriDelRichiamo(1.5, 6)).toEqual([]);
    expect(giriDelRichiamo(60, 6.7)).toEqual([]);
  });

  /**
   * ⛔ **La chiave cambia a ogni giro, e questo è il caso che lo dice.** `lifecycle_email` è unica
   * su (utente, chiave): con una chiave costante il secondo richiamo risulterebbe già inviato e ne
   * partirebbe **uno solo in tutto** — un difetto invisibile per due mesi, che poi sembra un
   * problema di consegna della posta.
   */
  it('⛔ due giri, due chiavi diverse', () => {
    const chiavi = giriDelRichiamo(60, 6).map((n) => chiaveRichiamo('sub-1', n));
    expect(new Set(chiavi).size).toBe(6);
    expect(chiavi[0]).toBe('wb_ricorrente:sub-1:1');
  });

  it('due clienti diverse non si rubano la chiave a vicenda', () => {
    expect(chiaveRichiamo('sub-1', 1)).not.toBe(chiaveRichiamo('sub-2', 1));
  });
});

describe('Richiamo ricorrente — l\'interruttore', () => {
  function servizio(triggers: Record<string, boolean>) {
    const prisma = {
      lifecycleSettings: { findUnique: jest.fn().mockResolvedValue({ enabled: true, triggers, lastRunAt: null }) },
      lifecycleEmail: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    return new LifecycleService(
      prisma as unknown as PrismaService,
      {} as MailService,
      {} as AuditService,
      { get: jest.fn() } as unknown as ConfigService,
      {} as DiscountsService,
      {} as ConfigParamsService,
    );
  }

  /**
   * ⚠️ **Nasce spento, come `trial_g6_offer`.** Il primo giro dopo l'accensione scrive a tutte le
   * ex clienti il cui piano è scaduto da 60, 120, … giorni: è una campagna, e una campagna si
   * accende quando qualcuno decide, non perché è stata distribuita.
   */
  it('⚠️ nasce SPENTO: il master acceso non basta', async () => {
    const voce = (await servizio({}).overview()).catalog.find((t) => t.key === 'wb_ricorrente');
    expect(voce).toBeDefined();
    expect(voce?.on).toBe(false);
    // ⚠️ E dev'essere `implemented`, o resta una riga in vetrina che non manda niente.
    expect(voce?.implemented).toBe(true);
  });

  it('acceso a mano dal backoffice, parte', async () => {
    const voce = (await servizio({ wb_ricorrente: true }).overview()).catalog.find((t) => t.key === 'wb_ricorrente');
    expect(voce?.on).toBe(true);
  });

  /**
   * ⚠️ Controprova: un innesco normale è acceso di default. Senza, un `isTriggerOn` sempre falso
   * passerebbe il caso qui sopra.
   */
  it('un innesco normale invece è acceso di suo', async () => {
    const voce = (await servizio({}).overview()).catalog.find((t) => t.key === 'wb_t3');
    expect(voce?.on).toBe(true);
  });
});
