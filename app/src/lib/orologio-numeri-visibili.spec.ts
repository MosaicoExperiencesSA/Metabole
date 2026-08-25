import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CENTRO,
  MARGINE_QUADRANTE,
  RAGGIO_ANELLO,
  RAGGIO_ETICHETTE,
  VISTA_QUADRANTE,
  daSchermoAQuadrante,
  puntoSulQuadrante,
} from './orologio';

/**
 * ⛔ **«NON SI VEDONO I NUMERI DELL'OROLOGIO»** — la capo nutrizionista, 23/8 alle 08:05, con la
 * schermata: il **00** in cima tagliato a metà, il **12** in basso idem, il 6 e il 18 ai lati usciti
 * per metà larghezza. Si leggeva «8» e «0(».
 *
 * ⚠️ Non era estetica: i numeri sono l'unica cosa che dice **a che ora** corrisponde il punto del
 * cerchio dove sta la lancetta. Senza, il disegno dice «quanto manca» ma non «quando».
 *
 * ⚠️ **Perché nessun test lo vedeva**: i test dell'app girano senza DOM, e queste misure stavano
 * dentro il componente — un numero che nessuno esegue. Adesso stanno in `lib/orologio.ts` e questo
 * file le guarda come le guarderebbe un occhio: **il glifo ci sta dentro il riquadro?**
 */

/**
 * L'ingombro di un'etichetta, in unità del `viewBox`. Sono le misure vere del disegno
 * (`fontSize={11}`, due cifre, `textAnchor="middle"`, baseline spostata di `+4`), non stime di
 * comodo: un glifo da 11 sta in circa 8 sopra la baseline e 3 sotto, e due cifre sono larghe ~12.
 */
const SOPRA = 8;
const SOTTO = 3;
const META_LARGHEZZA = 6;
const SPOSTAMENTO_BASELINE = 4;

/** Gli estremi del riquadro: da `-MARGINE` a `-MARGINE + VISTA`. */
const MIN = -MARGINE_QUADRANTE;
const MAX = -MARGINE_QUADRANTE + VISTA_QUADRANTE;

describe('i numeri delle ore stanno dentro il riquadro', () => {
  it.each([0, 6, 12, 18])('l\'etichetta delle %s non è tagliata', (ora) => {
    const p = puntoSulQuadrante(ora * 60, RAGGIO_ETICHETTE, CENTRO, CENTRO);
    const y = p.y + SPOSTAMENTO_BASELINE;
    expect(y - SOPRA).toBeGreaterThanOrEqual(MIN);
    expect(y + SOTTO).toBeLessThanOrEqual(MAX);
    expect(p.x - META_LARGHEZZA).toBeGreaterThanOrEqual(MIN);
    expect(p.x + META_LARGHEZZA).toBeLessThanOrEqual(MAX);
  });

  /**
   * ⚠️ **E il riquadro vecchio non passerebbe**, che è la prova che questo test guarda la cosa
   * giusta: con `viewBox="0 0 260 260"` il **00** cadeva a y = 6 e il suo glifo cominciava a −2.
   */
  it('⛔ col riquadro di prima (senza margine) il «00» era tagliato davvero', () => {
    const p = puntoSulQuadrante(0, RAGGIO_ETICHETTE, CENTRO, CENTRO);
    expect(p.y + SPOSTAMENTO_BASELINE - SOPRA).toBeLessThan(0);
  });

  /**
   * ⚠️ **Le etichette restano FUORI dall'anello**: la correzione poteva anche essere «tirale più
   * dentro», e sarebbe stata peggio — appoggiate al cerchio si leggono contro il tratto spesso 16.
   */
  it('⚠️ e non finiscono addosso all\'anello', () => {
    const bordoEsterno = RAGGIO_ANELLO + 8; // metà dello spessore del tratto
    expect(RAGGIO_ETICHETTE - META_LARGHEZZA).toBeGreaterThan(bordoEsterno);
  });
});

/**
 * ⚠️ **E il disegno deve USARLO davvero, quel margine.** Le misure qui sopra sono giuste anche se il
 * componente continua a scrivere `viewBox="0 0 …"`: il taglio tornerebbe identico e nessun test lo
 * direbbe, perché i test dell'app non disegnano. Quindi si legge il sorgente — è brutto, ed è meno
 * brutto di un difetto che è già arrivato una volta a una persona vera.
 */
describe('il componente disegna il riquadro con il margine', () => {
  it('⛔ il `viewBox` parte da −MARGINE, non da zero', () => {
    const sorgente = readFileSync(join(__dirname, '..', 'components', 'OrologioDigiuno.tsx'), 'utf8');
    const riga = sorgente.split('\n').find((r) => r.includes('viewBox='));
    expect(riga).toBeDefined();
    expect(riga).toContain('${-MARGINE}');
    expect(riga).toContain('${VISTA}');
  });
});

/**
 * ⛔ **IL MARGINE ENTRA ANCHE NEL DITO.** Il quadrante si trascina, e la conversione da coordinate
 * dello schermo a coordinate del disegno deve partire dal riquadro vero (`-MARGINE`), non da zero:
 * sbagliarla sposta il dito di quattordici unità su un anello spesso sedici — cioè un comando che
 * risponde storto, o che non risponde.
 */
describe('il dito cade dove lo si vede', () => {
  /**
   * ⚠️ **Si prova la funzione VERA, non una sua copia scritta qui** — rilievo della revisione del
   * 25/8: la prima stesura riscriveva la formula nel test, quindi riportando il componente alla
   * conversione vecchia i nove test restavano verdi. Un test che ricopia quello che dovrebbe
   * sorvegliare sorveglia se stesso.
   */
  it('il centro del riquadro è il centro del quadrante', () => {
    expect(daSchermoAQuadrante(0.5)).toBeCloseTo(0, 6);
  });

  it('⛔ e il bordo alto del riquadro è il bordo alto del disegno, non zero', () => {
    expect(daSchermoAQuadrante(0)).toBe(MIN - CENTRO);
    // Con la formula vecchia (`frazione * LATO - CENTRO`) il bordo avrebbe detto −130: quattordici
    // unità di scarto, tutte a carico di chi trascina.
    expect(daSchermoAQuadrante(0)).not.toBe(-CENTRO);
  });

  /** Il punto dell'anello a ore 12 (in basso) deve cadere sull'anello, non fuori. */
  it('⚠️ e un tocco sul bordo basso dell\'anello finisce sull\'anello', () => {
    const frazione = (CENTRO + RAGGIO_ANELLO + MARGINE_QUADRANTE) / VISTA_QUADRANTE;
    expect(daSchermoAQuadrante(frazione)).toBeCloseTo(RAGGIO_ANELLO, 6);
  });

  it('⛔ il componente usa QUESTA funzione, non una formula sua', () => {
    const sorgente = readFileSync(join(__dirname, '..', 'components', 'OrologioDigiuno.tsx'), 'utf8');
    expect(sorgente).toContain('daSchermoAQuadrante((clientX - r.left) / r.width)');
    expect(sorgente).toContain('daSchermoAQuadrante((clientY - r.top) / r.height)');
  });
});
