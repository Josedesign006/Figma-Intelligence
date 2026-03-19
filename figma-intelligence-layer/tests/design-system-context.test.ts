import { DesignSystemContextStore } from "../src/shared/design-system-context";
import { FigmaBridgeEvent, FigmaBridgeEventType } from "../src/shared/types";

class FakeBridge {
  private listeners = new Map<FigmaBridgeEventType | "*", Set<(event: FigmaBridgeEvent) => void>>();

  getStatus = jest.fn(async () => ({
    fileName: "Design System",
    currentPage: { id: "10:1", name: "Components" },
  }));

  getAllPages = jest.fn(async () => [
    { id: "10:1", name: "Components" },
    { id: "10:2", name: "Patterns" },
  ]);

  getComponentSets = jest.fn(async () => [
    {
      id: "set-button",
      name: "Button/Primary",
      description: "Primary CTA button",
      variantGroupProperties: {
        Size: { values: ["Sm", "Md", "Lg"] },
        State: { values: ["Default", "Hover"] },
      },
      children: [
        { id: "cmp-btn-sm", name: "Size=Sm, State=Default", type: "COMPONENT" },
        { id: "cmp-btn-md", name: "Size=Md, State=Hover", type: "COMPONENT" },
      ],
    },
    {
      id: "set-input",
      name: "Form/Input Field",
      description: "Text input",
      variantGroupProperties: {},
      children: [
        { id: "cmp-input", name: "State=Default", type: "COMPONENT" },
      ],
    },
  ]);

  getTokens = jest.fn(async () => [
    {
      id: "tok-bg",
      name: "Color/Background/Default",
      type: "COLOR",
      value: "#fff",
      collectionId: "col-1",
    },
    {
      id: "tok-space",
      name: "Space/16",
      type: "FLOAT",
      value: 16,
      collectionId: "col-1",
    },
  ]);

  getStyles = jest.fn(async () => ({
    text: [{ id: "style-heading", name: "Heading/L" }],
    paint: [{ id: "style-surface", name: "Surface/Default" }],
  }));

  getAllInstances = jest.fn(async () => [
    { id: "inst-1", mainComponentId: "cmp-btn-sm", name: "Button", pageId: "10:2" },
    { id: "inst-2", mainComponentId: "cmp-btn-sm", name: "Button", pageId: "10:2" },
    { id: "inst-3", mainComponentId: "cmp-input", name: "Input", pageId: "10:2" },
  ]);

  onEvent(eventType: FigmaBridgeEventType | "*", listener: (event: FigmaBridgeEvent) => void) {
    const listeners = this.listeners.get(eventType) ?? new Set();
    listeners.add(listener);
    this.listeners.set(eventType, listeners);
    return () => listeners.delete(listener);
  }

  emit(eventType: FigmaBridgeEventType, payload: unknown, timestamp = Date.now()) {
    const event: FigmaBridgeEvent = {
      type: "bridge-event",
      eventType,
      payload,
      timestamp,
    };

    for (const listener of this.listeners.get(eventType) ?? []) {
      listener(event);
    }
    for (const listener of this.listeners.get("*") ?? []) {
      listener(event);
    }
  }
}

describe("DesignSystemContextStore", () => {
  test("builds indexes and intelligence from bridge data", async () => {
    const bridge = new FakeBridge();
    const store = new DesignSystemContextStore(bridge as never);

    const snapshot = await store.hydrate();

    expect(snapshot.inventory.componentSets).toHaveLength(2);
    expect(snapshot.indexes.componentById.get("cmp-btn-sm")).toMatchObject({
      setId: "set-button",
      normalizedName: "size sm state default",
    });
    expect(snapshot.intelligence.variantSchemas["set-button"]).toEqual({
      properties: {
        size: ["lg", "md", "sm"],
        state: ["default", "hover"],
      },
    });
    expect(snapshot.intelligence.semanticTokenGroups["color.background"]).toEqual(["tok-bg"]);
    expect(snapshot.intelligence.preferredComponentsByIntent["primary-action"][0]).toBe("set-button");
  });

  test("refreshes page-scoped inventories on bridge page changes", async () => {
    const bridge = new FakeBridge();
    const store = new DesignSystemContextStore(bridge as never);

    await store.hydrate();
    bridge.emit("currentpagechange", { currentPage: { id: "10:2", name: "Patterns" } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(bridge.getComponentSets).toHaveBeenCalledTimes(2);
    expect(bridge.getAllInstances).toHaveBeenCalledTimes(2);
  });

  test("debounces document changes into one refresh", async () => {
    jest.useFakeTimers();
    const bridge = new FakeBridge();
    const store = new DesignSystemContextStore(bridge as never);

    await store.hydrate();
    bridge.getComponentSets.mockClear();
    bridge.getAllInstances.mockClear();

    bridge.emit("documentchange", {
      documentChanges: [{ type: "PROPERTY_CHANGE", nodeType: "COMPONENT_SET", nodeId: "set-button" }],
    });
    bridge.emit("documentchange", {
      documentChanges: [{ type: "PROPERTY_CHANGE", nodeType: "INSTANCE", nodeId: "inst-1" }],
    });

    jest.advanceTimersByTime(60);
    await Promise.resolve();
    await Promise.resolve();

    expect(bridge.getComponentSets).toHaveBeenCalledTimes(1);
    expect(bridge.getAllInstances).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
