import { fraseDellaTregua, treguaFraVacanze } from './tregua-fra-vacanze';
import type { PrismaService } from '../prisma/prisma.service';
import { giornoLocale } from '../common/date-only';

/**
 * ⛔ **QUINDICI GIORNI FRA UNA VACANZA E L'ALTRA** — decisione di Simone, 23/8.
 *
 * *«Dopo una vacanza, per 15 giorni non se ne può attivare un'altra: va chiesto alla coach, che
 * attiva a mano dal back office.»*
 *
 * ⚠️ La cosa che questi test tengono ferma più di tutte è **da quando si contano**: dal giorno di
 * RIENTRO, non dall'ultimo giorno di vacanza. Contando dall'ultimo giorno sospeso la tregua
 * finirebbe un giorno prima, e la regola varrebbe quattordici giorni invece di quindici — il tipo
 * di errore che nessuno nota finché non lo cerca.
 */

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const giorno = (n: number) => D(giornoLocale(new Date(Date.now() + n * 86_400_000)));

const prismaCon = (precedente: { startDate: Date; endDate: Date } | null) =>
  ({
    event: { findFirst: jest.fn().mockResolvedValue(precedente) },
  }) as unknown as PrismaService;

const parametro = (valore: number) => async (_k: string, d: number) => (Number.isFinite(valore) ? valore : d);

describe('La tregua fra due vacanze', () => {
  it('senza vacanze precedenti è sempre libera', async () => {
    const esito = await treguaFraVacanze(prismaCon(null), parametro(15), 'c1', giorno(1));
    expect(esito.mancano).toBe(0);
    expect(esito.ultimoRientro).toBeNull();
  });

  it('rientrata ieri: mancano quattordici giorni', async () => {
    // Vacanza chiusa l'altroieri (`endDate`), quindi rientro IERI.
    const esito = await treguaFraVacanze(
      prismaCon({ startDate: giorno(-12), endDate: giorno(-2) }),
      parametro(15),
      'c1',
      giorno(0),
    );
    expect(esito.mancano).toBe(14);
    expect(esito.ultimoRientro?.toISOString().slice(0, 10)).toBe(giorno(-1).toISOString().slice(0, 10));
  });

  it('il quindicesimo giorno dal rientro è ancora tregua, il sedicesimo no', async () => {
    // Rientro esattamente 15 giorni fa → sono passati 15 → libera.
    const quindici = await treguaFraVacanze(
      prismaCon({ startDate: giorno(-30), endDate: giorno(-16) }),
      parametro(15),
      'c1',
      giorno(0),
    );
    expect(quindici.mancano).toBe(0);
    // Rientro 14 giorni fa → ne manca uno.
    const quattordici = await treguaFraVacanze(
      prismaCon({ startDate: giorno(-30), endDate: giorno(-15) }),
      parametro(15),
      'c1',
      giorno(0),
    );
    expect(quattordici.mancano).toBe(1);
  });

  /**
   * ⚠️ La tregua si misura sull'INIZIO della vacanza nuova, non su oggi: chi la prenota con un mese
   * di anticipo non deve trovarsi rifiutata per una vacanza finita ieri.
   */
  it('si conta dall\'inizio della vacanza nuova, non da oggi', async () => {
    const esito = await treguaFraVacanze(
      prismaCon({ startDate: giorno(-12), endDate: giorno(-2) }),
      parametro(15),
      'c1',
      giorno(30),
    );
    expect(esito.mancano).toBe(0);
  });

  it('messa a zero nei Parametri, la regola è spenta', async () => {
    const esito = await treguaFraVacanze(
      prismaCon({ startDate: giorno(-3), endDate: giorno(-1) }),
      parametro(0),
      'c1',
      giorno(0),
    );
    expect(esito.mancano).toBe(0);
    expect(esito.minimo).toBe(0);
  });

  it('la frase per la cliente dice i giorni, la data e a chi rivolgersi', () => {
    const testo = fraseDellaTregua({ mancano: 9, minimo: 15, ultimoRientro: D('2026-08-14') });
    expect(testo).toContain('15 giorni');
    expect(testo).toContain('ne mancano 9');
    expect(testo).toContain('14/08/2026');
    expect(testo).toContain('coach');
  });
});
