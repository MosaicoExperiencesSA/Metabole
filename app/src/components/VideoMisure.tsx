import { useState } from 'react';
import { track } from '../lib/track';

/**
 * «COME SI PRENDONO LE MISURE» — il video, in un posto solo.
 *
 * Stava dentro `MeasuresGate.tsx`, ed è rimasto lì finché lo chiedeva una schermata sola. Dal 21/8
 * lo chiede anche il riquadro «Misure di oggi» della pagina Obiettivo (richiesta di Simone), e due
 * copie dello stesso blocco sono due copie che divergono: il giorno che si rifà il video, o si
 * cambia il testo, una delle due resta indietro — e nessuno se ne accorge, perché tutte e due
 * continuano a funzionare.
 *
 * ⚠️ **Il file è uno**: `/video/misure.mp4`, con la sua anteprima. Se un giorno si sposta su un
 * altro host, si cambia qui e basta.
 *
 * ## Le due forme, e perché sono due
 *
 * - `forma="riga"` — l'anteprima con titolo e durata, che occupa una riga intera. Sta dove il
 *   dubbio nasce: appena sopra le caselle di vita e fianchi, due centimetri prima della domanda.
 * - `forma="punto"` — il solo punto interrogativo accanto a un titolo. Sta dove il video è un
 *   ripensamento e non il punto della schermata: chi sa già misurarsi non deve vedersi occupare
 *   spazio da una cosa che ha già visto.
 *
 * ⚠️ Il video **non parte da solo alla prima**: si apre solo dopo il tocco. Un video che parte in
 * automatico in una pagina di misure è rumore addosso a chi voleva solo scrivere un numero.
 */

export interface VideoMisureProps {
  forma?: 'riga' | 'punto';
  /** Da dove è stato aperto: finisce nella traccia, così si vede quale dei due posti serve. */
  origine: string;
}

const SORGENTE = '/video/misure.mp4';
const ANTEPRIMA = '/video/misure-poster.jpg';

export default function VideoMisure({ forma = 'riga', origine }: VideoMisureProps) {
  const [aperto, setAperto] = useState(false);

  if (aperto) {
    return (
      <div style={{ marginTop: 10, marginBottom: 8 }}>
        <video
          src={SORGENTE}
          poster={ANTEPRIMA}
          controls
          autoPlay
          playsInline
          preload="auto"
          style={{ width: '100%', borderRadius: 12, display: 'block', background: '#000' }}
        />
        {/* ⚠️ Si può richiudere: chi l'ha guardato vuole tornare alle caselle, non scorrere oltre. */}
        <button
          type="button"
          className="btn ghost"
          onClick={() => setAperto(false)}
          style={{ width: '100%', marginTop: 6, fontSize: 12 }}
        >
          Chiudi il video
        </button>
      </div>
    );
  }

  const apri = () => { setAperto(true); track('measures_video_open', { origine }); };

  if (forma === 'punto') {
    return (
      <button
        type="button"
        onClick={apri}
        aria-label="Come si prendono le misure: guarda il video"
        title="Come si prendono le misure"
        style={{
          background: 'none', border: 0, padding: 4, margin: 0, cursor: 'pointer',
          color: 'var(--teal, #17A398)', lineHeight: 0, flex: 'none',
        }}
      >
        {/* ⚠️ 24 pixel di icona dentro 32 di bersaglio: un punto interrogativo da 16 su un telefono
            è un bersaglio che si manca, e chi lo manca due volte non riprova. */}
        <i className="ti ti-help-circle" style={{ fontSize: 24 }} />
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10, marginBottom: 8 }}>
      <button
        type="button"
        className="btn ghost"
        onClick={apri}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 8, textAlign: 'left' }}
      >
        <img src={ANTEPRIMA} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flex: 'none' }} />
        <span style={{ flex: 1, lineHeight: 1.25 }}>
          <b style={{ fontSize: 13 }}>Come si prendono le misure</b>
          <span className="muted" style={{ display: 'block', fontSize: 11 }}>Video di 36 secondi</span>
        </span>
        <i className="ti ti-player-play" style={{ flex: 'none' }} />
      </button>
    </div>
  );
}
