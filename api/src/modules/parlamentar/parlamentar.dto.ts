import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

// ─────────────────────────────────────────────────────────── Vereador
export class CriarVereadorDto {
  @IsString() @IsNotEmpty() nome!: string;
  @IsString() @IsNotEmpty() nomeParlamentar!: string;
  @IsString() @IsOptional() slug?: string;
  @IsString() @IsOptional() userId?: string;
  @IsString() @IsOptional() partido?: string;
  @IsString() @IsOptional() status?: string; // ativo|licenciado|afastado|inativo
  @IsString() @IsOptional() legislatura?: string;
  @IsString() @IsOptional() mandatoInicio?: string; // YYYY-MM-DD
  @IsString() @IsOptional() mandatoFim?: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() telefone?: string;
  @IsString() @IsOptional() fotoUrl?: string;
  @IsString() @IsOptional() biografia?: string;
  @IsObject() @IsOptional() redes?: Record<string, string>;
  @IsInt() @IsOptional() ordem?: number;
  @IsBoolean() @IsOptional() ativo?: boolean;
}

export class AtualizarVereadorDto extends PartialType(CriarVereadorDto) {}

// ─────────────────────────────────────────────────── Mesa Diretora
export class CargoMesaDto {
  @IsString() @IsNotEmpty() vereadorId!: string;
  @IsString() @IsNotEmpty() cargo!: string; // presidente|vice_presidente|primeiro_secretario|segundo_secretario|corregedor|outro
  @IsString() @IsNotEmpty() inicio!: string; // YYYY-MM-DD
  @IsString() @IsOptional() fim?: string;
  @IsString() @IsOptional() legislatura?: string;
  @IsInt() @IsOptional() ordem?: number;
}

// ──────────────────────────────────────────────────────── Comissão
export class CriarComissaoDto {
  @IsString() @IsNotEmpty() nome!: string;
  @IsString() @IsOptional() slug?: string;
  @IsString() @IsOptional() tipo?: string; // permanente|temporaria|cpi|especial
  @IsString() @IsOptional() descricao?: string;
  @IsString() @IsOptional() legislatura?: string;
  @IsInt() @IsOptional() ordem?: number;
  @IsBoolean() @IsOptional() ativo?: boolean;
}
export class AtualizarComissaoDto extends PartialType(CriarComissaoDto) {}

export class CargoComissaoDto {
  @IsString() @IsNotEmpty() vereadorId!: string;
  @IsString() @IsOptional() cargo?: string; // presidente|vice_presidente|relator|membro
  @IsString() @IsOptional() inicio?: string;
  @IsString() @IsOptional() fim?: string;
  @IsInt() @IsOptional() ordem?: number;
}

export class ComissaoDocumentoDto {
  @IsString() @IsNotEmpty() titulo!: string;
  @IsString() @IsOptional() arquivoUrl?: string;
  @IsString() @IsOptional() storageKey?: string;
  @IsInt() @IsOptional() ordem?: number;
}

// ───────────────────────────────────────── Posts e Representações
export class VereadorPostDto {
  @IsString() @IsOptional() titulo?: string;
  @IsString() @IsOptional() conteudo?: string;
  @IsBoolean() @IsOptional() publicado?: boolean;
  @IsArray() @IsOptional() midias?: { tipo?: string; url?: string; storageKey?: string; ordem?: number }[];
}

export class RepresentacaoDto {
  @IsString() @IsOptional() tipo?: string; // sugestao|denuncia|oficio|requerimento|outro
  @IsString() @IsNotEmpty() assunto!: string;
  @IsString() @IsOptional() descricao?: string;
  @IsString() @IsOptional() status?: string;
}
