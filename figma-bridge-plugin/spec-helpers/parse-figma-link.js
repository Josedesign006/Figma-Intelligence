/**
 * parse-figma-link.js
 * 
 * Parses a Figma URL into its component parts: file_key and node_id.
 * 
 * Usage:
 *   node parse-figma-link.js "https://www.figma.com/design/abc123/File-Name?node-id=100:200"
 * 
 * Output (JSON):
 *   { "file_key": "abc123", "node_id": "100:200", "node_id_encoded": "100-200" }
 */

function parseFigmaLink(url) {
  // Handle both /design/ and /file/ URL formats
  const fileMatch = url.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/);
  if (!fileMatch) {
    throw new Error(`Invalid Figma URL: could not extract file key from "${url}"`);
  }
  const file_key = fileMatch[1];

  // Extract node-id from query params
  const nodeMatch = url.match(/node-id=([^&]+)/);
  if (!nodeMatch) {
    throw new Error(`Invalid Figma URL: could not extract node-id from "${url}"`);
  }
  
  // node-id in URLs uses "-" separator, but Figma API uses ":"
  const node_id_encoded = nodeMatch[1];
  const node_id = node_id_encoded.replace(/-/g, ':');

  return {
    file_key,
    node_id,
    node_id_encoded
  };
}

// CLI usage
if (typeof process !== 'undefined' && process.argv.length > 2) {
  try {
    const result = parseFigmaLink(process.argv[2]);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

module.exports = { parseFigmaLink };
