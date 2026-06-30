'use client';

/**
 * Admin — Sessões Plenárias (sessões do Legislativo + TV Câmara).
 *
 *   GET    /api/admin/sessoes?page=&pageSize=   (lista paginada)
 *   GET    /api/admin/sessoes/:id               (detalhe — em SessaoGestao)
 *   POST   /api/admin/sessoes                   (criar — em ModalSessao)
 *   PUT    /api/admin/sessoes/:id               (atualizar)
 *   DELETE /api/admin/sessoes/:id               (excluir)
 *   GET    /api/admin/sessoes/tipos             (tipos — em ModalTipos)
 *
 * Lista as sessões; "Gerenciar" abre o drill-down (SessaoGestao) com abas de
 * Pauta, Presenças, Ata e Gravações (TV Câmara). "Tipos de sessão" abre a
 * gestão dos tipos. ATENÇÃO: a rota /admin/sessoes é outra tela (Sessões de
 * login); este módulo vive em /admin/sessoes-plenarias.
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
import ModalSessao from './ModalSessao';
import ModalTipos from './ModalTipos';
import SessaoGestao from './SessaoGestao';
import {
  corStatusSessao,
  rotuloStatusSessao,
  type SessaoAdmin,
  type TipoSessaoAdmin,
} from './tipos';

const PAGE_SIZE = 20;

function fmtData(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function SessoesPlenariasAdminPage() {
  const [sessoes, setSessoes] = useState<SessaoAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');

  const [tipos, setTipos] = useState<TipoSessaoAdmin[]>([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<SessaoAdmin | null>(null);
  const [tiposAberto, setTiposAberto] = useState(false);

  /** Sessão aberta em modo de gestão (drill-down). */
  const [gerindo, setGerindo] = useState<SessaoAdmin | null>(null);

  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const data = await adminGet<Pagina<SessaoAdmin>>(
        `/api/admin/sessoes${qs({ page, pageSize: PAGE_SIZE })}`,
      );
      setSessoes(data.items);
      setTotal(data.total);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar sessões.');
    } finally {
      setCarregando(false);
    }
  }, [page]);

  const carregarTipos = useCallback(async () => {
    try {
      const data = await adminGet<TipoSessaoAdmin[]>('/api/admin/sessoes/tipos');
      setTipos(data);
    } catch {
      /* não bloqueia a lista; o select fica sem opções de tipo */
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    carregarTipos();
  }, [carregarTipos]);

  function abrirNovo() {
    setEditando(null);
    setModalAberto(true);
  }
  function abrirEditar(se: SessaoAdmin) {
    setEditando(se);
    setModalAberto(true);
  }

  async function excluir(id: string) {
    setExcluindo(true);
    setErro('');
    try {
      await adminDelete(`/api/admin/sessoes/${id}`);
      setMsgOk('Sessão excluída com sucesso.');
      setConfirmandoId(null);
      carregar();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao excluir a sessão.');
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
          title="Sessões Plenárias — Gestão da sessão"
          description="Pauta, presenças, ata e gravações (TV Câmara)."
        />
        <SessaoGestao
          sessao={gerindo}
          onVoltar={() => {
            setGerindo(null);
            carregar();
          }}
          onSessaoAlterada={carregar}
        />
      </div>
    );
  }

  // ── Lista de sessões ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <AdminHeader
        title="Sessões Plenárias"
        description="Sessões do Legislativo: agenda, pauta, presenças, ata e gravações (TV Câmara)."
      >
        <button type="button" className={ui.btnGhost} onClick={() => setTiposAberto(true)}>
          Tipos de sessão
        </button>
        <button type="button" className={ui.btn} onClick={abrirNovo}>
          + Nova sessão
        </button>
      </AdminHeader>

      {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {carregando ? (
        <p aria-live="polite" aria-busy="true" className="py-12 text-center text-sm text-fg/60">
          Carregando sessões…
        </p>
      ) : sessoes.length === 0 ? (
        <p className="py-12 text-center text-sm text-fg/60">
          Nenhuma sessão cadastrada. Clique em &ldquo;Nova sessão&rdquo; para começar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm" aria-label="Lista de sessões plenárias">
            <thead>
              <tr>
                <th scope="col" className={ui.th}>Data e hora</th>
                <th scope="col" className={ui.th}>Tipo</th>
                <th scope="col" className={ui.th}>Título</th>
                <th scope="col" className={ui.th}>Situação</th>
                <th scope="col" className={ui.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sessoes.map((se) => (
                <tr key={se.id}>
                  <td className={ui.td}>{fmtData(se.dataHora)}</td>
                  <td className={ui.td}>
                    {se.tipoSessao?.nome ? (
                      <span className={`${ui.badge} bg-primary/10 text-primary`}>{se.tipoSessao.nome}</span>
                    ) : (
                      <span className="text-fg/50">—</span>
                    )}
                  </td>
                  <td className={ui.td}>
                    <span className="font-medium">{se.titulo}</span>
                    {se.local && (
                      <>
                        <br />
                        <span className="text-xs text-fg/60">{se.local}</span>
                      </>
                    )}
                  </td>
                  <td className={ui.td}>
                    <span className={`${ui.badge} ${corStatusSessao(se.status)}`}>
                      {rotuloStatusSessao(se.status)}
                    </span>
                    {se.ataPublicadaEm && (
                      <span className={`${ui.badge} ml-1 bg-success/10 text-success`}>Ata</span>
                    )}
                  </td>
                  <td className={ui.td}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={ui.btn}
                        onClick={() => setGerindo(se)}
                        aria-label={`Gerenciar sessão "${se.titulo}"`}
                      >
                        Gerenciar
                      </button>
                      <button
                        type="button"
                        className={ui.btnGhost}
                        onClick={() => abrirEditar(se)}
                        aria-label={`Editar sessão "${se.titulo}"`}
                      >
                        Editar
                      </button>
                      {confirmandoId === se.id ? (
                        <>
                          <button
                            type="button"
                            className={ui.btnDanger}
                            onClick={() => excluir(se.id)}
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
                          onClick={() => setConfirmandoId(se.id)}
                          aria-label={`Excluir sessão "${se.titulo}"`}
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
        <nav aria-label="Paginação de sessões" className="flex items-center gap-2 pt-2">
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

      <ModalSessao
        open={modalAberto}
        editando={editando}
        tipos={tipos}
        onClose={() => setModalAberto(false)}
        onSalvo={() => {
          setMsgOk(editando ? 'Sessão atualizada com sucesso.' : 'Sessão criada com sucesso.');
          carregar();
        }}
      />

      <ModalTipos
        open={tiposAberto}
        onClose={() => setTiposAberto(false)}
        onMudou={carregarTipos}
      />
    </div>
  );
}
