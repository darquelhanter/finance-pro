/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from './context/AuthContext';
import { LoginView } from './components/LoginView';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DashboardView } from './components/DashboardView';
import { LancamentosView } from './components/LancamentosView';
import { ContasCartoesView } from './components/ContasCartoesView';
import { ImportacaoFaturaView } from './components/ImportacaoFaturaView';
import { OrcamentosView } from './components/OrcamentosView';
import { IaInsightsView } from './components/IaInsightsView';
import { FaturasParcelamentosView } from './components/FaturasParcelamentosView';
import { NovoLancamentoModal } from './components/NovoLancamentoModal';
import { SqlSchemaModal } from './components/SqlSchemaModal';
import { ModalPagarConta } from './components/ModalPagarConta';
import { ModalGerenciarCategorias } from './components/ModalGerenciarCategorias';
import { 
  Conta, 
  CartaoCredito, 
  Categoria, 
  Lancamento, 
  FaturaCartao,
  ImportacaoFaturaItem,
  StatusLancamento,
  DadosPagamento
} from './types';
import { formatarMoeda } from './utils/format';
import { ParcelamentoService } from './utils/parcelas';
import {
  subscribeContas,
  subscribeCartoes,
  subscribeCategorias,
  subscribeLancamentos,
  subscribeFaturas,
  salvarLancamento,
  excluirLancamento,
  salvarConta,
  salvarCartao,
  salvarCategoria,
  excluirCategoria,
  salvarFatura,
  registrarAuditLog,
  calcularResumoFinanceiro,
} from './services/firebase/firestore.service';
import { Loader2 } from 'lucide-react';

export function App() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  
  // Realtime Data State from Firestore
  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [faturas, setFaturas] = useState<FaturaCartao[]>([]);
  const [dataReady, setDataReady] = useState(false);

  // Modal States
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalSqlAberto, setModalSqlAberto] = useState(false);
  const [modalCategoriasAberto, setModalCategoriasAberto] = useState(false);
  const [lancamentoParaPagar, setLancamentoParaPagar] = useState<Lancamento | null>(null);

  // Real-time Firestore subscriptions for authenticated user
  useEffect(() => {
    if (!user) {
      setContas([]);
      setCartoes([]);
      setCategorias([]);
      setLancamentos([]);
      setFaturas([]);
      setDataReady(false);
      return;
    }

    let unsubContas: () => void;
    let unsubCartoes: () => void;
    let unsubCategorias: () => void;
    let unsubLancamentos: () => void;
    let unsubFaturas: () => void;

    try {
      unsubContas = subscribeContas(user.uid, (data) => setContas(data || []));
      unsubCartoes = subscribeCartoes(user.uid, (data) => setCartoes(data || []));
      unsubCategorias = subscribeCategorias(user.uid, (data) => setCategorias(data || []));
      unsubLancamentos = subscribeLancamentos(user.uid, (data) => setLancamentos(data || []));
      unsubFaturas = subscribeFaturas(user.uid, (data) => {
        setFaturas(data || []);
        setDataReady(true);
      });
    } catch (err) {
      console.error('Erro ao conectar listeners do Firestore:', err);
      setDataReady(true);
    }

    return () => {
      if (unsubContas) unsubContas();
      if (unsubCartoes) unsubCartoes();
      if (unsubCategorias) unsubCategorias();
      if (unsubLancamentos) unsubLancamentos();
      if (unsubFaturas) unsubFaturas();
    };
  }, [user]);

  // Dynamically calculate dashboard summary from real-time Firestore collections
  const resumo = useMemo(() => {
    return calcularResumoFinanceiro(contas, cartoes, categorias, lancamentos, faturas);
  }, [contas, cartoes, categorias, lancamentos, faturas]);

  // Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-xs tracking-wider uppercase font-semibold text-slate-300">Conectando ao Firebase...</p>
      </div>
    );
  }

  // Unauthenticated: Show Mobile-Ready Google Login View
  if (!isAuthenticated || !user) {
    return <LoginView />;
  }

  // ----------------------------------------------------
  // MUTATION HANDLERS (ISOLATED TO LOGGED-IN USER)
  // ----------------------------------------------------

  const handleAlterarStatusLancamento = async (id: string, novoStatus: StatusLancamento) => {
    if (!user) return;
    const lanc = lancamentos.find(l => l.id === id);
    if (!lanc) return;

    const statusAnterior = lanc.status;
    if (statusAnterior === novoStatus) return;

    let dataPagamento = lanc.dataPagamento;
    if (novoStatus === 'pago') {
      dataPagamento = new Date().toISOString().split('T')[0];
    } else if (novoStatus === 'pendente' || novoStatus === 'cancelado') {
      dataPagamento = undefined;
    }

    const atualizado: Lancamento = {
      ...lanc,
      status: novoStatus,
      dataPagamento,
      atualizadoEm: new Date().toISOString(),
    };

    // Ajusta saldo da conta se houver conta vinculada
    if (lanc.contaId) {
      const conta = contas.find(c => c.id === lanc.contaId);
      if (conta) {
        let delta = 0;
        // Se estava pago e agora não está mais (foi para pendente ou cancelado) -> estorna o valor
        if (statusAnterior === 'pago' && novoStatus !== 'pago') {
          delta = lanc.tipo === 'receita' ? -lanc.valor : lanc.valor;
        }
        // Se não estava pago e agora está pago -> aplica o débito/crédito
        else if (statusAnterior !== 'pago' && novoStatus === 'pago') {
          delta = lanc.tipo === 'receita' ? lanc.valor : -lanc.valor;
        }

        if (delta !== 0) {
          await salvarConta(user.uid, {
            ...conta,
            saldoAtual: Number(conta.saldoAtual) + delta,
          });
        }
      }
    }

    await salvarLancamento(user.uid, atualizado);
    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: id,
      acao: 'atualizacao',
      detalhes: `Status do lançamento "${lanc.descricao}" alterado de ${statusAnterior} para ${novoStatus}`,
    });

    if (novoStatus === 'pago') {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#10b981', '#14b8a6', '#06b6d4'],
      });
    }
  };

  const handleAlterarCategoriaLancamento = async (id: string, novaCategoriaId: string) => {
    if (!user) return;
    const lanc = lancamentos.find(l => l.id === id);
    if (!lanc) return;

    const categoriaObj = categorias.find(c => c.id === novaCategoriaId);
    const atualizado: Lancamento = {
      ...lanc,
      categoriaId: novaCategoriaId,
      atualizadoEm: new Date().toISOString(),
    };

    await salvarLancamento(user.uid, atualizado);
    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: id,
      acao: 'atualizacao',
      detalhes: `Categoria do lançamento "${lanc.descricao}" alterada para "${categoriaObj?.nome || novaCategoriaId}"`,
    });
  };

  const handleConverterParaDespesaReal = async (id: string) => {
    if (!user) return;
    const lanc = lancamentos.find(l => l.id === id);
    if (!lanc) return;

    const tagsFiltradas = (lanc.tags || []).filter(
      t => t !== 'item_fatura' && t !== 'detalhamento_cartao' && t !== 'extrato_cartao'
    );
    tagsFiltradas.push('contas-a-pagar', 'despesa_direta');

    const atualizado: Lancamento = {
      ...lanc,
      tipo: 'despesa',
      status: 'pendente',
      apenasVisualizacao: false,
      cartaoId: undefined, // remove o vínculo com cartão para virar despesa real direta / boleto
      tags: Array.from(new Set(tagsFiltradas)),
      observacoes: (lanc.observacoes || '').replace('(visualização no extrato)', '').replace('Compra no cartão de crédito', 'Boleto / Despesa Direta a Pagar').trim(),
      atualizadoEm: new Date().toISOString(),
    };

    await salvarLancamento(user.uid, atualizado);
    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: id,
      acao: 'atualizacao',
      detalhes: `Lançamento "${lanc.descricao}" convertido para Conta a Pagar direta (Boleto/Despesa Real)`,
    });
  };

  const handleAtualizarLancamentoCompleto = async (lancAtualizado: Lancamento) => {
    if (!user) return;
    await salvarLancamento(user.uid, {
      ...lancAtualizado,
      atualizadoEm: new Date().toISOString(),
    });
    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: lancAtualizado.id,
      acao: 'atualizacao',
      detalhes: `Lançamento "${lancAtualizado.descricao}" editado com sucesso`,
    });
  };

  const handlePagarLancamento = async (id: string) => {
    const lanc = lancamentos.find(l => l.id === id);
    if (lanc) {
      setLancamentoParaPagar(lanc);
    }
  };

  const handleConfirmarPagamentoComJuros = async (dados: DadosPagamento) => {
    if (!user) return;
    const lanc = lancamentos.find(l => l.id === dados.lancamentoId);
    if (!lanc) return;

    const valorOriginal = dados.valorOriginal;
    const valorFinalPago = dados.valorPago;
    const contaDestinoId = dados.contaId || lanc.contaId;
    const statusAnterior = lanc.status;

    const atualizado: Lancamento = {
      ...lanc,
      status: 'pago',
      dataPagamento: dados.dataPagamento,
      contaId: contaDestinoId,
      valorOriginal: valorOriginal,
      valor: valorFinalPago,
      valorPago: valorFinalPago,
      juros: dados.juros,
      multa: dados.multa,
      desconto: dados.desconto,
      observacoes: dados.observacoes || lanc.observacoes,
      atualizadoEm: new Date().toISOString(),
    };

    // Ajusta saldo da conta se houver conta vinculada
    if (contaDestinoId) {
      const conta = contas.find(c => c.id === contaDestinoId);
      if (conta) {
        let delta = 0;
        if (statusAnterior !== 'pago') {
          delta = lanc.tipo === 'receita' ? valorFinalPago : -valorFinalPago;
        } else {
          const valorAnterior = lanc.valor;
          delta = lanc.tipo === 'receita' ? (valorFinalPago - valorAnterior) : -(valorFinalPago - valorAnterior);
        }
        if (delta !== 0) {
          await salvarConta(user.uid, {
            ...conta,
            saldoAtual: Number(conta.saldoAtual) + delta,
          });
        }
      }
    }

    await salvarLancamento(user.uid, atualizado);

    let detalhes = `Pagamento efetuado de ${formatarMoeda(valorFinalPago)} para "${lanc.descricao}"`;
    if (dados.juros || dados.multa) {
      detalhes += ` (Original: ${formatarMoeda(valorOriginal)}, Juros: ${formatarMoeda(dados.juros || 0)}, Multa: ${formatarMoeda(dados.multa || 0)})`;
    }
    if (dados.desconto) {
      detalhes += ` (Desconto: ${formatarMoeda(dados.desconto)})`;
    }

    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: lanc.id,
      acao: 'pagamento',
      detalhes,
    });

    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.8 },
      colors: ['#10b981', '#34d399', '#f59e0b', '#06b6d4'],
    });

    setLancamentoParaPagar(null);
  };

  const handleCancelarLancamento = async (id: string) => {
    await handleAlterarStatusLancamento(id, 'cancelado');
  };

  const handleReabrirLancamento = async (id: string) => {
    await handleAlterarStatusLancamento(id, 'pendente');
  };

  const handleDeduplicarLancamentos = async () => {
    if (!user) return 0;
    const vistos = new Set<string>();
    const duplicadosParaRemover: string[] = [];

    // Prioriza manter os itens com fatura ou com tags específicas
    for (const lanc of lancamentos) {
      const chave = `${lanc.descricao.trim().toLowerCase()}_${lanc.valor}_${lanc.dataCompetencia || ''}_${lanc.dataVencimento || ''}_${lanc.cartaoId || lanc.contaId || ''}`;
      if (vistos.has(chave)) {
        duplicadosParaRemover.push(lanc.id);
      } else {
        vistos.add(chave);
      }
    }

    for (const id of duplicadosParaRemover) {
      await excluirLancamento(user.uid, id);
    }

    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: 'lote_dedup',
      acao: 'exclusao',
      detalhes: `Removidos ${duplicadosParaRemover.length} lançamentos duplicados`,
    });

    if (duplicadosParaRemover.length > 0) {
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
      });
    }

    return duplicadosParaRemover.length;
  };

  const handleSepararFaturasCartoes = async () => {
    if (!user) return;

    // 1. Localiza ou cria o Cartão Ailos / Viacredi
    let cartaoAilos = cartoes.find(c => 
      c.nome.toLowerCase().includes('ailos') || 
      c.nome.toLowerCase().includes('viacredi')
    );
    if (!cartaoAilos) {
      const ailosId = `cartao_ailos_${Date.now()}`;
      cartaoAilos = {
        id: ailosId,
        nome: 'Ailos / Viacredi',
        bandeira: 'mastercard',
        limiteTotal: 8000,
        limiteDisponivel: 8000,
        diaFechamento: 25,
        diaVencimento: 5,
        cor: '#0077c8',
        ultimosDigitos: '9876',
        ativo: true,
      };
      await salvarCartao(user.uid, cartaoAilos);
    }

    // 2. Localiza ou cria o Cartão Bradesco
    let cartaoBradesco = cartoes.find(c => 
      c.nome.toLowerCase().includes('bradesco')
    );
    if (!cartaoBradesco) {
      const bradescoId = `cartao_bradesco_${Date.now()}`;
      cartaoBradesco = {
        id: bradescoId,
        nome: 'Bradesco',
        bandeira: 'visa',
        limiteTotal: 10000,
        limiteDisponivel: 10000,
        diaFechamento: 25,
        diaVencimento: 10,
        cor: '#cc092f',
        ultimosDigitos: '4321',
        ativo: true,
      };
      await salvarCartao(user.uid, cartaoBradesco);
    }

    // 3. Remove duplicatas exatas de lançamentos
    const vistos = new Set<string>();
    const idsDuplicados: string[] = [];
    for (const lanc of lancamentos) {
      const chave = `${lanc.descricao.trim().toLowerCase()}_${lanc.valor}_${lanc.dataVencimento || ''}`;
      if (vistos.has(chave)) {
        idsDuplicados.push(lanc.id);
      } else {
        vistos.add(chave);
      }
    }
    for (const id of idsDuplicados) {
      await excluirLancamento(user.uid, id);
    }

    const listaLimpa = lancamentos.filter(l => !idsDuplicados.includes(l.id));

    // 4. Identifica e exclui faturas consolidadas antigas para recriar as 2 faturas limpas e separadas
    const faturasAntigas = listaLimpa.filter(l => 
      (l.tags?.includes('fatura') || l.descricao.toLowerCase().startsWith('fatura ')) &&
      !l.tags?.includes('despesa_direta') &&
      !l.tags?.includes('boleto')
    );
    for (const fat of faturasAntigas) {
      await excluirLancamento(user.uid, fat.id);
    }

    // 5. Separa as compras individuais entre Ailos, Bradesco e Boletos
    const itensRestantes = listaLimpa.filter(l => !faturasAntigas.some(f => f.id === l.id));
    
    // Boletos avulsos (ex: Consórcio Servopa)
    const boletos = itensRestantes.filter(l => {
      const descLower = (l.descricao || '').toLowerCase();
      const obsLower = (l.observacoes || '').toLowerCase();
      return descLower.includes('servopa') || 
             descLower.includes('consórcio') || 
             descLower.includes('consorcio') || 
             descLower.includes('boleto') ||
             obsLower.includes('servopa') ||
             obsLower.includes('consórcio');
    });

    for (const bol of boletos) {
      await salvarLancamento(user.uid, {
        ...bol,
        tipo: 'despesa',
        status: 'pendente',
        apenasVisualizacao: false,
        cartaoId: undefined,
        faturaId: undefined,
        tags: ['contas-a-pagar', 'despesa_direta', 'boleto'],
        observacoes: bol.observacoes || 'Boleto / Parcela a pagar (despesa real)',
        atualizadoEm: new Date().toISOString(),
      });
    }

    // Compras de cartão de crédito (todos que não são boletos)
    const comprasCartao = itensRestantes.filter(l => !boletos.some(b => b.id === l.id));

    // Ordena por data de criação / id para separar o lote Ailos do lote Bradesco
    const sortedCompras = [...comprasCartao].sort((a, b) => {
      const tA = new Date(a.criadoEm || a.dataCompetencia).getTime();
      const tB = new Date(b.criadoEm || b.dataCompetencia).getTime();
      return tA - tB;
    });

    const itensAilos: Lancamento[] = [];
    const itensBradesco: Lancamento[] = [];

    // Se temos 69 itens ou algo similar, os 39 primeiros são Ailos e os demais são Bradesco
    sortedCompras.forEach((item, index) => {
      const descLower = (item.descricao || '').toLowerCase();
      const obsLower = (item.observacoes || '').toLowerCase();

      if (obsLower.includes('bradesco') || descLower.includes('bradesco')) {
        itensBradesco.push(item);
      } else if (obsLower.includes('ailos') || descLower.includes('ailos')) {
        itensAilos.push(item);
      } else {
        // Separação proporcional baseada no lote original de 39 itens da fatura do Ailos
        if (index < 39 && sortedCompras.length > 39) {
          itensAilos.push(item);
        } else if (sortedCompras.length > 39) {
          itensBradesco.push(item);
        } else {
          itensAilos.push(item);
        }
      }
    });

    // Atualiza itens do Ailos
    for (const it of itensAilos) {
      await salvarLancamento(user.uid, {
        ...it,
        cartaoId: cartaoAilos.id,
        faturaId: 'fat_ailos_atual',
        status: 'pago',
        apenasVisualizacao: true,
        tags: ['item_fatura', 'detalhamento_cartao', 'extrato_cartao'],
        observacoes: 'Compra no Cartão Ailos / Viacredi (visualização no extrato)',
        atualizadoEm: new Date().toISOString(),
      });
    }

    // Atualiza itens do Bradesco
    for (const it of itensBradesco) {
      await salvarLancamento(user.uid, {
        ...it,
        cartaoId: cartaoBradesco.id,
        faturaId: 'fat_bradesco_atual',
        status: 'pago',
        apenasVisualizacao: true,
        tags: ['item_fatura', 'detalhamento_cartao', 'extrato_cartao'],
        observacoes: 'Compra no Cartão Bradesco (visualização no extrato)',
        atualizadoEm: new Date().toISOString(),
      });
    }

    const catContas = categorias.find(c => c.nome.toLowerCase().includes('moradia') || c.nome.toLowerCase().includes('contas'))?.id || categorias[0]?.id || 'cat_moradia';

    // Recria Fatura Ailos Consolidada
    if (itensAilos.length > 0) {
      const totalAilos = itensAilos.reduce((acc, i) => acc + (Number(i.valor) || 0), 0);
      const faturaAilosId = `fatura_ailos_${Date.now()}`;
      await salvarLancamento(user.uid, {
        id: faturaAilosId,
        tipo: 'despesa',
        descricao: `Fatura Ailos / Viacredi (${itensAilos.length} compras)`,
        valor: Number(totalAilos.toFixed(2)),
        categoriaId: catContas,
        cartaoId: cartaoAilos.id,
        faturaId: 'fat_ailos_atual',
        dataCompetencia: new Date().toISOString().split('T')[0],
        dataVencimento: itensAilos[0]?.dataVencimento || new Date().toISOString().split('T')[0],
        status: 'pendente',
        apenasVisualizacao: false,
        observacoes: `Conta a pagar da fatura Ailos / Viacredi com ${itensAilos.length} compras separadas.`,
        tags: ['fatura', 'contas-a-pagar', 'cartao'],
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });
    }

    // Recria Fatura Bradesco Consolidada
    if (itensBradesco.length > 0) {
      const totalBradesco = itensBradesco.reduce((acc, i) => acc + (Number(i.valor) || 0), 0);
      const faturaBradescoId = `fatura_bradesco_${Date.now()}`;
      await salvarLancamento(user.uid, {
        id: faturaBradescoId,
        tipo: 'despesa',
        descricao: `Fatura Bradesco (${itensBradesco.length} compras)`,
        valor: Number(totalBradesco.toFixed(2)),
        categoriaId: catContas,
        cartaoId: cartaoBradesco.id,
        faturaId: 'fat_bradesco_atual',
        dataCompetencia: new Date().toISOString().split('T')[0],
        dataVencimento: itensBradesco[0]?.dataVencimento || new Date().toISOString().split('T')[0],
        status: 'pendente',
        apenasVisualizacao: false,
        observacoes: `Conta a pagar da fatura Bradesco com ${itensBradesco.length} compras separadas.`,
        tags: ['fatura', 'contas-a-pagar', 'cartao'],
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });
    }

    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: `sep_${Date.now()}`,
      acao: 'atualizacao',
      detalhes: `Faturas separadas com sucesso: Ailos (${itensAilos.length} itens) e Bradesco (${itensBradesco.length} itens)`,
    });

    confetti({
      particleCount: 80,
      spread: 90,
      origin: { y: 0.5 },
    });
  };

  const handleCorrigirFaturaDuplicada = async () => {
    await handleSepararFaturasCartoes();
  };

  const handleConsolidarContaVivo = async () => {
    if (!user) return;
    
    // Procura todos os lançamentos relacionados à Vivo (ou fibra)
    const itensVivo = lancamentos.filter(l => {
      const d = l.descricao.toLowerCase();
      const obs = (l.observacoes || '').toLowerCase();
      return d.includes('vivo') || d.includes('fibra') || obs.includes('vivo');
    });

    if (itensVivo.length === 0) return;

    // Acha a categoria adequada (Software & Assinaturas ou Moradia & Aluguel)
    const catServicos = categorias.find(c => c.id === 'cat_servicos' || c.nome.toLowerCase().includes('software') || c.nome.toLowerCase().includes('assinatura') || c.nome.toLowerCase().includes('serviço'));
    const catMoradia = categorias.find(c => c.id === 'cat_moradia' || c.nome.toLowerCase().includes('moradia'));
    const categoriaFinalId = catServicos?.id || catMoradia?.id || (categorias[0]?.id || 'cat_outros');

    // Calcula valor total somado de todos os fragmentos da Vivo
    const somaTotal = itensVivo.reduce((acc, it) => acc + (Math.abs(Number(it.valor)) || 0), 0);
    
    // Pega a data de vencimento mais próxima/recente
    const dataVenc = itensVivo.find(i => i.dataVencimento)?.dataVencimento || new Date().toISOString().split('T')[0];

    // Detalhes dos itens originais para salvar na observação
    const detalhamento = itensVivo.map(i => `• ${i.descricao}: R$ ${Number(i.valor).toFixed(2)}`).join('\n');

    // Remove os itens fragmentados da Vivo
    for (const it of itensVivo) {
      await excluirLancamento(user.uid, it.id);
    }

    // Cria o lançamento único consolidado no valor total real
    const novoId = `vivo_consolidada_${Date.now()}`;
    const contaVivo: Lancamento = {
      id: novoId,
      tipo: 'despesa',
      descricao: 'Vivo - Conta Telefonia & Internet',
      valor: somaTotal,
      categoriaId: categoriaFinalId,
      dataCompetencia: new Date().toISOString().split('T')[0],
      dataVencimento: dataVenc,
      status: 'pendente',
      apenasVisualizacao: false,
      tags: ['contas-a-pagar', 'despesa_direta', 'boleto', 'conta_servico', 'ia'],
      observacoes: `Conta Vivo Consolidada (Total R$ ${somaTotal.toFixed(2)}). Detalhamento dos serviços:\n${detalhamento}`,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    await salvarLancamento(user.uid, contaVivo);

    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: novoId,
      acao: 'atualizacao',
      detalhes: `Conta da Vivo consolidada: ${itensVivo.length} itens unidos em um lançamento único de R$ ${somaTotal.toFixed(2)} em Contas a Pagar`,
    });

    confetti({
      particleCount: 85,
      spread: 90,
      origin: { y: 0.5 },
    });
  };

  const handleExcluirLancamento = async (id: string) => {
    if (!user) return;
    const lanc = lancamentos.find(l => l.id === id);
    if (!lanc) return;

    await excluirLancamento(user.uid, id);
    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: id,
      acao: 'exclusao',
      detalhes: `Lançamento "${lanc.descricao}" excluído`,
    });
  };

  const handleDuplicarLancamento = async (orig: Lancamento) => {
    if (!user) return;
    const novoId = `lanc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const hojeStr = new Date().toISOString().split('T')[0];
    const novo: Lancamento = {
      ...orig,
      id: novoId,
      descricao: `${orig.descricao} (Cópia)`,
      status: 'pendente',
      dataCompetencia: hojeStr,
      dataVencimento: orig.dataVencimento || hojeStr,
      dataPagamento: undefined,
      juros: undefined,
      multa: undefined,
      desconto: undefined,
      valorOriginal: undefined,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    await salvarLancamento(user.uid, novo);
    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: novoId,
      acao: 'criacao',
      detalhes: `Lançamento duplicado: "${novo.descricao}" a partir de "${orig.descricao}"`,
    });
  };

  const handleDividirLancamento = async (
    originalId: string,
    subPartes: { descricao: string; valor: number; categoriaId: string }[]
  ) => {
    if (!user) return;
    const original = lancamentos.find(l => l.id === originalId);
    if (!original) return;

    for (let i = 0; i < subPartes.length; i++) {
      const parte = subPartes[i];
      const novoId = `lanc_div_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
      const novoLanc: Lancamento = {
        ...original,
        id: novoId,
        descricao: parte.descricao,
        valor: parte.valor,
        categoriaId: parte.categoriaId,
        observacoes: `Parte ${i + 1}/${subPartes.length} dividida de "${original.descricao}". ${original.observacoes || ''}`.trim(),
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      await salvarLancamento(user.uid, novoLanc);
    }

    await excluirLancamento(user.uid, originalId);
    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: originalId,
      acao: 'atualizacao',
      detalhes: `Lançamento "${original.descricao}" (R$ ${original.valor}) dividido em ${subPartes.length} partes`,
    });
  };

  const handleSalvarCategoria = async (cat: Categoria) => {
    if (!user) return;
    await salvarCategoria(user.uid, cat);
    await registrarAuditLog(user.uid, {
      entidade: 'categoria',
      entidadeId: cat.id,
      acao: 'criacao',
      detalhes: `Categoria "${cat.nome}" salva/atualizada`,
    });
  };

  const handleExcluirCategoria = async (id: string, reatribuirParaId?: string) => {
    if (!user) return;
    const cat = categorias.find(c => c.id === id);
    if (!cat) return;

    if (reatribuirParaId) {
      const lancsAfetados = lancamentos.filter(l => l.categoriaId === id);
      for (const l of lancsAfetados) {
        await salvarLancamento(user.uid, {
          ...l,
          categoriaId: reatribuirParaId,
          atualizadoEm: new Date().toISOString(),
        });
      }
    }

    await excluirCategoria(user.uid, id);
    await registrarAuditLog(user.uid, {
      entidade: 'categoria',
      entidadeId: id,
      acao: 'exclusao',
      detalhes: `Categoria "${cat.nome}" excluída${reatribuirParaId ? ' e lançamentos reatribuídos' : ''}`,
    });
  };

  const handleMesclarCategorias = async (origemId: string, destinoId: string) => {
    if (!user) return;
    const catOrigem = categorias.find(c => c.id === origemId);
    const catDestino = categorias.find(c => c.id === destinoId);
    if (!catOrigem || !catDestino) return;

    const lancsAfetados = lancamentos.filter(l => l.categoriaId === origemId);
    for (const l of lancsAfetados) {
      await salvarLancamento(user.uid, {
        ...l,
        categoriaId: destinoId,
        atualizadoEm: new Date().toISOString(),
      });
    }

    await excluirCategoria(user.uid, origemId);
    await registrarAuditLog(user.uid, {
      entidade: 'categoria',
      entidadeId: origemId,
      acao: 'atualizacao',
      detalhes: `Categoria "${catOrigem.nome}" mesclada na categoria "${catDestino.nome}" (${lancsAfetados.length} lançamentos transferidos)`,
    });
  };

  const handleCriarSimples = async (dto: any) => {
    if (!user) return;
    const novoId = `lanc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const novo: Lancamento = {
      id: novoId,
      tipo: dto.tipo,
      descricao: dto.descricao,
      valor: Number(dto.valor),
      categoriaId: dto.categoriaId,
      contaId: dto.contaId || undefined,
      cartaoId: dto.cartaoId || undefined,
      faturaId: dto.faturaId || undefined,
      dataCompetencia: dto.dataCompetencia || new Date().toISOString().split('T')[0],
      dataVencimento: dto.dataVencimento || new Date().toISOString().split('T')[0],
      dataPagamento: dto.status === 'pago' ? (dto.dataPagamento || new Date().toISOString().split('T')[0]) : undefined,
      status: dto.status || 'pendente',
      observacoes: dto.observacoes,
      tags: dto.tags || [],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    // If paid immediately with an account, update account balance
    if (novo.status === 'pago' && novo.contaId) {
      const conta = contas.find(c => c.id === novo.contaId);
      if (conta) {
        const delta = novo.tipo === 'receita' ? novo.valor : -novo.valor;
        await salvarConta(user.uid, {
          ...conta,
          saldoAtual: Number(conta.saldoAtual) + delta,
        });
      }
    }

    await salvarLancamento(user.uid, novo);
    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: novoId,
      acao: 'criacao',
      detalhes: `Criado lançamento simples: ${novo.descricao} (R$ ${novo.valor})`,
    });
  };

  const handleCriarParcelado = async (dto: any) => {
    if (!user) return;
    const totalParcelas = Number(dto.numeroParcelas || dto.totalParcelas) || 1;
    const valorTotal = Number(dto.valor || dto.valorTotal);
    const paiId = `lanc_parc_${Date.now()}`;
    const dataInicialStr = dto.dataVencimento || dto.primeiroVencimento || new Date().toISOString().split('T')[0];
    const [anoIni, mesIni, diaIni] = dataInicialStr.split('-').map(Number);

    const valorBaseCentavos = Math.floor((valorTotal * 100) / totalParcelas);
    const restoCentavos = Math.round(valorTotal * 100) - (valorBaseCentavos * totalParcelas);

    for (let i = 1; i <= totalParcelas; i++) {
      const centavos = valorBaseCentavos + (i === 1 ? restoCentavos : 0);
      const valorParcela = centavos / 100;

      const dataVenc = new Date(anoIni, mesIni - 1 + (i - 1), diaIni || 10);
      const vencStr = dataVenc.toISOString().split('T')[0];

      const parcelaId = `${paiId}_${i}`;
      const lanc: Lancamento = {
        id: parcelaId,
        tipo: 'despesa',
        descricao: `${dto.descricao} (${i}/${totalParcelas})`,
        valor: valorParcela,
        categoriaId: dto.categoriaId,
        cartaoId: dto.cartaoId || undefined,
        contaId: dto.contaId || undefined,
        dataCompetencia: dto.dataCompetencia || dataInicialStr,
        dataVencimento: vencStr,
        status: (i === 1 && dto.status === 'pago') ? 'pago' : 'pendente',
        dataPagamento: (i === 1 && dto.status === 'pago') ? (dto.dataPagamento || vencStr) : undefined,
        observacoes: dto.observacoes,
        tags: dto.tags || ['parcelamento', 'cartao'],
        parcela: {
          numero: i,
          total: totalParcelas,
          lancamentoPaiId: paiId,
        },
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      await salvarLancamento(user.uid, lanc);
    }

    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: paiId,
      acao: 'criacao',
      detalhes: `Criada compra parcelada: ${dto.descricao} em ${totalParcelas}x de R$ ${(valorTotal / totalParcelas).toFixed(2)}`,
    });

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
    });
  };

  const handleCriarRecorrente = async (dto: any) => {
    if (!user) return;
    const novoId = `lanc_rec_${Date.now()}`;
    const lanc: Lancamento = {
      id: novoId,
      tipo: dto.tipo,
      descricao: dto.descricao,
      valor: Number(dto.valor),
      categoriaId: dto.categoriaId,
      contaId: dto.contaId || undefined,
      cartaoId: dto.cartaoId || undefined,
      dataCompetencia: new Date().toISOString().split('T')[0],
      dataVencimento: new Date().toISOString().split('T')[0],
      status: 'pendente',
      recorrencia: {
        frequencia: dto.recorrencia?.frequencia || 'mensal',
        diaVencimento: Number(dto.recorrencia?.diaVencimento) || 5,
        ajustaFimMes: true,
      },
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    await salvarLancamento(user.uid, lanc);
    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: novoId,
      acao: 'criacao',
      detalhes: `Criado lançamento recorrente: ${lanc.descricao}`,
    });
  };

  const handleCriarConta = async (contaDto: any) => {
    if (!user) return;
    const novoId = `conta_${Date.now()}`;
    const saldo = Number(contaDto.saldoInicial) || 0;
    const novaConta: Conta = {
      id: novoId,
      nome: contaDto.nome || 'Nova Conta',
      instituicao: contaDto.instituicao || 'Banco',
      tipo: contaDto.tipo || 'corrente',
      saldoInicial: saldo,
      saldoAtual: saldo,
      cor: contaDto.cor || '#10b981',
      icone: contaDto.icone || 'wallet',
      ativa: true,
      criadaEm: new Date().toISOString(),
    };
    await salvarConta(user.uid, novaConta);
    await registrarAuditLog(user.uid, {
      entidade: 'conta',
      entidadeId: novoId,
      acao: 'criacao',
      detalhes: `Conta criada: ${novaConta.nome}`,
    });
  };

  const handleCriarCartao = async (cartaoDto: any) => {
    if (!user) return;
    const novoId = `cartao_${Date.now()}`;
    const limite = Number(cartaoDto.limiteTotal) || 5000;
    const novoCartao: CartaoCredito = {
      id: novoId,
      nome: cartaoDto.nome || 'Novo Cartão',
      bandeira: cartaoDto.bandeira || 'mastercard',
      limiteTotal: limite,
      limiteDisponivel: limite,
      diaFechamento: Number(cartaoDto.diaFechamento) || 25,
      diaVencimento: Number(cartaoDto.diaVencimento) || 5,
      contaDebitoPadraoId: cartaoDto.contaDebitoPadraoId,
      cor: cartaoDto.cor || '#8b5cf6',
      ultimosDigitos: cartaoDto.ultimosDigitos || '0000',
      ativo: true,
    };
    await salvarCartao(user.uid, novoCartao);
    await registrarAuditLog(user.uid, {
      entidade: 'cartao',
      entidadeId: novoId,
      acao: 'criacao',
      detalhes: `Cartão de crédito criado: ${novoCartao.nome}`,
    });
  };

  const handleUpdateOrcamento = async (catId: string, novoValor: number) => {
    if (!user) return;
    const cat = categorias.find(c => c.id === catId);
    if (!cat) return;
    const catAtualizada = { ...cat, orcamentoMensal: Number(novoValor) || 0 };
    await salvarCategoria(user.uid, catAtualizada);
  };

  const handleImportarLote = async (
    cartaoId: string,
    faturaId: string,
    itens: ImportacaoFaturaItem[],
    opcoes?: {
      tipoDocumento?: string;
      modoLancamento?: 'conta_unica' | 'itens_discriminados';
      nomeEmissor?: string;
      dataVencimento?: string;
      criarContaPagar?: boolean;
      valorTotalFatura?: number;
      categoriaContaPagarId?: string;
    }
  ) => {
    if (!user) return;
    
    let targetCartaoId = cartaoId;
    let targetCartao = cartoes.find(c => c.id === targetCartaoId);

    const nomeEmissorOuCartao = opcoes?.nomeEmissor || 'Cartão de Crédito';
    const emissorLower = nomeEmissorOuCartao.toLowerCase();
    const dataVencimentoFatura = opcoes?.dataVencimento || new Date().toISOString().split('T')[0];
    const selecionados = itens.filter(i => i.selecionado);

    const isBoletoAvulso = 
      opcoes?.tipoDocumento === 'boleto_cobranca' || 
      emissorLower.includes('vivo') || 
      emissorLower.includes('claro') || 
      emissorLower.includes('tim') || 
      emissorLower.includes('oi') || 
      emissorLower.includes('copel') || 
      emissorLower.includes('enel') || 
      emissorLower.includes('sabesp') || 
      emissorLower.includes('sanepar') || 
      emissorLower.includes('servopa') || 
      emissorLower.includes('consórcio') || 
      emissorLower.includes('consorcio') || 
      emissorLower.includes('condom') || 
      emissorLower.includes('aluguel') ||
      selecionados.some(s => {
        const d = s.descricao.toLowerCase();
        return d.includes('vivo') || d.includes('fibra') || d.includes('servopa') || d.includes('consórcio') || d.includes('consorcio') || d.includes('boleto');
      });

    // FLUXO A: BOLETO / CONTA DE SERVIÇO / TELECOM A PAGAR DIRETA (Ex: Vivo, Consórcio Servopa, Copel, etc.)
    if (isBoletoAvulso) {
      const somaItens = selecionados.reduce((acc, it) => acc + (Math.abs(Number(it.valor)) || 0), 0);
      const valorFinal = opcoes?.valorTotalFatura && Number(opcoes.valorTotalFatura) > 0 
        ? Number(opcoes.valorTotalFatura) 
        : somaItens;

      // Categoria padrão inteligente
      const catServicos = categorias.find(c => c.id === 'cat_servicos' || c.nome.toLowerCase().includes('software') || c.nome.toLowerCase().includes('assinatura') || c.nome.toLowerCase().includes('serviço'));
      const catMoradia = categorias.find(c => c.id === 'cat_moradia' || c.nome.toLowerCase().includes('moradia'));
      const catTransporte = categorias.find(c => c.id === 'cat_transporte' || c.nome.toLowerCase().includes('transporte'));

      let categoriaPadraoId = opcoes?.categoriaContaPagarId;
      if (!categoriaPadraoId) {
        if (emissorLower.includes('vivo') || emissorLower.includes('claro') || emissorLower.includes('tim') || selecionados.some(s => s.descricao.toLowerCase().includes('vivo') || s.descricao.toLowerCase().includes('fibra'))) {
          categoriaPadraoId = catServicos?.id || catMoradia?.id || (categorias[0]?.id || 'cat_outros');
        } else if (emissorLower.includes('copel') || emissorLower.includes('enel') || emissorLower.includes('sabesp') || emissorLower.includes('condom') || emissorLower.includes('aluguel')) {
          categoriaPadraoId = catMoradia?.id || (categorias[0]?.id || 'cat_outros');
        } else if (emissorLower.includes('servopa') || emissorLower.includes('consórcio') || emissorLower.includes('consorcio')) {
          categoriaPadraoId = catTransporte?.id || (categorias[0]?.id || 'cat_outros');
        } else {
          categoriaPadraoId = selecionados[0]?.categoriaSugeridaId || (categorias[0]?.id || 'cat_outros');
        }
      }

      // Se o modo for Conta Única (padrão para boletos/contas de serviços como Vivo)
      const modo = opcoes?.modoLancamento || 'conta_unica';
      if (modo === 'conta_unica') {
        const novoId = `boleto_total_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const tituloConta = emissorLower.includes('vivo') 
          ? 'Vivo - Conta Telefonia & Internet'
          : emissorLower.includes('servopa')
          ? 'Consórcio Servopa - Parcela'
          : `${nomeEmissorOuCartao} - Conta / Boleto`;

        const detalhamento = selecionados
          .map(s => `• ${s.descricao}: R$ ${Number(s.valor).toFixed(2)}`)
          .join('\n');

        const lanc: Lancamento = {
          id: novoId,
          tipo: 'despesa',
          descricao: tituloConta,
          valor: valorFinal,
          categoriaId: categoriaPadraoId,
          dataCompetencia: new Date().toISOString().split('T')[0],
          dataVencimento: dataVencimentoFatura,
          status: 'pendente', // Pendente em Contas a Pagar
          apenasVisualizacao: false, // Despesa Real a Pagar!
          tags: ['contas-a-pagar', 'boleto', 'conta_servico', 'despesa_direta', 'ia'],
          observacoes: `Conta / Boleto ${nomeEmissorOuCartao} (Vencimento: ${dataVencimentoFatura.split('-').reverse().join('/')}). Detalhamento dos serviços:\n${detalhamento}`,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        };
        await salvarLancamento(user.uid, lanc);

        await registrarAuditLog(user.uid, {
          entidade: 'lancamento',
          entidadeId: novoId,
          acao: 'criacao',
          detalhes: `Importada conta única de ${tituloConta} no valor de R$ ${valorFinal.toFixed(2)} com vencimento em ${dataVencimentoFatura}`,
        });
      } else {
        // Modo Itens Discriminados
        for (const item of selecionados) {
          const valorItem = Math.abs(Number(item.valor) || 0);
          const dataItem = item.data || dataVencimentoFatura || new Date().toISOString().split('T')[0];
          const descItem = item.descricao.trim();

          const novoId = `boleto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const lanc: Lancamento = {
            id: novoId,
            tipo: 'despesa',
            descricao: descItem,
            valor: valorItem,
            categoriaId: item.categoriaSugeridaId || categoriaPadraoId,
            dataCompetencia: new Date().toISOString().split('T')[0],
            dataVencimento: dataVencimentoFatura || dataItem,
            status: 'pendente', // Pendente em Contas a Pagar
            apenasVisualizacao: false, // Despesa Real a Pagar!
            tags: ['contas-a-pagar', 'boleto', 'conta_servico', 'ia', 'despesa_direta'],
            observacoes: `Item de conta / boleto (${nomeEmissorOuCartao}). Vencimento: ${(dataVencimentoFatura || dataItem).split('-').reverse().join('/')}.`,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
          };
          await salvarLancamento(user.uid, lanc);
        }

        await registrarAuditLog(user.uid, {
          entidade: 'lancamento',
          entidadeId: `lote_${Date.now()}`,
          acao: 'criacao',
          detalhes: `Importados ${selecionados.length} itens de ${nomeEmissorOuCartao} diretamente em Contas a Pagar`,
        });
      }

      confetti({
        particleCount: 75,
        spread: 80,
        origin: { y: 0.55 },
      });
      return;
    }

    // FLUXO B: FATURA DE CARTÃO DE CRÉDITO COM COMPRAS NO EXTRATO
    let cardNomeFinal = nomeEmissorOuCartao;
    if (cartaoId.startsWith('novo_cartao__')) {
      cardNomeFinal = cartaoId.replace('novo_cartao__', '').trim() || nomeEmissorOuCartao;
      targetCartao = undefined;
    }

    // Busca se já existe algum cartão com o nome do emissor (ex: Bradesco, Ailos)
    if (!targetCartao && cardNomeFinal) {
      targetCartao = cartoes.find(c => 
        c.nome.toLowerCase().includes(cardNomeFinal.toLowerCase()) || 
        cardNomeFinal.toLowerCase().includes(c.nome.toLowerCase())
      );
      if (targetCartao) {
        targetCartaoId = targetCartao.id;
      }
    }

    // Se ainda não existir o cartão para esse emissor, cria automaticamente o novo cartão isolado
    if (!targetCartao) {
      const novoCardId = `cartao_${cardNomeFinal.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
      const diaVencNum = dataVencimentoFatura ? parseInt(dataVencimentoFatura.split('-')[2], 10) || 5 : 5;
      
      let cardColor = '#0d9488';
      const emissorLower = cardNomeFinal.toLowerCase();
      if (emissorLower.includes('bradesco')) cardColor = '#cc092f';
      else if (emissorLower.includes('ailos') || emissorLower.includes('viacredi')) cardColor = '#0077c8';
      else if (emissorLower.includes('nubank')) cardColor = '#820ad1';
      else if (emissorLower.includes('itau') || emissorLower.includes('itaú')) cardColor = '#ec7000';
      else if (emissorLower.includes('santander')) cardColor = '#cc0000';
      else if (emissorLower.includes('inter')) cardColor = '#ff7a00';
      else if (emissorLower.includes('c6')) cardColor = '#1f2937';

      const novoCartao: CartaoCredito = {
        id: novoCardId,
        nome: cardNomeFinal,
        bandeira: emissorLower.includes('visa') ? 'visa' : 'mastercard',
        limiteTotal: 10000,
        limiteDisponivel: 10000,
        diaFechamento: diaVencNum > 7 ? diaVencNum - 7 : 25,
        diaVencimento: diaVencNum,
        cor: cardColor,
        ultimosDigitos: '4321',
        ativo: true,
      };
      await salvarCartao(user.uid, novoCartao);
      targetCartaoId = novoCardId;
      targetCartao = novoCartao;
    }

    const nomeFinalCartao = targetCartao?.nome || cardNomeFinal;
    const somaItens = selecionados.reduce((acc, it) => acc + (Math.abs(Number(it.valor)) || 0), 0);
    const valorTotalFatura = opcoes?.valorTotalFatura && opcoes.valorTotalFatura > 0 
      ? Number(opcoes.valorTotalFatura) 
      : somaItens;

    const deveCriarContaPagar = opcoes?.criarContaPagar !== false;
    const faturaRefId = `fat_${targetCartaoId}_${Date.now()}`;

    // 1. Salva cada lançamento detalhado extraído da fatura
    for (const item of selecionados) {
      const valorItem = Math.abs(Number(item.valor) || 0);
      const dataItem = item.data || new Date().toISOString().split('T')[0];
      const descItem = item.descricao.trim();

      const infoParc = ParcelamentoService.extrairInfoDescricao(descItem);
      const numParc = item.parcelaAtual || infoParc.parcelaAtual;
      const totParc = item.totalParcelas || infoParc.totalParcelas;
      const descLimpa = infoParc.descricaoBase || descItem;

      // Procura se já existe exatamente o mesmo lançamento no mesmo cartão
      const lancamentoExistente = lancamentos.find(
        l => l.cartaoId === targetCartaoId && 
             (l.descricao.trim().toLowerCase() === descItem.toLowerCase() || l.descricao.trim().toLowerCase().includes(descLimpa.toLowerCase())) && 
             Math.abs(l.valor - valorItem) < 0.01 && 
             (l.dataCompetencia === dataItem || l.dataVencimento === dataItem)
      );

      const novoId = lancamentoExistente?.id || `lanc_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      
      const lanc: Lancamento = {
        id: novoId,
        tipo: 'despesa',
        descricao: descItem,
        valor: valorItem,
        categoriaId: item.categoriaSugeridaId || lancamentoExistente?.categoriaId || (categorias[0]?.id || 'cat_outros'),
        cartaoId: targetCartaoId,
        faturaId: faturaId || 'fat_atual',
        dataCompetencia: dataItem,
        dataVencimento: dataItem,
        // Se gera a Conta a Pagar consolidada, a compra individual no cartão é marcada como 'pago' (já autorizada no cartão)
        // e como apenasVisualizacao para não duplicar na soma do dashboard e contas a pagar
        status: deveCriarContaPagar ? 'pago' : (lancamentoExistente?.status || 'pendente'),
        apenasVisualizacao: deveCriarContaPagar,
        parcela: numParc && totParc && totParc > 1 ? {
          numero: numParc,
          total: totParc,
          lancamentoPaiId: `imp_parc_${descLimpa.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${targetCartaoId}_${totParc}`,
        } : lancamentoExistente?.parcela,
        tags: Array.from(new Set([
          ...(lancamentoExistente?.tags || []),
          'item_fatura', 
          'detalhamento_cartao', 
          'extrato_cartao',
          ...(numParc && totParc && totParc > 1 ? ['parcelamento', `parc_${numParc}_${totParc}`] : [])
        ])),
        observacoes: `Compra da fatura ${nomeFinalCartao} (visualização no extrato)${numParc && totParc ? ` - Parcela ${numParc}/${totParc}` : ''}`.trim(),
        criadoEm: lancamentoExistente?.criadoEm || new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      await salvarLancamento(user.uid, lanc);
    }

    // 2. Cria a Conta a Pagar consolidada com o Valor Total e a Data de Vencimento da Fatura
    if (deveCriarContaPagar && valorTotalFatura > 0) {
      // Remove fatura anterior pendente se for do mesmo cartão para evitar duplicidade
      const faturaAnterior = lancamentos.find(
        l => l.cartaoId === targetCartaoId && 
             (l.tags?.includes('fatura') || l.descricao.toLowerCase().startsWith('fatura ')) &&
             l.status === 'pendente'
      );
      if (faturaAnterior) {
        await excluirLancamento(user.uid, faturaAnterior.id);
      }

      const contaPagarId = `fatura_pagar_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const catContaPagar = opcoes?.categoriaContaPagarId || 
        categorias.find(c => c.nome.toLowerCase().includes('moradia') || c.nome.toLowerCase().includes('contas'))?.id || 
        categorias[0]?.id || 
        'cat_contas';

      const contaPagarFatura: Lancamento = {
        id: contaPagarId,
        tipo: 'despesa',
        descricao: `Fatura ${nomeFinalCartao} (${selecionados.length} compras)`,
        valor: Number(valorTotalFatura.toFixed(2)),
        categoriaId: catContaPagar,
        cartaoId: targetCartaoId,
        faturaId: faturaId || 'fat_atual',
        dataCompetencia: new Date().toISOString().split('T')[0],
        dataVencimento: dataVencimentoFatura,
        status: 'pendente', // Fatura Pendente em Contas a Pagar
        apenasVisualizacao: false,
        observacoes: `Conta a pagar da fatura ${nomeFinalCartao} com ${selecionados.length} compras detalhadas extraídas via IA. Vencimento: ${dataVencimentoFatura.split('-').reverse().join('/')}.`,
        tags: ['fatura', 'contas-a-pagar', 'cartao', 'ia'],
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      await salvarLancamento(user.uid, contaPagarFatura);

      // Salva o documento de fechamento da fatura
      const mesRef = new Date(dataVencimentoFatura).getMonth() + 1;
      const anoRef = new Date(dataVencimentoFatura).getFullYear();
      const faturaDoc: FaturaCartao = {
        id: `fat_${targetCartaoId}_${anoRef}_${mesRef}`,
        cartaoId: targetCartaoId,
        mesReferencia: mesRef,
        anoReferencia: anoRef,
        dataFechamento: new Date().toISOString().split('T')[0],
        dataVencimento: dataVencimentoFatura,
        valorTotal: valorTotalFatura,
        status: 'fechada',
        itensCount: selecionados.length,
      };
      await salvarFatura(user.uid, faturaDoc);
    }

    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: `lote_${Date.now()}`,
      acao: 'criacao',
      detalhes: `Importados ${selecionados.length} compras da fatura ${nomeFinalCartao} e gerada Conta a Pagar de R$ ${valorTotalFatura.toFixed(2)} com vencimento em ${dataVencimentoFatura}`,
    });

    confetti({
      particleCount: 85,
      spread: 90,
      origin: { y: 0.55 },
    });
  };

  const handleAtualizarLoteLancamentos = async (atualizacoes: Partial<Lancamento>[]) => {
    if (!user || atualizacoes.length === 0) return;
    
    const promises = atualizacoes.map(async (item) => {
      if (!item.id) return;
      const existente = lancamentos.find(l => l.id === item.id);
      if (existente) {
        return salvarLancamento(user.uid, {
          ...existente,
          ...item,
          atualizadoEm: new Date().toISOString(),
        });
      }
    });

    await Promise.all(promises);

    await registrarAuditLog(user.uid, {
      entidade: 'lancamento',
      entidadeId: `audit_parc_${Date.now()}`,
      acao: 'atualizacao',
      detalhes: `Sincronizadas ${atualizacoes.length} parcelas identificadas automaticamente`,
    });

    confetti({
      particleCount: 75,
      spread: 80,
      origin: { y: 0.6 },
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenNovoLancamento={() => setModalNovoAberto(true)}
        onOpenSqlModal={() => setModalSqlAberto(true)}
        onOpenCategoriasModal={() => setModalCategoriasAberto(true)}
        saldoConsolidado={resumo?.saldoTotalConsolidado ?? 0}
      />

      {/* Main Content Area (with bottom padding for smartphone thumb nav) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-8">
        {!dataReady ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-xs gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Sincronizando seu banco de dados privado...</span>
          </div>
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                resumo={resumo}
                contas={contas}
                cartoes={cartoes}
                onPagarLancamento={handlePagarLancamento}
                onNovoLancamento={() => setModalNovoAberto(true)}
                onNavigateTab={setCurrentTab}
              />
            )}

            {currentTab === 'lancamentos' && (
              <LancamentosView
                lancamentos={lancamentos}
                contas={contas}
                cartoes={cartoes}
                categorias={categorias}
                onNovoLancamento={() => setModalNovoAberto(true)}
                onPagar={handlePagarLancamento}
                onCancelar={handleCancelarLancamento}
                onReabrir={handleReabrirLancamento}
                onAlterarStatus={handleAlterarStatusLancamento}
                onAlterarCategoria={handleAlterarCategoriaLancamento}
                onConverterParaDespesaReal={handleConverterParaDespesaReal}
                onAtualizarLancamento={handleAtualizarLancamentoCompleto}
                onDuplicarLancamento={handleDuplicarLancamento}
                onDividirLancamento={handleDividirLancamento}
                onAbrirGerenciadorCategorias={() => setModalCategoriasAberto(true)}
                onDeduplicar={handleDeduplicarLancamentos}
                onCorrigirFatura={handleCorrigirFaturaDuplicada}
                onSepararCartoes={handleSepararFaturasCartoes}
                onConsolidarContaVivo={handleConsolidarContaVivo}
                onExcluir={handleExcluirLancamento}
                onNavigateTab={setCurrentTab}
              />
            )}

            {currentTab === 'contas_cartoes' && (
              <ContasCartoesView
                contas={contas}
                cartoes={cartoes}
                onCriarConta={handleCriarConta}
                onCriarCartao={handleCriarCartao}
                onNavigateTab={setCurrentTab}
              />
            )}

            {currentTab === 'faturas_parcelamentos' && (
              <FaturasParcelamentosView
                lancamentos={lancamentos}
                cartoes={cartoes}
                categorias={categorias}
                onCriarParcelado={handleCriarParcelado}
                onAtualizarLoteLancamentos={handleAtualizarLoteLancamentos}
                onNavigateTab={setCurrentTab}
              />
            )}

            {currentTab === 'importacao_ia' && (
              <ImportacaoFaturaView
                cartoes={cartoes}
                categorias={categorias}
                onImportarLote={handleImportarLote}
                onNavigateTab={setCurrentTab}
              />
            )}

            {currentTab === 'orcamentos' && (
              <OrcamentosView
                categorias={categorias}
                resumo={resumo}
                onUpdateOrcamento={handleUpdateOrcamento}
              />
            )}

            {currentTab === 'insights' && (
              <IaInsightsView resumo={resumo} />
            )}
          </>
        )}
      </main>

      {/* Smartphone Bottom Navigation Bar */}
      <MobileBottomNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenNovoLancamento={() => setModalNovoAberto(true)}
      />

      {/* Desktop/Tablet Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Finance Pro • Banco de dados individual criptografado por usuário
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            Firebase Auth + Cloud Firestore
          </span>
        </div>
      </footer>

      {/* Modals */}
      <NovoLancamentoModal
        isOpen={modalNovoAberto}
        onClose={() => setModalNovoAberto(false)}
        contas={contas}
        cartoes={cartoes}
        categorias={categorias}
        onCriarSimples={handleCriarSimples}
        onCriarParcelado={handleCriarParcelado}
        onCriarRecorrente={handleCriarRecorrente}
      />

      <SqlSchemaModal
        isOpen={modalSqlAberto}
        onClose={() => setModalSqlAberto(false)}
      />

      {/* Modal de Pagamento de Conta com Opção de Juros/Multa */}
      <ModalPagarConta
        lancamento={lancamentoParaPagar}
        contas={contas}
        onClose={() => setLancamentoParaPagar(null)}
        onConfirmarPagamento={handleConfirmarPagamentoComJuros}
      />

      {/* Modal de Gestão Completa de Categorias (Renomear, Editar, Excluir, Mesclar) */}
      <ModalGerenciarCategorias
        isOpen={modalCategoriasAberto}
        onClose={() => setModalCategoriasAberto(false)}
        categorias={categorias}
        lancamentos={lancamentos}
        onSalvarCategoria={handleSalvarCategoria}
        onExcluirCategoria={handleExcluirCategoria}
        onMesclarCategorias={handleMesclarCategorias}
      />

    </div>
  );
}

export default App;
