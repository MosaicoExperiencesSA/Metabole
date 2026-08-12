/**
 * CONFRONTARE DUE NOMI DI ALIMENTO — la regola sta qui, e in nessun altro posto.
 *
 * Queste funzioni vivevano dentro `menu/sostituzione-chat.ts`, che è il file del DIALOGO in chat.
 * Sono state portate qui quando è nata la tabella delle sostituzioni (§16.9), perché da lì in poi
 * a interrogarle non è più solo la conversazione: lo fa la tabella per raggruppare le righe
 * («carote» e «carota» sono la stessa richiesta), e lo fa «promuovi a regola» per decidere se un
 * gruppo di equivalenza copre già quell'alimento. Importare il file della chat da un modulo che
 * con la chat non c'entra niente era storto, e sarebbe finita come i metodi di cottura: una
 * seconda copia, leggermente diversa.
 * `menu/sostituzione-chat.ts` le ri-esporta, quindi tutti gli import esistenti continuano a valere.
 *
 * ## ⚠️ Per PAROLA, con la radice. Mai per sottostringa.
 *
 * È la riga che conta di più. Con `nome.includes(termine)` «pepe» combacia con «peperoni»: il
 * cancello delle spezie non scatta (viene interrogato sul nome trovato, e «peperoni» non è una
 * spezia), la cliente che voleva togliere il pepe si vede sostituire i peperoni e — con «non mi
 * piace» — escluderli per sempre. Stessa storia con «mela» e «melanzane», «pane» e «pancetta»,
 * «orzo» e «gorzo».
 */

/** Minuscolo, senza accenti, senza spazi ai bordi. Il primo passo di tutto il resto. */
export const normalizza = (testo: string): string =>
  (testo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Parole di servizio dentro il NOME di un alimento: da sole non lo identificano. */
const PAROLE_NEUTRE = new Set(['di', 'del', 'della', 'dei', 'delle', 'con', 'alla', 'allo', 'ben', 'tipo']);

/**
 * Radice grezza: toglie la vocale finale alle parole lunghe, così «carote» e «carota» coincidono
 * senza dover elencare i plurali. Le parole corte non si toccano — accorciare «pepe» a «pep» è
 * proprio il modo di farlo combaciare con «peperoni».
 */
export function radice(parola: string): string {
  const p = normalizza(parola);
  return p.length >= 5 && /[aeio]$/.test(p) ? p.slice(0, -1) : p;
}

/** Le parole che portano significato dentro il nome di un alimento. */
export function paroleAlimento(nome: string): string[] {
  return normalizza(nome)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !PAROLE_NEUTRE.has(p));
}

/**
 * Vero se il termine scritto dalla cliente indica quell'ingrediente.
 *
 * Il confronto è PER PAROLA, non per sottostringa: vedi il riquadro in testa al file.
 */
export function combaciaAlimento(nomeIngrediente: string, termine: string): boolean {
  const nome = normalizza(nomeIngrediente);
  const t = normalizza(termine);
  if (!nome || !t) return false;
  if (radice(nome) === radice(t)) return true;
  const paroleN = paroleAlimento(nomeIngrediente).map(radice);
  const paroleT = paroleAlimento(termine).map(radice);
  if (!paroleN.length || !paroleT.length) return false;
  // Ogni parola del termine deve trovare una parola dell'ingrediente: «yogurt greco» prende
  // «yogurt greco» e «yogurt», «pepe» non prende «peperoni».
  return paroleT.every((pt) => paroleN.includes(pt));
}

/**
 * Vero se due nomi di alimento condividono una parola: serve a scartare i sostituti che sono una
 * VARIANTE dello stesso cibo — «yogurt» → «yogurt senza lattosio» risolve il lattosio e non
 * risolve niente a chi lo yogurt non piace.
 */
export function condividonoAlimento(a: string, b: string): boolean {
  const radiciA = new Set(paroleAlimento(a).map(radice));
  return paroleAlimento(b).map(radice).some((p) => radiciA.has(p));
}

/**
 * La forma stabile di un nome di alimento, per confrontarlo in una COLONNA invece che in memoria
 * (§16.9): «Carote fresche», «carota fresca» e «CAROTE  FRESCHE» danno tutte `carot fresch`.
 *
 * Serve a due cose che `combaciaAlimento` non può fare, perché è una funzione e non un indice:
 * riconoscere che una richiesta è la STESSA di una già registrata (e quindi contarla, invece di
 * aprire la millesima riga uguale), e cercare «chi ha chiesto di togliere le carote» senza
 * leggere tutta la tabella.
 *
 * ⚠️ Non sostituisce `combaciaAlimento`: due chiavi diverse possono comunque combaciare
 * («yogurt» e «yogurt greco»). La chiave è per l'uguaglianza esatta, il confronto per parola resta
 * per la somiglianza.
 */
export function chiaveAlimento(nome: string): string {
  const parole = paroleAlimento(nome).map(radiceDiChiave);
  // Niente parole «vere» (nomi cortissimi come «te», o solo punteggiatura): meglio la radice del
  // nome intero che una chiave vuota, che accorperebbe alimenti diversi sotto lo stesso valore.
  if (!parole.length) return radiceDiChiave(nome) || normalizza(nome);
  return parole.join(' ');
}

/**
 * La radice della CHIAVE è un filo più aggressiva di `radice`: toglie anche la `h` che l'italiano
 * infila davanti a `e`/`i` per tenere il suono duro.
 *
 * Senza, «pesca» dà `pesc` e «pesche» dà `pesch`: due righe per la stessa richiesta, e il
 * conteggio — che è il motivo per cui la tabella esiste — si spacca in due. Stessa storia con
 * zucca/zucche, bistecca/bistecche, gnocco/gnocchi.
 *
 * ⚠️ Sta QUI e non dentro `radice` di proposito: `radice` la usa `combaciaAlimento`, cioè il
 * confronto che decide se togliere un ingrediente dal piatto di una persona. Renderlo più
 * aggressivo per comodità di una colonna è il modo di far combaciare due cibi che non c'entrano
 * niente — la lezione di «pepe» e «peperoni», applicata al contrario. Qui il costo di un
 * accorpamento sbagliato è una riga contata due volte; là è un pasto.
 */
function radiceDiChiave(parola: string): string {
  return radice(parola).replace(/h$/, '');
}
