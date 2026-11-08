import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { typography, spacing, radius } from '../theme/tokens';
import { Icon } from './Icon';
import { DemoSeedService, DemoSeedSummary, DemoSeedProgress } from '../services/demoSeedService';
import { DemoDataPackage } from '../services/demoSeedGenerator';
import { EnvConfig } from '../config/env';

export const DemoSection: React.FC = () => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<DemoSeedProgress | null>(null);
  const [summary, setSummary] = useState<DemoSeedSummary | null>(null);
  const [packageData, setPackageData] = useState<DemoDataPackage | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'carregar' | 'remover' | 'recarregar' | null>(
    null,
  );

  // Visível estritamente em builds de demonstração ou debug
  const isDemoAllowed = EnvConfig.isDemoBuild();
  if (!isDemoAllowed) {
    return null;
  }

  const handleConfirm = async () => {
    const action = confirmAction;
    setConfirmModalVisible(false);
    if (!action) return;

    try {
      setLoading(true);
      setProgress({ step: 'Iniciando...', current: 0, total: 15 });

      if (action === 'carregar') {
        const result = await DemoSeedService.carregarDadosDemo(new Date(), 'demo_user', p => {
          setProgress(p);
        });
        setSummary(result.summary);
        setPackageData(result.packageData);
        Alert.alert(
          'Demonstração Carregada',
          `Dados carregados com sucesso:\n• ${result.summary.veiculos} veículos\n• ${result.summary.abastecimentos} abastecimentos\n• ${result.summary.despesas} despesas\n• ${result.summary.manutencoes} manutenções\n• 1 viagem e orçamento configurados.`,
        );
      } else if (action === 'remover') {
        const result = await DemoSeedService.removerDadosDemo(p => {
          setProgress(p);
        });
        setSummary(null);
        setPackageData(null);
        const totalRemovidos = Object.values(result.deletedCounts).reduce((a, b) => a + b, 0);
        Alert.alert(
          'Dados Removidos',
          `Dados de demonstração removidos com sucesso (${totalRemovidos} registros limpos). Seus dados manuais foram preservados.`,
        );
      } else if (action === 'recarregar') {
        const result = await DemoSeedService.recarregarDadosDemo(new Date(), 'demo_user', p => {
          setProgress(p);
        });
        setSummary(result.summary);
        setPackageData(result.packageData);
        Alert.alert(
          'Demonstração Recarregada',
          `Histórico atualizado com datas relativas ao momento presente.\n• ${result.summary.abastecimentos} abastecimentos\n• ${result.summary.despesas} despesas`,
        );
      }
    } catch (err: any) {
      Alert.alert('Erro na Operação de Demo', err?.message || 'Ocorreu uma falha ao processar dados de demonstração.');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const openConfirmation = (action: 'carregar' | 'remover' | 'recarregar') => {
    setConfirmAction(action);
    setConfirmModalVisible(true);
  };

  const scen = packageData?.scenarioValues;

  return (
    <View style={styles.container}>
      <Text
        style={[
          typography.eyebrow,
          { color: colors.lime, marginTop: spacing.md, marginBottom: spacing.xs },
        ]}
      >
        DEMONSTRAÇÃO (BUILD DE APRESENTAÇÃO)
      </Text>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
          Carregue ~5 meses de histórico completo e determinístico para demonstrar as Entregas 1 e 2 sem digitar dados manualmente.
        </Text>

        {loading ? (
          <View style={styles.progressContainer}>
            <ActivityIndicator size="small" color={colors.lime} />
            <Text style={[typography.caption, { color: colors.textPrimary, marginTop: spacing.xs }]}>
              {progress?.step || 'Processando...'} ({progress?.current || 0}/{progress?.total || 15})
            </Text>
          </View>
        ) : (
          <View style={styles.buttonRow}>
            {/* 1 Botão primário (verde de destaque para ação principal) */}
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.lime, backgroundColor: colors.lime }]}
              onPress={() => openConfirmation('carregar')}
              activeOpacity={0.8}
              accessibilityLabel="Carregar dados de demonstração"
            >
              <Icon name="UploadCloud" size={15} color={colors.black} />
              <Text style={[styles.btnText, { color: colors.black, fontWeight: '700' }]}>Carregar</Text>
            </TouchableOpacity>

            {/* 2 Botões secundários no mesmo estilo e tom neutro */}
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => openConfirmation('recarregar')}
              activeOpacity={0.7}
              accessibilityLabel="Recarregar dados de demonstração"
            >
              <Icon name="RefreshCw" size={15} color={colors.textSecondary} />
              <Text style={[styles.btnText, { color: colors.textPrimary }]}>Recarregar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => openConfirmation('remover')}
              activeOpacity={0.7}
              accessibilityLabel="Remover dados de demonstração"
            >
              <Icon name="Trash2" size={15} color={colors.textSecondary} />
              <Text style={[styles.btnText, { color: colors.textPrimary }]}>Remover</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Resumo de Dados Carregados */}
        {summary && (
          <View style={[styles.summaryBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[typography.caption, { color: colors.lime, fontWeight: '700', marginBottom: 4 }]}>
              RESUMO DA BASE DEMO ATIVA:
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              • {summary.veiculos} veículos (A: Ativo, B: Alternativo)
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              • {summary.abastecimentos} abastecimentos (3 últimos com exatos 12,0 km/l)
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              • {summary.despesas} despesas ({summary.custosFixos} custos fixos)
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              • Orçamento: R$ 820,00 gastos no mês (82% de R$ 1.000,00)
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              • Viagem concluída: R$ 350,00 (500 km • R$ 0,70/km • 12,5 km/l)
            </Text>
          </View>
        )}
      </View>

      {/* Painel do Roteiro ao Vivo */}
      {scen && (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.lime, marginTop: spacing.sm },
          ]}
        >
          <View style={styles.roteiroHeader}>
            <Icon name="PlayCircle" size={18} color={colors.lime} />
            <Text style={[typography.eyebrow, { color: colors.lime, marginLeft: 6 }]}>
              ROTEIRO AO VIVO (VALORES PARA DEMONSTRAÇÃO)
            </Text>
          </View>

          <View style={styles.scenarioItem}>
            <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '700' }]}>
              1. Anomalia de Consumo (Alerta Automático):
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              • Cadastre novo abastecimento: Odômetro <Text style={{ color: colors.lime }}>{scen.anomalyOdometer} km</Text> (+360 km sobre {scen.lastOdometerA} km) com <Text style={{ color: colors.lime }}>{scen.anomalyLiters} L</Text>.
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              • Resultado esperado: <Text style={{ color: colors.error }}>{scen.anomalyExpectedKml.toFixed(1)} km/l</Text> (queda de 25% sobre a média 12,0 km/l) disparando o alerta de anomalia.
            </Text>
          </View>

          <View style={styles.scenarioItem}>
            <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '700' }]}>
              2. Teto Orçamentário Mensal (Alerta e Crítico):
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              • Teto atual: R$ {scen.budgetTetoReais.toFixed(2)} | Gasto atual: R$ {scen.budgetSpentCurrentMonthReais.toFixed(2)} (82% - Nível Aviso).
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              • Adicione despesa de <Text style={{ color: colors.lime }}>R$ {scen.budgetDeltaWarningReais.toFixed(2)}</Text> → atinge 84% (mantém aviso).
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              • Adicione despesa de <Text style={{ color: colors.lime }}>R$ {scen.budgetDeltaCriticalReais.toFixed(2)}</Text> → atinge 104% (dispara nível Crítico).
            </Text>
          </View>

          <View style={styles.scenarioItem}>
            <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '700' }]}>
              3. Alternância de Unidade de Consumo:
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              • Em Preferências, mude para L/100 km: o consumo de {scen.unitDemoKml.toFixed(1)} km/l é exibido como <Text style={{ color: colors.lime }}>{scen.unitDemoL100.toFixed(1)} L/100 km</Text>.
            </Text>
          </View>

          <View style={styles.scenarioItem}>
            <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '700' }]}>
              4. Backup e Exportação de Relatórios:
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              • Gere o backup .agbak ou exporte os relatórios em PDF e CSV com a base populada.
            </Text>
          </View>
        </View>
      )}

      {/* Modal de Confirmação */}
      <Modal visible={confirmModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              {confirmAction === 'carregar' && 'Carregar Demonstração?'}
              {confirmAction === 'remover' && 'Remover Demonstração?'}
              {confirmAction === 'recarregar' && 'Recarregar Demonstração?'}
            </Text>

            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              {confirmAction === 'carregar' &&
                'Esta ação irá inserir ~5 meses de histórico fictício coerente para apresentação. Seus dados manuais existentes não serão excluídos.'}
              {confirmAction === 'remover' &&
                'Esta ação irá realizar a exclusão lógica apenas dos registros gerados pela demonstração. Quaisquer veículos ou despesas criados por você serão preservados.'}
              {confirmAction === 'recarregar' &&
                'Esta ação irá limpar os registros de demonstração anteriores e reinseri-los com datas atualizadas relativas a hoje.'}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.border }]}
                onPress={() => setConfirmModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  {
                    backgroundColor: confirmAction === 'remover' ? colors.error : colors.lime,
                    borderColor: confirmAction === 'remover' ? colors.error : colors.lime,
                  },
                ]}
                onPress={handleConfirm}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    color: confirmAction === 'remover' ? '#FFFFFF' : '#000000',
                    fontWeight: '700',
                  }}
                >
                  Confirmar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: radius.m,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  progressContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.s,
    borderWidth: 1,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.s,
    borderWidth: 1,
    gap: 2,
  },
  roteiroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  scenarioItem: {
    marginTop: spacing.xs,
    paddingVertical: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.l,
    borderWidth: 1,
    padding: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.s,
    borderWidth: 1,
  },
});
