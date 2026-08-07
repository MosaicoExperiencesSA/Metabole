import { describe, expect, it } from 'vitest';
import { parseMisura } from './misure';

/**
 * Il primo test dell'app, e non è un caso che sia questo.
 *
 * Segnalazione di una cliente (7/8): correggeva le misure di oggi, lasciava vuoti i **fianchi**
 * perché non li aveva mai misurati, e il salvataggio falliva con «hipsCm must not be less
 * than 40» — in inglese, sotto un pulsante che sembrava rotto.
 *
 * La causa era una riga: `Number('')` fa **0**, e zero è un numero valido a tutti gli effetti.
 * La casella vuota partiva come `hipsCm: 0` e il backend la rifiutava, giustamente. La stessa
 * funzione, nel popup delle misure, aveva il controllo `> 0` e infatti lì funzionava: due copie
 * della stessa lettura, una giusta e una no.
 *
 * Un difetto così si sarebbe fermato qui, se «qui» fosse esistito: l'app era l'unico pacchetto
 * senza test, la CI la compilava e basta. Ora esiste.
 */
describe('parseMisura', () => {
  it('campo VUOTO → undefined («non lo mando»), non zero', () => {
    // È il caso esatto della segnalazione.
    expect(parseMisura('')).toBeUndefined();
    expect(parseMisura('   ')).toBeUndefined();
    expect(parseMisura(null)).toBeUndefined();
    expect(parseMisura(undefined)).toBeUndefined();
  });

  it('zero e negativi non sono misure: nessun peso e nessuna circonferenza vale 0', () => {
    expect(parseMisura('0')).toBeUndefined();
    expect(parseMisura('0,0')).toBeUndefined();
    expect(parseMisura('-5')).toBeUndefined();
  });

  it('legge la virgola come separatore decimale (è come si scrive in italiano)', () => {
    expect(parseMisura('86,3')).toBe(86.3);
    expect(parseMisura('95,0')).toBe(95);
  });

  it('accetta anche il punto e gli spazi attorno', () => {
    expect(parseMisura('86.3')).toBe(86.3);
    expect(parseMisura('  72 ')).toBe(72);
  });

  it('testo non numerico → undefined, mai NaN', () => {
    // Un NaN nel corpo della richiesta diventa `null` in JSON: il backend lo rifiuterebbe e la
    // cliente rivedrebbe un errore che non sa come risolvere.
    expect(parseMisura('abc')).toBeUndefined();
    expect(parseMisura('86,3 kg')).toBeUndefined();
  });
});
