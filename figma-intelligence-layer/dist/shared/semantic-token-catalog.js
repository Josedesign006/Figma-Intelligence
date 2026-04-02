"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Semantic Token Catalog
// Pure data module defining semantic tokens organized by category.
// Each token maps to light/dark primitive references for automatic alias
// creation by ds-scaffolder, ds-variables, and token-binder.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEMANTIC_TOKEN_CATALOG = void 0;
exports.getTokensByCategory = getTokensByCategory;
exports.getCategories = getCategories;
exports.getColorSemanticTokens = getColorSemanticTokens;
exports.getFloatSemanticTokens = getFloatSemanticTokens;
exports.getStringSemanticTokens = getStringSemanticTokens;
exports.getElevationTokens = getElevationTokens;
exports.getMotionTokens = getMotionTokens;
exports.getTypographyTokens = getTypographyTokens;
// ─── Color semantic tokens ──────────────────────────────────────────────────
const ACTIONS = [
    { name: "color/semantic/actions/primary/bg/default", category: "actions", type: "COLOR", description: "Primary action background", lightRef: "color/primitive/brand/500", darkRef: "color/primitive/brand/400" },
    { name: "color/semantic/actions/primary/bg/hover", category: "actions", type: "COLOR", description: "Primary action hover background", lightRef: "color/primitive/brand/600", darkRef: "color/primitive/brand/300" },
    { name: "color/semantic/actions/primary/bg/pressed", category: "actions", type: "COLOR", description: "Primary action pressed background", lightRef: "color/primitive/brand/700", darkRef: "color/primitive/brand/200" },
    { name: "color/semantic/actions/primary/bg/disabled", category: "actions", type: "COLOR", description: "Primary action disabled background", lightRef: "color/primitive/brand/200", darkRef: "color/primitive/brand/800" },
    { name: "color/semantic/actions/primary/text/default", category: "actions", type: "COLOR", description: "Text on primary action", lightRef: "color/primitive/neutral/50", darkRef: "color/primitive/neutral/950" },
    { name: "color/semantic/actions/secondary/bg/default", category: "actions", type: "COLOR", description: "Secondary action background", lightRef: "color/primitive/neutral/100", darkRef: "color/primitive/neutral/800" },
    { name: "color/semantic/actions/secondary/bg/hover", category: "actions", type: "COLOR", description: "Secondary action hover background", lightRef: "color/primitive/neutral/200", darkRef: "color/primitive/neutral/700" },
    { name: "color/semantic/actions/secondary/bg/pressed", category: "actions", type: "COLOR", description: "Secondary action pressed background", lightRef: "color/primitive/neutral/300", darkRef: "color/primitive/neutral/600" },
    { name: "color/semantic/actions/secondary/bg/disabled", category: "actions", type: "COLOR", description: "Secondary action disabled background", lightRef: "color/primitive/neutral/100", darkRef: "color/primitive/neutral/800" },
    { name: "color/semantic/actions/secondary/border/default", category: "actions", type: "COLOR", description: "Secondary action border", lightRef: "color/primitive/neutral/300", darkRef: "color/primitive/neutral/600" },
    { name: "color/semantic/actions/destructive/bg/default", category: "actions", type: "COLOR", description: "Destructive action background", lightRef: "color/primitive/danger/500", darkRef: "color/primitive/danger/400" },
    { name: "color/semantic/actions/destructive/bg/hover", category: "actions", type: "COLOR", description: "Destructive action hover background", lightRef: "color/primitive/danger/600", darkRef: "color/primitive/danger/300" },
];
const SURFACE = [
    { name: "color/semantic/surface/default", category: "surface", type: "COLOR", description: "Default surface background", lightRef: "color/primitive/neutral/50", darkRef: "color/primitive/neutral/950" },
    { name: "color/semantic/surface/subtle", category: "surface", type: "COLOR", description: "Subtle surface background", lightRef: "color/primitive/neutral/100", darkRef: "color/primitive/neutral/900" },
    { name: "color/semantic/surface/raised", category: "surface", type: "COLOR", description: "Raised/card surface", lightRef: "color/primitive/neutral/50", darkRef: "color/primitive/neutral/900" },
    { name: "color/semantic/surface/overlay", category: "surface", type: "COLOR", description: "Overlay/modal surface", lightRef: "color/primitive/neutral/50", darkRef: "color/primitive/neutral/800" },
    { name: "color/semantic/surface/inverse", category: "surface", type: "COLOR", description: "Inverse surface (dark on light)", lightRef: "color/primitive/neutral/900", darkRef: "color/primitive/neutral/50" },
    { name: "color/semantic/surface/disabled", category: "surface", type: "COLOR", description: "Disabled surface background", lightRef: "color/primitive/neutral/100", darkRef: "color/primitive/neutral/800" },
];
const TEXT = [
    { name: "color/semantic/text/primary", category: "text", type: "COLOR", description: "Primary text color", lightRef: "color/primitive/neutral/900", darkRef: "color/primitive/neutral/50" },
    { name: "color/semantic/text/secondary", category: "text", type: "COLOR", description: "Secondary text color", lightRef: "color/primitive/neutral/600", darkRef: "color/primitive/neutral/300" },
    { name: "color/semantic/text/tertiary", category: "text", type: "COLOR", description: "Tertiary/muted text color", lightRef: "color/primitive/neutral/500", darkRef: "color/primitive/neutral/400" },
    { name: "color/semantic/text/disabled", category: "text", type: "COLOR", description: "Disabled text color", lightRef: "color/primitive/neutral/400", darkRef: "color/primitive/neutral/600" },
    { name: "color/semantic/text/inverse", category: "text", type: "COLOR", description: "Inverse text (light on dark)", lightRef: "color/primitive/neutral/50", darkRef: "color/primitive/neutral/900" },
    { name: "color/semantic/text/on-color", category: "text", type: "COLOR", description: "Text on colored background", lightRef: "color/primitive/neutral/50", darkRef: "color/primitive/neutral/50" },
];
const BORDER = [
    { name: "color/semantic/border/default", category: "border", type: "COLOR", description: "Default border color", lightRef: "color/primitive/neutral/200", darkRef: "color/primitive/neutral/700" },
    { name: "color/semantic/border/strong", category: "border", type: "COLOR", description: "Strong/emphasis border", lightRef: "color/primitive/neutral/400", darkRef: "color/primitive/neutral/500" },
    { name: "color/semantic/border/subtle", category: "border", type: "COLOR", description: "Subtle border", lightRef: "color/primitive/neutral/100", darkRef: "color/primitive/neutral/800" },
    { name: "color/semantic/border/disabled", category: "border", type: "COLOR", description: "Disabled border", lightRef: "color/primitive/neutral/200", darkRef: "color/primitive/neutral/800" },
    { name: "color/semantic/border/focus", category: "border", type: "COLOR", description: "Focus ring border", lightRef: "color/primitive/brand/500", darkRef: "color/primitive/brand/400" },
];
const FIELD = [
    { name: "color/semantic/field/bg/default", category: "field", type: "COLOR", description: "Field background default", lightRef: "color/primitive/neutral/50", darkRef: "color/primitive/neutral/900" },
    { name: "color/semantic/field/bg/disabled", category: "field", type: "COLOR", description: "Field background disabled", lightRef: "color/primitive/neutral/100", darkRef: "color/primitive/neutral/800" },
    { name: "color/semantic/field/border/default", category: "field", type: "COLOR", description: "Field border default", lightRef: "color/primitive/neutral/300", darkRef: "color/primitive/neutral/600" },
    { name: "color/semantic/field/border/focus", category: "field", type: "COLOR", description: "Field border focus", lightRef: "color/primitive/brand/500", darkRef: "color/primitive/brand/400" },
];
const FEEDBACK = [
    { name: "color/semantic/feedback/success/bg", category: "feedback", type: "COLOR", description: "Success background", lightRef: "color/primitive/success/100", darkRef: "color/primitive/success/900" },
    { name: "color/semantic/feedback/success/text", category: "feedback", type: "COLOR", description: "Success text", lightRef: "color/primitive/success/700", darkRef: "color/primitive/success/300" },
    { name: "color/semantic/feedback/warning/bg", category: "feedback", type: "COLOR", description: "Warning background", lightRef: "color/primitive/warning/100", darkRef: "color/primitive/warning/900" },
    { name: "color/semantic/feedback/warning/text", category: "feedback", type: "COLOR", description: "Warning text", lightRef: "color/primitive/warning/700", darkRef: "color/primitive/warning/300" },
    { name: "color/semantic/feedback/danger/bg", category: "feedback", type: "COLOR", description: "Danger background", lightRef: "color/primitive/danger/100", darkRef: "color/primitive/danger/900" },
    { name: "color/semantic/feedback/danger/text", category: "feedback", type: "COLOR", description: "Danger text", lightRef: "color/primitive/danger/700", darkRef: "color/primitive/danger/300" },
    { name: "color/semantic/feedback/info/bg", category: "feedback", type: "COLOR", description: "Info background", lightRef: "color/primitive/info/100", darkRef: "color/primitive/info/900" },
    { name: "color/semantic/feedback/info/text", category: "feedback", type: "COLOR", description: "Info text", lightRef: "color/primitive/info/700", darkRef: "color/primitive/info/300" },
];
const FOCUS = [
    { name: "color/semantic/focus/ring", category: "focus", type: "COLOR", description: "Focus ring color", lightRef: "color/primitive/brand/500", darkRef: "color/primitive/brand/400" },
];
const INTERACTIVE = [
    { name: "color/semantic/interactive/hover-overlay", category: "interactive", type: "COLOR", description: "Hover overlay tint", lightRef: "color/primitive/neutral/100", darkRef: "color/primitive/neutral/800" },
    { name: "color/semantic/interactive/pressed-overlay", category: "interactive", type: "COLOR", description: "Pressed overlay tint", lightRef: "color/primitive/neutral/200", darkRef: "color/primitive/neutral/700" },
    { name: "color/semantic/interactive/selected-bg", category: "interactive", type: "COLOR", description: "Selected item background", lightRef: "color/primitive/brand/50", darkRef: "color/primitive/brand/900" },
    { name: "color/semantic/interactive/selected-text", category: "interactive", type: "COLOR", description: "Selected item text", lightRef: "color/primitive/brand/700", darkRef: "color/primitive/brand/200" },
];
// ─── Float semantic tokens ──────────────────────────────────────────────────
const SPACING_SEMANTIC = [
    { name: "space/semantic/inset/control/sm", category: "spacing", type: "FLOAT", description: "Control inset padding small", lightRef: "space/1", darkRef: "space/1" },
    { name: "space/semantic/inset/control/md", category: "spacing", type: "FLOAT", description: "Control inset padding medium", lightRef: "space/4", darkRef: "space/4" },
    { name: "space/semantic/inset/control/lg", category: "spacing", type: "FLOAT", description: "Control inset padding large", lightRef: "space/6", darkRef: "space/6" },
    { name: "space/semantic/inset/page", category: "spacing", type: "FLOAT", description: "Page-level inset padding", lightRef: "space/6", darkRef: "space/6" },
    { name: "space/semantic/inset/page/compact", category: "spacing", type: "FLOAT", description: "Compact page inset padding", lightRef: "space/4", darkRef: "space/4" },
    { name: "space/semantic/gap/stack/sm", category: "spacing", type: "FLOAT", description: "Vertical stack gap small", lightRef: "space/2", darkRef: "space/2" },
    { name: "space/semantic/gap/stack/md", category: "spacing", type: "FLOAT", description: "Vertical stack gap medium", lightRef: "space/4", darkRef: "space/4" },
    { name: "space/semantic/gap/stack/lg", category: "spacing", type: "FLOAT", description: "Vertical stack gap large", lightRef: "space/8", darkRef: "space/8" },
    { name: "space/semantic/gap/inline/sm", category: "spacing", type: "FLOAT", description: "Horizontal inline gap small", lightRef: "space/1", darkRef: "space/1" },
    { name: "space/semantic/gap/inline/md", category: "spacing", type: "FLOAT", description: "Horizontal inline gap medium", lightRef: "space/3", darkRef: "space/3" },
    { name: "space/semantic/gap/inline/lg", category: "spacing", type: "FLOAT", description: "Horizontal inline gap large", lightRef: "space/6", darkRef: "space/6" },
    { name: "space/semantic/gap/section", category: "spacing", type: "FLOAT", description: "Section-level vertical gap", lightRef: "space/12", darkRef: "space/12" },
];
const RADIUS_SEMANTIC = [
    { name: "radius/semantic/field/default", category: "radius", type: "FLOAT", description: "Field border radius", lightRef: "radius/sm", darkRef: "radius/sm" },
    { name: "radius/semantic/surface/default", category: "radius", type: "FLOAT", description: "Surface border radius", lightRef: "radius/lg", darkRef: "radius/lg" },
    { name: "radius/semantic/pill", category: "radius", type: "FLOAT", description: "Pill / full radius", lightRef: "radius/full", darkRef: "radius/full" },
    { name: "radius/semantic/control/default", category: "radius", type: "FLOAT", description: "Control border radius", lightRef: "radius/md", darkRef: "radius/md" },
];
// ─── Elevation / Shadow tokens ──────────────────────────────────────────────
const ELEVATION = [
    { name: "elevation/semantic/shadow/xs", category: "elevation", type: "STRING", description: "Extra-small shadow for subtle depth", lightRef: "0 1px 2px rgba(0,0,0,0.05)", darkRef: "0 1px 2px rgba(0,0,0,0.20)" },
    { name: "elevation/semantic/shadow/sm", category: "elevation", type: "STRING", description: "Small shadow for cards and raised elements", lightRef: "0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)", darkRef: "0 2px 8px rgba(0,0,0,0.24), 0 1px 2px rgba(0,0,0,0.16)" },
    { name: "elevation/semantic/shadow/md", category: "elevation", type: "STRING", description: "Medium shadow for dropdowns and popovers", lightRef: "0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)", darkRef: "0 4px 16px rgba(0,0,0,0.32), 0 2px 4px rgba(0,0,0,0.16)" },
    { name: "elevation/semantic/shadow/lg", category: "elevation", type: "STRING", description: "Large shadow for modals and dialogs", lightRef: "0 8px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04)", darkRef: "0 8px 32px rgba(0,0,0,0.40), 0 4px 8px rgba(0,0,0,0.16)" },
    { name: "elevation/semantic/shadow/xl", category: "elevation", type: "STRING", description: "Extra-large shadow for notifications", lightRef: "0 24px 64px rgba(0,0,0,0.14)", darkRef: "0 24px 64px rgba(0,0,0,0.56)" },
];
// ─── Motion / Animation tokens ──────────────────────────────────────────────
const MOTION = [
    // Durations
    { name: "motion/duration/instant", category: "motion", type: "FLOAT", description: "Instant feedback (0ms)", lightRef: "0", darkRef: "0" },
    { name: "motion/duration/fast", category: "motion", type: "FLOAT", description: "Micro-interactions (100ms)", lightRef: "100", darkRef: "100" },
    { name: "motion/duration/normal", category: "motion", type: "FLOAT", description: "Standard transitions (200ms)", lightRef: "200", darkRef: "200" },
    { name: "motion/duration/slow", category: "motion", type: "FLOAT", description: "Emphasis transitions (300ms)", lightRef: "300", darkRef: "300" },
    { name: "motion/duration/slower", category: "motion", type: "FLOAT", description: "Complex animations (500ms)", lightRef: "500", darkRef: "500" },
    // Easing curves
    { name: "motion/easing/productive", category: "motion", type: "STRING", description: "Productive motion curve", lightRef: "cubic-bezier(0.2, 0, 0.38, 0.9)", darkRef: "cubic-bezier(0.2, 0, 0.38, 0.9)" },
    { name: "motion/easing/expressive", category: "motion", type: "STRING", description: "Expressive motion curve", lightRef: "cubic-bezier(0.4, 0.14, 0.3, 1)", darkRef: "cubic-bezier(0.4, 0.14, 0.3, 1)" },
    { name: "motion/easing/enter", category: "motion", type: "STRING", description: "Enter/appear easing", lightRef: "cubic-bezier(0, 0, 0.3, 1)", darkRef: "cubic-bezier(0, 0, 0.3, 1)" },
    { name: "motion/easing/exit", category: "motion", type: "STRING", description: "Exit/disappear easing", lightRef: "cubic-bezier(0.4, 0, 1, 1)", darkRef: "cubic-bezier(0.4, 0, 1, 1)" },
    { name: "motion/easing/linear", category: "motion", type: "STRING", description: "Linear motion (no easing)", lightRef: "cubic-bezier(0, 0, 1, 1)", darkRef: "cubic-bezier(0, 0, 1, 1)" },
];
// ─── Z-index tokens ─────────────────────────────────────────────────────────
const Z_INDEX = [
    { name: "z-index/semantic/base", category: "z-index", type: "FLOAT", description: "Base stacking level", lightRef: "0", darkRef: "0" },
    { name: "z-index/semantic/dropdown", category: "z-index", type: "FLOAT", description: "Dropdown menu layer", lightRef: "1000", darkRef: "1000" },
    { name: "z-index/semantic/sticky", category: "z-index", type: "FLOAT", description: "Sticky header layer", lightRef: "1100", darkRef: "1100" },
    { name: "z-index/semantic/modal", category: "z-index", type: "FLOAT", description: "Modal/dialog layer", lightRef: "1300", darkRef: "1300" },
    { name: "z-index/semantic/popover", category: "z-index", type: "FLOAT", description: "Popover layer", lightRef: "1400", darkRef: "1400" },
    { name: "z-index/semantic/toast", category: "z-index", type: "FLOAT", description: "Toast notification layer", lightRef: "1500", darkRef: "1500" },
    { name: "z-index/semantic/tooltip", category: "z-index", type: "FLOAT", description: "Tooltip layer", lightRef: "1600", darkRef: "1600" },
];
// ─── Opacity tokens ─────────────────────────────────────────────────────────
const OPACITY = [
    { name: "opacity/semantic/disabled", category: "opacity", type: "FLOAT", description: "Disabled element opacity", lightRef: "0.4", darkRef: "0.4" },
    { name: "opacity/semantic/hover-overlay", category: "opacity", type: "FLOAT", description: "Hover overlay opacity", lightRef: "0.08", darkRef: "0.08" },
    { name: "opacity/semantic/backdrop", category: "opacity", type: "FLOAT", description: "Modal backdrop opacity", lightRef: "0.5", darkRef: "0.5" },
    { name: "opacity/semantic/loading", category: "opacity", type: "FLOAT", description: "Loading state opacity", lightRef: "0.6", darkRef: "0.6" },
];
// ─── Border-width tokens ────────────────────────────────────────────────────
const BORDER_WIDTH = [
    { name: "border-width/semantic/thin", category: "border-width", type: "FLOAT", description: "Thin border (1px)", lightRef: "1", darkRef: "1" },
    { name: "border-width/semantic/medium", category: "border-width", type: "FLOAT", description: "Medium border (2px)", lightRef: "2", darkRef: "2" },
    { name: "border-width/semantic/thick", category: "border-width", type: "FLOAT", description: "Thick border (3px)", lightRef: "3", darkRef: "3" },
];
// ─── Typography detail tokens ───────────────────────────────────────────────
const TYPOGRAPHY = [
    // Font weights
    { name: "typography/font-weight/regular", category: "typography", type: "FLOAT", description: "Regular weight (400)", lightRef: "400", darkRef: "400" },
    { name: "typography/font-weight/medium", category: "typography", type: "FLOAT", description: "Medium weight (500)", lightRef: "500", darkRef: "500" },
    { name: "typography/font-weight/semibold", category: "typography", type: "FLOAT", description: "Semibold weight (600)", lightRef: "600", darkRef: "600" },
    { name: "typography/font-weight/bold", category: "typography", type: "FLOAT", description: "Bold weight (700)", lightRef: "700", darkRef: "700" },
    // Line heights
    { name: "typography/line-height/tight", category: "typography", type: "FLOAT", description: "Tight line height (1.1)", lightRef: "1.1", darkRef: "1.1" },
    { name: "typography/line-height/snug", category: "typography", type: "FLOAT", description: "Snug line height (1.3)", lightRef: "1.3", darkRef: "1.3" },
    { name: "typography/line-height/normal", category: "typography", type: "FLOAT", description: "Normal line height (1.5)", lightRef: "1.5", darkRef: "1.5" },
    { name: "typography/line-height/relaxed", category: "typography", type: "FLOAT", description: "Relaxed line height (1.6)", lightRef: "1.6", darkRef: "1.6" },
    // Letter spacing
    { name: "typography/letter-spacing/tight", category: "typography", type: "FLOAT", description: "Tight letter spacing (-0.03em)", lightRef: "-0.03", darkRef: "-0.03" },
    { name: "typography/letter-spacing/normal", category: "typography", type: "FLOAT", description: "Normal letter spacing (0)", lightRef: "0", darkRef: "0" },
    { name: "typography/letter-spacing/wide", category: "typography", type: "FLOAT", description: "Wide letter spacing (0.05em)", lightRef: "0.05", darkRef: "0.05" },
    { name: "typography/letter-spacing/widest", category: "typography", type: "FLOAT", description: "Widest letter spacing (0.1em)", lightRef: "0.1", darkRef: "0.1" },
];
// ─── Icon size tokens ───────────────────────────────────────────────────────
const ICON_SIZE = [
    { name: "icon-size/semantic/xs", category: "icon-size", type: "FLOAT", description: "Extra-small icon (16px)", lightRef: "16", darkRef: "16" },
    { name: "icon-size/semantic/sm", category: "icon-size", type: "FLOAT", description: "Small icon (20px)", lightRef: "20", darkRef: "20" },
    { name: "icon-size/semantic/md", category: "icon-size", type: "FLOAT", description: "Medium icon (24px)", lightRef: "24", darkRef: "24" },
    { name: "icon-size/semantic/lg", category: "icon-size", type: "FLOAT", description: "Large icon (32px)", lightRef: "32", darkRef: "32" },
    { name: "icon-size/semantic/xl", category: "icon-size", type: "FLOAT", description: "Extra-large icon (40px)", lightRef: "40", darkRef: "40" },
];
// ─── Icon color tokens ─────────────────────────────────────────────────────
const ICON_COLOR = [
    { name: "color/semantic/icon/default", category: "icon", type: "COLOR", description: "Default icon color (inherits text)", lightRef: "color/primitive/neutral/900", darkRef: "color/primitive/neutral/50" },
    { name: "color/semantic/icon/primary", category: "icon", type: "COLOR", description: "Brand primary icon color", lightRef: "color/primitive/brand/500", darkRef: "color/primitive/brand/400" },
    { name: "color/semantic/icon/secondary", category: "icon", type: "COLOR", description: "Muted/supporting icon color", lightRef: "color/primitive/neutral/500", darkRef: "color/primitive/neutral/400" },
    { name: "color/semantic/icon/disabled", category: "icon", type: "COLOR", description: "Disabled icon color", lightRef: "color/primitive/neutral/300", darkRef: "color/primitive/neutral/600" },
    { name: "color/semantic/icon/inverse", category: "icon", type: "COLOR", description: "Icon on dark/inverse backgrounds", lightRef: "color/primitive/neutral/50", darkRef: "color/primitive/neutral/900" },
    { name: "color/semantic/icon/error", category: "icon", type: "COLOR", description: "Error/destructive icon color", lightRef: "color/primitive/danger/500", darkRef: "color/primitive/danger/400" },
    { name: "color/semantic/icon/success", category: "icon", type: "COLOR", description: "Success/positive icon color", lightRef: "color/primitive/success/500", darkRef: "color/primitive/success/400" },
];
// ─── Breakpoint tokens ──────────────────────────────────────────────────────
const BREAKPOINT = [
    { name: "breakpoint/mobile", category: "breakpoint", type: "FLOAT", description: "Mobile breakpoint (480px)", lightRef: "480", darkRef: "480" },
    { name: "breakpoint/tablet", category: "breakpoint", type: "FLOAT", description: "Tablet breakpoint (768px)", lightRef: "768", darkRef: "768" },
    { name: "breakpoint/desktop", category: "breakpoint", type: "FLOAT", description: "Desktop breakpoint (1024px)", lightRef: "1024", darkRef: "1024" },
    { name: "breakpoint/wide", category: "breakpoint", type: "FLOAT", description: "Wide breakpoint (1440px)", lightRef: "1440", darkRef: "1440" },
];
// ─── Grid / Layout tokens ───────────────────────────────────────────────────
const GRID = [
    { name: "grid/columns/mobile", category: "grid", type: "FLOAT", description: "Grid columns on mobile (4)", lightRef: "4", darkRef: "4" },
    { name: "grid/columns/tablet", category: "grid", type: "FLOAT", description: "Grid columns on tablet (8)", lightRef: "8", darkRef: "8" },
    { name: "grid/columns/desktop", category: "grid", type: "FLOAT", description: "Grid columns on desktop (12)", lightRef: "12", darkRef: "12" },
    { name: "grid/gutter/mobile", category: "grid", type: "FLOAT", description: "Grid gutter on mobile (16px)", lightRef: "16", darkRef: "16" },
    { name: "grid/gutter/tablet", category: "grid", type: "FLOAT", description: "Grid gutter on tablet (24px)", lightRef: "24", darkRef: "24" },
    { name: "grid/gutter/desktop", category: "grid", type: "FLOAT", description: "Grid gutter on desktop (32px)", lightRef: "32", darkRef: "32" },
    { name: "grid/margin/mobile", category: "grid", type: "FLOAT", description: "Grid margin on mobile (16px)", lightRef: "16", darkRef: "16" },
    { name: "grid/margin/tablet", category: "grid", type: "FLOAT", description: "Grid margin on tablet (32px)", lightRef: "32", darkRef: "32" },
    { name: "grid/margin/desktop", category: "grid", type: "FLOAT", description: "Grid margin on desktop (64px)", lightRef: "64", darkRef: "64" },
];
// ─── Density tokens ─────────────────────────────────────────────────────────
const DENSITY = [
    { name: "density/compact", category: "density", type: "FLOAT", description: "Compact control height (32px)", lightRef: "32", darkRef: "32" },
    { name: "density/normal", category: "density", type: "FLOAT", description: "Normal control height (40px)", lightRef: "40", darkRef: "40" },
    { name: "density/spacious", category: "density", type: "FLOAT", description: "Spacious control height (48px)", lightRef: "48", darkRef: "48" },
];
// ─── Aggregate catalog ──────────────────────────────────────────────────────
exports.SEMANTIC_TOKEN_CATALOG = [
    ...ACTIONS,
    ...SURFACE,
    ...TEXT,
    ...BORDER,
    ...FIELD,
    ...FEEDBACK,
    ...FOCUS,
    ...INTERACTIVE,
    ...SPACING_SEMANTIC,
    ...RADIUS_SEMANTIC,
    ...ELEVATION,
    ...MOTION,
    ...Z_INDEX,
    ...OPACITY,
    ...BORDER_WIDTH,
    ...TYPOGRAPHY,
    ...ICON_SIZE,
    ...ICON_COLOR,
    ...BREAKPOINT,
    ...GRID,
    ...DENSITY,
];
/**
 * Filter catalog entries by category.
 */
function getTokensByCategory(category) {
    return exports.SEMANTIC_TOKEN_CATALOG.filter((t) => t.category === category);
}
/**
 * Get all unique categories in the catalog.
 */
function getCategories() {
    return [...new Set(exports.SEMANTIC_TOKEN_CATALOG.map((t) => t.category))];
}
/**
 * Get only COLOR-type semantic tokens.
 */
function getColorSemanticTokens() {
    return exports.SEMANTIC_TOKEN_CATALOG.filter((t) => t.type === "COLOR");
}
/**
 * Get only FLOAT-type semantic tokens (spacing, radius, z-index, etc.).
 */
function getFloatSemanticTokens() {
    return exports.SEMANTIC_TOKEN_CATALOG.filter((t) => t.type === "FLOAT");
}
/**
 * Get only STRING-type semantic tokens (shadows, easing curves).
 */
function getStringSemanticTokens() {
    return exports.SEMANTIC_TOKEN_CATALOG.filter((t) => t.type === "STRING");
}
/**
 * Get elevation/shadow tokens.
 */
function getElevationTokens() {
    return exports.SEMANTIC_TOKEN_CATALOG.filter((t) => t.category === "elevation");
}
/**
 * Get motion tokens (durations and easing curves).
 */
function getMotionTokens() {
    return exports.SEMANTIC_TOKEN_CATALOG.filter((t) => t.category === "motion");
}
/**
 * Get typography detail tokens (weights, line-heights, letter-spacing).
 */
function getTypographyTokens() {
    return exports.SEMANTIC_TOKEN_CATALOG.filter((t) => t.category === "typography");
}
//# sourceMappingURL=semantic-token-catalog.js.map