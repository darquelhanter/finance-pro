/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Trash2, 
  CreditCard, 
  Wallet, 
  Tag, 
  Calendar, 
  FileText, 
  ArrowRightLeft,
  Check,
  Receipt,
  Layers,
  Copy,
  Scissors,
  Settings,
  Plus
} from 'lucide-react';
import { Lancamento, Conta, CartaoCredito, Categoria, StatusLancamento, TipoLancamento } from '../types';
import { formatarMoeda, formatarDataBr } from '../utils/format';
import { CategoryIcon } from '../utils/categoryIcons';

interface ModalDetalhesLancamentoProps {
  lancamento: Lancamento | null;
  contas: Conta[];
  cartoes: CartaoCredito[];
  categorias: Categoria[];
  onClose: () => void;
  onSalvar: (atualizado: Lancamento) => Promise<void>;
  onConverterParaDespesaReal?: (id: string) => Promise<void>;
  onExcluir: (id: string) => void;
  onPagar: (id: string) => void;
  onDuplicar?: (lancamento: Lancamento) => void;
  onDividir?: (lancamento: Lancamento) => void;
  onAbrirGerenciadorCategorias?: () => void;
}

export const ModalDetalhesLancamento: React.FC<ModalDetalhesLancamentoProps> = ({
  lancamento,
  contas,
  cartoes,
  categorias,
  onClose,
  onSalvar,
  onConverterParaDespesaReal,
  onExcluir,
  onPagar,
  onDuplicar,
  onDividir,
  onAbrirGerenciadorCategorias,
}) => {
  if (!lancamento) return null;

  const [descricao, setDescricao] = useState(lancamento.descricao || '');
  const [valor, setValor] = useState(String(lancamento.valor || ''));
  const [tipo, setTipo] = useState<TipoLancamento>(lancamento.tipo || 'despesa');
  const [status, setStatus] = useState<StatusLancamento>(lancamento.status || 'pendente');
  const [categoriaId, setCategoriaId] = useState(lancamento.categoriaId || categorias[0]?.id || '');
  const [contaId, setContaId] = useState(lancamento.contaId || '');
  const [cartaoId, setCartaoId] = useState(lancamento.cartaoId || '');
  const [dataVencimento, setDataVencimento] = useState(lancamento.dataVencimento || '');
  const [dataCompetencia, setDataCompetencia] = useState(lancamento.dataCompetencia || '');
  const [observacoes, setObservacoes] = useState(lancamento.observacoes || '');
  const [apenasVisualizacao, setApenasVisualizacao] = useState(!!lancamento.apenasVisualizacao);
  const [salvando, setSalvando] = useState(false);

  const isFatura = lancamento.tags?.includes('fatura') || lancamento.descricao.toLowerCase().startsWith('fatura ');
  const categoriaSelecionada = categorias.find((c) => c.id === categoriaId);

  const handleSalvarForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);

    const valorNum = parseFloat(valor.replace(',', '.'));
    const atualizado: Lancamento = {
      ...lancamento,
      descricao: descricao.trim(),
      valor: isNaN(valorNum) ? lancamento.valor : valorNum,
      tipo,
      status,
      categoriaId,
      contaId: contaId || undefined,
      cartaoId: cartaoId || undefined,
      dataVencimento: dataVencimento || lancamento.dataVencimento,
      dataCompetencia: dataCompetencia || lancamento.dataCompetencia,
      observacoes: observacoes.trim(),
      apenasVisualizacao,
      atualizadoEm: new Date().toISOString(),
    };

    await onSalvar(atualizado);
    setSalvando(false);
    onClose();
  };

  const handleConverter = async () => {
    if (!onConverterParaDespesaReal) return;
    setSalvando(true);
    await onConverterParaDespesaReal(lancamento.id);
    setSalvando(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-2xl ${
              tipo === 'receita' ? 'bg-teal-500/20 text-teal-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {isFatura ? <Receipt className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isFatura ? 'Fatura Consolidada' : 'Editar & Gerenciar Lançamento'}
              </h2>
              <p className="text-xs text-slate-400">Altere descrição, valor, categoria, vencimento ou divida</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            {onDuplicar && (
              <button
                type="button"
                onClick={() => {
                  onDuplicar(lancamento);
                  onClose();
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                title="Duplicar este lançamento"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Duplicar</span>
              </button>
            )}

            {onDividir && (
              <button
                type="button"
                onClick={() => {
                  onDividir(lancamento);
                  onClose();
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                title="Dividir lançamento em categorias"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dividir</span>
              </button>
            )}

            <button
              onClick={onClose}
              title="Fechar"
              aria-label="Fechar"
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSalvarForm} className="p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* Banner de Item Informativo de Extrato */}
          {apenasVisualizacao && (
            <div className="bg-indigo-950/40 border border-indigo-500/30 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs text-indigo-200">
              <div>
                <span className="font-semibold block text-indigo-300">Item Informativo de Cartão</span>
                <p className="text-[11px] text-indigo-200/80 mt-0.5">
                  Marcado como visualização no extrato (não duplica no total da fatura). Se este for um boleto ou consórcio avulso, converta abaixo.
                </p>
              </div>
              {onConverterParaDespesaReal && (
                <button
                  type="button"
                  onClick={handleConverter}
                  disabled={salvando}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shrink-0 transition-colors shadow cursor-pointer flex items-center gap-1"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Tornar Conta a Pagar</span>
                </button>
              )}
            </div>
          )}

          {/* Descrição / Nome do Lançamento (Renomear) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Descrição / Nome do Lançamento (Renomear)
            </label>
            <input
              type="text"
              required
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Supermercado, Aluguel, Salário..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Tipo, Valor e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Tipo
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoLancamento)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="despesa">Despesa (Saída)</option>
                <option value="receita">Receita (Entrada)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Valor (R$)
              </label>
              <input
                type="text"
                required
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono font-bold focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const novoStatus = e.target.value as StatusLancamento;
                  if (novoStatus === 'pago' && lancamento.status !== 'pago') {
                    onPagar(lancamento.id);
                    onClose();
                  } else {
                    setStatus(novoStatus);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="pendente">⏳ A Pagar (Pendente)</option>
                <option value="pago">✓ Pago / Realizado</option>
                <option value="cancelado">✕ Cancelado</option>
              </select>
            </div>
          </div>

          {/* Detalhes de Pagamento (Juros, Multa, Desconto) se já estiver Pago */}
          {lancamento.status === 'pago' && (lancamento.juros || lancamento.multa || lancamento.desconto || lancamento.valorOriginal) && (
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between text-slate-400">
                <span>Valor Original:</span>
                <span className="font-mono text-slate-200 font-semibold">
                  {formatarMoeda(lancamento.valorOriginal || lancamento.valor)}
                </span>
              </div>
              {!!lancamento.juros && (
                <div className="flex items-center justify-between text-amber-400">
                  <span>+ Juros de Mora:</span>
                  <span className="font-mono font-semibold">+{formatarMoeda(lancamento.juros)}</span>
                </div>
              )}
              {!!lancamento.multa && (
                <div className="flex items-center justify-between text-amber-400">
                  <span>+ Multa por Atraso:</span>
                  <span className="font-mono font-semibold">+{formatarMoeda(lancamento.multa)}</span>
                </div>
              )}
              {!!lancamento.desconto && (
                <div className="flex items-center justify-between text-emerald-400">
                  <span>- Desconto Concedido:</span>
                  <span className="font-mono font-semibold">-{formatarMoeda(lancamento.desconto)}</span>
                </div>
              )}
              {lancamento.dataPagamento && (
                <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Data da Liquidação:</span>
                  <span className="font-mono text-slate-200">{formatarDataBr(lancamento.dataPagamento)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800 font-bold text-white">
                <span>Total Efetivamente Pago:</span>
                <span className="font-mono text-emerald-300 font-bold text-sm">
                  {formatarMoeda(lancamento.valorPago || lancamento.valor)}
                </span>
              </div>
            </div>
          )}

          {/* Categoria com Atalho para Gerenciador */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Categoria
              </label>
              {onAbrirGerenciadorCategorias && (
                <button
                  type="button"
                  onClick={() => {
                    onAbrirGerenciadorCategorias();
                  }}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Settings className="w-3 h-3" />
                  <span>Gerenciar Categorias</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {categoriaSelecionada && (
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                  style={{
                    backgroundColor: `${categoriaSelecionada.cor || '#3b82f6'}25`,
                    color: categoriaSelecionada.cor || '#3b82f6',
                  }}
                >
                  <CategoryIcon nomeIcone={categoriaSelecionada.icone} className="w-4 h-4" />
                </div>
              )}
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-medium focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome} ({cat.tipo})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid: Conta / Cartão & Vencimento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Conta / Cartão
              </label>
              <select
                value={cartaoId ? `cartao_${cartaoId}` : contaId ? `conta_${contaId}` : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith('cartao_')) {
                    setCartaoId(val.replace('cartao_', ''));
                    setContaId('');
                  } else if (val.startsWith('conta_')) {
                    setContaId(val.replace('conta_', ''));
                    setCartaoId('');
                  } else {
                    setContaId('');
                    setCartaoId('');
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-medium focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="">Nenhum vínculo</option>
                <optgroup label="Contas Bancárias">
                  {contas.map(c => (
                    <option key={c.id} value={`conta_${c.id}`}>{c.nome}</option>
                  ))}
                </optgroup>
                <optgroup label="Cartões de Crédito">
                  {cartoes.map(car => (
                    <option key={car.id} value={`cartao_${car.id}`}>{car.nome}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Observações & Anotações
            </label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anotações sobre a fatura, boleto, tags ou comprovante..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Opção de Visualização */}
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
            <label htmlFor="checkbox-modo-informativo" className="cursor-pointer">
              <span className="text-xs font-semibold text-slate-300 block">Modo Informativo</span>
              <span className="text-[11px] text-slate-500">Se ativo, serve apenas como extrato sem somar nas despesas a pagar</span>
            </label>
            <input
              id="checkbox-modo-informativo"
              type="checkbox"
              checked={apenasVisualizacao}
              onChange={(e) => setApenasVisualizacao(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-700 cursor-pointer"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Deseja realmente excluir o lançamento "${lancamento.descricao}"?`)) {
                  onExcluir(lancamento.id);
                  onClose();
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir</span>
            </button>

            <div className="flex items-center gap-2">
              {status === 'pendente' && (
                <button
                  type="button"
                  onClick={() => {
                    onPagar(lancamento.id);
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Pagar Agora</span>
                </button>
              )}

              <button
                type="submit"
                disabled={salvando}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-950/50 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{salvando ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
