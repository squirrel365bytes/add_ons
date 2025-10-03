(() => {
  "use strict";
  Squirrel.addEventListener("eventDispatch", (e) => eval(`${e.detail.name}(e)`));
  Squirrel.initWithSquirrel();

  const root = document.getElementById("menu_root");

  const DEFAULTS = {
    dataRange: [],
    selectedOutput: "",
    topLevelTextHex:"#111827",
    topLevelIconHex:"#111827",
    childTextHex:"#374151",
    childIconHex:"#374151",
    hoverBgHex:"#f3f4f6",
    hoverBgPicker:"#f3f4f6",
    hoverTextHex:"#111827",
    hoverTextPicker:"#111827",
    responsiveThreshold: 100,
    animateWidth: true,
    overrideIconColor: false
  };

  const SAMPLE = [
    ["Dashboard","","home"],
    ["Mailbox","","mail"],
    ["Layout Options","Grid","folder"],
    ["Layout Options","Masonry","folder"],
    ["Widgets","","folder"],
    ["Calendar","","calendar"],
    ["Examples","UI Elements","folder"],
    ["Examples","Charts","chart"],
    ["Examples","Tables","table"]
  ];

  const ICONS = {
    home:   '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5z"/></svg>',
    mail:   '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1.8 2 7.2 5.1L19.2 7H4.8zM20 18V9.7l-8 5.7-8-5.7V18h16z"/></svg>',
    folder: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4l2 2h8a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h5z"/></svg>',
    chevron:'<svg class="caret" viewBox="0 0 24 24" fill="currentColor"><path d="M8.5 4.5l7 7-7 7"/></svg>',
    calendar:'<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3V2zm14 8H3v10h18V10z"/></svg>',
    chart:  '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M4 19h16v2H2V3h2v16zm3 0V9h3v10H7zm5 0V5h3v14h-3zm5 0v-7h3v7h-3z"/></svg>',
    table:  '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v18H3V3zm2 2v4h14V5H5zm14 6H5v8h14v-8zM7 13h4v2H7v-2z"/></svg>'
  };

  function iconSvg(nameOrSvg, cls="icon"){
    if(!nameOrSvg) return ""; // changed: return empty string instead of empty div
    const key = String(nameOrSvg).trim().toLowerCase();
    if(ICONS[key]) return ICONS[key];
    if(key.startsWith("<svg")) return nameOrSvg.replace("<svg", `<svg class="${cls}"`);
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor"><path d="${nameOrSvg}"/></svg>`;
  }

  function safeHex(v,f){ v=(v||"").toString().trim(); return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)?v:f; }
  function setColors(s){
    const hoverBg = safeHex(s.hoverBgHex, s.hoverBgPicker || "#f3f4f6");
    const hoverText = safeHex(s.hoverTextHex, s.hoverTextPicker || "#111827");
    document.documentElement.style.setProperty("--top-text",   safeHex(s.topLevelTextHex,"#111827"));
    document.documentElement.style.setProperty("--top-icon",   safeHex(s.topLevelIconHex,"#111827"));
    document.documentElement.style.setProperty("--child-text", safeHex(s.childTextHex,"#374151"));
    document.documentElement.style.setProperty("--child-icon", safeHex(s.childIconHex,"#374151"));
    document.documentElement.style.setProperty("--hover-bg",   hoverBg);
    document.documentElement.style.setProperty("--hover-text", hoverText);
    if (s.overrideIconColor) root.classList.add("force-icon-color"); else root.classList.remove("force-icon-color");
  }

  function parseRows(rows){
    const groups=new Map();
    const arr=Array.isArray(rows)?rows:[];
    if(arr.length===0) arr.push(...SAMPLE);
    arr.forEach(r=>{
      if(!r||!r.length) return;
      const menu=(r[0]??"").toString().trim();
      const content=(r[1]??"").toString().trim();
      const icon=(r[2]??"").toString().trim();
      if(!menu) return;
      if(!groups.has(menu)) groups.set(menu,{menu,icon:"",children:[]});
      const g=groups.get(menu);
      if(content){ g.children.push({label:content,icon}); }
      else { g.icon=icon||g.icon; g.isLeaf=true; }
    });
    for(const g of groups.values()){ if(g.children.length>0) g.isLeaf=false; }
    return Array.from(groups.values());
  }

  function clear(node){ while(node.firstChild) node.removeChild(node.firstChild); }

  function render(){
    clear(root);
    setColors(STATE);
    const groups=parseRows(STATE.dataRange);
    groups.forEach(g=>{
      const group=document.createElement("div");
      group.className="menu-group";
      const top=document.createElement("div");
      top.className="menu-top";
      // top-level still defaults to folder when blank
      top.innerHTML = `${iconSvg(g.icon||'folder')}<div class="menu-title">${g.menu}</div>${g.children.length? iconSvg('chevron','caret'):''}`;
      top.addEventListener("click",()=>{
        if(g.children.length){ group.classList.toggle("open"); }
        else{ Squirrel.sendToSquirrel("selectedOutput", g.menu, true); }
      });
      group.appendChild(top);
      if(g.children.length){
        const sub=document.createElement("div");
        sub.className="submenu";
        g.children.forEach(child=>{
          const item=document.createElement("div");
          item.className="submenu-item";
          // CHANGED: if child.icon is blank, omit the icon entirely
          const iconPart = child.icon ? iconSvg(child.icon) : "";
          item.innerHTML = `${iconPart}<div class="menu-title">${child.label}</div>`;
          item.addEventListener("click",(e)=>{ e.stopPropagation(); Squirrel.sendToSquirrel("selectedOutput", child.label, true); });
          sub.appendChild(item);
        });
        group.appendChild(sub);
      }
      root.appendChild(group);
    });
    applyResponsive();
  }

  function applyResponsive(){
    const w = root.getBoundingClientRect().width;
    if(w <= Number(STATE.responsiveThreshold||100)) root.classList.add("icon-only"); else root.classList.remove("icon-only");
  }

  let STATE = Object.assign({}, DEFAULTS);

  function onInitState(e){
    const s = e.detail.state || {};
    STATE = Object.assign({}, DEFAULTS, s);
    render();
  }

  function onPropertyChange(e){
    const name = Squirrel.getGenericProperty(e.detail.property);
    const value = e.detail.value;
    switch(name){
      case "dataRange":            STATE.dataRange = value; break;
      case "topLevelTextHex":      STATE.topLevelTextHex = value; break;
      case "topLevelIconHex":      STATE.topLevelIconHex = value; break;
      case "childTextHex":         STATE.childTextHex = value; break;
      case "childIconHex":         STATE.childIconHex = value; break;
      case "hoverBgHex":           STATE.hoverBgHex = value; break;
      case "hoverBgPicker":        STATE.hoverBgPicker = value; break;
      case "hoverTextHex":         STATE.hoverTextHex = value; break;
      case "hoverTextPicker":      STATE.hoverTextPicker = value; break;
      case "responsiveThreshold":  STATE.responsiveThreshold = Number(value)||100; break;
      case "animateWidth":         STATE.animateWidth = (String(value).toLowerCase()==="true"||value===true); break;
      case "overrideIconColor":    STATE.overrideIconColor = (String(value).toLowerCase()==="true"||value===true); break;
      default: break;
    }
    render();
  }

  function onPropertyChangesComplete() {}
  function onSetCanvas(e) { applyResponsive(); }
  function onSetRuntimeMode(e) {}
  function onSetSize(e) { applyResponsive(); }
  function onSetPosition(e) {}

})();