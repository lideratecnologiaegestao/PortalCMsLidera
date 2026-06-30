// Tipos compartilhados entre as abas do admin Parlamentar.

/** Vereador como retornado pelos endpoints admin (linha completa da tabela). */
export interface VereadorAdmin {
  id: string;
  nome: string;
  nomeParlamentar: string;
  slug?: string | null;
  userId?: string | null;
  partido?: string | null;
  status?: string | null;
  legislatura?: string | null;
  mandatoInicio?: string | null;
  mandatoFim?: string | null;
  email?: string | null;
  telefone?: string | null;
  fotoUrl?: string | null;
  biografia?: string | null;
  redes?: Record<string, string> | null;
  ordem: number;
  ativo: boolean;
}
