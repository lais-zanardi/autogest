import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Vehicle, TireRecord, FluidRecord } from '@autogest/shared-types';
import {
  TireAndFluidService,
  TIRE_TYPE_LABELS,
  FLUID_TYPE_LABELS,
} from '../services/tireAndFluidService';
import { formatDecimal } from '../utils/formatters';
import { colors, spacing, radius, typography } from '../theme';
import { TireFluidTab } from './TireAndFluidModal';
import { Icon } from './Icon';

interface TireAndFluidCardProps {
  vehicle: Vehicle | null;
  onAddNewPress: (initialTab: TireFluidTab) => void;
  onEditTirePress: (record: TireRecord) => void;
  onDeleteTirePress: (record: TireRecord) => void;
  onEditFluidPress: (record: FluidRecord) => void;
  onDeleteFluidPress: (record: FluidRecord) => void;
  refreshTrigger?: number;
}

type HistoryFilter = 'todos' | 'pneus' | 'fluidos';

export const TireAndFluidCard: React.FC<TireAndFluidCardProps> = ({
  vehicle,
  onAddNewPress,
  onEditTirePress,
  onDeleteTirePress,
  onEditFluidPress,
  onDeleteFluidPress,
  refreshTrigger = 0,
}) => {
  const [filter, setFilter] = useState<HistoryFilter>('todos');
  const [tireRecords, setTireRecords] = useState<TireRecord[]>([]);
  const [fluidRecords, setFluidRecords] = useState<FluidRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadHistory = async () => {
      if (!vehicle?.id) {
        setTireRecords([]);
        setFluidRecords([]);
        return;
      }
      setLoading(true);
      try {
        const [tires, fluids] = await Promise.all([
          TireAndFluidService.listTireRecordsByVehicle(vehicle.id),
          TireAndFluidService.listFluidRecordsByVehicle(vehicle.id),
        ]);
        if (isMounted) {
          setTireRecords(tires);
          setFluidRecords(fluids);
        }
      } catch (err) {
        console.warn('Erro ao carregar histórico de pneus e fluidos:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [vehicle?.id, refreshTrigger]);

  if (!vehicle) return null;

  const formatDate = (dateStr: string) => {
    try {
      const clean = dateStr.split('T')[0];
      const [y, m, d] = clean.split('-');
      if (y && m && d) return `${d}/${m}/${y}`;
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const combinedItems = [
    ...(filter === 'todos' || filter === 'pneus'
      ? tireRecords.map(item => ({ kind: 'pneu' as const, date: item.date, km: item.km, item }))
      : []),
    ...(filter === 'todos' || filter === 'fluidos'
      ? fluidRecords.map(item => ({ kind: 'fluido' as const, date: item.date, km: item.km, item }))
      : []),
  ].sort((a, b) => {
    const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (diff !== 0) return diff;
    return b.km - a.km;
  });

  const latestTire = tireRecords[0] || null;
  const lowLevelFluids = fluidRecords.filter(f => f.level === 'baixo');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>US11 • CONTROLE POR VEÍCULO</Text>
          <Text style={styles.title}>Pneus & Fluidos</Text>
          <Text style={styles.subtitle}>
            {tireRecords.length + fluidRecords.length}{' '}
            {tireRecords.length + fluidRecords.length === 1 ? 'registro' : 'registros'}
          </Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity
            style={styles.addSecondaryBtn}
            onPress={() => onAddNewPress('fluido')}
            activeOpacity={0.8}
          >
            <Text style={styles.addSecondaryBtnText}>+ Fluido</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addPrimaryBtn}
            onPress={() => onAddNewPress('pneu')}
            activeOpacity={0.8}
          >
            <Text style={styles.addPrimaryBtnText}>+ Pneu</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Resumo Rápido de Pressão e Nível */}
      {(latestTire || lowLevelFluids.length > 0) && (
        <View style={styles.summaryRow}>
          {latestTire && (
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryLabel}>Última Pressão</Text>
              <Text style={styles.summaryValue}>
                {formatDecimal(latestTire.pressurePsi, 1)} PSI
                {latestTire.treadDepthMm !== null && latestTire.treadDepthMm !== undefined
                  ? ` • Sulco ${formatDecimal(latestTire.treadDepthMm, 1)} mm`
                  : ''}
              </Text>
            </View>
          )}
          {lowLevelFluids.length > 0 && (
            <View style={[styles.summaryBadge, styles.summaryBadgeWarning, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
              <Icon name="AlertTriangle" size={14} color={colors.amber} />
              <View>
                <Text style={styles.summaryWarningLabel}>Nível Baixo</Text>
                <Text style={styles.summaryWarningValue}>
                  {lowLevelFluids.map(f => FLUID_TYPE_LABELS[f.fluidType]).join(', ')}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Abas de Filtro (US11.4) */}
      <View style={styles.filterRow}>
        {(
          [
            { key: 'todos', label: 'Todos', icon: null },
            { key: 'pneus', label: 'Pneus', icon: 'CircleDot' },
            { key: 'fluidos', label: 'Fluidos', icon: 'Droplets' },
          ] as Array<{ key: HistoryFilter; label: string; icon: any }>
        ).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterChip, filter === tab.key && styles.filterChipActive]}
            onPress={() => setFilter(tab.key)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {tab.icon && (
                <Icon
                  name={tab.icon}
                  size={13}
                  color={filter === tab.key ? colors.black : colors.textSecondary}
                />
              )}
              <Text
                style={[styles.filterChipText, filter === tab.key && styles.filterChipTextActive]}
              >
                {tab.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="small" color={colors.lime} />
        </View>
      ) : combinedItems.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Nenhum registro de pneus ou fluidos</Text>
          <Text style={styles.emptyDesc}>
            acompanhe calibragens periódicas, trocas de pneus, óleo do motor, fluido de freio e água
            do radiador.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {combinedItems.map(entry => {
            if (entry.kind === 'pneu') {
              const t = entry.item;
              return (
                <View key={`pneu_${t.id}`} style={styles.itemCard}>
                  <View style={styles.itemTop}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Icon
                          name={t.type === 'troca' ? 'CircleDot' : 'Wind'}
                          size={14}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.itemType}>
                          {TIRE_TYPE_LABELS[t.type]}
                        </Text>
                      </View>
                      <Text style={styles.itemMeta}>
                        {formatDate(t.date)} • {t.km.toLocaleString('pt-BR')} km
                      </Text>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={styles.itemHighlight}>
                        {formatDecimal(t.pressurePsi, 1)} PSI
                      </Text>
                      {t.treadDepthMm !== null && t.treadDepthMm !== undefined && (
                        <Text style={styles.itemSubHighlight}>
                          Sulco: {formatDecimal(t.treadDepthMm, 1)} mm
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.itemActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                      onPress={() => onEditTirePress(t)}
                    >
                      <Icon name="Edit2" size={12} color={colors.textPrimary} />
                      <Text style={styles.actionBtnText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.deleteBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                      onPress={() => onDeleteTirePress(t)}
                    >
                      <Icon name="Trash2" size={12} color={colors.error} />
                      <Text style={styles.deleteBtnText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }

            const f = entry.item;
            return (
              <View key={`fluido_${f.id}`} style={styles.itemCard}>
                <View style={styles.itemTop}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Icon
                        name={
                          f.fluidType === 'oleo_motor'
                            ? 'Droplets'
                            : f.fluidType === 'freio'
                              ? 'Disc'
                              : 'Droplet'
                        }
                        size={14}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.itemType}>
                        {FLUID_TYPE_LABELS[f.fluidType]}
                      </Text>
                    </View>
                    <Text style={styles.itemMeta}>
                      {formatDate(f.date)} • {f.km.toLocaleString('pt-BR')} km
                    </Text>
                  </View>
                  <View style={styles.itemRight}>
                    <View
                      style={[
                        styles.levelPill,
                        f.level === 'baixo' ? styles.levelPillLow : styles.levelPillNormal,
                        { flexDirection: 'row', alignItems: 'center', gap: 4 },
                      ]}
                    >
                      <Icon
                        name={f.level === 'baixo' ? 'AlertTriangle' : 'Check'}
                        size={11}
                        color={f.level === 'baixo' ? colors.amber : colors.lime}
                      />
                      <Text
                        style={[
                          styles.levelPillText,
                          f.level === 'baixo'
                            ? styles.levelPillTextLow
                            : styles.levelPillTextNormal,
                        ]}
                      >
                        {f.level === 'baixo' ? 'Nível Baixo' : 'Normal'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                    onPress={() => onEditFluidPress(f)}
                  >
                    <Icon name="Edit2" size={12} color={colors.textPrimary} />
                    <Text style={styles.actionBtnText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                    onPress={() => onDeleteFluidPress(f)}
                  >
                    <Icon name="Trash2" size={12} color={colors.error} />
                    <Text style={styles.deleteBtnText}>Excluir</Text>
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
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.lime,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerBtns: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  addSecondaryBtn: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
  },
  addSecondaryBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  addPrimaryBtn: {
    backgroundColor: colors.lime,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
  },
  addPrimaryBtnText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryBadge: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryBadgeWarning: {
    borderColor: colors.amber,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  summaryLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  summaryWarningLabel: {
    fontSize: 10,
    color: colors.amber,
    fontWeight: '700',
  },
  summaryWarningValue: {
    fontSize: 12,
    color: colors.amber,
    fontWeight: '600',
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: 'rgba(200, 241, 53, 0.15)',
    borderColor: colors.lime,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: colors.lime,
    fontWeight: '700',
  },
  loadingArea: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyBox: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  list: {
    gap: spacing.sm,
  },
  itemCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemType: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemHighlight: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.lime,
  },
  itemSubHighlight: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  levelPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  levelPillNormal: {
    backgroundColor: 'rgba(200, 241, 53, 0.12)',
    borderColor: colors.lime,
  },
  levelPillLow: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: colors.amber,
  },
  levelPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  levelPillTextNormal: {
    color: colors.lime,
  },
  levelPillTextLow: {
    color: colors.amber,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  deleteBtn: {
    borderColor: 'rgba(255, 77, 79, 0.35)',
  },
  deleteBtnText: {
    fontSize: 11,
    color: colors.error,
    fontWeight: '500',
  },
});
