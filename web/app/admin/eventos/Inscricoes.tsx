'use client';

/**
 * Inscricoes — gestão dos inscritos de um evento (dentro de um Modal).
 *
 *   GET   /api/admin/eventos/:id/inscricoes          (listar inscritos)
 *   PATCH /api/admin/eventos/inscricoes/:inscricaoId (status + presença/check-in)
 *   POST  /api/admin/eventos/inscricoes/:id/certificado   (certificado individual)
 *   POST  /api/admin/eventos/:id/certificados             (certificados em lote)
 *
 * A emissão de certificados só aparece para eventos certificáveis e exige que
 * a presença do participante esteja registrada (regra do backend).
 */

import { useCallback, useEffect, useState } from 'react';
import { AdminApiError, adminGet, adminPatch, adminPost } from '../../../lib/admin-api';
import { Aviso, Modal, ui } from '../_components/ui';
import {
  STATUS_INSCRICAO,
  rotuloStatusInscricao,
  type EventoAdmin,
  type InscricaoAdmin,
} from './tipos';

function fmtData(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Inscricoes({
  open,
  evento,
  onClose,
}: {
  open: boolean;
  evento: EventoAdmin | null;
  onClose: () => void;
}) {
  const [inscricoes, setInscricoes] = useState<InscricaoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [msgOk, setMsgOk] = useState('');
  /** id da inscrição em operação (PATCH/certificado), para desabilitar o botão. */
  const [emProgresso, setEmProgresso] = useState<string | null>(null);
  const [emitindoLote, setEmitindoLote] = useState(false);

  const eventoId = evento?.id ?? '';

  const carregar = useCallback(async () => {
    if (!eventoId) return;
    setCarregando(true);
    setErro('');
    try {
      const data = await adminGet<InscricaoAdmin[]>(`/api/admin/eventos/${eventoId}/inscricoes`);
      setInscricoes(data);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao carregar inscrições.');
    } finally {
      setCarregando(false);
    }
  }, [eventoId]);

  useEffect(() => {
    if (open) {
      setMsgOk('');
      carregar();
    }
  }, [open, carregar]);

  async function patch(insc: InscricaoAdmin, body: { status?: string; presente?: boolean }) {
    setEmProgresso(insc.id);
    setErro('');
    setMsgOk('');
    try {
      const atualizada = await adminPatch<InscricaoAdmin>(`/api/admin/eventos/inscricoes/${insc.id}`, body);
      setInscricoes((lista) => lista.map((i) => (i.id === insc.id ? { ...i, ...atualizada } : i)));
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao atualizar a inscrição.');
    } finally {
      setEmProgresso(null);
    }
  }

  function alterarStatus(insc: InscricaoAdmin, status: string) {
    if (status !== insc.status) patch(insc, { status });
  }

  function alternarPresenca(insc: InscricaoAdmin) {
    patch(insc, { presente: !insc.presente });
  }

  async function emitirCertificado(insc: InscricaoAdmin) {
    setEmProgresso(insc.id);
    setErro('');
    setMsgOk('');
    try {
      await adminPost(`/api/admin/eventos/inscricoes/${insc.id}/certificado`);
      setMsgOk(`Certificado emitido para ${insc.nome}.`);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao emitir o certificado.');
    } finally {
      setEmProgresso(null);
    }
  }

  async function emitirLote() {
    if (!eventoId) return;
    setEmitindoLote(true);
    setErro('');
    setMsgOk('');
    try {
      const r = await adminPost<{ total: number }>(`/api/admin/eventos/${eventoId}/certificados`);
      setMsgOk(`${r.total} certificado(s) emitido(s) para os participantes presentes.`);
    } catch (e) {
      setErro(e instanceof AdminApiError ? e.message : 'Erro ao emitir certificados em lote.');
    } finally {
      setEmitindoLote(false);
    }
  }

  const presentes = inscricoes.filter((i) => i.presente).length;
  const confirmadas = inscricoes.filter((i) => i.status === 'confirmada').length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={evento ? `Inscrições — ${evento.titulo}` : 'Inscrições'}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-fg/70" aria-live="polite">
            {inscricoes.length} inscrito(s) · {confirmadas} confirmada(s) · {presentes} presente(s)
          </p>
          {evento?.certificavel && (
            <button
              type="button"
              className={ui.btn}
              onClick={emitirLote}
              disabled={emitindoLote || presentes === 0}
              aria-busy={emitindoLote}
              title={presentes === 0 ? 'Registre a presença de ao menos um participante.' : undefined}
            >
              {emitindoLote ? 'Emitindo…' : 'Emitir certificados (presentes)'}
            </button>
          )}
        </div>

        {msgOk && <Aviso tipo="ok">{msgOk}</Aviso>}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        {carregando ? (
          <p aria-live="polite" aria-busy="true" className="py-10 text-center text-sm text-fg/60">
            Carregando inscrições…
          </p>
        ) : inscricoes.length === 0 ? (
          <p className="py-10 text-center text-sm text-fg/60">Nenhuma inscrição registrada para este evento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm" aria-label="Lista de inscritos">
              <thead>
                <tr>
                  <th scope="col" className={ui.th}>
                    Participante
                  </th>
                  <th scope="col" className={ui.th}>
                    Contato
                  </th>
                  <th scope="col" className={ui.th}>
                    Inscrição
                  </th>
                  <th scope="col" className={ui.th}>
                    Status
                  </th>
                  <th scope="col" className={ui.th}>
                    Presença
                  </th>
                  {evento?.certificavel && (
                    <th scope="col" className={ui.th}>
                      <span className="sr-only">Certificado</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {inscricoes.map((i) => {
                  const ocupado = emProgresso === i.id;
                  return (
                    <tr key={i.id}>
                      <td className={ui.td}>
                        <span className="font-medium">{i.nome}</span>
                        {i.documento && (
                          <>
                            <br />
                            <span className="text-xs text-fg/60">Doc.: {i.documento}</span>
                          </>
                        )}
                      </td>
                      <td className={ui.td}>
                        <span className="break-all">{i.email}</span>
                        {i.telefone && (
                          <>
                            <br />
                            <span className="text-xs text-fg/60">{i.telefone}</span>
                          </>
                        )}
                      </td>
                      <td className={ui.td}>{fmtData(i.criadoEm)}</td>
                      <td className={ui.td}>
                        <label htmlFor={`status-${i.id}`} className="sr-only">
                          Status da inscrição de {i.nome}
                        </label>
                        <select
                          id={`status-${i.id}`}
                          className={ui.input}
                          value={i.status}
                          disabled={ocupado}
                          onChange={(e) => alterarStatus(i, e.target.value)}
                        >
                          {STATUS_INSCRICAO.map((st) => (
                            <option key={st.v} value={st.v}>
                              {st.l}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={ui.td}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={i.presente}
                          className={`${ui.badge} ${
                            i.presente ? 'bg-success/10 text-success' : 'bg-muted text-fg/60'
                          } disabled:opacity-50`}
                          disabled={ocupado}
                          onClick={() => alternarPresenca(i)}
                          aria-label={
                            i.presente
                              ? `Remover presença de ${i.nome}`
                              : `Registrar presença de ${i.nome}`
                          }
                        >
                          {i.presente ? '✓ Presente' : 'Marcar presença'}
                        </button>
                      </td>
                      {evento?.certificavel && (
                        <td className={ui.td}>
                          <button
                            type="button"
                            className={ui.btnGhost}
                            disabled={ocupado || !i.presente}
                            onClick={() => emitirCertificado(i)}
                            aria-label={`Emitir certificado para ${i.nome}`}
                            title={!i.presente ? 'Registre a presença antes de emitir o certificado.' : undefined}
                          >
                            {ocupado ? '…' : 'Certificado'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
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
