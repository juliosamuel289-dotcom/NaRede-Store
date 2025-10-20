// Sistema de Acessibilidade
class AccessibilityManager {
  constructor() {
    this.menu = null;
    this.settings = {
      fontSize: 'normal',
      highContrast: false,
      grayscale: false,
      highlightLinks: false,
      largeCursor: false,
      lineSpacing: 'normal',
      hideImages: false,
      readingMode: false,
      reducedMotion: false,
      // Recursos especiais (sem LIBRAS)
      audioDescription: false,
      textToSpeech: false,
      readingGuide: false,
      focusMode: false,
      dyslexiaFont: false,
      visualIndicators: false,
      monochrome: false
    };
    this.speechSynthesis = window.speechSynthesis;
    this.currentUtterance = null;
    this.readingGuideElement = null;
    this.init();
  }

  init() {
    // Carregar configurações salvas
    this.loadSettings();
    
    // Aplicar configurações salvas
    this.applyAllSettings();
    
    // Adicionar listeners
    document.addEventListener('DOMContentLoaded', () => {
      this.createAccessibilityMenu();
      this.attachEventListeners();
    });
  }

  createAccessibilityMenu() {
    const menu = document.createElement('div');
    menu.className = 'accessibility-menu';
    menu.id = 'accessibilityMenu';
    menu.innerHTML = `
      <h3>
        <svg viewBox="0 0 24 24">
          <path d="M12 2C13.1 2 14 2.9 14 4S13.1 6 12 6 10 5.1 10 4 10.9 2 12 2M21 9H15V22H13V16H11V22H9V9H3V7H21V9Z"/>
        </svg>
        Acessibilidade
      </h3>
      
      <div class="accessibility-option">
        <label>Tamanho da Fonte</label>
        <div class="font-size-controls">
          <button onclick="accessibilityManager.setFontSize('small')" title="Diminuir fonte">A-</button>
          <button onclick="accessibilityManager.setFontSize('normal')" title="Fonte normal">A</button>
          <button onclick="accessibilityManager.setFontSize('large')" title="Aumentar fonte">A+</button>
          <button onclick="accessibilityManager.setFontSize('extra-large')" title="Fonte extra grande">A++</button>
        </div>
      </div>

      <div class="accessibility-option">
        <label for="highContrast">Alto Contraste</label>
        <div class="toggle-switch" id="highContrast" onclick="accessibilityManager.toggleHighContrast()"></div>
      </div>

      <div class="accessibility-option">
        <label for="grayscale">Escala de Cinza</label>
        <div class="toggle-switch" id="grayscale" onclick="accessibilityManager.toggleGrayscale()"></div>
      </div>

      <div class="accessibility-option">
        <label for="highlightLinks">Destacar Links</label>
        <div class="toggle-switch" id="highlightLinks" onclick="accessibilityManager.toggleHighlightLinks()"></div>
      </div>

      <div class="accessibility-option">
        <label for="largeCursor">Cursor Grande</label>
        <div class="toggle-switch" id="largeCursor" onclick="accessibilityManager.toggleLargeCursor()"></div>
      </div>

      <div class="accessibility-option">
        <label>Espaçamento de Linha</label>
        <div class="font-size-controls">
          <button onclick="accessibilityManager.setLineSpacing('normal')" title="Normal">1x</button>
          <button onclick="accessibilityManager.setLineSpacing('large')" title="Grande">2x</button>
          <button onclick="accessibilityManager.setLineSpacing('extra-large')" title="Extra Grande">3x</button>
        </div>
      </div>

      <div class="accessibility-option">
        <label for="hideImages">Ocultar Imagens</label>
        <div class="toggle-switch" id="hideImages" onclick="accessibilityManager.toggleHideImages()"></div>
      </div>

      <div class="accessibility-option">
        <label for="readingMode">Modo Leitura</label>
        <div class="toggle-switch" id="readingMode" onclick="accessibilityManager.toggleReadingMode()"></div>
      </div>

      <div class="accessibility-option">
        <label for="reducedMotion">Reduzir Animações</label>
        <div class="toggle-switch" id="reducedMotion" onclick="accessibilityManager.toggleReducedMotion()"></div>
      </div>

      <h3 style="margin-top: 12px; padding-top: 10px; border-top: 2px solid #30363d; font-size: 15px;">
        <svg viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        Recursos Especiais
      </h3>

      <div class="accessibility-option">
        <label for="audioDescription">Audiodescrição</label>
        <div class="toggle-switch" id="audioDescription" onclick="accessibilityManager.toggleAudioDescription()"></div>
      </div>

      <div class="accessibility-option">
        <label for="textToSpeech">Leitor de Tela</label>
        <div class="toggle-switch" id="textToSpeech" onclick="accessibilityManager.toggleTextToSpeech()"></div>
      </div>

      <div class="accessibility-option">
        <label for="readingGuide">Guia de Leitura</label>
        <div class="toggle-switch" id="readingGuide" onclick="accessibilityManager.toggleReadingGuide()"></div>
      </div>

      <div class="accessibility-option">
        <label for="focusMode">Modo Foco</label>
        <div class="toggle-switch" id="focusMode" onclick="accessibilityManager.toggleFocusMode()"></div>
      </div>

      <div class="accessibility-option">
        <label for="dyslexiaFont">Fonte para Dislexia</label>
        <div class="toggle-switch" id="dyslexiaFont" onclick="accessibilityManager.toggleDyslexiaFont()"></div>
      </div>

      <div class="accessibility-option">
        <label for="visualIndicators">Indicadores Visuais</label>
        <div class="toggle-switch" id="visualIndicators" onclick="accessibilityManager.toggleVisualIndicators()"></div>
      </div>

      <div class="accessibility-option">
        <label for="monochrome">Modo Monocromático</label>
        <div class="toggle-switch" id="monochrome" onclick="accessibilityManager.toggleMonochrome()"></div>
      </div>

      <button class="accessibility-reset" onclick="accessibilityManager.resetAll()">
        🔄 Restaurar Padrões
      </button>
    `;
    document.body.appendChild(menu);
    this.menu = menu;
  }

  attachEventListeners() {
    const button = document.getElementById('accessibilityToggle');
    if (button) {
      button.addEventListener('click', () => this.toggleMenu());
    }

    // Fechar menu ao clicar fora
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('accessibilityMenu');
      const button = document.getElementById('accessibilityToggle');
      
      if (menu && button && 
          !menu.contains(e.target) && 
          !button.contains(e.target) && 
          menu.classList.contains('active')) {
        this.toggleMenu();
      }
    });
  }

  toggleMenu() {
    const menu = document.getElementById('accessibilityMenu');
    if (menu) {
      menu.classList.toggle('active');
    }
  }

  setFontSize(size) {
    // Remover classes antigas
    document.body.classList.remove('font-small', 'font-normal', 'font-large', 'font-extra-large');
    
    // Adicionar nova classe
    document.body.classList.add(`font-${size}`);
    
    this.settings.fontSize = size;
    this.saveSettings();
  }

  toggleHighContrast() {
    this.settings.highContrast = !this.settings.highContrast;
    document.body.classList.toggle('high-contrast', this.settings.highContrast);
    this.updateToggle('highContrast', this.settings.highContrast);
    this.saveSettings();
  }

  toggleGrayscale() {
    this.settings.grayscale = !this.settings.grayscale;
    document.body.classList.toggle('grayscale', this.settings.grayscale);
    this.updateToggle('grayscale', this.settings.grayscale);
    this.saveSettings();
  }

  toggleHighlightLinks() {
    this.settings.highlightLinks = !this.settings.highlightLinks;
    document.body.classList.toggle('highlight-links', this.settings.highlightLinks);
    this.updateToggle('highlightLinks', this.settings.highlightLinks);
    this.saveSettings();
  }

  toggleLargeCursor() {
    this.settings.largeCursor = !this.settings.largeCursor;
    document.body.classList.toggle('large-cursor', this.settings.largeCursor);
    this.updateToggle('largeCursor', this.settings.largeCursor);
    this.saveSettings();
  }

  setLineSpacing(spacing) {
    document.body.classList.remove('line-spacing-normal', 'line-spacing-large', 'line-spacing-extra-large');
    document.body.classList.add(`line-spacing-${spacing}`);
    this.settings.lineSpacing = spacing;
    this.saveSettings();
  }

  toggleHideImages() {
    this.settings.hideImages = !this.settings.hideImages;
    document.body.classList.toggle('hide-images', this.settings.hideImages);
    this.updateToggle('hideImages', this.settings.hideImages);
    this.saveSettings();
  }

  toggleReadingMode() {
    this.settings.readingMode = !this.settings.readingMode;
    document.body.classList.toggle('reading-mode', this.settings.readingMode);
    this.updateToggle('readingMode', this.settings.readingMode);
    this.saveSettings();
  }

  toggleReducedMotion() {
    this.settings.reducedMotion = !this.settings.reducedMotion;
    document.body.classList.toggle('reduced-motion', this.settings.reducedMotion);
    this.updateToggle('reducedMotion', this.settings.reducedMotion);
    this.saveSettings();
  }

  updateToggle(id, isActive) {
    const toggle = document.getElementById(id);
    if (toggle) {
      toggle.classList.toggle('active', isActive);
    }
  }

  // ===== NOVOS RECURSOS PARA PESSOAS COM DEFICIÊNCIA =====

  toggleAudioDescription() {
    this.settings.audioDescription = !this.settings.audioDescription;
    
    if (this.settings.audioDescription) {
      this.createAudioControls();
    } else {
      this.removeAudioControls();
    }
    
    this.updateToggle('audioDescription', this.settings.audioDescription);
    this.saveSettings();
  }

  createAudioControls() {
    this.removeAudioControls();
    
    const controls = document.createElement('div');
    controls.className = 'audio-controls active';
    controls.id = 'audioControls';
    controls.innerHTML = `
      <h4>
        <svg viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
        Audiodescrição
      </h4>
      <button class="audio-control-btn" onclick="accessibilityManager.describeCurrentPage()">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
        Descrever Página Atual
      </button>
      <button class="audio-control-btn" onclick="accessibilityManager.describeImages()">
        <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
        Descrever Imagens
      </button>
      <button class="audio-control-btn" onclick="accessibilityManager.stopAudio()">
        <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
        Parar Áudio
      </button>
    `;
    
    document.body.appendChild(controls);
  }

  removeAudioControls() {
    const existing = document.getElementById('audioControls');
    if (existing) {
      existing.remove();
    }
  }

  describeCurrentPage() {
    const pageTitle = document.title;
    const mainHeading = document.querySelector('h1, h2')?.textContent || 'sem título principal';
    const linksCount = document.querySelectorAll('a').length;
    const imagesCount = document.querySelectorAll('img').length;
    
    const description = `Página: ${pageTitle}. ${mainHeading}. Contém ${linksCount} links e ${imagesCount} imagens.`;
    this.speak(description);
  }

  describeImages() {
    const images = document.querySelectorAll('img');
    if (images.length === 0) {
      this.speak('Não há imagens nesta página.');
      return;
    }
    
    let description = `Esta página contém ${images.length} imagens. `;
    images.forEach((img, index) => {
      const alt = img.alt || 'sem descrição';
      description += `Imagem ${index + 1}: ${alt}. `;
    });
    
    this.speak(description);
  }

  stopAudio() {
    if (this.speechSynthesis) {
      this.speechSynthesis.cancel();
    }
  }

  toggleTextToSpeech() {
    this.settings.textToSpeech = !this.settings.textToSpeech;
    
    if (this.settings.textToSpeech) {
      this.enableTextToSpeech();
      this.speak('Leitor de tela ativado. Passe o mouse sobre o texto para ouvir.');
    } else {
      this.disableTextToSpeech();
      this.stopAudio();
    }
    
    this.updateToggle('textToSpeech', this.settings.textToSpeech);
    this.saveSettings();
  }

  enableTextToSpeech() {
    document.addEventListener('mouseover', this.handleTextHover);
  }

  disableTextToSpeech() {
    document.removeEventListener('mouseover', this.handleTextHover);
  }

  handleTextHover = (e) => {
    const element = e.target;
    const text = element.textContent?.trim();
    
    if (text && text.length > 3 && text.length < 200) {
      // Evitar elementos de menu/botões já falados
      if (!element.closest('.accessibility-menu') && 
          !element.closest('.libras-interpreter') &&
          !element.closest('.audio-controls')) {
        this.speak(text);
      }
    }
  }

  speak(text) {
    if (!this.speechSynthesis) return;
    
    this.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    this.currentUtterance = utterance;
    this.speechSynthesis.speak(utterance);
  }

  toggleReadingGuide() {
    this.settings.readingGuide = !this.settings.readingGuide;
    
    if (this.settings.readingGuide) {
      this.createReadingGuide();
    } else {
      this.removeReadingGuide();
    }
    
    this.updateToggle('readingGuide', this.settings.readingGuide);
    this.saveSettings();
  }

  createReadingGuide() {
    this.removeReadingGuide();
    
    const guide = document.createElement('div');
    guide.className = 'reading-guide active';
    guide.id = 'readingGuide';
    document.body.appendChild(guide);
    
    const mask = document.createElement('div');
    mask.className = 'reading-mask active';
    mask.innerHTML = `
      <div class="reading-mask-overlay reading-mask-top"></div>
      <div class="reading-mask-overlay reading-mask-bottom"></div>
    `;
    document.body.appendChild(mask);
    
    document.addEventListener('mousemove', this.updateReadingGuide);
    this.readingGuideElement = guide;
  }

  removeReadingGuide() {
    const guide = document.getElementById('readingGuide');
    const mask = document.querySelector('.reading-mask');
    
    if (guide) guide.remove();
    if (mask) mask.remove();
    
    document.removeEventListener('mousemove', this.updateReadingGuide);
    this.readingGuideElement = null;
  }

  updateReadingGuide = (e) => {
    const guide = document.getElementById('readingGuide');
    const maskTop = document.querySelector('.reading-mask-top');
    const maskBottom = document.querySelector('.reading-mask-bottom');
    
    if (guide && maskTop && maskBottom) {
      const y = e.clientY + window.scrollY;
      guide.style.top = y + 'px';
      
      maskTop.style.height = y + 'px';
      maskBottom.style.top = (y + 4) + 'px';
      maskBottom.style.height = 'calc(100% - ' + (y + 4) + 'px)';
    }
  }

  toggleFocusMode() {
    this.settings.focusMode = !this.settings.focusMode;
    document.body.classList.toggle('focus-mode', this.settings.focusMode);
    this.updateToggle('focusMode', this.settings.focusMode);
    this.saveSettings();
  }

  toggleDyslexiaFont() {
    this.settings.dyslexiaFont = !this.settings.dyslexiaFont;
    document.body.classList.toggle('dyslexia-font', this.settings.dyslexiaFont);
    this.updateToggle('dyslexiaFont', this.settings.dyslexiaFont);
    this.saveSettings();
  }

  toggleVisualIndicators() {
    this.settings.visualIndicators = !this.settings.visualIndicators;
    document.body.classList.toggle('visual-indicators', this.settings.visualIndicators);
    this.updateToggle('visualIndicators', this.settings.visualIndicators);
    this.saveSettings();
  }

  toggleMonochrome() {
    this.settings.monochrome = !this.settings.monochrome;
    document.body.classList.toggle('monochrome', this.settings.monochrome);
    this.updateToggle('monochrome', this.settings.monochrome);
    this.saveSettings();
  }

  resetAll() {
    // Parar áudio e remover elementos
    this.stopAudio();
    this.removeAudioControls();
    this.removeReadingGuide();
    
    // Resetar todas as configurações
    this.settings = {
      fontSize: 'normal',
      highContrast: false,
      grayscale: false,
      highlightLinks: false,
      largeCursor: false,
      lineSpacing: 'normal',
      hideImages: false,
      readingMode: false,
      reducedMotion: false,
      audioDescription: false,
      textToSpeech: false,
      readingGuide: false,
      focusMode: false,
      dyslexiaFont: false,
      visualIndicators: false,
      monochrome: false
    };

    // Remover todas as classes
    document.body.classList.remove(
      'font-small', 'font-normal', 'font-large', 'font-extra-large',
      'high-contrast', 'grayscale', 'highlight-links', 'large-cursor',
      'line-spacing-normal', 'line-spacing-large', 'line-spacing-extra-large',
      'hide-images', 'reading-mode', 'reduced-motion',
      'focus-mode', 'dyslexia-font', 'visual-indicators', 'monochrome'
    );

    // Aplicar configurações padrão
    this.applyAllSettings();
    
    // Salvar
    this.saveSettings();

    // Feedback visual
    alert('✅ Todas as configurações de acessibilidade foram restauradas para o padrão!');
  }

  applyAllSettings() {
    // Aplicar tamanho de fonte
    document.body.classList.add(`font-${this.settings.fontSize}`);
    
    // Aplicar toggles básicos
    document.body.classList.toggle('high-contrast', this.settings.highContrast);
    document.body.classList.toggle('grayscale', this.settings.grayscale);
    document.body.classList.toggle('highlight-links', this.settings.highlightLinks);
    document.body.classList.toggle('large-cursor', this.settings.largeCursor);
    document.body.classList.toggle('hide-images', this.settings.hideImages);
    document.body.classList.toggle('reading-mode', this.settings.readingMode);
    document.body.classList.toggle('reduced-motion', this.settings.reducedMotion);
    
    // Aplicar novos recursos
    document.body.classList.toggle('focus-mode', this.settings.focusMode);
    document.body.classList.toggle('dyslexia-font', this.settings.dyslexiaFont);
    document.body.classList.toggle('visual-indicators', this.settings.visualIndicators);
    document.body.classList.toggle('monochrome', this.settings.monochrome);
    
    // Aplicar espaçamento de linha
    document.body.classList.add(`line-spacing-${this.settings.lineSpacing}`);
    
    // Recursos com elementos visuais (sem LIBRAS)
    if (this.settings.audioDescription) {
      this.createAudioControls();
    }
    
    if (this.settings.textToSpeech) {
      this.enableTextToSpeech();
    }
    
    if (this.settings.readingGuide) {
      this.createReadingGuide();
    }
    
    // Atualizar UI dos toggles
    setTimeout(() => {
      this.updateToggle('highContrast', this.settings.highContrast);
      this.updateToggle('grayscale', this.settings.grayscale);
      this.updateToggle('highlightLinks', this.settings.highlightLinks);
      this.updateToggle('largeCursor', this.settings.largeCursor);
      this.updateToggle('hideImages', this.settings.hideImages);
      this.updateToggle('readingMode', this.settings.readingMode);
      this.updateToggle('reducedMotion', this.settings.reducedMotion);
      this.updateToggle('audioDescription', this.settings.audioDescription);
      this.updateToggle('textToSpeech', this.settings.textToSpeech);
      this.updateToggle('readingGuide', this.settings.readingGuide);
      this.updateToggle('focusMode', this.settings.focusMode);
      this.updateToggle('dyslexiaFont', this.settings.dyslexiaFont);
      this.updateToggle('visualIndicators', this.settings.visualIndicators);
      this.updateToggle('monochrome', this.settings.monochrome);
    }, 100);
  }

  saveSettings() {
    localStorage.setItem('accessibilitySettings', JSON.stringify(this.settings));
  }

  loadSettings() {
    const saved = localStorage.getItem('accessibilitySettings');
    if (saved) {
      this.settings = JSON.parse(saved);
    }
  }
}

// Inicializar o gerenciador de acessibilidade
const accessibilityManager = new AccessibilityManager();
