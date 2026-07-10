import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Spinner, Toggle } from '../components/ui';

interface Template {
  key: string;
  name: string;
  subject: string;
  bodyHtml: string;
  active: boolean;
  updatedAt: string;
}

// Segnaposto disponibili per ogni modello.
const PLACEHOLDERS: Record<string, string[]> = {
  email_verification: ['link', 'token'],
  password_reset: ['link', 'token'],
  bank_transfer: ['description', 'amount', 'bankDetails', 'reference'],
  payment_receipt: ['description', 'amount', 'date', 'paymentId'],
  notification: ['title', 'body'],
  client_assigned_nutritionist: ['clientName'],
  monthly_report: ['name', 'period', 'lostThisMonth', 'lostTotal', 'currentWeight', 'target', 'checkins', 'trend'],
};

export function ModelliEmail() {
  const [rows, setRows] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await api<Template[]>('/admin/email/templates'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata agli amministratori.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  if (loading) return <Spinner />;

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        Personalizza il testo delle email. I segnaposto tra doppie graffe (es. <code>{'{{link}}'}</code>) vengono sostituiti all'invio.
      </p>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty">Nessun modello.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Modello</th>
                <th>Oggetto</th>
                <th>Stato</th>
                <th style={{ textAlign: 'right' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.key}>
                  <td><b>{t.name}</b></td>
                  <td className="muted">{t.subject}</td>
                  <td><span className={`chip ${t.active ? '' : 'gray'}`}>{t.active ? 'Attivo' : 'Disattivo'}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn ghost sm" onClick={() => setEditing(t)}><i className="ti ti-edit" /> Modifica</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <EditTemplateModal
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setRows((rs) => rs.map((x) => (x.key === saved.key ? saved : x)));
            setEditing(null);
            setNotice(`Modello "${saved.name}" salvato.`);
          }}
        />
      )}
    </>
  );
}

function EditTemplateModal({ template, onClose, onSaved }: { template: Template; onClose: () => void; onSaved: (t: Template) => void }) {
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.bodyHtml);
  const [active, setActive] = useState(template.active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vars = PLACEHOLDERS[template.key] ?? [];

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const saved = await api<Template>(`/admin/email/templates/${template.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ subject, bodyHtml, active }),
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Modifica: ${template.name}`} onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      {vars.length > 0 && (
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          Segnaposto disponibili: {vars.map((v) => <code key={v} style={{ marginRight: 6 }}>{`{{${v}}}`}</code>)}
        </p>
      )}
      <div className="field">
        <label>Oggetto</label>
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: '100%' }} />
      </div>
      <div className="field">
        <label>Corpo (HTML)</label>
        <textarea className="input" style={{ width: '100%', minHeight: 220, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} />
      </div>
      <label className="row" style={{ gap: 10, alignItems: 'center', marginTop: 4 }}>
        <Toggle on={active} onChange={setActive} />
        <span>Attivo {active ? '(si usa questo testo)' : '(si usa il testo predefinito)'}</span>
      </label>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Salvataggio…' : 'Salva'}</button>
      </div>
    </Modal>
  );
}
