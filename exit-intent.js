// Sistema de retenção - popup ao tentar sair
let isInternalClick = false;
let canShowPopup = true;

// Checa se o usuário pediu para não mostrar o popup novamente
function shouldShowExitPopup() {
    try {
        return localStorage.getItem('exitPopupDontShow') !== '1';
    } catch (e) {
        return true; // se localStorage não estiver disponível, continuar mostrando
    }
}

// Detecta cliques em links internos
document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (link) {
        const href = link.getAttribute('href') || '';
        if (href.includes('.html') || href.startsWith('#')) {
            isInternalClick = true;
            setTimeout(() => isInternalClick = false, 200);
        }
    }
});

// Cria o modal de saída
function createExitModal() {
    // Remove modal antigo se existir
    const oldModal = document.getElementById('exit-intent-modal');
    if (oldModal) oldModal.remove();
    
    // Se o usuário escolheu não mostrar novamente, não cria o modal
    if (!shouldShowExitPopup()) return;
    
    // Detecta se está no modo claro
    const isLightMode = document.body.classList.contains('light-mode');
    console.log('Modo claro ativo:', isLightMode); // DEBUG
    
    const modal = document.createElement('div');
    modal.id = 'exit-intent-modal';
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.75); z-index: 999999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
            <div style="background: ${isLightMode ? 'rgba(255,255,255,0.85)' : '#161b22'}; padding: 40px; border-radius: 20px; text-align: center; max-width: 500px; box-shadow: 0 20px 60px rgba(66,43,255,0.6); border: 2px solid #422BFF; backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);">
                <h2 style="color: ${isLightMode ? '#000' : '#f0f6fc'}; font-size: 28px; margin-bottom: 20px; font-weight: bold;">⚠️ Espere!</h2>
                <p style="color: ${isLightMode ? '#000' : '#8b949e'}; font-size: 18px; margin-bottom: 30px; line-height: 1.6; font-weight: ${isLightMode ? '500' : 'normal'};">
                    <strong style="color: #00ff41; text-shadow: 0 0 15px rgba(0,255,65,0.5);">Não deixe para depois suas compras!</strong><br>
                    Aproveite os preços especiais da loja <span style="color: #422BFF; font-weight: bold;">NaRede Store</span>
                </p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="continuar-btn" style="background: #422BFF; color: white; border: none; padding: 15px 30px; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 20px rgba(66,43,255,0.5); transition: all 0.3s;">
                        Continuar Comprando 🛒
                    </button>
                    <button id="fechar-btn" style="background: ${isLightMode ? 'rgba(255,255,255,0.6)' : 'transparent'}; color: ${isLightMode ? '#000' : '#8b949e'}; border: 2px solid ${isLightMode ? '#888' : '#30363d'}; padding: 15px 30px; border-radius: 10px; font-size: 16px; cursor: pointer; font-weight: bold; transition: all 0.3s;">
                        Fechar
                    </button>
                </div>
                <div style="margin-top:12px; text-align:center;">
                    <button id="dont-show-again-btn" style="background: transparent; color: ${isLightMode ? '#222' : '#9aa5b1'}; border: none; font-size: 14px; cursor: pointer; text-decoration: underline;">Não mostrar novamente</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Event listeners para os botões
    document.getElementById('continuar-btn').addEventListener('click', function() {
        modal.remove();
        canShowPopup = true;
    });
    
    document.getElementById('fechar-btn').addEventListener('click', function() {
        modal.remove();
        canShowPopup = true;
    });

    // Botão "Não mostrar novamente"
    const dontShowBtn = document.getElementById('dont-show-again-btn');
    if (dontShowBtn) {
        dontShowBtn.addEventListener('click', function() {
            try {
                localStorage.setItem('exitPopupDontShow', '1');
            } catch (e) {
                // ignore
            }
            modal.remove();
            canShowPopup = true;
        });
    }
}

// Detecta quando o mouse sai da janela (tentativa de fechar)
document.addEventListener('mouseleave', function(e) {
    if (canShowPopup && !isInternalClick && shouldShowExitPopup()) {
        canShowPopup = false;
        createExitModal();
        setTimeout(() => canShowPopup = true, 2000); // Permite mostrar novamente após 2 segundos
    }
});

// Detecta movimento do mouse para o topo
document.addEventListener('mousemove', function(e) {
    if (canShowPopup && !isInternalClick && e.clientY <= 10 && shouldShowExitPopup()) {
        canShowPopup = false;
        createExitModal();
        setTimeout(() => canShowPopup = true, 2000); // Permite mostrar novamente após 2 segundos
    }
});

// Também tenta com beforeunload (para compatibilidade)
window.addEventListener('beforeunload', function(e) {
    if (!isInternalClick && shouldShowExitPopup()) {
        const mensagem = 'Não deixe para depois suas compras, aproveite os preços especiais da loja NaRede Store';
        e.preventDefault();
        e.returnValue = mensagem;
        return mensagem;
    }
});
