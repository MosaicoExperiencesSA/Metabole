import { domandaNutrizionale, terminiAlimentoCandidati } from './domanda-nutrizionale';

/**
 * QUANDO ANDARE A LEGGERE LA BANCA DATI prima di far parlare Gaia (11/8).
 *
 * Tarato LARGO, al contrario della guardia in uscita: un falso positivo costa una lettura in più al
 * database, un falso negativo costa Gaia che risponde a memoria — cioè il difetto del basmati.
 */
describe('domandaNutrizionale — riconosce che serve un dato', () => {
  it('la domanda da cui è nato tutto', () => {
    expect(domandaNutrizionale('Il riso basmati ha un indice glicemico più basso dell\'integrale?')).toBe(true);
  });

  it('le grandezze chieste in tutti i modi', () => {
    for (const frase of [
      'quante calorie ha la pasta integrale?',
      'quante proteine ci sono in 100 g di pollo?',
      'quanti carboidrati ha il pane?',
      'mi dici i valori nutrizionali della quinoa?',
      'quanti grassi ha l\'avocado?',
    ]) {
      expect(domandaNutrizionale(frase)).toBe(true);
    }
  });

  it('i confronti, che sono la forma più insidiosa', () => {
    for (const frase of [
      'meglio il riso o la pasta?',
      'che differenza c\'è fra pane bianco e integrale?',
      'la mela è più calorica della pera?',
      'le mandorle hanno più calorie delle noci?',
    ]) {
      expect(domandaNutrizionale(frase)).toBe(true);
    }
  });

  it('le domande di sostanza su un cibo', () => {
    expect(domandaNutrizionale('la banana fa ingrassare?')).toBe(true);
    expect(domandaNutrizionale('quanto pane posso mangiare al giorno?')).toBe(true);
  });

  it('la conversazione normale NON la attiva', () => {
    for (const frase of [
      'ciao, come stai?',
      'quando arriva il menu di domani?',
      'oggi non ho voglia di cucinare',
      'ho fatto la spesa, grazie!',
      'posso spostare la data di inizio del piano?',
      'ho la visita giovedì, giusto?',
    ]) {
      expect(domandaNutrizionale(frase)).toBe(false);
    }
  });
});

describe('terminiAlimentoCandidati — cosa registrare fra i mancanti', () => {
  it('tiene le coppie di parole, che sono i nomi veri degli alimenti', () => {
    const t = terminiAlimentoCandidati('quante calorie ha il riso venere?');
    expect(t).toContain('riso venere');
  });

  it('scarta le parole di servizio e le grandezze: non sono alimenti', () => {
    const t = terminiAlimentoCandidati('quante calorie e quante proteine ha il tempeh?');
    expect(t.join(' ')).toContain('tempeh');
    expect(t).not.toContain('calorie');
    expect(t).not.toContain('proteine');
    expect(t).not.toContain('quante');
  });

  it('niente parole cortissime né numeri', () => {
    const t = terminiAlimentoCandidati('ha 100 g di tofu?');
    expect(t.every((x) => !/^\d+$/.test(x))).toBe(true);
  });
});
