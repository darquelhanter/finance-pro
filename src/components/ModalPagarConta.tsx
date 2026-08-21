/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  DollarSign, 
  Wallet, 
  Percent, 
  TrendingUp, 
  ShieldAlert, 
  Sparkles,
  Receipt,
  FileText,
  Calculator,
  ArrowRight
} from 'lucide-react';
import { Lancamento, Conta, DadosPagamento } from '../types';
import { formatarMoeda } from '../utils/format';

interface ModalPagarContaProps {
  lancamento: Lancamento | null;
  contas: Conta[];
  onClose: () => void;
  onConfirmarPagamento: (dados: DadosPagamento) => Promise<void>;
}

export const ModalPagarConta: React.FC<ModalPagarContaProps> = ({
  lancamento,
  contas,
  onClose,
  onConfirmarPagamento,
}) => {
  if (!lancamento) return null;

  const valorOriginal = Number(lancamento.valorOriginal || lancamento.valor) || 0;
  const hoje = new Date().toISOString().split('T')[0];

  const [dataPagamento, setDataPagamento] = useState<string>(lancamento.dataPagamento || hoje);
  const [contaId, setContaId] = useState<string>(lancamento.contaId || (contas[0]?.id || ''));
  
  // Modo de cálculo: 'valor_total' (digita o total pago e calcula a diferença) ou 'detalhado' (digita juros/multa/desconto)
  const [modoCalculo, setModoCalculo] = useState<'valor_total' | 'detalhado'>('valor_total');

  // Modo Valor Total
  const [valorPagoStr, setValorPagoStr] = useState<string>(String(valorOriginal));

  // Modo Detalhado
  const [multaStr, setMultaStr] = useState<string>('0');
  const [jurosStr, setJurosStr] = useState<string>('0');
  const [descontoStr, setDescontoStr] = useState<string>('0');

  const [observacoes, setObservacoes] = useState<string>(lancamento.observacoes || '');
  const [salvando, setSalvando] = useState<boolean>(false);

  // Calcula atraso em dias baseado na data de vencimento e data de pagamento
  const diasAtraso = useMemo(() => {
    if (!lancamento.dataVencimento || !dataPagamento) return 0;
    const v = new Date(`${lancamento.dataVencimento}T00:00:00`).getTime();
    const p = new Date(`${dataPagamento}T00:00:00`).getTime();
    const diff = Math.floor((p - v) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [lancamento.dataVencimento, dataPagamento]);

  const estaEmAtraso = diasAtraso > 0;

  // Atualiza valores calculados no modo 'valor_total'
  const parsedValorPago = useMemo(() => {
    const v = parseFloat(valorPagoStr.replace(',', '.'));
    return isNaN(v) ? 0 : v;
  }, [valorPagoStr]);

  const diferencaModoTotal = useMemo(() => {
    return parsedValorPago - valorOriginal;
  }, [parsedValorPago, valorOriginal]);

  // Atualiza valores no modo detalhado
  const parsedMulta = useMemo(() => {
    const v = parseFloat(multaStr.replace(',', '.'));
    return isNaN(v) ? 0 : v;
  }, [multaStr]);

  const parsedJuros = useMemo(() => {
    const v = parseFloat(jurosStr.replace(',', '.'));
    return isNaN(v) ? 0 : v;
  }, [jurosStr]);

  const parsedDesconto = useMemo(() => {
    const v = parseFloat(descontoStr.replace(',', '.'));
    return isNaN(v) ? 0 : v;
  }, [descontoStr]);

  // Valor final efetivo a ser pago
  const valorFinalEfetivo = useMemo(() => {
    if (modoCalculo === 'valor_total') {
      return parsedValorPago;
    } else {
      const tot = valorOriginal + parsedJuros + parsedMulta - parsedDesconto;
      return tot < 0 ? 0 : tot;
    }
  }, [modoCalculo, parsedValorPago, valorOriginal, parsedJuros, parsedMulta, parsedDesconto]);

  // Juros e Multa calculados para salvar
  const jurosCalculado = useMemo(() => {
    if (modoCalculo === 'detalhado') return parsedJuros;
    if (diferencaModoTotal > 0) {
      // Se informou valor total maior, atribui a diferença a juros (se não houver detalhamento manual)
      return diferencaModoTotal;
    }
    return 0;
  }, [modoCalculo, parsedJuros, diferencaModoTotal]);

  const multaCalculada = useMemo(() => {
    if (modoCalculo === 'detalhado') return parsedMulta;
    return 0;
  }, [modoCalculo, parsedMulta]);

  const descontoCalculado = useMemo(() => {
    if (modoCalculo === 'detalhado') return parsedDesconto;
    if (diferencaModoTotal < 0) {
      return Math.abs(diferencaModoTotal);
    }
    return 0;
  }, [modoCalculo, parsedDesconto, diferencaModoTotal]);

  // Sugestão automática de cálculo padrão bancário (ex: 2% multa + 1% juros ao mês por dia de atraso)
  const handleAplicarSugestaoPadrao = () => {
    if (!estaEmAtraso) return;
    // Multa padrão 2%
    const multaSug = Number((valorOriginal * 0.02).toFixed(2));
    // Juros de mora ~0.033% ao dia (1% ao mês)
    const jurosSug = Number((valorOriginal * 0.000333 * diasAtraso).toFixed(2));
    
    setModoCalculo('detalhado');
    setMultaStr(String(multaSug));
    setJurosStr(String(jurosSug));
    setDescontoStr('0');
    setValorPagoStr(String((valorOriginal + multaSug + jurosSug).toFixed(2)));
  };

  const handleSubmeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (valorFinalEfetivo <= 0) {
      alert('Por favor, informe um valor de pagamento válido maior que zero.');
      return;
    }

    setSalvando(true);
    try {
      await onConfirmarPagamento({
        lancamentoId: lancamento.id,
        dataPagamento,
        contaId: contaId || undefined,
        valorOriginal,
        valorPago: valorFinalEfetivo,
        juros: jurosCalculado > 0 ? jurosCalculado : undefined,
        multa: multaCalculada > 0 ? multaCalculada : undefined,
        desconto: descontoCalculado > 0 ? descontoCalculado : undefined,
        observacoes: observacoes.trim(),
      });
      onClose();
    } catch (err) {
      console.error('Erro ao confirmar pagamento:', err);
      alert('Ocorreu um erro ao salvar o pagamento.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${estaEmAtraso ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Confirmar Pagamento de Conta</h2>
              <p className="text-xs text-slate-400">
                {estaEmAtraso ? 'Conta vencida — cálculo de juros e multa disponível' : 'Registre a quitação e débito na conta'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmeter} className="p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* Card Resumo da Conta */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs text-slate-400 font-medium">Descrição da Conta / Boleto:</span>
                <div className="text-sm font-bold text-white mt-0.5">{lancamento.descricao}</div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 font-medium">Valor Original:</span>
                <div className="text-base font-bold font-mono text-slate-200">
                  {formatarMoeda(valorOriginal)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/60">
              <span className="text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Vencimento original: <strong className="text-slate-200">{lancamento.dataVencimento ? lancamento.dataVencimento.split('-').reverse().join('/') : 'Não informado'}</strong>
              </span>
              
              {estaEmAtraso ? (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-[11px] border border-amber-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  {diasAtraso} {diasAtraso === 1 ? 'dia' : 'dias'} de atraso
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold text-[11px] border border-emerald-500/30">
                  Em dia
                </span>
              )}
            </div>
          </div>

          {/* Banner de Aviso de Atraso e Botão de Sugestão */}
          {estaEmAtraso && (
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 animate-fadeIn">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-300">Pagamento com atraso identificado:</span>
                  <p className="text-[11px] text-amber-200/80">
                    Você pode digitar o valor total cobrado pelo banco ou usar o cálculo automático de juros e multa.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAplicarSugestaoPadrao}
                className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl font-semibold text-[11px] shrink-0 transition-colors flex items-center gap-1 cursor-pointer self-end sm:self-auto"
                title="Aplica multa de 2% + juros de 1% ao mês proporcional aos dias de atraso"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Calcular Padrão Bancário</span>
              </button>
            </div>
          )}

          {/* Data do Pagamento & Conta de Saída */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Data do Pagamento Efectivo</span>
              </label>
              <input
                type="date"
                required
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5 flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Conta Bancária (Débito)</span>
              </label>
              <select
                value={contaId}
                onChange={(e) => setContaId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">Sem débito em conta</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({formatarMoeda(c.saldoAtual)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabs de Modo de Cálculo */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                <span>Ajuste de Valor Pago / Juros e Multa</span>
              </label>
              
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setModoCalculo('valor_total')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    modoCalculo === 'valor_total'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Valor Total Pago
                </button>
                <button
                  type="button"
                  onClick={() => setModoCalculo('detalhado')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    modoCalculo === 'detalhado'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Juros / Multa / Desconto
                </button>
              </div>
            </div>

            {/* MODO A: INFORMAR VALOR TOTAL PAGO */}
            {modoCalculo === 'valor_total' && (
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Digite o valor total efetivamente pago no banco (R$):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={valorPagoStr}
                      onChange={(e) => setValorPagoStr(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-sm font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Cálculo da diferença em tempo real */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs flex items-center justify-between">
                  <span className="text-slate-400">Diferença em relação ao original:</span>
                  {diferencaModoTotal > 0 ? (
                    <span className="font-mono font-bold text-amber-400 flex items-center gap-1">
                      + {formatarMoeda(diferencaModoTotal)} (Juros e Encargos)
                    </span>
                  ) : diferencaModoTotal < 0 ? (
                    <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
                      - {formatarMoeda(Math.abs(diferencaModoTotal))} (Desconto)
                    </span>
                  ) : (
                    <span className="font-mono text-slate-400">R$ 0,00 (Valor exato)</span>
                  )}
                </div>
              </div>
            )}

            {/* MODO B: INFORMAR JUROS, MULTA E DESCONTO SEPARADOS */}
            {modoCalculo === 'detalhado' && (
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Juros */}
                  <div>
                    <label className="text-[11px] text-amber-300 font-medium block mb-1">
                      Juros de Mora (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={jurosStr}
                      onChange={(e) => setJurosStr(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Multa */}
                  <div>
                    <label className="text-[11px] text-amber-300 font-medium block mb-1">
                      Multa por Atraso (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={multaStr}
                      onChange={(e) => setMultaStr(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Desconto */}
                  <div>
                    <label className="text-[11px] text-emerald-300 font-medium block mb-1">
                      Desconto Obtido (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={descontoStr}
                      onChange={(e) => setDescontoStr(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-300 font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                  <span>Fórmula: Original ({formatarMoeda(valorOriginal)}) + Juros + Multa - Desconto</span>
                </div>
              </div>
            )}
          </div>

          {/* Card Totalizador Final */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950/30 to-slate-950 border border-indigo-500/30 flex items-center justify-between">
            <div>
              <span className="text-xs text-indigo-300 font-semibold block">Valor Final a Debitar:</span>
              <span className="text-[11px] text-slate-400">Será registrado no histórico financeiro</span>
            </div>
            <div className="text-right font-mono">
              <div className="text-xl font-extrabold text-white">
                {formatarMoeda(valorFinalEfetivo)}
              </div>
              {(jurosCalculado > 0 || multaCalculada > 0) && (
                <div className="text-[10px] text-amber-400 font-medium">
                  + {formatarMoeda(jurosCalculado + multaCalculada)} em juros/multa
                </div>
              )}
              {descontoCalculado > 0 && (
                <div className="text-[10px] text-emerald-400 font-medium">
                  - {formatarMoeda(descontoCalculado)} em desconto
                </div>
              )}
            </div>
          </div>

          {/* Observações adicionais */}
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              Observações do Pagamento (opcional):
            </label>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Pago pelo app bancário com multa e juros inclusos"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/60 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{salvando ? 'Processando...' : 'Confirmar Pagamento'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
