/**
 * spec-helpers/index.js — Barrel export for spec helper modules.
 */

const { classifyElement, qualifiesForPerChildSection, collapseIdenticalSiblings, UTILITY_COMPONENTS, STRUCTURAL_PATTERNS, DECORATIVE_PATTERNS } = require('./classify-elements');
const { buildTable, buildAnatomyTable, buildApiTable, buildColorTable, buildStructureTable, TABLE_STYLES } = require('./build-table');
const { calculateMarkerPositions, generateMarkerCommands, MARKER_DIAMETER, MARKER_COLOR, CONNECTOR_STROKE, MIN_MARKER_GAP, MARKER_OFFSET } = require('./position-markers');
const { parseFigmaLink } = require('./parse-figma-link');

module.exports = {
  // classify-elements
  classifyElement,
  qualifiesForPerChildSection,
  collapseIdenticalSiblings,
  UTILITY_COMPONENTS,
  STRUCTURAL_PATTERNS,
  DECORATIVE_PATTERNS,
  // build-table
  buildTable,
  buildAnatomyTable,
  buildApiTable,
  buildColorTable,
  buildStructureTable,
  TABLE_STYLES,
  // position-markers
  calculateMarkerPositions,
  generateMarkerCommands,
  MARKER_DIAMETER,
  MARKER_COLOR,
  CONNECTOR_STROKE,
  MIN_MARKER_GAP,
  MARKER_OFFSET,
  // parse-figma-link
  parseFigmaLink,
};
