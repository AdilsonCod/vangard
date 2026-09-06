import React, { useState, useEffect } from 'react';
import { Bot, AlertTriangle, CheckCircle, Info, ArrowRight, Loader2, DollarSign, TrendingUp, Users, MousePointerClick, Activity, Brain, BarChart2, Share2, Calculator, Percent, Coins, LayoutDashboard, Megaphone, CalendarDays, Library, LayoutGrid } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { SocialMediaBoard } from './SocialMediaBoard';
import { AppPageHeader } from './ui/AppPrimitives';
import { MarketingOperations } from './MarketingOperations';

interface AlertaGargalo {
  tipo: 'TRAFEGO' | 'CONTEUDO' | 'OPERACIONAL';
  descricao: string;
}

interface AjusteRapido {
  acao: string;
  justificativa: string;
  impacto_esperado: string;
}

interface MetricasChaves {
  roas_atual: number;
  cpa_status: 'BOM' | 'ALTO' | 'CRÍTICO';
  orcamento_utilizado_porcentagem: number;
}

interface MarketingResponse {
  status_geral_marketing: 'CRÍTICO' | 'ATENÇÃO' | 'SAUDÁVEL';
  resumo_executivo: string;
  metricas_chave: MetricasChaves;
  alertas_gargalos: AlertaGargalo[];
  ajustes_rapidos_sugeridos: AjusteRapido[];
}

export function MarketingDashboard() {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CAMPAIGNS' | 'PRODUCTION' | 'CALENDAR' | 'TRAFFIC' | 'RESULTS' | 'LIBRARY'>('OVERVIEW');
  const [activeSubTab, setActiveSubTab] = useState<'DIAGNOSTIC' | 'CALCULATOR'>('DIAGNOSTIC');

  const [conteudos, setConteudos] = useState<string>('');
  const [metricas, setMetricas] = useState<string>('');
  const [contexto, setContexto] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<MarketingResponse | null>(null);
  const [error, setError] = useState('');

  // Estados da Calculadora de Métricas (CPA, ROAS, ROI)
  const [investimentoCalc, setInvestimentoCalc] = useState<number>(500);
  const [faturamentoCalc, setFaturamentoCalc] = useState<number>(2500);
  const [clientesCalc, setClientesCalc] = useState<number>(25);
  const [outrosCustosCalc, setOutrosCustosCalc] = useState<number>(200);

  const cacCalc = clientesCalc > 0 ? investimentoCalc / clientesCalc : 0;
  const roasCalc = investimentoCalc > 0 ? faturamentoCalc / investimentoCalc : 0;
  const ticketMedioCalc = clientesCalc > 0 ? faturamentoCalc / clientesCalc : 0;
  
  const custoGeralCampanha = investimentoCalc + outrosCustosCalc;
  const lucroCalculado = faturamentoCalc - custoGeralCampanha;
  const roiCalc = custoGeralCampanha > 0 ? (lucroCalculado / custoGeralCampanha) * 100 : 0;

  // Cálculo de Status
  let cacStatus = { label: 'Sem dados', color: 'text-gray-400' };
  if (cacCalc > 0 && ticketMedioCalc > 0) {
    const ratio = cacCalc / ticketMedioCalc;
    if (ratio < 0.3) {
      cacStatus = { label: 'Altamente Saudável (Abaixo de 30% do Ticket)', color: 'text-emerald-600 dark:text-[#10b981]' };
    } else if (ratio < 0.6) {
      cacStatus = { label: 'Moderado / Atenção (30% a 60% do Ticket)', color: 'text-amber-500' };
    } else {
      cacStatus = { label: 'Crítico / Inviável (Acima de 60% do Ticket)', color: 'text-red-500 font-bold' };
    }
  }

  let roasStatus = { label: 'Sem dados', color: 'text-gray-400' };
  if (roasCalc > 0) {
    if (roasCalc >= 4) {
      roasStatus = { label: 'Excelente Eficiência (Faturamento >= 4x Gasto)', color: 'text-emerald-600 dark:text-[#10b981]' };
    } else if (roasCalc >= 2) {
      roasStatus = { label: 'Média Saudável (Faturamento >= 2x Gasto)', color: 'text-[var(--theme-color)]' };
    } else {
      roasStatus = { label: 'Baixa Eficiência (Abaixo de 2x Gasto)', color: 'text-red-500' };
    }
  }

  let roiStatus = { label: 'Sem retorno', color: 'text-gray-400' };
  if (roiCalc !== 0) {
    if (roiCalc > 150) {
      roiStatus = { label: 'Altamente Lucrativo (Faturamento supera custos em muito)', color: 'text-emerald-600 dark:text-[#10b981]' };
    } else if (roiCalc > 0) {
      roiStatus = { label: 'Retorno Positivo', color: 'text-blue-500 dark:text-blue-400' };
    } else {
      roiStatus = { label: 'Prejuízo Operacional (Não cobre os custos investidos)', color: 'text-red-500 font-bold' };
    }
  }

  const fillExampleData = () => {
    setConteudos("Segunda: Vídeo combo corte + barba\nQuarta: Reel motivacional barbeiros\nSexta: Foto cliente antes/depois");
    setMetricas("Investimento: R$ 350,00\nCliques: 120\nLeads (agendamentos direct): 15\nFaturamento estimado: R$ 900,00 (Ticket médio R$ 60)");
    setContexto("Unidade Centro com ociosidade nas tardes de terça a quinta. Precisa de mais movimento nesses horários. Finais de semana lotados.");
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/analyze-marketing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conteudos,
          metricas,
          contexto,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao analisar os dados de marketing.');
      
      setAnalysis(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SAUDÁVEL':
      case 'BOM':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50';
      case 'ATENÇÃO':
      case 'ALTO':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50';
      case 'CRÍTICO':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300';
    }
  };

  return (
    <div className="space-y-6">
      <AppPageHeader
        eyebrow="Análises"
        title="Marketing e crescimento"
        description="Acompanhe tráfego, retorno dos investimentos e planejamento das redes sociais."
        icon={<Bot className="h-5 w-5" />}
      />
      <div className="flex gap-4 border-b border-gray-200 dark:border-zinc-800 font-sans overflow-x-auto">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`flex items-center gap-2 pb-3 px-2 font-bold text-sm tracking-wide transition-colors whitespace-nowrap border-b-2 ${
            activeTab === 'OVERVIEW'
              ? "border-[var(--theme-color)] text-[var(--theme-color)]"
              : "border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <LayoutDashboard className="w-4 h-4" /> Visão Geral
        </button>
        <button
          onClick={() => setActiveTab('CAMPAIGNS')}
          className={`flex items-center gap-2 pb-3 px-2 font-bold text-sm tracking-wide transition-colors whitespace-nowrap border-b-2 ${
            activeTab === 'CAMPAIGNS'
              ? "border-[var(--theme-color)] text-[var(--theme-color)]"
              : "border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Megaphone className="w-4 h-4" /> Planejamento
        </button>
        <button
          onClick={() => setActiveTab('PRODUCTION')}
          className={`flex items-center gap-2 pb-3 px-2 font-bold text-sm tracking-wide transition-colors whitespace-nowrap border-b-2 ${
            activeTab === 'PRODUCTION'
              ? "border-[var(--theme-color)] text-[var(--theme-color)]"
              : "border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <LayoutGrid className="w-4 h-4" /> Produção
        </button>
        <button
          onClick={() => setActiveTab('CALENDAR')}
          className={`flex items-center gap-2 pb-3 px-2 font-bold text-sm tracking-wide transition-colors whitespace-nowrap border-b-2 ${
            activeTab === 'CALENDAR'
              ? "border-[var(--theme-color)] text-[var(--theme-color)]"
              : "border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <CalendarDays className="w-4 h-4" /> Calendário
        </button>
        <button onClick={() => { setActiveTab('TRAFFIC'); setActiveSubTab('DIAGNOSTIC'); }} className={`flex items-center gap-2 pb-3 px-2 font-bold text-sm tracking-wide transition-colors whitespace-nowrap border-b-2 ${activeTab === 'TRAFFIC' ? 'border-[var(--theme-color)] text-[var(--theme-color)]' : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200'}`}>
          <BarChart2 className="w-4 h-4" /> Tráfego
        </button>
        <button onClick={() => { setActiveTab('RESULTS'); setActiveSubTab('CALCULATOR'); }} className={`flex items-center gap-2 pb-3 px-2 font-bold text-sm tracking-wide transition-colors whitespace-nowrap border-b-2 ${activeTab === 'RESULTS' ? 'border-[var(--theme-color)] text-[var(--theme-color)]' : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200'}`}>
          <TrendingUp className="w-4 h-4" /> Resultados
        </button>
        <button onClick={() => setActiveTab('LIBRARY')} className={`flex items-center gap-2 pb-3 px-2 font-bold text-sm tracking-wide transition-colors whitespace-nowrap border-b-2 ${activeTab === 'LIBRARY' ? 'border-[var(--theme-color)] text-[var(--theme-color)]' : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200'}`}>
          <Library className="w-4 h-4" /> Biblioteca
        </button>
      </div>

      {activeTab === 'OVERVIEW' ? (
        <MarketingOperations view="OVERVIEW" onNavigate={(view) => setActiveTab(view)} />
      ) : activeTab === 'CAMPAIGNS' ? (
        <MarketingOperations view="CAMPAIGNS" onNavigate={(view) => setActiveTab(view)} />
      ) : activeTab === 'TRAFFIC' || activeTab === 'RESULTS' ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-[var(--theme-color)]" />
                Inteligência de Marketing e Tráfego
              </h2>
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                Mensure os resultados de anúncios e receba análises estratégicas de IA integradas ao seu cenário de barbearia.
              </p>
            </div>
          </div>

          {/* Sub-abas de Inteligência e Tráfego */}
          <div className="flex gap-4 border-b border-gray-200 dark:border-zinc-800/60 pb-px">
            <button
              onClick={() => setActiveSubTab('DIAGNOSTIC')}
              className={`pb-2 px-1 text-sm font-bold transition-colors border-b-2 ${
                activeSubTab === 'DIAGNOSTIC'
                  ? "border-black text-black dark:border-white dark:text-white"
                  : "border-transparent text-gray-400 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-zinc-300"
              }`}
            >
              Análise e Diagnóstico de IA
            </button>
            <button
              onClick={() => setActiveSubTab('CALCULATOR')}
              className={`pb-2 px-1 text-sm font-bold transition-colors border-b-2 ${
                activeSubTab === 'CALCULATOR'
                  ? "border-black text-black dark:border-white dark:text-white"
                  : "border-transparent text-gray-400 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-zinc-300"
              }`}
            >
              Calculadora (CAC, ROAS & ROI)
            </button>
          </div>

          {activeSubTab === 'DIAGNOSTIC' ? (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in duration-200">
              {/* Formulário de Input */}
              <div className="xl:col-span-6 space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-bold text-gray-900 dark:text-zinc-100 block mb-2">
                      Cronograma de Conteúdos
                    </label>
                    <textarea
                      value={conteudos}
                      onChange={(e) => setConteudos(e.target.value)}
                      placeholder="Ex:- Segunda: Vídeo combo...- Quarta: Reel motivacional..."
                      className="w-full h-32 border border-gray-300 dark:border-zinc-700 p-3 rounded-xl font-medium outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-transparent text-gray-900 dark:text-zinc-100 resize-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-900 dark:text-zinc-100 block mb-2">
                      Métricas de Tráfego Pago
                    </label>
                    <textarea
                      value={metricas}
                      onChange={(e) => setMetricas(e.target.value)}
                      placeholder="Ex: Investimento R$200, CPC R$0.50, ROAS 1.2..."
                      className="w-full h-32 border border-gray-300 dark:border-zinc-700 p-3 rounded-xl font-medium outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-transparent text-gray-900 dark:text-zinc-100 resize-none text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-bold text-gray-900 dark:text-zinc-100 block mb-2">
                      Contexto Operacional Atual
                    </label>
                    <textarea
                      value={contexto}
                      onChange={(e) => setContexto(e.target.value)}
                      placeholder="Ex: Unidade X com agendas vazias nas tardes de terça..."
                      className="w-full h-24 border border-gray-300 dark:border-zinc-700 p-3 rounded-xl font-medium outline-none focus:ring-2 focus:ring-[var(--theme-color)] bg-transparent text-gray-900 dark:text-zinc-100 resize-none text-sm"
                    />
                  </div>
                  
                  <div className="flex gap-4 mt-6">
                    <button
                      onClick={handleAnalyze}
                      disabled={loading}
                      className="bg-[var(--theme-color)] hover:bg-[var(--theme-color-strong)] text-white font-bold py-3 px-6 rounded-xl shadow transition flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Analisando...</>
                      ) : (
                        <><Brain className="w-5 h-5" /> Gerar Análise de Inteligência</>
                      )}
                    </button>
                    
                    <button
                      onClick={fillExampleData}
                      type="button"
                      className="bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-bold py-3 px-6 rounded-xl shadow-sm transition"
                    >
                      Preencher Exemplo
                    </button>
                  </div>
                  {error && <p className="text-red-500 text-sm mt-3 font-semibold">{error}</p>}
                </div>
              </div>

              {/* Relatório Visual */}
              <div className="xl:col-span-6 bg-gray-50 dark:bg-zinc-900/50 rounded-2xl border border-gray-200 dark:border-zinc-800/80 p-6">
                {analysis ? (
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm p-6 animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <Bot className="w-6 h-6 text-[var(--theme-color)]" /> Relatório Executivo AI
                      </h3>
                      <div className={`px-4 py-1.5 rounded-full border text-sm font-bold tracking-widest ${getStatusColor(analysis.status_geral_marketing)}`}>
                        {analysis.status_geral_marketing}
                      </div>
                    </div>

                    <div className="bg-indigo-50 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-200 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 mb-6 font-medium leading-relaxed">
                      {analysis.resumo_executivo}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                      <div className="p-4 rounded-xl border bg-gray-50 border-gray-200 dark:bg-zinc-800/50 dark:border-zinc-700 flex flex-col justify-center">
                        <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">ROAS do Período</p>
                        <p className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-end gap-1">
                          {analysis.metricas_chave.roas_atual.toFixed(2)}x
                        </p>
                      </div>
                      <div className={`p-4 rounded-xl border flex flex-col justify-center ${getStatusColor(analysis.metricas_chave.cpa_status)}`}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-1 opacity-80">Status do CPA</p>
                        <p className="text-2xl font-extrabold">{analysis.metricas_chave.cpa_status}</p>
                      </div>
                      <div className="p-4 rounded-xl border bg-gray-50 border-gray-200 dark:bg-zinc-800/50 dark:border-zinc-700 flex flex-col justify-center">
                        <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Verba Utilizada</p>
                        <p className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-end gap-1">
                          {analysis.metricas_chave.orcamento_utilizado_porcentagem}%
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Alertas */}
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100 uppercase tracking-wide flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-zinc-800 pb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" /> Alertas & Gargalos
                        </h4>
                        {analysis.alertas_gargalos && analysis.alertas_gargalos.length > 0 ? (
                          <ul className="space-y-3">
                            {analysis.alertas_gargalos.map((alerta, idx) => (
                              <li key={idx} className="flex flex-col gap-1 text-sm bg-red-50 dark:bg-red-950/10 p-3.5 rounded-xl border border-red-100 dark:border-red-900/30">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-red-200/50 dark:bg-red-900/50 text-red-800 dark:text-red-300 px-2 py-0.5 rounded">
                                    {alerta.tipo}
                                  </span>
                                </div>
                                <p className="text-gray-800 dark:text-gray-300 mt-1">{alerta.descricao}</p>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-gray-500 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-xl flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            Nenhum gargalo severo detectado.
                          </div>
                        )}
                      </div>

                      {/* Ações Curtas */}
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100 uppercase tracking-wide flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-zinc-800 pb-2">
                          <ArrowRight className="w-4 h-4 text-blue-500" /> Ações Sugeridas
                        </h4>
                        {analysis.ajustes_rapidos_sugeridos && analysis.ajustes_rapidos_sugeridos.length > 0 ? (
                          <ul className="space-y-4">
                            {analysis.ajustes_rapidos_sugeridos.map((ajuste, idx) => (
                              <li key={idx} className="flex gap-3 text-sm bg-blue-50 dark:bg-blue-950/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                <div className="w-6 h-6 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold mt-0.5 shadow-sm">
                                  {idx + 1}
                                </div>
                                <div className="space-y-1.5 flex-1">
                                  <p className="font-bold text-blue-900 dark:text-blue-300">{ajuste.acao}</p>
                                  <p className="text-gray-700 dark:text-gray-400 text-xs leading-relaxed">{ajuste.justificativa}</p>
                                  <div className="mt-2 pt-2 border-t border-blue-200/50 dark:border-blue-800/30">
                                    <p className="text-xs font-medium italic text-emerald-700 dark:text-emerald-400">
                                      ↳ {ajuste.impacto_esperado}
                                    </p>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-gray-500">Nenhum ajuste prioritário necessário.</div>
                        )}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-gray-400 dark:text-zinc-500 rounded-2xl">
                    <Brain className="w-16 h-16 opacity-30 text-gray-400 dark:text-zinc-600 mb-4" />
                    <p className="font-medium text-center px-6 max-w-sm">
                      Preencha os dados à esquerda e clique no botão para gerar um diagnóstico executivo do marketing.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Calculadora Tática de CAC, ROAS & ROI */
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800/80 p-6 rounded-2xl shadow-sm space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-gray-150 dark:border-zinc-800/60 pb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-[var(--theme-color)]" />
                  Simulador de Métricas: CAC, ROAS & ROI
                </h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Calcule e simule a lucratividade das suas campanhas de tráfego, compare o custo de aquisição (CAC) com o seu ticket médio de serviços e mensure o verdadeiro ROI integrado.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Entradas (Escorregadores & Campos de texto rápido) */}
                <div className="lg:col-span-5 space-y-5">
                  <div className="bg-gray-50/50 dark:bg-zinc-800/30 p-4 rounded-xl border border-gray-150 dark:border-zinc-800/60 space-y-4">
                    <h4 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Variáveis de Campanha</h4>
                    
                    {/* Investimento */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-sm">
                        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300">Investimento em Tráfego (Anúncios):</label>
                        <span className="font-bold text-[var(--theme-color)]">R$ {investimentoCalc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <input 
                        type="range" 
                        min="50" 
                        max="10000" 
                        step="50"
                        value={investimentoCalc} 
                        onChange={(e) => setInvestimentoCalc(Number(e.target.value))}
                        className="w-full accent-[var(--theme-color)] cursor-pointer h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none outline-none"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span>R$ 50</span>
                        <span>R$ 10.000</span>
                      </div>
                    </div>

                    {/* Faturamento */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-sm">
                        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300">Faturamento Bruto (Total Gerado):</label>
                        <span className="font-bold text-[var(--theme-color)]">R$ {faturamentoCalc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <input 
                        type="range" 
                        min="100" 
                        max="50000" 
                        step="100"
                        value={faturamentoCalc} 
                        onChange={(e) => setFaturamentoCalc(Number(e.target.value))}
                        className="w-full accent-[var(--theme-color)] cursor-pointer h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none outline-none"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span>R$ 100</span>
                        <span>R$ 50.000</span>
                      </div>
                    </div>

                    {/* Clientes Novos */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-sm">
                        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300">Novos Clientes Atraídos:</label>
                        <span className="font-bold text-[var(--theme-color)]">{clientesCalc} agendados</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="550" 
                        step="1"
                        value={clientesCalc} 
                        onChange={(e) => setClientesCalc(Number(e.target.value))}
                        className="w-full accent-[var(--theme-color)] cursor-pointer h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none outline-none"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span>1 cliente</span>
                        <span>550 clientes</span>
                      </div>
                    </div>

                    {/* Outros Custos */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-sm">
                        <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 flex items-center gap-1">
                          Custos Operacionais Extra (Brindes/Taxas):
                          <span title="Custo com brindes, taxas de agendamento ou outros adicionais ao tráfego.">
                            <Info className="w-3.5 h-3.5 text-gray-400" />
                          </span>
                        </label>
                        <span className="font-bold text-gray-600 dark:text-zinc-400">R$ {outrosCustosCalc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="5000" 
                        step="50"
                        value={outrosCustosCalc} 
                        onChange={(e) => setOutrosCustosCalc(Number(e.target.value))}
                        className="w-full accent-gray-600 dark:accent-zinc-500 cursor-pointer h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none outline-none"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span>R$ 0</span>
                        <span>R$ 5.000</span>
                      </div>
                    </div>
                  </div>

                  {/* Ajustes manuais de precisão */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 dark:text-zinc-500 mb-1">Ajustar Investimento (R$)</label>
                      <input 
                        type="number" 
                        value={investimentoCalc}
                        onChange={(e) => setInvestimentoCalc(Math.max(0, Number(e.target.value)))}
                        className="w-full border border-gray-200 dark:border-zinc-800 rounded-lg p-2 text-xs font-semibold bg-transparent text-gray-900 dark:text-zinc-100 outline-none focus:border-[var(--theme-color)] focus:ring-1 focus:ring-[var(--theme-color)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 dark:text-zinc-500 mb-1">Ajustar Faturamento (R$)</label>
                      <input 
                        type="number" 
                        value={faturamentoCalc}
                        onChange={(e) => setFaturamentoCalc(Math.max(0, Number(e.target.value)))}
                        className="w-full border border-gray-200 dark:border-zinc-800 rounded-lg p-2 text-xs font-semibold bg-transparent text-gray-900 dark:text-zinc-100 outline-none focus:border-[var(--theme-color)] focus:ring-1 focus:ring-[var(--theme-color)]"
                      />
                    </div>
                  </div>
                </div>

                {/* KPI Output Cards */}
                <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* CAC Card */}
                  <div className="p-5 border border-gray-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">CPA / CAC</span>
                      <h4 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                        R$ {cacCalc.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-1">Custo de Aquisição por Cliente</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
                      <p className={`text-xs font-bold leading-tight ${cacStatus.color}`}>
                        {cacStatus.label}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">Ticket Médio Calculado: R$ {ticketMedioCalc.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  {/* ROAS Card */}
                  <div className="p-5 border border-gray-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">ROAS</span>
                      <h4 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                        {roasCalc.toFixed(2)}x
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-1">Retorno sobre Gasto de Anúncio</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
                      <p className={`text-xs font-bold leading-tight ${roasStatus.color}`}>
                        {roasStatus.label}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">Campanha retornou {roasCalc.toFixed(1)}x o investido</p>
                    </div>
                  </div>

                  {/* ROI Card */}
                  <div className="p-5 border border-gray-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">ROI Geral</span>
                      <h4 className={`text-2xl font-extrabold ${roiCalc >= 0 ? 'text-emerald-600 dark:text-[#10b981]' : 'text-red-500'}`}>
                        {roiCalc >= 0 ? '+' : ''}{roiCalc.toFixed(1)}%
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-1">Retorno Líquido Real</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
                      <p className={`text-xs font-bold leading-tight ${roiStatus.color}`}>
                        {roiStatus.label}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">Lucro de R$ {lucroCalculado.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="animate-in fade-in duration-300">
          <SocialMediaBoard initialTab={activeTab === 'CALENDAR' ? 'CALENDAR' : activeTab === 'LIBRARY' ? 'LIBRARY' : 'KANBAN'} hideTabs />
        </div>
      )}
    </div>
  );
}
