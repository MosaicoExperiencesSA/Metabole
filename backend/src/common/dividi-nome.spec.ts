import { certezzaDivisione, dividiNome } from './dividi-nome';

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

/**
 * Di quali divisioni possiamo fidarci. Nasce dai lead importati (8/8): con centinaia di righe
 * «leggi la colonna prima di confermare» non è un consiglio praticabile — va detto QUALI righe
 * leggere.
 */
describe('certezzaDivisione', () => {
  it('due parole: sicuro, non c\'è niente da decidere', () => {
    expect(certezzaDivisione('Rosa Tinelli')).toBe('sicuro');
    expect(certezzaDivisione('  Jolanda   Todde ')).toBe('sicuro');
  });

  it('tre parole CON particella: sicuro, la particella ancora il cognome', () => {
    expect(certezzaDivisione('Maria Teresa De Santis')).toBe('sicuro');
    expect(certezzaDivisione('Anna Di Palma')).toBe('sicuro');
    expect(certezzaDivisione('Peter van Gogh')).toBe('sicuro');
  });

  it('tre parole SENZA particella: da controllare — le due forme sono indistinguibili', () => {
    // Nome composto + cognome...
    expect(certezzaDivisione('Maria Grazia Cerchiara')).toBe('da_controllare');
    // ...e nome + cognome doppio: identiche per qualunque regola.
    expect(certezzaDivisione('Anna Rossi Bianchi')).toBe('da_controllare');
  });

  it('la particella conta solo se sta IN MEZZO', () => {
    // «Di» come primo nome (Di Caprio Leonardo non è questo caso): una particella in testa non
    // ancora niente, il dubbio resta.
    expect(certezzaDivisione('Di Maria Rossi Bianchi')).toBe('da_controllare');
    // Ultima parola: è già il cognome, non aggiunge informazione.
    expect(certezzaDivisione('Anna Maria Lo')).toBe('da_controllare');
  });

  it('una parola sola: `dividiNome` la rifiuta, la certezza non serve a niente', () => {
    // Non è un caso da decidere: senza cognome non si scrive nulla comunque.
    expect(dividiNome('Antonella')).toBeNull();
  });
});
