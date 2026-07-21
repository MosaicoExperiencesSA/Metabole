import { useState } from 'react';
import { api } from '../../api/client';

/**
 * Modale per scrivere e inviare un'email a un cliente/lead DALLA casella
 * @metabole.eu dell'operatore (collegata nel backoffice), non dal client di
 * posta personale. Invia via POST /me/mailbox/send (SMTP della casella).
 * Se la casella non è configurata, il backend risponde con un messaggio chiaro
 * che invitiamo a mostrare così com'è.
 */
export default function EmailComposeModal({ to, name, onClose }: { to: string; name: string; onClose: () => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function send() {
    setSaving(true);
    setErr(null);
    try {
      await api('/me/mailbox/send', {
        method: 'POST',
        body: JSON.stringify({ to, subject: subject.trim(), text: body }),
      });
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Invio non riuscito.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet-card" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        {!done ? (
          <>
            <b style={{ fontSize: 15 }}>Scrivi email · {name}</b>
            <p className="sf-sub" style={{ marginTop: 6 }}>
              A: <b>{to}</b> · parte dalla tua casella <b>@metabole.eu</b> del backoffice.
            </p>
            <input
              className="sf-inp"
              style={{ marginTop: 10 }}
              placeholder="Oggetto"
              maxLength={255}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <textarea
              className="sf-inp"
              style={{ minHeight: 130, marginTop: 8, resize: 'vertical' }}
              placeholder="Scrivi il messaggio…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            {err && <div className="sf-sub" style={{ color: '#B4491F', marginTop: 8 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="sf-btn p" style={{ flex: 1 }} disabled={saving || !subject.trim() || !body.trim()} onClick={send}>
                {saving ? 'Invio…' : 'Invia email'}
              </button>
              <button className="sf-btn g" style={{ flex: 1 }} onClick={onClose}>Annulla</button>
            </div>
          </>
        ) : (
          <>
            <b style={{ fontSize: 15 }}>Email inviata ✓</b>
            <p className="sf-sub" style={{ marginTop: 8 }}>Il messaggio è partito dalla tua casella verso <b>{to}</b>.</p>
            <button className="sf-btn p" style={{ width: '100%', marginTop: 12 }} onClick={onClose}>Chiudi</button>
          </>
        )}
      </div>
    </div>
  );
}
