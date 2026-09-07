/**
 * Le barre per coach: le due cose che si sbagliano sono **in che mese cade una riga** e **a chi si
 * attribuisce**. Qui si verificano con date fisse, senza database e senza aspettare la mezzanotte.
 */
import { barrePerMese, meseDi } from './barre-coach';

const ANNA = 'staff-anna';
const BRUNA = 'staff-bruna';
const FUORI = 'staff-fuori-rete';
const RETE = [
  { staffId: ANNA, nome: 'Anna' },
  { staffId: BRUNA, nome: 'Bruna' },
];
const MESI = ['2026-07', '2026-08', '2026-09'];

const barra = (mese: string, staffId: string, out: ReturnType<typeof barrePerMese>) =>
  out[mese].find((b) => b.staffId === staffId)!;

describe('barre per coach', () => {
  it('⛔ il mese è quello di Roma: un incasso delle 00:30 del 1° settembre è di SETTEMBRE, non di agosto', () => {
    // 2026-08-31T22:30:00Z = 1 settembre 00:30 a Roma (UTC+2).
    const mezzanotteEMezza = new Date('2026-08-31T22:30:00.000Z');
    expect(meseDi(mezzanotteEMezza)).toBe('2026-09');

    const out = barrePerMese({
      mesi: MESI,
      coach: RETE,
      incassi: [{ coachStaffId: ANNA, amountCents: 29900, quando: mezzanotteEMezza }],
      compensi: [{ staffId: ANNA, amountCents: 2990, quando: mezzanotteEMezza }],
    });
    expect(barra('2026-09', ANNA, out).fatturatoCents).toBe(29900);
    expect(barra('2026-09', ANNA, out).provvigioniCents).toBe(2990);
    expect(barra('2026-08', ANNA, out).fatturatoCents).toBe(0);
  });

  it('⛔ l’ultimo istante del mese resta nel mese: le 23:30 del 31 agosto a Roma sono agosto', () => {
    const out = barrePerMese({
      mesi: MESI,
      coach: RETE,
      // 2026-08-31T21:30:00Z = 31 agosto 23:30 a Roma.
      incassi: [{ coachStaffId: BRUNA, amountCents: 10000, quando: new Date('2026-08-31T21:30:00.000Z') }],
      compensi: [],
    });
    expect(barra('2026-08', BRUNA, out).fatturatoCents).toBe(10000);
    expect(barra('2026-09', BRUNA, out).fatturatoCents).toBe(0);
  });

  it('ogni coach della rete ha la sua barra in OGNI mese, anche a zero', () => {
    const out = barrePerMese({ mesi: MESI, coach: RETE, incassi: [], compensi: [] });
    for (const mese of MESI) {
      expect(out[mese].map((b) => b.nome).sort()).toEqual(['Anna', 'Bruna']);
      expect(out[mese].every((b) => b.fatturatoCents === 0 && b.provvigioniCents === 0)).toBe(true);
    }
  });

  it('⛔ chi non è nella rete non compare, e non finisce nel mucchio di qualcun altro', () => {
    const out = barrePerMese({
      mesi: MESI,
      coach: RETE,
      incassi: [{ coachStaffId: FUORI, amountCents: 50000, quando: new Date('2026-08-10T09:00:00.000Z') }],
      compensi: [{ staffId: FUORI, amountCents: 5000, quando: new Date('2026-08-10T09:00:00.000Z') }],
    });
    expect(out['2026-08'].map((b) => b.staffId)).toEqual([ANNA, BRUNA]);
    expect(out['2026-08'].reduce((a, b) => a + b.fatturatoCents, 0)).toBe(0);
    expect(out['2026-08'].reduce((a, b) => a + b.provvigioniCents, 0)).toBe(0);
  });

  it('una cliente senza coach assegnata non viene attribuita a nessuno', () => {
    const out = barrePerMese({
      mesi: MESI,
      coach: RETE,
      incassi: [{ coachStaffId: null, amountCents: 79700, quando: new Date('2026-08-10T09:00:00.000Z') }],
      compensi: [{ staffId: null, amountCents: 7970, quando: new Date('2026-08-10T09:00:00.000Z') }],
    });
    expect(out['2026-08'].reduce((a, b) => a + b.fatturatoCents + b.provvigioniCents, 0)).toBe(0);
  });

  it('più righe della stessa coach nello stesso mese si sommano; mesi diversi restano separati', () => {
    const out = barrePerMese({
      mesi: MESI,
      coach: RETE,
      incassi: [
        { coachStaffId: ANNA, amountCents: 29900, quando: new Date('2026-08-03T10:00:00.000Z') },
        { coachStaffId: ANNA, amountCents: 13000, quando: new Date('2026-08-20T10:00:00.000Z') },
        { coachStaffId: ANNA, amountCents: 49700, quando: new Date('2026-07-05T10:00:00.000Z') },
      ],
      compensi: [],
    });
    expect(barra('2026-08', ANNA, out).fatturatoCents).toBe(42900);
    expect(barra('2026-07', ANNA, out).fatturatoCents).toBe(49700);
  });

  it('⚠️ uno storno resta NEGATIVO: un mese di soli storni non si spaccia per un mese a zero', () => {
    const out = barrePerMese({
      mesi: MESI,
      coach: RETE,
      incassi: [],
      compensi: [
        { staffId: BRUNA, amountCents: 3000, quando: new Date('2026-08-04T10:00:00.000Z') },
        { staffId: BRUNA, amountCents: -5000, quando: new Date('2026-08-25T10:00:00.000Z') },
      ],
    });
    expect(barra('2026-08', BRUNA, out).provvigioniCents).toBe(-2000);
  });

  it('le righe fuori dai mesi chiesti si scartano: non si inventa un mese che la tendina non ha', () => {
    const out = barrePerMese({
      mesi: MESI,
      coach: RETE,
      incassi: [{ coachStaffId: ANNA, amountCents: 99900, quando: new Date('2026-03-10T10:00:00.000Z') }],
      compensi: [],
    });
    expect(Object.keys(out).sort()).toEqual(MESI);
    expect(out['2026-07'].concat(out['2026-08'], out['2026-09']).reduce((a, b) => a + b.fatturatoCents, 0)).toBe(0);
  });
});
