/**
 * ⛔ **LE PROVE DELLA SPUNTA «RICETTA VERIFICATA»** — Simone, 4/9.
 *
 * La parte che conta non è mettere la spunta: è **quando cade da sola**. Una firma su un contenuto
 * non vale su un contenuto diverso, ed è la stessa regola degli allergeni del 18/8 — infatti la
 * chiama, invece di riscriverla.
 */
import { cosaSuccedeAllaVerifica, campiDaScrivere } from './verifica-della-ricetta';

const ing = (...nomi: string[]) => nomi.map((name) => ({ name, qty: 100, unit: 'g' }));
const IL = new Date('2026-09-04T12:00:00.000Z');
const verificata = { verificata: true, ingredienti: ing('farro', 'zucchine'), regime: 'vegan' };
const nuova = { verificata: false, ingredienti: ing('farro'), regime: 'vegan' };

describe('mettere e togliere la spunta', () => {
  it('spuntandola resta scritto CHI e QUANDO', () => {
    expect(cosaSuccedeAllaVerifica(nuova, { verified: true }, 'nutri-1', IL))
      .toEqual({ tipo: 'verificata', da: 'nutri-1', il: IL });
  });

  it('togliendola si azzerano tutti e due i campi', () => {
    expect(campiDaScrivere(cosaSuccedeAllaVerifica(verificata, { verified: false }, 'nutri-1', IL)))
      .toEqual({ verifiedById: null, verifiedAt: null });
  });

  /**
   * ⛔ La riga che tiene in piedi tutto il resto: la schermata manda solo i campi cambiati, e un
   * `undefined` letto come «togli» spegnerebbe la verifica a ogni correzione di refuso.
   */
  it('⛔ non mandare il campo NON toglie la spunta', () => {
    expect(cosaSuccedeAllaVerifica(verificata, { }, 'nutri-1', IL)).toEqual({ tipo: 'invariata' });
    expect(campiDaScrivere({ tipo: 'invariata' })).toBeNull();
  });
});

describe('quando cade da sola', () => {
  it('⛔ cade se cambiano i NOMI degli ingredienti', () => {
    expect(cosaSuccedeAllaVerifica(verificata, { ingredienti: ing('farro', 'melanzane') }, 'x', IL))
      .toEqual({ tipo: 'decaduta', perche: 'ingredienti_cambiati' });
  });

  it('⛔ e se cambia il regime: una vegana che diventa onnivora è un\'altra ricetta', () => {
    expect(cosaSuccedeAllaVerifica(verificata, { regime: 'omnivore' }, 'x', IL))
      .toEqual({ tipo: 'decaduta', perche: 'regime_cambiato' });
  });

  /**
   * ⚠️ **E NON cade per una grammatura.** 80 g di farro o 100 g di farro sono lo stesso piatto:
   * azzerare la verifica per un peso corretto vorrebbe dire che dopo due settimane non è
   * verificato più niente — cioè spegnere la spunta a forza di rispettarla.
   */
  it('⚠️ non cade se cambia solo una quantità', () => {
    const soloPesi = ing('farro', 'zucchine').map((i) => ({ ...i, qty: 250 }));
    expect(cosaSuccedeAllaVerifica(verificata, { ingredienti: soloPesi }, 'x', IL))
      .toEqual({ tipo: 'invariata' });
  });

  it('⚠️ né se cambia solo il nome del piatto o le kcal (campi che qui non arrivano)', () => {
    expect(cosaSuccedeAllaVerifica(verificata, { }, 'x', IL)).toEqual({ tipo: 'invariata' });
  });

  it('⚠️ né se il regime viene rimandato uguale', () => {
    expect(cosaSuccedeAllaVerifica(verificata, { regime: 'vegan' }, 'x', IL)).toEqual({ tipo: 'invariata' });
  });

  it('su una ricetta MAI verificata non c\'è niente da far cadere', () => {
    expect(cosaSuccedeAllaVerifica(nuova, { ingredienti: ing('ceci') }, 'x', IL)).toEqual({ tipo: 'invariata' });
  });

  /**
   * ⛔ **La spunta messa NELLO STESSO salvataggio vince sulla decadenza**, ed è il caso normale:
   * la nutrizionista corregge gli ingredienti e conferma, con il piatto nuovo davanti. Se la
   * decadenza vincesse, non riuscirebbe mai a verificare una ricetta che sta correggendo.
   */
  it('⛔ correggere E spuntare nello stesso salvataggio lascia la ricetta verificata', () => {
    expect(cosaSuccedeAllaVerifica(verificata, { verified: true, ingredienti: ing('ceci') }, 'nutri-2', IL))
      .toEqual({ tipo: 'verificata', da: 'nutri-2', il: IL });
  });
});
