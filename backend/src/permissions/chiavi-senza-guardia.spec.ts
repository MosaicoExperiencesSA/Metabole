/**
 * ⛔ **QUARANTATRÉ CHIAVI SU SESSANTAQUATTRO NON LE LEGGE NESSUNA GUARDIA.**
 *
 * `CLAUDE.md` lo dice da agosto: *«una chiave dichiarata e non letta da nessuno è un interruttore
 * che non accende niente»*, e il 13/8 ne erano state tolte due (`engine_reviews`, `assignments`).
 * Misurato il 3/9, mentre si chiudeva la voce sugli hub: il caso non era due, è **43**.
 *
 * ⚠️ **Questa prova non chiude il buco: lo tiene fermo.** È l'elenco di oggi, congelato. Diventa
 * rossa in due versi, e servono tutti e due:
 * · qualcuno **aggiunge** una chiave senza agganciarla a un `@RequirePage` → compare qui, e chi la
 *   scrive deve dire se è una scelta o una dimenticanza;
 * · qualcuno **aggancia** una guardia a una di queste → la prova va rossa, e si toglie il nome
 *   dall'elenco. ⛔ È il verso che conta: senza, l'elenco marcirebbe e nessuno saprebbe più quali
 *   caselle sono davvero decorative.
 *
 * ⚠️ Non sono tutte lo stesso caso — le figlie di una pagina guardata l'API ce l'hanno sotto la
 * chiave del genitore, e `diet_workspace`/`creation_validation` un effetto lato server ce l'hanno
 * come **grantor** di `PAGE_GRANTS`. La distinzione sta nella voce `chiavi-dichiarate-che-nessuno-legge`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BACKOFFICE_PAGES } from './pages';

/** Tutti i `.ts` del backend, esclusi i test: una guardia in uno spec non protegge niente. */
function sorgenti(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) sorgenti(p, out);
    else if (nome.endsWith('.ts') && !nome.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

const chiaviLette = (() => {
  const lette = new Set<string>();
  for (const p of sorgenti(join(__dirname, '..'))) {
    const testo = readFileSync(p, 'utf8');
    for (const m of testo.matchAll(/@RequirePage\(([^)]*)\)/g)) {
      for (const k of m[1].matchAll(/'([a-z0-9_]+)'/g)) lette.add(k[1]);
    }
  }
  return lette;
})();

/**
 * L'elenco di oggi. ⚠️ **Si accorcia, non si allunga**: allungarlo vuol dire che qualcuno ha
 * aggiunto una casella che non chiude niente, e va discusso, non registrato.
 */
const SENZA_GUARDIA_OGGI = [
  'accounting', 'accounting_costs', 'allergens', 'assign_coach', 'assign_nutritionist',
  'audit_logs', 'change_allergies', 'change_diet_type', 'change_fasting_window', 'charts',
  'chat', 'clinical_clearance', 'colazioni', 'commissions', 'compensation', 'creation_validation',
  'crm_calendar', 'crm_import', 'crm_lead_new', 'crm_leads', 'crm_pipeline', 'dashboard',
  'discounts', 'diet_workspace', 'email_log', 'email_templates', 'engine_config',
  'engine_protocols', 'engine_rules', 'equivalence_groups', 'escalations', 'health_documents',
  'lead_acceptance', 'notifications', 'pdf_templates', 'permissions', 'posta', 'publisher',
  'roles', 'shop', 'testimonials', 'users', 'withdrawals',
].sort();

describe('le chiavi di permesso che nessuna guardia legge', () => {
  const senza = BACKOFFICE_PAGES.filter((k) => !chiaviLette.has(k)).slice().sort();

  /**
   * ⛔ Se il lettore non trovasse nessun `@RequirePage`, «senza guardia» sarebbe **tutte** e la
   * prova sotto direbbe una cosa spaventosa e falsa. Questa è la sola che se ne accorge.
   */
  it('⛔ il lettore trova davvero delle guardie: a zero, tutto il resto sarebbe verde sul nulla', () => {
    expect(chiaviLette.size).toBeGreaterThanOrEqual(15);
  });

  it('⛔ e l\'elenco di quelle senza è ESATTAMENTE questo', () => {
    expect(senza).toEqual(SENZA_GUARDIA_OGGI);
  });

  /**
   * ⚠️ Il numero scritto nella voce dei lavori **e nel banner della pagina Permessi**: se cambia
   * senza che qualcuno aggiorni quei due posti, cominciano a mentire.
   *
   * ⛔ **E il banner si controlla, non si toglie dal docstring.** La consegna del menu scritto a
   * mano ha aggiunto una chiave, ha aggiornato il numero qui e ha **tolto la menzione del banner**
   * da questo commento invece di correggerlo: il banner è rimasto a 64. È la regola di `CLAUDE.md`
   * — *il registro comincia a mentire* — pagata restringendo la sentinella per farla combaciare.
   * Adesso il banner è dentro la prova, e non si può più aggiustare la prova al posto del banner.
   *
   * ✅ **43 su 65 dal 3/9**, ed è il verso giusto: la chiave nuova `menu_a_mano` è nata **insieme
   * alla sua guardia** (`menu/menu-a-mano.controller.ts`), quindi le chiavi salgono a 65 e quelle
   * senza guardia restano 43. ⚠️ È esattamente il caso per cui questa prova esiste: senza, la
   * chiave nuova sarebbe potuta nascere senza guardia e nessuno se ne sarebbe accorto.
   */
  it('⚠️ e sono 43 su 65: il numero che sta scritto nella voce e nel banner', () => {
    expect(BACKOFFICE_PAGES.length).toBe(65);
    expect(senza.length).toBe(43);
    const banner = readFileSync(
      join(__dirname, '..', '..', '..', 'backoffice', 'src', 'pages', 'Permissions.tsx'), 'utf8',
    );
    expect(banner).toContain(`${senza.length} chiavi su ${BACKOFFICE_PAGES.length}`);
  });
});
