/**
 * LA GUARDIA SULLA RISPOSTA DI GAIA — quello che dice, non quello che le hanno chiesto.
 *
 * Segnalazione di Simone dell'11/8, su una conversazione del 1° agosto:
 *
 *   cliente — «posso sostituire il riso integrale con basmati?»
 *   Gaia    — «Il riso basmati è più raffinato e ha un indice glicemico più alto rispetto
 *              all'integrale, quindi sazia meno e fa aumentare più rapidamente la glicemia.»
 *
 * **È falso.** Il basmati è un chicco lungo ricco di amilosio e sta intorno a IG 50-58; il riso
 * integrale comune sta più in alto, 65-70. Gaia non ha sbagliato una sfumatura: ha invertito il
 * confronto, e l'ha fatto con la sicurezza di chi cita un dato. Poi ha aggiunto una motivazione
 * («sazia meno») costruita sopra il dato sbagliato, che è il modo in cui un errore diventa
 * convincente.
 *
 * ## Perché serve un cancello in USCITA e non basta correggere il prompt
 *
 * Il filtro che c'era guardava solo il messaggio della **cliente**: se scriveva «glicemia» la
 * domanda finiva alla nutrizionista (`ai-filter.ts`). Ma qui la parola l'ha scritta **Gaia**, e in
 * quella direzione non c'era nessun controllo: il modello poteva affermare quello che voleva su
 * indici glicemici, calorie, proteine e sazietà, e nessuno se ne accorgeva finché una cliente non
 * si fidava. Il prompt di sistema ora glielo vieta (vedi `ai.service.ts`), ma un'istruzione è una
 * richiesta, non una garanzia: il giorno che il modello cambia, o che la domanda è formulata in
 * modo persuasivo, l'istruzione da sola non tiene.
 *
 * Questa funzione è deterministica e sta fuori dal modello. Quando riconosce un'**affermazione
 * nutrizionale o clinica** nella risposta, quella risposta non si manda: la domanda va alla
 * nutrizionista e alla cliente si dice la verità, cioè che su questo non si tira a indovinare.
 *
 * ## Quello che NON blocca (e perché è tarato basso)
 *
 * Gaia deve poter parlare di pasti, orari, abitudini, motivazione, uso dell'app: sono il suo
 * lavoro. Quindi qui non c'è nessuna parola di cibo. Ci sono solo i **modi di affermare una
 * proprietà nutrizionale**: gli indicatori clinici per nome (indice glicemico, glicemia,
 * colesterolo, insulina), i confronti fra alimenti su una grandezza misurabile («ha più calorie»,
 * «meno proteine»), le grandezze numeriche (kcal, grammi di proteine) e i giudizi di sostituibilità
 * su base clinica. Una frase come «se hai fame la sera, scrivilo alla tua coach» non tocca niente
 * di tutto questo.
 *
 * Un falso positivo costa una risposta girata alla nutrizionista — che è il comportamento normale
 * della chat per tutto ciò che è clinico. Un falso negativo costa una cliente che mangia secondo
 * un'informazione inventata.
 */

const normalizza = (testo: string): string =>
  (testo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

interface Divieto {
  pattern: RegExp;
  motivo: string;
}

const DIVIETI: Divieto[] = [
  // 1. Indicatori clinici per nome. Se la cliente li nomina, `ai-filter` manda la domanda alla
  //    nutrizionista: non ha senso che Gaia possa nominarli lei in una risposta.
  {
    pattern: /indice glicemico|carico glicemico|glicemi|insulin|colesterol|trigliceridi|tiroid|pressione (arteriosa|alta|bassa)|metabolismo basale/,
    motivo: 'indicatori clinici (indice glicemico, glicemia, colesterolo…)',
  },
  // 2. Confronti su una grandezza misurabile: è la forma esatta dell'errore del basmati.
  //    «più/meno <grandezza>» e «<grandezza> più alto/basso di».
  {
    pattern:
      /(piu|meno|maggior\w*|minor\w*|superior\w*|inferior\w*)\s+(calori\w*|caloric\w*|proteic\w*|proteine|carboidrat\w*|zuccher\w*|grass\w*|fibr\w*|sodio|sale|raffinat\w*|integral\w*|digeribil\w*|sazian\w*|nutrient\w*)/,
    motivo: 'confronto nutrizionale fra alimenti',
  },
  {
    pattern:
      /(calori\w*|proteine|carboidrat\w*|zuccher\w*|grass\w*|fibr\w*|indice)\s+(piu |meno )?(alt\w+|bass\w+|elevat\w+|ridott\w+)/,
    motivo: 'confronto nutrizionale fra alimenti',
  },
  // 3. Sazietà e assorbimento presentati come effetto: «sazia meno», «fa aumentare la glicemia»,
  //    «si assorbe più lentamente». Sono le motivazioni con cui un dato sbagliato si giustifica.
  {
    pattern: /sazia (di )?(piu|meno)|(piu|meno) sazian|fa (aumentare|salire|abbassare|scendere)|si assorb|assorbimento (piu|lent|rapid)|picco (glicemico|di zuccheri)/,
    motivo: 'effetto fisiologico attribuito a un alimento',
  },
  // 4. Numeri nutrizionali. Gaia non ha la tabella nutrizionale davanti: se cita una cifra, la sta
  //    ricordando a memoria. I grammi di una sostituzione li decide il motore o la nutrizionista.
  {
    pattern: /\d[\d.,]*\s?(kcal|calorie|cal\b|g di (proteine|carboidrat|grass|fibr|zuccher)|grammi di (proteine|carboidrat|grass|fibr|zuccher))/,
    motivo: 'valori nutrizionali numerici',
  },
  // 5. Il giudizio di sostituibilità su base clinica. Chi può stare al posto di cosa lo dicono i
  //    gruppi di equivalenza approvati dalla nutrizionista, non l'opinione del modello: è la
  //    stessa decisione che il 10/8 abbiamo smesso di far ridiscutere a Gaia nelle alternative.
  {
    pattern: /(non |mai )?(puoi|potresti|conviene|meglio|preferibile|sconsigli\w*|consigli\w*|evita\w*)[^.!?]{0,40}(sostitui|al posto d)/,
    motivo: 'giudizio su una sostituzione (lo decidono i gruppi di equivalenza)',
  },
];

export interface EsitoGuardia {
  /** Vero = la risposta si può mandare così com'è. */
  ok: boolean;
  /** Perché è stata fermata: finisce nel `meta` del messaggio, quindi è leggibile dallo staff. */
  motivo?: string;
}

/**
 * La risposta che la cliente legge quando Gaia si ferma. Dice **perché** e cosa succede adesso:
 * «non lo so» detto chiaramente vale più di una risposta plausibile, e la domanda non si perde
 * perché parte insieme a questa frase verso la nutrizionista.
 */
export const RISPOSTA_FERMATA =
  'Su questo non voglio dirti una cosa a caso: riguarda la tua alimentazione nel dettaglio, ' +
  'e la risposta giusta te la dà la tua nutrizionista. Le ho già girato la domanda, ti risponde lei.';

export function verificaRispostaGaia(testo: string | null | undefined): EsitoGuardia {
  if (!testo) return { ok: true };
  const t = normalizza(testo);
  for (const d of DIVIETI) {
    if (d.pattern.test(t)) return { ok: false, motivo: d.motivo };
  }
  return { ok: true };
}
