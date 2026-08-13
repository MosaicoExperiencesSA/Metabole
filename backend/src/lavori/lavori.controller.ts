import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { DatiLavoro } from './lavoro';
import { LavoriService } from './lavori.service';

/**
 * LA PAGINA «LAVORI» — l'elenco di cosa manca, con la spunta (13/8, richiesta di Simone).
 *
 * ⚠️ Il permesso è la chiave `dev_backlog` della matrice, **non** `@Roles('admin')` da solo. Il
 * motivo è scritto in testa a `permissions/pages.ts`: `assignments` era un interruttore acceso nella
 * tabella dei permessi che non apriva niente, perché l'endpoint era inchiodato all'admin — e nessun
 * errore lo diceva. Qui la chiave nasce insieme alla guardia che la legge, con default **solo
 * admin**: il giorno che serve a qualcun altro si accende dalla tabella, senza un rilascio.
 *
 * `manage` anche in lettura non serve: `view` per guardare l'elenco, `manage` per toccarlo.
 */
@Controller('admin/lavori')
/**
 * ⚠️ `@Roles` elenca TUTTO lo staff di proposito: a decidere è la matrice, non questa riga. Se qui
 * ci fossero tre ruoli scelti a mano, il giorno che concedi `dev_backlog` a un quarto la pagina gli
 * darebbe 403 — un permesso acceso che non apre niente, che è il difetto raccontato in testa a
 * `permissions/pages.ts`. Le CLIENTI invece restano fuori qui, e non dalla matrice: non è una
 * concessione da poter sbagliare.
 */
@Roles('admin', 'coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist', 'sales', 'marketing', 'head_marketing')
export class LavoriController {
  constructor(private readonly lavori: LavoriService) {}

  @Get()
  @RequirePage('dev_backlog')
  elenco() {
    return this.lavori.elenco();
  }

  @Post()
  @RequirePage('dev_backlog', 'manage')
  crea(@Body() dto: DatiLavoro) {
    return this.lavori.crea(dto);
  }

  @Patch(':id')
  @RequirePage('dev_backlog', 'manage')
  aggiorna(@Param('id') id: string, @Body() dto: DatiLavoro) {
    return this.lavori.aggiorna(id, dto);
  }

  /** La risposta: quello che si è saputo. Svuotarla la cancella, chi e quando compresi. */
  @Post(':id/risposta')
  @RequirePage('dev_backlog', 'manage')
  rispondi(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { risposta?: unknown }) {
    return this.lavori.rispondi(id, body?.risposta, user.sub);
  }

  /** Il testo del pulsante «Copia per Claude». GET: legge e basta. */
  @Get('testo')
  @RequirePage('dev_backlog')
  testo() {
    return this.lavori.testo();
  }

  /**
   * «Carica le voci nuove». ⚠️ Senza `conferma: true` **non scrive**: dice solo cosa aggiungerebbe.
   * È il `CONFERMA=1` della shell, portato dentro la pagina in due gesti invece che in uno.
   */
  @Post('carica')
  @RequirePage('dev_backlog', 'manage')
  carica(@Body() body: { conferma?: unknown }) {
    return this.lavori.caricaVociIniziali(body?.conferma === true);
  }

  /** La spunta. `fatto: false` la toglie, e azzera chi e quando. */
  @Post(':id/fatto')
  @RequirePage('dev_backlog', 'manage')
  segna(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { fatto?: unknown }) {
    return this.lavori.segna(id, body?.fatto !== false, user.sub);
  }

  @Delete(':id')
  @RequirePage('dev_backlog', 'manage')
  elimina(@Param('id') id: string) {
    return this.lavori.elimina(id);
  }
}
