import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Vehicle, FuelType } from '@autogest/shared-types';
import { VehicleService } from '../services/vehicleService';
import { validateVehicleForm } from '../services/vehicleValidation';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from './Icon';

interface VehicleFormModalProps {
  visible: boolean;
  vehicleToEdit?: Vehicle | null;
  onClose: () => void;
  onSuccess: (vehicle: Vehicle) => void;
}

const FUEL_OPTIONS: FuelType[] = ['Gasolina', 'Etanol', 'Flex', 'Diesel', 'GNV'];

export const VehicleFormModal: React.FC<VehicleFormModalProps> = ({
  visible,
  vehicleToEdit,
  onClose,
  onSuccess,
}) => {
  const isEditing = !!vehicleToEdit;

  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [tankCapacityL, setTankCapacityL] = useState('');
  const [preferredFuel, setPreferredFuel] = useState<FuelType>('Gasolina');
  const [initialOdometer, setInitialOdometer] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handlePlateChange = (text: string) => {
    const raw = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw.length <= 4) {
      setPlate(raw);
    } else {
      const isMercosul = /^[A-Z]{3}[0-9][A-Z]/.test(raw);
      if (isMercosul) {
        setPlate(raw.slice(0, 7));
      } else {
        setPlate(`${raw.slice(0, 3)}-${raw.slice(3, 7)}`);
      }
    }
  };

  useEffect(() => {
    if (vehicleToEdit) {
      setPlate(vehicleToEdit.plate || '');
      setModel(vehicleToEdit.model || '');
      setBrand(vehicleToEdit.brand || '');
      setName(vehicleToEdit.name || '');
      setYear(String(vehicleToEdit.year || ''));
      setTankCapacityL(String(vehicleToEdit.tankCapacityL || ''));
      setPreferredFuel(vehicleToEdit.preferredFuel || vehicleToEdit.fuelType || 'Gasolina');
      setInitialOdometer(String(vehicleToEdit.initialOdometer ?? ''));
    } else {
      setPlate('');
      setModel('');
      setBrand('');
      setName('');
      setYear(String(new Date().getFullYear()));
      setTankCapacityL('50');
      setPreferredFuel('Flex');
      setInitialOdometer('');
    }
    setErrors({});
    setApiError(null);
  }, [vehicleToEdit, visible]);

  const handleSubmit = async () => {
    setApiError(null);

    const validation = validateVehicleForm({
      plate,
      model,
      year,
      tankCapacityL,
      preferredFuel,
      name,
      brand,
      initialOdometer,
    });

    if (!validation.isValid || !validation.data) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      if (isEditing && vehicleToEdit) {
        const updated = await VehicleService.updateVehicle(vehicleToEdit.id, {
          plate: validation.data.plate,
          model: validation.data.model,
          year: validation.data.year,
          tankCapacityL: validation.data.tankCapacityL,
          preferredFuel: validation.data.preferredFuel,
          fuelType: validation.data.preferredFuel,
          name: validation.data.name,
          brand: validation.data.brand,
        });
        onSuccess(updated);
      } else {
        const created = await VehicleService.createVehicle({
          plate: validation.data.plate,
          model: validation.data.model,
          year: validation.data.year,
          tankCapacityL: validation.data.tankCapacityL,
          preferredFuel: validation.data.preferredFuel,
          fuelType: validation.data.preferredFuel,
          name: validation.data.name,
          brand: validation.data.brand,
          initialOdometer: validation.data.initialOdometer,
        });
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      setApiError(err.message || 'Falha ao salvar veículo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEditing ? 'Editar Veículo' : 'Novo Veículo'}</Text>
            <TouchableOpacity onPress={onClose} disabled={isSubmitting}>
              <Icon name="X" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {apiError && (
              <View style={styles.apiErrorBanner}>
                <Text style={styles.apiErrorText}>{apiError}</Text>
              </View>
            )}

            {/* Placa */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Placa <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.plate ? styles.inputError : null]}
                placeholder="Ex: ABC-1234 ou BRA2E19"
                placeholderTextColor={colors.textMuted}
                value={plate}
                onChangeText={handlePlateChange}
                autoCapitalize="characters"
                maxLength={8}
                editable={!isSubmitting}
              />
              {errors.plate && <Text style={styles.errorText}>{errors.plate}</Text>}
            </View>

            {/* Modelo */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Modelo <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.model ? styles.inputError : null]}
                placeholder="Ex: Civic Touring, Gol 1.0"
                placeholderTextColor={colors.textMuted}
                value={model}
                onChangeText={setModel}
                editable={!isSubmitting}
              />
              {errors.model && <Text style={styles.errorText}>{errors.model}</Text>}
            </View>

            {/* Linha dupla: Ano e Capacidade do Tanque */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: spacing.sm }]}>
                <Text style={styles.label}>
                  Ano <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.year ? styles.inputError : null]}
                  placeholder="Ex: 2020"
                  placeholderTextColor={colors.textMuted}
                  value={year}
                  onChangeText={setYear}
                  keyboardType="numeric"
                  maxLength={4}
                  editable={!isSubmitting}
                />
                {errors.year && <Text style={styles.errorText}>{errors.year}</Text>}
              </View>

              <View style={[styles.fieldGroup, { flex: 1, marginLeft: spacing.sm }]}>
                <Text style={styles.label}>
                  Tanque (L) <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.tankCapacityL ? styles.inputError : null]}
                  placeholder="Ex: 50 ou 50,5"
                  placeholderTextColor={colors.textMuted}
                  value={tankCapacityL}
                  onChangeText={setTankCapacityL}
                  keyboardType="decimal-pad"
                  editable={!isSubmitting}
                />
                {errors.tankCapacityL && (
                  <Text style={styles.errorText}>{errors.tankCapacityL}</Text>
                )}
              </View>
            </View>

            {/* Combustível Preferencial */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Combustível Preferencial <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={styles.chipRow}>
                {FUEL_OPTIONS.map(fuel => {
                  const isSelected = preferredFuel === fuel;
                  return (
                    <TouchableOpacity
                      key={fuel}
                      style={[styles.fuelChip, isSelected && styles.fuelChipSelected]}
                      onPress={() => setPreferredFuel(fuel)}
                      activeOpacity={0.7}
                      disabled={isSubmitting}
                    >
                      <Text
                        style={[styles.fuelChipText, isSelected && styles.fuelChipTextSelected]}
                      >
                        {fuel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.preferredFuel && <Text style={styles.errorText}>{errors.preferredFuel}</Text>}
            </View>

            {/* Opcionais: Marca e Apelido */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: spacing.sm }]}>
                <Text style={styles.label}>Marca</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Honda"
                  placeholderTextColor={colors.textMuted}
                  value={brand}
                  onChangeText={setBrand}
                  editable={!isSubmitting}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1, marginLeft: spacing.sm }]}>
                <Text style={styles.label}>Apelido</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Meu Carro"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  editable={!isSubmitting}
                />
              </View>
            </View>

            {/* Odômetro Inicial (Apenas na criação) */}
            {!isEditing && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Quilometragem Inicial (km)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 42000"
                  placeholderTextColor={colors.textMuted}
                  value={initialOdometer}
                  onChangeText={setInitialOdometer}
                  keyboardType="numeric"
                  editable={!isSubmitting}
                />
              </View>
            )}
          </ScrollView>

          {/* Botões de Ação */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSubmitting}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, isSubmitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : (
                <Text style={styles.saveBtnText}>
                  {isEditing ? 'Salvar Alterações' : 'Cadastrar Veículo'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: '90%',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  closeBtn: {
    color: colors.textSecondary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  formScroll: {
    marginBottom: spacing.md,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  requiredAsterisk: {
    color: colors.lime,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 15,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: 4,
  },
  apiErrorBanner: {
    backgroundColor: 'rgba(224, 90, 90, 0.15)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  apiErrorText: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 4,
  },
  fuelChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fuelChipSelected: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  fuelChipText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  fuelChipTextSelected: {
    color: colors.black,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    ...typography.bodyBold,
    color: colors.black,
  },
});
