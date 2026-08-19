/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  PlusCircle, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Calendar, 
  CreditCard, 
  Wallet, 
  Tag, 
  Layers, 
  Repeat,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles
} from 'lucide-react';
import { Lancamento, Conta, CartaoCredito, Categoria, StatusLancamento, TipoLancamento } from '../types';
import { formatarMoeda } from '../utils/format';

interface LancamentosViewProps {
  lancamentos?: Lancamento[];
  contas?: Conta[];
  cartoes?: CartaoCredito[];
  categorias?: Categoria[];
  onNovoLancamento: () => void;
  onPagar: (id: string) => void;
  onCancelar: (id: string) => void;
  onExcluir: (id: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const LancamentosView: React.FC<LancamentosViewProps> = ({
  lancamentos = [],
  contas = [],
  cartoes = [],
  categorias = [],
  onNovoLancamento,
  onPagar,
  onCancelar,
  onExcluir,
  onNavigateTab,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'todos' | TipoLancamento>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | StatusLancamento>('todos');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todos');
  const [origemFilter, setOrigemFilter] = useState<string>('todos');

  const filteredLancamentos = useMemo(() => {
    return (lancamentos || []).filter((l) => {
      // Search
      if (searchTerm) {
        const termo = searchTerm.toLowerCase();
        const matchDesc = (l.descricao || '').toLowerCase().includes(termo);
        const matchObs = l.observacoes?.toLowerCase().includes(termo);
        if (!matchDesc && !matchObs) return false;
      }
      // Tipo
      if (tipoFilter !== 'todos' && l.tipo !== tipoFilter) return false;
      // Status
      if (statusFilter !== 'todos' && l.status !== statusFilter) return false;
      // Categoria
      if (categoriaFilter !== 'todos' && l.categoriaId !== categoriaFilter) return false;
      // Origem (Conta ou Cartão)
      if (origemFilter !== 'todos') {
        if (l.contaId !== origemFilter && l.cartaoId !== origemFilter) return false;
      }
      return true;
    });
  }, [lancamentos, searchTerm, tipoFilter, statusFilter, categoriaFilter, origemFilter]);

  const totais = useMemo(() => {
    let rec = 0;
    let desp = 0;
    filteredLancamentos.forEach((l) => {
      if (l.status !== 'cancelado') {
        const val = typeof l.valor === 'number' && !isNaN(l.valor) ? l.valor : 0;
        if (l.tipo === 'receita') rec += val;
        if (l.tipo === 'despesa') desp += val;
      }
    });
    return { receitas: rec, despesas: desp, liquido: rec - desp };
  }, [filteredLancamentos]);

  return (
    <div id="lancamentos-view" className="space-y-6 animate-fadeIn">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Motor de Lançamentos & Transações
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Gerencie entradas, despesas simples, parcelamentos em N vezes e recorrências com consistência de saldo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-import-ia-lanc"
            onClick={() => onNavigateTab('importacao_ia')}
            className="px-3.5 py-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Importar Fatura IA</span>
          </button>

          <button
            id="btn-novo-lancamento-page"
            onClick={onNovoLancamento}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Lançamento</span>
          </button>
        </div>
      </div>

      {/* Filter Bar & Summary Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Filters Box (3 Cols) */}
        <div className="lg:col-span-3 bg-slate-900/70 border border-slate-800 p-4 rounded-2xl space-y-3">
          {/* Row 1: Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-busca-lancamento"
              type="text"
              placeholder="Buscar por descrição, estabelecimento, tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Row 2: Selects */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            
            {/* Tipo */}
            <select
              id="select-filtro-tipo"
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="receita">Receitas (+)</option>
              <option value="despesa">Despesas (-)</option>
              <option value="transferencia">Transferências</option>
            </select>

            {/* Status */}
            <select
              id="select-filtro-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="todos">Todos os Status</option>
              <option value="pago">Pago / Recebido</option>
              <option value="pendente">Pendente</option>
              <option value="cancelado">Cancelado</option>
            </select>

            {/* Categoria */}
            <select
              id="select-filtro-categoria"
              value={categoriaFilter}
              onChange={(e) => setCategoriaFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="todos">Todas Categorias</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nome}
                </option>
              ))}
            </select>

            {/* Conta / Cartão */}
            <select
              id="select-filtro-origem"
              value={origemFilter}
              onChange={(e) => setOrigemFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="todos">Todas Contas/Cartões</option>
              <optgroup label="Contas Bancárias">
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Cartões de Crédito">
                {cartoes.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.nome}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Filter Totals Summary (1 Col) */}
        <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl flex flex-col justify-center gap-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Itens Filtrados:</span>
            <span className="font-semibold text-white">{filteredLancamentos.length}</span>
          </div>
          <div className="flex items-center justify-between text-teal-400">
            <span>Receitas:</span>
            <span className="font-bold font-mono">+ {formatarMoeda(totais.receitas)}</span>
          </div>
          <div className="flex items-center justify-between text-rose-400">
            <span>Despesas:</span>
            <span className="font-bold font-mono">- {formatarMoeda(totais.despesas)}</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-slate-200">
            <span>Balanço:</span>
            <span className={`font-bold font-mono ${totais.liquido >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatarMoeda(totais.liquido)}
            </span>
          </div>
        </div>
      </div>

      {/* Transactions Table / List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Status / Tipo</th>
                <th className="px-4 py-3.5">Descrição & Detalhes</th>
                <th className="px-4 py-3.5">Categoria</th>
                <th className="px-4 py-3.5">Conta / Cartão</th>
                <th className="px-4 py-3.5">Vencimento</th>
                <th className="px-4 py-3.5 text-right">Valor</th>
                <th className="px-4 py-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLancamentos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    Nenhum lançamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredLancamentos.map((lanc) => {
                  const cat = categorias.find((c) => c.id === lanc.categoriaId);
                  const conta = contas.find((c) => c.id === lanc.contaId);
                  const cartao = cartoes.find((car) => car.id === lanc.cartaoId);

                  return (
                    <tr key={lanc.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Status / Tipo */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {lanc.status === 'pago' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Pago
                            </span>
                          )}
                          {lanc.status === 'pendente' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Pendente
                            </span>
                          )}
                          {lanc.status === 'cancelado' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 line-through">
                              Cancelado
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Descrição & Detalhes */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                          <span>{lanc.descricao}</span>
                          {lanc.parcela && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono" title="Compra Parcelada">
                              <Layers className="w-2.5 h-2.5" />
                              {lanc.parcela.numero}/{lanc.parcela.total}
                            </span>
                          )}
                          {lanc.recorrencia && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono capitalize" title="Lançamento Recorrente">
                              <Repeat className="w-2.5 h-2.5" />
                              {lanc.recorrencia.frequencia}
                            </span>
                          )}
                        </div>
                        {lanc.observacoes && (
                          <p className="text-[11px] text-slate-400 truncate max-w-xs">{lanc.observacoes}</p>
                        )}
                      </td>

                      {/* Categoria */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span 
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300"
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.cor || '#64748b' }}></span>
                          {cat?.nome || 'Geral'}
                        </span>
                      </td>

                      {/* Conta / Cartão */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {cartao ? (
                          <span className="flex items-center gap-1 text-[11px] text-indigo-300">
                            <CreditCard className="w-3 h-3 text-indigo-400" />
                            {cartao.nome}
                          </span>
                        ) : conta ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-300">
                            <Wallet className="w-3 h-3 text-emerald-400" />
                            {conta.nome}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Vencimento */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                        {lanc.dataVencimento ? lanc.dataVencimento.split('-').reverse().join('/') : '-'}
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono font-bold text-xs">
                        <span className={lanc.tipo === 'receita' ? 'text-teal-400' : 'text-slate-100'}>
                          {lanc.tipo === 'receita' ? '+ ' : '- '}
                          {formatarMoeda(lanc.valor)}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {lanc.status === 'pendente' && (
                            <button
                              id={`btn-pagar-${lanc.id}`}
                              onClick={() => onPagar(lanc.id)}
                              title="Marcar como Pago/Recebido e atualizar saldo da conta"
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {lanc.status === 'pago' && (
                            <button
                              id={`btn-cancelar-${lanc.id}`}
                              onClick={() => onCancelar(lanc.id)}
                              title="Cancelar lançamento e estornar do saldo"
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            id={`btn-excluir-${lanc.id}`}
                            onClick={() => onExcluir(lanc.id)}
                            title="Excluir lançamento"
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
