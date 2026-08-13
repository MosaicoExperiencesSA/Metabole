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
import { capisci, Intento, IntentoRestrizione, IntentoSostituzione } from './capisci';
import { DizionarioService } from './dizionario.service';
import { PoolDisponibileService } from './pool-disponibile.service';
import { RegistroVeraService } from './registro.service';
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
    if (esistenti > 0) return { messaggi: await this.storico(nutrizionistaId) };

    await this.scriviAgente(nutrizionistaId, testi.presentazione(), { passo: 'nome', frase: '' });
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

  private async nuovoGiro(nutrizionistaId: string, frase: string): Promise<EsitoVera> {
    const intento = capisci(frase);
    if (!intento) {
      return { testo: testi.nonCapito(1), esito: 'non_capito', stato: { passo: 'conferma', frase, tentativi: 1 } };
    }
    if (intento.tipo === 'fuori_portata') {
      // ⚠️ Non si ripiega su «allora lo faccio sulla cliente»: fare la cosa sbagliata con sicurezza
      // è peggio che non farla. Si dice cosa si è capito e cosa manca.
      return { testo: testi.fuoriPortata(intento.cosa, intento.dettaglio), esito: 'arresa' };
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
