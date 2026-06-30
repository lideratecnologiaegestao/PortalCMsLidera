/**
 * Página pública: Leis sancionadas/promulgadas (compilação de normas).
 * Server Component — SSR com revalidação ISR. WCAG 2.1 AA.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { getLeis } from '../../lib/portal-api';
import type { Lei } from '../../lib/portal-types';

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Leis Municipais',
    description: 'Consulte as leis municipais, leis complementares, resoluções e decretos legislativos da Câmara.',
    robots: { index: true, follow: true },
  };
}

const TIPO_LABEL: Record<string, string> = {
  lei_ordinaria: 'Lei Ordinária',
  lei_complementar: 'Lei Complementar',
  resolucao: 'Resolução',
  decreto_legislativo: 'Decreto Legislativo',
  emenda_lei_organica: 'Emenda à Lei Orgânica',
};

function dataBR(v?: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

export default async function LeisPage({
  searchParams,
}: {
  searchParams?: { tipo?: string; ano?: string };
}) {
  const leis = await getLeis({ tipo: searchParams?.tipo, ano: searchParams?.ano });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-fg">Leis Municipais</h1>
      <p className="mt-1 text-muted-fg">
        Compilação das normas aprovadas pela Câmara: leis ordinárias e complementares, resoluções e decretos.
      </p>

      <section aria-labelledby="leis-h" className="mt-8">
        <h2 id="leis-h" className="sr-only">Lista de leis</h2>
        {leis.length === 0 ? (
          <p className="mt-4 text-muted-fg">Nenhuma lei cadastrada.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {leis.map((l: Lei) => (
              <li key={l.id}>
                <Link
                  href={`/leis/${l.id}`}
                  className="block rounded-lg border border-border bg-card p-4 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-card-fg">
                      {TIPO_LABEL[l.tipo] ?? l.tipo} nº {l.numero}
                      {l.ano ? `/${l.ano}` : ''}
                    </span>
                    {!l.vigente && (
                      <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-fg">Revogada</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-fg">{l.ementa}</p>
                  {l.dataSancao && (
                    <p className="mt-1 text-xs text-muted-fg">Sancionada em {dataBR(l.dataSancao)}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10">
        <Link href="/projetos-lei" className="text-primary underline">Ver projetos de lei em tramitação →</Link>
      </p>
    </main>
  );
}
