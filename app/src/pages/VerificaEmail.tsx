import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';

/**
 * Pagina aperta dal link di verifica email della REGISTRAZIONE.
 * Conferma il token → l'email dell'account risulta verificata.
 */
export default function VerificaEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [msg, setMsg] = useState('');
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const token = params.get('token') ?? '';
    if (!token) { setState('error'); setMsg('Link non valido.'); return; }
    api<{ verified: boolean }>('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => setState('ok'))
      .catch((e) => { setState('error'); setMsg(e instanceof ApiError ? e.message : 'Verifica non riuscita.'); });
  }, [params]);

  return (
    <div className="app-frame">
      <div className="screen no-tabbar" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 12, padding: 24 }}>
        {state === 'loading' && (<><div className="spin" /><p className="muted">Verifico la tua email…</p></>)}
        {state === 'ok' && (
          <>
            <span className="big-badge" style={{ background: '#DCF0D8', color: '#3B6D11' }}><i className="ti ti-circle-check" /></span>
            <h1>Email verificata!</h1>
            <p className="muted">Il tuo indirizzo è stato confermato. Puoi continuare ad usare Metabole.</p>
            <button className="btn" onClick={() => navigate('/')}>Vai all'app</button>
          </>
        )}
        {state === 'error' && (
          <>
            <span className="big-badge" style={{ background: '#F9E1DE', color: '#B3261E' }}><i className="ti ti-alert-triangle" /></span>
            <h1>Link non valido</h1>
            <p className="muted">{msg}</p>
            <button className="btn ghost" onClick={() => navigate('/')}>Torna alla home</button>
          </>
        )}
      </div>
    </div>
  );
}
