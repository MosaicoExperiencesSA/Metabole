import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';
import { CodaDaValidare } from '../components/CodaDaValidare';
import { useAuth } from '../auth/AuthContext';
import { eNutrizionista } from '../lib/ruoliNutrizionista';

/**
 * Attività coach (handoff lancio, punto 5): i task generati in automatico sui
 * momenti chiave della prova (G0 misure, G1 benvenuto, G4 aderenza, G7 chiusura,
 * +7 ultima chiamata) e di ogni fine piano. "La coach deve vedere cosa fare e
 * quando, non ricordarselo." Stato: da fare / fatto / saltato.
 *
 * ## ⚠️ E dal 22/8 non è più solo della coach
 *
 * Quattro tipi nascono addosso alla **nutrizionista** — digiuno estremo, finestra non traducibile,
 * pasti non serviti, calorie che restano corte — e questa pagina è l'unico posto da cui può
 * chiuderli. Fino al 22/8 la push le diceva «la trovi in Dashboard» e la Dashboard rispondeva 403.
 *
 * ⚠️ Lei vede **solo i suoi quattro tipi, sulle sue clienti**: il filtro è nel backend
 * (`coach-tasks.service.ts`, `filtroNutrizionista`), non qui — una pagina non è un permesso.
 */

interface Task {
  id: string; clientId: string; kind: string; title: string; description: string | null;
  dueDate: string; overdue: boolean; status: string; clientName: string;
}
/**
 * ⚠️ `mostraCommerciale` (22/8): da quando questa pagina la apre anche la nutrizionista, quattro dei
 * sei numeri non sono suoi — prove attive, in scadenza, non convertite sono il lavoro della coach.
 * ⛔ Per lei il backend **non li manda proprio** (non li calcola nemmeno): sono opzionali, non
 * zeri. ⚠️ `mostraCommerciale` mancante (server vecchio) = si disegnano, che è com'era prima.
 */
interface Summary { openTasks: number; overdueTasks: number; trialsActive?: number; expiringToday?: number; expiringTomorrow?: number; notConverted?: number; mostraCommerciale?: boolean }

const KIND_ICON: Record<string, string> = {
  trial_g0_measures: 'ti-ruler-measure', trial_g1_welcome: 'ti-heart-handshake',
  trial_g4_adherence: 'ti-phone', trial_g6_code: 'ti-discount-2', trial_g7_closing: 'ti-brand-whatsapp',
  plan_end_report: 'ti-report', trial_post7_lastcall: 'ti-phone-call',
  plan_expiry_heads_up: 'ti-calendar-due', maintenance_regain: 'ti-scale',
  // Peso in salita durante una pausa vacanza (sorveglianza, voce #3 del 5/8).
  pause_regain: 'ti-beach',
  // Misure non inserite: il menu è fermo e l'app si blocca (voce #6 del 5/8).
  measures_missing: 'ti-ruler-measure',
  /**
   * ⚠️ I quattro tipi della NUTRIZIONISTA (22/8): senza icona propria uscivano tutti col segnaposto
   * «ti-checklist», cioè identici alle telefonate della prova in una colonna che ora vede anche lei.
   *
   * ⛔ **Solo nomi già in uso IN QUESTO BACKOFFICE** (corretto in revisione, 22/8). Il font qui è
   * pinnato a `@tabler/icons-webfont@**2.47.0**` da CDN, e un nome che in quella versione non esiste
   * non dà nessun errore: disegna un **quadratino vuoto**, cioè peggio del segnaposto che volevamo
   * togliere — una casella vuota si legge come «riga rotta».
   *
   * ⚠️ E «lo usa l'app» **non è una prova**: l'app carica `tabler-icons@3.17.0`, una major diversa,
   * dove i nomi non sono gli stessi. La prima stesura ne aveva quattro presi così: tre erano in uso
   * solo nell'app e uno (`ti-clock-question`) da nessuna parte.
   *
   * ⚠️ Adesso ognuno di questi sei compare già in un'altra pagina di **questo** backoffice. Non è
   * una dimostrazione — se anche quelle fossero quadratini vuoti nessuno se ne sarebbe accorto — ma
   * è la migliore evidenza raggiungibile senza l'elenco dei glifi della 2.47.0. `attivita-che-arrivano.spec.ts`
   * verifica intanto che ogni tipo abbia **un'icona sua**, cioè che nessuno finisca col segnaposto.
   */
  digiuno_estremo_da_verificare: 'ti-alert-triangle',
  digiuno_finestra_non_traducibile: 'ti-clock',
  digiuno_pasti_non_serviti: 'ti-tools-kitchen-2',
  kcal_restano_corte: 'ti-alert-circle',
  finestra_digiuno_mai_chiesta: 'ti-hourglass',
  esclusioni_da_chiarire: 'ti-message-question',
  /**
   * ⚠️ **Il quinto tipo della nutrizionista (3/9)**: la giornata scritta a mano che un cambio di
   * tipo dieta ha lasciato fuori regime. `ti-salad` è già in uso in **questo** backoffice — è la
   * regola scritta sopra: un nome che nella 2.47.0 non esiste disegna un quadratino vuoto, che si
   * legge come «riga rotta» ed è peggio del segnaposto.
   */
  giornata_a_mano_fuori_regime: 'ti-salad',
};

export function AttivitaCoach() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tab, setTab] = useState<'todo' | 'done' | 'skipped'>('todo');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load(status = tab) {
    api<Task[]>(`/staff/coach-tasks?status=${status}`).then(setTasks).catch((e) => { setTasks([]); setError(e instanceof Error ? e.message : 'Caricamento non riuscito.'); });
    api<Summary>('/staff/coach-tasks/summary').then(setSummary).catch(() => setSummary(null));
  }
  useEffect(() => { setTasks(null); load(tab); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(t: Task, status: 'todo' | 'done' | 'skipped') {
    setBusyId(t.id); setError(null);
    try {
      await api(`/staff/coach-tasks/${t.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load(tab);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Operazione non riuscita.'); }
    finally { setBusyId(null); }
  }

  const fmt = (s: string) => new Date(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

  /**
   * ⛔ **LA CODA «DA VALIDARE» VIVE QUI DAL 22/8**, e non nella dashboard: richiesta di Simone,
   * «togliamo il da validare in dashboard e unifichiamolo con questo». Il perché sta nel docstring
   * di `CodaDaValidare`.
   *
   * ⚠️ **Solo a chi quella coda appartiene.** `/nutritionist/validation-queue` è
   * `@Roles('nutritionist', 'head_nutritionist', 'admin')`: alla coach risponderebbe 403, e un
   * riquadro rosso «non riesco a leggere la coda» in cima alla sua pagina sarebbe un errore vero su
   * una cosa che non è mai stata sua. ⛔ L'admin è ammesso dal backend ma qui non lo si disegna: non
   * gli è stato tolto niente dalla dashboard, e la coda clinica non è lavoro suo.
   */
  const { user } = useAuth();
  /**
   * ⚠️ **E solo nella scheda «Da fare»** (revisione, 22/8). Il riquadro elenca cose **ancora da
   * fare**: in cima a «Fatti» o «Saltati» sarebbe una contraddizione — si apre quella scheda per
   * guardare indietro.
   */
  const suaLaCoda = eNutrizionista(user?.role) && tab === 'todo';

  return (
    <>
      {/*
        ⚠️ Nessun `onCambiata`: «Presa visione» e le azioni sulla coda non creano né chiudono nessuna
        attività (`nutritionist.service.ts` scrive `reviewOutcome` e i campi del piano, mai un
        `coach_task`). Ricaricare l'elenco sotto sarebbe due richieste per clic che non possono
        cambiare niente. *Misura prima di decidere.*
      */}
      {suaLaCoda && <CodaDaValidare perTutte={user?.role === 'head_nutritionist'} />}

      {summary && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 14 }}>
          <div className="row" style={{ gap: 18, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <b style={{ fontSize: 13 }}><i className="ti ti-checklist" /> {summary.openTasks} da fare{summary.overdueTasks > 0 && <span style={{ color: '#B3261E' }}> · {summary.overdueTasks} in ritardo</span>}</b>
            {summary.mostraCommerciale !== false && (
              <>
                <span className="muted" style={{ fontSize: 12 }}>Prove attive: <b>{summary.trialsActive}</b></span>
                <span className="muted" style={{ fontSize: 12 }}>In scadenza oggi: <b style={{ color: (summary.expiringToday ?? 0) > 0 ? '#B3261E' : undefined }}>{summary.expiringToday}</b> · domani: <b>{summary.expiringTomorrow}</b></span>
                <span className="muted" style={{ fontSize: 12 }}>Non convertite: <b>{summary.notConverted}</b></span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="row" style={{ gap: 6, marginBottom: 12 }}>
        {([['todo', 'Da fare'], ['done', 'Fatti'], ['skipped', 'Saltati']] as const).map(([k, l]) => (
          <button key={k} className="chip" onClick={() => setTab(k)} style={{ cursor: 'pointer', borderColor: tab === k ? 'var(--teal)' : undefined, background: tab === k ? 'var(--chip)' : undefined }}>{l}</button>
        ))}
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {!tasks ? <Spinner /> : tasks.length === 0 ? (
        <div className="empty">{tab === 'todo' ? 'Nessun task da fare: tutto in ordine ✓' : 'Niente qui.'}</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {tasks.map((t) => (
            <div key={t.id} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', borderLeft: t.overdue && t.status === 'todo' ? '4px solid #B3261E' : undefined }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--chip)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <i className={`ti ${KIND_ICON[t.kind] ?? 'ti-checklist'}`} style={{ fontSize: 17 }} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 14 }}>{t.title}</b>
                  <Link to={`/clienti/${t.clientId}`} className="link" style={{ fontSize: 13 }}>{t.clientName}</Link>
                  <span className={`chip ${t.overdue && t.status === 'todo' ? 'red' : ''}`} style={{ fontSize: 10 }}>
                    {t.overdue && t.status === 'todo' ? `in ritardo · ${fmt(t.dueDate)}` : fmt(t.dueDate)}
                  </span>
                </div>
                {t.description && (
                  /*
                   * ⚠️ `pre-wrap` (22/8, guardando la pagina vera): i testi delle attività mandano a
                   * capo l'elenco dei motivi con dei `\n`, e senza questa proprietà diventavano
                   * spazi — un muro di testo. ⛔ Il markdown invece NON si interpreta, ed è voluto:
                   * una descrizione che arriva dal backend e viene letta come HTML sarebbe un
                   * problema molto più grosso di un grassetto mancante. Sono i testi a non doverne
                   * scrivere, e `niente-markdown.spec.ts` lo tiene fermo su tutti.
                   */
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{t.description}</div>
                )}
              </div>
              <div className="row" style={{ gap: 6, flex: 'none' }}>
                {t.status === 'todo' ? (
                  <>
                    <button className="btn sm" onClick={() => setStatus(t, 'done')} disabled={busyId === t.id}><i className="ti ti-check" /> Fatto</button>
                    <button className="btn ghost sm" onClick={() => setStatus(t, 'skipped')} disabled={busyId === t.id} title="Salta questo task">Salta</button>
                  </>
                ) : (
                  <button className="btn ghost sm" onClick={() => setStatus(t, 'todo')} disabled={busyId === t.id}><i className="ti ti-arrow-back-up" /> Riapri</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
