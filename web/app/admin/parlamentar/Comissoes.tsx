'use client';

/**
 * Admin — Parlamentar / Comissões
 * Endpoints:
 *   GET    /api/comissoes                                   (lista pública, resolvida pelo tenant do host)
 *   GET    /api/comissoes/:slug                             (detalhe c/ cargos e documentos)
 *   POST   /api/admin/parlamentar/comissoes
 *   PUT    /api/admin/parlamentar/comissoes/:id
 *   DELETE /api/admin/parlamentar/comissoes/:id
 *   POST   /api/admin/parlamentar/comissoes/:id/cargos
 *   DELETE /api/admin/parlamentar/comissoes/cargos/:cid
 *   POST   /api/admin/parlamentar/comissoes/:id/documentos
 *   DELETE /api/admin/parlamentar/comissoes/documentos/:did
 *   (vereadores p/ seletor) GET /api/admin/parlamentar/vereadores?pageSize=100
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AdminApiError,
  adminDelete,
  adminGet,
  adminPost,
  adminPut,
  type Pagina,
} from '../../../lib/admin-api';
import { Aviso, Modal, ui } from '../_components/ui';
import MediaPicker from '../_components/MediaPicker';
import type { VereadorAdmin } from './tipos';

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface Comissao {
  id: string;
  nome: string;
  slug?: string | null;
  tipo?: string | null;
  descricao?: string | null;
  legislatura?: string | null;
  ordem: number;
  ativo: boolean;
}

interface ComissaoCargo {
  id: string;
  cargo: string;
  inicio?: string | null;
  fim?: string | null;
  ordem: number;
  vereador?: { id: string; nomeParlamentar: string; partido?: string | null } | null;
}

interface ComissaoDocumento {
  id: string;
  titulo: string;
  arquivoUrl?: string | null;
  storageKey?: string | null;
  ordem: number;
}

interface ComissaoDetalhe extends Comissao {
  cargos: ComissaoCargo[];
  documentos: ComissaoDocumento[];
}

const TIPOS_COMISSAO = [
  { v: 'permanente', l: 'Permanente' },
  { v: 'temporaria', l: 'Temporária' },
  { v: 'cpi', l: 'CPI' },
  { v: 'especial', l: 'Especial' },
];

const CARGOS_COMISSAO = [
  { v: 'presidente', l: 'Presidente' },
  { v: 'vice_presidente', l: 'Vice-presidente' },
  { v: 'relator', l: 'Relator(a)' },
  { v: 'membro', l: 'Membro' },
];

function rotuloTipo(t?: string | null): string {
  return TIPOS_COMISSAO.find((x) => x.v === t)?.l ?? t ?? '—';
}
function rotuloCargo(c: string): string {
  return CARGOS_COMISSAO.find((x) => x.v === c)?.l ?? c;
}

const comissaoVazia = {
  nome: '',
  tipo: 'permanente',
  descricao: '',
  legislatura: '',
  ordem: 0,
  ativo: true,
};

// ─── Modal criar / editar comissão + cargos + documentos ─────────────────────

function ModalComissao({
  open,
  editando,
  vereadores,
  onClose,
  onSalvo,
}: {
  open: boolean;
  editando: Comissao | null;
  vereadores: VereadorAdmin[];
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState({ ...comissaoVazia });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Sub-recursos (só em modo edição, carregados via detalhe pelo slug/id).
  const [cargos, setCargos] = useState<ComissaoCargo[]>([]);
  const [documentos, setDocumentos] = useState<ComissaoDocumento[]>([]);
  const [novoCargo, setNovoCargo] = useState({ vereadorId: '', cargo: 'membro', inicio: '', fim: '', ordem: 0 });
  const [novoDoc, setNovoDoc] = useState({ titulo: '', arquivoUrl: '', storageKey: '', ordem: 0 });
  const [pickerDoc, setPickerDoc] = useState(false);

  const carregarSub = useCallback(async () => {
    if (!editando) {
      setCargos([]);
      setDocumentos([]);
      return;
    }
    try {
      const det = await adminGet<ComissaoDetalhe>(`/api/admin/parlamentar/comissoes/${editando.id}`);
      setCargos(det.cargos ?? []);
      setDocumentos(det.documentos ?? []);
    } catch {
      setCargos([]);
      setDocumentos([]);
    }
  }, [editando]);

  useEffect(() => {
    if (!open) return;
    setErro('');
    setForm(
      editando
        ? {
            nome: editando.nome,
            tipo: editando.tipo ?? 'permanente',
            descricao: editando.descricao ?? '',
            legislatura: editando.legislatura ?? '',
            ordem: editando.ordem,
            ativo: editando.ativo,
          }
        : { ...comissaoVazia },
    );
    setNovoCargo({ vereadorId: '', cargo: 'membro', inicio: '', fim: '', ordem: 0 });
    setNovoDoc({ titulo: '', arquivoUrl: '', storageKey: '', ordem: 0 });
    carregarSub();
  }, [open, editando, carregarSub]);

  function s<K extends keyof typeof comissaoVazia>(k: K, v: (typeof comissaoVazia)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    const body = {
      nome: form.nome,
      tipo: form.tipo,
      descricao: form.descricao || undefined,
      legislatura: form.legislatura || undefined,
      ordem: Number(form.ordem) || 0,
      ativo: form.ativo,
    };
    try {
      if (editando) {
        await adminPut(`/api/admin/parlamentar/comissoes/${editando.id}`, body);
      } else {
        await adminPost('/api/admin/parlamentar/comissoes', body);
      }
      onSalvo();
      onClose();
    } catch (err) {
      setErro(err instanceof AdminApiError ? err.message : 'Erro ao salvar a comissão.');
    } finally {
      setSalvando(false);
    }
  }

  async function addCargo() {
    if (!editando || !novoCargo.vereadorId) {
      setErro('Selecione o vereador para o cargo.');
      return;
    }
    setErro('');
    try {
      await adminPost(`/api/admin/parlamentar/comissoes/${editando.id}/cargos`, {
        vereadorId: novoCargo.vereadorId,
        cargo: novoCargo.cargo,
        inicio: novoCargo.inicio || undefined,
        fim: novoCargo.fim || undefined,
        ordem: Number(novoCargo.ordem) || 0,
      });
      setNovoCargo({ vereadorId: '', cargo: 'membro', inicio: '', fim: '', ordem: 0 });
      await carregarSub();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao adicionar membro.');
    }
  }
  async function delCargo(id: string) {
    setErro('');
    try {
      await adminDelete(`/api/admin/parlamentar/comissoes/cargos/${id}`);
      setCargos((c) => c.filter((x) => x.id !== id));
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao remover membro.');
    }
  }

  async function addDoc() {
    if (!editando || !novoDoc.titulo.trim()) {
      setErro('Informe o título do documento.');
      return;
    }
    setErro('');
    try {
      await adminPost(`/api/admin/parlamentar/comissoes/${editando.id}/documentos`, {
        titulo: novoDoc.titulo,
        arquivoUrl: novoDoc.arquivoUrl || undefined,
        storageKey: novoDoc.storageKey || undefined,
        ordem: Number(novoDoc.ordem) || 0,
      });
      setNovoDoc({ titulo: '', arquivoUrl: '', storageKey: '', ordem: 0 });
      await carregarSub();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao adicionar documento.');
    }
  }
  async function delDoc(id: string) {
    setErro('');
    try {
      await adminDelete(`/api/admin/parlamentar/comissoes/documentos/${id}`);
      setDocumentos((d) => d.filter((x) => x.id !== id));
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao remover documento.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? 'Editar comissão' : 'Nova comissão'}>
      <form onSubmit={salvar} className="space-y-4" noValidate>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div>
          <label htmlFor="com-nome" className={ui.label}>
            Nome <span aria-hidden="true">*</span>
          </label>
          <input
            id="com-nome"
            type="text"
            required
            className={ui.input}
            value={form.nome}
            onChange={(e) => s('nome', e.target.value)}
            placeholder="ex.: Comissão de Constituição, Justiça e Redação"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="com-tipo" className={ui.label}>
              Tipo
            </label>
            <select id="com-tipo" className={ui.input} value={form.tipo} onChange={(e) => s('tipo', e.target.value)}>
              {TIPOS_COMISSAO.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="com-legislatura" className={ui.label}>
              Legislatura
            </label>
            <input
              id="com-legislatura"
              type="text"
              className={ui.input}
              value={form.legislatura}
              onChange={(e) => s('legislatura', e.target.value)}
              placeholder="ex.: 2025-2028"
            />
          </div>
        </div>

        <div>
          <label htmlFor="com-descricao" className={ui.label}>
            Descrição
          </label>
          <textarea
            id="com-descricao"
            rows={3}
            className={ui.input}
            value={form.descricao}
            onChange={(e) => s('descricao', e.target.value)}
            placeholder="Finalidade e atribuições da comissão."
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="com-ordem" className={ui.label}>
              Ordem de exibição
            </label>
            <input
              id="com-ordem"
              type="number"
              min={0}
              className={ui.input}
              value={form.ordem}
              onChange={(e) => s('ordem', Number(e.target.value))}
            />
          </div>
          <div className="flex items-end gap-2">
            <input
              id="com-ativo"
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => s('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <label htmlFor="com-ativo" className="pb-2 text-sm font-semibold">
              Comissão ativa
            </label>
          </div>
        </div>

        {/* Membros (cargos) — só em edição */}
        {editando && (
          <div className="rounded border border-border p-3">
            <h3 className="mb-2 text-sm font-semibold">Membros da comissão</h3>
            {cargos.length === 0 ? (
              <p className="mb-3 text-sm text-fg/60">Nenhum membro cadastrado.</p>
            ) : (
              <ul className="mb-3 space-y-1">
                {cargos.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded bg-muted/40 px-3 py-1.5 text-sm"
                  >
                    <span>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                        {rotuloCargo(c.cargo)}
                      </span>{' '}
                      <span className="font-semibold">{c.vereador?.nomeParlamentar ?? '—'}</span>
                      {c.vereador?.partido ? <span className="text-fg/55"> ({c.vereador.partido})</span> : null}
                    </span>
                    <button type="button" className="text-danger hover:underline" onClick={() => delCargo(c.id)}>
                      remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className={ui.label}>Vereador</label>
                <select
                  className={ui.input}
                  value={novoCargo.vereadorId}
                  onChange={(e) => setNovoCargo({ ...novoCargo, vereadorId: e.target.value })}
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
                <label className={ui.label}>Cargo</label>
                <select
                  className={ui.input}
                  value={novoCargo.cargo}
                  onChange={(e) => setNovoCargo({ ...novoCargo, cargo: e.target.value })}
                >
                  {CARGOS_COMISSAO.map((c) => (
                    <option key={c.v} value={c.v}>
                      {c.l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={ui.label}>Ordem</label>
                <input
                  type="number"
                  className={ui.input}
                  value={novoCargo.ordem}
                  onChange={(e) => setNovoCargo({ ...novoCargo, ordem: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={ui.label}>Início</label>
                <input
                  type="date"
                  className={ui.input}
                  value={novoCargo.inicio}
                  onChange={(e) => setNovoCargo({ ...novoCargo, inicio: e.target.value })}
                />
              </div>
              <div>
                <label className={ui.label}>Fim</label>
                <input
                  type="date"
                  className={ui.input}
                  value={novoCargo.fim}
                  onChange={(e) => setNovoCargo({ ...novoCargo, fim: e.target.value })}
                />
              </div>
              <div className="col-span-2 flex justify-end">
                <button type="button" className={ui.btn} onClick={addCargo}>
                  + Adicionar membro
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Documentos — só em edição */}
        {editando && (
          <div className="rounded border border-border p-3">
            <h3 className="mb-2 text-sm font-semibold">Documentos</h3>
            {documentos.length === 0 ? (
              <p className="mb-3 text-sm text-fg/60">Nenhum documento anexado.</p>
            ) : (
              <ul className="mb-3 space-y-1">
                {documentos.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded bg-muted/40 px-3 py-1.5 text-sm"
                  >
                    <span>
                      <span className="font-semibold">{d.titulo}</span>
                      {d.arquivoUrl ? (
                        <a
                          href={d.arquivoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 text-primary hover:underline"
                        >
                          abrir ↗
                        </a>
                      ) : null}
                    </span>
                    <button type="button" className="text-danger hover:underline" onClick={() => delDoc(d.id)}>
                      remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className={ui.label}>Título do documento</label>
                <input
                  className={ui.input}
                  value={novoDoc.titulo}
                  onChange={(e) => setNovoDoc({ ...novoDoc, titulo: e.target.value })}
                  placeholder="ex.: Ata de instalação"
                />
              </div>
              <div className="col-span-2">
                <label className={ui.label}>Arquivo</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="url"
                    className={`flex-1 ${ui.input}`}
                    value={novoDoc.arquivoUrl}
                    onChange={(e) => setNovoDoc({ ...novoDoc, arquivoUrl: e.target.value })}
                    placeholder="https://..."
                  />
                  <button
                    type="button"
                    className={ui.btnGhost}
                    onClick={() => setPickerDoc(true)}
                    aria-label="Escolher arquivo da biblioteca de mídia"
                  >
                    Escolher arquivo
                  </button>
                </div>
              </div>
              <div className="col-span-2 flex justify-end">
                <button type="button" className={ui.btn} onClick={addDoc}>
                  + Adicionar documento
                </button>
              </div>
            </div>
          </div>
        )}

        {!editando && (
          <p className="rounded border border-dashed border-border bg-muted/20 p-3 text-xs text-fg/60">
            Salve a comissão para depois adicionar <strong>membros</strong> e <strong>documentos</strong>.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={ui.btnGhost} onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className={ui.btn} disabled={salvando} aria-busy={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>

      <MediaPicker
        open={pickerDoc}
        onClose={() => setPickerDoc(false)}
        tipo="documento"
        onSelect={(asset) => {
          if (asset.urlPublica) setNovoDoc((d) => ({ ...d, arquivoUrl: asset.urlPublica! }));
          setPickerDoc(false);
        }}
      />
    </Modal>
  );
}

// ─── Componente principal da aba ─────────────────────────────────────────────

export default function Comissoes() {
  const [lista, setLista] = useState<Comissao[]>([]);
  const [vereadores, setVereadores] = useState<VereadorAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Comissao | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [coms, vers] = await Promise.all([
        adminGet<Comissao[]>('/api/admin/parlamentar/comissoes'),
        adminGet<Pagina<VereadorAdmin>>('/api/admin/parlamentar/vereadores?page=1&pageSize=100'),
      ]);
      setLista(coms);
      setVereadores(vers.items);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar comissões.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirNovo() {
    setEditando(null);
    setModalAberto(true);
  }
  function abrirEditar(c: Comissao) {
    setEditando(c);
    setModalAberto(true);
  }

  async function excluir(id: string) {
    setErro('');
    setMsgOk('');
    try {
      await adminDelete(`/api/admin/parlamentar/comissoes/${id}`);
      setConfirmandoId(null);
      setMsgOk('Comissão excluída.');
      await carregar();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao excluir comissão.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg/70">
          Comissões permanentes, temporárias e CPIs, com membros (cargos) e documentos anexos.
        </p>
        <button type="button" className={ui.btn} onClick={abrirNovo}>
          + Nova comissão
        </button>
      </div>

      {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {carregando ? (
        <p aria-live="polite" aria-busy="true" className="py-8 text-center text-sm text-fg/60">
          Carregando comissões…
        </p>
      ) : lista.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg/60">
          Nenhuma comissão cadastrada. Clique em &ldquo;Nova comissão&rdquo; para começar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm" aria-label="Lista de comissões">
            <thead>
              <tr>
                <th scope="col" className={ui.th}>
                  Ordem
                </th>
                <th scope="col" className={ui.th}>
                  Nome
                </th>
                <th scope="col" className={ui.th}>
                  Tipo
                </th>
                <th scope="col" className={ui.th}>
                  Legislatura
                </th>
                <th scope="col" className={ui.th}>
                  Status
                </th>
                <th scope="col" className={ui.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td className={ui.td}>{c.ordem}</td>
                  <td className={ui.td}>
                    <span className="font-medium">{c.nome}</span>
                  </td>
                  <td className={ui.td}>
                    <span className={`${ui.badge} bg-muted text-fg`}>{rotuloTipo(c.tipo)}</span>
                  </td>
                  <td className={ui.td}>{c.legislatura || <span className="text-fg/40">—</span>}</td>
                  <td className={ui.td}>
                    <span
                      className={`${ui.badge} ${
                        c.ativo ? 'bg-success/10 text-success' : 'bg-muted text-fg/60'
                      }`}
                    >
                      {c.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className={ui.td}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={ui.btnGhost}
                        onClick={() => abrirEditar(c)}
                        aria-label={`Editar comissão "${c.nome}"`}
                      >
                        Editar
                      </button>
                      {confirmandoId === c.id ? (
                        <>
                          <button type="button" className={ui.btnDanger} onClick={() => excluir(c.id)}>
                            Confirmar exclusão
                          </button>
                          <button
                            type="button"
                            className={ui.btnGhost}
                            onClick={() => setConfirmandoId(null)}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={ui.btnDanger}
                          onClick={() => setConfirmandoId(c.id)}
                          aria-label={`Excluir comissão "${c.nome}"`}
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

      <ModalComissao
        open={modalAberto}
        editando={editando}
        vereadores={vereadores}
        onClose={() => setModalAberto(false)}
        onSalvo={() => {
          setMsgOk(editando ? 'Comissão atualizada com sucesso.' : 'Comissão criada com sucesso.');
          carregar();
        }}
      />
    </div>
  );
}
