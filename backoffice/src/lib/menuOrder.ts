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

/**
 * I GRUPPI DEL MENU, PERSONALIZZABILI — titoli compresi.
 *
 * Richiesta di Simone dell'11/8: «l'utente deve poter cambiare, aggiungere o eliminare anche i
 * titoli dei gruppi, e spostare le pastiglie da un gruppo all'altro».
 *
 * ## Perché i gruppi stanno DENTRO la stessa lista di stringhe
 *
 * L'ordine è già salvato sul profilo come `menuOrder: string[]` (rotte). Introdurre una struttura
 * nuova avrebbe voluto dire cambiare il DTO, il servizio, la lettura, e soprattutto **migrare** le
 * preferenze già salvate dalle persone che il menu se l'erano sistemato. Qui invece il titolo di un
 * gruppo è una riga della stessa lista, riconoscibile perché comincia con `#gruppo:` — e una rotta
 * comincia sempre con `/`, quindi i due insiemi non possono collidere.
 *
 * Effetto collaterale voluto: chi ha un ordine salvato **senza** marcatori continua a funzionare
 * esattamente come prima (gruppi di fabbrica, ordine personalizzato dentro).
 */
export interface GruppoMenu {
  titolo: string;
  /** Le rotte (`to`) delle voci, nell'ordine scelto. */
  voci: string[];
}

const MARCATORE = '#gruppo:';

/** I gruppi personalizzati, o `null` se l'utente non li ha mai toccati. */
export function leggiGruppi(ordine: string[] | null | undefined): GruppoMenu[] | null {
  if (!ordine || !ordine.length) return null;
  if (!ordine.some((r) => r.startsWith(MARCATORE))) return null;
  const out: GruppoMenu[] = [];
  for (const riga of ordine) {
    if (riga.startsWith(MARCATORE)) out.push({ titolo: riga.slice(MARCATORE.length), voci: [] });
    else if (out.length) out[out.length - 1].voci.push(riga);
    // Una rotta PRIMA del primo titolo verrebbe persa: le si dà un gruppo senza nome invece di
    // buttarla via — una voce che sparisce dal menu è peggio di un titolo vuoto.
    else out.push({ titolo: '', voci: [riga] });
  }
  return out;
}

export function serializzaGruppi(gruppi: GruppoMenu[]): string[] {
  return gruppi.flatMap((g) => [MARCATORE + g.titolo, ...g.voci]);
}

/**
 * I gruppi da DISEGNARE, a partire dalle sezioni di fabbrica e dall'ordine salvato.
 *
 * ⚠️ La regola che conta: una voce presente nel menu di fabbrica e **non nominata** dai gruppi
 * salvati non sparisce — viene aggiunta in fondo al gruppo che aveva in origine (creandolo se non
 * c'è più). Senza questo, il giorno che aggiungiamo una pagina nuova, chi si è personalizzato il
 * menu non la vedrebbe mai, e non avrebbe modo di sapere che esiste.
 */
export function gruppiEffettivi<T extends { to: string; label: string }>(
  sezioni: { group: string; items: T[] }[],
  ordine: string[] | null | undefined,
): { group: string; items: T[] }[] {
  const gruppi = leggiGruppi(ordine);
  if (!gruppi) {
    return sezioni.map((s) => ({ group: s.group, items: orderNavItems(s.items, ordine ?? null) }));
  }
  const perRotta = new Map<string, { item: T; gruppoOriginale: string }>();
  for (const s of sezioni) for (const it of s.items) perRotta.set(it.to, { item: it, gruppoOriginale: s.group });

  const usate = new Set<string>();
  const out = gruppi.map((g) => {
    const items: T[] = [];
    for (const to of g.voci) {
      const trovata = perRotta.get(to);
      if (!trovata || usate.has(to)) continue; // rotta sparita dal menu, o duplicata
      usate.add(to);
      items.push(trovata.item);
    }
    return { group: g.titolo, items };
  });

  // Le voci mai nominate: tornano nel loro gruppo di origine, in fondo.
  for (const s of sezioni) {
    for (const it of s.items) {
      if (usate.has(it.to)) continue;
      let g = out.find((x) => x.group === s.group);
      if (!g) { g = { group: s.group, items: [] }; out.push(g); }
      g.items.push(it);
    }
  }
  return out;
}
