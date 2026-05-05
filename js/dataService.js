import { GEO_NAME_MAP } from './config.js';

/**
 * Global State Object
 * Holds the current UI state and all the data loaded from the API.
 */
export const state = {
  currentYear: 2023,
  flowMode: 'qty', // 'qty' | 'val'
  selectedCountry: null,
  maxTINet: 1,
  maxExportVolume: 1,
  exportVolumeByKey: {},
  TI_RANKS: {},
  ALL_PARTNERS: new Set(),
  data: {} // Will hold TRADE_QUANTITY_BY_YEAR, TRADE_VALUE_BY_YEAR, etc.
};

/**
 * Fetches the main data payload and initializes calculated datasets.
 */
export async function fetchTradeData() {
  const DATA_URL = 'https://mass-14.github.io/BeanMap-data/data_layer.json';

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error('Network response was not ok');

    state.data = await response.json();

    // Auto-populate all partners for global awareness
    if (state.data.TRADE_QUANTITY_BY_YEAR) {
      Object.values(state.data.TRADE_QUANTITY_BY_YEAR).forEach(snap => {
        Object.values(snap).forEach(row => {
          Object.keys(row).forEach(k => state.ALL_PARTNERS.add(k));
        });
      });
    }

    // Pre-calculate Transformation Indices
    state.data.TRANSFORMATION_INDEX_BY_YEAR = buildTransformationIndexByYear();
    state.data.TRANSFORMATION_INDEX = state.data.TRANSFORMATION_INDEX_BY_YEAR[2023] || {};

    return true;
  } catch (error) {
    console.error('Error fetching data:', error);
    return false;
  }
}

/**
 * Calculates the net Transformation Index (TI) for all countries across all years.
 */
function buildTransformationIndexByYear() {
  const byYear = {};
  const rawByYear = state.data.TRADE_QTY_RAW_BY_YEAR || {};
  let globalMax = 0;

  Object.entries(rawByYear).forEach(([year, snap]) => {
    const netByKey = {};
    Object.entries(snap || {}).forEach(([reporter, row]) => {
      Object.entries(row || {}).forEach(([partner, qty]) => {
        const amount = qty || 0;
        if (!amount) return;

        // Reporter exports raw coffee (-)
        netByKey[reporter] = (netByKey[reporter] || 0) - amount;
        // Partner imports raw coffee (+)
        netByKey[partner] = (netByKey[partner] || 0) + amount;
      });
    });

    byYear[year] = netByKey;

    const yearMax = Math.max(0, ...Object.values(netByKey));
    if (yearMax > globalMax) globalMax = yearMax;
  });

  state.maxTINet = Math.max(1, globalMax);
  return byYear;
}

/**
 * Rebuilds the ranking object for TI based on a specific year.
 */
export function rebuildTransformationRanks(year) {
  const tiSnap = state.data.TRANSFORMATION_INDEX_BY_YEAR[year] || state.data.TRANSFORMATION_INDEX_BY_YEAR[2023] || {};

  // Clear existing ranks
  Object.keys(state.TI_RANKS).forEach(k => delete state.TI_RANKS[k]);

  // Sort and assign ranks
  Object.entries(tiSnap)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k], i) => { state.TI_RANKS[k] = i + 1; });
}

/**
 * Rebuilds the max export volumes to properly scale 3D depths and UI elements.
 */
export function rebuildExportVolumes(year) {
  const qtySnap = state.data.TRADE_QUANTITY_BY_YEAR[year] || state.data.TRADE_QUANTITY_BY_YEAR[2023] || state.data.TRADE_QUANTITY || {};

  state.exportVolumeByKey = {};
  Object.entries(qtySnap).forEach(([k, row]) => {
    state.exportVolumeByKey[k] = Object.values(row).reduce((s, v) => s + v, 0);
  });

  state.maxExportVolume = Math.max(1, ...Object.values(state.exportVolumeByKey));
}

/**
 * Gets the raw net Transformation volume for a given country.
 */
export function getTransformationNet(name, year = state.currentYear) {
  const key = GEO_NAME_MAP[name] || name;
  const snap = state.data.TRANSFORMATION_INDEX_BY_YEAR[year] || state.data.TRANSFORMATION_INDEX_BY_YEAR[2023] || {};
  return snap[key] ?? 0;
}

/**
 * Gets a normalized (0-100) score of the Transformation Index for visual scaling.
 */
export function getTransformationVisualScore(name, year = state.currentYear) {
  const key = GEO_NAME_MAP[name] || name;
  const snap = state.data.TRANSFORMATION_INDEX_BY_YEAR[year] || state.data.TRANSFORMATION_INDEX_BY_YEAR[2023] || {};

  const values = Object.values(snap);
  if (!values.length) return 0;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const value = snap[key] ?? 0;

  if (max === min) return 0;
  return Math.round(((value - min) / (max - min)) * 100);
}

/** Shorthand for current year TI visual score */
export function getTI(name) {
  return getTransformationVisualScore(name, state.currentYear);
}

/**
 * Gets the percentage of processed exports vs raw.
 */
export function getProcessedShare(key, year = state.currentYear) {
  const snap = state.data.PROCESSED_SHARE_BY_YEAR[year] || state.data.PROCESSED_SHARE_BY_YEAR[2023] || {};
  return snap[key] ?? 0;
}

/**
 * Calculates the hex color for the top face of a 3D country mesh based on its TI.
 */
export function getTopColor(tiVisualScore, key, year = state.currentYear) {
  const tiRaw = getTransformationNet(key, year);
  const ratio = Math.max(0, Math.min(1, tiRaw / state.maxTINet));

  // Interpolate between Low TI (#E2D8BF) and High TI (#7A5234)
  const r = Math.round(0xE2 + (0x7A - 0xE2) * ratio);
  const g = Math.round(0xD7 + (0x52 - 0xD7) * ratio);
  const b = Math.round(0xBF + (0x34 - 0xBF) * ratio);

  return (r << 16) | (g << 8) | b;
}

/**
 * Calculates the hex color for the side faces of a 3D country mesh.
 */
export function getSideColor(tiVisualScore, key, year = state.currentYear) {
  return getTopColor(tiVisualScore, key, year); // Matches original design logic
}

/**
 * Calculates the physical Z-depth (extrusion height) for a 3D country mesh.
 */
export function getDepth(tiVisualScore, key) {
  const qtySnap = state.data.TRADE_QUANTITY_BY_YEAR[state.currentYear] || state.data.TRADE_QUANTITY || {};

  // If the country has export data, scale by Transformation Index
  if (qtySnap[key]) {
    const tiRaw = getTransformationNet(key, state.currentYear);
    const tiShare = Math.max(0, tiRaw) / state.maxTINet;
    return 0.5 + tiShare * 45;
  }

  // If it's pure importer, scale by inbound total vs max export
  const inboundTotal = Object.values(qtySnap).reduce((s, row) => s + (row[key] || 0), 0);
  const globalExportMax = state.maxExportVolume > 1 ? state.maxExportVolume : 1000000;
  return 0.5 + (inboundTotal / globalExportMax) * 40;
}