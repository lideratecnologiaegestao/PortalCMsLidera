'use client';

/**
 * Admin — Parlamentar (Vereadores, Mesa Diretora e Comissões)
 *
 * Aba Vereadores (CRUD):
 *   GET    /api/admin/parlamentar/vereadores?page=&pageSize=
 *   POST   /api/admin/parlamentar/vereadores
 *   PUT    /api/admin/parlamentar/vereadores/:id
 *   DELETE /api/admin/parlamentar/vereadores/:id
 *
 * Abas Mesa Diretora e Comissões: ver MesaDiretora.tsx e Comissoes.tsx.
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
import { AdminHeader, Aviso, Modal, ui } from '../_components/ui';
import MediaPicker from '../_components/MediaPicker';
import MesaDiretora from './MesaDiretora';
import Comissoes from './Comissoes';
import type { VereadorAdmin } from './tipos';

// ─── Constantes ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const STATUS_VEREADOR = [
  { v: 'ativo', l: 'Ativo' },
  { v: 'licenciado', l: 'Licenciado' },
  { v: 'afastado', l: 'Afastado' },
  { v: 'inativo', l: 'Inativo' },
];

function rotuloStatus(s?: string | null): string {
  return STATUS_VEREADOR.find((x) => x.v === s)?.l ?? s ?? '—';
}

/** Converte ISO para o valor de um <input type="date"> (YYYY-MM-DD). */
function toDateInput(iso?: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

// ─── Form do vereador ────────────────────────────────────────────────────────

interface FormVereador {
  nome: string;
  nomeParlamentar: string;
  partido: string;
  status: string;
  legislatura: string;
  mandatoInicio: string;
  mandatoFim: string;
  email: string;
  telefone: string;
  fotoUrl: string;
  biografia: string;
  ordem: number;
  ativo: boolean;
}

function formVazio(): FormVereador {
  return {
    nome: '',
    nomeParlamentar: '',
    partido: '',
    status: 'ativo',
    legislatura: '',
    mandatoInicio: '',
    mandatoFim: '',
    email: '',
    telefone: '',
    fotoUrl: '',
    biografia: '',
    ordem: 0,
    ativo: true,
  };
}

function ModalVereador({
  open,
  editando,
  onClose,
  onSalvo,
}: {
  open: boolean;
  editando: VereadorAdmin | null;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState<FormVereador>(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErro('');
    setForm(
      editando
        ? {
            nome: editando.nome,
            nomeParlamentar: editando.nomeParlamentar,
            partido: editando.partido ?? '',
            status: editando.status ?? 'ativo',
            legislatura: editando.legislatura ?? '',
            mandatoInicio: toDateInput(editando.mandatoInicio),
            mandatoFim: toDateInput(editando.mandatoFim),
            email: editando.email ?? '',
            telefone: editando.telefone ?? '',
            fotoUrl: editando.fotoUrl ?? '',
            biografia: editando.biografia ?? '',
            ordem: editando.ordem,
            ativo: editando.ativo,
          }
        : formVazio(),
    );
  }, [open, editando]);

  function s<K extends keyof FormVereador>(k: K, v: FormVereador[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    const body = {
      nome: form.nome,
      nomeParlamentar: form.nomeParlamentar,
      partido: form.partido || undefined,
      status: form.status || undefined,
      legislatura: form.legislatura || undefined,
      mandatoInicio: form.mandatoInicio || undefined,
      mandatoFim: form.mandatoFim || undefined,
      email: form.email || undefined,
      telefone: form.telefone || undefined,
      fotoUrl: form.fotoUrl || undefined,
      biografia: form.biografia || undefined,
      ordem: Number(form.ordem) || 0,
      ativo: form.ativo,
    };
    try {
      if (editando) {
        await adminPut(`/api/admin/parlamentar/vereadores/${editando.id}`, body);
      } else {
        await adminPost('/api/admin/parlamentar/vereadores', body);
      }
      onSalvo();
      onClose();
    } catch (err) {
      setErro(err instanceof AdminApiError ? err.message : 'Erro ao salvar o vereador.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? 'Editar vereador' : 'Novo vereador'}>
      <form onSubmit={salvar} className="space-y-4" noValidate>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ver-nome" className={ui.label}>
              Nome civil <span aria-hidden="true">*</span>
            </label>
            <input
              id="ver-nome"
              type="text"
              required
              className={ui.input}
              value={form.nome}
              onChange={(e) => s('nome', e.target.value)}
              placeholder="Nome completo"
            />
          </div>
          <div>
            <label htmlFor="ver-nomeparl" className={ui.label}>
              Nome parlamentar <span aria-hidden="true">*</span>
            </label>
            <input
              id="ver-nomeparl"
              type="text"
              required
              className={ui.input}
              value={form.nomeParlamentar}
              onChange={(e) => s('nomeParlamentar', e.target.value)}
              placeholder="Como aparece no portal"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="ver-partido" className={ui.label}>
              Partido
            </label>
            <input
              id="ver-partido"
              type="text"
              className={ui.input}
              value={form.partido}
              onChange={(e) => s('partido', e.target.value)}
              placeholder="ex.: PSDB"
            />
          </div>
          <div>
            <label htmlFor="ver-status" className={ui.label}>
              Status
            </label>
            <select id="ver-status" className={ui.input} value={form.status} onChange={(e) => s('status', e.target.value)}>
              {STATUS_VEREADOR.map((st) => (
                <option key={st.v} value={st.v}>
                  {st.l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ver-legislatura" className={ui.label}>
              Legislatura
            </label>
            <input
              id="ver-legislatura"
              type="text"
              className={ui.input}
              value={form.legislatura}
              onChange={(e) => s('legislatura', e.target.value)}
              placeholder="ex.: 2025-2028"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ver-mandato-ini" className={ui.label}>
              Início do mandato
            </label>
            <input
              id="ver-mandato-ini"
              type="date"
              className={ui.input}
              value={form.mandatoInicio}
              onChange={(e) => s('mandatoInicio', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="ver-mandato-fim" className={ui.label}>
              Fim do mandato
            </label>
            <input
              id="ver-mandato-fim"
              type="date"
              className={ui.input}
              value={form.mandatoFim}
              onChange={(e) => s('mandatoFim', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ver-email" className={ui.label}>
              E-mail
            </label>
            <input
              id="ver-email"
              type="email"
              className={ui.input}
              value={form.email}
              onChange={(e) => s('email', e.target.value)}
              placeholder="vereador@camara.gov.br"
            />
          </div>
          <div>
            <label htmlFor="ver-telefone" className={ui.label}>
              Telefone
            </label>
            <input
              id="ver-telefone"
              type="tel"
              className={ui.input}
              value={form.telefone}
              onChange={(e) => s('telefone', e.target.value)}
              placeholder="(00) 0000-0000"
            />
          </div>
        </div>

        {/* Foto */}
        <div>
          <label htmlFor="ver-foto" className={ui.label}>
            Foto
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="ver-foto"
              type="url"
              className={`flex-1 ${ui.input}`}
              value={form.fotoUrl}
              onChange={(e) => s('fotoUrl', e.target.value)}
              placeholder="https://..."
              aria-describedby="ver-foto-hint"
            />
            <button
              type="button"
              className={ui.btnGhost}
              onClick={() => setPicker(true)}
              aria-label="Escolher foto da biblioteca de mídia"
            >
              Escolher imagem
            </button>
          </div>
          <p id="ver-foto-hint" className="mt-1 text-xs text-fg/60">
            Informe uma URL ou selecione da Biblioteca de Mídia.
          </p>
          {form.fotoUrl && (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.fotoUrl}
                alt={`Foto de ${form.nomeParlamentar || 'vereador(a)'}`}
                className="h-20 w-20 rounded-full border border-border object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* Biografia */}
        <div>
          <label htmlFor="ver-bio" className={ui.label}>
            Biografia <span className="text-fg/50">(aceita HTML)</span>
          </label>
          <textarea
            id="ver-bio"
            rows={5}
            className={ui.input}
            value={form.biografia}
            onChange={(e) => s('biografia', e.target.value)}
            placeholder="<p>Formação, trajetória política, atuação…</p>"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ver-ordem" className={ui.label}>
              Ordem de exibição
            </label>
            <input
              id="ver-ordem"
              type="number"
              min={0}
              className={ui.input}
              value={form.ordem}
              onChange={(e) => s('ordem', Number(e.target.value))}
            />
          </div>
          <div className="flex items-end gap-2">
            <input
              id="ver-ativo"
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => s('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <label htmlFor="ver-ativo" className="pb-2 text-sm font-semibold">
              Vereador ativo (visível no portal)
            </label>
          </div>
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

      <MediaPicker
        open={picker}
        onClose={() => setPicker(false)}
        tipo="imagem"
        onSelect={(asset) => {
          if (asset.urlPublica) s('fotoUrl', asset.urlPublica);
          setPicker(false);
        }}
      />
    </Modal>
  );
}

// ─── Aba Vereadores ──────────────────────────────────────────────────────────

function AbaVereadores() {
  const [vereadores, setVereadores] = useState<VereadorAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<VereadorAdmin | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const data = await adminGet<Pagina<VereadorAdmin>>(
        `/api/admin/parlamentar/vereadores${qs({ page, pageSize: PAGE_SIZE })}`,
      );
      setVereadores(data.items);
      setTotal(data.total);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar vereadores.');
    } finally {
      setCarregando(false);
    }
  }, [page]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirNovo() {
    setEditando(null);
    setModalAberto(true);
  }
  function abrirEditar(v: VereadorAdmin) {
    setEditando(v);
    setModalAberto(true);
  }

  async function excluir(id: string) {
    setExcluindo(true);
    setErro('');
    try {
      await adminDelete(`/api/admin/parlamentar/vereadores/${id}`);
      setMsgOk('Vereador excluído com sucesso.');
      setConfirmandoId(null);
      carregar();
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao excluir vereador.');
    } finally {
      setExcluindo(false);
    }
  }

  const totalPaginas = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg/70">
          Cadastro dos vereadores: dados de mandato, status, contatos, foto e biografia.
        </p>
        <button type="button" className={ui.btn} onClick={abrirNovo}>
          + Novo vereador
        </button>
      </div>

      {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {carregando ? (
        <p aria-live="polite" aria-busy="true" className="py-12 text-center text-sm text-fg/60">
          Carregando vereadores…
        </p>
      ) : vereadores.length === 0 ? (
        <p className="py-12 text-center text-sm text-fg/60">
          Nenhum vereador cadastrado. Clique em &ldquo;Novo vereador&rdquo; para começar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm" aria-label="Lista de vereadores">
            <thead>
              <tr>
                <th scope="col" className={ui.th}>
                  Ordem
                </th>
                <th scope="col" className={ui.th}>
                  Nome parlamentar
                </th>
                <th scope="col" className={ui.th}>
                  Partido
                </th>
                <th scope="col" className={ui.th}>
                  Status
                </th>
                <th scope="col" className={ui.th}>
                  Ativo
                </th>
                <th scope="col" className={ui.th}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {vereadores.map((v) => (
                <tr key={v.id}>
                  <td className={ui.td}>{v.ordem}</td>
                  <td className={ui.td}>
                    <span className="font-medium">{v.nomeParlamentar}</span>
                    {v.nome && v.nome !== v.nomeParlamentar && (
                      <>
                        <br />
                        <span className="text-xs text-fg/60">{v.nome}</span>
                      </>
                    )}
                  </td>
                  <td className={ui.td}>
                    {v.partido ? (
                      <span className={`${ui.badge} bg-muted text-fg`}>{v.partido}</span>
                    ) : (
                      <span className="text-fg/40">—</span>
                    )}
                  </td>
                  <td className={ui.td}>
                    <span className={`${ui.badge} bg-primary/10 text-primary`}>{rotuloStatus(v.status)}</span>
                  </td>
                  <td className={ui.td}>
                    <span
                      className={`${ui.badge} ${
                        v.ativo ? 'bg-success/10 text-success' : 'bg-muted text-fg/60'
                      }`}
                    >
                      {v.ativo ? 'Sim' : 'Não'}
                    </span>
                  </td>
                  <td className={ui.td}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={ui.btnGhost}
                        onClick={() => abrirEditar(v)}
                        aria-label={`Editar vereador "${v.nomeParlamentar}"`}
                      >
                        Editar
                      </button>
                      {confirmandoId === v.id ? (
                        <>
                          <button
                            type="button"
                            className={ui.btnDanger}
                            onClick={() => excluir(v.id)}
                            disabled={excluindo}
                            aria-busy={excluindo}
                          >
                            {excluindo ? 'Excluindo…' : 'Confirmar exclusão'}
                          </button>
                          <button
                            type="button"
                            className={ui.btnGhost}
                            onClick={() => setConfirmandoId(null)}
                            disabled={excluindo}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={ui.btnDanger}
                          onClick={() => setConfirmandoId(v.id)}
                          aria-label={`Excluir vereador "${v.nomeParlamentar}"`}
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

      {totalPaginas > 1 && (
        <nav aria-label="Paginação de vereadores" className="flex items-center gap-2 pt-2">
          <button
            type="button"
            className={ui.btnGhost}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Página anterior"
          >
            ← Anterior
          </button>
          <span className="text-sm text-fg/70">
            Página {page} de {totalPaginas} ({total} registros)
          </span>
          <button
            type="button"
            className={ui.btnGhost}
            disabled={page >= totalPaginas}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Próxima página"
          >
            Próxima →
          </button>
        </nav>
      )}

      <ModalVereador
        open={modalAberto}
        editando={editando}
        onClose={() => setModalAberto(false)}
        onSalvo={() => {
          setMsgOk(editando ? 'Vereador atualizado com sucesso.' : 'Vereador criado com sucesso.');
          carregar();
        }}
      />
    </div>
  );
}

// ─── Página com abas ─────────────────────────────────────────────────────────

type Aba = 'vereadores' | 'mesa' | 'comissoes';

const ABAS: { id: Aba; label: string }[] = [
  { id: 'vereadores', label: 'Vereadores' },
  { id: 'mesa', label: 'Mesa Diretora' },
  { id: 'comissoes', label: 'Comissões' },
];

export default function ParlamentarAdminPage() {
  const [aba, setAba] = useState<Aba>('vereadores');

  return (
    <div className="space-y-4">
      <AdminHeader
        title="Parlamentar"
        description="Vereadores, Mesa Diretora e comissões do Poder Legislativo municipal."
      />

      {/* Abas */}
      <div className="border-b border-border" role="tablist" aria-label="Seções do módulo Parlamentar">
        <div className="flex flex-wrap gap-1">
          {ABAS.map((a) => {
            const ativo = aba === a.id;
            return (
              <button
                key={a.id}
                type="button"
                role="tab"
                id={`tab-${a.id}`}
                aria-selected={ativo}
                aria-controls={`painel-${a.id}`}
                onClick={() => setAba(a.id)}
                className={`-mb-px rounded-t border-b-2 px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary ${
                  ativo
                    ? 'border-primary text-primary'
                    : 'border-transparent text-fg/60 hover:text-fg'
                }`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`tab-${aba}`}>
        {aba === 'vereadores' && <AbaVereadores />}
        {aba === 'mesa' && <MesaDiretora />}
        {aba === 'comissoes' && <Comissoes />}
      </div>
    </div>
  );
}
