'use client';

/**
 * ModalEdital — CRUD de um edital de PSS.
 *
 *   POST /api/admin/pss/editais
 *   PUT  /api/admin/pss/editais/:id
 *
 * Campos do CriarEditalDto: numero, titulo, slug, objeto, status,
 * inscricaoInicio, inscricaoFim, ordem, ativo.
 */

import { useEffect, useState } from 'react';
import { AdminApiError, adminPost, adminPut } from '../../../lib/admin-api';
import { Aviso, Modal, ui } from '../_components/ui';
import { STATUS_EDITAL, type EditalAdmin } from './tipos';

/** Converte ISO -> valor de <input type="datetime-local"> (YYYY-MM-DDTHH:mm). */
function toDateTimeLocal(iso?: string | null): string {
  if (!iso) return '';
  return String(iso).slice(0, 16);
}

interface FormEdital {
  numero: string;
  titulo: string;
  slug: string;
  objeto: string;
  status: string;
  inscricaoInicio: string;
  inscricaoFim: string;
  ordem: string;
  ativo: boolean;
}

function formVazio(): FormEdital {
  return {
    numero: '',
    titulo: '',
    slug: '',
    objeto: '',
    status: 'rascunho',
    inscricaoInicio: '',
    inscricaoFim: '',
    ordem: '0',
    ativo: true,
  };
}

export default function ModalEdital({
  open,
  editando,
  onClose,
  onSalvo,
}: {
  open: boolean;
  editando: EditalAdmin | null;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState<FormEdital>(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!open) return;
    setErro('');
    setForm(
      editando
        ? {
            numero: editando.numero,
            titulo: editando.titulo,
            slug: editando.slug ?? '',
            objeto: editando.objeto ?? '',
            status: editando.status ?? 'rascunho',
            inscricaoInicio: toDateTimeLocal(editando.inscricaoInicio),
            inscricaoFim: toDateTimeLocal(editando.inscricaoFim),
            ordem: String(editando.ordem ?? 0),
            ativo: editando.ativo,
          }
        : formVazio(),
    );
  }, [open, editando]);

  function s<K extends keyof FormEdital>(k: K, v: FormEdital[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.numero.trim()) {
      setErro('Informe o número do edital.');
      return;
    }
    if (!form.titulo.trim()) {
      setErro('Informe o título do edital.');
      return;
    }
    setSalvando(true);
    setErro('');
    const body = {
      numero: form.numero.trim(),
      titulo: form.titulo.trim(),
      slug: form.slug.trim() || undefined,
      objeto: form.objeto.trim() || undefined,
      status: form.status || undefined,
      inscricaoInicio: form.inscricaoInicio || undefined,
      inscricaoFim: form.inscricaoFim || undefined,
      ordem: form.ordem !== '' ? Number(form.ordem) : undefined,
      ativo: form.ativo,
    };
    try {
      if (editando) {
        await adminPut(`/api/admin/pss/editais/${editando.id}`, body);
      } else {
        await adminPost('/api/admin/pss/editais', body);
      }
      onSalvo();
      onClose();
    } catch (err) {
      setErro(err instanceof AdminApiError ? err.message : 'Erro ao salvar o edital.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? 'Editar edital' : 'Novo edital'}>
      <form onSubmit={salvar} className="space-y-4" noValidate>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="ed-numero" className={ui.label}>
              Número <span aria-hidden="true">*</span>
            </label>
            <input
              id="ed-numero"
              type="text"
              required
              className={ui.input}
              value={form.numero}
              onChange={(e) => s('numero', e.target.value)}
              placeholder="ex.: 001/2027"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ed-titulo" className={ui.label}>
              Título <span aria-hidden="true">*</span>
            </label>
            <input
              id="ed-titulo"
              type="text"
              required
              className={ui.input}
              value={form.titulo}
              onChange={(e) => s('titulo', e.target.value)}
              placeholder="ex.: Processo Seletivo Simplificado nº 001/2027"
            />
          </div>
        </div>

        <div>
          <label htmlFor="ed-slug" className={ui.label}>
            Slug <span className="text-fg/50">(opcional)</span>
          </label>
          <input
            id="ed-slug"
            type="text"
            className={ui.input}
            value={form.slug}
            onChange={(e) => s('slug', e.target.value)}
            placeholder="Gerado a partir do número e título se vazio"
            aria-describedby="ed-slug-hint"
          />
          <p id="ed-slug-hint" className="mt-1 text-xs text-fg/60">
            Endereço amigável do edital no portal. Deixe em branco para gerar automaticamente.
          </p>
        </div>

        <div>
          <label htmlFor="ed-objeto" className={ui.label}>
            Objeto
          </label>
          <textarea
            id="ed-objeto"
            rows={4}
            className={ui.input}
            value={form.objeto}
            onChange={(e) => s('objeto', e.target.value)}
            placeholder="Finalidade do certame: contratação temporária para os cargos…"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="ed-status" className={ui.label}>
              Situação
            </label>
            <select
              id="ed-status"
              className={ui.input}
              value={form.status}
              onChange={(e) => s('status', e.target.value)}
            >
              {STATUS_EDITAL.map((st) => (
                <option key={st.v} value={st.v}>
                  {st.l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ed-inicio" className={ui.label}>
              Início das inscrições
            </label>
            <input
              id="ed-inicio"
              type="datetime-local"
              className={ui.input}
              value={form.inscricaoInicio}
              onChange={(e) => s('inscricaoInicio', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="ed-fim" className={ui.label}>
              Fim das inscrições
            </label>
            <input
              id="ed-fim"
              type="datetime-local"
              className={ui.input}
              value={form.inscricaoFim}
              onChange={(e) => s('inscricaoFim', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ed-ordem" className={ui.label}>
              Ordem de exibição
            </label>
            <input
              id="ed-ordem"
              type="number"
              min={0}
              className={ui.input}
              value={form.ordem}
              onChange={(e) => s('ordem', e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <input
              id="ed-ativo"
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => s('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <label htmlFor="ed-ativo" className="pb-2 text-sm font-semibold">
              Edital ativo (visível no portal)
            </label>
          </div>
        </div>

        {!editando && (
          <p className="rounded border border-dashed border-border bg-muted/20 p-3 text-xs text-fg/60">
            Salve o edital para depois gerenciar <strong>vagas</strong>, <strong>fases</strong>,{' '}
            <strong>inscrições</strong>, <strong>notas</strong>, <strong>ranking</strong> e{' '}
            <strong>APLIC</strong>.
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
    </Modal>
  );
}
