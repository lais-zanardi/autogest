import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { theme } from '../../theme/tokens';
import { Icon, IconName } from '../Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName | React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  style,
  labelStyle,
  accessibilityLabel,
}) => {
  const getContainerStyle = (): StyleProp<ViewStyle> => {
    switch (variant) {
      case 'primary':
        return [
          styles.base,
          styles.primary,
          disabled && styles.disabledPrimary,
          style,
        ];
      case 'secondary':
        return [
          styles.base,
          styles.secondary,
          disabled && styles.disabledSecondary,
          style,
        ];
      case 'ghost':
        return [
          styles.base,
          styles.ghost,
          disabled && styles.disabledGhost,
          style,
        ];
    }
  };

  const getTextStyle = (): StyleProp<TextStyle> => {
    switch (variant) {
      case 'primary':
        return [
          styles.textBase,
          styles.primaryText,
          disabled && styles.disabledPrimaryText,
          labelStyle,
        ];
      case 'secondary':
        return [
          styles.textBase,
          styles.secondaryText,
          disabled && styles.disabledSecondaryText,
          labelStyle,
        ];
      case 'ghost':
        return [
          styles.textBase,
          styles.ghostText,
          disabled && styles.disabledGhostText,
          labelStyle,
        ];
    }
  };

  const renderIcon = () => {
    if (!icon) return null;
    if (typeof icon === 'string') {
      const iconColor =
        variant === 'primary' ? theme.colors.backgroundDeep : theme.colors.text;
      return (
        <Icon
          name={icon as IconName}
          size={18}
          color={disabled ? theme.colors.textMuted : iconColor}
          style={styles.iconSpacing}
        />
      );
    }
    return icon;
  };

  return (
    <TouchableOpacity
      style={getContainerStyle()}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled }}
    >
      {renderIcon()}
      <Text style={getTextStyle()}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 44,
    borderRadius: theme.radius.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  textBase: {
    fontFamily: theme.fontFamily.bold,
    fontSize: 14,
    fontWeight: '700',
  },
  primary: {
    backgroundColor: theme.colors.accent,
  },
  primaryText: {
    color: theme.colors.backgroundDeep, // #0f1113
  },
  secondary: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  secondaryText: {
    color: theme.colors.text,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  ghostText: {
    color: theme.colors.text,
  },
  iconSpacing: {
    marginRight: theme.spacing.sm,
  },
  disabledPrimary: {
    opacity: 0.5,
  },
  disabledSecondary: {
    opacity: 0.5,
  },
  disabledGhost: {
    opacity: 0.5,
  },
  disabledPrimaryText: {
    color: theme.colors.backgroundDeep,
  },
  disabledSecondaryText: {
    color: theme.colors.textMuted,
  },
  disabledGhostText: {
    color: theme.colors.textMuted,
  },
});

export default Button;
