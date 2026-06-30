// Tipos e rótulos compartilhados entre as telas do admin do Legislativo.

// ─── Proposições ─────────────────────────────────────────────────────────────

/** Tipos de proposição aceitos pelo backend (CriarProposicaoDto.tipo). */
export const TIPOS_PROPOSICAO = [
  { v: 'pl_ordinaria', l: 'Projeto de Lei Ordinária' },
  { v: 'pl_complementar', l: 'Projeto de Lei Complementar' },
  { v: 'resolucao', l: 'Resolução' },
  { v: 'decreto_legislativo', l: 'Decreto Legislativo' },
  { v: 'requerimento', l: 'Requerimento' },
  { v: 'mocao', l: 'Moção' },
  { v: 'emenda', l: 'Emenda à Lei Orgânica' },
] as const;

export function rotuloTipoProposicao(t?: string | null): string {
  return TIPOS_PROPOSICAO.find((x) => x.v === t)?.l ?? t ?? '—';
}

/** Status (fase) válidos da proposição — espelha STATUS_PROPOSICAO do service. */
export const STATUS_PROPOSICAO = [
  { v: 'protocolada', l: 'Protocolada' },
  { v: 'em_comissao', l: 'Em comissão' },
  { v: 'pauta', l: 'Em pauta' },
  { v: 'aprovada', l: 'Aprovada' },
  { v: 'rejeitada', l: 'Rejeitada' },
  { v: 'arquivada', l: 'Arquivada' },
  { v: 'sancionada', l: 'Sancionada' },
  { v: 'promulgada', l: 'Promulgada' },
  { v: 'vetada', l: 'Vetada' },
] as const;

export function rotuloStatusProposicao(s?: string | null): string {
  return STATUS_PROPOSICAO.find((x) => x.v === s)?.l ?? s ?? '—';
}

/** Papéis de autoria de uma proposição. */
export const PAPEIS_AUTOR = [
  { v: 'autor', l: 'Autor' },
  { v: 'coautor', l: 'Coautor' },
  { v: 'relator', l: 'Relator' },
] as const;

export function rotuloPapelAutor(p?: string | null): string {
  return PAPEIS_AUTOR.find((x) => x.v === p)?.l ?? p ?? '—';
}

/** Opções de voto na votação nominal. */
export const OPCOES_VOTO = [
  { v: 'favoravel', l: 'Favorável' },
  { v: 'contrario', l: 'Contrário' },
  { v: 'abstencao', l: 'Abstenção' },
  { v: 'ausente', l: 'Ausente' },
] as const;

export function rotuloVoto(v?: string | null): string {
  return OPCOES_VOTO.find((x) => x.v === v)?.l ?? v ?? '—';
}

/** Tipos de emenda aceitos pelo backend (EmendaDto.tipo). */
export const TIPOS_EMENDA = [
  { v: 'aditiva', l: 'Aditiva' },
  { v: 'supressiva', l: 'Supressiva' },
  { v: 'modificativa', l: 'Modificativa' },
  { v: 'substitutiva', l: 'Substitutiva' },
  { v: 'aglutinativa', l: 'Aglutinativa' },
] as const;

export function rotuloTipoEmenda(t?: string | null): string {
  return TIPOS_EMENDA.find((x) => x.v === t)?.l ?? t ?? '—';
}

// ─── Leis ────────────────────────────────────────────────────────────────────

/** Tipos de lei aceitos pelo backend (CriarLeiDto.tipo). */
export const TIPOS_LEI = [
  { v: 'lei_ordinaria', l: 'Lei Ordinária' },
  { v: 'lei_complementar', l: 'Lei Complementar' },
  { v: 'resolucao', l: 'Resolução' },
  { v: 'decreto_legislativo', l: 'Decreto Legislativo' },
  { v: 'emenda_lei_organica', l: 'Emenda à Lei Orgânica' },
] as const;

export function rotuloTipoLei(t?: string | null): string {
  return TIPOS_LEI.find((x) => x.v === t)?.l ?? t ?? '—';
}

// ─── Shapes ──────────────────────────────────────────────────────────────────

/** Autor de uma proposição (ProposicaoAutor — detalhe admin, sem relação). */
export interface AutorAdmin {
  id: string;
  vereadorId: string;
  papel: string;
  ordem: number;
}

/** Tramitação (histórico append-only). */
export interface TramitacaoAdmin {
  id: string;
  fase: string;
  despacho?: string | null;
  comissaoId?: string | null;
  relatorId?: string | null;
  data: string;
  atorId?: string | null;
}

/** Voto individual de uma votação nominal. */
export interface VotoAdmin {
  id: string;
  vereadorId: string;
  voto: string;
}

/** Votação nominal (com apuração e votos). */
export interface VotacaoAdmin {
  id: string;
  sessaoId?: string | null;
  turno?: string | null;
  resultado: string;
  quorum?: string | null;
  favoraveis: number;
  contrarios: number;
  abstencoes: number;
  ausentes: number;
  data: string;
  votos: VotoAdmin[];
}

/** Emenda de uma proposição. */
export interface EmendaAdmin {
  id: string;
  numero?: number | null;
  tipo: string;
  texto?: string | null;
  autorId?: string | null;
  status: string;
}

/** Proposição como retornada pela lista admin (linha completa da tabela). */
export interface ProposicaoAdmin {
  id: string;
  tipo: string;
  numero?: number | null;
  ano?: number | null;
  protocolo?: string | null;
  ementa: string;
  texto?: string | null;
  pdfUrl?: string | null;
  storageKey?: string | null;
  statusAtual: string;
  autorPrincipalId?: string | null;
  dataProtocolo?: string | null;
  publicada: boolean;
  criadoEm?: string | null;
  atualizadoEm?: string | null;
}

/** Detalhe admin: proposição + autores + tramitações + votações + emendas. */
export interface ProposicaoDetalhe extends ProposicaoAdmin {
  autores: AutorAdmin[];
  tramitacoes: TramitacaoAdmin[];
  votacoes: VotacaoAdmin[];
  emendas: EmendaAdmin[];
}

/** Lei como retornada pela lista admin (linha completa da tabela). */
export interface LeiAdmin {
  id: string;
  numero: string;
  tipo: string;
  ano?: number | null;
  ementa: string;
  texto?: string | null;
  dataSancao?: string | null;
  proposicaoId?: string | null;
  pdfUrl?: string | null;
  storageKey?: string | null;
  vigente: boolean;
  publicada: boolean;
  criadoEm?: string | null;
  atualizadoEm?: string | null;
}
