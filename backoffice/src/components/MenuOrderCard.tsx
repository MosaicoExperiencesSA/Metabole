import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { NAV } from './Layout';
import { gruppiEffettivi, serializzaGruppi, writeMenuOrderCache, type GruppoMenu } from '../lib/menuOrder';

/**
 * ORDINE DEL MENU — voci, gruppi e titoli.
 *
 * Richiesta di Simone dell'11/8: «l'utente deve poter cambiare, aggiungere o eliminare anche i
 * titoli dei gruppi, e spostare le pastiglie da un gruppo all'altro. Il default è quello attuale,
 * e in alto vicino al titolo mettiamo la freccetta tonda del reimposta».
 *
 * ## Le due scelte di interfaccia
 *
 * **Frecce, non trascinamento.** Il trascinamento è più bello e più fragile: su una lista lunga,
 * dentro un contenitore che scorre, è la cosa che non funziona mai — e questa pagina si apre anche
 * dal telefono. Le frecce le usa già chi ha personalizzato il menu finora, e qui fanno una cosa in
 * più: **quando la voce è la prima o l'ultima del suo gruppo, la freccia la porta nel gruppo
 * accanto**. Così «spostare le pastiglie da un gruppo all'altro» non ha bisogno di un comando suo,
 * e l'icona cambia (`corner-left-up`) per dirlo prima che uno ci provi.
 *
 * **Nessun «Salva».** Ogni modifica vale subito, come già faceva il riordino: un pulsante di
 * salvataggio qui vorrebbe dire poter chiudere la pagina con un menu a metà.
 */
export function MenuOrderCard() {
  const { can } = useAuth();
  /** Le sezioni di fabbrica, con dentro solo le voci che questa persona può vedere. */
  const sezioni = NAV
    .map((s) => ({ group: s.group, collapsible: s.collapsible, items: s.items.filter((it) => can(it.key)) }))
    .filter((g) => g.items.length > 0);

  const [ordine, setOrdine] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [caricato, setCaricato] = useState(false);

  useEffect(() => {
    api<{ menuOrder: string[] | null }>('/me/preferences')
      .then((p) => setOrdine(p.menuOrder && p.menuOrder.length ? p.menuOrder : null))
      .catch(() => setOrdine(null))
      .finally(() => setCaricato(true));
  }, []);

  const vista = gruppiEffettivi(sezioni, ordine);

  /**
   * ⚠️ Le rotte che questa persona NON vede non devono sparire dalle sue preferenze.
   *
   * La card lavora sulle voci visibili. Se salvassimo solo quelle, il giorno che le arriva un
   * permesso in più la pagina tornerebbe in un posto qualsiasi — e la sua personalizzazione di
   * quella voce sarebbe stata cancellata senza che nessuno l'abbia chiesto. Quindi le rotte già
   * salvate che qui non compaiono si riattaccano in fondo.
   */
  function conNascoste(nuovi: GruppoMenu[]): GruppoMenu[] {
    const visibili = new Set(sezioni.flatMap((s) => s.items.map((i) => i.to)));
    // ⚠️ `#gruppo` senza i due punti: i marcatori sono tre (`#gruppo:`, `#gruppoc:`, `#gruppot:`) e
    // filtrarne uno solo avrebbe fatto passare gli altri due per rotte — che sarebbero poi state
    // riattaccate in fondo come «voci orfane», moltiplicando i titoli a ogni salvataggio.
    const salvate = (ordine ?? []).filter((r) => !r.startsWith('#gruppo'));
    const nominate = new Set(nuovi.flatMap((g) => g.voci));
    const orfane = salvate.filter((r) => !visibili.has(r) && !nominate.has(r));
    if (!orfane.length || !nuovi.length) return nuovi;
    const out = nuovi.map((g) => ({ ...g, voci: [...g.voci] }));
    out[out.length - 1].voci.push(...orfane);
    return out;
  }

  async function salva(gruppi: GruppoMenu[] | null) {
    const piatto = gruppi ? serializzaGruppi(conNascoste(gruppi)) : null;
    setOrdine(piatto);
    writeMenuOrderCache(piatto);
    try {
      await api('/me/preferences', { method: 'PUT', body: JSON.stringify({ menuOrder: piatto ?? [] }) });
      setMsg(gruppi ? 'Salvato.' : 'Rimesso come di fabbrica.');
    } catch {
      setMsg('Salvato solo su questo dispositivo.');
    }
  }

  /** La vista corrente come struttura modificabile. */
  const comeGruppi = (): GruppoMenu[] =>
    // Si salva sempre il valore RISOLTO, non «eredita»: dal momento in cui uno tocca questa
    // schermata, com'è il suo menu lo decide lui e non cambia più sotto i piedi se un domani noi
    // rendiamo pieghevole un gruppo di fabbrica.
    vista.map((g) => ({ titolo: g.group, comprimibile: g.comprimibile, voci: g.items.map((i) => i.to) }));

  /** Su/giù dentro il gruppo — e, quando è al bordo, nel gruppo accanto. */
  function spostaVoce(gi: number, vi: number, dir: -1 | 1) {
    const g = comeGruppi();
    const dentro = vi + dir;
    if (dentro >= 0 && dentro < g[gi].voci.length) {
      [g[gi].voci[vi], g[gi].voci[dentro]] = [g[gi].voci[dentro], g[gi].voci[vi]];
      return void salva(g);
    }
    const vicino = gi + dir;
    if (vicino < 0 || vicino >= g.length) return; // la prima del primo gruppo, l'ultima dell'ultimo
    const [voce] = g[gi].voci.splice(vi, 1);
    // Entra dal lato da cui arriva: salendo si appoggia in fondo al gruppo sopra, scendendo in
    // cima a quello sotto. Il contrario la farebbe «saltare» oltre mezzo gruppo.
    if (dir === -1) g[vicino].voci.push(voce);
    else g[vicino].voci.unshift(voce);
    void salva(g);
  }

  function rinomina(gi: number, titolo: string) {
    const g = comeGruppi();
    g[gi].titolo = titolo;
    void salva(g);
  }

  /** A fisarmonica o solo titolo (richiesta di Simone dell'11/8: «CRM è comprimibile, il flag»). */
  function cambiaComprimibile(gi: number, comprimibile: boolean) {
    const g = comeGruppi();
    g[gi].comprimibile = comprimibile;
    void salva(g);
  }

  function aggiungiGruppo() {
    const g = comeGruppi();
    g.push({ titolo: 'Nuovo gruppo', voci: [] });
    void salva(g);
  }

  /**
   * Elimina il gruppo, NON le voci: passano al gruppo sopra (o sotto, se è il primo). Un comando
   * che toglie un titolo e si porta via cinque voci del menu è un comando che si preme una volta
   * sola, e sempre per sbaglio.
   */
  function eliminaGruppo(gi: number) {
    const g = comeGruppi();
    if (g.length <= 1) return;
    const dove = gi === 0 ? 1 : gi - 1;
    g[dove].voci = gi === 0 ? [...g[gi].voci, ...g[dove].voci] : [...g[dove].voci, ...g[gi].voci];
    g.splice(gi, 1);
    void salva(g);
  }

  function spostaGruppo(gi: number, dir: -1 | 1) {
    const g = comeGruppi();
    const j = gi + dir;
    if (j < 0 || j >= g.length) return;
    [g[gi], g[j]] = [g[j], g[gi]];
    void salva(g);
  }

  return (
    <div className="card">
      <div className="spread" style={{ alignItems: 'center', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Ordine del menu</h2>
        {/* La «freccetta tonda» chiesta da Simone: accanto al titolo, dove la si cerca. */}
        <button
          className="btn ghost sm"
          onClick={() => void salva(null)}
          disabled={!caricato || !ordine}
          title={ordine ? 'Rimetti gruppi, titoli e ordine come sono di fabbrica' : 'Il menu è già quello di fabbrica'}
        >
          <i className="ti ti-rotate-clockwise" /> Reimposta
        </button>
      </div>
      <p className="hint" style={{ marginTop: 6 }}>
        Rinomina i gruppi, spostali, aggiungine o togline, e scegli quali si aprono e chiudono a
        fisarmonica e quali restano solo un titolo. Le frecce muovono una voce dentro il
        gruppo — e quando è la prima o l'ultima, la portano nel gruppo accanto. Tutto si salva sul
        tuo profilo appena lo tocchi.
        {msg && <b style={{ color: 'var(--ok-ink)' }}> · {msg}</b>}
      </p>

      <div style={{ display: 'grid', gap: 14 }}>
        {vista.map((g, gi) => (
          <div key={`${gi}-${g.group}`}>
            <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <input
                className="input"
                style={{ maxWidth: 240, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}
                value={g.group}
                placeholder="Titolo del gruppo"
                maxLength={24}
                onChange={(e) => rinomina(gi, e.target.value)}
              />
              {/*
                Un interruttore e non due pulsanti: lo stato si legge senza premerlo, ed è
                l'informazione che serve guardando la lista dei gruppi.
              */}
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
              {g.items.length === 0 && (
                <div className="muted" style={{ fontSize: 12.5, padding: '8px 12px', border: '1px dashed var(--line)', borderRadius: 10 }}>
                  Gruppo vuoto: portaci una voce con le frecce, oppure eliminalo.
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

      <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={aggiungiGruppo}>
        <i className="ti ti-plus" /> Aggiungi un gruppo
      </button>
    </div>
  );
}
