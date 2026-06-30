/**
 * Página pública: Processos Seletivos Simplificados (PSS).
 * Server Component — SSR com revalidação ISR. WCAG 2.1 AA (semântica,
 * contraste via tokens de tema, sem cores fixas).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { getPssEditais } from '../../lib/portal-api';
import type { PssEdital } from '../../lib/portal-types';

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Processos Seletivos Simplificados',
    description: 'Editais de Processo Seletivo Simplificado (PSS) da Câmara Municipal: vagas, inscrições e classificação.',
    robots: { index: true, follow: true },
  };
}

const STATUS_LABEL: Record<string, string> = {
  publicado: 'Publicado',
  inscricoes_abertas: 'Inscrições abertas',
  inscricoes_encerradas: 'Inscrições encerradas',
  em_avaliacao: 'Em avaliação',
  homologado: 'Homologado',
};

function dataBR(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

function EditalCard({ e }: { e: PssEdital }) {
  return (
    <Link
      href={`/pss/${e.slug ?? e.id}`}
      className="block rounded-lg border border-border bg-card p-5 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">Edital nº {e.numero}</p>
          <h2 className="mt-1 font-semibold text-card-fg">{e.titulo}</h2>
        </div>
        <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-fg">
          {STATUS_LABEL[e.status] ?? e.status}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-fg">
        <div>
          <dt className="font-medium text-fg">Inscrições de</dt>
          <dd>{dataBR(e.inscricaoInicio)}</dd>
        </div>
        <div>
          <dt className="font-medium text-fg">até</dt>
          <dd>{dataBR(e.inscricaoFim)}</dd>
        </div>
      </dl>
      {e.rankingPublicado && (
        <p className="mt-3 inline-block rounded bg-primary px-2 py-1 text-xs font-medium text-primary-fg">
          Resultado disponível
        </p>
      )}
    </Link>
  );
}

export default async function PssListaPage() {
  const editais = await getPssEditais();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-fg">Processos Seletivos Simplificados</h1>
      <p className="mt-1 text-muted-fg">
        Editais de seleção da Câmara Municipal: confira vagas, fases, prazos de inscrição e classificação.
      </p>

      <section aria-labelledby="editais-h" className="mt-8">
        <h2 id="editais-h" className="sr-only">Lista de editais</h2>
        {editais.length === 0 ? (
          <p className="text-muted-fg">Nenhum processo seletivo disponível no momento.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {editais.map((e) => (
              <li key={e.id}>
                <EditalCard e={e} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
