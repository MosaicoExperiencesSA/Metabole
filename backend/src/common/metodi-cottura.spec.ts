/**
 * I metodi di cottura vivevano in QUATTRO posti già divergenti: la tendina del backoffice ne
 * conosceva tre, il motore cinque, l'app tre, il prompt dell'AI tre scritte a mano dentro la
 * stringa. Questi test sorvegliano le due proprietà che tengono l'elenco unito.
 */
import { CODICI_METODI, METODI_COTTURA, etichettaMetodo } from './metodi-cottura';

describe('metodi di cottura', () => {
  it('«piatto freddo» c\'è (richiesta di Simone dell\'11/8)', () => {
    expect(CODICI_METODI).toContain('piatto_freddo');
    expect(etichettaMetodo('piatto_freddo')).toBe('Piatto freddo');
  });

  it('ci sono anche quelli che il motore usava e la tendina non offriva', () => {
    expect(CODICI_METODI).toEqual(expect.arrayContaining(['veloce', 'forno', 'padella', 'vapore', 'meal_prep']));
  });

  it('nessun codice doppio: una tendina con due voci uguali è un dato sbagliato che aspetta', () => {
    expect(new Set(CODICI_METODI).size).toBe(CODICI_METODI.length);
  });

  it('ogni metodo ha un\'etichetta scritta per una persona, non un codice ripulito', () => {
    for (const m of METODI_COTTURA) {
      expect(m.label.trim()).not.toBe('');
      expect(m.label).not.toBe(m.code);
    }
  });

  it('un codice SCONOSCIUTO non torna mai grezzo', () => {
    // È il caso che si presenta fra il deploy del backend e quello dell'app.
    expect(etichettaMetodo('sotto_vuoto')).toBe('Sotto vuoto');
    expect(etichettaMetodo('griglia')).toBe('Griglia');
  });

  it('niente valore, niente etichetta: non si inventa un metodo che non c\'è', () => {
    expect(etichettaMetodo(null)).toBe('');
    expect(etichettaMetodo(undefined)).toBe('');
    expect(etichettaMetodo('')).toBe('');
  });
});
