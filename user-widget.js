(function() {
  const USER_KEY = 'naredestoreUser';
  const CART_HISTORY_KEY = 'naredestoreCartHistory';

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch (err) {
      return null;
    }
  }

  function getCartHistory() {
    try {
      return JSON.parse(localStorage.getItem(CART_HISTORY_KEY) || '[]');
    } catch (err) {
      return [];
    }
  }

  function saveDefaultCartHistory() {
    if (!localStorage.getItem(CART_HISTORY_KEY)) {
      localStorage.setItem(CART_HISTORY_KEY, JSON.stringify([]));
    }
  }

  function createStyle() {
    const css = `
      .user-bar .status {
        display: block;
        font-size: 0.75rem;
        color: #8bfbce;
        margin-top: 2px;
        letter-spacing: 0.02em;
      }
      .user-panel {
        position: fixed;
        top: 86px;
        right: 20px;
        width: 300px;
        max-width: calc(100% - 32px);
        background: rgba(16, 18, 25, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 18px;
        box-shadow: 0 28px 60px rgba(0, 0, 0, 0.25);
        padding: 18px;
        z-index: 99999;
        display: none;
        color: #f5f7fb;
      }
      .user-panel.open {
        display: block;
      }
      .user-panel h3 {
        margin: 0 0 12px;
        font-size: 1rem;
        letter-spacing: 0.01em;
      }
      .user-panel p {
        margin: 0 0 16px;
        font-size: 0.9rem;
        color: #c8cdd5;
        line-height: 1.5;
      }
      .user-panel button,
      .user-panel .user-panel-link {
        display: block;
        width: 100%;
        text-align: left;
        border: none;
        background: rgba(255, 255, 255, 0.06);
        color: #f5f7fb;
        padding: 12px 14px;
        margin-bottom: 10px;
        border-radius: 12px;
        cursor: pointer;
        font-size: 0.95rem;
        text-decoration: none;
      }
      .user-panel button:hover,
      .user-panel .user-panel-link:hover {
        background: rgba(66, 43, 255, 0.18);
      }
      .user-panel .history-item {
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.05);
        margin-bottom: 10px;
        font-size: 0.9rem;
        color: #ebf1ff;
      }
      .user-panel .history-empty {
        font-size: 0.9rem;
        color: #a0a8b8;
      }
      .user-panel .close-panel {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
        cursor: pointer;
        font-size: 1rem;
        line-height: 1;
      }
      /* Modo claro */
      body.light-mode .user-panel {
        background: #ffffff !important;
        border: 1px solid #e0e0e0 !important;
        box-shadow: 0 12px 40px rgba(0,0,0,0.12) !important;
        color: #222 !important;
      }
      body.light-mode .user-panel h3 { color: #222 !important; }
      body.light-mode .user-panel p { color: #555 !important; }
      body.light-mode .user-panel button,
      body.light-mode .user-panel .user-panel-link {
        background: #f5f5f5 !important;
        color: #222 !important;
      }
      body.light-mode .user-panel button:hover,
      body.light-mode .user-panel .user-panel-link:hover {
        background: rgba(66, 43, 255, 0.12) !important;
      }
      body.light-mode .user-panel .close-panel {
        background: #eee !important;
        color: #222 !important;
      }
      body.light-mode .user-panel .history-item {
        background: #f0f0f0 !important;
        color: #222 !important;
      }
      body.light-mode .user-panel .history-empty {
        color: #888 !important;
      }
      .user-bar .user-link[data-user="true"] {
        pointer-events: auto;
      }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    return style;
  }

  function getFirstName(value) {
    if (!value) return 'Cliente';
    return value.split(' ')[0];
  }

  function renderUserPanel(user, cartItems) {
    let panel = document.getElementById('userPanel');
    if (panel) return panel;

    panel = document.createElement('aside');
    panel.id = 'userPanel';
    panel.className = 'user-panel';
    panel.innerHTML = `
      <button type="button" class="close-panel" aria-label="Fechar">×</button>
      <h3>Olá, ${getFirstName(user.nome || user.name || user.email)}</h3>
      <p>Você está logado como <strong>${user.nome || user.name || user.email}</strong>.</p>
      <a href="perfil.html" class="user-panel-link">👤 Meu Perfil</a>
      <a href="admin.html" class="user-panel-link" id="adminLink" style="display:none;">⚙️ Painel Admin</a>
      <button type="button" class="user-panel-link" id="openCartHistoryBtn">Ver histórico do carrinho</button>
      <button type="button" class="user-panel-link" id="logoutBtn">Sair</button>
      <div id="cartHistoryList"></div>
    `;
    document.body.appendChild(panel);

    // Verifica se é admin e mostra o link
    if (user.id) {
      fetch('https://naredestore-api.onrender.com/api/admin/check?uid=' + encodeURIComponent(user.id))
        .then(r => r.json())
        .then(d => { if (d.isAdmin) { var el = document.getElementById('adminLink'); if (el) el.style.display = 'block'; } })
        .catch(function() {});
    }

    panel.querySelector('.close-panel')?.addEventListener('click', () => {
      panel.classList.remove('open');
    });

    panel.querySelector('#openCartHistoryBtn')?.addEventListener('click', () => {
      renderCartHistory(panel, cartItems);
    });

    panel.querySelector('#logoutBtn')?.addEventListener('click', () => {
      localStorage.removeItem(USER_KEY);
      window.location.reload();
    });

    return panel;
  }

  function renderCartHistory(panel, cartItems) {
    const container = panel.querySelector('#cartHistoryList');
    if (!container) return;
    if (!cartItems.length) {
      container.innerHTML = '<div class="history-empty">O histórico do carrinho está vazio.</div>';
      return;
    }

    container.innerHTML = cartItems.map(item => `<div class="history-item">${item}</div>`).join('');
  }

  function toggleUserPanel() {
    const panel = document.getElementById('userPanel');
    if (!panel) return;
    panel.classList.toggle('open');
  }

  function updateUserBar(user, cartItems) {
    const loginLink = document.querySelector('.user-bar a[href="login.html"], .user-bar a[href="./login.html"]');
    if (!loginLink) return;
    if (user && user.email) {
      const label = loginLink.querySelector('.label');
      if (label) {
        label.innerHTML = `<b>Olá, ${getFirstName(user.nome || user.name || user.email)}</b>`;
      }
      loginLink.href = '#';
      loginLink.setAttribute('data-user', 'true');
      loginLink.querySelector('.icon svg')?.setAttribute('stroke', '#0bf');
      let status = loginLink.querySelector('.status');
      if (!status) {
        status = document.createElement('span');
        status.className = 'status';
        loginLink.appendChild(status);
      }
      status.textContent = 'Cliente';
      status.setAttribute('style', 'color:#00ff41 !important;font-size:0.75rem;font-weight:600;display:block;margin-top:2px;');
      loginLink.addEventListener('click', function(event) {
        event.preventDefault();
        toggleUserPanel();
      });
    }
    updateCartBadges(cartItems.length);
  }

  function updateCartBadges(count) {
    document.querySelectorAll('.cart-badge, .sidebar-badge').forEach((badge) => {
      badge.textContent = count;
    });
  }

  function init() {
    saveDefaultCartHistory();
    const user = getUser();
    const cartItems = getCartHistory();
    if (user) {
      updateUserBar(user, cartItems);
      renderUserPanel(user, cartItems);
    } else {
      updateCartBadges(cartItems.length);
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    document.head.appendChild(createStyle());
    init();
  });
})();
