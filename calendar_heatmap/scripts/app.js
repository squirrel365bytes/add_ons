(() => {
  "use strict";
  Squirrel.addEventListener("eventDispatch", (e) => eval(`${e.detail.name}(e)`));
  Squirrel.initWithSquirrel();
  const NS = "http://www.w3.org/2000/svg";
  const clamp01=(x)=>Math.max(0,Math.min(1,x));
  const parseHex=(h)=>{const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h||"#000000");return m?{r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16)}:{r:0,g:0,b:0};};
  const toHex=(c)=>c.toString(16).padStart(2,'0');
  const lerp=(a,b,t)=>a+(b-a)*t;
  const mixHex=(a,b,t)=>{const A=parseHex(a),B=parseHex(b);return "#"+toHex(Math.round(lerp(A.r,B.r,t)))+toHex(Math.round(lerp(A.g,B.g,t)))+toHex(Math.round(lerp(A.b,B.b,t)));};
  const extent=(arr)=>{let lo=Infinity,hi=-Infinity;for(const v of arr){if(v!=null&&!isNaN(v)){if(v<lo)lo=v;if(v>hi)hi=v;}}if(lo===Infinity){lo=0;hi=0;}return [lo,hi];};
  const quantize5=(v,lo,hi)=>{if(lo===hi)return 2;const t=Math.max(0,Math.min(1,(v-lo)/(hi-lo)));return Math.min(4,Math.max(0,Math.floor(t*5)));};
  const yyyymmdd=(d)=>d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,'0')+"-"+String(d.getUTCDate()).padStart(2,'0');
  const startOfWeek=(d)=>{const nd=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));const day=nd.getUTCDay();const diff=(day===0?-6:1-day);nd.setUTCDate(nd.getUTCDate()+diff);return nd;};
  const endOfWeek=(d)=>{const s=startOfWeek(d);s.setUTCDate(s.getUTCDate()+6);return s;};
  const excelSerialToUTC=(n)=>new Date(Date.UTC(1899,11,30)+n*86400000);
  const parseDateAny=(raw)=>{if(raw==null)return null; if(raw instanceof Date)return new Date(Date.UTC(raw.getUTCFullYear(),raw.getUTCMonth(),raw.getUTCDate())); if(typeof raw==='number'&&isFinite(raw)){const d=excelSerialToUTC(raw);return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));} const d=new Date(raw); if(!isNaN(d))return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())); return null;};
  const parseNumberAny=(raw)=>{ if(typeof raw==='number'&&isFinite(raw))return raw; if(typeof raw==='string'){ const t=raw.trim(); if(t==='') return NaN; const cleaned=t.replace(/[^0-9eE+\-\.]/g,''); const n=parseFloat(cleaned); return (isFinite(n)?n:NaN);} return NaN; };
  let _state={},_dataRows=[];

  const getColors=()=>({minC:_state.minColorPicker||"#e5e7eb",maxC:_state.maxColorPicker||"#0197FF",emptyC:_state.unfilledColorPicker||"#f3f4f6"});

  const parseDataRange=(range)=>{
    const out=[];
    if(Array.isArray(range)){
      for(const r of range){
        if(!Array.isArray(r)||r.length<2) continue;
        const d=parseDateAny(r[0]);
        const v=parseNumberAny(r[1]);
        if(d && !isNaN(v)) out.push({date:d,value:v});
      }
    }
    return out;
  };

  const chooseYear=(rows)=>{
    const counts=new Map();
    for(const r of rows){
      if(r.date instanceof Date && !isNaN(r.date)){
        const y=r.date.getUTCFullYear();
        counts.set(y,(counts.get(y)||0)+1);
      }
    }
    if(counts.size===0) return (new Date()).getUTCFullYear();
    let bestYear=null, bestCount=-1;
    for(const [y,c] of counts.entries()){
      if(c>bestCount || (c===bestCount && y>(bestYear||-Infinity))){ bestYear=y; bestCount=c; }
    }
    return bestYear;
  };

  function render(){
    const host=document.getElementById("heatmap_host"); if(!host) return; host.replaceChildren();

    const year = chooseYear(_dataRows);
    const jan1=new Date(Date.UTC(year,0,1)), dec31=new Date(Date.UTC(year,11,31));

    const byYear=new Map();
    const allValues=[];
    for(const r of _dataRows){
      if(!(r.date instanceof Date) || isNaN(r.date)) continue;
      const key=yyyymmdd(r.date);
      allValues.push(r.value);
      if(r.date.getUTCFullYear()===year) byYear.set(key, r.value);
    }

    let valsYear=Array.from(byYear.values()).filter(v=>typeof v==='number'&&isFinite(v));
    let [lo,hi]=extent(valsYear);
    const allValid = allValues.filter(v=>typeof v==='number'&&isFinite(v));
    if(valsYear.length===0 && allValid.length>0){ const e=extent(allValid); lo=e[0]; hi=e[1]; }
    if(!isFinite(lo) || !isFinite(hi)){ lo=0; hi=0; }

    const hasMin = _state.minScale!=="" && _state.minScale!=null && isFinite(Number(_state.minScale));
    const hasMax = _state.maxScale!=="" && _state.maxScale!=null && isFinite(Number(_state.maxScale));
    if(hasMin) lo=Number(_state.minScale);
    if(hasMax) hi=Number(_state.maxScale);

    const {minC,maxC,emptyC}=getColors();
    const steps=[0,1,2,3,4].map(i=>mixHex(minC,maxC,i/4));

    const ds=14, dg=2;
    const topPad=_state.showMonths?16:0;
    const leftPad=_state.showWeekdays?26:0;
    const gridStart=startOfWeek(jan1), gridEnd=endOfWeek(dec31), weeks=Math.ceil((gridEnd-gridStart)/(1000*60*60*24*7))+1;
    const width=leftPad+weeks*(ds+dg)+6, height=topPad+7*(ds+dg)+20+(_state.showLegend?30:0);

    const svg=document.createElementNS(NS,"svg");
    svg.setAttribute("viewBox",`0 0 ${width} ${height}`);
    svg.setAttribute("width","100%"); svg.setAttribute("height","100%");
    svg.setAttribute("preserveAspectRatio","xMidYMid meet"); svg.style.background="transparent";
    host.appendChild(svg);

    if(_state.showMonths){
      const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      for(let m=0;m<12;m++){
        const first=new Date(Date.UTC(year,m,1));
        const wi=Math.floor((startOfWeek(first)-gridStart)/(1000*60*60*24*7));
        const t=document.createElementNS(NS,"text");
        t.setAttribute("x", leftPad+wi*(ds+dg)); t.setAttribute("y", 10); t.setAttribute("class","label");
        t.textContent=months[m]; svg.appendChild(t);
      }
    }

    if(_state.showWeekdays){
      const wds=["M","T","W","T","F","S","S"];
      for(let i=0;i<7;i++){
        const t=document.createElementNS(NS,"text");
        t.setAttribute("x",0); t.setAttribute("y", topPad + i*(ds+dg) + ds - 3); t.setAttribute("class","label");
        t.textContent=wds[i]; svg.appendChild(t);
      }
    }

    let cur=new Date(jan1.getTime());
    while(cur<=dec31){
      const wi=Math.floor((startOfWeek(cur)-gridStart)/(1000*60*60*24*7));
      const dow=cur.getUTCDay()===0?6:cur.getUTCDay()-1;
      const x=leftPad + wi*(ds+dg);
      const y=topPad + dow*(ds+dg);
      const rect=document.createElementNS(NS,"rect");
      rect.setAttribute("x",x); rect.setAttribute("y",y); rect.setAttribute("width",ds); rect.setAttribute("height",ds);
      rect.setAttribute("rx",2); rect.setAttribute("ry",2);

      const key=yyyymmdd(cur);
      const val=byYear.get(key);
      if(typeof val==='number'&&isFinite(val)){
        rect.setAttribute("fill", steps[quantize5(val, lo, hi)]);
      } else {
        rect.setAttribute("fill", emptyC);
      }
      svg.appendChild(rect);

      cur.setUTCDate(cur.getUTCDate()+1);
    }

    if(_state.showLegend){
      const g=document.createElementNS(NS,"g");
      const ly=topPad + 7*(ds+dg) + 10, sw=ds;
      for(let i=0;i<5;i++){
        const rr=document.createElementNS(NS,"rect");
        rr.setAttribute("x", leftPad + i*(sw+6)); rr.setAttribute("y", ly);
        rr.setAttribute("width", sw); rr.setAttribute("height", sw);
        rr.setAttribute("rx",2); rr.setAttribute("ry",2); rr.setAttribute("fill", steps[i]);
        g.appendChild(rr);
      }
      const firstX=leftPad, lastX=leftPad + 4*(sw+6) + sw, labelY=ly + sw + 12;
      const tMin=document.createElementNS(NS,"text"); tMin.setAttribute("x", firstX); tMin.setAttribute("y", labelY); tMin.setAttribute("class","label"); tMin.textContent = String(lo); g.appendChild(tMin);
      const tMax=document.createElementNS(NS,"text"); tMax.setAttribute("x", lastX);  tMax.setAttribute("y", labelY); tMax.setAttribute("class","label"); tMax.setAttribute("text-anchor","end"); tMax.textContent = String(hi); g.appendChild(tMax);
      svg.appendChild(g);
    }
  }

  function onInitState(e){
    _state=e.detail.state||{};
    if(!_state.hasOwnProperty("minColorPicker"))_state.minColorPicker="#e5e7eb";
    if(!_state.hasOwnProperty("maxColorPicker"))_state.maxColorPicker="#0197FF";
    if(!_state.hasOwnProperty("unfilledColorPicker"))_state.unfilledColorPicker="#f3f4f6";
    if(!_state.hasOwnProperty("showLegend"))_state.showLegend=false;
    if(!_state.hasOwnProperty("showMonths"))_state.showMonths=false;
    if(!_state.hasOwnProperty("showWeekdays"))_state.showWeekdays=false;
    if(!_state.hasOwnProperty("minScale"))_state.minScale=""; if(!_state.hasOwnProperty("maxScale"))_state.maxScale="";
    const range = Array.isArray(_state.dataRangeValue) ? _state.dataRangeValue : _state.dataRange;
    _dataRows=parseDataRange(range);
    render();
  }

  function onPropertyChange(e){
    const prop=Squirrel.getGenericProperty(e.detail.property), v=e.detail.value;
    if(prop==="dataRange"){ _dataRows=parseDataRange(v); render(); return; }
    if(prop==="minColorPicker"){ _state.minColorPicker=v; render(); return; }
    if(prop==="maxColorPicker"){ _state.maxColorPicker=v; render(); return; }
    if(prop==="unfilledColorPicker"){ _state.unfilledColorPicker=v; render(); return; }
    if(prop==="showLegend"){ _state.showLegend=!!v; render(); return; }
    if(prop==="showMonths"){ _state.showMonths=!!v; render(); return; }
    if(prop==="showWeekdays"){ _state.showWeekdays=!!v; render(); return; }
    if(prop==="minScale"){ _state.minScale=v; render(); return; }
    if(prop==="maxScale"){ _state.maxScale=v; render(); return; }
  }
  function onPropertyChangesComplete(){} function onSetCanvas(e){} function onSetRuntimeMode(e){} function onSetSize(e){} function onSetPosition(e){}
})();