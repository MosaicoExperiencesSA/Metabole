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
      'due porte che leggono largo, e tutte e due per una ragione. (a) `scopertePerDieta` parte dalle '
      + '**giornate future** (`menuDay` con `date >= oggi`): chi ha giornate davanti ha un piano per '
      + 'costruzione, quindi il filtro c\'è già ed è più stretto di questo — ⚠️ ma è **de facto**, non '
      + 'dichiarato. (b) `applicaRestrizione` legge tutte le clienti del perimetro **apposta**: il '
      + 'filtro è due righe sotto (`chiHaUnPianoAttivo`) e serve la differenza fra i due numeri per '
      + 'poter dire a chi approva quante sono state **saltate** e perché. ⚠️ Filtrare nel `where` '
      + 'avrebbe fatto sparire quel numero, e una scrittura di massa che non dice su chi non ricade è '
      + 'una scrittura di cui non si conosce la portata. La prova che quel filtro esista sul serio è '
      + 'qui sotto, fra le fabbriche — senza, questa riga sarebbe un alibi.',
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

/**
 * Da `(` alla sua parentesi chiusa: **gli argomenti veri** di quella chiamata, non un tot di
 * caratteri a caso.
 */
function dentroLaChiamata(codice: string, aperta: number): string {
  let livello = 0;
  for (let i = aperta; i < codice.length; i += 1) {
    if (codice[i] === '(') livello += 1;
    else if (codice[i] === ')') {
      livello -= 1;
      if (livello === 0) return codice.slice(aperta, i + 1);
    }
  }
  return codice.slice(aperta);
}

/**
 * Quante porte, in questo file, non dichiarano il filtro.
 *
 * ⛔ **LA FINESTRA A CARATTERI HA DATO UN FALSO NEGATIVO, il 7/9 sera.** La prima stesura guardava
 * 1400 caratteri dopo la chiamata: quando `applicaRestrizione` è stata filtrata, il suo
 * `chiHaUnPianoAttivo` è finito **dentro la finestra della funzione precedente**, e
 * `scopertePerDieta` — che scoperta lo è davvero — ha smesso di essere contata. Una prova che
 * diventa verde perché il file accanto è migliorato non sta guardando quello che dice di guardare.
 *
 * ⚠️ Adesso il marcatore deve stare **dentro le parentesi della chiamata** — che è dove sta un
 * `where`, con parentesi bilanciate e non a spanne — **oppure** nelle poche righe subito prima, e
 * quella deroga serve a un caso solo: due porte gemelle (un `count` e un `findMany` sulla stessa
 * popolazione) che condividono un `where` estratto in una `const`. È la forma **giusta**, perché due
 * `where` copiati divergono, e sarebbe assurdo punirla.
 */
function porteScoperte(codice: string): number {
  let quante = 0;
  for (const rx of PORTE) {
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(codice)) !== null) {
      const aperta = codice.indexOf('(', m.index);
      const argomenti = aperta === -1 ? '' : dentroLaChiamata(codice, aperta);
      const pocoPrima = codice.slice(Math.max(0, m.index - 600), m.index);
      if (!MARCATORI.some((k) => argomenti.includes(k) || pocoPrima.includes(k))) quante += 1;
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

  /**
   * ⛔ **L'ESENZIONE (b) NON DEVE POTER DIVENTARE UN ALIBI.** `applicaRestrizione` è nell'elenco delle
   * porte che leggono largo, e ci sta perché il filtro è a valle: se un giorno quel filtro sparisse,
   * la porta resterebbe larga, l'elenco continuerebbe a dire «va bene così», e la scrittura di massa
   * tornerebbe a toccare chi ha finito il percorso — senza che niente diventi rosso.
   */
  it('⛔ la scrittura di massa filtra DAVVERO, e dice quante ne ha saltate', () => {
    const src = leggi('applica-proposta.ts');
    expect(src).toMatch(/const conPercorso = await chiHaUnPianoAttivo\(/);
    expect(src).toMatch(/const profili = tutte\.filter\(\(t\) => conPercorso\.has\(t\.userId\)\)/);
    expect(src).toMatch(/const saltate = tutte\.length - profili\.length/);
    // ⚠️ E il numero arriva a chi approva, non resta in una variabile.
    expect(src).toContain('un percorso in corso.');
  });

  it('⚠️ e il tetto conta chi verrà toccato davvero, non chi sta nel perimetro', () => {
    expect(leggi('applica-proposta.ts')).toMatch(/if \(profili\.length > MAX_CLIENTI_IN_UNA_VOLTA\)/);
  });

  it('⚠️ e il contatore delle domande conta quello che l’elenco mostra, non di più', () => {
    const src = leggi('richieste.service.ts');
    expect(src).toMatch(/async quante\([^)]*\): Promise<number> \{\s*return \(await this\.aperte\(/);
  });
});
