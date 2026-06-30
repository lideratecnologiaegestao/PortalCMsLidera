import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

// ────────────────────────────────────────────────────── Tipo de sessão
export class CriarTipoSessaoDto {
  @IsString() @IsNotEmpty() nome!: string;
  @IsString() @IsOptional() descricao?: string;
  @IsInt() @IsOptional() ordem?: number;
  @IsBoolean() @IsOptional() ativo?: boolean;
}
export class AtualizarTipoSessaoDto extends CriarTipoSessaoDto {
  @IsString() @IsOptional() nome?: string;
}

// ───────────────────────────────────────────────────────────── Sessão
export class CriarSessaoDto {
  @IsString() @IsNotEmpty() titulo!: string;
  @IsString() @IsNotEmpty() dataHora!: string; // ISO 8601
  @IsString() @IsOptional() tipoSessaoId?: string;
  @IsString() @IsOptional() local?: string;
  @IsString() @IsOptional() status?: string; // agendada|em_andamento|encerrada|cancelada
  @IsInt() @IsOptional() quorum?: number;
  @IsString() @IsOptional() videoAoVivoUrl?: string;
  @IsString() @IsOptional() ataConteudo?: string;
  @IsString() @IsOptional() eventoId?: string;
}
export class AtualizarSessaoDto extends CriarSessaoDto {
  @IsString() @IsOptional() titulo?: string;
  @IsString() @IsOptional() dataHora?: string;
}

// ───────────────────────────────────────────────────────── Item de pauta
export class PautaItemDto {
  @IsString() @IsNotEmpty() titulo!: string;
  @IsString() @IsOptional() descricao?: string;
  @IsString() @IsOptional() proposicaoId?: string; // uuid simples, módulo independente
  @IsInt() @IsOptional() ordem?: number;
}
export class AtualizarPautaItemDto extends PautaItemDto {
  @IsString() @IsOptional() titulo?: string;
}

// ────────────────────────────────────────────────────────────── Presença
export class PresencaItemDto {
  @IsString() @IsNotEmpty() vereadorId!: string;
  @IsString() @IsOptional() situacao?: string; // presente|ausente|justificado
  @IsString() @IsOptional() observacao?: string;
}
/** Registro/atualização em lote da presença de uma sessão. */
export class RegistrarPresencasDto {
  @IsArray() @IsNotEmpty() presencas!: PresencaItemDto[];
}

// ──────────────────────────────────────────────────────────────── Ata
export class PublicarAtaDto {
  @IsString() @IsOptional() ataConteudo?: string;
  @IsBoolean() @IsOptional() publicar?: boolean; // true publica, false despublica
}

// ───────────────────────────────────────────────────────────── Gravação
export class GravacaoDto {
  @IsString() @IsNotEmpty() titulo!: string;
  @IsString() @IsOptional() videoUrl?: string;
  @IsString() @IsOptional() storageKey?: string;
  @IsInt() @IsOptional() duracao?: number;
  @IsInt() @IsOptional() ordem?: number;
}
