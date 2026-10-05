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
  Alert,
} from 'react-native';
import { MaintenanceRule, Vehicle } from '@autogest/shared-types';
import { MaintenanceAlertService, SERVICE_TYPE_LABELS } from '../services/maintenanceAlertService';
import { colors, spacing, radius, typography } from '../theme';

interface MaintenanceRuleModalProps {
  visible: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const MaintenanceRuleModal: React.FC<MaintenanceRuleModalProps> = ({
  visible,
  vehicle,
  onClose,
  onSuccess,
}) => {
  const [rules, setRules] = useState<MaintenanceRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<MaintenanceRule | null>(null);

  // Form fields for editing rule
  const [name, setName] = useState('');
  const [intervalKm, setIntervalKm] = useState('');
  const [intervalDays, setIntervalDays] = useState('');
  const [advanceKm, setAdvanceKm] = useState('500');
  const [advanceDays, setAdvanceDays] = useState('15');
  const [lastKm, setLastKm] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && vehicle) {
      loadRules();
    } else {
      setEditingRule(null);
    }
  }, [visible, vehicle?.id]);

  const loadRules = async () => {
    if (!vehicle) return;
    setLoading(true);
    try {
      const data = await MaintenanceAlertService.listRulesByVehicle(vehicle.id);
      setRules(data);
    } catch (e) {
      console.error('Erro ao carregar regras:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRuleToEdit = (rule: MaintenanceRule) => {
    setEditingRule(rule);
    setName(rule.name || SERVICE_TYPE_LABELS[rule.serviceType] || rule.serviceType);
    setIntervalKm(rule.intervalKm ? String(rule.intervalKm) : '');
    setIntervalDays(rule.intervalDays ? String(rule.intervalDays) : '');
    setAdvanceKm(String(rule.advanceKm ?? 500));
    setAdvanceDays(String(rule.advanceDays ?? 15));
    setLastKm(rule.lastServiceKm ? String(rule.lastServiceKm) : '');
    setActive(rule.active);
  };

  const handleSaveRule = async () => {
    if (!editingRule || !vehicle) return;

    const numIntervalKm = intervalKm ? parseInt(intervalKm.replace(/\D/g, ''), 10) : null;
    const numIntervalDays = intervalDays ? parseInt(intervalDays.replace(/\D/g, ''), 10) : null;
    const numAdvanceKm = advanceKm ? parseInt(advanceKm.replace(/\D/g, ''), 10) : 500;
    const numAdvanceDays = advanceDays ? parseInt(advanceDays.replace(/\D/g, ''), 10) : 15;
    const numLastKm = lastKm ? parseInt(lastKm.replace(/\D/g, ''), 10) : null;

    if (!numIntervalKm && !numIntervalDays) {
      Alert.alert(
        'Atenção',
        'Informe pelo menos um intervalo (quilometragem ou dias) para a regra preventiva.',
      );
      return;
    }

    setSaving(true);
    try {
      await MaintenanceAlertService.updateRule(editingRule.id, {
        name: name.trim() || undefined,
        intervalKm: numIntervalKm,
        intervalDays: numIntervalDays,
        advanceKm: numAdvanceKm,
        advanceDays: numAdvanceDays,
        lastServiceKm: numLastKm,
        active,
      });

      setEditingRule(null);
      await loadRules();
      onSuccess();
    } catch (e: any) {
      Alert.alert('Erro ao salvar regra', e.message || 'Falha ao salvar regra.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Regras de Manutenção</Text>
              <Text style={styles.modalSubtitle}>
                {vehicle?.name || vehicle?.model} • Intervalos preventivos
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.lime} />
            </View>
          ) : editingRule ? (
            /* Formulário de Edição de Regra */
            <ScrollView contentContainerStyle={styles.formContainer}>
              <Text style={styles.formTitle}>Editar Regra: {editingRule.name}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome do Serviço</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.col]}>
                  <Text style={styles.label}>Intervalo em Km</Text>
                  <TextInput
                    style={styles.input}
                    value={intervalKm}
                    onChangeText={setIntervalKm}
                    keyboardType="numeric"
                    placeholder="Ex: 10000"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={[styles.inputGroup, styles.col]}>
                  <Text style={styles.label}>Intervalo em Dias</Text>
                  <TextInput
                    style={styles.input}
                    value={intervalDays}
                    onChangeText={setIntervalDays}
                    keyboardType="numeric"
                    placeholder="Ex: 180"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.col]}>
                  <Text style={styles.label}>Antecedência (Km)</Text>
                  <TextInput
                    style={styles.input}
                    value={advanceKm}
                    onChangeText={setAdvanceKm}
                    keyboardType="numeric"
                    placeholder="500"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={[styles.inputGroup, styles.col]}>
                  <Text style={styles.label}>Antecedência (Dias)</Text>
                  <TextInput
                    style={styles.input}
                    value={advanceDays}
                    onChangeText={setAdvanceDays}
                    keyboardType="numeric"
                    placeholder="15"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Último Km Realizado (Sem histórico)</Text>
                <TextInput
                  style={styles.input}
                  value={lastKm}
                  onChangeText={setLastKm}
                  keyboardType="numeric"
                  placeholder="Ex: 40000"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <TouchableOpacity
                style={styles.activeToggle}
                onPress={() => setActive(!active)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, active && styles.checkboxActive]} />
                <Text style={styles.activeToggleText}>Regra Ativa para Notificações</Text>
              </TouchableOpacity>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setEditingRule(null)}
                  disabled={saving}
                >
                  <Text style={styles.cancelBtnText}>Voltar</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveRule} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Text style={styles.saveBtnText}>Salvar Alterações</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            /* Lista de Regras do Veículo */
            <ScrollView contentContainerStyle={styles.listContainer}>
              <Text style={styles.listHint}>
                Toque em uma regra para personalizar a quilometragem ou os prazos de antecedência.
              </Text>

              {rules.map(rule => (
                <TouchableOpacity
                  key={rule.id}
                  style={styles.ruleCard}
                  onPress={() => handleSelectRuleToEdit(rule)}
                  activeOpacity={0.7}
                >
                  <View style={styles.ruleCardHeader}>
                    <Text style={styles.ruleName}>
                      {rule.name || SERVICE_TYPE_LABELS[rule.serviceType] || rule.serviceType}
                    </Text>
                    <View
                      style={[
                        styles.ruleStatusBadge,
                        rule.active ? styles.badgeActive : styles.badgeInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ruleStatusText,
                          rule.active ? styles.textActive : styles.textInactive,
                        ]}
                      >
                        {rule.active ? 'Ativa' : 'Inativa'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.ruleDetailsRow}>
                    {rule.intervalKm ? (
                      <Text style={styles.ruleDetail}>
                        🔁 A cada {rule.intervalKm.toLocaleString('pt-BR')} km
                      </Text>
                    ) : null}
                    {rule.intervalDays ? (
                      <Text style={styles.ruleDetail}>📅 A cada {rule.intervalDays} dias</Text>
                    ) : null}
                  </View>

                  <Text style={styles.ruleAdvance}>
                    Aviso: {rule.advanceKm} km ou {rule.advanceDays} dias antes
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '85%',
    padding: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
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
    ...typography.h2,
    color: colors.textPrimary,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.lime,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  listContainer: {
    paddingBottom: spacing.lg,
  },
  listHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  ruleCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ruleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  ruleName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  ruleStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeActive: {
    backgroundColor: colors.limeDim,
  },
  badgeInactive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  ruleStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textActive: {
    color: colors.lime,
  },
  textInactive: {
    color: colors.textMuted,
  },
  ruleDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginVertical: 4,
  },
  ruleDetail: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  ruleAdvance: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  formContainer: {
    paddingBottom: spacing.lg,
  },
  formTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  col: {
    flex: 1,
  },
  activeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    backgroundColor: colors.surfaceRaised,
  },
  checkboxActive: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  activeToggleText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.lime,
  },
  saveBtnText: {
    color: colors.background,
    fontWeight: '700',
  },
});
