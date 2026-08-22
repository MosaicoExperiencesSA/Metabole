/**
 * ⛔ **I TESTI DELLE ATTIVITÀ SI LEGGONO COME TESTO SEMPLICE — quindi si scrivono come testo
 * semplice.**
 *
 * Trovato il 22/8 **guardando la pagina vera**, non deducendolo: nell'elenco della nutrizionista si
 * leggeva «⚠️ \*\*È già partita, ed è voluto\*\*: la scelta della finestra è libera». Gli asterischi
 * erano lì, in mezzo alla frase, su un'attività che chiede una valutazione clinica.
 *
 * `AttivitaCoach.tsx` disegna la descrizione come `{t.description}` dentro un `<div>`: nessun
 * markdown, nessun `dangerouslySetInnerHTML`, e va benissimo così — una descrizione che arriva dal
 * backend e viene interpretata come HTML sarebbe un problema molto più grosso di un grassetto
 * mancante. Il difetto è nei **testi**, che scrivevano markdown a un lettore che non lo legge.
 *
 * ⚠️ **Perché nessun test lo vedeva.** I test dei singoli moduli controllano che una frase *ci sia*
 * (`toContain('la sposta lei')`): con gli asterischi attorno la frase c'è lo stesso. Nessuno
 * guardava il testo **come lo legge una persona**. Questo file lo fa per i sei testi delle
 * **attività**, così un settimo non può reintrodurlo.
 *
 * ⛔ **E solo per quelli: il difetto è vivo altrove, misurato.** Lo stesso markdown non interpretato
 * sta in decine di testi che leggono le **clienti** — `chat/allergie-chat.ts` («Hai qualche
 * \*\*allergia\*\* alimentare?»), `menu/senza-glutine.ts`, `vera/vera-chat.ts`,
 * `menu/cambio-piatto.ts` e altri. In tutto il progetto non esiste nessun renderer markdown, quindi
 * quelle stringhe si leggono con gli asterischi dentro. ⚠️ Non è stato chiuso qui perché sono
 * decine di testi su tre superfici diverse (chat dell'app, notifiche, email): sta a elenco lavori,
 * dichiarato invece che lasciato credere coperto.
 *
 * ⛔ **Gli `\n` invece restano e sono voluti**: l'elenco dei motivi va a capo, e da oggi la pagina
 * li rispetta (`whiteSpace: 'pre-wrap'`). Un test qui sotto pretende che quella proprietà resti,
 * perché senza di lei quei ritorni a capo diventano spazi e due paragrafi diventano un muro.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { testoDigiunoEstremo, testoFinestraNonTraducibile } from './verifica-digiuno';
import { testoPastiNonServiti } from './pasti-non-serviti';
import { testoKcalCorte } from './kcal-restano-corte';
import { testoFinestraMaiChiesta } from './finestra-mai-chiesta';
import { testoEsclusioniDaChiarire } from './esclusioni-da-chiarire';

/**
 * Ogni testo con un caso d'esempio realistico. ⚠️ Non è un elenco di nomi: sono le funzioni
 * **chiamate**, perché il markdown può stare in un ramo condizionale che un elenco non attraversa.
 */
const TESTI: [string, { title: string; description: string }][] = [
  [
    'digiuno estremo',
    testoDigiunoEstremo('Antonio', ['Ha scelto il 20:4 (Esperto)'], 'un digiuno 20:4 dalle 19:00'),
  ],
  ['finestra non traducibile', testoFinestraNonTraducibile('Sonia', 'Prima saltava la cena.')],
  ['pasti non serviti', testoPastiNonServiti('Lorena', ['Colazione'], 'Flexitariana')],
  [
    'kcal corte',
    testoKcalCorte('Maria', { data: '2026-08-22', quota: 0.68, alTetto: ['lunch'] }, 3,
      { finestra: 'skip_breakfast', pastiEsclusi: [] }, { kcal: 1850, fonte: 'need' }),
  ],
  ['finestra mai chiesta', testoFinestraMaiChiesta('Ilaria', 'skip_breakfast', 'salta la colazione')],
  ['esclusioni da chiarire', testoEsclusioniDaChiarire('Giulia', ['niente formaggi stagionati'])],
  /**
   * ⛔ **I RAMI, non solo le funzioni** (aggiunto in revisione, 22/8). La prima stesura chiamava
   * ogni testo **una volta**, e il commento sopra si vantava di attraversare i rami: falso. Un `**`
   * messo nel ramo «catalogo» di `SPIEGAZIONE`, o nel ramo «non ha mai avuto una finestra», sarebbe
   * passato con il file verde e la frase «guardati tutti e sei».
   */
  ['finestra mai chiesta, senza finestra', testoFinestraMaiChiesta('Ilaria', null, null)],
  [
    'kcal corte, causa catalogo e nessun tetto',
    testoKcalCorte('Maria', { data: '2026-08-22', quota: 0.8, alTetto: [] }, 1,
      { finestra: null, pastiEsclusi: [] }, { kcal: 1700, fonte: 'level' }),
  ],
  [
    'kcal corte, finestra e spuntini',
    testoKcalCorte('Maria', { data: '2026-08-22', quota: 0.7, alTetto: ['lunch', 'dinner'] }, 2,
      { finestra: 'skip_breakfast', pastiEsclusi: ['morning_snack'] }, { kcal: 1700, fonte: 'need' }),
  ],
  [
    'kcal corte, solo spuntini tolti',
    testoKcalCorte(null, { data: '2026-08-22', quota: 0.75, alTetto: [] }, 1,
      { finestra: null, pastiEsclusi: ['afternoon_snack'] }, { kcal: 1700, fonte: 'need' }),
  ],
  ['pasti non serviti, più di uno', testoPastiNonServiti(null, ['Colazione', 'Spuntino'], null)],
  ['digiuno estremo, senza nome', testoDigiunoEstremo(null, ['Ha scelto il 23:1'], 'un digiuno 23:1')],
];

describe('⛔ niente markdown nei testi che legge la nutrizionista', () => {
  it.each(TESTI)('«%s»: nessun asterisco, né nel titolo né nella descrizione', (_nome, t) => {
    expect(t.title).not.toContain('*');
    expect(t.description).not.toContain('*');
  });

  /**
   * ⚠️ **Sei testi, non cinque: si contano.** Un `it.each` su un elenco è forte quanto l'elenco —
   * se domani nasce un settimo testo e nessuno lo aggiunge qui, il file resta verde dicendo di aver
   * guardato tutto. Questa riga almeno fa scattare la domanda.
   */
  it('⚠️ i casi guardati sono dodici, e coprono i rami (se ne nasce un altro, aggiungilo)', () => {
    expect(TESTI).toHaveLength(12);
  });

  /**
   * ⚠️ **E la prova che i casi attraversano davvero rami diversi**: se tutte le descrizioni fossero
   * uguali, dodici chiamate proverebbero quanto una.
   */
  it('⚠️ i dodici casi non sono lo stesso testo dodici volte', () => {
    const diverse = new Set(TESTI.map(([, t]) => t.description));
    expect(diverse.size).toBeGreaterThanOrEqual(8);
  });
});

/**
 * ⛔ **E i ritorni a capo la pagina li deve rispettare.**
 *
 * `testoDigiunoEstremo` scrive «Perché ti arriva:» e poi un elenco puntato, uno per riga. Senza
 * `white-space: pre-wrap` quei `\n` diventano spazi e l'elenco si appiattisce in un muro di testo —
 * che è esattamente com'era in pagina il 22/8, accanto agli asterischi.
 */
describe('⛔ la pagina rispetta i ritorni a capo', () => {
  const pagina = readFileSync(
    join(__dirname, '..', '..', '..', 'backoffice', 'src', 'pages', 'AttivitaCoach.tsx'),
    'utf8',
  );

  it('il file si legge (se no il test sotto non prova niente)', () => {
    expect(pagina).toContain('t.description');
  });

  it('⛔ la descrizione è disegnata con «pre-wrap»', () => {
    expect(pagina).toMatch(/whiteSpace:\s*'pre-wrap'/);
  });

  /** ⚠️ E l'elenco dei motivi va davvero a capo: se un giorno diventasse una riga sola, si perde. */
  it('⚠️ il testo del digiuno estremo manda a capo i motivi', () => {
    const t = testoDigiunoEstremo('Antonio', ['Ha scelto il 20:4', 'Digiuna da poco'], 'un digiuno 20:4');
    expect(t.description).toContain('\n• Ha scelto il 20:4\n• Digiuna da poco');
  });
});
