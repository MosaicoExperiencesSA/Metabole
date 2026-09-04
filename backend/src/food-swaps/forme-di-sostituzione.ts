/**
 * ⛔ **LE FORME IN CUI SI SCRIVE UNA SOSTITUZIONE — una definizione sola, per tutte e due le strade.**
 *
 * Dalla pagina «frasi che non ho capito» (voce `vera-vocabolario-quattro-gruppi`), misurate il 31/8
 * e ancora mute il 3/9:
 *
 * ```
 * il merluzzo è sostituibile con orata            → niente
 * il merluzzo può essere sostituito con orata     → niente        (con «o spigola» invece funziona)
 * al posto del merluzzo può mettere orata         → niente
 * merluzzo → orata, salmone                       → niente
 * ```
 *
 * ⚠️ **Il secondo è il caso che spiega perché questo file esiste.** «può essere sostituito con
 * orata **o spigola**» si legge, «…con orata» no: la forma passiva la conosceva **solo** il ramo a
 * elenchi (`vera/sostituzione-a-elenchi.ts`), che però risponde `null` quando non c'è un elenco —
 * giustamente, perché quello è il mestiere dell'altro. E l'altro (`sostituzioniNelMessaggio`) la
 * forma passiva non la conosceva affatto. **La frase cadeva nel mezzo**, e dentro una segnalazione
 * aperta Vera la inoltrava alla cliente come risposta: la regola non nasceva.
 *
 * ## ⛔ Perché le forme stanno qui e non nei due file che le usano
 *
 * Perché una forma scritta in due posti è una forma che prima o poi diverge — ed è già successo in
 * piccolo: il ramo a elenchi sapeva la passiva e il ramo singolo no, quindi la stessa frase veniva
 * capita o buttata via **a seconda di quante alternative aveva scritto la nutrizionista**. È lo
 * stesso difetto che il 3/9 si è dovuto chiudere sulla coda del quando, per lo stesso motivo.
 * *Se due punti rispondono alla stessa domanda, uno deve chiamare l'altro* — o tutti e due devono
 * chiamare un terzo, che è questo.
 *
 * ⚠️ Qui stanno le **forme** (dove sta il nome che esce e dove quello che entra), non il **giudizio**
 * su cosa sia un alimento: quello resta di `nomeAlimento` e di `leggiElenco`, che sbagliano in versi
 * diversi apposta — uno impara da una conversazione e può non trovare niente, l'altro esegue un
 * ordine e una lettura parziale gli è vietata.
 */

/** I separatori di alternativa: valgono anche senza virgole. */
export const ALTERNATIVE = /\s+(?:o|od|oppure)\s+/i;

/**
 * Vero se in questo testo c'è il segnale che apre la lettura a elenco.
 *
 * ⚠️ **Sta qui** e non in `vera/elenco-alimenti.ts`, che la ri-esporta: la usano tutte e due le
 * strade, e la strada singola ne ha bisogno per **rifiutare** quello che è un elenco invece di
 * leggerlo come un nome solo («orata, salmone» diventerebbe l'alimento inesistente «orata salmone»).
 * Il verso opposto dell'import — food-swaps che chiama vera — farebbe un ciclo.
 */
export function eUnElenco(testo: string): boolean {
  const t = testo ?? '';
  return /[,;]/.test(t) || ALTERNATIVE.test(t);
}

/**
 * Il vocativo che apre la frase: «**a Marta** il merluzzo può essere sostituito con…».
 *
 * ⛔ Senza staccarlo, il nome della cliente finisce **dentro il nome dell'alimento**. Chi lo legge
 * poi come cliente è `nomePersona`, che lavora sulla frase intera: qui si toglie solo per non
 * sporcare l'alimento.
 */
export const VOCATIVO = /^(?:a|ad|per|alla|al)\s+[A-ZÀ-Ý][\wÀ-ÿ'’]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'’]+)?[\s,;]+/u;

/**
 * ⛔ **LA FORMA PASSIVA: «il merluzzo può essere sostituito con orata, salmone o spigola».**
 *
 * È come scrive chi detta una regola invece di dare un ordine. Qui il primo alimento sta **prima**
 * del verbo, quindi la forma imperativa non può leggerla: il gruppo che cattura sarebbe vuoto.
 *
 * ⛔ **L'ausiliare è obbligatorio, e non è pignoleria.** La prima stesura accettava il participio
 * **nudo** (`sostituito con`) con un `^(.+?)` pigro davanti: la revisione l'ha smontata misurando —
 * «il pane **era stato** sostituito con gallette» diventava una regola, e «**in teoria** il riso può
 * essere sostituito con quinoa» metteva «in teoria il riso» al posto dell'alimento. Una lettura
 * plausibile e sbagliata è peggio di un «non ci arrivo».
 *
 * ⚠️ **«è sostituibile con» è un aggettivo, non un participio**, e per questo mancava: la riga
 * dell'ausiliare non poteva prenderlo. È una delle frasi vere del 31/8. ⛔ Si accetta anche senza
 * accento («e sostituibile»), perché chi detta dal telefono lo mangia — ed è già la regola scritta
 * dieci righe più su per i refusi del verbo.
 */
export const FORMA_PASSIVA = new RegExp(
  '^(.+?)\\s+(?:' +
    '(?:pu[òo]|possono|deve|devono)\\s+essere\\s+(?:sostituit[oaie]|cambiat[oaie])|' +
    '(?:va|vanno)\\s+(?:sostituit[oaie]|cambiat[oaie])|' +
    'si\\s+(?:pu[òo]|possono)\\s+(?:sostituire|cambiare)|' +
    '(?:è|e|sono)\\s+(?:sostituibil[ei]|rimpiazzabil[ei])' +
  ')\\s+con\\s+(.+)$',
  'i',
);

/**
 * ⛔ **LA FORMA ROVESCIATA CHE APRE LA FRASE: «al posto del merluzzo può mettere orata».**
 *
 * Il riconoscitore singolo conosce «Y al posto di X», che ha **qualcosa prima**; qui «al posto di»
 * apre la proposizione e quel qualcosa non c'è, quindi il gruppo pigro davanti non combacia e la
 * frase muore. ⚠️ È una delle frasi vere del 31/8, ed è il modo normale di scriverla quando si
 * comincia dal divieto: prima cosa si toglie, poi cosa si mette.
 *
 * ⛔ **Il verbo del mettere è obbligatorio.** Senza, «al posto del merluzzo qualcosa di leggero»
 * diventerebbe una regola su un alimento che non è stato nominato — e questo lato è quello che
 * decide **cosa esce dal piatto**.
 *
 * ⚠️ Attacca a inizio proposizione **o dopo i due punti**: «Ricorda: al posto del merluzzo metti
 * l'orata» è la stessa frase con un'intestazione davanti, e `proposizioni` non spezza sui due punti.
 */
export const FORMA_AL_POSTO_IN_TESTA = new RegExp(
  '(?:^|:)\\s*(?:e\\s+|poi\\s+)?' +
    '(?:al\\s+posto\\s+d(?:i|el|ello|ella|elle|egli|ei)|invece\\s+d(?:i|el|ello|ella|elle|egli|ei))\\s+' +
    '(.+?)\\s+' +
    '(?:(?:pu[òo]|puo|possiamo|si\\s+pu[òo])\\s+)?' +
    /**
     * ⚠️ **I verbi con cui una persona scrive davvero**, non quattro. L'elenco vicino
     * (`PAROLE_DI_CHI_SCRIVE`, in `impara-dalla-chat.ts`) ne conosce di più, e una divergenza fra
     * due elenchi dello stesso dominio è un silenzio su frasi normali: «al posto della carne
     * **mangia** il pesce» non si leggeva perché c'era `mangi` e non `mangia`.
     */
    '(?:metter(?:e|ci|le|li|lo|la)|mett[ia](?:amo|te)?|usare|us[ai](?:amo|te)?|prender[ea]|prend[iae](?:amo|te)?|' +
    'dare|dai|mangiare|mangi[ai]?(?:amo|te)?|scegli(?:amo|ete)?|preferisci|preferisce|fai|facciamo|serv[ie](?:amo)?|' +
    'aggiung[ie](?:amo|te)?|inserisci|inserisce|propon[ie]|alterna|prova|proviamo|lascia|tieni)\\s+' +
    '(.+)$',
  'i',
);

/**
 * ⛔ **LA FRECCIA NON C'È, ED È UNA DECISIONE MISURATA — non una dimenticanza.**
 *
 * «merluzzo → orata, salmone» è una delle tre forme misurate il 31/8, e la prima stesura di questo
 * file la leggeva. ⚠️ Una revisione avversariale l'ha provata su **venticinque righe di chat vere
 * con una freccia dentro: sedici diventavano una regola**. Le tre peggiori:
 *
 * ```
 * legumi -> 3 volte a settimana        →  regola: legumi diventa «3 volte a settimana»
 * olio evo -> 3 cucchiai al giorno     →  regola: olio evo diventa «3 cucchiai al giorno»
 * da eliminare -> pane, pasta e riso   →  regola: si mette pane, pasta e riso (il ROVESCIO)
 * ```
 *
 * ⛔ E non sono regole inerti: a sinistra c'è un alimento **vero di catalogo**, quindi la riga
 * arriva in coda di verifica come una sostituzione che nessuno ha chiesto — su un percorso
 * (`impara-dal-nutrizionista.ts`) che scrive **senza avvisare nessuno**.
 *
 * ⚠️ **La ragione è strutturale, e vale la pena scriverla.** Le altre due forme hanno un'**ancora
 * lessicale** obbligatoria — l'ausiliare («può essere sostituito»), il verbo del mettere («al posto
 * del X **metti** Y») — che dice *questa frase è un ordine di sostituzione*. La freccia non ha
 * niente: è una notazione che in una chat di nutrizione significa anche una frequenza, una quantità,
 * un progresso di peso, un passaggio di stato. Leggerla vuol dire indovinare, e qui indovinare
 * scrive nel piatto di qualcuno.
 *
 * ⛔ **Si riaprirà quando si saprà distinguere «alimento → alimento» da «alimento → quantità».**
 * L'elenco chiuso non basta (chi scrive «3 volte a settimana» non usa parole nostre), e un test sui
 * numeri non copre «da eliminare → pane». Sta come voce aperta, non come commento.
 */

/**
 * Tutte le forme in cui il nome che **esce** sta prima e quello che **entra** dopo, insieme al modo
 * in cui va letto il pezzo di sinistra.
 *
 * ⚠️ `risalita: true` vuol dire che il pezzo di sinistra **non è delimitato**: contiene il nome più
 * tutto quello che c'era prima («per Anna il merluzzo è sostituibile con…»), quindi si legge
 * risalendo dalla fine come fa la forma «Y al posto di X». `false` vuol dire che è delimitato da una
 * parola chiave e si legge in avanti.
 */
export const FORME_CON_IL_NOME_PRIMA: readonly { re: RegExp; risalita: boolean }[] = [
  { re: FORMA_PASSIVA, risalita: true },
  { re: FORMA_AL_POSTO_IN_TESTA, risalita: false },
];
