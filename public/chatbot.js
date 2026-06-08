/**
 * WP Chatbot Widget — chatbot.js
 * Place this file in /public/chatbot.js in the Vercel project.
 *
 * Usage (paste into WordPress HTML widget):
 *
 *   <script>
 *     window.ChatbotConfig = {
 *       botId:          'draftsight',
 *       apiUrl:         'https://YOUR-APP.vercel.app',
 *       primaryColor:   '#0066B3',
 *       title:          'DraftSight SA Assistant',
 *       welcomeMessage: 'Hi there! Ask me anything about DraftSight products.',
 *       position:       'right'   // 'right' or 'left'
 *     };
 *   </script>
 *   <script src="https://YOUR-APP.vercel.app/chatbot.js"></script>
 */

(function () {
  'use strict';

  // ── Configuration ────────────────────────────────────────────────────────
  var cfg = window.ChatbotConfig || {};

  var BOT_ID         = cfg.botId         || 'draftsight';
  var API_URL        = (cfg.apiUrl        || '').replace(/\/$/, '');
  var PRIMARY        = cfg.primaryColor   || '#0066B3';
  var TITLE          = cfg.title          || 'Chat Assistant';
  var WELCOME        = cfg.welcomeMessage || 'Hi! How can I help you today?';
  var POSITION       = cfg.position === 'left' ? 'left' : 'right';
  var WIDGET_ID      = 'cb_' + BOT_ID;

  if (!API_URL) { console.warn('[Chatbot] ChatbotConfig.apiUrl is required.'); return; }

  // Prevent double-init on the same page
  if (document.getElementById(WIDGET_ID + '_wrap')) return;

  // ── State ────────────────────────────────────────────────────────────────
  var history  = [];
  var isOpen   = false;
  var isLoading= false;

  // ── Inject CSS ───────────────────────────────────────────────────────────
  var POS = POSITION + ':20px';

  var css = [
    '#' + WIDGET_ID + '_wrap *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:0}',

    /* Bubble */
    '#' + WIDGET_ID + '_btn{position:fixed;' + POS + ';bottom:20px;width:56px;height:56px;border-radius:50%;background:' + PRIMARY + ';border:none;cursor:pointer;box-shadow:0 4px 18px rgba(0,0,0,.22);z-index:2147483646;display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s}',
    '#' + WIDGET_ID + '_btn:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(0,0,0,.28)}',
    '#' + WIDGET_ID + '_btn svg{width:26px;height:26px;fill:#fff;transition:opacity .2s}',
    '#' + WIDGET_ID + '_btn .cb_ico_close{display:none}',
    '#' + WIDGET_ID + '_btn.open .cb_ico_chat{display:none}',
    '#' + WIDGET_ID + '_btn.open .cb_ico_close{display:block}',

    /* Unread badge */
    '#' + WIDGET_ID + '_badge{position:fixed;' + POSITION + ':60px;bottom:62px;background:#e53935;color:#fff;border-radius:10px;padding:2px 7px;font-size:11px;font-weight:700;z-index:2147483647;display:none}',

    /* Window */
    '#' + WIDGET_ID + '_win{position:fixed;' + POS + ';bottom:86px;width:370px;height:540px;background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.18);z-index:2147483645;display:flex;flex-direction:column;overflow:hidden;transition:opacity .22s,transform .22s}',
    '#' + WIDGET_ID + '_win.cb_hidden{opacity:0;pointer-events:none;transform:translateY(12px) scale(.97)}',

    /* Header */
    '#' + WIDGET_ID + '_hdr{background:' + PRIMARY + ';padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0}',
    '#' + WIDGET_ID + '_hdr_dot{width:9px;height:9px;border-radius:50%;background:#4caf50;flex-shrink:0}',
    '#' + WIDGET_ID + '_hdr_title{flex:1;color:#fff;font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#' + WIDGET_ID + '_hdr_sub{color:rgba(255,255,255,.75);font-size:11px;margin-top:1px}',
    '#' + WIDGET_ID + '_close{background:none;border:none;color:#fff;cursor:pointer;padding:4px;opacity:.8;display:flex}',
    '#' + WIDGET_ID + '_close:hover{opacity:1}',

    /* Messages */
    '#' + WIDGET_ID + '_msgs{flex:1;overflow-y:auto;padding:14px 14px 8px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}',
    '#' + WIDGET_ID + '_msgs::-webkit-scrollbar{width:4px}',
    '#' + WIDGET_ID + '_msgs::-webkit-scrollbar-thumb{background:#ddd;border-radius:2px}',

    /* Message bubbles */
    '.cb_msg{max-width:82%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.55;word-break:break-word;animation:cb_fadein .18s ease}',
    '.cb_msg.bot{background:#f0f2f5;color:#1a1a1a;align-self:flex-start;border-bottom-left-radius:3px}',
    '.cb_msg.user{background:' + PRIMARY + ';color:#fff;align-self:flex-end;border-bottom-right-radius:3px}',
    '.cb_msg a{color:inherit;text-decoration:underline}',

    /* Typing indicator */
    '.cb_typing{display:flex;gap:5px;padding:10px 14px;background:#f0f2f5;border-radius:14px;border-bottom-left-radius:3px;align-self:flex-start}',
    '.cb_typing span{width:8px;height:8px;background:#aaa;border-radius:50%;animation:cb_bounce 1.2s infinite}',
    '.cb_typing span:nth-child(2){animation-delay:.2s}',
    '.cb_typing span:nth-child(3){animation-delay:.4s}',

    /* Input area */
    '#' + WIDGET_ID + '_foot{padding:10px 12px 12px;border-top:1px solid #eee;display:flex;align-items:flex-end;gap:8px;flex-shrink:0}',
    '#' + WIDGET_ID + '_input{flex:1;border:1.5px solid #ddd;border-radius:22px;padding:9px 15px;font-size:14px;outline:none;resize:none;max-height:80px;line-height:1.4;background:#fff;color:#1a1a1a;transition:border-color .2s;font-family:inherit}',
    '#' + WIDGET_ID + '_input:focus{border-color:' + PRIMARY + '}',
    '#' + WIDGET_ID + '_input::placeholder{color:#aaa}',
    '#' + WIDGET_ID + '_send{background:' + PRIMARY + ';border:none;border-radius:50%;width:40px;height:40px;min-width:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .2s}',
    '#' + WIDGET_ID + '_send:disabled{opacity:.45;cursor:not-allowed}',
    '#' + WIDGET_ID + '_send svg{width:17px;height:17px;fill:#fff}',

    /* Animations */
    '@keyframes cb_fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}',
    '@keyframes cb_bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}',

    /* Responsive — full screen on mobile */
    '@media(max-width:480px){',
    '  #' + WIDGET_ID + '_win{width:calc(100vw - 12px);height:calc(100dvh - 88px);' + POSITION + ':6px;bottom:76px;border-radius:12px}',
    '  #' + WIDGET_ID + '_btn{' + POSITION + ':12px;bottom:12px}',
    '}',
  ].join('');

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── Build DOM ────────────────────────────────────────────────────────────
  var wrap = document.createElement('div');
  wrap.id = WIDGET_ID + '_wrap';
  wrap.innerHTML = [
    /* Bubble button */
    '<button id="' + WIDGET_ID + '_btn" aria-label="Open chat">',
      '<svg class="cb_ico_chat" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
      '<svg class="cb_ico_close" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    '</button>',

    /* Chat window */
    '<div id="' + WIDGET_ID + '_win" class="cb_hidden" role="dialog" aria-label="' + TITLE + '">',

      /* Header */
      '<div id="' + WIDGET_ID + '_hdr">',
        '<div id="' + WIDGET_ID + '_hdr_dot"></div>',
        '<div style="flex:1;overflow:hidden">',
          '<div id="' + WIDGET_ID + '_hdr_title">' + TITLE + '</div>',
          '<div id="' + WIDGET_ID + '_hdr_sub">Online • here to help</div>',
        '</div>',
        '<button id="' + WIDGET_ID + '_close" aria-label="Close">',
          '<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:#fff"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
        '</button>',
      '</div>',

      /* Messages */
      '<div id="' + WIDGET_ID + '_msgs"></div>',

      /* Input */
      '<div id="' + WIDGET_ID + '_foot">',
        '<textarea id="' + WIDGET_ID + '_input" rows="1" placeholder="Type a message..." aria-label="Your message"></textarea>',
        '<button id="' + WIDGET_ID + '_send" disabled aria-label="Send">',
          '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
        '</button>',
      '</div>',
    '</div>',
  ].join('');

  document.body.appendChild(wrap);

  // ── Element refs ─────────────────────────────────────────────────────────
  var btn   = document.getElementById(WIDGET_ID + '_btn');
  var win   = document.getElementById(WIDGET_ID + '_win');
  var msgs  = document.getElementById(WIDGET_ID + '_msgs');
  var inp   = document.getElementById(WIDGET_ID + '_input');
  var send  = document.getElementById(WIDGET_ID + '_send');
  var close = document.getElementById(WIDGET_ID + '_close');

  // ── Utilities ────────────────────────────────────────────────────────────
  function addMessage(text, role) {
    var div = document.createElement('div');
    div.className = 'cb_msg ' + role;
    // Linkify URLs
    div.innerHTML = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/(https?:\/\/[^\s]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function showTyping() {
    var t = document.createElement('div');
    t.className = 'cb_typing'; t.id = WIDGET_ID + '_typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(t);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function hideTyping() {
    var t = document.getElementById(WIDGET_ID + '_typing');
    if (t) t.remove();
  }

  // ── Send message ─────────────────────────────────────────────────────────
  function sendMessage() {
    var text = inp.value.trim();
    if (!text || isLoading) return;

    inp.value = '';
    inp.style.height = 'auto';
    send.disabled = true;
    isLoading = true;

    addMessage(text, 'user');
    showTyping();

    var payload = JSON.stringify({ message: text, botId: BOT_ID, history: history.slice(-8) });

    fetch(API_URL + '/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    payload,
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      hideTyping();
      if (data.error) throw new Error(data.error);

      history.push({ role: 'user',      content: text });
      history.push({ role: 'assistant', content: data.response });

      addMessage(data.response, 'bot');
    })
    .catch(function (err) {
      hideTyping();
      addMessage('Sorry, something went wrong. Please try again.', 'bot');
      console.error('[Chatbot] Error:', err);
    })
    .finally(function () {
      isLoading = false;
      send.disabled = !inp.value.trim();
      inp.focus();
    });
  }

  // ── Toggle window ────────────────────────────────────────────────────────
  btn.addEventListener('click', function () {
    isOpen = !isOpen;
    win.classList.toggle('cb_hidden', !isOpen);
    btn.classList.toggle('open', isOpen);

    if (isOpen) {
      if (msgs.children.length === 0) addMessage(WELCOME, 'bot');
      setTimeout(function () { inp.focus(); }, 80);
    }
  });

  close.addEventListener('click', function () {
    isOpen = false;
    win.classList.add('cb_hidden');
    btn.classList.remove('open');
  });

  // ── Input events ─────────────────────────────────────────────────────────
  inp.addEventListener('input', function () {
    send.disabled = !this.value.trim();
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  send.addEventListener('click', sendMessage);

})();
