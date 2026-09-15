/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Lightbulb, 
  Sparkles, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  HelpCircle,
  Zap,
  ArrowRight
} from 'lucide-react';
import { InsightFinanceiro, DashboardResumo } from '../types';
import { formatarMoeda } from '../utils/format';
import { obterTokenAtual } from '../services/firebase/auth.service';

interface IaInsightsViewProps {
  resumo?: DashboardResumo;
}

export const IaInsightsView: React.FC<IaInsightsViewProps> = ({
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
}) => {
  const [insights, setInsights] = useState<InsightFinanceiro[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarInsights = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const token = await obterTokenAtual();
      const res = await fetch('/api/ia/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ resumo }),
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await res.json();
          setInsights(Array.isArray(data) ? data : []);
        }
      } else {
        setErro('Não foi possível gerar o diagnóstico agora. Tente novamente.');
      }
    } catch (err) {
      console.error('Falha ao carregar insights:', err);
      setErro('Falha de conexão ao gerar o diagnóstico. Verifique sua rede e tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarInsights();
  }, []);

  const receitas = resumo?.receitasMes ?? 0;
  const despesas = resumo?.despesasMes ?? 0;
  const margem = receitas > 0 ? Math.round(((receitas - despesas) / receitas) * 100) : 0;
  const maiorDespesaCat = resumo?.despesasPorCategoria?.[0];

  return (
    <div id="ia-insights-view" className="space-y-6 animate-fadeIn">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-teal-950/60 p-6 rounded-2xl border border-indigo-800/40 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Consultoria Financeira Automatizada</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Diagnóstico Financeiro & Recomendações IA
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              O motor analisa suas receitas, padrões de gastos por categoria e vencimentos para sugerir otimizações de fluxo de caixa, corte de custos ociosos e rentabilidade.
            </p>
          </div>

          <button
            id="btn-regerar-insights"
            onClick={carregarInsights}
            disabled={carregando}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-950/50 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
            <span>Atualizar Diagnóstico</span>
          </button>
        </div>
      </div>

      {/* Metric Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400">Margem Líquida Mensal</span>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            + {margem}%
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400">Maior Centro de Custo</span>
          <div className="text-sm font-bold text-white mt-1 truncate">
            {maiorDespesaCat ? `${maiorDespesaCat.categoriaNome} (${formatarMoeda(maiorDespesaCat.valor)})` : 'N/A'}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400">Saldo Livre Previsto</span>
          <div className="text-xl font-bold font-mono text-teal-300 mt-1">
            {formatarMoeda(resumo?.saldoPrevistoFinalMes)}
          </div>
        </div>
      </div>

      {/* Insights Cards List */}
      <div className="space-y-4">
        {carregando ? (
          <div role="status" aria-live="polite" className="p-12 text-center text-slate-400 text-xs bg-slate-900/50 rounded-2xl border border-slate-800">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-3" />
            Analisando fluxo e computando diagnósticos com Gemini 3.7…
          </div>
        ) : erro ? (
          <div role="alert" className="p-12 text-center text-xs bg-slate-900/50 rounded-2xl border border-rose-800/40">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
            <p className="text-rose-300 mb-3">{erro}</p>
            <button
              onClick={carregarInsights}
              className="px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        ) : insights.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs bg-slate-900/50 rounded-2xl border border-slate-800">
            Nenhum diagnóstico gerado ainda. Clique em “Atualizar Diagnóstico”.
          </div>
        ) : (
          insights.map((ins, index) => {
            const isOportunidade = ins.tipo === 'oportunidade';
            const isAlerta = ins.tipo === 'alerta';
            const isElogio = ins.tipo === 'elogio';

            return (
              <div
                key={ins.id || index}
                className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex items-start gap-4"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isOportunidade 
                    ? 'bg-indigo-500/10 text-indigo-400' 
                    : isAlerta 
                    ? 'bg-rose-500/10 text-rose-400' 
                    : 'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {isOportunidade ? <Zap className="w-5 h-5" /> : isAlerta ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                      {ins.tipo}
                    </span>
                    <h3 className="text-sm font-bold text-white">{ins.titulo}</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{ins.descricao}</p>
                  {ins.impactoEstimado && (
                    <div className="mt-2 text-xs font-semibold text-teal-400 font-mono flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" />
                      <span>{ins.impactoEstimado}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
