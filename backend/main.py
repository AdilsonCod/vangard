"""
API FASTAPI DE CONCILIAÇÃO FINANCEIRA E GESTÃO DE FLUXO DE CAIXA
Barbearia Vangard Ltda
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any, List
import pandas as pd
import io

from reconciliation_engine import FinTechParser, ReconciliationEngine

app = FastAPI(
    title="API de Conciliação FinTech - Barbearia Vangard Ltda",
    description="Motor de Ingestão de 4 Fontes, Cruzamento de Assinaturas D+31, Liquidações Rede e Auditoria de MDR",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "app": "Barbearia Vangard FinTech Engine"}

@app.post("/api/conciliacao/processar")
async def processar_conciliacao(
    file_pdv: UploadFile = File(..., description="Relatório20_Movimentacoes.csv"),
    file_clube: UploadFile = File(..., description="71975-relatorio-transacoes...csv"),
    file_rede: UploadFile = File(..., description="Rede_Rel_Recebimentos...xlsx"),
    file_previsao: UploadFile = File(..., description="exportacao-relatorio-previsao...xlsx")
):
    """
    Recebe os 4 arquivos brutos, executa parsing com tolerância a encodings e separadores,
    aplica as Regras 1 e 2, audita taxas MDR e retorna KPIs e Fechamento Diário.
    """
    try:
        # 1. Ingestão PDV
        pdv_bytes = await file_pdv.read()
        df_pdv = FinTechParser.read_csv_with_encoding(pdv_bytes)
        df_pdv['valor'] = df_pdv['Valor'].apply(FinTechParser.clean_currency) if 'Valor' in df_pdv.columns else 0.0
        df_pdv['data_dia'] = df_pdv['Data'].apply(FinTechParser.parse_date) if 'Data' in df_pdv.columns else None
        df_pdv['cliente'] = df_pdv.get('Cliente', 'Cliente Balcão')
        df_pdv['forma_pgto'] = df_pdv.get('Forma de pgto', 'Dinheiro')

        # 2. Ingestão Clube
        clube_bytes = await file_clube.read()
        df_clube = FinTechParser.read_csv_with_encoding(clube_bytes)
        df_clube['codigo'] = df_clube.get('Código', df_clube.get('Codigo', ''))
        df_clube['tid'] = df_clube.get('TID', '')
        df_clube['nome_cliente'] = df_clube.get('Nome do cliente', '')
        df_clube['plano'] = df_clube.get('Plano', 'Vans Club')
        df_clube['status'] = df_clube.get('Status', 'PENDENTE')
        df_clube['valor'] = df_clube['Valor'].apply(FinTechParser.clean_currency) if 'Valor' in df_clube.columns else 0.0
        df_clube['data_venda'] = df_clube['Data do status atual'].apply(FinTechParser.parse_date) if 'Data do status atual' in df_clube.columns else None

        # 3. Ingestão Rede (XLSX com abas 'pagamentos' e 'recebidos')
        rede_bytes = await file_rede.read()
        excel_rede = pd.ExcelFile(io.BytesIO(rede_bytes))
        
        pag_sheet = next((s for s in excel_rede.sheet_names if 'pagamento' in s.lower()), excel_rede.sheet_names[0])
        df_rede_pag = excel_rede.parse(pag_sheet)
        df_rede_pag['data_venda'] = df_rede_pag.get('data original da venda', df_rede_pag.get('data venda', '')).apply(FinTechParser.parse_date)
        df_rede_pag['valor_bruto'] = df_rede_pag.get('valor bruto da parcela original', df_rede_pag.get('valor bruto', 0.0)).apply(FinTechParser.clean_currency)
        df_rede_pag['valor_liquido'] = df_rede_pag.get('valor liquido da parcela', df_rede_pag.get('valor liquido', 0.0)).apply(FinTechParser.clean_currency)
        df_rede_pag['tid'] = df_rede_pag.get('TID', '')

        rec_sheet = next((s for s in excel_rede.sheet_names if 'recebido' in s.lower() or 'deposito' in s.lower()), None)
        if rec_sheet:
            df_rede_rec = excel_rede.parse(rec_sheet)
            df_rede_rec['valor_total_lote'] = df_rede_rec.get('valor total', df_rede_rec.get('valor liquido', 0.0)).apply(FinTechParser.clean_currency)
        else:
            df_rede_rec = pd.DataFrame(columns=['valor_total_lote'])

        # 4. Ingestão Previsão (XLSX)
        prev_bytes = await file_previsao.read()
        excel_prev = pd.ExcelFile(io.BytesIO(prev_bytes))
        df_prev = excel_prev.parse(excel_prev.sheet_names[0])
        df_prev['transacao'] = df_prev.get('Transação', df_prev.get('Transacao', '')).astype(str)
        df_prev['tid'] = df_prev.get('TID', '').astype(str)
        df_prev['valor_bruto'] = df_prev.get('Valor Bruto', 0.0).apply(FinTechParser.clean_currency)
        df_prev['valor_liquido'] = df_prev.get('Valor (Líquido)', df_prev.get('Valor', 0.0)).apply(FinTechParser.clean_currency)
        df_prev['mdr_taxa_perc'] = df_prev.get('MDR', 0.0).apply(FinTechParser.clean_tax_rate)
        df_prev['d_mais_31'] = df_prev.get('D+31', '').apply(FinTechParser.parse_date)

        # Executa motor
        engine = ReconciliationEngine(
            df_pdv=df_pdv,
            df_clube=df_clube,
            df_rede_pagamentos=df_rede_pag,
            df_rede_recebidos=df_rede_rec,
            df_previsao=df_prev
        )
        resultado = engine.run()
        return resultado

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro no processamento dos arquivos: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
