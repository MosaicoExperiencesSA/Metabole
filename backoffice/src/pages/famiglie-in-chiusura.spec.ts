import { describe, expect, it } from 'vitest';

const sorgenti = {
  ...import.meta.glob('./ClientDetail.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../lib/taxonomy.ts', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;
const src = (f: string) => sorgenti[f] ?? '';

/**
 * ⛔ **LE FAMIGLIE IN CHIUSURA NELLA SCHEDA DELLA CLIENTE** — 2/9, da una segnalazione di Simone:
 * «dalla scheda lead vedo ancora le vecchie diete». Sei famiglie del piano panieri si stanno
 * chiudendo, e comparivano identiche alle altre: un lead assegnato oggi a «Mediterranea senza
 * glutine» è un'altra persona da migrare a mano domani.
 */
describe('la tendina delle famiglie', () => {
  const pagina = src('./ClientDetail.tsx');

  it('⛔ separa le famiglie in chiusura, e lo dice in una riga che si legge', () => {
    expect(pagina).toMatch(/families\.filter\(\(f\) => !f\.inChiusura\)/);
    expect(pagina).toMatch(/<optgroup label="In chiusura[^"]*non assegnarle/);
  });

  /**
   * ⛔ **NON le nasconde.** Chi ce l'ha già sopra deve continuare a vederla: una scelta che
   * sparisce dalla tendina si cancella al primo salvataggio di un altro campo — è la stessa
   * ragione per cui esiste l'opzione «(non più in catalogo)».
   */
  it('⛔ ma non le toglie: restano assegnabili', () => {
    expect(pagina).toMatch(/families\.filter\(\(f\) => f\.inChiusura\)\.map/);
    expect(pagina).toMatch(/non più in catalogo/);
  });

  /**
   * ⚠️ `inChiusura` è **facoltativo**: una risposta vecchia dell'API non ce l'ha, e `undefined`
   * deve voler dire «non lo so», non «sì» — marcare per sbaglio una famiglia viva farebbe
   * smettere di assegnarla.
   */
  it('⚠️ il campo è facoltativo, e assente vuol dire «non in chiusura»', () => {
    expect(src('../lib/taxonomy.ts')).toMatch(/inChiusura\?: boolean/);
  });
});
