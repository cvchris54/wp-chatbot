(function () {
  'use strict';

  var cfg       = window.ChatbotConfig || {};
  var BOT_ID    = cfg.botId          || 'draftsight';
  var API_URL   = (cfg.apiUrl        || '').replace(/\/$/, '');
  var PRIMARY   = cfg.primaryColor   || '#1B4571';
  var TITLE     = cfg.title          || 'Chat Assistant';
  var WELCOME   = cfg.welcomeMessage || 'Hi! How can I help you today?';
  var POSITION  = cfg.position === 'left' ? 'left' : 'right';
  var WIDGET_ID = 'cb_' + BOT_ID;
  var W         = WIDGET_ID;

  if (!API_URL) { console.warn('[Chatbot] apiUrl required'); return; }
  if (document.getElementById(W + '_wrap')) return;

  var history = [], isOpen = false, isLoading = false;
  var POS = POSITION + ':20px';

  /* ── Styles ─────────────────────────────────────────────────────────── */
  var S = {
    wrap:    '#'+W+'_wrap *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:0}',
    btn:     '#'+W+'_btn{position:fixed;'+POS+';bottom:20px;width:56px;height:56px;border-radius:50%;background:'+PRIMARY+';border:none;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.22);z-index:2147483646;display:flex;align-items:center;justify-content:center;transition:transform .2s}',
    btnH:    '#'+W+'_btn:hover{transform:scale(1.08)}',
    btnSvg:  '#'+W+'_btn svg{width:26px;height:26px;fill:#fff}',
    icoC:    '#'+W+'_btn .ico_c{display:none}',
    icoO:    '#'+W+'_btn.open .ico_o{display:none}',
    icoOC:   '#'+W+'_btn.open .ico_c{display:block}',

    win:     '#'+W+'_win{position:fixed;'+POS+';bottom:86px;width:360px;height:560px;background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.18);z-index:2147483645;display:flex;flex-direction:column;overflow:hidden;transition:opacity .22s,transform .22s}',
    winH:    '#'+W+'_win.hidden{opacity:0;pointer-events:none;transform:translateY(12px) scale(.97)}',

    hdr:     '#'+W+'_hdr{background:'+PRIMARY+';padding:14px 18px;display:flex;align-items:center;gap:10px;flex-shrink:0}',
    dot:     '#'+W+'_dot{width:9px;height:9px;border-radius:50%;background:#4caf50;flex-shrink:0}',
    htitle:  '#'+W+'_htitle{flex:1;color:#fff;font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    hsub:    '#'+W+'_hsub{color:rgba(255,255,255,.78);font-size:11px;margin-top:1px}',
    xbtn:    '#'+W+'_x{background:none;border:none;cursor:pointer;padding:4px;opacity:.8;display:flex}',
    xbtnH:   '#'+W+'_x:hover{opacity:1}',

    msgs:    '#'+W+'_msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}',
    msgsS:   '#'+W+'_msgs::-webkit-scrollbar{width:4px}#'+W+'_msgs::-webkit-scrollbar-thumb{background:#ddd;border-radius:2px}',

    /* Bot bubble: fit-content so it never stretches wider than its text */
    msgB:    '.cb_b{width:fit-content;max-width:82%;padding:13px 18px;border-radius:14px 14px 14px 3px;background:#f0f2f5;color:#1a1a1a;font-size:14px;line-height:1.65;word-break:break-word;align-self:flex-start;animation:cbf .18s ease}',
    /* User bubble */
    msgU:    '.cb_u{width:fit-content;max-width:72%;padding:11px 16px;border-radius:14px 14px 3px 14px;background:'+PRIMARY+';color:#fff;font-size:14px;line-height:1.55;word-break:break-word;align-self:flex-end;animation:cbf .18s ease}',

    /* Rich text inside bot bubble */
    p:       '.cb_b p{margin:0 0 8px}.cb_b p:last-child{margin:0}',
    strong:  '.cb_b strong{font-weight:600}',
    em:      '.cb_b em{font-style:italic}',
    /* List: inside keeps numbers within padding boundary */
    list:    '.cb_b ol,.cb_b ul{margin:6px 0 8px;padding-left:0;list-style-position:inside}.cb_b ol:last-child,.cb_b ul:last-child{margin-bottom:0}',
    li:      '.cb_b li{margin:4px 0;padding:0;line-height:1.6}',
    h:       '.cb_b h4{font-size:14px;font-weight:600;margin:8px 0 4px}',
    a:       '.cb_b a{color:'+PRIMARY+';text-decoration:underline}',

    typing:  '.cb_t{display:flex;gap:5px;padding:13px 16px;background:#f0f2f5;border-radius:14px 14px 14px 3px;width:fit-content}',
    tspan:   '.cb_t span{width:8px;height:8px;background:#bbb;border-radius:50%;animation:cbb 1.2s infinite}.cb_t span:nth-child(2){animation-delay:.2s}.cb_t span:nth-child(3){animation-delay:.4s}',

    foot:    '#'+W+'_foot{padding:12px 14px 14px;border-top:1px solid #eee;display:flex;align-items:flex-end;gap:8px;flex-shrink:0}',
    inp:     '#'+W+'_inp{flex:1;border:1.5px solid #ddd;border-radius:22px;padding:10px 16px;font-size:14px;outline:none;resize:none;max-height:80px;line-height:1.4;background:#fff;color:#1a1a1a;transition:border-color .2s;font-family:inherit}',
    inpF:    '#'+W+'_inp:focus{border-color:'+PRIMARY+'}',
    inpP:    '#'+W+'_inp::placeholder{color:#aaa}',
    sbtn:    '#'+W+'_sbtn{background:'+PRIMARY+';border:none;border-radius:50%;width:40px;height:40px;min-width:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .2s}',
    sbtnD:   '#'+W+'_sbtn:disabled{opacity:.45;cursor:not-allowed}',
    sbtnSvg: '#'+W+'_sbtn svg{width:17px;height:17px;fill:#fff}',

    anim:    '@keyframes cbf{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}@keyframes cbb{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}',
    mobile:  '@media(max-width:480px){#'+W+'_win{width:calc(100vw - 12px);height:calc(100dvh - 88px);'+POSITION+':6px;bottom:76px;border-radius:12px}#'+W+'_btn{'+POSITION+':12px;bottom:12px}}'
  };

  var style = document.createElement('style');
  var _css=''; for(var _k in S){ _css+=S[_k]; } style.textContent=_css;
  document.head.appendChild(style);

  /* ── DOM ────────────────────────────────────────────────────────────── */
  var wrap = document.createElement('div');
  wrap.id = W + '_wrap';
  wrap.innerHTML =
    '<button id="'+W+'_btn" aria-label="Open chat">'
    + '<svg class="ico_o" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>'
    + '<svg class="ico_c" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
    + '</button>'
    + '<div id="'+W+'_win" class="hidden">'
    +   '<div id="'+W+'_hdr">'
    +     '<div id="'+W+'_dot"></div>'
    +     '<div style="flex:1;overflow:hidden"><div id="'+W+'_htitle">'+TITLE+'</div><div id="'+W+'_hsub">Online &bull; here to help</div></div>'
    +     '<button id="'+W+'_x" aria-label="Close"><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:#fff"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>'
    +   '</div>'
    +   '<div id="'+W+'_msgs"></div>'
    +   '<div id="'+W+'_foot">'
    +     '<textarea id="'+W+'_inp" rows="1" placeholder="Type a message..."></textarea>'
    +     '<button id="'+W+'_sbtn" disabled><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(wrap);

  var btn  = document.getElementById(W+'_btn'),
      win  = document.getElementById(W+'_win'),
      msgs = document.getElementById(W+'_msgs'),
      inp  = document.getElementById(W+'_inp'),
      sbtn = document.getElementById(W+'_sbtn'),
      xbtn = document.getElementById(W+'_x');

  /* ── Markdown ───────────────────────────────────────────────────────── */
  function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function inline(s){
    return s.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
            .replace(/\*(.*?)\*/g,'<em>$1</em>')
            .replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
  }
  function md(text){
    var html='', blocks=esc(text).split(/\n{2,}/);
    for(var i=0;i<blocks.length;i++){
      var b=blocks[i].trim(); if(!b) continue;
      var lines=b.split('\n');
      if(/^\d+\.\s/.test(lines[0])){
        html+='<ol>';
        for(var j=0;j<lines.length;j++){ var l=lines[j].replace(/^\d+\.\s+/,''); if(l) html+='<li>'+inline(l)+'</li>'; }
        html+='</ol>';
      } else if(/^[-*\u2022]\s/.test(lines[0])){
        html+='<ul>';
        for(var j=0;j<lines.length;j++){ var l=lines[j].replace(/^[-*\u2022]\s+/,''); if(l) html+='<li>'+inline(l)+'</li>'; }
        html+='</ul>';
      } else if(/^#{1,3}\s/.test(lines[0])){
        html+='<h4>'+inline(lines[0].replace(/^#{1,3}\s+/,''))+'</h4>';
        if(lines.length>1) html+='<p>'+inline(lines.slice(1).join('<br>'))+'</p>';
      } else {
        html+='<p>'+inline(lines.join('<br>'))+'</p>';
      }
    }
    return html;
  }

  /* ── Messages ───────────────────────────────────────────────────────── */
  function addMsg(text, role){
    var d=document.createElement('div');
    d.className = role==='bot' ? 'cb_b' : 'cb_u';
    if(role==='bot') d.innerHTML=md(text); else d.textContent=text;
    msgs.appendChild(d);
    msgs.scrollTop=msgs.scrollHeight;
  }
  function showTyping(){
    var t=document.createElement('div'); t.className='cb_t'; t.id=W+'_t';
    t.innerHTML='<span></span><span></span><span></span>';
    msgs.appendChild(t); msgs.scrollTop=msgs.scrollHeight;
  }
  function hideTyping(){ var t=document.getElementById(W+'_t'); if(t) t.remove(); }

  /* ── Send ───────────────────────────────────────────────────────────── */
  function send(){
    var text=inp.value.trim(); if(!text||isLoading) return;
    inp.value=''; inp.style.height='auto';
    sbtn.disabled=true; isLoading=true;
    addMsg(text,'user'); showTyping();
    fetch(API_URL+'/api/chat',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:text,botId:BOT_ID,history:history.slice(-8)})
    })
    .then(function(r){return r.json();})
    .then(function(d){
      hideTyping();
      if(d.error) throw new Error(d.error);
      history.push({role:'user',content:text});
      history.push({role:'assistant',content:d.response});
      addMsg(d.response,'bot');
    })
    .catch(function(){ hideTyping(); addMsg('Sorry, something went wrong. Please try again.','bot'); })
    .finally(function(){ isLoading=false; sbtn.disabled=!inp.value.trim(); inp.focus(); });
  }

  /* ── Events ─────────────────────────────────────────────────────────── */
  btn.addEventListener('click',function(){
    isOpen=!isOpen;
    win.classList.toggle('hidden',!isOpen);
    btn.classList.toggle('open',isOpen);
    if(isOpen){ if(!msgs.children.length) addMsg(WELCOME,'bot'); setTimeout(function(){inp.focus();},80); }
  });
  xbtn.addEventListener('click',function(){ isOpen=false; win.classList.add('hidden'); btn.classList.remove('open'); });
  inp.addEventListener('input',function(){ sbtn.disabled=!this.value.trim(); this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,80)+'px'; });
  inp.addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} });
  sbtn.addEventListener('click',send);

})();
