import { UnsplashContentFilter, UnsplashOrientation, UnsplashPhotoResult } from "../../../shared/unsplash.js";
export interface FigmaUnsplashSearchArgs {
    query: string;
    count?: number;
    page?: number;
    orientation?: UnsplashOrientation;
    contentFilter?: UnsplashContentFilter;
    color?: string;
    trackDownloads?: boolean;
}
export interface FigmaUnsplashSearchResult {
    query: string;
    count: number;
    page: number;
    total: number;
    totalPages: number;
    results: UnsplashPhotoResult[];
    logEntryId: string;
}
export declare function figmaUnsplashSearchHandler(args: FigmaUnsplashSearchArgs): Promise<FigmaUnsplashSearchResult>;
//# sourceMappingURL=index.d.ts.map