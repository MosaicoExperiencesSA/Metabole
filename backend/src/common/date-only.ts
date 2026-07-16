import { BadRequestException } from '@nestjs/common';

/** Normalizza a mezzanotte UTC (colonna DATE). Helper puro, senza dipendenze
 *  di dominio: sta qui (non in signals.service) per evitare cicli di import. */
export function toDateOnly(input?: string): Date {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Data non valida');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
