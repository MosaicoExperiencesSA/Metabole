import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Pager, Spinner } from '../components/ui';
import { BottoneExcel, ContatoreRighe, useTabella, stileScorrevole, type Colonna } from '../components/tabella';
import { oggiIso, scaricaExcel, type Cella } from '../lib/excel';

/**
 * VALORI NUTRIZIONALI — la tabella da cui Gaia prende i numeri, e l'unico posto dove si correggono.
 *
 * Nasce dall'errore dell'11/8: a una cliente che chiedeva del riso basmati Gaia ha risposto a memoria,
 * invertendo l'indice glicemico. Da allora i numeri che dice vengono da qui, con la fonte accanto —
 * e questa pagina esiste perché **le fonti pubbliche non sono vangelo**. L'indice glicemico delle
 * patate va da 73 a 111 secondo la tabella che si guarda: chi risponde di cosa mangiano le clienti
 * deve poter dire «questo numero non va bene».
 *
 * Le tre cose che si fanno qui, in ordine di importanza:
 *  1. **la coda «da confermare»** — i valori che nessuno ha ancora guardato. Gaia li usa già (aspettare
 *     l'approvazione vorrebbe dire che nei primi tempi ogni domanda finisce comunque alla
 *     nutrizionista, cioè il problema che stiamo risolvendo), ma finché sono lì sono nostri e non suoi;
 *  2. **la correzione** di un valore. Correggere è confermare: se ci mette le mani, quel numero è suo,
 *     e nessun deploy lo sovrascrive più;
 *  3. **gli alimenti chiesti e mancanti**, col numero di volte. È il modo in cui la tabella cresce
 *     guidata dalle domande vere invece che da un elenco deciso a tavolino.
 *
 * L'**affidabilità** non è un commento: decide come Gaia dice il dato. Con `debole` non dice il
 * numero, dice il range — perché «l'anguria ha IG 72» è una precisione che i dati non hanno.
 */

interface Valore {
  id: string;
  name: string;
  synonyms: string[];
  category: string | null;
  state: string | null;
  glycemicIndex: number | null;
  glycemicIndexMin: number | null;
  glycemicIndexMax: number | null;
  glycemicIndexSource: string | null;
  glycemicIndexReliability: string | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  source: string | null;
  note: string | null;
  verifiedAt: string | null;
  verifiedBy: { displayName: string } | null;
}

interface Mancante {
  id: string;
  term: string;
  /** Quante volte una cliente l'ha CHIESTO a Gaia e non c'era. */
  times: number;
  /** Quante ricette attive lo usano. ⚠️ Non si somma a `times`: sono unità diverse. */
  ricette: number;
  motivo: string | null;
  /** La riga a cui si abbinerebbe: si chiude con un sinonimo invece che con una riga nuova. */
  suggerito: string | null;
  lastAskedAt: string;
}

/**
 * ⚠️ I TRE PERCHÉ, e si chiudono in tre modi diversi. Un elenco che dice solo «manca» obbliga chi lo
 * lavora a ricapirlo ogni volta — e chi deve ricapire ogni volta, dopo un po' non lo apre più.
 */
const MOTIVO: Record<string, { etichetta: string; spiega: string }> = {
  non_in_tabella: {
    etichetta: 'Non in tabella',
    spiega: 'Nessuna riga ha questo nome. Si chiude aggiungendo la riga — o, se è un altro modo di dire una riga che c\'è già, aggiungendolo come sinonimo.',
  },
  solo_da_cotto: {
    etichetta: 'Solo da cotto',
    spiega: 'La riga c\'è ma porta il valore da cotto, e nelle ricette le grammature sono a crudo: contarla così sbaglia di volte (riso e legumi anche tre). Serve la riga a crudo.',
  },
  senza_stato: {
    etichetta: 'Senza stato',
    spiega: 'La riga c\'è e non dice se quel valore è a crudo o da cotto. «Senza stato» non è «cotto»: è «non lo so», e va dichiarato.',
  },
};

const AFFIDABILITA: Record<string, { etichetta: string; chip: string; spiega: string }> = {
  solida: { etichetta: 'Solida', chip: '', spiega: 'Più fonti concordano: Gaia dice il numero.' },
  media: { etichetta: 'Media', chip: 'amber', spiega: 'Una fonte autorevole o un range noto: Gaia dice il numero se il range è stretto, altrimenti il range.' },
  debole: { etichetta: 'Debole', chip: 'red', spiega: 'Un solo dato, un surrogato o fonti in disaccordo: Gaia dice SOLO il range, mai il numero.' },
  /**
   * ⚠️ «NON SI APPLICA» NON È «NON LO SO» (18/8). Un alimento senza carboidrati — l'olio, il
   * parmigiano, il petto di pollo — un indice glicemico non ce l'ha: non è un dato che ci manca.
   * Prima le due cose erano lo stesso campo vuoto, e Gaia rispondeva **tacendo** a chi lo chiedeva.
   * ⚠️ E dev'esserci anche nella tendina qui sotto: senza, aprire una di queste righe e salvarla
   * riscriverebbe «non lo so» sopra una dichiarazione del capo nutrizionista, in silenzio.
   */
  non_applicabile: { etichetta: 'Non si applica', chip: '', spiega: 'Alimento senza carboidrati (o con quantità trascurabili): l\'indice glicemico non esiste per questo alimento, e Gaia lo dice invece di tacere.' },
};

const numero = (v: number | null) => (v === null || v === undefined ? '—' : String(v).replace('.', ','));

export function ValoriNutrizionali() {
  const { can } = useAuth();
  const puoModificare = can('nutrient_facts', 'manage');
  const [valori, setValori] = useState<Valore[]>([]);
  /**
   * ⚠️ **DUE ELENCHI, NON UNO** — corretto il 19/8 sera dopo la revisione avversariale. Ordinare in
   * un elenco solo prima per «quante ricette» e poi per «quante volte l'hanno chiesto» sembrava
   * ragionevole e ⛔ **seppelliva per sempre i termini chiesti in chat**: le righe che vengono dalle
   * ricette sono trecento, il tetto era duecento, e nessuna domanda di una cliente arrivava più in
   * pagina. «Tempeh chiesto 40 volte è la prossima riga da scrivere» — la frase con cui questa
   * tabella è nata — aveva smesso di essere vera, e nessun errore lo diceva.
   * ⚠️ È lo stesso motivo per cui i due numeri non si sommano: sono unità diverse, e ordinarle
   * insieme è sommarle di nascosto.
   */
  const [daRicette, setDaRicette] = useState<{ righe: Mancante[]; quanti: number }>({ righe: [], quanti: 0 });
  const [chieste, setChieste] = useState<{ righe: Mancante[]; quanti: number }>({ righe: [], quanti: 0 });
  const [esporto, setEsporto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [soloDaConfermare, setSoloDaConfermare] = useState(false);
  const [modifico, setModifico] = useState<string | null>(null);
  const [bozza, setBozza] = useState<Record<string, string>>({});
  const [salvo, setSalvo] = useState(false);

  async function carica() {
    setLoading(true);
    try {
      const [v, m] = await Promise.all([
        api<Valore[]>(`/nutrient-facts${soloDaConfermare ? '?daConfermare=1' : ''}`),
        api<{ daRicette: { righe: Mancante[]; quanti: number }; chieste: { righe: Mancante[]; quanti: number } }>(
          '/nutrient-facts/mancanti',
        ).catch(() => ({ daRicette: { righe: [], quanti: 0 }, chieste: { righe: [], quanti: 0 } })),
      ]);
      setValori(v);
      setDaRicette(m.daRicette ?? { righe: [], quanti: 0 });
      setChieste(m.chieste ?? { righe: [], quanti: 0 });
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Il tuo ruolo non può vedere i valori nutrizionali.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void carica(); }, [soloDaConfermare]);

  function apriModifica(v: Valore) {
    setModifico(v.id);
    setBozza({
      glycemicIndex: v.glycemicIndex?.toString() ?? '',
      glycemicIndexMin: v.glycemicIndexMin?.toString() ?? '',
      glycemicIndexMax: v.glycemicIndexMax?.toString() ?? '',
      glycemicIndexReliability: v.glycemicIndexReliability ?? '',
      kcal: v.kcal?.toString() ?? '',
      protein: v.protein?.toString() ?? '',
      carbs: v.carbs?.toString() ?? '',
      fat: v.fat?.toString() ?? '',
      fiber: v.fiber?.toString() ?? '',
      state: v.state ?? '',
      note: v.note ?? '',
    });
  }

  /** I numeri arrivano come testo dai campi: virgola o punto, e vuoto vuol dire «nessun valore». */
  const num = (s: string): number | null | undefined => {
    const t = (s ?? '').trim().replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  };

  async function salva(v: Valore) {
    const corpo: Record<string, unknown> = { state: bozza.state.trim() || null, note: bozza.note.trim() || null, glycemicIndexReliability: bozza.glycemicIndexReliability || null };
    for (const campo of ['glycemicIndex', 'glycemicIndexMin', 'glycemicIndexMax', 'kcal', 'protein', 'carbs', 'fat', 'fiber']) {
      const n = num(bozza[campo]);
      if (n === undefined) { setError(`«${campo}» non è un numero valido.`); return; }
      corpo[campo] = n;
    }
    setSalvo(true);
    setError(null);
    try {
      await api(`/nutrient-facts/${v.id}`, { method: 'PATCH', body: JSON.stringify(corpo) });
      setNotice(`«${v.name}» aggiornato e confermato a tuo nome: da adesso nessun aggiornamento del sistema lo sovrascrive.`);
      setModifico(null);
      await carica();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setSalvo(false);
    }
  }

  async function conferma(v: Valore) {
    if (!confirm(`Confermare i valori di «${v.name}» così come sono?`)) return;
    try {
      await api(`/nutrient-facts/${v.id}/conferma`, { method: 'POST' });
      setNotice(`«${v.name}» confermato.`);
      await carica();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non riuscito.');
    }
  }

  /**
   * ⚠️ «Questo nome è un altro modo di dire quella riga». È l'azione che fa risparmiare il lavoro
   * vero: «olio extravergine» scritto in tre modi sono 6494 ricette, e si chiudono con tre sinonimi
   * invece che con tre righe nuove — righe che sarebbero lo stesso alimento contato due volte, con
   * numeri che prima o poi divergono.
   */
  async function aggiungiSinonimo(m: Mancante) {
    if (!m.suggerito) return;
    if (!confirm(`Aggiungere «${m.term}» come altro nome di «${m.suggerito}»?\n\nDa quel momento le ricette che scrivono «${m.term}» si contano su quella riga.`)) return;
    try {
      await api(`/nutrient-facts/mancanti/${m.id}/sinonimo`, { method: 'POST', body: JSON.stringify({}) });
      await carica();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non riuscito.');
    }
  }

  /**
   * ⚠️ I DUE PANNELLI APERTI SOTTO UNA RIGA, E UNO SOLO ALLA VOLTA — richiesta di Simone (20/8).
   *
   * «Associa» e «dettaglio» rispondono a due domande diverse e **restano due pulsanti**: associare
   * dice «questo nome è un altro modo di chiamare una riga che c'è già», il dettaglio dice «questo
   * alimento in tabella non c'è e lo scrivo adesso». ⛔ Un pulsante solo obbligherebbe a decidere
   * *dopo* aver cliccato — e qui la scelta sbagliata non è un fastidio: un sinonimo messo dove
   * serviva una riga **fa sparire il buco senza chiuderlo**.
   */
  const [associo, setAssocio] = useState<string | null>(null);
  const [rigaScelta, setRigaScelta] = useState('');
  const [dettaglio, setDettaglio] = useState<string | null>(null);
  const [nuovo, setNuovo] = useState<Record<string, string>>({});

  function apriAssocia(m: Mancante) {
    setDettaglio(null);
    setAssocio(m.id);
    // ⚠️ Il suggerimento si propone, non si applica: resta una tendina da confermare.
    setRigaScelta(valori.find((v) => v.name === m.suggerito)?.id ?? '');
  }

  function apriDettaglio(m: Mancante) {
    setAssocio(null);
    setDettaglio(m.id);
    setNuovo({});
  }

  async function associa(m: Mancante) {
    if (!rigaScelta) return;
    const nome = valori.find((v) => v.id === rigaScelta)?.name ?? '';
    if (!confirm(`Aggiungere «${m.term}» come altro nome di «${nome}»?\n\nDa quel momento le ricette che scrivono «${m.term}» si contano su quella riga.`)) return;
    try {
      await api(`/nutrient-facts/mancanti/${m.id}/sinonimo`, { method: 'POST', body: JSON.stringify({ rigaId: rigaScelta }) });
      setAssocio(null);
      await carica();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non riuscito.');
    }
  }

  async function creaDaMancante(m: Mancante) {
    try {
      await api(`/nutrient-facts/mancanti/${m.id}/crea`, { method: 'POST', body: JSON.stringify(nuovo) });
      setDettaglio(null);
      await carica();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non riuscito.');
    }
  }

  /**
   * ⚠️ **GLI AROMI: PRIMA SI GUARDANO, POI SI SCRIVONO** — richiesta di Simone (20/8), e la
   * separazione è la richiesta, non un dettaglio.
   *
   * Metà dei primi venti posti dell'elenco sono aglio, sale, pepe, acqua, prezzemolo: pesano zero
   * nel conto e occupano lo spazio delle righe che servono davvero. ⛔ Ma una scrittura in blocco
   * che nessuno ha visto prima è la cosa che qui non si fa: il pulsante **chiede l'elenco**, lo
   * mostra per intero, e solo dopo si conferma. È la stessa forma della conferma allergeni in
   * blocco.
   */
  const [aromi, setAromi] = useState<Mancante[] | null>(null);

  async function guardaAromi() {
    try {
      const r = await api<{ righe: Mancante[]; quanti: number }>('/nutrient-facts/mancanti/aromi');
      setAromi(r.righe ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non riuscito.');
    }
  }

  async function togliAromi() {
    if (!aromi?.length) return;
    try {
      const r = await api<{ tolti: number; saltati: number }>('/nutrient-facts/mancanti/aromi', {
        method: 'POST',
        body: JSON.stringify({ ids: aromi.map((m) => m.id) }),
      });
      setAromi(null);
      await carica();
      /**
       * ⚠️ **IL MESSAGGIO VA DOPO `carica()`, E NON È UN DETTAGLIO** — revisione avversariale del
       * 20/8. Prima stava prima, e `carica()` azzera l'avviso quando va a buon fine: con il batching
       * di React lo stato finale era `null` e **il banner non compariva mai**. Su una scrittura in
       * blocco che non si torna indietro, l'unica riga che dice cos'è successo spariva prima di
       * comparire — un dato che agisce e non si vede, in tre righe di codice.
       *
       * ⚠️ E si dice **sempre**, non solo quando qualcosa è andato storto: «ho tolto 87 righe» è la
       * ricevuta di quello che si è appena approvato.
       */
      setNotice(
        r.saltati
          ? `Tolti ${r.tolti} aromi. ⚠️ ${r.saltati} non erano aromi e sono rimasti in elenco.`
          : `Tolti ${r.tolti} aromi dall'elenco.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non riuscito.');
    }
  }

  /**
   * ESPORTA L'ELENCO DA CORREGGERE IN EXCEL — richiesta di Simone del 20/8.
   *
   * ⚠️ **Non esporta quello che si vede: esporta tutto.** La pagina ne mostra 100 per elenco e ce
   * ne sono trecento; un foglio con dentro un terzo del lavoro, senza dirlo, è peggio di nessun
   * foglio — chi lo finisce crede di aver finito. Per questo c'è un endpoint suo (`mancanti/esporta`)
   * che non ha tetto, e non si riusa l'array già in pagina.
   *
   * ⚠️ **Un foglio solo, ma i due elenchi non si mescolano**: la prima colonna dice da quale
   * elenco viene la riga, e l'ordine è a blocchi — prima le ricette, poi le domande delle clienti.
   * Ordinarli insieme è la stessa cosa che sommare «usato in 1025 ricette» e «chiesto 40 volte»,
   * cioè il difetto del 19/8. In Excel il filtro automatico è già acceso: chi vuole un elenco solo
   * lo filtra.
   *
   * ⚠️ **Le colonne da riempire sono quelle del pulsante «dettaglio»**, nello stesso ordine. Se un
   * giorno il form impara un campo e il foglio no, la nutrizionista compila un foglio che non si
   * può ricopiare — ed è il genere di disallineamento che nessuno vede finché non ha già lavorato.
   */
  async function esportaMancanti() {
    setEsporto(true);
    setError(null);
    try {
      type Attuale = Partial<Record<string, string | number | null>>;
      const r = await api<{ quanti: { daRicette: number; chieste: number }; righe: (Mancante & { elenco: string; attuale: Attuale | null })[] }>(
        '/nutrient-facts/mancanti/esporta',
      );
      const intestazioni = [
        'Elenco', 'Alimento', 'Ricette che lo usano', 'Volte chiesto', 'Perché', 'Riga già in tabella',
        'Stato', 'Categoria', 'kcal', 'Proteine', 'Carboidrati', 'Zuccheri', 'Grassi', 'Fibre',
        'IG', 'IG min', 'IG max', 'Affidabilità IG', 'Fonte', 'Note',
      ];
      const campi = [
        'state', 'category', 'kcal', 'protein', 'carbs', 'sugars', 'fat', 'fiber',
        'glycemicIndex', 'glycemicIndexMin', 'glycemicIndexMax', 'glycemicIndexReliability', 'source', 'note',
      ];
      const righe: Cella[][] = r.righe.map((m) => [
        m.elenco,
        m.term,
        m.ricette,
        m.times,
        (m.motivo && MOTIVO[m.motivo]?.etichetta) || m.motivo || '',
        m.suggerito ?? '',
        // I valori che la riga raggiunta ha GIÀ: vuoti quando la riga non esiste (`non_in_tabella`),
        // pieni quando manca solo lo stato o mancano i valori a crudo.
        ...campi.map((c) => (m.attuale?.[c] ?? '') as Cella),
      ]);
      scaricaExcel(`alimenti-da-correggere-${oggiIso()}`, {
        nome: 'Da correggere',
        intestazioni,
        righe,
      });
      setNotice(
        `Esportati ${righe.length} alimenti (${r.quanti.daRicette} usati dalle ricette, ${r.quanti.chieste} chiesti dalle clienti). ` +
          'Le colonne da riempire sono le stesse del pulsante «dettaglio».',
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Non sono riuscito a esportare l\'elenco.');
    } finally {
      setEsporto(false);
    }
  }

  async function ignoraMancante(m: Mancante) {
    if (!confirm(`Togliere «${m.term}» dalla lista? Usalo quando non è il nome di un alimento.`)) return;
    try {
      await api(`/nutrient-facts/mancanti/${m.id}`, { method: 'PATCH' });
      /**
       * ⚠️ Si ricarica, non si toglie la riga e basta: l'elenco è **tagliato** a cento, e togliendo
       * righe dalla lista locale si sarebbe svuotato senza mai ripescare quelle rimaste fuori —
       * fino a sparire del tutto con altre centinaia ancora da lavorare.
       */
      await carica();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non riuscito.');
    }
  }

  /** La tabella di un elenco di mancanti. Due elenchi, una sola forma: se divergessero, chi guarda
   *  dovrebbe imparare due tabelle per la stessa cosa. */
  function tabellaMancanti(righe: Mancante[], chiave: string) {
    return (
      <div style={stileScorrevole(righe.length)} key={chiave}>
        <table className="table">
          <thead>
            <tr>
              <th>Alimento</th>
              <th style={{ textAlign: 'right' }}>Ricette</th>
              <th style={{ textAlign: 'right' }}>Chiesto</th>
              <th>Perché</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {righe.map((m) => {
              const perche = m.motivo ? MOTIVO[m.motivo] : null;
              return (
                <tr key={m.id}>
                  <td><b>{m.term}</b></td>
                  <td style={{ textAlign: 'right' }}>{m.ricette > 0 ? m.ricette : <span className="muted">—</span>}</td>
                  <td style={{ textAlign: 'right' }}>{m.times > 0 ? m.times : <span className="muted">—</span>}</td>
                  <td>
                    {perche ? (
                      <span title={perche.spiega}>{perche.etichetta}</span>
                    ) : (
                      <span className="muted" title="Chiesto in chat e non trovato in tabella.">Chiesto e non trovato</span>
                    )}
                    {m.suggerito && m.motivo === 'non_in_tabella' && (
                      <div className="muted" style={{ fontSize: 12 }}>somiglia a «{m.suggerito}»</div>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {puoModificare && m.suggerito && m.motivo === 'non_in_tabella' && (
                      <button
                        className="btn ghost sm"
                        title={`Aggiunge «${m.term}» come altro nome di «${m.suggerito}»: da lì in poi le ricette che lo scrivono si contano su quella riga.`}
                        onClick={() => void aggiungiSinonimo(m)}
                      >
                        è «{m.suggerito}»
                      </button>
                    )}
                    {puoModificare && (
                      <button
                        className="btn ghost sm"
                        title="È un altro modo di chiamare un alimento che in tabella c'è già: scegli quale."
                        onClick={() => apriAssocia(m)}
                      >
                        associa
                      </button>
                    )}
                    {puoModificare && (
                      <button
                        className="btn ghost sm"
                        title="In tabella non c'è: scrivilo adesso, con i suoi valori."
                        onClick={() => apriDettaglio(m)}
                      >
                        dettaglio
                      </button>
                    )}
                    {puoModificare && (
                      <button
                        className="btn ghost sm"
                        title="Non è un alimento (o non ci serve): togli dall'elenco"
                        onClick={() => void ignoraMancante(m)}
                      >
                        togli
                      </button>
                    )}
                  </td>
                </tr>
              );
            }).flatMap((riga, i) => {
              const m = righe[i];
              const sotto: JSX.Element[] = [riga];

              /**
               * ⚠️ **ASSOCIA: una tendina, non un campo libero.** Scrivere il nome a mano vorrebbe
               * dire poter scrivere un nome che non esiste — e il sinonimo finirebbe attaccato a
               * niente, o peggio a una riga sbagliata per un errore di battitura. Qui si sceglie
               * fra le righe che ci sono davvero.
               */
              if (associo === m.id) {
                sotto.push(
                  <tr key={`${m.id}-ass`}>
                    <td colSpan={5} style={{ background: 'var(--chip)' }}>
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 13 }}>
                          «<b>{m.term}</b>» è un altro modo di dire:
                        </span>
                        <select className="select sm" style={{ minWidth: 260 }} value={rigaScelta} onChange={(e) => setRigaScelta(e.target.value)}>
                          <option value="">— scegli l'alimento —</option>
                          {[...valori].sort((a, b) => a.name.localeCompare(b.name)).map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}{v.state ? ` (${v.state})` : ''}
                            </option>
                          ))}
                        </select>
                        <button className="btn" disabled={!rigaScelta} onClick={() => void associa(m)}>
                          <i className="ti ti-link" /> Associa
                        </button>
                        <button className="btn ghost" onClick={() => setAssocio(null)}>Annulla</button>
                        <span className="muted" style={{ fontSize: 12 }}>
                          Da qui in poi le ricette che scrivono «{m.term}» si contano su quella riga.
                        </span>
                      </div>
                    </td>
                  </tr>,
                );
              }

              /**
               * ⚠️ **DETTAGLIO: gli stessi campi della matita**, non una seconda maschera. Due form
               * per la stessa cosa divergono — una impara un campo nuovo e l'altra no — e chi le usa
               * deve ricordarsi quale ha cosa.
               *
               * ⚠️ Il **nome non si scrive**: è il termine. Se fosse libero, questa schermata
               * diventerebbe un secondo modo di creare alimenti e il termine resterebbe in elenco,
               * scollegato da quello che si è appena scritto.
               */
              if (dettaglio === m.id) {
                sotto.push(
                  <tr key={`${m.id}-det`}>
                    <td colSpan={5} style={{ background: 'var(--chip)' }}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ fontSize: 13, width: '100%' }}>
                          Nuovo alimento: «<b>{m.term}</b>» — il nome è il termine trovato nelle ricette, e non si cambia qui.
                        </div>
                        {[
                          ['kcal', 'kcal'],
                          ['protein', 'Proteine'],
                          ['carbs', 'Carboidrati'],
                          ['sugars', 'Zuccheri'],
                          ['fat', 'Grassi'],
                          ['fiber', 'Fibre'],
                          ['glycemicIndex', 'IG'],
                          ['glycemicIndexMin', 'IG min'],
                          ['glycemicIndexMax', 'IG max'],
                        ].map(([campo, etichetta]) => (
                          <label key={campo} style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {etichetta}
                            <input
                              className="input sm"
                              style={{ width: 84 }}
                              inputMode="decimal"
                              value={nuovo[campo] ?? ''}
                              onChange={(e) => setNuovo((b) => ({ ...b, [campo]: e.target.value }))}
                            />
                          </label>
                        ))}
                        <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          Stato
                          <input
                            className="input sm"
                            style={{ width: 120 }}
                            placeholder="crudo / bollito"
                            list="stati-alimento"
                            title="⚠️ Nelle ricette le grammature sono a CRUDO. Una riga senza stato non si sa come contarla, e una riga solo da cotto il conto la salta. «non si applica» è per olio, sale, miele."
                            value={nuovo.state ?? ''}
                            onChange={(e) => setNuovo((b) => ({ ...b, state: e.target.value }))}
                          />
                        </label>
                        <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          Categoria
                          <input
                            className="input sm"
                            style={{ width: 120 }}
                            value={nuovo.category ?? ''}
                            onChange={(e) => setNuovo((b) => ({ ...b, category: e.target.value }))}
                          />
                        </label>
                        <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          Affidabilità IG
                          <select
                            className="select sm"
                            value={nuovo.glycemicIndexReliability ?? ''}
                            onChange={(e) => setNuovo((b) => ({ ...b, glycemicIndexReliability: e.target.value }))}
                            title="Con «debole» Gaia dice il range e non il numero."
                          >
                            <option value="">—</option>
                            <option value="solida">Solida</option>
                            <option value="media">Media</option>
                            <option value="debole">Debole</option>
                            <option value="non_applicabile">Non si applica (niente carboidrati)</option>
                          </select>
                        </label>
                        <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 160 }}>
                          Fonte
                          <input className="input sm" value={nuovo.source ?? ''} onChange={(e) => setNuovo((b) => ({ ...b, source: e.target.value }))} />
                        </label>
                        <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 220 }}>
                          Nota (la legge Gaia insieme al valore)
                          <input className="input sm" value={nuovo.note ?? ''} onChange={(e) => setNuovo((b) => ({ ...b, note: e.target.value }))} />
                        </label>
                        <div className="row" style={{ gap: 6 }}>
                          <button className="btn" onClick={() => void creaDaMancante(m)}>
                            <i className="ti ti-device-floppy" /> Crea l'alimento
                          </button>
                          <button className="btn ghost" onClick={() => setDettaglio(null)}>Annulla</button>
                        </div>
                      </div>
                    </td>
                  </tr>,
                );
              }
              return sotto;
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const COLONNE: Colonna<Valore>[] = [
    { chiave: 'name', titolo: 'Alimento', valore: (v) => v.name, filtro: 'testo' },
    { chiave: 'category', titolo: 'Categoria', valore: (v) => v.category, filtro: 'scelta', etichettaTutti: 'Tutte' },
    { chiave: 'state', titolo: 'Stato', valore: (v) => v.state, filtro: 'scelta', etichettaTutti: 'Tutti' },
    { chiave: 'ig', titolo: 'Indice glicemico', valore: (v) => v.glycemicIndex },
    {
      chiave: 'affidabilita', titolo: 'Affidabilità',
      valore: (v) => (v.glycemicIndexReliability ? AFFIDABILITA[v.glycemicIndexReliability]?.etichetta ?? v.glycemicIndexReliability : null),
      filtro: 'scelta', etichettaTutti: 'Tutte', ordineScelte: ['Solida', 'Media', 'Debole'],
    },
    { chiave: 'kcal', titolo: 'kcal/100 g', valore: (v) => v.kcal },
    // ⚠️ `esporta` senza `valore`: la colonna resta non ordinabile a schermo (è quattro numeri in
    // uno), ma nel file ci DEVE essere — è il motivo per cui questa tabella si esporta.
    { chiave: 'macro', titolo: 'P / C / G / F', nonOrdinabile: true, esporta: (v) => `${numero(v.protein)} / ${numero(v.carbs)} / ${numero(v.fat)} / ${numero(v.fiber)}` },
    {
      chiave: 'stato', titolo: 'Confermato',
      valore: (v) => (v.verifiedAt ? `Sì — ${v.verifiedBy?.displayName ?? 'staff'}` : 'Da confermare'),
      filtro: 'scelta', etichettaTutti: 'Tutti',
    },
    { chiave: 'azioni', titolo: 'Azioni', stile: { textAlign: 'right' }, nonOrdinabile: true },
  ];

  const t = useTabella(valori, COLONNE, { ordineIniziale: { chiave: 'name' }, testaFissa: true, nomeExcel: 'Valori nutrizionali'});
  const daConfermare = valori.filter((v) => !v.verifiedAt).length;

  if (loading) return <Spinner />;

  return (
    <>
      {/**
        * ⚠️ **UN SUGGERIMENTO, NON UNA REGOLA.** Chi decide cosa vuol dire uno stato è
        * `normalizzaStato` nel backend: questa è solo la tendina che evita di far indovinare le
        * parole a chi compila. Se qui mancasse una voce, scriverla a mano continua a funzionare —
        * ed è di proposito, perché gli stati sono aperti («tostato», «essiccato», «al vapore»).
        *
        * ⚠️ **«non si applica»** è la voce che vale la pena conoscere: all'olio, al sale, al miele
        * lo stato non si applica davvero, e lasciarli vuoti li tiene per sempre in cima all'elenco
        * degli alimenti da correggere, dove nascondono le righe che vanno corrette davvero.
        */}
      <datalist id="stati-alimento">
        <option value="crudo" />
        <option value="secco" />
        <option value="bollito" />
        <option value="cotto" />
        <option value="al vapore" />
        <option value="arrostito" />
        <option value="tostato" />
        <option value="fresco" />
        <option value="liquido" />
        <option value="non si applica" />
      </datalist>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
          Questi sono i valori che <b>Gaia cita</b> alle clienti: non dice nessun numero che non sia
          scritto qui. I dati arrivano dal CREA (valori per 100 g) e dalle tabelle internazionali
          dell'indice glicemico, con la fonte su ogni riga.
          {' '}
          L'<b>affidabilità</b> decide come li dice: con «debole» non dice il numero ma il range,
          perché su alcuni alimenti le fonti non concordano — l'indice glicemico delle patate va da 73
          a 111 secondo la tabella che si guarda.
          {' '}
          Quando correggi un valore, quel valore diventa tuo: <b>nessun aggiornamento del sistema lo
          sovrascrive più</b>.
        </p>
      </div>

      {(daRicette.righe.length > 0 || chieste.righe.length > 0) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Alimenti da correggere</h3>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Quello che il conto non sa contare. Sono <b>due elenchi diversi</b> e restano separati:
            i due numeri non si sommano, perché «usato in mille ricette» e «chiesto tre volte in
            chat» non sono la stessa unità.
          </p>

          <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <button
              className="btn ghost sm"
              onClick={() => void esportaMancanti()}
              disabled={esporto}
              title="Scarica TUTTI gli alimenti da correggere (non solo i primi 100 che vedi qui) con le colonne da riempire: stato, categoria, kcal, macro, indice glicemico, fonte. Le righe che in tabella ci sono già arrivano con i valori che hanno."
            >
              <i className="ti ti-file-type-xls" /> {esporto ? 'Preparo il file…' : 'Esporta in Excel'}
            </button>
            <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>
              Tutti e {daRicette.quanti + chieste.quanti} in un foglio solo, non solo quelli a schermo.
            </span>
          </div>

          {puoModificare && (
            <div style={{ marginBottom: 10 }}>
              {aromi === null ? (
                <button
                  className="btn ghost sm"
                  onClick={() => void guardaAromi()}
                  title="Sale, pepe, acqua, aglio, erbe e spezie: nel conto delle calorie pesano zero e la tabella non li avrà mai tutti. Ti mostro l'elenco prima di togliere."
                >
                  <i className="ti ti-eye" /> Vedi gli aromi da togliere
                </button>
              ) : (
                <div className="card" style={{ padding: 10, background: 'var(--chip)' }}>
                  <b style={{ fontSize: 14 }}>Aromi da togliere: {aromi.length}</b>
                  <p className="muted" style={{ fontSize: 12, margin: '4px 0' }}>
                    Nel conto delle calorie pesano zero, e la tabella non li avrà mai tutti. ⚠️ Restano
                    fuori cipolla, brodo, sedano e carota: hanno una grammatura vera e li guardi tu.
                    Guarda l'elenco prima di confermare — dopo non tornano in lista da soli.
                  </p>
                  <div style={{ maxHeight: 180, overflow: 'auto', fontSize: 13, lineHeight: 1.7 }}>
                    {aromi.map((m) => (
                      <span key={m.id} className="chip" style={{ marginRight: 6 }}>
                        {m.term} <span className="muted">×{m.ricette || m.times}</span>
                      </span>
                    ))}
                    {!aromi.length && <span className="muted">Nessuno: l'elenco è già pulito.</span>}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 8 }}>
                    <button className="btn" disabled={!aromi.length} onClick={() => void togliAromi()}>
                      <i className="ti ti-eraser" /> Togli questi {aromi.length}
                    </button>
                    <button className="btn ghost" onClick={() => setAromi(null)}>Annulla</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {daRicette.righe.length > 0 && (
            <>
              <h4 style={{ fontSize: 14, marginBottom: 4 }}>
                Usati dalle ricette ({daRicette.quanti})
              </h4>
              {tabellaMancanti(daRicette.righe, 'ricette')}
              {daRicette.quanti > daRicette.righe.length && (
                <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
                  Ne vedi {daRicette.righe.length} di {daRicette.quanti} in elenco; l'elenco stesso
                  tiene i più usati — quelli sotto si vedono tutti con <code>npm run diag:crudo-cotto</code>.
                </p>
              )}
            </>
          )}

          {chieste.righe.length > 0 && (
            <>
              <h4 style={{ fontSize: 14, marginBottom: 4, marginTop: 16 }}>
                Chiesti dalle clienti e non trovati ({chieste.quanti})
              </h4>
              <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                Gaia non inventa: quando un alimento non c'è gira la domanda a te e lo scrive qui.
                I più chiesti sono i primi da aggiungere.
              </p>
              {tabellaMancanti(chieste.righe, 'chieste')}
            </>
          )}
        </div>
      )}

      <div className="spread" style={{ marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={soloDaConfermare ? 'btn' : 'btn ghost'}
            onClick={() => setSoloDaConfermare((s) => !s)}
            title="I valori che nessuno ha ancora guardato: Gaia li usa già, ma non li ha confermati nessuno"
          >
            <i className="ti ti-checkup-list" /> Da confermare{daConfermare > 0 ? ` (${daConfermare})` : ''}
          </button>
          <input
            className="input"
            style={{ maxWidth: 240 }}
            placeholder="Cerca un alimento…"
            value={t.ricerca}
            onChange={(e) => t.setRicerca(e.target.value)}
          />
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="alimenti" />
          <BottoneExcel tabella={t} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, ...stileScorrevole(t.conteggio.mostrate) }}>
        {/*
          ⚠️ **Dentro** il riquadro che scorre, non fuori. La prima stesura (21/8) la metteva sopra la
          card per non farla scorrere via — poi `<Pager sopra>` è diventato `sticky` in `ui.tsx`, che
          risolve la stessa cosa in un posto solo e per tutte le tabelle. Una barra fuori sarebbe
          rimasta l'eccezione da spiegare, e senza sfondo né bordo avrebbe anche un altro aspetto.
        */}
        <Pager {...t.pager} sopra />
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">Nessun alimento per questi filtri.</div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((v) => {
                const aff = v.glycemicIndexReliability ? AFFIDABILITA[v.glycemicIndexReliability] : null;
                const range = v.glycemicIndexMin !== null && v.glycemicIndexMax !== null
                  ? `${v.glycemicIndexMin}–${v.glycemicIndexMax}`
                  : null;
                return (
                  <>
                    <tr key={v.id} style={!v.verifiedAt ? { background: 'rgba(255,193,7,0.06)' } : undefined}>
                      <td>
                        <b>{v.name}</b>
                        {v.synonyms.length > 0 && (
                          <div className="muted" style={{ fontSize: 12 }}>anche: {v.synonyms.join(', ')}</div>
                        )}
                      </td>
                      <td>{v.category ?? '—'}</td>
                      <td>{v.state ?? '—'}</td>
                      <td>
                        {v.glycemicIndex !== null ? numero(v.glycemicIndex) : '—'}
                        {range && <span className="muted" style={{ fontSize: 12 }}> ({range})</span>}
                      </td>
                      <td>
                        {aff ? <span className={`chip ${aff.chip}`} title={aff.spiega}>{aff.etichetta}</span> : '—'}
                      </td>
                      <td>{numero(v.kcal)}</td>
                      <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {numero(v.protein)} / {numero(v.carbs)} / {numero(v.fat)} / {numero(v.fiber)}
                      </td>
                      <td>
                        {v.verifiedAt ? (
                          <span title={`Confermato il ${new Date(v.verifiedAt).toLocaleDateString('it-IT')}`}>
                            {v.verifiedBy?.displayName ?? 'staff'}
                          </span>
                        ) : (
                          <span className="chip amber">Da confermare</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {puoModificare && (
                          <>
                            <button className="btn ghost sm" onClick={() => apriModifica(v)} title="Correggi i valori">
                              <i className="ti ti-pencil" />
                            </button>
                            {!v.verifiedAt && (
                              <button className="btn ghost sm" onClick={() => void conferma(v)} title="I valori vanno bene così">
                                <i className="ti ti-check" />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                    {modifico === v.id && (
                      <tr key={`${v.id}-mod`}>
                        <td colSpan={COLONNE.length} style={{ background: 'var(--chip)' }}>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            {[
                              ['glycemicIndex', 'IG'],
                              ['glycemicIndexMin', 'IG min'],
                              ['glycemicIndexMax', 'IG max'],
                              ['kcal', 'kcal'],
                              ['protein', 'Proteine'],
                              ['carbs', 'Carboidrati'],
                              ['fat', 'Grassi'],
                              ['fiber', 'Fibre'],
                            ].map(([campo, etichetta]) => (
                              <label key={campo} style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {etichetta}
                                <input
                                  className="input sm"
                                  style={{ width: 84 }}
                                  inputMode="decimal"
                                  value={bozza[campo] ?? ''}
                                  onChange={(e) => setBozza((b) => ({ ...b, [campo]: e.target.value }))}
                                />
                              </label>
                            ))}
                            <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                              Affidabilità
                              <select
                                className="select sm"
                                value={bozza.glycemicIndexReliability ?? ''}
                                onChange={(e) => setBozza((b) => ({ ...b, glycemicIndexReliability: e.target.value }))}
                                title="Con «debole» Gaia dice il range e non il numero. «Non si applica» = l'alimento un indice glicemico non ce l'ha."
                              >
                                <option value="">—</option>
                                <option value="solida">Solida</option>
                                <option value="media">Media</option>
                                <option value="debole">Debole</option>
                                <option value="non_applicabile">Non si applica (niente carboidrati)</option>
                              </select>
                            </label>
                            <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                              Stato
                              <input
                                className="input sm"
                                style={{ width: 110 }}
                                placeholder="crudo / bollito"
                                list="stati-alimento"
                                title="⚠️ Nelle ricette le grammature sono a CRUDO. «non si applica» è per l'olio, il sale, il miele: crudi o cotti sono la stessa cosa, e dichiararlo li toglie dall'elenco da correggere."
                                value={bozza.state ?? ''}
                                onChange={(e) => setBozza((b) => ({ ...b, state: e.target.value }))}
                              />
                            </label>
                            <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 220 }}>
                              Nota (la legge Gaia insieme al valore)
                              <input
                                className="input sm"
                                value={bozza.note ?? ''}
                                onChange={(e) => setBozza((b) => ({ ...b, note: e.target.value }))}
                              />
                            </label>
                            <div className="row" style={{ gap: 6 }}>
                              <button className="btn" disabled={salvo} onClick={() => void salva(v)}>
                                <i className="ti ti-device-floppy" /> Salva e conferma
                              </button>
                              <button className="btn ghost" disabled={salvo} onClick={() => setModifico(null)}>Annulla</button>
                            </div>
                          </div>
                          {v.glycemicIndexSource && (
                            <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
                              Fonte dell'indice glicemico: {v.glycemicIndexSource}
                              {v.source ? ` · valori per 100 g: ${v.source}` : ''}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Pager {...t.pager} />
    </>
  );
}
