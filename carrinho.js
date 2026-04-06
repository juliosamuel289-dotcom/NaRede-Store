/* ==========================================================
   carrinho.js — Sistema de carrinho de compras NaRede Store
   Usa localStorage para persistir itens entre páginas
   ========================================================== */

// ── Helpers ──────────────────────────────────────────────

function getCarrinho() {
  try {
    return JSON.parse(localStorage.getItem('nr_carrinho') || '[]');
  } catch (_) {
    return [];
  }
}

function setCarrinho(carrinho) {
  localStorage.setItem('nr_carrinho', JSON.stringify(carrinho));
}

function atualizarBadges() {
  const carrinho = getCarrinho();
  const total = carrinho.reduce(function(sum, item) { return sum + item.qtd; }, 0);
  document.querySelectorAll('.cart-badge').forEach(function(badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
  });
}

// ── Toast de confirmação ──────────────────────────────────

function mostrarToast(nome) {
  var existente = document.getElementById('nr-toast');
  if (existente) existente.remove();

  var toast = document.createElement('div');
  toast.id = 'nr-toast';
  toast.textContent = '🛒 "' + nome + '" adicionado ao carrinho!';
  toast.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'right:24px',
    'z-index:999999',
    'background:#422BFF',
    'color:#fff',
    'padding:12px 20px',
    'border-radius:10px',
    'font-size:0.92rem',
    'font-family:Poppins,sans-serif',
    'box-shadow:0 6px 20px rgba(66,43,255,0.35)',
    'opacity:0',
    'transition:opacity 0.25s ease'
  ].join(';');

  document.body.appendChild(toast);

  requestAnimationFrame(function() {
    toast.style.opacity = '1';
  });

  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 300);
  }, 2500);
}

// ── Adicionar ao carrinho ─────────────────────────────────

function adicionarAoCarrinho(nome, preco, img) {
  var carrinho = getCarrinho();
  var idx = carrinho.findIndex(function(item) { return item.nome === nome; });
  if (idx >= 0) {
    carrinho[idx].qtd++;
  } else {
    carrinho.push({ nome: nome, preco: preco, img: img, qtd: 1 });
  }
  setCarrinho(carrinho);
  atualizarBadges();
  mostrarToast(nome);
}

// ── Injetar botão nos cards ───────────────────────────────

function criarBotaoCarrinho(onClickFn) {
  var btn = document.createElement('button');
  btn.className = 'btn-add-cart';
  btn.innerHTML = '🛒 Adicionar ao Carrinho';
  btn.setAttribute('style', [
    'display:block !important',
    'width:100% !important',
    'margin-top:10px !important',
    'padding:9px 14px !important',
    'background:#422BFF !important',
    'color:#fff !important',
    'border:none !important',
    'border-radius:8px !important',
    'font-size:0.88rem !important',
    'font-weight:600 !important',
    'cursor:pointer !important',
    'font-family:Poppins,sans-serif !important',
    'transition:background 0.2s !important',
    'text-align:center !important'
  ].join(';'));
  btn.addEventListener('mouseenter', function() { btn.style.setProperty('background', '#351ECC', 'important'); });
  btn.addEventListener('mouseleave', function() { btn.style.setProperty('background', '#422BFF', 'important'); });
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    onClickFn();
  });
  return btn;
}

// ── Inicialização ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  atualizarBadges();

  // Produtos do tipo .produto (Destaques, Brasileiras, Seleções, Internacional)
  document.querySelectorAll('.produto').forEach(function(produto) {
    var nameEl  = produto.querySelector('p:first-of-type');
    var imgEl   = produto.querySelector('img');
    var precoEl = produto.querySelector('a.preco');
    if (!precoEl) return;

    // Impede navegação padrão do link de preço
    precoEl.addEventListener('click', function(e) { e.preventDefault(); });

    var nome  = nameEl  ? nameEl.textContent.trim()  : 'Produto';
    var preco = precoEl ? precoEl.textContent.trim()  : '';
    var img   = imgEl   ? imgEl.src                  : '';

    var btn = criarBotaoCarrinho(function() {
      adicionarAoCarrinho(nome, preco, img);
    });

    produto.appendChild(btn);
  });

  // Produtos do tipo .produto-card (index.html — cards detalhados)
  document.querySelectorAll('.produto-card').forEach(function(card) {
    var nameEl  = card.querySelector('h3');
    var precoEl = card.querySelector('a.preco-pix');
    if (!precoEl) return;

    // Tenta pegar a imagem principal do bloco .product-horizontal pai
    var parentHorizontal = card.closest('.product-horizontal') || card.closest('.produtos-container');
    var imgEl = parentHorizontal
      ? parentHorizontal.querySelector('img[id^="mainProductImage"]')
      : null;

    precoEl.addEventListener('click', function(e) { e.preventDefault(); });

    var nome  = nameEl  ? nameEl.textContent.trim()  : 'Produto';
    var preco = precoEl ? precoEl.textContent.trim()  : '';
    var img   = imgEl   ? imgEl.src                  : '';

    var btn = criarBotaoCarrinho(function() {
      adicionarAoCarrinho(nome, preco, img);
    });

    card.appendChild(btn);
  });
});
