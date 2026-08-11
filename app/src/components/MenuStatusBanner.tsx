// Stato del menu quando NON è ancora visibile: serve a rassicurare la cliente
// (spiega PERCHÉ e QUANDO arriva) invece di lasciarla pensare che l'app sia rotta.
// Lo stato è calcolato dal backend (GET /me/menu → `status`).
export interface MenuStatus {
  state: 'available' | 'scheduled' | 'awaiting_visit' | 'awaiting_measures' | 'awaiting_cycle_measure' | 'paused' | 'blocked' | 'plan_held' | 'preparing' | 'expired' | 'monitoring';
  availableFrom: string | null; // yyyy-mm-dd in cui il menu diventa visibile
  planStartDate: string | null;
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
    case 'awaiting_visit':
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
    case 'awaiting_cycle_measure':
      return {
        icon: 'ti-scale',
        title: 'Serve la tua pesata',
        text: 'I prossimi giorni si sbloccano con la pesata di questo ciclo: inseriscila e arrivano subito. Meglio al mattino, a digiuno.',
        azione: { etichetta: 'Inserisci la pesata' },
      };
    case 'paused':
      return {
        icon: 'ti-plane',
        title: 'Menu in pausa',
        text: 'Sei in modalità viaggio: il menu riprende automaticamente al tuo rientro.',
      };
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

/** Banner informativo mostrato quando il menu non è ancora visibile. */
export default function MenuStatusBanner({ status }: { status: MenuStatus }) {
  const v = menuStatusView(status);
  if (!v) return null;
  return (
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
  );
}
