"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Icon Catalog
// Browseable, categorized icon registry with search, naming taxonomy
// (icon/{category}/{name}), and custom icon set registration for enterprise.
// Default catalog ships ~80-100 curated Material Symbols entries with
// Iconify API fallback for anything not in the catalog.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ICON_CATALOG = void 0;
exports.getIconByName = getIconByName;
exports.getIconsByCategory = getIconsByCategory;
exports.searchIcons = searchIcons;
exports.registerCustomIconSet = registerCustomIconSet;
exports.resolveIconifyId = resolveIconifyId;
exports.getIconCategorySummary = getIconCategorySummary;
// ─── Helper to define entries concisely ────────────────────────────────────
function icon(category, slug, displayName, tags, aliases = [], iconifySlug) {
    return {
        name: `icon/${category}/${slug}`,
        displayName,
        category,
        tags,
        iconifyId: `material-symbols:${iconifySlug ?? slug}`,
        hasFilled: true,
        hasOutlined: true,
        aliases,
    };
}
// ─── Curated catalog entries ───────────────────────────────────────────────
const ACTION_ICONS = [
    icon("action", "delete", "Delete", ["remove", "trash", "bin"], ["trash", "bin"]),
    icon("action", "edit", "Edit", ["modify", "pencil", "write"], ["pencil"]),
    icon("action", "save", "Save", ["store", "disk", "floppy"], ["floppy"]),
    icon("action", "copy", "Copy", ["duplicate", "clone"], ["duplicate"]),
    icon("action", "share", "Share", ["send", "distribute"], []),
    icon("action", "download", "Download", ["save", "export", "get"], ["export"]),
    icon("action", "upload", "Upload", ["import", "send"], ["import"]),
    icon("action", "print", "Print", ["paper", "output"], []),
    icon("action", "settings", "Settings", ["gear", "preferences", "config"], ["gear", "cog", "preferences"]),
    icon("action", "search", "Search", ["find", "lookup", "magnify"], ["magnifier", "magnifying-glass", "find"]),
    icon("action", "add", "Add", ["plus", "create", "new"], ["plus", "create"]),
    icon("action", "remove", "Remove", ["minus", "subtract"], ["minus"]),
    icon("action", "done", "Done", ["check", "complete", "tick"], ["check", "checkmark", "tick"]),
    icon("action", "close", "Close", ["dismiss", "cancel", "x"], ["x", "dismiss", "cancel"]),
    icon("action", "refresh", "Refresh", ["reload", "sync", "update"], ["reload", "sync"]),
    icon("action", "open-in-new", "Open in New", ["external", "launch", "popout"], ["external", "launch"], "open-in-new"),
    icon("action", "drag-handle", "Drag Handle", ["reorder", "grip", "move"], ["grip", "reorder"], "drag-indicator"),
    icon("action", "more-horiz", "More", ["ellipsis", "overflow", "dots"], ["ellipsis", "dots", "three-dots"], "more-horiz"),
];
const NAVIGATION_ICONS = [
    icon("navigation", "arrow-back", "Arrow Back", ["left", "previous", "return"], ["back", "left"], "arrow-back"),
    icon("navigation", "arrow-forward", "Arrow Forward", ["right", "next", "proceed"], ["forward", "right"], "arrow-forward"),
    icon("navigation", "arrow-upward", "Arrow Up", ["up", "ascend"], ["up"], "arrow-upward"),
    icon("navigation", "arrow-downward", "Arrow Down", ["down", "descend"], ["down"], "arrow-downward"),
    icon("navigation", "chevron-left", "Chevron Left", ["caret", "previous"], ["caret-left"], "chevron-left"),
    icon("navigation", "chevron-right", "Chevron Right", ["caret", "next"], ["caret-right"], "chevron-right"),
    icon("navigation", "chevron-down", "Chevron Down", ["caret", "dropdown"], ["caret-down"], "keyboard-arrow-down"),
    icon("navigation", "chevron-up", "Chevron Up", ["caret", "collapse"], ["caret-up"], "keyboard-arrow-up"),
    icon("navigation", "menu", "Menu", ["hamburger", "nav", "sidebar"], ["hamburger", "nav"]),
    icon("navigation", "home", "Home", ["house", "main", "dashboard"], ["house", "dashboard"]),
    icon("navigation", "expand-more", "Expand More", ["show-more", "dropdown"], [], "expand-more"),
    icon("navigation", "expand-less", "Expand Less", ["show-less", "collapse"], [], "expand-less"),
];
const CONTENT_ICONS = [
    icon("content", "add-circle", "Add Circle", ["plus-circle", "create"], ["plus-circle"], "add-circle"),
    icon("content", "flag", "Flag", ["report", "mark"], ["report"]),
    icon("content", "bookmark", "Bookmark", ["save", "mark", "pin"], ["pin"]),
    icon("content", "inbox", "Inbox", ["mailbox", "messages"], ["mailbox"]),
    icon("content", "mail", "Mail", ["email", "envelope"], ["email", "envelope"]),
    icon("content", "send", "Send", ["submit", "dispatch"], ["submit"]),
    icon("content", "link", "Link", ["url", "chain", "hyperlink"], ["url", "chain"]),
    icon("content", "unlink", "Unlink", ["break-link", "disconnect"], ["break-link"], "link-off"),
    icon("content", "filter-list", "Filter", ["funnel", "sort", "sieve"], ["funnel", "filter"], "filter-list"),
    icon("content", "sort", "Sort", ["order", "arrange"], ["order"]),
];
const STATUS_ICONS = [
    icon("status", "check-circle", "Check Circle", ["success", "done", "complete"], ["success"], "check-circle"),
    icon("status", "error", "Error", ["danger", "alert", "fail"], ["danger", "fail"]),
    icon("status", "warning", "Warning", ["caution", "alert", "exclaim"], ["caution"]),
    icon("status", "info", "Info", ["information", "about", "help"], ["information"]),
    icon("status", "help", "Help", ["question", "support", "faq"], ["question"]),
    icon("status", "pending", "Pending", ["waiting", "clock", "loading"], ["waiting", "clock"], "schedule"),
    icon("status", "verified", "Verified", ["certified", "approved"], ["certified"], "verified"),
    icon("status", "block", "Block", ["forbidden", "deny", "ban"], ["forbidden", "ban"]),
];
const MEDIA_ICONS = [
    icon("media", "play", "Play", ["start", "resume"], ["start"]),
    icon("media", "pause", "Pause", ["hold", "suspend"], ["hold"]),
    icon("media", "stop", "Stop", ["halt", "end"], ["halt"]),
    icon("media", "volume-up", "Volume Up", ["speaker", "sound", "loud"], ["speaker", "sound"], "volume-up"),
    icon("media", "mic", "Microphone", ["record", "audio", "voice"], ["microphone", "record"]),
    icon("media", "camera", "Camera", ["photo", "picture", "snap"], ["photo"]),
];
const FILE_ICONS = [
    icon("file", "folder", "Folder", ["directory", "dir"], ["directory"]),
    icon("file", "file", "File", ["document", "page"], ["document", "doc"], "description"),
    icon("file", "attachment", "Attachment", ["paperclip", "attach"], ["paperclip"], "attach-file"),
    icon("file", "cloud", "Cloud", ["storage", "online"], ["storage"]),
    icon("file", "cloud-upload", "Cloud Upload", ["upload", "backup"], [], "cloud-upload"),
    icon("file", "cloud-download", "Cloud Download", ["download", "restore"], [], "cloud-download"),
];
const SOCIAL_ICONS = [
    icon("social", "person", "Person", ["user", "profile", "account"], ["user", "account"]),
    icon("social", "group", "Group", ["team", "people", "users"], ["team", "people", "users"]),
    icon("social", "share", "Share", ["distribute", "post"], []),
    icon("social", "thumb-up", "Thumb Up", ["like", "approve", "upvote"], ["like", "upvote"], "thumb-up"),
    icon("social", "thumb-down", "Thumb Down", ["dislike", "reject", "downvote"], ["dislike", "downvote"], "thumb-down"),
    icon("social", "notifications", "Notifications", ["bell", "alert", "notify"], ["bell", "alert"]),
];
const EDITOR_ICONS = [
    icon("editor", "format-bold", "Bold", ["strong", "weight"], ["bold", "strong"], "format-bold"),
    icon("editor", "format-italic", "Italic", ["emphasis", "slant"], ["italic"], "format-italic"),
    icon("editor", "code", "Code", ["source", "develop"], ["source"]),
    icon("editor", "text-fields", "Text", ["font", "type"], ["font", "type"], "text-fields"),
    icon("editor", "format-list-bulleted", "Bulleted List", ["unordered", "ul"], ["ul", "bullet-list"], "format-list-bulleted"),
    icon("editor", "format-list-numbered", "Numbered List", ["ordered", "ol"], ["ol", "number-list"], "format-list-numbered"),
];
const TOGGLE_ICONS = [
    icon("toggle", "visibility", "Visibility", ["show", "eye", "visible"], ["show", "eye"]),
    icon("toggle", "visibility-off", "Visibility Off", ["hide", "eye-off", "hidden"], ["hide", "eye-off"], "visibility-off"),
    icon("toggle", "star", "Star", ["rate", "favorite", "rating"], ["rate"]),
    icon("toggle", "favorite", "Favorite", ["heart", "love", "like"], ["heart", "love"]),
    icon("toggle", "bookmark-border", "Bookmark Empty", ["save-outline", "unsaved"], ["bookmark-outline"], "bookmark-border"),
];
const DEVICE_ICONS = [
    icon("device", "phone", "Phone", ["mobile", "cell", "smartphone"], ["mobile", "smartphone"], "smartphone"),
    icon("device", "laptop", "Laptop", ["computer", "notebook", "pc"], ["computer", "notebook"], "laptop-mac"),
    icon("device", "tablet", "Tablet", ["ipad", "pad"], ["ipad"], "tablet-mac"),
    icon("device", "watch", "Watch", ["wearable", "smartwatch"], ["smartwatch"], "watch"),
];
const COMMUNICATION_ICONS = [
    icon("communication", "call", "Call", ["phone", "dial", "ring"], ["phone", "dial"]),
    icon("communication", "chat", "Chat", ["message", "conversation"], ["message", "im"], "chat-bubble"),
    icon("communication", "email", "Email", ["mail", "envelope", "letter"], ["mail", "envelope"]),
    icon("communication", "forum", "Forum", ["discuss", "thread", "comment"], ["discuss", "comments"]),
];
// ─── Assemble default catalog ──────────────────────────────────────────────
const ALL_ENTRIES = [
    ...ACTION_ICONS,
    ...NAVIGATION_ICONS,
    ...CONTENT_ICONS,
    ...STATUS_ICONS,
    ...MEDIA_ICONS,
    ...FILE_ICONS,
    ...SOCIAL_ICONS,
    ...EDITOR_ICONS,
    ...TOGGLE_ICONS,
    ...DEVICE_ICONS,
    ...COMMUNICATION_ICONS,
];
exports.DEFAULT_ICON_CATALOG = {
    defaultLibrary: "material-symbols",
    entries: ALL_ENTRIES,
    customSets: [],
};
// ─── Lookup & Search ───────────────────────────────────────────────────────
/** Exact match by canonical name (e.g. "icon/action/search"). */
function getIconByName(name) {
    return ALL_ENTRIES.find((e) => e.name === name) ?? null;
}
/** Filter icons by category. */
function getIconsByCategory(category) {
    return ALL_ENTRIES.filter((e) => e.category === category);
}
/**
 * Score-based search across names, display names, tags, and aliases.
 * Returns results sorted by relevance (higher score first).
 * No external dependencies — uses substring + starts-with scoring.
 */
function searchIcons(query, options) {
    const q = query.toLowerCase().trim();
    if (!q)
        return [];
    const limit = options?.limit ?? 10;
    let pool = options?.category
        ? ALL_ENTRIES.filter((e) => e.category === options.category)
        : ALL_ENTRIES;
    // Also search custom sets
    for (const cs of exports.DEFAULT_ICON_CATALOG.customSets) {
        pool = pool.concat(options?.category
            ? cs.icons.filter((e) => e.category === options.category)
            : cs.icons);
    }
    const scored = [];
    for (const entry of pool) {
        let score = 0;
        // Exact slug match (highest priority)
        const slug = entry.name.split("/").pop() ?? "";
        if (slug === q) {
            score += 100;
        }
        else if (slug.startsWith(q)) {
            score += 60;
        }
        else if (slug.includes(q)) {
            score += 30;
        }
        // Display name match
        const dn = entry.displayName.toLowerCase();
        if (dn === q) {
            score += 80;
        }
        else if (dn.startsWith(q)) {
            score += 40;
        }
        else if (dn.includes(q)) {
            score += 20;
        }
        // Alias exact match (high priority — these are common user terms)
        for (const alias of entry.aliases) {
            if (alias === q) {
                score += 90;
                break;
            }
            if (alias.startsWith(q)) {
                score += 45;
                break;
            }
            if (alias.includes(q)) {
                score += 15;
                break;
            }
        }
        // Tag match
        for (const tag of entry.tags) {
            if (tag === q) {
                score += 50;
                break;
            }
            if (tag.startsWith(q)) {
                score += 25;
                break;
            }
            if (tag.includes(q)) {
                score += 10;
                break;
            }
        }
        if (score > 0) {
            scored.push({ entry, score });
        }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.entry);
}
// ─── Custom Icon Registration ──────────────────────────────────────────────
/**
 * Register a custom icon set at runtime. Enterprise teams call this at
 * plugin startup to add their branded icons to the catalog.
 */
function registerCustomIconSet(set) {
    // Prevent duplicate registration
    const idx = exports.DEFAULT_ICON_CATALOG.customSets.findIndex((cs) => cs.prefix === set.prefix);
    if (idx >= 0) {
        exports.DEFAULT_ICON_CATALOG.customSets[idx] = set;
    }
    else {
        exports.DEFAULT_ICON_CATALOG.customSets.push(set);
    }
}
// ─── Iconify ID Resolution ─────────────────────────────────────────────────
/**
 * Resolve the full Iconify API identifier for an icon entry.
 * For Material Symbols, appends "-outline" suffix for outlined variant.
 */
function resolveIconifyId(entry, type = "filled") {
    const base = entry.iconifyId;
    if (type === "outlined" && entry.hasOutlined) {
        // Material Symbols uses separate icon sets for filled vs outlined
        return base.replace("material-symbols:", "material-symbols:") + "-outline";
    }
    return base;
}
/**
 * Get all available icon categories with their entry counts.
 */
function getIconCategorySummary() {
    const counts = new Map();
    for (const entry of ALL_ENTRIES) {
        counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
    }
    for (const cs of exports.DEFAULT_ICON_CATALOG.customSets) {
        for (const entry of cs.icons) {
            counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
        }
    }
    return Array.from(counts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
}
//# sourceMappingURL=icon-catalog.js.map