export type UnsplashOrientation = "landscape" | "portrait" | "squarish";
export type UnsplashContentFilter = "low" | "high";
export interface SearchUnsplashPhotosArgs {
    query: string;
    page?: number;
    perPage?: number;
    orientation?: UnsplashOrientation;
    contentFilter?: UnsplashContentFilter;
    color?: string;
}
export interface UnsplashPhotoResult {
    id: string;
    slug: string;
    description: string | null;
    altDescription: string | null;
    width: number;
    height: number;
    color: string | null;
    blurHash: string | null;
    photographer: {
        name: string;
        username: string;
        profileUrl: string;
    };
    urls: {
        raw: string;
        full: string;
        regular: string;
        small: string;
        thumb: string;
    };
    links: {
        html: string;
        downloadLocation: string;
    };
}
export declare function searchUnsplashPhotos(args: SearchUnsplashPhotosArgs): Promise<{
    total: number;
    totalPages: number;
    results: UnsplashPhotoResult[];
}>;
export declare function trackUnsplashDownload(downloadLocation: string): Promise<void>;
export declare function fetchRemoteImageAsDataUri(imageUrl: string): Promise<string>;
//# sourceMappingURL=unsplash.d.ts.map