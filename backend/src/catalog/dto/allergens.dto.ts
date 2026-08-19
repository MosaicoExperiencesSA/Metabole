import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsString } from 'class-validator';
import { EU_ALLERGEN_CODES } from '../allergens';

export class SetRecipeAllergensDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(EU_ALLERGEN_CODES, { each: true })
  allergens!: string[];
}

/**
 * Conferma in blocco: solo gli id.
 *
 * ⚠️ **Gli allergeni non si mandano da fuori.** Il senso del gesto è «di queste mi fido del
 * riconoscitore»: se l'elenco arrivasse dal browser, una pagina vecchia — o un rilascio in cui il
 * riconoscitore è migliorato — scriverebbe in banca dati allergeni calcolati chissà quando, sulla
 * cosa dove sbagliare fa più male. Si ricalcolano sul server, dagli ingredienti di adesso.
 *
 * ⚠️ Il tetto è **500 per chiamata** e non è un dettaglio di prestazioni: un `PATCH` che ne tocca
 * quattromila in una volta o va a buon fine tutto o si perde tutto, e non c'è modo di dire alla
 * persona a che punto era. A scaglioni, quello che è confermato resta confermato.
 */
export class ConfermaAllergeniInBloccoDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids!: string[];
}
