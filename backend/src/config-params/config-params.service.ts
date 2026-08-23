import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Accesso alle soglie del motore (tabella config_param).
 * Cache in memoria con TTL breve: i valori cambiano di rado ma non devono
 * mai essere hardcodati (specifica, sez. 0 e Appendice A).
 */
@Injectable()
export class ConfigParamsService {
  private readonly logger = new Logger(ConfigParamsService.name);
  private cache = new Map<string, { value: string; expiresAt: number }>();
  private readonly ttlMs = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getString(key: string, fallback?: string): Promise<string> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const row = await this.prisma.configParam.findUnique({ where: { key } });
    if (!row) {
      if (fallback !== undefined) return fallback;
      throw new NotFoundException(`Parametro di configurazione mancante: ${key}`);
    }
    this.cache.set(key, { value: row.value, expiresAt: Date.now() + this.ttlMs });
    return row.value;
  }

  /**
   * ⛔ **UNA CASELLA VUOTA NON È UNO ZERO** (24/8).
   *
   * `Number('')` fa **0**, e `Number('   ')` pure. Non è NaN: quindi il ripiego non scattava, il
   * `throw` nemmeno, e una riga di `config_param` svuotata dal back office diventava in silenzio
   * uno **zero** — un numero perfettamente credibile, che nessun log nominava.
   *
   * ⚠️ Su questi parametri lo zero **non è un valore neutro, è un interruttore**, e l'esempio che
   * costa di più è `menu_days_delivered`: a zero il ciclo è vuoto, `deliverIfEligible` compone zero
   * giornate ed esce da `if (daySnapshots.length === 0) return []` — che non scrive **niente da
   * nessuna parte**, per tutte le clienti insieme. Su `menu_visible_days_before_return` a zero si
   * perde l'anticipo del rientro: il menu del giorno di rientro arriva quel giorno stesso invece del
   * giorno prima.
   *
   * ⚠️ **E NO, questa non è la spiegazione del giallo del 23/8** — l'avevo scritto e me l'ha
   * smontato la revisione, misurandolo: con l'anticipo a zero la cliente **non resta ferma**, perché
   * il giorno del rientro la pausa non è più attiva e il ramo `pausaAppenaFinita` la ripesca ed
   * eroga. Il costo di quello zero è un giorno d'anticipo perso, non una persona senza menu. Il
   * giallo resta aperto e si legge col tabulato di `prova:erogazione`, non con un'ipotesi.
   *
   * ⚠️ E non basta ripiegare: **si scrive**. Un ripiego silenzioso su un parametro che decide se
   * una cliente domani mangia è la cosa peggiore delle due — «non lo so» deve costare meno di «ho
   * indovinato». Chi legge i log trova la chiave da sistemare, invece di un comportamento strano.
   */
  async getNumber(key: string, fallback?: number): Promise<number> {
    const raw = await this.getString(key, fallback?.toString());
    const vuoto = typeof raw !== 'string' || raw.trim() === '';
    const parsed = vuoto ? Number.NaN : Number(raw);
    if (Number.isNaN(parsed)) {
      if (fallback !== undefined) {
        this.logger.warn(
          `Parametro ${key} ${vuoto ? 'VUOTO' : `non numerico ("${raw}")`}: uso il ripiego ${fallback}. ` +
            'La riga in Parametri va sistemata — finché resta così, il valore vero non è quello scritto.',
        );
        return fallback;
      }
      throw new NotFoundException(`Parametro ${key} ${vuoto ? 'vuoto' : `non numerico: ${raw}`}`);
    }
    return parsed;
  }

  /**
   * ⛔ **E QUI IL DIFETTO COSTAVA PIÙ CHE ALTROVE** (24/8, seconda revisione).
   *
   * `raw === 'true' || raw === '1'` vuol dire che **tutto il resto è `false`**, in silenzio: una
   * casella vuota, `TRUE`, `True`, `si`, `yes`, `1.0`. Su ogni parametro il cui ripiego è `true`
   * questo è un interruttore che si spegne da solo e non lo dice a nessuno —
   * `payment_method_card_enabled` e `payment_method_bank_enabled` (un metodo di pagamento sparisce
   * dal carrello: nessuno paga e nessuno sa perché), `menu_kcal_need_enabled` (il target passa dal
   * fabbisogno alle kcal del livello, per tutte), la seconda lettura di Vera.
   *
   * ⚠️ Adesso: si normalizza (spazi e maiuscole), si accettano le forme che una persona scrive
   * davvero, e su una casella **vuota o incomprensibile** si ripiega **dicendolo**. Senza ripiego si
   * solleva, come per i numeri: «non lo so» deve costare meno di «ho indovinato».
   */
  async getBool(key: string, fallback?: boolean): Promise<boolean> {
    const raw = await this.getString(key, fallback === undefined ? undefined : String(fallback));
    const t = (typeof raw === 'string' ? raw : '').trim().toLowerCase();
    if (['true', '1', 'si', 'sì', 'yes', 'on'].includes(t)) return true;
    if (['false', '0', 'no', 'off'].includes(t)) return false;
    if (fallback !== undefined) {
      this.logger.warn(
        `Parametro ${key} ${t === '' ? 'VUOTO' : `non leggibile come sì/no ("${raw}")`}: uso il ripiego ${fallback}. ` +
          'La riga in Parametri va sistemata — finché resta così, il valore vero non è quello scritto.',
      );
      return fallback;
    }
    throw new NotFoundException(`Parametro ${key} ${t === '' ? 'vuoto' : `non leggibile come sì/no: ${raw}`}`);
  }

  async list() {
    return this.prisma.configParam.findMany({ orderBy: { key: 'asc' } });
  }

  /**
   * CREA un parametro nuovo. Serviva: finora esistevano solo lettura e aggiornamento di righe
   * che dovevano già esistere, quindi la promessa «configurabile dal backoffice» era vera solo
   * se qualcuno si ricordava di aggiungere la chiave al seed. Quando se ne dimenticava, il
   * sistema usava un default scritto nel codice e non lo diceva a nessuno: è successo due volte
   * (parametri del fabbisogno kcal, modello email delle credenziali).
   */
  async create(
    input: { key: string; value: string; type?: string; description?: string },
    actorId: string,
  ) {
    const key = (input.key ?? '').trim();
    if (!/^[a-z][a-z0-9_]{2,59}$/.test(key)) {
      throw new BadRequestException('Chiave non valida: minuscole, numeri e underscore, da 3 a 60 caratteri (es. menu_days_delivered).');
    }
    if ((input.value ?? '').trim() === '') throw new BadRequestException('Il valore non può essere vuoto.');
    const exists = await this.prisma.configParam.findUnique({ where: { key }, select: { key: true } });
    if (exists) throw new ConflictException(`Il parametro "${key}" esiste già: modificalo dall'elenco.`);
    const type = ['number', 'string', 'boolean', 'json'].includes(input.type ?? '') ? (input.type as string) : 'string';
    const created = await this.prisma.configParam.create({
      data: { key, value: input.value, type: type as never, description: input.description?.trim() || null, updatedById: actorId } as never,
    });
    this.cache.delete(key);
    await this.audit.log({
      action: 'config_param.create',
      actorId,
      entityType: 'config_param',
      entityId: key,
      metadata: { value: input.value, type },
    });
    return created;
  }

  async update(key: string, value: string, actorId: string) {
    const existing = await this.prisma.configParam.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException(`Parametro inesistente: ${key}`);
    /**
     * ⛔ **E LA CASELLA NON SI PUÒ SVUOTARE** (24/8).
     *
     * ⚠️ **Cosa aggiunge davvero, misurato in revisione**: dal back office `UpdateConfigDto.value` ha
     * già `@MinLength(1)`, quindi una stringa vuota era **già** rifiutata — la prima stesura di
     * questo commento diceva il contrario ed era falsa. Quello che passava, e che adesso non passa
     * più, sono i **soli spazi**: `'   '` supera `@MinLength(1)`, arriva in tabella, e `Number('   ')`
     * fa zero. Resta poi la porta che nessun DTO copre — una `UPDATE` scritta a mano sul database.
     *
     * ⚠️ **La guardia sta dove si scrive**, non solo dove si legge. E il messaggio non consiglia di
     * scrivere `0`: su `menu_days_delivered` uno zero spegne l'erogazione **per tutte** da un'uscita
     * muta, e un suggerimento in un messaggio d'errore lo si segue senza rileggerlo.
     */
    if ((value ?? '').trim() === '') {
      throw new BadRequestException(
        'Il valore non può essere vuoto: una casella vuota (o di soli spazi) viene letta come 0 e non lo ' +
          'dice a nessuno. Scrivi il numero che vuoi — e attenzione che su alcuni parametri lo zero ' +
          'spegne davvero la funzione, quindi mettilo solo se è quello che vuoi.',
      );
    }
    const updated = await this.prisma.configParam.update({
      where: { key },
      data: { value, updatedById: actorId },
    });
    this.cache.delete(key);
    await this.audit.log({
      action: 'admin.config.update',
      actorId,
      entityType: 'config_param',
      entityId: key,
      metadata: { from: existing.value, to: value },
    });
    return updated;
  }
}
