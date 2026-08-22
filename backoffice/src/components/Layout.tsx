import { useState, useEffect, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABEL } from '../lib/labels';
import { UserMenu } from './UserMenu';
import { NotificationBell } from './NotificationBell';
import { OverdueGate } from './RecallGuard';
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

/** Voci del menu: sezione ↔ pageKey dei permessi ↔ rotta ↔ icona. */
export const NAV: NavSection[] = [
  {
    group: 'Generale',
    items: [
      { key: 'dashboard', label: 'Dashboard', to: '/', icon: 'ti-layout-dashboard' },
      { key: 'posta', label: 'Posta', to: '/posta', icon: 'ti-mail' },
      { key: 'charts', label: 'Grafici', to: '/grafici', icon: 'ti-chart-histogram' },
      { key: 'notifications', label: 'Notifiche', to: '/notifiche', icon: 'ti-bell' },
      // Impostazioni spostate nel menu utente in alto (avatar) → non più in sidebar.
    ],
  },
  {
    group: 'CRM',
    icon: 'ti-address-book',
    collapsible: true,
    items: [
      { key: 'crm_leads', label: 'Gestione lead', to: '/crm/gestione', icon: 'ti-list-details' },
      { key: 'crm_lead_new', label: 'Inserimento lead', to: '/crm/inserimento', icon: 'ti-user-plus' },
      { key: 'crm_import', label: 'Import liste', to: '/crm/import', icon: 'ti-database-import' },
      { key: 'crm_pipeline', label: 'Pipeline', to: '/crm/pipeline', icon: 'ti-layout-kanban' },
      { key: 'lead_acceptance', label: 'Lead da accettare', to: '/crm/da-accettare', icon: 'ti-user-check' },
      { key: 'crm_calendar', label: 'Calendario', to: '/crm/calendario', icon: 'ti-calendar-event' },
      // ⚠️ «Attività da fare» e non «Attività coach» (22/8): da oggi questa pagina la apre anche la
      // nutrizionista, con i suoi quattro tipi. Una voce che si chiama col nome di un altro ruolo si
      // legge come «non è roba mia», ed è l'unico posto da cui può chiudere quelle attività.
      { key: 'coach_tasks', label: 'Attività da fare', to: '/attivita-coach', icon: 'ti-checklist' },
    ],
  },
  {
    group: 'Percorso cliente',
    items: [
      { key: 'clients', label: 'Clienti', to: '/clienti', icon: 'ti-users' },
      { key: 'visits_agenda', label: 'Agenda visite', to: '/agenda', icon: 'ti-calendar' },
      { key: 'escalations', label: 'Segnalazioni', to: '/segnalazioni', icon: 'ti-alert-triangle' },
      { key: 'chat', label: 'Chat', to: '/chat', icon: 'ti-messages' },
    ],
  },
  {
    group: 'Pagamenti',
    items: [
      { key: 'shop', label: 'Negozio', to: '/negozio', icon: 'ti-building-store' },
      { key: 'purchases', label: 'Acquisti', to: '/acquisti', icon: 'ti-shopping-cart' },
      { key: 'discounts', label: 'Buoni sconto', to: '/buoni-sconto', icon: 'ti-ticket' },
      { key: 'accounting', label: 'Bonifici & contabilità', to: '/pagamenti', icon: 'ti-cash' },
      { key: 'accounting_costs', label: 'Contabilità', to: '/contabilita', icon: 'ti-report-money' },
      { key: 'commissions', label: 'Provvigioni', to: '/provvigioni', icon: 'ti-percentage' },
      { key: 'compensation', label: 'Compensi staff', to: '/compensi', icon: 'ti-coin' },
      { key: 'withdrawals', label: 'Richieste prelievo', to: '/prelievi', icon: 'ti-wallet' },
    ],
  },
  {
    group: 'Marketing',
    items: [
      { key: 'marketing', label: 'Marketing', to: '/marketing', icon: 'ti-speakerphone' },
      { key: 'testimonials', label: 'Testimonianze', to: '/testimonianze', icon: 'ti-quote' },
      { key: 'publisher', label: 'Publisher social', to: '/publisher', icon: 'ti-send' },
      { key: 'agents', label: 'Agenti AI', to: '/agenti', icon: 'ti-robot' },
    ],
  },
  {
    group: 'Contenuti',
    items: [
      { key: 'creation_validation', label: 'Creazione e validazione', to: '/creazione-validazione', icon: 'ti-wand' },
      // Subito sotto «Creazione e validazione» perché è la sua verifica: quella genera, questa dice
      // se è arrivato a destinazione (11/8, «così a colpo d'occhio capiamo dove siamo»).
      { key: 'catalog_coverage', label: 'Copertura catalogo', to: '/copertura-catalogo', icon: 'ti-table-options' },
      { key: 'diet_workspace', label: 'Gestione dieta', to: '/gestione-dieta', icon: 'ti-clipboard-list' },
      { key: 'diets_catalog', label: 'Catalogo diete', to: '/diete', icon: 'ti-salad' },
      { key: 'recipes', label: 'Catalogo ricette', to: '/ricette', icon: 'ti-tools-kitchen-2' },
      { key: 'allergens', label: 'Allergeni ricette', to: '/tag-allergeni', icon: 'ti-alert-triangle' },
      { key: 'colazioni', label: 'Colazioni', to: '/colazioni', icon: 'ti-coffee' },
      { key: 'equivalence_groups', label: 'Gruppi di equivalenza', to: '/gruppi-equivalenza', icon: 'ti-arrows-shuffle' },
      // Subito sotto i gruppi di equivalenza perché è da qui che ci si arriva: una riga confermata
      // in questa tabella diventa un gruppo con «Promuovi a regola» (§16.9, 12/8).
      { key: 'food_swaps', label: 'Sostituzioni', to: '/sostituzioni', icon: 'ti-replace' },
      // L'assistente della nutrizionista (Vera). Stessa chiave di permesso delle sostituzioni:
      // è lo stesso perimetro — «cosa il motore userà per le clienti» — e moltiplicare le chiavi
      // moltiplica i posti in cui qualcuno dimentica di abilitare qualcosa.
      { key: 'nutri_assistant', label: 'Assistente', to: '/assistente', icon: 'ti-message-chatbot' },
      // Accanto ai gruppi di equivalenza di proposito: sono le due tabelle che decidono cosa Gaia
      // può dire a una cliente su un alimento (11/8).
      { key: 'nutrient_facts', label: 'Valori nutrizionali', to: '/valori-nutrizionali', icon: 'ti-database-search' },
      { key: 'engine_protocols', label: 'Protocolli motore', to: '/protocolli', icon: 'ti-cpu' },
      { key: 'engine_rules', label: 'Regole motore', to: '/regole-motore', icon: 'ti-adjustments-cog' },
    ],
  },
  {
    group: 'Comunicazioni',
    items: [
      { key: 'email_templates', label: 'Modelli email', to: '/email-modelli', icon: 'ti-mail-cog' },
      { key: 'email_log', label: 'Log email', to: '/email-log', icon: 'ti-mail-check' },
      { key: 'pdf_templates', label: 'Grafica PDF', to: '/grafica-pdf', icon: 'ti-file-type-pdf' },
    ],
  },
  {
    group: 'Amministrazione',
    items: [
      { key: 'users', label: 'Utenti', to: '/utenti', icon: 'ti-id-badge-2' },
      { key: 'roles', label: 'Ruoli', to: '/ruoli', icon: 'ti-shield-half' },
      { key: 'permissions', label: 'Permessi', to: '/permessi', icon: 'ti-lock-cog' },
      { key: 'engine_config', label: 'Parametri', to: '/parametri', icon: 'ti-adjustments' },
      { key: 'audit_logs', label: 'Log attività', to: '/log', icon: 'ti-history' },
      // L'elenco dei lavori e lo storico delle consegne: di default solo admin (13/8).
      { key: 'dev_backlog', label: 'Lavori', to: '/lavori', icon: 'ti-checkup-list' },
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
    try { return localStorage.getItem('metabole_bo_nav') !== 'closed'; } catch { return true; }
  });
  function toggleNav() {
    setNavOpen((o) => {
      const n = !o;
      try { localStorage.setItem('metabole_bo_nav', n ? 'open' : 'closed'); } catch { /* no-op */ }
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
            <img src="/brand/simbolo.png" alt="MetaboleAI" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ flex: 1 }}>
            <b>MetaboleAI</b>
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
      {/* Blocco globale: appuntamenti di ricontatto scaduti da gestire prima di proseguire. */}
      <OverdueGate />
    </div>
  );
}
