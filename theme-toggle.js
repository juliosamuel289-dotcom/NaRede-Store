// Sistema de Alternância de Tema
document.addEventListener('DOMContentLoaded', function() {
    console.log('Sistema de tema iniciado');
    
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const body = document.body;
    
    console.log('Botão encontrado:', themeToggle);
    console.log('Ícone encontrado:', themeIcon);
    
    // Verifica se há preferência salva no localStorage
    const savedTheme = localStorage.getItem('theme');
    console.log('Tema salvo:', savedTheme);
    
    if (savedTheme === 'light') {
        body.classList.add('light-mode');
        updateIcon(true);
        applyFooterStyles(true);
    }
    
    // Adiciona evento de clique no botão
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            console.log('Botão clicado!');
            body.classList.toggle('light-mode');
            const isLight = body.classList.contains('light-mode');
            console.log('Modo claro ativo:', isLight);
            
            // Salva a preferência no localStorage
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            
            // Atualiza o ícone
            updateIcon(isLight);
            
            // Aplica estilos no footer
            applyFooterStyles(isLight);
        });
    } else {
        console.error('Botão de tema não encontrado!');
    }
    
    // Função para aplicar estilos no footer e seções
    function applyFooterStyles(isLight) {
        const footer = document.querySelector('footer');
        console.log('Footer encontrado:', footer);
        console.log('Aplicando modo claro:', isLight);
        
        if (isLight) {
            console.log('Aplicando estilos claros em TODOS os elementos');
            
            // Aplica no footer
            if (footer) {
                footer.style.setProperty('background-color', '#f6f8fa', 'important');
                footer.style.setProperty('background', '#f6f8fa', 'important');
                footer.style.setProperty('color', '#000000', 'important');
                
                const footerElements = footer.querySelectorAll('*');
                footerElements.forEach(el => {
                    el.style.setProperty('color', '#000000', 'important');
                });
                
                const topBar = footer.querySelector('.top-bar');
                if (topBar) {
                    topBar.style.setProperty('background-color', '#e1e4e8', 'important');
                    topBar.style.setProperty('background', '#e1e4e8', 'important');
                }
            }
            
            // Aplica em TODAS as seções (EXCETO hero-section)
            const sections = document.querySelectorAll('section:not(.hero-section), .newsletter, .newsletter-header, div[style*="background"]:not(.hero-section *)');
            sections.forEach(section => {
                section.style.setProperty('background-color', '#f6f8fa', 'important');
                section.style.setProperty('background', '#f6f8fa', 'important');
            });
            
            // FORÇA o hero-section a manter o roxo no modo claro
            const heroSection = document.querySelector('.hero-section');
            if (heroSection) {
                heroSection.style.setProperty('background', 'linear-gradient(135deg, #600871 0%, #8B1A9C 100%)', 'important');
            }
            
            // Aplica em todos os elementos com background preto ou escuro (EXCETO hero-section)
            const allElements = document.querySelectorAll('*:not(.hero-section):not(.hero-section *)');
            allElements.forEach(el => {
                const bgColor = window.getComputedStyle(el).backgroundColor;
                if (bgColor === 'rgb(0, 0, 0)' || bgColor === 'rgb(13, 17, 23)' || bgColor === 'rgb(22, 27, 34)') {
                    el.style.setProperty('background-color', '#f6f8fa', 'important');
                    el.style.setProperty('background', '#f6f8fa', 'important');
                }
            });
            
        } else {
            console.log('Removendo estilos claros');
            
            if (footer) {
                footer.style.removeProperty('background-color');
                footer.style.removeProperty('background');
                footer.style.removeProperty('color');
                
                const footerElements = footer.querySelectorAll('*');
                footerElements.forEach(el => {
                    el.style.removeProperty('color');
                });
                
                const topBar = footer.querySelector('.top-bar');
                if (topBar) {
                    topBar.style.removeProperty('background-color');
                    topBar.style.removeProperty('background');
                }
            }
            
            // Remove de todas as seções
            const allElements = document.querySelectorAll('*');
            allElements.forEach(el => {
                el.style.removeProperty('background-color');
                el.style.removeProperty('background');
            });
        }
    }
    
    // Função para atualizar o ícone
    function updateIcon(isLight) {
        if (!themeIcon) return;
        
        if (isLight) {
            // Ícone de sol (modo claro ativo)
            themeIcon.innerHTML = '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
        } else {
            // Ícone de lua (modo escuro ativo)
            themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor"/>';
        }
    }
});
