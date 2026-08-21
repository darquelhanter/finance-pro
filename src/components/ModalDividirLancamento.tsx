/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Scissors,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Tag,
  DollarSign,
  Calendar,
  Layers
} from 'lucide-react';
import { Lancamento, Categoria } from '../types';
import { formatarMoeda } from '../utils/format';

interface ItemDivisao {
  id: string;
  descricao: string;
  valorStr: string;
  categoriaId: string;
}

interface ModalDividirLancamentoProps {
  lancamento: Lancamento | null;
  categorias: Categoria[];
  onClose: () => void;
  onConfirmarDivisao: (originalId: string, subLancamentos: { descricao: string; valor: number; categoriaId: string }[]) => Promise<void>;
}

export const ModalDividirLancamento: React.FC<ModalDividirLancamentoProps> = ({
  lancamento,
  categorias,
  onClose,
  onConfirmarDivisao,
}) => {
  if (!lancamento) return null;

  const valorTotalOriginal = Number(lancamento.valor) || 0;

  // Initial 2 split parts
  const [itens, setItens] = useState<ItemDivisao[]>([
    {
      id: 'part_1',
      descricao: `${lancamento.descricao} (Parte 1)`,
      valorStr: String((valorTotalOriginal / 2).toFixed(2)),
      categoriaId: lancamento.categoriaId || categorias[0]?.id || '',
    },
    {
      id: 'part_2',
      descricao: `${lancamento.descricao} (Parte 2)`,
      valorStr: String((valorTotalOriginal - Number((valorTotalOriginal / 2).toFixed(2))).toFixed(2)),
      categoriaId: categorias[1]?.id || lancamento.categoriaId || '',
    },
  ]);

  const [salvando, setSalvando] = useState(false);

  // Somatório das partes
  const somaPartes = useMemo(() => {
    return itens.reduce((acc, it) => {
      const v = parseFloat(it.valorStr.replace(',', '.'));
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
  }, [itens]);

  const diferenca = useMemo(() => {
    return Number((valorTotalOriginal - somaPartes).toFixed(2));
  }, [valorTotalOriginal, somaPartes]);

  const saldoValido = Math.abs(diferenca) < 0.01;

  const handleAdicionarParte = () => {
    const restante = diferenca > 0 ? diferenca : 0;
    setItens([
      ...itens,
      {
        id: `part_${Date.now()}`,
        descricao: `${lancamento.descricao} (Parte ${itens.length + 1})`,
        valorStr: String(restante.toFixed(2)),
        categoriaId: categorias[0]?.id || '',
      },
    ]);
  };

  const handleRemoverParte = (index: number) => {
    if (itens.length <= 2) {
      alert('A divisão requer no mínimo 2 partes.');
      return;
    }
    setItens(itens.filter((_, i) => i !== index));
  };

  const handleAlterarItem = (index: number, campo: keyof ItemDivisao, valor: string) => {
    const novos = [...itens];
    novos[index] = { ...novos[index], [campo]: valor };
    setItens(novos);
  };

  const handleSubmeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saldoValido) {
      alert(`A soma das partes deve ser exatamente igual ao total (${formatarMoeda(valorTotalOriginal)}). Diferença restante: ${formatarMoeda(diferenca)}`);
      return;
    }

    setSalvando(true);
    try {
      const formatados = itens.map((it) => ({
        descricao: it.descricao.trim(),
        valor: parseFloat(it.valorStr.replace(',', '.')),
        categoriaId: it.categoriaId,
      }));
      await onConfirmarDivisao(lancamento.id, formatados);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao dividir lançamento.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Dividir Lançamento em Categorias</h2>
              <p className="text-xs text-slate-400">Separe um valor único em múltiplas sub-despesas ou categorias</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo Original */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400">Lançamento Original:</span>
            <div className="font-bold text-white text-sm">{lancamento.descricao}</div>
          </div>
          <div className="text-right">
            <span className="text-slate-400">Valor Total:</span>
            <div className="font-mono font-extrabold text-base text-emerald-400">
              {formatarMoeda(valorTotalOriginal)}
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmeter} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="space-y-3">
            {itens.map((item, idx) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                    Parte #{idx + 1}
                  </span>
                  {itens.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoverParte(idx)}
                      className="p-1 rounded text-rose-400 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
                      title="Remover Parte"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-400 block mb-1">Descrição</label>
                    <input
                      type="text"
                      required
                      value={item.descricao}
                      onChange={(e) => handleAlterarItem(idx, 'descricao', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={item.valorStr}
                      onChange={(e) => handleAlterarItem(idx, 'valorStr', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Categoria desta parte</label>
                  <select
                    value={item.categoriaId}
                    onChange={(e) => handleAlterarItem(idx, 'categoriaId', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nome} ({cat.tipo})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Botão Adicionar Mais Parte */}
          <button
            type="button"
            onClick={handleAdicionarParte}
            className="w-full py-2.5 rounded-2xl border border-dashed border-slate-700 hover:border-indigo-500/60 bg-slate-950/40 text-slate-400 hover:text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Mais Uma Categoria / Parte</span>
          </button>

          {/* Balanço e Verificação de Soma */}
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-mono ${
            saldoValido
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
          }`}>
            <div className="flex items-center gap-2 font-sans">
              {saldoValido ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>
                {saldoValido ? 'Total perfeitamente equilibrado' : `Diferença a ajustar: ${formatarMoeda(diferenca)}`}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-400 block font-sans">Soma das Partes:</span>
              <span className="font-bold">{formatarMoeda(somaPartes)}</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !saldoValido}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Scissors className="w-4 h-4" />
              <span>{salvando ? 'Dividindo...' : 'Dividir Lançamento'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
