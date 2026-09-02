import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, PageHeader, Spinner } from '../components/ui';
import { NESSUN_FILTRO, comeSiLegge, numeriDaMostrare, passaIlFiltro, type Filtro } from './panieri-filtro';
import { RecipeModal, type Recipe } from './Ricette';

/**
 * I PANIERI — da dove arrivano i piatti di una cliente.
 *
 * ⚠️ **Non è il catalogo diete.** Una dieta è quello che una cliente segue; il paniere è l'insieme
 * dei piatti che il motore può metterle nel piatto, ed è **famiglia × regime**: molte varianti
 * diverse pescano dallo stesso. Fino a oggi questa tabella si poteva leggere solo con un tabulato
 * da shell — chi risponde di cosa mangiano le clienti non aveva modo di guardarci dentro.
 *
 * ⛔ **E chi tocca una riga qui cambia il menu di tutte insieme**, non la giornata di una: per
 * questo il pulsante «togli» c'è solo per chi ha `manage`, e ogni scrittura finisce nell'audit.
 *
 * ## Come si legge una cella
 *
 * ⚠️ I numeri sono **piatti diversi**, non righe di tabella: la stessa vellutata può stare a pranzo
 * e a cena, e conta una volta sola nel totale. E **spuntino e merenda hanno lo stesso numero**
 * perché sono un paniere solo (decisione dell'1/9: un piatto delle 10:30 va bene anche alle 17).
 *
 * ⛔ **E sono DUE numeri, non uno**: `84 (60)` vuol dire 84 piatti in paniere e 60 che il motore
 * userebbe davvero. Un piatto generato nasce in **bozza**, quindi un paniere con 200 piatti di cui
 * 20 attivi **è un paniere da 20** — e con un numero solo la pagina direbbe che va tutto bene
 * proprio nel caso peggiore, quello in cui il lavoro c'è e non arriva a nessuna cliente. È lo
 * stesso linguaggio della «Copertura catalogo», di proposito: chi legge l'una sa già leggere l'altra.
 *
 * ⚠️ Quello che qui **non** c'è, e nella copertura per variante sì, sono i **riferimenti rotti**:
 * nel paniere non possono esistere, perché la tabella ha una chiave esterna e una ricetta cancellata
 * si porta via le sue righe. Nelle giornate, che tengono i pasti in un JSON senza vincoli, restano
 * lì e non li vede nessuno. È uno dei guadagni della riforma, e vale la pena saperlo.
 */

const SLOT = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'] as const;
const NOME_SLOT: Record<string, string> = {
  breakfast: 'Colazione',
  morning_snack: 'Spuntino',
  lunch: 'Pranzo',
  afternoon_snack: 'Merenda',
  dinner: 'Cena',
};
const NOME_REGIME: Record<string, string> = {
  omnivore: 'Onnivoro',
  pescetarian: 'Pescetariano',
  vegetarian: 'Vegetariano',
  vegan: 'Vegano',
};

interface Conteggio {
  piatti: number;
  attivi: number;
}

interface Cella {
  famiglia: string;
  regime: string;
  esiste: boolean;
  impossibile: string | null;
  perSlot: Record<string, Conteggio>;
  totale: number;
  totaleAttivi: number;
}

interface Ricetta {
  id: string;
  name: string;
  kcal: number;
  mealSlot: string;
  active: boolean;
}

export function Panieri() {
  const { can } = useAuth();
  const puoGestire = can('panieri', 'manage');
  /**
   * ⛔ **«Modifica» è una porta sul CATALOGO, non sul paniere, e vuole la chiave del catalogo.**
   * Il popup salva con `PATCH /recipes/:id`, protetto da `recipes`: mostrare il pulsante a chi ha
   * solo `panieri` vorrebbe dire farlo compilare un modulo che al «Salva» risponde 403. Una porta
   * che si apre e non si chiude è peggio di una porta che non c'è.
   */
  const puoModificare = can('recipes');
  const [celle, setCelle] = useState<Cella[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  /** La cella aperta, e per quale pasto: `null` = nessuna. */
  const [aperta, setAperta] = useState<{ cella: Cella; slot: string } | null>(null);
  const [ricette, setRicette] = useState<Ricetta[] | null>(null);
  /** La ricetta aperta nel popup «Modifica ricetta», caricata intera: la tabella ne ha solo un pezzo. */
  const [inModifica, setInModifica] = useState<Recipe | null>(null);
  /**
   * ⛔ **I due pulsanti valgono per TUTTA la pagina** — i numeri della matrice e l'elenco che si
   * apre sotto. Un filtro che cambiasse solo l'elenco farebbe leggere due verità diverse nella
   * stessa schermata. Entrambi spenti (o entrambi accesi) = tutto.
   */
  const [filtro, setFiltro] = useState<Filtro>(NESSUN_FILTRO);

  async function carica() {
    try {
      setCelle(await api<Cella[]>('/panieri'));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Caricamento non riuscito.');
    }
  }

  useEffect(() => { void carica(); }, []);

  async function apri(cella: Cella, slot: string) {
    if (!cella.esiste) return;
    setAperta({ cella, slot });
    setRicette(null);
    try {
      const r = await api<Ricetta[]>(
        `/panieri/${encodeURIComponent(cella.famiglia)}/${cella.regime}/ricette?slot=${slot}`,
      );
      setRicette(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Non sono riuscito a leggere le ricette.');
      setAperta(null);
    }
  }

  /**
   * ⚠️ La riga della tabella ha cinque campi; il popup ne vuole tutta la scheda — ingredienti,
   * metodi, stagioni. Si ricarica dal server invece di allargare la risposta dei panieri: quella
   * sta dietro la chiave `panieri`, e allargarla darebbe la scheda completa delle ricette a chi ha
   * solo i panieri.
   */
  async function apriModifica(r: Ricetta) {
    setError(null);
    try {
      setInModifica(await api<Recipe>(`/recipes/${r.id}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Non riesco ad aprire la ricetta.');
    }
  }

  async function togli(r: Ricetta) {
    if (!aperta) return;
    const { cella, slot } = aperta;
    /**
     * ⚠️ La conferma dice **cosa cambia per le clienti**, non «sei sicuro?»: chi preme questo
     * pulsante toglie un piatto dal pool di tutte quelle del paniere, e la frase deve dirlo.
     */
    const quante = cella.perSlot[slot]?.piatti ?? 0;
    if (!confirm(
      `Togliere «${r.name}» dal paniere ${cella.famiglia} · ${NOME_REGIME[cella.regime] ?? cella.regime}?\n\n`
      + `Non lo riceverà più nessuna cliente di questo paniere per ${NOME_SLOT[slot]?.toLowerCase() ?? slot}. `
      + `Ne restano ${Math.max(0, quante - 1)}.`,
    )) return;
    try {
      await api('/panieri/ricetta', {
        method: 'DELETE',
        body: JSON.stringify({ famiglia: cella.famiglia, regime: cella.regime, slot, recipeId: r.id }),
      });
      setRicette((v) => (v ?? []).filter((x) => x.id !== r.id));
      setAvviso(`«${r.name}» tolta dal paniere.`);
      await carica();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Non sono riuscito a togliere la ricetta.');
    }
  }

  /** ⚠️ Filtrate qui e non nella query: l'API rende il paniere intero, e i due pulsanti si premono
   * e si spengono in continuazione — una chiamata a ogni clic sarebbe attesa per niente. */
  const ricetteMostrate = useMemo(
    () => (ricette ?? []).filter((r) => passaIlFiltro(r.active, filtro)),
    [ricette, filtro],
  );
  const spiegazione = comeSiLegge(filtro);

  const famiglie = useMemo(() => [...new Set((celle ?? []).map((c) => c.famiglia))], [celle]);
  const regimi = useMemo(() => [...new Set((celle ?? []).map((c) => c.regime))], [celle]);
  const cellaDi = (famiglia: string, regime: string) =>
    (celle ?? []).find((c) => c.famiglia === famiglia && c.regime === regime);

  return (
    <div className="page">
      <PageHeader title="Panieri" />
      {error && <Banner kind="err">{error}</Banner>}
      {avviso && <Banner kind="ok">{avviso}</Banner>}

      <p className="muted" style={{ maxWidth: 760 }}>
        Il paniere è <strong>da dove arrivano i piatti</strong> di una cliente: famiglia × regime.
        Molte varianti diverse pescano dallo stesso. I numeri sono piatti <strong>diversi</strong>,
        non righe: la stessa vellutata a pranzo e a cena conta una volta sola.
        Spuntino e merenda hanno lo stesso numero perché sono un paniere solo.
        {' '}<strong>Fra parentesi</strong> quanti il motore userebbe davvero: gli altri sono bozze
        da validare, e finché lo sono a nessuna cliente arrivano.
      </p>

      {/*
        ⛔ Due pulsanti, non un menu a tendina: gli stati sono tre e si premono cento volte in
        un'ora. E si accendono e si spengono da soli — premere «solo attive» due volte torna a
        mostrare tutto, che è la strada d'uscita più corta da un filtro acceso per sbaglio.
      */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0 4px' }}>
        <button
          type="button"
          className={filtro.attive ? 'btn sm' : 'btn ghost sm'}
          aria-pressed={filtro.attive}
          title="I piatti che il motore userebbe davvero, adesso."
          onClick={() => setFiltro((f) => ({ ...f, attive: !f.attive }))}
        >
          Mostra solo attive
        </button>
        <button
          type="button"
          className={filtro.bozze ? 'btn sm' : 'btn ghost sm'}
          aria-pressed={filtro.bozze}
          title="I piatti che stanno nel paniere ma a nessuna cliente arrivano, finché qualcuno non li valida."
          onClick={() => setFiltro((f) => ({ ...f, bozze: !f.bozze }))}
        >
          Mostra solo in bozza
        </button>
      </div>
      {/*
        ⛔ **Un filtro acceso senza una frase che lo dica è un numero sbagliato.** Chi torna su
        questa pagina dopo dieci minuti legge «498 piatti» e non ha modo di sapere che ne sta
        guardando un pezzo.
      */}
      {spiegazione && <Banner kind="info">{spiegazione}</Banner>}

      {!celle ? <Spinner /> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Famiglia</th>
                {regimi.map((r) => <th key={r}>{NOME_REGIME[r] ?? r}</th>)}
              </tr>
            </thead>
            <tbody>
              {famiglie.map((f) => (
                <tr key={f}>
                  <td><strong>{f}</strong></td>
                  {regimi.map((rg) => {
                    const c = cellaDi(f, rg);
                    if (!c) return <td key={rg} />;
                    if (c.impossibile) {
                      return (
                        <td key={rg} title={c.impossibile} style={{ color: 'var(--muted)' }}>
                          — non possibile
                        </td>
                      );
                    }
                    if (!c.esiste) {
                      return <td key={rg} style={{ color: 'var(--muted)' }}>paniere non creato</td>;
                    }
                    const tot = numeriDaMostrare({ piatti: c.totale, attivi: c.totaleAttivi }, filtro);
                    return (
                      <td key={rg}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                          {tot.quanti} piatti
                          {tot.fraParentesi !== null && (
                            <span
                              style={{ fontWeight: 400, color: c.totaleAttivi < c.totale ? 'var(--warn, #b45309)' : 'var(--muted)' }}
                              title="Fra parentesi quanti il motore userebbe davvero: gli altri sono bozze da validare."
                            >
                              {' '}({c.totaleAttivi})
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {SLOT.map((sl) => {
                            const n = numeriDaMostrare(c.perSlot[sl] ?? { piatti: 0, attivi: 0 }, filtro);
                            return (
                              <button
                                key={sl}
                                className="btn ghost"
                                style={{ padding: '2px 6px', fontSize: 12 }}
                                title={`${NOME_SLOT[sl]}: ${c.perSlot[sl]?.piatti ?? 0} piatti, di cui ${c.perSlot[sl]?.attivi ?? 0} che il motore userebbe davvero — apri l'elenco`}
                                onClick={() => void apri(c, sl)}
                              >
                                {NOME_SLOT[sl]?.slice(0, 3)} {n.quanti}
                                {n.fraParentesi !== null && <> ({c.perSlot[sl]?.attivi ?? 0})</>}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aperta && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>
              {aperta.cella.famiglia} · {NOME_REGIME[aperta.cella.regime] ?? aperta.cella.regime} · {NOME_SLOT[aperta.slot]}
            </h2>
            <button className="btn ghost" onClick={() => { setAperta(null); setRicette(null); }}>Chiudi</button>
          </div>
          {(aperta.slot === 'morning_snack' || aperta.slot === 'afternoon_snack') && (
            <p className="muted" style={{ marginTop: 4 }}>
              ⚠️ Spuntino e merenda pescano dallo stesso paniere: qui sotto ci sono i piatti di
              tutti e due, ed è quello che vede la cliente.
            </p>
          )}
          {!ricette ? <Spinner /> : ricetteMostrate.length === 0 ? (
            /**
             * ⚠️ **Due frasi diverse per due fatti diversi.** «Non ce ne sono» e «ce ne sono ma i
             * pulsanti li stanno nascondendo» portano a due azioni opposte: nel secondo caso chi
             * legge deve sapere che basta spegnere un pulsante, o cercherà un guasto nel paniere.
             */
            <p className="muted">
              {ricette.length === 0
                ? 'Nessun piatto per questo pasto.'
                : `Nessuno dei ${ricette.length} piatti di questo pasto passa il filtro qui sopra.`}
            </p>
          ) : (
            <table className="table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Piatto</th><th>kcal</th><th>Stato</th>{puoModificare && <th />}{puoGestire && <th />}
                </tr>
              </thead>
              <tbody>
                {ricetteMostrate.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.kcal}</td>
                    <td>{r.active ? 'attiva' : <span style={{ color: 'var(--muted)' }}>bozza — il motore non la usa</span>}</td>
                    {puoModificare && (
                      <td>
                        <button className="btn ghost" onClick={() => void apriModifica(r)} title="Apri la scheda della ricetta">
                          Modifica
                        </button>
                      </td>
                    )}
                    {puoGestire && (
                      <td>
                        <button className="btn ghost" onClick={() => void togli(r)}>Togli dal paniere</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/*
        ⛔ **Lo stesso popup della pagina Ricette, non una copia.** Due schede della stessa ricetta
        in due punti diversi divergono al primo campo aggiunto da una parte sola — ed è già successo
        con «Allergeni ricette», che per questo lo riusa da mesi.

        ⚠️ Dopo un salvataggio si ricarica **tutto**: cambiare il regime o spegnere una ricetta
        cambia i conti della matrice, e lasciare i numeri vecchi sotto un popup appena chiuso è il
        modo più diretto per far credere che il salvataggio non abbia funzionato.
      */}
      {inModifica && (
        <RecipeModal
          recipe={inModifica}
          onClose={() => setInModifica(null)}
          onSaved={() => {
            setInModifica(null);
            void carica();
            if (aperta) void apri(aperta.cella, aperta.slot);
          }}
        />
      )}
    </div>
  );
}
