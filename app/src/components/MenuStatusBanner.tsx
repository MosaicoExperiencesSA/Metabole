// Stato del menu quando NON è ancora visibile: serve a rassicurare la cliente
// (spiega PERCHÉ e QUANDO arriva) invece di lasciarla pensare che l'app sia rotta.
// Lo stato è calcolato dal backend (GET /me/menu → `status`).
export interface MenuStatus {
  state: 'available' | 'scheduled' | 'awaiting_visit' | 'awaiting_measures' | 'paused' | 'blocked' | 'preparing';
  availableFrom: string | null; // yyyy-mm-dd in cui il menu diventa visibile
  planStartDate: string | null;
}

function itDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
}

/** Messaggio + icona per ogni stato (available → nessun banner). */
export function menuStatusView(s: MenuStatus): { icon: string; title: string; text: string } | null {
  switch (s.state) {
    case 'scheduled':
      return {
        icon: 'ti-calendar-event',
        title: 'Il tuo menu sta arrivando',
        text: s.availableFrom
          ? `Sarà disponibile il ${itDate(s.availableFrom)}. Ti avvisiamo appena è pronto.`
          : 'Sarà disponibile a breve. Ti avvisiamo appena è pronto.',
      };
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
        text: 'Per generare il tuo menu servono le tue misure di partenza: inseriscile dal popup misure.',
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
    case 'preparing':
      return {
        icon: 'ti-tools-kitchen-2',
        title: 'Menu in preparazione',
        text: 'Il tuo menu è in preparazione e arriverà a breve.',
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
      </div>
    </div>
  );
}
