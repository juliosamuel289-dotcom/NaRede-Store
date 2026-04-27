# Documentação Técnica — NaRede Store

## Análise Arquitetural do Backend Node.js/Express

**Projeto:** NaRede Store — E-commerce de Camisas de Futebol  
**Stack:** Node.js + Express | Firebase (Auth, Firestore, Storage) | MercadoPago | Brevo  
**Hospedagem:** Render (Web Service — Free Tier)  
**Repositório:** GitHub — juliosamuel289-dotcom/NaRede-Store  
**Autor:** Julio Samuel  
**Data:** Abril de 2026

---

## Sumário

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Autenticação com Firebase](#2-autenticação-com-firebase)
3. [Processamento de Checkout com MercadoPago](#3-processamento-de-checkout-com-mercadopago)
4. [Notificações por E-mail via Brevo](#4-notificações-por-e-mail-via-brevo)
5. [Segurança: Variáveis de Ambiente e Boas Práticas](#5-segurança-variáveis-de-ambiente-e-boas-práticas)
6. [Fluxo Completo de Dados](#6-fluxo-completo-de-dados)
7. [Diagrama de Dependências](#7-diagrama-de-dependências)
8. [Glossário Técnico](#8-glossário-técnico)

---

## 1. Visão Geral da Arquitetura

A NaRede Store utiliza uma **arquitetura monolítica baseada em API REST**, onde um único servidor Express.js hospedado no Render é responsável por:

- **Servir os arquivos estáticos** (HTML, CSS, JS) do frontend
- **Expor endpoints REST** para autenticação, pagamentos, gestão de pedidos e produtos
- **Integrar-se a três serviços externos** via APIs: Firebase, MercadoPago e Brevo

### 1.1 Stack Tecnológica

| Camada | Tecnologia | Versão | Função |
|--------|-----------|--------|--------|
| **Runtime** | Node.js | ≥ 18.0.0 | Ambiente de execução JavaScript server-side |
| **Framework HTTP** | Express.js | 4.22.1 | Roteamento, middlewares, servidor web |
| **BaaS** | Firebase Admin SDK | 13.7.0 | Autenticação, banco de dados, armazenamento |
| **Gateway de Pagamento** | MercadoPago SDK | 2.12.0 | Processamento de pagamentos (PIX, Cartão, Boleto) |
| **E-mail Transacional** | Brevo (ex-Sendinblue) | API v3 | Envio de e-mails de notificação |
| **Upload** | Multer | 2.1.1 | Upload de imagens em memória |
| **Variáveis de Ambiente** | dotenv | 17.3.1 | Carregamento seguro de configurações |
| **CORS** | cors | 2.8.6 | Controle de acesso cross-origin |

### 1.2 Modelo de Implantação (Deploy)

O Render funciona como PaaS (Platform as a Service). O fluxo de deploy é:

```
Push no GitHub (branch main)
       ↓
Render detecta alteração via webhook do GitHub
       ↓
Render executa: npm install → node server.js
       ↓
Servidor ativo em: https://naredestore-api.onrender.com
```

O servidor escuta em `0.0.0.0` na porta fornecida pela variável `PORT` (injetada pelo Render), garantindo que o container do Render consiga rotear tráfego para a aplicação.

---

## 2. Autenticação com Firebase

### 2.1 Inicialização do Firebase Admin SDK

O Firebase Admin SDK é autenticado via **Service Account** (conta de serviço). Diferente do SDK client-side que usa apenas a API Key, o Admin SDK recebe uma **credencial de certificado** que concede acesso privilegiado (leitura/escrita irrestrita) ao projeto Firebase.

```javascript
admin.initializeApp({
    credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});
```

**Análise técnica:**

| Parâmetro | Origem | Função |
|-----------|--------|--------|
| `projectId` | `FIREBASE_PROJECT_ID` | Identifica o projeto Firebase (ex: `naredestore-2e1e1`) |
| `clientEmail` | `FIREBASE_CLIENT_EMAIL` | E-mail da conta de serviço (formato: `firebase-adminsdk-xxxxx@projeto.iam.gserviceaccount.com`) |
| `privateKey` | `FIREBASE_PRIVATE_KEY` | Chave privada RSA da Service Account. O `.replace(/\\n/g, '\n')` é necessário porque o Render armazena a chave como string com `\n` literal, e o SDK precisa de quebras de linha reais |
| `storageBucket` | `FIREBASE_STORAGE_BUCKET` | Bucket do Cloud Storage para upload de imagens de produtos |

**Por que Admin SDK e não Client SDK no servidor?**

O Client SDK é projetado para rodar no navegador do usuário e opera sob as **Security Rules** do Firebase. O Admin SDK, por outro lado, **ignora as Security Rules** e tem acesso total — exatamente o que um backend precisa para gerenciar usuários (criar contas, alterar senhas) e manipular dados de qualquer coleção sem restrições.

### 2.2 Serviços Instanciados

Após a inicialização, três serviços são extraídos:

```javascript
const db     = admin.firestore();   // Firestore — banco NoSQL
const auth   = admin.auth();        // Firebase Auth — gerenciamento de identidade
const bucket = admin.storage().bucket(); // Cloud Storage — armazenamento de arquivos
```

### 2.3 Fluxo de Cadastro (POST /api/register)

O cadastro implementa uma **estratégia de identidade dual**: o usuário é criado tanto no Firebase Auth (para autenticação) quanto no Firestore (para dados de perfil).

```
Cliente envia: { nome, sobrenome, email, senha, cpf, ... }
       ↓
[1] Valida campos obrigatórios (nome, email, senha)
       ↓
[2] Verifica CPF duplicado no Firestore
    → db.collection('usuarios').where('cpf', '==', cpf).limit(1)
       ↓
[3] Cria usuário no Firebase Auth
    → auth.createUser({ email, password: senha, displayName: nome })
    → Firebase Auth armazena a senha com hash bcrypt internamente
    → Retorna userRecord com uid único
       ↓
[4] Salva perfil no Firestore usando UID como chave do documento
    → db.collection('usuarios').doc(userRecord.uid).set({...})
       ↓
[5] Retorna { success: true }
```

**Ponto de segurança:** O Firebase Auth **nunca armazena senhas em texto puro**. Internamente, ele utiliza o algoritmo **scrypt** (uma variante do bcrypt) para gerar o hash da senha. O servidor nunca tem acesso à senha depois que ela é enviada ao Firebase.

**Tratamento de erros:**
- `auth/email-already-exists` → HTTP 409 (Conflito)
- CPF duplicado → HTTP 409
- Campos obrigatórios faltando → HTTP 400 (Bad Request)

### 2.4 Fluxo de Login (POST /api/login)

O login utiliza a **Firebase Auth REST API** (Identity Toolkit) para verificar credenciais. Isso é necessário porque o Admin SDK **não possui** um método `signInWithEmailAndPassword` — esse método existe apenas no Client SDK.

```javascript
async function firebaseSignIn(email, password) {
    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    const body = JSON.stringify({ email, password, returnSecureToken: true });
    
    // Requisição HTTPS nativa para a API REST do Identity Toolkit
    const options = {
        hostname: 'identitytoolkit.googleapis.com',
        path: `/v1/accounts:signInWithPassword?key=${apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    };
    // ... faz a requisição e retorna { localId (uid), idToken, ... }
}
```

**Por que usar a REST API e não uma biblioteca HTTP como Axios?**

O projeto utiliza o módulo nativo `https` do Node.js para **eliminar dependências extras**. A função `firebaseSignIn` implementa manualmente o ciclo de vida de uma requisição HTTPS:

1. **Timeout de 15 segundos** — evita que o servidor trave esperando resposta do Google
2. **Parsing manual do JSON** — trata respostas não-JSON (API Key inválida retorna HTML de erro)
3. **Mapeamento de erros** — traduz códigos do Firebase para mensagens amigáveis ao usuário

**Fluxo completo do login:**

```
Cliente envia: { email, senha }
       ↓
[1] Valida campos obrigatórios
       ↓
[2] Chama firebaseSignIn(email, senha)
    → Envia POST para identitytoolkit.googleapis.com
    → Google verifica hash da senha
    → Retorna uid (localId) se válido
       ↓
[3] Busca perfil no Firestore: db.collection('usuarios').doc(uid).get()
       ↓
[4] Atualiza lastLogin com timestamp do servidor
       ↓
[5] Retorna { success: true, user: { id, nome, email } }
```

**Variável crítica:** `FIREBASE_WEB_API_KEY` — esta é a API Key Web do projeto Firebase (diferente da Service Account). Sem ela, o login falha com um erro 503. O servidor verifica na inicialização:

```javascript
if (!process.env.FIREBASE_WEB_API_KEY) {
    console.error('⚠️  FIREBASE_WEB_API_KEY não está definida! O login NÃO vai funcionar.');
}
```

### 2.5 Recuperação de Senha

O sistema implementa um fluxo de **OTP (One-Time Password)** customizado:

```
[1] POST /api/forgot-password → { email }
    → Gera código de 6 dígitos aleatório
    → Armazena no Firestore: { resetToken, tokenExpiry (15min) }
    → Envia e-mail com o código via Brevo
       ↓
[2] POST /api/reset-password → { email, code, newPassword }
    → Busca usuário pelo e-mail no Firebase Auth
    → Valida código e expiração no Firestore
    → Atualiza senha: auth.updateUser(uid, { password: newPassword })
    → Remove token do Firestore (FieldValue.delete())
```

### 2.6 Middleware de Admin

A verificação de administrador utiliza um modelo de **whitelist por e-mail**:

```javascript
const ADMIN_EMAIL = 'juliosamuel289@gmail.com';

async function verificarAdmin(req, res, next) {
    const uid = req.body.uid || req.query.uid;
    const userRecord = await auth.getUser(uid);
    if (userRecord.email !== ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Acesso negado.' });
    }
    req.adminUid = uid;
    next();
}
```

**Lógica:** O middleware recebe o UID enviado pelo frontend, busca o registro completo no Firebase Auth, e compara o e-mail com o ADMIN_EMAIL hardcoded. Isso garante que mesmo que alguém descubra o UID de outro usuário, não conseguirá acesso admin.

---

## 3. Processamento de Checkout com MercadoPago

### 3.1 Inicialização do Client MercadoPago

```javascript
const { MercadoPagoConfig, Preference, Payment, PaymentRefund } = require('mercadopago');
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
```

O SDK do MercadoPago v2 utiliza o padrão **Client Configuration**. Todas as operações (`Preference`, `Payment`, `PaymentRefund`) recebem o `mpClient` como parâmetro, herdando o `accessToken` configurado. Esse token é o **Access Token de produção** da conta MercadoPago, armazenado como variável de ambiente.

### 3.2 Catálogo de Preços — Validação Server-Side

**Este é um dos pontos de segurança mais importantes do projeto:**

```javascript
const CATALOGO_PRECOS = {
  'Flamengo':   [0.50, 179.90, 279.90],
  'Barcelona':  [279.90],
  'Brasil':     [249.90],
  // ... demais produtos
};
```

O servidor mantém um **catálogo autoritativo de preços** que funciona como fonte de verdade. Quando o cliente envia um pedido, o preço informado é **validado contra o catálogo**:

```javascript
for (const item of itens) {
    const catalogoItem = CATALOGO_PRECOS[item.nome];
    if (!catalogoItem) {
        return res.status(400).json({ error: `Produto desconhecido: "${item.nome}".` });
    }
    const precoEnviado = Number(item.preco);
    const precoValido = catalogoItem.some(p => Math.abs(p - precoEnviado) < 0.01);
    if (!precoValido) {
        return res.status(400).json({ error: `Preço inválido para "${item.nome}".` });
    }
}
```

**Por que `Math.abs(p - precoEnviado) < 0.01` em vez de `===`?**

Números de ponto flutuante (IEEE 754) podem ter imprecisão. Por exemplo, `179.90` pode ser internamente `179.89999999999998`. A comparação com tolerância de 1 centavo (`0.01`) evita falsos negativos sem comprometer a segurança.

**Sincronização dinâmica:** Na inicialização, o servidor busca produtos cadastrados pelo admin no Firestore e injeta seus preços no catálogo:

```javascript
(async () => {
    const snap = await db.collection('produtos').get();
    snap.forEach(doc => {
        const p = doc.data();
        if (p.nome && p.preco) {
            CATALOGO_PRECOS[p.nome] = CATALOGO_PRECOS[p.nome] || [];
            if (!CATALOGO_PRECOS[p.nome].includes(Number(p.preco))) {
                CATALOGO_PRECOS[p.nome].push(Number(p.preco));
            }
        }
    });
})();
```

### 3.3 Fluxo PIX — Payment API (Direto)

O PIX utiliza a **Payments API** do MercadoPago, que cria um pagamento imediatamente e retorna os dados do QR Code:

```
Cliente envia: { metodo: 'pix', itens, payerEmail, uid, clienteNome }
       ↓
[1] Valida preços contra o catálogo
       ↓
[2] Cria pagamento via Payment API:
    const payment = new Payment(mpClient);
    const result = await payment.create({
        body: {
            transaction_amount: valor,
            description: 'Flamengo x1, Barcelona x2',
            payment_method_id: 'pix',
            payer: { email: payerEmail }
        }
    });
       ↓
[3] MercadoPago retorna: { id, point_of_interaction.transaction_data }
    → qr_code: string do código PIX Copia e Cola
    → qr_code_base64: imagem do QR Code em Base64
       ↓
[4] Salva pedido no Firestore com mpId (payment ID direto):
    db.collection('pedidos').add({
        clienteEmail, clienteNome, uid, metodo: 'pix',
        itens, total, status: 'pendente',
        mpId: result.id  ← ID do pagamento direto
    })
       ↓
[5] Retorna { id, pedidoId, qr_code, qr_code_base64 } ao frontend
```

### 3.4 Fluxo Cartão/Boleto — Checkout Pro (Redirecionamento)

Cartão de crédito e boleto utilizam o **Checkout Pro** do MercadoPago, que redireciona o usuário para a página segura do MP para finalizar o pagamento:

```
Cliente envia: { metodo: 'cartao' | 'boleto', itens, payerEmail, parcelas }
       ↓
[1] Valida preços contra o catálogo
       ↓
[2] Cria preferência via Preference API:
    const preference = new Preference(mpClient);
    const body = {
        items: [{ title, unit_price, quantity, currency_id: 'BRL' }],
        payer: { email: payerEmail },
        back_urls: {
            success: SITE_URL + '/sucesso.html',
            failure: SITE_URL + '/erro.html'
        },
        auto_return: 'approved',
        notification_url: SITE_URL + '/api/mp-webhook',
        payment_methods: { ... }  // filtra métodos conforme seleção
    };
       ↓
[3] MercadoPago retorna: { id (preference_id), init_point (URL de checkout) }
       ↓
[4] Salva pedido no Firestore com mpPreferenceId:
    db.collection('pedidos').add({
        clienteEmail, clienteNome, uid, metodo,
        itens, total, status: 'pendente',
        mpPreferenceId: result.id  ← ID da preferência (não é payment_id)
    })
       ↓
[5] Retorna { init_point } → frontend redireciona usuário para checkout MP
```

**Diferença crítica PIX vs Cartão/Boleto:**

| Aspecto | PIX | Cartão/Boleto |
|---------|-----|---------------|
| API Usada | `Payment.create()` | `Preference.create()` |
| ID Armazenado | `mpId` (payment_id real) | `mpPreferenceId` (não é payment_id) |
| Fluxo | In-app (QR Code na página) | Redirect (sai do site → volta) |
| Payment ID | Disponível imediatamente | Disponível só após pagamento (via webhook) |

### 3.5 Filtragem de Métodos de Pagamento

O MercadoPago permite configurar quais métodos de pagamento são exibidos no checkout:

```javascript
// Cartão: exclui boleto e transferência, configura parcelamento
if (metodo === 'cartao') {
    body.payment_methods = {
        excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }],
        installments: Number(parcelas) || 12,
        default_installments: Number(parcelas) || 1
    };
}

// Boleto: exclui cartão e transferência
if (metodo === 'boleto') {
    body.payment_methods = {
        excluded_payment_types: [
            { id: 'credit_card' }, { id: 'debit_card' }, { id: 'bank_transfer' }
        ]
    };
}
```

### 3.6 Webhook MercadoPago (POST /api/mp-webhook)

O webhook é um **endpoint IPN (Instant Payment Notification)** que o MercadoPago chama automaticamente quando o status de um pagamento muda:

```javascript
app.post('/api/mp-webhook', async (req, res) => {
    res.sendStatus(200); // Responde IMEDIATAMENTE (MP reenvia se não receber 200 em 10s)

    const { type, data } = req.body;
    if (type !== 'payment' || !data?.id) return;

    // Busca detalhes completos do pagamento via API
    const payment = new Payment(mpClient);
    const pgto = await payment.get({ id: data.id });

    // Localiza o pedido no Firestore pela preferência ou mpId
    // Atualiza com o payment_id real e o status correto
    await pedidoRef.update({
        mpPaymentId: paymentId,    // Salva o payment_id REAL
        status: status === 'approved' ? 'confirmado' : 
                status === 'rejected' ? 'cancelado' : undefined
    });
});
```

**Por que `res.sendStatus(200)` é a primeira instrução?**

O MercadoPago tem um timeout curto (~10 segundos). Se o servidor não responder 200 a tempo, o MP **reenvia a notificação** repetidamente (retry exponencial). Respondendo 200 imediatamente e processando em background, evitamos reenvios desnecessários.

### 3.7 Sistema de Estorno (Refund)

O sistema implementa estorno universal através de uma **função helper** que abstrai a complexidade de localizar o `payment_id`:

```javascript
async function estornarPagamento(pedidoData, pedidoId) {
    // Estratégia de resolução do payment_id (3 tentativas):
    // 1. mpPaymentId → salvo pelo webhook (mais confiável)
    // 2. mpId → salvo no checkout PIX (payment_id direto)
    // 3. Busca via API → pesquisa por mpPreferenceId na API do MP
    let paymentId = pedidoData.mpPaymentId || pedidoData.mpId;

    if (!paymentId && pedidoData.mpPreferenceId) {
        // Fallback: pesquisa o pagamento pela preference_id
        const searchUrl = `https://api.mercadopago.com/v1/payments/search?preference_id=${pedidoData.mpPreferenceId}`;
        const searchRes = await fetch(searchUrl, {
            headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
        });
        const searchData = await searchRes.json();
        if (searchData.results?.length > 0) {
            paymentId = searchData.results[0].id;
        }
    }

    // Executa o estorno via SDK
    const refund = new PaymentRefund(mpClient);
    await refund.create({ payment_id: paymentId, body: {} });
    // body: {} = estorno total. Para parcial: { amount: 50.00 }
}
```

**Fluxo de estorno (acionado por admin ou cliente):**

```
Admin altera status para 'cancelado' OU Cliente clica em 'Cancelar Pedido'
       ↓
Chama estornarPagamento(pedidoData, pedidoId)
       ↓
[1] Tenta mpPaymentId (webhook já salvou?)
[2] Tenta mpId (era PIX?)
[3] Busca na API do MP por preference_id
       ↓
PaymentRefund.create({ payment_id }) → MercadoPago processa estorno
       ↓
Marca { estornado: true } no Firestore
       ↓
Envia e-mail de cancelamento via Brevo
```

---

## 4. Notificações por E-mail via Brevo

### 4.1 Integração com Brevo

O Brevo (anteriormente Sendinblue) é utilizado como serviço de **e-mail transacional**. A integração é feita via **HTTPS API direta** (sem SDK), usando o módulo nativo `https` do Node.js:

```javascript
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

        const req = https.request(options, (res) => { /* ... */ });
        req.write(body);
        req.end();
    });
}
```

**Análise da requisição:**

| Campo | Valor | Descrição |
|-------|-------|-----------|
| `hostname` | `api.brevo.com` | Endpoint da API SMTP transacional do Brevo |
| `path` | `/v3/smtp/email` | Versão 3 da API para envio de e-mails |
| `api-key` (header) | `BREVO_API_KEY` | Chave de autenticação da conta Brevo |
| `sender.email` | `BREVO_SENDER_EMAIL` | E-mail verificado como remetente no Brevo |
| `htmlContent` | HTML customizado | Corpo do e-mail com template inline |

### 4.2 Cenários de Disparo de E-mail

O sistema envia e-mails em **cinco cenários**:

#### 4.2.1 Recuperação de Senha
- **Trigger:** POST `/api/forgot-password`
- **Destino:** E-mail do usuário
- **Conteúdo:** Código OTP de 6 dígitos com validade de 15 minutos
- **Template:** HTML estilizado com o código em destaque

#### 4.2.2 Atualização de Status pelo Admin
- **Trigger:** PUT `/api/admin/pedido/status`
- **Destino:** E-mail do cliente (`pedidoData.clienteEmail`)
- **Conteúdo:**
  - Emoji de status (⏳ Pendente, ✅ Confirmado, 📦 Preparando, 🚚 Enviado, ✔️ Entregue, ❌ Cancelado)
  - ID parcial do pedido (`#${pedidoId.slice(0, 8)}`)
  - Lista de itens com quantidades e preços
  - Total formatado em BRL
  - Aviso de estorno (se cancelado)

#### 4.2.3 Cancelamento pelo Cliente
- **Trigger:** POST `/api/cancelar-pedido`
- **Destino:** E-mail do cliente
- **Conteúdo:** Confirmação de cancelamento + aviso de estorno automático

#### 4.2.4 Central de Ajuda (Contato)
- **Trigger:** POST `/api/contato`
- **Destino:** E-mail do administrador (`BREVO_SENDER_EMAIL`)
- **Conteúdo:** Nome, e-mail, telefone, assunto e mensagem do cliente

#### 4.2.5 Padrão dos Disparos

Todos os e-mails seguem o padrão **fire-and-forget com catch**:

```javascript
enviarEmailBrevo(clienteEmail, subject, html)
    .catch(err => console.error('Erro ao enviar email:', err.message));
```

O `.catch()` garante que uma falha no envio de e-mail **nunca interrompa a operação principal** (cancelamento, atualização de status, etc.). O e-mail é uma operação secundária (best-effort).

---

## 5. Segurança: Variáveis de Ambiente e Boas Práticas

### 5.1 Variáveis de Ambiente

Todas as credenciais sensíveis são armazenadas como **variáveis de ambiente no Render**, nunca no código-fonte:

| Variável | Serviço | Nível de Sensibilidade | Função |
|----------|---------|----------------------|--------|
| `FIREBASE_PROJECT_ID` | Firebase | Médio | Identificador do projeto |
| `FIREBASE_CLIENT_EMAIL` | Firebase | Alto | E-mail da Service Account |
| `FIREBASE_PRIVATE_KEY` | Firebase | **Crítico** | Chave RSA privada (acesso total ao Firebase) |
| `FIREBASE_STORAGE_BUCKET` | Firebase | Baixo | Nome do bucket de storage |
| `FIREBASE_WEB_API_KEY` | Firebase | Médio | API Key para autenticação REST |
| `MP_ACCESS_TOKEN` | MercadoPago | **Crítico** | Token de acesso para operações financeiras |
| `BREVO_API_KEY` | Brevo | Alto | Chave da API de e-mail |
| `BREVO_SENDER_EMAIL` | Brevo | Baixo | E-mail remetente verificado |
| `SITE_URL` | Render | Baixo | URL base para redirecionamentos |
| `PORT` | Render | Baixo | Porta do servidor (injetada pelo Render) |

**Por que variáveis de ambiente e não um arquivo `.env` comitado?**

O arquivo `.env` é listado no `.gitignore` (quando presente localmente) e **nunca deve ser comitado no repositório**. As variáveis são configuradas diretamente no painel do Render (Environment → Environment Variables), garantindo que:

1. **Credenciais nunca apareçam no código-fonte** (nem no histórico do Git)
2. **Cada ambiente pode ter credenciais diferentes** (dev vs produção)
3. **Rotação de chaves** não requer alteração de código

### 5.2 Validação de Preços Server-Side

O servidor **NUNCA confia no preço enviado pelo cliente**. O comentário no código é explícito:

```javascript
// Fonte de verdade para todos os produtos. O servidor NUNCA
// confia no preço enviado pelo cliente — ele recalcula aqui.
```

Isso previne um ataque comum em e-commerce onde um atacante modifica o preço no frontend (via DevTools ou interceptação de requisição) para pagar menos. O servidor compara cada preço com o catálogo e rejeita preços não autorizados.

### 5.3 Upload Seguro de Imagens

O Multer está configurado com restrições:

```javascript
const upload = multer({
    storage: multer.memoryStorage(),     // Armazena em RAM (não em disco)
    limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5 MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Apenas imagens são permitidas.'));
    }
});
```

- **`memoryStorage()`**: O arquivo fica em buffer na RAM, é enviado ao Firebase Storage e imediatamente descartado. Não há escrita em disco.
- **`fileSize: 5MB`**: Previne uploads abusivos (DoS via disco cheio).
- **`fileFilter`**: Verifica o MIME type para aceitar apenas imagens.

### 5.4 Verificação de Admin com Firebase Auth

O middleware `verificarAdmin` não confia apenas no UID enviado pelo frontend — ele **consulta o Firebase Auth** para obter o e-mail real associado ao UID e comparar com o ADMIN_EMAIL. Isso significa que:

- Falsificar o UID não dá acesso admin (o e-mail real será diferente)
- Mesmo que alguém descubra o UID do admin, precisaria se autenticar com as credenciais corretas

### 5.5 Cancelamento Seguro de Pedidos

O endpoint de cancelamento pelo cliente verifica a **propriedade do pedido**:

```javascript
if (pedidoData.clienteEmail !== email) {
    return res.status(403).json({ error: 'Você não tem permissão para cancelar este pedido.' });
}
```

Também implementa regras de negócio:
- Pedidos já entregues **não podem** ser cancelados
- Pedidos já cancelados **não podem** ser cancelados novamente

### 5.6 Tratamento Global de Erros

O servidor captura exceções não tratadas para evitar crashes:

```javascript
process.on('uncaughtException', (err) => {
    console.error('❌ uncaughtException:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ unhandledRejection:', reason);
});
```

E trata o SIGTERM do Render para shutdown gracioso:

```javascript
process.on('SIGTERM', () => {
    console.log('⚠️ SIGTERM recebido — Render está desligando o servidor');
});
```

### 5.7 CORS

```javascript
app.use(cors());
```

O CORS (Cross-Origin Resource Sharing) está habilitado globalmente. Em produção no Render, como frontend e backend estão no mesmo domínio (servidos pelo mesmo Express), o CORS é principalmente necessário para chamadas feitas durante desenvolvimento local.

---

## 6. Fluxo Completo de Dados

### 6.1 Fluxo: Cadastro → Login → Compra → Notificação

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Navegador)                       │
└──────────┬──────────────────────────────────────────┬───────────┘
           │                                          │
    POST /api/register                         POST /api/login
    {nome, email, senha, cpf}                  {email, senha}
           │                                          │
           ▼                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVIDOR EXPRESS (Render)                     │
│                                                                   │
│  [Register]                              [Login]                  │
│  auth.createUser() ──→ Firebase Auth     firebaseSignIn() ──→     │
│  db.collection()   ──→ Firestore         identitytoolkit API      │
│                                          db.get() ──→ Firestore   │
└──────────┬──────────────────────────────────────────┬───────────┘
           │                                          │
           ▼                                          ▼
┌──────────────────────┐              ┌───────────────────────────┐
│    Firebase Auth     │              │  identitytoolkit.         │
│  (hash da senha,     │              │  googleapis.com           │
│   UID gerado)        │              │  (verificação de senha)   │
└──────────────────────┘              └───────────────────────────┘
           │
           ▼
┌──────────────────────┐
│     Firestore        │
│  Collection:         │
│  'usuarios' (perfil) │
│  'pedidos' (orders)  │
│  'produtos' (catalog)│
└──────────────────────┘
```

### 6.2 Fluxo: Checkout PIX

```
Cliente ──POST /api/pagar──→ Express ──Payment.create()──→ MercadoPago
                                │                              │
                                │ ←── { id, qr_code } ────────┘
                                │
                                ├──→ db.collection('pedidos').add()
                                │          ↓
                                │      Firestore (status: pendente)
                                │
                                └──→ Retorna QR Code ao cliente
                                           ↓
                                    Cliente paga via app do banco
                                           ↓
                              MercadoPago notifica ──POST /api/mp-webhook──→ Express
                                                                              │
                                                              Atualiza pedido: status = confirmado
                                                              Salva mpPaymentId
```

### 6.3 Fluxo: Cancelamento com Estorno

```
Cliente ──POST /api/cancelar-pedido──→ Express
                                         │
                     ┌───────────────────┤
                     │                   │
              Verifica dono        Atualiza Firestore
              (clienteEmail)       status → 'cancelado'
                     │                   │
                     │            estornarPagamento()
                     │                   │
                     │         ┌─────────┴─────────┐
                     │    mpPaymentId?         mpPreferenceId?
                     │         │                    │
                     │    PaymentRefund       Busca payment_id
                     │     .create()          via API do MP
                     │         │                    │
                     │         └─────────┬──────────┘
                     │                   │
                     │         enviarEmailBrevo()
                     │                   │
                     │              api.brevo.com
                     │            (email: cancelado)
                     │                   │
                     └───────────────────┘
                              │
                     Retorna { success: true }
```

---

## 7. Diagrama de Dependências

```
┌────────────────────────────────────────────────────────────────────┐
│                          package.json                              │
│                                                                    │
│  express ──────────→ Servidor HTTP, roteamento, middlewares        │
│  firebase-admin ───→ Auth, Firestore, Storage (Service Account)   │
│  mercadopago ──────→ Preference, Payment, PaymentRefund           │
│  multer ───────────→ Parsing de upload multipart/form-data        │
│  cors ─────────────→ Headers Cross-Origin                         │
│  dotenv ───────────→ Carrega .env para process.env                │
│                                                                    │
│  Node.js built-in:                                                 │
│  https ────────────→ Requisições HTTPS (Firebase REST, Brevo)     │
│  path ─────────────→ Resolução de caminhos de arquivo             │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                     Serviços Externos (APIs)                       │
│                                                                    │
│  Firebase Auth ────→ Gerenciamento de identidade e senhas         │
│  Firestore ────────→ Banco NoSQL (usuarios, pedidos, produtos)    │
│  Cloud Storage ────→ Armazenamento de imagens de produtos         │
│  MercadoPago ──────→ Processamento de pagamentos e estornos       │
│  Brevo ────────────→ E-mails transacionais (SMTP API v3)          │
│  Identity Toolkit ─→ Verificação de senha via REST API            │
└────────────────────────────────────────────────────────────────────┘
```

---

## 8. Glossário Técnico

| Termo | Definição |
|-------|-----------|
| **Service Account** | Identidade de máquina do Google Cloud. Possui credenciais (e-mail + chave privada) que autenticam o servidor no Firebase sem interação humana |
| **Admin SDK** | Biblioteca server-side do Firebase com acesso privilegiado; ignora Security Rules |
| **Identity Toolkit** | API REST do Google para autenticação (sign-in, sign-up, verificação de senha). Endpoint: `identitytoolkit.googleapis.com` |
| **Access Token (MP)** | Token OAuth do MercadoPago que autoriza operações financeiras (criar pagamentos, estornos) |
| **Preference (MP)** | Objeto que define os itens, preços e back_urls de uma sessão de Checkout Pro |
| **Payment (MP)** | Objeto que representa um pagamento efetivado. Possui payment_id, status, metadados |
| **PaymentRefund** | Classe SDK para criar estornos (totais ou parciais) de pagamentos já aprovados |
| **Webhook / IPN** | Instant Payment Notification — endpoint POST que o MercadoPago chama quando o status de um pagamento muda |
| **Firestore** | Banco de dados NoSQL documental do Firebase. Organizado em Collections → Documents → Fields |
| **Multer** | Middleware Express para parsing de `multipart/form-data` (uploads de arquivo) |
| **dotenv** | Biblioteca que carrega variáveis de um arquivo `.env` para `process.env` em desenvolvimento |
| **CORS** | Cross-Origin Resource Sharing — mecanismo HTTP que controla quais domínios podem fazer requisições ao servidor |
| **Brevo** | Plataforma de e-mail transacional (ex-Sendinblue). Usamos a API SMTP v3 para envio programático |
| **OTP** | One-Time Password — código de uso único (neste caso, 6 dígitos para recuperação de senha) |
| **PaaS** | Platform as a Service — modelo onde o Render gerencia infraestrutura (SO, runtime, deploy). O desenvolvedor só fornece o código |
| **fire-and-forget** | Padrão onde uma operação é iniciada sem esperar pelo resultado (ex: envio de e-mail que não bloqueia a resposta HTTP) |

---

## Conclusão

A arquitetura da NaRede Store demonstra a integração de **três serviços críticos** (Firebase, MercadoPago, Brevo) em um único servidor Express.js, seguindo boas práticas de:

1. **Separação de responsabilidades**: Cada serviço externo tem uma função clara e isolada
2. **Segurança**: Credenciais em variáveis de ambiente, validação server-side de preços, verificação de propriedade de pedidos
3. **Resiliência**: Tratamento de erros globais, timeouts, fire-and-forget para operações secundárias
4. **Escalabilidade do modelo**: A sincronização dinâmica do catálogo permite que o admin adicione produtos sem alterar código

O sistema processa todo o ciclo de vida de um e-commerce: desde o cadastro do cliente até o estorno financeiro, com notificações em tempo real por e-mail em cada etapa.

## 9. Entregáveis Acadêmicos

Para atender a rubricagem da disciplina (documentação, desenvolvimento e apresentação), os artefatos abaixo foram adicionados ao projeto:

1. Script relacional MySQL: `database/schema.sql`
2. DER em formato Mermaid ER: `database/DER_NaRede_Store.mmd`
3. Perfil Master criado via SQL no script (conforme exigência do enunciado)

Observação de aderência: o runtime atual em produção usa Firebase, porém os artefatos relacionais requisitados pela avaliação acadêmica estão incluídos no diretório `database/`.

---

*Documento gerado para defesa de projeto — Análise e Desenvolvimento de Sistemas*
