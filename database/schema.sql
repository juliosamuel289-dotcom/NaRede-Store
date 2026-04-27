-- NaRede Store - Script relacional (MySQL 8+)
-- Atende requisito de SGBD relacional + criacao do perfil Master via SQL.

CREATE DATABASE IF NOT EXISTS naredestore
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE naredestore;

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uid VARCHAR(128) NULL,
  nome VARCHAR(80) NOT NULL,
  sobrenome VARCHAR(80) NOT NULL,
  nome_mae VARCHAR(120) NOT NULL,
  genero VARCHAR(20) NOT NULL,
  celular VARCHAR(20) NOT NULL,
  cpf CHAR(11) NOT NULL,
  cep CHAR(8) NOT NULL,
  rua VARCHAR(120) NOT NULL,
  bairro VARCHAR(80) NOT NULL,
  cidade VARCHAR(80) NOT NULL,
  estado CHAR(2) NOT NULL,
  email VARCHAR(160) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  role ENUM('master','comum') NOT NULL DEFAULT 'comum',
  twofa_lock_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email),
  UNIQUE KEY uq_usuarios_cpf (cpf),
  KEY idx_usuarios_nome (nome, sobrenome),
  KEY idx_usuarios_role (role)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS logs_autenticacao (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NULL,
  email VARCHAR(160) NOT NULL,
  tipo_desafio VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL,
  detalhe VARCHAR(255) NULL,
  ip VARCHAR(80) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_logs_created_at (created_at),
  KEY idx_logs_email (email),
  CONSTRAINT fk_logs_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS produtos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(120) NOT NULL,
  descricao VARCHAR(255) NULL,
  pagina VARCHAR(120) NOT NULL,
  imagem VARCHAR(255) NULL,
  preco DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_produtos_nome (nome),
  KEY idx_produtos_pagina (pagina)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pedidos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NULL,
  cliente_email VARCHAR(160) NOT NULL,
  cliente_nome VARCHAR(120) NULL,
  metodo ENUM('pix','cartao','boleto') NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status ENUM('pendente','confirmado','preparando','enviado','entregue','cancelado') NOT NULL DEFAULT 'pendente',
  mp_id VARCHAR(80) NULL,
  mp_preference_id VARCHAR(80) NULL,
  mp_payment_id VARCHAR(80) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pedidos_email (cliente_email),
  KEY idx_pedidos_status (status),
  CONSTRAINT fk_pedidos_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pedido_itens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  pedido_id BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(120) NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  quantidade INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_itens_pedido (pedido_id),
  CONSTRAINT fk_itens_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Perfil Master criado via script SQL (requisito do projeto)
-- Troque o hash abaixo por um hash real de bcrypt gerado no ambiente de producao.
INSERT INTO usuarios (
  nome, sobrenome, nome_mae, genero, celular, cpf, cep,
  rua, bairro, cidade, estado, email, senha_hash, role
)
VALUES (
  'Julio', 'Master', 'Nao Informado', 'Masculino', '(+55)21-999999999', '00000000191', '20000000',
  'Rua Principal', 'Centro', 'Rio de Janeiro', 'RJ',
  'juliosamuel289@gmail.com', '$2b$12$trocar_por_hash_real_gerado_com_bcrypt', 'master'
)
ON DUPLICATE KEY UPDATE
  role = 'master';
