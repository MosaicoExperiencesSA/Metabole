import { Body, Controller, Delete, Get, Logger, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { DizionarioService } from './dizionario.service';
import { PoolDisponibileService } from './pool-disponibile.service';
import { AmbitoVera, AzioneVeraTipo, RegistroVeraService } from './registro.service';
import { RichiesteVeraService } from './richieste.service';
import { VeraChatService } from './vera-chat.service';
import { AnteprimaPoolDto, InsegnaFamigliaDto, MessaggioVeraDto, RespingiDto, ScriviAzioneDto } from './dto/vera.dto';

/**
 * VERA — la conversazione e le fondamenta su cui poggia.
 *
 * La chat (`chat/*`) è la porta; sotto ci sono i tre pezzi che la rendono sicura: l'anteprima che
 * dice cosa succede davvero al pool, il dizionario che impara la lingua della nutrizionista, e il
 * registro con l'annulla. Sono stati costruiti PRIMA, e da soli, di proposito: costruendo prima la
 * chat si sarebbe vista subito una cosa bella appoggiata sul niente.
 *
 * ⚠️ La chat è dietro `manage` e non `view`: parlarci **scrive** — impara una famiglia, apre una
 * proposta, mette una regola sul profilo di una persona. Una nutrizionista in sola lettura può
 * leggere il registro, non dettare.
 *
 * ⚠️ `nutri_assistant` è una chiave SUA, e prima era `food_swaps`. Il riuso aveva un motivo — meno
 * chiavi, meno posti dove qualcuno dimentica di abilitare qualcosa — ma perdeva contro una regola di
 * prodotto data da Simone il 13/8 («tutte le pagine che aggiungiamo vanno gestite nei permessi,
 * sempre»): con una chiave sola, Assistente e Sostituzioni erano due voci di menu che si davano e si
 * toglievano insieme, e separarle dopo sarebbe costato un rilascio. `manage` per scrivere, `view`
 * per leggere.
 */
@Controller('vera')
@Roles('admin', 'nutritionist', 'head_nutritionist')
export class VeraController {
  private readonly logger = new Logger(VeraController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pool: PoolDisponibileService,
    private readonly dizionario: DizionarioService,
    private readonly registro: RegistroVeraService,
    private readonly chat: VeraChatService,
    private readonly richieste: RichiesteVeraService,
  ) {}

  // ---------- le domande che aspettano una nutrizionista ----------

  /**
   * L'elenco delle domande aperte.
   *
   * ⚠️ Esiste come **elenco** e non solo come messaggi in chat, ed è l'avvertenza che il contratto
   * mette sopra tutte le altre: se le richieste vivono solo dentro il dialogo, in due settimane sono
   * una chat lunga in cui le cose scendono e nessuno sa più cosa manca. È la stessa ragione per cui
   * il 13/8 è nata la pagina Lavori invece di fidarsi del REGISTRO.
   */
  @Get('richieste')
  @RequirePage('nutri_assistant')
  richiesteAperte(@CurrentUser() user: AuthUser) {
    return this.richieste.aperte(user.sub, user.role !== 'nutritionist');
  }

  // ---------- la conversazione ----------

  /**
   * Apre la pagina. Al primo ingresso l'agente si presenta e le chiede come vuole chiamarlo.
   * Idempotente: ricaricare non fa ripetere la presentazione.
   */
  @Post('chat/apri')
  @RequirePage('nutri_assistant', 'manage')
  apri(@CurrentUser() user: AuthUser) {
    return this.chat.apri(user.sub);
  }

  @Get('chat')
  @RequirePage('nutri_assistant')
  storico(@CurrentUser() user: AuthUser) {
    return this.chat.storico(user.sub);
  }

  /** Un messaggio dettato. La risposta è l'intera conversazione aggiornata. */
  @Post('chat')
  @RequirePage('nutri_assistant', 'manage')
  parla(@CurrentUser() user: AuthUser, @Body() dto: MessaggioVeraDto) {
    return this.chat.parla(user.sub, dto.testo);
  }

  // ---------- il freno ----------

  /**
   * Cosa resterebbe se si escludessero anche questi alimenti. Non scrive niente.
   *
   * POST e non GET perché l'elenco dei termini può essere lungo e non sta in una query string —
   * ma resta una lettura, e il test lo verifica.
   */
  @Post('anteprima-pool')
  @RequirePage('nutri_assistant')
  anteprimaPool(@Body() dto: AnteprimaPoolDto) {
    return this.pool.anteprima(dto.clientId, dto.termini ?? []);
  }

  /** Le alternative che esistono DAVVERO in catalogo per quel pasto. Mai inventate. */
  @Get('alternative/:clientId/:slot')
  @RequirePage('nutri_assistant')
  alternative(@Param('clientId') clientId: string, @Param('slot') slot: string) {
    return this.pool.alternativeInCatalogo(clientId, slot);
  }

  // ---------- il dizionario ----------

  @Get('dizionario')
  @RequirePage('nutri_assistant')
  dizionarioElenco(@CurrentUser() user: AuthUser) {
    return this.dizionario.elenco(user.sub);
  }

  /** «Cosa vuol dire per te questa parola?» — `null` è la risposta che fa scattare la domanda. */
  @Get('dizionario/risolvi')
  @RequirePage('nutri_assistant')
  risolvi(@CurrentUser() user: AuthUser, @Query('nome') nome: string) {
    return this.dizionario.risolvi(user.sub, nome ?? '');
  }

  @Post('dizionario')
  @RequirePage('nutri_assistant', 'manage')
  insegna(@CurrentUser() user: AuthUser, @Body() dto: InsegnaFamigliaDto) {
    return this.dizionario.insegna(user.sub, dto);
  }

  @Delete('dizionario/:id')
  @RequirePage('nutri_assistant', 'manage')
  dimentica(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.dizionario.dimentica(user.sub, id);
  }

  /** Rende comune una voce: solo il capo nutrizionista, come «promuovi a regola». */
  @Post('dizionario/:id/promuovi')
  @RequirePage('nutri_assistant', 'manage')
  promuovi(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.dizionario.promuovi({ id: user.sub, role: user.role }, id);
  }

  /** Le famiglie che un alimento nuovo potrebbe riguardare: serve a non far invecchiare il dizionario. */
  @Get('dizionario/candidate')
  @RequirePage('nutri_assistant')
  candidate(@Query('alimento') alimento: string) {
    return this.dizionario.famiglieCheForsePrendono(alimento ?? '');
  }

  // ---------- il registro ----------

  /**
   * TUTTO quello che è cambiato sulle sue clienti: non solo l'assistente, anche Gaia, la cliente
   * dall'app e lo staff. È la vista che Simone ha chiesto il 12/8 («direi tutto»).
   */
  @Get('registro/tutto')
  @RequirePage('nutri_assistant')
  registroTutto(@CurrentUser() user: AuthUser) {
    return this.registro.tutto(user.sub);
  }

  /**
   * «QUELLO CHE ASPETTA ME» — non «quello che ho fatto».
   *
   * ⚠️ Un contatore delle regole create è una medaglietta: la si guarda due volte e poi mai più.
   * Qui ci sono solo cose che hanno bisogno di una persona, e ognuna ha un posto dove andare.
   */
  @Get('aspetta-me')
  @RequirePage('nutri_assistant')
  async aspettaMe(@CurrentUser() user: AuthUser) {
    const capo = user.role !== 'nutritionist';
    const staff = await this.prisma.staff.findUnique({ where: { userId: user.sub }, select: { id: true } });
    const [richieste, daApprovare, daVerificare, pool] = await Promise.all([
      this.richieste.quante(user.sub, capo),
      capo ? this.registro.daApprovare().then((r) => r.length) : Promise.resolve(0),
      this.registro.sostituzioniDaVerificare(user.sub),
      /**
       * ⚠️ IL POOL SOTTO SOGLIA — l'ultimo dei quattro moduli della §13.3, e l'unico che mancava.
       * Il conto non deve poter far fallire il riquadro: se si rompe si degrada a «non lo so»
       * (`null`), che è diverso da «nessuna» e la pagina lo scrive diverso.
       */
      this.pool
        .quanteSottoSoglia(staff?.id ?? null, capo)
        .catch((e: unknown) => {
          this.logger.warn(`Pool sotto soglia NON calcolato per ${user.sub}: ${String(e)}`);
          return null;
        }),
    ]);
    return { richieste, daApprovare, daVerificare, capo, pool };
  }

  @Get('registro')
  @RequirePage('nutri_assistant')
  registroElenco(
    @Query('nutrizionistaId') nutrizionistaId?: string,
    @Query('soggettoId') soggettoId?: string,
    @Query('azione') azione?: string,
    @Query('stato') stato?: string,
  ) {
    return this.registro.elenco({ nutrizionistaId, soggettoId, azione, stato });
  }

  /**
   * ⚠️ I campi si copiano UNO PER UNO, senza spread del DTO.
   *
   * Con `{ ...dto, nutrizionistaId: user.sub }` un campo aggiunto domani al DTO entrerebbe nel
   * registro senza che nessuno lo abbia deciso — e su una riga che deve reggere come traccia di una
   * decisione clinica, «è arrivato perché era nel corpo della richiesta» non è una provenienza.
   * Elencare i campi costa dieci righe e rende impossibile scriverne uno per sbaglio.
   */
  @Post('registro')
  @RequirePage('nutri_assistant', 'manage')
  scrivi(@CurrentUser() user: AuthUser, @Body() dto: ScriviAzioneDto) {
    return this.registro.scrivi({
      nutrizionistaId: user.sub,
      frase: dto.frase,
      azione: dto.azione as AzioneVeraTipo,
      ambito: dto.ambito as AmbitoVera,
      soggettoTipo: dto.soggettoTipo as 'user' | 'diet' | 'recipe',
      soggettoId: dto.soggettoId ?? null,
      soggettoNome: dto.soggettoNome ?? null,
      dettaglio: dto.dettaglio ?? null,
      inApprovazione: dto.inApprovazione,
      conflittoSanitario: dto.conflittoSanitario,
    });
  }

  /** Annulla, e restituisce i giorni non ancora visti che si possono rifare. */
  @Post('registro/:id/annulla')
  @RequirePage('nutri_assistant', 'manage')
  annulla(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.registro.annulla(user.sub, id);
  }

  // ---------- la coda del capo nutrizionista ----------

  /**
   * Le proposte che aspettano il capo, **in ordine di rischio e non di data**.
   *
   * ⚠️ Non esiste nessun endpoint di approvazione in blocco, e non è una dimenticanza (decisione di
   * Simone del 12/8): un «approva tutte» in tre settimane diventa l'unico pulsante che si preme.
   */
  @Get('coda')
  @RequirePage('nutri_assistant')
  coda() {
    return this.registro.daApprovare();
  }

  @Post('registro/:id/approva')
  @RequirePage('nutri_assistant', 'manage')
  approva(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.registro.approva({ id: user.sub, role: user.role }, id);
  }

  @Post('registro/:id/respingi')
  @RequirePage('nutri_assistant', 'manage')
  respingi(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RespingiDto) {
    return this.registro.respingi({ id: user.sub, role: user.role }, id, dto.motivo);
  }

  // ---------- quello che si legge dopo, non mentre si lavora ----------

  /**
   * IL REPORT DEL MESE, per chi sorveglia (Nocanty: non fa visite, guarda il lavoro degli altri).
   *
   * ⚠️ Solo il capo. Non per riservatezza — le righe sono già tutte nel registro — ma perché è un
   * foglio che confronta persone: darlo a chi ci sta dentro cambia cosa quelle persone dettano.
   */
  @Get('report')
  @Roles('admin', 'head_nutritionist')
  @RequirePage('nutri_assistant')
  report(@Query('anno') anno?: string, @Query('mese') mese?: string) {
    const ora = new Date();
    return this.registro.reportMensile(
      Number(anno) || ora.getUTCFullYear(),
      Number(mese) || ora.getUTCMonth() + 1,
    );
  }

  /**
   * LE FRASI: quelle che non ha capito e quelle che ha capito.
   *
   * È il collaudo che si costruisce da solo (`corpus.ts`). Serve a due momenti diversi: le prime
   * dicono quali parole insegnargli, le seconde sono i casi che devono continuare a passare quando
   * qualcuno tocca il riconoscitore.
   */
  @Get('corpus')
  @RequirePage('nutri_assistant')
  corpus(@CurrentUser() user: AuthUser) {
    return this.registro.corpus(user.sub, user.role !== 'nutritionist');
  }

  /**
   * Quanti menu futuri questa cliente NON ha ancora visto.
   * Si chiede PRIMA di scrivere, per mostrarle la conseguenza invece di farle indovinare.
   */
  @Get('menu-da-rifare/:clientId')
  @RequirePage('nutri_assistant')
  menuDaRifare(@Param('clientId') clientId: string) {
    return this.registro.menuDaRifare(clientId);
  }
}
