/**
 * SPOSTARE LA DATA DI INIZIO PARLANDO CON GAIA — logica pura.
 *
 * Richiesta di Simone del 10/8: nella dashboard di chi ha un piano che comincia più avanti c'è
 * scritto «se vuoi cambiare la data di inizio, chiedi a Gaia», e Gaia deve saperlo fare in modo
 * discorsivo. Fino a oggi la data si poteva cambiare **solo** dal backoffice, col permesso
 * «Cambia data inizio piano»: la cliente che aveva sbagliato il calendario non aveva nessuna strada.
 *
 * ## Il confine: fino a 24 ore prima dell'inizio
 *
 * Deciso con Simone il 10/8 come «solo prima che il piano parta» e stretto l'11/8 a **24 ore prima**
 * (`plan_start_change_lock_hours`), lo stesso limite del pulsante nel profilo dell'app.
 *
 * Il perché: prima dello sblocco spostare la data non butta via niente — nessun menu consegnato,
 * nessuna spesa fatta. Dopo, la cliente ha davanti i menu dei prossimi giorni e magari ha già
 * comprato. Dentro le 48 ore, e a piano avviato, Gaia non tocca niente e passa la mano alla coach,
 * che dalla scheda può ancora forzarla: la frase lo dice, altrimenti «non si può» suona come una
 * porta chiusa quando invece una strada c'è.
 *
 * Il numero **non è scritto qui**: è lo stesso parametro che decide lo sblocco. Due copie
 * divergerebbero, e il giorno in cui qualcuno cambia la finestra il limite resterebbe indietro senza
 * che si veda.
 *
 * ## Perché il riconoscimento delle date sta qui, in una funzione pura
 *
 * Perché è la parte che si sbaglia. «Lunedì» detto di lunedì è oggi o fra sette giorni? «Il 3»
 * quando siamo al 20 è il 3 del mese prossimo. «Fra una settimana» è +7. Ogni ambiguità decisa male
 * sposta il piano di una cliente di giorni, e siccome nessuno rilegge la conferma parola per parola
 * il modo di accorgersene è che il menu arriva quando non lo aspetta. Qui è tutto verificabile con
 * `oggi` iniettato, senza database e senza aspettare lunedì.
 */

/** Giorni massimi nel futuro. Lo stesso limite di `finalizeApproval`, che ignora date più lontane. */
export const MAX_GIORNI_AVANTI = 60;

export type PassoDataInizio = 'data' | 'conferma';

export interface StatoDataInizio {
  passo: PassoDataInizio;
  /** La data proposta, `YYYY-MM-DD`. Presente al passo `conferma`. */
  data?: string;
  /** Risposte non capite di fila: a 2 il flusso passa alla coach invece di insistere. */
  tentativi?: number;
}

const normalizza = (t: string): string =>
  (t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/**
 * Intenzione di spostare l'inizio. NARROW come per le sostituzioni: pretende che si parli di
 * **iniziare** o di una **data**, insieme a un verbo di cambio o a una domanda. Un riconoscimento
 * generoso qui dirotterebbe in un dialogo a domande chiuse conversazioni che parlano d'altro
 * («quando inizio a vedere i risultati?»), che è un danno peggiore del non aver capito.
 */
const INTENTO: RegExp[] = [
  /(cambiar|spostar|modificar|anticipar|posticipar|rimandar|sposto|cambio|anticipo|posticipo)[a-z]* .{0,20}(data|inizio|partenza|partire|inizia)/,
  /(data|giorno) (di )?(inizio|partenza)/,
  // «volevo», e non solo «voglio»: nel parlato è la forma più comune per chiedere una cosa senza
  // pretenderla («volevo iniziare lunedì invece»), e senza di lei quella frase non veniva capita.
  /(voglio|vorrei|volevo|preferirei|preferisco|posso|potrei|si pu[oò]|come faccio a?) .{0,20}(iniziare|partire|cominciare) .{0,20}(prima|dopo|il|luned|marted|mercoled|gioved|venerd|sabato|domenica|settimana|mese)/,
  /(iniziare|partire|cominciare) (piu )?(tardi|prima|avanti)/,
  /non (voglio|riesco a) (iniziare|partire|cominciare) (il|lunedi|questa|la prossima)/,
];

export function rilevaIntentoDataInizio(testo: string): boolean {
  const t = normalizza(testo);
  return INTENTO.some((p) => p.test(t));
}

// ---------- Lettura della data ----------

const GIORNI_SETTIMANA: Record<string, number> = {
  domenica: 0,
  lunedi: 1,
  martedi: 2,
  mercoledi: 3,
  giovedi: 4,
  venerdi: 5,
  sabato: 6,
};

const MESI: Record<string, number> = {
  gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5,
  luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11,
};

const NUMERI_A_PAROLE: Record<string, number> = {
  un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7,
  otto: 8, nove: 9, dieci: 10, quindici: 15, venti: 20, trenta: 30,
};

/** `YYYY-MM-DD` da un Date, letto in UTC (le date qui sono giorni, non istanti). */
const iso = (d: Date): string => d.toISOString().slice(0, 10);

/** Mezzanotte UTC del giorno di un Date. */
const giorno = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const piuGiorni = (d: Date, n: number): Date => new Date(d.getTime() + n * 86_400_000);

/**
 * La data che la cliente ha detto, o `null` se non se ne riconosce una.
 *
 * `oggi` è il giorno di riferimento (mezzanotte UTC): iniettato, così i test non dipendono da che
 * giorno è quando girano — ed è l'unico modo di verificare «lunedì» senza aspettare lunedì.
 *
 * Ordine dei tentativi, dal più esplicito al più vago: è quello che evita le sorprese. «15/9» è una
 * data e basta; «lunedì 15» ha un numero, e il numero vince sul nome del giorno perché è più
 * preciso; «lunedì» da solo è la prossima occorrenza.
 */
export function leggiData(testo: string, oggi: Date): string | null {
  const t = normalizza(testo);
  const base = giorno(oggi);

  // 1. ISO esplicito: 2026-09-15
  const isoDetto = t.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (isoDetto) {
    return valida(new Date(Date.UTC(+isoDetto[1], +isoDetto[2] - 1, +isoDetto[3])));
  }

  // 2. Numerico italiano: 15/9, 15-09, 15/09/2026. Il giorno viene PRIMA del mese: qui si scrive
  //    così, e leggerlo all'americana sposterebbe il piano di mesi senza che nessuno se ne accorga.
  const numerico = t.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
  if (numerico) {
    const g = +numerico[1];
    const m = +numerico[2] - 1;
    const annoDetto = numerico[3] ? (numerico[3].length === 2 ? 2000 + +numerico[3] : +numerico[3]) : null;
    const anno = annoDetto ?? annoPerMese(base, m, g);
    return valida(new Date(Date.UTC(anno, m, g)), g);
  }

  // 3. «15 settembre», «il primo settembre», «settembre 15»
  const conMese = t.match(/\b(\d{1,2}|primo)\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/);
  if (conMese) {
    const g = conMese[1] === 'primo' ? 1 : +conMese[1];
    const m = MESI[conMese[2]];
    return valida(new Date(Date.UTC(annoPerMese(base, m, g), m, g)), g);
  }

  // 4. «oggi», «domani», «dopodomani», «subito»
  if (/\b(dopodomani)\b/.test(t)) return valida(piuGiorni(base, 2));
  if (/\bdomani\b/.test(t)) return valida(piuGiorni(base, 1));
  if (/\b(oggi|subito|adesso)\b/.test(t)) return valida(base);

  // 5. «fra una settimana», «tra 3 giorni», «fra un mese», «dopo le vacanze» no (troppo vago)
  const fra = t.match(/\b(?:fra|tra|dopo)\s+(\d{1,2}|un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|quindici|venti|trenta)\s*(giorn[oi]|settiman[ae]|mes[ei])\b/);
  if (fra) {
    const n = /^\d+$/.test(fra[1]) ? +fra[1] : (NUMERI_A_PAROLE[fra[1]] ?? 0);
    if (n > 0) {
      if (fra[2].startsWith('giorn')) return valida(piuGiorni(base, n));
      if (fra[2].startsWith('settiman')) return valida(piuGiorni(base, n * 7));
      // Il mese si conta come mese di calendario, non 30 giorni: «fra un mese» il 31 gennaio è
      // il 28 febbraio, non il 2 marzo.
      const d = new Date(base);
      d.setUTCMonth(d.getUTCMonth() + n);
      return valida(d);
    }
  }

  // 6. «lunedì», «lunedì prossimo», «il prossimo lunedì», «lunedì 15» (col numero → caso 2/3)
  const nomeGiorno = Object.keys(GIORNI_SETTIMANA).find((g) => new RegExp(`\\b${g}\\b`).test(t));
  if (nomeGiorno) {
    const voluto = GIORNI_SETTIMANA[nomeGiorno];
    let delta = (voluto - base.getUTCDay() + 7) % 7;
    // «lunedì» detto di lunedì è il lunedì PROSSIMO, non oggi: chi dice il nome di un giorno
    // intende un giorno che deve ancora venire. E «prossimo» aggiunge una settimana solo se il
    // giorno di questa settimana è già passato o è oggi.
    if (delta === 0) delta = 7;
    if (/prossim/.test(t) && delta < 7 && /settimana prossima|prossima settimana/.test(t)) delta += 7;
    return valida(piuGiorni(base, delta));
  }

  // 7. «il 15» senza mese: il 15 di questo mese se non è passato, altrimenti del mese DOPO.
  //    Il mese, non l'anno: «il 3» detto il 12 agosto è il 3 settembre. Facendo scorrere l'anno
  //    (come per «3 gennaio» detto a dicembre, dove il mese lo dice lei) si otteneva il 3 agosto
  //    dell'anno prossimo — una data plausibile, accettata dai controlli, sbagliata di undici mesi.
  const soloGiorno = t.match(/\b(?:il|dal|dal giorno|giorno)\s+(\d{1,2})\b/);
  if (soloGiorno) {
    const g = +soloGiorno[1];
    if (g >= 1 && g <= 31) {
      let m = base.getUTCMonth();
      let anno = base.getUTCFullYear();
      if (new Date(Date.UTC(anno, m, g)).getTime() < base.getTime()) {
        m += 1;
        if (m > 11) {
          m = 0;
          anno += 1;
        }
      }
      return valida(new Date(Date.UTC(anno, m, g)), g);
    }
  }

  return null;

  /**
   * `YYYY-MM-DD`, o `null` se la data non esiste.
   *
   * `giornoAtteso` serve perché `Date.UTC` non rifiuta il 31 febbraio: lo fa **scivolare** al 3
   * marzo. Una data inventata che nessuno ha detto, e che passerebbe tutti i controlli a valle.
   */
  function valida(d: Date, giornoAtteso?: number): string | null {
    if (Number.isNaN(d.getTime())) return null;
    if (giornoAtteso !== undefined && d.getUTCDate() !== giornoAtteso) return null;
    return iso(d);
  }

  /**
   * L'anno da usare quando la cliente dice solo giorno e mese: quello in cui la data **non è
   * passata**. Detto il 20 dicembre, «il 3 gennaio» è dell'anno prossimo — senza questa regola
   * sarebbe una data di dieci mesi fa e il flusso la rifiuterebbe come «passata».
   */
  function annoPerMese(riferimento: Date, mese: number, giornoDelMese: number): number {
    const stessoAnno = new Date(Date.UTC(riferimento.getUTCFullYear(), mese, giornoDelMese));
    return stessoAnno.getTime() < riferimento.getTime()
      ? riferimento.getUTCFullYear() + 1
      : riferimento.getUTCFullYear();
  }
}

/** Perché una data non va bene. `null` = va bene. */
export type MotivoRifiuto = 'passata' | 'troppo_lontana';

export function verificaData(dataIso: string, oggi: Date): MotivoRifiuto | null {
  const d = new Date(`${dataIso}T00:00:00.000Z`);
  const base = giorno(oggi);
  if (d.getTime() < base.getTime()) return 'passata';
  if (d.getTime() - base.getTime() > MAX_GIORNI_AVANTI * 86_400_000) return 'troppo_lontana';
  return null;
}

// ---------- Testi ----------

const GIORNI_LUNGHI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI_LUNGHI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/** «lunedì 15 settembre»: la data come la dice una persona, non `2026-09-15`. */
export function dataAParole(dataIso: string): string {
  const d = new Date(`${dataIso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return dataIso;
  return `${GIORNI_LUNGHI[d.getUTCDay()]} ${d.getUTCDate()} ${MESI_LUNGHI[d.getUTCMonth()]}`;
}

const conNome = (nome?: string | null): string => {
  const n = (nome ?? '').trim().split(' ')[0];
  return n && n.length > 1 && !/\d/.test(n) ? ` ${n}` : '';
};

export function testoChiediData(inizioAttuale: string | null, nome?: string | null): string {
  const attuale = inizioAttuale ? ` Adesso è ${dataAParole(inizioAttuale)}.` : '';
  return (
    `Certo${conNome(nome)}, la data di inizio la possiamo spostare.${attuale}\n\n` +
    'Da quando vuoi partire? Scrivimela come ti viene — «lunedì», «il 15», «fra una settimana».'
  );
}

export function testoConferma(data: string, sblocco: string, nome?: string | null): string {
  return (
    `Allora${conNome(nome)}: il piano parte ${dataAParole(data)} e il menu si sblocca ` +
    `${dataAParole(sblocco)}, due giorni prima, così hai tempo per la spesa.\n\n` +
    'Confermi? (sì / no)'
  );
}

export function testoFatto(data: string, sblocco: string, nome?: string | null): string {
  return (
    `Fatto${conNome(nome)}: si parte ${dataAParole(data)}. Il menu lo trovi ${dataAParole(sblocco)}. ` +
    'Se cambi ancora idea sono qui — finché il piano non è partito si può spostare. 💚'
  );
}

export function testoAnnullato(nome?: string | null): string {
  return `Va bene${conNome(nome)}, non cambio niente: la data resta quella di prima. 💚`;
}

export function testoDataNonCapita(ultimoTentativo: boolean): string {
  if (ultimoTentativo) {
    return 'Non riesco a capire la data, e non voglio metterne una a caso: ne parli con la tua coach, le ho girato la richiesta. 💚';
  }
  return 'Non ho capito la data. Prova così: «lunedì», «il 15», «15 settembre», oppure «fra una settimana».';
}

export function testoDataPassata(nome?: string | null): string {
  return (
    `Quel giorno è già passato${conNome(nome) ? ',' + conNome(nome) : ''}: la data di inizio deve essere da oggi in avanti. ` +
    'Dimmene un\'altra e la sistemo.'
  );
}

export function testoTroppoLontana(): string {
  return (
    `Quella data è troppo in là: si può spostare l'inizio fino a ${MAX_GIORNI_AVANTI} giorni da oggi. ` +
    'Se ti serve più tempo dillo alla tua coach, che può mettere il piano in pausa.'
  );
}

/**
 * Il piano è già partito. Non si tocca niente e si passa alla coach: qui la domanda non è più «che
 * giorno metto», è «cosa è andato storto» — e i menu già consegnati sono lavoro fatto.
 */
export function testoPianoGiaPartito(inizio: string | null, nome?: string | null): string {
  const quando = inizio ? ` (è partito ${dataAParole(inizio)})` : '';
  return (
    `Il tuo piano è già cominciato${quando}, quindi la data di inizio non la posso più spostare io${conNome(nome)}: ` +
    'i menu di questi giorni sono già stati preparati per te. Ne ho parlato alla tua coach — se ti serve ' +
    'una pausa o un cambio di ritmo, lo sistema lei. 💚'
  );
}

/**
 * IL MENU È GIÀ PRONTO. Il piano non è ancora partito, ma siamo dentro la finestra di sblocco: la
 * cliente ha già davanti i menu dei prossimi giorni e magari ha già fatto la spesa.
 *
 * Confine stretto l'11/8, quando lo stesso limite è comparso sul pulsante nel profilo dell'app: due
 * regole diverse per la stessa azione — Gaia più permissiva dell'app — è come si ottiene «Gaia me la
 * sposta e dall'app non si può». La coach può ancora forzarla dalla scheda, e la frase lo dice:
 * altrimenti «non si può» suona come una porta chiusa quando invece una strada c'è.
 */
export function testoTroppoTardi(inizio: string | null, oreMancanti: number, nome?: string | null): string {
  const quando = inizio ? ` ${dataAParole(inizio)}` : '';
  const fra =
    oreMancanti <= 0
      ? 'è questione di ore'
      : oreMancanti === 1
        ? "manca un'ora"
        : `mancano ${oreMancanti} ore`;
  return (
    `Ci siamo quasi${conNome(nome)}: il tuo piano parte${quando} e ${fra}. Così a ridosso non riesco ` +
    'più a spostare la data io — i menu dei primi giorni sono già pronti e magari hai già fatto la spesa.\n\n' +
    'Se ti serve davvero, ne ho parlato alla tua coach: lei può farlo. 💚'
  );
}

/** Nessun piano attivo: non c'è niente da spostare. */
export function testoNessunPiano(): string {
  return (
    'Non vedo un piano da spostare: al momento non hai un abbonamento attivo. ' +
    'Se ne hai appena comprato uno e non lo vedi, scrivilo alla tua coach. 💚'
  );
}
