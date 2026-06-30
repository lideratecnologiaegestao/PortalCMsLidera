/**
 * Tipos do contrato REST da API NestJS da Câmara, espelhando os `select`/`include`
 * dos services públicos do backend (módulos parlamentar, sessoes, legislativo,
 * noticias, manifestacoes). Campos opcionais refletem `null` possíveis no banco.
 */

// ───────────────────────── Parlamentar ─────────────────────────

/** Item da listagem pública de vereadores (GET /api/vereadores). */
export interface VereadorResumo {
  id: string;
  nome: string;
  nomeParlamentar: string;
  slug: string | null;
  partido: string | null;
  status: string | null;
  legislatura: string | null;
  fotoUrl: string | null;
  email: string | null;
  telefone: string | null;
}

export interface ComissaoRef {
  id: string;
  nome: string;
  slug: string | null;
  tipo: string | null;
}

export interface ComissaoCargo {
  cargo: string;
  ordem?: number;
  inicio?: string | null;
  fim?: string | null;
  comissao: ComissaoRef;
}

export interface VereadorPostMidia {
  id: string;
  url: string;
  tipo?: string | null;
  ordem?: number;
}

export interface VereadorPost {
  id: string;
  titulo?: string | null;
  conteudo?: string | null;
  publicadoEm: string | null;
  midias: VereadorPostMidia[];
}

export interface Representacao {
  id: string;
  titulo?: string | null;
  descricao?: string | null;
  criadoEm: string | null;
}

export interface MesaCargo {
  cargo: string;
  inicio?: string | null;
  fim?: string | null;
  legislatura?: string | null;
}

/** Perfil público completo (GET /api/vereadores/:slug). */
export interface VereadorDetalhe extends VereadorResumo {
  biografia?: string | null;
  mandatoInicio?: string | null;
  mandatoFim?: string | null;
  redes?: Record<string, string> | null;
  mesaCargos: MesaCargo[];
  comissaoCargos: ComissaoCargo[];
  posts: VereadorPost[];
  representacoes: Representacao[];
}

/** Item da Mesa Diretora (GET /api/mesa-diretora). */
export interface MesaDiretoraItem {
  cargo: string;
  inicio: string | null;
  fim: string | null;
  legislatura: string | null;
  vereador: {
    id: string;
    nomeParlamentar: string;
    slug: string | null;
    partido: string | null;
    fotoUrl: string | null;
  };
}

export interface Comissao {
  id: string;
  nome: string;
  slug: string | null;
  sigla?: string | null;
  tipo: string | null;
  descricao?: string | null;
}

// ───────────────────────── Sessões / TV ─────────────────────────

export interface TipoSessaoRef {
  id: string;
  nome: string;
}

/** Item da listagem pública de sessões (GET /api/sessoes). */
export interface SessaoResumo {
  id: string;
  titulo: string;
  dataHora: string;
  local: string | null;
  status: string;
  quorum?: number | null;
  videoAoVivoUrl: string | null;
  ataPublicadaEm: string | null;
  tipoSessao: TipoSessaoRef | null;
}

export interface PautaItem {
  id: string;
  ordem: number;
  titulo: string;
  descricao?: string | null;
  resultado?: string | null;
}

export interface Presenca {
  id: string;
  presente: boolean;
  vereador: {
    id: string;
    nomeParlamentar: string;
    slug: string | null;
    partido: string | null;
    fotoUrl: string | null;
  };
}

export interface Gravacao {
  id: string;
  titulo?: string | null;
  url: string;
  plataforma?: string | null;
  ordem: number;
}

/** Detalhe público de sessão (GET /api/sessoes/:id). */
export interface SessaoDetalhe extends SessaoResumo {
  ataConteudo: string | null;
  pautaItens: PautaItem[];
  presencas: Presenca[];
  gravacoes: Gravacao[];
}

/** TV Câmara (GET /api/tv-camara). */
export interface TvCamara {
  aoVivo: {
    id: string;
    titulo: string;
    dataHora: string;
    videoAoVivoUrl: string | null;
    status: string;
  } | null;
  proxima: {
    id: string;
    titulo: string;
    dataHora: string;
    local: string | null;
    status: string;
  } | null;
  ultima: {
    id: string;
    titulo: string;
    dataHora: string;
    status: string;
  } | null;
  acervo: {
    id: string;
    titulo: string;
    dataHora: string;
    gravacoes: Gravacao[];
  }[];
}

// ───────────────────────── Legislativo ─────────────────────────

export interface ProposicaoResumo {
  id: string;
  tipo: string;
  numero: number | null;
  ano: number | null;
  protocolo: string | null;
  ementa: string | null;
  statusAtual: string | null;
  autorPrincipalId: string | null;
  dataProtocolo: string | null;
}

export interface Tramitacao {
  id: string;
  data: string;
  situacao?: string | null;
  descricao?: string | null;
}

export interface Voto {
  id: string;
  voto: string;
  vereador: { id: string; nomeParlamentar: string; slug: string | null; partido: string | null };
}

export interface Votacao {
  id: string;
  data: string;
  resultado?: string | null;
  votos: Voto[];
}

export interface ProposicaoDetalhe extends ProposicaoResumo {
  autores: { ordem: number; vereador: { id: string; nomeParlamentar: string; slug: string | null; partido: string | null } }[];
  tramitacoes: Tramitacao[];
  votacoes: Votacao[];
  emendas: { id: string; numero: number; ementa?: string | null }[];
}

export interface LeiResumo {
  id: string;
  numero: number | null;
  tipo: string;
  ano: number | null;
  ementa: string | null;
  dataSancao: string | null;
  vigente: boolean;
  pdfUrl: string | null;
}

// ───────────────────────── Notícias ─────────────────────────

export interface NoticiaResumo {
  id: string;
  slug: string;
  titulo: string;
  resumo?: string | null;
  imagemUrl?: string | null;
  imagemDestaqueUrl?: string | null;
  categoria?: string | null;
  publicadoEm?: string | null;
}

export interface NoticiaDetalhe extends NoticiaResumo {
  conteudo?: string | null;
  corpo?: string | null;
  galeriaImagens?: string[];
}

export interface Paginado<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ───────────────────────── Manifestações (Ouvidoria / e-SIC) ─────────────────────────

export type Canal = 'ouvidoria' | 'esic';

export interface RegistroManifestacaoResposta {
  id: string;
  protocolo: string;
  canal: Canal;
  chave: string;
}

export interface EventoManifestacao {
  id: string;
  evento: string;
  paraStatus: string;
  observacao: string | null;
  criadoEm: string;
}

export interface MensagemManifestacao {
  id: string;
  autorTipo: string;
  autorNome: string;
  conteudo: string;
  criadoEm: string;
}

export interface AnexoManifestacao {
  id: string;
  nomeArquivo: string;
  mime: string;
  origem: string;
  criadoEm: string;
}

export interface ManifestacaoDetalhe {
  protocolo: string;
  canal: Canal;
  tipo: string;
  status: string;
  assunto: string;
  descricao: string;
  prazoEm: string;
  prorrogado: boolean;
  resposta: string | null;
  criadoEm: string;
  eventos: EventoManifestacao[];
  mensagens: MensagemManifestacao[];
  anexos: AnexoManifestacao[];
}

export interface MinhaManifestacao {
  id: string;
  protocolo: string;
  canal: Canal;
  tipo: string;
  status: string;
  assunto: string;
  prazoEm: string;
  criadoEm: string;
}
