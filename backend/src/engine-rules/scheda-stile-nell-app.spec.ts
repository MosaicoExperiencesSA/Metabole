/**
 * ⛔ **OGNI STILE CHE IL CATALOGO GENERA DEVE AVERE LA SUA SCHEDA NELL'APP — PIENA.**
 *
 * `app/src/onboarding/dietInfo.ts` — «In pratica», «Cosa dice la ricerca», «Da tenere presente», le
 * fonti — è cablata nel codice dell'app, **per stile**. In registrazione il pallino «?» accanto al
 * nome compare solo se quello stile sta in quel file (`Onboarding.tsx`: `{DIET_INFO[p.style] && …}`),
 * e nel profilo, senza scheda, alla cliente resta il solo nome della dieta più la descrizione
 * scritta dal backoffice: spariscono «in pratica», «cosa dice la ricerca», «da tenere presente» e
 * le **fonti**, cioè la parte che le dice perché fidarsi.
 *
 * ⛔ **E sparisce in silenzio.** È già successo il **6/8** con DASH, Flessibile, Detox e i due
 * percorsi estivi: cinque stili in catalogo, nessuna scheda, e nessun errore da nessuna parte.
 *
 * ⚠️ **Questa prova si poteva scrivere da subito**, e nella voce era scritto il contrario. Gli stili
 * che il catalogo genera sono un elenco statico qui nel backend (`SUGGESTED_PRESETS`), e un test del
 * backend può leggere un file dell'app: `signals/unita-acqua.spec.ts` legge già
 * `app/src/lib/water.ts` con `readFileSync`, per lo stesso motivo — due copie che nessuno confronta
 * divergono.
 *
 * ⛔ **LA CHIAVE NON BASTA: SI GUARDA DENTRO.** Una prima stesura contava solo le chiavi di primo
 * livello. Una revisione avversariale l'ha misurata su dieci schede **vuote**
 * (`{ titolo: '', cose: '', inPratica: '' … }`) e passavano tutte verdi: si poteva svuotare la parte
 * che questa prova esiste per difendere senza che nessuno se ne accorgesse. Da qui il lettore legge
 * i **campi**, non i nomi.
 *
 * ⛔ **Quello che questa prova NON copre, e va detto**: uno stile scritto **a mano** in banca dati,
 * fuori dai preset — e gli stili che stanno in `STYLE_LABELS` di `Onboarding.tsx` senza essere in
 * nessun preset (vedi la sentinella `it.failing` in fondo). Per il primo servirebbe un controllo a
 * runtime sugli stili **pubblicati** — un'altra voce, non questa.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KETO_MEDITERRANEA, SUGGESTED_PRESETS } from './engine-rules.presets';

const percorsoApp = (...p: string[]) => join(__dirname, '..', '..', '..', 'app', 'src', ...p);
const sorgenteApp = readFileSync(percorsoApp('onboarding', 'dietInfo.ts'), 'utf8');
const sorgenteOnboarding = readFileSync(percorsoApp('pages', 'Onboarding.tsx'), 'utf8');

/**
 * I campi che la cliente legge nel popup. `fonti` è opzionale per scheda: valgono le generali.
 *
 * ⚠️ La lunghezza minima è **per campo**, non una sola soglia: «Mediterranea» è un titolo giusto e
 * lungo dodici caratteri, mentre `cosaDiceLaRicerca` in dodici caratteri è un campo non scritto. Una
 * soglia unica avrebbe dovuto scendere al livello del titolo, e allora non avrebbe più visto niente.
 */
const CAMPI = ['titolo', 'cose', 'inPratica', 'cosaDiceLaRicerca', 'attenzione'] as const;
const MINIMO: Record<(typeof CAMPI)[number], number> = {
  titolo: 4, cose: 60, inPratica: 60, cosaDiceLaRicerca: 60, attenzione: 40,
};

interface Scheda { campi: Record<string, string> }

/**
 * ⚠️ Si legge il **corpo** di `DIET_INFO`, non tutte le parole del file: una ricerca per
 * sottostringa direbbe «c'è» anche trovando lo stile dentro un commento o dentro l'elenco fonti.
 *
 * ⛔ La chiave accetta anche cifre, trattini, camelCase e apici. La prima stesura usava
 * `[a-z_]+`: il giorno che un preset introduce `keto2` o `'summer-holiday'` la scheda ci sarebbe e
 * la prova direbbe «manca», mandando il prossimo a cercare un difetto che non esiste.
 *
 * ⛔ E `indexOf('export const DIET_INFO')` è un match per **prefisso**: prenderebbe
 * `DIET_INFO_FONTI` se qualcuno la spostasse sopra. Si àncora al `= {` della dichiarazione vera.
 */
export function schedeDelloStile(sorgente: string): Map<string, Scheda> {
  const apertura = sorgente.match(/export const DIET_INFO\s*:[^=]*=\s*\{/);
  if (!apertura || apertura.index === undefined) return new Map();
  const corpo = sorgente.slice(apertura.index + apertura[0].length);
  const fine = corpo.indexOf('\n};');
  const dentro = fine >= 0 ? corpo.slice(0, fine) : corpo;

  const capoChiave = /^ {2}(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*)): \{/gm;
  const capi: { nome: string; da: number }[] = [];
  for (let m = capoChiave.exec(dentro); m; m = capoChiave.exec(dentro)) {
    capi.push({ nome: m[1] ?? m[2] ?? m[3], da: m.index + m[0].length });
  }

  const out = new Map<string, Scheda>();
  capi.forEach((c, i) => {
    const blocco = dentro.slice(c.da, i + 1 < capi.length ? capi[i + 1].da : dentro.length);
    const campi: Record<string, string> = {};
    for (const campo of CAMPI) {
      const m = blocco.match(new RegExp(`\\n {4}${campo}:\\s*\\n?\\s*'((?:[^'\\\\]|\\\\.)*)'`));
      if (m) campi[campo] = m[1];
    }
    out.set(c.nome, { campi });
  });
  return out;
}

/** Le fonti generali: l'array deve esserci **e avere dentro qualcosa**. */
export function fontiGenerali(sorgente: string): string[] {
  const m = sorgente.match(/export const DIET_INFO_FONTI[^=]*=\s*\[([\s\S]*?)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/'((?:[^'\\]|\\.)+)'/g)].map((x) => x[1]);
}

describe('la scheda del «?» esiste, ed è piena, per ogni stile del catalogo', () => {
  const schede = schedeDelloStile(sorgenteApp);
  const delCatalogo = [...new Set([...SUGGESTED_PRESETS, ...KETO_MEDITERRANEA].map((p) => p.style))];

  /**
   * ⛔ **La prova che il lettore legge davvero.** Se `schedeDelloStile` tornasse una mappa vuota —
   * il file rinominato, la dichiarazione riscritta, il regex rotto — ogni altra prova di questo
   * file passerebbe **verde su zero righe**. Questa è la sola che se ne accorge.
   */
  it('⛔ il lettore prende delle schede: a mappa vuota, tutto il resto sarebbe verde sul nulla', () => {
    expect(schede.size).toBeGreaterThanOrEqual(delCatalogo.length);
  });

  it('⛔ ogni stile dei preset ha la sua scheda', () => {
    expect(delCatalogo.filter((s) => !schede.has(s))).toEqual([]);
  });

  /**
   * ⛔ **I cinque del 6/8, uno per uno.** È vero che sono tutti dentro `delCatalogo` e che la prova
   * sopra li copre: restano scritti perché sono l'**incidente**, e un elenco che li nomina
   * sopravvive al giorno in cui qualcuno toglie uno di quei preset dal backend — allora la prova
   * generale continuerebbe a passare e questa direbbe cosa è sparito.
   */
  it.each(['dash', 'flexible', 'detox', 'summer_holiday', 'summer_return'])(
    '⛔ lo stile «%s» ha la sua scheda (i cinque dell\'incidente del 6/8)',
    (stile) => { expect(schede.has(stile)).toBe(true); },
  );

  /**
   * ⛔ **Il cuore della prova.** Non «la chiave c'è», ma «la cliente ci trova del testo». Una scheda
   * con `cosaDiceLaRicerca: ''` è il difetto del 6/8 vestito da scheda presente.
   */
  it.each(CAMPI)('⛔ ogni scheda del catalogo ha «%s» scritto davvero', (campo) => {
    const vuoti = delCatalogo.filter((s) => (schede.get(s)?.campi[campo] ?? '').trim().length < MINIMO[campo]);
    expect(vuoti).toEqual([]);
  });

  /**
   * ⚠️ **Le fonti ci sono, e non sono un array vuoto**: sono la parte che rende credibile il popup,
   * ed è quella che mancava nel profilo quando la scheda non c'era.
   */
  it('⚠️ e le fonti generali esistono e non sono una lista vuota', () => {
    expect(fontiGenerali(sorgenteApp).length).toBeGreaterThanOrEqual(2);
  });

  /**
   * ⛔ **SENTINELLA — una terza lista che nessuno confronta.** `STYLE_LABELS` in `Onboarding.tsx`
   * è l'elenco delle etichette leggibili, e contiene `vegan`, `vegetarian`, `balanced`: stili con
   * un nome ma **senza scheda**. Oggi non fanno danno perché nessun preset li genera, e gli stili
   * veri arrivano dal database (`GET /onboarding/diet-products`), non dai preset. Il giorno che
   * una dieta esce con `style: 'vegan'` l'etichetta c'è e il «?» no — è esattamente il 6/8.
   *
   * ⚠️ Sta come `it.failing`: **verde finché il difetto c'è, rossa quando qualcuno lo corregge.**
   * Chi aggiunge le tre schede mancanti veda questa prova diventare rossa e la trasformi in `it`.
   */
  it.failing('⛔ [difetto noto] anche gli stili di STYLE_LABELS hanno una scheda', () => {
    const m = sorgenteOnboarding.match(/const STYLE_LABELS[^=]*=\s*\{([\s\S]*?)\n\};/);
    const etichette = [...(m?.[1] ?? '').matchAll(/(?:^|[{,]\s*)([a-z_][\w]*):\s*'/g)].map((x) => x[1]);
    expect(etichette.length).toBeGreaterThan(8);
    expect(etichette.filter((s) => !schede.has(s))).toEqual([]);
  });
});
