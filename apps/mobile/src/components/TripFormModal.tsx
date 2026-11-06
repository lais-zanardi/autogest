import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Vehicle, Trip } from '@autogest/shared-types';
import { TripService } from '../services/tripService';
import { useTheme, typography } from '../theme';

interface TripFormModalProps {
  visible: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onSuccess: (trip: Trip) => void;
}

export const TripFormModal: React.FC<TripFormModalProps> = ({
  visible,
  vehicle,
  onClose,
  onSuccess,
}) => {
  const { colors } = useTheme();

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [startOdometer, setStartOdometer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && vehicle) {
      setOrigin('');
      setDestination('');
      const km = vehicle.currentOdometer || vehicle.initialOdometer || 0;
      setStartOdometer(km > 0 ? String(km) : '');
      setIsSubmitting(false);
    }
  }, [visible, vehicle]);

  const handleStartTrip = async () => {
    if (!vehicle) return;
    if (!origin.trim()) {
      Alert.alert('Atenção', 'Informe a origem da viagem.');
      return;
    }
    if (!destination.trim()) {
      Alert.alert('Atenção', 'Informe o destino da viagem.');
      return;
    }

    const numKm = Number(startOdometer.replace(',', '.'));
    if (isNaN(numKm) || numKm <= 0) {
      Alert.alert('Atenção', 'Informe uma quilometragem inicial válida maior que zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const trip = await TripService.iniciarViagem({
        vehicleId: vehicle.id,
        origin: origin.trim(),
        destination: destination.trim(),
        startOdometer: numKm,
      });

      onSuccess(trip);
      onClose();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível iniciar a viagem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>Iniciar Viagem</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {vehicle?.model} • {vehicle?.plate}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.closeBtn, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>PONTO DE PARTIDA (ORIGEM) *</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                ]}
                placeholder="Ex: São Paulo - SP / Casa"
                placeholderTextColor={colors.textSecondary}
                value={origin}
                onChangeText={setOrigin}
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>DESTINO *</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                ]}
                placeholder="Ex: Rio de Janeiro - RJ / Praia"
                placeholderTextColor={colors.textSecondary}
                value={destination}
                onChangeText={setDestination}
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>KM INICIAL (HODÔMETRO ATUAL) *</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                ]}
                placeholder="Ex: 10000"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={startOdometer}
                onChangeText={setStartOdometer}
                editable={!isSubmitting}
              />
            </View>
          </View>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSubmitting}>
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.startBtn, { backgroundColor: colors.lime }, isSubmitting && { opacity: 0.6 }]}
              onPress={handleStartTrip}
              disabled={isSubmitting}
            >
              <Text style={styles.startBtnText}>
                {isSubmitting ? 'Iniciando...' : '🛣️ Iniciar Viagem'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    padding: 16,
    gap: 12,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  input: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    ...typography.body,
    fontWeight: '600',
  },
  startBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  startBtnText: {
    color: '#000000',
    fontWeight: '700',
  },
});
