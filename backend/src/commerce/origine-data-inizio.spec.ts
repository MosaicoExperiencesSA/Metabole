import { ORIGINE_INIZIO, eGiornoScelto, spiegaOrigine } from './origine-data-inizio';

/**
 * ⛔ **IL CAMPO DICE DA DOVE VIENE, invece di farlo indovinare al valore.**
 *
 * L'euristica del 23/8 («mezzanotte UTC esatta = un giorno») è stata provata e buttata: la scadenza
 * di un piano, partendo da un giorno, produce **proprio** mezzanotte UTC esatta. Questi test tengono
 * ferma la sola cosa che conta di questo modulo — che «non lo so» non diventi «sì».
 */
describe('da dove viene la data di inizio', () => {
  it('⛔ solo un giorno dichiarato è un giorno', () => {
    expect(eGiornoScelto(ORIGINE_INIZIO.GIORNO)).toBe(true);
    expect(eGiornoScelto(ORIGINE_INIZIO.CODA)).toBe(false);
  });

  /**
   * ⛔ **«NON LO SO» VALE FALSO**, ed è la riga che tiene in piedi la migrazione: le righe scritte
   * prima del 28/8 non hanno la provenienza, e su di loro si tiene il comportamento di prima — il
   * confronto fra istanti. Se qui rispondesse `true`, la migrazione cambierebbe il significato di
   * ogni data già scritta, comprese le scadenze dei piani in coda.
   */
  it.each([[null], [undefined], [''], ['istante'], ['GIORNO'], ['giorno scelto']])(
    '⛔ «%s» non è un giorno: su «non lo so» si tiene il comportamento di prima',
    (valore) => {
      expect(eGiornoScelto(valore as string | null | undefined)).toBe(false);
    },
  );

  it('⚠️ e si legge a parole, senza aprire il file', () => {
    expect(spiegaOrigine(ORIGINE_INIZIO.GIORNO)).toContain('giorno');
    expect(spiegaOrigine(ORIGINE_INIZIO.CODA)).toContain('scadenza');
    // ⚠️ Anche il vuoto ha una frase: «—» in una diagnostica non dice se il dato manca o è falso.
    expect(spiegaOrigine(null)).toContain('non registrata');
  });
});
