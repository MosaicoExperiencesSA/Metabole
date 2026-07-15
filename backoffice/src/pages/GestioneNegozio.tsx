import { useEffect, useState, type CSSProperties } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';

interface Commissions {
  commissionCoachCents: number;
  commissionManagerCoachCents: number;
  commissionNutritionistCents: number;
  commissionHeadNutritionistCents: number;
}
interface Plan extends Commissions { id: string; name: string; priceCents: number; period: string; mealsPerDay: number | null; features: string[]; active: boolean; }
interface Product extends Commissions { id: string; name: string; priceCents: number; description: string | null; active: boolean; }

const euro = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');
const toCents = (s: string) => Math.round((Number((s ?? '').replace(',', '.')) || 0) * 100);
const fromCents = (c: number | null | undefined) => (c ? (c / 100).toString().replace('.', ',') : '');

/** Riepilogo compatto delle provvigioni per la tabella (mostra solo le quote > 0). */
function commSummary(c: Commissions): string {
  const parts: string[] = [];
  if (c.commissionCoachCents) parts.push(`Coach ${euro(c.commissionCoachCents)}`);
  if (c.commissionManagerCoachCents) parts.push(`Mgr coach ${euro(c.commissionManagerCoachCents)}`);
  if (c.commissionNutritionistCents) parts.push(`Nutriz. ${euro(c.commissionNutritionistCents)}`);
  if (c.commissionHeadNutritionistCents) parts.push(`Capo nutr. ${euro(c.commissionHeadNutritionistCents)}`);
  return parts.length ? parts.join(' · ') : '—';
}

/** I 4 campi provvigione in €, condivisi dai form piano e prodotto. */
function CommissionInputs({ form, set }: { form: Record<string, string>; set: (f: Record<string, string>) => void }) {
  return (
    <>
      <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
        Provvigioni per questo articolo (importi fissi in €, 0 = nessuna). In caso di sconto sono ridotte in proporzione.
      </div>
      <Fld label="Provv. coach (€)" v={form.cCoach} on={(v) => set({ ...form, cCoach: v })} />
      <Fld label="Provv. manager coach (€)" v={form.cMgrCoach} on={(v) => set({ ...form, cMgrCoach: v })} />
      <Fld label="Provv. nutrizionista (€)" v={form.cNutri} on={(v) => set({ ...form, cNutri: v })} />
      <Fld label="Provv. capo nutrizionista (€)" v={form.cHeadNutri} on={(v) => set({ ...form, cHeadNutri: v })} />
    </>
  );
}
const commBody = (f: Record<string, string>) => ({
  commissionCoachCents: toCents(f.cCoach ?? '0'),
  commissionManagerCoachCents: toCents(f.cMgrCoach ?? '0'),
  commissionNutritionistCents: toCents(f.cNutri ?? '0'),
  commissionHeadNutritionistCents: toCents(f.cHeadNutri ?? '0'),
});
const commFormFrom = (c: Commissions) => ({
  cCoach: fromCents(c.commissionCoachCents),
  cMgrCoach: fromCents(c.commissionManagerCoachCents),
  cNutri: fromCents(c.commissionNutritionistCents),
  cHeadNutri: fromCents(c.commissionHeadNutritionistCents),
});

export function GestioneNegozio() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<Record<string, string> | null>(null);
  const [prodForm, setProdForm] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [pl, pr] = await Promise.all([
        api<Plan[]>('/admin/shop/plans'),
        api<Product[]>('/admin/shop/products'),
      ]);
      setPlans(pl);
      setProducts(pr);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata agli amministratori.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function savePlan() {
    if (!planForm) return;
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      name: planForm.name,
      priceCents: toCents(planForm.price ?? '0'),
      period: planForm.period || '3m',
      features: (planForm.features ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      active: planForm.active !== 'false',
      ...commBody(planForm),
    };
    if (planForm.mealsPerDay) body.mealsPerDay = Number(planForm.mealsPerDay);
    try {
      if (planForm.id) await api(`/admin/shop/plans/${planForm.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/admin/shop/plans', { method: 'POST', body: JSON.stringify(body) });
      setPlanForm(null);
      setNotice('Piano salvato.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  async function saveProduct() {
    if (!prodForm) return;
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      name: prodForm.name,
      priceCents: toCents(prodForm.price ?? '0'),
      description: prodForm.description || undefined,
      active: prodForm.active !== 'false',
      ...commBody(prodForm),
    };
    try {
      if (prodForm.id) await api(`/admin/shop/products/${prodForm.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/admin/shop/products', { method: 'POST', body: JSON.stringify(body) });
      setProdForm(null);
      setNotice('Prodotto salvato.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  async function delPlan(id: string) {
    if (!confirm('Eliminare questo piano?')) return;
    try {
      await api(`/admin/shop/plans/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }
  async function delProduct(id: string) {
    if (!confirm('Eliminare questo prodotto?')) return;
    try {
      await api(`/admin/shop/products/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {/* Piani */}
      <div className="spread" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Piani</h2>
        <button className="btn sm" onClick={() => setPlanForm({ period: '3m', active: 'true' })}><i className="ti ti-plus" /> Nuovo piano</button>
      </div>

      {planForm && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{planForm.id ? 'Modifica piano' : 'Nuovo piano'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Nome" v={planForm.name} on={(v) => setPlanForm({ ...planForm, name: v })} />
            <Fld label="Prezzo (€)" v={planForm.price} on={(v) => setPlanForm({ ...planForm, price: v })} />
            <Fld label="Periodo (es. 8d, 2w, 3m, 1y)" v={planForm.period} on={(v) => setPlanForm({ ...planForm, period: v })} />
            <Fld label="Pasti/giorno (opz.)" v={planForm.mealsPerDay} on={(v) => setPlanForm({ ...planForm, mealsPerDay: v })} />
            <Fld label="Caratteristiche (virgola)" v={planForm.features} on={(v) => setPlanForm({ ...planForm, features: v })} wide />
            <label style={fld}><span>Attivo</span>
              <select className="select" value={planForm.active ?? 'true'} onChange={(e) => setPlanForm({ ...planForm, active: e.target.value })}>
                <option value="true">Sì</option><option value="false">No</option>
              </select>
            </label>
            <CommissionInputs form={planForm} set={setPlanForm} />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={savePlan} disabled={busy}>Salva</button>
            <button className="btn ghost" onClick={() => setPlanForm(null)} disabled={busy}>Annulla</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table className="grid">
          <thead><tr><th>Nome</th><th>Prezzo</th><th>Periodo</th><th>Provvigioni</th><th>Stato</th><th></th></tr></thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{euro(p.priceCents)}</td>
                <td className="muted">{p.period}</td>
                <td className="muted" style={{ fontSize: 12 }}>{commSummary(p)}</td>
                <td><span className={`chip ${p.active ? '' : 'gray'}`}>{p.active ? 'Attivo' : 'Nascosto'}</span></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost sm" onClick={() => setPlanForm({ id: p.id, name: p.name, price: fromCents(p.priceCents), period: p.period, mealsPerDay: p.mealsPerDay ? String(p.mealsPerDay) : '', features: p.features.join(', '), active: String(p.active), ...commFormFrom(p) })}>Modifica</button>
                  <button className="btn ghost sm" style={{ color: '#b3261e' }} onClick={() => delPlan(p.id)}><i className="ti ti-trash" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Prodotti */}
      <div className="spread" style={{ margin: '22px 0 10px' }}>
        <h2 style={{ margin: 0 }}>Integratori / prodotti</h2>
        <button className="btn sm" onClick={() => setProdForm({ active: 'true' })}><i className="ti ti-plus" /> Nuovo prodotto</button>
      </div>

      {prodForm && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{prodForm.id ? 'Modifica prodotto' : 'Nuovo prodotto'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Nome" v={prodForm.name} on={(v) => setProdForm({ ...prodForm, name: v })} />
            <Fld label="Prezzo (€)" v={prodForm.price} on={(v) => setProdForm({ ...prodForm, price: v })} />
            <Fld label="Descrizione" v={prodForm.description} on={(v) => setProdForm({ ...prodForm, description: v })} wide />
            <label style={fld}><span>Attivo</span>
              <select className="select" value={prodForm.active ?? 'true'} onChange={(e) => setProdForm({ ...prodForm, active: e.target.value })}>
                <option value="true">Sì</option><option value="false">No</option>
              </select>
            </label>
            <CommissionInputs form={prodForm} set={setProdForm} />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={saveProduct} disabled={busy}>Salva</button>
            <button className="btn ghost" onClick={() => setProdForm(null)} disabled={busy}>Annulla</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table className="grid">
          <thead><tr><th>Nome</th><th>Prezzo</th><th>Provvigioni</th><th>Stato</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{euro(p.priceCents)}</td>
                <td className="muted" style={{ fontSize: 12 }}>{commSummary(p)}</td>
                <td><span className={`chip ${p.active ? '' : 'gray'}`}>{p.active ? 'Attivo' : 'Nascosto'}</span></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost sm" onClick={() => setProdForm({ id: p.id, name: p.name, price: fromCents(p.priceCents), description: p.description ?? '', active: String(p.active), ...commFormFrom(p) })}>Modifica</button>
                  <button className="btn ghost sm" style={{ color: '#b3261e' }} onClick={() => delProduct(p.id)}><i className="ti ti-trash" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const fld: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' };
function Fld({ label, v, on, wide }: { label: string; v?: string; on: (v: string) => void; wide?: boolean }) {
  return (
    <label style={{ ...fld, ...(wide ? { gridColumn: '1 / -1' } : {}) }}>
      <span>{label}</span>
      <input className="input" value={v ?? ''} onChange={(e) => on(e.target.value)} />
    </label>
  );
}
