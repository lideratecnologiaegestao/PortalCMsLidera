import { useCallback, useEffect, useState } from 'react';
import { SemRedeError } from '../api/client';

interface EstadoRecurso<T> {
  dados: T | null;
  carregando: boolean;
  atualizando: boolean;
  erro: string | null;
  recarregar: () => void;
}

/**
 * Hook genérico de carregamento de recurso remoto, com estados de loading,
 * pull-to-refresh e mensagem de erro amigável (distingue offline).
 *
 * `deps` controla o re-fetch (ex.: id/slug da rota).
 */
export function useRecurso<T>(
  buscar: () => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
): EstadoRecurso<T> {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const executar = useCallback(
    async (modo: 'inicial' | 'refresh') => {
      if (modo === 'inicial') setCarregando(true);
      else setAtualizando(true);
      setErro(null);
      try {
        const r = await buscar();
        setDados(r);
      } catch (e) {
        if (e instanceof SemRedeError) {
          setErro('Sem conexão. Verifique sua internet e tente novamente.');
        } else {
          setErro(e instanceof Error ? e.message : 'Não foi possível carregar.');
        }
      } finally {
        setCarregando(false);
        setAtualizando(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  useEffect(() => {
    executar('inicial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const recarregar = useCallback(() => executar('refresh'), [executar]);

  return { dados, carregando, atualizando, erro, recarregar };
}
