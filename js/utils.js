/**
 * Converts a CSS hex color string to an integer for Three.js.
 * @param {string} h - Hex color string (e.g., '#5C3317')
 * @returns {number} Integer representation of the color.
 */
export function hexToInt(h) {
  return parseInt(h.replace('#', ''), 16);
}

/**
 * Formats large quantity values compactly (input in tonnes).
 * @param {number} q - Quantity in tonnes.
 * @returns {string} Formatted string (e.g., '1.2M', '500k').
 */
export function fmtQty(q) {
  if (q >= 1000000) return (q / 1000000).toFixed(1) + 'M';
  if (q >= 1000) return Math.round(q / 1000) + 'k';
  return q.toString();
}

/**
 * Formats trade values (input in 1000 USD).
 * @param {number} v - Value in thousands of USD.
 * @returns {string} Formatted string (e.g., '1.5B$', '800M$').
 */
export function fmtVal(v) {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'B$';
  if (v >= 1000) return Math.round(v / 1000) + 'M$';
  return v + 'k$';
}

/**
 * Projects Longitude/Latitude to a 2D plane for 3D extrusion.
 * @param {number} lng - Longitude.
 * @param {number} lat - Latitude.
 * @returns {THREE.Vector2} Projected 2D vector.
 */
export function project(lng, lat) {
  // Uses global window.THREE as imported via CDN in index.html
  return new window.THREE.Vector2((lng / 360) * 500, (lat / 180) * 280);
}

/**
 * Converts a GeoJSON coordinate ring into an array of Three.js Vector2 points.
 * @param {Array} ring - Array of [lng, lat] coordinates.
 * @param {number} step - Step size to downsample the ring for performance.
 * @returns {Array<THREE.Vector2>} Array of projected points.
 */
export function ringToPoints(ring, step) {
  const pts = [];
  for (let i = 0; i < ring.length; i += step) {
    pts.push(project(ring[i][0], ring[i][1]));
  }
  return pts;
}

/**
 * Creates a THREE.Shape from a GeoJSON coordinate ring.
 * @param {Array} ring - Array of [lng, lat] coordinates.
 * @param {number} step - Step size for downsampling.
 * @returns {THREE.Shape|null} Extrudable shape or null if invalid.
 */
export function makeShape(ring, step) {
  const pts = ringToPoints(ring, step);
  if (pts.length < 3) return null;

  const shape = new window.THREE.Shape();
  shape.moveTo(pts[0].x, pts[0].y);

  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i].x, pts[i].y);
  }

  shape.closePath();
  return shape;
}