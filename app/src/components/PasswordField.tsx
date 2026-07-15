import { useState, type InputHTMLAttributes } from 'react';

/**
 * Campo password con "occhiolino" da tenere premuto per vedere la password in chiaro:
 * finché il dito è premuto sull'icona la password è visibile, al rilascio torna nascosta.
 * Accetta tutte le props di un <input> (value, onChange, required, minLength, autoComplete…).
 */
export default function PasswordField(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const hide = () => setShow(false);
  const { className, style, ...rest } = props;

  return (
    <div style={{ position: 'relative' }}>
      <input
        {...rest}
        type={show ? 'text' : 'password'}
        className={className ?? 'input'}
        style={{ paddingRight: 46, ...style }}
      />
      <button
        type="button"
        aria-label="Tieni premuto per vedere la password"
        title="Tieni premuto per vedere la password"
        onPointerDown={() => setShow(true)}
        onPointerUp={hide}
        onPointerLeave={hide}
        onPointerCancel={hide}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          position: 'absolute',
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 36,
          height: 36,
          border: 'none',
          background: 'transparent',
          color: 'var(--muted)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          touchAction: 'none',
        }}
      >
        <i className={`ti ${show ? 'ti-eye' : 'ti-eye-off'}`} style={{ fontSize: 20 }} />
      </button>
    </div>
  );
}
