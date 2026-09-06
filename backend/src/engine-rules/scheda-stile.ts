/**
 * ⛔ **LA SCHEDA DEL «?» — leggerla dal codice dell'app, e dire chi resta senza.**
 *
 * `app/src/onboarding/dietInfo.ts` — «In pratica», «Cosa dice la ricerca», «Da tenere presente», le
 * fonti — è cablata nel codice dell'app, **per stile**. Chi non ha la sua scheda perde la parte che
 * dice alla cliente *perché fidarsi*: in registrazione il pallino «?» non compare proprio, nel
 * profilo compare e apre metà popup, senza la ricerca e senza le fonti. È già successo il 6/8 con
 * DASH, Flessibile, Detox e i due percorsi estivi: cinque stili in catalogo, nessuna scheda, e
 * nessun errore da nessuna parte.
 *
 * ⛔ **Perché il lettore sta qui e non dentro la prova che lo usava.** Fino al 5/9 viveva in
 * `scheda-stile-nell-app.spec.ts`, e da lì sorvegliava un elenco **statico**: gli stili dei preset.
 * Ma gli stili che una cliente vede davvero arrivano dal **database** (`GET /onboarding/diet-products`),
 * e i preset sono solo il seme — è scritto nella voce di lavoro, ed è la ragione per cui era rimasta
 * aperta. Una prova non può interrogare la banca dati di produzione; una diagnostica sì. Quindi il
 * giudizio scende qui, dove tutti e due lo possono chiamare, e nessuno dei due lo riscrive.
 */

/**
 * I campi che la cliente legge nel popup. `fonti` è opzionale per scheda: valgono le generali.
 *
 * ⚠️ La lunghezza minima è **per campo**, non una sola soglia: «Mediterranea» è un titolo giusto e
 * lungo dodici caratteri, mentre `cosaDiceLaRicerca` in dodici caratteri è un campo non scritto. Una
 * soglia unica avrebbe dovuto scendere al livello del titolo, e allora non avrebbe più visto niente.
 */
export const CAMPI = ['titolo', 'cose', 'inPratica', 'cosaDiceLaRicerca', 'attenzione'] as const;
export type CampoScheda = (typeof CAMPI)[number];
/**
 * ⚠️ **Tarate sui testi veri, il 5/9**, dopo che una revisione ha misurato le dieci schede scritte:
 * il più corto dei `cose` è 187 caratteri, `inPratica` 118, `cosaDiceLaRicerca` 227, `attenzione`
 * 144. Le soglie di prima — 60 e 40 — stavano così sotto che una `cosaDiceLaRicerca` scritta a un
 * terzo sarebbe passata per piena: erano tarate per non dare falsi allarmi, e infatti non vedevano
 * niente. Adesso stanno sotto ogni scheda vera con margine, e sopra un campo abbozzato.
 *
 * ⛔ **`titolo` resta 4 e ha margine zero**, ed è voluto: «DASH» è un titolo giusto e lungo quattro.
 * Alzarlo vorrebbe dire dare del non scritto a una scheda scritta bene. Il titolo è l'unico campo
 * dove la brevità non è un difetto, e per questo è anche l'unico che questa soglia quasi non guarda.
 */
export const MINIMO: Record<CampoScheda, number> = {
  titolo: 4, cose: 100, inPratica: 100, cosaDiceLaRicerca: 100, attenzione: 80,
};

export interface Scheda { campi: Record<string, string> }

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

/** I campi che a questa scheda mancano o sono troppo corti per essere stati scritti davvero. */
export function campiVuoti(scheda: Scheda | undefined): CampoScheda[] {
  if (!scheda) return [...CAMPI];
  return CAMPI.filter((c) => (scheda.campi[c] ?? '').trim().length < MINIMO[c]);
}

export interface StilePubblicato {
  style: string;
  /** Come si chiama la dieta per la cliente: serve a chi legge il tabulato per riconoscerla. */
  diete: string[];
  /** Quante clienti hanno **oggi** quello stile sul profilo. È il numero che dice quanto pesa. */
  clienti: number;
}

export interface EsitoSchede {
  /** Stile pubblicato e visibile, senza nessuna scheda: in registrazione il «?» non compare. */
  senzaScheda: StilePubblicato[];
  /** Scheda presente ma con dei campi non scritti: il «?» compare e apre mezzo popup. */
  aMeta: (StilePubblicato & { mancano: CampoScheda[] })[];
  /**
   * ⛔ **Scheda presente con TUTTI i campi illeggibili: non è un difetto di contenuto, è il lettore.**
   * Una scheda riscritta con i backtick, con le virgolette doppie o tutta su una riga esce con
   * cinque campi a zero — e finirebbe fra i «a metà», mandando la nutrizionista a riscrivere un
   * testo clinico che è già scritto. Il rimedio è guardare **come** è scritta, non cosa dice.
   */
  nonLeggibili: StilePubblicato[];
  piene: StilePubblicato[];
  /** ⚠️ Schede scritte per uno stile che nessuna dieta pubblicata usa: lavoro fermo, non un difetto. */
  schedeSenzaStile: string[];
  /** Quante clienti stanno su uno stile che la scheda non ce l'ha, o ce l'ha a metà. */
  clientiToccate: number;
}

/**
 * ⛔ **CHI RESTA SENZA, fra gli stili che una cliente può DAVVERO ricevere.**
 *
 * ⚠️ Non si guardano i preset: quelli sono il seme del catalogo, e una dieta scritta a mano in
 * banca dati non ci passa. Si guarda cosa è **pubblicato e visibile**, che è quello che l'app mostra.
 *
 * ⚠️ **Tre esiti e non due**: «nessuna scheda» e «scheda a metà» si rompono in modi diversi — la
 * prima fa sparire il pallino in registrazione, la seconda lo lascia lì e ne svuota il contenuto —
 * e chi legge deve poterli distinguere, perché il rimedio è lo stesso ma l'urgenza no.
 */
export function chiRestaSenzaScheda(
  pubblicati: readonly StilePubblicato[],
  schede: ReadonlyMap<string, Scheda>,
): EsitoSchede {
  const senzaScheda: StilePubblicato[] = [];
  const aMeta: (StilePubblicato & { mancano: CampoScheda[] })[] = [];
  const nonLeggibili: StilePubblicato[] = [];
  const piene: StilePubblicato[] = [];
  /** ⚠️ Uno stile una volta sola: due voci con lo stesso codice raddoppierebbero le clienti toccate. */
  const visti = new Set<string>();
  for (const s of pubblicati) {
    if (visti.has(s.style)) continue;
    visti.add(s.style);
    const scheda = schede.get(s.style);
    if (!scheda) { senzaScheda.push(s); continue; }
    const mancano = campiVuoti(scheda);
    if (mancano.length === CAMPI.length) { nonLeggibili.push(s); continue; }
    if (mancano.length) aMeta.push({ ...s, mancano });
    else piene.push(s);
  }
  return {
    senzaScheda,
    aMeta,
    nonLeggibili,
    piene,
    schedeSenzaStile: [...schede.keys()].filter((k) => !visti.has(k)).sort(),
    clientiToccate: [...senzaScheda, ...aMeta, ...nonLeggibili].reduce((n, s) => n + s.clienti, 0),
  };
}

export interface DietaPubblicata { style: string | null; name: string | null; clientName: string | null }
export interface ProfiloConStile { dietStyle: string | null }

export interface Raccolta {
  pubblicati: StilePubblicato[];
  /** ⛔ Diete pubblicate **senza codice stile**: alla cliente escono senza «?», e non stanno in nessuna riga. */
  senzaCodice: number;
  /** Clienti con uno stile sul profilo che nessuna dieta visibile pubblica: la riga di quadratura. */
  clientiFuoriCatalogo: number;
}

/**
 * ⛔ **L'ELENCO SU CUI SI DECIDE, e il pezzo che nella prima stesura non aveva nessuna prova.**
 *
 * Il giudizio (`chiRestaSenzaScheda`) riceve questo elenco già confezionato: è **qui** che i numeri
 * possono mentire, non lì. Tre cose imparate dalla revisione del 5/9:
 *
 * · ⛔ **Uno stile con delle clienti sopra e nessuna dieta visibile non deve sparire.** Il
 *   backoffice assegna le diete guardando solo `status: 'approved'` — `clientVisible` chiude l'app,
 *   non la scheda (sta scritto in `diag-famiglie-da-chiudere.ts`). Una famiglia ritirata dall'app su
 *   cui lo staff continua a spostare clienti finiva fuori da ogni riga del tabulato, **e fra le
 *   «schede che nessuno usa»**: cioè segnalata come lavoro fermo mentre ci stanno sopra delle
 *   persone. Adesso entra, con scritto che nessuna dieta visibile la pubblica.
 * · ⛔ **Una dieta pubblicata con `style` vuoto si conta.** Il DTO valida `@IsString()` senza
 *   `@MinLength`, quindi la stringa vuota entra in banca dati; `DIET_INFO['']` è `undefined` e il
 *   «?» non compare — che è il difetto del 6/8 esatto. Saltarla in silenzio la nascondeva.
 * · ⚠️ **`dietStyle` è lo stile SCELTO IN REGISTRAZIONE**, non sempre quello che la cliente vede nel
 *   profilo: lì il popup segue `dietStyleAssegnato`, che il motore può cambiare ripiegando su
 *   un'altra dieta. Il tabulato lo dice nell'etichetta invece di far credere il contrario.
 */
export function raccogliStili(
  diete: readonly DietaPubblicata[],
  profiliPerStile: ReadonlyMap<string, number>,
): Raccolta {
  const raccolta = new Map<string, StilePubblicato>();
  let senzaCodice = 0;
  for (const d of diete) {
    const style = String(d.style ?? '').trim();
    if (!style) { senzaCodice += 1; continue; }
    const p = raccolta.get(style) ?? { style, diete: [], clienti: profiliPerStile.get(style) ?? 0 };
    const nome = d.clientName || d.name || style;
    if (!p.diete.includes(nome)) p.diete.push(nome);
    raccolta.set(style, p);
  }
  let clientiFuoriCatalogo = 0;
  for (const [style, clienti] of profiliPerStile) {
    if (raccolta.has(style)) continue;
    clientiFuoriCatalogo += clienti;
    raccolta.set(style, { style, clienti, diete: ['— nessuna dieta visibile lo pubblica'] });
  }
  return {
    pubblicati: [...raccolta.values()].sort((a, b) => b.clienti - a.clienti || a.style.localeCompare(b.style)),
    senzaCodice,
    clientiFuoriCatalogo,
  };
}
