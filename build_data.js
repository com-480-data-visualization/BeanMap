#!/usr/bin/env node
// build_data.js — Generates data_layer.js from FAO/UNComtrade trade matrix CSVs.
// Usage: node build_data.js
'use strict';

const fs   = require('fs');
const path = require('path');

const QTY_CSV  = path.join(__dirname, 'data/UNComtrade/Trade_Matrix_Quantity.csv');
const VAL_CSV  = path.join(__dirname, 'data/UNComtrade/Trade_Matrix_Value.csv');
const OUT_FILE = path.join(__dirname, 'data_layer.js');

const YEARS = [];
for (let y = 1986; y <= 2024; y++) YEARS.push(y);

// ── CSV PARSER ──────────────────────────────────────────────────────────────
// Handles quoted fields (e.g. "China, mainland").
function parseCSVLine(line) {
  const fields = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      i++;
      const start = i;
      while (i < line.length && line[i] !== '"') i++;
      fields.push(line.slice(start, i).trim());
      i++; // skip closing quote
      if (i < line.length && line[i] === ',') i++;
    } else {
      const j = line.indexOf(',', i);
      const end = j === -1 ? line.length : j;
      fields.push(line.slice(i, end).trim());
      i = end + 1;
    }
  }
  return fields;
}

// ── NAME MAPS ───────────────────────────────────────────────────────────────

// CSV reporter name → canonical key (used in CENTROIDS / GEO_NAME_MAP)
const REPORTER_CANONICAL = {
  // ── Coffee-producing countries ───────────────────────────────────────────
  'Brazil':                               'Brazil',
  'Viet Nam':                             'Vietnam',
  'Colombia':                             'Colombia',
  'Indonesia':                            'Indonesia',
  'Ethiopia':                             'Ethiopia',
  'Ethiopia PDR':                         'Ethiopia', // historical name, merged
  'Honduras':                             'Honduras',
  'India':                                'India',
  'Uganda':                               'Uganda',
  'Mexico':                               'Mexico',
  'Guatemala':                            'Guatemala',
  'Peru':                                 'Peru',
  'Nicaragua':                            'Nicaragua',
  "Côte d'Ivoire":                        'CotedIvoire',
  'Costa Rica':                           'CostaRica',
  'Kenya':                                'Kenya',
  'United Republic of Tanzania':          'Tanzania',
  'Papua New Guinea':                     'PNG',
  "Lao People's Democratic Republic":     'Laos',
  'Cameroon':                             'Cameroon',
  'El Salvador':                          'ElSalvador',
  // ── Processing / re-export hubs ─────────────────────────────────────────
  'Germany':                                              'Germany',
  'United States of America':                             'USA',
  'Italy':                                                'Italy',
  'Belgium':                                              'Belgium',
  'Belgium-Luxembourg':                                   'Belgium',
  'France':                                               'France',
  'Netherlands (Kingdom of the)':                         'Netherlands',
  'Netherlands':                                          'Netherlands',
  'Switzerland':                                          'Switzerland',
  'United Kingdom of Great Britain and Northern Ireland': 'UK',
  'Sweden':                                               'Sweden',
  'Japan':                                                'Japan',
  'Canada':                                               'Canada',
  'Finland':                                              'Finland',
  'Australia':                                            'Australia',
};

// CSV partner name → canonical key (normalization only — no whitelist).
// Only entries where the canonical differs from the raw CSV name are needed.
// All partners not listed here pass through with their raw CSV name as the key.
const PARTNER_NORMALIZE = {
  // ── Long / ambiguous official names ─────────────────────────────────────
  'United States of America':                             'USA',
  'United Kingdom of Great Britain and Northern Ireland': 'UK',
  'Netherlands (Kingdom of the)':                         'Netherlands',
  'Russian Federation':                                   'Russia',
  'Korea, Republic of':                                   'SouthKorea',
  'Republic of Korea':                                    'SouthKorea',
  'Democratic People\'s Republic of Korea':               'NorthKorea',
  'Iran (Islamic Republic of)':                           'Iran',
  'Syrian Arab Republic':                                 'Syria',
  'Venezuela (Bolivarian Republic of)':                   'Venezuela',
  'Bolivia (Plurinational State of)':                     'Bolivia',
  'United Republic of Tanzania':                          'Tanzania',
  'Lao People\'s Democratic Republic':                    'Laos',
  'Democratic Republic of the Congo':                     'DRCongo',
  'Republic of Moldova':                                  'Moldova',
  'United Arab Emirates':                                 'UAE',
  'Micronesia (Federated States of)':                     'Micronesia',
  'Saint Vincent and the Grenadines':                     'SaintVincent',
  'Trinidad and Tobago':                                  'TrinidadTobago',
  'Bosnia and Herzegovina':                               'Bosnia',
  // ── Special characters / diacritics ─────────────────────────────────────
  "Côte d'Ivoire":                                        'CotedIvoire',
  "Cote d'Ivoire":                                        'CotedIvoire',
  'Türkiye':                                              'Turkey',
  // ── Multi-word names already camelCased in the codebase ─────────────────
  'Costa Rica':                                           'CostaRica',
  'Papua New Guinea':                                     'PNG',
  'El Salvador':                                          'ElSalvador',
  // ── China sub-regions ────────────────────────────────────────────────────
  'China, mainland':                                      'China',
  'China, Hong Kong SAR':                                 'HongKong',
  'China, Taiwan Province of':                            'Taiwan',
  'China, Macao SAR':                                     'Macao',
  // ── Historical / merged names ────────────────────────────────────────────
  'Belgium-Luxembourg':                                   'Belgium',
  'Czech Republic':                                       'Czechia',
  'Ethiopia PDR':                                         'Ethiopia',
  'Viet Nam':                                             'Vietnam',
  'USSR':                                                 'Russia',
};

// CSV partner names that count as "high-income processing hubs"
const HUB_CSV = new Set([
  'Germany', 'United States of America', 'Italy',
  'Belgium', 'Belgium-Luxembourg',
  'Japan', 'Canada', 'France', 'Sweden', 'Finland', 'Australia',
  'Netherlands (Kingdom of the)', 'Netherlands',
  'United Kingdom of Great Britain and Northern Ireland',
  'Switzerland',
]);

// ── RAW DATA LOADER ─────────────────────────────────────────────────────────
// Returns: rawData[reporterCSV][partnerCSV][year] = value
// elemCode: '5910' for quantity (tonnes), '5922' for value (1000 USD)
// Both item codes 656 (green) and 657 (processed) are summed.
function loadRaw(csvPath, elemCode) {
  const text  = fs.readFileSync(csvPath, 'utf8');
  const lines = text.split('\n');
  const hdr   = parseCSVLine(lines[0]);

  const yearCol = {};
  YEARS.forEach(y => {
    const idx = hdr.indexOf('Y' + y);
    if (idx !== -1) yearCol[y] = idx;
  });

  const raw = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const f = parseCSVLine(line);
    if (f.length < 6) continue;

    const reporter = f[0];
    const partner  = f[1];
    const item     = f[2];
    const elem     = f[3];

    if (elem !== elemCode) continue;
    if (item !== '656' && item !== '657') continue;

    if (!raw[reporter]) raw[reporter] = {};
    if (!raw[reporter][partner]) raw[reporter][partner] = {};

    YEARS.forEach(y => {
      const col = yearCol[y];
      if (col === undefined || col >= f.length) return;
      const v = parseFloat(f[col]);
      if (!isNaN(v) && v > 0) {
        raw[reporter][partner][y] = (raw[reporter][partner][y] || 0) + v;
      }
    });
  }

  return raw;
}

// Like loadRaw but keeps item codes 656/657 separate.
// Returns: { '656': data, '657': data } where each data has the same structure as loadRaw.
function loadRawSplit(csvPath, elemCode) {
  const text  = fs.readFileSync(csvPath, 'utf8');
  const lines = text.split('\n');
  const hdr   = parseCSVLine(lines[0]);

  const yearCol = {};
  YEARS.forEach(y => {
    const idx = hdr.indexOf('Y' + y);
    if (idx !== -1) yearCol[y] = idx;
  });

  const split = { '656': {}, '657': {} };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const f = parseCSVLine(line);
    if (f.length < 6) continue;

    const reporter = f[0];
    const partner  = f[1];
    const item     = f[2];
    const elem     = f[3];

    if (elem !== elemCode) continue;
    if (item !== '656' && item !== '657') continue;

    const target = split[item];
    if (!target[reporter]) target[reporter] = {};
    if (!target[reporter][partner]) target[reporter][partner] = {};

    YEARS.forEach(y => {
      const col = yearCol[y];
      if (col === undefined || col >= f.length) return;
      const v = parseFloat(f[col]);
      if (!isNaN(v) && v > 0) {
        target[reporter][partner][y] = (target[reporter][partner][y] || 0) + v;
      }
    });
  }

  return split;
}

// ── CANONICALIZE ────────────────────────────────────────────────────────────
// Normalizes reporter and partner names; keeps all partners (no whitelist).
function canonicalize(rawData) {
  const canon = {};
  for (const [rep, partnerData] of Object.entries(rawData)) {
    const cr = REPORTER_CANONICAL[rep];
    if (!cr) continue;
    if (!canon[cr]) canon[cr] = {};

    for (const [par, yearVals] of Object.entries(partnerData)) {
      const cp = PARTNER_NORMALIZE[par] || par;
      if (!canon[cr][cp]) canon[cr][cp] = {};

      for (const [yr, v] of Object.entries(yearVals)) {
        canon[cr][cp][yr] = (canon[cr][cp][yr] || 0) + v;
      }
    }
  }
  return canon;
}

// ── HELPERS ─────────────────────────────────────────────────────────────────
// Most recent year (≤2023) with any export data for a reporter's partner map.
function mostRecentYear(partnerMap) {
  const totals = {};
  for (const yearVals of Object.values(partnerMap)) {
    for (const [yr, v] of Object.entries(yearVals)) {
      totals[yr] = (totals[yr] || 0) + v;
    }
  }
  for (let y = 2023; y >= 1986; y--) {
    if (totals[y] > 0) return y;
  }
  return null;
}

// ── 1. TRANSFORMATION INDEX ─────────────────────────────────────────────────
function buildTI(rawVal) {
  const result = {};

  // We need hub CSV names, so work on raw data before canonicalizing partners.
  for (const [rep, partnerData] of Object.entries(rawVal)) {
    const cr = REPORTER_CANONICAL[rep];
    if (!cr) continue;

    // Find most-recent year using all partner data
    const allPartnerYears = {};
    for (const [par, yearVals] of Object.entries(partnerData)) {
      for (const [yr, v] of Object.entries(yearVals)) {
        allPartnerYears[yr] = (allPartnerYears[yr] || 0) + v;
      }
    }
    let bestYear = null;
    for (let y = 2023; y >= 1986; y--) {
      if ((allPartnerYears[y] || 0) > 0) { bestYear = y; break; }
    }
    if (!bestYear) continue;

    let hubVal   = 0;
    let totalVal = 0;
    for (const [par, yearVals] of Object.entries(partnerData)) {
      const v = yearVals[bestYear] || 0;
      if (v <= 0) continue;
      totalVal += v;
      if (HUB_CSV.has(par)) hubVal += v;
    }
    if (totalVal <= 0) continue;
    const ti = Math.round((hubVal / totalVal) * 100);

    // Merge if same canonical name (e.g. Ethiopia PDR → Ethiopia)
    if (result[cr] !== undefined) {
      result[cr] = Math.round((result[cr] + ti) / 2);
    } else {
      result[cr] = ti;
    }
  }

  return result;
}

// ── 1b. TRANSFORMATION INDEX BY YEAR ───────────────────────────────────────
// For each year, compute TI for each reporter using only that year's data.
// Countries with no data in a given year are omitted (sparse is fine).
function buildTIByYear(rawVal) {
  const result = {};

  for (const yr of YEARS) {
    const tiYr = {};

    for (const [rep, partnerData] of Object.entries(rawVal)) {
      const cr = REPORTER_CANONICAL[rep];
      if (!cr) continue;

      let hubVal = 0, totalVal = 0;
      for (const [par, yearVals] of Object.entries(partnerData)) {
        const v = yearVals[yr] || 0;
        if (v <= 0) continue;
        totalVal += v;
        if (HUB_CSV.has(par)) hubVal += v;
      }
      if (totalVal <= 0) continue;
      const ti = Math.round((hubVal / totalVal) * 100);

      // Merge Ethiopia PDR → Ethiopia
      if (tiYr[cr] !== undefined) {
        tiYr[cr] = Math.round((tiYr[cr] + ti) / 2);
      } else {
        tiYr[cr] = ti;
      }
    }

    if (Object.keys(tiYr).length > 0) result[yr] = tiYr;
  }

  return result;
}

// ── 2 & 3. TRADE QUANTITY / TRADE VALUE ────────────────────────────────────
// For each reporter in TI: all canonical partners, most-recent-year snapshot.
function buildTrade(canonQty, canonVal, tiKeys) {
  const tq = {}, tv = {};

  for (const [cr, qtyMap] of Object.entries(canonQty)) {
    if (!tiKeys.has(cr)) continue;
    const valMap = canonVal[cr] || {};

    const yr = mostRecentYear(qtyMap);
    if (!yr) continue;

    const qRow = {}, vRow = {};
    for (const cp of Object.keys(qtyMap)) {
      const q = (qtyMap[cp] && qtyMap[cp][yr]) || 0;
      const v = (valMap[cp] && valMap[cp][yr]) || 0;
      if (q > 0) qRow[cp] = Math.round(q);
      if (v > 0) vRow[cp] = Math.round(v);
    }
    if (Object.keys(qRow).length) tq[cr] = qRow;
    if (Object.keys(vRow).length) tv[cr] = vRow;
  }

  return { tq, tv };
}

// ── 2b & 3b. TRADE QUANTITY / VALUE BY YEAR ────────────────────────────────
// All canonical partners per reporter, one entry per year with data.
function buildTradeByYear(canonQty, canonVal, tiKeys) {
  const tqByYear = {}, tvByYear = {};

  for (const yr of YEARS) {
    const tqYr = {}, tvYr = {};

    for (const [cr, qtyMap] of Object.entries(canonQty)) {
      if (!tiKeys.has(cr)) continue;
      const valMap = (canonVal[cr]) || {};

      const qRow = {}, vRow = {};
      for (const cp of Object.keys(qtyMap)) {
        const q = (qtyMap[cp] && qtyMap[cp][yr]) || 0;
        const v = (valMap[cp] && valMap[cp][yr]) || 0;
        if (q > 0) qRow[cp] = Math.round(q);
        if (v > 0) vRow[cp] = Math.round(v);
      }
      if (Object.keys(qRow).length) tqYr[cr] = qRow;
      if (Object.keys(vRow).length) tvYr[cr] = vRow;
    }

    if (Object.keys(tqYr).length) tqByYear[yr] = tqYr;
    if (Object.keys(tvYr).length) tvByYear[yr] = tvYr;
  }

  return { tqByYear, tvByYear };
}

// ── 2c & 3c. TRADE QTY RAW / PROC BY YEAR (item-code-accurate) ─────────────
// All canonical partners; splits green (656) vs roasted/processed (657).
function buildTradeByYearSplit(canonQtySplit, tiKeys) {
  const tqRawByYear = {}, tqProcByYear = {};

  // Union of all partners seen across both item codes, per reporter
  const allPartners = {};
  for (const item of ['656', '657']) {
    for (const [cr, partnerMap] of Object.entries(canonQtySplit[item] || {})) {
      if (!tiKeys.has(cr)) continue;
      if (!allPartners[cr]) allPartners[cr] = new Set();
      Object.keys(partnerMap).forEach(cp => allPartners[cr].add(cp));
    }
  }

  for (const yr of YEARS) {
    const rawYr = {}, procYr = {};

    for (const [cr, partners] of Object.entries(allPartners)) {
      const rawMap  = (canonQtySplit['656'] || {})[cr] || {};
      const procMap = (canonQtySplit['657'] || {})[cr] || {};

      const rawRow = {}, procRow = {};
      for (const cp of partners) {
        const r = (rawMap[cp] && rawMap[cp][yr]) || 0;
        const p = (procMap[cp] && procMap[cp][yr]) || 0;
        if (r > 0) rawRow[cp]  = Math.round(r);
        if (p > 0) procRow[cp] = Math.round(p);
      }
      if (Object.keys(rawRow).length)  rawYr[cr]  = rawRow;
      if (Object.keys(procRow).length) procYr[cr] = procRow;
    }

    if (Object.keys(rawYr).length)  tqRawByYear[yr]  = rawYr;
    if (Object.keys(procYr).length) tqProcByYear[yr] = procYr;
  }

  return { tqRawByYear, tqProcByYear };
}

// ── 5. PROCESSED SHARE BY YEAR ──────────────────────────────────────────────
// Per reporter per year: share (0-100) of total export quantity that is processed (item 657).
function buildProcessedShareByYear(canonQtySplit) {
  const result = {};

  const allReporters = new Set([
    ...Object.keys(canonQtySplit['656'] || {}),
    ...Object.keys(canonQtySplit['657'] || {}),
  ]);

  for (const yr of YEARS) {
    const shareYr = {};

    for (const cr of allReporters) {
      const rawMap  = (canonQtySplit['656'] || {})[cr] || {};
      const procMap = (canonQtySplit['657'] || {})[cr] || {};

      let totalRaw = 0, totalProc = 0;
      for (const yearVals of Object.values(rawMap))  totalRaw  += yearVals[yr] || 0;
      for (const yearVals of Object.values(procMap)) totalProc += yearVals[yr] || 0;

      const total = totalRaw + totalProc;
      if (total > 0) shareYr[cr] = Math.round((totalProc / total) * 100);
    }

    if (Object.keys(shareYr).length) result[yr] = shareYr;
  }

  return result;
}

// ── 4. PRICE TIMELINE ───────────────────────────────────────────────────────
// Uses RAW (non-canonicalized) data for true global totals.
function buildPriceTimeline(rawQty, rawVal) {
  const result = {};

  for (const yr of YEARS) {
    let totalQty = 0, totalVal = 0;

    for (const partnerData of Object.values(rawQty)) {
      for (const yearVals of Object.values(partnerData)) {
        totalQty += yearVals[yr] || 0;
      }
    }
    for (const partnerData of Object.values(rawVal)) {
      for (const yearVals of Object.values(partnerData)) {
        totalVal += yearVals[yr] || 0;
      }
    }

    if (totalQty <= 0) continue;
    // val in 1000 USD, qty in tonnes → USD/tonne = (val*1000)/qty
    const raw       = Math.round((totalVal * 1000) / totalQty);
    const processed = Math.round(raw * 1.35);
    result[yr] = { raw, processed };
  }

  return result;
}

// ── MAIN ────────────────────────────────────────────────────────────────────
console.log('Loading CSVs…');
const rawQty = loadRaw(QTY_CSV, '5910');
const rawVal = loadRaw(VAL_CSV, '5922');

console.log('Loading split CSVs (raw vs processed)…');
const rawQtySplit = loadRawSplit(QTY_CSV, '5910');

console.log('Canonicalizing…');
const canonQty = canonicalize(rawQty);
const canonVal = canonicalize(rawVal);
const canonQtySplit = {
  '656': canonicalize(rawQtySplit['656']),
  '657': canonicalize(rawQtySplit['657']),
};

console.log('Computing TRANSFORMATION_INDEX…');
const TI = buildTI(rawVal);
const tiKeys = new Set(Object.keys(TI));

console.log('Computing TRANSFORMATION_INDEX_BY_YEAR…');
const TI_BY_YEAR = buildTIByYear(rawVal);

console.log('Computing TRADE_QUANTITY / TRADE_VALUE…');
const { tq: TQ, tv: TV } = buildTrade(canonQty, canonVal, tiKeys);

console.log('Computing TRADE_QUANTITY_BY_YEAR / TRADE_VALUE_BY_YEAR…');
const { tqByYear: TQ_BY_YEAR, tvByYear: TV_BY_YEAR } = buildTradeByYear(canonQty, canonVal, tiKeys);

console.log('Computing TRADE_QTY_RAW_BY_YEAR / TRADE_QTY_PROC_BY_YEAR…');
const { tqRawByYear: TQ_RAW_BY_YEAR, tqProcByYear: TQ_PROC_BY_YEAR } =
  buildTradeByYearSplit(canonQtySplit, tiKeys);

console.log('Computing PROCESSED_SHARE_BY_YEAR…');
const PS_BY_YEAR = buildProcessedShareByYear(canonQtySplit);

console.log('Computing PRICE_TIMELINE…');
const PT = buildPriceTimeline(rawQty, rawVal);

// ── WRITE OUTPUT ────────────────────────────────────────────────────────────
const js = `// AUTO-GENERATED by build_data.js — do not edit manually.
// Source: data/UNComtrade/Trade_Matrix_Quantity.csv + Trade_Matrix_Value.csv

const TRANSFORMATION_INDEX_BY_YEAR = ${JSON.stringify(TI_BY_YEAR, null, 2)};

const TRADE_QUANTITY_BY_YEAR = ${JSON.stringify(TQ_BY_YEAR, null, 2)};

const TRADE_VALUE_BY_YEAR = ${JSON.stringify(TV_BY_YEAR, null, 2)};

// Item-code-accurate raw (656=green) vs processed (657=roasted) split
const TRADE_QTY_RAW_BY_YEAR  = ${JSON.stringify(TQ_RAW_BY_YEAR, null, 2)};
const TRADE_QTY_PROC_BY_YEAR = ${JSON.stringify(TQ_PROC_BY_YEAR, null, 2)};

// Per-reporter share (0–100) of total export qty that is processed (item 657)
const PROCESSED_SHARE_BY_YEAR = ${JSON.stringify(PS_BY_YEAR, null, 2)};

const PRICE_TIMELINE = ${JSON.stringify(PT, null, 2)};

// Flat aliases — backward-compatible snapshot of the 2023 slice
const TRADE_QUANTITY       = TRADE_QUANTITY_BY_YEAR[2023]       || {};
const TRADE_VALUE          = TRADE_VALUE_BY_YEAR[2023]          || {};
const TRANSFORMATION_INDEX = TRANSFORMATION_INDEX_BY_YEAR[2023] || {};
`;

fs.writeFileSync(OUT_FILE, js, 'utf8');
console.log(`\nWritten → ${OUT_FILE}`);

// ── SUMMARY ─────────────────────────────────────────────────────────────────
const tiVals  = Object.values(TI);
const ptYears = Object.keys(PT).map(Number).sort((a, b) => a - b);
const tqYears = Object.keys(TQ_BY_YEAR).map(Number).sort((a, b) => a - b);
console.log('\n=== SUMMARY ===');
console.log(`TRANSFORMATION_INDEX      : ${tiVals.length} countries  min=${Math.min(...tiVals)}  max=${Math.max(...tiVals)}`);
console.log(`TRANSFORMATION_INDEX_BY_YEAR: ${Object.keys(TI_BY_YEAR).length} years  (${tqYears[0]}–${tqYears[tqYears.length-1]})`);
console.log(`TRADE_QUANTITY            : ${Object.keys(TQ).length} exporters (2023 snapshot)`);
console.log(`TRADE_QUANTITY_BY_YEAR    : ${tqYears.length} years with data`);
console.log(`PRICE_TIMELINE            : ${ptYears[0]}–${ptYears[ptYears.length - 1]}  (${ptYears.length} years)`);
const sample = [1986,1990,1995,2000,2005,2010,2015,2020,2023];
console.log('  Year    Raw(USD/t)  Proc(USD/t)  TQ reporters  TI countries');
sample.forEach(y => {
  const p   = PT[y];
  const tqN = TQ_BY_YEAR[y] ? Object.keys(TQ_BY_YEAR[y]).length : 0;
  const tiN = TI_BY_YEAR[y] ? Object.keys(TI_BY_YEAR[y]).length : 0;
  if (p) console.log(`  ${y}  ${String(p.raw).padStart(9)}  ${String(p.processed).padStart(10)}  ${String(tqN).padStart(12)}  ${String(tiN).padStart(12)}`);
  else   console.log(`  ${y}  (no price data)`);
});
