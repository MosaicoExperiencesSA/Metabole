/**
 * ⛔ **LE PROVE DEL METODO DETTATO A VERA.**
 *
 * Simone, 4/9: la ricetta dettata deve chiedere anche **come si prepara**. Fino a quel giorno Vera
 * scriveva `cookingMethods: []`, e nell'app la cliente apriva la scheda trovando gli ingredienti e
 * nient'altro.
 *
 * ⚠️ La metà che conta è la seconda: qui **non si indovina niente**. Un modo scelto da noi, o un
 * elenco di passaggi inventato per non fare una domanda in più, finisce dritto nella scheda che
 * legge una persona mentre cucina.
 */
import { leggiMetodo, etichettaDelMetodo } from './metodo-dettato';

describe('il modo di cottura', () => {
  it.each([
    ['al forno\nscaldare a 180 gradi\ninfornare 20 minuti', 'forno'],
    ['in padella\nrosolare la cipolla', 'padella'],
    ['al vapore\ncuocere 8 minuti', 'vapore'],
    ['veloce\nmescolare tutto', 'veloce'],
    ['meal prep\nprepararlo la domenica', 'meal_prep'],
    ['piatto freddo\ncondire e servire', 'piatto_freddo'],
    ['senza cottura\nmescolare in una ciotola', 'piatto_freddo'],
    ['Al Forno\nInfornare', 'forno'],
  ])('legge il modo da «%s»', (frase, atteso) => {
    const e = leggiMetodo(frase);
    expect(e.tipo).toBe('metodo');
    expect(e.tipo === 'metodo' && e.metodo.type).toBe(atteso);
  });

  /**
   * ⛔ **IL MODO SI CERCA SOLO NELLA PRIMA RIGA.** Cercarlo in tutto il testo vorrebbe dire che
   * «poi si lascia raffreddare» rende il piatto freddo, e che «rosolare in padella» al passo tre
   * cambia il modo scelto al passo uno. È il difetto che questo file esiste per non avere.
   */
  it('⛔ una parola nei passaggi non cambia il modo scelto nella prima riga', () => {
    const e = leggiMetodo('al forno\ninfornare 20 minuti\npoi rosolare in padella\nservire freddo');
    expect(e.tipo === 'metodo' && e.metodo.type).toBe('forno');
  });

  /** ⚠️ Vince il sinonimo più lungo: senza un criterio la risposta dipenderebbe dall'ordine dell'elenco. */
  it('⚠️ «senza cottura» è piatto freddo, non una rinuncia', () => {
    expect(leggiMetodo('senza cottura\nmescolare').tipo).toBe('metodo');
  });

  /** ⚠️ Il modo e il primo passaggio sulla stessa riga: è come si scrive quando si ha fretta. */
  it('⚠️ separa il modo dal passaggio sui due punti', () => {
    const e = leggiMetodo('al forno: scaldare a 180 gradi\ninfornare 20 minuti');
    expect(e.tipo === 'metodo' && e.metodo).toEqual({ type: 'forno', steps: ['scaldare a 180 gradi', 'infornare 20 minuti'] });
  });

  /**
   * ⛔ **Una riga che nomina DUE cotture non è una risposta: è un dubbio, e si chiede.**
   *
   * «al forno, poi in padella» potrebbe voler dire due cose, e sceglierne una vorrebbe dire
   * scrivere in scheda un modo che non è quello che ha detto lei. Torna indietro come `senza_modo`,
   * con la riga conservata fra i passaggi — così non si perde niente di quello che ha scritto.
   */
  it('⛔ una riga con due cotture non si sceglie: si richiede', () => {
    const e = leggiMetodo('al forno, poi in padella\nscaldare');
    expect(e.tipo).toBe('senza_modo');
    expect(e.tipo === 'senza_modo' && e.steps).toEqual(['al forno, poi in padella', 'scaldare']);
  });

  /**
   * ⚠️ **Le risposte vere di una persona, non le tre parole del manuale.** Prima finivano tutte fra
   * i passaggi con una domanda in più addosso: la punteggiatura non era prevista, e i verbi del
   * cuocere nemmeno.
   */
  it.each([
    ['Al forno!\ninfornare 20 minuti', 'forno'],
    ['lo cuocio al forno\ninfornare', 'forno'],
    ['va in forno\ninfornare', 'forno'],
    ['al forno (180 gradi)\ninfornare', 'forno'],
    ['cottura: al vapore\ncuocere 8 minuti', 'vapore'],
  ])('⚠️ legge anche «%s»', (frase, atteso) => {
    const e = leggiMetodo(frase);
    expect(e.tipo === 'metodo' && e.metodo.type).toBe(atteso);
  });

  /**
   * ⛔ **E il confine regge dall'altra parte**: «scaldare il forno a 180 gradi» nomina il forno ed è
   * un passaggio. Se diventasse un modo, quella riga sparirebbe dall'elenco — e il campo
   * risulterebbe compilato, quindi nessuno se ne accorgerebbe.
   */
  it('⛔ ma un passaggio che nomina la cottura resta un passaggio', () => {
    expect(leggiMetodo('scaldare il forno a 180 gradi\ninfornare 20 minuti').tipo).toBe('senza_modo');
  });

  it('toglie trattini e numerazione dai passaggi', () => {
    const e = leggiMetodo('al forno\n- scaldare a 180\n2) infornare\n· sfornare');
    expect(e.tipo === 'metodo' && e.metodo.steps).toEqual(['scaldare a 180', 'infornare', 'sfornare']);
  });
});

describe('quello che manca, e non si inventa', () => {
  /**
   * ⛔ Scrivere `steps: []` sarebbe una ricetta che in app mostra un titolo di sezione e sotto il
   * vuoto: peggio di non avere la sezione. Si richiede.
   */
  it('⛔ il modo senza passaggi non diventa una lista vuota: si richiede', () => {
    expect(leggiMetodo('al forno')).toEqual({ tipo: 'senza_passi', type: 'forno' });
  });

  /** ⛔ E i passaggi senza il modo non fanno indovinare il modo dai passaggi. */
  it('⛔ i passaggi senza il modo chiedono quale', () => {
    const e = leggiMetodo('scaldare il forno a 180 gradi\ninfornare 20 minuti');
    expect(e.tipo).toBe('senza_modo');
    expect(e.tipo === 'senza_modo' && e.steps).toEqual(['scaldare il forno a 180 gradi', 'infornare 20 minuti']);
  });

  it.each([['salta'], ['lascia stare'], ['non lo so'], ['niente'], ['non serve'], ['dopo']])(
    '«%s» salta il passo invece di far finta di aver capito',
    (frase) => { expect(leggiMetodo(frase)).toEqual({ tipo: 'salta' }); },
  );

  /**
   * ⛔ **«senza» da sola NON salta**: «senza cottura» è un modo, e leggerla come rinuncia vorrebbe
   * dire rispondere «va bene, lo scrivo senza metodo» a chi sta descrivendo un piatto crudo.
   */
  it('⛔ «senza cottura» non è una rinuncia', () => {
    expect(leggiMetodo('senza cottura\nmescolare').tipo).toBe('metodo');
  });

  /**
   * ⛔ **LE FRASI CHE COMINCIANO CON UNA PAROLA DA RINUNCIA — il difetto del 4/9.**
   *
   * L'ancora stava solo davanti, quindi `\b` faceva scattare la rinuncia su qualunque frase
   * italiana che *comincia* con «dopo», «niente», «nessuno». ⛔ E il danno non era perdere il
   * metodo: era **dire il contrario** — Vera rispondeva «Va bene, la scrivo senza i passaggi» a chi
   * glieli aveva appena dettati. Ora le parole di rinuncia devono essere **tutta** la risposta.
   */
  it.each([
    ['dopo aver lessato la pasta, saltare in padella\nmantecare'],
    ['niente cottura, è un piatto freddo\ncondire e servire'],
    ['nessuna cottura: si monta a freddo\nmescolare'],
  ])('⛔ non è una rinuncia: %s', (frase) => {
    expect(leggiMetodo(frase).tipo).not.toBe('salta');
  });

  /** ⚠️ E la punteggiatura in fondo resta una rinuncia: «basta.» è «basta». */
  it.each([['salta.'], ['lascia stare!'], ['non lo so...']])('⚠️ «%s» resta una rinuncia', (frase) => {
    expect(leggiMetodo(frase)).toEqual({ tipo: 'salta' });
  });

  it('una frase vuota non è un metodo', () => {
    expect(leggiMetodo('')).toEqual({ tipo: 'non_capito' });
    expect(leggiMetodo('   \n  ')).toEqual({ tipo: 'non_capito' });
  });
});

describe('l\'etichetta', () => {
  it('è quella della tendina', () => {
    expect(etichettaDelMetodo('piatto_freddo')).toBe('Piatto freddo');
    expect(etichettaDelMetodo('forno')).toBe('Al forno');
  });

  /** ⚠️ Un codice che non conosciamo si stampa com'è: non si tace e non si finge. */
  it('⚠️ e un codice sconosciuto si stampa com\'è', () => {
    expect(etichettaDelMetodo('affumicatura')).toBe('affumicatura');
  });
});
