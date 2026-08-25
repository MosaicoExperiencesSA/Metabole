import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { oggiPiu } from '../common/date-only';
import { GIORNI_ANTEPRIMA_AGENDA } from './finestra-agenda';
import { AgendaService } from './agenda.service';
import { CreaFerieDto, CreaSlotDto } from './dto/agenda.dto';

/**
 * §16.7 — L'AGENDA DEL NUTRIZIONISTA: gli orari che offre e i giorni in cui non riceve.
 *
 * Ogni rotta lavora sull'agenda di CHI CHIAMA, sempre. Non esiste un parametro per toccare quella
 * di un collega, e non è una dimenticanza: gli orari di una persona sono suoi, e un capo che li
 * riscrive dall'altra parte del paese è un modo di far trovare al nutrizionista una giornata che
 * non ha deciso lui. Se un giorno servirà, sarà una rotta a parte con un permesso a parte.
 *
 * Il prefisso è `agenda-visite` e non `agenda`: quest'ultimo esiste già (`health-area`, l'elenco
 * delle visite) e due controller sullo stesso prefisso sono il modo di scoprire una rotta doppia
 * in produzione.
 */
@Controller('agenda-visite')
@Roles('nutritionist', 'head_nutritionist', 'admin')
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  /** La settimana tipo così com'è scritta, comprese le righe disattivate. */
  @Get('slot')
  @RequirePage('visits_agenda')
  slot(@CurrentUser() user: AuthUser) {
    return this.agenda.miaSettimana(user.sub);
  }

  @Post('slot')
  @RequirePage('visits_agenda', 'manage')
  creaSlot(@Body() dto: CreaSlotDto, @CurrentUser() user: AuthUser) {
    return this.agenda.creaSlot(user.sub, {
      inizio: dto.inizio,
      fine: dto.fine,
      ripete: dto.ripete,
      weekday: dto.weekday ?? null,
      data: dto.data ?? null,
      tipo: dto.tipo,
    });
  }

  /** Toglie un orario. Se ci sono appuntamenti presi lo disattiva invece di cancellarlo. */
  @Delete('slot/:id')
  @RequirePage('visits_agenda', 'manage')
  eliminaSlot(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.agenda.eliminaSlot(user.sub, id);
  }

  @Get('ferie')
  @RequirePage('visits_agenda')
  ferie(@CurrentUser() user: AuthUser) {
    return this.agenda.mieFerie(user.sub);
  }

  /** ⚠️ Rifiutata se nel periodo ci sono appuntamenti: l'elenco è dentro il messaggio d'errore. */
  @Post('ferie')
  @RequirePage('visits_agenda', 'manage')
  creaFerie(@Body() dto: CreaFerieDto, @CurrentUser() user: AuthUser) {
    return this.agenda.creaFerie(user.sub, dto);
  }

  @Delete('ferie/:id')
  @RequirePage('visits_agenda', 'manage')
  eliminaFerie(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.agenda.eliminaFerie(user.sub, id);
  }

  /**
   * L'anteprima: com'è venuta la settimana, giorno per giorno, già senza ferie, festivi e orari
   * presi. È la STESSA funzione che userà la cliente per scegliere — averne una sola è quello che
   * impedisce che l'anteprima mostri una cosa e la prenotazione ne offra un'altra.
   */
  @Get('liberi')
  @RequirePage('visits_agenda')
  liberi(@CurrentUser() user: AuthUser, @Query('dal') dal?: string, @Query('al') al?: string) {
    /**
     * ⛔ **I DUE ESTREMI CON DUE DEFINIZIONI DI GIORNO: 29 giorni invece di 30** (25/8, censimento).
     *
     * Erano `new Date().toISOString().slice(0, 10)` — il giorno **UTC** — e un `setDate(+30)`
     * sull'istante. Fra la mezzanotte e le 02:00 italiane il primo è ancora **ieri**, e il secondo
     * parte da lì: la finestra si accorciava di un giorno e **l'ultimo giorno prenotabile non
     * compariva**. È lo stesso miscuglio di `prenotazioni.service`, sull'altra porta.
     *
     * ⚠️ **L'estremo sinistro non arrivava a fare danno**, e va detto invece di prendersi il merito:
     * `agenda.service.orariLiberi` fa `const dal = dalIso < oggi ? oggi : dalIso` con l'`oggi` di
     * Roma, quindi un `dal` di ieri veniva già risalito lì. Il difetto vero di questa riga è il
     * **destro**, che nessuno ricalcola. Il sinistro si corregge lo stesso: due punti che rispondono
     * alla stessa domanda in due modi diversi sono il modo in cui la prossima riga sbaglia da sola.
     *
     * ⚠️ `oggiPiu` somma i giorni su una mezzanotte UTC, in millisecondi, e da **una sola** lettura
     * dell'orologio: chiamarlo due volte a cavallo della mezzanotte darebbe 29 o 31 giorni.
     */
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const adesso = new Date();
    return this.agenda.mieiOrariLiberi(
      user.sub,
      dal || iso(oggiPiu(0, adesso)),
      al || iso(oggiPiu(GIORNI_ANTEPRIMA_AGENDA, adesso)),
    );
  }
}
