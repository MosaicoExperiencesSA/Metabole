/**
 * Ordine del menu laterale: alfabetico di default dentro ogni gruppo, con ordine
 * personalizzabile dall'utente (salvato sul profilo via /me/preferences e in cache
 * locale per un rendering immediato senza sfarfallii).
 */
const LS_MENU_ORDER = 'metabole_bo_menu_order';

export function readMenuOrderCache(): string[] | null {
  try {
    const v = localStorage.getItem(LS_MENU_ORDER);
    if (!v) return null;
    const arr = JSON.parse(v);
    return Array.isArray(arr) && arr.every((x) => typeof x === 'string') && arr.length ? arr : null;
  } catch {
    return null;
  }
}

export function writeMenuOrderCache(order: string[] | null): void {
  try {
    if (order && order.length) localStorage.setItem(LS_MENU_ORDER, JSON.stringify(order));
    else localStorage.removeItem(LS_MENU_ORDER);
  } catch {
    /* no-op */
  }
}

/**
 * Ordina le voci: se esiste un ordine personalizzato (lista di rotte `to`) usa quello;
 * le voci non incluse finiscono in fondo in ordine alfabetico. Senza ordine custom,
 * tutto alfabetico per etichetta.
 */
export function orderNavItems<T extends { to: string; label: string }>(items: T[], order: string[] | null): T[] {
  const alpha = (a: T, b: T) => a.label.localeCompare(b.label, 'it', { sensitivity: 'base' });
  if (order && order.length) {
    const idx = new Map(order.map((to, i) => [to, i]));
    return [...items].sort((a, b) => {
      const ia = idx.has(a.to) ? (idx.get(a.to) as number) : Number.MAX_SAFE_INTEGER;
      const ib = idx.has(b.to) ? (idx.get(b.to) as number) : Number.MAX_SAFE_INTEGER;
      return ia !== ib ? ia - ib : alpha(a, b);
    });
  }
  return [...items].sort(alpha);
}
