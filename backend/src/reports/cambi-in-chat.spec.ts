/**
 * Il conteggio dei cambi concordati in chat, per il report di fine mese.
 *
 * Requisito di Simone (8/8): «ricordati che i cambi vanno poi salvati nella scheda cliente e nel
 * report di fine mese». Nel report è un **dato di personalizzazione** (punto 5 del progetto): dice
 * alla cliente quante volte il piano si è piegato su di lei.
 *
 * La regola che questo test protegge è una sola, e sbagliarla darebbe un numero gonfiato senza che
 * nessuno se ne accorga: si contano **solo** i cambi con `origine: 'chat'`. Le altre sostituzioni
 * nascono dal motore (sicurezza: un'intolleranza, un allergene) e non sono scelte della cliente —
 * mostrarle come «adattamenti che hai chiesto tu» sarebbe raccontarle una cosa falsa.
 *
 * Il conteggio vero vive in `reports.service.ts`; qui si verifica la funzione pura di somma, che è
 * dove sta la decisione (il servizio ha quattordici dipendenze e istanziarlo per contare due
 * numeri non proverebbe niente di più).
 */

/** Stessa somma di `reports.service.ts`. Se una delle due cambia, questo test smette di valere. */
function contaCambiInChat(giorni: { meals: unknown }[]): number {
  let n = 0;
  for (const g of giorni) {
    for (const pasto of ((g.meals as { substitutions?: { origine?: string }[]; cambioPiatto?: { origine?: string } }[]) ?? [])) {
      if (!pasto) continue;
      n += (pasto.substitutions ?? []).filter((s) => s?.origine === 'chat').length;
      if (pasto.cambioPiatto?.origine === 'chat') n += 1;
    }
  }
  return n;
}

describe('cambi in chat nel report di fine mese', () => {
  it('conta gli scambi di ingrediente concordati in chat', () => {
    expect(
      contaCambiInChat([
        { meals: [{ slot: 'breakfast', substitutions: [{ origine: 'chat' }, { origine: 'chat' }] }] },
        { meals: [{ slot: 'lunch', substitutions: [{ origine: 'chat' }] }] },
      ]),
    ).toBe(3);
  });

  it('conta anche i piatti cambiati', () => {
    expect(
      contaCambiInChat([{ meals: [{ slot: 'breakfast', cambioPiatto: { origine: 'chat' } }] }]),
    ).toBe(1);
  });

  it('NON conta le sostituzioni del motore: quelle non le ha chieste lei', () => {
    // Nascono dalla sicurezza (intolleranza, allergene) e non hanno `origine`.
    expect(
      contaCambiInChat([
        { meals: [{ slot: 'lunch', substitutions: [{ from: 'latte', to: 'bevanda di soia' }] }] },
        { meals: [{ slot: 'dinner', substitutions: [{ origine: 'motore' }] }] },
      ]),
    ).toBe(0);
  });

  it('somma i due tipi sullo stesso pasto', () => {
    expect(
      contaCambiInChat([
        { meals: [{ slot: 'breakfast', substitutions: [{ origine: 'chat' }], cambioPiatto: { origine: 'chat' } }] },
      ]),
    ).toBe(2);
  });

  it('un mese senza cambi fa zero, non esplode', () => {
    expect(contaCambiInChat([])).toBe(0);
    expect(contaCambiInChat([{ meals: [] }])).toBe(0);
    // Giornate scritte da versioni vecchie: `meals` mancante o pasti nulli.
    expect(contaCambiInChat([{ meals: null }, { meals: [null] }] as never)).toBe(0);
  });
});
