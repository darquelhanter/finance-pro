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
  Tags,
  Layers, 
  Repeat,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Receipt,
  Clock,
  Check,
  RotateCcw,
  AlertCircle,
  Wand2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Eye,
  ArrowRightLeft,
  SlidersHorizontal,
  FolderTree,
  Copy,
  Scissors,
  Edit3
} from 'lucide-react';
import { Lancamento, Conta, CartaoCredito, Categoria, StatusLancamento, TipoLancamento } from '../types';
import { formatarMoeda, isItemInformativoFatura } from '../utils/format';
import { CategoryIcon } from '../utils/categoryIcons';
import { ModalDetalhesLancamento } from './ModalDetalhesLancamento';
import { ModalDividirLancamento } from './ModalDividirLancamento';

interface LancamentosViewProps {
  lancamentos?: Lancamento[];
  contas?: Conta[];
  cartoes?: CartaoCredito[];
  categorias?: Categoria[];
  onNovoLancamento: () => void;
  onPagar: (id: string) => void;
  onCancelar: (id: string) => void;
  onReabrir?: (id: string) => void;
  onAlterarStatus?: (id: string, status: StatusLancamento) => void;
  onAlterarCategoria?: (id: string, categoriaId: string) => void;
  onConverterParaDespesaReal?: (id: string) => void;
  onAtualizarLancamento?: (lancamento: Lancamento) => Promise<void> | void;
  onDeduplicar?: () => Promise<number>;
  onCorrigirFatura?: () => Promise<void>;
  onSepararCartoes?: () => Promise<void>;
  onExcluir: (id: string) => void;
  onNavigateTab: (tab: string) => void;
  onAbrirGerenciadorCategorias?: () => void;
  onDuplicarLancamento?: (lancamento: Lancamento) => void;
  onDividirLancamento?: (originalId: string, subLancamentos: { descricao: string; valor: number; categoriaId: string }[]) => Promise<void>;
}

export const LancamentosView: React.FC<LancamentosViewProps> = ({
  lancamentos = [],
  contas = [],
  cartoes = [],
  categorias = [],
  onNovoLancamento,
  onPagar,
  onCancelar,
  onReabrir,
  onAlterarStatus,
  onAlterarCategoria,
  onConverterParaDespesaReal,
  onAtualizarLancamento,
  onDeduplicar,
  onCorrigirFatura,
  onSepararCartoes,
  onExcluir,
  onNavigateTab,
  onAbrirGerenciadorCategorias,
  onDuplicarLancamento,
  onDividirLancamento,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'todos' | TipoLancamento>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | StatusLancamento>('todos');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todos');
  const [origemFilter, setOrigemFilter] = useState<string>('todos');
  const [presetTab, setPresetTab] = useState<'todos' | 'contas_a_pagar' | 'faturas' | 'extrato_cartao' | 'contas_a_receber' | 'pagos' | 'cancelados'>('todos');
  
  // Modo de visualização: Consolidada (apenas totais e faturas no topo) vs Detalhada (todas as compras)
  const [modoVisualizacao, setModoVisualizacao] = useState<'consolidada' | 'detalhada'>('consolidada');
  
  const hoje = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // Controle de faturas expandidas no modo consolidado
  const [faturasExpandidas, setFaturasExpandidas] = useState<Record<string, boolean>>({});

  // Modal de Detalhes / Edição & Divisão
  const [itemEmEdicao, setItemEmEdicao] = useState<Lancamento | null>(null);
  const [lancamentoParaDividir, setLancamentoParaDividir] = useState<Lancamento | null>(null);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4500);
  };

  const toggleExpandirFatura = (faturaId: string) => {
    setFaturasExpandidas(prev => ({
      ...prev,
      [faturaId]: !prev[faturaId]
    }));
  };

  // Identifica compras detalhadas pertencentes a uma fatura de cartão específica
  const getComprasDaFatura = (fatura: Lancamento) => {
    return lancamentos.filter(l => {
      if (l.id === fatura.id) return false;
      const isItemInformativo = isItemInformativoFatura(l, lancamentos);
      if (!isItemInformativo && !l.cartaoId) return false;

      // 1. Se tem correspondência exata de faturaId
      if (fatura.faturaId && l.faturaId && fatura.faturaId === l.faturaId) {
        return true;
      }

      // 2. Se a fatura tem cartaoId e o item tem o mesmo cartaoId
      if (fatura.cartaoId && l.cartaoId === fatura.cartaoId) {
        const fatDesc = (fatura.descricao || '').toLowerCase();
        const itemDesc = (l.descricao || '').toLowerCase();
        const itemObs = (l.observacoes || '').toLowerCase();
        
        // Bloqueia contaminação cruzada explícita
        if (fatDesc.includes('ailos') && (itemDesc.includes('bradesco') || itemObs.includes('bradesco'))) {
          return false;
        }
        if (fatDesc.includes('bradesco') && (itemDesc.includes('ailos') || itemObs.includes('ailos'))) {
          return false;
        }
        return true;
      }

      // 3. Fallback seguro por nome do emissor apenas se não houver cartaoId
      const fatDesc = (fatura.descricao || '').toLowerCase();
      const itemObs = (l.observacoes || '').toLowerCase();
      if (!fatura.cartaoId && !l.cartaoId) {
        if (fatDesc.includes('ailos') && itemObs.includes('ailos')) return true;
        if (fatDesc.includes('bradesco') && itemObs.includes('bradesco')) return true;
      }

      return false;
    });
  };

  const filteredLancamentos = useMemo(() => {
    return (lancamentos || []).filter((l) => {
      const isItemInformativo = isItemInformativoFatura(l, lancamentos);

      // No modo consolidado (exceto na aba específica de extrato), oculta compras de cartão da listagem principal
      // pois elas são acessadas expandindo a respectiva Fatura Consolidada
      if (modoVisualizacao === 'consolidada' && presetTab !== 'extrato_cartao' && isItemInformativo) {
        return false;
      }

      // Preset Tab Filters
      if (presetTab === 'contas_a_pagar') {
        // Mostra despesas pendentes que NÃO são itens de extrato (ex: Fatura Total, Aluguel, Luz, Consórcio)
        if (l.tipo !== 'despesa' || l.status !== 'pendente' || isItemInformativo) return false;
      } else if (presetTab === 'contas_a_receber') {
        if (l.tipo !== 'receita' || l.status !== 'pendente') return false;
      } else if (presetTab === 'faturas') {
        const isFatura = l.tags?.includes('fatura') || l.tags?.includes('contas-a-pagar') || l.descricao.toLowerCase().includes('fatura');
        if (!isFatura) return false;
      } else if (presetTab === 'extrato_cartao') {
        // Mostra itens informativos de compras no cartão
        if (!isItemInformativo && !l.cartaoId) return false;
      } else if (presetTab === 'pagos') {
        if (l.status !== 'pago') return false;
      } else if (presetTab === 'cancelados') {
        if (l.status !== 'cancelado') return false;
      }

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
  }, [lancamentos, modoVisualizacao, presetTab, searchTerm, tipoFilter, statusFilter, categoriaFilter, origemFilter]);

  // Check if duplicates or redundant invoices exist
  const hasPossibleDuplicates = useMemo(() => {
    const vistos = new Set<string>();
    for (const l of lancamentos) {
      const key = `${l.descricao.trim().toLowerCase()}_${l.valor}_${l.dataCompetencia || ''}_${l.dataVencimento || ''}`;
      if (vistos.has(key)) return true;
      vistos.add(key);
    }
    // Checa se há fatura de 1 compra redundante
    const faturas1 = lancamentos.filter(l => 
      (l.tags?.includes('fatura') || l.descricao.toLowerCase().startsWith('fatura ')) && 
      l.descricao.includes('(1 compras)')
    );
    if (faturas1.length > 0) return true;

    return false;
  }, [lancamentos]);

  const totais = useMemo(() => {
    let rec = 0;
    let desp = 0;
    let pendentesPagar = 0;
    let pendentesReceber = 0;
    let totalExtratoCartao = 0;
    let qtdExtratoCartao = 0;

    (lancamentos || []).forEach((l) => {
      const val = typeof l.valor === 'number' && !isNaN(l.valor) ? l.valor : 0;
      const isItemInformativo = isItemInformativoFatura(l, lancamentos);

      if (isItemInformativo) {
        totalExtratoCartao += val;
        qtdExtratoCartao++;
        return; // Itens informativos NÃO duplicam na despesa financeira real
      }

      if (l.status === 'pendente') {
        if (l.tipo === 'despesa') pendentesPagar += val;
        if (l.tipo === 'receita') pendentesReceber += val;
      }
      if (l.status !== 'cancelado') {
        if (l.tipo === 'receita') rec += val;
        if (l.tipo === 'despesa') desp += val;
      }
    });

    return { 
      receitas: rec, 
      despesas: desp, 
      liquido: rec - desp,
      pendentesPagar,
      pendentesReceber,
      totalExtratoCartao,
      qtdExtratoCartao
    };
  }, [lancamentos]);

  const handleSelectAll = () => {
    if (selectedIds.length === filteredLancamentos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLancamentos.map(l => l.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBatchStatus = async (status: StatusLancamento) => {
    if (!onAlterarStatus || selectedIds.length === 0) return;
    setActionLoading(true);
    for (const id of selectedIds) {
      await onAlterarStatus(id, status);
    }
    setActionLoading(false);
    setSelectedIds([]);
    showNotification(`Status de ${selectedIds.length} lançamentos alterado para "${status}".`);
  };

  const handleBatchCategoria = async (catId: string) => {
    if (!onAlterarCategoria || selectedIds.length === 0 || !catId) return;
    setActionLoading(true);
    for (const id of selectedIds) {
      await onAlterarCategoria(id, catId);
    }
    setActionLoading(false);
    setSelectedIds([]);
    showNotification(`Categoria de ${selectedIds.length} lançamentos alterada com sucesso.`);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Deseja realmente excluir ${selectedIds.length} lançamentos selecionados?`)) return;
    setActionLoading(true);
    for (const id of selectedIds) {
      await onExcluir(id);
    }
    setActionLoading(false);
    setSelectedIds([]);
    showNotification(`${selectedIds.length} lançamentos excluídos com sucesso.`);
  };

  const handleRunDeduplication = async () => {
    if (!onDeduplicar) return;
    setActionLoading(true);
    const count = await onDeduplicar();
    setActionLoading(false);
    showNotification(count > 0 ? `${count} lançamentos duplicados foram removidos!` : 'Nenhum lançamento duplicado encontrado.');
  };

  const handleRunFaturaCorrection = async () => {
    if (!onCorrigirFatura) return;
    setActionLoading(true);
    await onCorrigirFatura();
    setActionLoading(false);
    showNotification('Faturas e boletos organizados com sucesso! Faturas e parcelas consolidadas em Contas a Pagar.');
  };

  const handleRunSepararCartoes = async () => {
    if (onSepararCartoes) {
      setActionLoading(true);
      await onSepararCartoes();
      setActionLoading(false);
      showNotification('Cartões e faturas separados com sucesso! Bradesco e Ailos estão agora em faturas 100% isoladas.');
    } else if (onCorrigirFatura) {
      await handleRunFaturaCorrection();
    }
  };

  const handleConverterDireto = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!onConverterParaDespesaReal) return;
    setActionLoading(true);
    await onConverterParaDespesaReal(id);
    setActionLoading(false);
    showNotification('Lançamento convertido em Conta a Pagar Real (Boleto/Despesa Direta)!');
  };

  return (
    <div id="lancamentos-view" className="space-y-6 animate-fadeIn pb-24">
      
      {/* Toast Notification */}
      {notification && (
        <div className="bg-emerald-500/90 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Motor de Lançamentos & Contas a Pagar
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Gerencie totais consolidados, faturas de cartão, boletos de veículos e detalhes de despesas com 1 clique.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Action Separate Cards */}
          <button
            id="btn-separar-cartoes-faturas"
            onClick={handleRunSepararCartoes}
            disabled={actionLoading}
            title="Separa lançamentos do Bradesco e Ailos em faturas e cartões 100% individuais"
            className="px-3 py-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-teal-400" />
            <span>Separar Cartões (Ailos & Bradesco)</span>
          </button>

          {/* Quick Action Correction */}
          <button
            id="btn-corrigir-fatura-duplicada"
            onClick={handleRunFaturaCorrection}
            disabled={actionLoading}
            title="Remove duplicidades, conserta boletos de consórcio/veículo e reativa a fatura consolidada em Contas a Pagar"
            className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Organizar Faturas & Boletos</span>
          </button>

          <button
            id="btn-deduplicar-lancamentos"
            onClick={handleRunDeduplication}
            disabled={actionLoading}
            title="Remove lançamentos repetidos"
            className="px-3 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Remover Duplicados</span>
          </button>

          <button
            id="btn-import-ia-lanc"
            onClick={() => onNavigateTab('importacao_ia')}
            className="px-3.5 py-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Importar Fatura / Boleto IA</span>
          </button>

          {onAbrirGerenciadorCategorias && (
            <button
              id="btn-gerenciar-categorias-header"
              onClick={onAbrirGerenciadorCategorias}
              title="Gerenciar Categorias (Criar, Editar, Renomear, Excluir e Mesclar)"
              className="px-3 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Tags className="w-3.5 h-3.5 text-indigo-400" />
              <span>Categorias</span>
            </button>
          )}

          <button
            id="btn-novo-lancamento-page"
            onClick={onNovoLancamento}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Lançamento</span>
          </button>
        </div>
      </div>

      {/* Warning Notice if Redundant Invoices or Duplicates Detected */}
      {hasPossibleDuplicates && (
        <div className="bg-amber-950/30 border border-amber-500/30 p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Ajustes recomendados de faturas e boletos:</span>
              <p className="text-[11px] text-amber-300/80">Identificamos faturas de múltiplos cartões ou boletos a organizar. Clique para separar as faturas por cartão automaticamente.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRunSepararCartoes}
              className="px-3 py-1.5 bg-teal-500 text-slate-950 hover:bg-teal-400 font-bold rounded-lg text-xs transition-colors cursor-pointer shadow"
            >
              Separar por Cartão
            </button>
            <button
              onClick={handleRunFaturaCorrection}
              className="px-3 py-1.5 bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold rounded-lg text-xs transition-colors cursor-pointer shadow"
            >
              Organizar Tudo
            </button>
          </div>
        </div>
      )}

      {/* Preset Quick Tabs + View Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
          <button
            type="button"
            onClick={() => { setPresetTab('todos'); setTipoFilter('todos'); setStatusFilter('todos'); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              presetTab === 'todos'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            Todos os Lançamentos ({lancamentos.length})
          </button>

          <button
            type="button"
            onClick={() => { setPresetTab('contas_a_pagar'); setTipoFilter('todos'); setStatusFilter('todos'); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              presetTab === 'contas_a_pagar'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'bg-slate-900/60 text-rose-400/80 hover:text-rose-300 border border-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-rose-400" />
            <span>Contas a Pagar ({formatarMoeda(totais.pendentesPagar)})</span>
          </button>

          <button
            type="button"
            onClick={() => { setPresetTab('faturas'); setTipoFilter('todos'); setStatusFilter('todos'); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              presetTab === 'faturas'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                : 'bg-slate-900/60 text-teal-400/80 hover:text-teal-300 border border-slate-800'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-teal-400" />
            <span>Faturas Consolidadas</span>
          </button>

          <button
            type="button"
            onClick={() => { setPresetTab('extrato_cartao'); setTipoFilter('todos'); setStatusFilter('todos'); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              presetTab === 'extrato_cartao'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'bg-slate-900/60 text-indigo-400/80 hover:text-indigo-300 border border-slate-800'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
            <span>Extrato do Cartão ({totais.qtdExtratoCartao})</span>
          </button>

          <button
            type="button"
            onClick={() => { setPresetTab('contas_a_receber'); setTipoFilter('todos'); setStatusFilter('todos'); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              presetTab === 'contas_a_receber'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'bg-slate-900/60 text-emerald-400/80 hover:text-emerald-300 border border-slate-800'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            <span>Contas a Receber ({formatarMoeda(totais.pendentesReceber)})</span>
          </button>

          <button
            type="button"
            onClick={() => { setPresetTab('pagos'); setTipoFilter('todos'); setStatusFilter('todos'); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              presetTab === 'pagos'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pagos</span>
          </button>
        </div>

        {/* View Mode Toggle: Consolidada (Totais) vs Detalhada */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setModoVisualizacao('consolidada')}
            title="Exibe apenas totais consolidados, faturas e contas a pagar principais"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              modoVisualizacao === 'consolidada'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Visão Totais (Faturas)</span>
          </button>

          <button
            type="button"
            onClick={() => setModoVisualizacao('detalhada')}
            title="Exibe todas as compras individuais soltas"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              modoVisualizacao === 'detalhada'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Visão Detalhada</span>
          </button>
        </div>
      </div>

      {/* Filter Bar & Quick Totals */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Filters Box (3 Cols) */}
        <div className="md:col-span-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="search-lancamentos"
              type="text"
              placeholder="Buscar por descrição, boleto, estabelecimento ou observações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {/* Tipo */}
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="despesa">Despesas</option>
              <option value="receita">Receitas</option>
            </select>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="todos">Todos os Status</option>
              <option value="pendente">⏳ A Pagar (Pendente)</option>
              <option value="pago">✓ Pago</option>
              <option value="cancelado">✕ Cancelado</option>
            </select>

            {/* Categoria */}
            <select
              value={categoriaFilter}
              onChange={(e) => setCategoriaFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="todos">Todas Categorias</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>

            {/* Conta / Cartão */}
            <select
              value={origemFilter}
              onChange={(e) => setOrigemFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="todos">Todas Contas/Cartões</option>
              <optgroup label="Contas">
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </optgroup>
              <optgroup label="Cartões">
                {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Filter Totals Summary (1 Col) */}
        <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl flex flex-col justify-center gap-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Itens Exibidos:</span>
            <span className="font-semibold text-white">{filteredLancamentos.length}</span>
          </div>
          <div className="flex items-center justify-between text-teal-400">
            <span>Receitas:</span>
            <span className="font-bold font-mono">+ {formatarMoeda(totais.receitas)}</span>
          </div>
          <div className="flex items-center justify-between text-rose-400">
            <span>Despesas Reais:</span>
            <span className="font-bold font-mono">- {formatarMoeda(totais.despesas)}</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-slate-200">
            <span className="font-medium">Balanço:</span>
            <span className={`font-bold font-mono ${totais.liquido >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
              {formatarMoeda(totais.liquido)}
            </span>
          </div>
          {totais.totalExtratoCartao > 0 && (
            <div className="flex items-center justify-between pt-1 text-[10px] text-indigo-300/80 border-t border-slate-800/50" title="Compras do extrato de cartão agrupadas.">
              <span>Extrato Cartão (Total):</span>
              <span className="font-mono font-medium">{formatarMoeda(totais.totalExtratoCartao)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Batch Operations Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-950/70 border border-indigo-500/40 p-3 rounded-2xl flex items-center justify-between gap-4 flex-wrap animate-fadeIn shadow-lg">
          <div className="flex items-center gap-2 text-xs text-indigo-200">
            <span className="font-bold">{selectedIds.length}</span> item(ns) selecionado(s)
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleBatchStatus('pago')}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Marcar Pagos</span>
            </button>
            <button
              onClick={() => handleBatchStatus('pendente')}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Marcar A Pagar</span>
            </button>
            <button
              onClick={() => handleBatchStatus('cancelado')}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancelar</span>
            </button>

            {onAlterarCategoria && (
              <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded-lg border border-indigo-500/30">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] text-indigo-200 hidden sm:inline font-medium">Mudar Categoria:</span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBatchCategoria(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-2 py-0.5 focus:outline-none focus:border-indigo-400 cursor-pointer"
                >
                  <option value="" disabled>Selecione...</option>
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleBatchDelete}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-3 py-3.5 w-10 text-center">
                  <button
                    onClick={handleSelectAll}
                    className="text-slate-400 hover:text-white cursor-pointer"
                    title="Selecionar todos"
                  >
                    {selectedIds.length > 0 && selectedIds.length === filteredLancamentos.length ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3.5">Status (Alterar)</th>
                <th className="px-4 py-3.5">Descrição & Detalhes</th>
                <th className="px-4 py-3.5">Categoria (Alterar)</th>
                <th className="px-4 py-3.5">Conta / Cartão</th>
                <th className="px-4 py-3.5">Data Vencimento</th>
                <th className="px-4 py-3.5 text-right">Valor</th>
                <th className="px-4 py-3.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredLancamentos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <p className="font-semibold text-sm text-slate-400">Nenhum lançamento encontrado.</p>
                    <p className="text-xs mt-1">Ajuste os filtros ou crie um novo lançamento.</p>
                  </td>
                </tr>
              ) : (
                filteredLancamentos.map((lanc) => {
                  const cat = categorias.find((c) => c.id === lanc.categoriaId);
                  const conta = contas.find((c) => c.id === lanc.contaId);
                  const cartao = cartoes.find((car) => car.id === lanc.cartaoId);
                  const isFatura = lanc.tags?.includes('fatura') || lanc.tags?.includes('contas-a-pagar') || lanc.descricao.toLowerCase().startsWith('fatura ');
                  const isItemInformativo = isItemInformativoFatura(lanc, lancamentos);
                  const isSelected = selectedIds.includes(lanc.id);
                  
                  const comprasDaFatura = isFatura ? getComprasDaFatura(lanc) : [];
                  const estaExpandida = !!faturasExpandidas[lanc.id];

                  return (
                    <React.Fragment key={lanc.id}>
                      <tr 
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isSelected ? 'bg-indigo-950/30' : isFatura ? 'bg-teal-950/20 font-medium' : isItemInformativo ? 'bg-indigo-950/10' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-3.5 text-center">
                          <button
                            onClick={() => handleToggleSelect(lanc.id)}
                            className="text-slate-400 hover:text-white cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                            )}
                          </button>
                        </td>

                        {/* Status / Tipo - INTERACTIVE DROPDOWN */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {onAlterarStatus ? (
                            <select
                              id={`select-status-${lanc.id}`}
                              value={lanc.status}
                              onChange={(e) => {
                                const novo = e.target.value as StatusLancamento;
                                if (novo === 'pago') {
                                  onPagar(lanc.id);
                                } else {
                                  onAlterarStatus(lanc.id, novo);
                                }
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border cursor-pointer focus:outline-none ${
                                lanc.status === 'pago'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : lanc.status === 'pendente'
                                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30 line-through'
                              }`}
                            >
                              <option value="pendente">⏳ A Pagar</option>
                              <option value="pago">✓ Pago</option>
                              <option value="cancelado">✕ Cancelado</option>
                            </select>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {lanc.status === 'pago' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" /> Pago
                                </span>
                              )}
                              {lanc.status === 'pendente' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <Clock className="w-3 h-3" /> A Pagar
                                </span>
                              )}
                              {lanc.status === 'cancelado' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 line-through">
                                  Cancelado
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Descrição & Detalhes */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1">
                            <div className="font-semibold text-white text-xs flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setItemEmEdicao(lanc)}
                                className="text-left hover:text-indigo-300 transition-colors cursor-pointer flex items-center gap-1 group"
                                title="Clique para ver ou editar detalhes desta despesa"
                              >
                                <span>{lanc.descricao}</span>
                                <Eye className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>

                              {isFatura && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30">
                                  <Receipt className="w-2.5 h-2.5" />
                                  Fatura Consolidada
                                </span>
                              )}

                              {isItemInformativo && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30" title="Item do extrato do cartão.">
                                  <CreditCard className="w-2.5 h-2.5" />
                                  Extrato Cartão
                                </span>
                              )}

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

                            {/* Botão de Expansão de Fatura Consolidada */}
                            {isFatura && comprasDaFatura.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleExpandirFatura(lanc.id)}
                                className="inline-flex items-center gap-1.5 text-[11px] text-teal-400 hover:text-teal-300 font-medium cursor-pointer w-fit mt-0.5"
                              >
                                {estaExpandida ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-teal-400" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-teal-400" />
                                )}
                                <span>{estaExpandida ? 'Ocultar' : 'Ver'} {comprasDaFatura.length} compras detalhadas</span>
                              </button>
                            )}

                            {lanc.observacoes && (
                              <p className="text-[11px] text-slate-400 truncate max-w-xs">{lanc.observacoes}</p>
                            )}
                          </div>
                        </td>

                        {/* Categoria - INTERACTIVE DROPDOWN */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {onAlterarCategoria ? (
                            <div className="flex items-center gap-1.5">
                              <span 
                                className="w-2.5 h-2.5 rounded-full shrink-0" 
                                style={{ backgroundColor: cat?.cor || '#64748b' }}
                              />
                              <select
                                id={`select-categoria-${lanc.id}`}
                                value={lanc.categoriaId || ''}
                                onChange={(e) => onAlterarCategoria(lanc.id, e.target.value)}
                                className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
                              >
                                {categorias.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.nome}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.cor || '#64748b' }}></span>
                              {cat?.nome || 'Geral'}
                            </span>
                          )}
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
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800">
                              {lanc.dataVencimento ? lanc.dataVencimento.split('-').reverse().join('/') : '-'}
                            </span>
                            {lanc.status === 'pendente' && lanc.dataVencimento && lanc.dataVencimento < hoje && (
                              <span className="text-[10px] text-amber-400 font-sans font-semibold flex items-center gap-0.5" title="Conta vencida">
                                <AlertCircle className="w-2.5 h-2.5" />
                                Vencida
                              </span>
                            )}
                            {lanc.status === 'pago' && lanc.dataPagamento && (
                              <span className="text-[10px] text-slate-500 font-sans">
                                Pago: {lanc.dataPagamento.split('-').reverse().join('/')}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Valor */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono font-bold text-xs">
                          <div className="flex flex-col items-end">
                            <span className={lanc.tipo === 'receita' ? 'text-teal-400' : 'text-slate-100'}>
                              {lanc.tipo === 'receita' ? '+ ' : '- '}
                              {formatarMoeda(lanc.valor)}
                            </span>
                            {lanc.status === 'pago' && ((lanc.juros && lanc.juros > 0) || (lanc.multa && lanc.multa > 0)) && (
                              <span className="text-[10px] text-amber-400 font-sans font-medium" title={`Valor original: ${formatarMoeda(lanc.valorOriginal || 0)} | Juros/Multa: ${formatarMoeda((lanc.juros || 0) + (lanc.multa || 0))}`}>
                                +{formatarMoeda((lanc.juros || 0) + (lanc.multa || 0))} juros/multa
                              </span>
                            )}
                            {lanc.status === 'pago' && lanc.desconto && lanc.desconto > 0 && (
                              <span className="text-[10px] text-emerald-400 font-sans font-medium" title={`Valor original: ${formatarMoeda(lanc.valorOriginal || 0)} | Desconto: ${formatarMoeda(lanc.desconto)}`}>
                                -{formatarMoeda(lanc.desconto)} desconto
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            
                            {/* Botão Ver / Editar Detalhes */}
                            <button
                              onClick={() => setItemEmEdicao(lanc)}
                              title="Visualizar e editar dados desta despesa"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Botão Duplicar */}
                            {onDuplicarLancamento && (
                              <button
                                onClick={() => onDuplicarLancamento(lanc)}
                                title="Duplicar este lançamento"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Botão Dividir */}
                            {onDividirLancamento && (
                              <button
                                onClick={() => setLancamentoParaDividir(lanc)}
                                title="Dividir este lançamento em múltiplas categorias"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-600/30 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                              >
                                <Scissors className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Botão Pagar */}
                            {lanc.status === 'pendente' && (
                              <button
                                id={`btn-pagar-${lanc.id}`}
                                onClick={() => onPagar(lanc.id)}
                                title="Marcar como Pago"
                                className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>Pagar</span>
                              </button>
                            )}

                            {/* Botão Reabrir / Voltar para A Pagar */}
                            {(lanc.status === 'pago' || lanc.status === 'cancelado') && (
                              <button
                                id={`btn-reabrir-${lanc.id}`}
                                onClick={() => onReabrir ? onReabrir(lanc.id) : (onAlterarStatus ? onAlterarStatus(lanc.id, 'pendente') : null)}
                                title="Voltar status para 'A Pagar' (Pendente)"
                                className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-white border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3 text-amber-400" />
                                <span>A Pagar</span>
                              </button>
                            )}

                            {/* Botão Converter Item em Conta a Pagar Real */}
                            {isItemInformativo && onConverterParaDespesaReal && (
                              <button
                                onClick={(e) => handleConverterDireto(lanc.id, e)}
                                title="Converter este item em Conta a Pagar Real (Boleto/Despesa Direta)"
                                className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/30 text-indigo-300 transition-colors cursor-pointer"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Botão Cancelar */}
                            {lanc.status === 'pendente' && (
                              <button
                                id={`btn-cancelar-${lanc.id}`}
                                onClick={() => onCancelar(lanc.id)}
                                title="Cancelar lançamento"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Botão Excluir */}
                            <button
                              id={`btn-excluir-${lanc.id}`}
                              onClick={() => onExcluir(lanc.id)}
                              title="Excluir lançamento permanentemente"
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Accordion / Sub-tabela de Compras Detalhadas da Fatura */}
                      {isFatura && estaExpandida && (
                        <tr className="bg-slate-950/70">
                          <td colSpan={8} className="p-4 pl-12">
                            <div className="bg-slate-900/90 rounded-2xl border border-teal-500/30 p-4 space-y-3">
                              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                                <div className="flex items-center gap-2">
                                  <Receipt className="w-4 h-4 text-teal-400" />
                                  <span className="font-bold text-teal-300">
                                    Detalhamento de Compras da {lanc.descricao} ({comprasDaFatura.length} itens)
                                  </span>
                                </div>
                                <span className="text-slate-400 font-mono">
                                  Total: <strong className="text-white">{formatarMoeda(lanc.valor)}</strong>
                                </span>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
                                      <th className="py-2 px-3">Data</th>
                                      <th className="py-2 px-3">Estabelecimento / Item</th>
                                      <th className="py-2 px-3">Categoria</th>
                                      <th className="py-2 px-3 text-right">Valor</th>
                                      <th className="py-2 px-3 text-center">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/40">
                                    {comprasDaFatura.map((compra) => {
                                      const catCompra = categorias.find(c => c.id === compra.categoriaId);
                                      return (
                                        <tr key={compra.id} className="hover:bg-slate-800/30">
                                          <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">
                                            {compra.dataVencimento ? compra.dataVencimento.split('-').reverse().join('/') : '-'}
                                          </td>
                                          <td className="py-2 px-3">
                                            <button
                                              onClick={() => setItemEmEdicao(compra)}
                                              className="font-medium text-white hover:text-indigo-300 cursor-pointer text-left"
                                            >
                                              {compra.descricao}
                                            </button>
                                          </td>
                                          <td className="py-2 px-3">
                                            {onAlterarCategoria ? (
                                              <select
                                                value={compra.categoriaId || ''}
                                                onChange={(e) => onAlterarCategoria(compra.id, e.target.value)}
                                                className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 cursor-pointer"
                                              >
                                                {categorias.map(c => (
                                                  <option key={c.id} value={c.id}>{c.nome}</option>
                                                ))}
                                              </select>
                                            ) : (
                                              <span className="text-[11px] text-slate-300">{catCompra?.nome || 'Geral'}</span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-200">
                                            {formatarMoeda(compra.valor)}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                              <button
                                                onClick={() => setItemEmEdicao(compra)}
                                                title="Ver dados desta compra"
                                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                                              >
                                                <Eye className="w-3 h-3" />
                                              </button>
                                              {onConverterParaDespesaReal && (
                                                <button
                                                  onClick={(e) => handleConverterDireto(compra.id, e)}
                                                  title="Converter em boleto/conta a pagar separada"
                                                  className="p-1 rounded bg-indigo-500/10 hover:bg-indigo-500/30 text-indigo-300"
                                                >
                                                  <ArrowRightLeft className="w-3 h-3" />
                                                </button>
                                              )}
                                              <button
                                                onClick={() => onExcluir(compra.id)}
                                                title="Excluir compra"
                                                className="p-1 rounded bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes & Edição Completa da Despesa */}
      {itemEmEdicao && (
        <ModalDetalhesLancamento
          lancamento={itemEmEdicao}
          contas={contas}
          cartoes={cartoes}
          categorias={categorias}
          onClose={() => setItemEmEdicao(null)}
          onSalvar={async (atualizado) => {
            if (onAtualizarLancamento) await onAtualizarLancamento(atualizado);
            showNotification('Lançamento atualizado com sucesso!');
          }}
          onDuplicar={onDuplicarLancamento ? (lanc) => {
            onDuplicarLancamento(lanc);
            setItemEmEdicao(null);
            showNotification('Lançamento duplicado com sucesso!');
          } : undefined}
          onDividir={onDividirLancamento ? (lanc) => {
            setItemEmEdicao(null);
            setLancamentoParaDividir(lanc);
          } : undefined}
          onAbrirGerenciadorCategorias={onAbrirGerenciadorCategorias}
          onConverterParaDespesaReal={onConverterParaDespesaReal ? async (id) => {
            await onConverterParaDespesaReal(id);
            showNotification('Item convertido em Conta a Pagar Real (Boleto/Despesa Direta)!');
          } : undefined}
          onExcluir={(id) => {
            onExcluir(id);
            showNotification('Lançamento excluído.');
          }}
          onPagar={(id) => {
            onPagar(id);
            showNotification('Lançamento marcado como pago!');
          }}
        />
      )}

      {/* Modal de Divisão / Split de Lançamento */}
      {lancamentoParaDividir && onDividirLancamento && (
        <ModalDividirLancamento
          lancamento={lancamentoParaDividir}
          categorias={categorias}
          onClose={() => setLancamentoParaDividir(null)}
          onConfirmarDivisao={async (originalId, subLancamentos) => {
            await onDividirLancamento(originalId, subLancamentos);
            setLancamentoParaDividir(null);
            showNotification('Lançamento dividido com sucesso em múltiplas categorias!');
          }}
        />
      )}
    </div>
  );
};
