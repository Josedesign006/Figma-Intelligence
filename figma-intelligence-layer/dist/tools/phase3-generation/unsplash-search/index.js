"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.figmaUnsplashSearchHandler = figmaUnsplashSearchHandler;
const decision_log_js_1 = require("../../../shared/decision-log.js");
const unsplash_js_1 = require("../../../shared/unsplash.js");
async function figmaUnsplashSearchHandler(args) {
    const { query, count = 4, page = 1, orientation, contentFilter = "high", color, trackDownloads = false, } = args;
    const search = await (0, unsplash_js_1.searchUnsplashPhotos)({
        query,
        page,
        perPage: count,
        orientation,
        contentFilter,
        color,
    });
    if (trackDownloads) {
        for (const photo of search.results) {
            await (0, unsplash_js_1.trackUnsplashDownload)(photo.links.downloadLocation);
        }
    }
    const logEntry = await decision_log_js_1.decisionLog.log({
        tool: "figma_unsplash_search",
        nodeIds: [],
        rationale: `Searched Unsplash for "${query}" and returned ${search.results.length} image candidates for Figma generation.`,
        reversible: false,
        metadata: {
            query,
            count,
            page,
            orientation,
            contentFilter,
            color,
            trackDownloads,
            total: search.total,
        },
    });
    return {
        query,
        count: search.results.length,
        page,
        total: search.total,
        totalPages: search.totalPages,
        results: search.results,
        logEntryId: logEntry.id,
    };
}
//# sourceMappingURL=index.js.map