import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import AppHeader from '../components/AppHeader';
import Sheet from '../components/Sheet';

/**
 * Contatti — allineata al prototipo (docs/): il team (Gaia · coach · nutrizionista)
 * con stato LIVE e accesso alle conversazioni. Nomi REALI dal profilo cliente.
 */

interface Person { id: string; displayName?: string | null }
interface Profile { assignedCoach?: Person | null; assignedNutritionist?: Person | null }
interface Summary { id: string; date: string; title: string; summary: string | null }

function initials(name?: string | null): string {
  if (!name) return '·';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '') .toUpperCase();
}

export default function Contatti() {
  const nav = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sheet, setSheet] = useState<null | { name: string; role: string }>(null);
  const [past, setPast] = useState<null | { name: string; who: string }>(null);
  const [summaries, setSummaries] = useState<Summary[] | null>(null);

  useEffect(() => {
    api<Profile>('/me/client-profile').then(setProfile).catch(() => setProfile(null));
  }, []);

  // "Conversazioni passate": riassunti giornalieri reali (GET /me/threads/:who/summaries).
  useEffect(() => {
    if (!past) { setSummaries(null); return; }
    let alive = true;
    api<Summary[]>(`/me/threads/${past.who}/summaries`)
      .then((s) => { if (alive) setSummaries(Array.isArray(s) ? s : []); })
      .catch(() => { if (alive) setSummaries([]); });
    return () => { alive = false; };
  }, [past?.who]);

  const coach = profile?.assignedCoach?.displayName ?? null;
  const nutri = profile?.assignedNutritionist?.displayName ?? null;

  return (
    <div className="home">
      <AppHeader title="I tuoi contatti" />

      <p className="muted" style={{ margin: '0 2px 12px', fontSize: 13, lineHeight: 1.5 }}>
        Il tuo team, sempre a portata di messaggio. Coach e nutrizionista sono in linea negli orari di lavoro.
      </p>

      {/* Gaia · Assistente AI */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 10 }}>
        <div className="row" style={{ padding: '12px 13px', cursor: 'pointer' }} onClick={() => nav('/assistente')}>
          <span style={{ width: 46, height: 46, borderRadius: '50%', background: '#6C4CD6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flex: 'none' }}>
            <i className="ti ti-sparkles" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Gaia</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#6C4CD6', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span className="livedot" style={{ background: '#6C4CD6' }} />LIVE
              </span>
            </div>
            <div className="muted" style={{ fontSize: 11 }}>Assistente AI · sempre disponibile</div>
            <div style={{ fontSize: 12, color: '#5F6E6B', marginTop: 3 }}>Chiedimi quello che vuoi sul tuo percorso.</div>
          </div>
          <i className="ti ti-chevron-right" style={{ color: '#C6CFCB' }} />
        </div>
        <div className="row" style={{ borderTop: '1px solid #F2F5F4', padding: '9px 13px', color: '#6C5AB7', cursor: 'pointer' }} onClick={() => setPast({ name: 'Gaia', who: 'ai' })}>
          <i className="ti ti-history" style={{ fontSize: 15 }} />
          <span style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>Conversazioni passate</span>
          <i className="ti ti-chevron-right" style={{ fontSize: 14, color: '#C6CFCB' }} />
        </div>
      </div>

      {/* Coach: chat DIRETTA (stesso sistema di thread di Gaia) */}
      <ContactCard
        initial={initials(coach)}
        bg="#DCEBE3" color="#0E7C66" liveColor="#12A386"
        name={coach ?? 'Coach in assegnazione'}
        role="La tua coach"
        line={coach ? 'Ti segue giorno per giorno. Scrivile qui.' : 'Ti assegneremo una coach a breve.'}
        onOpen={() => (coach ? nav('/assistente?who=coach') : setSheet({ name: 'la coach', role: 'la tua coach' }))}
        onPast={() => setPast({ name: coach ?? 'Coach', who: 'coach' })}
      />

      {/* Nutrizionista: chat DIRETTA */}
      <ContactCard
        initial={initials(nutri)}
        bg="#E7EEF6" color="#274b73" liveColor="#3A6EA5"
        name={nutri ?? 'Nutrizionista in assegnazione'}
        role="Nutrizionista"
        line={nutri ? 'Cura il tuo piano alimentare. Scrivile qui.' : 'Ti assegneremo un nutrizionista a breve.'}
        onOpen={() => (nutri ? nav('/assistente?who=nutritionist') : setSheet({ name: 'la nutrizionista', role: 'la tua nutrizionista' }))}
        onPast={() => setPast({ name: nutri ?? 'Nutrizionista', who: 'nutritionist' })}
      />

      {/* Nota privacy */}
      <div className="card" style={{ background: '#EAF6F1', boxShadow: 'none', borderColor: '#CFE8DF', display: 'flex', alignItems: 'center', gap: 9 }}>
        <i className="ti ti-shield-check" style={{ color: '#0E7C66', fontSize: 18, flex: 'none' }} />
        <span style={{ fontSize: 12, color: '#0E7C66' }}>Le domande sanitarie le vede solo la nutrizionista.</span>
      </div>

      {sheet && (
        <Sheet onClose={() => setSheet(null)}>
          <b style={{ fontSize: 15 }}>Scrivi a {sheet.name}</b>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
            Appena {sheet.role} ti sarà assegnata potrai scriverle da qui. Intanto puoi chiedere a Gaia,
            che gira le tue richieste al team.
          </p>
          <button className="btn" style={{ marginTop: 6 }} onClick={() => { setSheet(null); nav('/assistente'); }}>
            <i className="ti ti-sparkles" /> Chiedi a Gaia
          </button>
        </Sheet>
      )}

      {past && (
        <Sheet onClose={() => setPast(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <span className="event-ic" style={{ background: '#EFEAF9', color: '#6C5AB7' }}><i className="ti ti-history" /></span>
            <b style={{ fontSize: 15 }}>Conversazioni con {past.name}</b>
          </div>
          {summaries === null ? (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>Carico…</p>
          ) : summaries.length === 0 ? (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>Non ci sono ancora conversazioni passate da mostrare.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10, maxHeight: '55vh', overflow: 'auto' }}>
              {summaries.map((s) => (
                <div key={s.id} style={{ background: '#F6F9F8', borderRadius: 12, padding: '10px 12px' }}>
                  <div className="muted" style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    {new Date(s.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2E3E3B' }}>{s.title}</div>
                  {s.summary && <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#2E3E3B', marginTop: 3 }}>{s.summary}</div>}
                </div>
              ))}
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

function ContactCard({
  initial, bg, color, liveColor, name, role, line, onOpen, onPast,
}: {
  initial: string; bg: string; color: string; liveColor: string;
  name: string; role: string; line: string; onOpen: () => void; onPast: () => void;
}) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 10 }}>
      <div className="row" style={{ padding: '12px 13px', cursor: 'pointer' }} onClick={onOpen}>
        <span style={{ width: 46, height: 46, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, flex: 'none' }}>
          {initial}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: liveColor, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span className="livedot" style={{ background: liveColor }} />LIVE
            </span>
          </div>
          <div className="muted" style={{ fontSize: 11 }}>{role}</div>
          <div style={{ fontSize: 12, color: '#5F6E6B', marginTop: 3 }}>{line}</div>
        </div>
        <i className="ti ti-chevron-right" style={{ color: '#C6CFCB' }} />
      </div>
      <div className="row" style={{ borderTop: '1px solid #F2F5F4', padding: '9px 13px', color: '#6C5AB7', cursor: 'pointer' }} onClick={onPast}>
        <i className="ti ti-history" style={{ fontSize: 15 }} />
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>Conversazioni passate</span>
        <i className="ti ti-chevron-right" style={{ fontSize: 14, color: '#C6CFCB' }} />
      </div>
    </div>
  );
}
