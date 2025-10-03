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
    avatarSvg: `<svg fill="#FFFFFF" height="800px" width="800px" version="1.2" baseProfile="tiny" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M103.2,236.6H89.4c-1.3,0-2.7-0.1-3.9-0.1c-0.1,0-0.1,0-0.1,0c-1.1,0.1-2.2,0.1-3.3,0.1c-30.2,0-60-24.2-73.1-49.2c-2.2-4.3-4.1-8.9-5.6-13.6C1.2,166.6,0,158.9,0,150.9c0-10.9,2.2-21.3,6.2-30.7c4.1-12,12-24.2,26.4-35.1c24.8-18.8,13.8-47.3,13.8-47.3c3.2-0.6,6.3-0.9,9.4-0.9c23.4,0,43.6,23.8,46.2,45c0.3,1.9,0.4,3.8,0.4,5.8c0,8.4-3.3,15.3-8,21.8c-9.7,8.6-17.4,19.4-22,31.6c-1.9,4.9-3.2,10-4.1,15.3c-0.7,4.3-1.1,8.8-1.1,13.4C67.1,197.6,81.5,222.4,103.2,236.6z M253,142.2c0,0.1,0,0.2,0,0.3c0,0.2,0,0.3,0,0.4c0,5.9-4.8,10.7-10.7,10.7h-18.7c-2.8,2.2-5.6,4.7-8.6,7c-0.9,0.7-1.8,1.3-2.7,1.9c-1,0.8-2,1.4-3.1,2c-0.8,0.3-1.6,0.8-2.3,1.1c-2.7,1.2-5.5,2-8.5,2c-0.2,0-0.3,0-0.6,0c-0.9,0-1.9-0.1-2.8-0.2c-8.5-0.9-12.6-6-16.4-13.2c-0.1-0.1-0.2-0.2-0.3-0.3c-2.7-3.2-5.1-4.9-7.1-5.7c-6.6-4.2-14.4-6.8-22.7-6.9l0.6,4.1c20.9,0.7,37.7,17.8,37.7,38.9c0,11.9-5.5,22.6-13.9,29.7c6.6,1,12.2,4.9,15.7,10.2c1.1,1.7,2,3.7,2.7,5.7c0.7,2.1,1.1,4.5,1.1,6.8h-4.8h-5.2h-12.2h-23.7h-30.2c-16.4-7.8-30.1-21.3-37.2-38c-3-6.9-4.9-14.5-5.6-22.3c-0.7-4.2-1-8.6-1-12.9c0-18.6,20.9-57.1,52.1-65.9c0,0,23.8-9.1,26.6-10.2c24.2-10,16.9-23.3,23-32.8c7.3-11.5,17.3-12.4,17.3-12.4L205,25.8l4.7-5.5c3.6,0,6.5,12.7,7,23.4c27.4,12.8,31.4,40.9,31.4,52c0,12-6.3,17.9-15.6,20.3c-4.2,1-10,1.3-15.3,1.3c-6.2,0-11.5-0.4-11.5-0.4c0,0.9,7.3,15.1,7.3,15.1h20.2c1.2-0.1,2.6-0.2,3.8-0.2c1.2,0,2.4,0.1,3.7,0.2h1.6c3,0,5.7,1.3,7.7,3.3c1.3,1.2,2.1,2.4,2.3,3.8C252.8,140.2,253,141.2,253,142.2z M207.1,72c0,4.1,3.3,7.5,7.5,7.5s7.5-3.3,7.5-7.5c0-4.1-3.3-7.5-7.5-7.5S207,67.9,207.1,72z"/></svg>`,
    avatarBg: "#0ea5e9",
    noMatchText: "I'm not sure yet. Try asking about reports, KPIs, or sources.",
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

  function updateAvatars(){
    const nodes = document.querySelectorAll('.avatar');
    nodes.forEach(n=>{
      if(state.avatarSvg && /<svg[\s\S]*>[\s\S]*<\/svg>/i.test(state.avatarSvg)){
        n.innerHTML = state.avatarSvg;
      } else { n.textContent = '🤖'; }
    });
  }
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
      addBot(state.noMatchText || "I'm not sure yet.");
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
      case 'avatarSvg': state.avatarSvg = val; updateAvatars(); break;
      case 'noMatchText': state.noMatchText = val; break;
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