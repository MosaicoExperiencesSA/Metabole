import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { relDays } from '../format';
import { useApi } from '../hooks';
import { Async, Card, Empty, StaffShell, type TabItem } from '../ui';

interface Notif {
  id: string;
  type: string;
  /**
   * `clientId` c'è già nel payload di quasi tutte le notifiche staff — il backend lo manda da
   * sempre — ma qui veniva buttato via: si leggeva «Marta ha attivato la prova» e poi bisognava
   * andare a cercarla a mano nell'elenco clienti. Ora il tocco apre la scheda.
   */
  payload?: { title?: string; body?: string; clientId?: string } | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * @param schedaCliente Radice della scheda cliente per questo ruolo: `/clienti` per la coach,
 *   `/pazienti` per la nutrizionista. Le due app condividono questa pagina ma non le rotte.
 */
export default function Notifiche({ tabs, schedaCliente }: { tabs: TabItem[]; schedaCliente?: string }) {
  const nav = useNavigate();
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
                onClick={() => {
                  if (!n.readAt) void markRead(n.id);
                  const cid = n.payload?.clientId;
                  if (cid && schedaCliente) nav(`${schedaCliente}/${cid}`);
                }}
                style={{ alignItems: 'flex-start', cursor: n.payload?.clientId && schedaCliente ? 'pointer' : undefined }}
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
                    {n.payload?.title || n.type}
                  </div>
                  {n.payload?.body && <div className="sf-row-sub">{n.payload.body}</div>}
                  <div className="sf-row-sub" style={{ opacity: 0.7 }}>
                    {relDays(n.createdAt)}
                  </div>
                </div>
                {n.payload?.clientId && schedaCliente && (
                  <i className="ti ti-chevron-right chev" style={{ flex: 'none' }} />
                )}
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
