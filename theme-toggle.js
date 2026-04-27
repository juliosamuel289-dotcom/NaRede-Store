// Theme + Acessibilidade global
(function() {
  'use strict';

  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const body = document.body;

  function updateIcon(isDark) {
    if (!themeIcon) return;
    if (isDark) {
      themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    } else {
      themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
    }
  }

  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;

  if (isDark) body.classList.remove('light-mode');
  else body.classList.add('light-mode');
  updateIcon(!isDark);

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

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
    if (localStorage.getItem('theme')) return;
    if (e.matches) {
      body.classList.remove('light-mode');
      updateIcon(true);
    } else {
      body.classList.add('light-mode');
      updateIcon(false);
    }
  });

  // Acessibilidade: alto contraste + tamanho de fonte
  const root = document.documentElement;
  let fontScale = Number(localStorage.getItem('fontScale') || '100');
  fontScale = Math.min(130, Math.max(85, fontScale));
  root.style.fontSize = fontScale + '%';

  const highContrast = localStorage.getItem('highContrast') === '1';
  if (highContrast) body.classList.add('high-contrast');

  function applyFontScale(next) {
    fontScale = Math.min(130, Math.max(85, next));
    root.style.fontSize = fontScale + '%';
    localStorage.setItem('fontScale', String(fontScale));
    const label = document.getElementById('accFontScaleLabel');
    if (label) label.textContent = fontScale + '%';
  }

  function toggleHighContrast() {
    body.classList.toggle('high-contrast');
    localStorage.setItem('highContrast', body.classList.contains('high-contrast') ? '1' : '0');
  }

  if (!document.getElementById('accessibilityTools')) {
    const wrap = document.createElement('div');
    wrap.id = 'accessibilityTools';
    wrap.className = 'accessibility-tools';
    wrap.innerHTML = '' +
      '<button type="button" class="acc-btn" id="accContrastToggle" title="Alternar alto contraste">Contraste</button>' +
      '<button type="button" class="acc-btn" id="accFontMinus" title="Diminuir fonte">A-</button>' +
      '<span class="acc-scale" id="accFontScaleLabel">' + fontScale + '%</span>' +
      '<button type="button" class="acc-btn" id="accFontPlus" title="Aumentar fonte">A+</button>' +
      '<button type="button" class="acc-btn" id="accFontReset" title="Tamanho padrão">Reset</button>';
    document.body.appendChild(wrap);

    document.getElementById('accContrastToggle').addEventListener('click', toggleHighContrast);
    document.getElementById('accFontMinus').addEventListener('click', function() { applyFontScale(fontScale - 5); });
    document.getElementById('accFontPlus').addEventListener('click', function() { applyFontScale(fontScale + 5); });
    document.getElementById('accFontReset').addEventListener('click', function() { applyFontScale(100); });
  }
})();
