import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';

interface Plan { id: string; name: string; priceCents: number; period: string; mealsPerDay: number | null; features: string[]; active: boolean; }
interface Product { id: string; name: string; priceCents: number; description: string | null; active: boolean; }

const euro = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');
const toCents = (s: string) => Math.round((Number(s.replace(',', '.')) || 0) * 100);

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
            <Fld label="Periodo (es. 3m, 6m, 12m)" v={planForm.period} on={(v) => setPlanForm({ ...planForm, period: v })} />
            <Fld label="Pasti/giorno (opz.)" v={planForm.mealsPerDay} on={(v) => setPlanForm({ ...planForm, mealsPerDay: v })} />
            <Fld label="Caratteristiche (virgola)" v={planForm.features} on={(v) => setPlanForm({ ...planForm, features: v })} wide />
            <label style={fld}><span>Attivo</span>
              <select className="select" value={planForm.active ?? 'true'} onChange={(e) => setPlanForm({ ...planForm, active: e.target.value })}>
                <option value="true">Sì</option><option value="false">No</option>
              </select>
            </label>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={savePlan} disabled={busy}>Salva</button>
            <button className="btn ghost" onClick={() => setPlanForm(null)} disabled={busy}>Annulla</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table className="grid">
          <thead><tr><th>Nome</th><th>Prezzo</th><th>Periodo</th><th>Stato</th><th></th></tr></thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{euro(p.priceCents)}</td>
                <td className="muted">{p.period}</td>
                <td><span className={`chip ${p.active ? '' : 'gray'}`}>{p.active ? 'Attivo' : 'Nascosto'}</span></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost sm" onClick={() => setPlanForm({ id: p.id, name: p.name, price: (p.priceCents / 100).toString().replace('.', ','), period: p.period, mealsPerDay: p.mealsPerDay ? String(p.mealsPerDay) : '', features: p.features.join(', '), active: String(p.active) })}>Modifica</button>
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
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={saveProduct} disabled={busy}>Salva</button>
            <button className="btn ghost" onClick={() => setProdForm(null)} disabled={busy}>Annulla</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table className="grid">
          <thead><tr><th>Nome</th><th>Prezzo</th><th>Descrizione</th><th>Stato</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{euro(p.priceCents)}</td>
                <td className="muted">{p.description ?? '—'}</td>
                <td><span className={`chip ${p.active ? '' : 'gray'}`}>{p.active ? 'Attivo' : 'Nascosto'}</span></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost sm" onClick={() => setProdForm({ id: p.id, name: p.name, price: (p.priceCents / 100).toString().replace('.', ','), description: p.description ?? '', active: String(p.active) })}>Modifica</button>
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

const fld: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' };
function Fld({ label, v, on, wide }: { label: string; v?: string; on: (v: string) => void; wide?: boolean }) {
  return (
    <label style={{ ...fld, ...(wide ? { gridColumn: '1 / -1' } : {}) }}>
      <span>{label}</span>
      <input className="input" value={v ?? ''} onChange={(e) => on(e.target.value)} />
    </label>
  );
}
