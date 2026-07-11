import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';

/**
 * Pagina aperta dal link di verifica nella nuova email (cambio email).
 * Conferma il token → la nuova email diventa email secondaria dell'account;
 * poi dal Profilo si sceglie quale tenere come principale.
 */
export default function ConfermaEmail() {
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
    api<{ ok: boolean; email: string }>('/auth/email-change/confirm', { method: 'POST', body: JSON.stringify({ token }) })
      .then((r) => { setState('ok'); setMsg(r.email); })
      .catch((e) => { setState('error'); setMsg(e instanceof ApiError ? e.message : 'Conferma non riuscita.'); });
  }, [params]);

  return (
    <div className="app-frame">
      <div className="screen no-tabbar" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 12, padding: 24 }}>
        {state === 'loading' && (<><div className="spin" /><p className="muted">Confermo la tua email…</p></>)}
        {state === 'ok' && (
          <>
            <span className="big-badge" style={{ background: '#DCF0D8', color: '#3B6D11' }}><i className="ti ti-mail-check" /></span>
            <h1>Email confermata!</h1>
            <p className="muted"><b>{msg}</b> è stata aggiunta al tuo account come email secondaria. Dal Profilo puoi sceglierla come principale o rimuoverla.</p>
            <button className="btn" onClick={() => navigate('/profilo')}>Vai al Profilo</button>
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
