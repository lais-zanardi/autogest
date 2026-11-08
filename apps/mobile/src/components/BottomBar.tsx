import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CentralFab } from './CentralFab';
import { Icon } from './Icon';
import { useTheme } from '../theme';
import { theme as tokens } from '../theme/tokens';

interface BottomBarProps {
  currentScreen: string;
  onNavigate: (screenName: string) => void;
  onFabPress: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({ currentScreen, onNavigate, onFabPress }) => {
  const { colors } = useTheme();

  const isDashboard = currentScreen === 'Dashboard';
  const isGarage = currentScreen === 'Garage';
  const isReports = currentScreen === 'Reports';
  const isSettings = currentScreen === 'Settings';

  return (
    <View
      style={[styles.container, { backgroundColor: tokens.colors.surface, borderTopColor: tokens.colors.line }]}
    >
      <TouchableOpacity style={styles.tab} onPress={() => onNavigate('Dashboard')}>
        <Icon
          name="LayoutDashboard"
          size={20}
          color={isDashboard ? tokens.colors.accent : tokens.colors.textSecondary}
        />
        <Text
          style={[
            styles.tabText,
            { color: isDashboard ? tokens.colors.accent : tokens.colors.textSecondary },
          ]}
        >
          Dashboard
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tab} onPress={() => onNavigate('Garage')}>
        <Icon
          name="Car"
          size={20}
          color={isGarage ? tokens.colors.accent : tokens.colors.textSecondary}
        />
        <Text
          style={[
            styles.tabText,
            { color: isGarage ? tokens.colors.accent : tokens.colors.textSecondary },
          ]}
        >
          Garagem
        </Text>
      </TouchableOpacity>

      <CentralFab onPress={onFabPress} />

      <TouchableOpacity style={styles.tab} onPress={() => onNavigate('Reports')}>
        <Icon
          name="TrendingUp"
          size={20}
          color={isReports ? tokens.colors.accent : tokens.colors.textSecondary}
        />
        <Text
          style={[
            styles.tabText,
            { color: isReports ? tokens.colors.accent : tokens.colors.textSecondary },
          ]}
        >
          Relatórios
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tab} onPress={() => onNavigate('Settings')}>
        <Icon
          name="Settings"
          size={20}
          color={isSettings ? tokens.colors.accent : tokens.colors.textSecondary}
        />
        <Text
          style={[
            styles.tabText,
            { color: isSettings ? tokens.colors.accent : tokens.colors.textSecondary },
          ]}
        >
          Ajustes
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 64,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabText: {
    ...tokens.typography.caption,
  },
});

