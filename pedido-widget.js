/* ==========================================================
   pedido-widget.js — Botão "Meu Pedido" no header, ao lado do Carrinho
   Aparece em todas as páginas quando há um pedido recente.
   Clique → abre dropdown com resumo; botão abre pedido.html
   ========================================================== */

(function () {
  var PEDIDO_KEY  = 'nr_ultimo_pedido';
  var EXPIRY_DAYS = 30;

  var pedido = null;
  try { pedido = JSON.parse(localStorage.getItem(PEDIDO_KEY)); } catch (_) {}

  if (!pedido || !pedido.id) return;

  // Só mostra se o usuário estiver logado
  var usuarioAtual = null;
  try { usuarioAtual = JSON.parse(localStorage.getItem('naredestoreUser')); } catch (_) {}
  if (!usuarioAtual || !usuarioAtual.email) return;
  // Pedido sem dono OU de outro usuário — não exibe
  if (!pedido.userEmail || pedido.userEmail !== usuarioAtual.email) return;

  if (pedido.data) {
    var diff = (Date.now() - new Date(pedido.data).getTime()) / (1000 * 60 * 60 * 24);
    if (diff > EXPIRY_DAYS) return;
  }

  // ── Verifica status no servidor ──────────────────────────
  var API_URL = 'https://naredestore-api.onrender.com';
  (function verificarStatusServidor() {
    fetch(API_URL + '/api/meu-pedido?email=' + encodeURIComponent(usuarioAtual.email))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.pedidos && data.pedidos.length > 0) {
          var ultimo = data.pedidos[0];
          if (ultimo.status === 'cancelado') {
            localStorage.removeItem(PEDIDO_KEY);
            var w = document.getElementById('nr-ped-wrap');
            if (w) w.style.display = 'none';
          }
        }
      })
      .catch(function() { /* silencioso */ });
  })();

  // ── Helpers ──────────────────────────────────────────────
  function diasUteis(date, n) {
    var d = new Date(date);
    var adicionados = 0;
    while (adicionados < n) {
      d.setDate(d.getDate() + 1);
      var dia = d.getDay();
      if (dia !== 0 && dia !== 6) adicionados++;
    }
    return d;
  }
  function fmt(date) {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  // ── Calcula etapa atual ───────────────────────────────────
  var ETAPAS = [
    { label: 'Pedido Confirmado', dias: 0  },
    { label: 'Separando Itens',   dias: 1  },
    { label: 'Pedido Enviado',    dias: 2  },
    { label: 'Em Trânsito',       dias: 5  },
    { label: 'Saiu p/ Entrega',   dias: 10 },
    { label: 'Entregue',          dias: 12 },
  ];

  var pedidoDate   = pedido.data ? new Date(pedido.data) : new Date();
  var diasPassados = Math.floor((Date.now() - pedidoDate.getTime()) / (1000 * 60 * 60 * 24));
  var etapaAtual   = ETAPAS[0];
  var etapaIdx     = 0;
  for (var i = 0; i < ETAPAS.length; i++) {
    if (diasPassados >= ETAPAS[i].dias) { etapaAtual = ETAPAS[i]; etapaIdx = i; }
  }

  var progress     = Math.round(((etapaIdx) / (ETAPAS.length - 1)) * 100);
  var entregaMin   = diasUteis(pedidoDate, 7);
  var entregaMax   = diasUteis(pedidoDate, 12);
  var nPedido      = '#NR' + String(pedido.id).slice(-6);
  var total        = pedido.total ? 'R$ ' + Number(pedido.total).toFixed(2).replace('.', ',') : '—';
  var metodos      = { pix: 'PIX', cartao: 'Cartão', boleto: 'Boleto' };
  var metodoLabel  = metodos[pedido.metodo] || pedido.metodo || '—';

  // ── CSS ────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    /* wrapper relativo para o dropdown */
    '#nr-ped-wrap{position:relative;display:inline-flex;align-items:center;}',

    /* botão — imita .user-link do header */
    '#nr-ped-btn{display:flex;align-items:center;gap:6px;background:none;border:none;',
    'cursor:pointer;color:#fff;font-family:Poppins,sans-serif;font-size:.9rem;',
    'padding:6px 10px;border-radius:8px;transition:background .2s;white-space:nowrap;}',
    '#nr-ped-btn:hover{background:rgba(66,43,255,.15);}',
    'body.light-mode #nr-ped-btn{color:#111;}',

    /* ponto verde pulsante */
    '#nr-ped-dot{width:8px;height:8px;border-radius:50%;background:#00c853;flex-shrink:0;',
    'animation:nr-pulse-dot 1.8s infinite;}',
    '@keyframes nr-pulse-dot{0%,100%{box-shadow:0 0 0 2px rgba(0,200,83,.3);}',
    '50%{box-shadow:0 0 0 5px rgba(0,200,83,.08);}}',

    /* ícone caminhão */
    '#nr-ped-btn .nr-icon{font-size:1.1rem;line-height:1;}',

    /* dropdown */
    '#nr-ped-dropdown{display:none;position:absolute;top:calc(100% + 12px);right:0;',
    'width:270px;background:#161b22;border:1px solid rgba(66,43,255,.3);',
    'border-radius:14px;padding:16px;z-index:999999;',
    'box-shadow:0 12px 40px rgba(0,0,0,.55);}',
    'body.light-mode #nr-ped-dropdown{background:#fff;border-color:#e0e0e0;',
    'box-shadow:0 8px 30px rgba(0,0,0,.12);}',
    '#nr-ped-dropdown.open{display:block;}',

    /* cabeçalho do dropdown */
    '.nr-drop-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}',
    '.nr-drop-head span{color:#f0f6fc;font-size:.85rem;font-weight:700;}',
    'body.light-mode .nr-drop-head span{color:#111;}',
    '.nr-drop-close{background:none;border:none;color:#8b949e;cursor:pointer;font-size:1.1rem;line-height:1;padding:0;}',
    '.nr-drop-close:hover{color:#fff;}',
    'body.light-mode .nr-drop-close:hover{color:#111;}',

    /* barra de progresso */
    '.nr-prog-bar{height:5px;background:#30363d;border-radius:99px;margin-bottom:6px;}',
    '.nr-prog-fill{height:100%;background:linear-gradient(90deg,#422BFF,#00c853);',
    'border-radius:99px;transition:width .5s;}',
    '.nr-prog-label{font-size:.78rem;color:#00c853;font-weight:600;margin-bottom:12px;}',

    /* info */
    '.nr-drop-info{font-size:.78rem;color:#8b949e;line-height:1.9;border-top:1px solid #30363d;',
    'padding-top:10px;margin-bottom:12px;}',
    'body.light-mode .nr-drop-info{border-color:#eee;color:#666;}',
    '.nr-drop-info b{color:#f0f6fc;}',
    'body.light-mode .nr-drop-info b{color:#111;}',

    /* botão ver mais */
    '#nr-ped-link{display:block;text-align:center;padding:8px;background:#422BFF;',
    'color:#fff;border-radius:8px;text-decoration:none;font-size:.83rem;font-weight:600;',
    'transition:background .2s;}',
    '#nr-ped-link:hover{background:#351ECC;}',

    /* botão cancelar */
    '#nr-ped-cancelar{display:block;width:100%;text-align:center;padding:8px;margin-top:8px;',
    'background:transparent;color:#dc3545;border:1px solid #dc3545;border-radius:8px;',
    'font-size:.78rem;font-weight:600;cursor:pointer;transition:background .2s,color .2s;}',
    '#nr-ped-cancelar:hover{background:#dc3545;color:#fff;}',
  ].join('');
  document.head.appendChild(style);

  // ── HTML ──────────────────────────────────────────────────
  var wrap = document.createElement('div');
  wrap.id = 'nr-ped-wrap';
  wrap.innerHTML =
    '<button id="nr-ped-btn" title="Acompanhar meu pedido">' +
      '<span id="nr-ped-dot"></span>' +
      '<span class="nr-icon">🚚</span>' +
      '<span class="label"><b>Meu Pedido</b></span>' +
    '</button>' +
    '<div id="nr-ped-dropdown">' +
      '<div class="nr-drop-head">' +
        '<span>🚚 Acompanhar Pedido</span>' +
        '<button class="nr-drop-close" id="nr-ped-close">×</button>' +
      '</div>' +
      '<div class="nr-prog-bar"><div class="nr-prog-fill" style="width:' + progress + '%"></div></div>' +
      '<div class="nr-prog-label">' + etapaAtual.label + '</div>' +
      '<div class="nr-drop-info">' +
        '<b>Pedido:</b> ' + nPedido + '<br>' +
        '<b>Pagamento:</b> ' + metodoLabel + '<br>' +
        '<b>Total:</b> ' + total + '<br>' +
        '<b>Entrega:</b> ' + fmt(entregaMin) + ' – ' + fmt(entregaMax) +
      '</div>' +
      '<a href="pedido.html" id="nr-ped-link">Ver acompanhamento completo →</a>' +
      '<button id="nr-ped-cancelar">Cancelar Pedido</button>' +
    '</div>';

  // ── Insere antes do link do Carrinho no .user-bar ─────────
  function inserir() {
    // Tenta achar o link do carrinho no header pelo href
    var cartLink = document.querySelector('.user-bar a[href="checkout.html"]');
    if (cartLink) {
      cartLink.parentNode.insertBefore(wrap, cartLink);
      return true;
    }
    // Fallback: qualquer .user-bar
    var userBar = document.querySelector('.user-bar');
    if (userBar) {
      userBar.appendChild(wrap);
      return true;
    }
    return false;
  }

  // Tenta inserir imediatamente; se DOM ainda não estiver pronto, aguarda
  if (!inserir()) {
    document.addEventListener('DOMContentLoaded', inserir);
  }

  // ── Lógica abrir/fechar ───────────────────────────────────
  document.addEventListener('click', function (e) {
    var btn      = document.getElementById('nr-ped-btn');
    var dropdown = document.getElementById('nr-ped-dropdown');
    var closeBtn = document.getElementById('nr-ped-close');
    var cancelBtn = document.getElementById('nr-ped-cancelar');
    if (!btn || !dropdown) return;

    if (cancelBtn && cancelBtn.contains(e.target)) {
      // Não fechar dropdown ao clicar no cancelar
      return;
    } else if (btn.contains(e.target)) {
      dropdown.classList.toggle('open');
    } else if (closeBtn && closeBtn.contains(e.target)) {
      dropdown.classList.remove('open');
    } else if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  // ── Cancelar pedido pelo cliente ──────────────────────────
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'nr-ped-cancelar') {
      if (!confirm('Tem certeza que deseja cancelar seu pedido? O valor será estornado.')) return;

      var cancelBtn = e.target;
      cancelBtn.disabled = true;
      cancelBtn.textContent = 'Cancelando...';

      // Busca pedido no servidor para obter o ID real
      fetch(API_URL + '/api/meu-pedido?email=' + encodeURIComponent(usuarioAtual.email))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data.pedidos || !data.pedidos.length) {
            throw new Error('Pedido não encontrado no servidor.');
          }
          var pedidoServidor = data.pedidos[0];
          return fetch(API_URL + '/api/cancelar-pedido', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pedidoId: pedidoServidor.id, email: usuarioAtual.email })
          });
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.error) throw new Error(data.error);
          alert('Pedido cancelado com sucesso! Você receberá o estorno e um email de confirmação.');
          localStorage.removeItem(PEDIDO_KEY);
          var w = document.getElementById('nr-ped-wrap');
          if (w) w.style.display = 'none';
        })
        .catch(function(err) {
          alert('Erro ao cancelar: ' + err.message);
          cancelBtn.disabled = false;
          cancelBtn.textContent = 'Cancelar Pedido';
        });
    }
  });

  // Esconde na própria página pedido.html
  if (window.location.pathname.includes('pedido.html')) {
    document.addEventListener('DOMContentLoaded', function () {
      var w = document.getElementById('nr-ped-wrap');
      if (w) w.style.display = 'none';
    });
  }
})();


(function () {
  var PEDIDO_KEY = 'nr_ultimo_pedido';
  var EXPIRY_DAYS = 30; // esconde após 30 dias

  var pedido = null;
  try { pedido = JSON.parse(localStorage.getItem(PEDIDO_KEY)); } catch (_) {}

  // Nada a mostrar
  if (!pedido || !pedido.id) return;

  // Só mostra se o usuário estiver logado
  var usuarioAtual = null;
  try { usuarioAtual = JSON.parse(localStorage.getItem('naredestoreUser')); } catch (_) {}
  if (!usuarioAtual || !usuarioAtual.email) return;
  // Pedido sem dono OU de outro usuário — não exibe
  if (!pedido.userEmail || pedido.userEmail !== usuarioAtual.email) return;

  // Expirado?
  if (pedido.data) {
    var diff = (Date.now() - new Date(pedido.data).getTime()) / (1000 * 60 * 60 * 24);
    if (diff > EXPIRY_DAYS) return;
  }

  // ── Helpers ──────────────────────────────────────────────
  function diasUteis(date, n) {
    var d = new Date(date);
    var adicionados = 0;
    while (adicionados < n) {
      d.setDate(d.getDate() + 1);
      var dia = d.getDay();
      if (dia !== 0 && dia !== 6) adicionados++;
    }
    return d;
  }

  function fmt(date) {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ── Calcula etapa atual ───────────────────────────────────
  var ETAPAS = [
    { id: 'confirmado', label: 'Pedido Confirmado',  dias: 0  },
    { id: 'separando',  label: 'Separando Itens',    dias: 1  },
    { id: 'enviado',    label: 'Pedido Enviado',      dias: 2  },
    { id: 'transito',   label: 'Em Trânsito',         dias: 5  },
    { id: 'saiu',       label: 'Saiu p/ Entrega',     dias: 10 },
    { id: 'entregue',   label: 'Entregue',            dias: 12 },
  ];

  var pedidoDate  = pedido.data ? new Date(pedido.data) : new Date();
  var diasPassados = Math.floor((Date.now() - pedidoDate.getTime()) / (1000 * 60 * 60 * 24));
  var etapaAtual  = ETAPAS[0];

  for (var i = 0; i < ETAPAS.length; i++) {
    if (diasPassados >= ETAPAS[i].dias) etapaAtual = ETAPAS[i];
  }

  var metodos = { pix: 'PIX', cartao: 'Cartão', boleto: 'Boleto' };
  var nPedido = '#NR' + String(pedido.id).slice(-6);
  var entregaMin = diasUteis(pedidoDate, 7);
  var entregaMax = diasUteis(pedidoDate, 12);

  // ── Injetar CSS ───────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#nr-pedido-widget{position:fixed;bottom:24px;left:24px;z-index:999990;font-family:Poppins,sans-serif;}',

    /* botão flutuante */
    '#nr-ped-btn{display:flex;align-items:center;gap:8px;padding:10px 16px;',
    'background:linear-gradient(135deg,#422BFF,#6C4EFF);color:#fff;border:none;',
    'border-radius:50px;cursor:pointer;font-size:.85rem;font-weight:600;',
    'box-shadow:0 6px 24px rgba(66,43,255,.45);transition:transform .2s;}',
    '#nr-ped-btn:hover{transform:translateY(-2px);}',
    '#nr-ped-badge{background:#00c853;color:#fff;border-radius:50%;width:8px;height:8px;',
    'flex-shrink:0;animation:nr-pulse 1.8s infinite;}',
    '@keyframes nr-pulse{0%,100%{box-shadow:0 0 0 3px rgba(0,200,83,.3);}',
    '50%{box-shadow:0 0 0 6px rgba(0,200,83,.08);}}',

    /* painel */
    '#nr-ped-painel{display:none;position:absolute;bottom:56px;left:0;width:290px;',
    'background:#161b22;border:1px solid rgba(66,43,255,.3);border-radius:16px;',
    'padding:18px;box-shadow:0 16px 48px rgba(0,0,0,.5);}',
    'body.light-mode #nr-ped-painel{background:#fff;border-color:#e0e0e0;box-shadow:0 8px 32px rgba(0,0,0,.12);}',
    '#nr-ped-painel h4{color:#f0f6fc;font-size:.88rem;margin:0 0 12px;display:flex;justify-content:space-between;align-items:center;}',
    'body.light-mode #nr-ped-painel h4{color:#111;}',
    '#nr-ped-fechar{background:none;border:none;color:#8b949e;cursor:pointer;font-size:1.1rem;line-height:1;}',
    '#nr-ped-fechar:hover{color:#f0f6fc;}',
    'body.light-mode #nr-ped-fechar:hover{color:#111;}',

    /* progresso */
    '.nr-ped-steps{display:flex;flex-direction:column;gap:7px;margin-bottom:14px;}',
    '.nr-ped-step{display:flex;align-items:center;gap:8px;font-size:.78rem;color:#8b949e;}',
    '.nr-ped-step.done{color:#00c853;}',
    '.nr-ped-step.active{color:#f0f6fc;font-weight:600;}',
    'body.light-mode .nr-ped-step.active{color:#111;}',
    '.nr-ped-dot{width:10px;height:10px;border-radius:50%;background:#30363d;flex-shrink:0;}',
    '.nr-ped-step.done .nr-ped-dot{background:#00c853;}',
    '.nr-ped-step.active .nr-ped-dot{background:#422BFF;box-shadow:0 0 0 3px rgba(66,43,255,.25);}',

    /* info */
    '.nr-ped-info{border-top:1px solid #30363d;padding-top:12px;margin-bottom:12px;font-size:.78rem;color:#8b949e;line-height:1.8;}',
    'body.light-mode .nr-ped-info{border-color:#eee;color:#666;}',
    '.nr-ped-info strong{color:#f0f6fc;}',
    'body.light-mode .nr-ped-info strong{color:#111;}',

    /* botão ver pedido */
    '#nr-ped-link{display:block;text-align:center;padding:9px;background:#422BFF;color:#fff;',
    'border-radius:10px;text-decoration:none;font-size:.85rem;font-weight:600;transition:background .2s;}',
    '#nr-ped-link:hover{background:#351ECC;}',

    /* esconder na própria página de pedido */
    '.page-pedido #nr-pedido-widget{display:none !important;}',
  ].join('');
  document.head.appendChild(style);

  // ── HTML do widget ────────────────────────────────────────
  var wrapper = document.createElement('div');
  wrapper.id = 'nr-pedido-widget';

  // Monta etapas
  var stepsHtml = ETAPAS.map(function (e) {
    var cls = diasPassados >= e.dias ? (e.id === etapaAtual.id ? 'nr-ped-step active' : 'nr-ped-step done') : 'nr-ped-step';
    return '<div class="' + cls + '"><div class="nr-ped-dot"></div>' + e.label + '</div>';
  }).join('');

  var total = pedido.total ? 'R$ ' + Number(pedido.total).toFixed(2).replace('.', ',') : '—';
  var metodoLabel = metodos[pedido.metodo] || pedido.metodo || '—';

  wrapper.innerHTML =
    '<div id="nr-ped-painel">' +
      '<h4>🚚 Meu Pedido <button id="nr-ped-fechar" title="Fechar">×</button></h4>' +
      '<div class="nr-ped-steps">' + stepsHtml + '</div>' +
      '<div class="nr-ped-info">' +
        '<strong>Pedido:</strong> ' + nPedido + '<br>' +
        '<strong>Status:</strong> ' + etapaAtual.label + '<br>' +
        '<strong>Pagamento:</strong> ' + metodoLabel + '<br>' +
        '<strong>Total:</strong> ' + total + '<br>' +
        '<strong>Entrega:</strong> ' + fmt(entregaMin) + ' – ' + fmt(entregaMax) +
      '</div>' +
      '<a href="pedido.html" id="nr-ped-link">Ver acompanhamento completo →</a>' +
    '</div>' +
    '<button id="nr-ped-btn">' +
      '<span id="nr-ped-badge"></span>' +
      '🚚 Meu Pedido · <span id="nr-ped-status-label">' + etapaAtual.label + '</span>' +
    '</button>';

  document.body.appendChild(wrapper);

  // ── Lógica de abrir/fechar ────────────────────────────────
  var painel  = document.getElementById('nr-ped-painel');
  var btn     = document.getElementById('nr-ped-btn');
  var fechar  = document.getElementById('nr-ped-fechar');

  btn.addEventListener('click', function () {
    painel.style.display = painel.style.display === 'block' ? 'none' : 'block';
  });

  fechar.addEventListener('click', function (e) {
    e.stopPropagation();
    painel.style.display = 'none';
  });

  document.addEventListener('click', function (e) {
    if (!wrapper.contains(e.target)) painel.style.display = 'none';
  });

  // Esconde na própria página pedido.html (evita redundância)
  if (window.location.pathname.includes('pedido.html')) {
    wrapper.style.display = 'none';
  }
})();
