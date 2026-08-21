import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import OrologioDigiuno from '../components/OrologioDigiuno';
import { contoAllaRovescia, oraAdesso } from '../lib/orologio';

/**
 * L'OROLOGIO IN HOME — e la porta che ci porta chi non ha ancora scelto.
 *
 * Fa due cose, e sono due facce della stessa:
 *
 * 1. **A chi non ha mai scelto**, apre la pagina dell'orologio al primo avvio dell'app. È la
 *    decisione di Simone del 19/8 («quando pubblichiamo la app aggiornata le facciamo atterrare su
 *    quella pagina»).
 * 2. **A tutte le altre**, mostra dove sono adesso: quanto manca all'apertura o alla chiusura.
 *
 * ## ⛔ Una volta per avvio, non a ogni ritorno in home
 *
 * L'atterraggio si ricorda in `sessionStorage`: se lei tocca «lo faccio dopo» e torna in home, non
 * ci si ritrova dentro di nuovo. ⚠️ Senza questo, «lo faccio dopo» sarebbe un bottone che non fa
 * niente — e un avviso da cui non si esce è il modo più rapido per insegnare a chiudere gli avvisi
 * senza leggerli.
 *
 * ⚠️ **`sessionStorage` e non `localStorage`**: la domanda deve tornare al prossimo avvio, non
 * sparire per sempre. Rimandare non è rispondere.
 *
 * ## ⚠️ E se il server non risponde, questa scheda non c'è
 *
 * Niente scheletro, niente «caricamento…», niente riquadro vuoto: la home di chi non digiuna non
 * deve avere un buco al posto di una cosa che non la riguarda.
 */

const CHIAVE_ATTERRAGGIO = 'metabole_digiuno_chiesto';

interface Vista {
  digiuna: boolean;
  daChiedere: boolean;
  attuale?: {
    protocollo: string;
    inizioMin: number;
    apertura: string;
    chiusura: string;
    oreFinestra: number;
    pasti: { slot: string; oraMin: number; ora: string; etichetta: string }[];
  };
  piano?: { bersaglio: string; giorniMancanti: number };
}

export interface CardDigiunoProps {
  /**
   * ⛔ **Se in questo momento si può portare via la home.** Lo decide chi la conosce — `Home` —
   * perché il check-in è un modale **dentro** la home: portarla su un'altra pagina mentre lei sta
   * compilando lo smonterebbe con dentro quello che ha già scritto. Una interruzione per volta.
   */
  atterraggioPermesso?: boolean;
}

export default function CardDigiuno({ atterraggioPermesso = true }: CardDigiunoProps) {
  const navigate = useNavigate();
  const [vista, setVista] = useState<Vista | null>(null);
  /**
   * ⚠️ Il conto alla rovescia qui è **testo HTML**, quindi non si aggiorna da solo come dentro il
   * quadrante: senza questo battito resterebbe fermo all'istante in cui la home è stata disegnata,
   * e chi lascia l'app aperta leggerebbe «2h 15m» per mezz'ora.
   */
  const [adesso, setAdesso] = useState(oraAdesso());
  useEffect(() => {
    const t = setInterval(() => setAdesso(oraAdesso()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let vivo = true;
    api<Vista>('/me/digiuno')
      .then((v) => { if (vivo) setVista(v); })
      .catch(() => { /* ⚠️ In silenzio: chi non digiuna non deve vedere un errore su una cosa sua. */ });
    return () => { vivo = false; };
  }, []);

  /**
   * ⚠️ L'atterraggio è un effetto **a parte**, e aspetta il permesso: la risposta del server può
   * arrivare prima o dopo quella del check-in, e da lì nasceva una corsa che vinceva a caso.
   */
  useEffect(() => {
    if (!vista?.daChiedere || !atterraggioPermesso) return;
    if (sessionStorage.getItem(CHIAVE_ATTERRAGGIO)) return;
    sessionStorage.setItem(CHIAVE_ATTERRAGGIO, '1');
    navigate('/digiuno');
  }, [vista, atterraggioPermesso, navigate]);

  if (!vista?.digiuna) return null;

  // ⛔ Non ha ancora scelto: si invita, non si finge un orologio che nessuno ha impostato.
  if (!vista.attuale) {
    return (
      <div
        className="card"
        onClick={() => navigate('/digiuno')}
        style={{ padding: 14, marginBottom: 10, cursor: 'pointer' }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Scegli la tua finestra</div>
        <div className="muted" style={{ fontSize: 12 }}>
          Decidi tu a che ora mangi: bastano trenta secondi, e da lì i tuoi pasti seguono i tuoi orari.
        </div>
      </div>
    );
  }

  /** ⚠️ Lo stesso conto che disegna il quadrante: una regola sola, letta da due posti. */
  const conto = contoAllaRovescia(adesso, vista.attuale.inizioMin, vista.attuale.oreFinestra);

  return (
    <div
      className="card"
      onClick={() => navigate('/digiuno')}
      style={{ padding: 14, marginBottom: 10, cursor: 'pointer' }}
    >
      <div className="row-between" style={{ alignItems: 'center', gap: 12 }}>
        <div style={{ flex: '0 0 96px' }}>
          {/**
            * ⚠️ Sola lettura e **in miniatura**: in home non si trascina niente, e i testi del
            * quadrante si spengono. ⛔ A 96 pixel il conto alla rovescia disegnato dentro l'SVG
            * sarebbe alto **quattro pixel** — illeggibile, e proprio la cosa che questa scheda
            * esiste per dire. Sta scritto qui accanto, in HTML, alla dimensione del resto.
            */}
          <OrologioDigiuno
            compatto
            inizioMin={vista.attuale.inizioMin}
            oreFinestra={vista.attuale.oreFinestra}
            pasti={vista.attuale.pasti.map((p) => ({ oraMin: p.oraMin, etichetta: p.etichetta }))}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#8A9A94' }}>{conto.titolo}</div>
          <div style={{ fontWeight: 700, fontSize: 20, lineHeight: 1.1 }}>{conto.manca}</div>
          <div className="muted" style={{ fontSize: 12 }}>{conto.sotto}</div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            {vista.attuale.protocollo} · {vista.attuale.apertura}–{vista.attuale.chiusura} ·{' '}
            {vista.attuale.pasti.length} {vista.attuale.pasti.length === 1 ? 'pasto' : 'pasti'}
          </div>
          {/* ⚠️ Zero giorni vuol dire «non ci si arriva»: non si scrive «fra 0 giorni». */}
          {vista.piano && vista.piano.giorniMancanti > 0 && (
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Fra {vista.piano.giorniMancanti}{' '}
              {vista.piano.giorniMancanti === 1 ? 'giorno' : 'giorni'} apri alle {vista.piano.bersaglio}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
