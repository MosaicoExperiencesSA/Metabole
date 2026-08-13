/**
 * IL QUESTIONARIO PUÒ AGGIUNGERE, NON PUÒ CANCELLARE.
 *
 * Il test che conta è il primo: un reinvio che **non manda** le allergie non deve azzerarle. È il
 * terzo campo che questo stesso `upsert` perdeva — dopo il consenso sanitario (8/8: sei clienti
 * bloccate al carrello) e il tipo di dieta (11/8: spostato dallo staff e tornato indietro due
 * volte) — e stavolta la regola sta fuori, così vale anche per il prossimo.
 */
import { soloSeMandato, unioneSenzaPerdere } from './non-perdere';

describe('un reinvio non cancella quello che non ha mandato', () => {
  it('⚠️ pagina delle allergie saltata: restano quelle di prima', () => {
    // L'upsert è replace: senza questa regola la riga diventava `allergies: []`, in silenzio, e
    // nessuna schermata dell'app o del backoffice permette di rimetterle.
    const out = unioneSenzaPerdere(['latte', 'uova'], []);
    expect(out.valori).toEqual(['latte', 'uova']);
    expect(out.perse).toEqual(['latte', 'uova']);
  });

  it('⚠️ e nemmeno se ne manda solo una: le altre non spariscono', () => {
    const out = unioneSenzaPerdere(['latte', 'uova'], ['latte']);
    expect(out.valori).toEqual(['latte', 'uova']);
    expect(out.perse).toEqual(['uova']);
  });

  it('quello che aggiunge si aggiunge davvero', () => {
    const out = unioneSenzaPerdere(['latte'], ['latte', 'pesce']);
    expect(out.valori).toEqual(['latte', 'pesce']);
    expect(out.perse).toEqual([]);
  });

  it('l\'ordine tiene in cima quello che c\'era: la scheda non si rimescola', () => {
    const out = unioneSenzaPerdere(['latte', 'uova'], ['pesce', 'latte']);
    expect(out.valori).toEqual(['latte', 'uova', 'pesce']);
  });

  it('⚠️ la stessa allergia con un\'altra maiuscola non si duplica', () => {
    // «Latte» e «latte» sono la stessa allergia: due righe uguali nella scheda fanno pensare a un
    // guasto, e in `perse` farebbero comparire un finto tentativo di cancellazione.
    const out = unioneSenzaPerdere(['Latte'], ['latte ']);
    expect(out.valori).toEqual(['Latte']);
    expect(out.perse).toEqual([]);
  });

  it('primo questionario: niente da tenere, niente da segnalare', () => {
    const out = unioneSenzaPerdere(null, ['latte']);
    expect(out.valori).toEqual(['latte']);
    expect(out.perse).toEqual([]);
  });

  it('nessuna allergia né prima né adesso: nessun avviso da dare', () => {
    expect(unioneSenzaPerdere([], [])).toEqual({ valori: [], perse: [] });
    expect(unioneSenzaPerdere(undefined, undefined)).toEqual({ valori: [], perse: [] });
  });
});

describe('soloSeMandato — per i campi che la cliente gestisce da sola', () => {
  it('⚠️ «non te l\'ho detto» e «non ne ho» sono cose diverse', () => {
    // È tutta la differenza: `undefined` non deve toccare la riga, `[]` sì. Trattarli uguali
    // riporterebbe al difetto di partenza; trattarli uguali al contrario impedirebbe alla cliente
    // di svuotare l'elenco dei cibi non graditi, che invece ha il diritto di fare.
    expect(soloSeMandato(undefined)).toBeUndefined();
    expect(soloSeMandato(null)).toBeUndefined();
    expect(soloSeMandato([])).toEqual([]);
  });

  it('quello che manda vale', () => {
    expect(soloSeMandato(['broccoli'])).toEqual(['broccoli']);
  });
});
