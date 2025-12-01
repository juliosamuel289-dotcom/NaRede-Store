// Theme Toggle Script - Modo Dark/Light
(function() {
  'use strict';

  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const body = document.body;

  // Função para atualizar o ícone
  function updateIcon(isDark) {
    if (themeIcon) {
      if (isDark) {
        // Ícone de lua (modo escuro ativo)
        themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
      } else {
        // Ícone de sol (modo claro ativo)
        themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
      }
    }
  }

  // Verificar preferência salva
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;

  // Aplicar tema inicial
  if (isDark) {
    body.classList.remove('light-mode');
  } else {
    body.classList.add('light-mode');
  }
  updateIcon(!isDark);

  // Event listener para o botão
  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      const isCurrentlyLight = body.classList.contains('light-mode');
      
      if (isCurrentlyLight) {
        body.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark');
        updateIcon(true);
      } else {
        body.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
        updateIcon(false);
      }
    });
  }

  // Detectar mudanças no tema do sistema
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      if (e.matches) {
        body.classList.remove('light-mode');
        updateIcon(true);
      } else {
        body.classList.add('light-mode');
        updateIcon(false);
      }
    }
  });
})();
