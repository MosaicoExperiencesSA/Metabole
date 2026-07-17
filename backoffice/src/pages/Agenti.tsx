import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Spinner } from '../components/ui';

/**
 * Registro Agenti AI (mirror del prototipo Metabole_Dashboard_Agenti.html):
 * tutti gli agenti Claude del sistema — dove lavorano, cosa fanno, la regola che
 * li governa. CRUD sul registro; il runtime (esecuzioni/costi) arriverà dopo.
 */

interface Agent {
  id: string; key: string; name: string; type: string; department: string;
  task: string; rule: string; engine: string; enabled: boolean; humanInLoop: boolean;
  monthlyBudgetCents: number; archivedAt: string | null;
}
interface RunResult { runId: string; output: string; model: string; inputTokens: number; outputTokens: number; costCents: number; humanInLoop: boolean; budget: { spentCents: number; limitCents: number } }
interface RunRow { id: string; startedAt: string; finishedAt: string | null; status: string; model: string | null; inputTokens: number; outputTokens: number; costCents: number; error: string | null }
interface Costs { totalCents: number; items: { agentId: string; name: string; runs: number; costCents: number }[] }

const DEPT: Record<string, { label: string; color: string }> = {
  app: { label: 'App cliente', color: '#12A386' },
  marketing: { label: 'Marketing', color: '#6c5ab7' },
  communication: { label: 'Comunicazione', color: '#993c1d' },
  crm: { label: 'CRM', color: '#2b5c9e' },
  system: { label: 'Sistema', color: '#516059' },
};
const TYPE_LABEL: Record<string, string> = {
  conversational: 'Conversazionale', generative: 'Generativo', judge: 'Giudice',
  rag: 'RAG', planner: 'Pianificatore', analyst: 'Analista', writer: 'Redattore',
  orchestrator: 'Orchestratore', tts: 'Sintesi vocale', deterministic: 'Deterministico (no LLM)',
};
const ENGINE_LABEL: Record<string, string> = {
  'claude-haiku-4-5': 'Haiku 4.5', 'claude-sonnet-5': 'Sonnet 5', 'claude-opus-4-8': 'Opus 4.8',
  elevenlabs: 'ElevenLabs', none: '—',
};
const ICON: Record<string, string> = {
  conversational: 'ti-mood-smile', generative: 'ti-palette', judge: 'ti-gavel', rag: 'ti-database-search',
  planner: 'ti-bulb', analyst: 'ti-chart-histogram', writer: 'ti-article', orchestrator: 'ti-hierarchy-2',
  tts: 'ti-microphone', deterministic: 'ti-salad',
};

const EMPTY_FORM = { name: '', type: 'generative', department: 'marketing', engine: 'claude-haiku-4-5', task: '', rule: '', humanInLoop: false, monthlyBudgetEuro: 50 };

export function Agenti() {
  const { can } = useAuth();
  const canManage = can('agents', 'manage');
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState('');
  const [editing, setEditing] = useState<Agent | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [running, setRunning] = useState<Agent | null>(null);
  const [runsOf, setRunsOf] = useState<Agent | null>(null);
  const [costs, setCosts] = useState<Costs | null>(null);

  function load() {
    api<Agent[]>('/agents').then(setAgents).catch((e) => { setAgents([]); setError(e instanceof Error ? e.message : 'Caricamento non riuscito.'); });
    api<Costs>('/agents/costs').then(setCosts).catch(() => setCosts(null));
  }
  useEffect(() => { load(); }, []);

  async function toggleEnabled(a: Agent) {
    setBusyId(a.id); setError(null);
    try {
      await api(`/agents/${a.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: !a.enabled }) });
      setAgents((list) => (list ?? []).map((x) => (x.id === a.id ? { ...x, enabled: !a.enabled } : x)));
      setNotice(`Agente "${a.name}" ${a.enabled ? 'disattivato' : 'attivato'}.`);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Operazione non riuscita.'); }
    finally { setBusyId(null); }
  }

  async function archive(a: Agent) {
    // eslint-disable-next-line no-alert
    if (!confirm(`Archiviare l'agente "${a.name}"? Sparisce dalla lista ma lo storico resta.`)) return;
    setBusyId(a.id); setError(null);
    try {
      await api(`/agents/${a.id}`, { method: 'DELETE' });
      setAgents((list) => (list ?? []).filter((x) => x.id !== a.id));
      setNotice(`Agente "${a.name}" archiviato.`);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Archiviazione non riuscita.'); }
    finally { setBusyId(null); }
  }

  if (!agents) return <Spinner />;
  const list = agents.filter((a) => !deptFilter || a.department === deptFilter);

  return (
    <>
      <div className="spread" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="chip" onClick={() => setDeptFilter('')} style={{ cursor: 'pointer', borderColor: !deptFilter ? 'var(--teal)' : undefined, background: !deptFilter ? 'var(--chip)' : undefined }}>Tutti</button>
          {Object.entries(DEPT).map(([k, d]) => (
            <button key={k} className="chip" onClick={() => setDeptFilter(k)} style={{ cursor: 'pointer', borderColor: deptFilter === k ? 'var(--teal)' : undefined, background: deptFilter === k ? 'var(--chip)' : undefined }}>
              {d.label}
            </button>
          ))}
        </div>
        {canManage && (
          <button className="btn" onClick={() => setCreating(true)}><i className="ti ti-plus" /> Nuovo agente</button>
        )}
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        Tutti gli agenti <b>Claude</b> del sistema: dove lavorano, cosa fanno e la regola che li governa.
        I modelli di default si cambiano dai Parametri (agent_default_model, agent_judge_model) senza redeploy.
      </p>
      {costs && costs.items.length > 0 && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 14 }}>
          <div className="row" style={{ gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 13 }}><i className="ti ti-coins" /> Costi ultimi 30 giorni: € {(costs.totalCents / 100).toFixed(2)}</b>
            {[...costs.items].sort((a, b) => b.costCents - a.costCents).slice(0, 5).map((c) => (
              <span key={c.agentId} className="muted" style={{ fontSize: 12 }}>{c.name} € {(c.costCents / 100).toFixed(2)} · {c.runs} esec.</span>
            ))}
          </div>
        </div>
      )}

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {list.map((a) => {
          const d = DEPT[a.department] ?? { label: a.department, color: '#516059' };
          return (
            <div key={a.id} className="card" style={{ borderTop: `3px solid ${d.color}`, opacity: a.enabled ? 1 : 0.6, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: d.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <i className={`ti ${ICON[a.type] ?? 'ti-robot'}`} style={{ fontSize: 18 }} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b style={{ fontSize: 14 }}>{a.name}</b>
                  <div className="muted" style={{ fontSize: 11 }}>{TYPE_LABEL[a.type] ?? a.type}</div>
                </div>
                {!a.enabled && <span className="chip gray" style={{ fontSize: 10 }}>spento</span>}
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <span className="chip" style={{ fontSize: 11, color: d.color }}><i className="ti ti-map-pin" style={{ fontSize: 11 }} /> {d.label}</span>
                <span className="chip" style={{ fontSize: 11 }}>{a.engine.startsWith('claude') ? <b>{ENGINE_LABEL[a.engine]}</b> : ENGINE_LABEL[a.engine] ?? a.engine}</span>
                {a.humanInLoop && <span className="chip amber" style={{ fontSize: 10 }} title="L'output richiede approvazione umana">umano nel ciclo</span>}
                {a.monthlyBudgetCents > 0 && <span className="chip" style={{ fontSize: 10 }} title="Tetto di spesa mensile">€ {(a.monthlyBudgetCents / 100).toFixed(0)}/mese</span>}
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{a.task}</div>
              {a.rule && (
                <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.5, borderLeft: '3px solid var(--line)', paddingLeft: 8 }}>
                  <i className="ti ti-shield-check" style={{ fontSize: 11 }} /> {a.rule}
                </div>
              )}
              {canManage && (
                <div className="row" style={{ gap: 6, marginTop: 'auto', paddingTop: 4, flexWrap: 'wrap' }}>
                  {a.engine.startsWith('claude') && a.enabled && (
                    <button className="btn sm" onClick={() => setRunning(a)} disabled={busyId === a.id} title="Esecuzione manuale (conta token e costo)"><i className="ti ti-player-play" /> Esegui</button>
                  )}
                  <button className="btn ghost sm" onClick={() => setRunsOf(a)} disabled={busyId === a.id} title="Storico esecuzioni e costi"><i className="ti ti-history" /></button>
                  <button className="btn ghost sm" onClick={() => setEditing(a)} disabled={busyId === a.id}><i className="ti ti-edit" /> Modifica</button>
                  <button className="btn ghost sm" onClick={() => toggleEnabled(a)} disabled={busyId === a.id}>
                    <i className={`ti ${a.enabled ? 'ti-player-pause' : 'ti-player-play'}`} /> {a.enabled ? 'Disattiva' : 'Attiva'}
                  </button>
                  <button className="btn ghost sm" onClick={() => archive(a)} disabled={busyId === a.id} style={{ color: '#b3261e', marginLeft: 'auto' }} title="Archivia">
                    <i className="ti ti-archive" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {list.length === 0 && <div className="empty">Nessun agente per questo reparto.</div>}

      {(creating || editing) && (
        <AgentModal
          agent={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={(msg) => { setCreating(false); setEditing(null); setNotice(msg); load(); }}
        />
      )}
      {running && <RunModal agent={running} onClose={() => { setRunning(null); load(); }} />}
      {runsOf && <RunsModal agent={runsOf} onClose={() => setRunsOf(null)} />}
    </>
  );
}

/** Esecuzione manuale: input → output con token e costo (rispetta il budget mensile). */
function RunModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  async function run() {
    if (!input.trim()) { setErr('Scrivi un input per l\'agente.'); return; }
    setBusy(true); setErr(null); setResult(null);
    try {
      setResult(await api<RunResult>(`/agents/${agent.id}/run`, { method: 'POST', body: JSON.stringify({ input: input.trim() }) }));
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Esecuzione non riuscita.'); }
    finally { setBusy(false); }
  }

  return (
    <Modal title={`Esegui — ${agent.name}`} onClose={onClose}>
      <p className="hint" style={{ marginTop: 0 }}>{agent.task}</p>
      {err && <Banner kind="err">{err}</Banner>}
      <div className="field"><label>Input</label>
        <textarea className="input" rows={4} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Cosa deve fare in questa esecuzione? (brief, testo da valutare, domanda…)" /></div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Chiudi</button>
        <button className="btn" onClick={run} disabled={busy}>{busy ? 'Eseguo…' : 'Esegui'}</button>
      </div>
      {busy && <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Esecuzione in corso… può richiedere fino a un minuto.</p>}
      {result && (
        <div style={{ marginTop: 14 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span className="chip" style={{ fontSize: 11 }}>{result.model}</span>
            <span className="chip" style={{ fontSize: 11 }}>{result.inputTokens + result.outputTokens} token</span>
            <span className="chip" style={{ fontSize: 11 }}>€ {(result.costCents / 100).toFixed(2)}</span>
            {result.budget.limitCents > 0 && (
              <span className="chip" style={{ fontSize: 11 }}>budget € {(result.budget.spentCents / 100).toFixed(2)} / {(result.budget.limitCents / 100).toFixed(0)}</span>
            )}
            {result.humanInLoop && <span className="chip amber" style={{ fontSize: 10 }}>output da approvare (umano nel ciclo)</span>}
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.55, border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--card)' }}>
            {result.output || '(nessun testo)'}
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn ghost sm" onClick={() => { void navigator.clipboard?.writeText(result.output); }}><i className="ti ti-copy" /> Copia output</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Storico esecuzioni di un agente (stato, token, costo). */
function RunsModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [rows, setRows] = useState<RunRow[] | null>(null);
  useEffect(() => {
    api<RunRow[]>(`/agents/${agent.id}/runs`).then(setRows).catch(() => setRows([]));
  }, [agent.id]);
  const ST: Record<string, { label: string; chip: string }> = {
    done: { label: 'Completata', chip: '' }, running: { label: 'In corso', chip: 'amber' },
    error: { label: 'Errore', chip: 'red' }, blocked: { label: 'Bloccata (budget)', chip: 'red' }, queued: { label: 'In coda', chip: 'gray' },
  };
  return (
    <Modal title={`Esecuzioni — ${agent.name}`} onClose={onClose}>
      {!rows ? <Spinner /> : rows.length === 0 ? (
        <div className="empty">Nessuna esecuzione ancora: usa "Esegui" sulla card dell'agente.</div>
      ) : (
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          <table className="grid">
            <thead><tr><th>Quando</th><th>Stato</th><th>Token</th><th>Costo</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} title={r.error ?? undefined}>
                  <td className="muted" style={{ fontSize: 12 }}>{new Date(r.startedAt).toLocaleString('it-IT')}</td>
                  <td><span className={`chip ${ST[r.status]?.chip ?? 'gray'}`} style={{ fontSize: 11 }}>{ST[r.status]?.label ?? r.status}</span></td>
                  <td className="muted" style={{ fontSize: 12 }}>{r.inputTokens + r.outputTokens}</td>
                  <td className="muted" style={{ fontSize: 12 }}>€ {(r.costCents / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function AgentModal({ agent, onClose, onSaved }: { agent: Agent | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const [f, setF] = useState(() => agent
    ? { name: agent.name, type: agent.type, department: agent.department, engine: agent.engine, task: agent.task, rule: agent.rule, humanInLoop: agent.humanInLoop, monthlyBudgetEuro: Math.round(agent.monthlyBudgetCents / 100) }
    : EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    if (f.name.trim().length < 2) { setErr('Dai un nome all\'agente.'); return; }
    if (!f.task.trim()) { setErr('Descrivi cosa fa l\'agente.'); return; }
    setBusy(true);
    const body = {
      name: f.name.trim(), type: f.type, department: f.department, engine: f.engine,
      task: f.task.trim(), rule: f.rule.trim(), humanInLoop: f.humanInLoop,
      monthlyBudgetCents: Math.max(0, Math.round(f.monthlyBudgetEuro * 100)),
    };
    try {
      if (agent) {
        await api(`/agents/${agent.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        onSaved(`Agente "${f.name.trim()}" aggiornato.`);
      } else {
        await api('/agents', { method: 'POST', body: JSON.stringify(body) });
        onSaved(`Agente "${f.name.trim()}" creato.`);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
      setBusy(false);
    }
  }

  return (
    <Modal title={agent ? `Modifica agente — ${agent.name}` : 'Nuovo agente'} onClose={onClose}>
      <p className="hint" style={{ marginTop: 0 }}>Definisci il compito e dove applicarlo. Scegli il motore in base al carico e alla criticità.</p>
      {err && <Banner kind="err">{err}</Banner>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="field"><label>Nome agente</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Es. Agente Recensioni" /></div>
        <div className="field"><label>Tipo</label>
          <select className="select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
        <div className="field"><label>Dove lavora (reparto)</label>
          <select className="select" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>
            {Object.entries(DEPT).map(([v, d]) => <option key={v} value={v}>{d.label}</option>)}
          </select></div>
        <div className="field"><label>Motore</label>
          <select className="select" value={f.engine} onChange={(e) => setF({ ...f, engine: e.target.value })}>
            {Object.entries(ENGINE_LABEL).map(([v, l]) => <option key={v} value={v}>{l === '—' ? 'Nessuno (deterministico)' : l}</option>)}
          </select></div>
      </div>
      <div className="field"><label>Cosa fa</label>
        <textarea className="input" rows={3} value={f.task} onChange={(e) => setF({ ...f, task: e.target.value })} placeholder="Descrivi il compito dell'agente…" /></div>
      <div className="field"><label>Regola</label>
        <textarea className="input" rows={2} value={f.rule} onChange={(e) => setF({ ...f, rule: e.target.value })} placeholder="Il vincolo che deve sempre rispettare (es. escala i claim di salute al nutrizionista capo)…" /></div>
      <div className="row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={f.humanInLoop} onChange={(e) => setF({ ...f, humanInLoop: e.target.checked })} />
          <span style={{ fontSize: 13 }}>Umano nel ciclo <span className="muted" style={{ fontSize: 11 }}>(l'output richiede approvazione)</span></span>
        </label>
        <label className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 12 }}>Budget mensile €</span>
          <input className="input" type="number" min={0} max={100000} value={f.monthlyBudgetEuro} onChange={(e) => setF({ ...f, monthlyBudgetEuro: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 100 }} />
          <span className="muted" style={{ fontSize: 11 }}>(0 = nessun tetto)</span>
        </label>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Salvo…' : agent ? 'Salva modifiche' : 'Crea agente'}</button>
      </div>
    </Modal>
  );
}
