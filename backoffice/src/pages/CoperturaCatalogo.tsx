import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';
import { ContatoreRighe, useTabella, type Colonna } from '../components/tabella';
import { useTaxonomy } from '../lib/taxonomy';

/**
 * COPERTURA CATALOGO — dove siamo, a colpo d'occhio.
 *
 * Richiesta di Simone dell'11/8: «crea una tabella con tutti i tipi, con le colonne n pranzi, n cene,
 * n merende, n spuntini, così a colpo d'occhio capiamo dove siamo». La domanda vera dietro era un'altra
 * — «dice settimana creata e validata, poi ci torno sopra ed è vuota» — e questa tabella serve prima di
 * tutto a **distinguere le ipotesi**: i piatti nel database non ci sono, oppure ci sono e non si vedono?
 * Sono due difetti opposti, con due correzioni opposte, e senza guardare i numeri si lavora a caso.
 *
 * ## Come si legge una riga
 *
 * Ogni pasto ha **due numeri** e non uno: i piatti diversi che le giornate nominano, e fra parentesi
 * quanti sono **attivi**, cioè quanti il motore userebbe davvero. Un piatto generato nasce in bozza e
 * diventa attivo con la validazione, quindi:
 *
 *  - `84 (84)` → a posto;
 *  - `84 (0)`  → **generata ma non validata**: i piatti ci sono, il motore non li vede, e da fuori
 *    sembra una settimana vuota. È il caso che spiegherebbe la segnalazione;
 *  - `84 (60)` → validata a metà, tipicamente perché la validazione è passata su alcune varianti e
 *    non su altre;
 *  - una **✕ rossa** → le giornate nominano piatti che **non esistono più**. I pasti stanno in un
 *    campo JSON senza vincoli, quindi una ricetta cancellata lascia la giornata in piedi e il pasto
 *    vuoto: questa colonna è l'unico posto dove si vede.
 *
 * La colonna «atteso» è 7 × le settimane presenti: è il numero che i pasti dovrebbero raggiungere per
 * non ripetere piatti dentro il ciclo.
 */

type Stato = 'vuota' | 'rotta' | 'da_validare' | 'magra' | 'completa';

interface ConteggioPasto {
  piatti: number;
  attivi: number;
  rotti: number;
}

interface Riga {
  id: string;
  name: string;
  style: string | null;
  regime: string;
  objective: string | null;
  mealsPerDay: number;
  fasting: boolean | null;
  status: string;
  clientVisible: boolean | null;
  siteVisible: boolean | null;
  settimane: number;
  giorni: number;
  attesoPerPasto: number;
  stato: Stato;
  dettaglio: string;
  perSlot: Record<string, ConteggioPasto | null>;
}

interface Risposta {
  righe: Riga[];
  riassunto: { varianti: number; complete: number; magre: number; daValidare: number; rotte: number; vuote: number };
}

const STATO: Record<Stato, { label: string; chip: string; spiega: string }> = {
  completa: { label: 'Completa', chip: '', spiega: 'Tutti i pasti hanno abbastanza piatti diversi per le settimane presenti.' },
  magra: { label: 'Magra', chip: 'amber', spiega: 'Qualche pasto ha meno piatti diversi del necessario: dentro il ciclo si ripetono.' },
  da_validare: { label: 'Da validare', chip: 'amber', spiega: 'I piatti ci sono ma nessuno è attivo: il motore non li usa e da fuori sembra vuota.' },
  rotta: { label: 'Riferimenti rotti', chip: 'red', spiega: 'Le giornate nominano ricette che non esistono più: quei pasti si vedono vuoti.' },
  vuota: { label: 'Vuota', chip: 'red', spiega: 'Nessuna giornata generata.' },
};

const SLOT: { chiave: string; titolo: string }[] = [
  { chiave: 'breakfast', titolo: 'Colazioni' },
  { chiave: 'morning_snack', titolo: 'Spuntini' },
  { chiave: 'lunch', titolo: 'Pranzi' },
  { chiave: 'afternoon_snack', titolo: 'Merende' },
  { chiave: 'dinner', titolo: 'Cene' },
];

const OBIETTIVO: Record<string, string> = { dimagrimento: 'Dimagrimento', mantenimento: 'Mantenimento' };

const strutturaLabel = (r: Riga) => (r.fasting ? 'Digiuno 16:8' : `${r.mealsPerDay} pasti`);

export function CoperturaCatalogo() {
  const { regimeLabel } = useTaxonomy();
  const [dati, setDati] = useState<Risposta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function carica() {
    setLoading(true);
    try {
      setDati(await api<Risposta>('/engine-rules/copertura'));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void carica(); }, []);

  const righe = dati?.righe ?? [];

  /** La cella di un pasto: piatti, attivi fra parentesi, e la ✕ se ci sono riferimenti rotti. */
  const cella = (c: ConteggioPasto | null, atteso: number) => {
    if (!c) return <span className="muted" title="Questa struttura non prevede questo pasto">—</span>;
    const manca = atteso > 0 && c.piatti < atteso;
    return (
      <span style={{ whiteSpace: 'nowrap' }}>
        <b style={manca ? { color: 'var(--amber, #b06a00)' } : undefined}>{c.piatti}</b>
        <span className="muted" style={{ fontSize: 12 }}> ({c.attivi})</span>
        {c.rotti > 0 && (
          <span style={{ color: 'var(--red, #b3261e)', fontWeight: 800 }} title={`${c.rotti} ricette nominate dalle giornate non esistono più`}>
            {' '}✕{c.rotti}
          </span>
        )}
      </span>
    );
  };

  const COLONNE: Colonna<Riga>[] = [
    { chiave: 'name', titolo: 'Dieta', valore: (r) => r.name, filtro: 'scelta', etichettaTutti: 'Tutte le diete' },
    { chiave: 'regime', titolo: 'Regime', valore: (r) => regimeLabel(r.regime), filtro: 'scelta', etichettaTutti: 'Tutti' },
    {
      chiave: 'objective', titolo: 'Obiettivo',
      valore: (r) => (r.objective ? OBIETTIVO[r.objective] ?? r.objective : null),
      filtro: 'scelta', etichettaTutti: 'Tutti',
    },
    { chiave: 'struttura', titolo: 'Pasti', valore: strutturaLabel, filtro: 'scelta', etichettaTutti: 'Tutte' },
    { chiave: 'settimane', titolo: 'Settimane', valore: (r) => r.settimane },
    { chiave: 'atteso', titolo: 'Atteso/pasto', valore: (r) => r.attesoPerPasto },
    ...SLOT.map<Colonna<Riga>>((s) => ({
      chiave: s.chiave,
      titolo: s.titolo,
      // Si ordina sui piatti presenti: è il numero che dice se quel pasto è pronto.
      valore: (r) => (r.perSlot[s.chiave] ? r.perSlot[s.chiave]!.piatti : null),
    })),
    {
      chiave: 'stato', titolo: 'Stato', valore: (r) => STATO[r.stato].label,
      filtro: 'scelta', etichettaTutti: 'Tutti gli stati',
      ordineScelte: ['Riferimenti rotti', 'Vuota', 'Da validare', 'Magra', 'Completa'],
    },
    {
      chiave: 'pubblicazione', titolo: 'Pubblicata',
      valore: (r) => (r.status === 'approved' ? (r.clientVisible ? 'Sì, visibile' : 'Sì, non visibile') : 'No'),
      filtro: 'scelta', etichettaTutti: 'Tutte',
    },
  ];

  const t = useTabella(righe, COLONNE, {
    perPagina: 200,
    ordineIniziale: { chiave: 'name' },
    testaFissa: true,
  });

  if (loading) return <Spinner />;

  const r = dati?.riassunto;

  return (
    <>
      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
          Ogni pasto ha <b>due numeri</b>: i piatti diversi che le giornate nominano, e fra parentesi
          quanti sono <b>attivi</b>, cioè quanti il motore usa davvero. Un piatto generato nasce in
          bozza e diventa attivo con la validazione — quindi <code>84 (0)</code> vuol dire «generata ma
          non validata»: i piatti ci sono e da fuori sembra vuota.
          {' '}
          Una <b style={{ color: 'var(--red, #b3261e)' }}>✕ rossa</b> è più grave: le giornate nominano
          ricette che <b>non esistono più</b>, quindi quei pasti si vedono vuoti davvero. I pasti stanno
          in un campo JSON senza vincoli, e questa colonna è l'unico posto dove quel buco si vede.
          {' '}
          «Atteso/pasto» è 7 × le settimane presenti.
        </p>
      </div>

      {r && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <span className="chip"><b>{r.varianti}</b> varianti</span>
          <span className="chip"><b>{r.complete}</b> complete</span>
          {r.magre > 0 && <span className="chip amber"><b>{r.magre}</b> magre</span>}
          {r.daValidare > 0 && <span className="chip amber"><b>{r.daValidare}</b> da validare</span>}
          {r.rotte > 0 && <span className="chip red"><b>{r.rotte}</b> con riferimenti rotti</span>}
          {r.vuote > 0 && <span className="chip red"><b>{r.vuote}</b> vuote</span>}
          <button className="btn ghost" onClick={() => void carica()}><i className="ti ti-refresh" /> Ricarica</button>
        </div>
      )}

      <div className="spread" style={{ marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Cerca dieta, regime, stato…"
          value={t.ricerca}
          onChange={(e) => t.setRicerca(e.target.value)}
        />
        <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="varianti" />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">Nessuna variante per questi filtri.</div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((row) => (
                <tr key={row.id}>
                  <td><b>{row.name}</b></td>
                  <td>{regimeLabel(row.regime)}</td>
                  <td>{row.objective ? OBIETTIVO[row.objective] ?? row.objective : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{strutturaLabel(row)}</td>
                  <td><b>{row.settimane}</b></td>
                  <td className="muted">{row.attesoPerPasto || '—'}</td>
                  {SLOT.map((s) => (
                    <td key={s.chiave}>{cella(row.perSlot[s.chiave], row.attesoPerPasto)}</td>
                  ))}
                  <td>
                    <span className={`chip ${STATO[row.stato].chip}`} title={`${STATO[row.stato].spiega}\n\n${row.dettaglio}`}>
                      {STATO[row.stato].label}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {row.status === 'approved'
                      ? (row.clientVisible ? 'Sì, visibile' : <span className="muted">Sì, non visibile</span>)
                      : <span className="muted">No</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
