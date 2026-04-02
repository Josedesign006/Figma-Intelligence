import Fuse from "fuse.js";
import { ComponentManifest, ComponentSet } from "../../../shared/types.js";
import { searchIcons, getIconByName, type IconEntry } from "../../../shared/icon-catalog.js";

interface IconCandidate {
  nodeId: string;
  name: string;
  description?: string;
  nodeType: string;
}

export interface IconComponentMatch {
  nodeId: string;
  name: string;
  confidence: number;
  nodeType: string;
}

/**
 * Try to resolve an icon name against the catalog before falling back
 * to Fuse.js component set matching.
 */
export function resolveFromCatalog(iconName: string): IconEntry | null {
  // Try exact canonical name first
  const exact = getIconByName(iconName);
  if (exact) return exact;

  // Try fuzzy search
  const results = searchIcons(iconName, { limit: 1 });
  return results.length > 0 ? results[0] : null;
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function buildCandidates(componentSets: ComponentSet[]): IconCandidate[] {
  const candidates: IconCandidate[] = [];

  for (const set of componentSets) {
    const setName = normalize(set.name);
    const isIconLikeSet = /\bicon\b|\blogo\b|\bglyph\b|\bsymbol\b/.test(setName);
    if (isIconLikeSet) {
      candidates.push({
        nodeId: set.id,
        name: set.name,
        description: set.description,
        nodeType: "COMPONENT_SET",
      });
    }

    for (const child of set.children) {
      const childName = normalize(child.name);
      if (isIconLikeSet || /\bicon\b|\blogo\b|\bglyph\b|\bsymbol\b/.test(childName)) {
        candidates.push({
          nodeId: child.id,
          name: `${set.name} ${child.name}`,
          description: child.description ?? set.description,
          nodeType: child.type,
        });
      }
    }
  }

  return candidates;
}

export function resolveIconComponentMatch(
  manifest: ComponentManifest,
  componentSets: ComponentSet[]
): IconComponentMatch | null {
  if (!manifest.iconPresent) return null;

  const query = [manifest.iconName, manifest.componentType, manifest.textContent]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!query) return null;

  const candidates = buildCandidates(componentSets);
  if (candidates.length === 0) return null;

  const fuse = new Fuse(candidates, {
    keys: ["name", "description"],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2,
  });

  const result = fuse.search(query)[0];
  if (!result) return null;

  const confidence = result.score != null ? 1 - result.score : 0.5;
  if (confidence < 0.45) return null;

  return {
    nodeId: result.item.nodeId,
    name: result.item.name,
    confidence,
    nodeType: result.item.nodeType,
  };
}
