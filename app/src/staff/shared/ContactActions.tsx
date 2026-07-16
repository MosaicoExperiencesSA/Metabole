import { useState } from 'react';
import { api } from '../../api/client';
import { waLink } from '../format';

/** Piccola icona-azione (link tel/mail/whatsapp oppure pulsante nota/promemoria). */
function ActionIcon({ icon, href, external, onClick, title }: { icon: string; href?: string; external?: boolean; onClick?: () => void; title: string }) {
  const base: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 10, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', flex: 'none', background: '#EEF3F1', color: '#0E6E5A',
    fontSize: 17, border: 'none', cursor: 'pointer', textDecoration: 'none',
  };
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  if (href) {
    return (
      <a href={href} title={title} aria-label={title} style={base} onClick={stop} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        <i className={`ti ${icon}`} />
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" title={title} aria-label={title} style={base} onClick={(e) => { stop(e); onClick(); }}>
        <i className={`ti ${icon}`} />
      </button>
    );
  }
  return <span title={`${title} non disponibile`} style={{ ...base, opacity: 0.35 }}><i className={`ti ${icon}`} /></span>;
}

/**
 * Azioni rapide su una riga cliente/paziente/lead: Chiama, WhatsApp, Email
 * (link diretti) + Inserisci nota / Promemoria (salvati come promemoria CRM,
 * collegati al lead via crmRecordId quando disponibile).
 */
export default function ContactActions({ name, phone, email, crmRecordId }: { name: string; phone: string | null; email: string | null; crmRecordId?: string }) {
  const [modal, setModal] = useState<'nota' | 'promemoria' | null>(null);
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const link = crmRecordId ? { crmRecordId } : {};
      if (modal === 'nota') {
        await api('/crm/reminders', {
          method: 'POST',
          body: JSON.stringify({ title: `Nota · ${name}`.slice(0, 160), note: text.trim(), dueAt: new Date().toISOString(), ...link }),
        });
      } else {
        await api('/crm/reminders', {
          method: 'POST',
          body: JSON.stringify({ title: text.trim().slice(0, 160), dueAt: new Date(due).toISOString(), ...link }),
        });
      }
      setModal(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <ActionIcon icon="ti-phone" title="Chiama" href={phone ? `tel:${phone}` : undefined} />
        <ActionIcon icon="ti-brand-whatsapp" title="WhatsApp" href={phone ? waLink(phone) : undefined} external />
        <ActionIcon icon="ti-mail" title="Email" href={email ? `mailto:${email}` : undefined} />
        <ActionIcon icon="ti-note" title="Inserisci nota" onClick={() => { setText(''); setErr(null); setModal('nota'); }} />
        <ActionIcon icon="ti-bell-plus" title="Promemoria" onClick={() => { setText(''); setDue(''); setErr(null); setModal('promemoria'); }} />
      </div>

      {modal && (
        <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="sheet-card" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" />
            <b style={{ fontSize: 15 }}>{modal === 'nota' ? 'Nuova nota' : 'Nuovo promemoria'} · {name}</b>
            <textarea
              className="sf-inp"
              style={{ minHeight: 70, marginTop: 10, resize: 'vertical' }}
              placeholder={modal === 'nota' ? 'Scrivi una nota…' : 'Cosa vuoi ricordare…'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {modal === 'promemoria' && (
              <input className="sf-inp" type="datetime-local" style={{ marginTop: 8 }} value={due} onChange={(e) => setDue(e.target.value)} />
            )}
            {err && <div className="sf-sub" style={{ color: '#B4491F', marginTop: 8 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="sf-btn p" style={{ flex: 1 }} disabled={saving || !text.trim() || (modal === 'promemoria' && !due)} onClick={save}>
                {saving ? 'Salvo…' : 'Salva'}
              </button>
              <button className="sf-btn g" style={{ flex: 1 }} onClick={() => setModal(null)}>Annulla</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
