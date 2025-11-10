// Sistema de retenção - popup ao tentar sair (VERSÃO NOVA)
let isInternalClick = false;
let canShowPopup = true;

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
    const STORAGE_KEY = 'exitPopupDontShow';

    function isDisabled() {
        try {
            return localStorage.getItem(STORAGE_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    if (isDisabled()) return; // não criar se usuário optou por não mostrar

    // Remove modal antigo se existir
    const oldModal = document.getElementById('exit-intent-modal');
    if (oldModal) oldModal.remove();
    
    // Detecta se está no modo claro
    const isLightMode = document.body.classList.contains('light-mode');
    console.log('Modo claro ativo:', isLightMode); // DEBUG
    
    const modal = document.createElement('div');
    modal.id = 'exit-intent-modal';
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 999999; display: flex; justify-content: center; align-items: center;">
            <div style="background: #161b22; padding: 40px; border-radius: 20px; text-align: center; max-width: 500px; box-shadow: 0 20px 60px rgba(66,43,255,0.6); border: 2px solid #422BFF;">
                <h2 style="color: #f0f6fc; font-size: 28px; margin-bottom: 20px; font-weight: bold;">⚠️ Espere!</h2>
                <p style="color: #8b949e; font-size: 18px; margin-bottom: 30px; line-height: 1.6;">
                    <strong style="color: #00ff41; text-shadow: 0 0 15px rgba(0,255,65,0.5);">Não deixe para depois suas compras!</strong><br>
                    Aproveite os preços especiais da loja <span style="color: #422BFF; font-weight: bold;">NaRede Store</span>
                </p>
                <div style="display: flex; gap: 12px; justify-content: center; align-items: center; flex-wrap: wrap;">
                    <button id="continuar-btn" style="background: #422BFF; color: white; border: none; padding: 15px 30px; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 20px rgba(66,43,255,0.5);">
                        Continuar Comprando 🛒
                    </button>
                    <button id="fechar-btn" style="background: transparent; color: #8b949e; border: 2px solid #30363d; padding: 15px 24px; border-radius: 10px; font-size: 16px; cursor: pointer; font-weight: bold;">
                        Fechar
                    </button>
                    <button id="dontshow-exit" style="background: transparent; color: #cfcfcf; border: 1px dashed rgba(255,255,255,0.06); padding: 12px 18px; border-radius: 8px; font-size: 14px; cursor: pointer;">Não mostrar novamente</button>
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

    // 'Não mostrar novamente' grava preferência em localStorage
    const dontBtn = document.getElementById('dontshow-exit');
    if (dontBtn) {
        dontBtn.addEventListener('click', function() {
            try {
                localStorage.setItem(STORAGE_KEY, '1');
            } catch (e) {
                // falha silenciosa
            }
            modal.remove();
            canShowPopup = true;
        });
    }
}

// Detecta quando o mouse sai da janela (tentativa de fechar)
document.addEventListener('mouseleave', function(e) {
    // checa preferência do usuário antes de mostrar
    try {
        if (localStorage.getItem('exitPopupDontShow') === '1') return;
    } catch (e) {}

    if (canShowPopup && !isInternalClick) {
        canShowPopup = false;
        createExitModal();
        setTimeout(() => canShowPopup = true, 2000); // Permite mostrar novamente após 2 segundos
    }
});

// Detecta movimento do mouse para o topo
document.addEventListener('mousemove', function(e) {
    // checa preferência do usuário antes de mostrar
    try {
        if (localStorage.getItem('exitPopupDontShow') === '1') return;
    } catch (e) {}

    if (canShowPopup && !isInternalClick && e.clientY <= 10) {
        canShowPopup = false;
        createExitModal();
        setTimeout(() => canShowPopup = true, 2000); // Permite mostrar novamente após 2 segundos
    }
});

// Também tenta com beforeunload (para compatibilidade)
window.addEventListener('beforeunload', function(e) {
    try {
        if (localStorage.getItem('exitPopupDontShow') === '1') return;
    } catch (err) {}

    if (!isInternalClick) {
        const mensagem = 'Não deixe para depois suas compras, aproveite os preços especiais da loja NaRede Store';
        e.preventDefault();
        e.returnValue = mensagem;
        return mensagem;
    }
});
