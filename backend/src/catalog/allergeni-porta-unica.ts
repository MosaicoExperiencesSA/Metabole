import { chiaveCombacia } from '../menu/exclusions';
import { EU_ALLERGENS, chiaveCombaciaOggi } from './allergens';
import { nomiIngredienti } from './elenco-ingredienti';

/**
 * ⛔ **QUANTO COSTA CHIUDERE LA SECONDA COPIA DI «QUESTA CHIAVE VALE?» — misurato, prima di
 * toccare il catalogo.**
 *
 * `menu/exclusions.ts` risponde a quella domanda con **tre** filtri: le parole omonime
 * (`PAROLE_CHE_NON_SONO`), le frasi che non sono (`FRASI_CHE_NON_SONO`) e — dal 4/9 —
 * `SOLO_A_INIZIO_PAROLA`, la risposta alle **famiglie aperte** dove un elenco chiuso non basterebbe
 * mai. `catalog/allergens.ts` ne ha una copia sua che conosce le prime due e **non la terza**.
 *
 * ⚠️ **Non è una differenza teorica, e non è simmetrica**: i tag allergene suggeriti **vengono
 * scritti** sulle ricette, e da lì tolgono il piatto a chi dichiara quell'allergene. Misurato sulle
 * parole del riquadro del 4/9:
 *
 *     melograno       → glutine   (grano dentro melograno: è un albero)
 *     melagrana       → latte     (grana dentro melagrana)
 *     piselli sgranati→ latte     (sgranare è quello che si fa ai piselli)
 *
 * ## ⛔ Perché il conto sta QUI e non dentro lo script
 *
 * Perché da questo numero dipende se la porta unica si può accendere in blocco o va letta riga per
 * riga, e **un giudizio che decide non sta in un file di `prisma/` che nessun test guarda**. È la
 * lezione del tabulato dei panieri dell'1/9, che diceva «⛔ non spostare» in cima e «✅ si può
 * spostare» dodici righe sotto.
 *
 * ## ⚠️ E l'errore ha un verso solo
 *
 * La porta unica **toglie** tag, non ne aggiunge: `SOLO_A_INIZIO_PAROLA` è un filtro in più. Quindi
 * ogni riga di questo conto è un piatto che **torna disponibile** a chi ha quell'allergia — e la
 * domanda per chi legge è una sola: *quella parola conteneva davvero l'allergene?* Se la risposta è
 * no, la riga è un piatto restituito; se fosse sì, sarebbe protezione tolta. Per questo il tabulato
 * stampa la **parola** e non solo il numero.
 */

/** Un allergene dedotto, con dentro i nomi di ingrediente che l'hanno fatto scattare. */
export interface AllergeneDedotto {
  allergen: string;
  matched: string[];
}

/**
 * Gli allergeni dedotti **con la porta unica** — cioè con la stessa `chiaveVale` che usano le
 * esclusioni della cliente.
 *
 * ⚠️ È una copia deliberata di `suggestAllergens` con una riga sola cambiata, e vive solo finché
 * dura la misura: il giorno che il numero si legge, `suggestAllergens` chiama `chiaveCombacia` e
 * questa funzione sparisce. Tenerne due in produzione sarebbe rifare il difetto che misura.
 */
export function allergeniConPortaUnica(ingredients: unknown): AllergeneDedotto[] {
  const nomi = nomiIngredienti(ingredients).map((n) => n.toLowerCase());
  const out: AllergeneDedotto[] = [];
  for (const a of EU_ALLERGENS) {
    const matched = nomi.filter((nome) => a.keywords.some((kw) => chiaveCombacia(nome, kw)));
    if (matched.length) out.push({ allergen: a.code, matched: [...new Set(matched)] });
  }
  return out;
}

/**
 * La **parola intera** dentro cui una chiave combacia senza cominciarla — cioè quella che chi legge
 * deve giudicare.
 *
 * ⚠️ Torna `null` quando la chiave comincia sempre una parola: in quel caso non c'è niente da
 * decidere, e stampare la riga vorrebbe dire mettere lavoro già fatto in un elenco di lavoro da
 * fare. *Un elenco che contiene lavoro già fatto è un elenco che si smette di leggere.*
 */
export function parolaCheContiene(testo: string, chiave: string): string | null {
  return paroleCheContengono(testo, chiave)[0] ?? null;
}

/**
 * ⛔ **TUTTE le parole, non la prima — e la prima stesura ne rendeva una sola.**
 *
 * Su «melagrana e piselli sgranati» tornava `melagrana` e basta: `sgranati`, per quella ricetta,
 * non esisteva. ⚠️ Non si perde un esempio, si perde una **riga dell'elenco da leggere** — e una
 * parola che compare sempre accanto a un'altra non compare **mai**, mentre chi legge crede di avere
 * l'elenco completo.
 */
export function paroleCheContengono(testo: string, chiave: string): string[] {
  const out: string[] = [];
  let i = testo.indexOf(chiave);
  while (i !== -1) {
    const inizioParola = i === 0 || !/[a-z0-9]/.test(testo[i - 1]);
    if (!inizioParola) {
      let a = i; while (a > 0 && /[a-z0-9]/.test(testo[a - 1])) a -= 1;
      let b = i + chiave.length; while (b < testo.length && /[a-z0-9]/.test(testo[b])) b += 1;
      const parola = testo.slice(a, b);
      if (!out.includes(parola)) out.push(parola);
    }
    i = testo.indexOf(chiave, i + 1);
  }
  return out;
}



/** Una ricetta, come serve a questo conto. */
export interface RicettaDaContare {
  id: string;
  name: string;
  ingredients: unknown;
  /** Gli allergeni **scritti** oggi in catalogo. */
  allergens?: readonly string[];
  /**
   * ⛔ **La spunta di conferma, e pesa diverso.** Un tag che ha scritto il riconoscitore e nessuno
   * ha guardato è un'ipotesi; un tag su una ricetta **confermata** è una cosa che qualcuno ha detto.
   * ⚠️ Con la cautela che il progetto si è già scritto il 31/8: `allergensReviewed` comprende anche
   * le conferme **in blocco** del 19/8, dove gli allergeni li aveva scritti il riconoscitore. Quindi
   * «confermate» non vuol dire «guardate una per una» — vuol dire «qualcuno ha premuto il pulsante».
   */
  allergensReviewed?: boolean;
}

/** Una coppia (allergene, parola) che la porta unica smette di far scattare. */
export interface CoppiaPersa {
  allergen: string;
  chiave: string;
  parola: string;
  /** Quante ricette perdono quell'allergene per colpa di questa parola. */
  ricette: number;
  /** Di quelle, quante ce l'hanno **scritto** in catalogo — cioè quante cambiano davvero. */
  scritte: number;
  /** Di quelle scritte, quante portano la spunta di conferma. Vedi `allergensReviewed`. */
  confermate: number;
  esempi: string[];
}

export interface ContoPortaUnica {
  esaminate: number;
  /** Ricette il cui elenco di allergeni **dedotti** cambia. */
  cambiano: number;
  /** Ricette che oggi hanno quell'allergene **scritto** in catalogo e lo perderebbero. */
  cambianoDavvero: number;
  /** Di quelle, quante portano la spunta di conferma: lì il tag qualcuno l'ha accettato. */
  cambianoConfermate: number;
  /** ⛔ Deve restare zero: la porta unica aggiunge un filtro, quindi non può guadagnare allergeni. */
  guadagnati: number;
  coppie: CoppiaPersa[];
}

const MAX_ESEMPI = 3;

/**
 * ⛔ **IL VERDETTO, e i tre numeri che non vanno confusi.**
 *
 * · **`cambiano`** — quante ricette cambiano l'elenco *dedotto*. È il numero grosso e da solo non
 *   decide niente: la deduzione oggi non è scritta su tutte.
 * · **`cambianoDavvero`** — quante hanno quell'allergene **scritto** in `Recipe.allergens`. Sono
 *   quelle che, accendendo la porta unica e ripassando la deduzione, tornerebbero servibili a chi
 *   dichiara quell'allergia. È il numero su cui si decide.
 * · **`guadagnati`** — deve essere **zero**. Se non lo è, la porta unica non è un filtro in più:
 *   vuol dire che le due copie divergevano in un modo che nessuno aveva capito, e la misura va
 *   riletta prima di toccare qualunque cosa.
 */
export function contaPortaUnica(
  ricette: readonly RicettaDaContare[],
  allergeniOggi: (ingredients: unknown) => AllergeneDedotto[],
): ContoPortaUnica {
  const perCoppia = new Map<string, CoppiaPersa>();
  /**
   * ⛔ **Una ricetta conta UNA VOLTA per coppia, e la prima stesura contava gli ingredienti.**
   *
   * Il ciclo gira sui nomi di ingrediente, e in catalogo lo stesso allergene compare più volte
   * nello stesso elenco: `['melograno', 'succo di melograno', 'chicchi di melograno']` faceva
   * `ricette = 3` su una ricetta sola, con lo stesso nome stampato tre volte negli esempi. ⚠️ E
   * gonfiava **nel verso che fa sembrare grosso un lavoro che non c'è**: chi somma le righe del
   * tabulato otteneva un numero più alto di «cambiano davvero», senza che niente glielo dicesse.
   * L'ha trovato una revisione avversariale.
   */
  const gia = new Set<string>();
  let cambiano = 0;
  let cambianoDavvero = 0;
  let cambianoConfermate = 0;
  let guadagnati = 0;

  for (const r of ricette) {
    const oggi = allergeniOggi(r.ingredients);
    const dopo = allergeniConPortaUnica(r.ingredients);
    const codiciDopo = new Set(dopo.map((a) => a.allergen));
    const persi = oggi.filter((a) => !codiciDopo.has(a.allergen));
    const nuovi = dopo.filter((a) => !oggi.some((b) => b.allergen === a.allergen));
    if (nuovi.length) guadagnati += 1;
    if (!persi.length) continue;
    cambiano += 1;
    const scritti = new Set((r.allergens ?? []).map((x) => String(x)));
    if (persi.some((a) => scritti.has(a.allergen))) {
      cambianoDavvero += 1;
      if (r.allergensReviewed) cambianoConfermate += 1;
    }

    for (const a of persi) {
      const def = EU_ALLERGENS.find((x) => x.code === a.allergen);
      for (const nome of a.matched) {
        for (const kw of def?.keywords ?? []) {
          /**
           * ⛔ **Solo le chiavi che la porta unica SCARTA DAVVERO** — la prima stesura girava su
           * tutte le keyword dell'allergene perso, e bastava che una seconda comparisse dentro una
           * parola qualunque dello stesso ingrediente per finire in elenco. Misurato: su «insalata
           * di rapanelli e melograno» usciva anche «pane» dentro «rapanelli», che con la perdita
           * del glutine non c'entra niente — quella la toglie `grano`.
           */
          if (!chiaveCombaciaOggi(nome, kw) || chiaveCombacia(nome, kw)) continue;
          for (const parola of paroleCheContengono(nome, kw)) {
            /**
             * ⛔ **QUI NON SI CHIAMA `coppiaGiaDecisa`, e la revisione lo aveva chiesto: sbagliava.**
             *
             * Quella funzione risponde «già decisa» anche quando la chiave sta in
             * `SOLO_A_INIZIO_PAROLA` — e `grana` ci sta. Cioè avrebbe cancellato dall'elenco
             * **esattamente le righe per cui questo tabulato esiste**: le decisioni prese in
             * `exclusions.ts` e non lette da `allergens.ts` sono il difetto, non lavoro già fatto.
             *
             * ⚠️ Il caso vero che la revisione aveva misurato — «pane» dentro «rapanelli» — non
             * arriva fin qui: lo scarta la riga sopra, perché `allergens.ts` le omonime le conosce
             * già e quella chiave non fa scattare niente nemmeno oggi. Il filtro giusto era uno
             * solo, e non è questo.
             */
            const chiave = `${a.allergen}|${kw}|${parola}`;
            const riga = perCoppia.get(chiave)
              ?? { allergen: a.allergen, chiave: kw, parola, ricette: 0, scritte: 0, confermate: 0, esempi: [] };
            /** ⚠️ Una ricetta vale uno, anche se quella parola le compare in tre ingredienti. */
            const gettone = `${chiave}|${r.id}`;
            if (!gia.has(gettone)) {
              gia.add(gettone);
              riga.ricette += 1;
              if (scritti.has(a.allergen)) {
                riga.scritte += 1;
                if (r.allergensReviewed) riga.confermate += 1;
              }
              if (riga.esempi.length < MAX_ESEMPI) riga.esempi.push(r.name);
            }
            perCoppia.set(chiave, riga);
          }
        }
      }
    }
  }

  return {
    esaminate: ricette.length,
    cambiano,
    cambianoDavvero,
    cambianoConfermate,
    guadagnati,
    /** ⚠️ In ordine di quante ricette toccano davvero: chi legge parte da dove il conto pesa. */
    coppie: [...perCoppia.values()].sort((a, b) => (b.scritte - a.scritte) || (b.ricette - a.ricette)),
  };
}
