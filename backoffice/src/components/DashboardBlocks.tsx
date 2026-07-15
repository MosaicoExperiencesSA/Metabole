import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner } from './ui';
import { DASHBOARD_MODULES, DEFAULT_MODULE_IDS, DEFAULT_CHART_KEYS, type DashboardModule } from '../lib/dashboardModules';
import {
  CATALOG, DEFAULT_IDS, CustomizeModal, ModuleCard, GraficiModule, CalendarModule,
  type MonthPoint, type PreviewRow,
} from '../pages/Dashboard';

/**
 * Blocchi riutilizzabili della dashboard, così coach/nutrizionista/capo hanno la
 * STESSA struttura della dashboard generale: scorciatoie personalizzabili in alto,
 * moduli personalizzabili in fondo. Le preferenze sono le stesse (per profilo).
 */

/** Scorciatoie personalizzabili (in cima alla home). */
export function DashboardShortcuts() {
  const { can } = useAuth();
  const available = CATALOG.filter((s) => can(s.pageKey));
  const [selected, setSelected] = useState<string[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ dashboardShortcuts: string[] | null }>('/me/preferences')
      .then((p) => setSelected(p.dashboardShortcuts ?? DEFAULT_IDS))
      .catch(() => setSelected(DEFAULT_IDS));
  }, []);

  const chosen = selected ?? DEFAULT_IDS;
  const shown = available.filter((s) => chosen.includes(s.id));

  return (
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

      {editing && (
        <CustomizeModal
          available={available}
          selected={chosen}
          onClose={() => setEditing(false)}
          onSaved={(ids) => { setSelected(ids); setEditing(false); }}
          onError={(m) => setError(m)}
        />
      )}
    </div>
  );
}

/** Moduli personalizzabili (in fondo alla home). */
export function DashboardModules() {
  const { can } = useAuth();
  const [modules, setModules] = useState<string[] | null>(null);
  const [chartKeys, setChartKeys] = useState<string[] | null>(null);
  const [monthly, setMonthly] = useState<MonthPoint[] | null>(null);
  const [previews, setPreviews] = useState<Record<string, PreviewRow[]>>({});

  useEffect(() => {
    api<{ dashboardModules: string[] | null; dashboardCharts: string[] | null }>('/me/preferences')
      .then((p) => {
        setModules(p.dashboardModules ?? DEFAULT_MODULE_IDS);
        setChartKeys(p.dashboardCharts?.length ? p.dashboardCharts : DEFAULT_CHART_KEYS);
      })
      .catch(() => { setModules(DEFAULT_MODULE_IDS); setChartKeys(DEFAULT_CHART_KEYS); });
    api<Record<string, PreviewRow[]>>('/admin/dashboard/previews').then(setPreviews).catch(() => {});
    if (can('charts')) api<{ monthly: MonthPoint[] }>('/admin/charts').then((d) => setMonthly(d.monthly ?? [])).catch(() => setMonthly([]));
  }, []);

  const chosenModules = modules ?? DEFAULT_MODULE_IDS;
  const shownModules = chosenModules
    .map((id) => DASHBOARD_MODULES.find((m) => m.id === id))
    .filter((m): m is DashboardModule => !!m && can(m.pageKey));

  async function saveCharts(keys: string[]) {
    setChartKeys(keys);
    try { await api('/me/preferences', { method: 'PUT', body: JSON.stringify({ dashboardCharts: keys }) }); }
    catch { /* preferenza già applicata localmente */ }
  }

  if (shownModules.length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginTop: 14 }}>
      {shownModules.map((m) =>
        m.id === 'm_grafici' ? (
          <GraficiModule key={m.id} module={m} monthly={monthly} chartKeys={chartKeys ?? DEFAULT_CHART_KEYS} onSave={saveCharts} />
        ) : m.id === 'm_calendario' ? (
          <CalendarModule key={m.id} module={m} />
        ) : (
          <ModuleCard key={m.id} module={m} rows={previews[m.previewKey ?? m.pageKey] ?? null} />
        ),
      )}
    </div>
  );
}
