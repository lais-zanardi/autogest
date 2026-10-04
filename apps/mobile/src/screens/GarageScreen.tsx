import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Vehicle } from '@autogest/shared-types';
import { useAppStore } from '../store/useAppStore';
import { VehicleService } from '../services/vehicleService';
import { VehicleFormModal, ConfirmModal, UpdateOdometerModal } from '../components';
import { colors, spacing, radius, typography } from '../theme';

export const GarageScreen: React.FC = () => {
  const { vehicles, selectedVehicle } = useAppStore();

  const [formModalVisible, setFormModalVisible] = useState(false);
  const [vehicleToEdit, setVehicleToEdit] = useState<Vehicle | null>(null);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);

  const [odometerModalVisible, setOdometerModalVisible] = useState(false);
  const [vehicleToUpdateOdo, setVehicleToUpdateOdo] = useState<Vehicle | null>(null);

  useEffect(() => {
    // Carrega a lista inicial de veículos se estiver vazia
    VehicleService.listVehicles();
  }, []);

  const handleOpenCreate = () => {
    setVehicleToEdit(null);
    setFormModalVisible(true);
  };

  const handleOpenEdit = (vehicle: Vehicle) => {
    setVehicleToEdit(vehicle);
    setFormModalVisible(true);
  };

  const handleOpenDelete = (vehicle: Vehicle) => {
    setVehicleToDelete(vehicle);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!vehicleToDelete) return;
    try {
      await VehicleService.deleteVehicle(vehicleToDelete.id);
    } catch (e) {
      console.error('Erro ao excluir veículo:', e);
    } finally {
      setDeleteModalVisible(false);
      setVehicleToDelete(null);
    }
  };

  const handleSelectActive = (vehicle: Vehicle) => {
    VehicleService.selectVehicle(vehicle.id);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.container}>
        {/* Cabeçalho da Garagem */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>FROTA</Text>
            <Text style={styles.title}>Minha Garagem</Text>
            <Text style={styles.subtitle}>
              {vehicles.length === 1
                ? '1 veículo cadastrado'
                : `${vehicles.length} veículos cadastrados`}
            </Text>
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={handleOpenCreate} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>+ Novo</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Veículos ou Estado Vazio */}
        {vehicles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIconText}>🚘</Text>
            </View>
            <Text style={styles.emptyTitle}>Nenhum veículo cadastrado</Text>
            <Text style={styles.emptyDescription}>
              Cadastre seu primeiro veículo para acompanhar consumo de combustível, manutenções e
              custos em tempo real.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={handleOpenCreate}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyActionBtnText}>Cadastrar Primeiro Veículo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={vehicles}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isActive = selectedVehicle?.id === item.id;
              return (
                <View style={[styles.card, isActive && styles.cardActive]}>
                  {/* Topo do Card: Placa e Badge Ativo */}
                  <View style={styles.cardHeader}>
                    <View style={styles.plateContainer}>
                      <Text style={styles.plateText}>{item.plate}</Text>
                    </View>

                    {isActive ? (
                      <View style={styles.activeBadge}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activeBadgeText}>ATIVO</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.selectBtn}
                        onPress={() => handleSelectActive(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.selectBtnText}>Tornar Ativo</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Informações Principais */}
                  <View style={styles.cardBody}>
                    <Text style={styles.vehicleModel}>{item.model}</Text>
                    {item.name && item.name !== item.model && (
                      <Text style={styles.vehicleNick}>"{item.name}"</Text>
                    )}

                    <View style={styles.metadataGrid}>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Ano</Text>
                        <Text style={styles.metaValue}>{item.year}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Tanque</Text>
                        <Text style={styles.metaValue}>{item.tankCapacityL} L</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Combustível</Text>
                        <Text style={styles.metaValue}>{item.preferredFuel}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>Odômetro</Text>
                        <Text style={styles.metaValue}>
                          {item.currentOdometer || item.initialOdometer || 0} km
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Ações: Atualizar Hodômetro, Editar e Excluir */}
                  <View style={styles.cardFooter}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => {
                        setVehicleToUpdateOdo(item);
                        setOdometerModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.actionBtnText}>⏱️ Km</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleOpenEdit(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.actionBtnText}>✏️ Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.deleteBtn]}
                      onPress={() => handleOpenDelete(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.actionBtnText, styles.deleteBtnText]}>🗑️ Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Modal de Atualização de Hodômetro (US06.1) */}
        <UpdateOdometerModal
          visible={odometerModalVisible}
          vehicle={vehicleToUpdateOdo}
          onClose={() => {
            setOdometerModalVisible(false);
            setVehicleToUpdateOdo(null);
          }}
          onSuccess={() => {
            VehicleService.listVehicles();
          }}
        />

        {/* Modal de Formulário (Criação / Edição) */}
        <VehicleFormModal
          visible={formModalVisible}
          vehicleToEdit={vehicleToEdit}
          onClose={() => setFormModalVisible(false)}
          onSuccess={() => setFormModalVisible(false)}
        />

        {/* Modal de Confirmação de Exclusão (US04.6) */}
        <ConfirmModal
          visible={deleteModalVisible}
          title="Excluir Veículo?"
          message={
            vehicleToDelete
              ? `Tem certeza que deseja excluir o veículo ${vehicleToDelete.model} (${vehicleToDelete.plate})? Esta ação ocultará o veículo e todos os seus registros vinculados.`
              : 'Tem certeza que deseja excluir este veículo?'
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setDeleteModalVisible(false);
            setVehicleToDelete(null);
          }}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.lime,
    marginBottom: 2,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: colors.lime,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    ...typography.bodyBold,
    color: colors.black,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 80,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardActive: {
    borderColor: 'rgba(198, 255, 77, 0.4)',
    backgroundColor: colors.surfaceRaised,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  plateContainer: {
    backgroundColor: '#050607',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  plateText: {
    ...typography.captionBold,
    color: colors.textPrimary,
    letterSpacing: 1,
    fontSize: 12,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.limeDim,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(198, 255, 77, 0.3)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.lime,
    marginRight: 6,
  },
  activeBadgeText: {
    ...typography.captionBold,
    color: colors.lime,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  selectBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  selectBtnText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  cardBody: {
    marginVertical: spacing.xs,
  },
  vehicleModel: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  vehicleNick: {
    ...typography.caption,
    color: colors.lime,
    fontStyle: 'italic',
    marginTop: 2,
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  metaItem: {
    flex: 1,
    minWidth: '22%',
  },
  metaLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  metaValue: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 12,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  deleteBtn: {
    borderColor: 'rgba(224, 90, 90, 0.3)',
  },
  deleteBtnText: {
    color: colors.error,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyIconText: {
    fontSize: 36,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptyDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  emptyActionBtn: {
    backgroundColor: colors.lime,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  emptyActionBtnText: {
    ...typography.bodyBold,
    color: colors.black,
  },
});
