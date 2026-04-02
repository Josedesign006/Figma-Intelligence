"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// figma_composition_builder — Compose multi-component patterns
//
// Builds composed UI patterns from natural language:
//   - "Login form" → Modal + 2 Inputs + Button + Link, wired with layout/tokens
//   - "Data table with filters" → Table + Search + Select + Pagination
//   - "Card with actions" → Card + Image + Text + Button Group
//
// Uses the component template catalog + design system tokens to wire up
// proper Auto Layout, spacing, and token bindings between components.
// Outputs a single frame containing all composed children.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.compositionBuilderHandler = compositionBuilderHandler;
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const component_templates_js_1 = require("../../../shared/component-templates.js");
// ─── Pattern Recognition ──────────────────────────────────────────────────
const PATTERN_RECIPES = [
    {
        keywords: /login\s*form|sign\s*in|auth/i,
        name: "Login Form",
        description: "Email/password login form with submit button",
        direction: "VERTICAL",
        components: [
            { name: "Input", label: "Email Input", variant: { Type: "Default" }, text: "Email address" },
            { name: "Input", label: "Password Input", variant: { Type: "Default" }, text: "Password" },
            { name: "Button", label: "Submit Button", variant: { Type: "Primary", Size: "lg" }, text: "Sign In" },
            { name: "Link", label: "Forgot Password", text: "Forgot password?" },
        ],
        wrapper: { cornerRadius: 12, fill: "color/surface/default", shadow: true },
    },
    {
        keywords: /sign\s*up|register|create\s*account/i,
        name: "Registration Form",
        description: "Account registration form with name, email, password fields",
        direction: "VERTICAL",
        components: [
            { name: "Input", label: "Name Input", text: "Full name" },
            { name: "Input", label: "Email Input", text: "Email address" },
            { name: "Input", label: "Password Input", text: "Password" },
            { name: "Input", label: "Confirm Password Input", text: "Confirm password" },
            { name: "Checkbox", label: "Terms Checkbox", text: "I agree to the Terms of Service" },
            { name: "Button", label: "Register Button", variant: { Type: "Primary", Size: "lg" }, text: "Create Account" },
        ],
        wrapper: { cornerRadius: 12, fill: "color/surface/default", shadow: true },
    },
    {
        keywords: /search\s*bar|search\s*(?:with|and)\s*filter|filter\s*bar/i,
        name: "Search with Filters",
        description: "Search input with filter controls",
        direction: "HORIZONTAL",
        components: [
            { name: "Input", label: "Search Input", variant: { Type: "Default" }, text: "Search..." },
            { name: "Select", label: "Category Filter", text: "All categories" },
            { name: "Button", label: "Search Button", variant: { Type: "Primary" }, text: "Search" },
        ],
    },
    {
        keywords: /card\s*(?:with|and)\s*action|action\s*card|product\s*card/i,
        name: "Card with Actions",
        description: "Content card with image, text, and action buttons",
        direction: "VERTICAL",
        components: [
            { name: "Card", label: "Card Container" },
            { name: "Badge", label: "Status Badge", text: "New" },
            { name: "Button", label: "Primary Action", variant: { Type: "Primary" }, text: "View Details" },
            { name: "Button", label: "Secondary Action", variant: { Type: "Secondary" }, text: "Save" },
        ],
        wrapper: { cornerRadius: 8, stroke: "color/border/default", shadow: true },
    },
    {
        keywords: /nav\s*bar|navigation\s*bar|header|top\s*bar|app\s*bar/i,
        name: "Navigation Bar",
        description: "Top navigation with logo, links, and user actions",
        direction: "HORIZONTAL",
        components: [
            { name: "Badge", label: "Logo", text: "Logo" },
            { name: "Link", label: "Nav Link 1", text: "Home" },
            { name: "Link", label: "Nav Link 2", text: "Products" },
            { name: "Link", label: "Nav Link 3", text: "About" },
            { name: "Input", label: "Search", text: "Search..." },
            { name: "Avatar", label: "User Avatar" },
        ],
    },
    {
        keywords: /modal|dialog|popup\s*(?:with|and)\s*form/i,
        name: "Modal Dialog",
        description: "Modal with header, form content, and action buttons",
        direction: "VERTICAL",
        components: [
            { name: "Input", label: "Form Field 1", text: "Name" },
            { name: "Input", label: "Form Field 2", text: "Description" },
            { name: "Textarea", label: "Long Text Field", text: "Additional details..." },
            { name: "Button", label: "Cancel", variant: { Type: "Secondary" }, text: "Cancel" },
            { name: "Button", label: "Submit", variant: { Type: "Primary" }, text: "Save" },
        ],
        wrapper: { cornerRadius: 12, fill: "color/surface/default", shadow: true },
    },
    {
        keywords: /settings|preferences|config/i,
        name: "Settings Panel",
        description: "Settings panel with toggles and inputs",
        direction: "VERTICAL",
        components: [
            { name: "Toggle", label: "Notifications Toggle", text: "Enable notifications" },
            { name: "Toggle", label: "Dark Mode Toggle", text: "Dark mode" },
            { name: "Select", label: "Language Select", text: "English" },
            { name: "Input", label: "Display Name", text: "Display name" },
            { name: "Button", label: "Save Settings", variant: { Type: "Primary" }, text: "Save Changes" },
        ],
    },
    {
        keywords: /empty\s*state|no\s*(?:data|results|items)|zero\s*state/i,
        name: "Empty State",
        description: "Empty state with illustration placeholder and CTA",
        direction: "VERTICAL",
        components: [
            { name: "Badge", label: "Icon Placeholder", text: "📭" },
            { name: "Badge", label: "Title", text: "No results found" },
            { name: "Badge", label: "Description", text: "Try adjusting your search or filters" },
            { name: "Button", label: "CTA Button", variant: { Type: "Primary" }, text: "Clear Filters" },
        ],
    },
    {
        keywords: /pagination|page\s*nav|pager/i,
        name: "Pagination Bar",
        description: "Page navigation with prev/next and page numbers",
        direction: "HORIZONTAL",
        components: [
            { name: "Button", label: "Previous", variant: { Type: "Secondary", Size: "sm" }, text: "← Previous" },
            { name: "Badge", label: "Page 1", text: "1" },
            { name: "Badge", label: "Page 2", text: "2" },
            { name: "Badge", label: "Page 3", text: "3" },
            { name: "Button", label: "Next", variant: { Type: "Secondary", Size: "sm" }, text: "Next →" },
        ],
    },
    {
        keywords: /toolbar|action\s*bar|button\s*group|button\s*bar/i,
        name: "Toolbar",
        description: "Horizontal toolbar with grouped actions",
        direction: "HORIZONTAL",
        components: [
            { name: "Button", label: "Action 1", variant: { Type: "Secondary", Size: "sm" }, text: "Edit" },
            { name: "Button", label: "Action 2", variant: { Type: "Secondary", Size: "sm" }, text: "Duplicate" },
            { name: "Button", label: "Action 3", variant: { Type: "Secondary", Size: "sm" }, text: "Delete" },
            { name: "Button", label: "Primary Action", variant: { Type: "Primary", Size: "sm" }, text: "Publish" },
        ],
    },
    {
        keywords: /footer|page\s*footer/i,
        name: "Footer",
        description: "Page footer with links and copyright",
        direction: "HORIZONTAL",
        components: [
            { name: "Link", label: "Link 1", text: "Privacy Policy" },
            { name: "Link", label: "Link 2", text: "Terms of Service" },
            { name: "Link", label: "Link 3", text: "Contact Us" },
            { name: "Badge", label: "Copyright", text: "© 2024 Company" },
        ],
    },
    {
        keywords: /notification|toast|alert\s*banner|announcement/i,
        name: "Notification Banner",
        description: "Dismissible notification with icon, message, and close button",
        direction: "HORIZONTAL",
        components: [
            { name: "Badge", label: "Icon", text: "ℹ️" },
            { name: "Badge", label: "Message", text: "Your changes have been saved successfully." },
            { name: "Button", label: "Dismiss", variant: { Type: "Ghost", Size: "sm" }, text: "✕" },
        ],
        wrapper: { cornerRadius: 8, fill: "color/surface/info" },
    },
];
function matchPattern(patternText) {
    for (const recipe of PATTERN_RECIPES) {
        if (recipe.keywords.test(patternText)) {
            return recipe;
        }
    }
    return null;
}
// ─── Plan builder ──────────────────────────────────────────────────────────
function buildPlan(args) {
    const width = args.frameWidth ?? 400;
    const spacing = args.spacing ?? 16;
    const padding = args.padding ?? 24;
    // Explicit component list
    if (args.components?.length) {
        const children = args.components.map((comp) => {
            const blueprint = component_templates_js_1.COMPONENT_BLUEPRINTS.find((b) => b.name.toLowerCase() === comp.name.toLowerCase());
            if (!blueprint) {
                // Fall back to a generic frame blueprint
                return {
                    blueprint: component_templates_js_1.COMPONENT_BLUEPRINTS.find((b) => b.name === "Button"), // fallback
                    label: comp.name,
                    variant: comp.props,
                    count: comp.count ?? 1,
                    customText: comp.name,
                };
            }
            return {
                blueprint,
                label: comp.name,
                variant: comp.props,
                count: comp.count ?? 1,
            };
        });
        return {
            name: "Custom Composition",
            description: `Custom composition: ${args.components.map((c) => c.name).join(" + ")}`,
            direction: args.layoutDirection ?? "VERTICAL",
            spacing,
            padding,
            width,
            children,
        };
    }
    // Pattern matching
    const recipe = matchPattern(args.pattern);
    if (recipe) {
        const children = recipe.components.map((comp) => {
            const blueprint = component_templates_js_1.COMPONENT_BLUEPRINTS.find((b) => b.name.toLowerCase() === comp.name.toLowerCase()) ?? component_templates_js_1.COMPONENT_BLUEPRINTS[0]; // fallback to first blueprint
            return {
                blueprint,
                label: comp.label,
                variant: comp.variant,
                count: comp.count ?? 1,
                customText: comp.text,
            };
        });
        return {
            name: recipe.name,
            description: recipe.description,
            direction: args.layoutDirection ?? recipe.direction,
            spacing,
            padding,
            width,
            children,
            wrapperStyle: recipe.wrapper,
        };
    }
    // Fallback: try to extract component names from the pattern text
    const words = args.pattern.toLowerCase().split(/[\s,+&]+/);
    const matched = [];
    for (const word of words) {
        const blueprint = component_templates_js_1.COMPONENT_BLUEPRINTS.find((b) => b.name.toLowerCase() === word || b.name.toLowerCase().includes(word));
        if (blueprint && !matched.find((m) => m.blueprint.name === blueprint.name)) {
            matched.push({ blueprint, label: blueprint.name, count: 1 });
        }
    }
    if (matched.length > 0) {
        return {
            name: "Auto-detected Composition",
            description: `Composed from: ${matched.map((m) => m.blueprint.name).join(", ")}`,
            direction: args.layoutDirection ?? "VERTICAL",
            spacing,
            padding,
            width,
            children: matched,
        };
    }
    // Ultimate fallback — empty container
    return {
        name: "Empty Container",
        description: `Could not match pattern "${args.pattern}" to known recipes or components.`,
        direction: "VERTICAL",
        spacing,
        padding,
        width,
        children: [],
    };
}
// ─── Figma builder ─────────────────────────────────────────────────────────
async function buildInFigma(plan, args) {
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    // Build the script to create the composition in Figma
    const childScripts = [];
    for (const child of plan.children) {
        const bp = child.blueprint;
        const rootNode = bp.root;
        for (let i = 0; i < child.count; i++) {
            const label = child.count > 1 ? `${child.label} ${i + 1}` : child.label;
            childScripts.push(`
        // ── ${label} ──
        (function() {
          var comp = figma.createFrame();
          comp.name = '${label.replace(/'/g, "\\'")}';
          comp.layoutMode = '${rootNode.layoutMode ?? "HORIZONTAL"}';
          comp.primaryAxisSizingMode = 'AUTO';
          comp.counterAxisSizingMode = 'AUTO';
          comp.paddingLeft = ${rootNode.paddingX ?? 16};
          comp.paddingRight = ${rootNode.paddingX ?? 16};
          comp.paddingTop = ${rootNode.paddingY ?? 8};
          comp.paddingBottom = ${rootNode.paddingY ?? 8};
          comp.itemSpacing = ${rootNode.itemSpacing ?? 8};
          comp.cornerRadius = ${rootNode.cornerRadius ?? 0};
          ${rootNode.fillSemantic ? `comp.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.97 } }];` : `comp.fills = [];`}
          ${rootNode.strokeSemantic ? `comp.strokes = [{ type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85 } }]; comp.strokeWeight = ${rootNode.strokeWeight ?? 1};` : ""}

          ${rootNode.children?.map((childNode) => {
                if (childNode.kind === "text") {
                    const text = child.customText ?? childNode.textContent ?? label;
                    return `
                var txt = figma.createText();
                txt.name = '${childNode.name.replace(/'/g, "\\'")}';
                txt.characters = '${text.replace(/'/g, "\\'")}';
                txt.fontSize = ${childNode.textContent?.includes("label") || childNode.name.includes("label") ? 14 : 14};
                txt.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
                comp.appendChild(txt);
              `;
                }
                if (childNode.kind === "rect" || childNode.kind === "frame") {
                    return `
                var rect = figma.createFrame();
                rect.name = '${childNode.name.replace(/'/g, "\\'")}';
                rect.resize(${childNode.width ?? 16}, ${childNode.height ?? 16});
                ${childNode.cornerRadius ? `rect.cornerRadius = ${childNode.cornerRadius};` : ""}
                ${childNode.fillSemantic ? `rect.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.5, b: 0.9 } }];` : `rect.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];`}
                comp.appendChild(rect);
              `;
                }
                return "";
            }).join("\n") ?? ""}

          container.appendChild(comp);
        })();
      `);
        }
    }
    const wrapperFill = plan.wrapperStyle?.fill
        ? `container.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];`
        : args.includeBackground
            ? `container.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];`
            : `container.fills = [];`;
    const script = `
    (async () => {
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      await figma.loadFontAsync({ family: "Inter", style: "Medium" });
      await figma.loadFontAsync({ family: "Inter", style: "Bold" });

      ${args.targetPage ? `
        var targetPage = figma.root.children.find(function(p) { return p.name === '${args.targetPage.replace(/'/g, "\\'")}'; });
        if (!targetPage) {
          targetPage = figma.createPage();
          targetPage.name = '${args.targetPage.replace(/'/g, "\\'")}';
        }
        figma.currentPage = targetPage;
      ` : ""}

      // Create container frame
      var container = figma.createFrame();
      container.name = '${plan.name.replace(/'/g, "\\'")}';
      container.layoutMode = '${plan.direction}';
      container.primaryAxisSizingMode = 'AUTO';
      container.counterAxisSizingMode = 'FIXED';
      container.resize(${plan.width}, 100);
      container.paddingLeft = ${plan.padding};
      container.paddingRight = ${plan.padding};
      container.paddingTop = ${plan.padding};
      container.paddingBottom = ${plan.padding};
      container.itemSpacing = ${plan.spacing};
      ${plan.wrapperStyle?.cornerRadius ? `container.cornerRadius = ${plan.wrapperStyle.cornerRadius};` : ""}
      ${wrapperFill}
      ${plan.wrapperStyle?.stroke ? `container.strokes = [{ type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.87 } }]; container.strokeWeight = 1;` : ""}
      ${plan.wrapperStyle?.shadow ? `container.effects = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 4 }, radius: 12, spread: 0, visible: true }];` : ""}

      // Title label
      var titleLabel = figma.createText();
      titleLabel.name = 'Composition Title';
      titleLabel.fontName = { family: "Inter", style: "Bold" };
      titleLabel.fontSize = 18;
      titleLabel.characters = '${plan.name.replace(/'/g, "\\'")}';
      titleLabel.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
      container.appendChild(titleLabel);

      ${childScripts.join("\n")}

      // Position on canvas
      container.x = 100;
      container.y = 100;

      figma.currentPage.selection = [container];
      figma.viewport.scrollAndZoomIntoView([container]);

      return { frameId: container.id, pageName: figma.currentPage.name };
    })();
  `;
    const result = await bridge.execute(script);
    if (!result.success || !result.result) {
        throw new Error(result.error || "Failed to build composition in Figma");
    }
    return result.result;
}
// ─── Main handler ──────────────────────────────────────────────────────────
async function compositionBuilderHandler(args) {
    const plan = buildPlan(args);
    if (plan.children.length === 0) {
        return {
            error: `Could not match pattern "${args.pattern}" to any known recipe or component.`,
            availablePatterns: PATTERN_RECIPES.map((r) => ({
                pattern: r.name,
                keywords: r.keywords.source,
                components: r.components.map((c) => c.name),
            })),
            availableComponents: component_templates_js_1.COMPONENT_BLUEPRINTS.map((b) => b.name),
            hint: "Try a specific pattern like 'login form', 'search with filters', or 'card with actions'. Or provide explicit components via the 'components' parameter.",
        };
    }
    // Build in Figma
    const { frameId, pageName } = await buildInFigma(plan, args);
    return {
        composition: plan.name,
        description: plan.description,
        frameId,
        pageName,
        layout: {
            direction: plan.direction,
            spacing: plan.spacing,
            padding: plan.padding,
            width: plan.width,
        },
        components: plan.children.map((c) => ({
            name: c.blueprint.name,
            label: c.label,
            count: c.count,
            variant: c.variant,
        })),
        totalComponents: plan.children.reduce((sum, c) => sum + c.count, 0),
        availablePatterns: PATTERN_RECIPES.map((r) => r.name),
    };
}
//# sourceMappingURL=index.js.map