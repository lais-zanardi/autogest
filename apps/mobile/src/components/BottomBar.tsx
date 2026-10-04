import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CentralFab } from './CentralFab';
import { useTheme } from '../theme';

interface BottomBarProps {
  currentScreen: string;
  onNavigate: (screenName: string) => void;
  onFabPress: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({ currentScreen, onNavigate, onFabPress }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
    >
      <TouchableOpacity style={styles.tab} onPress={() => onNavigate('Dashboard')}>
        <Text
          style={[
            styles.tabText,
            { color: currentScreen === 'Dashboard' ? colors.lime : colors.textSecondary },
          ]}
        >
          📊 Dashboard
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tab} onPress={() => onNavigate('Garage')}>
        <Text
          style={[
            styles.tabText,
            { color: currentScreen === 'Garage' ? colors.lime : colors.textSecondary },
          ]}
        >
          🚘 Garagem
        </Text>
      </TouchableOpacity>

      <CentralFab onPress={onFabPress} />

      <TouchableOpacity style={styles.tab} onPress={() => onNavigate('Reports')}>
        <Text
          style={[
            styles.tabText,
            { color: currentScreen === 'Reports' ? colors.lime : colors.textSecondary },
          ]}
        >
          📈 Relatórios
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.tab} onPress={() => onNavigate('Settings')}>
        <Text
          style={[
            styles.tabText,
            { color: currentScreen === 'Settings' ? colors.lime : colors.textSecondary },
          ]}
        >
          ⚙️ Ajustes
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
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
