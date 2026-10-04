import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { Maintenance, MaintenanceType, Vehicle } from '@autogest/shared-types';
import { MaintenanceService } from '../services/maintenanceService';
import { formatCurrency } from '../utils/formatters';
import { colors, spacing, radius, typography } from '../theme';

interface MaintenanceHistoryCardProps {
  vehicle: Vehicle | null;
  onAddNewPress: () => void;
  onEditPress: (maintenance: Maintenance) => void;
  onDeletePress: (maintenance: Maintenance) => void;
  refreshTrigger?: number;
}

export const MaintenanceHistoryCard: React.FC<MaintenanceHistoryCardProps> = ({
  vehicle,
  onAddNewPress,
  onEditPress,
  onDeletePress,
  refreshTrigger,
}) => {
  const [filter, setFilter] = useState<'todas' | MaintenanceType>('todas');
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewingAttachments, setViewingAttachments] = useState<Maintenance | null>(null);

  const loadData = async () => {
    if (!vehicle?.id) {
      setMaintenances([]);
      return;
    }
    setIsLoading(true);
    try {
      const filterType = filter === 'todas' ? undefined : filter;
      const list = await MaintenanceService.listByVehicle(vehicle.id, filterType);
      setMaintenances(list);
    } catch (e) {
      console.warn('Erro ao carregar manutenções:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [vehicle?.id, filter, refreshTrigger]);

  const formatDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      if (year && month && day) return `${day}/${month}/${year}`;
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const getServiceLabel = (type: string) => {
    switch (type) {
      case 'troca_oleo':
        return '🛢️ Troca de Óleo';
      case 'filtros':
        return '💨 Filtros';
      case 'correia_dentada':
        return '⚙️ Correia Dentada';
      case 'velas':
        return '⚡ Velas';
      case 'pneus':
        return '🛞 Pneus';
      case 'freios':
        return '🛑 Freios';
      default:
        return '🔧 ' + (type || 'Serviço Geral');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header com Filtros (US09.7) */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Histórico de Manutenções</Text>
          <Text style={styles.subtitle}>
            {maintenances.length} {maintenances.length === 1 ? 'registro' : 'registros'}
          </Text>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={onAddNewPress} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Adicionar</Text>
        </TouchableOpacity>
      </View>

      {/* Filtros por tipo (US09.7) */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'todas' && styles.filterChipSelected]}
          onPress={() => setFilter('todas')}
        >
          <Text
            style={[styles.filterChipText, filter === 'todas' && styles.filterChipTextSelected]}
          >
            Todas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'preventiva' && styles.filterChipSelected]}
          onPress={() => setFilter('preventiva')}
        >
          <Text
            style={[
              styles.filterChipText,
              filter === 'preventiva' && styles.filterChipTextSelected,
            ]}
          >
            🛡️ Preventivas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'corretiva' && styles.filterChipSelected]}
          onPress={() => setFilter('corretiva')}
        >
          <Text
            style={[styles.filterChipText, filter === 'corretiva' && styles.filterChipTextSelected]}
          >
            ⚠️ Corretivas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista ou Loading ou Vazio */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.lime} size="small" />
        </View>
      ) : maintenances.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🛠️</Text>
          <Text style={styles.emptyTitle}>Nenhuma manutenção encontrada</Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'todas'
              ? 'Mantenha o histórico do seu veículo em dia registrando manutenções preventivas e corretivas.'
              : `Nenhuma manutenção do tipo ${filter} registrada.`}
          </Text>
          <TouchableOpacity style={styles.emptyActionBtn} onPress={onAddNewPress}>
            <Text style={styles.emptyActionBtnText}>+ Registrar Manutenção</Text>
          </TouchableOpacity>
        </View>
      ) : (
        maintenances.map(maint => (
          <View key={maint.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.serviceRow}>
                <Text style={styles.serviceTitle}>{getServiceLabel(maint.serviceType)}</Text>
                <View
                  style={[
                    styles.typeBadge,
                    maint.type === 'preventiva' ? styles.typeBadgePrev : styles.typeBadgeCorr,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeBadgeText,
                      maint.type === 'preventiva'
                        ? styles.typeBadgeTextPrev
                        : styles.typeBadgeTextCorr,
                    ]}
                  >
                    {maint.type.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.dateText}>{formatDate(maint.date)}</Text>
            </View>

            <View style={styles.metricsRow}>
              <Text style={styles.kmValue}>{maint.odometer.toLocaleString('pt-BR')} km</Text>
              <Text style={styles.priceValue}>{formatCurrency(maint.totalValue)}</Text>
            </View>

            <Text style={styles.descriptionText}>{maint.description}</Text>

            {maint.replacedParts && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Peças:</Text>
                <Text style={styles.detailValue} numberOfLines={2}>
                  {maint.replacedParts}
                </Text>
              </View>
            )}

            {(maint.workshop || maint.mechanic) && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Local / Profissional:</Text>
                <Text style={styles.detailValue}>
                  {[maint.workshop, maint.mechanic].filter(Boolean).join(' • ')}
                </Text>
              </View>
            )}

            {/* Anexos vinculados (US09.4) */}
            {maint.attachments && maint.attachments.length > 0 && (
              <TouchableOpacity
                style={styles.attachmentsRow}
                onPress={() => setViewingAttachments(maint)}
                activeOpacity={0.7}
              >
                <Text style={styles.attachmentBadge}>
                  📎 {maint.attachments.length}{' '}
                  {maint.attachments.length === 1 ? 'comprovante' : 'comprovantes'} (toque para ver)
                </Text>
                {maint.attachments.some(a => a.uploadStatus === 'enviado') && (
                  <Text style={styles.attachmentSyncedBadge}>☁️ Na nuvem</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Ações: Editar e Excluir */}
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.cardActionBtn}
                onPress={() => onEditPress(maint)}
                activeOpacity={0.7}
              >
                <Text style={styles.cardActionBtnText}>✏️ Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardActionBtnDelete}
                onPress={() => onDeletePress(maint)}
                activeOpacity={0.7}
              >
                <Text style={styles.cardActionBtnDeleteText}>🗑️ Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* Modal de visualização de comprovantes da manutenção */}
      <Modal
        visible={!!viewingAttachments}
        animationType="fade"
        transparent
        onRequestClose={() => setViewingAttachments(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comprovantes da Manutenção</Text>
              <TouchableOpacity
                onPress={() => setViewingAttachments(null)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {viewingAttachments ? getServiceLabel(viewingAttachments.serviceType) : ''} •{' '}
              {viewingAttachments ? formatDate(viewingAttachments.date) : ''}
            </Text>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {viewingAttachments?.attachments?.map((att, idx) => (
                <View key={att.id || idx} style={styles.modalAttachmentItem}>
                  <Text style={styles.modalAttachmentIcon}>📄</Text>
                  <View style={styles.modalAttachmentInfo}>
                    <Text style={styles.modalAttachmentName} numberOfLines={1}>
                      {att.localPath.split('/').pop() || `Anexo ${idx + 1}`}
                    </Text>
                    <Text style={styles.modalAttachmentMeta}>
                      {Math.round(att.fileSize / 1024)} KB • Status:{' '}
                      {att.uploadStatus === 'enviado' ? '☁️ Sincronizado' : '⏳ Pendente (local)'}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setViewingAttachments(null)}
            >
              <Text style={styles.modalDoneBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: colors.lime,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  addBtnText: {
    color: colors.black,
    fontWeight: '700',
    fontSize: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipSelected: {
    backgroundColor: colors.limeDim,
    borderColor: colors.lime,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextSelected: {
    color: colors.lime,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyActionBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lime,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  emptyActionBtnText: {
    color: colors.lime,
    fontWeight: '600',
    fontSize: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  serviceTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgePrev: {
    backgroundColor: colors.limeDim,
  },
  typeBadgeCorr: {
    backgroundColor: colors.amberDim,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  typeBadgeTextPrev: {
    color: colors.lime,
  },
  typeBadgeTextCorr: {
    color: colors.amber,
  },
  dateText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  kmValue: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  priceValue: {
    fontSize: 14,
    color: colors.lime,
    fontWeight: '700',
  },
  descriptionText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
    marginVertical: 4,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 11,
    color: colors.textPrimary,
    flex: 1,
  },
  attachmentsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  attachmentBadge: {
    fontSize: 11,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  attachmentSyncedBadge: {
    fontSize: 11,
    color: colors.lime,
    backgroundColor: colors.limeDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  cardActionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  cardActionBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  cardActionBtnDelete: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  cardActionBtnDeleteText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  modalCloseBtnText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modalList: {
    maxHeight: 280,
  },
  modalAttachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  modalAttachmentIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  modalAttachmentInfo: {
    flex: 1,
  },
  modalAttachmentName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalAttachmentMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalDoneBtn: {
    backgroundColor: colors.lime,
    paddingVertical: 10,
    borderRadius: radius.full,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  modalDoneBtnText: {
    color: colors.black,
    fontWeight: '700',
    fontSize: 13,
  },
});
