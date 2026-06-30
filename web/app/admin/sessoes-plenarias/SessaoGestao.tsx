'use client';

/**
 * SessaoGestao — gestão (drill-down) de uma sessão plenária, em abas:
 *   Pauta · Presenças · Ata · Gravações (TV Câmara)
 *
 * Endpoints admin (prefixo /api):
 *   GET    /admin/sessoes/:id                       (detalhe c/ pauta, presenças, gravações)
 *   POST   /admin/sessoes/:id/pauta · PUT /admin/sessoes/pauta/:itemId · DELETE .../pauta/:itemId
 *   POST   /admin/sessoes/:id/presencas (lote)      · DELETE /admin/sessoes/presencas/:presencaId
 *   PUT    /admin/sessoes/:id/ata                   (ataConteudo + publicar)
 *   POST   /admin/sessoes/:id/gravacoes · DELETE /admin/sessoes/gravacoes/:gravacaoId
 *   GET    /admin/parlamentar/vereadores            (opções de presença)
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AdminApiError,
  adminDelete,
  adminGet,
  adminPost,
  adminPut,
  qs,
  type Pagina,
} from '../../../lib/admin-api';
import { Aviso, ui } from '../_components/ui';
import {
  SITUACOES_PRESENCA,
  corSituacaoPresenca,
  rotuloSituacaoPresenca,
  rotuloStatusSessao,
  type GravacaoAdmin,
  type PautaItemAdmin,
  type PresencaAdmin,
  type SessaoAdmin,
  type SessaoDetalhe,
  type VereadorOpcao,
} from './tipos';

function fmtData(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Abas ────────────────────────────────────────────────────────────────────

type Aba = 'pauta' | 'presencas' | 'ata' | 'gravacoes';

const ABAS: { id: Aba; label: string }[] = [
  { id: 'pauta', label: 'Pauta' },
  { id: 'presencas', label: 'Presenças' },
  { id: 'ata', label: 'Ata' },
  { id: 'gravacoes', label: 'Gravações (TV Câmara)' },
];

export default function SessaoGestao({
  sessao,
  onVoltar,
  onSessaoAlterada,
}: {
  sessao: SessaoAdmin;
  onVoltar: () => void;
  onSessaoAlterada: () => void;
}) {
  const [aba, setAba] = useState<Aba>('pauta');
  const [detalhe, setDetalhe] = useState<SessaoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const sessaoId = sessao.id;

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const d = await adminGet<SessaoDetalhe>(`/api/admin/sessoes/${sessaoId}`);
      setDetalhe(d);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar a sessão.');
    } finally {
      setCarregando(false);
    }
  }, [sessaoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" className={ui.btnGhost} onClick={onVoltar}>
            ← Voltar à lista
          </button>
          <h2 className="mt-2 font-heading text-xl font-bold">{sessao.titulo}</h2>
          <p className="text-sm text-fg/70">
            {fmtData(sessao.dataHora)} ·{' '}
            <span className="font-semibold">{rotuloStatusSessao(sessao.status)}</span>
            {sessao.tipoSessao?.nome && (
              <span className={`${ui.badge} ml-2 bg-primary/10 text-primary`}>
                {sessao.tipoSessao.nome}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Abas */}
      <div className="border-b border-border" role="tablist" aria-label="Seções de gestão da sessão">
        <div className="flex flex-wrap gap-1">
          {ABAS.map((a) => {
            const ativo = aba === a.id;
            return (
              <button
                key={a.id}
                type="button"
                role="tab"
                id={`tab-sessao-${a.id}`}
                aria-selected={ativo}
                aria-controls={`painel-sessao-${a.id}`}
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

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {carregando ? (
        <p aria-live="polite" aria-busy="true" className="py-10 text-center text-sm text-fg/60">
          Carregando sessão…
        </p>
      ) : !detalhe ? (
        <p className="py-10 text-center text-sm text-fg/60">Não foi possível carregar a sessão.</p>
      ) : (
        <div role="tabpanel" id={`painel-sessao-${aba}`} aria-labelledby={`tab-sessao-${aba}`}>
          {aba === 'pauta' && (
            <SecaoPauta sessaoId={sessaoId} itens={detalhe.pautaItens} onMudou={carregar} />
          )}
          {aba === 'presencas' && (
            <SecaoPresencas sessaoId={sessaoId} presencas={detalhe.presencas} onMudou={carregar} />
          )}
          {aba === 'ata' && (
            <SecaoAta
              sessaoId={sessaoId}
              ataConteudo={detalhe.ataConteudo}
              ataPublicadaEm={detalhe.ataPublicadaEm}
              onMudou={() => {
                carregar();
                onSessaoAlterada();
              }}
            />
          )}
          {aba === 'gravacoes' && (
            <SecaoGravacoes sessaoId={sessaoId} gravacoes={detalhe.gravacoes} onMudou={carregar} />
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════ Pauta

function SecaoPauta({
  sessaoId,
  itens,
  onMudou,
}: {
  sessaoId: string;
  itens: PautaItemAdmin[];
  onMudou: () => void;
}) {
  const vazia = { titulo: '', descricao: '', proposicaoId: '', ordem: '0' };
  const [novo, setNovo] = useState({ ...vazia });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  function editar(item: PautaItemAdmin) {
    setEditandoId(item.id);
    setNovo({
      titulo: item.titulo,
      descricao: item.descricao ?? '',
      proposicaoId: item.proposicaoId ?? '',
      ordem: String(item.ordem ?? 0),
    });
  }
  function cancelar() {
    setEditandoId(null);
    setNovo({ ...vazia });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!novo.titulo.trim()) {
      setErro('Informe o título do item de pauta.');
      return;
    }
    setSalvando(true);
    setErro('');
    const body = {
      titulo: novo.titulo.trim(),
      descricao: novo.descricao.trim() || undefined,
      proposicaoId: novo.proposicaoId.trim() || undefined,
      ordem: novo.ordem !== '' ? Number(novo.ordem) : undefined,
    };
    try {
      if (editandoId) {
        await adminPut(`/api/admin/sessoes/pauta/${editandoId}`, body);
      } else {
        await adminPost(`/api/admin/sessoes/${sessaoId}/pauta`, body);
      }
      cancelar();
      onMudou();
    } catch (err) {
      setErro(err instanceof AdminApiError ? err.message : 'Erro ao salvar o item de pauta.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    setExcluindoId(id);
    setErro('');
    try {
      await adminDelete(`/api/admin/sessoes/pauta/${id}`);
      setConfirmandoId(null);
      if (editandoId === id) cancelar();
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao excluir o item de pauta.');
    } finally {
      setExcluindoId(null);
    }
  }

  const ordenados = [...itens].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="space-y-4">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <form onSubmit={salvar} className="space-y-3 rounded border border-border p-3" noValidate>
        <p className="text-sm font-semibold">{editandoId ? 'Editar item de pauta' : 'Novo item de pauta'}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-3">
            <label htmlFor="pa-titulo" className={ui.label}>
              Título <span aria-hidden="true">*</span>
            </label>
            <input
              id="pa-titulo"
              type="text"
              required
              className={ui.input}
              value={novo.titulo}
              onChange={(e) => setNovo((p) => ({ ...p, titulo: e.target.value }))}
              placeholder="ex.: Projeto de Lei nº 045/2026"
            />
          </div>
          <div>
            <label htmlFor="pa-ordem" className={ui.label}>
              Ordem
            </label>
            <input
              id="pa-ordem"
              type="number"
              className={ui.input}
              value={novo.ordem}
              onChange={(e) => setNovo((p) => ({ ...p, ordem: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label htmlFor="pa-descricao" className={ui.label}>
            Descrição <span className="text-fg/50">(opcional)</span>
          </label>
          <textarea
            id="pa-descricao"
            rows={2}
            className={ui.input}
            value={novo.descricao}
            onChange={(e) => setNovo((p) => ({ ...p, descricao: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="pa-prop" className={ui.label}>
            ID da proposição <span className="text-fg/50">(opcional)</span>
          </label>
          <input
            id="pa-prop"
            type="text"
            className={ui.input}
            value={novo.proposicaoId}
            onChange={(e) => setNovo((p) => ({ ...p, proposicaoId: e.target.value }))}
            placeholder="UUID da proposição vinculada"
            aria-describedby="pa-prop-hint"
          />
          <p id="pa-prop-hint" className="mt-1 text-xs text-fg/60">
            Vincula o item a uma proposição do Legislativo, quando aplicável.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          {editandoId && (
            <button type="button" className={ui.btnGhost} onClick={cancelar} disabled={salvando}>
              Cancelar edição
            </button>
          )}
          <button type="submit" className={ui.btn} disabled={salvando} aria-busy={salvando}>
            {salvando ? 'Salvando…' : editandoId ? 'Salvar alterações' : 'Adicionar item'}
          </button>
        </div>
      </form>

      {ordenados.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg/60">Nenhum item de pauta cadastrado.</p>
      ) : (
        <ol className="space-y-2">
          {ordenados.map((item) => (
            <li key={item.id} className={`flex flex-wrap items-start justify-between gap-3 p-3 ${ui.card}`}>
              <div className="min-w-0">
                <p className="font-medium">
                  <span className="mr-2 text-fg/50">{item.ordem}.</span>
                  {item.titulo}
                </p>
                {item.descricao && <p className="mt-1 text-sm text-fg/70">{item.descricao}</p>}
                {item.proposicaoId && (
                  <p className="mt-1 text-xs text-fg/50">Proposição: {item.proposicaoId}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={ui.btnGhost}
                  onClick={() => editar(item)}
                  aria-label={`Editar item "${item.titulo}"`}
                >
                  Editar
                </button>
                {confirmandoId === item.id ? (
                  <>
                    <button
                      type="button"
                      className={ui.btnDanger}
                      onClick={() => excluir(item.id)}
                      disabled={excluindoId === item.id}
                      aria-busy={excluindoId === item.id}
                    >
                      {excluindoId === item.id ? 'Excluindo…' : 'Confirmar'}
                    </button>
                    <button
                      type="button"
                      className={ui.btnGhost}
                      onClick={() => setConfirmandoId(null)}
                      disabled={excluindoId === item.id}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={ui.btnDanger}
                    onClick={() => setConfirmandoId(item.id)}
                    aria-label={`Excluir item "${item.titulo}"`}
                  >
                    Excluir
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ Presenças

function SecaoPresencas({
  sessaoId,
  presencas,
  onMudou,
}: {
  sessaoId: string;
  presencas: PresencaAdmin[];
  onMudou: () => void;
}) {
  const [vereadores, setVereadores] = useState<VereadorOpcao[]>([]);
  const [carregandoV, setCarregandoV] = useState(true);
  const [vereadorId, setVereadorId] = useState('');
  const [situacao, setSituacao] = useState('presente');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCarregandoV(true);
      try {
        const data = await adminGet<Pagina<VereadorOpcao>>(
          `/api/admin/parlamentar/vereadores${qs({ page: 1, pageSize: 100 })}`,
        );
        if (!cancelado) setVereadores(data.items);
      } catch (e) {
        if (!cancelado) {
          setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar os vereadores.');
        }
      } finally {
        if (!cancelado) setCarregandoV(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const presentesIds = new Set(presencas.map((p) => p.vereadorId));
  const disponiveis = vereadores.filter((v) => !presentesIds.has(v.id));

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (!vereadorId) {
      setErro('Selecione o vereador.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await adminPost(`/api/admin/sessoes/${sessaoId}/presencas`, {
        presencas: [{ vereadorId, situacao, observacao: observacao.trim() || undefined }],
      });
      setVereadorId('');
      setSituacao('presente');
      setObservacao('');
      onMudou();
    } catch (err) {
      setErro(err instanceof AdminApiError ? err.message : 'Erro ao registrar a presença.');
    } finally {
      setSalvando(false);
    }
  }

  /** Altera a situação de uma presença já registrada (upsert por sessão+vereador). */
  async function alterarSituacao(p: PresencaAdmin, novaSituacao: string) {
    if (novaSituacao === p.situacao) return;
    setExcluindoId(p.id); // reaproveita o flag de "ocupado" para desabilitar a linha
    setErro('');
    try {
      await adminPost(`/api/admin/sessoes/${sessaoId}/presencas`, {
        presencas: [{ vereadorId: p.vereadorId, situacao: novaSituacao, observacao: p.observacao ?? undefined }],
      });
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao atualizar a presença.');
    } finally {
      setExcluindoId(null);
    }
  }

  async function excluir(id: string) {
    setExcluindoId(id);
    setErro('');
    try {
      await adminDelete(`/api/admin/sessoes/presencas/${id}`);
      setConfirmandoId(null);
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao remover a presença.');
    } finally {
      setExcluindoId(null);
    }
  }

  function nomeVereador(p: PresencaAdmin): string {
    return (
      p.vereador?.nomeParlamentar ??
      vereadores.find((v) => v.id === p.vereadorId)?.nomeParlamentar ??
      p.vereadorId
    );
  }

  const presentes = presencas.filter((p) => p.situacao === 'presente').length;
  const justificados = presencas.filter((p) => p.situacao === 'justificado').length;
  const ausentes = presencas.filter((p) => p.situacao === 'ausente').length;

  return (
    <div className="space-y-4">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <p className="text-sm text-fg/70" aria-live="polite">
        {presencas.length} registro(s) · {presentes} presente(s) · {justificados} justificado(s) ·{' '}
        {ausentes} ausente(s)
      </p>

      <form onSubmit={registrar} className="space-y-3 rounded border border-border p-3" noValidate>
        <p className="text-sm font-semibold">Registrar presença</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="pr-vereador" className={ui.label}>
              Vereador <span aria-hidden="true">*</span>
            </label>
            <select
              id="pr-vereador"
              className={ui.input}
              value={vereadorId}
              onChange={(e) => setVereadorId(e.target.value)}
              disabled={carregandoV}
            >
              <option value="">{carregandoV ? 'Carregando…' : '— Selecione —'}</option>
              {disponiveis.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nomeParlamentar}
                  {v.partido ? ` (${v.partido})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pr-situacao" className={ui.label}>
              Situação
            </label>
            <select
              id="pr-situacao"
              className={ui.input}
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
            >
              {SITUACOES_PRESENCA.map((st) => (
                <option key={st.v} value={st.v}>
                  {st.l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pr-obs" className={ui.label}>
              Observação <span className="text-fg/50">(opcional)</span>
            </label>
            <input
              id="pr-obs"
              type="text"
              className={ui.input}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="ex.: justificativa médica"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className={ui.btn}
            disabled={salvando || carregandoV}
            aria-busy={salvando}
          >
            {salvando ? 'Registrando…' : 'Registrar presença'}
          </button>
        </div>
      </form>

      {presencas.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg/60">Nenhuma presença registrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm" aria-label="Presenças da sessão">
            <thead>
              <tr>
                <th scope="col" className={ui.th}>Vereador</th>
                <th scope="col" className={ui.th}>Situação</th>
                <th scope="col" className={ui.th}>Observação</th>
                <th scope="col" className={ui.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {presencas.map((p) => {
                const ocupado = excluindoId === p.id;
                return (
                  <tr key={p.id}>
                    <td className={ui.td}>
                      <span className="font-medium">{nomeVereador(p)}</span>
                    </td>
                    <td className={ui.td}>
                      <label htmlFor={`sit-${p.id}`} className="sr-only">
                        Situação de {nomeVereador(p)}
                      </label>
                      <select
                        id={`sit-${p.id}`}
                        className={`${ui.input} ${corSituacaoPresenca(p.situacao)}`}
                        value={p.situacao}
                        disabled={ocupado}
                        onChange={(e) => alterarSituacao(p, e.target.value)}
                        aria-label={`Situação de ${nomeVereador(p)}: ${rotuloSituacaoPresenca(p.situacao)}`}
                      >
                        {SITUACOES_PRESENCA.map((st) => (
                          <option key={st.v} value={st.v}>
                            {st.l}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={ui.td}>{p.observacao || '—'}</td>
                    <td className={ui.td}>
                      <div className="flex flex-wrap gap-2">
                        {confirmandoId === p.id ? (
                          <>
                            <button
                              type="button"
                              className={ui.btnDanger}
                              onClick={() => excluir(p.id)}
                              disabled={ocupado}
                              aria-busy={ocupado}
                            >
                              {ocupado ? 'Removendo…' : 'Confirmar'}
                            </button>
                            <button
                              type="button"
                              className={ui.btnGhost}
                              onClick={() => setConfirmandoId(null)}
                              disabled={ocupado}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={ui.btnDanger}
                            onClick={() => setConfirmandoId(p.id)}
                            disabled={ocupado}
                            aria-label={`Remover presença de ${nomeVereador(p)}`}
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════ Ata

function SecaoAta({
  sessaoId,
  ataConteudo,
  ataPublicadaEm,
  onMudou,
}: {
  sessaoId: string;
  ataConteudo?: string | null;
  ataPublicadaEm?: string | null;
  onMudou: () => void;
}) {
  const [conteudo, setConteudo] = useState(ataConteudo ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');

  // Ressincroniza quando o detalhe é recarregado (ex.: após publicar).
  useEffect(() => {
    setConteudo(ataConteudo ?? '');
  }, [ataConteudo]);

  const publicada = !!ataPublicadaEm;

  /** PUT /ata com ataConteudo e, opcionalmente, alteração de publicação. */
  async function enviar(publicar?: boolean) {
    setSalvando(true);
    setErro('');
    setMsgOk('');
    const body: { ataConteudo: string; publicar?: boolean } = { ataConteudo: conteudo };
    if (publicar !== undefined) body.publicar = publicar;
    try {
      await adminPut(`/api/admin/sessoes/${sessaoId}/ata`, body);
      setMsgOk(
        publicar === true
          ? 'Ata publicada com sucesso.'
          : publicar === false
            ? 'Ata despublicada (oculta no portal).'
            : 'Conteúdo da ata salvo.',
      );
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao salvar a ata.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`${ui.badge} ${
            publicada ? 'bg-success/10 text-success' : 'bg-muted text-fg/60'
          }`}
        >
          {publicada ? 'Publicada' : 'Não publicada'}
        </span>
        {publicada && (
          <span className="text-xs text-fg/60">
            Publicada em{' '}
            {new Date(ataPublicadaEm!).toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="ata-conteudo" className={ui.label}>
          Conteúdo da ata <span className="text-fg/50">(aceita HTML)</span>
        </label>
        <textarea
          id="ata-conteudo"
          rows={14}
          className={ui.input}
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder="<p>Aos … dias do mês de … reuniram-se os vereadores …</p>"
          aria-describedby="ata-hint"
        />
        <p id="ata-hint" className="mt-1 text-xs text-fg/60">
          O conteúdo só fica visível no portal após a publicação.
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className={ui.btnGhost}
          onClick={() => enviar(undefined)}
          disabled={salvando}
          aria-busy={salvando}
        >
          Salvar rascunho
        </button>
        {publicada ? (
          <button
            type="button"
            className={ui.btnDanger}
            onClick={() => enviar(false)}
            disabled={salvando}
            aria-busy={salvando}
          >
            Despublicar
          </button>
        ) : (
          <button
            type="button"
            className={ui.btn}
            onClick={() => enviar(true)}
            disabled={salvando}
            aria-busy={salvando}
          >
            Salvar e publicar
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════ Gravações (TV)

function SecaoGravacoes({
  sessaoId,
  gravacoes,
  onMudou,
}: {
  sessaoId: string;
  gravacoes: GravacaoAdmin[];
  onMudou: () => void;
}) {
  const vazia = { titulo: '', videoUrl: '', duracao: '', ordem: '0' };
  const [novo, setNovo] = useState({ ...vazia });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!novo.titulo.trim()) {
      setErro('Informe o título da gravação.');
      return;
    }
    if (!novo.videoUrl.trim()) {
      setErro('Informe a URL ou o embed do vídeo.');
      return;
    }
    setSalvando(true);
    setErro('');
    const body = {
      titulo: novo.titulo.trim(),
      videoUrl: novo.videoUrl.trim(),
      duracao: novo.duracao !== '' ? Number(novo.duracao) : undefined,
      ordem: novo.ordem !== '' ? Number(novo.ordem) : undefined,
    };
    try {
      await adminPost(`/api/admin/sessoes/${sessaoId}/gravacoes`, body);
      setNovo({ ...vazia });
      onMudou();
    } catch (err) {
      setErro(err instanceof AdminApiError ? err.message : 'Erro ao adicionar a gravação.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    setExcluindoId(id);
    setErro('');
    try {
      await adminDelete(`/api/admin/sessoes/gravacoes/${id}`);
      setConfirmandoId(null);
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao remover a gravação.');
    } finally {
      setExcluindoId(null);
    }
  }

  const ordenadas = [...gravacoes].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="space-y-4">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <form onSubmit={adicionar} className="space-y-3 rounded border border-border p-3" noValidate>
        <p className="text-sm font-semibold">Nova gravação (TV Câmara)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="gr-titulo" className={ui.label}>
              Título <span aria-hidden="true">*</span>
            </label>
            <input
              id="gr-titulo"
              type="text"
              required
              className={ui.input}
              value={novo.titulo}
              onChange={(e) => setNovo((p) => ({ ...p, titulo: e.target.value }))}
              placeholder="ex.: Bloco 1 — Pequeno Expediente"
            />
          </div>
          <div>
            <label htmlFor="gr-duracao" className={ui.label}>
              Duração (min)
            </label>
            <input
              id="gr-duracao"
              type="number"
              min={0}
              className={ui.input}
              value={novo.duracao}
              onChange={(e) => setNovo((p) => ({ ...p, duracao: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="gr-ordem" className={ui.label}>
              Ordem
            </label>
            <input
              id="gr-ordem"
              type="number"
              className={ui.input}
              value={novo.ordem}
              onChange={(e) => setNovo((p) => ({ ...p, ordem: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label htmlFor="gr-url" className={ui.label}>
            URL / embed do vídeo <span aria-hidden="true">*</span>
          </label>
          <input
            id="gr-url"
            type="url"
            required
            className={ui.input}
            value={novo.videoUrl}
            onChange={(e) => setNovo((p) => ({ ...p, videoUrl: e.target.value }))}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" className={ui.btn} disabled={salvando} aria-busy={salvando}>
            {salvando ? 'Adicionando…' : 'Adicionar gravação'}
          </button>
        </div>
      </form>

      {ordenadas.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg/60">Nenhuma gravação cadastrada.</p>
      ) : (
        <ol className="space-y-2">
          {ordenadas.map((g) => (
            <li key={g.id} className={`flex flex-wrap items-start justify-between gap-3 p-3 ${ui.card}`}>
              <div className="min-w-0">
                <p className="font-medium">
                  <span className="mr-2 text-fg/50">{g.ordem}.</span>
                  {g.titulo}
                  {g.duracao != null && (
                    <span className="ml-2 text-xs text-fg/50">({g.duracao} min)</span>
                  )}
                </p>
                {g.videoUrl && (
                  <a
                    href={g.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block break-all text-sm text-primary underline"
                  >
                    {g.videoUrl}
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {confirmandoId === g.id ? (
                  <>
                    <button
                      type="button"
                      className={ui.btnDanger}
                      onClick={() => excluir(g.id)}
                      disabled={excluindoId === g.id}
                      aria-busy={excluindoId === g.id}
                    >
                      {excluindoId === g.id ? 'Removendo…' : 'Confirmar'}
                    </button>
                    <button
                      type="button"
                      className={ui.btnGhost}
                      onClick={() => setConfirmandoId(null)}
                      disabled={excluindoId === g.id}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={ui.btnDanger}
                    onClick={() => setConfirmandoId(g.id)}
                    aria-label={`Remover gravação "${g.titulo}"`}
                  >
                    Remover
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
