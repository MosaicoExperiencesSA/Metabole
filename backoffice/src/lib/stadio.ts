import type { CSSProperties } from 'react';

/**
 * LO STADIO DELLA PIPELINE, DISEGNATO IN UN POSTO SOLO.
 *
 * Serve a Gestione lead e all'elenco Clienti, che devono somigliarsi: due copie di questi colori
 * tornerebbero a divergere alla prima correzione fatta su una sola delle due.
 *
 * ⚠️ Il colore arriva dal database (`Stage.color`, scelto dal backoffice), quindi non può stare in
 * un foglio di stile: si calcola qui. Prima era solo il **bordo** colorato, 1px sopra il bianco:
 * bello ma quasi invisibile in una tabella di venti righe (segnalato da Simone l'11/8). Ora il
 * colore entra anche nello **sfondo** — appena velato, così il testo resta leggibile — il bordo
 * raddoppia e il testo prende il colore dello stadio: si legge da lontano senza gridare.
 *
 * `color-mix` regge il caso in cui il colore sia un nome CSS, un `#rgb` o un `rgb()`: mescolarlo a
 * mano avrebbe voluto dire riconoscere tre formati e sbagliarne uno. Dove non è supportato resta il
 * bordo colorato di prima, che è esattamente il comportamento di oggi.
 */
export function stileStadio(colore: string | null | undefined): CSSProperties {
  if (!colore) return {};
  return {
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: colore,
    background: `color-mix(in srgb, ${colore} 12%, #fff)`,
    color: `color-mix(in srgb, ${colore} 78%, #1a1a1a)`,
    fontWeight: 700,
  };
}

/** La stessa cosa per una pastiglia di sola lettura (l'elenco Clienti non fa cambiare stadio). */
export function pastigliaStadio(colore: string | null | undefined): CSSProperties {
  return {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 12,
    whiteSpace: 'nowrap',
    ...(colore
      ? stileStadio(colore)
      : { border: '2px solid #d9d6cd', background: '#f4f3ef', color: '#6a7a75', fontWeight: 700 }),
  };
}
