import { state } from './dataService.js';

let timelineUpdateRef = null;

/* ── TIMELINE (D3) ────────────────────────────────────────── */
export function drawPriceChart(priceData) {
    // Select your chart container (adjust the selector as needed for your HTML)
    const svg = d3.select("#price-chart-svg");
    svg.selectAll("*").remove(); // Clear previous renders

    const margin = { top: 20, right: 80, bottom: 30, left: 50 };

    // Fallbacks provided in case bounding client rect is not immediately available
    const width = (svg.node().getBoundingClientRect().width || 600) - margin.left - margin.right;
    const height = (svg.node().getBoundingClientRect().height || 250) - margin.top - margin.bottom;

    const chartGroup = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Format data into an array of objects
    const years = Object.keys(priceData).sort((a, b) => a - b);
    const data = years.map(y => ({
        year: d3.timeParse("%Y")(y),
        yearStr: y,
        raw: priceData[y].raw,
        processed: priceData[y].processed
    })).filter(d => d.raw != null && d.processed != null);

    // X and Y Scales
    const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.year))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.processed) * 1.15]) // 15% headroom for tooltips
        .range([height, 0]);

    // 1. Subtle Horizontal Gridlines (removes the solid Y-axis spine)
    chartGroup.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat("").ticks(5))
        .style("stroke", "#d7ccc8")
        .style("stroke-dasharray", "3,3")
        .style("stroke-opacity", 0.3)
        .call(g => g.select(".domain").remove());

    // 2. The Value-Added Gap (Shaded Area)
    const area = d3.area()
        .curve(d3.curveMonotoneX) // Smooths the jagged edges
        .x(d => x(d.year))
        .y0(d => y(d.raw))
        .y1(d => y(d.processed));

    chartGroup.append("path")
        .datum(data)
        .attr("fill", "#c4a482") // Warm tan to match the map
        .attr("opacity", 0.3)
        .attr("d", area);

    // 3. Smooth Lines
    const lineRaw = d3.line()
        .curve(d3.curveMonotoneX)
        .x(d => x(d.year))
        .y(d => y(d.raw));

    const lineProc = d3.line()
        .curve(d3.curveMonotoneX)
        .x(d => x(d.year))
        .y(d => y(d.processed));

    chartGroup.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#8d6e63") // Light brown for raw
        .attr("stroke-width", 2.5)
        .attr("d", lineRaw);

    chartGroup.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#3e2723") // Dark roast for processed
        .attr("stroke-width", 3)
        .attr("d", lineProc);

    // 4. Clean Axes Formatting
    chartGroup.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5))
        .call(g => g.select(".domain").attr("stroke", "#8d6e63"))
        .call(g => g.selectAll(".tick line").attr("stroke", "#8d6e63"))
        .call(g => g.selectAll("text").attr("fill", "#4e342e").style("font-family", "sans-serif"));

    chartGroup.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => "$" + d.toLocaleString()))
        .call(g => g.select(".domain").remove()) // Hide the vertical spine
        .call(g => g.selectAll(".tick line").remove()) // Hide tick lines
        .call(g => g.selectAll("text").attr("fill", "#4e342e").style("font-weight", "500"));

    // 5. Direct Line Labels (Replaces the clunky legend)
    const lastPoint = data[data.length - 1];

    chartGroup.append("text")
        .attr("x", x(lastPoint.year) + 8)
        .attr("y", y(lastPoint.processed) + 4)
        .attr("fill", "#3e2723")
        .style("font-weight", "bold")
        .style("font-size", "12px")
        .text("Processed");

    chartGroup.append("text")
        .attr("x", x(lastPoint.year) + 8)
        .attr("y", y(lastPoint.raw) + 4)
        .attr("fill", "#8d6e63")
        .style("font-weight", "bold")
        .style("font-size", "12px")
        .text("Raw");

    // 6. Interactive Hover Elements
    const focus = chartGroup.append("g").style("display", "none");

    focus.append("line")
        .attr("class", "hover-line")
        .attr("y1", 0)
        .attr("y2", height)
        .style("stroke", "#3e2723")
        .style("stroke-width", "1px")
        .style("stroke-dasharray", "4,4")
        .style("opacity", 0.5);

    focus.append("circle").attr("class", "dot-raw").attr("r", 4).attr("fill", "#8d6e63").attr("stroke", "#fff").attr("stroke-width", 1.5);
    focus.append("circle").attr("class", "dot-proc").attr("r", 4).attr("fill", "#3e2723").attr("stroke", "#fff").attr("stroke-width", 1.5);

    const tooltip = focus.append("g").attr("class", "tooltip-box");
    tooltip.append("rect")
        .attr("width", 125)
        .attr("height", 55)
        .attr("fill", "#3e2723")
        .attr("rx", 4)
        .attr("opacity", 0.95);

    const tooltipYear = tooltip.append("text").attr("x", 8).attr("y", 16).attr("fill", "#d7ccc8").style("font-size", "10px").style("font-weight", "bold");
    const tooltipProc = tooltip.append("text").attr("x", 8).attr("y", 32).attr("fill", "#fff").style("font-size", "11px");
    const tooltipRaw = tooltip.append("text").attr("x", 8).attr("y", 46).attr("fill", "#fff").style("font-size", "11px");

    // Invisible rect for capturing mouse movements
    chartGroup.append("rect")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("mouseover", () => focus.style("display", null))
        .on("mouseout", () => focus.style("display", "none"))
        .on("mousemove", mousemove);

    const bisectDate = d3.bisector(d => d.year).left;

    function mousemove(event) {
        // d3.pointer works for D3 v6+ (use d3.mouse(this) if using v5 or lower)
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

        // Dynamic tooltip positioning to prevent it from bleeding off the right side
        let tooltipX = cx + 12;
        if (tooltipX + 125 > width) tooltipX = cx - 137;

        // Anchor tooltip above the highest data point (Processed)
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

    // 1. Calculate Core Totals
    const rawProdTotals = {};
    Object.entries(rawSnap).forEach(([rep, row]) => {
        if (processorSet.has(rep)) return;
        const tot = Object.values(row).reduce((s, v) => s + v, 0);
        if (tot > 0) rawProdTotals[rep] = tot;
    });

    const procHubTotals = {};
    Object.entries(procSnap).forEach(([rep, row]) => {
        if (!processorSet.has(rep)) return;
        const tot = Object.values(row).reduce((s, v) => s + v, 0);
        if (tot > 0) procHubTotals[rep] = tot;
    });

    const destTotals = {};
    Object.entries(procSnap).forEach(([rep, row]) => {
        if (!processorSet.has(rep)) return;
        Object.entries(row).forEach(([dest, qty]) => {
            if (!processorSet.has(dest)) destTotals[dest] = (destTotals[dest] || 0) + qty;
        });
    });

    // 2. Identify Top N
    const TOP_N = 5;
    const topProd = Object.entries(rawProdTotals).sort((a, b) => b[1] - a[1]).slice(0, TOP_N);
    const topHub = Object.entries(procHubTotals).sort((a, b) => b[1] - a[1]).slice(0, TOP_N);
    const topDest = Object.entries(destTotals).sort((a, b) => b[1] - a[1]).slice(0, TOP_N);

    const topPKeys = new Set(topProd.map(([k]) => k));
    const topHKeys = new Set(topHub.map(([k]) => k));
    const topDKeys = new Set(topDest.map(([k]) => k));

    const grandProdTotal = Object.values(rawProdTotals).reduce((s, v) => s + v, 0) || 1;
    const grandHubTotal = Object.values(procHubTotals).reduce((s, v) => s + v, 0) || 1;
    const grandDestTotal = Object.values(destTotals).reduce((s, v) => s + v, 0) || 1;

    // 3. Aggregate all flows into D3 Links
    let aggregatedLinks = {};
    function addLink(src, target, val, type) {
        if (val <= 0) return;
        const key = `${src}|${target}|${type}`;
        aggregatedLinks[key] = (aggregatedLinks[key] || 0) + val;
    }

    // P -> H flows
    Object.entries(rawSnap).forEach(([rep, row]) => {
        if (processorSet.has(rep)) return;
        const src = topPKeys.has(rep) ? rep : "Others_P";
        Object.entries(row).forEach(([dest, qty]) => {
            if (!processorSet.has(dest)) return;
            const tgt = topHKeys.has(dest) ? dest : "Others_H";
            addLink(src, tgt, qty, 'PH');
        });
    });

    // H -> D flows
    Object.entries(procSnap).forEach(([rep, row]) => {
        if (!processorSet.has(rep)) return;
        const src = topHKeys.has(rep) ? rep : "Others_H";
        Object.entries(row).forEach(([dest, qty]) => {
            if (processorSet.has(dest)) return;
            const tgt = topDKeys.has(dest) ? dest : "Others_C";
            addLink(src, tgt, qty, 'HD');
        });
    });

    // Convert to D3 Format
    const linksData = Object.entries(aggregatedLinks).map(([key, value]) => {
        const [source, target, type] = key.split('|');
        return { source, target, value, type };
    });

    if (linksData.length === 0) {
        d3.select("#sankey-svg").selectAll("*").remove();
        return;
    }

    // Define Nodes
    const nodeNames = new Set();
    linksData.forEach(l => { nodeNames.add(l.source); nodeNames.add(l.target); });

    const nodesData = Array.from(nodeNames).map(name => {
        let realName = name, category = "";
        if (name.endsWith("_P")) { realName = "Others"; category = "Producer"; }
        else if (name.endsWith("_H")) { realName = "Others"; category = "Hub"; }
        else if (name.endsWith("_C")) { realName = "Others"; category = "Consumer"; }
        else if (topPKeys.has(name)) category = "Producer";
        else if (topHKeys.has(name)) category = "Hub";
        else category = "Consumer";
        return { id: name, name: realName, category };
    });

    // 4. Run D3 Sankey
    const sankey = d3.sankey()
        .nodeId(d => d.id)
        .nodeWidth(12)
        .nodePadding(4)
        .nodeSort((a, b) => {
            // Keep "Others" at the bottom of each column
            if (a.name === "Others") return 1;
            if (b.name === "Others") return -1;
            return b.value - a.value;
        })
        .extent([[6, 10], [364, 100]]);

    const graph = sankey({ nodes: nodesData, links: linksData });

    // 5. Drawing using D3
    const svg = d3.select("#sankey-svg");
    svg.selectAll("*").remove();

    // Colors mapping matches original arrays
    const PROD_COLORS = ['#3D2010', '#5C3820', '#7A4C2A', '#8B5E3C', '#9B6E4C'];
    const HUB_COLORS = ['#5C4400', '#7A5C00', '#987800', '#B09010', '#C4A820'];
    const DEST_COLORS = ['#5C3020', '#7A4030', '#984A38', '#A85A44', '#B86A54'];
    const FLOW_PH = ['rgba(61,32,16,0.42)', 'rgba(92,56,32,0.38)', 'rgba(122,76,42,0.34)', 'rgba(139,94,60,0.30)', 'rgba(155,110,76,0.26)'];
    const FLOW_HD = ['rgba(92,68,0,0.44)', 'rgba(122,92,0,0.40)', 'rgba(152,120,0,0.36)', 'rgba(176,144,16,0.32)', 'rgba(196,168,32,0.28)'];

    // Draw Links
    svg.append("g")
        .attr("fill", "none")
        .selectAll("path")
        .data(graph.links)
        .join("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => {
            if (d.source.name === "Others") return "rgba(153, 153, 153, 0.25)";
            if (d.type === "PH") {
                const idx = topProd.findIndex(x => x[0] === d.source.name);
                return FLOW_PH[Math.max(0, idx)] || FLOW_PH[0];
            } else {
                const idx = topHub.findIndex(x => x[0] === d.source.name);
                return FLOW_HD[Math.max(0, idx)] || FLOW_HD[0];
            }
        })
        .attr("stroke-width", d => Math.max(1, d.width));

    // Draw Nodes
    svg.append("g")
        .selectAll("rect")
        .data(graph.nodes)
        .join("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("rx", 1.5)
        .attr("fill", d => {
            if (d.name === "Others") return "#999";
            if (d.category === "Producer") return PROD_COLORS[topProd.findIndex(x => x[0] === d.name)] || "#3D2010";
            if (d.category === "Hub") return HUB_COLORS[topHub.findIndex(x => x[0] === d.name)] || "#5C4400";
            return DEST_COLORS[topDest.findIndex(x => x[0] === d.name)] || "#5C3020";
        });

    // Draw Column Headers
    const headers = [
        { x: 6, anchor: 'start', txt: 'Producers' },
        { x: 177, anchor: 'middle', txt: 'Processors' },
        { x: 364, anchor: 'end', txt: 'Consumers' }
    ];

    svg.append("g")
        .selectAll("text")
        .data(headers)
        .join("text")
        .attr("x", d => d.x)
        .attr("y", 7)
        .attr("font-size", "5px")
        .attr("fill", "#5C3820")
        .attr("font-weight", "600")
        .attr("text-anchor", d => d.anchor)
        .text(d => d.txt);

    // Draw Node Labels
    svg.append("g")
        .style("font-size", "4.5px")
        .style("font-weight", "600")
        .selectAll("text")
        .data(graph.nodes)
        .join("text")
        .attr("x", d => d.x1 + 2)
        .attr("y", d => {
            // Ensure small labels don't get hidden behind links
            const mid = (d.y1 + d.y0) / 2;
            return (d.y1 - d.y0) < 3 ? (d.y0 + 3) : mid;
        })
        .attr("fill", d => {
            if (d.name === "Others") return "#999";
            if (d.category === "Producer") return PROD_COLORS[topProd.findIndex(x => x[0] === d.name)] || "#3D2010";
            if (d.category === "Hub") return HUB_COLORS[topHub.findIndex(x => x[0] === d.name)] || "#5C4400";
            return DEST_COLORS[topDest.findIndex(x => x[0] === d.name)] || "#5C3020";
        })
        .text(d => {
            if ((d.y1 - d.y0) < 0.5) return ""; // Hide text for tiny slivers
            let pct = 0;
            if (d.category === "Producer") pct = Math.round((d.value / grandProdTotal) * 100);
            else if (d.category === "Hub") pct = Math.round((d.value / grandHubTotal) * 100);
            else pct = Math.round((d.value / grandDestTotal) * 100);
            return `${d.name} ${pct}%`;
        });
}