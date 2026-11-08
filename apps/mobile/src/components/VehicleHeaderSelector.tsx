import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { VehicleService } from '../services/vehicleService';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from './Icon';

import { SyncStatusBadge } from './SyncStatusBadge';
import { Card } from './ui/Card';
import { ListRow } from './ui/ListRow';

export interface VehicleHeaderSelectorProps {
  onAddNewPress?: () => void;
  compact?: boolean;
}

export const VehicleHeaderSelector: React.FC<VehicleHeaderSelectorProps> = ({ onAddNewPress, compact = false }) => {
  const { vehicles, selectedVehicle, pendingSyncCount, syncStatus } = useAppStore();
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelect = (id: string) => {
    VehicleService.selectVehicle(id);
    setModalVisible(false);
  };

  const hasSyncIssueOrPending = pendingSyncCount > 0 || syncStatus === 'error';

  return (
    <View style={compact ? styles.containerCompact : styles.container}>
      {compact ? (
        <TouchableOpacity
          style={styles.compactSelector}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
          accessibilityLabel={`Veículo selecionado: ${selectedVehicle?.model || 'nenhum'}. Toque para alternar.`}
        >
          <View style={styles.compactIconWrap}>
            <Icon name="Car" size={16} color={colors.textPrimary} />
          </View>
          <View style={styles.compactTextWrap}>
            <Text style={styles.compactModel} numberOfLines={1}>
              {selectedVehicle ? selectedVehicle.model : 'Selecionar'}
            </Text>
            <Text style={styles.compactPlate} numberOfLines={1}>
              {selectedVehicle ? selectedVehicle.plate : 'Nenhum'}
            </Text>
          </View>
          {hasSyncIssueOrPending && (
            <View style={{ marginRight: 4 }}>
              <SyncStatusBadge variant="badge" />
            </View>
          )}
          <Icon name="ChevronDown" size={14} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <ListRow
            icon="Car"
            title={selectedVehicle ? selectedVehicle.model : 'Nenhum veículo selecionado'}
            subtitle={
              selectedVehicle
                ? `${selectedVehicle.plate} • ${selectedVehicle.year || ''}`.trim()
                : 'Toque para selecionar'
            }
            value={hasSyncIssueOrPending ? <SyncStatusBadge variant="badge" /> : undefined}
            onPress={() => setModalVisible(true)}
            isFirst
            showChevron
            accessibilityLabel={`Veículo selecionado: ${selectedVehicle?.model || 'nenhum'}. Toque para alternar.`}
          />
        </Card>
      )}

      {/* Modal de seleção de veículo */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Alternar Veículo Ativo</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="X" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {vehicles.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Nenhum veículo disponível.</Text>
                {onAddNewPress && (
                  <TouchableOpacity
                    style={styles.addNewButton}
                    onPress={() => {
                      setModalVisible(false);
                      onAddNewPress();
                    }}
                  >
                    <Text style={styles.addNewButtonText}>+ Cadastrar Veículo</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <FlatList
                data={vehicles}
                keyExtractor={item => item.id}
                style={styles.list}
                renderItem={({ item }) => {
                  const isSelected = selectedVehicle?.id === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.vehicleOption, isSelected && styles.vehicleOptionSelected]}
                      onPress={() => handleSelect(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionDetails}>
                        <View style={styles.plateTagSmall}>
                          <Text style={styles.plateTextSmall}>{item.plate}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.optionModel}>{item.model}</Text>
                          <Text style={styles.optionSub}>
                            {item.year} • {item.tankCapacityL} L • {item.preferredFuel}
                          </Text>
                        </View>
                      </View>
                      {isSelected && (
                        <View style={[styles.checkBadge, { alignItems: 'center', justifyContent: 'center' }]}>
                          <Icon name="Check" size={14} color={colors.black} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
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
  containerCompact: {
    flex: 1,
    marginRight: spacing.sm,
  },
  compactSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    gap: 8,
  },
  compactIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTextWrap: {
    flex: 1,
  },
  compactModel: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 12,
  },
  compactPlate: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  selectorBar: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLeft: {
    flex: 1,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.lime,
    marginBottom: 2,
    fontSize: 10,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  plateTag: {
    backgroundColor: '#050607',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  plateText: {
    ...typography.captionBold,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    fontSize: 11,
  },
  vehicleTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  noVehicleText: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chevronButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginLeft: spacing.sm,
  },
  chevronText: {
    color: colors.lime,
    fontSize: 14,
    fontWeight: 'bold',
    top: -1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  closeText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  list: {
    maxHeight: 320,
  },
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  vehicleOptionSelected: {
    borderColor: colors.lime,
    backgroundColor: colors.limeDim,
  },
  optionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  plateTagSmall: {
    backgroundColor: '#050607',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  plateTextSmall: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 10,
  },
  optionModel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  optionSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: colors.black,
    fontWeight: 'bold',
    fontSize: 12,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  addNewButton: {
    backgroundColor: colors.lime,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  addNewButtonText: {
    ...typography.bodyBold,
    color: colors.black,
  },
});
