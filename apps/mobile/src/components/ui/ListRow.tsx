import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { theme } from '../../theme/tokens';
import { Icon, IconName } from '../Icon';

export interface ListRowProps {
  icon?: IconName | React.ReactNode;
  title: string;
  subtitle?: string;
  value?: string | React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  isFirst?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export const ListRow: React.FC<ListRowProps> = ({
  icon,
  title,
  subtitle,
  value,
  onPress,
  showChevron = true,
  isFirst = false,
  style,
  disabled = false,
  accessibilityLabel,
}) => {
  const renderIconTile = () => {
    if (!icon) return null;
    return (
      <View style={styles.iconTile}>
        {typeof icon === 'string' ? (
          <Icon name={icon as IconName} size={18} color={theme.colors.text} />
        ) : (
          icon
        )}
      </View>
    );
  };

  const content = (
    <View
      style={[
        styles.row,
        !isFirst && styles.topBorder,
        disabled && styles.disabled,
        style,
      ]}
    >
      {renderIconTile()}

      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value ? (
        typeof value === 'string' ? (
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        ) : (
          value
        )
      ) : null}

      {showChevron && (
        <Icon
          name="ChevronRight"
          size={16}
          color={theme.colors.textMuted}
          style={styles.chevron}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        accessibilityState={{ disabled }}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  topBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.lineSoft,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.m,
    backgroundColor: theme.colors.backgroundDeep,
    borderWidth: 1,
    borderColor: theme.colors.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontFamily: theme.fontFamily.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  subtitle: {
    fontFamily: theme.fontFamily.regular,
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  value: {
    fontFamily: theme.fontFamily.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.sm,
  },
  chevron: {
    marginLeft: theme.spacing.xs,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default ListRow;
