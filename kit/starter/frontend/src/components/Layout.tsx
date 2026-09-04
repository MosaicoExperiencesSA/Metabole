/*
 * ─────────────────────────────────────────────────────────────────────────────
 * KIT DI MONTAGGIO — la GABBIA. Manuale: kit/manuale/02-gabbia.md
 * Da fare mentre lo copi: riempi NAV, cambia il nome del prodotto nel brand.
 * ⚠️ Nessuna pagina disegna un proprio header: tutte passano da qui.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABEL } from '../lib/labels';
import { UserMenu } from './UserMenu';
import { NotificationBell } from './NotificationBell';
import { api } from '../api/client';
import { readMenuOrderCache, writeMenuOrderCache, gruppiEffettivi, iconaDelGruppo, EVENTO_MENU_CAMBIATO } from '../lib/menuOrder';

interface NavItem {
  key: string; // pageKey dei permessi
  label: string;
  to: string;
  icon: string;
}
interface NavSection {
  group: string;
  icon?: string;
  collapsible?: boolean;
  items: NavItem[];
}

/**
 * ⛔ **L'UNICO POSTO DOVE SI DICHIARA UNA VOCE DI MENU.** Manuale: kit/manuale/02-gabbia.md
 *
 * `key` è la **chiave di permesso** della pagina, e non è un'etichetta interna: la barra mostra la
 * voce solo se `can(key)`, e non deve esistere nessun altro modo di nascondere una voce.
 *
 * ⚠️ Ogni chiave qui dentro deve esistere in tre altri posti, o il difetto è silenzioso:
 *   1. `backend/src/permissions/pages.ts` → `BACKOFFICE_PAGES` + i default di ruolo
 *   2. `frontend/src/lib/labels.ts`       → `PAGE_LABEL`, o nella matrice compare la chiave grezza
 *   3. l'endpoint                          → `@RequirePage('chiave')`, la guardia che la legge
 *
 * ⚠️ Le voci qui sotto sono UN ESEMPIO da sostituire: quelle di «Amministrazione» però ci sono in
 * ogni progetto, e conviene tenerle come sono (kit/manuale/07-amministrazione.md).
 */
export const NAV: NavSection[] = [
  {
    group: 'Generale',
    items: [
      { key: 'dashboard', label: 'Dashboard', to: '/', icon: 'ti-layout-dashboard' },
      { key: 'notifications', label: 'Notifiche', to: '/notifiche', icon: 'ti-bell' },
      // ⚠️ Le Impostazioni NON stanno qui: stanno nel menu utente in alto (UserMenu).
    ],
  },
  {
    group: 'Il tuo dominio',
    // collapsible: true → fisarmonica. ⚠️ Una pagina dentro un gruppo chiuso è invisibile finché
    // non ci si ricorda che quel gruppo esiste: usala solo per gruppi lunghi e usati di rado.
    items: [
      // …le pagine che sono il motivo per cui il progetto esiste…
    ],
  },
  {
    group: 'Pagamenti',   // ⛔ solo se il progetto vende (kit/manuale/08-commerciale.md)
    items: [
      { key: 'shop', label: 'Negozio', to: '/negozio', icon: 'ti-building-store' },
      { key: 'purchases', label: 'Acquisti', to: '/acquisti', icon: 'ti-shopping-cart' },
      { key: 'discounts', label: 'Buoni sconto', to: '/buoni-sconto', icon: 'ti-ticket' },
      { key: 'accounting', label: 'Bonifici', to: '/pagamenti', icon: 'ti-cash' },
      { key: 'accounting_costs', label: 'Contabilità', to: '/contabilita', icon: 'ti-report-money' },
      { key: 'commissions', label: 'Provvigioni', to: '/provvigioni', icon: 'ti-percentage' },
      { key: 'compensation', label: 'Compensi staff', to: '/compensi', icon: 'ti-coin' },
      { key: 'withdrawals', label: 'Richieste prelievo', to: '/prelievi', icon: 'ti-wallet' },
    ],
  },
  {
    group: 'Amministrazione',   // ✅ queste cinque ci sono in ogni progetto
    items: [
      { key: 'users', label: 'Utenti', to: '/utenti', icon: 'ti-id-badge-2' },
      { key: 'roles', label: 'Ruoli', to: '/ruoli', icon: 'ti-shield-half' },
      { key: 'permissions', label: 'Permessi', to: '/permessi', icon: 'ti-lock-cog' },
      { key: 'engine_config', label: 'Parametri', to: '/parametri', icon: 'ti-adjustments' },
      { key: 'audit_logs', label: 'Log attività', to: '/log', icon: 'ti-history' },
      { key: 'dev_backlog', label: 'Lavori', to: '/lavori', icon: 'ti-checkup-list' },
    ],
  },
  {
    group: 'Comunicazioni',   // kit/manuale/07-amministrazione.md §7.6
    items: [
      { key: 'email_templates', label: 'Modelli email', to: '/email-modelli', icon: 'ti-mail-cog' },
      // ⚠️ La pagina che risponde a «non mi è arrivato niente» senza aprire il pannello del
      // fornitore. Vale le due ore che costa.
      { key: 'email_log', label: 'Log email', to: '/email-log', icon: 'ti-mail-check' },
    ],
  },
];

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  const { can, logout, impersonating, stopImpersonation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [menuOrder, setMenuOrder] = useState<string[] | null>(() => readMenuOrderCache());
  useEffect(() => {
    api<{ menuOrder: string[] | null }>('/me/preferences')
      .then((p) => { const o = p.menuOrder && p.menuOrder.length ? p.menuOrder : null; setMenuOrder(o); writeMenuOrderCache(o); })
      .catch(() => { /* uso la cache locale */ });
  }, []);
  /**
   * ⚠️ La barra si RIDISEGNA quando le Impostazioni cambiano il menu.
   *
   * Senza, leggeva le preferenze solo al montaggio: si spostava una voce o si toglieva la
   * fisarmonica a un gruppo, la card si aggiornava e la barra restava com'era fino al ricaricamento
   * della pagina — e sembrava che l'interruttore non facesse niente.
   *
   * `storage` in più dell'evento nostro: quello arriva dalle ALTRE schede aperte sullo stesso
   * backoffice, che altrimenti resterebbero indietro fino al prossimo caricamento.
   */
  useEffect(() => {
    const daEvento = (e: Event) => setMenuOrder(((e as CustomEvent).detail as string[] | null) ?? readMenuOrderCache());
    const daAltraScheda = () => setMenuOrder(readMenuOrderCache());
    window.addEventListener(EVENTO_MENU_CAMBIATO, daEvento);
    window.addEventListener('storage', daAltraScheda);
    return () => {
      window.removeEventListener(EVENTO_MENU_CAMBIATO, daEvento);
      window.removeEventListener('storage', daAltraScheda);
    };
  }, []);
  const [navOpen, setNavOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('app_bo_nav') !== 'closed'; } catch { return true; }
  });
  function toggleNav() {
    setNavOpen((o) => {
      const n = !o;
      try { localStorage.setItem('app_bo_nav', n ? 'open' : 'closed'); } catch { /* no-op */ }
      return n;
    });
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function link(it: NavItem, nested = false) {
    return (
      <NavLink
        key={it.to}
        to={it.to}
        end={it.to === '/'}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        style={nested ? { paddingLeft: 26, fontSize: 13.5 } : undefined}
      >
        <i className={`ti ${it.icon}`} />
        {it.label}
      </NavLink>
    );
  }

  return (
    <div className={`app-shell${navOpen ? '' : ' nav-closed'}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="logo" style={{ background: '#fff', padding: 4 }}>
            <img src="/brand/simbolo.png" alt="NOME_APP" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ flex: 1 }}>
            <b>NOME_APP</b>
            <span>Backoffice</span>
          </div>
          <button className="nav-collapse" onClick={toggleNav} title="Chiudi il menu">
            <i className="ti ti-chevron-left" />
          </button>
        </div>

        {/*
          I GRUPPI arrivano da `gruppiEffettivi`: di fabbrica sono quelli di `NAV`, ma chi se li è
          rinominati, riordinati o rifatti da capo (Impostazioni → Ordine del menu) vede i suoi.
          **Se un gruppo è a fisarmonica o solo un titolo lo decide chi guarda** (richiesta di
          Simone dell'11/8): la preferenza vince, e solo quando non dice niente — cioè per le
          preferenze salvate prima che l'interruttore esistesse — si eredita com'era di fabbrica.
          ⚠️ L'ICONA SEGUE LE VOCI, NON IL TITOLO (18/8). Prima si cercava la sezione di fabbrica
          per titolo, e chi rinominava «CRM» in «Vendite» si vedeva sparire l'icona senza capire
          perché — aveva rinominato un gruppo, mica toccato le icone. Ora si guarda da dove vengono
          le sue voci: regge al rename e a chi sposta due voci da un gruppo all'altro.
        */}
        {gruppiEffettivi(NAV.map((s) => ({ group: s.group, collapsible: s.collapsible, items: s.items.filter((it) => can(it.key)) })), menuOrder).map((gruppo) => {
          const visible = gruppo.items;
          if (visible.length === 0) return null;
          const icona = iconaDelGruppo(visible, NAV);

          if (gruppo.comprimibile) {
            const hasActive = visible.some((it) => location.pathname.startsWith(it.to));
            /**
             * ⚠️ Un gruppo a fisarmonica che non contiene la pagina attiva parte CHIUSO, ed è
             * voluto: chi lo mette a fisarmonica lo fa proprio per tenere la barra corta. Qui c'era
             * un `?? true` in coda che **non scattava mai** (`hasActive` è sempre un booleano) e
             * faceva credere il contrario a chi leggeva. Tolto: il comportamento non cambia, cambia
             * che il codice dice quello che fa (18/8).
             * ⚠️ Il rovescio, da sapere: una pagina dentro un gruppo a fisarmonica che si usa di
             * rado è invisibile finché non ci si ricorda che quel gruppo esiste. Se arriva un «non
             * trovo più X», è qui che si guarda per primo.
             */
            const isOpen = collapsed[gruppo.group] ?? hasActive;
            return (
              <div key={gruppo.group}>
                <button
                  className="nav-item"
                  style={{ fontWeight: 700, marginTop: 8 }}
                  onClick={() => setCollapsed((c) => ({ ...c, [gruppo.group]: !(c[gruppo.group] ?? hasActive) }))}
                >
                  {icona && <i className={`ti ${icona}`} />}
                  {gruppo.group}
                  <i className={`ti ti-chevron-${isOpen ? 'down' : 'right'}`} style={{ marginLeft: 'auto', fontSize: 15 }} />
                </button>
                {isOpen && visible.map((it) => link(it, true))}
              </div>
            );
          }

          return (
            <div key={gruppo.group}>
              <div className="nav-sep">{gruppo.group}</div>
              {visible.map((it) => link(it))}
            </div>
          );
        })}

        <div className="sidebar-foot">
          <button className="nav-item" onClick={handleLogout}>
            <i className="ti ti-logout" />
            Esci
          </button>
        </div>
      </aside>

      <div className="main">
        {impersonating && (
          <div className="imp-bar">
            <span>
              <i className="ti ti-eye" /> Stai vedendo l'app come <b>{impersonating.email}</b> (
              {ROLE_LABEL[impersonating.role]}) — <b>in sola lettura</b>: niente di quello che fai
              qui viene salvato. La sessione scade da sola dopo 30 minuti.
            </span>
            <button onClick={stopImpersonation}>Torna admin</button>
          </div>
        )}
        <div className="topbar">
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <button className="nav-toggle" onClick={toggleNav} title={navOpen ? 'Chiudi il menu' : 'Apri il menu'}>
              <i className="ti ti-menu-2" />
            </button>
            <h1>{title}</h1>
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
