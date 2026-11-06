import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { colors, spacing, radius, typography } from '../theme';
import { MobileFipeService } from '../services/mobileFipeService';
import { calcularDepreciacao } from '../services/fipeDepreciation';
import { formatCurrency } from '../utils/formatters';
import {
  FipeBrand,
  FipeModel,
  FipeYear,
  FipeConsultation,
  FipeDepreciationResult,
} from '@autogest/shared-types';

interface VehicleMarketValueScreenProps {
  onClose: () => void;
}

export const VehicleMarketValueScreen: React.FC<VehicleMarketValueScreenProps> = ({ onClose }) => {
  const { selectedVehicle } = useAppStore();

  const [loadingCascade, setLoadingCascade] = useState(false);
  const [consulting, setConsulting] = useState(false);

  // Histórico e depreciação
  const [consultas, setConsultas] = useState<FipeConsultation[]>([]);
  const [ultimaConsulta, setUltimaConsulta] = useState<FipeConsultation | null>(null);
  const [depreciacao, setDepreciacao] = useState<FipeDepreciationResult | null>(null);

  // Cascata de seleção (Marca -> Modelo -> Ano)
  const [marcas, setMarcas] = useState<FipeBrand[]>([]);
  const [modelos, setModelos] = useState<FipeModel[]>([]);
  const [anos, setAnos] = useState<FipeYear[]>([]);

  const [selectedMarca, setSelectedMarca] = useState<string>('');
  const [selectedModelo, setSelectedModelo] = useState<string>('');
  const [selectedAno, setSelectedAno] = useState<string>('');

  useEffect(() => {
    loadVehicleData();
    loadMarcas();
  }, [selectedVehicle?.id]);

  const loadVehicleData = async () => {
    if (!selectedVehicle?.id) return;
    try {
      const { consultas: list, ultimaConsulta: latest } = await MobileFipeService.obterHistorico(
        selectedVehicle.id
      );
      setConsultas(list);
      setUltimaConsulta(latest);
      setDepreciacao(calcularDepreciacao(list));

      // Se o veículo já possui marca/modelo/ano vinculados
      if ((selectedVehicle as any).fipe_codigo_marca) {
        setSelectedMarca((selectedVehicle as any).fipe_codigo_marca);
      }
      if ((selectedVehicle as any).fipe_codigo_modelo) {
        setSelectedModelo((selectedVehicle as any).fipe_codigo_modelo);
      }
      if ((selectedVehicle as any).fipe_codigo_ano) {
        setSelectedAno((selectedVehicle as any).fipe_codigo_ano);
      }
    } catch (e) {
      console.error('Erro ao carregar dados locais FIPE:', e);
    }
  };

  const loadMarcas = async () => {
    try {
      setLoadingCascade(true);
      const list = await MobileFipeService.listarMarcas();
      setMarcas(list);
    } catch (e) {
      // Offline ou erro no provedor
      console.warn('Não foi possível buscar marcas FIPE online:', e);
    } finally {
      setLoadingCascade(false);
    }
  };

  const handleSelectMarca = async (codigo: string) => {
    setSelectedMarca(codigo);
    setSelectedModelo('');
    setSelectedAno('');
    setModelos([]);
    setAnos([]);

    try {
      setLoadingCascade(true);
      const list = await MobileFipeService.listarModelos(codigo);
      setModelos(list);
    } catch {
      Alert.alert('Aviso', 'Não foi possível carregar modelos para esta marca.');
    } finally {
      setLoadingCascade(false);
    }
  };

  const handleSelectModelo = async (codigo: string) => {
    setSelectedModelo(codigo);
    setSelectedAno('');
    setAnos([]);

    try {
      setLoadingCascade(true);
      const list = await MobileFipeService.listarAnos(selectedMarca, codigo);
      setAnos(list);
    } catch {
      Alert.alert('Aviso', 'Não foi possível carregar anos para este modelo.');
    } finally {
      setLoadingCascade(false);
    }
  };

  const handleConsultarAgora = async () => {
    if (!selectedVehicle?.id) return;
    if (!selectedMarca || !selectedModelo || !selectedAno) {
      Alert.alert('Campos incompletos', 'Selecione a marca, modelo e ano do veículo para consultar.');
      return;
    }

    setConsulting(true);
    try {
      const { quote } = await MobileFipeService.consultarEAtualizarVeiculo({
        vehicleId: selectedVehicle.id,
        marcaCodigo: selectedMarca,
        modeloCodigo: selectedModelo,
        anoCodigo: selectedAno,
      });

      Alert.alert(
        'Valor FIPE Atualizado!',
        `Cotação: ${quote.valorFormatado}\nMês de Referência: ${quote.mesReferenciaTexto}`
      );

      await loadVehicleData();
    } catch (err: any) {
      Alert.alert(
        'Erro na Consulta',
        err.response?.data?.message || err.message || 'Serviço da Tabela FIPE temporariamente indisponível.'
      );
    } finally {
      setConsulting(false);
    }
  };

  const formatReaisFromCentavos = (centavos: number) => {
    return formatCurrency(centavos / 100);
  };

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
        <Text style={styles.headerTitle}>Valor de Mercado (FIPE)</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Veículo Ativo */}
        <View style={styles.vehicleCard}>
          <Text style={styles.vehicleLabel}>Veículo Ativo</Text>
          <Text style={styles.vehicleTitle}>
            {selectedVehicle ? `${selectedVehicle.model} (${selectedVehicle.plate})` : 'Nenhum'}
          </Text>
        </View>

        {/* Card do Valor Atual / Mês de Referência */}
        {ultimaConsulta ? (
          <View style={styles.valueCard}>
            <Text style={styles.valueCardEyebrow}>COTAÇÃO DE MERCADO ATUAL</Text>
            <Text style={styles.valueMain}>
              {formatReaisFromCentavos(ultimaConsulta.valueCentavos)}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                Mês de Referência:{' '}
                <Text style={styles.metaHighlight}>{ultimaConsulta.referenceMonth}</Text>
              </Text>
              <Text style={styles.metaText}>
                Código FIPE:{' '}
                <Text style={styles.metaHighlight}>{ultimaConsulta.fipeCode}</Text>
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.noValueBox}>
            <Text style={styles.noValueText}>
              Nenhuma cotação da Tabela FIPE vinculada a este veículo ainda.
            </Text>
          </View>
        )}

        {/* Resumo de Depreciação (US18.7) */}
        {depreciacao && (
          <View style={styles.depreciationCard}>
            <Text style={styles.sectionTitle}>📉 Acompanhamento de Depreciação</Text>
            <View style={styles.depreciationGrid}>
              <View style={styles.depreciationItem}>
                <Text style={styles.depLabel}>Valor Inicial</Text>
                <Text style={styles.depValue}>
                  {formatReaisFromCentavos(depreciacao.valorInicialCentavos)}
                </Text>
              </View>
              <View style={styles.depreciationItem}>
                <Text style={styles.depLabel}>Valor Atual</Text>
                <Text style={styles.depValue}>
                  {formatReaisFromCentavos(depreciacao.valorAtualCentavos)}
                </Text>
              </View>
              <View style={styles.depreciationItem}>
                <Text style={styles.depLabel}>Variação (R$)</Text>
                <Text
                  style={[
                    styles.depValue,
                    { color: depreciacao.variacaoReais < 0 ? colors.amber : colors.lime },
                  ]}
                >
                  {formatCurrency(depreciacao.variacaoReais)}
                </Text>
              </View>
              <View style={styles.depreciationItem}>
                <Text style={styles.depLabel}>Variação (%)</Text>
                <Text
                  style={[
                    styles.depValue,
                    { color: depreciacao.variacaoPercentual < 0 ? colors.amber : colors.lime },
                  ]}
                >
                  {depreciacao.variacaoPercentual > 0 ? '+' : ''}
                  {depreciacao.variacaoPercentual}%
                </Text>
              </View>
            </View>

            {depreciacao.variacaoAnualizadaPercentual !== null && (
              <View style={styles.annualizedBox}>
                <Text style={styles.annualizedText}>
                  Depreciação anualizada ({depreciacao.diasDecorridos} dias):{' '}
                  <Text style={styles.annualizedHighlight}>
                    {depreciacao.variacaoAnualizadaPercentual}% ao ano
                  </Text>
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Seleção em Cascata (Marca -> Modelo -> Ano) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🔍 Vincular Modelo FIPE em Cascata</Text>
          <Text style={styles.sectionSub}>
            Selecione a marca, o modelo e o ano correspondente na Tabela FIPE oficial.
          </Text>

          {loadingCascade && (
            <ActivityIndicator size="small" color={colors.lime} style={{ marginVertical: 8 }} />
          )}

          {/* 1. Marcas */}
          <Text style={styles.fieldLabel}>1. Marca</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {marcas.slice(0, 30).map(m => (
              <TouchableOpacity
                key={m.codigo}
                style={[styles.chip, selectedMarca === m.codigo && styles.chipSelected]}
                onPress={() => handleSelectMarca(m.codigo)}
              >
                <Text style={[styles.chipText, selectedMarca === m.codigo && styles.chipTextSelected]}>
                  {m.nome}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 2. Modelos */}
          {modelos.length > 0 && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>2. Modelo</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {modelos.slice(0, 30).map(mod => (
                  <TouchableOpacity
                    key={mod.codigo}
                    style={[styles.chip, selectedModelo === mod.codigo && styles.chipSelected]}
                    onPress={() => handleSelectModelo(mod.codigo)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedModelo === mod.codigo && styles.chipTextSelected,
                      ]}
                    >
                      {mod.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* 3. Anos */}
          {anos.length > 0 && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>3. Ano / Combustível</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {anos.map(a => (
                  <TouchableOpacity
                    key={a.codigo}
                    style={[styles.chip, selectedAno === a.codigo && styles.chipSelected]}
                    onPress={() => setSelectedAno(a.codigo)}
                  >
                    <Text style={[styles.chipText, selectedAno === a.codigo && styles.chipTextSelected]}>
                      {a.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Botão Consultar Valor Agora */}
          <TouchableOpacity
            style={[
              styles.consultButton,
              (!selectedAno || consulting) && styles.consultButtonDisabled,
            ]}
            onPress={handleConsultarAgora}
            disabled={!selectedAno || consulting}
            activeOpacity={0.8}
          >
            {consulting ? (
              <ActivityIndicator size="small" color={colors.black} />
            ) : (
              <Text style={styles.consultButtonText}>Consultar Valor Agora</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Histórico de Consultas Salvas (US18.6) */}
        {consultas.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📋 Histórico Mensal de Cotações</Text>
            {consultas.map((c, i) => (
              <View key={c.id || i} style={styles.historyRow}>
                <View>
                  <Text style={styles.historyMonth}>{c.referenceMonth}</Text>
                  <Text style={styles.historyModel} numberOfLines={1}>
                    {c.model} ({c.modelYear})
                  </Text>
                </View>
                <Text style={styles.historyValue}>{formatReaisFromCentavos(c.valueCentavos)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  vehicleCard: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vehicleLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  vehicleTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.lime,
  },
  valueCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  valueCardEyebrow: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  valueMain: {
    ...typography.h2,
    color: colors.lime,
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  metaHighlight: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  noValueBox: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  noValueText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  depreciationCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  depreciationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  depreciationItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  depLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
    fontSize: 11,
  },
  depValue: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  annualizedBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  annualizedText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  annualizedHighlight: {
    color: colors.lime,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  chipsScroll: {
    marginBottom: spacing.xs,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 6,
  },
  chipSelected: {
    borderColor: colors.lime,
    backgroundColor: colors.limeDim,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.lime,
    fontWeight: '700',
  },
  consultButton: {
    height: 48,
    backgroundColor: colors.lime,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  consultButtonDisabled: {
    opacity: 0.5,
    backgroundColor: colors.surface,
  },
  consultButtonText: {
    ...typography.button,
    color: colors.black,
    fontWeight: '700',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyMonth: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historyModel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    maxWidth: 200,
  },
  historyValue: {
    ...typography.body,
    fontWeight: '700',
    color: colors.lime,
  },
});
