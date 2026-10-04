import './migrations/001_initial_mobile_schema';
import './migrations/002_create_local_veiculos';
import { localMigrator } from './migrations/localMigrator';

export * from './DatabaseConnection';
export * from './migrations/localMigrator';

/**
 * Inicializa o banco local e executa migrações pendentes
 */
export async function initDatabase(): Promise<void> {
  try {
    await localMigrator.runMigrations();
  } catch (e) {
    console.error('Falha ao inicializar banco de dados local mobile:', e);
  }
}
