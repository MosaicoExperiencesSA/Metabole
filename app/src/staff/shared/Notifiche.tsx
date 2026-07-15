import { api } from '../../api/client';
import { relDays } from '../format';
import { useApi } from '../hooks';
import { Async, Card, Empty, StaffShell, type TabItem } from '../ui';

interface Notif {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

export default function Notifiche({ tabs }: { tabs: TabItem[] }) {
  const state = useApi<Notif[]>('/me/notifications');

  async function markRead(id: string) {
    try {
      await api(`/me/notifications/${id}/read`, { method: 'PATCH' });
    } catch {
      /* best-effort */
    }
    state.reload();
  }

  return (
    <StaffShell title="Notifiche" tabs={tabs}>
      <Async state={state} empty={<Empty icon="ti-bell-off" text="Nessuna notifica." />}>
        {(list) => (
          <Card className="pad0">
            {list.map((n) => (
              <div
                key={n.id}
                className="sf-row"
                onClick={() => !n.readAt && markRead(n.id)}
                style={{ alignItems: 'flex-start' }}
              >
                <span
                  className="sf-alert-ic"
                  style={{
                    background: n.readAt ? '#F2F5F4' : '#DCEBE3',
                    color: n.readAt ? '#8A938F' : '#0E7C66',
                  }}
                >
                  <i className="ti ti-bell" />
                </span>
                <div className="sf-row-main">
                  <div className="sf-row-name" style={{ fontWeight: n.readAt ? 600 : 800 }}>
                    {n.title || n.type}
                  </div>
                  {n.body && <div className="sf-row-sub">{n.body}</div>}
                  <div className="sf-row-sub" style={{ opacity: 0.7 }}>
                    {relDays(n.createdAt)}
                  </div>
                </div>
                {!n.readAt && (
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: '#12A386',
                      flex: 'none',
                    }}
                  />
                )}
              </div>
            ))}
          </Card>
        )}
      </Async>
    </StaffShell>
  );
}
