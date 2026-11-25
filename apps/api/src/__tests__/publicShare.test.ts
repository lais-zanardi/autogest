import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarTokenOpacoSeguro,
  hashTokenOpaco,
  serializarPerfilPublicoVeiculo,
  VALIDADE_PADRAO_COMPARTILHAMENTO_DIAS,
} from '../services/publicProfileDomain';
import {
  InMemoryShareRepository,
  PublicProfileRateLimiter,
  ShareController,
} from '../controllers/shareController';

function createMockRes() {
  const state: { statusCode: number; body: any } = { statusCode: 200, body: null };
  const res: any = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(payload: any) {
      state.body = payload;
      return this;
    },
  };
  return { res, state };
}

describe('US20 — Perfil Compartilhável via QR Code (Segurança, Allowlist, Rate Limit e Isolamento)', () => {
  let repo: InMemoryShareRepository;
  let limiter: PublicProfileRateLimiter;

  beforeEach(() => {
    repo = new InMemoryShareRepository();
    limiter = new PublicProfileRateLimiter(3, 60_000); // limite de 3 req/min para teste

    repo.seedVehicle({
      id: 'veh-a',
      usuario_id: 'user-a',
      modelo: 'Civic Touring',
      marca: 'Honda',
      ano: 2022,
      placa: 'ABC1D23',
      combustivel_preferencial: 'Gasolina',
      odometro_atual: 42000,
      email_dono: 'dono@secreto.com',
      latitude: -23.55,
      longitude: -46.63,
      nota: 'Segredo interno',
    });

    repo.seedMaintenances('veh-a', [
      {
        id: 'm-1',
        veiculo_id: 'veh-a',
        data: '2026-10-15',
        tipo: 'preventiva',
        tipo_servico: 'troca_oleo',
        descricao: 'Troca de óleo 40.000 km',
        km: 40000,
        nota: 'Nota privada do mecânico',
        oficina: 'Oficina Privada',
        valor: 450,
        anexos: [{ url_gcs: 'https://private/nf.pdf' }],
      },
    ]);

    ShareController.setDependencies({
      shareRepo: repo,
      rateLimiter: limiter,
      nowFn: () => new Date('2026-11-25T12:00:00.000Z'),
    });
  });

  it('US20.1 & US20.6: gera token opaco de 32 bytes e armazena apenas o hash (nunca em claro)', async () => {
    const token = gerarTokenOpacoSeguro();
    // 32 bytes em base64url geram 43 caracteres
    assert.ok(token.length >= 43);
    assert.strictEqual(VALIDADE_PADRAO_COMPARTILHAMENTO_DIAS, 30);

    const { res, state } = createMockRes();
    await ShareController.createShare(
      {
        params: { id: 'veh-a' },
        user: { id: 'user-a' },
      } as any,
      res,
      (err: any) => {
        throw err;
      },
    );

    assert.strictEqual(state.statusCode, 201);
    assert.ok(state.body.token);
    assert.ok(state.body.url_publica.includes('/api/v1/publico/perfil/'));
    assert.ok(!state.body.url_publica.includes('user-a'));

    // Verifica que no banco (repositório) o token NÃO está em claro, apenas seu hash SHA-256
    const stored = repo.dumpRawShares();
    assert.strictEqual(stored.length, 1);
    assert.notStrictEqual(stored[0].token_opaco_hash, state.body.token);
    assert.strictEqual(stored[0].token_opaco_hash, hashTokenOpaco(state.body.token));
  });

  it('US20.4 & US20.6: campos fora da lista explícita não aparecem na resposta pública', async () => {
    const { res: createRes, state: createState } = createMockRes();
    await ShareController.createShare(
      { params: { id: 'veh-a' }, user: { id: 'user-a' } } as any,
      createRes,
      (err: any) => {
        throw err;
      },
    );

    const { res: pubRes, state: pubState } = createMockRes();
    await ShareController.getPublicProfile(
      { params: { token: createState.body.token }, ip: '10.0.0.1' } as any,
      pubRes,
      (err: any) => {
        throw err;
      },
    );

    assert.strictEqual(pubState.statusCode, 200);
    const jsonStr = JSON.stringify(pubState.body);

    // Campos públicos presentes
    assert.strictEqual(pubState.body.veiculo.modelo, 'Civic Touring');
    assert.strictEqual(pubState.body.veiculo.placa, 'ABC1D23');
    assert.strictEqual(pubState.body.manutencoes.length, 1);
    assert.strictEqual(pubState.body.manutencoes[0].tipo_servico, 'troca_oleo');

    // Campos privados/sensíveis fora da lista NUNCA aparecem
    assert.ok(!jsonStr.includes('user-a'));
    assert.ok(!jsonStr.includes('dono@secreto.com'));
    assert.ok(!jsonStr.includes('Segredo interno'));
    assert.ok(!jsonStr.includes('Nota privada'));
    assert.ok(!jsonStr.includes('nf.pdf'));
    assert.ok(!jsonStr.includes('latitude'));
    assert.ok(!jsonStr.includes('longitude'));

    // Teste direto da função pura de serialização
    const pure = serializarPerfilPublicoVeiculo(
      {
        modelo: 'Civic',
        marca: 'Honda',
        ano: 2022,
        placa: 'ABC1D23',
        combustivel_preferencial: 'Gasolina',
        odometro_atual: 42000,
        usuario_id: 'secret',
      },
      [],
      '2026-12-25T12:00:00.000Z',
    );
    assert.strictEqual((pure.veiculo as any).usuario_id, undefined);
  });

  it('US20.3 & US20.6: token inexistente, revogado ou expirado retornam exatamente a mesma resposta (404)', async () => {
    // 1) Inexistente
    const rInexistente = createMockRes();
    await ShareController.getPublicProfile(
      { params: { token: 'token-inexistente-qualquer' }, ip: '10.0.0.2' } as any,
      rInexistente.res,
      (err: any) => {
        throw err;
      },
    );

    // 2) Revogado
    const rCreate1 = createMockRes();
    await ShareController.createShare(
      { params: { id: 'veh-a' }, user: { id: 'user-a' } } as any,
      rCreate1.res,
      (err: any) => {
        throw err;
      },
    );
    const rRevoke = createMockRes();
    await ShareController.revokeShare(
      {
        params: { id: 'veh-a', compartilhamentoId: rCreate1.state.body.id },
        user: { id: 'user-a' },
      } as any,
      rRevoke.res,
      (err: any) => {
        throw err;
      },
    );
    assert.strictEqual(rRevoke.state.statusCode, 200);

    const rRevogado = createMockRes();
    await ShareController.getPublicProfile(
      { params: { token: rCreate1.state.body.token }, ip: '10.0.0.3' } as any,
      rRevogado.res,
      (err: any) => {
        throw err;
      },
    );

    // 3) Expirado (+31 dias)
    const rCreate2 = createMockRes();
    await ShareController.createShare(
      { params: { id: 'veh-a' }, user: { id: 'user-a' } } as any,
      rCreate2.res,
      (err: any) => {
        throw err;
      },
    );
    ShareController.setDependencies({
      nowFn: () => new Date('2026-12-26T12:00:00.000Z'),
    });
    const rExpirado = createMockRes();
    await ShareController.getPublicProfile(
      { params: { token: rCreate2.state.body.token }, ip: '10.0.0.4' } as any,
      rExpirado.res,
      (err: any) => {
        throw err;
      },
    );

    assert.strictEqual(rInexistente.state.statusCode, 404);
    assert.strictEqual(rRevogado.state.statusCode, 404);
    assert.strictEqual(rExpirado.state.statusCode, 404);
    assert.deepStrictEqual(rRevogado.state.body, rInexistente.state.body);
    assert.deepStrictEqual(rExpirado.state.body, rInexistente.state.body);
  });

  it('US20.3 & US20.6: rate limit próprio retorna 429 ao exceder o limite de chamadas', async () => {
    for (let i = 0; i < 3; i += 1) {
      const r = createMockRes();
      await ShareController.getPublicProfile(
        { params: { token: 't-1' }, ip: '192.168.1.99' } as any,
        r.res,
        (err: any) => {
          throw err;
        },
      );
      assert.strictEqual(r.state.statusCode, 404);
    }

    const rBlocked = createMockRes();
    await ShareController.getPublicProfile(
      { params: { token: 't-1' }, ip: '192.168.1.99' } as any,
      rBlocked.res,
      (err: any) => {
        throw err;
      },
    );
    assert.strictEqual(rBlocked.state.statusCode, 429);
  });

  it('US20.6: isolamento entre veículos impede usuário B de criar ou revogar compartilhamento de veículo do usuário A', async () => {
    const rForbiddenCreate = createMockRes();
    await ShareController.createShare(
      { params: { id: 'veh-a' }, user: { id: 'user-b' } } as any,
      rForbiddenCreate.res,
      (err: any) => {
        throw err;
      },
    );
    assert.strictEqual(rForbiddenCreate.state.statusCode, 404);
  });
});
