/**
 * Unit tests para LegislativoIndexadorService (Fase 5 — IA Legislativa).
 * Verifica: degradação sem chave, indexação de leis/proposições/atas,
 * filtro de fontes no status, e isolamento RLS por tenant (tenant_id como
 * parâmetro do INSERT e fonte legislativa correta).
 */
import { LegislativoIndexadorService } from './legislativo-indexador.service';

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';

jest.mock('../../../common/tenant/tenant.context', () => ({
  TenantContext: {
    tenantId: jest.fn(() => TENANT_A),
    get: () => ({ userId: 'user-1', tenantId: TENANT_A }),
    run: jest.fn((_ctx: unknown, fn: () => unknown) => fn()),
  },
}));

const buildEmbeddings = (
  configurado = true,
  vecs: number[][] | null = Array.from({ length: 64 }, (_, i) => [i / 100]),
) => ({
  configurado: true,
  modelo: 'voyage-3',
  configuradoParaTenant: jest.fn().mockResolvedValue(configurado),
  infoParaTenant: jest.fn().mockResolvedValue({
    configurado,
    provider: configurado ? 'voyage' : 'none',
    modelo: configurado ? 'voyage-3' : '',
  }),
  embed: jest.fn().mockResolvedValue(vecs),
});

const buildTenantIaConfig = (maxChunks = 2000) => ({
  maxChunks: jest.fn().mockResolvedValue(maxChunks),
});

const buildPrismaDb = () => {
  const executeRawUnsafeCalls: { sql: string; params: unknown[] }[] = [];
  return {
    db: {
      $executeRaw: jest.fn().mockResolvedValue(0),
      $executeRawUnsafe: jest.fn((sql: string, ...params: unknown[]) => {
        executeRawUnsafeCalls.push({ sql, params });
        return Promise.resolve(0);
      }),
      $queryRaw: jest.fn().mockResolvedValue([]),
    },
    executeRawUnsafeCalls,
  };
};

function makeService(opts: { configurado?: boolean; maxChunks?: number } = {}) {
  const embeddings = buildEmbeddings(opts.configurado ?? true);
  const tenantIaConfig = buildTenantIaConfig(opts.maxChunks);
  const { db, executeRawUnsafeCalls } = buildPrismaDb();
  const prisma = { db } as any;
  const service = new LegislativoIndexadorService(
    prisma,
    embeddings as any,
    tenantIaConfig as any,
  );
  return { service, prisma, embeddings, tenantIaConfig, executeRawUnsafeCalls };
}

describe('LegislativoIndexadorService.reindexar()', () => {
  it('degrada (ok:false, EMBEDDINGS_NAO_CONFIGURADO) sem chave', async () => {
    const { service } = makeService({ configurado: false });
    const res = await service.reindexar(TENANT_A);
    expect(res.ok).toBe(false);
    expect(res.motivo).toBe('EMBEDDINGS_NAO_CONFIGURADO');
    expect(res.total).toBe(0);
  });

  it('fontes vazias → total 0, ok true', async () => {
    const { service } = makeService();
    const res = await service.reindexar(TENANT_A);
    expect(res.ok).toBe(true);
    expect(res.total).toBe(0);
  });

  it('indexa uma lei e grava com fonte "lei" e tenant_id parametrizado', async () => {
    const { service, prisma, executeRawUnsafeCalls } = makeService();
    let call = 0;
    (prisma.db.$queryRaw as jest.Mock).mockImplementation(() => {
      call++;
      if (call === 1) {
        // carregarLeis
        return Promise.resolve([
          {
            id: 'lei-1',
            numero: '1.234',
            tipo: 'lei_ordinaria',
            ano: 2024,
            ementa: 'Dispõe sobre o uso de praças públicas.',
            texto: 'Art. 1º ...',
            data_sancao: new Date('2024-03-10'),
            vigente: true,
            pdf_url: '/midia/documento/leis/1234.pdf',
          },
        ]);
      }
      return Promise.resolve([]); // proposições, atas
    });

    const res = await service.reindexar(TENANT_A);
    expect(res.ok).toBe(true);
    expect(res.total).toBeGreaterThan(0);
    expect(res.porFonte['lei']).toBeGreaterThan(0);

    // Isolamento: o INSERT recebe tenant_id e a fonte legislativa como parâmetros
    const insert = executeRawUnsafeCalls.find((c) => c.sql.includes('INSERT INTO ia_chunks'));
    expect(insert).toBeDefined();
    expect(insert!.params[0]).toBe(TENANT_A); // $1 tenant_id
    expect(insert!.params[1]).toBe('lei'); // $2 fonte
  });

  it('respeita o teto de chunks do tenant', async () => {
    const { service, prisma } = makeService({ maxChunks: 1 });
    // Lei longa → gera vários chunks, mas o teto corta em 1
    (prisma.db.$queryRaw as jest.Mock).mockImplementation((..._args: unknown[]) =>
      Promise.resolve([
        {
          id: 'lei-1',
          numero: '1',
          tipo: 'lei_ordinaria',
          ano: 2024,
          ementa: 'x'.repeat(2000),
          texto: 'y'.repeat(2000),
          data_sancao: null,
          vigente: true,
          pdf_url: null,
        },
      ]),
    );
    const res = await service.reindexar(TENANT_A);
    expect(res.total).toBeLessThanOrEqual(1);
    expect(res.motivo).toContain('LIMITE_1');
  });
});

describe('LegislativoIndexadorService.status()', () => {
  it('configurado:false sem embeddings', async () => {
    const { service } = makeService({ configurado: false });
    const status = await service.status(TENANT_A);
    expect(status.configurado).toBe(false);
    expect(status.provider).toBe('none');
  });

  it('agrega contagem apenas das fontes legislativas', async () => {
    const { service, prisma } = makeService();
    (prisma.db.$queryRaw as jest.Mock).mockResolvedValue([
      { fonte: 'lei', chunks: BigInt(4), ultima: new Date() },
      { fonte: 'proposicao', chunks: BigInt(2), ultima: new Date() },
      { fonte: 'sessao_ata', chunks: BigInt(1), ultima: null },
    ]);
    const status = await service.status(TENANT_A);
    expect(status.total).toBe(7);
    expect(status.porFonte.map((p) => p.fonte).sort()).toEqual([
      'lei',
      'proposicao',
      'sessao_ata',
    ]);
  });
});

describe('LegislativoIndexadorService.indexarLei() incremental', () => {
  it('item inelegível → remove chunks (DELETE) sem inserir', async () => {
    const { service, prisma, executeRawUnsafeCalls } = makeService();
    (prisma.db.$queryRaw as jest.Mock).mockResolvedValue([]); // lei não encontrada/despublicada
    await service.indexarLei(TENANT_A, 'lei-x');
    expect(prisma.db.$executeRaw).toHaveBeenCalled(); // DELETE de limpeza
    expect(executeRawUnsafeCalls.length).toBe(0); // nenhum INSERT
  });

  it('no-op silencioso sem embeddings configurados', async () => {
    const { service, prisma } = makeService({ configurado: false });
    await service.indexarLei(TENANT_A, 'lei-x');
    expect(prisma.db.$queryRaw).not.toHaveBeenCalled();
  });
});
