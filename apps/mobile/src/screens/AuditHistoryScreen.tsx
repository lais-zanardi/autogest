import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { AuditEntityName, AuditLogRecord } from '@autogest/shared-types';
import { AuditPeriodPreset, AuditService } from '../services/auditService';
import { colors, spacing, radius, typography } from '../theme';
import { Icon } from '../components/Icon';

const ENTITY_FILTERS: Array<{ id: AuditEntityName | 'todas'; label: string }> = [
  { id: 'todas', label: 'Todas' },
  { id: 'veiculos', label: 'Veículos' },
  { id: 'abastecimentos', label: 'Abastecimentos' },
  { id: 'despesas', label: 'Despesas' },
  { id: 'manutencoes', label: 'Manutenções' },
  { id: 'custos_fixos', label: 'Custos fixos' },
  { id: 'orcamentos', label: 'Orçamentos' },
  { id: 'backup', label: 'Backup' },
];

const PERIOD_FILTERS: Array<{ id: AuditPeriodPreset; label: string }> = [
  { id: 'todos', label: 'Todo o período' },
  { id: 'hoje', label: 'Hoje' },
  { id: '7dias', label: 'Últimos 7 dias' },
  { id: '30dias', label: 'Últimos 30 dias' },
];

interface AuditHistoryScreenProps {
  onClose?: () => void;
}

/**
 * US21.8: Tela "Histórico de alterações"
 * - Lista por data (decrescente);
 * - Filtro por entidade e por período;
 * - Detalhe expansível mostrando os campos `antes` e `depois`.
 */
export const AuditHistoryScreen: React.FC<AuditHistoryScreenProps> = ({ onClose }) => {
  const [selectedEntity, setSelectedEntity] = useState<AuditEntityName | 'todas'>('todas');
  const [selectedPeriod, setSelectedPeriod] = useState<AuditPeriodPreset>('todos');
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    const filtered = await AuditService.listarHistorico({
      entidade: selectedEntity,
      periodo: selectedPeriod,
    });
    setLogs(filtered);
  }, [selectedEntity, selectedPeriod]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const formatActionBadge = (acao: string) => {
    switch (acao) {
      case 'criacao':
        return { label: 'CRIAÇÃO', color: colors.lime };
      case 'edicao':
        return { label: 'EDIÇÃO', color: colors.amber };
      case 'exclusao':
        return { label: 'EXCLUSÃO', color: colors.error };
      case 'geracao_backup':
        return { label: 'BACKUP CRIADO', color: colors.lime };
      case 'restauracao_backup':
        return { label: 'BACKUP RESTAURADO', color: '#56B4E9' };
      default:
        return { label: acao.toUpperCase(), color: colors.textSecondary };
    }
  };

  const renderDiffFields = (log: AuditLogRecord) => {
    const antes = log.alteracoes?.antes || {};
    const depois = log.alteracoes?.depois || {};
    const keys = Array.from(new Set([...Object.keys(antes), ...Object.keys(depois)])).filter(
      k => !['created_at', 'updated_at', 'createdAt', 'updatedAt'].includes(k),
    );

    if (keys.length === 0) {
      return <Text style={styles.diffEmptyText}>Sem campos adicionais detalhados.</Text>;
    }

    return keys.map(key => {
      const valAntes = antes[key] !== undefined ? JSON.stringify(antes[key]) : '—';
      const valDepois = depois[key] !== undefined ? JSON.stringify(depois[key]) : '—';
      const changed = valAntes !== valDepois;

      return (
        <View key={key} style={[styles.diffRow, changed && styles.diffRowChanged]}>
          <Text style={styles.diffFieldKey}>{key}</Text>
          <View style={styles.diffValuesCol}>
            <Text style={styles.diffBeforeText}>Antes: {valAntes}</Text>
            <Text style={styles.diffAfterText}>Depois: {valDepois}</Text>
          </View>
        </View>
      );
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Cabeçalho */}
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <Text style={styles.eyebrow}>TRILHA DE AUDITORIA</Text>
            <Text style={styles.title}>Histórico de Alterações</Text>
          </View>
          {onClose && (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityLabel="Fechar histórico de alterações"
            >
              <Icon name="X" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtro por Entidade */}
        <Text style={styles.filterSectionLabel}>FILTRAR POR ENTIDADE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {ENTITY_FILTERS.map(f => {
            const active = selectedEntity === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedEntity(f.id)}
                accessibilityLabel={`filtro-entidade-${f.id}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Filtro por Período */}
        <Text style={styles.filterSectionLabel}>FILTRAR POR PERÍODO</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {PERIOD_FILTERS.map(p => {
            const active = selectedPeriod === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedPeriod(p.id)}
                accessibilityLabel={`filtro-periodo-${p.id}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Lista de eventos */}
        {logs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhuma alteração encontrada</Text>
            <Text style={styles.emptySub}>
              As criações, edições e exclusões sensíveis aparecerão aqui em ordem cronológica.
            </Text>
          </View>
        ) : (
          logs.map(log => {
            const badge = formatActionBadge(log.acao);
            const isExpanded = selectedLogId === log.id;
            const formattedDate = new Date(log.data_hora).toLocaleString('pt-BR');

            return (
              <TouchableOpacity
                key={log.id}
                style={[styles.logCard, isExpanded && styles.logCardExpanded]}
                onPress={() => setSelectedLogId(isExpanded ? null : log.id)}
                activeOpacity={0.85}
                accessibilityLabel={`item-auditoria-${log.entidade}-${log.acao}`}
              >
                <View style={styles.logHeaderRow}>
                  <View style={[styles.actionBadge, { borderColor: badge.color }]}>
                    <Text style={[styles.actionBadgeText, { color: badge.color }]}>
                      {badge.label}
                    </Text>
                  </View>
                  <Text style={styles.logDateText}>{formattedDate}</Text>
                </View>

                <Text style={styles.logEntityTitle}>
                  Entidade: <Text style={styles.logEntityHighlight}>{log.entidade}</Text> • ID:{' '}
                  {log.entidade_id.substring(0, 12)}
                </Text>

                {isExpanded && (
                  <View style={styles.diffContainer} accessibilityLabel="detalhe-antes-depois">
                    <Text style={styles.diffHeader}>DETALHE DOS CAMPOS (ANTES / DEPOIS)</Text>
                    {renderDiffFields(log)}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
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
  content: {
    padding: spacing.md,
    paddingBottom: 48,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerTextCol: {
    flex: 1,
  },
  eyebrow: {
    ...typography.sectionLabel,
    color: colors.lime,
    marginBottom: 4,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  filterSectionLabel: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  chipsRow: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  chipActive: {
    backgroundColor: colors.limeDim,
    borderColor: colors.lime,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  chipTextActive: {
    ...typography.captionBold,
    color: colors.lime,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptySub: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  logCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  logCardExpanded: {
    borderColor: colors.lime,
  },
  logHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionBadge: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  logDateText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  logEntityTitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  logEntityHighlight: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  diffContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  diffHeader: {
    ...typography.sectionLabel,
    color: colors.lime,
    fontSize: 10,
    marginBottom: 6,
  },
  diffRow: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  diffRowChanged: {
    borderColor: colors.lime,
  },
  diffFieldKey: {
    ...typography.captionBold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  diffValuesCol: {
    gap: 2,
  },
  diffBeforeText: {
    ...typography.caption,
    color: colors.error,
    fontSize: 11,
  },
  diffAfterText: {
    ...typography.caption,
    color: colors.lime,
    fontSize: 11,
  },
  diffEmptyText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
