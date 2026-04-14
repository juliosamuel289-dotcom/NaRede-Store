// ── Handlers de erro global (DEVEM ser os primeiros) ────
process.on('uncaughtException', (err) => {
    console.error('\u274c uncaughtException:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
    console.error('\u274c unhandledRejection:', reason);
});

require('dotenv').config();
const express  = require('express');
const https    = require('https');
const cors     = require('cors');
const path     = require('path');
const admin    = require('firebase-admin');
const multer   = require('multer');
const { MercadoPagoConfig, Preference, Payment, PaymentRefund } = require('mercadopago');

const app = express();

// ── Catálogo oficial de preços ───────────────────────────
// Fonte de verdade para todos os produtos. O servidor NUNCA
// confia no preço enviado pelo cliente — ele recalcula aqui.
// Cada produto pode ter múltiplos preços válidos (normal + promo).
const CATALOGO_PRECOS = {
  // ── Brasileiros ──────────────────────────────────────
  'Flamengo':        [0.50, 179.90, 279.90],   // 0.50 = teste temporário
  'Vasco':           [259.90],
  'Santos':          [269.90],
  'Palmeiras':       [289.90, 169.90],
  'São Paulo':       [279.90],
  'Corinthians':     [289.90],
  'Fluminense':      [269.90],
  'Grêmio':         [259.90],
  'Atlético Mineiro':[279.90],
  'Botafogo':        [259.90],
  'Bahia':           [249.90, 199.90],
  'Cruzeiro':        [249.90],
  // ── Internacionais ───────────────────────────────────
  'Real Madrid':     [299.90],
  'Barcelona':       [279.90],
  'Manchester United':[299.90],
  'Liverpool':       [289.90, 269.90],
  'Bayern de Munique':[299.90],
  'Paris Saint-Germain':[289.90],
  'Arsenal':         [269.90, 249.90],
  'Chelsea':         [279.90],
  'Manchester City': [289.90],
  'Juventus':        [269.90],
  'AC Milan':        [259.90],
  'Atlético Madrid': [249.90],
  // ── Seleções ─────────────────────────────────────────
  'Brasil':          [249.90],
  'Argentina':       [239.90, 199.90],
  'Alemanha':        [229.90],
  'França':         [239.90],
  'Inglaterra':      [229.90],
  'Holanda':         [219.90],
  'Itália':         [229.90],
  'Portugal':        [239.90],
  'México':         [209.90],
  'Japão':          [199.90, 179.90],
  'Chile':           [189.90],
  'Suíça':          [199.90],
};

// ── Firebase Admin ──────────────────────────────────────
admin.initializeApp({
    credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'naredestore-2e1e1.firebasestorage.app'
});
const db     = admin.firestore();
const auth   = admin.auth();
const bucket = admin.storage().bucket();
console.log('✅ Firebase Admin inicializado (Storage bucket:', bucket.name + ')');

// ── Multer (upload de imagens em memória) ────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Apenas imagens são permitidas.'));
    }
});

// ── Sincronizar catálogo com produtos do admin ──────────
(async () => {
    try {
        const snap = await db.collection('produtos').get();
        let count = 0;
        snap.forEach(doc => {
            const p = doc.data();
            if (p.nome && p.preco) {
                CATALOGO_PRECOS[p.nome] = CATALOGO_PRECOS[p.nome] || [];
                if (!CATALOGO_PRECOS[p.nome].includes(Number(p.preco))) {
                    CATALOGO_PRECOS[p.nome].push(Number(p.preco));
                    count++;
                }
            }
        });
        console.log('✅ Catálogo sincronizado com', count, 'preço(s) do admin.');
    } catch (err) {
        console.error('⚠️  Erro ao sincronizar catálogo:', err.message);
    }
})();

// Verifica se a Web API Key está configurada (necessária para login)
if (!process.env.FIREBASE_WEB_API_KEY) {
    console.error('⚠️  FIREBASE_WEB_API_KEY não está definida! O login NÃO vai funcionar.');
} else {
    console.log('✅ FIREBASE_WEB_API_KEY configurada (' + process.env.FIREBASE_WEB_API_KEY.slice(0, 8) + '...)');
}

// Autentica usuário via Firebase REST API (única forma de verificar senha no servidor)
async function firebaseSignIn(email, password) {
    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) throw new Error('FIREBASE_WEB_API_KEY não configurada.');

    const body   = JSON.stringify({ email, password, returnSecureToken: true });
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            req.destroy();
            reject(new Error('Timeout ao conectar com Firebase Auth.'));
        }, 15000);

        const options = {
            hostname: 'identitytoolkit.googleapis.com',
            path:     `/v1/accounts:signInWithPassword?key=${apiKey}`,
            method:   'POST',
            headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                clearTimeout(timeout);
                console.log('Firebase Auth response status:', res.statusCode);
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode === 200) resolve(parsed);
                    else reject(new Error(parsed.error?.message || 'Credenciais inválidas.'));
                } catch (e) {
                    console.error('Firebase Auth resposta não-JSON (status ' + res.statusCode + '):', data.slice(0, 500));
                    reject(new Error('API Key inválida ou não configurada. Verifique FIREBASE_WEB_API_KEY no Render.'));
                }
            });
        });
        req.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
        req.write(body);
        req.end();
    });
}

// ── Middlewares ──────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// ── Brevo (e-mail via HTTPS API) ─────────────────────────
function enviarEmailBrevo(to, subject, html) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            sender:  { name: 'NaRede Store', email: process.env.BREVO_SENDER_EMAIL },
            to:      [{ email: to }],
            subject: subject,
            htmlContent: html
        });
        const options = {
            hostname: 'api.brevo.com',
            path:     '/v3/smtp/email',
            method:   'POST',
            headers:  {
                'Content-Type':  'application/json',
                'api-key':       process.env.BREVO_API_KEY,
                'Content-Length': Buffer.byteLength(body)
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve();
                } else {
                    reject(new Error(`Brevo status ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
console.log('✅ Brevo configurado.');

// ── MercadoPago ─────────────────────────────────────────────
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// ── Rotas de páginas ─────────────────────────────────────
app.get('/',        (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/cadastro',(req, res) => res.sendFile(path.join(__dirname, 'cadastro.html')));
app.get('/login',   (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.post('/envio',  (req, res) => res.status(200).send('Inscrição recebida!'));
app.get('/health',  (req, res) => res.status(200).json({ status: 'ok' }));

// ── POST /api/register ───────────────────────────────────
app.post('/api/register', async (req, res) => {
    const { nome, sobrenome, genero, celular, cpf, cep, rua, bairro, cidade, estado, email, senha } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    try {
        // Verifica CPF duplicado no Firestore (se informado)
        if (cpf) {
            const snap = await db.collection('usuarios').where('cpf', '==', cpf).limit(1).get();
            if (!snap.empty) return res.status(409).json({ error: 'CPF já cadastrado.' });
        }

        // Cria usuário no Firebase Auth (garante unicidade de e-mail e armazena senha com segurança)
        let userRecord;
        try {
            userRecord = await auth.createUser({ email, password: senha, displayName: nome });
        } catch (authErr) {
            if (authErr.code === 'auth/email-already-exists') {
                return res.status(409).json({ error: 'E-mail já cadastrado.' });
            }
            throw authErr;
        }

        // Salva perfil no Firestore usando o UID como chave do documento
        await db.collection('usuarios').doc(userRecord.uid).set({
            uid:       userRecord.uid,
            nome:      nome,
            sobrenome: sobrenome || '',
            genero:    genero    || '',
            celular:   celular   || '',
            cpf:       cpf       || '',
            cep:       cep       || '',
            rua:       rua       || '',
            bairro:    bairro    || '',
            cidade:    cidade    || '',
            estado:    estado    || '',
            email:     email,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({ success: true, message: 'Cadastro realizado com sucesso!' });
    } catch (err) {
        console.error('Erro no cadastro:', err.message);
        res.status(500).json({ error: 'Erro ao salvar no banco: ' + err.message });
    }
});

// ── POST /api/login ──────────────────────────────────────
app.post('/api/login', async (req, res) => {
    const { email, password, senha } = req.body;
    const senhaFornecida = password || senha;

    if (!email || !senhaFornecida) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    try {
        // Verifica credenciais via Firebase Auth REST API
        let firebaseUser;
        try {
            firebaseUser = await firebaseSignIn(email, senhaFornecida);
        } catch (authErr) {
            const msg = authErr.message || '';
            console.error('❌ Erro firebaseSignIn para', email, ':', msg);

            if (msg.includes('EMAIL_NOT_FOUND')) {
                return res.status(401).json({ error: 'E-mail não cadastrado.' });
            }
            if (msg.includes('INVALID_PASSWORD') || msg.includes('INVALID_LOGIN_CREDENTIALS')) {
                return res.status(401).json({ error: 'Senha incorreta.' });
            }
            if (msg.includes('TOO_MANY_ATTEMPTS')) {
                return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
            }
            if (msg.includes('USER_DISABLED')) {
                return res.status(403).json({ error: 'Conta desativada.' });
            }
            if (msg.includes('FIREBASE_WEB_API_KEY') || msg.includes('Timeout')) {
                return res.status(503).json({ error: 'Servidor temporariamente indisponível. Tente novamente.' });
            }
            if (msg.includes('API key') || msg.includes('API_KEY_INVALID') || msg.includes('INVALID_API_KEY')) {
                console.error('⚠️  A FIREBASE_WEB_API_KEY está inválida! Verifique no Render.');
                return res.status(503).json({ error: 'Erro de configuração do servidor. Contate o administrador.' });
            }
            // Retorna a mensagem real do Firebase para facilitar debug
            return res.status(401).json({ error: 'Erro na autenticação: ' + msg });
        }

        const uid = firebaseUser.localId;

        // Busca perfil no Firestore
        const doc = await db.collection('usuarios').doc(uid).get();
        const perfil = doc.exists ? doc.data() : {};

        // Atualiza último login
        await db.collection('usuarios').doc(uid).set(
            { lastLogin: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true }
        );

        res.json({ success: true, user: { id: uid, nome: perfil.nome || '', email: email } });
    } catch (err) {
        console.error('Erro no login:', err);
        res.status(500).json({ error: 'Erro ao autenticar.' });
    }
});

// ── POST /api/forgot-password ────────────────────────────
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'E-mail é obrigatório.' });
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    try {
        // Verifica se o e-mail existe no Firebase Auth
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
        } catch (_) {
            return res.status(404).json({ error: 'E-mail não encontrado.' });
        }

        // Salva o código de reset no documento do usuário no Firestore
        await db.collection('usuarios').doc(userRecord.uid).set(
            { resetToken: codigo, tokenExpiry: expiry.toISOString() },
            { merge: true }
        );

        try {
            await enviarEmailBrevo(
                email,
                'Código de Recuperação de Senha — NaRede Store',
                `<div style="font-family:Poppins,sans-serif;max-width:480px;margin:0 auto;">
                    <h2 style="color:#422BFF;">NaRede Store</h2>
                    <p>Seu código de recuperação de senha é:</p>
                    <h1 style="letter-spacing:6px;color:#222;">${codigo}</h1>
                    <p style="color:#666;">Válido por <strong>15 minutos</strong>. Ignore se não solicitou.</p>
                  </div>`
            );
            res.json({ success: true });
        } catch (mailErr) {
            console.error('Erro ao enviar e-mail:', mailErr.message);
            res.status(500).json({ error: `Erro ao enviar e-mail: ${mailErr.message}` });
        }
    } catch (err) {
        console.error('Erro em forgot-password:', err);
        res.status(500).json({ error: 'Erro no processamento.' });
    }
});

// ── POST /api/reset-password ─────────────────────────────
app.post('/api/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
        return res.status(400).json({ error: 'E-mail, código e nova senha são obrigatórios.' });
    }

    try {
        // Encontra o usuário pelo e-mail no Firebase Auth
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
        } catch (_) {
            return res.status(404).json({ error: 'E-mail não encontrado.' });
        }

        // Valida o código no Firestore
        const doc = await db.collection('usuarios').doc(userRecord.uid).get();
        if (!doc.exists) return res.status(400).json({ error: 'Código inválido.' });

        const data = doc.data();
        if (data.resetToken !== code) {
            return res.status(400).json({ error: 'Código inválido.' });
        }
        if (data.tokenExpiry && new Date() > new Date(data.tokenExpiry)) {
            return res.status(400).json({ error: 'Código expirado. Solicite um novo.' });
        }

        // Atualiza senha no Firebase Auth e limpa o token no Firestore
        await auth.updateUser(userRecord.uid, { password: newPassword });
        await db.collection('usuarios').doc(userRecord.uid).update({
            resetToken:   admin.firestore.FieldValue.delete(),
            tokenExpiry:  admin.firestore.FieldValue.delete()
        });

        res.json({ success: true, message: 'Senha redefinida com sucesso!' });
    } catch (err) {
        console.error('Erro em reset-password:', err);
        res.status(500).json({ error: 'Erro ao redefinir senha.' });
    }
});

// ── GET /api/perfil?uid=... ──────────────────────────────
app.get('/api/perfil', async (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: 'uid é obrigatório.' });

    try {
        const doc = await db.collection('usuarios').doc(uid).get();
        if (!doc.exists) return res.status(404).json({ error: 'Usuário não encontrado.' });
        res.json({ usuario: { id: uid, ...doc.data() } });
    } catch (err) {
        console.error('Erro em GET /api/perfil:', err);
        res.status(500).json({ error: 'Erro ao buscar perfil.' });
    }
});

// ── PUT /api/perfil ──────────────────────────────────────
app.put('/api/perfil', async (req, res) => {
    const { uid, nome, sobrenome, genero, celular, cpf, cep, rua, bairro, cidade, estado } = req.body;
    if (!uid || !nome) return res.status(400).json({ error: 'uid e nome são obrigatórios.' });

    try {
        await db.collection('usuarios').doc(uid).update({
            nome, sobrenome: sobrenome || '', genero: genero || '',
            celular: celular || '', cpf: cpf || '', cep: cep || '',
            rua: rua || '', bairro: bairro || '', cidade: cidade || '',
            estado: estado || '',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        await auth.updateUser(uid, { displayName: nome });
        res.json({ success: true, message: 'Perfil atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro em PUT /api/perfil:', err);
        res.status(500).json({ error: 'Erro ao atualizar perfil.' });
    }
});

// ── PUT /api/perfil/senha ────────────────────────────────
app.put('/api/perfil/senha', async (req, res) => {
    const { uid, senhaAtual, novaSenha } = req.body;
    if (!uid || !senhaAtual || !novaSenha) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    try {
        // Busca o e-mail do usuário para verificar a senha atual
        const userRecord = await auth.getUser(uid);

        // Verifica senha atual via Firebase Auth REST API
        try {
            await firebaseSignIn(userRecord.email, senhaAtual);
        } catch (_) {
            return res.status(401).json({ error: 'Senha atual incorreta.' });
        }

        // Atualiza para a nova senha via Admin SDK
        await auth.updateUser(uid, { password: novaSenha });
        res.json({ success: true, message: 'Senha alterada com sucesso!' });
    } catch (err) {
        console.error('Erro em PUT /api/perfil/senha:', err);
        res.status(500).json({ error: 'Erro ao alterar senha.' });
    }
});

// ── POST /api/pagar ──────────────────────────────────────
// metodo: 'pix' | 'cartao' | 'boleto'
// itens: [{nome, preco, qtd}]  — preço é validado contra o catálogo
app.post('/api/pagar', async (req, res) => {
    const { metodo, itens, parcelas, payerEmail, uid, clienteNome } = req.body;

    if (!metodo || !Array.isArray(itens) || !itens.length || !payerEmail) {
        return res.status(400).json({ error: 'metodo, itens e payerEmail são obrigatórios.' });
    }

    // ── Validação de preços contra o catálogo ──────────
    let totalValor = 0;
    for (const item of itens) {
        const catalogoItem = CATALOGO_PRECOS[item.nome];
        if (!catalogoItem) {
            return res.status(400).json({ error: `Produto desconhecido: "${item.nome}".` });
        }
        const precoEnviado = Number(item.preco);
        const precoValido  = catalogoItem.some(p => Math.abs(p - precoEnviado) < 0.01);
        if (!precoValido) {
            return res.status(400).json({
                error: `Preço inválido para "${item.nome}". Preços aceitos: R$ ${catalogoItem.join(' / R$ ')}.`
            });
        }
        const qtd = Math.max(1, Math.floor(Number(item.qtd) || 1));
        totalValor += precoEnviado * qtd;
    }
    totalValor = Math.round(totalValor * 100) / 100; // arredonda centavos

    const valor = totalValor;

    // Monta descrição e lista de itens para o MP
    const descricao = itens.map(i => `${i.nome} x${i.qtd || 1}`).join(', ');
    const mpItens   = itens.map(i => ({
        title:      i.nome,
        unit_price: Number(i.preco),
        quantity:   Math.max(1, Math.floor(Number(i.qtd) || 1)),
        currency_id: 'BRL'
    }));

    try {
        if (metodo === 'pix') {
            // PIX via Payments API → retorna QR code para exibir na página
            const payment = new Payment(mpClient);
            const result = await payment.create({
                body: {
                    transaction_amount: valor,
                    description: descricao || 'Pedido NaRede Store',
                    payment_method_id: 'pix',
                    payer: { email: payerEmail }
                }
            });

            const txData = result.point_of_interaction?.transaction_data;

            // Salvar pedido no Firestore
            const pedidoRef = await db.collection('pedidos').add({
                clienteEmail: payerEmail,
                clienteNome: clienteNome || '',
                uid: uid || '',
                metodo,
                itens: itens.map(i => ({ nome: i.nome, preco: Number(i.preco), qtd: i.qtd || 1 })),
                total: valor,
                status: 'pendente',
                mpId: result.id,
                criadoEm: admin.firestore.FieldValue.serverTimestamp()
            });

            return res.json({
                id: result.id,
                pedidoId: pedidoRef.id,
                qr_code:        txData?.qr_code        || '',
                qr_code_base64: txData?.qr_code_base64 || ''
            });
        }

        // Cartão de crédito ou Boleto → Checkout Pro (redirect)
        const preference = new Preference(mpClient);
        const body = {
            items: mpItens,
            payer: { email: payerEmail },
            back_urls: {
                success: process.env.SITE_URL + '/sucesso.html',
                failure: process.env.SITE_URL + '/erro.html'
            },
            auto_return: 'approved',
            payment_methods: {}
        };

        if (metodo === 'cartao') {
            body.payment_methods = {
                excluded_payment_types:  [{ id: 'ticket' }, { id: 'bank_transfer' }],
                installments: Number(parcelas) || 12,
                default_installments: Number(parcelas) || 1
            };
        } else if (metodo === 'boleto') {
            body.payment_methods = {
                excluded_payment_types: [
                    { id: 'credit_card' },
                    { id: 'debit_card' },
                    { id: 'bank_transfer' }
                ]
            };
        }

        const result = await preference.create({ body });

        // Salvar pedido no Firestore
        await db.collection('pedidos').add({
            clienteEmail: payerEmail,
            clienteNome: clienteNome || '',
            uid: uid || '',
            metodo,
            itens: itens.map(i => ({ nome: i.nome, preco: Number(i.preco), qtd: i.qtd || 1 })),
            total: valor,
            status: 'pendente',
            mpPreferenceId: result.id,
            criadoEm: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.json({ init_point: result.init_point });

    } catch (err) {
        console.error('Erro em POST /api/pagar:', err);
        res.status(500).json({ error: 'Erro ao processar pagamento.' });
    }
});

// ── POST /api/create-preference (MercadoPago) ──────────────
app.post('/api/create-preference', async (req, res) => {
    const { description, price, quantity } = req.body;
    if (!description || !price || !quantity) {
        return res.status(400).json({ error: 'description, price e quantity são obrigatórios.' });
    }

    try {
        const preference = new Preference(mpClient);
        const result = await preference.create({
            body: {
                items: [
                    {
                        title: description,
                        unit_price: Number(price),
                        quantity: Number(quantity)
                    }
                ],
                back_urls: {
                    success: process.env.SITE_URL + '/sucesso.html',
                    failure: process.env.SITE_URL + '/erro.html'
                },
                auto_return: 'approved'
            }
        });
        res.json({ init_point: result.init_point });
    } catch (err) {
        console.error('Erro ao criar preferência MP:', err);
        res.status(500).json({ error: 'Erro ao criar pagamento.' });
    }
});

// ── ADMIN: E-mail do administrador ───────────────────────
const ADMIN_EMAIL = 'juliosamuel289@gmail.com';

// Middleware de verificação de admin
async function verificarAdmin(req, res, next) {
    const uid = req.body.uid || req.query.uid;
    if (!uid) return res.status(401).json({ error: 'UID obrigatório.' });

    try {
        const userRecord = await auth.getUser(uid);
        if (userRecord.email !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }
        req.adminUid = uid;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Usuário inválido.' });
    }
}

// ── GET /api/admin/check?uid=... ─────────────────────────
app.get('/api/admin/check', async (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.json({ isAdmin: false });

    try {
        const userRecord = await auth.getUser(uid);
        res.json({ isAdmin: userRecord.email === ADMIN_EMAIL });
    } catch (_) {
        res.json({ isAdmin: false });
    }
});

// ── GET /api/produtos?pagina=... (PÚBLICO) ───────────────
app.get('/api/produtos', async (req, res) => {
    const { pagina } = req.query;
    try {
        let q = db.collection('produtos');
        if (pagina) q = q.where('pagina', '==', pagina);
        const snapshot = await q.get();
        const produtos = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            produtos.push({ id: doc.id, nome: d.nome, preco: d.preco, imagem: d.imagem, descricao: d.descricao, pagina: d.pagina });
        });
        // Ordena por data de criação (mais recente primeiro) sem precisar de índice composto
        produtos.sort((a, b) => {
            const tA = a.criadoEm?._seconds || 0;
            const tB = b.criadoEm?._seconds || 0;
            return tB - tA;
        });
        res.json({ produtos });
    } catch (err) {
        console.error('Erro em GET /api/produtos:', err.message);
        res.status(500).json({ error: 'Erro ao carregar produtos.' });
    }
});

// ── GET /api/meu-pedido?email=... ────────────────────────
app.get('/api/meu-pedido', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email obrigatório.' });

    try {
        const snapshot = await db.collection('pedidos')
            .where('clienteEmail', '==', email)
            .limit(5)
            .get();

        if (snapshot.empty) return res.json({ pedidos: [] });

        const pedidos = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            pedidos.push({
                id: doc.id,
                status: d.status,
                metodo: d.metodo,
                total: d.total,
                itens: d.itens,
                criadoEm: d.criadoEm
            });
        });
        // Ordena por data (mais recente primeiro)
        pedidos.sort((a, b) => (b.criadoEm?._seconds || 0) - (a.criadoEm?._seconds || 0));
        res.json({ pedidos });
    } catch (err) {
        console.error('Erro em GET /api/meu-pedido:', err.message);
        res.status(500).json({ error: 'Erro ao buscar pedidos.' });
    }
});

// ── POST /api/cancelar-pedido ────────────────────────────
app.post('/api/cancelar-pedido', async (req, res) => {
    const { pedidoId, email } = req.body;
    if (!pedidoId || !email) return res.status(400).json({ error: 'pedidoId e email obrigatórios.' });

    try {
        const pedidoDoc = await db.collection('pedidos').doc(pedidoId).get();
        if (!pedidoDoc.exists) return res.status(404).json({ error: 'Pedido não encontrado.' });

        const pedidoData = pedidoDoc.data();

        // Verificar que o email pertence ao dono do pedido
        if (pedidoData.clienteEmail !== email) {
            return res.status(403).json({ error: 'Você não tem permissão para cancelar este pedido.' });
        }

        // Não permite cancelar pedidos já entregues ou já cancelados
        if (pedidoData.status === 'entregue') {
            return res.status(400).json({ error: 'Pedidos entregues não podem ser cancelados.' });
        }
        if (pedidoData.status === 'cancelado') {
            return res.status(400).json({ error: 'Este pedido já foi cancelado.' });
        }

        // Atualiza status para cancelado
        await db.collection('pedidos').doc(pedidoId).update({
            status: 'cancelado',
            canceladoPor: 'cliente',
            atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
        });

        // Estorno automático via MercadoPago
        if (pedidoData.mpId) {
            try {
                const refund = new PaymentRefund(mpClient);
                await refund.create({ payment_id: pedidoData.mpId, body: {} });
                console.log(`✅ Estorno (cliente) realizado para pagamento ${pedidoData.mpId}`);
                await db.collection('pedidos').doc(pedidoId).update({ estornado: true });
            } catch (refundErr) {
                console.error('⚠️ Erro ao estornar pagamento:', refundErr.message);
            }
        }

        // Email de confirmação de cancelamento ao cliente
        const totalFormatado = pedidoData.total ? `R$ ${Number(pedidoData.total).toFixed(2)}` : '-';
        const itensHtml = (pedidoData.itens || []).map(i =>
            `<li>${i.nome} x${i.qtd || 1} — R$ ${Number(i.preco * (i.qtd || 1)).toFixed(2)}</li>`
        ).join('');

        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9f9f9;border-radius:12px;">
            <h2 style="color:#422BFF;margin-bottom:8px;">NaRede Store</h2>
            <p>Olá${pedidoData.clienteNome ? ', <strong>' + pedidoData.clienteNome + '</strong>' : ''}!</p>
            <p>Seu pedido <strong>#${pedidoId.slice(0, 8)}</strong> foi <strong>cancelado</strong> com sucesso.</p>
            <div style="background:#fff;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #dc3545;">
              <p style="font-size:18px;margin:0;">❌ <strong>Pedido Cancelado</strong></p>
            </div>
            <div style="background:#fff3cd;border-radius:8px;padding:12px;margin:8px 0;border-left:4px solid #ffc107;">
              <p style="margin:0;font-size:14px;">💰 <strong>O estorno do valor será processado automaticamente.</strong> O prazo para o valor aparecer na sua conta depende da forma de pagamento utilizada.</p>
            </div>
            <h3 style="margin-bottom:8px;">Itens do pedido:</h3>
            <ul style="padding-left:20px;">${itensHtml}</ul>
            <p><strong>Total: ${totalFormatado}</strong></p>
            <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
            <p style="font-size:12px;color:#888;">Este é um e-mail automático. Em caso de dúvidas, acesse nossa Central de Ajuda no site.</p>
          </div>
        `;

        enviarEmailBrevo(
            email,
            `❌ Pedido #${pedidoId.slice(0, 8)} — Cancelado`,
            html
        ).catch(err => console.error('Erro ao enviar email de cancelamento:', err.message));

        res.json({ success: true, message: 'Pedido cancelado e estorno solicitado.' });
    } catch (err) {
        console.error('Erro ao cancelar pedido:', err);
        res.status(500).json({ error: 'Erro ao cancelar pedido.' });
    }
});

// ── GET /api/admin/pedidos?uid=... ───────────────────────
app.get('/api/admin/pedidos', verificarAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('pedidos').orderBy('criadoEm', 'desc').limit(100).get();
        const pedidos = [];
        snapshot.forEach(doc => pedidos.push({ id: doc.id, ...doc.data() }));
        res.json({ pedidos });
    } catch (err) {
        console.error('Erro ao listar pedidos:', err);
        res.status(500).json({ error: 'Erro ao listar pedidos.' });
    }
});

// ── PUT /api/admin/pedido/status ─────────────────────────
app.put('/api/admin/pedido/status', verificarAdmin, async (req, res) => {
    const { pedidoId, status } = req.body;
    const statusValidos = ['pendente', 'confirmado', 'preparando', 'enviado', 'entregue', 'cancelado'];

    if (!pedidoId || !status) return res.status(400).json({ error: 'pedidoId e status obrigatórios.' });
    if (!statusValidos.includes(status)) return res.status(400).json({ error: 'Status inválido. Use: ' + statusValidos.join(', ') });

    try {
        // Busca dados do pedido para obter email do cliente
        const pedidoDoc = await db.collection('pedidos').doc(pedidoId).get();
        if (!pedidoDoc.exists) return res.status(404).json({ error: 'Pedido não encontrado.' });
        const pedidoData = pedidoDoc.data();

        await db.collection('pedidos').doc(pedidoId).update({
            status,
            atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
        });

        // Se cancelado, tenta estornar o pagamento no MercadoPago
        if (status === 'cancelado' && pedidoData.mpId) {
            try {
                const refund = new PaymentRefund(mpClient);
                await refund.create({ payment_id: pedidoData.mpId, body: {} });
                console.log(`✅ Estorno realizado para pagamento ${pedidoData.mpId}`);
                await db.collection('pedidos').doc(pedidoId).update({ estornado: true });
            } catch (refundErr) {
                console.error('⚠️ Erro ao estornar pagamento:', refundErr.message);
                // Não bloqueia a atualização de status
            }
        }

        // Envia email de notificação ao cliente
        const clienteEmail = pedidoData.clienteEmail;
        if (clienteEmail) {
            const statusEmoji = {
                confirmado: '✅', preparando: '📦', enviado: '🚚',
                entregue: '✔️', cancelado: '❌', pendente: '⏳'
            };
            const emoji = statusEmoji[status] || '📋';
            const itensHtml = (pedidoData.itens || []).map(i =>
                `<li>${i.nome} x${i.qtd || 1} — R$ ${Number(i.preco * (i.qtd || 1)).toFixed(2)}</li>`
            ).join('');
            const totalFormatado = pedidoData.total ? `R$ ${Number(pedidoData.total).toFixed(2)}` : '-';

            const html = `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9f9f9;border-radius:12px;">
                <h2 style="color:#422BFF;margin-bottom:8px;">NaRede Store</h2>
                <p>Olá${pedidoData.clienteNome ? ', <strong>' + pedidoData.clienteNome + '</strong>' : ''}!</p>
                <p>O status do seu pedido <strong>#${pedidoId.slice(0, 8)}</strong> foi atualizado:</p>
                <div style="background:#fff;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid ${status === 'cancelado' ? '#dc3545' : '#422BFF'};">
                  <p style="font-size:18px;margin:0;">${emoji} <strong style="text-transform:capitalize;">${status}</strong></p>
                </div>
                ${status === 'cancelado' ? '<div style="background:#fff3cd;border-radius:8px;padding:12px;margin:8px 0;border-left:4px solid #ffc107;"><p style="margin:0;font-size:14px;">💰 <strong>O estorno do valor será processado automaticamente.</strong> O prazo para o valor aparecer na sua conta depende da forma de pagamento utilizada.</p></div>' : ''}
                <h3 style="margin-bottom:8px;">Itens do pedido:</h3>
                <ul style="padding-left:20px;">${itensHtml}</ul>
                <p><strong>Total: ${totalFormatado}</strong></p>
                <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
                <p style="font-size:12px;color:#888;">Este é um e-mail automático. Em caso de dúvidas, acesse nossa Central de Ajuda no site.</p>
              </div>
            `;

            enviarEmailBrevo(
                clienteEmail,
                `${emoji} Pedido #${pedidoId.slice(0, 8)} — ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                html
            ).catch(err => console.error('Erro ao enviar email de status:', err.message));
        }

        res.json({ success: true, message: 'Status atualizado.' });
    } catch (err) {
        console.error('Erro ao atualizar pedido:', err);
        res.status(500).json({ error: 'Erro ao atualizar pedido.' });
    }
});

// ── DELETE /api/admin/pedido ─────────────────────────────
app.delete('/api/admin/pedido', verificarAdmin, async (req, res) => {
    const { pedidoId } = req.body;
    if (!pedidoId) return res.status(400).json({ error: 'pedidoId obrigatório.' });

    try {
        await db.collection('pedidos').doc(pedidoId).delete();
        res.json({ success: true, message: 'Pedido deletado.' });
    } catch (err) {
        console.error('Erro ao deletar pedido:', err);
        res.status(500).json({ error: 'Erro ao deletar pedido.' });
    }
});

// ── DELETE /api/admin/pedidos-por-email ──────────────────
app.delete('/api/admin/pedidos-por-email', verificarAdmin, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email obrigatório.' });

    try {
        const snapshot = await db.collection('pedidos').where('clienteEmail', '==', email).get();
        if (snapshot.empty) return res.json({ success: true, message: 'Nenhum pedido encontrado para esse email.', deletados: 0 });

        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        res.json({ success: true, message: `${snapshot.size} pedido(s) deletado(s).`, deletados: snapshot.size });
    } catch (err) {
        console.error('Erro ao deletar pedidos por email:', err);
        res.status(500).json({ error: 'Erro ao deletar pedidos.' });
    }
});

// ── GET /api/admin/produtos?uid=... ──────────────────────
app.get('/api/admin/produtos', verificarAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('produtos').orderBy('criadoEm', 'desc').get();
        const produtos = [];
        snapshot.forEach(doc => produtos.push({ id: doc.id, ...doc.data() }));
        res.json({ produtos });
    } catch (err) {
        console.error('Erro ao listar produtos:', err);
        res.status(500).json({ error: 'Erro ao listar produtos.' });
    }
});

// ── POST /api/admin/upload (imagem → Firebase Storage) ───
app.post('/api/admin/upload', upload.single('imagem'), verificarAdmin, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada.' });

    try {
        const ext = path.extname(req.file.originalname) || '.jpg';
        const fileName = `produtos/${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
        const file = bucket.file(fileName);

        await file.save(req.file.buffer, {
            metadata: { contentType: req.file.mimetype },
            public: true
        });

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        res.json({ url: publicUrl });
    } catch (err) {
        console.error('Erro ao enviar imagem:', err);
        res.status(500).json({ error: 'Erro ao enviar imagem: ' + err.message });
    }
});

// ── POST /api/admin/produto ──────────────────────────────
app.post('/api/admin/produto', verificarAdmin, async (req, res) => {
    const { nome, preco, pagina, imagem, descricao } = req.body;

    if (!nome || !preco || !pagina) {
        return res.status(400).json({ error: 'Nome, preço e página são obrigatórios.' });
    }

    try {
        const precoNum = Number(preco);
        const doc = await db.collection('produtos').add({
            nome,
            preco: precoNum,
            pagina,
            imagem: imagem || '',
            descricao: descricao || '',
            criadoEm: admin.firestore.FieldValue.serverTimestamp()
        });

        // Sincroniza catálogo de preços
        CATALOGO_PRECOS[nome] = CATALOGO_PRECOS[nome] || [];
        if (!CATALOGO_PRECOS[nome].includes(precoNum)) {
            CATALOGO_PRECOS[nome].push(precoNum);
        }

        res.status(201).json({ success: true, id: doc.id });
    } catch (err) {
        console.error('Erro ao criar produto:', err);
        res.status(500).json({ error: 'Erro ao criar produto.' });
    }
});

// ── PUT /api/admin/produto ───────────────────────────────
app.put('/api/admin/produto', verificarAdmin, async (req, res) => {
    const { produtoId, nome, preco, pagina, imagem, descricao } = req.body;
    if (!produtoId || !nome || !preco) return res.status(400).json({ error: 'produtoId, nome e preço obrigatórios.' });

    try {
        await db.collection('produtos').doc(produtoId).update({
            nome, preco: Number(preco), pagina: pagina || '',
            imagem: imagem || '', descricao: descricao || '',
            atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao atualizar produto:', err);
        res.status(500).json({ error: 'Erro ao atualizar produto.' });
    }
});

// ── DELETE /api/admin/produto ────────────────────────────
app.delete('/api/admin/produto', verificarAdmin, async (req, res) => {
    const { produtoId } = req.body;
    if (!produtoId) return res.status(400).json({ error: 'produtoId obrigatório.' });

    try {
        await db.collection('produtos').doc(produtoId).delete();
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao deletar produto:', err);
        res.status(500).json({ error: 'Erro ao deletar produto.' });
    }
});

// ── Rota da página admin ─────────────────────────────────
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ── POST /api/contato ────────────────────────────────────
app.post('/api/contato', async (req, res) => {
    const { nome, email, telefone, assunto, mensagem } = req.body;
    if (!nome || !email || !mensagem) {
        return res.status(400).json({ error: 'Nome, e-mail e mensagem são obrigatórios.' });
    }

    try {
        await enviarEmailBrevo(
            process.env.BREVO_SENDER_EMAIL,
            `[Central de Ajuda] ${assunto || 'Sem assunto'} — ${nome}`,
            `<div style="font-family:Poppins,sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#422BFF;">Central de Ajuda — NaRede Store</h2>
                <p><b>Nome:</b> ${nome}</p>
                <p><b>E-mail:</b> ${email}</p>
                <p><b>Telefone:</b> ${telefone || 'Não informado'}</p>
                <p><b>Assunto:</b> ${assunto || 'Não informado'}</p>
                <hr style="border:1px solid #eee;margin:16px 0;">
                <p><b>Mensagem:</b></p>
                <p style="white-space:pre-line;color:#444;">${mensagem}</p>
            </div>`
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Erro em POST /api/contato:', err.message);
        res.status(500).json({ error: 'Erro ao enviar mensagem.' });
    }
});

// ── Inicia servidor ──────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📊 Memória: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);

    // Keep-alive: usa UptimeRobot externo (recomendado).
    // Self-ping desativado — Render bloqueia self-pings no free tier.
    // Configure UptimeRobot para pingar: https://naredestore-api.onrender.com/health
    console.log('💡 Use UptimeRobot para manter o serviço ativo.');
});

// Log quando Render mata o processo
process.on('SIGTERM', () => {
    console.log('⚠️ SIGTERM recebido — Render está desligando o servidor');
    process.exit(0);
});
