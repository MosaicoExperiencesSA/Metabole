/**
 * «QUANTI PASTI HA UNA GIORNATA» — quattro funzioni, e sul 4 non dicono la stessa cosa — 20/8.
 *
 * `update-client.dto.ts` accetta `mealsPerDay` fra **3, 4 e 5**. Il catalogo non ha mai diete a 4
 * pasti: le varianti nascono con `fasting ? 3 : meals === '5' ? 5 : 3`.
 *
 * E la stessa domanda — quali pasti ha una giornata — è scritta in quattro posti:
 *
 *   `catalog/giornate-complete.ts`      → `pastiAttesi`     (gate di completezza + erogazione)
 *   `engine-rules/copertura-catalogo.ts`→ `slotAttesi`      (copertura del catalogo)
 *   `engine-rules.service.ts` riga 341  → inline            (il generatore)
 *   `engine-rules.service.ts`           → `slotsForMeals`   (wizard di creazione)
 *
 * Sul 3 e sul 5 combaciano. **Sul 4 no**: solo `slotsForMeals` sa cos'è una giornata da 4 pasti
 * (colazione, pranzo, merenda, cena); le altre la trattano come una da 3, e il generatore non
 * conosce il 4 affatto e ricade sul 5.
 *
 * ⛔ **Questi test non correggono niente: fissano cosa risponde ognuna oggi.** Quanto pesi davvero
 * dipende da quante clienti abbiano 4 pasti in scheda, ed è un numero che sta in banca dati:
 * `npm run diag:pasti`. Se è zero si toglie il 4 dal DTO e la questione è chiusa; se non è zero
 * sono clienti che ricevono un piano diverso da quello scritto sulla loro scheda, e si decide.
 *
 * ⚠️ Il verde di questi test **non vuol dire che va bene**. Vuol dire che la differenza è ancora
 * quella che ho misurato, e che nessuno l'ha cambiata per sbaglio nel frattempo.
 */
import { pastiAttesi } from './giornate-complete';
import { slotAttesi } from '../engine-rules/copertura-catalogo';

describe('sul 3 e sul 5 le due funzioni combaciano', () => {
  for (const n of [3, 5]) {
    it(`${n} pasti: stessa risposta`, () => {
      expect(pastiAttesi({ mealsPerDay: n, fasting: false })).toEqual([...slotAttesi(n, false)]);
    });
  }
  it('digiuno: stessa risposta', () => {
    expect(pastiAttesi({ mealsPerDay: 3, fasting: true })).toEqual([...slotAttesi(3, true)]);
    expect(pastiAttesi({ mealsPerDay: 3, fasting: true })).toEqual(['lunch', 'afternoon_snack', 'dinner']);
  });
});

describe('⛔ sul 4 no: il catalogo non sa cos\'è una giornata da quattro pasti', () => {
  it('`pastiAttesi(4)` risponde come se fossero tre', () => {
    expect(pastiAttesi({ mealsPerDay: 4, fasting: false })).toEqual(['breakfast', 'lunch', 'dinner']);
  });

  it('`slotAttesi(4)` risponde come se fossero tre', () => {
    expect([...slotAttesi(4, false)]).toEqual(['breakfast', 'lunch', 'dinner']);
  });

  it('⚠️ e il wizard invece ne conosce quattro: la merenda che le altre due non contano', () => {
    /**
     * `slotsForMeals` è privato. La sua regola è breve e sta scritta qui accanto apposta: copiarla
     * in un test è la cosa che di solito non si fa — un test double che si comporta diversamente
     * dall'originale non verifica niente — ma qui **la differenza È l'oggetto del test**, e la riga
     * che segue è esattamente quella di `engine-rules.service.ts:1217`.
     */
    const slotsForMeals4 = ['breakfast', 'lunch', 'afternoon_snack', 'dinner'];
    expect(slotsForMeals4).toHaveLength(4);
    expect(pastiAttesi({ mealsPerDay: 4, fasting: false })).not.toEqual(slotsForMeals4);
    expect(slotsForMeals4).toContain('afternoon_snack');
    expect(pastiAttesi({ mealsPerDay: 4, fasting: false })).not.toContain('afternoon_snack');
  });
});

describe('il numero di pasti che il DTO accetta', () => {
  it('⛔ accetta il 4, che nel catalogo non esiste', () => {
    const dto = require('fs').readFileSync(require('path').join(__dirname, '..', 'clients', 'dto', 'update-client.dto.ts'), 'utf8');
    expect(dto).toContain('@IsIn([3, 4, 5]) mealsPerDay');
  });

  it('⚠️ mentre il backoffice deduce i pasti dal percorso, e non propone mai il 4', () => {
    /**
     * È la ragione per cui questo non è un incendio: la scheda cliente manda `mealsPerDay` calcolato
     * da `pathType` (`classic3 → 3`, `five → 5`, digiuno → 3). Il 4 può arrivare solo da uno script,
     * da una chiamata all'API, o da un dato vecchio.
     */
    const percorsi = { classic3: 3, five: 5, intermittent_fasting: 3, supplements: 5 };
    expect(Object.values(percorsi)).not.toContain(4);
  });
});
