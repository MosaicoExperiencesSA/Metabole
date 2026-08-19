/**
 * «AGGIUNGI UN'EQUIVALENZA» — dettata a Vera (richiesta di Simone, 19/8).
 *
 * Nasce da uno screenshot: «aggiungi equivalenza» e «voglio aggiungere un equivalenza», e Vera che
 * risponde due volte «non ci arrivo nemmeno adesso». ⚠️ Era vero: fra le cose che sa fare a voce
 * c'erano divieti, sostituzioni, liste del dizionario, kcal, giornate, proteine, cambio dieta,
 * pasti e ricette — i **gruppi di equivalenza** li sapeva solo *approvare* quando arrivavano dalla
 * coda, non crearli da una frase.
 *
 * ## Cos'è un gruppo di equivalenza, e perché non è la lista del dizionario
 *
 * ⚠️ Sono due cose diverse che si chiamano quasi uguale, e confonderle sarebbe grave. La **lista del
 * dizionario** («i formaggi molli sono: mozzarella, stracchino…») serve a scrivere i **divieti**: dà
 * un nome a un insieme. Il **gruppo di equivalenza** dice al motore quali alimenti può **scambiare
 * fra loro nel piatto di una cliente**: è una regola che cambia cosa mangia la gente.
 *
 * ## ⚠️ Nasce SEMPRE come proposta, e la approva il capo
 *
 * `EquivalenceService.create` scrive `status: 'draft'` e avvisa i capi nutrizionisti: finché non è
 * approvato il motore non lo usa. Qui non si cambia quella regola — si aggiunge solo un modo di
 * dettarlo. ⚠️ Una frase in chat che facesse scattare subito uno scambio nei menu vorrebbe dire che
 * si cambia cosa mangiano le clienti senza che nessuno rilegga: è la stessa ragione per cui le
 * proposte di Vera nascono `in_approvazione`.
 *
 * ## ⚠️ Due alimenti, o non è un'equivalenza
 *
 * «Equivalenza del pollo» con dentro solo il pollo non dice niente al motore. Si chiede il secondo
 * invece di scrivere un gruppo che non scambia niente.
 */

export interface EquivalenzaLetta {
  /** Gli alimenti intercambiabili, nell'ordine in cui li ha detti. */
  alimenti: string[];
  /** Il nome del gruppo, se l'ha detto. `null` = va chiesto: non si inventa. */
  nome: string | null;
}

const pulisci = (s: string): string =>
  (s ?? '')
    .replace(/^\s*(?:il|lo|la|i|gli|le|l'|un|uno|una|del|dello|della|dei|degli|delle|di|d')\s+/i, '')
    .replace(/[.;:!?]+$/, '')
    .trim();

/** Spezza «pollo, tacchino e coniglio» in tre. Le virgole e la «e» finale sono lo stesso separatore. */
function spezza(elenco: string): string[] {
  return elenco
    .split(/\s*(?:,|;|\bo\b|\boppure\b|\be\b|\bed\b)\s*/i)
    .map(pulisci)
    .filter((x) => x.length >= 2);
}

/**
 * Le forme in cui una nutrizionista lo dice davvero. ⚠️ Devono chiedere **esplicitamente**
 * un'equivalenza o uno scambio: una frase come «pollo e tacchino» da sola non è una richiesta, e
 * trattarla come tale trasformerebbe ogni elenco di alimenti in una regola del motore.
 */
const FORME: { re: RegExp; elenco: number; nome?: number }[] = [
  // «aggiungi equivalenza: pollo, tacchino, coniglio» · «crea un'equivalenza fra pollo e tacchino»
  { re: /^(?:aggiungi|crea(?:mi)?|fai|facciamo|inserisci|nuova?)\s+(?:un[' ]?)?(?:gruppo\s+di\s+)?equivalenz[ae]\b(?:\s+(?:fra|tra|con|per|di))?\s*:?\s*(.+)$/i, elenco: 1 },
  // «voglio aggiungere un'equivalenza: …»
  { re: /^(?:voglio|vorrei|devo|posso)\s+(?:aggiungere|creare|fare|inserire)\s+(?:un[' ]?)?(?:gruppo\s+di\s+)?equivalenz[ae]\b(?:\s+(?:fra|tra|con|per|di))?\s*:?\s*(.+)$/i, elenco: 1 },
  // «al posto del pollo si può mettere tacchino o coniglio»
  { re: /^(?:al posto (?:del|dello|della|dei|degli|delle|di)\s+)(.+?)\s+(?:si pu[òo]|puoi|posso|possiamo)\s+(?:mettere|usare|dare)\s+(.+)$/i, elenco: 2, nome: 1 },
  // «pollo, tacchino e coniglio sono equivalenti»
  { re: /^(.+?)\s+sono\s+equivalenti\b.*$/i, elenco: 1 },
];

/**
 * Legge la frase, o `null` se non parla di equivalenze.
 *
 * ⚠️ `alimenti` può avere **un solo** elemento: vuol dire che ha nominato l'alimento di partenza e
 * non il resto («al posto del pollo…» troncato, o «aggiungi equivalenza pollo»). Chi chiama chiede
 * il secondo invece di scrivere un gruppo che non scambia niente — vedi `testoChiediAltri`.
 *
 * ⚠️ E `alimenti` vuoto **non è null**: «aggiungi equivalenza» da solo È una richiesta, e va
 * riconosciuta per poter chiedere «quali alimenti?». Rispondere «non ci arrivo» a una frase che si è
 * capita benissimo è la cosa che ha fatto scrivere a Simone «Vera ancora non capisce».
 */
export function leggiEquivalenza(testo: string): EquivalenzaLetta | null {
  const t = (testo ?? '').trim();
  if (!t) return null;
  for (const f of FORME) {
    const m = f.re.exec(t);
    if (!m) continue;
    const alimenti = spezza(m[f.elenco] ?? '');
    const nome = f.nome ? pulisci(m[f.nome] ?? '') || null : null;
    // ⚠️ Nella forma «al posto del pollo…» il pollo è il PRIMO membro, non solo il nome del gruppo:
    // un'equivalenza che non contenesse l'alimento di partenza direbbe al motore di scambiarlo con
    // qualcosa che non gli somiglia per definizione.
    const tutti = nome ? [nome, ...alimenti] : alimenti;
    /**
     * ⚠️ Si tiene la PRIMA scrittura, non l'ultima: «pollo, Pollo» resta «pollo». `new Map` da sola
     * terrebbe l'ultima, e un elenco che si riscrive da sé è un elenco di cui chi l'ha dettato non
     * riconosce più le parole.
     */
    const visti = new Set<string>();
    const unici = tutti.filter((a) => {
      const k = a.toLowerCase();
      if (visti.has(k)) return false;
      visti.add(k);
      return true;
    });
    return { alimenti: unici, nome };
  }
  // ⚠️ «aggiungi equivalenza» secco: capito, ma senza alimenti. Non è `null`.
  if (/^(?:voglio|vorrei|devo)?\s*(?:aggiungere|aggiungi|creare|crea|fare|inserire|nuova?)?\s*(?:un[' ]?)?(?:gruppo\s+di\s+)?equivalenz[ae]\s*$/i.test(t)) {
    return { alimenti: [], nome: null };
  }
  return null;
}

/** ⚠️ Un gruppo con meno di due alimenti non scambia niente: non si scrive, si chiede. */
export const bastaPerScrivere = (e: EquivalenzaLetta): boolean => e.alimenti.length >= 2;

export function testoChiediAltri(e: EquivalenzaLetta): string {
  if (!e.alimenti.length) {
    return (
      'Volentieri. Quali alimenti si possono scambiare fra loro? Scrivimeli in fila — per esempio ' +
      '«petto di pollo, tacchino, coniglio».'
    );
  }
  return (
    `Ho «${e.alimenti[0]}», ma da solo non è un'equivalenza: serve almeno un altro alimento che il ` +
    'motore possa metterci al posto. Quali?'
  );
}

/**
 * L'anteprima prima di scrivere.
 *
 * ⚠️ Dice **cosa succede davvero**, e sono due cose che chi detta deve sapere: che nasce come
 * proposta (il motore non la usa finché il capo non la approva) e che vale per **tutte** le clienti
 * di quella dieta, non per una. Una regola che si crede locale e agisce su trecento persone è il
 * difetto peggiore che questa chat possa produrre.
 */
export function testoAnteprima(e: EquivalenzaLetta, nomeGruppo: string): string {
  return (
    `Scrivo il gruppo **«${nomeGruppo}»** con: ${e.alimenti.join(', ')}.\n\n` +
    '⚠️ Vuol dire che il motore potrà **scambiarli fra loro** nel piatto delle clienti — non è una ' +
    'nota, è una regola. Nasce come **proposta**: la vede il capo nutrizionista e finché non la ' +
    'approva il motore non la usa.\n\nConfermo? (sì / no)'
  );
}

export function testoFatto(nomeGruppo: string, quanti: number): string {
  return (
    `Fatto: «${nomeGruppo}» è in coda con ${quanti} alimenti, e l'ho segnalato al capo nutrizionista. ` +
    'Finché non lo approva il motore non lo usa. 💚'
  );
}

/** ⚠️ Il nome non si inventa: si chiede. «Equivalenza 1» non dice niente a chi la rilegge fra un mese. */
export const testoChiediNome = (e: EquivalenzaLetta): string =>
  `Come lo chiamiamo questo gruppo? (per esempio «carni bianche»). Dentro ci metto: ${e.alimenti.join(', ')}.`;
