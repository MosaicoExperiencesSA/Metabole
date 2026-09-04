/**
 * QUANDO VERA NON CAPISCE: UNA SECONDA LETTURA, NON UNA SECONDA DECISIONE.
 *
 * Il 17/8 Vera si è rotta **tre volte in una giornata** — il nome a inizio frase (11:02), la domanda
 * che fa la pastiglia (11:52), un refuso su una lettera (13:41: «sostitusci») — e tre volte si è
 * aggiunta un'espressione regolare a mano. Le correzioni erano giuste e restano, ma la conclusione da
 * trarne non è «adesso ne mancano meno»: **le frasi vere sono infinite e le forme scritte a mano no**,
 * e chi sta dall'altra parte non impara «ho sbattuto un tasto» — impara «non funziona», e dopo due
 * «non ci arrivo» smette di provare.
 *
 * Decisione di Simone (17/8): sì. Foglio: `progetto/NOTA_Vera_Seconda_Lettura.md`.
 *
 * ```
 * frase  →  capisci()  →  intento          ← la strada di sempre, invariata
 *               ↓ null
 *          il modello RISCRIVE la frase nella forma canonica
 *               ↓
 *        frase riscritta  →  capisci()  →  intento     (e la riscrittura si MOSTRA)
 *               ↓ ancora null
 *          «non ci arrivo» — esattamente come oggi
 * ```
 *
 * ## Le tre proprietà, e sono tutte e tre il punto
 *
 * 1. **Il modello non vede mai i dati e non tocca mai il database.** Riceve una stringa, restituisce
 *    una stringa. Non sa chi è Jolanda, non sa cosa c'è in catalogo, non può scrivere.
 * 2. **A decidere resta `capisci`**, con le sue forme dichiarate e i suoi test. Se la riscrittura non
 *    passa da lì non succede niente, come oggi. Il modello non allarga quello che Vera **sa fare** —
 *    allarga solo il modo in cui glielo si può **dire**.
 * 3. **La riscrittura si mostra prima di eseguire**, e si mostra *la frase*: «ceci → fagioli» non fa
 *    vedere che il modello ha aggiunto qualcosa, la frase sì.
 *
 * ## ⚠️ Le tre cose che possono andare storte, e cosa le ferma
 *
 * **Una domanda letta come ordine** («posso togliere il pesce a Giulia?» → «togli il pesce a
 * Giulia»). È la più insidiosa, ed è il motivo per cui `daScartare` gira **prima**: una frase col
 * punto interrogativo non arriva nemmeno al modello. Sta in `capisci.ts`, dove era già.
 *
 * **Una riscrittura plausibile ma sbagliata** («a Giulia togli il pesce» → «…il pesce e i
 * crostacei»). La ferma `riscritturaAccettabile` qui sotto, che è la parte di questo file che conta:
 * il modello può **riordinare** le parole della frase, non **aggiungerne**. Ogni parola piena della
 * riscrittura deve venire dalla frase originale (anche storpiata: si confronta per radice) oppure
 * essere una delle parole della **forma** che `capisci` riconosce. Un alimento, un nome o un numero
 * comparsi dal nulla fanno rifiutare la riscrittura, e si torna a «non ci arrivo».
 * ⚠️ È una guardia **oltre** alla conferma, non al posto suo: la conferma la legge una persona
 * stanca, alle sette di sera, e una parola in più in fondo a una frase giusta è esattamente ciò che
 * non si nota.
 *
 * **Il modello non risponde** (credito finito, 503, lentezza). Si ricade su «non ci arrivo», che è il
 * comportamento di oggi: la seconda lettura è un **di più**, e se manca non manca niente.
 * `AiService.generateJson` torna `null` su ogni errore e non lancia, quindi non serve altro.
 *
 * ## Cosa si guadagna, oltre alla frase capita
 *
 * Ogni riscrittura andata a buon fine è **una frase vera da aggiungere ai test**: il corpus delle
 * frasi non capite esiste già (`vera/corpus.ts`), e con la seconda lettura si riempie da solo di
 * coppie «come l'ha detta» → «come si scrive». Il modello è il modo per **smettere** di aver bisogno
 * del modello.
 */
import { normalizza } from '../common/nomi-alimento';

/** Quanto può essere lunga una riscrittura: è una frase, non un discorso. */
const MAX_CARATTERI = 240;

/**
 * LE PAROLE DELLA FORMA — quelle che il modello può usare anche se lei non le ha scritte.
 *
 * Sono i verbi e le preposizioni con cui `capisci` riconosce le sue forme: se lei scrive «per la
 * jolanda i ceci proprio no», la riscrittura canonica è «a Jolanda niente ceci», e «niente» non era
 * nella frase. Questo elenco è ciò che rende la riscrittura possibile — ed è **chiuso**, che è ciò
 * che la rende sicura.
 *
 * ⚠️ Qui NON entrano alimenti, nomi di persona, numeri o nomi di dieta. Se una parola così compare
 * nella riscrittura e non era nella frase, il modello ha aggiunto qualcosa a nome di lei.
 */
const PAROLE_DELLA_FORMA = new Set(
  [
    // divieti e rimozioni
    'niente', 'non', 'dare', 'darle', 'dargli', 'togli', 'togliere', 'toglile', 'elimina', 'eliminare',
    'vieta', 'vietare', 'evita', 'evitare', 'basta', 'mai', 'piu',
    // sostituzioni
    'sostituisci', 'sostituire', 'cambia', 'cambiare', 'metti', 'mettere', 'al', 'posto', 'invece',
    'con', 'usa', 'usare',
    // aggiunte e rimesse
    'aggiungi', 'aggiungere', 'rimetti', 'rimettere', 'dai', 'darle',
    // liste e famiglie
    'lista', 'elenco', 'famiglia', 'crea', 'creami', 'mostrami', 'fammi', 'vedere', 'hai',
    // preposizioni, articoli, congiunzioni
    'a', 'ad', 'al', 'alla', 'allo', 'ai', 'agli', 'alle', 'per', 'di', 'del', 'della', 'dello',
    'dei', 'delle', 'degli', 'da', 'dal', 'dalla', 'in', 'nel', 'nella', 'su', 'sul', 'sulla',
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'e', 'ed', 'o', 'ma', 'solo', 'anche',
    'che', 'come', 'si', 'no',
  ].map((p) => normalizza(p)),
);

/** Le parole piene di un testo: si ignorano quelle corte, che non portano contenuto. */
/** ⚠️ Esportata per le prove: la sua cecità sui token corti è un fatto che va tenuto scritto. */
export function parolePiene(testo: string): string[] {
  return normalizza(testo)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3);
}

/** La radice grossolana di una parola: i primi caratteri. Regge i refusi e le desinenze. */
const radice = (p: string): string => p.slice(0, 4);

export interface EsitoRiscrittura {
  ok: boolean;
  /** La frase da rileggere, ripulita. Presente solo se `ok`. */
  frase?: string;
  /** Perché è stata rifiutata: va nei log, non alla nutrizionista. */
  perche?: string;
}

/**
 * ⚠️ LA GUARDIA: il modello può RIORDINARE, non AGGIUNGERE.
 *
 * Ogni parola piena della riscrittura deve o venire dalla frase originale (confronto per radice, così
 * «sostitusci» → «sostituisci» passa) o essere una parola della forma. Basta una parola nuova e la
 * riscrittura si butta: meglio un «non ci arrivo» che una regola in più nel piatto di qualcuno.
 */
export interface ComeGuardare {
  /**
   * ⚠️ **Tiene gli a capo.** Serve al metodo di cottura, dove la riscrittura è «il modo su una riga,
   * i passaggi sotto»: appiattendola su una riga sola il parser non troverebbe più i passaggi, e la
   * riscrittura diventerebbe inutile proprio nel caso per cui esiste.
   */
  multiriga?: boolean;
  /**
   * ⛔ **I passaggi possono restare identici, e non è un'omissione.**
   *
   * Per un comando una riscrittura uguale all'originale non aggiunge niente — `capisci` ha già detto
   * di no — e si butta. Sul metodo no: quello che la riscrittura aggiunge è **la prima riga**, il
   * modo di cottura; i passaggi restano le parole di chi ha scritto, ed è esattamente quello che il
   * prompt gli chiede di fare. Senza questa opzione «si fa in due minuti» veniva rifiutato perché i
   * suoi passaggi erano, giustamente, sé stessi.
   */
  puoRestareUguale?: boolean;
}

/** ⚠️ Gli spazi si stringono, gli a capo restano quando servono: vedi `ComeGuardare.multiriga`. */
function ripulisci(t: string, multiriga: boolean): string {
  if (!multiriga) return t.trim().replace(/\s+/g, ' ');
  return t.trim().split('\n').map((r) => r.replace(/[^\S\n]+/g, ' ').trim()).filter(Boolean).join('\n');
}

export function riscritturaAccettabile(originale: string, riscritta: unknown, come: ComeGuardare = {}): EsitoRiscrittura {
  if (typeof riscritta !== 'string') return { ok: false, perche: 'il modello non ha restituito una stringa' };
  const frase = ripulisci(riscritta, come.multiriga === true);
  if (!frase) return { ok: false, perche: 'riscrittura vuota' };
  if (frase.length > MAX_CARATTERI) return { ok: false, perche: `riscrittura troppo lunga (${frase.length} caratteri)` };
  // Una riscrittura che è la frase di prima non ha aggiunto niente: `capisci` ha già detto no.
  if (!come.puoRestareUguale && normalizza(frase) === normalizza(originale)) {
    return { ok: false, perche: 'riscrittura identica all\'originale' };
  }

  /**
   * ⚠️ I NUMERI SI CONTROLLANO A PARTE, e non è pedanteria: il filtro delle parole scarta quelle
   * sotto le tre lettere, quindi «riduci le calorie a Giulia» → «riduci le calorie **del 30%** a
   * Giulia» ci passava in mezzo. E `capisci` legge le percentuali (`leggiCorrezioneKcal`,
   * `leggiProteine`): un numero inventato dal modello non è una parola in più in una frase, è il
   * fabbisogno calorico di una persona cambiato da nessuno.
   * Trovato da un test, non a ragionamento: la prima versione di questa guardia lo lasciava passare.
   */
  const numeriDi = (t: string): string[] => t.match(/\d+/g) ?? [];
  const numeriOriginali = new Set(numeriDi(originale));
  const numeriNuovi = numeriDi(frase).filter((n) => !numeriOriginali.has(n));
  if (numeriNuovi.length) return { ok: false, perche: `numeri non presenti nella frase: ${numeriNuovi.join(', ')}` };

  const radiciOriginali = new Set(parolePiene(originale).map(radice));
  const nuove = parolePiene(frase).filter((p) => !PAROLE_DELLA_FORMA.has(p) && !radiciOriginali.has(radice(p)));
  if (nuove.length) return { ok: false, perche: `parole non presenti nella frase: ${nuove.join(', ')}` };

  return { ok: true, frase };
}

/** Le istruzioni al modello. Corte, e senza un solo dato di nessuno dentro. */
export const SYSTEM_SECONDA_LETTURA = [
  'Riscrivi in italiano la frase dell\'utente nella forma canonica di un comando, senza aggiungere niente.',
  '',
  'REGOLE ASSOLUTE:',
  '- usa SOLO le parole che ci sono nella frase; puoi correggere refusi, coniugare i verbi e aggiungere',
  '  preposizioni o articoli, ma NON puoi aggiungere alimenti, nomi di persona, numeri o concetti;',
  '- non spiegare, non commentare, non fare domande: restituisci solo la frase riscritta;',
  '- se non riesci a ricondurla a una di queste forme, restituisci la stringa vuota.',
  '',
  'FORME CANONICHE (esempi):',
  '- «a NOME niente ALIMENTO» (divieto per una cliente)',
  '- «a NOME sostituisci ALIMENTO con ALIMENTO»',
  '- «a NOME togli lo spuntino» / «a NOME rimetti la merenda»',
  '- «crea la lista dei ALIMENTI» / «hai la lista dei ALIMENTI»',
  '',
  'Rispondi con un JSON: {"frase": "..."}',
].join('\n');

/** Il messaggio utente: la frase, e nient'altro. */
export const promptSecondaLettura = (frase: string): string => `Frase da riscrivere:\n${frase.trim()}`;

export interface DipendenzeSecondaLettura {
  /** `AiService.generateJson`: torna `null` su qualunque errore, e non lancia. */
  chiediAlModello: (system: string, prompt: string) => Promise<{ frase?: unknown } | null>;
  /** `capisci`, passata da fuori: questo modulo non decide niente da sé. */
  capisci: (frase: string) => unknown;
  /** Vero se la frase non deve nemmeno arrivare al modello (domande, negazioni dell'istruzione). */
  daScartare: (frase: string) => boolean;
  /** Dove finiscono i rifiuti della guardia: si scrivono, non si ingoiano. */
  avvisa?: (messaggio: string) => void;
}

export interface LetturaRiuscita<T> {
  /** La frase come il modello l'ha riscritta: è quella che si MOSTRA. */
  riscritta: string;
  /** L'intento, che l'ha capito `capisci` e non il modello. */
  intento: T;
}

/**
 * La seconda lettura. Torna `null` in tutti i casi in cui oggi si dice «non ci arrivo»: frase da
 * scartare, modello non disponibile, riscrittura rifiutata dalla guardia, riscrittura che `capisci`
 * non riconosce comunque.
 *
 * ⚠️ Non si chiama il modello se `capisci` la frase la capisce già: questa funzione va invocata
 * **solo** dopo un `null`. Il costo è una chiamata sul giro che era comunque perso.
 */
export async function secondaLettura<T>(
  frase: string,
  deps: DipendenzeSecondaLettura,
): Promise<LetturaRiuscita<T> | null> {
  const testo = (frase ?? '').trim();
  if (!testo) return null;
  // ⚠️ PRIMA della chiamata: una domanda non diventa un ordine passando da un modello.
  if (deps.daScartare(testo)) return null;

  const risposta = await deps.chiediAlModello(SYSTEM_SECONDA_LETTURA, promptSecondaLettura(testo));
  if (!risposta) return null; // modello non disponibile: si torna al comportamento di oggi

  const esito = riscritturaAccettabile(testo, risposta.frase);
  if (!esito.ok || !esito.frase) {
    // Un rifiuto silenzioso è un mistero: se la guardia scatta spesso, va saputo.
    if (esito.perche) deps.avvisa?.(`Seconda lettura rifiutata (${esito.perche}) su: «${testo}»`);
    return null;
  }

  const intento = deps.capisci(esito.frase) as T | null;
  if (!intento) return null;
  return { riscritta: esito.frase, intento };
}

/**
 * ⛔ **LA SECONDA LETTURA DEL METODO DI COTTURA — Simone, 4/9: «Vera utilizza una AI giusto?».**
 *
 * Sì, e da oggi anche qui. Il giro è **lo stesso** del resto del file, con le stesse tre proprietà:
 * il modello **riscrive**, a decidere resta il parser deterministico (`leggiMetodo`), e la
 * riscrittura **si mostra** prima di andare avanti.
 *
 * ## A che cosa serve davvero
 *
 * «lo butto in forno finché non è dorato» il parser non lo capisce: nomina il forno dentro una
 * frase, non risponde «al forno». Chiedeva di nuovo, e chiedere due volte la stessa cosa è il modo
 * più sicuro di farsi rispondere «lascia stare». Il modello lo riscrive in
 * «al forno / buttarlo in forno finché non è dorato», e da lì decide il parser.
 *
 * ## ⛔ E perché NON si estende al testo della ricetta
 *
 * Simone l'ha chiesto per «i passi», e su questo passo ha senso. Sul **testo della ricetta** no, e
 * non è prudenza: la guardia vieta di **aggiungere** parole, quindi quello che manca davvero a una
 * ricetta incompleta — il pasto, il regime — il modello non lo può mettere, ed è giusto così. Gli
 * resterebbe da riformattare gli ingredienti: un lavoro in cui l'unico errore possibile è **perdere
 * una riga**, cioè calorie che non si contano.
 *
 * ⛔ **E una guardia «niente omissioni» non lo chiuderebbe**, l'ho scritta e tolta il 4/9 dopo una
 * revisione: `parolePiene` scarta i token sotto le tre lettere, quindi «tonno 80 g» che diventa
 * «tonno g» le passa sotto; e due ingredienti con la stessa radice — «pomodoro» e «pomodorini» — si
 * coprono a vicenda. Una guardia che promette di vedere le omissioni e non vede proprio quelle che
 * contano è peggio della sua assenza, perché ci si appoggia.
 * ⚠️ Sugli **allergeni** vale lo stesso, in peggio: lì una parola persa è una cliente allergica che
 * riceve il piatto. Restano tutti e due deterministici, e questa riga dice perché.
 */
export const SYSTEM_METODO = [
  'Riscrivi la risposta dell\'utente come un metodo di cottura, senza aggiungere niente.',
  '',
  'FORMA:',
  '- prima riga: SOLO il modo di cottura, fra questi — veloce, al forno, in padella, al vapore,',
  '  meal prep, piatto freddo;',
  '- righe successive: i passaggi, uno per riga, CON LE PAROLE DELL\'UTENTE, senza riscriverle.',
  '',
  'REGOLE ASSOLUTE:',
  /**
   * ⚠️ **Ai passaggi si chiede di NON riscrivere i verbi**, e non è un dettaglio di stile: la
   * guardia confronta le radici, e «si fa» → «farlo» cambia radice — quindi una riscrittura
   * fedelissima nel senso veniva buttata come parola nuova. Al modello serve **spezzare le righe**,
   * non migliorare la prosa.
   */
  '- nei passaggi usa SOLO le parole che ci sono nella risposta, com\'erano: puoi correggere refusi',
  '  e spezzare le frasi in righe, ma NON riscrivere i verbi e NON aggiungere ingredienti, numeri,',
  '  tempi o temperature che non ci sono;',
  '- non inventare passaggi: se ne ha scritto uno solo, la riscrittura ne ha uno solo;',
  '- se il modo di cottura non si capisce dalla risposta, restituisci la stringa vuota:',
  '  NON sceglierne uno plausibile;',
  '- non spiegare e non commentare.',
  '',
  'Rispondi con un JSON: {"frase": "..."}',
].join('\n');

export interface LetturaDelMetodo<T> {
  /** La riscrittura, che si MOSTRA prima di andare avanti. */
  riscritta: string;
  /** Quello che ne ha capito il parser: il modello non decide. */
  esito: T;
}

/**
 * Il secondo tentativo sul metodo. `null` in tutti i casi in cui oggi si richiede: modello non
 * disponibile, riscrittura rifiutata dalla guardia, o riscrittura che il parser **ancora** non
 * riconosce come un metodo completo.
 *
 * ⚠️ Si chiama **solo dopo** che il parser ha già detto di no: il costo è una chiamata sul giro che
 * era comunque perso.
 */
export async function secondaLetturaMetodo<T>(
  frase: string,
  deps: {
    chiediAlModello: (system: string, prompt: string) => Promise<{ frase?: unknown } | null>;
    /** `leggiMetodo`, passata da fuori: questo modulo non decide niente da sé. */
    leggi: (frase: string) => T;
    /** Vero se quello che ne esce è un metodo completo. */
    completo: (esito: T) => boolean;
    avvisa?: (messaggio: string) => void;
  },
): Promise<LetturaDelMetodo<T> | null> {
  const testo = (frase ?? '').trim();
  if (!testo) return null;

  const risposta = await deps.chiediAlModello(SYSTEM_METODO, promptSecondaLettura(testo));
  if (!risposta) return null;

  /**
   * ⛔ **LA GUARDIA SI APPLICA AI PASSAGGI, NON ALLA PRIMA RIGA** — corretto il 4/9 dopo una
   * revisione, ed è la differenza fra una funzione che lavora e una che rifiuta quasi sempre.
   *
   * La guardia dei comandi vieta ogni parola che non fosse nell'originale. Ma la prima riga che
   * questo prompt **chiede** è il nome del modo — «al forno», «piatto freddo», «meal prep» — e chi
   * scrive «lo lascio crudo» o «si fa in due minuti» quelle parole non le ha usate. Risultato: la
   * riscrittura giusta veniva buttata in quattro casi su sei, e la seconda lettura serviva quasi
   * solo a chi il nome del modo l'aveva già scritto — cioè quasi a nessuno.
   *
   * ⚠️ **E toglierla dalla prima riga non apre un buco**, perché quella riga è guardata da altri
   * due: `leggiMetodo` accetta solo i sei codici di `CODICI_METODI`, e soprattutto **il modo lo
   * conferma una persona** (vedi `metodoProposto` in `vera-chat.ts`). Il modello propone una parola
   * fra sei, davanti agli occhi di chi l'ha scritta.
   *
   * ⛔ **I PASSAGGI invece restano stretti**, e lì la guardia è tutto quello che c'è: un passaggio
   * inventato — un tempo, una temperatura, un ingrediente in più — finisce nella scheda che una
   * persona legge mentre cucina, e nessuno lo conferma riga per riga.
   */
  const righe = String(risposta.frase ?? '').split('\n').map((r) => r.trim()).filter(Boolean);
  if (righe.length < 2) return null;
  const [primaRiga, ...passaggi] = righe;

  const guardia = riscritturaAccettabile(testo, passaggi.join('\n'), { multiriga: true, puoRestareUguale: true });
  if (!guardia.ok || !guardia.frase) {
    if (guardia.perche) deps.avvisa?.(`Seconda lettura del metodo rifiutata (${guardia.perche}) su: «${testo}»`);
    return null;
  }

  const riscritta = `${primaRiga}\n${guardia.frase}`;
  const esito = deps.leggi(riscritta);
  if (!deps.completo(esito)) return null;
  return { riscritta, esito };
}
