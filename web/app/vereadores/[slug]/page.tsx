/**
 * Página pública: Perfil do vereador (biografia, mesa, comissões, posts,
 * representações). Server Component — SSR/ISR. WCAG 2.1 AA.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getVereador } from '../../../lib/portal-api';
import { sanitizeHtml } from '../../../lib/sanitize-html';

export const revalidate = 120;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const v = await getVereador(params.slug);
  if (!v) return { title: 'Vereador não encontrado' };
  return {
    title: v.nomeParlamentar,
    description: `Perfil do vereador ${v.nomeParlamentar}${v.partido ? ` (${v.partido})` : ''}: biografia, comissões e atuação.`,
    robots: { index: true, follow: true },
  };
}

const CARGO_COMISSAO: Record<string, string> = {
  presidente: 'Presidente', vice_presidente: 'Vice-Presidente', relator: 'Relator', membro: 'Membro',
};

export default async function VereadorPerfil({ params }: { params: { slug: string } }) {
  const v = await getVereador(params.slug);
  if (!v) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <nav aria-label="Trilha" className="text-sm text-muted-fg">
        <Link href="/vereadores" className="underline">Vereadores</Link> <span aria-hidden>›</span> {v.nomeParlamentar}
      </nav>

      <header className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {v.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.fotoUrl} alt={`Foto de ${v.nomeParlamentar}`} className="h-32 w-32 rounded-xl object-cover" />
        ) : (
          <div aria-hidden className="flex h-32 w-32 items-center justify-center rounded-xl bg-primary text-primary-fg text-3xl font-bold">
            {v.nomeParlamentar.split(' ').slice(0, 2).map((p: string) => p[0]).join('')}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-fg">{v.nomeParlamentar}</h1>
          <p className="text-muted-fg">{v.nome}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {v.partido && <span className="rounded bg-muted px-2 py-1 text-muted-fg">{v.partido}</span>}
            {v.legislatura && <span className="rounded bg-muted px-2 py-1 text-muted-fg">Legislatura {v.legislatura}</span>}
            {v.status !== 'ativo' && <span className="rounded bg-muted px-2 py-1 text-muted-fg">{v.status}</span>}
          </div>
        </div>
      </header>

      {v.biografia && (
        <section aria-labelledby="bio-h" className="mt-8">
          <h2 id="bio-h" className="text-xl font-semibold text-fg">Biografia</h2>
          <div
            className="prose mt-3 max-w-none text-fg"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(v.biografia) }}
          />
        </section>
      )}

      {Array.isArray(v.comissaoCargos) && v.comissaoCargos.length > 0 && (
        <section aria-labelledby="com-h" className="mt-8">
          <h2 id="com-h" className="text-xl font-semibold text-fg">Comissões</h2>
          <ul className="mt-3 space-y-2">
            {v.comissaoCargos.map((c: any) => (
              <li key={c.id} className="rounded border border-border bg-card p-3">
                <span className="font-medium text-card-fg">
                  {c.comissao?.slug ? (
                    <Link href={`/comissoes/${c.comissao.slug}`} className="underline">{c.comissao?.nome}</Link>
                  ) : (
                    c.comissao?.nome
                  )}
                </span>
                <span className="ml-2 text-sm text-muted-fg">{CARGO_COMISSAO[c.cargo] ?? c.cargo}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {Array.isArray(v.posts) && v.posts.length > 0 && (
        <section aria-labelledby="posts-h" className="mt-8">
          <h2 id="posts-h" className="text-xl font-semibold text-fg">Atividades</h2>
          <ul className="mt-3 space-y-4">
            {v.posts.map((p: any) => (
              <li key={p.id} className="rounded border border-border bg-card p-4">
                {p.titulo && <h3 className="font-semibold text-card-fg">{p.titulo}</h3>}
                {p.conteudo && (
                  <div className="prose mt-2 max-w-none text-fg" dangerouslySetInnerHTML={{ __html: sanitizeHtml(p.conteudo) }} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
