/**
 * Página pública: Vereadores e Mesa Diretora.
 * Server Component — SSR com revalidação ISR. WCAG 2.1 AA (semântica,
 * contraste via tokens de tema, alt em imagens).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { getVereadores, getMesaDiretora } from '../../lib/portal-api';
import type { Vereador, MesaCargo } from '../../lib/portal-types';

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Vereadores',
    description: 'Conheça os vereadores da Câmara Municipal, a Mesa Diretora e as comissões.',
    robots: { index: true, follow: true },
  };
}

const CARGO_LABEL: Record<string, string> = {
  presidente: 'Presidente',
  vice_presidente: 'Vice-Presidente',
  primeiro_secretario: '1º Secretário',
  segundo_secretario: '2º Secretário',
  corregedor: 'Corregedor',
  outro: 'Membro',
};

function Foto({ url, nome }: { url?: string | null; nome: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={`Foto de ${nome}`} className="h-20 w-20 rounded-full object-cover" />;
  }
  const iniciais = nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return (
    <div aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg text-xl font-bold">
      {iniciais}
    </div>
  );
}

function VereadorCard({ v }: { v: Vereador }) {
  const inner = (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition hover:shadow-md">
      <Foto url={v.fotoUrl} nome={v.nomeParlamentar} />
      <div className="min-w-0">
        <p className="truncate font-semibold text-card-fg">{v.nomeParlamentar}</p>
        {v.partido && <p className="text-sm text-muted-fg">{v.partido}</p>}
        {v.status !== 'ativo' && (
          <span className="mt-1 inline-block rounded bg-muted px-2 py-0.5 text-xs text-muted-fg">{v.status}</span>
        )}
      </div>
    </div>
  );
  return v.slug ? (
    <Link href={`/vereadores/${v.slug}`} className="block focus:outline-none focus:ring-2 focus:ring-primary">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default async function VereadoresPage() {
  const [vereadores, mesa] = await Promise.all([getVereadores(), getMesaDiretora()]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-fg">Vereadores</h1>
      <p className="mt-1 text-muted-fg">Composição da Câmara Municipal.</p>

      {mesa.length > 0 && (
        <section aria-labelledby="mesa-h" className="mt-8">
          <h2 id="mesa-h" className="text-xl font-semibold text-fg">Mesa Diretora</h2>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mesa.map((m: MesaCargo, i) => (
              <li key={`${m.cargo}-${i}`} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium text-primary">{CARGO_LABEL[m.cargo] ?? m.cargo}</p>
                <div className="mt-2 flex items-center gap-3">
                  <Foto url={m.vereador.fotoUrl} nome={m.vereador.nomeParlamentar} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-card-fg">{m.vereador.nomeParlamentar}</p>
                    {m.vereador.partido && <p className="text-sm text-muted-fg">{m.vereador.partido}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="ver-h" className="mt-10">
        <h2 id="ver-h" className="text-xl font-semibold text-fg">Todos os vereadores</h2>
        {vereadores.length === 0 ? (
          <p className="mt-4 text-muted-fg">Nenhum vereador cadastrado no momento.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vereadores.map((v) => (
              <li key={v.id}>
                <VereadorCard v={v} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10">
        <Link href="/comissoes" className="text-primary underline">Ver comissões da Câmara →</Link>
      </p>
    </main>
  );
}
