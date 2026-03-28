/**
 * position-markers.js
 * 
 * Calculate marker positions for anatomy and color annotations.
 * Places numbered markers outside the component artwork with
 * non-overlapping leader lines to each target element.
 * 
 * Used by anatomy and color spec rendering phases.
 */

const MARKER_DIAMETER = 24;
const MARKER_COLOR = '#D946EF';  // Pink/magenta
const CONNECTOR_STROKE = 1;
const MIN_MARKER_GAP = 8;
const MARKER_OFFSET = 40;  // Distance from artwork edge to marker center

/**
 * Calculate marker positions for a list of target elements.
 * 
 * Strategy: Place markers in a column to the LEFT of the artwork,
 * distributed evenly. If too many markers, use both left and right sides.
 * 
 * @param {Object} artworkBounds - { x, y, width, height } of the component artwork
 * @param {Array} targets - Array of { id, name, bounds: { x, y, width, height } }
 * @returns {Array} Array of { targetId, markerX, markerY, lineStartX, lineStartY, lineEndX, lineEndY }
 */
function calculateMarkerPositions(artworkBounds, targets) {
  const positions = [];
  const count = targets.length;
  
  if (count === 0) return positions;
  
  // Determine available height for markers
  const availableHeight = artworkBounds.height;
  const markerSpacing = Math.max(
    MARKER_DIAMETER + MIN_MARKER_GAP,
    availableHeight / count
  );
  
  // If all markers fit on the left side
  const maxLeftSide = Math.floor(availableHeight / (MARKER_DIAMETER + MIN_MARKER_GAP));
  const useRightSide = count > maxLeftSide;
  
  const leftCount = useRightSide ? Math.ceil(count / 2) : count;
  const rightCount = useRightSide ? count - leftCount : 0;
  
  // Place left-side markers
  for (let i = 0; i < leftCount; i++) {
    const target = targets[i];
    const markerX = artworkBounds.x - MARKER_OFFSET;
    const markerY = artworkBounds.y + (i * (availableHeight / leftCount)) + MARKER_DIAMETER;
    
    // Connector line: from marker right edge to target left edge
    const targetCenterY = target.bounds.y + target.bounds.height / 2;
    
    positions.push({
      targetId: target.id,
      number: i + 1,
      markerX,
      markerY,
      lineStartX: markerX + MARKER_DIAMETER / 2,
      lineStartY: markerY,
      lineEndX: target.bounds.x,
      lineEndY: targetCenterY
    });
  }
  
  // Place right-side markers (if needed)
  for (let i = 0; i < rightCount; i++) {
    const target = targets[leftCount + i];
    const markerX = artworkBounds.x + artworkBounds.width + MARKER_OFFSET;
    const markerY = artworkBounds.y + (i * (availableHeight / rightCount)) + MARKER_DIAMETER;
    
    const targetCenterY = target.bounds.y + target.bounds.height / 2;
    
    positions.push({
      targetId: target.id,
      number: leftCount + i + 1,
      markerX,
      markerY,
      lineStartX: markerX - MARKER_DIAMETER / 2,
      lineStartY: markerY,
      lineEndX: target.bounds.x + target.bounds.width,
      lineEndY: targetCenterY
    });
  }
  
  return positions;
}

/**
 * Generate Figma MCP commands to render markers and connector lines.
 * 
 * @param {string} parentFrameId - The frame to place markers in
 * @param {Array} markerPositions - Output from calculateMarkerPositions
 * @returns {Array} Array of MCP command objects
 */
function generateMarkerCommands(parentFrameId, markerPositions) {
  const commands = [];
  
  for (const pos of markerPositions) {
    // Create marker circle
    commands.push({
      tool: 'create_ellipse',
      params: {
        parent_id: parentFrameId,
        x: pos.markerX - MARKER_DIAMETER / 2,
        y: pos.markerY - MARKER_DIAMETER / 2,
        width: MARKER_DIAMETER,
        height: MARKER_DIAMETER,
        fill: MARKER_COLOR,
        name: `Marker ${pos.number}`
      }
    });
    
    // Create number text inside marker
    commands.push({
      tool: 'create_text',
      params: {
        parent_id: parentFrameId,
        x: pos.markerX - (pos.number >= 10 ? 7 : 4),
        y: pos.markerY - 7,
        content: String(pos.number),
        font_size: 13,
        font_weight: 'Bold',
        color: '#FFFFFF',
        name: `Marker ${pos.number} Label`
      }
    });
    
    // Create connector line
    commands.push({
      tool: 'create_line',
      params: {
        parent_id: parentFrameId,
        start_x: pos.lineStartX,
        start_y: pos.lineStartY,
        end_x: pos.lineEndX,
        end_y: pos.lineEndY,
        stroke_color: MARKER_COLOR,
        stroke_weight: CONNECTOR_STROKE,
        name: `Connector ${pos.number}`
      }
    });
  }
  
  return commands;
}

module.exports = {
  calculateMarkerPositions,
  generateMarkerCommands,
  MARKER_DIAMETER,
  MARKER_COLOR,
  CONNECTOR_STROKE,
  MIN_MARKER_GAP,
  MARKER_OFFSET
};
