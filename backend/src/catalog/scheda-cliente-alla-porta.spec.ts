/**
 * ⛔ **«PUBBLICA TUTTA LA FAMIGLIA» ERA MORTA, e nessun test lo vedeva.**
 *
 * Trovato il 22/8 censendo le descrizioni delle diete, non cercando questo. `GestioneDieta.tsx`
 * pubblica una famiglia intera mandando, per ogni variante, `publish` → `{ siteVisible: true }` →
 * `{ clientVisible: true }`. Il secondo campo **non era dichiarato** in `UpdateDietProductDto`, e
 * `main.ts` valida con `whitelist: true` **e** `forbidNonWhitelisted: true`: quindi **400**.
 *
 * ⛔ Il `catch` attorno alle tre chiamate faceva il danno vero: raccoglieva l'errore, non
 * incrementava il contatore e **non mandava la terza chiamata**. Chi premeva leggeva «Completate 0
 * su 18 varianti» — e né il sito né le clienti vedevano niente. Ogni volta, non a volte.
 *
 * ## ⚠️ Perché i test non lo prendevano: nessuno passava dal DTO
 *
 * I test del catalogo chiamano il **service** con oggetti già formati. Il campo scartato non è una
 * decisione del service: è la `ValidationPipe` che lo butta prima. Un difetto che vive **fra** due
 * pezzi non si vede provando i pezzi.
 *
 * Qui si usa `class-validator` **vero**, con le stesse opzioni di `main.ts`: è l'unico modo di
 * provare che un campo passa la porta. Stessa forma di `menu/finestra-alla-porta.spec.ts`, scritto
 * il 22/8 per la stessa ragione su un altro DTO.
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CAMPI_NON_TESTO, UpdateDietProductDto, UpdateFamilyProductDto } from './dto/catalog.dto';

/**
 * Quello che fa la `ValidationPipe` di `main.ts`: `whitelist` scarta i campi non dichiarati,
 * `forbidNonWhitelisted` li trasforma in un errore invece che in un silenzio.
 */
function porta(dto: new () => object, corpo: Record<string, unknown>): string[] {
  const istanza = plainToInstance(dto, corpo);
  return validateSync(istanza as object, { whitelist: true, forbidNonWhitelisted: true })
    .flatMap((e) => Object.values(e.constraints ?? {}));
}

const allaPorta = (corpo: Record<string, unknown>) => ({ errori: porta(UpdateDietProductDto, corpo) });

describe('⛔ la scheda cliente: cosa passa dalla porta', () => {
  /**
   * ⛔ **È il difetto vero, e questa riga sarebbe stata rossa dal giorno in cui è nato.** Il corpo è
   * esattamente quello che manda `GestioneDieta.tsx`.
   */
  it('⛔ `siteVisible` passa: è la vetrina del sito, e la manda «pubblica famiglia»', () => {
    const { errori } = allaPorta({ siteVisible: true });
    expect(errori).toEqual([]);
  });

  it('⛔ e anche `clientVisible`, la terza chiamata che prima non partiva nemmeno', () => {
    expect(allaPorta({ clientVisible: true }).errori).toEqual([]);
  });

  it.each([
    ['clientName', { clientName: 'Mediterranea leggera' }],
    ['clientDescription', { clientDescription: 'Una giornata mediterranea, con più pesce.' }],
    ['highlights', { highlights: ['Tanto pesce', 'Poca carne rossa'] }],
    ['seasonalTag', { seasonalTag: 'estate' }],
    ['objective', { objective: 'mantenimento' }],
    ['recommended', { recommended: true }],
  ])('⚠️ «%s» passa', (_nome, corpo) => {
    expect(allaPorta(corpo).errori).toEqual([]);
  });

  /**
   * ⛔ **E la porta deve restare stretta.** `whitelist` esiste perché una `PATCH` scritta a mano non
   * possa toccare campi che questa rotta non governa: `status`, `approvedById`, `levels`. Se questo
   * test diventasse verde su uno di quelli, la scheda cliente sarebbe diventata una porta sul
   * catalogo intero.
   */
  it.each([['status'], ['approvedById'], ['levels'], ['name'], ['mealsPerDay']])(
    '⛔ «%s» NON passa da questa rotta',
    (campo) => {
      const { errori } = allaPorta({ [campo]: 'qualcosa' });
      expect(errori.join(' ')).toContain(campo);
    },
  );

  /** ⚠️ Il tetto sulla descrizione è dichiarato: 400 caratteri, e oltre si dice. */
  it('⚠️ una descrizione troppo lunga viene rifiutata, non troncata', () => {
    const { errori } = allaPorta({ clientDescription: 'x'.repeat(401) });
    expect(errori.join(' ')).toContain('clientDescription');
  });

  it('⚠️ a 400 esatti passa', () => {
    expect(allaPorta({ clientDescription: 'x'.repeat(400) }).errori).toEqual([]);
  });

  /**
   * ⚠️ **Un corpo vuoto non è un errore**: `GestioneDieta` manda un campo per volta, e una PATCH
   * senza campi non deve rompere — non cambia niente ed è il caso di chi salva senza toccare.
   */
  it('⚠️ corpo vuoto: nessun errore', () => {
    expect(allaPorta({}).errori).toEqual([]);
  });
});

/**
 * ⛔ **LA PORTA DEL DTO *FAMIGLIA* — quella dove i campi di vetrina NON devono passare.**
 *
 * La rotta per famiglia scrive su tutte e diciotto le varianti in un colpo. Accendere diciotto diete
 * insieme è la cosa che non deve poter succedere per sbaglio, e il DTO è il primo dei due strati che
 * lo impedisce — il secondo è il service, provato in `scheda-cliente-famiglia.spec.ts`.
 *
 * ⚠️ La prima stesura di questo file provava solo l'altro DTO: la garanzia più importante era
 * scritta nel commento e in nessun test.
 */
describe('⛔ la scheda cliente per FAMIGLIA: la porta è più stretta', () => {
  const base = { famiglia: 'Mediterranea', stile: 'mediterranean' };

  it('⚠️ il caso normale passa', () => {
    expect(porta(UpdateFamilyProductDto, { ...base, clientDescription: 'Un testo.' })).toEqual([]);
  });

  it.each([['clientVisible'], ['siteVisible'], ['recommended'], ['objective']])(
    '⛔ «%s» NON passa da qui, nemmeno per il capo',
    (campo) => {
      expect(porta(UpdateFamilyProductDto, { ...base, [campo]: true }).join(' ')).toContain(campo);
    },
  );

  /** ⛔ E la famiglia va detta: senza, si scriverebbe su un insieme che nessuno ha scelto. */
  it.each([['famiglia'], ['stile']])('⛔ «%s» è obbligatorio', (campo) => {
    const corpo: Record<string, unknown> = { ...base, clientDescription: 'x' };
    delete corpo[campo];
    expect(porta(UpdateFamilyProductDto, corpo).join(' ')).toContain(campo);
  });

  /** ⚠️ `null` passa, e vuol dire «svuota»: una descrizione sbagliata si deve poter togliere. */
  it('⚠️ `null` passa: è come si svuota un campo', () => {
    expect(porta(UpdateFamilyProductDto, { ...base, clientDescription: null })).toEqual([]);
  });
});

/**
 * ⛔ **L'ELENCO DEI CAMPI CHE NON SONO TESTO SI AGGIORNA DA SÉ? No — quindi lo tiene fermo un test.**
 *
 * `CAMPI_NON_TESTO` decide cosa la nutrizionista **non** può cambiare. `satisfies keyof` impedisce
 * un nome scritto male, ma non che un campo **nuovo** venga dimenticato: il giorno che qualcuno
 * aggiunge `homepageVisible?: boolean` al DTO e non tocca la costante, la nutrizionista lo accende
 * e niente diventa rosso.
 *
 * ⚠️ La regola: **ogni booleano del DTO è un interruttore**, e gli interruttori sono del capo. Se un
 * giorno nascesse un booleano che è davvero testo, si cambia questa regola con una riga che dice
 * perché — invece di scoprire in produzione che una dieta si è accesa da sola.
 */
describe('⛔ ogni interruttore del DTO è nell\'elenco del capo', () => {
  const BOOLEANI = ['clientVisible', 'siteVisible', 'recommended'];

  it.each(BOOLEANI)('⛔ «%s» è fra i campi non-testo', (campo) => {
    expect([...CAMPI_NON_TESTO]).toContain(campo);
  });

  /** ⚠️ E i campi di testo NON ci sono: se ci finissero, la nutrizionista non potrebbe più scrivere. */
  it.each([['clientName'], ['clientDescription'], ['highlights'], ['seasonalTag']])(
    '⚠️ «%s» resta scrivibile',
    (campo) => {
      expect([...CAMPI_NON_TESTO]).not.toContain(campo);
    },
  );

  /**
   * ⛔ **`objective` c'è, e non è un booleano.** Non è vetrina: `pick-diet.ts` ci filtra sopra,
   * quindi cambiarlo sposta **a chi il motore assegna** quella dieta. Ci era passato dentro
   * silenziosamente aprendo la rotta alla nutrizionista.
   */
  it('⛔ «objective» è del capo, perché decide a chi va la dieta', () => {
    expect([...CAMPI_NON_TESTO]).toContain('objective');
  });
});
