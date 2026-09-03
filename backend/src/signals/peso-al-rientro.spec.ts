/**
 * ⛔ **AL RIENTRO CONTA IL PESO DI PRIMA DI QUEL MOMENTO, NON I PIANI PRECEDENTI.**
 *
 * Regola di Simone, 3/9. Queste prove tengono ferme le tre conseguenze: quali pesate si contano,
 * quale peso vale, e quando un salto attraverso il rientro va segnalato.
 */
import { pesateDaContare, pesoCheValeAlRientro } from './peso-al-rientro';

const g = (giorno: string, kg: number) => ({ date: new Date(`${giorno}T09:00:00Z`), weightKg: kg });

/** Una storia vera: due mesi di piano, un mese di sospensione, il rientro il 1° settembre. */
const STORIA = [
  g('2026-07-01', 82), g('2026-07-08', 81), g('2026-07-15', 80.2),
  g('2026-07-29', 79.5),           // ← l'ultima prima della sospensione: il RIFERIMENTO
  g('2026-09-02', 83),             // ← la prima dopo il rientro
];
const RIENTRO = new Date('2026-09-01T00:00:00Z');

describe('pesateDaContare — la linea fra il periodo nuovo e quelli di prima', () => {
  it('⛔ il riferimento è l\'ULTIMA pesata prima dell\'inizio, non la prima e non la media', () => {
    const p = pesateDaContare(STORIA, RIENTRO);
    expect(p.riferimento?.weightKg).toBe(79.5);
    expect(p.delPeriodo.map((x) => x.weightKg)).toEqual([83]);
  });

  /**
   * ⚠️ *Niente tagli silenziosi*: chi legge un fabbisogno calcolato su una pesata invece che su
   * cinque deve poter sapere perché. E il riferimento **non** si conta fra le escluse: è tenuto.
   */
  it('⚠️ dice quante ne ha lasciate fuori, e il riferimento non è fra quelle', () => {
    expect(pesateDaContare(STORIA, RIENTRO).scartate).toBe(3);
  });

  /**
   * ⛔ Senza sapere dove tagliare non si taglia. Un modulo che «per prudenza» tagliasse lo stesso
   * toglierebbe dati a chi non ha mai sospeso — cioè a quasi tutte.
   */
  it('⛔ senza un inizio noto non divide niente, e non inventa un riferimento', () => {
    const p = pesateDaContare(STORIA, null);
    expect(p.delPeriodo).toHaveLength(5);
    expect(p.riferimento).toBeNull();
    expect(p.scartate).toBe(0);
  });

  /**
   * ⚠️ Il confine è incluso nel periodo nuovo: chi si pesa tornando descrive il corpo di adesso.
   *
   * ⛔ **La pesata di confine è a MEZZANOTTE, non alle nove.** `Measurement.date` è `@db.Date`,
   * cioè mezzanotte UTC — ed è l'unico istante in cui `>=` e `>` danno esiti diversi. La prima
   * stesura di questa prova usava le 09:00, e una mutazione da `>=` a `>` **sopravviveva**: la
   * prova diceva di guardare il confine e guardava un punto lontano da lì.
   */
  it('⚠️ una pesata fatta il giorno stesso del rientro è del periodo NUOVO', () => {
    const mezzanotte = { date: new Date('2026-09-01T00:00:00Z'), weightKg: 83 };
    const p = pesateDaContare([g('2026-08-31', 79), mezzanotte], RIENTRO);
    expect(p.delPeriodo.map((x) => x.weightKg)).toEqual([83]);
    expect(p.riferimento?.weightKg).toBe(79);
  });

  it('⚠️ e riordina da sé: chi chiama le legge in due versi diversi', () => {
    const p = pesateDaContare([...STORIA].reverse(), RIENTRO);
    expect(p.riferimento?.weightKg).toBe(79.5);
    expect(p.delPeriodo.map((x) => x.weightKg)).toEqual([83]);
  });

  it('⚠️ una cliente che non si era mai pesata non ha riferimento', () => {
    expect(pesateDaContare([g('2026-09-02', 83)], RIENTRO).riferimento).toBeNull();
  });
});

describe('pesoCheValeAlRientro — l\'ultima del periodo, non la tendenza', () => {
  /**
   * ⛔ È il pezzo su cui la regola cambia il comportamento: il kit di rientro riporzionava sulla
   * media, che il salto lo diluisce. Riferimento 68, pesate 68,2 / 68,0 / 71,0 → il kit partiva
   * perché era salita di 3 chili e le porzioni erano tarate come se ne avesse ripresi 1,07.
   */
  it('⛔ prende l\'ULTIMA pesata del periodo, non la media delle sue', () => {
    const p = pesateDaContare([g('2026-09-02', 68.2), g('2026-09-05', 68.0), g('2026-09-09', 71.0)], RIENTRO);
    expect(pesoCheValeAlRientro(p)).toBe(71.0);
  });

  /** ⛔ Finché non si ripesa vale il riferimento: è quello che la regola dice di usare. */
  it('⛔ senza pesate nuove vale il peso di prima dell\'inizio', () => {
    expect(pesoCheValeAlRientro(pesateDaContare([g('2026-07-29', 79.5)], RIENTRO))).toBe(79.5);
  });

  /** ⚠️ E senza niente dice «non lo so», che non è zero. */
  it('⚠️ senza niente rende null, non 0', () => {
    expect(pesoCheValeAlRientro(pesateDaContare([], RIENTRO))).toBeNull();
  });
});

/**
 * ⚠️ **Qui c'era il blocco su `saltoAttraversoIlRientro`, tolto col codice il 3/9.** Giudicava il
 * salto attraverso un rientro sul solo salto in chili: la revisione ha mostrato che togliere la
 * condizione sul ritmo **è** cambiare una regola clinica già provata e buttata, e che la risposta
 * di Simone dava il riferimento, non una soglia d'allarme. Il perché sta in `peso-al-rientro.ts`,
 * la domanda che resta nella voce `pesate-lontane-buco-del-ritmo`.
 */
