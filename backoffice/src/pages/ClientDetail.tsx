import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner } from '../components/ui';
import { useTaxonomy } from '../lib/taxonomy';

interface Detail {
  user: {
    id: string; email: string; status: string; locale: string; emailVerifiedAt: string | null; createdAt: string;
    firstName: string | null; lastName: string | null;
    addressLine: string | null; postalCode: string | null; city: string | null; province: string | null; phone: string | null; codiceFiscale: string | null;
  };
  profile: any | null;
  objective: any | null;
  measurements: { id: string; date: string; weightKg: number; waistCm: number | null; hipsCm: number | null; thighsCm: number | null; replacedSnapshot?: { weightKg: number; waistCm: number | null; hipsCm: number | null; thighsCm?: number | null; replacedAt?: string } | null }[];
  checkins: { id: string; date: string; mood: string; energy: number | null; hunger: number | null; stress: number | null }[];
  waterLogs: { id: string; date: string; glasses: number; goal: number }[];
  stepLogs: { id: string; date: string; steps: number; goal: number }[];
  subscription: any | null;
  payments: { id: string; amountCents: number; description: string; method: string; status: string; createdAt: string; approvedAt: string | null }[];
  crm: { stage: string; stageLabel?: string | null; valueCents: number | null } | null;
  notes: { id: string; body: string; createdAt: string; author: string | null }[];
  pendingCommissions: { id: string; role: string; amountCents: number; createdAt: string }[];
}

/** Menu del cliente per la revisione: piatto + stelline date dal cliente. */
interface MenuMeal { slot: string | null; name: string; kcal: number | null; stars: number | null; ratedSameDay: boolean | null; ratedOn: string | null }
interface MenuDayRow { id: string; date: string; level: number; status: string; dietName: string | null; meals: MenuMeal[] }

const SLOT_LABEL: Record<string, string> = {
  breakfast: 'Colazione',
  morning_snack: 'Spuntino',
  lunch: 'Pranzo',
  afternoon_snack: 'Merenda',
  dinner: 'Cena',
};

/** Stelline 1–5 (valutazione del cliente). */
function Stars({ n }: { n: number }) {
  return (
    <span title={`${n}/5`} style={{ color: '#b8863b', letterSpacing: 1, whiteSpace: 'nowrap' }}>
      {'★'.repeat(n)}<span style={{ opacity: 0.25 }}>{'★'.repeat(5 - n)}</span>
    </span>
  );
}

interface ChangeLogRow {
  id: string;
  action: string;
  at: string;
  self: boolean;
  metadata: Record<string, unknown> | null;
  actor: { name: string; email: string; role: string } | null;
}

const CHANGE_ACTION_LABEL: Record<string, string> = {
  'client.update': 'Modifica scheda',
  'client.diet_type.change': 'Cambio tipo di dieta',
  'me.profile.update': 'Modifica dati (dal cliente)',
  'admin.assignment.update': 'Assegnazione coach / nutrizionista',
  'crm.nutritionist.assign': 'Assegnazione nutrizionista',
  'crm.lead.assign': 'Assegnazione coach',
  'crm.lead.accept': 'Coach ha accettato',
  'crm.lead.reject': 'Coach ha rifiutato',
  'auth.email_change_requested': 'Richiesta cambio email',
  'auth.email_change_confirmed': 'Email confermata',
  'auth.email_primary_swapped': 'Email principale cambiata',
  'auth.email_secondary_removed': 'Email secondaria rimossa',
  'client.password_reset.trigger': 'Invio reset password',
};

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
  objective: { dimagrimento: 'Dimagrimento', mantenimento: 'Mantenimento' },
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

const fldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' };

/** Form di modifica della scheda (anagrafica + questionario). */
function EditCard({ form, setForm, lockDietType }: { form: Record<string, string>; setForm: (u: (p: Record<string, string>) => Record<string, string>) => void; lockDietType?: boolean }) {
  const { regimes, styles } = useTaxonomy();
  const up = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const T = (k: string, label: string, type = 'text') => (
    <label style={fldStyle}><span>{label}</span><input className="input" type={type} value={form[k] ?? ''} onChange={(e) => up(k, e.target.value)} /></label>
  );
  // Regime e Stile = TIPO DI DIETA: modificabili solo col permesso "Cambia tipo di dieta".
  const S = (k: string, label: string, opts: [string, string][]) => {
    const locked = !!lockDietType && (k === 'regime' || k === 'dietStyle');
    return (
      <label style={fldStyle} title={locked ? 'Il tipo di dieta lo cambia chi ha il permesso "Cambia tipo di dieta" (nutrizionista o amministrazione).' : undefined}>
        <span>{label}{locked && <i className="ti ti-lock" style={{ marginLeft: 4, fontSize: 11 }} />}</span>
        <select className="select" value={form[k] ?? ''} disabled={locked} onChange={(e) => up(k, e.target.value)}>
          <option value="">—</option>
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
    );
  };
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Modifica scheda</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {T('firstName', 'Nome')}{T('lastName', 'Cognome')}
        {T('phone', 'Telefono')}{T('codiceFiscale', 'Codice fiscale')}
        {T('addressLine', 'Via e n. civico')}
        {T('postalCode', 'CAP')}{T('city', 'Città')}
        {T('province', 'Provincia')}{T('name', 'Nome nel percorso')}
        {T('age', 'Età', 'number')}{S('sex', 'Sesso', [['female', 'Donna'], ['male', 'Uomo']])}
        {T('heightCm', 'Altezza (cm)', 'number')}{T('startWeightKg', 'Peso (kg)', 'number')}
        {T('startWaistCm', 'Vita (cm)', 'number')}{T('startHipsCm', 'Fianchi (cm)', 'number')}
        {S('regime', 'Regime', regimes.map((r) => [r.code, r.label] as [string, string]))}
        {S('dietStyle', 'Stile', styles.map((st) => [st.code, st.label] as [string, string]))}
        {S('objective', 'Fase (obiettivo dieta)', [['dimagrimento', 'Dimagrimento'], ['mantenimento', 'Mantenimento']])}
        {S('pathType', 'Pasti / percorso', [['classic3', '3 pasti'], ['five', '5 pasti'], ['intermittent_fasting', 'Digiuno intermittente']])}
        {S('coachStyle', 'Stile coach', [['daily', 'Quotidiano'], ['when_needed', 'Quando serve'], ['on_request', 'Su richiesta']])}
        {S('character', 'Carattere', [['follows', 'Segue bene'], ['needs_push', 'Va spronata'], ['perseveres', 'Persevera'], ['quits', 'Molla facilmente']])}
        {T('intolerances', 'Intolleranze (virgola)')}{T('dislikedFoods', 'Cibi non graditi (virgola)')}
        {T('themeColor', 'Colore app')}
      </div>
    </div>
  );
}

export function ClientDetail() {
  const { regimeLabel, styleLabel } = useTaxonomy();
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, user: me } = useAuth();
  const isAdmin = can('permissions'); // il reset password è azione admin
  // Chi può caricare la contabile per conto della cliente (mai approvarla da qui).
  const canUploadReceipt = me?.role === 'coach' || me?.role === 'sales' || me?.role === 'admin';
  const [d, setD] = useState<Detail | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  // Note dello staff (log)
  const [notes, setNotes] = useState<Detail['notes']>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Log modifiche (audit del profilo)
  const [logOpen, setLogOpen] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [logRows, setLogRows] = useState<ChangeLogRow[]>([]);
  const [logErr, setLogErr] = useState<string | null>(null);

  async function openLog() {
    setLogOpen(true);
    setLogLoading(true);
    setLogErr(null);
    try {
      setLogRows(await api<ChangeLogRow[]>(`/admin/clients/${id}/audit`));
    } catch (err) {
      setLogErr(err instanceof ApiError ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLogLoading(false);
    }
  }

  // Menu del cliente (revisione nutrizionista): giorni + piatti + stelline del cliente
  const [menusOpen, setMenusOpen] = useState(false);
  const [menusLoading, setMenusLoading] = useState(false);
  const [menuDays, setMenuDays] = useState<MenuDayRow[]>([]);
  const [menusErr, setMenusErr] = useState<string | null>(null);

  async function openMenus() {
    setMenusOpen(true);
    setMenusLoading(true);
    setMenusErr(null);
    try {
      const r = await api<{ days: MenuDayRow[] }>(`/admin/clients/${id}/menus`);
      setMenuDays(r.days);
    } catch (err) {
      setMenusErr(err instanceof ApiError ? err.message : 'Caricamento dei menu non riuscito.');
    } finally {
      setMenusLoading(false);
    }
  }

  // Correzione misure inserite male dal cliente (permesso dedicato "Correggi misure cliente")
  const canFixMeasures = can('fix_measures', 'manage');
  // Cambio data inizio piano (permesso dedicato "Cambia data inizio piano")
  const canChangePlanStart = can('change_plan_start', 'manage');

  /** Sposta la data di inizio del piano: la fine si ricalcola e i menu ripartono da lì. */
  async function changePlanStart() {
    const cur = d?.subscription?.startDate ? String(d.subscription.startDate).slice(0, 10) : '';
    const input = prompt('Nuova data di INIZIO del piano (AAAA-MM-GG).\nLa data di fine viene ricalcolata dalla durata del piano e i menu ripartono dalla nuova data.', cur);
    if (input === null) return;
    const val = input.trim();
    // Accetta anche GG/MM/AAAA e lo converte.
    const m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : val;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) { setError('Data non valida: usa AAAA-MM-GG (o GG/MM/AAAA).'); return; }
    setError(null); setNotice(null);
    try {
      const r = await api<{ startDate: string; endDate: string }>(`/admin/clients/${id}/plan-start`, { method: 'PATCH', body: JSON.stringify({ date: iso }) });
      setNotice(`Inizio piano spostato al ${date(r.startDate)} (fine ricalcolata: ${date(r.endDate)}).`);
      void loadDetail();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cambio data non riuscito.');
    }
  }
  const [fixing, setFixing] = useState<Detail['measurements'][number] | null>(null);

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

  async function loadDetail(initial = false) {
    if (initial) setLoading(true);
    try {
      const data = await api<Detail>(`/admin/clients/${id}`);
      setD(data);
      setNotes(data.notes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      if (initial) setLoading(false);
    }
  }
  useEffect(() => {
    void loadDetail(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /** Cambio email di accesso del cliente (solo admin): usa l'endpoint admin utenti. */
  async function changeEmail() {
    if (!d) return;
    const next = prompt(`Nuova email di accesso per ${d.user.email}:\n(le sessioni attive del cliente verranno chiuse; da quel momento accede con la nuova email)`, d.user.email);
    if (next === null) return;
    const email = next.trim().toLowerCase();
    if (!email || !email.includes('@') || email === d.user.email.toLowerCase()) {
      if (email && email !== d.user.email.toLowerCase()) setError('Email non valida.');
      return;
    }
    setNotice(null);
    setError(null);
    try {
      await api(`/admin/users/${d.user.id}`, { method: 'PATCH', body: JSON.stringify({ email }) });
      setNotice(`Email cambiata in ${email}. Il cliente ora accede con la nuova email.`);
      void loadDetail();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cambio email non riuscito.');
    }
  }

  async function deleteClient() {
    const label = d?.user.email ?? 'questo cliente';
    if (!confirm(`Eliminare DEFINITIVAMENTE ${label} e TUTTO ciò che gli è collegato (questionario, misure, acquisti, note…)?\n\nL'operazione non è reversibile.`)) return;
    if (!confirm('Confermi di nuovo: elimino tutto in modo definitivo?')) return;
    setDeleting(true);
    setError(null);
    try {
      await api(`/admin/clients/${id}`, { method: 'DELETE' });
      navigate(-1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può eliminare un cliente.');
      else setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
      setDeleting(false);
    }
  }

  function startEdit() {
    if (!d) return;
    const u = d.user;
    const pr = d.profile ?? {};
    setForm({
      firstName: u.firstName ?? '', lastName: u.lastName ?? '', phone: u.phone ?? '',
      addressLine: u.addressLine ?? '', postalCode: u.postalCode ?? '', city: u.city ?? '', province: u.province ?? '', codiceFiscale: u.codiceFiscale ?? '',
      name: pr.name ?? '', age: pr.age ?? '', sex: pr.sex ?? '', heightCm: pr.heightCm ?? '',
      startWeightKg: pr.startWeightKg ?? '', startWaistCm: pr.startWaistCm ?? '', startHipsCm: pr.startHipsCm ?? '',
      regime: pr.regime ?? '', dietStyle: pr.dietStyle ?? '', mealsPerDay: pr.mealsPerDay ? String(pr.mealsPerDay) : '',
      objective: pr.objective ?? 'dimagrimento',
      pathType: pr.pathType ?? '', coachStyle: pr.coachStyle ?? '', character: pr.character ?? '',
      intolerances: (pr.intolerances ?? []).join(', '), dislikedFoods: (pr.dislikedFoods ?? []).join(', '),
      themeColor: pr.themeColor ?? '',
    });
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const f = form;
    const num = (v: string) => (v === '' || v == null ? undefined : Number(v));
    const list = (v: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
    const dto: Record<string, unknown> = {
      firstName: f.firstName, lastName: f.lastName, phone: f.phone,
      addressLine: f.addressLine, postalCode: f.postalCode, city: f.city, province: f.province, codiceFiscale: f.codiceFiscale || undefined,
      name: f.name,
      sex: f.sex || undefined, regime: f.regime || undefined, dietStyle: f.dietStyle || undefined,
      objective: f.objective || undefined,
      pathType: f.pathType || undefined, coachStyle: f.coachStyle || undefined, character: f.character || undefined,
      themeColor: f.themeColor || undefined,
      intolerances: list(f.intolerances), dislikedFoods: list(f.dislikedFoods),
    };
    const age = num(f.age); if (age !== undefined) dto.age = age;
    const h = num(f.heightCm); if (h !== undefined) dto.heightCm = h;
    const w = num(f.startWeightKg); if (w !== undefined) dto.startWeightKg = w;
    const wa = num(f.startWaistCm); if (wa !== undefined) dto.startWaistCm = wa;
    const hi = num(f.startHipsCm); if (hi !== undefined) dto.startHipsCm = hi;
    // Pasti dedotti dall'unica scelta "Pasti / percorso": classic3 e digiuno → 3, five → 5.
    const mealsByPath: Record<string, number> = { classic3: 3, five: 5, intermittent_fasting: 3, supplements: 5 };
    if (f.pathType && mealsByPath[f.pathType]) dto.mealsPerDay = mealsByPath[f.pathType];
    try {
      await api(`/admin/clients/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
      const data = await api<Detail>(`/admin/clients/${id}`);
      setD(data);
      setNotes(data.notes ?? []);
      setEditing(false);
      setNotice('Scheda aggiornata.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
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

  /** La coach carica la contabile del bonifico per conto della cliente (mai approvazione da qui). */
  async function uploadReceiptFor(paymentId: string, file: File) {
    if (file.size > 5 * 1024 * 1024) { setError('La contabile supera i 5 MB.'); return; }
    const mime = file.type || 'application/pdf';
    setUploadingReceipt(paymentId); setError(null); setNotice(null);
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
        r.onerror = () => reject(new Error('Lettura del file non riuscita.'));
        r.readAsDataURL(file);
      });
      await api(`/staff/payments/${paymentId}/receipt`, { method: 'POST', body: JSON.stringify({ fileName: file.name, mimeType: mime, contentBase64 }) });
      setNotice('Contabile caricata: ora è in attesa di verifica e approvazione (admin/responsabile).');
      const data = await api<Detail>(`/admin/clients/${id}`);
      setD(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Caricamento della contabile non riuscito.');
    } finally {
      setUploadingReceipt(null);
    }
  }

  if (loading) return <Spinner />;
  if (!d) return <Banner kind="err">{error ?? 'Errore'}</Banner>;

  const p = d.profile;
  const fullName = [d.user.firstName, d.user.lastName].filter(Boolean).join(' ');
  const fullAddress = [d.user.addressLine, [d.user.postalCode, d.user.city].filter(Boolean).join(' ').trim(), d.user.province]
    .filter(Boolean)
    .join(', ');
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
            {fullName && <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 600 }}>{fullName}</p>}
            <p style={{ margin: '4px 0 0', opacity: 0.9 }}>{d.user.email}</p>
            {d.user.phone && <p style={{ margin: '2px 0 0', opacity: 0.9 }}><i className="ti ti-phone" style={{ verticalAlign: '-2px', fontSize: 14 }} /> {d.user.phone}</p>}
            {fullAddress && <p style={{ margin: '2px 0 0', opacity: 0.9 }}><i className="ti ti-map-pin" style={{ verticalAlign: '-2px', fontSize: 14 }} /> {fullAddress}</p>}
            {d.user.codiceFiscale && <p style={{ margin: '2px 0 0', opacity: 0.9, fontSize: 13 }}><i className="ti ti-id" style={{ verticalAlign: '-2px', fontSize: 14 }} /> CF: {d.user.codiceFiscale}</p>}
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>
                {d.user.status === 'active' ? 'Attivo' : 'Sospeso'}
              </span>
              {p?.screeningFlag && <span className="chip red">Percorso supervisionato</span>}
              {d.crm && <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>CRM: {d.crm.stageLabel ?? d.crm.stage}</span>}
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {!editing ? (
              <button className="btn ghost" onClick={startEdit} style={{ background: 'rgba(255,255,255,.9)' }}>
                <i className="ti ti-edit" /> Modifica
              </button>
            ) : (
              <>
                <button className="btn" onClick={save} disabled={saving} style={{ background: '#fff', color: '#0e7c66' }}>
                  <i className="ti ti-device-floppy" /> {saving ? 'Salvo…' : 'Salva'}
                </button>
                <button className="btn ghost" onClick={() => setEditing(false)} disabled={saving} style={{ background: 'rgba(255,255,255,.9)' }}>Annulla</button>
              </>
            )}
            {!editing && (
              <button className="btn ghost" onClick={openLog} style={{ background: 'rgba(255,255,255,.9)' }}>
                <i className="ti ti-history" /> Log modifiche
              </button>
            )}
            {isAdmin && !editing && (
              <button className="btn ghost" onClick={resetPassword} disabled={resetting} style={{ background: 'rgba(255,255,255,.9)' }}>
                <i className="ti ti-key" /> {resetting ? 'Invio…' : 'Reset password'}
              </button>
            )}
            {isAdmin && !editing && (
              <button className="btn ghost" onClick={changeEmail} title="Cambia l'email di accesso del cliente" style={{ background: 'rgba(255,255,255,.9)' }}>
                <i className="ti ti-mail-cog" /> Cambia email
              </button>
            )}
            {isAdmin && !editing && (
              <button className="btn ghost" onClick={deleteClient} disabled={deleting} style={{ background: 'rgba(255,255,255,.9)', color: '#b3261e' }}>
                <i className="ti ti-trash" /> {deleting ? 'Elimino…' : 'Elimina'}
              </button>
            )}
          </div>
        </div>
      </div>

      <TravelCard clientId={id ?? ''} profile={p} />

      <PauseRequestsCard clientId={id ?? ''} clientName={p?.name ?? d.user.email} />

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

      {editing && <EditCard form={form} setForm={setForm} lockDietType={!can('change_diet_type', 'manage')} />}

      {/* Questionario / profilo */}
      {!editing && (
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
            <Row label="Regime" value={p.regime ? regimeLabel(p.regime) : '—'} />
            <Row label="Stile alimentare" value={p.dietStyle ? styleLabel(p.dietStyle) : '—'} />
            <Row label="Fase (obiettivo dieta)" value={lab('objective', p.objective ?? 'dimagrimento')} />
            <Row label="Pasti / percorso" value={lab('pathType', p.pathType)} />
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
      )}

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
            <thead><tr><th>Data</th><th>Peso</th><th>Vita</th><th>Fianchi</th>{canFixMeasures && <th />}</tr></thead>
            <tbody>
              {d.measurements.map((m) => (
                <tr key={m.id}>
                  <td>
                    {date(m.date)}
                    {m.replacedSnapshot && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 2, color: '#B4491F' }} title="La cliente ha corretto la misura di questo giorno. Il valore sostituito NON viene conteggiato in grafici e report.">
                        <i className="ti ti-replace" style={{ fontSize: 12, verticalAlign: '-1px' }} /> sostituita · era {m.replacedSnapshot.weightKg} kg
                        {m.replacedSnapshot.waistCm ? ` · ${m.replacedSnapshot.waistCm} cm vita` : ''}
                        {m.replacedSnapshot.hipsCm ? ` · ${m.replacedSnapshot.hipsCm} cm fianchi` : ''}
                      </div>
                    )}
                  </td>
                  <td><b>{m.weightKg} kg</b></td>
                  <td className="muted">{m.waistCm ? `${m.waistCm} cm` : '—'}</td>
                  <td className="muted">{m.hipsCm ? `${m.hipsCm} cm` : '—'}</td>
                  {canFixMeasures && (
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn ghost sm" title="Correggi la misura (se inserita male dal cliente)" onClick={() => setFixing(m)}>
                        <i className="ti ti-pencil" />
                      </button>
                    </td>
                  )}
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
            <button
              className="chip"
              onClick={openMenus}
              title="Apri i menu del cliente per controllarli (con le stelline date ai piatti)"
              style={{ cursor: 'pointer', border: '1px solid var(--line)' }}
            >
              {d.subscription.plan?.name} · {lab('subStatus', d.subscription.status)} <i className="ti ti-tools-kitchen-2" style={{ marginLeft: 4 }} />
            </button>
          )}
        </div>
        {/* Data di inizio piano: visibile a tutti, modificabile col permesso dedicato. */}
        {d.subscription?.startDate && (
          <div className="muted" style={{ padding: '0 20px 8px', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
            Inizio piano: <b style={{ color: 'var(--ink, #1F2933)' }}>{date(d.subscription.startDate)}</b>
            {d.subscription.endDate && <> · fine {date(d.subscription.endDate)}</>}
            {canChangePlanStart && (
              <button className="btn ghost sm" onClick={() => void changePlanStart()} title="Cambia la data di inizio (la fine si ricalcola e i menu ripartono da lì)">
                <i className="ti ti-pencil" />
              </button>
            )}
          </div>
        )}
        {d.payments.length === 0 ? (
          <div className="empty">Nessun pagamento.</div>
        ) : (
          <table className="grid">
            <thead><tr><th>Descrizione</th><th>Importo</th><th>Metodo</th><th>Stato</th><th>Data</th>{canUploadReceipt && <th>Contabile</th>}</tr></thead>
            <tbody>
              {d.payments.map((pay) => {
                const needsReceipt = pay.method === 'bank_transfer' && (pay.status === 'pending' || pay.status === 'rejected' || pay.status === 'receipt_uploaded');
                return (
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
                    {canUploadReceipt && (
                      <td>
                        {needsReceipt ? (
                          <label className="btn ghost sm" style={{ cursor: 'pointer' }} title="Carica la contabile del bonifico per conto della cliente (l'approvazione resta all'amministrazione)">
                            <i className="ti ti-file-upload" /> {uploadingReceipt === pay.id ? 'Carico…' : pay.status === 'receipt_uploaded' ? 'Sostituisci' : 'Carica contabile'}
                            <input
                              type="file"
                              accept="application/pdf,image/jpeg,image/png,image/heic"
                              style={{ display: 'none' }}
                              disabled={uploadingReceipt === pay.id}
                              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadReceiptFor(pay.id, f); }}
                            />
                          </label>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Popup: Menu del cliente (revisione nutrizionista, con stelline) */}
      {menusOpen && (
        <div className="overlay" onClick={() => setMenusOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '82vh', overflowY: 'auto' }}>
            <div className="spread" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}><i className="ti ti-tools-kitchen-2" /> Menu del cliente</h2>
              <button className="btn ghost sm" onClick={() => setMenusOpen(false)}><i className="ti ti-x" /> Chiudi</button>
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
              Ultime 8 settimane e prossimi 7 giorni. Le stelline sono le valutazioni date dal cliente ai piatti; quando la valutazione è di un altro giorno lo indichiamo.
            </p>
            {menusErr && <Banner kind="err">{menusErr}</Banner>}
            {menusLoading ? (
              <Spinner />
            ) : menuDays.length === 0 ? (
              <div className="empty">Nessun menu generato per questo cliente.</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {menuDays.map((day) => (
                  <div key={day.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px' }}>
                    <div className="spread" style={{ marginBottom: 6 }}>
                      <b>{date(day.date)}</b>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {day.dietName ?? '—'} · livello {day.level}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {day.meals.map((meal, i) => (
                        <div key={i} className="row" style={{ gap: 8, fontSize: 13, alignItems: 'baseline' }}>
                          <span className="muted" style={{ width: 84, flexShrink: 0, fontSize: 12 }}>{(meal.slot && SLOT_LABEL[meal.slot]) ?? meal.slot ?? '—'}</span>
                          <span style={{ flex: 1 }}>{meal.name}</span>
                          {meal.kcal != null && <span className="muted" style={{ fontSize: 11.5 }}>{meal.kcal} kcal</span>}
                          {meal.stars != null ? (
                            <span>
                              <Stars n={meal.stars} />
                              {meal.ratedSameDay === false && meal.ratedOn && (
                                <span className="muted" style={{ fontSize: 10.5, marginLeft: 4 }} title="Valutazione data alla stessa ricetta in un altro giorno">({date(meal.ratedOn)})</span>
                              )}
                            </span>
                          ) : (
                            <span className="muted" style={{ fontSize: 11 }}>non valutato</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Popup: correzione misura (permesso "Correggi misure cliente") */}
      {fixing && (
        <FixMeasureModal
          measure={fixing}
          onClose={() => setFixing(null)}
          onSaved={() => { setFixing(null); setNotice('Misura corretta.'); void loadDetail(); }}
          clientId={id!}
        />
      )}

      {/* Popup: Log modifiche */}
      {logOpen && (
        <div className="overlay" onClick={() => setLogOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="spread" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}><i className="ti ti-history" /> Log modifiche</h2>
              <button className="btn ghost sm" onClick={() => setLogOpen(false)}><i className="ti ti-x" /> Chiudi</button>
            </div>
            {logErr && <Banner kind="err">{logErr}</Banner>}
            {logLoading ? (
              <Spinner />
            ) : logRows.length === 0 ? (
              <div className="empty">Nessuna modifica registrata per questo cliente.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {logRows.map((r) => {
                  const meta = r.metadata ?? {};
                  const newEmail = typeof meta.newEmail === 'string' ? meta.newEmail : null;
                  return (
                    <div key={r.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
                      <div className="spread" style={{ alignItems: 'baseline' }}>
                        <b style={{ fontSize: 14 }}>{CHANGE_ACTION_LABEL[r.action] ?? r.action}</b>
                        <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(r.at).toLocaleString('it-IT')}</span>
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                        {r.self ? 'Modificato dal cliente' : r.actor ? <>Da <b>{r.actor.name}</b> ({r.actor.role})</> : 'Da sistema'}
                        {newEmail && <> · nuova email: <b>{newEmail}</b></>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}


interface PauseReq { id: string; clientId: string; name: string; startDate: string; endDate: string; days: number; createdAt: string }

/**
 * Richieste di pausa (congelamento vacanza) di questa cliente in attesa di
 * approvazione. Compaiono solo quelle >20 giorni: coach/nutrizionista assegnati
 * (o capo nutrizionista/admin) possono approvare o rifiutare.
 */
function PauseRequestsCard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [rows, setRows] = useState<PauseReq[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fmt = (s: string) => new Date(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });

  async function load() {
    try {
      const all = await api<PauseReq[]>('/staff/pause-requests');
      setRows(all.filter((r) => r.clientId === clientId));
    } catch { /* ignora */ }
  }
  useEffect(() => { load(); }, [clientId]);

  async function decide(id: string, approve: boolean) {
    setBusy(id); setErr(null); setMsg(null);
    try {
      await api(`/staff/pause-requests/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ approve, note: note[id]?.trim() || undefined }),
      });
      setMsg(approve ? `Pausa approvata: la scadenza di ${clientName} è stata spostata in avanti.` : 'Richiesta rifiutata: la cliente è stata avvisata.');
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0 && !msg) return null;

  return (
    <div className="card" style={{ borderLeft: '4px solid #E8825A' }}>
      <h2 style={{ marginTop: 0 }}><i className="ti ti-snowflake" style={{ verticalAlign: '-2px', color: '#E8825A' }} /> Richieste di pausa</h2>
      <p className="hint" style={{ marginTop: 0 }}>Pausa oltre i 20 giorni: se approvi, il piano si congela e la scadenza slitta in avanti dei giorni richiesti.</p>
      {err && <Banner kind="err">{err}</Banner>}
      {msg && <Banner kind="ok">{msg}</Banner>}
      {rows.map((r) => (
        <div key={r.id} className="card" style={{ background: '#FFF8F4', boxShadow: 'none', marginBottom: 8 }}>
          <div className="spread" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <b>{fmt(r.startDate)} – {fmt(r.endDate)}</b>
              <div className="muted" style={{ fontSize: 12 }}>{r.days} giorni · richiesta il {fmt(r.createdAt)}</div>
            </div>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <input
                className="input"
                style={{ maxWidth: 220 }}
                placeholder="Nota (facoltativa)"
                value={note[r.id] ?? ''}
                onChange={(e) => setNote({ ...note, [r.id]: e.target.value })}
              />
              <button className="btn" onClick={() => decide(r.id, true)} disabled={busy === r.id} style={{ background: '#0e7c66' }}>
                <i className="ti ti-check" /> {busy === r.id ? '…' : 'Approva'}
              </button>
              <button className="btn ghost" onClick={() => decide(r.id, false)} disabled={busy === r.id} style={{ color: '#b3261e' }}>
                <i className="ti ti-x" /> Rifiuta
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TravelCard({ clientId, profile }: { clientId: string; profile: { travelState?: string | null; travelStart?: string | null; travelEnd?: string | null } | null }) {
  const [state, setState] = useState<string>(profile?.travelState ?? '');
  const [start, setStart] = useState<string>(profile?.travelStart ? String(profile.travelStart).slice(0, 10) : '');
  const [end, setEnd] = useState<string>(profile?.travelEnd ? String(profile.travelEnd).slice(0, 10) : '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true); setErr(null); setMsg(null);
    try {
      await api(`/admin/clients/${clientId}/travel`, { method: 'PATCH', body: JSON.stringify({ state, start, end }) });
      setMsg(state === 'in_vacanza' ? 'In vacanza: il popup misure è sospeso fino al rientro.' : state === 'rientrato' ? 'Rientro registrato: evento inviato al CRM/marketing.' : 'Modalità viaggio aggiornata.');
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Modalità viaggio (piani estate)</h2>
      <p className="hint" style={{ marginTop: 0 }}>In vacanza il popup misure si sospende; al rientro parte un evento verso il CRM/marketing (campagna di rientro).</p>
      {err && <Banner kind="err">{err}</Banner>}
      {msg && <Banner kind="ok">{msg}</Banner>}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="field" style={{ minWidth: 180 }}>
          <span>Stato</span>
          <select className="select" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">— nessuna —</option>
            <option value="in_partenza">In partenza</option>
            <option value="in_vacanza">In vacanza</option>
            <option value="rientrato">Rientrato/a</option>
          </select>
        </label>
        <label className="field" style={{ maxWidth: 160 }}><span>Dal</span><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="field" style={{ maxWidth: 160 }}><span>Al</span><input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <button className="btn" onClick={save} disabled={saving}><i className="ti ti-device-floppy" /> {saving ? 'Salvo…' : 'Salva'}</button>
      </div>
    </div>
  );
}

/** Correzione di una misura inserita male dal cliente (tracciata in audit con prima/dopo). */
function FixMeasureModal({ clientId, measure, onClose, onSaved }: {
  clientId: string;
  measure: { id: string; date: string; weightKg: number; waistCm: number | null; hipsCm: number | null; thighsCm: number | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const toS = (v: number | null) => (v != null ? String(v).replace('.', ',') : '');
  const [weight, setWeight] = useState(toS(measure.weightKg));
  const [waist, setWaist] = useState(toS(measure.waistCm));
  const [hips, setHips] = useState(toS(measure.hipsCm));
  const [thighs, setThighs] = useState(toS(measure.thighsCm));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** '' → null (svuota il dato) · numero valido → numero · altro → undefined (errore). */
  const num = (v: string): number | null | undefined => {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  };

  async function save() {
    setErr(null);
    const w = num(weight);
    if (w == null) { setErr('Il peso è obbligatorio e deve essere un numero (kg).'); return; }
    const body: Record<string, unknown> = { weightKg: w };
    for (const [key, val, label] of [['waistCm', waist, 'Vita'], ['hipsCm', hips, 'Fianchi'], ['thighsCm', thighs, 'Cosce']] as const) {
      const parsed = num(val);
      if (parsed === undefined) { setErr(`${label}: valore non valido.`); return; }
      body[key] = parsed;
    }
    setBusy(true);
    try {
      await api(`/admin/clients/${clientId}/measurements/${measure.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
      setBusy(false);
    }
  }

  const F = (label: string, v: string, set: (x: string) => void, unit: string) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
      <span>{label} ({unit})</span>
      <input className="input" inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} placeholder="—" />
    </label>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}><i className="ti ti-pencil" /> Correggi misura</h2>
          <button className="btn ghost sm" onClick={onClose}><i className="ti ti-x" /> Chiudi</button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
          Pesata del <b>{date(measure.date)}</b>. Lascia vuota una circonferenza per rimuovere il dato. La correzione resta tracciata nel log (prima/dopo).
        </p>
        {err && <Banner kind="err">{err}</Banner>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {F('Peso', weight, setWeight, 'kg')}
          {F('Vita', waist, setWaist, 'cm')}
          {F('Fianchi', hips, setHips, 'cm')}
          {F('Cosce', thighs, setThighs, 'cm')}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
          <button className="btn" onClick={save} disabled={busy}><i className="ti ti-device-floppy" /> {busy ? 'Salvo…' : 'Salva correzione'}</button>
        </div>
      </div>
    </div>
  );
}
