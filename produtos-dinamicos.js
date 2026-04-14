/* ==========================================================
   produtos-dinamicos.js — Carrega produtos do admin (Firestore)
   e os renderiza dinamicamente nas páginas de categoria.
   ========================================================== */

(function() {
  var API = 'https://naredestore-api.onrender.com';

  // Detecta qual página é a atual pelo nome do arquivo
  var pagina = location.pathname.split('/').pop() || 'index.html';
  // Decodifica caracteres especiais (ex: Sele%C3%A7%C3%B5es.html → Seleções.html)
  try { pagina = decodeURIComponent(pagina); } catch(_) {}

  // Container onde os produtos serão inseridos
  var container = document.getElementById('produtos-row');
  if (!container) return;

  fetch(API + '/api/produtos?pagina=' + encodeURIComponent(pagina))
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.produtos || !data.produtos.length) return;

      // Mostra a seção de produtos do admin na index (escondida por padrão)
      var adminArea = document.getElementById('admin-produtos-area');
      if (adminArea) adminArea.style.display = 'block';

      data.produtos.forEach(function(p) {
        var card = document.createElement('div');
        card.className = 'produto';

        var precoFormatado = Number(p.preco).toLocaleString('pt-BR', {
          style: 'currency', currency: 'BRL'
        });

        card.innerHTML =
          '<p>' + escapeHtml(p.nome) + '</p>' +
          '<p class="tamanhos">Tamanhos: P | M | G | GG | XGG | XXG</p>' +
          (p.descricao ? '<p class="descricao-produto" style="font-size:0.78rem;color:#8b949e;margin:4px 0;">' + escapeHtml(p.descricao) + '</p>' : '') +
          (p.imagem ? '<img src="' + escapeHtml(p.imagem) + '" alt="' + escapeHtml(p.nome) + '" width="200" height="200" loading="lazy" decoding="async">' : '') +
          '<a href="#" class="preco">' + precoFormatado + '</a>';

        // Adicionar botão "Adicionar ao Carrinho"
        if (typeof criarBotaoCarrinho === 'function' && typeof adicionarAoCarrinho === 'function') {
          var nome = p.nome;
          var preco = Number(p.preco);
          var img = p.imagem || '';
          var btn = criarBotaoCarrinho(function() {
            adicionarAoCarrinho(nome, preco, img);
          });
          card.appendChild(btn);
        }

        container.appendChild(card);
      });
    })
    .catch(function(err) {
      console.warn('Erro ao carregar produtos dinâmicos:', err);
    });

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
