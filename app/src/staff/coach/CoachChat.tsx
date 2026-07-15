import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { fullName, hourOnly, relDays } from '../format';
import { useApi } from '../hooks';
import { Async, Avatar, BackBar, Card, Empty, StaffShell, type TabItem } from '../ui';

interface Thread {
  id: string;
  counterpart: string | null;
  lastMessageAt: string | null;
  client: { id: string; email: string; clientProfile: { name: string | null } | null } | null;
}
interface Msg {
  id: string;
  senderRole: string;
  body: string;
  sentAt: string;
}

export function CoachChatList({ tabs }: { tabs: TabItem[] }) {
  const nav = useNavigate();
  const state = useApi<Thread[]>('/staff/threads');
  return (
    <StaffShell title="Chat" tabs={tabs}>
      <Async state={state} empty={<Empty icon="ti-message-off" text="Nessuna conversazione." />}>
        {(threads) => (
          <Card className="pad0">
            {threads.map((t) => {
              const name = t.client?.clientProfile?.name || fullName(t.counterpart, null, t.client?.email);
              return (
                <div
                  key={t.id}
                  className="sf-row"
                  onClick={() => nav(`/chat/${t.id}`, { state: { name } })}
                >
                  <Avatar name={name} />
                  <div className="sf-row-main">
                    <div className="sf-row-name">{name}</div>
                    <div className="sf-row-sub">
                      {t.lastMessageAt ? `Ultimo messaggio ${relDays(t.lastMessageAt)}` : 'Nessun messaggio'}
                    </div>
                  </div>
                  <i className="ti ti-chevron-right chev" />
                </div>
              );
            })}
          </Card>
        )}
      </Async>
    </StaffShell>
  );
}

export function CoachChatThread({ tabs }: { tabs: TabItem[] }) {
  const { threadId } = useParams();
  const loc = useLocation();
  const name = (loc.state as { name?: string } | null)?.name || 'Conversazione';
  const state = useApi<Msg[]>(threadId ? `/threads/${threadId}/messages` : null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'auto' });
  }, [state.data]);

  async function send() {
    const body = text.trim();
    if (!body || !threadId) return;
    setSending(true);
    try {
      await api(`/threads/${threadId}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
      setText('');
      state.reload();
    } catch {
      /* ignora: resta nel campo */
    } finally {
      setSending(false);
    }
  }

  return (
    <StaffShell title={name} tabs={tabs}>
      <BackBar label="Chat" to="/chat" />
      <Async state={state} empty={<Empty icon="ti-message" text="Scrivi il primo messaggio." />}>
        {(msgs) => (
          <div className="sf-chat-wrap">
            {msgs.map((m) => {
              const mine = m.senderRole !== 'client';
              return (
                <div key={m.id} className={'sf-bubble ' + (mine ? 'out' : 'in')}>
                  {m.body}
                  <div style={{ fontSize: 9, opacity: 0.6, marginTop: 3, textAlign: 'right' }}>
                    {hourOnly(m.sentAt)}
                  </div>
                </div>
              );
            })}
            <div ref={bottom} />
          </div>
        )}
      </Async>
      <div className="sf-chat-bar">
        <input
          className="sf-inp"
          placeholder="Scrivi un messaggio…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="sf-send" onClick={send} disabled={sending || !text.trim()}>
          <i className="ti ti-send" />
        </button>
      </div>
    </StaffShell>
  );
}
