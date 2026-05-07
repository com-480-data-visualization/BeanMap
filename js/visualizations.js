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

    const years = Object.keys(priceData).sort((a, b) => a - b);
    const data = years.map(y => ({
        year: d3.timeParse("%Y")(y),
        yearNum: parseInt(y),
        yearStr: y,
        raw: priceData[y].raw,
        processed: priceData[y].processed
    })).filter(d => d.raw != null && d.processed != null);

    const x = d3.scaleTime().domain(d3.extent(data, d => d.year)).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.processed) * 1.15]).range([height, 0]);

    chartGroup.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat("").ticks(5))
        .style("stroke", "#d7ccc8").style("stroke-dasharray", "3,3").style("stroke-opacity", 0.3)
        .call(g => g.select(".domain").remove());

    const area = d3.area().curve(d3.curveMonotoneX)
        .x(d => x(d.year)).y0(d => y(d.raw)).y1(d => y(d.processed));
    const lineRaw = d3.line().curve(d3.curveMonotoneX)
        .x(d => x(d.year)).y(d => y(d.raw));
    const lineProc = d3.line().curve(d3.curveMonotoneX)
        .x(d => x(d.year)).y(d => y(d.processed));

    const pathArea = chartGroup.append("path").attr("fill", "#c4a482").attr("opacity", 0.3);
    const pathRaw = chartGroup.append("path").attr("fill", "none").attr("stroke", "#8d6e63").attr("stroke-width", 2.5);
    const pathProc = chartGroup.append("path").attr("fill", "none").attr("stroke", "#3e2723").attr("stroke-width", 3);

    chartGroup.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(5))
        .call(g => g.select(".domain").attr("stroke", "#8d6e63"))
        .call(g => g.selectAll(".tick line").attr("stroke", "#8d6e63"))
        .call(g => g.selectAll("text").attr("fill", "#4e342e").style("font-family", "sans-serif"));

    chartGroup.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d => "$" + d.toLocaleString()))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").remove())
        .call(g => g.selectAll("text").attr("fill", "#4e342e").style("font-weight", "500"));

    const lblProc = chartGroup.append("text").attr("fill", "#3e2723").style("font-weight", "bold").style("font-size", "12px").text("Processed");
    const lblRaw = chartGroup.append("text").attr("fill", "#8d6e63").style("font-weight", "bold").style("font-size", "12px").text("Raw");

    const yearCursor = chartGroup.append("line")
        .attr("y1", 0).attr("y2", height)
        .style("stroke", "rgba(74,44,23,0.45)")
        .style("stroke-width", "1px")
        .style("stroke-dasharray", "2,2");

    timelineUpdateRef = function (currentYear) {
        const visibleData = data.filter(d => d.yearNum <= currentYear);
        if (visibleData.length === 0) return;
        pathArea.datum(visibleData).attr("d", area);
        pathRaw.datum(visibleData).attr("d", lineRaw);
        pathProc.datum(visibleData).attr("d", lineProc);
        const lastPoint = visibleData[visibleData.length - 1];
        lblProc.attr("x", x(lastPoint.year) + 8).attr("y", y(lastPoint.processed) + 4);
        lblRaw.attr("x", x(lastPoint.year) + 8).attr("y", y(lastPoint.raw) + 4);
        const cx = x(d3.timeParse("%Y")(currentYear));
        yearCursor.attr("x1", cx).attr("x2", cx);
    };

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
        const x0 = x.invert(d3.pointer(event)[0]);
        const i = bisectDate(data, x0, 1);
        const d0 = data[i - 1];
        const d1 = data[i] || d0;
        const d = x0 - d0.year > d1.year - x0 ? d1 : d0;
        const cx = x(d.year), cyRaw = y(d.raw), cyProc = y(d.processed);

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

    // 1. Data Filtering
    const rawData = [];
    const procData = [];
    const rawExp = {}, rawImp = {}, procExp = {}, procImp = {};

    Object.entries(rawSnap).forEach(([rep, row]) => {
        Object.entries(row).forEach(([dest, qty]) => {
            if (!sel || rep === sel || dest === sel) {
                rawData.push({ src: rep, tgt: dest, qty });
                rawExp[rep] = (rawExp[rep] || 0) + qty;
                rawImp[dest] = (rawImp[dest] || 0) + qty;
            }
        });
    });

    Object.entries(procSnap).forEach(([rep, row]) => {
        Object.entries(row).forEach(([dest, qty]) => {
            if (!sel || rep === sel || dest === sel) {
                procData.push({ src: rep, tgt: dest, qty });
                procExp[rep] = (procExp[rep] || 0) + qty;
                procImp[dest] = (procImp[dest] || 0) + qty;
            }
        });
    });

    const consumption = {};
    const allActiveCountries = new Set([...Object.keys(rawImp), ...Object.keys(rawExp), ...Object.keys(procImp), ...Object.keys(procExp)]);

    // Strict Mass Balance Equation
    allActiveCountries.forEach(c => {
        const rI = rawImp[c] || 0;
        const rE = rawExp[c] || 0;
        const pI = procImp[c] || 0;
        const pE = procExp[c] || 0;

        const retained = Math.max(0, rI - rE - pE);
        consumption[c] = { total: pI + retained, pI, retained };
    });

    // 2. Sorting & Display Options
    const TOP_N = sel ? 6 : 8;

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

    // 3. Build Authentic Links
    let aggregatedLinks = {};
    function addLink(src, target, val) {
        if (val <= 0) return;
        const key = `${src}|${target}`;
        aggregatedLinks[key] = (aggregatedLinks[key] || 0) + val;
    }

    rawData.forEach(({ src, tgt, qty }) => {
        const s = topPKeys.has(src) ? src + "_P" : "Others_P";
        const t = topHKeys.has(tgt) ? tgt + "_H" : "Others_H";
        addLink(s, t, qty);
    });

    procData.forEach(({ src, tgt, qty }) => {
        const s = topHKeys.has(src) ? src + "_H" : "Others_H";
        const t = topDKeys.has(tgt) ? tgt + "_C" : "Others_C";
        addLink(s, t, qty);
    });

    allActiveCountries.forEach(c => {
        const retained = consumption[c].retained;
        if (retained > 0) {
            const s = topHKeys.has(c) ? c + "_H" : "Others_H";
            const t = topDKeys.has(c) ? c + "_C" : "Others_C";
            addLink(s, t, retained);
        }
    });

    const linksData = Object.entries(aggregatedLinks).map(([key, value]) => {
        const [source, target] = key.split('|');
        return { source, target, value };
    });

    if (linksData.length === 0) {
        const svg = d3.select("#sankey-svg");
        svg.selectAll("*").remove();
        svg.append("text")
            .attr("x", 210).attr("y", 54).attr("text-anchor", "middle")
            .attr("fill", "#55230d").attr("font-size", "7px")
            .text(`No trade flows recorded for ${sel} in ${year}.`);
        return;
    }

    // 4. Define Base Nodes
    const baseNodesData = [];
    topProd.forEach(([name]) => baseNodesData.push({ id: name + "_P", name, category: "Producer" }));
    baseNodesData.push({ id: "Others_P", name: "Others", category: "Producer" });

    topHub.forEach(([name]) => baseNodesData.push({ id: name + "_H", name, category: "Hub" }));
    baseNodesData.push({ id: "Others_H", name: "Others", category: "Hub" });

    topDest.forEach(([name]) => baseNodesData.push({ id: name + "_C", name, category: "Consumer" }));
    baseNodesData.push({ id: "Others_C", name: "Others", category: "Consumer" });

    const activeNodeIds = new Set();
    linksData.forEach(l => { activeNodeIds.add(l.source); activeNodeIds.add(l.target); });
    const nodesData = baseNodesData.filter(n => activeNodeIds.has(n.id));

    // 5. Draw D3 Sankey
    const sankey = d3.sankey()
        .nodeId(d => d.id)
        .nodeWidth(12)
        .nodePadding(5.5) // <-- ENFORCES A MINIMUM VERTICAL GAP SO TEXT NEVER OVERLAPS
        .extent([[20, 6], [394, 108]])
        .nodeSort((a, b) => {
            if (a.name === "Others" && b.name !== "Others") return 1;
            if (a.name !== "Others" && b.name === "Others") return -1;
            return b.value - a.value;
        });

    const graph = sankey({ nodes: nodesData, links: linksData });
    const svg = d3.select("#sankey-svg");
    svg.selectAll("*").remove();

    // ─────────────────────────────────────────────────────────────
    // 🎨 SANKEY COLORS CONFIGURATION (Tweak these Hex codes)
    // ─────────────────────────────────────────────────────────────
    // Node Colors
    const COLOR_PRODUCER = '#4A2C17'; // Col 1 Solid Color (Espresso)
    const COLOR_HUB = '#8B5E3C'; // Col 2 Solid Color (Lighter Brown)
    const COLOR_CONSUMER = '#a86948'; // Col 3 Solid Color (Latte)
    const COLOR_OTHERS = '#A89A8E'; // "Others" Base Nodes (Grey)
    const COLOR_SELECTED = '#a8911e'; // Map Selection Highlight Node

    // Link Colors (rgba gives them the nice translucent overlap effect)
    const LINK_RAW_FLOW = 'rgba(74, 44, 23, 0.35)';   // Producer -> Hub Links
    const LINK_PROC_FLOW = 'rgba(74, 44, 23, 0.35)'; // Hub -> Consumer Links

    // Text Labels Configuration
    const LABEL_SIZE = '5.5px';   // <-- TWEAK FONT SIZE HERE
    const LABEL_COLOR = '#4A2C17'; // <-- TWEAK MAIN TEXT COLOR HERE (Dark Brown)
    const LABEL_OTHERS = '#8B7D70'; // <-- TWEAK "OTHERS" TEXT COLOR HERE
    const LABEL_SELECTED = '#6d5705'; // <-- TWEAK SELECTED COUNTRY TEXT COLOR HERE
    // ─────────────────────────────────────────────────────────────

    // Draw Links
    svg.append("g").attr("fill", "none").selectAll("path").data(graph.links).join("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => {
            if (d.source.name === "Others" || d.target.name === "Others") return "rgba(153, 153, 153, 0.20)";
            if (d.source.category === "Producer") return LINK_RAW_FLOW;
            return LINK_PROC_FLOW;
        })
        .attr("stroke-width", d => Math.max(0.5, d.width));

    // Draw Nodes
    svg.append("g").selectAll("rect").data(graph.nodes).join("rect")
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("height", d => Math.max(1.5, d.y1 - d.y0)) // <-- MINIMUM VISIBLE HEIGHT FOR TINY SLIVERS
        .attr("width", d => d.x1 - d.x0).attr("rx", 1)
        .attr("fill", d => {
            if (d.name === "Others") return COLOR_OTHERS;
            if (d.name === sel) return COLOR_SELECTED;
            if (d.category === "Producer") return COLOR_PRODUCER;
            if (d.category === "Hub") return COLOR_HUB;
            return COLOR_CONSUMER;
        });

    // Draw Headers
    svg.append("g").selectAll("text").data([{ x: 20, a: 'start', t: 'Producers' }, { x: 207, a: 'middle', t: 'Processors' }, { x: 394, a: 'end', t: 'Consumers' }]).join("text")
        .attr("x", d => d.x).attr("y", 2).attr("font-size", "6.5px").attr("fill", "#5C3820").attr("font-weight", "600").attr("text-anchor", d => d.a).text(d => d.t);

    const colTotals = {};
    graph.nodes.forEach(n => {
        colTotals[n.category] = (colTotals[n.category] || 0) + n.value;
    });

    const labels = svg.append("g")
        .style("font-size", LABEL_SIZE)
        .style("font-weight", "600")
        .selectAll("g")
        .data(graph.nodes).join("g")
        // Bumped Y-translation slightly (+1.8) to keep larger text vertically centered on the node
        .attr("transform", d => `translate(${(d.category === "Consumer") ? d.x0 - 2 : d.x1 + 2}, ${(d.y1 + d.y0) / 2 + 1.8})`);

    // Crisp text halo outline
    labels.append("text")
        .attr("text-anchor", d => (d.category === "Consumer") ? "end" : "start")
        .attr("stroke", "#D2C8B0")
        .attr("stroke-width", 2)
        .attr("stroke-linejoin", "round")
        .text(d => {
            if (d.value <= 0) return ""; // Only hide if absolutely zero
            const pct = (d.value / (colTotals[d.category] || 1)) * 100;
            return `${d.name} ${pct < 1 ? "<1" : Math.round(pct)}%`;
        });

    // Inner text color
    labels.append("text")
        .attr("text-anchor", d => (d.category === "Consumer") ? "end" : "start")
        .attr("fill", d => {
            if (d.name === sel) return LABEL_SELECTED;
            if (d.name === "Others") return LABEL_OTHERS;
            return LABEL_COLOR;
        })
        .text(d => {
            if (d.value <= 0) return ""; // Only hide if absolutely zero
            const pct = (d.value / (colTotals[d.category] || 1)) * 100;
            return `${d.name} ${pct < 1 ? "<1" : Math.round(pct)}%`;
        });
}