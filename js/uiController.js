import { FLOW_COLORS, GEO_NAME_MAP } from './config.js';
import { state } from './dataService.js';
import { fmtQty, fmtVal } from './utils.js';
import { updateVisualizationsOnYearChange } from './visualizations.js';

let playing = false;
let playInterval = null;

export function setupUI(onYearChange, onFlowModeChange) {
  const slider = document.getElementById('year-slider');
  const display = document.getElementById('year-display');
  const yearBadge = document.getElementById('topbar-year');

  let playInterval = null;
  let currentSpeed = 900;

  const playBtn = document.getElementById('slider-play');
  const fastPlayBtn = document.getElementById('slider-fast-play');
  const yearSlider = document.getElementById('year-slider'); // Ensure this matches your slider's ID

  // Unified playback function
  // Define our clean SVG icons
  const ICON_PLAY = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="margin-left: 2px;"><path d="M8 5v14l11-7z"/></svg>`;
  const ICON_FAST = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`;
  const ICON_PAUSE = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

  // Unified playback function
  function togglePlayback(speed) {
    if (playInterval && currentSpeed === speed) {
      clearInterval(playInterval);
      playInterval = null;
      playBtn.innerHTML = ICON_PLAY;
      fastPlayBtn.innerHTML = ICON_FAST;
      return;
    }

    if (playInterval) {
      clearInterval(playInterval);
    }

    currentSpeed = speed;

    if (speed === 250) {
      fastPlayBtn.innerHTML = ICON_PAUSE;
      playBtn.innerHTML = ICON_PLAY;
    } else {
      playBtn.innerHTML = ICON_PAUSE;
      fastPlayBtn.innerHTML = ICON_FAST;
    }

    playInterval = setInterval(() => {
      let currentYear = parseInt(yearSlider.value);
      let maxYear = parseInt(yearSlider.max);

      if (currentYear >= maxYear) {
        clearInterval(playInterval);
        playInterval = null;
        playBtn.innerHTML = ICON_PLAY;
        fastPlayBtn.innerHTML = ICON_FAST;
      } else {
        currentYear++;
        yearSlider.value = currentYear;
        state.currentYear = currentYear;
        updateVisualizationsOnYearChange(currentYear);
      }
    }, speed);
  }
}

export function updateSidePanel(name, year) {
  const key = GEO_NAME_MAP[name] || name;
  const qtySnap = state.data.TRADE_QUANTITY_BY_YEAR[year] || state.data.TRADE_QUANTITY_BY_YEAR[2023] || state.data.TRADE_QUANTITY;
  const valSnap = state.data.TRADE_VALUE_BY_YEAR[year] || state.data.TRADE_VALUE_BY_YEAR[2023] || state.data.TRADE_VALUE;
  const tiSnap = state.data.TRANSFORMATION_INDEX_BY_YEAR[year] || state.data.TRANSFORMATION_INDEX_BY_YEAR[2023] || {};

  const ti = tiSnap[key] ?? null;
  const rank = state.TI_RANKS[key];

  document.getElementById('sp-country-name').textContent = name;

  const rankEl = document.getElementById('sp-rank');
  rankEl.textContent = rank ? `#${rank} by TI` : 'No TI data';
  rankEl.style.background = rank ? 'var(--tan)' : 'var(--sand)';

  document.getElementById('sp-ti').textContent = ti !== null ? 'TI: ' + (ti < 0 ? '-' : '+') + fmtQty(Math.abs(ti)) + 't net' : 'TI: n/a';

  const valRow = valSnap[key];
  const qtyRow = qtySnap[key];

  // Top partner pill
  if (valRow) {
    const top = Object.entries(valRow).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('sp-top-export').textContent = top ? top[0] : '—';
    const sl = document.getElementById('sp-top-export').closest('.stat-pill').querySelector('.sl');
    if (sl) sl.innerHTML = 'Top export<br>partner';
  } else {
    let best = null, bestVal = 0;
    Object.entries(valSnap).forEach(([rep, row]) => {
      const v = row[key] || 0;
      if (v > bestVal) { bestVal = v; best = rep; }
    });
    document.getElementById('sp-top-export').textContent = best || '—';
    const sl = document.getElementById('sp-top-export').closest('.stat-pill').querySelector('.sl');
    if (sl) sl.innerHTML = 'Top import<br>source';
  }

  // Pill 3: Export total
  const expQtyTot = qtyRow ? Object.values(qtyRow).reduce((s, v) => s + v, 0) : 0;
  const expValTot = valRow ? Object.values(valRow).reduce((s, v) => s + v, 0) : 0;
  const volEl = document.getElementById('sp-vol');
  const volSlEl = document.getElementById('sp-vol-lbl');

  if (volEl) {
    if (expQtyTot === 0 && expValTot === 0) {
      volEl.textContent = '—';
      if (volSlEl) volSlEl.innerHTML = 'No export<br>data';
    } else if (state.flowMode === 'val') {
      volEl.textContent = fmtVal(expValTot);
      if (volSlEl) volSlEl.innerHTML = 'Total export<br>value';
    } else {
      volEl.textContent = fmtQty(expQtyTot) + 't total';
      if (volSlEl) volSlEl.innerHTML = 'Total export<br>volume';
    }
  }

  // Pill 4: Import total
  let totalImpQty = 0, totalImpVal = 0;
  Object.values(qtySnap).forEach(row => { totalImpQty += (row[key] || 0); });
  Object.values(valSnap).forEach(row => { totalImpVal += (row[key] || 0); });
  const impVolEl = document.getElementById('sp-imp-vol');
  const impVolLbl = document.getElementById('sp-imp-vol-lbl');

  if (impVolEl) {
    if (totalImpQty === 0 && totalImpVal === 0) {
      impVolEl.textContent = '—';
      if (impVolLbl) impVolLbl.innerHTML = 'No import<br>data';
    } else if (state.flowMode === 'val') {
      impVolEl.textContent = fmtVal(totalImpVal);
      if (impVolLbl) impVolLbl.innerHTML = 'Total import<br>value';
    } else {
      impVolEl.textContent = fmtQty(totalImpQty) + 't total';
      if (impVolLbl) impVolLbl.innerHTML = 'Total import<br>volume';
    }
  }

  updateBarChart(key, year);
  populateTradeFlows(key, year);
  updateConcentrationBars(key, year);
}

function updateBarChart(key, year) {
  const barContainer = document.getElementById('sp-bar-chart-rows');
  if (!barContainer) return;

  barContainer.innerHTML = '';
  const pt = state.data.PRICE_TIMELINE[year] || state.data.PRICE_TIMELINE[2023];
  const pRaw = pt.raw;
  const pProc = pt.processed;

  const rawQtySnap = state.data.TRADE_QTY_RAW_BY_YEAR[year] || state.data.TRADE_QTY_RAW_BY_YEAR[2023] || {};
  const procQtySnap = state.data.TRADE_QTY_PROC_BY_YEAR[year] || state.data.TRADE_QTY_PROC_BY_YEAR[2023] || {};

  let expRawQty = 0, expProcQty = 0;
  Object.values(rawQtySnap[key] || {}).forEach(v => expRawQty += v);
  Object.values(procQtySnap[key] || {}).forEach(v => expProcQty += v);

  let impRawQty = 0, impProcQty = 0;
  Object.entries(rawQtySnap).forEach(([rep, row]) => { if (rep !== key) impRawQty += (row[key] || 0); });
  Object.entries(procQtySnap).forEach(([rep, row]) => { if (rep !== key) impProcQty += (row[key] || 0); });

  const expTotalQty = expRawQty + expProcQty;
  const impTotalQty = impRawQty + impProcQty;

  const expUV = expTotalQty > 0 ? Math.round((expRawQty * pRaw + expProcQty * pProc) / expTotalQty) : null;
  const impUV = impTotalQty > 0 ? Math.round((impRawQty * pRaw + impProcQty * pProc) / impTotalQty) : null;
  const margin = (expUV !== null && impUV !== null) ? expUV - impUV : null;
  const maxUV = Math.max(expUV || 0, impUV || 0, 1);

  function makeSplitBar(lbl, totalQty, rawQty, procQty, uv, rawColor, procColor) {
    if (uv === null) return null;
    const totalW = Math.round((uv / maxUV) * 100);
    const rawFrac = totalQty > 0 ? rawQty / totalQty : 1;
    const el = document.createElement('div');
    el.className = 'bar-row';
    el.style.marginBottom = '5px';
    const rawPct = Math.round(rawFrac * 100);
    const gradient = `linear-gradient(to right, ${rawColor} ${rawPct}%, ${procColor} ${rawPct}%)`;
    el.innerHTML =
      `<span class="bar-year" style="width:38px;">${lbl}</span>` +
      `<div class="bar-track" style="flex:1;">` +
      `<div class="bar-fill" style="width:${totalW}%;background:${gradient}"></div>` +
      `</div>` +
      `<span class="bar-val">${uv.toLocaleString()}</span>`;
    return el;
  }

  const expBar = makeSplitBar('Export', expTotalQty, expRawQty, expProcQty, expUV, FLOW_COLORS.exportRaw, FLOW_COLORS.exportProcessed);
  const impBar = makeSplitBar('Import', impTotalQty, impRawQty, impProcQty, impUV, FLOW_COLORS.importRaw, FLOW_COLORS.importProcessed);

  if (expBar) barContainer.appendChild(expBar);
  if (impBar) barContainer.appendChild(impBar);

  if (!expBar && !impBar) {
    const na = document.createElement('div');
    na.style.cssText = 'font-size:9px;color:rgba(74,44,23,0.4);text-align:center;padding:6px 0;';
    na.textContent = 'No trade data for this year';
    barContainer.appendChild(na);
  }

  if (margin !== null) {
    const sign = margin >= 0 ? '+' : '';
    const mColor = margin > 800 ? '#B89028' : margin > 200 ? '#9A7A20' : margin > 0 ? '#7A6040' : '#8B4030';
    const sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid rgba(74,44,23,0.12);margin:3px 0 5px;';
    barContainer.appendChild(sep);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    row.innerHTML =
      `<span style="font-size:8px;color:var(--coffee);letter-spacing:.06em;text-transform:uppercase;">Margin</span>` +
      `<span style="font-size:13px;font-weight:700;color:${mColor};">${sign}${margin.toLocaleString()} USD/t</span>`;
    barContainer.appendChild(row);
  }
}

function populateTradeFlows(key, year) {
  const exportContainer = document.getElementById('sp-flows-export');
  const importContainer = document.getElementById('sp-flows-import');
  if (!exportContainer || !importContainer) return;

  exportContainer.innerHTML = '';
  importContainer.innerHTML = '';

  const qtySnap = state.data.TRADE_QUANTITY_BY_YEAR[year] || state.data.TRADE_QUANTITY_BY_YEAR[2023] || state.data.TRADE_QUANTITY;
  const valSnap = state.data.TRADE_VALUE_BY_YEAR[year] || state.data.TRADE_VALUE_BY_YEAR[2023] || state.data.TRADE_VALUE;
  const rawFlowSnap = state.data.TRADE_QTY_RAW_BY_YEAR[year] || state.data.TRADE_QTY_RAW_BY_YEAR[2023] || {};
  const procFlowSnap = state.data.TRADE_QTY_PROC_BY_YEAR[year] || state.data.TRADE_QTY_PROC_BY_YEAR[2023] || {};

  function makeRow(arrow, country, rawQ, procQ, val, maxQtyRef, isExport) {
    const rawColor = isExport ? FLOW_COLORS.exportRaw : FLOW_COLORS.importRaw;
    const procColor = isExport ? FLOW_COLORS.exportProcessed : FLOW_COLORS.importProcessed;
    const arrowColor = procQ > rawQ ? procColor : rawColor;
    const total = rawQ + procQ;
    const rawW = maxQtyRef > 0 ? Math.round(rawQ / maxQtyRef * 100) : 0;
    const procW = maxQtyRef > 0 ? Math.round(procQ / maxQtyRef * 100) : 0;

    let topLabel, botLabel;
    if (state.flowMode === 'val') {
      const rawVal = total > 0 ? Math.round(val * rawQ / total) : 0;
      const procVal = total > 0 ? Math.round(val * procQ / total) : 0;
      topLabel = fmtVal(rawVal);
      botLabel = fmtVal(procVal);
    } else {
      topLabel = rawQ > 0 ? `${fmtQty(rawQ)}t` : '—';
      botLabel = procQ > 0 ? `${fmtQty(procQ)}t` : '—';
    }

    const row = document.createElement('div');
    row.className = 'flow-row';
    row.innerHTML =
      `<span class="flow-arrow" style="color:${arrowColor}">${arrow}</span>` +
      `<span class="flow-country">${country}</span>` +
      `<div class="flow-bars">` +
      `<div class="flow-bar-wrap"><div class="flow-bar-fill" style="width:${rawW}%;background:${rawColor}"></div></div>` +
      `<div class="flow-bar-wrap"><div class="flow-bar-fill" style="width:${procW}%;background:${procColor}"></div></div>` +
      `</div>` +
      `<div style="text-align:right;flex-shrink:0;width:36px;">` +
      `<div style="font-size:8px;font-weight:600;color:${rawColor};line-height:1.3;">${topLabel}</div>` +
      `<div style="font-size:8px;font-weight:600;color:${procColor};line-height:1.3;">${botLabel}</div>` +
      `</div>`;
    return row;
  }

  // Exports
  const qtyRow = qtySnap[key];
  if (qtyRow) {
    const rows = Object.keys(qtyRow).map(partner => ({
      partner,
      rawQ: (rawFlowSnap[key] || {})[partner] || 0,
      procQ: (procFlowSnap[key] || {})[partner] || 0,
      qty: qtyRow[partner] || 0,
      val: (valSnap[key] || {})[partner] || 0,
    }));
    rows.sort((a, b) => state.flowMode === 'val' ? b.val - a.val : b.qty - a.qty);
    const top5ex = rows.slice(0, 5);

    if (top5ex.length === 0) {
      exportContainer.innerHTML = '<div style="font-size:9px;color:var(--coffee);font-style:italic;padding:4px 0;">No export data</div>';
    } else {
      const maxExQty = Math.max(...top5ex.map(r => r.qty), 1);
      top5ex.forEach(({ partner, rawQ, procQ, qty, val }) => {
        exportContainer.appendChild(makeRow('→', partner, rawQ, procQ, val, maxExQty, true));
      });
    }
  } else {
    exportContainer.innerHTML = '<div style="font-size:9px;color:var(--coffee);font-style:italic;padding:4px 0;">No export data for this country</div>';
  }

  // Imports
  const importRows = Object.keys(qtySnap)
    .filter(reporter => reporter !== key && (qtySnap[reporter][key] || 0) > 0)
    .map(reporter => ({
      reporter,
      rawQ: (rawFlowSnap[reporter] || {})[key] || 0,
      procQ: (procFlowSnap[reporter] || {})[key] || 0,
      qty: (qtySnap[reporter][key] || 0),
      val: (valSnap[reporter] || {})[key] || 0,
    }));

  importRows.sort((a, b) => state.flowMode === 'val' ? b.val - a.val : b.qty - a.qty);
  const top5imp = importRows.slice(0, 5);

  const impSummaryEl = document.getElementById('sp-import-summary');
  if (impSummaryEl) {
    const totalImpQty = importRows.reduce((s, r) => s + r.qty, 0);
    const totalImpVal = importRows.reduce((s, r) => s + r.val, 0);
    const summaryText = state.flowMode === 'val' ? fmtVal(totalImpVal) : `${fmtQty(totalImpQty)}t total`;
    impSummaryEl.textContent = summaryText;
    impSummaryEl.style.display = summaryText ? 'block' : 'none';
  }

  if (top5imp.length === 0) {
    importContainer.innerHTML = '<div style="font-size:9px;color:var(--coffee);font-style:italic;padding:4px 0;">No import data</div>';
  } else {
    const maxImpQty = Math.max(...top5imp.map(r => r.qty), 1);
    top5imp.forEach(({ reporter, rawQ, procQ, qty, val }) => {
      importContainer.appendChild(makeRow('←', reporter, rawQ, procQ, val, maxImpQty, false));
    });
  }
}

function updateConcentrationBars(key, year) {
  const concDiv = document.getElementById('sp-concentration');
  if (!concDiv) return;
  concDiv.innerHTML = '';

  const qtySnapC = state.data.TRADE_QUANTITY_BY_YEAR[year] || state.data.TRADE_QUANTITY_BY_YEAR[2023] || state.data.TRADE_QUANTITY;
  const rawSnapC = state.data.TRADE_QTY_RAW_BY_YEAR[year] || state.data.TRADE_QTY_RAW_BY_YEAR[2023] || {};
  const procSnapC = state.data.TRADE_QTY_PROC_BY_YEAR[year] || state.data.TRADE_QTY_PROC_BY_YEAR[2023] || {};

  // Export concentration
  let expSegments = [], expTopName = '—', expTopShare = 0, expHHI = 0, expTotal = 0;
  const qtyRowC = qtySnapC[key];
  if (qtyRowC) {
    const sorted = Object.entries(qtyRowC).sort((a, b) => b[1] - a[1]);
    expTotal = sorted.reduce((s, [, v]) => s + v, 0);
    if (expTotal > 0) {
      let rawSum = 0, procSum = 0;
      sorted.forEach(([partner]) => {
        rawSum += (rawSnapC[key] || {})[partner] || 0;
        procSum += (procSnapC[key] || {})[partner] || 0;
      });
      if (rawSum > 0) expSegments.push({ share: rawSum / expTotal, color: FLOW_COLORS.exportRaw });
      if (procSum > 0) expSegments.push({ share: procSum / expTotal, color: FLOW_COLORS.exportProcessed });
      expTopName = sorted[0]?.[0] || '—';
      expTopShare = Math.round(((sorted[0]?.[1] || 0) / expTotal) * 100);
      expHHI = Math.round(sorted.reduce((s, [, v]) => s + (v / expTotal) ** 2, 0) * 10000);
    }
  }

  // Import concentration
  let impSegments = [], impTopName = '—', impTopShare = 0, impHHI = 0;
  const impSrcs = [];
  Object.entries(qtySnapC).forEach(([rep, row]) => {
    const q = row[key]; if (q) impSrcs.push([rep, q]);
  });
  impSrcs.sort((a, b) => b[1] - a[1]);
  const impTotal = impSrcs.reduce((s, [, v]) => s + v, 0);
  if (impTotal > 0 && impSrcs.length > 0) {
    let rawSum = 0, procSum = 0;
    impSrcs.forEach(([src]) => {
      rawSum += (rawSnapC[src] || {})[key] || 0;
      procSum += (procSnapC[src] || {})[key] || 0;
    });
    if (rawSum > 0) impSegments.push({ share: rawSum / impTotal, color: FLOW_COLORS.importRaw });
    if (procSum > 0) impSegments.push({ share: procSum / impTotal, color: FLOW_COLORS.importProcessed });
    impTopName = impSrcs[0]?.[0] || '—';
    impTopShare = Math.round(((impSrcs[0]?.[1] || 0) / impTotal) * 100);
    impHHI = Math.round(impSrcs.reduce((s, [, v]) => s + (v / impTotal) ** 2, 0) * 10000);
  }

  function makeConBar(label, segments, topName, topShare, hhi, hasData) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:6px;';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:7px;letter-spacing:.06em;text-transform:uppercase;color:rgba(74,44,23,0.55);margin-bottom:3px;';
    lbl.textContent = label;
    wrap.appendChild(lbl);

    if (!hasData || segments.length === 0) {
      const na = document.createElement('div');
      na.style.cssText = 'font-size:8px;color:rgba(74,44,23,0.35);font-style:italic;';
      na.textContent = 'No data for this year';
      wrap.appendChild(na);
      return wrap;
    }

    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;height:8px;border-radius:3px;overflow:hidden;width:100%;';
    segments.forEach(({ share, color }) => {
      const seg = document.createElement('div');
      seg.style.cssText = `flex:0 0 ${(share * 100).toFixed(1)}%;background:${color};min-width:${share > 0 ? '2px' : '0'};`;
      bar.appendChild(seg);
    });
    wrap.appendChild(bar);

    const sub = document.createElement('div');
    sub.style.cssText = 'margin-top:2px;font-size:7.5px;color:rgba(74,44,23,0.6);display:flex;justify-content:space-between;';
    sub.innerHTML = `<span>Top: ${topName} ${topShare}%</span><span title="Herfindahl index">HHI ${hhi}</span>`;
    wrap.appendChild(sub);

    return wrap;
  }

  concDiv.appendChild(makeConBar('EXPORT CONCENTRATION', expSegments, expTopName, expTopShare, expHHI, expTotal > 0));
  concDiv.appendChild(makeConBar('IMPORT CONCENTRATION', impSegments, impTopName, impTopShare, impHHI, impTotal > 0));
}