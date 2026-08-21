/**
 * SPOSTARE LA FINESTRA — i due metodi del manuale, e quale dei due si applica.
 *
 * Decisione di Simone del 19/8 (§1 del foglio decisioni), che correggeva la mia proposta: **non
 * esiste un tetto allo spostamento**. Esistono due strade, e quale si applica lo decide la
 * **direzione**, non la distanza.
 *
 * > **Il digiuno in corso non si accorcia mai di netto.** Allungarlo è sempre permesso; accorciarlo
 * > annulla i benefici della fase di digiuno di quel giorno.
 *
 * ## I due metodi
 *
 * **Metodo B — il «reset».** La finestra si sposta **più tardi**: stasera hai chiuso alle 20:00 e
 * invece di riaprire alle 12:00 tiri fino alle 16:00. Un digiuno più lungo una volta sola, e da lì
 * parte il nuovo orario. Permesso **subito**, perché allunga.
 *
 * **Metodo A — l'adattamento graduale, il consigliato.** La finestra si sposta **più presto**: il
 * digiuno si accorcerebbe. Si fa **un'ora al giorno** finché si arriva. ⚠️ E questo è il pezzo che
 * il sistema **ricorda ed esegue**, invece di scriverlo a schermo come consiglio: si salva il
 * bersaglio (`fastingTargetStartMin`) e un cron notturno avvicina l'inizio di un passo per volta.
 * La cliente conferma **il piano**, non i singoli passi.
 *
 * ## ⚠️ Perché la direzione si misura sul cerchio corto, e non «a che ora è più grande»
 *
 * Le 08:00 sono **prima** delle 12:00 di quattro ore, non **dopo** di venti. Su un orologio le due
 * letture sono entrambe vere e portano a due metodi opposti — reset o adattamento graduale — cioè
 * alla differenza fra allungare il digiuno di stanotte e accorciarlo. La differenza si normalizza
 * quindi nell'intervallo (−12 h, +12 h]: la strada più corta è quella che la cliente ha in mente
 * quando trascina l'orologio.
 *
 * ## ⛔ E perché lo spostamento in avanti non parte sempre da oggi
 *
 * «Permesso subito» vale finché **oggi la finestra non si è ancora aperta**. Se sono le 14:00, la
 * cliente ha già pranzato e chiede di aprire alle 16:00, applicarlo oggi vorrebbe dire dirle che
 * avrebbe dovuto digiunare fino a fra due ore: un pasto già fatto non si può disfare, e il sistema
 * si metterebbe a raccontare una giornata diversa da quella vera. In quel caso il nuovo orario vale
 * **da domani** — che è la stessa regola con cui il §12.1 fa partire i menu.
 */
import {
  PROTOCOLLI_DIGIUNO,
  chiusuraFinestra,
  pastiDellaFinestra,
  dentroLaGiornata,
  oraDelGiorno,
  protocolloDigiuno,
} from './orologio-digiuno';

const MINUTI_AL_GIORNO = 24 * 60;
const MEZZA_GIORNATA = MINUTI_AL_GIORNO / 2;

/**
 * Il passo dell'adattamento graduale, in minuti. Il manuale dice «1-2 ore al giorno» e qui si parte
 * dall'estremo prudente: un'ora. ⚠️ Sovrascrivibile da `config_param` come i tetti delle porzioni —
 * se la nutrizionista lo vuole diverso non serve un rilascio.
 */
export const PASSO_GRADUALE_PREDEFINITO = 60;

/**
 * Quanto spesso si può spostare la finestra: **una volta al giorno**.
 *
 * ⚠️ Non è una punizione ed è bene sapere perché c'è: due spostamenti nello stesso giorno si
 * annullano a vicenda nel conto del digiuno — il secondo parte da un inizio che il primo ha appena
 * cambiato — e il piano graduale diventerebbe un bersaglio che si riscrive prima di essere
 * raggiunto. Chi sbaglia un'ora la corregge domani; chi ha davvero cambiato turno usa il reset, che
 * arriva dove vuole in un colpo solo.
 */
export const ORE_FRA_DUE_CAMBI = 20;

export interface FinestraAttuale {
  protocollo: string;
  /** Minuti da mezzanotte. */
  inizioMin: number;
  /** L'ultimo spostamento, per il limite di uno al giorno. `null` = non ne ha mai fatti. */
  cambiataIl?: Date | null;
}

export interface RichiestaCambio {
  /** Il protocollo scelto. Se assente resta quello di adesso. */
  protocollo?: string | null;
  /** Il nuovo inizio, minuti da mezzanotte. Se assente resta quello di adesso. */
  inizioMin?: number | null;
}

export interface Momento {
  /** Adesso, per il limite di un cambio al giorno. */
  adesso: Date;
  /** Che ora è, minuti da mezzanotte, nel fuso della cliente. */
  oraMin: number;
}

export type MetodoCambio = 'reset' | 'graduale' | 'subito' | 'nessuno';

export interface EsitoCambio {
  /** Se il cambio si può fare. ⚠️ `false` qui è raro: la cliente non si blocca quasi mai. */
  permesso: boolean;
  /** Perché no, scritto per la cliente. Presente solo quando `permesso` è falso. */
  rifiuto?: string;
  metodo: MetodoCambio;
  /**
   * Cosa si scrive **adesso** nel profilo. ⚠️ Con il metodo graduale l'inizio **non si tocca**:
   * cambia solo il bersaglio, e ci pensa il cron notturno.
   */
  scrivi: {
    protocollo: string;
    inizioMin: number;
    /** Il bersaglio del piano graduale, o `null` per azzerarlo (piano finito o mai aperto). */
    bersaglioInizioMin: number | null;
  };
  /** Da quando vale quello che si scrive adesso: dalla prossima apertura, oggi o domani. */
  daQuando: 'oggi' | 'domani';
  /**
   * ⛔ **QUANTO DURA IL DIGIUNO CHE STA PER FARE**, in minuti — la verità, non un arrotondamento.
   *
   * ⚠️ È il numero su cui la revisione del 21/8 ha trovato **tre** risposte sbagliate, e vale la
   * pena dire com'è fatto: il digiuno che conta va **dall'ultima chiusura alla prossima apertura**.
   * L'ultima chiusura la decide la finestra **vecchia** (ieri sera era ancora in vigore quella), la
   * prossima apertura la decide quella **nuova**. Da qui tre conseguenze che prima sbagliavamo:
   *
   * 1. Spostare in avanti quando la finestra di oggi è **già aperta** non annulla l'allungamento:
   *    lo rimanda di un giorno. Chiudi alle 20:00 e domani apri alle 16:00 — sono venti ore lo
   *    stesso, e dirle sedici sarebbe farle confermare un digiuno che non sa di fare.
   * 2. Se cambia **anche il protocollo**, la chiusura di ieri è quella del protocollo vecchio: usare
   *    le ore di quello nuovo dava numeri che nessun orologio produce (fino a 24 ore su un 20:4).
   * 3. Anche l'anticipo dentro il passo si vede: 12:00 → 11:30 sono quindici ore e mezza, non
   *    sedici, ed è proprio la mezz'ora che il metodo A concede.
   *
   * `null` quando il protocollo di adesso non è in tabella (dato scritto a mano, o profilo mai
   * impostato): il conto non si sa fare, e *«non lo so» deve costare meno di «ho indovinato»*.
   */
  minutiDigiunoStanotte: number | null;
  /** Quanti giorni per arrivare al bersaglio col metodo graduale. `0` se non c'è piano. */
  giorniDelPiano: number;
  /**
   * ⚠️ Il passo davvero usato, dopo il controllo sul valore che arriva da `config_param`. Se qui
   * compare un numero diverso da quello configurato, quel valore era inutilizzabile: chi chiama lo
   * scrive nei log. *Niente tagli silenziosi.*
   */
  passoUsatoMin: number;
  /**
   * ⛔ Le ragioni per cui la nutrizionista deve guardare (§3). Vuoto = niente da segnalare.
   *
   * ⚠️ Le calcola **questa funzione**, non il chiamante: prima erano una funzione a parte che
   * l'endpoint doveva ricordarsi di chiamare, ed è la stessa forma di difetto già corretta in
   * `chiedi-la-finestra.ts` — una regola che dipende dalla disciplina del prossimo che scrive.
   * ⚠️ La terza condizione del foglio (`restaCorta`) **non può stare qui** perché serve la dieta:
   * chi chiama la aggiunge a questo elenco.
   */
  daVerificare: string[];
  /** La frase da mostrare alla cliente prima che confermi. Mai un codice. */
  spiegazione: string;
}

/** Lo scarto fra due orari sulla strada più corta: negativo = più presto, positivo = più tardi. */
export function scartoPiuCorto(daMin: number, aMin: number): number {
  const grezzo = dentroLaGiornata(aMin - daMin);
  // ⚠️ Esattamente 12 ore resta positivo: le due strade sono lunghe uguali, e fra le due si
  // sceglie quella che ALLUNGA il digiuno. Una parità non deve mai cadere dalla parte che accorcia.
  return grezzo > MEZZA_GIORNATA ? grezzo - MINUTI_AL_GIORNO : grezzo;
}

/** Le ore di digiuno di un protocollo (24 meno la finestra). */
const oreDigiunoDi = (protocollo: string): number => {
  const p = protocolloDigiuno(protocollo);
  return p ? 24 - p.oreFinestra : 0;
};

/** Vero se con quel protocollo la finestra tiene un pasto solo. Derivato, non chiesto a chi chiama. */
const unicoPastoCon = (protocollo: string): boolean => {
  const p = protocolloDigiuno(protocollo);
  return p ? pastiDellaFinestra(p.oreFinestra).length === 1 : false;
};

/**
 * ⛔ IL PASSO, CONTROLLATO PRIMA DI USARLO.
 *
 * Il commento in testa promette che il passo si cambia da `config_param` senza un rilascio. Una
 * promessa così va con una guardia, o il giorno che qualcuno svuota il campo il valore arriva qui a
 * **zero**: il piano diventa «in Infinity giorni apri alle 08:00» — scritto così, sul telefono di
 * una cliente — e il cron riscrive ogni notte lo stesso orario senza avvicinarsi mai. Un passo
 * negativo è peggio: la finestra si allontana dal bersaglio girando il quadrante al contrario.
 *
 * ⚠️ Si ripiega sul predefinito **e lo si dice** (`passoUsatoMin` nell'esito): un valore di
 * configurazione inutilizzabile non deve fermare la cliente, ma nemmeno sparire senza lasciare
 * traccia. *Niente tagli silenziosi.*
 */
export const passoValido = (passoMin: number): number =>
  Number.isFinite(passoMin) && passoMin >= 1 ? Math.round(passoMin) : PASSO_GRADUALE_PREDEFINITO;

/**
 * La finestra di oggi si è già aperta? ⚠️ Non basta `oraMin >= inizioMin`: una finestra che scavalca
 * la mezzanotte (apre alle 19:00, chiude all'01:00) alle 00:30 è **aperta**, e con quel confronto
 * risulterebbe chiusa.
 */
export function finestraGiaAperta(inizioMin: number, protocollo: string, oraMin: number): boolean {
  const p = protocolloDigiuno(protocollo);
  if (!p) return false;
  const dallApertura = dentroLaGiornata(oraMin - inizioMin);
  return dallApertura < p.oreFinestra * 60;
}

/**
 * ⛔ QUANTO DURA IL DIGIUNO CHE STA PER FARE: **dall'ultima chiusura alla prossima apertura**.
 *
 * ⚠️ La chiusura la decide la finestra **vecchia** — ieri sera era ancora quella in vigore — e
 * l'apertura quella **nuova**. Questa è l'unica formula del file, e sostituisce le tre risposte
 * diverse che i tre rami davano prima (vedi `minutiDigiunoStanotte` nell'esito).
 *
 * ⚠️ E il numero **non dipende da «oggi o domani»**: sia che il nuovo orario parta stasera, sia che
 * parta domani, la chiusura e l'apertura restano quelle due ore dell'orologio, e la distanza fra
 * loro è la stessa. È il motivo per cui rimandare uno spostamento in avanti **non lo annulla**.
 */
export function minutiFraChiusuraEApertura(
  protocolloVecchio: string,
  inizioVecchioMin: number,
  inizioNuovoMin: number,
): number | null {
  const vecchio = protocolloDigiuno(protocolloVecchio);
  // ⚠️ Protocollo fuori tabella (profilo mai impostato, o dato scritto a mano): il conto non si sa
  // fare. Si dice, invece di rispondere un numero che nessun orologio produce.
  if (!vecchio) return null;
  const chiusura = chiusuraFinestra(inizioVecchioMin, vecchio.oreFinestra);
  return dentroLaGiornata(inizioNuovoMin - chiusura);
}

/**
 * Il cambio, deciso.
 *
 * ⚠️ **Non scrive niente e non conosce Prisma**: torna cosa scrivere. È la stessa forma di
 * `chiedi-la-finestra.ts`, e per la stessa ragione — la regola si prova senza database, e il giorno
 * che due porte vorranno spostare la finestra (l'app e la scheda staff) rispondono uguale.
 */
export function decidiCambio(
  attuale: FinestraAttuale,
  richiesta: RichiestaCambio,
  momento: Momento,
  passoMin: number = PASSO_GRADUALE_PREDEFINITO,
): EsitoCambio {
  const passo = passoValido(passoMin);
  const protocolloNuovo = richiesta.protocollo ?? attuale.protocollo;
  const inizioNuovo = richiesta.inizioMin ?? attuale.inizioMin;

  /** Quando non cambia niente: il digiuno resta quello di sempre. */
  const invariato = (): EsitoCambio => ({
    permesso: true,
    metodo: 'nessuno',
    scrivi: { protocollo: attuale.protocollo, inizioMin: attuale.inizioMin, bersaglioInizioMin: null },
    daQuando: 'oggi',
    minutiDigiunoStanotte: minutiFraChiusuraEApertura(attuale.protocollo, attuale.inizioMin, attuale.inizioMin),
    giorniDelPiano: 0,
    passoUsatoMin: passo,
    daVerificare: [],
    spiegazione: 'La tua finestra è già così.',
  });
  const no = (rifiuto: string): EsitoCambio => ({ ...invariato(), permesso: false, rifiuto, spiegazione: 'Non cambia niente.' });

  if (!protocolloDigiuno(protocolloNuovo)) {
    // ⚠️ In chiaro: chi legge questo messaggio è la cliente, non chi ha scritto il codice.
    return no('Quel tipo di digiuno non è fra quelli che possiamo impostare.');
  }
  if (!Number.isInteger(inizioNuovo) || inizioNuovo < 0 || inizioNuovo >= MINUTI_AL_GIORNO) {
    return no('Quell\'orario non esiste.');
  }

  const scarto = scartoPiuCorto(attuale.inizioMin, inizioNuovo);
  const cambiaProtocollo = protocolloNuovo !== attuale.protocollo;
  if (scarto === 0 && !cambiaProtocollo) return invariato();

  // ⛔ Un cambio al giorno. Si controlla PRIMA di decidere il metodo, perché il messaggio deve
  // dire quando potrà rifarlo — non «riprova più tardi», che è un modo di non dire niente.
  if (attuale.cambiataIl) {
    const oreTrascorse = (momento.adesso.getTime() - attuale.cambiataIl.getTime()) / 3_600_000;
    if (oreTrascorse < ORE_FRA_DUE_CAMBI) {
      const mancano = Math.max(1, Math.ceil(ORE_FRA_DUE_CAMBI - oreTrascorse));
      return no(
        `La tua finestra l'hai già spostata da poco: puoi rifarlo fra ${mancano} ${mancano === 1 ? 'ora' : 'ore'}. ` +
        'Spostarla due volte nello stesso giorno confonde il conto del digiuno.',
      );
    }
  }

  const giaAperta = finestraGiaAperta(attuale.inizioMin, attuale.protocollo, momento.oraMin);
  const oreFinestraNuova = 24 - oreDigiunoDi(protocolloNuovo);
  const distanza = Math.abs(scarto);
  const conPiano = scarto < 0 && distanza > passo;

  /**
   * ⚠️ L'inizio che sarà in vigore **alla prossima apertura**, che non è sempre quello richiesto:
   * col piano graduale la prossima apertura è di **un passo** più presto, non al bersaglio.
   */
  const inizioProssimaApertura = conPiano ? dentroLaGiornata(attuale.inizioMin - passo) : inizioNuovo;
  const minutiStanotte = minutiFraChiusuraEApertura(attuale.protocollo, attuale.inizioMin, inizioProssimaApertura);
  const minutiDiPrima = minutiFraChiusuraEApertura(attuale.protocollo, attuale.inizioMin, attuale.inizioMin);

  const quando: 'oggi' | 'domani' = giaAperta ? 'domani' : 'oggi';
  const chiusuraNuova = oraDelGiorno(chiusuraFinestra(inizioNuovo, oreFinestraNuova));
  /** ⚠️ Il protocollo entra nella frase solo se cambia: nominarlo sempre lo renderebbe rumore. */
  const pezzoProtocollo = cambiaProtocollo ? ` Passi al ${protocolloNuovo}.` : '';
  /**
   * ⚠️ Le ore di stanotte si nominano **solo se cambiano**. «Venti invece di venti» è una frase che
   * fa fermare a rileggere, e prima usciva ogni volta che si allargava il protocollo senza spostare
   * l'orario.
   */
  const pezzoStanotte =
    minutiStanotte !== null && minutiDiPrima !== null && minutiStanotte !== minutiDiPrima
      ? ` Stanotte il digiuno dura ${oreLeggibili(minutiStanotte)} ore invece di ${oreLeggibili(minutiDiPrima)}.`
      : '';

  const base = {
    permesso: true as const,
    daQuando: quando,
    minutiDigiunoStanotte: minutiStanotte,
    passoUsatoMin: passo,
    // ⛔ Calcolate qui, non lasciate a chi chiama: vedi `daVerificare` nell'esito.
    daVerificare: ragioniDaVerificare(protocolloNuovo, unicoPastoCon(protocolloNuovo)),
  };

  // ─── METODO A col piano: la finestra va più PRESTO di più di un passo ─────────────────────
  if (conPiano) {
    const giorni = Math.ceil(distanza / passo);
    return {
      ...base,
      /**
       * ⚠️ Col piano, oggi **l'orario non si muove**: il primo passo lo fa il cron stanotte. Quindi
       * «da oggi» sarebbe falso — a meno che cambi anche il protocollo, che invece vale già dalla
       * prossima apertura. Sono due cose diverse scritte insieme, e questa riga dice quale delle due
       * la cliente vede per prima.
       */
      daQuando: cambiaProtocollo && !giaAperta ? 'oggi' : 'domani',
      metodo: 'graduale',
      // ⚠️ L'inizio NON si tocca: il primo passo lo fa il cron stanotte, così il digiuno di oggi
      // non si accorcia di sorpresa. Si scrive solo il bersaglio.
      scrivi: { protocollo: protocolloNuovo, inizioMin: attuale.inizioMin, bersaglioInizioMin: inizioNuovo },
      giorniDelPiano: giorni,
      spiegazione:
        `Sposto la tua finestra un po' alla volta: ${passoAParole(passo)} al giorno, e in ${giorni} ` +
        `${giorni === 1 ? 'giorno' : 'giorni'} apri alle ${oraDelGiorno(inizioNuovo)}. ` +
        'Anticipare tutto in una volta accorcerebbe il digiuno di stanotte e ne perderesti i benefici.' +
        pezzoProtocollo + pezzoStanotte,
    };
  }

  // ─── Tutto il resto: si scrive e vale dalla prossima apertura ─────────────────────────────
  // scarto > 0 è il «reset» del manuale (il digiuno si allunga, permesso subito); scarto < 0 dentro
  // il passo è l'accorciamento che il metodo A concede; scarto === 0 è il solo cambio di protocollo.
  return {
    ...base,
    metodo: scarto > 0 ? 'reset' : scarto < 0 ? 'graduale' : 'subito',
    scrivi: { protocollo: protocolloNuovo, inizioMin: inizioNuovo, bersaglioInizioMin: null },
    giorniDelPiano: 0,
    spiegazione:
      `Da ${quando} apri alle ${oraDelGiorno(inizioNuovo)} e chiudi alle ${chiusuraNuova}.` +
      pezzoProtocollo + pezzoStanotte,
  };
}

/** Il passo come lo legge una persona: «un'ora», «due ore», «45 minuti». */
function passoAParole(passoMin: number): string {
  if (passoMin === 60) return "un'ora";
  if (passoMin % 60 === 0) return `${passoMin / 60} ore`;
  return `${passoMin} minuti`;
}

/**
 * Le ore come le legge una persona: «20» e «20,5», mai «20.333333333333332».
 *
 * ⚠️ Prende **minuti** e non ore: il conto vero sta in minuti interi, e un numero con la virgola in
 * mezzo al percorso è il modo in cui i decimali finiscono a schermo. Si arrotonda alla mezz'ora,
 * che è la precisione con cui una persona pensa a un digiuno.
 */
export const oreLeggibili = (minuti: number): string => {
  const mezzi = Math.round((minuti / 60) * 2) / 2;
  return Number.isInteger(mezzi) ? String(mezzi) : String(mezzi).replace('.', ',');
};

/**
 * IL PASSO DI STANOTTE — quello che il cron scrive per avvicinare la finestra al bersaglio.
 *
 * ⚠️ Torna `null` quando non c'è niente da fare: nessun bersaglio, o già arrivata. Chi chiama non
 * scrive. E l'ultimo passo **non supera** il bersaglio: si arriva esatti, o una cliente che voleva
 * le 08:00 si troverebbe alle 07:00 e nessuno saprebbe dire perché.
 */
export function passoDiStanotte(
  inizioMin: number,
  bersaglioMin: number | null | undefined,
  passoMin: number = PASSO_GRADUALE_PREDEFINITO,
): { inizioMin: number; arrivata: boolean } | null {
  if (bersaglioMin === null || bersaglioMin === undefined) return null;
  // ⛔ Il controllo sul passo sta ANCHE qui, e non solo in `decidiCambio`: il cron chiama questa
  // funzione da solo, ogni notte, ed è il punto in cui un passo a zero diventa una finestra che
  // non arriva mai — nessuno se ne accorge, perché ogni notte scrive un valore identico.
  const passo = passoValido(passoMin);
  const scarto = scartoPiuCorto(inizioMin, bersaglioMin);
  if (scarto === 0) return null;
  // ⚠️ Il piano graduale va sempre all'indietro (è il metodo A): un bersaglio più tardi non nasce
  // da qui. Se ci finisse lo stesso — dato scritto a mano, o piano rimasto da un cambio vecchio —
  // si arriva in un colpo invece di girare l'orologio al contrario per venti giorni.
  if (scarto > 0) return { inizioMin: bersaglioMin, arrivata: true };
  const distanza = Math.abs(scarto);
  if (distanza <= passo) return { inizioMin: bersaglioMin, arrivata: true };
  return { inizioMin: dentroLaGiornata(inizioMin - passo), arrivata: false };
}

/**
 * LE RAGIONI PER CUI LA NUTRIZIONISTA DEVE GUARDARE — §3 del foglio decisioni.
 *
 * ⚠️ **La cliente non viene mai bloccata**: sceglie, parte, e in parallelo si apre un'attività.
 * Qui si dice solo *perché*, in chiaro, perché quella frase la legge una persona.
 *
 * ⛔ La terza condizione del foglio — `restaCorta`, cioè «anche coi moltiplicatori al tetto le
 * calorie non ci arrivano» — **non sta qui**: la calcola `porzione-scalata.ts` sul fabbisogno vero
 * di quella cliente, e serve la sua dieta. Chi chiama la aggiunge. È la migliore delle tre, e
 * dimenticarla qui sarebbe far credere che le due di sopra bastino.
 */
export function ragioniDaVerificare(protocollo: string, unicoPasto: boolean): string[] {
  const ragioni: string[] = [];
  const p = protocolloDigiuno(protocollo);
  if (p && p.oreFinestra <= 4) {
    ragioni.push(`Ha scelto il ${p.valore} (${p.nome}): il manuale lo dà per chi ha già esperienza.`);
  }
  if (unicoPasto) {
    ragioni.push('Con questa finestra le resta un pasto solo al giorno.');
  }
  return ragioni;
}

/** I protocolli che il §3 chiama «estremi», per chi vuole l'elenco invece della domanda. */
export const PROTOCOLLI_DA_VERIFICARE: string[] = PROTOCOLLI_DIGIUNO
  .filter((p) => p.oreFinestra <= 4)
  .map((p) => p.valore);
