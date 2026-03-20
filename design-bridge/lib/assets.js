/**
 * lib/assets.js
 * Unified asset resolver — all free APIs with automatic fallbacks.
 * No API = fallback. Every fallback is production-quality.
 */

// ── Image keyword → curated Unsplash photo IDs ───────────────
const PHOTO_MAP = {
  fintech: 'photo-1611974789855-9c2a0a7236a3',
  finance: 'photo-1554224155-6726b3ff858f',
  banking: 'photo-1501167786227-4cba60f6d58f',
  saas: 'photo-1551288049-bebda4e38f71',
  dashboard: 'photo-1460925895917-afdab827c52f',
  analytics: 'photo-1518186285589-2f7649de83e0',
  health: 'photo-1576091160399-112ba8d25d1d',
  medical: 'photo-1559757148-5c350d0d3c56',
  food: 'photo-1555396273-367ea4eb4db5',
  restaurant: 'photo-1414235077428-338989a2e8c0',
  travel: 'photo-1488646953014-85cb44e25828',
  hotel: 'photo-1542314831-068cd1dbfeeb',
  ecommerce: 'photo-1607082348824-0a96f2a4b9da',
  shop: 'photo-1441986300917-64674bd600d8',
  team: 'photo-1522071820081-009f0129c71c',
  people: 'photo-1529156069898-49953e39b3ac',
  abstract: 'photo-1618005182384-a83a8bd57fbe',
  hero: 'photo-1557804506-669a67965ba0',
  tech: 'photo-1518770660439-4636190af475',
  code: 'photo-1461749280684-dccba630e2f6',
  education: 'photo-1523050854058-8df90110c9f1',
  nature: 'photo-1441974231531-c6227db76b6e',
  city: 'photo-1477959858617-67f85cf4f1df',
  architecture: 'photo-1486325212027-8081e485255e',
  fitness: 'photo-1571019613454-1cb2f99b2d8b',
  music: 'photo-1511379938547-c1f69419868d',
  art: 'photo-1500462918059-b1a0cb512f1d',
  startup: 'photo-1559136555-9303baea8ebd',
  office: 'photo-1497366216548-37526070297c',
  minimal: 'photo-1618005182384-a83a8bd57fbe',
  dark: 'photo-1534796636912-3b95b3ab5986',
  gradient: 'photo-1557682224-5b8590cd9ec5',
}

// ── Icon context mapping ──────────────────────────────────────
const ICON_MAP = {
  navigation: ['lucide:menu', 'lucide:x', 'lucide:chevron-down', 'lucide:chevron-right', 'lucide:arrow-right', 'lucide:arrow-left'],
  user: ['lucide:user', 'lucide:users', 'lucide:user-circle', 'lucide:log-in', 'lucide:log-out'],
  action: ['lucide:plus', 'lucide:edit', 'lucide:trash', 'lucide:copy', 'lucide:share-2', 'lucide:download'],
  status: ['lucide:check', 'lucide:check-circle', 'lucide:x-circle', 'lucide:alert-circle', 'lucide:info'],
  content: ['lucide:star', 'lucide:heart', 'lucide:bookmark', 'lucide:eye', 'lucide:message-circle'],
  media: ['lucide:image', 'lucide:video', 'lucide:music', 'lucide:play', 'lucide:pause'],
  data: ['lucide:bar-chart-2', 'lucide:trending-up', 'lucide:trending-down', 'lucide:pie-chart', 'lucide:activity'],
  settings: ['lucide:settings', 'lucide:sliders', 'lucide:filter', 'lucide:search', 'lucide:bell'],
  ecommerce: ['lucide:shopping-cart', 'lucide:shopping-bag', 'lucide:credit-card', 'lucide:package', 'lucide:tag'],
  social: ['lucide:twitter', 'lucide:github', 'lucide:linkedin', 'lucide:instagram', 'lucide:youtube'],
}

export class AssetResolver {
  constructor(config) {
    this.config = config
    this.pixabayKey = config.pixabayKey || process.env.PIXABAY_API_KEY || ''
  }

  // ── Images ──────────────────────────────────────────────────
  async resolveImages(query, count = 5, orientation = 'landscape') {
    const keyword = this._extractKeyword(query)
    const results = []

    // Try Unsplash first
    if (this.config.unsplashKey) {
      try {
        const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=${orientation}`
        const res = await fetch(url, { headers: { Authorization: `Client-ID ${this.config.unsplashKey}` } })
        if (res.ok) {
          const data = await res.json()
          data.results?.forEach(photo => {
            results.push({
              url: `${photo.urls.raw}&w=1200&h=800&fit=crop&auto=format&q=80`,
              thumb: photo.urls.small,
              alt: photo.alt_description || query,
              source: 'unsplash',
              credit: photo.user.name,
            })
          })
          if (results.length >= count) return results.slice(0, count)
        }
      } catch { /* fall through */ }
    }

    // Try Pexels
    if (this.config.pexelsKey && results.length < count) {
      try {
        const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}`, {
          headers: { Authorization: this.config.pexelsKey }
        })
        if (res.ok) {
          const data = await res.json()
          data.photos?.forEach(photo => {
            if (results.length < count) {
              results.push({
                url: photo.src.large2x,
                thumb: photo.src.small,
                alt: photo.alt || query,
                source: 'pexels',
                credit: photo.photographer,
              })
            }
          })
          if (results.length >= count) return results
        }
      } catch { /* fall through */ }
    }

    // Try Pixabay (free with key, 5M+ images)
    if (this.pixabayKey && this.config.usePixabay && results.length < count) {
      try {
        const needed = count - results.length
        const res = await fetch(
          `https://pixabay.com/api/?q=${encodeURIComponent(query)}&key=${this.pixabayKey}&image_type=photo&per_page=${needed}&safesearch=true`
        )
        if (res.ok) {
          const data = await res.json()
          data.hits?.forEach(photo => {
            if (results.length < count) {
              results.push({
                url: photo.largeImageURL,
                thumb: photo.previewURL,
                alt: photo.tags || query,
                source: 'pixabay',
                credit: photo.user,
              })
            }
          })
        }
      } catch { /* fall through */ }
    }

    // Fallback: curated Unsplash photo IDs (no key needed via Source API)
    if (results.length < count) {
      const photoId = PHOTO_MAP[keyword] || PHOTO_MAP['abstract']
      for (let i = results.length; i < count; i++) {
        const seed = `${photoId}?w=1200&h=800&fit=crop&auto=format&q=80`
        results.push({
          url: `https://images.unsplash.com/${seed}&sig=${i}`,
          thumb: `https://images.unsplash.com/${seed}&w=400&sig=${i}`,
          alt: query,
          source: 'unsplash-source',
          credit: 'Unsplash',
        })
      }
    }

    return results.slice(0, count)
  }

  // ── Color Palette ───────────────────────────────────────────
  async resolvePalette(theme, darkMode = false) {
    const THEME_SEEDS = {
      modern:    '6366F1',
      editorial: 'DC2626',
      luxury:    'B45309',
      tech:      '0EA5E9',
    }
    const seed = THEME_SEEDS[theme] || THEME_SEEDS.modern
    return this.resolvePaletteFromSeed(`#${seed}`, 'analogic', darkMode)
  }

  async resolvePaletteFromSeed(seed, mode = 'analogic', darkMode = false) {
    const hex = seed.replace('#', '')
    
    if (this.config.useColorAPI) {
      try {
        const url = `https://www.thecolorapi.com/scheme?hex=${hex}&mode=${mode}&count=6`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          const swatches = data.colors.map(c => c.hex.value)
          return this._buildPaletteFromSwatches(swatches, darkMode)
        }
      } catch { /* fall through */ }
    }

    // Fallback: algorithmic palette
    return this._fallbackPalette(hex, darkMode)
  }

  _buildPaletteFromSwatches(swatches, darkMode) {
    return {
      accent: swatches[0],
      accentSoft: swatches[1],
      primary: swatches[2],
      secondary: swatches[3],
      bgPrimary: darkMode ? '#0F0F10' : '#FFFFFF',
      bgSecondary: darkMode ? '#1A1A1C' : '#F7F7F8',
      bgTertiary: darkMode ? '#26262A' : '#EEEEF0',
      textPrimary: darkMode ? '#FAFAFA' : '#0A0A0B',
      textSecondary: darkMode ? '#A1A1AA' : '#52525B',
      textTertiary: darkMode ? '#71717A' : '#A1A1AA',
      border: darkMode ? '#27272A' : '#E4E4E7',
      borderStrong: darkMode ? '#3F3F46' : '#D4D4D8',
    }
  }

  _fallbackPalette(hex, darkMode) {
    // Built-in palettes per theme
    const PALETTES = {
      '6366F1': { accent: '#6366F1', accentSoft: '#EEF2FF', primary: '#4F46E5', secondary: '#818CF8' },
      'DC2626': { accent: '#DC2626', accentSoft: '#FEF2F2', primary: '#B91C1C', secondary: '#F87171' },
      'B45309': { accent: '#B45309', accentSoft: '#FFFBEB', primary: '#92400E', secondary: '#D97706' },
      '0EA5E9': { accent: '#0EA5E9', accentSoft: '#F0F9FF', primary: '#0284C7', secondary: '#38BDF8' },
    }
    const base = PALETTES[hex] || PALETTES['6366F1']
    return {
      ...base,
      bgPrimary: darkMode ? '#0F0F10' : '#FFFFFF',
      bgSecondary: darkMode ? '#1A1A1C' : '#F7F7F8',
      bgTertiary: darkMode ? '#26262A' : '#EEEEF0',
      textPrimary: darkMode ? '#FAFAFA' : '#0A0A0B',
      textSecondary: darkMode ? '#A1A1AA' : '#52525B',
      textTertiary: darkMode ? '#71717A' : '#A1A1AA',
      border: darkMode ? '#27272A' : '#E4E4E7',
      borderStrong: darkMode ? '#3F3F46' : '#D4D4D8',
    }
  }

  // ── Icons ───────────────────────────────────────────────────
  async resolveIcons(query, count = 12) {
    const q = query.toLowerCase()
    let categories = ['navigation', 'action', 'status']
    
    if (/(shop|cart|product|buy|store)/.test(q)) categories = ['ecommerce', 'action', 'status']
    else if (/(data|chart|metric|analytic|stat)/.test(q)) categories = ['data', 'settings', 'status']
    else if (/(social|share|follow|like)/.test(q)) categories = ['social', 'content', 'action']
    else if (/(user|profile|account|team)/.test(q)) categories = ['user', 'action', 'settings']

    const iconNames = categories.flatMap(c => ICON_MAP[c] || []).slice(0, count)
    
    if (this.config.useIconify) {
      return this.fetchIconSVGs(iconNames)
    }
    return { names: iconNames, source: 'lucide-react', importLine: `import { ${iconNames.map(n => this._toPascalCase(n.split(':')[1])).join(', ')} } from 'lucide-react'` }
  }

  async fetchIconSVGs(iconNames) {
    const results = {}
    await Promise.allSettled(
      iconNames.map(async (name) => {
        try {
          const [set, icon] = name.includes(':') ? name.split(':') : ['lucide', name]
          const res = await fetch(`https://api.iconify.design/${set}/${icon}.svg?color=currentColor`)
          if (res.ok) {
            results[name] = { svg: await res.text(), name, set, icon }
          }
        } catch { /* skip */ }
      })
    )
    return results
  }

  // ── Fonts ───────────────────────────────────────────────────
  async resolveFonts(theme) {
    const FONT_PAIRS = {
      modern: {
        display: 'Cabinet Grotesk',
        body: 'DM Sans',
        mono: 'JetBrains Mono',
        googleUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700&family=JetBrains+Mono:wght@400;500&display=swap',
        cdnUrl: 'https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,700,800&display=swap',
      },
      editorial: {
        display: 'Playfair Display',
        body: 'Source Serif 4',
        mono: 'IBM Plex Mono',
        googleUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600&display=swap',
        cdnUrl: null,
      },
      luxury: {
        display: 'Cormorant Garamond',
        body: 'Jost',
        mono: 'Courier Prime',
        googleUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500&display=swap',
        cdnUrl: null,
      },
      tech: {
        display: 'Space Grotesk',
        body: 'IBM Plex Sans',
        mono: 'IBM Plex Mono',
        googleUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600&family=IBM+Plex+Mono:wght@400;500&display=swap',
        cdnUrl: null,
      },
    }
    return FONT_PAIRS[theme] || FONT_PAIRS.modern
  }

  // ── Mock Data ───────────────────────────────────────────────
  async resolveMockData(query) {
    const q = query.toLowerCase()
    const results = {}

    if (this.config.useJsonPlaceholder !== false) {
      try {
        if (/(user|profile|team|people|member)/.test(q)) {
          const res = await fetch('https://jsonplaceholder.typicode.com/users')
          if (res.ok) results.users = await res.json()
        }
        if (/(post|article|blog|news|content)/.test(q)) {
          const res = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=6')
          if (res.ok) results.posts = await res.json()
        }
        if (/(comment|review|feedback)/.test(q)) {
          const res = await fetch('https://jsonplaceholder.typicode.com/comments?_limit=5')
          if (res.ok) results.comments = await res.json()
        }
      } catch { /* skip */ }
    }
    return results
  }

  // ── Avatars ─────────────────────────────────────────────────
  async resolveAvatars(count = 5) {
    if (!this.config.useDiceBear) return []
    const styles = ['avataaars', 'personas', 'micah', 'lorelei', 'notionists']
    const style = styles[Math.floor(Math.random() * styles.length)]
    const names = ['Alex', 'Jordan', 'Morgan', 'Taylor', 'Casey', 'Riley', 'Quinn', 'Drew']
    return Array.from({ length: count }, (_, i) => ({
      url: `https://api.dicebear.com/9.x/${style}/svg?seed=${names[i % names.length]}&size=128`,
      name: names[i % names.length],
      style,
    }))
  }

  // ── API Health Check ────────────────────────────────────────
  async checkAllAPIs() {
    const checks = await Promise.allSettled([
      this.config.unsplashKey
        ? fetch(`https://api.unsplash.com/photos/random?client_id=${this.config.unsplashKey}`).then(r => r.ok)
        : Promise.resolve(false),
      this.config.pexelsKey
        ? fetch('https://api.pexels.com/v1/search?query=test&per_page=1', { headers: { Authorization: this.config.pexelsKey } }).then(r => r.ok)
        : Promise.resolve(false),
      fetch('https://www.thecolorapi.com/id?hex=6D28D9').then(r => r.ok).catch(() => false),
      fetch('https://api.iconify.design/lucide/star.svg').then(r => r.ok).catch(() => false),
      fetch('https://api.dicebear.com/9.x/avataaars/svg?seed=test').then(r => r.ok).catch(() => false),
      fetch('https://jsonplaceholder.typicode.com/users?_limit=1').then(r => r.ok).catch(() => false),
    ])

    return {
      unsplash:        { active: checks[0].value, keyRequired: true },
      pexels:          { active: checks[1].value, keyRequired: true },
      colorAPI:        { active: checks[2].value, keyRequired: false },
      iconify:         { active: checks[3].value, keyRequired: false },
      dicebear:        { active: checks[4].value, keyRequired: false },
      jsonPlaceholder: { active: checks[5].value, keyRequired: false },
      googleFonts:     { active: true, keyRequired: false },
      pixabay:         { active: true, keyRequired: false },
    }
  }

  // ── Helpers ─────────────────────────────────────────────────
  _extractKeyword(query) {
    const q = query.toLowerCase()
    return Object.keys(PHOTO_MAP).find(k => q.includes(k)) || 'abstract'
  }

  _toPascalCase(str) {
    return str.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('')
  }
}
