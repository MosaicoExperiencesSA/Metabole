import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBase64,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Headers, HttpCode as HttpCodeDecorator, RawBodyRequest, Req } from '@nestjs/common';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CommerceService } from './commerce.service';
import { CreatePlanDto, CreateProductDto, UpdatePlanDto, UpdateProductDto } from './dto/shop-admin.dto';
import { CrmService } from './crm.service';
import { FinanceService } from './finance.service';
import { StripeService } from './stripe.service';
import { AuditService } from '../audit/audit.service';

/**
 * La data di inizio di «Conosciamoci». **Obbligatoria**: l'ha chiesto Simone («non si va avanti
 * senza»), ed è anche la condizione tecnica perché i menu partano — senza `planStartDate`
 * `deliverIfEligible` non eroga niente.
 *
 * `@IsString()` e non `@IsDateString()`: la validazione vera — passato, limite a 12 mesi,
 * normalizzazione a giorno — sta in `validaDataInizio`, che è pura e provata. Due validazioni sulla
 * stessa cosa, in due posti, sono il modo classico per farne divergere una.
 */
class BenvenutoDto {
  @IsString()
  dataInizio!: string;
}

class SubscribeDto {
  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsIn(['bank_transfer', 'card'])
  method?: 'bank_transfer' | 'card';

  // Il mantenimento si vende in due modi (listino 6/8): abbonamento o mese singolo. Sui piani
  // che sono SOLO abbonamento questo flag è ignorato — decide il piano, non il client.
  @IsOptional()
  @IsBoolean()
  abbonamento?: boolean;
}

class OrderItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  qty!: number;
}

class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

class CheckoutDto {
  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items?: OrderItemDto[];

  @IsIn(['card', 'bank_transfer'])
  method!: 'card' | 'bank_transfer';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  discountCode?: string;

  // Mantenimento: abbonamento (addebito automatico) invece del mese singolo. Ignorato sui piani
  // che sono solo una-tantum o solo abbonamento — lì decide il piano, non il client.
  @IsOptional()
  @IsBoolean()
  abbonamento?: boolean;
}

class UploadReceiptDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName!: string;

  @IsIn(['application/pdf', 'image/jpeg', 'image/png', 'image/heic'])
  mimeType!: string;

  @IsBase64()
  contentBase64!: string;
}

class RejectPaymentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

class CreateLeadDto {
  @IsEmail()
  email!: string;

  /**
   * Nome e cognome, **obbligatori** dal 9/8. Prima c'era un solo campo «Nome (facoltativo)»:
   * si potevano inserire lead senza nome — e in tabella diventavano una riga con la sola email,
   * che nessuno sa chi sia — e chi il nome lo scriveva lo scriveva come gli veniva, per cui
   * ordinare per cognome era impossibile.
   */
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  firstName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  lastName!: string;

  /** Come si fa chiamare (soprannome, nome d'arte): facoltativo. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  alias?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  // "Inserisci lead e invia credenziali": crea il lead E manda subito l'accesso.
  @IsOptional()
  @IsBoolean()
  sendCredentials?: boolean;

  // Coach a cui assegnare il lead (Staff.id). Il service lo sapeva già gestire, ma il DTO
  // non lo dichiarava e il form non lo chiedeva: il lead nasceva sempre nel pool.
  @IsOptional()
  @IsString()
  assignedCoachId?: string;
}

class AdvanceLeadDto {
  @IsString()
  stage!: string;

  @IsOptional()
  @IsString()
  ownerStaffId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  valueCents?: number;
}

class UpdateLeadInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  // Anche dalla scheda, altrimenti si potrebbero inserire e mai correggere.
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  alias?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone2?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  valueCents?: number;

  // Storico importato dalle liste pre-Metabole (informativo).
  @IsOptional()
  @IsString()
  @MaxLength(80)
  previousStatus?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  historicalPaidCents?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  codiceFiscale?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string | null;

  // Handoff punto 6 — tracciamento e consensi.
  @IsOptional()
  @IsIn(['ex_cliente', 'lead_caldo', 'lead_freddo', ''])
  segment?: string | null;

  @IsOptional()
  @IsIn(['email', 'whatsapp', 'sms', 'coach', 'retargeting', 'organico', ''])
  channel?: string | null;

  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean | null;

  @IsOptional()
  @IsArray()
  @IsIn(['email', 'whatsapp', 'sms'], { each: true })
  consentChannels?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  tags?: string[];
}

class SetLeadListsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  listIds!: string[];
}

class AddLeadNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}

// Nessun limite di lunghezza qui: i dati storici possono avere campi sporchi
// (nomi concatenati, ecc.). Il servizio tronca i campi troppo lunghi invece di
// far fallire l'intero lotto per una singola riga anomala.
class ImportRowDto {
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() lists?: string; // separate da '|'
  @IsOptional() @IsString() previousStatus?: string;
  @IsOptional() @IsInt() historicalPaidCents?: number;
  @IsOptional() @IsString() coachRefCode?: string;
  @IsOptional() @IsString() codiceFiscale?: string;
  @IsOptional() @IsString() address?: string;
}

class ImportLeadsDto {
  @IsBoolean() dryRun!: boolean;
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows!: ImportRowDto[];
}

class CreateCrmListDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsString() @MaxLength(9) color?: string;
}

class UpdateCrmListDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsString() @MaxLength(9) color?: string;
}

/** Piani e prodotti pubblici (per landing e app). */
@Controller()
export class CatalogCommerceController {
  constructor(private readonly commerce: CommerceService) {}

  /**
   * Catalogo pubblico: **senza il mantenimento**, che si propone solo a obiettivo raggiunto e
   * quindi richiede di sapere chi sta chiedendo. Le clienti loggate usano `GET /me/plans`, che
   * applica la regola per davvero; il backoffice ha `GET /admin/purchases/plans`.
   */
  @Public()
  @Get('plans')
  plans() {
    return this.commerce.listPublicPlans();
  }

  @Public()
  @Get('products')
  products() {
    return this.commerce.listProducts();
  }

  /** Metodi di pagamento abilitati dal backoffice (per il checkout dell'app). */
  @Public()
  @Get('payment-methods')
  paymentMethods() {
    return this.commerce.enabledPaymentMethods();
  }
}

/** Lato cliente. */
@Controller('me')
@Roles('client')
export class MyCommerceController {
  constructor(private readonly commerce: CommerceService) {}

  /** Piani visibili a QUESTO cliente: nasconde i piani non riacquistabili già presi. */
  @Get('plans')
  myPlans(@CurrentUser() user: AuthUser) {
    return this.commerce.listPlansForClient(user.sub);
  }

  /** Prodotti visibili a QUESTO cliente: nasconde i prodotti non riacquistabili già presi. */
  @Get('products')
  myProducts(@CurrentUser() user: AuthUser) {
    return this.commerce.listProductsForClient(user.sub);
  }

  @Post('subscribe')
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: SubscribeDto) {
    return this.commerce.subscribe(user.sub, dto.planId, user.email, dto.method ?? 'bank_transfer', dto.abbonamento ?? false);
  }

  /**
   * FINE QUESTIONARIO → «Conosciamoci» parte, con la data scelta dalla cliente (§16.1, 11/8).
   *
   * Un endpoint che riceve **una cosa sola**: la data. Il `planId` non arriva dall'app di proposito —
   * lo sa il backend. Se il client potesse dire *quale* piano attivare a €0, avremmo riaperto dalla
   * finestra la porta appena chiusa in `assertPlanPurchasable`.
   */
  @Post('benvenuto')
  benvenuto(@CurrentUser() user: AuthUser, @Body() dto: BenvenutoDto) {
    return this.commerce.attivaBenvenuto(user.sub, dto.dataInizio);
  }

  /**
   * Il mio abbonamento RICORRENTE: cosa pago, quando si rinnova, se ho già disdetto.
   *
   * ⚠️ Il percorso è `/me/subscription/recurring`, **non** `/me/subscription`: quest'ultimo esiste
   * già più sotto e restituisce l'abbonamento principale (piano, date, primo menu) letto da tre
   * schermate dell'app — Calendario, Profilo e il promemoria della data d'inizio. Registrandone
   * due con lo stesso percorso Nest tiene solo il primo e l'altro sparisce senza un errore: quelle
   * tre schermate si sarebbero trovate `null` al posto del piano, e nessun test se ne accorge
   * perché ognuno dei due metodi, preso da solo, funziona.
   */
  @Get('subscription/recurring')
  myRecurringSubscription(@CurrentUser() user: AuthUser) {
    return this.commerce.myRecurring(user.sub);
  }

  /**
   * Disdetta in autonomia (decisione 7/8). Vale a fine periodo già pagato: i menu continuano
   * fino alla scadenza. È reversibile finché quel periodo non finisce.
   */
  @HttpCode(200)
  @Post('subscription/cancel')
  cancelSubscription(@CurrentUser() user: AuthUser) {
    return this.commerce.cancelMyRecurring(user.sub);
  }

  /** Ripensamento: annulla la disdetta. */
  @HttpCode(200)
  @Post('subscription/resume')
  resumeSubscription(@CurrentUser() user: AuthUser) {
    return this.commerce.resumeMyRecurring(user.sub);
  }

  /** «Aggiorna la carta»: link al portale di Stripe (i dati della carta non passano da noi). */
  @Get('subscription/card-portal')
  cardPortal(@CurrentUser() user: AuthUser) {
    return this.commerce.cardPortalUrl(user.sub);
  }

  /** Checkout unificato del carrello (piano + prodotti + sconto, carta o bonifico). */
  @Post('checkout')
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.commerce.checkout(user.sub, user.email, {
      planId: dto.planId,
      items: dto.items,
      method: dto.method,
      discountCode: dto.discountCode,
      abbonamento: dto.abbonamento,
    });
  }

  @Get('subscription')
  subscription(@CurrentUser() user: AuthUser) {
    return this.commerce.mySubscription(user.sub);
  }

  @Post('orders')
  order(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.commerce.createOrder(user.sub, user.email, dto.items);
  }

  @Get('payments')
  payments(@CurrentUser() user: AuthUser) {
    return this.commerce.myPayments(user.sub);
  }

  /** Ricevuta PDF di un proprio pagamento confermato. */
  @Get('payments/:id/receipt-pdf')
  receiptPdf(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commerce.myReceiptPdf(user.sub, id);
  }

  /** Upload della contabile del bonifico. */
  @HttpCode(200)
  @Post('payments/:id/receipt')
  receipt(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UploadReceiptDto,
  ) {
    return this.commerce.uploadReceipt(user.sub, id, dto);
  }

  /** La cliente annulla un proprio ordine ancora in attesa (non ancora approvato). */
  @HttpCode(200)
  @Post('payments/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commerce.cancelPayment(user.sub, id, { byClient: true });
  }
}

class CreateManualPurchaseDto {
  @IsUUID()
  clientId!: string;

  @IsUUID()
  planId!: string;

  @IsBoolean()
  generateCommissions!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  discountCode?: string | null;

  /**
   * DA DOVE arriva l'attivazione, e quindi se è un incasso (decisione di Simone, 8/8):
   *  - `acquisti` (default) → vendita vera fatta fuori dal negozio: entra in contabilità;
   *  - `scheda_cliente` → attivazione interna (omaggio, staff, socio, prova): NON scrive ricavi.
   * Il default contabilizza di proposito: un chiamante che non passa questo campo non deve far
   * sparire un incasso vero dai libri senza che nessuno lo noti.
   */
  @IsOptional()
  @IsIn(['acquisti', 'scheda_cliente'])
  origine?: string;
}

class RefundPurchaseDto {
  /** Importo del rimborso in centesimi (l'operatore lo decide: anche parziale). */
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;
}


class CancelSubscriptionDto {
  /** Perché lo si annulla: finisce in audit, e fra sei mesi è l'unica cosa che spiega la riga. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string | null;

  /**
   * ⚠️ Serve SOLO quando l'annullamento lascia la cliente senza nessun piano in corso: in quel caso
   * il primo tentativo torna 409 con la frase da leggere, e il secondo — con `conferma` — esegue.
   * Negli altri casi non si chiede niente: una conferma chiesta sempre insegna a cliccare «sì»
   * senza leggere, e allora la volta che conta non la legge nessuno.
   */
  @IsOptional()
  @IsBoolean()
  conferma?: boolean;
}

/**
 * Acquisti: elenco, ricevuta PDF, inserimento manuale (operatore).
 *
 * ## Chi entra, e quanto vede (11/8)
 *
 * Simone: «la tabella acquisti voglio renderla visibile alle coach, ma devono vedere solo le clienti
 * nella loro rete». Erano due cose diverse e mancavano entrambe.
 *
 * 1. **Chi entra.** C'era `@Roles('admin', 'sales')` e basta: la spunta «vede» sugli Acquisti nella
 *    pagina Permessi accendeva la voce di menu, e poi l'API rispondeva «Ruolo non autorizzato per
 *    questa risorsa» — una spunta che non fa niente. Ora la decisione sta dove Simone la prende:
 *    `@RequirePage('purchases')` legge la matrice dei permessi, quindi vale anche per i ruoli
 *    personalizzati e si cambia senza rilascio. `@Roles` resta come rete di sicurezza sui ruoli che
 *    possono anche solo essere considerati (nessun cliente, mai).
 * 2. **Quanto vede.** L'elenco è filtrato sul perimetro di chi guarda (`perimetroClienti`, lo stesso
 *    della tabella Clienti) e le ricevute di UNA riga sono controllate una per una: filtrare
 *    l'elenco non basta, perché l'id di una riga fuori elenco si può sempre chiedere a mano.
 *
 * Le azioni che toccano i soldi (inserimento manuale, storno, eliminazione, ricalcolo provvigioni)
 * restano `@Roles('admin')`: aprire la lettura non apre la scrittura.
 */
@Controller('admin/purchases')
@Roles('admin', 'sales', 'coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist')
@RequirePage('purchases')
export class AdminPurchasesController {
  constructor(
    private readonly commerce: CommerceService,
    private readonly finance: FinanceService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.commerce.listPayments(status, user.sub);
  }

  /**
   * Piani vendibili a mano dall'operatrice: l'elenco COMPLETO, mantenimento incluso.
   * Il modale "Nuovo acquisto manuale" leggeva `GET /plans`, che ora nasconde il mantenimento:
   * senza questo endpoint l'operatrice non potrebbe piu' attivarlo a nessuno.
   */
  /**
   * ⛔ **STESSA CHIAVE DELLA SCRITTURA, in sola vista** — e senza, il permesso sarebbe un
   * interruttore che non accende niente: la finestra «Attiva un piano» legge **questo** elenco, e a
   * chi avesse la casella senza poter leggere i piani si aprirebbe **vuota**.
   *
   * ⚠️ `@Roles` si allarga ai ruoli dello staff e resta come **rete**: il cancello vero è la
   * casella, che si cambia dai Permessi senza un rilascio. È la stessa forma già scritta in testa a
   * questo controller per `purchases`.
   */
  @Roles('admin', 'sales', 'head_nutritionist', 'coach_coordinator')
  @RequirePage('attiva_piano')
  @Get('plans')
  plans() {
    return this.commerce.listPlans();
  }

  @Get(':id/receipt-pdf')
  receiptPdf(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.commerce.generateReceiptPdf(id, user.sub);
  }

  /**
   * ⛔ **ATTIVARE UN PIANO A MANO HA UNA CHIAVE SUA** (Simone, 4/9: *«va gestito nei ruoli»*).
   *
   * Prima era `@Roles('admin')` e basta: il potere non si poteva né dare né togliere dai Permessi —
   * il gemello rovesciato del difetto del 3/9, dove 29 caselle spengono il menu e non la porta.
   * ⚠️ Qui c'era **una porta senza nessuna casella**.
   *
   * ⚠️ `manage`, non `view`: vedere l'elenco dei piani e attivarne uno a una cliente vera — che
   * tocca erogazione, fatturazione e quello che lei vede in app — sono due cose. E `@Roles` resta
   * sotto, perché il `PageGuard` è permissivo se il database non risponde.
   */
  @Roles('admin', 'sales', 'head_nutritionist', 'coach_coordinator')
  @RequirePage('attiva_piano', 'manage')
  @HttpCode(201)
  @Post()
  createManual(@CurrentUser() user: AuthUser, @Body() dto: CreateManualPurchaseDto) {
    return this.commerce.createManualPurchase(user, dto);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.commerce.deletePurchase(id, user.sub);
  }

  /** Storno: registra il rimborso, blocca i menu e storna le provvigioni in proporzione. */
  @Roles('admin')
  @HttpCode(200)
  @Post(':id/refund')
  refund(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: RefundPurchaseDto) {
    return this.commerce.refundPurchase(id, user.sub, dto);
  }

  @Get(':id/refund-receipt-pdf')
  refundReceiptPdf(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.commerce.generateRefundReceiptPdf(id, user.sub);
  }

  /**
   * Ricalcolo delle provvigioni di un acquisto gia' approvato.
   *
   * Serve quando la scala del piano era scritta male (le percentuali sono soglie CUMULATIVE:
   * per dare 25 alla coach, 10 alla coordinatrice e 10 al manager si scrive 25 / 35 / 45) e
   * quindi la catena si e' fermata al primo livello. Corretto il piano, i pagamenti gia' fatti
   * non si sistemano da soli: questo bottone li rilegge con le percentuali di oggi e accredita
   * la differenza. Non cancella niente e non toglie niente a nessuno; rilanciarlo non raddoppia.
   */
  @Roles('admin')
  @HttpCode(200)
  @Post(':id/ricalcola-provvigioni')
  ricalcolaProvvigioni(@Param('id') id: string) {
    return this.finance.ricalcolaProvvigioni(id);
  }
}

/** Operatore: verifica contabili e approva (admin + commerciale). */
@Controller('admin/payments')
@Roles('admin', 'sales')
export class AdminPaymentsController {
  constructor(private readonly commerce: CommerceService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.commerce.listPayments(status);
  }

  @Get(':id/receipt')
  receipt(@Param('id') id: string) {
    return this.commerce.downloadReceipt(id);
  }

  @HttpCode(200)
  @Post(':id/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commerce.approvePayment(user, id);
  }

  @HttpCode(200)
  @Post(':id/reject')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RejectPaymentDto) {
    return this.commerce.rejectPayment(user, id, dto.reason);
  }

  /** "Elimina" con conferma dal backoffice: annulla il pagamento (resta nello storico). */
  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commerce.cancelPayment(user.sub, id, { byClient: false });
  }
}

/**
 * Lo staff (coach/sales/admin) carica la contabile del bonifico per conto della
 * cliente — stesso scope di visibilità dei lead/clienti.
 */
@Controller('staff/payments')
@Roles('coach', 'coach_coordinator', 'sales', 'admin')
export class StaffPaymentsController {
  constructor(private readonly commerce: CommerceService) {}

  /** Carica (o sostituisce) la contabile del bonifico per conto della cliente. */
  @HttpCode(200)
  @Post(':id/receipt')
  uploadReceipt(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UploadReceiptDto) {
    return this.commerce.uploadReceiptByStaff(user.sub, id, dto);
  }

  /** Vede la contabile caricata (stesso scope dell'upload). */
  @Get(':id/receipt')
  receipt(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commerce.downloadReceiptByStaff(user.sub, id);
  }
}

/** Webhook Stripe (spec: POST /payments/webhook). Firma verificata, idempotente. */
@SkipThrottle() // la firma Stripe è la protezione; niente rate limit sui webhook
@Controller('payments')
export class StripeWebhookController {
  constructor(
    private readonly commerce: CommerceService,
    private readonly stripe: StripeService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @HttpCode(200)
  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const event = this.stripe.verifyWebhook(req.rawBody ?? Buffer.alloc(0), signature ?? '');
    try {
      // Smistamento per tipo. Gli eventi degli ABBONAMENTI arrivano da soli, per anni, senza
      // che nessuno prema niente: se non sono gestiti qui, un rinnovo incassato da Stripe non
      // diventa mai un pagamento nostro — e nessuno se ne accorge, perché i soldi arrivano
      // lo stesso.
      switch (event.type) {
        case 'invoice.paid':
          return await this.commerce.handleInvoicePaid(event as never);
        case 'invoice.payment_failed':
          return await this.commerce.handleInvoiceFailed(event as never);
        case 'customer.subscription.deleted':
          return await this.commerce.handleSubscriptionDeleted(event as never);
        // La disdetta si fa dall'app, ma il portale Stripe ha il suo pulsante: senza questo
        // ramo, una disdetta fatta lì non si vedrebbe da noi per un mese intero.
        case 'customer.subscription.updated':
          return await this.commerce.handleSubscriptionUpdated(event as never);
        default:
          return await this.commerce.handleStripeEvent(event as never);
      }
    } catch (e) {
      // Osservabilità: un webhook fallito viene tracciato (azione dedicata,
      // interrogabile/allertabile) e poi RILANCIATO — così Stripe lo riprova
      // (l'elaborazione è idempotente) invece di perderlo in silenzio.
      const msg = e instanceof Error ? e.message : String(e);
      try {
        await this.audit.log({
          action: 'payments.webhook_failed',
          metadata: {
            eventType: (event as { type?: string })?.type ?? 'unknown',
            eventId: (event as { id?: string })?.id ?? null,
            error: msg,
          } as Record<string, unknown>,
        });
      } catch {
        // eslint-disable-next-line no-console
        console.error('[stripe.webhook] audit del fallimento non riuscito:', msg);
      }
      // eslint-disable-next-line no-console
      console.error('[stripe.webhook] elaborazione fallita, Stripe riproverà:', msg);
      throw e;
    }
  }
}

/**
 * CRM (commerciale, coach, capo, admin) — **e la nutrizionista**.
 *
 * ⚠️ `nutritionist` è stato aggiunto l'11/8 perché l'elenco **Clienti** è diventato questa stessa
 * lista con il filtro «ha pagato» (§16.4): senza, la nutrizionista aprirebbe la sua pagina Clienti e
 * prenderebbe un 403 su una pagina che ha sempre avuto.
 *
 * Non le apre niente di nuovo: `crm.list` applica il **perimetro della nutrizionista** (solo le
 * clienti assegnate a lei, e nessun contatto senza cliente collegata), e la voce «Gestione lead» nel
 * menu resta governata dal permesso di pagina `crm_leads`, che lei non ha.
 */
@Controller('crm/leads')
@Roles('coach', 'coach_coordinator', 'sales', 'head_nutritionist', 'nutritionist', 'admin')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('stage') stage?: string,
    @Query('listId') listId?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('coachId') coachId?: string,
    @Query('nutriId') nutriId?: string,
    @Query('tipo') tipo?: string,
    /** «Solo da valutare»: la coda del via libera clinico. Vedi `clients/idoneita.ts`. */
    @Query('daValutare') daValutare?: string,
    @Query('valueMin') valueMin?: string,
    @Query('valueMax') valueMax?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sortKey') sortKey?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    const num = (v?: string) => (v != null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined);
    // La coach vede SOLO i suoi lead (scope applicato nel service); manager coach/capo/admin tutti.
    return this.crm.list({
      stage, listId, search: q,
      page: num(page), pageSize: num(pageSize),
      coachId, nutriId, tipo,
      // Un parametro assente e un `false` sono la stessa cosa: nessun filtro.
      daValutare: daValutare === '1' || daValutare === 'true',
      valueMin: num(valueMin), valueMax: num(valueMax),
      dateFrom, dateTo, sortKey, sortDir,
    }, user.sub);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeadDto) {
    const record = await this.crm.create(user.sub, dto);
    let credentialsSent = false;
    if (dto.sendCredentials) {
      await this.crm.sendCredentials(record.id, user.sub);
      credentialsSent = true;
    }
    return { ...record, credentialsSent };
  }

  /** Crea/rigenera l'accesso per un lead e invia le credenziali via email. */
  @Post(':id/send-credentials')
  @HttpCode(200)
  sendCredentials(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.crm.sendCredentials(id, user.sub);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.crm.detail(id, user.sub);
  }

  @Patch(':id')
  advance(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AdvanceLeadDto) {
    return this.crm.advance(user.sub, id, dto);
  }

  /** Elimina la scheda lead: SOLO admin (un lead che è già cliente si elimina dalla scheda cliente). */
  @Roles('admin')
  @HttpCode(200)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.crm.deleteLead(user.sub, id);
  }

  @Patch(':id/info')
  updateInfo(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateLeadInfoDto) {
    return this.crm.updateInfo(user.sub, id, dto);
  }

  /**
   * Log delle modifiche del lead: chi ha cambiato cosa, dal backoffice **e** dall'app.
   * Stessa visibilità della scheda (`assertLeadAccess` dentro il servizio).
   */
  @Get(':id/audit')
  logModifiche(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.crm.logModifiche(id, user.sub);
  }

  /** Imposta le liste di un lead (rimpiazza le appartenenze). */
  @Post(':id/lists')
  @HttpCode(200)
  setLists(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetLeadListsDto) {
    return this.crm.setLeadLists(user.sub, id, dto.listIds);
  }

  /** Nota dello staff sulla scheda lead (come le note della scheda cliente). */
  @HttpCode(201)
  @Post(':id/notes')
  addNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddLeadNoteDto) {
    return this.crm.addLeadNote(user.sub, id, dto.body);
  }

  /** Elimina una nota della scheda lead: solo admin (come nella scheda cliente). */
  @Roles('admin')
  @HttpCode(200)
  @Delete(':id/notes/:noteId')
  deleteNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('noteId') noteId: string) {
    return this.crm.deleteLeadNote(user.sub, id, noteId);
  }

  /** Import liste storiche (solo admin): un lotto per volta, con dry-run per l'anteprima. */
  @Roles('admin')
  @Post('import')
  @HttpCode(200)
  import(@CurrentUser() user: AuthUser, @Body() dto: ImportLeadsDto) {
    return this.crm.importRows(user.sub, dto.rows, dto.dryRun);
  }
}

/** Liste CRM: raggruppamenti manuali di lead/clienti. */
@Controller('crm/lists')
@Roles('coach', 'coach_coordinator', 'sales', 'head_nutritionist', 'admin')
export class CrmListsController {
  constructor(private readonly crm: CrmService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    // La coach vede i conteggi dei SOLI suoi lead (scope nel service).
    return this.crm.listLists(user.sub);
  }

  @Roles('admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCrmListDto) {
    return this.crm.createList(user.sub, dto);
  }

  @Roles('admin')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCrmListDto) {
    return this.crm.updateList(user.sub, id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.crm.deleteList(user.sub, id);
  }
}

/** Contabilità e dashboard. */
@Controller()
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly crm: CrmService,
  ) {}

  @Roles('admin')
  @Get('admin/commissions')
  commissions() {
    return this.finance.listCommissions();
  }

  @Roles('admin')
  @Delete('admin/commissions/:id')
  deleteCommission(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.finance.deleteCommission(id, actor.sub);
  }

  @Roles('admin')
  @Get('ledger')
  ledger(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
  ) {
    return this.finance.ledger({ from, to, type, category });
  }

  @Roles('sales', 'admin')
  @Get('dashboards/sales')
  sales() {
    return this.crm.salesDashboard();
  }

  @Roles('admin')
  @Get('dashboards/accounting')
  accounting() {
    return this.finance.accountingDashboard();
  }

  @Roles('admin', 'head_nutritionist')
  @Get('dashboards/compensation')
  compensation(@Query('period') period?: string) {
    return this.finance.compensationDashboard(period);
  }
}

/** Gestione negozio (admin): piani e prodotti/integratori. */
@Controller('admin/shop')
@Roles('admin')
export class AdminShopController {
  constructor(private readonly commerce: CommerceService) {}

  @Get('plans')
  plans() {
    return this.commerce.listAllPlans();
  }
  @Post('plans')
  createPlan(@CurrentUser() u: AuthUser, @Body() dto: CreatePlanDto) {
    return this.commerce.createPlan(u.sub, dto);
  }
  @Patch('plans/:id')
  updatePlan(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.commerce.updatePlan(u.sub, id, { ...dto } as Record<string, unknown>);
  }
  @HttpCode(200)
  @Delete('plans/:id')
  deletePlan(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.commerce.deletePlan(u.sub, id);
  }

  @Get('products')
  products() {
    return this.commerce.listAllProducts();
  }
  @Post('products')
  createProduct(@CurrentUser() u: AuthUser, @Body() dto: CreateProductDto) {
    return this.commerce.createProduct(u.sub, dto);
  }
  @Patch('products/:id')
  updateProduct(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.commerce.updateProduct(u.sub, id, { ...dto } as Record<string, unknown>);
  }
  @HttpCode(200)
  @Delete('products/:id')
  deleteProduct(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.commerce.deleteProduct(u.sub, id);
  }
}

/**
 * ABBONAMENTI: annullamento dalla scheda cliente (17/8, richiesta di Simone dal caso Polidoro).
 *
 * ⚠️ Controller suo e non dentro `admin/purchases`: un abbonamento non è un acquisto. Metterlo lì
 * avrebbe fatto sembrare l'annullamento una variante dello storno, che è esattamente la confusione
 * da evitare — quello tocca i soldi, questo tocca il piano.
 *
 * ⚠️ Era `@Roles('admin')`, «come lo storno e la cancellazione di un acquisto, che sono i suoi vicini
 * di casa per gravità». La gravità è giusta, il cancello no: chi gestisce i piani ogni giorno è il
 * **capo nutrizionista**, e dalla sua utenza il pulsante × non si vedeva nemmeno. Con `@Roles` fisso
 * l'unica strada era entrare come admin — cioè fare la cosa grave con l'utenza sbagliata, e nel
 * registro dell'annullamento sarebbe rimasto scritto «admin» invece del nome di chi ha deciso.
 *
 * Ora la chiave della matrice, `cancel_subscription`: **di default solo admin**, gli altri li abilita
 * Simone dalla tabella dei permessi, senza un rilascio. È lo stesso passaggio fatto l'11/8 per
 * «Entra come» (`impersonate`), per la ragione scritta in testa a `permissions/pages.ts` — un
 * pulsante governato dal codice è un pulsante che non si può dare a chi serve.
 */
@Controller('admin/subscriptions')
export class AdminSubscriptionsController {
  constructor(private readonly commerce: CommerceService) {}

  @RequirePage('cancel_subscription', 'manage')
  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() dto: CancelSubscriptionDto) {
    return this.commerce.annullaAbbonamento(id, user.sub, dto);
  }
}
