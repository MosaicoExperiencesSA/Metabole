import { useParams } from 'react-router-dom';
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
}

const MOOD = ['—', '😞', '😕', '😐', '🙂', '😄'];

export default function CoachClienteDetail() {
  const { id } = useParams();
  const state = useApi<Detail>(id ? `/admin/clients/${id}` : null);

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
