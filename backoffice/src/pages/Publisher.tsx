import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Spinner } from '../components/ui';

interface SocialPost {
  id: string;
  collectionId: string | null;
  channel: string;
  caption: string;
  hashtags: string[];
  imageRef: string | null;
  imageSource: string | null;
  status: string; // draft|judged|approved|scheduled|published|rejected
  judgePass: boolean | null;
  judgeIssues: string[] | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalId: string | null;
  updatedAt: string;
}

const CHANNELS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'other'];

const statusLabel: Record<string, string> = {
  draft: 'Bozza', judged: 'Giudicato', approved: 'Approvato',
  scheduled: 'Programmato', published: 'Pubblicato', rejected: 'Rifiutato',
};

/** Coda dell'agente Publisher: crea → Giudice → approva → pubblica. */
export function Publisher() {
  const [rows, setRows] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<SocialPost | 'new' | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await api<SocialPost[]>('/admin/social-posts'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata al marketing.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function act(p: SocialPost, path: string, body?: unknown, okMsg?: string) {
    setError(null);
    try {
      await api(`/admin/social-posts/${p.id}/${path}`, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
      if (okMsg) setNotice(okMsg);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Operazione non riuscita.');
    }
  }

  async function remove(p: SocialPost) {
    if (!confirm('Eliminare questo post?')) return;
    setError(null);
    try {
      await api(`/admin/social-posts/${p.id}`, { method: 'DELETE' });
      setRows((rs) => rs.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  function publish(p: SocialPost) {
    const ext = window.prompt('Id del post sulla piattaforma (facoltativo, se lo hai):') ?? undefined;
    void act(p, 'publish', ext ? { externalId: ext } : undefined, 'Post segnato come pubblicato.');
  }

  async function importCatalog() {
    setError(null);
    try {
      const r = await api<{ imported: number; skipped: number; total: number }>('/admin/social-posts/import', { method: 'POST' });
      setNotice(`Import dal catalogo: ${r.imported} nuovi post, ${r.skipped} già presenti (su ${r.total}).`);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Import non riuscito.');
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          Ogni post passa dal <b>Giudice</b> (compliance) prima di poter essere approvato. La pubblicazione automatica sui social arriverà con le credenziali: per ora si segna a mano.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" onClick={importCatalog}>
            <i className="ti ti-download" /> Importa dal catalogo
          </button>
          <button className="btn" onClick={() => setEditing('new')}>
            <i className="ti ti-plus" /> Nuovo post
          </button>
        </div>
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty">Nessun post. Creane uno con "Nuovo post".</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Canale</th>
                <th>Contenuto</th>
                <th style={{ width: 130 }}>Stato</th>
                <th style={{ textAlign: 'right' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="muted" style={{ textTransform: 'capitalize' }}>{p.channel}</td>
                  <td style={{ maxWidth: 460 }}>
                    <div>{p.caption}</div>
                    {p.hashtags.length > 0 && <div className="muted" style={{ fontSize: 12 }}>{p.hashtags.join(' ')}</div>}
                    {p.status === 'judged' && p.judgePass === false && p.judgeIssues && (
                      <div style={{ fontSize: 12, color: '#c0392b', marginTop: 4 }}>
                        ⚠ {p.judgeIssues.join(' · ')}
                      </div>
                    )}
                    {p.externalId && <div className="muted" style={{ fontSize: 12 }}>id piattaforma: {p.externalId}</div>}
                  </td>
                  <td>
                    <span className={`chip ${chipClass(p)}`}>{statusLabel[p.status] ?? p.status}</span>
                    {p.status === 'judged' && p.judgePass === true && <span className="muted" style={{ fontSize: 12, display: 'block' }}>Conforme ✓</span>}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {p.status === 'draft' && <button className="btn ghost sm" onClick={() => act(p, 'judge', undefined, 'Giudizio eseguito.')}>Giudica</button>}
                    {p.status === 'judged' && p.judgePass && <button className="btn ghost sm" onClick={() => act(p, 'approve', undefined, 'Post approvato.')}>Approva</button>}
                    {(p.status === 'approved' || p.status === 'scheduled') && <button className="btn sm" onClick={() => publish(p)}>Segna pubblicato</button>}
                    {p.status !== 'published' && <button className="btn ghost sm" style={{ marginLeft: 6 }} onClick={() => setEditing(p)}>Modifica</button>}
                    <button className="btn danger sm" style={{ marginLeft: 6 }} onClick={() => remove(p)}>Elimina</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <PostModal
          value={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setNotice(msg); void load(); }}
        />
      )}
    </>
  );
}

function chipClass(p: SocialPost) {
  if (p.status === 'published') return '';
  if (p.status === 'approved') return '';
  if (p.status === 'rejected') return 'gray';
  if (p.status === 'judged' && p.judgePass === false) return 'gray';
  return 'gray';
}

function PostModal({
  value,
  onClose,
  onSaved,
}: {
  value: SocialPost | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = value != null;
  const [channel, setChannel] = useState(value?.channel ?? 'instagram');
  const [caption, setCaption] = useState(value?.caption ?? '');
  const [hashtags, setHashtags] = useState((value?.hashtags ?? []).join(' '));
  const [collectionId, setCollectionId] = useState(value?.collectionId ?? '');
  const [imageRef, setImageRef] = useState(value?.imageRef ?? '');
  const [imageSource, setImageSource] = useState(value?.imageSource ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!caption.trim()) { setError('Inserisci la caption.'); return; }
    const tags = hashtags.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
    const payload = {
      channel,
      caption: caption.trim(),
      hashtags: tags,
      ...(isEdit ? {} : { collectionId: collectionId.trim() || undefined }),
      imageRef: imageRef.trim() || undefined,
      imageSource: imageSource || undefined,
    };
    setBusy(true);
    try {
      if (isEdit) {
        await api(`/admin/social-posts/${value!.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        onSaved('Post aggiornato (rimesso in bozza: va rigiudicato).');
      } else {
        await api('/admin/social-posts', { method: 'POST', body: JSON.stringify(payload) });
        onSaved('Post creato in bozza.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={isEdit ? 'Modifica post' : 'Nuovo post social'} onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ width: 180 }}>
          <label>Canale</label>
          <select className="select" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {!isEdit && (
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label>Collezione (facoltativa)</label>
            <input className="input" value={collectionId} onChange={(e) => setCollectionId(e.target.value)} placeholder="Es. persona.maria_matrimonio" />
          </div>
        )}
      </div>
      <div className="field">
        <label>Caption</label>
        <textarea className="input" rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Il testo del post…" />
      </div>
      <div className="field">
        <label>Hashtag (separati da spazio)</label>
        <input className="input" value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#benessere #metaboleai" />
      </div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1, minWidth: 200 }}>
          <label>Immagine (design_id Canva o file)</label>
          <input className="input" value={imageRef} onChange={(e) => setImageRef(e.target.value)} placeholder="Es. DAHPU2XhIr4" />
        </div>
        <div className="field" style={{ width: 160 }}>
          <label>Fonte immagine</label>
          <select className="select" value={imageSource} onChange={(e) => setImageSource(e.target.value)}>
            <option value="">—</option>
            <option value="canva">Canva</option>
            <option value="png_locale">PNG locale</option>
          </select>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={submit} disabled={busy || !caption.trim()}>{busy ? 'Salvo…' : isEdit ? 'Salva' : 'Crea'}</button>
      </div>
    </Modal>
  );
}
