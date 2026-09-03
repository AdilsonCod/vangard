"""
MOTOR DE CONCILIAÇÃO FINANCEIRA AUTOMATIZADA
Barbearia Vangard Ltda
Especializado em FinTech: Tratamento de Encoding, Limpeza Monetária, Regras 1 & 2, Auditoria de Taxas
"""

import io
import re
import math
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple, Optional
import pandas as pd
import numpy as np


class FinTechParser:
    """Ingestão e sanitização de dados financeiros multiformato (CSV/XLSX)."""

    @staticmethod
    def clean_currency(val: Any) -> float:
        """Converte strings monetárias brasileiras (ex: 'R$ 70,00', '- 4,54', '(50,00)') para float."""
        if pd.isna(val) or val is None:
            return 0.0
        if isinstance(val, (int, float)):
            return round(float(val), 2)
        
        val_str = str(val).strip()
        is_negative = '-' in val_str or (val_str.startswith('(') and val_str.endswith(')'))
        # Remove caracteres não numéricos exceto separadores
        cleaned = re.sub(r'[R$\s().+-]', '', val_str)
        
        if ',' in cleaned and '.' in cleaned:
            # Padrão brasileiro: 1.250,50
            cleaned = cleaned.replace('.', '').replace(',', '.')
        elif ',' in cleaned:
            cleaned = cleaned.replace(',', '.')
            
        try:
            parsed = float(cleaned)
            return round(-parsed if is_negative else parsed, 2)
        except ValueError:
            return 0.0

    @staticmethod
    def clean_tax_rate(val: Any) -> float:
        """Limpa porcentagem de taxa MDR (ex: '2,39%', '2.39', 0.0239)."""
        if pd.isna(val) or val is None:
            return 0.0
        if isinstance(val, (int, float)):
            return float(val * 100) if val < 0.20 else float(val)
        val_str = str(val).replace('%', '').replace(',', '.').strip()
        try:
            return float(val_str)
        except ValueError:
            return 0.0

    @staticmethod
    def parse_date(val: Any) -> Optional[str]:
        """Converte múltiplos formatos de data para ISO YYYY-MM-DD."""
        if pd.isna(val) or val is None:
            return None
        if isinstance(val, (datetime, pd.Timestamp)):
            return val.strftime('%Y-%m-%d')
        val_str = str(val).strip()
        
        # DD/MM/YYYY HH:MM ou DD/MM/YYYY
        match_dmy = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})', val_str)
        if match_dmy:
            day, month, year = match_dmy.groups()
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
            
        # YYYY-MM-DD
        match_ymd = re.match(r'^(\d{4})-(\d{2})-(\d{2})', val_str)
        if match_ymd:
            return match_ymd.group(0)
            
        try:
            dt = pd.to_datetime(val_str, dayfirst=True)
            return dt.strftime('%Y-%m-%d')
        except Exception:
            return None

    @staticmethod
    def read_csv_with_encoding(file_bytes: bytes) -> pd.DataFrame:
        """Tenta múltiplos encodings (utf-8, latin1, iso-8859-1, cp1252) e separadores (; ou ,)."""
        encodings = ['utf-8', 'latin1', 'iso-8859-1', 'cp1252']
        for enc in encodings:
            for sep in [';', ',', '\t']:
                try:
                    df = pd.read_csv(io.BytesIO(file_bytes), encoding=enc, sep=sep)
                    if len(df.columns) > 1:
                        # Limpa BOM e espaços nos nomes de colunas
                        df.columns = [str(c).replace('\ufeff', '').strip() for c in df.columns]
                        return df
                except Exception:
                    continue
        # Fallback padrão
        return pd.read_csv(io.BytesIO(file_bytes), encoding='utf-8', sep=None, engine='python')


class ReconciliationEngine:
    """Motor de Regras de Negócio e Auditoria da Barbearia Vangard Ltda."""

    def __init__(
        self,
        df_pdv: pd.DataFrame,
        df_clube: pd.DataFrame,
        df_rede_pagamentos: pd.DataFrame,
        df_rede_recebidos: pd.DataFrame,
        df_previsao: pd.DataFrame
    ):
        self.df_pdv = df_pdv
        self.df_clube = df_clube
        self.df_rede_pag = df_rede_pagamentos
        self.df_rede_rec = df_rede_recebidos
        self.df_prev = df_previsao

    def run(self) -> Dict[str, Any]:
        reconciliation_items = []
        
        # -------------------------------------------------------------
        # REGRA 1: Clube Recorrente vs. Previsão de Recebíveis D+31
        # -------------------------------------------------------------
        matched_prev_indices = set()
        
        for idx, row_clube in self.df_clube.iterrows():
            codigo = str(row_clube.get('codigo', '')).strip()
            tid_clube = str(row_clube.get('tid', '')).strip()
            status_clube = str(row_clube.get('status', '')).upper()
            nome_cliente = str(row_clube.get('nome_cliente', ''))
            plano = str(row_clube.get('plano', 'Assinatura'))
            valor_clube = float(row_clube.get('valor', 0.0))
            data_venda = row_clube.get('data_venda') or row_clube.get('vencimento')
            
            # Match por TID ou Código/Transação
            match_prev = None
            for p_idx, row_prev in self.df_prev.iterrows():
                if p_idx in matched_prev_indices:
                    continue
                tid_prev = str(row_prev.get('tid', '')).strip()
                transacao_prev = str(row_prev.get('transacao', '')).strip()
                
                if (tid_clube and tid_prev and tid_clube == tid_prev) or (codigo and transacao_prev and codigo == transacao_prev):
                    match_prev = row_prev
                    matched_prev_indices.add(p_idx)
                    break
                    
            is_authorized = any(s in status_clube for s in ['PAGO', 'AUTORIZADO', 'CAPTURADO', 'APROVADO'])
            
            if match_prev is not None:
                valor_bruto = float(match_prev.get('valor_bruto', valor_clube))
                valor_liquido = float(match_prev.get('valor_liquido', 0.0))
                mdr_retido = valor_bruto - valor_liquido
                taxa_efetiva = (mdr_retido / valor_bruto * 100) if valor_bruto > 0 else 0.0
                taxa_contratual = float(match_prev.get('mdr_taxa_perc', 2.49))
                diferenca_taxa = abs(taxa_efetiva - taxa_contratual)
                d_mais_31 = match_prev.get('d_mais_31')
                
                status = 'CONCILIADO'
                descricao = 'Conciliado com sucesso com a Previsão D+31'
                
                if not is_authorized:
                    status = 'NAO_AUTORIZADO'
                    descricao = f"Não Autorizado no Gateway: {row_clube.get('descricao_status', status_clube)}"
                elif diferenca_taxa > 0.5:
                    status = 'DIVERGENCIA_TAXA'
                    descricao = f"Divergência de Taxa: Cobrado {taxa_efetiva:.2f}% vs Contratado {taxa_contratual:.2f}%"
                else:
                    today = datetime.now().strftime('%Y-%m-%d')
                    if d_mais_31 and d_mais_31 > today:
                        status = 'PENDENTE_LIQUIDACAO'
                        descricao = f"Aprovado, com liquidação futura agendada para {d_mais_31} (D+31)"
                        
                reconciliation_items.append({
                    'regra': 'REGRA_1_CLUBE_PREVISAO',
                    'identificador': tid_clube or codigo,
                    'cliente': nome_cliente,
                    'descricao': plano,
                    'data_venda': data_venda,
                    'valor_bruto': valor_bruto,
                    'mdr_retido': round(mdr_retido, 2),
                    'valor_liquido': valor_liquido,
                    'taxa_efetiva': round(taxa_efetiva, 2),
                    'status': status,
                    'detalhes': descricao,
                    'data_liquidacao': d_mais_31
                })
            else:
                status = 'PENDENTE_LIQUIDACAO' if is_authorized else 'NAO_AUTORIZADO'
                reconciliation_items.append({
                    'regra': 'REGRA_1_CLUBE_PREVISAO',
                    'identificador': tid_clube or codigo,
                    'cliente': nome_cliente,
                    'descricao': plano,
                    'data_venda': data_venda,
                    'valor_bruto': valor_clube,
                    'mdr_retido': 0.0,
                    'valor_liquido': valor_clube,
                    'taxa_efetiva': 0.0,
                    'status': status,
                    'detalhes': 'Cobrança do clube sem correspondente no arquivo de previsão',
                    'data_liquidacao': None
                })

        # -------------------------------------------------------------
        # REGRA 2: Vendas de Cartão do PDV vs. Relatório da Rede
        # -------------------------------------------------------------
        matched_rede_indices = set()
        df_pdv_cartao = self.df_pdv[self.df_pdv['forma_pgto'].str.lower().str.contains('cart|créd|déb', na=False)].copy()
        
        for idx, row_pdv in df_pdv_cartao.iterrows():
            forma = str(row_pdv.get('forma_pgto', '')).lower()
            modalidade_esperada = 'DÉBITO' if 'déb' in forma else 'CRÉDITO'
            data_pdv = row_pdv.get('data_dia')
            valor_pdv = float(row_pdv.get('valor', 0.0))
            cliente = row_pdv.get('cliente', 'Cliente Balcão')
            
            # Match com relatório da Rede
            match_rede = None
            for r_idx, row_rede in self.df_rede_pag.iterrows():
                if r_idx in matched_rede_indices:
                    continue
                same_day = row_rede.get('data_venda') == data_pdv
                same_amount = abs(float(row_rede.get('valor_bruto', 0.0)) - valor_pdv) <= 0.05
                if same_day and same_amount:
                    match_rede = row_rede
                    matched_rede_indices.add(r_idx)
                    break
                    
            if match_rede is not None:
                valor_bruto = float(match_rede.get('valor_bruto', valor_pdv))
                valor_liquido = float(match_rede.get('valor_liquido', 0.0))
                mdr_retido = valor_bruto - valor_liquido
                taxa_efetiva = (mdr_retido / valor_bruto * 100) if valor_bruto > 0 else 0.0
                taxa_contratual = 1.19 if modalidade_esperada == 'DÉBITO' else 2.39
                diferenca_taxa = abs(taxa_efetiva - taxa_contratual)
                
                status = 'CONCILIADO'
                descricao = 'Venda física PDV liquidada pela Rede Adquirente'
                
                if diferenca_taxa > 0.8:
                    status = 'DIVERGENCIA_TAXA'
                    descricao = f"Taxa aplicada ({taxa_efetiva:.2f}%) difere da contratual ({taxa_contratual:.2f}%)"
                elif 'PENDENTE' in str(match_rede.get('status', '')).upper():
                    status = 'PENDENTE_LIQUIDACAO'
                    descricao = 'Venda autorizada, aguardando repasse bancário'
                    
                reconciliation_items.append({
                    'regra': 'REGRA_2_PDV_REDE',
                    'identificador': match_rede.get('tid') or match_rede.get('num_autorizacao', f"PDV-{idx}"),
                    'cliente': cliente,
                    'descricao': f"Venda Cartão {modalidade_esperada}",
                    'data_venda': data_pdv,
                    'valor_bruto': valor_bruto,
                    'mdr_retido': round(mdr_retido, 2),
                    'valor_liquido': valor_liquido,
                    'taxa_efetiva': round(taxa_efetiva, 2),
                    'status': status,
                    'detalhes': descricao,
                    'data_liquidacao': match_rede.get('data_recebimento')
                })
            else:
                reconciliation_items.append({
                    'regra': 'REGRA_2_PDV_REDE',
                    'identificador': f"PDV-{idx}",
                    'cliente': cliente,
                    'descricao': f"Venda Cartão {modalidade_esperada}",
                    'data_venda': data_pdv,
                    'valor_bruto': valor_pdv,
                    'mdr_retido': 0.0,
                    'valor_liquido': valor_pdv,
                    'taxa_efetiva': 0.0,
                    'status': 'NAO_ENCONTRADO_REDE',
                    'detalhes': 'Venda registrada no PDV não encontrada no extrato de recebimentos da Rede',
                    'data_liquidacao': None
                })

        # -------------------------------------------------------------
        # CALCULO DOS 4 KPIS SOLICITADOS
        # -------------------------------------------------------------
        # 1. Saldo Real em Conta (Lotes recebidos no banco + Dinheiro/Pix em caixa)
        depositos_rede = float(self.df_rede_rec['valor_total_lote'].sum()) if 'valor_total_lote' in self.df_rede_rec else 0.0
        dinheiro_pix_pdv = float(self.df_pdv[self.df_pdv['forma_pgto'].str.lower().str.contains('dinheiro|pix', na=False)]['valor'].sum())
        saldo_real_em_conta = round(depositos_rede + dinheiro_pix_pdv, 2)
        
        # 2. Total Faturado PDV vs Aprovado Adquirente
        total_faturado_pdv = round(float(self.df_pdv['valor'].sum()), 2)
        total_aprovado_adquirente = round(float(self.df_rede_pag['valor_bruto'].sum()) if 'valor_bruto' in self.df_rede_pag else 0.0, 2)
        
        # 3. Previsão de Entradas D+30 (Clube)
        previsao_d30 = round(float(self.df_prev['valor_liquido'].sum()) if 'valor_liquido' in self.df_prev else 0.0, 2)
        
        # 4. Total de Divergências
        divergencias = [item for item in reconciliation_items if item['status'] in ['NAO_AUTORIZADO', 'DIVERGENCIA_TAXA', 'NAO_ENCONTRADO_REDE']]
        total_divergencias_valor = round(sum(d['valor_bruto'] for d in divergencias), 2)
        
        return {
            'kpis': {
                'saldo_real_em_conta': saldo_real_em_conta,
                'total_faturado_pdv': total_faturado_pdv,
                'total_aprovado_adquirente': total_aprovado_adquirente,
                'previsao_entradas_d30': previsao_d30,
                'total_divergencias_valor': total_divergencias_valor,
                'total_divergencias_count': len(divergencias)
            },
            'items': reconciliation_items
        }
