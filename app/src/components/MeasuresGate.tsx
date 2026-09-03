import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { track } from '../lib/track';
import VideoMisure from './VideoMisure';
import { parseMisura } from '../lib/misure';
import { EVENTO_APRI_MISURE } from './MenuStatusBanner';
import { frasePausaMenu } from '../lib/da-quanto-fermo';
import { entroIlTempo, leggiFrase, serveChiedere, type DomandaInSospeso } from '../lib/pesataDaConfermare';

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
  /**
   * ⚠️ Da quando la pesata è dovuta. Il backend lo manda da sempre e NESSUNO lo leggeva (voce
   * 253, giro del 16/8 sui dati che agiscono senza farsi vedere): il riquadro diceva «App in
   * pausa» e basta, cioè uno stato senza storia — chi legge non sa se è successo stamattina o se
   * va avanti da una settimana, e non ha modo di capire quanto sta perdendo.
   */
  since?: string | null;
}



export default function MeasuresGate() {
  const [show, setShow] = useState(false);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  /** La domanda «è giusto?» prima del salvataggio — vedi `chiediSeTorna` qui sotto. */
  const [daConfermare, setDaConfermare] = useState<DomandaInSospeso | null>(null);
  // Dal giorno dopo la richiesta il gate diventa un blocco vero: niente scorciatoie, e l'unica
  // via d'uscita è inserire le misure o farsi riaprire l'app dalla coach.
  const [locked, setLocked] = useState(false);
  /** Da quando il menu è fermo: serve alla frase del riquadro «App in pausa». */
  const [since, setSince] = useState<string | null>(null);
  // Aperto dalla cliente (dal banner) e non dal gate: si può chiudere, e il titolo non la sgrida.
  const [volontario, setVolontario] = useState(false);
  /**
   * PROMEMORIA: la coach ha riaperto l'app. Si CHIEDE, non si impone.
   *
   * ⚠️ Il caso Giusy, seconda puntata (11/8). Il backend faceva già la cosa giusta — dopo «Riapri
   * l'app» risponde `required: true, blocking: false, level: 'promemoria'`, cioè «cade il muro,
   * resta la richiesta» — ma qui si guardava **solo** `blocking`. Risultato: riaperta l'app, il
   * modulo per inserire le misure SPARIVA. Lei riceveva la notifica «inserisci le misure», apriva,
   * non trovava nessun posto dove scriverle, e alla scadenza della finestra si ritrovava bloccata
   * come prima. Una richiesta senza il modo di soddisfarla è un rimprovero, non una richiesta.
   */
  const [promemoria, setPromemoria] = useState(false);
  /**
   * IL VIDEO DELLE MISURE (20/8, Simone). Chiuso finché non lo tocca, e non è pigrizia di
   * interfaccia: questo riquadro spesso è un **blocco** — il menu è fermo e lei vuole scrivere il
   * peso e andarsene. Un video che parte da solo, lì dentro, è qualcosa che si mette in mezzo.
   *
   * ⚠️ Il file pesa 2 MB e con `preload="none"` non si scarica finché non lo apre: fino ad allora
   * costano solo i 55 KB della copertina. È il genere di dettaglio che non si vede da Milano col
   * wi-fi e si vede benissimo da un telefono in giro con pochi giga.
   */

  async function check() {
    try {
      const gate = await api<Gate>('/me/measurement-gate');
      // `required && !blocking` = la finestra della coach è aperta: si mostra lo stesso modulo, ma
      // richiudibile. È l'unica strada che la cliente ha per inserire le misure in quella finestra.
      const daChiedere = !gate.blocking && !!gate.required;
      setPromemoria(daChiedere);
      setShow(!!gate.blocking || daChiedere);
      setLocked(gate.level === 'locked');
      setSince(gate.since ?? null);
      if (gate.blocking || daChiedere) {
        track('measures_gate_shown', { cycleDate: gate.cycleDate, level: gate.level ?? 'popup' });
      }
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

  /**
   * ⛔ **LA DOMANDA VA ANCHE QUI, ed è la porta dove il numero sbagliato fa più male** (aggiunto in
   * revisione della voce `pesata-strana-chiedi-conferma`).
   *
   * Delle tre schermate da cui una cliente scrive un peso, questa è **la bloccante**: «App in
   * pausa», «Serve la tua pesata». È il momento in cui digita di fretta per far ripartire il menu —
   * e in cui un 113 al posto di 73 le sospende il fabbisogno **proprio mentre il menu riparte**. La
   * voce dice «quando digita un peso che non torna»: qui digita, e lasciarla muta sarebbe coprire
   * due porte su tre, saltando quella a rischio più alto.
   *
   * ⛔ E qui **meno che mai è un cancello**: dopo il salvataggio c'è un `window.location.reload()`
   * che sblocca il menu. Se la verifica cade o tarda, si tira dritto e si salva.
   */
  async function chiediSeTorna(pesoKg: number): Promise<string | null> {
    try {
      return await entroIlTempo(
        api<unknown>(`/me/measurements/verifica?weightKg=${encodeURIComponent(String(pesoKg))}`).then(leggiFrase),
      );
    } catch {
      return null;
    }
  }

  async function save() {
    setMsg(null);
    const w = parseMisura(weight);
    if (w === undefined) {
      setMsg('Inserisci almeno il peso.');
      return;
    }
    if (serveChiedere(daConfermare, w)) {
      setBusy(true);
      const frase = await chiediSeTorna(w);
      setBusy(false);
      if (frase) {
        setDaConfermare({ frase, pesoScritto: w });
        return;
      }
    }
    setBusy(true);
    setDaConfermare(null);
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
              {locked ? 'App in pausa' : promemoria ? 'Serve la tua pesata' : volontario ? 'La tua pesata' : 'È il momento delle misure'}
            </b>
            <div className="muted" style={{ fontSize: 11 }}>
              {locked
                /* `frasePausaMenu` mette dentro il «da quanto» quando lo sappiamo, e quando non lo
                   sappiamo lascia la frase di prima invece di inventare «da 0 giorni». */
                ? frasePausaMenu(since)
                : promemoria
                  /* Dopo il «Riapri l'app» il muro non c'è più, ma il menu resta fermo finché la
                     pesata non arriva: dirglielo è l'unico modo perché quella finestra serva a
                     qualcosa. Puoi chiudere questo riquadro, e lo ritrovi dal banner del Menu. */
                  ? 'La tua coach ti ha riaperto l’app. Il prossimo menu però parte solo con la pesata: inseriscila qui, ci vuole un attimo.'
                  : 'Servono per sbloccare il prossimo menu. Meglio al mattino, a digiuno.'}
            </div>
          </div>
          {(volontario || promemoria) && !locked && (
            <button
              className="btn ghost"
              aria-label="Chiudi"
              style={{ flex: 'none', padding: '4px 9px' }}
              onClick={() => { setShow(false); setVolontario(false); setPromemoria(false); }}
            >
              <i className="ti ti-x" />
            </button>
          )}
        </div>

        <label className="muted" style={{ fontSize: 12 }}>Peso (kg)</label>
        <input className="input" inputMode="decimal" value={weight} onChange={(e) => { setWeight(e.target.value); setDaConfermare(null); }} placeholder="es. 68,4" style={{ marginBottom: 8 }} />

        {/*
          ⚠️ **Sta QUI, sopra vita e fianchi, e non in cima al riquadro.** Il peso non lo sbaglia
          nessuno: si sale sulla bilancia. Il dubbio — «dove passo il metro?» — nasce esattamente
          su queste due caselle, e una spiegazione che arriva due centimetri prima della domanda
          vale più della stessa spiegazione messa in alto, dove si legge come un'intestazione e si
          salta.
        */}
        <VideoMisure forma="riga" origine="blocco-misure" />

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

        {/*
          ⛔ **Si chiede, non si blocca.** «Sì, è giusto» salva il numero identico a prima e il menu
          riparte: qui dentro c'è già un muro, e aggiungerne un secondo su un dubbio nostro
          significherebbe tenere una cliente ferma perché non crediamo alla sua bilancia.
        */}
        {daConfermare && (
          <div className="card" style={{ marginTop: 10, background: '#FBF0D6', border: '1px solid #EAD8A6', boxShadow: 'none' }}>
            <div style={{ fontSize: 13, color: '#7A5B12', marginBottom: 8, lineHeight: 1.5 }}>{daConfermare.frase}</div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" style={{ flex: 1, padding: 10 }} onClick={save} disabled={busy}>
                {busy ? 'Salvo…' : 'Sì, è giusto'}
              </button>
              <button className="btn ghost" style={{ flex: 1, padding: 10 }} onClick={() => setDaConfermare(null)} disabled={busy}>
                Correggo
              </button>
            </div>
          </div>
        )}

        <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={save} disabled={busy}>
          {busy ? 'Salvo…' : 'Salva le misure'}
        </button>
      </div>
    </div>
  );
}
