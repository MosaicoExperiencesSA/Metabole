/**
 * IL REPORT MENSILE AL CAPO NUTRIZIONISTA.
 *
 * Nasce da una domanda di Simone dell'11/8 — «secondo te è il caso mensilmente di mandare al
 * nutrizionista capo un report con le regole / modifiche / menu creati dai vari nutrizionisti?» — e
 * dal ruolo che ha dato a Nocanty il 12/8: **non fa visite, sorveglia il lavoro degli altri**. Un
 * sorvegliante senza un foglio da leggere sorveglia quello che gli capita davanti.
 *
 * ## ⚠️ Cosa c'è dentro, e perché non è «quante regole ha scritto ognuna»
 *
 * Un report che conta le regole misura la produttività, e la produttività qui non è il problema:
 * nessuno teme che la nutrizionista detti poco. Le due cose che si vogliono vedere sono
 *
 *  1. **le righe scavalcate** — dove una regola è passata sopra un vincolo sanitario (queste sono
 *     già state notificate subito, `avvisa-capo.ts`: qui tornano perché a fine mese si leggono
 *     insieme, ed è insieme che si vede se è un caso o un'abitudine);
 *  2. **quanto viene annullato** — la percentuale di righe annullate è l'unico numero che dice se
 *     l'assistente sta traducendo male. Se sale, ha smesso di capire: è il guasto che non produce
 *     nessun errore rosso e per cui esiste tutto il registro.
 *
 * E in coda le frasi che non ha capito: sono il lavoro del mese dopo, non una lamentela.
 *
 * ## ⚠️ È una LETTURA, non una tabella
 *
 * Nessun `report_mensile` salvato. Un report congelato è una fotografia che comincia a mentire il
 * giorno dopo — una riga annullata a settembre resta «attiva» nel report di agosto per sempre — e
 * chi lo legge non ha modo di accorgersene. Ricalcolarlo costa qualche query al mese.
 */

export interface RigaReport {
  id: string;
  nutrizionistaId: string;
  frase: string;
  azione: string;
  ambito: string;
  stato: string;
  conflittoSanitario: boolean;
  soggettoNome: string | null;
  createdAt: Date;
}

export interface FraseNonCapita {
  frase: string;
  quante: number;
}

export interface VoceNutrizionista {
  nutrizionistaId: string;
  nome: string;
  scritte: number;
  annullate: number;
  inApprovazione: number;
  respinte: number;
  conflitti: number;
  /** Percentuale intera di righe annullate sul totale scritto. La salute della traduzione. */
  percentualeAnnullate: number;
}

export interface ReportMensile {
  periodo: string;
  dal: Date;
  al: Date;
  totali: {
    scritte: number;
    annullate: number;
    inApprovazione: number;
    respinte: number;
    conflitti: number;
    nonCapite: number;
    percentualeAnnullate: number;
  };
  perNutrizionista: VoceNutrizionista[];
  conflitti: RigaReport[];
  nonCapite: FraseNonCapita[];
  testo: string;
}

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/**
 * L'intervallo del mese, in UTC.
 *
 * ⚠️ UTC e non l'ora locale del processo: il server gira su Render in UTC e il portatile di chi
 * sviluppa no, e un report che cambia contenuto a seconda di dove lo si calcola è un report di cui
 * non ci si fida. Le due ore di scarto spostano al massimo una riga scritta a mezzanotte.
 */
export function intervalloMese(anno: number, mese: number): { dal: Date; al: Date } {
  return { dal: new Date(Date.UTC(anno, mese - 1, 1)), al: new Date(Date.UTC(anno, mese, 1)) };
}

export function nomeMese(anno: number, mese: number): string {
  return `${MESI[mese - 1] ?? mese} ${anno}`;
}

const percentuale = (parte: number, tutto: number) => (tutto ? Math.round((parte / tutto) * 100) : 0);

const ETICHETTA_AZIONE: Record<string, string> = {
  restrizione_cliente: 'restrizioni su una cliente',
  sostituzione_cliente: 'sostituzioni su una cliente',
  variante_cliente: 'varianti di piano',
  ricetta_modificata: 'ricette modificate',
  ricetta_nuova: 'ricette nuove',
  regola_dieta: 'regole su un tipo di dieta',
  voce_dizionario: 'parole nuove nel dizionario',
};

/**
 * Compone il report. Pura: prende le righe del mese e restituisce i numeri **e** il testo.
 *
 * Il testo esce da qui e non dal servizio perché è la parte che si vuole poter leggere in un test
 * senza una banca dati: se la frase «3 regole annullate su 4» viene fuori sbagliata, si vede qui.
 */
export function componiReport(
  righe: RigaReport[],
  nonCapite: FraseNonCapita[],
  nomi: Map<string, string>,
  anno: number,
  mese: number,
): ReportMensile {
  const { dal, al } = intervalloMese(anno, mese);
  const annullate = righe.filter((r) => r.stato === 'annullata');
  const inApprovazione = righe.filter((r) => r.stato === 'in_approvazione');
  const respinte = righe.filter((r) => r.stato === 'respinta');
  const conflitti = righe.filter((r) => r.conflittoSanitario);

  const per = new Map<string, VoceNutrizionista>();
  for (const r of righe) {
    const v = per.get(r.nutrizionistaId) ?? {
      nutrizionistaId: r.nutrizionistaId,
      nome: nomi.get(r.nutrizionistaId) ?? r.nutrizionistaId.slice(0, 8),
      scritte: 0,
      annullate: 0,
      inApprovazione: 0,
      respinte: 0,
      conflitti: 0,
      percentualeAnnullate: 0,
    };
    v.scritte += 1;
    if (r.stato === 'annullata') v.annullate += 1;
    if (r.stato === 'in_approvazione') v.inApprovazione += 1;
    if (r.stato === 'respinta') v.respinte += 1;
    if (r.conflittoSanitario) v.conflitti += 1;
    per.set(r.nutrizionistaId, v);
  }
  const perNutrizionista = [...per.values()]
    .map((v) => ({ ...v, percentualeAnnullate: percentuale(v.annullate, v.scritte) }))
    // ⚠️ In cima chi ha più conflitti, non chi ha scritto di più: l'ordine di un elenco è una
    // dichiarazione di cosa conta, e qui conta quello che va guardato.
    .sort((a, b) => b.conflitti - a.conflitti || b.scritte - a.scritte);

  const totali = {
    scritte: righe.length,
    annullate: annullate.length,
    inApprovazione: inApprovazione.length,
    respinte: respinte.length,
    conflitti: conflitti.length,
    nonCapite: nonCapite.reduce((s, f) => s + f.quante, 0),
    percentualeAnnullate: percentuale(annullate.length, righe.length),
  };

  return {
    periodo: `${anno}-${String(mese).padStart(2, '0')}`,
    dal,
    al,
    totali,
    perNutrizionista,
    conflitti,
    nonCapite,
    testo: scriviTesto(anno, mese, totali, perNutrizionista, conflitti, nonCapite, righe),
  };
}

function scriviTesto(
  anno: number,
  mese: number,
  totali: ReportMensile['totali'],
  perNutrizionista: VoceNutrizionista[],
  conflitti: RigaReport[],
  nonCapite: FraseNonCapita[],
  righe: RigaReport[],
): string {
  const r: string[] = [`# Assistente — ${nomeMese(anno, mese)}`, ''];

  if (!righe.length && !nonCapite.length) {
    // ⚠️ Un mese vuoto si dice, non si nasconde. Un report che non arriva è indistinguibile da un
    // report che non è stato generato, e la seconda cosa è un guasto.
    r.push('Nessuna regola dettata all’assistente in questo mese, e nessuna frase rimasta incompresa.');
    return r.join('\n');
  }

  r.push(
    `**${totali.scritte}** regole dettate all’assistente. ` +
      `${totali.annullate} annullate (${totali.percentualeAnnullate}%), ` +
      `${totali.inApprovazione} ancora da approvare, ${totali.respinte} respinte.`,
    '',
  );

  if (totali.conflitti) {
    r.push(
      `## ⚠️ ${totali.conflitti} confermate sopra un vincolo sanitario`,
      '',
      'Ognuna è già stata notificata il giorno stesso. Qui stanno insieme perché insieme si vede se è un caso o un’abitudine.',
      '',
    );
    for (const c of conflitti.slice(0, 20)) {
      r.push(`- ${c.soggettoNome ?? 'cliente'} — «${c.frase.slice(0, 120)}»`);
    }
    r.push('');
  }

  const tipi = new Map<string, number>();
  for (const x of righe) tipi.set(x.azione, (tipi.get(x.azione) ?? 0) + 1);
  if (tipi.size) {
    r.push('## Cosa è stato scritto', '');
    for (const [azione, quante] of [...tipi.entries()].sort((a, b) => b[1] - a[1])) {
      r.push(`- ${quante} ${ETICHETTA_AZIONE[azione] ?? azione}`);
    }
    r.push('');
  }

  if (perNutrizionista.length > 1) {
    r.push('## Per nutrizionista', '');
    for (const v of perNutrizionista) {
      r.push(
        `- **${v.nome}**: ${v.scritte} regole, ${v.annullate} annullate (${v.percentualeAnnullate}%)` +
          (v.conflitti ? `, ⚠️ ${v.conflitti} sopra un vincolo sanitario` : ''),
      );
    }
    r.push('');
  }

  if (nonCapite.length) {
    r.push(
      `## ${totali.nonCapite} frasi che l’assistente non ha capito`,
      '',
      'Non è una lamentela: è l’elenco delle parole da insegnargli il mese prossimo.',
      '',
    );
    for (const f of nonCapite.slice(0, 15)) {
      r.push(`- «${f.frase.slice(0, 120)}»${f.quante > 1 ? ` — ${f.quante} volte` : ''}`);
    }
    r.push('');
  }

  if (totali.percentualeAnnullate >= 20) {
    // ⚠️ La soglia è scritta qui e non lasciata all'occhio di chi legge: il 20% di righe annullate
    // vuol dire che una regola su cinque è stata tradotta in un modo che poi è stato disfatto, e
    // quello non è un dettaglio da notare leggendo una tabella.
    r.push(
      '---',
      '',
      `⚠️ **Una regola su ${Math.max(2, Math.round(100 / Math.max(totali.percentualeAnnullate, 1)))} è stata annullata.** ` +
        'Vale la pena rileggere le frasi da cui sono nate: quando questa percentuale sale, di solito ' +
        'l’assistente ha smesso di capire qualcosa che prima capiva.',
    );
  }

  return r.join('\n');
}
