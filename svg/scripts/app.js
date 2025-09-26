(() => {
  "use strict";

  Squirrel.addEventListener("eventDispatch", (e) => eval(`${e.detail.name}(e)`));
  Squirrel.initWithSquirrel();

  // ---------- Sanitizer with aspect-ratio enforcement ----------
  const HTML_ALLOWED = new Set(["B","STRONG","I","EM","U","BR","SPAN"]);
  const SVG_ALLOWED  = new Set(["SVG","G","RECT","CIRCLE","ELLIPSE","LINE","POLYLINE","POLYGON","PATH","TEXT","TSPAN","DEFS","LINEARGRADIENT","RADIALGRADIENT","STOP"]);
  const SVG_ATTRS = new Set([
    "WIDTH","HEIGHT","VIEWBOX","PRESERVEASPECTRATIO","TRANSFORM","OPACITY",
    "FILL","STROKE","STROKE-WIDTH","STROKE-LINECAP","STROKE-LINEJOIN","STROKE-DASHARRAY","STROKE-DASHOFFSET",
    "X","Y","X1","Y1","X2","Y2","CX","CY","R","RX","RY","DX","DY","POINTS","D",
    "FONT-SIZE","FONT-FAMILY","FONT-WEIGHT","TEXT-ANCHOR","DOMINANT-BASELINE",
    "ROLE","ARIA-LABEL","GRADIENTUNITS","GRADIENTTRANSFORM","SPREADMETHOD","FX","FY","STOP-COLOR","STOP-OPACITY","ID","OFFSET"
  ]);
  const SVG_NS = "http://www.w3.org/2000/svg";

  function parseNumeric(val) {
    if (val == null) return null;
    const m = String(val).match(/^\s*([0-9]*\.?[0-9]+)\s*/);
    return m ? parseFloat(m[1]) : null;
  }

  function sanitizeToFragment(input) {
    const out = document.createDocumentFragment();
    if (input == null) return out;

    const template = document.createElement("template");
    template.innerHTML = String(input);

    function clean(node, inSvg = false) {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue);
      if (node.nodeType !== Node.ELEMENT_NODE) return null;

      const tag = node.tagName.toUpperCase();
      const isSvgRoot = tag === "SVG";
      const nextInSvg = inSvg || isSvgRoot;

      let allow = false, useSvgNS = false;
      if (nextInSvg) { allow = SVG_ALLOWED.has(tag); useSvgNS = true; }
      else           { allow = HTML_ALLOWED.has(tag); }

      const kids = [];
      for (const c of Array.from(node.childNodes)) {
        const k = clean(c, nextInSvg);
        if (k) kids.push(k);
      }

      if (!allow) {
        const frag = document.createDocumentFragment();
        for (const k of kids) frag.appendChild(k);
        return frag;
      }

      const el = useSvgNS ? document.createElementNS(SVG_NS, node.tagName)
                          : document.createElement(tag.toLowerCase());

      let hasWidth=false, hasHeight=false, hasPAR=false, hasVB=false;
      let widthNum=null, heightNum=null;

      for (const a of Array.from(node.attributes || [])) {
        const name = a.name;
        const upper = name.toUpperCase();
        if (useSvgNS) {
          if (upper.startsWith("ON")) continue;
          if (upper.includes("HREF")) {
            const v = String(a.value || "").trim();
            if (!v.startsWith("#")) continue;   // allow only internal fragment refs
          }
          if (!SVG_ATTRS.has(upper)) continue;
          el.setAttribute(name, a.value);
          if (tag === "SVG") {
            if (upper === "WIDTH")  { hasWidth = true;  widthNum = parseNumeric(a.value); }
            if (upper === "HEIGHT") { hasHeight = true; heightNum = parseNumeric(a.value); }
            if (upper === "VIEWBOX") hasVB = true;
            if (upper === "PRESERVEASPECTRATIO") hasPAR = true;
          }
        }
      }

      for (const k of kids) el.appendChild(k);

      if (tag === "SVG") {
        // Ensure responsive box + preserved aspect ratio
        el.style.display = "block";
        if (!hasWidth)  el.setAttribute("width", "100%");
        if (!hasHeight) el.setAttribute("height", "100%");
        if (!hasPAR)    el.setAttribute("preserveAspectRatio", "xMidYMid meet"); // contain (no stretch)

        // If no viewBox was provided, create one from width/height if possible
        if (!hasVB) {
          const w = widthNum || 800;
          const h = heightNum || 450;
          el.setAttribute("viewBox", `0 0 ${w} ${h}`);
        }
      }

      return el;
    }

    for (const n of Array.from(template.content.childNodes)) {
      const cleaned = clean(n, false);
      if (cleaned) out.appendChild(cleaned);
    }
    return out;
  }

  // ---------- App logic (single property: svgCode) ----------
  function processSvgCode(value) {
    const host = document.getElementById("svg_shapeText");
    if (!host) return;

    host.style.width = "100%";
    host.style.height = "100%";
    host.style.display = "block";

    const safe = sanitizeToFragment(value);
    host.replaceChildren(safe);
  }

  function onPropertyChange(e) {
    const name = Squirrel.getGenericProperty(e.detail.property);
    if (name === "svgCode") processSvgCode(e.detail.value);
  }

  function onInitState(e) {
    const s = e.detail.state || {};
    if (s.hasOwnProperty("svgCode")) processSvgCode(s.svgCode);
  }

  function onPropertyChangesComplete() {}
  function onSetCanvas(e) {}
  function onSetRuntimeMode(e) {}
  function onSetSize(e) {}
  function onSetPosition(e) {}
})();