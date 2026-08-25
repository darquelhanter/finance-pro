/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  CreditCard, 
  Calendar, 
  TrendingDown, 
  Sparkles, 
  Layers, 
  PlusCircle, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Filter, 
  Calculator, 
  ShieldCheck, 
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Tag,
  Wallet,
  Zap,
  Info,
  CalendarCheck2,
  Lock,
  Unlock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Line,
  ComposedChart
} from 'recharts';
import { CartaoCredito, Categoria, Lancamento } from '../types';
import { formatarMoeda } from '../utils/format';
import { ParcelamentoService, CompraParceladaAgrupada, ProjecaoMesFuturo } from '../utils/parcelas';

interface FaturasParcelamentosViewProps {
  lancamentos: Lancamento[];
  cartoes: CartaoCredito[];
  categorias: Categoria[];
  onCriarParcelado?: (dto: any) => void;
  onAtualizarLoteLancamentos?: (atualizacoes: Partial<Lancamento>[]) => Promise<void>;
  onNavigateTab: (tab: string) => void;
}

export const FaturasParcelamentosView: React.FC<FaturasParcelamentosViewProps> = ({
  lancamentos = [],
  cartoes = [],
  categorias = [],
  onCriarParcelado,
  onAtualizarLoteLancamentos,
  onNavigateTab,
}) => {
  // Filtro de cartão selecionado
  const [cartaoSelecionadoId, setCartaoSelecionadoId] = useState<string>('todos');
  const [sincronizandoParcelas, setSincronizandoParcelas] = useState(false);
  const [sucessoSincronizacao, setSucessoSincronizacao] = useState<string | null>(null);
  
  // Aba ativa interna: 'projecao' | 'compras_ativas' | 'simulador' | 'limites'
  const [subTab, setSubTab] = useState<'projecao' | 'compras_ativas' | 'simulador' | 'limites'>('projecao');
  
  // Meses de horizonte de projeção: 12 ou 24
  const [horizonteMeses, setHorizonteMeses] = useState<number>(12);

  // Mês expandido na timeline
  const [mesExpandido, setMesExpandido] = useState<string | null>(null);

  // Modal de nova compra parcelada
  const [modalNovaCompraAberto, setModalNovaCompraAberto] = useState(false);
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoValorTotal, setNovoValorTotal] = useState('');
  const [novoNumeroParcelas, setNovoNumeroParcelas] = useState(6);
  const [novoCartaoId, setNovoCartaoId] = useState(cartoes[0]?.id || '');
  const [novaCategoriaId, setNovaCategoriaId] = useState(categorias[0]?.id || 'cat_outros');
  const [novaDataPrimeiroVenc, setNovaDataPrimeiroVenc] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Estado do Simulador de Compras Futuras
  const [simulacaoDescricao, setSimulacaoDescricao] = useState('Planejamento de Nova Compra');
  const [simulacaoValorTotal, setSimulacaoValorTotal] = useState('2400');
  const [simulacaoParcelas, setSimulacaoParcelas] = useState(10);
  const [simulacaoMesInicio, setSimulacaoMesInicio] = useState(1); // 1 = próximo mês
  const [simulacaoCartaoId, setSimulacaoCartaoId] = useState(cartoes[0]?.id || '');

  // 1. Agrupamento de compras parceladas
  const comprasAgrupadas = useMemo(() => {
    const filtro = cartaoSelecionadoId === 'todos' ? undefined : cartaoSelecionadoId;
    return ParcelamentoService.agruparComprasParceladas(lancamentos, filtro);
  }, [lancamentos, cartaoSelecionadoId]);

  // 2. Projeção detalhada dos próximos meses
  const projecoesMeses = useMemo(() => {
    const filtro = cartaoSelecionadoId === 'todos' ? undefined : cartaoSelecionadoId;
    return ParcelamentoService.gerarProjecaoMeses(
      lancamentos,
      comprasAgrupadas,
      horizonteMeses,
      filtro
    );
  }, [lancamentos, comprasAgrupadas, horizonteMeses, cartaoSelecionadoId]);

  // 3. Simulação de Nova Compra
  const resultadoSimulacao = useMemo(() => {
    const vTotal = parseFloat(simulacaoValorTotal) || 0;
    return ParcelamentoService.simularNovaCompra(projecoesMeses, {
      descricao: simulacaoDescricao,
      valorTotal: vTotal,
      numeroParcelas: simulacaoParcelas,
      mesInicioIndex: simulacaoMesInicio,
      cartaoId: simulacaoCartaoId,
    });
  }, [
    projecoesMeses,
    simulacaoDescricao,
    simulacaoValorTotal,
    simulacaoParcelas,
    simulacaoMesInicio,
    simulacaoCartaoId,
  ]);

  // Métricas Totais Consolidadas
  const totalDividaFutura = useMemo(() => {
    return comprasAgrupadas.reduce((acc, c) => acc + c.saldoDevedor, 0);
  }, [comprasAgrupadas]);

  const mediaMensalFutura = useMemo(() => {
    const mesesComValor = projecoesMeses.filter((p) => p.valorTotal > 0);
    if (mesesComValor.length === 0) return 0;
    const soma = mesesComValor.reduce((acc, p) => acc + p.valorTotal, 0);
    return soma / mesesComValor.length;
  }, [projecoesMeses]);

  const mesFinalizacaoGeral = useMemo(() => {
    const ativas = comprasAgrupadas.filter((c) => !c.concluida && c.dataTermino);
    if (ativas.length === 0) return 'Nenhuma dívida ativa';
    ativas.sort((a, b) => (b.dataTermino || '').localeCompare(a.dataTermino || ''));
    return ativas[0].mesTerminoFormatado || 'Em breve';
  }, [comprasAgrupadas]);

  const totalLiberadoProximos3Meses = useMemo(() => {
    return projecoesMeses
      .slice(0, 3)
      .reduce((acc, p) => acc + p.valorTotalLiberadoProximoMes, 0);
  }, [projecoesMeses]);

  // Identifica compras nos lançamentos que contêm parcelas no texto mas não foram estruturadas (ex: "05/06", "03/12")
  const lancamentosNaoEstruturados = useMemo(() => {
    return ParcelamentoService.identificarLancamentosNaoEstruturados(lancamentos);
  }, [lancamentos]);

  const handleSincronizarParcelas = async () => {
    if (!onAtualizarLoteLancamentos || lancamentosNaoEstruturados.length === 0) return;
    try {
      setSincronizandoParcelas(true);
      setSucessoSincronizacao(null);

      const updates = lancamentosNaoEstruturados.map((it) => {
        const pAtual = it.parcelaAtual;
        const pTotal = it.totalParcelas;
        const slug = it.descricaoLimpa.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const paiId = `parc_sync_${slug}_${it.lancamento.cartaoId || 'cartao'}_${pTotal}`;

        return {
          id: it.lancamento.id,
          parcela: {
            numero: pAtual,
            total: pTotal,
            lancamentoPaiId: paiId,
          },
          tags: Array.from(new Set([
            ...(it.lancamento.tags || []),
            'parcelamento',
            `parc_${pAtual}_${pTotal}`,
          ])),
        };
      });

      await onAtualizarLoteLancamentos(updates);
      setSucessoSincronizacao(`${updates.length} parcelamento(s) sincronizado(s) e integrados com sucesso à projeção futura!`);
      setTimeout(() => setSucessoSincronizacao(null), 6000);
    } catch (err: any) {
      console.error('Erro ao sincronizar parcelas:', err);
      setSucessoSincronizacao('Ocorreu um erro ao sincronizar as parcelas. Tente novamente.');
    } finally {
      setSincronizandoParcelas(false);
    }
  };

  // Salvar Nova Compra Parcelada
  const handleSalvarNovaCompraParcelada = (e: React.FormEvent) => {
    e.preventDefault();
    const vTotal = parseFloat(novoValorTotal);
    if (!novaDescricao || isNaN(vTotal) || vTotal <= 0) return;

    if (onCriarParcelado) {
      onCriarParcelado({
        tipo: 'despesa',
        descricao: novaDescricao,
        valor: vTotal,
        categoriaId: novaCategoriaId,
        cartaoId: novoCartaoId || undefined,
        dataCompetencia: new Date().toISOString().split('T')[0],
        dataVencimento: novaDataPrimeiroVenc,
        numeroParcelas: novoNumeroParcelas,
        observacoes: `Compra parcelada (${novoNumeroParcelas}x) lançada pelo painel de controle de dívidas.`,
        tags: ['parcelamento', 'cartao', 'item_fatura'],
      });
    }

    setModalNovaCompraAberto(false);
    setNovaDescricao('');
    setNovoValorTotal('');
  };

  return (
    <div id="faturas-parcelamentos-view" className="space-y-6 animate-fadeIn pb-12">
      
      {/* 1. CABEÇALHO & BANNER DE ISOLAMENTO INFORMATIVO */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <Layers className="w-4 h-4" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Gestão de Faturas & Dívidas Parceladas
              </h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                Análise Isolada
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Mapeie exatamente quanto de limite e orçamento futuro está comprometido mês a mês. 
              <strong className="text-indigo-300 font-medium ml-1">
                Esta área é separada do fluxo de caixa diário para não duplicar suas despesas pagas.
              </strong>
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-simular-compra"
              onClick={() => setSubTab('simulador')}
              className="px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Calculator className="w-4 h-4 text-purple-400" />
              <span>Simular Nova Compra</span>
            </button>

            <button
              id="btn-adicionar-parcelamento-topo"
              onClick={() => setModalNovaCompraAberto(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-indigo-950/50 flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Nova Compra Parcelada</span>
            </button>
          </div>
        </div>

        {/* Card Selector Pills */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1 mr-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Filtrar Cartão:
          </span>
          <button
            onClick={() => setCartaoSelecionadoId('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
              cartaoSelecionadoId === 'todos'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40'
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Todos os Cartões ({cartoes.length})
          </button>

          {cartoes.map((cartao) => (
            <button
              key={cartao.id}
              onClick={() => setCartaoSelecionadoId(cartao.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                cartaoSelecionadoId === cartao.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: cartao.cor || '#8b5cf6' }}
              ></div>
              <span>{cartao.nome}</span>
              <span className="text-[10px] opacity-70 font-mono">•••• {cartao.ultimosDigitos}</span>
            </button>
          ))}
        </div>
      </div>

      {/* BANNER DE DETECÇÃO AUTOMÁTICA DE PARCELAS PENDENTES (ex: 05/06, 03/12) */}
      {lancamentosNaoEstruturados.length > 0 && onAtualizarLoteLancamentos && (
        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-white">
                {lancamentosNaoEstruturados.length} parcelamento(s) identificado(s) na descrição das compras
              </h4>
              <p className="text-[11px] text-slate-300">
                Padrões como <span className="font-mono text-indigo-300 font-bold">05/06</span> e <span className="font-mono text-indigo-300 font-bold">03/12</span> foram encontrados em lançamentos anteriores e podem ser integrados à projeção futura.
              </p>
            </div>
          </div>
          <button
            onClick={handleSincronizarParcelas}
            disabled={sincronizandoParcelas}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-md shadow-indigo-950"
          >
            {sincronizandoParcelas ? (
              <span>Sincronizando...</span>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Sincronizar {lancamentosNaoEstruturados.length} Parcela(s)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* FEEDBACK DE SUCESSO DE SINCRONIZAÇÃO */}
      {sucessoSincronizacao && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{sucessoSincronizacao}</span>
        </div>
      )}

      {/* 2. TOP METRIC CARDS (INDICADORES DE DÍVIDA E CAPACIDADE) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Dívida Total Parcelada Restante */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Dívida Total Restante</span>
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-bold font-mono text-rose-400">
              {formatarMoeda(totalDividaFutura)}
            </h3>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Compras ativas:</span>
            <strong className="text-white">{comprasAgrupadas.filter(c => !c.concluida).length} contratos</strong>
          </div>
        </div>

        {/* Card 2: Média Mensal de Parcelas */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Comprometimento Médio</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-bold font-mono text-amber-400">
              {formatarMoeda(mediaMensalFutura)}
              <span className="text-xs font-normal text-slate-400 ml-1">/mês</span>
            </h3>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Horizonte analisado:</span>
            <strong className="text-white">{horizonteMeses} meses à frente</strong>
          </div>
        </div>

        {/* Card 3: Data de Término da Última Dívida */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Previsão de Quitação Total</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <CalendarCheck2 className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-emerald-400 capitalize truncate" title={mesFinalizacaoGeral}>
              {mesFinalizacaoGeral}
            </h3>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Alívio orçamentário:</span>
            <strong className="text-emerald-400">100% livre</strong>
          </div>
        </div>

        {/* Card 4: Capacidade Liberada em Breve */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Liberação Próx. 3 Meses</span>
              <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-bold font-mono text-teal-300">
              +{formatarMoeda(totalLiberadoProximos3Meses)}
              <span className="text-xs font-normal text-slate-400 ml-1">/mês</span>
            </h3>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Fôlego para novas compras:</span>
            <strong className="text-teal-400">Desbloqueio progressivo</strong>
          </div>
        </div>

      </div>

      {/* 3. NAVEGAÇÃO DE SUB-ABAS */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setSubTab('projecao')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'projecao'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Linha do Tempo (Mês a Mês)</span>
          </button>

          <button
            onClick={() => setSubTab('compras_ativas')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'compras_ativas'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Compras Parceladas Ativas ({comprasAgrupadas.filter(c => !c.concluida).length})</span>
          </button>

          <button
            onClick={() => setSubTab('simulador')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'simulador'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-950'
                : 'text-purple-300 hover:text-purple-200 hover:bg-purple-500/10'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Simulador de Compras Futuras</span>
          </button>

          <button
            onClick={() => setSubTab('limites')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'limites'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Limites & Desbloqueio</span>
          </button>
        </div>

        {subTab === 'projecao' && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Horizonte:</span>
            <select
              value={horizonteMeses}
              onChange={(e) => setHorizonteMeses(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"
            >
              <option value={6}>6 Meses</option>
              <option value={12}>12 Meses (1 Ano)</option>
              <option value={18}>18 Meses</option>
              <option value={24}>24 Meses (2 Anos)</option>
            </select>
          </div>
        )}
      </div>

      {/* 4. CONTEÚDO DA SUB-ABA 1: LINHA DO TEMPO (MÊS A MÊS) */}
      {subTab === 'projecao' && (
        <div className="space-y-6">
          
          {/* Gráfico de Evolução das Faturas Futuras */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-indigo-400" />
                  Evolução do Comprometimento da Fatura Futura
                </h3>
                <p className="text-xs text-slate-400">
                  Veja as despesas caindo à medida que as parcelas antigas chegam ao fim
                </p>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={projecoesMeses} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="rotuloMes" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={11} 
                    tickLine={false} 
                    tickFormatter={(val) => `R$ ${val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}`} 
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as ProjecaoMesFuturo;
                        return (
                          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-xl text-xs space-y-1.5">
                            <p className="font-bold text-white">{data.rotuloMes}</p>
                            <p className="text-indigo-300 font-mono font-semibold">
                              Total Previsto: {formatarMoeda(data.valorTotal)}
                            </p>
                            <p className="text-slate-400">
                              {data.itens.length} parcela(s) neste mês
                            </p>
                            {data.itensFinalizando.length > 0 && (
                              <div className="pt-1 border-t border-slate-800 text-emerald-400 text-[11px]">
                                🏁 {data.itensFinalizando.length} compra(s) terminam aqui (+{formatarMoeda(data.valorTotalLiberadoProximoMes)}/mês liberados)
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="valorTotal" radius={[6, 6, 0, 0]}>
                    {projecoesMeses.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.itensFinalizando.length > 0 ? '#10b981' : '#6366f1'} 
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                  <Line 
                    type="monotone" 
                    dataKey="valorTotal" 
                    stroke="#a855f7" 
                    strokeWidth={2} 
                    dot={{ fill: '#a855f7', r: 3 }} 
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-6 mt-3 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-indigo-500"></div>
                <span>Fatura em Andamento</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                <span>Mês com Quitação de Parcela (Alívio de Caixa)</span>
              </div>
            </div>
          </div>

          {/* Cards Expansíveis de cada Mês Futuro */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              Detalhamento de Parcelas Mês a Mês
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projecoesMeses.map((mes) => {
                const isExpandido = mesExpandido === mes.anoMes;
                const temQuitação = mes.itensFinalizando.length > 0;

                return (
                  <div
                    key={mes.anoMes}
                    className={`rounded-2xl border transition-all ${
                      temQuitação
                        ? 'bg-slate-900/90 border-emerald-500/30 shadow-lg shadow-emerald-950/20'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Header do Mês */}
                    <div 
                      onClick={() => setMesExpandido(isExpandido ? null : mes.anoMes)}
                      className="p-4 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-bold text-xs ${
                          temQuitação 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          <span>{mes.rotuloMes.split('/')[0]}</span>
                          <span className="text-[9px] font-normal opacity-70">
                            {mes.rotuloMes.split('/')[1] || mes.ano}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{mes.rotuloMes}</span>
                            {temQuitação && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                🏁 Última Parcela
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">
                            {mes.itens.length} compra(s) parcelada(s)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block text-[11px]">Total Estimado</span>
                          <span className="text-base font-bold font-mono text-white">
                            {formatarMoeda(mes.valorTotal)}
                          </span>
                        </div>
                        <button className="text-slate-400 hover:text-white">
                          {isExpandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Banner de Quitação / Alívio do Mês */}
                    {temQuitação && (
                      <div className="px-4 py-2 bg-emerald-950/30 border-t border-b border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          {mes.itensFinalizando.map(f => f.descricao).join(', ')} encerra aqui!
                        </span>
                        <strong className="font-mono text-emerald-400 font-bold">
                          +{formatarMoeda(mes.valorTotalLiberadoProximoMes)}/mês livre a partir do próx. mês
                        </strong>
                      </div>
                    )}

                    {/* Detalhes Expandidos das Parcelas */}
                    {isExpandido && (
                      <div className="p-4 pt-2 border-t border-slate-800 space-y-2 text-xs">
                        <span className="text-slate-400 text-[11px] font-medium block mb-1">
                          Composição da Fatura deste mês:
                        </span>

                        {mes.itens.length === 0 ? (
                          <p className="text-slate-500 italic py-2">Nenhuma parcela prevista para este mês.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {mes.itens.map((it, idx) => {
                              const cartaoItem = cartoes.find(c => c.id === it.cartaoId);
                              return (
                                <div
                                  key={idx}
                                  className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2">
                                    {cartaoItem && (
                                      <div
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: cartaoItem.cor || '#8b5cf6' }}
                                        title={cartaoItem.nome}
                                      ></div>
                                    )}
                                    <span className="text-slate-200 font-medium">{it.descricao}</span>
                                    {it.numeroParcela && it.totalParcelas && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                                        {it.numeroParcela}/{it.totalParcelas}
                                      </span>
                                    )}
                                    {it.isUltimaParcela && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                                        Fim
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-indigo-300 font-mono font-bold">
                                    {formatarMoeda(it.valor)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* 5. CONTEÚDO DA SUB-ABA 2: COMPRAS PARCELADAS ATIVAS (CONTRATOS) */}
      {subTab === 'compras_ativas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Contratos de Compras Parceladas
              </h3>
              <p className="text-xs text-slate-400">
                Acompanhe o progresso de cada parcelamento e quanto falta para quitar
              </p>
            </div>

            <button
              onClick={() => setModalNovaCompraAberto(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Adicionar Compra</span>
            </button>
          </div>

          {comprasAgrupadas.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center space-y-3">
              <Layers className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-base font-bold text-white">Nenhum parcelamento ativo encontrado</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Você não possui compras parceladas cadastradas. Clique no botão abaixo para adicionar sua primeira compra e projetar suas finanças.
              </p>
              <button
                onClick={() => setModalNovaCompraAberto(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Cadastrar Compra Parcelada</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {comprasAgrupadas.map((compra) => {
                const cartao = cartoes.find((c) => c.id === compra.cartaoId);
                const categoria = categorias.find((cat) => cat.id === compra.categoriaId);
                const progresso = Math.min(
                  100,
                  Math.round((compra.parcelasPagas / compra.totalParcelas) * 100)
                );

                return (
                  <div
                    key={compra.id}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                      compra.concluida
                        ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-lg'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {cartao ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: cartao.cor || '#8b5cf6' }}
                              ></div>
                              {cartao.nome}
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                              Sem Cartão
                            </span>
                          )}

                          {categoria && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400">
                              {categoria.nome}
                            </span>
                          )}
                        </div>

                        {compra.concluida ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Quitada
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            Restam {compra.parcelasRestantes}x
                          </span>
                        )}
                      </div>

                      {/* Title & Value */}
                      <h4 className="text-base font-bold text-white mb-1">{compra.descricaoBase}</h4>
                      
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-xl font-bold font-mono text-white">
                          {formatarMoeda(compra.valorParcela)}
                          <span className="text-xs font-normal text-slate-400 ml-1">/mês</span>
                        </span>
                        <span className="text-xs text-slate-400">
                          (Total: {formatarMoeda(compra.valorTotalOriginal)})
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5 mb-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">
                            Progresso: <strong className="text-white">{compra.parcelasPagas} de {compra.totalParcelas} pagas</strong>
                          </span>
                          <span className="font-mono text-indigo-300 font-semibold">{progresso}%</span>
                        </div>

                        <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              compra.concluida
                                ? 'bg-emerald-500'
                                : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                            }`}
                            style={{ width: `${progresso}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Status Card */}
                    <div className="pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                        <span className="text-slate-400 block text-[10px]">Saldo Devedor Restante</span>
                        <span className="text-rose-400 font-bold font-mono text-sm">
                          {formatarMoeda(compra.saldoDevedor)}
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                        <span className="text-slate-400 block text-[10px]">Finaliza em</span>
                        <span className="text-emerald-400 font-bold capitalize text-sm truncate" title={compra.mesTerminoFormatado}>
                          {compra.mesTerminoFormatado || 'Em breve'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. CONTEÚDO DA SUB-ABA 3: SIMULADOR DE COMPRAS FUTURAS */}
      {subTab === 'simulador' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-950/30 via-slate-900 to-slate-900 border border-purple-500/30 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Simulador de Impacto Orçamentário</h3>
                <p className="text-xs text-slate-300">
                  Planeje compras futuras e veja se elas cabem no seu orçamento conforme parcelas antigas forem terminando.
                </p>
              </div>
            </div>

            {/* Simulation Controls Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Nome da Compra Planejada</label>
                <input
                  type="text"
                  value={simulacaoDescricao}
                  onChange={(e) => setSimulacaoDescricao(e.target.value)}
                  placeholder="Ex: Novo Smartphone, Curso, Viagem..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Valor Total da Compra (R$)</label>
                <input
                  type="number"
                  step="10"
                  value={simulacaoValorTotal}
                  onChange={(e) => setSimulacaoValorTotal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Nº de Parcelas</label>
                <select
                  value={simulacaoParcelas}
                  onChange={(e) => setSimulacaoParcelas(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 24].map((n) => (
                    <option key={n} value={n}>
                      {n}x de {formatarMoeda((parseFloat(simulacaoValorTotal) || 0) / n)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Início das Parcelas</label>
                <select
                  value={simulacaoMesInicio}
                  onChange={(e) => setSimulacaoMesInicio(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  <option value={0}>Neste Mês Atual</option>
                  <option value={1}>No Próximo Mês</option>
                  <option value={2}>Em 2 Meses</option>
                  <option value={3}>Em 3 Meses</option>
                </select>
              </div>
            </div>

            {/* Simulation Insight Box */}
            <div className="mt-4 p-4 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-start gap-3 text-xs">
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-slate-300">
                <strong className="text-white block">Resultado da Simulação:</strong>
                <p>
                  Esta compra adicionará uma parcela de <strong className="text-purple-300 font-mono">{formatarMoeda(resultadoSimulacao.valorParcelaNova)}/mês</strong> por {simulacaoParcelas} meses (finalizando em <strong className="text-emerald-400">{resultadoSimulacao.mesTerminoSimulacao}</strong>).
                </p>
                {totalLiberadoProximos3Meses >= resultadoSimulacao.valorParcelaNova ? (
                  <p className="text-emerald-300 font-medium flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Excelente momento! Suas dívidas atuais que estão terminando liberam +{formatarMoeda(totalLiberadoProximos3Meses)}/mês, compensando totalmente a nova parcela.
                  </p>
                ) : (
                  <p className="text-amber-300 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    Atenção: A nova parcela aumentará sua fatura média em relação ao que você paga hoje.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Gráfico Comparativo: Antes vs Depois da Nova Compra */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <h4 className="text-sm font-bold text-white mb-2">
              Comparativo de Fatura: Sem a Nova Compra vs. Com a Nova Compra
            </h4>

            <div className="h-64 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resultadoSimulacao.projecoesSimuladas} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="rotuloMes" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `R$ ${v}`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-xl text-xs space-y-1">
                            <p className="font-bold text-white">{d.rotuloMes}</p>
                            <p className="text-slate-400">Fatura Atual: {formatarMoeda(d.valorOriginal)}</p>
                            <p className="text-purple-300 font-mono font-bold">Com Nova Compra: {formatarMoeda(d.valorNovo)}</p>
                            {d.parcelaNovaValor > 0 && (
                              <p className="text-purple-400 text-[11px]">+ {formatarMoeda(d.parcelaNovaValor)} da nova compra</p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="valorOriginal" name="Fatura Atual" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.6} />
                  <Bar dataKey="valorNovo" name="Com Nova Compra" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-6 mt-3 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-indigo-500 opacity-60"></div>
                <span>Fatura Atual (Sem a Compra)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-purple-500"></div>
                <span>Fatura Projetada (Com a Nova Compra)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. CONTEÚDO DA SUB-ABA 4: LIMITES & DESBLOQUEIO GRADUAL */}
      {subTab === 'limites' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-400" />
                Limites de Crédito & Liberação Progressiva
              </h3>
              <p className="text-xs text-slate-400">
                Veja quanto do limite total está bloqueado por parcelas futuras e quando ele retorna para uso livre
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cartoes.map((cartao) => {
              const limiteTotal = cartao.limiteTotal || 1;
              const comprasDoCartao = comprasAgrupadas.filter((c) => c.cartaoId === cartao.id);
              const dividaComprometida = comprasDoCartao.reduce((acc, c) => acc + c.saldoDevedor, 0);
              const limiteDisponivelReal = Math.max(0, limiteTotal - dividaComprometida);
              const percComprometido = Math.min(100, Math.round((dividaComprometida / limiteTotal) * 100));

              return (
                <div
                  key={cartao.id}
                  className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cartao.cor || '#8b5cf6' }}
                      ></div>
                      <h4 className="text-base font-bold text-white">{cartao.nome}</h4>
                    </div>
                    <span className="text-xs font-mono text-slate-400">•••• {cartao.ultimosDigitos}</span>
                  </div>

                  {/* Limits Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Limite Comprometido com Parcelamentos</span>
                      <span className="font-mono text-rose-400 font-bold">{percComprometido}%</span>
                    </div>

                    <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          percComprometido > 75
                            ? 'bg-rose-500'
                            : 'bg-gradient-to-r from-teal-500 to-indigo-500'
                        }`}
                        style={{ width: `${percComprometido}%` }}
                      ></div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                        <span className="text-slate-400 block text-[10px]">Limite Total</span>
                        <span className="text-white font-bold font-mono">
                          {formatarMoeda(cartao.limiteTotal)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                        <span className="text-slate-400 block text-[10px]">Bloqueado em Dívidas</span>
                        <span className="text-rose-400 font-bold font-mono">
                          {formatarMoeda(dividaComprometida)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                        <span className="text-slate-400 block text-[10px]">Livre para Uso</span>
                        <span className="text-emerald-400 font-bold font-mono">
                          {formatarMoeda(limiteDisponivelReal)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                    <span>Fecha dia: <strong className="text-white">Dia {cartao.diaFechamento}</strong></span>
                    <span>Vence dia: <strong className="text-amber-400">Dia {cartao.diaVencimento}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. MODAL DE CADASTRO RÁPIDO DE COMPRA PARCELADA */}
      {modalNovaCompraAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-indigo-400" />
                  Cadastrar Compra Parcelada
                </h3>
                <p className="text-slate-400 text-[11px]">
                  Crie os lançamentos parcelados para projetar as faturas futuras
                </p>
              </div>
              <button
                onClick={() => setModalNovaCompraAberto(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarNovaCompraParcelada} className="space-y-4">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Descrição da Compra *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Notebook Dell Inspiron, iPhone 15..."
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Valor Total (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={novoValorTotal}
                    onChange={(e) => setNovoValorTotal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Nº de Parcelas *</label>
                  <select
                    value={novoNumeroParcelas}
                    onChange={(e) => setNovoNumeroParcelas(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 24, 36].map((n) => (
                      <option key={n} value={n}>
                        {n}x de {formatarMoeda((parseFloat(novoValorTotal) || 0) / n)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Cartão de Crédito</label>
                  <select
                    value={novoCartaoId}
                    onChange={(e) => setNovoCartaoId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Sem vínculo com cartão</option>
                    {cartoes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} (final {c.ultimosDigitos})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Categoria</label>
                  <select
                    value={novaCategoriaId}
                    onChange={(e) => setNovaCategoriaId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Vencimento da 1ª Parcela</label>
                <input
                  type="date"
                  value={novaDataPrimeiroVenc}
                  onChange={(e) => setNovaDataPrimeiroVenc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovaCompraAberto(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Criar Lançamentos Parcelados</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
