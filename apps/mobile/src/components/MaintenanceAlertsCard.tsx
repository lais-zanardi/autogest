import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MaintenanceAlert, Vehicle } from '@autogest/shared-types';
import { MaintenanceAlertService } from '../services/maintenanceAlertService';
import { colors, spacing, radius, typography } from '../theme';
import { theme as tokens } from '../theme/tokens';
import { Icon } from './Icon';

interface MaintenanceAlertsCardProps {
  vehicle: Vehicle | null;
  onOpenRulesPress: () => void;
  onRegisterMaintenancePress: (alert?: MaintenanceAlert) => void;
  refreshTrigger?: number;
}

export const MaintenanceAlertsCard: React.FC<MaintenanceAlertsCardProps> = ({
  vehicle,
  onOpenRulesPress,
  onRegisterMaintenancePress,
  refreshTrigger = 0,
}) => {
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadAlerts = async () => {
      if (!vehicle) {
        setAlerts([]);
        return;
      }
      setLoading(true);
      try {
        const activeAlerts = await MaintenanceAlertService.evaluateVehicleAlerts(vehicle.id);
        if (isMounted) {
          setAlerts(activeAlerts);
        }
      } catch (err) {
        console.error('Erro ao carregar alertas preventivos:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAlerts();
    return () => {
      isMounted = false;
    };
  }, [vehicle?.id, vehicle?.currentOdometer, refreshTrigger]);

  if (!vehicle) return null;

  return (
    <View style={styles.cardContainer}>
      <View style={styles.headerRow}>
        <View style={styles.titleArea}>
          <Text style={styles.sectionTitle}>Alertas & Revisões</Text>
          <Text style={styles.sectionSubtitle}>Manutenção preventiva baseada em km e tempo</Text>
        </View>
        <TouchableOpacity style={styles.configBtn} onPress={onOpenRulesPress} activeOpacity={0.7}>
          <Icon name="Settings" size={12} color={colors.lime} style={{ marginRight: 4 }} />
          <Text style={styles.configBtnText}>Regras</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={colors.lime} />
        </View>
      ) : alerts.length === 0 ? (
        <View style={styles.allGoodContainer}>
          <Icon name="ShieldCheck" size={28} color={tokens.colors.accent} />
          <View style={styles.allGoodTextArea}>
            <Text style={styles.allGoodTitle}>Tudo em dia!</Text>
            <Text style={styles.allGoodDesc}>
              Nenhuma revisão preventiva pendente ou próxima para este veículo.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.alertsList}>
          {alerts.map(item => {
            const isVencido = item.status === 'vencido';
            const badgeBg = isVencido ? 'rgba(224, 90, 90, 0.15)' : colors.amberDim;
            const badgeBorder = isVencido ? 'rgba(224, 90, 90, 0.3)' : 'rgba(245, 200, 66, 0.3)';
            const badgeText = isVencido ? colors.error : colors.amber;

            const deadlineText = item.remainingKm !== null && item.remainingKm !== undefined
              ? (isVencido ? `Excedido em ${Math.abs(item.remainingKm)} km` : `Faltam ${item.remainingKm} km`)
              : item.remainingDays !== null && item.remainingDays !== undefined
                ? (isVencido ? `Atraso de ${Math.abs(item.remainingDays)} dias` : `Prazo de ${item.remainingDays} dias`)
                : item.message;

            return (
              <View
                key={item.id}
                style={[
                  styles.alertItem,
                  isVencido ? styles.alertItemVencido : styles.alertItemProximo,
                ]}
              >
                <View style={styles.alertHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={styles.serviceName}>{item.serviceName}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: badgeBg, borderColor: badgeBorder },
                        ]}
                      >
                        <Text style={[styles.statusBadgeText, { color: badgeText }]}>
                          {isVencido ? 'VENCIDA' : 'PRÓXIMA'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.alertMessage} numberOfLines={1}>
                      {deadlineText}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.resolveIconBtn}
                    onPress={() => onRegisterMaintenancePress(item)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Registrar revisão de ${item.serviceName}`}
                  >
                    <Icon name="Wrench" size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleArea: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  configBtn: {
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  configBtnText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  centerContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  allGoodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginTop: spacing.xs,
  },
  allGoodIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  allGoodTextArea: {
    flex: 1,
  },
  allGoodTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.lime,
  },
  allGoodDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  alertsList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  alertItem: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
  },
  alertItemVencido: {
    borderColor: 'rgba(224, 90, 90, 0.4)',
    backgroundColor: 'rgba(224, 90, 90, 0.05)',
  },
  alertItemProximo: {
    borderColor: 'rgba(245, 200, 66, 0.3)',
    backgroundColor: 'rgba(245, 200, 66, 0.03)',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  serviceName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  alertMessage: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  alertMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  metaText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  metaSubtle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  resolveIconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolveBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  resolveBtnText: {
    ...typography.caption,
    color: colors.lime,
    fontWeight: '600',
  },
});
