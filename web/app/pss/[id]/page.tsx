/**
 * Página pública: detalhe do edital PSS — objeto, vagas, fases/critérios,
 * anexos e ranking (quando publicado). Server Component — SSR/ISR. WCAG 2.1 AA.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPssEdital, getPssRanking } from '../../../lib/portal-api';
import { sanitizeHtml } from '../../../lib/sanitize-html';

export const revalidate = 120;

const STATUS_LABEL: Record<string, string> = {
  publicado: 'Publicado',
  inscricoes_abertas: 'Inscrições abertas',
  inscricoes_encerradas: 'Inscrições encerradas',
  em_avaliacao: 'Em avaliação',
  homologado: 'Homologado',
};

const FASE_LABEL: Record<string, string> = {
  inscricao: 'Inscrição',
  prova_objetiva: 'Prova objetiva',
  prova_pratica: 'Prova prática',
  entrevista: 'Entrevista',
  titulos: 'Títulos',
  experiencia: 'Experiência',
};

function dataBR(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const e = await getPssEdital(params.id);
  if (!e) return { title: 'Edital não encontrado' };
  return {
    title: `Edital ${e.numero} — ${e.titulo}`,
    description: `Processo Seletivo Simplificado: edital nº ${e.numero}. Vagas, fases e inscrições.`,
    robots: { index: true, follow: true },
  };
}

export default async function PssEditalPage({ params }: { params: { id: string } }) {
  const e = await getPssEdital(params.id);
  if (!e) notFound();
  const ranking = e.rankingPublicado ? await getPssRanking(params.id) : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <nav aria-label="Trilha" className="text-sm text-muted-fg">
        <Link href="/pss" className="underline">Processos Seletivos</Link> <span aria-hidden>›</span> Edital {e.numero}
      </nav>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-muted px-2 py-1 text-xs text-muted-fg">{STATUS_LABEL[e.status] ?? e.status}</span>
          {e.rankingPublicado && (
            <span className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-fg">Resultado disponível</span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-fg">Edital nº {e.numero}</h1>
        <p className="text-lg text-muted-fg">{e.titulo}</p>
        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="font-medium text-fg">Início das inscrições</dt>
            <dd className="text-muted-fg">{dataBR(e.inscricaoInicio)}</dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Fim das inscrições</dt>
            <dd className="text-muted-fg">{dataBR(e.inscricaoFim)}</dd>
          </div>
        </dl>
      </header>

      {e.objeto && (
        <section aria-labelledby="objeto-h" className="mt-8">
          <h2 id="objeto-h" className="text-xl font-semibold text-fg">Objeto</h2>
          <div className="prose mt-3 max-w-none text-fg" dangerouslySetInnerHTML={{ __html: sanitizeHtml(e.objeto) }} />
        </section>
      )}

      {Array.isArray(e.vagas) && e.vagas.length > 0 && (
        <section aria-labelledby="vagas-h" className="mt-8">
          <h2 id="vagas-h" className="text-xl font-semibold text-fg">Vagas</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Cargos e vagas do edital</caption>
              <thead>
                <tr className="border-b border-border text-left text-fg">
                  <th scope="col" className="py-2 pr-4">Cargo</th>
                  <th scope="col" className="py-2 pr-4">Escolaridade</th>
                  <th scope="col" className="py-2 pr-4">Vagas</th>
                  <th scope="col" className="py-2 pr-4">Cadastro reserva</th>
                </tr>
              </thead>
              <tbody>
                {e.vagas.map((v) => (
                  <tr key={v.id} className="border-b border-border text-muted-fg">
                    <td className="py-2 pr-4 font-medium text-card-fg">{v.cargo}</td>
                    <td className="py-2 pr-4">{v.escolaridade ?? '—'}</td>
                    <td className="py-2 pr-4">{v.quantidade}</td>
                    <td className="py-2 pr-4">{v.vagasCadastro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {Array.isArray(e.fases) && e.fases.length > 0 && (
        <section aria-labelledby="fases-h" className="mt-8">
          <h2 id="fases-h" className="text-xl font-semibold text-fg">Fases e critérios</h2>
          <ol className="mt-3 space-y-4">
            {e.fases.map((f) => (
              <li key={f.id} className="rounded border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-card-fg">{f.nome}</h3>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-fg">{FASE_LABEL[f.tipo] ?? f.tipo}</span>
                  {f.eliminatoria && (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-fg">Eliminatória</span>
                  )}
                  <span className="text-xs text-muted-fg">Peso {f.peso}</span>
                </div>
                {Array.isArray(f.criterios) && f.criterios.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-fg">
                    {f.criterios.map((c) => (
                      <li key={c.id}>
                        {c.descricao} — {c.pontos} ponto(s)
                        {c.pontosMaximo != null && ` (máx. ${c.pontosMaximo})`}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {Array.isArray(e.anexos) && e.anexos.length > 0 && (
        <section aria-labelledby="anexos-h" className="mt-8">
          <h2 id="anexos-h" className="text-xl font-semibold text-fg">Documentos do edital</h2>
          <ul className="mt-3 space-y-2">
            {e.anexos.map((a) => (
              <li key={a.id}>
                {a.url ? (
                  <a href={a.url} className="text-primary underline" target="_blank" rel="noopener noreferrer">
                    {a.titulo}
                  </a>
                ) : (
                  <span className="text-muted-fg">{a.titulo}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {ranking && Array.isArray(ranking.classificados) && ranking.classificados.length > 0 && (
        <section aria-labelledby="rank-h" className="mt-8">
          <h2 id="rank-h" className="text-xl font-semibold text-fg">Classificação</h2>
          <p className="mt-1 text-sm text-muted-fg">Publicado em {dataBR(ranking.publicadoEm)}.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Resultado classificatório do edital</caption>
              <thead>
                <tr className="border-b border-border text-left text-fg">
                  <th scope="col" className="py-2 pr-4">Classificação</th>
                  <th scope="col" className="py-2 pr-4">Protocolo</th>
                  <th scope="col" className="py-2 pr-4">Candidato</th>
                  <th scope="col" className="py-2 pr-4">Nota final</th>
                </tr>
              </thead>
              <tbody>
                {ranking.classificados.map((c) => (
                  <tr key={c.id} className="border-b border-border text-muted-fg">
                    <td className="py-2 pr-4 font-medium text-card-fg">{c.classificacao}º</td>
                    <td className="py-2 pr-4">{c.protocolo}</td>
                    <td className="py-2 pr-4">{c.nome}</td>
                    <td className="py-2 pr-4">{c.notaFinal ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
