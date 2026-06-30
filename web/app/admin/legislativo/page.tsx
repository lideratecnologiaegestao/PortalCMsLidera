'use client';

/**
 * Admin — Legislativo (Proposições e Leis).
 *
 * Proposições (CRUD + gestão):
 *   GET    /api/admin/legislativo/proposicoes?page=&pageSize=   (lista paginada)
 *   GET    /api/admin/legislativo/proposicoes/:id               (detalhe c/ autores+tramitação+votação+emendas)
 *   POST   /api/admin/legislativo/proposicoes                   (criar — em ModalProposicao)
 *   PUT    /api/admin/legislativo/proposicoes/:id               (atualizar)
 *   DELETE /api/admin/legislativo/proposicoes/:id               (excluir)
 *   (tramitar / votação / emendas em ProposicaoGestao)
 *
 * Leis (CRUD):
 *   GET    /api/admin/legislativo/leis?page=&pageSize=          (lista paginada)
 *   POST   /api/admin/legislativo/leis                          (criar — em ModalLei)
 *   PATCH  /api/admin/legislativo/leis/:id                      (atualizar)
 *   DELETE /api/admin/legislativo/leis/:id                      (excluir)
 *
 * Os vereadores (módulo Parlamentar) são carregados uma vez para os seletores de
 * autoria, votação e emendas.
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
import type { VereadorAdmin } from '../parlamentar/tipos';
import ModalProposicao from './ModalProposicao';
import ModalLei from './ModalLei';
import ProposicaoGestao from './ProposicaoGestao';
import {
  rotuloStatusProposicao,
  rotuloTipoLei,
  rotuloTipoProposicao,
  type LeiAdmin,
  type ProposicaoAdmin,
  type ProposicaoDetalhe,
} from './tipos';

const PAGE_SIZE = 20;

function fmtData(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { dateStyle: 'short' });
}

function numeroAno(numero?: number | null, ano?: number | null): string {
  const partes = [numero, ano].filter((x) => x != null);
  return partes.length ? partes.join('/') : 's/nº';
}

// ═══════════════════════════════════════════════════════════════ Proposições

function AbaProposicoes({ vereadores }: { vereadores: VereadorAdmin[] }) {
  const [proposicoes, setProposicoes] = useState<ProposicaoAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<ProposicaoDetalhe | null>(null);
  const [abrindoEdicao, setAbrindoEdicao] = useState<string | null>(null);

  /** Proposição aberta em modo de gestão (drill-down). */
  const [gerindo, setGerindo] = useState<ProposicaoAdmin | null>(null);

  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const data = await adminGet<Pagina<ProposicaoAdmin>>(
        `/api/admin/legislativo/proposicoes${qs({ page, pageSize: PAGE_SIZE })}`,
      );
      setProposicoes(data.items);
      setTotal(data.total);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar proposições.');
    } finally {
      setCarregando(false);
    }
  }, [page]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirNova() {
    setEditando(null);
    setModalAberto(true);
  }

  async function abrirEditar(p: ProposicaoAdmin) {
    // Busca o detalhe (com autores) antes de abrir o modal de edição.
    setAbrindoEdicao(p.id);
    setErro('');
    try {
      const detalhe = await adminGet<ProposicaoDetalhe>(`/api/admin/legislativo/proposicoes/${p.id}`);
      setEditando(detalhe);
      setModalAberto(true);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar a proposição para edição.');
    } finally {
      setAbrindoEdicao(null);
    }
  }

  async function excluir(id: string) {
    setExcluindo(true);
    setErro('');
    try {
      await adminDelete(`/api/admin/legislativo/proposicoes/${id}`);
      setMsgOk('Proposição excluída com sucesso.');
      setConfirmandoId(null);
      carregar();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao excluir a proposição.');
    } finally {
      setExcluindo(false);
    }
  }

  const totalPaginas = Math.ceil(total / PAGE_SIZE);

  // ── Modo de gestão (drill-down) ──────────────────────────────────────────
  if (gerindo) {
    return (
      <ProposicaoGestao
        proposicao={gerindo}
        vereadores={vereadores}
        onVoltar={() => {
          setGerindo(null);
          carregar();
        }}
        onProposicaoAlterada={carregar}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg/70">
          Projetos de lei, requerimentos, moções e demais proposições: cadastro, tramitação, votação
          nominal e emendas.
        </p>
        <button type="button" className={ui.btn} onClick={abrirNova}>
          + Nova proposição
        </button>
      </div>

      {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {carregando ? (
        <p aria-live="polite" aria-busy="true" className="py-12 text-center text-sm text-fg/60">
          Carregando proposições…
        </p>
      ) : proposicoes.length === 0 ? (
        <p className="py-12 text-center text-sm text-fg/60">
          Nenhuma proposição cadastrada. Clique em &ldquo;Nova proposição&rdquo; para começar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm" aria-label="Lista de proposições">
            <thead>
              <tr>
                <th scope="col" className={ui.th}>Tipo</th>
                <th scope="col" className={ui.th}>Nº / Ano</th>
                <th scope="col" className={ui.th}>Ementa</th>
                <th scope="col" className={ui.th}>Fase</th>
                <th scope="col" className={ui.th}>Situação</th>
                <th scope="col" className={ui.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {proposicoes.map((p) => (
                <tr key={p.id}>
                  <td className={ui.td}>
                    <span className={`${ui.badge} bg-muted text-fg`}>{rotuloTipoProposicao(p.tipo)}</span>
                  </td>
                  <td className={ui.td}>
                    <span className="font-mono text-xs">{numeroAno(p.numero, p.ano)}</span>
                  </td>
                  <td className={ui.td}>
                    <span className="line-clamp-2 max-w-md">{p.ementa}</span>
                  </td>
                  <td className={ui.td}>
                    <span className={`${ui.badge} bg-primary/10 text-primary`}>
                      {rotuloStatusProposicao(p.statusAtual)}
                    </span>
                  </td>
                  <td className={ui.td}>
                    <span
                      className={`${ui.badge} ${
                        p.publicada ? 'bg-success/10 text-success' : 'bg-muted text-fg/60'
                      }`}
                    >
                      {p.publicada ? 'Publicada' : 'Rascunho'}
                    </span>
                  </td>
                  <td className={ui.td}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={ui.btn}
                        onClick={() => setGerindo(p)}
                        aria-label={`Gerenciar proposição ${numeroAno(p.numero, p.ano)}`}
                      >
                        Gerenciar
                      </button>
                      <button
                        type="button"
                        className={ui.btnGhost}
                        onClick={() => abrirEditar(p)}
                        disabled={abrindoEdicao === p.id}
                        aria-busy={abrindoEdicao === p.id}
                        aria-label={`Editar proposição ${numeroAno(p.numero, p.ano)}`}
                      >
                        {abrindoEdicao === p.id ? 'Abrindo…' : 'Editar'}
                      </button>
                      {confirmandoId === p.id ? (
                        <>
                          <button
                            type="button"
                            className={ui.btnDanger}
                            onClick={() => excluir(p.id)}
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
                          onClick={() => setConfirmandoId(p.id)}
                          aria-label={`Excluir proposição ${numeroAno(p.numero, p.ano)}`}
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
        <nav aria-label="Paginação de proposições" className="flex items-center gap-2 pt-2">
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

      <ModalProposicao
        open={modalAberto}
        editando={editando}
        vereadores={vereadores}
        onClose={() => setModalAberto(false)}
        onSalvo={(msg) => {
          setMsgOk(msg);
          carregar();
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ Leis

function AbaLeis() {
  const [leis, setLeis] = useState<LeiAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<LeiAdmin | null>(null);

  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const data = await adminGet<Pagina<LeiAdmin>>(
        `/api/admin/legislativo/leis${qs({ page, pageSize: PAGE_SIZE })}`,
      );
      setLeis(data.items);
      setTotal(data.total);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar leis.');
    } finally {
      setCarregando(false);
    }
  }, [page]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirNova() {
    setEditando(null);
    setModalAberto(true);
  }
  function abrirEditar(l: LeiAdmin) {
    setEditando(l);
    setModalAberto(true);
  }

  async function excluir(id: string) {
    setExcluindo(true);
    setErro('');
    try {
      await adminDelete(`/api/admin/legislativo/leis/${id}`);
      setMsgOk('Lei excluída com sucesso.');
      setConfirmandoId(null);
      carregar();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao excluir a lei.');
    } finally {
      setExcluindo(false);
    }
  }

  const totalPaginas = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg/70">
          Leis sancionadas, leis complementares, resoluções e decretos legislativos do município.
        </p>
        <button type="button" className={ui.btn} onClick={abrirNova}>
          + Nova lei
        </button>
      </div>

      {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {carregando ? (
        <p aria-live="polite" aria-busy="true" className="py-12 text-center text-sm text-fg/60">
          Carregando leis…
        </p>
      ) : leis.length === 0 ? (
        <p className="py-12 text-center text-sm text-fg/60">
          Nenhuma lei cadastrada. Clique em &ldquo;Nova lei&rdquo; para começar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm" aria-label="Lista de leis">
            <thead>
              <tr>
                <th scope="col" className={ui.th}>Tipo</th>
                <th scope="col" className={ui.th}>Número / Ano</th>
                <th scope="col" className={ui.th}>Ementa</th>
                <th scope="col" className={ui.th}>Sanção</th>
                <th scope="col" className={ui.th}>Situação</th>
                <th scope="col" className={ui.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {leis.map((l) => (
                <tr key={l.id}>
                  <td className={ui.td}>
                    <span className={`${ui.badge} bg-muted text-fg`}>{rotuloTipoLei(l.tipo)}</span>
                  </td>
                  <td className={ui.td}>
                    <span className="font-mono text-xs">
                      {l.numero}
                      {l.ano != null ? `/${l.ano}` : ''}
                    </span>
                  </td>
                  <td className={ui.td}>
                    <span className="line-clamp-2 max-w-md">{l.ementa}</span>
                  </td>
                  <td className={ui.td}>{fmtData(l.dataSancao)}</td>
                  <td className={ui.td}>
                    <span
                      className={`${ui.badge} ${
                        l.vigente ? 'bg-success/10 text-success' : 'bg-muted text-fg/60'
                      }`}
                    >
                      {l.vigente ? 'Vigente' : 'Revogada'}
                    </span>
                    {!l.publicada && (
                      <span className={`${ui.badge} ml-1 bg-muted text-fg/60`}>Rascunho</span>
                    )}
                  </td>
                  <td className={ui.td}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={ui.btnGhost}
                        onClick={() => abrirEditar(l)}
                        aria-label={`Editar lei ${l.numero}`}
                      >
                        Editar
                      </button>
                      {confirmandoId === l.id ? (
                        <>
                          <button
                            type="button"
                            className={ui.btnDanger}
                            onClick={() => excluir(l.id)}
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
                          onClick={() => setConfirmandoId(l.id)}
                          aria-label={`Excluir lei ${l.numero}`}
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
        <nav aria-label="Paginação de leis" className="flex items-center gap-2 pt-2">
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

      <ModalLei
        open={modalAberto}
        editando={editando}
        onClose={() => setModalAberto(false)}
        onSalvo={(msg) => {
          setMsgOk(msg);
          carregar();
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ Página

type Aba = 'proposicoes' | 'leis';

const ABAS: { id: Aba; label: string }[] = [
  { id: 'proposicoes', label: 'Proposições' },
  { id: 'leis', label: 'Leis' },
];

export default function LegislativoAdminPage() {
  const [aba, setAba] = useState<Aba>('proposicoes');
  const [vereadores, setVereadores] = useState<VereadorAdmin[]>([]);

  // Carrega os vereadores uma vez (seletores de autoria, votação e emendas).
  useEffect(() => {
    let ativo = true;
    adminGet<Pagina<VereadorAdmin>>('/api/admin/parlamentar/vereadores?page=1&pageSize=100')
      .then((data) => {
        if (ativo) setVereadores(data.items);
      })
      .catch(() => {
        /* falha silenciosa: os seletores ficam vazios, mas a tela continua usável. */
      });
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <AdminHeader
        title="Legislativo"
        description="Proposições (projetos de lei, requerimentos), tramitação, votação nominal, emendas e leis."
      />

      {/* Abas */}
      <div className="border-b border-border" role="tablist" aria-label="Seções do módulo Legislativo">
        <div className="flex flex-wrap gap-1">
          {ABAS.map((a) => {
            const ativo = aba === a.id;
            return (
              <button
                key={a.id}
                type="button"
                role="tab"
                id={`tab-leg-top-${a.id}`}
                aria-selected={ativo}
                aria-controls={`painel-leg-top-${a.id}`}
                onClick={() => setAba(a.id)}
                className={`-mb-px rounded-t border-b-2 px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary ${
                  ativo ? 'border-primary text-primary' : 'border-transparent text-fg/60 hover:text-fg'
                }`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id={`painel-leg-top-${aba}`} aria-labelledby={`tab-leg-top-${aba}`}>
        {aba === 'proposicoes' && <AbaProposicoes vereadores={vereadores} />}
        {aba === 'leis' && <AbaLeis />}
      </div>
    </div>
  );
}
