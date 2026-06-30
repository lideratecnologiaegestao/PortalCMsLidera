'use client';

/**
 * ModalTipos — gestão dos tipos de sessão (Ordinária, Extraordinária, Solene…)
 * dentro de um Modal.
 *
 *   GET    /api/admin/sessoes/tipos
 *   POST   /api/admin/sessoes/tipos
 *   PUT    /api/admin/sessoes/tipos/:id
 *   DELETE /api/admin/sessoes/tipos/:id
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AdminApiError,
  adminDelete,
  adminGet,
  adminPost,
  adminPut,
} from '../../../lib/admin-api';
import { Aviso, Modal, ui } from '../_components/ui';
import type { TipoSessaoAdmin } from './tipos';

interface FormTipo {
  nome: string;
  descricao: string;
  ordem: string;
  ativo: boolean;
}

function formVazio(): FormTipo {
  return { nome: '', descricao: '', ordem: '0', ativo: true };
}

export default function ModalTipos({
  open,
  onClose,
  onMudou,
}: {
  open: boolean;
  onClose: () => void;
  /** Chamado após qualquer alteração para a lista de sessões reler os tipos. */
  onMudou: () => void;
}) {
  const [tipos, setTipos] = useState<TipoSessaoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');

  const [form, setForm] = useState<FormTipo>(formVazio());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const data = await adminGet<TipoSessaoAdmin[]>('/api/admin/sessoes/tipos');
      setTipos(data);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar os tipos de sessão.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setMsgOk('');
      setForm(formVazio());
      setEditandoId(null);
      setConfirmandoId(null);
      carregar();
    }
  }, [open, carregar]);

  function s<K extends keyof FormTipo>(k: K, v: FormTipo[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function editar(t: TipoSessaoAdmin) {
    setEditandoId(t.id);
    setForm({
      nome: t.nome,
      descricao: t.descricao ?? '',
      ordem: String(t.ordem ?? 0),
      ativo: t.ativo,
    });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(formVazio());
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErro('Informe o nome do tipo de sessão.');
      return;
    }
    setSalvando(true);
    setErro('');
    setMsgOk('');
    const body = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || undefined,
      ordem: form.ordem !== '' ? Number(form.ordem) : undefined,
      ativo: form.ativo,
    };
    try {
      if (editandoId) {
        await adminPut(`/api/admin/sessoes/tipos/${editandoId}`, body);
        setMsgOk('Tipo de sessão atualizado.');
      } else {
        await adminPost('/api/admin/sessoes/tipos', body);
        setMsgOk('Tipo de sessão criado.');
      }
      cancelarEdicao();
      await carregar();
      onMudou();
    } catch (err) {
      setErro(err instanceof AdminApiError ? err.message : 'Erro ao salvar o tipo de sessão.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    setExcluindoId(id);
    setErro('');
    setMsgOk('');
    try {
      await adminDelete(`/api/admin/sessoes/tipos/${id}`);
      setMsgOk('Tipo de sessão excluído.');
      setConfirmandoId(null);
      if (editandoId === id) cancelarEdicao();
      await carregar();
      onMudou();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao excluir o tipo de sessão.');
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tipos de sessão">
      <div className="space-y-4">
        {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        {/* Formulário de criação/edição */}
        <form onSubmit={salvar} className="space-y-3 rounded border border-border p-3" noValidate>
          <p className="text-sm font-semibold">
            {editandoId ? 'Editar tipo de sessão' : 'Novo tipo de sessão'}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="tp-nome" className={ui.label}>
                Nome <span aria-hidden="true">*</span>
              </label>
              <input
                id="tp-nome"
                type="text"
                required
                className={ui.input}
                value={form.nome}
                onChange={(e) => s('nome', e.target.value)}
                placeholder="ex.: Ordinária"
              />
            </div>
            <div>
              <label htmlFor="tp-ordem" className={ui.label}>
                Ordem
              </label>
              <input
                id="tp-ordem"
                type="number"
                className={ui.input}
                value={form.ordem}
                onChange={(e) => s('ordem', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="tp-descricao" className={ui.label}>
              Descrição <span className="text-fg/50">(opcional)</span>
            </label>
            <input
              id="tp-descricao"
              type="text"
              className={ui.input}
              value={form.descricao}
              onChange={(e) => s('descricao', e.target.value)}
            />
          </div>
          <label htmlFor="tp-ativo" className="flex items-center gap-2 text-sm">
            <input
              id="tp-ativo"
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => s('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Ativo
          </label>
          <div className="flex justify-end gap-2">
            {editandoId && (
              <button type="button" className={ui.btnGhost} onClick={cancelarEdicao} disabled={salvando}>
                Cancelar edição
              </button>
            )}
            <button type="submit" className={ui.btn} disabled={salvando} aria-busy={salvando}>
              {salvando ? 'Salvando…' : editandoId ? 'Salvar alterações' : 'Adicionar tipo'}
            </button>
          </div>
        </form>

        {/* Lista de tipos */}
        {carregando ? (
          <p aria-live="polite" aria-busy="true" className="py-8 text-center text-sm text-fg/60">
            Carregando tipos…
          </p>
        ) : tipos.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg/60">Nenhum tipo de sessão cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm" aria-label="Tipos de sessão">
              <thead>
                <tr>
                  <th scope="col" className={ui.th}>Nome</th>
                  <th scope="col" className={ui.th}>Ordem</th>
                  <th scope="col" className={ui.th}>Situação</th>
                  <th scope="col" className={ui.th}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tipos.map((t) => (
                  <tr key={t.id}>
                    <td className={ui.td}>
                      <span className="font-medium">{t.nome}</span>
                      {t.descricao && (
                        <>
                          <br />
                          <span className="text-xs text-fg/60">{t.descricao}</span>
                        </>
                      )}
                    </td>
                    <td className={ui.td}>{t.ordem}</td>
                    <td className={ui.td}>
                      <span
                        className={`${ui.badge} ${
                          t.ativo ? 'bg-success/10 text-success' : 'bg-muted text-fg/60'
                        }`}
                      >
                        {t.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className={ui.td}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={ui.btnGhost}
                          onClick={() => editar(t)}
                          aria-label={`Editar tipo "${t.nome}"`}
                        >
                          Editar
                        </button>
                        {confirmandoId === t.id ? (
                          <>
                            <button
                              type="button"
                              className={ui.btnDanger}
                              onClick={() => excluir(t.id)}
                              disabled={excluindoId === t.id}
                              aria-busy={excluindoId === t.id}
                            >
                              {excluindoId === t.id ? 'Excluindo…' : 'Confirmar'}
                            </button>
                            <button
                              type="button"
                              className={ui.btnGhost}
                              onClick={() => setConfirmandoId(null)}
                              disabled={excluindoId === t.id}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={ui.btnDanger}
                            onClick={() => setConfirmandoId(t.id)}
                            aria-label={`Excluir tipo "${t.nome}"`}
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

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={ui.btnGhost} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}
