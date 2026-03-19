import {
  buildAccessibilityAnnotationDocument,
  formatDocumentReport,
  formatSpecDescription,
  type DesignSpec,
  type NodeSnapshot,
} from "../src/tools/phase5-governance/spec-generator/index";

describe("figma_generate_spec handoff formatting", () => {
  test("formats a compact dev handoff description", () => {
    const spec: DesignSpec = {
      target: {
        nodeId: "100:200",
        name: "What We Do Clone",
        type: "FRAME",
        description: "",
      },
      overview: {
        summary: "A structured marketing section with a header band and four-column grid.",
        size: "1600 × 860 px",
        layout: "Vertical auto layout",
        childCount: 2,
      },
      anatomy: ["Header", "Disciplines Grid"],
      variants: [],
      states: [],
      contentGuidance: ["Primary text layer: \"WHAT WE DO\"."],
      styling: {
        fills: ["rgb(251, 251, 251)"],
        strokes: ["rgb(20, 20, 20)"],
        effects: [],
        tokenReferences: [],
      },
      accessibility: {
        typography: ["WHAT WE DO: Libre Franklin SemiBold 72px / 74px"],
        considerations: ["No variable aliases were detected on the target subtree."],
      },
      implementationNotes: ["Uses vertical auto layout with 0px item spacing."],
      documentationGaps: ["No token aliases were found in the scanned subtree, so token documentation is likely incomplete."],
    };

    const result = formatSpecDescription(spec);

    expect(result).toContain("# Dev Handoff");
    expect(result).toContain("`1600 x 860 px`");
    expect(result).toContain("## Engineering Notes");
    expect(result).toContain("No token aliases detected on this subtree.");
  });

  test("builds a screen accessibility annotation with keyboard and screen reader order", () => {
    const spec: DesignSpec = {
      target: {
        nodeId: "100:200",
        name: "Checkout Payment",
        type: "FRAME",
        description: "",
      },
      overview: {
        summary: "A payment step with address fields and a submit action.",
        size: "1440 × 1024 px",
        layout: "Vertical auto layout",
        childCount: 2,
      },
      anatomy: ["Payment form", "Order summary"],
      variants: [],
      states: ["Default"],
      contentGuidance: ["Primary text layer: \"Payment details\"."],
      styling: {
        fills: ["rgb(255, 255, 255)"],
        strokes: [],
        effects: [],
        tokenReferences: [],
      },
      accessibility: {
        typography: ["Payment details: Geist Medium 24px / 32px"],
        considerations: ["Run contrast and focus-state checks before publishing this component spec."],
      },
      implementationNotes: ["Uses vertical auto layout with 24px item spacing."],
      documentationGaps: [],
    };

    const snapshot: NodeSnapshot = {
      id: "100:200",
      name: "Checkout Payment",
      type: "FRAME",
      description: "",
      width: 1440,
      height: 1024,
      layoutMode: "VERTICAL",
      itemSpacing: 24,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      childCount: 2,
      childNames: ["Payment form", "Order summary"],
      textLayers: [],
      fills: [],
      strokes: [],
      effects: [],
      tokenAliases: [],
      componentProperties: [],
      variantProperties: {},
      variantGroupProperties: {},
      variants: [],
      scanNodes: [
        { id: "100:200", parentId: null, parentName: null, name: "Checkout Payment", type: "FRAME", depth: 0, visible: true, childCount: 2, layoutMode: "VERTICAL", text: "", componentPropertyNames: [], variantPropertyKeys: [], variantPropertyValues: [] },
        { id: "100:201", parentId: "100:200", parentName: "Checkout Payment", name: "Payment form", type: "FRAME", depth: 1, visible: true, childCount: 4, layoutMode: "VERTICAL", text: "", componentPropertyNames: [], variantPropertyKeys: [], variantPropertyValues: [] },
        { id: "100:202", parentId: "100:201", parentName: "Payment form", name: "Heading", type: "TEXT", depth: 2, visible: true, childCount: 0, layoutMode: "NONE", text: "Payment details", componentPropertyNames: [], variantPropertyKeys: [], variantPropertyValues: [] },
        { id: "100:203", parentId: "100:201", parentName: "Payment form", name: "Email field", type: "INSTANCE", depth: 2, visible: true, childCount: 0, layoutMode: "NONE", text: "Email address", componentPropertyNames: ["state"], variantPropertyKeys: [], variantPropertyValues: ["required"] },
        { id: "100:204", parentId: "100:201", parentName: "Payment form", name: "Country dropdown", type: "INSTANCE", depth: 2, visible: true, childCount: 0, layoutMode: "NONE", text: "Country", componentPropertyNames: ["state"], variantPropertyKeys: [], variantPropertyValues: [] },
        { id: "100:205", parentId: "100:201", parentName: "Payment form", name: "Continue button", type: "INSTANCE", depth: 2, visible: true, childCount: 0, layoutMode: "NONE", text: "Continue to review", componentPropertyNames: ["state"], variantPropertyKeys: [], variantPropertyValues: [] },
      ],
    };

    const document = buildAccessibilityAnnotationDocument(snapshot, spec);
    const report = formatDocumentReport(document);

    expect(document.title).toContain("Accessibility Annotation");
    expect(report).toContain("Keyboard Tab Order");
    expect(report).toContain("1. Email address - Text field (required)");
    expect(report).toContain("Country - Select");
    expect(report).toContain("Continue to review - Button");
    expect(report).toContain("Screen Reader Reading Order");
    expect(report).toContain("Heading: Payment details");
  });
});
