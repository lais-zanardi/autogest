// Polyfill para AsyncStorage em ambiente Node.js / testes
if (typeof (global as any).window === 'undefined') {
  const store: Record<string, string> = {};
  (global as any).window = {
    localStorage: {
      getItem: (k: string) => store[k] || null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    },
  };
}

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../database/DatabaseConnection';
import { localMigrator } from '../database/migrations/localMigrator';
import '../database/migrations/010_create_local_preferencias';
import { TutorialService, ONBOARDING_TOUR_STEPS } from '../services/tutorialService';
import { useAppStore } from '../store/useAppStore';

describe('US03 — Tutorial Interativo de Primeiro Acesso', () => {
  beforeEach(async () => {
    await db.saveTableData('preferencias', []);
    await localMigrator.runMigrations();
    await TutorialService.resetForNewDevice();
    useAppStore.getState().logout();
  });

  describe('US03.1 & US03.2: Roteiro de Coach Marks Integrado à Navegação e Elementos Reais', () => {
    it('deve definir o roteiro estrito em 3 etapas: cadastro do veículo → primeiro abastecimento → dashboard', () => {
      assert.strictEqual(ONBOARDING_TOUR_STEPS.length, 3);

      // Etapa 1: Cadastro do veículo
      assert.strictEqual(ONBOARDING_TOUR_STEPS[0].id, 'cadastro_veiculo');
      assert.strictEqual(ONBOARDING_TOUR_STEPS[0].order, 1);
      assert.strictEqual(ONBOARDING_TOUR_STEPS[0].screen, 'Garage');
      assert.strictEqual(ONBOARDING_TOUR_STEPS[0].targetElementId, 'tour-target-vehicle-create');

      // Etapa 2: Primeiro abastecimento
      assert.strictEqual(ONBOARDING_TOUR_STEPS[1].id, 'primeiro_abastecimento');
      assert.strictEqual(ONBOARDING_TOUR_STEPS[1].order, 2);
      assert.strictEqual(ONBOARDING_TOUR_STEPS[1].screen, 'NewFuelingModal');
      assert.strictEqual(ONBOARDING_TOUR_STEPS[1].targetElementId, 'tour-target-first-refuel');

      // Etapa 3: Dashboard
      assert.strictEqual(ONBOARDING_TOUR_STEPS[2].id, 'dashboard');
      assert.strictEqual(ONBOARDING_TOUR_STEPS[2].order, 3);
      assert.strictEqual(ONBOARDING_TOUR_STEPS[2].screen, 'Dashboard');
      assert.strictEqual(ONBOARDING_TOUR_STEPS[2].targetElementId, 'tour-target-dashboard-metrics');
    });

    it('deve registrar as coordenadas dos elementos reais das telas (coach marks) e conduzir a navegação passo a passo até concluir', async () => {
      const visitedScreens: string[] = [];
      const navigateMock = (screen: string) => {
        visitedScreens.push(screen);
      };

      // Registra elementos reais das telas (como o CoachMarkTarget faz no onLayout)
      TutorialService.registerTargetLayout('tour-target-vehicle-create', {
        x: 24,
        y: 120,
        width: 312,
        height: 48,
      });
      TutorialService.registerTargetLayout('tour-target-first-refuel', {
        x: 164,
        y: 710,
        width: 52,
        height: 52,
      });
      TutorialService.registerTargetLayout('tour-target-dashboard-metrics', {
        x: 16,
        y: 200,
        width: 343,
        height: 280,
      });

      // Inicia o tour no primeiro acesso
      const step1State = await TutorialService.checkAndStartOnFirstAccess(navigateMock);
      assert.strictEqual(step1State.isVisible, true);
      assert.strictEqual(step1State.currentStepIndex, 0);
      assert.strictEqual(step1State.currentStep?.id, 'cadastro_veiculo');
      assert.strictEqual(visitedScreens[0], 'Garage');
      assert.deepStrictEqual(TutorialService.getTargetLayout('tour-target-vehicle-create'), {
        x: 24,
        y: 120,
        width: 312,
        height: 48,
      });

      // Avança para Etapa 2: Primeiro abastecimento
      const step2State = await TutorialService.nextStep(navigateMock);
      assert.strictEqual(step2State.isVisible, true);
      assert.strictEqual(step2State.currentStepIndex, 1);
      assert.strictEqual(step2State.currentStep?.id, 'primeiro_abastecimento');
      assert.strictEqual(visitedScreens[1], 'NewFuelingModal');

      // Avança para Etapa 3: Dashboard
      const step3State = await TutorialService.nextStep(navigateMock);
      assert.strictEqual(step3State.isVisible, true);
      assert.strictEqual(step3State.currentStepIndex, 2);
      assert.strictEqual(step3State.currentStep?.id, 'dashboard');
      assert.strictEqual(visitedScreens[2], 'Dashboard');

      // Avança após a última etapa -> conclui o tour e grava tutorial_concluido = true
      const finishedState = await TutorialService.nextStep(navigateMock);
      assert.strictEqual(finishedState.isVisible, false);
      assert.strictEqual(finishedState.tutorialConcluido, true);
      assert.strictEqual(await TutorialService.isTutorialCompleted(), true);
    });
  });

  describe('US03.3 & US03.4: Flag tutorial_concluido nas preferências locais, 1º vs 2º acesso, botão Pular e Novo Dispositivo', () => {
    it('US03.4: Primeiro acesso mostra o tour; o segundo acesso NÃO mostra o tour', async () => {
      // 1º Acesso: tutorial_concluido ainda é false -> deve exibir o tour
      const isCompletedBefore = await TutorialService.isTutorialCompleted();
      assert.strictEqual(isCompletedBefore, false);

      const firstAccessState = await TutorialService.checkAndStartOnFirstAccess();
      assert.strictEqual(firstAccessState.isVisible, true);
      assert.strictEqual(firstAccessState.currentStep?.id, 'cadastro_veiculo');

      // Conclui o tour no final do primeiro acesso
      await TutorialService.completeTour();
      assert.strictEqual(await TutorialService.isTutorialCompleted(), true);

      // Verifica persistência na tabela local `preferencias`
      const prefRows = await db.getTableData<any>('preferencias');
      const flagRow = prefRows.find((r: any) => r.key === 'tutorial_concluido');
      assert.ok(flagRow, 'Deve existir o registro tutorial_concluido na tabela local preferencias');
      assert.strictEqual(flagRow.value, true);

      // 2º Acesso no mesmo dispositivo: não deve exibir o tour!
      const secondAccessState = await TutorialService.checkAndStartOnFirstAccess();
      assert.strictEqual(secondAccessState.isVisible, false);
      assert.strictEqual(secondAccessState.tutorialConcluido, true);
    });

    it('US03.2 & US03.4: Botão "Pular" interrompe o tour imediatamente e marca tutorial_concluido como concluído', async () => {
      // Inicia no primeiro acesso
      const initial = await TutorialService.checkAndStartOnFirstAccess();
      assert.strictEqual(initial.isVisible, true);
      assert.strictEqual(initial.currentStepIndex, 0);

      // Usuário aciona o botão "Pular" logo na primeira etapa
      const afterSkip = await TutorialService.skipTour();
      assert.strictEqual(afterSkip.isVisible, false);
      assert.strictEqual(afterSkip.tutorialConcluido, true);
      assert.strictEqual(await TutorialService.isTutorialCompleted(), true);

      // Próximo acesso não exibe mais o tour porque pular marcou como concluído
      const nextAccess = await TutorialService.checkAndStartOnFirstAccess();
      assert.strictEqual(nextAccess.isVisible, false);
    });

    it('US03.3: Em um novo dispositivo (preferências locais limpas), o tutorial aparece de novo no primeiro acesso', async () => {
      // Dispositivo A: usuário pula ou conclui o tutorial
      await TutorialService.checkAndStartOnFirstAccess();
      await TutorialService.skipTour();
      assert.strictEqual(await TutorialService.isTutorialCompleted(), true);

      // Simula login em um Novo Dispositivo B (sem a preferência local `tutorial_concluido`)
      await TutorialService.resetForNewDevice();
      assert.strictEqual(await TutorialService.isTutorialCompleted(), false);

      const newDeviceFirstAccess = await TutorialService.checkAndStartOnFirstAccess();
      assert.strictEqual(
        newDeviceFirstAccess.isVisible,
        true,
        'Em um novo dispositivo o tour deve aparecer novamente no primeiro acesso',
      );
      assert.strictEqual(newDeviceFirstAccess.currentStep?.id, 'cadastro_veiculo');
    });
  });
});
