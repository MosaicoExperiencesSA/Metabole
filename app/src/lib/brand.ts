/**
 * Colore dell'app ("brand") scelto dall'utente nel profilo.
 * 6 colori fissi + "auto" (un colore nuovo ogni due giorni, come nel prototipo).
 * Il colore guida le variabili CSS --brand / --brand-dark, da cui dipendono
 * --teal (app cliente) e --sf-brand (schermate staff): cambia tutta l'app.
 */

export const BRAND_PALETTE = ['#F2B807', '#E23B3B', '#E86FA6', '#2F80ED', '#12A386', '#F2820A'] as const;
export const BRAND_DEFAULT = '#12A386';
export type Brand = string; // un hex della palette oppure 'auto'

const KEY = 'metabole_brand';

export function getBrand(): Brand {
  try {
    return localStorage.getItem(KEY) || BRAND_DEFAULT;
  } catch {
    return BRAND_DEFAULT;
  }
}

/** Colore "auto": ruota tra i colori della palette, uno nuovo ogni 2 giorni. */
export function autoColor(): string {
  const d = Math.floor(Date.now() / 86_400_000);
  return BRAND_PALETTE[Math.floor(d / 2) % BRAND_PALETTE.length];
}

/** Schiarisce/scurisce un hex di una certa quantità (0..1). */
function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  const r = clamp(((n >> 16) & 255) * (1 - amt));
  const g = clamp(((n >> 8) & 255) * (1 - amt));
  const b = clamp((n & 255) * (1 - amt));
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Applica il colore alle variabili CSS globali (cliente + staff). */
export function applyBrand(brand: Brand = getBrand()): string {
  const color = brand === 'auto' ? autoColor() : brand;
  const root = document.documentElement.style;
  root.setProperty('--brand', color);
  root.setProperty('--brand-dark', shade(color, 0.34));
  return color;
}

/** Salva la scelta e la applica subito. */
export function setBrand(brand: Brand): void {
  try {
    localStorage.setItem(KEY, brand);
  } catch {
    /* storage non disponibile: applichiamo comunque per la sessione */
  }
  applyBrand(brand);
}
