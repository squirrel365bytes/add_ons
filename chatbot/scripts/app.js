(() => {
  "use strict";

  // register event bridge like working SVG
  Squirrel.addEventListener("eventDispatch", (e) => eval(`${e.detail.name}(e)`));
  Squirrel.initWithSquirrel();

  // ----- DOM -----
  const messagesEl = (()=>document.getElementById("messages"))();
  const inputEl = (()=>document.getElementById("input"))();
  const sendEl = (()=>document.getElementById("send"))();

  // ----- State -----
  const state = {
    // text
    placeholder: "Hello! Please ask me about your data.",
    greeting: "Hello! Please ask me about your data.",
    // colors
    fontColor: "#111827",
    botBg: "#F3F4F6",
    botText: "#111827",
    userBg: "#1F2937",
    userText: "#FFFFFF",
    btnBg: "#111827",
    btnText: "#FFFFFF",
    accent: "#0197FF",
    // avatar
    avatarSvg: "",
    avatarBg: "#0ea5e9",
    // bindings
    dataRange: []
  };
  let greeted = false;
  let faqRows = [];

  // ----- Helpers -----
  function cssVars(){
    const root = document.documentElement;
    root.style.setProperty('--avatarBg', state.avatarBg);
    root.style.setProperty('--botBg', state.botBg);
    root.style.setProperty('--botText', state.botText);
    root.style.setProperty('--userBg', state.userBg);
    root.style.setProperty('--userText', state.userText);
    root.style.setProperty('--btnBg', state.btnBg);
    root.style.setProperty('--btnText', state.btnText);
    root.style.setProperty('--accent', state.accent);
    // font color mainly affects default text
    document.body.style.color = state.fontColor;
    inputEl.placeholder = state.placeholder || "Type your message…";
  }
  const lc = (s)=> (s||"").toString().toLowerCase();
  const isUrl = (s)=> /^https?:\/\//i.test(s||"") || /^www\./i.test(s||"");
  function scrollToEnd(){ messagesEl.scrollTop = messagesEl.scrollHeight + 1000; }

  function avatarNode(){
    const av = document.createElement('div');
    av.className = 'avatar';
    if(state.avatarSvg && /<svg[\s\S]*>[\s\S]*<\/svg>/i.test(state.avatarSvg)){
      av.innerHTML = state.avatarSvg;
    } else {
      av.textContent = "🤖";
    }
    return av;
  }
  function addRow(kind){
    const row = document.createElement('div');
    row.className = `row ${kind}`;
    if(kind === 'bot'){ row.appendChild(avatarNode()); }
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    return bubble;
  }
  function addBot(text, extras){
    const b = addRow('bot');
    b.textContent = text || "";
    if(Array.isArray(extras) && extras.length){
      const wrap = document.createElement('div'); wrap.className = 'extras';
      extras.forEach(x => {
        const btn = document.createElement('button'); btn.className='extra'; btn.textContent = x.label;
        btn.addEventListener('click', () => {
          Squirrel.sendToSquirrel('clickedSummaryOut', x.label);
          if(isUrl(x.detail)){
            let url = x.detail.trim(); if(/^www\./i.test(url)) url = 'https://' + url;
            window.open(url, '_blank');
            Squirrel.sendToSquirrel('clickedSummaryOut', x.label);
          } else {
            addBot(x.detail || "No additional details.");
            Squirrel.sendToSquirrel('clickedSummaryOut', x.label);
          }
        });
        wrap.appendChild(btn);
      });
      b.appendChild(wrap);
    }
    scrollToEnd();
  }
  function addUser(text){ const b = addRow('user'); b.textContent = text || ""; scrollToEnd(); }

  function parseRangeToRows(value){
    if(!value) return [];
    let rows = [];
    if(Array.isArray(value)){ rows = value; }
    else if(typeof value === 'string'){
      const lines = value.split(/\r?\n/).filter(Boolean);
      rows = lines.map(line => line.split(','));
    } else if(value && Array.isArray(value.values)){ rows = value.values; }
    rows = rows.map(r => {
      const arr = new Array(8).fill("");
      for(let i=0;i<Math.min(8, r.length);i++){ arr[i] = (r[i] ?? "").toString(); }
      return arr;
    });
    if(rows.length && /term/i.test(rows[0][0])) rows = rows.slice(1);
    return rows;
  }
  function bestMatchRow(query){
    const q = lc(query);
    const qTokens = q.split(/[^a-z0-9]+/).filter(Boolean);
    let best = {rowIndex:-1, score:0};
    faqRows.forEach((r, idx)=>{
      const terms = (r[0]||"").split(/[,;|]/).map(t=>lc(t.trim())).filter(Boolean);
      let s = 0;
      terms.forEach(term => { const tTokens = term.split(/\s+/).filter(Boolean); s += tTokens.every(t => q.includes(t)) ? 1 : 0; });
      terms.forEach(term => { if(qTokens.includes(term)) s += 0.5; });
      if(s > best.score) best = {rowIndex: idx, score: s};
    });
    return best;
  }
  function respondTo(query){
    const match = bestMatchRow(query);
    Squirrel.sendToSquirrel('userInputOut', query);
    Squirrel.sendToSquirrel('matchedRowOut', match.rowIndex+1);
    Squirrel.sendToSquirrel('matchedScoreOut', Number(match.score||0));
    if(match.rowIndex < 0 || match.score <= 0){
      addBot("I'm not sure yet. Try asking about reports, KPIs, or sources.");
      return;
    }
    const row = faqRows[match.rowIndex];
    const response = row[1] || "…";
    const extras = [];
    for(let i=0;i<3;i++){
      const label = row[2 + i*2] || "";
      const detail = row[3 + i*2] || "";
      if(label && detail){ extras.push({label, detail}); }
    }
    addBot(response, extras);
    Squirrel.sendToSquirrel('selectedResponseOut', response);
  }
  function onSend(){
    const val = (inputEl.value || "").trim();
    if(!val) return;
    addUser(val); inputEl.value = ""; respondTo(val);
  }
  sendEl.addEventListener('click', onSend);
  inputEl.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ onSend(); }});

  // ----- Squirrel Event Handlers (names must match helper expectations) -----
  function applyPartial(part){
    if(!part || typeof part !== 'object') return;
    Object.assign(state, part);
    cssVars();
    if(!greeted){ addBot(state.greeting); greeted = true; }
  }

  function onInitState(e){
    const s = e.detail.state || {};
    applyPartial(s);
    // Data binding might be part of state depending on host; keep parse robust
    if(s.hasOwnProperty('dataRange')){
      faqRows = parseRangeToRows(s.dataRange);
    }
  }

  function onPropertyChange(e){
    const name = Squirrel.getGenericProperty(e.detail.property);
    const val = e.detail.value;
    switch(name){
      case 'placeholder': state.placeholder = val; break;
      case 'greeting': state.greeting = val; break;
      case 'fontColor': state.fontColor = val; break;
      case 'botBg': state.botBg = val; break;
      case 'botText': state.botText = val; break;
      case 'userBg': state.userBg = val; break;
      case 'userText': state.userText = val; break;
      case 'btnBg': state.btnBg = val; break;
      case 'btnText': state.btnText = val; break;
      case 'accent': state.accent = val; break;
      case 'avatarSvg': state.avatarSvg = val; break;
      case 'avatarBg': state.avatarBg = val; break;
      case 'dataRange': faqRows = parseRangeToRows(val); break;
    }
    cssVars();
  }
  function onPropertyChangesComplete() {}
  function onSetCanvas(e) {}
  function onSetRuntimeMode(e) {}
  function onSetSize(e) {}
  function onSetPosition(e) {}

  // Expose handler names (eval in listener will call these)
  window.onInitState = onInitState;
  window.onPropertyChange = onPropertyChange;
  window.onPropertyChangesComplete = onPropertyChangesComplete;
  window.onSetCanvas = onSetCanvas;
  window.onSetRuntimeMode = onSetRuntimeMode;
  window.onSetSize = onSetSize;
  window.onSetPosition = onSetPosition;

})();