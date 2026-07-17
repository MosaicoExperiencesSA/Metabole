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
interface Detail {
  user: { firstName: string | null; lastName: string | null; email: string; phone: string | null };
  profile: {
    name?: string | null;
    startWeightKg?: number | null;
    pathType?: string | null;
    coachStyle?: string | null;
    character?: string | null;
  } | null;
  objective: { targetWeightKg?: number | null; targetDate?: string | null; status?: string } | null;
  measurements: Measurement[];
  checkins: Checkin[];
  subscription: { plan?: { name?: string } | null; status?: string } | null;
  payments: { id: string; amountCents: number; description: string; method: string; status: string; createdAt: string }[];
}

const PAY_STATUS: Record<string, string> = { pending: 'In attesa', receipt_uploaded: 'Contabile caricata', approved: 'Approvato', rejected: 'Rifiutato' };

const MOOD = ['—', '😞', '😕', '😐', '🙂', '😄'];

export default function CoachClienteDetail() {
  const { id } = useParams();
  const state = useApi<Detail>(id ? `/admin/clients/${id}` : null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [payErr, setPayErr] = useState<string | null>(null);

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
                </div>
              </Card>

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

              {d.measurements.length > 1 && (
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
                        <span className="sf-sub">{shortDate(m.date)}</span>
                      </div>
                    ))}
                  </Card>
                </>
              )}
            </>
          );
        }}
      </Async>
    </StaffShell>
  );
}
