/**
 * Página pública: detalhe da proposição (projeto de lei) — ementa, texto,
 * autores, tramitação (histórico), votação nominal e emendas.
 * Server Component — SSR/ISR. WCAG 2.1 AA.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProposicao } from '../../../lib/portal-api';
import { sanitizeHtml } from '../../../lib/sanitize-html';

export const revalidate = 120;

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
  protocolada: 'Protocolada', em_comissao: 'Em comissão', pauta: 'Em pauta',
  aprovada: 'Aprovada', rejeitada: 'Rejeitada', arquivada: 'Arquivada',
  sancionada: 'Sancionada', promulgada: 'Promulgada', vetada: 'Vetada',
};
const PAPEL_LABEL: Record<string, string> = { autor: 'Autor', coautor: 'Coautor', relator: 'Relator' };
const VOTO_LABEL: Record<string, string> = {
  favoravel: 'Favorável', contrario: 'Contrário', abstencao: 'Abstenção', ausente: 'Ausente',
};

function identificacao(p: any): string {
  const t = TIPO_LABEL[p.tipo] ?? p.tipo;
  if (p.numero && p.ano) return `${t} nº ${p.numero}/${p.ano}`;
  return t;
}

function dataBR(v?: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await getProposicao(params.id);
  if (!p) return { title: 'Proposição não encontrada' };
  return {
    title: identificacao(p),
    description: p.ementa,
    robots: { index: true, follow: true },
  };
}

export default async function ProposicaoDetalhe({ params }: { params: { id: string } }) {
  const p = await getProposicao(params.id);
  if (!p) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <nav aria-label="Trilha" className="text-sm text-muted-fg">
        <Link href="/projetos-lei" className="underline">Projetos de Lei</Link> <span aria-hidden>›</span> {identificacao(p)}
      </nav>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-fg">{identificacao(p)}</h1>
          <span className="rounded bg-muted px-2 py-1 text-sm text-muted-fg">
            {STATUS_LABEL[p.statusAtual] ?? p.statusAtual}
          </span>
        </div>
        <p className="mt-3 text-lg text-fg">{p.ementa}</p>
        {p.dataProtocolo && (
          <p className="mt-1 text-sm text-muted-fg">Protocolada em {dataBR(p.dataProtocolo)}</p>
        )}
        {p.pdfUrl && (
          <p className="mt-3">
            <a href={p.pdfUrl} className="text-primary underline" target="_blank" rel="noopener noreferrer">
              Baixar PDF da proposição
            </a>
          </p>
        )}
      </header>

      {Array.isArray(p.autores) && p.autores.length > 0 && (
        <section aria-labelledby="autores-h" className="mt-8">
          <h2 id="autores-h" className="text-xl font-semibold text-fg">Autoria</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {p.autores.map((a: any) => (
              <li key={a.id} className="rounded border border-border bg-card px-3 py-1.5 text-sm">
                {a.vereador?.slug ? (
                  <Link href={`/vereadores/${a.vereador.slug}`} className="font-medium text-card-fg underline">
                    {a.vereador?.nomeParlamentar}
                  </Link>
                ) : (
                  <span className="font-medium text-card-fg">{a.vereador?.nomeParlamentar}</span>
                )}
                <span className="ml-2 text-muted-fg">{PAPEL_LABEL[a.papel] ?? a.papel}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.texto && (
        <section aria-labelledby="texto-h" className="mt-8">
          <h2 id="texto-h" className="text-xl font-semibold text-fg">Texto</h2>
          <div className="prose mt-3 max-w-none text-fg" dangerouslySetInnerHTML={{ __html: sanitizeHtml(p.texto) }} />
        </section>
      )}

      {Array.isArray(p.tramitacoes) && p.tramitacoes.length > 0 && (
        <section aria-labelledby="tram-h" className="mt-8">
          <h2 id="tram-h" className="text-xl font-semibold text-fg">Tramitação</h2>
          <ol className="mt-3 space-y-3 border-l border-border pl-4">
            {p.tramitacoes.map((t: any) => (
              <li key={t.id}>
                <p className="font-medium text-card-fg">{STATUS_LABEL[t.fase] ?? t.fase}</p>
                {t.data && <p className="text-sm text-muted-fg">{dataBR(t.data)}</p>}
                {t.despacho && <p className="mt-1 text-sm text-fg">{t.despacho}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {Array.isArray(p.votacoes) && p.votacoes.length > 0 && (
        <section aria-labelledby="vot-h" className="mt-8">
          <h2 id="vot-h" className="text-xl font-semibold text-fg">Votação nominal</h2>
          {p.votacoes.map((v: any) => (
            <article key={v.id} className="mt-4 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-card-fg">
                  Resultado: {v.resultado === 'aprovado' ? 'Aprovado' : v.resultado === 'rejeitado' ? 'Rejeitado' : 'Pendente'}
                </span>
                {v.data && <span className="text-sm text-muted-fg">{dataBR(v.data)}</span>}
              </div>
              <p className="mt-1 text-sm text-muted-fg">
                Favoráveis: {v.favoraveis} · Contrários: {v.contrarios} · Abstenções: {v.abstencoes} · Ausentes: {v.ausentes}
              </p>
              {Array.isArray(v.votos) && v.votos.length > 0 && (
                <table className="mt-3 w-full text-sm">
                  <caption className="sr-only">Votos por vereador</caption>
                  <thead>
                    <tr className="text-left text-muted-fg">
                      <th scope="col" className="py-1 pr-4 font-medium">Vereador</th>
                      <th scope="col" className="py-1 font-medium">Voto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.votos.map((voto: any) => (
                      <tr key={voto.id} className="border-t border-border">
                        <td className="py-1 pr-4 text-fg">{voto.vereador?.nomeParlamentar}</td>
                        <td className="py-1 text-fg">{VOTO_LABEL[voto.voto] ?? voto.voto}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>
          ))}
        </section>
      )}

      {Array.isArray(p.emendas) && p.emendas.length > 0 && (
        <section aria-labelledby="emendas-h" className="mt-8">
          <h2 id="emendas-h" className="text-xl font-semibold text-fg">Emendas</h2>
          <ul className="mt-3 space-y-2">
            {p.emendas.map((e: any) => (
              <li key={e.id} className="rounded border border-border bg-card p-3">
                <span className="font-medium text-card-fg">
                  Emenda{e.numero ? ` nº ${e.numero}` : ''}
                </span>
                <span className="ml-2 text-sm text-muted-fg">{e.tipo}</span>
                {e.texto && <p className="mt-1 text-sm text-fg">{e.texto}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
