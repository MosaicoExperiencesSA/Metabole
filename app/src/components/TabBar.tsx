import { NavLink } from 'react-router-dom';

// Home al centro (rialzata, cerchio verde) come una barra flottante moderna.
const TABS = [
  { to: '/menu', icon: 'ti-chef-hat', label: 'Menu', end: false, center: false },
  { to: '/obiettivo', icon: 'ti-target', label: 'Obiettivo', end: false, center: false },
  { to: '/', icon: 'ti-home', label: 'Home', end: true, center: true },
  { to: '/negozio', icon: 'ti-shopping-bag', label: 'Negozio', end: false, center: false },
  { to: '/calendario', icon: 'ti-calendar-heart', label: 'Calendario', end: false, center: false },
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
          className={({ isActive }) => `tab${t.center ? ' home' : ''}${isActive ? ' active' : ''}`}
        >
          <i className={`ti ${t.icon}`} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
