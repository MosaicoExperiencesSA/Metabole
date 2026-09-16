import { BadRequestException, ForbiddenException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { decryptBuffer, deriveKey, encryptBuffer } from '../health-area/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  AllegatoInArrivo,
  contentDisposition,
  linkFirmato,
  siVedeInBolla,
  valutaAllegato,
  verificaFirma,
} from './allegati-chat';

/** L'allegato già controllato e cifrato, pronto per essere scritto insieme al messaggio. */
export interface AllegatoPronto {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  data: Uint8Array<ArrayBuffer>;
}

/** Com'è un allegato dentro un messaggio letto: mai il contenuto, sempre il link. */
export interface AllegatoLetto {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  immagine: boolean;
  url: string;
}

type ConAllegati = { attachments?: { id: string; fileName: string; mimeType: string; sizeBytes: number }[] };

/**
 * ⛔ **GLI ALLEGATI DELLE CHAT — cifrati come i documenti sanitari** (Simone, 16/9).
 *
 * Stessa cifratura e stessa chiave di `DocumentsService` (`FILE_ENCRYPTION_KEY`, AES-256-GCM, dentro
 * il database in UE): in una conversazione con la nutrizionista una foto è un dato sanitario quanto
 * un referto, e due modi diversi di custodirli sarebbero due posti dove sbagliare.
 *
 * ⚠️ **Il contenuto non esce mai in una lista.** `listMessages` legge solo nome, tipo e peso, e qui
 * ci si aggiunge il link firmato. Il file si decifra solo quando qualcuno lo apre, e ogni apertura
 * dello staff finisce nell'audit — come per le conversazioni.
 */
@Injectable()
export class AllegatiChatService {
  private readonly logger = new Logger(AllegatiChatService.name);
  private readonly chiave: Buffer;
  private readonly segreto: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    const k = this.config.get<string>('FILE_ENCRYPTION_KEY');
    if (!k && process.env.NODE_ENV === 'production') {
      throw new Error("FILE_ENCRYPTION_KEY mancante: configurarla nelle variabili d'ambiente");
    }
    this.chiave = deriveKey(k ?? 'dev-only-file-key');
    const s = this.config.get<string>('CHAT_FILES_SECRET') ?? this.config.get<string>('JWT_ACCESS_SECRET');
    if (!s && process.env.NODE_ENV === 'production') {
      throw new Error('CHAT_FILES_SECRET/JWT_ACCESS_SECRET mancante: serve a firmare i link degli allegati.');
    }
    this.segreto = s ?? 'dev-only-chat-files';
  }

  /** Controlla e cifra. Lancia 400 con la frase da leggere se il file non va. */
  prepara(a: AllegatoInArrivo): AllegatoPronto {
    const esito = valutaAllegato(a);
    if (!esito.ok) throw new BadRequestException(esito.messaggio);
    return {
      fileName: esito.nome,
      mimeType: esito.tipo,
      sizeBytes: esito.contenuto.length,
      // ⚠️ Una copia su un `ArrayBuffer` suo: il tipo `Bytes` di Prisma non accetta un Buffer condiviso.
      data: Uint8Array.from(encryptBuffer(esito.contenuto, this.chiave)),
    };
  }

  /** Al posto dei metadati grezzi, gli allegati come li legge una pagina: con il link. */
  conLink<T extends object>(messaggio: T, utente: string, base: string, adessoMs = Date.now()): Omit<T, 'attachments'> & { allegati: AllegatoLetto[] } {
    // ⚠️ Anche un messaggio senza `attachments` (la risposta di Gaia): esce con `allegati: []`.
    const { attachments, ...resto } = messaggio as T & ConAllegati;
    return {
      ...resto,
      allegati: (attachments ?? []).map((a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        immagine: siVedeInBolla(a.mimeType),
        url: linkFirmato(base, this.segreto, a.id, utente, adessoMs),
      })),
    };
  }

  /**
   * Apre il file di un link firmato. `puoLeggere` è il cancello delle conversazioni
   * (`ChatService.puoLeggereIlThread`): si ricontrolla ADESSO, non ci si fida di quando il link è
   * stato chiesto — nel frattempo la cliente può essere stata assegnata a un'altra coach.
   */
  async apri(
    id: string,
    q: { e?: string; u?: string; s?: string },
    puoLeggere: (utente: AuthUser, threadId: string) => Promise<boolean>,
    adessoMs = Date.now(),
  ): Promise<{ contenuto: Buffer; tipo: string; disposizione: string }> {
    const firma = verificaFirma(this.segreto, id, q, adessoMs);
    if (!firma.ok) {
      if (firma.scaduto) throw new GoneException('Il link è scaduto: riapri la conversazione e tocca di nuovo il file.');
      throw new ForbiddenException('Link non valido.');
    }
    const a = (await this.prisma.messageAttachment.findUnique({
      where: { id },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        data: true,
        message: { select: { id: true, threadId: true, deletedAt: true, thread: { select: { clientId: true } } } },
      },
    })) as {
      id: string; fileName: string; mimeType: string; data: Uint8Array;
      message: { id: string; threadId: string; deletedAt: Date | null; thread: { clientId: string } };
    } | null;
    // ⚠️ Un messaggio cancellato dal suo autore sparisce con il suo allegato: stessa regola delle letture.
    if (!a || a.message.deletedAt) throw new NotFoundException('File non trovato.');

    const u = (await this.prisma.user.findFirst({
      // ⚠️ Anche `status: 'active'`: un utente sospeso non apre più niente, nemmeno dai link già dati.
      where: { id: firma.utente, deletedAt: null, status: 'active' } as never,
      select: { id: true, role: true },
    })) as { id: string; role: string } | null;
    if (!u) throw new ForbiddenException('Link non valido.');
    const utente = { sub: u.id, role: u.role } as AuthUser;
    if (!(await puoLeggere(utente, a.message.threadId))) throw new ForbiddenException('Non hai accesso a questo file.');

    if (u.role !== 'client') {
      await this.audit
        .log({
          action: 'chat.attachment_opened',
          actorId: u.id,
          entityType: 'message_attachment',
          entityId: a.id,
          metadata: { threadId: a.message.threadId, clientId: a.message.thread.clientId, role: u.role },
        })
        .catch(() => undefined);
    }
    let contenuto: Buffer;
    try {
      contenuto = decryptBuffer(Buffer.from(a.data), this.chiave);
    } catch (e) {
      // ⚠️ Non muto: una chiave cambiata su Render renderebbe illeggibili TUTTI gli allegati.
      this.logger.error(`Allegato ${a.id} non decifrabile: ${String(e)}`);
      throw new GoneException('Il file non è più leggibile.');
    }
    return { contenuto, tipo: a.mimeType, disposizione: contentDisposition(a.mimeType, a.fileName) };
  }
}
