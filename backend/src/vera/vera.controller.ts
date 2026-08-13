import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { DizionarioService } from './dizionario.service';
import { PoolDisponibileService } from './pool-disponibile.service';
import { AmbitoVera, AzioneVeraTipo, RegistroVeraService } from './registro.service';
import { VeraChatService } from './vera-chat.service';
import { AnteprimaPoolDto, InsegnaFamigliaDto, MessaggioVeraDto, ScriviAzioneDto } from './dto/vera.dto';

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
 * `@RequirePage('food_swaps')` e non una chiave nuova: è lo stesso perimetro — «cosa il motore userà
 * per le clienti» — e moltiplicare le chiavi di permesso significa moltiplicare i posti dove
 * qualcuno dimentica di abilitare qualcosa. `manage` per scrivere, come là.
 */
@Controller('vera')
@Roles('admin', 'nutritionist', 'head_nutritionist')
export class VeraController {
  constructor(
    private readonly pool: PoolDisponibileService,
    private readonly dizionario: DizionarioService,
    private readonly registro: RegistroVeraService,
    private readonly chat: VeraChatService,
  ) {}

  // ---------- la conversazione ----------

  /**
   * Apre la pagina. Al primo ingresso l'agente si presenta e le chiede come vuole chiamarlo.
   * Idempotente: ricaricare non fa ripetere la presentazione.
   */
  @Post('chat/apri')
  @RequirePage('food_swaps', 'manage')
  apri(@CurrentUser() user: AuthUser) {
    return this.chat.apri(user.sub);
  }

  @Get('chat')
  @RequirePage('food_swaps')
  storico(@CurrentUser() user: AuthUser) {
    return this.chat.storico(user.sub);
  }

  /** Un messaggio dettato. La risposta è l'intera conversazione aggiornata. */
  @Post('chat')
  @RequirePage('food_swaps', 'manage')
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
  @RequirePage('food_swaps')
  anteprimaPool(@Body() dto: AnteprimaPoolDto) {
    return this.pool.anteprima(dto.clientId, dto.termini ?? []);
  }

  /** Le alternative che esistono DAVVERO in catalogo per quel pasto. Mai inventate. */
  @Get('alternative/:clientId/:slot')
  @RequirePage('food_swaps')
  alternative(@Param('clientId') clientId: string, @Param('slot') slot: string) {
    return this.pool.alternativeInCatalogo(clientId, slot);
  }

  // ---------- il dizionario ----------

  @Get('dizionario')
  @RequirePage('food_swaps')
  dizionarioElenco(@CurrentUser() user: AuthUser) {
    return this.dizionario.elenco(user.sub);
  }

  /** «Cosa vuol dire per te questa parola?» — `null` è la risposta che fa scattare la domanda. */
  @Get('dizionario/risolvi')
  @RequirePage('food_swaps')
  risolvi(@CurrentUser() user: AuthUser, @Query('nome') nome: string) {
    return this.dizionario.risolvi(user.sub, nome ?? '');
  }

  @Post('dizionario')
  @RequirePage('food_swaps', 'manage')
  insegna(@CurrentUser() user: AuthUser, @Body() dto: InsegnaFamigliaDto) {
    return this.dizionario.insegna(user.sub, dto);
  }

  @Delete('dizionario/:id')
  @RequirePage('food_swaps', 'manage')
  dimentica(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.dizionario.dimentica(user.sub, id);
  }

  /** Rende comune una voce: solo il capo nutrizionista, come «promuovi a regola». */
  @Post('dizionario/:id/promuovi')
  @RequirePage('food_swaps', 'manage')
  promuovi(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.dizionario.promuovi({ id: user.sub, role: user.role }, id);
  }

  /** Le famiglie che un alimento nuovo potrebbe riguardare: serve a non far invecchiare il dizionario. */
  @Get('dizionario/candidate')
  @RequirePage('food_swaps')
  candidate(@Query('alimento') alimento: string) {
    return this.dizionario.famiglieCheForsePrendono(alimento ?? '');
  }

  // ---------- il registro ----------

  @Get('registro')
  @RequirePage('food_swaps')
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
  @RequirePage('food_swaps', 'manage')
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
  @RequirePage('food_swaps', 'manage')
  annulla(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.registro.annulla(user.sub, id);
  }

  /**
   * Quanti menu futuri questa cliente NON ha ancora visto.
   * Si chiede PRIMA di scrivere, per mostrarle la conseguenza invece di farle indovinare.
   */
  @Get('menu-da-rifare/:clientId')
  @RequirePage('food_swaps')
  menuDaRifare(@Param('clientId') clientId: string) {
    return this.registro.menuDaRifare(clientId);
  }
}
