/**
 * Página pública: detalhe da sessão (pauta, presenças, ata, gravações).
 * Server Component — SSR/ISR. WCAG 2.1 AA. Ata exibida apenas quando publicada.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessao } from '../../../lib/portal-api';
import { sanitizeHtml } from '../../../lib/sanitize-html';

export const revalidate = 120;

const STATUS_LABEL: Record<string, string> = {
  agendada: 'Agendada', em_andamento: 'Em andamento', encerrada: 'Encerrada', cancelada: 'Cancelada',
};
const SITUACAO_LABEL: Record<string, string> = {
  presente: 'Presente', ausente: 'Ausente', justificado: 'Justificado',
};

function formatarData(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const s = await getSessao(params.id);
  if (!s) return { title: 'Sessão não encontrada' };
  return {
    title: s.titulo,
    description: `Sessão plenária: ${s.titulo}. Pauta, presenças e ata.`,
    robots: { index: true, follow: true },
  };
}

export default async function SessaoDetalhe({ params }: { params: { id: string } }) {
  const s = await getSessao(params.id);
  if (!s) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <nav aria-label="Trilha" className="text-sm text-muted-fg">
        <Link href="/sessoes" className="underline">Sessões</Link> <span aria-hidden>›</span> {s.titulo}
      </nav>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          {s.tipoSessao && (
            <span className="rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-fg">{s.tipoSessao.nome}</span>
          )}
          <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-fg">{STATUS_LABEL[s.status] ?? s.status}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-fg">{s.titulo}</h1>
        <p className="mt-1 text-muted-fg">
          <time dateTime={s.dataHora}>{formatarData(s.dataHora)}</time>
          {s.local && <span> · {s.local}</span>}
          {typeof s.quorum === 'number' && <span> · Quórum: {s.quorum}</span>}
        </p>
      </header>

      {s.videoAoVivoUrl && s.status === 'em_andamento' && (
        <section aria-labelledby="vivo-h" className="mt-6">
          <h2 id="vivo-h" className="text-xl font-semibold text-fg">Transmissão ao vivo</h2>
          <div className="mt-3 aspect-video overflow-hidden rounded-lg border border-border bg-card">
            <iframe
              src={s.videoAoVivoUrl}
              title={`Transmissão ao vivo: ${s.titulo}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        </section>
      )}

      {Array.isArray(s.pautaItens) && s.pautaItens.length > 0 && (
        <section aria-labelledby="pauta-h" className="mt-8">
          <h2 id="pauta-h" className="text-xl font-semibold text-fg">Pauta</h2>
          <ol className="mt-3 space-y-2">
            {s.pautaItens.map((item, i) => (
              <li key={item.id} className="rounded border border-border bg-card p-3">
                <p className="font-medium text-card-fg">
                  <span className="text-muted-fg">{i + 1}.</span> {item.titulo}
                </p>
                {item.descricao && <p className="mt-1 text-sm text-muted-fg">{item.descricao}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {Array.isArray(s.presencas) && s.presencas.length > 0 && (
        <section aria-labelledby="pres-h" className="mt-8">
          <h2 id="pres-h" className="text-xl font-semibold text-fg">Presenças</h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {s.presencas.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded border border-border bg-card p-3">
                <span className="font-medium text-card-fg">
                  {p.vereador.slug ? (
                    <Link href={`/vereadores/${p.vereador.slug}`} className="underline">{p.vereador.nomeParlamentar}</Link>
                  ) : (
                    p.vereador.nomeParlamentar
                  )}
                </span>
                <span className="text-sm text-muted-fg">{SITUACAO_LABEL[p.situacao] ?? p.situacao}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.ataConteudo && (
        <section aria-labelledby="ata-h" className="mt-8">
          <h2 id="ata-h" className="text-xl font-semibold text-fg">Ata</h2>
          {s.ataPublicadaEm && (
            <p className="mt-1 text-sm text-muted-fg">
              Publicada em <time dateTime={s.ataPublicadaEm}>{formatarData(s.ataPublicadaEm)}</time>
            </p>
          )}
          <div
            className="prose mt-3 max-w-none text-fg"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.ataConteudo) }}
          />
        </section>
      )}

      {Array.isArray(s.gravacoes) && s.gravacoes.length > 0 && (
        <section aria-labelledby="grav-h" className="mt-8">
          <h2 id="grav-h" className="text-xl font-semibold text-fg">Gravações</h2>
          <ul className="mt-3 space-y-2">
            {s.gravacoes.map((g) => (
              <li key={g.id} className="rounded border border-border bg-card p-3">
                {g.videoUrl ? (
                  <a href={g.videoUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">
                    {g.titulo}
                  </a>
                ) : (
                  <span className="font-medium text-card-fg">{g.titulo}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
