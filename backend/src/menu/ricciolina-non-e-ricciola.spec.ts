import { exclusionKeys, hitsExclusion } from './exclusions';
import { ePesce } from '../catalog/piatto-di-cosa';

/**
 * ⛔ LA RICCIOLINA È UNA CICORIA — trovata in produzione l'1/9, e il file la aspettava.
 *
 * In cima a `exclusions.ts` c'è scritto da settimane: *«"ricciola" ha radice `ricciol`, che a
 * inizio parola prende anche i "riccioli"… se un giorno il costo si vede su tanti riccioli, la
 * strada è insegnare le omonime alla radice — non togliere la ricciola»*.
 *
 * Il giorno è arrivato: «Torta di Riso Integrale con Ricotta e Cicoria Amara Cruda (ricciolina)»
 * stava per essere riscritta **pescetariana** dentro un blocco di 549 correzioni automatiche.
 *
 * ⚠️ **E queste prove guardano tutte e due i versi**, perché la direzione sbagliata qui non è un
 * piatto di troppo: `ePesce` tiene al sicuro anche chi è allergico al pesce, e una ricciola che
 * smette di essere un pesce è una persona in pronto soccorso.
 */
describe('ricciolina, riccioli: non sono la ricciola', () => {
  const pesce = () => exclusionKeys(['pesce']);

  it.each([
    ['cicoria amara cruda (ricciolina)'],
    ['insalata ricciolina'],
    ['riccioli di burro'],
    ['riccioli integrali'],
    ['un ricciolo di panna'],
  ])('⛔ non è pesce: %s', (t) => {
    expect(hitsExclusion(t, pesce())).toBeNull();
    expect(ePesce(t)).toBe(false);
  });

  it.each([
    ['ricciola fresca'],
    ['filetto di ricciola'],
    ['Ricciola al forno con patate'],
    ['carpaccio di ricciola'],
  ])('⚠️ ma la ricciola resta pesce: %s', (t) => {
    expect(ePesce(t)).toBe(true);
  });

  /** ⛔ E il resto del vocabolario non si è mosso: una prova che toglie soltanto non basta. */
  it('gli altri pesci non sono cambiati', () => {
    for (const t of ['orata al forno', 'branzino intero', 'sgombro fresco', 'palombo in umido']) {
      expect(ePesce(t)).toBe(true);
    }
  });
});
