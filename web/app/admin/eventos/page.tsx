'use client';

/**
 * Admin — Eventos (audiências públicas, palestras, seminários, solenidades).
 *
 *   GET    /api/admin/eventos?page=&pageSize=   (lista paginada)
 *   POST   /api/admin/eventos                   (criar)
 *   PUT    /api/admin/eventos/:id               (atualizar)
 *   DELETE /api/admin/eventos/:id               (excluir)
 *
 * CRUD em ModalEvento; gestão de inscritos/presença/certificados em Inscricoes.
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
import ModalEvento from './ModalEvento';
import Inscricoes from './Inscricoes';
import { rotuloTipo, type EventoAdmin } from './tipos';

const PAGE_SIZE = 20;

function fmtData(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function EventosAdminPage() {
  const [eventos, setEventos] = useState<EventoAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<EventoAdmin | null>(null);

  const [inscricoesDe, setInscricoesDe] = useState<EventoAdmin | null>(null);

  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const data = await adminGet<Pagina<EventoAdmin>>(
        `/api/admin/eventos${qs({ page, pageSize: PAGE_SIZE })}`,
      );
      setEventos(data.items);
      setTotal(data.total);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar eventos.');
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
  function abrirEditar(ev: EventoAdmin) {
    setEditando(ev);
    setModalAberto(true);
  }

  async function excluir(id: string) {
    setExcluindo(true);
    setErro('');
    try {
      await adminDelete(`/api/admin/eventos/${id}`);
      setMsgOk('Evento excluído com sucesso.');
      setConfirmandoId(null);
      carregar();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao excluir o evento.');
    } finally {
      setExcluindo(false);
    }
  }

  const totalPaginas = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <AdminHeader
        title="Eventos"
        description="Audiências públicas, palestras, seminários e solenidades: agenda, inscrições e certificados."
      >
        <button type="button" className={ui.btn} onClick={abrirNovo}>
          + Novo evento
        </button>
      </AdminHeader>

      {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {carregando ? (
        <p aria-live="polite" aria-busy="true" className="py-12 text-center text-sm text-fg/60">
          Carregando eventos…
        </p>
      ) : eventos.length === 0 ? (
        <p className="py-12 text-center text-sm text-fg/60">
          Nenhum evento cadastrado. Clique em &ldquo;Novo evento&rdquo; para começar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm" aria-label="Lista de eventos">
            <thead>
              <tr>
                <th scope="col" className={ui.th}>
                  Data
                </th>
                <th scope="col" className={ui.th}>
                  Título
                </th>
                <th scope="col" className={ui.th}>
                  Tipo
                </th>
                <th scope="col" className={ui.th}>
                  Inscrições
                </th>
                <th scope="col" className={ui.th}>
                  Situação
                </th>
                <th scope="col" className={ui.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((ev) => (
                <tr key={ev.id}>
                  <td className={ui.td}>{fmtData(ev.dataHora)}</td>
                  <td className={ui.td}>
                    <span className="font-medium">{ev.titulo}</span>
                    {ev.local && (
                      <>
                        <br />
                        <span className="text-xs text-fg/60">{ev.local}</span>
                      </>
                    )}
                  </td>
                  <td className={ui.td}>
                    <span className={`${ui.badge} bg-primary/10 text-primary`}>{rotuloTipo(ev.tipo)}</span>
                  </td>
                  <td className={ui.td}>
                    <span
                      className={`${ui.badge} ${
                        ev.inscricoesAbertas ? 'bg-success/10 text-success' : 'bg-muted text-fg/60'
                      }`}
                    >
                      {ev.inscricoesAbertas ? 'Abertas' : 'Encerradas'}
                    </span>
                    {ev.certificavel && (
                      <span className={`${ui.badge} ml-1 bg-muted text-fg`}>Certificável</span>
                    )}
                  </td>
                  <td className={ui.td}>
                    <span
                      className={`${ui.badge} ${
                        ev.publicado ? 'bg-success/10 text-success' : 'bg-muted text-fg/60'
                      }`}
                    >
                      {ev.publicado ? 'Publicado' : 'Rascunho'}
                    </span>
                    {!ev.ativo && <span className={`${ui.badge} ml-1 bg-muted text-fg/60`}>Inativo</span>}
                  </td>
                  <td className={ui.td}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={ui.btnGhost}
                        onClick={() => setInscricoesDe(ev)}
                        aria-label={`Ver inscrições do evento "${ev.titulo}"`}
                      >
                        Inscrições
                      </button>
                      <button
                        type="button"
                        className={ui.btnGhost}
                        onClick={() => abrirEditar(ev)}
                        aria-label={`Editar evento "${ev.titulo}"`}
                      >
                        Editar
                      </button>
                      {confirmandoId === ev.id ? (
                        <>
                          <button
                            type="button"
                            className={ui.btnDanger}
                            onClick={() => excluir(ev.id)}
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
                          onClick={() => setConfirmandoId(ev.id)}
                          aria-label={`Excluir evento "${ev.titulo}"`}
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
        <nav aria-label="Paginação de eventos" className="flex items-center gap-2 pt-2">
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

      <ModalEvento
        open={modalAberto}
        editando={editando}
        onClose={() => setModalAberto(false)}
        onSalvo={() => {
          setMsgOk(editando ? 'Evento atualizado com sucesso.' : 'Evento criado com sucesso.');
          carregar();
        }}
      />

      <Inscricoes
        open={inscricoesDe !== null}
        evento={inscricoesDe}
        onClose={() => setInscricoesDe(null)}
      />
    </div>
  );
}
