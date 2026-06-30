'use client';

/**
 * Admin — PSS (Processo Seletivo Simplificado).
 *
 *   GET    /api/admin/pss/editais?page=&pageSize=   (lista paginada)
 *   GET    /api/admin/pss/editais/:id               (detalhe — em EditalGestao)
 *   POST   /api/admin/pss/editais                   (criar — em ModalEdital)
 *   PUT    /api/admin/pss/editais/:id               (atualizar)
 *   DELETE /api/admin/pss/editais/:id               (excluir)
 *
 * Lista os editais; "Gerenciar" abre o drill-down (EditalGestao) com abas de
 * Vagas, Fases/Critérios, Anexos, Inscrições, Notas, Ranking e APLIC.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AdminApiError,
  adminDelete,
  adminGet,
  qs,
  type Pagina,
} from '../../../lib/admin-api';
import { AdminHeader, Aviso, ui } from '../_components/ui';
import ModalEdital from './ModalEdital';
import EditalGestao from './EditalGestao';
import { rotuloStatusEdital, type EditalAdmin } from './tipos';

const PAGE_SIZE = 20;

function fmtData(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { dateStyle: 'short' });
}

function periodo(inicio?: string | null, fim?: string | null): string {
  if (!inicio && !fim) return '—';
  return `${fmtData(inicio)} – ${fmtData(fim)}`;
}

export default function PssAdminPage() {
  const [editais, setEditais] = useState<EditalAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<EditalAdmin | null>(null);

  /** Edital aberto em modo de gestão (drill-down). */
  const [gerindo, setGerindo] = useState<EditalAdmin | null>(null);

  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const data = await adminGet<Pagina<EditalAdmin>>(
        `/api/admin/pss/editais${qs({ page, pageSize: PAGE_SIZE })}`,
      );
      setEditais(data.items);
      setTotal(data.total);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar editais.');
    } finally {
      setCarregando(false);
    }
  }, [page]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirNovo() {
    setEditando(null);
    setModalAberto(true);
  }
  function abrirEditar(ed: EditalAdmin) {
    setEditando(ed);
    setModalAberto(true);
  }

  async function excluir(id: string) {
    setExcluindo(true);
    setErro('');
    try {
      await adminDelete(`/api/admin/pss/editais/${id}`);
      setMsgOk('Edital excluído com sucesso.');
      setConfirmandoId(null);
      carregar();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao excluir o edital.');
    } finally {
      setExcluindo(false);
    }
  }

  const totalPaginas = Math.ceil(total / PAGE_SIZE);

  // ── Modo de gestão (drill-down) ──────────────────────────────────────────
  if (gerindo) {
    return (
      <div className="space-y-4">
        <AdminHeader
          title="PSS — Gestão do edital"
          description="Vagas, fases, critérios, anexos, inscrições, notas, ranking e APLIC."
        />
        <EditalGestao
          edital={gerindo}
          onVoltar={() => {
            setGerindo(null);
            carregar();
          }}
          onEditalAlterado={carregar}
        />
      </div>
    );
  }

  // ── Lista de editais ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <AdminHeader
        title="Processo Seletivo Simplificado"
        description="Editais de PSS: vagas, fases de avaliação, inscrições, notas, ranking e prestação de contas (APLIC)."
      >
        <button type="button" className={ui.btn} onClick={abrirNovo}>
          + Novo edital
        </button>
      </AdminHeader>

      {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {carregando ? (
        <p aria-live="polite" aria-busy="true" className="py-12 text-center text-sm text-fg/60">
          Carregando editais…
        </p>
      ) : editais.length === 0 ? (
        <p className="py-12 text-center text-sm text-fg/60">
          Nenhum edital cadastrado. Clique em &ldquo;Novo edital&rdquo; para começar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm" aria-label="Lista de editais de PSS">
            <thead>
              <tr>
                <th scope="col" className={ui.th}>Número</th>
                <th scope="col" className={ui.th}>Título</th>
                <th scope="col" className={ui.th}>Situação</th>
                <th scope="col" className={ui.th}>Período de inscrição</th>
                <th scope="col" className={ui.th}>Status</th>
                <th scope="col" className={ui.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {editais.map((ed) => (
                <tr key={ed.id}>
                  <td className={ui.td}>
                    <span className="font-mono text-xs">{ed.numero}</span>
                  </td>
                  <td className={ui.td}>
                    <span className="font-medium">{ed.titulo}</span>
                  </td>
                  <td className={ui.td}>
                    <span className={`${ui.badge} bg-primary/10 text-primary`}>
                      {rotuloStatusEdital(ed.status)}
                    </span>
                    {ed.rankingPublicado && (
                      <span className={`${ui.badge} ml-1 bg-success/10 text-success`}>Ranking</span>
                    )}
                  </td>
                  <td className={ui.td}>{periodo(ed.inscricaoInicio, ed.inscricaoFim)}</td>
                  <td className={ui.td}>
                    <span
                      className={`${ui.badge} ${
                        ed.ativo ? 'bg-success/10 text-success' : 'bg-muted text-fg/60'
                      }`}
                    >
                      {ed.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className={ui.td}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={ui.btn}
                        onClick={() => setGerindo(ed)}
                        aria-label={`Gerenciar edital "${ed.titulo}"`}
                      >
                        Gerenciar
                      </button>
                      <button
                        type="button"
                        className={ui.btnGhost}
                        onClick={() => abrirEditar(ed)}
                        aria-label={`Editar edital "${ed.titulo}"`}
                      >
                        Editar
                      </button>
                      {confirmandoId === ed.id ? (
                        <>
                          <button
                            type="button"
                            className={ui.btnDanger}
                            onClick={() => excluir(ed.id)}
                            disabled={excluindo}
                            aria-busy={excluindo}
                          >
                            {excluindo ? 'Excluindo…' : 'Confirmar exclusão'}
                          </button>
                          <button
                            type="button"
                            className={ui.btnGhost}
                            onClick={() => setConfirmandoId(null)}
                            disabled={excluindo}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={ui.btnDanger}
                          onClick={() => setConfirmandoId(ed.id)}
                          aria-label={`Excluir edital "${ed.titulo}"`}
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <nav aria-label="Paginação de editais" className="flex items-center gap-2 pt-2">
          <button
            type="button"
            className={ui.btnGhost}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Página anterior"
          >
            ← Anterior
          </button>
          <span className="text-sm text-fg/70">
            Página {page} de {totalPaginas} ({total} registros)
          </span>
          <button
            type="button"
            className={ui.btnGhost}
            disabled={page >= totalPaginas}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Próxima página"
          >
            Próxima →
          </button>
        </nav>
      )}

      <ModalEdital
        open={modalAberto}
        editando={editando}
        onClose={() => setModalAberto(false)}
        onSalvo={() => {
          setMsgOk(editando ? 'Edital atualizado com sucesso.' : 'Edital criado com sucesso.');
          carregar();
        }}
      />
    </div>
  );
}
