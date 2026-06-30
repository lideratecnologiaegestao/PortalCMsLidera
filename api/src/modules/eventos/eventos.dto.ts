import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

// ──────────────────────────────────────────────────────────── Evento (admin)
export class CriarEventoDto {
  @IsString() @IsNotEmpty() titulo!: string;
  @IsString() @IsOptional() slug?: string;
  @IsString() @IsOptional() tipo?: string; // audiencia_publica|palestra|seminario|solenidade|outro
  @IsString() @IsOptional() descricao?: string;
  @IsString() @IsNotEmpty() dataHora!: string; // ISO
  @IsString() @IsOptional() dataFim?: string;
  @IsString() @IsOptional() local?: string;
  @IsString() @IsOptional() onlineUrl?: string;
  @IsInt() @IsOptional() vagas?: number;
  @IsString() @IsOptional() capaUrl?: string;
  @IsBoolean() @IsOptional() certificavel?: boolean;
  @IsBoolean() @IsOptional() inscricoesAbertas?: boolean;
  @IsString() @IsOptional() sessaoId?: string; // vínculo opcional a sessão L2 (uuid simples)
  @IsBoolean() @IsOptional() publicado?: boolean;
  @IsBoolean() @IsOptional() ativo?: boolean;
}

export class AtualizarEventoDto extends CriarEventoDto {
  @IsString() @IsOptional() titulo?: string;
  @IsString() @IsOptional() dataHora?: string;
}

// ─────────────────────────────────────────────────────── Inscrição (público)
export class InscreverDto {
  @IsString() @IsNotEmpty() nome!: string;
  @IsEmail() @IsNotEmpty() email!: string;
  @IsString() @IsOptional() telefone?: string;
  @IsString() @IsOptional() documento?: string; // CPF p/ certificado
}

// ──────────────────────────────────────────────── Gestão de inscrição (admin)
export class AtualizarInscricaoDto {
  @IsString() @IsOptional() status?: string; // confirmada|lista_espera|cancelada
  @IsBoolean() @IsOptional() presente?: boolean;
}
