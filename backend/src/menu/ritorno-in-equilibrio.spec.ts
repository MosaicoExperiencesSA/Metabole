import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ⛔ **«RITORNO IN EQUILIBRIO»: IL POOL VIENE DAL PASSATO, MA PASSA DAGLI STESSI CANCELLI.**
 *
 * Richiesta di Simone del 27/8: *«per chi ha già fatto un percorso con noi, un mese coi menu scelti
 * tra quelli che hanno dato migliori risultati e al cliente più graditi»*.
 *
 * ⚠️ La forma è una scelta: si sostituisce il **pool**, non la giornata. Copiare le giornate intere
 * del passato salterebbe in un colpo la banda kcal, la coppia pranzo/cena, la carne a settimana,
 * gli allergeni e le esclusioni — e una cliente riceverebbe una giornata di tre mesi fa con le
 * esclusioni di allora. Questa sentinella tiene ferma quella scelta.
 */
const src = readFileSync(join(__dirname, 'menu.service.ts'), 'utf8');

describe('⛔ il pool dal passato passa dai cancelli di tutti', () => {
  /**
   * ⛔ **La sostituzione sta PRIMA dei filtri sulle esclusioni.** Se stesse dopo, i piatti del suo
   * passato entrerebbero senza controllo — ed è il tipo di scorciatoia che su un'allergia costa
   * cara: una ricetta che oggi le è vietata è nel suo passato proprio perché allora non lo era.
   */
  it('⛔ il pool si sostituisce prima che si applichino le esclusioni', () => {
    const sostituzione = src.indexOf('if (dalPassato) slotPool = dalPassato;');
    const poolIds = src.indexOf('const poolIds = ricetteDelPool(slotPool);');
    expect(sostituzione).toBeGreaterThan(-1);
    expect(poolIds).toBeGreaterThan(-1);
    expect(sostituzione).toBeLessThan(poolIds);
  });

  /** ⚠️ E si sostituisce il POOL, non la giornata: la composizione resta quella di sempre. */
  it('⚠️ e si sostituisce il pool, non la giornata composta', () => {
    expect(src).toMatch(/let slotPool = poolPerSlot\(righe\);/);
    // niente scorciatoie: la giornata non si copia dal passato
    expect(src).not.toMatch(/chosen = .*dalPassato/);
  });

  /**
   * ⛔ **Solo per quella famiglia, e col nome preso dalla costante.** Scriverlo a mano vorrebbe
   * dire due stringhe che un giorno divergono — è già successo con `DASH`, che nel piano si
   * chiamava in un modo e in banca dati in un altro: quattro varianti approvate finite fuori da
   * ogni paniere per un nome.
   */
  it('⛔ vale solo per la sua famiglia, e il nome viene dalla costante', () => {
    expect(src).toMatch(/famigliaPaniere === FAMIGLIA_RITORNO_IN_EQUILIBRIO/);
    expect(src).not.toMatch(/=== 'Ritorno in Equilibrio'/);
  });

  /**
   * ⛔ **Spento di default**, come l'interruttore dei panieri: una funzione che cambia da dove
   * arrivano i piatti si accende quando qualcuno ha guardato i numeri, non alla nascita.
   */
  it('⛔ nasce spenta, e la soglia è quella decisa', () => {
    expect(src).toMatch(/getBool\('ritorno_in_equilibrio_acceso', false\)/);
    expect(src).toMatch(/getNumber\('ritorno_in_equilibrio_giornate_minime', 28\)/);
  });

  /**
   * ⚠️ E quando il mese è più povero di quanto promette, **si scrive**: chi legge i log deve
   * saperlo prima che se ne accorga la cliente.
   */
  it('⚠️ e un mese povero finisce nel log', () => {
    expect(src).toMatch(/il mese è più povero del previsto/);
  });
});
