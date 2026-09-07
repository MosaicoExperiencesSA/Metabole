/**
 * ⛔ **VERA GUARDA SOLO CHI HA UN PERCORSO IN CORSO** — 7/9.
 *
 * ## Il fatto
 *
 * Simone: *«Vera continua a fare domande su clienti che non hanno un percorso attivo. Deve
 * monitorare solo quelle con un percorso attivo.»*
 *
 * Le fabbriche erano due, e la seconda si chiudeva da sola:
 *  1. `richieste.service.promemoriaSupervisione` partiva da `{ screeningFlag: true }` e basta.
 *     `screeningFlag` è un flag di **profilo** che nessuno riazzera a fine percorso: una cliente
 *     chiusa a luglio generava un promemoria **ogni sette giorni, per sempre**.
 *  2. `signals.runAdherenceSweep` apriva «scarsa aderenza: nessun check-in da N giorni» a tutte le
 *     utenze attive. Ma chi ha finito il percorso **non può più** fare check-in — glielo impedisce
 *     `checkinDue`, nello stesso file. Percorso finito → niente check-in → segnalazione → lista
 *     della mattina, ogni giorno.
 *
 * ## Perché una sentinella sui sorgenti, e non solo dei test funzionali
 *
 * ⚠️ Quando questa consegna è stata scritta, **tutte le prove di Vera erano verdi prima e dopo**:
 * 1268 test, nessuno rosso. Non perché il codice fosse giusto, ma perché **nessuna prova fissava il
 * perimetro-piano** — nessun `.spec.ts` di `vera/` nominava `subscription` o «piano attivo». Un
 * comportamento che nessun test guarda si perde alla prossima riga aggiunta, e questo si perderebbe
 * in silenzio: una porta nuova senza filtro non fallisce, fa solo ricomparire il rumore fra un mese.
 *
 * ⚠️ **Questa prova non chiude il buco: tiene fermo l'elenco.** Diventa rossa in due versi, e
 * servono tutti e due: qualcuno **aggiunge** una porta senza filtro (il conto sale), oppure qualcuno
 * **filtra** una delle esenzioni (il conto scende, e il nome va tolto da qui).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** I modi in cui, in questo progetto, si dice «solo chi ha un percorso». */
const MARCATORI = [
  'filtroProfiloConPianoAttivo',
  'filtroPerimetroSuClienteConPiano',
  'filtroClienteConPianoAttivo',
  'chiHaUnPianoAttivo',
  'soloDiChiHaUnPercorso',
  'STATI_CON_UN_PIANO',
];

/** Le letture che partono da una popolazione di clienti. */
const PORTE = [
  /prisma\.clientProfile\s*\.\s*(findMany|count)\s*\(/g,
  /prisma\.escalation\s*\.\s*(findMany|count)\s*\(/g,
];

/**
 * Quante porte, per file, oggi **non** dichiarano il filtro — e perché è giusto così.
 *
 * ⚠️ **Si accorcia, non si allunga.** Allungarlo vuol dire che è nata una porta nuova che nomina
 * clienti senza guardare se hanno un percorso, e va discussa, non registrata.
 */
const SCOPERTE_OGGI: Record<string, { quante: number; perche: string }> = {
  'registro.service.ts': {
    quante: 1,
    perche:
      'il registro STORICO (`tutto`): è la cronaca di quello che Vera ha fatto, e vedere una cliente '
      + 'che nel frattempo ha finito il percorso è giusto — è successo davvero.',
  },
  'applica-proposta.ts': {
    quante: 2,
    perche:
      'due, e per ragioni diverse. (a) `applicaRestrizione` scrive `dislikedFoods` su molte persone in '
      + 'una volta e oggi tocca anche chi ha chiuso mesi fa: ⛔ va filtrata, ma da sola e con la sua '
      + 'misura davanti — Simone l\'ha messa fuori da questa consegna il 7/9, di proposito. '
      + '(b) `scopertePerDieta` parte dalle giornate future (`menuDay` con `date >= oggi`): chi ha '
      + 'giornate davanti ha un piano per costruzione, quindi il filtro c\'è già ed è più stretto di '
      + 'questo — ⚠️ ma è **de facto**, non dichiarato, ed è il motivo per cui sta scritto qui.',
  },
};

function sorgenti(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const pieno = join(dir, nome);
    if (statSync(pieno).isDirectory()) sorgenti(pieno, out);
    else if (nome.endsWith('.ts') && !nome.endsWith('.spec.ts')) out.push(pieno);
  }
  return out;
}

/**
 * Il sorgente senza commenti: in questo progetto i commenti **nominano** le porte per spiegarle, e
 * qui sarebbe un alibi — basterebbe scrivere «filtroProfiloConPianoAttivo» in un commento perché la
 * prova diventasse verde su codice che non filtra niente.
 */
const senzaCommenti = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Quante porte, in questo file, non hanno un marcatore nelle righe subito dopo. */
function porteScoperte(codice: string): number {
  let quante = 0;
  for (const rx of PORTE) {
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(codice)) !== null) {
      /**
       * ⚠️ **Si guarda anche PRIMA, non solo dopo.** Due porte gemelle (un `count` e un `findMany`
       * sulla stessa popolazione) condividono spesso un `where` estratto in una `const` qualche riga
       * sopra — ed è la forma **giusta**, perché due `where` copiati divergono. Una finestra solo in
       * avanti le segnalava tutte e due come scoperte.
       *
       * ⚠️ La finestra è generosa di proposito: un `where` con `select` e `take` dentro è lungo, e
       * una finestra stretta segnalerebbe come scoperta una porta filtrata due righe più giù. Il
       * prezzo è che una porta davvero scoperta accanto a una filtrata passa — per questo la prova
       * conta anche il **totale** e tiene fermo l'elenco per file.
       */
      const intorno = codice.slice(Math.max(0, m.index - 1200), m.index + 1400);
      if (!MARCATORI.some((k) => intorno.includes(k))) quante += 1;
    }
  }
  return quante;
}

describe('⛔ le porte di Vera che nominano clienti guardano il percorso', () => {
  const cartella = __dirname;
  const file = sorgenti(cartella);
  const nome = (f: string) => f.slice(cartella.length + 1).replace(/\\/g, '/');

  const conteggi = new Map<string, number>();
  for (const f of file) {
    const q = porteScoperte(senzaCommenti(readFileSync(f, 'utf8')));
    if (q > 0) conteggi.set(nome(f), q);
  }

  it('⛔ il lettore trova davvero delle porte: a zero questa prova sarebbe verde sul nulla', () => {
    const totale = file.reduce((a, f) => {
      const c = senzaCommenti(readFileSync(f, 'utf8'));
      let n = 0;
      for (const rx of PORTE) { rx.lastIndex = 0; while (rx.exec(c) !== null) n += 1; }
      return a + n;
    }, 0);
    expect(totale).toBeGreaterThanOrEqual(4);
  });

  it('⛔ e le porte scoperte sono ESATTAMENTE quelle dichiarate, con la loro ragione', () => {
    const atteso = Object.fromEntries(
      Object.entries(SCOPERTE_OGGI).map(([f, v]) => [f, v.quante]),
    );
    expect(Object.fromEntries([...conteggi.entries()].sort())).toEqual(atteso);
  });

  it('⚠️ ogni esenzione porta scritto perché: un elenco di nomi senza ragioni è una lista di permessi', () => {
    for (const [f, v] of Object.entries(SCOPERTE_OGGI)) {
      expect(v.perche.length).toBeGreaterThan(40);
      expect(f).toMatch(/\.ts$/);
    }
  });
});

describe('⛔ le due fabbriche del rumore', () => {
  const leggi = (p: string) => senzaCommenti(readFileSync(join(__dirname, p), 'utf8'));

  it('⛔ il giro notturno del promemoria non parte più dal solo `screeningFlag`', () => {
    const src = leggi('richieste.service.ts');
    expect(src).toMatch(/screeningFlag: true, \.\.\.filtroProfiloConPianoAttivo\(\)/);
    // ⚠️ E il conteggio del tetto usa lo STESSO oggetto: due `where` gemelli divergono, e il numero
    // scritto nel log parlerebbe di una popolazione diversa da quella guardata.
    expect(src).toMatch(/count\(\{ where: soloConPercorso as never \}\)/);
    expect(src).toMatch(/where: soloConPercorso as never,/);
  });

  it('⛔ «scarsa aderenza» non accusa più chi non può fare check-in', () => {
    const src = senzaCommenti(
      readFileSync(join(__dirname, '..', 'signals', 'signals.service.ts'), 'utf8'),
    );
    expect(src).toMatch(
      /role: 'client', status: 'active', deletedAt: null, \.\.\.filtroClienteConPianoAttivo\(\)/,
    );
  });

  it('⚠️ e il contatore delle domande conta quello che l’elenco mostra, non di più', () => {
    const src = leggi('richieste.service.ts');
    expect(src).toMatch(/async quante\([^)]*\): Promise<number> \{\s*return \(await this\.aperte\(/);
  });
});
