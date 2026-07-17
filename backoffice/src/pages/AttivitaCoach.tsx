import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';

/**
 * Attività coach (handoff lancio, punto 5): i task generati in automatico sui
 * momenti chiave della prova (G0 misure, G1 benvenuto, G4 aderenza, G7 chiusura,
 * +7 ultima chiamata) e di ogni fine piano. "La coach deve vedere cosa fare e
 * quando, non ricordarselo." Stato: da fare / fatto / saltato.
 */

interface Task {
  id: string; clientId: string; kind: string; title: string; description: string | null;
  dueDate: string; overdue: boolean; status: string; clientName: string;
}
interface Summary { openTasks: number; overdueTasks: number; trialsActive: number; expiringToday: number; expiringTomorrow: number; notConverted: number }

const KIND_ICON: Record<string, string> = {
  trial_g0_measures: 'ti-ruler-measure', trial_g1_welcome: 'ti-heart-handshake',
  trial_g4_adherence: 'ti-phone', trial_g6_code: 'ti-discount-2', trial_g7_closing: 'ti-brand-whatsapp',
  plan_end_report: 'ti-report', trial_post7_lastcall: 'ti-phone-call',
  plan_expiry_heads_up: 'ti-calendar-due', maintenance_regain: 'ti-scale',
};

export function AttivitaCoach() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tab, setTab] = useState<'todo' | 'done' | 'skipped'>('todo');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load(status = tab) {
    api<Task[]>(`/staff/coach-tasks?status=${status}`).then(setTasks).catch((e) => { setTasks([]); setError(e instanceof Error ? e.message : 'Caricamento non riuscito.'); });
    api<Summary>('/staff/coach-tasks/summary').then(setSummary).catch(() => setSummary(null));
  }
  useEffect(() => { setTasks(null); load(tab); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(t: Task, status: 'todo' | 'done' | 'skipped') {
    setBusyId(t.id); setError(null);
    try {
      await api(`/staff/coach-tasks/${t.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load(tab);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Operazione non riuscita.'); }
    finally { setBusyId(null); }
  }

  const fmt = (s: string) => new Date(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

  return (
    <>
      {summary && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 14 }}>
          <div className="row" style={{ gap: 18, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <b style={{ fontSize: 13 }}><i className="ti ti-checklist" /> {summary.openTasks} da fare{summary.overdueTasks > 0 && <span style={{ color: '#B3261E' }}> · {summary.overdueTasks} in ritardo</span>}</b>
            <span className="muted" style={{ fontSize: 12 }}>Prove attive: <b>{summary.trialsActive}</b></span>
            <span className="muted" style={{ fontSize: 12 }}>In scadenza oggi: <b style={{ color: summary.expiringToday > 0 ? '#B3261E' : undefined }}>{summary.expiringToday}</b> · domani: <b>{summary.expiringTomorrow}</b></span>
            <span className="muted" style={{ fontSize: 12 }}>Non convertite: <b>{summary.notConverted}</b></span>
          </div>
        </div>
      )}

      <div className="row" style={{ gap: 6, marginBottom: 12 }}>
        {([['todo', 'Da fare'], ['done', 'Fatti'], ['skipped', 'Saltati']] as const).map(([k, l]) => (
          <button key={k} className="chip" onClick={() => setTab(k)} style={{ cursor: 'pointer', borderColor: tab === k ? 'var(--teal)' : undefined, background: tab === k ? 'var(--chip)' : undefined }}>{l}</button>
        ))}
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {!tasks ? <Spinner /> : tasks.length === 0 ? (
        <div className="empty">{tab === 'todo' ? 'Nessun task da fare: tutto in ordine ✓' : 'Niente qui.'}</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {tasks.map((t) => (
            <div key={t.id} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', borderLeft: t.overdue && t.status === 'todo' ? '4px solid #B3261E' : undefined }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--chip)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <i className={`ti ${KIND_ICON[t.kind] ?? 'ti-checklist'}`} style={{ fontSize: 17 }} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 14 }}>{t.title}</b>
                  <Link to={`/clienti/${t.clientId}`} className="link" style={{ fontSize: 13 }}>{t.clientName}</Link>
                  <span className={`chip ${t.overdue && t.status === 'todo' ? 'red' : ''}`} style={{ fontSize: 10 }}>
                    {t.overdue && t.status === 'todo' ? `in ritardo · ${fmt(t.dueDate)}` : fmt(t.dueDate)}
                  </span>
                </div>
                {t.description && <div className="muted" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>{t.description}</div>}
              </div>
              <div className="row" style={{ gap: 6, flex: 'none' }}>
                {t.status === 'todo' ? (
                  <>
                    <button className="btn sm" onClick={() => setStatus(t, 'done')} disabled={busyId === t.id}><i className="ti ti-check" /> Fatto</button>
                    <button className="btn ghost sm" onClick={() => setStatus(t, 'skipped')} disabled={busyId === t.id} title="Salta questo task">Salta</button>
                  </>
                ) : (
                  <button className="btn ghost sm" onClick={() => setStatus(t, 'todo')} disabled={busyId === t.id}><i className="ti ti-arrow-back-up" /> Riapri</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
