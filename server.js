require('dotenv').config();
const express  = require('express');
const mysql    = require('mysql2/promise');
const bcrypt   = require('bcryptjs');
const nodemailer = require('nodemailer');
const cors     = require('cors');
const path     = require('path');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();

// ── Middlewares ──────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// ── Pool de conexão (Aiven MySQL) ────────────────────────
const pool = mysql.createPool({
    host:            process.env.DB_HOST,
    port:            Number(process.env.DB_PORT) || 16604,
    user:            process.env.DB_USER,
    password:        process.env.DB_PASSWORD,
    database:        process.env.DB_NAME,
    ssl:             { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit:      0
});

// ── Cria a tabela se não existir e testa conexão ─────────
(async () => {
    try {
        const conn = await pool.getConnection();
        console.log('✅ Banco de dados conectado com sucesso!');

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                nome         VARCHAR(100) NOT NULL,
                sobrenome    VARCHAR(100),
                genero       VARCHAR(20),
                celular      VARCHAR(20),
                cpf          VARCHAR(14),
                cep          VARCHAR(9),
                rua          VARCHAR(255),
                bairro       VARCHAR(100),
                cidade       VARCHAR(100),
                estado       VARCHAR(2),
                email        VARCHAR(255) NOT NULL UNIQUE,
                senha        VARCHAR(255) NOT NULL,
                reset_token  VARCHAR(6)   DEFAULT NULL,
                token_expiry DATETIME     DEFAULT NULL,
                created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela "usuarios" verificada/criada.');
        conn.release();
    } catch (err) {
        console.error('❌ Falha ao conectar ao banco:', err.message);
    }
})();

// ── Nodemailer (Gmail) ───────────────────────────────────
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

// ── MercadoPago ─────────────────────────────────────────────
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// ── Rotas de páginas ─────────────────────────────────────
app.get('/',        (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/cadastro',(req, res) => res.sendFile(path.join(__dirname, 'cadastro.html')));
app.get('/login',   (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.post('/envio',  (req, res) => res.status(200).send('Inscrição recebida!'));

// ── POST /api/register ───────────────────────────────────
app.post('/api/register', async (req, res) => {
    const { nome, sobrenome, genero, celular, cpf, cep, rua, bairro, cidade, estado, email, senha } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    try {
        const [existing] = await pool.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'E-mail já cadastrado.' });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        await pool.execute(
            `INSERT INTO usuarios
                (nome, sobrenome, genero, celular, cpf, cep, rua, bairro, cidade, estado, email, senha)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nome, sobrenome, genero, celular, cpf, cep, rua, bairro, cidade, estado, email, senhaHash]
        );

        res.status(201).json({ success: true, message: 'Cadastro realizado com sucesso!' });
    } catch (err) {
        console.error('Erro no cadastro:', err);
        res.status(500).json({ error: 'Erro ao salvar no banco.' });
    }
});

// ── POST /api/login ──────────────────────────────────────
app.post('/api/login', async (req, res) => {
    const { email, password, senha } = req.body;
    const senhaFornecida = password || senha; // aceita ambos os campos

    if (!email || !senhaFornecida) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    try {
        const [rows] = await pool.execute('SELECT * FROM usuarios WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
        }

        const user = rows[0];
        const senhaValida = await bcrypt.compare(senhaFornecida, user.senha);

        if (!senhaValida) {
            return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
        }

        res.json({ success: true, user: { id: user.id, nome: user.nome, email: user.email } });
    } catch (err) {
        console.error('Erro no login:', err);
        res.status(500).json({ error: 'Erro de conexão com o banco.' });
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
        const [rows] = await pool.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'E-mail não encontrado.' });
        }

        await pool.execute(
            'UPDATE usuarios SET reset_token = ?, token_expiry = ? WHERE email = ?',
            [codigo, expiry, email]
        );

        try {
            await transporter.sendMail({
                from: `"NaRede Store" <${process.env.GMAIL_USER}>`,
                to: email,
                subject: 'Código de Recuperação de Senha — NaRede Store',
                html: `
                  <div style="font-family:Poppins,sans-serif;max-width:480px;margin:0 auto;">
                    <h2 style="color:#422BFF;">NaRede Store</h2>
                    <p>Seu código de recuperação de senha é:</p>
                    <h1 style="letter-spacing:6px;color:#222;">${codigo}</h1>
                    <p style="color:#666;">Válido por <strong>15 minutos</strong>. Ignore se não solicitou.</p>
                  </div>`
            });
            res.json({ success: true });
        } catch (mailErr) {
            console.error('Erro ao enviar e-mail:', mailErr.message);
            // Em ambiente de desenvolvimento retorna o código diretamente
            const debugCode = process.env.NODE_ENV !== 'production' ? codigo : undefined;
            res.json({ success: true, debugCode });
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
        const [rows] = await pool.execute(
            'SELECT * FROM usuarios WHERE email = ? AND reset_token = ?',
            [email, code]
        );

        if (rows.length === 0) {
            return res.status(400).json({ error: 'Código inválido.' });
        }

        const user = rows[0];
        if (user.token_expiry && new Date() > new Date(user.token_expiry)) {
            return res.status(400).json({ error: 'Código expirado. Solicite um novo.' });
        }

        const senhaHash = await bcrypt.hash(newPassword, 10);

        await pool.execute(
            'UPDATE usuarios SET senha = ?, reset_token = NULL, token_expiry = NULL WHERE email = ?',
            [senhaHash, email]
        );

        res.json({ success: true, message: 'Senha redefinida com sucesso!' });
    } catch (err) {
        console.error('Erro em reset-password:', err);
        res.status(500).json({ error: 'Erro ao redefinir senha.' });
    }
});

// ── GET /api/perfil?email=... ────────────────────────────
app.get('/api/perfil', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'E-mail é obrigatório.' });

    try {
        const [rows] = await pool.execute(
            'SELECT id, nome, sobrenome, genero, celular, cpf, cep, rua, bairro, cidade, estado, email, created_at FROM usuarios WHERE email = ?',
            [email]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
        res.json({ usuario: rows[0] });
    } catch (err) {
        console.error('Erro em GET /api/perfil:', err);
        res.status(500).json({ error: 'Erro ao buscar perfil.' });
    }
});

// ── PUT /api/perfil ──────────────────────────────────────
app.put('/api/perfil', async (req, res) => {
    const { email, nome, sobrenome, genero, celular, cpf, cep, rua, bairro, cidade, estado } = req.body;
    if (!email || !nome) return res.status(400).json({ error: 'E-mail e nome são obrigatórios.' });

    try {
        await pool.execute(
            `UPDATE usuarios SET nome=?, sobrenome=?, genero=?, celular=?, cpf=?, cep=?, rua=?, bairro=?, cidade=?, estado=? WHERE email=?`,
            [nome, sobrenome, genero, celular, cpf, cep, rua, bairro, cidade, estado, email]
        );
        res.json({ success: true, message: 'Perfil atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro em PUT /api/perfil:', err);
        res.status(500).json({ error: 'Erro ao atualizar perfil.' });
    }
});

// ── PUT /api/perfil/senha ────────────────────────────────
app.put('/api/perfil/senha', async (req, res) => {
    const { email, senhaAtual, novaSenha } = req.body;
    if (!email || !senhaAtual || !novaSenha) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    try {
        const [rows] = await pool.execute('SELECT senha FROM usuarios WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

        const senhaValida = await bcrypt.compare(senhaAtual, rows[0].senha);
        if (!senhaValida) return res.status(401).json({ error: 'Senha atual incorreta.' });

        const senhaHash = await bcrypt.hash(novaSenha, 10);
        await pool.execute('UPDATE usuarios SET senha = ? WHERE email = ?', [senhaHash, email]);

        res.json({ success: true, message: 'Senha alterada com sucesso!' });
    } catch (err) {
        console.error('Erro em PUT /api/perfil/senha:', err);
        res.status(500).json({ error: 'Erro ao alterar senha.' });
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

// ── Inicia servidor ──────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
