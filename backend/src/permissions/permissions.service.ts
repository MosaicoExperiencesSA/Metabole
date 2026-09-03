import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { isSystemRole } from '../common/roles';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import {
  BACKOFFICE_PAGES, DEFAULT_ESPLICITI, DEFAULT_PERMISSIONS, INHERIT_DEFAULTS, NON_EREDITANO, PageKey,
} from './pages';
import { type Decisione, righeDaCreare } from './eredita-dal-genitore';

@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly roles: RolesService,
  ) {}

  /**
   * All'avvio auto-ripara la matrice permessi: crea le righe MANCANTI dei ruoli di
   * sistema dai default (es. sezioni aggiunte dopo il seed → non comparivano nel menu).
   * NON tocca le righe esistenti, quindi le modifiche dell'admin restano intatte.
   */
  async onModuleInit(): Promise<void> {
    try {
      const { created } = await this.syncDefaults();
      if (created) this.logger.log(`Permessi: create ${created} righe di default mancanti`);
    } catch (err) {
      this.logger.warn(`Sync permessi all'avvio non riuscito: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async syncDefaults(): Promise<{ created: number }> {
    /**
     * ⛔ **SI LEGGONO ANCHE `canView`/`canManage`, non solo le chiavi** (2/9).
     *
     * Servono per l'ereditarietà vera: una pagina figlia nuova deve nascere dalla **riga** del
     * genitore — quello che l'admin ha davvero deciso — e non dal **default del codice**.
     * `INHERIT_DEFAULTS` promette che «separare una schermata nei Permessi non toglie accesso a
     * nessuno», e finché la riga nasceva dal default la promessa era falsa nei due versi: a chi
     * aveva la pagina accesa a mano spariva, e ⛔ **a chi l'aveva spenta a mano tornava** — che è il
     * verso che nessuno segnala, perché un accesso in più non fa reclamare nessuno.
     */
    const existing = (await this.prisma.rolePagePermission.findMany({
      select: { role: true, pageKey: true, canView: true, canManage: true },
    })) as { role: string; pageKey: string; canView: boolean; canManage: boolean }[];
    const have = new Set(existing.map((e) => `${e.role}:${e.pageKey}`));
    const righe = new Map(existing.map((e) => [`${e.role}:${e.pageKey}`, e]));
    /**
     * ⚠️ **La chiave si costruisce col ruolo, e il ruolo lo chiude chi chiama.** La prima stesura
     * passava `(role, pageKey)` al modulo: la mutazione che cercava la riga del genitore **di un
     * altro ruolo** — la coach che eredita la riga dell'admin — passava verde. Con il ruolo chiuso
     * qui, quella mutazione non si può nemmeno scrivere senza cambiare questa riga.
     */
    const rigaDiRuolo = (role: string) => (pageKey: string) => righe.get(`${role}:${pageKey}`) ?? null;
    const perm = (def: { view?: true; manage?: true } | undefined) =>
      (def ? { canView: !!def.view, canManage: !!def.manage } : null);
    const defaultDi = (ruoloDeiDefault: string) => (pageKey: string) =>
      perm(DEFAULT_PERMISSIONS[ruoloDeiDefault as keyof typeof DEFAULT_PERMISSIONS]?.[pageKey as PageKey]);
    /** ⛔ Solo i default SCRITTI A MANO: quelli sintetizzati dall'eredità non hanno precedenza. */
    const espliciti = (ruoloDeiDefault: string) => (pageKey: string) =>
      perm(DEFAULT_ESPLICITI[ruoloDeiDefault]?.[pageKey as PageKey]);
    const mancanti = (role: string) => BACKOFFICE_PAGES.filter((k) => !have.has(`${role}:${k}`));
    const opzioni = (ruoloDeiDefault: string) =>
      ({ nonEreditano: NON_EREDITANO, defaultEsplicitoDi: espliciti(ruoloDeiDefault) });

    const decisioni: Decisione[] = [];
    for (const role of Object.keys(DEFAULT_PERMISSIONS)) {
      decisioni.push(...righeDaCreare(
        role, mancanti(role), INHERIT_DEFAULTS, rigaDiRuolo(role), defaultDi(role), opzioni(role),
      ));
    }
    // Anche i ruoli PERSONALIZZATI ricevono le sezioni aggiunte dopo la loro creazione: le righe
    // esistenti non vengono toccate, e le nuove ereditano dalla riga del genitore **di quel ruolo**
    // — ⚠️ non da quella del ruolo di base, che è un altro ruolo e può avere altri permessi. Il
    // default del ruolo di base resta il ripiego quando il genitore non ha ancora una riga sua.
    const customRoles = (await this.prisma.customRole.findMany({
      select: { key: true, baseRole: true },
    })) as { key: string; baseRole: string }[];
    for (const custom of customRoles) {
      decisioni.push(...righeDaCreare(
        custom.key, mancanti(custom.key), INHERIT_DEFAULTS,
        rigaDiRuolo(custom.key), defaultDi(custom.baseRole), opzioni(custom.baseRole),
      ));
    }

    const toCreate = decisioni.map((d) => ({
      role: d.role, pageKey: d.pageKey, canView: d.canView, canManage: d.canManage,
    }));
    /**
     * ⚠️ `skipDuplicates` è la **rete**, non il controllo. `have` è costruita dalla banca dati, non
     * da `BACKOFFICE_PAGES`: se in quell'elenco una pagina comparisse due volte, i due giri qui
     * sopra metterebbero in coda la stessa coppia `[role, pageKey]` due volte, e la chiave composta
     * farebbe fallire la `createMany` — al seed, cioè all'avvio. Il controllo vero sta nei test
     * (`common/elenchi-senza-doppioni.spec.ts`), che è il momento in cui la riga si incolla; questo
     * serve perché una riga incollata male non spenga il backoffice.
     */
    const esito = toCreate.length
      ? await this.prisma.rolePagePermission.createMany({ data: toCreate, skipDuplicates: true })
      : { count: 0 };
    /**
     * ⛔ **`esito.count`, non `toCreate.length`.** Erano le righe **proposte**, non quelle scritte:
     * con due istanze su Render che partono insieme, tutte e due annunciavano «create N righe»
     * mentre `skipDuplicates` ne faceva scrivere N a una sola. Un numero che conta i tentativi,
     * stampato accanto a una traccia di permessi, è peggio di nessun numero.
     */
    const created = typeof esito?.count === 'number' ? esito.count : toCreate.length;

    /**
     * ⛔ **CHI EREDITA LASCIA UNA RIGA NEL REGISTRO, non solo nel log.**
     *
     * Un permesso che compare senza che nessuno l'abbia acceso dev'essere rintracciabile mesi dopo,
     * e i log di Render non lo sono. La prima stesura scriveva solo `logger.log`, per giunta
     * tagliato a venti righe proprio nel caso grosso. `AuditService` era già iniettato qui e regge
     * un `actorId` nullo di proposito: la riga di registro era a portata di mano.
     *
     * ⚠️ **Una riga sola con l'elenco dentro**, non una per permesso: sono decine, e trenta righe di
     * registro identiche a ogni avvio renderebbero illeggibile la pagina che dovrebbero servire.
     *
     * ⚠️ **E solo se qualcosa è stato scritto davvero** (`created > 0`): l'istanza che ha perso la
     * corsa con `skipDuplicates` non deve lasciare una traccia di permessi che non ha creato.
     */
    const ereditate = decisioni.filter((d) => d.provenienza === 'riga del genitore');
    if (ereditate.length && created > 0) {
      const quali = ereditate.map((d) =>
        `${d.role}:${d.pageKey}←${d.genitore}(${d.canView ? 'v' : '-'}${d.canManage ? 'g' : '-'})`);
      this.logger.log(`Permessi: ${ereditate.length} righe nuove ereditate dalla riga del genitore — ${quali.slice(0, 20).join(' ')}${ereditate.length > 20 ? ' …' : ''}`);
      await this.audit.log({
        action: 'admin.permissions.inherited',
        entity: 'RolePagePermission',
        entityId: 'sync',
        metadata: { quante: ereditate.length, righe: quali },
      } as never);
    }
    return { created };
  }

  /** Matrice completa: elenco ruoli (sistema + personalizzati) + permessi per ruolo. */
  async getMatrix() {
    const [rows, roleList] = await Promise.all([
      this.prisma.rolePagePermission.findMany({ orderBy: [{ role: 'asc' }, { pageKey: 'asc' }] }),
      this.roles.listAll(),
    ]);
    const byRole: Record<string, { pageKey: string; canView: boolean; canManage: boolean }[]> = {};
    for (const row of rows) {
      (byRole[row.role] ??= []).push({
        pageKey: row.pageKey,
        canView: row.canView,
        canManage: row.canManage,
      });
    }
    return { pages: BACKOFFICE_PAGES, roles: roleList, matrix: byRole };
  }

  /** Permessi del ruolo EFFETTIVO dell'utente (per costruire il menu del frontend). */
  async getForRole(effectiveRole: string) {
    const rows = await this.prisma.rolePagePermission.findMany({
      where: { role: effectiveRole, canView: true },
      orderBy: { pageKey: 'asc' },
      select: { pageKey: true, canView: true, canManage: true },
    });
    return { role: effectiveRole, pages: rows };
  }

  async update(
    input: { role: string; pageKey: string; canView?: boolean; canManage?: boolean },
    actorId: string,
  ) {
    const valid = await this.roles.validKeys();
    if (!valid.has(input.role)) {
      throw new BadRequestException(`Ruolo sconosciuto: ${input.role}`);
    }
    if (!BACKOFFICE_PAGES.includes(input.pageKey as PageKey)) {
      throw new BadRequestException(`Sezione sconosciuta: ${input.pageKey}`);
    }
    // Anti-lockout: l'admin (ruolo di sistema) non può perdere la gestione permessi.
    if (input.role === 'admin' && input.pageKey === 'permissions') {
      throw new BadRequestException(
        'I permessi dell\'admin sulla gestione permessi non sono modificabili (protezione anti-lockout).',
      );
    }

    const existing = await this.prisma.rolePagePermission.findUnique({
      where: { role_pageKey: { role: input.role, pageKey: input.pageKey } },
    });
    const updated = await this.prisma.rolePagePermission.upsert({
      where: { role_pageKey: { role: input.role, pageKey: input.pageKey } },
      create: {
        role: input.role,
        pageKey: input.pageKey,
        canView: input.canView ?? false,
        canManage: input.canManage ?? false,
        updatedById: actorId,
      },
      update: {
        ...(input.canView !== undefined ? { canView: input.canView } : {}),
        ...(input.canManage !== undefined ? { canManage: input.canManage } : {}),
        updatedById: actorId,
      },
    });
    await this.audit.log({
      action: 'admin.permissions.update',
      actorId,
      entityType: 'role_page_permission',
      entityId: `${input.role}:${input.pageKey}`,
      metadata: {
        system: isSystemRole(input.role),
        from: existing ? { canView: existing.canView, canManage: existing.canManage } : null,
        to: { canView: updated.canView, canManage: updated.canManage },
      },
    });
    return updated;
  }
}
