/*
 * ─────────────────────────────────────────────────────────────────────────────
 * KIT DI MONTAGGIO — test dei permessi. Manuale: kit/manuale/03-permessi.md
 * Cosa impedisce: impedisce l'eredita' che legge il default invece della riga vera.
 * ⚠️ Va ADATTATO alle chiavi del tuo progetto, non tolto: e' uno dei quattro modi
 *    in cui un sistema di permessi mente, e ognuno qui ha trovato un difetto vero.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  SALTI_MASSIMI, catenaDeiGenitori, permessoEffettivo, righeDaCreare, type Permesso,
} from './eredita-dal-genitore';

const GENITORI = { figlia: 'genitore', nipote: 'figlia', orfana: 'sconosciuta' } as const;

const righe = (m: Record<string, Permesso>) => (pageKey: string) => m[pageKey] ?? null;
const senzaRighe = () => null;
const difetti = (m: Record<string, Permesso>) => (pageKey: string) => m[pageKey] ?? null;
const nessunDefault = () => null;

const V = { canView: true, canManage: false };
const VG = { canView: true, canManage: true };
const NO = { canView: false, canManage: false };

describe('la catena dei genitori', () => {
  it('parte sempre dalla pagina stessa', () => {
    expect(catenaDeiGenitori('sola', GENITORI)).toEqual(['sola']);
  });

  it('risale la catena, dal più vicino', () => {
    expect(catenaDeiGenitori('nipote', GENITORI)).toEqual(['nipote', 'figlia', 'genitore']);
  });

  /**
   * ⛔ Una pagina «hub» concede più del suo genitore: `diet_workspace` è figlia di `diets_catalog`
   * **e** grantor di `diets_catalog` + `recipes`. Ereditare la riga del genitore le darebbe di
   * aprire una porta che il genitore non apre.
   */
  it('⛔ una pagina «hub» non eredita: la catena si ferma su di lei', () => {
    expect(catenaDeiGenitori('figlia', GENITORI, new Set(['figlia']))).toEqual(['figlia']);
  });

  it('⚠️ e un hub incontrato risalendo chiude la catena lì', () => {
    expect(catenaDeiGenitori('nipote', GENITORI, new Set(['figlia']))).toEqual(['nipote', 'figlia']);
  });

  /**
   * ⛔ **La guardia sui già-visti da sola non basta.** Nella prima stesura, togliendola, la prova
   * sul ciclo **non faceva fallire la suite: la bloccava** — il giro è sincrono, tiene l'event loop,
   * e il timeout di Jest non scatta mai. Una prova che segnala un difetto fermando la CI invece di
   * diventare rossa è peggio di nessuna prova. Adesso c'è anche un tetto ai salti.
   */
  it('⛔ un ciclo non manda in loop', () => {
    expect(catenaDeiGenitori('a', { a: 'b', b: 'a' })).toEqual(['a', 'b']);
  });

  it('⛔ e nemmeno una pagina che dichiara se stessa genitore', () => {
    expect(catenaDeiGenitori('a', { a: 'a' })).toEqual(['a']);
  });

  it('⛔ e una catena lunghissima si ferma al tetto, invece di girare', () => {
    const lunga: Record<string, string> = {};
    for (let i = 0; i < 100; i += 1) lunga[`p${i}`] = `p${i + 1}`;
    expect(catenaDeiGenitori('p0', lunga)).toHaveLength(SALTI_MASSIMI + 1);
  });

  it('un genitore che non esiste da nessuna parte finisce lo stesso nella catena, e basta', () => {
    expect(catenaDeiGenitori('orfana', GENITORI)).toEqual(['orfana', 'sconosciuta']);
  });
});

describe('il permesso effettivo di una pagina figlia', () => {
  it('la riga PROPRIA comanda su tutto: l\'eredità è solo per la riga mancante', () => {
    const d = permessoEffettivo('coach', 'figlia', GENITORI, righe({ figlia: NO, genitore: VG }), difetti({ figlia: VG }));
    expect(d).toMatchObject({ canView: false, canManage: false, provenienza: 'riga propria' });
  });

  /**
   * ⛔ **IL VERSO CHE SI VEDE.** L'admin aveva acceso a mano il genitore su un ruolo dove il default
   * è spento: col difetto la figlia valeva spenta, e la pagina spariva a chi doveva averla.
   */
  it('⛔ genitore ACCESO a mano, default spento: la figlia vale accesa', () => {
    const d = permessoEffettivo('coach', 'figlia', GENITORI, righe({ genitore: VG }), difetti({ figlia: NO }));
    expect(d).toMatchObject({ canView: true, canManage: true, provenienza: 'riga del genitore', genitore: 'genitore' });
  });

  /**
   * ⛔ **IL VERSO CHE NON SI VEDE, ED È QUELLO CHE FA MALE.** L'admin aveva **spento** a mano il
   * genitore su un ruolo dove il default è acceso: col difetto la figlia valeva **accesa**, cioè la
   * pagina tornava a chi era stata tolta. Nessuno segnala un accesso in più.
   */
  it('⛔ genitore SPENTO a mano, default acceso: la figlia vale spenta', () => {
    const d = permessoEffettivo('coach', 'figlia', GENITORI, righe({ genitore: NO }), difetti({ figlia: VG }));
    expect(d).toMatchObject({ canView: false, canManage: false, provenienza: 'riga del genitore' });
  });

  it('⚠️ la gestione si eredita separata dalla vista: sola vista resta sola vista', () => {
    const d = permessoEffettivo('coach', 'figlia', GENITORI, righe({ genitore: V }), difetti({ figlia: VG }));
    expect(d).toMatchObject({ canView: true, canManage: false });
  });

  it('una pagina senza genitore prende il suo default', () => {
    const d = permessoEffettivo('coach', 'sola', GENITORI, righe({ genitore: VG }), difetti({ sola: V }));
    expect(d).toMatchObject({ canView: true, canManage: false, provenienza: 'default' });
  });

  /**
   * ⚠️ **Genitore senza riga non è «spento»: è «non ancora creato»**, e capita al primo avvio con la
   * banca dati vuota. Fermarsi lì darebbe alla figlia un permesso più stretto del genitore per via
   * dell'ordine di creazione.
   */
  it('⚠️ genitore senza riga: si ripiega sul default, non su «spento»', () => {
    const d = permessoEffettivo('coach', 'figlia', GENITORI, senzaRighe, difetti({ figlia: VG }));
    expect(d).toMatchObject({ canView: true, canManage: true, provenienza: 'default' });
  });

  it('nessuna riga e nessun default: la pagina vale spenta', () => {
    expect(permessoEffettivo('coach', 'figlia', GENITORI, senzaRighe, nessunDefault))
      .toMatchObject({ canView: false, canManage: false, provenienza: 'default' });
  });

  it('⚠️ la catena si risale fino alla PRIMA riga vera', () => {
    const d = permessoEffettivo('coach', 'nipote', GENITORI, righe({ genitore: VG }), difetti({ nipote: NO }));
    expect(d).toMatchObject({ canView: true, genitore: 'genitore' });
  });

  it('⚠️ e si ferma lì, non risale oltre', () => {
    const d = permessoEffettivo('coach', 'nipote', GENITORI, righe({ figlia: NO, genitore: VG }), difetti({ nipote: VG }));
    expect(d).toMatchObject({ canView: false, genitore: 'figlia' });
  });

  /**
   * ⛔ **IL DEFAULT SCRITTO APPOSTA PER LA FIGLIA VINCE SULL'EREDITÀ.** È la precedenza che il ciclo
   * di `pages.ts` ha sempre avuto (`if (p && !perms[child])`), e la prima stesura la rovesciava
   * senza dirlo. Oggi non si vedrebbe — nessuna delle dodici figlie ha un default suo — ma l'unico
   * motivo per scriverne uno è renderlo **più stretto** del genitore, e quella scelta sarebbe stata
   * ignorata in silenzio.
   */
  it('⛔ il default ESPLICITO della figlia batte la riga del genitore', () => {
    const d = permessoEffettivo(
      'coach', 'figlia', GENITORI, righe({ genitore: VG }), difetti({ figlia: V }),
      { defaultEsplicitoDi: difetti({ figlia: V }) },
    );
    expect(d).toMatchObject({ canView: true, canManage: false, provenienza: 'default' });
  });

  it('⚠️ ma un default solo SINTETIZZATO non conta: quello non l\'ha scritto nessuno', () => {
    const d = permessoEffettivo(
      'coach', 'figlia', GENITORI, righe({ genitore: NO }), difetti({ figlia: VG }),
      { defaultEsplicitoDi: () => null },
    );
    expect(d).toMatchObject({ canView: false, provenienza: 'riga del genitore' });
  });

  it('⛔ una pagina «hub» non eredita: prende il suo default', () => {
    const d = permessoEffettivo(
      'coach', 'figlia', GENITORI, righe({ genitore: VG }), difetti({ figlia: NO }),
      { nonEreditano: new Set(['figlia']) },
    );
    expect(d).toMatchObject({ canView: false, provenienza: 'default' });
  });

  it('⚠️ ma se ha una riga sua, quella comanda anche per un hub', () => {
    const d = permessoEffettivo(
      'coach', 'figlia', GENITORI, righe({ figlia: VG }), difetti({ figlia: NO }),
      { nonEreditano: new Set(['figlia']) },
    );
    expect(d).toMatchObject({ canView: true, provenienza: 'riga propria' });
  });
});

describe('le righe da creare per un ruolo', () => {
  it('una per pagina mancante, nell\'ordine chiesto', () => {
    const out = righeDaCreare('coach', ['figlia', 'sola'], GENITORI, righe({ genitore: VG }), difetti({ sola: V }));
    expect(out.map((r) => r.pageKey)).toEqual(['figlia', 'sola']);
    expect(out[0].provenienza).toBe('riga del genitore');
    expect(out[1].provenienza).toBe('default');
  });

  /**
   * ⛔ **L'ordine delle pagine non deve contare.** Se una riga appena messa in coda potesse fare da
   * genitore a un'altra, due avvii con `BACKOFFICE_PAGES` in ordine diverso darebbero due matrici
   * diverse — e nessuno saprebbe quale delle due è quella giusta.
   */
  it('⛔ una riga appena decisa NON fa da genitore a un\'altra', () => {
    const dritto = righeDaCreare('coach', ['figlia', 'nipote'], GENITORI, senzaRighe, difetti({ figlia: VG, nipote: NO }));
    const rovescio = righeDaCreare('coach', ['nipote', 'figlia'], GENITORI, senzaRighe, difetti({ figlia: VG, nipote: NO }));
    const perChiave = (r: typeof dritto) => Object.fromEntries(r.map((x) => [x.pageKey, x.canView]));
    expect(perChiave(dritto)).toEqual(perChiave(rovescio));
    expect(perChiave(dritto)).toEqual({ figlia: true, nipote: false });
  });

  it('nessuna pagina mancante: nessuna riga', () => {
    expect(righeDaCreare('coach', [], GENITORI, senzaRighe, nessunDefault)).toEqual([]);
  });
});
