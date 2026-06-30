/** Helpers de formatação e rótulos legíveis para o domínio legislativo. */

/** Data legível pt-BR (dd/mm/aaaa). Aceita ISO ou Date. */
export function dataBR(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Data + hora legível (dd/mm/aaaa às HH:mm). */
export function dataHoraBR(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${data} às ${hora}`;
}

/** Rótulo do cargo na Mesa Diretora / comissão. */
export function rotuloCargo(cargo?: string | null): string {
  const m: Record<string, string> = {
    presidente: 'Presidente',
    vice_presidente: 'Vice-Presidente',
    'vice-presidente': 'Vice-Presidente',
    primeiro_secretario: '1º Secretário',
    segundo_secretario: '2º Secretário',
    primeiro_vice_presidente: '1º Vice-Presidente',
    relator: 'Relator',
    membro: 'Membro',
    suplente: 'Suplente',
  };
  if (!cargo) return '';
  return m[cargo] ?? cargo.replace(/_/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase());
}

/** Rótulo de status de sessão. */
export function rotuloStatusSessao(status?: string | null): string {
  const m: Record<string, string> = {
    agendada: 'Agendada',
    em_andamento: 'Ao vivo',
    encerrada: 'Encerrada',
    cancelada: 'Cancelada',
    suspensa: 'Suspensa',
  };
  if (!status) return '';
  return m[status] ?? status;
}

/** Rótulo de status de proposição/tramitação. */
export function rotuloStatusProposicao(status?: string | null): string {
  const m: Record<string, string> = {
    protocolada: 'Protocolada',
    em_comissao: 'Em comissão',
    em_pauta: 'Em pauta',
    aprovada: 'Aprovada',
    rejeitada: 'Rejeitada',
    sancionada: 'Sancionada',
    vetada: 'Vetada',
    arquivada: 'Arquivada',
    retirada: 'Retirada',
  };
  if (!status) return '';
  return m[status] ?? status.replace(/_/g, ' ');
}

/** Rótulo de status de manifestação (Ouvidoria/e-SIC). */
export function rotuloStatusManifestacao(status?: string | null): string {
  const m: Record<string, string> = {
    registrada: 'Registrada',
    em_analise: 'Em análise',
    em_tratamento: 'Em tratamento',
    aguardando_cidadao: 'Aguardando você',
    prorrogada: 'Prazo prorrogado',
    respondida: 'Respondida',
    indeferida: 'Indeferida',
    parcialmente_atendida: 'Parcialmente atendida',
    recurso_1a_instancia: 'Recurso 1ª instância',
    recurso_2a_instancia: 'Recurso 2ª instância',
    concluida: 'Concluída',
    arquivada: 'Arquivada',
  };
  if (!status) return '';
  return m[status] ?? status.replace(/_/g, ' ');
}

/** Rótulo do voto nominal. */
export function rotuloVoto(voto?: string | null): string {
  const m: Record<string, string> = {
    favoravel: 'Favorável',
    sim: 'Sim',
    contrario: 'Contrário',
    nao: 'Não',
    abstencao: 'Abstenção',
    ausente: 'Ausente',
    obstrucao: 'Obstrução',
  };
  if (!voto) return '';
  return m[voto] ?? voto;
}

/** Tipo de proposição → rótulo curto. */
export function rotuloTipoProposicao(tipo?: string | null): string {
  const m: Record<string, string> = {
    projeto_lei: 'Projeto de Lei',
    pl: 'Projeto de Lei',
    plc: 'Projeto de Lei Complementar',
    pec: 'PEC',
    requerimento: 'Requerimento',
    indicacao: 'Indicação',
    mocao: 'Moção',
    decreto_legislativo: 'Decreto Legislativo',
    resolucao: 'Resolução',
  };
  if (!tipo) return '';
  return m[tipo] ?? tipo.replace(/_/g, ' ').toUpperCase();
}

/** Extrai o ID do vídeo do YouTube de uma URL (watch?v=, youtu.be, embed). */
export function youtubeId(url?: string | null): string | null {
  if (!url) return null;
  const re = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/;
  const m = url.match(re);
  return m ? m[1] : null;
}

/** Identificação curta da proposição: "PL 12/2025". */
export function rotuloProposicao(tipo: string | null, numero: number | null, ano: number | null): string {
  const t = rotuloTipoProposicao(tipo);
  const sigla = t.split(' ').map((p) => p[0]).join('').toUpperCase();
  const num = numero != null && ano != null ? ` ${numero}/${ano}` : '';
  return `${sigla || t}${num}`;
}
