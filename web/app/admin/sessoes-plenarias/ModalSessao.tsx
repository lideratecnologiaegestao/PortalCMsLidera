'use client';

/**
 * ModalSessao — CRUD de uma sessão plenária.
 *
 *   POST /api/admin/sessoes
 *   PUT  /api/admin/sessoes/:id
 *
 * Campos: tipoSessaoId (select dos tipos), titulo, dataHora, local, status,
 * quorum e videoAoVivoUrl (link da transmissão ao vivo / TV Câmara).
 */

import { useEffect, useState } from 'react';
import { AdminApiError, adminPost, adminPut } from '../../../lib/admin-api';
import { Aviso, Modal, ui } from '../_components/ui';
import { STATUS_SESSAO, type SessaoAdmin, type TipoSessaoAdmin } from './tipos';

/** Converte ISO -> valor de <input type="datetime-local"> (YYYY-MM-DDTHH:mm). */
function toDateTimeLocal(iso?: string | null): string {
  if (!iso) return '';
  return String(iso).slice(0, 16);
}

interface FormSessao {
  tipoSessaoId: string;
  titulo: string;
  dataHora: string;
  local: string;
  status: string;
  quorum: string;
  videoAoVivoUrl: string;
}

function formVazio(): FormSessao {
  return {
    tipoSessaoId: '',
    titulo: '',
    dataHora: '',
    local: '',
    status: 'agendada',
    quorum: '',
    videoAoVivoUrl: '',
  };
}

export default function ModalSessao({
  open,
  editando,
  tipos,
  onClose,
  onSalvo,
}: {
  open: boolean;
  editando: SessaoAdmin | null;
  tipos: TipoSessaoAdmin[];
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState<FormSessao>(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!open) return;
    setErro('');
    setForm(
      editando
        ? {
            tipoSessaoId: editando.tipoSessaoId ?? '',
            titulo: editando.titulo,
            dataHora: toDateTimeLocal(editando.dataHora),
            local: editando.local ?? '',
            status: editando.status ?? 'agendada',
            quorum: editando.quorum != null ? String(editando.quorum) : '',
            videoAoVivoUrl: editando.videoAoVivoUrl ?? '',
          }
        : formVazio(),
    );
  }, [open, editando]);

  function s<K extends keyof FormSessao>(k: K, v: FormSessao[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) {
      setErro('Informe o título da sessão.');
      return;
    }
    if (!form.dataHora) {
      setErro('Informe a data e hora da sessão.');
      return;
    }
    setSalvando(true);
    setErro('');
    const body = {
      tipoSessaoId: form.tipoSessaoId || undefined,
      titulo: form.titulo.trim(),
      dataHora: form.dataHora,
      local: form.local.trim() || undefined,
      status: form.status || undefined,
      quorum: form.quorum !== '' ? Number(form.quorum) : undefined,
      videoAoVivoUrl: form.videoAoVivoUrl.trim() || undefined,
    };
    try {
      if (editando) {
        await adminPut(`/api/admin/sessoes/${editando.id}`, body);
      } else {
        await adminPost('/api/admin/sessoes', body);
      }
      onSalvo();
      onClose();
    } catch (err) {
      setErro(err instanceof AdminApiError ? err.message : 'Erro ao salvar a sessão.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? 'Editar sessão' : 'Nova sessão'}>
      <form onSubmit={salvar} className="space-y-4" noValidate>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="se-tipo" className={ui.label}>
              Tipo de sessão
            </label>
            <select
              id="se-tipo"
              className={ui.input}
              value={form.tipoSessaoId}
              onChange={(e) => s('tipoSessaoId', e.target.value)}
            >
              <option value="">— Sem tipo —</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="se-titulo" className={ui.label}>
              Título <span aria-hidden="true">*</span>
            </label>
            <input
              id="se-titulo"
              type="text"
              required
              className={ui.input}
              value={form.titulo}
              onChange={(e) => s('titulo', e.target.value)}
              placeholder="ex.: 12ª Sessão Ordinária"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="se-datahora" className={ui.label}>
              Data e hora <span aria-hidden="true">*</span>
            </label>
            <input
              id="se-datahora"
              type="datetime-local"
              required
              className={ui.input}
              value={form.dataHora}
              onChange={(e) => s('dataHora', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="se-status" className={ui.label}>
              Situação
            </label>
            <select
              id="se-status"
              className={ui.input}
              value={form.status}
              onChange={(e) => s('status', e.target.value)}
            >
              {STATUS_SESSAO.map((st) => (
                <option key={st.v} value={st.v}>
                  {st.l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="se-local" className={ui.label}>
              Local
            </label>
            <input
              id="se-local"
              type="text"
              className={ui.input}
              value={form.local}
              onChange={(e) => s('local', e.target.value)}
              placeholder="ex.: Plenário da Câmara Municipal"
            />
          </div>
          <div>
            <label htmlFor="se-quorum" className={ui.label}>
              Quórum <span className="text-fg/50">(opcional)</span>
            </label>
            <input
              id="se-quorum"
              type="number"
              min={0}
              className={ui.input}
              value={form.quorum}
              onChange={(e) => s('quorum', e.target.value)}
              placeholder="ex.: 7"
            />
          </div>
        </div>

        <div>
          <label htmlFor="se-video" className={ui.label}>
            URL da transmissão ao vivo <span className="text-fg/50">(TV Câmara)</span>
          </label>
          <input
            id="se-video"
            type="url"
            className={ui.input}
            value={form.videoAoVivoUrl}
            onChange={(e) => s('videoAoVivoUrl', e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            aria-describedby="se-video-hint"
          />
          <p id="se-video-hint" className="mt-1 text-xs text-fg/60">
            Link ou embed da transmissão ao vivo. Exibido enquanto a sessão estiver em andamento.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={ui.btnGhost} onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className={ui.btn} disabled={salvando} aria-busy={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
