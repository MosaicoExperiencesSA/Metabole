import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSocialPostDto,
  UpdateSocialPostDto,
} from './dto/social.dto';
import { GiudiceService } from './giudice.service';
import { VIGNETTE_CATALOG } from './vignette-catalog.data';

/**
 * Agente Publisher (foundation). Macchina a stati del post social:
 *   draft → judged → approved → (scheduled) → published   (oppure rejected)
 * Il Giudice è un gate obbligatorio: si approva solo un post che PASSA.
 * La pubblicazione automatica sui social (Instagram/Facebook) e l'export PNG da
 * Canva richiedono credenziali non ancora presenti → per ora la pubblicazione si
 * REGISTRA a mano (`markPublished`); l'auto-publish sarà un'integrazione successiva.
 */
@Injectable()
export class PublisherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly giudice: GiudiceService,
  ) {}

  list(filter: { status?: string; channel?: string }) {
    return this.prisma.socialPost.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.channel ? { channel: filter.channel } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async get(id: string) {
    const p = await this.prisma.socialPost.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Post non trovato');
    return p;
  }

  async create(userId: string, dto: CreateSocialPostDto) {
    const created = await this.prisma.socialPost.create({
      data: {
        channel: dto.channel,
        caption: dto.caption,
        hashtags: dto.hashtags ?? [],
        collectionId: dto.collectionId ?? null,
        imageRef: dto.imageRef ?? null,
        imageSource: dto.imageSource ?? null,
        status: 'draft',
        createdById: userId,
      },
    });
    await this.audit.log({ action: 'social.create', actorId: userId, entityType: 'social_post', entityId: created.id });
    return created;
  }

  /**
   * Importa le collezioni "pronta" dallo snapshot del catalogo vignette come bozze.
   * Idempotente: salta le collezioni già importate (match per collectionId).
   */
  async importFromCatalog(userId: string) {
    const already = await this.prisma.socialPost.findMany({
      where: { collectionId: { in: VIGNETTE_CATALOG.map((v) => v.collectionId) } },
      select: { collectionId: true },
    });
    const have = new Set(already.map((e: { collectionId: string | null }) => e.collectionId));
    let imported = 0;
    for (const v of VIGNETTE_CATALOG) {
      if (have.has(v.collectionId)) continue;
      await this.prisma.socialPost.create({
        data: {
          channel: v.channel,
          caption: v.caption,
          hashtags: v.hashtags,
          collectionId: v.collectionId,
          imageRef: v.imageRef,
          imageSource: v.imageSource,
          status: 'draft',
          createdById: userId,
        },
      });
      imported++;
    }
    await this.audit.log({ action: 'social.import', actorId: userId, entityType: 'social_post', entityId: 'catalog', metadata: { imported } });
    return { imported, skipped: VIGNETTE_CATALOG.length - imported, total: VIGNETTE_CATALOG.length };
  }

  async update(userId: string, id: string, dto: UpdateSocialPostDto) {
    const post = await this.get(id);
    if (post.status === 'published') throw new BadRequestException('Un post pubblicato non si modifica.');
    const data: Record<string, unknown> = {};
    if (dto.channel !== undefined) data.channel = dto.channel;
    if (dto.caption !== undefined) data.caption = dto.caption;
    if (dto.hashtags !== undefined) data.hashtags = dto.hashtags;
    if (dto.imageRef !== undefined) data.imageRef = dto.imageRef;
    if (dto.imageSource !== undefined) data.imageSource = dto.imageSource;
    // ogni modifica ai contenuti invalida il giudizio precedente
    if (dto.caption !== undefined || dto.hashtags !== undefined) {
      data.status = 'draft';
      data.judgePass = null;
      data.judgeIssues = undefined;
    }
    const updated = await this.prisma.socialPost.update({ where: { id }, data: data as never });
    await this.audit.log({ action: 'social.update', actorId: userId, entityType: 'social_post', entityId: id });
    return updated;
  }

  /** Gate compliance: esegue il Giudice e registra l'esito. */
  async judge(userId: string, id: string) {
    const post = await this.get(id);
    const result = this.giudice.check({ caption: post.caption, hashtags: post.hashtags });
    const updated = await this.prisma.socialPost.update({
      where: { id },
      data: {
        status: 'judged',
        judgePass: result.pass,
        judgeIssues: result.issues as never,
      },
    });
    await this.audit.log({ action: 'social.judge', actorId: userId, entityType: 'social_post', entityId: id, metadata: { pass: result.pass } });
    return updated;
  }

  /** Approva SOLO se il Giudice è passato (se non è stato ancora giudicato, lo giudica ora). */
  async approve(userId: string, id: string) {
    let post = await this.get(id);
    if (post.judgePass === null || post.judgePass === undefined || post.status === 'draft') {
      post = await this.judge(userId, id);
    }
    if (!post.judgePass) {
      throw new BadRequestException('Il post non ha passato il Giudice: correggi i problemi segnalati prima di approvare.');
    }
    const updated = await this.prisma.socialPost.update({ where: { id }, data: { status: 'approved' } });
    await this.audit.log({ action: 'social.approve', actorId: userId, entityType: 'social_post', entityId: id });
    return updated;
  }

  async schedule(userId: string, id: string, at: string) {
    const post = await this.get(id);
    if (post.status !== 'approved' && post.status !== 'scheduled') {
      throw new BadRequestException('Si programma solo un post approvato.');
    }
    const updated = await this.prisma.socialPost.update({
      where: { id },
      data: { status: 'scheduled', scheduledAt: new Date(at) },
    });
    await this.audit.log({ action: 'social.schedule', actorId: userId, entityType: 'social_post', entityId: id });
    return updated;
  }

  /**
   * Registra la pubblicazione. Finché non ci sono le credenziali social, la
   * pubblicazione è manuale: l'operatore pubblica il post e lo segna qui (con
   * l'eventuale id del post sulla piattaforma). Guardia: solo post approvati.
   */
  async markPublished(userId: string, id: string, externalId?: string) {
    const post = await this.get(id);
    if (post.status !== 'approved' && post.status !== 'scheduled') {
      throw new BadRequestException('Si pubblica solo un post approvato (che ha passato il Giudice).');
    }
    if (!post.judgePass) throw new BadRequestException('Post non conforme: non pubblicabile.');
    const updated = await this.prisma.socialPost.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date(), externalId: externalId ?? null },
    });
    await this.audit.log({ action: 'social.publish', actorId: userId, entityType: 'social_post', entityId: id, metadata: { externalId } });
    return updated;
  }

  async reject(userId: string, id: string) {
    await this.get(id);
    const updated = await this.prisma.socialPost.update({ where: { id }, data: { status: 'rejected' } });
    await this.audit.log({ action: 'social.reject', actorId: userId, entityType: 'social_post', entityId: id });
    return updated;
  }

  async remove(userId: string, id: string) {
    await this.get(id);
    await this.prisma.socialPost.delete({ where: { id } });
    await this.audit.log({ action: 'social.delete', actorId: userId, entityType: 'social_post', entityId: id });
    return { ok: true };
  }
}
