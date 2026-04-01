/**
 * lib/tokens.js — Design token generator
 *
 * Shadow values are kept in sync with the semantic token catalog
 * (figma-intelligence-layer/src/shared/semantic-token-catalog.ts).
 * When updating shadows, update both files.
 */

// Canonical shadow values — single source shared with semantic-token-catalog.ts
const SHADOW_TOKENS = {
  light: {
    xs: '0 1px 2px rgba(0,0,0,0.05)',
    sm: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    md: '0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
    lg: '0 8px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04)',
    xl: '0 24px 64px rgba(0,0,0,0.14)',
  },
  dark: {
    xs: '0 1px 2px rgba(0,0,0,0.20)',
    sm: '0 2px 8px rgba(0,0,0,0.24), 0 1px 2px rgba(0,0,0,0.16)',
    md: '0 4px 16px rgba(0,0,0,0.32), 0 2px 4px rgba(0,0,0,0.16)',
    lg: '0 8px 32px rgba(0,0,0,0.40), 0 4px 8px rgba(0,0,0,0.16)',
    xl: '0 24px 64px rgba(0,0,0,0.56)',
  },
};

export { SHADOW_TOKENS };

export class TokenGenerator {
  generate({ palette, fonts, theme, darkMode }) {
    const shadowSet = darkMode ? SHADOW_TOKENS.dark : SHADOW_TOKENS.light;

    return {
      colors: {
        '--bg-primary':    palette.bgPrimary,
        '--bg-secondary':  palette.bgSecondary,
        '--bg-tertiary':   palette.bgTertiary,
        '--text-primary':  palette.textPrimary,
        '--text-secondary':palette.textSecondary,
        '--text-tertiary': palette.textTertiary,
        '--accent':        palette.accent,
        '--accent-soft':   palette.accentSoft,
        '--primary':       palette.primary,
        '--secondary':     palette.secondary,
        '--border':        palette.border,
        '--border-strong': palette.borderStrong,
        '--success':       '#10B981',
        '--error':         '#EF4444',
        '--warning':       '#F59E0B',
      },
      typography: {
        '--font-display': `'${fonts.display}', sans-serif`,
        '--font-body':    `'${fonts.body}', sans-serif`,
        '--font-mono':    `'${fonts.mono}', monospace`,
        '--text-xs':  '11px', '--text-sm': '13px', '--text-base': '15px',
        '--text-lg':  '18px', '--text-xl': '22px', '--text-2xl':  '28px',
        '--text-3xl': '36px', '--text-4xl':'48px', '--text-5xl':  '64px',
        '--leading-tight': '1.1', '--leading-snug': '1.3', '--leading-body': '1.6',
        '--tracking-tight': '-0.03em', '--tracking-normal': '0',
        '--tracking-wide': '0.05em', '--tracking-widest': '0.1em',
      },
      spacing: {
        '--space-1':'4px',   '--space-2': '8px',  '--space-3': '12px',
        '--space-4':'16px',  '--space-5':'20px',  '--space-6': '24px',
        '--space-8':'32px',  '--space-10':'40px', '--space-12':'48px',
        '--space-16':'64px', '--space-20':'80px', '--space-24':'96px',
      },
      radii: {
        '--radius-xs': '4px',   '--radius-sm': '8px',
        '--radius-md': '12px',  '--radius-lg': '16px',
        '--radius-xl': '24px',  '--radius-full': '9999px',
      },
      shadows: {
        '--shadow-xs': shadowSet.xs,
        '--shadow-sm': shadowSet.sm,
        '--shadow-md': shadowSet.md,
        '--shadow-lg': shadowSet.lg,
        '--shadow-xl': shadowSet.xl,
      },
    }
  }
}
