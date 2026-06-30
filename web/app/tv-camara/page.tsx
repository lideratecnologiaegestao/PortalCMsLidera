/**
 * Página pública: TV Câmara (player ao vivo + próxima/última sessão + acervo).
 * Server Component — SSR/ISR. WCAG 2.1 AA (player com título, semântica).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTvCamara } from '../../lib/portal-api';

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'TV Câmara',
    description: 'Acompanhe ao vivo as sessões plenárias e acesse o acervo de gravações da Câmara Municipal.',
    robots: { index: true, follow: true },
  };
}

function formatarData(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default async function TvCamaraPage() {
  const { aoVivo, proxima, ultima, acervo } = await getTvCamara();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-fg">TV Câmara</h1>
      <p className="mt-1 text-muted-fg">Transmissão ao vivo das sessões plenárias e acervo de gravações.</p>

      <section aria-labelledby="vivo-h" className="mt-8">
        <h2 id="vivo-h" className="text-xl font-semibold text-fg">Ao vivo</h2>
        {aoVivo && aoVivo.videoAoVivoUrl ? (
          <div className="mt-3">
            <div className="aspect-video overflow-hidden rounded-lg border border-border bg-card">
              <iframe
                src={aoVivo.videoAoVivoUrl}
                title={`Transmissão ao vivo: ${aoVivo.titulo}`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
            <p className="mt-2 font-medium text-fg">
              <Link href={`/sessoes/${aoVivo.id}`} className="underline">{aoVivo.titulo}</Link>
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-border bg-card p-6">
            <p className="text-muted-fg">Nenhuma sessão sendo transmitida no momento.</p>
            {proxima && (
              <p className="mt-2 text-fg">
                Próxima sessão:{' '}
                <Link href={`/sessoes/${proxima.id}`} className="text-primary underline">{proxima.titulo}</Link>{' '}
                — <time dateTime={proxima.dataHora}>{formatarData(proxima.dataHora)}</time>
              </p>
            )}
          </div>
        )}
      </section>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {proxima && (
          <section aria-labelledby="prox-h" className="rounded-lg border border-border bg-card p-4">
            <h2 id="prox-h" className="text-lg font-semibold text-fg">Próxima sessão</h2>
            <p className="mt-2 font-medium text-card-fg">
              <Link href={`/sessoes/${proxima.id}`} className="underline">{proxima.titulo}</Link>
            </p>
            <p className="mt-1 text-sm text-muted-fg">
              <time dateTime={proxima.dataHora}>{formatarData(proxima.dataHora)}</time>
              {proxima.local && <span> · {proxima.local}</span>}
            </p>
          </section>
        )}
        {ultima && (
          <section aria-labelledby="ult-h" className="rounded-lg border border-border bg-card p-4">
            <h2 id="ult-h" className="text-lg font-semibold text-fg">Última sessão</h2>
            <p className="mt-2 font-medium text-card-fg">
              <Link href={`/sessoes/${ultima.id}`} className="underline">{ultima.titulo}</Link>
            </p>
            <p className="mt-1 text-sm text-muted-fg">
              <time dateTime={ultima.dataHora}>{formatarData(ultima.dataHora)}</time>
            </p>
          </section>
        )}
      </div>

      <section aria-labelledby="acervo-h" className="mt-10">
        <h2 id="acervo-h" className="text-xl font-semibold text-fg">Acervo de gravações</h2>
        {acervo.length === 0 ? (
          <p className="mt-3 text-muted-fg">Nenhuma gravação disponível no momento.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {acervo.map((s) => (
              <li key={s.id} className="rounded-lg border border-border bg-card p-4">
                <p className="font-semibold text-card-fg">
                  <Link href={`/sessoes/${s.id}`} className="underline">{s.titulo}</Link>
                </p>
                <p className="mt-1 text-sm text-muted-fg">
                  <time dateTime={s.dataHora}>{formatarData(s.dataHora)}</time>
                </p>
                {s.gravacoes.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {s.gravacoes.map((g) => (
                      <li key={g.id} className="text-sm">
                        {g.videoUrl ? (
                          <a href={g.videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                            {g.titulo}
                          </a>
                        ) : (
                          <span className="text-muted-fg">{g.titulo}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
