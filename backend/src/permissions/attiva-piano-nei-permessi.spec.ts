import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PAGE_KEY } from '../common/decorators/require-page.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { AdminPurchasesController } from '../commerce/commerce.controller';
import { BACKOFFICE_PAGES, DEFAULT_PERMISSIONS, INHERIT_DEFAULTS } from './pages';

/**
 * ⛔ **«ATTIVA UN PIANO» È UNA CASELLA, NON UN RUOLO** — Simone, 4/9: *«va gestito nei ruoli»*.
 *
 * Prima il pulsante stava dentro un `can('permissions')` scritto a mano e la rotta era
 * `@Roles('admin')`: quel potere non si poteva né dare al capo nutrizionista senza farne un admin,
 * né togliere a un admin. ⚠️ Il gemello rovesciato del difetto del 3/9 — lì 29 caselle spengono il
 * menu e non la porta, qui c'era **una porta senza nessuna casella**.
 *
 * ⚠️ I tre passi di `CLAUDE.md` sono tenuti fermi qui tutti e tre insieme: **la chiave nasce con la
 * guardia che la legge**, e l'etichetta esiste, o nella tabella dei Permessi comparirebbe la chiave
 * grezza.
 */
const suMetodo = <T>(chiave: string, metodo: string): T | undefined =>
  Reflect.getMetadata(chiave, (AdminPurchasesController.prototype as unknown as Record<string, never>)[metodo]) as T | undefined;

describe('«Attiva un piano» nei Permessi', () => {
  it('⛔ la chiave esiste', () => {
    expect(BACKOFFICE_PAGES).toContain('attiva_piano');
  });

  it('⛔ e la legge la guardia della scrittura, in «gestisce»', () => {
    expect(suMetodo<{ pageKey: string; level?: string }>(PAGE_KEY, 'createManual'))
      .toMatchObject({ pageKey: 'attiva_piano', level: 'manage' });
  });

  /**
   * ⛔ **La stessa chiave sulla LETTURA dei piani, o il permesso è un interruttore che non accende
   * niente**: la finestra legge quell'elenco, e a chi avesse la casella senza poterlo leggere si
   * aprirebbe **vuota**.
   */
  it('⛔ e la lettura dei piani sta sotto la stessa chiave, in sola vista', () => {
    const m = suMetodo<{ pageKey: string; level?: string }>(PAGE_KEY, 'plans');
    expect(m?.pageKey).toBe('attiva_piano');
    expect(m?.level).toBeUndefined();
  });

  /** ⚠️ `@Roles` resta sotto: il `PageGuard` è permissivo se il database non risponde. */
  it('⚠️ i ruoli restano come rete su tutt\'e due', () => {
    for (const m of ['createManual', 'plans']) {
      expect(suMetodo<string[]>(ROLES_KEY, m)).toContain('admin');
    }
  });

  /**
   * ⛔ **QUESTA CONSEGNA SPOSTA IL CANCELLO, NON LO APRE.** Il default resta **solo admin**, cioè
   * esattamente com'era: se questa riga diventasse rossa, qualcuno starebbe dando a un ruolo un
   * potere che oggi non ha, di sponda a una consegna sui permessi.
   */
  it('⛔ di default ce l\'ha solo l\'admin, come prima', () => {
    const chi = (Object.keys(DEFAULT_PERMISSIONS) as (keyof typeof DEFAULT_PERMISSIONS)[])
      .filter((r) => DEFAULT_PERMISSIONS[r].attiva_piano);
    expect(chi).toEqual(['admin']);
  });

  /**
   * ⛔ **E NON eredita da `purchases`**, che sarebbe la scorciatoia: `purchases` in sola vista ce
   * l'hanno coach, coordinatrici e nutrizioniste, quindi ereditare vorrebbe dire **darlo a tutte**.
   * L'ereditarietà esiste perché «separare una schermata non toglie accesso a nessuno», non per
   * darne.
   */
  it('⛔ e non eredita da «purchases»: erediterebbe verso l\'alto', () => {
    expect(INHERIT_DEFAULTS.attiva_piano).toBeUndefined();
  });

  /** ⚠️ L'etichetta, o nella tabella dei Permessi compare la chiave grezza. */
  it('⚠️ ha la sua etichetta in labels.ts', () => {
    const labels = readFileSync(join(__dirname, '..', '..', '..', 'backoffice', 'src', 'lib', 'labels.ts'), 'utf8');
    expect(labels).toMatch(/attiva_piano: '[^']{10,}'/);
  });

  /**
   * ⛔ **E il pulsante legge la casella, non il ruolo.** Senza questa riga la chiave resterebbe una
   * casella che governa la rotta mentre la schermata continua a decidere per conto suo — che è la
   * stessa distanza fra menu e porta che il 3/9 ha misurato su 43 chiavi.
   */
  it('⛔ il pulsante in scheda cliente legge can(\'attiva_piano\')', () => {
    const scheda = readFileSync(join(__dirname, '..', '..', '..', 'backoffice', 'src', 'pages', 'ClientDetail.tsx'), 'utf8');
    expect(scheda).toContain("can('attiva_piano', 'manage')");
    expect(scheda).not.toMatch(/\{isAdmin && \(\s*\n\s*<button className="btn ghost sm" onClick=\{\(\) => setAttivaPiano\(true\)\}/);
  });
});
