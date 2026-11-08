import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import * as LucideIcons from 'lucide-react-native';
import { theme } from '../theme/tokens';

export type IconName = keyof typeof LucideIcons;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = theme.colors.text,
  strokeWidth = 1.5,
  style,
}) => {
  const IconComponent = (LucideIcons as Record<string, any>)[name];

  if (!IconComponent) {
    return null;
  }

  return (
    <IconComponent
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      style={style}
    />
  );
};

export default Icon;
