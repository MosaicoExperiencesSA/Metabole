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
type Filters = { stages: string[]; tags: string[]; listIds: string[]; excludeTags: string[]; excludeStages: string[]; segment: '' | 'client' | 'historical' | 'lead'; historicalPaid: boolean; city: string };
type Preview = { total: number; sample: { id: string; name: string | null; email: string | null; stage: string; tags: string[] }[] };
type CampaignRow = { id: string; title: string; templateKey: string; subject: string; recipientCount: number; sentCount: number; failedCount: number; status?: string; scheduledFor?: string | null; nextBatchAt?: string | null; batchSize?: number; pauseMinutes?: number; cursor?: number; createdAt: string };

const EMPTY: Filters = { stages: [], tags: [], listIds: [], excludeTags: [], excludeStages: [], segment: '', historicalPaid: false, city: '' };

const CAMPAIGN_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Programmata', color: '#8A5A00', bg: '#FDECC8' },
  sending: { label: 'In invio', color: '#1F5FA8', bg: '#DCE9F8' },
  sent: { label: 'Inviata', color: '#3B6D11', bg: '#DCF0D8' },
  canceled: { label: 'Annullata', color: '#B3261E', bg: '#FBE0DE' },
};

export function Marketing() {
  const { user } = useAuth();
  const [opts, setOpts] = useState<Options | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  // Importo storico speso (in euro, campi liberi): convertito in centesimi nel payload.
  const [histMin, setHistMin] = useState('');
  const [histMax, setHistMax] = useState('');

  const euroToCents = (v: string): number | undefined => {
    const n = Number(v.replace(',', '.'));
    return v.trim() !== '' && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : undefined;
  };
  const filtersPayload = () => ({ ...filters, historicalPaidMinCents: euroToCents(histMin), historicalPaidMaxCents: euroToCents(histMax) });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [templateKey, setTemplateKey] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  // Invio: subito o programmato + throttle a lotti (invia N, pausa M minuti).
  const [sendMode, setSendMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledFor, setScheduledFor] = useState('');
  const [throttle, setThrottle] = useState(true);
  const [batchSize, setBatchSize] = useState(50);
  const [pauseMinutes, setPauseMinutes] = useState(10);
  // Azione post-invio: sui destinatari effettivamente inviati aggiungi un'etichetta e/o cambia stato pipeline.
  const [postTag, setPostTag] = useState('');
  const [postStage, setPostStage] = useState('');

  useEffect(() => {
    api<Options>('/marketing/options').then(setOpts).catch((e) => setError(e instanceof Error ? e.message : 'Caricamento non riuscito.'));
    loadCampaigns();
  }, []);
  function loadCampaigns() { api<CampaignRow[]>('/marketing/campaigns').then(setCampaigns).catch(() => {}); }

  function toggle(key: 'stages' | 'tags' | 'listIds' | 'excludeTags' | 'excludeStages', v: string) {
    setFilters((f) => ({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] }));
    setPreview(null);
  }

  async function doPreview() {
    setBusy(true); setError(null);
    try { setPreview(await api<Preview>('/marketing/segments/preview', { method: 'POST', body: JSON.stringify({ filters: filtersPayload() }) })); }
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
    const body: Record<string, unknown> = { title, templateKey, filters: filtersPayload() };
    if (sendMode === 'scheduled' && scheduledFor) body.scheduledFor = new Date(scheduledFor).toISOString();
    if (throttle) { body.batchSize = batchSize; body.pauseMinutes = pauseMinutes; }
    if (postTag.trim()) body.postTag = postTag.trim();
    if (postStage) body.postStage = postStage;
    try {
      const r = await api<{ recipientCount: number; sent?: number; failed?: number; scheduled?: boolean; scheduledFor?: string; done?: boolean }>('/marketing/campaigns', { method: 'POST', body: JSON.stringify(body) });
      if (r.scheduled) {
        setNotice(`Campagna "${title}" programmata per ${new Date(r.scheduledFor ?? scheduledFor).toLocaleString('it-IT')} su ${r.recipientCount} destinatari.`);
      } else if (r.done) {
        setNotice(`Campagna "${title}" inviata: ${r.sent} inviate, ${r.failed} fallite su ${r.recipientCount} destinatari.`);
      } else {
        setNotice(`Campagna "${title}" avviata: primo lotto di ${r.sent} inviate${r.failed ? `, ${r.failed} fallite` : ''}. I ${r.recipientCount} destinatari verranno completati a lotti.`);
      }
      setTitle(''); setPreview(null); setScheduledFor(''); setPostTag(''); setPostStage(''); loadCampaigns();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Invio non riuscito.'); }
    finally { setBusy(false); }
  }

  async function cancelCampaign(id: string) {
    if (!confirm('Annullare la campagna? I lotti non ancora inviati non partiranno.')) return;
    try { await api(`/marketing/campaigns/${id}/cancel`, { method: 'POST' }); loadCampaigns(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Annullamento non riuscito.'); }
  }

  const scheduleValid = sendMode === 'now' || (!!scheduledFor && new Date(scheduledFor).getTime() > Date.now() - 60_000);
  const canSend = title.trim().length > 0 && !!templateKey && (preview?.total ?? 0) > 0 && scheduleValid;
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
        {/* Esclusioni: utili con l'azione post-invio (es. escludi chi ha già l'etichetta della campagna precedente). */}
        <ChipGroup label="Escludi etichette" empty="Nessuna etichetta sulle schede" items={opts.tags.map((t) => ({ v: t, l: t }))} sel={filters.excludeTags} onToggle={(v) => toggle('excludeTags', v)} />
        <ChipGroup label="Escludi stati" empty="—" items={opts.stages.map((s) => ({ v: s, l: s }))} sel={filters.excludeStages} onToggle={(v) => toggle('excludeStages', v)} />

        <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
          <label className="row" style={{ gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={filters.historicalPaid} onChange={(e) => { setFilters((f) => ({ ...f, historicalPaid: e.target.checked })); setPreview(null); }} />
            <span style={{ fontSize: 13 }}>Ha già pagato (storico)</span>
          </label>
          <label className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 13 }} className="muted">Tipo persona</span>
            <select className="select" value={filters.segment} onChange={(e) => { const v = e.target.value as Filters['segment']; setFilters((f) => ({ ...f, segment: v })); setPreview(null); }} style={{ width: 160 }} title="Cliente = attivo su Metabole · Storico = pagamenti pre-Metabole · Lead = nessun pagamento">
              <option value="">Tutti</option>
              <option value="client">Solo clienti</option>
              <option value="historical">Solo clienti storici</option>
              <option value="lead">Solo lead</option>
            </select>
          </label>
          <label className="row" style={{ gap: 6, alignItems: 'center' }} title="Totale già pagato pre-Metabole (dalla scheda/import). Chi non ha lo storico resta fuori dal range.">
            <span style={{ fontSize: 13 }} className="muted">Storico speso da €</span>
            <input className="input" inputMode="decimal" value={histMin} onChange={(e) => { setHistMin(e.target.value); setPreview(null); }} placeholder="es. 100" style={{ width: 90 }} />
            <span style={{ fontSize: 13 }} className="muted">a €</span>
            <input className="input" inputMode="decimal" value={histMax} onChange={(e) => { setHistMax(e.target.value); setPreview(null); }} placeholder="es. 1000" style={{ width: 90 }} />
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

          {/* Quando inviare: subito o programmato */}
          <div>
            <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Quando inviare</span>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="chip" onClick={() => setSendMode('now')} style={{ cursor: 'pointer', borderColor: sendMode === 'now' ? 'var(--teal)' : undefined, background: sendMode === 'now' ? 'var(--chip)' : undefined }}>
                <i className="ti ti-bolt" /> Invia ora
              </button>
              <button type="button" className="chip" onClick={() => setSendMode('scheduled')} style={{ cursor: 'pointer', borderColor: sendMode === 'scheduled' ? 'var(--teal)' : undefined, background: sendMode === 'scheduled' ? 'var(--chip)' : undefined }}>
                <i className="ti ti-calendar-clock" /> Programma
              </button>
            </div>
            {sendMode === 'scheduled' && (
              <input className="input" type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} style={{ marginTop: 8, maxWidth: 260 }} />
            )}
          </div>

          {/* Throttle: invia N e-mail, poi pausa di M minuti */}
          <div>
            <label className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={throttle} onChange={(e) => setThrottle(e.target.checked)} />
              <span style={{ fontSize: 13 }}>Invia a lotti (consigliato)</span>
            </label>
            {throttle && (
              <div className="row" style={{ gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <span className="muted" style={{ fontSize: 12 }}>invia</span>
                <input className="input" type="number" min={1} max={5000} value={batchSize} onChange={(e) => setBatchSize(Math.max(1, Number(e.target.value) || 1))} style={{ width: 90 }} />
                <span className="muted" style={{ fontSize: 12 }}>e-mail, poi pausa di</span>
                <input className="input" type="number" min={0} max={1440} value={pauseMinutes} onChange={(e) => setPauseMinutes(Math.max(0, Number(e.target.value) || 0))} style={{ width: 80 }} />
                <span className="muted" style={{ fontSize: 12 }}>minuti</span>
              </div>
            )}
            <p className="muted" style={{ fontSize: 11.5, margin: '6px 0 0' }}>
              {throttle
                ? `~${pauseMinutes > 0 ? Math.round((batchSize / pauseMinutes) * 60) : batchSize} e-mail/ora: invii diluiti, meglio per la reputazione del mittente.`
                : 'Tutte le e-mail partono insieme: veloce, ma su liste grandi può penalizzare la consegna.'}
            </p>
          </div>

          {/* Azione post-invio: applicata solo a chi ha ricevuto davvero l'email */}
          <div>
            <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Dopo l'invio (facoltativo)</span>
            <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: 12 }}>Aggiungi etichetta</span>
                <input className="input" list="post-tag-options" value={postTag} onChange={(e) => setPostTag(e.target.value)} placeholder="es. promo-set-26" maxLength={40} style={{ width: 180 }} />
                <datalist id="post-tag-options">
                  {opts.tags.map((t) => <option key={t} value={t} />)}
                </datalist>
              </label>
              <label className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: 12 }}>Sposta allo stato</span>
                <select className="select" value={postStage} onChange={(e) => setPostStage(e.target.value)} style={{ width: 180 }}>
                  <option value="">— non cambiare —</option>
                  {opts.stages.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <p className="muted" style={{ fontSize: 11.5, margin: '6px 0 0' }}>
              L'azione si applica solo ai contatti a cui l'email è stata inviata davvero (le fallite restano com'erano). Con l'etichetta puoi poi escluderli dalla campagna successiva usando «Escludi etichette» nel segmento.
            </p>
          </div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button className="btn ghost" onClick={sendTest} disabled={busy || !templateKey}><i className="ti ti-send" /> Invia una prova a me</button>
          <button className="btn" onClick={() => setConfirming(true)} disabled={busy || !canSend} title={canSend ? '' : 'Servono titolo, modello, un segmento con destinatari e (se programmata) una data futura'}>
            <i className="ti ti-mail-forward" /> {sendMode === 'scheduled' ? 'Programma campagna' : 'Invia campagna'}
          </button>
        </div>
      </div>

      {/* Storico */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Storico campagne</h2>
        {campaigns.length === 0 ? <div className="empty">Nessuna campagna inviata.</div> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {campaigns.map((c) => {
              const st = c.status ? CAMPAIGN_STATUS[c.status] : null;
              const active = c.status === 'scheduled' || c.status === 'sending';
              return (
                <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)' }}>
                  <button onClick={() => setOpenId(c.id)} style={{ flex: 1, textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <i className="ti ti-mail" style={{ fontSize: 18, color: 'var(--deep)' }} />
                    <span style={{ flex: 1 }}>
                      <b style={{ display: 'block', fontSize: 14 }}>
                        {c.title}
                        {st && <span className="chip" style={{ marginLeft: 8, fontSize: 10, color: st.color, background: st.bg, borderColor: 'transparent' }}>{st.label}</span>}
                      </b>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {c.status === 'scheduled' && c.scheduledFor
                          ? `Programmata per ${new Date(c.scheduledFor).toLocaleString('it-IT')} · ${c.recipientCount} destinatari`
                          : `${new Date(c.createdAt).toLocaleString('it-IT')} · ${c.recipientCount} destinatari · ${c.sentCount} inviate${c.failedCount ? ` · ${c.failedCount} fallite` : ''}`}
                        {c.status === 'sending' && ` · ${c.cursor ?? 0}/${c.recipientCount} elaborati`}
                      </span>
                    </span>
                  </button>
                  {active && (
                    <button className="btn ghost sm" onClick={() => cancelCampaign(c.id)} style={{ color: '#b3261e' }} title="Annulla campagna">
                      <i className="ti ti-x" /> Annulla
                    </button>
                  )}
                  <button onClick={() => setOpenId(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><i className="ti ti-chevron-right" style={{ color: 'var(--muted)' }} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirming && (
        <Modal title={sendMode === 'scheduled' ? 'Confermi la programmazione?' : "Confermi l'invio?"} onClose={() => setConfirming(false)}>
          <p>
            {sendMode === 'scheduled' ? 'Programmi' : 'Stai per inviare'} <b>“{title}”</b> a <b>{preview?.total ?? 0}</b> destinatari (modello: {opts.templates.find((t) => t.key === templateKey)?.name}).
            {sendMode === 'scheduled' && scheduledFor && <> Partirà il <b>{new Date(scheduledFor).toLocaleString('it-IT')}</b>.</>}
            {throttle
              ? <> Invio a lotti: <b>{batchSize}</b> e-mail, poi pausa di <b>{pauseMinutes}</b> minuti.</>
              : <> Tutte le e-mail partiranno insieme.</>}
            {(postTag.trim() || postStage) && (
              <> Dopo l'invio: {postTag.trim() && <>etichetta <b>{postTag.trim()}</b></>}{postTag.trim() && postStage && ' e '}{postStage && <>stato <b>{postStage}</b></>} sui contatti raggiunti.</>
            )}
          </p>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="btn ghost" onClick={() => setConfirming(false)}>Annulla</button>
            <button className="btn" onClick={sendCampaign}>
              <i className={sendMode === 'scheduled' ? 'ti ti-calendar-clock' : 'ti ti-mail-forward'} /> {sendMode === 'scheduled' ? 'Programma' : 'Invia ora'}
            </button>
          </div>
        </Modal>
      )}

      {/* Automazione cicli: in fondo alla pagina (richiesta di Simone). */}
      <FunnelLancio />

      <LifecycleAutomation />

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

/**
 * Funnel del lancio (handoff punto 6): raggiunti → prova → convertiti → rinnovi →
 * mantenimento, spezzati per SEGMENTO di provenienza e CANALE. Persone uniche.
 */
function FunnelLancio() {
  interface FunnelData {
    days: number;
    events: { name: string; total: number; bySegment: Record<string, number>; byChannel: Record<string, number> }[];
    consent: { si: number; no: number; maiChiesto: number };
  }
  const EVENT_LABEL: Record<string, string> = {
    trial_started: 'Prova attivata', trial_measures_ok: 'Misure G0 inserite',
    trial_day6_offer_sent: 'Offerta G6 inviata', trial_converted: 'Convertite',
    plan_renewed: 'Rinnovi', maintenance_started: 'Mantenimento', trial_expired: 'Prove scadute', profile_purged: 'Profili cancellati',
  };
  const SEGMENTS = [['ex_cliente', 'Ex cliente'], ['lead_caldo', 'Lead caldo'], ['lead_freddo', 'Lead freddo'], ['sconosciuto', '—']] as const;
  const [data, setData] = useState<FunnelData | null>(null);
  const [days, setDays] = useState(30);
  const [view, setView] = useState<'segmento' | 'canale'>('segmento');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<FunnelData>(`/marketing/funnel?days=${days}`).then(setData).catch((e) => setErr(e instanceof Error ? e.message : 'Caricamento non riuscito.'));
  }, [days]);

  const channels = data ? [...new Set(data.events.flatMap((e) => Object.keys(e.byChannel)))].sort() : [];

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Funnel del lancio</h2>
        <div className="row" style={{ gap: 8 }}>
          <select className="select" style={{ width: 120 }} value={view} onChange={(e) => setView(e.target.value as 'segmento' | 'canale')}>
            <option value="segmento">Per segmento</option>
            <option value="canale">Per canale</option>
          </select>
          <select className="select" style={{ width: 130 }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Ultimi 7 giorni</option>
            <option value={30}>Ultimi 30 giorni</option>
            <option value={90}>Ultimi 90 giorni</option>
            <option value={365}>Ultimo anno</option>
          </select>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '6px 0 10px' }}>
        Persone uniche per passaggio. Segmento dalla scheda CRM (o derivato da storico/stage); canale dalla provenienza del contatto.
      </p>
      {err && <Banner kind="err">{err}</Banner>}
      {!data ? <Spinner /> : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="grid">
              <thead>
                <tr>
                  <th>Passaggio</th>
                  <th style={{ textAlign: 'right' }}>Totale</th>
                  {view === 'segmento'
                    ? SEGMENTS.map(([k, l]) => <th key={k} style={{ textAlign: 'right' }}>{l}</th>)
                    : channels.map((c) => <th key={c} style={{ textAlign: 'right' }}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => (
                  <tr key={e.name}>
                    <td>{EVENT_LABEL[e.name] ?? e.name}</td>
                    <td style={{ textAlign: 'right' }}><b>{e.total}</b></td>
                    {view === 'segmento'
                      ? SEGMENTS.map(([k]) => <td key={k} style={{ textAlign: 'right' }} className="muted">{e.bySegment[k] ?? 0}</td>)
                      : channels.map((c) => <td key={c} style={{ textAlign: 'right' }} className="muted">{e.byChannel[c] ?? 0}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            <b>Consensi marketing:</b> Sì {data.consent.si} · No {data.consent.no} · mai chiesto {data.consent.maiChiesto}.
            {data.consent.maiChiesto > 0 && ' Per lo storico importato serve il ri-opt-in prima di qualsiasi invio massivo (parametro marketing_require_consent).'}
          </p>
        </>
      )}
    </div>
  );
}

function LifecycleAutomation() {
  const [ov, setOv] = useState<LifecycleOverview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function load() {
    setErr(null);
    api<LifecycleOverview>('/marketing/lifecycle')
      .then((o) => { setOv(o); setLoaded(true); })
      .catch((e) => { setLoaded(true); setErr(e instanceof Error ? e.message : 'Impossibile caricare l\'automazione.'); });
  }
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

  if (!ov) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Automazione email (ciclo di vita)</h2>
        {!loaded && <div className="muted">Caricamento…</div>}
        {loaded && err && (
          <>
            <div className="banner err" style={{ marginBottom: 8 }}>{err}</div>
            <button className="btn ghost" onClick={load}>Riprova</button>
          </>
        )}
      </div>
    );
  }
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
