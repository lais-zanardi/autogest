import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../database/DatabaseConnection';

export type OnboardingStepId = 'cadastro_veiculo' | 'primeiro_abastecimento' | 'dashboard';

export interface TargetLayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OnboardingTourStep {
  id: OnboardingStepId;
  order: number;
  screen: 'Garage' | 'NewFuelingModal' | 'Dashboard';
  targetElementId: string;
  title: string;
  description: string;
  ctaLabel: string;
}

/**
 * US03.2: Roteiro oficial do tour interativo de primeiro acesso:
 * 1. Cadastro do veículo (Garage)
 * 2. Primeiro abastecimento (NewFuelingModal / FAB)
 * 3. Dashboard em tempo real (Dashboard)
 */
export const ONBOARDING_TOUR_STEPS: OnboardingTourStep[] = [
  {
    id: 'cadastro_veiculo',
    order: 1,
    screen: 'Garage',
    targetElementId: 'tour-target-vehicle-create',
    title: '1. Cadastre seu Veículo',
    description:
      'Comece registrando seu veículo na Garagem com placa, modelo, capacidade do tanque e combustível preferencial.',
    ctaLabel: 'Próximo: Abastecimento →',
  },
  {
    id: 'primeiro_abastecimento',
    order: 2,
    screen: 'NewFuelingModal',
    targetElementId: 'tour-target-first-refuel',
    title: '2. Primeiro Abastecimento',
    description:
      'Use o botão central (+) ou o formulário de abastecimento para informar litros, valor e hodômetro e apurar seu consumo em km/l.',
    ctaLabel: 'Próximo: Dashboard →',
  },
  {
    id: 'dashboard',
    order: 3,
    screen: 'Dashboard',
    targetElementId: 'tour-target-dashboard-metrics',
    title: '3. Dashboard em Tempo Real',
    description:
      'Acompanhe aqui o gasto total do mês, custo médio por km, autonomia projetada do tanque e alertas de revisão preventiva.',
    ctaLabel: 'Concluir Tutorial ✓',
  },
];

export interface TutorialState {
  isVisible: boolean;
  currentStepIndex: number;
  currentStep: OnboardingTourStep | null;
  totalSteps: number;
  tutorialConcluido: boolean;
}

const TUTORIAL_PREF_KEY = 'tutorial_concluido';
const ASYNC_STORAGE_KEY = '@autogest:preferencias:tutorial_concluido';
const PREF_TABLE = 'preferencias';

type TutorialListener = (state: TutorialState) => void;

/**
 * US03.1, US03.2 & US03.3: Serviço de gerenciamento do Tutorial Interativo (Coach Marks)
 * e persistência local da flag `tutorial_concluido` por dispositivo.
 */
export class TutorialService {
  private static isVisible = false;
  private static currentStepIndex = 0;
  private static tutorialConcluidoCache: boolean | null = null;
  private static targetLayouts = new Map<string, TargetLayoutRect>();
  private static listeners = new Set<TutorialListener>();

  /**
   * Inscreve um listener de UI para reagir às mudanças de etapa ou visibilidade
   */
  static subscribe(listener: TutorialListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  static getState(): TutorialState {
    const step = this.isVisible ? ONBOARDING_TOUR_STEPS[this.currentStepIndex] || null : null;
    return {
      isVisible: this.isVisible,
      currentStepIndex: this.currentStepIndex,
      currentStep: step,
      totalSteps: ONBOARDING_TOUR_STEPS.length,
      tutorialConcluido: this.tutorialConcluidoCache ?? false,
    };
  }

  /**
   * US03.1 & US03.2: Registra as coordenadas do elemento real medido na tela pelo CoachMarkTarget
   */
  static registerTargetLayout(targetElementId: string, layout: TargetLayoutRect): void {
    this.targetLayouts.set(targetElementId, layout);
    this.notifyListeners();
  }

  static getTargetLayout(targetElementId: string): TargetLayoutRect | null {
    return this.targetLayouts.get(targetElementId) || null;
  }

  /**
   * US03.3: Verifica nas preferências locais do dispositivo se o tutorial já foi concluído
   */
  static async isTutorialCompleted(): Promise<boolean> {
    if (this.tutorialConcluidoCache === true) {
      return true;
    }

    try {
      const rows = await db.getTableData<{ id: string; key: string; value: any }>(PREF_TABLE);
      const found = rows.find(r => r.key === TUTORIAL_PREF_KEY);
      if (found && found.value === true) {
        this.tutorialConcluidoCache = true;
        return true;
      }
    } catch {
      // Continua para fallback do AsyncStorage
    }

    try {
      const raw = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
      if (raw === 'true') {
        this.tutorialConcluidoCache = true;
        return true;
      }
    } catch {
      // Ignora em ambiente sem AsyncStorage nativo
    }

    this.tutorialConcluidoCache = false;
    return false;
  }

  /**
   * US03.3: Grava a flag `tutorial_concluido = true` nas preferências locais do dispositivo
   */
  private static async setTutorialCompletedFlag(completed: boolean): Promise<void> {
    this.tutorialConcluidoCache = completed;
    const now = new Date().toISOString();

    try {
      const rows = await db.getTableData<{
        id: string;
        key: string;
        value: boolean;
        updatedAt: string;
      }>(PREF_TABLE);
      const filtered = rows.filter(r => r.key !== TUTORIAL_PREF_KEY);
      filtered.push({
        id: `pref_${TUTORIAL_PREF_KEY}`,
        key: TUTORIAL_PREF_KEY,
        value: completed,
        updatedAt: now,
      });
      await db.saveTableData(PREF_TABLE, filtered);
    } catch {
      // Ignora erro local
    }

    try {
      if (completed) {
        await AsyncStorage.setItem(ASYNC_STORAGE_KEY, 'true');
      } else {
        await AsyncStorage.removeItem(ASYNC_STORAGE_KEY);
      }
    } catch {
      // Ignora em ambiente de teste Node
    }
  }

  /**
   * US03.3 & US03.4: Verifica se é o primeiro acesso neste dispositivo;
   * se `tutorial_concluido` for falso, inicia o tour automaticamente na Etapa 1 (`Garage`).
   */
  static async checkAndStartOnFirstAccess(
    navigateToScreen?: (screen: 'Garage' | 'NewFuelingModal' | 'Dashboard') => void,
  ): Promise<TutorialState> {
    const completed = await this.isTutorialCompleted();
    if (completed) {
      this.isVisible = false;
      this.notifyListeners();
      return this.getState();
    }

    return this.startTour(navigateToScreen);
  }

  /**
   * Inicia o tour interativo a partir da Etapa 1 (`cadastro_veiculo`)
   */
  static async startTour(
    navigateToScreen?: (screen: 'Garage' | 'NewFuelingModal' | 'Dashboard') => void,
  ): Promise<TutorialState> {
    this.currentStepIndex = 0;
    this.isVisible = true;
    const firstStep = ONBOARDING_TOUR_STEPS[0];
    if (navigateToScreen && firstStep) {
      navigateToScreen(firstStep.screen);
    }
    this.notifyListeners();
    return this.getState();
  }

  /**
   * Avança para a próxima etapa do roteiro ou conclui ao final da 3ª etapa
   */
  static async nextStep(
    navigateToScreen?: (screen: 'Garage' | 'NewFuelingModal' | 'Dashboard') => void,
  ): Promise<TutorialState> {
    if (!this.isVisible) {
      return this.getState();
    }

    const nextIdx = this.currentStepIndex + 1;
    if (nextIdx >= ONBOARDING_TOUR_STEPS.length) {
      return this.completeTour();
    }

    this.currentStepIndex = nextIdx;
    const step = ONBOARDING_TOUR_STEPS[this.currentStepIndex];
    if (navigateToScreen && step) {
      navigateToScreen(step.screen);
    }
    this.notifyListeners();
    return this.getState();
  }

  /**
   * Retorna para a etapa anterior do roteiro
   */
  static async previousStep(
    navigateToScreen?: (screen: 'Garage' | 'NewFuelingModal' | 'Dashboard') => void,
  ): Promise<TutorialState> {
    if (!this.isVisible || this.currentStepIndex <= 0) {
      return this.getState();
    }

    this.currentStepIndex -= 1;
    const step = ONBOARDING_TOUR_STEPS[this.currentStepIndex];
    if (navigateToScreen && step) {
      navigateToScreen(step.screen);
    }
    this.notifyListeners();
    return this.getState();
  }

  /**
   * US03.2 & US03.4: Botão "Pular" — encerra imediatamente o tour e marca `tutorial_concluido = true`
   */
  static async skipTour(): Promise<TutorialState> {
    this.isVisible = false;
    await this.setTutorialCompletedFlag(true);
    this.notifyListeners();
    return this.getState();
  }

  /**
   * Conclui o tour normalmente ao final da última etapa e marca `tutorial_concluido = true`
   */
  static async completeTour(): Promise<TutorialState> {
    this.isVisible = false;
    await this.setTutorialCompletedFlag(true);
    this.notifyListeners();
    return this.getState();
  }

  /**
   * US03.3: Limpa as preferências locais para simular o primeiro acesso em um novo dispositivo
   */
  static async resetForNewDevice(): Promise<void> {
    this.isVisible = false;
    this.currentStepIndex = 0;
    this.tutorialConcluidoCache = false;
    this.targetLayouts.clear();
    await db.saveTableData(PREF_TABLE, []);
    try {
      await AsyncStorage.removeItem(ASYNC_STORAGE_KEY);
    } catch {
      // Ignora
    }
    this.notifyListeners();
  }
}
