/**
 * lib/prompt.js — System prompt builder
 * Assembles the rich prompt Claude receives with all pre-resolved assets.
 */
export class DesignPromptBuilder {
  build({ tokens, fonts, images, icons, mockData, avatars, stitchOutput, platform, darkMode }) {
    const iconSection = icons.importLine
      ? `Icons (import from lucide-react):\n${icons.importLine}`
      : `Icons (inline SVGs pre-resolved):\n${Object.keys(icons).slice(0, 8).map(k => `• ${k}`).join('\n')}`

    const imageSection = images.slice(0, 5).map((img, i) =>
      `• Image ${i + 1}: ${img.url}\n  Alt: "${img.alt}" | Source: ${img.source}`
    ).join('\n')

    const avatarSection = avatars.slice(0, 3).map((a, i) =>
      `• Avatar ${i + 1}: ${a.url} (${a.name})`
    ).join('\n')

    const tokenCSS = [
      ...Object.entries(tokens.colors),
      ...Object.entries(tokens.typography),
      ...Object.entries(tokens.spacing),
      ...Object.entries(tokens.radii),
      ...Object.entries(tokens.shadows),
    ].map(([k, v]) => `  ${k}: ${v};`).join('\n')

    const stitchSection = stitchOutput
      ? `\nStitch Base Design:\nUse this HTML/CSS as the layout foundation, then enhance it:\n${stitchOutput.html?.slice(0, 2000)}...\n`
      : ''

    return `You are a world-class UI engineer. Build a complete, production-grade ${platform} interface.

${stitchSection}

━━━ MANDATORY: USE THESE EXACT PRE-RESOLVED ASSETS ━━━━━━━━━━━

FONTS — Load BOTH these URLs in JSX (not useEffect):
  Display: '${fonts.display}'  →  ${fonts.cdnUrl || 'via Google Fonts'}
  Body:    '${fonts.body}'     →  ${fonts.googleUrl}

IMAGES — Use these EXACT URLs (real photos, not placeholders):
${imageSection}

AVATARS — Use for user lists, testimonials, teams:
${avatarSection}

${iconSection}

━━━ DESIGN TOKENS — USE THESE EXACT VALUES ━━━━━━━━━━━━━━━━━━

:root {
${tokenCSS}
}

━━━ IMPLEMENTATION RULES (NON-NEGOTIABLE) ━━━━━━━━━━━━━━━━━━━

1. FONTS: Load with <link> in JSX return. Never useEffect. Never document.head.
2. COLORS: Every color must reference a CSS variable. Zero hardcoded hex.
3. SPACING: Use only --space-* variables. No magic numbers.
4. TYPOGRAPHY: Letter-spacing on ALL headings: var(--tracking-tight)
               Line-height on body: var(--leading-body)
5. CARDS: hover → translateY(-4px) + shadow upgrade. Always.
6. TRANSITIONS: transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) on ALL interactive elements
7. IMAGES: Use Img component with onError fallback. NEVER broken images.
8. SECTIONS: Alternate --bg-primary and --bg-secondary
9. MOBILE: useBreakpoint(768) hook on all grids
10. EYEBROW: Every section gets a 12px uppercase tracked label above the heading
11. ANIMATION: Staggered fade-in on page load. Cards animate on scroll.
12. SHADOWS: Use shadow hierarchy — cards use --shadow-md, hover uses --shadow-lg
13. BORDER-RADIUS: Use --radius-lg (16px) for cards, --radius-full for pills/badges

━━━ COMPONENT QUALITY STANDARDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Nav:    sticky, backdropFilter blur(20px), scroll-aware border
Hero:   full-bleed image with gradient overlay, bold headline, CTA pair
Cards:  real photos, proper shadow, hover lift, loading skeleton
Buttons: primary (solid accent), secondary (ghost), tertiary (text)
Forms:  focus rings, validation states, inline labels
Footer: multi-column, muted text, proper spacing

${mockData.users ? `\nMock Users Data Available:\n${JSON.stringify(mockData.users.slice(0, 3), null, 2)}\nUse this for realistic user/team sections.` : ''}

Output: A single complete React JSX file. Default export. Zero required props. Production ready.`
  }
}
