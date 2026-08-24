import { describe, expect, it } from 'vitest';
import { altezzaPerRighe } from './altezza-righe';

/**
 * «10 righe mostrate e valori scorrevoli» (Simone, 24/8). Questi test tengono ferme le tre
 * decisioni del conto: quando NON si limita, che si misurano le righe vere, e la mezza riga che
 * dice «sotto continua».
 */
describe('altezza di una tabella alta dieci righe', () => {
  const uguali = (quante: number, alta = 41) => Array.from({ length: quante }, () => alta);

  it('⚠️ se le righe ci stanno tutte non si limita niente: nessuna barra, nessuno spazio vuoto', () => {
    expect(altezzaPerRighe(38, uguali(10), 10)).toBeNull();
    expect(altezzaPerRighe(38, uguali(3), 10)).toBeNull();
    expect(altezzaPerRighe(38, [], 10)).toBeNull();
  });

  it('con più righe del limite: intestazione + le prime dieci + mezza riga', () => {
    // 38 + 410 + 20,5 → 469 (arrotondato).
    expect(altezzaPerRighe(38, uguali(60), 10)).toBe(469);
  });

  /**
   * ⛔ **LE RIGHE NON SONO TUTTE UGUALI, ed è il motivo per cui questo numero si misura invece di
   * scriverlo.** Nelle pesate una misura corretta dalla cliente porta con sé una seconda riga
   * («sostituita · era 78 kg»): con un'altezza fissa la decima riga resterebbe tagliata a metà —
   * cioè il difetto che questa consegna dice di chiudere, nella tabella che lo mostra di più.
   */
  it('⛔ conta le righe VERE, comprese quelle alte il doppio', () => {
    const miste = [61, 41, 41, 61, 41, 41, 41, 61, 41, 41, 41, 41];
    const attesa = Math.round(38 + (61 + 41 + 41 + 61 + 41 + 41 + 41 + 61 + 41 + 41) + (470 / 10) * 0.5);
    expect(altezzaPerRighe(38, miste, 10)).toBe(attesa);
  });

  it('⚠️ senza DOM (o con la card nascosta) le altezze sono zero: si lascia perdere il limite', () => {
    expect(altezzaPerRighe(0, uguali(60, 0), 10)).toBeNull();
  });
});
