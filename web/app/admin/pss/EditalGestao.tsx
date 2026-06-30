'use client';

/**
 * EditalGestao — gestão (drill-down) de um edital de PSS, em abas:
 *   Vagas · Fases/Critérios · Anexos · Inscrições · Notas · Ranking · APLIC
 *
 * Endpoints admin (prefixo /api):
 *   GET    /admin/pss/editais/:id                      (detalhe c/ vagas, fases, critérios, anexos)
 *   POST   /admin/pss/editais/:id/vagas    · DELETE /admin/pss/vagas/:vid
 *   POST   /admin/pss/editais/:id/fases    · DELETE /admin/pss/fases/:fid
 *   POST   /admin/pss/fases/:fid/criterios · DELETE /admin/pss/criterios/:cid
 *   POST   /admin/pss/editais/:id/anexos   · DELETE /admin/pss/anexos/:aid
 *   GET    /admin/pss/editais/:id/inscricoes
 *   PUT    /admin/pss/inscricoes/:iid
 *   POST   /admin/pss/notas
 *   GET    /admin/pss/editais/:id/ranking/previa
 *   POST   /admin/pss/editais/:id/ranking/publicar
 *   POST/DELETE .../aplic/aberturas · .../aplic/comissao · .../aplic/tabela-salarial
 *   GET    /admin/pss/editais/:id/aplic/export
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AdminApiError,
  adminDelete,
  adminGet,
  adminPost,
  adminPut,
  qs,
} from '../../../lib/admin-api';
import { Aviso, ui } from '../_components/ui';
import MediaPicker from '../_components/MediaPicker';
import {
  CARGOS_COMISSAO,
  STATUS_INSCRICAO,
  TIPOS_ABERTURA,
  TIPOS_FASE,
  fmtMoeda,
  fmtNum,
  rotuloStatusEdital,
  rotuloStatusInscricao,
  rotuloTipoFase,
  type AberturaAdmin,
  type AnexoAdmin,
  type ComissaoMembroAdmin,
  type CriterioAdmin,
  type EditalAdmin,
  type EditalDetalhe,
  type FaseAdmin,
  type InscricaoAdmin,
  type RankingPrevia,
  type TabelaSalarialAdmin,
  type VagaAdmin,
} from './tipos';

function fmtData(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Abas ────────────────────────────────────────────────────────────────────

type Aba = 'vagas' | 'fases' | 'anexos' | 'inscricoes' | 'notas' | 'ranking' | 'aplic';

const ABAS: { id: Aba; label: string }[] = [
  { id: 'vagas', label: 'Vagas' },
  { id: 'fases', label: 'Fases / Critérios' },
  { id: 'anexos', label: 'Anexos' },
  { id: 'inscricoes', label: 'Inscrições' },
  { id: 'notas', label: 'Notas' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'aplic', label: 'APLIC' },
];

export default function EditalGestao({
  edital,
  onVoltar,
  onEditalAlterado,
}: {
  edital: EditalAdmin;
  onVoltar: () => void;
  onEditalAlterado: () => void;
}) {
  const [aba, setAba] = useState<Aba>('vagas');
  const [detalhe, setDetalhe] = useState<EditalDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const editalId = edital.id;

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const d = await adminGet<EditalDetalhe>(`/api/admin/pss/editais/${editalId}`);
      setDetalhe(d);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar o edital.');
    } finally {
      setCarregando(false);
    }
  }, [editalId]);

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
          <h2 className="mt-2 font-heading text-xl font-bold">
            {edital.numero} — {edital.titulo}
          </h2>
          <p className="text-sm text-fg/70">
            Situação: <span className="font-semibold">{rotuloStatusEdital(edital.status)}</span>
            {edital.rankingPublicado && (
              <span className={`${ui.badge} ml-2 bg-success/10 text-success`}>Ranking publicado</span>
            )}
          </p>
        </div>
      </div>

      {/* Abas */}
      <div className="border-b border-border" role="tablist" aria-label="Seções de gestão do edital">
        <div className="flex flex-wrap gap-1">
          {ABAS.map((a) => {
            const ativo = aba === a.id;
            return (
              <button
                key={a.id}
                type="button"
                role="tab"
                id={`tab-pss-${a.id}`}
                aria-selected={ativo}
                aria-controls={`painel-pss-${a.id}`}
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
          Carregando edital…
        </p>
      ) : !detalhe ? (
        <p className="py-10 text-center text-sm text-fg/60">Não foi possível carregar o edital.</p>
      ) : (
        <div role="tabpanel" id={`painel-pss-${aba}`} aria-labelledby={`tab-pss-${aba}`}>
          {aba === 'vagas' && (
            <SecaoVagas editalId={editalId} vagas={detalhe.vagas} onMudou={carregar} />
          )}
          {aba === 'fases' && (
            <SecaoFases editalId={editalId} fases={detalhe.fases} onMudou={carregar} />
          )}
          {aba === 'anexos' && (
            <SecaoAnexos editalId={editalId} anexos={detalhe.anexos} onMudou={carregar} />
          )}
          {aba === 'inscricoes' && <SecaoInscricoes editalId={editalId} />}
          {aba === 'notas' && <SecaoNotas editalId={editalId} fases={detalhe.fases} />}
          {aba === 'ranking' && (
            <SecaoRanking
              editalId={editalId}
              onPublicado={() => {
                carregar();
                onEditalAlterado();
              }}
            />
          )}
          {aba === 'aplic' && <SecaoAplic editalId={editalId} vagas={detalhe.vagas} />}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ Vagas

function SecaoVagas({
  editalId,
  vagas,
  onMudou,
}: {
  editalId: string;
  vagas: VagaAdmin[];
  onMudou: () => void;
}) {
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const vazia = {
    cargo: '',
    escolaridade: '',
    quantidade: '1',
    vagasCadastro: '0',
    requisitos: '',
    cargaHoraria: '',
    salario: '',
    ordem: '0',
  };
  const [novo, setNovo] = useState({ ...vazia });

  async function add() {
    if (!novo.cargo.trim()) {
      setErro('Informe o cargo da vaga.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await adminPost(`/api/admin/pss/editais/${editalId}/vagas`, {
        cargo: novo.cargo.trim(),
        escolaridade: novo.escolaridade.trim() || undefined,
        quantidade: novo.quantidade !== '' ? Number(novo.quantidade) : undefined,
        vagasCadastro: novo.vagasCadastro !== '' ? Number(novo.vagasCadastro) : undefined,
        requisitos: novo.requisitos.trim() || undefined,
        cargaHoraria: novo.cargaHoraria.trim() || undefined,
        salario: novo.salario !== '' ? Number(novo.salario) : undefined,
        ordem: novo.ordem !== '' ? Number(novo.ordem) : undefined,
      });
      setNovo({ ...vazia });
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao adicionar a vaga.');
    } finally {
      setSalvando(false);
    }
  }

  async function del(id: string) {
    setErro('');
    try {
      await adminDelete(`/api/admin/pss/vagas/${id}`);
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao remover a vaga.');
    }
  }

  return (
    <div className="space-y-4">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {vagas.length === 0 ? (
        <p className="text-sm text-fg/60">Nenhuma vaga cadastrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm" aria-label="Vagas do edital">
            <thead>
              <tr>
                <th scope="col" className={ui.th}>Cargo</th>
                <th scope="col" className={ui.th}>Escolaridade</th>
                <th scope="col" className={ui.th}>Vagas</th>
                <th scope="col" className={ui.th}>Cadastro reserva</th>
                <th scope="col" className={ui.th}>Carga horária</th>
                <th scope="col" className={ui.th}>Salário</th>
                <th scope="col" className={ui.th}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {vagas.map((v) => (
                <tr key={v.id}>
                  <td className={ui.td}><span className="font-medium">{v.cargo}</span></td>
                  <td className={ui.td}>{v.escolaridade || '—'}</td>
                  <td className={ui.td}>{fmtNum(v.quantidade)}</td>
                  <td className={ui.td}>{fmtNum(v.vagasCadastro)}</td>
                  <td className={ui.td}>{v.cargaHoraria || '—'}</td>
                  <td className={ui.td}>{fmtMoeda(v.salario)}</td>
                  <td className={ui.td}>
                    <button type="button" className="text-danger hover:underline" onClick={() => del(v.id)}>
                      remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded border border-border p-3">
        <h3 className="mb-2 text-sm font-semibold">Adicionar vaga</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label htmlFor="vg-cargo" className={ui.label}>Cargo</label>
            <input
              id="vg-cargo"
              className={ui.input}
              value={novo.cargo}
              onChange={(e) => setNovo({ ...novo, cargo: e.target.value })}
              placeholder="ex.: Professor de Educação Infantil"
            />
          </div>
          <div>
            <label htmlFor="vg-escolaridade" className={ui.label}>Escolaridade</label>
            <input
              id="vg-escolaridade"
              className={ui.input}
              value={novo.escolaridade}
              onChange={(e) => setNovo({ ...novo, escolaridade: e.target.value })}
              placeholder="ex.: Nível superior"
            />
          </div>
          <div>
            <label htmlFor="vg-qtd" className={ui.label}>Vagas</label>
            <input
              id="vg-qtd"
              type="number"
              min={0}
              className={ui.input}
              value={novo.quantidade}
              onChange={(e) => setNovo({ ...novo, quantidade: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="vg-cr" className={ui.label}>Cadastro reserva</label>
            <input
              id="vg-cr"
              type="number"
              min={0}
              className={ui.input}
              value={novo.vagasCadastro}
              onChange={(e) => setNovo({ ...novo, vagasCadastro: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="vg-ch" className={ui.label}>Carga horária</label>
            <input
              id="vg-ch"
              className={ui.input}
              value={novo.cargaHoraria}
              onChange={(e) => setNovo({ ...novo, cargaHoraria: e.target.value })}
              placeholder="ex.: 40h/semana"
            />
          </div>
          <div>
            <label htmlFor="vg-salario" className={ui.label}>Salário (R$)</label>
            <input
              id="vg-salario"
              type="number"
              min={0}
              step="0.01"
              className={ui.input}
              value={novo.salario}
              onChange={(e) => setNovo({ ...novo, salario: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="vg-ordem" className={ui.label}>Ordem</label>
            <input
              id="vg-ordem"
              type="number"
              className={ui.input}
              value={novo.ordem}
              onChange={(e) => setNovo({ ...novo, ordem: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="vg-req" className={ui.label}>Requisitos</label>
            <textarea
              id="vg-req"
              rows={2}
              className={ui.input}
              value={novo.requisitos}
              onChange={(e) => setNovo({ ...novo, requisitos: e.target.value })}
              placeholder="Requisitos e atribuições do cargo."
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" className={ui.btn} onClick={add} disabled={salvando} aria-busy={salvando}>
            {salvando ? 'Adicionando…' : '+ Adicionar vaga'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ Fases / Critérios

function SecaoFases({
  editalId,
  fases,
  onMudou,
}: {
  editalId: string;
  fases: FaseAdmin[];
  onMudou: () => void;
}) {
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const faseVazia = {
    nome: '',
    tipo: 'titulos',
    peso: '1',
    eliminatoria: false,
    notaCorte: '',
    ordem: '0',
  };
  const [novaFase, setNovaFase] = useState({ ...faseVazia });

  async function addFase() {
    if (!novaFase.nome.trim()) {
      setErro('Informe o nome da fase.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await adminPost(`/api/admin/pss/editais/${editalId}/fases`, {
        nome: novaFase.nome.trim(),
        tipo: novaFase.tipo || undefined,
        peso: novaFase.peso !== '' ? Number(novaFase.peso) : undefined,
        eliminatoria: novaFase.eliminatoria,
        notaCorte: novaFase.notaCorte !== '' ? Number(novaFase.notaCorte) : undefined,
        ordem: novaFase.ordem !== '' ? Number(novaFase.ordem) : undefined,
      });
      setNovaFase({ ...faseVazia });
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao adicionar a fase.');
    } finally {
      setSalvando(false);
    }
  }

  async function delFase(id: string) {
    setErro('');
    try {
      await adminDelete(`/api/admin/pss/fases/${id}`);
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao remover a fase.');
    }
  }

  return (
    <div className="space-y-4">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {fases.length === 0 ? (
        <p className="text-sm text-fg/60">Nenhuma fase cadastrada.</p>
      ) : (
        <ul className="space-y-3">
          {fases.map((f) => (
            <li key={f.id} className="rounded border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="font-semibold">{f.nome}</span>{' '}
                  <span className={`${ui.badge} bg-muted text-fg`}>{rotuloTipoFase(f.tipo)}</span>
                  <span className="ml-2 text-xs text-fg/60">
                    peso {fmtNum(f.peso)}
                    {f.eliminatoria ? ` · eliminatória (corte ${fmtNum(f.notaCorte)})` : ''}
                  </span>
                </div>
                <button type="button" className="text-danger hover:underline" onClick={() => delFase(f.id)}>
                  remover fase
                </button>
              </div>
              <CriteriosFase faseId={f.id} criterios={f.criterios ?? []} onMudou={onMudou} setErroPai={setErro} />
            </li>
          ))}
        </ul>
      )}

      <div className="rounded border border-border p-3">
        <h3 className="mb-2 text-sm font-semibold">Adicionar fase</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label htmlFor="fs-nome" className={ui.label}>Nome</label>
            <input
              id="fs-nome"
              className={ui.input}
              value={novaFase.nome}
              onChange={(e) => setNovaFase({ ...novaFase, nome: e.target.value })}
              placeholder="ex.: Avaliação de títulos"
            />
          </div>
          <div>
            <label htmlFor="fs-tipo" className={ui.label}>Tipo</label>
            <select
              id="fs-tipo"
              className={ui.input}
              value={novaFase.tipo}
              onChange={(e) => setNovaFase({ ...novaFase, tipo: e.target.value })}
            >
              {TIPOS_FASE.map((t) => (
                <option key={t.v} value={t.v}>{t.l}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fs-peso" className={ui.label}>Peso</label>
            <input
              id="fs-peso"
              type="number"
              min={0}
              step="0.01"
              className={ui.input}
              value={novaFase.peso}
              onChange={(e) => setNovaFase({ ...novaFase, peso: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="fs-corte" className={ui.label}>Nota de corte</label>
            <input
              id="fs-corte"
              type="number"
              step="0.01"
              className={ui.input}
              value={novaFase.notaCorte}
              onChange={(e) => setNovaFase({ ...novaFase, notaCorte: e.target.value })}
              placeholder="em branco = sem corte"
            />
          </div>
          <div>
            <label htmlFor="fs-ordem" className={ui.label}>Ordem</label>
            <input
              id="fs-ordem"
              type="number"
              className={ui.input}
              value={novaFase.ordem}
              onChange={(e) => setNovaFase({ ...novaFase, ordem: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2">
            <input
              id="fs-elim"
              type="checkbox"
              checked={novaFase.eliminatoria}
              onChange={(e) => setNovaFase({ ...novaFase, eliminatoria: e.target.checked })}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <label htmlFor="fs-elim" className="pb-2 text-sm font-semibold">Eliminatória</label>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" className={ui.btn} onClick={addFase} disabled={salvando} aria-busy={salvando}>
            {salvando ? 'Adicionando…' : '+ Adicionar fase'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CriteriosFase({
  faseId,
  criterios,
  onMudou,
  setErroPai,
}: {
  faseId: string;
  criterios: CriterioAdmin[];
  onMudou: () => void;
  setErroPai: (m: string) => void;
}) {
  const vazio = { descricao: '', pontos: '', pontosMaximo: '', ordem: '0' };
  const [novo, setNovo] = useState({ ...vazio });

  async function add() {
    if (!novo.descricao.trim()) {
      setErroPai('Informe a descrição do critério.');
      return;
    }
    setErroPai('');
    try {
      await adminPost(`/api/admin/pss/fases/${faseId}/criterios`, {
        descricao: novo.descricao.trim(),
        pontos: novo.pontos !== '' ? Number(novo.pontos) : undefined,
        pontosMaximo: novo.pontosMaximo !== '' ? Number(novo.pontosMaximo) : undefined,
        ordem: novo.ordem !== '' ? Number(novo.ordem) : undefined,
      });
      setNovo({ ...vazio });
      onMudou();
    } catch (e) {
      setErroPai(e instanceof AdminApiError ? e.message : 'Erro ao adicionar o critério.');
    }
  }

  async function del(id: string) {
    setErroPai('');
    try {
      await adminDelete(`/api/admin/pss/criterios/${id}`);
      onMudou();
    } catch (e) {
      setErroPai(e instanceof AdminApiError ? e.message : 'Erro ao remover o critério.');
    }
  }

  return (
    <div className="mt-3 rounded bg-muted/30 p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg/60">Critérios</h4>
      {criterios.length === 0 ? (
        <p className="mb-2 text-sm text-fg/60">Nenhum critério nesta fase.</p>
      ) : (
        <ul className="mb-2 space-y-1">
          {criterios.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded bg-bg px-3 py-1.5 text-sm">
              <span>
                <span className="font-medium">{c.descricao}</span>
                <span className="ml-2 text-xs text-fg/60">
                  {fmtNum(c.pontos)} pt{c.pontosMaximo != null && c.pontosMaximo !== '' ? ` (máx. ${fmtNum(c.pontosMaximo)})` : ''}
                </span>
              </span>
              <button type="button" className="text-danger hover:underline" onClick={() => del(c.id)}>
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="sr-only" htmlFor={`cr-desc-${faseId}`}>Descrição do critério</label>
          <input
            id={`cr-desc-${faseId}`}
            className={ui.input}
            value={novo.descricao}
            onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
            placeholder="Descrição (ex.: Pós-graduação lato sensu)"
          />
        </div>
        <div>
          <label className="sr-only" htmlFor={`cr-pts-${faseId}`}>Pontos</label>
          <input
            id={`cr-pts-${faseId}`}
            type="number"
            step="0.01"
            className={ui.input}
            value={novo.pontos}
            onChange={(e) => setNovo({ ...novo, pontos: e.target.value })}
            placeholder="Pontos"
          />
        </div>
        <div>
          <label className="sr-only" htmlFor={`cr-max-${faseId}`}>Pontos máximo</label>
          <input
            id={`cr-max-${faseId}`}
            type="number"
            step="0.01"
            className={ui.input}
            value={novo.pontosMaximo}
            onChange={(e) => setNovo({ ...novo, pontosMaximo: e.target.value })}
            placeholder="Pontos máx."
          />
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <button type="button" className={ui.btnGhost} onClick={add}>
          + Adicionar critério
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ Anexos

function SecaoAnexos({
  editalId,
  anexos,
  onMudou,
}: {
  editalId: string;
  anexos: AnexoAdmin[];
  onMudou: () => void;
}) {
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [picker, setPicker] = useState(false);
  const vazio = { titulo: '', tipo: 'anexo', url: '', storageKey: '', ordem: '0' };
  const [novo, setNovo] = useState({ ...vazio });

  // Anexos do edital (não vinculados a uma inscrição de candidato).
  const doEdital = anexos.filter((a) => !a.inscricaoId);

  async function add() {
    if (!novo.titulo.trim()) {
      setErro('Informe o título do anexo.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await adminPost(`/api/admin/pss/editais/${editalId}/anexos`, {
        titulo: novo.titulo.trim(),
        tipo: novo.tipo || undefined,
        url: novo.url.trim() || undefined,
        storageKey: novo.storageKey.trim() || undefined,
        ordem: novo.ordem !== '' ? Number(novo.ordem) : undefined,
      });
      setNovo({ ...vazio });
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao adicionar o anexo.');
    } finally {
      setSalvando(false);
    }
  }

  async function del(id: string) {
    setErro('');
    try {
      await adminDelete(`/api/admin/pss/anexos/${id}`);
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao remover o anexo.');
    }
  }

  return (
    <div className="space-y-4">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {doEdital.length === 0 ? (
        <p className="text-sm text-fg/60">Nenhum anexo do edital.</p>
      ) : (
        <ul className="space-y-1">
          {doEdital.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded bg-muted/40 px-3 py-1.5 text-sm">
              <span>
                <span className={`${ui.badge} bg-muted text-fg`}>{a.tipo || 'anexo'}</span>{' '}
                <span className="font-semibold">{a.titulo}</span>
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noreferrer" className="ml-2 text-primary hover:underline">
                    abrir ↗
                  </a>
                ) : null}
              </span>
              <button type="button" className="text-danger hover:underline" onClick={() => del(a.id)}>
                remover
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded border border-border p-3">
        <h3 className="mb-2 text-sm font-semibold">Adicionar anexo</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor="an-titulo" className={ui.label}>Título</label>
            <input
              id="an-titulo"
              className={ui.input}
              value={novo.titulo}
              onChange={(e) => setNovo({ ...novo, titulo: e.target.value })}
              placeholder="ex.: Edital completo (PDF)"
            />
          </div>
          <div>
            <label htmlFor="an-tipo" className={ui.label}>Tipo</label>
            <select
              id="an-tipo"
              className={ui.input}
              value={novo.tipo}
              onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}
            >
              <option value="edital">Edital</option>
              <option value="anexo">Anexo</option>
              <option value="retificacao">Retificação</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="an-url" className={ui.label}>Arquivo</label>
            <div className="mt-1 flex gap-2">
              <input
                id="an-url"
                type="url"
                className={`flex-1 ${ui.input}`}
                value={novo.url}
                onChange={(e) => setNovo({ ...novo, url: e.target.value })}
                placeholder="https://..."
              />
              <button
                type="button"
                className={ui.btnGhost}
                onClick={() => setPicker(true)}
                aria-label="Escolher documento da biblioteca de mídia"
              >
                Escolher documento
              </button>
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" className={ui.btn} onClick={add} disabled={salvando} aria-busy={salvando}>
            {salvando ? 'Adicionando…' : '+ Adicionar anexo'}
          </button>
        </div>
      </div>

      <MediaPicker
        open={picker}
        onClose={() => setPicker(false)}
        tipo="documento"
        onSelect={(asset) => {
          setNovo((n) => ({
            ...n,
            url: asset.urlPublica ?? n.url,
            titulo: n.titulo || asset.nomeOriginal,
          }));
          setPicker(false);
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ Inscrições

function SecaoInscricoes({ editalId }: { editalId: string }) {
  const [inscricoes, setInscricoes] = useState<InscricaoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [emProgresso, setEmProgresso] = useState<string | null>(null);
  // edição de motivo por inscrição
  const [motivos, setMotivos] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const data = await adminGet<InscricaoAdmin[]>(
        `/api/admin/pss/editais/${editalId}/inscricoes${qs({ status: filtroStatus })}`,
      );
      setInscricoes(data);
      setMotivos(Object.fromEntries(data.map((i) => [i.id, i.motivo ?? ''])));
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar inscrições.');
    } finally {
      setCarregando(false);
    }
  }, [editalId, filtroStatus]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function atualizar(insc: InscricaoAdmin, body: { status?: string; motivo?: string }) {
    setEmProgresso(insc.id);
    setErro('');
    setMsgOk('');
    try {
      await adminPut(`/api/admin/pss/inscricoes/${insc.id}`, body);
      setInscricoes((lista) => lista.map((i) => (i.id === insc.id ? { ...i, ...body } : i)));
      setMsgOk(`Inscrição ${insc.protocolo} atualizada.`);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao atualizar a inscrição.');
    } finally {
      setEmProgresso(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg/70" aria-live="polite">
          {inscricoes.length} inscrição(ões){filtroStatus ? ` (${rotuloStatusInscricao(filtroStatus)})` : ''}
        </p>
        <div>
          <label htmlFor="ins-filtro" className="mr-2 text-sm font-semibold">Filtrar por situação</label>
          <select
            id="ins-filtro"
            className={`inline-block w-auto ${ui.input}`}
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="">Todas</option>
            {STATUS_INSCRICAO.map((st) => (
              <option key={st.v} value={st.v}>{st.l}</option>
            ))}
          </select>
        </div>
      </div>

      {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {carregando ? (
        <p aria-live="polite" aria-busy="true" className="py-8 text-center text-sm text-fg/60">
          Carregando inscrições…
        </p>
      ) : inscricoes.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg/60">Nenhuma inscrição registrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm" aria-label="Inscrições do edital">
            <thead>
              <tr>
                <th scope="col" className={ui.th}>Protocolo</th>
                <th scope="col" className={ui.th}>Candidato</th>
                <th scope="col" className={ui.th}>Recebida em</th>
                <th scope="col" className={ui.th}>Situação</th>
                <th scope="col" className={ui.th}>Motivo / observação</th>
              </tr>
            </thead>
            <tbody>
              {inscricoes.map((i) => {
                const ocupado = emProgresso === i.id;
                return (
                  <tr key={i.id}>
                    <td className={ui.td}>
                      <span className="font-mono text-xs">{i.protocolo}</span>
                      {i.classificacao != null && (
                        <>
                          <br />
                          <span className={`${ui.badge} bg-primary/10 text-primary`}>
                            {i.classificacao}º · nota {fmtNum(i.notaFinal)}
                          </span>
                        </>
                      )}
                    </td>
                    <td className={ui.td}>
                      <span className="font-medium">{i.nome}</span>
                      {(i.cpf || i.email) && (
                        <>
                          <br />
                          <span className="text-xs text-fg/60">{[i.cpf, i.email].filter(Boolean).join(' · ')}</span>
                        </>
                      )}
                    </td>
                    <td className={ui.td}>{fmtData(i.criadoEm)}</td>
                    <td className={ui.td}>
                      <label htmlFor={`ins-st-${i.id}`} className="sr-only">
                        Situação da inscrição {i.protocolo}
                      </label>
                      <select
                        id={`ins-st-${i.id}`}
                        className={ui.input}
                        value={i.status}
                        disabled={ocupado}
                        onChange={(e) => atualizar(i, { status: e.target.value })}
                      >
                        {STATUS_INSCRICAO.map((st) => (
                          <option key={st.v} value={st.v}>{st.l}</option>
                        ))}
                      </select>
                    </td>
                    <td className={ui.td}>
                      <div className="flex gap-2">
                        <label htmlFor={`ins-mot-${i.id}`} className="sr-only">
                          Motivo da inscrição {i.protocolo}
                        </label>
                        <input
                          id={`ins-mot-${i.id}`}
                          className={`flex-1 ${ui.input}`}
                          value={motivos[i.id] ?? ''}
                          onChange={(e) => setMotivos((m) => ({ ...m, [i.id]: e.target.value }))}
                          placeholder="Justificativa de deferimento/indeferimento"
                        />
                        <button
                          type="button"
                          className={ui.btnGhost}
                          disabled={ocupado}
                          onClick={() => atualizar(i, { motivo: motivos[i.id] ?? '' })}
                        >
                          Salvar
                        </button>
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

// ═══════════════════════════════════════════════════════════════ Notas

function SecaoNotas({ editalId, fases }: { editalId: string; fases: FaseAdmin[] }) {
  const [inscricoes, setInscricoes] = useState<InscricaoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');
  const [salvando, setSalvando] = useState<string | null>(null);
  // valores em edição: chave `${inscricaoId}:${faseId}` -> string
  const [valores, setValores] = useState<Record<string, string>>({});
  const [obs, setObs] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      // Lança-se nota para inscrições deferidas (entram no ranking).
      const data = await adminGet<InscricaoAdmin[]>(
        `/api/admin/pss/editais/${editalId}/inscricoes${qs({ status: 'deferida' })}`,
      );
      setInscricoes(data);
      const v: Record<string, string> = {};
      const o: Record<string, string> = {};
      for (const i of data) {
        for (const n of i.notas ?? []) {
          v[`${i.id}:${n.faseId}`] = String(n.nota);
          if (n.observacao) o[`${i.id}:${n.faseId}`] = n.observacao;
        }
      }
      setValores(v);
      setObs(o);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar inscrições.');
    } finally {
      setCarregando(false);
    }
  }, [editalId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function lancar(inscricaoId: string, faseId: string, protocolo: string, faseNome: string) {
    const chave = `${inscricaoId}:${faseId}`;
    const valor = valores[chave];
    if (valor === undefined || valor === '') {
      setErro('Informe a nota antes de lançar.');
      return;
    }
    setSalvando(chave);
    setErro('');
    setMsgOk('');
    try {
      await adminPost('/api/admin/pss/notas', {
        inscricaoId,
        faseId,
        nota: Number(valor),
        observacao: obs[chave]?.trim() || undefined,
      });
      setMsgOk(`Nota da fase "${faseNome}" lançada para ${protocolo}.`);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao lançar a nota.');
    } finally {
      setSalvando(null);
    }
  }

  if (fases.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-fg/60">
        Cadastre ao menos uma fase (aba “Fases / Critérios”) para lançar notas.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg/70">
        Lançamento de notas por fase para as inscrições <strong>deferidas</strong>. Cada lançamento é um
        upsert (sobrescreve a nota anterior da mesma fase).
      </p>

      {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {carregando ? (
        <p aria-live="polite" aria-busy="true" className="py-8 text-center text-sm text-fg/60">
          Carregando inscrições deferidas…
        </p>
      ) : inscricoes.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg/60">
          Nenhuma inscrição deferida. Defira inscrições na aba “Inscrições” para lançar notas.
        </p>
      ) : (
        <ul className="space-y-3">
          {inscricoes.map((i) => (
            <li key={i.id} className="rounded border border-border p-3">
              <div className="mb-2">
                <span className="font-medium">{i.nome}</span>{' '}
                <span className="font-mono text-xs text-fg/60">{i.protocolo}</span>
              </div>
              <div className="space-y-2">
                {fases.map((f) => {
                  const chave = `${i.id}:${f.id}`;
                  return (
                    <div key={f.id} className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end">
                      <div className="sm:col-span-3">
                        <label htmlFor={`nota-${chave}`} className={ui.label}>
                          {f.nome}
                        </label>
                        <input
                          id={`nota-${chave}`}
                          type="number"
                          step="0.01"
                          className={ui.input}
                          value={valores[chave] ?? ''}
                          onChange={(e) => setValores((v) => ({ ...v, [chave]: e.target.value }))}
                          placeholder="nota"
                        />
                      </div>
                      <div className="sm:col-span-7">
                        <label htmlFor={`obs-${chave}`} className="sr-only">
                          Observação da nota de {i.nome} na fase {f.nome}
                        </label>
                        <input
                          id={`obs-${chave}`}
                          className={ui.input}
                          value={obs[chave] ?? ''}
                          onChange={(e) => setObs((o) => ({ ...o, [chave]: e.target.value }))}
                          placeholder="Observação (opcional)"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          className={`w-full ${ui.btnGhost}`}
                          disabled={salvando === chave}
                          aria-busy={salvando === chave}
                          onClick={() => lancar(i.id, f.id, i.protocolo, f.nome)}
                        >
                          {salvando === chave ? 'Salvando…' : 'Lançar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ Ranking

function SecaoRanking({ editalId, onPublicado }: { editalId: string; onPublicado: () => void }) {
  const [previa, setPrevia] = useState<RankingPrevia | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');

  async function calcularPrevia() {
    setCarregando(true);
    setErro('');
    setMsgOk('');
    try {
      const data = await adminGet<RankingPrevia>(`/api/admin/pss/editais/${editalId}/ranking/previa`);
      setPrevia(data);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao calcular a prévia do ranking.');
    } finally {
      setCarregando(false);
    }
  }

  async function publicar() {
    setPublicando(true);
    setErro('');
    setMsgOk('');
    try {
      await adminPost(`/api/admin/pss/editais/${editalId}/ranking/publicar`);
      setMsgOk('Ranking publicado e edital homologado.');
      setConfirmando(false);
      onPublicado();
      await calcularPrevia();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao publicar o ranking.');
    } finally {
      setPublicando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={ui.btnGhost} onClick={calcularPrevia} disabled={carregando} aria-busy={carregando}>
          {carregando ? 'Calculando…' : 'Calcular prévia'}
        </button>
        {confirmando ? (
          <>
            <button type="button" className={ui.btn} onClick={publicar} disabled={publicando} aria-busy={publicando}>
              {publicando ? 'Publicando…' : 'Confirmar publicação'}
            </button>
            <button type="button" className={ui.btnGhost} onClick={() => setConfirmando(false)} disabled={publicando}>
              Cancelar
            </button>
          </>
        ) : (
          <button type="button" className={ui.btn} onClick={() => setConfirmando(true)}>
            Publicar ranking
          </button>
        )}
      </div>
      <p className="text-xs text-fg/60">
        Publicar recalcula, persiste a classificação e homologa o edital (torna o ranking público).
      </p>

      {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {previa && (
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Classificados ({previa.classificados.length})</h3>
            {previa.classificados.length === 0 ? (
              <p className="text-sm text-fg/60">Nenhum candidato classificado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm" aria-label="Classificados">
                  <thead>
                    <tr>
                      <th scope="col" className={ui.th}>Classificação</th>
                      <th scope="col" className={ui.th}>Protocolo</th>
                      <th scope="col" className={ui.th}>Candidato</th>
                      <th scope="col" className={ui.th}>Nota final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.classificados.map((c) => (
                      <tr key={c.inscricaoId}>
                        <td className={ui.td}>{c.classificacao}º</td>
                        <td className={ui.td}><span className="font-mono text-xs">{c.protocolo}</span></td>
                        <td className={ui.td}>{c.nome}</td>
                        <td className={ui.td}>{fmtNum(c.notaFinal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {previa.eliminados.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Eliminados ({previa.eliminados.length})</h3>
              <ul className="space-y-1">
                {previa.eliminados.map((e) => (
                  <li key={e.inscricaoId} className="rounded bg-muted/40 px-3 py-1.5 text-sm">
                    <span className="font-mono text-xs text-fg/60">{e.protocolo}</span> — {e.nome}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ APLIC

function SecaoAplic({ editalId, vagas }: { editalId: string; vagas: VagaAdmin[] }) {
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);

  const [aberturas, setAberturas] = useState<AberturaAdmin[]>([]);
  const [comissao, setComissao] = useState<ComissaoMembroAdmin[]>([]);
  const [tabela, setTabela] = useState<TabelaSalarialAdmin[]>([]);

  const abVazia = { tipo: 'abertura', versao: '1', dataAto: '', descricao: '', url: '', storageKey: '' };
  const cmVazia = { nome: '', cpf: '', cargo: 'membro', ordem: '0' };
  const tsVazia = { vagaId: '', codigo: '', cargo: '', nivel: '', classe: '', salarioBase: '', cargaHoraria: '', ordem: '0' };
  const [novaAb, setNovaAb] = useState({ ...abVazia });
  const [novoCm, setNovoCm] = useState({ ...cmVazia });
  const [novaTs, setNovaTs] = useState({ ...tsVazia });

  // O export agrega aberturas, comissão, situações e tabela. Usamos o próprio
  // export como fonte de leitura das listas (não há GETs dedicados de APLIC).
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const data = await adminGet<{
        aberturas_retificacoes?: AberturaAdmin[];
        comissao?: ComissaoMembroAdmin[];
        tabela_salarial?: TabelaSalarialAdmin[];
      }>(`/api/admin/pss/editais/${editalId}/aplic/export`);
      setAberturas(data.aberturas_retificacoes ?? []);
      setComissao(data.comissao ?? []);
      setTabela(data.tabela_salarial ?? []);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar dados do APLIC.');
    } finally {
      setCarregando(false);
    }
  }, [editalId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function exportar() {
    setExportando(true);
    setErro('');
    setMsgOk('');
    try {
      const data = await adminGet<unknown>(`/api/admin/pss/editais/${editalId}/aplic/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aplic-pss-${editalId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMsgOk('Exportação APLIC gerada (JSON).');
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao exportar o pacote APLIC.');
    } finally {
      setExportando(false);
    }
  }

  async function addAbertura() {
    setErro('');
    try {
      await adminPost(`/api/admin/pss/editais/${editalId}/aplic/aberturas`, {
        tipo: novaAb.tipo || undefined,
        versao: novaAb.versao !== '' ? Number(novaAb.versao) : undefined,
        dataAto: novaAb.dataAto || undefined,
        descricao: novaAb.descricao.trim() || undefined,
        url: novaAb.url.trim() || undefined,
        storageKey: novaAb.storageKey.trim() || undefined,
      });
      setNovaAb({ ...abVazia });
      await carregar();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao adicionar abertura/retificação.');
    }
  }
  async function delAbertura(id: string) {
    setErro('');
    try {
      await adminDelete(`/api/admin/pss/aplic/aberturas/${id}`);
      await carregar();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao remover abertura/retificação.');
    }
  }

  async function addComissao() {
    if (!novoCm.nome.trim()) {
      setErro('Informe o nome do membro da comissão.');
      return;
    }
    setErro('');
    try {
      await adminPost(`/api/admin/pss/editais/${editalId}/aplic/comissao`, {
        nome: novoCm.nome.trim(),
        cpf: novoCm.cpf.trim() || undefined,
        cargo: novoCm.cargo || undefined,
        ordem: novoCm.ordem !== '' ? Number(novoCm.ordem) : undefined,
      });
      setNovoCm({ ...cmVazia });
      await carregar();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao adicionar membro da comissão.');
    }
  }
  async function delComissao(id: string) {
    setErro('');
    try {
      await adminDelete(`/api/admin/pss/aplic/comissao/${id}`);
      await carregar();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao remover membro da comissão.');
    }
  }

  async function addTabela() {
    if (!novaTs.cargo.trim()) {
      setErro('Informe o cargo da tabela salarial.');
      return;
    }
    setErro('');
    try {
      await adminPost(`/api/admin/pss/editais/${editalId}/aplic/tabela-salarial`, {
        vagaId: novaTs.vagaId || undefined,
        codigo: novaTs.codigo.trim() || undefined,
        cargo: novaTs.cargo.trim(),
        nivel: novaTs.nivel.trim() || undefined,
        classe: novaTs.classe.trim() || undefined,
        salarioBase: novaTs.salarioBase !== '' ? Number(novaTs.salarioBase) : undefined,
        cargaHoraria: novaTs.cargaHoraria.trim() || undefined,
        ordem: novaTs.ordem !== '' ? Number(novaTs.ordem) : undefined,
      });
      setNovaTs({ ...tsVazia });
      await carregar();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao adicionar item da tabela salarial.');
    }
  }
  async function delTabela(id: string) {
    setErro('');
    try {
      await adminDelete(`/api/admin/pss/aplic/tabela-salarial/${id}`);
      await carregar();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao remover item da tabela salarial.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg/70">
          Dados do certame para prestação de contas (leiaute APLIC/TCE-MT).
        </p>
        <button type="button" className={ui.btn} onClick={exportar} disabled={exportando} aria-busy={exportando}>
          {exportando ? 'Exportando…' : 'Exportar pacote APLIC'}
        </button>
      </div>

      {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {carregando ? (
        <p aria-live="polite" aria-busy="true" className="py-8 text-center text-sm text-fg/60">
          Carregando dados do APLIC…
        </p>
      ) : (
        <>
          {/* Aberturas / retificações */}
          <section className="rounded border border-border p-3">
            <h3 className="mb-2 text-sm font-semibold">Aberturas e retificações</h3>
            {aberturas.length === 0 ? (
              <p className="mb-2 text-sm text-fg/60">Nenhuma abertura/retificação registrada.</p>
            ) : (
              <ul className="mb-3 space-y-1">
                {aberturas.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded bg-muted/40 px-3 py-1.5 text-sm">
                    <span>
                      <span className={`${ui.badge} bg-muted text-fg`}>{a.tipo || 'abertura'}</span>{' '}
                      <span className="font-medium">v{a.versao ?? 1}</span>
                      {a.descricao ? <span className="text-fg/70"> — {a.descricao}</span> : null}
                      {a.dataAto ? <span className="text-xs text-fg/60"> ({fmtData(a.dataAto)})</span> : null}
                    </span>
                    <button type="button" className="text-danger hover:underline" onClick={() => delAbertura(a.id)}>
                      remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="ab-tipo" className={ui.label}>Tipo</label>
                <select
                  id="ab-tipo"
                  className={ui.input}
                  value={novaAb.tipo}
                  onChange={(e) => setNovaAb({ ...novaAb, tipo: e.target.value })}
                >
                  {TIPOS_ABERTURA.map((t) => (
                    <option key={t.v} value={t.v}>{t.l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ab-versao" className={ui.label}>Versão</label>
                <input
                  id="ab-versao"
                  type="number"
                  min={1}
                  className={ui.input}
                  value={novaAb.versao}
                  onChange={(e) => setNovaAb({ ...novaAb, versao: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="ab-data" className={ui.label}>Data do ato</label>
                <input
                  id="ab-data"
                  type="date"
                  className={ui.input}
                  value={novaAb.dataAto}
                  onChange={(e) => setNovaAb({ ...novaAb, dataAto: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="ab-url" className={ui.label}>URL do ato</label>
                <input
                  id="ab-url"
                  type="url"
                  className={ui.input}
                  value={novaAb.url}
                  onChange={(e) => setNovaAb({ ...novaAb, url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label htmlFor="ab-desc" className={ui.label}>Descrição</label>
                <input
                  id="ab-desc"
                  className={ui.input}
                  value={novaAb.descricao}
                  onChange={(e) => setNovaAb({ ...novaAb, descricao: e.target.value })}
                  placeholder="ex.: Retificação do cronograma"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" className={ui.btnGhost} onClick={addAbertura}>
                + Adicionar abertura/retificação
              </button>
            </div>
          </section>

          {/* Comissão */}
          <section className="rounded border border-border p-3">
            <h3 className="mb-2 text-sm font-semibold">Comissão do certame</h3>
            {comissao.length === 0 ? (
              <p className="mb-2 text-sm text-fg/60">Nenhum membro cadastrado.</p>
            ) : (
              <ul className="mb-3 space-y-1">
                {comissao.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded bg-muted/40 px-3 py-1.5 text-sm">
                    <span>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                        {CARGOS_COMISSAO.find((c) => c.v === m.cargo)?.l ?? m.cargo ?? 'membro'}
                      </span>{' '}
                      <span className="font-semibold">{m.nome}</span>
                      {m.cpf ? <span className="text-fg/55"> ({m.cpf})</span> : null}
                    </span>
                    <button type="button" className="text-danger hover:underline" onClick={() => delComissao(m.id)}>
                      remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <label htmlFor="cm-nome" className={ui.label}>Nome</label>
                <input
                  id="cm-nome"
                  className={ui.input}
                  value={novoCm.nome}
                  onChange={(e) => setNovoCm({ ...novoCm, nome: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="cm-cpf" className={ui.label}>CPF</label>
                <input
                  id="cm-cpf"
                  className={ui.input}
                  value={novoCm.cpf}
                  onChange={(e) => setNovoCm({ ...novoCm, cpf: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="cm-cargo" className={ui.label}>Cargo</label>
                <select
                  id="cm-cargo"
                  className={ui.input}
                  value={novoCm.cargo}
                  onChange={(e) => setNovoCm({ ...novoCm, cargo: e.target.value })}
                >
                  {CARGOS_COMISSAO.map((c) => (
                    <option key={c.v} value={c.v}>{c.l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" className={ui.btnGhost} onClick={addComissao}>
                + Adicionar membro
              </button>
            </div>
          </section>

          {/* Tabela salarial */}
          <section className="rounded border border-border p-3">
            <h3 className="mb-2 text-sm font-semibold">Tabela salarial</h3>
            {tabela.length === 0 ? (
              <p className="mb-2 text-sm text-fg/60">Nenhum item na tabela salarial.</p>
            ) : (
              <div className="mb-3 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm" aria-label="Tabela salarial">
                  <thead>
                    <tr>
                      <th scope="col" className={ui.th}>Código</th>
                      <th scope="col" className={ui.th}>Cargo</th>
                      <th scope="col" className={ui.th}>Nível / Classe</th>
                      <th scope="col" className={ui.th}>Salário base</th>
                      <th scope="col" className={ui.th}><span className="sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabela.map((t) => (
                      <tr key={t.id}>
                        <td className={ui.td}>{t.codigo || '—'}</td>
                        <td className={ui.td}><span className="font-medium">{t.cargo}</span></td>
                        <td className={ui.td}>{[t.nivel, t.classe].filter(Boolean).join(' / ') || '—'}</td>
                        <td className={ui.td}>{fmtMoeda(t.salarioBase)}</td>
                        <td className={ui.td}>
                          <button type="button" className="text-danger hover:underline" onClick={() => delTabela(t.id)}>
                            remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="ts-codigo" className={ui.label}>Código</label>
                <input
                  id="ts-codigo"
                  className={ui.input}
                  value={novaTs.codigo}
                  onChange={(e) => setNovaTs({ ...novaTs, codigo: e.target.value })}
                />
              </div>
              <div className="lg:col-span-2">
                <label htmlFor="ts-cargo" className={ui.label}>Cargo</label>
                <input
                  id="ts-cargo"
                  className={ui.input}
                  value={novaTs.cargo}
                  onChange={(e) => setNovaTs({ ...novaTs, cargo: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="ts-vaga" className={ui.label}>Vaga vinculada</label>
                <select
                  id="ts-vaga"
                  className={ui.input}
                  value={novaTs.vagaId}
                  onChange={(e) => setNovaTs({ ...novaTs, vagaId: e.target.value })}
                >
                  <option value="">—</option>
                  {vagas.map((v) => (
                    <option key={v.id} value={v.id}>{v.cargo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ts-nivel" className={ui.label}>Nível</label>
                <input
                  id="ts-nivel"
                  className={ui.input}
                  value={novaTs.nivel}
                  onChange={(e) => setNovaTs({ ...novaTs, nivel: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="ts-classe" className={ui.label}>Classe</label>
                <input
                  id="ts-classe"
                  className={ui.input}
                  value={novaTs.classe}
                  onChange={(e) => setNovaTs({ ...novaTs, classe: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="ts-salario" className={ui.label}>Salário base (R$)</label>
                <input
                  id="ts-salario"
                  type="number"
                  min={0}
                  step="0.01"
                  className={ui.input}
                  value={novaTs.salarioBase}
                  onChange={(e) => setNovaTs({ ...novaTs, salarioBase: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="ts-ch" className={ui.label}>Carga horária</label>
                <input
                  id="ts-ch"
                  className={ui.input}
                  value={novaTs.cargaHoraria}
                  onChange={(e) => setNovaTs({ ...novaTs, cargaHoraria: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" className={ui.btnGhost} onClick={addTabela}>
                + Adicionar item
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
