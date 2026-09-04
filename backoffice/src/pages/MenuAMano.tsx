import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { Banner, Modal, Spinner } from '../components/ui';
import { conta, MOTIVO_MINIMO, nomePasto, type Scelta } from '../lib/giornataAMano';

/**
 * ⛔ **IL MENU SCRITTO A MANO DALLA SCHEDA CLIENTE — la via d'uscita che il 31/8 non c'era.**
 *
 * Con una cliente senza menu sarebbe stata la soluzione in cinque minuti. Disegno concordato con
 * Simone: si sceglie una data, e per ogni pasto si cerca nel catalogo. Tre cose lo rendono utile
 * invece che pericoloso:
 *
 * · la ricerca è **già filtrata sulle sue esclusioni** — le incompatibili compaiono **barrate col
 *   motivo**, e servirle richiede di forzare e **scrivere perché**;
 * · le **kcal si sommano** mentre scegli, col target davanti;
 * · il giorno scritto a mano è **intoccabile** dalla passata notturna e da «Rigenera menu».
 *
 * ## ⚠️ Sta in un file suo
 *
 * `ClientDetail.tsx` è a più di quattromila righe. Questa schermata ha uno stato tutto suo — una
 * ricerca per pasto, le scelte, i motivi delle forzature — e infilarcela dentro vorrebbe dire
 * mescolarlo con quello di tutte le altre card.
 *
 * ## ⛔ Il verdetto è del SERVER
 *
 * Qui si mostra quello che si sta componendo; se la giornata si può scrivere lo decide il backend,
 * che conosce gli slot della sua dieta, il fabbisogno e le esclusioni. Il pulsante si accende
 * quando non c'è più niente che *questa schermata* sappia essere sbagliato, e il messaggio del
 * server è quello che si legge. Ricopiare qui la regola vorrebbe dire due copie che divergono —
 * e la divergenza si chiamerebbe «il pulsante era acceso e il salvataggio ha detto di no».
 */

interface RigaRicetta {
  recipeId: string;
  nome: string;
  kcal: number;
  slot: string;
  bloccata: boolean;
  motivoBlocco: string | null;
  /**
   * ⚠️ Vero quando il piatto **non** è nel paniere della cliente: si può scegliere, ma è
   * un'eccezione e va detto. Chi lo sceglie non deve credere che le arrivasse comunque.
   */
  fuoriDalPaniere?: boolean;
}

interface Cornice {
  data: string;
  slotAttesi: string[];
  targetKcal: number | null;
  tolleranzaPct: number;
  esistente: { scrittaAMano: boolean; giaAperto: boolean; nonSappiamo: boolean } | null;
}

/**
 * ⚠️ **Il giorno di ROMA, non quello UTC.** `toISOString().slice(0,10)` prima delle due di notte
 * apre la schermata su **ieri**: è lo stesso errore già corretto due volte nel progetto
 * (`daQuandoSiPuoRifare`, il kit di rientro). `giornoIso` di `lib/giorno.ts` normalizza un testo,
 * non dà «oggi»: qui si chiede il giorno al fuso di Roma e basta.
 */
const oggiISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });

export function MenuAMano({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [data, setData] = useState(oggiISO());
  const [cornice, setCornice] = useState<Cornice | null>(null);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<string | null>(null);
  const [scelte, setScelte] = useState<Record<string, Scelta>>({});
  const [slotAperto, setSlotAperto] = useState<string | null>(null);
  const [cerca, setCerca] = useState('');
  /**
   * ⛔ **Cercare in TUTTO il catalogo e non solo nel suo paniere** (Simone, 4/9). È la ragione per
   * cui i menu passavano dalla chat: se il piatto giusto stava fuori dal pool, da qui non si
   * trovava. ⚠️ Il regime della cliente resta un cancello anche fuori: lo applica il server.
   */
  const [tuttoIlCatalogo, setTuttoIlCatalogo] = useState(false);
  /**
   * ⛔ **Quante ricette il server ha tagliato via, quando le ha tagliate.** Dentro il paniere non
   * succedeva mai (sono decine); fuori sono ventimila e il taglio scatta a ogni ricerca corta.
   * Il campo tornava già e non lo leggeva nessuno — cioè il silenzio di prima, con un campo in più:
   * chi cerca «zuppa» scorrendo duecento nomi in ordine alfabetico conclude che non ce ne siano.
   */
  const [taglio, setTaglio] = useState<number | null>(null);
  const [risultati, setRisultati] = useState<RigaRicetta[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [ricarica, setRicarica] = useState(0);
  /**
   * ⛔ **La conferma è un SECONDO passo, non un flag che il codice si mette da solo.** La prima
   * stesura calcolava `conferma` nello stesso clic — quindi non era una conferma — e, peggio,
   * sbagliava insieme: per una cliente **senza fabbisogno calcolabile** il server manda un avviso,
   * il client calcolava `false`, e il salvataggio rispondeva 400 **senza nessun modo di riprovare**.
   * Cioè la giornata non si poteva scrivere, mai, proprio alla cliente appena entrata — il caso del
   * 31/8. Adesso: si prova; se il server chiede conferma, la si legge e si conferma.
   */
  const [daConfermare, setDaConfermare] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCaricando(true); setErrore(null); setEsito(null);
    api<Cornice>(`/admin/clients/${clientId}/menu-a-mano/giornata?data=${data}`)
      .then((c) => { if (vivo) { setCornice(c); setScelte({}); setSlotAperto(null); } })
      .catch((e) => { if (vivo) setErrore(e instanceof Error ? e.message : 'Caricamento non riuscito.'); })
      .finally(() => { if (vivo) setCaricando(false); });
    return () => { vivo = false; };
  }, [clientId, data, ricarica]);

  /** ⚠️ La ricerca parte dal pasto: le ricette di catalogo hanno uno slot, e proporre una cena a colazione non serve a nessuno. */
  useEffect(() => {
    /**
     * ⛔ **Si azzera appena cambia il pasto, non solo quando si chiude.** Passando da un pasto
     * all'altro l'elenco del pasto **precedente** restava a schermo per il debounce più la latenza:
     * un clic assegnava una ricetta da pranzo allo slot della cena. Adesso il server rifiuterebbe
     * («è un piatto da lunch, non da dinner»), ma farlo scoprire dopo il clic è farlo sbagliare.
     */
    setRisultati(null);
    setTaglio(null);
    if (!slotAperto) return;
    let vivo = true;
    const t = setTimeout(() => {
      api<{ righe: RigaRicetta[]; poolVuoto: boolean; troncato?: boolean; tetto?: number }>(
        `/admin/clients/${clientId}/menu-a-mano/ricette?slot=${encodeURIComponent(slotAperto)}&q=${encodeURIComponent(cerca)}`
        + (tuttoIlCatalogo ? '&tuttoIlCatalogo=1' : ''),
      )
        .then((r) => { if (vivo) { setRisultati(r.righe); setTaglio(r.troncato ? (r.tetto ?? r.righe.length) : null); } })
        .catch(() => { if (vivo) { setRisultati([]); setTaglio(null); } });
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [clientId, slotAperto, cerca, tuttoIlCatalogo]);

  const c = useMemo(
    () => conta(Object.values(scelte), cornice?.slotAttesi ?? [], cornice?.targetKcal ?? null, cornice?.tolleranzaPct ?? 15),
    [scelte, cornice],
  );

  function scegli(slot: string, r: RigaRicetta) {
    setScelte((s) => ({
      ...s,
      [slot]: {
        slot,
        recipeId: r.recipeId,
        nome: r.nome,
        kcal: r.kcal,
        bloccata: r.bloccata,
        motivoBlocco: r.motivoBlocco,
        forzatoPerche: s[slot]?.recipeId === r.recipeId ? s[slot]?.forzatoPerche : '',
      },
    }));
    setSlotAperto(null);
    setCerca('');
  }

  async function salva(conferma: boolean) {
    setSalvando(true); setErrore(null); setEsito(null);
    if (!conferma) setDaConfermare(null);
    try {
      const r = await api<{ kcal: number; avvisi: string[] }>(`/admin/clients/${clientId}/menu-a-mano`, {
        method: 'POST',
        body: JSON.stringify({
          data,
          conferma,
          /**
           * ⛔ **Solo `slot`, `recipeId` e il motivo.** Nome, calorie e verdetto li rilegge il
           * server: mandarli da qui vorrebbe dire che il browser certifica quali piatti sono
           * vietati, ed è il difetto che questa consegna ha dovuto correggere.
           */
          pasti: (cornice?.slotAttesi ?? []).map((s) => scelte[s]).filter(Boolean).map((s) => ({
            slot: s.slot,
            recipeId: s.recipeId,
            ...(s.forzatoPerche ? { forzatoPerche: s.forzatoPerche } : {}),
          })),
        }),
      });
      setEsito(`Giornata del ${data} scritta: ${r.kcal} kcal.${r.avvisi.length ? ` ${r.avvisi.join(' ')}` : ''}`);
      setScelte({});
      setDaConfermare(null);
      /** ⚠️ La cornice si ricarica: i banner («questo giorno ha già un menu») erano rimasti quelli di prima. */
      setRicarica((n) => n + 1);
    } catch (e) {
      const messaggio = e instanceof Error ? e.message : 'Salvataggio non riuscito.';
      /**
       * ⚠️ Il server distingue «non si può» da «va confermato», e la schermata deve fare lo stesso:
       * un errore rosso su una cosa che si può fare insegna a non leggere gli errori.
       */
      if (!conferma && messaggio.startsWith('Da confermare:')) setDaConfermare(messaggio.replace(/^Da confermare:\s*/, ''));
      else setErrore(messaggio);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal title="Scrivi il menu a mano" onClose={onClose} wide>
      <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <label className="muted" style={{ fontSize: 13 }}>Giorno</label>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </div>

      {caricando && <Spinner />}
      {errore && <Banner kind="err">{errore}</Banner>}
      {esito && <Banner kind="ok">{esito}</Banner>}
      {daConfermare && <Banner kind="warn"><b>Da leggere prima di salvare:</b> {daConfermare}</Banner>}

      {/* ⛔ Quello che la cliente ha già in mano resta suo: si dice PRIMA, non dopo il clic. */}
      {cornice?.esistente?.giaAperto && (
        <Banner kind="warn">Il menu di questo giorno la cliente lo ha <b>già aperto</b>: quello resta suo, non si riscrive.</Banner>
      )}
      {/* ⚠️ Non blocca: la stessa condizione la porta la giornata che ha appena scritto lei, perché
          per una cliente che non ha mai aperto l'app non lo sappiamo per definizione. Chiede una
          conferma, come gli altri avvisi. */}
      {cornice?.esistente?.nonSappiamo && (
        <Banner kind="warn">Non si sa se la cliente ha già aperto questo giorno: la sua app non lo dice ancora.</Banner>
      )}
      {cornice?.esistente && !cornice.esistente.giaAperto && !cornice.esistente.nonSappiamo && (
        <Banner kind="info">
          Questo giorno ha già un menu{cornice.esistente.scrittaAMano ? ' scritto a mano' : ''}: salvando lo sostituisci.
        </Banner>
      )}
      {cornice && cornice.slotAttesi.length === 0 && (
        <Banner kind="warn">Non si sa quanti pasti ha la giornata di questa cliente: non ha ancora una dieta con delle giornate.</Banner>
      )}

      {cornice?.slotAttesi.map((slot) => {
        const scelta = scelte[slot];
        return (
          <div key={slot} className="card" style={{ marginBottom: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <b style={{ fontSize: 14 }}>{nomePasto(slot)}</b>
              {scelta ? (
                <span style={{ flex: 1, minWidth: 0 }}>
                  {/* ⛔ Barrato col motivo, non nascosto: chi non sa perché un piatto non c'è, lo cerca. */}
                  <span style={{ textDecoration: scelta.bloccata ? 'line-through' : undefined }}>{scelta.nome}</span>
                  <span className="muted"> · {scelta.kcal} kcal</span>
                </span>
              ) : (
                <span className="muted" style={{ flex: 1 }}>da scegliere</span>
              )}
              <button className="btn ghost" onClick={() => { setSlotAperto(slotAperto === slot ? null : slot); setCerca(''); }}>
                {scelta ? 'Cambia' : 'Scegli'}
              </button>
            </div>

            {scelta?.bloccata && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: '#8A5A00', fontSize: 12.5 }}>⚠️ {scelta.motivoBlocco}</div>
                {/* ⛔ Il permesso senza il motivo sarebbe un pulsante «ignora»: nessuno saprebbe mai
                    chi ha deciso, né sulla base di cosa. */}
                <textarea
                  rows={2}
                  placeholder={`Perché la servi lo stesso? (almeno ${MOTIVO_MINIMO} caratteri, lo legge chi guarda la scheda fra sei mesi)`}
                  value={scelta.forzatoPerche ?? ''}
                  onChange={(e) => setScelte((s) => ({ ...s, [slot]: { ...s[slot], forzatoPerche: e.target.value } }))}
                  style={{ width: '100%', marginTop: 6 }}
                />
              </div>
            )}

            {slotAperto === slot && (
              <div style={{ marginTop: 8 }}>
                <input
                  autoFocus
                  placeholder={tuttoIlCatalogo ? 'Cerca in tutto il catalogo…' : 'Cerca nel suo paniere…'}
                  value={cerca}
                  onChange={(e) => setCerca(e.target.value)}
                  style={{ width: '100%' }}
                />
                {/* ⚠️ Spenta di suo: il paniere è la scelta fatta per questa cliente, e pescare fuori
                    resta un'eccezione che si chiede. Ma è a un clic, perché il piatto che serve a
                    volte semplicemente non ci sta dentro. */}
                <label className="row" style={{ gap: 6, alignItems: 'center', marginTop: 6, fontSize: 12.5 }}>
                  <input
                    type="checkbox"
                    checked={tuttoIlCatalogo}
                    onChange={(e) => setTuttoIlCatalogo(e.target.checked)}
                  />
                  <span>Cerca in tutto il catalogo (fuori dal suo paniere)</span>
                </label>
                {taglio !== null && (
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 6, color: '#8A5A00' }}>
                    ⚠️ Sono le prime {taglio} in ordine alfabetico: scrivi qualche lettera per trovare
                    quella che cerchi — le altre ci sono, non sono qui.
                  </div>
                )}
                <div style={{ maxHeight: 220, overflow: 'auto', marginTop: 6 }}>
                  {risultati === null && <Spinner />}
                  {risultati?.length === 0 && <div className="muted" style={{ padding: 8 }}>Nessuna ricetta.</div>}
                  {risultati?.map((r) => (
                    <div
                      key={r.recipeId}
                      className="row"
                      style={{ justifyContent: 'space-between', padding: '6px 4px', cursor: 'pointer', gap: 10 }}
                      onClick={() => scegli(slot, r)}
                    >
                      <span style={{ textDecoration: r.bloccata ? 'line-through' : undefined, minWidth: 0 }}>
                        {r.nome}
                        {/* ⚠️ Detto sulla riga, non solo nell'intestazione: chi scorre trenta righe non
                            si ricorda quale interruttore ha alzato tre secondi fa. */}
                        {r.fuoriDalPaniere && <span style={{ color: '#8A5A00', fontSize: 11.5 }}> · fuori dal suo paniere</span>}
                        {r.bloccata && <span style={{ color: '#8A5A00', fontSize: 11.5 }}> — {r.motivoBlocco}</span>}
                      </span>
                      <span className="muted" style={{ flex: 'none' }}>{r.kcal} kcal</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ⚠️ Il totale sta SEMPRE davanti mentre si sceglie, non alla fine: è il numero su cui si
          decide, e metterlo in fondo vorrebbe dire farlo leggere dopo aver scelto. */}
      {cornice && cornice.slotAttesi.length > 0 && (
        <div className="card" style={{ marginTop: 4 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <b>{c.kcal} kcal</b>
              {cornice.targetKcal
                ? <span className="muted"> su {cornice.targetKcal} di fabbisogno</span>
                : <span className="muted"> · il fabbisogno di questa cliente non è calcolabile</span>}
            </span>
            {c.scostamentoPct !== null && (
              <span style={{ color: c.dentroBanda ? 'var(--ok-ink)' : '#8A5A00', fontWeight: 600 }}>
                {c.scostamentoPct > 0 ? '+' : ''}{c.scostamentoPct}%
                {!c.dentroBanda && ` · fuori dalla banda ±${cornice.tolleranzaPct}%`}
              </span>
            )}
          </div>
          {c.mancanti.length > 0 && (
            <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
              Mancano: {c.mancanti.map(nomePasto).join(', ')}.
            </div>
          )}
          {c.senzaMotivo.length > 0 && (
            <div style={{ color: '#8A5A00', fontSize: 12.5, marginTop: 6 }}>
              Scrivi perché servi: {c.senzaMotivo.join(', ')}.
            </div>
          )}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
        <button className="btn ghost" onClick={onClose} disabled={salvando}>Chiudi</button>
        {/* ⛔ **Il secondo pulsante compare solo dopo che il server ha detto cosa c'è da
            confermare**, e accanto alla frase che l'ha detto. Un pulsante che si chiama «Salva lo
            stesso» prima di aver mostrato «lo stesso che cosa» insegna a cliccare senza leggere. */}
        {daConfermare
          ? (
            <button className="btn" disabled={salvando} onClick={() => void salva(true)}>
              {salvando ? 'Salvo…' : 'Ho letto, salva lo stesso'}
            </button>
          )
          : (
            <button
              className="btn"
              disabled={!c.siPuoProvare || salvando || !!cornice?.esistente?.giaAperto}
              onClick={() => void salva(false)}
            >
              {salvando ? 'Salvo…' : 'Salva la giornata'}
            </button>
          )}
      </div>
    </Modal>
  );
}
