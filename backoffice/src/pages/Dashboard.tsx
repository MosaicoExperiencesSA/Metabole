import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABEL } from '../lib/labels';
import { Banner, Modal } from '../components/ui';
import { DASHBOARD_MODULES, DEFAULT_MODULE_IDS, type DashboardModule } from '../lib/dashboardModules';
import { WalletWidget } from '../components/WalletWidget';

interface Shortcut {
  id: string;
  pageKey: string;
  to: string;
  icon: string;
  label: string;
  hint: string;
}

// Catalogo di tutte le scorciatoie possibili. Ognuna è filtrata per permesso.
const CATALOG: Shortcut[] = [
  { id: 'clienti', pageKey: 'clients', to: '/clienti', icon: 'ti-users', label: 'Clienti', hint: 'Percorsi in corso' },
  { id: 'crm_gestione', pageKey: 'crm_leads', to: '/crm/gestione', icon: 'ti-list-details', label: 'Gestione lead', hint: 'Lead e clienti' },
  { id: 'crm_pipeline', pageKey: 'crm_leads', to: '/crm/pipeline', icon: 'ti-layout-kanban', label: 'Pipeline', hint: 'Stato dei lead' },
  { id: 'crm_calendario', pageKey: 'crm_leads', to: '/crm/calendario', icon: 'ti-calendar-event', label: 'Calendario', hint: 'Promemoria' },
  { id: 'agenda', pageKey: 'visits_agenda', to: '/agenda', icon: 'ti-calendar', label: 'Agenda visite', hint: 'Televisite' },
  { id: 'segnalazioni', pageKey: 'escalations', to: '/segnalazioni', icon: 'ti-alert-triangle', label: 'Segnalazioni', hint: 'Da gestire' },
  { id: 'pagamenti', pageKey: 'accounting', to: '/pagamenti', icon: 'ti-cash', label: 'Bonifici', hint: 'Contabili da approvare' },
  { id: 'compensi', pageKey: 'compensation', to: '/compensi', icon: 'ti-coin', label: 'Compensi', hint: 'Provvigioni staff' },
  { id: 'diete', pageKey: 'diets_catalog', to: '/diete', icon: 'ti-salad', label: 'Catalogo diete', hint: 'Diete e ricette' },
  { id: 'protocolli', pageKey: 'engine_protocols', to: '/protocolli', icon: 'ti-cpu', label: 'Protocolli', hint: 'Motore a regole' },
  { id: 'utenti', pageKey: 'users', to: '/utenti', icon: 'ti-id-badge-2', label: 'Utenti', hint: 'Staff, ruoli, accessi' },
  { id: 'ruoli', pageKey: 'permissions', to: '/ruoli', icon: 'ti-shield-half', label: 'Ruoli', hint: 'Ruoli personalizzati' },
  { id: 'permessi', pageKey: 'permissions', to: '/permessi', icon: 'ti-lock-cog', label: 'Permessi', hint: 'Visibilità per ruolo' },
  { id: 'parametri', pageKey: 'engine_config', to: '/parametri', icon: 'ti-adjustments', label: 'Parametri', hint: 'Soglie motore' },
  { id: 'log', pageKey: 'audit_logs', to: '/log', icon: 'ti-history', label: 'Log attività', hint: 'Storico azioni' },
];

// Predefinite se l'utente non ha ancora personalizzato.
const DEFAULT_IDS = ['clienti', 'crm_gestione', 'pagamenti', 'agenda', 'utenti', 'permessi'];

export function Dashboard() {
  const { user, permissions, can } = useAuth();
  const available = CATALOG.filter((s) => can(s.pageKey));
  const [selected, setSelected] = useState<string[] | null>(null); // null = non ancora caricato
  const [modules, setModules] = useState<string[] | null>(null);
  const [previews, setPreviews] = useState<Record<string, { a: string; b?: string }[]>>({});
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const prefs = await api<{ dashboardShortcuts: string[] | null; dashboardModules: string[] | null }>('/me/preferences');
        setSelected(prefs.dashboardShortcuts ?? DEFAULT_IDS);
        setModules(prefs.dashboardModules ?? DEFAULT_MODULE_IDS);
      } catch {
        setSelected(DEFAULT_IDS); // se le preferenze non si caricano, mostro i predefiniti
        setModules(DEFAULT_MODULE_IDS);
      }
    })();
    api<Record<string, { a: string; b?: string }[]>>('/admin/dashboard/previews').then(setPreviews).catch(() => {});
  }, []);

  const chosen = selected ?? DEFAULT_IDS;
  const shown = available.filter((s) => chosen.includes(s.id));
  const chosenModules = modules ?? DEFAULT_MODULE_IDS;
  const shownModules = DASHBOARD_MODULES.filter((m) => can(m.pageKey) && chosenModules.includes(m.id));

  return (
    <>
      <div className="card" style={{ background: 'linear-gradient(120deg,var(--deep),var(--teal))', color: '#fff', border: 'none' }}>
        <h2 style={{ color: '#fff', fontSize: 20 }}>Ciao 👋</h2>
        <p style={{ margin: 0, opacity: 0.9 }}>
          {user?.email} · {permissions ? ROLE_LABEL[permissions.role] : ''}
        </p>
        <p style={{ marginTop: 10, marginBottom: 0, opacity: 0.85, fontSize: 14 }}>
          Benvenuta/o nel backoffice Metabole. Da qui gestisci utenti, permessi, pagamenti e i contenuti della piattaforma.
        </p>
      </div>

      <WalletWidget />

      <div className="card">
        <div className="spread" style={{ marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>Scorciatoie</h2>
          <button className="btn ghost sm" onClick={() => setEditing(true)}>
            <i className="ti ti-settings" /> Personalizza
          </button>
        </div>
        <p className="hint">Le sezioni che apri più spesso. Scegli tu quali mostrare.</p>

        {error && <Banner kind="err">{error}</Banner>}

        {shown.length === 0 ? (
          <div className="empty" style={{ padding: '28px 20px' }}>
            Nessuna scorciatoia. Aggiungile con “Personalizza”.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
            {shown.map((s) => (
              <Link
                key={s.id}
                to={s.to}
                style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 16, border: '1px solid var(--line)', borderRadius: 14, textDecoration: 'none', color: 'inherit' }}
              >
                <span style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--chip)', color: 'var(--chip-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <i className={`ti ${s.icon}`} style={{ fontSize: 22 }} />
                </span>
                <span>
                  <b style={{ display: 'block' }}>{s.label}</b>
                  <span className="muted" style={{ fontSize: 13 }}>{s.hint}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {shownModules.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginTop: 14 }}>
          {shownModules.map((m) => (
            <ModuleCard key={m.id} module={m} rows={previews[m.pageKey] ?? null} />
          ))}
        </div>
      )}

      {editing && (
        <CustomizeModal
          available={available}
          selected={chosen}
          onClose={() => setEditing(false)}
          onSaved={(ids) => { setSelected(ids); setEditing(false); }}
          onError={(m) => setError(m)}
        />
      )}
    </>
  );
}

function ModuleCard({ module: m, rows }: { module: DashboardModule; rows: { a: string; b?: string }[] | null }) {
  return (
    <Link to={m.to} className="card" style={{ display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'inherit', margin: 0 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--chip)', color: 'var(--chip-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <i className={`ti ${m.icon}`} style={{ fontSize: 22 }} />
        </span>
        <b style={{ fontSize: 16 }}>{m.label}</b>
      </div>
      {rows && rows.length > 0 ? (
        <div style={{ display: 'grid', gap: 2, flex: 1 }}>
          {rows.slice(0, 5).map((r, i) => (
            <div key={i} className="spread" style={{ fontSize: 13, padding: '5px 0', borderBottom: i < Math.min(rows.length, 5) - 1 ? '1px solid var(--line)' : 'none' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.a}</span>
              {r.b && <b style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>{r.b}</b>}
            </div>
          ))}
        </div>
      ) : (
        <span className="muted" style={{ fontSize: 13, flex: 1 }}>{rows && rows.length === 0 ? 'Nessun dato recente.' : m.preview}</span>
      )}
      <span style={{ display: 'block', marginTop: 10, color: 'var(--teal-dark)', fontSize: 13, fontWeight: 600 }}>Apri <i className="ti ti-arrow-right" /></span>
    </Link>
  );
}

function CustomizeModal({
  available,
  selected,
  onClose,
  onSaved,
  onError,
}: {
  available: Shortcut[];
  selected: string[];
  onClose: () => void;
  onSaved: (ids: string[]) => void;
  onError: (m: string) => void;
}) {
  const [draft, setDraft] = useState<string[]>(selected);
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  }

  async function save() {
    setSaving(true);
    try {
      const ordered = available.filter((s) => draft.includes(s.id)).map((s) => s.id);
      await api('/me/preferences', { method: 'PUT', body: JSON.stringify({ dashboardShortcuts: ordered }) });
      onSaved(ordered);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Personalizza le scorciatoie" onClose={onClose}>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Spunta le sezioni da mostrare in dashboard. Vengono salvate sul tuo profilo.
      </p>
      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
        {available.map((s) => {
          const on = draft.includes(s.id);
          return (
            <label key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', border: '1px solid var(--line)', background: on ? 'var(--chip)' : 'transparent' }}>
              <input type="checkbox" checked={on} onChange={() => toggle(s.id)} />
              <i className={`ti ${s.icon}`} style={{ fontSize: 18 }} />
              <span style={{ flex: 1 }}>
                <b style={{ display: 'block', fontSize: 14 }}>{s.label}</b>
                <span className="muted" style={{ fontSize: 12 }}>{s.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn ghost" onClick={onClose} disabled={saving}>Annulla</button>
        <button className="btn" onClick={save} disabled={saving}>
          <i className="ti ti-device-floppy" /> {saving ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>
    </Modal>
  );
}
