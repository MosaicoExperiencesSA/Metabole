import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Spinner } from '../components/ui';

interface EqGroup {
  id: string;
  name: string;
  productId: string | null;
  members: { items?: string[]; note?: string } | null;
  status: string; // draft | approved
  version: number;
  createdAt: string;
  updatedAt: string;
}

const itemsOf = (g: EqGroup) => (Array.isArray(g.members?.items) ? g.members!.items! : []);

/** Gruppi di equivalenza (R4/R8): il nutrizionista rivede e approva i sostituti. */
export function GruppiEquivalenza() {
  const [rows, setRows] = useState<EqGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<EqGroup | 'new' | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await api<EqGroup[]>('/equivalence-groups'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata a nutrizionisti e amministratori.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function toggleApprove(g: EqGroup) {
    const to = g.status === 'approved' ? 'unapprove' : 'approve';
    try {
      await api(`/equivalence-groups/${g.id}/${to}`, { method: 'POST' });
      setNotice(to === 'approve' ? `"${g.name}" approvato.` : `"${g.name}" rimesso in bozza.`);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    }
  }

  async function remove(g: EqGroup) {
    if (!confirm(`Eliminare il gruppo "${g.name}"?`)) return;
    setError(null);
    try {
      await api(`/equivalence-groups/${g.id}`, { method: 'DELETE' });
      setRows((rs) => rs.filter((x) => x.id !== g.id));
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  if (loading) return <Spinner />;

  const draftCount = rows.filter((g) => g.status !== 'approved').length;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          Gruppi di alimenti intercambiabili per le sostituzioni. Il motore userà solo i gruppi <b>approvati</b>.
          {draftCount > 0 && <> {draftCount} in bozza da rivedere.</>}
        </p>
        <button className="btn" onClick={() => setEditing('new')}>
          <i className="ti ti-plus" /> Nuovo gruppo
        </button>
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty">Nessun gruppo di equivalenza. Creane uno con "Nuovo gruppo".</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Gruppo</th>
                <th>Alimenti intercambiabili</th>
                <th style={{ width: 90 }}>Ambito</th>
                <th style={{ width: 100 }}>Stato</th>
                <th style={{ textAlign: 'right' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id}>
                  <td><b>{g.name}</b>{g.members?.note && <div className="muted" style={{ fontSize: 12 }}>{g.members.note}</div>}</td>
                  <td className="muted" style={{ maxWidth: 460 }}>{itemsOf(g).join(', ')}</td>
                  <td className="muted">{g.productId ? 'Prodotto' : 'Globale'}</td>
                  <td>
                    <span className={`chip ${g.status === 'approved' ? '' : 'gray'}`}>{g.status === 'approved' ? 'Approvato' : 'Bozza'}</span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" onClick={() => toggleApprove(g)}>{g.status === 'approved' ? 'Rimetti in bozza' : 'Approva'}</button>
                    <button className="btn ghost sm" style={{ marginLeft: 6 }} onClick={() => setEditing(g)}>Modifica</button>
                    <button className="btn danger sm" style={{ marginLeft: 6 }} onClick={() => remove(g)}>Elimina</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <GroupModal
          value={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setNotice(msg); void load(); }}
        />
      )}
    </>
  );
}

function GroupModal({
  value,
  onClose,
  onSaved,
}: {
  value: EqGroup | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = value != null;
  const [name, setName] = useState(value?.name ?? '');
  const [itemsText, setItemsText] = useState((Array.isArray(value?.members?.items) ? value!.members!.items! : []).join('\n'));
  const [note, setNote] = useState(value?.members?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const items = itemsText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!name.trim()) { setError('Inserisci il nome del gruppo.'); return; }
    if (items.length === 0) { setError('Inserisci almeno un alimento (uno per riga).'); return; }
    const payload = { name: name.trim(), items, note: note.trim() || undefined };
    setBusy(true);
    try {
      if (isEdit) {
        await api(`/equivalence-groups/${value!.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        onSaved(`Gruppo "${payload.name}" aggiornato.`);
      } else {
        await api('/equivalence-groups', { method: 'POST', body: JSON.stringify(payload) });
        onSaved(`Gruppo "${payload.name}" creato.`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={isEdit ? 'Modifica gruppo' : 'Nuovo gruppo di equivalenza'} onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      <div className="field">
        <label>Nome del gruppo</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Pesci grassi" />
      </div>
      <div className="field">
        <label>Alimenti intercambiabili (uno per riga)</label>
        <textarea className="input" rows={6} value={itemsText} onChange={(e) => setItemsText(e.target.value)} placeholder={'salmone\naringa\nsgombro'} />
      </div>
      <div className="field">
        <label>Nota di sicurezza (facoltativa)</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. controllare le etichette per allergeni" />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={submit} disabled={busy || !name.trim()}>{busy ? 'Salvo…' : isEdit ? 'Salva' : 'Crea'}</button>
      </div>
    </Modal>
  );
}
