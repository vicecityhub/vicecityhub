/* Vice City Hub AI Widget for static pages (Support Chat + Neural Search + Google Web Grounding + Recent Searches) */
(function () {
  if (typeof document === 'undefined') return;
  if (document.getElementById('vch-static-ai-root') || document.querySelector('[aria-label="Close AI assistant"]')) return;

  var ENDPOINT = 'https://lpglkglhjdqnktybksth.supabase.co/functions/v1/ai-support';
  var STORAGE_KEY = 'vch_recent_searches_v1';
  var state = {
    open: false,
    mode: 'support',
    webMode: 'auto',
    loading: false,
    searchCategory: 'all',
    messages: [
      {
        role: 'assistant',
        text: 'Welcome to Vice City Hub Support. Ask about FiveM RP servers, faction slots, Market orders, GTA VI news, or search the live web via Google Search in any language.',
        matches: [],
        webSources: []
      }
    ],
    searchAnswer: null,
    searchUsedWeb: false,
    searchMatches: [],
    searchWebSources: [],
    searchError: null,
    chatError: null,
    recent: loadRecent()
  };

  function loadRecent() {
    try {
      var raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveRecent(query, category, matchCount) {
    var norm = query.trim().toLowerCase();
    var filtered = state.recent.filter(function (x) {
      return !(String(x.query || '').toLowerCase() === norm && x.category === category);
    });
    state.recent = [{
      id: 'rs_' + Date.now(),
      query: query,
      category: category,
      timestamp: new Date().toISOString(),
      matchCount: matchCount || 0
    }].concat(filtered).slice(0, 8);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.recent));
    } catch (e) {}
  }

  function clearRecent() {
    state.recent = [];
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function safeUrl(u) {
    if (typeof u !== 'string') return 'https://vicecityhub.github.io/vicecityhub/';
    var s = u.trim();
    if (/^(https?:\/\/|fivem:\/\/|\/)/i.test(s)) return s;
    return 'https://vicecityhub.github.io/vicecityhub/';
  }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined) n.textContent = txt;
    return n;
  }

  var style = document.createElement('style');
  style.textContent = [
    '#vch-static-ai-root{position:fixed;left:16px;bottom:20px;z-index:40;display:flex;flex-direction:column;align-items:flex-start;gap:10px;font-family:Rajdhani,system-ui,sans-serif}',
    '#vch-static-ai-btn{display:flex;align-items:center;gap:8px;border-radius:9999px;border:1px solid rgba(0,255,255,.45);background:rgba(13,13,22,.92);color:#fff;padding:8px 14px;font-family:Orbitron,sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;box-shadow:0 0 18px rgba(0,255,255,.18)}',
    '#vch-static-ai-btn:hover{border-color:#FF00FF;color:#FF00FF}',
    '#vch-static-ai-panel{width:370px;max-width:calc(100vw - 32px);height:510px;display:flex;flex-direction:column;border-radius:12px;border:1px solid rgba(255,0,255,.4);background:rgba(13,13,22,.96);backdrop-filter:blur(18px);box-shadow:0 0 30px rgba(255,0,255,.22);overflow:hidden;color:#e5e7eb}',
    '.vch-ai-hdr{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.1)}',
    '.vch-ai-title{font-family:Orbitron,sans-serif;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fff}',
    '.vch-ai-sub{font-size:11px;color:#9ca3af}',
    '.vch-ai-pill{border:1px solid rgba(0,255,255,.4);background:rgba(0,255,255,.1);color:#00FFFF;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:700;text-transform:uppercase;cursor:pointer}',
    '.vch-ai-pill.off{border-color:rgba(255,255,255,.2);background:transparent;color:#9ca3af}',
    '.vch-ai-close{background:none;border:none;color:#9ca3af;font-size:18px;line-height:1;cursor:pointer;padding:2px 6px}',
    '.vch-ai-tabs{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.3)}',
    '.vch-ai-tab{background:none;border:none;border-bottom:2px solid transparent;color:#9ca3af;padding:8px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}',
    '.vch-ai-tab.on-pink{color:#FF00FF;border-bottom-color:#FF00FF;background:rgba(255,0,255,.06)}',
    '.vch-ai-tab.on-cyan{color:#00FFFF;border-bottom-color:#00FFFF;background:rgba(0,255,255,.06)}',
    '.vch-ai-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;font-size:13px}',
    '.vch-ai-msg{border-radius:8px;padding:9px 11px;line-height:1.45;white-space:pre-wrap}',
    '.vch-ai-msg.u{margin-left:28px;background:rgba(255,0,255,.18);border:1px solid rgba(255,0,255,.4);color:#fff}',
    '.vch-ai-msg.a{margin-right:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#e5e7eb}',
    '.vch-ai-links{margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:4px}',
    '.vch-ai-link{display:block;font-size:11px;color:#00FFFF;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.vch-ai-link.web{color:#7dd3fc}',
    '.vch-ai-link:hover{text-decoration:underline}',
    '.vch-ai-form{padding:10px;border-top:1px solid rgba(255,255,255,.1);display:flex;gap:8px}',
    '.vch-ai-inp{flex:1;border-radius:8px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.18);padding:7px 10px;color:#fff;font-size:12px;outline:none}',
    '.vch-ai-inp:focus{border-color:#00FFFF}',
    '.vch-ai-go{border-radius:8px;border:none;background:rgba(255,0,255,.85);color:#fff;padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer}',
    '.vch-ai-go.cyan{background:rgba(0,255,255,.18);border:1px solid rgba(0,255,255,.45);color:#00FFFF}',
    '.vch-ai-go:disabled{opacity:.45;cursor:not-allowed}',
    '.vch-ai-box{border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.35);padding:9px}',
    '.vch-ai-cats{display:flex;gap:4px;margin-top:6px;flex-wrap:wrap}',
    '.vch-ai-cat{border:none;background:none;color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;padding:3px 7px;border-radius:5px;cursor:pointer}',
    '.vch-ai-cat.on{background:rgba(0,255,255,.18);color:#00FFFF;border:1px solid rgba(0,255,255,.4)}',
    '.vch-ai-rec-btn{width:100%;display:flex;justify-content:space-between;align-items:center;gap:6px;background:none;border:none;color:#d1d5db;font-size:12px;padding:4px 0;cursor:pointer;text-align:left}',
    '.vch-ai-rec-btn:hover{color:#00FFFF}',
    '.vch-ai-err{font-size:12px;color:#fda4af;background:rgba(136,19,55,.35);border:1px solid rgba(244,63,94,.4);border-radius:6px;padding:7px 9px}'
  ].join('');
  document.head.appendChild(style);

  var rootEl = el('div');
  rootEl.id = 'vch-static-ai-root';
  document.body.appendChild(rootEl);

  function callApi(payload) {
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || ('AI service error (' + r.status + ')'));
        return d;
      });
    });
  }

  function render() {
    rootEl.textContent = '';
    if (state.open) {
      var panel = el('div');
      panel.id = 'vch-static-ai-panel';

      var hdr = el('div', 'vch-ai-hdr');
      var hdrLeft = el('div');
      hdrLeft.appendChild(el('div', 'vch-ai-title', 'Hub AI Assistant'));
      hdrLeft.appendChild(el('div', 'vch-ai-sub', 'Hub + Google Web Search'));
      hdr.appendChild(hdrLeft);

      var hdrRight = el('div');
      hdrRight.style.display = 'flex';
      hdrRight.style.gap = '6px';
      hdrRight.style.alignItems = 'center';

      var webBtn = el(
        'button',
        'vch-ai-pill' + (state.webMode === 'off' ? ' off' : ''),
        state.webMode === 'auto' ? 'Web: Auto' : state.webMode === 'always' ? 'Web: On' : 'Hub Only'
      );
      webBtn.type = 'button';
      webBtn.addEventListener('click', function () {
        state.webMode = state.webMode === 'auto' ? 'always' : state.webMode === 'always' ? 'off' : 'auto';
        render();
      });
      hdrRight.appendChild(webBtn);

      var closeBtn = el('button', 'vch-ai-close', 'x');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close AI assistant');
      closeBtn.addEventListener('click', function () { state.open = false; render(); });
      hdrRight.appendChild(closeBtn);
      hdr.appendChild(hdrRight);
      panel.appendChild(hdr);

      var tabs = el('div', 'vch-ai-tabs');
      var tSup = el('button', 'vch-ai-tab' + (state.mode === 'support' ? ' on-pink' : ''), 'Support Chat');
      tSup.type = 'button';
      tSup.addEventListener('click', function () { state.mode = 'support'; render(); });
      var tSrc = el('button', 'vch-ai-tab' + (state.mode === 'search' ? ' on-cyan' : ''), 'Neural Search');
      tSrc.type = 'button';
      tSrc.addEventListener('click', function () { state.mode = 'search'; render(); });
      tabs.appendChild(tSup);
      tabs.appendChild(tSrc);
      panel.appendChild(tabs);

      if (state.mode === 'support') {
        var body = el('div', 'vch-ai-body');
        state.messages.forEach(function (m) {
          var box = el('div', 'vch-ai-msg ' + (m.role === 'user' ? 'u' : 'a'), m.text);
          if (m.matches && m.matches.length) {
            var ml = el('div', 'vch-ai-links');
            m.matches.forEach(function (item) {
              var a = el('a', 'vch-ai-link', item.title);
              a.href = item.url;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              ml.appendChild(a);
            });
            box.appendChild(ml);
          }
          if (m.webSources && m.webSources.length) {
            var wl = el('div', 'vch-ai-links');
            wl.appendChild(el('div', 'vch-ai-sub', 'Web Sources (Google Search):'));
            m.webSources.forEach(function (src) {
              var a = el('a', 'vch-ai-link web', src.title || src.uri);
              a.href = safeUrl(src.uri);
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              wl.appendChild(a);
            });
            box.appendChild(wl);
          }
          body.appendChild(box);
        });
        if (state.loading) body.appendChild(el('div', 'vch-ai-sub', 'Thinking & checking live Hub/Web data...'));
        if (state.chatError) body.appendChild(el('div', 'vch-ai-err', state.chatError));
        panel.appendChild(body);
        setTimeout(function () { body.scrollTop = body.scrollHeight; }, 0);

        var form = el('form', 'vch-ai-form');
        var inp = el('input', 'vch-ai-inp');
        inp.type = 'text';
        inp.placeholder = 'Ask Hub or search the web (any language)...';
        var sendBtn = el('button', 'vch-ai-go', 'Send');
        sendBtn.type = 'submit';
        sendBtn.disabled = state.loading;
        form.appendChild(inp);
        form.appendChild(sendBtn);
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var q = inp.value.trim();
          if (!q || state.loading) return;
          state.chatError = null;
          var hist = state.messages.slice(1).map(function (m) { return { role: m.role, text: m.text }; });
          state.messages.push({ role: 'user', text: q });
          state.loading = true;
          render();
          callApi({
            action: 'chat',
            query: q,
            webSearch: state.webMode,
            messages: hist,
            pagePath: window.location.pathname
          }).then(function (d) {
            state.messages.push({
              role: 'assistant',
              text: d.answer || '',
              matches: (d.matches || []).slice(0, 4),
              webSources: (d.webSources || []).slice(0, 4)
            });
          }).catch(function (err) {
            state.chatError = err.message || 'Unable to reach Hub AI.';
          }).finally(function () {
            state.loading = false;
            render();
          });
        });
        panel.appendChild(form);
      } else {
        var sForm = el('form');
        sForm.style.padding = '10px';
        sForm.style.borderBottom = '1px solid rgba(255,255,255,.1)';
        var row = el('div');
        row.style.display = 'flex';
        row.style.gap = '6px';
        var sInp = el('input', 'vch-ai-inp');
        sInp.type = 'text';
        sInp.placeholder = 'Search Hub feeds or the web...';
        var sBtn = el('button', 'vch-ai-go cyan', state.loading ? '...' : 'Go');
        sBtn.type = 'submit';
        sBtn.disabled = state.loading;
        row.appendChild(sInp);
        row.appendChild(sBtn);
        sForm.appendChild(row);

        var cats = el('div', 'vch-ai-cats');
        [['all', 'All'], ['rp', 'RP'], ['news', 'News'], ['market', 'Market'], ['pages', 'Pages']].forEach(function (pair) {
          var cb = el('button', 'vch-ai-cat' + (state.searchCategory === pair[0] ? ' on' : ''), pair[1]);
          cb.type = 'button';
          cb.addEventListener('click', function () { state.searchCategory = pair[0]; render(); });
          cats.appendChild(cb);
        });
        sForm.appendChild(cats);
        panel.appendChild(sForm);

        var runSearch = function (q, cat) {
          var trimmed = q.trim();
          if (!trimmed || state.loading) return;
          state.searchError = null;
          state.loading = true;
          render();
          callApi({
            action: 'search',
            query: trimmed,
            category: cat || state.searchCategory,
            webSearch: state.webMode,
            pagePath: window.location.pathname
          }).then(function (d) {
            state.searchAnswer = d.answer || '';
            state.searchMatches = d.matches || [];
            state.searchWebSources = d.webSources || [];
            state.searchUsedWeb = Boolean(d.usedWebSearch);
            saveRecent(trimmed, cat || state.searchCategory, state.searchMatches.length);
          }).catch(function (err) {
            state.searchError = err.message || 'Search failed.';
          }).finally(function () {
            state.loading = false;
            render();
          });
        };

        sForm.addEventListener('submit', function (e) {
          e.preventDefault();
          runSearch(sInp.value, state.searchCategory);
        });

        var sBody = el('div', 'vch-ai-body');
        var recBox = el('div', 'vch-ai-box');
        var recHdr = el('div');
        recHdr.style.display = 'flex';
        recHdr.style.justifyContent = 'space-between';
        recHdr.style.marginBottom = '4px';
        recHdr.appendChild(el('span', 'vch-ai-sub', 'Recent Searches (' + state.recent.length + ')'));
        if (state.recent.length > 0) {
          var clr = el('button', 'vch-ai-cat', 'Clear');
          clr.type = 'button';
          clr.addEventListener('click', function () { clearRecent(); render(); });
          recHdr.appendChild(clr);
        }
        recBox.appendChild(recHdr);
        if (state.recent.length === 0) {
          recBox.appendChild(el('div', 'vch-ai-sub', 'Session search history appears here for one-click re-runs.'));
        } else {
          state.recent.forEach(function (item) {
            var rb = el('button', 'vch-ai-rec-btn', item.query);
            rb.type = 'button';
            rb.addEventListener('click', function () {
              state.searchCategory = item.category || 'all';
              runSearch(item.query, state.searchCategory);
            });
            recBox.appendChild(rb);
          });
        }
        sBody.appendChild(recBox);

        if (state.searchError) sBody.appendChild(el('div', 'vch-ai-err', state.searchError));
        if (state.searchAnswer) {
          var ansBox = el('div', 'vch-ai-box');
          ansBox.style.borderColor = 'rgba(0,255,255,.3)';
          ansBox.appendChild(el('div', 'vch-ai-sub', state.searchUsedWeb ? 'AI Answer (Web Grounded)' : 'AI Answer'));
          ansBox.appendChild(el('div', 'vch-ai-msg a', state.searchAnswer));
          sBody.appendChild(ansBox);
        }
        if (state.searchWebSources.length > 0) {
          var wsBox = el('div', 'vch-ai-box');
          wsBox.appendChild(el('div', 'vch-ai-sub', 'Web Sources (' + state.searchWebSources.length + ')'));
          state.searchWebSources.slice(0, 5).forEach(function (src) {
            var a = el('a', 'vch-ai-link web', src.title || src.uri);
            a.href = safeUrl(src.uri);
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            wsBox.appendChild(a);
          });
          sBody.appendChild(wsBox);
        }
        if (state.searchMatches.length > 0) {
          var mBox = el('div', 'vch-ai-box');
          mBox.appendChild(el('div', 'vch-ai-sub', 'Matched Hub Items (' + state.searchMatches.length + ')'));
          state.searchMatches.slice(0, 5).forEach(function (m) {
            var a = el('a', 'vch-ai-link', m.title);
            a.href = safeUrl(m.url);
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            mBox.appendChild(a);
          });
          sBody.appendChild(mBox);
        }
        panel.appendChild(sBody);
      }

      rootEl.appendChild(panel);
    }

    var toggle = el('button');
    toggle.id = 'vch-static-ai-btn';
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', state.open ? 'true' : 'false');
    toggle.textContent = state.open ? 'Hide AI' : 'Ask Hub AI';
    toggle.addEventListener('click', function () {
      state.open = !state.open;
      render();
    });
    rootEl.appendChild(toggle);
  }

  render();
})();
