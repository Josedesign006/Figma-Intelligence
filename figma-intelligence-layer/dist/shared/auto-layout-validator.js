"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Auto-Layout Safety Validator
// Generates a self-contained Figma Plugin API script that performs DFS
// validation and repair of auto-layout sizing on a node tree.
// Enforces Figma's sizing rules: FILL only inside auto-layout parents,
// HUG only on auto-layout frames and text, no parent HUG + child FILL conflicts.
// Also enforces document layout rules: sections FILL width, text FILL horizontal,
// dividers FILL width / FIXED height, spacing snapped to token scale.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateValidatorScript = generateValidatorScript;
exports.generateValidatorCall = generateValidatorCall;
exports.generateDocumentRepairScript = generateDocumentRepairScript;
exports.generateDocumentRepairCall = generateDocumentRepairCall;
/**
 * Returns a JavaScript function definition string for `validateAutoLayout(root)`.
 * This function is meant to be inlined into a bridge.execute() script.
 * It performs a depth-first walk of the node tree and repairs invalid
 * auto-layout sizing combinations.
 */
function generateValidatorScript() {
    return `
  function validateAutoLayout(root) {
    let fixes = 0;
    const details = [];
    const isMobile = root.width && root.width <= 430;

    // ── Document spacing token scale ──
    const DOC_SPACING_TOKENS = [4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64];

    function snapToToken(value) {
      if (DOC_SPACING_TOKENS.indexOf(value) >= 0) return value;
      let closest = DOC_SPACING_TOKENS[0];
      let minDist = Math.abs(value - closest);
      for (let i = 1; i < DOC_SPACING_TOKENS.length; i++) {
        const dist = Math.abs(value - DOC_SPACING_TOKENS[i]);
        if (dist < minDist) { closest = DOC_SPACING_TOKENS[i]; minDist = dist; }
      }
      return closest;
    }

    function isAutoLayout(node) {
      return node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL';
    }

    function canHug(node) {
      return node.type === 'TEXT' || (isAutoLayout(node));
    }

    function classifyNode(node) {
      const n = (node.name || '').toLowerCase();
      if (/btn|button|cta/.test(n)) return 'button';
      if (/icon|chevron|arrow/.test(n)) return 'icon';
      if (/avatar|profile.?pic|thumbnail/.test(n)) return 'avatar';
      if (/badge|tag|chip|pill/.test(n)) return 'badge';
      if (/input|field|textfield|textarea|search.?bar/.test(n)) return 'input';
      if (/card|tile|panel/.test(n)) return 'card';
      if (/label|caption/.test(n)) return 'label';
      return null;
    }

    function classifyDocNode(node) {
      const n = (node.name || '').toLowerCase();
      if (/doc(ument)?[\\s_-]?page|spec[\\s_-]?page|guide(line)?[\\s_-]?page/.test(n)) return 'document_page';
      if (/header[\\s_-]?block|doc[\\s_-]?header|page[\\s_-]?title[\\s_-]?block/.test(n)) return 'header_block';
      if (/section[\\s_-]?block|content[\\s_-]?section/.test(n)) return 'section_block';
      if (/toc[\\s_-]?row/.test(n)) return 'toc_row';
      if (/paragraph[\\s_-]?group|body[\\s_-]?text[\\s_-]?block|text[\\s_-]?block/.test(n)) return 'paragraph_group';
      if (/\\bdivider\\b|\\bseparator\\b|\\bhr\\b/.test(n)) return 'divider';
      if (/footer[\\s_-]?block|doc[\\s_-]?footer/.test(n)) return 'footer_block';
      if (/table[\\s_-]?block|spec[\\s_-]?table|data[\\s_-]?table/.test(n)) return 'table_block';
      return null;
    }

    function isDocumentContainer(docRole) {
      return docRole === 'document_page' || docRole === 'section_block' ||
             docRole === 'header_block' || docRole === 'paragraph_group' ||
             docRole === 'footer_block' || docRole === 'table_block';
    }

    function fix(node, prop, from, to, reason) {
      if (prop in node) {
        node[prop] = to;
        fixes++;
        details.push(reason + ' (' + node.name + ': ' + prop + ' ' + from + ' -> ' + to + ')');
      }
    }

    function walk(node) {
      if (!('children' in node)) return;
      const parentIsAL = isAutoLayout(node);
      const parentDir = node.layoutMode;
      const parentDocRole = classifyDocNode(node);

      // ── Rule H: Document page root must be FIXED width, HUG height ──
      if (parentDocRole === 'document_page' && isAutoLayout(node)) {
        if (node.counterAxisSizingMode !== 'FIXED') {
          fix(node, 'counterAxisSizingMode', node.counterAxisSizingMode, 'FIXED', 'Rule H: Document page must be FIXED width');
        }
        if (node.primaryAxisSizingMode !== 'AUTO') {
          fix(node, 'primaryAxisSizingMode', node.primaryAxisSizingMode, 'AUTO', 'Rule H: Document page must HUG height');
        }
      }

      // ── Rule K: Spacing snap for document containers ──
      if (parentDocRole && isDocumentContainer(parentDocRole) && isAutoLayout(node)) {
        if ('itemSpacing' in node && node.itemSpacing > 0) {
          const snapped = snapToToken(node.itemSpacing);
          if (snapped !== node.itemSpacing) {
            fix(node, 'itemSpacing', node.itemSpacing, snapped, 'Rule K: Snap spacing to token scale');
          }
        }
      }

      for (const child of node.children) {
        const role = classifyNode(child);
        const docRole = classifyDocNode(child);
        const hSizing = ('layoutSizingHorizontal' in child) ? child.layoutSizingHorizontal : null;
        const vSizing = ('layoutSizingVertical' in child) ? child.layoutSizingVertical : null;

        // ── Rule A: No FILL outside auto-layout ──
        if (!parentIsAL) {
          if (hSizing === 'FILL') {
            fix(child, 'layoutSizingHorizontal', 'FILL', 'FIXED', 'Rule A: FILL outside auto-layout');
          }
          if (vSizing === 'FILL') {
            fix(child, 'layoutSizingVertical', 'FILL', 'FIXED', 'Rule A: FILL outside auto-layout');
          }
        }

        // ── Rule B: TEXT nodes default HUG; only FILL if parent is auto-layout ──
        if (child.type === 'TEXT') {
          if (hSizing === 'FILL' && !parentIsAL) {
            fix(child, 'layoutSizingHorizontal', 'FILL', 'HUG', 'Rule B: TEXT FILL outside auto-layout');
          }
          if (vSizing === 'FILL') {
            fix(child, 'layoutSizingVertical', 'FILL', 'HUG', 'Rule B: TEXT should HUG vertically');
          }
        }

        // ── Rule C: Button → HUG/HUG (unless mobile primary CTA) ──
        if (role === 'button') {
          const isMobilePrimary = isMobile && /primary|cta|submit|continue|next/.test((child.name || '').toLowerCase());
          if (!isMobilePrimary) {
            if (hSizing === 'FILL' && parentDir === 'HORIZONTAL') {
              fix(child, 'layoutSizingHorizontal', 'FILL', 'HUG', 'Rule C: Button should HUG in horizontal parent');
            }
          }
          if (vSizing === 'FILL') {
            fix(child, 'layoutSizingVertical', 'FILL', 'HUG', 'Rule C: Button should HUG vertically');
          }
          // Icon children inside button → FIXED
          if ('children' in child) {
            for (const gc of child.children) {
              const gcRole = classifyNode(gc);
              if (gcRole === 'icon' || gc.type === 'VECTOR') {
                if ('layoutSizingHorizontal' in gc && gc.layoutSizingHorizontal !== 'FIXED') {
                  fix(gc, 'layoutSizingHorizontal', gc.layoutSizingHorizontal, 'FIXED', 'Rule C: Icon in button must be FIXED');
                }
                if ('layoutSizingVertical' in gc && gc.layoutSizingVertical !== 'FIXED') {
                  fix(gc, 'layoutSizingVertical', gc.layoutSizingVertical, 'FIXED', 'Rule C: Icon in button must be FIXED');
                }
              }
            }
          }
        }

        // ── Rule D: Input in vertical form → FILL horizontal, HUG vertical ──
        if (role === 'input' && parentIsAL && parentDir === 'VERTICAL') {
          if (hSizing !== 'FILL' && 'layoutSizingHorizontal' in child) {
            fix(child, 'layoutSizingHorizontal', hSizing, 'FILL', 'Rule D: Input in vertical parent should FILL horizontally');
          }
          if (vSizing === 'FILL') {
            fix(child, 'layoutSizingVertical', 'FILL', 'HUG', 'Rule D: Input should HUG vertically');
          }
        }

        // ── Rule E: Card in vertical feed → FILL horizontal, HUG vertical ──
        if (role === 'card' && parentIsAL && parentDir === 'VERTICAL') {
          if (hSizing !== 'FILL' && 'layoutSizingHorizontal' in child) {
            fix(child, 'layoutSizingHorizontal', hSizing, 'FILL', 'Rule E: Card in vertical parent should FILL horizontally');
          }
          if (vSizing === 'FILL') {
            fix(child, 'layoutSizingVertical', 'FILL', 'HUG', 'Rule E: Card should HUG vertically');
          }
        }

        // ── Icon / Avatar → always FIXED ──
        if (role === 'icon' || role === 'avatar') {
          if (hSizing === 'FILL') {
            fix(child, 'layoutSizingHorizontal', 'FILL', 'FIXED', 'Icon/Avatar must be FIXED');
          }
          if (vSizing === 'FILL') {
            fix(child, 'layoutSizingVertical', 'FILL', 'FIXED', 'Icon/Avatar must be FIXED');
          }
          if (hSizing === 'HUG' && child.type !== 'TEXT' && !isAutoLayout(child)) {
            fix(child, 'layoutSizingHorizontal', 'HUG', 'FIXED', 'Icon/Avatar: HUG not valid on non-AL non-text');
          }
        }

        // ── Rule F: HUG + parent stretch conflict ──
        if (parentIsAL && 'layoutSizingHorizontal' in child) {
          if (parentDir === 'VERTICAL' && isAutoLayout(child)) {
            if (child.layoutSizingHorizontal === 'FILL' && child.primaryAxisSizingMode === 'AUTO' && child.layoutMode === 'HORIZONTAL') {
              // Fine — FILL is cross-axis, primary hug is content-based
            }
          }
          if (parentDir === 'HORIZONTAL' && isAutoLayout(child)) {
            if (child.layoutGrow > 0 && child.layoutSizingHorizontal === 'HUG') {
              fix(child, 'layoutSizingHorizontal', 'HUG', 'FIXED', 'Rule F: Cannot HUG and grow in same axis');
            }
          }
        }

        // ── Rule G: Document section frames must FILL width in vertical parent ──
        if (docRole && parentIsAL && parentDir === 'VERTICAL') {
          const shouldFillWidth = docRole === 'section_block' || docRole === 'header_block' ||
                                  docRole === 'paragraph_group' || docRole === 'footer_block' ||
                                  docRole === 'table_block' || docRole === 'toc_row';
          if (shouldFillWidth && hSizing !== 'FILL' && 'layoutSizingHorizontal' in child) {
            fix(child, 'layoutSizingHorizontal', hSizing, 'FILL', 'Rule G: Document section must FILL width');
            if ('layoutAlign' in child) child.layoutAlign = 'STRETCH';
          }
        }

        // ── Rule I: Divider must FILL width, FIXED height ──
        if (docRole === 'divider' && parentIsAL) {
          if (hSizing !== 'FILL' && 'layoutSizingHorizontal' in child) {
            fix(child, 'layoutSizingHorizontal', hSizing, 'FILL', 'Rule I: Divider must FILL width');
            if ('layoutAlign' in child) child.layoutAlign = 'STRETCH';
          }
          if (vSizing !== 'FIXED' && 'layoutSizingVertical' in child) {
            fix(child, 'layoutSizingVertical', vSizing, 'FIXED', 'Rule I: Divider must be FIXED height');
          }
        }

        // ── Rule J: Text inside document sections must FILL horizontally ──
        if (child.type === 'TEXT' && parentIsAL && parentDir === 'VERTICAL' && parentDocRole && isDocumentContainer(parentDocRole)) {
          if (hSizing !== 'FILL' && 'layoutSizingHorizontal' in child) {
            fix(child, 'layoutSizingHorizontal', hSizing, 'FILL', 'Rule J: Text in document section must FILL width');
            if ('layoutAlign' in child) child.layoutAlign = 'STRETCH';
          }
        }

        // ── General: HUG on non-eligible node ──
        if (hSizing === 'HUG' && !canHug(child)) {
          fix(child, 'layoutSizingHorizontal', 'HUG', 'FIXED', 'HUG not valid on ' + child.type);
        }
        if (vSizing === 'HUG' && !canHug(child)) {
          fix(child, 'layoutSizingVertical', 'HUG', 'FIXED', 'HUG not valid on ' + child.type);
        }

        // Recurse
        walk(child);
      }
    }

    walk(root);
    return { fixes: fixes, details: details };
  }
  `.trim();
}
/**
 * Returns a JS statement that invokes the validator on the given variable.
 * Must be used after `generateValidatorScript()` has been inlined.
 */
function generateValidatorCall(varName) {
    return `const _alv = validateAutoLayout(${varName});`;
}
/**
 * Generates a document-specific repair pass that fixes structural layout issues.
 * This should be called AFTER the main validator pass.
 * Returns a JS function definition for `repairDocumentLayout(root)`.
 */
function generateDocumentRepairScript() {
    return `
  function repairDocumentLayout(root) {
    let repairs = 0;
    const details = [];

    function isAutoLayout(node) {
      return node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL';
    }

    function isDocPage(node) {
      const n = (node.name || '').toLowerCase();
      return /doc(ument)?[\\s_-]?page|spec[\\s_-]?page|documentation/.test(n);
    }

    const DOC_SPACING_TOKENS = [4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64];
    function snapToToken(value) {
      if (DOC_SPACING_TOKENS.indexOf(value) >= 0) return value;
      let closest = DOC_SPACING_TOKENS[0];
      let minDist = Math.abs(value - closest);
      for (let i = 1; i < DOC_SPACING_TOKENS.length; i++) {
        const dist = Math.abs(value - DOC_SPACING_TOKENS[i]);
        if (dist < minDist) { closest = DOC_SPACING_TOKENS[i]; minDist = dist; }
      }
      return closest;
    }

    // Only run on document pages
    if (!isDocPage(root) && !(root.width >= 1000 && root.width <= 1400 && root.layoutMode === 'VERTICAL')) {
      return { repairs: 0, details: ['Not a document page — skipped repair pass'] };
    }

    // ── Repair 1: Width normalization for direct children ──
    if (isAutoLayout(root) && root.layoutMode === 'VERTICAL' && 'children' in root) {
      for (const child of root.children) {
        if (!('layoutSizingHorizontal' in child)) continue;
        // Skip small fixed elements (markers, icons)
        if (child.width && child.width <= 48 && child.height && child.height <= 48) continue;

        if (child.layoutSizingHorizontal !== 'FILL') {
          child.layoutSizingHorizontal = 'FILL';
          if ('layoutAlign' in child) child.layoutAlign = 'STRETCH';
          repairs++;
          details.push('Repair 1: Forced FILL width on root child: ' + child.name);
        }
      }
    }

    // ── Repair 2: Redundant wrapper removal ──
    function removeRedundantWrappers(node) {
      if (!('children' in node) || !isAutoLayout(node)) return;
      const childrenCopy = [...node.children];
      for (const child of childrenCopy) {
        if (!('children' in child) || !isAutoLayout(child)) continue;
        // If child has exactly 1 child frame with same layout mode and no semantic name
        if (child.children.length === 1 && isAutoLayout(child.children[0]) &&
            child.layoutMode === child.children[0].layoutMode &&
            !child.name.match(/section|header|footer|block|group|toc|table/i) &&
            child.name.match(/^(Frame|Group|Auto|Container)\\s*\\d*$/i)) {
          // Flatten: move inner child's children to the wrapper's parent position
          // (Only flag it — actual DOM manipulation is risky in bulk repair)
          repairs++;
          details.push('Repair 2: Redundant wrapper detected: ' + child.name + ' (contains single ' + child.children[0].name + ')');
        }
        removeRedundantWrappers(child);
      }
    }
    removeRedundantWrappers(root);

    // ── Repair 3: Snap all spacing in document tree ──
    function snapSpacing(node) {
      if (!('children' in node) || !isAutoLayout(node)) return;
      if ('itemSpacing' in node && node.itemSpacing > 0) {
        const snapped = snapToToken(node.itemSpacing);
        if (snapped !== node.itemSpacing) {
          node.itemSpacing = snapped;
          repairs++;
          details.push('Repair 3: Snapped spacing ' + node.itemSpacing + ' -> ' + snapped + ' on ' + node.name);
        }
      }
      // Snap padding
      var padProps = ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'];
      for (var pp of padProps) {
        if (pp in node && node[pp] > 0) {
          var snappedPad = snapToToken(node[pp]);
          if (snappedPad !== node[pp]) {
            var oldPad = node[pp];
            node[pp] = snappedPad;
            repairs++;
            details.push('Repair 3: Snapped ' + pp + ' ' + oldPad + ' -> ' + snappedPad + ' on ' + node.name);
          }
        }
      }
      for (const child of node.children) {
        snapSpacing(child);
      }
    }
    snapSpacing(root);

    // ── Repair 4: Force text in document sections to FILL horizontally ──
    function fixDocText(node) {
      if (!('children' in node)) return;
      const n = (node.name || '').toLowerCase();
      const isDocSection = /section|header|overview|anatomy|paragraph|content|footer/i.test(n);
      if (isDocSection && isAutoLayout(node) && node.layoutMode === 'VERTICAL') {
        for (const child of node.children) {
          if (child.type === 'TEXT' && 'layoutSizingHorizontal' in child && child.layoutSizingHorizontal !== 'FILL') {
            child.layoutSizingHorizontal = 'FILL';
            if ('layoutAlign' in child) child.layoutAlign = 'STRETCH';
            repairs++;
            details.push('Repair 4: Text FILL in doc section: ' + child.name + ' inside ' + node.name);
          }
        }
      }
      for (const child of node.children) {
        fixDocText(child);
      }
    }
    fixDocText(root);

    return { repairs: repairs, details: details };
  }
  `.trim();
}
/**
 * Returns a JS statement that invokes the document repair pass.
 * Must be used after `generateDocumentRepairScript()` has been inlined.
 */
function generateDocumentRepairCall(varName) {
    return `const _docRepair = repairDocumentLayout(${varName});`;
}
//# sourceMappingURL=auto-layout-validator.js.map