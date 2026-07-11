import { NavLink } from 'react-router-dom';

// Ordine e colori come nel prototipo definitivo: Menu · Obiettivo · Home · AI · Agenda.
// Home al centro è sempre un cerchio verde pieno; gli altri sono cerchi con l'icona
// del colore della sezione e, quando attivi, lo sfondo pastello.
const TABS = [
  { to: '/menu', icon: 'ti-chef-hat', label: 'Menu', color: '#B8863B', bg: '#F3E8DC', end: false, home: false },
  { to: '/obiettivo', icon: 'ti-target', label: 'Obiettivo', color: '#3A6EA5', bg: '#E7EEF6', end: false, home: false },
  { to: '/', icon: 'ti-home', label: 'Home', color: '#12A386', bg: '#DCEBE3', end: true, home: true },
  { to: '/assistente', icon: 'ti-sparkles', label: 'AI', color: '#6C5AB7', bg: '#ECE7F7', end: false, home: false },
  { to: '/calendario', icon: 'ti-calendar-heart', label: 'Agenda', color: '#E8825A', bg: '#FBEEE7', end: false, home: false },
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
          className="tab"
          style={({ isActive }) =>
            t.home
              ? { color: '#fff', background: '#12A386' }
              : { color: t.color, background: isActive ? t.bg : 'transparent' }
          }
        >
          <i className={`ti ${t.icon}`} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
