import { dividiNome } from './dividi-nome';

/**
 * L'import delle liste storiche ha scaricato il nome intero — «Maria Grazia Cerchiara» — nel
 * campo alias, ha messo la prima parola in `firstName` e ha lasciato il cognome VUOTO: in app
 * la cliente veniva chiamata con nome e cognome per esteso, come una raccomandata, e in
 * backoffice la colonna Cognome era vuota (quindi niente ordinamento, niente ricerca).
 *
 * Questa è la regola con cui si rimette a posto, e va guardata bene perché è una scelta.
 */
describe('dividiNome', () => {
  it('nome composto: l’ultima parola è il cognome', () => {
    expect(dividiNome('Maria Grazia Cerchiara')).toEqual({ nome: 'Maria Grazia', cognome: 'Cerchiara' });
  });

  it('nome semplice', () => {
    expect(dividiNome('Anna Bianchi')).toEqual({ nome: 'Anna', cognome: 'Bianchi' });
  });

  it('le PARTICELLE restano col cognome (altrimenti nasce una signora «Santis»)', () => {
    expect(dividiNome('Maria Teresa De Santis')).toEqual({ nome: 'Maria Teresa', cognome: 'De Santis' });
    expect(dividiNome('Luca Della Valle')).toEqual({ nome: 'Luca', cognome: 'Della Valle' });
    expect(dividiNome('Giulia Van Der Berg')).toEqual({ nome: 'Giulia', cognome: 'Van Der Berg' });
  });

  it('una parola sola: NON si inventa un cognome', () => {
    expect(dividiNome('Maria')).toBeNull();
    expect(dividiNome('   ')).toBeNull();
  });

  it('spazi doppi e bordi non contano', () => {
    expect(dividiNome('  Anna   Bianchi  ')).toEqual({ nome: 'Anna', cognome: 'Bianchi' });
  });
});
