'use client';

/**
 * ModalProposicao — CRUD de uma proposição (projeto de lei, requerimento, etc.).
 *
 *   POST /api/admin/legislativo/proposicoes
 *   PUT  /api/admin/legislativo/proposicoes/:id
 *
 * Campos: tipo, numero, ano, protocolo, ementa, texto, autorPrincipalId,
 * dataProtocolo, publicada + autores (vereadorId, papel, ordem).
 *
 * Observação: o status_atual NÃO é alterado aqui — a transição de fase é feita
 * apenas pela tramitação (append-only), na tela de gestão.
 */

import { useEffect, useState } from 'react';
import { AdminApiError, adminPost, adminPut } from '../../../lib/admin-api';
import { Aviso, Modal, ui } from '../_components/ui';
import MediaPicker from '../_components/MediaPicker';
import type { VereadorAdmin } from '../parlamentar/tipos';
import {
  PAPEIS_AUTOR,
  TIPOS_PROPOSICAO,
  type ProposicaoAdmin,
  type ProposicaoDetalhe,
} from './tipos';

/** Converte ISO para o valor de um <input type="date"> (YYYY-MM-DD). */
function toDateInput(iso?: string | null): string {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

interface AutorForm {
  vereadorId: string;
  papel: string;
}

interface FormProposicao {
  tipo: string;
  numero: string;
  ano: string;
  protocolo: string;
  ementa: string;
  texto: string;
  pdfUrl: string;
  autorPrincipalId: string;
  dataProtocolo: string;
  publicada: boolean;
  autores: AutorForm[];
}

function formVazio(): FormProposicao {
  return {
    tipo: 'pl_ordinaria',
    numero: '',
    ano: String(new Date().getFullYear()),
    protocolo: '',
    ementa: '',
    texto: '',
    pdfUrl: '',
    autorPrincipalId: '',
    dataProtocolo: '',
    publicada: true,
    autores: [],
  };
}

export default function ModalProposicao({
  open,
  editando,
  vereadores,
  onClose,
  onSalvo,
}: {
  open: boolean;
  /** Detalhe (com autores) quando edição; null em criação. */
  editando: ProposicaoDetalhe | null;
  vereadores: VereadorAdmin[];
  onClose: () => void;
  onSalvo: (msg: string) => void;
}) {
  const [form, setForm] = useState<FormProposicao>(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErro('');
    setForm(
      editando
        ? {
            tipo: editando.tipo ?? 'pl_ordinaria',
            numero: editando.numero != null ? String(editando.numero) : '',
            ano: editando.ano != null ? String(editando.ano) : '',
            protocolo: editando.protocolo ?? '',
            ementa: editando.ementa ?? '',
            texto: editando.texto ?? '',
            pdfUrl: editando.pdfUrl ?? '',
            autorPrincipalId: editando.autorPrincipalId ?? '',
            dataProtocolo: toDateInput(editando.dataProtocolo),
            publicada: editando.publicada,
            autores: (editando.autores ?? []).map((a) => ({
              vereadorId: a.vereadorId,
              papel: a.papel ?? 'autor',
            })),
          }
        : formVazio(),
    );
  }, [open, editando]);

  function s<K extends keyof FormProposicao>(k: K, v: FormProposicao[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function addAutor() {
    setForm((p) => ({ ...p, autores: [...p.autores, { vereadorId: '', papel: 'coautor' }] }));
  }
  function alterarAutor(idx: number, campo: keyof AutorForm, valor: string) {
    setForm((p) => ({
      ...p,
      autores: p.autores.map((a, i) => (i === idx ? { ...a, [campo]: valor } : a)),
    }));
  }
  function removerAutor(idx: number) {
    setForm((p) => ({ ...p, autores: p.autores.filter((_, i) => i !== idx) }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ementa.trim()) {
      setErro('Informe a ementa da proposição.');
      return;
    }
    const autoresValidos = form.autores.filter((a) => a.vereadorId);
    if (autoresValidos.length !== form.autores.length) {
      setErro('Selecione o vereador de cada coautor/relator (ou remova a linha vazia).');
      return;
    }
    setSalvando(true);
    setErro('');
    const body = {
      tipo: form.tipo || undefined,
      numero: form.numero !== '' ? Number(form.numero) : undefined,
      ano: form.ano !== '' ? Number(form.ano) : undefined,
      protocolo: form.protocolo.trim() || undefined,
      ementa: form.ementa.trim(),
      texto: form.texto.trim() || undefined,
      pdfUrl: form.pdfUrl.trim() || undefined,
      autorPrincipalId: form.autorPrincipalId || undefined,
      dataProtocolo: form.dataProtocolo || undefined,
      publicada: form.publicada,
      autores: autoresValidos.map((a, i) => ({
        vereadorId: a.vereadorId,
        papel: a.papel || 'autor',
        ordem: i,
      })),
    };
    try {
      if (editando) {
        await adminPut(`/api/admin/legislativo/proposicoes/${editando.id}`, body);
      } else {
        await adminPost('/api/admin/legislativo/proposicoes', body);
      }
      onSalvo(editando ? 'Proposição atualizada com sucesso.' : 'Proposição criada com sucesso.');
      onClose();
    } catch (err) {
      setErro(err instanceof AdminApiError ? err.message : 'Erro ao salvar a proposição.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? 'Editar proposição' : 'Nova proposição'}>
      <form onSubmit={salvar} className="space-y-4" noValidate>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="pr-tipo" className={ui.label}>
              Tipo
            </label>
            <select id="pr-tipo" className={ui.input} value={form.tipo} onChange={(e) => s('tipo', e.target.value)}>
              {TIPOS_PROPOSICAO.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pr-numero" className={ui.label}>
              Número
            </label>
            <input
              id="pr-numero"
              type="number"
              min={0}
              className={ui.input}
              value={form.numero}
              onChange={(e) => s('numero', e.target.value)}
              placeholder="ex.: 12"
            />
          </div>
          <div>
            <label htmlFor="pr-ano" className={ui.label}>
              Ano
            </label>
            <input
              id="pr-ano"
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
          <label htmlFor="pr-ementa" className={ui.label}>
            Ementa <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="pr-ementa"
            rows={3}
            required
            className={ui.input}
            value={form.ementa}
            onChange={(e) => s('ementa', e.target.value)}
            placeholder="Resumo do objeto da proposição."
          />
        </div>

        <div>
          <label htmlFor="pr-texto" className={ui.label}>
            Texto integral <span className="text-fg/50">(aceita HTML)</span>
          </label>
          <textarea
            id="pr-texto"
            rows={5}
            className={ui.input}
            value={form.texto}
            onChange={(e) => s('texto', e.target.value)}
            placeholder="<p>Art. 1º …</p>"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="pr-protocolo" className={ui.label}>
              Protocolo
            </label>
            <input
              id="pr-protocolo"
              type="text"
              className={ui.input}
              value={form.protocolo}
              onChange={(e) => s('protocolo', e.target.value)}
              placeholder="ex.: 2027/000123"
            />
          </div>
          <div>
            <label htmlFor="pr-dataprot" className={ui.label}>
              Data de protocolo
            </label>
            <input
              id="pr-dataprot"
              type="date"
              className={ui.input}
              value={form.dataProtocolo}
              onChange={(e) => s('dataProtocolo', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="pr-autorprincipal" className={ui.label}>
            Autor principal
          </label>
          <select
            id="pr-autorprincipal"
            className={ui.input}
            value={form.autorPrincipalId}
            onChange={(e) => s('autorPrincipalId', e.target.value)}
          >
            <option value="">— Nenhum / a definir</option>
            {vereadores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nomeParlamentar}
                {v.partido ? ` (${v.partido})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Autores adicionais (coautores / relator) */}
        <fieldset className="rounded border border-border p-3">
          <legend className="px-1 text-sm font-semibold">Autores adicionais (coautores / relator)</legend>
          {form.autores.length === 0 ? (
            <p className="text-sm text-fg/60">Nenhum coautor adicionado.</p>
          ) : (
            <ul className="space-y-2">
              {form.autores.map((a, idx) => (
                <li key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end">
                  <div className="sm:col-span-7">
                    <label htmlFor={`pr-aut-ver-${idx}`} className="sr-only">
                      Vereador do autor {idx + 1}
                    </label>
                    <select
                      id={`pr-aut-ver-${idx}`}
                      className={ui.input}
                      value={a.vereadorId}
                      onChange={(e) => alterarAutor(idx, 'vereadorId', e.target.value)}
                    >
                      <option value="">— Selecione o vereador</option>
                      {vereadores.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nomeParlamentar}
                          {v.partido ? ` (${v.partido})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor={`pr-aut-papel-${idx}`} className="sr-only">
                      Papel do autor {idx + 1}
                    </label>
                    <select
                      id={`pr-aut-papel-${idx}`}
                      className={ui.input}
                      value={a.papel}
                      onChange={(e) => alterarAutor(idx, 'papel', e.target.value)}
                    >
                      {PAPEIS_AUTOR.map((p) => (
                        <option key={p.v} value={p.v}>
                          {p.l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      className={`w-full ${ui.btnGhost}`}
                      onClick={() => removerAutor(idx)}
                      aria-label={`Remover autor ${idx + 1}`}
                    >
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex justify-end">
            <button type="button" className={ui.btnGhost} onClick={addAutor}>
              + Adicionar coautor
            </button>
          </div>
        </fieldset>

        {/* PDF da proposição */}
        <div>
          <label htmlFor="pr-pdf" className={ui.label}>
            PDF da proposição
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="pr-pdf"
              type="url"
              className={`flex-1 ${ui.input}`}
              value={form.pdfUrl}
              onChange={(e) => s('pdfUrl', e.target.value)}
              placeholder="https://..."
              aria-describedby="pr-pdf-hint"
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
          <p id="pr-pdf-hint" className="mt-1 text-xs text-fg/60">
            Informe uma URL ou selecione da Biblioteca de Mídia.
          </p>
        </div>

        <label htmlFor="pr-publicada" className="flex items-center gap-2 text-sm">
          <input
            id="pr-publicada"
            type="checkbox"
            checked={form.publicada}
            onChange={(e) => s('publicada', e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          Publicada (visível no portal)
        </label>

        {!editando && (
          <p className="rounded border border-dashed border-border bg-muted/20 p-3 text-xs text-fg/60">
            Salve a proposição para depois gerenciar <strong>tramitação</strong>,{' '}
            <strong>votação nominal</strong> e <strong>emendas</strong>.
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
