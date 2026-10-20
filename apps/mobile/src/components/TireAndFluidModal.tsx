import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import {
  Vehicle,
  TireRecord,
  TireRecordType,
  FluidRecord,
  FluidType,
  FluidLevel,
} from '@autogest/shared-types';
import { TireAndFluidService } from '../services/tireAndFluidService';
import { colors, spacing, radius, typography } from '../theme';

export type TireFluidTab = 'pneu' | 'fluido';

interface TireAndFluidModalProps {
  visible: boolean;
  vehicle: Vehicle | null;
  initialTab?: TireFluidTab;
  tireToEdit?: TireRecord | null;
  fluidToEdit?: FluidRecord | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const TireAndFluidModal: React.FC<TireAndFluidModalProps> = ({
  visible,
  vehicle,
  initialTab = 'pneu',
  tireToEdit,
  fluidToEdit,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<TireFluidTab>(initialTab);
  const [date, setDate] = useState('');
  const [km, setKm] = useState('');

  // Campos de Pneu (US11.2)
  const [tireType, setTireType] = useState<TireRecordType>('calibragem');
  const [pressurePsi, setPressurePsi] = useState('32');
  const [treadDepthMm, setTreadDepthMm] = useState('');

  // Campos de Fluido (US11.3)
  const [fluidType, setFluidType] = useState<FluidType>('oleo_motor');
  const [fluidLevel, setFluidLevel] = useState<FluidLevel>('normal');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditingTire = !!tireToEdit;
  const isEditingFluid = !!fluidToEdit;

  useEffect(() => {
    if (!visible) return;
    setErrorMsg(null);

    if (tireToEdit) {
      setActiveTab('pneu');
      setDate(tireToEdit.date.split('T')[0]);
      setKm(String(tireToEdit.km));
      setTireType(tireToEdit.type);
      setPressurePsi(String(tireToEdit.pressurePsi));
      setTreadDepthMm(
        tireToEdit.treadDepthMm !== undefined && tireToEdit.treadDepthMm !== null
          ? String(tireToEdit.treadDepthMm).replace('.', ',')
          : '',
      );
    } else if (fluidToEdit) {
      setActiveTab('fluido');
      setDate(fluidToEdit.date.split('T')[0]);
      setKm(String(fluidToEdit.km));
      setFluidType(fluidToEdit.fluidType);
      setFluidLevel(fluidToEdit.level || 'normal');
    } else {
      setActiveTab(initialTab);
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setKm(vehicle ? String(vehicle.currentOdometer || vehicle.initialOdometer || '') : '');
      setTireType('calibragem');
      setPressurePsi('32');
      setTreadDepthMm('');
      setFluidType('oleo_motor');
      setFluidLevel('normal');
    }
  }, [visible, initialTab, tireToEdit, fluidToEdit, vehicle]);

  const handleSave = async () => {
    if (!vehicle) return;
    setErrorMsg(null);
    setSaving(true);

    try {
      const parsedKm = Number(km.replace(/\./g, '').replace(',', '.'));
      if (activeTab === 'pneu') {
        const parsedPsi = Number(pressurePsi.replace(',', '.'));
        const parsedSulco = treadDepthMm.trim() ? Number(treadDepthMm.replace(',', '.')) : null;

        if (isEditingTire && tireToEdit) {
          await TireAndFluidService.updateTireRecord(tireToEdit.id, {
            date,
            km: parsedKm,
            type: tireType,
            pressurePsi: parsedPsi,
            treadDepthMm: parsedSulco,
          });
        } else {
          await TireAndFluidService.createTireRecord({
            vehicleId: vehicle.id,
            date,
            km: parsedKm,
            type: tireType,
            pressurePsi: parsedPsi,
            treadDepthMm: parsedSulco,
          });
        }
      } else {
        if (isEditingFluid && fluidToEdit) {
          await TireAndFluidService.updateFluidRecord(fluidToEdit.id, {
            fluidType,
            date,
            km: parsedKm,
            level: fluidLevel,
          });
        } else {
          await TireAndFluidService.createFluidRecord({
            vehicleId: vehicle.id,
            fluidType,
            date,
            km: parsedKm,
            level: fluidLevel,
          });
        }
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao salvar registro.');
    } finally {
      setSaving(false);
    }
  };

  if (!vehicle) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>US11 • CONTROLE PREVENTIVO</Text>
              <Text style={styles.title}>
                {isEditingTire
                  ? 'Editar Registro de Pneu'
                  : isEditingFluid
                    ? 'Editar Registro de Fluido'
                    : 'Pneus & Fluidos'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {!isEditingTire && !isEditingFluid && (
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'pneu' && styles.tabBtnActive]}
                onPress={() => {
                  setActiveTab('pneu');
                  setErrorMsg(null);
                }}
              >
                <Text style={[styles.tabBtnText, activeTab === 'pneu' && styles.tabBtnTextActive]}>
                  🛞 Pneus
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'fluido' && styles.tabBtnActive]}
                onPress={() => {
                  setActiveTab('fluido');
                  setErrorMsg(null);
                }}
              >
                <Text
                  style={[styles.tabBtnText, activeTab === 'fluido' && styles.tabBtnTextActive]}
                >
                  🛢️ Fluidos
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {errorMsg && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            )}

            {activeTab === 'pneu' ? (
              <>
                <Text style={styles.label}>Operação de Pneu</Text>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={[
                      styles.choiceChip,
                      tireType === 'calibragem' && styles.choiceChipActive,
                    ]}
                    onPress={() => setTireType('calibragem')}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        tireType === 'calibragem' && styles.choiceChipTextActive,
                      ]}
                    >
                      💨 Calibragem
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.choiceChip, tireType === 'troca' && styles.choiceChipActive]}
                    onPress={() => setTireType('troca')}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        tireType === 'troca' && styles.choiceChipTextActive,
                      ]}
                    >
                      🛞 Troca de Pneu
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.label}>Pressão (PSI) *</Text>
                    <TextInput
                      style={styles.input}
                      value={pressurePsi}
                      onChangeText={setPressurePsi}
                      keyboardType="decimal-pad"
                      placeholder="Ex: 32"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.label}>Sulco em mm (opcional)</Text>
                    <TextInput
                      style={styles.input}
                      value={treadDepthMm}
                      onChangeText={setTreadDepthMm}
                      keyboardType="decimal-pad"
                      placeholder="Ex: 5,5"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.label}>
                      {tireType === 'troca' ? 'Km da Troca *' : 'Odômetro (km) *'}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={km}
                      onChangeText={setKm}
                      keyboardType="numeric"
                      placeholder="Ex: 45000"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.label}>Data (AAAA-MM-DD) *</Text>
                    <TextInput
                      style={styles.input}
                      value={date}
                      onChangeText={setDate}
                      placeholder="2026-06-15"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.label}>Tipo de Fluido *</Text>
                <View style={styles.chipRow}>
                  {(
                    [
                      { key: 'oleo_motor', label: '🛢️ Óleo do Motor' },
                      { key: 'freio', label: '🛑 Fluido de Freio' },
                      { key: 'radiador', label: '💧 Água do Radiador' },
                    ] as Array<{ key: FluidType; label: string }>
                  ).map(opt => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.choiceChip, fluidType === opt.key && styles.choiceChipActive]}
                      onPress={() => setFluidType(opt.key)}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          fluidType === opt.key && styles.choiceChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Nível do Fluido (opcional)</Text>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={[styles.choiceChip, fluidLevel === 'normal' && styles.choiceChipActive]}
                    onPress={() => setFluidLevel('normal')}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        fluidLevel === 'normal' && styles.choiceChipTextActive,
                      ]}
                    >
                      ✅ Nível Normal
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.choiceChip, fluidLevel === 'baixo' && styles.choiceChipWarning]}
                    onPress={() => setFluidLevel('baixo')}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        fluidLevel === 'baixo' && styles.choiceChipWarningText,
                      ]}
                    >
                      ⚠️ Nível Baixo
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.label}>Quilometragem (km) *</Text>
                    <TextInput
                      style={styles.input}
                      value={km}
                      onChangeText={setKm}
                      keyboardType="numeric"
                      placeholder="Ex: 45000"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.label}>Data (AAAA-MM-DD) *</Text>
                    <TextInput
                      style={styles.input}
                      value={date}
                      onChangeText={setDate}
                      placeholder="2026-06-15"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
              </>
            )}

            <View style={styles.footer}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.saveBtnText}>Salvar Registro</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 13, 16, 0.82)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.surface,
    borderTopRightRadius: radius.surface,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.lime,
    letterSpacing: 1,
    marginBottom: 2,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceRaised,
    padding: 4,
    borderRadius: radius.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabBtnActive: {
    backgroundColor: colors.lime,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabBtnTextActive: {
    color: colors.background,
    fontWeight: '700',
  },
  body: {
    paddingBottom: spacing.lg,
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 77, 79, 0.14)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '500',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  choiceChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceChipActive: {
    backgroundColor: 'rgba(200, 241, 53, 0.15)',
    borderColor: colors.lime,
  },
  choiceChipWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderColor: colors.amber,
  },
  choiceChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  choiceChipTextActive: {
    color: colors.lime,
    fontWeight: '700',
  },
  choiceChipWarningText: {
    color: colors.amber,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  col: {
    flex: 1,
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '700',
  },
});
