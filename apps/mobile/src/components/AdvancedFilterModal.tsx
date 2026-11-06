import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SearchFilters, RecordType, RouteType, Tag } from '@autogest/shared-types';
import { useTheme, typography } from '../theme';

interface AdvancedFilterModalProps {
  visible: boolean;
  filters: SearchFilters;
  tags: Tag[];
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
  onReset: () => void;
}

export const AdvancedFilterModal: React.FC<AdvancedFilterModalProps> = ({
  visible,
  filters,
  tags,
  onClose,
  onApply,
  onReset,
}) => {
  const { colors } = useTheme();

  // Estados locais do modal
  const [dataInicio, setDataInicio] = useState(filters.dataInicio || '');
  const [dataFim, setDataFim] = useState(filters.dataFim || '');
  const [recordType, setRecordType] = useState<RecordType | 'todos'>(filters.recordType || 'todos');
  const [valorMin, setValorMin] = useState(
    filters.valorMin !== undefined && filters.valorMin !== null ? String(filters.valorMin) : '',
  );
  const [valorMax, setValorMax] = useState(
    filters.valorMax !== undefined && filters.valorMax !== null ? String(filters.valorMax) : '',
  );
  const [kmMin, setKmMin] = useState(
    filters.kmMin !== undefined && filters.kmMin !== null ? String(filters.kmMin) : '',
  );
  const [kmMax, setKmMax] = useState(
    filters.kmMax !== undefined && filters.kmMax !== null ? String(filters.kmMax) : '',
  );
  const [routeType, setRouteType] = useState<RouteType | 'sem_tipo' | 'todos'>(
    filters.routeType || 'todos',
  );
  const [tagId, setTagId] = useState<string>(filters.tagId || 'todas');

  const handleApply = () => {
    onApply({
      ...filters,
      dataInicio: dataInicio.trim() || null,
      dataFim: dataFim.trim() || null,
      recordType,
      valorMin: valorMin.trim() ? Number(valorMin.replace(',', '.')) : null,
      valorMax: valorMax.trim() ? Number(valorMax.replace(',', '.')) : null,
      kmMin: kmMin.trim() ? Number(kmMin) : null,
      kmMax: kmMax.trim() ? Number(kmMax) : null,
      routeType,
      tagId: tagId === 'todas' ? null : tagId,
    });
    onClose();
  };

  const handleReset = () => {
    setDataInicio('');
    setDataFim('');
    setRecordType('todos');
    setValorMin('');
    setValorMax('');
    setKmMin('');
    setKmMax('');
    setRouteType('todos');
    setTagId('todas');
    onReset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>Filtros Avançados</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.closeBtn, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Tipo de Registro */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>TIPO DE REGISTRO</Text>
            <View style={styles.chipRow}>
              {[
                { key: 'todos', label: 'Todos' },
                { key: 'abastecimento', label: '⛽ Abastecimento' },
                { key: 'despesa', label: '💸 Despesa' },
                { key: 'manutencao', label: '🔧 Manutenção' },
              ].map(item => {
                const isSelected = recordType === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected ? colors.lime : colors.surfaceRaised,
                        borderColor: isSelected ? colors.lime : colors.border,
                      },
                    ]}
                    onPress={() => setRecordType(item.key as any)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? colors.black : colors.textPrimary },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Período */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PERÍODO (AAAA-MM-DD)</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                ]}
                placeholder="Data Inicial"
                placeholderTextColor={colors.textSecondary}
                value={dataInicio}
                onChangeText={setDataInicio}
              />
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                ]}
                placeholder="Data Final"
                placeholderTextColor={colors.textSecondary}
                value={dataFim}
                onChangeText={setDataFim}
              />
            </View>

            {/* Faixa de Valor */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>FAIXA DE VALOR (R$)</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                ]}
                placeholder="Mínimo (R$)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                value={valorMin}
                onChangeText={setValorMin}
              />
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                ]}
                placeholder="Máximo (R$)"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                value={valorMax}
                onChangeText={setValorMax}
              />
            </View>

            {/* Faixa de Quilometragem */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>FAIXA DE QUILOMETRAGEM (KM)</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                ]}
                placeholder="Km Mínimo"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={kmMin}
                onChangeText={setKmMin}
              />
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                ]}
                placeholder="Km Máximo"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={kmMax}
                onChangeText={setKmMax}
              />
            </View>

            {/* Tipo de Percurso (Abastecimentos) */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>TIPO DE PERCURSO</Text>
            <View style={styles.chipRow}>
              {[
                { key: 'todos', label: 'Todos' },
                { key: 'urbano', label: '🏙️ Urbano' },
                { key: 'rodoviario', label: '🛣️ Rodoviário' },
                { key: 'misto', label: '🔀 Misto' },
                { key: 'sem_tipo', label: 'Sem tipo' },
              ].map(item => {
                const isSelected = routeType === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected ? colors.lime : colors.surfaceRaised,
                        borderColor: isSelected ? colors.lime : colors.border,
                      },
                    ]}
                    onPress={() => setRouteType(item.key as any)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? colors.black : colors.textPrimary },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Etiquetas */}
            {tags.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ETIQUETA</Text>
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      {
                        backgroundColor: tagId === 'todas' ? colors.lime : colors.surfaceRaised,
                        borderColor: tagId === 'todas' ? colors.lime : colors.border,
                      },
                    ]}
                    onPress={() => setTagId('todas')}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: tagId === 'todas' ? colors.black : colors.textPrimary },
                      ]}
                    >
                      Todas
                    </Text>
                  </TouchableOpacity>
                  {tags.map(t => {
                    const isSelected = tagId === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? colors.lime : colors.surfaceRaised,
                            borderColor: isSelected ? colors.lime : colors.border,
                          },
                        ]}
                        onPress={() => setTagId(t.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: isSelected ? colors.black : colors.textPrimary },
                          ]}
                        >
                          🏷️ {t.name || t.nome}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          {/* Botões de Ação */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Text style={[styles.resetBtnText, { color: colors.textSecondary }]}>Limpar Filtros</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.lime }]} onPress={handleApply}>
              <Text style={styles.applyBtnText}>Aplicar</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '85%',
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
  scrollContent: {
    padding: 16,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
  },
  resetBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  resetBtnText: {
    ...typography.body,
    fontWeight: '600',
  },
  applyBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  applyBtnText: {
    color: '#000000',
    fontWeight: '700',
  },
});
