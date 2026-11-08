import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { theme } from '../../theme/tokens';
import { Icon, IconName } from '../Icon';

export interface IconButtonProps {
  icon: IconName | React.ReactNode;
  onPress: () => void;
  size?: number;
  iconColor?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  size = 18,
  iconColor = theme.colors.text,
  disabled = false,
  style,
  accessibilityLabel,
}) => {
  const renderIcon = () => {
    if (typeof icon === 'string') {
      return (
        <Icon
          name={icon as IconName}
          size={size}
          color={disabled ? theme.colors.textMuted : iconColor}
        />
      );
    }
    return icon;
  };

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      {renderIcon()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.m,
    backgroundColor: 'rgba(15,17,19,0.38)',
    borderWidth: 1,
    borderColor: theme.colors.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});

export default IconButton;
