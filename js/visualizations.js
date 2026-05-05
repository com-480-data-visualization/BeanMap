import { state } from './dataService.js';

let timelineUpdateRef = null;

/* ── TIMELINE (D3) ────────────────────────────────────────── */
export function setupTimeline() {
    const xMin = 32, xMax = 230, yearMin = 1986, yearMax = 2024;
    const yBase = 88, yScale = 73, priceMax = 5500;

    // D3 Scales mapping years and prices to exact SVG pixels
    const scaleX = d3.scaleLinear().domain([yearMin, yearMax]).range([xMin, xMax]);
    const scaleY = d3.scaleLinear().domain([0, priceMax]).range([yBase, yBase - yScale]);

    const years = Object.keys(state.data.PRICE_TIMELINE).map(Number).sort((a, b) => a - b);
    const allData = years.map(yr => ({
        yr,
        raw: state.data.PRICE_TIMELINE[yr].raw,
        proc: state.data.PRICE_TIMELINE[yr].processed,
        impRaw: state.data.PRICE_TIMELINE[yr].raw * 1.08,
        impProc: state.data.PRICE_TIMELINE[yr].processed * 1.08,
    }));

    const drawLine = (key) => d3.line().x(d => scaleX(d.yr)).y(d => scaleY(d[key]));
    const drawArea = (key) => d3.area().x(d => scaleX(d.yr)).y0(yBase).y1(d => scaleY(d[key]));

    timelineUpdateRef = function (year) {
        const visibleData = allData.filter(d => d.yr <= year);
        if (visibleData.length === 0) return;

        // Update Area Paths
        d3.select('#timeline-raw-area').attr('d', drawArea('raw')(visibleData));
        d3.select('#timeline-proc-area').attr('d', drawArea('proc')(visibleData));
        d3.select('#timeline-impraw-area').attr('d', drawArea('impRaw')(visibleData));
        d3.select('#timeline-impproc-area').attr('d', drawArea('impProc')(visibleData));

        // Update Line Paths
        d3.select('#timeline-raw').attr('d', drawLine('raw')(visibleData));
        d3.select('#timeline-proc').attr('d', drawLine('proc')(visibleData));
        d3.select('#timeline-impraw').attr('d', drawLine('impRaw')(visibleData));
        d3.select('#timeline-impproc').attr('d', drawLine('impProc')(visibleData));

        // Update Dots
        const dotGroups = [
            { id: '#timeline-dots', key: 'raw', color: '#5C3317' },
            { id: '#timeline-dots-expproc', key: 'proc', color: '#A0522D' },
            { id: '#timeline-dots-impraw', key: 'impRaw', color: '#B8935A' },
            { id: '#timeline-dots-impproc', key: 'impProc', color: '#E8C878' }
        ];

        dotGroups.forEach(g => {
            d3.select(g.id).selectAll('circle')
                .data(visibleData)
                .join('circle')
                .attr('cx', d => scaleX(d.yr))
                .attr('cy', d => scaleY(d[g.key]))
                .attr('r', 1.2)
                .attr('fill', g.color);
        });

        // Update Cursor and Hint
        d3.select('#timeline-cursor').attr('x1', scaleX(year)).attr('x2', scaleX(year));

        const pt = state.data.PRICE_TIMELINE[year] || state.data.PRICE_TIMELINE[2023];
        const hint = document.getElementById('timeline-bar-hint');
        if (hint && pt) {
            hint.textContent = `Country panel bars: volumes × ${year} prices — `
                + `raw ≈ ${(pt.raw / 1000).toFixed(1)}k$/t · roasted ≈ ${(pt.processed / 1000).toFixed(1)}k$/t. `
                + `Bar gradient = raw (dark) → processed (light) share.`;
        }
    };
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