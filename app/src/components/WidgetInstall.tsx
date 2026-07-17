import { useState } from 'react';

/**
 * Suggerisce l'installazione del widget Metabole nella home del telefono.
 * Il widget è già incluso nell'APK; su Android l'utente lo aggiunge a mano dalla
 * home (il sistema non permette di aggiungerlo in automatico dall'app). Il bottone
 * apre una guida con i passaggi. Mostrato dopo l'acquisto (schermata "Tutto pronto!").
 */
export default function WidgetInstall({ variant = 'primary' }: { variant?: 'primary' | 'ghost' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={variant === 'ghost' ? 'btn ghost' : 'btn'}
        style={{ width: '100%' }}
        onClick={() => setOpen(true)}
      >
        <i className="ti ti-layout-grid-add" style={{ marginRight: 6 }} /> Installa il widget
      </button>

      {open && (
        <div className="sheet-overlay" onClick={() => setOpen(false)}>
          <div className="sheet-card" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--teal)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <i className="ti ti-layout-grid-add" style={{ fontSize: 16 }} />
              </span>
              <b style={{ fontSize: 16 }}>Aggiungi il widget alla home</b>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
              Il widget Metabole ti mostra la frase di Gaia e i tuoi progressi (acqua, passi) direttamente
              sulla home del telefono. Per aggiungerlo:
            </p>
            <ol style={{ margin: '4px 0 12px', paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
              <li>Tieni premuto su una zona vuota della <b>home del telefono</b>.</li>
              <li>Tocca <b>“Widget”</b>.</li>
              <li>Cerca <b>Metabole</b> nell'elenco.</li>
              <li>Tieni premuto sul widget e <b>trascinalo</b> dove preferisci.</li>
            </ol>
            <p className="muted" style={{ fontSize: 11, marginTop: 0 }}>
              Puoi scegliere tra tre formati: quadrato, rettangolare e largo.
            </p>
            <button type="button" className="btn" style={{ width: '100%', marginTop: 6 }} onClick={() => setOpen(false)}>Ho capito</button>
          </div>
        </div>
      )}
    </>
  );
}
