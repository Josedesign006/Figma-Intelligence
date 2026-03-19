const UNSPLASH_API_BASE = "https://api.unsplash.com";

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

interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: Array<Record<string, unknown>>;
}

function getUnsplashAccessKey(): string {
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key) {
    throw new Error(
      "UNSPLASH_ACCESS_KEY is not set. Add an Unsplash API access key to enable photo search."
    );
  }
  return key;
}

async function unsplashGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const accessKey = getUnsplashAccessKey();
  const url = new URL(path, UNSPLASH_API_BASE);

  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
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

  return response.json() as Promise<T>;
}

function normalizePhoto(photo: Record<string, unknown>): UnsplashPhotoResult {
  const urls = (photo.urls as Record<string, unknown>) ?? {};
  const user = (photo.user as Record<string, unknown>) ?? {};
  const links = (photo.links as Record<string, unknown>) ?? {};
  const userLinks = (user.links as Record<string, unknown>) ?? {};

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

export async function searchUnsplashPhotos(
  args: SearchUnsplashPhotosArgs
): Promise<{ total: number; totalPages: number; results: UnsplashPhotoResult[] }> {
  const {
    query,
    page = 1,
    perPage = 4,
    orientation,
    contentFilter = "high",
    color,
  } = args;

  if (!query || query.trim().length === 0) {
    throw new Error("Unsplash search requires a non-empty query.");
  }

  const response = await unsplashGet<UnsplashSearchResponse>("/search/photos", {
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

export async function trackUnsplashDownload(downloadLocation: string): Promise<void> {
  if (!downloadLocation) return;
  await unsplashGet(downloadLocation.replace(UNSPLASH_API_BASE, ""), {});
}

export async function fetchRemoteImageAsDataUri(imageUrl: string): Promise<string> {
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
