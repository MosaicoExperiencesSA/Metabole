import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Pager, Spinner, Toggle } from '../components/ui';
import { BottoneExcel, ContatoreRighe, useTabella, type Colonna } from '../components/tabella';

interface Template {
  key: string;
  name: string;
  subject: string;
  bodyHtml: string;
  active: boolean;
  updatedAt: string;
}

// Etichette dello stato: una volta sola, perché servono identiche nel chip e nella tendina del
// filtro di colonna, dove il confronto resta sul valore grezzo (`active`/`inactive`).
const STATO_LABEL: Record<string, string> = { active: 'Attivo', inactive: 'Disattivo' };
const stato = (t: Template) => (t.active ? 'active' : 'inactive');

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
  // Creazione di un modello che il seed non ha mai inserito: prima l'unico modo era
  // aggiungere una riga al seed e fare un deploy.
  const [nuovo, setNuovo] = useState(false);

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

  const COLONNE: Colonna<Template>[] = [
    { chiave: 'nome', titolo: 'Modello', valore: (m) => m.name, filtro: 'testo' },
    { chiave: 'oggetto', titolo: 'Oggetto', valore: (m) => m.subject, filtro: 'testo' },
    { chiave: 'stato', titolo: 'Stato', valore: stato, filtro: 'scelta', etichettaTutti: 'Tutti', etichetta: (v) => STATO_LABEL[v] ?? v },
    { chiave: 'azioni', titolo: 'Azioni', stile: { textAlign: 'right' } },
  ];

  const t = useTabella(rows, COLONNE, { testaFissa: true, ordineIniziale: { chiave: 'nome', direzione: 'asc' }, nomeExcel: 'Modelli email'});

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <p className="hint" style={{ marginTop: 0 }}>
          Personalizza il testo delle email. I segnaposto tra doppie graffe (es. <code>{'{{link}}'}</code>) vengono sostituiti all'invio.
        </p>
        <button className="btn" onClick={() => setNuovo(true)}><i className="ti ti-plus" /> Nuovo modello</button>
      </div>

      <div className="spread" style={{ marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="modelli" />
          <BottoneExcel tabella={t} />
        </div>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Cerca in tutte le colonne…"
          value={t.ricerca}
          onChange={(e) => t.setRicerca(e.target.value)}
        />
      </div>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        <Pager {...t.pager} sopra />
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">{rows.length === 0 ? 'Nessun modello.' : 'Nessun modello con questi filtri.'}</div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((m) => (
                <tr key={m.key}>
                  <td><b>{m.name}</b></td>
                  <td className="muted">{m.subject}</td>
                  <td><span className={`chip ${m.active ? '' : 'gray'}`}>{STATO_LABEL[stato(m)]}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn ghost sm" onClick={() => setEditing(m)}><i className="ti ti-edit" /> Modifica</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager {...t.pager} />
      </div>

      {nuovo && (
        <NewTemplateModal
          onClose={() => setNuovo(false)}
          onCreated={(creato) => { setRows((rs) => [...rs, creato].sort((a, b) => a.name.localeCompare(b.name, 'it'))); setNuovo(false); setNotice(`Modello "${creato.name}" creato. Ora puoi scriverne il testo.`); }}
        />
      )}

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


/**
 * Nuovo modello email. La CHIAVE è la parte che conta: deve essere identica a quella che il
 * codice passa a `resolve(...)` quando manda quell'email, altrimenti il modello resta lì e non
 * lo usa nessuno. Per questo la chiave si scrive una volta sola e poi non si tocca più.
 */
function NewTemplateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: Template) => void }) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('<p>Ciao {{name}},</p>\n<p>…</p>');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function crea() {
    setErr(null);
    setBusy(true);
    try {
      const t = await api<Template>('/admin/email/templates', {
        method: 'POST',
        body: JSON.stringify({ key: key.trim(), name: name.trim(), subject: subject.trim(), bodyHtml }),
      });
      onCreated(t);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Creazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nuovo modello email" onClose={onClose}>
      {err && <Banner kind="err">{err}</Banner>}
      <div className="field">
        <label>Chiave</label>
        <input className="input" style={{ width: '100%', fontFamily: 'monospace' }} value={key} onChange={(e) => setKey(e.target.value)} placeholder="es. lead_credentials" />
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Minuscole, numeri e underscore. Deve corrispondere esattamente alla chiave usata dal codice
          per quell'email: se non corrisponde, il modello non verrà mai usato. Non è modificabile dopo.
        </div>
      </div>
      <div className="field">
        <label>Nome (come lo vedi in elenco)</label>
        <input className="input" style={{ width: '100%' }} value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Credenziali di accesso (al lead)" />
      </div>
      <div className="field">
        <label>Oggetto</label>
        <input className="input" style={{ width: '100%' }} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="field">
        <label>Corpo (HTML)</label>
        <textarea className="input" style={{ width: '100%', minHeight: '28vh', resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={crea} disabled={busy || !key.trim() || !name.trim() || !subject.trim()}>{busy ? 'Creo…' : 'Crea modello'}</button>
      </div>
    </Modal>
  );
}

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
