import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { DEFAULT_PERMISSIONS } from './pages';
import { PermissionsService } from './permissions.service';

describe('Matrice permessi (default da specifica sez. 4)', () => {
  it('la coach NON vede i documenti sanitari', () => {
    expect(DEFAULT_PERMISSIONS.coach.health_documents).toBeUndefined();
  });

  it('il commerciale NON vede dati sanitari né clienti', () => {
    expect(DEFAULT_PERMISSIONS.sales.health_documents).toBeUndefined();
    expect(DEFAULT_PERMISSIONS.sales.clients).toBeUndefined();
    expect(DEFAULT_PERMISSIONS.sales.crm_leads).toEqual({ view: true, manage: true });
  });

  it('l\'admin NON accede ai documenti sanitari di default', () => {
    expect(DEFAULT_PERMISSIONS.admin.health_documents).toBeUndefined();
    expect(DEFAULT_PERMISSIONS.admin.users).toEqual({ view: true, manage: true });
  });

  it('nutrizionista e capo gestiscono cartelle e documenti sanitari', () => {
    expect(DEFAULT_PERMISSIONS.nutritionist.health_documents).toEqual({ view: true, manage: true });
    expect(DEFAULT_PERMISSIONS.head_nutritionist.diets_catalog).toEqual({ view: true, manage: true });
  });

  it('il ruolo client non ha alcuna pagina di backoffice', () => {
    expect(Object.keys(DEFAULT_PERMISSIONS.client)).toHaveLength(0);
  });
});

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: any;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      rolePagePermission: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ role: 'coach', pageKey: 'crm_leads', canView: true, canManage: false }),
      },
    };
    audit = { log: jest.fn() };
    const roles = {
      // sistema + un ruolo personalizzato di prova
      validKeys: jest.fn().mockResolvedValue(new Set(['coach', 'nutritionist', 'head_nutritionist', 'sales', 'admin', 'client', 'segreteria'])),
      listAll: jest.fn().mockResolvedValue([]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: RolesService, useValue: roles },
      ],
    }).compile();
    service = moduleRef.get(PermissionsService);
  });

  it('aggiorna un permesso e logga in audit', async () => {
    await service.update({ role: 'coach', pageKey: 'crm_leads', canView: true }, 'admin-1');
    expect(prisma.rolePagePermission.upsert).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.permissions.update' }),
    );
  });

  it('syncDefaults crea solo le righe mancanti dai default (Parametri/Chat inclusi)', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 0 });
    const p2 = {
      rolePagePermission: {
        findMany: jest.fn().mockResolvedValue([]), // nessuna riga esistente
        createMany,
      },
      customRole: {
        findMany: jest.fn().mockResolvedValue([{ key: 'segreteria', baseRole: 'sales' }]),
      },
    };
    const svc = new PermissionsService(p2 as never, { log: jest.fn() } as never, {} as never);
    const res = await svc.syncDefaults();
    expect(res.created).toBeGreaterThan(0);
    const data = createMany.mock.calls[0][0].data as { role: string; pageKey: string; canView: boolean }[];
    const adminEngine = data.find((d) => d.role === 'admin' && d.pageKey === 'engine_config');
    expect(adminEngine?.canView).toBe(true); // Parametri torna visibile all'admin
    // il ruolo personalizzato eredita i default del ruolo di base per le sezioni nuove
    const customPosta = data.find((d) => d.role === 'segreteria' && d.pageKey === 'posta');
    expect(customPosta?.canView).toBe(true);
    const customUsers = data.find((d) => d.role === 'segreteria' && d.pageKey === 'users');
    expect(customUsers?.canView).toBe(false);
    // non ricrea righe già presenti
    (p2.rolePagePermission.findMany as jest.Mock).mockResolvedValue([{ role: 'admin', pageKey: 'engine_config' }]);
    createMany.mockClear();
    await svc.syncDefaults();
    const data2 = createMany.mock.calls[0][0].data as { pageKey: string; role: string }[];
    expect(data2.find((d) => d.role === 'admin' && d.pageKey === 'engine_config')).toBeUndefined();
  });

  it('rifiuta una sezione sconosciuta', async () => {
    await expect(
      service.update({ role: 'coach', pageKey: 'pagina_inventata', canView: true }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('anti-lockout: i permessi admin sulla gestione permessi non si toccano', async () => {
    await expect(
      service.update({ role: 'admin', pageKey: 'permissions', canView: false }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('getForRole restituisce solo le pagine visibili', async () => {
    prisma.rolePagePermission.findMany.mockResolvedValue([
      { pageKey: 'dashboard', canView: true, canManage: false },
    ]);
    const result = await service.getForRole('coach');
    expect(prisma.rolePagePermission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'coach', canView: true } }),
    );
    expect(result.pages).toHaveLength(1);
  });
});
