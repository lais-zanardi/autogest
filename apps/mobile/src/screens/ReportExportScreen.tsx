import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { colors, spacing, radius, typography } from '../theme';
import {
  ReportExportService,
  ReportType,
  ReportFormat,
  PeriodOption,
} from '../services/reportExportService';
import { NetworkMonitor } from '../services/sync/SyncService';

interface ReportExportScreenProps {
  onClose: () => void;
}

export const ReportExportScreen: React.FC<ReportExportScreenProps> = ({ onClose }) => {
  const { selectedVehicle } = useAppStore();

  const [reportType, setReportType] = useState<ReportType>('gastos');
  const [periodOption, setPeriodOption] = useState<PeriodOption>('mes_atual');
  const [format, setFormat] = useState<ReportFormat>('pdf');

  const [customDe, setCustomDe] = useState('');
  const [customAte, setCustomAte] = useState('');

  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    checkReadiness();
    // Monitora reconexão
    const unsubscribe = NetworkMonitor.onReconnect(() => {
      setIsOnline(true);
      checkReadiness();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const checkReadiness = async () => {
    const pendencias = await ReportExportService.contarPendenciasSync();
    setPendingCount(pendencias);
  };

  const getActivePeriod = () => {
    if (periodOption === 'personalizado') {
      return {
        de: customDe || '2026-01-01',
        ate: customAte || new Date().toISOString().split('T')[0],
      };
    }
    return ReportExportService.calcularPeriodo(periodOption);
  };

  const handleExport = async () => {
    if (!selectedVehicle?.id) {
      Alert.alert('Aviso', 'Nenhum veículo selecionado para exportação.');
      return;
    }

    const { podeExportar, mensagemBloqueio } =
      await ReportExportService.verificarProntidaoExportacao(isOnline);

    if (!podeExportar) {
      Alert.alert('Exportação Indisponível', mensagemBloqueio || 'Sem conexão com a internet.');
      return;
    }

    setIsExporting(true);
    setStatusMessage('Sincronizando dados antes de gerar o relatório...');

    try {
      // US19.6: Sincroniza e avisa se houver pendências
      const syncResult = await ReportExportService.sincronizarAntesDeExportar();
      if (syncResult.avisoPendencias) {
        Alert.alert('Aviso de Sincronização', syncResult.avisoPendencias);
      }

      setStatusMessage(`Gerando e baixando ${format.toUpperCase()}...`);

      const activePeriod = getActivePeriod();

      // US19.7: Baixa e abre compartilhamento nativo do Android
      const exportResult = await ReportExportService.baixarECompartilharRelatorio({
        vehicleId: selectedVehicle.id,
        vehiclePlate: selectedVehicle.plate,
        tipo: reportType,
        formato: format,
        de: activePeriod.de,
        ate: activePeriod.ate,
      });

      if (!exportResult.success) {
        Alert.alert('Falha na Exportação', exportResult.error || 'Não foi possível baixar o relatório.');
      } else {
        setStatusMessage(null);
      }
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao processar exportação.');
    } finally {
      setIsExporting(false);
      setStatusMessage(null);
    }
  };

  const activePeriodPreview = getActivePeriod();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Exportar Relatórios</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Veículo Selecionado */}
        <View style={styles.vehicleCard}>
          <Text style={styles.vehicleLabel}>Veículo Selecionado</Text>
          <Text style={styles.vehicleName}>
            {selectedVehicle ? `${selectedVehicle.model} (${selectedVehicle.plate})` : 'Nenhum'}
          </Text>
        </View>

        {/* Aviso de Conexão e Pendências (US19.6) */}
        {!isOnline && (
          <View style={styles.offlineWarningBox}>
            <Text style={styles.offlineWarningTitle}>⚠️ Modo Offline</Text>
            <Text style={styles.offlineWarningText}>
              A exportação requer conexão com a internet para gerar os relatórios consolidados em PDF e CSV no PostgreSQL.
            </Text>
          </View>
        )}

        {isOnline && pendingCount > 0 && (
          <View style={styles.syncNoticeBox}>
            <Text style={styles.syncNoticeText}>
              🔄 Existem {pendingCount} alterações locais que serão sincronizadas antes de emitir o relatório.
            </Text>
          </View>
        )}

        {/* 1. Tipo de Relatório */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1. Tipo de Relatório</Text>
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                reportType === 'gastos' && styles.optionButtonSelected,
              ]}
              onPress={() => setReportType('gastos')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  reportType === 'gastos' && styles.optionButtonTextSelected,
                ]}
              >
                🧾 Extrato de Gastos
              </Text>
              <Text style={styles.optionSub}>Despesas, abastecimentos e manutenções</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionButton,
                reportType === 'manutencoes' && styles.optionButtonSelected,
              ]}
              onPress={() => setReportType('manutencoes')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  reportType === 'manutencoes' && styles.optionButtonTextSelected,
                ]}
              >
                🛠️ Histórico de Manutenções
              </Text>
              <Text style={styles.optionSub}>Revisões, serviços, peças e oficinas</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Período */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>2. Período</Text>
          <View style={styles.periodTabs}>
            <TouchableOpacity
              style={[styles.periodTab, periodOption === 'mes_atual' && styles.periodTabSelected]}
              onPress={() => setPeriodOption('mes_atual')}
            >
              <Text
                style={[styles.periodTabText, periodOption === 'mes_atual' && styles.periodTabTextSelected]}
              >
                Mês Atual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.periodTab, periodOption === 'mes_anterior' && styles.periodTabSelected]}
              onPress={() => setPeriodOption('mes_anterior')}
            >
              <Text
                style={[styles.periodTabText, periodOption === 'mes_anterior' && styles.periodTabTextSelected]}
              >
                Mês Anterior
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.periodTab, periodOption === 'personalizado' && styles.periodTabSelected]}
              onPress={() => setPeriodOption('personalizado')}
            >
              <Text
                style={[styles.periodTabText, periodOption === 'personalizado' && styles.periodTabTextSelected]}
              >
                Personalizado
              </Text>
            </TouchableOpacity>
          </View>

          {periodOption === 'personalizado' ? (
            <View style={styles.customDateContainer}>
              <View style={styles.dateCol}>
                <Text style={styles.dateLabel}>Data Inicial (AAAA-MM-DD)</Text>
                <TextInput
                  style={styles.dateInput}
                  value={customDe}
                  onChangeText={setCustomDe}
                  placeholder="2026-01-01"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={styles.dateCol}>
                <Text style={styles.dateLabel}>Data Final (AAAA-MM-DD)</Text>
                <TextInput
                  style={styles.dateInput}
                  value={customAte}
                  onChangeText={setCustomAte}
                  placeholder="2026-05-31"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
          ) : (
            <View style={styles.periodPreviewBox}>
              <Text style={styles.periodPreviewText}>
                Intervalo: {activePeriodPreview.de} até {activePeriodPreview.ate}
              </Text>
            </View>
          )}
        </View>

        {/* 3. Formato */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>3. Formato de Exportação</Text>
          <View style={styles.formatRow}>
            <TouchableOpacity
              style={[styles.formatButton, format === 'pdf' && styles.formatButtonSelected]}
              onPress={() => setFormat('pdf')}
              activeOpacity={0.8}
            >
              <Text style={[styles.formatButtonText, format === 'pdf' && styles.formatButtonTextSelected]}>
                📄 PDF
              </Text>
              <Text style={styles.formatDesc}>Formatado para leitura, envio e impressão</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.formatButton, format === 'csv' && styles.formatButtonSelected]}
              onPress={() => setFormat('csv')}
              activeOpacity={0.8}
            >
              <Text style={[styles.formatButtonText, format === 'csv' && styles.formatButtonTextSelected]}>
                📊 CSV (Excel)
              </Text>
              <Text style={styles.formatDesc}>Separador ';' e vírgula decimal pt-BR</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status da Ação */}
        {statusMessage && (
          <View style={styles.statusBox}>
            <ActivityIndicator size="small" color={colors.lime} />
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        )}

        {/* Botão de Exportar */}
        <TouchableOpacity
          style={[
            styles.exportButton,
            (!isOnline || isExporting) && styles.exportButtonDisabled,
          ]}
          onPress={handleExport}
          disabled={!isOnline || isExporting}
          activeOpacity={0.8}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={colors.black} />
          ) : (
            <Text style={styles.exportButtonText}>
              {!isOnline
                ? 'Exportação Indisponível (Sem Conexão)'
                : `Gerar e Compartilhar ${format.toUpperCase()}`}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: colors.textPrimary,
    fontSize: 20,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  vehicleCard: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vehicleLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  vehicleName: {
    ...typography.body,
    fontWeight: '700',
    color: colors.lime,
  },
  offlineWarningBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.amber,
    padding: spacing.sm,
  },
  offlineWarningTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.amber,
    marginBottom: 4,
  },
  offlineWarningText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  syncNoticeBox: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  syncNoticeText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  optionsRow: {
    gap: spacing.sm,
  },
  optionButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  optionButtonSelected: {
    borderColor: colors.lime,
    backgroundColor: colors.limeDim,
  },
  optionButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  optionButtonTextSelected: {
    color: colors.lime,
  },
  optionSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  periodTabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.sm,
  },
  periodTab: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodTabSelected: {
    borderColor: colors.lime,
    backgroundColor: colors.limeDim,
  },
  periodTabText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  periodTabTextSelected: {
    color: colors.lime,
  },
  periodPreviewBox: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  periodPreviewText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  customDateContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateCol: {
    flex: 1,
  },
  dateLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
    fontSize: 11,
  },
  dateInput: {
    height: 42,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    fontSize: 14,
  },
  formatRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  formatButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  formatButtonSelected: {
    borderColor: colors.lime,
    backgroundColor: colors.limeDim,
  },
  formatButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  formatButtonTextSelected: {
    color: colors.lime,
  },
  formatDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    color: colors.lime,
  },
  exportButton: {
    height: 52,
    backgroundColor: colors.lime,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  exportButtonDisabled: {
    opacity: 0.5,
    backgroundColor: colors.surface,
  },
  exportButtonText: {
    ...typography.button,
    color: colors.black,
    fontWeight: '700',
  },
});
