import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from './types';
import { DashboardScreen } from '../screens/DashboardScreen';
import { GarageScreen } from '../screens/GarageScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { useTheme } from '../theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Tela simples de ajustes/perfil
const SettingsScreen: React.FC = () => {
  const { colors, typography } = useTheme();
  return (
    <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
      <Text style={[typography.h2, { color: colors.textPrimary }]}>⚙️ Ajustes e Perfil</Text>
      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>
        Preferências, backup e sincronização
      </Text>
    </View>
  );
};

export const AppTabs: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
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
      {/* Botão Fake Central FAB na barra inferior */}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarButton: () => (
            <View style={styles.fabWrapper}>
              <TouchableOpacity
                style={[styles.fabButton, { backgroundColor: colors.lime }]}
                onPress={() => navigation.navigate('NewFuelingModal')}
                activeOpacity={0.85}
              >
                <Text style={[styles.fabIcon, { color: colors.black }]}>+</Text>
              </TouchableOpacity>
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
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
