/**
 * UNA PAROLA CHE DIVENTA DI TUTTE — chi ne ha già una sua, e in cosa differisce.
 *
 * Domanda di Nocanty (13/8): «quando una parola imparata su una cliente diventa valida per tutte,
 * cosa succede a chi ne aveva già una sua diversa?». Risposta di Simone: **«chiedi conferma al
 * nutrizionista capo attraverso Vera»**. Decisione in
 * `progetto/NOTA_Dizionario_Promosso_Conferma_Capo.md`.
 *
 * ## Cosa cambia e cosa no
 *
 * La convivenza resta: la voce personale vince sempre sulla comune (`dizionario.suaPrima`), e
 * nessuno viene sovrascritto — «pasto leggero» non vuol dire la stessa cosa per due nutrizioniste,
 * e una parola resa comune non deve riscrivere il vocabolario di una professionista che non ha
 * chiesto niente. Quello che cambia è che il capo **lo sa prima di dire sì**, invece di approvare
 * alla cieca una parola che tre persone usano già in un altro senso.
 *
 * Modulo **puro**: la regola si prova per tabella, e il testo che legge il capo si corregge senza
 * toccare niente che scriva.
 */
import { chiaveAlimento } from '../common/nomi-alimento';

export interface VoceDiDizionario {
  nutrizionistaId: string;
  nome: string;
  membri: string[];
  /** Il nome della nutrizionista, per la frase. Senza, si mostra l'id accorciato. */
  nutrizionistaNome?: string | null;
  /** Le voci già comuni non sono «di qualcuno»: non entrano nel confronto. */
  comune?: boolean;
}

export interface ConflittoDizionario {
  nutrizionistaId: string;
  nutrizionistaNome?: string | null;
  /** Alimenti che la voce comune aggiungerebbe rispetto alla sua. */
  inPiuNellaComune: string[];
  /** Alimenti che ha lei e che nella comune non ci sono. */
  soloNellaSua: string[];
}

/** L'insieme degli alimenti, ridotti alla radice: due elenchi uguali devono risultare uguali. */
function insieme(membri: readonly string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const x of membri ?? []) {
    const k = chiaveAlimento(x ?? '');
    if (k && !m.has(k)) m.set(k, (x ?? '').trim());
  }
  return m;
}

/**
 * Chi, fra le altre nutrizioniste, ha una voce con lo STESSO NOME e alimenti diversi.
 *
 * ⚠️ Il confronto è per radice (`chiaveAlimento`), non per stringa: «crescenze» e «crescenza» sono
 * la stessa cosa, e far comparire un conflitto per una lettera insegnerebbe a ignorare l'avviso.
 * ⚠️ Chi ce l'ha identica NON compare: quello che cambia la decisione è solo il disaccordo.
 */
export function conflittiDiPromozione(
  daPromuovere: VoceDiDizionario,
  altre: readonly VoceDiDizionario[],
): ConflittoDizionario[] {
  const nomeChiave = chiaveAlimento(daPromuovere.nome);
  if (!nomeChiave) return [];
  const comune = insieme(daPromuovere.membri);

  const fuori: ConflittoDizionario[] = [];
  for (const v of altre ?? []) {
    if (v.comune) continue;
    if (v.nutrizionistaId === daPromuovere.nutrizionistaId) continue;
    if (chiaveAlimento(v.nome) !== nomeChiave) continue;

    const sua = insieme(v.membri);
    const inPiuNellaComune = [...comune].filter(([k]) => !sua.has(k)).map(([, nome]) => nome);
    const soloNellaSua = [...sua].filter(([k]) => !comune.has(k)).map(([, nome]) => nome);
    if (!inPiuNellaComune.length && !soloNellaSua.length) continue;

    fuori.push({
      nutrizionistaId: v.nutrizionistaId,
      nutrizionistaNome: v.nutrizionistaNome ?? null,
      inPiuNellaComune,
      soloNellaSua,
    });
  }
  return fuori;
}

/** Quanti nomi si elencano prima di dire «e altre N»: oltre, la frase non si legge più. */
const MAX_NOMI = 5;

/**
 * La frase che il capo legge PRIMA di approvare.
 *
 * ⚠️ Finisce dicendo cosa **non** succede («le loro restano e continuano a valere»): senza quella
 * riga il capo può credere di star cambiando i menu delle clienti di qualcun altro, e la prudenza
 * che ne segue è prudenza sbagliata — respingerebbe una promozione buona per paura di un effetto
 * che non esiste.
 */
export function raccontaConflitti(conflitti: readonly ConflittoDizionario[]): string {
  if (!conflitti.length) return '';
  const righe = conflitti.slice(0, MAX_NOMI).map((c) => {
    const chi = c.nutrizionistaNome ?? c.nutrizionistaId.slice(0, 8);
    const pezzi: string[] = [];
    if (c.inPiuNellaComune.length) pezzi.push(`lei non ha ${c.inPiuNellaComune.join(', ')}`);
    if (c.soloNellaSua.length) pezzi.push(`lei ha anche ${c.soloNellaSua.join(', ')}`);
    return `· **${chi}**: ${pezzi.join('; ')}`;
  });
  const quante =
    conflitti.length === 1
      ? '⚠️ Una nutrizionista ha già una sua versione diversa di questa parola:'
      : `⚠️ ${conflitti.length} nutrizioniste hanno già una loro versione diversa di questa parola:`;
  const altre = conflitti.length > MAX_NOMI ? `\n· …e altre ${conflitti.length - MAX_NOMI}` : '';
  return (
    `${quante}\n${righe.join('\n')}${altre}\n\n` +
    'Se approvi, **le loro restano** e continuano a valere per le loro clienti: la voce comune serve ' +
    'a chi non ne ha una sua.'
  );
}
