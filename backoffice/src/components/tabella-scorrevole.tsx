import { ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { altezzaPerRighe } from '../lib/altezza-righe';

/**
 * UNA TABELLA ALTA DIECI RIGHE, CHE SCORRE DENTRO LA SUA CARD.
 *
 * Richiesta di Simone (24/8): «sia questa tabella che quella dei passi facciamola scorrevole e alta
 * 10 righe», e subito dopo «10 righe mostrate e valori scorrevoli anche per la tabella pesate e
 * quella check umori». In scheda cliente quelle quattro tabelle arrivano fino a **sessanta** righe
 * l'una: aperte tutte, la pagina era lunga quattro schermate e le card che stanno sotto (report,
 * provvigioni, note) erano irraggiungibili senza rotella.
 *
 * ## Perché l'altezza si MISURA invece di scriverla
 *
 * «Dieci righe» in CSS si scriverebbe con un `max-height` a occhio, tipo `410px`. Sarebbe sbagliato
 * al primo caso vero: nelle pesate una riga corretta dalla cliente porta con sé una seconda riga
 * («sostituita · era 78 kg»), negli umori una chip può andare a capo su finestra stretta, e chi
 * cambia il corpo del testo dal browser sposta tutto. Un numero scritto a mano diventerebbe «nove
 * righe e mezza» — e la mezza riga tagliata in fondo è proprio il difetto che si sta chiudendo.
 * Qui si misurano le prime dieci righe VERE, con l'intestazione, e si rimisura quando la finestra
 * o il contenuto cambiano.
 *
 * ⚠️ **Se le righe ci stanno tutte, nessun limite**: una tabella con tre pesate non deve avere una
 * barra di scorrimento né uno spazio vuoto sotto. Il limite nasce solo quando c'è qualcosa da
 * nascondere.
 *
 * ⚠️ **E c'è già un altro modo di far scorrere una tabella in questo repo**: `stileScorrevole` in
 * `components/tabella.tsx`, usata da «Valori nutrizionali» e dalla home della coach, che l'altezza
 * la SCRIVE (`righe × 56 + 96`). Va bene dove le righe sono tutte uguali e non c'è niente da
 * misurare; qui no, e le due convivono apposta — chi ne aggiunge una terza guardi prima queste due.
 *
 * ⚠️ **Il fondo non deve mentire.** Una tabella tagliata di netto sull'ultima riga si legge come
 * «finita»: qui l'ultima riga visibile resta mezza scoperta e in cima all'area si incolla
 * l'intestazione, così scorrendo si sa sempre quale colonna si sta leggendo.
 */
export function TabellaScorrevole({
  righe = 10,
  quante,
  etichetta,
  children,
}: {
  /** Quante righe restano in vista prima di dover scorrere. */
  righe?: number;
  /** Quante righe ha la tabella: serve a rimisurare quando i dati cambiano. */
  quante: number;
  /** Come si chiama quest'area per chi naviga a tastiera o con lo screen reader. */
  etichetta: string;
  children: ReactNode;
}) {
  const rif = useRef<HTMLDivElement | null>(null);
  const [altezza, setAltezza] = useState<number | null>(null);

  const misura = useCallback(() => {
    const tabella = rif.current?.querySelector('table');
    if (!tabella) return;
    const corpo = tabella.tBodies[0];
    const testa = (tabella.tHead as HTMLElement | null)?.offsetHeight ?? 0;
    const alte = (corpo ? Array.from(corpo.rows) : []).map((r) => r.offsetHeight);
    // Il conto sta in `lib/altezza-righe.ts`, dove si può provare: qui dentro nessun test lo
    // eseguirebbe mai (i test del backoffice girano senza DOM, quindi tutte le altezze sono zero).
    setAltezza(altezzaPerRighe(testa, alte, righe));
  }, [righe]);

  useLayoutEffect(() => {
    misura();
    if (typeof ResizeObserver === 'undefined') return;
    /**
     * ⛔ **SI OSSERVA LA TABELLA, NON IL CONTENITORE** — rilievo della revisione del 24/8. Al
     * contenitore l'altezza gliela pinza questo componente: una volta messo il limite quel box non
     * cambia più, quindi il contenuto poteva crescere quanto voleva senza che nessuno rimisurasse.
     * Il caso vero: la coach corregge una pesata, la riga guadagna la seconda riga «sostituita ·
     * era 78 kg» e diventa più alta — il numero di righe non cambia, l'altezza sì, e la decima
     * riga restava tagliata a metà. Cioè il difetto che questo componente esiste per chiudere.
     * (Stesso effetto quando il carattere delle icone arriva dopo il primo disegno della pagina.)
     */
    const tabella = rif.current?.querySelector('table');
    const osservatore = new ResizeObserver(() => misura());
    if (tabella) osservatore.observe(tabella);
    if (rif.current) osservatore.observe(rif.current);
    return () => osservatore.disconnect();
  }, [misura, quante]);

  return (
    /**
     * ⚠️ `tabIndex` e `role`: un `<div>` che scorre **non** è raggiungibile da tastiera. Senza
     * questa riga, chi non usa il mouse vedrebbe dieci pesate su sessanta e non avrebbe modo di
     * arrivare alle altre cinquanta — prima scorreva la pagina, e la pagina si scorre con le frecce.
     * Nascondere righe è una decisione di impaginazione; renderle irraggiungibili è un'altra cosa.
     */
    <div
      ref={rif}
      className="tabella-scorrevole"
      tabIndex={0}
      role="region"
      aria-label={etichetta}
      style={altezza ? { maxHeight: altezza } : undefined}
    >
      {children}
    </div>
  );
}
