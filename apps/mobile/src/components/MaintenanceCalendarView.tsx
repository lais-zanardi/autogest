import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaintenanceSchedule } from '@autogest/shared-types';
import { colors, spacing, radius, typography } from '../theme';

interface MaintenanceCalendarViewProps {
  schedules: MaintenanceSchedule[];
  selectedDate: string; // 'AAAA-MM-DD'
  onSelectDate: (date: string) => void;
  onSelectSchedule: (schedule: MaintenanceSchedule) => void;
  onCompleteSchedule: (schedule: MaintenanceSchedule) => void;
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const MaintenanceCalendarView: React.FC<MaintenanceCalendarViewProps> = ({
  schedules,
  selectedDate,
  onSelectDate,
  onSelectSchedule,
  onCompleteSchedule,
  currentMonth,
  onPrevMonth,
  onNextMonth,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Agrupa agendamentos por data
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, MaintenanceSchedule[]>();
    for (const s of schedules) {
      const list = map.get(s.date) || [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [schedules]);

  // Agendamentos em atraso (data < hoje e status === 'agendado')
  const overdueSchedules = useMemo(() => {
    return schedules.filter(
      s => s.status === 'agendado' && s.date < todayStr
    );
  }, [schedules, todayStr]);

  // Geração da grade de dias do mês atual
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      hasEvents: boolean;
      hasOverdue: boolean;
    }> = [];

    // Dias do mês anterior para completar primeira semana
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const prevDate = new Date(year, month - 1, d);
      const mStr = String(prevDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${prevDate.getFullYear()}-${mStr}-${dStr}`;
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        hasEvents: schedulesByDate.has(dateStr),
        hasOverdue: (schedulesByDate.get(dateStr) || []).some(
          s => s.status === 'agendado' && dateStr < todayStr
        ),
      });
    }

    // Dias do mês atual
    for (let d = 1; d <= totalDays; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        hasEvents: schedulesByDate.has(dateStr),
        hasOverdue: (schedulesByDate.get(dateStr) || []).some(
          s => s.status === 'agendado' && dateStr < todayStr
        ),
      });
    }

    // Completa última linha com dias do próximo mês
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const mStr = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${nextDate.getFullYear()}-${mStr}-${dStr}`;
      days.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: false,
        hasEvents: schedulesByDate.has(dateStr),
        hasOverdue: (schedulesByDate.get(dateStr) || []).some(
          s => s.status === 'agendado' && dateStr < todayStr
        ),
      });
    }

    return days;
  }, [currentMonth, schedulesByDate, todayStr]);

  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
  }, [currentMonth]);

  const selectedDaySchedules = useMemo(() => {
    return schedulesByDate.get(selectedDate) || [];
  }, [schedulesByDate, selectedDate]);

  return (
    <View style={styles.container}>
      {/* Seção de Atrasados */}
      {overdueSchedules.length > 0 && (
        <View style={styles.overdueSection}>
          <View style={styles.overdueHeader}>
            <Text style={styles.overdueIcon}>⚠️</Text>
            <Text style={styles.overdueTitle}>
              {overdueSchedules.length}{' '}
              {overdueSchedules.length === 1
                ? 'Agendamento Atrasado'
                : 'Agendamentos Atrasados'}
            </Text>
          </View>
          {overdueSchedules.map(item => (
            <View key={item.id} style={styles.overdueCard}>
              <View style={styles.scheduleInfo}>
                <Text style={styles.scheduleDesc}>{item.description}</Text>
                <Text style={styles.overdueDateText}>
                  Venceu em: {item.date} ({item.reminderTime})
                </Text>
              </View>
              <View style={styles.scheduleActions}>
                <TouchableOpacity
                  style={styles.completeMiniButton}
                  onPress={() => onCompleteSchedule(item)}
                >
                  <Text style={styles.completeMiniButtonText}>Concluir</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editMiniButton}
                  onPress={() => onSelectSchedule(item)}
                >
                  <Text style={styles.editMiniButtonText}>Editar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Navegação do Mês */}
      <View style={styles.monthHeader}>
        <TouchableOpacity onPress={onPrevMonth} style={styles.navButton}>
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{monthLabel.toUpperCase()}</Text>
        <TouchableOpacity onPress={onNextMonth} style={styles.navButton}>
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Cabeçalho dos Dias da Semana */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((w, idx) => (
          <Text key={idx} style={styles.weekdayLabel}>
            {w}
          </Text>
        ))}
      </View>

      {/* Grade de Dias */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((cell, idx) => {
          const isSelected = cell.dateStr === selectedDate;
          const isToday = cell.dateStr === todayStr;

          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.dayCell,
                isSelected && styles.dayCellSelected,
                isToday && !isSelected && styles.dayCellToday,
              ]}
              onPress={() => onSelectDate(cell.dateStr)}
            >
              <Text
                style={[
                  styles.dayNumber,
                  !cell.isCurrentMonth && styles.dayNumberDimmed,
                  isSelected && styles.dayNumberSelected,
                ]}
              >
                {cell.dayNumber}
              </Text>
              {cell.hasEvents && (
                <View
                  style={[
                    styles.eventDot,
                    cell.hasOverdue ? styles.eventDotOverdue : styles.eventDotActive,
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Lista do Dia Selecionado */}
      <View style={styles.selectedDaySection}>
        <Text style={styles.selectedDayTitle}>
          Agendamentos para {selectedDate}
        </Text>
        {selectedDaySchedules.length === 0 ? (
          <Text style={styles.emptyDayText}>Nenhuma manutenção agendada para este dia.</Text>
        ) : (
          selectedDaySchedules.map(item => {
            const isCompleted = item.status === 'concluido';
            const isCancelled = item.status === 'cancelado';
            return (
              <View key={item.id} style={styles.scheduleItemCard}>
                <View style={styles.scheduleItemHeader}>
                  <Text style={styles.scheduleItemType}>
                    {item.serviceType.replace('_', ' ').toUpperCase()}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      isCompleted && styles.statusBadgeCompleted,
                      isCancelled && styles.statusBadgeCancelled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isCompleted && styles.statusBadgeTextCompleted,
                        isCancelled && styles.statusBadgeTextCancelled,
                      ]}
                    >
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.scheduleItemDesc}>{item.description}</Text>
                <Text style={styles.scheduleItemTime}>
                  ⏰ Lembrete: {item.reminderTime}
                </Text>

                <View style={styles.scheduleItemFooter}>
                  {item.status === 'agendado' && (
                    <TouchableOpacity
                      style={styles.completeActionButton}
                      onPress={() => onCompleteSchedule(item)}
                    >
                      <Text style={styles.completeActionText}>✓ Concluir (US09)</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.editActionButton}
                    onPress={() => onSelectSchedule(item)}
                  >
                    <Text style={styles.editActionText}>Gerenciar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xl,
  },
  overdueSection: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  overdueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  overdueIcon: {
    fontSize: 18,
    marginRight: spacing.xs,
  },
  overdueTitle: {
    ...typography.labelMedium,
    color: colors.error,
    fontWeight: 'bold',
  },
  overdueCard: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleDesc: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  overdueDateText: {
    ...typography.labelSmall,
    color: colors.error,
    marginTop: 2,
  },
  scheduleActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  completeMiniButton: {
    backgroundColor: colors.lime,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  completeMiniButtonText: {
    ...typography.labelSmall,
    color: colors.background,
    fontWeight: 'bold',
  },
  editMiniButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  editMiniButtonText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  navButton: {
    padding: spacing.xs,
  },
  navButtonText: {
    fontSize: 24,
    color: colors.lime,
    fontWeight: 'bold',
  },
  monthTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xs,
  },
  weekdayLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    width: 40,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayCell: {
    width: 42,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: radius.md,
  },
  dayCellSelected: {
    backgroundColor: colors.lime,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: colors.lime,
  },
  dayNumber: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  dayNumberDimmed: {
    color: 'rgba(255, 255, 255, 0.2)',
  },
  dayNumberSelected: {
    color: colors.background,
    fontWeight: 'bold',
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  eventDotActive: {
    backgroundColor: colors.lime,
  },
  eventDotOverdue: {
    backgroundColor: colors.error,
  },
  selectedDaySection: {
    marginTop: spacing.lg,
  },
  selectedDayTitle: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyDayText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
  },
  scheduleItemCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  scheduleItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  scheduleItemType: {
    ...typography.labelSmall,
    color: colors.lime,
    letterSpacing: 0.5,
  },
  statusBadge: {
    backgroundColor: 'rgba(218, 255, 0, 0.15)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusBadgeCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusBadgeCancelled: {
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
  },
  statusBadgeText: {
    ...typography.labelSmall,
    color: colors.lime,
    fontSize: 10,
  },
  statusBadgeTextCompleted: {
    color: '#10B981',
  },
  statusBadgeTextCancelled: {
    color: colors.textSecondary,
  },
  scheduleItemDesc: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  scheduleItemTime: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  scheduleItemFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  completeActionButton: {
    backgroundColor: colors.lime,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  completeActionText: {
    ...typography.labelSmall,
    color: colors.background,
    fontWeight: 'bold',
  },
  editActionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  editActionText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
});
