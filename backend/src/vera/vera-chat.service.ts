/**
 * VERA CHE PARLA — il giro completo, dalla frase alla riga scritta.
 *
 * L'ordine non è negoziabile, ed è tutto il progetto in cinque righe:
 *
 *   1. **capisco** (deterministico, `capisci.ts`) — se non capisco lo dico;
 *   2. **chiedo** quello che non so: quale cliente, cosa vuol dire quella famiglia;
 *   3. **mostro** la regola tradotta e cosa comporta sul pool;
 *   4. **aspetto il sì**;
 *   5. **scrivo**, e lascio la riga nel registro con l'annulla.
 *
 * ⚠️ Non esiste una scorciatoia che salti il 3 e il 4. Nemmeno per le frasi facili, nemmeno per la
 * ventesima volta: il giorno in cui una scrittura passa senza anteprima è il giorno in cui il
 * registro smette di raccontare cosa è successo davvero.
 */
import { Injectable } from '@nestjs/common';
import { chiaveAlimento, combaciaAlimento } from '../common/nomi-alimento';
import { perimetroClienti } from '../common/perimetro-clienti';
import { registraSostituzione } from '../food-swaps/registra-sostituzione';
import { expandExclusion } from '../menu/exclusions';
import { PrismaService } from '../prisma/prisma.service';
import { capisci, Intento, IntentoRestrizione, IntentoSostituzione, separaCitazione } from './capisci';
import { DizionarioService } from './dizionario.service';
import { PoolDisponibileService } from './pool-disponibile.service';
import { RegistroVeraService } from './registro.service';
import { RichiesteVeraService } from './richieste.service';
import {
  EsitoVera,
  leggiAmbito,
  leggiConferma,
  leggiElenco,
  MAX_TENTATIVI,
  SCADENZA_VERA_MS,
  StatoVera,
  testi,
} from './vera-chat';

interface ClienteTrovata {
  id: string;
  nome: string;
  email: string;
}

/** Quanti alimenti si propongono quando si chiede «quali sono?». Oltre, l'elenco non si legge. */
const MAX_PROPOSTI = 20;

@Injectable()
export class VeraChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dizionario: DizionarioService,
    private readonly pool: PoolDisponibileService,
    private readonly registro: RegistroVeraService,
    private readonly richieste: RichiesteVeraService,
  ) {}

  // ─────────────────────────────────────────────────────────────── ingressi ──

  /** Lo storico della conversazione. Il più vecchio per primo, come lo legge una persona. */
  async storico(nutrizionistaId: string, limite = 60) {
    const righe = await this.prisma.messaggioVera.findMany({
      where: { nutrizionistaId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limite, 200),
    });
    return (righe as { createdAt: Date }[]).slice().reverse();
  }

  /**
   * Apre la conversazione. Se non le ha mai chiesto come si chiama, glielo chiede adesso.
   *
   * ⚠️ È la prima cosa che l'agente impara da lei, e non è un vezzo: mette in chiaro fin dal primo
   * messaggio chi decide. Idempotente — riaprire la pagina non fa ripetere la presentazione.
   */
  async apri(nutrizionistaId: string) {
    const esistenti = await this.prisma.messaggioVera.count({ where: { nutrizionistaId } });
    if (esistenti === 0) {
      await this.scriviAgente(nutrizionistaId, testi.presentazione(), { passo: 'nome', frase: '' });
      return { messaggi: await this.storico(nutrizionistaId) };
    }
    /**
     * Al capo nutrizionista l'agente **porta la coda** quando apre la pagina, invece di aspettare
     * che se la vada a cercare. È il mestiere opposto: non scrive niente, sottopone.
     *
     * ⚠️ Solo se non c'è già un dialogo aperto: interrompere una conferma a metà per infilare una
     * proposta è il modo di far confermare la cosa sbagliata.
     */
    if (!(await this.statoAperto(nutrizionistaId))) {
      const prossima = await this.cosaTiPorto(nutrizionistaId);
      if (prossima) await this.scriviAgente(nutrizionistaId, prossima.testo, prossima.stato, { esito: prossima.esito });
    }
    return { messaggi: await this.storico(nutrizionistaId) };
  }

  /** Un messaggio della nutrizionista. Ritorna la risposta dell'agente. */
  async parla(nutrizionistaId: string, testo: string) {
    const frase = (testo ?? '').trim();
    if (!frase) return { messaggi: await this.storico(nutrizionistaId) };

    await this.prisma.messaggioVera.create({
      data: { nutrizionistaId, ruolo: 'nutrizionista', testo: frase } as never,
    });

    const aperto = await this.statoAperto(nutrizionistaId);
    const esito = aperto
      ? await this.avanza(nutrizionistaId, aperto, frase)
      : await this.nuovoGiro(nutrizionistaId, frase);

    await this.scriviAgente(nutrizionistaId, esito.testo, esito.stato, {
      esito: esito.esito,
      ...(esito.azioneId ? { azioneId: esito.azioneId } : {}),
    });
    return { messaggi: await this.storico(nutrizionistaId) };
  }

  // ───────────────────────────────────────────────────────────── il dialogo ──

  private async nuovoGiro(nutrizionistaId: string, fraseIntera: string): Promise<EsitoVera> {
    /**
     * ⚠️ PRIMA si separa quello che ha incollato, POI si capisce.
     *
     * Le azioni si eseguono solo da ciò che scrive lei di suo pugno. Se dentro il testo incollato
     * c'è qualcosa di azionabile lo si **dice** e ci si ferma: chi ha il potere di scrivere regole
     * su persone vere non deve poter essere comandato da un messaggio scritto da qualcun altro.
     */
    const { suo, citato } = separaCitazione(fraseIntera);
    const frase = suo || fraseIntera;
    if (citato && !capisci(suo) && capisci(citato)) {
      return { testo: testi.dallaCitazione(), esito: 'arresa' };
    }

    const intento = capisci(frase);
    if (!intento) {
      // Il capo che scrive «cosa c'è da vedere?» non sta dettando una regola: sta chiedendo la coda.
      // Si prova quella PRIMA di rispondere «non ho capito», che sarebbe vero e inutile.
      const prossima = await this.cosaTiPorto(nutrizionistaId);
      if (prossima) return prossima;
      return { testo: testi.nonCapito(1), esito: 'non_capito', stato: { passo: 'conferma', frase, tentativi: 1 } };
    }
    if (intento.tipo === 'fuori_portata') {
      /**
       * ⚠️ Non si ripiega su «allora lo faccio sulla cliente»: fare la cosa sbagliata con sicurezza
       * è peggio che non farla. Ma nemmeno si butta via: quello che ha detto **va in coda al capo**
       * come proposta, con la sua frase originale.
       *
       * È il modo onesto di dire «non lo so ancora fare»: la richiesta non si perde, e chi ha il
       * potere di eseguirla la vede. Una regola su un tipo di dieta cambia il menu di centinaia di
       * clienti — che nasca come proposta e non come azione è la stessa scelta di tutto il resto.
       */
      const riga = (await this.registro.scrivi({
        nutrizionistaId,
        frase,
        azione: intento.cosa === 'regola_dieta' ? 'regola_dieta' : 'ricetta_nuova',
        ambito: intento.cosa === 'regola_dieta' ? 'dieta' : 'catalogo',
        soggettoTipo: intento.cosa === 'regola_dieta' ? 'diet' : 'recipe',
        soggettoNome: intento.cosa === 'regola_dieta' ? intento.dettaglio : null,
        dettaglio: { daFareAMano: true, cosa: intento.cosa, testo: intento.dettaglio },
        inApprovazione: true,
      })) as { id: string };
      return {
        testo: `${testi.fuoriPortata(intento.cosa, intento.dettaglio)}\n\n${testi.messaInCoda()}`,
        esito: 'in_approvazione',
        azioneId: riga.id,
      };
    }
    return this.risolviCliente(nutrizionistaId, { passo: 'quale_cliente', frase, intento }, intento.cliente ?? '');
  }

  private async avanza(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    switch (stato.passo) {
      case 'nome':
        return this.impostaNome(nutrizionistaId, frase);
      case 'quale_cliente':
        return this.risolviCliente(nutrizionistaId, stato, frase);
      case 'quale_famiglia':
        return this.imparaFamiglia(nutrizionistaId, stato, frase);
      case 'ambito':
        return this.chiudiConAmbito(nutrizionistaId, stato, frase);
      case 'revisione':
        return this.decidiProposta(nutrizionistaId, stato, frase);
      case 'motivo_rifiuto':
        return this.respingiConMotivo(nutrizionistaId, stato, frase);
      case 'richiesta':
        return this.rispondiARichiesta(nutrizionistaId, stato, frase);
      case 'richiesta_generale':
        return this.valePerTutte(nutrizionistaId, stato, frase);
      case 'conferma':
      default:
        return this.confermaOAnnulla(nutrizionistaId, stato, frase);
    }
  }

  // ──────────────────────────────────────────────────────────────── il nome ──

  private async impostaNome(nutrizionistaId: string, frase: string): Promise<EsitoVera> {
    const grezzo = frase.trim();
    // «scegli tu» → il nome di scorta. Serve: senza, chi non ha voglia di decidere resterebbe
    // bloccato sulla prima domanda, che è il modo peggiore di cominciare.
    const scegliTu = /\b(scegli tu|decidi tu|come vuoi|non so)\b/i.test(grezzo);
    const nome = scegliTu ? 'Vera' : grezzo.split(/[\s,.;]/)[0].slice(0, 30);
    if (!nome) return { testo: testi.presentazione(), esito: 'in_corso', stato: { passo: 'nome', frase: '' } };

    await this.prisma.staff.updateMany({
      where: { userId: nutrizionistaId } as never,
      data: { nomeAgente: nome } as never,
    });
    return { testo: testi.nomePreso(nome), esito: 'in_corso' };
  }

  // ────────────────────────────────────────────────────────────── la cliente ─

  /**
   * Chi è la persona di cui sta parlando.
   *
   * ⚠️ Non si indovina MAI. Zero risultati → lo dico; più d'uno → chiedo cognome o email. Attribuire
   * una regola alla persona sbagliata è l'errore che questo strumento può fare più facilmente, ed è
   * anche quello che nessuno rileggerebbe.
   */
  private async risolviCliente(nutrizionistaId: string, stato: StatoVera, ricerca: string): Promise<EsitoVera> {
    const q = (ricerca ?? '').trim();
    if (!q) return { testo: testi.chiediCliente(), esito: 'in_corso', stato: { ...stato, passo: 'quale_cliente' } };

    const trovate = await this.cercaClienti(nutrizionistaId, q);
    if (trovate.length === 0) {
      return { testo: testi.nessunCliente(q), esito: 'in_corso', stato: { ...stato, passo: 'quale_cliente' } };
    }
    if (trovate.length > 1) {
      return {
        testo: testi.omonimie(q, trovate.length),
        esito: 'in_corso',
        stato: { ...stato, passo: 'quale_cliente', candidati: trovate },
      };
    }
    const cliente = trovate[0];
    return this.preparaAnteprima(nutrizionistaId, {
      ...stato,
      clienteId: cliente.id,
      clienteNome: cliente.nome,
    });
  }

  private async cercaClienti(nutrizionistaId: string, q: string): Promise<ClienteTrovata[]> {
    const perimetro = await perimetroClienti(this.prisma, nutrizionistaId);
    const parole = q.split(/\s+/).filter((p) => p.length >= 2);
    if (!parole.length) return [];

    // Ogni parola deve combaciare da qualche parte: «Rossi Giulia» e «Giulia Rossi» devono trovare
    // la stessa persona, e l'ordine in cui si scrive un nome non è un'informazione.
    const where = {
      role: 'client',
      deletedAt: null,
      ...(perimetro ? { clientProfile: { [perimetro.field]: { in: perimetro.staffIds } } } : {}),
      AND: parole.map((p) => ({
        OR: [
          { firstName: { contains: p, mode: 'insensitive' } },
          { lastName: { contains: p, mode: 'insensitive' } },
          { email: { contains: p, mode: 'insensitive' } },
          { clientProfile: { name: { contains: p, mode: 'insensitive' } } },
        ],
      })),
    };

    const righe = (await this.prisma.user.findMany({
      where: where as never,
      select: { id: true, email: true, firstName: true, lastName: true, clientProfile: { select: { name: true } } },
      take: 20,
    })) as { id: string; email: string; firstName: string | null; lastName: string | null; clientProfile: { name: string | null } | null }[];

    return righe.map((r) => ({
      id: r.id,
      nome: [r.firstName, r.lastName].filter(Boolean).join(' ') || r.clientProfile?.name || r.email,
      email: r.email,
    }));
  }

  // ─────────────────────────────────────────────────────────── il dizionario ─

  /**
   * Le famiglie nominate che il catalogo non conosce, in ordine.
   * La prima che non so la chiedo; le altre restano in coda, una alla volta.
   */
  private async famiglieSconosciute(nutrizionistaId: string, termini: string[]): Promise<string[]> {
    const fuori: string[] = [];
    for (const t of termini) {
      const espanso = expandExclusion(t);
      // `expandExclusion` restituisce più del termine solo se la mappa lo conosce: è la stessa
      // verità che usa il motore, quindi ciò che passa di lì non va chiesto a lei.
      if (espanso.length > 1) continue;
      if (await this.dizionario.risolvi(nutrizionistaId, t)) continue;
      // Un alimento singolo che esiste in catalogo non è una famiglia: non si chiede niente.
      if (await this.esisteInCatalogo(t)) continue;
      fuori.push(t);
    }
    return fuori;
  }

  private async esisteInCatalogo(alimento: string): Promise<boolean> {
    const chiave = chiaveAlimento(alimento);
    if (!chiave) return false;
    const n = await this.prisma.recipe.count({
      where: { name: { contains: alimento, mode: 'insensitive' } } as never,
    });
    return n > 0;
  }

  /** Gli alimenti da proporre per una famiglia sconosciuta. Presi dal catalogo, mai inventati. */
  private async alimentiProposti(famiglia: string): Promise<string[]> {
    const ricette = (await this.prisma.recipe.findMany({
      where: { active: true } as never,
      select: { ingredients: true },
      take: 400,
    })) as { ingredients: unknown }[];

    const visti = new Map<string, string>();
    for (const r of ricette) {
      for (const ing of ((r.ingredients as { name?: string }[]) ?? [])) {
        const nome = (ing?.name ?? '').trim();
        if (!nome) continue;
        // Si propongono gli ingredienti che condividono una parola con la famiglia: «formaggi
        // molli» pesca «formaggio spalmabile». Non pesca la mozzarella — e va bene così: proporre
        // troppo insegna a rispondere di no senza leggere, che è peggio che proporre poco.
        if (!combaciaAlimento(nome, famiglia) && !famiglia.split(/\s+/).some((p) => combaciaAlimento(nome, p))) continue;
        const k = chiaveAlimento(nome);
        if (k && !visti.has(k)) visti.set(k, nome);
      }
    }
    return [...visti.values()].slice(0, MAX_PROPOSTI);
  }

  private async imparaFamiglia(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const membri = leggiElenco(frase);
    const famiglia = stato.famiglia ?? '';
    if (!membri.length) {
      return {
        testo: testi.chiediFamiglia(famiglia, stato.proposti ?? []),
        esito: 'in_corso',
        stato,
      };
    }
    await this.dizionario.insegna(nutrizionistaId, { nome: famiglia, membri });
    const restanti = (stato.famiglieDaChiedere ?? []).filter((f) => f !== famiglia);
    const prossima = await this.preparaAnteprima(nutrizionistaId, { ...stato, famiglieDaChiedere: restanti });
    return { ...prossima, testo: `${testi.famigliaImparata(famiglia, membri)}\n\n${prossima.testo}` };
  }

  // ────────────────────────────────────────────────────────────── l'anteprima ─

  /**
   * La regola tradotta + cosa comporta. È il freno, e non si salta.
   *
   * Prima però si chiudono i buchi: se una famiglia non si sa cosa vuol dire, si chiede — perché
   * un'anteprima costruita su una parola non capita mostrerebbe numeri veri di una regola sbagliata,
   * che è il modo più efficace di far confermare la cosa sbagliata.
   */
  private async preparaAnteprima(nutrizionistaId: string, stato: StatoVera): Promise<EsitoVera> {
    const intento = stato.intento as Intento;
    const clienteId = stato.clienteId!;

    if (intento.tipo === 'restrizione') {
      const daChiedere = stato.famiglieDaChiedere ?? (await this.famiglieSconosciute(nutrizionistaId, intento.vietati));
      if (daChiedere.length) {
        const famiglia = daChiedere[0];
        const proposti = await this.alimentiProposti(famiglia);
        return {
          testo: testi.chiediFamiglia(famiglia, proposti),
          esito: 'in_corso',
          stato: { ...stato, passo: 'quale_famiglia', famiglia, proposti, famiglieDaChiedere: daChiedere },
        };
      }
    }

    const termini = await this.terminiFinali(nutrizionistaId, intento);
    const anteprima = await this.pool.anteprima(clienteId, termini);
    const conflitto = await this.conflittoSanitario(clienteId, intento);

    const righe = [
      this.riepilogo(intento, termini, stato.clienteNome ?? ''),
      anteprima.racconto,
    ];
    if (anteprima.dopo.pastiScoperti.length) {
      righe.push(
        `Cosa vuoi fare? Posso **cercarti alternative in catalogo** per ${anteprima.dopo.pastiScoperti.join(' e ')}, ` +
          'oppure procediamo lo stesso.',
      );
    }
    if (conflitto) righe.push(`⚠️ ${conflitto} Procedo lo stesso?`);
    else righe.push('Confermi?');

    return {
      testo: righe.join('\n\n'),
      esito: 'in_corso',
      stato: { ...stato, passo: 'conferma', famiglieDaChiedere: [] },
    };
  }

  /** I nomi di alimento veri, dopo aver sciolto le famiglie e tolto le eccezioni. */
  private async terminiFinali(nutrizionistaId: string, intento: Intento): Promise<string[]> {
    if (intento.tipo !== 'restrizione') return [];
    const fuori: string[] = [];
    for (const v of intento.vietati) {
      const voce = await this.dizionario.risolvi(nutrizionistaId, v);
      if (voce) fuori.push(...voce.membri);
      else fuori.push(v);
    }
    // ⚠️ «…ma solo il grana» toglie il grana dai vietati. Se restasse dentro, la regola direbbe
    // l'esatto contrario di quello che ha dettato — e sarebbe perfettamente formata.
    const tenuti = intento.tenuti ?? [];
    return fuori.filter((f) => !tenuti.some((t) => combaciaAlimento(f, t) || combaciaAlimento(t, f)));
  }

  /**
   * La regola tocca un vincolo sanitario di questa cliente?
   *
   * ⚠️ Non blocca: **ricorda**. La regola della nutrizionista vince su tutto, allergie comprese — è
   * un medico. Ma mai in silenzio: se se n'è dimenticata, o se sono io ad aver allargato l'elenco
   * traducendo, questa riga è l'unica occasione in cui qualcuno se ne accorge prima del piatto.
   */
  private async conflittoSanitario(clientId: string, intento: Intento): Promise<string | null> {
    if (intento.tipo !== 'restrizione' || !intento.tenuti.length) return null;
    const p = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { allergies: true, intolerances: true, name: true },
    })) as { allergies: string[]; intolerances: string[]; name: string | null } | null;
    if (!p) return null;

    const sanitari = [...(p.allergies ?? []), ...(p.intolerances ?? [])];
    if (!sanitari.length) return null;

    for (const tenuto of intento.tenuti) {
      const parole = expandExclusion(tenuto);
      for (const s of sanitari) {
        const chiavi = expandExclusion(s);
        if (parole.some((a) => chiavi.some((b) => combaciaAlimento(a, b) || combaciaAlimento(b, a)))) {
          return `${p.name ?? 'Questa cliente'} risulta con «${s}» fra allergie e intolleranze, e questa regola le lascerebbe proprio «${tenuto}».`;
        }
      }
    }
    return null;
  }

  private riepilogo(intento: Intento, termini: string[], cliente: string): string {
    if (intento.tipo === 'sostituzione') {
      const i = intento as IntentoSostituzione;
      return `Per **${cliente}**: al posto di «${i.from}» metto «${i.to}».`;
    }
    const i = intento as IntentoRestrizione;
    const tenuti = i.tenuti.length ? ` Tengo: ${i.tenuti.join(', ')}.` : '';
    return `Per **${cliente}** vieto ${termini.length} aliment${termini.length === 1 ? 'o' : 'i'}: ${termini.join(', ')}.${tenuti}`;
  }

  // ───────────────────────────────────────────────────────── conferma e scrittura ─

  private async confermaOAnnulla(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    // Il ramo «non avevo capito»: qui `conferma` è solo il contenitore del contatore tentativi.
    if (!stato.intento) {
      const tentativi = (stato.tentativi ?? 1) + 1;
      const riprova = capisci(frase);
      if (riprova) return this.nuovoGiro(nutrizionistaId, frase);
      if (tentativi > MAX_TENTATIVI) return { testo: testi.nonCapito(MAX_TENTATIVI), esito: 'arresa' };
      return { testo: testi.nonCapito(tentativi), esito: 'non_capito', stato: { ...stato, tentativi } };
    }

    const risposta = leggiConferma(frase);
    if (risposta === false) return { testo: testi.annullato(), esito: 'annullata' };
    if (risposta === null) {
      return {
        testo: 'Non ho capito se posso procedere. Rispondi «sì» o «no» — nel dubbio non scrivo niente.',
        esito: 'in_corso',
        stato,
      };
    }
    return {
      testo: testi.chiediAmbito(stato.clienteNome ?? 'lei'),
      esito: 'in_corso',
      stato: { ...stato, passo: 'ambito' },
    };
  }

  /**
   * L'ultimo passo: solo per questa cliente (predefinito) o per tutte.
   *
   * «A tutte» **non scrive**: apre una proposta in approvazione. È il «promuovi a regola» del §16.9
   * spostato nel momento in cui lei sa ancora perché lo sta dicendo.
   */
  private async chiudiConAmbito(nutrizionistaId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const intento = stato.intento as Intento;
    const termini = await this.terminiFinali(nutrizionistaId, intento);
    const conflitto = await this.conflittoSanitario(stato.clienteId!, intento);

    if (leggiAmbito(frase) === 'tutte') {
      const riga = await this.registro.scrivi({
        nutrizionistaId,
        frase: stato.frase,
        azione: intento.tipo === 'sostituzione' ? 'sostituzione_cliente' : 'restrizione_cliente',
        ambito: 'catalogo',
        soggettoTipo: 'user',
        soggettoId: stato.clienteId ?? null,
        soggettoNome: stato.clienteNome ?? null,
        dettaglio: { intento, termini, estesaATutte: true },
        inApprovazione: true,
        conflittoSanitario: !!conflitto,
      });
      return { testo: testi.ambitoEsteso(), esito: 'in_approvazione', azioneId: (riga as { id: string }).id };
    }

    const riepilogo = intento.tipo === 'sostituzione'
      ? await this.scriviSostituzione(nutrizionistaId, stato, intento as IntentoSostituzione)
      : await this.scriviRestrizione(stato.clienteId!, termini);

    const riga = await this.registro.scrivi({
      nutrizionistaId,
      frase: stato.frase,
      azione: intento.tipo === 'sostituzione' ? 'sostituzione_cliente' : 'restrizione_cliente',
      ambito: 'cliente',
      soggettoTipo: 'user',
      soggettoId: stato.clienteId ?? null,
      soggettoNome: stato.clienteNome ?? null,
      dettaglio: { intento, termini },
      conflittoSanitario: !!conflitto,
    });
    return { testo: testi.scritta(riepilogo), esito: 'scritta', azioneId: (riga as { id: string }).id };
  }

  /**
   * La restrizione finisce fra i **cibi non graditi**, non fra le intolleranze.
   *
   * ⚠️ È una scelta, e va detta. Un'intolleranza in quel campo **blocca il piano** quando il motore
   * non trova un sostituto sicuro (regola R8: blocca ed escala). Una decisione dettata a voce non
   * deve poter fermare l'erogazione di una cliente: i non graditi tolgono il piatto e basta. Se
   * quella parola è davvero un'intolleranza clinica, si scrive dalla scheda — dove chi lo fa sa che
   * sta muovendo un dato sanitario.
   */
  private async scriviRestrizione(clientId: string, termini: string[]): Promise<string> {
    const p = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { dislikedFoods: true },
    })) as { dislikedFoods: string[] } | null;
    const attuali = p?.dislikedFoods ?? [];
    // Idempotente: ridettare la stessa regola non deve raddoppiare le righe nel profilo.
    const nuovi = termini.filter((t) => !attuali.some((a) => combaciaAlimento(a, t)));
    if (nuovi.length) {
      await this.prisma.clientProfile.update({
        where: { userId: clientId },
        data: { dislikedFoods: [...attuali, ...nuovi] } as never,
      });
    }
    return nuovi.length
      ? `Ho tolto dai suoi menu: ${nuovi.join(', ')}.`
      : 'Erano già tutti esclusi: non ho cambiato niente.';
  }

  /**
   * La sostituzione va nella tabella che esiste già (§16.9), come riga **verificata**.
   *
   * ⚠️ `origine: 'manuale'` e non `'nutrizionista'`: quest'ultima vuol dire «letta da una sua frase
   * in chat con la cliente», dove a poter aver sbagliato è il programma. Qui la traduzione gliel'ho
   * mostrata e lei ha detto sì — è una riga scritta a mano, con un'interfaccia più comoda.
   */
  private async scriviSostituzione(
    nutrizionistaId: string,
    stato: StatoVera,
    intento: IntentoSostituzione,
  ): Promise<string> {
    await registraSostituzione(this.prisma, {
      clientId: stato.clienteId!,
      tipo: 'ingrediente',
      from: intento.from,
      to: intento.to,
      recipeId: null,
      origine: 'manuale',
      stato: 'verificata',
      nota: `Dettata all'assistente: «${stato.frase}»`,
      creataDaId: nutrizionistaId,
    });
    return `Al posto di «${intento.from}» userò «${intento.to}».`;
  }

  // ────────────────────────────────────────────── la coda del capo ──────────

  /**
   * Prende la prossima proposta in coda e la sottopone, **già istruita**.
   *
   * «Già istruita» vuol dire: chi l'ha dettata, quando, **la frase originale**, e cosa comporta. Chi
   * decide non deve aprire altre cinque schermate per sapere cosa sta approvando — se le deve
   * aprire, non le apre, e approva a scatola chiusa.
   */
  private async sottoponiProssima(attoreId: string): Promise<EsitoVera | null> {
    const coda = (await this.registro.daApprovare()) as unknown as {
      id: string;
      frase: string;
      nutrizionistaId: string;
      soggettoNome: string | null;
      dettaglio: unknown;
      conflittoSanitario: boolean;
      createdAt: Date;
    }[];
    /**
     * ⚠️ Coda vuota → `null`, **non** un messaggio «non c'è niente».
     *
     * Chi chiama decide cosa farne: all'apertura della pagina non si scrive nulla (un agente che
     * saluta con «non c'è niente da fare» ogni volta insegna a non leggerlo), e dopo una decisione
     * si dice che è finita. Se questa funzione rispondesse sempre qualcosa, il capo che detta una
     * frase non capita si sentirebbe dire «non c'è niente in coda» invece di «non ho capito».
     */
    if (!coda.length) return null;

    const p = coda[0];
    const chi = await this.nomeStaff(p.nutrizionistaId);
    const quando = p.createdAt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    const termini = ((p.dettaglio ?? {}) as { termini?: string[] }).termini ?? [];
    const riepilogo = termini.length
      ? `Vuole vietare a tutte le sue clienti: ${termini.join(', ')}.` +
        (p.soggettoNome ? ` (Nata guardando ${p.soggettoNome}.)` : '')
      : 'Vuole estendere a tutte le sue clienti quello che aveva deciso per una.';

    return {
      testo: testi.sottoponi(coda.length, chi, quando, p.frase, riepilogo, p.conflittoSanitario),
      esito: 'in_corso',
      stato: { passo: 'revisione', frase: p.frase, azioneId: p.id },
    };
  }

  /** Sì = approva e applica; no = chiedi il motivo. Nel dubbio non si fa niente. */
  private async decidiProposta(attoreId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const risposta = leggiConferma(frase);
    if (risposta === null) {
      return {
        testo: 'Non ho capito se approvi. Rispondi «sì» o «no» — nel dubbio la lascio in coda.',
        esito: 'in_corso',
        stato,
      };
    }
    if (risposta === false) {
      return { testo: testi.chiediMotivo(), esito: 'in_corso', stato: { ...stato, passo: 'motivo_rifiuto' } };
    }

    const attore = { id: attoreId, role: await this.ruolo(attoreId) };
    const esito = await this.registro.approva(attore, stato.azioneId!);
    const prossima = await this.cosaTiPorto(attoreId);
    return {
      testo: `${testi.approvata((esito as { riepilogo: string }).riepilogo)}\n\n${prossima?.testo ?? testi.codaVuota()}`.trim(),
      esito: 'scritta',
      stato: prossima?.stato,
      azioneId: stato.azioneId,
    };
  }

  private async respingiConMotivo(attoreId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const motivo = (frase ?? '').trim();
    if (motivo.length < 3) return { testo: testi.chiediMotivo(), esito: 'in_corso', stato };

    const attore = { id: attoreId, role: await this.ruolo(attoreId) };
    await this.registro.respingi(attore, stato.azioneId!, motivo);
    const prossima = await this.cosaTiPorto(attoreId);
    return {
      testo: `${testi.respinta()}\n\n${prossima?.testo ?? testi.codaVuota()}`.trim(),
      esito: 'annullata',
      stato: prossima?.stato,
    };
  }

  /**
   * COSA TI PORTO quando apro bocca senza che tu me l'abbia chiesto.
   *
   * Due code, e l'ordine conta: **prima le proposte da approvare** (dietro c'è una nutrizionista che
   * aspetta), poi le domande aperte (dietro c'è una cliente il cui piatto oggi non è filtrato).
   * `null` = non ho niente da dirti, e allora **non dico niente**: un agente che saluta con «non c'è
   * nulla da fare» ogni volta insegna a non leggerlo.
   */
  private async cosaTiPorto(userId: string): Promise<EsitoVera | null> {
    const capo = (await this.ruolo(userId)) !== 'nutritionist';
    if (capo) {
      const proposta = await this.sottoponiProssima(userId);
      if (proposta) return proposta;
    }
    return this.prossimaRichiesta(userId, capo);
  }

  /** La prossima domanda aperta, scritta com'era: chi sa cosa manca l'ha già formulata. */
  private async prossimaRichiesta(userId: string, capo: boolean): Promise<EsitoVera | null> {
    const aperte = await this.richieste.aperte(userId, capo);
    if (!aperte.length) return null;
    const r = aperte[0];
    return {
      testo: testi.richiesta(aperte.length, r.testo),
      esito: 'in_corso',
      stato: {
        passo: 'richiesta',
        frase: r.testo,
        richiestaId: r.id,
        clienteId: r.clienteId,
        clienteNome: r.clienteNome ?? undefined,
        termine: (r as unknown as { termine?: string | null }).termine ?? undefined,
      },
    };
  }

  /**
   * La PRIMA delle due scritture: gli alimenti finiscono fra le esclusioni di quella cliente.
   *
   * ⚠️ Passa da `RichiesteVeraService`, che a sua volta passa da `ClientsService.updateClient`: è il
   * punto unico che controlla il permesso e lascia la traccia. Scrivere il profilo da qui sarebbe la
   * seconda strada per lo stesso dato sanitario — il difetto che questo campo ha già avuto due volte.
   */
  private async rispondiARichiesta(userId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const lasciaStare = /\b(lascia stare|niente|non so|salta|dopo)\b/i.test(frase.trim());
    const alimenti = lasciaStare ? [] : leggiElenco(frase);
    if (!lasciaStare && !alimenti.length) {
      return { testo: testi.richiesta(1, stato.frase), esito: 'in_corso', stato };
    }

    const esito = await this.richieste.rispondi(userId, stato.richiestaId!, { alimenti, risposta: frase.trim() });
    const scritta = testi.rispostaScritta(esito.clienteNome, esito.aggiunti);

    // La seconda scrittura si chiede a parte, e solo se c'è una parola da imparare.
    if (alimenti.length && stato.termine) {
      return {
        testo: `${scritta}\n\n${testi.chiediGenerale(stato.termine, alimenti)}`,
        esito: 'in_corso',
        stato: { ...stato, passo: 'richiesta_generale', alimenti },
      };
    }
    const prossima = await this.cosaTiPorto(userId);
    return { testo: `${scritta}\n\n${prossima?.testo ?? ''}`.trim(), esito: 'scritta', stato: prossima?.stato };
  }

  /**
   * La SECONDA scrittura: la parola entra nel dizionario di tutte — ma solo come **proposta**.
   *
   * ⚠️ Mai scrittura diretta, nemmeno se a rispondere è il capo. Il vocabolario di tutte le clienti
   * non si allarga con una risposta data fra due visite: passa dalla coda, come tutto ciò che ha
   * quel raggio.
   */
  private async valePerTutte(userId: string, stato: StatoVera, frase: string): Promise<EsitoVera> {
    const risposta = leggiConferma(frase);
    if (risposta === null) {
      return {
        testo: 'Non ho capito se vale per tutte. Rispondi «sì» o «no» — nel dubbio resta solo sulla cliente.',
        esito: 'in_corso',
        stato,
      };
    }

    let coda = '';
    if (risposta === true && stato.termine) {
      const riga = (await this.registro.scrivi({
        nutrizionistaId: userId,
        frase: stato.frase,
        azione: 'voce_dizionario',
        ambito: 'catalogo',
        soggettoTipo: 'user',
        soggettoId: stato.clienteId ?? null,
        soggettoNome: stato.clienteNome ?? null,
        dettaglio: { famiglia: stato.termine, membri: stato.alimenti ?? [] },
        inApprovazione: true,
      })) as { id: string };
      if (stato.richiestaId) await this.richieste.collega(stato.richiestaId, riga.id);
      coda = testi.propostaDizionario(stato.termine);
    }

    const prossima = await this.cosaTiPorto(userId);
    return {
      testo: [coda, prossima?.testo].filter(Boolean).join('\n\n') || 'Va bene, resta solo sulla cliente.',
      esito: risposta ? 'in_approvazione' : 'scritta',
      stato: prossima?.stato,
    };
  }

  private async ruolo(userId: string): Promise<string> {
    const u = (await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } })) as { role: string } | null;
    return u?.role ?? 'nutritionist';
  }

  private async nomeStaff(userId: string): Promise<string> {
    const s = (await this.prisma.staff.findUnique({
      where: { userId } as never,
      select: { displayName: true },
    })) as { displayName: string } | null;
    return s?.displayName ?? 'Una nutrizionista';
  }

  // ──────────────────────────────────────────────────────────────── utilità ──

  private async statoAperto(nutrizionistaId: string): Promise<StatoVera | null> {
    const ultimo = (await this.prisma.messaggioVera.findFirst({
      where: { nutrizionistaId, ruolo: 'agente' },
      orderBy: { createdAt: 'desc' },
      select: { meta: true, createdAt: true },
    })) as { meta: unknown; createdAt: Date } | null;
    if (!ultimo) return null;
    // Un dialogo lasciato a metà stamattina non è un dialogo in corso.
    if (Date.now() - ultimo.createdAt.getTime() > SCADENZA_VERA_MS) return null;
    const meta = (ultimo.meta ?? {}) as { stato?: StatoVera };
    return meta.stato?.passo ? meta.stato : null;
  }

  private async scriviAgente(
    nutrizionistaId: string,
    testo: string,
    stato?: StatoVera,
    extra: Record<string, unknown> = {},
  ) {
    await this.prisma.messaggioVera.create({
      data: {
        nutrizionistaId,
        ruolo: 'agente',
        testo,
        meta: { ...(stato ? { stato } : {}), ...extra } as never,
      } as never,
    });
  }
}
