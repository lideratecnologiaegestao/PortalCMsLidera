import type { Canal } from '../api/types';

/** Tipos de manifestação por canal (rótulos legíveis para os seletores). */
export const TIPOS_OUVIDORIA: { value: string; label: string }[] = [
  { value: 'reclamacao', label: 'Reclamação' },
  { value: 'denuncia', label: 'Denúncia' },
  { value: 'sugestao', label: 'Sugestão' },
  { value: 'elogio', label: 'Elogio' },
  { value: 'solicitacao', label: 'Solicitação' },
];

export const TIPOS_ESIC: { value: string; label: string }[] = [
  { value: 'acesso_informacao', label: 'Acesso à informação' },
  { value: 'dados_pessoais', label: 'Dados pessoais' },
  { value: 'transparencia', label: 'Transparência' },
  { value: 'outros', label: 'Outros' },
];

export function tiposDoCanal(canal: Canal): { value: string; label: string }[] {
  return canal === 'esic' ? TIPOS_ESIC : TIPOS_OUVIDORIA;
}

export const PRAZO_DESCRICAO: Record<Canal, string> = {
  ouvidoria: 'Prazo legal de resposta: 30 dias, prorrogáveis por mais 30 (Lei 13.460/2017).',
  esic: 'Prazo legal de resposta: 20 dias, prorrogáveis por mais 10 (LAI 12.527/2011). Exige identificação.',
};
