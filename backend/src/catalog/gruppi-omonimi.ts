/**
 * ⛔ **I GRUPPI DI EQUIVALENZA CON LO STESSO NOME** — e perché non sono solo brutti da vedere.
 *
 * Richiesta di Simone (2/9): «nelle equivalenze ci sono parecchi gruppi doppi, se il nome del gruppo
 * è uguale vanno accorpati». Nella pagina «Bevande vegetali» compare sei volte, con dentro elenchi
 * simili ma non uguali.
 *
 * ## ⛔ Il danno vero: con dei doppioni APPROVATI, cinque su sei sono già invisibili
 *
 * `menu/sostituzione-chat.service.ts` cerca il gruppo dei grassi **per nome** fra gli approvati,
 * ordinati per `createdAt`, e prende **il primo che combacia**. Con sei omonimi approvati, i pesi
 * che la nutrizionista scrive nel secondo non li legge nessuno — e la frase che la cliente riceve
 * dice «gruppo senza pesi» mentre i pesi ci sono, nel gruppo accanto. Non è disordine: è lavoro
 * fatto che non arriva.
 *
 * ⚠️ `menu.service.ts` invece li usa **tutti** (quelli della dieta o globali) per il trova-gemella:
 * lì i doppioni non fanno male, e nemmeno bene.
 *
 * ## ⛔ Perché unire NON è sempre sicuro, e questo modulo dice quando
 *
 * · **L'ambito.** Un gruppo ha un `productId`: `null` = globale, altrimenti è **di una dieta**.
 *   Unire due omonimi di diete diverse rende gli alimenti dell'una equivalenti anche nell'altra —
 *   che è una decisione di nutrizione, non di pulizia. «bevanda di nocciola» che entra in una dieta
 *   dove nessuno l'aveva messa è esattamente il genere di cosa che non si fa con uno script.
 * · **I pesi.** `members.fattori` porta i grammi di conversione dei grassi. Due gruppi con fattori
 *   **diversi** non si possono unire scegliendo a caso: uno dei due numeri finirebbe nel piatto di
 *   una persona senza che nessuno l'abbia deciso.
 * · **Lo stato.** Unire una bozza dentro un approvato fa entrare nel motore alimenti che nessuno ha
 *   validato; il contrario butta via un'approvazione.
 *
 * ⚠️ Quindi qui si **classifica**, non si unisce d'ufficio: `sicura` va da sé, `da guardare` no.
 *
 * ## ⛔ IL 4/9 SIMONE HA DECISO IL CONTRARIO, E QUESTO RIQUADRO RESTA COM'ERA
 *
 * Sopra c'e' scritto «unire due omonimi di diete diverse e' una decisione di nutrizione, non di
 * pulizia», e sotto (`pianiDiUnione`) il file fa **esattamente quell'unione**. Non e' una svista ed
 * e' voluto che si legga cosi': il 4/9 Simone ha deciso che *«i gruppi non devono essere legati
 * alle diete, sono gruppi e stop»*, e questo riquadro e' il conto di cosa quella decisione costa.
 * Cancellarlo vorrebbe dire che fra sei mesi qualcuno rifa' il ragionamento da capo credendolo
 * nuovo.
 *
 * ⚠️ **`famiglieDiOmonimi` e i suoi `motivi` restano quelli di prima**, e `diag:equivalenze-doppie`
 * continua a stampare «da guardare -- ambiti diversi»: e' il tabulato **di prima** dell'unione, e
 * dopo averla lanciata non trovera' piu' niente da dire. `pianiDiUnione` guarda un motivo solo --
 * i **pesi che non coincidono** -- perche' e' l'unico che nessuna decisione di pulizia puo' scavalcare.
 */
import { normalizza } from '../common/nomi-alimento';

export interface Gruppo {
  id: string;
  name: string;
  productId: string | null;
  status: string;
  members: unknown;
  createdAt?: Date;
}

/**
 * La chiave con cui due nomi sono «lo stesso nome».
 *
 * ⚠️ Minuscolo, senza accenti, **e con gli spazi interni collassati**: `normalizza` da sola non
 * tocca il doppio spazio, e «Bevande  vegetali» resterebbe un gruppo a parte per un tasto premuto
 * due volte. ⛔ Non si va oltre: togliere le parole di servizio unirebbe «Bevande vegetali» e
 * «Bevande vegetali non zuccherate», che sono **due gruppi diversi** — il secondo esiste apposta.
 */
export const chiaveNome = (nome: string): string => normalizza(nome).replace(/\s+/g, ' ');

/**
 * Gli alimenti dichiarati in un gruppo, senza doppioni e senza vuoti.
 *
 * ⛔ **`members` PUO' ESSERE UN ARRAY, e prima qui si perdeva** -- rilievo della revisione del
 * 4/9. La colonna e' `Json @default("[]")`: il valore di partenza non e' un oggetto, e' una
 * **lista**. Una riga scritta senza passare da `membersFrom` puo' quindi essere `[]` o, nella forma
 * vecchia, `['ceci','lenticchie']` -- e `(members as {items})?.items` su un array e' `undefined`.
 * Con l'unione del 4/9 quella riga poteva essere il **capofila** di una famiglia: il gruppo unito
 * sarebbe nato vuoto, e nessuno l'avrebbe visto.
 */
export function alimenti(members: unknown): string[] {
  // ⚠️ La forma vecchia (una lista di stringhe) si legge, invece di essere buttata in silenzio.
  const items = Array.isArray(members) ? members : (members as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const visti = new Set<string>();
  const out: string[] = [];
  for (const x of items) {
    const s = typeof x === 'string' ? x.trim() : '';
    if (!s) continue;
    const k = normalizza(s);
    if (visti.has(k)) continue;
    visti.add(k);
    out.push(s);
  }
  return out;
}

const fattoriDi = (members: unknown): unknown => (members as { fattori?: unknown })?.fattori;
const haFattori = (members: unknown): boolean => {
  const f = fattoriDi(members);
  return f !== undefined && f !== null && Object.keys(f as object).length > 0;
};

export type Verdetto = 'sicura' | 'da guardare';

export interface Famiglia {
  chiave: string;
  /** Il nome come si legge, preso dal gruppo più vecchio: è quello che il motore trova per primo. */
  nome: string;
  gruppi: Gruppo[];
  verdetto: Verdetto;
  /** Perché non è sicura. Vuoto quando lo è. */
  motivi: string[];
  /** Gli alimenti che l'unione avrebbe. */
  alimentiUniti: string[];
  /** Quanti alimenti l'unione **aggiunge** al gruppo più vecchio — cioè quanto lavoro sta tornando a galla. */
  aggiunti: number;
}

/** Raggruppa per nome e dice, per ogni famiglia di omonimi, se unirla è sicuro. */
export function famiglieDiOmonimi(gruppi: readonly Gruppo[]): Famiglia[] {
  const per = new Map<string, Gruppo[]>();
  for (const g of gruppi) {
    const k = chiaveNome(g.name ?? '');
    if (!k) continue;
    per.set(k, [...(per.get(k) ?? []), g]);
  }

  const out: Famiglia[] = [];
  for (const [chiave, tutti] of per) {
    if (tutti.length < 2) continue;
    const ordinati = [...tutti].sort(
      (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
    );
    const capofila = ordinati[0];

    const motivi: string[] = [];
    const ambiti = new Set(ordinati.map((g) => g.productId ?? '(globale)'));
    if (ambiti.size > 1) {
      motivi.push(`ambiti diversi (${[...ambiti].length}): unirli allargherebbe le equivalenze a diete che non le avevano`);
    }
    const stati = new Set(ordinati.map((g) => g.status));
    if (stati.size > 1) motivi.push(`stati diversi (${[...stati].sort().join(', ')})`);
    /**
     * ⛔ **Due elenchi di pesi diversi non si uniscono a caso**: uno dei due numeri finirebbe nel
     * piatto di una persona senza che nessuno l'abbia scelto.
     */
    const conPesi = ordinati.filter((g) => haFattori(g.members));
    if (conPesi.length > 1) {
      const distinti = new Set(conPesi.map((g) => JSON.stringify(fattoriDi(g.members))));
      if (distinti.size > 1) motivi.push(`${conPesi.length} gruppi hanno i pesi dei grassi e non coincidono`);
    }

    const visti = new Set<string>();
    const alimentiUniti: string[] = [];
    for (const g of ordinati) {
      for (const a of alimenti(g.members)) {
        const k = normalizza(a);
        if (visti.has(k)) continue;
        visti.add(k);
        alimentiUniti.push(a);
      }
    }

    out.push({
      chiave,
      nome: capofila.name,
      gruppi: ordinati,
      verdetto: motivi.length ? 'da guardare' : 'sicura',
      motivi,
      alimentiUniti,
      aggiunti: alimentiUniti.length - alimenti(capofila.members).length,
    });
  }
  return out.sort((a, b) => b.gruppi.length - a.gruppi.length || a.nome.localeCompare(b.nome));
}

// ───────────────────────────────────────────────────────────── l'unione vera ─

/**
 * ⛔ **DA QUI IN GIÙ SI UNISCE DAVVERO** — decisione di Simone, 4/9: *«i gruppi NON devono essere
 * legati alle diete, sono gruppi e stop»*.
 *
 * Cambia il significato del dato, non solo la sua forma. Fino a oggi `productId` non era
 * un'etichetta: era **l'unico filtro di regime** che esistesse sulle proposte in chat
 * (`scegliSostituto` scarta per allergie, intolleranze e cibi non graditi — il regime non lo
 * guarda). Rendere globali tutti i gruppi toglie quel filtro per caso, e per questo la stessa
 * consegna porta `menu/regime-del-candidato.ts`: il cancello che il `productId` dava senza volerlo,
 * scritto dove si può provare.
 *
 * ## Le regole dell'unione, e chi le ha decise
 *
 * · **Un nome, un gruppo, globale.** Il capofila è il **più vecchio**, perché è quello che oggi
 *   vince nella ricerca per nome: l'unione deve arricchire lui, o sposta il comportamento invece di
 *   sistemarlo.
 * · **Lo stato**: approvato se **almeno uno** della famiglia era approvato (decisione di Simone,
 *   4/9). ⛔ Vuol dire che alimenti proposti dall'AI e mai riletti da nessuno entrano nel motore:
 *   è scritto qui perché resti detto, ed è una scelta, non una conseguenza.
 * · ⚠️ **Se NESSUNO era approvato, resta bozza.** Questa non è la decisione di Simone, è il suo
 *   confine: approvare d'ufficio migliaia di gruppi che nessuno ha mai aperto sarebbe un'altra
 *   cosa, e non gliel'ha chiesta nessuno.
 * · ⛔ **I pesi che non coincidono FERMANO la famiglia.** Nessuna decisione di pulizia può
 *   scegliere a caso fra due tabelle di grammi: uno dei due numeri finirebbe nel piatto di una
 *   persona senza che nessuno l'abbia deciso. La famiglia resta com'è e lo script lo stampa.
 */
export interface PianoFamiglia {
  chiave: string;
  /** Il nome del capofila, cioè quello che resta. */
  nome: string;
  /** Il gruppo che sopravvive: il più vecchio. */
  capofilaId: string;
  /** Gli altri, che spariscono dopo che le loro righe sono state ripuntate qui. */
  daCancellare: string[];
  items: string[];
  note?: string;
  /** I pesi che il gruppo unito porta: quelli dell'unico che li aveva, o quelli identici di tutti. */
  fattori?: unknown;
  status: 'approved' | 'draft';
  /** Quanti alimenti l'unione aggiunge al capofila — quanto lavoro sta tornando a galla. */
  aggiunti: number;
  /** ⛔ Non vuoto = la famiglia NON si tocca, e questo è il perché. */
  fermata: string[];
}

/**
 * La base da cui riscrivere `members` senza perdere quello che c'era.
 *
 * ⛔ **Un array non e' una base**: `{ ...['ceci'] }` da' `{ '0': 'ceci' }`, cioe' un `members`
 * malformato scritto sopra un gruppo vero. Quando quello che c'e' non e' un oggetto si riparte da
 * `{}` -- gli `items` glieli rimette chi chiama, e li ha gia' letti con `alimenti()`.
 */
export function membersDiPartenza(members: unknown): Record<string, unknown> {
  if (!members || typeof members !== 'object' || Array.isArray(members)) return {};
  return { ...(members as Record<string, unknown>) };
}

/** Vero se questo `members` non e' un oggetto: serve allo script per contarli e dirlo. */
export const membersMalformato = (members: unknown): boolean =>
  !members || typeof members !== 'object' || Array.isArray(members);

/**
 * LE TRE SCRITTURE DI UN'UNIONE, calcolate senza toccare il database.
 *
 * ⛔ Sta qui e non dentro lo script per una ragione sola: la meta' che **scrive** su 2848 righe
 * di produzione non puo' essere l'unica senza prove. L'ordine conta ed e' provato: prima si
 * ripuntano le righe delle sostituzioni promosse, **poi** si cancellano i gruppi -- la colonna e'
 * `onDelete: SetNull`, quindi cancellare per primo non romperebbe niente, farebbe sparire la
 * traccia di dove quella promozione era finita.
 */
export interface OperazioniUnione {
  ripunta: { da: string[]; a: string };
  aggiorna: { id: string; members: Record<string, unknown>; status: string; productId: null };
  cancella: string[];
}

export function operazioniDiUnione(piano: PianoFamiglia, membersCapofila: unknown): OperazioniUnione {
  return {
    ripunta: { da: piano.daCancellare, a: piano.capofilaId },
    aggiorna: {
      id: piano.capofilaId,
      members: {
        ...membersDiPartenza(membersCapofila),
        items: piano.items,
        ...(piano.note ? { note: piano.note } : {}),
        ...(piano.fattori ? { fattori: piano.fattori } : {}),
      },
      status: piano.status,
      productId: null,
    },
    cancella: piano.daCancellare,
  };
}

/**
 * La firma di una tabella di pesi: serve a dire se due tabelle sono **la stessa**.
 *
 * ⚠️ `fonte` sta fuori apposta: due tabelle con gli stessi grammi e la fonte scritta in due modi
 * («CREA» e «crea») sono la stessa tabella, e fermare la famiglia per quello vorrebbe dire lasciare
 * in giro dei doppioni per una differenza di battitura. ⚠️ Le chiavi si **ordinano**: `JSON.stringify`
 * dipende dall'ordine di inserimento, e due tabelle identiche scritte in ordine diverso
 * risulterebbero diverse.
 */
export function firmaFattori(members: unknown): string {
  const f = fattoriDi(members) as { riferimento?: unknown; pesi?: Record<string, unknown> } | null | undefined;
  if (!f) return '';
  const pesi = Object.entries(f.pesi ?? {})
    .map(([k, v]) => `${normalizza(String(k))}=${Number(v)}`)
    .sort()
    .join('|');
  if (!pesi) return '';
  return `${normalizza(String(f.riferimento ?? ''))}#${pesi}`;
}

/** Quanto può essere lunga la nota del gruppo unito: è il tetto che l'editor accetta in `PATCH`. */
export const MAX_NOTA = 300;

/**
 * Le note dei gruppi che spariscono, in una sola.
 *
 * ⛔ **Quello che non ci sta si CONTA, non si taglia in silenzio.** Una nota è la provenienza («da
 * una sostituzione concordata con…»), cioè l'unica cosa che fra sei mesi dice perché quella regola
 * esiste. Se le note non entrano nei 300 caratteri che l'editor accetta, il gruppo unito lo dice —
 * e lo script le stampa tutte, per intero, prima di cancellare i gruppi che le portavano.
 */
export function noteUnite(note: readonly string[]): string | undefined {
  const viste = new Set<string>();
  const pulite: string[] = [];
  for (const n of note) {
    const s = (n ?? '').trim();
    if (!s || viste.has(s)) continue;
    viste.add(s);
    pulite.push(s);
  }
  if (!pulite.length) return undefined;
  const tutte = pulite.join(' · ');
  if (tutte.length <= MAX_NOTA) return tutte;
  const dentro: string[] = [];
  for (const n of pulite) {
    const coda = ` · (+${pulite.length - dentro.length} note più vecchie, nel log dell'unione)`;
    if ([...dentro, n].join(' · ').length + coda.length > MAX_NOTA) break;
    dentro.push(n);
  }
  const restano = pulite.length - dentro.length;
  if (!dentro.length) return `${pulite[0].slice(0, MAX_NOTA - 40)}… (+${restano - 1} note nel log dell'unione)`;
  return `${dentro.join(' · ')} · (+${restano} note più vecchie, nel log dell'unione)`;
}

/**
 * Il piano di unione, famiglia per famiglia. **Non tocca niente**: dice cosa si scriverebbe.
 *
 * ⚠️ Si passano **tutti** i gruppi, non solo gli omonimi: i nomi che compaiono una volta sola non
 * producono un piano (non c'è niente da unire) e restano dove sono — a diventare globali ci pensa
 * lo script con una riga sola, perché è la stessa cosa per tutti.
 */
export function pianiDiUnione(gruppi: readonly Gruppo[]): PianoFamiglia[] {
  const out: PianoFamiglia[] = [];
  for (const f of famiglieDiOmonimi(gruppi)) {
    const ordinati = f.gruppi;
    const capofila = ordinati[0];

    const fermata: string[] = [];
    const firme = new Set(ordinati.map((g) => firmaFattori(g.members)).filter(Boolean));
    if (firme.size > 1) {
      fermata.push(
        `${firme.size} tabelle di pesi diverse fra i ${ordinati.length} gruppi: sceglierne una a caso ` +
          'metterebbe dei grammi non decisi da nessuno nel piatto di una persona',
      );
    }

    const visti = new Set<string>();
    const items: string[] = [];
    for (const g of ordinati) {
      for (const a of alimenti(g.members)) {
        const k = normalizza(a);
        if (visti.has(k)) continue;
        visti.add(k);
        items.push(a);
      }
    }

    const conFattori = ordinati.find((g) => firmaFattori(g.members));
    const note = noteUnite(
      ordinati.map((g) => String((g.members as { note?: unknown } | null)?.note ?? '')),
    );

    out.push({
      chiave: f.chiave,
      nome: capofila.name,
      capofilaId: capofila.id,
      daCancellare: ordinati.slice(1).map((g) => g.id),
      items,
      ...(note ? { note } : {}),
      ...(conFattori ? { fattori: fattoriDi(conFattori.members) } : {}),
      // ⛔ Approvato se almeno uno lo era (Simone, 4/9). Se nessuno lo era, resta bozza.
      status: ordinati.some((g) => g.status === 'approved') ? 'approved' : 'draft',
      aggiunti: items.length - alimenti(capofila.members).length,
      fermata,
    });
  }
  return out;
}
