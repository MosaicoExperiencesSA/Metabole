import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { track } from '../lib/track';

/**
 * Popup BLOCCANTE delle misure (Tracciamento_Dati §5).
 * Al 2° giorno di ogni ciclo le misure sono obbligatorie: finché non arrivano,
 * il menu successivo resta "held". Il popup ricompare a ogni apertura e non è
 * chiudibile finché la misura del ciclo non è salvata.
 */

interface Gate {
  required: boolean;
  blocking: boolean;
  cycleDate: string | null;
}

function parseNum(s: string): number | undefined {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function MeasuresGate() {
  const [show, setShow] = useState(false);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function check() {
    try {
      const gate = await api<Gate>('/me/measurement-gate');
      setShow(!!gate.blocking);
      if (gate.blocking) track('measures_gate_shown', { cycleDate: gate.cycleDate });
    } catch {
      /* in caso di errore non blocchiamo l'app */
    }
  }

  useEffect(() => {
    void check();
  }, []);

  async function save() {
    setMsg(null);
    const w = parseNum(weight);
    if (w === undefined) {
      setMsg('Inserisci almeno il peso.');
      return;
    }
    setBusy(true);
    const body: Record<string, number> = { weightKg: w };
    const wa = parseNum(waist);
    const hi = parseNum(hips);
    if (wa !== undefined) body.waistCm = wa;
    if (hi !== undefined) body.hipsCm = hi;
    try {
      await api('/me/measurements', { method: 'POST', body: JSON.stringify(body) });
      track('measures_gate_submitted');
      await check(); // ri-verifica: se non serve più, il popup sparisce
      if (!msg) setShow(false);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  if (!show) return null;

  return (
    <div className="sheet-overlay" style={{ zIndex: 60 }}>
      <div className="sheet-card">
        <div className="row" style={{ alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <span className="event-ic" style={{ background: '#12A386', color: '#fff' }}>
            <i className="ti ti-ruler-2" />
          </span>
          <div>
            <b style={{ fontSize: 16 }}>È il momento delle misure</b>
            <div className="muted" style={{ fontSize: 11 }}>
              Servono per sbloccare il prossimo menu. Meglio al mattino, a digiuno.
            </div>
          </div>
        </div>

        <label className="muted" style={{ fontSize: 12 }}>Peso (kg)</label>
        <input className="input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="es. 68,4" style={{ marginBottom: 8 }} />

        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label className="muted" style={{ fontSize: 12 }}>Vita (cm)</label>
            <input className="input" inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="facolt." />
          </div>
          <div style={{ flex: 1 }}>
            <label className="muted" style={{ fontSize: 12 }}>Fianchi (cm)</label>
            <input className="input" inputMode="decimal" value={hips} onChange={(e) => setHips(e.target.value)} placeholder="facolt." />
          </div>
        </div>

        {msg && <div className="muted" style={{ fontSize: 12, color: '#B4491F', marginTop: 8 }}>{msg}</div>}

        <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={save} disabled={busy}>
          {busy ? 'Salvo…' : 'Salva le misure'}
        </button>
      </div>
    </div>
  );
}
