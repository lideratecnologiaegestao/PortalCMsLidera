/**
 * Página pública: Projetos de Lei e demais proposições.
 * Server Component — SSR com revalidação ISR. WCAG 2.1 AA (semântica,
 * contraste via tokens de tema, HTML semântico).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { getProposicoes } from '../../lib/portal-api';
import type { Proposicao } from '../../lib/portal-types';

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Projetos de Lei',
    description: 'Acompanhe os projetos de lei e demais proposições em tramitação na Câmara Municipal.',
    robots: { index: true, follow: true },
  };
}

const TIPO_LABEL: Record<string, string> = {
  pl_ordinaria: 'Projeto de Lei',
  pl_complementar: 'Projeto de Lei Complementar',
  resolucao: 'Resolução',
  decreto_legislativo: 'Decreto Legislativo',
  requerimento: 'Requerimento',
  mocao: 'Moção',
  emenda: 'Emenda',
};

const STATUS_LABEL: Record<string, string> = {
  protocolada: 'Protocolada',
  em_comissao: 'Em comissão',
  pauta: 'Em pauta',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  arquivada: 'Arquivada',
  sancionada: 'Sancionada',
  promulgada: 'Promulgada',
  vetada: 'Vetada',
};

function identificacao(p: Proposicao): string {
  const t = TIPO_LABEL[p.tipo] ?? p.tipo;
  if (p.numero && p.ano) return `${t} nº ${p.numero}/${p.ano}`;
  return t;
}

export default async function ProjetosLeiPage({
  searchParams,
}: {
  searchParams?: { tipo?: string; ano?: string; status?: string };
}) {
  const proposicoes = await getProposicoes({
    tipo: searchParams?.tipo,
    ano: searchParams?.ano,
    status: searchParams?.status,
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-fg">Projetos de Lei</h1>
      <p className="mt-1 text-muted-fg">
        Proposições em tramitação na Câmara Municipal: projetos de lei, resoluções, decretos, requerimentos e moções.
      </p>

      <section aria-labelledby="props-h" className="mt-8">
        <h2 id="props-h" className="sr-only">Lista de proposições</h2>
        {proposicoes.length === 0 ? (
          <p className="mt-4 text-muted-fg">Nenhuma proposição encontrada.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {proposicoes.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projetos-lei/${p.id}`}
                  className="block rounded-lg border border-border bg-card p-4 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-card-fg">{identificacao(p)}</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-fg">
                      {STATUS_LABEL[p.statusAtual] ?? p.statusAtual}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-fg">{p.ementa}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10">
        <Link href="/leis" className="text-primary underline">Ver leis sancionadas →</Link>
      </p>
    </main>
  );
}
