export type GroupBy = "page" | "component" | "team";
export interface ComponentAuditArgs {
    fileKey?: string;
    includeLibraryComponents?: boolean;
    detectOrphans?: boolean;
    groupBy?: GroupBy;
}
export interface ComponentUsageStat {
    componentId: string;
    componentName: string;
    instanceCount: number;
    pages: string[];
}
export interface VariantUsageStat {
    variantName: string;
    componentSetId: string;
    componentSetName: string;
    instanceCount: number;
    usageRatio: number;
}
export interface DetachedInstance {
    nodeId: string;
    nodeName: string;
    nodeType: string;
    pageId: string;
    likelyShadows: string[];
}
export interface OrphanedComponent {
    componentId: string;
    componentName: string;
    componentSetId?: string;
    componentSetName?: string;
}
export interface OverrideHotspot {
    componentId: string;
    componentName: string;
    property: string;
    overrideCount: number;
    instanceCount: number;
    overrideRate: number;
}
export interface ComponentAuditGroup {
    groupKey: string;
    components: ComponentUsageStat[];
    totalInstances: number;
}
export interface ComponentAuditResult {
    fileKey: string | null;
    totalComponents: number;
    totalInstances: number;
    topUsed: ComponentUsageStat[];
    leastUsed: ComponentUsageStat[];
    variantUsage: VariantUsageStat[];
    detachedInstances: DetachedInstance[];
    orphanedComponents: OrphanedComponent[];
    overrideHotspots: OverrideHotspot[];
    groupedReport: ComponentAuditGroup[];
    logEntryId: string;
}
export declare function componentAuditHandler(args: ComponentAuditArgs): Promise<ComponentAuditResult>;
//# sourceMappingURL=index.d.ts.map