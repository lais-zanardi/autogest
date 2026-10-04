export const colors = {
  background: '#0F1113',
  surface: '#161819',
  surfaceRaised: '#1C1F21',
  card: '#181B1D',
  border: 'rgba(255, 255, 255, 0.07)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
  lime: '#C6FF4D',
  limeAlt: '#C6FF00',
  limeDim: 'rgba(198, 255, 77, 0.12)',
  limeGlow: 'rgba(198, 255, 77, 0.06)',
  amber: '#F5C842',
  amberDim: 'rgba(245, 200, 66, 0.12)',
  textPrimary: '#F0F1F2',
  textSecondary: '#8A9098',
  textMuted: '#555C66',
  error: '#E05A5A',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ThemeColors = typeof colors;
