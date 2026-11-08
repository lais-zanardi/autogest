import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Vehicle,
  MaintenanceSchedule,
  MaintenanceServiceType,
} from '@autogest/shared-types';
import { MaintenanceScheduleService } from '../services/maintenanceScheduleService';
import { colors, spacing, radius, typography } from '../theme';
import { Icon, IconName } from './Icon';

interface MaintenanceScheduleFormModalProps {
  visible: boolean;
  vehicle: Vehicle | null;
  scheduleToEdit?: MaintenanceSchedule | null;
  initialDate?: string;
  onClose: () => void;
  onSuccess?: (schedule: MaintenanceSchedule) => void;
}

const SERVICE_TYPE_OPTIONS: Array<{ key: MaintenanceServiceType; label: string; icon: IconName }> = [
  { key: 'troca_oleo', label: 'Óleo', icon: 'Droplets' },
  { key: 'calibragem_pneus', label: 'Calibragem', icon: 'Wind' },
  { key: 'fluido_freio', label: 'Fluido Freio', icon: 'Disc' },
  { key: 'agua_radiador', label: 'Radiador', icon: 'Droplet' },
  { key: 'filtros', label: 'Filtros', icon: 'Wind' },
  { key: 'correia_dentada', label: 'Correia', icon: 'Settings' },
  { key: 'velas', label: 'Velas', icon: 'Zap' },
  { key: 'pneus', label: 'Pneus', icon: 'CircleDot' },
  { key: 'freios', label: 'Freios', icon: 'Disc' },
  { key: 'outros', label: 'Outros', icon: 'Wrench' },
];

export const MaintenanceScheduleFormModal: React.FC<MaintenanceScheduleFormModalProps> = ({
  visible,
  vehicle,
  scheduleToEdit,
  initialDate,
  onClose,
  onSuccess,
}) => {
  const isEditing = !!scheduleToEdit;

  const [date, setDate] = useState('');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [serviceType, setServiceType] = useState<MaintenanceServiceType>('troca_oleo');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (visible) {
      setErrors({});
      setIsSubmitting(false);

      if (scheduleToEdit) {
        setDate(scheduleToEdit.date);
        setReminderTime(scheduleToEdit.reminderTime || '09:00');
        setServiceType(scheduleToEdit.serviceType);
        setDescription(scheduleToEdit.description || '');
      } else {
        setDate(initialDate || new Date().toISOString().split('T')[0]);
        setReminderTime('09:00');
        setServiceType('troca_oleo');
        setDescription('');
      }
    }
  }, [visible, scheduleToEdit, initialDate]);

  const handleSave = async () => {
    if (!vehicle) {
      Alert.alert('Erro', 'Selecione um veículo.');
      return;
    }

    const newErrors: Record<string, string> = {};
    if (!date.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      newErrors.date = 'Data no formato AAAA-MM-DD é obrigatória.';
    }

    if (!reminderTime.trim() || !/^\d{2}:\d{2}$/.test(reminderTime.trim())) {
      newErrors.reminderTime = 'Horário no formato HH:mm é obrigatório (ex: 09:00).';
    }

    if (!description.trim()) {
      newErrors.description = 'Descrição do agendamento é obrigatória.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && scheduleToEdit) {
        const updated = await MaintenanceScheduleService.editarAgendamento(scheduleToEdit.id, {
          date: date.trim(),
          reminderTime: reminderTime.trim(),
          serviceType,
          description: description.trim(),
        });
        if (updated) {
          onSuccess?.(updated);
        }
      } else {
        const created = await MaintenanceScheduleService.criarAgendamento({
          vehicleId: vehicle.id,
          date: date.trim(),
          reminderTime: reminderTime.trim(),
          serviceType,
          description: description.trim(),
        });
        onSuccess?.(created);
      }
      onClose();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Falha ao salvar agendamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!scheduleToEdit) return;
    Alert.alert(
      'Cancelar Agendamento',
      'Deseja cancelar este agendamento? O lembrete futuro será cancelado.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, Cancelar',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              const updated = await MaintenanceScheduleService.cancelarAgendamento(
                scheduleToEdit.id
              );
              if (updated) {
                onSuccess?.(updated);
              }
              onClose();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Falha ao cancelar.');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!scheduleToEdit) return;
    Alert.alert(
      'Excluir Agendamento',
      'Tem certeza que deseja excluir permanentemente este agendamento?',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await MaintenanceScheduleService.excluirAgendamento(scheduleToEdit.id);
              onClose();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Falha ao excluir.');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isEditing ? 'Editar Agendamento' : 'Agendar Manutenção'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Icon name="X" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Service Type */}
            <Text style={styles.label}>Tipo de Serviço</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.serviceTypesContainer}>
              {SERVICE_TYPE_OPTIONS.map(opt => {
                const isSelected = serviceType === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.serviceTypeChip, isSelected && styles.serviceTypeChipSelected]}
                    onPress={() => setServiceType(opt.key)}
                  >
                    <Icon
                      name={opt.icon}
                      size={15}
                      color={isSelected ? colors.black : colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.serviceTypeLabel,
                        isSelected && styles.serviceTypeLabelSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Date & Reminder Time */}
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1, marginRight: spacing.sm }]}>
                <Text style={styles.label}>Data (AAAA-MM-DD) *</Text>
                <TextInput
                  style={[styles.input, errors.date ? styles.inputError : null]}
                  value={date}
                  onChangeText={setDate}
                  placeholder="2026-12-10"
                  placeholderTextColor={colors.textSecondary}
                />
                {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
              </View>

              <View style={[styles.field, { flex: 1, marginLeft: spacing.sm }]}>
                <Text style={styles.label}>Lembrete (HH:mm) *</Text>
                <TextInput
                  style={[styles.input, errors.reminderTime ? styles.inputError : null]}
                  value={reminderTime}
                  onChangeText={setReminderTime}
                  placeholder="09:00"
                  placeholderTextColor={colors.textSecondary}
                />
                {errors.reminderTime && (
                  <Text style={styles.errorText}>{errors.reminderTime}</Text>
                )}
              </View>
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.label}>Descrição / Itens a Revisar *</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  errors.description ? styles.inputError : null,
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder="Ex.: Troca de óleo 5W30 e filtro de cabine"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
              {errors.description && (
                <Text style={styles.errorText}>{errors.description}</Text>
              )}
            </View>

            {/* Additional actions for edit */}
            {isEditing && (
              <View style={styles.editActionsContainer}>
                {scheduleToEdit.status === 'agendado' && (
                  <TouchableOpacity
                    style={styles.cancelScheduleButton}
                    onPress={handleCancel}
                  >
                    <Text style={styles.cancelScheduleText}>Cancelar Agendamento</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.deleteScheduleButton}
                  onPress={handleDelete}
                >
                  <Text style={styles.deleteScheduleText}>Excluir Registro</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.buttonSecondary} onPress={onClose} disabled={isSubmitting}>
              <Text style={styles.buttonSecondaryText}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.buttonPrimary, isSubmitting && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.buttonPrimaryText}>
                  {isEditing ? 'Salvar Alterações' : 'Confirmar Agendamento'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.surface,
    borderTopRightRadius: radius.surface,
    maxHeight: '90%',
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.titleLarge,
    color: colors.textPrimary,
  },
  closeButton: {
    fontSize: 20,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  label: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  field: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.bodyMedium,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.xs,
  },
  serviceTypesContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  serviceTypeChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    minWidth: 70,
  },
  serviceTypeChipSelected: {
    borderColor: colors.lime,
    backgroundColor: 'rgba(218, 255, 0, 0.08)',
  },
  serviceTypeIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  serviceTypeLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  serviceTypeLabelSelected: {
    color: colors.lime,
    fontWeight: 'bold',
  },
  editActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  cancelScheduleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.amber,
    alignItems: 'center',
  },
  cancelScheduleText: {
    ...typography.labelMedium,
    color: colors.amber,
  },
  deleteScheduleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
  },
  deleteScheduleText: {
    ...typography.labelMedium,
    color: colors.error,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  buttonSecondary: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  buttonSecondaryText: {
    ...typography.labelLarge,
    color: colors.textSecondary,
  },
  buttonPrimary: {
    flex: 2,
    backgroundColor: colors.lime,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPrimaryText: {
    ...typography.labelLarge,
    color: colors.background,
    fontWeight: 'bold',
  },
});
