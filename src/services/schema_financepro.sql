-- ==========================================================
-- FINANCE PRO - MODELO DE DADOS POSTGRESQL (DDL)
-- Motor de Gestão Financeira Pessoal e PME
-- ==========================================================

-- Extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE CONTAS BANCÁRIAS E CARTEIRAS
CREATE TABLE IF NOT EXISTS contas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    instituicao VARCHAR(100) NOT NULL,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('corrente', 'poupanca', 'investimento', 'carteira_digital', 'dinheiro')),
    saldo_inicial NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    saldo_atual NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    cor VARCHAR(20) DEFAULT '#10b981',
    icone VARCHAR(50) DEFAULT 'wallet',
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    criada_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizada_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA DE CARTÕES DE CRÉDITO
CREATE TABLE IF NOT EXISTS cartoes_credito (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    bandeira VARCHAR(30) NOT NULL CHECK (bandeira IN ('visa', 'mastercard', 'elo', 'amex', 'hipercard', 'outro')),
    limite_total NUMERIC(15, 2) NOT NULL,
    limite_disponivel NUMERIC(15, 2) NOT NULL,
    dia_fechamento INT NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
    dia_vencimento INT NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    conta_debito_padrao_id UUID REFERENCES contas(id) ON DELETE SET NULL,
    cor VARCHAR(20) DEFAULT '#6366f1',
    ultimos_digitos VARCHAR(4),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA DE FATURAS DE CARTÃO
CREATE TABLE IF NOT EXISTS faturas_cartao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cartao_id UUID NOT NULL REFERENCES cartoes_credito(id) ON DELETE CASCADE,
    mes_referencia INT NOT NULL CHECK (mes_referencia BETWEEN 1 AND 12),
    ano_referencia INT NOT NULL,
    data_fechamento DATE NOT NULL,
    data_vencimento DATE NOT NULL,
    valor_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada', 'paga', 'atrasada')),
    criada_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    paga_em TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uk_cartao_mes_ano UNIQUE (cartao_id, mes_referencia, ano_referencia)
);

-- 4. TABELA DE CATEGORIAS
CREATE TABLE IF NOT EXISTS categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
    cor VARCHAR(20) NOT NULL DEFAULT '#64748b',
    icone VARCHAR(50) NOT NULL DEFAULT 'tag',
    orcamento_mensal NUMERIC(15, 2) DEFAULT NULL,
    descricao TEXT,
    criada_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABELA PRINCIPAL DE LANÇAMENTOS
CREATE TABLE IF NOT EXISTS lancamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'despesa', 'transferencia')),
    descricao VARCHAR(255) NOT NULL,
    valor NUMERIC(15, 2) NOT NULL CHECK (valor > 0),
    categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    conta_id UUID REFERENCES contas(id) ON DELETE CASCADE,
    cartao_id UUID REFERENCES cartoes_credito(id) ON DELETE SET NULL,
    fatura_id UUID REFERENCES faturas_cartao(id) ON DELETE SET NULL,
    conta_destino_id UUID REFERENCES contas(id) ON DELETE SET NULL,
    data_competencia DATE NOT NULL,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
    observacoes TEXT,
    tags TEXT[],
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABELA DE PARCELAS (Vínculo de compras parceladas)
CREATE TABLE IF NOT EXISTS lancamentos_parcelas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lancamento_id UUID NOT NULL REFERENCES lancamentos(id) ON DELETE CASCADE,
    lancamento_pai_id VARCHAR(100) NOT NULL,
    numero_parcela INT NOT NULL,
    total_parcelas INT NOT NULL,
    CONSTRAINT uk_parcela UNIQUE (lancamento_pai_id, numero_parcela)
);

-- 7. TABELA DE RECORRÊNCIAS
CREATE TABLE IF NOT EXISTS lancamentos_recorrencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lancamento_id UUID NOT NULL REFERENCES lancamentos(id) ON DELETE CASCADE,
    frequencia VARCHAR(20) NOT NULL CHECK (frequencia IN ('semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
    dia_vencimento INT NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    ajusta_fim_mes BOOLEAN NOT NULL DEFAULT TRUE,
    total_ocorrencias INT,
    ocorrencia_atual INT DEFAULT 1,
    data_fim DATE
);

-- 8. TABELA DE HISTÓRICO / AUDITORIA DE ALTERAÇÕES
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entidade VARCHAR(50) NOT NULL,
    entidade_id VARCHAR(100) NOT NULL,
    acao VARCHAR(30) NOT NULL,
    detalhes JSONB,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_lancamentos_conta ON lancamentos(conta_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_cartao ON lancamentos(cartao_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_fatura ON lancamentos(fatura_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_vencimento ON lancamentos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_lancamentos_status ON lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_lancamentos_categoria ON lancamentos(categoria_id);
