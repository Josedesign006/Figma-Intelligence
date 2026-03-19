"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Component Recognizer  (Vision Pass 2)
// Identifies the UI component type, variants, and properties of a single zone.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.recognizeComponent = recognizeComponent;
const RECOGNIZE_PROMPT = `Analyze this UI region and identify the component. Return JSON with:
- componentType: specific UI component name (e.g. "PrimaryButton", "TextInput", "NavigationBar")
- variants: object of detected variants {size, state, theme, type}
- textContent: visible text content (null if none)
- iconPresent: boolean
- iconName: best guess for the icon or logo name (null if none)
- iconKind: "system" | "brand" | "illustration" | "unknown"
- preferredIconLibrary: best open-source icon family for this region, prefer "material-symbols" for standard UI and "simple-icons" for brands
- openSourceIconName: exact open-source icon slug if recognizable (examples: "menu", "search", "close", "shopping_cart")
- interactiveElement: boolean (is this clickable/focusable?)
- estimatedSpacing: measured padding/gap in pixels, prefer exact visual estimate over assumptions
- estimatedRadius: border radius in pixels if visible
- estimatedFontSize: visible text size in pixels if text is present
- fontFamilyGuess: closest visible font family name if text is present
- fontStyleGuess: closest visible font style name if text is present
- fontWeightGuess: closest visible font weight number if text is present
- confidence: 0-1 how confident you are in this identification

Return ONLY valid JSON.`;
/**
 * Run Vision Pass 2 on a single zone image to produce a ComponentManifest.
 */
async function recognizeComponent(zoneImage, vision) {
    void RECOGNIZE_PROMPT;
    return vision.identify(zoneImage);
}
//# sourceMappingURL=component-recognizer.js.map