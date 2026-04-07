/**
 * classify-elements.js
 * 
 * Deterministic classification rules for component child elements.
 * Used by anatomy and color spec generation to filter and categorize elements.
 * 
 * Usage: Import and call classifyElement(node) for each child layer.
 */

// Utility sub-components that should be skipped in anatomy per-child sections
const UTILITY_COMPONENTS = [
  'spacer', 'divider', 'separator', 'gap', 'padding',
  'spacing', 'gutter', 'rule', 'hairline'
];

// Structural frame names that indicate auto-layout wrappers (not meaningful elements)
const STRUCTURAL_PATTERNS = [
  /^frame\s*\d*$/i,
  /^group\s*\d*$/i,
  /^auto[-\s]?layout/i,
  /^wrapper/i,
  /^container$/i,  // generic "Container" (but "Input Container" is meaningful)
  /^content$/i,
  /^layout/i,
  /^stack/i
];

// Decorative element patterns
const DECORATIVE_PATTERNS = [
  /^background$/i,
  /^bg$/i,
  /^shadow$/i,
  /^overlay$/i,
  /^backdrop$/i,
  /^\./, // Figma convention: layers starting with "." are private/decorative
  /^_/   // Underscore prefix also common for internal layers
];

/**
 * Classify a Figma node into a documentation role.
 * 
 * @param {Object} node - Figma node data
 * @param {string} node.name - Layer name
 * @param {string} node.type - Node type (INSTANCE, TEXT, FRAME, etc.)
 * @param {boolean} node.visible - Whether the node is visible
 * @param {Object} node.componentPropertyReferences - Boolean property bindings
 * @param {number} node.childCount - Number of meaningful children (for instances)
 * @param {string} node.componentName - Resolved component name (for instances)
 * 
 * @returns {Object} { role, skip, reason }
 *   role: 'content-element' | 'optional-slot' | 'fixed-sub-component' | 'structural' | 'decorative'
 *   skip: boolean - whether to omit from documentation tables
 *   reason: string - human-readable explanation
 */
function classifyElement(node) {
  const name = (node.name || '').trim();
  const type = (node.type || '').toUpperCase();
  
  // 1. Check if controlled by a boolean property → optional-slot
  if (node.componentPropertyReferences && 
      Object.keys(node.componentPropertyReferences).some(
        key => key === 'visible' || key === 'mainComponent'
      )) {
    return {
      role: 'optional-slot',
      skip: false,
      reason: `Controlled by boolean toggle`
    };
  }

  // 2. Check decorative patterns
  for (const pattern of DECORATIVE_PATTERNS) {
    if (pattern.test(name)) {
      return {
        role: 'decorative',
        skip: true,
        reason: `Name matches decorative pattern: ${pattern}`
      };
    }
  }

  // 3. Check utility sub-components (for INSTANCE types)
  if (type === 'INSTANCE' && node.componentName) {
    const compNameLower = node.componentName.toLowerCase();
    for (const util of UTILITY_COMPONENTS) {
      if (compNameLower.includes(util)) {
        return {
          role: 'structural',
          skip: true,
          reason: `Utility sub-component: ${node.componentName}`
        };
      }
    }
  }

  // 4. Check structural frame patterns
  if ((type === 'FRAME' || type === 'GROUP') && !node.hasContentChildren) {
    for (const pattern of STRUCTURAL_PATTERNS) {
      if (pattern.test(name)) {
        return {
          role: 'structural',
          skip: true,
          reason: `Structural wrapper matching: ${pattern}`
        };
      }
    }
  }

  // 5. INSTANCE with meaningful children → fixed-sub-component
  if (type === 'INSTANCE' && node.childCount >= 2) {
    return {
      role: 'fixed-sub-component',
      skip: false,
      reason: `Instance with ${node.childCount} children — candidate for per-child section`
    };
  }

  // 6. Everything else → content-element
  return {
    role: 'content-element',
    skip: false,
    reason: `Content element of type ${type}`
  };
}

/**
 * Check if a component instance qualifies for a per-child anatomy section.
 * 
 * @param {Object} node - Figma instance node
 * @returns {boolean}
 */
function qualifiesForPerChildSection(node) {
  if (node.type !== 'INSTANCE') return false;
  
  // Skip utility components
  const compNameLower = (node.componentName || '').toLowerCase();
  for (const util of UTILITY_COMPONENTS) {
    if (compNameLower.includes(util)) return false;
  }
  
  // Must have ≥3 internal child layers
  if ((node.childCount || 0) < 3) return false;
  
  // Must have its own configurable properties
  if (node.hasOwnProperties) return true;
  
  // Or must have enough structural complexity
  return (node.childCount || 0) >= 3;
}

/**
 * Collapse consecutive identical siblings.
 * e.g., [Star, Star, Star, Star, Star] → [{ ...Star, count: 5, label: "Star (x5)" }]
 */
function collapseIdenticalSiblings(elements) {
  const collapsed = [];
  let i = 0;
  
  while (i < elements.length) {
    let count = 1;
    const current = elements[i];
    
    // Count consecutive elements with the same component ID
    while (i + count < elements.length && 
           elements[i + count].componentId === current.componentId &&
           current.componentId != null) {
      count++;
    }
    
    collapsed.push({
      ...current,
      count,
      displayName: count > 1 ? `${current.name} (x${count})` : current.name
    });
    
    i += count;
  }
  
  return collapsed;
}

module.exports = {
  classifyElement,
  qualifiesForPerChildSection,
  collapseIdenticalSiblings,
  UTILITY_COMPONENTS,
  STRUCTURAL_PATTERNS,
  DECORATIVE_PATTERNS
};
