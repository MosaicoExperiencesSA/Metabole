/**
 * ⛔ **CHI PUÒ DIGIUNARE, E CHI SI SOSPENDE SUBITO — le regole cliniche di Lucia (5/9).**
 *
 * Le fondamenta del digiuno sono in produzione dal 21/8 (l'orologio, il piano graduale, le push,
 * la scheda staff). Quello che mancava per aprirlo a più clienti non era codice: erano **quattro
 * conferme di una nutrizionista**, e sono arrivate il 5/9 firmate — `progetto/guide/
 * Risposte_Cliniche_Lucia_2026-09-05.pdf`, scheda 7. Questo modulo è la loro traduzione, e sta
 * tutto in un file solo perché il giorno che una soglia cambia si cambia qui.
 *
 * ## Le quattro decisioni, alla lettera
 *
 * 1. **Controindicazione emersa a digiuno già in corso** → *«sospensione immediata»*, approvata
 *    (era il caso della migrazione). ⛔ Il perché sta nell'asimmetria dei due errori: sospendere per
 *    sbaglio costa una giornata piena, che è il comportamento normale del prodotto; non sospendere
 *    costa un digiuno controindicato addosso a una persona.
 * 2. **BMI minimo 18,5** — *«sottopeso escluso da qualsiasi regime di digiuno»*.
 * 3. **Tre domande di esclusione** nel questionario: disturbi del comportamento alimentare (storici
 *    o attivi), gravidanza o allattamento, terapia ipoglicemizzante o diabete di tipo 1.
 * 4. **Quote per pasto**: confermate quelle **attuali** (45 · 10 · 45). ⚠️ Il manuale propone
 *    36 · 16 · 48 e Lucia lo ha **scartato**: la casella barrata è «Standard Attuale». Quindi
 *    `catalog/struttura-per-digiuno.ts` non si tocca — sta scritto lì accanto alle quote, perché
 *    chiunque rilegga il manuale ci ritorna sopra.
 *
 * ## ⚠️ Due porte diverse, e non fanno la stessa cosa
 *
 * · `digiunoSiPuoProporre` guarda **prima**: decide se il digiuno si offre a chi non digiuna.
 * · `vaSospesoSubito` guarda **dopo**: una controindicazione che arriva mentre la cliente digiuna
 *   già. La prima non propone, la seconda **toglie**, e il secondo gesto è più grave del primo —
 *   per questo ha una funzione sua e non un `!` davanti alla prima.
 *
 * ⛔ **Nessuna delle due inventa un dato che non c'è**: senza peso o senza altezza il BMI non si
 * calcola, e «non lo so» **non** è «va bene». Per proporre serve saperlo; per sospendere, no —
 * si sospende solo su una controindicazione **dichiarata**, mai su un dato mancante.
 */

/** Lucia, 5/9: sotto questo BMI il digiuno non si propone a nessuno. */
export const BMI_MINIMO = 18.5;

/**
 * Le tre domande di esclusione, come vanno poste nel questionario. ⚠️ Sono `true` = **esclude**:
 * la risposta che blocca è il sì, e il campo si chiama come la condizione, non come il permesso.
 */
export const DOMANDE_DI_ESCLUSIONE = [
  { chiave: 'dca', domanda: 'Hai (o hai avuto) disturbi del comportamento alimentare?' },
  { chiave: 'gravidanza', domanda: 'Sei in gravidanza o stai allattando?' },
  { chiave: 'ipoglicemizzanti', domanda: 'Prendi farmaci ipoglicemizzanti o hai il diabete di tipo 1?' },
] as const;

export type ChiaveEsclusione = (typeof DOMANDE_DI_ESCLUSIONE)[number]['chiave'];

export interface RisposteDigiuno {
  dca?: boolean | null;
  gravidanza?: boolean | null;
  ipoglicemizzanti?: boolean | null;
}

export interface ProfiloPerDigiuno {
  /** In chili. L'ultima pesata, o il peso di partenza. */
  pesoKg?: number | null;
  heightCm?: number | null;
  /** Le risposte alle tre domande di esclusione. */
  risposte?: RisposteDigiuno | null;
}

/** BMI = kg / m². `null` se manca uno dei due, che è diverso da «va bene». */
export function calcolaBmi(pesoKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!pesoKg || !heightCm || pesoKg <= 0 || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((pesoKg / (m * m)) * 10) / 10;
}

export type EsitoDigiuno =
  | { siPuo: true; bmi: number | null }
  | { siPuo: false; motivo: 'sottopeso' | ChiaveEsclusione | 'dati_mancanti'; frase: string; bmi: number | null };

const FRASE: Record<string, string> = {
  sottopeso: `Il digiuno non si propone sotto un BMI di ${BMI_MINIMO}: è la soglia decisa dalla nutrizionista.`,
  dca: 'Il digiuno non si propone a chi ha (o ha avuto) disturbi del comportamento alimentare.',
  gravidanza: 'Il digiuno non si propone in gravidanza o durante l\'allattamento.',
  ipoglicemizzanti: 'Il digiuno non si propone a chi prende ipoglicemizzanti o ha il diabete di tipo 1.',
  dati_mancanti: 'Per proporre il digiuno servono peso e altezza: senza, il BMI non si calcola.',
};

/**
 * ⛔ **SI PUÒ PROPORRE IL DIGIUNO A QUESTA PERSONA?** Le esclusioni si guardano **prima** del BMI:
 * a una donna in gravidanza la frase giusta è quella, non «sei sottopeso».
 */
export function digiunoSiPuoProporre(p: ProfiloPerDigiuno): EsitoDigiuno {
  const bmi = calcolaBmi(p.pesoKg, p.heightCm);
  for (const { chiave } of DOMANDE_DI_ESCLUSIONE) {
    if (p.risposte?.[chiave] === true) return { siPuo: false, motivo: chiave, frase: FRASE[chiave], bmi };
  }
  if (bmi === null) return { siPuo: false, motivo: 'dati_mancanti', frase: FRASE.dati_mancanti, bmi };
  if (bmi < BMI_MINIMO) return { siPuo: false, motivo: 'sottopeso', frase: FRASE.sottopeso, bmi };
  return { siPuo: true, bmi };
}

export interface Sospensione {
  /** Le ragioni per cui questa cliente non dovrebbe digiunare, tutte, non solo la prima. */
  motivi: ChiaveEsclusione[];
  frase: string;
}

/**
 * ⛔ **VA SOSPESA SUBITO?** Per chi **sta già digiunando**. Ritorna `null` quando non c'è niente da
 * fare — che è il caso normale, e non deve costare niente.
 *
 * ⚠️ **I motivi si dicono tutti**: chi legge la segnalazione deve sapere se è una cosa sola o tre,
 * perché da lì dipende se è un errore di compilazione o una persona da chiamare.
 *
 * ⛔ **SOLO SU UNA CONTROINDICAZIONE DICHIARATA, MAI SUL BMI — corretto in revisione, 5/9.**
 * La prima stesura sospendeva anche sotto i 18,5, e sbagliava due volte. (1) **La lettera della
 * decisione**: Lucia scrive *«sottopeso escluso da qualsiasi regime di digiuno»* nel punto sui
 * **criteri di eligibilità**, cioè su chi il digiuno lo **propone**; il punto sulla sospensione
 * immediata parla di una *«controindicazione emersa»*, che è una cosa che qualcuno dichiara. (2)
 * **Il numero**: il BMI si calcola su una pesata **non verificata**, e questo progetto ha già un
 * modulo che si rifiuta di credere alle pesate assurde (`signals/peso-incoerente.ts`). Una cliente
 * di 68 kg che digita 48 si sarebbe vista cambiare percorso quella notte, con la base personale
 * disallineata e nessun gesto inverso per rimetterla com'era. Correggere la pesata il giorno dopo
 * non avrebbe ripristinato niente.
 *
 * ⚠️ Il sottopeso resta in `digiunoSiPuoProporre`, dove costa una proposta in meno e non un
 * percorso tolto: è lì che la soglia di Lucia protegge davvero.
 */
export function vaSospesoSubito(p: ProfiloPerDigiuno): Sospensione | null {
  const motivi: ChiaveEsclusione[] = [];
  for (const { chiave } of DOMANDE_DI_ESCLUSIONE) if (p.risposte?.[chiave] === true) motivi.push(chiave);
  if (!motivi.length) return null;
  return {
    motivi,
    frase:
      `Digiuno sospeso: ${motivi.map((m) => ETICHETTA[m]).join(', ')}. `
      + 'La cliente torna alla giornata piena da stanotte; la decisione di rimetterla a digiuno è della nutrizionista.',
  };
}

const ETICHETTA: Record<string, string> = {
  dca: 'disturbi del comportamento alimentare dichiarati',
  gravidanza: 'gravidanza o allattamento',
  ipoglicemizzanti: 'terapia ipoglicemizzante o diabete di tipo 1',
  sottopeso: `BMI sotto ${BMI_MINIMO}`,
};
