import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

// ───────────────────────────────────────────────────────── Autores
export class AutorDto {
  @IsString() @IsNotEmpty() vereadorId!: string;
  @IsString() @IsOptional() papel?: string; // autor | coautor | relator
  @IsInt() @IsOptional() ordem?: number;
}

// ──────────────────────────────────────────────────────── Proposição
export class CriarProposicaoDto {
  @IsString() @IsNotEmpty() tipo!: string; // pl_ordinaria | pl_complementar | resolucao | decreto_legislativo | requerimento | mocao | emenda
  @IsString() @IsNotEmpty() ementa!: string;
  @IsInt() @IsOptional() numero?: number;
  @IsInt() @IsOptional() ano?: number;
  @IsString() @IsOptional() protocolo?: string;
  @IsString() @IsOptional() texto?: string;
  @IsString() @IsOptional() pdfUrl?: string;
  @IsString() @IsOptional() storageKey?: string;
  @IsString() @IsOptional() statusAtual?: string;
  @IsString() @IsOptional() autorPrincipalId?: string; // vereador (L1)
  @IsString() @IsOptional() dataProtocolo?: string; // YYYY-MM-DD
  @IsBoolean() @IsOptional() publicada?: boolean;
  @IsArray() @ValidateNested({ each: true }) @Type(() => AutorDto) @IsOptional()
  autores?: AutorDto[];
}

export class AtualizarProposicaoDto extends PartialType(CriarProposicaoDto) {}

// ──────────────────────────────────────────────────────── Tramitação
export class TramitarDto {
  @IsString() @IsNotEmpty() fase!: string; // novo status_atual
  @IsString() @IsOptional() despacho?: string;
  @IsString() @IsOptional() comissaoId?: string;
  @IsString() @IsOptional() relatorId?: string;
  @IsString() @IsOptional() data?: string; // ISO datetime
}

// ──────────────────────────────────────────────────────── Votação
export class VotoDto {
  @IsString() @IsNotEmpty() vereadorId!: string;
  @IsString() @IsNotEmpty() voto!: string; // favoravel | contrario | abstencao | ausente
}

export class RegistrarVotacaoDto {
  @IsString() @IsOptional() sessaoId?: string; // sessao (L2)
  @IsString() @IsOptional() turno?: string;
  @IsString() @IsOptional() quorum?: string;
  @IsString() @IsOptional() data?: string; // ISO datetime
  @IsArray() @ValidateNested({ each: true }) @Type(() => VotoDto) @IsNotEmpty()
  votos!: VotoDto[];
}

// ──────────────────────────────────────────────────────── Emenda
export class EmendaDto {
  @IsInt() @IsOptional() numero?: number;
  @IsString() @IsOptional() tipo?: string; // aditiva | supressiva | modificativa | substitutiva | aglutinativa
  @IsString() @IsOptional() texto?: string;
  @IsString() @IsOptional() autorId?: string;
  @IsString() @IsOptional() status?: string;
}

// ──────────────────────────────────────────────────────── Lei
export class CriarLeiDto {
  @IsString() @IsNotEmpty() numero!: string;
  @IsString() @IsNotEmpty() ementa!: string;
  @IsString() @IsOptional() tipo?: string; // lei_ordinaria | lei_complementar | resolucao | decreto_legislativo | emenda_lei_organica
  @IsInt() @IsOptional() ano?: number;
  @IsString() @IsOptional() texto?: string;
  @IsString() @IsOptional() dataSancao?: string; // YYYY-MM-DD
  @IsString() @IsOptional() proposicaoId?: string;
  @IsString() @IsOptional() pdfUrl?: string;
  @IsString() @IsOptional() storageKey?: string;
  @IsBoolean() @IsOptional() vigente?: boolean;
  @IsBoolean() @IsOptional() publicada?: boolean;
}

export class AtualizarLeiDto extends PartialType(CriarLeiDto) {}
