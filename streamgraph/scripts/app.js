(() => {
  "use strict";

  Squirrel.addEventListener("eventDispatch", (e) => eval(`${e.detail.name}(e)`));
  Squirrel.initWithSquirrel();

  const tip = () => document.getElementById("tooltip");
  const host = () => document.getElementById("chart");

  const DEFAULT_COLORS = ["#9FDB67","#42BE95","#70E6E0","#114FA2","#FFDE48","#0197FF","#6AD1F0","#7C8CFF","#B388FF"];

  // Date parsing: multiple formats + Excel serial
  const parsePatterns = [
    d3.utcParse("%Y-%m-%d"),
    d3.utcParse("%m/%d/%Y"),
    d3.utcParse("%d/%m/%Y"),
    d3.utcParse("%Y/%m/%d"),
    d3.utcParse("%b %d, %Y"),
    d3.utcParse("%d %b %Y")
  ];
  function parseDateFlexible(v) {
    if (v == null) return null;
    if (typeof v === "number" || (/^\d+(\.\d+)?$/.test(String(v).trim()))) {
      const n = Number(v);
      if (Number.isFinite(n)) {
        const ms = (n - 25569) * 86400 * 1000; // Excel serial days -> ms
        const d = new Date(ms);
        return isNaN(+d) ? null : d;
      }
    }
    const s = String(v).trim();
    for (const p of parsePatterns) {
      const d = p(s);
      if (d && !isNaN(+d)) return d;
    }
    const d2 = new Date(s);
    return isNaN(+d2) ? null : d2;
  }

  function truthy(v, fallback=false) {
    if (typeof v === "boolean") return v;
    if (v == null) return fallback;
    const s = String(v).trim().toLowerCase();
    if (["true","1","yes","y","on"].includes(s)) return true;
    if (["false","0","no","n","off"].includes(s)) return false;
    return fallback;
  }
  function toNumber(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function parseColorsFromText(t) {
    if (!t) return [];
    const parts = String(t).split(/[,\n\r\s]+/).filter(Boolean);
    const out = [];
    for (const p of parts) {
      const hex = p.trim();
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) out.push(hex);
    }
    return out;
  }
  function resolveColors() {
    const fromText = parseColorsFromText(state.colorsText);
    if (fromText.length) return fromText;
    return DEFAULT_COLORS.slice();
  }

  function curveFromName(name) {
    switch (String(name||"").toLowerCase()) {
      case "basis": return d3.curveBasis;
      case "natural": return d3.curveNatural;
      case "linear": return d3.curveLinear;
      case "catmullrom":
      default: return d3.curveCatmullRom.alpha(0.5);
    }
  }
  function offsetFromName(name) {
    switch (String(name||"").toLowerCase()) {
      case "silhouette": return d3.stackOffsetSilhouette;
      case "expand": return d3.stackOffsetExpand;
      case "none": return d3.stackOffsetNone;
      case "wiggle":
      default: return d3.stackOffsetWiggle;
    }
  }
  function orderFromName(name) {
    switch (String(name||"").toLowerCase()) {
      case "ascending": return d3.stackOrderAscending;
      case "descending": return d3.stackOrderDescending;
      case "none": return d3.stackOrderNone;
      case "insideout":
      default: return d3.stackOrderInsideOut;
    }
  }

  function parseTable(arr) {
    const rows = [];
    if (!Array.isArray(arr) || !arr.length) return rows;
    for (let r=0; r<arr.length; r++) {
      const row = arr[r];
      if (!Array.isArray(row) || row.length < 3) continue;
      const d = parseDateFlexible(row[0]);
      const s = (row[1] == null ? "" : String(row[1]));
      const v = Number(row[2]);
      if (d && s) rows.push({ date: d, series: s, value: Number.isFinite(v) ? v : 0 });
    }
    return rows;
  }

  function demoData() {
    const series = ["Alpha","Bravo","Charlie","Delta","Echo","Foxtrot","Golf"];
    const start = new Date(Date.UTC(2023,0,1));
    const points = 48;
    const rows = [];
    for (let i=0;i<points;i++) {
      const d = new Date(start.getTime()); d.setUTCDate(d.getUTCDate() + i*7);
      for (const s of series) {
        const base = 30 + 20*Math.sin(i/4 + (s.charCodeAt(0)%7)/10);
        const noise = Math.max(0, base + (Math.random()*14 - 7));
        rows.push({date: d, series: s, value: Math.round(noise)});
      }
    }
    return rows;
  }

  const state = {
    scheme: "tableau10",
    curve: "catmullRom",
    offset: "wiggle",
    order: "insideOut",
    showXAxis: true,
    showYAxis: true,
    showLabels: false,
    axisXColor: "#4B5563",
    axisYColor: "#4B5563",
    colorsText: DEFAULT_COLORS.join(","),
    labelScale: false,
    labelMinFont: 10,
    labelMaxFont: 24,
    data: []
  };

  let svg, g, xAxisG, yAxisG, areaG, labelG;
  function ensureScaffold() {
    const sel = d3.select(host()).selectAll("svg").data([null]).join("svg");
    const root = sel.selectAll("g.root").data([null]).join("g").attr("class","root");
    const xG = root.selectAll("g.axis.x").data([null]).join("g").attr("class","axis x");
    const yG = root.selectAll("g.axis.y").data([null]).join("g").attr("class","axis y");
    const aG = root.selectAll("g.areas").data([null]).join("g").attr("class","areas");
    const lG = root.selectAll("g.labels").data([null]).join("g").attr("class","labels");
    svg = sel; g = root; xAxisG = xG; yAxisG = yG; areaG = aG; labelG = lG;
  }

  function render() {
    ensureScaffold();

    const rect = host().getBoundingClientRect();
    const width = Math.max(320, rect.width || 0);
    const height = Math.max(300, rect.height || 0);
    svg.attr("width", width).attr("height", height);

    const margin = {top:22,right:22,bottom:36,left:46};
    const innerW = Math.max(10, width - margin.left - margin.right);
    const innerH = Math.max(10, height - margin.top - margin.bottom);
    g.attr("transform", `translate(${margin.left},${margin.top})`);

    const keys = Array.from(new Set(state.data.map(d=>d.series))).sort();
    const byTs = d3.rollup(
      state.data,
      v => { const o = {}; for (const r of v) o[r.series] = (o[r.series]??0) + (Number.isFinite(r.value)?r.value:0); return o; },
      d => +d.date
    );
    const dates = Array.from(byTs.keys()).sort((a,b)=>a-b);
    const rows = dates.map(ts => {
      const d = new Date(ts), obj = byTs.get(ts) || {}; const row = {date:d};
      for (const k of keys) row[k] = obj[k] ?? 0;
      return row;
    });

    const x = d3.scaleUtc().domain(d3.extent(rows, d=>d.date)).range([0, innerW]);
    const stack = d3.stack().keys(keys)
      .offset(offsetFromName(state.offset))
      .order(orderFromName(state.order));
    const series = stack(rows);

    let ymin = d3.min(series, s => d3.min(s, d => d[0]));
    let ymax = d3.max(series, s => d3.max(s, d => d[1]));
    if (!(Number.isFinite(ymin)&&Number.isFinite(ymax))) { ymin = -1; ymax = 1; }
    if (ymax - ymin === 0) { ymax += 1; ymin -= 1; }
    const y = d3.scaleLinear().domain([ymin, ymax]).range([innerH, 0]).nice();

    const area = d3.area().x(d => x(d.data.date)).y0(d => y(d[0])).y1(d => y(d[1])).curve(curveFromName(state.curve));

    const palette = resolveColors();
    const color = d3.scaleOrdinal().domain(keys).range(palette);

    const xAxis = d3.axisBottom(x).ticks(Math.min(10, rows.length)).tickPadding(6);
    const yAxis = d3.axisLeft(y).ticks(5).tickPadding(6);

    xAxisG.attr("transform", `translate(0,${innerH})`);
    if (state.showXAxis) {
      xAxisG.style("display", null).call(xAxis);
      xAxisG.selectAll("text").attr("fill", state.axisXColor || "#4B5563");
    } else {
      xAxisG.style("display", "none");
    }

    if (state.showYAxis) {
      yAxisG.style("display", null).call(yAxis);
      yAxisG.selectAll("text").attr("fill", state.axisYColor || "#4B5563");
    } else {
      yAxisG.style("display", "none");
    }

    const layers = areaG.selectAll("path.layer").data(series, d=>d.key);
    layers.enter().append("path")
      .attr("class","layer")
      .attr("fill", d => color(d.key))
      .attr("d", area)
      .on("mousemove", (event, d) => {
        const [mx] = d3.pointer(event);
        const date = x.invert(mx);
        const t = tip(); t.style.opacity = 1;
        t.innerHTML = `<strong>${d.key}</strong><br>${d3.utcFormat("%b %d, %Y")(date)}`;
        t.style.left = event.clientX + "px";
        t.style.top = event.clientY + "px";
        d3.selectAll(".layer").classed("faded", p => p !== d);
      })
      .on("mouseleave", () => {
        const t = tip(); t.style.opacity = 0;
        d3.selectAll(".layer").classed("faded", false);
      })
      .merge(layers)
      .attr("fill", d => color(d.key))
      .attr("d", area);
    layers.exit().remove();

    labelG.selectAll("*").remove();
    if (truthy(state.showLabels,false)) {
      const minPxHeight = 14;
      const labels = [];
      series.forEach(s => {
        let idx=-1, bestH=0;
        s.forEach((d,i)=>{
          const h = Math.abs(y(d[0]) - y(d[1]));
          if (h>bestH) { bestH=h; idx=i; }
        });
        if (idx>=0 && bestH>=minPxHeight) {
          const d = s[idx];
          const xPos = x(d.data.date);
          const yPos = (y(d[0]) + y(d[1])) / 2;
          let fontPx = toNumber(state.labelMinFont, 10);
          if (truthy(state.labelScale,false)) {
            const min = toNumber(state.labelMinFont, 10);
            const max = toNumber(state.labelMaxFont, 24);
            const t = Math.max(0, Math.min(1, (bestH - minPxHeight) / (innerH/2 - minPxHeight)));
            fontPx = Math.round(min + t * (max - min));
          }
          labels.push({key:s.key, x:xPos, y:yPos, fontPx});
        }
      });
      labelG.selectAll("text.label")
        .data(labels, d=>d.key)
        .enter().append("text")
        .attr("class","label")
        .attr("x", d=>d.x)
        .attr("y", d=>d.y)
        .style("font-size", d=>`${d.fontPx}px`)
        .text(d=>d.key);
    }
  }

  // ------- Squirrel handlers -------
  function onInitState(e) {
    applyState(e.detail.state || {});
    renderOrFallback();
  }
  function onPropertyChange(e) {
    const prop = e.detail.property.split('.').pop();
    const val = e.detail.value;
    setOne(prop, val);
    renderOrFallback();
  }
  function onPropertyChangesComplete() { renderOrFallback(); }
  function onSetSize() { renderOrFallback(); }

  function setOne(prop, val) {
    switch (prop) {
      case "scheme": state.scheme = String(val||"tableau10"); break;
      case "curve": state.curve = String(val||"catmullRom"); break;
      case "offset": state.offset = String(val||"wiggle"); break;
      case "order": state.order = String(val||"insideOut"); break;
      case "showXAxis": state.showXAxis = truthy(val,true); break;
      case "showYAxis": state.showYAxis = truthy(val,true); break;
      case "showLabels": state.showLabels = truthy(val,false); break;
      case "axisXColor": state.axisXColor = String(val||"#4B5563"); break;
      case "axisYColor": state.axisYColor = String(val||"#4B5563"); break;
      case "colorsText": state.colorsText = String(val||""); break;
      case "labelScale": state.labelScale = truthy(val,false); break;
      case "labelMinFont": state.labelMinFont = toNumber(val, 10); break;
      case "labelMaxFont": state.labelMaxFont = toNumber(val, 24); break;
      case "dataRange": state.data = parseTable(val); break;
    }
  }
  function applyState(s) {
    setOne("scheme", s.scheme);
    setOne("curve", s.curve);
    setOne("offset", s.offset);
    setOne("order", s.order);
    setOne("showXAxis", s.showXAxis);
    setOne("showYAxis", s.showYAxis);
    setOne("showLabels", s.showLabels);
    setOne("axisXColor", s.axisXColor);
    setOne("axisYColor", s.axisYColor);
    setOne("colorsText", s.colorsText);
    setOne("labelScale", s.labelScale);
    setOne("labelMinFont", s.labelMinFont);
    setOne("labelMaxFont", s.labelMaxFont);
    setOne("dataRange", s.dataRange);
  }

  function renderOrFallback() {
    if (!state.data || !state.data.length) {
      state.data = demoData();
    }
    render();
  }
})();