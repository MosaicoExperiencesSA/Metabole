import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Pager, Spinner } from '../components/ui';
import { stileStadio } from '../lib/stadio';
import { AppointmentModal, isRecallStage } from '../components/RecallGuard';
import { useOrdinamentoServer } from '../components/tabella';
import { oggiIso, scaricaExcel } from '../lib/excel';

/** Oltre questo numero di righe il browser si ferma e il file diventa ingestibile. */
const TETTO_EXPORT = 5000;

interface Stage {
  key: string;
  label: string;
  color: string | null;
  order: number;
}
interface Lead {
  id: string;
  clientId: string | null;
  email: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  stage: string;
  valueCents: number | null;
  historicalPaidCents: number | null;
  createdAt: string;
  owner: { displayName: string } | null;
  assignedCoachId: string | null;
  assignedCoach: { id: string; displayName: string } | null;
  assignmentStatus: string | null; // pending | accepted
  phone: string | null;
  lists: CrmList[];
  /** Ha dichiarato il glutine (allergie + intolleranze + cibi non graditi, calcolato dal server). */
  senzaGlutine?: boolean;
  /** Nessuno ha ancora dato il via libera clinico a questa cliente. Vedi `clients/idoneita.ts`. */
  daValutare?: boolean;
  motivoValutazione?: string | null;
  client: { email: string; clientProfile: { name: string | null; assignedCoach: { displayName: string } | null; assignedNutritionistId: string | null; assignedNutritionist: { id: string; displayName: string } | null } | null } | null;
}
interface Coach { id: string; displayName: string }
interface CrmList { id: string; name: string; color: string | null; memberCount?: number }

function euro(cents: number | null): string {
  return cents == null ? '—' : '€ ' + (cents / 100).toFixed(2).replace('.', ',');
}
function parseEuro(v: string): number | null { const n = parseFloat(v.replace(',', '.')); return v.trim() && !isNaN(n) ? Math.round(n * 100) : null; }
function displayName(l: Lead): string {
  return l.client?.clientProfile?.name ?? l.name ?? l.client?.email ?? l.email ?? 'Senza nome';
}
/**
 * Nome e COGNOME in due colonne (9/8): sono due dati diversi, e con un campo unico si ordinava
 * per nome di battesimo — cioè per niente.
 * Le schede vecchie (import storici, clienti registrati dall'app) hanno solo il nome intero:
 * lì il nome sta tutto nella prima colonna e il cognome resta vuoto. Spezzarlo a occhio —
 * «Maria Teresa De Santis» — produrrebbe cognomi sbagliati che poi nessuno ricontrolla.
 */
function nomeDi(l: Lead): string {
  if (l.firstName) return l.firstName;
  return l.client?.clientProfile?.name ?? l.name ?? l.client?.email ?? l.email ?? 'Senza nome';
}
function cognomeDi(l: Lead): string {
  return l.lastName || '—';
}
// Classificazione persona coerente col marketing: cliente attivo, cliente storico (pre-Metabole) o lead.
function classify(l: Lead): { label: string; chip: string; title: string } {
  /**
   * ⚠️ **«Cliente» sono DUE colonne dal 25/8**: «Acquisito» e «In sospensione», dove le schede
   * sostano mentre i menu sono fermi. Col confronto vecchio, una cliente in vacanza compariva
   * nell'elenco Clienti — il backend ora la include — con addosso il badge ambra **«Lead»** e il
   * titolo «nessun pagamento registrato». Su una che ha pagato.
   */
  if (l.stage === 'in_sospensione') {
    return { label: 'Cliente', chip: '', title: 'Cliente attivo Metabole, in sospensione (menu fermi)' };
  }
  if (l.stage === 'paid') return { label: 'Cliente', chip: '', title: 'Cliente attivo Metabole' };
  if ((l.historicalPaidCents ?? 0) > 0) return { label: 'Storico', chip: 'violet', title: 'Cliente storico (pagamenti pre-Metabole)' };
  return { label: 'Lead', chip: 'amber', title: 'Lead: nessun pagamento registrato' };
}

/**
 * UNA SOLA TABELLA per «Gestione lead» e «Clienti» (§16.4, richiesta di Simone dell'11/8:
 * «uniformare le tabelle Clienti e Gestione lead, devono essere uguali a Gestione lead»).
 *
 * Non due componenti che si somigliano: **lo stesso**, con un filtro diverso. Prima erano 200 righe
 * contro 600, e ogni correzione fatta su una sola delle due le allontanava — l'ultima in ordine di
 * tempo: i filtri fissi in cima, che una aveva e l'altra no.
 *
 * `modo = 'clienti'` cambia tre cose e nessun'altra:
 * - il filtro **Tipo è inchiodato a «Cliente»** (`stage = paid`, cioè chi ha pagato davvero: è
 *   esattamente il «solo gli utenti che hanno effettuato un acquisto di valore maggiore di 0»
 *   chiesto da Simone, e non serviva inventare un conteggio nuovo — esisteva già);
 * - spariscono le azioni che riguardano i lead e non le clienti (nuovo lead, importa liste);
 * - le parole: «clienti» al posto di «contatti», e il file Excel si chiama Clienti.
 *
 * ⚠️ Il perimetro delle due liste NON era lo stesso: `crm.list` restringeva solo per coach, mentre
 * l'elenco Clienti restringe anche per **nutrizionista**. Unificare senza toccarlo avrebbe allargato
 * a ogni nutrizionista la vista su tutte le clienti. È stato aggiunto lato server, insieme a questa
 * modifica — vedi il commento in `crm.service.ts`.
 */
export function LeadsTable({ modo = 'lead' }: { modo?: 'lead' | 'clienti' | 'da_assegnare' } = {}) {
  const soloClienti = modo === 'clienti';
  /**
   * «LEAD DA ASSEGNARE» (§16.3): gli stessi contatti, filtrati sui **non assegnati** e ordinati
   * **dal più vecchio**. L'ordine non è un dettaglio: è una coda di lavoro, e il più vecchio è
   * quello che sta aspettando da più tempo — cioè quello che si sta raffreddando.
   */
  const daAssegnare = modo === 'da_assegnare';
  const nome = soloClienti ? 'clienti' : 'contatti';
  const { impersonate, can } = useAuth();
  const canAssignCoach = can('assign_coach', 'manage');
  const canAssignNutri = can('assign_nutritionist', 'manage');
  /**
   * «Entra come» dalla TABELLA DEI PERMESSI (richiesta di Simone dell'11/8). Prima il pulsante si
   * vedeva sempre, e chi non era admin scopriva di non poterlo usare solo premendolo: un 403 al
   * posto di un pulsante che non c'è.
   */
  const puoEntrare = can('impersonate', 'manage');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [nutritionists, setNutritionists] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [esportando, setEsportando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [allLists, setAllLists] = useState<CrmList[]>([]);
  const [listFilter, setListFilter] = useState(''); // '' = tutte
  const [showLists, setShowLists] = useState(false);
  // Assegnazione massiva: id selezionati + coach scelta nella barra.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCoach, setBulkCoach] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);
  const prevQkey = useRef('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  // Filtri per colonna (in AND fra loro e con ricerca/etichetta).
  const [fName, setFName] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fStage, setFStage] = useState('');
  const [fCoach, setFCoach] = useState(''); // '' tutti · 'none' non assegnato · else coachId
  const [fNutri, setFNutri] = useState(''); // '' tutti · 'none' non assegnato · else nutriId
  const [fTipo, setFTipo] = useState(''); // '' · client · historical · lead
  /**
   * «Solo da valutare»: la coda del via libera clinico (`clients/idoneita.ts`).
   *
   * ⚠️ Vive SOLO nella pagina Clienti. In «Gestione lead» un contatto senza cliente collegata non
   * può essere da valutare, e un filtro che non toglie mai niente insegna a diffidare dei filtri.
   */
  const [fDaValutare, setFDaValutare] = useState(false);
  const [fValMin, setFValMin] = useState('');
  const [fValMax, setFValMax] = useState('');
  const [fDateFrom, setFDateFrom] = useState('');
  const [fDateTo, setFDateTo] = useState('');
  /**
   * L'ordinamento e la testa incollata in alto arrivano dall'helper condiviso (`useOrdinamentoServer`).
   * Il FILTRO invece resta qui: questa è l'unica tabella che filtra lato server, e ha intervalli di
   * valore e di data che l'helper non sa disegnare. Vedi il commento nell'helper — punto 3 del
   * DA_FARE, chiuso l'11/8 per la parte che si poteva condividere davvero.
   */
  const ord = useOrdinamentoServer({
    testaFissa: true,
    allCambio: () => setPage(0),
    ...(daAssegnare ? { chiaveIniziale: 'created', direzioneIniziale: 'asc' as const } : {}),
  });
  const sortKey = ord.chiave;
  const sortDir = ord.direzione;
  function clearFilters() {
    setFilter(''); setListFilter(''); setFName(''); setFEmail(''); setFStage(''); setFCoach(''); setFNutri(''); setFTipo('');
    setFValMin(''); setFValMax(''); setFDateFrom(''); setFDateTo(''); setFDaValutare(false); setPage(0);
  }

  async function assignCoach(l: Lead, coachStaffId: string) {
    if (!coachStaffId) return;
    setError(null);
    try {
      await api(`/crm/leads/${l.id}/assign-coach`, { method: 'POST', body: JSON.stringify({ coachStaffId }) });
      const coach = coaches.find((c) => c.id === coachStaffId) ?? null;
      setLeads((ls) => ls.map((x) => (x.id === l.id ? { ...x, assignedCoachId: coachStaffId, assignmentStatus: 'pending', assignedCoach: coach } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assegnazione non riuscita.');
    }
  }

  async function assignNutritionist(l: Lead, nutritionistStaffId: string) {
    setError(null);
    try {
      await api(`/crm/leads/${l.id}/assign-nutritionist`, { method: 'POST', body: JSON.stringify({ nutritionistStaffId }) });
      const nutri = nutritionists.find((n) => n.id === nutritionistStaffId) ?? null;
      setLeads((ls) => ls.map((x) => (x.id === l.id && x.client?.clientProfile
        ? { ...x, client: { ...x.client, clientProfile: { ...x.client.clientProfile, assignedNutritionistId: nutritionistStaffId || null, assignedNutritionist: nutri } } }
        : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assegnazione non riuscita.');
    }
  }

  function toggleSel(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAllVisible() {
    setSelected((prev) => {
      const allSel = leads.length > 0 && leads.every((l) => prev.has(l.id));
      const n = new Set(prev);
      if (allSel) leads.forEach((l) => n.delete(l.id));
      else leads.forEach((l) => n.add(l.id));
      return n;
    });
  }
  async function bulkAssign() {
    const recordIds = leads.filter((l) => selected.has(l.id)).map((l) => l.id);
    if (!bulkCoach || recordIds.length === 0) return;
    setBulkBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await api<{ assigned: number }>('/crm/leads/assign-coach-bulk', {
        method: 'POST',
        body: JSON.stringify({ coachStaffId: bulkCoach, recordIds }),
      });
      const coach = coaches.find((c) => c.id === bulkCoach) ?? null;
      const idset = new Set(recordIds);
      setLeads((ls) => ls.map((x) => (idset.has(x.id) ? { ...x, assignedCoachId: bulkCoach, assignmentStatus: 'pending', assignedCoach: coach } : x)));
      setSelected(new Set());
      setBulkCoach('');
      setOkMsg(`${res.assigned} lead assegnati a ${coach?.displayName ?? 'coach'}. La coach deve accettarli entro 2 giorni.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assegnazione massiva non riuscita.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function doImpersonate(l: Lead) {
    if (!l.clientId) return;
    setError(null);
    try {
      await impersonate(l.clientId, l.client?.email ?? l.email ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impersonazione non riuscita.');
    }
  }

  async function load() {
    try {
      const [st, lists] = await Promise.all([
        api<Stage[]>('/crm/stages'),
        api<CrmList[]>('/crm/lists').catch(() => [] as CrmList[]),
      ]);
      setStages(st);
      setAllLists(lists);
      if (canAssignCoach) { try { setCoaches(await api<Coach[]>('/crm/coaches')); } catch { /* elenco coach opzionale */ } }
      if (canAssignNutri) { try { setNutritionists(await api<Coach[]>('/crm/nutritionists')); } catch { /* elenco nutrizionisti opzionale */ } }
    } catch { /* stage/liste non bloccano la tabella */ }
  }

  /**
   * I FILTRI CORRENTI, in un posto solo.
   *
   * Li usano la ricerca (una pagina per volta) e l'esportazione in Excel (tutte le pagine). Scritti
   * due volte, prima o poi divergono — e un file che dice di avere i filtri applicati ma ne ha uno
   * in meno è peggio di un file senza filtri: quello lo si controlla, questo lo si crede.
   */
  function paramsCorrenti(p: number, dimensione: number): string {
    const params = new URLSearchParams();
    params.set('page', String(p));
    params.set('pageSize', String(dimensione));
    const qv = filter.trim() || fEmail.trim() || fName.trim();
    if (qv) params.set('q', qv);
    if (fStage) params.set('stage', fStage);
    if (listFilter) params.set('listId', listFilter);
    if (fCoach && !daAssegnare) params.set('coachId', fCoach);
    if (fNutri) params.set('nutriId', fNutri);
    // In «Clienti» il tipo non è una scelta: è l'identità della pagina.
    if (soloClienti) params.set('tipo', 'client');
    // Il filtro lo applica il DATABASE: così il totale in cima e l'Excel dicono la stessa cosa
    // della tabella. Filtrare le cento righe già scaricate darebbe un totale che non corrisponde.
    if (soloClienti && fDaValutare) params.set('daValutare', '1');
    else if (fTipo) params.set('tipo', fTipo);
    // In «Lead da assegnare» il filtro sulla coach è inchiodato su «nessuna».
    if (daAssegnare) params.set('coachId', 'none');
    const mn = parseEuro(fValMin); if (mn != null) params.set('valueMin', String(mn));
    const mx = parseEuro(fValMax); if (mx != null) params.set('valueMax', String(mx));
    if (fDateFrom) params.set('dateFrom', fDateFrom);
    if (fDateTo) params.set('dateTo', fDateTo);
    if (sortKey) { params.set('sortKey', sortKey); params.set('sortDir', sortDir); }
    return params.toString();
  }

  // Carica UNA pagina dal server, coi filtri/ordinamento applicati lato DB.
  async function fetchLeads(p: number) {
    const seq = ++searchSeq.current;
    setSearching(true);
    try {
      const r = await api<{ rows: Lead[]; total: number }>(`/crm/leads?${paramsCorrenti(p, 100)}`);
      if (seq === searchSeq.current) { setLeads(r.rows ?? []); setTotal(r.total ?? 0); }
    } catch (err) {
      if (seq === searchSeq.current) setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      if (seq === searchSeq.current) { setSearching(false); setLoading(false); }
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Paginazione + filtri + ordinamento LATO SERVER: si carica solo la pagina corrente.
  // Cambiando un filtro si torna a pagina 0; cambiando pagina si mantiene il filtro.
  const qkey = JSON.stringify([modo, filter, fName, fEmail, fStage, fCoach, fNutri, fTipo, fDaValutare, fValMin, fValMax, fDateFrom, fDateTo, listFilter, sortKey, sortDir]);
  useEffect(() => {
    const filtersChanged = prevQkey.current !== qkey;
    prevQkey.current = qkey;
    if (filtersChanged && page !== 0) { setPage(0); return; }
    const t = setTimeout(() => { void fetchLeads(page); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qkey, page]);

  // Cambio verso "da ricontattare": prima si fissa l'appuntamento (obbligatorio).
  const [pendingRecall, setPendingRecall] = useState<{ lead: Lead; stage: string; stageLabel: string } | null>(null);

  async function changeStage(lead: Lead, stage: string) {
    const stageObj = stages.find((s) => s.key === stage) ?? null;
    if (isRecallStage(stageObj)) {
      setPendingRecall({ lead, stage, stageLabel: stageObj?.label ?? stage });
      return; // il cambio avviene solo dopo la conferma dell'appuntamento
    }
    await doChangeStage(lead, stage);
  }

  async function doChangeStage(lead: Lead, stage: string) {
    try {
      await api(`/crm/leads/${lead.id}/stage`, { method: 'POST', body: JSON.stringify({ stage }) });
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, stage } : l)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modifica non riuscita.');
    }
  }

  const stageOf = (key: string) => stages.find((s) => s.key === key);
  const pageSize = 100;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fromRow = total === 0 ? 0 : page * pageSize + 1;
  const toRow = Math.min(total, (page + 1) * pageSize);
  /**
   * ⛔ **LA CONVERSIONE 0-BASED → 1-BASED, IN UN POSTO SOLO** (21/8).
   *
   * Questa è l'unica tabella del backoffice che pagina **lato server** (`?page=&pageSize=` verso
   * `/crm/leads`) e l'unica che tiene la pagina a partire da **zero**; il `Pager` condiviso parte da
   * **uno**. Finché la barra era una sola, il `+1` scritto in linea era un dettaglio. Con due barre
   * diventa la cosa che si sbaglia: basta copiare la riga e dimenticare il `-1` nel `onPage`, e le
   * due barre mostrano pagine diverse della stessa tabella — senza nessun errore, solo numeri che
   * non tornano.
   */
  const pagerLead = { page: page + 1, totalPages, total, from: fromRow, to: toRow, onPage: (p: number) => setPage(p - 1) };

  if (loading) return <Spinner />;


  /**
   * ESPORTA IN EXCEL — qui è diverso da tutte le altre tabelle.
   *
   * Le altre hanno tutte le righe in mano e `<BottoneExcel>` scrive quelle. Qui no: i lead sono
   * decine di migliaia, filtro, ordinamento e pagine li fa il database, e in memoria c'è **una
   * pagina**. Esportare quella sarebbe cento righe su ottomila, senza dirlo.
   *
   * Quindi si richiede al server, con gli stessi filtri, pagina dopo pagina. Con un tetto: oltre
   * `TETTO_EXPORT` righe il browser si ferma e il file diventa ingestibile — e quando il tetto morde
   * lo si dice PRIMA, perché su un foglio di calcolo non c'è nessun banner che avvisa dopo.
   */
  async function esportaExcel() {
    setEsportando(true);
    setError(null);
    try {
      /**
       * ⚠️ Il conteggio si RILEGGE, non si prende da `total`.
       *
       * `total` viene dall'ultima ricerca, che parte 300 ms dopo l'ultimo tasto. Azzerando i filtri e
       * cliccando subito «Esporta», `total` è ancora quello di prima: il ciclo si fermerebbe alla
       * terza riga e il file direbbe «3 contatti» avendone davanti quarantamila. Il numero giusto
       * arriva con la prima pagina — che va chiesta comunque.
       */
      const prima = await api<{ rows: Lead[]; total: number }>(`/crm/leads?${paramsCorrenti(0, 500)}`);
      const trovati = prima.total ?? 0;
      const quante = Math.min(trovati, TETTO_EXPORT);
      // eslint-disable-next-line no-alert
      if (trovati > TETTO_EXPORT && !confirm(`I filtri trovano ${trovati.toLocaleString('it-IT')} contatti. Il file ne conterrà i primi ${TETTO_EXPORT.toLocaleString('it-IT')}, nell'ordine che vedi adesso.\n\nPer averli tutti, restringi con un filtro. Scarico lo stesso?`)) { setEsportando(false); return; }

      const tutte: Lead[] = [...(prima.rows ?? [])];
      for (let p = 1; tutte.length < quante; p++) {
        const r = await api<{ rows: Lead[]; total: number }>(`/crm/leads?${paramsCorrenti(p, 500)}`);
        const righe = r.rows ?? [];
        if (righe.length === 0) break;
        tutte.push(...righe);
      }
      scaricaExcel(`${soloClienti ? 'Clienti' : daAssegnare ? 'Lead da assegnare' : 'Gestione lead'}-${oggiIso()}`, {
        nome: soloClienti ? 'Clienti' : daAssegnare ? 'Lead da assegnare' : 'Gestione lead',
        intestazioni: ['Nome', 'Cognome', 'Email', 'Stato', 'Coach', 'Nutrizionista', 'Tipo', 'Valore €', 'Creato'],
        // Le stesse nove colonne della tabella, nello stesso ordine. `createdAt` è una stringa ISO e
        // diventa una cella data vera; il valore esce in euro e non in centesimi, così si somma.
        righe: tutte.slice(0, quante).map((l) => [
          nomeDi(l),
          l.lastName || '',
          l.client?.email ?? l.email ?? l.phone ?? '',
          stageOf(l.stage)?.label ?? l.stage,
          l.assignedCoach?.displayName ?? l.client?.clientProfile?.assignedCoach?.displayName ?? '',
          l.client?.clientProfile?.assignedNutritionist?.displayName ?? '',
          classify(l).label,
          (l.valueCents ?? l.historicalPaidCents ?? 0) / 100,
          l.createdAt,
        ]),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Esportazione non riuscita.');
    } finally {
      setEsportando(false);
    }
  }

  return (
    <>
      <div className="spread" style={{ marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{ alignSelf: 'center', fontSize: 14, fontWeight: 800, background: 'var(--chip)', color: 'var(--deep,#0a7d55)', borderRadius: 999, padding: '7px 14px', whiteSpace: 'nowrap' }}
            title={`Totale ${nome} che rispettano i filtri correnti (senza filtri: tutto il database)`}
          >
            Totale: {total.toLocaleString('it-IT')}
          </span>
          <input className="input" style={{ maxWidth: 260 }} placeholder={soloClienti ? 'Cerca fra tutte le clienti (nome, email, tel)…' : daAssegnare ? 'Cerca fra i non assegnati…' : 'Cerca in tutto il DB (nome, email, tel)…'} value={filter} onChange={(e) => setFilter(e.target.value)} />
          {searching && <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>cerco nel database…</span>}
          <select className="select" style={{ maxWidth: 220 }} value={listFilter} onChange={(e) => setListFilter(e.target.value)} title="Filtra per lista">
            <option value="">Tutte le liste</option>
            {allLists.map((l) => <option key={l.id} value={l.id}>{l.name}{l.memberCount != null ? ` (${l.memberCount})` : ''}</option>)}
          </select>
          {can('permissions', 'manage') && <button className="btn ghost" onClick={() => setShowLists(true)}><i className="ti ti-tags" /> Gestisci liste</button>}
          {/*
            ⚠️ LA CODA DEL VIA LIBERA CLINICO, in un colpo solo.
            La pastiglia accanto al nome diceva CHI, ma con centinaia di clienti in pagine da cento
            le da valutare si trovavano scorrendo con l'occhio — e una coda che si legge scorrendo
            è una coda che si guarda il primo giorno. Qui è un interruttore, e filtra nel database.
            `serve_visita` resta fuori, come nella pastiglia e nella scheda: chi ha già una
            decisione non torna in coda.
          */}
          {soloClienti && (
            <button
              className={fDaValutare ? 'btn' : 'btn ghost'}
              onClick={() => setFDaValutare((v) => !v)}
              title={fDaValutare
                ? 'Sto mostrando solo le clienti che nessuno ha ancora valutato. Premi per rivederle tutte.'
                : 'Mostra solo le clienti a cui nessuno ha ancora dato il via libera clinico (allergie o patologie dichiarate, e nessuna decisione scritta).'}
            >
              <i className="ti ti-stethoscope" /> {fDaValutare ? 'Solo da valutare' : 'Da valutare'}
            </button>
          )}
          {(filter || listFilter || fName || fEmail || fStage || fCoach || fNutri || fTipo || fValMin || fValMax || fDateFrom || fDateTo || fDaValutare) && (
            <button className="btn ghost" onClick={clearFilters} title="Rimuovi tutti i filtri"><i className="ti ti-filter-off" /> Azzera filtri</button>
          )}
          <button className="btn ghost" onClick={esportaExcel} disabled={esportando || searching || total === 0}
            title={total === 0 ? 'Nessun contatto da esportare con questi filtri' : `Scarica in Excel i ${Math.min(total, TETTO_EXPORT).toLocaleString('it-IT')} contatti che rispettano i filtri — tutte le pagine, non solo questa`}>
            <i className="ti ti-file-type-xls" /> {esportando ? 'Preparo…' : 'Esporta in Excel'}
          </button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {!soloClienti && !daAssegnare && can('accounting', 'manage') && (
            <Link className="btn ghost" to="/crm/import"><i className="ti ti-database-import" /> Importa</Link>
          )}
          {!soloClienti && !daAssegnare && (
            <Link className="btn" to="/crm/inserimento">
              <i className="ti ti-user-plus" /> Nuovo lead
            </Link>
          )}
        </div>
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {okMsg && <Banner kind="ok">{okMsg}</Banner>}
      {canAssignCoach && selected.size > 0 && (
        <div className="card" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span><b>{selected.size}</b> lead selezionati</span>
          <select className="select" style={{ width: 200 }} value={bulkCoach} onChange={(e) => setBulkCoach(e.target.value)} title="Coach a cui assegnare i lead selezionati">
            <option value="">— scegli coach —</option>
            {coaches.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
          </select>
          <button className="btn" onClick={bulkAssign} disabled={!bulkCoach || bulkBusy}>
            <i className="ti ti-user-check" /> Assegna {selected.size} lead
          </button>
          <button className="btn ghost" onClick={() => setSelected(new Set())} disabled={bulkBusy}>Deseleziona</button>
        </div>
      )}
      {showLists && <ListsManager lists={allLists} onClose={() => setShowLists(false)} onChanged={load} />}

      {/* L'elenco scorre DENTRO la card: è la condizione perché titoli e filtri restino incollati in
          alto (come in Utenti). Con la pagina che scorre invece, la testa finirebbe sotto la barra
          del titolo. Restano fermi anche il totale, la ricerca e il paginatore. */}
      <div className="card" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
          {/*
            ⚠️ **Le stesse props per tutte e due**, da `pagerLead`: qui la pagina è 0-based e il
            `Pager` 1-based, e scrivere `page + 1` / `setPage(p - 1)` in due posti è il modo classico
            di ritrovarsi le due barre su pagine diverse.
            ⚠️ Questa card è il riquadro che scorre: la barra di sopra resta in vista perché
            `<Pager sopra>` è `sticky` (vedi `ui.tsx`), non perché stia in un posto particolare.
          */}
          <Pager {...pagerLead} sopra />
          <table className="grid" style={{ minWidth: 920 }}>
            <thead>
              <tr ref={ord.rifTesta}>
                {canAssignCoach && (
                  <th style={{ width: 34, ...ord.stileTitoli }}>
                    <input
                      type="checkbox"
                      checked={leads.length > 0 && leads.every((l) => selected.has(l.id))}
                      onChange={toggleAllVisible}
                      title="Seleziona/deseleziona tutti i visibili"
                    />
                  </th>
                )}
                {ord.titolo('Nome', 'name')}
                {ord.titolo('Cognome', 'cognome')}
                {ord.titolo('Email', 'email')}
                {ord.titolo('Stato', 'stage')}
                {ord.titolo('Coach', 'coach')}
                {ord.titolo('Nutrizionista', 'nutri')}
                {ord.titolo('Tipo', 'tipo')}
                {ord.titolo('Valore', 'value')}
                {ord.titolo('Creato', 'created')}
                <th style={{ textAlign: 'right', ...ord.stileTitoli }}>Azioni</th>
              </tr>
              <tr>
                {canAssignCoach && <th style={{ padding: '4px 6px', ...ord.stileFiltri }} />}
                <th style={{ padding: '4px 6px', ...ord.stileFiltri }} colSpan={2}>
                  <input className="input" style={{ width: '100%', padding: '4px 8px', fontWeight: 400 }} placeholder="Nome o cognome…" value={fName} onChange={(e) => setFName(e.target.value)} />
                </th>
                <th style={{ padding: '4px 6px', ...ord.stileFiltri }}>
                  <input className="input" style={{ width: '100%', padding: '4px 8px', fontWeight: 400 }} placeholder="Email o tel…" value={fEmail} onChange={(e) => setFEmail(e.target.value)} />
                </th>
                <th style={{ padding: '4px 6px', ...ord.stileFiltri }}>
                  <select className="select" style={{ width: '100%', padding: '4px 8px', fontWeight: 400 }} value={fStage} onChange={(e) => setFStage(e.target.value)}>
                    <option value="">Tutti</option>
                    {stages.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
                  </select>
                </th>
                <th style={{ padding: '4px 6px', ...ord.stileFiltri }}>
                  <select className="select" style={{ width: '100%', padding: '4px 8px', fontWeight: 400 }} value={fCoach} onChange={(e) => setFCoach(e.target.value)}>
                    <option value="">Tutte</option>
                    <option value="none">— non assegnato —</option>
                    {coaches.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                  </select>
                </th>
                <th style={{ padding: '4px 6px', ...ord.stileFiltri }}>
                  <select className="select" style={{ width: '100%', padding: '4px 8px', fontWeight: 400 }} value={fNutri} onChange={(e) => setFNutri(e.target.value)}>
                    <option value="">Tutti</option>
                    <option value="none">— non assegnato —</option>
                    {nutritionists.map((n) => <option key={n.id} value={n.id}>{n.displayName}</option>)}
                  </select>
                </th>
                <th style={{ padding: '4px 6px', ...ord.stileFiltri }}>
                  <select className="select" style={{ width: '100%', padding: '4px 8px', fontWeight: 400 }} value={soloClienti ? 'client' : fTipo} disabled={soloClienti} onChange={(e) => setFTipo(e.target.value)} title={soloClienti ? 'Questa pagina mostra solo le clienti che hanno pagato' : 'Tipo persona'}>
                    <option value="">Tutti i tipi</option>
                    <option value="client">Cliente</option>
                    <option value="historical">Storico</option>
                    <option value="lead">Lead</option>
                  </select>
                </th>
                <th style={{ padding: '4px 6px', ...ord.stileFiltri }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input className="input" style={{ width: 58, padding: '4px 6px', fontWeight: 400 }} placeholder="min €" inputMode="decimal" value={fValMin} onChange={(e) => setFValMin(e.target.value)} title="Valore minimo (€)" />
                    <input className="input" style={{ width: 58, padding: '4px 6px', fontWeight: 400 }} placeholder="max €" inputMode="decimal" value={fValMax} onChange={(e) => setFValMax(e.target.value)} title="Valore massimo (€)" />
                  </div>
                </th>
                <th style={{ padding: '4px 6px', ...ord.stileFiltri }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <input className="input" style={{ width: 130, padding: '3px 6px', fontWeight: 400, fontSize: 11 }} type="date" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} title="Creato dal" />
                    <input className="input" style={{ width: 130, padding: '3px 6px', fontWeight: 400, fontSize: 11 }} type="date" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} title="Creato al" />
                  </div>
                </th>
                <th style={{ padding: '4px 6px', ...ord.stileFiltri }} />
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={canAssignCoach ? 11 : 10} className="empty" style={{ padding: 24, textAlign: 'center' }}>
                    {searching
                      ? 'Carico…'
                      /*
                        ⚠️ Con il filtro della coda attivo, zero righe è una BUONA notizia: vuol dire
                        che nessuna cliente sta aspettando una valutazione. Lasciare «nessun lead con
                        questi filtri» farebbe leggere come un errore di ricerca la sola schermata
                        che dice «hai finito».
                      */
                      : fDaValutare
                        ? 'Nessuna cliente in attesa: hanno tutte una decisione scritta.'
                        : 'Nessun lead con questi filtri. Modifica o azzera i filtri qui sopra.'}
                  </td>
                </tr>
              ) : leads.map((l) => {
                const st = stageOf(l.stage);
                return (
                  <tr key={l.id}>
                    {canAssignCoach && (
                      <td>
                        <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSel(l.id)} />
                      </td>
                    )}
                    <td>
                      {/*
                        La pastiglia «senza glutine» esisteva solo nel vecchio elenco Clienti, ed era
                        l'unico posto in cui si vedeva chi l'ha dichiarato **senza avere ancora la
                        dieta dedicata**. Unificando le due tabelle sarebbe sparita: qui resta, e
                        resta dov'era — dentro la cella del nome, non come colonna.
                      */}
                      {/*
                        ⚠️ «Da valutare»: nessuno ha ancora detto se questa cliente può proseguire.
                        Prima di questa pastiglia la decisione si poteva prendere ma non si sapeva
                        su CHI: bisognava aprire le schede una per una, ed è proprio il caso in cui
                        non aprirne una ha una conseguenza. Il titolo porta il motivo, perché
                        «allergie dichiarate» e «patologie o farmaci» non si guardano con la stessa
                        fretta.
                      */}
                      {soloClienti && l.daValutare && (
                        <span
                          className="chip"
                          style={{ marginRight: 6, fontSize: 10.5, background: '#FDF0E3', color: '#8A5A12', border: '1px solid #E9C48A' }}
                          title={`Nessuno ha ancora valutato se può proseguire${l.motivoValutazione ? ` — ${l.motivoValutazione}` : ''}. Si decide dalla scheda cliente.`}
                        >
                          da valutare
                        </span>
                      )}
                      {soloClienti && l.senzaGlutine && (
                        <span
                          className="chip"
                          style={{ marginRight: 6, fontSize: 10.5, background: '#F3E7E1', color: '#8A4B2A', border: '1px solid #E0A98A' }}
                          title="Ha dichiarato il glutine: controlla che la dieta assegnata sia la variante senza glutine."
                        >
                          senza glutine
                        </span>
                      )}
                      {l.clientId ? (
                        <Link to={`/clienti/${l.clientId}`} style={{ fontWeight: 700, textDecoration: 'none' }} title={displayName(l)}>
                          {nomeDi(l)}
                        </Link>
                      ) : (
                        <Link to={`/crm/lead/${l.id}`} style={{ fontWeight: 700, textDecoration: 'none' }} title="Apri la scheda del lead">
                          {nomeDi(l)}
                        </Link>
                      )}
                      {l.lists?.length > 0 && (
                        <div className="row" style={{ gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          {l.lists.map((x) => (
                            <span key={x.id} className="chip" style={{ fontSize: 9.5, padding: '1px 6px', borderColor: x.color ?? undefined, color: x.color ?? undefined }}>{x.name}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }} className={l.lastName ? undefined : 'muted'}>{cognomeDi(l)}</td>
                    <td className="muted">{l.client?.email ?? l.email ?? l.phone ?? '—'}</td>
                    <td>
                      <select
                        className="select"
                        style={{ width: 180, padding: '6px 10px', ...stileStadio(st?.color) }}
                        value={l.stage}
                        onChange={(e) => changeStage(l, e.target.value)}
                      >
                        {stages.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                        {!st && <option value={l.stage}>{l.stage} (stato rimosso)</option>}
                      </select>
                    </td>
                    <td>
                      {canAssignCoach ? (
                        <>
                          <select
                            className="select"
                            style={{ width: 150, padding: '6px 10px' }}
                            value={l.assignedCoachId ?? ''}
                            onChange={(e) => assignCoach(l, e.target.value)}
                            title="Assegna la coach (dovrà accettare entro 2 giorni)"
                          >
                            <option value="">— assegna —</option>
                            {coaches.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                            {l.assignedCoachId && !coaches.some((c) => c.id === l.assignedCoachId) && (
                              <option value={l.assignedCoachId}>{l.assignedCoach?.displayName ?? 'Coach'}</option>
                            )}
                          </select>
                          {l.assignmentStatus === 'pending' && <div><span className="chip amber" style={{ fontSize: 10, marginTop: 3 }}>in attesa</span></div>}
                          {l.assignmentStatus === 'accepted' && <div><span className="chip" style={{ fontSize: 10, marginTop: 3 }}>accettato</span></div>}
                        </>
                      ) : (
                        <span className="muted">{l.assignedCoach?.displayName ?? l.client?.clientProfile?.assignedCoach?.displayName ?? '—'}</span>
                      )}
                    </td>
                    <td>
                      {canAssignNutri && l.clientId && l.client?.clientProfile ? (
                        <select
                          className="select"
                          style={{ width: 150, padding: '6px 10px' }}
                          value={l.client.clientProfile.assignedNutritionistId ?? ''}
                          onChange={(e) => assignNutritionist(l, e.target.value)}
                          title="Assegna il nutrizionista alla cliente"
                        >
                          <option value="">— assegna —</option>
                          {nutritionists.map((n) => <option key={n.id} value={n.id}>{n.displayName}</option>)}
                          {l.client.clientProfile.assignedNutritionistId && !nutritionists.some((n) => n.id === l.client!.clientProfile!.assignedNutritionistId) && (
                            <option value={l.client.clientProfile.assignedNutritionistId}>{l.client.clientProfile.assignedNutritionist?.displayName ?? 'Nutrizionista'}</option>
                          )}
                        </select>
                      ) : (
                        <span className="muted">{l.client?.clientProfile?.assignedNutritionist?.displayName ?? '—'}</span>
                      )}
                    </td>
                    <td>{(() => { const k = classify(l); return <span className={`chip ${k.chip}`} style={{ fontSize: 10 }} title={k.title}>{k.label}</span>; })()}</td>
                    <td>{euro(l.valueCents ?? l.historicalPaidCents)}</td>
                    <td className="muted">{new Date(l.createdAt).toLocaleDateString('it-IT')}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {l.clientId && puoEntrare ? (
                        <button className="btn ghost sm" onClick={() => doImpersonate(l)} title="Guarda l'app con i suoi occhi, in sola lettura: per 30 minuti, e resta scritto nell'audit">
                          <i className="ti ti-eye" /> Entra come
                        </button>
                      ) : (
                        <span className="chip amber" style={{ fontSize: 10 }}>solo lead</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        <Pager {...pagerLead} />
      </div>
      {pendingRecall && (
        <AppointmentModal
          leadName={pendingRecall.lead.client?.clientProfile?.name ?? pendingRecall.lead.name ?? pendingRecall.lead.email ?? 'lead'}
          stageLabel={pendingRecall.stageLabel}
          onCancel={() => setPendingRecall(null)}
          onConfirm={async (title, dueAtIso, note) => {
            await api('/crm/reminders', { method: 'POST', body: JSON.stringify({ title, dueAt: dueAtIso, note: note || undefined, crmRecordId: pendingRecall.lead.id }) });
            const { lead, stage } = pendingRecall;
            setPendingRecall(null);
            await doChangeStage(lead, stage);
          }}
        />
      )}
    </>
  );
}

/** Crea, rinomina ed elimina le liste CRM. Alla chiusura ricarica la tabella. */
function ListsManager({ lists, onClose, onChanged }: { lists: CrmList[]; onClose: () => void; onChanged: () => void | Promise<void> }) {
  const [rows, setRows] = useState<CrmList[]>(lists);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try { setRows(await api<CrmList[]>('/crm/lists')); } catch { /* soft */ }
    await onChanged();
  }
  async function create() {
    if (!newName.trim()) return;
    setBusy(true); setError(null);
    try {
      await api('/crm/lists', { method: 'POST', body: JSON.stringify({ name: newName.trim() }) });
      setNewName('');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Creazione non riuscita.'); }
    finally { setBusy(false); }
  }
  async function rename(l: CrmList, name: string) {
    if (!name.trim() || name === l.name) return;
    try { await api(`/crm/lists/${l.id}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) }); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Rinomina non riuscita.'); }
  }
  async function remove(l: CrmList) {
    if (!confirm(`Eliminare la lista "${l.name}"? I contatti restano, perdono solo questa etichetta.`)) return;
    try { await api(`/crm/lists/${l.id}`, { method: 'DELETE' }); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.'); }
  }

  return (
    <Modal title="Gestisci liste CRM" onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      {rows.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nessuna lista. Creane una qui sotto.</p>
      ) : (
        <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
          {rows.map((l) => (
            <div key={l.id} className="row" style={{ gap: 8, alignItems: 'center' }}>
              <input className="input" defaultValue={l.name} onBlur={(e) => rename(l, e.target.value)} style={{ flex: 1 }} />
              <span className="muted" style={{ fontSize: 12, minWidth: 70, textAlign: 'right' }}>{l.memberCount ?? 0} contatti</span>
              <button className="btn ghost sm" style={{ color: '#b3261e' }} onClick={() => remove(l)} title="Elimina lista"><i className="ti ti-trash" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Nuova lista</label>
          <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Es. Clienti storici 2024" onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
        </div>
        <button className="btn" onClick={create} disabled={busy || !newName.trim()} style={{ marginBottom: 0 }}><i className="ti ti-plus" /> Crea</button>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="btn ghost" onClick={onClose}>Chiudi</button>
      </div>
    </Modal>
  );
}
