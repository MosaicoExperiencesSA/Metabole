import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from './roles.service';

describe('RolesService (ruoli personalizzati)', () => {
  let service: RolesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      customRole: {
        findMany: jest.fn().mockResolvedValue([
          { key: 'segreteria', label: 'Segreteria', color: '#b8863b', baseRole: 'sales' },
        ]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...data })),
        update: jest.fn().mockImplementation(({ data, where }: any) => Promise.resolve({ key: where.key, label: 'Segreteria', color: '#000000', baseRole: 'sales', ...data })),
        delete: jest.fn(),
      },
      rolePagePermission: {
        findMany: jest.fn().mockResolvedValue([
          { pageKey: 'dashboard', canView: true, canManage: false },
          { pageKey: 'crm_leads', canView: true, canManage: true },
        ]),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      user: { count: jest.fn().mockResolvedValue(2) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(RolesService);
  });

  it('listAll: ritorna i 5 ruoli staff di sistema + i personalizzati', async () => {
    const all = await service.listAll();
    const keys = all.map((r) => r.key);
    expect(keys).toEqual(expect.arrayContaining(['coach', 'nutritionist', 'head_nutritionist', 'sales', 'admin', 'segreteria']));
    expect(all.find((r) => r.key === 'admin')?.isSystem).toBe(true);
    expect(all.find((r) => r.key === 'segreteria')?.isSystem).toBe(false);
    expect(all.find((r) => r.key === 'segreteria')?.baseRole).toBe('sales');
  });

  it('create: genera la chiave dallo slug, richiede un ruolo di base valido, eredita i permessi', async () => {
    const created = await service.create({ label: 'Responsabile Marketing', baseRole: 'sales' }, 'admin-1');
    expect(created.key).toBe('responsabile_marketing');
    expect(created.baseRole).toBe('sales');
    // eredita i permessi del ruolo di base
    expect(prisma.rolePagePermission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ role: 'responsabile_marketing', pageKey: 'crm_leads', canManage: true })]) }),
    );
  });

  it('create: rifiuta un ruolo di base che non è di sistema', async () => {
    await expect(service.create({ label: 'X', baseRole: 'segreteria' }, 'admin-1')).rejects.toThrow(BadRequestException);
  });

  it('create: rifiuta un nome che collide con un ruolo di sistema', async () => {
    await expect(service.create({ label: 'coach', baseRole: 'coach' }, 'admin-1')).rejects.toThrow(BadRequestException);
  });

  it('remove: cancella permessi e ruolo, e riporta il conteggio degli utenti riassegnati', async () => {
    prisma.customRole.findUnique.mockResolvedValue({ key: 'segreteria', baseRole: 'sales' });
    const res = await service.remove('segreteria', 'admin-1');
    expect(prisma.rolePagePermission.deleteMany).toHaveBeenCalledWith({ where: { role: 'segreteria' } });
    expect(prisma.customRole.delete).toHaveBeenCalled();
    expect(res.reassigned).toBe(2);
  });

  it('effectiveKey: ruolo personalizzato se presente, altrimenti quello di sistema', () => {
    expect(service.effectiveKey({ role: 'sales', customRoleKey: 'segreteria' })).toBe('segreteria');
    expect(service.effectiveKey({ role: 'coach', customRoleKey: null })).toBe('coach');
  });
});
