// Tipos compartilhados entre as telas do admin de PSS (Processo Seletivo Simplificado).
// Os shapes seguem os retornos do api/src/modules/pss/pss.service.ts.

/** Status do edital aceitos/usados pelo backend. */
export const STATUS_EDITAL = [
  { v: 'rascunho', l: 'Rascunho' },
  { v: 'publicado', l: 'Publicado' },
  { v: 'inscricoes_abertas', l: 'Inscrições abertas' },
  { v: 'inscricoes_encerradas', l: 'Inscrições encerradas' },
  { v: 'em_avaliacao', l: 'Em avaliação' },
  { v: 'homologado', l: 'Homologado' },
] as const;

export function rotuloStatusEdital(s?: string | null): string {
  return STATUS_EDITAL.find((x) => x.v === s)?.l ?? s ?? '—';
}

/** Tipos de fase (FaseDto.tipo). */
export const TIPOS_FASE = [
  { v: 'inscricao', l: 'Inscrição' },
  { v: 'prova_objetiva', l: 'Prova objetiva' },
  { v: 'prova_pratica', l: 'Prova prática' },
  { v: 'entrevista', l: 'Entrevista' },
  { v: 'titulos', l: 'Títulos' },
  { v: 'experiencia', l: 'Experiência' },
] as const;

export function rotuloTipoFase(t?: string | null): string {
  return TIPOS_FASE.find((x) => x.v === t)?.l ?? t ?? '—';
}

/** Status de uma inscrição (AtualizarInscricaoDto.status). */
export const STATUS_INSCRICAO = [
  { v: 'recebida', l: 'Recebida' },
  { v: 'deferida', l: 'Deferida' },
  { v: 'indeferida', l: 'Indeferida' },
  { v: 'cancelada', l: 'Cancelada' },
] as const;

export function rotuloStatusInscricao(s?: string | null): string {
  return STATUS_INSCRICAO.find((x) => x.v === s)?.l ?? s ?? '—';
}

/** Tipo de abertura/retificação (AberturaRetificacaoDto.tipo). */
export const TIPOS_ABERTURA = [
  { v: 'abertura', l: 'Abertura' },
  { v: 'retificacao', l: 'Retificação' },
] as const;

/** Cargo do membro da comissão (ComissaoMembroDto.cargo). */
export const CARGOS_COMISSAO = [
  { v: 'presidente', l: 'Presidente' },
  { v: 'membro', l: 'Membro' },
  { v: 'suplente', l: 'Suplente' },
  { v: 'secretario', l: 'Secretário(a)' },
] as const;

// ─── Shapes do backend ───────────────────────────────────────────────────────

/** Linha da lista paginada admin (GET /admin/pss/editais). */
export interface EditalAdmin {
  id: string;
  numero: string;
  titulo: string;
  slug?: string | null;
  objeto?: string | null;
  status: string;
  inscricaoInicio?: string | null;
  inscricaoFim?: string | null;
  rankingPublicado?: boolean;
  rankingPublicadoEm?: string | null;
  ordem: number;
  ativo: boolean;
  criadoEm?: string | null;
}

export interface VagaAdmin {
  id: string;
  cargo: string;
  escolaridade?: string | null;
  quantidade?: number | null;
  vagasCadastro?: number | null;
  requisitos?: string | null;
  cargaHoraria?: string | null;
  salario?: number | string | null;
  ordem: number;
}

export interface CriterioAdmin {
  id: string;
  faseId: string;
  descricao: string;
  pontos?: number | string | null;
  pontosMaximo?: number | string | null;
  ordem: number;
}

export interface FaseAdmin {
  id: string;
  nome: string;
  tipo?: string | null;
  peso?: number | string | null;
  eliminatoria?: boolean;
  notaCorte?: number | string | null;
  ordem: number;
  criterios?: CriterioAdmin[];
}

export interface AnexoAdmin {
  id: string;
  titulo: string;
  tipo?: string | null;
  url?: string | null;
  storageKey?: string | null;
  inscricaoId?: string | null;
  ordem: number;
}

/** Detalhe completo (GET /admin/pss/editais/:id) com sub-recursos. */
export interface EditalDetalhe extends EditalAdmin {
  vagas: VagaAdmin[];
  fases: FaseAdmin[];
  anexos: AnexoAdmin[];
}

export interface NotaAdmin {
  id: string;
  inscricaoId: string;
  faseId: string;
  nota: number | string;
  observacao?: string | null;
}

export interface InscricaoCriterioAdmin {
  id: string;
  criterioId: string;
  quantidade?: number | null;
  observacao?: string | null;
  criterio?: {
    id: string;
    descricao: string;
    pontos?: number | string | null;
    pontosMaximo?: number | string | null;
    faseId: string;
  } | null;
}

/** Inscrição com sub-recursos (GET /admin/pss/editais/:id/inscricoes). */
export interface InscricaoAdmin {
  id: string;
  protocolo: string;
  nome: string;
  cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
  vagaId?: string | null;
  status: string;
  motivo?: string | null;
  notaFinal?: number | string | null;
  classificacao?: number | null;
  criadoEm?: string | null;
  criterios?: InscricaoCriterioAdmin[];
  notas?: NotaAdmin[];
  anexos?: AnexoAdmin[];
}

/** Linha do ranking calculado (GET .../ranking/previa). */
export interface RankingClassificado {
  inscricaoId: string;
  protocolo: string;
  nome: string;
  notaFinal: number;
  classificacao: number;
}

export interface RankingEliminado {
  inscricaoId: string;
  protocolo: string;
  nome: string;
}

export interface RankingPrevia {
  edital: { id: string; numero: string; titulo: string };
  classificados: RankingClassificado[];
  eliminados: RankingEliminado[];
}

// ─── APLIC ───────────────────────────────────────────────────────────────────

export interface AberturaAdmin {
  id: string;
  tipo?: string | null;
  versao?: number | null;
  dataAto?: string | null;
  descricao?: string | null;
  url?: string | null;
  storageKey?: string | null;
}

export interface ComissaoMembroAdmin {
  id: string;
  userId?: string | null;
  nome: string;
  cpf?: string | null;
  cargo?: string | null;
  ordem: number;
}

export interface TabelaSalarialAdmin {
  id: string;
  vagaId?: string | null;
  codigo?: string | null;
  cargo: string;
  nivel?: string | null;
  classe?: string | null;
  salarioBase?: number | string | null;
  cargaHoraria?: string | null;
  ordem: number;
}

/** Formata um número decimal vindo da API (pode ser string do Prisma Decimal). */
export function fmtNum(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : String(n);
}

/** Formata um valor monetário em BRL. */
export function fmtMoeda(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
