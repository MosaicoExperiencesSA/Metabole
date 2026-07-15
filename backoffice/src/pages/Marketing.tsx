import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Spinner } from '../components/ui';

type Options = {
  lists: { id: string; name: string; color: string | null }[];
  stages: string[];
  tags: string[];
  templates: { key: string; name: string; subject: string }[];
};
type Filters = { stages: string[]; tags: string[]; listIds: string[]; hasClient: boolean | null; historicalPaid: boolean; city: string };
type Preview = { total: number; sample: { id: string; name: string | null; email: string | null; stage: string; tags: string[] }[] };
type CampaignRow = { id: string; title: string; templateKey: string; subject: string; recipientCount: number; sentCount: number; failedCount: number; createdAt: string };

const EMPTY: Filters = { stages: [], tags: [], listIds: [], hasClient: null, historicalPaid: false, city: '' };

export function Marketing() {
  const { user } = useAuth();
  const [opts, setOpts] = useState<Options | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [templateKey, setTemplateKey] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    api<Options>('/marketing/options').then(setOpts).catch((e) => setError(e instanceof Error ? e.message : 'Caricamento non riuscito.'));
    loadCampaigns();
  }, []);
  function loadCampaigns() { api<CampaignRow[]>('/marketing/campaigns').then(setCampaigns).catch(() => {}); }

  function toggle(key: 'stages' | 'tags' | 'listIds', v: string) {
    setFilters((f) => ({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] }));
    setPreview(null);
  }

  async function doPreview() {
    setBusy(true); setError(null);
    try { setPreview(await api<Preview>('/marketing/segments/preview', { method: 'POST', body: JSON.stringify({ filters }) })); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Anteprima non riuscita.'); }
    finally { setBusy(false); }
  }

  async function sendTest() {
    if (!templateKey) { setError('Scegli un modello email.'); return; }
    if (!user?.email) { setError('La tua email non è disponibile.'); return; }
    setBusy(true); setError(null); setNotice(null);
    try { await api('/marketing/campaigns/test', { method: 'POST', body: JSON.stringify({ templateKey, testEmail: user.email }) }); setNotice(`Email di prova inviata a ${user.email}.`); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Invio di prova non riuscito.'); }
    finally { setBusy(false); }
  }

  async function sendCampaign() {
    setConfirming(false); setBusy(true); setError(null); setNotice(null);
    try {
      const r = await api<{ recipientCount: number; sent: number; failed: number }>('/marketing/campaigns', { method: 'POST', body: JSON.stringify({ title, templateKey, filters }) });
      setNotice(`Campagna "${title}" inviata: ${r.sent} inviate, ${r.failed} fallite su ${r.recipientCount} destinatari.`);
      setTitle(''); setPreview(null); loadCampaigns();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Invio non riuscito.'); }
    finally { setBusy(false); }
  }

  const canSend = title.trim().length > 0 && !!templateKey && (preview?.total ?? 0) > 0;
  if (!opts) return <Spinner />;

  return (
    <>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {/* Segmentazione */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>1 · Crea il segmento</h2>
        <p className="hint" style={{ marginTop: 0 }}>Combina i filtri: appartenenza a una lista, etichette, stato pipeline e altri dati della scheda. Solo contatti con email.</p>

        <ChipGroup label="Liste" empty="Nessuna lista" items={opts.lists.map((l) => ({ v: l.id, l: l.name }))} sel={filters.listIds} onToggle={(v) => toggle('listIds', v)} />
        <ChipGroup label="Etichette" empty="Nessuna etichetta sulle schede" items={opts.tags.map((t) => ({ v: t, l: t }))} sel={filters.tags} onToggle={(v) => toggle('tags', v)} />
        <ChipGroup label="Stato (pipeline)" empty="—" items={opts.stages.map((s) => ({ v: s, l: s }))} sel={filters.stages} onToggle={(v) => toggle('stages', v)} />

        <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
          <label className="row" style={{ gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={filters.historicalPaid} onChange={(e) => { setFilters((f) => ({ ...f, historicalPaid: e.target.checked })); setPreview(null); }} />
            <span style={{ fontSize: 13 }}>Ha già pagato (storico)</span>
          </label>
          <label className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 13 }} className="muted">Tipo</span>
            <select className="select" value={filters.hasClient === null ? '' : filters.hasClient ? 'client' : 'lead'} onChange={(e) => { const v = e.target.value; setFilters((f) => ({ ...f, hasClient: v === '' ? null : v === 'client' })); setPreview(null); }} style={{ width: 150 }}>
              <option value="">Tutti</option>
              <option value="client">Solo clienti</option>
              <option value="lead">Solo lead</option>
            </select>
          </label>
          <label className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 13 }} className="muted">Città contiene</span>
            <input className="input" value={filters.city} onChange={(e) => { setFilters((f) => ({ ...f, city: e.target.value })); setPreview(null); }} placeholder="es. Milano" style={{ width: 160 }} />
          </label>
        </div>

        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button className="btn" onClick={doPreview} disabled={busy}><i className="ti ti-eye" /> Anteprima segmento</button>
          <button className="btn ghost" onClick={() => { setFilters(EMPTY); setPreview(null); }} disabled={busy}>Azzera filtri</button>
        </div>

        {preview && (
          <div style={{ marginTop: 14 }}>
            <Banner kind={preview.total > 0 ? 'info' : 'err'}><b>{preview.total.toLocaleString('it-IT')}</b> destinatari con email.</Banner>
            {preview.sample.length > 0 && (
              <div style={{ display: 'grid', gap: 4, marginTop: 8, maxHeight: 220, overflowY: 'auto' }}>
                {preview.sample.map((r) => (
                  <div key={r.id} className="row" style={{ gap: 8, fontSize: 12.5, padding: '4px 8px', borderRadius: 8, background: 'var(--chip)' }}>
                    <span style={{ flex: 1 }}>{r.name || '—'}</span>
                    <span className="muted">{r.email}</span>
                    <span className="muted">{r.stage}</span>
                  </div>
                ))}
                <span className="muted" style={{ fontSize: 11 }}>(anteprima dei primi {preview.sample.length})</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Campagna */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>2 · Invia la campagna</h2>
        <div style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
          <label style={{ display: 'block' }}>
            <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Titolo campagna</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="es. Promo settembre — clienti storici" />
          </label>
          <label style={{ display: 'block' }}>
            <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Modello email</span>
            <select className="select" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
              <option value="">— scegli un modello —</option>
              {opts.templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
          </label>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button className="btn ghost" onClick={sendTest} disabled={busy || !templateKey}><i className="ti ti-send" /> Invia una prova a me</button>
          <button className="btn" onClick={() => setConfirming(true)} disabled={busy || !canSend} title={canSend ? '' : 'Servono titolo, modello e un segmento con destinatari'}>
            <i className="ti ti-mail-forward" /> Invia campagna
          </button>
        </div>
      </div>

      {/* Storico */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Storico campagne</h2>
        {campaigns.length === 0 ? <div className="empty">Nessuna campagna inviata.</div> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {campaigns.map((c) => (
              <button key={c.id} onClick={() => setOpenId(c.id)} style={{ textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', cursor: 'pointer' }}>
                <i className="ti ti-mail" style={{ fontSize: 18, color: 'var(--deep)' }} />
                <span style={{ flex: 1 }}>
                  <b style={{ display: 'block', fontSize: 14 }}>{c.title}</b>
                  <span className="muted" style={{ fontSize: 12 }}>{new Date(c.createdAt).toLocaleString('it-IT')} · {c.recipientCount} destinatari · {c.sentCount} inviate{c.failedCount ? ` · ${c.failedCount} fallite` : ''}</span>
                </span>
                <i className="ti ti-chevron-right" style={{ color: 'var(--muted)' }} />
              </button>
            ))}
          </div>
        )}
      </div>

      <LifecycleAutomation />

      {confirming && (
        <Modal title="Confermi l'invio?" onClose={() => setConfirming(false)}>
          <p>Stai per inviare <b>“{title}”</b> a <b>{preview?.total ?? 0}</b> destinatari (modello: {opts.templates.find((t) => t.key === templateKey)?.name}). L'operazione è irreversibile.</p>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="btn ghost" onClick={() => setConfirming(false)}>Annulla</button>
            <button className="btn" onClick={sendCampaign}><i className="ti ti-mail-forward" /> Invia ora</button>
          </div>
        </Modal>
      )}

      {openId && <CampaignDetail id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

function ChipGroup({ label, items, sel, onToggle, empty }: { label: string; items: { v: string; l: string }[]; sel: string[]; onToggle: (v: string) => void; empty: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{label}</div>
      {items.length === 0 ? <span className="muted" style={{ fontSize: 12 }}>{empty}</span> : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {items.map((it) => (
            <button key={it.v} className="chip" onClick={() => onToggle(it.v)} style={{ cursor: 'pointer', borderColor: sel.includes(it.v) ? 'var(--teal)' : undefined, background: sel.includes(it.v) ? 'var(--chip)' : undefined }}>
              {sel.includes(it.v) && <i className="ti ti-check" style={{ fontSize: 13 }} />} {it.l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [c, setC] = useState<{ title: string; subject: string; bodyHtml: string; recipientCount: number; sentCount: number; failedCount: number; createdAt: string; recipients: { email: string; name: string | null }[] } | null>(null);
  const [stats, setStats] = useState<Record<string, number | boolean> | null>(null);

  useEffect(() => {
    api<typeof c>(`/marketing/campaigns/${id}`).then(setC).catch(() => {});
    api<Record<string, number | boolean>>(`/marketing/campaigns/${id}/stats`).then(setStats).catch(() => setStats({ available: false }));
  }, [id]);

  return (
    <Modal title={c?.title ?? 'Campagna'} onClose={onClose} wide>
      {!c ? <Spinner /> : (
        <>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{new Date(c.createdAt).toLocaleString('it-IT')} · {c.recipientCount} destinatari · {c.sentCount} inviate{c.failedCount ? ` · ${c.failedCount} fallite` : ''}</p>
          <h3 style={{ margin: '8px 0' }}>Statistiche di lettura (Brevo)</h3>
          {!stats || stats.available === false ? (
            <Banner kind="info">Statistiche non ancora disponibili (arrivano da Brevo qualche minuto dopo l'invio, o manca la BREVO_API_KEY).</Banner>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 8 }}>
              <Stat label="Consegnate" v={stats.delivered} />
              <Stat label="Aperture uniche" v={stats.uniqueOpens} />
              <Stat label="Click unici" v={stats.uniqueClicks} />
              <Stat label="Bounce (hard)" v={stats.hardBounces} />
              <Stat label="Bounce (soft)" v={stats.softBounces} />
              <Stat label="Disiscrizioni" v={stats.unsubscribed} />
              <Stat label="Segnalati spam" v={stats.spamReports} />
              <Stat label="Bloccate" v={stats.blocked} />
            </div>
          )}
          <h3 style={{ margin: '14px 0 6px' }}>Mail inviata</h3>
          <p className="muted" style={{ fontSize: 12, margin: '0 0 6px' }}>Oggetto: {c.subject}</p>
          <iframe title="anteprima" srcDoc={c.bodyHtml} sandbox="allow-popups allow-popups-to-escape-sandbox" style={{ width: '100%', height: 300, border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }} />
        </>
      )}
    </Modal>
  );
}

function Stat({ label, v }: { label: string; v: number | boolean | undefined }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{typeof v === 'number' ? v.toLocaleString('it-IT') : 0}</div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
}


interface LifecycleTrigger { key: string; label: string; when: string; kind: 'event' | 'scheduled'; implemented: boolean; on: boolean; sent: number; }
interface LifecycleOverview { enabled: boolean; lastRunAt: string | null; catalog: LifecycleTrigger[]; }

function LifecycleAutomation() {
  const [ov, setOv] = useState<LifecycleOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function load() { api<LifecycleOverview>('/marketing/lifecycle').then(setOv).catch(() => {}); }
  useEffect(load, []);

  async function setEnabled(enabled: boolean) {
    setBusy(true); setErr(null); setMsg(null);
    try { await api('/marketing/lifecycle', { method: 'PATCH', body: JSON.stringify({ enabled }) }); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Salvataggio non riuscito.'); }
    finally { setBusy(false); }
  }
  async function setTrigger(key: string, on: boolean) {
    setBusy(true); setErr(null); setMsg(null);
    try { await api('/marketing/lifecycle', { method: 'PATCH', body: JSON.stringify({ triggers: { [key]: on } }) }); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Salvataggio non riuscito.'); }
    finally { setBusy(false); }
  }
  async function runNow() {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await api<{ ran: boolean; counts: Record<string, number> }>('/marketing/lifecycle/run', { method: 'POST' });
      const tot = Object.values(r.counts || {}).reduce((a, b) => a + b, 0);
      setMsg(r.ran ? `Esecuzione completata: ${tot} email inviate.` : 'Nessun invio (nessun destinatario idoneo).');
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Esecuzione non riuscita.'); }
    finally { setBusy(false); }
  }

  if (!ov) return null;
  const active = ov.catalog.filter((t) => t.implemented);
  const roadmap = ov.catalog.filter((t) => !t.implemented);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Automazione email (ciclo di vita)</h2>
        <label className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={ov.enabled} disabled={busy} onChange={(e) => setEnabled(e.target.checked)} />
          <span style={{ fontWeight: 600, color: ov.enabled ? 'var(--teal)' : 'var(--muted)' }}>{ov.enabled ? 'Automazione attiva' : 'Automazione in pausa'}</span>
        </label>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        Con l'interruttore attivo, ogni ora il sistema invia da solo le email del ciclo di vita agli utenti idonei
        (rispettando gli opt-out e senza mai duplicare). Puoi accendere o spegnere ogni singolo innesco.
        {ov.lastRunAt && <> Ultima esecuzione: {new Date(ov.lastRunAt).toLocaleString('it-IT')}.</>}
      </p>

      {msg && <div className="banner ok" style={{ margin: '8px 0' }}>{msg}</div>}
      {err && <div className="banner err" style={{ margin: '8px 0' }}>{err}</div>}

      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        {active.map((t) => (
          <div key={t.key} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--card)' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: 13 }}>{t.label} <span className="chip" style={{ fontSize: 10 }}>{t.kind === 'event' ? 'evento' : 'programmata'}</span></b>
              <span className="muted" style={{ fontSize: 11 }}>{t.when} · {t.sent} inviate</span>
            </span>
            <label className="row" style={{ gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={t.on} disabled={busy || !ov.enabled} onChange={(e) => setTrigger(t.key, e.target.checked)} />
              <span className="muted" style={{ fontSize: 11 }}>{t.on ? 'ON' : 'OFF'}</span>
            </label>
          </div>
        ))}
      </div>

      <div className="row" style={{ gap: 10, marginTop: 12, alignItems: 'center' }}>
        <button className="btn" disabled={busy} onClick={runNow}><i className="ti ti-player-play" /> Esegui ora</button>
        <span className="muted" style={{ fontSize: 11 }}>Forza un giro subito (utile per una prova), anche a automazione in pausa.</span>
      </div>

      {roadmap.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary className="muted" style={{ fontSize: 12, cursor: 'pointer' }}>In arrivo — {roadmap.length} inneschi che richiedono dati non ancora tracciati</summary>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {roadmap.map((t) => (
              <span key={t.key} className="chip" style={{ fontSize: 11, opacity: 0.7 }} title={t.when}>{t.label}</span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
