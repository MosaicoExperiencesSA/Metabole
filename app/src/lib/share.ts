import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

/**
 * Condivisione con il foglio NATIVO del telefono (WhatsApp, Messaggi, Mail…).
 *
 * Tre strade, in ordine di preferenza:
 *  1. app nativa → `Share` di Capacitor, il foglio di sistema vero;
 *  2. browser che supporta `navigator.share` (Safari iOS, Chrome Android) → stesso foglio;
 *  3. tutto il resto (desktop) → si copia negli appunti, che è l'unica cosa sensata.
 *
 * Non lancia mai: condividere è un gesto accessorio e un errore qui non deve rompere la
 * schermata. Ritorna cosa è successo, così la UI può dire la verità alla cliente.
 */
export type EsitoCondivisione = 'condiviso' | 'copiato' | 'annullato' | 'fallito';

export async function condividi(input: {
  testo: string;
  url?: string;
  titolo?: string;
}): Promise<EsitoCondivisione> {
  const { testo, url, titolo } = input;

  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({ title: titolo, text: testo, url, dialogTitle: titolo });
      return 'condiviso';
    } catch (e) {
      // L'utente che chiude il foglio genera un errore: non è un guasto.
      const msg = e instanceof Error ? e.message.toLowerCase() : '';
      if (msg.includes('cancel') || msg.includes('abort')) return 'annullato';
      // Se il foglio nativo non parte, si prova comunque a copiare.
      return (await copiaNegliAppunti(daCopiare(testo, url))) ? 'copiato' : 'fallito';
    }
  }

  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title: titolo, text: testo, url });
      return 'condiviso';
    } catch (e) {
      const msg = e instanceof Error ? e.name.toLowerCase() : '';
      if (msg.includes('abort')) return 'annullato';
    }
  }

  return (await copiaNegliAppunti(daCopiare(testo, url))) ? 'copiato' : 'fallito';
}

function daCopiare(testo: string, url?: string): string {
  return url ? `${testo} ${url}` : testo;
}

/** Appunti, con ripiego per i browser che non espongono l'API asincrona. */
export async function copiaNegliAppunti(testo: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(testo);
      return true;
    }
  } catch {
    /* si prova il ripiego */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = testo;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
