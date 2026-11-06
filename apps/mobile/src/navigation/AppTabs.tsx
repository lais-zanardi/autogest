import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { MainTabParamList } from './types';
import { DashboardScreen } from '../screens/DashboardScreen';
import { GarageScreen } from '../screens/GarageScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
import { CoachMarkProvider, CoachMarkTarget } from '../components/CoachMarkTour';
import { TutorialService } from '../services/tutorialService';
import { useAppStore } from '../store/useAppStore';
import { useTheme, spacing, radius } from '../theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Componente placeholder para a ação do FAB central
const DummyActionScreen: React.FC = () => null;

// Tela de ajustes/perfil com controle de sincronização (US02.6) e Dados e Segurança (US21.4 / US21.8)
const SettingsScreen: React.FC = () => {
  const { colors, typography } = useTheme();
  const { user, logout } = useAppStore();
  const navigation = useNavigation<any>();

  const getInitials = (name?: string) => {
    if (!name) return 'AG';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <SafeAreaView style={[styles.screenContainer, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.settingsScroll}>
        <View style={styles.settingsHeader}>
          <Text style={[typography.h2, { color: colors.textPrimary }]}>⚙️ Ajustes e Perfil</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
            Preferências da conta e sincronização offline-first
          </Text>
        </View>

        {/* Card do Usuário */}
        <View
          style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.avatarCircle, { backgroundColor: colors.lime }]}>
            <Text style={[styles.avatarText, { color: colors.black }]}>
              {getInitials(user?.name)}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
              {user?.name || 'Motorista AutoGest'}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {user?.email || 'usuario@autogest.app'}
            </Text>
          </View>
        </View>

        {/* Card de Sincronização em Nuvem (US02.6) */}
        <SyncStatusBadge variant="card" />

        {/* Seção Dados e Segurança (US21.4 & US21.8 — menu de configurações extensível pela US39) */}
        <Text
          style={[
            typography.sectionLabel,
            { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
          ]}
        >
          DADOS E SEGURANÇA
        </Text>
        <View
          style={[
            styles.actionSection,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.logoutButton,
              { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
            onPress={() => navigation.navigate('CreateBackupModal')}
            activeOpacity={0.7}
            accessibilityLabel="Dados e segurança › Criar backup"
          >
            <Text style={[styles.logoutText, { color: colors.lime }]}>
              🔐 Criar Backup Local (.agbak)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.logoutButton,
              { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
            onPress={() => navigation.navigate('RestoreBackupModal')}
            activeOpacity={0.7}
            accessibilityLabel="Dados e segurança › Restaurar backup"
          >
            <Text style={[styles.logoutText, { color: colors.textPrimary }]}>
              📥 Restaurar Backup (.agbak)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => navigation.navigate('AuditHistoryModal')}
            activeOpacity={0.7}
            accessibilityLabel="Dados e segurança › Histórico de alterações"
          >
            <Text style={[styles.logoutText, { color: colors.textPrimary }]}>
              📋 Histórico de Alterações (Auditoria)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Seção Preferências e Conta (US39.3) */}
        <Text
          style={[
            typography.sectionLabel,
            { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xs },
          ]}
        >
          CONTA E PREFERÊNCIAS
        </Text>
        <View
          style={[
            styles.actionSection,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.logoutButton,
              { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
            onPress={() => navigation.navigate('VehicleMarketValueModal')}
            activeOpacity={0.7}
            accessibilityLabel="Valor de Mercado e Tabela FIPE"
          >
            <Text style={[styles.logoutText, { color: colors.lime }]}>
              🏷️ Valor de Mercado (Tabela FIPE)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.logoutButton,
              { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
            onPress={() => navigation.navigate('ReportExportModal')}
            activeOpacity={0.7}
            accessibilityLabel="Exportar Relatórios em PDF e CSV"
          >
            <Text style={[styles.logoutText, { color: colors.lime }]}>
              📤 Exportar Relatórios (PDF e CSV)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.logoutButton,
              { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
            onPress={() => navigation.navigate('EfficiencyGoalsModal')}
            activeOpacity={0.7}
            accessibilityLabel="Metas de Eficiência e Recomendações"
          >
            <Text style={[styles.logoutText, { color: colors.lime }]}>
              🎯 Metas de Eficiência e Dicas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.logoutButton,
              { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
            onPress={() => navigation.navigate('TripModal')}
            activeOpacity={0.7}
            accessibilityLabel="Modo Viagem com Origem e Destino"
          >
            <Text style={[styles.logoutText, { color: colors.lime }]}>
              🛣️ Modo Viagem (Rotas e Custos)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.logoutButton,
              { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
            onPress={() => navigation.navigate('SearchModal')}
            activeOpacity={0.7}
            accessibilityLabel="Buscar e Filtros Avançados"
          >
            <Text style={[styles.logoutText, { color: colors.textPrimary }]}>
              🔍 Buscar e Filtros Avançados
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.logoutButton,
              { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
            onPress={() => navigation.navigate('ConsumptionModal')}
            activeOpacity={0.7}
            accessibilityLabel="Análise de Consumo e Média Móvel"
          >
            <Text style={[styles.logoutText, { color: colors.textPrimary }]}>
              📈 Análise de Consumo e Média Móvel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.logoutButton,
              { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
            onPress={() => navigation.navigate('PreferencesModal')}
            activeOpacity={0.7}
            accessibilityLabel="Configurações › Preferências"
          >
            <Text style={[styles.logoutText, { color: colors.textPrimary }]}>
              ⚙️ Preferências (Unidade e Notificações)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.logoutButton,
              { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
            onPress={() => {
              TutorialService.startTour().catch(() => {});
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.logoutText, { color: colors.textPrimary }]}>
              🎯 Rever Tutorial de Primeiro Acesso
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => logout()}
            activeOpacity={0.7}
          >
            <Text style={[styles.logoutText, { color: colors.error }]}>🚪 Encerrar Sessão</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerNote}>
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
            AutoGest v1.0.0 • Gestão Inteligente de Frotas e Veículos
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export const AppTabs: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const handleNavigateTourStep = (screen: 'Garage' | 'NewFuelingModal' | 'Dashboard') => {
    try {
      if (screen === 'NewFuelingModal') {
        navigation.navigate('MainTabs', { screen: 'Dashboard' });
      } else {
        navigation.navigate('MainTabs', { screen });
      }
    } catch {
      // Ignora caso navegador ainda esteja montando
    }
  };

  return (
    <CoachMarkProvider onNavigateStep={handleNavigateTourStep}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: colors.lime,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            tabBarLabel: 'Início',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📊</Text>,
          }}
        />
        <Tab.Screen
          name="Garage"
          component={GarageScreen}
          options={{
            tabBarLabel: 'Garagem',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🚘</Text>,
          }}
        />
        <Tab.Screen
          name="NewRefuelAction"
          component={DummyActionScreen}
          options={{
            tabBarLabel: '',
            tabBarButton: () => (
              <View style={styles.fabWrapper}>
                <CoachMarkTarget targetId="tour-target-first-refuel">
                  <TouchableOpacity
                    style={[styles.fabButton, { backgroundColor: colors.lime }]}
                    onPress={() => navigation.navigate('NewFuelingModal')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.fabIcon, { color: colors.black }]}>+</Text>
                  </TouchableOpacity>
                </CoachMarkTarget>
              </View>
            ),
          }}
        />
        <Tab.Screen
          name="Reports"
          component={ReportsScreen}
          options={{
            tabBarLabel: 'Relatórios',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📈</Text>,
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: 'Ajustes',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⚙️</Text>,
          }}
        />
      </Tab.Navigator>
    </CoachMarkProvider>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  settingsScroll: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  settingsHeader: {
    marginBottom: spacing.lg,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  actionSection: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  logoutButton: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontWeight: '600',
    fontSize: 14,
  },
  footerNote: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  fabWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    top: -14,
  },
  fabButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: -2,
  },
});
