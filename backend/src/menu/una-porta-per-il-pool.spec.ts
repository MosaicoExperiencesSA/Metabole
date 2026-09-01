import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * «QUALI RICETTE PUÒ RICEVERE QUESTA CLIENTE, PER OGNI PASTO?» — UNA DOMANDA, UNA PORTA.
 *
 * ⛔ Fino al 31/8 la risposta se la costruivano in tre: `menu.service.ts` (`buildScoringContext`),
 * `personal-base.service.ts` e la copertura del catalogo, ognuno appiattendo per conto suo
 * `DietDayTemplate.meals`. ⚠️ Finché sono tre, il giorno che l'appartenenza si sposta sul paniere se
 * ne sposta **una** e le altre restano indietro — e non lo dice niente: i menu continuano a uscire,
 * da un pool diverso da quello che qualcuno crede di aver cambiato.
 *
 * È la stessa forma di `una-porta-per-le-esclusioni.spec.ts`, e la stessa ragione: là erano sette
 * copie di `[...chiavi].some((k) => testo.includes(k))`, qui sono tre copie di «appiattisci i pasti
 * delle giornate e raggruppali per slot».
 *
 * ⚠️ La sentinella cerca la **forma**, non i nomi di variabile: un ciclo dentro un ciclo che legge
 * `.meals` e mette da parte un `recipeId`. Chi lo scrive con altri nomi la incontra lo stesso.
 */

/** Chi può leggere `meals` per costruire un pool, e perché. */
const PERMESSI = new Set<string>([
  // È la porta.
  'catalog/pool-del-paniere.ts',
  /**
   * ⚠️ La migrazione della Fase 1 legge le giornate proprio per **svuotarle** dentro il paniere:
   * è il codice che esiste per far sparire questa lettura, non una quarta copia.
   */
  'catalog/appartenenza-panieri.ts',
  /**
   * ⚠️ **Composizione, non appartenenza.** `giornate-complete.ts` guarda i pasti di una giornata per
   * dire se quella giornata è completa — «questa giornata ha tutti i pasti che la struttura
   * prevede?» — e non costruisce nessun pool. La composizione si sposta sul paniere alla **Fase 3**
   * del piano, non qui.
   */
  'catalog/giornate-complete.ts',
  /**
   * ⛔ **UNA QUARTA COPIA, trovata da questa sentinella il 31/8 mentre la scrivevo** — e non la
   * conoscevo: `engine-rules.service.ts` costruisce `slot → ricette` dalle giornate per sapere
   * **cosa c'è già in catalogo** quando genera ricette nuove, così non ne rifà di uguali.
   *
   * ⚠️ È una domanda vicina ma diversa da quella di questa porta: «cosa c'è già per questa
   * variante» al momento di **generare**, non «cosa può ricevere questa cliente» al momento di
   * **comporre**. Dichiarata invece che spostata a scatola chiusa: spostarla vuol dire cambiare da
   * cosa dipende il generatore, e va fatta con i numeri davanti — è la Fase 7 del piano.
   */
  'engine-rules/engine-rules.service.ts',
]);

/**
 * La forma delle tre copie: si legge `.meals` e si **accumula** un `recipeId` in un insieme.
 *
 * ⚠️ **Stretta apposta.** La prima stesura cercava «`.meals` e poi da qualche parte `recipeId`» e
 * gridava su otto file, sette dei quali innocenti — fra cui `menu.service.ts` stesso, che legge i
 * pasti per **comporre** la giornata (cosa che si sposta alla Fase 3, non qui) e che quindi sarebbe
 * finito nelle eccezioni proprio il file per cui la sentinella esiste. È la lezione già scritta in
 * `una-porta-per-le-esclusioni.spec.ts`: un guardiano che grida su dieci cose innocenti è un
 * guardiano che si impara a zittire.
 */
const POOL_A_MANO = /\.meals[\s\S]{0,200}?\.add\([^)]{0,60}recipeId/;
/** Chi legge le giornate è anche chi può essere tentato di rifarsi il pool. */
const TOCCA_LE_GIORNATE = /dietDayTemplate|diet_day_template/;

function tuttiIFile(radice: string): string[] {
  const out: string[] = [];
  const gira = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const pieno = join(dir, nome);
      if (statSync(pieno).isDirectory()) gira(pieno);
      else if (nome.endsWith('.ts') && !nome.endsWith('.spec.ts')) out.push(pieno);
    }
  };
  gira(radice);
  return out;
}

describe('nessuno si costruisce il pool per conto suo', () => {
  const radice = join(__dirname, '..');

  it('il pool di una cliente passa da `pool-del-paniere.ts`', () => {
    const colpevoli = tuttiIFile(radice)
      .filter((f) => {
        const src = readFileSync(f, 'utf8');
        return TOCCA_LE_GIORNATE.test(src) && POOL_A_MANO.test(src);
      })
      .map((f) => f.slice(radice.length + 1).replace(/\\/g, '/'))
      .filter((rel) => !PERMESSI.has(rel));
    expect(colpevoli).toEqual([]);
  });

  it('⚠️ e la sentinella riconoscerebbe la forma delle tre copie che c\'erano', () => {
    expect(POOL_A_MANO.test('for (const m of t.meals ?? []) poolIds.add(m.recipeId);')).toBe(true);
    expect(POOL_A_MANO.test('for (const x of g.meals) { pool.add(x.recipeId); }')).toBe(true);
    // …e non grida su letture di `meals` che col pool non c'entrano.
    expect(POOL_A_MANO.test('const quanti = giorno.meals.length;')).toBe(false);
    expect(POOL_A_MANO.test('for (const m of day.meals) primaDelloSwap.set(m, m.recipeId);')).toBe(false);
  });

  /**
   * ⛔ **L'interruttore ha un default, e il default è quello di sempre.** Se un giorno qualcuno lo
   * cambiasse nel codice invece che in `config_param`, i menu si comporrebbero da una tabella che
   * potrebbe essere vuota — e questa riga è l'unica che lo direbbe.
   */
  it('⛔ la sorgente predefinita del pool resta le giornate', () => {
    const src = readFileSync(join(radice, 'catalog/pool-del-paniere.ts'), 'utf8');
    expect(src).toMatch(/SORGENTE_PREDEFINITA: Sorgente = 'giornate'/);
    for (const f of ['menu/menu.service.ts', 'personal-base/personal-base.service.ts']) {
      expect(readFileSync(join(radice, f), 'utf8')).toMatch(/getString\('panieri_sorgente_pool', 'giornate'\)/);
    }
  });
});
