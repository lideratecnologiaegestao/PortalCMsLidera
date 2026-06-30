import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

// ───────────────────────────────────────────────────────────── Edital
export class CriarEditalDto {
  @IsString() @IsNotEmpty() numero!: string;
  @IsString() @IsNotEmpty() titulo!: string;
  @IsString() @IsOptional() slug?: string;
  @IsString() @IsOptional() objeto?: string;
  @IsString() @IsOptional() status?: string; // rascunho|publicado|inscricoes_abertas|...
  @IsString() @IsOptional() inscricaoInicio?: string; // ISO datetime
  @IsString() @IsOptional() inscricaoFim?: string;
  @IsInt() @IsOptional() ordem?: number;
  @IsBoolean() @IsOptional() ativo?: boolean;
}

export class AtualizarEditalDto extends CriarEditalDto {
  @IsString() @IsOptional() numero?: string;
  @IsString() @IsOptional() titulo?: string;
}

// ──────────────────────────────────────────────────────────────── Vaga
export class VagaDto {
  @IsString() @IsNotEmpty() cargo!: string;
  @IsString() @IsOptional() escolaridade?: string;
  @IsInt() @IsOptional() quantidade?: number;
  @IsInt() @IsOptional() vagasCadastro?: number;
  @IsString() @IsOptional() requisitos?: string;
  @IsString() @IsOptional() cargaHoraria?: string;
  @IsNumber() @IsOptional() salario?: number;
  @IsInt() @IsOptional() ordem?: number;
}

// ──────────────────────────────────────────────────────────────── Fase
export class FaseDto {
  @IsString() @IsNotEmpty() nome!: string;
  @IsString() @IsOptional() tipo?: string; // inscricao|prova_objetiva|prova_pratica|entrevista|titulos|experiencia
  @IsNumber() @IsOptional() peso?: number;
  @IsBoolean() @IsOptional() eliminatoria?: boolean;
  @IsNumber() @IsOptional() notaCorte?: number;
  @IsInt() @IsOptional() ordem?: number;
}

// ─────────────────────────────────────────────────────────────── Critério
export class CriterioDto {
  @IsString() @IsNotEmpty() descricao!: string;
  @IsNumber() @IsOptional() pontos?: number;
  @IsNumber() @IsOptional() pontosMaximo?: number;
  @IsInt() @IsOptional() ordem?: number;
}

// ───────────────────────────────────────────────────── Inscrição (cidadão)
export class InscreverDto {
  @IsString() @IsOptional() vagaId?: string;
  @IsString() @IsNotEmpty() nome!: string;
  @IsString() @IsOptional() cpf?: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() telefone?: string;
  @IsObject() @IsOptional() dados?: Record<string, unknown>;
  // critérios declarados: títulos/experiência informados pelo candidato
  @IsArray() @IsOptional() criterios?: { criterioId: string; quantidade?: number; observacao?: string }[];
  // anexos enviados (documentos do candidato)
  @IsArray() @IsOptional() anexos?: { titulo: string; url?: string; storageKey?: string }[];
}

// ─────────────────────────────────────────────── Inscrição (admin/comissão)
export class AtualizarInscricaoDto {
  @IsString() @IsOptional() status?: string; // recebida|deferida|indeferida|cancelada
  @IsString() @IsOptional() motivo?: string;
}

// ──────────────────────────────────────────────────── Notas (comissão)
export class LancarNotaDto {
  @IsString() @IsNotEmpty() inscricaoId!: string;
  @IsString() @IsNotEmpty() faseId!: string;
  @IsNumber() nota!: number;
  @IsString() @IsOptional() observacao?: string;
}

// ──────────────────────────────────────────────────────────── Anexos
export class AnexoEditalDto {
  @IsString() @IsNotEmpty() titulo!: string;
  @IsString() @IsOptional() tipo?: string; // edital|anexo|retificacao|documento_candidato
  @IsString() @IsOptional() url?: string;
  @IsString() @IsOptional() storageKey?: string;
  @IsInt() @IsOptional() ordem?: number;
}

// ─────────────────────────────────────────────── APLIC: abertura/retificação
export class AberturaRetificacaoDto {
  @IsString() @IsOptional() tipo?: string; // abertura|retificacao
  @IsInt() @IsOptional() versao?: number;
  @IsString() @IsOptional() dataAto?: string;
  @IsString() @IsOptional() descricao?: string;
  @IsString() @IsOptional() url?: string;
  @IsString() @IsOptional() storageKey?: string;
}

// ──────────────────────────────────────── APLIC: membro da comissão
export class ComissaoMembroDto {
  @IsString() @IsOptional() userId?: string;
  @IsString() @IsNotEmpty() nome!: string;
  @IsString() @IsOptional() cpf?: string;
  @IsString() @IsOptional() cargo?: string; // presidente|membro|suplente|secretario
  @IsInt() @IsOptional() ordem?: number;
}

// ─────────────────────────────────── APLIC: tabela salarial
export class TabelaSalarialDto {
  @IsString() @IsOptional() vagaId?: string;
  @IsString() @IsOptional() codigo?: string;
  @IsString() @IsNotEmpty() cargo!: string;
  @IsString() @IsOptional() nivel?: string;
  @IsString() @IsOptional() classe?: string;
  @IsNumber() @IsOptional() salarioBase?: number;
  @IsString() @IsOptional() cargaHoraria?: string;
  @IsInt() @IsOptional() ordem?: number;
}
