/**
 * Keyboard & Screen Reader Order Analyzer
 * Pure analysis engine that extracts interactive elements from a Figma node tree,
 * infers ARIA roles/labels, computes keyboard tab order and screen reader reading
 * order, and produces all 10 annotation sections as structured data.
 */
import { FigmaNode } from "../../../shared/types.js";
export interface TabOrderEntry {
    order: number;
    elementDescription: string;
    role: string;
    label: string;
    notes: string;
    nodeId: string;
}
export interface ReadingOrderNode {
    landmarkRole?: string;
    landmarkLabel?: string;
    content: string;
    role?: string;
    depth: number;
    children?: ReadingOrderNode[];
    nodeId: string;
}
export interface FocusAnnouncement {
    element: string;
    announcement: string;
}
export interface StateChangeRule {
    trigger: string;
    behavior: string;
}
export interface FocusRule {
    scenario: string;
    rule: string;
}
export interface AriaReq {
    element: string;
    attribute: string;
    value: string;
}
export interface KBRule {
    component: string;
    key: string;
    action: string;
}
export interface Warning {
    id: number;
    severity: "Critical" | "Warning" | "Info";
    title: string;
    description: string;
}
export interface AuditSummaryRow {
    severity: string;
    count: number;
    category: string;
}
export interface A11yOrderAnalysis {
    header: {
        frameName: string;
        nodeId: string;
        date: string;
        standard: string;
    };
    scope: string;
    assumptions: string[];
    keyboardTabOrder: TabOrderEntry[];
    screenReaderReadingOrder: ReadingOrderNode[];
    interactionAnnouncements: {
        onFocus: FocusAnnouncement[];
        stateChanges: StateChangeRule[];
    };
    focusManagement: FocusRule[];
    implementationNotes: {
        ariaTable: AriaReq[];
        keyboardBehavior: KBRule[];
        dosDonts: string[];
    };
    warnings: Warning[];
    auditSummary: AuditSummaryRow[];
}
export declare function analyzeKeyboardAndScreenReaderOrder(rootNode: FigmaNode, nodeId: string): A11yOrderAnalysis;
//# sourceMappingURL=keyboard-sr-order-analyzer.d.ts.map