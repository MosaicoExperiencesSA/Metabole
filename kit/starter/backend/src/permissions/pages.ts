/*
 * ─────────────────────────────────────────────────────────────────────────────
 * KIT DI MONTAGGIO — LE CHIAVI DI PERMESSO. Manuale: kit/manuale/03-permessi.md
 * Da fare mentre lo copi: aggiungi le chiavi del TUO dominio, togli quelle che
 * non ti servono (il blocco «pagamenti» solo se il progetto vende).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Role } from '../common/roles';

/**
 * ⛔ **UNA CHIAVE QUI DENTRO È UNA PROMESSA.**
 *
 * Compare nella matrice dei permessi come interruttore, e chi la accende crede di aver abilitato
 * qualcosa. Perciò una chiave si aggiunge **insieme alla guardia che la legge** (`@RequirePage`),
 * mai prima. Una chiave dichiarata e non letta da nessun endpoint è un interruttore che non accende
 * niente — e, nel verso peggiore, uno che spegnendolo non spegne niente.
 *
 * ⛔ **E OGNI PAGINA NUOVA HA UNA CHIAVE SUA.** Riusare la chiave di un'altra pagina perché «è lo
 * stesso perimetro» lega due cose che da quel momento si concedono e si tolgono insieme, e non si
 * separano più senza un rilascio. La domanda giusta non è «sono la stessa area?» ma **«c'è qualcuno
 * a cui voglio dare l'una e non l'altra?»**.
 *
 * Il test `chiavi-senza-guardia.spec.ts` tiene ferma la prima regola. La seconda la tieni tu.
 */
export const BACKOFFICE_PAGES = [
  // ─── Generale ─────────────────────────────────────────────────────────────
  'dashboard',
  'notifications',

  // ─── Il tuo dominio ───────────────────────────────────────────────────────
  // …qui le pagine che sono il motivo per cui il progetto esiste…

  // ─── Pagamenti (kit/manuale/08-commerciale.md) ────────────────────────────
  'shop',              // Negozio: il catalogo di cosa vendi
  'purchases',         // Acquisti: chi ha comprato cosa
  'accounting',        // Bonifici: le contabili da approvare + il conto economico
  'accounting_costs',  // Contabilità: le uscite
  'discounts',         // Buoni sconto
  'commissions',       // % Provvigioni
  'compensation',      // Compensi staff
  'withdrawals',       // Richieste prelievo

  // ─── Amministrazione (kit/manuale/07-amministrazione.md) ──────────────────
  'users',
  'roles',
  'permissions',
  'engine_config',     // Parametri: le soglie, mai nel codice
  'audit_logs',        // Log attività
  'dev_backlog',       // Lista lavori
  'email_templates',
  'email_log',

  /**
   * ─── I POTERI GRAVI: chiave PROPRIA, non «Utenti: gestisci» ───────────────
   *
   * ⚠️ Sono separati di proposito. Vuoi poter dare l'elenco utenti a qualcuno **senza** dargli
   * questi tre — e con una chiave sola non si può, né alla nascita né dopo.
   */
  'set_user_password', // imposta una password scelta per un altro
  'impersonate',       // «entra come»: vedere l'app con gli occhi di un altro
  'change_user_email', // cambiare l'email di un altro, saltando la verifica
] as const;

export type PageKey = (typeof BACKOFFICE_PAGES)[number];
export interface Perm { view?: boolean; manage?: boolean }

/**
 * ⛔ **SI NASCE SPENTI.**
 *
 * Una pagina che nasce accesa per tutti è una pagina che qualcuno vede prima che tu abbia deciso
 * che deve vederla — e toglierla dopo è una notifica di sfiducia. Si accende a chi serve, dalla
 * matrice, a runtime.
 *
 * ⚠️ Questi sono i default del CODICE: valgono alla nascita della riga in `role_page_permission`.
 * Da lì in poi comanda la riga, cioè quello che l'amministratore ha davvero deciso.
 */
export const DEFAULT_PERMISSIONS: Record<Role, Partial<Record<PageKey, Perm>>> = {
  user: {
    // L'utente finale non entra nel backoffice: la sua area è un'altra applicazione.
  },
  staff: {
    dashboard: { view: true },
    notifications: { view: true },
    compensation: { view: true },   // i SUOI compensi (il filtro è nel servizio, non qui)
    dev_backlog: { view: true },
  },
  manager: {
    dashboard: { view: true, manage: true },
    notifications: { view: true },
    purchases: { view: true },
    discounts: { view: true },
    commissions: { view: true },
    compensation: { view: true },
    withdrawals: { view: true },
    users: { view: true },
    dev_backlog: { view: true, manage: true },
  },
  admin: {
    dashboard: { view: true, manage: true },
    notifications: { view: true },
    shop: { view: true, manage: true },
    purchases: { view: true, manage: true },
    accounting: { view: true, manage: true },
    accounting_costs: { view: true, manage: true },
    discounts: { view: true, manage: true },
    commissions: { view: true, manage: true },
    compensation: { view: true, manage: true },
    withdrawals: { view: true, manage: true },
    users: { view: true, manage: true },
    roles: { view: true, manage: true },
    permissions: { view: true, manage: true },
    engine_config: { view: true, manage: true },
    audit_logs: { view: true },     // ⚠️ mai `manage`: il registro non si modifica
    dev_backlog: { view: true, manage: true },
    email_templates: { view: true, manage: true },
    email_log: { view: true, manage: true },
    // I tre poteri gravi: accesi solo qui, e si concedono a mano a chi serve.
    set_user_password: { view: true, manage: true },
    impersonate: { view: true, manage: true },
    change_user_email: { view: true, manage: true },
  },
};

/**
 * ⛔ **IL LEGAME ALLA NASCITA — quando SEPARI una schermata in una chiave sua.**
 *
 * Finché la riga della figlia non esiste, vale la riga **vera** del genitore — cioè quello che
 * l'amministratore ha davvero deciso, non il default del codice. Appena qualcuno decide qualcosa
 * sulla figlia, la figlia vive per conto suo: è esattamente il motivo per cui separarla serve a
 * qualcosa.
 *
 * ⚠️ **Deve leggere la RIGA, non il default.** Leggendo il default la promessa è falsa nei due
 * versi: a chi aveva la pagina accesa *a mano* la figlia nasce spenta, e — il verso che non si vede
 * — a chi l'aveva *spenta* a mano la figlia nasce **accesa**. Un accesso in più non lo segnala
 * nessuno.
 *
 * ⚠️ **Figlia e genitore tutti e due `PageKey`**: con la figlia `string` un errore di battitura
 * compila, non eredita niente, e non lo dice nessuno.
 */
export const INHERIT_DEFAULTS: Partial<Record<PageKey, PageKey>> = {
  roles: 'permissions',
  // …le tue figlie…
};

/**
 * ⛔ **IL LEGAME PERMANENTE — le pagine «hub».**
 *
 * Chi ha l'hub può usare **anche** le API dei domini elencati, per sempre. Serve quando una pagina
 * è un contenitore che lavora su più domini e non vuoi obbligare a concedere anche le pagine dei
 * singoli cataloghi.
 *
 * ⛔ **Non usarlo per separare una schermata.** Il guardiano prova la chiave concessa *allo stesso
 * livello* della rotta: una riga `figlia: ['genitore']` farebbe passare la GET in vista, ma in
 * gestione farebbe passare anche POST, PATCH e DELETE del genitore — ricreando **al contrario**
 * l'accoppiamento che stavi sciogliendo. Per separare c'è `INHERIT_DEFAULTS`.
 */
export const PAGE_GRANTS: Record<string, PageKey[]> = {
  // hub: ['dominio_a', 'dominio_b'],
};

/**
 * ⛔ **I default scritti a mano, PRIMA che l'eredità li mescoli.**
 *
 * Il ciclo qui sotto arricchisce `DEFAULT_PERMISSIONS` con i default del genitore, e da lì in poi
 * «default della figlia» e «default del genitore» non si distinguono più. Ma la precedenza è che il
 * default scritto **apposta** per la figlia vince: l'unico motivo per scriverne uno è renderlo più
 * stretto del genitore, e senza questa copia quella scelta verrebbe ignorata in silenzio.
 */
export const DEFAULT_ESPLICITI: Record<string, Partial<Record<PageKey, Perm>>> =
  Object.fromEntries(
    (Object.keys(DEFAULT_PERMISSIONS) as Role[]).map((role) => [role, { ...DEFAULT_PERMISSIONS[role] }]),
  );

for (const role of Object.keys(DEFAULT_PERMISSIONS) as Role[]) {
  const perms = DEFAULT_PERMISSIONS[role];
  for (const [child, parent] of Object.entries(INHERIT_DEFAULTS) as [PageKey, PageKey][]) {
    const p = perms[parent];
    if (p && !perms[child]) perms[child] = { ...p };
  }
}

/**
 * ⛔ **Le pagine «hub» NON ereditano**: concedono più di quello che il loro genitore concede, e
 * ereditarne la riga darebbe loro di aprire una porta che il genitore non apre. Nascono dal loro
 * default, che è la scelta prudente.
 */
export const NON_EREDITANO: ReadonlySet<string> = new Set(Object.keys(PAGE_GRANTS));
