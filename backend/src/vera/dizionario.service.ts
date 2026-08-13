/**
 * IL DIZIONARIO — l'unica cosa che Vera impara davvero.
 *
 * La nutrizionista dice «togli i formaggi molli». Quella famiglia in catalogo non esiste, e l'agente
 * **non indovina**: elenca i formaggi che ha e le fa spuntare quali sono. Da lì «formaggi molli»
 * vuol dire quei nove alimenti, per lei, e la volta dopo non chiede più.
 *
 * ⚠️ Impara la sua LINGUA, non la nutrizione. Il catalogo resta la fonte della verità; lei fornisce
 * soltanto le etichette. È l'unico apprendimento che un modello può fare qui senza fare danni, ed è
 * anche l'unico verificabile: il dizionario è una tabella che si legge, si corregge e si cancella,
 * non un modello addestrato di cui nessuno sa niente.
 *
 * ⚠️ È anche misurabile, e conviene ricordarlo: dopo un mese questa tabella ha quaranta voci o ne ha
 * tre, e da lì si capisce da soli se il progetto sta funzionando.
 */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { chiaveAlimento, combaciaAlimento, radice } from '../common/nomi-alimento';
import { PrismaService } from '../prisma/prisma.service';

export interface VoceDizionario {
  id: string;
  nome: string;
  chiave: string;
  membri: string[];
  comune: boolean;
  nutrizionistaId: string;
}

/** Chi può promuovere una voce a comune. Stesso principio di «promuovi a regola». */
const RUOLI_CHE_PROMUOVONO = new Set(['head_nutritionist', 'admin']);

/**
 * ⚠️ LA CHIAVE LARGA — la seconda passata, e il difetto che l'ha resa necessaria.
 *
 * `chiaveAlimento` toglie UNA vocale finale: «formaggio» diventa `formaggi`, «formaggi» diventa
 * `formagg`. Quindi «formaggi molli» e «formaggio molle» danno chiavi DIVERSE, e senza rimedio
 * succederebbe questo: la nutrizionista insegna la famiglia scrivendola al plurale, tre settimane
 * dopo la nomina al singolare, l'agente non la riconosce e **gliela richiede**. Peggio: se lei
 * rispondesse, nascerebbe una seconda voce per la stessa famiglia — due significati per la stessa
 * parola, e nessuno dei due sbagliato abbastanza da farsi notare.
 *
 * Applicare la radice una seconda volta fa convergere le due forme (`formaggi` → `formagg`, e
 * `formagg` resta `formagg`, perché non finisce per vocale).
 *
 * ⚠️ Sta QUI e non dentro `chiaveAlimento`, di proposito. Quella funzione la usano le sostituzioni
 * (§16.9) per contare quante volte è stata chiesta la stessa cosa: renderla più aggressiva per
 * comodità di questo modulo accorperebbe righe che non c'entrano — la lezione di «pepe» e
 * «peperoni», applicata al contrario. Qui il costo di un accorpamento sbagliato è un significato
 * proposto che lei corregge in un secondo; là è il conteggio su cui si decide una regola.
 *
 * E resta il **secondo** tentativo, mai il primo: la chiave esatta vince sempre.
 */
const chiaveLarga = (nome: string): string =>
  chiaveAlimento(nome)
    .split(' ')
    .map((p) => radice(p))
    .join(' ');

@Injectable()
export class DizionarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Le voci che valgono per questa nutrizionista: le sue, più quelle comuni. */
  async elenco(nutrizionistaId: string): Promise<VoceDizionario[]> {
    return (await this.prisma.famigliaAlimento.findMany({
      where: { OR: [{ nutrizionistaId }, { comune: true }] },
      orderBy: { nome: 'asc' },
    })) as unknown as VoceDizionario[];
  }

  /**
   * Che cosa vuol dire questa parola, per questa nutrizionista.
   *
   * ⚠️ **La sua batte la comune, sempre.** Due nutrizioniste possono intendere cose diverse con la
   * stessa parola — «pasto leggero» è l'esempio evidente — e sovrascriverle a vicenda sarebbe il
   * modo di far applicare a una il significato dell'altra senza che nessuna delle due lo sappia.
   * Il disaccordo resta, e va nel rapporto mensile: è un'informazione, non un difetto da nascondere.
   *
   * Ritorna `null` se non la conosce: è la risposta che fa scattare la domanda, ed è il motivo per
   * cui questa funzione non prova a somigliare a niente.
   */
  async risolvi(nutrizionistaId: string, nome: string): Promise<VoceDizionario | null> {
    const chiave = chiaveAlimento(nome);
    if (!chiave) return null;

    const esatte = (await this.prisma.famigliaAlimento.findMany({
      where: { chiave, OR: [{ nutrizionistaId }, { comune: true }] },
    })) as unknown as VoceDizionario[];
    if (esatte.length) return this.suaPrima(nutrizionistaId, esatte);

    // Seconda passata, tollerante: «formaggio molle» deve trovare «formaggi molli». Il dizionario
    // di una nutrizionista è di decine di voci, non di migliaia: filtrare in memoria costa meno di
    // una colonna in più da tenere allineata.
    const larga = chiaveLarga(nome);
    if (!larga) return null;
    const tutte = await this.elenco(nutrizionistaId);
    const simili = tutte.filter((v) => chiaveLarga(v.nome) === larga);
    return simili.length ? this.suaPrima(nutrizionistaId, simili) : null;
  }

  /** Fra più voci che combaciano, la sua vince sempre sulla comune. */
  private suaPrima(nutrizionistaId: string, voci: VoceDizionario[]): VoceDizionario {
    return voci.find((v) => v.nutrizionistaId === nutrizionistaId) ?? voci[0];
  }

  /**
   * Insegna una famiglia: nome + gli alimenti che la nutrizionista ha spuntato.
   *
   * ⚠️ I membri si salvano come NOMI e non come id di ricetta. Una famiglia alimentare parla di
   * cibo, non di piatti: se domani una ricetta viene cancellata, «formaggi molli» deve continuare a
   * voler dire quello che voleva dire.
   */
  async insegna(
    nutrizionistaId: string,
    input: { nome: string; membri: string[] },
  ): Promise<VoceDizionario> {
    const nome = (input.nome ?? '').trim();
    const membri = [...new Set((input.membri ?? []).map((m) => (m ?? '').trim()).filter(Boolean))];
    if (!nome) throw new BadRequestException('Serve il nome della famiglia.');
    // Una famiglia vuota non è una famiglia: applicata a una regola non toglierebbe niente, e la
    // nutrizionista vedrebbe «fatto» su una cosa che non fa nulla. Meglio rifiutare adesso.
    if (!membri.length) throw new BadRequestException('Serve almeno un alimento: una famiglia vuota non esclude niente.');

    /**
     * ⚠️ Se ha già una voce che vuol dire la stessa cosa scritta diversamente, si AGGIORNA quella.
     *
     * Senza questo passaggio, insegnare «formaggio molle» a chi aveva già «formaggi molli»
     * creerebbe una seconda riga: due significati per la stessa parola, di cui uno vecchio, e le
     * regole scritte prima continuerebbero a usare quello. Un doppione qui non è disordine — è una
     * regola che smette di aggiornarsi senza dirlo a nessuno.
     */
    const gemella = (await this.elenco(nutrizionistaId)).find(
      (v) => v.nutrizionistaId === nutrizionistaId && chiaveLarga(v.nome) === chiaveLarga(nome),
    );
    const chiave = gemella?.chiave ?? chiaveAlimento(nome);

    const voce = (await this.prisma.famigliaAlimento.upsert({
      where: { nutrizionistaId_chiave: { nutrizionistaId, chiave } },
      create: { nutrizionistaId, nome, chiave, membri } as never,
      update: { nome, membri } as never,
    })) as unknown as VoceDizionario;

    await this.audit.log({
      action: 'vera.dizionario.insegna',
      actorId: nutrizionistaId,
      entityType: 'famiglia_alimento',
      entityId: voce.id,
      metadata: { nome, membri },
    });
    return voce;
  }

  /** Cancella una voce. Solo la propria: quella comune la tocca chi l'ha promossa. */
  async dimentica(nutrizionistaId: string, id: string): Promise<{ dimenticata: true }> {
    const voce = (await this.prisma.famigliaAlimento.findUnique({ where: { id } })) as unknown as VoceDizionario | null;
    if (!voce) throw new NotFoundException('Voce non trovata.');
    if (voce.nutrizionistaId !== nutrizionistaId) {
      throw new ForbiddenException('Questa voce non è tua.');
    }
    await this.prisma.famigliaAlimento.delete({ where: { id } });
    await this.audit.log({
      action: 'vera.dizionario.dimentica',
      actorId: nutrizionistaId,
      entityType: 'famiglia_alimento',
      entityId: id,
      metadata: { nome: voce.nome },
    });
    return { dimenticata: true };
  }

  /**
   * «Questa parola vuol dire la stessa cosa per tutte»: la voce diventa comune.
   *
   * Stesso gesto di «promuovi a regola» delle sostituzioni, e non è un caso: entrambi portano una
   * cosa nata su un caso singolo dentro qualcosa che vale per tutti, e in entrambi i casi deve
   * premerlo una persona, non un automatismo.
   */
  async promuovi(attore: { id: string; role: string }, id: string): Promise<VoceDizionario> {
    if (!RUOLI_CHE_PROMUOVONO.has(attore.role)) {
      throw new ForbiddenException('Solo il capo nutrizionista può rendere comune una voce.');
    }
    const voce = (await this.prisma.famigliaAlimento.findUnique({ where: { id } })) as unknown as VoceDizionario | null;
    if (!voce) throw new NotFoundException('Voce non trovata.');
    if (voce.comune) return voce;

    const aggiornata = (await this.prisma.famigliaAlimento.update({
      where: { id },
      data: { comune: true, promossaDaId: attore.id, promossaIl: new Date() } as never,
    })) as unknown as VoceDizionario;

    await this.audit.log({
      action: 'vera.dizionario.promuovi',
      actorId: attore.id,
      entityType: 'famiglia_alimento',
      entityId: id,
      metadata: { nome: voce.nome, autoreId: voce.nutrizionistaId },
    });
    return aggiornata;
  }

  /**
   * Le famiglie note che un alimento NUOVO potrebbe riguardare.
   *
   * ⚠️ Serve a chiudere il buco che rende il dizionario un guasto silenzioso. «Formaggi molli» sono
   * nove nomi congelati: entra in catalogo una burrata, la lista non la contiene, e la regola
   * continua a esistere e a funzionare — solo su un elenco vecchio. Nessun errore, nessuno se ne
   * accorge.
   *
   * Il rimedio è chiedere nel momento giusto, a chi sta già lavorando al catalogo: «la burrata la
   * metto fra i formaggi molli?». Questa funzione produce le candidate; la domanda la fa la pagina.
   *
   * Il confronto è **per parola, con la radice** (`combaciaAlimento`): mai per sottostringa, o
   * «pepe» prende «peperoni».
   */
  async famiglieCheForsePrendono(alimento: string): Promise<VoceDizionario[]> {
    const nome = (alimento ?? '').trim();
    if (!nome) return [];
    const tutte = (await this.prisma.famigliaAlimento.findMany({})) as unknown as VoceDizionario[];
    return tutte.filter(
      (v) =>
        // Già dentro: niente da chiedere.
        !v.membri.some((m) => combaciaAlimento(m, nome)) &&
        // Somiglia a qualcosa che la famiglia già contiene («burrata» ↔ «mozzarella»? no; ma
        // «yogurt greco» ↔ «yogurt» sì). Il caso che questa euristica NON prende va bene così:
        // proporre troppo poco costa una domanda mancata, proporre troppo insegna a dire di no.
        v.membri.some((m) => combaciaAlimento(nome, m) || combaciaAlimento(m, nome)),
    );
  }
}
