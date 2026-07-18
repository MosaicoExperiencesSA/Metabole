import { ReactNode } from 'react';

/** Scheda che sale dal basso (bottom sheet), come nel prototipo. */
export default function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet-card">
        <button className="sheet-close" onClick={onClose} aria-label="Chiudi">
          <i className="ti ti-x" />
        </button>
        <div className="sheet-grab" />
        {children}
      </div>
    </div>
  );
}
