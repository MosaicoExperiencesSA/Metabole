import { describe, expect, it } from 'vitest';
import { conta, MOTIVO_MINIMO, nomePasto, type Scelta } from './giornataAMano';

const TRE = ['breakfast', 'lunch', 'dinner'];
const s = (slot: string, kcal: number, over: Partial<Scelta> = {}): Scelta =>
  ({ slot, recipeId: `r-${slot}`, nome: `Piatto ${slot}`, kcal, ...over });
const PIENA = [s('breakfast', 400), s('lunch', 700), s('dinner', 600)]; // 1700

describe('il conto che la schermata mostra mentre si sceglie', () => {
  it('⛔ somma le kcal e dice lo scostamento dal fabbisogno', () => {
    const c = conta(PIENA, TRE, 1700, 15);
    expect(c.kcal).toBe(1700);
    expect(c.scostamentoPct).toBe(0);
    expect(c.dentroBanda).toBe(true);
  });

  it('⛔ e quando è fuori banda lo dice', () => {
    expect(conta(PIENA, TRE, 1000, 15).dentroBanda).toBe(false);
    expect(conta(PIENA, TRE, 1000, 15).scostamentoPct).toBe(70);
  });

  /** ⚠️ La banda arriva dal server, quella dei Parametri: non è una copia da 15 scritta qui. */
  it('⚠️ la banda viene da fuori', () => {
    expect(conta(PIENA, TRE, 1500, 25).dentroBanda).toBe(true);
    expect(conta(PIENA, TRE, 1500, 5).dentroBanda).toBe(false);
  });

  /** ⛔ «Non lo so» non è «va bene»: senza fabbisogno non si giudica. */
  it('⛔ senza fabbisogno lo scostamento è null, non zero', () => {
    const c = conta(PIENA, TRE, null, 15);
    expect(c.scostamentoPct).toBeNull();
    expect(c.dentroBanda).toBeNull();
    expect(c.siPuoProvare).toBe(true); // ⚠️ e non impedisce di scrivere
  });

  it('⛔ i pasti ancora vuoti si elencano, e finché ce ne sono non si salva', () => {
    const c = conta(PIENA.slice(0, 2), TRE, 1700, 15);
    expect(c.mancanti).toEqual(['dinner']);
    expect(c.siPuoProvare).toBe(false);
  });

  /**
   * ⛔ **Una forzatura senza motivo tiene spento il pulsante.** È l'unica cosa, insieme ai pasti
   * vuoti, che questa schermata giudica da sé: dipende da quello che l'utente sta scrivendo in
   * quel momento, e aspettare il 400 del server vorrebbe dire farglielo scoprire dopo il clic.
   */
  it('⛔ una ricetta bloccata senza motivo tiene spento il salvataggio', () => {
    const c = conta(
      PIENA.map((x) => (x.slot === 'lunch' ? { ...x, bloccata: true, motivoBlocco: 'crostacei' } : x)),
      TRE, 1700, 15,
    );
    expect(c.senzaMotivo).toEqual(['Piatto lunch']);
    expect(c.siPuoProvare).toBe(false);
  });

  /**
   * ⚠️ **Il minimo è lo stesso del DTO.** Più permissivo qui vorrebbe dire pulsante acceso e 400
   * dal server; più severo, vietare qualcosa che il server accetta. In tutti e due i casi lo
   * strumento sembra rotto proprio quando serve.
   */
  it('⚠️ un motivo troppo corto non basta, e alla soglia basta', () => {
    const conMotivo = (m: string) => conta(
      PIENA.map((x) => (x.slot === 'lunch' ? { ...x, bloccata: true, forzatoPerche: m } : x)),
      TRE, 1700, 15,
    );
    expect(MOTIVO_MINIMO).toBe(5);
    expect(conMotivo('ok').siPuoProvare).toBe(false);
    expect(conMotivo('     ').siPuoProvare).toBe(false);
    expect(conMotivo('okkk!').siPuoProvare).toBe(true);
  });

  it('⚠️ una giornata vuota non si salva', () => {
    expect(conta([], TRE, 1700, 15).siPuoProvare).toBe(false);
  });

  /** ⚠️ Due scelte sullo stesso pasto: l'ultima vince, e il totale non le somma tutte e due. */
  it('⚠️ due piatti sullo stesso pasto non si sommano', () => {
    const c = conta([...PIENA, s('lunch', 900)], TRE, 1700, 15);
    expect(c.kcal).toBe(400 + 900 + 600);
  });
});

describe('i nomi dei pasti', () => {
  it('⚠️ sono quelli che legge chi compone, e uno sconosciuto resta leggibile', () => {
    expect(nomePasto('afternoon_snack')).toBe('Merenda');
    expect(nomePasto('second_dinner')).toBe('second_dinner');
  });
});
