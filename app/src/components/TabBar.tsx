import { NavLink } from 'react-router-dom';

// Ordine e icone come nel prototipo navigabile (docs/): Home · Percorso · Obiettivi · Contatti · Agenda.
// Solo icone; la tab attiva ha l'icona in un quadrato teal rialzato.
const TABS = [
  { to: '/', icon: 'ti-home', label: 'Home', end: true },
  { to: '/percorso', icon: 'ti-timeline-event', label: 'Percorso', end: false },
  { to: '/obiettivo', icon: 'ti-target-arrow', label: 'Obiettivi', end: false },
  { to: '/contatti', icon: 'ti-messages', label: 'Contatti', end: false },
  { to: '/calendario', icon: 'ti-calendar-heart', label: 'Agenda', end: false },
];

export default function TabBar() {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          title={t.label}
          aria-label={t.label}
          className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}
        >
          <i className={`ti ${t.icon}`} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
