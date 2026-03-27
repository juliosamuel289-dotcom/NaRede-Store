const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Conexão com o Banco de Dados
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  }
});

db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao MySQL na Nuvem:', err);
    return;
  }
  console.log('Conectado ao MySQL do Aiven com sucesso!');

  const setupUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `;

  db.query(setupUsersTable, (setupErr) => {
    if (setupErr) {
      console.error('Erro ao criar tabela users:', setupErr.message);
    } else {
      console.log('Tabela users pronta');
    }
  });

  const setupUsuariosTable = `
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(100) NOT NULL,
      sobrenome VARCHAR(100) NULL,
      genero VARCHAR(50) NULL,
      celular VARCHAR(20) NULL,
      cpf VARCHAR(20) NULL,
      cep VARCHAR(20) NULL,
      rua VARCHAR(255) NULL,
      bairro VARCHAR(100) NULL,
      cidade VARCHAR(100) NULL,
      estado VARCHAR(100) NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      senha VARCHAR(255) NOT NULL,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `;

  db.query(setupUsuariosTable, (setupErr) => {
    if (setupErr) {
      console.error('Erro ao criar tabela usuarios:', setupErr.message);
    } else {
      console.log('Tabela usuarios pronta');
    }
  });
});

// Rotas de páginas HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/cadastro', (req, res) => {
  res.sendFile(path.join(__dirname, 'cadastro.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Rota para cadastrar um novo usuário
app.post('/api/register', (req, res) => {
  const { nome, sobrenome, genero, celular, cpf, cep, rua, bairro, cidade, estado, email, senha } = req.body;

  const query = `INSERT INTO usuarios 
    (nome, sobrenome, genero, celular, cpf, cep, rua, bairro, cidade, estado, email, senha) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.query(query, [nome, sobrenome, genero, celular, cpf, cep, rua, bairro, cidade, estado, email, senha], (err, result) => {
    if (err) {
      console.error('Erro no banco:', err);
      return res.status(500).json({ error: 'Erro ao salvar no banco' });
    }
    res.json({ message: 'Cadastro realizado com sucesso!' });
  });
});

// Login de usuário
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  const sql = 'SELECT id, name, email, password FROM users WHERE email = ?';
  db.query(sql, [email], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar usuário.' });
    }
    if (results.length === 0) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const user = results[0];
    if (user.password !== password) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    return res.json({ message: 'Login realizado com sucesso.', user: { id: user.id, name: user.name, email: user.email } });
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));