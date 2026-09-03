#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
ESPECIALISTA EM CONCILIAÇÃO FINANCEIRA - AUDITORIA DE LOTES DIÁRIOS
Empresa: Barbearia Vangard Ltda
Processamento: Frente de Caixa (PDV) vs. Adquirente Rede (Aba Pagamentos)
===============================================================================
"""

import os
import re
import sys
import unicodedata
from typing import Optional, Tuple
import pandas as pd
import numpy as np


# -----------------------------------------------------------------------------
# 1. FUNÇÕES AUXILIARES DE LIMPEZA E SANITIZAÇÃO
# -----------------------------------------------------------------------------

def normalizar_texto(texto: any) -> str:
    """Remove acentos, espaços extras e converte para minúsculas."""
    if pd.isna(texto) or texto is None:
        return ""
    txt = str(texto).strip().lower()
    return unicodedata.normalize('NFKD', txt).encode('ASCII', 'ignore').decode('ASCII')


def limpar_valor_monetario(val: any) -> float:
    """
    Converte valores monetários para float padrão decimal.
    Trata formatos como 'R$ 1.250,50', ' 85,00 ', '(15,00)', '- 20,00' e floats nativos.
    """
    if pd.isna(val) or val is None:
        return 0.0
    if isinstance(val, (int, float, np.number)):
        return round(float(val), 2)
    
    val_str = str(val).strip()
    is_negative = '-' in val_str or (val_str.startswith('(') and val_str.endswith(')'))
    
    # Remove símbolos não numéricos, exceto separadores
    cleaned = re.sub(r'[R$\s().+-]', '', val_str)
    
    if ',' in cleaned and '.' in cleaned:
        # Exemplo: 1.250,50 -> 1250.50
        cleaned = cleaned.replace('.', '').replace(',', '.')
    elif ',' in cleaned:
        # Exemplo: 85,00 -> 85.00
        cleaned = cleaned.replace(',', '.')
        
    try:
        resultado = float(cleaned)
        return round(-resultado if is_negative else resultado, 2)
    except ValueError:
        return 0.0


def extrair_data_iso(val: any) -> Optional[str]:
    """
    Normaliza formatos variados de data para o padrão ISO (YYYY-MM-DD).
    Suporta: DD/MM/YYYY, DD/MM/YYYY HH:MM:SS, YYYY-MM-DD, datetime/Timestamp.
    """
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, (pd.Timestamp, np.datetime64)):
        return pd.to_datetime(val).strftime('%Y-%m-%d')
    
    val_str = str(val).strip()
    
    # DD/MM/YYYY com ou sem hora
    match_dmy = re.match(r'^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})', val_str)
    if match_dmy:
        dia, mes, ano = match_dmy.groups()
        return f"{ano}-{mes.zfill(2)}-{dia.zfill(2)}"
        
    # YYYY-MM-DD
    match_ymd = re.match(r'^(\d{4})[/.-](\d{2})[/.-](\d{2})', val_str)
    if match_ymd:
        ano, mes, dia = match_ymd.groups()
        return f"{ano}-{mes}-{dia}"
        
    try:
        dt = pd.to_datetime(val_str, dayfirst=True)
        return dt.strftime('%Y-%m-%d')
    except Exception:
        return None


# -----------------------------------------------------------------------------
# 2. CARREGAMENTO E PROCESSAMENTO DO PDV (MOVIMENTAÇÕES)
# -----------------------------------------------------------------------------

def carregar_pdv(caminho_csv: str) -> pd.DataFrame:
    """
    Carrega o relatório de movimentações do PDV, aplica filtros de cartão e sanitiza valores.
    """
    print(f"[*] Carregando arquivo do PDV: {caminho_csv}...")
    
    # Tenta múltiplos encodings e delimitadores
    df_raw = None
    for enc in ['utf-8-sig', 'utf-8', 'latin1', 'cp1252', 'iso-8859-1']:
        for sep in [';', ',', '\t']:
            try:
                df = pd.read_csv(caminho_csv, encoding=enc, sep=sep, dtype=str)
                if len(df.columns) > 1:
                    df_raw = df
                    break
            except Exception:
                continue
        if df_raw is not None:
            break
            
    if df_raw is None:
        raise ValueError(f"Não foi possível ler o arquivo CSV do PDV: {caminho_csv}")

    # Normalizar nomes de colunas
    df_raw.columns = [normalizar_texto(c) for c in df_raw.columns]
    
    # Localizar colunas de 'Forma de pgto', 'Valor' e 'Data'
    col_forma = next((c for c in df_raw.columns if 'forma' in c or 'pgto' in c), None)
    col_valor = next((c for c in df_raw.columns if 'valor' in c), None)
    col_data = next((c for c in df_raw.columns if 'data' in c), None)
    
    if not col_forma or not col_valor or not col_data:
        raise KeyError(f"Colunas obrigatórias não encontradas no PDV. Disponíveis: {list(df_raw.columns)}")

    # 1. Filtrar apenas cartão de crédito e débito
    mask_credito = df_raw[col_forma].str.contains(r'cr[eé]dito', case=False, na=False)
    mask_debito = df_raw[col_forma].str.contains(r'd[eé]bito', case=False, na=False)
    df_cartao = df_raw[mask_credito | mask_debito].copy()

    # 2. Mapear modalidade
    df_cartao['Modalidade'] = np.where(
        df_cartao[col_forma].str.contains(r'd[eé]bito', case=False, na=False),
        'Débito',
        'Crédito'
    )

    # 3. Limpar valores e datas
    df_cartao['Valor_Limpo'] = df_cartao[col_valor].apply(limpar_valor_monetario)
    df_cartao['Data_Venda'] = df_cartao[col_data].apply(extrair_data_iso)
    
    # Filtrar registros sem data válida
    df_cartao = df_cartao.dropna(subset=['Data_Venda'])
    
    print(f"    -> Vendas de cartão filtradas no PDV: {len(df_cartao)} transações")
    return df_cartao[['Data_Venda', 'Modalidade', 'Valor_Limpo']]


# -----------------------------------------------------------------------------
# 3. CARREGAMENTO E PROCESSAMENTO DO EXTRATO DA REDE
# -----------------------------------------------------------------------------

def carregar_rede(caminho_xlsx: str) -> pd.DataFrame:
    """
    Carrega o extrato de recebimentos da Rede na aba 'pagamentos',
    ignorando linhas de cabeçalho descritivo e sanitizando os campos numéricos.
    """
    print(f"[*] Carregando extrato da Rede: {caminho_xlsx} (aba 'pagamentos')...")
    
    # Inspeciona e localiza a linha de cabeçalho correta (procurando 'modalidade' ou 'data original da venda')
    df_excel = pd.read_excel(caminho_xlsx, sheet_name='pagamentos', header=None)
    
    header_idx = 0
    for idx, row in df_excel.head(15).iterrows():
        row_str = " ".join([normalizar_texto(val) for val in row.values])
        if 'modalidade' in row_str or 'data original da venda' in row_str or ('original' in row_str and 'venda' in row_str):
            header_idx = idx
            break
            
    # Recarrega a planilha com o cabeçalho correto
    df_rede = pd.read_excel(caminho_xlsx, sheet_name='pagamentos', header=header_idx)
    df_rede.columns = [normalizar_texto(c) for c in df_rede.columns]
    
    # REGRA DE NEGÓCIO: No relatório do adquirente a coluna que identifica as formas de pagamento é chamada de 'MODALIDADE'
    col_modalidade = next((c for c in df_rede.columns if 'modalidade' in c), None)
    if not col_modalidade:
        col_modalidade = next((c for c in df_rede.columns if 'produto' in c or 'forma' in c or 'operacao' in c), None)
        
    col_data_venda = next((c for c in df_rede.columns if 'data original da venda' in c or ('original' in c and 'venda' in c) or ('data' in c and 'venda' in c)), None)
    col_valor_bruto = next((c for c in df_rede.columns if 'valor bruto' in c or 'bruto' in c), None)
    col_valor_mdr = next((c for c in df_rede.columns if 'mdr' in c or 'taxa' in c), None)
    col_valor_liquido = next((c for c in df_rede.columns if 'valor liquido' in c or 'liquido' in c), None)
    
    if not (col_data_venda and col_modalidade and col_valor_bruto):
        raise KeyError(f"Coluna obrigatória 'Modalidade' ou dados de venda não identificados na Rede. Encontradas: {list(df_rede.columns)}")

    # 1. Extrair Data da Venda
    df_rede['Data_Venda'] = df_rede[col_data_venda].apply(extrair_data_iso)
    
    # 2. Mapear Formas de Pagamento a partir da coluna 'MODALIDADE' (Crédito, Débito e PIX)
    def classificar_modalidade(m):
        m_norm = normalizar_texto(m)
        if 'deb' in m_norm:
            return 'Débito'
        elif 'pix' in m_norm:
            return 'PIX'
        return 'Crédito'
        
    df_rede['Modalidade'] = df_rede[col_modalidade].apply(classificar_modalidade)

    # 3. Limpar valores numéricos
    df_rede['Valor_Bruto'] = df_rede[col_valor_bruto].apply(limpar_valor_monetario)
    df_rede['Valor_MDR'] = df_rede[col_valor_mdr].apply(limpar_valor_monetario) if col_valor_mdr else 0.0
    
    if col_valor_liquido:
        df_rede['Valor_Liquido'] = df_rede[col_valor_liquido].apply(limpar_valor_monetario)
    else:
        df_rede['Valor_Liquido'] = (df_rede['Valor_Bruto'] - df_rede['Valor_MDR']).round(2)
        
    # Filtrar registros sem data válida
    df_rede = df_rede.dropna(subset=['Data_Venda'])
    
    print(f"    -> Transações carregadas da Rede: {len(df_rede)} registros")
    return df_rede[['Data_Venda', 'Modalidade', 'Valor_Bruto', 'Valor_MDR', 'Valor_Liquido']]


# -----------------------------------------------------------------------------
# 4. MOTOR DE CONCILIAÇÃO POR LOTES DIÁRIOS (CRUZAMENTO CHAVE COMPOSTA)
# -----------------------------------------------------------------------------

def conciliar_lotes_diarios(df_pdv: pd.DataFrame, df_rede: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    """
    Agrupa ambos os dataframes por [Data_Venda, Modalidade], cruza os lotes diários
    e gera a auditoria de divergências e o resumo executivo.
    """
    print("[*] Agrupando por Lote [Data da Venda + Modalidade]...")

    # 1. Agrupamento PDV
    pdv_lotes = df_pdv.groupby(['Data_Venda', 'Modalidade']).agg(
        Qtd_Vendas_PDV=('Valor_Limpo', 'count'),
        Total_Bruto_PDV=('Valor_Limpo', 'sum')
    ).reset_index()

    # 2. Agrupamento Rede
    rede_lotes = df_rede.groupby(['Data_Venda', 'Modalidade']).agg(
        Qtd_Vendas_Rede=('Valor_Bruto', 'count'),
        Total_Bruto_Rede=('Valor_Bruto', 'sum'),
        Total_Taxa_MDR=('Valor_MDR', 'sum'),
        Total_Liquido_Rede=('Valor_Liquido', 'sum')
    ).reset_index()

    # 3. Cruzamento Full Outer Join (Chave composta: Data_Venda + Modalidade)
    conciliacao = pd.merge(
        pdv_lotes,
        rede_lotes,
        on=['Data_Venda', 'Modalidade'],
        how='outer'
    )

    # Preenchimento de valores nulos para lotes sem correspondência em uma das pontas
    conciliacao['Qtd_Vendas_PDV'] = conciliacao['Qtd_Vendas_PDV'].fillna(0).astype(int)
    conciliacao['Total_Bruto_PDV'] = conciliacao['Total_Bruto_PDV'].fillna(0.0).round(2)
    conciliacao['Qtd_Vendas_Rede'] = conciliacao['Qtd_Vendas_Rede'].fillna(0).astype(int)
    conciliacao['Total_Bruto_Rede'] = conciliacao['Total_Bruto_Rede'].fillna(0.0).round(2)
    conciliacao['Total_Taxa_MDR'] = conciliacao['Total_Taxa_MDR'].fillna(0.0).round(2)
    conciliacao['Total_Liquido_Rede'] = conciliacao['Total_Liquido_Rede'].fillna(0.0).round(2)

    # 4. Cálculo da Diferença Bruta (PDV - Rede)
    conciliacao['Diferenca_Bruta'] = (conciliacao['Total_Bruto_PDV'] - conciliacao['Total_Bruto_Rede']).round(2)

    # 5. Status do Lote (tolerância de R$ 0.01 para arredondamentos monetários)
    conciliacao['Status_Lote'] = np.where(
        conciliacao['Diferenca_Bruta'].abs() <= 0.01,
        'CONCILIADO',
        'DIVERGENTE'
    )

    # Ordenação cronológica por Data da Venda e Modalidade
    conciliacao = conciliacao.sort_values(by=['Data_Venda', 'Modalidade']).reset_index(drop=True)

    # Renomeação para as colunas oficiais exigidas
    colunas_finais = {
        'Data_Venda': 'Data da Venda',
        'Modalidade': 'Modalidade',
        'Qtd_Vendas_PDV': 'Qtd Vendas PDV',
        'Total_Bruto_PDV': 'Total Bruto PDV (R$)',
        'Qtd_Vendas_Rede': 'Qtd Vendas Rede',
        'Total_Bruto_Rede': 'Total Bruto Rede (R$)',
        'Total_Taxa_MDR': 'Total Taxa MDR Descontada (R$)',
        'Total_Liquido_Rede': 'Total Líquido a Receber (R$)',
        'Diferenca_Bruta': 'Diferença Bruta (PDV - Rede)',
        'Status_Lote': 'Status do Lote'
    }
    df_resultado = conciliacao.rename(columns=colunas_finais)

    # 6. Resumo Executivo
    total_pdv_geral = df_resultado['Total Bruto PDV (R$)'].sum()
    total_rede_geral = df_resultado['Total Bruto Rede (R$)'].sum()
    total_mdr_geral = df_resultado['Total Taxa MDR Descontada (R$)'].sum()
    total_liquido_geral = df_resultado['Total Líquido a Receber (R$)'].sum()
    diferenca_geral = total_pdv_geral - total_rede_geral

    lotes_divergentes = df_resultado[df_resultado['Status do Lote'] == 'DIVERGENTE'].copy()

    resumo = {
        'total_bruto_pdv': round(total_pdv_geral, 2),
        'total_bruto_rede': round(total_rede_geral, 2),
        'total_mdr_retido': round(total_mdr_geral, 2),
        'total_liquido_rede': round(total_liquido_geral, 2),
        'diferenca_geral': round(diferenca_geral, 2),
        'taxa_mdr_media_pct': round((total_mdr_geral / total_rede_geral * 100), 2) if total_rede_geral > 0 else 0.0,
        'qtd_lotes_total': len(df_resultado),
        'qtd_lotes_conciliados': len(df_resultado[df_resultado['Status do Lote'] == 'CONCILIADO']),
        'qtd_lotes_divergentes': len(lotes_divergentes),
        'detalhe_divergencias': lotes_divergentes.to_dict(orient='records')
    }

    return df_resultado, resumo


# -----------------------------------------------------------------------------
# 5. EXECUÇÃO PRINCIPAL E EXPORTAÇÃO
# -----------------------------------------------------------------------------

def executar_conciliacao(arquivo_pdv: str, arquivo_rede: str, output_csv: str = "conciliacao_lotes_resultado.csv"):
    """Pipeline completo de ingestão, cruzamento e relatório."""
    df_pdv = carregar_pdv(arquivo_pdv)
    df_rede = carregar_rede(arquivo_rede)
    
    df_resultado, resumo = conciliar_lotes_diarios(df_pdv, df_rede)
    
    # Salvar resultado em CSV
    df_resultado.to_csv(output_csv, index=False, sep=';', decimal=',', encoding='utf-8-sig')
    print(f"\n[✓] Relatório consolidado exportado com sucesso para: {output_csv}")
    
    # Imprimir Relatório e Resumo Executivo
    print("\n" + "="*95)
    print("                      RELATÓRIO CONSOLIDADO DE LOTES DIÁRIOS")
    print("="*95)
    
    # Formatação para exibição no console
    df_display = df_resultado.copy()
    for col in ['Total Bruto PDV (R$)', 'Total Bruto Rede (R$)', 'Total Taxa MDR Descontada (R$)', 'Total Líquido a Receber (R$)', 'Diferença Bruta (PDV - Rede)']:
        df_display[col] = df_display[col].apply(lambda x: f"R$ {x:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'))
        
    print(df_display.to_string(index=False))
    
    print("\n" + "="*95)
    print("                                RESUMO EXECUTIVO")
    print("="*95)
    print(f"• Total Bruto Faturado PDV (Cartões) : R$ {resumo['total_bruto_pdv']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'))
    print(f"• Total Bruto Aprovado na Rede       : R$ {resumo['total_bruto_rede']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'))
    print(f"• Diferença Bruta Global (PDV - Rede): R$ {resumo['diferenca_geral']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'))
    print(f"• Total de Taxas Retidas (MDR)       : R$ {resumo['total_mdr_retido']:,.2f} ({resumo['taxa_mdr_media_pct']:.2f}% média)".replace(',', 'X').replace('.', ',').replace('X', '.'))
    print(f"• Total Líquido a Receber (Rede)     : R$ {resumo['total_liquido_rede']:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'))
    print(f"• Total de Lotes Auditados           : {resumo['qtd_lotes_total']} lotes ({resumo['qtd_lotes_conciliados']} Conciliados / {resumo['qtd_lotes_divergentes']} Divergentes)")
    
    if resumo['qtd_lotes_divergentes'] > 0:
        print("\n[!] DIAS / LOTES COM DIVERGÊNCIA IDENTIFICADA PARA AUDITORIA:")
        for div in resumo['detalhe_divergencias']:
            data = div['Data da Venda']
            mod = div['Modalidade']
            dif = div['Diferença Bruta (PDV - Rede)']
            pdv_val = div['Total Bruto PDV (R$)']
            rede_val = div['Total Bruto Rede (R$)']
            motivo = "Venda no PDV não encontrada na Rede" if rede_val == 0 else ("Transação na Rede sem registro no PDV" if pdv_val == 0 else "Valor divergente entre PDV e Rede")
            print(f"   -> Lote {data} [{mod}]: Diferença de R$ {dif:,.2f} (PDV: R$ {pdv_val:,.2f} vs Rede: R$ {rede_val:,.2f}) - Motivo provável: {motivo}")
    else:
        print("\n[✓] Todos os lotes diários estão 100% conciliados!")
    print("="*95 + "\n")
    
    return df_resultado, resumo


if __name__ == "__main__":
    # Nomes dos arquivos conforme especificado pelo usuário
    arquivo_pdv = "Relatório20_Movimentacoes.csv"
    arquivo_rede = "Rede_Rel_Recebimentos_01_08_2026-31_08_2026-fa48248e-1ac8-41cb-8067-72db2ef0c8e5.xlsx"
    
    if os.path.exists(arquivo_pdv) and os.path.exists(arquivo_rede):
        executar_conciliacao(arquivo_pdv, arquivo_rede)
    else:
        print(f"Os arquivos '{arquivo_pdv}' e/ou '{arquivo_rede}' devem estar presentes no diretório atual.")
