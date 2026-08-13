/**
 * LA RI-DOMANDA SULLE ALLERGIE, PARLANDO CON GAIA — logica pura.
 *
 * §7 dell'handoff (`progetto/HANDOFF_Allergie_Intolleranze.md`). Il 13/8 la conta ha detto **24
 * clienti su 48**: metà. Non sono tante da essere il sintomo di un questionario rotto, e non sono
 * poche da poterle fare a mano una per una.
 *
 * Le tre popolazioni sono già decise altrove e **non si ridecidono qui**: le dà
 * `common/da-ricontattare.ts`, la stessa funzione che le ha contate. Uno script che si riscrive il
 * criterio conta una popolazione e la campagna ne contatta un'altra.
 *
 * ## Perché il modello è `data-inizio-chat` e non «Conosciamoci»
 *
 * «Conosciamoci» non è una conversazione: è l'attivazione del piano di prova, un colpo solo che
 * parte da un evento. Qui invece c'è un dialogo a due passi — si chiede, si propone quello che si è
 * capito, si fa confermare — e lo stato deve sopravvivere fra un messaggio e l'altro senza una
 * tabella nuova. È esattamente la forma di `StatoDataInizio`, e la si copia fin nei nomi.
 *
 * ## ⚠️ In chat non ci sono pulsanti
 *
 * Le bolle sono testo puro e l'input è libero: niente elenchi da spuntare, niente «sì/no» cliccabili
 * (zero occorrenze di `quickReply|opzioni|buttons` in `ChatSheet.tsx`, `Assistente.tsx`,
 * `chat.service.ts`). Quindi qui vive un parser tollerante — sul modello di `leggiData` — e la
 * regola dei **due tentativi e poi passa a una persona**: insistere una terza volta su una risposta
 * che non si capisce è il modo di far scrivere alla nutrizionista *dopo* aver perso cinque minuti.
 *
 * ## ⚠️ E soprattutto: quello che ha scritto non si salva come l'ha scritto
 *
 * «i latticini», «la frutta secca ma solo le noci». Si **propone e si fa confermare** — «ho capito
 * *latte e derivati*, giusto?» — e solo il confermato entra in banca dati. Quello che non si
 * riconosce non si indovina: va nel testo libero e lo codifica la nutrizionista. È la stessa regola
 * di `impara-dalla-chat.ts`, *nel dubbio non si impara*, e qui il dubbio costa una reazione
 * allergica invece di un piatto sbagliato.
 */
import { EU_ALLERGENS, allergenLabel } from '../catalog/allergens';
import { MotivoRicontatto } from '../common/da-ricontattare';

/** I motivi che aprono un dialogo: `null` non ne apre nessuno. */
export type MotivoDialogo = Exclude<MotivoRicontatto, null>;

export type PassoAllergie = 'risposta' | 'conferma';

export interface StatoAllergie {
  passo: PassoAllergie;
  /** Perché gliela stiamo chiedendo. Decide la domanda **e** cosa si scrive alla fine. */
  motivo: MotivoDialogo;
  /** I codici UE riconosciuti, in attesa del suo «sì». */
  codici?: string[];
  /** Quello che ha detto e non abbiamo saputo tradurre: lo codifica la nutrizionista. */
  libere?: string[];
  /** Ha risposto «non ne ho». ⚠️ Diverso da `codici` vuoto, che vuol dire «non ho capito». */
  nessuna?: boolean;
  /** Risposte non capite di fila: a 2 il dialogo passa a una persona invece di insistere. */
  tentativi?: number;
}

const normalizza = (t: string): string =>
  (t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// ---------- Il dizionario ----------

/**
 * PAROLE IN PIÙ, oltre a quelle del catalogo.
 *
 * Il grosso del dizionario **non sta qui**: sono le `keywords` di `catalog/allergens.ts`, cioè le
 * stesse parole con cui si pre-taggano le ricette. Una seconda lista completa divergerebbe dalla
 * prima, e il giorno della divergenza un'allergia sarebbe riconosciuta da una parte e no dall'altra.
 *
 * Qui ci sono solo le forme che si dicono **parlando** e che una ricetta non scriverebbe mai:
 * nessuno mette «celiachia» fra gli ingredienti.
 *
 * ⚠️ «frutta secca» è ambigua per davvero — in italiano vuol dire sia le noci sia i fichi secchi —
 * ed è il motivo per cui questo dialogo **propone e fa confermare** invece di scrivere: la si manda
 * su `frutta_a_guscio`, che è quello che intende quasi sempre chi parla di allergie, e poi glielo si
 * chiede.
 */
const PAROLE_IN_PIU: { parola: string; codici: string[] }[] = [
  { parola: 'lattosio', codici: ['latte'] },
  { parola: 'latticini', codici: ['latte'] },
  { parola: 'derivati del latte', codici: ['latte'] },
  { parola: 'celiac', codici: ['glutine'] },
  { parola: 'frutta secca', codici: ['frutta_a_guscio'] },
  { parola: 'frutta a guscio', codici: ['frutta_a_guscio'] },
  { parola: 'frutta con guscio', codici: ['frutta_a_guscio'] },
  { parola: 'noccioline', codici: ['arachidi'] },
  { parola: 'anidride solforosa', codici: ['solfiti'] },
  // «Frutti di mare» non è né gli uni né gli altri: è tutti e due. Proporne uno solo lascerebbe
  // fuori metà di quello che intende, e su un'allergia la metà che manca è quella che fa male.
  { parola: 'frutti di mare', codici: ['crostacei', 'molluschi'] },
  { parola: 'pesce azzurro', codici: ['pesce'] },
];

/**
 * ⚠️ FALSE AMICHE: parole che **contengono** una parola del dizionario senza essere quella cosa.
 *
 * «Noce moscata» è una spezia, non frutta a guscio. «Latte di mandorla» non è latte, e in compenso
 * è mandorla. «Burro di arachidi» non è burro.
 *
 * Si tolgono dal testo **prima** di cercare, sostituendole con quello che sono davvero. Senza,
 * Gaia proporrebbe «ho capito latte e derivati» a chi ha detto «latte di mandorla» — e la cliente
 * che dice «no» due volte finisce dalla nutrizionista per un difetto nostro.
 */
const FALSE_AMICHE: { dice: RegExp; intende: string }[] = [
  { dice: /\bnoce moscata\b/g, intende: 'spezia' },
  { dice: /\bnoc[ei] di cocco\b/g, intende: 'cocco' },
  { dice: /\blatte di cocco\b/g, intende: 'cocco' },
  { dice: /\blatte di mandorl[ae]\b/g, intende: 'mandorle' },
  { dice: /\blatte di soia\b/g, intende: 'soia' },
  { dice: /\blatte di riso\b/g, intende: 'riso' },
  { dice: /\blatte di avena\b/g, intende: 'avena' },
  { dice: /\bburro di arachidi\b/g, intende: 'arachidi' },
];

/** Parola (minuscola, senza accenti) → codici UE che quella parola fa scattare. */
/**
 * ⚠️ LA CHIAVE NON SI ACCORCIA: lo spazio in fondo a una parola del catalogo È la parola.
 *
 * Fra le `keywords` del glutine c'è `'pan '` — con lo spazio — e serve a prendere «pan carré»
 * **senza** prendere «panna», che è latte. Passandola da `normalizza()`, che taglia gli estremi,
 * diventerebbe `'pan'`: da lì in poi chi dice «panna» si sentirebbe proporre il glutine, e chi
 * legge il dizionario non troverebbe il perché da nessuna parte.
 */
const normalizzaChiave = (t: string): string =>
  (t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const DIZIONARIO: { parola: string; codici: string[] }[] = [
  ...EU_ALLERGENS.flatMap((a) => [
    { parola: normalizzaChiave(a.label), codici: [a.code] },
    { parola: normalizzaChiave(a.code.replace(/_/g, ' ')), codici: [a.code] },
    ...a.keywords.map((k) => ({ parola: normalizzaChiave(k), codici: [a.code] })),
  ]),
  ...PAROLE_IN_PIU.map((p) => ({ parola: normalizzaChiave(p.parola), codici: p.codici })),
]
  // Le più lunghe per prime: «frutta a guscio» prima di «frutta», così la parola più precisa vince
  // e non si finisce a proporre due allergeni per una cosa sola.
  .sort((a, b) => b.parola.length - a.parola.length);

/**
 * «NON NE HO», in tutte le forme in cui si dice.
 *
 * ⚠️ Deve essere la risposta **intera**: «no» da solo è «non ne ho», ma «no, le noci» è una
 * correzione seguita da un alimento, e trattarla come «non ne ho» cancellerebbe un'allergia. Per
 * questo il riconoscimento degli alimenti gira **per primo** e questo solo se non ha trovato niente.
 */
const NIENTE =
  /^(no|nessuna|nessuno|niente|nulla|non ne ho|non ho allergie|non ho nessuna allergia|non sono allergica|non sono allergico|zero|neanche una|nessun'allergia)[.! ]*$/;

const SI = /^(si|s[iì]|ok|okay|va bene|certo|confermo|conferma|perfetto|esatto|giusto|yes|esattamente|si esatto|proprio cosi|d accordo|daccordo)[.! ]*$/;
const NO = /^(no|nono|no no|sbagliato|non e cosi|non proprio|niente affatto|per niente|manca qualcosa|non e giusto)[.! ]*$/;

// ---------- Lettura della risposta ----------

export interface LetturaAllergie {
  /** Ha detto esplicitamente di non averne. */
  nessuna: boolean;
  /** I codici UE riconosciuti, senza doppioni. */
  codici: string[];
  /** I pezzi di frase che sembrano un alimento ma che non sappiamo tradurre. */
  libere: string[];
  /** Non si è capito niente: né un alimento, né un «non ne ho». */
  vuota: boolean;
}

/**
 * Parole che non sono alimenti e che tolgono di mezzo il rumore del parlato prima di decidere se
 * quello che resta è un alimento sconosciuto o solo una frase. Senza, «mi sa che forse» finirebbe
 * in banca dati come allergene da far codificare alla nutrizionista.
 */
const RUMORE =
  /\b(sono|allergic[ao]|allergia|allergie|intolleranza|intolleranze|intollerante|ho|hai|una|un|uno|il|lo|la|le|gli|i|de[il]|della|delle|degli|al|alla|alle|ai|agli|a|di|e|ed|anche|solo|soltanto|pero|ma|forse|credo|penso|mi sa|che|non|posso|mangiare|proprio|tutto|tutti|un po|quasi|molto|abbastanza|grazie|ciao|si|no|ok)\b/g;

/**
 * ⚠️ E le interiezioni, che sono la forma in cui si dice «non lo so».
 *
 * Stanno in una lista a parte e non fra le parole di sopra perché non sono grammatica: sono i
 * suoni con cui una persona prende tempo. Senza, «boh» diventa un alimento che non conosciamo,
 * Gaia risponde «mi segno *boh*» e la cliente capisce — giustamente — che non la stiamo ascoltando.
 */
const INTERIEZIONI = new Set(['boh', 'bho', 'mah', 'bah', 'uhm', 'mmm', 'ecco', 'allora', 'vabbe', 'beh', 'eh']);

/**
 * Quello che ha detto, tradotto in codici. `oggi` non serve: qui non ci sono date, e questa
 * funzione è pura apposta — è la parte che si sbaglia, e si verifica senza database.
 */
export function leggiAllergie(testo: string): LetturaAllergie {
  let t = normalizza(testo);
  for (const f of FALSE_AMICHE) t = t.replace(f.dice, f.intende);

  const codici: string[] = [];
  let resto = ` ${t} `;
  for (const voce of DIZIONARIO) {
    if (!voce.parola) continue;
    if (!resto.includes(voce.parola)) continue;
    for (const c of voce.codici) if (!codici.includes(c)) codici.push(c);
    // La parola trovata si toglie dal testo: quello che avanza è il candidato testo libero. Senza,
    // «noci» resterebbe lì dentro e comparirebbe **anche** come allergia da codificare a mano,
    // accanto al codice che la traduce già.
    resto = resto.split(voce.parola).join(' ');
  }

  const avanzo = resto
    .replace(RUMORE, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Almeno tre lettere: «un», «po», «bo» non sono alimenti, sono il rumore di una frase parlata.
  let libere = avanzo
    .split(' ')
    .filter((p) => p.length >= 3 && !INTERIEZIONI.has(p))
    .filter((p, i, a) => a.indexOf(p) === i);

  /**
   * ⚠️ L'ordine conta, ed è tutto qui.
   *
   * Se ha nominato un alimento, il «no» in testa alla frase è una **correzione** («no, le noci»),
   * non un «non ne ho»: leggerlo come una negazione cancellerebbe l'allergia che sta dichiarando
   * nella stessa riga. Quindi il «niente» si guarda **solo** quando non si è riconosciuto nessun
   * codice — e allora vince anche su quello che avanza, perché «nessuna» è una parola che il
   * setaccio del rumore lascerebbe passare come se fosse un alimento.
   */
  const nessuna = codici.length === 0 && NIENTE.test(t);
  if (nessuna) libere = [];

  return { nessuna, codici, libere, vuota: !nessuna && codici.length === 0 && libere.length === 0 };
}

/** «sì» / «no» alla proposta. `null` = non è né l'uno né l'altro. */
export function leggiConferma(testo: string): boolean | null {
  const t = normalizza(testo);
  if (SI.test(t)) return true;
  if (NO.test(t)) return false;
  return null;
}

// ---------- Testi ----------

const conNome = (nome?: string | null): string => {
  const n = (nome ?? '').trim().split(' ')[0];
  return n && n.length > 1 && !/\d/.test(n) ? ` ${n}` : '';
};

/** «latte e derivati e frutta a guscio» — l'elenco come lo direbbe una persona. */
export function elencoAParole(voci: string[]): string {
  const nomi = voci.map((v) => allergenLabel(v).toLowerCase());
  if (nomi.length === 0) return '';
  if (nomi.length === 1) return nomi[0];
  return `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`;
}

/**
 * LA DOMANDA, diversa per ognuna delle tre popolazioni.
 *
 * ⚠️ Alla prima si dice che il campo **non c'era**. Non è cortesia: chi ha spuntato «Altro» fra le
 * intolleranze non ha dimenticato di scrivere cosa fosse, non aveva dove — il campo è nato il 13/8.
 * Una domanda che sottintende una distrazione che non c'è stata si prende una risposta seccata, e
 * qui la risposta serve.
 */
export function testoDomanda(motivo: MotivoDialogo, scritteAllora: string[], nome?: string | null): string {
  if (motivo === 'intolleranza_ignota') {
    return (
      `Ciao${conNome(nome)}, ti rubo un minuto per una cosa che è colpa nostra.\n\n` +
      'Quando hai compilato il questionario avevi segnato «Altro» fra le intolleranze, ma il campo ' +
      'per scrivere **quale** non esisteva ancora: la tua risposta non è mai arrivata da nessuna parte. ' +
      'Adesso c\'è.\n\n' +
      'Me lo dici che cos\'è? Scrivimelo come ti viene — «il lattosio», «le noci».'
    );
  }
  if (motivo === 'allergie_da_codificare') {
    const quali = scritteAllora.length ? ` Tu avevi scritto «${scritteAllora.join('», «')}»` : '';
    return (
      `Ciao${conNome(nome)}, una cosa veloce sulle allergie e poi ti lascio.\n\n` +
      `Le allergie le evito sempre, tracce e derivati compresi, quindi voglio essere sicura di aver ` +
      `capito bene.${quali}: me lo ridici con parole tue, così lo segno per bene?`
    );
  }
  return (
    `Ciao${conNome(nome)}, c'è una domanda che non ti abbiamo mai fatto come si deve, e su questa ` +
    'preferisco essere noiosa.\n\n' +
    'Hai qualche **allergia** alimentare? Le allergie le tolgo sempre dai tuoi menu, anche tracce e ' +
    'derivati.\n\n' +
    'Se non ne hai scrivimi «nessuna»: la segno come risposta e non te lo chiedo più.'
  );
}

/**
 * LA PROPOSTA. È il passo che rende sicuro tutto il resto: quello che finisce in banca dati è
 * quello che lei ha letto scritto e ha confermato, non quello che noi abbiamo capito.
 */
export function testoConferma(
  motivo: MotivoDialogo,
  lettura: { nessuna: boolean; codici: string[]; libere: string[] },
  nome?: string | null,
): string {
  const cosa = motivo === 'intolleranza_ignota' ? 'intolleranza' : 'allergia';
  if (lettura.nessuna) {
    return (
      `Allora${conNome(nome)}: nessuna ${cosa}. Segno che te l'ho chiesto e che mi hai risposto, ` +
      'così non te lo richiedo più.\n\nConfermi? (sì / no)'
    );
  }
  const pezzi: string[] = [];
  if (lettura.codici.length) pezzi.push(`ho capito **${elencoAParole(lettura.codici)}**`);
  if (lettura.libere.length) pezzi.push(`e mi segno «${lettura.libere.join('», «')}» così com'è`);
  const coda = lettura.libere.length
    ? '\n\nQuello che ho segnato così com\'è lo guarda la nutrizionista: è lei che sa tradurlo in modo ' +
      'che i menu lo escludano davvero.'
    : motivo === 'intolleranza_ignota'
      ? '\n\nLe intolleranze le gestisco con alternative: non sparisce niente dal piatto, cambia con qualcosa che ti va bene.'
      : '\n\nDa qui in avanti resta fuori dai tuoi menu, tracce e derivati compresi.';
  return `Allora${conNome(nome)}: ${pezzi.join(', ')}.${coda}\n\nConfermi? (sì / no)`;
}

export function testoFatto(
  motivo: MotivoDialogo,
  lettura: { nessuna: boolean; codici: string[]; libere: string[] },
  nome?: string | null,
): string {
  if (lettura.nessuna) {
    return `Perfetto${conNome(nome)}, segnato. Se un giorno cambia qualcosa dimmelo pure qui. 💚`;
  }
  const daOggi = lettura.codici.length ? `Da adesso ${elencoAParole(lettura.codici)} ` : '';
  const verbo =
    motivo === 'intolleranza_ignota' ? 'lo gestisco con alternative nei tuoi menu' : 'resta fuori dai tuoi menu';
  const coda = lettura.libere.length
    ? ' Il resto l\'ho passato alla nutrizionista, ti scrive lei se le serve capire meglio.'
    : '';
  return `Fatto${conNome(nome)}. ${daOggi}${daOggi ? verbo : 'È tutto segnato'}.${coda} 💚`;
}

export function testoNonCapito(ultimoTentativo: boolean): string {
  if (ultimoTentativo) {
    return (
      'Non voglio tirare a indovinare su una cosa così: ne parlo io con la tua nutrizionista, ' +
      'che ti scrive e la segna per bene. 💚'
    );
  }
  return (
    'Scusa, non sono sicura di aver capito. Scrivimi solo il nome — «latte», «noci», «crostacei» — ' +
    'oppure «nessuna» se non ne hai.'
  );
}

/** Ha detto «no» alla proposta: si ricomincia dalla domanda, una volta sola. */
export function testoRiprova(): string {
  return 'Ho capito male, scusa. Rimettimelo in fila: quali sono, uno per uno?';
}

/**
 * ⚠️ TOGLIERE UN'ALLERGIA NON LO FA GAIA.
 *
 * Se la risposta di adesso cancellerebbe qualcosa che lei aveva già dichiarato — «nessuna» a chi
 * risulta allergica al latte, o un elenco che non contiene più una voce di prima — il dialogo si
 * ferma e passa alla nutrizionista.
 *
 * Non è prudenza generica: aggiungere un'allergia toglie un piatto, toglierne una lo rimette nel
 * piatto di qualcuno che aveva detto di non poterlo mangiare. Le due cose non hanno lo stesso
 * peso e non possono avere la stessa strada.
 */
export function testoToglieQualcosa(gia: string[], nome?: string | null): string {
  return (
    `Aspetta${conNome(nome)}, qui mi fermo. Da noi risulta ${elencoAParole(gia)}, e quello che mi hai ` +
    'appena detto la toglierebbe.\n\nUn\'allergia non la cancello io in chat: ne parlo con la tua ' +
    'nutrizionista e ti scrive lei, così lo fa chi di dovere. 💚'
  );
}

/** Non c'è più niente da chiedere: ha già risposto altrove fra la notifica e adesso. */
export function testoGiaAPosto(nome?: string | null): string {
  return (
    `Tutto a posto${conNome(nome)}: le tue allergie le ho già segnate, non mi serve altro. ` +
    'Se vuoi controllarle o cambiarle, dimmelo pure. 💚'
  );
}
