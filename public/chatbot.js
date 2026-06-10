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

  /* All values use !important to prevent WordPress themes from overriding */
  var css = ''
    /* Reset */
    + '#'+W+'_wrap *{box-sizing:border-box!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;-webkit-font-smoothing:antialiased!important}'

    /* FAB button */
    + '#'+W+'_btn{position:fixed!important;'+POS+';bottom:20px!important;width:56px!important;height:56px!important;min-width:56px!important;min-height:56px!important;border-radius:50%!important;background:'+PRIMARY+'!important;border:none!important;cursor:pointer!important;box-shadow:0 4px 18px rgba(0,0,0,.22)!important;z-index:2147483646!important;display:flex!important;align-items:center!important;justify-content:center!important;transition:transform .2s!important;padding:0!important;line-height:1!important}'
    + '#'+W+'_btn:hover{transform:scale(1.08)!important}'
    + '#'+W+'_btn svg{width:26px!important;height:26px!important;min-width:26px!important;min-height:26px!important;fill:#fff!important;display:block!important;flex-shrink:0!important}'
    + '#'+W+'_btn .ico_c{display:none!important}'
    + '#'+W+'_btn.open .ico_o{display:none!important}'
    + '#'+W+'_btn.open .ico_c{display:block!important}'

    /* Chat window */
    + '#'+W+'_win{position:fixed!important;'+POS+';bottom:86px!important;width:360px!important;height:560px!important;background:#fff!important;border-radius:16px!important;box-shadow:0 10px 40px rgba(0,0,0,.18)!important;z-index:2147483645!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;transition:opacity .22s,transform .22s!important;padding:0!important}'
    + '#'+W+'_win.hidden{opacity:0!important;pointer-events:none!important;transform:translateY(12px) scale(.97)!important}'

    /* Header */
    + '#'+W+'_hdr{background:'+PRIMARY+'!important;padding:14px 18px!important;display:flex!important;align-items:center!important;gap:10px!important;flex-shrink:0!important}'
    + '#'+W+'_dot{width:9px!important;height:9px!important;border-radius:50%!important;background:#4caf50!important;flex-shrink:0!important}'
    + '#'+W+'_htitle{flex:1!important;color:#fff!important;font-weight:600!important;font-size:15px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;line-height:1.3!important}'
    + '#'+W+'_hsub{color:rgba(255,255,255,.78)!important;font-size:11px!important;margin-top:1px!important;line-height:1.3!important}'
    + '#'+W+'_x{background:none!important;border:none!important;cursor:pointer!important;padding:4px!important;opacity:.8!important;display:flex!important}'
    + '#'+W+'_x:hover{opacity:1!important}'
    + '#'+W+'_x svg{width:20px!important;height:20px!important;fill:#fff!important;display:block!important}'

    /* Messages container */
    + '#'+W+'_msgs{flex:1!important;overflow-y:auto!important;padding:14px!important;display:flex!important;flex-direction:column!important;gap:10px!important;scroll-behavior:smooth!important;background:#fff!important}'
    + '#'+W+'_msgs::-webkit-scrollbar{width:4px!important}'
    + '#'+W+'_msgs::-webkit-scrollbar-thumb{background:#ddd!important;border-radius:2px!important}'

    /* Bot bubble */
    + '.cb_b{width:fit-content!important;max-width:78%!important;padding:14px 22px!important;border-radius:14px 14px 14px 3px!important;background:#f0f2f5!important;color:#1a1a1a!important;font-size:14px!important;line-height:1.65!important;word-break:break-word!important;align-self:flex-start!important;animation:cbf .18s ease!important}'

    /* User bubble */
    + '.cb_u{width:fit-content!important;max-width:72%!important;padding:11px 16px!important;border-radius:14px 14px 3px 14px!important;background:'+PRIMARY+'!important;color:#fff!important;font-size:14px!important;line-height:1.55!important;word-break:break-word!important;align-self:flex-end!important;animation:cbf .18s ease!important}'

    /* Rich text inside bot bubble */
    + '.cb_b p{margin:0 0 8px!important;padding:0!important}.cb_b p:last-child{margin:0!important}'
    + '.cb_b strong{font-weight:600!important}'
    + '.cb_b em{font-style:italic!important}'
    + '.cb_b ol,.cb_b ul{margin:6px 0 8px!important;padding-left:0!important;list-style-position:inside!important}.cb_b ol:last-child,.cb_b ul:last-child{margin-bottom:0!important}'
    + '.cb_b li{margin:4px 0!important;padding:0!important;line-height:1.6!important}'
    + '.cb_b h4{font-size:14px!important;font-weight:600!important;margin:8px 0 4px!important}'
    + '.cb_b a{color:'+PRIMARY+'!important;text-decoration:underline!important}'

    /* Typing indicator */
    + '.cb_t{display:flex!important;gap:5px!important;padding:13px 16px!important;background:#f0f2f5!important;border-radius:14px 14px 14px 3px!important;width:fit-content!important;align-self:flex-start!important}'
    + '.cb_t span{width:8px!important;height:8px!important;background:#bbb!important;border-radius:50%!important;display:block!important;animation:cbb 1.2s infinite!important}'
    + '.cb_t span:nth-child(2){animation-delay:.2s!important}'
    + '.cb_t span:nth-child(3){animation-delay:.4s!important}'

    /* Footer */
    + '#'+W+'_foot{padding:12px 14px 14px!important;border-top:1px solid #eee!important;display:flex!important;align-items:flex-end!important;gap:8px!important;flex-shrink:0!important;background:#fff!important}'

    /* Text input */
    + '#'+W+'_inp{flex:1!important;border:1.5px solid #ddd!important;border-radius:22px!important;padding:10px 16px!important;font-size:14px!important;outline:none!important;resize:none!important;max-height:80px!important;line-height:1.4!important;background:#fff!important;color:#1a1a1a!important;transition:border-color .2s!important;font-family:inherit!important;-webkit-appearance:none!important;appearance:none!important}'
    + '#'+W+'_inp:focus{border-color:'+PRIMARY+'!important}'
    + '#'+W+'_inp::placeholder{color:#aaa!important}'

    /* Send button */
    + '#'+W+'_sbtn{background:'+PRIMARY+'!important;border:none!important;border-radius:50%!important;width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;transition:opacity .2s!important;padding:0!important;flex-shrink:0!important}'
    + '#'+W+'_sbtn:disabled{opacity:.45!important;cursor:not-allowed!important}'
    + '#'+W+'_sbtn svg{width:18px!important;height:18px!important;min-width:18px!important;min-height:18px!important;fill:#fff!important;display:block!important;flex-shrink:0!important}'

    /* Animations */
    + '@keyframes cbf{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}'
    + '@keyframes cbb{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}'
    + '@media(max-width:480px){#'+W+'_win{width:calc(100vw - 12px)!important;height:calc(100dvh - 88px)!important;'+POSITION+':6px!important;bottom:76px!important;border-radius:12px!important}#'+W+'_btn{'+POSITION+':12px!important;bottom:12px!important}}';

  var style = document.createElement('style');
  style.textContent = css;
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
    +     '<button id="'+W+'_x" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>'
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
