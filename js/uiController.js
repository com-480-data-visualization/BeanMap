import { FLOW_COLORS, GEO_NAME_MAP } from './config.js';
import { state } from './dataService.js';
import { fmtQtyExpanded, fmtValExpanded } from './utils.js';
import { updateVisualizationsOnYearChange } from './visualizations.js';

let playing = false;
let playInterval = null;

export function setupUI(onYearChange, onFlowModeChange) {
  const slider = document.getElementById('year-slider');
  const display = document.getElementById('year-display');
  const yearBadge = document.getElementById('topbar-year');

  const playBtn = document.getElementById('slider-play');
  const fastPlayBtn = document.getElementById('slider-fast-play');

  // Define our clean SVG icons
  const ICON_PLAY = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  const ICON_FAST = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`;
  const ICON_PAUSE = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

  let playInterval = null;
  let currentSpeed = 1000;

  // Unified playback function
  function togglePlayback(speed) {
    if (playInterval && currentSpeed === speed) {
      clearInterval(playInterval);
      playInterval = null;
      playBtn.innerHTML = ICON_PLAY;
      fastPlayBtn.innerHTML = ICON_FAST;
      return;
    }

    if (playInterval) clearInterval(playInterval);

    currentSpeed = speed;

    if (speed === 250) {
      fastPlayBtn.innerHTML = ICON_PAUSE;
      playBtn.innerHTML = ICON_PLAY;
    } else {
      playBtn.innerHTML = ICON_PAUSE;
      fastPlayBtn.innerHTML = ICON_FAST;
    }

    let currentYear = parseInt(slider.value);
    let maxYear = parseInt(slider.max);
    let minYear = parseInt(slider.min);

    if (currentYear >= maxYear) {
      currentYear = minYear;
      slider.value = currentYear;
      state.currentYear = currentYear;
      display.textContent = currentYear;
      yearBadge.textContent = currentYear;

      updateVisualizationsOnYearChange(currentYear);
      if (onYearChange) onYearChange(currentYear);
    }

    playInterval = setInterval(() => {
      let currentYear = parseInt(slider.value);
      let maxYear = parseInt(slider.max);

      if (currentYear >= maxYear) {
        clearInterval(playInterval);
        playInterval = null;
        playBtn.innerHTML = ICON_PLAY;
        fastPlayBtn.innerHTML = ICON_FAST;
      } else {
        currentYear++;
        slider.value = currentYear;
        state.currentYear = currentYear;
        display.textContent = currentYear;
        yearBadge.textContent = currentYear;

        updateVisualizationsOnYearChange(currentYear);
        if (onYearChange) onYearChange(currentYear);
      }
    }, speed);
  }

  // --- MISSING EVENT LISTENERS ADDED BACK HERE ---

  // 1. Play Button Clicks
  if (playBtn) playBtn.addEventListener('click', () => togglePlayback(1000));
  if (fastPlayBtn) fastPlayBtn.addEventListener('click', () => togglePlayback(250));

  // 2. Manual Slider Dragging
  if (slider) {
    slider.addEventListener('input', (e) => {
      const y = parseInt(e.target.value);
      display.textContent = y;
      yearBadge.textContent = y;
      state.currentYear = y;
      updateVisualizationsOnYearChange(y);
      if (onYearChange) onYearChange(y);
    });
  }

  // 3. Flow Mode Toggle (Show Value / Show Volume)
  const flowModeBtn = document.getElementById('flow-mode-btn');
  if (flowModeBtn) {
    flowModeBtn.addEventListener('click', () => {
      // Toggle the state between 'qty' and 'val'
      state.flowMode = state.flowMode === 'val' ? 'qty' : 'val';

      // Notify the app
      if (onFlowModeChange) onFlowModeChange();

      // Update the button text
      flowModeBtn.textContent = state.flowMode === 'val' ? 'Show Volume' : 'Show Value';
    });
  }

  // 4. Info Modal Event Listeners
  const infoBtn = document.getElementById('info-btn');
  const modal = document.getElementById('info-modal');
  const closeBtn = document.getElementById('close-modal-btn');

  if (infoBtn && modal && closeBtn) {
    // Open Modal
    infoBtn.addEventListener('click', () => {
      modal.classList.remove('hidden');
    });

    // Close Modal via 'X'
    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    // Close Modal by clicking the dark overlay background
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }
}

export function updateSidePanel(name, year) {
  setLowerPanelsVisibility(true);

  const key = GEO_NAME_MAP[name] || name;
  const qtySnap = state.data.TRADE_QUANTITY_BY_YEAR[year] || state.data.TRADE_QUANTITY_BY_YEAR[2023] || state.data.TRADE_QUANTITY;
  const valSnap = state.data.TRADE_VALUE_BY_YEAR[year] || state.data.TRADE_VALUE_BY_YEAR[2023] || state.data.TRADE_VALUE;
  const rawQtySnap = state.data.TRADE_QTY_RAW_BY_YEAR[year] || state.data.TRADE_QTY_RAW_BY_YEAR[2023] || {};
  const procQtySnap = state.data.TRADE_QTY_PROC_BY_YEAR[year] || state.data.TRADE_QTY_PROC_BY_YEAR[2023] || {};
  const tiSnap = state.data.TRANSFORMATION_INDEX_BY_YEAR[year] || state.data.TRANSFORMATION_INDEX_BY_YEAR[2023] || {};

  const ti = tiSnap[key] ?? null;
  const rank = state.TI_RANKS[key];

  document.getElementById('sp-country-name').textContent = name;

  const rankEl = document.getElementById('sp-rank');
  rankEl.textContent = rank ? `#${rank} by TI` : 'No TI data';
  rankEl.style.background = rank ? 'var(--tan)' : 'var(--sand)';

  const qtyRow = qtySnap[key];

  // Calculate the 4 buckets (Quantity and Value)
  let expRawQty = 0, expProcQty = 0, expRawVal = 0, expProcVal = 0;
  if (qtyRow) {
    Object.keys(qtyRow).forEach(partner => {
      const rq = (rawQtySnap[key] || {})[partner] || 0;
      const pq = (procQtySnap[key] || {})[partner] || 0;
      const tq = rq + pq;
      const tv = (valSnap[key] || {})[partner] || 0;

      expRawQty += rq;
      expProcQty += pq;
      if (tq > 0) {
        expRawVal += (tv * rq / tq);
        expProcVal += (tv * pq / tq);
      }
    });
  }

  let impRawQty = 0, impProcQty = 0, impRawVal = 0, impProcVal = 0;
  Object.keys(qtySnap).forEach(reporter => {
    if (reporter !== key && (qtySnap[reporter][key] || 0) > 0) {
      const rq = (rawQtySnap[reporter] || {})[key] || 0;
      const pq = (procQtySnap[reporter] || {})[key] || 0;
      const tq = rq + pq;
      const tv = (valSnap[reporter] || {})[key] || 0;

      impRawQty += rq;
      impProcQty += pq;
      if (tq > 0) {
        impRawVal += (tv * rq / tq);
        impProcVal += (tv * pq / tq);
      }
    }
  });

  const isVal = state.flowMode === 'val';

  // Helper to format text based on current mode using the Expanded format
  const getPillText = (qty, val) => isVal ? (val > 0 ? fmtValExpanded(val) : '—') : (qty > 0 ? fmtQtyExpanded(qty) : '—');

  // Inject Data
  document.getElementById('sp-imp-raw').textContent = getPillText(impRawQty, impRawVal);
  document.getElementById('sp-imp-proc').textContent = getPillText(impProcQty, impProcVal);
  document.getElementById('sp-exp-raw').textContent = getPillText(expRawQty, expRawVal);
  document.getElementById('sp-exp-proc').textContent = getPillText(expProcQty, expProcVal);

  // TI Calculation: Volume or Estimated Value
  const pt = state.data.PRICE_TIMELINE[year] || state.data.PRICE_TIMELINE[2023];
  let tiText = '—';
  if (ti !== null && ti >= 0) {
    if (isVal) {
      // Determine country's specific average processed export price, fallback to global
      const countryProcPrice = expProcQty > 0 ? ((expProcVal * 1000) / expProcQty) : pt.processed;
      const tiUsd = ti * countryProcPrice;
      // fmtValExpanded expects values in thousands of USD
      tiText = fmtValExpanded(tiUsd / 1000);
    } else {
      tiText = fmtQtyExpanded(ti);
    }
  }
  document.getElementById('sp-ti').textContent = tiText;

  // Dynamically update the single master label
  const metricLbl = document.getElementById('sp-metric-lbl');
  if (metricLbl) {
    metricLbl.textContent = isVal ? 'Value (USD)' : 'Volume (Tonnes)';
  }

  updateBarChart(key, year);
  populateTradeFlows(key, year);
}

function updateBarChart(key, year) {
  const barContainer = document.getElementById('sp-bar-chart-rows');
  if (!barContainer) return;

  barContainer.innerHTML = '';
  const pt = state.data.PRICE_TIMELINE[year] || state.data.PRICE_TIMELINE[2023];

  // Use global baseline prices if specific country data is missing
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
  let margin = null;
  let isFallbackMargin = false;

  if (expUV !== null && impUV !== null) {
    // Standard Trade Margin ($/tonne)
    margin = expUV - impUV;
  } else if (expUV === null && impUV !== null) {
    // NO EXPORTS fallback: Global avg processed - avg import price paid by country
    margin = Math.round(pProc - impUV);
    isFallbackMargin = true;
  }

  function makePriceRow(lbl, uv) {
    if (uv === null) return null;
    // Format numbers with apostrophes
    const formattedUV = uv.toLocaleString('en-US').replace(/,/g, "'");
    const el = document.createElement('div');
    el.className = 'bar-row';
    el.style.marginBottom = '5px';
    el.style.justifyContent = 'space-between';

    el.innerHTML =
      `<span class="bar-year" style="width:auto;">${lbl} Average</span>` +
      `<span class="bar-val" style="font-size:10px; width:auto;">${formattedUV} $&thinsp;/&thinsp;t</span>`;
    return el;
  }

  const expRow = makePriceRow('Export', expUV);
  const impRow = makePriceRow('Import', impUV);

  if (expRow) barContainer.appendChild(expRow);
  if (impRow) barContainer.appendChild(impRow);

  if (!expRow && !impRow) {
    const na = document.createElement('div');
    na.style.cssText = 'font-size:9px;color:rgba(74,44,23,0.4);text-align:center;padding:6px 0;';
    na.textContent = 'No trade data for this year';
    barContainer.appendChild(na);
  }

  if (margin !== null) {
    const marginStr = margin.toLocaleString('en-US').replace(/,/g, "'");
    let mColor, labelStr;

    if (isFallbackMargin) {
      mColor = margin > 0 ? '#B89028' : '#8B4030';
      labelStr = 'Approx. Value Added'; // Clear indication it's an estimate
    } else {
      mColor = margin > 800 ? '#B89028' : margin > 200 ? '#9A7A20' : margin > 0 ? '#7A6040' : '#8B4030';
      labelStr = 'Trade Margin';
    }

    const sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid rgba(74,44,23,0.12);margin:6px 0;';
    barContainer.appendChild(sep);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';

    // Add a plus sign for standard positive margins, but omit it for the fallback estimate
    row.innerHTML =
      `<span style="font-size:8px;color:var(--coffee);letter-spacing:.06em;text-transform:uppercase;">${labelStr}</span>` +
      `<span style="font-size:12px;font-weight:700;color:${mColor};">${marginStr} $&thinsp;/&thinsp;t</span>`;
    barContainer.appendChild(row);
  }
}

function populateTradeFlows(key, year) {
  const flowContainer = document.getElementById('sp-flows-combined');
  if (!flowContainer) return;

  flowContainer.innerHTML = '';

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
      topLabel = rawVal > 0 ? fmtValExpanded(rawVal) : '—';
      botLabel = procVal > 0 ? fmtValExpanded(procVal) : '—';
    } else {
      topLabel = rawQ > 0 ? `${fmtQtyExpanded(rawQ)}` : '—';
      botLabel = procQ > 0 ? `${fmtQtyExpanded(procQ)}` : '—';
    }

    const row = document.createElement('div');
    row.className = 'flow-row';
    row.innerHTML =
      `<span class="flow-arrow" style="color:var(--coffee); font-size:16px; line-height:1; transform:translateY(-1px); margin-right:2px; display:inline-block;">${arrow}</span>` +
      `<span class="flow-country">${country}</span>` +
      `<div class="flow-bars" style="padding-top:2px;">` +
      `<div class="flow-bar-wrap"><div class="flow-bar-fill" style="width:${rawW}%;background:${rawColor}"></div></div>` +
      `<div class="flow-bar-wrap"><div class="flow-bar-fill" style="width:${procW}%;background:${procColor}"></div></div>` +
      `</div>` +
      `<div style="text-align:right;flex-shrink:0;width:36px;">` +
      `<div style="font-size:8px;font-weight:600;color:var(--coffee);line-height:1.3;">${topLabel}</div>` +
      `<div style="font-size:8px;font-weight:600;color:var(--coffee);line-height:1.3;">${botLabel}</div>` +
      `</div>`;
    return row;
  }

  let combinedRows = [];

  // Gather Exports
  const qtyRow = qtySnap[key];
  if (qtyRow) {
    Object.keys(qtyRow).forEach(partner => {
      combinedRows.push({
        isExport: true,
        partner: partner,
        rawQ: (rawFlowSnap[key] || {})[partner] || 0,
        procQ: (procFlowSnap[key] || {})[partner] || 0,
        qty: qtyRow[partner] || 0,
        val: (valSnap[key] || {})[partner] || 0,
      });
    });
  }

  // Gather Imports
  Object.keys(qtySnap).forEach(reporter => {
    if (reporter !== key && (qtySnap[reporter][key] || 0) > 0) {
      combinedRows.push({
        isExport: false,
        partner: reporter,
        rawQ: (rawFlowSnap[reporter] || {})[key] || 0,
        procQ: (procFlowSnap[reporter] || {})[key] || 0,
        qty: qtySnap[reporter][key] || 0,
        val: (valSnap[reporter] || {})[key] || 0,
      });
    }
  });

  // Sort combined array
  combinedRows.sort((a, b) => state.flowMode === 'val' ? b.val - a.val : b.qty - a.qty);

  // Take top 10 combined flows
  const topFlows = combinedRows.slice(0, 10);

  if (topFlows.length === 0) {
    flowContainer.innerHTML = '<div style="font-size:9px;color:var(--coffee);font-style:italic;padding:4px 0;">No trade data for this year</div>';
  } else {
    const maxQty = Math.max(...topFlows.map(r => r.qty), 1);
    topFlows.forEach(({ partner, rawQ, procQ, qty, val, isExport }) => {
      // ↦ (U+21A6) for Export, ⇥ (U+21E5) for Import
      const arrow = isExport ? '↦' : '⇥';
      flowContainer.appendChild(makeRow(arrow, partner, rawQ, procQ, val, maxQty, isExport));
    });
  }
}

export function clearSidePanel() {
  // 1. Force everything below the toggle button to completely hide
  setLowerPanelsVisibility(false);

  // 2. Set Header
  document.getElementById('sp-country-name').textContent = 'Global Overview';
  const rankEl = document.getElementById('sp-rank');
  if (rankEl) {
    rankEl.textContent = 'All Countries';
    rankEl.style.background = 'var(--tan)';
  }

  // 3. Calculate actual global trade data for the current year
  const year = state.currentYear;
  const qtySnap = state.data.TRADE_QUANTITY_BY_YEAR?.[year] || state.data.TRADE_QUANTITY_BY_YEAR?.[2023] || state.data.TRADE_QUANTITY || {};
  const valSnap = state.data.TRADE_VALUE_BY_YEAR?.[year] || state.data.TRADE_VALUE_BY_YEAR?.[2023] || state.data.TRADE_VALUE || {};

  let globalQty = 0;
  let globalVal = 0;
  Object.values(qtySnap).forEach(row => {
    Object.values(row).forEach(v => globalQty += v);
  });
  Object.values(valSnap).forEach(row => {
    Object.values(row).forEach(v => globalVal += v);
  });

  // 4. Update the stat pills
  const safeSetText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  safeSetText('sp-ti', '—');
  safeSetText('sp-top-export', '—');

  const volLbl = document.getElementById('sp-vol-lbl');
  const impLbl = document.getElementById('sp-imp-vol-lbl');

  if (state.flowMode === 'val') {
    safeSetText('sp-vol', fmtVal(globalVal));
    if (volLbl) volLbl.innerHTML = 'Global export<br>value';

    safeSetText('sp-imp-vol', fmtVal(globalVal));
    if (impLbl) impLbl.innerHTML = 'Global import<br>value';
  } else {
    safeSetText('sp-vol', fmtQty(globalQty) + 't');
    if (volLbl) volLbl.innerHTML = 'Global export<br>volume';

    safeSetText('sp-imp-vol', fmtQty(globalQty) + 't');
    if (impLbl) impLbl.innerHTML = 'Global import<br>volume';
  }
}

export function setLowerPanelsVisibility(isVisible) {
  const lowerContent = document.getElementById('sp-lower-content');
  if (lowerContent) {
    lowerContent.style.display = isVisible ? 'block' : 'none';
  }
}
