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
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

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
    })
});
const db   = admin.firestore();
const auth = admin.auth();
console.log('✅ Firebase Admin inicializado.');

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
            path:     `/v1/accounts:signInWithEmailAndPassword?key=${apiKey}`,
            method:   'POST',
            headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                clearTimeout(timeout);
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode === 200) resolve(parsed);
                    else reject(new Error(parsed.error?.message || 'Credenciais inválidas.'));
                } catch (e) {
                    reject(new Error('Resposta inválida do Firebase Auth.'));
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
            console.error('Erro firebaseSignIn:', msg);

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
            if (msg.includes('Timeout') || msg.includes('FIREBASE_WEB_API_KEY')) {
                return res.status(503).json({ error: 'Servidor temporariamente indisponível. Tente novamente.' });
            }
            return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
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
    const { metodo, itens, parcelas, payerEmail } = req.body;

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
            return res.json({
                id: result.id,
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
