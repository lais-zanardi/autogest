import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, radius, typography } from '../theme';
import { theme as tokens } from '../theme/tokens';
import { Icon } from './Icon';
import { EfficiencyGoal, GoalStatusResult, EcoTip as _EcoTip } from '@autogest/shared-types';
import { formatarConsumo } from '../utils/formatters';

interface EfficiencyGoalCardProps {
  goal: EfficiencyGoal | null;
  status: GoalStatusResult;
  averageKml: number | null;
  topTip?: _EcoTip;
  onPressManage: () => void;
}

export const EfficiencyGoalCard: React.FC<EfficiencyGoalCardProps> = ({
  goal,
  status,
  averageKml,
  topTip: _topTip,
  onPressManage,
}) => {
  const isGoalReached = status.situacao === 'atingida';
  const isGoalBelow = status.situacao === 'abaixo';

  const badgeColor = isGoalReached
    ? colors.lime
    : isGoalBelow
      ? colors.amber
      : colors.textSecondary;

  const badgeText = isGoalReached
    ? 'META ATINGIDA'
    : isGoalBelow
      ? 'ABAIXO DA META'
      : 'SEM DADOS';

  const progressClamped = Math.min(Math.max(status.progresso, 0), 1.5);
  const progressPercentWidth = `${Math.min(progressClamped * 100, 100)}%` as any;

  return (
    <View
      style={styles.card}
      accessible={true}
      accessibilityLabel="Cartão de Meta de Eficiência e Dicas"
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Icon name="Target" size={18} color={tokens.colors.accent} style={{ marginRight: 6 }} />
          <Text style={styles.title}>Meta de Eficiência</Text>
          <View style={[styles.badge, { borderColor: badgeColor }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>
              {badgeText}
            </Text>
          </View>
        </View>
      </View>

      {goal ? (
        <View style={styles.goalDetails}>
          {/* UX-02: Linhas separadas para Atual e Meta com km/l e L/100 km */}
          <View style={styles.metricList}>
            <View style={styles.metricItemRow}>
              <Text style={styles.metricLabel}>Atual:</Text>
              <Text style={styles.metricValue}>
                {averageKml != null ? formatarConsumo(averageKml) : '—'}
              </Text>
            </View>
            <View style={styles.metricItemRow}>
              <Text style={styles.metricLabel}>Meta:</Text>
              <Text style={[styles.metricValue, { color: colors.lime }]}>
                {formatarConsumo(goal.targetKml)}
              </Text>
            </View>
          </View>

          {/* Barra de Progresso */}
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: progressPercentWidth,
                  backgroundColor: isGoalReached ? colors.lime : colors.amber,
                },
              ]}
            />
          </View>

          {/* Rodapé com link para Metas & Dicas */}
          <View style={styles.progressFooter}>
            <TouchableOpacity
              style={styles.manageButton}
              onPress={onPressManage}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Acessar metas e dicas"
            >
              <Text style={styles.manageButtonText}>Metas & Dicas ›</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Nenhuma meta definida para este veículo. Estabeleça uma meta para otimizar seus gastos de combustível.
          </Text>
          <TouchableOpacity
            style={styles.setGoalButton}
            onPress={onPressManage}
            activeOpacity={0.8}
          >
            <Text style={styles.setGoalButtonText}>Definir Meta de Consumo</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    marginLeft: spacing.xs,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
  },
  manageButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  manageButtonText: {
    ...typography.caption,
    color: colors.lime,
    fontWeight: '600',
  },
  goalDetails: {
    marginTop: spacing.xs,
  },
  metricList: {
    marginBottom: spacing.xs,
    gap: 6,
  },
  metricItemRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
    flexShrink: 1,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
    gap: 4,
  },
  microcopyText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    flex: 1,
    flexShrink: 1,
  },
  emptyContainer: {
    paddingVertical: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  setGoalButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lime,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  setGoalButtonText: {
    ...typography.caption,
    color: colors.lime,
    fontWeight: '600',
  },
  tipBox: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.lime,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  tipIcon: {
    marginRight: 6,
    fontSize: 14,
  },
  tipTitle: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  tipDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
});

