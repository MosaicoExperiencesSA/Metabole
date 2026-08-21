import { useEffect, useRef, useState } from 'react';
import {
  MINUTI_AL_GIORNO,
  PASSO_TRASCINAMENTO,
  angoloInMinuti,
  arcoFinestra,
  arrotondaAlPasso,
  contoAllaRovescia,
  dentroLaGiornata,
  oraAdesso,
  oraDelGiorno,
  puntoSulQuadrante,
} from '../lib/orologio';

/**
 * L'OROLOGIO DEL DIGIUNO — il quadrante che si trascina.
 *
 * ⚠️ **La geometria non è qui**: sta in `lib/orologio.ts`, dove si può provare. Qui c'è solo il
 * disegno e il dito che lo muove. È la stessa divisione del backend fra i moduli puri e i servizi,
 * e per la stessa ragione: un quadrante sbagliato non dà errore, disegna.
 *
 * ## ⛔ Cosa si può trascinare, e cosa no
 *
 * Si sposta **l'apertura**, cioè tutta la finestra insieme. La **durata** non si trascina: la
 * decide il protocollo, che si sceglie dai bottoni. È la Regola d'Oro del manuale — *la durata dice
 * quanti pasti, la posizione non dice niente* — e lasciar tirare l'estremo della finestra
 * inviterebbe a fare l'unica cosa che il modello non permette.
 *
 * ## ⛔ E il conto alla rovescia NON riguarda quello che sta scegliendo
 *
 * Corretto in revisione (21/8). Prima il centro leggeva la finestra **in corso di scelta**: mentre
 * la cliente trascinava verso le 08:00, alle 14:00, il quadrante le diceva «stai digiunando, si
 * apre alle 08:00» — mentre poteva mangiare per altre sei ore, e la push glielo avrebbe confermato.
 * E a chi non aveva mai scelto recitava un conto alla rovescia completo per **una finestra che non
 * esiste in nessun database**.
 *
 * Adesso il conto arriva da `contoDa`, che è la finestra **in vigore**: se manca, al centro non c'è
 * niente. L'arco intanto mostra quello che sta scegliendo, ed è giusto così — quello è il disegno
 * di una proposta, non un'informazione sulla sua giornata.
 */

const LATO = 260;
const C = LATO / 2;
const R_ARCO = 96;
/** ⚠️ Fuori dalla fascia sensibile: toccare un'etichetta non deve spostare la finestra. */
const R_ETICHETTE = R_ARCO + 32;
/** La fascia in cui il tocco conta come «voglio muovere la finestra». */
const BANDA = 22;

export interface PastoSulQuadrante {
  oraMin: number;
  etichetta: string;
}

export interface OrologioProps {
  /** L'apertura della finestra da DISEGNARE: quella che si sta scegliendo. */
  inizioMin: number;
  oreFinestra: number;
  /** I pasti da mostrare sul bordo. ⚠️ Solo se sono quelli di questa finestra. */
  pasti?: PastoSulQuadrante[];
  /** Se manca, l'orologio è di sola lettura: nessuna maniglia, nessun trascinamento. */
  onCambia?: (inizioMin: number) => void;
  /** Il bersaglio del piano graduale: si disegna come un segno, non come la finestra vera. */
  bersaglioMin?: number | null;
  /**
   * ⛔ La finestra **in vigore**, da cui esce il conto alla rovescia al centro. Se manca, il centro
   * resta vuoto: non si racconta una giornata che nessuno ha impostato.
   */
  contoDa?: { inizioMin: number; oreFinestra: number } | null;
  /** In miniatura si spengono i testi: a 4 pixel non si leggono, e fanno solo sporco. */
  compatto?: boolean;
}

export default function OrologioDigiuno({
  inizioMin,
  oreFinestra,
  pasti = [],
  onCambia,
  bersaglioMin,
  contoDa,
  compatto = false,
}: OrologioProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [trascina, setTrascina] = useState(false);
  const [adesso, setAdesso] = useState(oraAdesso());

  /**
   * ⚠️ La lancetta di «adesso» si aggiorna ogni trenta secondi. Non ogni secondo: un orologio che
   * scatta di continuo su una cosa che dura sedici ore è una clessidra che fa venire fame.
   */
  useEffect(() => {
    const t = setInterval(() => setAdesso(oraAdesso()), 30_000);
    return () => clearInterval(t);
  }, []);

  const modificabile = typeof onCambia === 'function';

  /**
   * Da dove ha toccato → che ora è lì. ⚠️ In coordinate dell'SVG, non della pagina.
   *
   * ⛔ **Solo dentro la fascia dell'anello** (corretto in revisione, 21/8): prima rispondeva a tutto
   * l'SVG, quindi toccare la scritta «si chiude alle 20:00» al centro, o il numero 12 sul bordo,
   * spostava la finestra della cliente. Un comando che si aziona leggendo non è un comando.
   */
  function oraDalTocco(clientX: number, clientY: number): number | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    // ⚠️ Il riquadro sullo schermo e il `viewBox` non hanno la stessa scala: senza questo rapporto
    // il quadrante risponderebbe giusto solo alla dimensione in cui l'ho disegnato.
    const x = ((clientX - r.left) / r.width) * LATO - C;
    const y = ((clientY - r.top) / r.height) * LATO - C;
    const distanza = Math.hypot(x, y);
    if (Math.abs(distanza - R_ARCO) > BANDA) return null;
    const gradi = (Math.atan2(y, x) * 180) / Math.PI + 90;
    return arrotondaAlPasso(angoloInMinuti(gradi));
  }

  function muovi(clientX: number, clientY: number): boolean {
    if (!modificabile) return false;
    const ora = oraDalTocco(clientX, clientY);
    if (ora === null) return false;
    if (ora !== inizioMin) onCambia!(ora);
    return true;
  }

  /** ⚠️ Con la tastiera si sposta di un passo per volta: è l'unico modo senza un dito preciso. */
  function daTastiera(e: React.KeyboardEvent): void {
    if (!modificabile) return;
    const passo = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -PASSO_TRASCINAMENTO
      : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? PASSO_TRASCINAMENTO
        : e.key === 'PageUp' ? 60
          : e.key === 'PageDown' ? -60
            : 0;
    if (!passo) return;
    e.preventDefault();
    onCambia!(dentroLaGiornata(inizioMin + passo));
  }

  const chiusuraMin = dentroLaGiornata(inizioMin + oreFinestra * 60);
  const conto = contoDa ? contoAllaRovescia(adesso, contoDa.inizioMin, contoDa.oreFinestra) : null;
  const maniglia = puntoSulQuadrante(inizioMin, R_ARCO, C, C);
  const lancetta = puntoSulQuadrante(adesso, R_ARCO - 18, C, C);

  /**
   * ⚠️ Quello che sente chi non vede lo schermo. ⛔ Prima era `role="img"`: il lettore di schermo
   * collassava tutto il sottoalbero, quindi stato e conto alla rovescia sparivano, e la finestra
   * non era **impostabile** in nessun modo senza un dito preciso.
   */
  const descrizione = [
    `Finestra dalle ${oraDelGiorno(inizioMin)} alle ${oraDelGiorno(chiusuraMin)}`,
    conto ? `${conto.titolo}, ${conto.manca}, ${conto.sotto}` : null,
  ].filter(Boolean).join('. ');

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${LATO} ${LATO}`}
      style={{ width: '100%', maxWidth: compatto ? 120 : 300, touchAction: 'none', display: 'block', margin: '0 auto' }}
      role={modificabile ? 'slider' : 'img'}
      tabIndex={modificabile ? 0 : undefined}
      aria-label={modificabile ? 'Ora di apertura della finestra' : descrizione}
      aria-valuemin={modificabile ? 0 : undefined}
      aria-valuemax={modificabile ? MINUTI_AL_GIORNO - 1 : undefined}
      aria-valuenow={modificabile ? inizioMin : undefined}
      aria-valuetext={modificabile ? descrizione : undefined}
      onKeyDown={daTastiera}
      onPointerDown={(e) => {
        if (!modificabile) return;
        // ⚠️ Si comincia a trascinare **solo** se il tocco è sull'anello: altrimenti l'evento
        // scorre via e la pagina si comporta come sempre.
        if (!muovi(e.clientX, e.clientY)) return;
        // ⚠️ La cattura sta sull'SVG e non sul bersaglio del tocco: un pallino o un tratteggio
        // possono sparire mentre lei trascina, e con loro se ne andrebbe la cattura.
        svgRef.current?.setPointerCapture?.(e.pointerId);
        setTrascina(true);
      }}
      onPointerMove={(e) => { if (trascina) muovi(e.clientX, e.clientY); }}
      onPointerUp={() => setTrascina(false)}
      onPointerCancel={() => setTrascina(false)}
    >
      {/* Il cerchio delle ventiquattro ore. */}
      <circle cx={C} cy={C} r={R_ARCO} fill="none" stroke="#E8EDEB" strokeWidth={16} />

      {/* ⚠️ I quattro riferimenti: senza, un quadrante da 24 ore si legge come uno da 12. */}
      {!compatto && [0, 6, 12, 18].map((ora) => {
        const p = puntoSulQuadrante(ora * 60, R_ETICHETTE, C, C);
        return (
          <text key={ora} x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fill="#8A9A94">
            {String(ora).padStart(2, '0')}
          </text>
        );
      })}

      {/* La finestra in cui si mangia. */}
      <path d={arcoFinestra(inizioMin, oreFinestra, R_ARCO, C, C)} fill="none" stroke="var(--teal, #17A398)" strokeWidth={16} strokeLinecap="round" />

      {/**
        * ⚠️ Il bersaglio del piano graduale è un **segno**, non un secondo arco: la finestra vera è
        * una sola, ed è quella di oggi. Disegnarne due farebbe credere che ne abbia due.
        */}
      {typeof bersaglioMin === 'number' && bersaglioMin !== inizioMin && (() => {
        const a = puntoSulQuadrante(bersaglioMin, R_ARCO - 12, C, C);
        const b = puntoSulQuadrante(bersaglioMin, R_ARCO + 12, C, C);
        return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--teal, #17A398)" strokeWidth={2} strokeDasharray="3 3" />;
      })()}

      {/* I pasti, dove cadono. */}
      {pasti.map((p) => {
        const punto = puntoSulQuadrante(p.oraMin, R_ARCO, C, C);
        return <circle key={`${p.oraMin}-${p.etichetta}`} cx={punto.x} cy={punto.y} r={5} fill="#fff" stroke="var(--teal, #17A398)" strokeWidth={2} />;
      })}

      {/* Dov'è adesso. */}
      <line x1={C} y1={C} x2={lancetta.x} y2={lancetta.y} stroke="#4A5A55" strokeWidth={2} strokeLinecap="round" />
      <circle cx={C} cy={C} r={3} fill="#4A5A55" />

      {/* La maniglia: c'è solo se si può muovere. */}
      {modificabile && (
        <circle cx={maniglia.x} cy={maniglia.y} r={trascina ? 15 : 12} fill="#fff" stroke="var(--teal, #17A398)" strokeWidth={3} />
      )}

      {/* Il conto alla rovescia, al centro — solo se c'è una finestra VERA da raccontare. */}
      {conto && !compatto && (
        <>
          <text x={C} y={C - 12} textAnchor="middle" fontSize={12} fill="#8A9A94">{conto.titolo}</text>
          <text x={C} y={C + 14} textAnchor="middle" fontSize={24} fontWeight={700} fill="#2E3B37">{conto.manca}</text>
          <text x={C} y={C + 32} textAnchor="middle" fontSize={11} fill="#8A9A94">{conto.sotto}</text>
        </>
      )}
    </svg>
  );
}
