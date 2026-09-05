import { EU_ALLERGENS, SENZA_PER_ALLERGENE, diceSenza, suggestAllergens } from './allergens';
import { PAROLE_CHE_NON_SONO, chiaveCombacia, dentroUnaFraseCheNonE } from '../menu/exclusions';
import { nomiIngredienti } from './elenco-ingredienti';

/**
 * ⛔ **QUELLO CHE LA PORTA UNICA SI LASCIA DIETRO: 190 RICETTE CON UN ALLERGENE FALSO SCRITTO.**
 *
 * Fino al 4/9 `catalog/allergens.ts` aveva una **copia sua** di «questa chiave vale?» che non
 * consultava `SOLO_A_INIZIO_PAROLA`. Adesso chiama la stessa funzione delle esclusioni, e da oggi
 * nessuna ricetta nuova nasce con quei tag.
 *
 * ⛔ **Ma correggere la funzione non riporta indietro quello che è già scritto** — è la lezione
 * dell'1/9 sul riconoscitore della carne, scritta a caratteri grandi in quella voce. Le 190 ricette
 * che il tabulato ha contato hanno il tag falso **in catalogo**, con la spunta di conferma, e da lì
 * continuano a togliere il piatto a chi ha quell'allergia finché qualcuno non le riscrive.
 *
 *     melograno     → glutine   63     dorata (zucca)       → pesce   17
 *     melagrana     → latte     58     sgranato             → latte    6
 *     sgranati      → latte     43     melograna            → latte    1
 *     (edamame)                        sgranocchiate        → glutine  1
 *                                      corata (di coniglio) → pesce    1
 *
 * ## ⚠️ Perché si toglie SOLO l'allergene falso, e non si riscrive l'elenco
 *
 * La strada comoda sarebbe `allergens = suggestAllergens(ingredienti)`: una riga. ⛔ E cancellerebbe
 * gli allergeni che una nutrizionista ha **aggiunto a mano** (`setRecipeAllergens` esiste, ed è la
 * porta per le cose che dagli ingredienti non si vedono — un condimento pronto, una contaminazione
 * di lavorazione). Cioè per togliere una protezione falsa se ne toglierebbero di vere, in silenzio.
 *
 * ⚠️ Quindi si toglie un allergene **solo** quando si può dire perché: la deduzione di oggi non lo
 * trova **e** una chiave combaciava dentro una parola più lunga. *Se non si sa perché c'era, resta.*
 */

/**
 * ⛔ **LA VECCHIA PORTA, RIMESSA QUI APPOSTA E SOLO QUI — perché senza si cancella protezione vera.**
 *
 * La riparazione deve togliere quello che **la vecchia porta aveva scritto**, non «tutto quello per
 * cui una chiave combacia dentro una parola». Sembrano la stessa cosa e non lo sono: una revisione
 * avversariale ha misurato che il criterio largo **toglie allergeni messi a mano**.
 *
 *     solfiti su «straccetti di bovino»          ← «vino» dentro «bovino»
 *     glutine su «melograno + salsa di soia»     ← «grano» dentro «melograno»
 *     pesce   su «zucca dorata + worcestershire» ← «orata» dentro «dorata»
 *
 * ⚠️ In tutti e tre la **vecchia porta non aveva scritto niente** — le omonime le conosceva
 * (`bovino` è in `PAROLE_CHE_NON_SONO` dal 20/8) — quindi quel tag può esserci solo perché ce l'ha
 * messo una persona, su cose che dagli ingredienti non si vedono: il vino del brasato, il frumento
 * della salsa di soia, **le acciughe della salsa Worcestershire**. Cancellarli sarebbe togliere
 * protezione vera per riparare protezione falsa.
 *
 * ⛔ **Vive solo per la riparazione, e muore con lei.** Non è esportata, non la chiama nessun altro
 * file, e il giorno che le 190 sono riparate sparisce insieme a questo modulo e al suo script.
 */
function laVecchiaPortaScriveva(nome: string, kw: string): boolean {
  if (!nome.includes(kw)) return false;
  const escluse = PAROLE_CHE_NON_SONO[kw];
  let i = nome.indexOf(kw);
  while (i !== -1) {
    let a = i; while (a > 0 && /[a-zà-ÿ0-9]/.test(nome[a - 1])) a -= 1;
    let b = i + kw.length; while (b < nome.length && /[a-zà-ÿ0-9]/.test(nome[b])) b += 1;
    if (!escluse?.includes(nome.slice(a, b)) && !dentroUnaFraseCheNonE(nome, kw, i)) return true;
    i = nome.indexOf(kw, i + 1);
  }
  return false;
}

/**
 * ⛔ **TUTTE le parole di `testo` dentro cui `chiave` combacia senza cominciarle** — cioè quelle su
 * cui la vecchia porta faceva scattare l'allergene e la nuova no.
 *
 * ⚠️ **Tutte e non la prima**: su «melagrana e piselli sgranati» la prima stesura rendeva
 * `melagrana` e basta, e `sgranati` per quella ricetta non esisteva. Non si perde un esempio — si
 * perde una **riga** dell'elenco da leggere, e una parola che compare sempre accanto a un'altra non
 * compare mai.
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

/** ⚠️ La prima, per chi ne vuole una sola. Torna `null` quando la chiave comincia sempre una parola. */
export function parolaCheContiene(testo: string, chiave: string): string | null {
  return paroleCheContengono(testo, chiave)[0] ?? null;
}

export interface RicettaDaRiparare {
  id: string;
  name: string;
  ingredients: unknown;
  /** Gli allergeni **scritti** oggi in catalogo. */
  allergens?: readonly string[];
  /**
   * ⚠️ La spunta di conferma. ⛔ Comprende le conferme **in blocco** del 19/8, dove gli allergeni li
   * aveva scritti il riconoscitore: non vuol dire «guardata una per una», vuol dire «qualcuno ha
   * premuto il pulsante». Sta scritto anche nel foglio del 31/8.
   */
  allergensReviewed?: boolean;
  /**
   * ⛔ **QUALCUNO HA SCELTO A MANO GLI ALLERGENI DI QUESTA RICETTA** — c'è una riga
   * `catalog.recipe.allergens.set` nel registro, che è la porta di `setRecipeAllergens`.
   *
   * ⚠️ Serve a distinguere quello che **non si può** distinguere guardando la ricetta. Su «chicchi di
   * melograno + salsa di soia» col glutine scritto, la vecchia porta il glutine lo scriveva (per il
   * melograno) **e** una nutrizionista poteva volerlo (il frumento della salsa di soia): le due
   * cose sono indistinguibili dagli ingredienti, e togliere è irreversibile.
   *
   * ⛔ Quindi dove una persona ha messo le mani **non si tocca niente**: quella ricetta esce in un
   * elenco a parte e la guarda lei. Una revisione avversariale ha misurato che senza questa
   * distinzione la riparazione cancella le acciughe della salsa Worcestershire.
   */
  toccataAMano?: boolean;
}

/** Un allergene scritto che si può togliere, con dentro il perché. */
export interface AllergeneFalso {
  allergen: string;
  /** La chiave che lo faceva scattare, e la parola dentro cui combaciava. */
  chiave: string;
  parola: string;
  /** Il nome di ingrediente in cui è successo: è quello che una persona legge per giudicare. */
  ingrediente: string;
}

/**
 * ⛔ **GLI ALLERGENI SCRITTI CHE SI POSSONO TOGLIERE, E SOLO QUELLI.**
 *
 * Tre condizioni **insieme**, e togliendone una si toglie protezione vera:
 *
 * 1. l'allergene è **scritto** in catalogo (se non c'è, non c'è niente da riparare);
 * 2. la deduzione di **oggi** non lo trova (con la porta unica);
 * 3. **si sa perché c'era**: una chiave di quell'allergene combaciava dentro una parola più lunga.
 *
 * ⚠️ La terza è quella che distingue «l'ha scritto la vecchia porta» da «l'ha aggiunto una persona»:
 * senza, questo elenco cancellerebbe anche i tag messi a mano su cose che dagli ingredienti non si
 * vedono.
 */
export function allergeniFalsiDaTogliere(r: RicettaDaRiparare): AllergeneFalso[] {
  const scritti = (r.allergens ?? []).map((x) => String(x));
  if (!scritti.length) return [];
  /** ⛔ Dove una persona ha scelto la lista, la macchina non la corregge. Vedi `toccataAMano`. */
  if (r.toccataAMano) return [];
  const trovatiOra = new Set(suggestAllergens(r.ingredients).map((a) => a.allergen));
  const nomi = nomiIngredienti(r.ingredients).map((n) => n.toLowerCase());
  const out: AllergeneFalso[] = [];

  for (const codice of scritti) {
    if (trovatiOra.has(codice)) continue;
    const def = EU_ALLERGENS.find((x) => x.code === codice);
    if (!def) continue;
    for (const nome of nomi) {
      /**
       * ⛔ **«pasta senza glutine» col glutine scritto** (5/9): 172 ricette. Il tag l'aveva scritto la
       * vecchia porta da «pasta»; oggi `diceSenza` lo scarta, e nessun altro ingrediente lo porta
       * (`trovatiOra` è già stato guardato sopra). Si sa perché c'era: si toglie.
       */
      if (diceSenza(nome, codice)) {
        const forma = (SENZA_PER_ALLERGENE[codice] ?? []).find((f) => nome.includes(f)) ?? 'senza';
        if (!out.some((x) => x.allergen === codice && x.chiave === 'senza' && x.parola === forma)) {
          out.push({ allergen: codice, chiave: 'senza', parola: forma, ingrediente: nome });
        }
        continue;
      }
      for (const kw of def.keywords) {
        /**
         * ⛔ **La condizione esatta: la vecchia porta lo scriveva, la nuova no.** Non «una chiave
         * combacia dentro una parola», che è più largo e toglie i tag messi a mano — vedi
         * `laVecchiaPortaScriveva`. È il criterio con cui erano state contate le 190, e la prima
         * stesura della riparazione l'aveva allargato senza accorgersene.
         */
        if (!laVecchiaPortaScriveva(nome, kw) || chiaveCombacia(nome, kw)) continue;
        for (const parola of paroleCheContengono(nome, kw)) {
          /** ⚠️ Una riga per (allergene, chiave, parola): la stessa parola in tre ingredienti è una. */
          if (out.some((x) => x.allergen === codice && x.chiave === kw && x.parola === parola)) continue;
          out.push({ allergen: codice, chiave: kw, parola, ingrediente: nome });
        }
      }
    }
  }
  return out;
}

/** Una coppia (allergene, parola) raccolta su tutto il catalogo. */
export interface CoppiaFalsa {
  allergen: string;
  chiave: string;
  parola: string;
  ricette: number;
  esempi: string[];
}

export interface ContoRiparazione {
  esaminate: number;
  /** Ricette che perdono almeno un allergene scritto. */
  daRiparare: number;
  /** Di quelle, quante portano la spunta di conferma. */
  confermate: number;
  coppie: CoppiaFalsa[];
}

const MAX_ESEMPI = 3;

/**
 * ⛔ **IL CONTO STA QUI E NON NELLO SCRIPT**, ed è la lezione del tabulato dei panieri dell'1/9, che
 * diceva «⛔ non spostare» in cima e «✅ si può spostare» dodici righe sotto: da questo numero dipende
 * una scrittura sul catalogo, e un giudizio che decide non sta in un file di `prisma/` che nessun
 * test guarda.
 */
export function contaRiparazione(ricette: readonly RicettaDaRiparare[]): ContoRiparazione {
  const perCoppia = new Map<string, CoppiaFalsa>();
  let daRiparare = 0;
  let confermate = 0;

  for (const r of ricette) {
    const falsi = allergeniFalsiDaTogliere(r);
    if (!falsi.length) continue;
    daRiparare += 1;
    if (r.allergensReviewed) confermate += 1;
    for (const f of falsi) {
      const k = `${f.allergen}|${f.chiave}|${f.parola}`;
      const riga = perCoppia.get(k) ?? { allergen: f.allergen, chiave: f.chiave, parola: f.parola, ricette: 0, esempi: [] };
      riga.ricette += 1;
      if (riga.esempi.length < MAX_ESEMPI) riga.esempi.push(r.name);
      perCoppia.set(k, riga);
    }
  }

  return {
    esaminate: ricette.length,
    daRiparare,
    confermate,
    coppie: [...perCoppia.values()].sort((a, b) => b.ricette - a.ricette),
  };
}
