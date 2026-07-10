import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', icon: 'ti-home', label: 'Home', end: true },
  { to: '/menu', icon: 'ti-salad', label: 'Menu', end: false },
  { to: '/calendario', icon: 'ti-calendar-heart', label: 'Calendario', end: false },
  { to: '/obiettivo', icon: 'ti-target', label: 'Obiettivo', end: false },
  { to: '/negozio', icon: 'ti-shopping-bag', label: 'Negozio', end: false },
];

export default function TabBar() {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
        >
          <i className={`ti ${t.icon}`} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
