/**
 * QUELLO CHE LA CLIENTE SCRIVE, E QUELLO CHE NOI CAPIAMO.
 *
 * Qui non si verifica che le frasi di Gaia siano gentili: si verifica il pezzo che può far finire
 * in banca dati un'allergia che nessuno ha dichiarato, o — molto peggio — far mancare quella che
 * ha dichiarato. Le cose che si sbagliano in silenzio sono quattro:
 *
 *  1. **una parola non riconosciuta si comporta come un'allergia che non c'è** (è la lezione di
 *     `frutta_a_guscio` e del burro proposto l'8/8): qui deve finire nel testo libero, non sparire;
 *  2. **le false amiche** — «latte di mandorla» non è latte, «noce moscata» non è frutta a guscio;
 *  3. **«no»** è «non ne ho» quando è tutta la frase, ed è una correzione quando è seguito da un
 *     alimento. Confonderli cancella un'allergia;
 *  4. **lo spazio in fondo a `'pan '`**: senza, «panna» diventa glutine.
 */
import {
  elencoAParole,
  leggiAllergie,
  leggiConferma,
  testoConferma,
  testoDomanda,
  testoFatto,
  testoNonCapito,
  testoToglieQualcosa,
} from './allergie-chat';

describe('quello che ha scritto, tradotto in codici', () => {
  it('il nome dell allergene, così com è nel questionario', () => {
    expect(leggiAllergie('sono allergica al latte').codici).toEqual(['latte']);
    expect(leggiAllergie('crostacei').codici).toEqual(['crostacei']);
  });

  it('⚠️ «i latticini»: la parola del parlato, non quella del catalogo', () => {
    expect(leggiAllergie('i latticini').codici).toEqual(['latte']);
    expect(leggiAllergie('il lattosio').codici).toEqual(['latte']);
  });

  it('⚠️ «la frutta secca ma solo le noci»: la frase dell handoff, parola per parola', () => {
    const l = leggiAllergie('la frutta secca ma solo le noci');
    expect(l.codici).toEqual(['frutta_a_guscio']);
    // «noci» è già dentro `frutta_a_guscio`: non deve comparire ANCHE come testo libero da far
    // codificare a mano, o la nutrizionista si ritrova una coda di lavoro che è già fatta.
    expect(l.libere).toEqual([]);
  });

  it('più allergie in una frase sola', () => {
    const l = leggiAllergie('latte e uova, e anche i crostacei');
    expect(l.codici.sort()).toEqual(['crostacei', 'latte', 'uova']);
  });

  it('«frutti di mare» sono crostacei E molluschi: proporne uno solo lascia fuori l altra metà', () => {
    expect(leggiAllergie('i frutti di mare').codici.sort()).toEqual(['crostacei', 'molluschi']);
  });

  it('un derivato vale l allergene: chi dice «burro» sta dicendo latte', () => {
    expect(leggiAllergie('non posso mangiare il burro').codici).toEqual(['latte']);
  });

  it('celiachia è glutine, e nessuna ricetta scriverebbe mai quella parola', () => {
    expect(leggiAllergie('sono celiaca').codici).toEqual(['glutine']);
  });
});

describe('⚠️ le false amiche', () => {
  it('«latte di mandorla» non è latte — ed è mandorla', () => {
    const l = leggiAllergie('il latte di mandorla');
    expect(l.codici).toEqual(['frutta_a_guscio']);
  });

  it('«noce moscata» è una spezia', () => {
    const l = leggiAllergie('la noce moscata');
    expect(l.codici).toEqual([]);
  });

  it('«burro di arachidi» non è burro', () => {
    expect(leggiAllergie('il burro di arachidi').codici).toEqual(['arachidi']);
  });

  it('⚠️ «panna» resta latte e NON diventa glutine: è lo spazio in fondo a «pan »', () => {
    expect(leggiAllergie('la panna').codici).toEqual(['latte']);
  });

  it('e «pane» il glutine lo fa scattare lo stesso', () => {
    expect(leggiAllergie('il pane').codici).toEqual(['glutine']);
  });
});

describe('⚠️ quello che non sappiamo tradurre non si indovina', () => {
  it('finisce nel testo libero, dove lo vede la nutrizionista', () => {
    const l = leggiAllergie('sono allergica alle fragole');
    expect(l.codici).toEqual([]);
    expect(l.libere).toEqual(['fragole']);
    expect(l.vuota).toBe(false);
  });

  it('metà riconosciuto e metà no: si tiene tutto e due, ognuno al suo posto', () => {
    const l = leggiAllergie('il latte e le fragole');
    expect(l.codici).toEqual(['latte']);
    expect(l.libere).toEqual(['fragole']);
  });

  it('⚠️ il rumore del parlato non diventa un alimento da far codificare', () => {
    const l = leggiAllergie('mah non lo so forse');
    expect(l.libere).toEqual([]);
    expect(l.vuota).toBe(true);
  });

  it('⚠️ «boh» è un alimento che non esiste: è vuota, e si richiede', () => {
    const l = leggiAllergie('boh');
    expect(l.vuota).toBe(true);
    expect(l.nessuna).toBe(false);
  });
});

describe('⚠️ «non ne ho» contro «no, le noci»', () => {
  it('«nessuna» è una risposta, e vale come tale', () => {
    expect(leggiAllergie('nessuna').nessuna).toBe(true);
    expect(leggiAllergie('non ho allergie').nessuna).toBe(true);
    expect(leggiAllergie('no').nessuna).toBe(true);
  });

  it('⚠️ «no, le noci» NON è «non ne ho»: è una correzione, e cancellerebbe un allergia', () => {
    const l = leggiAllergie('no, le noci');
    expect(l.nessuna).toBe(false);
    expect(l.codici).toEqual(['frutta_a_guscio']);
  });

  it('vuota non è «nessuna»: «non ho capito» e «non ne ho» sono due cose diverse', () => {
    expect(leggiAllergie('').vuota).toBe(true);
    expect(leggiAllergie('').nessuna).toBe(false);
  });
});

describe('sì e no alla proposta', () => {
  it('le forme che si usano davvero', () => {
    expect(leggiConferma('sì')).toBe(true);
    expect(leggiConferma('si esatto')).toBe(true);
    expect(leggiConferma('confermo')).toBe(true);
    expect(leggiConferma('no')).toBe(false);
    expect(leggiConferma('non è così')).toBe(false);
  });

  it('quello che non è né sì né no si riconosce come tale, e non si sceglie a caso', () => {
    expect(leggiConferma('mah')).toBeNull();
    expect(leggiConferma('anche le noci')).toBeNull();
  });
});

describe('le frasi di Gaia', () => {
  it('⚠️ alla prima popolazione si dice che il campo NON C ERA: non è stata una distrazione sua', () => {
    const t = testoDomanda('intolleranza_ignota', [], 'Giulia');
    expect(t).toContain('Giulia');
    expect(t).toMatch(/non esisteva ancora|non c'era/i);
  });

  it('alla seconda si rileggono le parole che aveva scritto lei', () => {
    const t = testoDomanda('allergie_da_codificare', ['le fragole'], 'Giulia');
    expect(t).toContain('le fragole');
  });

  it('alla terza si offre «nessuna» come risposta, perché è una risposta', () => {
    expect(testoDomanda('mai_risposto', [], null)).toContain('nessuna');
  });

  it('la proposta rilegge quello che abbiamo capito, in italiano', () => {
    const t = testoConferma('mai_risposto', { nessuna: false, codici: ['latte', 'frutta_a_guscio'], libere: [] }, 'Giulia');
    expect(t.toLowerCase()).toContain('latte e derivati');
    expect(t.toLowerCase()).toContain('frutta a guscio');
    expect(t).toContain('Confermi?');
  });

  it('e dice che il testo libero lo guarda la nutrizionista, invece di prometterne l esclusione', () => {
    const t = testoConferma('mai_risposto', { nessuna: false, codici: [], libere: ['fragole'] }, null);
    expect(t).toContain('fragole');
    expect(t).toContain('nutrizionista');
  });

  it('l ultimo tentativo passa la mano a una persona, e lo dice', () => {
    expect(testoNonCapito(true)).toContain('nutrizionista');
    expect(testoNonCapito(false)).not.toContain('nutrizionista');
  });

  it('⚠️ e togliere un allergia non lo fa Gaia', () => {
    const t = testoToglieQualcosa(['latte'], 'Giulia');
    expect(t.toLowerCase()).toContain('latte e derivati');
    expect(t).toContain('nutrizionista');
  });

  it('il fatto non promette esclusioni su quello che non ha capito', () => {
    const t = testoFatto('mai_risposto', { nessuna: false, codici: ['latte'], libere: ['fragole'] }, 'Giulia');
    expect(t.toLowerCase()).toContain('latte e derivati');
    expect(t).toContain('nutrizionista');
  });
});

describe('elencoAParole', () => {
  it('usa le etichette del catalogo, non i codici', () => {
    expect(elencoAParole(['frutta_a_guscio'])).toBe('frutta a guscio');
    expect(elencoAParole(['latte', 'uova'])).toBe('latte e derivati e uova');
    expect(elencoAParole([])).toBe('');
  });
});
