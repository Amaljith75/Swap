// Design tokens. Dark-first, inspired by the reference set:
// near-black surfaces, a soft pastel gradient hero, lime accent for "confirmed".
export const colors = {
  bg: '#0E0E10',
  surface: '#1A1A1D',
  surfaceRaised: '#242428',
  sheet: '#FFFFFF',
  sheetMuted: '#F2F2F4',
  text: '#F5F5F7',
  textMuted: '#9A9AA2',
  textOnSheet: '#101012',
  textOnSheetMuted: '#6B6B73',
  accent: '#B7F34A',
  accentText: '#10130A',
  danger: '#FF6B6B',
  warning: '#F5C451',
  border: '#2C2C31',
  gradientHero: ['#F1F2A8', '#C9D4F0', '#EBD3EE'] as const,
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

export const type = {
  display: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
} as const;
