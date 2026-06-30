/**
 * Página pública: Agenda de Eventos & Audiências Públicas.
 * Server Component — SSR com revalidação ISR. WCAG 2.1 AA (semântica,
 * contraste via tokens de tema, alt em imagens).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { getEventos } from '../../lib/portal-api';
import type { Evento } from '../../lib/portal-types';

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Eventos e Audiências Públicas',
    description:
      'Agenda de audiências públicas, palestras, seminários e solenidades da Câmara Municipal. Inscreva-se e participe.',
    robots: { index: true, follow: true },
  };
}

const TIPO_LABEL: Record<string, string> = {
  audiencia_publica: 'Audiência Pública',
  palestra: 'Palestra',
  seminario: 'Seminário',
  solenidade: 'Solenidade',
  outro: 'Evento',
};

function formatarData(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function EventoCard({ e }: { e: Evento }) {
  return (
    <Link
      href={`/eventos/${e.slug ?? e.id}`}
      className="block rounded-lg border border-border bg-card transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {e.capaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={e.capaUrl}
          alt={`Imagem do evento ${e.titulo}`}
          className="h-40 w-full rounded-t-lg object-cover"
        />
      ) : (
        <div aria-hidden="true" className="flex h-40 w-full items-center justify-center rounded-t-lg bg-muted text-muted-fg">
          {TIPO_LABEL[e.tipo] ?? 'Evento'}
        </div>
      )}
      <div className="p-4">
        <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-fg">
          {TIPO_LABEL[e.tipo] ?? e.tipo}
        </span>
        <h3 className="mt-2 font-semibold text-card-fg">{e.titulo}</h3>
        <p className="mt-1 text-sm text-muted-fg">
          <time dateTime={e.dataHora}>{formatarData(e.dataHora)}</time>
        </p>
        {e.local && <p className="mt-1 text-sm text-muted-fg">{e.local}</p>}
        {e.vagas != null && (
          <p className="mt-1 text-xs text-muted-fg">
            {e.vagasRestantes != null && e.vagasRestantes > 0
              ? `${e.vagasRestantes} vaga(s) disponível(is)`
              : 'Vagas esgotadas — lista de espera'}
          </p>
        )}
      </div>
    </Link>
  );
}

export default async function EventosPage() {
  const eventos = await getEventos();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-fg">Eventos e Audiências Públicas</h1>
      <p className="mt-1 text-muted-fg">
        Participe das audiências públicas e demais eventos da Câmara Municipal.
      </p>

      <section aria-labelledby="eventos-h" className="mt-8">
        <h2 id="eventos-h" className="sr-only">Lista de eventos</h2>
        {eventos.length === 0 ? (
          <p className="mt-4 text-muted-fg">Nenhum evento programado no momento.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {eventos.map((e) => (
              <li key={e.id}>
                <EventoCard e={e} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
