import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Pager, Spinner } from '../components/ui';
import { BottoneExcel, ContatoreRighe, useTabella, type Colonna } from '../components/tabella';
import { noteModifica, righeModifica } from '../lib/logModifiche';

interface AuditRow {
  id: string;
  action: string;
  actorId: string | null;
  actor: { email: string; firstName: string | null; lastName: string | null; role: string } | null;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: string;
}

const dateTime = (s: string) => new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Etichette leggibili per le azioni più comuni; le altre si mostrano così come sono. */
const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'Accesso',
  'auth.login_failed': 'Accesso fallito',
  'auth.register': 'Registrazione',
  'auth.logout': 'Uscita',
  'onboarding.completed': 'Questionario completato',
  'client.hard_delete': 'Cliente eliminato',
  'client.note.delete': 'Nota eliminata',
  'client.password_reset.trigger': 'Reset password inviato',
  'client.update': 'Modifica scheda cliente',
  'profile.update': 'Modifica profilo (dall\'app)',
  'config_param.update': 'Parametro aggiornato',
  'lead.assign.refcode': 'Assegnazione da ref code',
  'staff.refcode.generate': 'Ref code generato',
  'crm.lead.assign': 'Lead assegnato',
  'crm.lead.assign_bulk': 'Lead assegnati in massa',
  'crm.lead.accept': 'Lead accettato',
  'crm.lead.reject': 'Lead rifiutato',
  'crm.lead.assign_expired': 'Assegnazione scaduta',
  'chat.data_inizio.spostata': 'Data inizio spostata in chat',
};

/** Nomi italiani dei tipi di oggetto, per la colonna «Su cosa». */
const ENTITY_LABEL: Record<string, string> = {
  crm_record: 'Lead',
  client_profile: 'Scheda cliente',
  user: 'Utente',
  staff: 'Staff',
  config_param: 'Parametro',
  subscription: 'Abbonamento',
  visit: 'Visita',
  diet: 'Dieta',
  recipe: 'Ricetta',
};

const entityLabel = (t: string | null): string => (t ? ENTITY_LABEL[t] ?? t : '');

function actorLabel(r: AuditRow): string {
  if (!r.actor) return r.actorId ? 'utente rimosso' : 'sistema';
  const name = [r.actor.firstName, r.actor.lastName].filter(Boolean).join(' ');
  return name || r.actor.email;
}

const meta = (r: AuditRow): Record<string, unknown> | null =>
  r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata) ? (r.metadata as Record<string, unknown>) : null;

/**
 * «COSA» è cambiato, in una riga sola e in piccolo — la stessa richiesta che Simone ha fatto per il
 * log del lead il 10/8, applicata al log generale: «Parametro aggiornato» senza dire quale
 * parametro, e da quanto a quanto, è una riga che non risponde a nessuna domanda.
 * Usa `righeModifica`, cioè lo stesso lettore dei tre formati di metadata della scheda cliente:
 * un formato nuovo si insegna in un posto e si vede in tre pagine.
 */
function dettaglio(r: AuditRow): string {
  const m = meta(r);
  if (!m) return '';
  const righe = righeModifica(m).map((c) => `${c.etichetta}: ${c.prima} → ${c.dopo}`);
  const note = noteModifica(m);
  const extra: string[] = [];
  if (typeof m.count === 'number') extra.push(`${m.count} lead`);
  if (typeof m.key === 'string') extra.push(String(m.key));
  return [...righe, ...note, ...extra].join(' · ');
}

const NUMERO_RIGHE = [200, 500, 1000];

export function LogAttivita() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [totale, setTotale] = useState(0);
  const [quante, setQuante] = useState(200);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let annullato = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api<{ items: AuditRow[]; total: number }>(`/admin/audit-logs?limit=${quante}`);
        if (annullato) return;
        setRows(res.items);
        setTotale(res.total ?? res.items.length);
        setError(null);
      } catch (err) {
        if (annullato) return;
        if (err instanceof ApiError && err.status === 403) setError('Sezione riservata agli amministratori.');
        else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      } finally {
        if (!annullato) setLoading(false);
      }
    })();
    return () => { annullato = true; };
  }, [quante]);

  const COLONNE: Colonna<AuditRow>[] = [
    { chiave: 'quando', titolo: 'Data e ora', valore: (r) => r.createdAt },
    { chiave: 'azione', titolo: 'Azione', valore: (r) => ACTION_LABEL[r.action] ?? r.action, filtro: 'scelta', etichettaTutti: 'Tutte' },
    { chiave: 'chi', titolo: 'Chi', valore: (r) => actorLabel(r), filtro: 'scelta', etichettaTutti: 'Tutti' },
    { chiave: 'cosa', titolo: 'Su cosa', valore: (r) => entityLabel(r.entityType), filtro: 'scelta', etichettaTutti: 'Tutto' },
    { chiave: 'dettaglio', titolo: 'Cosa è cambiato', valore: dettaglio, filtro: 'testo' },
    { chiave: 'ip', titolo: 'IP', valore: (r) => r.ipAddress, filtro: 'testo' },
  ];

  // Il log si guarda dal più recente: è l'ordine del server, e resta quello di default.
  const t = useTabella(rows, COLONNE, { testaFissa: true, ordineIniziale: { chiave: 'quando', direzione: 'desc' }, nomeExcel: 'Log attività'});

  if (loading && rows.length === 0) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="azioni caricate" />
          <BottoneExcel tabella={t} avviso={totale > rows.length ? `Questa pagina ha caricato ${rows.length} azioni su ${totale}: il file conterrà le ${t.conteggio.mostrate} righe che vedi, scelte fra quelle. Carica più righe dal menu qui sopra per andare più indietro. Scarico lo stesso?` : undefined} />
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ maxWidth: 260 }}
            placeholder="Cerca in tutte le colonne…"
            value={t.ricerca}
            onChange={(e) => t.setRicerca(e.target.value)}
          />
          <select
            className="select"
            style={{ width: 'auto' }}
            value={quante}
            onChange={(e) => setQuante(Number(e.target.value))}
            title="Quante azioni caricare dal server: i filtri lavorano su queste"
          >
            {NUMERO_RIGHE.map((n) => <option key={n} value={n}>ultime {n}</option>)}
          </select>
        </div>
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      {/*
        Il tetto si dichiara. Filtrare 200 righe su 5.000 e non trovare niente non vuol dire che il
        fatto non c'è: vuol dire che è oltre il tetto. Senza questa riga la differenza non si vede.
      */}
      {totale > rows.length && (
        <Banner kind="info">
          Stai guardando le <b>{rows.length}</b> azioni più recenti su <b>{totale}</b> registrate: i filtri
          cercano solo fra queste. Carica più righe dal menu qui sopra per cercare più indietro.
        </Banner>
      )}

      <div className="card" style={{ padding: 0 }}>
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">{rows.length === 0 ? 'Nessuna attività registrata.' : 'Nessuna azione con questi filtri.'}</div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((r) => (
                <tr key={r.id}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{dateTime(r.createdAt)}</td>
                  <td>{ACTION_LABEL[r.action] ?? r.action}</td>
                  <td>{actorLabel(r)}</td>
                  <td className="muted">
                    {r.entityType ? (
                      <>
                        {entityLabel(r.entityType)}
                        {r.entityId && <span style={{ fontSize: 11 }}> · {r.entityId.slice(0, 8)}…</span>}
                      </>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize: 12, maxWidth: 380 }}>{dettaglio(r) || <span className="muted">—</span>}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{r.ipAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager {...t.pager} />
      </div>
    </>
  );
}
