import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Spinner, Toggle } from '../components/ui';
import { pageLabel } from '../lib/labels';
import { paroleDellaPorta, type CellaAperta } from '../lib/portaAperta';
import type { RoleInfo } from '../lib/roles';

/**
 * ⛔ **«SPENTO» NON VUOL SEMPRE DIRE CHIUSO, e finora questa pagina non lo diceva.**
 *
 * Due porte che la matrice non nomina, tutte e due volute:
 * · l'**hub** (`PAGE_GRANTS` nel backend): «Gestione dieta» concede `diets_catalog` **+ `recipes`»,
 *   perché bastino poche voci di menu per gestire tutto. Spegnere «Ricette» alla nutrizionista che
 *   ha «Gestione dieta» non le toglie le API delle ricette;
 * · l'**eredità** (`INHERIT_DEFAULTS`): una figlia **senza riga** vale la riga del genitore — e
 *   senza riga questa tabella la disegna spenta, perché `serverCell` rende `false`.
 *
 * ⚠️ Il conto arriva **dal backend** (`aperteLoStesso`), calcolato con lo stesso modulo del
 * guardiano. Rifarlo qui vorrebbe dire tenere due copie della stessa regola, che è esattamente il
 * difetto costato l'incidente dell'ereditarietà: girava in tre posti e ne era stato corretto uno.
 *
 * ⛔ Questa pagina **spiega**, non cambia niente. Far sì che spegnere una chiave la spenga davvero
 * — una negazione esplicita che batte l'hub — cambierebbe il significato della matrice per tutti, e
 * va deciso da Simone: oggi «spento» vuol dire «non te lo do io», non «non ce l'hai».
 */
interface Matrix {
  pages: string[];
  roles: RoleInfo[];
  matrix: Record<string, { pageKey: string; canView: boolean; canManage: boolean }[]>;
  /** hub → chiavi che apre. Assente se il backend è più vecchio della pagina. */
  concede?: Record<string, string[]>;
  aperteLoStesso?: CellaAperta[];
  /** Caselle spente solo perché la riga non esiste: si dicono con un numero, non con un badge. */
  senzaRiga?: number;
  /**
   * ⛔ **Quali chiavi non le legge nessuna guardia, e perché.** Assente se il backend è più vecchio
   * della pagina: in quel caso non si scrive niente, invece di dedurlo — un avviso su una porta
   * inventata è peggio di nessun avviso.
   */
  senzaGuardia?: Record<string, 'buco' | 'figlia' | 'grantor' | 'innocua'>;
}

interface CellVal {
  canView: boolean;
  canManage: boolean;
}
// Modifiche in sospeso (non ancora salvate), per cella `${role}|${pageKey}`.
type Edits = Record<string, CellVal>;

const cellKey = (role: string, pageKey: string) => `${role}|${pageKey}`;

/**
 * ⛔ **L'avviso su una cella che dice «spento» mentre il server dice «sì».**
 *
 * ⚠️ Piccolo e attaccato all'interruttore, non un banner in cima: chi guarda la matrice sta
 * guardando *quella* cella, e un avviso lontano dalla cosa di cui parla non lo legge nessuno. E
 * compare **solo** sulle celle che mentono — segnare tutte le righe sarebbe non segnarne nessuna.
 */
function AvvisoPortaAperta({ cella, nomeRuolo }: { cella?: CellaAperta; nomeRuolo: (k: string) => string }) {
  if (!cella) return null;
  const { breve, lunga } = paroleDellaPorta(cella, pageLabel, nomeRuolo);
  return (
    <span
      title={lunga}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, lineHeight: 1.2,
        color: '#8A5A00', background: '#FFF3D6', border: '1px solid #F0D9A0',
        borderRadius: 6, padding: '1px 5px', maxWidth: 112, whiteSpace: 'normal', textAlign: 'left',
      }}
    >
      <i className="ti ti-lock-open" style={{ fontSize: 10, flex: 'none' }} />
      {breve}
    </span>
  );
}

export function Permissions() {
  const { can } = useAuth();
  const editable = can('permissions', 'manage');
  const [data, setData] = useState<Matrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [edits, setEdits] = useState<Edits>({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setData(await api<Matrix>('/admin/permissions'));
      setEdits({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  /** Valore dal server (baseline). */
  function serverCell(roleKey: string, pageKey: string): CellVal {
    const row = data?.matrix[roleKey]?.find((r) => r.pageKey === pageKey);
    return { canView: row?.canView ?? false, canManage: row?.canManage ?? false };
  }

  /** Valore effettivo mostrato: la modifica in sospeso se c'è, altrimenti il server. */
  function cell(roleKey: string, pageKey: string): CellVal {
    return edits[cellKey(roleKey, pageKey)] ?? serverCell(roleKey, pageKey);
  }

  /** Applica una modifica SOLO in locale (nessuna chiamata finché non si preme Salva). */
  function setLocal(roleKey: string, pageKey: string, patch: { canView?: boolean; canManage?: boolean }) {
    if (!editable) return;
    const cur = cell(roleKey, pageKey);
    const canView = patch.canView ?? cur.canView;
    // Regola: senza "vede" non può "gestire".
    const canManage = patch.canView === false ? false : patch.canManage ?? cur.canManage;
    const next: CellVal = { canView, canManage };
    const server = serverCell(roleKey, pageKey);
    const key = cellKey(roleKey, pageKey);
    setNotice(null);
    setEdits((e) => {
      const copy = { ...e };
      if (next.canView === server.canView && next.canManage === server.canManage) {
        delete copy[key]; // tornato uguale al server → non è più una modifica
      } else {
        copy[key] = next;
      }
      return copy;
    });
  }

  /**
   * ⚠️ Indicizzate per `ruolo|pagina|livello`: la tabella ha decine di righe per una dozzina di
   * ruoli, e cercare in un array dentro il ciclo di render costerebbe a ogni cella.
   */
  const aperte = useMemo(() => {
    const m = new Map<string, CellaAperta>();
    for (const c of data?.aperteLoStesso ?? []) m.set(`${c.role}|${c.pageKey}|${c.livello}`, c);
    return m;
  }, [data]);

  /** «Apre anche: Catalogo diete, Ricette» — il verso diretto, sulla riga dell'hub. */
  const apreAnche = data?.concede ?? {};

  /** L'etichetta di un ruolo, per l'avviso «vale Nutrizionista»: la chiave grezza non dice niente. */
  const nomeRuolo = useMemo(() => {
    const m = new Map((data?.roles ?? []).map((r) => [r.key, r.label]));
    return (k: string) => m.get(k) ?? k;
  }, [data]);

  /** «Gestione dieta apre anche Catalogo diete e Ricette» — scritto dai dati, non a mano. */
  const righeCheApronoAltro = useMemo(
    () => Object.entries(data?.concede ?? {})
      .map(([hub, concesse]) => `«${pageLabel(hub)}» apre anche ${concesse.map(pageLabel).join(' e ')}`),
    [data],
  );

  const dirtyKeys = useMemo(() => Object.keys(edits), [edits]);
  const dirtyCount = dirtyKeys.length;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // Il backend aggiorna una cella per volta: invio in sequenza le modifiche in sospeso.
      for (const key of dirtyKeys) {
        const [role, pageKey] = key.split('|');
        const v = edits[key];
        await api('/admin/permissions', {
          method: 'PATCH',
          body: JSON.stringify({ role, pageKey, canView: v.canView, canManage: v.canManage }),
        });
      }
      setConfirming(false);
      await load();
      setNotice(`Permessi salvati (${dirtyCount} ${dirtyCount === 1 ? 'modifica' : 'modifiche'}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;
  if (!data) return <Banner kind="err">{error ?? 'Errore'}</Banner>;

  const orderedPages = [...data.pages].sort((a, b) => pageLabel(a).localeCompare(pageLabel(b), 'it'));

  return (
    <>
      <Banner kind="info">
        Per ogni sezione e ruolo: <b>Vede</b> mostra la pagina nel menu, <b>Gestisce</b> permette anche di modificarne i
        contenuti. Le modifiche si applicano solo dopo <b>Salva</b>. L'accesso dell'admin ai permessi è bloccato (anti-lockout).
      </Banner>
      {/* ⛔ Il numero in cima serve a far CERCARE i badge: sono piccoli e sparsi in una tabella che
          scorre, e senza un conto qualcuno può guardare la matrice senza accorgersene. ⚠️ Compare
          solo se ce n'è almeno uno — un avviso sempre acceso non è un avviso.

          ⛔ **E gli esempi si SCRIVONO dai dati, non a mano.** La prima stesura diceva in prosa
          «Gestione dieta concede anche Catalogo diete e Ricette»: era la stessa tabella del backend
          ricopiata con le etichette invece che con le chiavi — cioè la seconda copia che il resto
          di questa pagina evita apposta. Aggiungere un hub l'avrebbe resa falsa, coi badge giusti.

          ⚠️ **E il perimetro si dichiara per intero.** Questi avvisi coprono tre vie — l'hub,
          l'eredità e il ruolo di base — e non tutte: 43 chiavi su 65 non sono lette da nessuna
          `@RequirePage`, e lì la casella governa il menu e non la porta (l'endpoint è protetto dal
          solo `@Roles`). Dire «spegnerle non chiude la porta» senza qualificarlo sarebbe promettere
          più di quello che si guarda. */}
      {(data.aperteLoStesso ?? []).length > 0 && (
        <Banner kind="warn">
          <b>
            {(data.aperteLoStesso ?? []).length}{' '}
            {(data.aperteLoStesso ?? []).length === 1 ? 'casella spenta è aperta lo stesso' : 'caselle spente sono aperte lo stesso'}.
          </b>{' '}
          Un permesso può arrivare da un'altra riga
          {righeCheApronoAltro.length > 0 && <> — {righeCheApronoAltro.join('; ')}</>}
          , una schermata separata senza una riga sua eredita quella del genitore, e per un ruolo
          personalizzato le API guardano il suo <b>ruolo di base</b>.
          Le caselle interessate hanno un'etichetta gialla che dice da dove:{' '}
          <b>spegnerle non chiude quella porta</b>, si agisce dove è scritto.
        </Banner>
      )}
      {/* ⚠️ Le righe mai create sono un'altra cosa e si dicono con un numero: sarebbero decine di
          badge per ruolo, e non c'è nessun permesso su cui agire — il valore sta nel codice. Un
          numero grande qui vuol dire che l'allineamento dei permessi all'avvio non è andato a
          buon fine, e QUELLO è il problema, non la singola casella. */}
      {/* ⛔ Il conto in cima, come per gli altri due avvisi: i badge sono piccoli e sparsi in una
          tabella che scorre. ⚠️ E dice **cosa non è**: le figlie di una pagina guardata e i due
          grantor non sono in conto, perché non sono difetti — mescolarli rifarebbe l'elenco unico
          in cui il buco e la scelta si somigliano. */}
      {Object.values(data.senzaGuardia ?? {}).filter((m) => m === 'buco').length > 0 && (
        <Banner kind="warn">
          <b>
            {Object.values(data.senzaGuardia ?? {}).filter((m) => m === 'buco').length} caselle
            governano la voce di menu e non la porta.
          </b>{' '}
          Per quelle schermate l'API è protetta dal solo elenco dei ruoli: spegnere la casella
          nasconde la voce e <b>non</b> chiude l'endpoint. Hanno una nota gialla sotto il nome.
          Non è un guasto di questa pagina — è una guardia che manca lato server, e si chiude una
          chiave per volta.
        </Banner>
      )}
      {(data.senzaRiga ?? 0) > 0 && (
        <Banner kind="info">
          {data.senzaRiga} caselle risultano spente solo perché <b>non hanno ancora una riga</b>:
          per quelle vale il valore predefinito del ruolo, che è acceso. Si sistemano da sole al
          prossimo avvio del backend; se il numero resta alto, l'allineamento all'avvio non sta
          funzionando.
        </Banner>
      )}
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {/* La tabella scorre DENTRO la card così l'intestazione dei ruoli resta
          sempre visibile (sticky): in fondo alla lista non si rischia di
          lavorare sul ruolo sbagliato. Prima colonna sticky anche in orizzontale. */}
      <div className="card" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 230px)' }}>
        <table className="grid">
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, top: 0, background: '#fff', zIndex: 3, boxShadow: '0 1px 0 var(--line)' }}>Sezione</th>
              {data.roles.map((r) => (
                <th key={r.key} style={{ textAlign: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 2, boxShadow: '0 1px 0 var(--line)' }}>
                  <span style={{ color: r.color ?? undefined }}>{r.label}</span>
                  {!r.isSystem && <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--muted)' }}>personalizzato</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedPages.map((pageKey) => (
              <tr key={pageKey}>
                <td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 600, zIndex: 1 }}>
                  {pageLabel(pageKey)}
                  {/* ⛔ Il verso diretto, scritto UNA volta sulla riga dell'hub invece che su ogni
                      cella: chi accende «Gestione dieta» deve sapere che sta accendendo tre cose. */}
                  {(apreAnche[pageKey] ?? []).length > 0 && (
                    <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', marginTop: 2, whiteSpace: 'normal', maxWidth: 200 }}>
                      Apre anche: {(apreAnche[pageKey] ?? []).map(pageLabel).join(', ')}
                    </div>
                  )}
                  {/* ⛔ **La casella che sembra un cancello e non lo è.** Sta sulla RIGA e non su
                      ogni cella: non dipende dal ruolo — l'endpoint non ha la guardia per nessuno —
                      e ripeterlo su otto colonne sarebbe rumore su una cosa vera.

                      ⚠️ Solo per i **buchi**: la figlia di una pagina guardata e il grantor non
                      sono difetti, e segnalarli insieme rifarebbe l'elenco unico che questa
                      classificazione esiste per sciogliere. */}
                  {data.senzaGuardia?.[pageKey] === 'buco' && (
                    <div style={{ fontSize: 10, fontWeight: 400, color: '#8A5A00', marginTop: 2, whiteSpace: 'normal', maxWidth: 200 }}>
                      ⚠️ Questa casella governa la <b>voce di menu</b>, non l'API: spegnerla nasconde
                      la schermata e <b>non</b> chiude la porta.
                    </div>
                  )}
                </td>
                {data.roles.map((r) => {
                  const c = cell(r.key, pageKey);
                  const locked = r.key === 'admin' && pageKey === 'permissions';
                  const changed = cellKey(r.key, pageKey) in edits;
                  return (
                    <td key={r.key} style={{ textAlign: 'center', background: changed ? 'var(--chip)' : undefined }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
                          <span className="muted" style={{ fontSize: 11, width: 44, textAlign: 'right' }}>vede</span>
                          <Toggle
                            on={c.canView}
                            disabled={!editable || locked}
                            title={locked ? 'Bloccato (anti-lockout)' : 'Vede la sezione'}
                            onChange={(next) => setLocal(r.key, pageKey, { canView: next })}
                          />
                        </div>
                        {/* ⛔ **Il badge tace se la casella è stata toccata e non salvata.** Gli
                            avvisi arrivano dal server, cioè dallo stato SALVATO: lasciarli sotto un
                            interruttore appena acceso vorrebbe dire scrivere «questa cella dice
                            spento ma è aperta» sotto una cella che dice acceso. */}
                        {!c.canView && <AvvisoPortaAperta cella={aperte.get(`${r.key}|${pageKey}|view`)} nomeRuolo={nomeRuolo} />}
                        <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
                          <span className="muted" style={{ fontSize: 11, width: 44, textAlign: 'right' }}>gestisce</span>
                          <Toggle
                            on={c.canManage}
                            disabled={!editable || locked || !c.canView}
                            title={!c.canView ? 'Serve prima "vede"' : 'Può modificare'}
                            onChange={(next) => setLocal(r.key, pageKey, { canManage: next })}
                          />
                        </div>
                        {!c.canManage && <AvvisoPortaAperta cella={aperte.get(`${r.key}|${pageKey}|manage`)} nomeRuolo={nomeRuolo} />}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Barra azioni: compare quando ci sono modifiche non salvate. */}
      {editable && dirtyCount > 0 && (
        <div className="perm-savebar">
          <span><i className="ti ti-alert-circle" /> {dirtyCount} {dirtyCount === 1 ? 'modifica non salvata' : 'modifiche non salvate'}</span>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn ghost" onClick={() => setEdits({})} disabled={saving}>Annulla</button>
            <button className="btn" onClick={() => setConfirming(true)} disabled={saving}>
              <i className="ti ti-device-floppy" /> Salva
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <Modal title="Confermi le modifiche ai permessi?" onClose={() => !saving && setConfirming(false)}>
          <p style={{ marginTop: 0 }}>
            Stai per applicare <b>{dirtyCount}</b> {dirtyCount === 1 ? 'modifica' : 'modifiche'} alla matrice dei permessi.
            I ruoli interessati vedranno cambiare le sezioni accessibili al loro prossimo accesso.
          </p>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button className="btn ghost" onClick={() => setConfirming(false)} disabled={saving}>Annulla</button>
            <button className="btn" onClick={save} disabled={saving}>{saving ? 'Salvo…' : 'Sì, salva'}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
