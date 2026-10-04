import fs from 'fs';
import path from 'path';
import { pool } from '../models/db';

export async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('🔄 Verificando migrações do banco de dados...');

    // Garante a existência da tabela de controle de migrações
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Busca migrações já executadas
    const { rows: appliedRows } = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations',
    );
    const appliedSet = new Set(appliedRows.map(r => r.name));

    // Diretório de migrações
    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log(`⚠️ Diretório de migrações não encontrado: ${migrationsDir}`);
      return;
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of migrationFiles) {
      if (!appliedSet.has(file)) {
        console.log(`⏳ Aplicando migração: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`✅ Migração ${file} aplicada com sucesso!`);
          count++;
        } catch (migrationError) {
          await client.query('ROLLBACK');
          console.error(`❌ Erro ao aplicar migração ${file}:`, migrationError);
          throw migrationError;
        }
      }
    }

    if (count === 0) {
      console.log('✨ Banco de dados atualizado. Nenhuma migração pendente.');
    } else {
      console.log(`🚀 ${count} migração(ões) aplicada(s) com sucesso.`);
    }
  } finally {
    client.release();
  }
}

// Execução direta via CLI (ex.: npm run db:migrate)
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('🏁 Processo de migração concluído.');
      process.exit(0);
    })
    .catch(err => {
      console.error('💥 Falha na execução das migrações:', err);
      process.exit(1);
    });
}
