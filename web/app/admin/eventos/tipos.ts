// Tipos compartilhados entre as telas do admin de Eventos.

/** Tipos de evento aceitos pelo backend (CriarEventoDto.tipo). */
export const TIPOS_EVENTO = [
  { v: 'audiencia_publica', l: 'Audiência Pública' },
  { v: 'palestra', l: 'Palestra' },
  { v: 'seminario', l: 'Seminário' },
  { v: 'solenidade', l: 'Solenidade' },
  { v: 'outro', l: 'Outro' },
] as const;

export function rotuloTipo(t?: string | null): string {
  return TIPOS_EVENTO.find((x) => x.v === t)?.l ?? t ?? '—';
}

/** Status possíveis de uma inscrição (admin). */
export const STATUS_INSCRICAO = [
  { v: 'confirmada', l: 'Confirmada' },
  { v: 'lista_espera', l: 'Lista de espera' },
  { v: 'cancelada', l: 'Cancelada' },
] as const;

export function rotuloStatusInscricao(s?: string | null): string {
  return STATUS_INSCRICAO.find((x) => x.v === s)?.l ?? s ?? '—';
}

/** Evento como retornado pelos endpoints admin (linha completa da tabela). */
export interface EventoAdmin {
  id: string;
  tipo: string;
  titulo: string;
  slug?: string | null;
  descricao?: string | null;
  dataHora: string;
  dataFim?: string | null;
  local?: string | null;
  onlineUrl?: string | null;
  vagas?: number | null;
  capaUrl?: string | null;
  certificavel: boolean;
  inscricoesAbertas: boolean;
  sessaoId?: string | null;
  publicado: boolean;
  ativo: boolean;
  criadoEm?: string | null;
}

/** Inscrição como retornada por GET /admin/eventos/:id/inscricoes. */
export interface InscricaoAdmin {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  documento?: string | null;
  status: string;
  presente: boolean;
  presenteEm?: string | null;
  cidadaoId?: string | null;
  criadoEm?: string | null;
}
