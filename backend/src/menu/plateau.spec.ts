/**
 * QUANDO COMANDA L'EFFICACIA.
 *
 * Il test che conta di più è quello del calo minimo: la soglia è secca per decisione di Simone, e
 * qui sta scritto cosa vuol dire — chi cala di cinquanta grammi a pesata non fa mai scattare
 * l'efficacia. Se un domani si cambia idea, è questo il caso che diventa rosso e chiede di essere
 * riletto, invece di cambiare in silenzio il piatto di qualcuno.
 */
import { PESATE_PER_PLATEAU, eGiornoDiConforto, pesoNonScende } from './plateau';

describe('il peso non scende', () => {
  it('tre pesate uguali: sì', () => {
    expect(pesoNonScende([70, 70, 70])).toBe(true);
  });

  it('tre pesate in salita: sì', () => {
    expect(pesoNonScende([71, 70.5, 70])).toBe(true);
  });

  it('l\'ultima è scesa: no', () => {
    expect(pesoNonScende([69.5, 70, 70])).toBe(false);
  });

  it('⚠️ un calo di 50 grammi azzera tutto: è la soglia secca, ed è voluta', () => {
    // Chi cala pochissimo ma di continuo NON fa scattare l'efficacia. Simone lo sa e va bene così:
    // se un giorno risultasse che è proprio quella la cliente da intercettare, si cambia la soglia.
    expect(pesoNonScende([69.95, 70, 70.05])).toBe(false);
  });

  it('⚠️ con meno di tre pesate si risponde NO, non «forse»', () => {
    // Un plateau dichiarato su due numeri toglierebbe i piatti amati a chi si è appena iscritta.
    expect(pesoNonScende([70, 70])).toBe(false);
    expect(pesoNonScende([70])).toBe(false);
    expect(pesoNonScende([])).toBe(false);
  });

  it('guarda solo le ULTIME tre: quello che è successo prima non conta', () => {
    // Ha perso peso un mese fa e da tre pesate è ferma: è ferma adesso.
    expect(pesoNonScende([70, 70, 70, 68, 66])).toBe(true);
  });

  it('i valori assurdi non fanno scattare niente', () => {
    expect(pesoNonScende([0, 0, 0])).toBe(false);
    expect(pesoNonScende([NaN as unknown as number, 70, 70])).toBe(false);
  });

  it('la soglia è tre, e si può alzare senza toccare la formula', () => {
    expect(PESATE_PER_PLATEAU).toBe(3);
    expect(pesoNonScende([70, 70, 70], 4)).toBe(false);
  });
});

describe('il giorno di conforto dentro il plateau', () => {
  it('è la domenica, uguale per tutte', () => {
    expect(eGiornoDiConforto(new Date('2026-08-16T10:00:00'))).toBe(true); // domenica
    expect(eGiornoDiConforto(new Date('2026-08-17T10:00:00'))).toBe(false); // lunedì
    expect(eGiornoDiConforto(new Date('2026-08-15T10:00:00'))).toBe(false); // sabato
  });
});
