/**
 * ⛔ **LA GIORNATA A MANO CHE SOPRAVVIVE A UN CAMBIO DI TIPO DIETA.**
 *
 * Era l'ultimo dei limiti dichiarati il 3/9, e l'unico rimasto a poter arrivare nel piatto di
 * qualcuno: la nutrizionista compone giovedì col salmone, mercoledì la cliente passa a vegana, e
 * `redeliverFutureDays` **salta** quella giornata perché è scritta a mano. La protezione lavora
 * contro la cliente.
 */
import {
  giornateDaRivedere,
  testoGiornataDaRivedere,
  TIPO_GIORNATA_A_MANO_DA_RIVEDERE,
} from './giornata-a-mano-fuori-regime';
import { TIPI_DELLA_NUTRIZIONISTA } from './avvisi-attivita';

const g = (giorno: string, piatti: { name: string; ingredienti: string[] }[]) => ({ giorno, piatti });

describe('quali giornate a mano il regime nuovo non ammette', () => {
  it('⛔ il salmone in una giornata di una vegana si vede', () => {
    const out = giornateDaRivedere([g('2026-09-10', [{ name: 'Salmone al forno', ingredienti: ['salmone', 'asparagi'] }])], 'vegan');
    expect(out).toHaveLength(1);
    expect(out[0].certo).toBe(true);
    expect(out[0].piatti[0].perche).toContain('pesce');
  });

  /**
   * ⛔ **UN'IMITAZIONE NON SI SEGNALA PIÙ AFFATTO, ED È LA RISPOSTA GIUSTA** (4/9).
   *
   * Fino a ieri «Branzino di melanzane» in una giornata vegana usciva come **dubbia**: il
   * riconoscitore leggeva `branzino`, `classifica` non se la sentiva di correggere, e una
   * nutrizionista veniva mandata a guardare un piatto di melanzane. Adesso `piatto-di-cosa.ts` sa
   * che «branzino **di** melanzane» non è pesce — misurato in produzione, otto falsi su otto — e
   * la giornata non ha niente che non va.
   *
   * ⚠️ È la stessa regola scritta due prove più giù: *«chiedere di rivedere una giornata che va
   * bene insegna a non leggere»*. Un dubbio in meno qui non è protezione persa: è protezione che
   * torna a valere, perché quelli che restano sono veri.
   */
  it('✅ un\'imitazione non è più niente da rivedere', () => {
    const out = giornateDaRivedere([g('2026-09-10', [{ name: 'Branzino di melanzane', ingredienti: ['melanzane'] }])], 'vegan');
    expect(out).toEqual([]);
  });

  /** ⛔ E il pesce vero in una giornata vegana resta certo: la regola si è stretta, non spenta. */
  it('⛔ ma il branzino vero resta, e resta certo', () => {
    const out = giornateDaRivedere([g('2026-09-10', [{ name: 'Branzino al forno', ingredienti: ['branzino', 'patate'] }])], 'vegan');
    expect(out).toHaveLength(1);
    expect(out[0].certo).toBe(true);
  });

  /** ⛔ L'onnivora mangia tutto: chiedere di rivedere una giornata che va bene insegna a non leggere. */
  it('⛔ per un\'onnivora non c\'è niente da rivedere', () => {
    expect(giornateDaRivedere([g('2026-09-10', [{ name: 'Salmone al forno', ingredienti: ['salmone'] }])], 'omnivore')).toEqual([]);
  });

  /** ⚠️ E senza sapere il regime non si inventa un allarme. */
  it('⚠️ senza regime non dice niente', () => {
    for (const r of [null, undefined, '  ']) {
      expect(giornateDaRivedere([g('2026-09-10', [{ name: 'Salmone', ingredienti: ['salmone'] }])], r)).toEqual([]);
    }
  });

  it('⚠️ una giornata tutta vegetale non compare', () => {
    expect(giornateDaRivedere([g('2026-09-10', [{ name: 'Insalata di farro', ingredienti: ['farro', 'pomodori'] }])], 'vegan')).toEqual([]);
  });

  /** ⛔ Una giornata per riga: due giornate diventate fuori regime sono due cose da guardare. */
  it('⛔ due giornate fanno due righe, non una', () => {
    const out = giornateDaRivedere([
      g('2026-09-10', [{ name: 'Salmone al forno', ingredienti: ['salmone'] }]),
      g('2026-09-11', [{ name: 'Pollo arrosto', ingredienti: ['pollo'] }]),
    ], 'vegan');
    expect(out.map((x) => x.giorno)).toEqual(['2026-09-10', '2026-09-11']);
  });

  /** ⚠️ E dentro la giornata si elencano **tutti** i piatti, non solo il primo. */
  it('⚠️ elenca tutti i piatti fuori regime della giornata', () => {
    const out = giornateDaRivedere([g('2026-09-10', [
      { name: 'Salmone al forno', ingredienti: ['salmone'] },
      { name: 'Insalata di farro', ingredienti: ['farro'] },
      { name: 'Pollo arrosto', ingredienti: ['pollo'] },
    ])], 'vegan');
    expect(out[0].piatti.map((p) => p.nome)).toEqual(['Salmone al forno', 'Pollo arrosto']);
  });
});

describe('il testo che legge la nutrizionista', () => {
  const uno = giornateDaRivedere([g('2026-09-10', [{ name: 'Salmone al forno', ingredienti: ['salmone'] }])], 'vegan')[0];

  /**
   * ⛔ **Dice che il piatto arriva lo stesso.** Un avviso che non nomina la conseguenza si legge
   * come una segnalazione di catalogo, e si rimanda.
   */
  it('⛔ dice che il motore non la rifà, quindi il piatto arriva così com\'è', () => {
    const t = testoGiornataDaRivedere(uno, 'vegan');
    expect(t.description).toContain('il motore non la rifà');
    expect(t.description).toContain('le arrivano così come sono');
  });

  /** ⛔ E dice **cosa fare**: è l'unica frase che chiude il giro, perché nessun altro la tocca. */
  it('⛔ dice cosa fare, non solo cosa non va', () => {
    const t = testoGiornataDaRivedere(uno, 'vegan');
    expect(t.description).toMatch(/Riscrivila.*oppure toglila/);
  });

  it('⚠️ e il titolo porta la data in italiano e il regime', () => {
    const t = testoGiornataDaRivedere(uno, 'vegan');
    expect(t.title).toContain('10/09/2026');
    expect(t.title).toContain('vegan');
  });

  /** ⚠️ Niente markdown: lo stesso testo esce in una push. */
  it('⚠️ niente markdown nel testo', () => {
    const t = testoGiornataDaRivedere(uno, 'vegan');
    expect(`${t.title} ${t.description}`).not.toMatch(/\*\*|__|`/);
  });
});

/**
 * ⛔ **DEV'ESSERE DELLA NUTRIZIONISTA, o la porta sbaglia destinatario.** È lei che ha scritto la
 * giornata ed è l'unica che può riscriverla: `TIPI_DELLA_NUTRIZIONISTA` decide chi la vede, chi la
 * può chiudere, e su chi arriva la push.
 */
describe('a chi arriva', () => {
  it('⛔ il tipo è fra quelli della nutrizionista', () => {
    expect([...TIPI_DELLA_NUTRIZIONISTA]).toContain(TIPO_GIORNATA_A_MANO_DA_RIVEDERE);
  });
});
