import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { track } from '../lib/track';
import { useCart } from '../cart/CartContext';
import AppHeader from '../components/AppHeader';
import Sheet from '../components/Sheet';
import { AVVISO_INDIRIZZO, campiMancanti, nomeCampo, type IndirizzoCheckout } from '../lib/indirizzoCheckout';

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
  // Indirizzo di spedizione: si chiede SOLO se non è già in scheda.
  const [addr, setAddr] = useState({ addressLine: '', postalCode: '', city: '', province: '' });
  const [hasAddress, setHasAddress] = useState(false);
  const [editAddr, setEditAddr] = useState(false);
  // Popup «Completa i dati per procedere»: si apre se la cliente sceglie come pagare (o preme
  // «Paga») con l'indirizzo a metà. Da quel momento i campi vuoti restano segnati in rosso.
  const [avvisoIndirizzo, setAvvisoIndirizzo] = useState(false);
  const [segnaMancanti, setSegnaMancanti] = useState(false);
  const campiRef = useRef<Partial<Record<keyof IndirizzoCheckout, HTMLInputElement | null>>>({});

  // Carrello abbandonato: segnala l'inizio del checkout (una volta per apertura).
  // Se non si conclude l'acquisto, partono i recuperi automatici a +1h/+24h/+72h.
  useEffect(() => {
    if (cart.plan || cart.products.length > 0) {
      track('checkout_started', {
        planId: cart.plan?.id ?? null,
        products: cart.products.length,
        totalCents: cart.subtotalCents,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api<{ addressLine?: string | null; postalCode?: string | null; city?: string | null; province?: string | null }>('/me/profile')
      .then((p) => {
        const a = { addressLine: p.addressLine ?? '', postalCode: p.postalCode ?? '', city: p.city ?? '', province: p.province ?? '' };
        setAddr(a);
        const complete = !!(a.addressLine && a.postalCode && a.city && a.province);
        setHasAddress(complete);
        setEditAddr(!complete); // se manca, il form parte già aperto
      })
      .catch(() => setEditAddr(true));
  }, []);

  const mancanti = campiMancanti(addr);
  const addrComplete = mancanti.length === 0;
  const formIndirizzo = !(hasAddress && !editAddr);
  function upAddr(k: keyof typeof addr, v: string) { setAddr((s) => ({ ...s, [k]: v })); }

  /** true = indirizzo a metà: apre il popup e il pagamento non parte. */
  function fermaSeIndirizzoIncompleto(): boolean {
    if (!formIndirizzo || addrComplete) return false;
    setSegnaMancanti(true);
    setAvvisoIndirizzo(true);
    return true;
  }

  function chiudiAvviso() {
    setAvvisoIndirizzo(false);
    const primo = campiMancanti(addr)[0];
    const el = primo ? campiRef.current[primo] : null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    }
  }

  function scegliMetodo(m: 'card' | 'bank_transfer') {
    setMethod(m);
    fermaSeIndirizzoIncompleto();
  }

  const segnato = (k: keyof IndirizzoCheckout) => (segnaMancanti && mancanti.includes(k) ? ' manca' : '');

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
  const isFree = total <= 0;

  // --- Abbonamento: le stesse tre regole del backend, dette PRIMA di premere "paga" ---
  // Il backend le impone comunque (`commerce.service.checkout`); qui servono a non far arrivare
  // nessuno a un errore rosso dopo aver compilato indirizzo e metodo di pagamento.
  const ricorrente = cart.ricorrente;
  const bloccoProdotti = ricorrente && cart.products.length > 0;
  const metodiVisibili = ricorrente ? { card: methods.card, bank_transfer: false } : methods;

  // Solo carta sul ricorrente, e niente buoni: se erano già stati scelti, si tolgono da soli
  // quando la cliente passa il mantenimento da "un mese solo" ad "abbonamento".
  useEffect(() => {
    if (!ricorrente) return;
    setMethod('card');
    setApplied(null);
    setCode('');
  }, [ricorrente]);

  async function applyCode() {
    setErr(null);
    if (!code.trim()) return;
    try {
      const res = await api<{ code: string; discountCents: number; finalCents: number }>('/me/discounts/validate', {
        method: 'POST',
        // planId/planPriceCents: servono ai codici col prezzo target per piano (Opzione B).
        body: JSON.stringify({ code: code.trim(), amountCents: subtotal, planId: cart.plan?.id ?? undefined, planPriceCents: cart.plan?.priceCents ?? undefined }),
      });
      setApplied(res);
    } catch (e) {
      setApplied(null);
      setErr(e instanceof ApiError ? e.message : 'Buono non valido.');
    }
  }

  async function pay() {
    if (busy) return;
    if (fermaSeIndirizzoIncompleto()) return;
    setBusy(true);
    setErr(null);
    // Se l'indirizzo è stato inserito/modificato ora, lo salviamo in scheda prima di pagare.
    if (editAddr) {
      if (!addrComplete) { setErr('Completa l’indirizzo di spedizione.'); setBusy(false); return; }
      try {
        await api('/me/profile', { method: 'PATCH', body: JSON.stringify({
          addressLine: addr.addressLine.trim(), postalCode: addr.postalCode.trim(),
          city: addr.city.trim(), province: addr.province.trim().toUpperCase(),
        }) });
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : 'Non è stato possibile salvare l’indirizzo.');
        setBusy(false);
        return;
      }
    }
    const body = {
      planId: cart.plan?.id,
      items: cart.products.map((p) => ({ productId: p.id, qty: p.qty })),
      method,
      discountCode: applied?.code,
      // Conta solo sui piani venduti in entrambi i modi (il mantenimento). Sugli altri decide il
      // piano e il backend ignora questo campo.
      abbonamento: cart.plan?.abbonamento ?? false,
    };
    try {
      const res = await api<{ checkoutUrl?: string; transferReference?: string; free?: boolean }>('/me/checkout', { method: 'POST', body: JSON.stringify(body) });
      if (res.free) {
        cart.clear();
        setDone('Attivato! Il tuo accesso è pronto: nessun pagamento richiesto.');
      } else if (method === 'card') {
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
        <AppHeader title="Carrello" />
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
        <AppHeader title="Carrello" />
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
      <AppHeader title="Carrello" />
      <div className="menu-head">
        <span className="event-ic" style={{ background: '#EFEAF9', color: '#6C5AB7' }}><i className="ti ti-basket" /></span>
        <div><h1 style={{ margin: 0 }}>Carrello</h1><div className="muted">Rivedi e paga</div></div>
      </div>

      {/* Articoli */}
      <div className="card">
        {cart.plan && (
          <div style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="row-between">
              <div>
                <b style={{ fontSize: 14 }}>{cart.plan.name}</b>
                <div className="muted" style={{ fontSize: 11 }}>
                  {ricorrente ? 'Abbonamento mensile · si rinnova da solo' : 'Pagamento unico · nessun rinnovo'}
                </div>
              </div>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>{euro(cart.plan.priceCents)}</span>
                <button className="btn-recipe" style={{ padding: '2px 8px', background: '#eee', color: '#b3261e' }} onClick={() => cart.setPlan(null)}><i className="ti ti-x" /></button>
              </div>
            </div>
            {/* Ultima occasione per cambiare idea sul mantenimento, senza tornare al negozio. */}
            {(cart.plan.billing ?? 'one_time') === 'both' && (
              <button
                type="button"
                className="btn-recipe"
                style={{ marginTop: 6, padding: '3px 10px', fontSize: 11 }}
                onClick={() => cart.setAbbonamento(!cart.plan?.abbonamento)}
              >
                <i className="ti ti-repeat" style={{ fontSize: 12, marginRight: 3 }} />
                {ricorrente ? 'Passa a un mese solo' : 'Passa all’abbonamento'}
              </button>
            )}
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

      {/* Prodotti + abbonamento nello stesso ordine: non si può (una riga ricorrente sola). */}
      {bloccoProdotti && (
        <div className="banner err" style={{ marginTop: 12 }}>
          L’abbonamento si acquista da solo. Togli gli integratori dal carrello e riprendili in un secondo ordine:
          se restassero qui, li pagheresti ogni mese insieme all’abbonamento.
        </div>
      )}

      {/* Buono sconto: non sul ricorrente (resterebbe applicato a ogni rinnovo, per sempre). */}
      {!ricorrente && (
      <div className="card">
        <b style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Hai un buono sconto?</b>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ flex: 1, textTransform: 'uppercase' }} placeholder="Codice" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setApplied(null); }} />
          <button className="btn" style={{ width: 'auto', padding: '11px 16px' }} onClick={applyCode}>Applica</button>
        </div>
        {applied && <div className="muted" style={{ marginTop: 8, color: '#0e7c66', fontWeight: 600 }}>Buono applicato: −{euro(applied.discountCents)}</div>}
      </div>
      )}

      {isFree && (
        <div className="card" style={{ marginTop: 12 }}><p className="muted" style={{ margin: 0, fontSize: 13 }}>Prodotto gratuito: nessun pagamento richiesto.</p></div>
      )}

      {/* Indirizzo di spedizione: chiesto solo se non è già in scheda. */}
      <div className="sec">Indirizzo di spedizione</div>
      {hasAddress && !editAddr ? (
        <div className="card">
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{addr.addressLine}</div>
              <div className="muted" style={{ marginTop: 2 }}>{addr.postalCode} {addr.city} ({addr.province})</div>
            </div>
            <button type="button" className="btn-recipe" style={{ padding: '4px 10px' }} onClick={() => setEditAddr(true)}>Modifica</button>
          </div>
        </div>
      ) : (
        <div className="card">
          <input ref={(el) => { campiRef.current.addressLine = el; }} className={`input${segnato('addressLine')}`} placeholder="Via e numero civico" value={addr.addressLine} onChange={(e) => upAddr('addressLine', e.target.value)} autoComplete="address-line1" />
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <input ref={(el) => { campiRef.current.postalCode = el; }} className={`input${segnato('postalCode')}`} style={{ flex: '0 0 34%' }} placeholder="CAP" inputMode="numeric" value={addr.postalCode} onChange={(e) => upAddr('postalCode', e.target.value)} autoComplete="postal-code" />
            <input ref={(el) => { campiRef.current.city = el; }} className={`input${segnato('city')}`} style={{ flex: 1 }} placeholder="Città" value={addr.city} onChange={(e) => upAddr('city', e.target.value)} autoComplete="address-level2" />
          </div>
          <input ref={(el) => { campiRef.current.province = el; }} className={`input${segnato('province')}`} style={{ marginTop: 8 }} placeholder="Provincia (es. MI)" maxLength={4} value={addr.province} onChange={(e) => upAddr('province', e.target.value.toUpperCase())} autoComplete="address-level1" />
          {segnaMancanti && !addrComplete && (
            <p className="avviso-rosso" role="alert">
              <i className="ti ti-alert-circle" /> {AVVISO_INDIRIZZO}
            </p>
          )}
        </div>
      )}

      {!isFree && <div className="sec">Come vuoi pagare?</div>}
      {!isFree && (
      <div className="opt-list">
        {metodiVisibili.card && (
          <button type="button" className={`opt${method === 'card' ? ' on' : ''}`} onClick={() => scegliMetodo('card')}>
            <span className="opt-ind">{method === 'card' && <i className="ti ti-check" />}</span>
            <span><b>Carta</b> · pagamento sicuro con Stripe</span>
          </button>
        )}
        {metodiVisibili.bank_transfer && (
          <button type="button" className={`opt${method === 'bank_transfer' ? ' on' : ''}`} onClick={() => scegliMetodo('bank_transfer')}>
            <span className="opt-ind">{method === 'bank_transfer' && <i className="ti ti-check" />}</span>
            <span><b>Bonifico</b> · estremi via email</span>
          </button>
        )}
        {/* Il bonifico non è sparito per un errore: un addebito automatico ha bisogno di una carta. */}
        {ricorrente && methods.bank_transfer && (
          <p className="muted" style={{ fontSize: 11.5, margin: '2px 2px 0' }}>
            L’abbonamento si paga con carta, perché si rinnova da solo.
            {(cart.plan?.billing ?? 'one_time') === 'both' && ' Col bonifico puoi comprare un mese solo.'}
          </p>
        )}
        {!metodiVisibili.card && !metodiVisibili.bank_transfer && (
          <div className="card"><p className="muted" style={{ margin: 0, fontSize: 13 }}>Nessun metodo di pagamento è attivo al momento. Riprova più tardi.</p></div>
        )}
      </div>
      )}

      {/* Totale */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row-between"><span className="muted">Subtotale</span><span>{euro(subtotal)}</span></div>
        {applied && <div className="row-between" style={{ marginTop: 4 }}><span className="muted">Sconto</span><span style={{ color: '#0e7c66' }}>−{euro(applied.discountCents)}</span></div>}
        <div className="row-between" style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>
          <span>Totale</span><span>{euro(total)}{ricorrente ? ' / mese' : ''}</span>
        </div>
        {ricorrente && (
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 11.5 }}>
            Oggi paghi {euro(total)}. Poi si rinnova ogni mese, stessa cifra, finché non disdici: puoi farlo dal tuo
            profilo in qualsiasi momento e resta attivo fino alla fine del mese già pagato.
          </p>
        )}
      </div>

      {err && <div className="banner err" style={{ marginTop: 12 }}>{err}</div>}

      <button
        className="btn"
        style={{ marginTop: 14 }}
        onClick={pay}
        disabled={busy || bloccoProdotti || (!isFree && !metodiVisibili.card && !metodiVisibili.bank_transfer)}
      >
        {busy ? 'Attendi…' : isFree ? 'Attiva gratis' : ricorrente ? `Attiva l’abbonamento · ${euro(total)}/mese` : method === 'card' ? `Paga ${euro(total)}` : 'Ricevi gli estremi'}
      </button>

      {avvisoIndirizzo && (
        <Sheet onClose={chiudiAvviso}>
          <div style={{ textAlign: 'center', padding: '4px 4px 0' }}>
            <span className="big-badge" style={{ background: '#fdecec', color: '#b3261e', margin: '0 auto 12px' }}><i className="ti ti-map-pin" /></span>
            <h2 className="avviso-rosso-titolo">{AVVISO_INDIRIZZO}</h2>
            <p className="muted" style={{ fontSize: 13.5, margin: '6px 0 14px' }}>
              Per spedirti l’ordine ci serve l’indirizzo completo. Mancano:
            </p>
            <ul className="avviso-rosso-lista">
              {mancanti.map((k) => <li key={k}>{nomeCampo(k)}</li>)}
            </ul>
            <button className="btn" style={{ marginTop: 16 }} onClick={chiudiAvviso}>Completa l’indirizzo</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
