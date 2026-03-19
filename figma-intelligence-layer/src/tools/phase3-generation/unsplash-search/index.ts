import { decisionLog } from "../../../shared/decision-log.js";
import {
  searchUnsplashPhotos,
  trackUnsplashDownload,
  UnsplashContentFilter,
  UnsplashOrientation,
  UnsplashPhotoResult,
} from "../../../shared/unsplash.js";

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

export async function figmaUnsplashSearchHandler(
  args: FigmaUnsplashSearchArgs
): Promise<FigmaUnsplashSearchResult> {
  const {
    query,
    count = 4,
    page = 1,
    orientation,
    contentFilter = "high",
    color,
    trackDownloads = false,
  } = args;

  const search = await searchUnsplashPhotos({
    query,
    page,
    perPage: count,
    orientation,
    contentFilter,
    color,
  });

  if (trackDownloads) {
    for (const photo of search.results) {
      await trackUnsplashDownload(photo.links.downloadLocation);
    }
  }

  const logEntry = await decisionLog.log({
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
