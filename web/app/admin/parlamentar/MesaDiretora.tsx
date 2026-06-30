'use client';

/**
 * Admin — Parlamentar / Mesa Diretora
 * Endpoints:
 *   GET    /api/admin/parlamentar/mesa
 *   POST   /api/admin/parlamentar/mesa
 *   DELETE /api/admin/parlamentar/mesa/:id
 *   (vereadores p/ o seletor) GET /api/admin/parlamentar/vereadores?pageSize=100
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AdminApiError,
  adminDelete,
  adminGet,
  adminPost,
  type Pagina,
} from '../../../lib/admin-api';
import { Aviso, ui } from '../_components/ui';
import type { VereadorAdmin } from './tipos';

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface CargoMesa {
  id: string;
  cargo: string;
  inicio: string;
  fim?: string | null;
  legislatura?: string | null;
  ordem: number;
  vereador?: { id: string; nomeParlamentar: string } | null;
}

const CARGOS_MESA = [
  { v: 'presidente', l: 'Presidente' },
  { v: 'vice_presidente', l: 'Vice-presidente' },
  { v: 'primeiro_secretario', l: '1º Secretário(a)' },
  { v: 'segundo_secretario', l: '2º Secretário(a)' },
  { v: 'corregedor', l: 'Corregedor(a)' },
  { v: 'outro', l: 'Outro' },
];

function rotuloCargo(c: string): string {
  return CARGOS_MESA.find((x) => x.v === c)?.l ?? c;
}

/** Formata uma data ISO em dd/mm/aaaa (ou "—"). */
function formatarData(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

const formVazio = {
  vereadorId: '',
  cargo: 'presidente',
  inicio: '',
  fim: '',
  legislatura: '',
  ordem: 0,
};

// ─── Componente ────────────────────────────────────────────────────────────

export default function MesaDiretora() {
  const [lista, setLista] = useState<CargoMesa[]>([]);
  const [vereadores, setVereadores] = useState<VereadorAdmin[]>([]);
  const [form, setForm] = useState({ ...formVazio });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [mesa, vers] = await Promise.all([
        adminGet<CargoMesa[]>('/api/admin/parlamentar/mesa'),
        adminGet<Pagina<VereadorAdmin>>('/api/admin/parlamentar/vereadores?page=1&pageSize=100'),
      ]);
      setLista(mesa);
      setVereadores(vers.items);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar a Mesa Diretora.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function s<K extends keyof typeof formVazio>(k: K, v: (typeof formVazio)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vereadorId) {
      setErro('Selecione o vereador.');
      return;
    }
    if (!form.inicio) {
      setErro('Informe a data de início da vigência.');
      return;
    }
    setSalvando(true);
    setErro('');
    setMsgOk('');
    try {
      await adminPost('/api/admin/parlamentar/mesa', {
        vereadorId: form.vereadorId,
        cargo: form.cargo,
        inicio: form.inicio,
        fim: form.fim || undefined,
        legislatura: form.legislatura || undefined,
        ordem: Number(form.ordem) || 0,
      });
      setMsgOk('Cargo adicionado à Mesa Diretora.');
      setForm({ ...formVazio });
      await carregar();
    } catch (err) {
      setErro(err instanceof AdminApiError ? err.message : 'Erro ao salvar o cargo.');
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    setErro('');
    setMsgOk('');
    try {
      await adminDelete(`/api/admin/parlamentar/mesa/${id}`);
      setConfirmandoId(null);
      setMsgOk('Cargo removido.');
      await carregar();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao remover o cargo.');
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg/70">
        Defina os cargos da Mesa Diretora com vigência (início/fim). A composição vigente é resolvida por data
        na página pública; o histórico é preservado.
      </p>

      {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {/* Formulário de novo cargo */}
      <form onSubmit={adicionar} className="rounded border border-border p-3" noValidate>
        <h2 className="mb-3 font-heading text-base font-bold">Adicionar cargo à Mesa</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="mesa-vereador" className={ui.label}>
              Vereador <span aria-hidden="true">*</span>
            </label>
            <select
              id="mesa-vereador"
              required
              className={ui.input}
              value={form.vereadorId}
              onChange={(e) => s('vereadorId', e.target.value)}
            >
              <option value="">Selecione…</option>
              {vereadores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nomeParlamentar}
                  {v.partido ? ` (${v.partido})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="mesa-cargo" className={ui.label}>
              Cargo <span aria-hidden="true">*</span>
            </label>
            <select id="mesa-cargo" className={ui.input} value={form.cargo} onChange={(e) => s('cargo', e.target.value)}>
              {CARGOS_MESA.map((c) => (
                <option key={c.v} value={c.v}>
                  {c.l}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="mesa-legislatura" className={ui.label}>
              Legislatura
            </label>
            <input
              id="mesa-legislatura"
              type="text"
              className={ui.input}
              value={form.legislatura}
              onChange={(e) => s('legislatura', e.target.value)}
              placeholder="ex.: 2025-2028"
            />
          </div>

          <div>
            <label htmlFor="mesa-inicio" className={ui.label}>
              Início da vigência <span aria-hidden="true">*</span>
            </label>
            <input
              id="mesa-inicio"
              type="date"
              required
              className={ui.input}
              value={form.inicio}
              onChange={(e) => s('inicio', e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="mesa-fim" className={ui.label}>
              Fim da vigência <span className="text-fg/50">(em branco = vigente)</span>
            </label>
            <input
              id="mesa-fim"
              type="date"
              className={ui.input}
              value={form.fim}
              onChange={(e) => s('fim', e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="mesa-ordem" className={ui.label}>
              Ordem de exibição
            </label>
            <input
              id="mesa-ordem"
              type="number"
              min={0}
              className={ui.input}
              value={form.ordem}
              onChange={(e) => s('ordem', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button type="submit" className={ui.btn} disabled={salvando} aria-busy={salvando}>
            {salvando ? 'Adicionando…' : '+ Adicionar à Mesa'}
          </button>
        </div>
      </form>

      {/* Lista de cargos */}
      {carregando ? (
        <p aria-live="polite" aria-busy="true" className="py-8 text-center text-sm text-fg/60">
          Carregando…
        </p>
      ) : lista.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg/60">Nenhum cargo cadastrado na Mesa Diretora.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm" aria-label="Cargos da Mesa Diretora">
            <thead>
              <tr>
                <th scope="col" className={ui.th}>
                  Cargo
                </th>
                <th scope="col" className={ui.th}>
                  Vereador
                </th>
                <th scope="col" className={ui.th}>
                  Legislatura
                </th>
                <th scope="col" className={ui.th}>
                  Início
                </th>
                <th scope="col" className={ui.th}>
                  Fim
                </th>
                <th scope="col" className={ui.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td className={ui.td}>
                    <span className={`${ui.badge} bg-primary/10 text-primary`}>{rotuloCargo(c.cargo)}</span>
                  </td>
                  <td className={ui.td}>
                    <span className="font-medium">{c.vereador?.nomeParlamentar ?? '—'}</span>
                  </td>
                  <td className={ui.td}>{c.legislatura || <span className="text-fg/40">—</span>}</td>
                  <td className={ui.td}>
                    <time dateTime={c.inicio}>{formatarData(c.inicio)}</time>
                  </td>
                  <td className={ui.td}>
                    {c.fim ? (
                      <time dateTime={c.fim}>{formatarData(c.fim)}</time>
                    ) : (
                      <span className={`${ui.badge} bg-success/10 text-success`}>vigente</span>
                    )}
                  </td>
                  <td className={`${ui.td} whitespace-nowrap`}>
                    {confirmandoId === c.id ? (
                      <span className="flex gap-2">
                        <button type="button" className={ui.btnDanger} onClick={() => remover(c.id)}>
                          Confirmar
                        </button>
                        <button type="button" className={ui.btnGhost} onClick={() => setConfirmandoId(null)}>
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={ui.btnDanger}
                        onClick={() => setConfirmandoId(c.id)}
                        aria-label={`Remover ${rotuloCargo(c.cargo)} (${c.vereador?.nomeParlamentar ?? ''})`}
                      >
                        Remover
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
