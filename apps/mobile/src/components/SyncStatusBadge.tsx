import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { SyncService } from '../services/sync';
import { colors, radius, spacing, typography } from '../theme';
import { Icon } from './Icon';

interface SyncStatusBadgeProps {
  variant?: 'badge' | 'card';
  style?: ViewStyle;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ variant = 'badge', style }) => {
  const { syncStatus, lastSyncAt, pendingSyncCount, isOnline } = useAppStore();
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const isSyncing = syncStatus === 'syncing' || isManualSyncing;

  const handleSyncPress = async () => {
    if (isSyncing) return;
    setIsManualSyncing(true);
    try {
      await SyncService.sync();
    } catch {
      // Erro já tratado no SyncService e no store
    } finally {
      setIsManualSyncing(false);
    }
  };

  const formatLastSync = (isoString?: string | null): string => {
    if (!isoString) return 'Nunca sincronizado';
    try {
      const date = new Date(isoString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} às ${hours}:${minutes}`;
    } catch {
      return isoString;
    }
  };

  // Determina rótulo, cor do indicador e texto de status
  let dotColor: string = colors.lime;
  let statusText = 'Sincronizado';

  if (!isOnline) {
    dotColor = colors.textMuted;
    statusText = 'Modo Offline';
  } else if (isSyncing) {
    dotColor = colors.lime;
    statusText = 'Sincronizando...';
  } else if (syncStatus === 'error') {
    dotColor = colors.error;
    statusText = 'Erro de sincronização';
  } else if (pendingSyncCount > 0) {
    dotColor = colors.amber;
    statusText = `Pendente (${pendingSyncCount} ${pendingSyncCount === 1 ? 'registro' : 'registros'})`;
  }

  // 1. Variante COMPACTA (para cabeçalhos ou barras superiores)
  if (variant === 'badge') {
    return (
      <TouchableOpacity
        style={[styles.badgeContainer, style]}
        onPress={handleSyncPress}
        disabled={isSyncing}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Status de sincronização: ${statusText}. Toque para sincronizar.`}
      >
        {isSyncing ? (
          <ActivityIndicator size="small" color={colors.lime} style={styles.spinner} />
        ) : (
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        )}
        <Text style={[styles.badgeText, { color: colors.textPrimary }]} numberOfLines={1}>
          {statusText}
        </Text>
      </TouchableOpacity>
    );
  }

  // 2. Variante CARD (para tela de Ajustes/Configurações)
  return (
    <View style={[styles.cardContainer, style]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Icon name="Cloud" size={24} color={colors.lime} style={{ marginRight: spacing.sm }} />
          <View>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>
              Sincronização em Nuvem
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Offline-first com envio automático e tolerância a falhas
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status Atual</Text>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
            <Text style={styles.statusPillText}>{statusText}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Fila de Envio (Outbox)</Text>
          <Text style={[styles.detailValue, pendingSyncCount > 0 && { color: colors.amber }]}>
            {pendingSyncCount} {pendingSyncCount === 1 ? 'pendente' : 'pendentes'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Última Sincronização</Text>
          <Text style={styles.detailValue}>{formatLastSync(lastSyncAt)}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
        onPress={handleSyncPress}
        disabled={isSyncing}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Sincronizar dados agora com o servidor"
      >
        {isSyncing ? (
          <View style={styles.btnLoadingRow}>
            <ActivityIndicator size="small" color={colors.black} />
            <Text style={styles.syncButtonText}>Sincronizando...</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon name="RefreshCw" size={15} color={colors.black} />
            <Text style={styles.syncButtonText}>Sincronizar Agora</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  spinner: {
    marginRight: 6,
    transform: [{ scale: 0.75 }],
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  cardContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    fontSize: 24,
  },
  cardDetails: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.sm,
    gap: 10,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPillText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  syncButton: {
    backgroundColor: colors.lime,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: colors.black,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
