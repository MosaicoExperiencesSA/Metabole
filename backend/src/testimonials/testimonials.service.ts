import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestimonialDto, UpdateTestimonialDto } from './dto/testimonial.dto';

/**
 * Testimonianze del sito. Il pubblico vede solo quelle `published`, nel formato
 * che il sito si aspetta ({ name, age?, text, photo? }). Il backoffice (admin)
 * le gestisce: crea/modifica/pubblica/rimuove.
 */
@Injectable()
export class TestimonialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** SITO (data-testimonials-endpoint): solo pubblicate, ordinate. */
  async listPublic(locale?: string) {
    const rows = await this.prisma.testimonial.findMany({
      where: { published: true, ...(locale ? { locale } : {}) },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(
      (t: { name: string; age: number | null; text: string; photo: string | null }) => ({
        name: t.name,
        age: t.age ?? undefined,
        text: t.text,
        photo: t.photo ?? undefined,
      }),
    );
  }

  /** BACKOFFICE: tutte, incluse le non pubblicate. */
  adminList() {
    return this.prisma.testimonial.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateTestimonialDto) {
    const created = await this.prisma.testimonial.create({
      data: {
        name: dto.name,
        text: dto.text,
        age: dto.age ?? null,
        photo: dto.photo ?? null,
        locale: dto.locale ?? 'it',
        published: dto.published ?? true,
        order: dto.order ?? 0,
        source: dto.source ?? 'backoffice',
      },
    });
    await this.audit.log({
      action: 'testimonial.create',
      actorId: userId,
      entityType: 'testimonial',
      entityId: created.id,
    });
    return created;
  }

  async update(userId: string, id: string, dto: UpdateTestimonialDto) {
    await this.getOr404(id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.text !== undefined) data.text = dto.text;
    if (dto.age !== undefined) data.age = dto.age;
    if (dto.photo !== undefined) data.photo = dto.photo;
    if (dto.locale !== undefined) data.locale = dto.locale;
    if (dto.published !== undefined) data.published = dto.published;
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.source !== undefined) data.source = dto.source;
    const updated = await this.prisma.testimonial.update({ where: { id }, data });
    await this.audit.log({
      action: 'testimonial.update',
      actorId: userId,
      entityType: 'testimonial',
      entityId: id,
    });
    return updated;
  }

  async remove(userId: string, id: string) {
    await this.getOr404(id);
    await this.prisma.testimonial.delete({ where: { id } });
    await this.audit.log({
      action: 'testimonial.delete',
      actorId: userId,
      entityType: 'testimonial',
      entityId: id,
    });
    return { ok: true };
  }

  private async getOr404(id: string) {
    const found = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Testimonianza non trovata');
    return found;
  }
}
