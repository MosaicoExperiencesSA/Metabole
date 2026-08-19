/**
 * ABBINARE IL NOME DI UN INGREDIENTE ALLA RIGA DELLA TABELLA — quando non combaciano esatti.
 *
 * Dal primo giro di `npm run diag:crudo-cotto` in produzione (19/8): **7831** nomi di ingredienti
 * usati nelle ricette attive non si trovano in tabella. Guardando i primi si capisce che non è un
 * elenco da riempire, è un problema di **abbinamento**:
 *
 *     «olio extravergine»        (2771 ricette)  →  in tabella c'è «olio extravergine di oliva»
 *     «olio extravergine d oliva» (2486 ricette)  →  la stessa riga
 *     «olio extravergine oliva»  (1237 ricette)  →  la stessa riga
 *     «spinaci freschi»          (1350 ricette)  →  in tabella c'è «spinaci»
 *     «noci sgusciate»           ( 748 ricette)  →  in tabella c'è «noci»
 *
 * Le ricette generate dall'AI usano **nomi liberi**, e nessuna tabella li coprirà mai: la strada non
 * è aggiungere righe, è riconoscere che quei nomi parlano di righe che ci sono già.
 *
 * ## ⚠️ Il danno vero, che è più piccolo di quello che sembra
 *
 * Le ricette generate portano le calorie **calcolate dall'AI**, non sommate da qui: quel numero non
 * è sbagliato per colpa dei nomi. La somma dalla tabella la fa `calcolaMacro` solo quando la
 * nutrizionista **detta** una ricetta a Vera, e lì quello che manca **si dichiara** e blocca.
 *
 * Il danno quotidiano è un altro: **Gaia risponde «non ce l'ho» su alimenti che ci sono**. La
 * ricerca cerca il nome della tabella *dentro* la domanda, e «olio extravergine di oliva» dentro
 * «quante calorie ha l'olio extravergine?» non c'è.
 *
 * ## LE DUE REGOLE, e perché sono strette
 *
 * ⚠️ **Non un dizionario di sinonimi scritto a mano**: si riempie una volta e invecchia dal giorno
 * dopo, alla prima generazione di ricette. ⚠️ **E non un abbinamento «somigliante»**: la somiglianza
 * fra «riso» e «riso integrale» è altissima, e scambiarli è **esattamente** il difetto da cui è nata
 * tutta questa storia (voce 228).
 *
 * 1. **Le PAROLINE non contano.** «olio extravergine d oliva» e «olio extravergine oliva» hanno le
 *    stesse parole che distinguono di «olio extravergine **di** oliva»: sono la stessa riga scritta
 *    in tre modi, e 3723 ricette la scrivono in uno dei due modi «sbagliati».
 * 2. **La ricetta aggiunge solo QUALIFICATORI INNOCUI.** «spinaci freschi» → «spinaci», «mandorle
 *    sgusciate» → «mandorle»: parole che dicono com'è presentato, non cosa è.
 *
 * ⚠️ **LA REGOLA 2 È NATA SBAGLIATA, E L'HA MOSTRATO IL PRIMO GIRO IN PRODUZIONE** (19/8). Diceva
 * «tutte le parole della riga compaiono nel nome dell'ingrediente», e su una riga che si chiama
 * «zucca» — o che ha un sinonimo corto come «olio» — ci cascava dentro qualunque cosa:
 *
 *     «semi di zucca»   → «zucca»                     531 ricette · ~550 kcal contro 26: VENTI volte
 *     «olio di cocco»   → «olio extravergine di oliva» 400 ricette · non è lo stesso olio
 *     «olio di sesamo»  → «olio extravergine di oliva» 282 ricette
 *
 * ⚠️ Le parole in più non sono sempre aggettivi: «semi di», «olio di», «farina di» fanno **un altro
 * alimento**. Quindi la regola si rovescia: non «tutto quello che non conosco è innocuo», ma **solo
 * quello che conosco come innocuo**. Un elenco chiuso si può leggere e discutere; «tutto il resto»
 * no — ed è il default che questo progetto usa dappertutto.
 *
 * ⚠️ E se fra le parole in più c'è una parola di **stato** — cotto, secche, tostate, bollite — non è
 * un abbinamento: è un altro stato, e lì decide `scegliPerRicetta` con la convenzione del crudo.
 * «Lenticchie rosse secche» non sono le «lenticchie» bollite della tabella.
 *
 * ⚠️ **NON ESISTE una terza regola «alla ricetta manca solo una parolina»**, e il test l'ha
 * dimostrato prima che la scrivessi in produzione: se al nome della ricetta manca una parola della
 * tabella, quella parola **distingue** — «olio extravergine» senza «oliva» potrebbe essere di
 * girasole, «riso» senza «integrale» è un altro riso. Una regola che le ignorasse sarebbe la stessa
 * scorciatoia da cui è nata tutta questa storia (voce 228). ⛔ Quei casi si chiudono con **un
 * sinonimo aggiunto a mano** — una riga, decisa da una persona — non con una regola che indovina.
 *
 * ⚠️ **E davanti a due righe che vanno bene uguale, non si sceglie**: si torna `null`. Indovinare
 * fra «latte intero» e «latte scremato» perché la ricetta dice «latte» vuol dire scrivere calorie
 * decise a caso.
 */

/**
 * I QUALIFICATORI INNOCUI: dicono **com'è presentato** un alimento, non **cosa è**.
 *
 * ⚠️ L'elenco è chiuso di proposito, ed è la correzione del 19/8: la prima versione della regola
 * accettava qualunque parola in più, e faceva diventare «semi di zucca» la zucca e «olio di cocco»
 * l'olio d'oliva. Aggiungere una voce qui è una decisione che si legge; «tutto quello che non
 * conosco è innocuo» non si legge, e sbaglia in silenzio.
 *
 * ⚠️ **Non ci sono parole di cottura o di conservazione** (cotto, secco, tostato, bollito): quelle
 * cambiano i numeri, e la loro casa è `scegliPerRicetta`.
 *
 * ⚠️ E il 19/8 sera la revisione avversariale ne ha tolte quattro che c'erano e non dovevano:
 *
 *     «pane grattugiato»  → «pane»    il pangrattato non è pane (~350 contro ~270 kcal)
 *     «pasta fresca»      → «pasta»   fresca ~290, secca ~350
 *     «cocco grattugiato» → «cocco»   essiccato oltre 600, fresco 354
 *     «latte intero»      → «latte»   sceglie da solo fra prodotti con grassi diversi
 *
 * ⚠️ `grattugiato` e `intero` **sembrano** innocui e non lo sono: dicono come è **lavorato** un
 * alimento, e la lavorazione cambia l'acqua che contiene — cioè le calorie per 100 g.
 *
 * ⚠️ **`fresco` è il caso interessante, e non si risolve con un elenco**: sugli spinaci è innocuo
 * («spinaci freschi» sono «spinaci», 1350 ricette), sulla pasta no («pasta fresca» ~290 contro ~350
 * della secca). La differenza non sta nella parola: sta nello **stato della riga** che si sta
 * abbinando. `fresco` vuol dire crudo (correzione di Simone sul latte, 19/8) — quindi si accetta
 * **solo se la riga è a crudo**, e su «pasta» (secca) non si accetta. Vedi `vaBene` dentro `abbina`.
 */
const QUALIFICATORI = new Set([
  'sgusciato', 'sgusciata', 'sgusciati', 'sgusciate',
  'pelato', 'pelata', 'pelati', 'pelate',
  'sbucciato', 'sbucciata', 'sbucciati', 'sbucciate',
  'tagliato', 'tagliata', 'tagliati', 'tagliate',
  'tritato', 'tritata', 'tritati', 'tritate',
  'affettato', 'affettata', 'affettati', 'affettate',
  'maturo', 'matura', 'maturi', 'mature',
  'bio', 'biologico', 'biologica', 'biologici', 'biologiche',
  'grande', 'grandi', 'piccolo', 'piccola', 'piccoli', 'piccole', 'medio', 'media', 'medi', 'medie',
  'qb',
]);

/** Le parole che non distinguono un alimento da un altro: preposizioni, articoli, congiunzioni. */
const PAROLINE = new Set([
  'di', 'd', 'da', 'del', 'della', 'dello', 'dei', 'degli', 'delle',
  'al', 'alla', 'allo', 'ai', 'agli', 'alle', 'in', 'con', 'e', 'ed',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'a',
]);

/** Le parole di un nome, senza accenti e senza punteggiatura. Le paroline restano: servono. */
import { normalizzaStato } from './stato-alimento';

export function paroleDi(nome: string): string[] {
  return (nome ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Le parole che **distinguono**: quelle che restano tolte le paroline. */
export const paroleChe = (nome: string): string[] => paroleDi(nome).filter((p) => !PAROLINE.has(p));

/**
 * È una parolina? ⚠️ Esportata perché la ricerca dentro una domanda deve poterle **saltare**, e
 * saltarle è diverso da toglierle: vedi `sequenzaDentro` in `nome-dentro-la-domanda.ts`, dove
 * toglierle incollava parole che nella domanda erano lontane.
 */
export const eParolina = (p: string): boolean => PAROLINE.has(p);

export type Regola = 'esatto' | 'ricetta_piu_specifica';

export interface Abbinamento<T> {
  riga: T;
  regola: Regola;
}

/**
 * La riga della tabella per un ingrediente scritto libero, o `null` se non si può dire.
 *
 * ⚠️ L'ordine delle regole è quello della certezza: prima l'uguaglianza, poi la ricetta più
 * specifica, poi le paroline. Provare prima la più larga vorrebbe dire perdere un abbinamento esatto
 * per uno approssimato.
 *
 * ⚠️ Dentro ogni regola, a parità si preferisce la riga **con più parole che distinguono**: fra
 * «riso» e «riso integrale», per un ingrediente «riso integrale bio» vince il secondo. Ma se due
 * righe restano pari davvero, si torna `null`.
 */
export function abbina<T>(
  ingrediente: string,
  righe: readonly T[],
  nomiDi: (r: T) => string[],
  /**
   * Lo stato della riga, se il chiamante ce l'ha. ⚠️ Serve alle parole in più che **sono uno stato**
   * («freschi», «secche»): si accettano solo quando **combaciano** con lo stato della riga. Senza
   * questo, «pasta fresca» prendeva la riga della pasta secca — 290 contro 350 kcal.
   */
  statoDi?: (r: T) => string | null | undefined,
): Abbinamento<T> | null {
  const mie = paroleChe(ingrediente);
  if (!mie.length) return null;
  const insieme = new Set(mie);

  type Candidata = { riga: T; peso: number };
  const esatti: Candidata[] = [];
  const specifiche: Candidata[] = [];

  for (const r of righe) {
    for (const nome of nomiDi(r)) {
      const sue = paroleChe(nome);
      if (!sue.length) continue;
      if (sue.length === mie.length && sue.every((p) => insieme.has(p))) {
        esatti.push({ riga: r, peso: sue.length });
        continue;
      }
      /**
       * 2) la ricetta aggiunge **solo qualificatori innocui**: «spinaci freschi» → «spinaci».
       *
       * ⚠️ Le parole in più si controllano una per una. La prima versione non lo faceva, e faceva
       * diventare «semi di zucca» la zucca (531 ricette, venti volte le calorie) e «olio di cocco»
       * l'olio d'oliva (400 ricette). Le parole in più non sono sempre aggettivi.
       */
      if (sue.every((p) => insieme.has(p))) {
        const inPiu = mie.filter((p) => !new Set(sue).has(p));
        const statoRiga = normalizzaStato(statoDi ? statoDi(r) : null);
        /**
         * ⚠️ Una parola in più va bene in due casi soli: è un **qualificatore innocuo** (sgusciate,
         * pelate, mature), oppure **è uno stato e combacia con quello della riga**. Il secondo caso è
         * quello degli «spinaci freschi»: «freschi» vuol dire crudo, e la riga «spinaci» è a crudo.
         * ⚠️ Su «pasta fresca» invece la riga è **secca**: gli stati non combaciano e non si abbina —
         * sono due prodotti con calorie diverse, e prima ci cascavano dentro.
         */
        const vaBene = (p: string) => {
          if (QUALIFICATORI.has(p)) return true;
          const suo = normalizzaStato(p);
          /**
           * ⚠️ Niente `statoRiga !== ''` qui, e la mutazione l'ha dimostrato: togliendolo restano
           * **tutti i test verdi**, perché con `suo !== ''` l'uguaglianza `suo === statoRiga` non
           * può essere vera quando la riga non dichiara lo stato. Era una condizione che non
           * scattava mai — e una condizione che non scatta mai fa credere che stia proteggendo
           * qualcosa. Il terzo stato («non lo so» = la riga non dichiara) è coperto lo stesso, e
           * ora c'è un test che lo tiene fermo.
           */
          return suo !== 'altro' && suo !== '' && suo === statoRiga;
        };
        if (inPiu.length && inPiu.every(vaBene)) {
          specifiche.push({ riga: r, peso: sue.length });
        }
      }
      /**
       * ⚠️ E basta. Il caso opposto — al nome della ricetta manca una parola della tabella — **non**
       * si abbina: quella parola distingue, e «olio extravergine» senza «oliva» potrebbe essere di
       * girasole. Si chiude con un sinonimo scritto da una persona, non con una regola che indovina.
       */
    }
  }

  for (const [gruppo, regola] of [
    [esatti, 'esatto'],
    [specifiche, 'ricetta_piu_specifica'],
  ] as [Candidata[], Regola][]) {
    if (!gruppo.length) continue;
    const max = Math.max(...gruppo.map((c) => c.peso));
    const migliori = gruppo.filter((c) => c.peso === max);
    /**
     * ⚠️ DUE RIGHE CHE VANNO BENE UGUALE = NON LO SO. Indovinare fra «latte intero» e «latte
     * scremato» perché la ricetta dice «latte» vuol dire scrivere calorie decise a caso — e
     * nessuno se ne accorgerebbe, perché il numero è plausibile.
     */
    const distinte = new Set(migliori.map((c) => c.riga));
    if (distinte.size > 1) return null;
    return { riga: migliori[0].riga, regola };
  }
  return null;
}
