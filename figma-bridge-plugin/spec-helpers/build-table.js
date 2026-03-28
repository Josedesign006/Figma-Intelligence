/**
 * build-table.js
 * 
 * Generates Figma MCP commands to create structured data tables.
 * Used by all spec types for rendering property tables, attribute tables,
 * token mapping tables, etc.
 * 
 * Design tokens:
 * - Header background: #F3F4F6
 * - Alternate row background: #FAFAFA  
 * - Border color: #E5E5E5
 * - Header text: 13px bold, #1A1A1A
 * - Body text: 13px regular, #1A1A1A
 * - Cell padding: 8px horizontal, 6px vertical
 */

const TABLE_STYLES = {
  headerBg: '#F3F4F6',
  altRowBg: '#FAFAFA',
  borderColor: '#E5E5E5',
  textColor: '#1A1A1A',
  headerFontSize: 13,
  bodyFontSize: 13,
  cellPaddingH: 8,
  cellPaddingV: 6,
  borderWeight: 1,
  rowHeight: 36,
  headerRowHeight: 40
};

/**
 * Build a table specification object.
 * 
 * @param {Object} config
 * @param {Array<Object>} config.columns - [{ key, label, width }]
 * @param {Array<Object>} config.rows - [{ [key]: value, ... }]
 * @param {number} config.x - X position
 * @param {number} config.y - Y position
 * @param {string} config.name - Frame name for the table
 * @returns {Object} Table spec with dimensions and commands
 */
function buildTable(config) {
  const { columns, rows, x = 0, y = 0, name = 'Table' } = config;
  
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const totalHeight = TABLE_STYLES.headerRowHeight + (rows.length * TABLE_STYLES.rowHeight);
  
  const commands = [];
  
  // Table container frame
  commands.push({
    tool: 'create_frame',
    params: {
      x, y,
      width: totalWidth,
      height: totalHeight,
      name,
      fills: [{ type: 'SOLID', color: '#FFFFFF' }],
      stroke: { color: TABLE_STYLES.borderColor, weight: TABLE_STYLES.borderWeight }
    }
  });
  
  // Header row
  let colX = 0;
  for (const col of columns) {
    commands.push({
      tool: 'create_frame',
      params: {
        x: colX, y: 0,
        width: col.width,
        height: TABLE_STYLES.headerRowHeight,
        name: `Header: ${col.label}`,
        fills: [{ type: 'SOLID', color: TABLE_STYLES.headerBg }]
      }
    });
    
    commands.push({
      tool: 'create_text',
      params: {
        x: colX + TABLE_STYLES.cellPaddingH,
        y: TABLE_STYLES.cellPaddingV + 4,
        content: col.label,
        font_size: TABLE_STYLES.headerFontSize,
        font_weight: 'Bold',
        color: TABLE_STYLES.textColor,
        width: col.width - (TABLE_STYLES.cellPaddingH * 2)
      }
    });
    
    colX += col.width;
  }
  
  // Body rows
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const rowY = TABLE_STYLES.headerRowHeight + (rowIdx * TABLE_STYLES.rowHeight);
    const isAlt = rowIdx % 2 === 1;
    
    colX = 0;
    for (const col of columns) {
      const cellValue = String(row[col.key] || '');
      
      // Cell background (alternating)
      if (isAlt) {
        commands.push({
          tool: 'create_frame',
          params: {
            x: colX, y: rowY,
            width: col.width,
            height: TABLE_STYLES.rowHeight,
            name: `Cell ${rowIdx}:${col.key}`,
            fills: [{ type: 'SOLID', color: TABLE_STYLES.altRowBg }]
          }
        });
      }
      
      // Cell text
      commands.push({
        tool: 'create_text',
        params: {
          x: colX + TABLE_STYLES.cellPaddingH,
          y: rowY + TABLE_STYLES.cellPaddingV + 2,
          content: cellValue,
          font_size: TABLE_STYLES.bodyFontSize,
          font_weight: row._bold && row._bold.includes(col.key) ? 'Bold' : 'Regular',
          color: TABLE_STYLES.textColor,
          width: col.width - (TABLE_STYLES.cellPaddingH * 2)
        }
      });
      
      // Cell border (bottom)
      commands.push({
        tool: 'create_line',
        params: {
          start_x: colX,
          start_y: rowY + TABLE_STYLES.rowHeight,
          end_x: colX + col.width,
          end_y: rowY + TABLE_STYLES.rowHeight,
          stroke_color: TABLE_STYLES.borderColor,
          stroke_weight: TABLE_STYLES.borderWeight
        }
      });
      
      colX += col.width;
    }
  }
  
  return {
    commands,
    width: totalWidth,
    height: totalHeight
  };
}

/**
 * Build an anatomy attribute table.
 */
function buildAnatomyTable(elements, x, y) {
  const columns = [
    { key: 'number', label: '#', width: 48 },
    { key: 'type', label: 'Type', width: 48 },
    { key: 'name', label: 'Element', width: 200 },
    { key: 'notes', label: 'Notes', width: 544 }
  ];
  
  const rows = elements.map((el, i) => ({
    number: String(i + 1),
    type: el.typeIcon || '🔲',
    name: el.displayName + (el.hidden ? ' (hidden)' : ''),
    notes: el.semanticNotes || ''
  }));
  
  return buildTable({ columns, rows, x, y, name: 'Attribute Table' });
}

/**
 * Build an API property table.
 */
function buildApiTable(properties, x, y) {
  const columns = [
    { key: 'name', label: 'Property', width: 160 },
    { key: 'type', label: 'Type', width: 100 },
    { key: 'values', label: 'Values', width: 200 },
    { key: 'default', label: 'Default', width: 120 },
    { key: 'required', label: 'Required', width: 80 },
    { key: 'notes', label: 'Notes', width: 380 }
  ];
  
  const rows = properties.map(prop => ({
    name: prop.name,
    type: prop.type,
    values: Array.isArray(prop.values) ? prop.values.join(' | ') : prop.values,
    default: prop.default || '—',
    required: prop.required ? '✓' : '—',
    notes: prop.notes || '',
    _bold: ['default']
  }));
  
  return buildTable({ columns, rows, x, y, name: 'API Property Table' });
}

/**
 * Build a color token mapping table.
 */
function buildColorTable(tokenMappings, states, x, y) {
  const stateColumns = states.map(state => ({
    key: state.toLowerCase(),
    label: state,
    width: Math.max(160, Math.floor(640 / states.length))
  }));
  
  const columns = [
    { key: 'element', label: 'Element', width: 140 },
    { key: 'property', label: 'Property', width: 80 },
    ...stateColumns
  ];
  
  const rows = tokenMappings.map(mapping => {
    const row = {
      element: mapping.element,
      property: mapping.property
    };
    for (const state of states) {
      const stateKey = state.toLowerCase();
      const token = mapping.states[stateKey];
      row[stateKey] = token ? `${token.name}\n${token.hex}` : '—';
    }
    return row;
  });
  
  return buildTable({ columns, rows, x, y, name: 'Color Token Table' });
}

/**
 * Build a structure dimensions table.
 */
function buildStructureTable(measurements, variants, x, y, sectionName) {
  const variantColumns = variants.map(v => ({
    key: v.toLowerCase().replace(/\s/g, '_'),
    label: v,
    width: Math.max(120, Math.floor(720 / variants.length))
  }));
  
  const columns = [
    { key: 'property', label: 'Property', width: 200 },
    ...variantColumns
  ];
  
  const rows = measurements.map(m => {
    const row = { property: m.property };
    for (const v of variants) {
      const vKey = v.toLowerCase().replace(/\s/g, '_');
      const val = m.values[vKey];
      row[vKey] = val ? (val.token ? `${val.token} (${val.px})` : String(val.px)) : '—';
    }
    return row;
  });
  
  return buildTable({ columns, rows, x, y, name: `Structure: ${sectionName}` });
}

module.exports = {
  buildTable,
  buildAnatomyTable,
  buildApiTable,
  buildColorTable,
  buildStructureTable,
  TABLE_STYLES
};
