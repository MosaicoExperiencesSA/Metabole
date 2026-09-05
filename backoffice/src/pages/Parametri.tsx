import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Spinner, Toggle } from '../components/ui';
import { ROLE_LABEL, type Role } from '../lib/labels';

interface Param {
  key: string;
  value: string;
  type: string;
  description: string | null;
  updatedAt: string;
}

/**
 * ⚠️ `staff`: una tendina che sceglie una PERSONA dello staff e salva il suo staff id. Nasce con
 * «Coach di riserva» (4/9): un id copiato a mano in una casella di testo non è «una casella da
 * cambiare», è un modo per sbagliare persona senza accorgersene.
 */
type Kind = 'number' | 'text' | 'textarea' | 'toggle' | 'select' | 'euro' | 'staff';

interface Meta {
  label: string;
  group: string;
  help?: string;
  kind: Kind;
  unit?: string;
  options?: { value: string; label: string }[];
  /** Solo per `kind: 'staff'`: i ruoli fra cui si può scegliere. */
  ruoli?: string[];
}

// Etichette e raggruppamento leggibili per ogni parametro.
const META: Record<string, Meta> = {
  payment_method_card_enabled: { label: 'Pagamento con carta (Stripe)', group: 'Pagamenti', kind: 'toggle', help: 'Se attivo, le clienti possono pagare con carta al checkout dell’app.' },
  payment_method_bank_enabled: { label: 'Pagamento con bonifico', group: 'Pagamenti', kind: 'toggle', help: 'Se attivo, le clienti possono pagare con bonifico (estremi via email).' },

  bank_transfer_details: { label: 'Estremi del bonifico', group: 'Bonifico', kind: 'textarea', help: 'Testo inviato via email alla cliente per pagare con bonifico (intestatario, IBAN, BIC…).' },

  // Le voci della tendina «Con cosa» dei costi in Contabilità. Stanno qui e non in un elenco fisso
  // nel codice perché il modo di pagare un fornitore cambia — una carta nuova, un conto chiuso — e
  // aggiungerne uno non deve richiedere un rilascio.
  cost_payment_methods: { label: 'Con cosa si paga', group: 'Contabilità', kind: 'textarea', help: 'Le scelte della tendina «Con cosa» quando registri un costo in Contabilità: una voce per riga (es. «Carta aziendale», «Bonifico dal conto»). Le voci già usate nei costi registrati non cambiano nome se le modifichi qui.' },

  // Niente provvigioni in questa pagina, ed è voluto: dal 14/07 sono importi in € definiti su ogni
  // piano/prodotto in Gestione negozio. L'ultima voce rimasta qui era «Compenso per visita»,
  // togliata l'11/8 insieme al compenso stesso (vedi `FinanceService`): un parametro che non decide
  // più niente è peggio di un parametro assente, perché chi lo cambia crede di aver cambiato qualcosa.

  water_ml_per_kg: { label: 'Acqua per kg di peso', group: 'Obiettivi cliente', kind: 'number', unit: 'ml/kg', help: 'Personalizza l’obiettivo acqua sul peso della cliente (30-35 tipico). Obiettivo = peso × ml/kg ÷ 250 ml (bicchiere), limitato 6-16 bicchieri (1,5-4 L).' },
  water_goal_glasses: { label: 'Obiettivo acqua (ripiego)', group: 'Obiettivi cliente', kind: 'number', unit: 'bicchieri/giorno', help: 'Usato solo quando il peso della cliente non è ancora noto. Altrimenti l’obiettivo è personalizzato sul peso.' },
  steps_goal: { label: 'Obiettivo passi', group: 'Obiettivi cliente', kind: 'number', unit: 'passi/giorno' },

  // CHI PRENDE IN CARICO CHI RESTA SENZA NESSUNO. Due regole gemelle (vedi
  // `common/nutrizionista-di-riferimento.ts` e `common/coach-di-riserva.ts`): riempiono solo il
  // vuoto, non spostano mai nessuno.
  coach_di_riserva: {
    label: 'Coach di riserva', group: 'Presa in carico', kind: 'staff', ruoli: ['coach', 'coach_coordinator', 'sales'],
    help: 'Chi prende in carico le clienti rimaste senza coach: al questionario, quando si toglie la coach a mano, e ogni notte per tutte le altre. Riempie solo il vuoto — chi ha già una coach non si tocca. «Nessuna» spegne la regola. Può essere anche una commerciale.',
  },
  assign_head_nutritionist_by_default: {
    label: 'Il capo nutrizionista prende chi resta senza nutrizionista', group: 'Presa in carico', kind: 'toggle',
    help: 'Finché è acceso, chi finisce il questionario senza una nutrizionista viene presa in carico dal capo nutrizionista. Ha senso finché la nutrizionista è una sola: quando diventano più d’una, spegnilo e assegna dal backoffice.',
  },
  alert_gestito_giorni: {
    label: 'Alert «gestito»: dopo quanti giorni torna in lista', group: 'Motore · monitoraggio', kind: 'number', unit: 'giorni',
    help: 'Un alert segnato «gestito» che non ha risolto niente (la cliente è ancora nella stessa situazione) torna in lista dopo questi giorni. Gli alert inoltrati a qualcun altro non si toccano.',
  },

  agent_default_model: { label: 'Modello di default', group: 'Agenti AI', kind: 'text', help: 'Modello Claude usato dagli agenti ad alto volume (es. claude-haiku-4-5). Cambia senza redeploy.' },
  agent_judge_model: { label: 'Modello del Giudice', group: 'Agenti AI', kind: 'text', help: 'Modello Claude del Giudice compliance (es. claude-sonnet-5): qualità di giudizio sui contenuti.' },
  agent_default_budget_cents: { label: 'Budget mensile default per agente', group: 'Agenti AI', kind: 'euro', help: 'Tetto di spesa mensile assegnato ai nuovi agenti (0 = nessun tetto).' },

  sustainable_rate_max_kg_week: { label: 'Ritmo sostenibile massimo', group: 'Motore · ritmo e sicurezza', kind: 'number', unit: 'kg/sett.', help: 'Oltre questo ritmo l’obiettivo è considerato ambizioso.' },
  ambitious_rate_max_kg_week: { label: 'Ritmo ambizioso massimo', group: 'Motore · ritmo e sicurezza', kind: 'number', unit: 'kg/sett.', help: 'Oltre questo ritmo l’obiettivo è irreale.' },
  min_daily_kcal: { label: 'Calorie minime giornaliere', group: 'Motore · ritmo e sicurezza', kind: 'number', unit: 'kcal' },
  max_weight_change_alert_kg_week: { label: 'Variazione peso da allertare', group: 'Motore · ritmo e sicurezza', kind: 'number', unit: 'kg/sett.', help: 'Sopra questa variazione scatta l’alert al nutrizionista.' },
  unreal_objective_action: {
    label: 'Obiettivo irreale: cosa fare', group: 'Motore · ritmo e sicurezza', kind: 'select',
    options: [
      { value: 'warn', label: 'Avvisa soltanto' },
      { value: 'block_propose_date', label: 'Blocca e proponi una data' },
      { value: 'require_nutritionist', label: 'Richiedi il nutrizionista' },
    ],
  },
  low_energy_chronic_threshold: { label: 'Soglia energia bassa cronica', group: 'Motore · ritmo e sicurezza', kind: 'number', unit: 'media 1-5' },

  moving_average_window: { label: 'Finestra media mobile', group: 'Motore · monitoraggio', kind: 'number', unit: 'rilevazioni' },
  stall_days_before_coach_alert: { label: 'Giorni di stallo prima dell’alert', group: 'Motore · monitoraggio', kind: 'number', unit: 'giorni' },
  no_checkin_days_before_alert: { label: 'Giorni senza check-in prima dell’alert', group: 'Motore · monitoraggio', kind: 'number', unit: 'giorni' },
  pause_deviation_trigger: { label: 'Scostamento che attiva il mini-piano', group: 'Motore · monitoraggio', kind: 'number', unit: 'kg/cm' },
  low_rating_threshold_stars: { label: 'Soglia stelle ricetta poco gradita', group: 'Motore · monitoraggio', kind: 'number', unit: 'stelle' },

  menu_days_delivered: { label: 'Giorni di menu erogati per volta', group: 'Menu', kind: 'number', unit: 'giorni' },
  menu_visible_days_before_start: { label: 'Menu visibile prima dell’inizio', group: 'Menu', kind: 'number', unit: 'giorni' },

  // I PANIERI (piano panieri, agosto-settembre 2026). Stavano in fondo alla pagina sotto «Altro»,
  // con la chiave grezza: un parametro che decide da dove arrivano i piatti di una cliente non può
  // essere l'unico della pagina che nessuno sa leggere.
  panieri_sorgente_pool: {
    label: 'Da dove arrivano i piatti di una cliente', group: 'Menu · panieri', kind: 'select',
    options: [
      { value: 'giornate', label: 'Dalle giornate della sua dieta (come prima)' },
      { value: 'paniere', label: 'Dal paniere famiglia × regime (nuovo)' },
    ],
    help: 'Il paniere raccoglie i piatti di tutte le varianti della stessa famiglia e regime: molta più scelta per la stessa cliente. Si torna indietro rimettendo «dalle giornate», senza rilascio — il valore vale entro un minuto.',
  },
  menu_daycombo_allargamento_passo_pct: {
    label: 'Banda calorie: di quanto si allarga per volta', group: 'Menu · panieri', kind: 'number', unit: 'punti %',
    help: 'Quando nessuna combinazione di piatti entra nella banda del target, la banda si allarga di tanti punti alla volta finché una giornata ci entra. ZERO spegne del tutto l’allargamento e riporta al comportamento di prima.',
  },
  menu_daycombo_allargamento_tetto_pct: {
    label: 'Banda calorie: quanto può allargarsi in tutto', group: 'Menu · panieri', kind: 'number', unit: 'punti %',
    help: 'Il limite. Oltre questo non si compone: si ripiega sulla giornata pre-costruita. Serve perché una banda che si allarga finché qualcosa entra prima o poi compone una giornata fuori target dicendo di aver rispettato la regola. Ogni allargamento è scritto sulla giornata.',
  },
  menu_coppia_pranzo_cena_giorni: {
    label: 'La coppia pranzo/cena non si ripete per', group: 'Menu · panieri', kind: 'number', unit: 'giorni',
    help: 'Se oggi a pranzo c’è la pasta al pomodoro e a cena il branzino, per tanti giorni quella coppia non torna — anche se i due piatti, presi da soli, potrebbero. ZERO spegne la regola. Se il paniere è piccolo e non restano coppie nuove, la giornata si compone lo stesso e finisce nei log.',
  },

  menu_carne_max_a_settimana: {
    label: 'Carne al massimo, a settimana', group: 'Menu · panieri', kind: 'number', unit: 'volte',
    help: 'La regola flexitariana: pesca dal paniere onnivoro ma la carne è limitata. ZERO vuol dire nessun limite, NON «mai carne» — e zero è il valore giusto per le diete onnivore. Si accende sulle Flessibili da «Regole motore», dieta per dieta. La settimana è scorrevole (gli ultimi 7 giorni), non quella del calendario.',
  },

  // «RITORNO IN EQUILIBRIO»: il mese composto dal passato della cliente (§6.1).
  ritorno_in_equilibrio_acceso: {
    label: 'Ritorno in Equilibrio', group: 'Menu · panieri', kind: 'toggle',
    help: 'Per chi ha già fatto un percorso: un mese di menu scelti fra i suoi piatti che hanno dato i risultati migliori E che le sono piaciuti di più. Il paniere non c\'entra: i piatti vengono dal suo passato. Si accende solo quando qualcuno ha guardato quante clienti ci stanno sopra e quanto storico hanno.',
  },
  ritorno_in_equilibrio_giornate_minime: {
    label: 'Ritorno in Equilibrio: storico minimo', group: 'Menu · panieri', kind: 'number', unit: 'giornate',
    help: 'Sotto questa soglia la funzione NON si attiva e la cliente resta sul paniere normale, che è pieno. Un mese costruito su quattro giornate sono quattro giornate girate sette volte: la promessa non regge, e chi la riceve se ne accorge mangiando.',
  },

  // L'OMAGGIO DI RIENTRO durante la pausa (richiesta di Simone, 27/8).
  pause_omaggio_giorni: {
    label: 'Giornate regalate se ingrassa in pausa', group: 'Menu · panieri', kind: 'number', unit: 'giornate',
    help: 'Mentre è in pausa la cliente si pesa quando vuole. Se risulta salita oltre la soglia (Kg di rientro), le arrivano queste giornate scelte fra quelle che su di lei hanno funzionato meglio — una volta al mese, e la pausa resta. Non è il kit di fine monitoraggio, che ha il numero suo.',
  },

  // L'AGENTE CHE SCRIVE COLAZIONI, SPUNTINI E MERENDE quando mancano (31/8).
  agente_leggeri_acceso: {
    label: 'Agente colazioni e spuntini', group: 'Menu · panieri', kind: 'toggle',
    help: 'Di notte scrive BOZZE di colazioni, spuntini e merende per i panieri che ne hanno poche. Le ricette nascono SPENTE e senza allergeni confermati: nessuna arriva a una cliente finché non la approva una nutrizionista.',
  },
  agente_leggeri_max: {
    label: 'Quante ne scrive per notte', group: 'Menu · panieri', kind: 'number', unit: 'ricette',
    help: 'Ogni ricetta è una chiamata all’AI e un pezzo di coda di approvazione. Il freno vero non è questo numero: è quante ne approvate voi.',
  },

  // L'AGENTE ALIMENTI: allergeni e valori nutrizionali cercati in rete (Simone, 5/9).
  // L'ALLARME SUL SALTO DI PESO — deciso dalla nutrizionista responsabile il 5/9.
  weight_jump_alert_kg: {
    label: 'Salto di peso che fa scattare un allarme', group: 'Motore · ritmo e sicurezza', kind: 'number', unit: 'kg',
    help: 'Chili persi fra due pesate consecutive che aprono una segnalazione clinica a coach e nutrizionista. Deciso da Lucia il 5/9 («salto improvviso oltre 4 kg»), insieme al ritmo di 1,5 kg a settimana che sta nella casella del calo rapido. ⚠️ Non è la soglia delle pesate impossibili (10 kg): quella decide se fidarsi del numero per calcolare il fabbisogno, questa se avvisare una persona. Il caso che copre: chi sospende, sta ferma un mese e torna con venti chili in meno.',
  },

  agente_alimenti_acceso: {
    label: 'Agente alimenti (allergeni e valori dalla rete)', group: 'AI', kind: 'toggle',
    help: 'Di notte prende i nomi di ingrediente che le ricette usano e la tabella alimenti non ha, cerca in rete allergeni e valori per 100 g con la fonte, e scrive la riga. La riga vale SUBITO — Gaia la cita e le ricette con quell’ingrediente prendono i tag allergene la notte stessa — e resta nella coda «da confermare» di Valori nutrizionali, con la fonte accanto. Ogni alimento è una chiamata all’AI con ricerche in rete, che si pagano a parte.',
  },
  agente_alimenti_max: {
    label: 'Quanti alimenti per notte', group: 'AI', kind: 'number', unit: 'alimenti',
    help: 'Fino a tre ricerche in rete per alimento: venti per notte sono al massimo sessanta ricerche. Un alimento bocciato dal vaglio (senza fonte, numeri che non tornano, allergene fuori elenco, valori copiati) non si richiede per trenta giorni.',
  },

  marketing_require_consent: { label: 'Campagne solo con consenso esplicito', group: 'Marketing', kind: 'toggle', help: 'Se acceso, dalle campagne sono esclusi i lead che non hanno mai dato un consenso esplicito (chi ha detto NO è escluso sempre, in ogni caso). Va acceso PRIMA di lavorare lo storico importato.' },

  app_store_url: { label: 'Link App Store', group: 'App', kind: 'text', help: 'Usato dai pulsanti “Scarica” nelle email.' },
  play_store_url: { label: 'Link Google Play', group: 'App', kind: 'text', help: 'Usato dai pulsanti “Scarica” nelle email.' },

  ai_composer_enabled: { label: 'Layer AI per le notifiche', group: 'AI', kind: 'toggle', help: 'Se attivo (e con AI_API_KEY su Render) i testi delle notifiche vengono riformulati da Claude; il tono resta deciso dal motore.' },
  ai_assistant_enabled: { label: 'Assistente AI in chat', group: 'AI', kind: 'toggle', help: 'Se attivo (e con AI_API_KEY su Render) l’assistente risponde con Claude ai messaggi generici; i temi sensibili/sanitari restano instradati al nutrizionista.' },
};

/**
 * L'ordine in cui compaiono i riquadri. Non è l'elenco di cosa si vede: vedi `grouped` più sotto,
 * dove i gruppi non citati qui finiscono in fondo invece di sparire.
 */
const GROUP_ORDER = ['Pagamenti', 'Bonifico', 'Contabilità', 'Provvigioni e compensi', 'Obiettivi cliente', 'Presa in carico', 'Motore · ritmo e sicurezza', 'Motore · monitoraggio', 'Menu', 'Menu · panieri', 'Agenti AI', 'Marketing', 'App', 'AI', 'Altro'];

const metaFor = (p: Param): Meta =>
  META[p.key] ?? { label: p.key, group: 'Altro', kind: 'text', help: p.description ?? undefined };

export function Parametri() {
  const [params, setParams] = useState<Param[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  // Creazione di un parametro che il seed non ha mai inserito: finora l'unico modo era
  // aggiungere la chiave al seed e fare un deploy, e finché non succedeva il motore usava
  // un default scritto nel codice senza dirlo a nessuno.
  const [nuovo, setNuovo] = useState<{ key: string; value: string; type: string; description: string } | null>(null);
  const [creando, setCreando] = useState(false);
  // Le persone dello staff, per le tendine `kind: 'staff'`. Si caricano una volta, con i parametri.
  const [staff, setStaff] = useState<{ id: string; name: string; role: string }[]>([]);

  async function load() {
    setLoading(true);
    try {
      const list = await api<Param[]>('/admin/config');
      setParams(list);
      setDraft(Object.fromEntries(list.map((p) => [p.key, p.value])));
      if (list.some((p) => metaFor(p).kind === 'staff')) {
        try {
          type StaffUser = { role: string; status: string; staff: { id: string; displayName: string } | null };
          const r = await api<{ items: StaffUser[] }>('/admin/users?scope=staff&limit=200');
          setStaff(r.items.filter((u) => u.staff && u.status === 'active').map((u) => ({ id: u.staff!.id, name: u.staff!.displayName, role: u.role })));
        } catch {
          /* senza l'elenco la tendina mostra solo «nessuna» e il valore salvato: si può ancora spegnere la regola */
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può gestire i parametri.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  /** Le persone fra cui una tendina `staff` può scegliere: lo staff attivo, filtrato per i ruoli della voce. */
  const scelteStaff = (m: Meta) => staff.filter((u) => !m.ruoli || m.ruoli.includes(u.role));

  const grouped = useMemo(() => {
    const by: Record<string, Param[]> = {};
    for (const p of params) {
      const g = metaFor(p).group;
      (by[g] ??= []).push(p);
    }
    /**
     * Prima qui c'era solo `GROUP_ORDER.filter(...)`: un parametro il cui gruppo non era in
     * quell'elenco **non compariva da nessuna parte**, senza errori. È esattamente quello che è
     * successo a «Con cosa si paga» (gruppo «Contabilità», mai aggiunto all'ordine): il valore era
     * nel database, l'etichetta era nel codice, la tendina in Contabilità restava vuota e in
     * Parametri non c'era niente da correggere. Segnalato da Simone l'11/8.
     *
     * Ora l'ordine decide solo **dove** sta un riquadro: i gruppi che non nomina finiscono in coda
     * (prima di «Altro», che per convenzione è l'ultimo). Un parametro nuovo si vede sempre.
     */
    const noti = new Set(GROUP_ORDER);
    const inCoda = Object.keys(by).filter((g) => !noti.has(g)).sort();
    const ordine = [...GROUP_ORDER.filter((g) => g !== 'Altro'), ...inCoda, 'Altro'];
    return ordine.filter((g) => by[g]?.length).map((g) => ({ group: g, items: by[g] }));
  }, [params]);

  async function save(p: Param) {
    const value = (draft[p.key] ?? '').toString();
    if (!value.trim() && metaFor(p).kind !== 'textarea') { setError('Il valore non può essere vuoto.'); return; }
    if (!confirm(`Salvare il nuovo valore di “${metaFor(p).label}”?`)) return;
    setSavingKey(p.key);
    setError(null);
    setNotice(null);
    try {
      const updated = await api<Param>(`/admin/config/${p.key}`, { method: 'PATCH', body: JSON.stringify({ value }) });
      setParams((ps) => ps.map((x) => (x.key === p.key ? { ...x, value: updated.value, updatedAt: updated.updatedAt } : x)));
      setNotice(`“${metaFor(p).label}” aggiornato.`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setSavingKey(null);
    }
  }

  async function crea() {
    if (!nuovo) return;
    setCreando(true);
    setError(null);
    setNotice(null);
    try {
      await api<Param>('/admin/config', { method: 'POST', body: JSON.stringify(nuovo) });
      setNuovo(null);
      await load();
      setNotice(`Parametro “${nuovo.key}” creato.`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Creazione non riuscita.');
    } finally {
      setCreando(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <p className="hint" style={{ marginTop: 0 }}>
          Modifica gli estremi del bonifico e le soglie del motore senza toccare il codice. Ogni valore si salva singolarmente.
        </p>
        {!nuovo && (
          <button className="btn ghost" onClick={() => setNuovo({ key: '', value: '', type: 'number', description: '' })}>
            <i className="ti ti-plus" /> Nuovo parametro
          </button>
        )}
      </div>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {nuovo && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Nuovo parametro</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            Serve quando il codice legge una chiave che a database non c'è ancora: finché la riga manca,
            il valore usato è quello scritto nel codice. La <b>chiave</b> deve essere identica a quella che
            il codice cerca — se non lo è, questa riga non la userà nessuno.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
            <label className="field" style={{ margin: 0 }}>
              <span>Chiave</span>
              <input className="input" style={{ fontFamily: 'monospace' }} value={nuovo.key}
                onChange={(e) => setNuovo({ ...nuovo, key: e.target.value.trim() })} placeholder="es. menu_days_delivered" />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span>Valore</span>
              <input className="input" value={nuovo.value} onChange={(e) => setNuovo({ ...nuovo, value: e.target.value })} placeholder="es. 2" />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span>Tipo</span>
              <select className="select" value={nuovo.type} onChange={(e) => setNuovo({ ...nuovo, type: e.target.value })}>
                <option value="number">Numero</option>
                <option value="string">Testo</option>
                <option value="boolean">Acceso/spento</option>
                <option value="json">JSON</option>
              </select>
            </label>
            <label className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <span>Descrizione</span>
              <input className="input" value={nuovo.description} onChange={(e) => setNuovo({ ...nuovo, description: e.target.value })}
                placeholder="A cosa serve, in una riga: la leggerà chi lo trova fra un anno." />
            </label>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button className="btn ghost" onClick={() => setNuovo(null)} disabled={creando}>Annulla</button>
            <button className="btn" onClick={crea} disabled={creando || !nuovo.key || !nuovo.value}>{creando ? 'Creo…' : 'Crea parametro'}</button>
          </div>
        </div>
      )}

      {grouped.map(({ group, items }) => (
        <div className="card" key={group}>
          <h2 style={{ marginTop: 0 }}>{group}</h2>
          {items.map((p) => {
            const m = metaFor(p);
            const dirty = (draft[p.key] ?? '') !== p.value;
            const set = (v: string) => setDraft((d) => ({ ...d, [p.key]: v }));
            const unitText = m.kind === 'euro' ? '€' : m.unit ?? '';
            return (
              <div key={p.key} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <b style={{ fontSize: 14 }}>{m.label}</b>
                    {m.help && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{m.help}</div>}
                  </div>
                  {/* Controllo allineato in colonna: campo (larghezza fissa) · unità · Salva */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 'none' }}>
                    <div style={{ width: 190, display: 'flex', justifyContent: 'flex-end' }}>
                      {m.kind === 'textarea' ? null : m.kind === 'toggle' ? (
                        <Toggle on={(draft[p.key] ?? 'false') === 'true'} onChange={(on) => set(on ? 'true' : 'false')} />
                      ) : m.kind === 'select' ? (
                        <select className="select" value={draft[p.key] ?? ''} onChange={(e) => set(e.target.value)} style={{ width: '100%' }}>
                          {m.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : m.kind === 'staff' ? (
                        <select className="select" value={draft[p.key] ?? 'off'} onChange={(e) => set(e.target.value)} style={{ width: '100%' }}>
                          <option value="off">— nessuna: regola spenta —</option>
                          {scelteStaff(m).map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role as Role] ?? u.role}</option>)}
                          {/* Il valore salvato non è fra le persone che si possono scegliere (sospesa, ruolo cambiato, elenco non caricato): si mostra lo stesso, con la chiave, così non sparisce in silenzio dietro «regola spenta». ⚠️ Si confronta con l'elenco FILTRATO per ruolo, non con tutto lo staff: una revisione ha visto che altrimenti il ruolo cambiato era proprio il caso che non si vedeva. */}
                          {draft[p.key] && draft[p.key] !== 'off' && !scelteStaff(m).some((u) => u.id === draft[p.key]) && (
                            <option value={draft[p.key]}>⚠️ {draft[p.key]} (non è più fra le persone che si possono scegliere)</option>
                          )}
                        </select>
                      ) : m.kind === 'euro' ? (
                        <input
                          className="input" type="number" step="0.01" min="0" style={{ width: '100%' }}
                          value={(Number(draft[p.key] ?? '0') / 100).toString()}
                          onChange={(e) => set(String(Math.round((parseFloat(e.target.value) || 0) * 100)))}
                        />
                      ) : (
                        <input
                          className="input" type={m.kind === 'number' ? 'number' : 'text'} step="any" style={{ width: '100%' }}
                          value={draft[p.key] ?? ''} onChange={(e) => set(e.target.value)}
                        />
                      )}
                    </div>
                    <span className="muted" style={{ width: 64, fontSize: 12 }}>{unitText}</span>
                    <button className="btn sm" style={{ width: 74, justifyContent: 'center' }} onClick={() => save(p)} disabled={!dirty || savingKey === p.key}>
                      {savingKey === p.key ? '…' : 'Salva'}
                    </button>
                  </div>
                </div>
                {m.kind === 'textarea' && (
                  <textarea
                    className="input" style={{ width: '100%', minHeight: 120, marginTop: 10, resize: 'vertical', fontFamily: 'inherit' }}
                    value={draft[p.key] ?? ''} onChange={(e) => set(e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}

      <RegimiEditor />
    </>
  );
}

interface RegimeRow { code: string; label: string }

/** Editor dei regimi alimentari (configurazione di base, solo admin). */
function RegimiEditor() {
  const [rows, setRows] = useState<RegimeRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function load() {
    api<{ regimes: RegimeRow[] }>('/catalog/taxonomy')
      .then((t) => setRows(t.regimes ?? []))
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Caricamento non riuscito.'));
  }
  useEffect(load, []);

  const setRow = (i: number, patch: Partial<RegimeRow>) =>
    setRows((rs) => (rs ? rs.map((r, j) => (j === i ? { ...r, ...patch } : r)) : rs));
  const add = () => setRows((rs) => [...(rs ?? []), { code: '', label: '' }]);
  const remove = (i: number) => setRows((rs) => (rs ? rs.filter((_, j) => j !== i) : rs));

  async function save() {
    if (!rows) return;
    const clean = rows.filter((r) => r.code.trim());
    if (clean.length === 0) { setErr('Serve almeno un regime.'); return; }
    setBusy(true); setErr(null); setMsg(null);
    try {
      await api('/catalog/regimes', { method: 'PATCH', body: JSON.stringify({ regimes: clean }) });
      setMsg('Regimi salvati.');
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Regimi alimentari</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        I regimi disponibili nei form di diete e ricette. Il <b>codice</b> è tecnico (minuscolo, senza spazi); l'<b>etichetta</b> è ciò che vedono gli operatori. Modificare un codice già in uso non rinomina i dati esistenti.
      </p>
      {err && <Banner kind="err">{err}</Banner>}
      {msg && <Banner kind="ok">{msg}</Banner>}
      {!rows ? (
        <Spinner />
      ) : (
        <>
          <div style={{ display: 'grid', gap: 8 }}>
            {rows.map((r, i) => (
              <div key={i} className="row" style={{ gap: 8, alignItems: 'center' }}>
                <input className="input" style={{ width: 180 }} placeholder="codice (es. pescetarian)" value={r.code} onChange={(e) => setRow(i, { code: e.target.value })} />
                <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Etichetta (es. Pescetariana)" value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} />
                <button className="btn ghost sm" onClick={() => remove(i)} title="Rimuovi"><i className="ti ti-trash" /></button>
              </div>
            ))}
            {rows.length === 0 && <div className="empty">Nessun regime: aggiungine almeno uno.</div>}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn ghost sm" onClick={add}><i className="ti ti-plus" /> Aggiungi regime</button>
            <button className="btn" disabled={busy} onClick={save}>{busy ? 'Salvo…' : 'Salva regimi'}</button>
          </div>
        </>
      )}
    </div>
  );
}
