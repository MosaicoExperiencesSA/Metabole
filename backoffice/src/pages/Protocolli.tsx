import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Spinner, Toggle } from '../components/ui';

interface Condition { field: string; op: string; value?: unknown }
interface ActionDef { menu?: string; tone?: string; timing?: string; levelDelta?: number; flagForReview?: boolean; note?: string }
interface Definition { priority?: number; conditions?: Condition[]; action?: ActionDef }
interface ProtocolRow {
  id: string;
  name: string;
  type: string;
  appliesTo: string | null;
  status: string;
  definition: Definition | null;
  author: { displayName: string } | null;
  validatedBy: { displayName: string } | null;
}

const TYPE: Record<string, string> = { menu_correction: 'Correzione menu', threshold: 'Soglia', library: 'Libreria' };
const TYPES = ['menu_correction', 'threshold', 'library'];
const STATUS: Record<string, { label: string; chip: string }> = {
  pending: { label: 'Da validare', chip: 'amber' },
  approved: { label: 'Approvato', chip: '' },
  rejected: { label: 'Rifiutato', chip: 'red' },
};

// Vocabolario del motore (rules-evaluator).
const FIELDS: [string, string][] = [
  ['stallDays', 'Giorni di stallo'], ['weeklyRateKg', 'Ritmo settimanale (kg)'], ['direction', 'Direzione'],
  ['rapidLoss', 'Calo rapido'], ['progressPercent', '% verso obiettivo'], ['measurementsCount', 'N. misurazioni'],
  ['moodAvg', 'Umore medio (1-5)'], ['energyAvg', 'Energia media (1-5)'], ['stressAvg', 'Stress medio (1-5)'],
  ['lowEnergyChronic', 'Energia bassa cronica'], ['checkinsLast7', 'Check-in ultimi 7'], ['cookingTime', 'Tempo per cucinare'],
  ['busyLifestyle', 'Vita frenetica'], ['upcomingEvent', 'Evento in arrivo'], ['pausePeriodActive', 'Pausa attiva'],
  ['avgRating', 'Voto medio ricette'], ['adherenceLast7', 'Aderenza ultimi 7'],
];
const OPS: [string, string][] = [
  ['gte', '≥'], ['lte', '≤'], ['gt', '>'], ['lt', '<'], ['eq', '='], ['ne', '≠'], ['in', 'tra (lista)'],
  ['is_true', 'è vero'], ['is_false', 'è falso'], ['is_null', 'è vuoto'], ['not_null', 'non è vuoto'],
];
const NO_VALUE_OPS = ['is_true', 'is_false', 'is_null', 'not_null'];
const MENUS: [string, string][] = [['keep', 'Mantieni'], ['practical', 'Pratico'], ['correction', 'Correzione'], ['lighten_before_event', 'Alleggerisci pre-evento'], ['increase_calories', 'Aumenta calorie'], ['celebrate_step', 'Celebra traguardo']];
const TONES: [string, string][] = [['supportive', 'Di sostegno'], ['neutral', 'Neutro'], ['encouraging', 'Incoraggiante'], ['celebratory', 'Festoso'], ['gentle', 'Delicato']];
const TIMINGS: [string, string][] = [['morning', 'Mattina'], ['lunch', 'Pranzo'], ['evening', 'Sera']];

export function Protocolli() {
  const { permissions } = useAuth();
  const role = permissions?.role;
  const isHead = role === 'head_nutritionist';
  const isNutri = role === 'nutritionist' || role === 'head_nutritionist';
  const [rows, setRows] = useState<ProtocolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProtocolRow | 'new' | null>(null);

  async function load() {
    try {
      setRows(await api<ProtocolRow[]>(`/protocols${status ? `?status=${status}` : ''}`));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata a nutrizionisti e amministratori.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  async function validate(id: string, approve: boolean) {
    setBusy(id + approve); setError(null);
    try {
      await api(`/protocols/${id}/validate`, { method: 'POST', body: JSON.stringify({ approve }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <p className="muted" style={{ margin: 0 }}>Regole del motore (menu, soglie): create dai nutrizionisti, validate dal capo.</p>
        <div className="row" style={{ gap: 8 }}>
          <select className="select" style={{ width: 170 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tutti gli stati</option>
            <option value="pending">Da validare</option>
            <option value="approved">Approvati</option>
            <option value="rejected">Rifiutati</option>
          </select>
          {isNutri && <button className="btn" onClick={() => setEditing('new')}><i className="ti ti-plus" /> Nuovo protocollo</button>}
        </div>
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty">Nessun protocollo.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Nome</th><th>Tipo</th><th>Si applica a</th><th>Autore</th><th>Validato da</th><th>Stato</th>
                {isNutri && <th>Azioni</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="muted">{TYPE[r.type] ?? r.type}</td>
                  <td className="muted">{r.appliesTo ?? '—'}</td>
                  <td className="muted">{r.author?.displayName ?? '—'}</td>
                  <td className="muted">{r.validatedBy?.displayName ?? '—'}</td>
                  <td><span className={`chip ${STATUS[r.status]?.chip ?? 'gray'}`}>{STATUS[r.status]?.label ?? r.status}</span></td>
                  {isNutri && (
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {r.status !== 'approved' && (
                          <button className="btn ghost sm" disabled={!!busy} onClick={() => setEditing(r)}><i className="ti ti-edit" /> Modifica</button>
                        )}
                        {r.status === 'pending' && isHead && (
                          <>
                            <button className="btn sm" disabled={!!busy} onClick={() => validate(r.id, true)}><i className="ti ti-check" /> Approva</button>
                            <button className="btn ghost sm" disabled={!!busy} style={{ color: 'var(--danger)' }} onClick={() => validate(r.id, false)}><i className="ti ti-x" /> Rifiuta</button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <ProtocolModal
          protocol={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </>
  );
}

interface FormCond { field: string; op: string; value: string }
interface Form {
  name: string; type: string; appliesTo: string; priority: string;
  conditions: FormCond[];
  menu: string; tone: string; timing: string; levelDelta: string; flagForReview: boolean; note: string;
}

function toForm(p: ProtocolRow): Form {
  const d = p.definition ?? {};
  const a = d.action ?? {};
  return {
    name: p.name, type: p.type, appliesTo: p.appliesTo ?? '', priority: String(d.priority ?? 1),
    conditions: (d.conditions ?? []).length
      ? (d.conditions ?? []).map((c) => ({ field: c.field, op: c.op, value: c.value == null ? '' : Array.isArray(c.value) ? c.value.join(', ') : String(c.value) }))
      : [{ field: FIELDS[0][0], op: 'gte', value: '' }],
    menu: a.menu ?? 'keep', tone: a.tone ?? 'neutral', timing: a.timing ?? 'morning',
    levelDelta: a.levelDelta == null ? '' : String(a.levelDelta), flagForReview: !!a.flagForReview, note: a.note ?? '',
  };
}
const emptyForm = (): Form => ({
  name: '', type: 'menu_correction', appliesTo: '', priority: '1',
  conditions: [{ field: FIELDS[0][0], op: 'gte', value: '' }],
  menu: 'keep', tone: 'neutral', timing: 'morning', levelDelta: '', flagForReview: false, note: '',
});

function parseValue(op: string, raw: string): unknown {
  if (op === 'in') return raw.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (isFinite(Number(s)) && s !== '' ? Number(s) : s));
  const t = raw.trim();
  if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') return Number(t);
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t !== '' && isFinite(Number(t))) return Number(t);
  return t;
}

function ProtocolModal({ protocol, onClose, onSaved }: { protocol: ProtocolRow | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(protocol ? toForm(protocol) : emptyForm());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setCond(i: number, patch: Partial<FormCond>) {
    setF((s) => ({ ...s, conditions: s.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  }

  async function save() {
    setErr(null);
    if (f.name.trim().length < 2) { setErr('Dai un nome al protocollo.'); return; }
    if (f.conditions.length === 0) { setErr('Aggiungi almeno una condizione.'); return; }
    const conditions = f.conditions.map((c) => ({
      field: c.field, op: c.op,
      ...(NO_VALUE_OPS.includes(c.op) ? {} : { value: parseValue(c.op, c.value) }),
    }));
    const action: ActionDef = {
      menu: f.menu, tone: f.tone, timing: f.timing,
      ...(f.levelDelta !== '' ? { levelDelta: Number(f.levelDelta) } : {}),
      ...(f.flagForReview ? { flagForReview: true } : {}),
      ...(f.note.trim() ? { note: f.note.trim() } : {}),
    };
    const definition = { priority: Number(f.priority) || 1, conditions, action };
    const body = { name: f.name.trim(), type: f.type, appliesTo: f.appliesTo.trim() || undefined, definition };

    setBusy(true);
    try {
      if (protocol) await api(`/protocols/${protocol.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/protocols', { method: 'POST', body: JSON.stringify(body) });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally { setBusy(false); }
  }

  return (
    <Modal title={protocol ? 'Modifica protocollo' : 'Nuovo protocollo'} onClose={onClose}>
      {err && <Banner kind="err">{err}</Banner>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <label style={{ gridColumn: '1 / -1' }}><span className="muted" style={{ fontSize: 12 }}>Nome</span>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Es. Stallo prolungato → correzione" /></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Tipo</span>
          <select className="select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{TYPE[t]}</option>)}</select></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Priorità</span>
          <input className="input" inputMode="numeric" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} placeholder="1" /></label>
        <label style={{ gridColumn: '1 / -1' }}><span className="muted" style={{ fontSize: 12 }}>Si applica a (facoltativo)</span>
          <input className="input" value={f.appliesTo} onChange={(e) => setF({ ...f, appliesTo: e.target.value })} placeholder="Es. senza condizioni cliniche" /></label>
      </div>

      {/* Condizioni */}
      <div style={{ marginTop: 14 }}>
        <b style={{ fontSize: 13 }}>Condizioni</b>
        <p className="muted" style={{ fontSize: 11, margin: '2px 0 0' }}>Tutte devono essere vere perché la regola scatti.</p>
        {f.conditions.map((c, i) => (
          <div key={i} className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <select className="select" style={{ flex: 2, minWidth: 140 }} value={c.field} onChange={(e) => setCond(i, { field: e.target.value })}>
              {FIELDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select className="select" style={{ width: 110 }} value={c.op} onChange={(e) => setCond(i, { op: e.target.value })}>
              {OPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {!NO_VALUE_OPS.includes(c.op) && (
              <input className="input" style={{ flex: 1, minWidth: 70 }} placeholder="valore" value={c.value} onChange={(e) => setCond(i, { value: e.target.value })} />
            )}
            <button className="btn ghost sm" title="Rimuovi" onClick={() => setF((s) => ({ ...s, conditions: s.conditions.filter((_, j) => j !== i) }))}><i className="ti ti-x" /></button>
          </div>
        ))}
        <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => setF((s) => ({ ...s, conditions: [...s.conditions, { field: FIELDS[0][0], op: 'gte', value: '' }] }))}><i className="ti ti-plus" /> Condizione</button>
      </div>

      {/* Azione */}
      <div style={{ marginTop: 14 }}>
        <b style={{ fontSize: 13 }}>Azione</b>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginTop: 6 }}>
          <label><span className="muted" style={{ fontSize: 12 }}>Menu</span>
            <select className="select" value={f.menu} onChange={(e) => setF({ ...f, menu: e.target.value })}>{MENUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label><span className="muted" style={{ fontSize: 12 }}>Tono</span>
            <select className="select" value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value })}>{TONES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label><span className="muted" style={{ fontSize: 12 }}>Momento</span>
            <select className="select" value={f.timing} onChange={(e) => setF({ ...f, timing: e.target.value })}>{TIMINGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label><span className="muted" style={{ fontSize: 12 }}>Variazione livello</span>
            <input className="input" inputMode="numeric" placeholder="es. -1, 0, 1" value={f.levelDelta} onChange={(e) => setF({ ...f, levelDelta: e.target.value })} /></label>
        </div>
        <div className="row" style={{ alignItems: 'center', gap: 8, marginTop: 10 }}>
          <Toggle on={f.flagForReview} onChange={(v) => setF({ ...f, flagForReview: v })} />
          <span style={{ fontSize: 13 }}>Segnala per revisione del nutrizionista</span>
        </div>
        <label style={{ display: 'block', marginTop: 10 }}><span className="muted" style={{ fontSize: 12 }}>Nota (facoltativa)</span>
          <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Motivazione o spiegazione della regola" /></label>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={save} disabled={busy}><i className="ti ti-device-floppy" /> {busy ? 'Salvo…' : 'Salva'}</button>
      </div>
      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Salvando, il protocollo va (o torna) “Da validare”.</p>
    </Modal>
  );
}
