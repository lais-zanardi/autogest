import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BudgetStatusSummary, Vehicle } from '@autogest/shared-types';
import { BudgetService } from '../services/budgetService';
import { formatCurrency, formatMonth } from '../utils/formatters';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from './Icon';
import { theme as tokens } from '../theme/tokens';

interface BudgetCardProps {
  vehicle: Vehicle;
  onConfigurePress: () => void;
  refreshTrigger?: number;
}

/**
 * US15.4 & US15.6: Cartão de Orçamento Mensal no Dashboard com barra de progresso
 * (gasto do mês, teto mensal e percentual atingido) e banner quando em aviso/crítico.
 */
export const BudgetCard: React.FC<BudgetCardProps> = ({
  vehicle,
  onConfigurePress,
  refreshTrigger = 0,
}) => {
  const [status, setStatus] = useState<BudgetStatusSummary | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const result = await BudgetService.obterStatusOrcamento(vehicle.id);
      setStatus(result);
    } catch {
      setStatus(null);
    }
  }, [vehicle.id]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus, refreshTrigger]);

  const getLevelColor = () => {
    if (!status) return colors.lime;
    if (status.nivel === 'critico') return colors.error;
    if (status.nivel === 'aviso') return colors.amber;
    return colors.lime;
  };

  const progressWidthPercent = status ? Math.min(100, Math.max(0, status.percentual)) : 0;

  return (
    <View style={styles.card} accessibilityLabel="cartao-orcamento-dashboard">
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={styles.eyebrow}>CONTROLE ORÇAMENTÁRIO</Text>
          <Text style={styles.title}>Teto Mensal do Veículo</Text>
        </View>
        <TouchableOpacity
          style={styles.configBtn}
          onPress={onConfigurePress}
          activeOpacity={0.8}
          accessibilityLabel="Configurar teto mensal do veículo"
        >
          {status && <Icon name="Pencil" size={13} color={colors.lime} style={{ marginRight: 4 }} />}
          <Text style={styles.configBtnText}>{status ? 'Editar Teto' : '+ Definir Teto'}</Text>
        </TouchableOpacity>
      </View>

      {!status ? (
        <TouchableOpacity
          style={styles.emptyStateBox}
          onPress={onConfigurePress}
          activeOpacity={0.8}
        >
          <Text style={styles.emptyStateTitle}>Nenhum teto mensal definido</Text>
          <Text style={styles.emptyStateSub}>
            Defina um limite mensal de gastos para receber alertas em 80% e 100% do orçamento.
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          {/* Valores Gasto x Teto e Percentual */}
          <View style={styles.metricsRow}>
            <View>
              <Text style={styles.metricLabel}>Gasto ({formatMonth(status.mesReferencia)})</Text>
              <Text style={styles.metricValue}>{formatCurrency(status.gastoMesReais)}</Text>
            </View>
            <View style={styles.rightCol}>
              <Text style={styles.metricLabel}>Teto mensal</Text>
              <Text style={styles.metricLimitValue}>{formatCurrency(status.tetoMensalReais)}</Text>
            </View>
          </View>

          {/* Barra de Progresso */}
          <View style={styles.progressTrack} accessibilityLabel="barra-progresso-orcamento">
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressWidthPercent}%`,
                  backgroundColor: getLevelColor(),
                },
              ]}
            />
          </View>

          <View style={styles.footerRow}>
            <Text style={[styles.percentBadge, { color: getLevelColor() }]}>
              {status.percentual}% atingido
            </Text>
            {status.nivel !== 'normal' && (
              <View
                style={[
                  styles.smallStatusChip,
                  {
                    borderColor: status.nivel === 'critico' ? 'rgba(224,90,90,0.4)' : 'rgba(245,200,66,0.4)',
                    backgroundColor: status.nivel === 'critico' ? 'rgba(224,90,90,0.1)' : 'rgba(245,200,66,0.1)',
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    color: status.nivel === 'critico' ? colors.error : colors.amber,
                  }}
                >
                  {status.nivel === 'critico' ? 'LIMITE EXCEDIDO' : 'AVISO'}
                </Text>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleCol: {
    flex: 1,
  },
  eyebrow: {
    ...typography.sectionLabel,
    color: colors.lime,
    fontSize: 10,
    letterSpacing: 1,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: 2,
  },
  configBtn: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  configBtnText: {
    ...typography.captionBold,
    color: colors.lime,
  },
  emptyStateBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
  },
  emptyStateTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptyStateSub: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  alertBanner: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginBottom: spacing.sm,
  },
  alertBannerWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: colors.amber,
  },
  alertBannerCritical: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderColor: colors.error,
  },
  alertBannerText: {
    ...typography.captionBold,
    fontSize: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  metricValue: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: 2,
  },
  metricLimitValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  progressTrack: {
    height: 10,
    backgroundColor: colors.surface,
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginVertical: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  percentBadge: {
    ...typography.captionBold,
    fontSize: 12,
  },
  smallStatusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  thresholdNote: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
});
