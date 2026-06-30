/**
 * Tipos públicos do portal — sem imports de server-only (next/headers etc).
 * Importável tanto em Server Components quanto em Client Components.
 */

// ─── Menu dinâmico ────────────────────────────────────────────────────────────

export interface MenuItem {
  id: string;
  label: string;
  tipo: 'interno' | 'externo' | 'grupo';
  href: string | null;
  icone: string | null;
  ordem: number;
  children: MenuItem[];
}

/** Item retornado pela rota admin (inclui campos extras de gestão). */
export interface MenuItemAdmin extends MenuItem {
  parentId: string | null;
  local: 'cabecalho' | 'rodape';
  ativo: boolean;
  refTipo: string | null;
}

/** Grupo de rotas disponíveis para criar itens internos. */
export interface RotaGrupo {
  grupo: string;
  rotas: { label: string; href: string }[];
}

export interface Banner {
  id: string;
  titulo: string;
  subtitulo?: string;
  imagemUrl: string;
  linkUrl?: string;
  ctaLabel?: string;
  ordem: number;
  ativo: boolean;
}

export interface Noticia {
  id: string;
  slug: string;
  titulo: string;
  resumo: string;
  imagemUrl?: string;
  categoria: string;
  autor?: string;
  publicadoEm: string;
  visualizacoes?: number;
}

export interface NoticiaDetalhe extends Noticia {
  conteudo: string;
}

export interface NoticiasResult {
  items: Noticia[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Secretaria {
  id: string;
  nome: string;
  slug?: string;
  sigla?: string;
  responsavel?: string;
  fotoUrl?: string;
  descricao?: string;
  email?: string;
  telefone?: string;
  ordem: number;
}

export interface HomeAtalho {
  id: string;
  label: string;
  descricao?: string | null;
  href: string;
  icone: string;
  ordem: number;
  ativo: boolean;
}

export interface HomeConfig {
  arColunas: number;
  arCardsLinha: number;
  arLadoCards: string;
  cardIconeForma: string;
  cardCorDestaque?: string | null;
  sliderTipo: string;
  sliderImagem?: string | null;
  sliderLink?: string | null;
  sliderHtml?: string | null;
  sliderVideo?: string | null;
  sliderYoutube?: string | null;
  sliderEnqueteId?: string | null;
  googleAnalyticsId?: string | null;
  ogImageUrl?: string | null;
  modoManutencao?: boolean;
  manutencaoMensagem?: string | null;
}

export interface HomeData {
  config: HomeConfig;
  atalhos: HomeAtalho[];
}

export interface GaleriaItem {
  id: string;
  tipo: 'foto' | 'video' | 'audio';
  fonte: 'upload' | 'youtube';
  titulo?: string | null;
  url?: string | null;
  youtubeId?: string | null;
  ordem: number;
  secretariaId?: string | null;
  secretaria?: { nome: string; slug?: string } | null;
}

export interface Servico {
  id: string;
  titulo: string;
  slug: string;
  descricao?: string | null;
  categoria?: string | null;
  orgaoResponsavel?: string | null;
  publicoAlvo?: string | null;
  prazoAtendimento?: string | null;
  custo?: string | null;
  urlExterna?: string | null;
  destaque?: boolean;
  avaliacaoSoma?: number;
  avaliacaoQtd?: number;
  ordem?: number;
}

export interface ServicoAvaliado {
  id: string;
  titulo: string;
  slug: string;
  categoria?: string | null;
  media: number;
  total: number;
}

export interface ServicoDetalhe extends Servico {
  requisitos?: string | null;
  etapas?: string[] | { titulo?: string; descricao?: string }[];
  canaisAtendimento?: string | null;
}

// ─── Buscador Unificado (ADR-0004) ───────────────────────────────────────────

export type BuscaTipo =
  | 'noticia'
  | 'documento'
  | 'diario'
  | 'servico'
  | 'secretaria'
  | 'cms'
  | 'transparencia'
  | 'licitacao'
  | 'contrato'
  | 'convenio'
  | 'conselho'
  | 'concurso';

export interface BuscaResultado {
  tipo: BuscaTipo;
  refId: string;
  titulo: string;
  /** HTML com apenas <b>…</b> para realce (ts_headline do Postgres). */
  snippet: string;
  url: string;
  score: number;
  publicadoEm?: string | null;
}

export interface BuscaResult {
  total: number;
  page: number;
  pageSize: number;
  resultados: BuscaResultado[];
}

// ── L1 Parlamentar (vereadores, mesa diretora, comissões) ──────────────────
export interface Vereador {
  id: string;
  nome: string;
  nomeParlamentar: string;
  slug?: string | null;
  partido?: string | null;
  status: string;
  legislatura?: string | null;
  fotoUrl?: string | null;
  email?: string | null;
  telefone?: string | null;
}

export interface MesaCargo {
  cargo: string;
  inicio: string;
  fim?: string | null;
  legislatura?: string | null;
  vereador: Pick<Vereador, 'id' | 'nomeParlamentar' | 'slug' | 'partido' | 'fotoUrl'>;
}

export interface Comissao {
  id: string;
  nome: string;
  slug?: string | null;
  tipo: string;
  descricao?: string | null;
  legislatura?: string | null;
}

// ── L2 Sessões Plenárias (sessões, pauta, presença, gravações, TV Câmara) ──
export interface TipoSessaoRef {
  id: string;
  nome: string;
}

export interface SessaoResumo {
  id: string;
  titulo: string;
  dataHora: string;
  local?: string | null;
  status: string; // agendada | em_andamento | encerrada | cancelada
  quorum?: number | null;
  videoAoVivoUrl?: string | null;
  ataPublicadaEm?: string | null;
  tipoSessao?: TipoSessaoRef | null;
}

export interface SessaoPautaItem {
  id: string;
  ordem: number;
  titulo: string;
  descricao?: string | null;
  proposicaoId?: string | null;
}

export interface SessaoPresenca {
  id: string;
  situacao: string; // presente | ausente | justificado
  observacao?: string | null;
  vereador: Pick<Vereador, 'id' | 'nomeParlamentar' | 'slug' | 'partido' | 'fotoUrl'>;
}

export interface SessaoGravacao {
  id: string;
  titulo: string;
  videoUrl?: string | null;
  storageKey?: string | null;
  duracao?: number | null;
  ordem: number;
}

export interface SessaoDetalhe extends SessaoResumo {
  ataConteudo?: string | null; // só presente quando ata publicada
  pautaItens: SessaoPautaItem[];
  presencas: SessaoPresenca[];
  gravacoes: SessaoGravacao[];
}

export interface TvCamara {
  aoVivo: (Pick<SessaoResumo, 'id' | 'titulo' | 'dataHora' | 'videoAoVivoUrl' | 'status'>) | null;
  proxima: (Pick<SessaoResumo, 'id' | 'titulo' | 'dataHora' | 'local' | 'status'>) | null;
  ultima: (Pick<SessaoResumo, 'id' | 'titulo' | 'dataHora' | 'status'>) | null;
  acervo: { id: string; titulo: string; dataHora: string; gravacoes: SessaoGravacao[] }[];
}
// ── L3 Legislativo (proposições / leis) ────────────────────────────────────
export interface Proposicao {
  id: string;
  tipo: string;
  numero?: number | null;
  ano?: number | null;
  protocolo?: string | null;
  ementa: string;
  statusAtual: string;
  autorPrincipalId?: string | null;
  dataProtocolo?: string | null;
}

export interface Lei {
  id: string;
  numero: string;
  tipo: string;
  ano?: number | null;
  ementa: string;
  dataSancao?: string | null;
  vigente: boolean;
  pdfUrl?: string | null;
}
// ── L4 Escola Legislativa (cursos, certificados) ───────────────────────────
export interface CursoResumo {
  id: string;
  titulo: string;
  slug?: string | null;
  resumo?: string | null;
  capaUrl?: string | null;
  cargaHoraria?: number | null;
  inicioEm?: string | null;
  fimEm?: string | null;
  certificacao: boolean;
}

export interface CursoAulaResumo {
  id: string;
  titulo: string;
  duracaoMin?: number | null;
  ordem: number;
}

export interface CursoModuloResumo {
  id: string;
  titulo: string;
  descricao?: string | null;
  ordem: number;
  aulas: CursoAulaResumo[];
}

export interface CursoDetalhe extends CursoResumo {
  descricao?: string | null;
  modulos: CursoModuloResumo[];
}

export interface CertificadoPublico {
  codigo: string;
  nomeAluno: string;
  tituloCurso: string;
  cargaHoraria?: number | null;
  emitidoEm: string;
}

export type ValidacaoCertificado =
  | { valido: true; certificado: CertificadoPublico }
  | { valido: false };
// ── L5 PSS (Processo Seletivo Simplificado) ─────────────────────────────────
export interface PssEdital {
  id: string;
  numero: string;
  titulo: string;
  slug?: string | null;
  status: string;
  inscricaoInicio?: string | null;
  inscricaoFim?: string | null;
  rankingPublicado: boolean;
  rankingPublicadoEm?: string | null;
  criadoEm?: string;
}

export interface PssVaga {
  id: string;
  cargo: string;
  escolaridade?: string | null;
  quantidade: number;
  vagasCadastro: number;
  requisitos?: string | null;
  cargaHoraria?: string | null;
  salario?: string | number | null;
  ordem: number;
}

export interface PssCriterio {
  id: string;
  descricao: string;
  pontos: string | number;
  pontosMaximo?: string | number | null;
  ordem: number;
}

export interface PssFase {
  id: string;
  nome: string;
  tipo: string;
  peso: string | number;
  eliminatoria: boolean;
  notaCorte?: string | number | null;
  ordem: number;
  criterios?: PssCriterio[];
}

export interface PssAnexo {
  id: string;
  titulo: string;
  tipo: string;
  url?: string | null;
  ordem: number;
}

export interface PssEditalDetalhe extends PssEdital {
  objeto?: string | null;
  vagas?: PssVaga[];
  fases?: PssFase[];
  anexos?: PssAnexo[];
}

export interface PssRankingItem {
  id: string;
  protocolo: string;
  nome: string;
  notaFinal?: string | number | null;
  classificacao: number;
  vagaId?: string | null;
}

export interface PssRanking {
  edital: { id: string; numero: string; titulo: string; slug?: string | null };
  publicadoEm?: string | null;
  classificados: PssRankingItem[];
}
// ── L6 Eventos & Audiências Públicas ────────────────────────────────────────
export interface Evento {
  id: string;
  tipo: string; // audiencia_publica | palestra | seminario | solenidade | outro
  titulo: string;
  slug?: string | null;
  dataHora: string;
  dataFim?: string | null;
  local?: string | null;
  onlineUrl?: string | null;
  vagas?: number | null;
  capaUrl?: string | null;
  certificavel: boolean;
  inscricoesAbertas: boolean;
  sessaoId?: string | null;
  vagasRestantes?: number | null;
}

export interface EventoDetalhe extends Evento {
  descricao?: string | null;
  publicado: boolean;
  ativo: boolean;
  inscritos: number;
}