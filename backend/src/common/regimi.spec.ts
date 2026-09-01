import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { REGIMI_IN_ORDINE, REGIME_PIU_STRETTO, regimeConosciuto, regimiCompatibili, ricettaVaBene } from './regimi';

describe('chi può mangiare cosa', () => {
  it('il nesting è vegano ⊂ vegetariano ⊂ pescetariano ⊂ onnivoro', () => {
    expect(regimiCompatibili('vegan')).toEqual(['vegan']);
    expect(regimiCompatibili('vegetarian')).toEqual(['vegan', 'vegetarian']);
    expect(regimiCompatibili('pescetarian')).toEqual(['vegan', 'vegetarian', 'pescetarian']);
    expect(regimiCompatibili('omnivore')).toEqual(['vegan', 'vegetarian', 'pescetarian', 'omnivore']);
  });

  /**
   * ⛔ **IL DIFETTO CORRETTO L'1/9.** La tabella viveva in `personal-base.service.ts`, non conosceva
   * `pescetarian`, e ripiegava su `['omnivore']`: il giorno che il pescetariano entra fra i regimi
   * attivi — la Fase 5 del piano — a una cliente pescetariana la base personale avrebbe dichiarato
   * sicuri **i piatti di carne**.
   */
  it('⛔ una pescetariana non riceve carne', () => {
    expect(ricettaVaBene('omnivore', 'pescetarian')).toBe(false);
    expect(ricettaVaBene('pescetarian', 'pescetarian')).toBe(true);
    expect(ricettaVaBene('vegan', 'pescetarian')).toBe(true);
  });

  /**
   * ⛔ **E il ripiego va verso il PIÙ STRETTO.** Se non so cosa mangia questa persona, il vegano è
   * sbagliato al massimo per difetto — le arriva meno scelta e qualcuno se ne accorge. L'onnivoro
   * è sbagliato nel piatto.
   */
  it('⛔ un regime sconosciuto ripiega sul più stretto, non sul più largo', () => {
    expect(REGIME_PIU_STRETTO).toBe('vegan');
    for (const strano of ['flexitarian', 'carnivoro', '', '   ', null, undefined]) {
      expect(regimiCompatibili(strano)).toEqual(['vegan']);
    }
    expect(ricettaVaBene('omnivore', 'flexitarian')).toBe(false);
  });

  it('e si può chiedere se un regime lo conosciamo', () => {
    expect(regimeConosciuto('pescetarian')).toBe(true);
    expect(regimeConosciuto('flexitarian')).toBe(false);
    expect(regimeConosciuto(null)).toBe(false);
  });

  it('nessuno può ricevere un piatto di un regime più largo del suo', () => {
    for (let i = 0; i < REGIMI_IN_ORDINE.length; i++) {
      for (let j = 0; j < REGIMI_IN_ORDINE.length; j++) {
        expect(ricettaVaBene(REGIMI_IN_ORDINE[j], REGIMI_IN_ORDINE[i])).toBe(j <= i);
      }
    }
  });
});

/**
 * ⚠️ **UNA TABELLA SOLA.** Il difetto dell'1/9 non è stato scrivere male la tabella: è stato averla
 * scritta **dentro un servizio**, dove nessuno andava a cercarla quando si aggiungeva un regime.
 * Una seconda copia è lo stesso difetto rimandato.
 */
describe('nessuno si riscrive il nesting dei regimi', () => {
  const radice = join(__dirname, '..');
  const PERMESSI = new Set<string>([
    // È la porta.
    'common/regimi.ts',
  ]);
  /** La forma: una tabella che mappa un regime su un elenco che comincia col vegano. */
  const NESTING_A_MANO = /vegan:\s*\[\s*'vegan'/;

  const tuttiIFile = (dir: string): string[] => {
    const out: string[] = [];
    for (const nome of readdirSync(dir)) {
      const pieno = join(dir, nome);
      if (statSync(pieno).isDirectory()) out.push(...tuttiIFile(pieno));
      else if (nome.endsWith('.ts') && !nome.endsWith('.spec.ts')) out.push(pieno);
    }
    return out;
  };

  it('la tabella di chi mangia cosa sta in un posto solo', () => {
    const colpevoli = tuttiIFile(radice)
      .filter((f) => NESTING_A_MANO.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(radice.length + 1).replace(/\\/g, '/'))
      .filter((rel) => !PERMESSI.has(rel));
    expect(colpevoli).toEqual([]);
  });

  it('⚠️ e riconoscerebbe la forma della copia che c\'era', () => {
    expect(NESTING_A_MANO.test("const REGIME_OK: Record<string, string[]> = {\n  vegan: ['vegan'],")).toBe(true);
    expect(NESTING_A_MANO.test("const x = { vegan: 12, vegetarian: 8 };")).toBe(false);
  });
});
