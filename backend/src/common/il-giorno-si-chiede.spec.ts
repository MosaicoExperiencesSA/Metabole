import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ⚠️ **DOVE È GIÀ STATO CORRETTO, «CHE GIORNO È OGGI» SI CHIEDE — NON SI CALCOLA.**
 *
 * Come `mese-uno-solo.spec.ts` e `nutrient-facts/una-porta-sola.spec.ts`, questo test guarda il
 * **sorgente**. Serve perché il difetto del 20/8 non stava dentro una funzione: stava in una
 * trentina di punti che si calcolavano «oggi» per conto loro, con `setHours(0, 0, 0, 0)` (il fuso
 * del **processo**, UTC su Render) o con `Date.UTC(d.getUTC…)`. Fra mezzanotte e le 02:00 in Italia
 * rispondevano tutti **ieri**, e nessun confronto fra due di loro poteva rivelarlo perché
 * sbagliavano insieme.
 *
 * ⚠️ **L'elenco qui sotto NON è tutto il progetto**: è quello che è stato corretto e verificato, un
 * pezzo per volta. Restano fuori l'analitica, i report, il marketing e gli agenti — dove un giorno
 * spostato cambia un grafico, non quello che una persona riceve. Aggiungere un file qui è il modo
 * di dichiarare «questo l'ho guardato», e va fatto **dopo** averlo guardato, non prima.
 *
 * ⛔ E resta fuori, di proposito, l'altra metà del problema: il giorno di una data **salvata** si
 * continua a leggere in UTC. Quelle sono istanti veri in banca dati, e rileggerli in un altro fuso
 * sposterebbe di un giorno piani e prove già vendute. Si misura con `npm run diag:giorno-piani`,
 * poi si decide. Per questo `Date.UTC(` non è fra le formule vietate: nei file qui sotto è la
 * risposta **giusta** alla seconda domanda.
 */
const PERIMETRO = [
  // I soldi
  'common/tetto-compensi.ts',
  'payouts/payouts.service.ts',
  'compensation/compensation.controller.ts',
  'commerce/finance.service.ts',
  // Chi sta ricevendo un menu
  'commerce/abbonamento-in-corso.ts',
  'commerce/stati-abbonamento.ts',
  'common/piano-attivo.ts',
  'clients/clients.service.ts',
  // Le attività della coach
  'coach-tasks/coach-tasks.service.ts',
  'coach-tasks/avvisi-attivita.ts',
  'coach-tasks/porta-delle-attivita.ts',
  // Date che una persona legge o subisce
  'privacy/cancellazione.ts',
  'menu/correzione-kcal.ts',
  'pause/pause.service.ts',
  'menu/senza-glutine.ts',
  'vera/menu-da-rifare.ts',
  'monitoring/monitoring.service.ts',
];

/**
 * Le due formule che dicono «me lo calcolo io» a partire da **adesso**.
 *
 * ⚠️ `setHours(0, 0, 0, 0)` è la peggiore delle due perché sembra innocua: legge il fuso del
 * processo, quindi in locale su un Mac italiano dà la risposta giusta e su Render no. Un difetto
 * che si comporta bene sulla macchina di chi lo scrive è un difetto che nessuno trova.
 */
const VIETATE: { cerca: RegExp; nome: string }[] = [
  { cerca: /setHours\s*\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/, nome: 'setHours(0, 0, 0, 0)' },
  { cerca: /setUTCHours\s*\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/, nome: 'setUTCHours(0, 0, 0, 0)' },
];

/** Toglie commenti e stringhe: in questi file le formule vecchie COMPAIONO, spiegate nei commenti. */
function soloCodice(sorgente: string): string {
  return sorgente
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
}

describe('nel perimetro già corretto, il giorno si chiede', () => {
  const radice = join(__dirname, '..');

  it.each(PERIMETRO)('%s non azzera l’ora a mano', (file) => {
    const codice = soloCodice(readFileSync(join(radice, file), 'utf8'));
    expect(VIETATE.filter((v) => v.cerca.test(codice)).map((v) => v.nome)).toEqual([]);
  });

  /**
   * ⚠️ Il primo test non basta da solo: qualcuno potrebbe tornare a calcolarsi «oggi» con
   * `Date.UTC(d.getUTC…)`, che è **legittimo** per una data salvata e quindi non si può vietare.
   * Questo secondo guarda l'altra faccia — che il file la risposta la vada a chiedere.
   */
  const NON_CHIEDONO_IL_GIORNO = new Map<string, string>([
    // Riceve `dueDate` da chi la chiama: un giorno non lo calcola e non lo legge. Sta nel perimetro
    // lo stesso perché è la porta da cui nascono le attività, ed è lì che qualcuno sarebbe tentato
    // di scriverne uno.
    ['coach-tasks/porta-delle-attivita.ts', 'non chiede mai che giorno è: la scadenza gliela passa il chiamante'],
  ]);

  it('tutti gli altri chiamano `date-only` (se no non rispondono alla domanda, la evitano)', () => {
    const senza = PERIMETRO.filter((f) => {
      if (NON_CHIEDONO_IL_GIORNO.has(f)) return false;
      const s = readFileSync(join(radice, f), 'utf8');
      // Chi non ha bisogno di «oggi» ma solo del mese lo prende da `tetto-compensi`, che a sua
      // volta chiama `date-only`: vale lo stesso, la risposta è una sola.
      return !/from '.*date-only'/.test(s) && !/from '.*tetto-compensi'/.test(s);
    });
    expect(senza).toEqual([]);
  });

  it('e le eccezioni dichiarate sono davvero nel perimetro (un elenco che non morde è rumore)', () => {
    for (const f of NON_CHIEDONO_IL_GIORNO.keys()) expect(PERIMETRO).toContain(f);
  });

  it('il filtro dei commenti non nasconde il codice vero', () => {
    // Se `soloCodice` fosse troppo aggressivo, ogni file risulterebbe pulito per sempre.
    expect(soloCodice('// spiegazione: x.setHours(0, 0, 0, 0)')).not.toMatch(/setHours/);
    expect(soloCodice('x.setHours(0, 0, 0, 0); // spiegazione')).toMatch(/setHours/);
    expect(soloCodice('/** doc con setUTCHours(0, 0, 0, 0) */\nconst y = 1;')).not.toMatch(/setUTCHours/);
  });

  it('i file del perimetro esistono davvero', () => {
    for (const f of PERIMETRO) expect(readFileSync(join(radice, f), 'utf8').length).toBeGreaterThan(0);
  });
});
