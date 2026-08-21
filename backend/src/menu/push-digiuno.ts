/**
 * LE PUSH DEL DIGIUNO — quali, a che ora, e quali NON si mandano.
 *
 * Le quattro chieste da Simone il 19/8 («inizia il tuo digiuno», «ora puoi iniziare a mangiare»,
 * «fra un'ora potrai mangiare», «fra un'ora dovrai smettere») più le due metaboliche del manuale
 * (dodici ore · sedici ore), accese di default per decisione del §12.2.
 *
 * ⛔ **Sei tipi non vuol dire sei notifiche al giorno**, e va detto perché è la ragione per cui
 * questo modulo esiste invece di sei righe sparse:
 *
 * | protocollo | digiuno | T+12h | T+16h | push al giorno |
 * |---|---|---|---|---|
 * | 14:10 | 14 h | ✅ | ⛔ **non esiste**: il digiuno finisce a 14 h | 5 |
 * | 16:8  | 16 h | ✅ | ⚠️ cade **all'apertura** → si fonde con «puoi mangiare» | 5 |
 * | 18:6  | 18 h | ✅ | ✅ | 6 |
 * | 20:4  | 20 h | ✅ | ✅ | 6 |
 * | 23:1  | 23 h | ✅ | ✅ | 6 |
 *
 * ## ⛔ Le tre regole che tolgono, e che senza questo modulo nessuno applicherebbe
 *
 * 1. **Una push metabolica che cadrebbe DENTRO la finestra di pasto non si manda.** «Autofagia al
 *    picco» mentre la cliente sta pranzando è un messaggio che dice una cosa falsa.
 * 2. **Se le sedici ore cadono a meno di mezz'ora dall'apertura, si fondono in un messaggio solo.**
 *    Due notifiche a due minuti di distanza si leggono come un difetto, non come due informazioni.
 * 3. **Quello che cade nel sonno si salta, non si accumula.** Tre notifiche insieme al risveglio
 *    sono il modo più rapido per farsele disattivare tutte. ⚠️ E il countdown in home resta la fonte
 *    di verità: chi dorme non perde niente, lo ritrova a schermo.
 *
 * ⚠️ **Niente tagli silenziosi**: ogni push tolta esce in `saltate` col motivo scritto. Serve alla
 * diagnostica e serve a chi un giorno chiederà «perché stamattina non mi è arrivato niente».
 *
 * ## ⚠️ Il sonno: default 23:00–07:00, e il default lo mette CHI LEGGE
 *
 * Le colonne `fasting_sleep_start` / `fasting_sleep_end` nascono NULL apposta, perché «non me l'ha
 * detto» e «dorme dalle 23» sono due cose diverse. Il ripiego si applica **qui**, in un punto solo,
 * ed è dichiarato: `SONNO_PREDEFINITO`.
 */
import {
  chiusuraFinestra,
  dentroLaGiornata,
  oraDelGiorno,
  protocolloDigiuno,
} from './orologio-digiuno';

const MINUTI_AL_GIORNO = 24 * 60;

export type TipoPushDigiuno =
  | 'digiuno_inizia'
  | 'digiuno_puoi_mangiare'
  | 'digiuno_manca_unora'
  | 'digiuno_chiude_fra_unora'
  | 'digiuno_12_ore'
  | 'digiuno_16_ore';

/** ⚠️ Le due metaboliche sono tipi a sé: chi si stufa spegne queste e tiene le quattro utili. */
export const PUSH_METABOLICHE: TipoPushDigiuno[] = ['digiuno_12_ore', 'digiuno_16_ore'];

export const TUTTI_I_TIPI_PUSH: TipoPushDigiuno[] = [
  'digiuno_inizia',
  'digiuno_puoi_mangiare',
  'digiuno_manca_unora',
  'digiuno_chiude_fra_unora',
  'digiuno_12_ore',
  'digiuno_16_ore',
];

export interface FinestraSonno {
  /** Minuti da mezzanotte. Può scavalcare la mezzanotte (23:00 → 07:00). */
  inizioMin: number;
  fineMin: number;
}

/** Il ripiego, dichiarato: si applica solo se la cliente non ha detto la sua. */
export const SONNO_PREDEFINITO: FinestraSonno = { inizioMin: 23 * 60, fineMin: 7 * 60 };

/** Quanto prima dell'apertura (e della chiusura) avvisa il preavviso. */
export const PREAVVISO_MIN = 60;

/** Entro quanto una metabolica si fonde con l'apertura invece di suonare due volte. */
export const FUSIONE_MIN = 30;

export interface PushProgrammata {
  tipo: TipoPushDigiuno;
  /** Minuti da mezzanotte. */
  oraMin: number;
  ora: string;
  titolo: string;
  corpo: string;
}

export interface PushSaltata {
  tipo: TipoPushDigiuno;
  oraMin: number;
  ora: string;
  /** In chiaro: serve alla diagnostica e a chi chiederà «perché non mi è arrivato niente». */
  motivo: string;
}

export interface GiornataDiPush {
  programmate: PushProgrammata[];
  saltate: PushSaltata[];
}

/** Vero se `min` cade dentro l'intervallo, che può scavalcare la mezzanotte. */
export function dentroIntervallo(min: number, daMin: number, aMin: number): boolean {
  const m = dentroLaGiornata(min);
  const da = dentroLaGiornata(daMin);
  const a = dentroLaGiornata(aMin);
  // ⚠️ Un intervallo lungo zero non contiene niente; uno lungo 24 ore contiene tutto.
  if (da === a) return false;
  return da < a ? m >= da && m < a : m >= da || m < a;
}

/**
 * LE PUSH DI UNA GIORNATA, con i loro orari e quello che si è tolto.
 *
 * ⚠️ Prende la finestra e il sonno, **non** il profilo: così si prova senza database e la stessa
 * funzione serve l'anteprima nell'app («quando ti scrivo») e il giro che manda davvero.
 */
export function pushDelGiorno(
  inizioMin: number,
  protocollo: string,
  sonno: FinestraSonno = SONNO_PREDEFINITO,
  spente: readonly string[] = [],
): GiornataDiPush {
  const p = protocolloDigiuno(protocollo);
  const programmate: PushProgrammata[] = [];
  const saltate: PushSaltata[] = [];
  // ⛔ Protocollo fuori tabella: non si indovina una giornata. Nessuna push, e nessun motivo finto.
  if (!p) return { programmate, saltate };

  const apertura = dentroLaGiornata(inizioMin);
  const chiusura = chiusuraFinestra(apertura, p.oreFinestra);
  const oreDigiuno = 24 - p.oreFinestra;

  /**
   * ⛔ **ARRIVA DAVVERO?** Serve saperlo *prima* di fondere due messaggi in uno: fondere le sedici
   * ore dentro «puoi mangiare» quando «puoi mangiare» è spenta o cade nel sonno vuol dire far
   * sparire **tutte e due** — e la diagnostica direbbe pure «te l'ho detto in quel messaggio», che
   * è falso, perché quel messaggio non è partito.
   */
  const arriva = (tipo: TipoPushDigiuno, oraMin: number): boolean =>
    !spente.includes(tipo) && !dentroIntervallo(dentroLaGiornata(oraMin), sonno.inizioMin, sonno.fineMin);

  /** Aggiunge, oppure toglie con il motivo scritto. */
  const metti = (tipo: TipoPushDigiuno, oraMin: number, titolo: string, corpo: string): void => {
    const ora = dentroLaGiornata(oraMin);
    if (spente.includes(tipo)) {
      saltate.push({ tipo, oraMin: ora, ora: oraDelGiorno(ora), motivo: 'l\'hai disattivata' });
      return;
    }
    if (dentroIntervallo(ora, sonno.inizioMin, sonno.fineMin)) {
      // ⚠️ Si salta, non si accumula: il countdown in home resta la fonte di verità.
      saltate.push({ tipo, oraMin: ora, ora: oraDelGiorno(ora), motivo: 'cade mentre dormi' });
      return;
    }
    programmate.push({ tipo, oraMin: ora, ora: oraDelGiorno(ora), titolo, corpo });
  };

  // ─── Le quattro che riguardano la finestra ────────────────────────────────────────────────
  /**
   * ⛔ **CON UNA FINESTRA DI UN'ORA IL PREAVVISO CADE SULL'APERTURA** (trovato in revisione, 21/8).
   *
   * Con la 23:1 la finestra dura sessanta minuti: «fra un'ora si chiude» arriverebbe **nello stesso
   * minuto** di «ora puoi mangiare» — su tutte le 288 posizioni della giornata, sempre. Due
   * notifiche insieme si leggono come un difetto dell'app; e il testo — *«se ti manca un pasto, è
   * adesso»* — arriverebbe prima che lei abbia mangiato qualsiasi cosa.
   *
   * ⚠️ È lo stesso motivo della fusione delle sedici ore, applicato al posto giusto: qui non si
   * fonde niente, semplicemente non ha senso avvisare di una fine che coincide con l'inizio.
   */
  if (p.oreFinestra * 60 > PREAVVISO_MIN) {
    metti(
      'digiuno_chiude_fra_unora',
      chiusura - PREAVVISO_MIN,
      'Fra un\'ora si chiude',
      `La tua finestra si chiude alle ${oraDelGiorno(chiusura)}. Se ti manca un pasto, è adesso.`,
    );
  } else {
    const ora = dentroLaGiornata(chiusura - PREAVVISO_MIN);
    saltate.push({
      tipo: 'digiuno_chiude_fra_unora', oraMin: ora, ora: oraDelGiorno(ora),
      motivo: 'la tua finestra dura un\'ora: il preavviso cadrebbe insieme all\'apertura',
    });
  }
  metti(
    'digiuno_inizia',
    chiusura,
    'Inizia il tuo digiuno',
    `Da adesso ${oreDigiuno} ore di digiuno, fino alle ${oraDelGiorno(apertura)}. Acqua, tè e caffè senza zucchero si possono, sempre.`,
  );
  metti(
    'digiuno_manca_unora',
    apertura - PREAVVISO_MIN,
    'Fra un\'ora puoi mangiare',
    `Alle ${oraDelGiorno(apertura)} si apre la tua finestra. Manca poco: se hai fame, un bicchiere d'acqua aiuta ad arrivarci.`,
  );

  /**
   * ⚠️ **LA FUSIONE.** Con la 16:8 le sedici ore cadono esattamente all'apertura. Mandare due
   * notifiche nello stesso minuto — «autofagia al picco» e «puoi mangiare» — si legge come un
   * difetto dell'app, non come due informazioni. Si fondono, e il messaggio dice tutte e due le
   * cose: quella che spiega (le sedici ore) e quella che serve (puoi mangiare).
   */
  const oraSedici = dentroLaGiornata(chiusura + 16 * 60);
  const sediciEsistono = oreDigiuno >= 16;
  /**
   * ⛔ Si fonde **solo se il messaggio che la ospita arriva davvero**. Se «puoi mangiare» è spenta o
   * cade nel sonno, fondere farebbe sparire tutte e due — e il motivo scritto («te l'ho detto in
   * quel messaggio») sarebbe una bugia detta alla diagnostica.
   */
  const sediciSiFondono =
    sediciEsistono
    && Math.abs(scartoBreve(oraSedici, apertura)) <= FUSIONE_MIN
    && !spente.includes('digiuno_16_ore')
    && arriva('digiuno_puoi_mangiare', apertura);

  metti(
    'digiuno_puoi_mangiare',
    apertura,
    sediciSiFondono ? 'Sedici ore. Ora puoi mangiare' : 'Ora puoi iniziare a mangiare',
    sediciSiFondono
      ? `Sedici ore di digiuno: l'autofagia è al suo massimo. La finestra è aperta fino alle ${oraDelGiorno(chiusura)}.`
      : `La tua finestra è aperta fino alle ${oraDelGiorno(chiusura)}. Buon primo pasto.`,
  );

  // ─── Le due metaboliche ───────────────────────────────────────────────────────────────────
  /**
   * ⛔ **IL MINUTO DELL'APERTURA APPARTIENE AL DIGIUNO, non al pasto.** «Dodici ore» alle 13:00 in
   * punto, quando la finestra apre alle 13:00, non è un messaggio mandato «mentre stai mangiando»:
   * è il momento esatto in cui il digiuno finisce, e quelle dodici ore le ha appena fatte. Se il
   * confronto includesse quell'istante, alla 16:8 le sedici ore risulterebbero sempre «dentro la
   * finestra» e sparirebbero anche quando la fusione non si applica.
   */
  const dentroIlPasto = (min: number): boolean => dentroIntervallo(min, apertura + 1, chiusura);

  const ora12 = dentroLaGiornata(chiusura + 12 * 60);
  if (oreDigiuno >= 12) {
    if (dentroIlPasto(ora12)) {
      // ⚠️ Non può succedere con i cinque protocolli di oggi, ma la regola vale lo stesso: un
      // messaggio sul digiuno mentre stai mangiando dice una cosa falsa.
      saltate.push({ tipo: 'digiuno_12_ore', oraMin: ora12, ora: oraDelGiorno(ora12), motivo: 'cadrebbe mentre stai mangiando' });
    } else {
      metti(
        'digiuno_12_ore',
        ora12,
        'Dodici ore',
        'Dodici ore di digiuno: le riserve di zucchero sono finite e il corpo è passato a bruciare grassi. Da qui in avanti è il pezzo che conta.',
      );
    }
  } else {
    saltate.push({
      tipo: 'digiuno_12_ore', oraMin: ora12, ora: oraDelGiorno(ora12),
      motivo: `il tuo digiuno dura ${oreDigiuno} ore: le dodici non le raggiunge`,
    });
  }

  if (!sediciEsistono) {
    saltate.push({
      tipo: 'digiuno_16_ore', oraMin: oraSedici, ora: oraDelGiorno(oraSedici),
      motivo: `il tuo digiuno dura ${oreDigiuno} ore: le sedici non le raggiunge`,
    });
  } else if (sediciSiFondono) {
    saltate.push({
      tipo: 'digiuno_16_ore', oraMin: oraSedici, ora: oraDelGiorno(oraSedici),
      motivo: 'cade all\'apertura della finestra: te l\'ho detto in quel messaggio',
    });
  } else if (dentroIlPasto(oraSedici)) {
    saltate.push({
      tipo: 'digiuno_16_ore', oraMin: oraSedici, ora: oraDelGiorno(oraSedici),
      motivo: 'cadrebbe mentre stai mangiando',
    });
  } else {
    metti(
      'digiuno_16_ore',
      oraSedici,
      'Sedici ore: autofagia al picco',
      'Sedici ore di digiuno: l\'autofagia — la pulizia delle cellule — è al suo massimo. È la parte del digiuno per cui lo si fa.',
    );
  }

  // ⚠️ In ordine di orologio, non in ordine di scrittura: chi le legge le legge come una giornata.
  programmate.sort((a, b) => a.oraMin - b.oraMin);
  saltate.sort((a, b) => a.oraMin - b.oraMin);
  return { programmate, saltate };
}

/** Lo scarto più corto fra due orari sul quadrante, in minuti. Negativo = prima. */
function scartoBreve(daMin: number, aMin: number): number {
  const grezzo = dentroLaGiornata(aMin - daMin);
  return grezzo > MINUTI_AL_GIORNO / 2 ? grezzo - MINUTI_AL_GIORNO : grezzo;
}
