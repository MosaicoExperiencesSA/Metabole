import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useCart } from '../cart/CartContext';

const euro = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €';

export default function Checkout() {
  const cart = useCart();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<{ code: string; discountCents: number; finalCents: number } | null>(null);
  const [method, setMethod] = useState<'card' | 'bank_transfer'>('card');
  const [methods, setMethods] = useState<{ card: boolean; bank_transfer: boolean }>({ card: true, bank_transfer: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Mostra solo i metodi abilitati dal backoffice (Parametri).
  useEffect(() => {
    api<{ card: boolean; bank_transfer: boolean }>('/payment-methods')
      .then((m) => {
        setMethods(m);
        setMethod((cur) => (m[cur] ? cur : m.card ? 'card' : 'bank_transfer'));
      })
      .catch(() => {});
  }, []);

  const subtotal = cart.subtotalCents;
  const total = applied ? applied.finalCents : subtotal;

  async function applyCode() {
    setErr(null);
    if (!code.trim()) return;
    try {
      const res = await api<{ code: string; discountCents: number; finalCents: number }>('/me/discounts/validate', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim(), amountCents: subtotal }),
      });
      setApplied(res);
    } catch (e) {
      setApplied(null);
      setErr(e instanceof ApiError ? e.message : 'Buono non valido.');
    }
  }

  async function pay() {
    setBusy(true);
    setErr(null);
    const body = {
      planId: cart.plan?.id,
      items: cart.products.map((p) => ({ productId: p.id, qty: p.qty })),
      method,
      discountCode: applied?.code,
    };
    try {
      const res = await api<{ checkoutUrl?: string; transferReference?: string }>('/me/checkout', { method: 'POST', body: JSON.stringify(body) });
      if (method === 'card') {
        if (res.checkoutUrl) window.location.href = res.checkoutUrl;
        else setErr('Pagamento con carta non disponibile: prova col bonifico.');
      } else {
        cart.clear();
        setDone('Ti abbiamo inviato via email gli estremi del bonifico. Il tuo acquisto si attiva dopo la verifica del pagamento.');
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Pagamento non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="menu">
        <div style={{ textAlign: 'center', paddingTop: 20 }}>
          <span className="big-badge" style={{ background: '#DCF0D8', color: '#3B6D11', margin: '0 auto 14px' }}><i className="ti ti-mail-check" /></span>
          <h1>Ci siamo quasi!</h1>
          <p className="muted">{done}</p>
          <button className="btn" onClick={() => navigate('/')}>Torna alla home</button>
        </div>
      </div>
    );
  }

  if (cart.count === 0) {
    return (
      <div className="menu">
        <div className="menu-head">
          <span className="event-ic" style={{ background: '#EFEAF9', color: '#6C5AB7' }}><i className="ti ti-basket" /></span>
          <div><h1 style={{ margin: 0 }}>Carrello</h1><div className="muted">Il tuo carrello è vuoto</div></div>
        </div>
        <button className="btn" onClick={() => navigate('/negozio')}>Vai al negozio</button>
      </div>
    );
  }

  return (
    <div className="menu">
      <div className="menu-head">
        <span className="event-ic" style={{ background: '#EFEAF9', color: '#6C5AB7' }}><i className="ti ti-basket" /></span>
        <div><h1 style={{ margin: 0 }}>Carrello</h1><div className="muted">Rivedi e paga</div></div>
      </div>

      {/* Articoli */}
      <div className="card">
        {cart.plan && (
          <div className="row-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <div><b style={{ fontSize: 14 }}>{cart.plan.name}</b><div className="muted" style={{ fontSize: 11 }}>Abbonamento</div></div>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>{euro(cart.plan.priceCents)}</span>
              <button className="btn-recipe" style={{ padding: '2px 8px', background: '#eee', color: '#b3261e' }} onClick={() => cart.setPlan(null)}><i className="ti ti-x" /></button>
            </div>
          </div>
        )}
        {cart.products.map((p) => (
          <div key={p.id} className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ flex: 1 }}><b style={{ fontSize: 14 }}>{p.name}</b><div className="muted" style={{ fontSize: 11 }}>{euro(p.priceCents)} · cad.</div></div>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <button className="btn-recipe" style={{ padding: '2px 8px' }} onClick={() => cart.setQty(p.id, p.qty - 1)}>−</button>
              <b style={{ fontSize: 13, minWidth: 16, textAlign: 'center' }}>{p.qty}</b>
              <button className="btn-recipe" style={{ padding: '2px 8px' }} onClick={() => cart.setQty(p.id, p.qty + 1)}>+</button>
            </div>
          </div>
        ))}
      </div>

      {/* Buono sconto */}
      <div className="card">
        <b style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Hai un buono sconto?</b>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ flex: 1, textTransform: 'uppercase' }} placeholder="Codice" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setApplied(null); }} />
          <button className="btn" style={{ width: 'auto', padding: '11px 16px' }} onClick={applyCode}>Applica</button>
        </div>
        {applied && <div className="muted" style={{ marginTop: 8, color: '#0e7c66', fontWeight: 600 }}>Buono applicato: −{euro(applied.discountCents)}</div>}
      </div>

      {/* Metodo — solo quelli abilitati dal backoffice */}
      <div className="sec">Come vuoi pagare?</div>
      <div className="opt-list">
        {methods.card && (
          <button type="button" className={`opt${method === 'card' ? ' on' : ''}`} onClick={() => setMethod('card')}>
            <span className="opt-ind">{method === 'card' && <i className="ti ti-check" />}</span>
            <span><b>Carta</b> · pagamento sicuro con Stripe</span>
          </button>
        )}
        {methods.bank_transfer && (
          <button type="button" className={`opt${method === 'bank_transfer' ? ' on' : ''}`} onClick={() => setMethod('bank_transfer')}>
            <span className="opt-ind">{method === 'bank_transfer' && <i className="ti ti-check" />}</span>
            <span><b>Bonifico</b> · estremi via email</span>
          </button>
        )}
        {!methods.card && !methods.bank_transfer && (
          <div className="card"><p className="muted" style={{ margin: 0, fontSize: 13 }}>Nessun metodo di pagamento è attivo al momento. Riprova più tardi.</p></div>
        )}
      </div>

      {/* Totale */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row-between"><span className="muted">Subtotale</span><span>{euro(subtotal)}</span></div>
        {applied && <div className="row-between" style={{ marginTop: 4 }}><span className="muted">Sconto</span><span style={{ color: '#0e7c66' }}>−{euro(applied.discountCents)}</span></div>}
        <div className="row-between" style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}><span>Totale</span><span>{euro(total)}</span></div>
      </div>

      {err && <div className="banner err" style={{ marginTop: 12 }}>{err}</div>}

      <button className="btn" style={{ marginTop: 14 }} onClick={pay} disabled={busy || (!methods.card && !methods.bank_transfer)}>
        {busy ? 'Attendi…' : method === 'card' ? `Paga ${euro(total)}` : 'Ricevi gli estremi'}
      </button>
    </div>
  );
}
