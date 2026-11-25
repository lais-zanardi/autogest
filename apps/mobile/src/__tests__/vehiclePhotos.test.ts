import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { VehiclePhotoService, ordenarFotosCronologicamente } from '../services/vehiclePhotoService';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { DatabaseConnection } from '../database/DatabaseConnection';
import { SyncEntityRegistry } from '../services/sync/SyncEntityRegistry';

describe('US32 — Fotos do Veículo (Compressão, Ordem Cronológica, Capa e Contrato US09)', () => {
  beforeEach(async () => {
    const db = DatabaseConnection.getInstance();
    await db.saveTableData('fotos_veiculo', []);
    await db.saveTableData('local_vehicles', []);
    await db.saveTableData('fila_sync', []);
  });

  it('US32.2 & US32.5: valida limite de compressão <= 1 MB reutilizando fluxo da US09', async () => {
    const veiculo = await VehicleRepository.create({
      plate: 'FOT1A23',
      brand: 'Honda',
      model: 'Civic',
      year: 2023,
      tankCapacityL: 50,
      preferredFuel: 'Gasolina',
      initialOdometer: 10000,
    });

    // Rejeita foto > 1 MB (1.048.576 bytes)
    await assert.rejects(
      async () => {
        await VehiclePhotoService.adicionarFoto({
          veiculoId: veiculo.id,
          data: '2026-11-25',
          legenda: 'Foto muito grande',
          localPath: '/tmp/grande.jpg',
          fileSize: 2_000_000,
          mimeType: 'image/jpeg',
        });
      },
      /1 MB/,
    );

    // Aceita foto comprimida <= 1 MB
    const salva = await VehiclePhotoService.adicionarFoto({
      veiculoId: veiculo.id,
      data: '2026-11-25',
      legenda: 'Frente do carro',
      localPath: '/tmp/frente.jpg',
      fileSize: 420_000,
      mimeType: 'image/jpeg',
    });
    assert.strictEqual(salva.status_upload, 'pendente');
    assert.strictEqual(salva.tamanho_bytes, 420_000);
  });

  it('US32.4 & US32.5: exibe galeria em ordem cronológica e atualiza foto de capa do veículo', async () => {
    const veiculo = await VehicleRepository.create({
      plate: 'FOT2B34',
      brand: 'Toyota',
      model: 'Corolla',
      year: 2022,
      tankCapacityL: 50,
      preferredFuel: 'Flex',
      initialOdometer: 15000,
    });

    const f2 = await VehiclePhotoService.adicionarFoto({
      veiculoId: veiculo.id,
      data: '2026-11-20',
      legenda: 'Lateral direita',
      localPath: '/tmp/lat.jpg',
      fileSize: 300_000,
    });
    const f1 = await VehiclePhotoService.adicionarFoto({
      veiculoId: veiculo.id,
      data: '2026-09-10',
      legenda: 'Entrega na concessionária',
      localPath: '/tmp/entrega.jpg',
      fileSize: 250_000,
    });
    const f3 = await VehiclePhotoService.adicionarFoto({
      veiculoId: veiculo.id,
      data: '2026-11-25',
      legenda: 'Traseira',
      localPath: '/tmp/tras.jpg',
      fileSize: 280_000,
    });

    const galeria = await VehiclePhotoService.listarGaleriaCronologica(veiculo.id);
    assert.strictEqual(galeria.length, 3);
    assert.deepStrictEqual(
      galeria.map(f => f.id),
      [f1.id, f2.id, f3.id],
    );
    assert.deepStrictEqual(
      ordenarFotosCronologicamente([f3, f1, f2]).map(f => f.data),
      ['2026-09-10', '2026-11-20', '2026-11-25'],
    );

    // Definir foto de capa atualiza o veículo
    const veiculoAtualizado = await VehiclePhotoService.definirFotoCapa(veiculo.id, f2.id);
    assert.ok(veiculoAtualizado);
    assert.strictEqual(veiculoAtualizado.foto_capa_id, f2.id);
    assert.strictEqual(veiculoAtualizado.coverPhotoId, f2.id);
  });

  it('US32.3 & US32.5: reutiliza contrato POST /api/v1/anexos/upload-url da US09 sem nova lógica de upload', async () => {
    const veiculo = await VehicleRepository.create({
      plate: 'FOT3C45',
      brand: 'VW',
      model: 'T-Cross',
      year: 2024,
      tankCapacityL: 52,
      preferredFuel: 'Flex',
      initialOdometer: 5000,
    });

    const foto = await VehiclePhotoService.adicionarFoto({
      veiculoId: veiculo.id,
      data: '2026-11-25',
      legenda: 'Painel',
      localPath: '/storage/painel.jpg',
      fileSize: 310_000,
      mimeType: 'image/jpeg',
    });

    const calledEndpoints: Array<{ method: string; url: string; payload?: any }> = [];
    const mockHttp = {
      async post(url: string, body: any) {
        calledEndpoints.push({ method: 'POST', url, payload: body });
        return {
          data: {
            uploadUrl: 'https://storage.googleapis.com/bucket/users/u1/manutencoes/painel.jpg?sig=1',
            publicUrl: 'https://storage.googleapis.com/bucket/users/u1/manutencoes/painel.jpg',
            expiresIn: 900,
          },
        };
      },
      async put(url: string) {
        calledEndpoints.push({ method: 'PUT', url });
        return { data: {} };
      },
    };

    const enviada = await VehiclePhotoService.enviarFotoParaNuvem(foto.id, mockHttp);
    assert.ok(enviada);
    assert.strictEqual(enviada.status_upload, 'enviado');
    assert.strictEqual(
      enviada.url_gcs,
      'https://storage.googleapis.com/bucket/users/u1/manutencoes/painel.jpg',
    );
    assert.strictEqual(calledEndpoints[0].url, '/api/v1/anexos/upload-url');
    assert.strictEqual(calledEndpoints[0].payload.nomeArquivo, 'painel.jpg');
    assert.strictEqual(calledEndpoints[0].payload.tipoMime, 'image/jpeg');
    assert.strictEqual(calledEndpoints[0].payload.tamanhoBytes, 310_000);
    assert.strictEqual(calledEndpoints[1].method, 'PUT');
  });

  it('US32.1: fotos_veiculo está registrada em SyncEntityRegistry', () => {
    const entities = SyncEntityRegistry.listRegisteredEntities();
    assert.ok(entities.includes('fotos_veiculo'));
  });
});
