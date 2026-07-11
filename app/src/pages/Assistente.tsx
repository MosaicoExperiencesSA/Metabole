import { useState } from 'react';

/**
 * Assistente AI — chat con la coach digitale (protocolli validati dalla nutrizionista).
 * Layout come nel prototipo definitivo: bolle a sinistra (assistente) e a destra (utente).
 */

interface Msg { from: 'ai' | 'me'; text: string }

const SEED: Msg[] = [
  { from: 'ai', text: 'Energia bassa e turno lungo oggi: vuoi che ti alleggerisca il pranzo?' },
  { from: 'me', text: 'Sì, e stasera non ho tempo' },
  { from: 'ai', text: 'Fatto. Cena in 10 minuti e pranzo da portare. Protocollo validato dalla nutrizionista.' },
];

export default function Assistente() {
  const [msgs, setMsgs] = useState<Msg[]>(SEED);
  const [text, setText] = useState('');

  function send() {
    const t = text.trim();
    if (!t) return;
    setMsgs((m) => [...m, { from: 'me', text: t }]);
    setText('');
    // Risposta simulata: quando ci sarà l'endpoint AI, qui si chiamerà l'API.
    setTimeout(() => {
      setMsgs((m) => [...m, { from: 'ai', text: 'Ricevuto! Aggiorno il tuo piano e ti avviso appena è pronto.' }]);
    }, 500);
  }

  return (
    <div className="menu">
      <div className="menu-head">
        <span className="event-ic" style={{ background: '#ECE7F7', color: '#6C5AB7' }}><i className="ti ti-sparkles" /></span>
        <div><h1 style={{ margin: 0 }}>Assistente AI</h1><div className="muted">Protocolli validati dalla nutrizionista</div></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: m.from === 'me' ? 'var(--teal)' : '#fff',
              color: m.from === 'me' ? '#fff' : 'inherit',
              borderRadius: 16,
              padding: '10px 12px',
              fontSize: 13,
              boxShadow: m.from === 'me' ? 'none' : '0 2px 6px rgba(16,64,58,.06)',
            }}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className="row" style={{ gap: 8, position: 'sticky', bottom: 0 }}>
        <input
          className="input"
          placeholder="Scrivi…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          style={{ flex: 1, borderRadius: 22 }}
        />
        <button className="btn" style={{ padding: '10px 13px' }} onClick={send} aria-label="Invia"><i className="ti ti-send" /></button>
      </div>
    </div>
  );
}
