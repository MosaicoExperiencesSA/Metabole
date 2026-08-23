/**
 * ⛔ **«PUÒ PROSEGUIRE» DEVE ARRIVARE ALLA CLIENTE — e fino al 23/8 non ci arrivava.**
 *
 * ## Il difetto, come si è visto
 *
 * Gianluca, 23/8. Sulla sua scheda: **«Valutazione clinica — Può proseguire · 23/08/2026»**, con la
 * nota della nutrizionista. Nella sua app, nello stesso momento: **«Menu dopo la visita — Il tuo è
 * un percorso supervisionato: il menu sarà pronto dopo la visita con il nutrizionista.»**
 *
 * ⛔ Perché la decisione e il blocco erano **due campi diversi, e nessuno dei due chiamava l'altro**:
 *
 *  · il pulsante scrive `clientProfile.idoneita` (più chi ha deciso, quando, e la nota);
 *  · la card che la cliente legge — e il gate del menu, e il popup delle misure — leggevano **solo**
 *    `clientProfile.screeningFlag`, che lo mette il questionario in registrazione.
 *
 * ⛔ E `screeningFlag` **non veniva riazzerato da nessuna parte**: non dalla valutazione clinica, non
 * dalla visita, non da uno script. Cercato in tutto il backend e in `prisma/`. Quindi il via libera
 * clinico, per la cliente, **non cambiava assolutamente niente**: il menu restava su «dopo la visita»
 * per sempre, e la nutrizionista era convinta di averla sbloccata.
 *
 * ⚠️ È il caso peggiore fra i possibili: non un errore, non un avviso — due schermate che raccontano
 * due cose diverse alla stessa ora, e quella che la cliente vede è quella sbagliata. Lei aspetta una
 * visita che non serve più; la nutrizionista pensa di aver fatto. Nessuno dei due ha modo di
 * accorgersene se non parlandosi.
 *
 * ## La regola (decisa da Simone, 23/8)
 *
 * Il blocco lo **crea** lo screening. A toglierlo è la **decisione clinica**, e la decisione ha due
 * forme diverse:
 *
 *  · nessuna decisione → **bloccata**: non l'ha ancora guardata nessuno;
 *  · **«Può proseguire»** → libera, e resta libera. Non c'è niente da rivedere;
 *  · **«Serve una visita»** → la nutrizionista scrive **entro quando** va fatta. Fino a quel giorno
 *    **compreso** la cliente riceve i menu; dal giorno dopo il percorso si ferma.
 *
 * ⚠️ **Il giorno della scadenza è ancora libero** (scelta di Simone): «entro il 30» vuol dire che il
 * 30 si mangia. È anche il verso che non toglie una giornata a chi la visita ce l'ha fissata proprio
 * quel giorno nel pomeriggio.
 *
 * ⚠️ **`serve_visita` senza data resta bloccante.** Sono le righe scritte prima del 23/8, quando la
 * data non esisteva: dare loro una finestra aperta vorrebbe dire sbloccare a posteriori delle
 * persone che nessuno ha più guardato. La data è obbligatoria per le decisioni nuove
 * (`validaDecisione`), quindi il caso si esaurisce da sé.
 *
 * ⚠️ **La decisione può solo TOGLIERE il blocco, mai crearlo.** Una `serve_visita` su una cliente
 * senza `screeningFlag` — capita, per esempio per un'allergia — oggi riceve i menu, e non è questa
 * consegna il posto per fermarli: sarebbe un blocco nuovo su clienti che stanno mangiando, cioè un
 * cambiamento nella direzione che fa danno, deciso di rimbalzo mentre se ne correggeva un altro.
 *
 * ⚠️ **Il guardrail del motore resta com'è**, e di proposito: `engine.service.checkGuardrails` non
 * chiama questa funzione. «Può proseguire» vuol dire che la cliente può fare il percorso — non che
 * il motore possa da solo cambiarle le calorie senza passare dalla nutrizionista. Quella è una
 * decisione clinica e la prende Simone con Lucia, non io mentre sistemo il gate del menu. Voce
 * `motore-dopo-il-via-libera`. ⚠️ E le due cose sbagliano in versi opposti: un gate chiuso di troppo
 * costa alla cliente **tutto il servizio**, un guardrail chiuso di troppo costa una decisione in più
 * alla nutrizionista.
 */
import { aGiorno, giornoDelDato } from '../common/date-only';

/** Quel poco di profilo che serve per rispondere. Volutamente largo: i chiamanti hanno `select` diversi. */
export type ProfiloDaSupervisionare = {
  screeningFlag?: boolean | null;
  idoneita?: string | null;
  /** Solo per `serve_visita`: il giorno entro cui la visita va fatta. */
  idoneitaVisitaEntro?: Date | null;
} | null | undefined;

/** La decisione che toglie il blocco per sempre. */
export const VIA_LIBERA = 'idonea';
/** La decisione che apre una finestra a termine. */
export const SERVE_VISITA = 'serve_visita';

/**
 * Com'è messa una cliente rispetto al via libera clinico, e da quando.
 *
 * ⚠️ **`bloccata` c'è su tutti i rami, anche su chi non è supervisionata.** Una prima stesura la
 * ometteva lì — «non c'è niente da bloccare» — e ogni chiamante doveva ricordarsi di controllare
 * prima `supervisionata`: cioè la domanda «i menu si fermano?» aveva due forme, e chi ne scriveva
 * una terza sbagliava in silenzio. Qui la risposta è **sempre** nello stesso campo.
 */
export type StatoSupervisione =
  /** Non è in percorso supervisionato: qui non si decide niente. */
  | { supervisionata: false; bloccata: false; motivo: 'non_supervisionata'; visitaEntro: null }
  /** In attesa che qualcuno la guardi. */
  | { supervisionata: true; bloccata: true; motivo: 'mai_valutata'; visitaEntro: null }
  /** La visita andava fatta e il termine è passato. */
  | { supervisionata: true; bloccata: true; motivo: 'visita_scaduta'; visitaEntro: string }
  /** Via libera senza scadenze. */
  | { supervisionata: true; bloccata: false; motivo: 'via_libera'; visitaEntro: null }
  /** Dentro la finestra: riceve i menu, ma la visita va fatta entro quel giorno. */
  | { supervisionata: true; bloccata: false; motivo: 'visita_da_fare'; visitaEntro: string };

/**
 * ⚠️ **Il confronto è fra GIORNI, non fra istanti — e ognuno letto alla SUA porta.**
 *
 * «Oggi» è il giorno di Roma (`aGiorno`): quello che intende la nutrizionista quando scrive «entro
 * il 30». La scadenza invece è un valore **salvato** — mezzanotte UTC del giorno scelto — e si
 * rilegge com'è scritta (`giornoDelDato`), non nel fuso: è la distinzione dichiarata in
 * `date-only.ts`, le due domande diverse. ⚠️ La prima stesura leggeva anche la scadenza con
 * `aGiorno`/`giornoLocale`: identico per Roma, ma con un `APP_TIMEZONE` a ovest di Greenwich la
 * data salvata sarebbe slittata **indietro di un giorno** — blocco un giorno prima del promesso, e
 * la data mostrata sbagliata. Trovato in revisione misurando con `America/New_York`.
 *
 * Con un confronto fra istanti, poi, una scadenza scritta `…T00:00:00Z` avrebbe chiuso la finestra
 * **due ore prima** della mezzanotte italiana: un giorno di menu tolto a una persona.
 */
export function statoSupervisione(p: ProfiloDaSupervisionare, oggi: Date = new Date()): StatoSupervisione {
  if (!p?.screeningFlag) return { supervisionata: false, bloccata: false, motivo: 'non_supervisionata', visitaEntro: null };

  if (p.idoneita === VIA_LIBERA) {
    return { supervisionata: true, bloccata: false, motivo: 'via_libera', visitaEntro: null };
  }

  if (p.idoneita === SERVE_VISITA && p.idoneitaVisitaEntro) {
    const entro = p.idoneitaVisitaEntro.toISOString().slice(0, 10);
    const scaduta = aGiorno(oggi).getTime() > giornoDelDato(p.idoneitaVisitaEntro).getTime();
    return scaduta
      ? { supervisionata: true, bloccata: true, motivo: 'visita_scaduta', visitaEntro: entro }
      : { supervisionata: true, bloccata: false, motivo: 'visita_da_fare', visitaEntro: entro };
  }

  /**
   * ⚠️ Ci finiscono: nessuna decisione, `serve_visita` **senza** data (le righe di prima del 23/8), e
   * qualunque esito che un domani venisse aggiunto senza passare di qui. ⛔ Il verso è voluto:
   * sciogliere per esclusione — «tutto ciò che non è `serve_visita` va bene» — farebbe passare in
   * silenzio un esito nuovo, e il silenzio qui vuol dire menu consegnati a chi non doveva riceverli.
   */
  return { supervisionata: true, bloccata: true, motivo: 'mai_valutata', visitaEntro: null };
}

/** La domanda corta, per i gate che non hanno bisogno del resto. */
export function attendeIlViaLiberaClinico(p: ProfiloDaSupervisionare, oggi: Date = new Date()): boolean {
  return statoSupervisione(p, oggi).bloccata;
}
