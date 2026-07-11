import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';

interface Template { key: string; name: string; html: string; placeholders: string[]; updatedAt: string | null; customized: boolean; }

/**
 * Editor della grafica dei PDF inviati ai clienti (ricevute, report mensile).
 * L'admin modifica l'HTML, vede l'anteprima renderizzata con dati d'esempio,
 * salva o ripristina il template di fabbrica.
 */
export function GraficaPdf() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeKey, setActiveKey] = useState<string>('');
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  const active = useMemo(() => templates.find((t) => t.key === activeKey) ?? null, [templates, activeKey]);
  const dirty = active ? html !== active.html : false;

  async function load() {
    setLoading(true);
    try {
      const list = await api<Template[]>('/admin/pdf-templates');
      setTemplates(list);
      if (list[0]) { setActiveKey((k) => k || list[0].key); }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può gestire la grafica dei PDF.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (active) setHtml(active.html); setPreviewUrl(null); }, [active]);

  function insertPlaceholder(ph: string) {
    const el = areaRef.current;
    const tag = `{{${ph}}}`;
    if (!el) { setHtml((h) => h + tag); return; }
    const start = el.selectionStart ?? html.length;
    const end = el.selectionEnd ?? html.length;
    const next = html.slice(0, start) + tag + html.slice(end);
    setHtml(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + tag.length; });
  }

  async function save() {
    if (!active) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      await api(`/admin/pdf-templates/${active.key}`, { method: 'PUT', body: JSON.stringify({ html }) });
      setTemplates((ts) => ts.map((t) => (t.key === active.key ? { ...t, html, customized: true } : t)));
      setNotice('Template salvato.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Salvataggio non riuscito.');
    } finally { setSaving(false); }
  }

  async function preview() {
    if (!active) return;
    setPreviewing(true); setError(null);
    try {
      const res = await api<{ contentBase64: string }>(`/admin/pdf-templates/${active.key}/preview`, { method: 'POST', body: JSON.stringify({ html }) });
      const bytes = Uint8Array.from(atob(res.contentBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Anteprima non riuscita. Se il problema persiste, il motore PDF (Chromium) potrebbe non essere disponibile sul server.");
    } finally { setPreviewing(false); }
  }

  async function reset() {
    if (!active) return;
    if (!confirm(`Ripristinare il template “${active.name}” alla grafica di fabbrica? Le modifiche salvate andranno perse.`)) return;
    setError(null); setNotice(null);
    try {
      const r = await api<Template>(`/admin/pdf-templates/${active.key}/reset`, { method: 'POST' });
      setTemplates((ts) => ts.map((t) => (t.key === active.key ? { ...t, html: r.html, customized: false } : t)));
      setHtml(r.html);
      setNotice('Template ripristinato ai valori di fabbrica.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ripristino non riuscito.');
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        Modifica l'HTML dei PDF inviati ai clienti. Usa i segnaposto (es. <code>{'{{total}}'}</code>): vengono sostituiti con i dati reali. L'anteprima usa dati d'esempio.
      </p>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {templates.map((t) => (
          <button key={t.key} className={`chip ${t.key === activeKey ? '' : 'ghost'}`} style={{ cursor: 'pointer', border: t.key === activeKey ? '2px solid var(--teal, #12a386)' : undefined }} onClick={() => setActiveKey(t.key)}>
            {t.name}{t.customized ? ' •' : ''}
          </button>
        ))}
      </div>

      {active && (
        <div className="card">
          <div className="spread" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>{active.name}</h2>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn ghost sm" onClick={reset}><i className="ti ti-restore" /> Ripristina</button>
              <button className="btn ghost sm" onClick={preview} disabled={previewing}><i className="ti ti-eye" /> {previewing ? 'Genero…' : 'Anteprima'}</button>
              <button className="btn sm" onClick={save} disabled={saving || !dirty}><i className="ti ti-device-floppy" /> {saving ? 'Salvo…' : 'Salva'}</button>
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Segnaposto disponibili (clicca per inserire):</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {active.placeholders.map((ph) => (
                <button key={ph} className="chip" style={{ cursor: 'pointer' }} onClick={() => insertPlaceholder(ph)}>{`{{${ph}}}`}</button>
              ))}
            </div>
          </div>

          <textarea
            ref={areaRef}
            className="input"
            style={{ width: '100%', minHeight: 320, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 13, resize: 'vertical' }}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            spellCheck={false}
          />

          {previewUrl && (
            <div style={{ marginTop: 14 }}>
              <div className="spread" style={{ marginBottom: 6 }}>
                <b>Anteprima</b>
                <a className="btn ghost sm" href={previewUrl} target="_blank" rel="noreferrer"><i className="ti ti-external-link" /> Apri in una scheda</a>
              </div>
              <iframe title="Anteprima PDF" src={previewUrl} style={{ width: '100%', height: 520, border: '1px solid var(--line)', borderRadius: 10 }} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
