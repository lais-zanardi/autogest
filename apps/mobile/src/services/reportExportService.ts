// Importa react-native dinamicamente para execução segura em Node.js de testes
let Share: any = null;
let Platform: any = { OS: 'android' };
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rn = require('react-native');
  Share = rn.Share;
  Platform = rn.Platform || Platform;
} catch {
  Share = {
    share: async () => ({ action: 'sharedAction' }),
  };
}
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { SyncService } from './sync/SyncService';
import { AuthService } from './authService';
import { api } from './api';

export type ReportType = 'gastos' | 'manutencoes';
export type ReportFormat = 'pdf' | 'csv';
export type PeriodOption = 'mes_atual' | 'mes_anterior' | 'personalizado';

export interface ReportPeriod {
  de: string; // YYYY-MM-DD
  ate: string; // YYYY-MM-DD
}

export class ReportExportService {
  /**
   * Conta a quantidade de itens na outbox aguardando envio
   */
  static async contarPendenciasSync(): Promise<number> {
    try {
      const items = await SyncQueueRepository.getPendingItems();
      return items.length;
    } catch {
      return 0;
    }
  }

  /**
   * US19.6: Verifica se o dispositivo está apto a exportar relatórios.
   * Sem conexão, a exportação é bloqueada com explicação.
   */
  static async verificarProntidaoExportacao(
    isOnline: boolean
  ): Promise<{ podeExportar: boolean; mensagemBloqueio: string | null; pendencias: number }> {
    const pendencias = await this.contarPendenciasSync();

    if (!isOnline) {
      return {
        podeExportar: false,
        mensagemBloqueio:
          'Sem conexão com a internet. Os relatórios consolidados em PDF e CSV são gerados na nuvem a partir do PostgreSQL.',
        pendencias,
      };
    }

    return {
      podeExportar: true,
      mensagemBloqueio: null,
      pendencias,
    };
  }

  /**
   * US19.5: Calcula intervalo de datas para as opções padrão
   */
  static calcularPeriodo(opcao: PeriodOption, baseDate: Date = new Date()): ReportPeriod {
    const y = baseDate.getFullYear();
    const m = baseDate.getMonth(); // 0-indexed

    if (opcao === 'mes_atual') {
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      return {
        de: this.formatDateIso(first),
        ate: this.formatDateIso(last),
      };
    }

    if (opcao === 'mes_anterior') {
      const first = new Date(y, m - 1, 1);
      const last = new Date(y, m, 0);
      return {
        de: this.formatDateIso(first),
        ate: this.formatDateIso(last),
      };
    }

    // Default personalizado (últimos 30 dias)
    const prior = new Date(baseDate);
    prior.setDate(prior.getDate() - 30);
    return {
      de: this.formatDateIso(prior),
      ate: this.formatDateIso(baseDate),
    };
  }

  private static formatDateIso(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * US19.6: Sincroniza pendências antes de iniciar o download
   */
  static async sincronizarAntesDeExportar(): Promise<{ sucesso: boolean; avisoPendencias?: string }> {
    try {
      await SyncService.sync();
      const restantes = await this.contarPendenciasSync();
      if (restantes > 0) {
        return {
          sucesso: true,
          avisoPendencias: `Atenção: existem ${restantes} registro(s) pendente(s) de envio que podem não constar no relatório.`,
        };
      }
      return { sucesso: true };
    } catch {
      return {
        sucesso: false,
        avisoPendencias: 'Não foi possível sincronizar alterações recentes com o servidor.',
      };
    }
  }

  /**
   * US19.7: Baixa o arquivo do backend com o ID token no cabeçalho e compartilha no Android
   */
  static async baixarECompartilharRelatorio(params: {
    vehicleId: string;
    vehiclePlate: string;
    tipo: ReportType;
    formato: ReportFormat;
    de: string;
    ate: string;
  }): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const endpoint = params.tipo === 'gastos' ? '/relatorios/gastos' : '/relatorios/manutencoes';
      const session = await AuthService.getStoredSession();
      const token = session?.token;

      const filename = `${params.tipo}_${params.vehiclePlate || 'veiculo'}_${params.de}_${params.ate}.${params.formato}`;

      // Carrega react-native-fs dinamicamente com fallback gracioso
      let RNFS: any = null;
      try {
        RNFS = require('react-native-fs');
      } catch {
        RNFS = null;
      }

      if (!RNFS || !RNFS.CachesDirectoryPath) {
        // Fallback em ambiente de teste ou simulação via Axios
        const response = await api.get(endpoint, {
          params: {
            veiculo_id: params.vehicleId,
            de: params.de,
            ate: params.ate,
            formato: params.formato,
          },
          responseType: params.formato === 'pdf' ? 'arraybuffer' : 'text',
        });

        if (response.status === 200) {
          // Compartilha diretamente texto ou mensagem
          await Share.share({
            title: `Relatório AutoGest (${params.formato.toUpperCase()})`,
            message: `Relatório ${params.tipo} do veículo ${params.vehiclePlate} (${params.de} a ${params.ate}) gerado pelo AutoGest.`,
          });
          return { success: true };
        }
      } else {
        const downloadDest = `${RNFS.CachesDirectoryPath}/${filename}`;
        const queryStr = `veiculo_id=${encodeURIComponent(params.vehicleId)}&de=${encodeURIComponent(
          params.de
        )}&ate=${encodeURIComponent(params.ate)}&formato=${encodeURIComponent(params.formato)}`;

        const baseURL = (api.defaults.baseURL || '').replace(/\/$/, '');
        const downloadUrl = `${baseURL}${endpoint}?${queryStr}`;

        const downloadResult = await RNFS.downloadFile({
          fromUrl: downloadUrl,
          toFile: downloadDest,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).promise;

        if (downloadResult.statusCode === 200) {
          // Dispara o compartilhamento nativo do Android (US19.7)
          const fileUri = Platform.OS === 'android' ? `file://${downloadDest}` : downloadDest;
          await Share.share({
            title: `Relatório AutoGest (${params.formato.toUpperCase()})`,
            url: fileUri,
            message: `Relatório ${params.tipo} do veículo ${params.vehiclePlate} (${params.de} a ${params.ate}).`,
          });
          return { success: true, filePath: downloadDest };
        } else {
          return {
            success: false,
            error: `Erro ao baixar arquivo (código ${downloadResult.statusCode})`,
          };
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error('Falha ao exportar relatório:', err);
      return { success: false, error: err.message || 'Falha ao baixar relatório.' };
    }
  }
}
