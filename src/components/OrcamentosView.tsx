/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  PieChart, 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Edit3,
  DollarSign
} from 'lucide-react';
import { Categoria, DashboardResumo } from '../types';
import { formatarMoeda } from '../utils/format';

interface OrcamentosViewProps {
  categorias?: Categoria[];
  resumo?: DashboardResumo;
  onUpdateOrcamento: (categoriaId: string, novoValor: number) => void;
}

export const OrcamentosView: React.FC<OrcamentosViewProps> = ({
  categorias = [],
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
  onUpdateOrcamento,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const categoriasDespesa = (categorias || []).filter((c) => c.tipo === 'despesa');
  const despesasPorCategoria = resumo?.despesasPorCategoria || [];

  const startEdit = (cat: Categoria) => {
    setEditingId(cat.id);
    setEditValue(cat.orcamentoMensal ? String(cat.orcamentoMensal) : '');
  };

  const saveEdit = (catId: string) => {
    const val = parseFloat(editValue);
    onUpdateOrcamento(catId, isNaN(val) ? 0 : val);
    setEditingId(null);
  };

  return (
    <div id="orcamentos-view" className="space-y-6 animate-fadeIn">
      
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-5 h-5 text-emerald-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Planejamento & Tetos Orçamentários</h1>
        </div>
        <p className="text-xs text-slate-400 max-w-2xl">
          Defina metas e limites mensais de gastos por categoria. Monitore em tempo real o realizado vs orçado com avisos automáticos de estouro.
        </p>
      </div>

      {/* Grid of Category Budgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categoriasDespesa.map((cat) => {
          const gastoRealizado = despesasPorCategoria.find((d) => d.categoriaId === cat.id)?.valor || 0;
          const meta = cat.orcamentoMensal || 0;
          const percentual = meta > 0 ? Math.round((gastoRealizado / meta) * 100) : 0;
          const estourou = meta > 0 && gastoRealizado > meta;
          const quaseEstourando = meta > 0 && percentual >= 85 && !estourou;

          return (
            <div
              key={cat.id}
              className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: cat.cor || '#10b981' }}></div>
                    <h3 className="text-sm font-bold text-white">{cat.nome}</h3>
                  </div>

                  {meta > 0 && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      estourou
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : quaseEstourando
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {estourou ? (
                        <>
                          <AlertTriangle className="w-3 h-3" /> Excedido
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> {percentual}%
                        </>
                      )}
                    </span>
                  )}
                </div>

                {/* Numbers */}
                <div className="space-y-1 my-3">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-slate-400">Gasto Realizado:</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {formatarMoeda(gastoRealizado)}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-slate-400">Teto Orçado:</span>
                    {editingId === cat.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="50"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-24 px-1.5 py-0.5 bg-slate-950 border border-emerald-500 rounded text-xs font-mono text-white text-right"
                          autoFocus
                        />
                        <button
                          onClick={() => saveEdit(cat.id)}
                          className="text-[10px] px-1.5 py-0.5 bg-emerald-600 text-white rounded font-semibold"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <span 
                        onClick={() => startEdit(cat)}
                        className="font-mono text-emerald-400 font-semibold cursor-pointer hover:underline flex items-center gap-1"
                        title="Clique para editar meta"
                      >
                        {meta > 0 ? formatarMoeda(meta) : 'Não definido'}
                        <Edit3 className="w-3 h-3 opacity-60" />
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="pt-3 border-t border-slate-800/80 space-y-1.5">
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      estourou
                        ? 'bg-rose-500'
                        : quaseEstourando
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, percentual)}%` }}
                  ></div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    {meta > 0 ? (
                      estourou ? (
                        <span className="text-rose-400 font-medium">Excedeu {formatarMoeda(gastoRealizado - meta)}</span>
                      ) : (
                        <span className="text-slate-400">Resta {formatarMoeda(meta - gastoRealizado)}</span>
                      )
                    ) : (
                      'Clique no valor para definir o limite'
                    )}
                  </span>
                  <span className="font-mono">{percentual}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
