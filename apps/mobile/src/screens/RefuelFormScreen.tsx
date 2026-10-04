import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { CameraService, GPSService, api } from '../services';
import { FuelingService } from '../services/fuelingService';
import {
  calcularConsumo,
  validarNovoKm,
  calcularValorTotal,
  calcularValorLitro,
  calcularLitros,
} from '../services/fuelingCalculations';
import { parseDecimalInput } from '../services/vehicleValidation';
import { ConfirmModal } from '../components/ConfirmModal';
import { FuelType, Refuel } from '@autogest/shared-types';
import { colors, spacing, radius, typography } from '../theme';
import { formatCurrency, formatKml } from '../utils/formatters';

const FUEL_TYPES: FuelType[] = ['Gasolina', 'Etanol', 'Flex', 'Diesel', 'GNV'];

interface RefuelFormScreenProps {
  onClose: () => void;
  refuelToEdit?: Refuel | null;
}

export const RefuelFormScreen: React.FC<RefuelFormScreenProps> = ({
  onClose,
  refuelToEdit: initialRefuelToEdit,
}) => {
  const { selectedVehicle } = useAppStore();

  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [editingRefuel, setEditingRefuel] = useState<Refuel | null>(initialRefuelToEdit || null);
  const [historyList, setHistoryList] = useState<Refuel[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [refuelToDelete, setRefuelToDelete] = useState<Refuel | null>(null);

  // Campos do formulário
  const [date, setDate] = useState('');
  const [odometer, setOdometer] = useState('');
  const [liters, setLiters] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('Gasolina');
  const [stationName, setStationName] = useState('');
  const [isFullTank, setIsFullTank] = useState(true);

  // Status e validação
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>('Buscando localização...');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Preenche dados iniciais
  useEffect(() => {
    if (editingRefuel) {
      setDate(editingRefuel.date || new Date().toISOString());
      setOdometer(String(editingRefuel.odometer || ''));
      setLiters(String(editingRefuel.liters || ''));
      setPricePerLiter(String(editingRefuel.pricePerLiter || ''));
      setTotalValue(String(editingRefuel.totalValue || ''));
      setFuelType(editingRefuel.fuelType || 'Gasolina');
      setStationName(editingRefuel.stationName || '');
      setIsFullTank(editingRefuel.isFullTank ?? true);
      setActiveTab('form');
    } else {
      resetForm();
    }
    loadHistory();
    fetchLocation();
  }, [editingRefuel, selectedVehicle]);

  const resetForm = () => {
    setEditingRefuel(null);
    setDate(new Date().toISOString());
    setOdometer('');
    setLiters('');
    setPricePerLiter('');
    setTotalValue('');
    setStationName('');
    setIsFullTank(true);
    if (selectedVehicle?.preferredFuel) {
      setFuelType(selectedVehicle.preferredFuel);
    } else {
      setFuelType('Gasolina');
    }
    setErrors({});
  };

  const loadHistory = async () => {
    if (!selectedVehicle) return;
    try {
      const list = await FuelingService.listRefuels(selectedVehicle.id);
      setHistoryList(list);
    } catch (e) {
      console.error('Erro ao carregar histórico de abastecimentos:', e);
    }
  };

  const fetchLocation = async () => {
    try {
      const location = await GPSService.getCurrentLocation();
      if (location) {
        setCoords(location);
        setGpsStatus('📍 Localização GPS capturada');
      } else {
        setCoords(null);
        setGpsStatus('📍 GPS indisponível ou negado (salvando sem coordenadas)');
      }
    } catch {
      setCoords(null);
      setGpsStatus('📍 GPS desligado');
    }
  };

  // US05.2: Cálculo bidirecional entre Litros, Valor Total e Valor/Litro
  const handleLitersChange = (val: string) => {
    setLiters(val);
    const parsedLiters = parseDecimalInput(val);
    const parsedPrice = parseDecimalInput(pricePerLiter);
    const parsedTotal = parseDecimalInput(totalValue);

    if (parsedLiters && parsedPrice && (!totalValue || !errors.totalValue)) {
      const calcTotal = calcularValorTotal(parsedLiters, parsedPrice);
      if (calcTotal !== null) setTotalValue(String(calcTotal));
    } else if (parsedLiters && parsedTotal && !pricePerLiter) {
      const calcPrice = calcularValorLitro(parsedTotal, parsedLiters);
      if (calcPrice !== null) setPricePerLiter(String(calcPrice));
    }
  };

  const handlePricePerLiterChange = (val: string) => {
    setPricePerLiter(val);
    const parsedPrice = parseDecimalInput(val);
    const parsedLiters = parseDecimalInput(liters);
    const parsedTotal = parseDecimalInput(totalValue);

    if (parsedPrice && parsedLiters) {
      const calcTotal = calcularValorTotal(parsedLiters, parsedPrice);
      if (calcTotal !== null) setTotalValue(String(calcTotal));
    } else if (parsedPrice && parsedTotal && !liters) {
      const calcLiters = calcularLitros(parsedTotal, parsedPrice);
      if (calcLiters !== null) setLiters(String(calcLiters));
    }
  };

  const handleTotalValueChange = (val: string) => {
    setTotalValue(val);
    const parsedTotal = parseDecimalInput(val);
    const parsedLiters = parseDecimalInput(liters);
    const parsedPrice = parseDecimalInput(pricePerLiter);

    if (parsedTotal && parsedLiters) {
      const calcPrice = calcularValorLitro(parsedTotal, parsedLiters);
      if (calcPrice !== null) setPricePerLiter(String(calcPrice));
    } else if (parsedTotal && parsedPrice && !liters) {
      const calcLiters = calcularLitros(parsedTotal, parsedPrice);
      if (calcLiters !== null) setLiters(String(calcLiters));
    }
  };

  // Estimativa em tempo real de consumo para feedback instantâneo ao usuário
  const parsedCurrentKm = parseDecimalInput(odometer);
  const parsedCurrentLiters = parseDecimalInput(liters);
  const lastOdo = selectedVehicle?.currentOdometer || selectedVehicle?.initialOdometer || 0;
  const previewConsumption =
    parsedCurrentKm && parsedCurrentLiters && parsedCurrentKm > lastOdo && lastOdo > 0
      ? calcularConsumo(parsedCurrentKm, lastOdo, parsedCurrentLiters)
      : null;

  // Escaneamento de comprovante via OCR
  const handleScanReceipt = async () => {
    setIsScanning(true);
    try {
      const base64 = await CameraService.captureReceiptFromCamera();
      if (base64) {
        const response = await api.post('/refuels/scan-ocr', { imageBase64: base64 });
        const data = response.data?.data;
        if (data) {
          if (data.liters) setLiters(String(data.liters));
          if (data.pricePerLiter) setPricePerLiter(String(data.pricePerLiter));
          if (data.totalValue) setTotalValue(String(data.totalValue));
          if (data.fuelType && FUEL_TYPES.includes(data.fuelType)) setFuelType(data.fuelType);
          if (data.stationName) setStationName(data.stationName);
        }
      }
    } catch {
      Alert.alert('OCR', 'Não foi possível extrair dados automaticamente da imagem.');
    } finally {
      setIsScanning(false);
    }
  };

  // Salvar abastecimento
  const handleSave = async () => {
    if (!selectedVehicle) {
      Alert.alert('Erro', 'Selecione um veículo ativo antes de abastecer.');
      return;
    }

    const newErrors: Record<string, string> = {};

    const numOdometer = parseDecimalInput(odometer);
    const numLiters = parseDecimalInput(liters);
    const numPrice = parseDecimalInput(pricePerLiter);
    const numTotal = parseDecimalInput(totalValue);

    // Validação de odômetro
    if (!numOdometer || numOdometer <= 0) {
      newErrors.odometer = 'Informe a quilometragem atual.';
    } else if (!editingRefuel) {
      // US05.3: Validação única validarNovoKm compartilhada
      const kmValidation = validarNovoKm(numOdometer, selectedVehicle.currentOdometer);
      if (!kmValidation.isValid) {
        newErrors.odometer = kmValidation.error || 'Quilometragem inválida.';
      }
    }

    // Validação de litros
    if (!numLiters || numLiters <= 0) {
      newErrors.liters = 'A quantidade de litros deve ser maior que zero.';
    }

    // Validação de preço por litro
    if (!numPrice || numPrice <= 0) {
      newErrors.pricePerLiter = 'Informe o valor por litro.';
    }

    // Validação de total
    if (!numTotal || numTotal <= 0) {
      newErrors.totalValue = 'Informe o valor total pago.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      if (editingRefuel) {
        await FuelingService.updateRefuel(editingRefuel.id, {
          odometer: numOdometer!,
          liters: numLiters!,
          pricePerLiter: numPrice!,
          totalValue: numTotal!,
          fuelType,
          stationName: stationName.trim() || null,
          isFullTank,
        });
      } else {
        await FuelingService.createRefuel(
          {
            vehicleId: selectedVehicle.id,
            date: date || new Date().toISOString(),
            odometer: numOdometer!,
            liters: numLiters!,
            pricePerLiter: numPrice!,
            totalValue: numTotal!,
            fuelType,
            stationName: stationName.trim() || null,
            isFullTank,
          },
          coords,
        );
      }

      await loadHistory();
      resetForm();
      setActiveTab('history');
    } catch (e: any) {
      Alert.alert('Erro ao Salvar', e.message || 'Falha ao registrar abastecimento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPress = (refuel: Refuel) => {
    setEditingRefuel(refuel);
    setActiveTab('form');
  };

  const handleDeletePress = (refuel: Refuel) => {
    setRefuelToDelete(refuel);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!refuelToDelete) return;
    try {
      await FuelingService.deleteRefuel(refuelToDelete.id);
      await loadHistory();
    } catch (e) {
      console.error('Erro ao excluir abastecimento:', e);
    } finally {
      setDeleteModalVisible(false);
      setRefuelToDelete(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.container}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Text style={styles.backButtonText}>✕ Fechar</Text>
          </TouchableOpacity>
          <View style={styles.tabSelector}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'form' && styles.tabBtnActive]}
              onPress={() => setActiveTab('form')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'form' && styles.tabBtnTextActive]}>
                {editingRefuel ? 'Editar' : 'Novo'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
              onPress={() => {
                setActiveTab('history');
                loadHistory();
              }}
            >
              <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>
                Histórico ({historyList.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Informação do Veículo Ativo */}
        <View style={styles.vehicleInfoBar}>
          <Text style={styles.vehicleInfoText}>
            Veículo:{' '}
            <Text style={styles.vehicleInfoHighlight}>
              {selectedVehicle ? `${selectedVehicle.model} (${selectedVehicle.plate})` : 'Nenhum'}
            </Text>
          </Text>
          {selectedVehicle && (
            <Text style={styles.vehicleKmText}>
              Último km: {selectedVehicle.currentOdometer || selectedVehicle.initialOdometer || 0}{' '}
              km
            </Text>
          )}
        </View>

        {activeTab === 'form' ? (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Botão OCR */}
            <TouchableOpacity
              style={styles.ocrButton}
              onPress={handleScanReceipt}
              disabled={isScanning || isSubmitting}
              activeOpacity={0.8}
            >
              {isScanning ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : (
                <Text style={styles.ocrButtonText}>📷 Escanear Nota / Comprovante (OCR)</Text>
              )}
            </TouchableOpacity>

            {/* Prévia de Consumo Calculado em Tempo Real */}
            {previewConsumption !== null && (
              <View style={styles.previewBox}>
                <Text style={styles.previewEyebrow}>ESTIMATIVA DE CONSUMO</Text>
                <Text style={styles.previewValue}>{previewConsumption} km/l</Text>
                <Text style={styles.previewSub}>
                  Calculado sobre os últimos {parsedCurrentKm! - lastOdo} km percorridos
                </Text>
              </View>
            )}

            {/* Odômetro Atual */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Odômetro Atual (km) <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.odometer ? styles.inputError : null]}
                keyboardType="numeric"
                value={odometer}
                onChangeText={setOdometer}
                placeholder={`Ex: ${(lastOdo || 10000) + 400}`}
                placeholderTextColor={colors.textMuted}
                editable={!isSubmitting}
              />
              {errors.odometer && <Text style={styles.errorText}>{errors.odometer}</Text>}
            </View>

            {/* Litros e Preço por Litro */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: spacing.sm }]}>
                <Text style={styles.label}>
                  Litros <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.liters ? styles.inputError : null]}
                  keyboardType="decimal-pad"
                  value={liters}
                  onChangeText={handleLitersChange}
                  placeholder="Ex: 40,5"
                  placeholderTextColor={colors.textMuted}
                  editable={!isSubmitting}
                />
                {errors.liters && <Text style={styles.errorText}>{errors.liters}</Text>}
              </View>

              <View style={[styles.fieldGroup, { flex: 1, marginLeft: spacing.sm }]}>
                <Text style={styles.label}>
                  R$ / Litro <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.pricePerLiter ? styles.inputError : null]}
                  keyboardType="decimal-pad"
                  value={pricePerLiter}
                  onChangeText={handlePricePerLiterChange}
                  placeholder="Ex: 5,89"
                  placeholderTextColor={colors.textMuted}
                  editable={!isSubmitting}
                />
                {errors.pricePerLiter && (
                  <Text style={styles.errorText}>{errors.pricePerLiter}</Text>
                )}
              </View>
            </View>

            {/* Valor Total */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Valor Total (R$) <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.totalValue ? styles.inputError : null]}
                keyboardType="decimal-pad"
                value={totalValue}
                onChangeText={handleTotalValueChange}
                placeholder="Ex: 238,55"
                placeholderTextColor={colors.textMuted}
                editable={!isSubmitting}
              />
              {errors.totalValue && <Text style={styles.errorText}>{errors.totalValue}</Text>}
            </View>

            {/* Combustível */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Tipo de Combustível</Text>
              <View style={styles.chipRow}>
                {FUEL_TYPES.map(f => {
                  const isSelected = fuelType === f;
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => setFuelType(f)}
                      disabled={isSubmitting}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {f}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Posto */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nome do Posto / Bandeira (opcional)</Text>
              <TextInput
                style={styles.input}
                value={stationName}
                onChangeText={setStationName}
                placeholder="Ex: Shell Select, Ipiranga"
                placeholderTextColor={colors.textMuted}
                editable={!isSubmitting}
              />
            </View>

            {/* Switch Tanque Cheio */}
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Tanque Cheio?</Text>
                <Text style={styles.switchSub}>
                  Necessário para cálculo fidedigno de consumo médio
                </Text>
              </View>
              <Switch
                value={isFullTank}
                onValueChange={setIsFullTank}
                trackColor={{ false: colors.surface, true: colors.lime }}
                thumbColor={isFullTank ? colors.black : colors.textSecondary}
              />
            </View>

            {/* Status GPS */}
            <View style={styles.gpsRow}>
              <Text style={styles.gpsText}>{gpsStatus}</Text>
            </View>

            {/* Botões de Ação */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  if (editingRefuel) resetForm();
                  else onClose();
                }}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>
                  {editingRefuel ? 'Cancelar Edição' : 'Cancelar'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, isSubmitting && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.black} />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingRefuel ? 'Salvar Alterações' : 'Salvar Abastecimento'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          /* Aba Histórico de Abastecimentos */
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {historyList.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryIcon}>⛽</Text>
                <Text style={styles.emptyHistoryTitle}>Nenhum abastecimento</Text>
                <Text style={styles.emptyHistoryText}>
                  Registre o primeiro abastecimento deste veículo na aba "Novo".
                </Text>
              </View>
            ) : (
              historyList.map(item => (
                <View key={item.id} style={styles.historyCard}>
                  <View style={styles.historyCardHeader}>
                    <View>
                      <Text style={styles.historyDate}>
                        {new Date(item.date).toLocaleDateString('pt-BR')} •{' '}
                        {item.odometer.toLocaleString('pt-BR')} km
                      </Text>
                      <Text style={styles.historyStation}>
                        {item.stationName || 'Posto não informado'} • {item.fuelType}
                      </Text>
                    </View>

                    {item.calculatedKml ? (
                      <View style={styles.kmlBadge}>
                        <Text style={styles.kmlBadgeText}>{formatKml(item.calculatedKml)}</Text>
                      </View>
                    ) : (
                      <View style={styles.firstBadge}>
                        <Text style={styles.firstBadgeText}>1º / Base</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.historyCardDetails}>
                    <Text style={styles.historyDetailItem}>
                      Litros: <Text style={styles.historyDetailBold}>{item.liters} L</Text>
                    </Text>
                    <Text style={styles.historyDetailItem}>
                      Preço/L:{' '}
                      <Text style={styles.historyDetailBold}>
                        R$ {item.pricePerLiter.toFixed(2)}
                      </Text>
                    </Text>
                    <Text style={styles.historyDetailItem}>
                      Total:{' '}
                      <Text style={styles.historyDetailBold}>
                        {formatCurrency(item.totalValue)}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.historyCardActions}>
                    <TouchableOpacity
                      style={styles.historyActionBtn}
                      onPress={() => handleEditPress(item)}
                    >
                      <Text style={styles.historyActionText}>✏️ Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.historyActionBtn, styles.deleteActionBtn]}
                      onPress={() => handleDeletePress(item)}
                    >
                      <Text style={[styles.historyActionText, styles.deleteActionText]}>
                        🗑️ Excluir
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}

        {/* Modal de confirmação para exclusão */}
        <ConfirmModal
          visible={deleteModalVisible}
          title="Excluir Abastecimento?"
          message={
            refuelToDelete
              ? `Tem certeza que deseja excluir o abastecimento de ${refuelToDelete.odometer.toLocaleString('pt-BR')} km (${refuelToDelete.liters} L)? O consumo do abastecimento seguinte será recalculado automaticamente.`
              : 'Deseja excluir este abastecimento?'
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setDeleteModalVisible(false);
            setRefuelToDelete(null);
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
    marginBottom: spacing.sm,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  tabBtnActive: {
    backgroundColor: colors.lime,
  },
  tabBtnText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  tabBtnTextActive: {
    color: colors.black,
  },
  vehicleInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  vehicleInfoText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  vehicleInfoHighlight: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  vehicleKmText: {
    ...typography.captionBold,
    color: colors.lime,
  },
  content: {
    flex: 1,
  },
  ocrButton: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.lime,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ocrButtonText: {
    ...typography.bodyBold,
    color: colors.lime,
  },
  previewBox: {
    backgroundColor: colors.limeDim,
    borderWidth: 1,
    borderColor: colors.lime,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  previewEyebrow: {
    ...typography.eyebrow,
    color: colors.lime,
    fontSize: 10,
  },
  previewValue: {
    ...typography.h1,
    color: colors.lime,
    marginVertical: 2,
  },
  previewSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
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
    marginBottom: 4,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 4,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  chipText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.black,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  switchLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  switchSub: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  gpsRow: {
    marginBottom: spacing.lg,
    paddingHorizontal: 4,
  },
  gpsText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    fontSize: 11,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.bodyBold,
    color: colors.black,
    fontWeight: '700',
  },
  emptyHistory: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyHistoryIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyHistoryTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptyHistoryText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  historyDate: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  historyStation: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  kmlBadge: {
    backgroundColor: colors.limeDim,
    borderWidth: 1,
    borderColor: 'rgba(198, 255, 77, 0.3)',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  kmlBadgeText: {
    ...typography.captionBold,
    color: colors.lime,
  },
  firstBadge: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  firstBadgeText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  historyCardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    marginTop: 4,
  },
  historyDetailItem: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  historyDetailBold: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  historyCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  historyActionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  historyActionText: {
    ...typography.captionBold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  deleteActionBtn: {
    backgroundColor: 'rgba(224, 90, 90, 0.1)',
  },
  deleteActionText: {
    color: colors.error,
  },
});
