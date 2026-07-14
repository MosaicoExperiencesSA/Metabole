import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Spinner } from '../components/ui';

interface Testimonial {
  id: string;
  name: string;
  age: number | null;
  text: string;
  photo: string | null;
  locale: string;
  published: boolean;
  order: number;
  source: string | null;
  createdAt: string;
}

/** Gestione testimonianze del sito pubblico (compaiono su /public/testimonials). */
export function Testimonianze() {
  const [rows, setRows] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Testimonial | 'new' | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await api<Testimonial[]>('/admin/testimonials'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata agli amministratori.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function togglePublished(t: Testimonial) {
    try {
      await api(`/admin/testimonials/${t.id}`, { method: 'PATCH', body: JSON.stringify({ published: !t.published }) });
      setRows((rs) => rs.map((x) => (x.id === t.id ? { ...x, published: !x.published } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modifica non riuscita.');
    }
  }

  async function remove(t: Testimonial) {
    if (!confirm(`Eliminare la testimonianza di ${t.name}?`)) return;
    setError(null);
    try {
      await api(`/admin/testimonials/${t.id}`, { method: 'DELETE' });
      setRows((rs) => rs.filter((x) => x.id !== t.id));
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          Testimonianze mostrate sul sito pubblico. Solo quelle <b>pubblicate</b> compaiono online; l'ordine segue il campo “Ordine”.
        </p>
        <button className="btn" onClick={() => setEditing('new')}>
          <i className="ti ti-plus" /> Nuova testimonianza
        </button>
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty">Nessuna testimonianza. Aggiungine una con “Nuova testimonianza”.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>Nome</th>
                <th style={{ width: 60 }}>Età</th>
                <th>Testo</th>
                <th style={{ width: 90 }}>Stato</th>
                <th style={{ textAlign: 'right' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="muted">{t.order}</td>
                  <td><b>{t.name}</b></td>
                  <td className="muted">{t.age ?? '—'}</td>
                  <td className="muted" style={{ maxWidth: 420 }}>{t.text}</td>
                  <td>
                    <span className={`chip ${t.published ? '' : 'gray'}`}>{t.published ? 'Pubblicata' : 'Nascosta'}</span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" onClick={() => togglePublished(t)}>{t.published ? 'Nascondi' : 'Pubblica'}</button>
                    <button className="btn ghost sm" style={{ marginLeft: 6 }} onClick={() => setEditing(t)}>Modifica</button>
                    <button className="btn danger sm" style={{ marginLeft: 6 }} onClick={() => remove(t)}>Elimina</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <TestimonialModal
          value={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setNotice(msg); void load(); }}
          onError={(msg) => setError(msg)}
        />
      )}
    </>
  );
}

function TestimonialModal({
  value,
  onClose,
  onSaved,
  onError,
}: {
  value: Testimonial | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const isEdit = value != null;
  const [name, setName] = useState(value?.name ?? '');
  const [age, setAge] = useState(value?.age != null ? String(value.age) : '');
  const [text, setText] = useState(value?.text ?? '');
  const [photo, setPhoto] = useState(value?.photo ?? '');
  const [order, setOrder] = useState(value?.order != null ? String(value.order) : '0');
  const [published, setPublished] = useState(value?.published ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim()) { setError('Inserisci il nome.'); return; }
    if (!text.trim()) { setError('Inserisci il testo della testimonianza.'); return; }
    const payload = {
      name: name.trim(),
      text: text.trim(),
      age: age ? parseInt(age, 10) : undefined,
      photo: photo.trim() || undefined,
      order: order ? parseInt(order, 10) : 0,
      published,
    };
    setBusy(true);
    try {
      if (isEdit) {
        await api(`/admin/testimonials/${value!.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        onSaved(`Testimonianza di ${payload.name} aggiornata.`);
      } else {
        await api('/admin/testimonials', { method: 'POST', body: JSON.stringify(payload) });
        onSaved(`Testimonianza di ${payload.name} creata.`);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Salvataggio non riuscito.';
      setError(msg);
      onError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={isEdit ? 'Modifica testimonianza' : 'Nuova testimonianza'} onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 2, minWidth: 200 }}>
          <label>Nome</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Martina" />
        </div>
        <div className="field" style={{ width: 100 }}>
          <label>Età</label>
          <input className="input" type="number" min="0" max="120" value={age} onChange={(e) => setAge(e.target.value)} placeholder="—" />
        </div>
        <div className="field" style={{ width: 110 }}>
          <label>Ordine</label>
          <input className="input" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Testo</label>
        <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="“…”" />
      </div>
      <div className="field">
        <label>Foto (URL, facoltativa)</label>
        <input className="input" value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="Se vuota, il sito usa un'immagine di ripiego" />
      </div>
      <div className="field">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Pubblicata sul sito
        </label>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={submit} disabled={busy || !name.trim() || !text.trim()}>
          {busy ? 'Salvo…' : isEdit ? 'Salva' : 'Crea'}
        </button>
      </div>
    </Modal>
  );
}
