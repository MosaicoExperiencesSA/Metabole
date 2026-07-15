import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Pager, Spinner, Toggle, usePagination } from '../components/ui';

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

  const pg = usePagination(rows, 100);

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
              {pg.pageItems.map((t) => (
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
        <Pager page={pg.page} totalPages={pg.totalPages} total={pg.total} from={pg.from} to={pg.to} onPage={pg.setPage} />
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

// Valori d'esempio per l'anteprima (sostituiscono i segnaposto {{...}}).
const SAMPLE: Record<string, string> = {
  nome: 'Anna', piano: 'Equilibrio Mediterraneo', evento: 'il tuo evento', nutrizionista: 'Dr.ssa Bianchi', coach: 'Gaia',
  data: '15/07/2026', link: '#', link_preferenze: '#', token: 'A1B2C3',
  amount: '€ 49,00', description: 'Abbonamento Metabole', date: '14/07/2026', paymentId: 'pay_12345',
  bankDetails: 'IBAN IT00 X000 …', reference: 'RIF-2026-001', clientName: 'Anna Rossi',
  title: 'Titolo della notifica', body: 'Testo della notifica.', period: 'Luglio 2026',
  lostThisMonth: '—', lostTotal: '—', currentWeight: '—', target: '—', checkins: '—', trend: '—',
};
const fillSample = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => SAMPLE[k] ?? `{{${k}}}`);

function EditTemplateModal({ template, onClose, onSaved }: { template: Template; onClose: () => void; onSaved: (t: Template) => void }) {
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.bodyHtml);
  const [active, setActive] = useState(template.active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'preview' | 'code'>('preview');

  // Segnaposto: quelli noti + quelli effettivamente presenti nel testo.
  const detected = Array.from(new Set([...`${subject} ${bodyHtml}`.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])));
  const vars = Array.from(new Set([...(PLACEHOLDERS[template.key] ?? []), ...detected]));

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

  const previewDoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;padding:0;background:#f4f1ea}body{font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2b2b2b}img{max-width:100%}</style></head><body>${fillSample(bodyHtml)}</body></html>`;

  return (
    <Modal title={`Modifica: ${template.name}`} onClose={onClose} wide>
      {error && <Banner kind="err">{error}</Banner>}
      {vars.length > 0 && (
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          Segnaposto: {vars.map((v) => <code key={v} style={{ marginRight: 6 }}>{`{{${v}}}`}</code>)} — nell'anteprima sono sostituiti da valori d'esempio.
        </p>
      )}
      <div className="field">
        <label>Oggetto</label>
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: '100%' }} />
        {view === 'preview' && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Anteprima oggetto: <b style={{ color: 'var(--ink,#2b2b2b)' }}>{fillSample(subject)}</b></div>}
      </div>

      <div className="field">
        <div className="spread" style={{ alignItems: 'center' }}>
          <label style={{ margin: 0 }}>Corpo</label>
          <div className="row" style={{ gap: 6 }}>
            <button className={`btn ${view === 'preview' ? '' : 'ghost'} sm`} onClick={() => setView('preview')}><i className="ti ti-eye" /> Anteprima</button>
            <button className={`btn ${view === 'code' ? '' : 'ghost'} sm`} onClick={() => setView('code')}><i className="ti ti-code" /> Codice HTML</button>
          </div>
        </div>
        {view === 'preview' ? (
          <iframe title="Anteprima email" srcDoc={previewDoc} sandbox="allow-popups allow-popups-to-escape-sandbox"
            style={{ width: '100%', height: '48vh', border: '1px solid var(--line,#eee)', borderRadius: 8, background: '#fff', marginTop: 6 }} />
        ) : (
          <textarea className="input" style={{ width: '100%', minHeight: '48vh', resize: 'vertical', fontFamily: 'monospace', fontSize: 13, marginTop: 6 }} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} />
        )}
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
