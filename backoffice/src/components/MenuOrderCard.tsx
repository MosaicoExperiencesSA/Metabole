import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { NAV } from './Layout';
import { gruppiEffettivi, serializzaGruppi, writeMenuOrderCache, type GruppoMenu } from '../lib/menuOrder';

/**
 * ORDINE DEL MENU — voci, gruppi, titoli e fisarmoniche.
 *
 * Richieste di Simone dell'11-12/8: rinominare/aggiungere/eliminare i gruppi, spostare le voci da un
 * gruppo all'altro, un flag «a fisarmonica / solo titolo» per gruppo, il «Reimposta» accanto al
 * titolo — e **un pulsante Salva che al salvataggio ricarica la pagina**.
 *
 * ## Perché c'è un «Salva», visto che prima non c'era
 *
 * All'inizio ogni modifica valeva subito. Sembrava più diretto, e invece era il difetto: la barra
 * laterale legge le preferenze **una volta sola**, quando si monta. Si toglieva la fisarmonica a un
 * gruppo, la card si aggiornava, il menu no — e restava indietro fino al ricaricamento. Da fuori si
 * legge «l'interruttore non funziona», ed è quello che è successo.
 *
 * Il salvataggio esplicito risolve due cose insieme: dice **quando** il lavoro è finito (riordinare
 * un menu sono dieci gesti, non uno: salvarne dieci versioni intermedie sul profilo non serve a
 * nessuno) e dà il momento giusto per **ricaricare**, che è il modo onesto di garantire che quello
 * che si vede sia quello che è salvato — barra, gruppi e fisarmoniche comprese.
 *
 * ## Frecce, non trascinamento
 *
 * Il trascinamento è più bello e più fragile: lista lunga, contenitore che scorre, e questa pagina
 * si apre anche dal telefono. Le frecce fanno una cosa in più: **quando la voce è la prima o
 * l'ultima del suo gruppo, la portano nel gruppo accanto** — e l'icona cambia per dirlo prima che
 * uno ci provi.
 */
export function MenuOrderCard() {
  const { can } = useAuth();
  /** Le sezioni di fabbrica, con dentro solo le voci che questa persona può vedere. */
  const sezioni = NAV
    .map((s) => ({ group: s.group, collapsible: s.collapsible, items: s.items.filter((it) => can(it.key)) }))
    .filter((g) => g.items.length > 0);

  const [ordine, setOrdine] = useState<string[] | null>(null);
  const [caricato, setCaricato] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  /**
   * La BOZZA, cioè il lavoro non ancora salvato, nella STESSA forma in cui si salva (la lista di
   * righe con i marcatori dei gruppi). Tenerla già serializzata evita di avere due rappresentazioni
   * dello stesso menu che possono divergere fra loro.
   * `undefined` = niente da salvare · `null` = «rimetti come di fabbrica» in attesa.
   */
  const [bozza, setBozza] = useState<string[] | null | undefined>(undefined);

  useEffect(() => {
    api<{ menuOrder: string[] | null }>('/me/preferences')
      .then((p) => setOrdine(p.menuOrder && p.menuOrder.length ? p.menuOrder : null))
      .catch(() => setOrdine(null))
      .finally(() => setCaricato(true));
  }, []);

  const vista = gruppiEffettivi(sezioni, bozza === undefined ? ordine : bozza);
  const daSalvare = bozza !== undefined;

  /** Mette il lavoro in bozza: si serializza subito, come verrà salvato. */
  const aggiorna = (g: GruppoMenu[]) => setBozza(serializzaGruppi(conNascoste(g)));

  /**
   * ⚠️ Le rotte che questa persona NON vede non devono sparire dalle sue preferenze.
   *
   * La card lavora sulle voci visibili. Se salvassimo solo quelle, il giorno che le arriva un
   * permesso in più la pagina tornerebbe in un posto qualsiasi — e la sua personalizzazione di
   * quella voce sarebbe stata cancellata senza che nessuno l'abbia chiesto.
   */
  function conNascoste(nuovi: GruppoMenu[]): GruppoMenu[] {
    const visibili = new Set(sezioni.flatMap((s) => s.items.map((i) => i.to)));
    // `#gruppo` senza i due punti: i marcatori sono tre (`#gruppo:`, `#gruppoc:`, `#gruppot:`) e
    // filtrarne uno solo farebbe passare gli altri due per rotte, riattaccandoli come «voci
    // orfane» e moltiplicando i titoli a ogni salvataggio.
    const salvate = (ordine ?? []).filter((r) => !r.startsWith('#gruppo'));
    const nominate = new Set(nuovi.flatMap((g) => g.voci));
    const orfane = salvate.filter((r) => !visibili.has(r) && !nominate.has(r));
    if (!orfane.length || !nuovi.length) return nuovi;
    const out = nuovi.map((g) => ({ ...g, voci: [...g.voci] }));
    out[out.length - 1].voci.push(...orfane);
    return out;
  }

  /**
   * Salva e **ricarica**. Il ricaricamento è voluto (Simone, 12/8): è l'unico modo onesto di dire
   * «quello che vedi adesso è quello che è salvato», barra laterale compresa. Se la scrittura sul
   * profilo non riesce, NON si ricarica: si dice cosa è successo e il lavoro resta a schermo.
   */
  async function salva() {
    setSalvando(true);
    setErrore(null);
    const piatto = bozza ?? null;
    try {
      await api('/me/preferences', { method: 'PUT', body: JSON.stringify({ menuOrder: piatto ?? [] }) });
      writeMenuOrderCache(piatto);
      window.location.reload();
    } catch (e) {
      setSalvando(false);
      setErrore(
        e instanceof Error && e.message
          ? `Non sono riuscito a salvare: ${e.message}. Il tuo lavoro è ancora qui, riprova.`
          : 'Non sono riuscito a salvare. Il tuo lavoro è ancora qui, riprova.',
      );
    }
  }

  /** La vista corrente come struttura modificabile: si salva sempre il valore RISOLTO. */
  const comeGruppi = (): GruppoMenu[] =>
    vista.map((g) => ({ titolo: g.group, comprimibile: g.comprimibile, voci: g.items.map((i) => i.to) }));

  /** Su/giù dentro il gruppo — e, quando è al bordo, nel gruppo accanto. */
  function spostaVoce(gi: number, vi: number, dir: -1 | 1) {
    const g = comeGruppi();
    const dentro = vi + dir;
    if (dentro >= 0 && dentro < g[gi].voci.length) {
      [g[gi].voci[vi], g[gi].voci[dentro]] = [g[gi].voci[dentro], g[gi].voci[vi]];
      return aggiorna(g);
    }
    const vicino = gi + dir;
    if (vicino < 0 || vicino >= g.length) return; // la prima del primo gruppo, l'ultima dell'ultimo
    const [voce] = g[gi].voci.splice(vi, 1);
    // Entra dal lato da cui arriva: salendo si appoggia in fondo al gruppo sopra, scendendo in cima
    // a quello sotto. Il contrario la farebbe «saltare» oltre mezzo gruppo.
    if (dir === -1) g[vicino].voci.push(voce);
    else g[vicino].voci.unshift(voce);
    aggiorna(g);
  }

  function rinomina(gi: number, titolo: string) {
    const g = comeGruppi();
    g[gi].titolo = titolo;
    aggiorna(g);
  }

  /** A fisarmonica o solo titolo. */
  function cambiaComprimibile(gi: number, comprimibile: boolean) {
    const g = comeGruppi();
    g[gi].comprimibile = comprimibile;
    aggiorna(g);
  }

  function aggiungiGruppo() {
    const g = comeGruppi();
    g.push({ titolo: 'Nuovo gruppo', comprimibile: false, voci: [] });
    aggiorna(g);
  }

  /**
   * Elimina il gruppo, NON le voci: passano al gruppo sopra (o sotto, se è il primo). Un comando che
   * toglie un titolo e si porta via cinque voci del menu è un comando che si preme una volta sola, e
   * sempre per sbaglio.
   */
  function eliminaGruppo(gi: number) {
    const g = comeGruppi();
    if (g.length <= 1) return;
    const dove = gi === 0 ? 1 : gi - 1;
    g[dove].voci = gi === 0 ? [...g[gi].voci, ...g[dove].voci] : [...g[dove].voci, ...g[gi].voci];
    g.splice(gi, 1);
    aggiorna(g);
  }

  function spostaGruppo(gi: number, dir: -1 | 1) {
    const g = comeGruppi();
    const j = gi + dir;
    if (j < 0 || j >= g.length) return;
    [g[gi], g[j]] = [g[j], g[gi]];
    aggiorna(g);
  }

  return (
    <div className="card">
      <div className="spread" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Ordine del menu</h2>
        <div className="row" style={{ gap: 8 }}>
          {daSalvare && (
            <button className="btn ghost sm" onClick={() => { setBozza(undefined); setErrore(null); }} disabled={salvando}>
              Annulla
            </button>
          )}
          {/* La «freccetta tonda»: prepara il ritorno alla configurazione di fabbrica, poi si salva. */}
          <button
            className="btn ghost sm"
            onClick={() => setBozza(null)}
            disabled={!caricato || salvando || (!ordine && bozza === undefined)}
            title="Rimetti gruppi, titoli e ordine come sono di fabbrica"
          >
            <i className="ti ti-rotate-clockwise" /> Reimposta
          </button>
          <button className="btn sm" onClick={() => void salva()} disabled={!daSalvare || salvando}>
            <i className="ti ti-device-floppy" /> {salvando ? 'Salvo…' : 'Salva'}
          </button>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 6 }}>
        Rinomina i gruppi, spostali, aggiungine o togline, e scegli quali si aprono e chiudono a
        fisarmonica. Le frecce muovono una voce dentro il gruppo — e quando è la prima o l'ultima, la
        portano nel gruppo accanto. <b>Le modifiche valgono quando premi Salva</b>: la pagina si
        ricarica, così il menu qui a fianco mostra esattamente quello che hai salvato.
      </p>
      {errore && <div className="banner err" style={{ marginBottom: 10 }}>{errore}</div>}
      {daSalvare && !errore && (
        <div className="banner info" style={{ marginBottom: 10 }}>
          {bozza === null
            ? 'Pronto a rimettere il menu com\'è di fabbrica: premi Salva per confermare.'
            : 'Hai modifiche non salvate: premi Salva per applicarle al menu.'}
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {vista.map((g, gi) => (
          <div key={`${gi}-${g.group}`}>
            <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
              <input
                className="input"
                style={{ maxWidth: 240, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}
                value={g.group}
                placeholder="Titolo del gruppo"
                maxLength={24}
                onChange={(e) => rinomina(gi, e.target.value)}
              />
              {/* Un interruttore e non due pulsanti: lo stato si legge senza premerlo. */}
              <label
                className="row"
                style={{ gap: 5, alignItems: 'center', fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer' }}
                title={g.comprimibile
                  ? 'A fisarmonica: si apre e si chiude, e da chiuso le sue voci non occupano spazio'
                  : 'Solo titolo: le voci restano sempre in vista'}
              >
                <input type="checkbox" checked={g.comprimibile} onChange={(e) => cambiaComprimibile(gi, e.target.checked)} />
                <span className="muted">{g.comprimibile ? 'a fisarmonica' : 'solo titolo'}</span>
              </label>
              <button className="btn ghost sm" disabled={gi === 0} onClick={() => spostaGruppo(gi, -1)} title="Sposta il gruppo su"><i className="ti ti-chevron-up" /></button>
              <button className="btn ghost sm" disabled={gi === vista.length - 1} onClick={() => spostaGruppo(gi, 1)} title="Sposta il gruppo giù"><i className="ti ti-chevron-down" /></button>
              <button
                className="btn ghost sm"
                disabled={vista.length <= 1}
                onClick={() => eliminaGruppo(gi)}
                title={g.items.length ? `Elimina il gruppo: le ${g.items.length} voci passano al gruppo ${gi === 0 ? 'sotto' : 'sopra'}` : 'Elimina il gruppo'}
              >
                <i className="ti ti-trash" />
              </button>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {/*
                ⚠️ IL GRUPPO VUOTO SI SALVA MA NON COMPARE (difetto 5, deciso da Simone il 18/8).
                Il menu non disegna un'intestazione che non porta da nessuna parte — giusto così —
                ma chi lo aveva creato per riempirlo dopo pensava che il salvataggio non avesse
                funzionato. Il comportamento non cambia: **smette di essere una sorpresa**.
                ⚠️ Scartato il divieto di salvare vuoto: crei il gruppo e non puoi più salvare il
                resto del lavoro finché non l'hai riempito. Un controllo che protegge un dato pulito
                prendendo in ostaggio dieci minuti di lavoro non è un buon affare.
              */}
              {g.items.length === 0 && (
                <div className="muted" style={{ fontSize: 12.5, padding: '8px 12px', border: '1px dashed var(--line)', borderRadius: 10 }}>
                  Gruppo vuoto: <b>non comparirà nel menu</b> finché non ci porti una voce. Usa le
                  frecce di una voce del gruppo accanto, oppure eliminalo — si salva lo stesso.
                </div>
              )}
              {g.items.map((it, vi) => (
                <div key={it.to} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--chip)' }}>
                  <i className={`ti ${it.icon}`} style={{ fontSize: 18 }} />
                  <span style={{ flex: 1, fontSize: 14 }}>{it.label}</span>
                  <button
                    className="btn ghost sm"
                    disabled={gi === 0 && vi === 0}
                    onClick={() => spostaVoce(gi, vi, -1)}
                    title={vi === 0 ? 'Portala nel gruppo sopra' : 'Sposta su'}
                  >
                    <i className={`ti ti-${vi === 0 ? 'corner-left-up' : 'chevron-up'}`} />
                  </button>
                  <button
                    className="btn ghost sm"
                    disabled={gi === vista.length - 1 && vi === g.items.length - 1}
                    onClick={() => spostaVoce(gi, vi, 1)}
                    title={vi === g.items.length - 1 ? 'Portala nel gruppo sotto' : 'Sposta giù'}
                  >
                    <i className={`ti ti-${vi === g.items.length - 1 ? 'corner-left-down' : 'chevron-down'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={aggiungiGruppo} disabled={salvando}>
        <i className="ti ti-plus" /> Aggiungi un gruppo
      </button>
    </div>
  );
}
