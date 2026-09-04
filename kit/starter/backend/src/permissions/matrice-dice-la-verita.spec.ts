/*
 * ─────────────────────────────────────────────────────────────────────────────
 * KIT DI MONTAGGIO — test dei permessi. Manuale: kit/manuale/03-permessi.md
 * Cosa impedisce: impedisce chiavi senza etichetta ed etichette senza chiave.
 * ⚠️ Va ADATTATO alle chiavi del tuo progetto, non tolto: e' uno dei quattro modi
 *    in cui un sistema di permessi mente, e ognuno qui ha trovato un difetto vero.
 * ─────────────────────────────────────────────────────────────────────────────
 */
/**
 * ⛔ **`getMatrix` — IL PUNTO DI CUCITURA, che non aveva nessuna prova.**
 *
 * Il modulo puro (`porta-aperta-lo-stesso.ts`) è fedele al guardiano, ed è provato. Ma è qui che si
 * decide **con quali ingredienti** lo si chiama: quale chiave di ruolo, quali righe, quali default.
 * Una revisione avversariale ha trovato che la prima stesura li sbagliava tutti e tre per i ruoli
 * personalizzati — e nessuna prova se ne accorgeva, perché nessuna guardava questa funzione.
 *
 * ⚠️ *Le prove sul modulo puro non provano il montaggio.* Vale come regola generale in questo
 * progetto: quando una regola si sposta in un modulo, il punto che ce la porta resta scoperto.
 */
import { PermissionsService } from './permissions.service';
import { BACKOFFICE_PAGES } from './pages';

type Riga = { role: string; pageKey: string; canView: boolean; canManage: boolean };

function servizio(righe: Riga[], ruoli: { key: string; baseRole: string; isSystem: boolean }[]) {
  const prisma = {
    rolePagePermission: { findMany: jest.fn().mockResolvedValue(righe) },
  } as never;
  const roles = {
    listAll: jest.fn().mockResolvedValue(
      ruoli.map((r) => ({ ...r, label: r.key, color: null })),
    ),
  } as never;
  return new PermissionsService(prisma, { log: jest.fn() } as never, roles);
}

/** Tutte le pagine spente per un ruolo: la base su cui accendere una cosa sola. */
const tutteSpente = (role: string): Riga[] =>
  BACKOFFICE_PAGES.map((pageKey) => ({ role, pageKey, canView: false, canManage: false }));

const SISTEMA = [
  { key: 'nutritionist', baseRole: 'nutritionist', isSystem: true },
];

describe('getMatrix — dice la verità sulle celle che mentono', () => {
  it('⛔ «Ricette» spenta a un ruolo che ha Gestione dieta viene segnalata come aperta dall\'hub', async () => {
    const righe = tutteSpente('nutritionist').map((r) =>
      (r.pageKey === 'diet_workspace' ? { ...r, canView: true, canManage: true } : r));
    const m = await servizio(righe, SISTEMA).getMatrix();
    const su = m.aperteLoStesso.filter((c) => c.pageKey === 'recipes');
    expect(su.map((c) => c.livello).sort()).toEqual(['manage', 'view']);
    expect(su[0]).toMatchObject({ role: 'nutritionist', provenienza: 'hub', chiave: 'diet_workspace' });
  });

  it('⚠️ e con tutto spento non segnala niente', async () => {
    const m = await servizio(tutteSpente('nutritionist'), SISTEMA).getMatrix();
    expect(m.aperteLoStesso).toEqual([]);
    expect(m.senzaRiga).toBe(0);
  });

  /**
   * ⛔ **IL RUOLO PERSONALIZZATO: il guardiano legge la riga del ruolo di BASE.**
   *
   * `resolveRole` mette il base in `user.role`, quindi spegnere «Ricette» a «Nutrizionista junior»
   * toglie la voce di menu e **non** chiude le API. Nella prima stesura questa colonna produceva
   * **zero** avvisi: la pagina taceva in modo credibile, che è peggio che tacere.
   */
  it('⛔ un ruolo personalizzato: la colonna spenta non chiude, e adesso lo dice', async () => {
    const righe = [
      ...tutteSpente('nutritionist').map((r) =>
        (r.pageKey === 'recipes' ? { ...r, canView: true, canManage: true } : r)),
      ...tutteSpente('nutri_junior'),
    ];
    const m = await servizio(righe, [
      ...SISTEMA,
      { key: 'nutri_junior', baseRole: 'nutritionist', isSystem: false },
    ]).getMatrix();
    const su = m.aperteLoStesso.filter((c) => c.role === 'nutri_junior' && c.pageKey === 'recipes');
    expect(su).toHaveLength(2);
    expect(su[0]).toMatchObject({ provenienza: 'ruolo di base', ruolo: 'nutritionist' });
  });

  /**
   * ⛔ **E un ruolo personalizzato costruito su `admin` si salta.** Il guardiano gli dice sì prima
   * di qualunque lettura: filtrare sulla chiave letterale `'admin'` lasciava quella colonna piena
   * di spiegazioni sbagliate date con sicurezza.
   */
  it('⛔ una colonna con ruolo di base admin non viene commentata affatto', async () => {
    /**
     * ⚠️ Le righe dell'admin sono **accese**, apposta: con tutto spento le celle finirebbero nel
     * conto `senzaRiga` e la prova passerebbe anche filtrando sulla chiave sbagliata — cioè non
     * misurerebbe niente. Così invece, senza il filtro giusto, la colonna «Amministrazione clienti»
     * si riempirebbe di avvisi «vale admin».
     */
    const m = await servizio([
      ...tutteSpente('admin').map((r) => ({ ...r, canView: true, canManage: true })),
      ...tutteSpente('amm_clienti'),
    ], [
      { key: 'admin', baseRole: 'admin', isSystem: true },
      { key: 'amm_clienti', baseRole: 'admin', isSystem: false },
    ]).getMatrix();
    expect(m.aperteLoStesso.filter((c) => c.role === 'amm_clienti')).toEqual([]);
    expect(m.aperteLoStesso.filter((c) => c.role === 'admin')).toEqual([]);
  });

  /**
   * ⛔ **Le righe mai create si contano, non riempiono la tabella.** Con la banca dati vuota — che
   * capita se `syncDefaults` è andato storto all'avvio — sarebbero decine di badge per ruolo:
   * misurate in revisione, 52 per la nutrizionista.
   */
  it('⛔ senza nessuna riga in banca dati il conto sale e la tabella resta pulita', async () => {
    const m = await servizio([], SISTEMA).getMatrix();
    expect(m.senzaRiga).toBeGreaterThan(10);
    expect(m.aperteLoStesso.every((c) => c.provenienza !== 'default')).toBe(true);
  });

  /**
   * ⛔ **I DEFAULT DI UN RUOLO PERSONALIZZATO SONO QUELLI DEL SUO RUOLO DI BASE.**
   *
   * `DEFAULT_PERMISSIONS` è indicizzato per ruolo **di sistema**: cercarlo con la chiave
   * personalizzata rende `undefined` per tutte e sessantaquattro le pagine, e il modulo crede che
   * per quel ruolo sia tutto chiuso. `syncDefaults`, dieci righe più su, lo sa già e passa
   * `custom.baseRole`; la prima stesura di `getMatrix` no, e una mutazione che rimetteva `r.key`
   * **sopravviveva**: nessuna prova arrivava fin lì, perché nelle altre le righe decidevano prima.
   *
   * ⚠️ **E le due tabelle oggi si coprono a vicenda, quindi la prova misura la coppia.** Misurato:
   * `DEFAULT_ESPLICITI.nutritionist` ha 26 pagine, `DEFAULT_PERMISSIONS.nutritionist` ne ha 29, e
   * sulle 26 in comune i valori sono gli stessi — perché nessuna figlia ha ancora un default
   * scritto apposta (lo dice il commento di `DEFAULT_ESPLICITI`). Sbagliare **una** delle due
   * chiavi non cambia nessuna risposta: l'altra copre. Scriverlo qui invece di fingere che ogni
   * mutazione sia uccisa da sola: il giorno che una figlia avrà il suo default, questa nota dirà
   * al prossimo che va aggiunta una prova che le separa.
   */
  it('⛔ un ruolo personalizzato senza righe pesca i default del RUOLO DI BASE', async () => {
    const m = await servizio([], [
      { key: 'nutri_junior', baseRole: 'nutritionist', isSystem: false },
    ]).getMatrix();
    // Senza nessuna riga in banca dati, quello che apre le porte sono i default del base.
    expect(m.senzaRiga).toBeGreaterThan(20);
  });

  /** ⚠️ E i campi che la pagina usa per il verso diretto ci sono. */
  it('⚠️ la matrice porta con sé cosa concede ogni hub', async () => {
    const m = await servizio(tutteSpente('nutritionist'), SISTEMA).getMatrix();
    expect(m.concede.diet_workspace).toEqual(['diets_catalog', 'recipes']);
  });
});
