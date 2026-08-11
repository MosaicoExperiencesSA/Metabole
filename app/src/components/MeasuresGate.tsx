import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { track } from '../lib/track';
import { parseMisura } from '../lib/misure';
import { EVENTO_APRI_MISURE } from './MenuStatusBanner';

/**
 * Popup delle misure (Tracciamento_Dati §5).
 * Al 2° giorno di ogni ciclo le misure sono obbligatorie: finché non arrivano, il menu successivo
 * resta "held". Quando è bloccante ricompare a ogni apertura e non si chiude finché la misura del
 * ciclo non è salvata.
 *
 * Si apre anche **su richiesta**, dal pulsante del banner nella schermata Menu (evento
 * `metabole:apri-misure`), e in quel caso si chiude: è una cortesia, non un muro. Serve alla cliente
 * a cui la coach ha riaperto l'app — nessun popup, ma il menu resta in attesa della pesata: senza
 * una strada per inserirla, il banner sarebbe un rimprovero senza rimedio (caso Giusy, 13/8).
 */

interface Gate {
  required: boolean;
  blocking: boolean;
  cycleDate: string | null;
  /**
   * 'popup' = richiudibile · 'locked' = app ferma, serve la coach (voce #6 del 5/8) ·
   * 'promemoria' = la coach ha riaperto l'app: si chiede, non si blocca.
   */
  level?: 'none' | 'popup' | 'locked' | 'promemoria';
  lockedMessage?: string | null;
}



export default function MeasuresGate() {
  const [show, setShow] = useState(false);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Dal giorno dopo la richiesta il gate diventa un blocco vero: niente scorciatoie, e l'unica
  // via d'uscita è inserire le misure o farsi riaprire l'app dalla coach.
  const [locked, setLocked] = useState(false);
  // Aperto dalla cliente (dal banner) e non dal gate: si può chiudere, e il titolo non la sgrida.
  const [volontario, setVolontario] = useState(false);

  async function check() {
    try {
      const gate = await api<Gate>('/me/measurement-gate');
      setShow(!!gate.blocking);
      setLocked(gate.level === 'locked');
      if (gate.blocking) track('measures_gate_shown', { cycleDate: gate.cycleDate, level: gate.level ?? 'popup' });
    } catch {
      /* in caso di errore non blocchiamo l'app */
    }
  }

  useEffect(() => {
    void check();
  }, []);

  // Apertura su richiesta dal banner «Serve la tua pesata».
  useEffect(() => {
    const apri = () => {
      setVolontario(true);
      setLocked(false);
      setShow(true);
      track('measures_gate_shown', { cycleDate: null, level: 'volontario' });
    };
    window.addEventListener(EVENTO_APRI_MISURE, apri);
    return () => window.removeEventListener(EVENTO_APRI_MISURE, apri);
  }, []);

  async function save() {
    setMsg(null);
    const w = parseMisura(weight);
    if (w === undefined) {
      setMsg('Inserisci almeno il peso.');
      return;
    }
    setBusy(true);
    const body: Record<string, number> = { weightKg: w };
    const wa = parseMisura(waist);
    const hi = parseMisura(hips);
    if (wa !== undefined) body.waistCm = wa;
    if (hi !== undefined) body.hipsCm = hi;
    try {
      await api('/me/measurements', { method: 'POST', body: JSON.stringify(body) });
      track('measures_gate_submitted');
      // La misura sblocca il menu del ciclo successivo (il backend prova a erogarlo
      // subito). Ricarichiamo così dashboard, menu e lista della spesa mostrano il menu
      // appena sbloccato — altrimenti restavano quelli vecchi finché non si riapriva l'app.
      setShow(false);
      window.location.reload();
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
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: 16 }}>
              {locked ? 'App in pausa' : volontario ? 'La tua pesata' : 'È il momento delle misure'}
            </b>
            <div className="muted" style={{ fontSize: 11 }}>
              {locked
                ? 'Contatta la tua coach per sbloccare la app — oppure inserisci qui le misure e riparte subito.'
                : 'Servono per sbloccare il prossimo menu. Meglio al mattino, a digiuno.'}
            </div>
          </div>
          {volontario && !locked && (
            <button
              className="btn ghost"
              aria-label="Chiudi"
              style={{ flex: 'none', padding: '4px 9px' }}
              onClick={() => { setShow(false); setVolontario(false); }}
            >
              <i className="ti ti-x" />
            </button>
          )}
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
