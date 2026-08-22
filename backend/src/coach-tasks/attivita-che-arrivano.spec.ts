/**
 * ⛔ **UN'ATTIVITÀ CHE NON ARRIVA A CHI PUÒ CHIUDERLA È LAVORO NON FATTO, con in più l'illusione
 * di averlo fatto.**
 *
 * Questo file tiene ferme le **quattro** condizioni che devono valere insieme perché uno dei tipi
 * della nutrizionista le arrivi davvero. Nasce il 22/8, in revisione, dopo che due di queste quattro
 * erano rotte contemporaneamente e nessun test se ne accorgeva:
 *
 *  1. il tipo è in `TIPI_DELLA_NUTRIZIONISTA` (decide **la push**);
 *  2. il suo ruolo è fra quelli del controller (decide **se la porta si apre**);
 *  3. il suo ruolo ha il permesso di pagina `coach_tasks` (decide **se il guardiano la fa entrare**);
 *  4. l'elenco che legge è filtrato ai suoi tipi e alle sue clienti (decide **cosa vede dentro**).
 *
 * ⛔ **Le due che erano rotte.** (a) `TIPI_DELLA_NUTRIZIONISTA` conteneva
 * `'finestra_digiuno_non_traducibile'` mentre il tipo vero è `digiuno_finestra_non_traducibile` —
 * le prime due parole scambiate, ricopiate a mano in quattro punti, **test compreso**. (b) Il
 * controller non aveva il suo ruolo e il permesso di pagina era spento: dal 21/8 la push le diceva
 * «la trovi in Dashboard» e la Dashboard rispondeva 403.
 *
 * ⚠️ Il motivo per cui nessun test le vedeva è che i test esistenti **ricopiavano le stringhe**
 * invece di importare le costanti, e guardavano un pezzo per volta. Qui si guardano insieme, e si
 * importa tutto.
 *
 * ⛔ **Quello che questo file NON fa, dichiarato.** Non è una rete automatica per un tipo *nuovo*:
 * i test sui ruoli e sui permessi girano su `RUOLI_NUTRIZIONISTA`, non sui tipi, quindi aggiungendo
 * un quinto `kind` l'unico che si accende è «sono esattamente quattro» — e si zittisce aggiungendo
 * una riga a `I_QUATTRO`. Chi lo fa deve ripassare le quattro condizioni a mano. ⚠️ E la quarta (il
 * filtro di `list`) è provata in `chi-vede-le-attivita.spec.ts`, non qui.
 *
 * La prima stesura di questa nota prometteva che «se una delle quattro condizioni manca, questo
 * file diventa rosso». Non era vero, ed è esattamente il tipo di frase che fa saltare il controllo a
 * chi legge: *una ragione falsa è peggio di un ordine sbagliato.*
 */
import { TIPI_DELLA_NUTRIZIONISTA } from './avvisi-attivita';
import { TIPO_DIGIUNO_ESTREMO, TIPO_FINESTRA_NON_TRADUCIBILE } from './verifica-digiuno';
import { TIPO_PASTI_NON_SERVITI } from './pasti-non-serviti';
import { TIPO_KCAL_CORTE } from './kcal-restano-corte';
import { RUOLI_NUTRIZIONISTA } from '../common/ruoli-nutrizionista';
import { DEFAULT_PERMISSIONS } from '../permissions/pages';
import { CoachTasksController } from './coach-tasks.controller';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { readFileSync } from 'fs';
import { join } from 'path';

/** I quattro tipi, con la costante che li produce. ⚠️ Costanti, mai stringhe scritte a mano. */
const I_QUATTRO: [string, string][] = [
  ['digiuno estremo', TIPO_DIGIUNO_ESTREMO],
  ['finestra non traducibile', TIPO_FINESTRA_NON_TRADUCIBILE],
  ['pasti non serviti', TIPO_PASTI_NON_SERVITI],
  ['calorie che restano corte', TIPO_KCAL_CORTE],
];

describe('⛔ i tipi della nutrizionista: l\'elenco e le costanti sono la stessa cosa', () => {
  it.each(I_QUATTRO)('«%s» è nell\'elenco', (_titolo, kind) => {
    expect(TIPI_DELLA_NUTRIZIONISTA.has(kind)).toBe(true);
  });

  /**
   * ⛔ **Nessun tipo di troppo.** L'elenco decide anche cosa lei vede in pagina: un tipo in più qui
   * è un'attività della coach che finisce nella sua colonna, e che lei può chiudere al posto suo.
   */
  it('⛔ e sono esattamente quattro, non cinque', () => {
    expect([...TIPI_DELLA_NUTRIZIONISTA].sort()).toEqual(I_QUATTRO.map(([, k]) => k).sort());
  });

  /**
   * ⛔ **La parola scambiata.** È il difetto vero trovato il 22/8: la stringa esisteva, sembrava
   * giusta, e non corrispondeva a niente di quello che il codice scrive in banca dati.
   */
  it('⛔ «digiuno_finestra_non_traducibile», non «finestra_digiuno_non_traducibile»', () => {
    expect(TIPO_FINESTRA_NON_TRADUCIBILE).toBe('digiuno_finestra_non_traducibile');
    expect(TIPI_DELLA_NUTRIZIONISTA.has('finestra_digiuno_non_traducibile')).toBe(false);
  });

  /** ⚠️ E le attività della coach restano della coach. */
  it.each([['measures_missing'], ['finestra_digiuno_mai_chiesta'], ['pause_regain'], ['trial_g1_welcome']])(
    '⚠️ «%s» NON è della nutrizionista',
    (kind) => {
      expect(TIPI_DELLA_NUTRIZIONISTA.has(kind)).toBe(false);
    },
  );
});

describe('⛔ la porta: i suoi ruoli entrano nel controller', () => {
  /**
   * ⛔ Legge il metadato vero del decoratore `@Roles`, non una copia: un elenco ricopiato in un test
   * prova solo che due persone hanno sbagliato insieme — è la lezione del 22/8.
   */
  const ruoliDelControllore: string[] = Reflect.getMetadata(ROLES_KEY, CoachTasksController) ?? [];

  it('il controller dichiara dei ruoli (se no il test sotto non prova niente)', () => {
    expect(ruoliDelControllore.length).toBeGreaterThan(0);
  });

  it.each([...RUOLI_NUTRIZIONISTA])('⛔ «%s» è fra i ruoli ammessi', (ruolo) => {
    expect(ruoliDelControllore).toContain(ruolo);
  });

  /** ⚠️ E la coach non l'ha persa per strada: questa consegna aggiunge, non sposta. */
  it.each([['coach'], ['coach_coordinator'], ['sales'], ['admin']])('⚠️ «%s» c\'è ancora', (ruolo) => {
    expect(ruoliDelControllore).toContain(ruolo);
  });
});

describe('⛔ il guardiano: il permesso di pagina «coach_tasks»', () => {
  /**
   * ⛔ Entrare nel controller non basta: `PageGuard` guarda `role_page_permission`, e usa questi
   * default quando la riga non c'è. ⚠️ Per le righe **già scritte** in un ambiente vivo il default
   * non basta e serve `npm run apri:attivita-nutrizionista` — sta scritto nel controller.
   */
  it.each([...RUOLI_NUTRIZIONISTA])('⛔ «%s» vede e gestisce la pagina', (ruolo) => {
    const p = DEFAULT_PERMISSIONS[ruolo]?.coach_tasks;
    expect(p?.view).toBe(true);
    expect(p?.manage).toBe(true);
  });
});

/**
 * ⛔ **L'ICONA — la quarta cosa che si dimentica.**
 *
 * `KIND_ICON` in `AttivitaCoach.tsx` ripiega su `ti-checklist` per i tipi che non conosce: un tipo
 * nuovo esce **identico a una telefonata della prova**, in una colonna dove ora convivono il lavoro
 * di due ruoli. Non è un guasto, è un travestimento — e non si accende da nessuna parte.
 *
 * ⚠️ Legge il sorgente del backoffice perché è in un altro pacchetto: qui non si può importare.
 */
describe('⛔ ogni tipo ha la sua icona in pagina', () => {
  const sorgente = readFileSync(
    join(__dirname, '..', '..', '..', 'backoffice', 'src', 'pages', 'AttivitaCoach.tsx'),
    'utf8',
  );

  it('il file si legge (se no il test sotto non prova niente)', () => {
    expect(sorgente).toContain('KIND_ICON');
  });

  it.each(I_QUATTRO)('⛔ «%s» ha un\'icona sua, non il segnaposto', (_titolo, kind) => {
    expect(sorgente).toMatch(new RegExp(`\\b${kind}\\s*:\\s*'ti-`));
  });
});
