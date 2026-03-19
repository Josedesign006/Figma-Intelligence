import { FigmaBridge } from "../src/shared/figma-bridge";

describe("FigmaBridge live context", () => {
  test("updates context and notifies listeners from bridge events", () => {
    const bridge = new FigmaBridge();
    const seen: string[] = [];

    bridge.onEvent("*", (event) => {
      seen.push(event.eventType);
    });

    bridge.handleIncomingMessage(JSON.stringify({
      type: "bridge-event",
      eventType: "bridge.ready",
      payload: {
        fileName: "Design System",
        currentPage: { id: "10:1", name: "Components" },
        pageCount: 3,
        selection: [{ id: "20:1", name: "Button", type: "COMPONENT" }],
      },
      timestamp: 101,
    }));

    bridge.handleIncomingMessage(JSON.stringify({
      type: "bridge-event",
      eventType: "documentchange",
      payload: {
        documentChanges: [{ type: "PROPERTY_CHANGE", nodeId: "20:1", nodeType: "COMPONENT" }],
      },
      timestamp: 202,
    }));

    expect(seen).toEqual(["bridge.ready", "documentchange"]);
    expect(bridge.getContextSnapshot()).toMatchObject({
      status: "connected",
      fileName: "Design System",
      currentPage: { id: "10:1", name: "Components" },
      pageCount: 3,
      selection: [{ id: "20:1", name: "Button", type: "COMPONENT" }],
      lastDocumentChange: {
        documentChanges: [{ type: "PROPERTY_CHANGE", nodeId: "20:1", nodeType: "COMPONENT" }],
      },
      lastUpdatedAt: 202,
    });
  });

  test("serves cached status and selection from live context", async () => {
    const bridge = new FigmaBridge();

    bridge.handleIncomingMessage(JSON.stringify({
      type: "bridge-event",
      eventType: "bridge.ready",
      payload: {
        fileName: "Marketing Site",
        currentPage: { id: "1:2", name: "Homepage" },
        pageCount: 5,
        selection: [],
      },
      timestamp: 555,
    }));

    bridge.handleIncomingMessage(JSON.stringify({
      type: "bridge-event",
      eventType: "selectionchange",
      payload: {
        selection: [{ id: "5:9", name: "Hero", type: "FRAME" }],
      },
      timestamp: 777,
    }));

    await expect(bridge.getStatus()).resolves.toMatchObject({
      status: "connected",
      fileName: "Marketing Site",
      currentPage: { id: "1:2", name: "Homepage" },
      pageCount: 5,
      timestamp: 777,
    });

    await expect(bridge.getSelection()).resolves.toEqual([
      { id: "5:9", name: "Hero", type: "FRAME" },
    ]);
  });
});
