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
import { BACKOFFICE_PAGES, MOTIVO_SENZA_GUARDIA } from './pages';

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
   * ✅ **43 su 66 dal 3/9 sera**, ed è il verso giusto **due volte**: `menu_a_mano` e
   * `diet_descriptions` sono nate **insieme alle loro guardie**, quindi le chiavi salgono e quelle
   * senza guardia restano 43. ⚠️ È esattamente il caso per cui questa prova esiste — e con
   * `diet_descriptions` si è accesa davvero: la chiave era stata dichiarata prima di agganciare la
   * `@RequirePage`, e tre prove sono diventate rosse nello stesso momento.
   */
  it('⚠️ e sono 43 su 66: il numero che sta scritto nella voce e nel banner', () => {
    expect(BACKOFFICE_PAGES.length).toBe(66);
    expect(senza.length).toBe(43);
    const banner = readFileSync(
      join(__dirname, '..', '..', '..', 'backoffice', 'src', 'pages', 'Permissions.tsx'), 'utf8',
    );
    expect(banner).toContain(`${senza.length} chiavi su ${BACKOFFICE_PAGES.length}`);
  });
});

/**
 * ⛔ **E NON SONO TUTTE LO STESSO CASO: la classificazione, tenuta ferma.**
 *
 * Un elenco unico mette insieme il **buco** («Documenti sanitari»: spegnere toglie la voce e lascia
 * aperto il `GET`) e la **scelta** («Nuovo lead»: l'API vera sta sotto `crm_leads`, che la guardia
 * ce l'ha). ⚠️ *Mescolarle porta a correggere quella sbagliata* — è scritto nella voce, e finché la
 * distinzione stava solo lì chi guardava la matrice non aveva modo di saperla.
 */
describe('ogni chiave senza guardia dice PERCHÉ', () => {
  const senza = BACKOFFICE_PAGES.filter((k) => !chiaviLette.has(k));

  it('⛔ nessuna resta senza motivo: un elenco unico non si può leggere', () => {
    expect(senza.filter((k) => !MOTIVO_SENZA_GUARDIA[k])).toEqual([]);
  });

  /**
   * ⛔ **E il verso opposto, che è quello che marcisce.** Il giorno che una di queste prende la sua
   * `@RequirePage`, la riga va tolta: lasciarla direbbe «è decorativa» di una casella che adesso
   * comanda — e nella pagina Permessi comparirebbe un avviso falso.
   */
  it('⛔ e una chiave CON la guardia non ha un motivo: sarebbe un avviso falso in pagina', () => {
    const conGuardia = BACKOFFICE_PAGES.filter((k) => chiaviLette.has(k));
    expect(conGuardia.filter((k) => MOTIVO_SENZA_GUARDIA[k])).toEqual([]);
  });

  /** ⚠️ E nessun motivo per una chiave che non esiste più: un elenco che sopravvive alla cosa che descrive. */
  it('⚠️ nessun motivo per una chiave che non è in BACKOFFICE_PAGES', () => {
    const dichiarate = new Set<string>(BACKOFFICE_PAGES);
    expect(Object.keys(MOTIVO_SENZA_GUARDIA).filter((k) => !dichiarate.has(k))).toEqual([]);
  });

  /**
   * ⛔ **I buchi sono la parte che conta, e sono la maggioranza: 29 su 43.** Il numero sta scritto
   * qui perché è quello che dice quanto lavoro resta — ogni riga è una casella che oggi **mente** a
   * chi la guarda. ⚠️ Si accorcia agganciando le guardie, **mai riclassificando**: spostare una
   * chiave da `buco` a `figlia` per far scendere il numero è la stessa cosa che spegnere l'avviso.
   */
  it('⛔ e quanti sono i buchi veri: 29 su 43', () => {
    const per = (m: string) => senza.filter((k) => MOTIVO_SENZA_GUARDIA[k] === m).length;
    expect(per('buco')).toBe(29);
    expect(per('figlia')).toBe(9);
    expect(per('grantor')).toBe(2);
    expect(per('innocua')).toBe(3);
  });
});

/**
 * ⛔ **E LA CLASSIFICAZIONE DEVE ESSERE LETTA DA QUALCUNO.**
 *
 * Una tabella esportata e non letta è **l'interruttore che non accende niente** — cioè il difetto
 * di `assignments` rifatto un piano più sopra, dentro la consegna che quel difetto misura. ⚠️ Il
 * giro è: `pages.ts` la dichiara · `permissions.service.ts` la manda in `senzaGuardia` · la pagina
 * la mostra. Se una delle tre si stacca, la matrice torna a non dire niente e nessuno se ne
 * accorge.
 */
describe('la classificazione arriva a chi guarda la matrice', () => {
  const bo = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', 'backoffice', 'src', ...p), 'utf8');

  it('⛔ il servizio la manda alla pagina', () => {
    const servizio = readFileSync(join(__dirname, 'permissions.service.ts'), 'utf8');
    expect(servizio).toMatch(/senzaGuardia: MOTIVO_SENZA_GUARDIA/);
  });

  it('⛔ e la pagina la legge, e segnala i buchi', () => {
    const pagina = bo('pages', 'Permissions.tsx');
    expect(pagina).toMatch(/data\.senzaGuardia\?\.\[pageKey\] === 'buco'/);
  });

  /**
   * ⚠️ **Solo i buchi.** Segnalare anche le figlie e i grantor rifarebbe l'elenco unico che questa
   * classificazione esiste per sciogliere: la figlia di una pagina guardata non è un difetto, e un
   * avviso su una cosa che va bene insegna a non leggere gli avvisi.
   */
  it('⚠️ e non segnala le figlie né i grantor', () => {
    const pagina = bo('pages', 'Permissions.tsx');
    expect(pagina).not.toMatch(/=== 'figlia'/);
    expect(pagina).not.toMatch(/=== 'grantor'/);
  });
});
