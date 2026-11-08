import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Trip, TripSummary } from '@autogest/shared-types';
import { useTheme, typography } from '../theme';
import { formatCurrency, formatKml } from '../utils/formatters';
import { Icon } from './Icon';

interface TripSummaryModalProps {
  visible: boolean;
  trip: Trip | null;
  summary: TripSummary | null;
  onClose: () => void;
}

export const TripSummaryModal: React.FC<TripSummaryModalProps> = ({
  visible,
  trip,
  summary,
  onClose,
}) => {
  const { colors } = useTheme();
  if (!trip || !summary) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>Resumo da Viagem</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[typography.caption, { color: colors.lime }]}>
                  {trip.origin}
                </Text>
                <Icon name="ArrowRight" size={12} color={colors.lime} />
                <Text style={[typography.caption, { color: colors.lime }]}>
                  {trip.destination}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="X" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Status e Período */}
            <View style={[styles.infoRow, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
              <View>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>PERÍODO</Text>
                <Text style={[typography.body, { color: colors.textPrimary }]}>
                  {new Date(trip.startDate).toLocaleDateString('pt-BR')}
                  {trip.endDate ? ` até ${new Date(trip.endDate).toLocaleDateString('pt-BR')}` : ' (Em andamento)'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>STATUS</Text>
                <Text
                  style={[
                    typography.caption,
                    {
                      color: trip.status === 'finalizada' ? colors.lime : colors.amber,
                      fontWeight: '700',
                      textTransform: 'uppercase',
                    },
                  ]}
                >
                  {trip.status.replace('_', ' ')}
                </Text>
              </View>
            </View>

            {/* Grid Principal de Métricas */}
            <View style={styles.grid}>
              <View style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>DISTÂNCIA TOTAL</Text>
                <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 4 }]}>
                  {summary.distanciaKm !== null ? `${summary.distanciaKm.toLocaleString('pt-BR')} km` : '--'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {trip.startOdometer} km
                  </Text>
                  <Icon name="ArrowRight" size={10} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {trip.endOdometer || '?'} km
                  </Text>
                </View>
              </View>

              <View style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>RENDIMENTO DA ROTA</Text>
                <Text style={[typography.h3, { color: colors.lime, marginTop: 4 }]}>
                  {summary.rendimentoKml !== null ? formatKml(summary.rendimentoKml) : '--'}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {summary.totalLitros} L abastecidos
                </Text>
              </View>

              <View style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>CUSTO TOTAL</Text>
                <Text style={[typography.h3, { color: colors.lime, marginTop: 4 }]}>
                  {formatCurrency(summary.custoTotal)}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Combustível + Extras
                </Text>
              </View>

              <View style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>CUSTO POR KM</Text>
                <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 4 }]}>
                  {summary.custoPorKm !== null ? `R$ ${summary.custoPorKm.toFixed(2).replace('.', ',')}` : '--'}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  R$/km rodado
                </Text>
              </View>
            </View>

            {/* Detalhamento por Categoria/Subtipo */}
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              DESPESAS POR SUBTIPO
            </Text>
            <View style={[styles.breakdownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.breakdownRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="Fuel" size={14} color={colors.textSecondary} />
                  <Text style={[typography.body, { color: colors.textPrimary }]}>Combustível ({summary.totalAbastecimentos}x)</Text>
                </View>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                  {formatCurrency(summary.custoCombustivel)}
                </Text>
              </View>

              <View style={[styles.breakdownRow, { borderTopColor: colors.border, borderTopWidth: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="Navigation" size={14} color={colors.textSecondary} />
                  <Text style={[typography.body, { color: colors.textPrimary }]}>Pedágios</Text>
                </View>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                  {formatCurrency(summary.custoPorSubtipo.pedagio)}
                </Text>
              </View>

              <View style={[styles.breakdownRow, { borderTopColor: colors.border, borderTopWidth: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="Utensils" size={14} color={colors.textSecondary} />
                  <Text style={[typography.body, { color: colors.textPrimary }]}>Alimentação</Text>
                </View>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                  {formatCurrency(summary.custoPorSubtipo.alimentacao)}
                </Text>
              </View>

              <View style={[styles.breakdownRow, { borderTopColor: colors.border, borderTopWidth: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="Bed" size={14} color={colors.textSecondary} />
                  <Text style={[typography.body, { color: colors.textPrimary }]}>Hospedagem</Text>
                </View>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                  {formatCurrency(summary.custoPorSubtipo.hospedagem)}
                </Text>
              </View>

              <View style={[styles.breakdownRow, { borderTopColor: colors.border, borderTopWidth: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="CircleDot" size={14} color={colors.textSecondary} />
                  <Text style={[typography.body, { color: colors.textPrimary }]}>Estacionamento</Text>
                </View>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                  {formatCurrency(summary.custoPorSubtipo.estacionamento)}
                </Text>
              </View>

              <View style={[styles.breakdownRow, { borderTopColor: colors.border, borderTopWidth: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="Package" size={14} color={colors.textSecondary} />
                  <Text style={[typography.body, { color: colors.textPrimary }]}>Outros</Text>
                </View>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                  {formatCurrency(summary.custoPorSubtipo.outros)}
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity style={[styles.closeModalBtn, { backgroundColor: colors.lime }]} onPress={onClose}>
              <Text style={styles.closeModalBtnText}>Concluído</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    maxHeight: '90%',
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
  scrollBody: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  gridCard: {
    width: '48%',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  breakdownCard: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  closeModalBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
  },
});
