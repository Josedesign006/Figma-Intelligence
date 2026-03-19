import { matchComponentInContext } from "../src/shared/design-system-matcher";
import { DesignSystemContext } from "../src/shared/design-system-context";

function makeContext(): DesignSystemContext {
  const buttonSet = {
    id: "set-button-primary",
    name: "Button/Primary",
    normalizedName: "button primary",
    description: "Primary action button",
    childComponentIds: ["cmp-button-primary"],
    variantSchema: {
      properties: {
        size: ["sm", "md", "lg"],
        state: ["default", "hover", "disabled"],
      },
    },
    intents: ["button", "primary-action"],
  };

  const ctaSet = {
    id: "set-cta",
    name: "CTA Button",
    normalizedName: "cta button",
    description: "Marketing CTA",
    childComponentIds: ["cmp-cta"],
    variantSchema: {
      properties: {
        size: ["md"],
      },
    },
    intents: ["button", "primary-action"],
  };

  return {
    file: {
      fileName: "DS",
      pageId: "1:1",
      pageName: "Components",
      lastSyncedAt: Date.now(),
      source: "live",
    },
    inventory: {
      componentSets: [buttonSet, ctaSet],
      components: [
        {
          id: "cmp-button-primary",
          setId: "set-button-primary",
          name: "Size=Md, State=Default",
          normalizedName: "size md, state default",
          variantProps: { size: "md", state: "default" },
          intents: ["button", "primary-action"],
        },
        {
          id: "cmp-cta",
          setId: "set-cta",
          name: "Default",
          normalizedName: "default",
          variantProps: { size: "md" },
          intents: ["button", "primary-action"],
        },
      ],
      variables: [],
      styles: [],
      pages: [{ id: "1:1", name: "Components" }],
      instances: [
        { id: "inst-1", name: "Button", mainComponentId: "cmp-button-primary", pageId: "1:1" },
        { id: "inst-2", name: "Button", mainComponentId: "cmp-button-primary", pageId: "1:1" },
        { id: "inst-3", name: "Button", mainComponentId: "cmp-button-primary", pageId: "1:1" },
        { id: "inst-4", name: "CTA", mainComponentId: "cmp-cta", pageId: "1:1" },
      ],
    },
    indexes: {
      componentById: new Map(),
      componentSetById: new Map([
        ["set-button-primary", buttonSet],
        ["set-cta", ctaSet],
      ]),
      tokenById: new Map(),
      styleById: new Map(),
      componentsByNormalizedName: new Map(),
      tokensByNormalizedName: new Map(),
      componentsByIntent: new Map(),
    },
    intelligence: {
      aliases: {
        "set-button-primary": ["button primary"],
        "set-cta": ["cta button"],
      },
      variantSchemas: {
        "set-button-primary": buttonSet.variantSchema!,
        "set-cta": ctaSet.variantSchema!,
      },
      semanticTokenGroups: {},
      preferredComponentsByIntent: {
        "primary-action": ["set-button-primary", "set-cta"],
        button: ["set-button-primary", "set-cta"],
      },
      namingRules: [],
    },
    freshness: {
      componentSets: Date.now(),
      variables: Date.now(),
      styles: Date.now(),
      pages: Date.now(),
      instances: Date.now(),
    },
  };
}

describe("matchComponentInContext", () => {
  test("matches slight name differences to the preferred DS component", () => {
    const context = makeContext();

    const result = matchComponentInContext(
      {
        componentType: "Primary button",
        textContent: "Continue",
        variants: { Size: "md", State: "default" },
        interactiveElement: true,
      },
      context,
      0.6
    );

    expect(result.component?.id).toBe("set-button-primary");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test("returns a fallback suggestion when confidence stays low", () => {
    const context = makeContext();

    const result = matchComponentInContext(
      {
        componentType: "Wizard timeline",
        textContent: "Step 1",
      },
      context,
      0.95
    );

    expect(result.component).toBeNull();
    expect(result.fallbackSuggestion).toContain("Closest match");
  });
});
