import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TestimonialsService } from './testimonials.service';

describe('TestimonialsService', () => {
  let service: TestimonialsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      testimonial: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 't1', ...data })),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 't1', ...data })),
        delete: jest.fn().mockResolvedValue({ id: 't1' }),
        count: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TestimonialsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(TestimonialsService);
  });

  it('listPublic: chiede solo le pubblicate e mappa i campi per il sito', async () => {
    prisma.testimonial.findMany.mockResolvedValue([
      { id: 't1', name: 'Martina', age: 41, text: 'Seguita davvero', photo: null },
      { id: 't2', name: 'Elena', age: null, text: 'Con gusto', photo: 'x.jpg' },
    ]);
    const out = await service.listPublic('it');
    expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { published: true, locale: 'it' } }),
    );
    expect(out).toEqual([
      { name: 'Martina', age: 41, text: 'Seguita davvero', photo: undefined },
      { name: 'Elena', age: undefined, text: 'Con gusto', photo: 'x.jpg' },
    ]);
  });

  it('create: applica i default (published true, locale it, source backoffice)', async () => {
    const created = await service.create('admin1', { name: 'Giulia', text: 'In mani sicure' } as any);
    expect(created).toEqual(
      expect.objectContaining({ published: true, locale: 'it', source: 'backoffice', order: 0 }),
    );
  });

  it('update/remove: 404 se la testimonianza non esiste', async () => {
    prisma.testimonial.findUnique.mockResolvedValue(null);
    await expect(service.update('admin1', 'missing', { text: 'x' })).rejects.toThrow(NotFoundException);
    await expect(service.remove('admin1', 'missing')).rejects.toThrow(NotFoundException);
  });
});
