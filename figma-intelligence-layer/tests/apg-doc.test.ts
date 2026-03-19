import { guessPattern, shouldFallbackToGeneratedPage } from "../src/tools/phase5-governance/apg-doc/index";
import { NodeSnapshot } from "../src/tools/phase5-governance/spec-generator/index";

function makeSnapshot(overrides: Partial<NodeSnapshot>): NodeSnapshot {
  return {
    id: "1:1",
    name: "Button/Primary",
    type: "COMPONENT_SET",
    description: "",
    width: 120,
    height: 44,
    layoutMode: "HORIZONTAL",
    itemSpacing: 8,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    childCount: 0,
    childNames: [],
    textLayers: [],
    fills: [],
    strokes: [],
    effects: [],
    tokenAliases: [],
    componentProperties: [],
    variantProperties: {},
    variantGroupProperties: {},
    variants: [],
    ...overrides,
  };
}

describe("figma_apg_doc pattern matcher", () => {
  test("matches tabs from component naming and variants", () => {
    const snapshot = makeSnapshot({
      name: "Navigation/Tabs",
      variantGroupProperties: {
        State: ["Default", "Selected"],
        Size: ["Sm", "Md"],
      },
      childNames: ["Tab list", "Tab panel"],
    });

    const match = guessPattern(snapshot);
    expect(match.definition.id).toBe("tabs");
    expect(match.confidence).toBeGreaterThan(0.5);
  });

  test("uses hint to disambiguate tricky patterns", () => {
    const snapshot = makeSnapshot({
      name: "Filters/Picker",
      textLayers: [{ name: "Label", characters: "Choose a city", fontFamily: "Inter", fontStyle: "Regular", fontSize: 14, lineHeightPx: 20 }],
    });

    const match = guessPattern(snapshot, "combobox");
    expect(match.definition.id).toBe("combobox");
    expect(match.matchedBy.some((entry) => entry.startsWith("hint:"))).toBe(true);
  });

  test("matches treeview for hierarchical file-nav patterns", () => {
    const snapshot = makeSnapshot({
      name: "Navigation/File Tree",
      childNames: ["Tree", "Group", "Tree item"],
      textLayers: [{ name: "Node label", characters: "src", fontFamily: "Inter", fontStyle: "Regular", fontSize: 14, lineHeightPx: 20 }],
      variantGroupProperties: {
        State: ["Expanded", "Collapsed", "Selected"],
      },
    });

    const match = guessPattern(snapshot);
    expect(match.definition.id).toBe("treeview");
  });

  test("matches slider for range controls", () => {
    const snapshot = makeSnapshot({
      name: "Media/Volume Slider",
      childNames: ["Track", "Thumb", "Value label"],
      textLayers: [{ name: "Label", characters: "Volume", fontFamily: "Inter", fontStyle: "Regular", fontSize: 14, lineHeightPx: 20 }],
    });

    const match = guessPattern(snapshot);
    expect(match.definition.id).toBe("slider");
  });

  test("falls back to a generated page for plugin description write errors", () => {
    expect(shouldFallbackToGeneratedPage(new Error("figma_apg_doc: failed to update node description: Internal plugin write failure"))).toBe(true);
    expect(shouldFallbackToGeneratedPage(new Error("Target node does not support description updates."))).toBe(true);
  });

  test("returns a low-confidence fallback match for generic components", () => {
    const snapshot = makeSnapshot({
      name: "Surface/Primitive",
      type: "FRAME",
      childNames: ["Container", "Content"],
    });

    const match = guessPattern(snapshot);
    expect(match.confidence).toBeLessThan(0.55);
    expect(match.matchedBy).toContain("fallback:best-name-match");
  });
});
