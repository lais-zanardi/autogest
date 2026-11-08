import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../../theme/tokens';

export type CardVariant = 'default' | 'highlight';

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
  accessible?: boolean;
  accessibilityLabel?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  style,
  accessible,
  accessibilityLabel,
}) => {
  return (
    <View
      style={[
        styles.base,
        variant === 'highlight' ? styles.highlight : styles.default,
        style,
      ]}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.l, // radius l: 20
    padding: theme.spacing.lg, // padding: 16
  },
  default: {
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  highlight: {
    borderWidth: 1,
    borderColor: theme.colors.accentLine,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 4,
  },
});

export default Card;
