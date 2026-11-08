import { TextStyle } from 'react-native';

export const colors = {
  background: '#090b0d',
  backgroundDeep: '#0f1113',
  surface: '#1c1f21',
  surfaceAlt: '#292e31',
  text: '#f0f1f2',
  textSecondary: '#a9b0b6',
  textMuted: '#8a9098',
  accent: '#c6ff4d',
  accentSoft: 'rgba(198,255,77,0.12)',
  accentLine: 'rgba(198,255,77,0.25)',
  danger: '#e05a5a',
  line: 'rgba(255,255,255,0.09)',
  lineSoft: 'rgba(255,255,255,0.08)',
} as const;

export const radius = {
  s: 12,
  m: 16,
  l: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const typography: Record<'title' | 'heading' | 'body' | 'caption' | 'eyebrow', TextStyle> = {
  title: {
    fontFamily: fontFamily.extraBold,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  heading: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    fontWeight: '700',
  },
  body: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    fontWeight: '600',
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    fontWeight: '500',
  },
  eyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
};

export const theme = {
  colors,
  radius,
  spacing,
  typography,
  fontFamily,
} as const;

export type Theme = typeof theme;
export type Colors = typeof colors;
export type Radius = typeof radius;
export type Spacing = typeof spacing;
export type Typography = typeof typography;
export type FontFamily = typeof fontFamily;

export default theme;
