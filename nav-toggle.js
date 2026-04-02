(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var nav = document.querySelector('header nav');
    if (!nav) return;

    // Injeta o botão hamburger se ainda não existir
    if (!nav.querySelector('.nav-toggle')) {
      var btn = document.createElement('button');
      btn.className = 'nav-toggle';
      btn.setAttribute('aria-label', 'Abrir menu');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<span class="hamburger"></span>';
      nav.insertBefore(btn, nav.firstChild);
    }

    var toggle = nav.querySelector('.nav-toggle');

    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      toggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
    });

    // Fecha ao clicar fora do nav
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target)) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Abrir menu');
      }
    });
  });
})();
