import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABEL } from '../lib/labels';

/** Colore stabile derivato da una stringa (per lo sfondo dell'avatar a iniziali). */
const AVATAR_COLORS = ['#12a386', '#6c5ab7', '#e8825a', '#0e7c66', '#b8863b', '#993c1d'];
function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initialsFor(name: string | null | undefined, email: string): string {
  const src = (name && name.trim()) || email;
  const parts = src.replace(/@.*/, '').split(/[.\s_-]+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 2);
  return chars.toUpperCase();
}

/**
 * Menu utente nell'header del backoffice: avatar a iniziali → dropdown con
 * email/ruolo, Impostazioni e Logout (backlog #5). Foto profilo: futura.
 */
export function UserMenu() {
  const { user, permissions, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const email = user.email;
  const roleLabel = permissions ? ROLE_LABEL[permissions.role] : ROLE_LABEL[user.role] ?? '';
  const initials = initialsFor(user.firstName, email);

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate('/login');
  }

  return (
    <div className="usermenu" ref={ref}>
      <button
        className="usermenu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${email} · ${roleLabel}`}
      >
        <span className="usermenu-avatar" style={{ background: colorFor(email) }}>{initials}</span>
        <span className="usermenu-id">
          <b>{(user.firstName && user.firstName.trim()) || email}</b>
          <span className="muted">{roleLabel}</span>
        </span>
        <i className={`ti ti-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 15 }} />
      </button>

      {open && (
        <div className="usermenu-pop" role="menu">
          <div className="usermenu-head">
            <span className="usermenu-avatar lg" style={{ background: colorFor(email) }}>{initials}</span>
            <div style={{ minWidth: 0 }}>
              <div className="usermenu-email" title={email}>{email}</div>
              <div className="muted" style={{ fontSize: 12 }}>{roleLabel}</div>
            </div>
          </div>
          <button className="usermenu-item" role="menuitem" onClick={() => { setOpen(false); navigate('/impostazioni'); }}>
            <i className="ti ti-settings" /> Impostazioni
          </button>
          <button className="usermenu-item danger" role="menuitem" onClick={handleLogout}>
            <i className="ti ti-logout" /> Esci
          </button>
        </div>
      )}
    </div>
  );
}
