import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { BudgetStatusSummary, Vehicle } from '@autogest/shared-types';
import {
  avaliarOrcamento,
  BudgetService,
  DEFAULT_BUDGET_WARNING_PERCENTAGE,
} from '../services/budgetService';
import { parseExpenseAmount } from '../services/expenseValidation';
import { formatCurrency } from '../utils/formatters';
import { colors, spacing, radius, typography } from '../theme';

interface BudgetModalProps {
  visible: boolean;
  vehicle: Vehicle;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * US15.2: Tela / Modal "Orçamento":
 * - Definir, editar e remover o teto mensal do veículo ativo (persistido em centavos);
 * - Barra de progresso em tempo real mostrando gasto do mês, teto e percentual;
 * - Toda alteração de teto é auditada na tabela `auditoria` (US21).
 */
export const BudgetModal: React.FC<BudgetModalProps> = ({
  visible,
  vehicle,
  onClose,
  onSuccess,
}) => {
  const [limitInputReais, setLimitInputReais] = useState('');
  const [warningPercentInput, setWarningPercentInput] = useState(
    String(DEFAULT_BUDGET_WARNING_PERCENTAGE),
  );
  const [currentStatus, setCurrentStatus] = useState<BudgetStatusSummary | null>(null);
  const [monthSpentReais, setMonthSpentReais] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadBudgetData = useCallback(async () => {
    setErrorMsg(null);
    try {
      const [status, gastoMes] = await Promise.all([
        BudgetService.obterStatusOrcamento(vehicle.id),
        BudgetService.calcularTotalGastoDoMesReais(vehicle.id),
      ]);
      setCurrentStatus(status);
      setMonthSpentReais(gastoMes);

      if (status) {
        setLimitInputReais((status.tetoMensalCentavos / 100).toFixed(2).replace('.', ','));
        setWarningPercentInput(
          String(status.budget.percentual_aviso || DEFAULT_BUDGET_WARNING_PERCENTAGE),
        );
      } else {
        setLimitInputReais('');
        setWarningPercentInput(String(DEFAULT_BUDGET_WARNING_PERCENTAGE));
      }
    } catch {
      setCurrentStatus(null);
    }
  }, [vehicle.id]);

  useEffect(() => {
    if (visible) {
      loadBudgetData();
    }
  }, [visible, loadBudgetData]);

  const parsedLimitReais = parseExpenseAmount(limitInputReais);
  const previewLimitCentavos =
    !isNaN(parsedLimitReais) && parsedLimitReais > 0 ? Math.round(parsedLimitReais * 100) : 0;
  const parsedWarn = Number(warningPercentInput) || DEFAULT_BUDGET_WARNING_PERCENTAGE;
  const previewEval = avaliarOrcamento(
    Math.round(monthSpentReais * 100),
    previewLimitCentavos,
    parsedWarn,
  );

  const handleSave = async () => {
    setErrorMsg(null);
    if (!previewLimitCentavos || previewLimitCentavos <= 0) {
      setErrorMsg('Informe um valor de teto mensal válido maior que zero.');
      return;
    }

    if (parsedWarn <= 0 || parsedWarn > 100) {
      setErrorMsg('O percentual de aviso deve estar entre 1% e 100%.');
      return;
    }

    setIsSaving(true);
    try {
      await BudgetService.salvarOrcamento({
        vehicleId: vehicle.id,
        tetoMensalCentavos: previewLimitCentavos,
        percentualAviso: parsedWarn,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar orçamento mensal.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setErrorMsg(null);
    setIsSaving(true);
    try {
      await BudgetService.removerOrcamentoDoVeiculo(vehicle.id);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao remover orçamento.');
    } finally {
      setIsSaving(false);
    }
  };

  const getPreviewColor = () => {
    if (previewEval.nivel === 'critico') return colors.error;
    if (previewEval.nivel === 'aviso') return colors.amber;
    return colors.lime;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.eyebrow}>ORÇAMENTO MENSAL</Text>
                <Text style={styles.title}>
                  {currentStatus ? 'Editar Teto Orçamentário' : 'Definir Teto Orçamentário'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                accessibilityLabel="Fechar tela de orçamento"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Prévia com Barra de Progresso (US15.2) */}
            <View style={styles.previewBox}>
              <View style={styles.previewRow}>
                <View>
                  <Text style={styles.previewLabel}>Gasto acumulado no mês</Text>
                  <Text style={styles.previewValue}>{formatCurrency(monthSpentReais)}</Text>
                </View>
                <View style={styles.previewRight}>
                  <Text style={styles.previewLabel}>Teto simulado</Text>
                  <Text style={styles.previewValue}>
                    {previewLimitCentavos > 0
                      ? formatCurrency(previewLimitCentavos / 100)
                      : 'R$ 0,00'}
                  </Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, Math.max(0, previewEval.percentual))}%`,
                      backgroundColor: getPreviewColor(),
                    },
                  ]}
                />
              </View>

              <Text style={[styles.previewStatusText, { color: getPreviewColor() }]}>
                {previewLimitCentavos > 0
                  ? `${previewEval.percentual}% atingido (${previewEval.nivel.toUpperCase()})`
                  : 'Informe o valor do teto mensal abaixo'}
              </Text>
            </View>

            <Text style={styles.inputLabel}>Teto mensal do veículo (R$)</Text>
            <TextInput
              style={styles.input}
              value={limitInputReais}
              onChangeText={setLimitInputReais}
              placeholder="Ex.: 1000,00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              accessibilityLabel="Valor do teto mensal"
            />
            {previewLimitCentavos > 0 && (
              <Text style={styles.centsHelper}>
                Valor persistido: {previewLimitCentavos} centavos
              </Text>
            )}

            <Text style={styles.inputLabel}>Percentual para alerta de aviso (%)</Text>
            <TextInput
              style={styles.input}
              value={warningPercentInput}
              onChangeText={setWarningPercentInput}
              placeholder="Padrão: 80"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              accessibilityLabel="Percentual de aviso do orçamento"
            />

            {errorMsg && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <View style={styles.actionsCol}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={isSaving}
                accessibilityLabel="Salvar teto orçamentário"
              >
                <Text style={styles.saveBtnText}>
                  {currentStatus ? 'Salvar Alterações do Teto' : 'Ativar Teto Mensal'}
                </Text>
              </TouchableOpacity>

              {currentStatus && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={handleRemove}
                  disabled={isSaving}
                  accessibilityLabel="Remover teto mensal do veículo"
                >
                  <Text style={styles.removeBtnText}>🗑️ Remover Teto Mensal</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '88%',
  },
  scrollContent: {
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  eyebrow: {
    ...typography.sectionLabel,
    color: colors.lime,
    fontSize: 11,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  previewBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  previewRight: {
    alignItems: 'flex-end',
  },
  previewLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  previewValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  progressTrack: {
    height: 10,
    backgroundColor: colors.background,
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  previewStatusText: {
    ...typography.captionBold,
    marginTop: 2,
  },
  inputLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    fontSize: 15,
  },
  centsHelper: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: spacing.xs,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.captionBold,
    color: colors.error,
  },
  actionsCol: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  saveBtn: {
    backgroundColor: colors.lime,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    ...typography.bodyBold,
    color: colors.black,
    fontWeight: '700',
  },
  removeBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  removeBtnText: {
    ...typography.captionBold,
    color: colors.error,
  },
});
