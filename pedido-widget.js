/* ==========================================================
   pedido-widget.js — Botão flutuante de acompanhamento de pedido
   Aparece em todas as páginas quando há um pedido recente.
   Clique → abre mini-painel com resumo; botão abre pedido.html
   ========================================================== */

(function () {
  var PEDIDO_KEY = 'nr_ultimo_pedido';
  var EXPIRY_DAYS = 30; // esconde após 30 dias

  var pedido = null;
  try { pedido = JSON.parse(localStorage.getItem(PEDIDO_KEY)); } catch (_) {}

  // Nada a mostrar
  if (!pedido || !pedido.id) return;

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
