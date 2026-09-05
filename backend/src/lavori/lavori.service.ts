import { Injectable, NotFoundException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { eViolazioneUnicita } from '../common/violazione-unicita';
import { PrismaService } from '../prisma/prisma.service';
import { DatiLavoro, datiRisposta, datiSpunta, normalizzaLavoro, ordinaLavori, testoPerClaude } from './lavoro';
import { VOCI_INIZIALI } from './voci-iniziali';

/**
 * L'ELENCO DEI LAVORI — «cosa manca», in un posto solo.
 *
 * Richiesta di Simone (13/8). ⚠️ Non è un doppione di `progetto/REGISTRO.md`: quello racconta **cosa
 * è stato scritto**, per sempre e riga per riga; questo risponde a **cosa manca**, e la spunta ci
 * aggiunge quando è stato chiuso e da chi.
 */

@Injectable()
export class LavoriService {
  private readonly logger = new Logger(LavoriService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * L'elenco intero, in un colpo solo: sono decine di righe, non migliaia, e paginarle vorrebbe dire
   * nascondere metà di quello che manca dietro un pulsante «avanti».
   *
   * ⚠️ **Da fare in cima, fatte in fondo.** Le fatte non spariscono — è la parte «così è tutto
   * registrato» della richiesta — ma non devono nemmeno stare in mezzo, o l'elenco smette di
   * rispondere a «cosa resta» a colpo d'occhio. Fra le fatte, le ultime chiuse per prime.
   */
  async elenco() {
    const righe = await this.prisma.lavoro.findMany({
      orderBy: [{ fatto: 'asc' }, { categoria: 'asc' }, { ordine: 'asc' }, { createdAt: 'asc' }],
      include: { fattoDa: { select: { displayName: true } }, rispostaDa: { select: { displayName: true } } },
    });
    const daFare = righe.filter((r) => !r.fatto).length;
    return {
      righe: ordinaLavori(righe),
      totale: righe.length,
      daFare,
      fatte: righe.length - daFare,
    };
  }

  /**
   * ⚠️ Una voce scritta a mano dalla pagina **nasce adesso**, e la data si scrive subito.
   *
   * Per queste `createdAt` sarebbe già la risposta giusta — ma allora la pagina avrebbe due sorgenti
   * per la stessa riga di testo, e il giorno che una delle due cambia significato lo scopriremmo
   * leggendo una data sbagliata. Una domanda, una risposta: `nataIl`.
   */
  async crea(dati: DatiLavoro) {
    const campi = normalizzaLavoro(dati, true);
    campi.nataIl = new Date();
    return this.prisma.lavoro.create({
      data: campi as { titolo: string },
      include: { fattoDa: { select: { displayName: true } }, rispostaDa: { select: { displayName: true } } },
    });
  }

  async aggiorna(id: string, dati: DatiLavoro) {
    const campi = normalizzaLavoro(dati, false);
    await this.esiste(id);
    /**
     * ⚠️ CHI CORREGGE IL TESTO DALLA PAGINA SE LO TIENE (18/8, voce 275). Da quando il caricamento
     * riscrive il testo delle voci che vengono dal file, questa riga è ciò che impedisce a una
     * correzione fatta a mano di sparire al rilascio dopo — senza che chi l'ha scritta lo sappia.
     *
     * ⚠️ Solo se cambia davvero **titolo o dettaglio**: salvare la categoria o l'ordine non è
     * scrivere un testo, e marcare anche quello congelerebbe la voce per sempre al primo
     * spostamento.
     */
    const testoToccato =
      (campi as { titolo?: unknown }).titolo !== undefined ||
      (campi as { dettaglio?: unknown }).dettaglio !== undefined;
    return this.prisma.lavoro.update({
      where: { id },
      data: { ...campi, ...(testoToccato ? { testoAMano: true } : {}) },
      include: { fattoDa: { select: { displayName: true } }, rispostaDa: { select: { displayName: true } } },
    });
  }

  /**
   * La risposta: quello che si è saputo su questa voce.
   *
   * ⚠️ Non spunta niente. «L'ho saputo» e «l'ho fatto» sono due stati diversi: farli coincidere
   * toglierebbe dall'elenco proprio le voci che hanno appena ricevuto quello che serviva per
   * lavorarci.
   */
  async rispondi(id: string, testo: unknown, actorUserId: string) {
    await this.esiste(id);
    const staff = await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } });
    return this.prisma.lavoro.update({
      where: { id },
      data: datiRisposta(testo, staff?.id, new Date()),
      include: { fattoDa: { select: { displayName: true } }, rispostaDa: { select: { displayName: true } } },
    });
  }

  /** Il testo del pulsante «Copia per Claude»: solo le voci aperte, con le risposte date. */
  async testo() {
    const righe = await this.prisma.lavoro.findMany({
      orderBy: [{ fatto: 'asc' }, { categoria: 'asc' }, { ordine: 'asc' }, { createdAt: 'asc' }],
      include: { rispostaDa: { select: { displayName: true } } },
    });
    return { testo: testoPerClaude(righe) };
  }

  /**
   * IL CARICAMENTO DALLA PAGINA — «Carica le voci nuove».
   *
   * Fa quello che faceva solo la shell, con le stesse due regole:
   *
   * ⚠️ **Prima si guarda, poi si scrive.** `conferma: false` (il primo clic) non tocca niente e
   * dice cosa aggiungerebbe. Sulla shell quella sicurezza ce l'ha `CONFERMA=1`; un pulsante che
   * scrive al primo clic la butterebbe via proprio dove è più facile premere per sbaglio.
   *
   * ⚠️ **Cosa aggiorna, e cosa no** — la riga «non aggiorna mai quello che trova» stava qui fino al
   * 27/8 ed era **falsa dal 18/8**: venti righe più sotto questa funzione spunta, riscrive titolo e
   * dettaglio, e scrive la data di nascita. Un cappello che smentisce il corpo è peggio di nessun
   * cappello, perché chi legge si ferma al cappello. L'elenco vero:
   *  · **spunta** una voce che il file dichiara finita — mai il contrario;
   *  · **riscrive** titolo e dettaglio, ma non dove li ha corretti una persona (`testoAMano`);
   *  · **scrive `nataIl`** solo se manca;
   *  · **non tocca** categoria, ordine e priorità: quelle le mette Simone dalla pagina, e le
   *    divergenze si **dicono** (`categorieDiverse`) invece di correggerle.
   * È la lezione di `accendi-automazioni.ts`, che pensato per accenderne tre ne ha spente venti:
   * quello che uno script tocca va scritto per esteso, o cresce senza che nessuno se ne accorga.
   *
   * ⚠️ Lo storico (le 481 righe dal REGISTRO) NON passa da qui: sta in un file accanto allo script,
   * che in `dist/` non c'è. Resta un lavoro da shell, ed è già stato fatto una volta sola.
   */
  async caricaVociIniziali(conferma: boolean) {
    const chiavi = VOCI_INIZIALI.map((v) => v.chiave);
    const righe = (await this.prisma.lavoro.findMany({
      where: { chiave: { in: chiavi } },
      select: { id: true, chiave: true, fatto: true, titolo: true, dettaglio: true, testoAMano: true, nataIl: true, fattoDalFile: true, categoria: true } as never,
    })) as { id: string; chiave: string | null; fatto: boolean; titolo: string; dettaglio: string | null; testoAMano: boolean; nataIl: Date | null; fattoDalFile: boolean; categoria: string }[];
    const perChiave = new Map(righe.map((r) => [r.chiave, r]));

    /**
     * ⚠️ `soloSeEsiste` NON si crea mai. Sono le righe che il file usa per **chiudere** un doppione
     * rimasto in pagina (voce 224): crearle vorrebbe dire scrivere spazzatura nuova per pulire
     * quella vecchia. Se in pagina non ci sono, per il caricamento non esistono.
     */
    const mancanti = VOCI_INIZIALI.filter((v) => !perChiave.has(v.chiave) && v.soloSeEsiste !== true);
    /**
     * L'AGGIORNAMENTO DELLO STATO (richiesta di Simone, 13/8 sera): il file può CHIUDERE una voce
     * ancora aperta in pagina — è la notizia «questa consegna l'ha finita» — ma MAI riaprirne una
     * spuntata: la pagina resta lo stato vivo, e una spunta messa a mano non si discute da un file.
     */
    /**
     * ⚠️ Si tiene la VOCE accanto alla riga, non solo la riga. Il chiamante deve poter dire **cosa**
     * spunterebbe con le parole che si leggono in pagina: una lista di chiavi (`vera-menu-dettati`)
     * non è una cosa su cui si preme «Conferma» a cuor leggero.
     */
    const daSpuntare: { voce: (typeof VOCI_INIZIALI)[number]; riga: { id: string; chiave: string | null; fatto: boolean } }[] = [];
    const riaperteAMano: string[] = [];
    for (const v of VOCI_INIZIALI) {
      if (v.fatta !== true) continue;
      const riga = perChiave.get(v.chiave);
      if (!riga || riga.fatto) continue;
      /**
       * ⛔ **UNA VOCE RIAPERTA A MANO NON SI RICHIUDE DA SOLA — anche qui** (27/8, in revisione).
       *
       * Questa protezione esisteva dal 20/8 **solo sul percorso per titolo**, che riguarda sette
       * voci su centottantaquattro: `fattoDalFile` aveva una sola lettura in tutto il backend, e la
       * query di questo percorso non lo caricava nemmeno. Quindi il patto scritto in testa allo
       * script — «la pagina è lo stato vivo, una spunta messa a mano non si discute da un file» —
       * era rispettato sul ramo piccolo e violato su quello grande.
       *
       * ⚠️ Lo scenario, ed è vicino: il file chiude `whatsapp-numero` («al momento non serve»); a
       * settembre Simone la riapre dalla pagina perché il numero serve; **al deploy dopo — di
       * qualunque consegna, anche una che non c'entra niente — si richiudeva da sola**, con la data
       * del rilascio, e compariva fra le «chiuse», cioè fra le cose andate bene. Togliere una spunta
       * è l'unico modo che ha di contraddirmi: se si disfa da solo, non è più un modo.
       */
      if (riga.fattoDalFile) { riaperteAMano.push(v.titolo); continue; }
      daSpuntare.push({ voce: v, riga });
    }

    /**
     * ⚠️ **LE VOCI SCRITTE A MANO IN PAGINA SI POSSONO CHIUDERE — PER TITOLO** (19/8 sera, richiesta
     * di Simone: «la lista è piena, aggiorna le cose fatte»).
     *
     * Una voce scritta dal backoffice ha `chiave: null`: il file non la vede, quindi **nessuna
     * consegna la può spuntare**, nemmeno quando il lavoro è finito. Oggi è costato tre indagini —
     * «Schermate app 30 e 27-28», «Vera: rifare i giorni futuri», «Moduli fissi in dashboard»: tutte
     * e tre erano già fatte, e per scoprirlo ho dovuto rileggere il codice una per una.
     *
     * ⚠️ **Solo per chiudere, e solo con `soloSeEsiste`.** Non crea niente, non riapre niente, non
     * riscrive testi: se in pagina quel titolo non c'è, per il caricamento non esiste. È lo stesso
     * patto del `chiave`, applicato all'unica cosa che identifica una riga scritta a mano.
     *
     * ⛔ **E solo se il titolo combacia con UNA riga sola.** Due voci intitolate uguale sarebbero
     * due lavori diversi, e spuntarne una a caso è esattamente il genere di errore silenzioso che
     * questo progetto passa le giornate a togliere. Se sono due, non si tocca niente.
     */
    const titoliNonTrovati: string[] = [];
    const titoliAmbigui: string[] = [];
    const titoliGiaChiusi: string[] = [];
    const perTitolo = VOCI_INIZIALI.filter((v) => v.soloSeEsiste && v.fatta === true && v.titolo);
    if (perTitolo.length) {
      /**
       * ⛔ **NON PIÙ SOLO `chiave: null`, E NON PIÙ SOLO `fatto: false`** — 27/8, dopo che
       * l'allineamento ha dichiarato «non trovate» sei voci di fila.
       *
       * ⚠️ **Il caso vero: la riga ORFANA.** `chiave` è la colonna su cui il caricamento decide se
       * una voce esiste già, ed è capitato che uno script la scrivesse **storpiata** (è documentato
       * nella voce del seed: un pezzo di testo finito dentro la chiave). Una riga così non la trova
       * più nessuno: il percorso per chiave non la riconosce, e il percorso per titolo la escludeva
       * perché la sua chiave non è `null`. **Resta aperta per sempre**, e nessuna consegna la può
       * chiudere. Adesso le righe con una chiave che il file **non conosce** sono orfane, e per le
       * orfane vale il titolo — mentre una riga con una chiave del file resta di chi la possiede,
       * il percorso per chiave, che è più preciso di un titolo.
       *
       * ⚠️ **E `fatto: true` si guarda invece di nasconderlo.** Prima una riga già spuntata usciva
       * dalla query e finiva in «non trovata»: cioè lo strumento gridava al lupo proprio dove aveva
       * funzionato. Adesso si dice «era già chiusa», che è un'informazione diversa e utile — è la
       * stessa ragione per cui «non trovata» e «ambigua» erano state separate il 20/8.
       */
      const chiaviDelFile = new Set(VOCI_INIZIALI.map((v) => v.chiave));
      const candidate = (await this.prisma.lavoro.findMany({
        where: { titolo: { in: perTitolo.map((v) => v.titolo) } } as never,
        select: { id: true, chiave: true, fatto: true, titolo: true, fattoDalFile: true } as never,
      })) as { id: string; chiave: string | null; fatto: boolean; titolo: string; fattoDalFile: boolean }[];
      const aMano = candidate.filter((r) => !r.chiave || !chiaviDelFile.has(r.chiave));
      for (const v of perTitolo) {
        /**
         * ⚠️ Il confronto è **esatto**, e non c'è un `trim()` a rattoppare: la riga arriva da un
         * `titolo: { in: [...] }`, che in SQL è già un confronto esatto — uno spazio in coda non
         * torna mai dal database, quindi un `trim()` qui sarebbe un ramo che non si può raggiungere,
         * cioè una rete che sembra esserci e non c'è. Un titolo che non combacia si **dice**
         * (`titoliNonTrovati`), che è l'unica rete vera.
         */
        const combacianti = aMano.filter((r) => r.titolo === v.titolo);
        /**
         * ⚠️ **NON TROVATA E AMBIGUA SONO DUE COSE DIVERSE, E TUTT'E DUE VANNO DETTE** — revisione
         * avversariale del 20/8. Prima finivano nello stesso `continue`, e **da nessuna parte**: né
         * nel valore di ritorno né nell'output dello script.
         *
         * ⛔ Il confronto è per stringa esatta: basta un `–` al posto di `-`, uno spazio in più, o un
         * titolo troncato, e non combacia. Il risultato è identico a «era già chiusa» — cioè lo
         * strumento nato per evitare tre indagini su lavori già fatti tacerebbe **esattamente** nel
         * caso in cui non sta funzionando. Uno strumento che dice solo quello che è riuscito a fare
         * racconta sempre una giornata perfetta.
         */
        if (!combacianti.length) { titoliNonTrovati.push(v.titolo); continue; }
        /**
         * ⚠️ **Le righe già chiuse non sono un problema, ma vanno tolte dal conto.** Se di quel
         * titolo l'unica riga rimasta aperta non c'è, il lavoro è fatto: si dice e si passa oltre.
         * Le si conta prima dell'ambiguità, perché due righe di cui una già chiusa non sono due
         * lavori diversi — sono un lavoro e la sua storia.
         *
         * ⛔ **Ma «già chiusa» è un'inferenza, e si dice solo quando è fondata** (27/8, in
         * revisione). Fra i candidati adesso ci sono anche le 481 righe dello **storico** caricate
         * dal REGISTRO, che nascono già spuntate: se una di quelle avesse per caso lo stesso titolo,
         * dire «era già chiusa» vorrebbe dire dichiarare fatto un lavoro **guardando un'altra riga**
         * — cioè la malattia che questo elenco esiste per curare, con le parole rassicuranti.
         * Perciò si accettano come «la stessa voce» solo le righe che il file **ha chiuso lui**
         * (`fattoDalFile`) o che sono state scritte a mano in pagina (`chiave` nulla). Tutto il
         * resto torna «non trovata», che è la risposta prudente e vera.
         */
        const aperte = combacianti.filter((r) => !r.fatto);
        if (!aperte.length) {
          const nostre = combacianti.filter((r) => r.fattoDalFile || !r.chiave);
          if (nostre.length) titoliGiaChiusi.push(v.titolo);
          else titoliNonTrovati.push(v.titolo);
          continue;
        }
        if (aperte.length > 1) { titoliAmbigui.push(v.titolo); continue; }
        /**
         * ⚠️ **UNA VOCE RIAPERTA A MANO NON SI RICHIUDE DA SOLA** — revisione avversariale del 20/8,
         * ed era il difetto peggiore di questa funzione.
         *
         * La query cerca `fatto: false`, quindi una riga **riaperta** ricombaciava al deploy dopo e
         * si riprendeva la spunta, con `fattoIl` all'ora del rilascio. ⛔ Il patto scritto in testa
         * allo script — «la pagina è lo stato vivo, una spunta messa a mano non si discute da un
         * file» — valeva sulle spunte messe e **non su quelle tolte**: cioè su un gesto di Simone
         * che dice «questo lavoro non è finito», che è l'unico modo che ha di contraddirmi.
         *
         * ⚠️ E c'è il seguito: i titoli sono generici («Moduli fissi in dashboard»). Senza questo
         * controllo, **qualunque** voce riscritta con quello stesso titolo per il seguito del lavoro
         * nascerebbe già spuntata al primo deploy.
         *
         * Adesso una riga che è già stata chiusa una volta da un rilascio non si tocca più: se è
         * aperta, qualcuno l'ha riaperta apposta. E si dice, invece di tacere.
         */
        const riga = aperte[0];
        if (riga.fattoDalFile) { riaperteAMano.push(v.titolo); continue; }
        daSpuntare.push({ voce: v, riga });
      }
    }

    /**
     * ⚠️ IL TESTO DI UNA VOCE GIÀ IN PAGINA NON VIENE RISCRITTO — e va DETTO.
     *
     * Questo caricamento fa due cose: crea le voci mancanti e spunta quelle che il file dichiara
     * finite. Il **testo** no: se nel file un titolo o un dettaglio cambiano — succede di continuo,
     * perché una voce si riscrive quando si scopre la causa vera — in pagina resta la versione
     * vecchia, e nessuno lo dice. Chi legge la pagina crede di leggere l'ultima parola.
     *
     * Riscriverli in automatico non si può fare a cuor leggero: la pagina è **lo stato vivo** e una
     * voce può essere stata corretta a mano dal backoffice, che è una scelta di prodotto (voce 274).
     * Nel frattempo la differenza si **mostra**: un elenco che dice quali voci in pagina hanno un
     * testo più vecchio di quello del rilascio. Meglio saperlo che crederle aggiornate.
     */
    /**
     * ⚠️ IL TESTO ORA SI RISCRIVE — ma solo dove non l'ha scritto una persona (18/8, voce 275).
     *
     * Prima non si riscriveva mai, e la pagina restava alla versione del primo caricamento: una
     * voce corretta nel file — succede a ogni giro, perché una voce si riscrive quando si scopre la
     * causa vera — in pagina raccontava ancora la ricostruzione sbagliata, e chi la leggeva credeva
     * di leggere l'ultima parola. Il caso che l'ha deciso: la bonifica delle email del 18/8 ha
     * ripulito il file, e in pagina l'indirizzo di una cliente è rimasto lì.
     *
     * ⚠️ Le voci con `testoAMano` NON si toccano, e si dicono a parte. Una correzione fatta dal
     * backoffice che sparisce al rilascio dopo, in silenzio, sarebbe lo stesso difetto spostato di
     * un metro.
     */
    const daRiscrivere: { id: string; titolo: string; dettaglio: string | null; categoria: string }[] = [];
    const testiCambiati: { titolo: string; categoria: string }[] = [];
    for (const v of VOCI_INIZIALI) {
      const riga = perChiave.get(v.chiave);
      if (!riga) continue;
      // Le righe di chiusura dei doppioni non sono voci di lavoro: il loro testo non interessa a nessuno.
      if (v.soloSeEsiste) continue;
      const diverso = riga.titolo !== v.titolo || (riga.dettaglio ?? '') !== (v.dettaglio ?? '');
      if (!diverso) continue;
      if (riga.testoAMano) testiCambiati.push({ titolo: v.titolo, categoria: v.categoria });
      else daRiscrivere.push({ id: riga.id, titolo: v.titolo, dettaglio: v.dettaglio ?? null, categoria: v.categoria });
    }

    /**
     * ⚠️ LA DATA DI NASCITA SI PUÒ AGGIUNGERE A UNA VOCE GIÀ IN ELENCO — la priorità NO.
     *
     * Sono due campi nuovi (19/8) e si comportano in modo opposto di proposito. `nataIl` è un
     * **fatto** che il file ha scoperto dopo: le voci già in pagina non ce l'hanno, e riempirla
     * quando è vuota è l'unico modo di dare a Simone quello che ha chiesto senza rifare l'elenco.
     * ⚠️ Ma solo **quando è vuota**: sovrascriverla vorrebbe dire che una data in pagina può
     * cambiare da sola, e una data che cambia non è più una data.
     *
     * La priorità invece è un **giudizio**, e lo dà lui dalla pagina. Un file che gliela riscrive a
     * ogni rilascio gli toglierebbe di mano l'unica leva che ha chiesto — in silenzio, che è la
     * parte peggiore. Perciò vale solo alla nascita della voce.
     */
    /**
     * ⚠️ **LA DIVERGENZA SI DICE** (19/8, dalla voce `lista-lavori-file-e-pagina`).
     *
     * Il file può solo *chiudere* una voce, mai riaprirla: quando qualcosa si chiude fuori da una
     * consegna — Simone lancia uno script, una decisione arriva in chat — la pagina lo sa e il file
     * no. E chi legge il file (io, in ogni sessione nuova) crede di leggere l'elenco vero: il 19/8
     * gli ho ripresentato come aperte la tabella IG e la conta allergie, già lanciate da lui.
     *
     * Qui non si **corregge** niente — quale delle due versioni vinca è una decisione di prodotto,
     * non di software, ed è ancora aperta. Si **mostra**, che è la stessa scelta già fatta per i
     * testi cambiati: meglio saperlo che crederle allineate.
     */
    /**
     * ⚠️ **LA CATEGORIA NON SI SCRIVE, SI DICE** (27/8). Il file può riclassificare una voce — è
     * successo lo stesso giorno a due di loro: una sospesa in attesa del rifacimento del catalogo,
     * una che ha smesso di aspettare una persona — ma `daRiscrivere` tocca solo titolo e dettaglio,
     * di proposito: categoria e ordine li mette Simone dalla pagina, ed è l'unica leva che ha per
     * organizzarsi il lavoro.
     *
     * ⛔ Il risultato però era una voce col titolo nuovo — «⏸ Sospesa, aspetta il paniere» — dentro
     * la colonna **«Aspetta Simone»**: cioè una riga che dichiara di aspettare una risposta che lui
     * ha già dato. Adesso la divergenza si mostra, come già si fa per i testi corretti a mano e per
     * le voci che il file crede aperte: **si sposta con un clic, ma bisogna saperlo.**
     */
    const categorieDiverse: { titolo: string; inPagina: string; nelFile: string }[] = [];
    for (const v of VOCI_INIZIALI) {
      if (v.soloSeEsiste) continue;
      const riga = perChiave.get(v.chiave);
      if (!riga || riga.fatto) continue;
      if (riga.categoria && riga.categoria !== v.categoria) {
        categorieDiverse.push({ titolo: v.titolo, inPagina: riga.categoria, nelFile: v.categoria });
      }
    }

    const fileIndietro = VOCI_INIZIALI.filter((v) => {
      if (v.fatta === true || v.soloSeEsiste) return false;
      const riga = perChiave.get(v.chiave);
      return !!riga && riga.fatto;
    }).map((v) => ({ chiave: v.chiave, titolo: v.titolo }));

    /**
     * ⚠️ E l'altra direzione: le voci scritte **a mano dalla pagina** (`chiave: null`) che nel file
     * non esistono e non esisteranno mai. Non ricevono la data di nascita né le riscritture del
     * rilascio, e chi legge il file non sa nemmeno che ci sono — sono tre, oggi, e due sono in
     * priorità alta. Si conta e si dice: non c'è niente da correggere, c'è da saperlo.
     */
    /**
     * ⚠️ **Lo stesso criterio del filtro delle orfane, e non un secondo** (27/8, in revisione). Qui
     * si contava `chiave: null`, cioè «scritta a mano dalla pagina» — ma dal 27/8 il codice ha una
     * seconda definizione di «riga che il file non vede»: anche quella con una **chiave che il file
     * non conosce**, che è esattamente il caso da cui questa correzione è nata. Due punti nella
     * stessa funzione che rispondevano alla stessa domanda in due modi, e il numero stampato era
     * sistematicamente più basso del vero.
     */
    const soloInPagina = await this.prisma.lavoro.count({
      where: { fatto: false, OR: [{ chiave: null }, { chiave: { notIn: chiavi } }] } as never,
    });

    const daDatare: { id: string; nataIl: Date }[] = [];
    for (const v of VOCI_INIZIALI) {
      if (!v.nata) continue;
      const riga = perChiave.get(v.chiave);
      if (!riga || riga.nataIl) continue;
      const d = new Date(v.nata);
      // ⚠️ Una data che non si legge non si scrive: meglio «non lo so» che un 1970 in pagina.
      if (Number.isNaN(d.getTime())) continue;
      daDatare.push({ id: riga.id, nataIl: d });
    }

    if (conferma) {
      for (const v of mancanti) {
        // `fatta`, `nata` e `priorita` sono campi del FILE: due si traducono in colonne, uno nella spunta.
        const { fatta, soloSeEsiste: _soloSeEsiste, nata, priorita, ...campi } = v;
        const nataIl = nata && !Number.isNaN(new Date(nata).getTime()) ? new Date(nata) : null;
        const dati = { ...campi, ...(nataIl ? { nataIl } : {}), ...(priorita ? { priorita } : {}) };
        try {
          await this.prisma.lavoro.create({
            data: fatta ? { ...dati, ...datiSpunta(true, null, new Date()) } : dati,
          });
        } catch (e) {
          /**
           * ⚠️ **UNA VOCE GIÀ CREATA DA QUALCUN ALTRO NON DEVE FAR SALTARE LE SPUNTE** — 20/8.
           *
           * Da ieri questo caricamento gira **da solo** a ogni deploy, e il passaggio da pulsante ad
           * automatismo cambia cosa vuol dire un errore: davanti al pulsante c'era una persona che
           * lo leggeva e rilanciava. Qui no.
           *
           * `chiave` è `@unique`, e due deploy ravvicinati sono un caso **già visto e documentato**
           * in `render.yaml` (il retry sul lock delle migrazioni nasce da lì). Se il secondo giro
           * incontra una voce che il primo ha appena creato, senza questo `catch` l'eccezione
           * abortiva **tutto l'allineamento** — comprese le spunte, che vengono dopo. ⛔ Cioè il caso
           * più innocuo possibile («c'era già») produceva il danno che questo script esiste per
           * evitare: una lista che non dice la verità.
           *
           * ⚠️ Solo la violazione di unicità si ingoia. Un errore diverso è un guasto, e un guasto
           * che si ingoia diventa un automatismo che non fa niente e dice che è andato tutto bene.
           */
          if (!eViolazioneUnicita(e)) throw e;
          this.logger.warn(`Lavori: «${v.titolo}» c'era già (creata da un altro giro): vado avanti.`);
        }
      }
      for (const d of daDatare) {
        await this.prisma.lavoro.update({ where: { id: d.id }, data: { nataIl: d.nataIl } });
      }
      for (const { riga } of daSpuntare) {
        /**
         * ⚠️ `fattoDalFile` non si azzera mai: da qui in poi, se questa riga la si trova aperta,
         * vuol dire che l'ha riaperta una persona — e allora non si tocca più.
         */
        await this.prisma.lavoro.update({
          where: { id: riga.id },
          data: { ...datiSpunta(true, null, new Date()), fattoDalFile: true } as never,
        });
      }
      for (const r of daRiscrivere) {
        // ⚠️ Solo titolo e dettaglio: `categoria` e `ordine` restano dove qualcuno li ha messi in
        // pagina. Riscriverli qui sposterebbe le voci sotto gli occhi di chi le sta guardando, e
        // non è quello che si chiede a un pulsante che dice «aggiorna dal rilascio».
        await this.prisma.lavoro.update({ where: { id: r.id }, data: { titolo: r.titolo, dettaglio: r.dettaglio } });
      }
    }
    return {
      scritto: conferma,
      aggiunte: mancanti.length,
      spuntate: daSpuntare.length,
      saltate: VOCI_INIZIALI.length - mancanti.length - daSpuntare.length,
      /**
       * ⚠️ **`fatta` viaggia con la voce** (5/9): una voce nuova che il rilascio dà per finita nasce
       * già spuntata (vedi `datiSpunta` qui sopra), ma in pagina si leggeva solo la categoria — cioè
       * «Da fare — codice» su una cosa appena consegnata. La categoria dice dove va, la spunta dice
       * se è da fare: chi preme «Conferma» deve vedere tutte e due.
       */
      titoli: mancanti.map((v) => ({ titolo: v.titolo, categoria: v.categoria, fatta: v.fatta === true })),
      // Titoli e non chiavi: è quello che la pagina mostra prima di far premere «Conferma».
      chiuse: daSpuntare.map(({ voce }) => ({ titolo: voce.titolo, categoria: voce.categoria })),
      /** Voci il cui testo è stato **riscritto** dal file (nessuno le aveva corrette a mano). */
      riscritte: daRiscrivere.map((r) => ({ titolo: r.titolo, categoria: r.categoria })),
      /** ⚠️ Voci a cui il rilascio ha **aggiunto** la data di nascita che mancava (mai riscritta). */
      datate: daDatare.length,
      /**
       * ⚠️ Voci che **il file crede aperte e la pagina ha già chiuso**: il file è indietro. Non si
       * tocca niente — si dice, perché è l'errore che il 19/8 mi ha fatto ripresentare come da fare
       * due cose già fatte.
       */
      fileIndietro,
      /** ⚠️ Quante voci vivono **solo in pagina** (scritte a mano): il file non le vedrà mai. */
      soloInPagina,
      /** ⚠️ I titoli che il file voleva chiudere e non ha chiuso: il silenzio qui era il difetto. */
      titoliNonTrovati,
      titoliAmbigui,
      riaperteAMano,
      categorieDiverse,
      titoliGiaChiusi,
      /**
       * ⚠️ Voci il cui testo nel file è cambiato ma che qualcuno ha corretto **a mano** dalla
       * pagina: NON vengono riscritte, e si dicono — perché il file ha qualcosa di nuovo da
       * raccontare su di loro e chi le legge deve sapere che le due versioni sono diverse.
       */
      testiCambiati,
    };
  }

  /**
   * La spunta.
   *
   * ⚠️ **Togliendola si azzerano anche chi e quando.** Una voce riaperta che continua a dire «fatta
   * da Simone il 13 agosto» è una riga che fa perdere fiducia in tutta la lista — e una lista di cui
   * non ci si fida non si guarda più, che è l'unico modo in cui questa pagina può fallire.
   */
  async segna(id: string, fatto: boolean, actorUserId: string) {
    await this.esiste(id);
    const staff = fatto
      ? await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } })
      : null;
    return this.prisma.lavoro.update({
      where: { id },
      data: datiSpunta(fatto, staff?.id, new Date()),
      include: { fattoDa: { select: { displayName: true } }, rispostaDa: { select: { displayName: true } } },
    });
  }

  /**
   * Si cancella solo quello che è stato scritto per sbaglio. ⚠️ Chiudere un lavoro è **spuntarlo**,
   * non cancellarlo: se il modo di togliere una riga dall'elenco fosse `Elimina`, dopo un mese la
   * pagina non saprebbe più dire cosa è stato fatto — cioè metà del motivo per cui esiste.
   */
  async elimina(id: string) {
    await this.esiste(id);
    await this.prisma.lavoro.delete({ where: { id } });
    return { ok: true };
  }

  private async esiste(id: string) {
    const r = await this.prisma.lavoro.findUnique({ where: { id }, select: { id: true } });
    if (!r) throw new NotFoundException('Questa voce non esiste più: qualcuno l\'ha eliminata.');
    return r;
  }
}
