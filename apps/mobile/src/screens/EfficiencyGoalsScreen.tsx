import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { colors, spacing, radius, typography } from '../theme';
import { EfficiencyGoalRepository } from '../repositories/EfficiencyGoalRepository';
import { RefuelRepository } from '../repositories/RefuelRepository';
import { TireRecordRepository } from '../repositories/TireRecordRepository';
import { avaliarAnomaliaConsumo } from '../services/consumptionAnomalyService';
import {
  statusDaMeta,
  perfilDeRodagem,
  recomendar,
  validarMetaConsumo,
} from '../services/efficiencyGoalService';
import { EfficiencyGoal, DrivingProfile, EcoTip } from '@autogest/shared-types';
import { formatarConsumo } from '../utils/formatters';
import catalogJson from '../assets/eco_tips_catalog.json';

interface EfficiencyGoalsScreenProps {
  onClose: () => void;
}

export const EfficiencyGoalsScreen: React.FC<EfficiencyGoalsScreenProps> = ({ onClose }) => {
  const { selectedVehicle } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goal, setGoal] = useState<EfficiencyGoal | null>(null);
  const [targetInput, setTargetInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [profile, setProfile] = useState<DrivingProfile | null>(null);
  const [recommendedTips, setRecommendedTips] = useState<EcoTip[]>([]);

  useEffect(() => {
    loadData();
  }, [selectedVehicle?.id]);

  const loadData = async () => {
    if (!selectedVehicle?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const vehicleId = selectedVehicle.id;

      const activeGoal = await EfficiencyGoalRepository.findByVehicle(vehicleId);
      setGoal(activeGoal);
      if (activeGoal) {
        setTargetInput(activeGoal.targetKml.toString());
      } else {
        setTargetInput('');
      }

      const refuels = await RefuelRepository.listByVehicle(vehicleId);
      
      // Checa anomalia no abastecimento mais recente
      let temAnomalia = false;
      if (refuels.length >= 4) {
        const sorted = [...refuels].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        const newest = sorted[0];
        const previous = sorted.slice(1);
        if (newest.calculatedKml) {
          const prevKmls = previous
            .map(r => r.calculatedKml)
            .filter((k): k is number => k != null && k > 0);
          const anomaliaResult = avaliarAnomaliaConsumo(
            prevKmls,
            newest.calculatedKml
          );
          temAnomalia = anomaliaResult.isAnomalia;
        }
      }

      // Checa atraso na calibragem de pneus (US11: sem calibragem nos últimos 15 dias)
      let calibragemAtrasada = false;
      try {
        const registrosPneu = await TireRecordRepository.listByVehicle(vehicleId, 'calibragem');
        if (registrosPneu.length === 0) {
          calibragemAtrasada = true;
        } else {
          const ultimaData = new Date(registrosPneu[0].date).getTime();
          const diasDesdeUltima = (Date.now() - ultimaData) / (1000 * 60 * 60 * 24);
          calibragemAtrasada = diasDesdeUltima > 15;
        }
      } catch {
        calibragemAtrasada = false;
      }

      const targetValue = activeGoal ? activeGoal.targetKml : null;
      const derivedProfile = perfilDeRodagem(
        refuels,
        targetValue,
        temAnomalia,
        calibragemAtrasada
      );
      setProfile(derivedProfile);

      const catalog = (catalogJson as any)?.dicas || [];
      const tips = recomendar(derivedProfile, catalog);
      setRecommendedTips(tips);
    } catch (err) {
      console.error('Erro ao carregar dados de metas e dicas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGoal = async () => {
    if (!selectedVehicle?.id) {
      Alert.alert('Erro', 'Nenhum veículo selecionado.');
      return;
    }

    const parsed = parseFloat(targetInput.replace(',', '.'));
    const validation = validarMetaConsumo(parsed);
    if (!validation.isValid) {
      setInputError(validation.error || 'Valor de meta inválido');
      return;
    }

    setInputError(null);
    setSaving(true);
    try {
      const saved = await EfficiencyGoalRepository.setGoal(selectedVehicle.id, parsed);
      setGoal(saved);
      Alert.alert('Meta salva!', `Nova meta de ${formatarConsumo(parsed)} definida com sucesso.`);
      await loadData();
    } catch (err) {
      console.error('Falha ao salvar meta:', err);
      Alert.alert('Erro', 'Não foi possível salvar a meta de eficiência.');
    } finally {
      setSaving(false);
    }
  };

  const goalStatus = statusDaMeta(
    profile?.consumoMedioKml,
    goal ? goal.targetKml : null
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Metas e Dicas</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.lime} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Seção 1: Configuração da Meta */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🎯 Meta de Consumo do Veículo</Text>
            <Text style={styles.sectionSubtitle}>
              Defina o rendimento almejado para o veículo ativo ({selectedVehicle?.name || 'Veículo'}).
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Meta de Rendimento (km/l)</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[
                    styles.textInput,
                    inputError ? styles.textInputError : undefined,
                  ]}
                  value={targetInput}
                  onChangeText={txt => {
                    setTargetInput(txt);
                    if (inputError) setInputError(null);
                  }}
                  keyboardType="numeric"
                  placeholder="Ex: 14.5"
                  placeholderTextColor={colors.textSecondary}
                  editable={!saving}
                />
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.disabledButton]}
                  onPress={handleSaveGoal}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.black} />
                  ) : (
                    <Text style={styles.saveButtonText}>Definir</Text>
                  )}
                </TouchableOpacity>
              </View>
              {inputError && <Text style={styles.errorText}>{inputError}</Text>}
            </View>

            {goal && (
              <View style={styles.statusBox}>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Meta Ativa:</Text>
                  <Text style={[styles.statusValue, { color: colors.lime }]}>
                    {formatarConsumo(goal.targetKml)}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Consumo Médio Atual:</Text>
                  <Text style={styles.statusValue}>
                    {profile?.consumoMedioKml != null
                      ? formatarConsumo(profile.consumoMedioKml)
                      : 'Sem abastecimentos'}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Progresso:</Text>
                  <Text
                    style={[
                      styles.statusValue,
                      {
                        color:
                          goalStatus.situacao === 'atingida'
                            ? colors.lime
                            : goalStatus.situacao === 'abaixo'
                              ? colors.amber
                              : colors.textSecondary,
                      },
                    ]}
                  >
                    {goalStatus.situacao === 'atingida'
                      ? `Atingida (${goalStatus.percentual}%)`
                      : goalStatus.situacao === 'abaixo'
                        ? `Abaixo (${goalStatus.percentual}%)`
                        : 'Aguardando dados'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Seção 2: Perfil de Rodagem */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🚗 Perfil de Rodagem Identificado</Text>
            <View style={styles.profileGrid}>
              <View style={styles.profileItem}>
                <Text style={styles.profileLabel}>Percurso Predominante</Text>
                <Text style={styles.profileBadge}>
                  {profile?.tipoPercursoPredominante === 'urbano'
                    ? '🏙️ Urbano'
                    : profile?.tipoPercursoPredominante === 'rodoviario'
                      ? '🛣️ Rodoviário'
                      : '🔄 Misto'}
                </Text>
              </View>

              <View style={styles.profileItem}>
                <Text style={styles.profileLabel}>Calibragem dos Pneus</Text>
                <Text
                  style={[
                    styles.profileBadge,
                    {
                      color: profile?.calibragemPneusAtrasada
                        ? colors.amber
                        : colors.lime,
                    },
                  ]}
                >
                  {profile?.calibragemPneusAtrasada ? '⚠️ Em atraso' : '✅ Em dia'}
                </Text>
              </View>

              <View style={styles.profileItem}>
                <Text style={styles.profileLabel}>Estabilidade de Consumo</Text>
                <Text
                  style={[
                    styles.profileBadge,
                    {
                      color: profile?.temAnomalia ? colors.amber : colors.textPrimary,
                    },
                  ]}
                >
                  {profile?.temAnomalia ? '⚠️ Queda detectada' : 'Normal'}
                </Text>
              </View>
            </View>
          </View>

          {/* Seção 3: Dicas Recomendadas */}
          <View style={styles.sectionCard}>
            <View style={styles.tipsHeader}>
              <Text style={styles.sectionTitle}>💡 Dicas de Eficiência</Text>
              <Text style={styles.tipsCounter}>
                {recommendedTips.length} recomendadas
              </Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Recomendações priorizadas automaticamente pelo seu perfil de direção e dados do veículo.
            </Text>

            {recommendedTips.length === 0 ? (
              <Text style={styles.noTipsText}>Nenhuma dica aplicável no momento.</Text>
            ) : (
              recommendedTips.map((tip, idx) => (
                <View key={tip.id || idx} style={styles.tipCard}>
                  <View style={styles.tipTop}>
                    <Text style={styles.tipNumber}>#{idx + 1}</Text>
                    <Text style={styles.tipCardTitle}>{tip.titulo}</Text>
                  </View>
                  <Text style={styles.tipCardDesc}>{tip.descricao}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: colors.textPrimary,
    fontSize: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: spacing.sm,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    height: 48,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    fontSize: 16,
  },
  textInputError: {
    borderColor: colors.error,
  },
  saveButton: {
    height: 48,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.lime,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    ...typography.button,
    color: colors.black,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: 4,
  },
  statusBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statusValue: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  profileGrid: {
    gap: spacing.sm,
  },
  profileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  profileLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  profileBadge: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tipsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tipsCounter: {
    ...typography.caption,
    color: colors.lime,
    fontWeight: '700',
  },
  noTipsText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  tipCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.lime,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  tipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tipNumber: {
    ...typography.caption,
    color: colors.lime,
    fontWeight: '700',
  },
  tipCardTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  tipCardDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
