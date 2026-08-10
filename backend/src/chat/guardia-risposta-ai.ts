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
 *
 * ## LA SECONDA VERSIONE, poche ore dopo: «può affermarlo ma deve prima verificare»
 *
 * La prima stesura di questa guardia vietava a Gaia **ogni** affermazione nutrizionale. Simone ha
 * chiesto l'opposto, ed è la scelta giusta: «può affermarlo ma deve prima verificare sulle banche
 * dati e dare dati corretti; magari poi li memorizza e arricchisce il suo sapere». Un assistente che
 * a ogni domanda risponde «chiedi alla nutrizionista» non è prudente, è inutile.
 *
 * Quindi ora ci sono **due modalità**, e la differenza sta tutta in chi ha fornito i numeri:
 *
 *  - **senza dati** — Gaia parla a memoria: vale tutto l'elenco dei divieti qui sotto. È il caso di
 *    un alimento che non è nella banca dati, e la risposta giusta è dirlo;
 *  - **con i dati** (`nutrient_fact`, vedi `nutrient-facts/valori-nutrizionali.service.ts`) — i
 *    divieti marcati `soloSenzaDati` cadono, perché citare un valore con la sua fonte non è
 *    inventare. Al loro posto entra un controllo più forte: **nessun numero che non le abbiamo
 *    dato**. Il divieto diventa una verifica, ed è l'unica differenza tecnica fra un modello che cita
 *    e un modello che ricorda.
 *
 * Restano vietati in entrambe le modalità gli **effetti fisiologici** («sazia meno»: non abbiamo dati
 * sulla sazietà, e quella frase era la metà inventata dell'errore del basmati) e i **giudizi su cosa
 * può sostituire cosa**, che li decidono i gruppi di equivalenza approvati dalla nutrizionista.
 */

const normalizza = (testo: string): string =>
  (testo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

interface Divieto {
  pattern: RegExp;
  motivo: string;
  /**
   * Vero = questo divieto vale **solo quando non abbiamo dato i dati** a Gaia.
   *
   * È la differenza fra il 10/8 e l'11/8. All'inizio la guardia vietava ogni affermazione
   * nutrizionale, perché Gaia le inventava. Poi Simone ha deciso il contrario, e ha ragione: «può
   * affermarlo ma deve prima verificare e dare dati corretti». Quindi quando la risposta è costruita
   * sui valori della banca dati (`nutrient_fact`), dire «l'indice glicemico sta fra 57 e 67» non è più
   * un'invenzione — è una citazione, con la fonte.
   *
   * Quello che **non** diventa lecito nemmeno con i dati davanti sta più sotto con questo flag
   * spento: gli effetti fisiologici (non abbiamo dati sulla sazietà) e i giudizi su cosa può
   * sostituire cosa (lo decidono i gruppi di equivalenza della nutrizionista, non un modello).
   */
  soloSenzaDati?: boolean;
}

const DIVIETI: Divieto[] = [
  // 1. Indicatori clinici per nome. Se la cliente li nomina, `ai-filter` manda la domanda alla
  //    nutrizionista: non ha senso che Gaia possa nominarli lei in una risposta.
  {
    pattern: /indice glicemico|carico glicemico|glicemi|insulin|colesterol|trigliceridi|tiroid|pressione (arteriosa|alta|bassa)|metabolismo basale/,
    motivo: 'indicatori clinici (indice glicemico, glicemia, colesterolo…)',
    // Con i dati davanti l'indice glicemico si può dire: è il dato che abbiamo in tabella, con la
    // fonte. Gli altri indicatori di questo elenco non sono in tabella, ma restano coperti dal
    // controllo sui numeri: senza un valore da citare, non c'è niente da dire.
    soloSenzaDati: true,
  },
  // 2. Confronti su una grandezza misurabile: è la forma esatta dell'errore del basmati.
  //    «più/meno <grandezza>» e «<grandezza> più alto/basso di».
  {
    pattern:
      /(piu|meno|maggior\w*|minor\w*|superior\w*|inferior\w*)\s+(calori\w*|caloric\w*|proteic\w*|proteine|carboidrat\w*|zuccher\w*|grass\w*|fibr\w*|sodio|sale|raffinat\w*|integral\w*|digeribil\w*|sazian\w*|nutrient\w*)/,
    motivo: 'confronto nutrizionale fra alimenti',
    // Un confronto fra due numeri che le abbiamo dato è aritmetica, non opinione.
    soloSenzaDati: true,
  },
  {
    pattern:
      /(calori\w*|proteine|carboidrat\w*|zuccher\w*|grass\w*|fibr\w*|indice)\s+(piu |meno )?(alt\w+|bass\w+|elevat\w+|ridott\w+)/,
    motivo: 'confronto nutrizionale fra alimenti',
    soloSenzaDati: true,
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
    // Con i dati davanti i numeri si possono dire, ma **solo quelli**: ci pensa `numeriEstranei`.
    soloSenzaDati: true,
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

export interface DatiFornitiAGaia {
  /**
   * I numeri che le abbiamo messo davanti (valori della banca dati). Nella risposta non possono
   * comparirne altri: è il controllo che rende «deve dare dati corretti» una cosa verificabile invece
   * di una raccomandazione.
   */
  numeriAmmessi: number[];
}

/**
 * I numeri di una frase che NON sono fra quelli forniti.
 *
 * Si ignorano i numeri piccoli senza unità nutrizionale (1, 2, 3: «i primi 3 giorni», «2 volte al
 * giorno») perché non sono dati, sono conteggi; e gli anni. Tutto il resto deve venire dalla tabella.
 *
 * Il confronto è tollerante sull'arrotondamento — 82 e 82,0 sono lo stesso numero — perché il modello
 * riformula, e bocciare una risposta giusta per una virgola insegnerebbe solo a diffidare della
 * guardia.
 */
export function numeriEstranei(testo: string, ammessi: number[]): number[] {
  const trovati = (testo.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.')));
  const ok = new Set<number>();
  for (const a of ammessi) {
    ok.add(a);
    ok.add(Math.round(a));
    ok.add(Math.round(a * 10) / 10);
  }
  return trovati.filter((n) => {
    if (!Number.isFinite(n)) return false;
    // Conteggi e quantità di vita quotidiana: non sono dati nutrizionali.
    if (Number.isInteger(n) && n <= 12) return false;
    // Anni.
    if (Number.isInteger(n) && n >= 1900 && n <= 2100) return false;
    return !ok.has(n) && !ok.has(Math.round(n)) && !ok.has(Math.round(n * 10) / 10);
  });
}

/**
 * La risposta che la cliente legge quando Gaia si ferma. Dice **perché** e cosa succede adesso:
 * «non lo so» detto chiaramente vale più di una risposta plausibile, e la domanda non si perde
 * perché parte insieme a questa frase verso la nutrizionista.
 */
export const RISPOSTA_FERMATA =
  'Su questo non voglio dirti una cosa a caso: riguarda la tua alimentazione nel dettaglio, ' +
  'e la risposta giusta te la dà la tua nutrizionista. Le ho già girato la domanda, ti risponde lei.';

export function verificaRispostaGaia(
  testo: string | null | undefined,
  dati?: DatiFornitiAGaia | null,
): EsitoGuardia {
  if (!testo) return { ok: true };
  const t = normalizza(testo);
  const fondata = !!dati && dati.numeriAmmessi.length > 0;

  for (const d of DIVIETI) {
    if (fondata && d.soloSenzaDati) continue;
    if (d.pattern.test(t)) return { ok: false, motivo: d.motivo };
  }

  if (fondata) {
    /**
     * IN MODALITÀ FONDATA IL CONTROLLO SI CAPOVOLGE: non «hai detto un numero?» ma «hai detto un
     * numero che non ti ho dato?». È il punto in cui questa guardia smette di essere un divieto e
     * diventa una verifica — l'unica differenza fra un modello che cita e un modello che ricorda.
     */
    const estranei = numeriEstranei(testo, dati!.numeriAmmessi);
    if (estranei.length > 0) {
      return {
        ok: false,
        motivo: `numeri non presenti nei dati forniti (${estranei.slice(0, 5).join(', ')}): li ha messi il modello, non la banca dati`,
      };
    }
  }

  return { ok: true };
}
