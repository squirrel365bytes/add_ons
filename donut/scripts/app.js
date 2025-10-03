
(() => {
  "use strict";

  Squirrel.addEventListener('eventDispatch', (e) => {
    const name = e.detail.name;
    if (typeof window[name] === 'function') window[name](e);
  });
  Squirrel.initWithSquirrel();

  let state = {
    dataRange: [["Alpha", 50], ["Beta", 25], ["Gamma", 15], ["Delta", 10]],
    colorRange: [
      ["#9FDB67"],
      ["#42BE95"],
      ["#70E6E0"],
      ["#114FA2"],
      ["#FFDE48"]
    ],
    selectedSeries: "",
    hoverSeries: "",
    style: "full",
    innerHoleSize: 0.62,
    showTooltips: true,
    showBorder: true,
    borderColor: "#FFFFFF",
    borderWidth: 2,
    showNeedle: false,
    needleStyle: "simple", // simple | classic
    needleValue: 0,
    needleMode: "raw", // raw | percent
    needleColor: "#111111",
    simpleNeedleWidth: 14,   // px
    simpleNeedleLength: 0.8, // fraction of radius
    buildVersion: "v27"
  };

  const root = () => document.getElementById('chart');
  const truthy = new Set(['true','1','yes','on','y','t']);
  const toBool = v => (v === true) || (v === 1) || truthy.has(String(v).trim().toLowerCase());
  const clamp = (n,min,max)=> Math.max(min, Math.min(max, Number.isFinite(+n)?+n:0));
  const isHex = c => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test((c||'').trim());

  function getStyleConfig(style){
    const s = String(style||'full').toLowerCase();
    if (s === 'top-half')   return { start: Math.PI,       span: Math.PI };
    if (s === 'bottom-half')return { start: 0,             span: Math.PI };
    return { start: -Math.PI/2, span: Math.PI*2 };
  }

  function arcPath(cx, cy, R, r, a0, a1){
    const large = (Math.abs(a1 - a0) >= Math.PI) ? 1 : 0;
    const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
    const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    const x2 = cx + r * Math.cos(a1), y2 = cy + r * Math.sin(a1);
    const x3 = cx + r * Math.cos(a0), y3 = cy + r * Math.sin(a0);
    return `M ${x0},${y0} A ${R},${R} 0 ${large} 1 ${x1},${y1} L ${x2},${y2} A ${r},${r} 0 ${large} 0 ${x3},${y3} Z`;
  }

  function coerceData(raw){
    if (!Array.isArray(raw)) return [];
    const rows = raw.map(r => Array.isArray(r) ? r : [r]);
    const cleaned = rows.filter(r => r.length >= 2);
    const startIdx = (cleaned.length && isNaN(parseFloat(cleaned[0][1]))) ? 1 : 0;
    return cleaned.slice(startIdx).map(r => [String(r[0] ?? ''), +r[1] || 0]).filter(d => d[1] > 0);
  }

  function coerceColors(raw){
    if (!Array.isArray(raw)) return [];
    return raw.map(r => Array.isArray(r) ? r[0] : r).map(v => (isHex(String(v).trim()) ? String(v).trim() : null)).filter(Boolean);
  }

  function percentFromNeedle(value, mode, total){
    const m = String(mode||'raw').toLowerCase();
    if (m === 'percent' || m === 'percentage' || m === '%') {
      const p = clamp(value, 0, 100);
      return p / 100;
    }
    const v = clamp(value, 0, Math.max(total, 0.00001));
    return total ? (v / total) : 0;
  }

  function render(){
    const el=root(); if(!el) return;
    const sz=Squirrel.getSize?.()||{width:el.clientWidth,height:el.clientHeight};
    const w=Math.max(40,sz.width||300), h=Math.max(40,sz.height||200);

    const {start, span} = getStyleConfig(state.style);
    const cx=w/2, cy=h/2;
    const R = Math.min(w,h) * 0.48;
    const holeRatio = (state.innerHoleSize === "" || state.innerHoleSize === null || isNaN(+state.innerHoleSize))
      ? 0.62 : Math.max(0.2, Math.min(0.9, +state.innerHoleSize));
    const r = R * holeRatio;

    const data = coerceData(state.dataRange);
    const total = data.reduce((s,d)=>s+d[1],0) || 1;

    const colors = coerceColors(state.colorRange);
    const showTips   = toBool(state.showTooltips);
    const showBorder = toBool(state.showBorder);
    const borderCol  = isHex(state.borderColor) ? state.borderColor : '#FFFFFF';
    const borderW    = clamp(state.borderWidth, 0, 6);

    let svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>`;
    let angle = start;

    // slices
    data.forEach((d,i)=>{
      const frac = d[1] / total;
      const slice = span * frac;
      const a1 = angle + slice;
      const color = colors.length ? colors[i % colors.length] : '#0197FF';
      const path = arcPath(cx, cy, R, r, angle, a1);
      const strokeAttrs = (showBorder && borderW>0) ? ` stroke='${borderCol}' stroke-width='${borderW}'` : '';
      const titleTag = (showTips) ? `<title>${d[0]}: ${d[1]}</title>` : '';
      const nameAttr = ` data-name="${String(d[0]).replace(/"/g,'&quot;')}"`;
      svg += `<path d="${path}" fill="${color}"${strokeAttrs}${nameAttr}>${titleTag}</path>`;
      angle = a1;
    });

    // needle (seamless with hub)
    if (toBool(state.showNeedle)) {
      const frac = percentFromNeedle(+state.needleValue || 0, state.needleMode, total);
      const theta = start + span * frac;
      const color = isHex(state.needleColor) ? state.needleColor : '#111111';

      if (String(state.needleStyle).toLowerCase() === 'classic') {
        const outer = R * 0.97;
        const hubR = Math.max(2, R * 0.05);
        const baseR = hubR * 0.4;
        const halfW = Math.max(2, R * 0.02);
        const xTip = cx + outer * Math.cos(theta);
        const yTip = cy + outer * Math.sin(theta);
        const xBase = cx + baseR * Math.cos(theta);
        const yBase = cy + baseR * Math.sin(theta);
        const xL = xBase + halfW * Math.cos(theta + Math.PI/2);
        const yL = yBase + halfW * Math.sin(theta + Math.PI/2);
        const xR = xBase + halfW * Math.cos(theta - Math.PI/2);
        const yR = yBase + halfW * Math.sin(theta - Math.PI/2);
        svg += `<polygon points="${xTip},${yTip} ${xL},${yL} ${xR},${yR}" fill="${color}" />`;
        svg += `<circle cx="${cx}" cy="${cy}" r="${hubR}" fill="${color}" />`;
      } else {
        const hubR = Math.max(2, R * 0.045);
        const baseR = hubR * 0.6;
        const length = (state.simpleNeedleLength === "" || state.simpleNeedleLength === null || isNaN(+state.simpleNeedleLength)) ? 0.8 : Math.max(0.5, Math.min(1.1, +state.simpleNeedleLength));
        const outer = R * length;
        let halfW;
        if (state.simpleNeedleWidth === "" || state.simpleNeedleWidth === null || isNaN(+state.simpleNeedleWidth)) {
          halfW = (Math.max(1, Math.min(10, 14))) / 2; // default 14px -> 7
        } else {
          const widthPx = Math.max(1, Math.min(10, +state.simpleNeedleWidth));
          halfW = widthPx / 2;
        }
        const xTip = cx + outer * Math.cos(theta);
        const yTip = cy + outer * Math.sin(theta);
        const xBase = cx + baseR * Math.cos(theta);
        const yBase = cy + baseR * Math.sin(theta);
        const xL = xBase + halfW * Math.cos(theta + Math.PI/2);
        const yL = yBase + halfW * Math.sin(theta + Math.PI/2);
        const xR = xBase + halfW * Math.cos(theta - Math.PI/2);
        const yR = yBase + halfW * Math.sin(theta - Math.PI/2);
        svg += `<polygon points="${xTip},${yTip} ${xL},${yL} ${xR},${yR}" fill="${color}" />`;
        svg += `<circle cx="${cx}" cy="${cy}" r="${hubR}" fill="${color}" />`;
      }
    }

    svg += `</svg>`;
    el.innerHTML = svg;

    const svgEl = el.querySelector('svg');
    if (!svgEl) return;

    // hover -> hoverSeries
    let lastHover = null;
    svgEl.addEventListener('mousemove', (evt) => {
      const t = evt.target;
      const name = (t && t.tagName === 'path' && t.dataset) ? t.dataset.name || "" : "";
      if (name !== lastHover) {
        lastHover = name;
        state.hoverSeries = name;
        Squirrel.sendToSquirrel('hoverSeries', name, true);
      }
    });
    svgEl.addEventListener('mouseleave', () => {
      if (lastHover !== "") {
        lastHover = "";
        state.hoverSeries = "";
        Squirrel.sendToSquirrel('hoverSeries', "", true);
      }
    });

    // click -> selectedSeries
    svgEl.addEventListener('click', (evt) => {
      const t = evt.target;
      if (t && t.tagName === 'path' && t.dataset && t.dataset.name) {
        const name = t.dataset.name;
        state.selectedSeries = name;
        Squirrel.sendToSquirrel('selectedSeries', name, true);
      }
    });
  }

  // lifecycle
  window.onInitState=e=>{ state=Object.assign({},state,e.detail.state||{}); render(); };
  window.onPropertyChange=e=>{
    const p=Squirrel.getGenericProperty(e.detail.property), v=e.detail.value;
    if(p==='dataRange') state.dataRange=v;
    else if(p==='colorRange') state.colorRange=v;
    else if(p==='selectedSeries') state.selectedSeries=v;
    else if(p==='hoverSeries') state.hoverSeries=v;
    else if(p==='style') state.style=v;
    else if(p==='innerHoleSize') state.innerHoleSize=v;
    else if(p==='showTooltips') state.showTooltips=v;
    else if(p==='showBorder') state.showBorder=v;
    else if(p==='borderColor') state.borderColor=v;
    else if(p==='borderWidth') state.borderWidth=v;
    else if(p==='showNeedle') state.showNeedle=v;
    else if(p==='needleStyle') state.needleStyle=v;
    else if(p==='needleValue') state.needleValue=v;
    else if(p==='needleMode') state.needleMode=v;
    else if(p==='needleColor') state.needleColor=v;
    else if(p==='simpleNeedleWidth') state.simpleNeedleWidth=v;
    else if(p==='simpleNeedleLength') state.simpleNeedleLength=v;
    render();
  };
  window.onPropertyChangesComplete=render;
  window.onSetSize=render;
  window.onSetCanvas=()=>{};
  window.onSetPosition=()=>{};
  window.onSetRuntimeMode=e=>{ render(); };

})();
