import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { decryptBuffer, deriveKey, encryptBuffer } from './crypto.util';
import { VisitsService } from './visits.service';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'];

/**
 * Documenti sanitari: cifrati AES-256-GCM, dentro il database (UE).
 * Accesso: la cliente ai propri; nutrizionista assegnato e capo ai pazienti.
 * La coach NON li vede mai (spec sez. 4). Ogni accesso finisce in audit.
 */
@Injectable()
export class DocumentsService {
  private readonly key: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly visits: VisitsService,
  ) {
    const secret = this.config.get<string>('FILE_ENCRYPTION_KEY');
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('FILE_ENCRYPTION_KEY mancante: configurarla nelle variabili d\'ambiente');
    }
    this.key = deriveKey(secret ?? 'dev-only-file-key');
  }

  async upload(
    clientId: string,
    input: { type: string; fileName: string; mimeType: string; contentBase64: string },
  ) {
    if (!ALLOWED_MIME.includes(input.mimeType)) {
      throw new BadRequestException(`Formato non supportato: ${input.mimeType} (ammessi: PDF, JPEG, PNG, HEIC)`);
    }
    let plain: Buffer;
    try {
      plain = Buffer.from(input.contentBase64, 'base64');
    } catch {
      throw new BadRequestException('Contenuto non valido (base64 atteso)');
    }
    if (plain.length === 0 || plain.length > MAX_SIZE_BYTES) {
      throw new BadRequestException('Dimensione file non valida (max 10 MB)');
    }

    const document = await this.prisma.document.create({
      data: {
        clientId,
        type: input.type as never,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: plain.length,
        // Uint8Array puro: il tipo Bytes del client Prisma non accetta Buffer direttamente.
        data: new Uint8Array(encryptBuffer(plain, this.key)),
      },
      select: { id: true, type: true, fileName: true, sizeBytes: true, status: true, uploadedAt: true },
    });
    await this.audit.log({
      action: 'health.document.upload',
      actorId: clientId,
      entityType: 'document',
      entityId: document.id,
      metadata: { type: input.type, sizeBytes: plain.length },
    });
    return document;
  }

  async listForClient(clientId: string) {
    return this.prisma.document.findMany({
      where: { clientId },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        type: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        flags: true,
        reviewNote: true,
        uploadedAt: true,
      },
    });
  }

  /** Download decifrato: la cliente per i propri, lo staff sanitario per i pazienti. */
  async download(user: AuthUser, documentId: string) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Documento non trovato');
    await this.assertDocumentAccess(user, document.clientId);

    await this.audit.log({
      action: 'health.document.download',
      actorId: user.sub,
      entityType: 'document',
      entityId: documentId,
      metadata: { clientId: document.clientId, role: user.role },
    });
    return {
      fileName: document.fileName,
      mimeType: document.mimeType,
      contentBase64: decryptBuffer(Buffer.from(document.data as unknown as Uint8Array), this.key).toString('base64'),
    };
  }

  /** Revisione del nutrizionista: flags (es. valore fuori range) → alert. */
  async review(
    user: AuthUser,
    documentId: string,
    input: { flags?: string[]; reviewNote?: string },
  ) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Documento non trovato');
    const staff = await this.visits.assertPatientAccess(user, document.clientId);

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'reviewed',
        flags: input.flags ?? [],
        reviewNote: input.reviewNote,
        reviewedById: staff.id,
      },
      select: { id: true, status: true, flags: true, reviewNote: true },
    });
    await this.audit.log({
      action: 'health.document.review',
      actorId: user.sub,
      entityType: 'document',
      entityId: documentId,
      metadata: { flags: input.flags },
    });
    return updated;
  }

  async listForPatient(user: AuthUser, clientId: string) {
    await this.visits.assertPatientAccess(user, clientId);
    return this.listForClient(clientId);
  }

  private async assertDocumentAccess(user: AuthUser, ownerClientId: string): Promise<void> {
    if (user.role === 'client') {
      if (user.sub !== ownerClientId) throw new ForbiddenException('Non è un tuo documento');
      return;
    }
    if (user.role === 'nutritionist' || user.role === 'head_nutritionist') {
      await this.visits.assertPatientAccess(user, ownerClientId);
      return;
    }
    // Coach, sales, admin: MAI accesso ai documenti sanitari (spec sez. 4).
    throw new ForbiddenException('I documenti sanitari sono riservati a cliente e staff sanitario');
  }
}
