import { state } from './dataService.js';

let timelineUpdateRef = null;

/* ── TIMELINE (D3) ────────────────────────────────────────── */
export function drawPriceChart(priceData) {
    const svg = d3.select("#price-chart-svg");
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 80, bottom: 30, left: 50 };
    const width = (svg.node().getBoundingClientRect().width || 600) - margin.left - margin.right;
    const height = (svg.node().getBoundingClientRect().height || 250) - margin.top - margin.bottom;

    const chartGroup = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Format data
    const years = Object.keys(priceData).sort((a, b) => a - b);
    const data = years.map(y => ({
        year: d3.timeParse("%Y")(y),
        yearNum: parseInt(y),
        yearStr: y,
        raw: priceData[y].raw,
        processed: priceData[y].processed
    })).filter(d => d.raw != null && d.processed != null);

    // Scales
    const x = d3.scaleTime().domain(d3.extent(data, d => d.year)).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.processed) * 1.15]).range([height, 0]);

    // Gridlines
    chartGroup.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat("").ticks(5))
        .style("stroke", "#d7ccc8").style("stroke-dasharray", "3,3").style("stroke-opacity", 0.3)
        .call(g => g.select(".domain").remove());

    // Generators
    const area = d3.area().curve(d3.curveMonotoneX)
        .x(d => x(d.year)).y0(d => y(d.raw)).y1(d => y(d.processed));
    const lineRaw = d3.line().curve(d3.curveMonotoneX)
        .x(d => x(d.year)).y(d => y(d.raw));
    const lineProc = d3.line().curve(d3.curveMonotoneX)
        .x(d => x(d.year)).y(d => y(d.processed));

    // Paths (Empty at first, they will be drawn by the update function)
    const pathArea = chartGroup.append("path").attr("fill", "#c4a482").attr("opacity", 0.3);
    const pathRaw = chartGroup.append("path").attr("fill", "none").attr("stroke", "#8d6e63").attr("stroke-width", 2.5);
    const pathProc = chartGroup.append("path").attr("fill", "none").attr("stroke", "#3e2723").attr("stroke-width", 3);

    // Axes
    chartGroup.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(5))
        .call(g => g.select(".domain").attr("stroke", "#8d6e63"))
        .call(g => g.selectAll(".tick line").attr("stroke", "#8d6e63"))
        .call(g => g.selectAll("text").attr("fill", "#4e342e").style("font-family", "sans-serif"));

    chartGroup.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d => "$" + d.toLocaleString()))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").remove())
        .call(g => g.selectAll("text").attr("fill", "#4e342e").style("font-weight", "500"));

    // Labels
    const lblProc = chartGroup.append("text").attr("fill", "#3e2723").style("font-weight", "bold").style("font-size", "12px").text("Processed");
    const lblRaw = chartGroup.append("text").attr("fill", "#8d6e63").style("font-weight", "bold").style("font-size", "12px").text("Raw");

    // Vertical Timeline Cursor
    const yearCursor = chartGroup.append("line")
        .attr("y1", 0).attr("y2", height)
        .style("stroke", "rgba(74,44,23,0.45)")
        .style("stroke-width", "1px")
        .style("stroke-dasharray", "2,2");

    // Dynamic update linked to slider
    timelineUpdateRef = function (currentYear) {
        // 1. Slice data up to the slider's year
        const visibleData = data.filter(d => d.yearNum <= currentYear);
        if (visibleData.length === 0) return;

        // 2. Redraw the lines and shaded area
        pathArea.datum(visibleData).attr("d", area);
        pathRaw.datum(visibleData).attr("d", lineRaw);
        pathProc.datum(visibleData).attr("d", lineProc);

        // 3. Move the text labels to follow the end of the line
        const lastPoint = visibleData[visibleData.length - 1];
        lblProc.attr("x", x(lastPoint.year) + 8).attr("y", y(lastPoint.processed) + 4);
        lblRaw.attr("x", x(lastPoint.year) + 8).attr("y", y(lastPoint.raw) + 4);

        // 4. Move the vertical cursor
        const cx = x(d3.timeParse("%Y")(currentYear));
        yearCursor.attr("x1", cx).attr("x2", cx);
    };

    // Hover interactivity
    const focus = chartGroup.append("g").style("display", "none");

    focus.append("line").attr("class", "hover-line").attr("y1", 0).attr("y2", height).style("stroke", "#3e2723").style("stroke-width", "1px").style("stroke-dasharray", "4,4").style("opacity", 0.5);
    focus.append("circle").attr("class", "dot-raw").attr("r", 4).attr("fill", "#8d6e63").attr("stroke", "#fff").attr("stroke-width", 1.5);
    focus.append("circle").attr("class", "dot-proc").attr("r", 4).attr("fill", "#3e2723").attr("stroke", "#fff").attr("stroke-width", 1.5);

    const tooltip = focus.append("g").attr("class", "tooltip-box");
    tooltip.append("rect").attr("width", 125).attr("height", 55).attr("fill", "#3e2723").attr("rx", 4).attr("opacity", 0.95);
    const tooltipYear = tooltip.append("text").attr("x", 8).attr("y", 16).attr("fill", "#d7ccc8").style("font-size", "10px").style("font-weight", "bold");
    const tooltipProc = tooltip.append("text").attr("x", 8).attr("y", 32).attr("fill", "#fff").style("font-size", "11px");
    const tooltipRaw = tooltip.append("text").attr("x", 8).attr("y", 46).attr("fill", "#fff").style("font-size", "11px");

    chartGroup.append("rect").attr("width", width).attr("height", height).style("fill", "none").style("pointer-events", "all")
        .on("mouseover", () => focus.style("display", null))
        .on("mouseout", () => focus.style("display", "none"))
        .on("mousemove", mousemove);

    const bisectDate = d3.bisector(d => d.year).left;

    function mousemove(event) {
        // Users can hover over the full data range, even the "future" faded out section
        const x0 = x.invert(d3.pointer(event)[0]);
        const i = bisectDate(data, x0, 1);
        const d0 = data[i - 1];
        const d1 = data[i] || d0;
        const d = x0 - d0.year > d1.year - x0 ? d1 : d0;

        const cx = x(d.year);
        const cyRaw = y(d.raw);
        const cyProc = y(d.processed);

        focus.select(".hover-line").attr("transform", `translate(${cx}, 0)`);
        focus.select(".dot-raw").attr("transform", `translate(${cx}, ${cyRaw})`);
        focus.select(".dot-proc").attr("transform", `translate(${cx}, ${cyProc})`);

        let tooltipX = cx + 12;
        if (tooltipX + 125 > width) tooltipX = cx - 137;

        tooltip.attr("transform", `translate(${tooltipX}, ${cyProc - 20})`);
        tooltipYear.text(`YEAR: ${d.yearStr}`);
        tooltipProc.text(`Processed: $${d.processed.toLocaleString()}`);
        tooltipRaw.text(`Raw: $${d.raw.toLocaleString()}`);
    }
}

export function updateVisualizationsOnYearChange(year) {
    if (timelineUpdateRef) timelineUpdateRef(year);
    updateSankey(year);
}


/* ── SANKEY (D3) ──────────────────────────────────────────── */
function updateSankey(year) {
    const rawSnap = state.data.TRADE_QTY_RAW_BY_YEAR[year] || {};
    const procSnap = state.data.TRADE_QTY_PROC_BY_YEAR[year] || {};
    const psSnap = state.data.PROCESSED_SHARE_BY_YEAR[year] || {};

    const processorSet = new Set(Object.entries(psSnap).filter(([, s]) => s >= 30).map(([k]) => k));
    const sel = state.selectedCountry;

    // 1. Interactive Filtering 
    let rawData = rawSnap;
    let procData = procSnap;

    if (sel) {
        rawData = {}; procData = {};
        Object.entries(rawSnap).forEach(([rep, row]) => {
            Object.entries(row).forEach(([dest, qty]) => {
                if (rep === sel || dest === sel) {
                    if (!rawData[rep]) rawData[rep] = {};
                    rawData[rep][dest] = qty;
                }
            });
        });
        Object.entries(procSnap).forEach(([rep, row]) => {
            Object.entries(row).forEach(([dest, qty]) => {
                if (rep === sel || dest === sel) {
                    if (!procData[rep]) procData[rep] = {};
                    procData[rep][dest] = qty;
                }
            });
        });
    }

    // 2. Data Calculation: Imports, Exports, and Retained Consumption
    const rawExp = {}, rawImp = {}, procExp = {}, procImp = {};

    Object.entries(rawData).forEach(([rep, row]) => {
        Object.entries(row).forEach(([dest, qty]) => {
            rawExp[rep] = (rawExp[rep] || 0) + qty;
            rawImp[dest] = (rawImp[dest] || 0) + qty;
        });
    });

    Object.entries(procData).forEach(([rep, row]) => {
        Object.entries(row).forEach(([dest, qty]) => {
            procExp[rep] = (procExp[rep] || 0) + qty;
            procImp[dest] = (procImp[dest] || 0) + qty;
        });
    });

    const consumption = {};
    const allViewCountries = new Set([...Object.keys(rawImp), ...Object.keys(rawExp), ...Object.keys(procImp), ...Object.keys(procExp)]);

    allViewCountries.forEach(c => {
        const rI = rawImp[c] || 0;
        const rE = rawExp[c] || 0;
        const pI = procImp[c] || 0;
        const pE = procExp[c] || 0;

        const retained = Math.max(0, rI - rE - pE);
        const totalCons = pI + retained;

        consumption[c] = { total: totalCons, pI, retained };
    });

    // 3. Sorting & Highlighting Top N
    const TOP_N = sel ? 6 : 5;

    const topProdList = Object.entries(rawExp).filter(([k]) => !processorSet.has(k)).sort((a, b) => b[1] - a[1]);
    const topHubList = Object.entries(rawImp).filter(([k]) => processorSet.has(k)).sort((a, b) => b[1] - a[1]);
    const topDestList = Object.entries(consumption).filter(([k]) => k !== "Others").sort((a, b) => b[1].total - a[1].total);

    const forceInclude = (list, key, valObj, isCons) => {
        if (!key) return;
        const val = isCons ? (valObj?.total || 0) : (valObj || 0);
        if (val <= 0) return;

        const idx = list.findIndex(x => x[0] === key);
        if (idx >= TOP_N) {
            const item = list.splice(idx, 1)[0];
            list.splice(TOP_N - 1, 0, item);
        } else if (idx === -1) {
            list.splice(TOP_N - 1, 0, [key, valObj]);
        }
    };

    if (sel) {
        forceInclude(topProdList, sel, rawExp[sel], false);
        forceInclude(topHubList, sel, rawImp[sel], false);
        forceInclude(topDestList, sel, consumption[sel], true);
    }

    const topProd = topProdList.slice(0, TOP_N);
    const topHub = topHubList.slice(0, TOP_N);
    const topDest = topDestList.slice(0, TOP_N);

    const topPKeys = new Set(topProd.map(([k]) => k));
    const topHKeys = new Set(topHub.map(([k]) => k));
    const topDKeys = new Set(topDest.map(([k]) => k));

    const topProdNames = topProd.map(x => x[0]);
    const topHubNames = topHub.map(x => x[0]);
    const topDestNames = topDest.map(x => x[0]);

    // 4. Build Flow Links
    let aggregatedLinks = {};
    function addLink(src, target, val) {
        if (val <= 0) return;
        const key = `${src}|${target}`;
        aggregatedLinks[key] = (aggregatedLinks[key] || 0) + val;
    }

    // Producer -> Hub (Raw)
    // Suffixes (_P, _H, _C) guarantee D3 treats them as separate nodes and doesn't crash
    Object.entries(rawData).forEach(([rep, row]) => {
        const src = topPKeys.has(rep) ? rep + "_P" : "Others_P";
        Object.entries(row).forEach(([dest, qty]) => {
            const tgt = topHKeys.has(dest) ? dest + "_H" : "Others_H";
            addLink(src, tgt, qty);
        });
    });

    // Hub -> Consumer (Exported Processed)
    Object.entries(procData).forEach(([rep, row]) => {
        const src = topHKeys.has(rep) ? rep + "_H" : "Others_H";
        Object.entries(row).forEach(([dest, qty]) => {
            const tgt = topDKeys.has(dest) ? dest + "_C" : "Others_C";
            addLink(src, tgt, qty);
        });
    });

    // Hub -> Consumer (Domestic Retained & Consumed)
    allViewCountries.forEach(c => {
        const retained = consumption[c].retained;
        if (retained > 0) {
            const src = topHKeys.has(c) ? c + "_H" : "Others_H";
            const tgt = topDKeys.has(c) ? c + "_C" : "Others_C";
            addLink(src, tgt, retained);
        }
    });

    // 5. THE BALANCE FIX - Mathematically perfect height matching
    let sumPH = 0;
    let sumHC = 0;
    Object.entries(aggregatedLinks).forEach(([key, val]) => {
        const [src] = key.split('|');
        if (src.endsWith("_P")) sumPH += val;
        if (src.endsWith("_H")) sumHC += val;
    });

    // Routes misaligned data explicitly, preventing layout collapse
    const diff = sumPH - sumHC;
    if (diff > 0) addLink("Others_H", "Others_C", diff);
    if (diff < 0) addLink("Others_P", "Others_H", -diff);

    const linksData = Object.entries(aggregatedLinks).map(([key, value]) => {
        const [source, target] = key.split('|');
        return { source, target, value };
    });

    if (linksData.length === 0) { d3.select("#sankey-svg").selectAll("*").remove(); return; }

    // 6. Define Base Nodes (Unique IDs!)
    const baseNodesData = [];
    topProd.forEach(([name]) => baseNodesData.push({ id: name + "_P", name, category: "Producer" }));
    baseNodesData.push({ id: "Others_P", name: "Others", category: "Producer" });

    topHub.forEach(([name]) => baseNodesData.push({ id: name + "_H", name, category: "Hub" }));
    baseNodesData.push({ id: "Others_H", name: "Others", category: "Hub" });

    topDest.forEach(([name]) => baseNodesData.push({ id: name + "_C", name, category: "Consumer" }));
    baseNodesData.push({ id: "Others_C", name: "Others", category: "Consumer" });

    // Remove ghost nodes that have no links!
    const activeNodeIds = new Set();
    linksData.forEach(l => {
        activeNodeIds.add(l.source);
        activeNodeIds.add(l.target);
    });
    const nodesData = baseNodesData.filter(n => activeNodeIds.has(n.id));

    // 7. Draw D3 Sankey
    const sankey = d3.sankey()
        .nodeId(d => d.id)
        .nodeWidth(12)
        .nodePadding(5)
        .extent([[6, 12], [364, 102]])
        .nodeSort((a, b) => {
            if (a.name === "Others" && b.name !== "Others") return 1;
            if (a.name !== "Others" && b.name === "Others") return -1;
            return b.value - a.value;
        });

    const graph = sankey({ nodes: nodesData, links: linksData });
    const svg = d3.select("#sankey-svg");
    svg.selectAll("*").remove();

    const PROD_COLORS = ['#3D2010', '#5C3820', '#7A4C2A', '#8B5E3C', '#9B6E4C', '#A97E5C'];
    const HUB_COLORS = ['#5C4400', '#7A5C00', '#987800', '#B09010', '#C4A820', '#D8BC30'];
    const DEST_COLORS = ['#5C3020', '#7A4030', '#984A38', '#A85A44', '#B86A54', '#C87A64'];
    const FLOW_PH = ['rgba(61,32,16,0.42)', 'rgba(92,56,32,0.38)', 'rgba(122,76,42,0.34)', 'rgba(139,94,60,0.30)', 'rgba(155,110,76,0.26)', 'rgba(169,126,92,0.22)'];
    const FLOW_HD = ['rgba(92,68,0,0.44)', 'rgba(122,92,0,0.40)', 'rgba(152,120,0,0.36)', 'rgba(176,144,16,0.32)', 'rgba(196,168,32,0.28)', 'rgba(216,188,48,0.24)'];

    svg.append("g").attr("fill", "none").selectAll("path").data(graph.links).join("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => {
            if (d.source.name === "Others" || d.target.name === "Others") return "rgba(153, 153, 153, 0.20)";
            if (d.source.category === "Producer") return FLOW_PH[Math.max(0, topProdNames.indexOf(d.source.name))] || FLOW_PH[0];
            return FLOW_HD[Math.max(0, topHubNames.indexOf(d.source.name))] || FLOW_HD[0];
        })
        .attr("stroke-width", d => Math.max(0.5, d.width));

    svg.append("g").selectAll("rect").data(graph.nodes).join("rect")
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("height", d => Math.max(1, d.y1 - d.y0))
        .attr("width", d => d.x1 - d.x0).attr("rx", 1)
        .attr("fill", d => {
            if (d.name === "Others") return "#A89A8E";
            if (d.name === sel) return "#C4A820";
            if (d.category === "Producer") return PROD_COLORS[topProdNames.indexOf(d.name)] || "#3D2010";
            if (d.category === "Hub") return HUB_COLORS[topHubNames.indexOf(d.name)] || "#5C4400";
            return DEST_COLORS[topDestNames.indexOf(d.name)] || "#5C3020";
        });

    svg.append("g").selectAll("text").data([{ x: 6, a: 'start', t: 'Producers' }, { x: 185, a: 'middle', t: 'Processors' }, { x: 364, a: 'end', t: 'Consumers' }]).join("text")
        .attr("x", d => d.x).attr("y", 9).attr("font-size", "5px").attr("fill", "#5C3820").attr("font-weight", "600").attr("text-anchor", d => d.a).text(d => d.t);

    // Get the natively perfectly calculated visual heights
    const colTotals = {};
    graph.nodes.forEach(n => {
        colTotals[n.category] = (colTotals[n.category] || 0) + n.value;
    });

    svg.append("g").style("font-size", "4.2px").style("font-weight", "600").selectAll("text").data(graph.nodes).join("text")
        .attr("x", d => (d.category === "Consumer") ? d.x0 - 2 : d.x1 + 2)
        .attr("y", d => (d.y1 + d.y0) / 2 + 1.5)
        .attr("text-anchor", d => (d.category === "Consumer") ? "end" : "start")
        .attr("fill", d => d.name === sel ? "#987800" : (d.name === "Others" ? "#7A6C60" : "#4A2C17"))
        .text(d => {
            // Because the total column heights are now exactly identical, this math will NEVER be wrong.
            const pct = (d.value / (colTotals[d.category] || 1)) * 100;
            if (pct < 0.1) return "";
            const pctStr = pct < 1 ? "<1" : Math.round(pct);
            return `${d.name} ${pctStr}%`;
        });
}