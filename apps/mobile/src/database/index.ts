import './migrations/001_initial_mobile_schema';
import './migrations/002_create_local_veiculos';
import './migrations/003_create_local_fueling_schema';
import './migrations/004_create_local_despesas';
import './migrations/005_create_local_manutencoes';
import './migrations/006_create_local_regras_manutencao';
import './migrations/007_create_local_custos_fixos';
import './migrations/008_create_local_dashboard_indexes';
import './migrations/009_create_local_pneus_e_fluidos';
import './migrations/010_create_local_preferencias';
import './migrations/011_create_local_auditoria';
import './migrations/012_create_local_orcamentos';
import './migrations/013_create_local_preferencias_e_notificacoes_agendadas';
import './migrations/014_create_local_etiquetas_e_contexto';
import './migrations/015_create_local_search_indexes';
import './migrations/016_create_local_viagens';
import './migrations/017_create_local_metas_eficiencia';
import './migrations/018_create_local_consultas_fipe';
import './migrations/019_create_local_agendamentos_manutencao';
import './migrations/020_create_local_precos_e_clima';
import './migrations/021_create_local_postos';
import './migrations/022_create_local_historico_e_alertas_preco';
import './migrations/023_create_local_oficinas_e_atendimentos';
import './migrations/024_create_local_locais_visitados';
import './migrations/025_create_local_simulacoes';
import './migrations/026_create_local_lembretes_inspecao';
import './migrations/027_create_local_fotos_veiculo';
import './migrations/028_create_local_perfis_conducao';
import './migrations/029_create_local_preferencias_resumo';
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
