/**
 * VERIFICARE A VOCE I CAMBI CONCORDATI IN CHAT — voce 245, lettura **A** di Simone (14/8).
 * Foglio: `progetto/DECISIONE_Verificare_Cambi_A_Voce.md`.
 *
 * Gaia propone la sostituzione **a pari grammatura** e la registra come `da_verificare`. In scheda
 * la nutrizionista ha tre gesti: conferma, correggi i grammi, rifiuta. La maggior parte sono
 * conferme — ed è quel lavoro ripetitivo che questo modulo toglie, portando la riga in chat.
 *
 * ## ⚠️ Perché i grammi restano in scheda
 *
 * La riga di aiuto della pagina lo dice meglio di qualunque commento: **70 ml di panna sono ~200
 * kcal, 70 g di olio ~630**. La pari grammatura lì non regge, e il numero giusto lo scrive una
 * persona. Un numero **dettato** non si rilegge: fra 30 e 70 ci sono 400 kcal in un pasto, e il
 * campo davanti agli occhi è l'unica cosa che li fa vedere.
 *
 * Da qui la regola che questo modulo esiste per applicare — **il numero blocca il giro**:
 *
 * | cosa dice | cosa succede |
 * |---|---|
 * | «va bene» | la riga diventa `verificata` |
 * | «no» | la riga diventa `annullata` (col motivo, se lo dice lei) |
 * | «metti 30 g» | **non si scrive niente**: si manda alla scheda |
 * | altro | non si indovina: si richiede |
 *
 * ⚠️ Il caso che conta davvero è la terza riga della tabella letta insieme alla prima: **«sì, ma
 * metti 30 g» non è un sì**. Se passasse per una conferma, la riga verrebbe validata con la
 * grammatura VECCHIA e sembrerebbe che l'abbia approvata lei — l'unico modo di sbagliare che non
 * lascia traccia di essere un errore.
 *
 * Modulo **puro**: qui non si legge e non si scrive niente.
 */

export type Verdetto = 'ok' | 'no' | 'grammi';

/**
 * Le unità con cui si detta una quantità.
 *
 * ⚠️ La `l` secca non c'è, ed è voluto: normalizzando gli apostrofi «3 l'ha chiesta» diventa
 * «3 l ha chiesta», e una frase che racconta la storia della riga finirebbe letta come una
 * grammatura. Le unità che contano davvero in cucina sono tutte più lunghe di una lettera.
 */
const UNITA =
  '(?:g|gr|grammi|grammo|mg|ml|cl|dl|litri|litro|etti|etto|once|oz|cucchiai|cucchiaio|cucchiaini|cucchiaino)';
const NUMERO_CON_UNITA = new RegExp(`\\b\\d{1,4}(?:[.,]\\d{1,2})?\\s*${UNITA}\\b`, 'i');
/** «metti 30 invece di 70» — il numero c'è, l'unità è sottintesa. Serve la cifra: senza, niente. */
const NUMERO_AL_POSTO = /\b(?:invece|al posto)\s+(?:di\s+|del\s+|della\s+)?\d|\b\d{1,4}\s+(?:invece|al posto)\b/i;

const NO = /^(?:no|nope|negativ|non va|non mi va|non ci siamo|rifiut|nega|scarta|annulla|cancella|toglil)/;
const SI = /^(?:si|ok|okay|va bene|vabene|confermo|conferma|giusto|approv|perfetto|esatto|certo|d accordo|daccordo)/;

/** Minuscolo, senza accenti, senza apostrofi, senza punteggiatura finale. */
function normalizzaFrase(frase: string): string {
  return (frase ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cosa ha detto: ✓, ✗, oppure «sta dettando un numero».
 *
 * ⚠️ La grammatura si guarda **per prima**, prima del sì e prima del no. Non è un dettaglio di
 * ordine: è tutta la sicurezza di questa lettura. «Sì, ma metti 30 g» contiene un sì perfettamente
 * valido, e leggerlo come tale scriverebbe `verificata` sulla riga con i grammi di prima.
 *
 * ⚠️ `null` è una risposta: quello che non è né un sì né un no né un numero **non si indovina**.
 */
export function leggiVerdetto(frase: string): Verdetto | null {
  const t = normalizzaFrase(frase);
  if (!t) return null;
  if (NUMERO_CON_UNITA.test(t) || NUMERO_AL_POSTO.test(t)) return 'grammi';
  if (NO.test(t)) return 'no';
  if (SI.test(t)) return 'ok';
  return null;
}

/** Le forme del rifiuto da cui può seguire un motivo. Lo stesso elenco di `NO`, ancorato. */
const RIFIUTO_CON_CODA =
  /^(?:no|nope|negativo|non va bene|non va|non mi va|non ci siamo|rifiuto|rifiutala|nega|scarta|annulla|annullala|cancella)\b[\s,;:.\-–]*/i;

/**
 * Il motivo del rifiuto, **solo se lo dice lei di sua iniziativa**.
 *
 * ⚠️ Vera non lo chiede (decisione del 14/8, scritta nel foglio): in scheda il rifiuto oggi non
 * chiede niente, e imporre qui un campo obbligatorio su una coda fatta apposta per essere veloce
 * significa che al terzo «no» si scrive «boh» pur di andare avanti. Un campo compilato male è
 * peggio di un campo vuoto, perché sembra un dato.
 *
 * Sotto le tre lettere non è un motivo: è un moncone, e finirebbe in tabella come se fosse una
 * spiegazione.
 *
 * ⚠️ E sopra i 300 caratteri si taglia, all'ultimo spazio: è il limite che il campo `nota` ha nel
 * modulo della scheda (`AggiornaSostituzioneDto`). Qui il servizio si chiama direttamente e quel
 * controllo non gira — scrivere a voce una nota che dalla pagina verrebbe rifiutata è la stessa
 * cosa che avere due regole per lo stesso campo.
 */
export const MAX_NOTA = 300;

export function motivoDetto(frase: string): string | null {
  const t = (frase ?? '').trim();
  if (!t) return null;
  if (!RIFIUTO_CON_CODA.test(t)) return null; // non era un rifiuto: nessun motivo da leggere
  const motivo = t.replace(RIFIUTO_CON_CODA, '').replace(/[\s.]+$/, '').trim();
  if (motivo.length < 3) return null;
  if (motivo.length <= MAX_NOTA) return motivo;
  const tagliato = motivo.slice(0, MAX_NOTA);
  const spazio = tagliato.lastIndexOf(' ');
  return `${(spazio > MAX_NOTA / 2 ? tagliato.slice(0, spazio) : tagliato).trim()}…`;
}

export interface RigaSostituzione {
  id: string;
  cliente: string;
  dishName: string | null;
  fromFood: string;
  toFood: string;
  fromQty: number | null;
  toQty: number | null;
  unit: string | null;
  volte: number;
}

/** «70 g», oppure niente — mai «null g». */
function quanto(qty: number | null, unit: string | null): string {
  if (qty === null || qty === undefined || !Number.isFinite(qty)) return '';
  return ` ${qty}${unit ? ` ${unit}` : ''}`;
}

/**
 * Come si legge una sostituzione in chat.
 *
 * ⚠️ Le **volte** ci sono sempre. Una sostituzione chiesta tre volte non è un caso: è una cliente
 * che quel piatto non lo mangia, ed è l'informazione che cambia la decisione — validare la riga o
 * accorgersi che va cambiato il menu. Nella tabella quella colonna c'è; toglierla qui vorrebbe dire
 * far decidere con meno di quello che si vede in pagina.
 */
export function raccontaSostituzione(r: RigaSostituzione): string {
  const piatto = r.dishName ? ` — ${r.dishName}` : '';
  const volte = r.volte > 1 ? `\nChiesta **${r.volte} volte**.` : '\nChiesta una volta.';
  return (
    `**${r.cliente}**${piatto}\n` +
    `${r.fromFood}${quanto(r.fromQty, r.unit)} → **${r.toFood}**${quanto(r.toQty, r.unit)}` +
    volte
  );
}
