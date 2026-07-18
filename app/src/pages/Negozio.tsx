import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useCart } from '../cart/CartContext';
import AppHeader from '../components/AppHeader';

/** Negozio — piani e integratori. Si aggiunge al carrello, poi checkout unico. */

interface Plan { id: string; name: string; priceCents: number; listPriceCents?: number | null; promoActive?: boolean; period: string; features: string[]; }
interface Product { id: string; name: string; priceCents: number; description: string | null; }

const euro = (c: number) => `€ ${Math.round(c / 100)}`;
const PERIOD: Record<string, string> = { '1m': '1 mese', '3m': '3 mesi', '6m': '6 mesi', '12m': '12 mesi', '8d': '8 giorni', maintenance: 'mensile · disdici quando vuoi' };
const ICONS = ['ti-pill', 'ti-bottle', 'ti-flask'];
const COLORS: [string, string][] = [['#DCEBE3', '#0E7C66'], ['#EFEAF9', '#6C5AB7'], ['#F3E8DC', '#B8863B']];

/** Stato minimo del Monitoraggio per la card gratuita nello shop. */
interface MonitoringLite { eligible: boolean; period: { status: string; daysLeft: number } | null }

export default function Negozio() {
  const cart = useCart();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringLite | null>(null);
  const [monBusy, setMonBusy] = useState(false);
  const [monMsg, setMonMsg] = useState<string | null>(null);

  useEffect(() => {
    api<Plan[]>('/me/plans').then(setPlans).catch(() => {});
    api<Product[]>('/me/products').then(setProducts).catch(() => {});
    api<MonitoringLite>('/me/monitoring').then(setMonitoring).catch(() => setMonitoring(null));
  }, []);

  /** Il Monitoraggio è gratuito: si attiva subito, senza carrello. */
  async function startMonitoring() {
    setMonBusy(true);
    setMonMsg(null);
    try {
      await api('/me/monitoring/start', { method: 'POST' });
      navigate('/percorso');
    } catch (e) {
      setMonMsg(e instanceof Error ? e.message : 'Attivazione non riuscita.');
    } finally {
      setMonBusy(false);
    }
  }

  // "Più scelto" va su un PERCORSO, non sul mantenimento da €29 (che essendo il
  // più economico finirebbe primo nell'ordinamento per prezzo).
  const featuredId = plans.find((p) => p.period !== 'maintenance')?.id ?? null;

  return (
    <div className="home" style={{ paddingBottom: cart.count > 0 ? 72 : undefined }}>
      <AppHeader title="Shop" />

      <div className="sec" style={{ marginTop: 4 }}>Piani</div>
      {plans.map((p) => {
        const inCart = cart.plan?.id === p.id;
        const featured = p.id === featuredId;
        const isMaint = p.period === 'maintenance';
        return (
          <div key={p.id} className="card" style={featured ? { border: '2px solid #12A386' } : isMaint ? { border: '1.5px solid #E8825A' } : {}}>
            <div className="row-between">
              <div style={{ flex: 1 }}>
                {featured && <span className="meal-tag" style={{ background: '#DCF0D8', color: '#3B6D11' }}>Più scelto</span>}
                {isMaint && <span className="meal-tag" style={{ background: '#FBEEE7', color: '#B4491F' }}>Una pausa che tiene il peso</span>}
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: featured || isMaint ? 5 : 0 }}>{p.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{PERIOD[p.period] ?? p.period}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>
                  {p.promoActive && p.listPriceCents != null && (
                    <s style={{ color: '#8A938F', fontWeight: 500, fontSize: 13, marginRight: 6 }}>{euro(p.listPriceCents)}</s>
                  )}
                  {euro(p.priceCents)}
                </div>
                {inCart ? (
                  <span className="chip" style={{ marginTop: 5, background: '#DCF0D8', color: '#3B6D11' }}><i className="ti ti-check" /> Nel carrello</span>
                ) : (
                  <button className="btn-recipe" style={{ marginTop: 5 }} onClick={() => cart.setPlan({ id: p.id, name: p.name, priceCents: p.priceCents, period: p.period })}>Aggiungi</button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Monitoraggio: gratuito, non passa dal carrello (si attiva e basta). */}
      {monitoring && (monitoring.eligible || monitoring.period?.status === 'active') && (
        <div className="card" style={{ border: '1.5px solid #B8863B' }}>
          <div className="row-between">
            <div style={{ flex: 1 }}>
              <span className="meal-tag" style={{ background: '#FBF6EA', color: '#8A5A00' }}>Gratis · 1 mese</span>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 5 }}>Monitoraggio</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Gaia resta in allerta e ti chiede le misure. Se riprendi peso, il tuo kit di rientro (8 menu) è a €29.
              </div>
              {monMsg && <div style={{ fontSize: 11.5, color: '#B4491F', marginTop: 4 }}>{monMsg}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#8A5A00' }}>€ 0</div>
              {monitoring.period?.status === 'active' ? (
                <span className="chip" style={{ marginTop: 5, background: '#DCF0D8', color: '#3B6D11' }}>
                  <i className="ti ti-check" /> Attivo · {monitoring.period.daysLeft} gg
                </span>
              ) : (
                <button className="btn-recipe" style={{ marginTop: 5 }} disabled={monBusy} onClick={() => void startMonitoring()}>
                  {monBusy ? 'Attivo…' : 'Attiva gratis'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="sec">Integratori</div>
      <div className="meals-col">
        {products.map((p, i) => {
          const [bg, col] = COLORS[i % COLORS.length];
          const line = cart.products.find((x) => x.id === p.id);
          const qty = line?.qty ?? 0;
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
                    <button className="btn-recipe" style={{ padding: '2px 8px' }} onClick={() => cart.setQty(p.id, qty - 1)}>−</button>
                    <b style={{ fontSize: 13 }}>{qty}</b>
                    <button className="btn-recipe" style={{ padding: '2px 8px' }} onClick={() => cart.setQty(p.id, qty + 1)}>+</button>
                  </div>
                ) : (
                  <button className="btn-recipe" style={{ marginTop: 4, padding: '4px 10px', fontSize: 11 }} onClick={() => cart.addProduct({ id: p.id, name: p.name, priceCents: p.priceCents })}>
                    <i className="ti ti-plus" style={{ fontSize: 12 }} /> Aggiungi
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {cart.count > 0 && (
        <button className="cart-bar" onClick={() => navigate('/checkout')}>
          <i className="ti ti-basket" /> Vai al carrello · {cart.count} · {euro(cart.subtotalCents)}
        </button>
      )}
    </div>
  );
}
