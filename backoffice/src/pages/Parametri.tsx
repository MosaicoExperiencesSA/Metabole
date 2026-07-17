import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Spinner, Toggle } from '../components/ui';

interface Param {
  key: string;
  value: string;
  type: string;
  description: string | null;
  updatedAt: string;
}

type Kind = 'number' | 'text' | 'textarea' | 'toggle' | 'select' | 'euro';

interface Meta {
  label: string;
  group: string;
  help?: string;
  kind: Kind;
  unit?: string;
  options?: { value: string; label: string }[];
}

// Etichette e raggruppamento leggibili per ogni parametro.
const META: Record<string, Meta> = {
  payment_method_card_enabled: { label: 'Pagamento con carta (Stripe)', group: 'Pagamenti', kind: 'toggle', help: 'Se attivo, le clienti possono pagare con carta al checkout dell’app.' },
  payment_method_bank_enabled: { label: 'Pagamento con bonifico', group: 'Pagamenti', kind: 'toggle', help: 'Se attivo, le clienti possono pagare con bonifico (estremi via email).' },

  bank_transfer_details: { label: 'Estremi del bonifico', group: 'Bonifico', kind: 'textarea', help: 'Testo inviato via email alla cliente per pagare con bonifico (intestatario, IBAN, BIC…).' },

  // Le provvigioni di vendita non sono più parametri globali: dal 14/07 sono importi in €
  // definiti su ogni piano/prodotto in Gestione negozio. Resta solo il compenso visita.
  visit_compensation_amount_cents: { label: 'Compenso per visita', group: 'Provvigioni e compensi', kind: 'euro', help: 'Compenso alla nutrizionista per ogni visita completata.' },

  water_ml_per_kg: { label: 'Acqua per kg di peso', group: 'Obiettivi cliente', kind: 'number', unit: 'ml/kg', help: 'Personalizza l’obiettivo acqua sul peso della cliente (30-35 tipico). Obiettivo = peso × ml/kg ÷ 250 ml (bicchiere), limitato 6-16 bicchieri (1,5-4 L).' },
  water_goal_glasses: { label: 'Obiettivo acqua (ripiego)', group: 'Obiettivi cliente', kind: 'number', unit: 'bicchieri/giorno', help: 'Usato solo quando il peso della cliente non è ancora noto. Altrimenti l’obiettivo è personalizzato sul peso.' },
  steps_goal: { label: 'Obiettivo passi', group: 'Obiettivi cliente', kind: 'number', unit: 'passi/giorno' },

  agent_default_model: { label: 'Modello di default', group: 'Agenti AI', kind: 'text', help: 'Modello Claude usato dagli agenti ad alto volume (es. claude-haiku-4-5). Cambia senza redeploy.' },
  agent_judge_model: { label: 'Modello del Giudice', group: 'Agenti AI', kind: 'text', help: 'Modello Claude del Giudice compliance (es. claude-sonnet-5): qualità di giudizio sui contenuti.' },
  agent_default_budget_cents: { label: 'Budget mensile default per agente', group: 'Agenti AI', kind: 'euro', help: 'Tetto di spesa mensile assegnato ai nuovi agenti (0 = nessun tetto).' },

  sustainable_rate_max_kg_week: { label: 'Ritmo sostenibile massimo', group: 'Motore · ritmo e sicurezza', kind: 'number', unit: 'kg/sett.', help: 'Oltre questo ritmo l’obiettivo è considerato ambizioso.' },
  ambitious_rate_max_kg_week: { label: 'Ritmo ambizioso massimo', group: 'Motore · ritmo e sicurezza', kind: 'number', unit: 'kg/sett.', help: 'Oltre questo ritmo l’obiettivo è irreale.' },
  min_daily_kcal: { label: 'Calorie minime giornaliere', group: 'Motore · ritmo e sicurezza', kind: 'number', unit: 'kcal' },
  max_weight_change_alert_kg_week: { label: 'Variazione peso da allertare', group: 'Motore · ritmo e sicurezza', kind: 'number', unit: 'kg/sett.', help: 'Sopra questa variazione scatta l’alert al nutrizionista.' },
  unreal_objective_action: {
    label: 'Obiettivo irreale: cosa fare', group: 'Motore · ritmo e sicurezza', kind: 'select',
    options: [
      { value: 'warn', label: 'Avvisa soltanto' },
      { value: 'block_propose_date', label: 'Blocca e proponi una data' },
      { value: 'require_nutritionist', label: 'Richiedi il nutrizionista' },
    ],
  },
  low_energy_chronic_threshold: { label: 'Soglia energia bassa cronica', group: 'Motore · ritmo e sicurezza', kind: 'number', unit: 'media 1-5' },

  moving_average_window: { label: 'Finestra media mobile', group: 'Motore · monitoraggio', kind: 'number', unit: 'rilevazioni' },
  stall_days_before_coach_alert: { label: 'Giorni di stallo prima dell’alert', group: 'Motore · monitoraggio', kind: 'number', unit: 'giorni' },
  no_checkin_days_before_alert: { label: 'Giorni senza check-in prima dell’alert', group: 'Motore · monitoraggio', kind: 'number', unit: 'giorni' },
  pause_deviation_trigger: { label: 'Scostamento che attiva il mini-piano', group: 'Motore · monitoraggio', kind: 'number', unit: 'kg/cm' },
  low_rating_threshold_stars: { label: 'Soglia stelle ricetta poco gradita', group: 'Motore · monitoraggio', kind: 'number', unit: 'stelle' },

  menu_days_delivered: { label: 'Giorni di menu erogati per volta', group: 'Menu', kind: 'number', unit: 'giorni' },
  menu_visible_days_before_start: { label: 'Menu visibile prima dell’inizio', group: 'Menu', kind: 'number', unit: 'giorni' },

  ai_composer_enabled: { label: 'Layer AI per le notifiche', group: 'AI', kind: 'toggle', help: 'Se attivo (e con AI_API_KEY su Render) i testi delle notifiche vengono riformulati da Claude; il tono resta deciso dal motore.' },
  ai_assistant_enabled: { label: 'Assistente AI in chat', group: 'AI', kind: 'toggle', help: 'Se attivo (e con AI_API_KEY su Render) l’assistente risponde con Claude ai messaggi generici; i temi sensibili/sanitari restano instradati al nutrizionista.' },
};

const GROUP_ORDER = ['Pagamenti', 'Bonifico', 'Provvigioni e compensi', 'Obiettivi cliente', 'Motore · ritmo e sicurezza', 'Motore · monitoraggio', 'Menu', 'AI', 'Altro'];

const metaFor = (p: Param): Meta =>
  META[p.key] ?? { label: p.key, group: 'Altro', kind: 'text', help: p.description ?? undefined };

export function Parametri() {
  const [params, setParams] = useState<Param[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const list = await api<Param[]>('/admin/config');
      setParams(list);
      setDraft(Object.fromEntries(list.map((p) => [p.key, p.value])));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può gestire i parametri.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const grouped = useMemo(() => {
    const by: Record<string, Param[]> = {};
    for (const p of params) {
      const g = metaFor(p).group;
      (by[g] ??= []).push(p);
    }
    return GROUP_ORDER.filter((g) => by[g]?.length).map((g) => ({ group: g, items: by[g] }));
  }, [params]);

  async function save(p: Param) {
    const value = (draft[p.key] ?? '').toString();
    if (!value.trim() && metaFor(p).kind !== 'textarea') { setError('Il valore non può essere vuoto.'); return; }
    if (!confirm(`Salvare il nuovo valore di “${metaFor(p).label}”?`)) return;
    setSavingKey(p.key);
    setError(null);
    setNotice(null);
    try {
      const updated = await api<Param>(`/admin/config/${p.key}`, { method: 'PATCH', body: JSON.stringify({ value }) });
      setParams((ps) => ps.map((x) => (x.key === p.key ? { ...x, value: updated.value, updatedAt: updated.updatedAt } : x)));
      setNotice(`“${metaFor(p).label}” aggiornato.`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        Modifica gli estremi del bonifico e le soglie del motore senza toccare il codice. Ogni valore si salva singolarmente.
      </p>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {grouped.map(({ group, items }) => (
        <div className="card" key={group}>
          <h2 style={{ marginTop: 0 }}>{group}</h2>
          {items.map((p) => {
            const m = metaFor(p);
            const dirty = (draft[p.key] ?? '') !== p.value;
            const set = (v: string) => setDraft((d) => ({ ...d, [p.key]: v }));
            const unitText = m.kind === 'euro' ? '€' : m.unit ?? '';
            return (
              <div key={p.key} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <b style={{ fontSize: 14 }}>{m.label}</b>
                    {m.help && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{m.help}</div>}
                  </div>
                  {/* Controllo allineato in colonna: campo (larghezza fissa) · unità · Salva */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 'none' }}>
                    <div style={{ width: 190, display: 'flex', justifyContent: 'flex-end' }}>
                      {m.kind === 'textarea' ? null : m.kind === 'toggle' ? (
                        <Toggle on={(draft[p.key] ?? 'false') === 'true'} onChange={(on) => set(on ? 'true' : 'false')} />
                      ) : m.kind === 'select' ? (
                        <select className="select" value={draft[p.key] ?? ''} onChange={(e) => set(e.target.value)} style={{ width: '100%' }}>
                          {m.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : m.kind === 'euro' ? (
                        <input
                          className="input" type="number" step="0.01" min="0" style={{ width: '100%' }}
                          value={(Number(draft[p.key] ?? '0') / 100).toString()}
                          onChange={(e) => set(String(Math.round((parseFloat(e.target.value) || 0) * 100)))}
                        />
                      ) : (
                        <input
                          className="input" type={m.kind === 'number' ? 'number' : 'text'} step="any" style={{ width: '100%' }}
                          value={draft[p.key] ?? ''} onChange={(e) => set(e.target.value)}
                        />
                      )}
                    </div>
                    <span className="muted" style={{ width: 64, fontSize: 12 }}>{unitText}</span>
                    <button className="btn sm" style={{ width: 74, justifyContent: 'center' }} onClick={() => save(p)} disabled={!dirty || savingKey === p.key}>
                      {savingKey === p.key ? '…' : 'Salva'}
                    </button>
                  </div>
                </div>
                {m.kind === 'textarea' && (
                  <textarea
                    className="input" style={{ width: '100%', minHeight: 120, marginTop: 10, resize: 'vertical', fontFamily: 'inherit' }}
                    value={draft[p.key] ?? ''} onChange={(e) => set(e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}

      <RegimiEditor />
    </>
  );
}

interface RegimeRow { code: string; label: string }

/** Editor dei regimi alimentari (configurazione di base, solo admin). */
function RegimiEditor() {
  const [rows, setRows] = useState<RegimeRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function load() {
    api<{ regimes: RegimeRow[] }>('/catalog/taxonomy')
      .then((t) => setRows(t.regimes ?? []))
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Caricamento non riuscito.'));
  }
  useEffect(load, []);

  const setRow = (i: number, patch: Partial<RegimeRow>) =>
    setRows((rs) => (rs ? rs.map((r, j) => (j === i ? { ...r, ...patch } : r)) : rs));
  const add = () => setRows((rs) => [...(rs ?? []), { code: '', label: '' }]);
  const remove = (i: number) => setRows((rs) => (rs ? rs.filter((_, j) => j !== i) : rs));

  async function save() {
    if (!rows) return;
    const clean = rows.filter((r) => r.code.trim());
    if (clean.length === 0) { setErr('Serve almeno un regime.'); return; }
    setBusy(true); setErr(null); setMsg(null);
    try {
      await api('/catalog/regimes', { method: 'PATCH', body: JSON.stringify({ regimes: clean }) });
      setMsg('Regimi salvati.');
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Regimi alimentari</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        I regimi disponibili nei form di diete e ricette. Il <b>codice</b> è tecnico (minuscolo, senza spazi); l'<b>etichetta</b> è ciò che vedono gli operatori. Modificare un codice già in uso non rinomina i dati esistenti.
      </p>
      {err && <Banner kind="err">{err}</Banner>}
      {msg && <Banner kind="ok">{msg}</Banner>}
      {!rows ? (
        <Spinner />
      ) : (
        <>
          <div style={{ display: 'grid', gap: 8 }}>
            {rows.map((r, i) => (
              <div key={i} className="row" style={{ gap: 8, alignItems: 'center' }}>
                <input className="input" style={{ width: 180 }} placeholder="codice (es. pescetarian)" value={r.code} onChange={(e) => setRow(i, { code: e.target.value })} />
                <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Etichetta (es. Pescetariana)" value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} />
                <button className="btn ghost sm" onClick={() => remove(i)} title="Rimuovi"><i className="ti ti-trash" /></button>
              </div>
            ))}
            {rows.length === 0 && <div className="empty">Nessun regime: aggiungine almeno uno.</div>}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn ghost sm" onClick={add}><i className="ti ti-plus" /> Aggiungi regime</button>
            <button className="btn" disabled={busy} onClick={save}>{busy ? 'Salvo…' : 'Salva regimi'}</button>
          </div>
        </>
      )}
    </div>
  );
}
