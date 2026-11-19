-- =====================================================================
-- SALONFLOW v0.3 - BANCO DE DADOS MULTIEMPRESA (MULTI-TENANT)
-- =====================================================================

-- Extensão para geração de UUIDs (opcional, mas ótimo para segurança)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Empresas (Tenants)
CREATE TABLE IF NOT EXISTS empresas (
    id SERIAL PRIMARY KEY,
    nome_fantasia VARCHAR(150) NOT NULL,
    razao_social VARCHAR(150),
    cnpj VARCHAR(20) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Unidades / Filiais
CREATE TABLE IF NOT EXISTS unidades (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    endereco TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Usuários (com papéis e escopo de acesso)
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    unidade_id INTEGER REFERENCES unidades(id) ON DELETE SET NULL,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'funcionario', -- 'owner', 'admin', 'funcionario'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabela de Clientes (Isolada por empresa)
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nome VARCHAR(150) NOT NULL,
    telefone VARCHAR(30),
    email VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabela de Serviços (Isolada por empresa)
CREATE TABLE IF NOT EXISTS servicos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    preco NUMERIC(10, 2) NOT NULL,
    duracao_minutos INTEGER DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabela de Agendamentos (Isolada por empresa e vinculada à unidade)
CREATE TABLE IF NOT EXISTS agendamentos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    unidade_id INTEGER NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    servico_id INTEGER NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
    data_hora TIMESTAMP NOT NULL,
    status VARCHAR(30) DEFAULT 'agendado', -- 'agendado', 'concluido', 'cancelado'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Performance para garantir isolamento rápido por tenant
CREATE INDEX IF NOT EXISTS idx_unidades_empresa ON unidades(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_servicos_empresa ON servicos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_empresa ON agendamentos(empresa_id);
```[cite: 1]

---

### O que esse script garante pra gente?
* **Isolamento Absoluto:** Todas as tabelas principais agora possuem a chave estrangeira `empresa_id`. Nenhuma query conseguirá misturar dados de empresas diferentes se aplicarmos o filtro correto no backend.
* **Cascata Segura (`ON DELETE CASCADE`):** Se uma empresa for deletada por algum motivo administrativo crítico, todas as suas unidades, usuários, clientes e agendamentos vinculados são limpos automaticamente, evitando dados órfãos no banco.

Dá uma olhada se curtiu a estrutura do banco. Se estiver tudo certinho por aí, me dá o toque e a gente já emfila a **migração do `app.py`** para implementar o fluxo de registro com criação automática da matriz e do primeiro usuário como `owner`!