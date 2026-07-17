import { useEffect, useState, type CSSProperties } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';

interface Commissions {
  commissionCoachCents: number;
  commissionManagerCoachCents: number;
  commissionNutritionistCents: number;
  commissionHeadNutritionistCents: number;
  // Rete a differenza: percentuali per livello (0 = livello non pagato).
  commissionCoachPct?: number;
  commissionCoordinatorPct?: number;
  commissionManagerPct?: number;
  commissionNutritionistPct?: number;
  commissionHeadNutritionistPct?: number;
}
interface Plan extends Commissions { id: string; name: string; priceCents: number; listPriceCents: number | null; promoEndsAt: string | null; promoActive?: boolean; period: string; mealsPerDay: number | null; features: string[]; active: boolean; repurchasable: boolean; }
interface Product extends Commissions { id: string; name: string; priceCents: number; description: string | null; active: boolean; repurchasable: boolean; }

const euro = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');
const toCents = (s: string) => Math.round((Number((s ?? '').replace(',', '.')) || 0) * 100);
const fromCents = (c: number | null | undefined) => (c ? (c / 100).toString().replace('.', ',') : '');

/** Riepilogo compatto delle provvigioni per la tabella (mostra solo le quote > 0). */
function commSummary(c: Commissions): string {
  const parts: string[] = [];
  // Rete a differenza (percentuali): se impostate, vincono sugli importi fissi legacy.
  const pct = (c.commissionCoachPct ?? 0) || (c.commissionCoordinatorPct ?? 0) || (c.commissionManagerPct ?? 0) || (c.commissionNutritionistPct ?? 0) || (c.commissionHeadNutritionistPct ?? 0);
  if (pct) {
    if (c.commissionCoachPct) parts.push(`Coach ${c.commissionCoachPct}%`);
    if (c.commissionCoordinatorPct) parts.push(`Coord. ${c.commissionCoordinatorPct}%`);
    if (c.commissionManagerPct) parts.push(`Mgr ${c.commissionManagerPct}%`);
    if (c.commissionNutritionistPct) parts.push(`Nutriz. ${c.commissionNutritionistPct}%`);
    if (c.commissionHeadNutritionistPct) parts.push(`Capo n. ${c.commissionHeadNutritionistPct}%`);
    return parts.join(' · ') + ' (a differenza)';
  }
  if (c.commissionCoachCents) parts.push(`Coach ${euro(c.commissionCoachCents)}`);
  if (c.commissionManagerCoachCents) parts.push(`Mgr coach ${euro(c.commissionManagerCoachCents)}`);
  if (c.commissionNutritionistCents) parts.push(`Nutriz. ${euro(c.commissionNutritionistCents)}`);
  if (c.commissionHeadNutritionistCents) parts.push(`Capo nutr. ${euro(c.commissionHeadNutritionistCents)}`);
  return parts.length ? parts.join(' · ') : '—';
}

/**
 * Provvigioni della RETE A DIFFERENZA: percentuali per livello sull'importo pagato.
 * Ognuno incassa la differenza col livello sotto (25/35/45 → 25+10+10 a rete
 * completa; coach sotto la manager senza coordinatrice → 25+20). Stessa logica
 * nutrizionista → capo. Con tutte le percentuali a 0 valgono ancora gli importi
 * fissi legacy già salvati sull'articolo.
 */
function CommissionInputs({ form, set }: { form: Record<string, string>; set: (f: Record<string, string>) => void }) {
  return (
    <>
      <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
        Provvigioni a DIFFERENZA (in % sull'importo pagato): ogni livello incassa la differenza col livello sotto.
        Es. 25 / 35 / 45 → coach 25%, coordinatrice 10%, manager 10%. Tutte a 0 = valgono gli eventuali importi fissi storici.
      </div>
      <Fld label="Coach (%)" v={form.pCoach} on={(v) => set({ ...form, pCoach: v })} />
      <Fld label="Coordinatrice (%)" v={form.pCoord} on={(v) => set({ ...form, pCoord: v })} />
      <Fld label="Manager (%)" v={form.pMgr} on={(v) => set({ ...form, pMgr: v })} />
      <Fld label="Nutrizionista (%)" v={form.pNutri} on={(v) => set({ ...form, pNutri: v })} />
      <Fld label="Capo nutrizionista (%)" v={form.pHeadNutri} on={(v) => set({ ...form, pHeadNutri: v })} />
    </>
  );
}
const toPct = (s: string) => Math.max(0, Math.min(100, Math.round(Number((s ?? '').replace(',', '.')) || 0)));
const commBody = (f: Record<string, string>) => ({
  commissionCoachPct: toPct(f.pCoach ?? '0'),
  commissionCoordinatorPct: toPct(f.pCoord ?? '0'),
  commissionManagerPct: toPct(f.pMgr ?? '0'),
  commissionNutritionistPct: toPct(f.pNutri ?? '0'),
  commissionHeadNutritionistPct: toPct(f.pHeadNutri ?? '0'),
});
const commFormFrom = (c: Commissions) => ({
  pCoach: c.commissionCoachPct ? String(c.commissionCoachPct) : '',
  pCoord: c.commissionCoordinatorPct ? String(c.commissionCoordinatorPct) : '',
  pMgr: c.commissionManagerPct ? String(c.commissionManagerPct) : '',
  pNutri: c.commissionNutritionistPct ? String(c.commissionNutritionistPct) : '',
  pHeadNutri: c.commissionHeadNutritionistPct ? String(c.commissionHeadNutritionistPct) : '',
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
      // Listino barrato + fine promo (vuoti = nessuna promo / promo senza scadenza).
      listPriceCents: planForm.listPrice?.trim() ? toCents(planForm.listPrice) : null,
      promoEndsAt: planForm.promoEndsAt?.trim() ? new Date(planForm.promoEndsAt).toISOString() : null,
      period: planForm.period || '3m',
      features: (planForm.features ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      active: planForm.active !== 'false',
      repurchasable: planForm.repurchasable !== 'false',
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
      repurchasable: prodForm.repurchasable !== 'false',
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
        <button className="btn sm" onClick={() => setPlanForm({ period: '3m', active: 'true', repurchasable: 'true' })}><i className="ti ti-plus" /> Nuovo piano</button>
      </div>

      {planForm && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{planForm.id ? 'Modifica piano' : 'Nuovo piano'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fld label="Nome" v={planForm.name} on={(v) => setPlanForm({ ...planForm, name: v })} />
            <Fld label="Prezzo di vendita (€)" v={planForm.price} on={(v) => setPlanForm({ ...planForm, price: v })} />
            <Fld label="Prezzo di listino barrato (€, opz.)" v={planForm.listPrice} on={(v) => setPlanForm({ ...planForm, listPrice: v })} />
            <label style={fld}><span>Fine promo (opz. — scaduta, torna il listino)</span>
              <input className="input" type="datetime-local" value={planForm.promoEndsAt ?? ''} onChange={(e) => setPlanForm({ ...planForm, promoEndsAt: e.target.value })} />
            </label>
            <Fld label="Periodo (es. 8d, 2w, 3m, 1y)" v={planForm.period} on={(v) => setPlanForm({ ...planForm, period: v })} />
            <Fld label="Pasti/giorno (opz.)" v={planForm.mealsPerDay} on={(v) => setPlanForm({ ...planForm, mealsPerDay: v })} />
            <Fld label="Caratteristiche (virgola)" v={planForm.features} on={(v) => setPlanForm({ ...planForm, features: v })} wide />
            <label style={fld}><span>Attivo</span>
              <select className="select" value={planForm.active ?? 'true'} onChange={(e) => setPlanForm({ ...planForm, active: e.target.value })}>
                <option value="true">Sì</option><option value="false">No</option>
              </select>
            </label>
            <label style={fld}><span>Riacquistabile</span>
              <select className="select" value={planForm.repurchasable ?? 'true'} onChange={(e) => setPlanForm({ ...planForm, repurchasable: e.target.value })} title="Se No: dopo l'acquisto scompare dallo shop di quel cliente">
                <option value="true">Sì (sempre visibile)</option><option value="false">No (sparisce dopo l'acquisto)</option>
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
                <td>
                  {p.listPriceCents != null && p.listPriceCents > p.priceCents ? (
                    <>
                      <s className="muted" style={{ marginRight: 6 }}>{euro(p.listPriceCents)}</s>
                      <b>{euro(p.priceCents)}</b>
                      {p.promoEndsAt && <div className="muted" style={{ fontSize: 10 }}>promo fino al {new Date(p.promoEndsAt).toLocaleDateString('it-IT')}</div>}
                    </>
                  ) : euro(p.priceCents)}
                </td>
                <td className="muted">{p.period}</td>
                <td className="muted" style={{ fontSize: 12 }}>{commSummary(p)}</td>
                <td><span className={`chip ${p.active ? '' : 'gray'}`}>{p.active ? 'Attivo' : 'Nascosto'}</span></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost sm" onClick={() => setPlanForm({ id: p.id, name: p.name, price: fromCents(p.priceCents), listPrice: p.listPriceCents != null ? fromCents(p.listPriceCents) : '', promoEndsAt: p.promoEndsAt ? p.promoEndsAt.slice(0, 16) : '', period: p.period, mealsPerDay: p.mealsPerDay ? String(p.mealsPerDay) : '', features: p.features.join(', '), active: String(p.active), repurchasable: String(p.repurchasable), ...commFormFrom(p) })}>Modifica</button>
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
        <button className="btn sm" onClick={() => setProdForm({ active: 'true', repurchasable: 'true' })}><i className="ti ti-plus" /> Nuovo prodotto</button>
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
            <label style={fld}><span>Riacquistabile</span>
              <select className="select" value={prodForm.repurchasable ?? 'true'} onChange={(e) => setProdForm({ ...prodForm, repurchasable: e.target.value })} title="Se No: dopo l'acquisto scompare dallo shop di quel cliente">
                <option value="true">Sì (sempre visibile)</option><option value="false">No (sparisce dopo l'acquisto)</option>
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
                  <button className="btn ghost sm" onClick={() => setProdForm({ id: p.id, name: p.name, price: fromCents(p.priceCents), description: p.description ?? '', active: String(p.active), repurchasable: String(p.repurchasable), ...commFormFrom(p) })}>Modifica</button>
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
