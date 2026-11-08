import React from 'react';
import { Text, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { theme } from '../../theme/tokens';

export interface SectionLabelProps {
  label: string;
  style?: StyleProp<TextStyle>;
  accessibilityRole?: 'header' | 'text';
}

export const SectionLabel: React.FC<SectionLabelProps> = ({
  label,
  style,
  accessibilityRole = 'header',
}) => {
  return (
    <Text
      style={[styles.eyebrow, style]}
      accessibilityRole={accessibilityRole}
    >
      {label}
    </Text>
  );
};

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: theme.fontFamily.bold,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
    marginVertical: 10,
  },
});

export default SectionLabel;
