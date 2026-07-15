// Utilità di formattazione condivise dalle schermate staff (coach + nutrizionista).

/** Centesimi interi → stringa in euro (es. 128000 → "€ 1.280"). */
export function euro(cents: number | null | undefined, withCents = false): string {
  const v = (cents ?? 0) / 100;
  return (
    '€ ' +
    v.toLocaleString('it-IT', {
      minimumFractionDigits: withCents ? 2 : 0,
      maximumFractionDigits: withCents ? 2 : 0,
    })
  );
}

/** ISO date/datetime → "12 lug" (giorno + mese abbreviato). */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/** ISO datetime → "12 lug · 16:00". */
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return (
    d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  );
}

/** ISO datetime → solo ora "16:00". */
export function hourOnly(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

/** Distanza in giorni da oggi (positiva = futuro). null se data assente. */
export function daysFromNow(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.round(ms / 86400000);
}

/** Etichetta relativa breve: "oggi", "tra 3 gg", "5 gg fa". */
export function relDays(iso: string | null | undefined): string {
  const n = daysFromNow(iso);
  if (n === null) return '—';
  if (n === 0) return 'oggi';
  if (n === 1) return 'domani';
  if (n === -1) return 'ieri';
  if (n > 1) return `tra ${n} gg`;
  return `${-n} gg fa`;
}

/** Iniziali da un nome completo ("Giulia Rossi" → "GR"). */
export function initials(name: string | null | undefined): string {
  if (!name) return '·';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Nome completo da first/last, con fallback all'email. */
export function fullName(
  first?: string | null,
  last?: string | null,
  email?: string | null,
): string {
  const n = [first, last].filter(Boolean).join(' ').trim();
  return n || email || 'Senza nome';
}

/** Link WhatsApp da un numero di telefono (rimuove tutto tranne le cifre). */
export function waLink(phone: string | null | undefined): string {
  return 'https://wa.me/' + String(phone ?? '').replace(/[^0-9]/g, '');
}
