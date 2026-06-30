/**
 * Página pública: detalhe da lei — ementa, texto compilado, vínculo à
 * proposição de origem e download de PDF.
 * Server Component — SSR/ISR. WCAG 2.1 AA.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLei } from '../../../lib/portal-api';
import { sanitizeHtml } from '../../../lib/sanitize-html';

export const revalidate = 120;

const TIPO_LABEL: Record<string, string> = {
  lei_ordinaria: 'Lei Ordinária',
  lei_complementar: 'Lei Complementar',
  resolucao: 'Resolução',
  decreto_legislativo: 'Decreto Legislativo',
  emenda_lei_organica: 'Emenda à Lei Orgânica',
};

function titulo(l: any): string {
  return `${TIPO_LABEL[l.tipo] ?? l.tipo} nº ${l.numero}${l.ano ? `/${l.ano}` : ''}`;
}

function dataBR(v?: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const l = await getLei(params.id);
  if (!l) return { title: 'Lei não encontrada' };
  return {
    title: titulo(l),
    description: l.ementa,
    robots: { index: true, follow: true },
  };
}

export default async function LeiDetalhe({ params }: { params: { id: string } }) {
  const l = await getLei(params.id);
  if (!l) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <nav aria-label="Trilha" className="text-sm text-muted-fg">
        <Link href="/leis" className="underline">Leis</Link> <span aria-hidden>›</span> {titulo(l)}
      </nav>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-fg">{titulo(l)}</h1>
          {!l.vigente && <span className="rounded bg-muted px-2 py-1 text-sm text-muted-fg">Revogada</span>}
        </div>
        <p className="mt-3 text-lg text-fg">{l.ementa}</p>
        {l.dataSancao && <p className="mt-1 text-sm text-muted-fg">Sancionada em {dataBR(l.dataSancao)}</p>}
        <div className="mt-3 flex flex-wrap gap-4">
          {l.pdfUrl && (
            <a href={l.pdfUrl} className="text-primary underline" target="_blank" rel="noopener noreferrer">
              Baixar PDF
            </a>
          )}
          {l.proposicaoId && (
            <Link href={`/projetos-lei/${l.proposicaoId}`} className="text-primary underline">
              Ver proposição de origem
            </Link>
          )}
        </div>
      </header>

      {l.texto && (
        <section aria-labelledby="texto-h" className="mt-8">
          <h2 id="texto-h" className="text-xl font-semibold text-fg">Texto da norma</h2>
          <div className="prose mt-3 max-w-none text-fg" dangerouslySetInnerHTML={{ __html: sanitizeHtml(l.texto) }} />
        </section>
      )}
    </main>
  );
}
