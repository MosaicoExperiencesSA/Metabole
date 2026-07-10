import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner } from '../components/ui';

interface Detail {
  user: { id: string; email: string; status: string; locale: string; emailVerifiedAt: string | null; createdAt: string };
  profile: any | null;
  objective: any | null;
  measurements: { id: string; date: string; weightKg: number; waistCm: number | null; hipsCm: number | null }[];
  checkins: { id: string; date: string; mood: string; energy: number | null; hunger: number | null; stress: number | null }[];
  waterLogs: { id: string; date: string; glasses: number; goal: number }[];
  stepLogs: { id: string; date: string; steps: number; goal: number }[];
  subscription: any | null;
  payments: { id: string; amountCents: number; description: string; method: string; status: string; createdAt: string; approvedAt: string | null }[];
  crm: { stage: string; valueCents: number | null } | null;
  notes: { id: string; body: string; createdAt: string; author: string | null }[];
  pendingCommissions: { id: string; role: string; amountCents: number; createdAt: string }[];
}

const COMM_ROLE: Record<string, string> = {
  coach: 'Coach',
  manager_coach: 'Manager coach',
  nutritionist: 'Nutrizionista',
  head_nutritionist: 'Capo nutrizionista',
};

const L: Record<string, Record<string, string>> = {
  sex: { female: 'Donna', male: 'Uomo' },
  regime: { omnivore: 'Onnivora', vegetarian: 'Vegetariana', vegan: 'Vegana' },
  dietStyle: { mediterranean: 'Mediterranea', protein: 'Proteica', low_carb: 'Low carb', flexible: 'Flessibile' },
  pathType: { classic3: '3 pasti', five: '5 pasti', supplements: 'Con integratori', intermittent_fasting: 'Digiuno intermittente' },
  coachStyle: { daily: 'Contatto quotidiano', when_needed: 'Quando serve', on_request: 'Su richiesta' },
  character: { follows: 'Segue bene', needs_push: 'Va spronata', perseveres: 'Persevera', quits: 'Molla facilmente' },
  work: { sedentary: 'Sedentario', standing: 'In piedi', shifts: 'Turni', travel: 'Viaggia spesso' },
  cookingTime: { very_little: 'Pochissimo', some: "Un po'", love_cooking: 'Ama cucinare' },
  weekdayLunch: { home: 'Da casa', canteen: 'Mensa', out: 'Fuori', on_the_go: 'Al volo' },
  yesno: { no: 'No', yes: 'Sì', tell_in_visit: 'Lo dirà in visita' },
  payStatus: { pending: 'In attesa', receipt_uploaded: 'Contabile caricata', approved: 'Approvato', rejected: 'Rifiutato' },
  subStatus: { pending: 'In attesa', active: 'Attivo', paused: 'In pausa', expired: 'Scaduto', cancelled: 'Annullato' },
  method: { bank_transfer: 'Bonifico', card: 'Carta' },
};
const lab = (group: string, v: string | null | undefined) => (v ? L[group]?.[v] ?? v : '—');
const euro = (c: number | null | undefined) => (c == null ? '—' : '€ ' + (c / 100).toFixed(2).replace('.', ','));
const date = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');
const dateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const kg = (n: number | null | undefined) => (n == null ? '—' : `${n} kg`);

// Umore: etichetta + colore chip.
const MOOD: Record<string, { label: string; chip: string }> = {
  great: { label: 'Alla grande', chip: '' },
  good: { label: 'Bene', chip: '' },
  ok: { label: 'Così così', chip: 'gray' },
  hard: { label: 'Faticoso', chip: 'amber' },
  stressed: { label: 'Stressata', chip: 'red' },
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ width: 190, flex: 'none', color: 'var(--muted)', fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}

export function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const isAdmin = can('permissions'); // il reset password è azione admin
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // Note dello staff (log)
  const [notes, setNotes] = useState<Detail['notes']>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Team: liste coach/nutrizionisti per l'assegnazione (solo admin)
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([]);
  const [nutritionists, setNutritionists] = useState<{ id: string; name: string }[]>([]);

  // Report mensile
  interface Report { periodLabel: string; lostThisMonthKg: number | null; lostTotalKg: number | null; currentWeightKg: number | null; targetWeightKg: number | null; checkins: number; measurements: number }
  const [report, setReport] = useState<Report | null>(null);
  const [sendingReport, setSendingReport] = useState(false);

  useEffect(() => {
    (async () => {
      try { setReport(await api<Report>(`/admin/reports/${id}`)); } catch { /* report opzionale */ }
    })();
  }, [id]);

  async function sendReport() {
    if (!confirm('Inviare il report mensile alla cliente via email?')) return;
    setSendingReport(true);
    setNotice(null);
    setError(null);
    try {
      await api(`/admin/reports/${id}/send`, { method: 'POST' });
      setNotice('Report mensile inviato alla cliente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invio del report non riuscito.');
    } finally {
      setSendingReport(false);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await api<Detail>(`/admin/clients/${id}`);
        setD(data);
        setNotes(data.notes ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        type StaffUser = { staff: { id: string; displayName: string } | null };
        const [c, n] = await Promise.all([
          api<{ items: StaffUser[] }>('/admin/users?role=coach'),
          api<{ items: StaffUser[] }>('/admin/users?role=nutritionist'),
        ]);
        const opts = (list: StaffUser[]) => list.filter((u) => u.staff).map((u) => ({ id: u.staff!.id, name: u.staff!.displayName }));
        setCoaches(opts(c.items));
        setNutritionists(opts(n.items));
      } catch {
        /* le liste sono opzionali: se non si caricano, resta la vista in sola lettura */
      }
    })();
  }, [isAdmin]);

  async function assignTeam(kind: 'coach' | 'nutritionist', staffId: string) {
    setError(null);
    setNotice(null);
    try {
      const body: Record<string, string | null> = { clientId: id! };
      if (kind === 'coach') body.coachId = staffId || null;
      else body.nutritionistId = staffId || null;
      await api('/admin/assignments', { method: 'POST', body: JSON.stringify(body) });
      const data = await api<Detail>(`/admin/clients/${id}`); // ricarico: aggiorna team e accantonate
      setD(data);
      setNotes(data.notes ?? []);
      setNotice('Team aggiornato.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può cambiare le assegnazioni.');
      else setError(err instanceof Error ? err.message : 'Assegnazione non riuscita.');
    }
  }

  async function resetPassword() {
    if (!confirm('Inviare alla cliente l\'email per reimpostare la password?')) return;
    setResetting(true);
    setNotice(null);
    try {
      await api(`/admin/clients/${id}/reset-password`, { method: 'POST' });
      setNotice('Email di reset inviata alla cliente.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può inviare il reset password.');
      else setError(err instanceof Error ? err.message : 'Invio non riuscito.');
    } finally {
      setResetting(false);
    }
  }

  async function addNote() {
    const body = newNote.trim();
    if (!body) return;
    setSavingNote(true);
    setNotice(null);
    setError(null);
    try {
      const created = await api<Detail['notes'][number]>(`/admin/clients/${id}/note`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setNotes((ns) => [created, ...ns]);
      setNewNote('');
      setNotice('Nota aggiunta.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio della nota non riuscito.');
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote(noteId: string) {
    if (!confirm('Eliminare questa nota? L\'operazione non è reversibile.')) return;
    setError(null);
    try {
      await api(`/admin/clients/${id}/note/${noteId}`, { method: 'DELETE' });
      setNotes((ns) => ns.filter((n) => n.id !== noteId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può eliminare le note.');
      else setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  if (loading) return <Spinner />;
  if (!d) return <Banner kind="err">{error ?? 'Errore'}</Banner>;

  const p = d.profile;
  const first = d.measurements[d.measurements.length - 1];
  const last = d.measurements[0];
  const lost = first && last ? Math.round((first.weightKg - last.weightKg) * 10) / 10 : null;

  return (
    <>
      <button className="btn ghost sm" onClick={() => navigate(-1)} style={{ marginBottom: 14 }}>
        <i className="ti ti-arrow-left" /> Indietro
      </button>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {/* Intestazione */}
      <div className="card" style={{ background: 'linear-gradient(120deg,#10403a,#12a386)', color: '#fff', border: 'none' }}>
        <div className="spread">
          <div>
            <h2 style={{ color: '#fff', fontSize: 22, margin: 0 }}>{p?.name ?? d.user.email}</h2>
            <p style={{ margin: '4px 0 0', opacity: 0.9 }}>{d.user.email}</p>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>
                {d.user.status === 'active' ? 'Attivo' : 'Sospeso'}
              </span>
              {p?.screeningFlag && <span className="chip red">Percorso supervisionato</span>}
              {d.crm && <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>CRM: {d.crm.stage}</span>}
            </div>
          </div>
          {isAdmin && (
            <button className="btn ghost" onClick={resetPassword} disabled={resetting} style={{ background: 'rgba(255,255,255,.9)' }}>
              <i className="ti ti-key" /> {resetting ? 'Invio…' : 'Reset password'}
            </button>
          )}
        </div>
      </div>

      {/* Team assegnato: coach e nutrizionista (l'admin può cambiare/rimuovere) */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Team assegnato</h2>
        <div className="row" style={{ gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Coach</div>
            {isAdmin ? (
              <select className="select" style={{ width: '100%' }} value={p?.assignedCoachId ?? ''} onChange={(e) => assignTeam('coach', e.target.value)}>
                <option value="">— nessuna (rimuovi) —</option>
                {coaches.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                {p?.assignedCoachId && !coaches.some((o) => o.id === p.assignedCoachId) && (
                  <option value={p.assignedCoachId}>{p.assignedCoach?.displayName ?? 'Assegnata'}</option>
                )}
              </select>
            ) : (
              <b>{p?.assignedCoach?.displayName ?? '—'}</b>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Nutrizionista</div>
            {isAdmin ? (
              <select className="select" style={{ width: '100%' }} value={p?.assignedNutritionistId ?? ''} onChange={(e) => assignTeam('nutritionist', e.target.value)}>
                <option value="">— nessuno (rimuovi) —</option>
                {nutritionists.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                {p?.assignedNutritionistId && !nutritionists.some((o) => o.id === p.assignedNutritionistId) && (
                  <option value={p.assignedNutritionistId}>{p.assignedNutritionist?.displayName ?? 'Assegnato'}</option>
                )}
              </select>
            ) : (
              <b>{p?.assignedNutritionist?.displayName ?? '—'}</b>
            )}
          </div>
        </div>
      </div>

      {/* Note dello staff: editor a sinistra, log a destra */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Note</h2>
        <div className="row" style={{ gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Sinistra: nuova nota */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <textarea
              className="input"
              style={{ width: '100%', minHeight: 120, resize: 'vertical' }}
              placeholder="Scrivi una nota sulla cliente: preferenze, note di percorso, promemoria…"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn" onClick={addNote} disabled={savingNote || !newNote.trim()}>
                <i className="ti ti-device-floppy" /> {savingNote ? 'Salvataggio…' : 'Salva nota'}
              </button>
            </div>
          </div>
          {/* Destra: storico (log) */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Storico note</div>
            {notes.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nessuna nota ancora.</p>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {notes.map((n) => (
                  <div key={n.id} style={{ position: 'relative', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}>
                    {isAdmin && (
                      <button
                        onClick={() => deleteNote(n.id)}
                        title="Elimina nota"
                        style={{ position: 'absolute', top: 4, right: 4, border: 'none', background: 'transparent', color: '#e5484d', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}
                      >
                        <i className="ti ti-x" />
                      </button>
                    )}
                    <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', paddingRight: isAdmin ? 20 : 0 }}>{n.body}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                      {n.author ?? 'Staff'} · {dateTime(n.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Questionario / profilo */}
      <div className="card">
        <h2>Questionario</h2>
        {!p ? (
          <p className="muted">La cliente non ha ancora completato il questionario.</p>
        ) : (
          <>
            <Row label="Nome" value={p.name ?? '—'} />
            <Row label="Età" value={p.age ?? '—'} />
            <Row label="Sesso" value={lab('sex', p.sex)} />
            <Row label="Altezza" value={p.heightCm ? `${p.heightCm} cm` : '—'} />
            <Row label="Peso di partenza" value={p.startWeightKg ? `${p.startWeightKg} kg` : '—'} />
            <Row label="Vita" value={p.startWaistCm ? `${p.startWaistCm} cm` : '—'} />
            <Row label="Fianchi" value={p.startHipsCm ? `${p.startHipsCm} cm` : '—'} />
            <Row label="Regime" value={lab('regime', p.regime)} />
            <Row label="Stile alimentare" value={lab('dietStyle', p.dietStyle)} />
            <Row label="Pasti al giorno" value={p.mealsPerDay ?? '—'} />
            <Row label="Percorso" value={lab('pathType', p.pathType)} />
            <Row label="Lavoro" value={lab('work', p.lifestyle?.work)} />
            <Row label="Tempo per cucinare" value={lab('cookingTime', p.lifestyle?.cookingTime)} />
            <Row label="Pranzo nei feriali" value={lab('weekdayLunch', p.lifestyle?.weekdayLunch)} />
            <Row label="Stile coach" value={lab('coachStyle', p.coachStyle)} />
            <Row label="Carattere" value={lab('character', p.character)} />
            <Row label="Intolleranze" value={p.intolerances?.length ? p.intolerances.join(', ') : 'Nessuna'} />
            <Row label="Cibi non graditi" value={p.dislikedFoods?.length ? p.dislikedFoods.join(', ') : 'Nessuno'} />
            <Row label="Patologie" value={lab('yesno', p.onboardingAnswers?.health?.hasConditions)} />
            <Row label="Farmaci" value={lab('yesno', p.onboardingAnswers?.health?.takesMedications)} />
            <Row
              label="Periodi senza dieta"
              value={
                Array.isArray(p.consents?.pausePeriods) && p.consents.pausePeriods.length
                  ? p.consents.pausePeriods.map((r: { start?: string; end?: string }) => `${date(r.start) } – ${date(r.end)}`).join(' · ')
                  : 'Nessuno'
              }
            />
            <Row
              label="Colore app"
              value={
                p.themeColor ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: p.themeColor, border: '1px solid var(--line)' }} />
                    {p.themeColor}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <Row label="Percorso supervisionato" value={p.screeningFlag ? 'Sì (screening sanitario)' : 'No'} />
            <Row label="Data inizio piano" value={date(p.planStartDate)} />
          </>
        )}
      </div>

      {/* Obiettivo */}
      {d.objective && (
        <div className="card">
          <h2>Obiettivo</h2>
          <Row label="Peso obiettivo" value={d.objective.targetWeightKg ? `${d.objective.targetWeightKg} kg` : '—'} />
          <Row label="Entro il" value={date(d.objective.targetDate)} />
          <Row label="Stato" value={d.objective.status === 'confirmed' ? 'Confermato' : d.objective.status === 'proposed' ? 'Da confermare' : d.objective.status} />
        </div>
      )}

      {/* Pesate */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '18px 20px 4px' }} className="spread">
          <h2 style={{ margin: 0 }}>Pesate</h2>
          {lost != null && <span className={`chip ${lost > 0 ? '' : 'gray'}`}>{lost > 0 ? `−${lost} kg` : `${Math.abs(lost)} kg`} dal via</span>}
        </div>
        {d.measurements.length === 0 ? (
          <div className="empty">Nessuna pesata registrata.</div>
        ) : (
          <table className="grid">
            <thead><tr><th>Data</th><th>Peso</th><th>Vita</th><th>Fianchi</th></tr></thead>
            <tbody>
              {d.measurements.map((m) => (
                <tr key={m.id}>
                  <td>{date(m.date)}</td>
                  <td><b>{m.weightKg} kg</b></td>
                  <td className="muted">{m.waistCm ? `${m.waistCm} cm` : '—'}</td>
                  <td className="muted">{m.hipsCm ? `${m.hipsCm} cm` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Report mensile */}
      {report && (
        <div className="card">
          <div className="spread" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Report mensile</h2>
            <button className="btn" onClick={sendReport} disabled={sendingReport}>
              <i className="ti ti-mail" /> {sendingReport ? 'Invio…' : 'Invia al cliente'}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Periodo: {report.periodLabel} · inviato via email con PDF allegato.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {([
              ['Perso questo mese', kg(report.lostThisMonthKg)],
              ['Perso dall’inizio', kg(report.lostTotalKg)],
              ['Peso attuale', kg(report.currentWeightKg)],
              ['Obiettivo', kg(report.targetWeightKg)],
              ['Check-in nel mese', String(report.checkins)],
              ['Pesate nel mese', String(report.measurements)],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px', minWidth: 120 }}>
                <div className="muted" style={{ fontSize: 11 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Umori (check-in) */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '18px 20px 4px' }}>
          <h2 style={{ margin: 0 }}>Umori e check-in</h2>
        </div>
        {d.checkins.length === 0 ? (
          <div className="empty">Nessun check-in registrato.</div>
        ) : (
          <table className="grid">
            <thead><tr><th>Data</th><th>Umore</th><th>Energia</th><th>Fame</th><th>Stress</th></tr></thead>
            <tbody>
              {d.checkins.map((c) => {
                const m = MOOD[c.mood];
                return (
                  <tr key={c.id}>
                    <td>{date(c.date)}</td>
                    <td><span className={`chip ${m?.chip ?? 'gray'}`}>{m?.label ?? c.mood}</span></td>
                    <td className="muted">{c.energy != null ? `${c.energy}/5` : '—'}</td>
                    <td className="muted">{c.hunger != null ? `${c.hunger}/5` : '—'}</td>
                    <td className="muted">{c.stress != null ? `${c.stress}/5` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Acqua e Passi affiancati */}
      <div className="card-row">
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '18px 20px 4px' }}>
            <h2 style={{ margin: 0 }}>Acqua bevuta</h2>
          </div>
          {d.waterLogs.length === 0 ? (
            <div className="empty">Nessuna registrazione.</div>
          ) : (
            <table className="grid">
              <thead><tr><th>Data</th><th>Bicchieri</th><th>Obiettivo</th></tr></thead>
              <tbody>
                {d.waterLogs.map((w) => (
                  <tr key={w.id}>
                    <td>{date(w.date)}</td>
                    <td>
                      <b>{w.glasses}</b>
                      {w.glasses >= w.goal && w.goal > 0 && <span className="chip" style={{ marginLeft: 8, fontSize: 10 }}>✓</span>}
                    </td>
                    <td className="muted">{w.goal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '18px 20px 4px' }}>
            <h2 style={{ margin: 0 }}>Passi</h2>
          </div>
          {d.stepLogs.length === 0 ? (
            <div className="empty">Nessuna registrazione.</div>
          ) : (
            <table className="grid">
              <thead><tr><th>Data</th><th>Passi</th><th>Obiettivo</th></tr></thead>
              <tbody>
                {d.stepLogs.map((s) => (
                  <tr key={s.id}>
                    <td>{date(s.date)}</td>
                    <td>
                      <b>{s.steps.toLocaleString('it-IT')}</b>
                      {s.steps >= s.goal && s.goal > 0 && <span className="chip" style={{ marginLeft: 8, fontSize: 10 }}>✓</span>}
                    </td>
                    <td className="muted">{s.goal.toLocaleString('it-IT')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Provvigioni accantonate */}
      {d.pendingCommissions.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '18px 20px 4px' }}>
            <h2 style={{ margin: 0 }}>Provvigioni accantonate</h2>
            <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>
              In attesa dell'assegnazione del ruolo: verranno pagate automaticamente quando assegni coach/nutrizionista.
            </p>
          </div>
          <table className="grid">
            <thead><tr><th>Ruolo</th><th>Importo</th><th>Dal</th></tr></thead>
            <tbody>
              {d.pendingCommissions.map((pc) => (
                <tr key={pc.id}>
                  <td>{COMM_ROLE[pc.role] ?? pc.role}</td>
                  <td><b>{euro(pc.amountCents)}</b></td>
                  <td className="muted">{date(pc.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Acquisti */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '18px 20px 4px' }} className="spread">
          <h2 style={{ margin: 0 }}>Acquisti</h2>
          {d.subscription && (
            <span className="chip">{d.subscription.plan?.name} · {lab('subStatus', d.subscription.status)}</span>
          )}
        </div>
        {d.payments.length === 0 ? (
          <div className="empty">Nessun pagamento.</div>
        ) : (
          <table className="grid">
            <thead><tr><th>Descrizione</th><th>Importo</th><th>Metodo</th><th>Stato</th><th>Data</th></tr></thead>
            <tbody>
              {d.payments.map((pay) => (
                <tr key={pay.id}>
                  <td>{pay.description}</td>
                  <td>{euro(pay.amountCents)}</td>
                  <td className="muted">{lab('method', pay.method)}</td>
                  <td>
                    <span className={`chip ${pay.status === 'approved' ? '' : pay.status === 'rejected' ? 'red' : 'amber'}`}>
                      {lab('payStatus', pay.status)}
                    </span>
                  </td>
                  <td className="muted">{date(pay.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
