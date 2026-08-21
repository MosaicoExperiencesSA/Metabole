/**
 * L'OROLOGIO DEL DIGIUNO — la geometria e il conto alla rovescia, senza React.
 *
 * Sta in `lib/` e non dentro il componente per la ragione di sempre in questa cartella: qui si può
 * **provare**. Un quadrante è tutto trigonometria e minuti che scavalcano la mezzanotte, cioè
 * esattamente il tipo di codice che sbaglia in silenzio — la lancetta finisce due gradi più in là e
 * nessuno se ne accorge finché una cliente non dice «ma io mangio alle 12, non alle 12 e mezza».
 *
 * ## ⚠️ Le due convenzioni, dichiarate una volta sola
 *
 * 1. **Il quadrante è di 24 ore, non di 12.** Una finestra di otto ore su un quadrante da dodici
 *    sarebbe disegnata larga il doppio, e la mezzanotte cadrebbe due volte.
 * 2. **La mezzanotte sta in alto** e si gira in senso orario: mezzogiorno in basso, le 06:00 a
 *    destra, le 18:00 a sinistra. È come si legge un orologio, ed è l'unico modo perché «la mia
 *    finestra è di sera» corrisponda a quello che si vede.
 *
 * ⚠️ In SVG l'angolo zero è a **destra** e cresce in senso orario: la conversione toglie 90° una
 * volta sola, qui dentro, invece di lasciare che ogni chiamante se lo ricordi.
 */

export const MINUTI_AL_GIORNO = 24 * 60;

/** Riporta un valore dentro le 24 ore, anche se negativo. */
export const dentroLaGiornata = (min: number): number =>
  ((Math.round(min) % MINUTI_AL_GIORNO) + MINUTI_AL_GIORNO) % MINUTI_AL_GIORNO;

/** L'angolo in gradi di un orario sul quadrante: 0 = mezzanotte, in alto, in senso orario. */
export const minutiInAngolo = (min: number): number => (dentroLaGiornata(min) / MINUTI_AL_GIORNO) * 360;

/** L'orario corrispondente a un angolo. L'inverso esatto di `minutiInAngolo`. */
export const angoloInMinuti = (gradi: number): number =>
  dentroLaGiornata((((gradi % 360) + 360) % 360) / 360 * MINUTI_AL_GIORNO);

export interface Punto { x: number; y: number }

/** Il punto sul quadrante a quell'ora. `cx`/`cy` è il centro, `raggio` la distanza. */
export function puntoSulQuadrante(min: number, raggio: number, cx: number, cy: number): Punto {
  // ⚠️ −90° perché in SVG l'angolo zero guarda a destra e noi vogliamo la mezzanotte in alto.
  const rad = ((minutiInAngolo(min) - 90) * Math.PI) / 180;
  return { x: cx + raggio * Math.cos(rad), y: cy + raggio * Math.sin(rad) };
}

/**
 * L'arco della finestra, come `d` di un `<path>` SVG.
 *
 * ⚠️ Il flag `large-arc` di SVG è la trappola: va acceso quando l'arco supera i 180°, cioè **più di
 * dodici ore** su questo quadrante. Con la 14:10 (dieci ore) è spento, con una finestra lunga
 * sarebbe acceso — e sbagliarlo non dà errore: disegna l'arco **complementare**, cioè mostra alla
 * cliente esattamente le ore in cui NON può mangiare.
 */
export function arcoFinestra(
  inizioMin: number,
  oreFinestra: number,
  raggio: number,
  cx: number,
  cy: number,
): string {
  const durata = Math.max(0, Math.min(24, oreFinestra)) * 60;
  const a = puntoSulQuadrante(inizioMin, raggio, cx, cy);
  const b = puntoSulQuadrante(inizioMin + durata, raggio, cx, cy);
  const grande = durata > MINUTI_AL_GIORNO / 2 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${raggio} ${raggio} 0 ${grande} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/** `08:15` da minuti. */
export function oraDelGiorno(min: number): string {
  const m = dentroLaGiornata(min);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * ⛔ **CHE ORA È ADESSO — A ROMA, non sul telefono** (corretto in revisione, 21/8).
 *
 * Qui c'era `d.getHours()`, cioè l'ora del dispositivo. Il server invece ragiona sempre nel fuso
 * dell'azienda (`common/date-only.ts`, `oraLocaleInMinuti`), e da lì escono gli orari dei pasti,
 * l'apertura, la chiusura e il momento delle push.
 *
 * ⚠️ Quando i due fusi divergono — una cliente in viaggio, o un telefono col fuso sbagliato — l'app
 * e la notifica si contraddicono: le arriva «hai finito di mangiare» mentre lo schermo dice «puoi
 * mangiare ancora per sei ore». Non è un dettaglio da viaggiatori: è il prodotto che dà due
 * risposte diverse alla stessa domanda nello stesso istante.
 *
 * ⚠️ Se il fuso non è riconosciuto si ripiega sull'ora del dispositivo: è meglio di niente, ed è
 * l'unica cosa che resta. `Intl` c'è su ogni webview che l'app supporta.
 */
export const FUSO_AZIENDA = 'Europe/Rome';

export function oraAdesso(d: Date = new Date()): number {
  try {
    const parti = new Intl.DateTimeFormat('en-GB', {
      timeZone: FUSO_AZIENDA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(d);
    const ore = Number(parti.find((x) => x.type === 'hour')?.value ?? NaN);
    const minuti = Number(parti.find((x) => x.type === 'minute')?.value ?? NaN);
    if (!Number.isInteger(ore) || !Number.isInteger(minuti)) throw new Error('parti mancanti');
    return ore * 60 + minuti;
  } catch {
    return d.getHours() * 60 + d.getMinutes();
  }
}

export type StatoOrologio = 'finestra' | 'digiuno';

export interface ContoAllaRovescia {
  stato: StatoOrologio;
  /** Minuti che mancano al prossimo cambio di stato. */
  mancaMin: number;
  /** «2h 15m», «46m». Per una persona, non per un cronometro. */
  manca: string;
  /** La riga sopra il numero: cosa sta succedendo adesso. */
  titolo: string;
  /** La riga sotto: cosa succede quando il numero arriva a zero. */
  sotto: string;
}

/**
 * DOVE SIAMO ADESSO E QUANTO MANCA.
 *
 * ⚠️ **Il minuto dell'apertura è già finestra, quello della chiusura è già digiuno.** Detto così
 * sembra un dettaglio; è la differenza fra «puoi mangiare» e «hai finito» nel minuto in cui lei
 * guarda lo schermo, ed è la stessa convenzione che usano le push nel backend.
 */
export function contoAllaRovescia(
  oraMin: number,
  aperturaMin: number,
  oreFinestra: number,
): ContoAllaRovescia {
  const durata = Math.max(0, Math.min(24, oreFinestra)) * 60;
  const dallApertura = dentroLaGiornata(oraMin - aperturaMin);
  const dentro = dallApertura < durata;
  const mancaMin = dentro ? durata - dallApertura : MINUTI_AL_GIORNO - dallApertura;
  const chiusura = dentroLaGiornata(aperturaMin + durata);
  return {
    stato: dentro ? 'finestra' : 'digiuno',
    mancaMin,
    manca: quantoManca(mancaMin),
    titolo: dentro ? 'Puoi mangiare' : 'Stai digiunando',
    sotto: dentro
      ? `si chiude alle ${oraDelGiorno(chiusura)}`
      : `si apre alle ${oraDelGiorno(aperturaMin)}`,
  };
}

/**
 * «2h 15m», «46m», «meno di un minuto».
 *
 * ⚠️ Niente secondi: un conto alla rovescia al secondo su una cosa che dura sedici ore è una
 * clessidra che fa venire fame. E niente «0h 46m»: le ore si scrivono solo se ci sono.
 */
export function quantoManca(minuti: number): string {
  const m = Math.max(0, Math.round(minuti));
  if (m < 1) return 'meno di un minuto';
  const ore = Math.floor(m / 60);
  const resto = m % 60;
  if (!ore) return `${resto}m`;
  if (!resto) return `${ore}h`;
  return `${ore}h ${resto}m`;
}

/**
 * L'orario più vicino a passi di cinque minuti.
 *
 * ⚠️ Serve a **trascinare la lancetta**: al minuto, un dito su un telefono darebbe orari come 12:37
 * — che nessuno sceglierebbe scrivendoli, e che poi la cliente si ritrova nel piatto per settimane.
 * Il passo è dichiarato qui e non sparso nel componente.
 */
export const PASSO_TRASCINAMENTO = 5;

export const arrotondaAlPasso = (min: number, passo: number = PASSO_TRASCINAMENTO): number =>
  dentroLaGiornata(Math.round(dentroLaGiornata(min) / passo) * passo);
