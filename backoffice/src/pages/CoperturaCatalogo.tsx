import { useEffect, useMemo, useState } from 'react';
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

  /**
   * LA CELLA DI UN PASTO — il colore dice se è validato, il numero dice quanti piatti.
   *
   * Richiesta di Simone dell'11/8: «se i pranzi e le cene me li metti gialli da validare, verdi da
   * validati, così abbiamo anche questo dato». Due informazioni diverse su una cella sola, e vale la
   * pena tenerle separate:
   *  - il **colore** è lo stato della validazione: verde = tutti i piatti sono attivi, cioè il motore
   *    li usa; giallo = ci sono ma sono in bozza, quindi da fuori quella settimana sembra vuota;
   *    rosso = c'è qualcosa di rotto (riferimenti morti, o nessun piatto);
   *  - il **numero** è la quantità: quando i piatti sono meno del necessario si scrive come frazione
   *    (`60/84`), che dice il buco senza aver bisogno di un secondo colore.
   *
   * Ogni colore ha anche un **simbolo** (✓ ⏳ ✕): un'informazione affidata al solo colore si perde per
   * chi non lo distingue, e in uno screenshot mandato su WhatsApp si perde per tutti.
   */
  const cella = (c: ConteggioPasto | null, atteso: number) => {
    if (!c) return <span className="muted" title="Questa struttura non prevede questo pasto">—</span>;

    const verde = { colore: '#0a7d55', fondo: 'rgba(10,125,85,0.10)' };
    const giallo = { colore: '#8a5a00', fondo: 'rgba(255,193,7,0.18)' };
    const rosso = { colore: '#b3261e', fondo: 'rgba(179,38,30,0.10)' };

    const manca = atteso > 0 && c.piatti < atteso;
    const quantita = manca ? `${c.piatti}/${atteso}` : `${c.piatti}`;

    let stile = verde;
    let simbolo = '✓';
    let spiega = `${c.piatti} piatti diversi, tutti attivi: il motore li usa.`;

    if (c.rotti > 0) {
      stile = rosso;
      simbolo = `✕${c.rotti}`;
      spiega = `${c.rotti} ricette nominate dalle giornate non esistono più: questi pasti si vedono vuoti.`;
    } else if (c.piatti === 0) {
      stile = rosso;
      simbolo = '✕';
      spiega = 'Nessun piatto: questo pasto non è mai stato generato.';
    } else if (c.attivi === 0) {
      stile = giallo;
      simbolo = '⏳';
      spiega = `${c.piatti} piatti generati ma NESSUNO attivo: da validare. Finché sono in bozza il motore non li usa, e da fuori la settimana sembra vuota.`;
    } else if (c.attivi < c.piatti) {
      stile = giallo;
      simbolo = `⏳ ${c.attivi}/${c.piatti}`;
      spiega = `${c.attivi} piatti attivi su ${c.piatti}: la validazione è passata a metà.`;
    }
    if (manca && c.rotti === 0 && c.piatti > 0) {
      spiega += ` Servirebbero ${atteso} piatti diversi per ${Math.round(atteso / 7)} settimane senza ripetizioni.`;
    }

    return (
      <span
        title={spiega}
        style={{
          whiteSpace: 'nowrap',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: stile.fondo,
          color: stile.colore,
          borderRadius: 6,
          padding: '2px 7px',
          fontWeight: 800,
          fontSize: 13,
        }}
      >
        {quantita}
        <span style={{ fontWeight: 700, fontSize: 12 }}>{simbolo}</span>
      </span>
    );
  };

  /** I numeri di settimane presenti, in ordine numerico: la tendina non offre scelte vuote. */
  const settimaneDisponibili = useMemo(
    () => [...new Set(righe.map((r) => r.settimane))].sort((a, b) => a - b).map(String),
    [righe],
  );

  const COLONNE: Colonna<Riga>[] = [
    { chiave: 'name', titolo: 'Dieta', valore: (r) => r.name, filtro: 'scelta', etichettaTutti: 'Tutte le diete' },
    { chiave: 'regime', titolo: 'Regime', valore: (r) => regimeLabel(r.regime), filtro: 'scelta', etichettaTutti: 'Tutti' },
    {
      chiave: 'objective', titolo: 'Obiettivo',
      valore: (r) => (r.objective ? OBIETTIVO[r.objective] ?? r.objective : null),
      filtro: 'scelta', etichettaTutti: 'Tutti',
    },
    { chiave: 'struttura', titolo: 'Pasti', valore: strutturaLabel, filtro: 'scelta', etichettaTutti: 'Tutte' },
    {
      chiave: 'settimane',
      titolo: 'Settimane',
      valore: (r) => r.settimane,
      /**
       * Filtro per numero di settimane (11/8). Serve a isolare le varianti rimaste indietro: con
       * tutte a 12 la colonna non dice niente, con il filtro si trovano le tre che sono a 2.
       *
       * `ordineScelte` è calcolato in ordine NUMERICO: le scelte di una tendina sono testo, e in
       * ordine alfabetico verrebbe 1, 10, 11, 12, 2 — corretto e inservibile.
       */
      filtro: 'scelta',
      etichettaTutti: 'Tutte',
      ordineScelte: settimaneDisponibili,
      etichetta: (v) => (v === '0' ? 'nessuna settimana' : v === '1' ? '1 settimana' : `${v} settimane`),
    },
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
          Su ogni pasto il <b>colore dice se è validato</b> e il numero dice quanti piatti diversi ci
          sono. Quando i piatti sono meno del necessario il numero diventa una frazione
          (<code>60/84</code>): «atteso» è 7 × le settimane presenti, cioè quanti piatti servono per non
          ripetere niente dentro il ciclo.
        </p>
        <div className="row" style={{ gap: 14, flexWrap: 'wrap', marginTop: 12, fontSize: 13 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: 'rgba(10,125,85,0.10)', color: '#0a7d55', borderRadius: 6, padding: '2px 7px', fontWeight: 800 }}>84 ✓</span>
            validato: il motore usa questi piatti
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: 'rgba(255,193,7,0.18)', color: '#8a5a00', borderRadius: 6, padding: '2px 7px', fontWeight: 800 }}>84 ⏳</span>
            da validare: i piatti ci sono ma sono in bozza, e da fuori la settimana <b>sembra vuota</b>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: 'rgba(179,38,30,0.10)', color: '#b3261e', borderRadius: 6, padding: '2px 7px', fontWeight: 800 }}>84 ✕3</span>
            rotto: le giornate nominano ricette che <b>non esistono più</b>, quei pasti sono vuoti davvero
          </span>
          <span className="muted">— = questa struttura non prevede quel pasto (es. la colazione nel digiuno 16:8)</span>
        </div>
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
