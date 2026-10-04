import React from 'react';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { useTheme } from '../theme';

interface CentralFabProps {
  onPress: () => void;
}

export const CentralFab: React.FC<CentralFabProps> = ({ onPress }) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.button, { backgroundColor: colors.lime }]}>
        <Text style={[styles.icon, { color: colors.black }]}>+</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  button: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  icon: {
    fontSize: 30,
    fontWeight: 'bold',
    marginTop: -2,
  },
});
