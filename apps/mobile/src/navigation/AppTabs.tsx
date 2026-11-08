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
import { Icon } from '../components/Icon';
import { DemoSection } from '../components/DemoSection';
import { Card, ListRow, SectionLabel, Button } from '../components/ui';

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="Settings" size={22} color={colors.textPrimary} />
            <Text style={[typography.h2, { color: colors.textPrimary }]}>Ajustes e Perfil</Text>
          </View>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
            Preferências da conta e sincronização offline-first
          </Text>
        </View>

        {/* Card do Usuário */}
        <Card style={styles.profileCard}>
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
        </Card>

        {/* Card de Sincronização em Nuvem (US02.6) */}
        <SyncStatusBadge variant="card" />

        {/* Grupo 1: DADOS */}
        <SectionLabel label="DADOS" />
        <Card style={styles.cardGroup}>
          <ListRow
            title="Criar Backup Local (.agbak)"
            subtitle="Exportar banco criptografado localmente"
            icon={<Icon name="Lock" size={18} color={colors.textSecondary} />}
            onPress={() => navigation.navigate('CreateBackupModal')}
            isFirst
          />
          <ListRow
            title="Restaurar Backup (.agbak)"
            subtitle="Restaurar a partir de arquivo local"
            icon={<Icon name="Download" size={18} color={colors.textSecondary} />}
            onPress={() => navigation.navigate('RestoreBackupModal')}
          />
          <ListRow
            title="Histórico de Alterações"
            subtitle="Auditoria e trilha de eventos"
            icon={<Icon name="FileText" size={18} color={colors.textSecondary} />}
            onPress={() => navigation.navigate('AuditHistoryModal')}
          />
          <ListRow
            title="Exportar Relatórios"
            subtitle="Relatórios em PDF e planilhas CSV"
            icon={<Icon name="Upload" size={18} color={colors.textSecondary} />}
            onPress={() => navigation.navigate('ReportExportModal')}
          />
        </Card>

        {/* Grupo 2: PREFERÊNCIAS */}
        <SectionLabel label="PREFERÊNCIAS" />
        <Card style={styles.cardGroup}>
          <ListRow
            title="Preferências Gerais"
            subtitle="Unidade e notificações do sistema"
            icon={<Icon name="Settings" size={18} color={colors.textSecondary} />}
            onPress={() => navigation.navigate('PreferencesModal')}
            isFirst
          />
          <ListRow
            title="Rever Tutorial"
            subtitle="Apresentação guiada de funcionalidades"
            icon={<Icon name="Target" size={18} color={colors.textSecondary} />}
            onPress={() => {
              TutorialService.startTour().catch(() => {});
            }}
          />
          <ListRow
            title="Análise de Consumo"
            subtitle="Média móvel e histórico"
            icon={<Icon name="TrendingUp" size={18} color={colors.textSecondary} />}
            onPress={() => navigation.navigate('ConsumptionModal')}
          />
          <ListRow
            title="Metas de Eficiência"
            subtitle="Metas de consumo e dicas"
            icon={<Icon name="Target" size={18} color={colors.textSecondary} />}
            onPress={() => navigation.navigate('EfficiencyGoalsModal')}
          />
          <ListRow
            title="Buscar e Filtros"
            subtitle="Busca avançada de registros"
            icon={<Icon name="Search" size={18} color={colors.textSecondary} />}
            onPress={() => navigation.navigate('SearchModal')}
          />
          <ListRow
            title="Modo Viagem"
            subtitle="Rotas, pedágios e custos"
            icon={<Icon name="Navigation" size={18} color={colors.textSecondary} />}
            onPress={() => navigation.navigate('TripModal')}
          />
          <ListRow
            title="Valor de Mercado"
            subtitle="Consulta Tabela FIPE"
            icon={<Icon name="Tag" size={18} color={colors.textSecondary} />}
            onPress={() => navigation.navigate('VehicleMarketValueModal')}
          />
          <ListRow
            title="Agendamentos de Manutenção"
            subtitle="Lembretes preventivos"
            icon={<Icon name="Calendar" size={18} color={colors.textSecondary} />}
            onPress={() => navigation.navigate('MaintenanceScheduleModal')}
          />
        </Card>

        {/* Seção de Demonstração (ETAPA 41 - restrita a builds de apresentação) */}
        <DemoSection />

        {/* Grupo 3: SOBRE */}
        <SectionLabel label="SOBRE" />
        <Card style={styles.cardGroup}>
          <ListRow
            title="Termos e Privacidade"
            subtitle="Política de privacidade e uso local"
            icon={<Icon name="FileText" size={18} color={colors.textSecondary} />}
            isFirst
          />
          <ListRow
            title="AutoGest Mobile"
            subtitle="Versão 1.0.0 (Build 42)"
            value="v1.0.0"
            icon={<Icon name="Shield" size={18} color={colors.textSecondary} />}
          />
        </Card>

        {/* Ação de Logout isolada como Button */}
        <View style={styles.logoutWrapper}>
          <Button
            label="Encerrar Sessão"
            variant="ghost"
            onPress={() => logout()}
            icon={<Icon name="LogOut" size={18} color={colors.error} />}
            labelStyle={{ color: colors.error }}
          />
        </View>

        {/* Versão do App centralizada em caption */}
        <View style={styles.footerNote}>
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
            AutoGest v1.0.0 • Gestão Inteligente de Veículos
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
            tabBarIcon: ({ color, size }) => <Icon name="LayoutDashboard" color={color} size={size ?? 20} />,
          }}
        />
        <Tab.Screen
          name="Garage"
          component={GarageScreen}
          options={{
            tabBarLabel: 'Garagem',
            tabBarIcon: ({ color, size }) => <Icon name="Car" color={color} size={size ?? 20} />,
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
                    <Icon name="Plus" size={24} color={colors.black} strokeWidth={2.5} />
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
            tabBarIcon: ({ color, size }) => <Icon name="TrendingUp" color={color} size={size ?? 20} />,
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: 'Ajustes',
            tabBarIcon: ({ color, size }) => <Icon name="Settings" color={color} size={size ?? 20} />,
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
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  cardGroup: {
    padding: 0,
    marginBottom: spacing.md,
    overflow: 'hidden',
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
  logoutWrapper: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
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
