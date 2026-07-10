import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABEL } from '../lib/labels';

export function Dashboard() {
  const { user, permissions, can } = useAuth();

  const shortcuts = [
    { key: 'users', to: '/utenti', icon: 'ti-id-badge-2', label: 'Utenti', hint: 'Staff, ruoli, accessi' },
    { key: 'permissions', to: '/permessi', icon: 'ti-lock-cog', label: 'Permessi', hint: 'Visibilità per ruolo' },
    { key: 'accounting', to: '/pagamenti', icon: 'ti-cash', label: 'Bonifici', hint: 'Contabili da approvare' },
    { key: 'clients', to: '/clienti', icon: 'ti-users', label: 'Clienti', hint: 'Percorsi in corso' },
  ].filter((s) => s.key === 'dashboard' || can(s.key));

  return (
    <>
      <div className="card" style={{ background: 'linear-gradient(120deg,#10403a,#12a386)', color: '#fff', border: 'none' }}>
        <h2 style={{ color: '#fff', fontSize: 20 }}>Ciao 👋</h2>
        <p style={{ margin: 0, opacity: 0.9 }}>
          {user?.email} · {permissions ? ROLE_LABEL[permissions.role] : ''}
        </p>
        <p style={{ marginTop: 10, marginBottom: 0, opacity: 0.85, fontSize: 14 }}>
          Benvenuta/o nel backoffice Metabole. Da qui gestisci utenti, permessi, pagamenti e i contenuti della piattaforma.
        </p>
      </div>

      <div className="card">
        <h2>Scorciatoie</h2>
        <p className="hint">Le sezioni che puoi aprire con il tuo ruolo.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
          {shortcuts.map((s) => (
            <Link
              key={s.key}
              to={s.to}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: 16,
                border: '1px solid var(--line)',
                borderRadius: 14,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <span
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'var(--chip)',
                  color: 'var(--chip-ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                }}
              >
                <i className={`ti ${s.icon}`} style={{ fontSize: 22 }} />
              </span>
              <span>
                <b style={{ display: 'block' }}>{s.label}</b>
                <span className="muted" style={{ fontSize: 13 }}>
                  {s.hint}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
