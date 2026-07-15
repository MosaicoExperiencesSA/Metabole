import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Pager, Spinner, usePagination } from '../components/ui';

interface AuditRow {
  id: string;
  action: string;
  actorId: string | null;
  actor: { email: string; firstName: string | null; lastName: string | null; role: string } | null;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: string;
}

const dateTime = (s: string) => new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Etichette leggibili per le azioni più comuni; le altre si mostrano così come sono. */
const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'Accesso',
  'auth.login_failed': 'Accesso fallito',
  'auth.register': 'Registrazione',
  'auth.logout': 'Uscita',
  'onboarding.completed': 'Questionario completato',
  'client.hard_delete': 'Cliente eliminato',
  'client.note.delete': 'Nota eliminata',
  'client.password_reset.trigger': 'Reset password inviato',
  'config_param.update': 'Parametro aggiornato',
  'lead.assign.refcode': 'Assegnazione da ref code',
  'staff.refcode.generate': 'Ref code generato',
};

function actorLabel(r: AuditRow): string {
  if (!r.actor) return r.actorId ? 'utente rimosso' : 'sistema';
  const name = [r.actor.firstName, r.actor.lastName].filter(Boolean).join(' ');
  return name || r.actor.email;
}

export function LogAttivita() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api<{ items: AuditRow[] }>('/admin/audit-logs?limit=200');
        setRows(res.items);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) setError('Sezione riservata agli amministratori.');
        else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.action.toLowerCase().includes(q) ||
        (ACTION_LABEL[r.action] ?? '').toLowerCase().includes(q) ||
        actorLabel(r).toLowerCase().includes(q) ||
        (r.entityType ?? '').toLowerCase().includes(q),
    );
  }, [rows, filter]);

  const pg = usePagination(filtered, 100);

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 14 }}>
        <p className="muted" style={{ margin: 0 }}>Ultime 200 azioni registrate (audit).</p>
        <input className="input" style={{ maxWidth: 280 }} placeholder="Filtra per azione, utente…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty">Nessuna attività registrata.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Data e ora</th>
                <th>Azione</th>
                <th>Chi</th>
                <th>Su cosa</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {pg.pageItems.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{dateTime(r.createdAt)}</td>
                  <td>{ACTION_LABEL[r.action] ?? r.action}</td>
                  <td>{actorLabel(r)}</td>
                  <td className="muted">{r.entityType ? `${r.entityType}${r.entityId ? ` · ${r.entityId.slice(0, 8)}…` : ''}` : '—'}</td>
                  <td className="muted">{r.ipAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager page={pg.page} totalPages={pg.totalPages} total={pg.total} from={pg.from} to={pg.to} onPage={pg.setPage} />
      </div>
    </>
  );
}
