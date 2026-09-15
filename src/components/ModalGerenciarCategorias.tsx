/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Tag,
  ArrowRightLeft,
  Sparkles,
  DollarSign,
  AlertTriangle,
  Layers,
  FolderPlus,
  Sliders,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Search
} from 'lucide-react';
import { Categoria, Lancamento } from '../types';
import { formatarMoeda } from '../utils/format';
import { CategoryIcon, ICONES_DISPONIVEIS, CORES_PRESET } from '../utils/categoryIcons';

interface ModalGerenciarCategoriasProps {
  isOpen: boolean;
  onClose: () => void;
  categorias: Categoria[];
  lancamentos: Lancamento[];
  onSalvarCategoria: (cat: Categoria) => Promise<void>;
  onExcluirCategoria: (categoriaId: string, categoriaSubstitutaId?: string) => Promise<void>;
  onMesclarCategorias: (origemId: string, destinoId: string) => Promise<void>;
}

const CATEGORIAS_SUGERIDAS_POPULARES = [
  { nome: 'Assinaturas & Streaming', tipo: 'despesa', cor: '#8b5cf6', icone: 'Tv', orcamento: 150, descricao: 'Netflix, Spotify, Prime, etc.' },
  { nome: 'Pets & Veterinário', tipo: 'despesa', cor: '#f97316', icone: 'PawPrint', orcamento: 300, descricao: 'Ração, consultas, vacinas e pet shop' },
  { nome: 'Vestuário & Roupas', tipo: 'despesa', cor: '#ec4899', icone: 'Shirt', orcamento: 350, descricao: 'Roupas, calçados e acessórios' },
  { nome: 'Beleza & Cuidados', tipo: 'despesa', cor: '#06b6d4', icone: 'Sparkles', orcamento: 200, descricao: 'Barbearia, salão, cosméticos e estética' },
  { nome: 'Impostos & Tributos', tipo: 'despesa', cor: '#ef4444', icone: 'Receipt', orcamento: 500, descricao: 'IPVA, IPTU, IRPF, MEI e taxas governamentais' },
  { nome: 'Viagens & Turismo', tipo: 'despesa', cor: '#3b82f6', icone: 'Plane', orcamento: 800, descricao: 'Passagens, hospedagem e passeios' },
  { nome: 'Investimentos & Aportes', tipo: 'despesa', cor: '#10b981', icone: 'PiggyBank', orcamento: 1000, descricao: 'Aportes mensais, ações, renda fixa e CDB' },
  { nome: 'Manutenção & Reforma', tipo: 'despesa', cor: '#64748b', icone: 'Wrench', orcamento: 400, descricao: 'Reparos da casa ou oficina mecânica' },
  { nome: 'Freelance & Projetos', tipo: 'receita', cor: '#6366f1', icone: 'Laptop', orcamento: 0, descricao: 'Trabalhos extras e projetos independentes' },
  { nome: 'Vendas & Comissões', tipo: 'receita', cor: '#10b981', icone: 'TrendingUp', orcamento: 0, descricao: 'Vendas de produtos ou comissões recebidas' },
];

export const ModalGerenciarCategorias: React.FC<ModalGerenciarCategoriasProps> = ({
  isOpen,
  onClose,
  categorias,
  lancamentos,
  onSalvarCategoria,
  onExcluirCategoria,
  onMesclarCategorias,
}) => {
  const [tabAtiva, setTabAtiva] = useState<'lista' | 'nova' | 'mesclar'>('lista');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'despesa' | 'receita'>('todos');
  const [busca, setBusca] = useState('');

  // Form de Criar / Editar
  const [categoriaEmEdicao, setCategoriaEmEdicao] = useState<Categoria | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'despesa' | 'receita'>('despesa');
  const [cor, setCor] = useState('#3b82f6');
  const [icone, setIcone] = useState('Tag');
  const [orcamentoMensal, setOrcamentoMensal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Exclusão com substituição
  const [categoriaParaExcluir, setCategoriaParaExcluir] = useState<Categoria | null>(null);
  const [categoriaSubstitutaId, setCategoriaSubstitutaId] = useState<string>('');

  // Mesclagem
  const [origemMesclarId, setOrigemMesclarId] = useState<string>('');
  const [destinoMesclarId, setDestinoMesclarId] = useState<string>('');

  // Contagem de lançamentos por categoria
  const contagemLancamentos = useMemo(() => {
    const map: Record<string, number> = {};
    lancamentos.forEach((l) => {
      if (l.categoriaId) {
        map[l.categoriaId] = (map[l.categoriaId] || 0) + 1;
      }
    });
    return map;
  }, [lancamentos]);

  // Lista filtrada
  const categoriasFiltradas = useMemo(() => {
    return categorias.filter((c) => {
      if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        return c.nome.toLowerCase().includes(q) || (c.descricao && c.descricao.toLowerCase().includes(q));
      }
      return true;
    });
  }, [categorias, filtroTipo, busca]);

  // Categorias sugeridas que ainda não existem
  const sugestoesNaoAdicionadas = useMemo(() => {
    const nomesExistentes = new Set(categorias.map((c) => c.nome.toLowerCase()));
    return CATEGORIAS_SUGERIDAS_POPULARES.filter((sug) => !nomesExistentes.has(sug.nome.toLowerCase()));
  }, [categorias]);

  if (!isOpen) return null;

  const iniciarCriacao = () => {
    setCategoriaEmEdicao(null);
    setNome('');
    setTipo('despesa');
    setCor('#3b82f6');
    setIcone('Tag');
    setOrcamentoMensal('');
    setDescricao('');
    setTabAtiva('nova');
  };

  const iniciarEdicao = (cat: Categoria) => {
    setCategoriaEmEdicao(cat);
    setNome(cat.nome);
    setTipo(cat.tipo);
    setCor(cat.cor || '#3b82f6');
    setIcone(cat.icone || 'Tag');
    setOrcamentoMensal(cat.orcamentoMensal ? String(cat.orcamentoMensal) : '');
    setDescricao(cat.descricao || '');
    setTabAtiva('nova');
  };

  const handleSalvarForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    setSalvando(true);
    try {
      const orcNum = parseFloat(orcamentoMensal.replace(',', '.'));
      const catObj: Categoria = {
        id: categoriaEmEdicao ? categoriaEmEdicao.id : `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        nome: nome.trim(),
        tipo,
        cor,
        icone,
        orcamentoMensal: !isNaN(orcNum) && orcNum > 0 ? orcNum : undefined,
        descricao: descricao.trim() || undefined,
      };

      await onSalvarCategoria(catObj);
      setTabAtiva('lista');
      setCategoriaEmEdicao(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar categoria.');
    } finally {
      setSalvando(false);
    }
  };

  const handleAdicionarSugestao = async (sug: typeof CATEGORIAS_SUGERIDAS_POPULARES[0]) => {
    setSalvando(true);
    try {
      const catObj: Categoria = {
        id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        nome: sug.nome,
        tipo: sug.tipo as 'despesa' | 'receita',
        cor: sug.cor,
        icone: sug.icone,
        orcamentoMensal: sug.orcamento > 0 ? sug.orcamento : undefined,
        descricao: sug.descricao,
      };
      await onSalvarCategoria(catObj);
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!categoriaParaExcluir) return;
    setSalvando(true);
    try {
      await onExcluirCategoria(categoriaParaExcluir.id, categoriaSubstitutaId || undefined);
      setCategoriaParaExcluir(null);
      setCategoriaSubstitutaId('');
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir categoria.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExecutarMesclagem = async () => {
    if (!origemMesclarId || !destinoMesclarId || origemMesclarId === destinoMesclarId) {
      alert('Selecione uma categoria de origem e outra de destino diferente.');
      return;
    }
    const catOrigem = categorias.find((c) => c.id === origemMesclarId);
    const catDestino = categorias.find((c) => c.id === destinoMesclarId);
    if (!window.confirm(`Tem certeza que deseja transferir todos os lançamentos de "${catOrigem?.nome}" para "${catDestino?.nome}" e remover a categoria original?`)) {
      return;
    }

    setSalvando(true);
    try {
      await onMesclarCategorias(origemMesclarId, destinoMesclarId);
      setOrigemMesclarId('');
      setDestinoMesclarId('');
      setTabAtiva('lista');
    } catch (err) {
      console.error(err);
      alert('Erro ao mesclar categorias.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div role="dialog" aria-modal="true" aria-labelledby="modal-gerenciar-categorias-title" className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-gerenciar-categorias-title" className="text-base font-bold text-white">Gerenciador de Categorias</h2>
              <p className="text-xs text-slate-400">Personalize cores, ícones, orçamentos e mesclagens</p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Fechar"
            aria-label="Fechar"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setTabAtiva('lista'); setCategoriaEmEdicao(null); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                tabAtiva === 'lista'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Categorias ({categorias.length})</span>
            </button>

            <button
              onClick={iniciarCriacao}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                tabAtiva === 'nova' && !categoriaEmEdicao
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Categoria</span>
            </button>

            <button
              onClick={() => setTabAtiva('mesclar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                tabAtiva === 'mesclar'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Unificar / Mesclar</span>
            </button>
          </div>

          {tabAtiva === 'lista' && (
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-[11px]">
              <button
                onClick={() => setFiltroTipo('todos')}
                className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer ${
                  filtroTipo === 'todos' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setFiltroTipo('despesa')}
                className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer flex items-center gap-1 ${
                  filtroTipo === 'despesa' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Despesas
              </button>
              <button
                onClick={() => setFiltroTipo('receita')}
                className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer flex items-center gap-1 ${
                  filtroTipo === 'receita' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Receitas
              </button>
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: LISTAGEM DE CATEGORIAS */}
          {tabAtiva === 'lista' && (
            <div className="space-y-4">
              
              {/* Barra de Pesquisa */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Pesquisar categoria..."
                  className="w-full pl-9.5 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Grid / Lista de Categorias */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categoriasFiltradas.map((cat) => {
                  const qtdLancamentos = contagemLancamentos[cat.id] || 0;
                  return (
                    <div
                      key={cat.id}
                      className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                          style={{ backgroundColor: `${cat.cor || '#3b82f6'}25`, color: cat.cor || '#3b82f6' }}
                        >
                          <CategoryIcon nomeIcone={cat.icone} className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">{cat.nome}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                              cat.tipo === 'receita' ? 'bg-teal-500/15 text-teal-400' : 'bg-rose-500/15 text-rose-400'
                            }`}>
                              {cat.tipo === 'receita' ? 'Receita' : 'Despesa'}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{qtdLancamentos} {qtdLancamentos === 1 ? 'lançamento' : 'lançamentos'}</span>
                            {cat.orcamentoMensal && cat.orcamentoMensal > 0 && (
                              <span>• Meta: {formatarMoeda(cat.orcamentoMensal)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Ações de Linha */}
                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => iniciarEdicao(cat)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Editar Categoria"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setCategoriaParaExcluir(cat)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-600 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Excluir Categoria"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {categoriasFiltradas.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Nenhuma categoria encontrada com os filtros selecionados.
                </div>
              )}

              {/* Sugestões Populares para Adicionar Rápido */}
              {sugestoesNaoAdicionadas.length > 0 && (
                <div className="pt-4 border-t border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sugestões Prontas para Adicionar em 1 Clique</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sugestoesNaoAdicionadas.slice(0, 6).map((sug) => (
                      <button
                        key={sug.nome}
                        type="button"
                        onClick={() => handleAdicionarSugestao(sug)}
                        disabled={salvando}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/80 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: sug.cor }}
                        />
                        <span>{sug.nome}</span>
                        <Plus className="w-3 h-3 text-indigo-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: CRIAR / EDITAR FORMULÁRIO */}
          {tabAtiva === 'nova' && (
            <form onSubmit={handleSalvarForm} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-white">
                  {categoriaEmEdicao ? `Editando: ${categoriaEmEdicao.nome}` : 'Cadastrar Nova Categoria'}
                </span>
                <button
                  type="button"
                  onClick={() => { setTabAtiva('lista'); setCategoriaEmEdicao(null); }}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Voltar para lista
                </button>
              </div>

              {/* Nome e Tipo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Nome da Categoria
                  </label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Assinaturas de TV, Farmácia, Combustível..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Tipo de Fluxo
                  </label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as 'despesa' | 'receita')}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="despesa">Despesa</option>
                    <option value="receita">Receita</option>
                  </select>
                </div>
              </div>

              {/* Seletor de Cores */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Cor de Identificação
                </label>
                <div className="flex items-center gap-2 flex-wrap bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                  {CORES_PRESET.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCor(c)}
                      title={c}
                      aria-label={`Cor ${c}`}
                      className={`w-7 h-7 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                        cor === c ? 'ring-2 ring-white scale-110 shadow-md' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {cor === c && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={cor}
                    onChange={(e) => setCor(e.target.value)}
                    className="w-7 h-7 rounded-xl bg-transparent cursor-pointer border-0"
                    title="Escolher cor personalizada"
                  />
                </div>
              </div>

              {/* Seletor de Ícones */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Ícone Representativo
                </label>
                <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 max-h-40 overflow-y-auto p-2.5 bg-slate-950 rounded-2xl border border-slate-800">
                  {ICONES_DISPONIVEIS.map((item) => {
                    const IconComp = item.icone;
                    const isSelected = icone.toLowerCase() === item.nome.toLowerCase();
                    return (
                      <button
                        key={item.nome}
                        type="button"
                        onClick={() => setIcone(item.nome)}
                        title={item.label}
                        aria-label={item.label}
                        className={`p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md scale-105'
                            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Orçamento Mensal & Descrição */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Teto / Orçamento Mensal (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">R$</span>
                    <input
                      type="number"
                      step="10"
                      min="0"
                      value={orcamentoMensal}
                      onChange={(e) => setOrcamentoMensal(e.target.value)}
                      placeholder="0.00 (Opcional)"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Descrição Breve
                  </label>
                  <input
                    type="text"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Ex: Gastos com medicamentos e consultas"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setTabAtiva('lista'); setCategoriaEmEdicao(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-950/60 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{salvando ? 'Salvando...' : categoriaEmEdicao ? 'Salvar Alterações' : 'Criar Categoria'}</span>
                </button>
              </div>

            </form>
          )}

          {/* TAB 3: UNIFICAR / MESCLAR CATEGORIAS */}
          {tabAtiva === 'mesclar' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl text-xs text-indigo-200">
                <span className="font-bold text-indigo-300 block">Como funciona a Mesclagem:</span>
                <p className="mt-1 text-indigo-200/80">
                  Transfere todos os lançamentos da categoria de origem para a categoria de destino de forma segura e remove a categoria duplicada.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    1. Categoria que será unificada (Origem):
                  </label>
                  <select
                    value={origemMesclarId}
                    onChange={(e) => setOrigemMesclarId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">Selecione a origem...</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.id === destinoMesclarId}>
                        {c.nome} ({contagemLancamentos[c.id] || 0} lançamentos)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    2. Categoria final que receberá tudo (Destino):
                  </label>
                  <select
                    value={destinoMesclarId}
                    onChange={(e) => setDestinoMesclarId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">Selecione o destino...</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.id === origemMesclarId}>
                        {c.nome} ({contagemLancamentos[c.id] || 0} lançamentos)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTabAtiva('lista')}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecutarMesclagem}
                  disabled={salvando || !origemMesclarId || !destinoMesclarId}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>{salvando ? 'Processando...' : 'Unificar Categorias Agora'}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO COM REATRIBUIÇÃO */}
        {categoriaParaExcluir && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Excluir Categoria "{categoriaParaExcluir.nome}"?</h3>
                  <p className="text-xs text-slate-400">
                    Possui <strong>{contagemLancamentos[categoriaParaExcluir.id] || 0}</strong> lançamentos associados.
                  </p>
                </div>
              </div>

              {(contagemLancamentos[categoriaParaExcluir.id] || 0) > 0 && (
                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Transferir lançamentos existentes para:
                  </label>
                  <select
                    value={categoriaSubstitutaId}
                    onChange={(e) => setCategoriaSubstitutaId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">Sem categoria (ou Outros)</option>
                    {categorias
                      .filter((c) => c.id !== categoriaParaExcluir.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome} ({c.tipo})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCategoriaParaExcluir(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarExclusao}
                  disabled={salvando}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{salvando ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
