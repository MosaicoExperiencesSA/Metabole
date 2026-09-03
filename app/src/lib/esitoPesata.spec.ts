import { describe, expect, it } from 'vitest';
import { esitoPesata } from './esitoPesata';

/**
 * COSA SI DICE ALLA CLIENTE DOPO CHE HA SALVATO LE MISURE (16/8).
 *
 * Il backend rispondeva già due cose che nessuna schermata leggeva: i **traguardi** appena raggiunti
 * e il fatto che quella pesata avesse fatto scattare il **guardrail del calo rapido** — che apre una
 * segnalazione al nutrizionista. La cliente salvava, la pagina si ricaricava, e non le veniva detto
 * né che aveva raggiunto l'obiettivo né che si era aperto un caso su di lei.
 */

const TRAGUARDI = [
  { type: 'lost_1kg', label: 'Primo chilo andato!' },
  { type: 'goal_reached', label: 'Obiettivo raggiunto! 🎉' },
];

describe('esitoPesata', () => {
  it('i traguardi appena raggiunti si dicono, con le parole del server', () => {
    expect(esitoPesata(TRAGUARDI, false)).toEqual({
      tipo: 'traguardi',
      etichette: ['Primo chilo andato!', 'Obiettivo raggiunto! 🎉'],
    });
  });

  it('niente di nuovo: non si dice niente', () => {
    expect(esitoPesata([], false)).toBeNull();
    expect(esitoPesata(undefined, false)).toBeNull();
  });

  it('il calo rapido si dice', () => {
    expect(esitoPesata([], true)).toEqual({ tipo: 'segnalata' });
  });

  it('⚠️ se la pesata è stata segnalata, il traguardo ASPETTA: non si festeggia un allarme', () => {
    // «Obiettivo raggiunto! 🎉» accanto a «abbiamo segnalato questa pesata alla tua nutrizionista»
    // è una schermata che si contraddice da sola, e quella che conta è la seconda. Il traguardo è
    // scritto in banca dati e non si perde: si rivede nella sua pagina.
    expect(esitoPesata(TRAGUARDI, true)).toEqual({ tipo: 'segnalata' });
  });

  /**
   * ⛔ **Le pesate da verificare battono tutto il resto** (voce `pesata-strana-chiedi-conferma`).
   * Sopra quelle soglie il calo rapido lato server viene **spento apposta**, quindi se arrivassero
   * insieme il secondo sarebbe un residuo — e delle due frasi questa è quella vera: «il tuo calo è
   * più rapido del previsto» detto a chi ha digitato 113 al posto di 73 è una frase su un corpo
   * costruita su un numero sbagliato.
   */
  it('⛔ le pesate da verificare si dicono, e battono il calo rapido e i traguardi', () => {
    expect(esitoPesata([], false, true)).toEqual({ tipo: 'da-verificare' });
    expect(esitoPesata([], true, true)).toEqual({ tipo: 'da-verificare' });
    expect(esitoPesata(TRAGUARDI, true, true)).toEqual({ tipo: 'da-verificare' });
  });

  /** ⚠️ Il terzo argomento è nuovo: chi non lo passa deve comportarsi esattamente come prima. */
  it('⚠️ senza il terzo argomento niente cambia', () => {
    expect(esitoPesata(TRAGUARDI, false)).toEqual(esitoPesata(TRAGUARDI, false, false));
    expect(esitoPesata([], true)).toEqual({ tipo: 'segnalata' });
  });

  it('le etichette vuote non diventano righe vuote', () => {
    expect(esitoPesata([{ type: 'x', label: '' }, { type: 'y', label: 'Metà strada!' }], false)).toEqual({
      tipo: 'traguardi',
      etichette: ['Metà strada!'],
    });
    expect(esitoPesata([{ type: 'x', label: '  ' }], false)).toBeNull();
  });
});
