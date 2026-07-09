import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigParamsService } from './config-params.service';

describe('ConfigParamsService', () => {
  let service: ConfigParamsService;
  let prisma: any;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      configParam: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConfigParamsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(ConfigParamsService);
  });

  it('legge un numero dalla tabella', async () => {
    prisma.configParam.findUnique.mockResolvedValue({ key: 'min_daily_kcal', value: '1200' });
    expect(await service.getNumber('min_daily_kcal')).toBe(1200);
  });

  it('usa la cache alla seconda lettura', async () => {
    prisma.configParam.findUnique.mockResolvedValue({ key: 'k', value: '5' });
    await service.getNumber('k');
    await service.getNumber('k');
    expect(prisma.configParam.findUnique).toHaveBeenCalledTimes(1);
  });

  it('parametro mancante senza fallback → errore esplicito', async () => {
    prisma.configParam.findUnique.mockResolvedValue(null);
    await expect(service.getNumber('sconosciuto')).rejects.toThrow(NotFoundException);
  });

  it('parametro mancante con fallback → fallback', async () => {
    prisma.configParam.findUnique.mockResolvedValue(null);
    expect(await service.getNumber('sconosciuto', 0.7)).toBe(0.7);
  });

  it('update invalida la cache e logga in audit', async () => {
    prisma.configParam.findUnique.mockResolvedValue({ key: 'k', value: '5' });
    await service.getNumber('k'); // in cache
    prisma.configParam.update.mockResolvedValue({ key: 'k', value: '9' });
    await service.update('k', '9', 'admin-1');

    prisma.configParam.findUnique.mockResolvedValue({ key: 'k', value: '9' });
    expect(await service.getNumber('k')).toBe(9); // rilegge dal db
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.config.update' }),
    );
  });
});
