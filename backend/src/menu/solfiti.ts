/**
 * ALLERGIA AI SOLFITI: tre condimenti si SOSTITUISCONO, il vino si TOGLIE, due piatti si ESCLUDONO.
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
 *  · **quattro toccano un condimento** — aceto, vino, dado da brodo, frutta secca industriale — e il
 *    piatto resta quello che era: cambia cosa ci si mette dentro, non cosa si mangia. Queste si
 *    applicano **da sole**, come il delattosato. ⚠️ Il **vino** dal 24/8 non si sostituisce, **si
 *    toglie**: la guida propone il brodo vegetale acidulato per il vino *da sfumare*, ma la parola
 *    «vino» in un ingrediente non dice se serve a sfumare o se è il piatto — e su «pere al vino
 *    rosso» venivano fuori pere nel brodo vegetale. «Dove è previsto vino semplicemente togliamo il
 *    vino» (Simone, 24/8);
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
import { SOSTITUTO_ASSENTE } from './pasto-giornata';
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
  // ⚠️ Il VINO non è più qui: dal 24/8 si toglie e basta. Vedi `SI_TOLGONO_E_BASTA` qui sotto.
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
 * ⛔ **IL VINO SI TOGLIE E BASTA — decisione di Simone, 24/8: «dove è previsto vino semplicemente
 * togliamo il vino».**
 *
 * La prima stesura lo sostituiva con «brodo vegetale casalingo con un goccio di limone», che è la
 * riga della guida della capo nutrizionista per il vino **da sfumare**. Il difetto: la chiave `vino`
 * non sa se quel vino serve a sfumare una padella o se **è il piatto**. Su «pere al vino rosso» il
 * motore proponeva pere nel brodo vegetale — un piatto che nessuno cucina, e che fa perdere fiducia
 * in tutte le altre sostituzioni, comprese quelle giuste.
 *
 * Togliere e basta è la scelta che non può raccontare una cosa falsa: un risotto senza il mezzo
 * bicchiere di vino resta un risotto, e un dolce che senza il vino non sta in piedi si vede subito —
 * mentre «brodo vegetale» dentro un dolce si legge come una nostra proposta.
 *
 * ⚠️ **Cosa NON copre, e non è misurato**: qui ci sono cinque parole, le stesse che `exclusions.ts`
 * elenca per i solfiti. Un ingrediente scritto col nome commerciale — «Barolo», «Vermouth»,
 * «Lambrusco» — non viene agganciato nemmeno dalle esclusioni, quindi questa regola non gli viene
 * mai chiesta e il piatto esce intatto a un'allergica. Nel catalogo di oggi quelle parole non
 * compaiono (cercate), ma è una fotografia, non una garanzia: si guarda con
 * `npm run diag:allergeni-nel-piatto` quando il catalogo cresce.
 *
 * ⚠️ **E le kcal non si ricalcolano**: togliendo il vino la giornata vale un po' meno di quello che
 * lo snapshot dice (150 ml di rosso sono ~125 kcal). Non è una regressione — col brodo vegetale il
 * buco era lo stesso — ed è la ragione per cui i piatti dove il vino PESA (quelli che lo hanno nel
 * nome) escono invece di essere corretti. Sui risotti sfumati la differenza è di poche decine di
 * kcal e resta aperta, scritta qui.
 */
export const SI_TOLGONO_E_BASTA = ['vino', 'marsala', 'spumante', 'prosecco', 'sidro'];

/**
 * Come si legge una cosa che si toglie: le sostituzioni si mostrano come «ingrediente → testo»,
 * quindi questa frase sta a destra della freccia («vino bianco → si toglie (niente al suo posto)»).
 *
 * ⚠️ **La stringa vive in `pasto-giornata.ts`**, accanto al tipo `Substitution`: non la legge solo
 * chi la scrive, la deve riconoscere chiunque trasformi una sostituzione in un ingrediente — o
 * finisce nella lista della spesa come se fosse un cibo. Qui si ri-esporta per chi ragiona di
 * solfiti.
 */
export const TESTO_SI_TOGLIE = SOSTITUTO_ASSENTE;

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
): { azione: 'sostituisci'; con: string } | { azione: 'togli' } | { azione: 'fuori' } | null {
  const nome = (ingrediente ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (!nome) return null;

  if (CAMBIANO_IL_PIATTO.some((t) => contieneAlimento(nome, t))) return { azione: 'fuori' };

  /**
   * ⚠️ **Sostituti e «si toglie» si guardano NELLO STESSO giro, ordinati per lunghezza della chiave.**
   * Il caso vero è «aceto **di vino**», che combacia con due chiavi: `aceto` (5 lettere, → succo di
   * limone) e `vino` (4, → si toglie). Deve vincere l'aceto: un'insalata senza condimento non è
   * un'insalata condita col limone. Due cicli separati avrebbero fatto vincere il primo dei due
   * elenchi — cioè l'ordine in cui sono scritti in questo file: una decisione che pesa su un piatto,
   * lasciata a un dettaglio di stesura.
   *
   * ⚠️ Fino al 24/8 qui c'era scritto che l'ordinamento **non era provabile**, ed era vero finché
   * l'ordine per lunghezza coincideva con l'ordine di scrittura: si poteva cancellare il `sort` e
   * i test restavano verdi. La revisione l'ha misurato di nuovo sulla prima stesura di oggi — ancora
   * verde — e la correzione non è stata riscrivere il commento: è **l'ordine dei due elenchi qui
   * sotto**, scelto apposta perché togliere il `sort` faccia diventare rossi tre test.
   *
   * ⚠️ `contieneAlimento` confronta **per parola e mai per sottostringa** — è la trappola che in
   * questo progetto ha già morso tre volte («mela» dentro «melanzane»).
   */
  const chiavi = [
    // ⚠️ **`SI_TOLGONO_E_BASTA` per PRIMO, e non è indifferente**: così l'ordine di scrittura è
    // l'opposto di quello per lunghezza, e togliendo il `sort` «aceto di vino» prende «si toglie»
    // invece del limone — cioè i test diventano rossi. Con l'altro ordine il `sort` si poteva
    // cancellare senza che niente se ne accorgesse (misurato in revisione, 24/8).
    ...SI_TOLGONO_E_BASTA.map((k) => ({ k, esito: { azione: 'togli' as const } })),
    ...Object.keys(SOSTITUTI_SENZA_SOLFITI).map((k) => ({ k, esito: { azione: 'sostituisci' as const, con: SOSTITUTI_SENZA_SOLFITI[k] } })),
  ].sort((a, b) => b.k.length - a.k.length);
  for (const { k, esito } of chiavi) {
    if (contieneAlimento(nome, k)) return esito;
  }
  return null;
}
