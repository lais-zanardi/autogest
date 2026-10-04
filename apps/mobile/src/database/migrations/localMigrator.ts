import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MobileMigration {
  version: number;
  name: string;
  up: () => Promise<void>;
}

const MIGRATIONS_KEY = '@autogest_db:_local_migrations';

export class LocalMigrator {
  private migrations: MobileMigration[] = [];

  public registerMigration(migration: MobileMigration) {
    this.migrations.push(migration);
    this.migrations.sort((a, b) => a.version - b.version);
  }

  public async getAppliedVersions(): Promise<number[]> {
    try {
      const data = await AsyncStorage.getItem(MIGRATIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public async runMigrations(): Promise<void> {
    const applied = await this.getAppliedVersions();
    const appliedSet = new Set(applied);

    for (const migration of this.migrations) {
      if (!appliedSet.has(migration.version)) {
        console.log(`[LocalMigrator] Executando migration ${migration.version}: ${migration.name}`);
        await migration.up();
        applied.push(migration.version);
        await AsyncStorage.setItem(MIGRATIONS_KEY, JSON.stringify(applied));
        console.log(`[LocalMigrator] Migration ${migration.version} concluída com sucesso.`);
      }
    }
  }
}

export const localMigrator = new LocalMigrator();
