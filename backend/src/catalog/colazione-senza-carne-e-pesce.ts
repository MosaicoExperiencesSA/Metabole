/**
 * ⛔ **CARNE E PESCE FUORI DA COLAZIONE, SPUNTINO E MERENDA — sui piatti che ci sono GIÀ.**
 *
 * Simone, 31/8: *«carne, pesce e verdure evitiamole nelle colazioni, merende e spuntini»*. La
 * regola è stata scritta quel giorno (`PASTI_SENZA_CARNE_PESCE_VERDURA`, `vaBeneAColazione`) ed è
 * applicata in **un posto solo**: l'agente che *genera* i piatti leggeri nuovi. Serve a non farne
 * creare altri.
 *
 * ⛔ **Su quello che era già in catalogo non l'ha mai passata nessuno**, e il 4/9 Simone l'ha visto
 * in pagina: «Basso indice glicemico · Onnivoro · Colazione» con dentro branzino al vapore, burger
 * di merluzzo, dentice, filetto di trota (due), salmone affumicato. Il motore da quel paniere ci
 * pesca, quindi quei piatti possono arrivare davvero a colazione.
 *
 * ## Perché due letture e non una
 *
 * `diCosaE` decide dall'**ingrediente che pesa di più**, ed è la lettura giusta per «di cosa è
 * questo piatto» — ma ⛔ **risponde `null` quando le grammature non ci sono**, e `null` non è «va
 * bene»: è «non lo so». Un catalogo pieno di ricette senza grammature lascerebbe passare tutto.
 *
 * Perciò qui si guarda anche il **nome e gli ingredienti per parola** (`eCarne`/`ePesce`, gli
 * stessi del resto del progetto): un piatto che si chiama «Branzino al vapore» a colazione non ci
 * va, che le grammature ci siano o no.
 *
 * ⚠️ **E la lettura per parola è quella corretta il 4/9**: «Burger vegetale di lenticchie nere» e
 * «Polpo di ceci» non scattano più, perché `senzaImitazioni` sa che il segno vegetale attaccato
 * all'animale vuol dire che l'animale non c'è. Senza quella correzione questa pulizia avrebbe
 * tolto dai panieri dei piatti vegetali — cioè avrebbe fatto il danno che vuole evitare.
 *
 * ## ⚠️ Nessuna famiglia è un'eccezione — chiesto e risposto il 4/9
 *
 * La diagnostica del 4/9 ha mostrato che **Keto e Keto-Mediterranea pagano quasi tutto il conto**:
 * le loro merende passano da 106 e 89 piatti a ventisei. Su una dieta chetogenica «carne e pesce
 * fuori dagli spuntini» è una regola scomoda, perché lì lo spuntino proteico è normale — quindi la
 * domanda è stata fatta prima di applicare. ⛔ Simone: *«vale per tutte»*. Nessuna eccezione scritta
 * nel codice, e questo modulo non guarda la famiglia.
 *
 * ⚠️ **Il rimedio resta `MINIMO_PER_CELLA`, non un'eccezione**: le celle che scenderebbero sotto la
 * soglia si nominano e non si toccano, così la regola vale per tutte senza svuotare nessuno. Le
 * keto restano da riempire con degli spuntini che non siano carne — ed è un lavoro di catalogo,
 * non una riga di codice.
 *
 * ## ⛔ Le VERDURE non sono qui, ed è una scelta
 *
 * La richiesta del 31/8 ne nominava tre. Questo modulo ne toglie **due**: carne e pesce, che sono
 * quelle che Simone ha rinominato il 4/9 vedendo il paniere. Le verdure si contano e si stampano,
 * **non si tolgono**: a colazione «Avocado toast» e «Crepes con spinaci» sono colazioni normali, e
 * `diCosaE` le legge come verdura per via dell'ingrediente più pesante. Toglierle svuoterebbe i
 * panieri di roba giusta — e un paniere vuoto a colazione è peggio di un branzino.
 */
import { eCarne, eCarneIngrediente, ePesce, diCosaE, vaBeneAColazione, PASTI_SENZA_CARNE_PESCE_VERDURA, type DiCosa, type IngredientePesato } from './piatto-di-cosa';
import { nomiIngredienti } from './elenco-ingredienti';

export { PASTI_SENZA_CARNE_PESCE_VERDURA, vaBeneAColazione };

/** Perché quel piatto non ci va — e sono due letture diverse, che si dicono separate. */
export type MotivoFuoriPosto = 'carne nel nome' | 'pesce nel nome' | 'carne fra gli ingredienti' | 'pesce fra gli ingredienti';

export interface PiattoDaGuardare {
  id: string;
  nome: string;
  /** I nomi degli ingredienti, già estratti. */
  ingredienti: readonly string[];
  /** Gli ingredienti con i grammi, quando ci sono: serve a `diCosaE`. */
  pesati?: readonly IngredientePesato[];
  /**
   * ⚠️ **Se la ricetta è attiva.** `undefined` = non lo so, e vale **attiva**: è il ripiego
   * conservativo, perché la soglia si misura sulle attive e contarne una in più fa togliere di
   * meno, non di più.
   */
  attivo?: boolean;
}

/** ⚠️ Il ripiego in un posto solo: «non lo so» vale attiva. Vedi `PiattoDaGuardare.attivo`. */
const eAttivo = (p: PiattoDaGuardare) => p.attivo !== false;

export interface FuoriPosto {
  id: string;
  nome: string;
  motivo: MotivoFuoriPosto;
  /** La parola o l'ingrediente che ha fatto scattare: si legge, non si indovina. */
  prova: string;
  /** Cosa dice `diCosaE`, quando le grammature ci sono: `null` = non lo so. */
  diCosa: DiCosa | null;
  /** ⚠️ Se la ricetta è attiva: decide se questa riga pesa sulla soglia o si può togliere sempre. */
  attivo: boolean;
}

/**
 * Il piatto va tolto da colazione/spuntino/merenda?
 *
 * ⚠️ **L'ordine delle due letture conta per la PROVA, non per l'esito**: si guarda prima il nome,
 * perché è quello che una persona riconosce aprendo l'elenco («Branzino al vapore»), e solo dopo
 * gli ingredienti. Un piatto che scatta su tutti e due esce una volta sola, col motivo più leggibile.
 */
export function fuoriPostoAColazione(p: PiattoDaGuardare): FuoriPosto | null {
  const diCosa = p.pesati?.length ? diCosaE(p.pesati, () => null) : null;
  const base = { id: p.id, nome: p.nome, diCosa, attivo: eAttivo(p) };
  if (eCarne(p.nome)) return { ...base, motivo: 'carne nel nome', prova: p.nome };
  if (ePesce(p.nome)) return { ...base, motivo: 'pesce nel nome', prova: p.nome };
  const carne = p.ingredienti.find((i) => eCarneIngrediente(i));
  if (carne) return { ...base, motivo: 'carne fra gli ingredienti', prova: carne };
  const pesce = p.ingredienti.find((i) => ePesce(i));
  if (pesce) return { ...base, motivo: 'pesce fra gli ingredienti', prova: pesce };
  return null;
}

/**
 * ⚠️ **Traslocata qui il 4/9**: viveva in `panieri.service.ts`, e da quel giorno la chiede anche
 * `updateRecipe` — quando una ricetta cambia pasto, le sue righe di paniere la seguono, e in un
 * pasto leggero un piatto di carne non ci può andare. Importare il servizio dei panieri dentro il
 * catalogo avrebbe chiuso un cerchio: la funzione è pura e sta col giudizio che chiama.
 */
/**
 * Il motivo per cui questa ricetta non va in quel pasto, o `null`.
 *
 * ⚠️ **Due letture, nome e ingredienti**, come la diagnostica: i gamberetti nel nome spesso non
 * compaiono, e un elenco ingredienti povero non è «va bene», è «non lo so».
 */
export function fuoriPostoNelPasto(
  ricetta: { id: string; name: string; ingredients?: unknown },
  slot: string,
): string | null {
  if (!(PASTI_SENZA_CARNE_PESCE_VERDURA as readonly string[]).includes(slot)) return null;
  const fuori = fuoriPostoAColazione({
    id: ricetta.id,
    nome: ricetta.name,
    ingredienti: nomiIngredienti(ricetta.ingredients),
  });
  if (!fuori) return null;
  return `«${ricetta.name}» è ${fuori.motivo.startsWith('carne') ? 'carne' : 'pesce'} (${fuori.prova}): `
    + 'a colazione, spuntino e merenda non ci va. La regola è del 31/8 e vale su tutte le famiglie.';
}


export interface Cella {
  paniereId: string;
  etichetta: string;
  slot: string;
  piatti: readonly PiattoDaGuardare[];
}

export interface EsitoCella {
  paniereId: string;
  etichetta: string;
  slot: string;
  quanti: number;
  fuoriPosto: FuoriPosto[];
  /** Quanti resterebbero togliendo i fuori posto. */
  restano: number;
  /** Quante delle ricette della cella sono ATTIVE, cioè quante il motore può davvero pescare. */
  attivi: number;
  /**
   * ⛔ **Quante ATTIVE resterebbero: è il numero che decide, e prima era un altro.**
   *
   * La soglia esiste per non lasciare una cliente con tre colazioni. Ma una cliente riceve solo le
   * ricette **attive**: contare anche le bozze nella soglia vorrebbe dire lasciare un branzino
   * dentro perché la cella è piena di piatti che nessuno riceve.
   */
  restanoAttivi: number;
  /** ⚠️ Solo contate, mai tolte: vedi il cappello. */
  verdure: number;
}

/**
 * ⛔ **SOTTO QUESTA SOGLIA NON SI TOGLIE NIENTE, e si dice perché.**
 *
 * Una cella di colazione che resta con due piatti serve alla cliente lo stesso piatto a giorni
 * alterni, e dopo tre giorni smette di aprire l'app. Il branzino a colazione è sbagliato; una
 * colazione che non c'è è peggio. Sotto la soglia la riga si stampa lo stesso — con scritto che
 * **prima** va riempita — ma la pulizia la salta.
 *
 * ⚠️ È un numero di prodotto, non una costante tecnica: si sposta, sapendo perché era lì.
 */
export const MINIMO_PER_CELLA = 8;

export function guardaLeCelle(celle: readonly Cella[]): EsitoCella[] {
  return celle.map((c) => {
    const fuoriPosto = c.piatti.map((p) => fuoriPostoAColazione(p)).filter((x): x is FuoriPosto => x !== null);
    const verdure = c.piatti.filter((p) => p.pesati?.length && diCosaE(p.pesati, () => null) === 'verdura').length;
    const attivi = c.piatti.filter(eAttivo).length;
    const fuoriPostoAttivi = fuoriPosto.filter((f) => f.attivo).length;
    return {
      paniereId: c.paniereId,
      etichetta: c.etichetta,
      slot: c.slot,
      quanti: c.piatti.length,
      fuoriPosto,
      restano: c.piatti.length - fuoriPosto.length,
      attivi,
      restanoAttivi: attivi - fuoriPostoAttivi,
      verdure,
    };
  });
}

/**
 * ⛔ **CHE COSA SI TOGLIE DA QUESTA CELLA — riga per riga, non tutta o niente.**
 *
 * ⚠️ **Le BOZZE si tolgono SEMPRE**, e non è una scorciatoia: una bozza non arriva nel piatto di
 * nessuna cliente, quindi toglierla non può svuotare niente — la soglia esiste per proteggere
 * quello che una cliente riceve. Lasciarla dentro vorrebbe dire tenere in cella un branzino che
 * entrerà in colazione **il giorno che qualcuno lo valida**, cioè quando nessuno lo starà più
 * guardando con questa domanda in testa.
 *
 * ⚠️ Le ATTIVE si tolgono solo se dopo ne restano abbastanza (`restanoAttivi >= minimo`): è il
 * numero che decide, ed è misurato sulle attive perché sono quelle che una cliente riceve.
 */
export function daTogliere(e: EsitoCella, minimo = MINIMO_PER_CELLA): FuoriPosto[] {
  const bozze = e.fuoriPosto.filter((f) => !f.attivo);
  if (e.restanoAttivi >= minimo) return e.fuoriPosto;
  return bozze;
}

/** Le celle in cui c'è qualcosa da togliere davvero — bozze comprese. */
export function celleDaPulire(esiti: readonly EsitoCella[], minimo = MINIMO_PER_CELLA): EsitoCella[] {
  return esiti.filter((e) => daTogliere(e, minimo).length > 0);
}

/**
 * Le celle che hanno dei fuori posto ATTIVI che svuoterebbero: si nominano, non si toccano.
 *
 * ⚠️ Una cella può stare **in tutti e due gli elenchi**: le sue bozze si puliscono, le sue attive
 * no. È la situazione normale di un paniere a metà validazione, e dirla in due righe è più onesto
 * che scegliere una delle due.
 */
export function celleTroppoVuote(esiti: readonly EsitoCella[], minimo = MINIMO_PER_CELLA): EsitoCella[] {
  return esiti.filter((e) => e.fuoriPosto.some((f) => f.attivo) && e.restanoAttivi < minimo);
}
