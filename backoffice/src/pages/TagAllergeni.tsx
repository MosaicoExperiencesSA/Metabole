import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Pager, Spinner } from '../components/ui';
import { BottoneExcel, ContatoreRighe, useTabella, type Colonna } from '../components/tabella';
/**
 * ⚠️ **Il tipo della riga arriva da `Ricette.tsx`, non ce n'è più uno qui** (24/8). Questa pagina ne
 * aveva uno suo con sei campi, e bastava finché guardava solo nome, pasto, allergeni e stato. Da
 * quando apre «Modifica ricetta» servono anche regime, kcal, ingredienti e metodi di cottura — che
 * il server manda già, perché `listRecipes` fa `findMany` **senza `select`** e sono tutte colonne
 * non-null. Due tipi per la stessa riga sarebbero due tipi che un giorno divergono su un campo che
 * nessuna delle due pagine sta guardando in quel momento.
 */
import { RecipeModal, type Recipe } from './Ricette';
/**
 * ⚠️ **La finestra degli allergeni sta in `components/` dal 4/9**: la usa anche `RecipeModal`, su
 * una ricetta appena creata. Il perché del trasloco — e del ciclo di import evitato — è scritto
 * in cima a quel file.
 */
import { AllergeniModal, EU_ALLERGENS } from '../components/AllergeniModal';

const LABEL = new Map(EU_ALLERGENS.map((a) => [a.code, a.label]));

const MEAL: Record<string, string> = {
  breakfast: 'Colazione', morning_snack: 'Spuntino', lunch: 'Pranzo', afternoon_snack: 'Merenda', dinner: 'Cena',
};

/** Taggaggio allergeni delle ricette (R8): il nutrizionista conferma i tag (con pre-tag assistito). */
export function TagAllergeni({ scopeRegime }: { scopeRegime?: string } = {}) {
  const [rows, setRows] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Recipe | null>(null);
  /** La ricetta aperta in «Modifica ricetta» (il popup pieno), separata da quella aperta in allergeni. */
  const [modificando, setModificando] = useState<Recipe | null>(null);
  const [totale, setTotale] = useState(0);
  const [troncato, setTroncato] = useState(false);
  /**
   * ⚠️ IL FILTRO «DA RIVEDERE» GIRA SUL SERVER, non sulle righe ricevute (19/8, segnalazione del
   * nutrizionista: il riquadro del generatore diceva «4612 aspettano gli allergeni» e questa pagina
   * era vuota). Due cause, e la prima da sola bastava: la pagina chiedeva `includeInactive=false`,
   * mentre **tutte** le ricette che aspettano sono bozze (`active: false`) — non entravano nemmeno
   * nella query. E anche vedendole, il filtro in memoria avrebbe cercato dentro le mille righe che
   * il tetto aveva già scelto in ordine alfabetico.
   */
  const [soloDaRivedere, setSoloDaRivedere] = useState(true);
  /** Le righe spuntate per la conferma in blocco. */
  const [scelte, setScelte] = useState<Set<string>>(new Set());
  const [confermandoBlocco, setConfermandoBlocco] = useState(false);
  /** Falso quando il server non conosce ancora il filtro: vedi il riquadro in `load`. */
  const [serverFiltra, setServerFiltra] = useState(true);

  async function load() {
    setLoading(true);
    try {
      /**
       * ⚠️ `includeInactive=true`: le ricette che aspettano gli allergeni sono **bozze**, e con
       * `false` il server non le mandava affatto. È la riga che teneva vuota questa pagina mentre
       * 4612 ricette aspettavano.
       */
      const p = new URLSearchParams({ includeInactive: 'true' });
      if (scopeRegime) p.set('regime', scopeRegime);
      if (soloDaRivedere) p.set('daRivedere', 'true');
      const qs = `/recipes?${p.toString()}`;
      // `GET /recipes` risponde `{ items, total, troncato }` da quando i filtri girano sul
      // database (7/8): prima era un array nudo.
      const r = await api<{ items: Recipe[]; total: number; troncato?: boolean; filtroDaRivedere?: boolean }>(qs);
      setRows(r.items);
      setTotale(r.total ?? r.items.length);
      setTroncato(!!r.troncato);
      /**
       * ⚠️ IL SERVER DICE SE IL FILTRO L'HA APPLICATO DAVVERO (19/8).
       *
       * Il backoffice si pubblica in un minuto e il backend ci mette di più: in quella finestra
       * questa pagina manda `daRivedere=true` a un server che non lo conosce, riceve tutto il
       * catalogo e — senza questa eco — scriverebbe «aspettano gli allergeni 19347 ricette». Un
       * numero sbagliato con la faccia di un numero giusto è esattamente il difetto che questa
       * pagina è stata corretta per togliere: se l'eco non torna, si dice che il server è indietro.
       */
      setServerFiltra(soloDaRivedere ? r.filtroDaRivedere === true : true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata ai nutrizionisti.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { setScelte(new Set()); void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [scopeRegime, soloDaRivedere]);

  async function del(r: Recipe) {
    if (!confirm(`Eliminare la ricetta "${r.name}"?\nL'operazione non è reversibile.`)) return;
    setError(null); setNotice(null);
    try {
      await api(`/recipes/${r.id}`, { method: 'DELETE' });
      setNotice('Ricetta eliminata.');
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  const todo = rows.filter((r) => !r.allergensReviewed).length;

  /**
   * LA CONFERMA IN BLOCCO — decisione di Simone del 19/8.
   *
   * ⚠️ Non è una comodità: il generatore scrive ~4600 ricette a settimana, e confermarle una per
   * una aprendo un riquadro sono diciannove ore per svuotare un mucchio che nel frattempo si è
   * riempito di nuovo. Non è una pagina lenta, è una pagina che non si può usare.
   *
   * ⚠️ Gli allergeni **non si mandano da qui**: li ricalcola il server dagli ingredienti di adesso.
   * Il senso del gesto è «di queste mi fido del riconoscitore», e mandare l'elenco dal browser
   * vorrebbe dire scrivere in banca dati una fotografia vecchia — sulla cosa dove sbagliare fa più
   * male.
   *
   * ⚠️ A scaglioni di 500: una chiamata che ne tocca quattromila o riesce tutta o si perde tutta, e
   * non c'è modo di dire alla persona a che punto era.
   */
  async function confermaInBlocco() {
    const ids = [...scelte];
    if (!ids.length) return;
    if (!confirm(
      `Confermi gli allergeni di ${ids.length} ricett${ids.length === 1 ? 'a' : 'e'}?\n\n` +
      'Vengono presi gli allergeni riconosciuti dagli ingredienti, e le ricette che erano bozze ' +
      'ENTRANO IN CATALOGO: da quel momento il motore le può mettere nel piatto di una cliente.',
    )) return;
    setConfermandoBlocco(true);
    setError(null); setNotice(null);
    let confermate = 0; let attivate = 0;
    try {
      for (let i = 0; i < ids.length; i += 500) {
        const fetta = ids.slice(i, i + 500);
        const r = await api<{ confermate: number; attivate: number }>('/recipes/allergens/bulk', {
          method: 'POST', body: JSON.stringify({ ids: fetta }),
        });
        confermate += r.confermate; attivate += r.attivate;
      }
      setNotice(`${confermate} ricette confermate${attivate ? `, di cui ${attivate} entrate in catalogo` : ''}.`);
      setScelte(new Set());
      await load();
    } catch (e) {
      // ⚠️ Si dice quante erano già passate: «non è riuscito» su un'operazione a scaglioni farebbe
      // rifare da capo un lavoro per metà fatto.
      setError(
        `${e instanceof Error ? e.message : 'Conferma non riuscita.'}` +
        (confermate ? ` ⚠️ ${confermate} ricette erano già state confermate prima dell'errore: quelle restano.` : ''),
      );
      await load();
    } finally {
      setConfermandoBlocco(false);
    }
  }

  const tutteScelte = (righe: Recipe[]) => righe.length > 0 && righe.every((r) => scelte.has(r.id));

  const COLONNE: Colonna<Recipe>[] = [
    { chiave: 'ricetta', titolo: 'Ricetta', valore: (r) => r.name, filtro: 'testo' },
    { chiave: 'pasto', titolo: 'Pasto', valore: (r) => MEAL[r.mealSlot] ?? r.mealSlot, filtro: 'scelta', etichettaTutti: 'Tutti', stile: { width: 110 } },
    { chiave: 'allergeni', titolo: 'Allergeni', valore: (r) => (r.allergens ?? []).map((a) => LABEL.get(a) ?? a).join(', '), filtro: 'testo' },
    // «Da rivedere» prima di «Confermata»: è l'ordine del lavoro, non dell'alfabeto.
    { chiave: 'stato', titolo: 'Stato', valore: (r) => (r.allergensReviewed ? 'Confermata' : 'Da rivedere'), filtro: 'scelta', etichettaTutti: 'Tutti', ordineScelte: ['Da rivedere', 'Confermata'], stile: { width: 120 } },
    { chiave: 'azioni', titolo: 'Azioni', stile: { textAlign: 'right' } },
  ];

  /**
   * La pagina si apre su «Da rivedere», che è il lavoro da fare, ma il filtro è **uno**: la colonna
   * Stato. Prima c'era anche una spunta «Solo da rivedere» sopra la tabella, cioè due controlli
   * sullo stesso dato: con la spunta attiva la tendina della colonna offriva una voce sola, e chi
   * la usava non capiva perché non cambiasse niente. «Azzera filtri» apre a tutte le ricette.
   */
  const t = useTabella(rows, COLONNE, { testaFissa: true,
    ordineIniziale: { chiave: 'ricetta' },
    /**
     * ⚠️ Niente filtro iniziale sulla colonna Stato: adesso è il **server** a mandare solo quelle da
     * rivedere. Due controlli sullo stesso dato erano già stati tolti una volta da questa pagina, e
     * rimetterne uno qui vorrebbe dire che azzerando i filtri comparirebbero righe confermate che il
     * server non ha nemmeno mandato.
     */
    nomeExcel: 'Allergeni ricette',
  });

  // Come nel catalogo ricette: se il server ha mandato solo le prime righe, il file lo dice prima
  // di scaricarsi, invece di sembrare l'elenco completo una volta aperto. Il numero da dire è
  // quello che esce davvero: questa scheda si apre già filtrata su «Da rivedere», quindi le righe
  // esportate sono quasi sempre molte meno di quelle ricevute.
  const avvisoExport = troncato
    ? `Il catalogo ha ${totale} ricette e questa pagina ne ha ricevute solo le prime ${rows.length}.\n\nIl file conterrà le ${t.conteggio.mostrate} righe che vedi, scelte fra quelle ${rows.length} — non fra tutte e ${totale}.\n\nScarico lo stesso?`
    : undefined;

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          Conferma gli allergeni di ogni ricetta. Il motore usa <b>solo</b> ricette con allergeni confermati.
          {' '}⚠️ <b>Confermare gli allergeni fa entrare la ricetta in catalogo</b>: le ricette generate nascono
          come bozze, e la conferma è il gesto che le attiva. <b>{todo}</b> da rivedere qui.
        </p>
      </div>

      <div className="spread" style={{ marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="ricette" />
          <BottoneExcel tabella={t} avviso={avvisoExport} />
          {/*
            ⚠️ Questo interruttore cambia la DOMANDA AL SERVER, non un filtro sulle righe già
            ricevute: con 4612 da rivedere sparse su 19347 ricette, filtrare qui vorrebbe dire
            cercare dentro la fetta alfabetica che il tetto ha già scelto.
          */}
          <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 13 }}
            title="Chiede al server solo le ricette che aspettano gli allergeni, non un filtro su quelle già scaricate">
            <input type="checkbox" checked={soloDaRivedere} onChange={(e) => setSoloDaRivedere(e.target.checked)} />
            solo quelle da rivedere
          </label>
          {scelte.size > 0 && serverFiltra && (
            <button className="btn" disabled={confermandoBlocco} onClick={() => void confermaInBlocco()}>
              <i className="ti ti-checks" /> {confermandoBlocco ? 'Confermo…' : `Conferma le ${scelte.size} selezionate`}
            </button>
          )}
        </div>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Cerca in tutte le colonne…"
          value={t.ricerca}
          onChange={(e) => t.setRicerca(e.target.value)}
        />
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {/*
        ⚠️ Il rilascio a metà: backoffice nuovo, backend ancora vecchio. Dirlo è meglio che mostrare
        numeri che non tornano e un pulsante che risponde «Cannot POST».
      */}
      {!serverFiltra && (
        <Banner kind="err">
          Il server non conosce ancora il filtro «solo quelle da rivedere»: questa pagina è stata
          pubblicata prima del rilascio del backend. I numeri qui sotto sono quelli di <b>tutto</b> il
          catalogo, e la conferma in blocco non funziona finché il deploy non è finito. Ricarica fra
          qualche minuto.
        </Banner>
      )}
      {troncato && serverFiltra && (
        <Banner kind="info">
          {soloDaRivedere ? (
            <>
              Aspettano gli allergeni <b>{totale}</b> ricette; il server ne manda le prime <b>{rows.length}</b>.
              Confermane un blocco e la pagina si ricarica con le successive: il mucchio si svuota a scaglioni,
              non serve cercarle.
            </>
          ) : (
            <>
              Il catalogo ha <b>{totale}</b> ricette e il server ne manda le prime <b>{rows.length}</b> in ordine
              alfabetico: i filtri di questa tabella cercano solo fra queste. Una ricetta oltre l'elenco non
              compare nemmeno filtrando — non vuol dire che non ci sia.
            </>
          )}
        </Banner>
      )}

      <div className="card" style={{ padding: 0 }}>

        {/* Selettore di pagina anche sopra: stessa richiesta dell'11/8 sul catalogo ricette —

            su una tabella lunga cambiare pagina non deve costare due scorrimenti interi. */}

        <Pager {...t.pager} sopra />
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">
            {rows.length === 0
              ? 'Nessuna ricetta.'
              : todo === 0 && soloDaRivedere
                ? 'Tutte le ricette hanno gli allergeni confermati 🎉'
                : 'Nessuna ricetta con questi filtri.'}
          </div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {/*
                ⚠️ «Scegli tutte» sceglie le righe DI QUESTA PAGINA, non tutte quelle trovate: un
                interruttore che ne selezionasse quattromila senza mostrarle farebbe premere
                «Conferma» su un numero che nessuno ha guardato.
              */}
              <tr style={{ background: 'var(--chip)' }}>
                <td colSpan={5} style={{ padding: '6px 10px' }}>
                  <label className="row" style={{ gap: 8, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={tutteScelte(t.pagina)}
                      onChange={(e) => setScelte((s0) => {
                        const n = new Set(s0);
                        for (const r of t.pagina) { if (e.target.checked) n.add(r.id); else n.delete(r.id); }
                        return n;
                      })}
                    />
                    scegli le {t.pagina.length} di questa pagina{scelte.size > 0 ? ` · ${scelte.size} scelte in tutto` : ''}
                  </label>
                </td>
              </tr>
              {t.pagina.map((r) => (
                <tr key={r.id} onClick={() => setEditing(r)} style={{ cursor: 'pointer' }} title="Apri la revisione allergeni">
                  <td>
                    <label className="row" style={{ gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={scelte.has(r.id)}
                        onChange={() => setScelte((s0) => { const n = new Set(s0); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}
                      />
                      <b>{r.name}</b>
                    </label>
                  </td>
                  <td className="muted">{MEAL[r.mealSlot] ?? r.mealSlot}</td>
                  <td className="muted">{(r.allergens ?? []).map((a) => LABEL.get(a) ?? a).join(', ') || '—'}</td>
                  <td>
                    <span className={`chip ${r.allergensReviewed ? '' : 'gray'}`}>{r.allergensReviewed ? 'Confermata' : 'Da rivedere'}</span>
                    {/* ⚠️ «Bozza» si dice: confermare gli allergeni la fa entrare in catalogo, e chi
                        preme deve sapere che quel gesto non è solo un'etichetta. */}
                    {r.active === false && <span className="chip gray" style={{ marginLeft: 4 }}>bozza</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      {/*
                        ⚠️ **Due pulsanti, due nomi che dicono cosa aprono** (24/8). Prima questo si
                        chiamava «Modifica» quando la ricetta era già confermata e «Rivedi» quando
                        no: due nomi per lo stesso riquadro, e uno dei due — «Modifica» — è proprio
                        quello che adesso serve al popup della ricetta. Un'etichetta che cambia da
                        sola e che vuol dire un'altra cosa è il modo più facile per aprire la
                        finestra sbagliata su un catalogo da rivedere.
                      */}
                      <button className="btn ghost sm" title="Rivedi e conferma i 14 allergeni" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>Allergeni</button>
                      <button className="btn ghost sm" title="Correggi nome, kcal, ingredienti e cottura prima di confermare" onClick={(e) => { e.stopPropagation(); setModificando(r); }}><i className="ti ti-edit" /> Modifica ricetta</button>
                      <button className="btn ghost sm" title="Elimina ricetta" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); del(r); }}><i className="ti ti-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager {...t.pager} />
      </div>

      {/*
        ⚠️ **Dopo il salvataggio si RICARICA, non si aggiorna la riga a mano.** Il riquadro allergeni
        può permetterselo perché sa esattamente cosa ha scritto; qui no: il server può aver toccato
        campi che il modulo non ha mandato — in particolare **fa decadere** `allergensReviewed`
        quando cambiano gli ingredienti. Ritoccare la riga in memoria lascerebbe a schermo uno stato
        che il server ha già smentito, e su questa pagina quello stato è proprio la colonna che si
        sta lavorando.

        ⚠️ E si toglie la riga dalle SCELTE: il popup può cambiare regime e `active`, cioè può far
        uscire la ricetta dall'elenco che questa pagina sta chiedendo (dentro «Gestione dieta»
        l'elenco è filtrato per regime). La spunta resterebbe, il pulsante direbbe ancora «Conferma
        le N selezionate», e la conferma in blocco confermerebbe — facendola entrare in catalogo —
        una ricetta che nessuno vede più.
      */}
      {modificando && (
        <RecipeModal
          recipe={modificando}
          contesto="allergeni"
          onClose={() => setModificando(null)}
          onSaved={(avviso) => {
            const id = modificando.id;
            setModificando(null);
            setScelte((s0) => { const n = new Set(s0); n.delete(id); return n; });
            setError(null);
            setNotice(avviso ?? `«${modificando.name}» salvata.`);
            void load();
          }}
        />
      )}

      {editing && (
        <AllergeniModal
          recipe={editing}
          onClose={() => setEditing(null)}
          onSaved={(id, allergens) => {
            setRows((rs) => rs.map((x) => (x.id === id ? { ...x, allergens, allergensReviewed: true } : x)));
            setEditing(null);
            setNotice(`Allergeni di "${editing.name}" confermati.`);
          }}
        />
      )}
    </>
  );
}
