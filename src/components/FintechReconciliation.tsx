import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  Calendar, 
  Download, 
  Play, 
  Sparkles, 
  Trash2, 
  FileCode, 
  ChevronRight, 
  ChevronDown, 
  ShieldCheck, 
  Layers, 
  PieChart as PieIcon,
  HelpCircle,
  Copy,
  Check,
  Save,
  Database,
  MapPin,
  Wallet,
  Banknote,
  ArrowRightLeft,
  Filter
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import * as XLSX from 'xlsx';
import { collection, doc, getDocs, query, setDoc } from 'firebase/firestore';
import { useStore } from '../store';
import { db } from '../firebase';
import { 
  PDVMovimentacao, 
  GatewayClubeTransacao, 
  AdquirenteRedePagamento, 
  AdquirenteRedeRecebido, 
  PrevisaoRecebivel, 
  ConciliationItem, 
  DailyClosing, 
  ReconciliationKPIs,
  BatchConciliationItem,
  EntradaManual,
  FormaPagamentoComparison,
  TotaisComparativoFormasPgto,
  ResumoLotesCartao,
  StatusDivergencia
} from '../types/reconciliation';
import { 
  parsePDVFile, 
  parseGatewayClubeFile, 
  parseRedeFile, 
  parsePrevisaoFile, 
  runReconciliationEngine, 
  getBarbeariaDemoData 
} from '../utils/reconciliationEngine';
import { buildSettlementTransactionId, isSettlementEligible } from '../utils/reconciliationSettlement';
import { formatFinancialPeriod, getLatestFinancialPeriod } from '../utils/financialPeriods';

type FintechReconciliationProps = {
  onSettlementComplete?: (dates: string[]) => void;
};

export function FintechReconciliation({ onSettlementComplete }: FintechReconciliationProps) {
  const { addTransaction, currentUser } = useStore();

  // Estados dos arquivos brutos carregados
  const [pdvData, setPdvData] = useState<PDVMovimentacao[]>([]);
  const [clubeData, setClubeData] = useState<GatewayClubeTransacao[]>([]);
  const [redePagamentos, setRedePagamentos] = useState<AdquirenteRedePagamento[]>([]);
  const [redeRecebidos, setRedeRecebidos] = useState<AdquirenteRedeRecebido[]>([]);
  const [previsaoData, setPrevisaoData] = useState<PrevisaoRecebivel[]>([]);
  const [entradasManuaisData, setEntradasManuaisData] = useState<EntradaManual[]>([]);

  // Nomes dos arquivos carregados
  const [fileNames, setFileNames] = useState<{
    pdv?: string;
    clube?: string;
    rede?: string;
    previsao?: string;
  }>({});

  // Resultados processados pelo motor
  const [items, setItems] = useState<ConciliationItem[]>([]);
  const [batches, setBatches] = useState<BatchConciliationItem[]>([]);
  const [resumoLotesCartao, setResumoLotesCartao] = useState<ResumoLotesCartao | null>(null);
  const [dailyClosings, setDailyClosings] = useState<DailyClosing[]>([]);
  const [comparativoFormasPgto, setComparativoFormasPgto] = useState<TotaisComparativoFormasPgto | null>(null);
  const [redeResumoInfo, setRedeResumoInfo] = useState<any | null>(null);
  const [showOnlySaldosNaoAdquirente, setShowOnlySaldosNaoAdquirente] = useState<boolean>(false);
  const [selectedBatchModalidade, setSelectedBatchModalidade] = useState<string>('TODAS');
  const [selectedBatchStatus, setSelectedBatchStatus] = useState<string>('TODOS');

  const [isSaving, setIsSaving] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // New States for Bulk Audit Actions
  const [selectedAuditRows, setSelectedAuditRows] = useState<Set<string>>(new Set());
  const [bulkAuditStatus, setBulkAuditStatus] = useState<StatusDivergencia | ''>('');
  const [selectedUnidade, setSelectedUnidade] = useState<string>('Sudoeste');

  const [kpis, setKpis] = useState<ReconciliationKPIs>({
    saldoRealEmConta: 0,
    totalFaturadoPDV: 0,
    totalAprovadoAdquirente: 0,
    previsaoEntradasD30: 0,
    totalDivergenciasValor: 0,
    totalDivergenciasCount: 0,
    totalTaxasMdrRetidas: 0,
  });
  const [cashFlowTimeline, setCashFlowTimeline] = useState<
    { data: string; realizado: number; projetado: number; taxas: number }[]
  >([]);

  // Navegação de visualização
  const [activeTab, setActiveTab] = useState<
    'FECHAMENTO' | 'REGRA_1' | 'REGRA_2' | 'DIVERGENCIAS' | 'PROJECAO' | 'CODIGO_BACKEND'
  >('FECHAMENTO');
  const [divergenceFilter, setDivergenceFilter] = useState<string>('TODAS');
  const [expandedDailyDates, setExpandedDailyDates] = useState<Set<string>>(new Set());
  const [copiedCodeTab, setCopiedCodeTab] = useState<string | null>(null);
  const [selectedItemsToSettle, setSelectedItemsToSettle] = useState<Set<string>>(new Set());
  const [settledItems, setSettledItems] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estados de Conciliação Manual
  const [isManualReconModalOpen, setIsManualReconModalOpen] = useState(false);
  const [manualReconItem, setManualReconItem] = useState<ConciliationItem | null>(null);
  const [manualReconLiquido, setManualReconLiquido] = useState<string>('');
  const [manualReconDate, setManualReconDate] = useState<string>('');
  const [manualReconJustification, setManualReconJustification] = useState<string>('');
  const [manualReconStatus, setManualReconStatus] = useState<ConciliationItem['status']>('CONCILIADO');

  // Refs para inputs de arquivos
  const pdvInputRef = useRef<HTMLInputElement>(null);
  const clubeInputRef = useRef<HTMLInputElement>(null);
  const redeInputRef = useRef<HTMLInputElement>(null);
  const previsaoInputRef = useRef<HTMLInputElement>(null);
  const hasAutoRestoredReportRef = useRef(false);

  // Toast temporário
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Carrega dados simulados de demonstração da Barbearia Vangard
  const handleLoadDemo = () => {
    setIsProcessing(true);
    const demo = getBarbeariaDemoData();
    setPdvData(demo.pdv);
    setClubeData(demo.clube);
    setRedePagamentos(demo.redePagamentos);
    setRedeRecebidos(demo.redeRecebidos);
    setPrevisaoData(demo.previsao);
    setEntradasManuaisData(demo.entradasManuais || []);
    setFileNames({
      pdv: 'Relatório20_Movimentacoes_Vangard.csv',
      clube: '71975-relatorio-transacoes-vansclub.csv',
      rede: 'Rede_Rel_Recebimentos_Agosto.xlsx',
      previsao: 'exportacao-relatorio-previsao-d31.xlsx',
    });

    // Roda conciliação imediatamente
    const result = runReconciliationEngine(
      demo.pdv,
      demo.clube,
      demo.redePagamentos,
      demo.redeRecebidos,
      demo.previsao,
      demo.entradasManuais || []
    );
    setItems(result.items);
    setCurrentSessionId(null);
    setDailyClosings(result.dailyClosings);
    setKpis(result.kpis);
    setCashFlowTimeline(result.cashFlowTimeline);
    if (result.batches) setBatches(result.batches);
    if (result.comparativoFormasPgto) setComparativoFormasPgto(result.comparativoFormasPgto);
    if (result.resumoLotesCartao) setResumoLotesCartao(result.resumoLotesCartao);
    setIsProcessing(false);
    showToast('Dados de demonstração da Barbearia Vangard carregados e conciliados!');
  };

  // Limpa tudo
  const handleClear = () => {
    setPdvData([]);
    setClubeData([]);
    setRedePagamentos([]);
    setRedeRecebidos([]);
    setPrevisaoData([]);
    setEntradasManuaisData([]);
    setFileNames({});
    setItems([]);
    setBatches([]);
    setResumoLotesCartao(null);
    setComparativoFormasPgto(null);
    setDailyClosings([]);
    setKpis({
      saldoRealEmConta: 0,
      totalFaturadoPDV: 0,
      totalAprovadoAdquirente: 0,
      previsaoEntradasD30: 0,
      totalDivergenciasValor: 0,
      totalDivergenciasCount: 0,
      totalTaxasMdrRetidas: 0,
    });
    setCashFlowTimeline([]);
    setSelectedItemsToSettle(new Set());
    setCurrentSessionId(null);
    showToast('Arquivos e conciliação limpos com sucesso.');
  };

  // Executa motor de conciliação com os dados atualmente carregados
  const handleRunReconciliation = () => {
    if (
      pdvData.length === 0 &&
      clubeData.length === 0 &&
      redePagamentos.length === 0 &&
      previsaoData.length === 0
    ) {
      showToast('Por favor, carregue ao menos um arquivo ou use os Dados de Exemplo.');
      return;
    }

    setIsProcessing(true);
    const result = runReconciliationEngine(
      pdvData,
      clubeData,
      redePagamentos,
      redeRecebidos,
      previsaoData,
      entradasManuaisData
    );
    setItems(result.items);
    setDailyClosings(result.dailyClosings);
    setKpis(result.kpis);
    setCashFlowTimeline(result.cashFlowTimeline);
    if (result.batches) setBatches(result.batches);
    if (result.comparativoFormasPgto) setComparativoFormasPgto(result.comparativoFormasPgto);
    if (result.resumoLotesCartao) setResumoLotesCartao(result.resumoLotesCartao);
    setIsProcessing(false);
    showToast(`Conciliação concluída: ${result.items.length} transações processadas.`);
  };

  // Upload Handlers
  const handlePdvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await parsePDVFile(file);
      setPdvData(data);
      setFileNames((prev) => ({ ...prev, pdv: file.name }));
      showToast(`PDV carregado com sucesso: ${data.length} movimentações.`);

      // Auto-executa a conciliação imediatamente
      const result = runReconciliationEngine(
        data,
        clubeData,
        redePagamentos,
        redeRecebidos,
        previsaoData,
        entradasManuaisData
      );
      setItems(result.items);
      setDailyClosings(result.dailyClosings);
      setKpis(result.kpis);
      setCashFlowTimeline(result.cashFlowTimeline);
      if (result.batches) setBatches(result.batches);
      if (result.comparativoFormasPgto) setComparativoFormasPgto(result.comparativoFormasPgto);
      if (result.resumoLotesCartao) setResumoLotesCartao(result.resumoLotesCartao);
    } catch (err: any) {
      alert('Erro ao processar arquivo de PDV: ' + err.message);
    }
  };

  const handleClubeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await parseGatewayClubeFile(file);
      setClubeData(data);
      setFileNames((prev) => ({ ...prev, clube: file.name }));
      showToast(`Gateway Clube carregado: ${data.length} transações.`);
      
      if (pdvData.length > 0 || redePagamentos.length > 0) {
        const result = runReconciliationEngine(
          pdvData,
          data,
          redePagamentos,
          redeRecebidos,
          previsaoData,
          entradasManuaisData
        );
        setItems(result.items);
        setDailyClosings(result.dailyClosings);
        setKpis(result.kpis);
        setCashFlowTimeline(result.cashFlowTimeline);
        if (result.batches) setBatches(result.batches);
        if (result.comparativoFormasPgto) setComparativoFormasPgto(result.comparativoFormasPgto);
        if (result.resumoLotesCartao) setResumoLotesCartao(result.resumoLotesCartao);
      }
    } catch (err: any) {
      alert('Erro ao processar arquivo do Clube: ' + err.message);
    }
  };

  const handleRedeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { pagamentos, recebidos, resumoInfo } = await parseRedeFile(file);
      setRedePagamentos(pagamentos);
      setRedeRecebidos(recebidos);
      setRedeResumoInfo(resumoInfo || null);
      setFileNames((prev) => ({ ...prev, rede: file.name }));

      if (resumoInfo?.isOnlyResumo) {
        const liqFmt = resumoInfo.liquidoRecebido
          ? resumoInfo.liquidoRecebido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : 'R$ 0,00';
        setKpis(prev => ({
          ...prev,
          saldoRealEmConta: resumoInfo.liquidoRecebido || 0,
        }));
        showToast(`Resumo da Rede reconhecido (líquido: ${liqFmt}). Este CSV não contém abas nem as parcelas; para conciliar, envie o XLSX completo ou o CSV da aba “Pagamentos”.`);
      } else if (pagamentos.length === 0) {
        // Debug: arquivo carregado mas nenhuma transação foi extraída
        showToast(`⚠️ Arquivo "${file.name}" carregado, mas nenhuma transação foi identificada. Verifique se o arquivo contém a aba "Pagamentos" com colunas de valor, data e modalidade.`);
      } else {
        const nomeAba = resumoInfo?.nomeAbaProcessada ? ` (Aba: ${resumoInfo.nomeAbaProcessada})` : '';
        showToast(`Adquirente Rede carregada: ${pagamentos.length} transações processadas${nomeAba}.`);
      }

      // Auto-executa a conciliação imediatamente
      if (pdvData.length > 0 || pagamentos.length > 0) {
        const result = runReconciliationEngine(
          pdvData,
          clubeData,
          pagamentos,
          recebidos,
          previsaoData,
          entradasManuaisData
        );
        setItems(result.items);
        setDailyClosings(result.dailyClosings);
        setKpis(result.kpis);
        setCashFlowTimeline(result.cashFlowTimeline);
        if (result.batches) setBatches(result.batches);
        if (result.comparativoFormasPgto) setComparativoFormasPgto(result.comparativoFormasPgto);
        if (result.resumoLotesCartao) setResumoLotesCartao(result.resumoLotesCartao);
      }
    } catch (err: any) {
      alert('Erro ao processar arquivo da Rede: ' + err.message);
    }
  };

  const handlePrevisaoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await parsePrevisaoFile(file);
      setPrevisaoData(data);
      setFileNames((prev) => ({ ...prev, previsao: file.name }));
      showToast(`Previsão D+31 carregada: ${data.length} recebíveis futuros.`);
    } catch (err: any) {
      alert('Erro ao processar arquivo de Previsão: ' + err.message);
    }
  };

  // Efetivar / Baixar no caixa da barbearia
  
  const handleSettleBatch = async (batchId: string) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch || settledItems.has(batch.id)) return;

    const unitId = currentUser?.unit || selectedUnidade || 'ALL';

    try {
      await addTransaction({
        id: buildSettlementTransactionId(unitId, batch.id),
        unitId,
        type: 'INCOME',
        category: 'Atendimentos Cartão (Lote)',
        description: `[Conciliação FinTech - Lote] ${batch.modalidade} - ${batch.dataVenda}`,
        amount: batch.totalRedeLiquido,
        date: batch.dataVenda,
        status: 'RECEBIDO',
        classification: 'RECEBIMENTO_OPERACIONAL',
      });

      const newSettled = new Set(settledItems);
      newSettled.add(batch.id);
      setSettledItems(newSettled);
      onSettlementComplete?.([batch.dataVenda]);
      const period = getLatestFinancialPeriod([{ date: batch.dataVenda }]);
      showToast(`Lote de ${batch.modalidade} efetivado no Caixa${period ? ` em ${formatFinancialPeriod(period)}` : ''}!`);
    } catch (error) {
      console.error('Erro ao efetivar lote no Caixa:', error);
      showToast('Erro ao efetivar o lote no Caixa. Tente novamente.');
    }
  };

  const handleSettleSelected = async () => {
    if (selectedItemsToSettle.size === 0) {
      showToast('Selecione ao menos um item conciliado para efetivar no fluxo de caixa.');
      return;
    }

    const selectedEligibleItems = items.filter(item =>
      selectedItemsToSettle.has(item.id) &&
      !settledItems.has(item.id) &&
      isSettlementEligible(item)
    );

    if (selectedEligibleItems.length === 0) {
      showToast('Os itens selecionados não estão aptos para efetivação ou já foram baixados.');
      return;
    }

    await processSettlement(selectedEligibleItems);
    setSelectedItemsToSettle(new Set());
  };

  const handleSettleAll = async () => {
    const conciliatedItems = items.filter(item =>
      isSettlementEligible(item) && !settledItems.has(item.id)
    );
    if (conciliatedItems.length === 0) {
      showToast('Nenhum recebimento confirmado novo para efetivar. Para guardar o relatório, use “Salvar Conciliação”.');
      return;
    }
    
    await processSettlement(conciliatedItems);
  };

  const handleSettleDailyBatch = async (date: string) => {
    const batchItems = items.filter(i => i.dataVenda === date);
    const itemsToSettle = batchItems.filter(item =>
      isSettlementEligible(item) && !settledItems.has(item.id)
    );

    if (itemsToSettle.length === 0) {
      showToast('Nenhum recebimento confirmado novo para efetivar neste lote.');
      return;
    }

    await processSettlement(itemsToSettle);
  };

  const processSettlement = async (itemsToProcess: ConciliationItem[]) => {
    const newSettled = new Set(settledItems);
    const unitId = currentUser?.unit || selectedUnidade || 'ALL';

    try {
      await Promise.all(itemsToProcess.map(async item => {
        const isExpense = item.valorLiquido < 0;

        await addTransaction({
          // ID determinístico: repetir a operação atualiza o mesmo documento
          // no Firestore em vez de duplicar o lançamento no Caixa.
          id: buildSettlementTransactionId(unitId, item.id),
          unitId,
          type: isExpense ? 'EXPENSE' : 'INCOME',
          category: isExpense ? 'Taxas e Estornos (MDR)' : 'Atendimentos Cartão',
          description: `[Conciliação FinTech] ${item.clienteOuDesc} - ${item.modalidadeOuPlano} (${item.identificador})`,
          amount: Math.abs(item.valorLiquido),
          date: item.dataLiquidacaoEfetiva || item.dataVenda,
          status: isExpense ? 'PAGO' : 'RECEBIDO',
          classification: isExpense ? 'DESPESA_OPERACIONAL' : 'RECEBIMENTO_OPERACIONAL',
        });
        newSettled.add(item.id);
      }));

      setSettledItems(newSettled);
      const settlementDates = itemsToProcess.map(item => item.dataLiquidacaoEfetiva || item.dataVenda);
      onSettlementComplete?.(settlementDates);
      const period = getLatestFinancialPeriod(settlementDates.map(date => ({ date })));
      showToast(`${itemsToProcess.length} transações efetivadas no Caixa${period ? ` em ${formatFinancialPeriod(period)}` : ''}!`);
    } catch (error) {
      console.error('Erro ao efetivar conciliação no Caixa:', error);
      showToast('Erro ao efetivar os recebimentos no Caixa. Nenhum item foi marcado como salvo.');
    }
  };

  const handleSaveSession = async () => {
    if (items.length === 0) {
      showToast('Nenhum dado para salvar. Execute a conciliação primeiro.');
      return;
    }
    
    const suggestedName = `Conciliação de ${new Date().toLocaleDateString('pt-BR')}`;
    const sessionName = prompt('Digite um nome para este Lote/Conciliação:', suggestedName);
    if (sessionName === null) return; // Usuário cancelou

    setIsSaving(true);
    try {
      const sessionId = currentSessionId || 'session_' + Date.now();
      const report = {
        id: sessionId,
        name: sessionName || suggestedName,
        updatedAt: new Date().toISOString(),
        unidade: selectedUnidade,
        items,
        batches,
        resumoLotesCartao,
        dailyClosings,
        kpis,
        comparativoFormasPgto,
        fileNames,
        redeResumoInfo,
        settledItems: Array.from(settledItems),
        ...(!currentSessionId && { createdAt: new Date().toISOString() }),
      };
      
      await setDoc(doc(db, 'reconciliation_reports', sessionId), report, { merge: true });
      setCurrentSessionId(sessionId);
      showToast('Relatório de conciliação salvo com sucesso no banco de dados!');
    } catch (error) {
      console.error(error);
      showToast('Erro ao salvar no Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFetchSessions = async () => {
    setShowSessionsModal(true);
    try {
      const q = query(collection(db, 'reconciliation_reports'));
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map(d => d.data());
      // Sort desc by createdAt
      fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSessions(fetched);
    } catch (error) {
      console.error(error);
      showToast('Erro ao buscar sessões do Firestore.');
    }
  };

  const handleLoadSession = (session: any, notify = true) => {
    setItems(session.items || []);
    if (session.unidade) setSelectedUnidade(session.unidade);
    setBatches(session.batches || []);
    if (session.resumoLotesCartao) setResumoLotesCartao(session.resumoLotesCartao);
    setDailyClosings(session.dailyClosings || []);
    if (session.comparativoFormasPgto) setComparativoFormasPgto(session.comparativoFormasPgto);
    setKpis(session.kpis || {
      totalBruto: 0,
      totalLiquido: 0,
      totalMdrRetido: 0,
      totalDepostosConfirmados: 0,
      totalDivergenciasCount: 0,
      taxaEfetivaGlobal: 0,
    });
    setFileNames(session.fileNames || {});
    setRedeResumoInfo(session.redeResumoInfo || null);
    setSettledItems(new Set(session.settledItems || []));
    setCurrentSessionId(session.id);
    setShowSessionsModal(false);
    if (notify) showToast('Relatório carregado com sucesso!');
  };

  useEffect(() => {
    if (!currentUser?.id || hasAutoRestoredReportRef.current || items.length > 0) return;
    hasAutoRestoredReportRef.current = true;

    let cancelled = false;
    const restoreLatestReport = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'reconciliation_reports')));
        const targetUnit = currentUser.unit || selectedUnidade;
        const reports = snapshot.docs
          .map(document => document.data())
          .filter(report => !targetUnit || !report.unidade || report.unidade === targetUnit)
          .sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return dateB - dateA;
          });

        if (!cancelled && reports[0]) {
          handleLoadSession(reports[0], false);
          showToast('Última conciliação salva restaurada automaticamente.');
        }
      } catch (error) {
        console.error('Erro ao restaurar a última conciliação:', error);
      }
    };

    restoreLatestReport();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, selectedUnidade]);

  const handleManualReconciliation = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    setManualReconItem(item);
    
    const suggestedLiquido = item.valorLiquido > 0 ? item.valorLiquido : item.valorBruto;
    setManualReconLiquido(suggestedLiquido.toString());
    
    const suggestedDate = item.dataLiquidacaoPrevista || item.dataVenda || new Date().toISOString().split('T')[0];
    setManualReconDate(suggestedDate);
    
    setManualReconJustification('');
    setManualReconStatus(item.status);
    setIsManualReconModalOpen(true);
  };

  const confirmManualReconciliation = () => {
    if (!manualReconItem) return;
    
    const liqVal = parseFloat(manualReconLiquido.replace(',', '.'));
    if (isNaN(liqVal)) {
      showToast('Valor líquido inválido.');
      return;
    }

    const newItems = items.map(item => {
      if (item.id === manualReconItem.id) {
        const bruto = item.valorBruto;
        const mdrRetido = bruto - liqVal;
        const taxaEfetiva = bruto > 0 ? (mdrRetido / bruto) * 100 : 0;
        
        return {
          ...item,
          valorLiquido: liqVal,
          valorMdrRetido: mdrRetido,
          mdrTaxaEfetiva: taxaEfetiva,
          dataLiquidacaoEfetiva: manualReconDate,
          status: manualReconStatus,
          statusDescricao: manualReconJustification ? `Modificado manualmente: ${manualReconJustification}` : 'Status modificado manualmente pelo usuário',
        };
      }
      return item;
    });
    setItems(newItems);
    setIsManualReconModalOpen(false);
    showToast('Conciliação manual aplicada com sucesso!');
  };

  // Funções de Bulk Action na Auditoria
  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>, filteredItems: ConciliationItem[]) => {
    if (e.target.checked) {
      const allIds = new Set(filteredItems.map(i => i.id));
      setSelectedAuditRows(allIds);
    } else {
      setSelectedAuditRows(new Set());
    }
  };

  const handleToggleSelectRow = (id: string) => {
    const newSet = new Set(selectedAuditRows);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedAuditRows(newSet);
  };

  const handleBulkStatusChange = () => {
    if (!bulkAuditStatus || selectedAuditRows.size === 0) return;
    
    const newItems = items.map(item => {
      if (selectedAuditRows.has(item.id)) {
        return {
          ...item,
          status: bulkAuditStatus,
          statusDescricao: `Status alterado em lote para ${bulkAuditStatus}`
        };
      }
      return item;
    });
    
    setItems(newItems);
    setSelectedAuditRows(new Set());
    setBulkAuditStatus('');
    showToast(`${selectedAuditRows.size} itens atualizados com sucesso!`);
  };

  const handleTratarEstorno = (itemId: string) => {
    const newItems = items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          valorBruto: 0,
          valorLiquido: -(item.valorMdrRetido || 0), // O líquido passa a ser apenas a taxa como despesa
          mdrTaxaEfetiva: 0,
          status: 'CONCILIADO', // Já coloca como conciliado para ser lançado no caixa como despesa
          statusDescricao: 'Estorno/Cancelamento tratado. Mantida apenas a taxa paga.'
        };
      }
      return item;
    });
    setItems(newItems);
    showToast('Estorno tratado com sucesso! Valor bruto zerado, restou apenas a taxa MDR.');
  };

  // Exportar Relatório Excel Consolidado
  const handleExportExcel = () => {
    if (items.length === 0) {
      showToast('Nenhum dado conciliado para exportar.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Aba 1: Resumo KPIs
    const kpiData = [
      { 'Métrica Financeira': 'Saldo Real em Conta', Valor: kpis.saldoRealEmConta },
      { 'Métrica Financeira': 'Total Faturado PDV', Valor: kpis.totalFaturadoPDV },
      { 'Métrica Financeira': 'Total Aprovado Adquirente', Valor: kpis.totalAprovadoAdquirente },
      { 'Métrica Financeira': 'Previsão de Entradas D+30 (Clube)', Valor: kpis.previsaoEntradasD30 },
      { 'Métrica Financeira': 'Total Retido em Taxas MDR', Valor: kpis.totalTaxasMdrRetidas },
      { 'Métrica Financeira': 'Total de Divergências (R$)', Valor: kpis.totalDivergenciasValor },
      { 'Métrica Financeira': 'Qtd de Transações com Divergência', Valor: kpis.totalDivergenciasCount },
    ];
    const wsKpi = XLSX.utils.json_to_sheet(kpiData);
    XLSX.utils.book_append_sheet(wb, wsKpi, 'KPIs_Financeiros');

    // Aba 2: Comparativo de Formas de Pagamento (PDV vs Adquirente)
    if (comparativoFormasPgto) {
      const comparativoRows = [
        ...comparativoFormasPgto.totaisPorForma.map((f) => ({
          'Forma de Pagamento': f.formaPgtoNome,
          'Total Faturado PDV (R$)': f.totalPdv,
          'Qtd Vendas PDV': f.qtdPdv,
          'Total Adquirente Bruto (R$)': f.totalAdquirenteBruto,
          'Qtd Transações Adquirente': f.qtdAdquirente,
          'Diferença Bruta (R$)': f.diferencaBruta,
          'MDR Retido (R$)': f.totalMdrRetido,
          'Taxa Média (%)': f.taxaMdrMedia,
          'Lote da Adquirente / Líquido (R$)': f.totalAdquirenteLiquido,
          'Status da Conciliação': f.status,
          'Diagnóstico / Detalhes': f.descricaoStatus,
        })),
        {
          'Forma de Pagamento': '--- TOTAL LOTES ADQUIRENTE (Crédito + Débito + Pix da Rede) ---',
          'Total Faturado PDV (R$)': comparativoFormasPgto.totalLotesAdquirente?.totalPdv ?? comparativoFormasPgto.subtotalCartoes.totalPdv,
          'Qtd Vendas PDV': comparativoFormasPgto.totalLotesAdquirente?.qtdPdv ?? comparativoFormasPgto.subtotalCartoes.qtdPdv,
          'Total Adquirente Bruto (R$)': comparativoFormasPgto.totalLotesAdquirente?.totalAdquirenteBruto ?? comparativoFormasPgto.subtotalCartoes.totalAdquirenteBruto,
          'Qtd Transações Adquirente': comparativoFormasPgto.totalLotesAdquirente?.qtdAdquirente ?? comparativoFormasPgto.subtotalCartoes.qtdAdquirente,
          'Diferença Bruta (R$)': comparativoFormasPgto.totalLotesAdquirente?.diferencaBruta ?? comparativoFormasPgto.subtotalCartoes.diferencaBruta,
          'MDR Retido (R$)': comparativoFormasPgto.totalLotesAdquirente?.totalMdrRetido ?? comparativoFormasPgto.subtotalCartoes.totalMdrRetido,
          'Taxa Média (%)': comparativoFormasPgto.totalLotesAdquirente?.taxaMdrMedia ?? comparativoFormasPgto.subtotalCartoes.taxaMdrMedia,
          'Lote da Adquirente / Líquido (R$)': comparativoFormasPgto.totalLotesAdquirente?.totalAdquirenteLiquido ?? comparativoFormasPgto.subtotalCartoes.totalAdquirenteLiquido,
          'Status da Conciliação': comparativoFormasPgto.totalLotesAdquirente?.status ?? comparativoFormasPgto.subtotalCartoes.status,
          'Diagnóstico / Detalhes': `Soma dos lotes da Rede: Crédito R$ ${(comparativoFormasPgto.totalLotesAdquirente?.totalCreditoRede || 0).toFixed(2)} + Débito R$ ${(comparativoFormasPgto.totalLotesAdquirente?.totalDebitoRede || 0).toFixed(2)} + Pix R$ ${(comparativoFormasPgto.totalLotesAdquirente?.totalPixRede || 0).toFixed(2)}`,
        },
        {
          'Forma de Pagamento': '--- TOTAL GERAL (Todas as Formas de Pgto) ---',
          'Total Faturado PDV (R$)': comparativoFormasPgto.totalGeral.totalPdv,
          'Qtd Vendas PDV': comparativoFormasPgto.totalGeral.qtdPdv,
          'Total Adquirente Bruto (R$)': comparativoFormasPgto.totalGeral.totalAdquirenteBruto,
          'Qtd Transações Adquirente': comparativoFormasPgto.totalGeral.qtdAdquirente,
          'Diferença Bruta (R$)': comparativoFormasPgto.totalGeral.diferencaBruta,
          'MDR Retido (R$)': comparativoFormasPgto.totalGeral.totalMdrRetido,
          'Taxa Média (%)': '-',
          'Lote da Adquirente / Líquido (R$)': comparativoFormasPgto.totalGeral.totalAdquirenteLiquido,
          'Status da Conciliação': '-',
          'Diagnóstico / Detalhes': `PDV soma todas as formas (R$ ${comparativoFormasPgto.totalGeral.totalPdv.toFixed(2)}) e Total Adquirente soma os lotes da Rede (Crédito R$ ${(comparativoFormasPgto.totalGeral.totalCreditoRede || 0).toFixed(2)} + Débito R$ ${(comparativoFormasPgto.totalGeral.totalDebitoRede || 0).toFixed(2)} + Pix R$ ${(comparativoFormasPgto.totalGeral.totalPixRede || 0).toFixed(2)})`,
        }
      ];
      const wsComp = XLSX.utils.json_to_sheet(comparativoRows);
      XLSX.utils.book_append_sheet(wb, wsComp, 'Comparativo_Formas_Pgto');
    }

    // Aba 3: Auditoria de Lotes Diários (PDV vs Rede)
    if (batches.length > 0) {
      const wsBatches = XLSX.utils.json_to_sheet(
        batches.map((b) => ({
          'Data da Venda': b.dataVenda,
          'Modalidade': b.modalidade,
          'Qtd Vendas PDV': b.qtdPdv,
          'Total Faturado PDV (R$)': b.totalPdv,
          'Qtd Vendas Rede': b.qtdRede,
          'Total Bruto Rede (R$)': b.totalRedeBruto,
          'Taxa MDR Descontada (R$)': b.totalTaxaMdr,
          'Taxa MDR Média (%)': b.taxaMdrMedia,
          'Lote da Adquirente / Líquido (R$)': b.totalRedeLiquido,
          'Diferença Bruta (R$)': b.diferencaBruta,
          'Status': b.status,
          'Diagnóstico / Investigação': b.diagnostico || (b.status === 'CONCILIADO' ? 'Lote 100% conciliado' : 'Divergência detectada')
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsBatches, 'Auditoria_Lotes_Diarios');
    }

    // Aba 3.1: Resumo Executivo Lotes de Cartão
    if (resumoLotesCartao) {
      const resumoData = [
        { 'Métrica': 'Total Faturado PDV (Cartões)', 'Valor': resumoLotesCartao.totalBrutoPdvCartao, 'Unidade / Obs': `${resumoLotesCartao.qtdVendasPdvCartao} transações` },
        { 'Métrica': 'Total Bruto Aprovado Rede', 'Valor': resumoLotesCartao.totalBrutoRedeCartao, 'Unidade / Obs': `${resumoLotesCartao.qtdVendasRedeCartao} transações` },
        { 'Métrica': 'Total Taxas MDR Retidas', 'Valor': resumoLotesCartao.totalTaxaMdrCartao, 'Unidade / Obs': `Taxa MDR Média: ${resumoLotesCartao.taxaMdrMediaPerc}%` },
        { 'Métrica': 'Total Líquido Rede a Receber', 'Valor': resumoLotesCartao.totalLiquidoRedeCartao, 'Unidade / Obs': 'Disponível / Agendado em conta' },
        { 'Métrica': 'Diferença Bruta Global (PDV - Rede)', 'Valor': resumoLotesCartao.diferencaBrutaGlobal, 'Unidade / Obs': Math.abs(resumoLotesCartao.diferencaBrutaGlobal) <= 0.01 ? '100% Conciliado' : 'Divergência Global' },
        { 'Métrica': 'Lotes 100% Conciliados', 'Valor': resumoLotesCartao.qtdLotesConciliados, 'Unidade / Obs': `De um total de ${resumoLotesCartao.qtdLotesTotal} lotes` },
        { 'Métrica': 'Lotes com Divergência', 'Valor': resumoLotesCartao.qtdLotesDivergentes, 'Unidade / Obs': 'Requerem auditoria operacional' },
      ];
      const wsResumo = XLSX.utils.json_to_sheet(resumoData);
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo_Executivo_Cartoes');
    }

    // Aba 4: Fechamento Diário
    const wsDaily = XLSX.utils.json_to_sheet(dailyClosings);
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Fechamento_Diario');

    // Aba 5: Todos os Itens Conciliados
    const wsItems = XLSX.utils.json_to_sheet(
      items.map((i) => ({
        Regra: i.regra,
        Data: i.dataVenda,
        Identificador: i.identificador,
        Cliente: i.clienteOuDesc,
        Modalidade: i.modalidadeOuPlano,
        Bandeira: i.bandeira || '-',
        'Valor Bruto (R$)': i.valorBruto,
        'MDR Retido (R$)': i.valorMdrRetido,
        'Lote da Adquirente / Valor Líquido (R$)': i.valorLiquido,
        'Taxa Efetiva (%)': i.mdrTaxaEfetiva,
        Status: i.status,
        Detalhes: i.statusDescricao,
        'Data Liquidação': i.dataLiquidacaoPrevista || i.dataLiquidacaoEfetiva || '-',
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsItems, 'Transacoes_Conciliadas');

    XLSX.writeFile(wb, `Conciliacao_Vangard_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Relatório Excel baixado com sucesso!');
  };

  // Toggle expansão de dia no fechamento
  const toggleExpandDate = (date: string) => {
    const next = new Set(expandedDailyDates);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    setExpandedDailyDates(next);
  };

  // Itens filtrados para a aba de divergências
  const filteredDivergences = useMemo(() => {
    return items.filter((item) => {
      if (item.status === 'CONCILIADO') return false;
      if (divergenceFilter === 'TODAS') return true;
      return item.status === divergenceFilter;
    });
  }, [items, divergenceFilter]);

  // Lotes filtrados para a aba de comparativo PDV vs Adquirente (Modalidades CREDITO e DEBITO)
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (selectedBatchModalidade !== 'TODAS') {
        const normBatch = b.modalidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        const normFilter = selectedBatchModalidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        if (normFilter === 'OUTROS') {
          if (['CREDITO', 'DEBITO', 'PIX', 'DINHEIRO', 'ASSINATURA'].includes(normBatch)) {
            return false;
          }
        } else if (normBatch !== normFilter) {
          return false;
        }
      }
      if (selectedBatchStatus === 'CONCILIADOS' && b.status !== 'CONCILIADO') {
        return false;
      }
      if (selectedBatchStatus === 'DIVERGENTES' && b.status !== 'DIVERGENTE') {
        return false;
      }
      if (selectedBatchStatus === 'NAO_INTERMEDIADOS' && !['PIX_CONTA_BANCARIA', 'CAIXA_FISICO', 'ASSINATURA_CLUBE', 'SALDO_NAO_INTERMEDIADO'].includes(b.status)) {
        return false;
      }
      return true;
    });
  }, [batches, selectedBatchModalidade, selectedBatchStatus]);

  // Copy code helper
  const copyToClipboard = (text: string, tabName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeTab(tabName);
    setTimeout(() => setCopiedCodeTab(null), 3000);
  };

  // Status Badge Component
  const renderStatusBadge = (status: string) => {
    switch (status) {

      case 'RECEBIDO_FORA_DO_GATEWAY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-300/40">
            <HelpCircle className="w-3.5 h-3.5" />
            Recebido Fora do Gateway
          </span>
        );
      case 'CONCILIADO_REDE':
      case 'CONCILIADO_PIX_BANCO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-300/40">
            <CheckCircle className="w-3.5 h-3.5" />
            {status === 'CONCILIADO_REDE' ? 'Conciliado Rede' : 'Baixa Banco (PIX)'}
          </span>
        );
      case 'ALERTA_GATEWAY_SEM_ENTRADA':
      case 'ALERTA_ENTRADA_SEM_GATEWAY':
      case 'NAO_ENCONTRADO_REDE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-300/40">
            <AlertTriangle className="w-3.5 h-3.5" />
            {status === 'NAO_ENCONTRADO_REDE' ? 'Não Encontrado Rede' : 'Falta Lançamento'}
          </span>
        );
      case 'CONCILIADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300/40">
            <CheckCircle className="w-3.5 h-3.5" />
            Conciliado
          </span>
        );
      case 'PENDENTE_LIQUIDACAO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300/40">
            <Clock className="w-3.5 h-3.5" />
            Pendente Liquidação (D+31)
          </span>
        );
      case 'DIVERGENCIA_TAXA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-300/40">
            <AlertTriangle className="w-3.5 h-3.5" />
            Divergência de Taxa MDR
          </span>
        );
      case 'NAO_AUTORIZADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-300/40">
            <XCircle className="w-3.5 h-3.5" />
            Não Autorizado no Gateway
          </span>
        );

      case 'DIVERGENTE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-300/40">
            <AlertTriangle className="w-3.5 h-3.5" />
            Divergência
          </span>
        );
      case 'PIX_CONTA_BANCARIA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-300/40">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Pix em Conta
          </span>
        );
      case 'CAIXA_FISICO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300/40">
            <Banknote className="w-3.5 h-3.5" />
            Caixa (Gaveta)
          </span>
        );
      case 'ASSINATURA_CLUBE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-300/40">
            <Sparkles className="w-3.5 h-3.5" />
            Clube VANS
          </span>
        );
      case 'SALDO_NAO_INTERMEDIADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-300/40">
            <Wallet className="w-3.5 h-3.5" />
            Fora Adquirente
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-300">
            {status}
          </span>
        );
    }
  };

  const renderFormaStatusBadge = (status: string) => {
    switch (status) {
      case 'CONCILIADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300/40">
            <CheckCircle className="w-3.5 h-3.5" />
            100% Conciliado
          </span>
        );
      case 'DIVERGENTE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-300/40">
            <AlertTriangle className="w-3.5 h-3.5" />
            Divergente
          </span>
        );
      case 'CAIXA_FISICO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300/40">
            <Banknote className="w-3.5 h-3.5" />
            Caixa Físico (Gaveta)
          </span>
        );
      case 'PIX_CONTA_BANCARIA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-300/40">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Pix em Conta Bancária
          </span>
        );
      case 'NAO_ENCONTRADO_ADQUIRENTE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-300/40">
            <AlertTriangle className="w-3.5 h-3.5" />
            Falta na Adquirente
          </span>
        );
      case 'NAO_ENCONTRADO_PDV':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-300/40">
            <AlertTriangle className="w-3.5 h-3.5" />
            Sobra na Adquirente
          </span>
        );
      case 'CORTESIA_BALCAO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-300/40">
            <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
            Cortesia / Bônus
          </span>
        );
      case 'SALDO_NAO_INTERMEDIADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-300/40">
            <Wallet className="w-3.5 h-3.5 text-indigo-600" />
            Saldo Não Intermediado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 border border-gray-700 dark:border-zinc-300 font-medium text-sm animate-in fade-in slide-in-from-bottom-4">
          <Sparkles className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header com Branding e Ações Rápidas */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-blue-600 text-white">
              FinTech Engine
            </span>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 font-semibold bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
              <MapPin className="w-3.5 h-3.5" />
              <select 
                value={selectedUnidade}
                onChange={e => setSelectedUnidade(e.target.value)}
                className="bg-transparent font-bold text-gray-700 dark:text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value="Sudoeste">Matriz Sudoeste</option>
                <option value="Águas Claras">Águas Claras</option>
                <option value="Asa Sul">Asa Sul</option>
                <option value="Asa Norte">Asa Norte</option>
                <option value="Guará">Guará</option>
              </select>
            </div>
          </div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Conciliação Financeira & Fluxo de Caixa Automatizado
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Ingestão de 4 fontes: PDV Balcão, Gateway de Assinaturas, Adquirente Rede e Previsão D+31.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleLoadDemo}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-sm flex items-center gap-2 transition"
          >
            <Sparkles className="w-4 h-4" />
            Dados de Exemplo (Simulação Vangard)
          </button>

          <button
            onClick={handleRunReconciliation}
            disabled={isProcessing}
            className="px-4 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 shadow-sm flex items-center gap-2 transition disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            Executar
          </button>
          <button
            onClick={handleSaveSession}
            disabled={isSaving || items.length === 0}
            className="px-4 py-2.5 bg-emerald-600 text-white font-bold text-sm rounded-xl hover:bg-emerald-700 shadow-sm flex items-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Salvando...' : 'Salvar Conciliação'}
          </button>
          <button
            onClick={handleFetchSessions}
            className="px-4 py-2.5 bg-zinc-800 text-white font-bold text-sm rounded-xl hover:bg-zinc-700 shadow-sm flex items-center gap-2 transition"
          >
            <Database className="w-4 h-4 text-blue-400" />
            Carregar Salvos
          </button>

          <button
            onClick={handleSettleAll}
            className="px-4 py-2.5 bg-emerald-600 text-white font-bold text-sm rounded-xl hover:bg-emerald-700 shadow-sm flex items-center gap-2 transition"
          >
            <CheckCircle className="w-4 h-4" />
            Efetivar no Caixa
          </button>

          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 font-bold text-sm rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-700/50 flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Exportar Excel
          </button>

          <button
            onClick={handleClear}
            className="p-2.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 transition"
            title="Limpar Arquivos"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 Cards de Ingestão de Fontes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Fonte 1: PDV / Caixa Operacional */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                Fonte 1 • CSV
              </span>
              <h4 className="font-bold text-gray-900 dark:text-white text-base">PDV / Balcão</h4>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                Relatório20_Movimentacoes.csv
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              1
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="text-xs text-gray-600 dark:text-zinc-300 flex justify-between">
              <span>Status:</span>
              <span className="font-bold">
                {pdvData.length > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Carregado ({pdvData.length} linhas)
                  </span>
                ) : (
                  <span className="text-gray-400">Pendente</span>
                )}
              </span>
            </div>
            {fileNames.pdv && (
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate bg-gray-50 dark:bg-zinc-800/50 px-2 py-1 rounded">
                📄 {fileNames.pdv}
              </p>
            )}
          </div>

          <input
            type="file"
            accept=".csv, .txt, text/csv, application/csv, application/vnd.ms-excel, text/plain"
            ref={pdvInputRef}
            onChange={handlePdvUpload}
            className="hidden"
          />
          <button
            onClick={() => pdvInputRef.current?.click()}
            className="w-full py-2 px-3 border border-dashed border-blue-300 dark:border-blue-800 hover:border-blue-500 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition bg-blue-50/50 dark:bg-blue-950/20"
          >
            <Upload className="w-3.5 h-3.5" />
            {pdvData.length > 0 ? 'Substituir Arquivo' : 'Subir Movimentações CSV'}
          </button>
        </div>

        {/* Fonte 2: Gateway Clube de Assinaturas */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                Fonte 2 • CSV
              </span>
              <h4 className="font-bold text-gray-900 dark:text-white text-base">Gateway Clube</h4>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                71975-relatorio-transacoes...csv
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              2
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="text-xs text-gray-600 dark:text-zinc-300 flex justify-between">
              <span>Status:</span>
              <span className="font-bold">
                {clubeData.length > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Carregado ({clubeData.length} linhas)
                  </span>
                ) : (
                  <span className="text-gray-400">Pendente</span>
                )}
              </span>
            </div>
            {fileNames.clube && (
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate bg-gray-50 dark:bg-zinc-800/50 px-2 py-1 rounded">
                📄 {fileNames.clube}
              </p>
            )}
          </div>

          <input
            type="file"
            accept=".csv, .txt, text/csv, application/csv, application/vnd.ms-excel, text/plain"
            ref={clubeInputRef}
            onChange={handleClubeUpload}
            className="hidden"
          />
          <button
            onClick={() => clubeInputRef.current?.click()}
            className="w-full py-2 px-3 border border-dashed border-indigo-300 dark:border-indigo-800 hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition bg-indigo-50/50 dark:bg-indigo-950/20"
          >
            <Upload className="w-3.5 h-3.5" />
            {clubeData.length > 0 ? 'Substituir Arquivo' : 'Subir Clube Recorrente'}
          </button>
        </div>

        {/* Fonte 3: Extrato Adquirente Rede */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                Fonte 3 • XLSX multiabas / CSV Pagamentos
              </span>
              <h4 className="font-bold text-gray-900 dark:text-white text-base">Adquirente Rede</h4>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                XLSX completo da Rede ou CSV exportado da aba Pagamentos
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              3
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="text-xs text-gray-600 dark:text-zinc-300 flex justify-between">
              <span>Status:</span>
              <span className="font-bold">
                {redePagamentos.length > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> {redePagamentos.length} transações (Aba Pagamentos)
                  </span>
                ) : redeResumoInfo?.isOnlyResumo ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Resumo reconhecido • {(redeResumoInfo.liquidoRecebido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                ) : (
                  <span className="text-gray-400">Pendente</span>
                )}
              </span>
            </div>
            {fileNames.rede && (
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate bg-gray-50 dark:bg-zinc-800/50 px-2 py-1 rounded">
                📊 {fileNames.rede}{redeResumoInfo?.nomeAbaProcessada ? ` (Aba: ${redeResumoInfo.nomeAbaProcessada})` : ''}
              </p>
            )}
          </div>

          <input
            type="file"
            accept=".xlsx, .xls, .csv, .txt, text/csv, application/csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/plain"
            ref={redeInputRef}
            onChange={handleRedeUpload}
            className="hidden"
          />
          <button
            onClick={() => redeInputRef.current?.click()}
            className="w-full py-2 px-3 border border-dashed border-emerald-300 dark:border-emerald-800 hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition bg-emerald-50/50 dark:bg-emerald-950/20"
          >
            <Upload className="w-3.5 h-3.5" />
            {redePagamentos.length > 0
              ? 'Substituir Arquivo'
              : redeResumoInfo?.isOnlyResumo
                ? 'Enviar XLSX ou CSV Pagamentos'
                : 'Subir Extrato Rede (.xlsx ou .csv)'}
          </button>
        </div>

        {/* Fonte 4: Previsão de Recebíveis D+31 */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-purple-600 dark:text-purple-400 tracking-wider">
                Fonte 4 • XLSX
              </span>
              <h4 className="font-bold text-gray-900 dark:text-white text-base">Previsão D+31</h4>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                exportacao-relatorio-previsao...xlsx
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              4
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="text-xs text-gray-600 dark:text-zinc-300 flex justify-between">
              <span>Status:</span>
              <span className="font-bold">
                {previsaoData.length > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Carregado ({previsaoData.length} previsões)
                  </span>
                ) : (
                  <span className="text-gray-400">Pendente</span>
                )}
              </span>
            </div>
            {fileNames.previsao && (
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate bg-gray-50 dark:bg-zinc-800/50 px-2 py-1 rounded">
                📊 {fileNames.previsao}
              </p>
            )}
          </div>

          <input
            type="file"
            accept=".xlsx, .xls"
            ref={previsaoInputRef}
            onChange={handlePrevisaoUpload}
            className="hidden"
          />
          <button
            onClick={() => previsaoInputRef.current?.click()}
            className="w-full py-2 px-3 border border-dashed border-purple-300 dark:border-purple-800 hover:border-purple-500 text-purple-600 dark:text-purple-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition bg-purple-50/50 dark:bg-purple-950/20"
          >
            <Upload className="w-3.5 h-3.5" />
            {previsaoData.length > 0 ? 'Substituir Arquivo' : 'Subir Previsão D+31 XLSX'}
          </button>
        </div>
      </div>

      {/* DASHBOARD KPIS (Os 4 Indicadores Solicitados) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Saldo Real em Conta */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Saldo Real em Conta
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">
            {kpis.saldoRealEmConta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 flex items-center gap-1">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Depósitos Rede + Dinheiro/Pix</span>
          </p>
        </div>

        {/* KPI 2: Total Faturado PDV vs Aprovado Adquirente */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Faturado PDV vs Aprovado Rede
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-gray-900 dark:text-white">
              {kpis.totalFaturadoPDV.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="text-xs text-gray-400">/</span>
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
              {kpis.totalAprovadoAdquirente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2">
            Var: {(kpis.totalFaturadoPDV - kpis.totalAprovadoAdquirente).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>

        {/* KPI 3: Previsão de Entradas D+30 (Clube) */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Previsão Entradas D+30 (Clube)
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
            {kpis.previsaoEntradasD30.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2">
            Assinaturas líquidas a liquidar em D+31
          </p>
        </div>

        {/* KPI 4: Total de Divergências */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Total de Divergências
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-red-600 dark:text-red-400">
              {kpis.totalDivergenciasValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-bold">
              {kpis.totalDivergenciasCount} itens
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2">
            Taxas MDR divergentes ou não autorizadas
          </p>
        </div>
      </div>

      {/* Gráfico de Projeção de Fluxo de Caixa */}
      {cashFlowTimeline.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="font-black text-gray-900 dark:text-white text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Projeção de Fluxo de Caixa (Entradas Passadas vs. Liquidações Futuras D+31)
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                Acompanhe as entradas realizadas em caixa/banco contra as parcelas de recorrência projetadas do clube.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
                <span className="w-3 h-3 rounded bg-blue-600 inline-block" /> Realizado
              </span>
              <span className="flex items-center gap-1.5 font-bold text-purple-600 dark:text-purple-400">
                <span className="w-3 h-3 rounded bg-purple-500 inline-block" /> Projetado D+31
              </span>
              <span className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                <span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Taxas MDR
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cashFlowTimeline} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis 
                  dataKey="data" 
                  tickFormatter={(str) => {
                    const parts = str.split('-');
                    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : str;
                  }}
                  fontSize={11}
                  stroke="#888888"
                />
                <YAxis 
                  tickFormatter={(val) => `R$ ${val}`} 
                  fontSize={11}
                  stroke="#888888"
                />
                <Tooltip 
                  formatter={(val: any) => [
                    Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                    ''
                  ]}
                  labelFormatter={(lbl) => `Data: ${lbl}`}
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="realizado" name="Realizado (Caixa/Depósitos)" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={24} />
                <Bar dataKey="projetado" name="Projetado D+31 (Clube)" fill="#a855f7" radius={[6, 6, 0, 0]} barSize={24} />
                <Line type="monotone" dataKey="taxas" name="MDR Descontado" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Navegação entre Abas de Visualização */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 dark:border-zinc-800 px-6 pt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('FECHAMENTO')}
            className={`pb-4 px-3 text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'FECHAMENTO'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Fechamento Diário de Caixa
            {dailyClosings.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold">
                {dailyClosings.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('REGRA_1')}
            className={`pb-4 px-3 text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'REGRA_1'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            Regra 1: Clube vs Previsão D+31
          </button>

          <button
            onClick={() => setActiveTab('REGRA_2')}
            className={`pb-4 px-3 text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'REGRA_2'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Regra 2: PDV Cartão vs Rede
          </button>


          <button
            onClick={() => setActiveTab('REGRA_3')}
            className={`pb-4 px-3 text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'REGRA_3'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Regra 3: Assinaturas Balcão
          </button>

          <button
            onClick={() => setActiveTab('DIVERGENCIAS')}
            className={`pb-4 px-3 text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'DIVERGENCIAS'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Auditoria de Divergências & Taxas
            {kpis.totalDivergenciasCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 font-bold">
                {kpis.totalDivergenciasCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('CODIGO_BACKEND')}
            className={`pb-4 px-3 text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'CODIGO_BACKEND'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <FileCode className="w-4 h-4" />
            Código Backend Python & PostgreSQL
          </button>
        </div>

        {/* ABA 1: FECHAMENTO DIÁRIO DE CAIXA */}
        {activeTab === 'FECHAMENTO' && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
                  Demonstrativo de Fechamento por Data
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Status visual consolidado (Verde / Amarelo / Vermelho) para cada dia de movimento da Barbearia Vangard.
                </p>
              </div>

              {selectedItemsToSettle.size > 0 && (
                <button
                  onClick={handleSettleSelected}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition"
                >
                  <CheckCircle className="w-4 h-4" />
                  Efetivar {selectedItemsToSettle.size} Recebimentos no Fluxo de Caixa
                </button>
              )}
            </div>

            {dailyClosings.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl">
                <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <h4 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Nenhum dado processado</h4>
                <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-sm mx-auto mt-1">
                  Carregue os arquivos ou clique em "Dados de Exemplo (Simulação Vangard)" no topo para ver o fechamento diário completo.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-zinc-800 text-[11px] font-black uppercase text-gray-400 tracking-wider bg-gray-50/50 dark:bg-zinc-800/30">
                      <th className="py-3 px-4">Data Caixa</th>
                      <th className="py-3 px-4">PDV Bruto</th>
                      <th className="py-3 px-4">Dinheiro / Pix</th>
                      <th className="py-3 px-4">Cartão (Créd/Déb)</th>
                      <th className="py-3 px-4">Atendimentos Clube</th>
                      <th className="py-3 px-4">Rede Bruto</th>
                      <th className="py-3 px-4">MDR Retido</th>
                      <th className="py-3 px-4">Lote Adquirente (Líquido)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-xs">
                    {dailyClosings.map((dc) => {
                      const isExpanded = expandedDailyDates.has(dc.data);
                      const dayItems = items.filter((i) => i.dataVenda === dc.data);

                      return (
                        <React.Fragment key={dc.data}>
                          <tr className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 font-medium transition">
                            <td className="py-3 px-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-blue-500" />
                              {dc.data}
                            </td>
                            <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                              {dc.pdvTotalBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">
                              {(dc.pdvDinheiro + dc.pdvPix).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="py-3 px-4 text-gray-700 dark:text-zinc-300">
                              {(dc.pdvCartaoCredito + dc.pdvCartaoDebito).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </td>
                            <td className="py-3 px-4 text-purple-600 dark:text-purple-400 font-bold">
                              {dc.pdvAssinaturasCount} clientes (R$ 0)
                            </td>
                            <td className="py-3 px-4 text-gray-800 dark:text-zinc-200">
                              {dc.redeTotalBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="py-3 px-4 text-amber-600 dark:text-amber-400 font-semibold">
                              -{dc.redeTaxasMdr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">
                              {dc.redeDepositosConfirmados > 0
                                ? dc.redeDepositosConfirmados.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })
                                : dc.redeTotalLiquido.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  })}
                            </td>
                            <td className="py-3 px-4 text-center">{renderStatusBadge(dc.status)}</td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleSettleDailyBatch(dc.data)}
                                  className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400 font-bold rounded flex items-center gap-1 transition"
                                  title="Lançar lote deste dia direto no caixa"
                                >
                                  <Save className="w-3 h-3" />
                                  Baixar
                                </button>
                                <button
                                  onClick={() => toggleExpandDate(dc.data)}
                                  className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white transition rounded-lg"
                                  title="Expandir Transações do Dia"
                                >
                                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-gray-50/80 dark:bg-zinc-950/40">
                              <td colSpan={10} className="p-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h5 className="font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                                      Transações Conciliadas do Dia ({dayItems.length})
                                    </h5>
                                    <span className="text-xs text-gray-400">
                                      Selecione para baixar em lote no caixa oficial
                                    </span>
                                  </div>

                                  <div className="space-y-1.5">
                                    {dayItems.map((item) => {
                                      const isSettled = settledItems.has(item.id);
                                      const isSelected = selectedItemsToSettle.has(item.id) || isSettled;
                                      return (
                                        <div
                                          key={item.id}
                                          onClick={() => {
                                            if (isSettled) return;
                                            const next = new Set(selectedItemsToSettle);
                                            if (next.has(item.id)) next.delete(item.id);
                                            else next.add(item.id);
                                            setSelectedItemsToSettle(next);
                                          }}
                                          className={`p-3 rounded-xl border flex items-center justify-between transition ${
                                            isSettled
                                              ? 'bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 opacity-70 cursor-not-allowed'
                                              : isSelected
                                              ? 'bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700 cursor-pointer'
                                              : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-gray-300 cursor-pointer'
                                          }`}
                                        >
                                          <div className="flex items-center gap-3">
                                            {isSettled ? (
                                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                                            ) : (
                                              <input
                                                type="checkbox"
                                                checked={isSelected}
                                                readOnly
                                                className="rounded text-blue-600"
                                              />
                                            )}
                                            <div>
                                              <p className="font-bold text-gray-900 dark:text-white text-xs">
                                                {item.clienteOuDesc}
                                              </p>
                                              <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                                                {item.modalidadeOuPlano} • Ref: {item.identificador} {item.bandeira && `(${item.bandeira})`}
                                              </p>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-4">
                                            <div className="text-right">
                                              <p className="font-bold text-xs text-gray-900 dark:text-white">
                                                Bruto: {item.valorBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                              </p>
                                              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                                Líquido: {item.valorLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (MDR: {item.mdrTaxaEfetiva}%)
                                              </p>
                                            </div>
                                            <div>{renderStatusBadge(item.status)}</div>
                                            
                                            {/* Ações Rápidas (Apenas se não estiver liquidado) */}
                                            {!isSettled && (
                                              <div className="flex items-center gap-2 border-l border-gray-200 dark:border-zinc-700 pl-4 ml-2">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleManualReconciliation(item.id);
                                                  }}
                                                  className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-bold rounded transition"
                                                  title="Corrigir Manualmente"
                                                >
                                                  Corrigir
                                                </button>
                                                {(item.modalidadeOuPlano?.toLowerCase().includes('estorno') || item.modalidadeOuPlano?.toLowerCase().includes('cancelamento') || item.statusDescricao?.toLowerCase().includes('estorno')) && (
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleTratarEstorno(item.id);
                                                    }}
                                                    className="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px] font-bold rounded transition"
                                                    title="Zerar Bruto e manter Taxa MDR"
                                                  >
                                                    Tratar Estorno
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: REGRA 1 (CLUBE VS PREVISÃO D+31) */}
        {activeTab === 'REGRA_1' && (
          <div className="p-6">
            <div className="mb-6">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Regra de Conciliação 1
              </span>
              <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
                Assinaturas Recorrentes do Clube vs. Previsão de Recebíveis D+31
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                Cruzamento por TID ou Código/Transação projetando a liquidação real em D+31 no banco.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-zinc-800 text-[11px] font-black uppercase text-gray-400 tracking-wider bg-gray-50/50 dark:bg-zinc-800/30">
                    <th className="py-3 px-4">Código / Transação</th>
                    <th className="py-3 px-4">Valor / Valor Bruto</th>
                    <th className="py-3 px-4">MDR</th>
                    <th className="py-3 px-4">Valor (Planilha Previsão)</th>
                    <th className="py-3 px-4 text-center">Status (Planilha Previsão)</th>
                    <th className="py-3 px-4 text-center">D+31</th>
                    <th className="py-3 px-4 text-center">Status Confirmação</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {items
                    .filter((i) => i.regra === 'REGRA_1_CLUBE_PREVISAO')
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40">
                        <td className="py-3 px-4">
                          <p className="font-bold text-gray-900 dark:text-white">{item.clienteOuDesc}</p>
                          <p className="text-[11px] text-gray-500 dark:text-zinc-400">{item.modalidadeOuPlano}</p>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-gray-700 dark:text-zinc-300">
                          {item.identificador}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-zinc-300">{item.dataVenda}</td>
                        <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                          {item.valorBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3 px-4 text-amber-600 dark:text-amber-400 font-semibold">
                          -{item.valorMdrRetido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                          {item.valorLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-700 dark:text-zinc-300">
                          {item.mdrTaxaEfetiva.toFixed(2)}%
                        </td>
                        <td className="py-3 px-4 text-purple-600 dark:text-purple-400 font-bold">
                          {item.dataLiquidacaoPrevista || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">{renderStatusBadge(item.status)}</td>
                        <td className="py-3 px-4 text-center">
                          {settledItems.has(item.id) ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 font-bold text-[11px]">
                              <CheckCircle className="w-3.5 h-3.5" /> Salvo
                            </span>
                          ) : item.status !== 'CONCILIADO' ? (
                            <button
                              onClick={() => handleManualReconciliation(item.id)}
                              className="px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 font-bold rounded-lg transition"
                              title="Forçar Conciliação Manualmente"
                            >
                              Corrigir
                            </button>
                          ) : (
                            <span className="text-gray-400 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  {items.filter((i) => i.regra === 'REGRA_1_CLUBE_PREVISAO').length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-400">
                        Nenhum registro da Regra 1 processado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA 3: REGRA 2 (COMPARATIVO DE TOTAIS PDV VS ADQUIRENTE) */}
        {activeTab === 'REGRA_2' && (
          <div className="p-6 space-y-6">
            {/* Header com Subtítulo e Ação de Exportação */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-gray-50/50 dark:bg-zinc-800/30 p-4 rounded-xl border border-gray-100 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white">
                    Regra 2 • Conciliação PDV vs Adquirente (Lote a Lote)
                  </span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400 font-semibold flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-600" />
                    Unidade: {selectedUnidade}
                  </span>
                </div>
                <h3 className="font-extrabold text-gray-900 dark:text-white text-lg">
                  Comparativo de Valores Totais e Lotes por Forma de Pagamento
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 max-w-3xl">
                  Confronto analítico direto entre os valores faturados no sistema de caixa (PDV) e as transações processadas pela adquirente (Rede), apurando divergências diárias e os saldos que não entraram na maquininha (Pix em conta e dinheiro gaveta).
                </p>
              </div>

              <div className="flex items-center gap-2 self-stretch md:self-auto">
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-200 flex items-center gap-2 transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  Exportar Comparativo (Excel)
                </button>
              </div>
            </div>

            {/* Banner Informativo se o arquivo enviado for a Capa/Resumo da Rede */}
            {redeResumoInfo?.isOnlyResumo && (
              <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 mt-0.5">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="flex-1 text-xs text-blue-900 dark:text-blue-200">
                  <h5 className="font-extrabold text-sm mb-1 flex items-center gap-2">
                    Arquivo Detectado: Capa / Resumo Oficial da Rede
                  </h5>
                  <p className="leading-relaxed">
                    Identificamos o valor consolidado de <strong>{(redeResumoInfo.liquidoRecebido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> {redeResumoInfo.periodo ? `no período de ${redeResumoInfo.periodo}` : ''}.
                  </p>
                  <p className="mt-1 text-blue-700 dark:text-blue-300">
                    Este arquivo CSV possui somente a capa do relatório: as demais abas citadas no texto e as 941 parcelas não fazem parte dele. Para auditar a conciliação lote a lote diário (Cartão de Crédito, Débito e Pix por dia), importe o arquivo Excel completo (.xlsx) contendo a aba <strong>Pagamentos</strong> ou o CSV exportado especificamente dessa aba.
                  </p>
                </div>
              </div>
            )}

            {/* 5 Cards de Resumo dos Lotes (PDV vs Adquirente vs Saldos Fora da Rede) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Card 1: Total PDV Lotes */}
              <div className="bg-gradient-to-br from-blue-50/70 to-blue-100/30 dark:from-blue-950/20 dark:to-zinc-900 p-4 rounded-xl border border-blue-200/60 dark:border-blue-900/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase text-blue-700 dark:text-blue-300 tracking-wider">
                    Total PDV (Lotes Rede)
                  </span>
                  <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  {((comparativoFormasPgto?.totalLotesAdquirente?.totalPdv ?? comparativoFormasPgto?.subtotalCartoes.totalPdv) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1 font-medium">
                  {(comparativoFormasPgto?.totalLotesAdquirente?.qtdPdv ?? comparativoFormasPgto?.subtotalCartoes.qtdPdv) || 0} vendas PDV (Crédito, Débito e Pix)
                </p>
              </div>

              {/* Card 2: Total Adquirente Bruto (Soma dos Lotes) */}
              <div className="bg-gradient-to-br from-purple-50/70 to-purple-100/30 dark:from-purple-950/20 dark:to-zinc-900 p-4 rounded-xl border border-purple-200/60 dark:border-purple-900/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase text-purple-700 dark:text-purple-300 tracking-wider">
                    Total Adquirente (Bruto)
                  </span>
                  <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-purple-900 dark:text-purple-200 tracking-tight">
                  {((comparativoFormasPgto?.totalLotesAdquirente?.totalAdquirenteBruto ?? comparativoFormasPgto?.totalGeral.totalAdquirenteBruto) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <p className="text-[10px] text-purple-700 dark:text-purple-300 mt-1 font-semibold truncate" title={`Crédito: ${(comparativoFormasPgto?.totalLotesAdquirente?.totalCreditoRede || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} • Débito: ${(comparativoFormasPgto?.totalLotesAdquirente?.totalDebitoRede || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} • Pix: ${(comparativoFormasPgto?.totalLotesAdquirente?.totalPixRede || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}>
                  Crédito {(comparativoFormasPgto?.totalLotesAdquirente?.totalCreditoRede || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} • Débito {(comparativoFormasPgto?.totalLotesAdquirente?.totalDebitoRede || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} • Pix {(comparativoFormasPgto?.totalLotesAdquirente?.totalPixRede || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>

              {/* Card 3: Diferença Bruta (PDV - Adquirente) */}
              <div className={`p-4 rounded-xl border transition-all ${
                Math.abs((comparativoFormasPgto?.totalLotesAdquirente?.diferencaBruta ?? comparativoFormasPgto?.subtotalCartoes.diferencaBruta) || 0) <= 0.05
                  ? 'bg-gradient-to-br from-emerald-50/70 to-emerald-100/30 dark:from-emerald-950/20 dark:to-zinc-900 border-emerald-200/60 dark:border-emerald-900/40'
                  : 'bg-gradient-to-br from-red-50/70 to-red-100/30 dark:from-red-950/20 dark:to-zinc-900 border-red-200/60 dark:border-red-900/40'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[11px] font-black uppercase tracking-wider ${
                    Math.abs((comparativoFormasPgto?.totalLotesAdquirente?.diferencaBruta ?? comparativoFormasPgto?.subtotalCartoes.diferencaBruta) || 0) <= 0.05
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}>
                    Diferença Lotes (PDV - Rede)
                  </span>
                  <div className={`p-1.5 rounded-lg ${
                    Math.abs((comparativoFormasPgto?.totalLotesAdquirente?.diferencaBruta ?? comparativoFormasPgto?.subtotalCartoes.diferencaBruta) || 0) <= 0.05
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                  }`}>
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>
                </div>
                <div className={`text-2xl font-black tracking-tight ${
                  Math.abs((comparativoFormasPgto?.totalLotesAdquirente?.diferencaBruta ?? comparativoFormasPgto?.subtotalCartoes.diferencaBruta) || 0) <= 0.05
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {Math.abs((comparativoFormasPgto?.totalLotesAdquirente?.diferencaBruta ?? comparativoFormasPgto?.subtotalCartoes.diferencaBruta) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <p className={`text-[11px] mt-1 font-semibold flex items-center gap-1 ${
                  Math.abs((comparativoFormasPgto?.totalLotesAdquirente?.diferencaBruta ?? comparativoFormasPgto?.subtotalCartoes.diferencaBruta) || 0) <= 0.05
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {Math.abs((comparativoFormasPgto?.totalLotesAdquirente?.diferencaBruta ?? comparativoFormasPgto?.subtotalCartoes.diferencaBruta) || 0) <= 0.05 ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      100% Conciliado (Sem diferença)
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {((comparativoFormasPgto?.totalLotesAdquirente?.diferencaBruta ?? comparativoFormasPgto?.subtotalCartoes.diferencaBruta) || 0) > 0 ? 'Falta na Adquirente' : 'Sobra na Adquirente'}
                    </>
                  )}
                </p>
              </div>

              {/* Card 4: Lote Adquirente Líquido */}
              <div className="bg-gradient-to-br from-teal-50/70 to-teal-100/30 dark:from-teal-950/20 dark:to-zinc-900 p-4 rounded-xl border border-teal-200/60 dark:border-teal-900/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase text-teal-700 dark:text-teal-300 tracking-wider">
                    Lote Adquirente (Líquido)
                  </span>
                  <div className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {((comparativoFormasPgto?.totalLotesAdquirente?.totalAdquirenteLiquido ?? comparativoFormasPgto?.subtotalCartoes.totalAdquirenteLiquido) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                  MDR Retido: -{((comparativoFormasPgto?.totalLotesAdquirente?.totalMdrRetido ?? comparativoFormasPgto?.subtotalCartoes.totalMdrRetido) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({((comparativoFormasPgto?.totalLotesAdquirente?.taxaMdrMedia ?? comparativoFormasPgto?.subtotalCartoes.taxaMdrMedia) || 0).toFixed(2)}%)
                </p>
              </div>

              {/* Card 5: Saldos Fora da Adquirente */}
              <div className="bg-gradient-to-br from-indigo-50/70 to-indigo-100/30 dark:from-indigo-950/20 dark:to-zinc-900 p-4 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider">
                    Saldos Fora Adquirente
                  </span>
                  <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-indigo-900 dark:text-indigo-200 tracking-tight">
                  {((comparativoFormasPgto?.saldosNaoAdquirenteTotal?.totalGeralNaoAdquirente ?? resumoLotesCartao?.totalSaldosNaoAdquirente) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 font-semibold truncate" title="Pix direto em conta + Dinheiro físico no caixa da loja">
                  Pix Conta {(comparativoFormasPgto?.saldosNaoAdquirenteTotal?.totalPixContaBancaria || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} • Gaveta {(comparativoFormasPgto?.saldosNaoAdquirenteTotal?.totalDinheiroGaveta || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>

            {/* TABELA 1: QUADRO COMPARATIVO CONSOLIDADO POR FORMA DE PAGAMENTO */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <h4 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Quadro Comparativo Consolidado: Formas de Pagamento
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    Comparação de totais por forma de pagamento: PDV vs. Adquirente com apuração de lote líquido e diferenças.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400">
                  Unidade Oficial: <strong className="text-gray-900 dark:text-white">{selectedUnidade}</strong>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-zinc-800 text-[11px] font-black uppercase text-gray-500 dark:text-zinc-400 tracking-wider bg-gray-50 dark:bg-zinc-800/50">
                      <th className="py-3 px-4">Forma de Pagamento</th>
                      <th className="py-3 px-4 text-right">Total Faturado PDV</th>
                      <th className="py-3 px-4 text-right">Total Adquirente (Bruto)</th>
                      <th className="py-3 px-4 text-right">Diferença Bruta</th>
                      <th className="py-3 px-4 text-right">MDR Retido (Taxas)</th>
                      <th className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">Lote da Adquirente (Líquido)</th>
                      <th className="py-3 px-4 text-center">Status Conciliação</th>
                      <th className="py-3 px-4">Diagnóstico / Análise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {comparativoFormasPgto && comparativoFormasPgto.totaisPorForma.map((forma) => {
                      const isCartao = forma.categoria === 'CARTAO_CREDITO' || forma.categoria === 'CARTAO_DEBITO';
                      return (
                        <tr key={forma.id} className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/40 transition">
                          {/* Forma de Pgto */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800">
                                {forma.categoria === 'CARTAO_CREDITO' && <CreditCard className="w-4 h-4 text-blue-600" />}
                                {forma.categoria === 'CARTAO_DEBITO' && <Wallet className="w-4 h-4 text-emerald-600" />}
                                {forma.categoria === 'PIX' && <ArrowRightLeft className="w-4 h-4 text-indigo-600" />}
                                {forma.categoria === 'DINHEIRO' && <Banknote className="w-4 h-4 text-amber-600" />}
                                {forma.categoria === 'ASSINATURA' && <Sparkles className="w-4 h-4 text-purple-600" />}
                                {forma.categoria === 'CORTESIA' && <Sparkles className="w-4 h-4 text-pink-600" />}
                                {forma.categoria === 'VALE_PRESENTE' && <Layers className="w-4 h-4 text-teal-600" />}
                                {forma.categoria === 'CREDITO_ANTERIOR' && <DollarSign className="w-4 h-4 text-orange-600" />}
                                {forma.categoria === 'OUTROS' && <HelpCircle className="w-4 h-4 text-gray-500" />}
                              </div>
                              <div>
                                <div className="font-extrabold text-gray-900 dark:text-white">
                                  {forma.formaPgtoNome}
                                </div>
                                <div className="text-[10px] text-gray-400">
                                  {forma.qtdPdv} vendas no PDV {forma.qtdAdquirente > 0 && `• ${forma.qtdAdquirente} na Rede`}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Total PDV */}
                          <td className="py-3 px-4 text-right font-extrabold text-gray-900 dark:text-white">
                            {forma.totalPdv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>

                          {/* Total Adquirente Bruto */}
                          <td className="py-3 px-4 text-right font-extrabold text-gray-900 dark:text-white">
                            {forma.totalAdquirenteBruto > 0 ? (
                              forma.totalAdquirenteBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            ) : (
                              <span className="text-gray-400 font-normal italic">Não intermediado</span>
                            )}
                          </td>

                          {/* Diferença Bruta */}
                          <td className="py-3 px-4 text-right">
                            {isCartao || forma.categoria === 'PIX' ? (
                              <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-xs ${
                                Math.abs(forma.diferencaBruta) <= 0.05
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 font-extrabold'
                              }`}>
                                {Math.abs(forma.diferencaBruta).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                {forma.diferencaBruta > 0.05 && ' (Falta Rede)'}
                                {forma.diferencaBruta < -0.05 && ' (Sobra Rede)'}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[11px]">-</span>
                            )}
                          </td>

                          {/* MDR Retido */}
                          <td className="py-3 px-4 text-right">
                            {forma.totalMdrRetido > 0 ? (
                              <div>
                                <span className="font-bold text-amber-600 dark:text-amber-400">
                                  -{forma.totalMdrRetido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                                <span className="block text-[10px] text-gray-400 font-medium">
                                  {forma.taxaMdrMedia.toFixed(2)}% média
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[11px]">R$ 0,00</span>
                            )}
                          </td>

                          {/* Lote Adquirente Líquido */}
                          <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                            {forma.totalAdquirenteLiquido > 0 ? (
                              forma.totalAdquirenteLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            ) : (
                              <span className="text-gray-400 font-normal text-xs">
                                {forma.categoria === 'DINHEIRO' ? 'Gaveta' : forma.categoria === 'PIX' ? 'Banco Direto' : '-'}
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            {renderFormaStatusBadge(forma.status)}
                          </td>

                          {/* Diagnóstico */}
                          <td className="py-3 px-4 text-gray-600 dark:text-zinc-300 text-[11px] max-w-xs">
                            {forma.descricaoStatus}
                          </td>
                        </tr>
                      );
                    })}

                    {/* ROW DE DESTAQUE: SUBTOTAL LOTES DA ADQUIRENTE (CRÉDITO + DÉBITO + PIX DA REDE) */}
                    {comparativoFormasPgto && (
                      <tr className="bg-emerald-50/90 dark:bg-emerald-950/40 border-t-2 border-b-2 border-emerald-400/90 dark:border-emerald-700/80 font-black">
                        <td className="py-3.5 px-4 text-emerald-950 dark:text-emerald-200">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-emerald-600" />
                            <span>SUBTOTAL LOTES ADQUIRENTE (Crédito + Débito + Pix)</span>
                          </div>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-normal block ml-6">
                            {(comparativoFormasPgto.totalLotesAdquirente?.qtdPdv ?? comparativoFormasPgto.subtotalCartoes.qtdPdv)} vendas PDV • {(comparativoFormasPgto.totalLotesAdquirente?.qtdAdquirente ?? comparativoFormasPgto.subtotalCartoes.qtdAdquirente)} transações Rede
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-emerald-950 dark:text-white text-sm">
                          {(comparativoFormasPgto.totalLotesAdquirente?.totalPdv ?? comparativoFormasPgto.subtotalCartoes.totalPdv).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3.5 px-4 text-right text-emerald-950 dark:text-white text-sm">
                          {(comparativoFormasPgto.totalLotesAdquirente?.totalAdquirenteBruto ?? comparativoFormasPgto.subtotalCartoes.totalAdquirenteBruto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          <span className="block text-[10px] text-purple-700 dark:text-purple-300 font-bold">
                            Crédito {(comparativoFormasPgto.totalLotesAdquirente?.totalCreditoRede || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Débito {(comparativoFormasPgto.totalLotesAdquirente?.totalDebitoRede || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Pix {(comparativoFormasPgto.totalLotesAdquirente?.totalPixRede || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-black ${
                            Math.abs(comparativoFormasPgto.totalLotesAdquirente?.diferencaBruta ?? comparativoFormasPgto.subtotalCartoes.diferencaBruta) <= 0.05
                              ? 'bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
                              : 'bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100'
                          }`}>
                            {Math.abs(comparativoFormasPgto.totalLotesAdquirente?.diferencaBruta ?? comparativoFormasPgto.subtotalCartoes.diferencaBruta).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-amber-700 dark:text-amber-400">
                          -{(comparativoFormasPgto.totalLotesAdquirente?.totalMdrRetido ?? comparativoFormasPgto.subtotalCartoes.totalMdrRetido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          <span className="block text-[10px] font-medium">({(comparativoFormasPgto.totalLotesAdquirente?.taxaMdrMedia ?? comparativoFormasPgto.subtotalCartoes.taxaMdrMedia).toFixed(2)}%)</span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-emerald-700 dark:text-emerald-300 text-base">
                          {(comparativoFormasPgto.totalLotesAdquirente?.totalAdquirenteLiquido ?? comparativoFormasPgto.subtotalCartoes.totalAdquirenteLiquido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {renderFormaStatusBadge(comparativoFormasPgto.totalLotesAdquirente?.status ?? comparativoFormasPgto.subtotalCartoes.status)}
                        </td>
                        <td className="py-3.5 px-4 text-emerald-900 dark:text-emerald-200 text-[11px]">
                          {(comparativoFormasPgto.totalLotesAdquirente?.status ?? comparativoFormasPgto.subtotalCartoes.status) === 'CONCILIADO'
                            ? 'Confronto perfeito: todos os lotes de Crédito, Débito e Pix batendo com a Rede'
                            : `Atenção: diferença de R$ ${Math.abs(comparativoFormasPgto.totalLotesAdquirente?.diferencaBruta ?? comparativoFormasPgto.subtotalCartoes.diferencaBruta).toFixed(2)} a auditar nos lotes diários`}
                        </td>
                      </tr>
                    )}

                    {/* ROW DE DESTAQUE: SUBTOTAL SALDOS NÃO INTERMEDIADOS NA ADQUIRENTE */}
                    {comparativoFormasPgto?.saldosNaoAdquirenteTotal && (
                      <tr className="bg-indigo-50/70 dark:bg-indigo-950/30 border-b border-indigo-200 dark:border-indigo-900/50 font-bold">
                        <td className="py-3 px-4 text-indigo-950 dark:text-indigo-200">
                          <div className="flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-indigo-600" />
                            <span>SUBTOTAL FORA DA ADQUIRENTE (Pix Direto + Dinheiro + etc.)</span>
                          </div>
                          <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-normal block ml-6">
                            Saldos recebidos sem retenção de taxa na maquininha
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-indigo-950 dark:text-white font-extrabold text-sm">
                          {comparativoFormasPgto.saldosNaoAdquirenteTotal.totalGeralNaoAdquirente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-400 italic">
                          Não intermediado
                        </td>
                        <td className="py-3 px-4 text-right text-indigo-700 dark:text-indigo-300">
                          {comparativoFormasPgto.saldosNaoAdquirenteTotal.totalGeralNaoAdquirente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-600 font-bold">
                          R$ 0,00 (0% taxa)
                        </td>
                        <td className="py-3 px-4 text-right text-indigo-700 dark:text-indigo-300 font-extrabold">
                          {comparativoFormasPgto.saldosNaoAdquirenteTotal.totalGeralNaoAdquirente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {renderFormaStatusBadge('SALDO_NAO_INTERMEDIADO')}
                        </td>
                        <td className="py-3 px-4 text-indigo-900 dark:text-indigo-200 text-[11px]">
                          Pix direto em conta bancária (R$ {comparativoFormasPgto.saldosNaoAdquirenteTotal.totalPixContaBancaria.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) + Dinheiro gaveta (R$ {comparativoFormasPgto.saldosNaoAdquirenteTotal.totalDinheiroGaveta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                        </td>
                      </tr>
                    )}

                    {/* ROW DE DESTAQUE: TOTAL GERAL (TODAS AS FORMAS DE PAGAMENTO) */}
                    {comparativoFormasPgto && (
                      <tr className="bg-gray-100/90 dark:bg-zinc-800/80 font-black border-t-2 border-gray-300 dark:border-zinc-700">
                        <td className="py-3.5 px-4 text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-blue-600" />
                            <span>TOTAL GERAL (Todas as Formas de Pgto)</span>
                          </div>
                          <span className="text-[10px] text-gray-500 dark:text-zinc-400 font-normal block ml-6">
                            Faturamento global consolidado da unidade
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-gray-900 dark:text-white text-sm">
                          {comparativoFormasPgto.totalGeral.totalPdv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          <span className="block text-[10px] text-gray-500 dark:text-zinc-400 font-normal">
                            Crédito + Débito + Pix + Dinheiro + Assinatura + Vales
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-gray-900 dark:text-white text-sm">
                          {comparativoFormasPgto.totalGeral.totalAdquirenteBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          <span className="block text-[10px] text-purple-700 dark:text-purple-300 font-bold">
                            Soma lotes: Crédito ({(comparativoFormasPgto.totalGeral.totalCreditoRede || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) + Débito ({(comparativoFormasPgto.totalGeral.totalDebitoRede || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) + Pix ({(comparativoFormasPgto.totalGeral.totalPixRede || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-gray-700 dark:text-zinc-300 font-bold">
                          {Math.abs(comparativoFormasPgto.totalGeral.diferencaBruta).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3.5 px-4 text-right text-amber-600 dark:text-amber-400">
                          -{comparativoFormasPgto.totalGeral.totalMdrRetido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3.5 px-4 text-right text-emerald-600 dark:text-emerald-400 text-sm">
                          {comparativoFormasPgto.totalGeral.totalAdquirenteLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-400 text-xs">-</td>
                        <td className="py-3.5 px-4 text-gray-600 dark:text-zinc-300 text-[11px]">
                          Volume consolidado: PDV soma todas as formas e Adquirente soma os lotes processados pela Rede
                        </td>
                      </tr>
                    )}

                    {!comparativoFormasPgto && (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-gray-400">
                          <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-zinc-600" />
                          <p className="font-bold text-sm">Nenhum comparativo processado ainda.</p>
                          <p className="text-xs text-gray-500 mt-1">Carregue os relatórios de PDV e Adquirente acima para visualizar o confronto.</p>
                          <button
                            onClick={handleLoadDemo}
                            className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                          >
                            Carregar Dados Exemplo Barbearia Vangard
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PAINEL NOVO EXCLUSIVO: SALDOS E DIVERGÊNCIAS QUE NÃO ENTRARAM NO RELATÓRIO DA ADQUIRENTE */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-amber-50/60 to-indigo-50/60 dark:from-zinc-800/50 dark:to-zinc-800/30 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <h4 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    Quadro Analítico: Saldos e Divergências que Não Entraram na Adquirente
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    Detalhamento dos saldos recebidos diretamente fora da maquineta (Pix em conta bancária, dinheiro físico no caixa) e vendas com divergência na Rede.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                    Total Fora da Rede: {((comparativoFormasPgto?.saldosNaoAdquirenteTotal?.totalGeralNaoAdquirente ?? resumoLotesCartao?.totalSaldosNaoAdquirente) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>

              {/* 4 Cards Informativos de Saldos Não Intermediados */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50/30 dark:bg-zinc-800/20 border-b border-gray-100 dark:border-zinc-800">
                {/* Pix em Conta */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-blue-200/60 dark:border-blue-900/40">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-blue-700 dark:text-blue-300 uppercase text-[10px]">Pix em Conta (Direto)</span>
                    <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="text-lg font-black text-gray-900 dark:text-white">
                    {(comparativoFormasPgto?.saldosNaoAdquirenteTotal?.totalPixContaBancaria || resumoLotesCartao?.totalPixContaBancaria || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">
                    {(comparativoFormasPgto?.saldosNaoAdquirenteTotal?.qtdPixContaBancaria || 0)} vendas • QR Code do banco / Chave Pix (0% taxa)
                  </p>
                </div>

                {/* Dinheiro Gaveta */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-amber-900/40">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-amber-700 dark:text-amber-300 uppercase text-[10px]">Caixa Físico (Gaveta)</span>
                    <Banknote className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="text-lg font-black text-gray-900 dark:text-white">
                    {(comparativoFormasPgto?.saldosNaoAdquirenteTotal?.totalDinheiroGaveta || resumoLotesCartao?.totalDinheiroCaixa || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">
                    {(comparativoFormasPgto?.saldosNaoAdquirenteTotal?.qtdDinheiroGaveta || 0)} vendas em espécie guardadas na gaveta
                  </p>
                </div>

                {/* Vendas Cartão com Falta na Rede */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-red-200/60 dark:border-red-900/40">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-red-700 dark:text-red-300 uppercase text-[10px]">Falta na Adquirente (Cartões)</span>
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  </div>
                  <div className="text-lg font-black text-red-600 dark:text-red-400">
                    {(resumoLotesCartao?.totalCartaoFaltaRede || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">
                    Vendas registradas no PDV que não constam no extrato Rede
                  </p>
                </div>

                {/* Vales e Cortesias */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-indigo-200/60 dark:border-indigo-900/40">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-indigo-700 dark:text-indigo-300 uppercase text-[10px]">Cortesias & Vouchers</span>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="text-lg font-black text-gray-900 dark:text-white">
                    {(comparativoFormasPgto?.saldosNaoAdquirenteTotal?.totalCortesiasVales || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">
                    {(comparativoFormasPgto?.saldosNaoAdquirenteTotal?.qtdCortesiasVales || 0)} atendimentos bonificados ou com saldo prévio
                  </p>
                </div>
              </div>

              {/* Tabela dos Saldos Não Intermediados por Dia */}
              {resumoLotesCartao && resumoLotesCartao.saldosNaoAdquirente && resumoLotesCartao.saldosNaoAdquirente.length > 0 ? (
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-zinc-800 text-[11px] font-black uppercase text-gray-500 dark:text-zinc-400 tracking-wider bg-gray-50 dark:bg-zinc-800/50 sticky top-0 z-10">
                        <th className="py-2.5 px-4">Data do Movimento</th>
                        <th className="py-2.5 px-4">Forma / Origem</th>
                        <th className="py-2.5 px-4 text-right">Valor Não Intermediado</th>
                        <th className="py-2.5 px-4 text-center">Qtd Lançamentos</th>
                        <th className="py-2.5 px-4">Destino / Diagnóstico do Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                      {resumoLotesCartao.saldosNaoAdquirente.slice(0, 30).map((saldo, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/40 transition">
                          <td className="py-2.5 px-4 font-bold text-gray-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              {saldo.data}
                            </div>
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                              saldo.categoria === 'PIX_DIRETO'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                                : saldo.categoria === 'DINHEIRO_GAVETA'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                : saldo.categoria === 'CARTAO_NAO_CAPTURADO'
                                ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-300'
                            }`}>
                              {saldo.formaPgto}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-extrabold text-gray-900 dark:text-white">
                            {saldo.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="py-2.5 px-4 text-center text-gray-500 font-semibold">
                            {saldo.qtd}
                          </td>
                          <td className="py-2.5 px-4 text-gray-600 dark:text-zinc-300 text-[11px]">
                            {saldo.descricao}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-gray-400 text-xs">
                  Nenhum saldo divergente ou não intermediado detectado.
                </div>
              )}
            </div>

            {/* TABELA 2: DETALHAMENTO DIÁRIO DOS LOTES (DATA X MODALIDADE) */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/30 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h4 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    Detalhamento Diário: Lotes por Data e Forma de Pagamento
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    Confronto lote a lote: agrupamento por <strong>[Data da Venda, Modalidade]</strong> apurando total de PDV, total de Rede, MDR descontado, líquido e diferença bruta.
                  </p>
                </div>

                {/* Filtros da Tabela de Lotes */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl text-xs">
                    <button
                      onClick={() => setSelectedBatchModalidade('TODAS')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        selectedBatchModalidade === 'TODAS'
                          ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400'
                      }`}
                    >
                      Todas
                    </button>
                    <button
                      onClick={() => setSelectedBatchModalidade('CREDITO')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        selectedBatchModalidade === 'CREDITO'
                          ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400'
                      }`}
                    >
                      Crédito
                    </button>
                    <button
                      onClick={() => setSelectedBatchModalidade('DEBITO')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        selectedBatchModalidade === 'DEBITO'
                          ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400'
                      }`}
                    >
                      Débito
                    </button>
                    <button
                      onClick={() => setSelectedBatchModalidade('PIX')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        selectedBatchModalidade === 'PIX'
                          ? 'bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-400 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400'
                      }`}
                    >
                      PIX
                    </button>
                    <button
                      onClick={() => setSelectedBatchModalidade('DINHEIRO')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        selectedBatchModalidade === 'DINHEIRO'
                          ? 'bg-white dark:bg-zinc-700 text-amber-600 dark:text-amber-400 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400'
                      }`}
                    >
                      Dinheiro
                    </button>
                    <button
                      onClick={() => setSelectedBatchModalidade('OUTROS')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        selectedBatchModalidade === 'OUTROS'
                          ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400'
                      }`}
                    >
                      Outras
                    </button>
                  </div>

                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl text-xs">
                    <button
                      onClick={() => setSelectedBatchStatus('TODOS')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        selectedBatchStatus === 'TODOS'
                          ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400'
                      }`}
                    >
                      Todos ({batches.length})
                    </button>
                    <button
                      onClick={() => setSelectedBatchStatus('CONCILIADOS')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        selectedBatchStatus === 'CONCILIADOS'
                          ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400'
                      }`}
                    >
                      Conciliados
                    </button>
                    <button
                      onClick={() => setSelectedBatchStatus('DIVERGENTES')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        selectedBatchStatus === 'DIVERGENTES'
                          ? 'bg-white dark:bg-zinc-700 text-red-600 dark:text-red-400 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400'
                      }`}
                    >
                      Com Diferença
                    </button>
                    <button
                      onClick={() => setSelectedBatchStatus('NAO_INTERMEDIADOS')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        selectedBatchStatus === 'NAO_INTERMEDIADOS'
                          ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400'
                      }`}
                    >
                      Fora da Rede
                    </button>
                  </div>
                </div>
              </div>

              {/* Painel de Alerta de Divergências Identificadas (se houver) */}
              {resumoLotesCartao && resumoLotesCartao.diasDivergentes.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/40">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-extrabold text-xs text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                        Atenção: {resumoLotesCartao.diasDivergentes.length} {resumoLotesCartao.diasDivergentes.length === 1 ? 'Lote com Divergência' : 'Lotes com Divergências'} Identificados
                      </h5>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                        Divergências diárias apuradas pelo confronto lote a lote entre o PDV e o Extrato da Rede:
                      </p>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {resumoLotesCartao.diasDivergentes.map((div, i) => (
                          <div key={i} className="bg-white/80 dark:bg-zinc-900/80 p-2.5 rounded-lg border border-amber-200/80 dark:border-amber-900/40 text-xs">
                            <div className="flex justify-between items-center font-bold text-gray-900 dark:text-white">
                              <span>{div.data} ({div.modalidade})</span>
                              <span className={div.diferenca > 0 ? 'text-red-600 dark:text-red-400 font-extrabold' : 'text-purple-600 dark:text-purple-400 font-extrabold'}>
                                {div.diferenca > 0 ? `+${div.diferenca.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : div.diferenca.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1 flex justify-between">
                              <span>PDV: {div.totalPdv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                              <span>Rede: {div.totalRede.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="text-[10px] text-amber-800 dark:text-amber-300 mt-1 font-semibold truncate" title={div.motivo}>
                              {div.motivo}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-zinc-800 text-[11px] font-black uppercase text-gray-500 dark:text-zinc-400 tracking-wider bg-gray-50 dark:bg-zinc-800/50">
                      <th className="py-3 px-4">Data da Venda</th>
                      <th className="py-3 px-4">Forma / Modalidade</th>
                      <th className="py-3 px-4 text-right">Total PDV (Faturado)</th>
                      <th className="py-3 px-4 text-right">Total Rede (Bruto)</th>
                      <th className="py-3 px-4 text-right">Desconto MDR</th>
                      <th className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">Lote Líquido (Rede)</th>
                      <th className="py-3 px-4 text-right">Diferença Bruta</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4">Diagnóstico</th>
                      <th className="py-3 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {filteredBatches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-gray-50/70 dark:hover:bg-zinc-800/40 transition">
                        <td className="py-3 px-4 font-extrabold text-gray-900 dark:text-white whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {batch.dataVenda}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-800 dark:text-zinc-200">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-black tracking-wide ${
                            batch.modalidade.toUpperCase().includes('CRED')
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60'
                              : batch.modalidade.toUpperCase().includes('DEB')
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/60'
                              : batch.modalidade.toUpperCase().includes('PIX')
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/80 dark:border-purple-900/60'
                              : batch.modalidade.toUpperCase().includes('DINHEIRO')
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900/60'
                              : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-900/60'
                          }`}>
                            {batch.modalidade.toUpperCase().includes('CRED') ? (
                              <CreditCard className="w-3.5 h-3.5" />
                            ) : batch.modalidade.toUpperCase().includes('DEB') ? (
                              <Wallet className="w-3.5 h-3.5" />
                            ) : batch.modalidade.toUpperCase().includes('PIX') ? (
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            ) : batch.modalidade.toUpperCase().includes('DINHEIRO') ? (
                              <Banknote className="w-3.5 h-3.5" />
                            ) : (
                              <Layers className="w-3.5 h-3.5" />
                            )}
                            {batch.modalidade}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-extrabold text-gray-900 dark:text-white block">
                            {batch.totalPdv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          <span className="text-[10px] text-gray-500 dark:text-zinc-400">
                            {batch.qtdPdv} {batch.qtdPdv === 1 ? 'venda' : 'vendas'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-extrabold text-gray-900 dark:text-white block">
                            {batch.totalRedeBruto > 0 ? (
                              batch.totalRedeBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            ) : (
                              <span className="text-gray-400 font-normal italic">Não intermediado</span>
                            )}
                          </span>
                          {batch.qtdRede > 0 && (
                            <span className="text-[10px] text-gray-500 dark:text-zinc-400">
                              {batch.qtdRede} {batch.qtdRede === 1 ? 'transação' : 'transações'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {batch.totalTaxaMdr > 0 ? (
                            <>
                              <span className="text-amber-600 dark:text-amber-400 font-bold block">
                                -{batch.totalTaxaMdr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                              <span className="text-[10px] text-gray-500 dark:text-zinc-400">
                                {batch.taxaMdrMedia.toFixed(2)}%
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-400 text-[11px]">R$ 0,00</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">
                          {batch.totalRedeLiquido > 0 ? (
                            batch.totalRedeLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          ) : (
                            <span className="text-gray-400 font-normal text-xs">
                              {batch.modalidade === 'Dinheiro' ? 'Gaveta' : batch.modalidade === 'PIX' ? 'Banco Direto' : '-'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {batch.modalidade === 'Crédito' || batch.modalidade === 'Débito' || (batch.modalidade === 'PIX' && batch.totalRedeBruto > 0) ? (
                            <span className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${
                              batch.status === 'CONCILIADO'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 font-extrabold'
                            }`}>
                              {batch.status === 'CONCILIADO' ? 'R$ 0,00' : (batch.diferencaBruta > 0 ? `+R$ ${batch.diferencaBruta.toFixed(2)}` : `R$ ${batch.diferencaBruta.toFixed(2)}`)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {renderStatusBadge(batch.status)}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600 dark:text-zinc-300 min-w-[200px]">
                          {batch.diagnostico || (batch.status === 'CONCILIADO' ? 'Lote 100% conciliado' : 'Divergência detectada')}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {settledItems.has(batch.id) ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 font-bold text-[11px]">
                              <CheckCircle className="w-3.5 h-3.5" /> Lote Salvo
                            </span>
                          ) : batch.status === 'CONCILIADO' && batch.totalRedeLiquido > 0 ? (
                            <button
                              onClick={() => handleSettleBatch(batch.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition text-xs shadow-sm flex items-center gap-1 mx-auto"
                              title="Salvar Lote no Caixa Oficial"
                            >
                              <Save className="w-3 h-3" /> Salvar Lote
                            </button>
                          ) : (
                            <span className="text-gray-400 font-medium text-[11px]">
                              -
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredBatches.length === 0 && (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-gray-400">
                          Nenhum lote correspondente aos filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'REGRA_3' && (
          <div className="p-6">
            <div className="mb-6">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Regra de Conciliação 3 & 4
              </span>
              <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
                Assinaturas Recebidas no Balcão (Cartão / PIX) vs. Gateway
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                Roteamento de Entradas Manuais para a Adquirente ou Banco e Validação de Baixas Externas.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-zinc-800 text-[11px] font-black uppercase text-gray-400 tracking-wider bg-gray-50/50 dark:bg-zinc-800/30">
                    <th className="py-3 px-4">Cliente / ID</th>
                    <th className="py-3 px-4">Origem</th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Valor Bruto</th>
                    <th className="py-3 px-4">Valor Líquido</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {items
                    .filter((i) => i.regra.includes('REGRA_3') || i.regra.includes('REGRA_4'))
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40">
                        <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                          {item.clienteOuDesc}
                          <span className="block text-[11px] text-gray-400 font-normal mt-0.5">
                            Ref: {item.identificador}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-700 dark:text-zinc-300 font-medium">
                          {item.modalidadeOuPlano}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-zinc-300">{item.dataVenda}</td>
                        <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                          {item.valorBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                          {item.valorLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          {item.valorMdrRetido > 0 && (
                            <span className="block text-[10px] text-amber-600 font-normal mt-0.5">
                              MDR Rede: -{item.valorMdrRetido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">{renderStatusBadge(item.status)}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleManualReconciliation(item.id)}
                            className="px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 font-bold rounded-lg transition"
                            title="Forçar Conciliação / Alterar Status"
                          >
                            Corrigir
                          </button>
                        </td>
                      </tr>
                    ))}
                  {items.filter((i) => i.regra.includes('REGRA_3') || i.regra.includes('REGRA_4')).length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400">
                        Nenhuma Assinatura de Balcão processada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA 4: AUDITORIA DE DIVERGÊNCIAS & TAXAS */}
        {activeTab === 'DIVERGENCIAS' && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
                  Painel de Auditoria e Divergências
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Filtre as transações que necessitam de intervenção ou contestação junto à operadora/gateway.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500">Filtrar por:</span>
                <select
                  value={divergenceFilter}
                  onChange={(e) => setDivergenceFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-gray-700 dark:text-zinc-200"
                >
                  <option value="TODAS">Todas as Divergências</option>
                  <option value="DIVERGENCIA_TAXA">Divergência de Taxa MDR</option>
                  <option value="NAO_AUTORIZADO">Não Autorizado no Gateway</option>
                  <option value="PENDENTE_LIQUIDACAO">Pendente Liquidação (D+31)</option>
                  <option value="NAO_ENCONTRADO_REDE">Não Encontrado na Rede</option>
                </select>
              </div>
            </div>

            {selectedAuditRows.size > 0 && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between">
                <span className="text-sm font-bold text-blue-800 dark:text-blue-300">
                  {selectedAuditRows.size} itens selecionados
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={bulkAuditStatus}
                    onChange={e => setBulkAuditStatus(e.target.value as StatusDivergencia)}
                    className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs font-bold"
                  >
                    <option value="">Alterar status para...</option>
                    <option value="CONCILIADO">CONCILIADO</option>
                    <option value="PENDENTE_LIQUIDACAO">PENDENTE D+31</option>
                    <option value="DIVERGENCIA_TAXA">DIVERGÊNCIA DE TAXA</option>
                    <option value="NAO_AUTORIZADO">NÃO AUTORIZADO</option>
                    <option value="NAO_ENCONTRADO_REDE">NÃO ENCONTRADO NA REDE</option>
                  </select>
                  <button
                    onClick={handleBulkStatusChange}
                    disabled={!bulkAuditStatus}
                    className="px-4 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-zinc-800 text-[11px] font-black uppercase text-gray-400 tracking-wider bg-gray-50/50 dark:bg-zinc-800/30">
                    <th className="py-3 px-4 w-10 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300"
                        checked={filteredDivergences.length > 0 && selectedAuditRows.size === filteredDivergences.length}
                        onChange={(e) => handleToggleSelectAll(e, filteredDivergences)}
                      />
                    </th>
                    <th className="py-3 px-4">Regra</th>
                    <th className="py-3 px-4">Referência / Cliente</th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Valor Bruto</th>
                    <th className="py-3 px-4">Taxa Cobrada</th>
                    <th className="py-3 px-4">Taxa Contratual</th>
                    <th className="py-3 px-4">Diferença / Impacto</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Diagnóstico</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {filteredDivergences.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40">
                      <td className="py-3 px-4 text-center">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300"
                          checked={selectedAuditRows.has(item.id)}
                          onChange={() => handleToggleSelectRow(item.id)}
                        />
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-500">
                        {item.regra === 'REGRA_1_CLUBE_PREVISAO' ? 'Clube (D+31)' : 'PDV / Rede'}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-gray-900 dark:text-white">{item.clienteOuDesc}</p>
                        <p className="text-[11px] font-mono text-gray-400">{item.identificador}</p>
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-zinc-300">{item.dataVenda}</td>
                      <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                        {item.valorBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="py-3 px-4 font-bold text-red-600 dark:text-red-400">
                        {item.mdrTaxaEfetiva}%
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {item.mdrTaxaContratual ? `${item.mdrTaxaContratual}%` : '-'}
                      </td>
                      <td className="py-3 px-4 font-bold text-orange-600 dark:text-orange-400">
                        {item.diferencaTaxa > 0 ? `+${item.diferencaTaxa}%` : '-'}
                      </td>
                      <td className="py-3 px-4">{renderStatusBadge(item.status)}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-zinc-300 max-w-xs">
                        {item.statusDescricao}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleManualReconciliation(item.id)}
                            className="px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 font-bold rounded-lg transition"
                            title="Forçar Conciliação / Alterar Status"
                          >
                            Corrigir
                          </button>
                          {(item.modalidadeOuPlano?.toLowerCase().includes('estorno') || item.modalidadeOuPlano?.toLowerCase().includes('cancelamento') || item.statusDescricao?.toLowerCase().includes('estorno')) && (
                            <button
                              onClick={() => handleTratarEstorno(item.id)}
                              className="px-2.5 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 dark:text-orange-400 font-bold rounded-lg transition text-xs whitespace-nowrap"
                              title="Zerar valor bruto e lançar MDR como despesa"
                            >
                              Tratar Estorno
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredDivergences.length === 0 && (
                    <tr>
                      <td colSpan={11} className="text-center py-8 text-emerald-600 font-bold">
                        Nenhuma divergência encontrada para este filtro!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA 5: CÓDIGO BACKEND PYTHON & POSTGRESQL */}
        {activeTab === 'CODIGO_BACKEND' && (
          <div className="p-6 space-y-6">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Arquitetura FinTech Modular
              </span>
              <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
                Scripts do Backend (Python / FastAPI) e Esquema SQL Relacional (PostgreSQL)
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                Os módulos foram criados diretamente nos diretórios do projeto (/backend/reconciliation_engine.py, /backend/main.py, /backend/schema.sql).
              </p>
            </div>

            {/* Caixa 1: Python Engine */}
            <div className="bg-zinc-950 text-zinc-100 p-5 rounded-2xl border border-zinc-800 shadow-sm relative">
              <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-3">
                <span className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-2">
                  <FileCode className="w-4 h-4" />
                  backend/reconciliation_engine.py
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `# Motor de Conciliação Python Barbearia Vangard\n# Salvo em /backend/reconciliation_engine.py`,
                      'python'
                    )
                  }
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                >
                  {copiedCodeTab === 'python' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCodeTab === 'python' ? 'Copiado!' : 'Copiar Caminho'}
                </button>
              </div>
              <p className="text-xs text-zinc-400 mb-2">
                Contém classes <code className="text-emerald-300">FinTechParser</code> (tratamento de encoding UTF-8/Latin1, limpeza de "R$ 70,00", normalização de datas) e <code className="text-emerald-300">ReconciliationEngine</code> (Regras 1 e 2, auditoria de MDR e cálculo de KPIs).
              </p>
              <pre className="text-[11px] font-mono text-zinc-300 overflow-x-auto bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80">
{`from reconciliation_engine import FinTechParser, ReconciliationEngine

# Ingestão e execução direta:
engine = ReconciliationEngine(df_pdv, df_clube, df_rede_pag, df_rede_rec, df_prev)
resultado = engine.run()
kpis = resultado['kpis']`}
              </pre>
            </div>

            {/* Caixa 2: PostgreSQL Schema */}
            <div className="bg-zinc-950 text-zinc-100 p-5 rounded-2xl border border-zinc-800 shadow-sm relative">
              <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-3">
                <span className="font-mono text-xs font-bold text-blue-400 flex items-center gap-2">
                  <FileCode className="w-4 h-4" />
                  backend/schema.sql (PostgreSQL Relacional)
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `-- Esquema SQL PostgreSQL Barbearia Vangard\n-- Salvo em /backend/schema.sql`,
                      'sql'
                    )
                  }
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                >
                  {copiedCodeTab === 'sql' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCodeTab === 'sql' ? 'Copiado!' : 'Copiar Caminho'}
                </button>
              </div>
              <p className="text-xs text-zinc-400 mb-2">
                Esquema com 7 tabelas normalizadas (<code className="text-blue-300">pdv_movimentacoes</code>, <code className="text-blue-300">gateway_clube_transacoes</code>, <code className="text-blue-300">adquirente_rede_pagamentos</code>, <code className="text-blue-300">previsao_recebiveis_futuros</code>, <code className="text-blue-300">lotes_fechamento_caixa</code>, <code className="text-blue-300">conciliacoes_auditoria</code>) e a view de projeção <code className="text-blue-300">view_projecao_fluxo_caixa</code>.
              </p>
            </div>
          </div>
        )}
      </div>


      {showSessionsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                Relatórios Salvos (Cloud Firestore)
              </h3>
              <button 
                onClick={() => setShowSessionsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-bold">Nenhum relatório salvo encontrado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map(s => (
                    <div key={s.id} className="p-4 border border-gray-200 dark:border-zinc-800 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                            Lote: {s.name || new Date(s.createdAt).toLocaleString('pt-BR')}
                            {s.unidade && (
                              <span className="text-[10px] font-bold bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded ml-2">
                                {s.unidade}
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {s.items?.length || 0} transações processadas | Total Bruto: {(s.kpis?.totalBruto || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                        </p>
                      </div>
                      <button
                        onClick={() => handleLoadSession(s)}
                        className="px-4 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 font-bold text-xs rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition"
                      >
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isManualReconModalOpen && manualReconItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                Conciliação Manual
              </h3>
              <button 
                onClick={() => setIsManualReconModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-zinc-400 font-semibold mb-1">Transação / Cliente</p>
                <p className="font-bold text-sm text-gray-900 dark:text-white">
                  {manualReconItem.clienteOuDesc}
                  <span className="block text-xs font-normal text-gray-500 mt-0.5">Ref: {manualReconItem.identificador}</span>
                </p>
                <p className="text-xs text-gray-500 font-medium mt-1">Valor Original (Bruto): {manualReconItem.valorBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-zinc-400 mb-1 uppercase tracking-wider">
                    Valor Líquido (R$)
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={manualReconLiquido}
                    onChange={e => setManualReconLiquido(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-zinc-400 mb-1 uppercase tracking-wider">
                    Data de Liquidação
                  </label>
                  <input 
                    type="date" 
                    value={manualReconDate}
                    onChange={e => setManualReconDate(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-zinc-400 mb-1 uppercase tracking-wider">
                  Novo Status
                </label>
                <select
                  value={manualReconStatus}
                  onChange={e => setManualReconStatus(e.target.value as ConciliationItem['status'])}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CONCILIADO">CONCILIADO</option>
                  <option value="PENDENTE_LIQUIDACAO">PENDENTE LIQUIDAÇÃO</option>
                  <option value="RECEBIDO_FORA_DO_GATEWAY">RECEBIDO FORA DO GATEWAY</option>
                  <option value="CONCILIADO_REDE">CONCILIADO REDE</option>
                  <option value="NAO_AUTORIZADO">NÃO AUTORIZADO</option>
                  <option value="DIVERGENCIA_TAXA">DIVERGÊNCIA DE TAXA</option>
                  <option value="NAO_ENCONTRADO_REDE">NÃO ENCONTRADO NA REDE</option>
                  <option value="ALERTA_ENTRADA_SEM_GATEWAY">ALERTA ENTRADA SEM GATEWAY</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-zinc-400 mb-1 uppercase tracking-wider">
                  Justificativa / Obs (Opcional)
                </label>
                <input 
                  type="text" 
                  value={manualReconJustification}
                  onChange={e => setManualReconJustification(e.target.value)}
                  placeholder="Ex: Localizado extrato sob ID #123"
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/30 flex justify-end gap-2">
              <button 
                onClick={() => setIsManualReconModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmManualReconciliation}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
