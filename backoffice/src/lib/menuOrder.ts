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

/** L'evento che dice «il menu è cambiato»: lo ascolta la barra laterale. */
export const EVENTO_MENU_CAMBIATO = 'metabole:menu-cambiato';

/**
 * Salva l'ordine in cache **e lo annuncia**.
 *
 * ⚠️ L'annuncio è la riga che fa funzionare le Impostazioni. La barra laterale legge le preferenze
 * **una volta sola**, quando si monta: cambiando i gruppi da Impostazioni la card si aggiornava e la
 * barra no, e restava indietro fino al ricaricamento della pagina. Sembrava che l'interruttore «a
 * fisarmonica» non facesse niente (segnalato da Simone il 12/8) — invece era salvato, e solo il menu
 * non lo sapeva.
 *
 * Un evento e non un pulsante «Salva»: il salvataggio c'era già ed era immediato, mancava che
 * qualcuno lo dicesse. Un pulsante avrebbe nascosto il difetto dietro un gesto in più.
 */
export function writeMenuOrderCache(order: string[] | null): void {
  try {
    if (order && order.length) localStorage.setItem(LS_MENU_ORDER, JSON.stringify(order));
    else localStorage.removeItem(LS_MENU_ORDER);
  } catch {
    /* no-op */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENTO_MENU_CAMBIATO, { detail: order ?? null }));
  } catch {
    /* fuori dal browser (test, SSR): non c'è nessuno da avvisare */
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
  /**
   * `true` = a fisarmonica (si apre e si chiude), `false` = solo titolo.
   * `undefined` = **eredita** da come è di fabbrica quel gruppo: è lo stato delle preferenze
   * salvate prima che questo interruttore esistesse, e non va confuso con «solo titolo», o a chi
   * aveva CRM aperto a fisarmonica sparirebbe il comportamento senza che l'abbia chiesto.
   */
  comprimibile?: boolean;
  /** Le rotte (`to`) delle voci, nell'ordine scelto. */
  voci: string[];
}

/**
 * I tre marcatori. Sono tutti `#gruppo…:` perché il riconoscimento resti uno solo, e perché una
 * rotta comincia sempre con `/`: non possono collidere con una voce del menu.
 */
const MARCATORE = '#gruppo:';        // eredita (com'era prima di questo interruttore)
const MARCATORE_APRIBILE = '#gruppoc:'; // comprimibile
const MARCATORE_TITOLO = '#gruppot:';   // solo titolo
const MARCATORI: [string, boolean | undefined][] = [
  [MARCATORE_APRIBILE, true],
  [MARCATORE_TITOLO, false],
  [MARCATORE, undefined],
];

/** I gruppi personalizzati, o `null` se l'utente non li ha mai toccati. */
export function leggiGruppi(ordine: string[] | null | undefined): GruppoMenu[] | null {
  if (!ordine || !ordine.length) return null;
  if (!ordine.some((r) => r.startsWith('#gruppo'))) return null;
  const out: GruppoMenu[] = [];
  for (const riga of ordine) {
    const m = MARCATORI.find(([pref]) => riga.startsWith(pref));
    if (m) out.push({ titolo: riga.slice(m[0].length), comprimibile: m[1], voci: [] });
    else if (out.length) out[out.length - 1].voci.push(riga);
    // Una rotta PRIMA del primo titolo verrebbe persa: le si dà un gruppo senza nome invece di
    // buttarla via — una voce che sparisce dal menu è peggio di un titolo vuoto.
    else out.push({ titolo: '', voci: [riga] });
  }
  return out;
}

export function serializzaGruppi(gruppi: GruppoMenu[]): string[] {
  return gruppi.flatMap((g) => [
    (g.comprimibile === true ? MARCATORE_APRIBILE : g.comprimibile === false ? MARCATORE_TITOLO : MARCATORE) + g.titolo,
    ...g.voci,
  ]);
}

/**
 * LE VOCI CHE QUESTA PERSONA NON VEDE RESTANO **DOVE LE AVEVA MESSE** (difetto 7 del 18/8).
 *
 * ## Il caso
 *
 * La card dell'ordine menu lavora sulle voci **visibili**: chi non ha il permesso `payments` non
 * vede quella riga, quindi non può nemmeno posizionarla. Le sue preferenze però quella riga ce
 * l'hanno — ed è giusto che ci resti: il giorno che le arriva il permesso, la pagina deve tornare
 * dove l'aveva messa lei e non in un posto qualsiasi.
 *
 * Fin qui `conNascoste` faceva la cosa giusta a metà: le teneva, ma le **riattaccava in fondo
 * all'ultimo gruppo**. Risultato: chi ottiene un permesso ritrova la voce in coda al menu, lontana
 * da dove l'aveva messa, e nessuno collega le due cose — la personalizzazione era stata rispettata
 * solo di nome.
 *
 * ## La regola
 *
 * ⚠️ Si lavora sulla **lista salvata**, non sulla vista: la vista non contiene le voci nascoste,
 * quindi da lì la posizione non si può nemmeno guardare. Ogni riga nascosta si riaggancia alla
 * riga che la precedeva **nella lista salvata**, se quella riga esiste ancora nella nuova.
 *
 * ⚠️ L'ancora è preferibilmente una **rotta** e non un titolo di gruppo: i titoli possono ripetersi
 * (due gruppi «Vendite» sono legittimi da quando i doppioni non si fondono più), e un'ancora
 * ambigua rimetterebbe la voce nel gruppo sbagliato. Se prima di lei non c'è nessuna rotta
 * sopravvissuta, ci si aggancia al titolo — prima occorrenza — e se non c'è nemmeno quello, la
 * riga torna in cima: era la prima, e in cima resta.
 *
 * ⚠️ Se la riga precedente è sparita si risale ancora indietro, invece di rinunciare: una voce
 * nascosta dopo un'altra voce nascosta non deve finire in coda solo perché la sua vicina non c'è
 * più.
 */
export function conNascosteAlLoroPosto(salvate: readonly string[], nuove: readonly string[]): string[] {
  if (!salvate.length) return [...nuove];
  const nella = new Set(nuove);
  const nascoste = salvate.filter((r) => !r.startsWith('#gruppo') && !nella.has(r));
  if (!nascoste.length) return [...nuove];

  const out = [...nuove];
  for (const riga of nascoste) {
    if (out.includes(riga)) continue; // ⚠️ mai due volte la stessa rotta
    const i = salvate.indexOf(riga);
    // Prima le rotte sopravvissute, poi — solo se non ce ne sono — i titoli: un titolo può
    // ripetersi, una rotta no.
    let posto = -1;
    for (let k = i - 1; k >= 0 && posto < 0; k--) {
      const precedente = salvate[k];
      if (precedente.startsWith('#gruppo')) continue;
      const dove = out.indexOf(precedente);
      if (dove >= 0) posto = dove;
    }
    if (posto < 0) {
      for (let k = i - 1; k >= 0 && posto < 0; k--) {
        const precedente = salvate[k];
        if (!precedente.startsWith('#gruppo')) continue;
        const dove = out.indexOf(precedente);
        if (dove >= 0) posto = dove;
      }
    }
    out.splice(posto + 1, 0, riga);
  }
  return out;
}

/**
 * L'ICONA DI UN GRUPPO — dalle sue VOCI, non dal suo titolo (difetto 2 del 18/8).
 *
 * Prima la barra laterale cercava la sezione di fabbrica **per titolo**
 * (`NAV.find((s) => s.group === gruppo.group)`). Chi rinominava «CRM» in «Vendite» vedeva sparire
 * l'icona: nessuna sezione di fabbrica si chiamava più così, e nessuno collegava le due cose —
 * aveva rinominato un gruppo, mica toccato le icone.
 *
 * Si guarda invece da quale sezione di fabbrica vengono la maggior parte delle voci del gruppo.
 * Regge al rename e regge a chi sposta due voci da un gruppo all'altro: **l'icona segue il
 * contenuto**, che è la cosa che il gruppo è davvero — il titolo è solo come l'ha chiamato chi lo
 * ha fatto (deciso da Simone, 18/8).
 *
 * ⚠️ Il secondo criterio di ordinamento è alfabetico **di proposito**: a parità di voci fra due
 * sezioni la scelta dev'essere la stessa a ogni caricamento, o l'icona di un gruppo misto
 * cambierebbe da sola fra una visita e l'altra.
 *
 * `undefined` = nessuna delle voci viene da una sezione con icona. Un gruppo vuoto non ne ha, e va
 * bene: non compare comunque.
 */
export function iconaDelGruppo(
  voci: readonly { to: string }[],
  sezioni: readonly { icon?: string; items: readonly { to: string }[] }[],
): string | undefined {
  const conteggi = new Map<string, number>();
  for (const it of voci) {
    const sez = sezioni.find((s) => s.items.some((x) => x.to === it.to));
    if (sez?.icon) conteggi.set(sez.icon, (conteggi.get(sez.icon) ?? 0) + 1);
  }
  return [...conteggi.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
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
  sezioni: { group: string; items: T[]; collapsible?: boolean }[],
  ordine: string[] | null | undefined,
): { group: string; items: T[]; comprimibile: boolean }[] {
  /** Com'è di fabbrica quel titolo: serve solo quando la preferenza non lo dice. */
  const diFabbrica = (titolo: string) => !!sezioni.find((s) => s.group === titolo)?.collapsible;
  const gruppi = leggiGruppi(ordine);
  if (!gruppi) {
    return sezioni.map((s) => ({ group: s.group, items: orderNavItems(s.items, ordine ?? null), comprimibile: !!s.collapsible }));
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
    return { group: g.titolo, items, comprimibile: g.comprimibile ?? diFabbrica(g.titolo) };
  });

  // Le voci mai nominate: tornano nel loro gruppo di origine, in fondo.
  for (const s of sezioni) {
    for (const it of s.items) {
      if (usate.has(it.to)) continue;
      let g = out.find((x) => x.group === s.group);
      if (!g) { g = { group: s.group, items: [], comprimibile: !!s.collapsible }; out.push(g); }
      g.items.push(it);
    }
  }
  return out;
}
