// Enhanced wedding theme colors
export const palette = {
  // Primary backgrounds
  midnight: '#0A0F1A',
  deepNavy: '#101824',
  navy: '#1A2536',
  
  // Accent colors
  gold: '#D4AF37',
  goldLight: '#E8C969',
  goldMuted: '#B8941F',
  
  // Romantic accents
  blush: '#F4E4E4',
  rose: '#E8B4B8',
  dustyRose: '#C9A0A0',
  
  // Neutrals
  cream: '#FAF8F5',
  ivory: '#F5F1EB',
  silver: '#C0C5CE',
  muted: '#8A95A5',
  
  // Surfaces
  cardDark: 'rgba(26, 37, 54, 0.95)',
  cardLight: 'rgba(255, 255, 255, 0.03)',
  overlay: 'rgba(10, 15, 26, 0.85)',
  
  // Functional
  success: '#4CAF50',
  error: '#E57373',
  heart: '#E57373'
};

export const theme = {
  // Backgrounds
  background: palette.midnight,
  backgroundSecondary: palette.deepNavy,
  card: palette.cardDark,
  cardElevated: palette.navy,
  
  // Text
  textPrimary: palette.cream,
  textSecondary: palette.muted,
  textMuted: palette.silver,
  
  // Accents
  accent: palette.gold,
  accentLight: palette.goldLight,
  accentMuted: palette.goldMuted,
  
  // Romantic touches
  romantic: palette.rose,
  romanticMuted: palette.dustyRose,
  
  // Borders & Dividers
  border: 'rgba(212, 175, 55, 0.15)',
  borderLight: 'rgba(255, 255, 255, 0.06)',
  divider: 'rgba(255, 255, 255, 0.04)',
  
  // Tab bar
  tabBar: palette.deepNavy,
  tabBarBorder: 'rgba(212, 175, 55, 0.2)',
  tabInactive: palette.muted,
  tabActive: palette.gold,
  
  // Functional
  success: palette.success,
  error: palette.error,
  heart: palette.heart
};

// Typography scale
export const typography = {
  hero: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.3
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.2
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24
  },
  caption: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20
  },
  small: {
    fontSize: 12,
    fontWeight: '400'
  }
};

// Spacing scale
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48
};

// Border radius scale
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999
};
