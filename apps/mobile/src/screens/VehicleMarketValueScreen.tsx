import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { colors, spacing, radius, typography } from '../theme';
import { MobileFipeService } from '../services/mobileFipeService';
import { calcularDepreciacao } from '../services/fipeDepreciation';
import { formatCurrency, formatMonth } from '../utils/formatters';
import { Icon } from '../components/Icon';
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

  // Busca textual para marcas e modelos
  const [searchMarca, setSearchMarca] = useState<string>('');
  const [searchModelo, setSearchModelo] = useState<string>('');

  const filteredMarcas = useMemo(() => {
    if (!searchMarca.trim()) return marcas;
    const q = searchMarca.trim().toLowerCase();
    return marcas.filter(m => m.nome.toLowerCase().includes(q));
  }, [marcas, searchMarca]);

  const filteredModelos = useMemo(() => {
    if (!searchModelo.trim()) return modelos;
    const q = searchModelo.trim().toLowerCase();
    return modelos.filter(m => m.nome.toLowerCase().includes(q));
  }, [modelos, searchModelo]);

  const selectedMarcaObj = useMemo(() => {
    return marcas.find(m => m.codigo === selectedMarca);
  }, [marcas, selectedMarca]);

  const selectedModeloObj = useMemo(() => {
    return modelos.find(m => m.codigo === selectedModelo);
  }, [modelos, selectedModelo]);

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
          <Icon name="X" size={18} color={colors.textPrimary} />
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
                <Text style={styles.metaHighlight}>{formatMonth(ultimaConsulta.referenceMonth)}</Text>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Icon name="TrendingDown" size={16} color={colors.lime} />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Acompanhamento de Depreciação</Text>
            </View>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Icon name="Search" size={16} color={colors.lime} />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Vincular Modelo FIPE em Cascata</Text>
          </View>
          <Text style={styles.sectionSub}>
            Selecione a marca, o modelo e o ano correspondente na Tabela FIPE oficial.
          </Text>

          {loadingCascade && (
            <ActivityIndicator size="small" color={colors.lime} style={{ marginVertical: 8 }} />
          )}

          {/* 1. Seleção de Marca */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={styles.fieldLabel}>1. Marca</Text>
            {marcas.length > 0 && (
              <Text style={{ fontSize: 11, color: colors.lime }}>
                {filteredMarcas.length} {filteredMarcas.length === 1 ? 'marca' : 'marcas'}
              </Text>
            )}
          </View>

          {selectedMarcaObj ? (
            <View style={styles.selectedItemCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedItemLabel}>MARCA SELECIONADA</Text>
                <Text style={styles.selectedItemName}>{selectedMarcaObj.nome}</Text>
              </View>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={() => {
                  setSelectedMarca('');
                  setSelectedModelo('');
                  setSelectedAno('');
                  setModelos([]);
                  setAnos([]);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.changeButtonText}>Trocar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.searchInputRow}>
                <Icon name="Search" size={14} color={colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  value={searchMarca}
                  onChangeText={setSearchMarca}
                  placeholder="Buscar marca (ex: Toyota, Honda, Fiat, BMW...)"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                />
                {searchMarca.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchMarca('')}>
                    <Icon name="X" size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {filteredMarcas.length === 0 && !loadingCascade ? (
                <View style={{ paddingVertical: 12, alignItems: 'flex-start' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
                    {searchMarca ? `Nenhuma marca encontrada para "${searchMarca}".` : 'Nenhuma marca disponível no momento.'}
                  </Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => {
                      setSearchMarca('');
                      loadMarcas();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: colors.lime, fontSize: 12, fontWeight: '700' }}>
                      🔄 Limpar busca / Recarregar
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView
                  nestedScrollEnabled
                  style={styles.selectionScrollContainer}
                  showsVerticalScrollIndicator={true}
                >
                  <View style={styles.chipsWrap}>
                    {filteredMarcas.map(m => (
                      <TouchableOpacity
                        key={m.codigo}
                        style={[styles.chip, selectedMarca === m.codigo && styles.chipSelected]}
                        onPress={() => handleSelectMarca(m.codigo)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, selectedMarca === m.codigo && styles.chipTextSelected]}>
                          {m.nome}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}
            </>
          )}

          {/* 2. Seleção de Modelo */}
          {selectedMarca !== '' && (
            <View style={{ marginTop: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={styles.fieldLabel}>2. Modelo</Text>
                {modelos.length > 0 && (
                  <Text style={{ fontSize: 11, color: colors.lime }}>
                    {filteredModelos.length} {filteredModelos.length === 1 ? 'modelo' : 'modelos'}
                  </Text>
                )}
              </View>

              {selectedModeloObj ? (
                <View style={styles.selectedItemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedItemLabel}>MODELO SELECIONADO</Text>
                    <Text style={styles.selectedItemName}>{selectedModeloObj.nome}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.changeButton}
                    onPress={() => {
                      setSelectedModelo('');
                      setSelectedAno('');
                      setAnos([]);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.changeButtonText}>Trocar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.searchInputRow}>
                    <Icon name="Search" size={14} color={colors.textSecondary} />
                    <TextInput
                      style={styles.searchInput}
                      value={searchModelo}
                      onChangeText={setSearchModelo}
                      placeholder={`Buscar modelo de ${selectedMarcaObj?.nome || 'marca'}...`}
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                    />
                    {searchModelo.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchModelo('')}>
                        <Icon name="X" size={14} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {modelos.length === 0 && loadingCascade ? (
                    <ActivityIndicator size="small" color={colors.lime} style={{ marginVertical: 12 }} />
                  ) : filteredModelos.length === 0 ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginVertical: 8 }}>
                      Nenhum modelo encontrado para "{searchModelo}".
                    </Text>
                  ) : (
                    <ScrollView
                      nestedScrollEnabled
                      style={styles.modelsListContainer}
                      showsVerticalScrollIndicator={true}
                    >
                      {filteredModelos.map(mod => (
                        <TouchableOpacity
                          key={mod.codigo}
                          style={[styles.modelListItem, selectedModelo === mod.codigo && styles.modelListItemSelected]}
                          onPress={() => handleSelectModelo(mod.codigo)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.modelListItemText,
                              selectedModelo === mod.codigo && styles.modelListItemTextSelected,
                            ]}
                          >
                            {mod.nome}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </>
              )}
            </View>
          )}

          {/* 3. Seleção de Ano */}
          {selectedModelo !== '' && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.fieldLabel}>3. Ano / Combustível</Text>
              {anos.length === 0 && loadingCascade ? (
                <ActivityIndicator size="small" color={colors.lime} style={{ marginVertical: 12 }} />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {anos.map(a => (
                    <TouchableOpacity
                      key={a.codigo}
                      style={[styles.chip, selectedAno === a.codigo && styles.chipSelected]}
                      onPress={() => setSelectedAno(a.codigo)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, selectedAno === a.codigo && styles.chipTextSelected]}>
                        {a.nome}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Icon name="FileText" size={16} color={colors.lime} />
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Histórico Mensal de Cotações</Text>
            </View>
            {consultas.map((c, i) => (
              <View key={c.id || i} style={styles.historyRow}>
                <View>
                  <Text style={styles.historyMonth}>{formatMonth(c.referenceMonth)}</Text>
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
  selectedItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  selectedItemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  selectedItemName: {
    ...typography.body,
    fontWeight: '700',
    color: colors.lime,
  },
  changeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  changeButtonText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 11,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    height: 42,
    marginBottom: spacing.xs,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    paddingVertical: 0,
  },
  selectionScrollContainer: {
    maxHeight: 180,
    marginBottom: spacing.xs,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 4,
  },
  modelsListContainer: {
    maxHeight: 220,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  modelListItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modelListItemSelected: {
    backgroundColor: colors.limeDim,
  },
  modelListItemText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontSize: 13,
  },
  modelListItemTextSelected: {
    color: colors.lime,
    fontWeight: '700',
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
