/**
 * Il battesimo di Vera — l'estrazione del nome dalla risposta (13/8, dagli screenshot di Simone).
 *
 * Il difetto era doppio: lo stato «nome» scadeva con la conversazione e il battesimo diventava
 * irraggiungibile per sempre; e l'estrattore prendeva la PRIMA parola, per cui «Ciao ti chiamerò
 * Vera» avrebbe battezzato l'assistente «Ciao».
 */
import { estraiNome, nomeDettoEsplicitamente } from './vera-chat';

describe('estraiNome', () => {
  it('«scegli tu» e le sue varianti: il nome di scorta', () => {
    for (const f of ['scegli tu', 'Decidi tu', 'come vuoi', 'non so, scegli tu']) {
      expect(estraiNome(f)).toEqual({ tipo: 'scegli_tu' });
    }
  });

  it('capisce «ti chiamerò X» — il caso vero degli screenshot', () => {
    expect(estraiNome('Ciao ti chiamerò Vera')).toEqual({ tipo: 'nome', nome: 'Vera' });
  });

  it('capisce la SECONDA persona — le frasi vere di Nocanty (13/8, 17:34)', () => {
    // «Ciao ti chiamerai Vera» e «voglio chiamarti Vera»: la prima versione copriva solo
    // «ti chiamerò», e Nocanty parla all'assistente dandole del tu.
    expect(estraiNome('Ciao ti chiamerai Vera')).toEqual({ tipo: 'nome', nome: 'Vera' });
    expect(estraiNome('voglio chiamarti Vera')).toEqual({ tipo: 'nome', nome: 'Vera' });
    expect(estraiNome('ti chiameremo Gaia')).toEqual({ tipo: 'nome', nome: 'Gaia' });
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

/**
 * ⛔ **LE FRASI DEL PRIMO INCONTRO CHE CADEVANO** (31/8): cinque su venticinque della pagina «frasi
 * che non ho capito», tutte nel momento in cui la nutrizionista decide se fidarsi dell'agente.
 */
describe('estraiNome — il modale in mezzo e il verbo «sei»', () => {
  it('⛔ «ti VOGLIO chiamare Vera» e le sue sorelle', () => {
    // ← prima: null, perché la forma chiedeva «ti chiam…» attaccato.
    expect(estraiNome('ti voglio chiamare Vera')).toEqual({ tipo: 'nome', nome: 'Vera' });
    expect(estraiNome('vorrei chiamarti Vera')).toEqual({ tipo: 'nome', nome: 'Vera' });
    expect(estraiNome('ti voglio chiamare "Vera"')).toEqual({ tipo: 'nome', nome: 'Vera' });
  });

  it('⛔ «da oggi SEI Vera»', () => {
    // ← prima: c'era «sarà/sarai», non «sei».
    expect(estraiNome('da oggi sei Vera')).toEqual({ tipo: 'nome', nome: 'Vera' });
    expect(estraiNome('per me sei Vera')).toEqual({ tipo: 'nome', nome: 'Vera' });
  });

  it('⚠️ ma «sei» da solo NON battezza nessuno', () => {
    // Senza la formula che dichiara la scelta, «sei» è la parola più comune della lingua.
    expect(estraiNome('sei sicura?')).toBeNull();
    expect(estraiNome('sei brava')).toBeNull();
  });

  it('⚠️ e «il tuo nome, sarà Vera» funzionava GIÀ', () => {
    // Il passaggio di consegne la dava per rotta: la virgola non sta fra il verbo e il nome.
    // Una cosa letta in un foglio si verifica nel codice prima di ripararla.
    expect(estraiNome('il tuo nome, sarà Vera')).toEqual({ tipo: 'nome', nome: 'Vera' });
  });

  it('⛔ «tu sei sicura?» e «ora sei libera?» NON sono battesimi', () => {
    // ← prima: «sicura» e «libera» diventavano il nome dell'agente, anche al primo incontro. I
    //   prefissi `adesso|ora|tu` non dichiarano nessuna scelta, e il test sceglieva l'unica
    //   formulazione che passava.
    expect(estraiNome('tu sei sicura?')).toBeNull();
    expect(estraiNome('ora sei libera?')).toBeNull();
    expect(estraiNome('adesso sei pronta')).toBeNull();
  });

  it('⛔ dove il nome c\'è già, il candidato dev\'essere un nome PROPRIO', () => {
    // ← prima: «ti chiamo domani» proponeva di ribattezzarsi «domani», e con un «ok» lo scriveva.
    for (const f of ['ti chiamo domani', 'posso chiamarti quando voglio?', 'ti chiamerò domani mattina',
      'da oggi sei operativa', 'per me sei brava', 'ti voglio chiamare più tardi']) {
      expect(nomeDettoEsplicitamente(f, true)).toBeNull();
    }
    // E i nomi veri passano, virgolette comprese.
    expect(nomeDettoEsplicitamente('ti voglio chiamare Vera', true)).toBe('Vera');
    expect(nomeDettoEsplicitamente('da oggi sei Vera', true)).toBe('Vera');
    expect(nomeDettoEsplicitamente('ti voglio chiamare "vera"', true)).toBe('vera');
    // ⚠️ Al PRIMO incontro il vincolo non vale: lì la domanda è appena stata fatta.
    expect(estraiNome('ti chiamerò vera')).toEqual({ tipo: 'nome', nome: 'vera' });
  });

  it('gli altri modali sono coperti, non solo «voglio»', () => {
    // ⚠️ Con «chiamarti» il modale è ridondante (`chiamart…` basta da solo): il caso che prova
    //    davvero l'elenco è «ti <modale> chiamare», dove il verbo sta in mezzo.
    for (const f of ['ti posso chiamare Vera', 'ti potrei chiamare Vera', 'ti preferisco chiamare Vera',
      'ti penso di chiamare Vera', 'ti voglio chiamare Vera']) {
      expect(estraiNome(f)).toEqual({ tipo: 'nome', nome: 'Vera' });
    }
    for (const f of ['posso chiamarti Vera?', 'potrei chiamarti Vera', 'preferisco chiamarti Vera']) {
      expect(estraiNome(f)).toEqual({ tipo: 'nome', nome: 'Vera' });
    }
  });

  it('la forma esplicita è una porta a parte: il nome secco non ci passa', () => {
    // Serve dove il nome c'è già: lì «grazie» non può valere come proposta di ribattezzarsi.
    expect(nomeDettoEsplicitamente('ti voglio chiamare Vera')).toBe('Vera');
    expect(nomeDettoEsplicitamente('Vera')).toBeNull();
    expect(nomeDettoEsplicitamente('grazie')).toBeNull();
    expect(estraiNome('grazie')).toEqual({ tipo: 'nome', nome: 'grazie' });
  });
});
