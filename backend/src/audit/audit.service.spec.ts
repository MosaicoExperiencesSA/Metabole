import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  const create = jest.fn();

  beforeEach(async () => {
    create.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: { auditLog: { create } } },
      ],
    }).compile();
    service = moduleRef.get(AuditService);
  });

  it('scrive la voce di audit', async () => {
    create.mockResolvedValue({});
    await service.log({ action: 'auth.login', actorId: 'u1', ipAddress: '1.2.3.4' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'auth.login', actorId: 'u1' }),
      }),
    );
  });

  it('non propaga mai gli errori di scrittura (l\'operazione principale non fallisce)', async () => {
    create.mockRejectedValue(new Error('db down'));
    await expect(service.log({ action: 'auth.login' })).resolves.toBeUndefined();
  });
});
