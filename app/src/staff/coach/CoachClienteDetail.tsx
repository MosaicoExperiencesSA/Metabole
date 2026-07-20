import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import { fullName, shortDate, waLink } from '../format';
import { useApi } from '../hooks';
import { Async, Avatar, BackBar, Card, Section, StaffShell } from '../ui';
import { COACH_TABS } from '../tabs';

interface Measurement {
  id: string;
  date: string;
  weightKg: number;
  waistCm: number | null;
  hipsCm: number | null;
}
interface Checkin {
  id: string;
  date: string;
  mood: number | null;
  energy: number | null;
  hunger: number | null;
  stress: number | null;
}
interface Note { id: string; body: string; createdAt: string; author: string | null }
interface Detail {
  user: { firstName: string | null; lastName: string | null; email: string; phone: string | null };
  profile: {
    name?: string | null;
    startWeightKg?: number | null;
    pathType?: string | null;
    coachStyle?: string | null;
    character?: string | null;
    intolerances?: string[] | null;
    dislikedFoods?: string[] | null;
  } | null;
  objective: { targetWeightKg?: number | null; targetDate?: string | null; status?: string } | null;
  measurements: Measurement[];
  checkins: Checkin[];
  subscription: { plan?: { name?: string } | null; status?: string } | null;
  payments: { id: string; amountCents: number; description: string; method: string; status: string; createdAt: string }[];
  notes?: Note[];
}

const PAY_STATUS: Record<string, string> = { pending: 'In attesa', receipt_uploaded: 'Contabile caricata', approved: 'Approvato', rejected: 'Rifiutato' };

const MOOD = ['—', '😞', '😕', '😐', '🙂', '😄'];

export default function CoachClienteDetail() {
  const { id } = useParams();
  const state = useApi<Detail>(id ? `/admin/clients/${id}` : null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [payErr, setPayErr] = useState<string | null>(null);
  // Modifica dati base della scheda (nome, telefono, non graditi/intolleranze).
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ name: string; phone: string; intolerances: string; dislikedFoods: string }>({ name: '', phone: '', intolerances: '', dislikedFoods: '' });
  const [saving, setSaving] = useState(false);
  const [opMsg, setOpMsg] = useState<string | null>(null);
  const [opErr, setOpErr] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [fixing, setFixing] = useState<string | null>(null);

  function startEdit(d: Detail) {
    setForm({
      name: d.profile?.name ?? fullName(d.user.firstName, d.user.lastName, ''),
      phone: d.user.phone ?? '',
      intolerances: (d.profile?.intolerances ?? []).join(', '),
      dislikedFoods: (d.profile?.dislikedFoods ?? []).join(', '),
    });
    setOpMsg(null); setOpErr(null);
    setEditing(true);
  }

  async function saveEdit() {
    if (!id) return;
    setSaving(true); setOpErr(null); setOpMsg(null);
    const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
    try {
      await api(`/admin/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          phone: form.phone.trim(),
          intolerances: list(form.intolerances),
          dislikedFoods: list(form.dislikedFoods),
        }),
      });
      setOpMsg('Scheda aggiornata.');
      setEditing(false);
      state.reload();
    } catch (e) {
      setOpErr(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!id || !newNote.trim()) return;
    setOpErr(null);
    try {
      await api(`/admin/clients/${id}/note`, { method: 'POST', body: JSON.stringify({ body: newNote.trim() }) });
      setNewNote('');
      state.reload();
    } catch (e) {
      setOpErr(e instanceof ApiError ? e.message : 'Nota non salvata.');
    }
  }

  /** Correzione misura (peso/vita): richiede il permesso "Correggi misure"; il backend decide. */
  async function fixMeasure(m: Measurement) {
    if (!id) return;
    const w = prompt('Peso corretto (kg):', String(m.weightKg));
    if (w === null) return;
    const weightKg = Number(w.replace(',', '.'));
    if (Number.isNaN(weightKg)) { setOpErr('Peso non valido.'); return; }
    const waistRaw = prompt('Girovita corretto (cm), vuoto per lasciare:', m.waistCm != null ? String(m.waistCm) : '');
    setFixing(m.id); setOpErr(null); setOpMsg(null);
    const body: Record<string, unknown> = { weightKg };
    if (waistRaw !== null && waistRaw.trim() !== '') body.waistCm = Number(waistRaw.replace(',', '.'));
    try {
      await api(`/admin/clients/${id}/measurements/${m.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setOpMsg('Misura corretta.');
      state.reload();
    } catch (e) {
      setOpErr(e instanceof ApiError ? e.message : 'Correzione non riuscita (potresti non avere il permesso).');
    } finally {
      setFixing(null);
    }
  }

  /** Carica la contabile del bonifico per conto della cliente (l'approvazione resta all'amministrazione). */
  async function uploadReceipt(paymentId: string, file: File) {
    if (file.size > 5 * 1024 * 1024) { setPayErr('La contabile supera i 5 MB.'); return; }
    setUploading(paymentId); setPayErr(null); setPayMsg(null);
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
        r.onerror = () => reject(new Error('Lettura del file non riuscita.'));
        r.readAsDataURL(file);
      });
      await api(`/staff/payments/${paymentId}/receipt`, { method: 'POST', body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/pdf', contentBase64 }) });
      setPayMsg('Contabile caricata: ora attende la verifica dell\'amministrazione.');
      state.reload();
    } catch (e) {
      setPayErr(e instanceof ApiError ? e.message : 'Caricamento non riuscito.');
    } finally {
      setUploading(null);
    }
  }

  return (
    <StaffShell title="Scheda cliente" tabs={COACH_TABS}>
      <BackBar label="Clienti" to="/clienti" />
      <Async state={state}>
        {(d) => {
          const name = d.profile?.name || fullName(d.user.firstName, d.user.lastName, d.user.email);
          const current = d.measurements[0]?.weightKg ?? null;
          const start = d.profile?.startWeightKg ?? null;
          const delta = current != null && start != null ? +(current - start).toFixed(1) : null;
          const lastCheckin = d.checkins[0];
          return (
            <>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar name={name} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="sf-row-name" style={{ fontSize: 16 }}>
                      {name}
                    </div>
                    <div className="sf-sub">
                      {d.subscription?.plan?.name || 'Nessun piano attivo'}
                    </div>
                  </div>
                </div>
                <div className="sf-acts">
                  {d.user.phone && (
                    <a className="sf-mini wa" href={waLink(d.user.phone)} target="_blank" rel="noreferrer">
                      <i className="ti ti-brand-whatsapp" /> WhatsApp
                    </a>
                  )}
                  <a className="sf-mini b" href="/chat">
                    <i className="ti ti-message-2" /> Vai in chat
                  </a>
                  {!editing && (
                    <button className="sf-mini" onClick={() => startEdit(d)}>
                      <i className="ti ti-edit" /> Modifica
                    </button>
                  )}
                </div>
              </Card>

              {opErr && <Card><div style={{ color: '#B3261E', fontSize: 13 }}>{opErr}</div></Card>}
              {opMsg && <Card><div style={{ color: '#0E7C66', fontSize: 13 }}>{opMsg}</div></Card>}

              {editing && (
                <>
                  <Section title="Modifica scheda" />
                  <Card>
                    <label className="sf-field">
                      <span className="k">Nome</span>
                      <input className="sf-inp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label className="sf-field">
                      <span className="k">Telefono</span>
                      <input className="sf-inp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+39…" />
                    </label>
                    <label className="sf-field">
                      <span className="k">Intolleranze (virgola)</span>
                      <input className="sf-inp" value={form.intolerances} onChange={(e) => setForm({ ...form, intolerances: e.target.value })} placeholder="lattosio, glutine…" />
                    </label>
                    <label className="sf-field">
                      <span className="k">Cibi non graditi (virgola)</span>
                      <input className="sf-inp" value={form.dislikedFoods} onChange={(e) => setForm({ ...form, dislikedFoods: e.target.value })} placeholder="funghi, tacchino…" />
                    </label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="sf-btn p" onClick={saveEdit} disabled={saving}>{saving ? 'Salvo…' : 'Salva'}</button>
                      <button className="sf-btn g" onClick={() => setEditing(false)} disabled={saving}>Annulla</button>
                    </div>
                  </Card>
                </>
              )}

              <Section title="Andamento peso" />
              <Card>
                <div className="sf-kv">
                  <span className="k">Peso attuale</span>
                  <span className="v">{current != null ? `${current} kg` : '—'}</span>
                </div>
                <div className="sf-kv">
                  <span className="k">Partenza</span>
                  <span className="v">{start != null ? `${start} kg` : '—'}</span>
                </div>
                <div className="sf-kv">
                  <span className="k">Variazione</span>
                  <span className="v" style={{ color: delta != null && delta < 0 ? '#3B6D11' : '#B4491F' }}>
                    {delta != null ? `${delta > 0 ? '+' : ''}${delta} kg` : '—'}
                  </span>
                </div>
                {d.objective?.targetWeightKg != null && (
                  <div className="sf-kv">
                    <span className="k">Obiettivo</span>
                    <span className="v">{d.objective.targetWeightKg} kg</span>
                  </div>
                )}
              </Card>

              {lastCheckin && (
                <>
                  <Section title="Ultimo check-in" />
                  <Card>
                    <div className="sf-sub" style={{ marginBottom: 8 }}>
                      {shortDate(lastCheckin.date)}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                      <span>Umore {MOOD[lastCheckin.mood ?? 0]}</span>
                      <span>Energia {lastCheckin.energy ?? '—'}/5</span>
                      <span>Stress {lastCheckin.stress ?? '—'}/5</span>
                    </div>
                  </Card>
                </>
              )}

              {(d.payments ?? []).some((p) => p.method === 'bank_transfer' && (p.status === 'pending' || p.status === 'rejected' || p.status === 'receipt_uploaded')) && (
                <>
                  <Section title="Bonifici da completare" />
                  {payErr && <Card><div style={{ color: '#B3261E', fontSize: 13 }}>{payErr}</div></Card>}
                  {payMsg && <Card><div style={{ color: '#0E7C66', fontSize: 13 }}>{payMsg}</div></Card>}
                  <Card className="pad0">
                    {(d.payments ?? [])
                      .filter((p) => p.method === 'bank_transfer' && (p.status === 'pending' || p.status === 'rejected' || p.status === 'receipt_uploaded'))
                      .map((p) => (
                        <div key={p.id} className="sf-row" style={{ cursor: 'default' }}>
                          <div className="sf-row-main">
                            <div className="sf-row-name">{p.description}</div>
                            <div className="sf-row-sub">
                              € {(p.amountCents / 100).toFixed(2).replace('.', ',')} · {PAY_STATUS[p.status] ?? p.status} · {shortDate(p.createdAt)}
                            </div>
                          </div>
                          <label className="sf-mini b" style={{ cursor: 'pointer' }} title="Carica la contabile per conto della cliente: l'approvazione resta all'amministrazione">
                            <i className="ti ti-file-upload" /> {uploading === p.id ? 'Carico…' : p.status === 'receipt_uploaded' ? 'Sostituisci' : 'Carica contabile'}
                            <input
                              type="file"
                              accept="application/pdf,image/jpeg,image/png,image/heic"
                              style={{ display: 'none' }}
                              disabled={uploading === p.id}
                              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadReceipt(p.id, f); }}
                            />
                          </label>
                        </div>
                      ))}
                  </Card>
                </>
              )}

              {d.measurements.length > 0 && (
                <>
                  <Section title="Storico misure" />
                  <Card className="pad0">
                    {d.measurements.slice(0, 8).map((m) => (
                      <div key={m.id} className="sf-row" style={{ cursor: 'default' }}>
                        <div className="sf-row-main">
                          <div className="sf-row-name">{m.weightKg} kg</div>
                          <div className="sf-row-sub">
                            {m.waistCm != null ? `vita ${m.waistCm} cm` : ''}
                          </div>
                        </div>
                        <button className="sf-mini" onClick={() => fixMeasure(m)} disabled={fixing === m.id} title="Correggi la misura (serve il permesso)">
                          <i className="ti ti-pencil" /> {fixing === m.id ? '…' : 'Correggi'}
                        </button>
                        <span className="sf-sub" style={{ marginLeft: 8 }}>{shortDate(m.date)}</span>
                      </div>
                    ))}
                  </Card>
                </>
              )}

              <Section title="Note dello staff" />
              <Card>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="sf-inp" style={{ flex: 1 }} placeholder="Aggiungi una nota…" value={newNote}
                    onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addNote(); }} />
                  <button className="sf-btn p" style={{ width: 'auto', padding: '0 14px' }} onClick={addNote} disabled={!newNote.trim()}>Aggiungi</button>
                </div>
                {(d.notes ?? []).length === 0 ? (
                  <p className="sf-sub" style={{ marginTop: 10 }}>Nessuna nota per ora.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    {(d.notes ?? []).slice(0, 30).map((n) => (
                      <div key={n.id} style={{ background: '#F6F9F8', borderRadius: 10, padding: '8px 10px' }}>
                        <div style={{ fontSize: 13, color: '#2E3E3B', lineHeight: 1.5 }}>{n.body}</div>
                        <div className="sf-sub" style={{ marginTop: 3 }}>{n.author ?? 'Staff'} · {shortDate(n.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          );
        }}
      </Async>
    </StaffShell>
  );
}
