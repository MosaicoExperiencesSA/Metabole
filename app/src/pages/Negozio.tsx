import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';

/** Negozio — piani (carta/Stripe) e integratori (ordine con bonifico). */

interface Plan { id: string; name: string; priceCents: number; period: string; features: string[]; }
interface Product { id: string; name: string; priceCents: number; description: string | null; }

const euro = (c: number) => `€ ${Math.round(c / 100)}`;
const PERIOD: Record<string, string> = { '3m': '3 mesi', '6m': '6 mesi', '12m': '12 mesi' };
const ICONS = ['ti-pill', 'ti-bottle', 'ti-flask'];
const COLORS: [string, string][] = [['#DCEBE3', '#0E7C66'], ['#EFEAF9', '#6C5AB7'], ['#F3E8DC', '#B8863B']];

export default function Negozio() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api<Plan[]>('/plans').then(setPlans).catch(() => {});
    api<Product[]>('/products').then(setProducts).catch(() => {});
  }, []);

  async function buyPlan(planId: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api<{ checkoutUrl?: string }>('/me/subscribe', { method: 'POST', body: JSON.stringify({ planId, method: 'card' }) });
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
      else setMsg('Pagamento con carta non disponibile: riprova più tardi.');
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Acquisto non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  async function placeOrder() {
    const items = Object.entries(cart).filter(([, q]) => q > 0).map(([productId, qty]) => ({ productId, qty }));
    if (!items.length) return;
    setBusy(true);
    setMsg(null);
    try {
      await api('/me/orders', { method: 'POST', body: JSON.stringify({ items }) });
      setCart({});
      setMsg('Ordine inviato! Ti abbiamo mandato via email gli estremi per il bonifico.');
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Ordine non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  const cartTotal = products.reduce((a, p) => a + (cart[p.id] ?? 0) * p.priceCents, 0);
  const cartCount = Object.values(cart).reduce((a, q) => a + q, 0);

  return (
    <div className="menu">
      <div className="menu-head">
        <span className="event-ic" style={{ background: '#EFEAF9', color: '#6C5AB7' }}><i className="ti ti-shopping-bag" /></span>
        <div><h1 style={{ margin: 0 }}>Negozio</h1><div className="muted">Piani e integratori</div></div>
      </div>

      {msg && <div className="banner ok" style={{ marginBottom: 12 }}>{msg}</div>}

      <div className="sec" style={{ marginTop: 4 }}>Piani</div>
      {plans.map((p, i) => (
        <div key={p.id} className="card" style={{ ...(i === 0 ? { border: '2px solid #12A386' } : {}) }}>
          <div className="row-between">
            <div style={{ flex: 1 }}>
              {i === 0 && <span className="meal-tag" style={{ background: '#DCF0D8', color: '#3B6D11' }}>Più scelto</span>}
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: i === 0 ? 5 : 0 }}>{p.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{PERIOD[p.period] ?? p.period}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{euro(p.priceCents)}</div>
              <button className="btn-recipe" style={{ marginTop: 5 }} disabled={busy} onClick={() => buyPlan(p.id)}>Acquista</button>
            </div>
          </div>
        </div>
      ))}

      <div className="sec">Integratori</div>
      <div className="meals-col">
        {products.map((p, i) => {
          const [bg, col] = COLORS[i % COLORS.length];
          const qty = cart[p.id] ?? 0;
          return (
            <div className="card storico-row" key={p.id}>
              <span className="event-ic" style={{ width: 40, height: 40, borderRadius: 12, background: bg, color: col }}><i className={`ti ${ICONS[i % ICONS.length]}`} style={{ fontSize: 20 }} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                {p.description && <div className="muted" style={{ fontSize: 11 }}>{p.description}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{euro(p.priceCents)}</div>
                {qty > 0 ? (
                  <div className="row" style={{ gap: 6, marginTop: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                    <button className="btn-recipe" style={{ padding: '2px 8px' }} onClick={() => setCart((c) => ({ ...c, [p.id]: Math.max(0, (c[p.id] ?? 0) - 1) }))}>−</button>
                    <b style={{ fontSize: 13 }}>{qty}</b>
                    <button className="btn-recipe" style={{ padding: '2px 8px' }} onClick={() => setCart((c) => ({ ...c, [p.id]: (c[p.id] ?? 0) + 1 }))}>+</button>
                  </div>
                ) : (
                  <button className="btn-recipe" style={{ marginTop: 4, padding: '4px 10px', fontSize: 11 }} onClick={() => setCart((c) => ({ ...c, [p.id]: 1 }))}>
                    <i className="ti ti-plus" style={{ fontSize: 12 }} /> Aggiungi
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {cartCount > 0 && (
        <button className="btn" style={{ marginTop: 14 }} disabled={busy} onClick={placeOrder}>
          <i className="ti ti-basket" /> Ordina {cartCount} · {euro(cartTotal)}
        </button>
      )}
    </div>
  );
}
