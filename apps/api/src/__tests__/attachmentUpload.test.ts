import test from 'node:test';
import assert from 'node:assert/strict';
import { AttachmentController } from '../controllers/attachmentController';
import { Request, Response } from 'express';

test('US09.5 & US09.8 — API de Upload de Anexos (Google Cloud Storage URL Assinada)', async t => {
  function createMockResponse() {
    let statusCode = 200;
    let responseBody: any = null;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: any) {
        responseBody = body;
        return this;
      },
      getStatusCode: () => statusCode,
      getBody: () => responseBody,
    };

    return res as unknown as Response & { getStatusCode: () => number; getBody: () => any };
  }

  const mockUser = {
    uid: 'usr-auth-test-123',
    email: 'motorista@autogest.app',
  };

  await t.test('deve rejeitar requisição sem usuário autenticado (401)', async () => {
    const req = {
      body: {
        nomeArquivo: 'nota_fiscal.jpg',
        tipoMime: 'image/jpeg',
        tamanhoBytes: 500000,
      },
    } as unknown as Request;

    const res = createMockResponse();
    await AttachmentController.getUploadUrl(req, res);

    assert.equal(res.getStatusCode(), 401);
    assert.match(res.getBody().error, /Não autorizado/i);
  });

  await t.test(
    'deve rejeitar arquivo que excede o limite máximo de 1 MB (1.048.576 bytes)',
    async () => {
      const req = {
        firebaseUser: mockUser,
        body: {
          nomeArquivo: 'comprovante_pesado.jpg',
          tipoMime: 'image/jpeg',
          tamanhoBytes: 1048577, // 1 byte acima de 1 MB
        },
      } as unknown as Request;

      const res = createMockResponse();
      await AttachmentController.getUploadUrl(req, res);

      assert.equal(res.getStatusCode(), 400);
      assert.match(res.getBody().error, /1 MB/i);
    },
  );

  await t.test('deve rejeitar tipo de arquivo (MIME) não permitido', async () => {
    const req = {
      firebaseUser: mockUser,
      body: {
        nomeArquivo: 'malicioso.exe',
        tipoMime: 'application/x-msdownload',
        tamanhoBytes: 150000,
      },
    } as unknown as Request;

    const res = createMockResponse();
    await AttachmentController.getUploadUrl(req, res);

    assert.equal(res.getStatusCode(), 400);
    assert.match(res.getBody().error, /tipo de arquivo não permitido/i);
  });

  await t.test('deve rejeitar requisição com campos obrigatórios ausentes', async () => {
    const req = {
      firebaseUser: mockUser,
      body: {
        nomeArquivo: 'sem_tamanho.jpg',
        tipoMime: 'image/jpeg',
      },
    } as unknown as Request;

    const res = createMockResponse();
    await AttachmentController.getUploadUrl(req, res);

    assert.equal(res.getStatusCode(), 400);
    assert.match(res.getBody().error, /obrigatório/i);
  });

  await t.test(
    'deve gerar URL assinada e caminho no GCS por usuário para anexo válido <= 1 MB',
    async () => {
      const req = {
        firebaseUser: mockUser,
        body: {
          nomeArquivo: 'nota_fiscal_oleo.jpg',
          tipoMime: 'image/jpeg',
          tamanhoBytes: 850000, // ~830 KB (< 1 MB)
          manutencaoId: 'manut-123-abc',
        },
      } as unknown as Request;

      const res = createMockResponse();
      await AttachmentController.getUploadUrl(req, res);

      assert.equal(res.getStatusCode(), 200);
      const body = res.getBody();
      assert.ok(body.uploadUrl, 'uploadUrl deve estar presente');
      assert.ok(body.publicUrl, 'publicUrl deve estar presente');
      assert.ok(body.gcsPath, 'gcsPath deve estar presente');
      assert.match(body.gcsPath, /users\/usr-auth-test-123\/manutencoes/);
      assert.ok(body.expiresIn > 0, 'tempo de expiração deve ser positivo');
    },
  );
});
