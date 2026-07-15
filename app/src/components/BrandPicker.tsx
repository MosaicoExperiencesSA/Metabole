import { useState } from 'react';
import { BRAND_PALETTE, getBrand, setBrand, type Brand } from '../lib/brand';

/**
 * Selettore "Colore dell'app": i 6 colori della palette + il pulsante "Auto"
 * (un colore nuovo ogni due giorni). Riutilizzato nel profilo cliente e staff.
 */
export default function BrandPicker() {
  const [sel, setSel] = useState<Brand>(getBrand());

  function pick(b: Brand) {
    setSel(b);
    setBrand(b);
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {BRAND_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Colore ${c}`}
          onClick={() => pick(c)}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: c,
            cursor: 'pointer',
            padding: 0,
            border: `3px solid ${sel === c ? '#0B302B' : 'transparent'}`,
            boxShadow: `0 4px 10px ${c}55`,
          }}
        />
      ))}
      <button
        type="button"
        aria-label="Colore automatico"
        title="Auto: un colore nuovo ogni due giorni"
        onClick={() => pick('auto')}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          cursor: 'pointer',
          padding: 0,
          position: 'relative',
          display: 'inline-flex',
          background: 'conic-gradient(from 90deg,#F2B807,#E23B3B,#E86FA6,#2F80ED,#12A386,#F2820A,#F2B807)',
          border: `3px solid ${sel === 'auto' ? '#0B302B' : 'transparent'}`,
        }}
      >
        <i
          className="ti ti-sparkles"
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15 }}
        />
      </button>
    </div>
  );
}
