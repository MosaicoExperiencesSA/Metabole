/**
 * ⛔ **CHI PUÒ RISCRIVERE UN MENU CHE UNA CLIENTE HA GIÀ IN MANO — e chi no.**
 *
 * Decisione di Simone (8/9): *«il nutrizionista sostituisce anche se il cliente ha già visto. Vince
 * su tutto»*, estesa il 9/9 alle cinque porte di Vera. Il meccanismo è una riga sola —
 * `codaDaRifare(..., { unaPersonaHaLetto: true })` — e sta tutta nel fatto che quella riga la scrive
 * **un gesto umano**: una persona che detta una frase, legge cosa comporta e dice sì.
 *
 * ⛔ **Il giorno che quella riga finisce in uno script, la decisione diventa un'altra cosa**: una
 * passata automatica che riscrive di notte il menu di chi ha appena fatto la spesa, senza che nessuno
 * abbia letto niente e senza che nessuno possa dire di no. Non ci sarebbe un errore, non ci sarebbe
 * un log: ci sarebbero delle persone davanti a un frigo pieno di roba che non serve più.
 *
 * ⚠️ **Perché un test che legge il codice sorgente, e non uno che chiama le funzioni.** La differenza
 * fra un gesto e un automatismo non sta dentro `codaDaRifare` — lì l'opzione è un booleano come un
 * altro — sta in **chi la passa**. È una proprietà dell'insieme dei chiamanti, e l'unico modo di
 * tenerla ferma è contarli. Lo stesso mestiere di `una-porta-per-i-giorni.spec.ts` e di
 * `una-regola-una-riga.spec.ts`.
 *
 * ⚠️ E l'elenco è scritto qui a mano di proposito: aggiungere una porta è legittimo, e questo test
 * diventa rosso per farla **dichiarare**. Aggiornarlo è il gesto con cui chi la aggiunge dice di
 * sapere cosa sta accendendo.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const RADICE = join(__dirname, '..', '..');

/** Tutti i `.ts` di produzione: `src/` e `prisma/`, niente prove e niente compilato. */
function filiDiProduzione(cartella: string): string[] {
  const fuori: string[] = [];
  for (const voce of readdirSync(cartella, { withFileTypes: true })) {
    const pieno = join(cartella, voce.name);
    if (voce.isDirectory()) {
      if (voce.name === 'node_modules' || voce.name === 'dist' || voce.name === 'migrations') continue;
      fuori.push(...filiDiProduzione(pieno));
    } else if (voce.name.endsWith('.ts') && !voce.name.endsWith('.spec.ts') && !voce.name.endsWith('.d.ts')) {
      fuori.push(pieno);
    }
  }
  return fuori;
}

const SORGENTI = [...filiDiProduzione(join(RADICE, 'src')), ...filiDiProduzione(join(RADICE, 'prisma'))];

/** I file che possono passare `unaPersonaHaLetto`, e la ragione per cui possono. */
const PORTE_UMANE = new Set([
  // Le quattro porte della chat: divieti, «togli lo spuntino», «più proteine», le ore del digiuno.
  // Tutte e quattro mostrano un'anteprima col numero delle giornate già aperte e aspettano un sì.
  'src/vera/vera-chat.service.ts',
  // La regola di dieta: la approva il capo nutrizionista, e la sua approvazione È la conferma.
  'src/vera/applica-proposta.ts',
  // Il posto in cui l'opzione è definita.
  'src/vera/menu-da-rifare.ts',
]);

const relativo = (p: string) => p.slice(RADICE.length + 1);

describe('⛔ «una persona ha letto» resta un GESTO: gli automatismi non ce l\'hanno', () => {
  it('⛔ nessuno script passa `unaPersonaHaLetto`', () => {
    const colpevoli = SORGENTI.filter((f) => readFileSync(f, 'utf8').includes('unaPersonaHaLetto'))
      .map(relativo)
      .filter((f) => !PORTE_UMANE.has(f));
    /**
     * ⛔ Se questo test è rosso: hai aggiunto un punto che riscrive i menu già aperti. Se è un gesto
     * umano — c'è un'anteprima che dice **quante** giornate già aperte, e un sì dopo — aggiungilo a
     * `PORTE_UMANE`. Se gira da solo, non deve avere quell'opzione: la sua strada è lasciare i giorni
     * aperti dove sono, e dirlo.
     */
    expect(colpevoli).toEqual([]);
  });

  /**
   * ⛔ **E gli script che la coda la calcolano DAVVERO restano alla regola vecchia.** Il test sopra
   * guarda chi nomina l'opzione; questo guarda i tre chiamanti automatici uno per uno, così una
   * chiamata scritta con un oggetto costruito altrove non passerebbe lo stesso.
   */
  it.each([
    ['prisma/rifai-giorni-non-sicuri.ts'],
    ['prisma/rifai-giornate-troppi-pasti.ts'],
    ['prisma/collaudo-menu-panna.ts'],
  ])('⛔ %s chiama codaDaRifare con DUE argomenti', (file) => {
    const testo = readFileSync(join(RADICE, file), 'utf8');
    const chiamate = testo.match(/codaDaRifare\([^)]*\)/gs) ?? [];
    expect(chiamate.length).toBeGreaterThan(0);
    for (const c of chiamate) expect(c).not.toContain('{');
  });

  /**
   * ⚠️ **E l'elenco delle porte umane non è più lungo di quello che il progetto ha deciso.** Cinque
   * porte, due file. Un sesto file che comparisse qui senza passare da una decisione sarebbe il modo
   * in cui «vince su tutto» si allarga da solo.
   */
  it('⚠️ le porte umane sono due file, e sono quelli', () => {
    const chiLaUsa = SORGENTI.filter((f) => readFileSync(f, 'utf8').includes('unaPersonaHaLetto: true'))
      .map(relativo)
      .sort();
    expect(chiLaUsa).toEqual(['src/vera/applica-proposta.ts', 'src/vera/vera-chat.service.ts']);
  });
});
