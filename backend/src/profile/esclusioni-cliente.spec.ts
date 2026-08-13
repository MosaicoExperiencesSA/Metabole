/**
 * L'ELENCO CHE LA CLIENTE LEGGE.
 *
 * I due test che contano: l'espansione (senza, la schermata ripete quello che lei ha già scritto) e
 * la voce non traducibile che resta visibile ma vuota — perché è l'unico modo di non farle credere
 * di essere protetta da una parola che oggi non toglie niente.
 */
import { esclusioniCliente } from './esclusioni-cliente';

describe('cosa non deve arrivarle nel piatto', () => {
  it('⚠️ le allergie si ESPANDONO negli alimenti veri', () => {
    const e = esclusioniCliente({ allergies: ['frutta_a_guscio'] });
    expect(e.vietati[0].voce).toBe('Frutta a guscio');
    expect(e.vietati[0].alimenti).toEqual(expect.arrayContaining(['noci', 'mandorle', 'nocciole']));
  });

  it('⚠️ una voce che nessuno sa tradurre resta VISIBILE e vuota', () => {
    // «Favismo» non compare in nessun ingrediente: oggi non toglie niente. Nasconderla vorrebbe dire
    // farle sparire una cosa che ha dichiarato lei; mostrarla piena le farebbe credere di essere
    // protetta. L'app ci scrive sopra che la nutrizionista la sta traducendo.
    const e = esclusioniCliente({ allergies: ['Favismo'] });
    expect(e.vietati).toEqual([{ voce: 'Favismo', alimenti: [], motivo: 'allergia' }]);
  });

  it('intolleranze e non graditi stanno insieme, ma restano distinguibili', () => {
    const e = esclusioniCliente({ intolerances: ['lattosio'], dislikedFoods: ['cavolfiore'] });
    expect(e.daEvitare.map((v) => v.motivo)).toEqual(['intolleranza', 'non_gradito']);
    expect(e.vietati).toEqual([]);
  });

  it('⚠️ «altro» e «nessuna» non sono alimenti e non compaiono', () => {
    const e = esclusioniCliente({ allergies: ['altro', 'nessuna'], intolerances: ['other'] });
    expect(e.vietati).toEqual([]);
    expect(e.daEvitare).toEqual([]);
  });

  it('il codice UE diventa l\'etichetta che si legge', () => {
    expect(esclusioniCliente({ allergies: ['glutine'] }).vietati[0].voce).toMatch(/glutine/i);
  });

  it('un profilo vuoto non inventa niente', () => {
    expect(esclusioniCliente({})).toEqual({ vietati: [], daEvitare: [] });
  });
});
