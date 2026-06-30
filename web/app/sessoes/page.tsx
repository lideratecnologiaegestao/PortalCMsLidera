/**
 * Página pública: Sessões Plenárias (lista/calendário).
 * Server Component — SSR com revalidação ISR. WCAG 2.1 AA (semântica,
 * contraste via tokens de tema, datas legíveis).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessoes } from '../../lib/portal-api';
import type { SessaoResumo } from '../../lib/portal-types';

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Sessões Plenárias',
    description: 'Agenda, pauta e atas das sessões plenárias da Câmara Municipal.',
    robots: { index: true, follow: true },
  };
}

const STATUS_LABEL: Record<string, string> = {
  agendada: 'Agendada',
  em_andamento: 'Em andamento',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
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

function SessaoCard({ s }: { s: SessaoResumo }) {
  return (
    <Link
      href={`/sessoes/${s.id}`}
      className="block rounded-lg border border-border bg-card p-4 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <div className="flex flex-wrap items-center gap-2">
        {s.tipoSessao && (
          <span className="rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-fg">{s.tipoSessao.nome}</span>
        )}
        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-fg">{STATUS_LABEL[s.status] ?? s.status}</span>
        {s.ataPublicadaEm && (
          <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-fg">Ata publicada</span>
        )}
      </div>
      <h3 className="mt-2 font-semibold text-card-fg">{s.titulo}</h3>
      <p className="mt-1 text-sm text-muted-fg">
        <time dateTime={s.dataHora}>{formatarData(s.dataHora)}</time>
        {s.local && <span> · {s.local}</span>}
      </p>
    </Link>
  );
}

export default async function SessoesPage() {
  const sessoes = await getSessoes();
  const agora = Date.now();
  const proximas = sessoes.filter((s) => new Date(s.dataHora).getTime() >= agora && s.status !== 'encerrada' && s.status !== 'cancelada');
  const anteriores = sessoes.filter((s) => !proximas.includes(s));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-fg">Sessões Plenárias</h1>
      <p className="mt-1 text-muted-fg">Agenda, pauta e atas das sessões da Câmara Municipal.</p>

      <p className="mt-4">
        <Link href="/tv-camara" className="text-primary underline">Assistir à TV Câmara →</Link>
      </p>

      <section aria-labelledby="prox-h" className="mt-8">
        <h2 id="prox-h" className="text-xl font-semibold text-fg">Próximas sessões</h2>
        {proximas.length === 0 ? (
          <p className="mt-3 text-muted-fg">Nenhuma sessão agendada no momento.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {proximas.map((s) => (
              <li key={s.id}><SessaoCard s={s} /></li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ant-h" className="mt-10">
        <h2 id="ant-h" className="text-xl font-semibold text-fg">Sessões anteriores</h2>
        {anteriores.length === 0 ? (
          <p className="mt-3 text-muted-fg">Nenhuma sessão registrada.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {anteriores.map((s) => (
              <li key={s.id}><SessaoCard s={s} /></li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
