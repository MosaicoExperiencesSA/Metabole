import { cercaValida, motivoLeggibile, nomeECognome, paginaValida } from './elenco';

describe('invito a Gaia — elenchi del pannello (17/9)', () => {
  it('nome e cognome separati: si usano così', () => {
    expect(nomeECognome({ firstName: 'Maria', lastName: 'Rossi', name: 'MARIA ROSSI' })).toEqual({ nome: 'Maria', cognome: 'Rossi' });
  });

  it('scheda importata con il solo nome intero: si divide', () => {
    expect(nomeECognome({ firstName: 'Maria', lastName: null, name: 'Maria Grazia Cerchiara' })).toEqual({ nome: 'Maria Grazia', cognome: 'Cerchiara' });
    expect(nomeECognome({ name: 'Anna De Santis' })).toEqual({ nome: 'Anna', cognome: 'De Santis' });
  });

  it('una parola sola: resta nel nome, il cognome non si inventa', () => {
    expect(nomeECognome({ name: 'Lucia' })).toEqual({ nome: 'Lucia', cognome: '' });
    expect(nomeECognome({})).toEqual({ nome: '', cognome: '' });
    expect(nomeECognome({ firstName: 'Lucia' })).toEqual({ nome: 'Lucia', cognome: '' });
  });

  it('i motivi degli scarti si leggono in italiano', () => {
    expect(motivoLeggibile('saltato:account')).toBe('Ha già un account');
    expect(motivoLeggibile('fallito')).toContain('non riuscito');
    expect(motivoLeggibile('saltato:nuovo')).toBe('saltato:nuovo');
    expect(motivoLeggibile(null)).toBeNull();
  });

  it('pagina e ricerca ripulite', () => {
    expect(paginaValida('3')).toBe(3);
    expect(paginaValida('0')).toBe(1);
    expect(paginaValida('abc')).toBe(1);
    expect(paginaValida(undefined)).toBe(1);
    expect(paginaValida('2.5')).toBe(1);
    expect(cercaValida('  rossi ')).toBe('rossi');
    expect(cercaValida('a')).toBeNull();
    expect(cercaValida(undefined)).toBeNull();
    expect(cercaValida('x'.repeat(200))).toHaveLength(80);
  });
});
