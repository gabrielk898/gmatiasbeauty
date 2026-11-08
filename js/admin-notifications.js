/* =====================================================================
   gmatiasbeauty — Notificações do painel admin
   Sino flutuante com contador, lista de avisos, alerta na tela com som,
   notificação do navegador e atualização em tempo real (Supabase Realtime).
   Uso: <script src="js/admin-notifications.js"></script> no final do admin.html,
   DEPOIS do script do Supabase e do js/supabase-client.js.
   ===================================================================== */
(function () {
  'use strict';

  var LIMIT = 40;            // quantos avisos mostrar na lista
  var POLL_MS = 60000;       // verificação de segurança a cada 60s (se o Realtime cair)

  var client = null;
  var items = [];
  var seenIds = {};
  var started = false;
  var originalTitle = document.title;
  var audioCtx = null;
  var els = {};

  // ---------------------------------------------------------------------
  // Encontra o cliente Supabase já criado pelo js/supabase-client.js
  // ---------------------------------------------------------------------
  function findClient() {
    var c = null;
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.from) c = supabaseClient; } catch (e) {}
    try { if (!c && typeof sb !== 'undefined' && sb && sb.from) c = sb; } catch (e) {}
    try { if (!c && typeof supabase !== 'undefined' && supabase && supabase.from) c = supabase; } catch (e) {}
    if (!c && window.supabaseClient && window.supabaseClient.from) c = window.supabaseClient;
    if (!c && window.sb && window.sb.from) c = window.sb;
    if (!c && window.supabase && window.supabase.from) c = window.supabase;
    if (!c) {
      try {
        if (window.supabase && window.supabase.createClient &&
            typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') {
          c = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
      } catch (e) {}
    }
    return c;
  }

  function waitForClient(tries) {
    client = findClient();
    if (client) return init();
    if (tries > 40) {
      console.warn('[notificações] Cliente Supabase não encontrado.');
      return;
    }
    setTimeout(function () { waitForClient(tries + 1); }, 250);
  }

  // ---------------------------------------------------------------------
  // Só aparece para admins logados
  // ---------------------------------------------------------------------
  function init() {
    client.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (session) checkAdminAndStart(session.user);
    });
    client.auth.onAuthStateChange(function (event, session) {
      if (session && session.user) checkAdminAndStart(session.user);
      if (event === 'SIGNED_OUT') teardown();
    });
  }

  function checkAdminAndStart(user) {
    if (started) return;
    client.from('profiles').select('is_admin').eq('id', user.id).maybeSingle().then(function (res) {
      if (res.error) { console.warn('[notificações]', res.error.message); return; }
      if (!res.data || !res.data.is_admin || started) return;
      started = true;
      buildUI();
      load(true);
      subscribe();
      setInterval(function () { load(false); }, POLL_MS);
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) load(false);
      });
    });
  }

  function teardown() {
    started = false;
    if (els.root) els.root.remove();
    document.title = originalTitle;
  }

  // ---------------------------------------------------------------------
  // Dados
  // ---------------------------------------------------------------------
  function load(firstLoad) {
    return client.from('admin_appointment_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LIMIT)
      .then(function (res) {
        if (res.error) { console.warn('[notificações]', res.error.message); return; }
        var fresh = [];
        (res.data || []).forEach(function (n) {
          if (!seenIds[n.id]) {
            seenIds[n.id] = true;
            if (!firstLoad) fresh.push(n);
          }
        });
        items = res.data || [];
        render();
        fresh.reverse().forEach(alertNew);
      });
  }

  function subscribe() {
    try {
      client.channel('admin-notifications')
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'admin_appointment_alerts' },
          function (payload) {
            var n = payload.new;
            if (!n || seenIds[n.id]) return;
            seenIds[n.id] = true;
            items.unshift(n);
            if (items.length > LIMIT) items.pop();
            render();
            alertNew(n);
          })
        .subscribe();
    } catch (e) {
      console.warn('[notificações] Realtime indisponível, usando verificação periódica.', e);
    }
  }

  function markRead(ids) {
    if (!ids.length) return;
    items.forEach(function (n) { if (ids.indexOf(n.id) !== -1) n.is_read = true; });
    render();
    client.from('admin_appointment_alerts').update({ is_read: true }).in('id', ids).then(function (res) {
      if (res.error) console.warn('[notificações]', res.error.message);
    });
  }

  function markAllRead() {
    markRead(items.filter(function (n) { return !n.is_read; }).map(function (n) { return n.id; }));
  }

  // ---------------------------------------------------------------------
  // Alertas (toast, som, navegador)
  // ---------------------------------------------------------------------
  function alertNew(n) {
    showToast(n);
    beep();
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try {
        var notif = new Notification(n.title, { body: n.message || '', tag: 'gmb-' + n.id });
        notif.onclick = function () { window.focus(); openPanel(); notif.close(); };
      } catch (e) {}
    }
  }

  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      [0, 0.18].forEach(function (offset, i) {
        var o = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = i === 0 ? 880 : 1175;
        g.gain.setValueAtTime(0.0001, audioCtx.currentTime + offset);
        g.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + offset + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + offset + 0.25);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(audioCtx.currentTime + offset);
        o.stop(audioCtx.currentTime + offset + 0.3);
      });
    } catch (e) {}
  }

  function showToast(n) {
    var t = document.createElement('div');
    t.className = 'gmb-toast gmb-type-' + n.type;
    t.innerHTML =
      '<div class="gmb-toast-icon">' + icon(n.type) + '</div>' +
      '<div class="gmb-toast-body"><strong>' + esc(n.title) + '</strong><span>' + esc(n.message || '') + '</span></div>' +
      '<button class="gmb-toast-close" aria-label="Fechar">×</button>';
    t.querySelector('.gmb-toast-close').onclick = function (e) { e.stopPropagation(); t.remove(); };
    t.onclick = function () { t.remove(); openPanel(); };
    els.toasts.appendChild(t);
    setTimeout(function () { t.classList.add('gmb-hide'); }, 9000);
    setTimeout(function () { t.remove(); }, 9600);
  }

  // ---------------------------------------------------------------------
  // Interface
  // ---------------------------------------------------------------------
  function buildUI() {
    var style = document.createElement('style');
    style.textContent = [
      '#gmb-notif{position:fixed;right:20px;bottom:20px;z-index:99999;font-family:inherit}',
      '#gmb-bell{width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:#8a5a64;color:#fff;',
      ' box-shadow:0 6px 18px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;position:relative;transition:transform .15s}',
      '#gmb-bell:hover{transform:scale(1.06)}',
      '#gmb-bell svg{width:26px;height:26px}',
      '#gmb-bell.gmb-ring svg{animation:gmbRing .9s ease}',
      '@keyframes gmbRing{0%,100%{transform:rotate(0)}20%{transform:rotate(18deg)}40%{transform:rotate(-16deg)}60%{transform:rotate(10deg)}80%{transform:rotate(-6deg)}}',
      '#gmb-badge{position:absolute;top:-4px;right:-4px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#d93838;',
      ' color:#fff;font-size:12px;font-weight:700;display:none;align-items:center;justify-content:center;border:2px solid #fff;box-sizing:border-box}',
      '#gmb-panel{position:absolute;right:0;bottom:68px;width:360px;max-width:calc(100vw - 40px);max-height:70vh;background:#fff;color:#2b2b2b;',
      ' border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden}',
      '#gmb-panel.gmb-open{display:flex}',
      '.gmb-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #eee}',
      '.gmb-head strong{font-size:15px}',
      '.gmb-link{background:none;border:none;color:#8a5a64;cursor:pointer;font-size:12px;font-weight:600;padding:0}',
      '.gmb-perm{padding:10px 16px;background:#fbf4f5;font-size:12px;display:none;justify-content:space-between;align-items:center;gap:8px}',
      '.gmb-list{overflow-y:auto;flex:1}',
      '.gmb-item{display:flex;gap:10px;padding:12px 16px;border-bottom:1px solid #f3f3f3;cursor:pointer}',
      '.gmb-item:hover{background:#faf7f7}',
      '.gmb-item.gmb-unread{background:#fdf1f3}',
      '.gmb-item-icon{font-size:18px;line-height:1.2}',
      '.gmb-item-body{flex:1;min-width:0}',
      '.gmb-item-title{font-size:13px;font-weight:700;display:flex;justify-content:space-between;gap:8px}',
      '.gmb-item-title time{font-weight:400;color:#999;font-size:11px;white-space:nowrap}',
      '.gmb-item-msg{font-size:12.5px;color:#555;margin-top:2px;word-wrap:break-word}',
      '.gmb-dot{width:8px;height:8px;border-radius:50%;background:#d93838;margin-top:6px;flex-shrink:0}',
      '.gmb-empty{padding:30px 16px;text-align:center;color:#999;font-size:13px}',
      '#gmb-toasts{position:fixed;top:20px;right:20px;z-index:100000;display:flex;flex-direction:column;gap:10px;max-width:360px}',
      '.gmb-toast{display:flex;gap:10px;align-items:flex-start;background:#fff;color:#2b2b2b;border-radius:12px;padding:12px 14px;',
      ' box-shadow:0 10px 30px rgba(0,0,0,.2);border-left:5px solid #8a5a64;cursor:pointer;animation:gmbIn .3s ease;transition:opacity .5s,transform .5s}',
      '.gmb-toast.gmb-hide{opacity:0;transform:translateX(30px)}',
      '.gmb-toast.gmb-type-novo{border-left-color:#2e9e5b}',
      '.gmb-toast.gmb-type-cancelamento{border-left-color:#d93838}',
      '.gmb-toast.gmb-type-remarcacao{border-left-color:#e0a020}',
      '.gmb-toast-icon{font-size:20px}',
      '.gmb-toast-body{flex:1;display:flex;flex-direction:column;gap:2px;font-size:13px}',
      '.gmb-toast-body span{color:#555}',
      '.gmb-toast-close{background:none;border:none;font-size:18px;color:#999;cursor:pointer;line-height:1}',
      '@keyframes gmbIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}'
    ].join('\n');
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.id = 'gmb-notif';
    root.innerHTML =
      '<div id="gmb-panel" role="dialog" aria-label="Notificações">' +
        '<div class="gmb-head"><strong>Notificações</strong>' +
          '<button class="gmb-link" id="gmb-readall">Marcar todas como lidas</button></div>' +
        '<div class="gmb-perm" id="gmb-perm"><span>Receber alertas mesmo com a aba em segundo plano?</span>' +
          '<button class="gmb-link" id="gmb-perm-btn">Ativar</button></div>' +
        '<div class="gmb-list" id="gmb-list"></div>' +
      '</div>' +
      '<button id="gmb-bell" aria-label="Notificações">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
        '<span id="gmb-badge"></span>' +
      '</button>';
    document.body.appendChild(root);

    var toasts = document.createElement('div');
    toasts.id = 'gmb-toasts';
    document.body.appendChild(toasts);

    els = {
      root: root, toasts: toasts,
      bell: root.querySelector('#gmb-bell'),
      badge: root.querySelector('#gmb-badge'),
      panel: root.querySelector('#gmb-panel'),
      list: root.querySelector('#gmb-list'),
      perm: root.querySelector('#gmb-perm')
    };

    els.bell.onclick = function (e) {
      e.stopPropagation();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      els.panel.classList.contains('gmb-open') ? closePanel() : openPanel();
    };
    root.querySelector('#gmb-readall').onclick = function (e) { e.stopPropagation(); markAllRead(); };
    root.querySelector('#gmb-perm-btn').onclick = function (e) {
      e.stopPropagation();
      if ('Notification' in window) Notification.requestPermission().then(updatePermBox);
    };
    els.panel.onclick = function (e) { e.stopPropagation(); };
    document.addEventListener('click', closePanel);

    // destrava o som no primeiro clique da página
    document.addEventListener('click', function unlock() {
      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        audioCtx.resume();
      } catch (e) {}
      document.removeEventListener('click', unlock);
    });

    updatePermBox();
  }

  function updatePermBox() {
    var show = ('Notification' in window) && Notification.permission === 'default';
    els.perm.style.display = show ? 'flex' : 'none';
  }

  function openPanel() { els.panel.classList.add('gmb-open'); updatePermBox(); }
  function closePanel() { if (els.panel) els.panel.classList.remove('gmb-open'); }

  function render() {
    if (!els.list) return;
    var unread = items.filter(function (n) { return !n.is_read; }).length;

    els.badge.textContent = unread > 99 ? '99+' : String(unread);
    els.badge.style.display = unread ? 'flex' : 'none';
    document.title = unread ? '(' + unread + ') ' + originalTitle : originalTitle;

    if (!items.length) {
      els.list.innerHTML = '<div class="gmb-empty">Nenhuma notificação ainda.</div>';
      return;
    }
    els.list.innerHTML = items.map(function (n) {
      return '<div class="gmb-item' + (n.is_read ? '' : ' gmb-unread') + '" data-id="' + n.id + '">' +
        '<div class="gmb-item-icon">' + icon(n.type) + '</div>' +
        '<div class="gmb-item-body">' +
          '<div class="gmb-item-title"><span>' + esc(n.title) + '</span><time>' + timeAgo(n.created_at) + '</time></div>' +
          '<div class="gmb-item-msg">' + esc(n.message || '') + '</div>' +
        '</div>' +
        (n.is_read ? '' : '<div class="gmb-dot"></div>') +
      '</div>';
    }).join('');

    Array.prototype.forEach.call(els.list.querySelectorAll('.gmb-item'), function (el) {
      el.onclick = function () {
        var id = Number(el.getAttribute('data-id'));
        var n = items.filter(function (x) { return x.id === id; })[0];
        if (n && !n.is_read) markRead([id]);
      };
    });

    if (unread) {
      els.bell.classList.remove('gmb-ring');
      void els.bell.offsetWidth;
      els.bell.classList.add('gmb-ring');
    }
  }

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------
  function icon(type) {
    return { novo: '✅', cancelamento: '❌', remarcacao: '🔁', alteracao: '✏️' }[type] || '🔔';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function timeAgo(iso) {
    var diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'agora';
    if (diff < 3600) return Math.floor(diff / 60) + ' min';
    if (diff < 86400) return Math.floor(diff / 3600) + ' h';
    if (diff < 604800) return Math.floor(diff / 86400) + ' d';
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  // atualiza o "há X min" a cada minuto
  setInterval(function () { if (started) render(); }, 60000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { waitForClient(0); });
  } else {
    waitForClient(0);
  }
})();
