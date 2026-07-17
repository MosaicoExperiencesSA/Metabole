import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { DEFAULT_WATER_UNIT, isWaterUnit, WATER_UNIT_KEYS, WATER_UNITS, type WaterUnit } from '../lib/water';

/**
 * Selettore "Come vuoi vedere l'acqua": bicchieri o bottiglie da 0,5 / 1 / 1,5 L.
 * Salva la preferenza lato server (`/me/preferences` → prefs.waterUnit); è solo una
 * scelta di visualizzazione (icona + unità + quanto aggiunge un tap in dashboard).
 */
export default function WaterUnitPicker() {
  const [sel, setSel] = useState<WaterUnit>(DEFAULT_WATER_UNIT);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ waterUnit?: string }>('/me/preferences')
      .then((p) => { if (isWaterUnit(p.waterUnit)) setSel(p.waterUnit); })
      .catch(() => {});
  }, []);

  async function pick(u: WaterUnit) {
    const prev = sel;
    setSel(u);
    setSaved(false);
    try {
      await api('/me/preferences', { method: 'PUT', body: JSON.stringify({ waterUnit: u }) });
      setSaved(true);
    } catch {
      setSel(prev); // ripristina se il salvataggio fallisce
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {WATER_UNIT_KEYS.map((u) => {
          const active = sel === u;
          return (
            <button
              key={u}
              type="button"
              onClick={() => pick(u)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 12px',
                borderRadius: 14,
                cursor: 'pointer',
                textAlign: 'left',
                background: active ? '#EAF6F1' : '#fff',
                border: `2px solid ${active ? '#12A386' : '#E7ECEA'}`,
              }}
            >
              <i className={`ti ${WATER_UNITS[u].icon}`} style={{ fontSize: 20, color: active ? '#0E7C66' : '#2AA7C4' }} />
              <span style={{ fontSize: 13, fontWeight: active ? 700 : 500 }}>{WATER_UNITS[u].label}</span>
            </button>
          );
        })}
      </div>
      {saved && (
        <p className="muted" style={{ margin: '10px 0 0', fontSize: 11 }}>
          <i className="ti ti-check" style={{ fontSize: 12, verticalAlign: '-1px', color: '#12A386' }} /> Salvato: l'acqua in dashboard usa ora questa unità.
        </p>
      )}
    </div>
  );
}
