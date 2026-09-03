-- ============================================================================
-- ESQUEMA RELACIONAL POSTGRESQL: CONCILIAÇÃO FINANCEIRA & GESTÃO DE FLUXO DE CAIXA
-- Empresa: Barbearia Vangard Ltda
-- ============================================================================

-- 1. TABELA DE MOVIMENTAÇÕES DE PDV (Caixa Operacional Balcão)
CREATE TABLE IF NOT EXISTS pdv_movimentacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente VARCHAR(255) NOT NULL,
    telefone VARCHAR(50),
    forma_pgto VARCHAR(100) NOT NULL, -- 'Cartão de crédito', 'Cartão de débito', 'Pix', 'Dinheiro', 'Assinatura'
    valor NUMERIC(12, 2) NOT NULL,
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    data_dia DATE NOT NULL,
    is_assinatura_clube BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pdv_data_dia ON pdv_movimentacoes(data_dia);
CREATE INDEX IF NOT EXISTS idx_pdv_forma_pgto ON pdv_movimentacoes(forma_pgto);

-- 2. TABELA DE TRANSAÇÕES DO GATEWAY DO CLUBE (Cobranças Recorrentes)
CREATE TABLE IF NOT EXISTS gateway_clube_transacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(100) NOT NULL UNIQUE, -- Código da transação no clube
    nome_cliente VARCHAR(255) NOT NULL,
    plano VARCHAR(100) NOT NULL,         -- Ex: 'Vans Club Gold'
    vencimento DATE NOT NULL,
    valor NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,        -- 'PAGO', 'RECUSADO', 'PENDENTE', etc.
    data_status_atual TIMESTAMP WITH TIME ZONE,
    codigo_aprovacao VARCHAR(100),
    tid VARCHAR(150),
    descricao_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clube_tid ON gateway_clube_transacoes(tid);
CREATE INDEX IF NOT EXISTS idx_clube_codigo ON gateway_clube_transacoes(codigo);
CREATE INDEX IF NOT EXISTS idx_clube_status ON gateway_clube_transacoes(status);

-- 3. TABELA DE RECEBÍVEIS DA ADQUIRENTE REDE (Vendas Físicas de Cartão)
CREATE TABLE IF NOT EXISTS adquirente_rede_pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_recebimento DATE,
    data_venda DATE NOT NULL,
    valor_bruto NUMERIC(12, 2) NOT NULL,
    taxa_mdr_perc NUMERIC(6, 4) NOT NULL, -- Ex: 2.3900 para 2.39%
    valor_mdr_descontado NUMERIC(12, 2) NOT NULL,
    valor_liquido NUMERIC(12, 2) NOT NULL,
    tid VARCHAR(150),
    nsu_cv VARCHAR(100),
    num_autorizacao VARCHAR(100),
    modalidade VARCHAR(50) NOT NULL,     -- 'CRÉDITO', 'DÉBITO'
    bandeira VARCHAR(50) NOT NULL,       -- 'MASTERCARD', 'VISA', 'ELO'
    status VARCHAR(50) NOT NULL,        -- 'LIQUIDADO', 'AGENDADO', 'CANCELADO'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rede_data_venda ON adquirente_rede_pagamentos(data_venda);
CREATE INDEX IF NOT EXISTS idx_rede_tid ON adquirente_rede_pagamentos(tid);
CREATE INDEX IF NOT EXISTS idx_rede_autorizacao ON adquirente_rede_pagamentos(num_autorizacao);

-- 4. TABELA DE DEPÓSITOS BANCÁRIOS EFETIVOS (Aba "Recebidos" do Extrato Rede)
CREATE TABLE IF NOT EXISTS adquirente_rede_recebidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_deposito DATE NOT NULL,
    valor_total_lote NUMERIC(12, 2) NOT NULL,
    banco VARCHAR(100),
    agencia_conta VARCHAR(100),
    status VARCHAR(50) DEFAULT 'DEPOSITADO',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rede_recebidos_data ON adquirente_rede_recebidos(data_deposito);

-- 5. TABELA DE PREVISÃO DE RECEBÍVEIS FUTUROS (D+30 / D+31 Clube)
CREATE TABLE IF NOT EXISTS previsao_recebiveis_futuros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    a_receber VARCHAR(20) DEFAULT 'Sim',
    data_venda DATE NOT NULL,
    parcela VARCHAR(20) DEFAULT '1/1',
    transacao VARCHAR(100) NOT NULL,     -- Cruza com gateway_clube_transacoes.codigo
    tid VARCHAR(150),
    operacao VARCHAR(100),
    bandeira VARCHAR(50),
    valor_bruto NUMERIC(12, 2) NOT NULL,
    mdr_taxa_perc NUMERIC(6, 4),
    mdr_valor NUMERIC(12, 2) NOT NULL,
    antecipacao NUMERIC(12, 2) DEFAULT 0.00,
    valor_liquido NUMERIC(12, 2) NOT NULL,
    status_transacao VARCHAR(50) DEFAULT 'Previsto',
    d_mais_31 DATE NOT NULL,             -- Data projetada de liquidação no banco
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_previsao_transacao ON previsao_recebiveis_futuros(transacao);
CREATE INDEX IF NOT EXISTS idx_previsao_d_mais_31 ON previsao_recebiveis_futuros(d_mais_31);

-- 6. TABELA DE AUDITORIA E DIVERGÊNCIAS DA CONCILIAÇÃO
CREATE TABLE IF NOT EXISTS conciliacoes_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_regra VARCHAR(50) NOT NULL,     -- 'REGRA_1_CLUBE_PREVISAO' | 'REGRA_2_PDV_REDE'
    referencia_id VARCHAR(150) NOT NULL,
    data_referencia DATE NOT NULL,
    cliente_descricao VARCHAR(255),
    modalidade_plano VARCHAR(100),
    bandeira VARCHAR(50),
    valor_bruto NUMERIC(12, 2) NOT NULL,
    valor_mdr_retido NUMERIC(12, 2) NOT NULL,
    valor_liquido NUMERIC(12, 2) NOT NULL,
    taxa_efetiva_perc NUMERIC(6, 4),
    taxa_contratual_perc NUMERIC(6, 4),
    diferenca_taxa NUMERIC(12, 2) DEFAULT 0.00,
    status_conciliacao VARCHAR(50) NOT NULL, -- 'CONCILIADO', 'NAO_AUTORIZADO', 'PENDENTE_LIQUIDACAO', 'DIVERGENCIA_TAXA', 'NAO_ENCONTRADO_REDE'
    descricao_divergencia TEXT,
    data_liquidacao_projetada DATE,
    data_liquidacao_efetiva DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conciliacao_status ON conciliacoes_auditoria(status_conciliacao);
CREATE INDEX IF NOT EXISTS idx_conciliacao_data ON conciliacoes_auditoria(data_referencia);

-- 7. TABELA DE LOTES DE FECHAMENTO DIÁRIO DE CAIXA
CREATE TABLE IF NOT EXISTS lotes_fechamento_caixa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_caixa DATE NOT NULL UNIQUE,
    total_pdv_bruto NUMERIC(12, 2) NOT NULL,
    total_dinheiro NUMERIC(12, 2) DEFAULT 0.00,
    total_pix NUMERIC(12, 2) DEFAULT 0.00,
    total_cartao_credito NUMERIC(12, 2) DEFAULT 0.00,
    total_cartao_debito NUMERIC(12, 2) DEFAULT 0.00,
    qtd_atendimentos_clube INT DEFAULT 0,
    total_adquirente_bruto NUMERIC(12, 2) DEFAULT 0.00,
    total_adquirente_liquido NUMERIC(12, 2) DEFAULT 0.00,
    total_taxas_mdr NUMERIC(12, 2) DEFAULT 0.00,
    total_depositos_confirmados NUMERIC(12, 2) DEFAULT 0.00,
    qtd_divergencias INT DEFAULT 0,
    status_fechamento VARCHAR(50) NOT NULL, -- 'CONCILIADO', 'PENDENTE_LIQUIDACAO', 'DIVERGENTE'
    fechado_por VARCHAR(100),
    fechado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- VIEW: FLUXO DE CAIXA REALIZADO VS PROJETADO D+31
-- ============================================================================
CREATE OR REPLACE VIEW view_projecao_fluxo_caixa AS
SELECT 
    data_fluxo,
    SUM(valor_realizado) AS total_realizado,
    SUM(valor_projetado) AS total_projetado,
    SUM(taxas_mdr) AS total_taxas
FROM (
    -- Entradas realizadas da Rede
    SELECT 
        data_deposito AS data_fluxo,
        valor_total_lote AS valor_realizado,
        0.00 AS valor_projetado,
        0.00 AS taxas_mdr
    FROM adquirente_rede_recebidos
    
    UNION ALL
    
    -- Entradas realizadas em Dinheiro e Pix no balcão
    SELECT 
        data_dia AS data_fluxo,
        valor AS valor_realizado,
        0.00 AS valor_projetado,
        0.00 AS taxas_mdr
    FROM pdv_movimentacoes
    WHERE LOWER(forma_pgto) IN ('dinheiro', 'pix')
    
    UNION ALL
    
    -- Projeção de recebíveis D+31 das assinaturas do clube
    SELECT 
        d_mais_31 AS data_fluxo,
        0.00 AS valor_realizado,
        valor_liquido AS valor_projetado,
        mdr_valor AS taxas_mdr
    FROM previsao_recebiveis_futuros
    WHERE LOWER(status_transacao) IN ('previsto', 'a receber')
) combined
GROUP BY data_fluxo
ORDER BY data_fluxo ASC;
