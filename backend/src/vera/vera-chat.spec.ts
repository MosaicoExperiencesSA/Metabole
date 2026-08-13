/**
 * Il battesimo di Vera — l'estrazione del nome dalla risposta (13/8, dagli screenshot di Simone).
 *
 * Il difetto era doppio: lo stato «nome» scadeva con la conversazione e il battesimo diventava
 * irraggiungibile per sempre; e l'estrattore prendeva la PRIMA parola, per cui «Ciao ti chiamerò
 * Vera» avrebbe battezzato l'assistente «Ciao».
 */
import { estraiNome } from './vera-chat';

describe('estraiNome', () => {
  it('«scegli tu» e le sue varianti: il nome di scorta', () => {
    for (const f of ['scegli tu', 'Decidi tu', 'come vuoi', 'non so, scegli tu']) {
      expect(estraiNome(f)).toEqual({ tipo: 'scegli_tu' });
    }
  });

  it('capisce «ti chiamerò X» — il caso vero degli screenshot', () => {
    expect(estraiNome('Ciao ti chiamerò Vera')).toEqual({ tipo: 'nome', nome: 'Vera' });
  });

  it('capisce «sarà X» — il secondo tentativo vero', () => {
    expect(estraiNome('mi hai chiesto il tuo nome, sarà Vera')).toEqual({ tipo: 'nome', nome: 'Vera' });
  });

  it('il nome secco, con o senza saluto davanti', () => {
    expect(estraiNome('Vera')).toEqual({ tipo: 'nome', nome: 'Vera' });
    expect(estraiNome('Ciao, Vera')).toEqual({ tipo: 'nome', nome: 'Vera' });
    expect(estraiNome('ok Vera')).toEqual({ tipo: 'nome', nome: 'Vera' });
  });

  it('altre forme esplicite: «ti chiamo», «il tuo nome è», «ti battezzo»', () => {
    expect(estraiNome('ti chiamo Gaia')).toEqual({ tipo: 'nome', nome: 'Gaia' });
    expect(estraiNome('il tuo nome è Bice')).toEqual({ tipo: 'nome', nome: 'Bice' });
    expect(estraiNome('ti battezzo Nina!')).toEqual({ tipo: 'nome', nome: 'Nina' });
  });

  it('NON indovina: una frase di lavoro non è un nome', () => {
    expect(estraiNome('a Giulia Rossi niente formaggi molli')).toBeNull();
    expect(estraiNome('cosa c\'è da vedere?')).toBeNull();
    expect(estraiNome('ok annulla tutto')).toBeNull();
    expect(estraiNome('')).toBeNull();
  });
});
