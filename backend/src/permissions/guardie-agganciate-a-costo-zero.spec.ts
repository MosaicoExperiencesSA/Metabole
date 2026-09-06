import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GUARDIA_INERTE, MOTIVO_SENZA_GUARDIA } from './pages';

/**
 * ⛔ **LE DIECI GUARDIE DEL 5/9, E LA CONDIZIONE CHE LE HA RESE GRATIS.**
 *
 * Primo passo della strada (b): agganciare `@RequirePage` alle chiavi che nessuna guardia leggeva.
 * La voce di lavoro avvertiva che è una strada che **tocca i permessi di persone vere** — la
 * guardia legge `role_page_permission`, e per una chiave che nessuno leggeva le righe possono non
 * esserci: chi oggi entra domani prende 403.
 *
 * ⛔ **Il gruppo è stato scelto per una ragione sola**: sono tutte rotte `@Roles('admin')` e basta.
 * L'admin è superutente e `page.guard.ts` lo lascia passare **senza leggere la matrice**; chi admin
 * non è prendeva 403 dal solo elenco dei ruoli già ieri. Quindi l'aggancio non toglie l'accesso a
 * nessuno, e chiude una casella che finora spegneva la voce di menu e non la porta.
 *
 * ⚠️ **Questa prova è quella condizione, tenuta ferma.** Il giorno che qualcuno allarga uno di
 * questi `@Roles` — «facciamo vedere la contabilità anche a sales» — la guardia smette di essere
 * gratis e comincia a chiudere fuori qualcuno per davvero, in silenzio. Qui diventa rossa, e chi
 * allarga deve andare a guardare la matrice prima, non dopo la telefonata.
 *
 * ⛔ **E `@Roles` deve RESTARE.** Non è ridondanza: `page.guard.ts` resta permissivo su un errore di
 * lettura dei permessi **solo se sotto c'è ancora un `@Roles`** (correzione del 17/8). Toglierlo
 * lasciando la sola guardia trasforma un singhiozzo del database in 403 per tutti — e su
 * `admin/users` vuol dire che nessuno può più sistemare niente proprio mentre qualcosa non va.
 */

const AGGANCIATE_IL_5_9: { chiave: string; file: string; classe: string }[] = [
  { chiave: 'audit_logs', file: 'audit/audit.controller.ts', classe: 'AuditController' },
  { chiave: 'users', file: 'users/admin-users.controller.ts', classe: 'AdminUsersController' },
  { chiave: 'roles', file: 'roles/roles.controller.ts', classe: 'RolesController' },
  { chiave: 'engine_config', file: 'config-params/admin-config.controller.ts', classe: 'AdminConfigController' },
  { chiave: 'pdf_templates', file: 'pdf/pdf.controller.ts', classe: 'PdfTemplatesController' },
  { chiave: 'shop', file: 'commerce/commerce.controller.ts', classe: 'AdminShopController' },
  { chiave: 'email_templates', file: 'mail/email-admin.controller.ts', classe: 'EmailAdminController' },
  { chiave: 'email_log', file: 'mail/email-admin.controller.ts', classe: 'EmailAdminController' },
  { chiave: 'accounting', file: 'commerce/accounting.controller.ts', classe: 'AccountingController' },
  { chiave: 'accounting_costs', file: 'commerce/accounting.controller.ts', classe: 'AccountingController' },
];

/**
 * ⛔ **I COMMENTI SI TOLGONO PRIMA DI GUARDARE, e non è pignoleria**: la prima stesura di questa
 * prova non mordeva, e il motivo era che il commento sopra la classe **nomina** `@Roles('admin')`
 * per spiegare perché la guardia è gratis. Togliendo il decoratore vero la prova restava verde,
 * perché leggeva la spiegazione al posto del codice. Una prova che legge i propri commenti dice
 * sempre di sì.
 */
const senzaCommenti = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const DUE_CHIAVI_IN_UNA_CLASSE = ['mail/email-admin.controller.ts', 'commerce/accounting.controller.ts'];

const leggi = (f: string) => senzaCommenti(readFileSync(join(__dirname, '..', f), 'utf8'));

/** Il blocco di decoratori che sta **subito sopra** `export class <nome>`, commenti già tolti. */
function decoratoriDellaClasse(sorgente: string, classe: string): string {
  const i = sorgente.indexOf(`export class ${classe}`);
  expect(i).toBeGreaterThan(-1);
  const prima = sorgente.slice(0, i);
  /** ⚠️ Solo il blocco attaccato alla classe: le righe vuote separano una classe dalla precedente. */
  return prima.slice(prima.lastIndexOf('\n\n') + 1);
}

describe('⛔ le dieci guardie agganciate il 5/9', () => {
  it.each(AGGANCIATE_IL_5_9)('$chiave: la rotta è @Roles(admin) e basta, quindi la guardia non toglie niente a nessuno', ({ file, classe }) => {
    const sopra = decoratoriDellaClasse(leggi(file), classe);
    const roles = [...sopra.matchAll(/@Roles\(([^)]*)\)/g)].pop();
    expect(roles).toBeDefined();
    const ruoli = [...(roles as RegExpMatchArray)[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(ruoli).toEqual(['admin']);
  });

  /**
   * ⛔ **E ANCHE SUI METODI, perché in Nest il metodo VINCE sulla classe.** La prima stesura
   * guardava solo i decoratori di classe: un `@Roles('admin', 'marketing')` messo sul singolo
   * `@Get('templates')` la lasciava verde — e sarebbe stata una perdita di accesso vera, perché
   * `marketing` non ha `email_templates` nei default e avrebbe preso 403 dalla guardia, in
   * silenzio. È lo scenario che l'intestazione di questa prova dichiara di presidiare.
   */
  it.each(AGGANCIATE_IL_5_9)('$chiave: e nessun metodo allarga i ruoli per conto suo', ({ file, classe }) => {
    const src = leggi(file);
    const i = src.indexOf(`export class ${classe}`);
    const corpo = src.slice(i, src.indexOf('\n}', i));
    for (const m of corpo.matchAll(/@Roles\(([^)]*)\)/g)) {
      expect([...m[1].matchAll(/'([a-z_]+)'/g)].map((r) => r[1])).toEqual(['admin']);
    }
  });

  /**
   * ⛔ La guardia si cerca **nel blocco della classe**, non «da qualche parte nel file»: su
   * `pdf_templates` la stessa chiave compare anche sul metodo dell'anteprima, e un `toContain` sul
   * file intero restava verde anche togliendo la guardia di classe. Trovato provando a romperla.
   */
  it.each(AGGANCIATE_IL_5_9.filter((a) => !DUE_CHIAVI_IN_UNA_CLASSE.includes(a.file)))(
    '$chiave: la guardia sta sulla classe, e con la chiave giusta',
    ({ chiave, file, classe }) => {
      expect(decoratoriDellaClasse(leggi(file), classe)).toContain(`@RequirePage('${chiave}'`);
    },
  );

  /**
   * ⛔ **Il gesto che questa prova esiste per fermare.** Una guardia senza `@Roles` sotto rovescia
   * il fail-open: dove la guardia è l'unico cancello, un errore di lettura dei permessi diventa 403
   * per tutti invece che accesso come prima.
   */
  it('⛔ nessuna delle dieci ha perso il suo @Roles', () => {
    for (const { file, classe } of AGGANCIATE_IL_5_9) {
      expect(decoratoriDellaClasse(leggi(file), classe)).toMatch(/@Roles\(/);
    }
  });

  /**
   * ⚠️ **Due chiavi in una classe si agganciano per METODO.** `email-admin` porta `email_templates`
   * e `email_log`, `accounting` porta `accounting` e `accounting_costs`: una guardia di classe le
   * confonderebbe in una sola, che è il difetto che stiamo chiudendo rifatto un piano più sopra.
   */
  it('⛔ dove convivono due chiavi, la guardia sta sui metodi e non sulla classe', () => {
    for (const file of DUE_CHIAVI_IN_UNA_CLASSE) {
      const src = leggi(file);
      const classe = file.includes('email') ? 'EmailAdminController' : 'AccountingController';
      expect(decoratoriDellaClasse(src, classe)).not.toMatch(/@RequirePage\(/);
    }
  });

  /**
   * ⛔ **OGNI ROTTA CON LA SUA CHIAVE, SCRITTA UNA PER UNA — e il conto non basta.**
   *
   * La prima stesura contava «quante guardie, quante rotte» e chiedeva che i due numeri fossero
   * uguali. Restava verde in tre modi che ho provato apposta: togliere la guardia allo scarico
   * della fattura cifrata e metterla **due volte** sul report PDF (10 = 10); scambiare fra loro
   * `email_templates` ed `email_log` su tutte e cinque le rotte; mettere `accounting` sulla
   * cancellazione di un costo. Un conto che torna non è una porta chiusa: serve sapere **quale**
   * chiave sta su **quale** rotta, e l'unico modo è scriverlo.
   */
  const ACCOPPIAMENTO: Record<string, [string, string][]> = {
    'mail/email-admin.controller.ts': [
      ["@Get('templates')", 'email_templates'],
      ["@Post('templates')", 'email_templates'],
      ["@Patch('templates/:key')", 'email_templates'],
      ["@Get('log')", 'email_log'],
      ["@Get('log/:id')", 'email_log'],
    ],
    'commerce/accounting.controller.ts': [
      ["@Get('report')", 'accounting'],
      ["@Get('report/pdf')", 'accounting'],
      ["@Get('report/csv')", 'accounting'],
      ["@Get('payment-methods')", 'accounting_costs'],
      ["@Get('costs')", 'accounting_costs'],
      ["@Post('costs')", 'accounting_costs'],
      ["@Patch('costs/:id')", 'accounting_costs'],
      ["@Delete('costs/:id')", 'accounting_costs'],
      ["@Post('costs/:id/fattura')", 'accounting_costs'],
      ["@Get('costs/:id/fattura')", 'accounting_costs'],
      ["@Delete('costs/:id/fattura')", 'accounting_costs'],
    ],
  };

  it.each(Object.keys(ACCOPPIAMENTO))('⛔ %s: ogni rotta porta la SUA chiave, e nessuna resta scoperta', (file) => {
    const src = leggi(file);
    const atteso = ACCOPPIAMENTO[file];
    for (const [rotta, chiave] of atteso) {
      const i = src.indexOf(`\n  ${rotta}`);
      expect(i).toBeGreaterThan(-1);
      /** La guardia della rotta è la riga **subito sopra** il verbo: non «da qualche parte nel file». */
      const sopra = src.slice(0, i).split('\n').filter((r) => r.trim()).pop() ?? '';
      expect(sopra.trim()).toBe(`@RequirePage('${chiave}')`);
    }
    /** ⚠️ E non ce ne sono altre: una rotta aggiunta domani senza guardia deve far diventare rossa questa. */
    expect((src.match(/^ {2}@(Get|Post|Patch|Put|Delete)\(/gm) ?? []).length).toBe(atteso.length);
  });

  /**
   * ⛔ **Il livello scritto a mano sull'anteprima PDF.** È un `@Post` perché manda il modello nel
   * corpo, ma legge e basta: senza `'view'` la guardia dedurrebbe `manage` dal metodo HTTP e
   * chiederebbe il permesso di scrivere per guardare un'anteprima.
   */
  it('⛔ l\'anteprima PDF chiede view, non manage', () => {
    const src = leggi('pdf/pdf.controller.ts');
    const i = src.indexOf("@Post(':key/preview')");
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(0, i)).toMatch(/@RequirePage\('pdf_templates', 'view'\)\s*$/);
  });

  /**
   * ⛔ **E NON SONO USCITE DAL CONTO — la correzione della sera stessa.** La prima stesura le
   * toglieva dai buchi e il numero in pagina scendeva da 29 a 19, senza che in produzione fosse
   * cambiato niente: l'admin salta la guardia prima di leggere la matrice, quindi su una rotta
   * `@Roles('admin')` la casella continua a governare la voce di menu e non la porta. Ogni chiave
   * agganciata deve dichiararsi **inerte** finché quel `@Roles` non si allarga.
   */
  it('⛔ ognuna si dichiara inerte: la guardia c\'è, ma finché sopra c\'è solo l\'admin non decide', () => {
    for (const { chiave } of AGGANCIATE_IL_5_9) {
      expect(GUARDIA_INERTE[chiave]?.perche).toMatch(/admin/);
    }
  });

  /**
   * ⛔ **`accounting` è il caso che tiene in piedi tutta la distinzione.** Le sue rotte in
   * `admin/accounting` sono admin-only, ma la stessa chiave apre la pagina Pagamenti e
   * `admin/payments` è `@Roles('admin', 'sales')` **senza guardia**: `sales` ha `accounting` nei
   * default, quindi spegnergliela gli toglie la voce di menu e gli lascia contabili e approvazioni.
   * Deve restare fra i buchi, con scritto dove sta la porta.
   */
  it('⛔ accounting resta un buco vero, e dice dove', () => {
    expect(MOTIVO_SENZA_GUARDIA.accounting).toBe('buco');
    expect(GUARDIA_INERTE.accounting?.bucoAltrove).toMatch(/payments/);
    const src = readFileSync(join(__dirname, '..', 'commerce/commerce.controller.ts'), 'utf8');
    /** ⚠️ Il giorno che quella rotta prende la sua guardia, questa prova va rifatta insieme alla riga. */
    expect(senzaCommenti(src)).toContain("@Controller('admin/payments')");
  });
});
