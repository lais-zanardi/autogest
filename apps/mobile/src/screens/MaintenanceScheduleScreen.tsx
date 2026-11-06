import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Vehicle,
  MaintenanceSchedule,
} from '@autogest/shared-types';
import { MaintenanceScheduleService } from '../services/maintenanceScheduleService';
import { VehicleRepository } from '../repositories/VehicleRepository';
import { MaintenanceCalendarView } from '../components/MaintenanceCalendarView';
import { MaintenanceScheduleFormModal } from '../components/MaintenanceScheduleFormModal';
import { MaintenanceFormModal } from '../components/MaintenanceFormModal';
import { colors, spacing, radius, typography } from '../theme';

interface MaintenanceScheduleScreenProps {
  navigation?: any;
  route?: any;
}

export const MaintenanceScheduleScreen: React.FC<MaintenanceScheduleScreenProps> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeVehicle, setActiveVehicle] = useState<Vehicle | null>(null);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Navegação do calendário
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Modais
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState<MaintenanceSchedule | null>(null);

  const [maintenanceFormVisible, setMaintenanceFormVisible] = useState(false);
  const [scheduleToComplete, setScheduleToComplete] = useState<MaintenanceSchedule | null>(null);

  const loadData = useCallback(async () => {
    try {
      const allVehicles = await VehicleRepository.listAll();
      setVehicles(allVehicles);

      const targetVehicle =
        activeVehicle ||
        (route?.params?.vehicleId
          ? allVehicles.find(v => v.id === route.params.vehicleId)
          : null) ||
        allVehicles[0] ||
        null;

      setActiveVehicle(targetVehicle);

      if (targetVehicle) {
        const loadedSchedules = await MaintenanceScheduleService.listarPorVeiculo(
          targetVehicle.id
        );
        setSchedules(loadedSchedules);
      } else {
        setSchedules([]);
      }
    } catch {
      // Ignora erro de carregamento
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeVehicle, route?.params?.vehicleId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleOpenNewSchedule = () => {
    setScheduleToEdit(null);
    setScheduleModalVisible(true);
  };

  const handleOpenEditSchedule = (schedule: MaintenanceSchedule) => {
    setScheduleToEdit(schedule);
    setScheduleModalVisible(true);
  };

  const handleCompleteSchedule = (schedule: MaintenanceSchedule) => {
    setScheduleToComplete(schedule);
    setMaintenanceFormVisible(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {navigation?.canGoBack() && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.backButtonText}>‹</Text>
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerSubtitle}>PLANEJAMENTO</Text>
            <Text style={styles.headerTitle}>Agendamentos e Calendário</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.newScheduleButton}
          onPress={handleOpenNewSchedule}
        >
          <Text style={styles.newScheduleButtonText}>+ Agendar</Text>
        </TouchableOpacity>
      </View>

      {/* Seletor de Veículo Horizontal */}
      {vehicles.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.vehicleScroll}
          contentContainerStyle={styles.vehicleScrollContent}
        >
          {vehicles.map(v => {
            const isSelected = activeVehicle?.id === v.id;
            return (
              <TouchableOpacity
                key={v.id}
                style={[
                  styles.vehicleChip,
                  isSelected && styles.vehicleChipSelected,
                ]}
                onPress={() => setActiveVehicle(v)}
              >
                <Text
                  style={[
                    styles.vehicleChipText,
                    isSelected && styles.vehicleChipTextSelected,
                  ]}
                >
                  {v.plate} • {v.model}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.lime} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.lime}
            />
          }
        >
          <MaintenanceCalendarView
            schedules={schedules}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onSelectSchedule={handleOpenEditSchedule}
            onCompleteSchedule={handleCompleteSchedule}
            currentMonth={currentMonth}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
          />
        </ScrollView>
      )}

      {/* Modal de Agendamento */}
      <MaintenanceScheduleFormModal
        visible={scheduleModalVisible}
        vehicle={activeVehicle}
        scheduleToEdit={scheduleToEdit}
        initialDate={selectedDate}
        onClose={() => setScheduleModalVisible(false)}
        onSuccess={() => {
          setScheduleModalVisible(false);
          loadData();
        }}
      />

      {/* Modal de Conclusão / Cadastro de Manutenção (US09 + US30.5) */}
      <MaintenanceFormModal
        visible={maintenanceFormVisible}
        vehicle={activeVehicle}
        scheduleToComplete={scheduleToComplete}
        onClose={() => {
          setMaintenanceFormVisible(false);
          setScheduleToComplete(null);
        }}
        onSuccess={() => {
          setMaintenanceFormVisible(false);
          setScheduleToComplete(null);
          loadData();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: spacing.sm,
    paddingRight: spacing.xs,
  },
  backButtonText: {
    fontSize: 28,
    color: colors.lime,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    ...typography.labelSmall,
    color: colors.lime,
    letterSpacing: 1.5,
  },
  headerTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  newScheduleButton: {
    backgroundColor: colors.lime,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  newScheduleButtonText: {
    ...typography.labelMedium,
    color: colors.background,
    fontWeight: 'bold',
  },
  vehicleScroll: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  vehicleScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  vehicleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vehicleChipSelected: {
    borderColor: colors.lime,
    backgroundColor: 'rgba(218, 255, 0, 0.1)',
  },
  vehicleChipText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  vehicleChipTextSelected: {
    color: colors.lime,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
});
