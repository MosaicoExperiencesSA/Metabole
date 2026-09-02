/**
 * CAMBIARE IL PIATTO, non l'ingrediente.
 *
 * ## Da dove nasce
 *
 * Conversazione vera dell'8/8, girata da Simone. La cliente chiede di cambiare il burro di
 * macadamia della colazione; Gaia propone «40 g di olio evo al posto di 40 g di burro di
 * macadamia»; la cliente risponde:
 *
 *   > «no, voglio una colazione proteica»
 *   > «lo voglio diverso»
 *
 * e Gaia va in palla: «Puoi dirmi di più? Stai cercando di cambiare qualcosa nel tuo menu, nelle
 * abitudini, o nell'approccio al dimagrimento?». Una risposta da modulo, davanti a una richiesta
 * perfettamente chiara.
 *
 * Il motivo è che il dialogo sapeva fare **una** cosa: scambiare un ingrediente con uno equivalente
 * dalla mappa sicura. «Voglio una colazione proteica» non è quello: è **un altro piatto**. Mancava
 * il codice, non l'intelligenza.
 *
 * (Nota, perché è la stessa radice: la proposta «40 g di olio evo» è corretta a pari grammatura e
 * sbagliata come colazione. La regola «stessi grammi» conserva le calorie e non sa cosa sia un
 * pasto. Cambiare il piatto invece ragiona sul piatto.)
 *
 * ## La regola, in una riga
 *
 * Fra le ricette **autorizzate per quella cliente** (la sua base personale certificata: allergeni
 * revisionati, regime compatibile, esclusioni applicate) si cerca, per quello slot, un piatto con
 * **calorie simili** e — se ha chiesto proteine — **più proteine** di quello che ha. Non si inventa
 * niente e non si esce dal catalogo che il nutrizionista ha approvato: è la differenza fra
 * proporre un'alternativa e improvvisare una dieta.
 *
 * Nessuna dipendenza da Nest né da Prisma: qui vivono solo le decisioni.
 */

// `etichettaSlot` viene da `sostituzione-chat`: le etichette dei pasti sono UNA tabella sola.
// Duplicarle qui vorrebbe dire che un giorno l'elenco delle alternative e la domanda su quale pasto
// chiamerebbero lo stesso pasto con due nomi diversi, nella stessa conversazione.
import { condividonoAlimento } from '../common/nomi-alimento';
import { etichettaSlot } from './sostituzione-chat';

/** Che tipo di alternativa ha chiesto. `null` = «diverso» e basta. */
import { TAG_DOLCE, TAG_SALATO } from '../vera/colazioni';

export type PreferenzaPiatto = 'proteico' | 'leggero' | 'veloce' | null;

/**
 * «DOLCE O SALATA?» — il gusto della colazione (richiesta di Simone, 14/8).
 * `indifferente` è una risposta piena: vuol dire «cerca senza filtro», non «non ho capito».
 */
export type GustoColazione = 'dolce' | 'salato';

export interface CandidatoPiatto {
  recipeId: string;
  nome: string;
  kcal: number;
  /** Proteine in grammi, se la ricetta le dichiara (`Recipe.macros.protein_g`). */
  proteineG?: number | null;
  /** `Recipe.difficulty`: semplice | media | elaborata. Serve alla preferenza «veloce». */
  difficolta?: string | null;
  /** `Recipe.tags`: servono al gusto della colazione (`piatto:dolce`/`piatto:salato`). */
  tags?: string[];
  /**
   * ⛔ **LE SOSTITUZIONI DI INGREDIENTE CHE QUESTO PIATTO PORTA CON SÉ** — 2/9, voce 953.
   *
   * `valutaRicetta` non risponde solo «sì o no»: su un piatto che si può servire **cambiando un
   * ingrediente** — l'aceto balsamico per chi non tollera i solfiti, il latte per chi è
   * delattosata — rende le righe che dicono alla cliente cosa mettere al posto di cosa.
   *
   * ⚠️ Il cambio di piatto in chat non le calcolava affatto: scriveva il pasto con `substitutions`
   * vuoto. Il piatto arrivava senza la riga, e la cliente non sapeva che l'aceto andava sostituito.
   * Da qui viaggiano col candidato fino alla scrittura.
   */
  sostituzioni?: unknown[];
}

export interface AlternativaProposta extends CandidatoPiatto {
  /** Scostamento dalle kcal del piatto attuale, in percentuale (può essere negativo). */
  scartoKcalPct: number;
  /** Differenza di proteine rispetto al piatto attuale, in grammi (se note per entrambi). */
  deltaProteineG: number | null;
}

const normalizza = (testo: string): string =>
  (testo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * «Voglio un altro piatto». Deliberatamente generoso: se la cliente sta chiedendo qualcosa di
 * diverso e noi non lo riconosciamo, la risposta è quella da modulo che ha fatto arrabbiare Simone.
 * Il costo di un falso positivo è basso — Gaia propone due alternative e la cliente dice no.
 */
const PASTI = '(piatto|piatti|colazione|pranzo|cena|spuntino|merenda)';

/**
 * ⚠️ Generoso ma non ingenuo. La prima versione accettava l'aggettivo da solo — «altro», «nuovo»,
 * «diverso» — e «quando arriva il menu nuovo?» diventava una richiesta di cambiare piatto. Un test
 * l'ha preso subito. Ora l'aggettivo vale solo **accanto a un pasto** o dentro una frase di
 * volontà («voglio…», «qualcosa di…»); le proteine invece bastano da sole, perché «proteica» in
 * una chat sul menu non significa nient'altro.
 */
const INTENTO_ALTRO_PIATTO: RegExp[] = [
  // «un altro piatto», «una colazione diversa» (nei due ordini)
  new RegExp(`\\b(altro|altra|nuovo|nuova|diverso|diversa|diversi|diverse)\\s+${PASTI}\\b`),
  new RegExp(`\\b${PASTI}\\s+(altro|altra|nuovo|nuova|diverso|diversa|diversi|diverse)\\b`),
  // «voglio/vorrei/dammi qualcosa di diverso», «preferirei cambiare»
  /\b(voglio|vorrei|preferirei|dammi|proponimi|fammi|mettimi|cambiamo)\b[^.]{0,30}\b(altro|altra|diverso|diversa|cambiare)\b/,
  /\blo voglio diverso\b/, /\bla voglio diversa\b/,
  new RegExp(`\\bcambia(re)?\\s*(il|la|lo)?\\s*${PASTI}\\b`),
  /\bqualcos(a|altro) di (diverso|altro|leggero|leggera|proteico|proteica)\b/,
  // Le proteine bastano da sole: in una chat sul menu non vogliono dire altro.
  /\b(piu|più)\s*(proteic|protein)/,
  /\bproteic(a|o|he|hi)\b/,
  /\bnon (mi va|ne ho voglia|mi convince)\b/,
];

export function rilevaIntentoAltroPiatto(testo: string): boolean {
  const t = normalizza(testo);
  if (!t) return false;
  return INTENTO_ALTRO_PIATTO.some((r) => r.test(t));
}

/**
 * Che cosa vuole, se lo ha detto. Le proteine hanno la precedenza su «leggero»: chi scrive
 * «una colazione proteica più leggera» sta chiedendo prima di tutto proteine.
 */
export function preferenzaDaTesto(testo: string): PreferenzaPiatto {
  const t = normalizza(testo);
  if (/proteic|protein/.test(t)) return 'proteico';
  if (/\bveloce\b|\bsvelt|\bnon ho tempo\b|\brapid/.test(t)) return 'veloce';
  if (/\bleggero\b|\bleggera\b|\bsgonfi|\bdigerib/.test(t)) return 'leggero';
  return null;
}

/** Le proteine dichiarate, o null: una ricetta senza macro non si può ordinare per proteine. */
const proteine = (c: CandidatoPiatto): number | null =>
  typeof c.proteineG === 'number' && Number.isFinite(c.proteineG) ? c.proteineG : null;

/**
 * Ordina e filtra le alternative per uno slot.
 *
 * Le regole, in ordine di importanza:
 *
 *  1. **Le calorie non si toccano.** Fuori dalla tolleranza il piatto è scartato, non penalizzato:
 *     una colazione da 340 kcal non si sostituisce con una da 700 perché «è più proteica». È il
 *     vincolo che rende la proposta accettabile senza il nutrizionista.
 *  2. **Il piatto attuale non è un'alternativa a sé stesso**, e nemmeno i piatti che la cliente ha
 *     già oggi negli altri slot: proporle a colazione quello che ha a pranzo non è una scelta.
 *  3. Poi la preferenza: `proteico` ordina per proteine (e **pretende** che ce ne siano più di
 *     adesso, altrimenti non è un'alternativa proteica); `veloce` preferisce le ricette semplici;
 *     `leggero` preferisce le kcal più basse dentro la tolleranza.
 *  4. A parità, vince chi resta più vicino alle calorie di partenza: è la scelta più prudente.
 */
export function ordinaAlternative(
  candidati: CandidatoPiatto[],
  opzioni: {
    kcalAttuali: number;
    proteineAttualiG?: number | null;
    preferenza: PreferenzaPiatto;
    /** Ricette da non proporre: quella attuale e gli altri piatti di oggi. */
    escludiRecipeIds?: string[];
    /** Tolleranza sulle kcal, in percentuale. Default 15, come `menu_kcal_balance_tolerance_pct`. */
    tolleranzaKcalPct?: number;
    /** Quante proporne. Due: una è un ordine, tre sono un catalogo. */
    quante?: number;
    /**
     * Il nome del piatto che sta rifiutando. Le alternative che gli somigliano nel nome vanno in
     * FONDO, non fuori.
     *
     * «Ovviamente con altri ingredienti» (Simone, 12/8): proporre «Insalata Tiepida Tacchino e
     * Farro» a chi non vuole «Insalata Tiepida Tacchino e Quinoa» è cambiare una parola, non il
     * piatto. In fondo e non escluse perché con un ricettario piccolo potrebbero essere le uniche,
     * e qualcosa di simile è pur sempre meglio di «non ho niente da proporti».
     */
    nomeAttuale?: string;
  },
): AlternativaProposta[] {
  const tolleranza = opzioni.tolleranzaKcalPct ?? 15;
  const quante = opzioni.quante ?? 2;
  const esclusi = new Set(opzioni.escludiRecipeIds ?? []);
  const proteineAttuali =
    typeof opzioni.proteineAttualiG === 'number' && Number.isFinite(opzioni.proteineAttualiG)
      ? opzioni.proteineAttualiG
      : null;
  // kcal a zero o assurde: senza un riferimento la tolleranza non vuol dire niente, meglio non
  // proporre nulla che proporre a caso.
  if (!Number.isFinite(opzioni.kcalAttuali) || opzioni.kcalAttuali <= 0) return [];

  const ammessi = candidati
    .filter((c) => !esclusi.has(c.recipeId))
    .filter((c) => Number.isFinite(c.kcal) && c.kcal > 0)
    .map((c) => ({
      ...c,
      scartoKcalPct: Math.round(((c.kcal - opzioni.kcalAttuali) / opzioni.kcalAttuali) * 100),
      deltaProteineG:
        proteine(c) !== null && proteineAttuali !== null
          ? Math.round((proteine(c) as number) - proteineAttuali)
          : null,
    }))
    .filter((c) => Math.abs(c.scartoKcalPct) <= tolleranza);

  const proteici = ammessi.filter((c) => {
    if (opzioni.preferenza !== 'proteico') return true;
    const p = proteine(c);
    if (p === null) return false; // senza macro non posso promettere «più proteica»
    if (proteineAttuali === null) return true; // non so quelle di adesso: propongo le più proteiche
    return p > proteineAttuali;
  });

  const vicinanzaKcal = (c: AlternativaProposta) => Math.abs(c.scartoKcalPct);
  // Somiglia nel nome a quello rifiutato? `condividonoAlimento` confronta per parola con la
  // radice, quindi «Quinoa» e «Farro» restano due piatti diversi mentre «Insalata Tiepida
  // Tacchino» li accomuna — che è esattamente la somiglianza che si vuole penalizzare.
  const somiglia = (c: AlternativaProposta) =>
    opzioni.nomeAttuale && condividonoAlimento(opzioni.nomeAttuale, c.nome) ? 1 : 0;
  const ordinati = [...proteici].sort((a, b) => {
    const sa = somiglia(a);
    const sb = somiglia(b);
    if (sa !== sb) return sa - sb;
    if (opzioni.preferenza === 'proteico') {
      const pa = proteine(a) ?? -1;
      const pb = proteine(b) ?? -1;
      if (pb !== pa) return pb - pa;
    }
    if (opzioni.preferenza === 'veloce') {
      const semplice = (c: AlternativaProposta) => (c.difficolta === 'semplice' ? 0 : c.difficolta === 'media' ? 1 : 2);
      const sa = semplice(a);
      const sb = semplice(b);
      if (sa !== sb) return sa - sb;
    }
    if (opzioni.preferenza === 'leggero' && a.kcal !== b.kcal) return a.kcal - b.kcal;
    return vicinanzaKcal(a) - vicinanzaKcal(b);
  });

  return ordinati.slice(0, quante);
}

// ---------- Testi ----------

const kcalTxt = (n: number) => `${Math.round(n)} kcal`;

const maiuscolaIniziale = (t: string): string => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/**
 * La proposta. Dice **perché** quel piatto è la risposta alla sua richiesta (le proteine in più) e
 * mostra le calorie: è la stessa informazione che guarderebbe il nutrizionista, e vederla scritta
 * è ciò che rende la proposta credibile invece che magica.
 */
export function testoProponiAlternative(
  slotEtichetta: string,
  attuale: { nome: string; kcal: number },
  alternative: AlternativaProposta[],
  preferenza: PreferenzaPiatto,
  nome?: string | null,
  quando = 'oggi',
): string {
  const perche =
    preferenza === 'proteico'
      ? 'con più proteine e le stesse calorie'
      : preferenza === 'leggero'
        ? 'più leggero, restando nelle calorie del piano'
        : preferenza === 'veloce'
          ? 'più veloce da preparare, con le stesse calorie'
          : 'con le stesse calorie';
  const righe = alternative
    .map((a, i) => {
      const prot =
        a.deltaProteineG !== null && a.deltaProteineG > 0
          ? ` · +${a.deltaProteineG} g di proteine`
          : a.proteineG != null
            ? ` · ${Math.round(a.proteineG)} g di proteine`
            : '';
      return `${i + 1}) ${a.nome} — ${kcalTxt(a.kcal)}${prot}`;
    })
    .join('\n');
  const apertura = nome ? `${nome}, ho` : 'Ho';
  return (
    `${apertura} cercato ${preferenza === 'proteico' ? 'una proteica' : "un'alternativa"} fra i piatti approvati per te ` +
    `${perche}.\n\n${quando === 'oggi' ? 'Adesso' : maiuscolaIniziale(quando)} a ${slotEtichetta.toLowerCase()} hai ${attuale.nome} (${kcalTxt(attuale.kcal)}). ` +
    `Al suo posto posso metterti:\n\n${righe}\n\n` +
    'Rispondi col numero, oppure «no» se nessuna ti va.'
  );
}

/**
 * Niente da proporre. Non è un fallimento da nascondere: se il catalogo approvato per lei non ha
 * un'alternativa dentro le calorie, la decisione è del nutrizionista — e dirlo è più utile che
 * proporre qualcosa fuori piano.
 */
export function testoNessunaAlternativa(
  slotEtichetta: string,
  preferenza: PreferenzaPiatto,
  nome?: string | null,
  gusto?: GustoColazione | null,
): string {
  const cosa = gusto ? (gusto === 'dolce' ? 'dolce' : 'salata') : preferenza === 'proteico' ? 'più proteica' : 'diversa';
  const apertura = nome ? `${nome}, tra` : 'Tra';
  return (
    `${apertura} i piatti approvati per te non trovo un'alternativa ${cosa} per ${slotEtichetta.toLowerCase()} ` +
    'che resti nelle tue calorie, e fuori da quelli non voglio andare da sola. ' +
    'Ho girato la richiesta alla tua nutrizionista: decide lei. 🩺'
  );
}

export function testoCambioPiattoFatto(
  slotEtichetta: string,
  scelta: { nome: string; kcal: number },
  nome?: string | null,
  quando = 'oggi',
): string {
  const apertura = nome ? `Fatto ${nome}` : 'Fatto';
  return (
    `${apertura}: a ${slotEtichetta.toLowerCase()} ${quando === 'oggi' ? 'adesso' : `di ${quando}`} trovi ` +
    `**${scelta.nome}** (${kcalTxt(scelta.kcal)}), solo per ${quando}. ` +
    'La tua nutrizionista lo vede in scheda e lo ricontrolla. 💚'
  );
}

/** La cliente ha risposto con un numero che non c'è. */
export function testoSceltaNonValida(quante: number): string {
  return `Non ho capito quale: rispondi con un numero da 1 a ${quante}, oppure «no».`;
}

/**
 * QUALE PASTO — quando la cliente dice «lo voglio diverso» senza dire di cosa.
 *
 * Prima, se il testo non nominava né un piatto né un pasto, il flusso ripiegava sulla domanda
 * dell'**ingrediente** («quale alimento vuoi cambiare?»): una domanda diversa da quella che stava
 * per fare, in risposta a una richiesta che aveva capito benissimo. L'alternativa è chiedere, e
 * chiedere costa un messaggio; scegliere per lei costa il pasto sbagliato — e quello si vede solo
 * quando è già nel piatto.
 */
export function testoChiediQualePasto(
  pasti: { slot: string; piatto: string }[],
  preferenza: PreferenzaPiatto,
  nome?: string | null,
  quando = 'oggi',
): string {
  const cosa =
    preferenza === 'proteico'
      ? 'qualcosa di più proteico'
      : preferenza === 'leggero'
        ? 'qualcosa di più leggero'
        : preferenza === 'veloce'
          ? 'qualcosa di più veloce'
          : 'un piatto diverso';
  const righe = pasti.map((p, i) => `${i + 1}) ${etichettaSlot(p.slot)} — ${p.piatto}`).join('\n');
  const apertura = nome ? `${nome}, volentieri` : 'Volentieri';
  return (
    `${apertura}: ${cosa} si può fare. Per quale pasto di ${quando}?\n\n${righe}\n\n` +
    'Rispondi col numero o col nome del pasto.'
  );
}

/**
 * Lo slot scelto dalla cliente: il numero della riga, o il nome del pasto scritto a parole.
 *
 * Si accettano entrambi perché entrambi arrivano: chi legge un elenco numerato risponde «2», chi
 * legge «pranzo — Insalata di farro» risponde «il pranzo». Rifiutare la seconda forma sarebbe far
 * ripetere una risposta già data.
 */
export function slotDaRisposta(testo: string, pasti: { slot: string; piatto: string }[]): string | null {
  const t = (testo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
  const numero = t.match(/^\(?([1-9])\)?[.)]?$/);
  if (numero) return pasti[Number(numero[1]) - 1]?.slot ?? null;
  // Il nome del pasto. Le etichette sono quelle che la cliente ha appena letto, quindi si cercano
  // quelle; «merenda» e «spuntino» valgono l'uno per l'altro perché in Italia si dicono entrambi.
  for (const p of pasti) {
    const etichetta = etichettaSlot(p.slot);
    if (t.includes(etichetta)) return p.slot;
    if (/snack/.test(p.slot) && /\b(spuntino|merenda)\b/.test(t)) return p.slot;
  }
  // In ultima istanza il nome del piatto: se lo nomina, sa quale vuole cambiare.
  for (const p of pasti) {
    const prima = p.piatto.toLowerCase().split(' ')[0];
    if (prima.length >= 4 && t.includes(prima)) return p.slot;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * La risposta a «dolce o salata?». `null` = non capita (si ripete la domanda, una volta).
 *
 * ⚠️ «indifferente» non è un ripiego: «fa lo stesso» è una risposta piena e chiude la domanda —
 * si cerca senza filtro. Trattarla come non capita farebbe ripetere una domanda a cui la cliente
 * ha appena risposto.
 */
export function gustoDaTesto(testo: string): GustoColazione | 'indifferente' | null {
  const t = normalizza(testo);
  if (!t) return null;
  const dolce = /\bdolc(e|i)\b/.test(t);
  const salato = /\bsalat(a|o|e|i)\b/.test(t);
  if (dolce && salato) return null; // le ha dette tutte e due: non è una scelta
  if (dolce) return 'dolce';
  if (salato) return 'salato';
  if (/\b(fa lo stesso|lo stesso|uguale|indifferente|come viene|come vuoi|scegli tu|non importa|qualsiasi|una qualsiasi|vedi tu)\b/.test(t)) {
    return 'indifferente';
  }
  return null;
}

/**
 * Solo le colazioni col TAG giusto. ⚠️ Una colazione senza tag NON partecipa (Decisioni 13/8 §12):
 * il tag scritto È la conferma di una persona (Lucia, pagina Colazioni), e proporre come «salata»
 * una colazione che nessuno ha classificato è un'invenzione — la stessa ragione per cui l'azione
 * di Vera «a colazione qualcosa di salato» resta spenta finché le conferme non bastano.
 */
export function filtraPerGusto(candidati: CandidatoPiatto[], gusto: GustoColazione): CandidatoPiatto[] {
  const tag = gusto === 'dolce' ? TAG_DOLCE : TAG_SALATO;
  return candidati.filter((c) => (c.tags ?? []).includes(tag));
}

/** La domanda, con la via d'uscita dentro: chi non ha una preferenza non deve inventarne una. */
export function testoChiediGustoColazione(nome?: string | null): string {
  const apertura = nome ? `${nome}, volentieri` : 'Volentieri';
  return (
    `${apertura}! Per la colazione: **la vuoi dolce o salata?**\n` +
    'Cerco fra le colazioni approvate per te una con ingredienti diversi e lo stesso apporto. ' +
    '(Se per te è uguale, dimmi «fa lo stesso».)'
  );
}
