/** Moduli "anteprima" della dashboard: riquadri mezza schermata per le pagine abilitate. */
export interface DashboardModule {
  id: string;
  pageKey: string;
  to: string;
  icon: string;
  label: string;
  preview: string;
  /** Chiave dei dati di anteprima (default = pageKey). Serve quando più moduli
   *  condividono lo stesso permesso ma mostrano dati diversi (es. CRM vs Lead da accettare). */
  previewKey?: string;
}

export const DASHBOARD_MODULES: DashboardModule[] = [
  { id: 'm_clienti', pageKey: 'clients', to: '/clienti', icon: 'ti-users', label: 'Clienti', preview: 'Percorsi in corso, schede e progressi dei clienti.' },
  { id: 'm_grafici', pageKey: 'charts', to: '/grafici', icon: 'ti-chart-histogram', label: 'Grafici', preview: 'Fatturato del mese giorno per giorno, kg persi, perdita media e classifiche.' },
  { id: 'm_pagamenti', pageKey: 'accounting', to: '/pagamenti', icon: 'ti-cash', label: 'Bonifici & contabilità', preview: 'Contabili da verificare e incassi.' },
  { id: 'm_crm', pageKey: 'crm_leads', to: '/crm/gestione', icon: 'ti-list-details', label: 'CRM / Lead', preview: 'Lead, pipeline e conversioni.' },
  { id: 'm_lead_accept', pageKey: 'lead_acceptance', previewKey: 'lead_accept', to: '/crm/da-accettare', icon: 'ti-user-check', label: 'Lead da accettare', preview: 'Lead assegnati in attesa di accettazione.' },
  { id: 'm_calendario', pageKey: 'crm_leads', to: '/crm/calendario', icon: 'ti-calendar-event', label: 'Calendario', preview: 'Promemoria e appuntamenti: lista, settimana o mese.' },
  // ⚠️ La descrizione elencava solo i passi della prova: per la nutrizionista, che da oggi apre la
  // stessa pagina, era quattro cose che non sono sue e che in elenco non vedrà mai.
  { id: 'm_attivita_coach', pageKey: 'coach_tasks', to: '/attivita-coach', icon: 'ti-checklist', label: 'Attività da fare', preview: 'Cosa fare e quando: i passi della prova e i fine piano per la coach, le verifiche del digiuno per la nutrizionista.' },
  { id: 'm_agenda', pageKey: 'visits_agenda', to: '/agenda', icon: 'ti-calendar', label: 'Agenda visite', preview: 'Televisite e appuntamenti in programma.' },
  { id: 'm_segnalazioni', pageKey: 'escalations', to: '/segnalazioni', icon: 'ti-alert-triangle', label: 'Segnalazioni', preview: 'Situazioni del motore da gestire.' },
  { id: 'm_diete', pageKey: 'diets_catalog', to: '/diete', icon: 'ti-salad', label: 'Catalogo diete', preview: 'Diete e ricette approvate.' },
  { id: 'm_acquisti', pageKey: 'purchases', to: '/acquisti', icon: 'ti-shopping-cart', label: 'Acquisti', preview: 'Storico acquisti e ricevute.' },
  { id: 'm_compensi', pageKey: 'compensation', to: '/compensi', icon: 'ti-coin', label: 'Compensi staff', preview: 'Provvigioni e compensi del team.' },
  { id: 'm_chat', pageKey: 'chat', to: '/chat', icon: 'ti-messages', label: 'Chat', preview: 'Ultimi messaggi dei clienti.' },
  { id: 'm_posta', pageKey: 'posta', to: '/posta', icon: 'ti-mail', label: 'Posta', preview: 'La tua casella @metabole.eu: posta in arrivo e invio.' },
  { id: 'm_negozio', pageKey: 'shop', to: '/negozio', icon: 'ti-building-store', label: 'Negozio', preview: 'Piani e prodotti in vendita.' },
  { id: 'm_buoni', pageKey: 'discounts', to: '/buoni-sconto', icon: 'ti-ticket', label: 'Buoni sconto', preview: 'Codici attivi e utilizzi.' },
  { id: 'm_contabilita', pageKey: 'accounting_costs', to: '/contabilita', icon: 'ti-report-money', label: 'Contabilità', preview: 'Ultimi movimenti di entrata e uscita.' },
  { id: 'm_provvigioni', pageKey: 'commissions', to: '/provvigioni', icon: 'ti-percentage', label: 'Provvigioni', preview: 'Provvigioni in sospeso da attribuire.' },
  { id: 'm_prelievi', pageKey: 'withdrawals', to: '/prelievi', icon: 'ti-wallet', label: 'Richieste prelievo', preview: 'Richieste di prelievo da evadere.' },
  { id: 'm_testimonianze', pageKey: 'marketing', previewKey: 'testimonials', to: '/testimonianze', icon: 'ti-quote', label: 'Testimonianze', preview: 'Ultime testimonianze dei clienti.' },
  // Contenuti / motore
  { id: 'm_ricette', pageKey: 'recipes', to: '/ricette', icon: 'ti-tools-kitchen-2', label: 'Catalogo ricette', preview: 'Ricette e tag allergeni.' },
  { id: 'm_protocolli', pageKey: 'engine_protocols', to: '/protocolli', icon: 'ti-cpu', label: 'Protocolli motore', preview: 'Protocolli a regole del motore.' },
  { id: 'm_regole_motore', pageKey: 'engine_rules', to: '/regole-motore', icon: 'ti-adjustments-cog', label: 'Regole motore', preview: 'Regole globali, regole suggerite per nutrizione e proposte.' },
  { id: 'm_parametri', pageKey: 'engine_config', to: '/parametri', icon: 'ti-adjustments', label: 'Parametri motore', preview: 'Soglie e parametri del motore.' },
  // Comunicazioni
  { id: 'm_email_modelli', pageKey: 'email_templates', to: '/email-modelli', icon: 'ti-mail-cog', label: 'Modelli email', preview: 'Template delle email automatiche.' },
  { id: 'm_email_log', pageKey: 'email_log', to: '/email-log', icon: 'ti-mail-check', label: 'Log email', preview: 'Email inviate e stato di consegna.' },
  { id: 'm_pdf', pageKey: 'pdf_templates', to: '/grafica-pdf', icon: 'ti-file-type-pdf', label: 'Grafica PDF', preview: 'Template grafici dei PDF.' },
  // Amministrazione
  { id: 'm_utenti', pageKey: 'users', to: '/utenti', icon: 'ti-id-badge-2', label: 'Utenti', preview: 'Staff, ruoli e accessi.' },
  { id: 'm_ruoli', pageKey: 'permissions', to: '/ruoli', icon: 'ti-shield-half', label: 'Ruoli e permessi', preview: 'Ruoli personalizzati e visibilità per ruolo.' },
  { id: 'm_log', pageKey: 'audit_logs', to: '/log', icon: 'ti-history', label: 'Log attività', preview: 'Storico delle azioni dello staff.' },
];

/** Moduli mostrati di default se l'utente non ha ancora personalizzato. */
export const DEFAULT_MODULE_IDS = ['m_clienti', 'm_grafici', 'm_pagamenti', 'm_agenda'];

/** Catalogo dei grafici disponibili nel modulo "Grafici" (max 3 selezionabili). */
export interface ChartMetric {
  key: string;
  label: string;
  unit: 'kg' | 'cm' | 'int' | 'euro';
  color: string;
}
export const CHART_METRICS: ChartMetric[] = [
  { key: 'kgLost', label: 'Kg persi / mese', unit: 'kg', color: 'var(--teal)' },
  { key: 'cmWaistLost', label: 'Cm vita persi / mese', unit: 'cm', color: '#3A6EA5' },
  { key: 'avgLossKg', label: 'Perdita media / cliente', unit: 'kg', color: 'var(--teal)' },
  { key: 'newClients', label: 'Nuovi clienti / mese', unit: 'int', color: 'var(--violet)' },
  { key: 'activeSubscriptions', label: 'Abbonamenti attivi', unit: 'int', color: 'var(--teal)' },
  { key: 'revenueCents', label: 'Fatturato / mese', unit: 'euro', color: 'var(--gold)' },
  { key: 'cumulativeRevenueCents', label: 'Fatturato cumulato', unit: 'euro', color: 'var(--gold)' },
];
export const DEFAULT_CHART_KEYS = ['kgLost', 'revenueCents', 'newClients'];

/**
 * LE SCORCIATOIE DI FABBRICA della dashboard admin.
 *
 * ⚠️ Stavano dentro `pages/Dashboard.tsx`, che le esporta ancora per chi le importava da lì. Sono
 * salite qui il 19/8 sera per una ragione sola: **«Ripristina default» deve poterle rimettere**, e
 * un file di libreria che importa da una pagina è il verso sbagliato — la pagina dipende dalla
 * libreria, non il contrario.
 */
export const DEFAULT_SHORTCUT_IDS = ['creazione_validazione', 'clienti', 'crm_gestione', 'pagamenti', 'agenda', 'utenti', 'permessi'];

/** Le quattro preferenze che compongono l'aspetto della home. */
export interface HomeDiFabbrica {
  dashboardModules: string[];
  dashboardBlocksOff: string[];
  dashboardCharts: string[];
  dashboardShortcuts: string[];
}

/**
 * COM'ERA LA HOME APPENA CREATO L'ACCOUNT — tutte e quattro le preferenze, non una.
 *
 * ⚠️ Nasce da un difetto trovato il 19/8 sera rileggendo la richiesta di Simone: «se un utente si è
 * perso preme il pulsante (ripristina default) e noi provvediamo». Il pulsante c'era **e rimetteva
 * solo i moduli**: chi si era perso spegnendo il portafoglio, gli avvisi o la tabella clienti — che
 * si salvano in `dashboardBlocksOff`, un elenco separato — premeva «Ripristina default» e **non
 * tornava niente**. ⛔ Un pulsante di soccorso che soccorre un terzo dei casi è peggio di nessun
 * pulsante: chi lo preme e non vede tornare la sua roba conclude che non si può più recuperare.
 *
 * ⚠️ **I moduli si filtrano su quelli che quel ruolo può vedere.** Il default è uno e globale, e
 * contiene id che un coach non ha il permesso di aprire: rimetterli tutti salverebbe nelle sue
 * preferenze righe morte — invisibili, ma che restano lì e riemergono il giorno che il permesso
 * arriva. Chi chiama passa l'elenco di quello che vede.
 *
 * ⚠️ **Le scorciatoie si riscrivono per esteso, non si azzerano.** Chi le legge fa
 * `prefs.dashboardShortcuts ?? DEFAULT`, e un array **vuoto** non è nullo: salvare `[]` vorrebbe
 * dire una dashboard senza nessuna scorciatoia, cioè l'opposto di «ripristina».
 *
 * ⛔ **L'ordine del menu NON è qui, ed è voluto.** Ha il suo pulsante «Reimposta» nel suo riquadro,
 * a tre centimetri da questo: rimetterlo anche da qui vorrebbe dire che un pulsante fa una cosa che
 * il suo testo non dice, e la prima volta che succede nessuno capisce perché il menu è cambiato.
 */
export function homeDiFabbrica(): HomeDiFabbrica {
  return {
    /**
     * ⚠️ **NON si filtrano sui permessi, e stamattina lo facevo** — corretto il 19/8 sera dopo la
     * revisione avversariale, che ha mostrato due modi in cui il filtro peggiorava le cose:
     *
     * ⛔ Una coach senza il permesso «Bonifici» premeva il pulsante e si salvava una lista **senza**
     * quel modulo. Il giorno che il permesso arrivava, il modulo **non tornava più**: il filtro
     * aveva reso permanente una restrizione che prima era dinamica (il rendering filtra già a ogni
     * caricamento, quindi il modulo compariva da solo).
     * ⛔ E un ruolo che non vedesse nessuno dei quattro predefiniti si sarebbe salvato `[]` — che
     * **non è nullo**, quindi il ripiego `?? DEFAULT` non scatta più: home vuota, per sempre. È la
     * stessa trappola che il commento qui sotto documenta per le scorciatoie, e ci ero cascato tre
     * righe più su.
     *
     * ⚠️ Chi filtra è la **lettura**, non la scrittura: la preferenza dice cosa vuole la persona, il
     * permesso dice cosa può vedere oggi, e sono due cose che cambiano per ragioni diverse.
     */
    dashboardModules: [...DEFAULT_MODULE_IDS],
    // I blocchi nascono ACCESI e si spengono: «tutti accesi» è l'elenco degli spenti vuoto.
    dashboardBlocksOff: [],
    dashboardCharts: [...DEFAULT_CHART_KEYS],
    dashboardShortcuts: [...DEFAULT_SHORTCUT_IDS],
  };
}

/**
 * I BLOCCHI FISSI DELLA HOME — quelli che non sono riquadri-anteprima ma parti scritte nella pagina.
 *
 * Richiesta di Simone dell'11/8: «tutti i moduli della dashboard, anche portafoglio ecc, devono
 * essere attivabili e disattivabili da impostazioni moduli dashboard, così ogni persona si
 * personalizza la dashboard». I riquadri sopra (`DASHBOARD_MODULES`) erano già gestibili; il
 * portafoglio, gli avvisi, la tabella clienti e gli altri no, perché non sono moduli: sono blocchi
 * disegnati dentro `CoachHome` e `NutritionistHome`.
 *
 * ## Perché una preferenza «spenti» e non «accesi»
 *
 * I moduli funzionano a inclusione: se l'id non è nella lista salvata, il riquadro non c'è. Questi no,
 * e non possono: oggi si vedono tutti, e chi ha già personalizzato la dashboard ha una lista salvata
 * che — ovviamente — non contiene id che ieri non esistevano. Aggiungerli lì vorrebbe dire che domani
 * mattina le coach aprono e non trovano più il portafoglio né le loro clienti. Quindi
 * `dashboardBlocksOff`: un elenco di esclusioni, vuoto per tutti, e ognuno ci mette dentro quello che
 * non vuole vedere.
 */
export interface DashboardBlocco {
  id: string;
  label: string;
  /** Cosa mostra, per la pagina Impostazioni. */
  descrizione: string;
  /** Su quali home compare: serve a non elencare a una nutrizionista blocchi che non ha. */
  home: ('coach' | 'nutritionist')[];
}

export const DASHBOARD_BLOCCHI: DashboardBlocco[] = [
  { id: 'b_portafoglio', label: 'Il mio portafoglio', descrizione: 'Maturato, saldo disponibile e richiesta di pagamento.', home: ['coach', 'nutritionist'] },
  { id: 'b_scorciatoie', label: 'Scorciatoie', descrizione: 'I pulsanti rapidi in cima alla home.', home: ['coach', 'nutritionist'] },
  { id: 'b_kpi', label: 'Numeri in cima', descrizione: 'I riquadri con i conteggi: clienti, avvisi, scadenze, documenti.', home: ['coach', 'nutritionist'] },
  { id: 'b_lead_attesa', label: 'Lead da accettare', descrizione: 'I lead assegnati a te in attesa di risposta. Compare solo quando ce n\'è almeno uno.', home: ['coach'] },
  { id: 'b_avvisi', label: 'Avvisi', descrizione: 'Le situazioni da guardare oggi, segnalate dal motore.', home: ['coach'] },
  { id: 'b_invito', label: 'Il mio link d\'invito', descrizione: 'Il tuo ref code e il link di registrazione da condividere.', home: ['coach'] },
  { id: 'b_scadenze', label: 'Piani in scadenza', descrizione: 'Chi arriva a fine percorso nei prossimi giorni.', home: ['coach'] },
  { id: 'b_clienti', label: 'Le mie clienti', descrizione: 'La tabella con piano, ultima misura e avvisi.', home: ['coach'] },
  { id: 'b_da_validare', label: 'Da validare', descrizione: 'Decisioni del motore, diete e protocolli in attesa della tua approvazione.', home: ['nutritionist'] },
  { id: 'b_pazienti', label: 'Pazienti', descrizione: 'I pazienti che richiedono attenzione, con escalation e documenti aperti.', home: ['nutritionist'] },
  { id: 'b_regole_motore', label: 'Regole del motore', descrizione: 'Il collegamento alle regole del motore (solo capo nutrizioniste).', home: ['nutritionist'] },
  /**
   * ⚠️ L'assistente sta fra i BLOCCHI e non fra i moduli, e la differenza non è cosmetica.
   *
   * Simone (13/8) lo vuole «acceso di default per nutrizionista e capo nutrizionista». I moduli
   * funzionano a inclusione: chi ha già personalizzato la dashboard ha una lista salvata che — per
   * forza — non contiene un id nato oggi, quindi proprio le persone che usano di più il backoffice
   * sarebbero le uniche a non vederlo mai. I blocchi funzionano a esclusione: si vedono, e chi non
   * li vuole li spegne. È la stessa ragione per cui `dashboardBlocksOff` esiste.
   *
   * `home: ['nutritionist']` fa da filtro di ruolo da solo: quella home la aprono `nutritionist` e
   * `head_nutritionist` e nessun altro (`pages/Home.tsx`).
   */
  { id: 'b_assistente', label: 'L\'assistente', descrizione: 'Quello che aspetta te: proposte da approvare, domande aperte, sostituzioni da verificare.', home: ['nutritionist'] },
];
