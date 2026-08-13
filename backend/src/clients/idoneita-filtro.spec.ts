/**
 * IL FILTRO «SOLO DA VALUTARE» DEVE DIRE LA STESSA COSA DELLA FUNZIONE.
 *
 * `daValutare()` guarda una cliente in mano; `filtroDaValutare()` è la stessa domanda scritta per
 * Postgres, perché l'elenco pagina, conta ed esporta e quindi deve scegliere le righe prima di
 * leggerle. Due espressioni della stessa regola.
 *
 * ⚠️ Il guasto da cui difende questo file non è un errore di sintassi — quello lo trova il
 * type-check. È la **divergenza silenziosa**: qualcuno aggiunge un motivo per essere valutate, lo
 * scrive nella funzione e non nel filtro, e la nutrizionista continua a vedere una coda che le
 * sembra completa. Nessun errore, nessun sintomo, e la cliente che manca è proprio quella che
 * nessuno ha ancora guardato.
 *
 * Per confrontarle serve applicare il frammento Prisma a un profilo finto: `valuta()` qui sotto
 * capisce **solo** i tre operatori che il filtro usa davvero (`AND`, `OR`, `isEmpty`, uguaglianza).
 * Se un giorno il filtro ne usa un quarto, `valuta` solleva invece di rispondere a caso — un
 * confronto che non sa cosa sta confrontando è peggio di nessun confronto.
 */
import { daValutare, filtroDaValutare } from './idoneita';

type Profilo = { allergies?: string[] | null; idoneita?: string | null; screeningFlag?: boolean | null };

/** Il minimo dialetto Prisma che serve a questo filtro, e niente di più. */
function valuta(cond: Record<string, unknown>, p: Profilo): boolean {
  return Object.entries(cond).every(([chiave, atteso]) => {
    if (chiave === 'AND') return (atteso as Record<string, unknown>[]).every((c) => valuta(c, p));
    if (chiave === 'OR') return (atteso as Record<string, unknown>[]).some((c) => valuta(c, p));
    if (chiave === 'allergies') {
      const op = atteso as { isEmpty?: boolean };
      if (typeof op?.isEmpty !== 'boolean') throw new Error('operatore su `allergies` non previsto: ' + JSON.stringify(op));
      // In banca dati la colonna è `String[] @default([])`: mai NULL. `null` qui è solo il tipo TS.
      return ((p.allergies ?? []).length === 0) === op.isEmpty;
    }
    if (chiave === 'idoneita') return (p.idoneita ?? null) === atteso;
    if (chiave === 'screeningFlag') return (p.screeningFlag ?? false) === atteso;
    throw new Error('campo non previsto nel filtro: ' + chiave);
  });
}

/**
 * I casi: gli stessi cinque di `idoneita.spec.ts` (elenco e scheda) più quelli che solo il filtro
 * può sbagliare — la stringa vuota, lo screening senza allergie, il profilo appena creato.
 */
const CASI: Profilo[] = [
  { allergies: ['latte'], idoneita: null, screeningFlag: false },
  { allergies: [], idoneita: null, screeningFlag: true },
  { allergies: ['latte'], idoneita: 'idonea', screeningFlag: true },
  { allergies: ['latte'], idoneita: 'serve_visita', screeningFlag: false },
  { allergies: [], idoneita: null, screeningFlag: false },
  { allergies: ['latte', 'uova'], idoneita: '', screeningFlag: false },
  { allergies: [], idoneita: 'idonea', screeningFlag: false },
  { allergies: ['soia'], idoneita: null, screeningFlag: true },
  {},
];

describe('il filtro dell\'elenco e la funzione della scheda', () => {
  it('⚠️ rispondono uguale su ogni caso, o l\'elenco mente sulla coda', () => {
    const filtro = filtroDaValutare();
    for (const c of CASI) {
      expect({ caso: c, risposta: valuta(filtro, c) }).toEqual({ caso: c, risposta: daValutare(c) });
    }
  });

  it('e almeno un caso per parte: un confronto sempre vero non verifica niente', () => {
    const filtro = filtroDaValutare();
    const risposte = CASI.map((c) => valuta(filtro, c));
    expect(risposte).toEqual([true, true, false, false, false, true, false, true, false]);
  });

  it('⚠️ una decisione già presa NON torna in coda — nemmeno «serve una visita»', () => {
    // È la differenza con la segnalazione clinica, che dopo quattordici giorni si riapriva: qui
    // riproporla vorrebbe dire rimandare davanti alla nutrizionista una cliente che ha già visto.
    const filtro = filtroDaValutare();
    expect(valuta(filtro, { allergies: ['latte'], idoneita: 'serve_visita' })).toBe(false);
    expect(valuta(filtro, { allergies: ['latte'], idoneita: 'idonea' })).toBe(false);
  });

  it('il filtro guarda solo i campi che ci si aspetta', () => {
    // Se un giorno ne comparisse un terzo, `valuta` solleverebbe invece di rispondere a caso.
    expect(JSON.stringify(filtroDaValutare())).toMatch(/idoneita.*allergies.*screeningFlag/);
  });
});
