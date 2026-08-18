/**
 * ⚠️ IL FILE CHE MANCAVA.
 *
 * `menuOrder.ts` decide cosa una persona vede nella barra laterale, e fino al 18/8 non aveva un
 * collaudo: quattro difetti sono stati lì una settimana e sono saltati fuori solo perché qualcuno
 * ha chiesto di spiegare come funziona. I casi qui sotto sono quelli, più i due che reggono la
 * regola che tiene in piedi tutto il resto — una voce nuova non deve sparire a chi si è
 * personalizzato il menu, e una voce tolta non deve rompere la lettura.
 */
import { describe, expect, it } from 'vitest';
import { gruppiEffettivi, iconaDelGruppo, leggiGruppi, orderNavItems, serializzaGruppi, conNascosteAlLoroPosto } from './menuOrder';

const NAV = [
  {
    group: 'CRM',
    icon: 'ti-address-book',
    collapsible: true,
    items: [
      { key: 'crm', to: '/crm', label: 'Gestione lead' },
      { key: 'lead', to: '/lead', label: 'Inserimento lead' },
    ],
  },
  {
    group: 'Percorso cliente',
    icon: 'ti-users',
    items: [
      { key: 'clienti', to: '/clienti', label: 'Clienti' },
      { key: 'agenda', to: '/agenda', label: 'Agenda visite' },
    ],
  },
];

describe('leggiGruppi / serializzaGruppi', () => {
  it('⚠️ due gruppi con lo stesso titolo restano due', () => {
    // Lato server la `puliscoOrdineMenu` non li fonde più; qui si controlla che nemmeno la
    // lettura li unisca — sono due gruppi che una persona ha voluto.
    const gruppi = leggiGruppi(['#gruppot:Vendite', '/crm', '#gruppot:Vendite', '/lead']);
    expect(gruppi).toHaveLength(2);
    expect(gruppi!.map((g) => g.voci)).toEqual([['/crm'], ['/lead']]);
  });

  it('senza marcatori torna null: chi non ha mai toccato i gruppi resta di fabbrica', () => {
    expect(leggiGruppi(['/crm', '/lead'])).toBeNull();
    expect(leggiGruppi([])).toBeNull();
    expect(leggiGruppi(null)).toBeNull();
  });

  it('i tre marcatori dicono tre cose diverse su «a fisarmonica»', () => {
    const g = leggiGruppi(['#gruppoc:A', '/crm', '#gruppot:B', '/lead', '#gruppo:C', '/clienti'])!;
    expect(g.map((x) => x.comprimibile)).toEqual([true, false, undefined]);
  });

  it('⚠️ una rotta prima del primo titolo non si perde: prende un gruppo senza nome', () => {
    const g = leggiGruppi(['/clienti', '#gruppot:CRM', '/crm'])!;
    expect(g[0]).toEqual({ titolo: '', comprimibile: undefined, voci: ['/clienti'] });
  });

  it('scrivere e rileggere torna alla stessa cosa', () => {
    const gruppi = [
      { titolo: 'Vendite', comprimibile: true, voci: ['/crm'] },
      { titolo: 'Vendite', comprimibile: false, voci: ['/lead'] },
    ];
    expect(leggiGruppi(serializzaGruppi(gruppi))).toEqual(gruppi);
  });
});

describe('gruppiEffettivi', () => {
  it('⚠️ una voce nuova in NAV compare nel suo gruppo d\'origine anche a chi ha un ordine salvato', () => {
    // Senza questa regola, il giorno che aggiungiamo una pagina chi si è personalizzato il menu
    // non la vedrebbe mai, e non avrebbe modo di sapere che esiste.
    const out = gruppiEffettivi(NAV, ['#gruppot:Mio', '/crm', '/clienti']);
    const percorso = out.find((g) => g.group === 'Percorso cliente');
    expect(percorso!.items.map((i) => i.to)).toEqual(['/agenda']);
    expect(out[0].items.map((i) => i.to)).toEqual(['/crm', '/clienti']);
  });

  it('una rotta sparita da NAV viene ignorata e non rompe la lettura', () => {
    const out = gruppiEffettivi(NAV, ['#gruppot:Mio', '/pagina-che-non-esiste-piu', '/crm']);
    expect(out[0].items.map((i) => i.to)).toEqual(['/crm']);
  });

  it('quando la preferenza non dice se è a fisarmonica, si eredita da com\'era di fabbrica', () => {
    const out = gruppiEffettivi(NAV, ['#gruppo:CRM', '/crm', '#gruppo:Percorso cliente', '/clienti']);
    expect(out[0].comprimibile).toBe(true);   // CRM è collapsible in NAV
    expect(out[1].comprimibile).toBe(false);
  });
});

describe('iconaDelGruppo', () => {
  it('⚠️ un gruppo rinominato tiene l\'icona delle sue voci', () => {
    // Il difetto 2: l'icona si cercava per titolo, e rinominare «CRM» in «Vendite» la faceva
    // sparire — senza errori, e senza che nessuno collegasse le due cose.
    expect(iconaDelGruppo([{ to: '/crm' }, { to: '/lead' }], NAV)).toBe('ti-address-book');
  });

  it('vince la sezione da cui viene la maggior parte delle voci', () => {
    expect(iconaDelGruppo([{ to: '/crm' }, { to: '/clienti' }, { to: '/agenda' }], NAV)).toBe('ti-users');
  });

  it('⚠️ a parità di voci la scelta è sempre la stessa, non balla fra un caricamento e l\'altro', () => {
    const voci = [{ to: '/crm' }, { to: '/clienti' }];
    expect(iconaDelGruppo(voci, NAV)).toBe('ti-address-book'); // alfabetico: address-book < users
    expect(iconaDelGruppo([...voci].reverse(), NAV)).toBe('ti-address-book');
  });

  it('nessuna voce riconosciuta, o gruppo vuoto: nessuna icona', () => {
    expect(iconaDelGruppo([{ to: '/boh' }], NAV)).toBeUndefined();
    expect(iconaDelGruppo([], NAV)).toBeUndefined();
  });
});

describe('orderNavItems', () => {
  it('senza ordine salvato è alfabetico per etichetta', () => {
    const items = [{ to: '/b', label: 'Zebra' }, { to: '/a', label: 'Anatra' }];
    expect(orderNavItems(items, null).map((i) => i.label)).toEqual(['Anatra', 'Zebra']);
  });

  it('le voci non nominate finiscono in fondo, in ordine alfabetico', () => {
    const items = [{ to: '/a', label: 'Anatra' }, { to: '/b', label: 'Zebra' }, { to: '/c', label: 'Mucca' }];
    expect(orderNavItems(items, ['/b']).map((i) => i.label)).toEqual(['Zebra', 'Anatra', 'Mucca']);
  });
});

/**
 * LE VOCI NASCOSTE RESTANO DOVE LE AVEVA MESSE (difetto 7 del foglio, chiuso il 18/8 sera).
 *
 * Chi non ha un permesso non vede quella riga e non può posizionarla, ma nelle sue preferenze c'è.
 * Prima veniva tenuta — ed era giusto — e riattaccata **in fondo all'ultimo gruppo**: il giorno che
 * il permesso arrivava, la pagina ricompariva in coda al menu invece che al suo posto, e nessuno
 * collegava le due cose.
 */
describe('conNascosteAlLoroPosto', () => {
  it('⚠️ la voce nascosta torna dopo la riga che la precedeva, non in fondo', () => {
    const salvate = ['#gruppo:Clienti', '/clienti', '/pagamenti', '#gruppo:Catalogo', '/ricette'];
    // `/pagamenti` non è visibile a questa persona: la vista non ce l'ha.
    const nuove = ['#gruppo:Clienti', '/clienti', '#gruppo:Catalogo', '/ricette'];
    expect(conNascosteAlLoroPosto(salvate, nuove)).toEqual([
      '#gruppo:Clienti', '/clienti', '/pagamenti', '#gruppo:Catalogo', '/ricette',
    ]);
  });

  it('segue la riga di appoggio quando il gruppo viene riordinato', () => {
    const salvate = ['#gruppo:Clienti', '/clienti', '/pagamenti', '#gruppo:Catalogo', '/ricette'];
    // «Catalogo» passa in cima, e `/clienti` finisce dopo: la nascosta lo segue.
    const nuove = ['#gruppo:Catalogo', '/ricette', '#gruppo:Clienti', '/clienti'];
    expect(conNascosteAlLoroPosto(salvate, nuove)).toEqual([
      '#gruppo:Catalogo', '/ricette', '#gruppo:Clienti', '/clienti', '/pagamenti',
    ]);
  });

  /**
   * ⚠️ L'ancora è preferibilmente una ROTTA e non un titolo: i titoli possono ripetersi (due gruppi
   * «Vendite» sono legittimi da quando i doppioni non si fondono più), e un'ancora ambigua
   * rimetterebbe la voce nel gruppo sbagliato.
   */
  it('⚠️ con due gruppi dallo stesso nome si aggancia alla rotta, non al titolo', () => {
    const salvate = ['#gruppo:Vendite', '/lead', '#gruppo:Vendite', '/ordini', '/pagamenti'];
    const nuove = ['#gruppo:Vendite', '/lead', '#gruppo:Vendite', '/ordini'];
    expect(conNascosteAlLoroPosto(salvate, nuove)).toEqual([
      '#gruppo:Vendite', '/lead', '#gruppo:Vendite', '/ordini', '/pagamenti',
    ]);
  });

  it('se prima di lei non c\'è nessuna rotta sopravvissuta si aggancia al titolo', () => {
    const salvate = ['#gruppo:Clienti', '/pagamenti', '/clienti'];
    const nuove = ['#gruppo:Clienti', '/clienti'];
    expect(conNascosteAlLoroPosto(salvate, nuove)).toEqual(['#gruppo:Clienti', '/pagamenti', '/clienti']);
  });

  it('⚠️ due nascoste di fila non finiscono in coda: si risale finché si trova un appiglio', () => {
    const salvate = ['#gruppo:Clienti', '/clienti', '/pagamenti', '/fatture', '#gruppo:Catalogo', '/ricette'];
    const nuove = ['#gruppo:Clienti', '/clienti', '#gruppo:Catalogo', '/ricette'];
    expect(conNascosteAlLoroPosto(salvate, nuove)).toEqual([
      '#gruppo:Clienti', '/clienti', '/pagamenti', '/fatture', '#gruppo:Catalogo', '/ricette',
    ]);
  });

  it('la riga che era in cima resta in cima anche se il suo gruppo è sparito', () => {
    const salvate = ['/pagamenti', '#gruppo:Clienti', '/clienti'];
    const nuove = ['#gruppo:Clienti', '/clienti'];
    expect(conNascosteAlLoroPosto(salvate, nuove)).toEqual(['/pagamenti', '#gruppo:Clienti', '/clienti']);
  });

  it('senza niente di nascosto non tocca niente, e non duplica una voce che c\'è già', () => {
    const nuove = ['#gruppo:Clienti', '/clienti'];
    expect(conNascosteAlLoroPosto([], nuove)).toEqual(nuove);
    expect(conNascosteAlLoroPosto(['#gruppo:Clienti', '/clienti'], nuove)).toEqual(nuove);
  });

  /** I tre marcatori restano marcatori: `#gruppoc:` e `#gruppot:` non sono rotte orfane. */
  it('⚠️ i titoli non diventano mai voci da riattaccare', () => {
    const salvate = ['#gruppoc:Clienti', '/clienti', '#gruppot:Catalogo', '/ricette'];
    const nuove = ['#gruppo:Tutto', '/clienti', '/ricette'];
    expect(conNascosteAlLoroPosto(salvate, nuove)).toEqual(nuove);
  });
});
