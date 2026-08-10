/**
 * LE PREFERENZE DELLA HOME, lette una volta e condivise.
 *
 * Due richieste di Simone dell'11/8 finiscono nello stesso posto:
 * - «tutti i moduli della dashboard, anche portafoglio ecc, devono essere attivabili e disattivabili»
 *   → quali blocchi mostrare (`dashboardBlocksOff`);
 * - «rendila scorrevole con la possibilità di selezionare quante righe vedere… poi salva le
 *   preferenze» → quante righe per pagina (`righePerPagina`).
 *
 * Sta in un hook e non dentro le due home perché le home sono due (coach e nutrizionista) e la
 * pagina Impostazioni è una terza: tre copie della stessa lettura sono tre occasioni di leggere una
 * chiave con un nome diverso.
 *
 * ## Il dettaglio che evita lo sfarfallio
 *
 * Finché le preferenze non sono arrivate, `pronto` è falso e i blocchi si considerano **accesi**. Il
 * contrario — nascondere tutto e accendere dopo — farebbe lampeggiare la home a ogni apertura. Un
 * blocco che compare per un attimo e poi sparisce è meno fastidioso di una pagina che nasce vuota.
 */
import { useEffect, useState } from 'react';
import { api } from '../api/client';

/** Le quattro scelte del selettore. Devono restare uguali a `RIGHE_AMMESSE` del backend. */
export const RIGHE_OPZIONI = [10, 25, 50, 100];
export const RIGHE_DEFAULT = 10;

interface Preferenze {
  dashboardBlocksOff?: string[] | null;
  righePerPagina?: number | null;
}

export function usePreferenzeHome() {
  const [spenti, setSpenti] = useState<string[]>([]);
  const [righe, setRighe] = useState<number>(RIGHE_DEFAULT);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    api<Preferenze>('/me/preferences')
      .then((p) => {
        setSpenti(p.dashboardBlocksOff ?? []);
        setRighe(RIGHE_OPZIONI.includes(p.righePerPagina ?? 0) ? (p.righePerPagina as number) : RIGHE_DEFAULT);
      })
      .catch(() => { /* preferenze non disponibili: si resta sui valori di partenza */ })
      .finally(() => setPronto(true));
  }, []);

  /** Salva subito e applica localmente: il selettore non deve aspettare la rete per muoversi. */
  async function salvaRighe(n: number) {
    setRighe(n);
    try { await api('/me/preferences', { method: 'PUT', body: JSON.stringify({ righePerPagina: n }) }); }
    catch { /* la scelta resta applicata per questa sessione */ }
  }

  return {
    /** true se quel blocco va mostrato. Prima che le preferenze arrivino: sì. */
    attivo: (id: string) => !spenti.includes(id),
    righe,
    salvaRighe,
    pronto,
  };
}
