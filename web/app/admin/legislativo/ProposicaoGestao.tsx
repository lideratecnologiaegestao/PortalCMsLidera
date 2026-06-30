'use client';

/**
 * ProposicaoGestao — gestão (drill-down) de uma proposição, em abas:
 *   Tramitação · Votação nominal · Emendas
 *
 * Endpoints admin (prefixo /api):
 *   GET    /admin/legislativo/proposicoes/:id                   (detalhe)
 *   POST   /admin/legislativo/proposicoes/:id/tramitar          (nova fase — append-only)
 *   POST   /admin/legislativo/proposicoes/:id/votacao           (registrar votação nominal)
 *   POST   /admin/legislativo/proposicoes/:id/emendas           (adicionar emenda)
 *   DELETE /admin/legislativo/emendas/:eid                      (remover emenda)
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AdminApiError,
  adminDelete,
  adminGet,
  adminPost,
} from '../../../lib/admin-api';
import { Aviso, ui } from '../_components/ui';
import type { VereadorAdmin } from '../parlamentar/tipos';
import {
  OPCOES_VOTO,
  STATUS_PROPOSICAO,
  TIPOS_EMENDA,
  rotuloPapelAutor,
  rotuloStatusProposicao,
  rotuloTipoEmenda,
  rotuloTipoProposicao,
  rotuloVoto,
  type EmendaAdmin,
  type ProposicaoAdmin,
  type ProposicaoDetalhe,
  type TramitacaoAdmin,
  type VotacaoAdmin,
} from './tipos';

function fmtDataHora(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Abas ────────────────────────────────────────────────────────────────────

type Aba = 'tramitacao' | 'votacao' | 'emendas';

const ABAS: { id: Aba; label: string }[] = [
  { id: 'tramitacao', label: 'Tramitação' },
  { id: 'votacao', label: 'Votação nominal' },
  { id: 'emendas', label: 'Emendas' },
];

export default function ProposicaoGestao({
  proposicao,
  vereadores,
  onVoltar,
  onProposicaoAlterada,
}: {
  proposicao: ProposicaoAdmin;
  vereadores: VereadorAdmin[];
  onVoltar: () => void;
  onProposicaoAlterada: () => void;
}) {
  const [aba, setAba] = useState<Aba>('tramitacao');
  const [detalhe, setDetalhe] = useState<ProposicaoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const proposicaoId = proposicao.id;

  // Mapa vereadorId -> nome parlamentar, para resolver autores/votos.
  const nomeVereador = useCallback(
    (id?: string | null): string => {
      if (!id) return '—';
      return vereadores.find((v) => v.id === id)?.nomeParlamentar ?? id;
    },
    [vereadores],
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const d = await adminGet<ProposicaoDetalhe>(`/api/admin/legislativo/proposicoes/${proposicaoId}`);
      setDetalhe(d);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar a proposição.');
    } finally {
      setCarregando(false);
    }
  }, [proposicaoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const numeroAno = [proposicao.numero, proposicao.ano].filter((x) => x != null).join('/') || 's/nº';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" className={ui.btnGhost} onClick={onVoltar}>
            ← Voltar à lista
          </button>
          <h2 className="mt-2 font-heading text-xl font-bold">
            {rotuloTipoProposicao(proposicao.tipo)} nº {numeroAno}
          </h2>
          <p className="text-sm text-fg/70">
            Fase atual:{' '}
            <span className={`${ui.badge} bg-primary/10 text-primary`}>
              {rotuloStatusProposicao(detalhe?.statusAtual ?? proposicao.statusAtual)}
            </span>
          </p>
          <p className="mt-1 max-w-3xl text-sm text-fg/70">{proposicao.ementa}</p>
          {detalhe && detalhe.autores.length > 0 && (
            <p className="mt-1 text-xs text-fg/60">
              {detalhe.autores
                .map((a) => `${nomeVereador(a.vereadorId)} (${rotuloPapelAutor(a.papel)})`)
                .join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="border-b border-border" role="tablist" aria-label="Seções de gestão da proposição">
        <div className="flex flex-wrap gap-1">
          {ABAS.map((a) => {
            const ativo = aba === a.id;
            return (
              <button
                key={a.id}
                type="button"
                role="tab"
                id={`tab-leg-${a.id}`}
                aria-selected={ativo}
                aria-controls={`painel-leg-${a.id}`}
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
          Carregando proposição…
        </p>
      ) : !detalhe ? (
        <p className="py-10 text-center text-sm text-fg/60">Não foi possível carregar a proposição.</p>
      ) : (
        <div role="tabpanel" id={`painel-leg-${aba}`} aria-labelledby={`tab-leg-${aba}`}>
          {aba === 'tramitacao' && (
            <SecaoTramitacao
              proposicaoId={proposicaoId}
              statusAtual={detalhe.statusAtual}
              tramitacoes={detalhe.tramitacoes}
              onMudou={() => {
                carregar();
                onProposicaoAlterada();
              }}
            />
          )}
          {aba === 'votacao' && (
            <SecaoVotacao
              proposicaoId={proposicaoId}
              votacoes={detalhe.votacoes}
              vereadores={vereadores}
              nomeVereador={nomeVereador}
              onMudou={carregar}
            />
          )}
          {aba === 'emendas' && (
            <SecaoEmendas
              proposicaoId={proposicaoId}
              emendas={detalhe.emendas}
              vereadores={vereadores}
              nomeVereador={nomeVereador}
              onMudou={carregar}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ Tramitação

function SecaoTramitacao({
  proposicaoId,
  statusAtual,
  tramitacoes,
  onMudou,
}: {
  proposicaoId: string;
  statusAtual: string;
  tramitacoes: TramitacaoAdmin[];
  onMudou: () => void;
}) {
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');
  const [salvando, setSalvando] = useState(false);
  const vazia = { fase: '', despacho: '', comissaoId: '', relatorId: '', data: '' };
  const [novo, setNovo] = useState({ ...vazia });

  async function tramitar() {
    if (!novo.fase) {
      setErro('Selecione a nova fase.');
      return;
    }
    setSalvando(true);
    setErro('');
    setMsgOk('');
    try {
      await adminPost(`/api/admin/legislativo/proposicoes/${proposicaoId}/tramitar`, {
        fase: novo.fase,
        despacho: novo.despacho.trim() || undefined,
        comissaoId: novo.comissaoId.trim() || undefined,
        relatorId: novo.relatorId.trim() || undefined,
        data: novo.data || undefined,
      });
      setMsgOk(`Tramitação registrada (${rotuloStatusProposicao(novo.fase)}).`);
      setNovo({ ...vazia });
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao registrar a tramitação.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {/* Histórico append-only */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Histórico de tramitação</h3>
        {tramitacoes.length === 0 ? (
          <p className="text-sm text-fg/60">Nenhuma tramitação registrada.</p>
        ) : (
          <ol className="space-y-2">
            {tramitacoes.map((t) => (
              <li key={t.id} className="rounded border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`${ui.badge} bg-primary/10 text-primary`}>
                    {rotuloStatusProposicao(t.fase)}
                  </span>
                  <span className="text-xs text-fg/60">{fmtDataHora(t.data)}</span>
                </div>
                {t.despacho && <p className="mt-2 text-sm">{t.despacho}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Nova tramitação */}
      <div className="rounded border border-border p-3">
        <h3 className="mb-2 text-sm font-semibold">Registrar nova fase / despacho</h3>
        <p className="mb-3 text-xs text-fg/60">
          Fase atual:{' '}
          <span className="font-semibold">{rotuloStatusProposicao(statusAtual)}</span>. Cada registro é
          append-only e atualiza a fase atual da proposição.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="tr-fase" className={ui.label}>
              Nova fase
            </label>
            <select
              id="tr-fase"
              className={ui.input}
              value={novo.fase}
              onChange={(e) => setNovo({ ...novo, fase: e.target.value })}
            >
              <option value="">— Selecione</option>
              {STATUS_PROPOSICAO.map((st) => (
                <option key={st.v} value={st.v}>
                  {st.l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tr-data" className={ui.label}>
              Data / hora
            </label>
            <input
              id="tr-data"
              type="datetime-local"
              className={ui.input}
              value={novo.data}
              onChange={(e) => setNovo({ ...novo, data: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="tr-comissao" className={ui.label}>
              Comissão <span className="text-fg/50">(UUID, opcional)</span>
            </label>
            <input
              id="tr-comissao"
              className={ui.input}
              value={novo.comissaoId}
              onChange={(e) => setNovo({ ...novo, comissaoId: e.target.value })}
              placeholder="UUID da comissão"
            />
          </div>
          <div>
            <label htmlFor="tr-relator" className={ui.label}>
              Relator <span className="text-fg/50">(UUID, opcional)</span>
            </label>
            <input
              id="tr-relator"
              className={ui.input}
              value={novo.relatorId}
              onChange={(e) => setNovo({ ...novo, relatorId: e.target.value })}
              placeholder="UUID do vereador relator"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="tr-despacho" className={ui.label}>
              Despacho
            </label>
            <textarea
              id="tr-despacho"
              rows={2}
              className={ui.input}
              value={novo.despacho}
              onChange={(e) => setNovo({ ...novo, despacho: e.target.value })}
              placeholder="ex.: Encaminhada à Comissão de Constituição e Justiça para parecer."
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" className={ui.btn} onClick={tramitar} disabled={salvando} aria-busy={salvando}>
            {salvando ? 'Registrando…' : 'Registrar tramitação'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ Votação nominal

function SecaoVotacao({
  proposicaoId,
  votacoes,
  vereadores,
  nomeVereador,
  onMudou,
}: {
  proposicaoId: string;
  votacoes: VotacaoAdmin[];
  vereadores: VereadorAdmin[];
  nomeVereador: (id?: string | null) => string;
  onMudou: () => void;
}) {
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [turno, setTurno] = useState('');
  const [quorum, setQuorum] = useState('');
  const [data, setData] = useState('');
  // votos[vereadorId] = opção de voto (default 'ausente').
  const [votos, setVotos] = useState<Record<string, string>>({});

  function votoDe(id: string): string {
    return votos[id] ?? 'ausente';
  }
  function setVoto(id: string, v: string) {
    setVotos((m) => ({ ...m, [id]: v }));
  }

  // Apuração prévia (em tempo real) dos votos lançados no formulário.
  const apuracao = vereadores.reduce(
    (acc, v) => {
      const voto = votoDe(v.id);
      acc[voto] = (acc[voto] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  async function registrar() {
    if (vereadores.length === 0) {
      setErro('Cadastre vereadores no módulo Parlamentar para registrar a votação.');
      return;
    }
    setSalvando(true);
    setErro('');
    setMsgOk('');
    try {
      await adminPost(`/api/admin/legislativo/proposicoes/${proposicaoId}/votacao`, {
        turno: turno.trim() || undefined,
        quorum: quorum.trim() || undefined,
        data: data || undefined,
        votos: vereadores.map((v) => ({ vereadorId: v.id, voto: votoDe(v.id) })),
      });
      setMsgOk('Votação nominal registrada e apurada.');
      setVotos({});
      setTurno('');
      setQuorum('');
      setData('');
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao registrar a votação.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {/* Votações já registradas */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Votações registradas</h3>
        {votacoes.length === 0 ? (
          <p className="text-sm text-fg/60">Nenhuma votação registrada.</p>
        ) : (
          <ul className="space-y-3">
            {votacoes.map((v) => (
              <li key={v.id} className="rounded border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span
                      className={`${ui.badge} ${
                        v.resultado === 'aprovado'
                          ? 'bg-success/10 text-success'
                          : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {v.resultado === 'aprovado' ? 'Aprovado' : 'Rejeitado'}
                    </span>
                    {v.turno && <span className="ml-2 text-xs text-fg/60">Turno: {v.turno}</span>}
                  </span>
                  <span className="text-xs text-fg/60">{fmtDataHora(v.data)}</span>
                </div>
                <p className="mt-2 text-sm text-fg/70">
                  Favoráveis {v.favoraveis} · Contrários {v.contrarios} · Abstenções {v.abstencoes} ·
                  Ausentes {v.ausentes}
                </p>
                {v.votos.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {v.votos.map((vt) => (
                      <li key={vt.id} className={`${ui.badge} bg-muted text-fg`}>
                        {nomeVereador(vt.vereadorId)}: {rotuloVoto(vt.voto)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Nova votação nominal */}
      <div className="rounded border border-border p-3">
        <h3 className="mb-2 text-sm font-semibold">Registrar votação nominal</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <label htmlFor="vt-turno" className={ui.label}>
              Turno
            </label>
            <input
              id="vt-turno"
              className={ui.input}
              value={turno}
              onChange={(e) => setTurno(e.target.value)}
              placeholder="ex.: 1º turno"
            />
          </div>
          <div>
            <label htmlFor="vt-quorum" className={ui.label}>
              Quórum
            </label>
            <input
              id="vt-quorum"
              className={ui.input}
              value={quorum}
              onChange={(e) => setQuorum(e.target.value)}
              placeholder="ex.: maioria simples"
            />
          </div>
          <div>
            <label htmlFor="vt-data" className={ui.label}>
              Data / hora
            </label>
            <input
              id="vt-data"
              type="datetime-local"
              className={ui.input}
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
        </div>

        {vereadores.length === 0 ? (
          <p className="mt-3 text-sm text-fg/60">
            Nenhum vereador cadastrado. Cadastre vereadores no módulo Parlamentar para registrar a
            votação.
          </p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm" aria-label="Votos por vereador">
                <thead>
                  <tr>
                    <th scope="col" className={ui.th}>
                      Vereador
                    </th>
                    <th scope="col" className={ui.th}>
                      Voto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vereadores.map((v) => (
                    <tr key={v.id}>
                      <td className={ui.td}>
                        <span className="font-medium">{v.nomeParlamentar}</span>
                        {v.partido && <span className="ml-1 text-xs text-fg/60">({v.partido})</span>}
                      </td>
                      <td className={ui.td}>
                        <label htmlFor={`vt-voto-${v.id}`} className="sr-only">
                          Voto de {v.nomeParlamentar}
                        </label>
                        <select
                          id={`vt-voto-${v.id}`}
                          className={ui.input}
                          value={votoDe(v.id)}
                          onChange={(e) => setVoto(v.id, e.target.value)}
                        >
                          {OPCOES_VOTO.map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.l}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-2 text-xs text-fg/60" aria-live="polite">
              Apuração: Favoráveis {apuracao.favoravel ?? 0} · Contrários {apuracao.contrario ?? 0} ·
              Abstenções {apuracao.abstencao ?? 0} · Ausentes {apuracao.ausente ?? 0}
            </p>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className={ui.btn}
                onClick={registrar}
                disabled={salvando}
                aria-busy={salvando}
              >
                {salvando ? 'Registrando…' : 'Registrar e apurar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ Emendas

function SecaoEmendas({
  proposicaoId,
  emendas,
  vereadores,
  nomeVereador,
  onMudou,
}: {
  proposicaoId: string;
  emendas: EmendaAdmin[];
  vereadores: VereadorAdmin[];
  nomeVereador: (id?: string | null) => string;
  onMudou: () => void;
}) {
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const vazia = { numero: '', tipo: 'modificativa', texto: '', autorId: '' };
  const [novo, setNovo] = useState({ ...vazia });

  async function add() {
    if (!novo.texto.trim()) {
      setErro('Informe o texto da emenda.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await adminPost(`/api/admin/legislativo/proposicoes/${proposicaoId}/emendas`, {
        numero: novo.numero !== '' ? Number(novo.numero) : undefined,
        tipo: novo.tipo || undefined,
        texto: novo.texto.trim() || undefined,
        autorId: novo.autorId || undefined,
      });
      setNovo({ ...vazia });
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao adicionar a emenda.');
    } finally {
      setSalvando(false);
    }
  }

  async function del(id: string) {
    setErro('');
    try {
      await adminDelete(`/api/admin/legislativo/emendas/${id}`);
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao remover a emenda.');
    }
  }

  return (
    <div className="space-y-4">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {emendas.length === 0 ? (
        <p className="text-sm text-fg/60">Nenhuma emenda apresentada.</p>
      ) : (
        <ul className="space-y-2">
          {emendas.map((e) => (
            <li key={e.id} className="rounded border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className={`${ui.badge} bg-muted text-fg`}>{rotuloTipoEmenda(e.tipo)}</span>{' '}
                  <span className="font-semibold">Emenda nº {e.numero ?? '—'}</span>
                  <span className="ml-2 text-xs text-fg/60">{e.status}</span>
                  {e.autorId && (
                    <span className="ml-2 text-xs text-fg/60">· {nomeVereador(e.autorId)}</span>
                  )}
                </div>
                <button type="button" className="text-danger hover:underline" onClick={() => del(e.id)}>
                  remover
                </button>
              </div>
              {e.texto && <p className="mt-2 text-sm">{e.texto}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="rounded border border-border p-3">
        <h3 className="mb-2 text-sm font-semibold">Adicionar emenda</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="em-numero" className={ui.label}>
              Número
            </label>
            <input
              id="em-numero"
              type="number"
              min={0}
              className={ui.input}
              value={novo.numero}
              onChange={(e) => setNovo({ ...novo, numero: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="em-tipo" className={ui.label}>
              Tipo
            </label>
            <select
              id="em-tipo"
              className={ui.input}
              value={novo.tipo}
              onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}
            >
              {TIPOS_EMENDA.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="em-autor" className={ui.label}>
              Autor
            </label>
            <select
              id="em-autor"
              className={ui.input}
              value={novo.autorId}
              onChange={(e) => setNovo({ ...novo, autorId: e.target.value })}
            >
              <option value="">— Nenhum</option>
              {vereadores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nomeParlamentar}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="em-texto" className={ui.label}>
              Texto da emenda
            </label>
            <textarea
              id="em-texto"
              rows={2}
              className={ui.input}
              value={novo.texto}
              onChange={(e) => setNovo({ ...novo, texto: e.target.value })}
              placeholder="Descreva a alteração proposta."
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" className={ui.btn} onClick={add} disabled={salvando} aria-busy={salvando}>
            {salvando ? 'Adicionando…' : '+ Adicionar emenda'}
          </button>
        </div>
      </div>
    </div>
  );
}
