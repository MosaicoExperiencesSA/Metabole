/**
 * ⛔ **I SOLFITI: quattro condimenti si sostituiscono, due piatti escono.**
 *
 * Le decisioni sono di Simone (24/8) e le righe della capo nutrizionista. Il test che conta più di
 * tutti è il primo: prima di oggi chi dichiarava i solfiti perdeva **quasi ogni insalata condita**
 * per via dell'aceto, e l'intera colazione dolce per via dei biscotti — un divieto che toglie mezzo
 * catalogo non protegge meglio, fa smettere di fidarsi dell'elenco.
 */
import { suggestAllergens } from '../catalog/allergens';
import { esclusioniDi, valutaRicetta } from './esclusioni-della-cliente';
import { ALLERGENE_SOLFITI, CAMBIANO_IL_PIATTO, SI_TOLGONO_E_BASTA, SOSTITUTI_SENZA_SOLFITI, TESTO_SI_TOGLIE, decisioneSolfiti, dichiaraSolfiti } from './solfiti';

const ricetta = (nome: string, ingredienti: string[]) => ({
  id: `r-${nome}`,
  name: nome,
  ingredients: ingredienti.map((name) => ({ name })),
  allergens: [] as string[],
});

const conSolfiti = () => esclusioniDi({ allergies: [ALLERGENE_SOLFITI] });

describe('decisioneSolfiti — tre si sostituiscono, il vino si toglie', () => {
  it('⛔ l\'ACETO non toglie più il piatto: arriva il succo di limone', () => {
    expect(decisioneSolfiti('aceto di vino')).toEqual({ azione: 'sostituisci', con: 'succo di limone fresco' });
    expect(decisioneSolfiti('aceto balsamico')).toEqual({ azione: 'sostituisci', con: 'succo di limone fresco' });
  });

  /**
   * ⛔ **IL VINO SI TOGLIE E BASTA** (Simone, 24/8: «dove è previsto vino semplicemente togliamo il
   * vino»). Prima diventava «brodo vegetale casalingo con un goccio di limone», che è la riga della
   * guida per il vino **da sfumare** — ma la parola «vino» in un ingrediente non dice se serve a
   * sfumare una padella o se **è il piatto**: su «pere al vino rosso» venivano fuori pere nel brodo
   * vegetale. Una proposta così non fa perdere solo quel piatto: fa smettere di fidarsi anche delle
   * sostituzioni giuste.
   */
  it('⛔ il vino non si sostituisce: si toglie', () => {
    expect(decisioneSolfiti('vino bianco')).toEqual({ azione: 'togli' });
    expect(decisioneSolfiti('vino rosso')).toEqual({ azione: 'togli' });
    expect(decisioneSolfiti('marsala')).toEqual({ azione: 'togli' });
  });

  /**
   * ⚠️ **L'elenco è scritto a mano, e non è pigrizia al contrario**: iterando la costante il test
   * girerebbe su se stesso — cancellando `spumante`, `prosecco` e `sidro` resterebbe verde, e un
   * piatto sfumato al prosecco arriverebbe a un'allergica. Misurato in revisione il 24/8.
   */
  it.each(['vino', 'marsala', 'spumante', 'prosecco', 'sidro'])('⚠️ «%s» si toglie', (voce) => {
    expect(decisioneSolfiti(voce)).toEqual({ azione: 'togli' });
  });

  it('e la lista è esattamente quella: se qualcuno ne cancella una, qui diventa rosso', () => {
    expect(SI_TOLGONO_E_BASTA).toEqual(['vino', 'marsala', 'spumante', 'prosecco', 'sidro']);
    expect(JSON.stringify(SOSTITUTI_SENZA_SOLFITI)).not.toContain('brodo vegetale casalingo');
  });

  /**
   * ⚠️ **La frase che legge la cliente è fissata qui.** È una decisione di prodotto e la mostrano
   * tre punti (app, back office, PDF): senza un assert letterale si poteva cambiare in «xxx» e
   * 1309 test restavano verdi, perché ognuno la importava come costante.
   */
  it('⚠️ e la frase è quella, parola per parola', () => {
    expect(TESTO_SI_TOGLIE).toBe('si toglie (niente al suo posto)');
  });

  it('il dado industriale diventa dado casalingo', () => {
    expect(decisioneSolfiti('dado da brodo')).toEqual({ azione: 'sostituisci', con: 'dado vegetale casalingo (o brodo fresco)' });
  });

  it('la frutta essiccata industriale si essicca in casa', () => {
    expect(decisioneSolfiti('uvetta')).toEqual({ azione: 'sostituisci', con: 'frutta fresca essiccata in casa a bassa temperatura' });
  });

  /**
   * ⚠️ **Le chiavi lunghe vincono su quelle corte.** «albicocche secche» ha una frase sua; lasciando
   * vincere una chiave più corta si perderebbe il nome dell'alimento e la cliente leggerebbe
   * «frutta fresca essiccata in casa» dove poteva leggere «albicocche».
   */
  it('⚠️ «albicocche secche» prende la sua frase, non quella generica', () => {
    expect(decisioneSolfiti('albicocche secche')).toEqual({
      azione: 'sostituisci', con: 'albicocche essiccate in casa a bassa temperatura',
    });
  });

  /**
   * ⚠️ Il sostituto **dice anche perché è sicuro** dove serve: l'aceto di mele normale i solfiti ce
   * l'ha (170 mg/kg), ed è la dicitura in etichetta a fare la differenza.
   */
  it('⚠️ nessun sostituto manda a comprare la cosa sbagliata: il limone è fresco, la frutta si essicca in casa', () => {
    const tutte = ['aceto', 'dado', 'uvetta'].map((i) => decisioneSolfiti(i));
    for (const s of tutte) {
      expect(s).toMatchObject({ azione: 'sostituisci' });
      expect((s as { con: string }).con).not.toMatch(/^aceto di mele$/);
    }
  });
});

describe('decisioneSolfiti — i due che cambiano il piatto', () => {
  it('⛔ i crostacei NON si sostituiscono: un gambero non è un branzino', () => {
    expect(decisioneSolfiti('gamberi')).toEqual({ azione: 'fuori' });
    expect(decisioneSolfiti('mazzancolle')).toEqual({ azione: 'fuori' });
  });

  it('⛔ e nemmeno gli insaccati', () => {
    expect(decisioneSolfiti('salsiccia')).toEqual({ azione: 'fuori' });
    expect(decisioneSolfiti('salame')).toEqual({ azione: 'fuori' });
  });

  /**
   * ⚠️ **L'ordine dei due controlli, e perché è scritto in un test.** Se un giorno qualcuno mettesse
   * i gamberi anche fra i sostituti, la lista che **esclude** deve vincere: sbagliare in quel verso
   * costa un piatto in meno, sbagliare nell'altro costa una cliente che mangia una cosa che non
   * aveva scelto.
   */
  it('⛔ «fuori» vince sempre su «sostituisci»', () => {
    expect(decisioneSolfiti('gamberi al vino bianco')).toEqual({ azione: 'fuori' });
  });
});

describe('decisioneSolfiti — quello che NON tocca', () => {
  it('un ingrediente qualunque non la riguarda', () => {
    expect(decisioneSolfiti('petto di pollo')).toBeNull();
    expect(decisioneSolfiti('zucchine')).toBeNull();
    expect(decisioneSolfiti('')).toBeNull();
  });

  /**
   * ⚠️ **Mai per sottostringa.** È la trappola che in questo progetto ha già morso tre volte («mela»
   * dentro «melanzane»). Qui il caso vero è **sottaceti**: contiene «aceto» come sottostringa, ma non
   * è aceto da sostituire col limone — è un ortaggio conservato, e resta un divieto (ha una riga sua
   * in `exclusions.ts`).
   */
  it('⛔ «sottaceti» non è «aceto»: nessuna sostituzione da qui', () => {
    expect(decisioneSolfiti('sottaceti')).toBeNull();
    expect(decisioneSolfiti('cetriolini sottaceto')).toBeNull();
  });
});

describe('dichiaraSolfiti', () => {
  it('riconosce il codice, il plurale e la dicitura per esteso', () => {
    expect(dichiaraSolfiti({ allergies: ['solfiti'] })).toBe(true);
    expect(dichiaraSolfiti({ allergies: ['Solfiti '] })).toBe(true);
    expect(dichiaraSolfiti({ allergies: ['anidride solforosa'] })).toBe(true);
  });

  it('e non si accende su altro', () => {
    expect(dichiaraSolfiti({ allergies: ['glutine', 'pesce'] })).toBe(false);
    expect(dichiaraSolfiti({ allergies: [] })).toBe(false);
    expect(dichiaraSolfiti({})).toBe(false);
  });
});

/**
 * ⛔ **LA PARTE CHE VALE: cosa arriva davvero nel piatto.** I test qui sopra guardano la tabella;
 * questi guardano il motore, cioè `valutaRicetta`, che è il punto obbligato prima di servire.
 */
describe('la cliente allergica ai solfiti, sul piatto vero', () => {
  it('⛔ l\'insalata condita TORNA: prima spariva, adesso arriva col limone', () => {
    const r = ricetta('Insalata mista', ['lattuga', 'pomodoro', 'olio evo', 'aceto di vino']);
    const { violations, subs } = valutaRicetta(r, conSolfiti());
    expect(violations).toEqual([]);
    expect(subs).toEqual([expect.objectContaining({ from: 'aceto di vino', to: 'succo di limone fresco' })]);
  });

  /**
   * ⛔ **E questo è il test che tiene ferma la parola `aceto` in `exclusions.ts`.**
   *
   * Quello qui sopra non bastava, e l'ha mostrato una mutazione: «aceto **di vino**» viene
   * riconosciuto anche dalla parola `vino`, quindi togliendo `aceto` dall'elenco il test restava
   * verde. L'aceto balsamico no — nessun'altra parola lo prende. Se `aceto` sparisce da lì, a una
   * persona allergica il balsamico arriva **così com'è**: è il difetto peggiore possibile qui, e
   * prima di questa riga non lo vedeva nessuno.
   */
  it('⛔ l\'aceto BALSAMICO, che nessun\'altra parola prende, va comunque riconosciuto', () => {
    const r = ricetta('Insalata di rucola', ['rucola', 'grana', 'aceto balsamico']);
    const { violations, subs } = valutaRicetta(r, conSolfiti());
    expect(violations).toEqual([]);
    expect(subs).toEqual([expect.objectContaining({ from: 'aceto balsamico', to: 'succo di limone fresco' })]);
  });

  it('⛔ la colazione dolce torna: «biscotti» non è più un divieto', () => {
    const r = ricetta('Latte e biscotti', ['latte', 'biscotti secchi']);
    const { violations, subs } = valutaRicetta(r, conSolfiti());
    expect(violations).toEqual([]);
    expect(subs).toEqual([]);
  });

  it('⛔ ma i gamberi restano fuori, e l\'errore dice PERCHÉ non c\'è un sostituto', () => {
    const r = ricetta('Gamberi alla piastra', ['gamberi', 'olio evo', 'prezzemolo']);
    const { violations, subs } = valutaRicetta(r, conSolfiti());
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('cambierebbe il piatto');
    expect(subs).toEqual([]);
  });

  it('⛔ e gli insaccati pure', () => {
    const { violations } = valutaRicetta(ricetta('Pasta con salsiccia', ['pasta', 'salsiccia', 'pomodoro']), conSolfiti());
    expect(violations).toHaveLength(1);
  });

  it('⚠️ «sottaceti» resta un divieto: non è l\'aceto, ed è un ortaggio conservato', () => {
    const { violations, subs } = valutaRicetta(ricetta('Antipasto', ['sottaceti', 'bresaola']), conSolfiti());
    expect(violations).toHaveLength(1);
    expect(subs).toEqual([]);
  });

  it('il risotto sfumato al vino si serve senza il vino, e il piatto resta', () => {
    const r = ricetta('Risotto ai funghi', ['riso', 'funghi champignon', 'vino bianco', 'burro']);
    const { violations, subs } = valutaRicetta(r, conSolfiti());
    expect(violations).toEqual([]);
    expect(subs).toEqual([expect.objectContaining({ from: 'vino bianco', to: TESTO_SI_TOGLIE })]);
  });

  /**
   * ⛔ **IL CASO CHE HA CAMBIATO LA REGOLA**: «pere al vino rosso». Col sostituto diventavano pere
   * nel brodo vegetale. Togliendo il vino e basta diventavano pere bollite **con un nome che
   * promette altro**, e con le kcal del dolce col vino: la contraddizione la scioglieva la cliente.
   * Quando il vino è nel NOME del piatto, il piatto esce — come per ogni altro allergene senza
   * sostituto (rilievo della revisione del 24/8).
   */
  it('⛔ «pere al vino rosso» esce dal catalogo: senza il vino non è più quel piatto', () => {
    const { violations, subs } = valutaRicetta(ricetta('Pere al vino rosso', ['pere', 'vino rosso', 'zucchero', 'cannella']), conSolfiti());
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('nel nome del piatto');
    expect(subs).toEqual([]);
  });

  it('⛔ e lo stesso lo zabaione al marsala', () => {
    const { violations } = valutaRicetta(ricetta('Zabaione al marsala', ['uova', 'zucchero', 'marsala']), conSolfiti());
    expect(violations).toHaveLength(1);
  });

  /**
   * ⚠️ **Ma il nome NON è una scorciatoia per escludere tutto**: «straccetti di bovino» contiene
   * «vino», ed è il falso positivo di riferimento di questo progetto. Il controllo sul nome passa
   * dalle stesse omonime degli ingredienti.
   */
  it('⚠️ «straccetti di bovino» non esce: «bovino» non è «vino»', () => {
    const { violations, subs } = valutaRicetta(ricetta('Straccetti di bovino', ['straccetti di bovino', 'rucola']), conSolfiti());
    expect(violations).toEqual([]);
    expect(subs).toEqual([]);
  });

  it('⚠️ a chi NON ha dichiarato i solfiti non cambia niente: l\'aceto resta aceto', () => {
    const senza = esclusioniDi({ allergies: ['glutine'] });
    const { violations, subs } = valutaRicetta(ricetta('Insalata mista', ['lattuga', 'aceto di vino']), senza);
    expect(violations).toEqual([]);
    expect(subs).toEqual([]);
  });
});

/**
 * ⛔ **I SEI RILIEVI DELLA REVISIONE DEL 24/8.** Ognuno di questi test è nato da una mutazione che
 * restava verde, o da un caso che passava intatto: sono la parte di questa consegna che non c'era.
 */
describe('⛔ quello che la revisione ha trovato, e che adesso è coperto', () => {
  /**
   * ⛔ **IL PEGGIORE: il tag scritto in automatico annullava le sostituzioni.**
   * `engine-rules.service` scrive i tag SUGGERITI su ogni ricetta generata, e il motore blocca su un
   * tag anche non confermato. Allargando il dizionario nella stessa consegna, il tag `solfiti`
   * finiva **proprio sulle ricette che le sostituzioni dovevano salvare**: la sostituzione veniva
   * calcolata e buttata via, e il piatto spariva lo stesso.
   */
  it('⛔ una ricetta TAGGATA solfiti, con un aceto sostituibile, si serve col limone', () => {
    const r = { ...ricetta('Insalata mista', ['lattuga', 'aceto balsamico']), allergens: ['solfiti'] };
    const { violations, subs } = valutaRicetta(r, conSolfiti());
    expect(violations).toEqual([]);
    expect(subs).toEqual([expect.objectContaining({ to: 'succo di limone fresco' })]);
  });

  it('⚠️ ma se dagli ingredienti non sappiamo dire NIENTE, il tag torna a bloccare', () => {
    // La nutrizionista ha taggato a mano su un ingrediente che il nostro elenco non nomina: lì lei
    // sa una cosa che noi non sappiamo, e vince lei.
    const r = { ...ricetta('Torta della nonna', ['farina', 'uova', 'zucchero']), allergens: ['solfiti'] };
    expect(valutaRicetta(r, conSolfiti()).violations).toHaveLength(1);
  });

  it('⚠️ e per gli ALTRI allergeni il tag blocca come sempre: lì non c\'è niente da sostituire', () => {
    const r = { ...ricetta('Pane e pomodoro', ['pane', 'pomodoro']), allergens: ['glutine'] };
    const conGlutine = esclusioniDi({ allergies: ['glutine'] });
    expect(valutaRicetta(r, conGlutine).violations).toHaveLength(1);
  });

  /**
   * ⛔ **Otto voci su diciassette non escludevano niente**: `decisioneSolfiti` viene consultata solo
   * se `hitsExclusion` ha già agganciato l'ingrediente, e `exclusions.ts` non le conosceva tutte.
   * Questo test gira su **tutta** la costante passando dal motore, così la lista non può più
   * crescere senza effetto.
   */
  it.each(CAMBIANO_IL_PIATTO)('⛔ «%s» toglie il piatto davvero, non solo nella tabella', (voce) => {
    const { violations } = valutaRicetta(ricetta(`Piatto con ${voce}`, [voce, 'olio evo']), conSolfiti());
    expect(violations).toHaveLength(1);
  });

  /**
   * ⛔ **E lo stesso per i SOSTITUTI**: una riga che il motore non consulta mai è una riga che dice
   * una cosa e non ne fa nessuna. `dado` era esattamente così — c'erano `dado da brodo` e
   * `dado vegetale` in `exclusions.ts`, e le chiavi con lo spazio non hanno radice.
   */
  /**
   * ⚠️ Il nome del piatto è **neutro** di proposito: se ci finisse dentro la parola chiave
   * scatterebbe la regola del nome (le «pere al vino rosso»), e questo test misurerebbe quella
   * invece della riga della tabella.
   */
  it.each([...Object.keys(SOSTITUTI_SENZA_SOLFITI), ...SI_TOLGONO_E_BASTA])(
    '⚠️ «%s» arriva davvero a una sostituzione',
    (chiave) => {
      const { violations, subs } = valutaRicetta(ricetta('Piatto del giorno', [chiave, 'olio evo']), conSolfiti());
      expect(violations).toEqual([]);
      expect(subs).toHaveLength(1);
    },
  );

  it('⛔ «dado granulare» e «brodo di dado» passavano intatti: adesso no', () => {
    for (const ing of ['dado granulare', 'brodo di dado', 'dado di carne']) {
      const { subs } = valutaRicetta(ricetta('Minestrone', [ing, 'verdure']), conSolfiti());
      expect(subs).toHaveLength(1);
    }
  });

  it('⚠️ ma «dadolata di verdure» non è un dado da brodo', () => {
    const { violations, subs } = valutaRicetta(ricetta('Zuppa', ['dadolata di verdure']), conSolfiti());
    expect(violations).toEqual([]);
    expect(subs).toEqual([]);
  });

  /**
   * ⛔ **I SINGOLARI.** Le chiavi di più parole non hanno radice, quindi il salvagente che prende
   * «mandorla» da «mandorle» qui non esiste: «albicocca secca» passava intatta, sulla categoria col
   * limite più alto della tabella (2000 mg/kg).
   */
  it.each(['albicocca secca', 'prugna secca', 'fico secco', 'pomodoro secco', 'fungo secco'])(
    '⛔ «%s» al singolare non passa più intatta', (ing) => {
      const { violations, subs } = valutaRicetta(ricetta('Piatto', [ing, 'olio evo']), conSolfiti());
      expect(violations.length + subs.length).toBeGreaterThan(0);
    });

  /**
   * ⛔ **GLI ALIAS.** `exclusions.ts` dichiara `sulphites` e `sulfites` perché è così che arrivano
   * dagli import. La prima stesura cercava la radice a mano: per quelle clienti le esclusioni si
   * espandevano lo stesso — l'insalata spariva — e la sostituzione non arrivava mai.
   */
  it.each([['sulphites'], ['sulfites'], ['Solfiti']])('⛔ «%s» accende la regola come «solfiti»', (dichiarato) => {
    const e = esclusioniDi({ allergies: [dichiarato] });
    const { violations, subs } = valutaRicetta(ricetta('Insalata', ['lattuga', 'aceto balsamico']), e);
    expect(violations).toEqual([]);
    expect(subs).toHaveLength(1);
  });

  it('⚠️ e i solfiti scritti nel campo sbagliato (fra le intolleranze) valgono lo stesso', () => {
    const e = esclusioniDi({ intolerances: ['solfiti'] });
    expect(valutaRicetta(ricetta('Insalata', ['lattuga', 'aceto balsamico']), e).subs).toHaveLength(1);
  });

  /**
   * ⛔ **LE CHIAVI LUNGHE VINCONO, e adesso c'è un caso che lo prova.** «aceto di vino» combacia con
   * **due** chiavi — `aceto` (→ limone) e `vino` (→ brodo vegetale). Deve vincere l'aceto: un'insalata
   * col brodo vegetale al posto dell'aceto è un piatto che nessuno mangia.
   */
  it('⛔ «aceto di vino» prende il limone, non il brodo', () => {
    expect(decisioneSolfiti('aceto di vino')).toEqual({ azione: 'sostituisci', con: 'succo di limone fresco' });
  });

  /**
   * ⛔ **L'ORDINE fra la regola dei solfiti e quella del lattosio**, che era invertibile senza
   * rompere niente. L'allergia viene prima dell'intolleranza: su «aceto» la mappa del lattosio non ha
   * niente, e il piatto sparirebbe.
   */
  it('⛔ chi ha solfiti E lattosio: l\'aceto passa dalla regola dei solfiti', () => {
    const e = esclusioniDi({ allergies: ['solfiti'], intolerances: ['lactose'] });
    const { violations, subs } = valutaRicetta(ricetta('Insalata', ['lattuga', 'aceto balsamico']), e);
    expect(violations).toEqual([]);
    expect(subs).toEqual([expect.objectContaining({ to: 'succo di limone fresco' })]);
  });

  it('⚠️ e il latte resta il latte: la regola dei solfiti non ha niente da dire su di lui', () => {
    const e = esclusioniDi({ allergies: ['solfiti'], intolerances: ['lactose'] });
    const { subs } = valutaRicetta(ricetta('Latte e caffè', ['latte', 'caffè']), e);
    expect(subs).toEqual([expect.objectContaining({ to: 'latte senza lattosio' })]);
  });

  /** ⚠️ La guardia sui «non graditi»: un gusto non è un'allergia, e non passa da questa regola. */
  it('⚠️ un alimento «non gradito» non entra nella regola dei solfiti', () => {
    const e = esclusioniDi({ allergies: [], dislikedFoods: ['aceto'] });
    const { violations } = valutaRicetta(ricetta('Insalata', ['lattuga', 'aceto balsamico']), e);
    expect(violations).toEqual([]);
  });
});

/**
 * ⛔ **IL DIZIONARIO DEI SUGGERIMENTI: 31 parole nuove e NESSUN test.** La mutazione che lo riportava
 * alle quattro parole di prima lasciava verdi tutti e 5039 i test. Era il cuore della decisione 1.
 */
describe('il dizionario che suggerisce il tag ai nutrizionisti', () => {
  const suggeriti = (ingredienti: string[]) =>
    suggestAllergens(ingredienti.map((name) => ({ name }))).map((s) => s.allergen);

  it.each([['uvetta'], ['gamberi'], ['dado da brodo'], ['aceto balsamico'], ['pomodori secchi'], ['salsiccia']])(
    '⛔ «%s» adesso propone i solfiti (prima non proponeva niente)', (ing) => {
      expect(suggeriti([ing])).toContain('solfiti');
    });

  /**
   * ⛔ **«bovino» contiene «vino»**, ed è il falso positivo di riferimento che `exclusions.ts`
   * documenta da giorni. Questa strada lo ignorava — e siccome i tag suggeriti vengono **scritti**
   * sulle ricette generate, non era «una proposta di troppo»: era ogni piatto di bovino tolto dal
   * catalogo di chi dichiara i solfiti.
   */
  it.each([['straccetti di bovino'], ['bovino magro a fette'], ['carne bovina']])(
    '⛔ «%s» NON propone i solfiti', (ing) => {
      expect(suggeriti([ing])).not.toContain('solfiti');
    });

  it('⚠️ e un piatto senza portatori non propone niente', () => {
    expect(suggeriti(['petto di pollo', 'zucchine', 'olio evo'])).toEqual([]);
  });
});
