export const colors = {
  paper: '#F4F1E9',
  paperDeep: '#EBE5DA',
  white: '#FFFDF8',
  ink: '#181815',
  inkSoft: '#3F3E38',
  inkMuted: '#66717D',
  bronze: '#A4774D',
  bronzeDark: '#775336',
  line: 'rgba(24,24,21,0.14)',
  lineStrong: 'rgba(24,24,21,0.35)',
  whatsapp: '#1F8F55',
  danger: '#8B2E2E',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 72,
};

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 16,
  pill: 999,
};

export const fonts = {
  serif: 'Italiana',
  sans: 'DMSans',
  sansMedium: 'DMSansMedium',
  sansBold: 'DMSansBold',
};

export const type = {
  eyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.inkSoft,
    textTransform: 'uppercase' as const,
  },
  h1: {
    fontFamily: fonts.serif,
    fontSize: 46,
    lineHeight: 48,
    color: colors.ink,
    letterSpacing: -0.8,
  },
  h2: {
    fontFamily: fonts.serif,
    fontSize: 34,
    lineHeight: 38,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  h3: {
    fontFamily: fonts.serif,
    fontSize: 24,
    lineHeight: 28,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: colors.inkSoft,
  },
  bodyStrong: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  small: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkSoft,
  },
  micro: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: colors.inkSoft,
  },
  button: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    letterSpacing: 0.6,
  },
  price: {
    fontFamily: fonts.serif,
    fontSize: 28,
    color: colors.ink,
  },
  numeral: {
    fontFamily: fonts.serif,
    fontSize: 56,
    color: colors.bronze,
    lineHeight: 56,
  },
};
