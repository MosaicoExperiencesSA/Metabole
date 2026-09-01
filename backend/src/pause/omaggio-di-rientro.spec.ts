import { GIORNI_PESATA_ANCORA_BUONA, spettaLOmaggio, stessoMeseSolare } from './omaggio-di-rientro';

const giorno = (s: string) => new Date(`${s}T00:00:00.000Z`);
const base = {
  refWeightKg: 70,
  ultimaPesataKg: 73,
  sogliaKg: 2,
  ultimoOmaggioIl: null as Date | null,
  oggi: giorno('2026-08-20'),
};

/**
 * ⚠️ Richiesta di Simone del 27/8: *«mentre il cliente è in vacanza monitora il peso e se vede un
 * grosso aumento gli suggerisce 4 giorni di menu tra quelli che gli hanno reso di più»*.
 */
describe('quando spetta l\'omaggio di rientro', () => {
  it('sopra la soglia, spetta — e dice di quanto è salita', () => {
    const e = spettaLOmaggio(base);
    expect(e).toEqual({ spetta: true, deltaKg: 3 });
  });

  it('sotto la soglia no', () => {
    expect(spettaLOmaggio({ ...base, ultimaPesataKg: 71 })).toEqual({ spetta: false, perche: 'sotto_soglia' });
  });

  /**
   * ⚠️ I «no» sono distinti perché chi legge i log deve poter dire **perché**: non è ingrassata,
   * non si pesa, o l'ha già avuto. «Niente da fare» è la frase da cui non si impara niente.
   */
  it('⚠️ senza riferimento o senza pesate, il no è un altro', () => {
    expect(spettaLOmaggio({ ...base, refWeightKg: null })).toEqual({ spetta: false, perche: 'mai_pesata' });
    expect(spettaLOmaggio({ ...base, refWeightKg: 0 })).toEqual({ spetta: false, perche: 'mai_pesata' });
    expect(spettaLOmaggio({ ...base, ultimaPesataKg: null })).toEqual({ spetta: false, perche: 'mai_pesata' });
  });

  /**
   * ⛔ **Una pesata vecchia non è una pesata.** Senza questo limite una pesata di sei settimane fa
   * farebbe scattare l'omaggio ogni mese all'infinito, perché resta «l'ultima» finché non ne manda
   * un'altra: la cliente riceverebbe il kit di rientro tutti i mesi su un peso che non è più il suo.
   */
  it('⛔ una pesata troppo vecchia non fa scattare niente', () => {
    const vecchia = giorno('2026-07-01');
    expect(spettaLOmaggio(base, vecchia)).toEqual({ spetta: false, perche: 'nessuna_pesata_recente' });
    // …e una di ieri sì
    expect(spettaLOmaggio(base, giorno('2026-08-19'))).toEqual({ spetta: true, deltaKg: 3 });
  });

  it('il limite è quello dichiarato, non un numero a caso nel codice', () => {
    const alLimite = new Date(base.oggi.getTime() - GIORNI_PESATA_ANCORA_BUONA * 86_400_000);
    expect(spettaLOmaggio(base, alLimite).spetta).toBe(true);
    const unGiornoOltre = new Date(alLimite.getTime() - 86_400_000);
    expect(spettaLOmaggio(base, unGiornoOltre)).toEqual({ spetta: false, perche: 'nessuna_pesata_recente' });
  });

  /**
   * ⛔ **Guardia (b) del 27/8: una volta per mese solare.** Senza un segno che dura, un cron che
   * gira due volte in una notte regala l'omaggio due volte.
   */
  it('⛔ due volte nello stesso mese no', () => {
    expect(spettaLOmaggio({ ...base, ultimoOmaggioIl: giorno('2026-08-03') }))
      .toEqual({ spetta: false, perche: 'gia_avuto_questo_mese' });
  });

  it('e il mese dopo sì, anche se sono passati pochi giorni', () => {
    expect(spettaLOmaggio({ ...base, ultimoOmaggioIl: giorno('2026-07-31'), oggi: giorno('2026-08-01') }))
      .toEqual({ spetta: true, deltaKg: 3 });
  });

  /**
   * ⚠️ Il controllo del mese sta **dopo** la soglia: «già avuto questo mese» dev'essere una
   * risposta che dice qualcosa — cioè «le sarebbe spettato». Su una che non è ingrassata non
   * direbbe niente a nessuno.
   */
  it('⚠️ e chi non è ingrassata legge «sotto soglia», non «già avuto»', () => {
    expect(spettaLOmaggio({ ...base, ultimaPesataKg: 70.5, ultimoOmaggioIl: giorno('2026-08-03') }))
      .toEqual({ spetta: false, perche: 'sotto_soglia' });
  });
});

describe('stessoMeseSolare', () => {
  it('è il mese del calendario, non trenta giorni', () => {
    expect(stessoMeseSolare(giorno('2026-08-01'), giorno('2026-08-31'))).toBe(true);
    expect(stessoMeseSolare(giorno('2026-07-31'), giorno('2026-08-01'))).toBe(false);
  });

  it('e l\'anno conta', () => {
    expect(stessoMeseSolare(giorno('2025-08-15'), giorno('2026-08-15'))).toBe(false);
  });
});
