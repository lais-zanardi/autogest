import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutChangeEvent,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { TutorialService, TutorialState, ONBOARDING_TOUR_STEPS } from '../services/tutorialService';
import { colors, spacing, radius, typography } from '../theme';

interface CoachMarkTargetProps {
  targetId: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * US03.1 & US03.2: Wrapper de Coach Mark (equivalente ao CopilotStep / WalkthroughableView)
 * que mede a posição real do elemento na tela e aplica realce visual quando a etapa correspondente está ativa.
 */
export const CoachMarkTarget: React.FC<CoachMarkTargetProps> = ({ targetId, style, children }) => {
  const [tutorialState, setTutorialState] = useState<TutorialState>(TutorialService.getState());

  useEffect(() => {
    return TutorialService.subscribe(setTutorialState);
  }, []);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    TutorialService.registerTargetLayout(targetId, { x, y, width, height });
  };

  const isHighlighted =
    tutorialState.isVisible && tutorialState.currentStep?.targetElementId === targetId;

  return (
    <View
      onLayout={handleLayout}
      style={[style, isHighlighted && styles.highlightedTarget]}
      accessibilityLabel={`coach-mark-${targetId}`}
    >
      {children}
    </View>
  );
};

interface CoachMarkProviderProps {
  onNavigateStep?: (screen: 'Garage' | 'NewFuelingModal' | 'Dashboard') => void;
  children: React.ReactNode;
}

/**
 * US03.1, US03.2 & US03.3: Provider de Coach Marks integrado à navegação principal.
 * Dispara automaticamente o tour no primeiro acesso do dispositivo e renderiza o card flutuante
 * com indicador de progresso, destaque do elemento real e botão "Pular".
 */
export const CoachMarkProvider: React.FC<CoachMarkProviderProps> = ({
  onNavigateStep,
  children,
}) => {
  const [state, setState] = useState<TutorialState>(TutorialService.getState());

  useEffect(() => {
    const unsubscribe = TutorialService.subscribe(setState);
    TutorialService.checkAndStartOnFirstAccess(onNavigateStep).catch(() => {});
    return unsubscribe;
  }, []);

  const step = state.currentStep;

  return (
    <View style={styles.root}>
      {children}

      {state.isVisible && step && (
        <View
          style={styles.overlayContainer}
          pointerEvents="box-none"
          accessibilityLabel="Tour interativo de primeiro acesso"
        >
          <View style={styles.coachCard}>
            <View style={styles.topRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>
                  PASSO {step.order} DE {state.totalSteps}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.skipBtn}
                onPress={() => {
                  TutorialService.skipTour().catch(() => {});
                }}
                accessibilityLabel="Pular tutorial"
                activeOpacity={0.7}
              >
                <Text style={styles.skipBtnText}>Pular</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.description}>{step.description}</Text>

            {/* Indicadores de etapas (dots) */}
            <View style={styles.dotsRow}>
              {ONBOARDING_TOUR_STEPS.map((s, idx) => (
                <View
                  key={s.id}
                  style={[
                    styles.dot,
                    idx === state.currentStepIndex && styles.dotActive,
                    idx < state.currentStepIndex && styles.dotCompleted,
                  ]}
                />
              ))}
            </View>

            <View style={styles.actionsRow}>
              {state.currentStepIndex > 0 && (
                <TouchableOpacity
                  style={styles.prevBtn}
                  onPress={() => {
                    TutorialService.previousStep(onNavigateStep).catch(() => {});
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.prevBtnText}>← Anterior</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.nextBtn}
                onPress={() => {
                  TutorialService.nextStep(onNavigateStep).catch(() => {});
                }}
                accessibilityLabel={step.ctaLabel}
                activeOpacity={0.85}
              >
                <Text style={styles.nextBtnText}>{step.ctaLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

// Alias compatível com nomenclatura react-native-copilot (US03.1)
export const CopilotProvider = CoachMarkProvider;
export const CopilotStep = CoachMarkTarget;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  highlightedTarget: {
    borderWidth: 2,
    borderColor: colors.lime,
    borderRadius: radius.md,
    backgroundColor: colors.limeGlow,
  },
  overlayContainer: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 82,
    zIndex: 999,
  },
  coachCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.lime,
    elevation: 10,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  stepBadge: {
    backgroundColor: colors.limeDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.lime,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.lime,
    letterSpacing: 0.8,
  },
  skipBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  skipBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: 4,
    marginBottom: 4,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceRaised,
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.lime,
  },
  dotCompleted: {
    backgroundColor: colors.limeDim,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  prevBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  nextBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.black,
  },
});
