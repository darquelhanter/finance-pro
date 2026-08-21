/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard, 
  CalendarClock, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  AlertCircle,
  PlusCircle,
  Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { DashboardResumo, Conta, CartaoCredito, Lancamento } from '../types';
import { formatarMoeda } from '../utils/format';

interface DashboardViewProps {
  resumo?: DashboardResumo;
  contas?: Conta[];
  cartoes?: CartaoCredito[];
  onPagarLancamento: (id: string) => void;
  onNovoLancamento: () => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  resumo = {
    saldoTotalConsolidado: 0,
    receitasMes: 0,
    despesasMes: 0,
    saldoPrevistoFinalMes: 0,
    faturasAbertasTotal: 0,
    lancamentosPendentesCount: 0,
    despesasPorCategoria: [],
    proximosVencimentos: [],
    fluxoMensal: [],
  },
  contas = [],
  cartoes = [],
  onPagarLancamento,
  onNovoLancamento,
  onNavigateTab,
}) => {
  const fluxoMensal = resumo?.fluxoMensal || [];
  const despesasPorCategoria = resumo?.despesasPorCategoria || [];
  const proximosVencimentos = resumo?.proximosVencimentos || [];

  return (
    <div id="dashboard-view" className="space-y-8 animate-fadeIn">
      
      {/* Top Banner with Quick Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Visão Geral Consolidada</span>
            <span className="text-xs text-slate-400 capitalize">• {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date())}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Painel Financeiro & Motor de Domínio
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Controle automatizado de saldos, compras parceladas, recorrências e importação de faturas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-dash-import-ia"
            onClick={() => onNavigateTab('importacao_ia')}
            className="px-4 py-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 transition-all flex items-center gap-2 text-xs font-semibold shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-teal-400 animate-pulse" />
            <span>Importar Fatura com IA</span>
          </button>

          <button
            id="btn-dash-novo"
            onClick={onNovoLancamento}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-2 text-xs font-semibold shadow-md shadow-emerald-950/50"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Lançamento</span>
          </button>
        </div>
      </div>

      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Saldo Consolidado */}
        <div id="kpi-saldo-total" className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Saldo Total em Contas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {formatarMoeda(resumo?.saldoTotalConsolidado)}
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-medium">{contas.filter(c => c.ativa).length} contas ativas</span> sincronizadas
            </p>
          </div>
        </div>

        {/* Card 2: Receitas do Mês */}
        <div id="kpi-receitas-mes" className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Receitas do Mês</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-teal-400 tracking-tight">
              + {formatarMoeda(resumo?.receitasMes)}
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-teal-400" /> Entradas confirmadas
            </p>
          </div>
        </div>

        {/* Card 3: Despesas do Mês */}
        <div id="kpi-despesas-mes" className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Despesas do Mês</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-400 tracking-tight">
              - {formatarMoeda(resumo?.despesasMes)}
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" /> Contas e cartões
            </p>
          </div>
        </div>

        {/* Card 4: Faturas / Balanço */}
        <div id="kpi-faturas-abertas" className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Faturas em Aberto</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-300 tracking-tight">
              {formatarMoeda(resumo?.faturasAbertasTotal)}
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="text-indigo-400 font-medium">{cartoes.length} cartões</span> gerenciados
            </p>
          </div>
        </div>
      </div>

      {/* Middle Section: Chart + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Cashflow Chart (2 Cols) */}
        <div id="chart-fluxo-caixa" className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-white">Evolução de Fluxo de Caixa</h2>
              <p className="text-xs text-slate-400">Comparativo dos últimos 6 meses (Receitas vs Despesas)</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-sm bg-teal-500"></span> Receitas
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-sm bg-rose-500"></span> Despesas
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fluxoMensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="mes" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} tickFormatter={(val) => `R$${val / 1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  formatter={(value: any) => [formatarMoeda(Number(value) || 0), '']}
                />
                <Bar dataKey="receitas" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Receitas" />
                <Bar dataKey="despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense by Category (1 Col) */}
        <div id="breakdown-categorias" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Despesas por Categoria</h2>
              <p className="text-xs text-slate-400">Distribuição no mês atual</p>
            </div>
            <button 
              onClick={() => onNavigateTab('orcamentos')} 
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Ver limites
            </button>
          </div>

          <div className="space-y-3.5 flex-1 flex flex-col justify-center">
            {despesasPorCategoria.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Nenhuma despesa registrada neste mês.</p>
            ) : (
              despesasPorCategoria.slice(0, 5).map((cat) => (
                <div key={cat.categoriaId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium truncate max-w-[140px]">{cat.categoriaNome}</span>
                    <span className="text-slate-400 font-mono">
                      {formatarMoeda(cat.valor)} ({cat.percentual || 0}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ width: `${cat.percentual || 0}%`, backgroundColor: cat.cor || '#10b981' }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Upcoming Due Dates & Accounts Quick Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Próximos Vencimentos (2 Cols) */}
        <div id="section-proximos-vencimentos" className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-semibold text-white">Próximos Vencimentos Pendentes</h2>
            </div>
            <button
              onClick={() => onNavigateTab('lancamentos')}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Ver todos ({resumo?.lancamentosPendentesCount || 0})
            </button>
          </div>

          <div className="divide-y divide-slate-800/80">
            {proximosVencimentos.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                Tudo em dia! Nenhum lançamento pendente encontrado.
              </div>
            ) : (
              proximosVencimentos.map((lanc) => (
                <div key={lanc.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold ${
                      lanc.tipo === 'receita' ? 'bg-teal-500/10 text-teal-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {lanc.tipo === 'receita' ? '+' : '-'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                        <span>{lanc.descricao}</span>
                        {lanc.parcela && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                            {lanc.parcela.numero}/{lanc.parcela.total}
                          </span>
                        )}
                        {lanc.recorrencia && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                            {lanc.recorrencia.frequencia}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          Vence em: {lanc.dataVencimento ? lanc.dataVencimento.split('-').reverse().join('/') : '-'}
                        </span>
                        {lanc.dataVencimento && lanc.dataVencimento < new Date().toISOString().split('T')[0] && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold text-[10px] border border-rose-500/30 flex items-center gap-0.5">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Vencida (Atraso)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-sm font-bold font-mono ${
                      lanc.tipo === 'receita' ? 'text-teal-400' : 'text-slate-100'
                    }`}>
                      {formatarMoeda(lanc.valor)}
                    </span>

                    <button
                      id={`btn-pagar-rapido-${lanc.id}`}
                      onClick={() => onPagarLancamento(lanc.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 transition-all text-xs font-medium flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Pagar</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Accounts & Cards Summary (1 Col) */}
        <div id="section-contas-resumo" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">Saldos por Conta</h2>
              </div>
              <button
                onClick={() => onNavigateTab('contas_cartoes')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Gerenciar
              </button>
            </div>

            <div className="space-y-3">
              {contas.map((c) => (
                <div key={c.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.cor || '#10b981' }}></div>
                    <div>
                      <div className="text-xs font-semibold text-white">{c.nome}</div>
                      <div className="text-[11px] text-slate-400 capitalize">{c.tipo}</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono text-slate-200">
                    {formatarMoeda(c.saldoAtual)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/70 mt-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Cartões configurados:</span>
              <span className="font-semibold text-slate-200">{cartoes.length} ativos</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
