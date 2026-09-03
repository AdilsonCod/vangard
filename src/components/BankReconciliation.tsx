import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { UploadCloud, FileText, CheckCircle, PlusCircle, Trash2, Link as LinkIcon, X, Wand2 } from 'lucide-react';
import { useStore } from '../store';
import { FinancialTransaction } from '../types';

interface ParsedTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  description: string;
  type: 'INCOME' | 'EXPENSE';
}

export function BankReconciliation() {
  const { financialCategories, suppliers, finClassifications, finSubclassifications, transactions, addTransaction, updateTransaction } = useStore();
  const [matchingTx, setMatchingTx] = useState<ParsedTransaction | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  
  const loadDemoData = () => {
    const demoTxs: ParsedTransaction[] = [
      { id: 'demo_1', date: new Date().toISOString().split('T')[0], amount: 150.00, description: 'PGTO FORNECEDOR', type: 'EXPENSE' },
      { id: 'demo_2', date: new Date().toISOString().split('T')[0], amount: 1200.50, description: 'RECEBIMENTO PIX', type: 'INCOME' },
      { id: 'demo_3', date: new Date().toISOString().split('T')[0], amount: 89.90, description: 'CONTA DE LUZ', type: 'EXPENSE' },
    ];
    setParsedTransactions(demoTxs);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (file.name.toLowerCase().endsWith('.ofx')) {
        parseOFX(content);
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        parseCSV(content);
      } else {
        setError('Formato de arquivo não suportado. Use .OFX ou .CSV');
      }
    };
    reader.onerror = () => {
      setError('Erro ao ler o arquivo.');
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseOFX = (content: string) => {
    try {
      const matches = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g);
      if (!matches) {
        setError('Nenhuma transação encontrada no arquivo OFX.');
        return;
      }

      const txs: ParsedTransaction[] = matches.map((stmt, idx) => {
        const typeMatch = stmt.match(/<TRNTYPE>(.+)/);
        const amtMatch = stmt.match(/<TRNAMT>(.+)/);
        const dateMatch = stmt.match(/<DTPOSTED>(\d{8})/);
        const memoMatch = stmt.match(/<MEMO>(.+)/);

        let amount = 0;
        if (amtMatch) amount = parseFloat(amtMatch[1].replace(',', '.'));
        
        let date = new Date().toISOString().split('T')[0];
        if (dateMatch) {
          const dStr = dateMatch[1];
          date = `${dStr.substring(0,4)}-${dStr.substring(4,6)}-${dStr.substring(6,8)}`;
        }

        const type = amount >= 0 ? 'INCOME' : 'EXPENSE';
        const desc = memoMatch ? memoMatch[1].trim() : 'Transação Importada';

        return {
          id: `ofx_${Date.now()}_${idx}`,
          date,
          amount: Math.abs(amount),
          description: desc,
          type
        };
      });
      
      setParsedTransactions(prev => [...prev, ...txs]);
    } catch (err) {
      setError('Erro ao processar arquivo OFX.');
    }
  };

  const parseCSV = (content: string) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const txs: ParsedTransaction[] = [];
          results.data.forEach((row: any, idx) => {
            const keys = Object.keys(row);
            const dateKey = keys.find(k => k.toLowerCase().includes('data') || k.toLowerCase().includes('date'));
            const descKey = keys.find(k => k.toLowerCase().includes('desc') || k.toLowerCase().includes('hist'));
            const valKey = keys.find(k => k.toLowerCase().includes('valor') || k.toLowerCase().includes('amount') || k.toLowerCase().includes('value'));

            if (!dateKey || !valKey) return; 

            let dateVal = String(row[dateKey]).trim();
            if (dateVal.includes('/')) {
              const parts = dateVal.split('/');
              if (parts.length === 3) {
                if (parts[2].length === 4) {
                   dateVal = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
              }
            }

            let valStr = String(row[valKey]).replace(/[R$\s]/g, '').trim();
            if (valStr.includes(',') && valStr.includes('.')) {
              valStr = valStr.replace('.', '').replace(',', '.');
            } else if (valStr.includes(',')) {
              valStr = valStr.replace(',', '.');
            }
            let amount = parseFloat(valStr);
            if (isNaN(amount)) return;

            const type = amount >= 0 ? 'INCOME' : 'EXPENSE';
            const desc = descKey ? row[descKey] : 'Transação Importada';

            txs.push({
              id: `csv_${Date.now()}_${idx}`,
              date: dateVal,
              amount: Math.abs(amount),
              description: desc,
              type
            });
          });
          
          if (txs.length === 0) {
            setError('Não foi possível identificar colunas de Data e Valor no CSV.');
          } else {
            setParsedTransactions(prev => [...prev, ...txs]);
          }
        } catch (err) {
          setError('Erro ao processar arquivo CSV.');
        }
      },
      error: () => {
        setError('Erro ao ler CSV.');
      }
    });
  };

  const handleImport = async (tx: ParsedTransaction) => {
    if (!selectedAccount) {
      alert('Selecione uma conta (Banco/Caixa) de destino antes de importar.');
      return;
    }
    
    const newTx: FinancialTransaction = {
      id: `import_${Date.now()}_${tx.id}`,
      type: tx.type,
      category: selectedAccount,
      description: tx.description,
      amount: tx.amount,
      date: tx.date,
      dueDate: tx.date,
      unitId: 'ALL',
      status: 'PAGO',
      recurrence: 'NONE'
    };

    await addTransaction(newTx);
    setImportedIds(prev => new Set(prev).add(tx.id));
  };

  const handleMatch = async (parsed: ParsedTransaction, systemTxId: string) => {
    const existing = transactions.find(t => t.id === systemTxId);
    if (!existing) return;
    
    // Update the existing transaction
    const updatedTx = {
      ...existing,
      status: existing.type === 'INCOME' ? 'RECEBIDO' : 'PAGO',
      date: parsed.date,
      amount: parsed.amount,
      description: `${existing.description} (Conciliado)`
    };
    
    // @ts-ignore
    await updateTransaction(updatedTx);
    setImportedIds(prev => new Set(prev).add(parsed.id));
    setMatchingTx(null);
  };
  
  const handleAutoConciliate = async () => {
    let matchCount = 0;
    const newImportedIds = new Set(importedIds);

    for (const parsed of parsedTransactions) {
      if (newImportedIds.has(parsed.id)) continue;

      const parsedDate = new Date(parsed.date).getTime();
      
      const candidates = transactions.filter(t => 
        t.type === parsed.type &&
        (t.status === 'PENDENTE' || t.status === 'AGENDADO') &&
        Math.abs(t.amount - parsed.amount) < 0.05
      );

      const validCandidates = candidates.filter(t => {
        const targetDate = t.dueDate || t.date;
        if (!targetDate) return false;
        const tDate = new Date(targetDate).getTime();
        const diffDays = Math.abs(tDate - parsedDate) / (1000 * 3600 * 24);
        return diffDays <= 5;
      });

      if (validCandidates.length === 1) {
        const match = validCandidates[0];
        const updatedTx = {
          ...match,
          status: match.type === 'INCOME' ? 'RECEBIDO' : 'PAGO',
          date: parsed.date,
          amount: parsed.amount,
          description: `${match.description} (Auto-Conciliado)`
        };
        
        // @ts-ignore
        await updateTransaction(updatedTx);
        newImportedIds.add(parsed.id);
        matchCount++;
      }
    }

    setImportedIds(newImportedIds);
    if (matchCount > 0) {
      alert(`${matchCount} transações foram conciliadas automaticamente!`);
    } else {
      alert('Nenhuma conciliação automática exata (1:1) foi encontrada.');
    }
  };

  const removeParsed = (id: string) => {
    setParsedTransactions(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white">Conciliação Bancária</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Importe arquivos .OFX ou .CSV do seu banco</p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            className="border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl p-2.5 text-sm font-bold shadow-sm"
          >
            <option value="">-- Selecione a Conta de Destino --</option>
            {financialCategories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          <input 
            type="file" 
            accept=".ofx,.csv,text/csv,application/csv,text/plain" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />
          {parsedTransactions.length > 0 && Array.from(importedIds).length < parsedTransactions.length && (
            <button 
              onClick={handleAutoConciliate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-sm"
              title="Conciliar Automaticamente correspondências exatas"
            >
              <Wand2 className="w-4 h-4" />
              Auto-Conciliar
            </button>
          )}
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-sm"
          >
            <UploadCloud className="w-4 h-4" />
            Subir Arquivo
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 text-sm font-bold">
          {error}
        </div>
      )}

      {parsedTransactions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-zinc-500 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-2xl p-10">
          <FileText className="w-16 h-16 mb-4 opacity-50" />
          <p className="font-bold">Nenhum extrato importado</p>
          <p className="text-sm text-center max-w-md mt-2">Faça upload de um arquivo OFX/CSV para começar a conciliação.<br/><br/>O sistema irá comparar automaticamente as contas do seu extrato bancário com as Contas a Pagar/Receber pendentes no sistema.</p>
          <button 
            onClick={loadDemoData}
            className="mt-6 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-bold rounded-lg text-sm transition-colors"
          >
            Carregar Extrato de Teste
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-auto rounded-xl border border-gray-200 dark:border-zinc-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
                <th className="p-3 text-xs font-black text-gray-500 dark:text-zinc-400 uppercase">Data</th>
                <th className="p-3 text-xs font-black text-gray-500 dark:text-zinc-400 uppercase">Descrição</th>
                <th className="p-3 text-xs font-black text-gray-500 dark:text-zinc-400 uppercase text-right">Valor</th>
                <th className="p-3 text-xs font-black text-gray-500 dark:text-zinc-400 uppercase text-center">Status</th>
                <th className="p-3 text-xs font-black text-gray-500 dark:text-zinc-400 uppercase text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {parsedTransactions.map(tx => {
                const isImported = importedIds.has(tx.id);
                return (
                  <tr key={tx.id} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="p-3 text-sm font-medium text-gray-900 dark:text-zinc-300">
                      {tx.date.split('-').reverse().join('/')}
                    </td>
                    <td className="p-3 text-sm text-gray-600 dark:text-zinc-400">
                      {tx.description}
                    </td>
                    <td className={`p-3 text-sm font-black text-right ${tx.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'} {tx.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="p-3 text-center">
                      {isImported ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 uppercase font-bold">
                          <CheckCircle className="w-3 h-3" />
                          Importado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 uppercase font-bold">
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        {!isImported && (
                          <>
                          <button 
                            onClick={() => handleImport(tx)}
                            className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/50 rounded-lg transition-colors"
                            title="Criar Novo Lançamento"
                          >
                            <PlusCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setMatchingTx(tx)}
                            className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 rounded-lg transition-colors"
                            title="Vincular a Conta (Pagar/Receber)"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </button>
                          </>
                        )}
                        <button 
                          onClick={() => removeParsed(tx.id)}
                          className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/50 rounded-lg transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* MATCHING MODAL */}
      {matchingTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-800/30 rounded-t-3xl">
                 <div>
                   <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                     <LinkIcon className="w-6 h-6 text-emerald-500" />
                     Conciliar com {matchingTx.type === 'INCOME' ? 'Contas a Receber' : 'Contas a Pagar'}
                   </h3>
                   <p className="text-sm text-gray-500 dark:text-zinc-400 font-medium mt-1">
                     Extrato: {matchingTx.date.split('-').reverse().join('/')} - {matchingTx.description} - {matchingTx.amount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                   </p>
                 </div>
                 <button 
                   onClick={() => setMatchingTx(null)}
                   className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full text-gray-500 transition-colors"
                 >
                    <X className="w-5 h-5" />
                 </button>
              </div>
              <div className="p-6 overflow-y-auto">
                 {(() => {
                    const candidates = transactions.filter(t => 
                      t.type === matchingTx.type && 
                      (t.status === 'PENDENTE' || t.status === 'AGENDADO')
                    );
                    
                    if (candidates.length === 0) {
                      return (
                        <div className="text-center py-10 text-gray-500 dark:text-zinc-400">
                          <p className="font-bold">Nenhuma conta encontrada</p>
                          <p className="text-sm mt-1">Não há contas {matchingTx.type === 'INCOME' ? 'a receber' : 'a pagar'} pendentes ou agendadas no sistema.</p>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-3">
                        {candidates.map(t => (
                          <div key={t.id} className="border border-gray-200 dark:border-zinc-700 rounded-xl p-4 flex items-center justify-between hover:border-emerald-500 transition-colors">
                            <div>
                               <p className="font-bold text-gray-900 dark:text-white text-sm">{t.description}</p>
                               <div className="flex gap-3 text-xs text-gray-500 mt-1">
                                 <span>Vencimento: {t.dueDate ? t.dueDate.split('-').reverse().join('/') : t.date.split('-').reverse().join('/')}</span>
                                 <span>Categoria: {t.category}</span>
                               </div>
                            </div>
                            <div className="flex items-center gap-4">
                               <p className={`font-black ${t.type === 'INCOME' ? 'text-emerald-500' : 'text-red-500'}`}>
                                 {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                               </p>
                               <button
                                 onClick={() => handleMatch(matchingTx, t.id)}
                                 className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-800/50 rounded-lg font-bold text-xs transition-colors"
                               >
                                 Vincular
                               </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                 })()}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}