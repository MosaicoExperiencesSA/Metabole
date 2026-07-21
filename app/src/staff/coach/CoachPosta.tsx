import { useState } from 'react';
import { api } from '../../api/client';
import { useApi } from '../hooks';
import { Async, Card, StaffShell } from '../ui';
import { COACH_TABS } from '../tabs';
import EmailComposeModal from '../shared/EmailComposeModal';

interface MailStatus { configured: boolean; email: string | null }
interface MailItem {
  uid: number;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  subject: string;
  date: string | null;
  seen: boolean;
}
interface FullMessage {
  uid: number;
  from: string;
  to: string;
  subject: string;
  date: string | null;
  text: string;
  html: string | null;
}

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

/** Estrae l'indirizzo da "Nome <a@b.it>" (o restituisce la stringa se già pulita). */
const addressOf = (s: string) => {
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim();
};

/** Corpo del messaggio: HTML in iframe isolato (niente script), altrimenti testo. */
function MessageBody({ html, text }: { html: string | null; text: string }) {
  if (html && html.trim()) {
    const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>html,body{margin:0;padding:0}body{font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2b2b2b;padding:2px;word-break:break-word}img{max-width:100%;height:auto}a{color:#0a7d55}pre{white-space:pre-wrap;word-break:break-word}</style>
</head><body>${html}</body></html>`;
    return (
      <iframe
        title="Messaggio"
        srcDoc={doc}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        style={{ width: '100%', height: '48vh', border: 0, borderRadius: 8, background: '#fff' }}
      />
    );
  }
  const body = (text || '').trim();
  if (!body) return <div className="sf-sub" style={{ padding: '8px 0' }}>(messaggio vuoto)</div>;
  return (
    <div style={{ maxHeight: '48vh', overflow: 'auto', fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {body}
    </div>
  );
}

/**
 * Posta della coach nell'app: casella @metabole.eu collegata nel backoffice.
 * Due schede — Ricevute e Inviate — con apertura del messaggio e risposta.
 * La configurazione della casella resta nel backoffice (Impostazioni → Posta).
 */
export default function CoachPosta() {
  const status = useApi<MailStatus>('/me/mailbox');
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const list = useApi<MailItem[]>(
    status.data?.configured ? `/me/mailbox/${tab === 'sent' ? 'sent' : 'inbox'}?limit=30` : null,
    [tab, status.data?.configured],
  );
  const [open, setOpen] = useState<FullMessage | null>(null);
  const [loadingUid, setLoadingUid] = useState<number | null>(null);
  const [reply, setReply] = useState<{ to: string; name: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function openMessage(it: MailItem) {
    setErr(null);
    setLoadingUid(it.uid);
    try {
      const msg = await api<FullMessage>(`/me/mailbox/message/${it.uid}?folder=${tab}`);
      setOpen(msg);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Apertura del messaggio non riuscita.');
    } finally {
      setLoadingUid(null);
    }
  }

  return (
    <StaffShell title="Posta" tabs={COACH_TABS}>
      <Async state={status}>
        {(st) =>
          !st.configured ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '10px 4px' }}>
                <div style={{ fontSize: 32, color: '#9aa6a2' }}><i className="ti ti-mail-off" /></div>
                <b style={{ display: 'block', marginTop: 6, fontSize: 15 }}>Casella non ancora collegata</b>
                <p className="sf-sub" style={{ marginTop: 8 }}>
                  Per vedere qui la posta devi collegare la tua casella <b>@metabole.eu</b> dal
                  <b> backoffice</b> (Impostazioni → Posta): bastano indirizzo e password.
                </p>
              </div>
            </Card>
          ) : (
            <>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div className="sf-sub" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <i className="ti ti-mail" /> {st.email}
                  </div>
                  <button className="sf-mini" onClick={() => list.reload()} disabled={list.loading}>
                    <i className="ti ti-refresh" /> Aggiorna
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    className={'sf-btn ' + (tab === 'inbox' ? 'p' : 'g')}
                    style={{ flex: 1 }}
                    onClick={() => setTab('inbox')}
                  >
                    Ricevute
                  </button>
                  <button
                    className={'sf-btn ' + (tab === 'sent' ? 'p' : 'g')}
                    style={{ flex: 1 }}
                    onClick={() => setTab('sent')}
                  >
                    Inviate
                  </button>
                </div>
              </Card>

              {err && <Card><div style={{ color: '#B4491F', fontSize: 13 }}>{err}</div></Card>}

              <Async state={list}>
                {(items) =>
                  items.length === 0 ? (
                    <Card><div className="sf-sub" style={{ textAlign: 'center', padding: 8 }}>Nessun messaggio.</div></Card>
                  ) : (
                    <Card>
                      {items.map((it, i) => {
                        const who = tab === 'sent' ? (it.toName || it.to) : (it.fromName || it.from);
                        return (
                          <button
                            key={it.uid}
                            type="button"
                            onClick={() => openMessage(it)}
                            disabled={loadingUid === it.uid}
                            style={{
                              display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
                              padding: '11px 2px', cursor: 'pointer',
                              borderTop: i === 0 ? 'none' : '1px solid #eef1f0',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <span style={{ fontWeight: it.seen || tab === 'sent' ? 500 : 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {tab === 'sent' ? 'A: ' : ''}{who || '—'}
                              </span>
                              <span className="sf-sub" style={{ flex: 'none', fontSize: 12 }}>
                                {loadingUid === it.uid ? '…' : fmtDate(it.date)}
                              </span>
                            </div>
                            <div className="sf-sub" style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {it.subject}
                            </div>
                          </button>
                        );
                      })}
                    </Card>
                  )
                }
              </Async>
            </>
          )
        }
      </Async>

      {open && (
        <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <div className="sheet-card" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" />
            <b style={{ fontSize: 15 }}>{open.subject || '(nessun oggetto)'}</b>
            <p className="sf-sub" style={{ marginTop: 6 }}>
              {tab === 'sent' ? <>A: <b>{open.to}</b></> : <>Da: <b>{open.from}</b></>} · {fmtDate(open.date)}
            </p>
            <div style={{ marginTop: 10 }}>
              <MessageBody html={open.html} text={open.text} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              {tab === 'inbox' && (
                <button
                  className="sf-btn p"
                  style={{ flex: 1 }}
                  onClick={() => { setReply({ to: addressOf(open.from), name: open.from }); setOpen(null); }}
                >
                  Rispondi
                </button>
              )}
              <button className="sf-btn g" style={{ flex: 1 }} onClick={() => setOpen(null)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {reply && (
        <EmailComposeModal to={reply.to} name={reply.name} onClose={() => setReply(null)} />
      )}
    </StaffShell>
  );
}
