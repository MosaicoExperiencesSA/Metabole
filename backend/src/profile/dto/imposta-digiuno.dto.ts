/**
 * QUELLO CHE L'APP MANDA QUANDO LA CLIENTE SPOSTA L'OROLOGIO.
 *
 * ⚠️ Due campi, tutti e due facoltativi: **spostare solo l'orario** e **cambiare solo il
 * protocollo** sono due gesti diversi sulla stessa schermata (si trascina la lancetta, oppure si
 * sceglie una durata), e obbligarli insieme costringerebbe l'app a rimandare indietro un valore che
 * non ha toccato — cioè a decidere per la cliente qualcosa che lei non ha deciso.
 *
 * ⛔ Quello che **non** c'è, ed è voluto: `fastingWindow`. Quali pasti riceve non si manda più da
 * qui — lo **deriva** l'orologio dalla durata (`menu/orologio-digiuno.ts`). Se questo DTO
 * l'accettasse, esisterebbero due modi di decidere la stessa cosa e prima o poi direbbero cose
 * diverse. La finestra resta scrivibile dalla scheda staff, che è un'altra porta con un'altra
 * ragione (una nutrizionista che corregge).
 */
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { VALORI_PROTOCOLLO_DIGIUNO } from '../../menu/orologio-digiuno';

export class ImpostaDigiunoDto {
  @IsOptional()
  @IsIn(VALORI_PROTOCOLLO_DIGIUNO, { message: 'Quel tipo di digiuno non è fra quelli che possiamo impostare.' })
  protocollo?: string;

  /**
   * Minuti da mezzanotte, `0`–`1439`. ⚠️ Minuti e non `"08:15"`: una stringa oraria va interpretata,
   * e l'interpretazione è il posto dove nascono i fusi sbagliati. Qui è un numero e basta.
   */
  @IsOptional()
  @IsInt({ message: 'Quell\'orario non esiste.' })
  @Min(0, { message: 'Quell\'orario non esiste.' })
  @Max(1439, { message: 'Quell\'orario non esiste.' })
  inizioMin?: number;
}
