'use client';

/**
 * ModalEvento — CRUD de um evento/audiência pública.
 *
 *   POST /api/admin/eventos
 *   PUT  /api/admin/eventos/:id
 *
 * Campos: tipo, titulo, slug, descricao, dataHora, dataFim, local, onlineUrl,
 * vagas, capaUrl (+ MediaPicker), certificavel, inscricoesAbertas, publicado,
 * ativo e sessaoId (vínculo opcional a uma sessão).
 */

import { useEffect, useState } from 'react';
import { AdminApiError, adminPost, adminPut } from '../../../lib/admin-api';
import { Aviso, Modal, ui } from '../_components/ui';
import MediaPicker from '../_components/MediaPicker';
import { TIPOS_EVENTO, type EventoAdmin } from './tipos';

/** Converte ISO -> valor de <input type="datetime-local"> (YYYY-MM-DDTHH:mm). */
function toDateTimeLocal(iso?: string | null): string {
  if (!iso) return '';
  return String(iso).slice(0, 16);
}

interface FormEvento {
  tipo: string;
  titulo: string;
  slug: string;
  descricao: string;
  dataHora: string;
  dataFim: string;
  local: string;
  onlineUrl: string;
  vagas: string;
  capaUrl: string;
  certificavel: boolean;
  inscricoesAbertas: boolean;
  publicado: boolean;
  ativo: boolean;
  sessaoId: string;
}

function formVazio(): FormEvento {
  return {
    tipo: 'audiencia_publica',
    titulo: '',
    slug: '',
    descricao: '',
    dataHora: '',
    dataFim: '',
    local: '',
    onlineUrl: '',
    vagas: '',
    capaUrl: '',
    certificavel: false,
    inscricoesAbertas: true,
    publicado: true,
    ativo: true,
    sessaoId: '',
  };
}

export default function ModalEvento({
  open,
  editando,
  onClose,
  onSalvo,
}: {
  open: boolean;
  editando: EventoAdmin | null;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState<FormEvento>(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErro('');
    setForm(
      editando
        ? {
            tipo: editando.tipo ?? 'audiencia_publica',
            titulo: editando.titulo,
            slug: editando.slug ?? '',
            descricao: editando.descricao ?? '',
            dataHora: toDateTimeLocal(editando.dataHora),
            dataFim: toDateTimeLocal(editando.dataFim),
            local: editando.local ?? '',
            onlineUrl: editando.onlineUrl ?? '',
            vagas: editando.vagas != null ? String(editando.vagas) : '',
            capaUrl: editando.capaUrl ?? '',
            certificavel: editando.certificavel,
            inscricoesAbertas: editando.inscricoesAbertas,
            publicado: editando.publicado,
            ativo: editando.ativo,
            sessaoId: editando.sessaoId ?? '',
          }
        : formVazio(),
    );
  }, [open, editando]);

  function s<K extends keyof FormEvento>(k: K, v: FormEvento[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) {
      setErro('Informe o título do evento.');
      return;
    }
    if (!form.dataHora) {
      setErro('Informe a data e hora do evento.');
      return;
    }
    setSalvando(true);
    setErro('');
    const body = {
      tipo: form.tipo || undefined,
      titulo: form.titulo.trim(),
      slug: form.slug.trim() || undefined,
      descricao: form.descricao || undefined,
      dataHora: form.dataHora,
      dataFim: form.dataFim || undefined,
      local: form.local.trim() || undefined,
      onlineUrl: form.onlineUrl.trim() || undefined,
      vagas: form.vagas !== '' ? Number(form.vagas) : undefined,
      capaUrl: form.capaUrl.trim() || undefined,
      certificavel: form.certificavel,
      inscricoesAbertas: form.inscricoesAbertas,
      publicado: form.publicado,
      ativo: form.ativo,
      sessaoId: form.sessaoId.trim() || undefined,
    };
    try {
      if (editando) {
        await adminPut(`/api/admin/eventos/${editando.id}`, body);
      } else {
        await adminPost('/api/admin/eventos', body);
      }
      onSalvo();
      onClose();
    } catch (err) {
      setErro(err instanceof AdminApiError ? err.message : 'Erro ao salvar o evento.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? 'Editar evento' : 'Novo evento'}>
      <form onSubmit={salvar} className="space-y-4" noValidate>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="ev-tipo" className={ui.label}>
              Tipo
            </label>
            <select id="ev-tipo" className={ui.input} value={form.tipo} onChange={(e) => s('tipo', e.target.value)}>
              {TIPOS_EVENTO.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ev-titulo" className={ui.label}>
              Título <span aria-hidden="true">*</span>
            </label>
            <input
              id="ev-titulo"
              type="text"
              required
              className={ui.input}
              value={form.titulo}
              onChange={(e) => s('titulo', e.target.value)}
              placeholder="ex.: Audiência Pública sobre o Orçamento 2027"
            />
          </div>
        </div>

        <div>
          <label htmlFor="ev-slug" className={ui.label}>
            Slug <span className="text-fg/50">(opcional)</span>
          </label>
          <input
            id="ev-slug"
            type="text"
            className={ui.input}
            value={form.slug}
            onChange={(e) => s('slug', e.target.value)}
            placeholder="Gerado a partir do título se vazio"
            aria-describedby="ev-slug-hint"
          />
          <p id="ev-slug-hint" className="mt-1 text-xs text-fg/60">
            Endereço amigável do evento no portal. Deixe em branco para gerar automaticamente.
          </p>
        </div>

        <div>
          <label htmlFor="ev-descricao" className={ui.label}>
            Descrição <span className="text-fg/50">(aceita HTML)</span>
          </label>
          <textarea
            id="ev-descricao"
            rows={4}
            className={ui.input}
            value={form.descricao}
            onChange={(e) => s('descricao', e.target.value)}
            placeholder="<p>Pauta, objetivos e demais informações…</p>"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ev-datahora" className={ui.label}>
              Data e hora de início <span aria-hidden="true">*</span>
            </label>
            <input
              id="ev-datahora"
              type="datetime-local"
              required
              className={ui.input}
              value={form.dataHora}
              onChange={(e) => s('dataHora', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="ev-datafim" className={ui.label}>
              Data e hora de término
            </label>
            <input
              id="ev-datafim"
              type="datetime-local"
              className={ui.input}
              value={form.dataFim}
              onChange={(e) => s('dataFim', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ev-local" className={ui.label}>
              Local
            </label>
            <input
              id="ev-local"
              type="text"
              className={ui.input}
              value={form.local}
              onChange={(e) => s('local', e.target.value)}
              placeholder="ex.: Plenário da Câmara Municipal"
            />
          </div>
          <div>
            <label htmlFor="ev-online" className={ui.label}>
              URL de transmissão / participação online
            </label>
            <input
              id="ev-online"
              type="url"
              className={ui.input}
              value={form.onlineUrl}
              onChange={(e) => s('onlineUrl', e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ev-vagas" className={ui.label}>
              Vagas <span className="text-fg/50">(em branco = ilimitadas)</span>
            </label>
            <input
              id="ev-vagas"
              type="number"
              min={0}
              className={ui.input}
              value={form.vagas}
              onChange={(e) => s('vagas', e.target.value)}
              placeholder="ex.: 120"
            />
          </div>
          <div>
            <label htmlFor="ev-sessao" className={ui.label}>
              ID da sessão vinculada <span className="text-fg/50">(opcional)</span>
            </label>
            <input
              id="ev-sessao"
              type="text"
              className={ui.input}
              value={form.sessaoId}
              onChange={(e) => s('sessaoId', e.target.value)}
              placeholder="UUID da sessão legislativa"
              aria-describedby="ev-sessao-hint"
            />
            <p id="ev-sessao-hint" className="mt-1 text-xs text-fg/60">
              Vincula este evento a uma sessão do Legislativo, quando aplicável.
            </p>
          </div>
        </div>

        {/* Capa */}
        <div>
          <label htmlFor="ev-capa" className={ui.label}>
            Imagem de capa
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="ev-capa"
              type="url"
              className={`flex-1 ${ui.input}`}
              value={form.capaUrl}
              onChange={(e) => s('capaUrl', e.target.value)}
              placeholder="https://..."
              aria-describedby="ev-capa-hint"
            />
            <button
              type="button"
              className={ui.btnGhost}
              onClick={() => setPicker(true)}
              aria-label="Escolher imagem de capa da biblioteca de mídia"
            >
              Escolher imagem
            </button>
          </div>
          <p id="ev-capa-hint" className="mt-1 text-xs text-fg/60">
            Informe uma URL ou selecione da Biblioteca de Mídia.
          </p>
          {form.capaUrl && (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.capaUrl}
                alt={`Capa de ${form.titulo || 'evento'}`}
                className="h-28 w-full max-w-sm rounded border border-border object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* Flags */}
        <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-semibold">Opções</legend>
          <label htmlFor="ev-certificavel" className="flex items-center gap-2 text-sm">
            <input
              id="ev-certificavel"
              type="checkbox"
              checked={form.certificavel}
              onChange={(e) => s('certificavel', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Emite certificado de participação
          </label>
          <label htmlFor="ev-inscricoes" className="flex items-center gap-2 text-sm">
            <input
              id="ev-inscricoes"
              type="checkbox"
              checked={form.inscricoesAbertas}
              onChange={(e) => s('inscricoesAbertas', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Inscrições abertas
          </label>
          <label htmlFor="ev-publicado" className="flex items-center gap-2 text-sm">
            <input
              id="ev-publicado"
              type="checkbox"
              checked={form.publicado}
              onChange={(e) => s('publicado', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Publicado (visível no portal)
          </label>
          <label htmlFor="ev-ativo" className="flex items-center gap-2 text-sm">
            <input
              id="ev-ativo"
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => s('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Ativo
          </label>
        </fieldset>

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
        open={picker}
        onClose={() => setPicker(false)}
        tipo="imagem"
        onSelect={(asset) => {
          if (asset.urlPublica) s('capaUrl', asset.urlPublica);
          setPicker(false);
        }}
      />
    </Modal>
  );
}
