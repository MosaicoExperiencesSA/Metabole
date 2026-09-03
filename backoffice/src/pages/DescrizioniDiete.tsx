import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Spinner } from '../components/ui';
import { contiDelleFamiglie, raggruppaFamiglie, type DietRow, type Famiglia } from '../lib/famiglieDiete';
import { useAuth } from '../auth/AuthContext';
import { eNutrizionista } from '../lib/ruoliNutrizionista';

/**
 * ⛔ **LE DESCRIZIONI DELLE DIETE — quelle che la cliente legge in app.**
 *
 * Richiesta di Simone del 22/8: *«nella parte del nutrizionista manca una tabella dove si vedono e si
 * possono modificare le descrizioni delle diete, che sono poi quelle che si leggono in app come
 * spiegazione»*.
 *
 * ## ⛔ UNA RIGA PER FAMIGLIA, NON PER DIETA — e non è una comodità
 *
 * A database una «dieta» è una riga per **nome × stile × regime × obiettivo × pasti**: una famiglia
 * come «Mediterranea» sono fino a **18** righe. Una tabella fedele al database ne mostrerebbe 18, e
 * chi ne compila una crede di aver finito.
 *
 * ⚠️ **Il difetto sarebbe invisibile**, ed è la parte che conta: in **registrazione** e sul **sito**
 * il codice tappa i buchi — basta che *una* variante sia compilata perché la card lo sia
 * (`onboarding.service.ts`, `catalog.service.publicPaths`). Ma nel **profilo** la cliente legge la
 * **sua variante esatta** (`profile.service.ts` → `dieta-mostrata.ts`). Quindi si guarda il catalogo,
 * sembra a posto, e intanto una cliente vegana a 5 pasti legge, sotto «La tua dieta», la descrizione di un'ALTRA dieta: `profile.service.ts` ripiega su quella dell'**ultimo menu consegnato** quando la sua non ce l'ha. ⚠️ Non è il vuoto — è peggio del vuoto, perché sembra una risposta.
 *
 * Perciò: una riga per famiglia, e il salvataggio scrive su **tutte** le sue varianti, in una
 * transazione lato server (`PATCH /diets/famiglia/product`). ⛔ Non con un giro di chiamate dal
 * browser: è così che «pubblica la famiglia» falliva a metà lasciando due testi diversi.
 *
 * ## ⚠️ LA COLONNA «COPERTE» È IL VERO MOTIVO PER CUI QUESTA PAGINA ESISTE
 *
 * Dice **quante varianti su quante** hanno la descrizione. È l'unico numero che risponde alla
 * domanda «una mia cliente sta leggendo la spiegazione di un'altra dieta?», e prima non lo diceva
 * nessuno — né una schermata né uno script. *Un dato che agisce e non si vede.*
 *
 * ## ⛔ QUELLO CHE QUESTA PAGINA **NON** CAMBIA, ed è la metà grossa
 *
 * Nel profilo dell'app il «?» mostra **due** testi in fila: questa descrizione, e poi una scheda
 * lunga — «In pratica», «Cosa dice la ricerca», «Da tenere presente», le fonti — che è **cablata nel
 * codice dell'app** (`app/src/onboarding/dietInfo.ts`), per **stile** e non per dieta. Cambiarla
 * richiede un rilascio dell'app, e due diete con lo stesso stile condividono la stessa scheda.
 * ⚠️ Sta scritto qui e in pagina perché nessuno creda di poter correggere da qui una frase che sta
 * lì: *una ragione falsa è peggio di un ordine sbagliato*.
 */

export function DescrizioniDiete() {
  const [righe, setRighe] = useState<DietRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [apri, setApri] = useState<Famiglia | null>(null);
  /**
   * ⛔ **ANCHE L'ADMIN SCRIVE, dal 3/9.** Simone, guardando questa pagina: *«qui dovrei poter
   * modificare le descrizioni che poi le clienti leggono sull'app»*, e vedeva «sola lettura» su
   * tutte le righe.
   *
   * ⚠️ Il 22/8 era una scelta scritta qui: l'admin legge e basta, perché `PATCH famiglia/product`
   * ereditava `@Roles('nutritionist', 'head_nutritionist')` dal controller e un pulsante che si
   * vede e risponde 403 è peggio di un pulsante che non c'è. Le strade erano due — togliere il
   * pulsante o aprire la rotta — e la sceglie chi ha il prodotto in mano.
   *
   * ⛔ **Il pulsante e la rotta si sono mossi INSIEME** (`catalog.controller.ts`): aprire solo qui
   * avrebbe rifatto esattamente il difetto che questa nota descriveva.
   */
  const { user } = useAuth();
  const puoScrivere = eNutrizionista(user?.role) || user?.role === 'admin';
  const [filtro, setFiltro] = useState('');
  const [soloBuchi, setSoloBuchi] = useState(false);
  /** ⚠️ Spento: le famiglie che chiudono non si scrivono più. Ma si possono rivedere, non spariscono. */
  const [mostraChiuse, setMostraChiuse] = useState(false);

  /**
   * ⛔ **L'elenco delle famiglie che chiudono arriva dal BACKEND**, dove sta la lista canonica
   * (`FAMIGLIE_CHE_SPARISCONO`). Se la chiamata non risponde si usa il ripiego scritto in
   * `famiglieDiete.ts` — meglio una lista che può invecchiare che nove famiglie morte in cima alla
   * pagina.
   */
  const [chiuse, setChiuse] = useState<ReadonlySet<string> | undefined>(undefined);

  async function carica() {
    try {
      setRighe(await api<DietRow[]>('/diets'));
      setError(null);
    } catch (e) {
      setRighe([]);
      setError(e instanceof Error ? e.message : 'Caricamento non riuscito.');
    }
    try {
      const t = await api<{ families?: { name: string; inChiusura?: boolean }[] }>('/catalog/taxonomy');
      const nomi = (t.families ?? []).filter((f) => f.inChiusura).map((f) => f.name);
      if (nomi.length) setChiuse(new Set(nomi));
    } catch { /* si resta sul ripiego: non è un errore che valga un banner rosso in pagina */ }
  }
  useEffect(() => { void carica(); }, []);

  const famiglie = useMemo(() => raggruppaFamiglie(righe ?? [], chiuse), [righe, chiuse]);
  /**
   * ⛔ **Le famiglie che chiudono escono dai conti, non solo dalla tabella.** Contandole,
   * «famiglie incomplete» resterebbe rosso per sempre su righe che stanno per sparire — la stessa
   * ragione per cui le archiviate non si contano.
   */
  const { vive, inChiusura, varianti, coperte, scoperte } = useMemo(() => contiDelleFamiglie(famiglie), [famiglie]);

  const mostrate = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return (mostraChiuse ? famiglie : vive)
      .filter((f) => (soloBuchi ? f.coperte < f.varianti.length : true))
      .filter((f) => !q || `${f.nome} ${f.stile} ${f.clientName ?? ''}`.toLowerCase().includes(q));
  }, [famiglie, vive, mostraChiuse, filtro, soloBuchi]);


  if (!righe) return <Spinner />;

  return (
    <>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ padding: '12px 16px', marginBottom: 14 }}>
        <div className="row" style={{ gap: 18, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <b style={{ fontSize: 13 }}>
            <i className="ti ti-file-description" /> {vive.length} famiglie · {varianti} varianti
          </b>
          {inChiusura > 0 && (
            <span className="muted" style={{ fontSize: 12 }}>
              {/* ⚠️ Si dice quante sono state tolte: niente tagli silenziosi. */}
              <b>{inChiusura}</b> in chiusura, non elencate
            </span>
          )}
          {/*
            ⚠️ Il numero che conta: quante varianti hanno la descrizione. In registrazione e sul sito
            basta che ne sia compilata una per famiglia; nel PROFILO la cliente legge la sua, quindi
            una variante scoperta è una cliente che apre il «?» e trova il vuoto.
          */}
          <span className="muted" style={{ fontSize: 12 }}>
            Varianti con la descrizione: <b style={{ color: coperte < varianti ? '#B3261E' : undefined }}>{coperte}</b> su {varianti}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            Famiglie incomplete: <b style={{ color: scoperte > 0 ? '#B3261E' : undefined }}>{scoperte}</b>
          </span>
        </div>
        <p className="hint" style={{ margin: '8px 0 0' }}>
          Quello che scrivi qui la cliente lo legge in <b>registrazione</b> (schermo «Stile che
          preferisci»), nel suo <b>profilo</b> sotto «La tua dieta», e sul <b>sito pubblico</b>.
          Salvando, il testo va su <b>tutte le varianti</b> della famiglia — regimi, obiettivi e numeri
          di pasti — così nessuna cliente resta senza.
        </p>
        {/*
          ⛔ La metà che questa pagina NON governa, detta dove si legge e non solo nel codice: la
          scheda lunga del «?» (In pratica · Cosa dice la ricerca · fonti) è scritta nell'app, per
          stile, e cambia solo con un rilascio.
        */}
        <p className="hint" style={{ margin: '6px 0 0' }}>
          ⚠️ Nel profilo, sotto questa descrizione, l'app mostra anche una <b>scheda fissa per stile</b>
          {' '}(«In pratica», «Cosa dice la ricerca», le fonti): quella non si cambia da qui — sta nel
          codice dell'app e serve un rilascio.
        </p>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Cerca una famiglia…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
        <button
          className="chip"
          onClick={() => setSoloBuchi((v) => !v)}
          style={{ cursor: 'pointer', borderColor: soloBuchi ? 'var(--teal)' : undefined, background: soloBuchi ? 'var(--chip)' : undefined }}
        >
          Solo quelle incomplete
        </button>
        {inChiusura > 0 && (
          <button
            type="button"
            className="chip"
            onClick={() => setMostraChiuse((v) => !v)}
            title="Le famiglie che confluiscono in altre: le clienti si spostano e questi testi non li leggerà più nessuno"
            style={{ cursor: 'pointer', borderColor: mostraChiuse ? 'var(--teal)' : undefined, background: mostraChiuse ? 'var(--chip)' : undefined }}
          >
            {mostraChiuse ? 'Nascondi quelle in chiusura' : `Mostra anche le ${inChiusura} in chiusura`}
          </button>
        )}
      </div>

      {mostrate.length === 0 ? (
        <div className="empty">{soloBuchi ? 'Nessuna famiglia incompleta: tutte le varianti hanno la descrizione ✓' : 'Nessuna famiglia.'}</div>
      ) : (
        <div className="card">
          <table className="grid">
            <thead>
              <tr>
                <th>Famiglia</th>
                <th>Nome per la cliente</th>
                <th>Descrizione</th>
                <th>Coperte</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mostrate.map((f) => (
                <tr key={f.chiave}>
                  <td>
                    <b>{f.nome}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{f.stile}</div>
                  </td>
                  <td>{f.clientName ?? <span className="muted">—</span>}</td>
                  <td style={{ maxWidth: 460 }}>
                    {f.descrizione
                      ? <span style={{ fontSize: 13 }}>{f.descrizione}</span>
                      : <span className="muted">— nessuna descrizione</span>}
                    {/*
                      ⚠️ Due varianti compilate diversamente NON si possono unificare senza dirlo:
                      salvando si sovrascrive anche quella che qualcuno aveva scritto apposta.
                    */}
                    {f.testiDiversi && (
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 3, color: '#B4491F' }}>
                        ⚠️ Le varianti non dicono tutte la stessa cosa: qui sopra vedi la prima.
                        Salvando le uniformi.
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`chip ${f.coperte < f.varianti.length ? 'red' : ''}`} style={{ fontSize: 11 }}>
                      {f.coperte}/{f.varianti.length}
                    </span>
                    {f.accese === 0 && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>non attiva alle clienti</div>
                    )}
                  </td>
                  <td>
                    {f.inChiusura ? (
                      /* ⚠️ Visibile solo con l'interruttore acceso: la si può ancora scrivere, ma
                         sapendo che quei testi stanno per non servire più a nessuno. */
                      <span className="chip gray" style={{ fontSize: 11 }} title="Questa famiglia confluisce in un'altra: le clienti si spostano">
                        in chiusura
                      </span>
                    ) : null}
                    {puoScrivere ? (
                      <button className="btn ghost sm" onClick={() => setApri(f)}>
                        <i className="ti ti-pencil" /> Scrivi
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>sola lettura</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {apri && (
        <ModaleFamiglia
          famiglia={apri}
          onChiudi={() => setApri(null)}
          onSalvato={async (quante) => {
            setApri(null);
            setNotice(`Scritto su ${quante} variant${quante === 1 ? 'e' : 'i'} di «${apri.nome}».`);
            await carica();
          }}
          onErrore={setError}
        />
      )}
    </>
  );
}

function ModaleFamiglia({ famiglia, onChiudi, onSalvato, onErrore }: {
  famiglia: Famiglia;
  onChiudi: () => void;
  onSalvato: (quante: number) => void | Promise<void>;
  onErrore: (m: string) => void;
}) {
  const [clientName, setClientName] = useState(famiglia.clientName ?? '');
  const [descrizione, setDescrizione] = useState(famiglia.descrizione ?? '');
  const [inCorso, setInCorso] = useState(false);
  const MAX = 400;

  async function salva() {
    setInCorso(true);
    try {
      const esito = await api<{ aggiornate: number }>('/diets/famiglia/product', {
        method: 'PATCH',
        body: JSON.stringify({
          famiglia: famiglia.nome,
          stile: famiglia.stile,
          /**
           * ⛔ **`null`, non `undefined`** (revisione, 22/8). `JSON.stringify` **toglie** le chiavi
           * `undefined`: con quella stesura svuotare un campo era impossibile — si cancellava la
           * `textarea`, si salvava, e il testo restava. ⚠️ E `Diete.tsx` per lo stesso campo manda
           * già `null`: due scritture sulla stessa colonna con due significati opposti.
           */
          clientName: clientName.trim() || null,
          clientDescription: descrizione.trim() || null,
        }),
      });
      await onSalvato(esito?.aggiornate ?? famiglia.varianti.length);
    } catch (e) {
      onErrore(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setInCorso(false);
    }
  }

  const scoperte = famiglia.varianti.length - famiglia.coperte;

  return (
    <Modal title={`${famiglia.nome} · ${famiglia.stile}`} onClose={onChiudi}>
      <p className="hint" style={{ marginTop: 0 }}>
        Quello che scrivi va su <b>tutte e {famiglia.varianti.length}</b> le varianti di questa
        famiglia{scoperte > 0 && <> — {scoperte} adesso {scoperte === 1 ? 'è senza descrizione' : 'sono senza descrizione'}</>}.
      </p>

      <label style={{ display: 'block', fontSize: 13, marginTop: 10 }}>
        Nome per la cliente
        <input
          className="input"
          style={{ width: '100%', marginTop: 4 }}
          value={clientName}
          maxLength={60}
          placeholder="Come si chiama questa dieta per chi la legge"
          onChange={(e) => setClientName(e.target.value)}
        />
      </label>

      <label style={{ display: 'block', fontSize: 13, marginTop: 12 }}>
        Descrizione
        <textarea
          className="input"
          style={{ width: '100%', marginTop: 4, minHeight: 120, resize: 'vertical' }}
          value={descrizione}
          maxLength={MAX}
          placeholder="Due o tre righe: cosa mangia, e perché le fa bene."
          onChange={(e) => setDescrizione(e.target.value)}
        />
        {/*
          ⚠️ Il contatore c'è perché il limite è del server (400): senza, si scrive di più e si scopre
          il tetto solo premendo Salva — e il testo scritto in più non si sa dove sia finito.
        */}
        <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
          {descrizione.length}/{MAX} caratteri
        </div>
      </label>

      {/*
        ⚠️ Se le varianti dicevano cose diverse, salvare le uniforma: si dice PRIMA di premere, non
        dopo. È la stessa regola della nota nella riga della tabella.
      */}
      {famiglia.testiDiversi && (
        <Banner kind="info">
          Alcune varianti avevano una descrizione <b>diversa</b> da questa. Salvando, tutte e{' '}
          {famiglia.varianti.length} avranno il testo qui sopra.
        </Banner>
      )}

      <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
        <button className="btn ghost sm" disabled={inCorso} onClick={onChiudi}>Lascia com'è</button>
        {/*
          ⚠️ Il pulsante NON si spegne sulla descrizione vuota: svuotarla è una cosa legittima —
          una descrizione incollata sulla famiglia sbagliata va tolta, non lasciata lì perché la
          form non permette di cancellare. Si chiede conferma invece di impedirlo.
        */}
        <button
          className="btn sm"
          disabled={inCorso}
          onClick={() => {
            if (!descrizione.trim() && famiglia.coperte > 0
              && !window.confirm(`Svuoto la descrizione di ${famiglia.varianti.length} varianti di «${famiglia.nome}»?`)) return;
            void salva();
          }}
        >
          {inCorso ? 'Salvo…' : `Scrivi su ${famiglia.varianti.length} varianti`}
        </button>
      </div>
    </Modal>
  );
}
