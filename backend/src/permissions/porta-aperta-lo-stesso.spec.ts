/**
 * ⛔ **LA PAGINA PERMESSI DEVE DIRE QUANDO «SPENTO» NON VUOL DIRE CHIUSO.**
 *
 * Due porte che la matrice non nomina: l'**hub** (`PAGE_GRANTS`: «Gestione dieta» concede
 * `diets_catalog` e `recipes`) e l'**eredità** (`INHERIT_DEFAULTS`: una figlia senza riga vale la
 * riga del genitore). Tutte e due sono volute. Quello che non è voluto è che la schermata mostri
 * «spento» dove il guardiano risponde «sì».
 *
 * ⚠️ Queste prove non cambiano nessun permesso: verificano che la spiegazione **coincida** con la
 * regola del guardiano. Se un giorno il guardiano cambia e questo modulo no, la pagina comincerebbe
 * a mentire in silenzio — e mentire con precisione è peggio che tacere.
 */
import { celleApertePurEssendoSpente, hubCheConcedono, permessoDavvero } from './porta-aperta-lo-stesso';
import type { Permesso } from './eredita-dal-genitore';
import { INHERIT_DEFAULTS, NON_EREDITANO, PAGE_GRANTS } from './pages';

const ACCESO: Permesso = { canView: true, canManage: true };
const SPENTO: Permesso = { canView: false, canManage: false };
const SOLO_VISTA: Permesso = { canView: true, canManage: false };

/** Il mondo di prova: le chiavi vere del progetto, le righe scritte a mano. */
const mondo = (righe: Record<string, Permesso>, difetti: Record<string, Permesso> = {}) => ({
  genitoreDi: INHERIT_DEFAULTS as Readonly<Record<string, string>>,
  concessioni: PAGE_GRANTS as Readonly<Record<string, readonly string[]>>,
  nonEreditano: NON_EREDITANO,
  rigaDi: (k: string) => righe[k] ?? null,
  defaultDi: (k: string) => difetti[k] ?? null,
});

describe('hubCheConcedono — il rovescio di PAGE_GRANTS', () => {
  it('⛔ «Ricette» è concessa da Gestione dieta e da Creazione e validazione', () => {
    /** ⚠️ Senza `.sort()`: l'ordine deve essere STABILE, o due caricamenti nominerebbero due hub
     *  diversi per la stessa cella. Ordinare qui misurerebbe proprio la cosa da non perdere. */
    expect(hubCheConcedono('recipes', PAGE_GRANTS)).toEqual(['diet_workspace', 'creation_validation']);
    expect(hubCheConcedono('recipes', PAGE_GRANTS)).toEqual(hubCheConcedono('recipes', PAGE_GRANTS));
  });

  it('⚠️ una pagina che nessun hub concede non ne ha', () => {
    expect(hubCheConcedono('accounting', PAGE_GRANTS)).toEqual([]);
  });

  /** ⚠️ La tabella vera deve avere davvero degli hub: a `PAGE_GRANTS` vuoto tutto il resto sarebbe verde sul nulla. */
  it('⛔ e la tabella vera non è vuota', () => {
    expect(Object.keys(PAGE_GRANTS).length).toBeGreaterThan(0);
  });
});

describe('permessoDavvero — la stessa risposta del guardiano', () => {
  /** ⛔ IL CASO DELLA VOCE: `recipes` spenta a mano, `diet_workspace` acceso. */
  it('⛔ «Ricette» spenta resta aperta se il ruolo ha Gestione dieta', () => {
    const e = permessoDavvero('recipes', mondo({ recipes: SPENTO, diet_workspace: ACCESO }));
    expect(e.view).toBe(true);
    expect(e.manage).toBe(true);
    expect(e.viaView).toEqual({ provenienza: 'hub', chiave: 'diet_workspace' });
  });

  /**
   * ⛔ **Livello per livello, come fa il guardiano.** Un hub in sola vista non deve far dire alla
   * pagina che quel ruolo può *modificare* le ricette.
   */
  it('⛔ un hub in sola vista apre «vede» e NON «gestisce»', () => {
    const e = permessoDavvero('recipes', mondo({ recipes: SPENTO, diet_workspace: SOLO_VISTA }));
    expect(e.view).toBe(true);
    expect(e.manage).toBe(false);
    expect(e.viaView.provenienza).toBe('hub');
    expect(e.viaManage.provenienza).not.toBe('hub');
  });

  it('⚠️ spenti tutti e due, resta spenta: l\'hub non inventa niente', () => {
    const e = permessoDavvero('recipes', mondo({ recipes: SPENTO, diet_workspace: SPENTO, creation_validation: SPENTO }));
    expect(e.view).toBe(false);
    expect(e.manage).toBe(false);
  });

  it('⛔ e la riga propria ACCESA non viene attribuita a un hub', () => {
    const e = permessoDavvero('recipes', mondo({ recipes: ACCESO, diet_workspace: ACCESO }));
    expect(e.viaView).toEqual({ provenienza: 'riga propria' });
  });

  /** ⛔ Il secondo verso, quello più frequente: la figlia senza riga vale la riga del genitore. */
  it('⛔ una figlia senza riga vale la RIGA del genitore, non il suo default', () => {
    const e = permessoDavvero('allergens', mondo({ recipes: ACCESO }, { allergens: SPENTO }));
    expect(e.view).toBe(true);
    expect(e.viaView).toEqual({ provenienza: 'riga del genitore', chiave: 'recipes' });
  });
});

describe('permessoDavvero — le due opzioni che lo rendono uguale al guardiano', () => {
  /**
   * ⛔ **`nonEreditano`: una figlia che è anche hub NON eredita.** Senza questa opzione
   * `diet_workspace` (figlia di `diets_catalog`, e hub che concede `recipes`) erediterebbe la riga
   * del genitore, e aprirebbe una porta che il genitore non apre. Una mutazione che toglieva
   * l'opzione **sopravviveva** a tutte le prove: adesso no.
   */
  it('⛔ `diet_workspace` NON eredita da `diets_catalog`: è un hub', () => {
    const e = permessoDavvero('diet_workspace', mondo({ diets_catalog: ACCESO }));
    expect(e.view).toBe(false);
    expect(e.viaView.provenienza).toBe('default');
  });

  /**
   * ⛔ **`defaultEsplicitoDi`: il default scritto a mano della FIGLIA batte l'eredità.** L'unico
   * motivo per scriverne uno è renderlo più stretto del genitore, e senza l'opzione quella scelta
   * verrebbe ignorata in silenzio. Anche questa mutazione sopravviveva.
   */
  it('⛔ il default esplicito della figlia vince sulla riga del genitore', () => {
    const ing = { ...mondo({ recipes: ACCESO }), defaultEsplicitoDi: (k: string) => (k === 'allergens' ? SPENTO : null) };
    const e = permessoDavvero('allergens', ing);
    expect(e.view).toBe(false);
    expect(e.viaView.provenienza).toBe('default');
  });

  /**
   * ⛔ **Il ruolo non è un'etichetta: entra nella risposta.** Una mutazione che sostituiva il ruolo
   * con una costante non faceva fallire niente, perché il `mondo` di prova rendeva le stesse righe
   * a chiunque. Qui le righe dipendono dal ruolo, come in banca dati.
   */
  it('⛔ ruoli diversi ricevono risposte diverse', () => {
    const perRuolo: Record<string, Record<string, Permesso>> = {
      nutritionist: { recipes: ACCESO },
      sales: { recipes: SPENTO },
    };
    const ing = (r: string) => ({ ...mondo({}), rigaDi: (k: string) => perRuolo[r]?.[k] ?? null });
    expect(permessoDavvero('recipes', ing('nutritionist')).view).toBe(true);
    expect(permessoDavvero('recipes', ing('sales')).view).toBe(false);
  });
});

describe('celleApertePurEssendoSpente — solo le celle che mentono', () => {
  const pagine = ['recipes', 'allergens', 'accounting', 'diet_workspace'];

  it('⛔ elenca «Ricette» spenta ma tenuta aperta dall\'hub, su tutti e due i livelli', () => {
    const { celle } = celleApertePurEssendoSpente('nutritionist', pagine,
      mondo({ recipes: SPENTO, diet_workspace: ACCESO, allergens: SPENTO, accounting: SPENTO }));
    expect(celle.filter((c) => c.pageKey === 'recipes').map((c) => c.livello).sort())
      .toEqual(['manage', 'view']);
    expect(celle.find((c) => c.pageKey === 'recipes')?.chiave).toBe('diet_workspace');
  });

  /**
   * ⛔ **La cella senza riga si disegna spenta.** Qui la figlia eredita la RIGA del genitore, che è
   * una porta su cui si può agire: si segnala.
   */
  it('⛔ e la figlia SENZA riga, che la tabella disegna spenta', () => {
    const { celle } = celleApertePurEssendoSpente('nutritionist', ['allergens'], mondo({ recipes: ACCESO }));
    expect(celle).toHaveLength(2);
    expect(celle[0]).toMatchObject({ pageKey: 'allergens', provenienza: 'riga del genitore', chiave: 'recipes' });
  });

  /**
   * ⚠️ **Un avviso su ogni riga non è un avviso.** Le celle accese, e quelle spente davvero, non
   * compaiono: se comparissero, la pagina segnerebbe tutto e non si guarderebbe più niente.
   */
  it('⚠️ le celle accese e quelle chiuse davvero NON compaiono', () => {
    const { celle } = celleApertePurEssendoSpente('nutritionist', pagine,
      mondo({ recipes: ACCESO, diet_workspace: ACCESO, allergens: ACCESO, accounting: SPENTO }));
    expect(celle.map((c) => c.pageKey)).not.toContain('accounting');
    expect(celle.map((c) => c.pageKey)).not.toContain('recipes');
  });

  /**
   * ⛔ **E le righe MAI CREATE si contano, non si segnalano.** Misurate in revisione: 52 badge per
   * la nutrizionista se `syncDefaults` è andato storto all'avvio — che vuol dire nessun badge
   * leggibile. E lì non c'è nessun permesso su cui agire: il valore sta nel codice.
   */
  it('⛔ le caselle aperte solo dal default si CONTANO, e non finiscono in tabella', () => {
    const r = celleApertePurEssendoSpente('nutritionist', ['accounting', 'shop'],
      { ...mondo({}), defaultDi: () => ACCESO });
    expect(r.celle).toEqual([]);
    expect(r.senzaRiga).toBe(4); // due pagine × due livelli
  });

  /**
   * ⛔ **IL CASO DEL RUOLO PERSONALIZZATO — quello su cui la pagina garantiva silenzio.**
   *
   * Il guardiano cerca la riga con il ruolo di **base**: spegnere «Ricette» a «Nutrizionista
   * junior» toglie la voce di menu e **non** chiude le API. Prima di questa revisione la colonna di
   * un ruolo personalizzato non produceva **nessun** avviso: taceva in modo credibile.
   */
  it('⛔ un ruolo personalizzato: la casella spenta non chiude, perché il guardiano legge il ruolo di base', () => {
    const { celle } = celleApertePurEssendoSpente('nutritionist_junior', ['recipes'], {
      ...mondo({ recipes: ACCESO }),                 // la riga che il guardiano legge (base)
      ruoloDelGuardiano: 'nutritionist',
      rigaMostrata: () => SPENTO,                    // la casella che si vede nella colonna
    });
    expect(celle).toHaveLength(2);
    expect(celle[0]).toMatchObject({ role: 'nutritionist_junior', provenienza: 'ruolo di base', ruolo: 'nutritionist' });
  });

  it('⚠️ e se anche il ruolo di base è spento, non c\'è niente da segnalare', () => {
    const { celle } = celleApertePurEssendoSpente('nutritionist_junior', ['recipes'], {
      ...mondo({ recipes: SPENTO, diet_workspace: SPENTO, creation_validation: SPENTO }),
      ruoloDelGuardiano: 'nutritionist',
      rigaMostrata: () => SPENTO,
    });
    expect(celle).toEqual([]);
  });

  /**
   * ⚠️ Una prova che a funzione svuotata (`return { celle: [], senzaRiga: 0 }`) resterebbe verde
   * non misura niente: questa pretende che con QUALCOSA di aperto esca qualcosa.
   */
  it('⚠️ e un ruolo senza niente acceso non produce nessun avviso', () => {
    const r = celleApertePurEssendoSpente('sales', pagine, { ...mondo({}), defaultDi: () => SPENTO });
    expect(r.celle).toEqual([]);
    expect(r.senzaRiga).toBe(0);
    // ⛔ la controprova, nello stesso posto: se non uscisse mai niente, la riga sopra sarebbe vuota.
    expect(celleApertePurEssendoSpente('sales', pagine,
      { ...mondo({ recipes: SPENTO, diet_workspace: ACCESO }) }).celle.length).toBeGreaterThan(0);
  });
});
