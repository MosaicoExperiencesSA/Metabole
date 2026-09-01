import {
  diCosaE, eCarne, ePesce, ingredientePrincipale, vaBeneAColazione,
} from './piatto-di-cosa';

/** La tabella alimenti finta: solo quello che serve a distinguere una verdura. */
const CAT: Record<string, string> = {
  'zucchine': 'verdura', 'broccoli': 'verdura', 'spinaci': 'verdura', 'pomodori': 'verdura',
  'insalata mista': 'verdura', 'patate': 'legumi e tuberi',
  'uova': 'proteici', 'ricotta': 'latticini', 'pane integrale': 'cereali', 'avena': 'cereali',
  'mela': 'frutta', 'avocado': 'grassi', 'yogurt greco': 'latticini', 'ceci': 'legumi',
};
const cat = (n: string) => CAT[n.toLowerCase()] ?? null;
const ing = (...coppie: [string, number | null][]) => coppie.map(([name, grammi]) => ({ name, grammi }));

describe('di cosa è questo piatto', () => {
  describe('l\'ingrediente principale', () => {
    it('è quello che pesa di più, non il primo scritto', () => {
      expect(ingredientePrincipale(ing(['spinaci', 40], ['uova', 120]))).toBe('uova');
    });

    it('⚠️ a parità di grammi vince il primo scritto: è l\'unico segnale che resta', () => {
      expect(ingredientePrincipale(ing(['uova', 100], ['zucchine', 100]))).toBe('uova');
    });

    /**
     * ⛔ Senza grammature non si indovina. Rispondere «il primo» qui vorrebbe dire far decidere a
     * chi ha scritto la ricetta in che ordine ha battuto i tasti.
     */
    it.each([[ing(['uova', null], ['zucchine', null])], [ing()], [ing(['uova', 0])], [ing(['', 100])]])(
      '⛔ senza grammature valide (%p) non c\'è nessun principale', (i) => {
        expect(ingredientePrincipale(i)).toBeNull();
      },
    );
  });

  describe('i vocabolari', () => {
    it.each(['petto di pollo', 'bresaola', 'macinato di manzo', 'prosciutto crudo', 'ossobuco di tacchino'])(
      '«%s» è carne', (n) => expect(eCarne(n)).toBe(true),
    );

    it.each(['merluzzo', 'gamberi', 'cozze', 'tonno al naturale', 'baccalà'])(
      '«%s» è pesce', (n) => expect(ePesce(n)).toBe(true),
    );

    /**
     * ⚠️ Le parole che **sembrano** carne e non lo sono: l'elenco è di tagli e animali, non di
     * piatti, e le radici corte sono tenute fuori apposta.
     */
    it.each(['polenta', 'polpa di pomodoro', 'ceci', 'tofu', 'seitan', 'polpettone di lenticchie'])(
      '⛔ «%s» NON è carne', (n) => expect(eCarne(n)).toBe(false),
    );
  });

  describe('il verdetto sul piatto', () => {
    it.each([
      ['Frittata con spinaci', ing(['uova', 120], ['spinaci', 60]), 'altro'],
      ['Yogurt con avena e mela', ing(['yogurt greco', 150], ['avena', 40], ['mela', 100]), 'altro'],
      ['Pane e ricotta con pomodorini', ing(['pane integrale', 80], ['ricotta', 60], ['pomodori', 40]), 'altro'],
      ['Pollo alla piastra con zucchine', ing(['petto di pollo', 150], ['zucchine', 100]), 'carne'],
      ['Tonno con insalata', ing(['tonno al naturale', 120], ['insalata mista', 80]), 'pesce'],
      ['Vellutata di broccoli e patate', ing(['broccoli', 200], ['patate', 100]), 'verdura'],
    ])('«%s» → %s', (_, ingredienti, atteso) => {
      expect(diCosaE(ingredienti, cat)).toBe(atteso);
    });

    /**
     * ⛔ **La prova che dice perché la lettura stretta è stata scartata**: questi sono piatti da
     * colazione normali che contengono una verdura, e devono restare.
     */
    it.each([
      ['Frittata con spinaci', ing(['uova', 120], ['spinaci', 60])],
      ['Pane e pomodorini', ing(['pane integrale', 80], ['pomodori', 50])],
      ['Avocado toast', ing(['pane integrale', 70], ['avocado', 60])],
    ])('⛔ «%s» resta a colazione: la verdura c\'è ma il piatto non è di verdura', (_, i) => {
      expect(vaBeneAColazione(diCosaE(i, cat))).toBe(true);
    });

    /**
     * ⛔ «Non lo so» non è «va bene». Se la tabella alimenti non conosce l'ingrediente principale
     * non sappiamo se è una verdura, e farlo passare vorrebbe dire mettere a colazione un piatto
     * che nessuno ha guardato — su una tabella che oggi ha 373 righe contro 8012 nomi.
     */
    it('⛔ ingrediente principale sconosciuto → non lo so, e NON va bene a colazione', () => {
      const e = diCosaE(ing(['trancio misto', 200], ['pane integrale', 50]), cat);
      expect(e).toBeNull();
      expect(vaBeneAColazione(e)).toBe(false);
    });

    it('⛔ e senza grammature idem: non lo so', () => {
      expect(diCosaE(ing(['uova', null]), cat)).toBeNull();
      expect(vaBeneAColazione(null)).toBe(false);
    });
  });
});
