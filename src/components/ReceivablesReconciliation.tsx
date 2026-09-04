import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { FinancialTransaction } from '../types';
import { CheckSquare, Square, DollarSign, CreditCard, Calendar, Filter, Download, Upload, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export function ReceivablesReconciliation() {
  const { transactions, updateTransaction } = useStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterMethod, setFilterMethod] = useState<string>('ALL');
  
  // Modals and advanced state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().split('T')[0]);
  const [mdrFeePercent, setMdrFeePercent] = useState<number>(0);
  
  // Advanced Import Flow
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSalesData, setImportSalesData] = useState<any[]>([]);
  const [importSettlementData, setImportSettlementData] = useState<any[]>([]);
  const [matchedImportData, setMatchedImportData] = useState<Record<string, { codigo: string, bandeira: string, mdr: string, valorBruto: number, valorLiquido: number }>>({});
  
  const salesFileInputRef = useRef<HTMLInputElement>(null);
  const settlementFileInputRef = useRef<HTMLInputElement>(null);

  const receivables = useMemo(() => {
    return transactions
      .filter(t => t.type === 'INCOME' && (t.status === 'PENDENTE' || t.status === 'AGENDADO'))
      .sort((a, b) => new Date(a.dueDate || a.date).getTime() - new Date(b.dueDate || b.date).getTime());
  }, [transactions]);

  const filteredReceivables = useMemo(() => {
    if (filterMethod === 'ALL') return receivables;
    return receivables.filter(t => t.classification === filterMethod || t.category === filterMethod);
  }, [receivables, filterMethod]);

  const parseFile = async (file: File): Promise<any[]> => {
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt === 'csv') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data)
          });
        };
        reader.readAsText(file, "utf-8");
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];
      return XLSX.utils.sheet_to_json(firstSheet);
    }
    throw new Error("Formato não suportado");
  };

  const parseMoney = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseFloat(String(val).replace(/R\$/g, "").replace(/\./g, "").replace(/,/g, ".").trim());
  };

  const handleSalesFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await parseFile(file);
      setImportSalesData(data);
      alert(`Arquivo de Vendas (cel_payments) carregado com ${data.length} linhas.`);
    } catch (err) {
      alert("Erro ao ler arquivo.");
    }
    if (salesFileInputRef.current) salesFileInputRef.current.value = "";
  };

  const handleSettlementFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await parseFile(file);
      setImportSettlementData(data);
      alert(`Arquivo de Liquidações carregado com ${data.length} linhas.`);
    } catch (err) {
      alert("Erro ao ler arquivo.");
    }
    if (settlementFileInputRef.current) settlementFileInputRef.current.value = "";
  };

  const getCol = (row: any, ...options: string[]) => {
    if (!row) return undefined;
    for (const key of Object.keys(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/[\uFEFF\xA0]/g, '');
      if (options.some(opt => cleanKey === opt.toLowerCase())) {
        return row[key];
      }
    }
    return undefined;
  };

  const processCrossMatch = () => {
    try {
      if (importSalesData.length === 0 || importSettlementData.length === 0) {
        alert("Por favor, importe os dois arquivos antes de cruzar os dados.");
        return;
      }

      const newSelected = new Set(selectedIds);
      const newMatchedMap = { ...matchedImportData };
      let matchCount = 0;

      importSettlementData.forEach(settle => {
        const transacao = String(getCol(settle, "transação", "transacao", "código", "codigo", "tid") || "").trim();
        if (!transacao) return;

        const sale = importSalesData.find(s => String(getCol(s, "código", "codigo", "transação", "transacao", "tid") || "").trim() === transacao);
        if (!sale) return;

        const clientName = String(getCol(sale, "nome do cliente", "cliente", "nome") || "").trim();
        const valorBruto = parseMoney(getCol(settle, "valor bruto", "valor"));
        const valorLiquido = parseMoney(getCol(settle, "valor liquido", "valor líquido", "valor"));
        const bandeira = getCol(settle, "bandeira", "marca") || "";
        const mdr = getCol(settle, "mdr", "taxa") || "";

        if (!clientName) return;

        const normalize = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const normalizedClient = normalize(clientName);
        const nameParts = normalizedClient.split(" ").filter((p: string) => p.length > 2);

        const matchedTx = filteredReceivables.find(tx => {
          if (newSelected.has(tx.id)) return false;
          if (Math.abs(tx.amount - valorBruto) > 0.01) return false;
          
          const desc = normalize(tx.description || "");
          if (normalizedClient.includes("avulso") || normalizedClient.includes("cortesia")) {
            return desc.includes("avulso") || desc.includes("cortesia");
          }
          if (nameParts.length > 0) {
             const first = nameParts[0];
             const last = nameParts[nameParts.length - 1];
             return desc.includes(first) || desc.includes(last);
          }
          return false;
        });

        if (matchedTx) {
          newSelected.add(matchedTx.id);
          newMatchedMap[matchedTx.id] = {
             codigo: transacao,
             bandeira: String(bandeira),
             mdr: String(mdr),
             valorBruto,
             valorLiquido
          };
          matchCount++;
        }
      });

      setSelectedIds(newSelected);
      setMatchedImportData(newMatchedMap);
      setIsImportModalOpen(false);

      if (matchCount > 0) {
        alert(`${matchCount} recebimentos cruzados e selecionados com sucesso!`);
      } else {
        alert("Nenhuma transação correspondente encontrada entre os arquivos e os registros pendentes.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro ao processar: " + err.message);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
      const newMap = { ...matchedImportData };
      delete newMap[id];
      setMatchedImportData(newMap);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredReceivables.length) {
      setSelectedIds(new Set());
      setMatchedImportData({});
    } else {
      setSelectedIds(new Set(filteredReceivables.map(t => t.id)));
    }
  };

  const selectedTotals = useMemo(() => {
    return Array.from(selectedIds).reduce((acc, id) => {
      const tx = receivables.find(t => t.id === id);
      const match = matchedImportData[id];
      const bruto = tx?.amount || 0;
      let mdrValue = 0;
      let liquido = bruto;

      if (match) {
        liquido = match.valorLiquido;
        mdrValue = bruto - liquido;
      } else {
        mdrValue = mdrFeePercent > 0 ? (bruto * (mdrFeePercent / 100)) : 0;
        liquido = bruto - mdrValue;
      }

      return {
         bruto: acc.bruto + bruto,
         mdr: acc.mdr + mdrValue,
         liquido: acc.liquido + liquido
      };
    }, { bruto: 0, mdr: 0, liquido: 0 });
  }, [selectedIds, receivables, matchedImportData, mdrFeePercent]);

  const handleBatchConciliate = async () => {
    for (const id of Array.from(selectedIds)) {
      const tx = receivables.find(t => t.id === id);
      if (!tx) continue;
      
      const match = matchedImportData[id];
      let finalAmount = tx.amount;
      let desc = tx.description;

      if (match) {
         finalAmount = match.valorLiquido;
         desc = `${tx.description} (Ref: ${match.codigo} | ${match.bandeira} | Taxa: ${match.mdr})`;
      } else {
         const feeMultiplier = 1 - (mdrFeePercent / 100);
         finalAmount = mdrFeePercent > 0 ? Number((tx.amount * feeMultiplier).toFixed(2)) : tx.amount;
         desc = mdrFeePercent > 0 ? `${tx.description} (Taxa MDR ${mdrFeePercent}%)` : tx.description;
      }
      
      const updatedTx = {
        ...tx,
        status: 'RECEBIDO' as const,
        date: settlementDate,
        amount: finalAmount,
        description: desc
      };
      
      // @ts-ignore
      await updateTransaction(updatedTx);
    }
    
    setSelectedIds(new Set());
    setMatchedImportData({});
    setIsModalOpen(false);
    alert(`${selectedIds.size} recebimentos foram conciliados com sucesso!`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-500" />
            Conciliação de Recebimentos
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Baixa manual e cruzamento de relatórios
          </p>
        </div>
        
        <div className="flex gap-3 items-center">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2 text-sm font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importar Relatórios
          </button>
          
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2">
             <Filter className="w-4 h-4 text-gray-500" />
             <select 
               value={filterMethod}
               onChange={e => setFilterMethod(e.target.value)}
               className="bg-transparent text-sm font-bold text-gray-700 dark:text-zinc-300 outline-none"
             >
                <option value="ALL">Todos os Métodos</option>
                <option value="PIX">Pix / Transferência</option>
                <option value="CARTAO">Cartões (Débito/Crédito)</option>
                <option value="DINHEIRO">Dinheiro (Espécie)</option>
                <option value="ASSINATURA">Assinaturas</option>
             </select>
          </div>
          
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={selectedIds.size === 0}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-sm"
          >
            <CheckSquare className="w-4 h-4" />
            Conciliar Lote ({selectedIds.size})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-gray-200 dark:border-zinc-800">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
              <th className="p-3 w-10 text-center">
                <button onClick={selectAll} className="text-gray-400 hover:text-emerald-500">
                  {selectedIds.size === filteredReceivables.length && filteredReceivables.length > 0 ? (
                    <CheckSquare className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>
              </th>
              <th className="p-3 text-xs font-black text-gray-500 dark:text-zinc-400 uppercase">Previsão</th>
              <th className="p-3 text-xs font-black text-gray-500 dark:text-zinc-400 uppercase">Descrição</th>
              <th className="p-3 text-xs font-black text-gray-500 dark:text-zinc-400 uppercase">Código/Ref</th>
              <th className="p-3 text-xs font-black text-gray-500 dark:text-zinc-400 uppercase">Bandeira</th>
              <th className="p-3 text-xs font-black text-gray-500 dark:text-zinc-400 uppercase text-right">Valor Bruto</th>
              <th className="p-3 text-xs font-black text-gray-500 dark:text-zinc-400 uppercase text-right">MDR</th>
              <th className="p-3 text-xs font-black text-gray-500 dark:text-zinc-400 uppercase text-right">Valor Líquido</th>
            </tr>
          </thead>
          <tbody>
            {filteredReceivables.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500 dark:text-zinc-400">
                  Nenhuma conta a receber pendente neste filtro.
                </td>
              </tr>
            ) : (
              filteredReceivables.map(tx => {
                const isSelected = selectedIds.has(tx.id);
                const txDate = tx.dueDate || tx.date;
                const match = matchedImportData[tx.id];

                return (
                  <tr 
                    key={tx.id} 
                    onClick={() => toggleSelect(tx.id)}
                    className={`border-b border-gray-100 dark:border-zinc-800 cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'}`}
                  >
                    <td className="p-3 text-center">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-emerald-500 mx-auto" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-300 dark:text-zinc-600 mx-auto" />
                      )}
                    </td>
                    <td className="p-3 text-sm font-medium text-gray-900 dark:text-zinc-300">
                      {txDate.split('-').reverse().join('/')}
                    </td>
                    <td className="p-3 text-sm text-gray-900 dark:text-white font-bold">
                      {tx.description}
                      <div className="text-[10px] text-gray-500 uppercase mt-0.5">{tx.category || tx.classification || 'Geral'}</div>
                    </td>
                    <td className="p-3 text-sm font-medium text-gray-600 dark:text-zinc-400">
                      {match ? <span className="font-bold text-gray-900 dark:text-white">{match.codigo}</span> : "-"}
                    </td>
                    <td className="p-3 text-sm font-medium text-gray-600 dark:text-zinc-400">
                      {match ? <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded text-xs">{match.bandeira || 'N/A'}</span> : "-"}
                    </td>
                    <td className="p-3 text-sm font-medium text-gray-600 dark:text-zinc-400 text-right">
                      {tx.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="p-3 text-sm font-medium text-red-500 text-right">
                      {match ? match.mdr : "-"}
                    </td>
                    <td className="p-3 text-sm font-black text-emerald-600 dark:text-emerald-400 text-right">
                      {match ? match.valorLiquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {selectedIds.size > 0 && (
            <tfoot>
              <tr className="bg-emerald-50 dark:bg-emerald-900/20 border-t-2 border-emerald-200 dark:border-emerald-800">
                <td colSpan={5} className="p-4 text-right text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  Total Selecionado ({selectedIds.size} itens):
                </td>
                <td className="p-4 text-right text-sm font-bold text-gray-600 dark:text-zinc-400">
                  {selectedTotals.bruto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="p-4 text-right text-sm font-bold text-red-500">
                  -{selectedTotals.mdr.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="p-4 text-right text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {selectedTotals.liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 bg-blue-600 text-white">
              <h3 className="text-xl font-black flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6" />
                Cruzar Relatórios
              </h3>
              <p className="text-blue-100 text-sm mt-1">Importe os dois relatórios para o sistema identificar Nome, Código, MDR e Valores Líquidos automaticamente.</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-4 border border-dashed border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl">
                 <h4 className="font-bold text-sm text-blue-900 dark:text-blue-100 mb-2">1. Relatório de Vendas (cel_payments)</h4>
                 <p className="text-xs text-blue-700 dark:text-blue-300 mb-4">Deve conter as colunas "Código" e "Nome do cliente".</p>
                 <input type="file" accept=".csv, text/csv, application/csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" ref={salesFileInputRef} onChange={handleSalesFileUpload} className="hidden" />
                 <button onClick={() => salesFileInputRef.current?.click()} className="w-full py-2 bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-bold text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                   <Upload className="w-4 h-4" />
                   {importSalesData.length > 0 ? `Carregado (${importSalesData.length} itens)` : "Subir Arquivo"}
                 </button>
              </div>

              <div className="p-4 border border-dashed border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl">
                 <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-100 mb-2">2. Relatório de Liquidações</h4>
                 <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-4">Deve conter as colunas "Transação", "Bandeira", "MDR" e "Valor".</p>
                 <input type="file" accept=".csv, text/csv, application/csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" ref={settlementFileInputRef} onChange={handleSettlementFileUpload} className="hidden" />
                 <button onClick={() => settlementFileInputRef.current?.click()} className="w-full py-2 bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 font-bold text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                   <Upload className="w-4 h-4" />
                   {importSettlementData.length > 0 ? `Carregado (${importSettlementData.length} itens)` : "Subir Arquivo"}
                 </button>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-zinc-800 flex gap-3 bg-gray-50/50 dark:bg-zinc-800/30">
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl font-bold text-gray-700 dark:text-zinc-300 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={processCrossMatch}
                disabled={importSalesData.length === 0 || importSettlementData.length === 0}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl font-black text-sm transition-colors"
              >
                Cruzar Dados
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800 bg-emerald-500 text-white">
              <h3 className="text-xl font-black flex items-center gap-2">
                <Download className="w-6 h-6" />
                Confirmar Liquidação
              </h3>
              <p className="text-emerald-100 text-sm mt-1">Valide os dados finais antes de baixar o lote</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">
                  Data Efetiva do Crédito
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={settlementDate}
                    onChange={e => setSettlementDate(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 font-bold text-sm"
                  />
                </div>
              </div>

              {Object.keys(matchedImportData).length === 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase mb-1">
                    Taxa Global (Se Aplicável) %
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={mdrFeePercent}
                      onChange={e => setMdrFeePercent(Number(e.target.value))}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 font-bold text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">Usado apenas para transações não importadas por relatório.</p>
                </div>
              )}

              <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl border border-gray-200 dark:border-zinc-700 mt-4">
                 <div className="flex justify-between text-sm mb-1">
                   <span className="text-gray-500">Valor Bruto Total:</span>
                   <span className="font-bold">{selectedTotals.bruto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                 </div>
                 <div className="flex justify-between text-sm mb-1 text-red-500">
                   <span>Taxas MDR Retidas:</span>
                   <span className="font-bold">-{selectedTotals.mdr.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                 </div>
                 <div className="flex justify-between text-lg mt-2 pt-2 border-t border-gray-200 dark:border-zinc-700">
                   <span className="font-black text-gray-900 dark:text-white">Crédito Líquido Final:</span>
                   <span className="font-black text-emerald-600 dark:text-emerald-400">
                     {selectedTotals.liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                   </span>
                 </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-zinc-800 flex gap-3 bg-gray-50/50 dark:bg-zinc-800/30">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl font-bold text-gray-700 dark:text-zinc-300 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleBatchConciliate}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm transition-colors shadow-lg shadow-emerald-600/20"
              >
                Baixar Lote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
