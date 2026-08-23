// Stato del menu quando NON è ancora visibile: serve a rassicurare la cliente
// (spiega PERCHÉ e QUANDO arriva) invece di lasciarla pensare che l'app sia rotta.
// Lo stato è calcolato dal backend (GET /me/menu → `status`).
export interface MenuStatus {
  state: 'available' | 'scheduled' | 'awaiting_visit' | 'awaiting_measures' | 'awaiting_cycle_measure' | 'paused' | 'blocked' | 'plan_held' | 'preparing' | 'expired' | 'monitoring';
  availableFrom: string | null; // yyyy-mm-dd in cui il menu diventa visibile
  planStartDate: string | null;
  /**
   * Solo a visita **scaduta**: il giorno entro cui andava fatta (`aaaa-mm-gg`).
   *
   * ⛔ Serve a dire **da quando** il percorso si è fermato. Un blocco che non si spiega sembra un
   * guasto, e la cliente che telefona si sente rispondere «non lo so» anche da chi le risponde.
   */
  visitaEntro?: string;
  /**
   * Visita ancora da fare ma **non** scaduta: la cliente riceve i menu normalmente, e questo è il
   * promemoria.
   *
   * ⚠️ Non è uno stato: è un campo accanto. Farne uno stato vorrebbe dire togliere di mezzo la frase
   * che sta già leggendo — «il tuo piano parte il 3», «serve la tua pesata» — per sostituirla con un
   * promemoria. Sono due cose vere insieme.
   */
  visitaDaFareEntro?: string;
  /**
   * Il primo giorno di dieta dopo una sospensione — c'è solo negli stati di sospensione (23/8).
   *
   * ⚠️ Non è `availableFrom`: il menu del rientro si sblocca **un giorno prima** del rientro, come
   * il primo menu di un piano si sblocca due giorni prima della partenza. Sono due date, e dirle
   * tutt'e due è tutto il punto — «riprendi il 24, il menu ce l'hai il 23».
   */
  returnDate?: string | null;
}

/**
 * L'evento che apre il modulo delle misure da qualunque punto dell'app.
 *
 * Serve perché un banner che dice «serve la tua pesata» deve anche darle il posto dove inserirla,
 * nello stesso gesto. `MeasuresGate` è montato una volta sola in `App.tsx` e ascolta questo evento:
 * più semplice di uno stato condiviso, e non duplica il modulo di inserimento in due schermate.
 */
export const EVENTO_APRI_MISURE = 'metabole:apri-misure';

function itDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
}

/**
 * Messaggio + icona per ogni stato (available → nessun banner).
 *
 * `azione`, quando c'è, è il pulsante che risolve la cosa da lì: senza, un banner che chiede una
 * pesata lascia la cliente a cercare dove si inserisce.
 */
export function menuStatusView(
  s: MenuStatus,
): { icon: string; title: string; text: string; azione?: { etichetta: string } } | null {
  switch (s.state) {
    case 'expired':
      return {
        icon: 'ti-lock',
        title: 'Nessun piano attivo',
        text: 'Il tuo piano è terminato: al momento non hai un abbonamento attivo. Riattiva un piano dal Negozio per ricevere di nuovo i menu.',
      };
    /**
     * PIANO CHE COMINCIA PIÙ AVANTI. Qui la cliente ha scelto una data futura e non vede ancora
     * niente: le due informazioni che le servono sono QUANDO parte il piano e QUANDO si sblocca il
     * menu, e sono date diverse (il menu arriva 2 giorni prima, per farle fare la spesa).
     *
     * Prima il banner nominava **solo** la data di sblocco: la cliente leggeva «sarà disponibile il
     * 12» avendo scelto di partire il 14, e non c'era modo di capire da dove uscisse quel 12.
     * Richiesta di Simone del 10/8: qui deve comparire anche la data prevista di inizio, e l'invito
     * a chiedere a Gaia se la vuole spostare — perché è la cosa che si vuole fare guardando quella
     * schermata, e finora non esisteva nessuna strada per farlo dall'app.
     */
    case 'scheduled': {
      const inizio = s.planStartDate ? itDate(s.planStartDate) : null;
      const sblocco = s.availableFrom ? itDate(s.availableFrom) : null;
      const testo = inizio
        ? `Il tuo piano parte il ${inizio}` +
          (sblocco ? `, e il menu si sblocca il ${sblocco} — due giorni prima, così hai tempo per la spesa.` : '.')
        : sblocco
          ? `Sarà disponibile il ${sblocco}. Ti avvisiamo appena è pronto.`
          : 'Sarà disponibile a breve. Ti avvisiamo appena è pronto.';
      return {
        icon: 'ti-calendar-event',
        title: 'Il tuo menu sta arrivando',
        text: `${testo} Se vuoi cambiare la data di inizio, chiedi a Gaia in chat.`,
      };
    }
    /**
     * ⛔ **E QUANDO C'È UNA DATA, LA DATA SI DICE.**
     *
     * Dal 23/8 «serve una visita» ha un termine: fino a quel giorno compreso i menu arrivano, dal
     * giorno dopo il percorso si ferma. Se il blocco è scattato per quello, la frase generica —
     * «sarà pronto dopo la visita» — è vera ma inutile: non dice **da quando**, quindi non dice
     * nemmeno che è successo qualcosa oggi che ieri non era successo. Con la data, la cliente sa
     * cos'è cambiato e cosa deve chiedere quando chiama.
     */
    case 'awaiting_visit':
      if (s.visitaEntro) {
        return {
          icon: 'ti-stethoscope',
          title: 'Manca la visita',
          text:
            `I menu sono in pausa: la visita con il nutrizionista andava fatta entro il ${itDate(s.visitaEntro)}. ` +
            'Scrivi alla tua coach per fissarla — appena è fatta si riparte da dove eri.',
        };
      }
      return {
        icon: 'ti-stethoscope',
        title: 'Menu dopo la visita',
        text: 'Il tuo è un percorso supervisionato: il menu sarà pronto dopo la visita con il nutrizionista.',
      };
    case 'awaiting_measures':
      return {
        icon: 'ti-ruler-2',
        title: 'Inserisci le misure iniziali',
        text: 'Per generare il tuo menu servono le tue misure di partenza.',
        azione: { etichetta: 'Inserisci le misure' },
      };
    /**
     * LA PESATA DEL CICLO. Questo stato non esisteva: chi era trattenuto dal cancello delle misure
     * a metà percorso leggeva «Menu in preparazione — arriverà a breve», che è falso. Il menu non
     * arriva finché la pesata non c'è, e per una cliente a cui la coach ha appena riaperto l'app
     * (quindi senza popup) era l'unica informazione disponibile — sbagliata.
     */
    /**
     * ⛔ **LO STESSO STATO DICE DUE COSE, E LE DISTINGUE `returnDate`** (23/8).
     *
     * Il rientro da una sospensione è una ripartenza e vuole il suo punto A: il giorno prima si
     * chiede la pesata e il menu del primo giorno arriva subito. Poteva essere uno stato nuovo, e
     * **non lo è di proposito**: un'app pubblicata prima di questa modifica cadrebbe nel
     * `default: null` qui sotto, cioè mostrerebbe una schermata **vuota** proprio nel momento in
     * cui deve spiegare perché il menu non c'è. Riusando uno stato che tutte le app conoscono,
     * chi non si è ancora aggiornata legge la frase generica — vera comunque — e ha il pulsante.
     */
    case 'awaiting_cycle_measure': {
      const rientro = s.returnDate ? itDate(s.returnDate) : null;
      return {
        icon: 'ti-scale',
        title: rientro ? 'Si riparte: serve la tua pesata' : 'Serve la tua pesata',
        text: rientro
          ? `Il ${rientro} riprendi con la dieta. Inserisci la pesata adesso e trovi subito il menu del primo giorno, così fai la spesa con calma.`
          : 'I prossimi giorni si sbloccano con la pesata di questo ciclo: inseriscila e arrivano subito. Meglio al mattino, a digiuno.',
        azione: { etichetta: 'Inserisci la pesata' },
      };
    }
    /**
     * ⛔ **LA PAUSA ADESSO DICE QUANDO FINISCE** (23/8).
     *
     * Il testo di prima era «il menu riprende automaticamente al tuo rientro»: vero, e inutile.
     * La domanda che si fa una cliente in vacanza è *quando*, e la risposta ce l'avevamo — è la
     * data che l'operatrice ha scritto quando ha messo la sospensione. Dirla cambia anche cosa fa:
     * sapere che il menu arriva il giorno prima è quello che le fa trovare il frigo pieno.
     *
     * Se il backend non manda le date — una sospensione vecchia, un'app aggiornata prima del
     * server — resta la frase di sempre invece di una mezza frase con un buco.
     */
    case 'paused': {
      const rientro = s.returnDate ? itDate(s.returnDate) : null;
      const menuIl = s.availableFrom ? itDate(s.availableFrom) : null;
      return {
        icon: 'ti-plane',
        title: 'Menu in pausa',
        text: rientro
          ? `Sei in modalità viaggio: riprendi con la dieta il ${rientro}` +
            (menuIl ? `, e il menu del primo giorno ti arriva il ${menuIl} — così fai la spesa con calma.` : '.')
          : 'Sei in modalità viaggio: il menu riprende automaticamente al tuo rientro.',
      };
    }
    case 'blocked':
      return {
        icon: 'ti-heart-handshake',
        title: 'Stiamo personalizzando il tuo piano',
        text: 'La nutrizionista sta sistemando il tuo menu per rispettare le tue esclusioni.',
      };
    /**
     * IL PIANO FERMATO DAL NUTRIZIONISTA — e perché ha parole sue e non quelle di `blocked`.
     *
     * Prima l'unico modo di fermare un piano era la segnalazione «Piano bloccato», che dice alla
     * cliente che stiamo sistemando le sue **esclusioni alimentari**. Quando il piano è fermo per
     * un calo troppo rapido quella frase è falsa due volte: le indica un problema che non ha, e le
     * fa aspettare un menu che non arriverà finché nessuno la sente.
     *
     * Qui si dice la verità in una riga — una persona ha messo in pausa i giorni nuovi, e ti
     * cercherà — senza spaventarla con la ragione clinica, che è una cosa da dire parlando e non
     * da leggere in un banner. E si dice l'unica cosa che le serve subito: **i giorni che hai già
     * restano tuoi**, perché la prima paura davanti a un piano fermo è di aver perso quello che ha
     * pagato.
     */
    case 'plan_held':
      return {
        icon: 'ti-player-pause',
        title: 'Il tuo piano è in pausa',
        text: 'La nutrizionista ha messo in pausa i nuovi giorni e ti contatterà a breve. I giorni che hai già ricevuto restano disponibili: continua a seguirli come sempre.',
      };
    case 'preparing':
      return {
        icon: 'ti-tools-kitchen-2',
        title: 'Menu in preparazione',
        text: 'Il tuo menu è in preparazione e arriverà a breve.',
      };
    // Monitoraggio: i menu non arrivano, e dirlo chiaro vale più che lasciarlo intendere.
    // Chi paga €19 sta comprando il controllo del peso e la coach, non un piano alimentare:
    // se legge «in preparazione» aspetta qualcosa che non arriverà.
    case 'monitoring':
      return {
        icon: 'ti-heartbeat',
        title: 'Sei in monitoraggio',
        text: 'Qui teniamo d’occhio il tuo peso e la tua coach resta a disposizione. I menu tornano quando rientri in un percorso — e se il peso risale, te li prepariamo noi.',
      };
    default:
      return null; // available → nessun banner
  }
}

/**
 * ⛔ **IL PROMEMORIA DELLA VISITA, PRIMA CHE SCADA** — 23/8.
 *
 * In quella finestra la cliente riceve i menu normalmente: legge «il tuo menu è pronto», o niente. E
 * non sa che c'è una data oltre la quale si ferma tutto — il blocco le arriverebbe addosso come un
 * guasto, in un giorno qualunque, senza che nessuno gliel'abbia detto.
 *
 * ⚠️ **È un avviso a parte, non uno stato**: si affianca a quello che sta già leggendo invece di
 * sostituirlo. E ha un colore diverso dal banner verde: quello dice «tutto sta arrivando», questo
 * dice «c'è una cosa da fare entro una data». Due frasi con la stessa faccia si leggono come una
 * sola, e quella che si perde è la seconda.
 */
function AvvisoVisita({ entro }: { entro: string }) {
  return (
    <div
      className="card"
      style={{ background: '#FDF6E7', border: '1px solid #EED9A8', display: 'flex', gap: 11, alignItems: 'flex-start', marginBottom: 14 }}
    >
      <span className="event-ic" style={{ background: '#C9922B', color: '#fff', flex: 'none' }}>
        <i className="ti ti-stethoscope" />
      </span>
      <div>
        <b style={{ fontSize: 14, color: '#5C4410' }}>Ti aspettiamo per la visita</b>
        <div style={{ fontSize: 13, color: '#6E5A2B', marginTop: 2 }}>
          Va fatta <b>entro il {itDate(entro)}</b> con il nutrizionista. Fino a quel giorno i menu
          arrivano normalmente; dopo si fermano finché non l’hai fatta. Se non l’hai ancora fissata,
          scrivi alla tua coach.
        </div>
      </div>
    </div>
  );
}

/** Banner informativo mostrato quando il menu non è ancora visibile. */
export default function MenuStatusBanner({ status }: { status: MenuStatus }) {
  const v = menuStatusView(status);
  /**
   * ⚠️ **Il promemoria esce anche quando non c'è nessun banner** (`available`, cioè menu pronto): è
   * proprio quello il caso normale in questa finestra. Con un `if (!v) return null` prima, l'avviso
   * lo avrebbe visto solo chi era già fermo per un altro motivo — cioè quasi nessuno.
   */
  if (!v) return status.visitaDaFareEntro ? <AvvisoVisita entro={status.visitaDaFareEntro} /> : null;
  /**
   * ⚠️ E quando ci sono tutti e due si mostrano tutti e due: «il tuo piano parte il 3» e «la visita
   * va fatta entro il 30» sono due cose diverse, e sceglierne una vorrebbe dire nascondere l'altra.
   * Il promemoria sta **sopra**, perché è quello con una scadenza.
   */
  return (
    <>
      {status.visitaDaFareEntro && <AvvisoVisita entro={status.visitaDaFareEntro} />}
    <div
      className="card"
      style={{ background: '#F1F7F5', border: '1px solid #D6E7E1', display: 'flex', gap: 11, alignItems: 'flex-start', marginBottom: 14 }}
    >
      <span className="event-ic" style={{ background: 'var(--teal)', color: '#fff', flex: 'none' }}>
        <i className={`ti ${v.icon}`} />
      </span>
      <div>
        <b style={{ fontSize: 14, color: '#173A33' }}>{v.title}</b>
        <div style={{ fontSize: 13, color: '#42615A', marginTop: 2 }}>{v.text}</div>
        {v.azione && (
          <button
            className="btn"
            style={{ marginTop: 10, padding: '7px 13px', fontSize: 13 }}
            onClick={() => window.dispatchEvent(new Event(EVENTO_APRI_MISURE))}
          >
            <i className="ti ti-scale" /> {v.azione.etichetta}
          </button>
        )}
      </div>
    </div>
    </>
  );
}
