import pandas as pd
import re

class FinTechReconciliationPipeline:
    def __init__(self, entradas_manuais, gateway, pdv, rede, extrato_bancario):
        self.entradas = pd.DataFrame(entradas_manuais)
        self.gateway = pd.DataFrame(gateway)
        self.pdv = pd.DataFrame(pdv)
        self.rede = pd.DataFrame(rede)
        self.extrato = pd.DataFrame(extrato_bancario)
        self.inconsistencias = []
        self.rede_usados_balcao = set()

    def _extrair_chave(self, descricao):
        """Extrai NSU, AUT ou ID PIX da descrição via RegEx"""
        match = re.search(r'(?:NSU|AUT|PIX|ID|REF)[\s:=-]*([A-Za-z0-9]+)', str(descricao), re.IGNORECASE)
        return match.group(1).upper() if match else str(descricao).upper().strip()

    def reconcile_counter_rede(self):
        """PASSO 1A: Roteia Assinaturas via Cartão (Rede)"""
        print("-> Processando Assinaturas de Balcão (REDE)...")
        if 'tag' not in self.entradas.columns:
            return pd.DataFrame()
            
        entradas_rede = self.entradas[self.entradas['tag'] == 'ASSINATURA_BALCAO_REDE'].copy()
        entradas_rede['chave_busca'] = entradas_rede['descricao'].apply(self._extrair_chave)
        
        # Cria chaves de busca na Rede (NSU ou NumAutorizacao)
        self.rede['chave_nsu'] = self.rede['nsu'].astype(str).str.upper()
        self.rede['chave_aut'] = self.rede['autorizacao'].astype(str).str.upper()
        
        conciliados = []
        for _, entrada in entradas_rede.iterrows():
            chave = entrada['chave_busca']
            # Busca match na Rede
            match = self.rede[(self.rede['chave_nsu'] == chave) | (self.rede['chave_aut'] == chave)]
            
            if not match.empty:
                idx = match.index[0]
                self.rede_usados_balcao.add(idx)
                conciliados.append({
                    'id_entrada': entrada['id'],
                    'cliente': entrada['cliente'],
                    'valor_bruto': entrada['valor'],
                    'mdr_retido': match.loc[idx, 'valor_bruto'] - match.loc[idx, 'valor_liquido'],
                    'valor_liquido': match.loc[idx, 'valor_liquido'],
                    'status': 'CONCILIADO_REDE'
                })
            else:
                self.inconsistencias.append(f"Entrada Manual REDE {entrada['id']} sem match na adquirente. (Busca: {chave})")
                
        return pd.DataFrame(conciliados)

    def reconcile_counter_pix(self):
        """PASSO 1B: Roteia Assinaturas via PIX"""
        print("-> Processando Assinaturas de Balcão (PIX)...")
        if 'tag' not in self.entradas.columns:
            return pd.DataFrame()
            
        entradas_pix = self.entradas[self.entradas['tag'] == 'ASSINATURA_BALCAO_PIX'].copy()
        entradas_pix['chave_busca'] = entradas_pix['descricao'].apply(self._extrair_chave)
        
        # Simplificação: Match com extrato bancário
        self.extrato['chave_extrato'] = self.extrato['comprovante'].astype(str).str.upper()
        
        conciliados = []
        for _, entrada in entradas_pix.iterrows():
            chave = entrada['chave_busca']
            match = self.extrato[(self.extrato['chave_extrato'].str.contains(chave)) & (self.extrato['valor'] == entrada['valor'])]
            
            if not match.empty:
                conciliados.append({
                    'id_entrada': entrada['id'],
                    'cliente': entrada['cliente'],
                    'valor_bruto': entrada['valor'],
                    'mdr_retido': 0.0,
                    'valor_liquido': entrada['valor'],
                    'status': 'CONCILIADO_PIX_BANCO'
                })
            else:
                self.inconsistencias.append(f"Entrada Manual PIX {entrada['id']} não confirmada no extrato bancário.")
                
        return pd.DataFrame(conciliados)

    def validate_gateway_external(self):
        """PASSO 2: Validação Cruzada com o Gateway de Assinaturas"""
        print("-> Validando Gateway (Paga fora do sistema)...")
        gateway_fora = self.gateway[self.gateway['status'] == 'Paga fora do sistema'].copy()
        
        for _, fatura in gateway_fora.iterrows():
            # Procura entrada manual correspondente
            match = self.entradas[(self.entradas['cliente'].str.contains(fatura['cliente'], case=False, na=False)) & 
                                  (self.entradas['valor'] == fatura['valor'])]
            if match.empty:
                self.inconsistencias.append(f"Fatura Gateway {fatura['id']} (Baixa Externa) sem Entrada Manual correspondente.")

    def reconcile_pdv_batch(self):
        """PASSO 3: Conciliação em Lote do PDV (Cartões)"""
        print("-> Conciliando PDV em Lote (excluindo assinaturas balcão)...")
        # Filtra PDV
        pdv_cartao = self.pdv[self.pdv['forma_pgto'].isin(['Cartão de crédito', 'Cartão de débito'])]
        lotes_pdv = pdv_cartao.groupby(['data', 'forma_pgto'])['valor'].sum().reset_index()
        
        # Filtra Rede (Excluindo as que já deram match no PASSO 1A)
        rede_restante = self.rede.drop(index=list(self.rede_usados_balcao))
        lotes_rede = rede_restante.groupby(['data', 'modalidade'])['valor_bruto'].sum().reset_index()
        
        # Lógica simplificada de match de lote (ver TypeScript para versão completa)
        return lotes_pdv

    def run_pipeline(self):
        res_rede = self.reconcile_counter_rede()
        res_pix = self.reconcile_counter_pix()
        self.validate_gateway_external()
        self.reconcile_pdv_batch()
        
        print("\n=== RELATÓRIO DE INCONSISTÊNCIAS ===")
        for i in self.inconsistencias:
            print(f"- {i}")
            
        return pd.concat([res_rede, res_pix])

# Mock Data de Exemplo
entradas = [
    {'id': 1, 'data': '2026-09-02', 'valor': 150.0, 'cliente': 'João Silva', 'tag': 'ASSINATURA_BALCAO_REDE', 'descricao': 'Pagamento presencial NSU: 123456'},
    {'id': 2, 'data': '2026-09-02', 'valor': 100.0, 'cliente': 'Maria Souza', 'tag': 'ASSINATURA_BALCAO_PIX', 'descricao': 'Pix recebido REF-998877'}
]
gateway = [
    {'id': 'FAT-10', 'cliente': 'João Silva', 'valor': 150.0, 'status': 'Paga fora do sistema'},
    {'id': 'FAT-11', 'cliente': 'Maria Souza', 'valor': 100.0, 'status': 'Paga fora do sistema'},
    {'id': 'FAT-12', 'cliente': 'Pedro', 'valor': 120.0, 'status': 'Paga fora do sistema'} # Vai gerar alerta
]
pdv = [{'id': 1, 'data': '2026-09-02', 'forma_pgto': 'Cartão de crédito', 'valor': 500.0}]
rede = [{'id': 1, 'data': '2026-09-02', 'nsu': '123456', 'autorizacao': 'AUT1', 'modalidade': 'Crédito', 'valor_bruto': 150.0, 'valor_liquido': 145.0}]
extrato = [{'id': 1, 'comprovante': 'REF-998877', 'valor': 100.0}]

if __name__ == "__main__":
    pipeline = FinTechReconciliationPipeline(entradas, gateway, pdv, rede, extrato)
    conciliados = pipeline.run_pipeline()
    print("\n=== ASSINATURAS DE BALCÃO CONCILIADAS ===")
    print(conciliados)
