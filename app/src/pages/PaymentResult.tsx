import { useNavigate } from 'react-router-dom';

/** Ritorno da Stripe Checkout: /payment/success e /payment/cancelled. */
export default function PaymentResult({ ok }: { ok: boolean }) {
  const nav = useNavigate();
  return (
    <div className="onb-body" style={{ textAlign: 'center', paddingTop: 24 }}>
      <span className="big-badge" style={{ background: ok ? '#DCF0D8' : '#F7DAD6', color: ok ? '#3B6D11' : '#993C1D', margin: '0 auto 14px' }}>
        <i className={`ti ${ok ? 'ti-circle-check' : 'ti-x'}`} />
      </span>
      <h1>{ok ? 'Pagamento ricevuto!' : 'Pagamento annullato'}</h1>
      <p className="muted">
        {ok
          ? 'Grazie! Stiamo attivando il tuo piano — il menu arriva a breve.'
          : 'Nessun addebito effettuato. Puoi completare il pagamento quando vuoi.'}
      </p>
      <button className="btn" style={{ marginTop: 8 }} onClick={() => nav('/')}>Vai alla home</button>
    </div>
  );
}
