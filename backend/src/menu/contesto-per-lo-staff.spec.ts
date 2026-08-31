import { contestoPerLoStaff } from './sostituzione-chat';

/**
 * ⛔ **UN «1» SENZA CONTESTO NON SI CAPISCE** — Simone, 31/8, guardando la chat con Sonia:
 * *«se il nutrizionista legge 1 e 2 come fa a capire di cosa si parla?»*.
 *
 * Gli elenchi numerati hanno senso nella chat con Gaia, dove la domanda è la riga sopra. Inoltrati
 * nel thread dello staff arrivano nudi.
 */
describe('contestoPerLoStaff — la riga che spiega un numero', () => {
  const OGGI = '2026-08-31';

  it('mette in fila giorno, pasto, piatto e alimento — e la domanda di Gaia', () => {
    const testo = contestoPerLoStaff(
      {
        passo: 'cibo',
        cibo: 'pollo',
        slotPiatto: 'lunch',
        data: '2026-09-01',
        piattoAttuale: { recipeId: 'r1', nome: 'Pollo alle erbe', kcal: 500 },
        ultimaDomanda: 'Quale vuoi cambiare? 1 pollo 2 patate',
      } as never,
      OGGI,
    );
    expect(testo).toBe(
      'Vuole cambiare «pollo» — pranzo di domani, «Pollo alle erbe». ' +
        'Gaia le aveva chiesto: «Quale vuoi cambiare? 1 pollo 2 patate»',
    );
  });

  it('con la proposta già fatta dice tutte e due gli alimenti', () => {
    const testo = contestoPerLoStaff(
      { passo: 'conferma', proposta: { da: 'pollo', a: 'tacchino' }, slotPiatto: 'lunch', data: '2026-09-01' } as never,
      OGGI,
    );
    expect(testo).toBe('Vuole cambiare «pollo» con «tacchino» — pranzo di domani.');
  });

  it('⚠️ quando si sa poco, si dice poco — non si riempiono i buchi', () => {
    expect(contestoPerLoStaff({ passo: 'giorno', data: OGGI, slotPiatto: 'dinner' } as never, OGGI)).toBe(
      'Sta cambiando un piatto — cena di oggi.',
    );
    // Solo la domanda: vale da sola, ed è quella che dà un senso al numero.
    expect(contestoPerLoStaff({ passo: 'giorno', ultimaDomanda: 'Su quale menu? 1 oggi 2 domani' } as never, OGGI)).toBe(
      'Gaia le aveva chiesto: «Su quale menu? 1 oggi 2 domani»',
    );
  });

  it('⛔ e se lo stato non dice niente, non si scrive niente', () => {
    // Meglio un numero nudo che una frase plausibile e sbagliata sotto gli occhi di chi decide.
    expect(contestoPerLoStaff({ passo: 'giorno' } as never, OGGI)).toBeNull();
    expect(contestoPerLoStaff(null, OGGI)).toBeNull();
    expect(contestoPerLoStaff(undefined, OGGI)).toBeNull();
  });
});
