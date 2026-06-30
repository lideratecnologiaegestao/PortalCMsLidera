/**
 * Testes das funções puras dos prompts da IA Legislativa.
 */
import {
  montarContextoLegislativo,
  rotuloFonte,
  rotuloLei,
  rotuloProposicao,
  sistemaChatLegislativo,
} from './legislativo.prompts';

describe('legislativo.prompts', () => {
  describe('rotuloProposicao', () => {
    it('formata tipo + número/ano', () => {
      expect(rotuloProposicao({ tipo: 'pl_ordinaria', numero: 12, ano: 2025 })).toBe(
        'Projeto de Lei Ordinária nº 12/2025',
      );
    });

    it('omite número quando ausente', () => {
      expect(rotuloProposicao({ tipo: 'requerimento', numero: null, ano: null })).toBe(
        'Requerimento',
      );
    });

    it('cai para rótulo genérico em tipo desconhecido', () => {
      expect(rotuloProposicao({ tipo: 'xpto', numero: 1, ano: 2024 })).toContain('Proposição');
    });
  });

  describe('rotuloLei', () => {
    it('formata lei com número/ano', () => {
      expect(rotuloLei({ tipo: 'lei_ordinaria', numero: '1.234', ano: 2024 })).toBe(
        'Lei Ordinária nº 1.234/2024',
      );
    });

    it('omite ano quando ausente', () => {
      expect(rotuloLei({ tipo: 'lei_complementar', numero: '5', ano: null })).toBe(
        'Lei Complementar nº 5',
      );
    });
  });

  describe('rotuloFonte', () => {
    it('mapeia as fontes legislativas', () => {
      expect(rotuloFonte('lei')).toBe('Lei/Norma');
      expect(rotuloFonte('proposicao')).toBe('Proposição/Projeto');
      expect(rotuloFonte('sessao_ata')).toBe('Ata de Sessão');
      expect(rotuloFonte('outra')).toBe('outra');
    });
  });

  describe('sistemaChatLegislativo', () => {
    it('inclui o nome da câmara quando informado', () => {
      const s = sistemaChatLegislativo('Câmara Municipal de Exemplo');
      expect(s).toContain('Câmara Municipal de Exemplo');
      expect(s).toContain('ASSISTENTE LEGISLATIVO');
    });

    it('tem fallback genérico sem nome', () => {
      const s = sistemaChatLegislativo();
      expect(s).toContain('Câmara Municipal brasileira');
    });

    it('reforça as regras invioláveis (não inventar, citar número/ano)', () => {
      const s = sistemaChatLegislativo();
      expect(s).toMatch(/NUNCA invente/i);
      expect(s).toMatch(/número/i);
      expect(s).toMatch(/prompt injection/i);
    });
  });

  describe('montarContextoLegislativo', () => {
    it('mensagem de vazio sem trechos', () => {
      expect(montarContextoLegislativo([])).toContain('nenhum');
    });

    it('numera e cita fonte/URL', () => {
      const ctx = montarContextoLegislativo([
        { titulo: 'Lei nº 10/2024', texto: 'Dispõe sobre X.', url: '/legislativo/leis/1', fonte: 'lei' },
      ]);
      expect(ctx).toContain('[1] Lei nº 10/2024');
      expect(ctx).toContain('[Lei/Norma]');
      expect(ctx).toContain('/legislativo/leis/1');
    });
  });
});
