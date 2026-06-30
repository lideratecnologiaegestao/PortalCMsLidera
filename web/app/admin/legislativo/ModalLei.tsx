'use client';

/**
 * ModalLei — CRUD de uma lei sancionada/promulgada.
 *
 *   POST  /api/admin/legislativo/leis
 *   PATCH /api/admin/legislativo/leis/:id   (edição via PATCH)
 *
 * Campos: numero, tipo, ementa, ano, dataSancao, proposicaoId, vigente,
 * publicada (+ texto e PDF).
 */

import { useEffect, useState } from 'react';
import { AdminApiError, adminPatch, adminPost } from '../../../lib/admin-api';
import { Aviso, Modal, ui } from '../_components/ui';
import MediaPicker from '../_components/MediaPicker';
import { TIPOS_LEI, type LeiAdmin } from './tipos';

/** Converte ISO para o valor de um <input type="date"> (YYYY-MM-DD). */
function toDateInput(iso?: string | null): string {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

interface FormLei {
  numero: string;
  tipo: string;
  ementa: string;
  ano: string;
  texto: string;
  dataSancao: string;
  proposicaoId: string;
  pdfUrl: string;
  vigente: boolean;
  publicada: boolean;
}

function formVazio(): FormLei {
  return {
    numero: '',
    tipo: 'lei_ordinaria',
    ementa: '',
    ano: String(new Date().getFullYear()),
    texto: '',
    dataSancao: '',
    proposicaoId: '',
    pdfUrl: '',
    vigente: true,
    publicada: true,
  };
}

export default function ModalLei({
  open,
  editando,
  proposicaoIdSugerida,
  onClose,
  onSalvo,
}: {
  open: boolean;
  editando: LeiAdmin | null;
  /** Pré-preenche o vínculo com uma proposição (criação a partir do drill-down). */
  proposicaoIdSugerida?: string | null;
  onClose: () => void;
  onSalvo: (msg: string) => void;
}) {
  const [form, setForm] = useState<FormLei>(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErro('');
    setForm(
      editando
        ? {
            numero: editando.numero,
            tipo: editando.tipo ?? 'lei_ordinaria',
            ementa: editando.ementa ?? '',
            ano: editando.ano != null ? String(editando.ano) : '',
            texto: editando.texto ?? '',
            dataSancao: toDateInput(editando.dataSancao),
            proposicaoId: editando.proposicaoId ?? '',
            pdfUrl: editando.pdfUrl ?? '',
            vigente: editando.vigente,
            publicada: editando.publicada,
          }
        : { ...formVazio(), proposicaoId: proposicaoIdSugerida ?? '' },
    );
  }, [open, editando, proposicaoIdSugerida]);

  function s<K extends keyof FormLei>(k: K, v: FormLei[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.numero.trim()) {
      setErro('Informe o número da lei.');
      return;
    }
    if (!form.ementa.trim()) {
      setErro('Informe a ementa da lei.');
      return;
    }
    setSalvando(true);
    setErro('');
    const body = {
      numero: form.numero.trim(),
      tipo: form.tipo || undefined,
      ementa: form.ementa.trim(),
      ano: form.ano !== '' ? Number(form.ano) : undefined,
      texto: form.texto.trim() || undefined,
      dataSancao: form.dataSancao || undefined,
      proposicaoId: form.proposicaoId.trim() || undefined,
      pdfUrl: form.pdfUrl.trim() || undefined,
      vigente: form.vigente,
      publicada: form.publicada,
    };
    try {
      if (editando) {
        await adminPatch(`/api/admin/legislativo/leis/${editando.id}`, body);
      } else {
        await adminPost('/api/admin/legislativo/leis', body);
      }
      onSalvo(editando ? 'Lei atualizada com sucesso.' : 'Lei criada com sucesso.');
      onClose();
    } catch (err) {
      setErro(err instanceof AdminApiError ? err.message : 'Erro ao salvar a lei.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? 'Editar lei' : 'Nova lei'}>
      <form onSubmit={salvar} className="space-y-4" noValidate>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="lei-numero" className={ui.label}>
              Número <span aria-hidden="true">*</span>
            </label>
            <input
              id="lei-numero"
              type="text"
              required
              className={ui.input}
              value={form.numero}
              onChange={(e) => s('numero', e.target.value)}
              placeholder="ex.: 1.234"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="lei-tipo" className={ui.label}>
              Tipo
            </label>
            <select id="lei-tipo" className={ui.input} value={form.tipo} onChange={(e) => s('tipo', e.target.value)}>
              {TIPOS_LEI.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lei-ano" className={ui.label}>
              Ano
            </label>
            <input
              id="lei-ano"
              type="number"
              min={1900}
              className={ui.input}
              value={form.ano}
              onChange={(e) => s('ano', e.target.value)}
              placeholder="ex.: 2027"
            />
          </div>
        </div>

        <div>
          <label htmlFor="lei-ementa" className={ui.label}>
            Ementa <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="lei-ementa"
            rows={3}
            required
            className={ui.input}
            value={form.ementa}
            onChange={(e) => s('ementa', e.target.value)}
            placeholder="Resumo do objeto da lei."
          />
        </div>

        <div>
          <label htmlFor="lei-texto" className={ui.label}>
            Texto integral <span className="text-fg/50">(aceita HTML)</span>
          </label>
          <textarea
            id="lei-texto"
            rows={5}
            className={ui.input}
            value={form.texto}
            onChange={(e) => s('texto', e.target.value)}
            placeholder="<p>Art. 1º …</p>"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="lei-datasancao" className={ui.label}>
              Data de sanção / promulgação
            </label>
            <input
              id="lei-datasancao"
              type="date"
              className={ui.input}
              value={form.dataSancao}
              onChange={(e) => s('dataSancao', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="lei-proposicao" className={ui.label}>
              Proposição de origem <span className="text-fg/50">(opcional)</span>
            </label>
            <input
              id="lei-proposicao"
              type="text"
              className={ui.input}
              value={form.proposicaoId}
              onChange={(e) => s('proposicaoId', e.target.value)}
              placeholder="UUID da proposição que originou a lei"
              aria-describedby="lei-proposicao-hint"
            />
            <p id="lei-proposicao-hint" className="mt-1 text-xs text-fg/60">
              Vincula a lei ao projeto de lei que a originou, quando aplicável.
            </p>
          </div>
        </div>

        {/* PDF da lei */}
        <div>
          <label htmlFor="lei-pdf" className={ui.label}>
            PDF da lei
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="lei-pdf"
              type="url"
              className={`flex-1 ${ui.input}`}
              value={form.pdfUrl}
              onChange={(e) => s('pdfUrl', e.target.value)}
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

        <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-semibold">Opções</legend>
          <label htmlFor="lei-vigente" className="flex items-center gap-2 text-sm">
            <input
              id="lei-vigente"
              type="checkbox"
              checked={form.vigente}
              onChange={(e) => s('vigente', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Vigente (em vigor)
          </label>
          <label htmlFor="lei-publicada" className="flex items-center gap-2 text-sm">
            <input
              id="lei-publicada"
              type="checkbox"
              checked={form.publicada}
              onChange={(e) => s('publicada', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Publicada (visível no portal)
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
        tipo="documento"
        onSelect={(asset) => {
          if (asset.urlPublica) s('pdfUrl', asset.urlPublica);
          setPicker(false);
        }}
      />
    </Modal>
  );
}
