(() => {
  "use strict";

  Squirrel.addEventListener('eventDispatch', (e) => {
    const name = e.detail.name;
    if (typeof window[name] === 'function') window[name](e);
  });
  Squirrel.initWithSquirrel();

  let state = {
    value: 56,
    direction: 'bottom-up',
    filledColor: '#0197FF',
    emptyColor: '#e5e7eb',
    cornerRadius: 0,
    outerSpacing: 0,
    boxGap: 2,
    interactive: true,
    buildVersion: 'v13'
  };

  let runtimeMode = Squirrel.getRuntimeMode ? Squirrel.getRuntimeMode() : 'DESIGN'; // 'DESIGN' or 'RUN'

  const root = () => document.getElementById('chart');
  const clamp = (n, min, max) => Math.max(min, Math.min(max, +n || 0));
  const isHex = c => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test((c||'').trim());
  const px = n => Math.max(0, Number.isFinite(+n)?+n:0);

  function getOrderIndices(dir){
    const rows=10, cols=10, indices=[];
    const rowSeq=(String(dir).toLowerCase()==='top-down')?[...Array(rows).keys()]:[...Array(rows).keys()].reverse();
    for(const r of rowSeq){for(let c=0;c<cols;c++){indices.push(r*cols+c);}}
    return indices;
  }

  function sizeChart(w,h,outer,gap){
    const rows=10, cols=10;
    const availW = Math.max(0, w - 2*outer);
    const availH = Math.max(0, h - 2*outer);
    const side = Math.min(availW, availH);
    const cell = Math.floor(Math.max(1, (side - gap*(cols-1)) / cols));
    const gridW = cell*cols + gap*(cols-1);
    const gridH = cell*rows + gap*(rows-1);
    const offsetX = Math.floor((w - gridW) / 2);
    const offsetY = Math.floor((h - gridH) / 2);
    return { size: cell, gap, offsetX, offsetY };
  }

  function render(){
    const el=root(); if(!el)return;
    const sz=Squirrel.getSize?.()||{width:el.clientWidth,height:el.clientHeight};
    const w=Math.max(40,sz.width||300),h=Math.max(40,sz.height||200);

    const value=clamp(state.value,0,100);
    const dir=(String(state.direction).toLowerCase()==='top-down')?'top-down':'bottom-up';
    const filled=isHex(state.filledColor)?state.filledColor:'#0197FF';
    const empty=isHex(state.emptyColor)?state.emptyColor:'#e5e7eb';
    const radius=px(state.cornerRadius);
    const outer=px(state.outerSpacing);
    const gap=px(state.boxGap);

    const rows=10, cols=10;
    const dims=sizeChart(w,h,outer,gap);
    const order=getOrderIndices(dir);
    const filledSet=new Set(order.slice(0,value));

    let svg=`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>`;
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const idx=r*cols+c;
        const x=dims.offsetX + c*(dims.size + dims.gap);
        const y=dims.offsetY + r*(dims.size + dims.gap);
        const col=filledSet.has(idx)?filled:empty;
        svg+=`<rect data-idx='${idx}' x='${x}' y='${y}' width='${dims.size}' height='${dims.size}' rx='${radius}' ry='${radius}' fill='${col}' />`;
      }
    }
    svg+='</svg>';
    el.innerHTML=svg;

    const svgEl=el.querySelector('svg');
    if(svgEl){
      // Always remove existing listener by replacing the element's outerHTML? Instead, we bind fresh each render.
      svgEl.addEventListener('click',evt=>{
        if(!(state.interactive && runtimeMode==='RUN')) return; // disable interaction if off or not running
        const t=evt.target;
        if(t && t.tagName==='rect' && t.hasAttribute('data-idx')){
          const idx=+t.getAttribute('data-idx');
          const order=getOrderIndices(dir); // recompute for safety
          const nv=clamp(order.indexOf(idx)+1,0,100);
          state.value=nv;
          Squirrel.sendToSquirrel('value',nv,true);
          render();
        }
      });
    }
  }

  // --- Squirrel lifecycle handlers ---
  window.onInitState=e=>{ state=Object.assign({},state,e.detail.state||{}); render(); };
  // Render immediately on every property change so Design mode reflects updates without waiting
  window.onPropertyChange=e=>{
    const p=Squirrel.getGenericProperty(e.detail.property),v=e.detail.value;
    if(p==='value') state.value=v;
    else if(p==='direction') state.direction=String(v).toLowerCase();
    else if(p==='filledColor') state.filledColor=v;
    else if(p==='emptyColor') state.emptyColor=v;
    else if(p==='cornerRadius') state.cornerRadius=v;
    else if(p==='outerSpacing') state.outerSpacing=v;
    else if(p==='boxGap') state.boxGap=v;
    else if(p==='interactive') state.interactive=!!v;
    render(); // immediate
  };
  window.onPropertyChangesComplete=render;
  window.onSetSize=render;
  window.onSetCanvas=()=>{};
  window.onSetPosition=()=>{};
  window.onSetRuntimeMode=e=>{ runtimeMode = e.detail?.mode || runtimeMode; render(); };

})();