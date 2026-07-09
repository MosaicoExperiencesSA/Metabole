import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
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
    const moduleRef = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
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
