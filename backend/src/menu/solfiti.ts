/**
 * ALLERGIA AI SOLFITI: quattro condimenti si SOSTITUISCONO, due piatti si ESCLUDONO.
 *
 * Chiesto da Simone il 21/8 («la nutrizionista mi ha mandato il file con i cibi da sostituire e come
 * sostituirli») e deciso da lui il 24/8, quattro risposte alla volta. Le righe vengono dalla
 * `Guida_Completa_Allergia_Solfiti.pdf` della capo nutrizionista, non da chi scrive il codice.
 *
 * ## Perché non basta l'elenco delle esclusioni
 *
 * `exclusions.ts` sa già **dove** stanno i solfiti — ventisette voci, dalla tabella della
 * nutrizionista del 13/8. Ma un'esclusione senza sostituto **toglie il piatto**: chi dichiara i
 * solfiti perdeva quasi ogni insalata condita per via dell'aceto, e l'intera colazione dolce per via
 * dei biscotti. Un divieto che toglie mezzo catalogo non protegge meglio: fa smettere di fidarsi
 * dell'elenco. È lo stesso ragionamento di `lattosio.ts`, ed è il motivo per cui questo file gli
 * somiglia tanto.
 *
 * ## ⚠️ La riga di confine, ed è una decisione di Simone (24/8), non una regola di software
 *
 * Le sette righe della guida non sono tutte della stessa specie:
 *
 *  · **quattro toccano un condimento** — aceto, vino da sfumare, dado da brodo, frutta secca
 *    industriale — e il piatto resta quello che era: cambia cosa ci si mette dentro, non cosa si
 *    mangia. Queste si applicano **da sole**, come il delattosato;
 *  · **due cambiano il piatto**: crostacei surgelati → pesce fresco di lisca, e salsicce/insaccati →
 *    macinato fresco. ⛔ Un gambero non è un branzino: kcal, tempi di cottura e sapore sono altri, e
 *    la cliente leggerebbe una ricetta che non è quella che aveva scelto. **Quei piatti si escludono**
 *    — come per ogni altro allergene — e non li sostituisce nessuno in automatico. Simone, 24/8.
 *
 * ⚠️ Dove passa questa riga non lo decide il codice. Se un giorno Lucia dice che il macinato fresco
 * al posto della salsiccia va bene, quella riga si sposta **qui**, in una tabella, e non in un `if`
 * dentro il motore.
 *
 * ## ⛔ Cosa NON c'è dentro, e di proposito
 *
 * La guida parla anche di farmaci (colliri, anestetici con adrenalina, sciroppi col metabisolfito) e
 * di come comportarsi al ristorante. **Fuori perimetro**: qui si decide cosa finisce nel piatto che
 * eroghiamo noi. Metterlo in un menu vorrebbe dire dare un consiglio medico da un'app di nutrizione.
 *
 * ⚠️ E la soglia di legge, per chi ci lavorerà: l'obbligo di dichiarazione in etichetta scatta sopra
 * i **10 mg/kg o 10 mg/l** come SO₂ (Reg. UE 1169/2011). Sotto quella soglia i solfiti ci possono
 * essere e **non essere scritti** — è il motivo per cui «leggi l'etichetta» non è una risposta, e
 * serve una lista nostra.
 */

import { ALIAS } from './exclusions';
import { contieneAlimento } from './lattosio';

/** Il codice UE dell'allergene, come lo salva il questionario (`onboarding.questions.ts`). */
export const ALLERGENE_SOLFITI = 'solfiti';

/**
 * LE QUATTRO SOSTITUZIONI CHE TOCCANO SOLO UN CONDIMENTO.
 *
 * Chiave = la parola che compare nell'ingrediente. Valore = cosa ci si mette al suo posto, scritto
 * come lo legge la cliente in cucina.
 *
 * ⚠️ **Il sostituto dice anche PERCHÉ è sicuro, dove serve.** «aceto di mele senza solfiti aggiunti»
 * non è pedanteria: l'aceto di mele normale i solfiti ce li ha (170 mg/kg nella tabella del 13/8), ed
 * è la dicitura in etichetta a fare la differenza. Scrivere solo «aceto di mele» manderebbe a
 * comprare la cosa sbagliata con la nostra firma sopra.
 */
export const SOSTITUTI_SENZA_SOLFITI: Record<string, string> = {
  /**
   * Aceto (di vino, balsamico, di mele): 170 mg/kg. → succo di limone **fresco**.
   *
   * ⚠️ «Fresco» non è un aggettivo di colore: nella tabella del 13/8 i **succhi concentrati** stanno
   * a 350 mg/l, e `exclusions.ts` li elenca. Il limone spremuto no. Trovato in revisione il 24/8: la
   * prima stesura proponeva un sostituto che un altro file dichiarava vietato — un innesco lasciato
   * armato, che sarebbe esploso il giorno in cui qualcuno avesse rivalidato le sostituzioni.
   */
  aceto: 'succo di limone fresco',
  balsamico: 'succo di limone fresco',
  // Vino da sfumare: 150-400 mg/l. → brodo vegetale casalingo acidulato con limone.
  vino: 'brodo vegetale casalingo con un goccio di limone',
  marsala: 'brodo vegetale casalingo con un goccio di limone',
  spumante: 'brodo vegetale casalingo con un goccio di limone',
  prosecco: 'brodo vegetale casalingo con un goccio di limone',
  sidro: 'brodo vegetale casalingo con un goccio di limone',
  // Dado da brodo industriale. → dado vegetale casalingo, o brodo fresco.
  dado: 'dado vegetale casalingo (o brodo fresco)',
  // Frutta essiccata industriale: 2000 mg/kg, la categoria col limite più alto della tabella.
  uvetta: 'frutta fresca essiccata in casa a bassa temperatura',
  'uva passa': 'frutta fresca essiccata in casa a bassa temperatura',
  'uva sultanina': 'frutta fresca essiccata in casa a bassa temperatura',
  'albicocche secche': 'albicocche essiccate in casa a bassa temperatura',
  'albicocca secca': 'albicocche essiccate in casa a bassa temperatura',
  'albicocche disidratate': 'albicocche essiccate in casa a bassa temperatura',
  'albicocca disidratata': 'albicocche essiccate in casa a bassa temperatura',
  'prugne secche': 'prugne essiccate in casa a bassa temperatura',
  'prugna secca': 'prugne essiccate in casa a bassa temperatura',
  'fichi secchi': 'fichi essiccati in casa a bassa temperatura',
  'fico secco': 'fichi essiccati in casa a bassa temperatura',
  'frutta disidratata': 'frutta fresca essiccata in casa a bassa temperatura',
  'frutta essiccata': 'frutta fresca essiccata in casa a bassa temperatura',
  'banane essiccate': 'banane essiccate in casa a bassa temperatura',
  'mele essiccate': 'mele essiccate in casa a bassa temperatura',
};

/**
 * ⛔ **I DUE CHE NON SI SOSTITUISCONO, e la ragione sta nel nome della costante.**
 *
 * Se un ingrediente è qui dentro, questa regola risponde «non ho niente da proporre» e il piatto
 * finisce fuori dal catalogo di quella cliente, come per ogni allergene. Non è una dimenticanza da
 * riempire il mese prossimo: è la decisione del 24/8 scritta dove si vede.
 *
 * ⚠️ Serve perché il sostituto **non venga cercato altrove**: senza questa lista, «gamberi» ricadrebbe
 * nella mappa generica di `sostituzioni-sicure.ts` il giorno in cui qualcuno ce lo aggiunge per un
 * motivo diverso, e la sostituzione arriverebbe da una porta che non sa niente dei solfiti.
 */
export const CAMBIANO_IL_PIATTO = [
  // Crostacei freschi e congelati: 150-300 mg/kg, immersi in bisolfiti contro la melanosi.
  'gamberi', 'gamberetti', 'gambero', 'mazzancolle', 'scampi', 'astice', 'aragosta', 'granchio',
  // Salsicce, insaccati e macinato confezionato.
  'salsiccia', 'salsicce', 'wurstel', 'würstel', 'salame', 'mortadella', 'insaccati',
  'carne macinata confezionata', 'macinato confezionato',
];

/**
 * ⛔ **OGNI VOCE QUI SOPRA DEVE ESSERE ANCHE IN `exclusions.ts`, o non serve a niente.**
 *
 * `decisioneSolfiti` viene consultata **solo se** l'ingrediente è già stato agganciato da
 * `hitsExclusion`. Nella prima stesura otto voci su diciassette — `astice`, `aragosta`, `granchio`,
 * `würstel` con la dieresi (che è la grafia normale in etichetta), `insaccati`, `carne macinata
 * confezionata` — non erano in quell'elenco: questa lista *sapeva* che andavano tolte e **non le
 * veniva mai chiesto**. Trovato in revisione il 24/8, e adesso `solfiti.spec.ts` gira su **tutte** le
 * voci di questa costante passando dal motore, non da qui.
 */

/**
 * Questa cliente ha dichiarato i solfiti?
 *
 * ⛔ **Passa dagli ALIAS, e guarda anche le intolleranze** — trovato in revisione il 24/8, ed era il
 * difetto già scritto tre volte in testa a `exclusions.ts`, rifatto da una porta nuova.
 *
 * `exclusions.ts` dichiara `sulphites` e `sulfites` **proprio perché è così che arrivano dagli
 * import**. La prima stesura di questa funzione cercava la radice `solfit` a mano: su una cliente
 * importata con `sulphites` le esclusioni si espandevano lo stesso — l'insalata spariva come prima
 * del 24/8 — ma la **sostituzione non arrivava mai**. Cioè la consegna era spenta esattamente per le
 * clienti che non se lo sarebbero potute spiegare.
 *
 * ⚠️ E si guardano anche le `intolerances`: i solfiti sono un allergene UE e nel questionario stanno
 * fra le allergie, ma chi li scrive nel campo sbagliato oggi perderebbe tutto — e non è un errore che
 * deve costare a lei.
 */
export function dichiaraSolfiti(profilo: {
  allergies?: string[] | null;
  intolerances?: string[] | null;
}): boolean {
  const dichiarati = [...(profilo.allergies ?? []), ...(profilo.intolerances ?? [])]
    .map((a) => String(a).toLowerCase().trim())
    .filter(Boolean);
  return dichiarati.some((a) => {
    const canonico = ALIAS[a] ?? a;
    return canonico === ALLERGENE_SOLFITI || canonico.includes('solfit') || canonico.includes('anidride solforosa');
  });
}

/**
 * Cosa fare di questo ingrediente, per una cliente allergica ai solfiti.
 *
 * - `{ azione: 'sostituisci', con }` → uno dei quattro condimenti: il piatto resta, cambia quello;
 * - `{ azione: 'fuori' }` → è uno dei due che cambierebbero il piatto: non si sostituisce, si esclude;
 * - `null` → questa regola non ha niente da dire, e decide chi chiama con le regole di prima.
 *
 * ⚠️ **L'ordine dei due controlli conta**: `CAMBIANO_IL_PIATTO` si guarda **per primo**. Se un giorno
 * qualcuno scrivesse `gamberi` anche fra i sostituti, la lista che esclude deve vincere — sbagliare
 * in quel verso costa un piatto in meno, sbagliare nell'altro costa una cliente che mangia una cosa
 * che non aveva scelto.
 */
export function decisioneSolfiti(
  ingrediente: string,
): { azione: 'sostituisci'; con: string } | { azione: 'fuori' } | null {
  const nome = (ingrediente ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (!nome) return null;

  if (CAMBIANO_IL_PIATTO.some((t) => contieneAlimento(nome, t))) return { azione: 'fuori' };

  /**
   * Le chiavi lunghe si provano **prima** delle corte. Il caso vero è «aceto di vino», che combacia
   * con **due** chiavi — `aceto` (→ limone) e `vino` (→ brodo vegetale): deve vincere l'aceto, perché
   * un'insalata col brodo vegetale al posto dell'aceto è un piatto che nessuno mangia.
   *
   * ⚠️ **E va detto che oggi questa riga non si può provare**: l'ordine per lunghezza coincide con
   * l'ordine in cui le chiavi sono scritte qui sopra, quindi togliendo il `sort` il test resta verde.
   * Non è una rete che non serve — è una rete che protegge dal giorno in cui qualcuno riordina la
   * tabella, e quel giorno non c'è ancora stato. Lo scrivo invece di far finta che il test la copra:
   * la revisione del 24/8 l'ha misurato, e un commento che promette una protezione inesistente è
   * peggio della protezione che manca.
   *
   * ⚠️ `contieneAlimento` confronta **per parola e mai per sottostringa** — è la trappola che in
   * questo progetto ha già morso tre volte («mela» dentro «melanzane»).
   */
  const chiavi = Object.keys(SOSTITUTI_SENZA_SOLFITI).sort((a, b) => b.length - a.length);
  for (const k of chiavi) {
    if (contieneAlimento(nome, k)) return { azione: 'sostituisci', con: SOSTITUTI_SENZA_SOLFITI[k] };
  }
  return null;
}
