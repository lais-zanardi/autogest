import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { CameraService, GPSService, api } from '../services';
import { OfflineStorage } from '../store/offlineStorage';
import { FuelType } from '@autogest/shared-types';

export const RefuelFormScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { selectedVehicle, isOnline } = useAppStore();
  const [odometer, setOdometer] = useState('');
  const [liters, setLiters] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [fuelType, setFuelType] = useState<FuelType>('Gasolina');
  const [isFullTank, setIsFullTank] = useState(true);

  const handleScanReceipt = async () => {
    const base64 = await CameraService.captureReceiptFromCamera();
    if (base64) {
      try {
        const response = await api.post('/refuels/scan-ocr', { imageBase64: base64 });
        const data = response.data.data;
        if (data.liters) setLiters(String(data.liters));
        if (data.pricePerLiter) setPricePerLiter(String(data.pricePerLiter));
        if (data.totalValue) setTotalValue(String(data.totalValue));
        if (data.fuelType) setFuelType(data.fuelType);
      } catch (e) {
        console.log('Falha ao processar OCR', e);
      }
    }
  };

  const handleSave = async () => {
    if (!selectedVehicle) return;

    const coords = await GPSService.getCurrentLocation();
    const payload = {
      vehicleId: selectedVehicle.id,
      date: new Date().toISOString(),
      odometer: Number(odometer),
      fuelType,
      pricePerLiter: Number(pricePerLiter),
      totalValue: Number(totalValue),
      liters: Number(liters),
      isFullTank,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
    };

    if (isOnline) {
      try {
        await api.post('/refuels', payload);
      } catch {
        await OfflineStorage.savePendingRefuel(payload);
      }
    } else {
      await OfflineStorage.savePendingRefuel(payload);
    }
    onClose();
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Novo Abastecimento</Text>

      <TouchableOpacity style={styles.ocrButton} onPress={handleScanReceipt}>
        <Text style={styles.ocrButtonText}>📷 Escanear Comprovante (OCR)</Text>
      </TouchableOpacity>

      <View style={styles.field}>
        <Text style={styles.label}>Odômetro Atual (km)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={odometer}
          onChangeText={setOdometer}
          placeholder="ex: 45200"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Litros Abastecidos</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={liters}
          onChangeText={setLiters}
          placeholder="ex: 40.5"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Preço por Litro (R$)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={pricePerLiter}
          onChangeText={setPricePerLiter}
          placeholder="ex: 5.79"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Valor Total (R$)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={totalValue}
          onChangeText={setTotalValue}
          placeholder="ex: 234.50"
        />
      </View>

      <View style={styles.switchField}>
        <Text style={styles.label}>Tanque Cheio?</Text>
        <Switch value={isFullTank} onValueChange={setIsFullTank} />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Salvar Abastecimento</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  ocrButton: {
    backgroundColor: '#34C759',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  ocrButtonText: { color: '#FFFFFF', fontWeight: 'bold' },
  field: { marginBottom: 14 },
  label: { fontSize: 13, color: '#636366', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#C7C7CC', borderRadius: 8, padding: 12, fontSize: 16 },
  switchField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
