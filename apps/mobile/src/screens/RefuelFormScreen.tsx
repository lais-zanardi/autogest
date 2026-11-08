import React, { useState, useEffect, useMemo } from 'react';
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
import { CameraService, GPSService, MobileOCRService } from '../services';
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
import { CoachMarkTarget } from '../components/CoachMarkTour';
import { FuelType, Refuel, RouteType, Tag } from '@autogest/shared-types';
import { colors, spacing, radius, typography } from '../theme';
import { formatCurrency, formatKml } from '../utils/formatters';
import { Icon } from '../components/Icon';
import {
  identificarAnomaliasNoHistorico,
  avaliarAnomaliaConsumo,
} from '../services/consumptionAnomalyService';
import { MaintenanceFormModal } from '../components/MaintenanceFormModal';
import { TagSelector } from '../components/TagSelector';
import { TagService } from '../services/tagService';
import { TripService } from '../services/tripService';
import { validarNota, LIMITE_MAXIMO_NOTA } from '../services/routeContextService';
import { EfficiencyGoalRepository } from '../repositories/EfficiencyGoalRepository';
import { statusDaMeta, perfilDeRodagem, recomendar } from '../services/efficiencyGoalService';
import catalogJson from '../assets/eco_tips_catalog.json';

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

  // US26.3: Modal de criação de manutenção preventiva disparado via atalho de alerta de anomalia
  const [maintenanceModalVisible, setMaintenanceModalVisible] = useState(false);

  // Mapa dinâmico de anomalias calculado sob demanda no histórico (US26.4 - nada persistido)
  const anomaliasMap = useMemo(() => {
    return identificarAnomaliasNoHistorico(historyList);
  }, [historyList]);
  const [date, setDate] = useState('');
  const [odometer, setOdometer] = useState('');
  const [liters, setLiters] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('Gasolina');
  const [stationName, setStationName] = useState('');
  const [isFullTank, setIsFullTank] = useState(true);
  // US27.2 & US27.3 & US27.4
  const [routeType, setRouteType] = useState<RouteType | null>('misto');
  const [notes, setNotes] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  // US07.3: Vínculo automático à viagem ativa
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [linkToTrip, setLinkToTrip] = useState(true);

  // US27.5: Filtros do histórico
  const [filterRouteType, setFilterRouteType] = useState<string>('todos');
  const [filterTagId, setFilterTagId] = useState<string>('todas');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [historyTagsMap, setHistoryTagsMap] = useState<Record<string, Tag[]>>({});

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
      setRouteType(editingRefuel.routeType || editingRefuel.tipo_percurso || 'misto');
      setNotes(editingRefuel.notes || editingRefuel.nota || '');
      TagService.listarEtiquetasDoRegistro('abastecimento', editingRefuel.id)
        .then(tags => setSelectedTagIds(tags.map(t => t.id)))
        .catch(() => setSelectedTagIds([]));
      setActiveTab('form');
    } else {
      resetForm();
    }
    loadHistory();
    fetchLocation();
    if (selectedVehicle?.id) {
      TripService.obterViagemAtiva(selectedVehicle.id)
        .then(trip => {
          setActiveTrip(trip);
          setLinkToTrip(!!trip);
        })
        .catch(() => setActiveTrip(null));
    } else {
      setActiveTrip(null);
    }
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
    setRouteType('misto');
    setNotes('');
    setSelectedTagIds([]);
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

      // Carrega etiquetas para filtros e tags de cada abastecimento
      const allTags = await TagService.listarEtiquetas();
      setAvailableTags(allTags);
      const tagMap = await TagService.obterMapaTagsRegistros(
        'abastecimento',
        list.map(r => r.id),
      );
      setHistoryTagsMap(tagMap);
    } catch (e) {
      console.error('Erro ao carregar histórico de abastecimentos:', e);
    }
  };

  const fetchLocation = async () => {
    try {
      const location = await GPSService.getCurrentLocation();
      if (location) {
        setCoords(location);
        setGpsStatus('Localização GPS capturada');
      } else {
        setCoords(null);
        setGpsStatus('GPS indisponível ou negado (salvando sem coordenadas)');
      }
    } catch {
      setCoords(null);
      setGpsStatus('GPS desligado');
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
  const executeOcrScan = async (source: 'camera' | 'gallery') => {
    setIsScanning(true);
    try {
      const base64 =
        source === 'camera'
          ? await CameraService.captureReceiptFromCamera()
          : await CameraService.selectReceiptFromGallery();

      if (!base64) {
        return;
      }

      const data = await MobileOCRService.scanReceipt(base64);
      if (data) {
        if (data.liters) setLiters(String(data.liters));
        if (data.pricePerLiter) setPricePerLiter(String(data.pricePerLiter));
        if (data.totalValue) setTotalValue(String(data.totalValue));
        if (data.fuelType && FUEL_TYPES.includes(data.fuelType)) setFuelType(data.fuelType);
        if (data.stationName) setStationName(data.stationName);

        Alert.alert(
          'OCR Concluído',
          'Dados do cupom preenchidos automaticamente. Revise os campos antes de salvar o abastecimento.',
        );
      }
    } catch (error: any) {
      Alert.alert('OCR', error?.message || 'Não foi possível extrair dados automaticamente da imagem.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanReceipt = () => {
    Alert.alert(
      'Escanear Nota / Comprovante',
      'Como deseja carregar a imagem do comprovante para o escaneamento OCR?',
      [
        {
          text: 'Tirar Foto (Câmera)',
          onPress: () => executeOcrScan('camera'),
        },
        {
          text: 'Escolher da Galeria',
          onPress: () => executeOcrScan('gallery'),
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ],
      { cancelable: true },
    );
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

    // US27.4: Validação de nota (limite de 500 caracteres)
    const validacaoNota = validarNota(notes);
    if (!validacaoNota.isValid) {
      newErrors.notes = validacaoNota.error || 'A nota excede 500 caracteres.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      let savedResult: Refuel | null = null;

      if (editingRefuel) {
        savedResult = await FuelingService.updateRefuel(editingRefuel.id, {
          odometer: numOdometer!,
          liters: numLiters!,
          pricePerLiter: numPrice!,
          totalValue: numTotal!,
          fuelType,
          stationName: stationName.trim() || null,
          isFullTank,
          routeType,
          notes: notes.trim() || null,
          tipo_percurso: routeType,
          nota: notes.trim() || null,
          tripId: linkToTrip && activeTrip ? activeTrip.id : null,
          viagem_id: linkToTrip && activeTrip ? activeTrip.id : null,
        });
      } else {
        savedResult = await FuelingService.createRefuel(
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
            routeType,
            notes: notes.trim() || null,
            tipo_percurso: routeType,
            nota: notes.trim() || null,
            tripId: linkToTrip && activeTrip ? activeTrip.id : null,
            viagem_id: linkToTrip && activeTrip ? activeTrip.id : null,
          },
          coords,
        );
      }

      // US27.3: Salva vínculo de etiquetas
      if (savedResult?.id) {
        await TagService.vincularEtiquetas('abastecimento', savedResult.id, selectedTagIds);
      }

      const updatedHistory = await FuelingService.listRefuels(selectedVehicle.id);
      setHistoryList(updatedHistory);
      resetForm();
      setActiveTab('history');

      // US26.3: Avalia se o abastecimento salvo representou anomalia mecânica
      if (savedResult?.calculatedKml) {
        // Coleta consumos dos abastecimentos estritamente anteriores
        const sortedAsc = [...updatedHistory]
          .filter(r => !r.deletedAt && !(r as any).excluido_em)
          .sort((a, b) => {
            const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (diff !== 0) return diff;
            return a.odometer - b.odometer;
          });

        const targetIndex = sortedAsc.findIndex(r => r.id === savedResult?.id);
        if (targetIndex >= 3) {
          const anteriores = sortedAsc
            .slice(0, targetIndex)
            .map(r => r.calculatedKml)
            .filter((k): k is number => typeof k === 'number' && k > 0);

          const anomalia = avaliarAnomaliaConsumo(anteriores, savedResult.calculatedKml);
          if (anomalia.isAnomalia && anomalia.percentualQueda !== null) {
            const percFormatado = anomalia.percentualQueda.toFixed(1).replace('.', ',');
            const mediaFormatada = formatKml(anomalia.mediaAnterior);
            Alert.alert(
              '⚠️ Alerta de Rendimento',
              `Possível problema mecânico: consumo ${percFormatado}% abaixo da média recente (${mediaFormatada}).`,
              [
                {
                  text: 'Fechar',
                  style: 'cancel',
                },
                {
                  text: '🔧 Registrar Manutenção',
                  style: 'default',
                  onPress: () => setMaintenanceModalVisible(true),
                },
              ],
            );
          } else {
            // US08.6: Se não houve anomalia, verifica se o consumo ficou abaixo da meta de eficiência ativa
            try {
              const activeGoal = await EfficiencyGoalRepository.findByVehicle(selectedVehicle.id);
              if (activeGoal && activeGoal.targetKml > 0) {
                const goalSt = statusDaMeta(savedResult.calculatedKml, activeGoal.targetKml);
                if (goalSt.situacao === 'abaixo') {
                  const profile = perfilDeRodagem(updatedHistory, activeGoal.targetKml);
                  const catalog = (catalogJson as any)?.dicas || [];
                  const tips = recomendar(profile, catalog);
                  const tipDestaque = tips[0];
                  if (tipDestaque) {
                    Alert.alert(
                      '🎯 Dica de Eficiência',
                      `Seu rendimento neste abastecimento (${savedResult.calculatedKml.toFixed(1).replace('.', ',')} km/l) ficou abaixo da sua meta (${activeGoal.targetKml.toFixed(1).replace('.', ',')} km/l).\n\n💡 ${tipDestaque.titulo}: ${tipDestaque.descricao}`,
                    );
                  }
                }
              }
            } catch (goalErr) {
              console.warn('Erro ao verificar meta após salvar abastecimento:', goalErr);
            }
          }
        }
      }
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
        <CoachMarkTarget targetId="tour-target-first-refuel">
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={[styles.backButton, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
              <Icon name="X" size={16} color={colors.textPrimary} />
              <Text style={styles.backButtonText}>Fechar</Text>
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
                <Text
                  style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}
                >
                  Histórico ({historyList.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </CoachMarkTarget>

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
              style={[styles.ocrButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
              onPress={handleScanReceipt}
              disabled={isScanning || isSubmitting}
              activeOpacity={0.8}
            >
              {isScanning ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : (
                <>
                  <Icon name="Camera" size={16} color={colors.black} />
                  <Text style={styles.ocrButtonText}>Escanear Nota / Comprovante (OCR)</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Prévia de Consumo Calculado em Tempo Real */}
            {previewConsumption !== null && (
              <View style={styles.previewBox}>
                <Text style={styles.previewEyebrow}>ESTIMATIVA DE CONSUMO</Text>
                <Text style={styles.previewValue}>{formatKml(previewConsumption)}</Text>
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

            {/* US07.3: Vínculo automático à viagem ativa com opção desmarcável */}
            {activeTrip && (
              <View
                style={[
                  styles.switchRow,
                  {
                    backgroundColor: colors.surfaceRaised,
                    padding: 12,
                    borderRadius: 8,
                    marginVertical: 8,
                  },
                ]}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Icon name="Navigation" size={13} color={colors.lime} />
                    <Text style={[styles.switchLabel, { color: colors.lime }]}>
                      Viagem em andamento
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
                      Vincular a {activeTrip.origin}
                    </Text>
                    <Icon name="ArrowRight" size={10} color={colors.textSecondary} />
                    <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
                      {activeTrip.destination}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={linkToTrip}
                  onValueChange={setLinkToTrip}
                  trackColor={{ false: colors.surface, true: colors.lime }}
                  thumbColor={linkToTrip ? colors.black : colors.textSecondary}
                />
              </View>
            )}

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

            {/* US27.2: Tipo de Percurso */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Tipo de Percurso</Text>
              <View style={styles.chipRow}>
                {(
                  [
                    { key: 'urbano', label: 'Urbano', icon: 'Building' },
                    { key: 'rodoviario', label: 'Rodoviário', icon: 'Navigation' },
                    { key: 'misto', label: 'Misto', icon: 'Shuffle' },
                  ] as Array<{ key: RouteType; label: string; icon: any }>
                ).map(rt => {
                  const isSelected = routeType === rt.key;
                  return (
                    <TouchableOpacity
                      key={rt.key}
                      style={[styles.chip, isSelected && styles.chipSelected, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}
                      onPress={() => setRouteType(rt.key)}
                      disabled={isSubmitting}
                    >
                      <Icon
                        name={rt.icon}
                        size={12}
                        color={isSelected ? colors.black : colors.textSecondary}
                      />
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {rt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* US27.3: Etiquetas com autocomplete e criação */}
            <TagSelector
              selectedTagIds={selectedTagIds}
              onChangeSelectedTagIds={setSelectedTagIds}
            />

            {/* US27.4: Campo de Nota com limite de 500 caracteres */}
            <View style={styles.fieldGroup}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={styles.label}>Nota / Observações (opcional)</Text>
                <Text
                  style={{
                    ...typography.caption,
                    color: notes.length > LIMITE_MAXIMO_NOTA ? colors.error : colors.textSecondary,
                  }}
                >
                  {notes.length}/{LIMITE_MAXIMO_NOTA}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  { height: 80, textAlignVertical: 'top', paddingTop: 8 },
                  errors.notes ? styles.inputError : null,
                ]}
                multiline
                maxLength={500}
                value={notes}
                onChangeText={setNotes}
                placeholder="Ex: Viagem para o litoral, trânsito pesado na serra"
                placeholderTextColor={colors.textMuted}
                editable={!isSubmitting}
              />
              {errors.notes && <Text style={styles.errorText}>{errors.notes}</Text>}
            </View>

            {/* Status GPS */}
            <View style={[styles.gpsRow, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
              <Icon name="MapPin" size={12} color={colors.textMuted} />
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
            {/* US27.5: Barra de Filtros por Percurso e por Etiqueta */}
            <View
              style={{
                marginBottom: 12,
                paddingBottom: 10,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={[styles.label, { marginBottom: 6 }]}>Filtrar por Percurso</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 10 }}
              >
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[
                    { key: 'todos', label: 'Todos', icon: null },
                    { key: 'urbano', label: 'Urbano', icon: 'Building' },
                    { key: 'rodoviario', label: 'Rodoviário', icon: 'Navigation' },
                    { key: 'misto', label: 'Misto', icon: 'Shuffle' },
                    { key: 'sem_tipo', label: 'Sem tipo', icon: null },
                  ].map(f => {
                    const isSelected = filterRouteType === f.key;
                    return (
                      <TouchableOpacity
                        key={f.key}
                        style={[styles.chip, isSelected && styles.chipSelected, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}
                        onPress={() => setFilterRouteType(f.key)}
                      >
                        {f.icon && (
                          <Icon
                            name={f.icon as any}
                            size={12}
                            color={isSelected ? colors.black : colors.textSecondary}
                          />
                        )}
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {f.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {availableTags.length > 0 && (
                <>
                  <Text style={[styles.label, { marginBottom: 6 }]}>Filtrar por Etiqueta</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={[styles.chip, filterTagId === 'todas' && styles.chipSelected]}
                        onPress={() => setFilterTagId('todas')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            filterTagId === 'todas' && styles.chipTextSelected,
                          ]}
                        >
                          Todas
                        </Text>
                      </TouchableOpacity>
                      {availableTags.map(tag => {
                        const isSelected = filterTagId === tag.id;
                        return (
                          <TouchableOpacity
                            key={tag.id}
                            style={[styles.chip, isSelected && styles.chipSelected, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                            onPress={() => setFilterTagId(tag.id)}
                          >
                            <Icon
                              name="Tag"
                              size={11}
                              color={isSelected ? colors.black : colors.textSecondary}
                            />
                            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                              {tag.name || tag.nome}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </>
              )}
            </View>

            {historyList.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Icon name="Fuel" size={32} color={colors.textMuted} style={{ marginBottom: spacing.sm }} />
                <Text style={styles.emptyHistoryTitle}>Nenhum abastecimento</Text>
                <Text style={styles.emptyHistoryText}>
                  Registre o primeiro abastecimento deste veículo na aba "Novo".
                </Text>
              </View>
            ) : (
              historyList
                .filter(item => {
                  if (filterRouteType !== 'todos') {
                    const itemRoute = item.routeType || item.tipo_percurso;
                    if (filterRouteType === 'sem_tipo' && itemRoute) return false;
                    if (filterRouteType !== 'sem_tipo' && itemRoute !== filterRouteType)
                      return false;
                  }
                  if (filterTagId !== 'todas') {
                    const itemTags = historyTagsMap[item.id] || [];
                    if (!itemTags.some(t => t.id === filterTagId)) return false;
                  }
                  return true;
                })
                .map(item => {
                  const itemTags = historyTagsMap[item.id] || [];
                  const itemRoute = item.routeType || item.tipo_percurso;
                  const itemNote = item.notes || item.nota;

                  return (
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
                          <View style={styles.badgeCol}>
                            <View style={styles.kmlBadge}>
                              <Text style={styles.kmlBadgeText}>
                                {formatKml(item.calculatedKml)}
                              </Text>
                            </View>
                            {/* US26.4: Ícone e badge de alerta em registros anômalos recalculados na hora */}
                            {anomaliasMap.has(item.id) && (
                              <TouchableOpacity
                                style={styles.anomalyBadge}
                                activeOpacity={0.8}
                                onPress={() => {
                                  const anom = anomaliasMap.get(item.id);
                                  const mediaFormatada = formatKml(anom?.mediaAnterior);
                                  Alert.alert(
                                    '⚠️ Anomalia de Consumo',
                                    `Neste abastecimento, o consumo foi de ${formatKml(item.calculatedKml)}, ficando ${anom?.percentualQueda?.toFixed(1).replace('.', ',')}% abaixo da média dos 3 abastecimentos anteriores (${mediaFormatada}).`,
                                    [
                                      { text: 'OK', style: 'cancel' },
                                      {
                                        text: '🔧 Agendar Manutenção',
                                        onPress: () => setMaintenanceModalVisible(true),
                                      },
                                    ],
                                  );
                                }}
                                accessibilityLabel={`Alerta de anomalia de consumo no abastecimento de ${item.odometer} km`}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Icon name="AlertTriangle" size={12} color={colors.black} />
                                  <Text style={styles.anomalyBadgeText}>
                                    Anomalia (
                                    {anomaliasMap.get(item.id)?.percentualQueda?.toFixed(0)}%)
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            )}
                          </View>
                        ) : (
                          <View style={styles.firstBadge}>
                            <Text style={styles.firstBadgeText}>1º / Base</Text>
                          </View>
                        )}
                      </View>

                      {/* US27.5: Exibição de tipo de percurso, etiquetas e nota */}
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 6,
                          marginVertical: 6,
                          alignItems: 'center',
                        }}
                      >
                        {itemRoute && (
                          <View
                            style={{
                              backgroundColor: colors.surfaceRaised,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 12,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Icon
                              name={
                                itemRoute === 'urbano'
                                  ? 'Building'
                                  : itemRoute === 'rodoviario'
                                    ? 'Navigation'
                                    : 'Shuffle'
                              }
                              size={11}
                              color={colors.lime}
                            />
                            <Text
                              style={{
                                ...typography.caption,
                                color: colors.lime,
                                fontWeight: '600',
                              }}
                            >
                              {itemRoute === 'urbano'
                                ? 'Urbano'
                                : itemRoute === 'rodoviario'
                                  ? 'Rodoviário'
                                  : 'Misto'}
                            </Text>
                          </View>
                        )}

                        {itemTags.map(tag => (
                          <View
                            key={tag.id}
                            style={{
                              backgroundColor: colors.surface,
                              borderWidth: 1,
                              borderColor: colors.border,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 12,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Icon name="Tag" size={10} color={colors.textSecondary} />
                            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                              {tag.name || tag.nome}
                            </Text>
                          </View>
                        ))}

                        {itemNote ? (
                          <TouchableOpacity
                            onPress={() => Alert.alert('Nota do Abastecimento', itemNote)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Icon name="FileText" size={14} color={colors.lime} />
                          </TouchableOpacity>
                        ) : null}
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
                          style={[styles.historyActionBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                          onPress={() => handleEditPress(item)}
                        >
                          <Icon name="Edit2" size={12} color={colors.textPrimary} />
                          <Text style={styles.historyActionText}>Editar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.historyActionBtn, styles.deleteActionBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                          onPress={() => handleDeletePress(item)}
                        >
                          <Icon name="Trash2" size={12} color={colors.error} />
                          <Text style={[styles.historyActionText, styles.deleteActionText]}>
                            Excluir
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
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

        {/* US26.3: Modal de cadastro de manutenção preventiva aberto via atalho de alerta */}
        {selectedVehicle && (
          <MaintenanceFormModal
            visible={maintenanceModalVisible}
            vehicle={selectedVehicle}
            onClose={() => setMaintenanceModalVisible(false)}
            onSuccess={() => setMaintenanceModalVisible(false)}
          />
        )}
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
  badgeCol: {
    alignItems: 'flex-end',
    gap: 4,
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
  anomalyBadge: {
    backgroundColor: 'rgba(245, 200, 66, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 66, 0.4)',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  anomalyBadgeText: {
    ...typography.captionBold,
    color: colors.amber,
    fontSize: 10,
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
