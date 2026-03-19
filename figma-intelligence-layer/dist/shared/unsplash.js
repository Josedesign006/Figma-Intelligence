"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchUnsplashPhotos = searchUnsplashPhotos;
exports.trackUnsplashDownload = trackUnsplashDownload;
exports.fetchRemoteImageAsDataUri = fetchRemoteImageAsDataUri;
const UNSPLASH_API_BASE = "https://api.unsplash.com";
function getUnsplashAccessKey() {
    const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
    if (!key) {
        throw new Error("UNSPLASH_ACCESS_KEY is not set. Add an Unsplash API access key to enable photo search.");
    }
    return key;
}
async function unsplashGet(path, params) {
    const accessKey = getUnsplashAccessKey();
    const url = new URL(path, UNSPLASH_API_BASE);
    for (const [key, value] of Object.entries(params)) {
        if (value)
            url.searchParams.set(key, value);
    }
    const response = await fetch(url.toString(), {
        headers: {
            Authorization: `Client-ID ${accessKey}`,
            "Accept-Version": "v1",
        },
    });
    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Unsplash API error ${response.status}: ${errorText || response.statusText}`);
    }
    return response.json();
}
function normalizePhoto(photo) {
    const urls = photo.urls ?? {};
    const user = photo.user ?? {};
    const links = photo.links ?? {};
    const userLinks = user.links ?? {};
    return {
        id: String(photo.id ?? ""),
        slug: String(photo.slug ?? ""),
        description: typeof photo.description === "string" ? photo.description : null,
        altDescription: typeof photo.alt_description === "string" ? photo.alt_description : null,
        width: Number(photo.width ?? 0),
        height: Number(photo.height ?? 0),
        color: typeof photo.color === "string" ? photo.color : null,
        blurHash: typeof photo.blur_hash === "string" ? photo.blur_hash : null,
        photographer: {
            name: String(user.name ?? "Unknown"),
            username: String(user.username ?? "unknown"),
            profileUrl: String(userLinks.html ?? ""),
        },
        urls: {
            raw: String(urls.raw ?? ""),
            full: String(urls.full ?? ""),
            regular: String(urls.regular ?? ""),
            small: String(urls.small ?? ""),
            thumb: String(urls.thumb ?? ""),
        },
        links: {
            html: String(links.html ?? ""),
            downloadLocation: String(links.download_location ?? ""),
        },
    };
}
async function searchUnsplashPhotos(args) {
    const { query, page = 1, perPage = 4, orientation, contentFilter = "high", color, } = args;
    if (!query || query.trim().length === 0) {
        throw new Error("Unsplash search requires a non-empty query.");
    }
    const response = await unsplashGet("/search/photos", {
        query: query.trim(),
        page: String(page),
        per_page: String(Math.min(Math.max(perPage, 1), 10)),
        content_filter: contentFilter,
        orientation: orientation ?? "",
        color: color ?? "",
    });
    return {
        total: response.total ?? 0,
        totalPages: response.total_pages ?? 0,
        results: Array.isArray(response.results) ? response.results.map(normalizePhoto) : [],
    };
}
async function trackUnsplashDownload(downloadLocation) {
    if (!downloadLocation)
        return;
    await unsplashGet(downloadLocation.replace(UNSPLASH_API_BASE, ""), {});
}
async function fetchRemoteImageAsDataUri(imageUrl) {
    if (!imageUrl) {
        throw new Error("Image URL is required to fetch remote image data.");
    }
    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Image fetch failed ${response.status}: ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
}
//# sourceMappingURL=unsplash.js.map