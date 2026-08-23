/**
 * ⛔ **LE DUE FRASI CHE LA CLIENTE LEGGE SULLA VISITA — e la differenza fra loro.**
 *
 * Dal 23/8 «serve una visita» ha un termine. Da lì nascono due momenti, e sono opposti:
 *
 *  · **prima** della scadenza la cliente riceve i menu, e va avvisata — se no il blocco le arriva
 *    addosso un giorno qualunque, senza che nessuno gliel'abbia detto;
 *  · **dopo**, i menu sono fermi, e la frase deve dire **da quando** e **perché**. La frase generica
 *    («il menu sarà pronto dopo la visita») è vera e inutile: non dice che oggi è successo qualcosa
 *    che ieri non era successo.
 *
 * ⚠️ Questo file prova il **testo**, non il disegno: è la parte che una persona legge e su cui
 * decide se telefonare o aspettare.
 */
import { describe, expect, it } from 'vitest';
import { menuStatusView, type MenuStatus } from './MenuStatusBanner';

const stato = (p: Partial<MenuStatus>): MenuStatus => ({
  state: 'awaiting_visit',
  availableFrom: null,
  planStartDate: null,
  ...p,
});

describe('⛔ la card quando la visita è scaduta', () => {
  it('⛔ dice la data entro cui andava fatta', () => {
    const v = menuStatusView(stato({ state: 'awaiting_visit', visitaEntro: '2026-09-30' }))!;
    expect(v.text).toContain('30 settembre');
  });

  /** ⛔ E dice **cosa fare**: un blocco senza una strada d'uscita è un muro. */
  it('⛔ e dice a chi rivolgersi', () => {
    const v = menuStatusView(stato({ state: 'awaiting_visit', visitaEntro: '2026-09-30' }))!;
    expect(v.text).toMatch(/coach/i);
  });

  /**
   * ⚠️ **Senza data resta la frase di prima**, e non è una svista: sono le decisioni salvate prima
   * che la data esistesse, e le clienti mai valutate. Scrivere «entro —» farebbe sembrare rotta la
   * card invece che vecchia la riga.
   */
  it('⚠️ senza data resta la frase generica, che per quel caso è quella giusta', () => {
    const v = menuStatusView(stato({ state: 'awaiting_visit' }))!;
    expect(v.title).toBe('Menu dopo la visita');
    expect(v.text).not.toMatch(/\d/);
  });

  /**
   * ⛔ **E il titolo cambia.** «Menu dopo la visita» descrive un'attesa che è sempre stata così;
   * «Manca la visita» dice che c'è una cosa non fatta. Sono due situazioni diverse e la cliente le
   * distingue dal titolo, che è l'unica riga che legge di sicuro.
   */
  it('⛔ il titolo distingue l\'attesa dal termine mancato', () => {
    expect(menuStatusView(stato({ visitaEntro: '2026-09-30' }))!.title).toBe('Manca la visita');
    expect(menuStatusView(stato({}))!.title).toBe('Menu dopo la visita');
  });
});

describe('⚠️ e prima della scadenza il menu resta quello che è', () => {
  /**
   * ⛔ **Il promemoria NON è uno stato.** `menuStatusView` non deve saperne niente: se lo trasformasse
   * in una card, sostituirebbe la frase che la cliente sta già leggendo — «il tuo piano parte il 3»,
   * «serve la tua pesata» — con un promemoria. Sono due cose vere insieme, e le mostra il componente.
   */
  it('⛔ `visitaDaFareEntro` non cambia lo stato del menu', () => {
    expect(menuStatusView(stato({ state: 'available', visitaDaFareEntro: '2026-09-30' }))).toBeNull();
    const v = menuStatusView(stato({ state: 'awaiting_measures', visitaDaFareEntro: '2026-09-30' }))!;
    expect(v.title).toBe('Inserisci le misure iniziali');
  });
});
