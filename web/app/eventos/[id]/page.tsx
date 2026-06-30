/**
 * Página pública: detalhe do evento / audiência pública (descrição, data,
 * local, transmissão online, vagas) com chamada para inscrição.
 * Server Component — SSR/ISR. WCAG 2.1 AA.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEvento } from '../../../lib/portal-api';
import { sanitizeHtml } from '../../../lib/sanitize-html';

export const revalidate = 120;

const TIPO_LABEL: Record<string, string> = {
  audiencia_publica: 'Audiência Pública',
  palestra: 'Palestra',
  seminario: 'Seminário',
  solenidade: 'Solenidade',
  outro: 'Evento',
};

function formatarData(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const e = await getEvento(params.id);
  if (!e) return { title: 'Evento não encontrado' };
  return {
    title: e.titulo,
    description: `${TIPO_LABEL[e.tipo] ?? 'Evento'} — ${e.titulo}. ${formatarData(e.dataHora)}.`,
    robots: { index: true, follow: true },
  };
}

export default async function EventoDetalhe({ params }: { params: { id: string } }) {
  const e = await getEvento(params.id);
  if (!e) notFound();

  const vagasEsgotadas = e.vagas != null && (e.vagasRestantes ?? 0) <= 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <nav aria-label="Trilha" className="text-sm text-muted-fg">
        <Link href="/eventos" className="underline">Eventos</Link> <span aria-hidden>›</span> {e.titulo}
      </nav>

      <header className="mt-4">
        <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-fg">
          {TIPO_LABEL[e.tipo] ?? e.tipo}
        </span>
        <h1 className="mt-2 text-2xl font-bold text-fg">{e.titulo}</h1>
      </header>

      {e.capaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={e.capaUrl}
          alt={`Imagem do evento ${e.titulo}`}
          className="mt-6 w-full rounded-xl object-cover"
        />
      )}

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <dt className="text-sm font-medium text-muted-fg">Data e horário</dt>
          <dd className="mt-1 text-card-fg">
            <time dateTime={e.dataHora}>{formatarData(e.dataHora)}</time>
            {e.dataFim && <> até <time dateTime={e.dataFim}>{formatarData(e.dataFim)}</time></>}
          </dd>
        </div>
        {e.local && (
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-sm font-medium text-muted-fg">Local</dt>
            <dd className="mt-1 text-card-fg">{e.local}</dd>
          </div>
        )}
        {e.onlineUrl && (
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-sm font-medium text-muted-fg">Transmissão / acesso online</dt>
            <dd className="mt-1">
              <a href={e.onlineUrl} className="text-primary underline" target="_blank" rel="noopener noreferrer">
                Acessar transmissão
              </a>
            </dd>
          </div>
        )}
        {e.vagas != null && (
          <div className="rounded-lg border border-border bg-card p-4">
            <dt className="text-sm font-medium text-muted-fg">Vagas</dt>
            <dd className="mt-1 text-card-fg">
              {vagasEsgotadas
                ? 'Esgotadas — inscrições entram em lista de espera'
                : `${e.vagasRestantes} de ${e.vagas} disponíveis`}
            </dd>
          </div>
        )}
      </dl>

      {e.descricao && (
        <section aria-labelledby="desc-h" className="mt-8">
          <h2 id="desc-h" className="text-xl font-semibold text-fg">Sobre o evento</h2>
          <div
            className="prose mt-3 max-w-none text-fg"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(e.descricao) }}
          />
        </section>
      )}

      {e.inscricoesAbertas && (
        <section aria-labelledby="insc-h" className="mt-10">
          <h2 id="insc-h" className="text-xl font-semibold text-fg">Inscrição</h2>
          <p className="mt-2 text-muted-fg">
            {vagasEsgotadas
              ? 'As vagas presenciais estão esgotadas. Você ainda pode se inscrever na lista de espera.'
              : 'Garanta sua participação fazendo sua inscrição.'}
          </p>
          <Link
            href={`/cidadao/eventos/${e.id}/inscricao`}
            className="mt-4 inline-block rounded-md bg-primary px-5 py-2.5 font-medium text-primary-fg transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Inscrever-se
          </Link>
        </section>
      )}
    </main>
  );
}
