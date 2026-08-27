/**
 * COSA SUCCEDE QUANDO IL CAPO APPROVA — l'unico punto in cui una proposta diventa vera.
 *
 * Una riga «in approvazione» nasce quando la nutrizionista risponde «a tutte» alla domanda
 * sull'ambito: da lì in poi **non è stato scritto niente**, e la riga è una richiesta. Qui c'è cosa
 * comporta dire di sì.
 *
 * ## ⚠️ Approvare scrive su molte persone in una volta
 *
 * È l'unica azione di tutto il progetto che tocca più di una cliente per volta, ed è il motivo per
 * cui esiste la coda. Tre precauzioni, tutte per lo stesso motivo:
 *
 *  - si scrive **solo sulle clienti di chi ha proposto** (`perimetroClienti` sull'autore, non su chi
 *    approva): «a tutte» detto da una nutrizionista vuol dire «a tutte le mie», e il capo che
 *    approva ne vede molte di più;
 *  - è **idempotente**: chi ha già quell'alimento fra i non graditi non viene toccato, così
 *    riapprovare non raddoppia niente e il conteggio resta vero;
 *  - si **conta e si racconta** quante ne sono state toccate. Un'azione che scrive su ottanta
 *    profili e risponde «fatto» è un'azione di cui nessuno saprà mai la portata.
 */
import { Logger } from '@nestjs/common';
import { combaciaAlimento } from '../common/nomi-alimento';
import { spezzaTagAlimenti } from '../common/tag-alimenti';
import { perimetroClienti } from '../common/perimetro-clienti';
import { registraSostituzione } from '../food-swaps/registra-sostituzione';
import type { PrismaService } from '../prisma/prisma.service';
import { CAMPI_DEL_GIORNO, type GiornoDaValutare, clientiColpiti, codePerCliente, daQuandoSiPuoRifare, giorniColpitiDaiVietati } from './menu-da-rifare';
import { type ClienteScoperta, RULE_CODE_ESCLUSIONI, clientiScoperte, ricetteVietate, terminiVietati } from './regola-dieta';
import { RicettaDelPool } from './pool-disponibile';
import { aGiorno } from '../common/date-only';

const logger = new Logger('VeraApplicaProposta');

/** ⚠️ Oltre questo numero di clienti non si scrive: si dice quante sarebbero e si chiede a mano. */
const MAX_CLIENTI_IN_UNA_VOLTA = 200;

export interface Proposta {
  id: string;
  nutrizionistaId: string;
  azione: string;
  ambito: string;
  soggettoId: string | null;
  soggettoNome: string | null;
  dettaglio: unknown;
}

export interface EsitoApplicazione {
  riepilogo: string;
  /**
   * Quante clienti sono state toccate davvero.
   *
   * ⚠️ **Per la regola di dieta vuol dire «a quante ho rifatto i menu»**, e può essere `0` mentre la
   * regola è stata scritta e vale da subito su tutte le clienti di quella dieta (sopra il tetto, o
   * quando sono tutte bloccate). Il riepilogo lo dice a parole; questo campo conta i calendari
   * toccati, che è l'unica cosa reversibile e quindi l'unica che serva ricostruire dall'audit.
   */
  toccate: number;
  /**
   * Chi resterebbe SENZA UN PASTO e per cui il divieto di dieta non vale (voce
   * `vera-regola-dieta-scoperte`). Solo per `regola_dieta`; si persiste nel dettaglio della riga,
   * così l'elenco non scorre via con la chat.
   */
  scoperte?: ClienteScoperta[];
  /**
   * La ricetta appena approvata su cui **mancano gli allergeni confermati** (voce 227).
   *
   * ⚠️ Non è un dettaglio di comodo: `collegaRicetta` si rifiuta di mettere in una giornata una
   * ricetta con `allergensReviewed: false`, quindi senza questa domanda la ricetta approvata resta
   * invisibile e il capo lo scopre dal fatto che non compare da nessuna parte.
   */
  allergeniDaConfermare?: string;
}

/**
 * Applica una proposta approvata.
 *
 * Ritorna sempre un riepilogo leggibile: è quello che il capo si vede scritto in chat e che finisce
 * nel registro, ed è l'unico modo che ha di sapere cosa ha appena fatto.
 */
export async function applicaProposta(prisma: PrismaService, p: Proposta): Promise<EsitoApplicazione> {
  const dettaglio = (p.dettaglio ?? {}) as { termini?: string[]; intento?: { tipo?: string; from?: string; to?: string } };

  if (p.azione === 'restrizione_cliente') {
    return applicaRestrizione(prisma, p, dettaglio.termini ?? []);
  }

  if (p.azione === 'sostituzione_cliente') {
    /**
     * ⚠️ Una sostituzione estesa NON diventa un gruppo di equivalenza da qui.
     *
     * Portare «X si può fare con Y» dentro il motore per tutte è già un gesto che esiste, si chiama
     * «promuovi a regola» e sta nella tabella delle sostituzioni (§16.9). Rifarlo qui vorrebbe dire
     * una seconda strada per creare gruppi, con la sua logica, che prima o poi deciderà in modo
     * diverso dalla prima. Quindi: si scrive la riga per la cliente, già validata, e la promozione
     * la fa una persona da dove si è sempre fatta.
     */
    const i = dettaglio.intento ?? {};
    if (p.soggettoId && i.from && i.to) {
      await registraSostituzione(prisma, {
        clientId: p.soggettoId,
        tipo: 'ingrediente',
        from: i.from,
        to: i.to,
        recipeId: null,
        origine: 'manuale',
        stato: 'verificata',
        nota: 'Approvata dal capo nutrizionista su proposta dell’assistente.',
        creataDaId: p.nutrizionistaId,
      });
    }
    return {
      toccate: p.soggettoId ? 1 : 0,
      riepilogo:
        `Ho scritto la sostituzione per ${p.soggettoNome ?? 'la cliente'}, già validata. ` +
        'Per farla valere per tutte c’è «promuovi a regola» nella tabella delle sostituzioni: ' +
        'il gruppo nasce comunque in bozza, e quello è il posto dove si è sempre fatto.',
    };
  }

  if (p.azione === 'regola_dieta') {
    return applicaRegolaDieta(prisma, p, dettaglio.termini ?? []);
  }

  return { toccate: 0, riepilogo: 'Approvata. Nessun effetto automatico per questo tipo di azione.' };
}

/**
 * IL DIVIETO SU UNA DIETA — «nella mediterranea non deve comparire più il tonno».
 *
 * ⚠️ Scrive **una riga sola** in `ProductRule` per dieta (unique su `[dietId, ruleCode]`), unendo i
 * termini a quelli già vietati: due approvazioni della stessa cosa non fanno due regole, e nessuna
 * cancella l'altra. È lo stesso motivo per cui la restrizione su una cliente è idempotente.
 *
 * ⚠️ Da qui in avanti il piatto non compare più nei menu **nuovi**: il pool non lo propone e la
 * guardia dell'erogazione lo fermerebbe comunque. E i **giorni già generati e non ancora aperti**
 * si rifanno **qui dentro, subito** — decisione di Simone del 13/8: vedi il blocco più sotto, dopo
 * la scrittura della regola.
 *
 * ⚠️ **QUESTO COMMENTO DICEVA IL CONTRARIO FINO AL 19/8 SERA**, e vale la pena tenerne memoria.
 * Diceva che i giorni si sarebbero rifatti «in un secondo momento» e rimandava a una voce di elenco
 * lavori — `vera-regola-dieta-rifai-menu` — **che non è mai esistita**. Venti righe più sotto il
 * codice li rifaceva già, dal 18/8. ⛔ Un commento che descrive un lavoro come da fare, quando è
 * fatto, non è impreciso: è **una trappola**. Chi legge il file per capire se la voce è aperta legge
 * il commento, non le settanta righe sotto — e la reimplementa. Ci sono andato vicino io stesso,
 * cercando proprio quella voce.
 *
 * ⚠️ *Il codice non mente mai, i commenti sì*: per questo qui i commenti dicono **perché**, e quando
 * dicono **cosa** vanno riletti insieme al codice che descrivono, non dopo.
 */
async function applicaRegolaDieta(prisma: PrismaService, p: Proposta, termini: string[]): Promise<EsitoApplicazione> {
  const puliti = [...new Set(termini.map((t) => (t ?? '').trim().toLowerCase()).filter(Boolean))];
  const dietId = p.soggettoId;
  if (!puliti.length || !dietId) {
    return { toccate: 0, riepilogo: 'Non ho capito su quale dieta e su quale alimento: non ho scritto niente.' };
  }

  const esistente = (await prisma.productRule.findFirst({
    where: { dietId, ruleCode: RULE_CODE_ESCLUSIONI },
    select: { id: true, params: true, enabled: true },
  })) as { id: string; params: unknown; enabled: boolean } | null;

  const gia = terminiVietati([{ ruleCode: RULE_CODE_ESCLUSIONI, enabled: true, params: esistente?.params }]);
  const nuovi = puliti.filter((t) => !gia.includes(t));
  if (esistente && !nuovi.length && esistente.enabled) {
    return { toccate: 0, riepilogo: `Su ${p.soggettoNome ?? 'questa dieta'} il divieto c'era già: non ho riscritto niente.` };
  }
  const tutti = [...gia, ...nuovi];

  if (esistente) {
    await prisma.productRule.update({ where: { id: esistente.id }, data: { enabled: true, params: { termini: tutti } as never } });
  } else {
    await prisma.productRule.create({ data: { dietId, ruleCode: RULE_CODE_ESCLUSIONI, enabled: true, params: { termini: tutti } as never } as never });
  }

  /**
   * ⚠️ I MENU GIÀ PREPARATI — decisione di Simone (13/8): si rifanno **solo i giorni futuri non
   * ancora aperti**, e solo quelli che contengono davvero il piatto vietato.
   *
   * «Rifare» qui vuol dire **cancellare** quei giorni: la consegna li ricompone al giro successivo,
   * con la regola nuova già in vigore. ⚠️ Non si chiama il motore da dentro l'approvazione — questo
   * file prende `prisma` e basta, di proposito: legarlo al modulo dei menu vorrebbe dire che un
   * problema lì dentro può far fallire un'approvazione, e che i test di Vera smettono di girare da
   * soli.
   *
   * ⚠️ Sopra il tetto di clienti **la regola resta**, il rifacimento no (decisione di Simone): il
   * divieto sui menu nuovi costa zero ed è il motivo per cui la regola esiste; è il rifacimento che
   * è pesante. E si dice quante persone sono rimaste indietro, invece di far finta di niente.
   */
  /**
   * ⚠️ **Il catalogo si legge UNA volta** (24/8): `scopertePerDieta` lo rileggeva per conto suo, e
   * fra le due letture c'era la cancellazione dei menu — cioè due giri completi sul catalogo per
   * ogni approvazione, e una finestra più larga in cui i giorni potevano cambiare sotto i piedi.
   */
  const catalogo = ((await prisma.recipe.findMany({ select: { id: true, name: true, ingredients: true } })) ?? []) as {
    id: string; name: string; ingredients: unknown;
  }[];
  const ricetteFuori = ricetteVietate(catalogo, tutti);
  const oggi = new Date();
  const dal = daQuandoSiPuoRifare(oggi);
  /**
   * ⛔ **QUI NON SI FILTRA PIÙ SU «SI PUÒ RIFARE»** (26/8, voce `visto-non-vuol-dire-aperto`).
   *
   * La query aveva dentro `CHE_SI_POSSONO_RIFARE`, e il giorno del rilascio avrebbe reso **zero
   * righe** per tutte: nessun giorno è ancora «tracciato». Il capo avrebbe letto «fra i menu già
   * preparati non ce n'era nessuno con quel piatto» — la frase falsa che questa modifica esiste per
   * togliere, identica, il primo giorno. I colpiti sono i giorni che **contengono** il piatto; se
   * poi si possano cancellare lo decide `codePerCliente` sul calendario intero, e sa dire anche
   * «non lo so».
   */
  const colpiti = giorniColpitiDaiVietati(
    ((await prisma.menuDay.findMany({
      where: { dietId, date: { gte: dal } } as never,
      select: CAMPI_DEL_GIORNO as never,
    })) ?? []) as GiornoDaValutare[],
    ricetteFuori,
    oggi,
  );
  const persone = clientiColpiti(colpiti);
  const troppe = persone.length > MAX_CLIENTI_IN_UNA_VOLTA;

  /**
   * L'ELENCO DELLE SCOPERTE (decisione di Simone, 13/8; voce `vera-regola-dieta-scoperte`).
   *
   * L'erogazione non svuota mai uno slot: per chi resterebbe a zero il divieto si salta e lei resta
   * com'era. Finché quell'elenco non arriva al capo, la regola *sembra* applicata a tutte — quindi
   * si calcola QUI, nel momento in cui lui approva, e finisce nel messaggio che sta leggendo.
   *
   * ⛔ **E si calcola PRIMA della cancellazione** (24/8, trovato in revisione). `scopertePerDieta`
   * costruisce la coorte da chi ha **menu in calendario da oggi in poi**: cancellando prima, le
   * clienti a cui si è appena portata via tutta la coda **sparivano dall'elenco**. E sono proprio
   * quelle giuste — chi ha più giorni colpiti è chi mangia più spesso il piatto vietato, cioè chi ha
   * più probabilità di restare senza un pasto. Il capo leggeva «fatto, 3 giornate rifatte» e non
   * sapeva che per Anna il divieto era stato saltato; il motore ricomponeva le stesse tre giornate
   * **col piatto vietato dentro**, e nessuno l'avrebbe più guardata. Il messaggio si contraddiceva
   * da solo, in silenzio.
   *
   * ⚠️ Se il conto si rompe non si finge un elenco vuoto: si scrive nei log e si DICE («non lo so»
   * ≠ «nessuno»). La regola vale comunque: perdere la scrittura per un conteggio non partito
   * sarebbe il guasto peggiore.
   */
  let scoperte: ClienteScoperta[] = [];
  let contoScoperteRotto = false;
  try {
    scoperte = await scopertePerDieta(prisma, dietId, ricetteFuori, catalogo);
  } catch (err) {
    contoScoperteRotto = true;
    logger.warn(`Scoperte non calcolate (dieta=${dietId}): ${err instanceof Error ? err.message : String(err)}`);
  }

  /**
   * ⛔ **SI CANCELLA UNA CODA, E LA CODA SI GUARDA SU TUTTO IL CALENDARIO DI OGNUNA.**
   *
   * Difetto in produzione **dal 13/8**, chiuso il 24/8. Qui si cancellavano i giorni che contengono
   * il piatto vietato, **sparsi**: chi aveva più avanti una giornata senza quel piatto se la ritrovava
   * come ultima in calendario, e i giorni cancellati prima di lei **non tornavano mai** — «menu in
   * preparazione», per sempre, su un giorno solo. Il perché sta in `codaDaRifare`.
   *
   * ⚠️ E la query qui sopra, che cerca i colpiti, **non basta a calcolare la coda**: filtra per
   * `dietId`, quindi non vede i giorni rimasti da una dieta precedente — cioè proprio le righe che
   * possono restare in fondo e riaprire il buco. Si rileggono i calendari **interi** delle sole
   * clienti colpite: sono poche, ed è una query in più contro una giornata senza cena.
   */
  const calendari = troppe || !colpiti.length
    ? []
    : (((await prisma.menuDay.findMany({
        where: { clientId: { in: persone }, date: { gte: dal } } as never,
        select: CAMPI_DEL_GIORNO as never,
      })) ?? []) as GiornoDaValutare[]);
  /**
   * ⚠️ Il predicato è «questo giorno è fra i colpiti che ho appena trovato»: gli id arrivano dalla
   * query filtrata, la coda si calcola sul **calendario intero**. Sono due letture diverse della
   * stessa riga, ed è l'id a tenerle insieme.
   */
  const idColpiti = new Set(colpiti.map((g) => g.id));
  const { daCancellare, bloccate, nonSapute, lasciatiIndietro } = codePerCliente(calendari, (g: GiornoDaValutare) => idColpiti.has(g.id));
  /** Chi ha avuto i menu rifatti **davvero**: non chi era colpita, non chi è rimasta bloccata. */
  const rifatte = clientiColpiti(daCancellare);
  if (daCancellare.length) {
    await prisma.menuDay.deleteMany({ where: { id: { in: daCancellare.map((g) => g.id) } } });
  }

  /**
   * ⚠️ **Le bloccate si dicono per nome-numero, non si tacciono.** Sono clienti per cui la regola
   * vale sui menu nuovi ma i giorni già in calendario restano col piatto vietato dentro: se non
   * compaiono qui, nessuno le guarderà mai — e il messaggio direbbe «fatto» anche per loro.
   */
  const codaBloccate = bloccate.length
    ? ` ⚠️ ${bloccate.length} ${bloccate.length === 1 ? 'cliente ha già aperto in app' : 'clienti hanno già aperto in app'} ` +
      `un menu più avanti: per ${bloccate.length === 1 ? 'lei' : 'loro'} i giorni già preparati li ho lasciati ` +
      'come sono (rifarli lascerebbe un buco che non si richiude). Si rifanno con «Rigenera menu» dalla scheda, ' +
      'che però rifà anche il giorno che ha già aperto.'
    : '';

  /**
   * ⛔ **LE «NON SAPUTE» SONO UN ELENCO A PARTE, e dirle bloccate sarebbe una bugia** (26/8).
   *
   * Di queste clienti non sappiamo se hanno aperto quei giorni: l'app che avevano quando il menu è
   * stato composto non lo diceva. Scriverle insieme alle bloccate direbbe al capo «il menu le è già
   * arrivato» — un fatto, su una persona di cui non abbiamo nessun fatto. ⚠️ Il giorno del rilascio
   * sono **tutte**: è la frase che racconta il periodo di passaggio.
   *
   * ⚠️ E il passaggio **non finisce quando l'app si aggiorna**: `apertureDal` si scrive alla prima
   * chiamata del segnale, ma le giornate già in calendario in quel momento sono nate `false` e
   * restano così — l'erogazione ne compone di nuove solo quando la corsa davanti scende sotto
   * `GIORNATE_DAVANTI_CHE_BASTANO`. Per ogni cliente il «non lo so» dura ancora quanto il suo
   * cuscinetto di giorni, **dopo** l'aggiornamento.
   */
  const codaNonSapute = nonSapute.length
    ? ` ⚠️ Di ${nonSapute.length} ${nonSapute.length === 1 ? 'cliente' : 'clienti'} non so dire se ` +
      `${nonSapute.length === 1 ? 'ha' : 'hanno'} già aperto i giorni preparati (app non ancora aggiornata): ` +
      'nel dubbio li ho lasciati come sono. Si rifanno con «Rigenera menu» dalla scheda.'
    : '';

  const coda =
    (!colpiti.length
      /**
       * ⛔ **E ADESSO QUESTA FRASE È UN'AFFERMAZIONE VERA SUI MENU** (26/8). Il 24/8 l'avevo dovuta
       * indebolire in «fra quelli che posso ancora rifare», perché i colpiti erano già filtrati su
       * «mai aperto» e — con `getMenu` che marcava tutto alla prima apertura — questo era **il ramo
       * che scattava quasi sempre**: il capo leggeva «non ce n'erano» mentre il tonno era nel pranzo
       * di domani. Adesso i colpiti sono i giorni che **contengono** il piatto, e se sono zero il
       * piatto non c'è. Chi non si può toccare lo raccontano `codaBloccate` e `codaNonSapute`.
       */
      ? ' Nessun menu già preparato da oggi in poi conteneva quel piatto: non ho toccato niente.'
      : troppe
        ? ` ⚠️ I menu già preparati riguarderebbero ${persone.length} clienti, oltre il tetto di ` +
          `${MAX_CLIENTI_IN_UNA_VOLTA}: la regola vale lo stesso da adesso, ma quei giorni li ho lasciati come sono. ` +
          // ⚠️ «Almeno»: per ognuna si rifà dal primo giorno colpito **in avanti**, quindi le giornate
          // toccate sono sempre di più di quelle che contengono davvero il piatto. Dire il numero
          // secco farebbe sottostimare la portata proprio a chi deve decidere se procedere a mano.
          `Sarebbero almeno ${colpiti.length} giornate.`
        : daCancellare.length
          /**
           * ⛔ **NON SI NOMINA UN INSIEME PIÙ PICCOLO DI QUELLO CHE RESTA.** Il 24/8 qui c'era «quelle
           * già passate», che era falso — il giorno che resta col piatto vietato dentro può benissimo
           * essere **domani**. Poi «quelle già arrivate in app», che dal 26/8 è falso a sua volta: le
           * giornate che restano sono quelle **già aperte** *oppure* quelle di cui **non sappiamo**, e
           * dare per fatto il primo caso su una cliente del secondo è inventare un fatto. Adesso la
           * frase dice quante ne restano e non pretende di sapere perché.
           */
          ? ` Ho rifatto ${daCancellare.length} ${daCancellare.length === 1 ? 'giornata' : 'giornate'} ` +
            `(${rifatte.length} ${rifatte.length === 1 ? 'cliente' : 'clienti'}).` +
            (lasciatiIndietro
              ? ` ⚠️ Altre ${lasciatiIndietro} ${lasciatiIndietro === 1 ? 'giornata col piatto vietato resta' : 'giornate col piatto vietato restano'} ` +
                'come ' + (lasciatiIndietro === 1 ? 'è' : 'sono') + ': o le hanno già aperte, o non so dirlo.'
              : '')
          : bloccate.length || nonSapute.length
            // ⚠️ Sono tutte bloccate o non sapute: la ragione la dicono `codaBloccate` e
            // `codaNonSapute` qui sotto, e ripeterla con altre parole vorrebbe dire darne due — di
            // cui una inventata.
            ? ''
            : ' ⚠️ Non ho potuto rifare nessuna giornata: quelle colpite non ci sono più (le avrà rifatte ' +
              'qualcos\'altro nel frattempo). La regola vale lo stesso da adesso.') + codaBloccate + codaNonSapute;

  const MAX_NOMI = 10;
  const elenco = scoperte
    .slice(0, MAX_NOMI)
    .map((s) => `${s.nome ?? s.userId.slice(0, 8)} (${s.pasti.join(', ')})`)
    .join('; ');
  const codaScoperte = contoScoperteRotto
    ? ' ⚠️ Non sono riuscito a calcolare chi resterebbe scoperta: la regola vale, ma l\'elenco va guardato a mano.'
    : scoperte.length
      ? ` ⚠️ ${scoperte.length} ${scoperte.length === 1 ? 'cliente resterebbe senza un pasto e per lei' : 'clienti resterebbero senza un pasto e per loro'} ` +
        `il divieto NON vale: ${elenco}${scoperte.length > MAX_NOMI ? `; e altre ${scoperte.length - MAX_NOMI}` : ''}. ` +
        'Restano com\'erano: vanno sistemate a mano (o con un\'alternativa in catalogo).'
      : '';

  return {
    /**
     * ⚠️ **Chi è stata toccata DAVVERO** (24/8): qui c'era `persone.length`, che conta anche le
     * bloccate — per cui non si è fatto niente — e, sopra il tetto, tutte le duecento e passa clienti
     * di un'azione che non ha toccato un solo giorno. Finisce nell'audit, cioè nell'unico posto in
     * cui fra un mese si ricostruisce cosa è successo.
     */
    toccate: rifatte.length,
    riepilogo:
      `Fatto: su ${p.soggettoNome ?? 'questa dieta'} ${nuovi.length > 1 ? 'i piatti con' : 'il piatto con'} ` +
      `${nuovi.join(', ')} non entreranno più nei menu nuovi.` + coda + codaScoperte,
    ...(scoperte.length ? { scoperte } : {}),
  };
}

/**
 * Chi, fra le clienti CON MENU IN CALENDARIO su questa dieta (da oggi in poi), resterebbe senza un
 * pasto. ⚠️ È un'approssimazione dichiarata: chi non ha ancora giorni generati non compare — ma per
 * lei il pool filtrato scatterà alla prima generazione, con la stessa regola del «non svuotare».
 *
 * Il pool si legge dai `DietDayTemplate` di livello 1 come fa `PoolDisponibileService.poolPerSlot`
 * (il livello 2 non esiste: 315 diete a livello 1), e le ricette **arrivano già lette dal
 * chiamante** — cosa che la docstring diceva da sempre e il codice non faceva: rileggeva l'intero
 * catalogo per conto suo (corretto il 24/8, seconda revisione).
 */
async function scopertePerDieta(
  prisma: PrismaService,
  dietId: string,
  vietate: ReadonlySet<string>,
  ricette: readonly { id: string; name: string; ingredients: unknown }[],
): Promise<ClienteScoperta[]> {
  if (!vietate.size) return [];
  const templates = ((await prisma.dietDayTemplate.findMany({
    where: { dietId, level: 1 } as never,
    select: { meals: true },
  })) ?? []) as { meals: unknown }[];
  if (!templates.length) return [];

  const perId = new Map(ricette.map((r) => [r.id, r]));
  const slotPool = new Map<string, RicettaDelPool[]>();
  for (const t of templates) {
    for (const m of ((t.meals as { slot?: string; recipeId?: string }[]) ?? [])) {
      if (!m?.slot || !m?.recipeId) continue;
      const r = perId.get(m.recipeId);
      if (!r) continue;
      if (!slotPool.has(m.slot)) slotPool.set(m.slot, []);
      const lista = slotPool.get(m.slot)!;
      if (!lista.some((x) => x.id === r.id)) lista.push(r);
    }
  }
  if (!slotPool.size) return [];

  // Il giorno di Roma: chi ha giornate da oggi in avanti su questa dieta. Con il giorno UTC, per
  // due ore la coorte comprendeva anche chi ha solo la giornata di ieri.
  const oggi = aGiorno(new Date());
  const coorte = ((await prisma.menuDay.findMany({
    where: { dietId, date: { gte: oggi } } as never,
    select: { clientId: true },
    distinct: ['clientId'] as never,
  })) ?? []) as { clientId: string }[];
  if (!coorte.length) return [];

  const profili = ((await prisma.clientProfile.findMany({
    where: { userId: { in: coorte.map((c) => c.clientId) } } as never,
    select: { userId: true, name: true, allergies: true, intolerances: true, dislikedFoods: true },
  })) ?? []) as { userId: string; name: string | null; allergies: string[]; intolerances: string[]; dislikedFoods: string[] }[];

  return clientiScoperte(
    slotPool,
    vietate,
    profili.map((p) => ({
      userId: p.userId,
      nome: p.name,
      esclusioni: [...(p.allergies ?? []), ...(p.intolerances ?? []), ...(p.dislikedFoods ?? [])],
    })),
  );
}

async function applicaRestrizione(prisma: PrismaService, p: Proposta, termini: string[]): Promise<EsitoApplicazione> {
  /**
   * ⚠️ **VERA VINCE SEMPRE SU GAIA** (Simone, 18/8): niente `filtraSpezie` qui — chi detta è la
   * professionista che firma le diete. Ma `spezzaTagAlimenti` sì: «pepe, ceci» scritto in una riga
   * sola non esclude più niente, e qui il danno si moltiplica per tutti i clienti della coorte.
   */
  const puliti = spezzaTagAlimenti(termini.map((t) => (t ?? '').trim()).filter(Boolean));
  if (!puliti.length) return { toccate: 0, riepilogo: 'Non c’era nessun alimento da vietare: non ho scritto niente.' };

  // ⚠️ Il perimetro è quello di CHI HA PROPOSTO, non di chi approva.
  const perimetro = await perimetroClienti(prisma, p.nutrizionistaId);
  const profili = (await prisma.clientProfile.findMany({
    where: (perimetro ? { [perimetro.field]: { in: perimetro.staffIds } } : {}) as never,
    select: { userId: true, dislikedFoods: true },
  })) as { userId: string; dislikedFoods: string[] }[];

  if (profili.length > MAX_CLIENTI_IN_UNA_VOLTA) {
    return {
      toccate: 0,
      riepilogo:
        `Questa regola toccherebbe ${profili.length} clienti in una volta, che è oltre il tetto di ` +
        `${MAX_CLIENTI_IN_UNA_VOLTA}. Non ho scritto niente: una modifica di questa portata va fatta ` +
        'sapendo esattamente su chi ricade.',
    };
  }

  let toccate = 0;
  for (const profilo of profili) {
    const attuali = profilo.dislikedFoods ?? [];
    const nuovi = puliti.filter((t) => !attuali.some((a) => combaciaAlimento(a, t)));
    if (!nuovi.length) continue; // già a posto: non si tocca, e non si conta
    await prisma.clientProfile.update({
      where: { userId: profilo.userId },
      data: { dislikedFoods: [...attuali, ...nuovi] } as never,
    });
    toccate += 1;
  }

  return {
    toccate,
    riepilogo:
      toccate === 0
        ? `Erano già tutte a posto: nessuna delle ${profili.length} clienti aveva bisogno della modifica.`
        : `Applicata a ${toccate} client${toccate === 1 ? 'e' : 'i'} su ${profili.length}: ` +
          `da adesso non vedranno più ${puliti.join(', ')}.`,
  };
}

/**
 * L'ordine con cui la coda si sottopone: **per rischio, non per data**.
 *
 * Una coda cronologica fa arrivare per ultima la cosa più importante, e chi la guarda di fretta
 * legge le prime tre. Quindi: prima le regole confermate sopra un vincolo sanitario (poche, e ognuna
 * va letta), poi quelle a raggio largo, poi il resto — e a parità, la più vecchia, che è quella che
 * sta aspettando da più tempo.
 */
export function ordinaPerRischio<T extends { conflittoSanitario: boolean; ambito: string; createdAt: Date }>(righe: T[]): T[] {
  const peso = (r: T) => (r.conflittoSanitario ? 0 : r.ambito === 'catalogo' ? 1 : 2);
  return righe.slice().sort((a, b) => peso(a) - peso(b) || a.createdAt.getTime() - b.createdAt.getTime());
}
