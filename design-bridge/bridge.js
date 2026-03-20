#!/usr/bin/env node

/**
 * MCP Design Bridge — bridge.js
 * The actual MCP server. Loaded after setup.js configures .env
 * All APIs are pre-wired. Zero config needed after setup.
 */

import { createServer } from './lib/server.js'
import { AssetResolver } from './lib/assets.js'
import { TokenGenerator } from './lib/tokens.js'
import { DesignPromptBuilder } from './lib/prompt.js'
import { StitchClient } from './lib/stitch.js'
import dotenv from 'dotenv'

dotenv.config()

const resolver = new AssetResolver({
  unsplashKey: process.env.UNSPLASH_ACCESS_KEY,
  pexelsKey: process.env.PEXELS_API_KEY,
  googleFontsKey: process.env.GOOGLE_FONTS_API_KEY,
  useColorAPI: process.env.USE_COLOR_API === 'true',
  useIconify: process.env.USE_ICONIFY === 'true',
  useDiceBear: process.env.USE_DICEBEAR === 'true',
  usePixabay: process.env.USE_PIXABAY === 'true',
})

const tokenGen = new TokenGenerator()
const promptBuilder = new DesignPromptBuilder()
const stitchClient = new StitchClient({
  apiKey: process.env.STITCH_API_KEY,
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  mode: process.env.STITCH_MODE || 'experimental',
})

const server = createServer({
  name: 'design-bridge',
  version: '1.0.0',
  tools: {

    // ── Primary tool: generate full UI ────────────────────────
    generate_ui: {
      description: 'Generate a complete, production-quality UI with real images, icons, fonts and color tokens. Returns React/HTML code.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'What UI to build' },
          theme: { type: 'string', enum: ['auto', 'modern', 'editorial', 'luxury', 'tech'], default: 'auto' },
          darkMode: { type: 'boolean', default: false },
          platform: { type: 'string', enum: ['web', 'mobile'], default: 'web' },
        },
        required: ['prompt'],
      },
      handler: async ({ prompt, theme = 'auto', darkMode = false, platform = 'web' }) => {
        const resolvedTheme = theme === 'auto' ? detectTheme(prompt) : theme

        // Step 1: Resolve all assets in parallel
        const [images, icons, palette, fonts, mockData, avatars] = await Promise.all([
          resolver.resolveImages(prompt, 5),
          resolver.resolveIcons(prompt, 12),
          resolver.resolvePalette(resolvedTheme, darkMode),
          resolver.resolveFonts(resolvedTheme),
          resolver.resolveMockData(prompt),
          resolver.resolveAvatars(3),
        ])

        // Step 2: Generate token set from resolved palette
        const tokens = tokenGen.generate({ palette, fonts, theme: resolvedTheme, darkMode })

        // Step 3: Try Stitch first if available
        let stitchOutput = null
        if (stitchClient.isConfigured()) {
          stitchOutput = await stitchClient.generate(prompt, platform).catch(() => null)
        }

        // Step 4: Build the rich prompt for Claude
        const systemPrompt = promptBuilder.build({
          tokens,
          fonts,
          images,
          icons,
          mockData,
          avatars,
          stitchOutput,
          platform,
          darkMode,
        })

        return {
          systemPrompt,
          resolvedAssets: { images, icons, palette, fonts, mockData, avatars },
          tokens,
          stitchAvailable: !!stitchOutput,
        }
      },
    },

    // ── Resolve images only ───────────────────────────────────
    resolve_images: {
      description: 'Find real photography for a given topic. Returns URLs from Unsplash/Pexels/Pixabay.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          count: { type: 'number', default: 5 },
          orientation: { type: 'string', enum: ['landscape', 'portrait', 'square'], default: 'landscape' },
        },
        required: ['query'],
      },
      handler: async ({ query, count = 5, orientation = 'landscape' }) => {
        return resolver.resolveImages(query, count, orientation)
      },
    },

    // ── Resolve a color palette ───────────────────────────────
    resolve_palette: {
      description: 'Generate a harmonious color palette for a given theme or seed color.',
      inputSchema: {
        type: 'object',
        properties: {
          seed: { type: 'string', description: 'Hex color or theme name (e.g. #6D28D9 or "ocean")' },
          mode: { type: 'string', enum: ['analogic', 'complement', 'triad', 'quad'], default: 'analogic' },
          darkMode: { type: 'boolean', default: false },
        },
        required: ['seed'],
      },
      handler: async ({ seed, mode = 'analogic', darkMode = false }) => {
        return resolver.resolvePaletteFromSeed(seed, mode, darkMode)
      },
    },

    // ── Resolve icons ─────────────────────────────────────────
    resolve_icons: {
      description: 'Get SVG icon strings for a list of icon names from Iconify (Lucide, Phosphor, Heroicons, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          icons: {
            type: 'array',
            items: { type: 'string' },
            description: 'Icon names e.g. ["lucide:arrow-right", "phosphor:star", "heroicons:bell"]',
          },
        },
        required: ['icons'],
      },
      handler: async ({ icons }) => {
        return resolver.fetchIconSVGs(icons)
      },
    },

    // ── Get design tokens ─────────────────────────────────────
    get_design_tokens: {
      description: 'Get a complete design token set (colors, typography, spacing, shadows, radii) for a theme.',
      inputSchema: {
        type: 'object',
        properties: {
          theme: { type: 'string', enum: ['modern', 'editorial', 'luxury', 'tech'], default: 'modern' },
          darkMode: { type: 'boolean', default: false },
          accentColor: { type: 'string', description: 'Optional hex accent color to override default' },
        },
      },
      handler: async ({ theme = 'modern', darkMode = false, accentColor }) => {
        const palette = await resolver.resolvePalette(theme, darkMode)
        if (accentColor) palette.accent = accentColor
        return tokenGen.generate({ palette, theme, darkMode })
      },
    },

    // ── Get bridge status ─────────────────────────────────────
    status: {
      description: 'Check which APIs are active and their status.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const status = await resolver.checkAllAPIs()
        return {
          bridge: 'online',
          version: '1.0.0',
          theme: process.env.DEFAULT_THEME || 'auto',
          apis: status,
          stitchConfigured: stitchClient.isConfigured(),
        }
      },
    },
  },
})

function detectTheme(prompt) {
  const p = prompt.toLowerCase()
  if (/(finance|bank|saas|dashboard|enterprise|analytics|data|metrics)/.test(p)) return 'tech'
  if (/(luxury|fashion|jewelry|beauty|premium|boutique|haute|couture)/.test(p)) return 'luxury'
  if (/(magazine|editorial|blog|news|article|media|journal|story)/.test(p)) return 'editorial'
  return process.env.DEFAULT_THEME === 'auto' ? 'modern' : (process.env.DEFAULT_THEME || 'modern')
}

server.start()
console.error('MCP Design Bridge running — all APIs active')
