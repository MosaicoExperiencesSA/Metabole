import { statoViaggioAttivo } from './stato-viaggio';

/**
 * Il campo `travelState` lo scrive un'operatrice e non lo azzera nessuno: non esiste un lavoro
 * notturno che lo pulisca al rientro. Finché si leggeva grezzo, un «in vacanza» di luglio valeva
 * ancora a novembre — e siccome sospende il popup misure (la regola più severa che abbiamo), lo
 * spegneva per sempre su quella cliente, senza un errore né un avviso.
 */

const OGGI = new Date('2026-08-07T10:00:00.000Z');

describe('statoViaggioAttivo', () => {
  it('senza stato non c’è niente da valutare', () => {
    expect(statoViaggioAttivo(null, OGGI)).toBeNull();
    expect(statoViaggioAttivo({ travelState: null }, OGGI)).toBeNull();
  });

  it('con la data di fine vale fino a quel giorno COMPRESO', () => {
    const p = { travelState: 'in_vacanza', travelStart: '2026-07-25', travelEnd: '2026-08-07' };
    expect(statoViaggioAttivo(p, OGGI)).toBe('in_vacanza');
  });

  it('passata la data di fine è scaduto: il popup misure torna a bloccare', () => {
    const p = { travelState: 'in_vacanza', travelStart: '2026-07-01', travelEnd: '2026-07-20' };
    expect(statoViaggioAttivo(p, OGGI)).toBeNull();
  });

  it('senza data di fine scade dopo la finestra massima dalla partenza', () => {
    const vecchia = { travelState: 'in_vacanza', travelStart: '2026-06-01', travelEnd: null };
    const recente = { travelState: 'in_vacanza', travelStart: '2026-07-25', travelEnd: null };
    expect(statoViaggioAttivo(vecchia, OGGI, 30)).toBeNull();
    expect(statoViaggioAttivo(recente, OGGI, 30)).toBe('in_vacanza');
  });

  it('la finestra massima è configurabile e la data di fine vince comunque su di essa', () => {
    const senzaFine = { travelState: 'in_vacanza', travelStart: '2026-06-01', travelEnd: null };
    expect(statoViaggioAttivo(senzaFine, OGGI, 90)).toBe('in_vacanza');
    // Una vacanza lunga ma DICHIARATA resta valida: le date dell'operatrice comandano.
    const lunga = { travelState: 'in_vacanza', travelStart: '2026-05-01', travelEnd: '2026-09-30' };
    expect(statoViaggioAttivo(lunga, OGGI, 30)).toBe('in_vacanza');
  });

  it('senza nessuna data resta valido: non c’è niente su cui far scadere', () => {
    // Inventare una scadenza a partire dal nulla sarebbe peggio del problema: si spegnerebbe
    // una modalità viaggio vera senza che nessuno capisca perché.
    expect(statoViaggioAttivo({ travelState: 'in_vacanza' }, OGGI)).toBe('in_vacanza');
  });

  it('«in partenza» segue le stesse regole', () => {
    expect(statoViaggioAttivo({ travelState: 'in_partenza', travelEnd: '2026-08-09' }, OGGI)).toBe('in_partenza');
    expect(statoViaggioAttivo({ travelState: 'in_partenza', travelEnd: '2026-08-01' }, OGGI)).toBeNull();
  });

  it('«rientrato» non passa mai di qui: è un istante, non un periodo', () => {
    // La sua durata si misura dall'evento `travel_return` (vedi DietAgentService), che ha una
    // data vera; il campo sul profilo invece resta scritto per sempre.
    expect(statoViaggioAttivo({ travelState: 'rientrato', travelEnd: '2026-08-06' }, OGGI)).toBeNull();
  });
});
