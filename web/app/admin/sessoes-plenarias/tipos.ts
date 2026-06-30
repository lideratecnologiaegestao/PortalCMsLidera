// Tipos compartilhados entre as telas do admin de Sessões Plenárias.
//
// Shapes confirmados em api/src/modules/sessoes/sessoes.{dto,service}.ts e no
// schema Prisma (models Sessao, TipoSessao, SessaoPautaItem, SessaoPresenca,
// SessaoGravacao). O backend usa o prefixo /api/admin/sessoes.

/** Status possíveis de uma sessão (CriarSessaoDto.status). */
export const STATUS_SESSAO = [
  { v: 'agendada', l: 'Agendada' },
  { v: 'em_andamento', l: 'Em andamento' },
  { v: 'encerrada', l: 'Encerrada' },
  { v: 'cancelada', l: 'Cancelada' },
] as const;

export function rotuloStatusSessao(s?: string | null): string {
  return STATUS_SESSAO.find((x) => x.v === s)?.l ?? s ?? '—';
}

/** Cor (token de tema) do badge por status. */
export function corStatusSessao(s?: string | null): string {
  switch (s) {
    case 'em_andamento':
      return 'bg-success/10 text-success';
    case 'encerrada':
      return 'bg-primary/10 text-primary';
    case 'cancelada':
      return 'bg-danger/10 text-danger';
    default:
      return 'bg-muted text-fg/60';
  }
}

/** Situações de presença de um vereador (PresencaItemDto.situacao). */
export const SITUACOES_PRESENCA = [
  { v: 'presente', l: 'Presente' },
  { v: 'ausente', l: 'Ausente' },
  { v: 'justificado', l: 'Justificado' },
] as const;

export function rotuloSituacaoPresenca(s?: string | null): string {
  return SITUACOES_PRESENCA.find((x) => x.v === s)?.l ?? s ?? '—';
}

export function corSituacaoPresenca(s?: string | null): string {
  switch (s) {
    case 'presente':
      return 'bg-success/10 text-success';
    case 'justificado':
      return 'bg-primary/10 text-primary';
    case 'ausente':
      return 'bg-danger/10 text-danger';
    default:
      return 'bg-muted text-fg/60';
  }
}

/** Tipo de sessão (model TipoSessao). */
export interface TipoSessaoAdmin {
  id: string;
  nome: string;
  descricao?: string | null;
  ordem: number;
  ativo: boolean;
  criadoEm?: string | null;
  atualizadoEm?: string | null;
}

/** Referência enxuta do tipo, como vem incluída nas sessões. */
export interface TipoSessaoRef {
  id: string;
  nome: string;
}

/** Sessão como retornada pelos endpoints admin de lista (linha da tabela). */
export interface SessaoAdmin {
  id: string;
  tipoSessaoId?: string | null;
  titulo: string;
  dataHora: string;
  local?: string | null;
  status: string;
  quorum?: number | null;
  videoAoVivoUrl?: string | null;
  ataConteudo?: string | null;
  ataPublicadaEm?: string | null;
  eventoId?: string | null;
  criadoEm?: string | null;
  atualizadoEm?: string | null;
  tipoSessao?: TipoSessaoRef | null;
}

/** Item de pauta (model SessaoPautaItem). */
export interface PautaItemAdmin {
  id: string;
  sessaoId: string;
  titulo: string;
  descricao?: string | null;
  proposicaoId?: string | null;
  ordem: number;
  criadoEm?: string | null;
}

/** Presença com o vereador incluído (GET /admin/sessoes/:id). */
export interface PresencaAdmin {
  id: string;
  sessaoId: string;
  vereadorId: string;
  situacao: string;
  observacao?: string | null;
  criadoEm?: string | null;
  vereador?: { id: string; nomeParlamentar: string } | null;
}

/** Gravação / TV Câmara (model SessaoGravacao). */
export interface GravacaoAdmin {
  id: string;
  sessaoId: string;
  titulo: string;
  videoUrl?: string | null;
  storageKey?: string | null;
  duracao?: number | null;
  ordem: number;
  criadoEm?: string | null;
}

/** Detalhe da sessão (GET /admin/sessoes/:id) com pauta, presenças e gravações. */
export interface SessaoDetalhe extends SessaoAdmin {
  pautaItens: PautaItemAdmin[];
  presencas: PresencaAdmin[];
  gravacoes: GravacaoAdmin[];
}

/** Vereador (opção do seletor de presenças) — GET /admin/parlamentar/vereadores. */
export interface VereadorOpcao {
  id: string;
  nomeParlamentar: string;
  partido?: string | null;
}
