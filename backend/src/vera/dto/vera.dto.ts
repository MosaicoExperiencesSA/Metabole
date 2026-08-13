import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Quanto può essere lunga una frase dettata. Oltre non è una regola: è un incollato. */
const MAX_FRASE = 2000;

export class AnteprimaPoolDto {
  @IsString()
  clientId!: string;

  /**
   * I nomi di alimento da escludere in più. Già risolti: il dizionario traduce «formaggi molli»
   * nei nove nomi PRIMA di arrivare qui, così questo endpoint non indovina niente.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  termini?: string[];
}

export class InsegnaFamigliaDto {
  @IsString()
  @MaxLength(120)
  nome!: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'Serve almeno un alimento: una famiglia vuota non esclude niente.' })
  @IsString({ each: true })
  membri!: string[];
}

export class ScriviAzioneDto {
  @IsString()
  @MaxLength(MAX_FRASE)
  frase!: string;

  @IsIn(['restrizione_cliente', 'sostituzione_cliente', 'variante_cliente', 'ricetta_modificata', 'ricetta_nuova', 'regola_dieta', 'voce_dizionario'])
  azione!: string;

  @IsIn(['cliente', 'dieta', 'catalogo'])
  ambito!: string;

  @IsIn(['user', 'diet', 'recipe'])
  soggettoTipo!: string;

  @IsOptional()
  @IsString()
  soggettoId?: string;

  @IsOptional()
  @IsString()
  soggettoNome?: string;

  @IsOptional()
  dettaglio?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  inApprovazione?: boolean;

  @IsOptional()
  @IsBoolean()
  conflittoSanitario?: boolean;
}

export class MessaggioVeraDto {
  @IsString()
  @MaxLength(MAX_FRASE)
  testo!: string;
}

export class RespingiDto {
  /**
   * ⚠️ Obbligatorio, e con un minimo di lunghezza. Un no senza motivo è la cosa che insegna a
   * smettere di proporre — e chi ha dettato la frase lo legge per capire cosa cambiare.
   */
  @IsString()
  @MinLength(3, { message: 'Serve un motivo: un no senza spiegazione insegna a non proporre più.' })
  @MaxLength(MAX_FRASE)
  motivo!: string;
}
