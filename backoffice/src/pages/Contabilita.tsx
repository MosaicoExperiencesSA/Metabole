import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { Banner, Modal, Pager, Spinner, usePagination } from '../components/ui';
import { MiniTrend } from '../components/MiniTrend';

const euro = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');
const euro0 = (c: number) => '€ ' + Math.round(c / 100).toLocaleString('it-IT');

const COST_CATEGORIES = ['salaries', 'infrastructure', 'marketing', 'payment_fees', 'ai', 'taxes', 'other'] as const;
type CostCategory = (typeof COST_CATEGORIES)[number];
const CAT_LABEL: Record<string, string> = {
  salaries: 'Stipendi',
  infrastructure: 'Infrastruttura',
  marketing: 'Marketing',
  payment_fees: 'Commissioni pagamenti',
  ai: 'AI',
  taxes: 'Tasse',
  other: 'Altro',
  // categorie che arrivano dal ledger (uscite già registrate)
  sales_commission: 'Provvigioni',
  visit_compensation: 'Compensi visite',
};
const CADENCE_LABEL: Record<string, string> = { once: 'Una tantum', monthly: 'Mensile', yearly: 'Annuale' };
const MONTHS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const monthShort = (key: string) => {
  const [y, m] = key.split('-');
  return `${MONTHS_IT[parseInt(m, 10) - 1]} ${y.slice(2)}`;
};

interface CostEntry {
  id: string;
  label: string;
  category: string;
  amountCents: number;
  recurring: boolean;
  cadence: string;
  date: string;
  endDate: string | null;
  vendor: string | null;
  note: string | null;
}
interface Report {
  from: string;
  to: string;
  incomeCents: number;
  costsCents: number;
  profitCents: number;
  marginPct: number | null;
  byCategory: { category: string; amountCents: number; source: 'ledger' | 'manual' }[];
  series: { month: string; incomeCents: number; costsCents: number }[];
  kpi: { newClients: number; payingClients: number; marketingCostCents: number; cacCents: number | null; arpuCents: number | null };
  commissions: { accruedPeriodCents: number; paidPeriodCents: number; accruedTotalCents: number; paidTotalCents: number; reserveCents: number; pendingCents: number };
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7); // 'YYYY-MM'
/** Primo e ultimo giorno del mese selezionato. */
function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function Contabilita() {
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState<Report | null>(null);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CostEntry | 'new' | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = monthRange(month);
      const [rep, cs] = await Promise.all([
        api<Report>(`/admin/accounting/report?from=${from}&to=${to}`),
        api<CostEntry[]>('/admin/accounting/costs'),
      ]);
      setReport(rep);
      setCosts(cs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  async function download(kind: 'pdf' | 'csv') {
    setDownloading(kind);
    setError(null);
    try {
      const { from, to } = monthRange(month);
      const r = await api<{ fileName: string; mimeType: string; contentBase64: string }>(`/admin/accounting/report/${kind}?from=${from}&to=${to}`);
      const bytes = Uint8Array.from(atob(r.contentBase64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: r.mimeType }));
      const a = document.createElement('a');
      a.href = url; a.download = r.fileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download non riuscito.');
    } finally {
      setDownloading(null);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const labels = useMemo(() => (report?.series ?? []).map((s) => monthShort(s.month)), [report]);

  async function del(c: CostEntry) {
    if (!confirm(`Eliminare il costo "${c.label}" (${euro(c.amountCents)})?`)) return;
    try {
      await api(`/admin/accounting/costs/${c.id}`, { method: 'DELETE' });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  const pg = usePagination(costs, 100);

  if (loading && !report) return <Spinner />;

  return (
    <>
      {error && <Banner kind="err">{error}</Banner>}

      {/* Periodo */}
      <div className="card">
        <div className="row" style={{ gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Mese</label>
            <input className="input" type="month" value={month} max={currentMonth()} onChange={(e) => setMonth(e.target.value || currentMonth())} />
          </div>
          <button className="btn ghost" onClick={() => void load()} disabled={loading}>
            <i className="ti ti-refresh" /> Aggiorna
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn ghost" onClick={() => void download('pdf')} disabled={!report || downloading !== null}>
            <i className="ti ti-file-type-pdf" /> {downloading === 'pdf' ? 'Genero…' : 'Report PDF'}
          </button>
          <button className="btn ghost" onClick={() => void download('csv')} disabled={!report || downloading !== null}>
            <i className="ti ti-file-type-csv" /> {downloading === 'csv' ? 'Genero…' : 'Report CSV'}
          </button>
          <button className="btn" onClick={() => setEditing('new')}>
            <i className="ti ti-plus" /> Registra costo
          </button>
        </div>
      </div>

      {report && (
        <>
          {/* KPI principali */}
          <div className="card-row" style={{ marginTop: 16 }}>
            <Kpi label="Incassi" value={euro0(report.incomeCents)} color="var(--teal)" />
            <Kpi label="Costi" value={euro0(report.costsCents)} color="var(--coral)" />
            <Kpi
              label="Utile"
              value={euro0(report.profitCents)}
              color={report.profitCents >= 0 ? 'var(--ok-ink)' : 'var(--danger)'}
              sub={report.marginPct != null ? `margine ${report.marginPct.toFixed(1).replace('.', ',')}%` : undefined}
            />
          </div>
          <div className="card-row" style={{ marginTop: 12 }}>
            <Kpi label="CAC (costo acquisizione)" value={report.kpi.cacCents != null ? euro(report.kpi.cacCents) : '—'} sub={`${report.kpi.newClients} nuovi clienti`} />
            <Kpi label="ARPU (ricavo medio)" value={report.kpi.arpuCents != null ? euro(report.kpi.arpuCents) : '—'} sub={`${report.kpi.payingClients} clienti paganti`} />
            <Kpi label="Spesa marketing" value={euro0(report.kpi.marketingCostCents)} />
          </div>

          {/* Provvigioni: maturate nel mese, pagate nel mese, accantonamento (fondo da versare). */}
          {report.commissions && (
            <div className="card-row" style={{ marginTop: 12 }}>
              <Kpi label="Provvigioni accantonate" value={euro(report.commissions.accruedPeriodCents)} sub="maturate nel mese (incl. compensi visite)" />
              <Kpi label="Provvigioni pagate" value={euro(report.commissions.paidPeriodCents)} sub="saldate nel mese (da Compensi)" color="var(--teal)" />
              <Kpi
                label="Accantonamento provvigioni"
                value={euro(report.commissions.reserveCents)}
                color={report.commissions.reserveCents > 0 ? 'var(--coral)' : 'var(--ok-ink)'}
                sub={`maturate totali − pagate totali${report.commissions.pendingCents > 0 ? ` · + ${euro(report.commissions.pendingCents)} in attesa di assegnazione` : ''}`}
              />
            </div>
          )}

          {/* Grafici mensili (un asse per grafico: incassi, costi, utile) */}
          {report.series.length > 0 && (
            <div className="card-row" style={{ marginTop: 16 }}>
              <MiniTrend label="Incassi / mese" values={report.series.map((s) => s.incomeCents / 100)} labels={labels} format={(v) => euro0(v * 100)} color="var(--teal)" />
              <MiniTrend label="Costi / mese" values={report.series.map((s) => s.costsCents / 100)} labels={labels} format={(v) => euro0(v * 100)} color="var(--coral)" invertDelta />
              <MiniTrend label="Utile / mese" values={report.series.map((s) => (s.incomeCents - s.costsCents) / 100)} labels={labels} format={(v) => euro0(v * 100)} color="var(--violet)" />
            </div>
          )}

          {/* Costi per categoria */}
          <div className="card" style={{ marginTop: 16 }}>
            <h2>Costi per categoria</h2>
            {report.byCategory.length === 0 ? (
              <div className="empty">Nessun costo nel periodo.</div>
            ) : (
              <CategoryBars items={report.byCategory} />
            )}
          </div>
        </>
      )}

      {/* Anagrafica costi */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="spread" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Costi registrati</h2>
          <span className="muted" style={{ fontSize: 13 }}>{costs.length} voci</span>
        </div>
        {costs.length === 0 ? (
          <div className="empty">Nessun costo. Registrane uno con "Registra costo".</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="grid">
              <thead>
                <tr>
                  <th>Voce</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Periodo</th>
                  <th style={{ textAlign: 'right' }}>Importo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pg.pageItems.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{c.label}</b>
                      {c.vendor && <div className="muted" style={{ fontSize: 12 }}>{c.vendor}</div>}
                    </td>
                    <td>{CAT_LABEL[c.category] ?? c.category}</td>
                    <td>
                      <span className="chip gray" style={{ fontSize: 11 }}>{CADENCE_LABEL[c.recurring ? c.cadence : 'once']}</span>
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {c.date.slice(0, 10)}
                      {c.recurring && c.endDate && ` → ${c.endDate.slice(0, 10)}`}
                      {c.recurring && !c.endDate && ' → in corso'}
                    </td>
                    <td style={{ textAlign: 'right' }}><b>{euro(c.amountCents)}</b>{c.recurring && <span className="muted" style={{ fontSize: 11 }}>/{c.cadence === 'yearly' ? 'anno' : 'mese'}</span>}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn ghost sm" onClick={() => setEditing(c)} title="Modifica"><i className="ti ti-pencil" /></button>
                      <button className="btn ghost sm" onClick={() => void del(c)} title="Elimina"><i className="ti ti-trash" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={pg.page} totalPages={pg.totalPages} total={pg.total} from={pg.from} to={pg.to} onPage={pg.setPage} />
          </div>
        )}
      </div>

      {editing && (
        <CostModal
          cost={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ margin: 0 }}>
      <span className="muted" style={{ fontSize: 12 }}>{label}</span>
      <div style={{ fontSize: 24, fontWeight: 800, margin: '4px 0 2px', color: color ?? 'var(--ink)' }}>{value}</div>
      {sub && <span className="muted" style={{ fontSize: 12 }}>{sub}</span>}
    </div>
  );
}

function CategoryBars({ items }: { items: { category: string; amountCents: number; source: 'ledger' | 'manual' }[] }) {
  const max = Math.max(...items.map((i) => i.amountCents), 1);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((i) => (
        <div key={`${i.source}:${i.category}`}>
          <div className="spread" style={{ fontSize: 13, marginBottom: 3 }}>
            <span>
              {CAT_LABEL[i.category] ?? i.category}
              {i.source === 'ledger' && <span className="muted" style={{ fontSize: 11 }}> · da ledger</span>}
            </span>
            <b>{euro(i.amountCents)}</b>
          </div>
          <div style={{ height: 8, background: 'var(--line)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${(i.amountCents / max) * 100}%`, height: '100%', background: i.source === 'manual' ? 'var(--coral)' : 'var(--muted)', borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CostModal({ cost, onClose, onSaved }: { cost: CostEntry | null; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(cost?.label ?? '');
  const [category, setCategory] = useState<CostCategory>((cost?.category as CostCategory) ?? 'infrastructure');
  const [amount, setAmount] = useState(cost ? (cost.amountCents / 100).toString().replace('.', ',') : '');
  const [recurring, setRecurring] = useState(cost?.recurring ?? true);
  const [cadence, setCadence] = useState(cost?.recurring ? cost.cadence : 'monthly');
  const [date, setDate] = useState((cost?.date ?? todayIso()).slice(0, 10));
  const [endDate, setEndDate] = useState((cost?.endDate ?? '').slice(0, 10));
  const [vendor, setVendor] = useState(cost?.vendor ?? '');
  const [note, setNote] = useState(cost?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const amountCents = Math.round(parseFloat(amount.replace(',', '.')) * 100);
    if (label.trim().length < 2) { setError('Dai un nome al costo.'); return; }
    if (!Number.isFinite(amountCents) || amountCents <= 0) { setError('Importo non valido.'); return; }
    const body = {
      label: label.trim(),
      category,
      amountCents,
      recurring,
      cadence: recurring ? cadence : 'once',
      date: new Date(date + 'T00:00:00.000Z').toISOString(),
      endDate: recurring && endDate ? new Date(endDate + 'T00:00:00.000Z').toISOString() : null,
      vendor: vendor.trim() || undefined,
      note: note.trim() || undefined,
    };
    setBusy(true);
    try {
      if (cost) await api(`/admin/accounting/costs/${cost.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/admin/accounting/costs', { method: 'POST', body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
      setBusy(false);
    }
  }

  return (
    <Modal title={cost ? 'Modifica costo' : 'Registra costo'} onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      <div className="field">
        <label>Voce di costo</label>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Es. Render (hosting), Google Ads, Stipendio Sara…" autoFocus />
      </div>
      <div className="card-row">
        <div className="field" style={{ flex: 1 }}>
          <label>Categoria</label>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value as CostCategory)}>
            {COST_CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Importo (€)</label>
          <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
        </div>
      </div>
      <div className="field">
        <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
          Costo ricorrente
        </label>
      </div>
      {recurring ? (
        <div className="card-row">
          <div className="field" style={{ flex: 1 }}>
            <label>Cadenza</label>
            <select className="select" value={cadence} onChange={(e) => setCadence(e.target.value)}>
              <option value="monthly">Mensile</option>
              <option value="yearly">Annuale (ammortizzato /12)</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Dal</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Al (facoltativo)</label>
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="field">
          <label>Data</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label>Fornitore (facoltativo)</label>
        <input className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Es. Neon, Vercel, Meta…" />
      </div>
      <div className="field">
        <label>Note (facoltative)</label>
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} style={{ resize: 'vertical' }} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={submit} disabled={busy}>{busy ? 'Salvo…' : cost ? 'Salva' : 'Registra'}</button>
      </div>
    </Modal>
  );
}
