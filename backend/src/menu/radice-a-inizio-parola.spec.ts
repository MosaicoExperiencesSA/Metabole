/**
 * LA RADICE VALE SOLO A INIZIO DI PAROLA — 20/8 sera.
 *
 * ## Da dove viene, e non da un ragionamento
 *
 * La mattina del 20/8 avevo aggiunto la ricerca per **radice** alle esclusioni: «mandorle» deve
 * scattare anche su «mandorla». Sulle 118 ricette del catalogo del repo le righe in più erano
 * quattro, tutte vere: zero falsi positivi. Poi Simone ha lanciato `npm run diag:esclusioni` sul
 * catalogo di **produzione**, e sulla sola «frutta secca» la radice toglieva **721 ricette in più**.
 * A leggerle, la stessa cosa decine di volte:
 *
 *     ⚠️  Filetto di sgombro fresco al forno con limone e olive   ← radice nocciol
 *
 * Uno sgombro con le olive tolto a chi è allergico alle nocciole. La colpevole è **«olive
 * denocciolate»**, che contiene `nocciol`.
 *
 * ⛔ **E la nota che avevo scritto io indicava la leva sbagliata**: «se toglie roba che non c'entra,
 * alza `RADICE_MINIMA`». `nocciol` è già sette caratteri: alzare la soglia spegnerebbe la radice
 * proprio sulle nocciole, cioè butterebbe via tutti i casi veri per cui esiste. Avevo in mente
 * `polp`/`polpette`, dove il problema era davvero la lunghezza, e ho scambiato quel caso per la
 * regola.
 *
 * ⚠️ Il difetto non è **quanto è lunga** la radice: è **dove** combacia.
 *
 * ## Cosa NON è successo, e va detto
 *
 * Non è mai arrivato in tavola un allergene. La radice **toglie** piatti, non ne lascia passare uno
 * sbagliato: l'errore era per eccesso. Ma a una cliente allergica alla frutta secca spariva ogni
 * piatto con le olive, e un pool che si svuota così è un piano che non si riesce più a comporre.
 */
import { coppiaGiaDecisa, hitsExclusion, iniziaUnaParola, PAROLE_CHE_NON_SONO, radiceChiave, RADICE_MINIMA } from './exclusions';

describe('il caso vero, quello che ha fatto scattare tutto', () => {
  it('⛔ «olive denocciolate» NON è frutta secca', () => {
    expect(hitsExclusion('filetto di sgombro al forno con limone e olive denocciolate', ['nocciole'])).toBeNull();
  });

  it('✅ ma «crema di nocciola» sì: la radice serve ancora, ed è il motivo per cui non l\'ho tolta', () => {
    expect(hitsExclusion('toast con crema di nocciola e kiwi', ['nocciole'])).toBe('nocciole');
  });

  it('e le altre forme continuano a scattare', () => {
    expect(hitsExclusion('proteine di pisello', ['piselli'])).toBe('piselli');
    expect(hitsExclusion('gamberoni al vapore', ['gamberi'])).toBe('gamberi');
    expect(hitsExclusion('latte di mandorla con avena', ['mandorle'])).toBe('mandorle');
  });
});

describe('la lunghezza minima serve ancora: è un\'altra domanda', () => {
  /**
   * ⚠️ Le due regole non si sostituiscono. «polpette» comincia con `polp` — a inizio di parola
   * eccome — quindi il confine di parola da solo non salverebbe le polpette da chi è allergico ai
   * molluschi. È `RADICE_MINIMA` che le salva, e va tenuta.
   */
  it('«polpo» non produce una radice: sarebbe `polp`, e `polp` comincia «polpette»', () => {
    expect(radiceChiave('polpo')).toBeNull();
    expect(iniziaUnaParola('polpette di carne al sugo', 'polp')).toBe(true);
    expect(hitsExclusion('polpette di carne al sugo', ['polpo'])).toBeNull();
  });

  it('mentre il polpo vero si prende con la chiave esatta', () => {
    expect(hitsExclusion('insalata di polpo e patate', ['polpo'])).toBe('polpo');
  });

  it('la soglia è sei caratteri', () => {
    expect(RADICE_MINIMA).toBe(6);
    expect(radiceChiave('nocciole')).toBe('nocciol');
  });
});

describe('iniziaUnaParola', () => {
  it('a inizio testo', () => expect(iniziaUnaParola('mandorla tostata', 'mandorl')).toBe(true));
  it('dopo uno spazio', () => expect(iniziaUnaParola('latte di mandorla', 'mandorl')).toBe(true));
  it('dopo un trattino o una virgola: sono confini di parola', () => {
    expect(iniziaUnaParola('crema-mandorla', 'mandorl')).toBe(true);
    expect(iniziaUnaParola('pane,mandorla', 'mandorl')).toBe(true);
  });
  it('⛔ non in mezzo a una parola', () => expect(iniziaUnaParola('denocciolate', 'nocciol')).toBe(false));
  it('⚠️ e se compare in tutti e due i modi, vale quella buona', () => {
    expect(iniziaUnaParola('olive denocciolate e granella di nocciola', 'nocciol')).toBe(true);
  });
  it('se non c\'è, non c\'è', () => expect(iniziaUnaParola('zucchine grigliate', 'nocciol')).toBe(false));
});

describe('⚠️ la chiave INTERA non è stata toccata', () => {
  /**
   * Il giro della chiave esatta cerca ancora `haystack.includes(k)` come da mesi. Se anche lì una
   * chiave stesse dentro una parola più lunga — «uovo» dentro «nuovo» è il candidato — sarebbe un
   * difetto più vecchio di questo, e il conto «in più» della diagnostica non l'avrebbe mai mostrato
   * perché misura solo quello che la radice aggiunge. `npm run diag:esclusioni` adesso lo conta a
   * parte. Correggerlo insieme a questo sarebbe stato un colpo di mano dentro una correzione.
   */
  it('resta il comportamento di prima, e questo test lo dice invece di lasciarlo implicito', () => {
    expect(hitsExclusion('un piatto nuovo di zecca', ['uovo'])).toBe('uovo');
  });
});

/**
 * «VINO» DENTRO «BOVINO» — 20/8 sera, corretto invece che chiesto.
 *
 * `npm run diag:esclusioni` ha contato 212 casi in cui la chiave **intera** combacia dentro una
 * parola più lunga. Avevo aperto una voce in elenco per farlo decidere a Simone; era sbagliato
 * aprirla — «bovino» è una parola, non una decisione di prodotto.
 *
 * ⚠️ E resta vero che qui il confine di parola NON è la correzione: «aceto» dentro «sottaceto» è
 * giusto, e un confine lo toglierebbe. Per questo la correzione è una **lista corta** di parole
 * omonime, non una regola — e ogni riga di quella lista **toglie** un'esclusione, quindi si scrive
 * solo dopo aver letto la parola in un esito vero.
 */
describe('le parole che contengono una chiave senza esserla', () => {
  it('⛔ «bovino» non è «vino»', () => {
    expect(hitsExclusion('stracetti di bovino magro al pepe con orzo perlato', ['vino'])).toBeNull();
  });

  it('e nemmeno «bovina», «bovini», «bovine»', () => {
    for (const t of ['carne bovina', 'allevamenti bovini', 'razze bovine']) {
      expect(hitsExclusion(t, ['vino'])).toBeNull();
    }
  });

  it('✅ ma il vino vero continua a scattare', () => {
    expect(hitsExclusion('risotto al vino bianco', ['vino'])).toBe('vino');
  });

  it('⚠️ e se ci sono tutti e due, vince il vino: una riga di questa lista non deve mai NASCONDERE un\'esclusione vera', () => {
    expect(hitsExclusion('bovino magro sfumato al vino rosso', ['vino'])).toBe('vino');
  });

  it('⚠️ «sottaceto» resta escluso: l\'aceto ce l\'ha davvero, e qui il confine di parola toglierebbe protezione', () => {
    expect(hitsExclusion('orata in carpaccio con verdure sottaceto', ['aceto'])).toBe('aceto');
  });

  it('una chiave senza omonime dichiarate si comporta come sempre', () => {
    expect(hitsExclusion('pane integrale tostato', ['pane'])).toBe('pane');
  });
});

/**
 * ⛔ **QUELLO CHE È GIÀ DECISO NON TORNA NELL'ELENCO DA LEGGERE** — 25/8, dalla revisione
 * avversariale.
 *
 * `npm run diag:esclusioni` elenca le chiavi che combaciano **dentro** una parola più lunga, perché
 * una persona le legga una per una. ⛔ Ma quel conto era **grezzo** e non guardava le due liste che
 * il motore usa davvero: «vino» dentro «bovino» — chiusa il 20/8 — sarebbe tornata in cima
 * all'elenco, e chi la legge l'avrebbe aggiunta a una lista dove c'è già. *Un elenco di lavoro che
 * contiene lavoro già fatto è un elenco che si smette di leggere.*
 *
 * ⚠️ Questi test non provano la diagnostica: provano **la funzione che risponde alla domanda**, che
 * sta accanto alle due liste apposta — se domani qualcuno aggiunge una parola, la diagnostica smette
 * di riproporla senza che nessuno se ne ricordi.
 */
describe('⛔ coppiaGiaDecisa — cosa è già stato deciso, e non si richiede', () => {
  it('⛔ «vino» dentro «bovino» è chiusa dal 20/8: non si richiede', () => {
    expect(coppiaGiaDecisa('vino', 'bovino')).toBe(true);
    expect(coppiaGiaDecisa('vino', 'bovine')).toBe(true);
  });

  /**
   * ⚠️ Le famiglie **aperte** le chiude la regola «solo a inizio di parola», non un elenco: per
   * quelle chiavi **qualunque** parola più lunga è già decisa, comprese quelle che nessuno ha mai
   * scritto — che è tutto il punto di `SOLO_A_INIZIO_PAROLA`.
   */
  it('⛔ «orata» dentro una parola qualsiasi è già decisa dalla regola, anche su parole mai viste', () => {
    for (const parola of ['insaporata', 'decorata', 'ristorata', 'sproporzionata']) {
      expect(coppiaGiaDecisa('orata', parola)).toBe(true);
    }
  });

  /**
   * ⛔ **E «sottaceto» NON è decisa nel senso di «scartata»**: è decisa nel senso opposto — l'aceto
   * nel sottaceto c'è davvero. Qui la funzione deve dire **no**, cioè «questa resta da leggere»,
   * perché finché nessuno la dichiara il motore continua giustamente a escluderla.
   */
  it('⚠️ «aceto» dentro «sottaceto» resta da leggere: nessuna delle due liste la nomina', () => {
    expect(coppiaGiaDecisa('aceto', 'sottaceto')).toBe(false);
  });

  it('una parola che non c\'è in nessuna delle due liste resta da leggere', () => {
    expect(coppiaGiaDecisa('uovo', 'nuovo')).toBe(false);
    expect(coppiaGiaDecisa('vino', 'vinoso')).toBe(false);
  });
});
