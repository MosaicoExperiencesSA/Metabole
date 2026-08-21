/**
 * ⛔ **LE QUATTRO PORTE CHE TOLGONO UNA CLIENTE DAL DIGIUNO — e l'elenco che devono seguire tutte.**
 *
 * Il 21/8, in revisione, tre delle quattro erano già divergenti: lo script azzerava solo
 * `fastingWindow`, il profilo della cliente non azzerava niente, e la scheda staff aveva l'elenco
 * giusto dietro una guardia che guardava il campo sbagliato. Non era distrazione: sette nomi copiati
 * in quattro punti divergono per costruzione.
 *
 * ⚠️ I test qui sotto sono di due tipi, ed è voluto:
 *  - sul **modulo**, che è puro e si prova per davvero;
 *  - sul **sorgente delle quattro porte**, perché «hanno usato l'elenco condiviso invece di
 *    riscriverlo» non è un comportamento raggiungibile da un test: è una riga di codice, e la si
 *    guarda dove sta. Stessa scelta di `common/mese-uno-solo.spec.ts`.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  COLONNE_OROLOGIO,
  SELECT_OROLOGIO,
  orologioAzzerato,
  restaQualcosaDellOrologio,
} from './uscita-dal-digiuno';

describe('l\'elenco delle colonne dell\'orologio', () => {
  it('sono sette, e si dicono per nome', () => {
    expect([...COLONNE_OROLOGIO].sort()).toEqual([
      'fastingChangedAt', 'fastingProtocol', 'fastingSceltoIl', 'fastingStartMin',
      'fastingTargetProtocol', 'fastingTargetStartMin', 'fastingWindow',
    ]);
  });

  /**
   * ⛔ **`fastingSceltoIl` fra queste, e non è una colonna come le altre.** È la memoria della
   * domanda: finché è pieno la pagina dell'orologio non si riapre. Sopravvissuto a un giro fuori dal
   * digiuno, al ritorno la cliente non si vede chiedere niente e si ritrova la finestra di sei mesi
   * prima. È il difetto da cui è nata tutta questa parte.
   */
  it('⛔ `fastingSceltoIl` c\'è: è la memoria della domanda', () => {
    expect(COLONNE_OROLOGIO).toContain('fastingSceltoIl');
  });

  it('`orologioAzzerato` mette a null tutte e sette, e nient\'altro', () => {
    expect(orologioAzzerato()).toEqual({
      fastingWindow: null, fastingProtocol: null, fastingStartMin: null,
      fastingTargetStartMin: null, fastingTargetProtocol: null,
      fastingSceltoIl: null, fastingChangedAt: null,
    });
  });

  /**
   * ⚠️ Un oggetto **nuovo** ogni volta. Una costante condivisa finirebbe dentro un `data` di Prisma,
   * e il primo chiamante che ci scrive sopra la sporca per tutti gli altri del processo.
   */
  it('⚠️ torna un oggetto nuovo: non è una costante da sporcare', () => {
    const a = orologioAzzerato();
    const b = orologioAzzerato();
    expect(a).not.toBe(b);
    (a as Record<string, unknown>).fastingWindow = 'skip_dinner';
    expect(b.fastingWindow).toBeNull();
  });

  it('`SELECT_OROLOGIO` chiede a Prisma esattamente quelle sette', () => {
    expect(Object.keys(SELECT_OROLOGIO).sort()).toEqual([...COLONNE_OROLOGIO].sort());
    expect(Object.values(SELECT_OROLOGIO).every((v) => v === true)).toBe(true);
  });
});

describe('⛔ resta qualcosa dell\'orologio?', () => {
  it('un profilo pulito: no', () => {
    expect(restaQualcosaDellOrologio({ pathType: 'five', fastingWindow: null })).toBe(false);
    expect(restaQualcosaDellOrologio({})).toBe(false);
  });

  it.each([[null], [undefined]])('niente profilo (%s): no, e non lancia', (p) => {
    expect(restaQualcosaDellOrologio(p as never)).toBe(false);
  });

  it.each([...COLONNE_OROLOGIO])('basta %s scritta perché la risposta sia sì', (colonna) => {
    expect(restaQualcosaDellOrologio({ [colonna]: 'x' })).toBe(true);
  });

  /**
   * ⛔ **Lo stato che la guardia vecchia non vedeva.** `prima !== null` guardava solo
   * `fastingWindow`: con la finestra già vuota e l'orologio ancora scritto — proprio quello che lo
   * script sapeva creare — la riparazione non partiva. Cioè non partiva nel caso peggiore.
   */
  it('⛔ finestra vuota ma orologio scritto: sì (era il buco)', () => {
    expect(restaQualcosaDellOrologio({
      fastingWindow: null, fastingProtocol: '16:8', fastingStartMin: 720, fastingSceltoIl: new Date(),
    })).toBe(true);
  });

  /**
   * ⚠️ `0` è la **mezzanotte**, un orario vero, e `''` è una stringa scritta. Il confronto è con
   * `null`/`undefined`, non con la verità di JavaScript — che qui direbbe «non c'è niente».
   */
  it.each([
    ['la mezzanotte come apertura', { fastingStartMin: 0 }],
    ['una stringa vuota', { fastingWindow: '' }],
  ])('⚠️ %s conta come «scritto»', (_titolo, profilo) => {
    expect(restaQualcosaDellOrologio(profilo)).toBe(true);
  });
});

/**
 * ⛔ **E le quattro porte lo usano, invece di riscriverlo.** Il test guarda il sorgente: sette `null`
 * copiati a mano non danno errore da nessuna parte — danno una colonna dimenticata, sei mesi dopo,
 * su una cliente sola.
 */
describe('⛔ le quattro porte seguono l\'elenco condiviso', () => {
  const RADICE = join(__dirname, '..', '..');
  const PORTE = [
    ['scheda staff', join(RADICE, 'src', 'clients', 'clients.service.ts')],
    ['questionario', join(RADICE, 'src', 'onboarding', 'onboarding.service.ts')],
    ['profilo della cliente', join(RADICE, 'src', 'profile', 'profile.service.ts')],
    ['script sposta-percorso', join(RADICE, 'prisma', 'sposta-percorso-cliente.ts')],
  ] as const;

  it.each(PORTE)('%s chiama `orologioAzzerato()`', (_nome, file) => {
    expect(readFileSync(file, 'utf8')).toContain('orologioAzzerato()');
  });

  /**
   * ⚠️ E nessuna se lo riscrive di fianco. Si cerca la **coppia** che tradisce una copia a mano:
   * `fastingSceltoIl` messo a `null` esplicitamente in un file che l'elenco condiviso ce l'ha già.
   * ⛔ `clients.service` è escluso a ragion veduta: là `fastingSceltoIl: null` è la **condizione di
   * ricerca** di chi non ha ancora scelto, non una scrittura.
   */
  it.each(PORTE.filter(([nome]) => nome !== 'scheda staff'))(
    '⚠️ %s non riscrive l\'elenco a mano di fianco',
    (_nome, file) => {
      const testo = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
      expect(testo).not.toMatch(/fastingSceltoIl\s*:\s*null/);
    },
  );
});
